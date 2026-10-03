import { readdir, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { ownedDirectory, childDirectory, ownedFile, validId } from '../projects/paths.mjs';
import { atomicWrite, digest, exclusiveWriter } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { TextModel } from './text-model.mjs';
import { measureSource } from './metrics.mjs';

export const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
export const MAX_PROJECT_SOURCE_BYTES = 256 * 1024 * 1024;
const MAX_RECORD_BYTES = MAX_SOURCE_BYTES * 6 + 65536;
const hashPattern = /^[a-f0-9]{64}$/;
const versionFile = /^v-[1-9][0-9]*-[a-f0-9-]{36}\.json$/;
const commitFile = /^c-[a-f0-9-]{36}\.json$/;
const commitDescriptor = value => value === null || (validId(value?.operationId) && hashPattern.test(value?.sha256) && commitFile.test(value?.file));
const error = code => Object.assign(new Error(code), { code });
const reject = (code, extra = {}) => ({ ok: false, code, ...extra });
const jsonBytes = value => Buffer.from(JSON.stringify(value));
const requestHash = value => digest(jsonBytes(value));
function id(value) { if (!validId(value)) throw error('INVALID_ID'); return value; }
function version(value) { if (!Number.isSafeInteger(value) || value < 1) throw error('INVALID_VERSION'); return value; }
function decode(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return null; }
}
function sourceRef(sourceId, currentVersion, bytes, provenance) {
  const text = decode(bytes);
  const metrics = text === null ? { utf8Bytes: bytes.length, utf16Units: null, lines: null, longestLineUnits: null } : measureSource(text);
  let newline = 'none';
  if (text !== null) {
    let crlf = false, lf = false, cr = false;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\r') { if (text[i + 1] === '\n') { crlf = true; i++; } else cr = true; }
      else if (text[i] === '\n') lf = true;
    }
    const types = [crlf && 'crlf', lf && 'lf', cr && 'cr'].filter(Boolean);
    newline = types.length > 1 ? 'mixed' : types[0] ?? 'none';
  }
  return { sourceId, version: currentVersion, sha256: digest(bytes), ...metrics,
    encoding: text === null ? 'unsupported' : 'utf8', bom: bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
    newline, provenance };
}

/** Node authority only. Root is the owned SIREN Data directory, never a renderer path. */
export class SourceRepository {
  constructor(root, { canWrite = () => true, fault = async () => {}, checkpoint, ownerIdentity, inspectProcess, limits = {} } = {}) {
    this.root = resolve(root); this.canWrite = canWrite; this.fault = fault; this.checkpoint = checkpoint;
    this.writerOptions = { ownerIdentity, inspectProcess };
    this.limits = { sourceBytes: Math.min(limits.sourceBytes ?? MAX_SOURCE_BYTES, MAX_SOURCE_BYTES), projectBytes: Math.min(limits.projectBytes ?? MAX_PROJECT_SOURCE_BYTES, MAX_PROJECT_SOURCE_BYTES) };
    for (const cap of Object.values(this.limits)) if (!Number.isSafeInteger(cap) || cap < 1) throw error('INVALID_BUDGET');
  }
  async access(action, projectId, sourceId) {
    id(projectId); if (sourceId !== undefined) id(sourceId);
    if (!await this.canWrite({ action, projectId, sourceId })) throw error('ACCESS_REFUSED');
  }
  async projectDirectory(projectId) {
    id(projectId); await ownedDirectory(this.root);
    return childDirectory(await ownedDirectory(join(this.root, 'Projects')), projectId);
  }
  async sourcesDirectory(projectId, create = false) {
    return childDirectory(await this.projectDirectory(projectId), 'sources', { create });
  }
  async sourceDirectory(projectId, sourceId) { id(sourceId); return childDirectory(await this.sourcesDirectory(projectId), sourceId); }
  async occupied(directory) {
    let total = 0;
    for (const name of await readdir(directory)) {
      const path = join(directory, name); const info = await lstat(path);
      if (info.isSymbolicLink()) throw error('OWNED_PATH_REFUSED');
      if (info.isDirectory()) total += await this.occupied(await ownedDirectory(path));
      else { await ownedFile(path); total += info.size; }
      if (total > this.limits.projectBytes) throw error('PROJECT_BUDGET');
    }
    return total;
  }
  async write(projectId, path, bytes, options = {}) {
    // Include retained versions, pending files, metadata and the atomic-write temporary.
    // Nothing is collected merely to make an over-budget transaction fit.
    const used = await this.occupied(await this.sourcesDirectory(projectId));
    if (used + bytes.length > this.limits.projectBytes) throw error('PROJECT_BUDGET');
    await this.access('write', projectId);
    return atomicWrite(path, bytes, { ...options, fault: async phase => {
      await this.fault(phase);
      // Recheck after asynchronous flush/fault work, immediately before rename.
      // A lock/read-only transition must not publish a newly selected source.
      if (phase === 'before-select' || phase === 'before-rename') await this.access('write', projectId);
    } });
  }
  async immutable(projectId, path, bytes) {
    try { const old = await readOwnedBytes(path, bytes.length); if (!old.equals(bytes)) throw error('IMMUTABLE_CONFLICT'); return digest(old); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    return this.write(projectId, path, bytes);
  }
  async readPointer(directory, sourceId) {
    const pointer = JSON.parse(await readOwnedBytes(join(directory, 'current.json'), 65536));
    if (pointer.schema !== 1 || pointer.sourceId !== sourceId || !versionFile.test(pointer.head?.file) || !hashPattern.test(pointer.head?.sha256)) throw error('CORRUPT_SOURCE');
    if (!commitDescriptor(pointer.commitHead)) throw error('CORRUPT_SOURCE');
    return pointer;
  }
  async readRecord(directory, descriptor, sourceId) {
    if (!versionFile.test(descriptor?.file) || !hashPattern.test(descriptor?.sha256)) throw error('CORRUPT_SOURCE');
    const bytes = await readOwnedBytes(join(await childDirectory(directory, 'versions'), descriptor.file), MAX_RECORD_BYTES);
    if (digest(bytes) !== descriptor.sha256) throw error('CORRUPT_SOURCE');
    const record = JSON.parse(bytes);
    if (record.schema !== 1 || record.ref?.sourceId !== sourceId || !hashPattern.test(record.ref.sha256)) throw error('CORRUPT_SOURCE');
    version(record.ref.version);
    return record;
  }
  async load(projectId, sourceId, requestedVersion) {
    const directory = await this.sourceDirectory(projectId, sourceId);
    const pointer = await this.readPointer(directory, sourceId);
    let descriptor = pointer.head; const records = []; const seen = new Set(); let previous = Infinity;
    while (descriptor) {
      if (seen.has(descriptor.file)) throw error('CORRUPT_SOURCE'); seen.add(descriptor.file);
      const record = await this.readRecord(directory, descriptor, sourceId);
      if (record.ref.version >= previous) throw error('CORRUPT_SOURCE'); previous = record.ref.version;
      records.push({ record, descriptor }); descriptor = record.parent;
    }
    const selected = records[0].record.ref;
    const target = requestedVersion === undefined ? selected.version : version(requestedVersion);
    const index = records.findIndex(item => item.record.ref.version === target);
    if (index < 0) throw error('UNKNOWN_VERSION');
    const chain = records.slice(index).reverse(); const base = chain[0].record;
    if (base.kind !== 'import' || base.ref.version !== 1 || !hashPattern.test(base.blob)) throw error('CORRUPT_SOURCE');
    const bytes = await readOwnedBytes(join(await childDirectory(directory, 'blobs'), `${base.blob}.bin`), this.limits.sourceBytes);
    if (digest(bytes) !== base.blob || base.ref.sha256 !== base.blob) throw error('CORRUPT_SOURCE');
    const text = decode(bytes); let model = text === null ? null : new TextModel({ text, version: 1, sourceId });
    for (const { record } of chain.slice(1)) {
      if (!model || record.kind !== 'edit' || record.ref.version !== model.version + 1 || requestHash(record.edit) !== record.requestHash) throw error('CORRUPT_SOURCE');
      const applied = model.apply(record.edit);
      if (!applied.ok || applied.version !== record.ref.version) throw error('CORRUPT_SOURCE');
    }
    const result = model ? Buffer.from(model.text) : bytes;
    const ref = records[index].record.ref;
    if (digest(result) !== ref.sha256 || result.length !== ref.utf8Bytes) throw error('CORRUPT_SOURCE');
    return { directory, pointer, records, ref, selected, model, bytes: result };
  }
  async select(projectId, directory, pointer) {
    const bytes = jsonBytes(pointer);
    try { await this.write(projectId, join(directory, 'current.json'), bytes, { selection: true }); }
    catch (e) {
      // An after-select fault can mean the new pointer is already durable. Verify it
      // exactly; never report the old version merely because a later hook failed.
      let actual; try { actual = await readOwnedBytes(join(directory, 'current.json'), 65536); } catch { throw e; }
      if (!actual.equals(bytes)) throw e;
    }
  }
  async importSource({ projectId, bytes, provenance = {} }) {
    await this.access('import', projectId);
    if (!(bytes instanceof Uint8Array)) throw error('INVALID_SOURCE');
    bytes = Buffer.from(bytes);
    if (bytes.length > this.limits.sourceBytes) throw error('SOURCE_BUDGET');
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance) || jsonBytes(provenance).length > 65536) throw error('INVALID_PROVENANCE');
    provenance = JSON.parse(JSON.stringify(provenance));
    const project = await this.projectDirectory(projectId);
    return exclusiveWriter(project, async () => {
      await this.access('import', projectId);
      const sources = await this.sourcesDirectory(projectId, true);
      const sourceId = randomUUID(); const directory = await childDirectory(sources, sourceId, { create: true });
      const blobs = await childDirectory(directory, 'blobs', { create: true });
      const versions = await childDirectory(directory, 'versions', { create: true });
      await childDirectory(directory, 'commits', { create: true });
      const ref = sourceRef(sourceId, 1, bytes, provenance);
      await this.immutable(projectId, join(blobs, `${ref.sha256}.bin`), bytes); await this.fault('source-blob-verified');
      const record = { schema: 1, kind: 'import', ref, blob: ref.sha256, parent: null };
      const file = `v-1-${randomUUID()}.json`;
      const sha256 = await this.immutable(projectId, join(versions, file), jsonBytes(record)); await this.fault('source-version-verified');
      await this.select(projectId, directory, { schema: 1, sourceId, head: { file, sha256 }, commitHead: null });
      await this.load(projectId, sourceId, 1);
      return ref;
    }, this.writerOptions);
  }
  async exportSource({ projectId, sourceId, version: requestedVersion }) {
    await this.access('export', projectId, sourceId);
    const loaded = await this.load(projectId, sourceId, requestedVersion);
    await this.access('export', projectId, sourceId); return loaded.bytes;
  }
  async readRange({ projectId, sourceId, version: requestedVersion, start, end }) {
    await this.access('read', projectId, sourceId);
    const loaded = await this.load(projectId, sourceId, requestedVersion);
    if (!loaded.model) throw error('UNSUPPORTED_ENCODING');
    const text = loaded.model.readRange(loaded.ref.version, start, end);
    await this.access('read', projectId, sourceId); return text;
  }
  async getMetrics({ projectId, sourceId, version: requestedVersion }) {
    await this.access('read', projectId, sourceId);
    const loaded = await this.load(projectId, sourceId, requestedVersion);
    await this.access('read', projectId, sourceId); return loaded.ref;
  }
  async applyEdit({ projectId, edit }) {
    try {
      await this.access('edit', projectId, edit?.sourceId); id(edit?.operationId);
      const directory = await this.projectDirectory(projectId);
      return await exclusiveWriter(directory, async () => {
        await this.access('edit', projectId, edit.sourceId);
        const loaded = await this.load(projectId, edit.sourceId);
        const payload = { operationId: edit.operationId, sourceId: edit.sourceId, expectedVersion: edit.expectedVersion, start: edit.start, end: edit.end, insertedText: edit.insertedText };
        const payloadHash = requestHash(payload);
        let commit = loaded.pointer.commitHead; const seenCommits = new Set();
        while (commit) {
          if (seenCommits.has(commit.operationId)) throw error('CORRUPT_SOURCE'); seenCommits.add(commit.operationId);
          const previousCommit = await this.commitRecord(loaded.directory, commit);
          if (previousCommit.sourceId !== edit.sourceId) throw error('CORRUPT_SOURCE');
          if (commit.operationId === edit.operationId) return reject('OPERATION_CONFLICT');
          commit = previousCommit.parent;
        }
        const prior = loaded.records.find(item => item.record.kind === 'edit' && item.record.edit.operationId === edit.operationId)?.record;
        if (prior) return prior.requestHash === payloadHash ? { ok: true, operationId: edit.operationId, sourceId: edit.sourceId, version: prior.ref.version, sha256: prior.ref.sha256, durability: 'draft' } : reject('OPERATION_CONFLICT');
        if (!loaded.model) return reject('UNSUPPORTED_ENCODING');
        const checked = loaded.model.validate(payload); if (!checked.ok) return checked;
        const bytes = Buffer.from(loaded.model.readRange(loaded.ref.version, 0, edit.start) + edit.insertedText + loaded.model.readRange(loaded.ref.version, edit.end, loaded.ref.utf16Units));
        if (bytes.length > this.limits.sourceBytes) return reject('SOURCE_BUDGET');
        const ref = sourceRef(edit.sourceId, checked.version, bytes, loaded.ref.provenance);
        const record = { schema: 1, kind: 'edit', ref, parent: loaded.pointer.head, edit: payload, requestHash: payloadHash };
        const file = `v-${ref.version}-${randomUUID()}.json`;
        const sha256 = await this.immutable(projectId, join(await childDirectory(loaded.directory, 'versions'), file), jsonBytes(record));
        await this.fault('source-version-verified');
        await this.access('edit', projectId, edit.sourceId);
        await this.select(projectId, loaded.directory, { ...loaded.pointer, head: { file, sha256 } });
        const verified = await this.load(projectId, edit.sourceId);
        if (verified.ref.version !== ref.version || verified.ref.sha256 !== ref.sha256) throw error('SOURCE_READBACK_FAILED');
        return { ok: true, operationId: edit.operationId, sourceId: edit.sourceId, version: ref.version, sha256: ref.sha256, durability: 'draft' };
      }, this.writerOptions);
    } catch (e) { return reject(e.code ?? 'SOURCE_WRITE_FAILED', { operationId: edit?.operationId, sourceId: edit?.sourceId }); }
  }
  async commitRecord(directory, descriptor) {
    if (!commitDescriptor(descriptor) || descriptor === null) throw error('CORRUPT_SOURCE');
    const bytes = await readOwnedBytes(join(await childDirectory(directory, 'commits'), descriptor.file), 65536);
    if (digest(bytes) !== descriptor.sha256) throw error('CORRUPT_SOURCE');
    const record = JSON.parse(bytes);
    if (record.schema !== 1 || record.operationId !== descriptor.operationId || !hashPattern.test(record.sha256) || !commitDescriptor(record.parent) || !['committed', 'recovery-degraded'].includes(record.durability)) throw error('CORRUPT_SOURCE');
    version(record.version); return record;
  }
  async commitDurability(directory, record) {
    if (record.durability === 'committed') return 'committed';
    try {
      const token = JSON.parse(await readOwnedBytes(join(await childDirectory(directory, 'checkpoints'), `${record.operationId}.json`), 65536));
      if (token.operationId === record.operationId && token.sourceId === record.sourceId && token.version === record.version && token.sha256 === record.sha256) return 'committed';
    } catch { /* No verified checkpoint token: source committed, recovery still degraded. */ }
    return 'recovery-degraded';
  }
  async commitSource({ projectId, sourceId, expectedVersion, operationId }) {
    try {
      await this.access('commit', projectId, sourceId); id(operationId); version(expectedVersion);
      return await exclusiveWriter(await this.projectDirectory(projectId), async () => {
        await this.access('commit', projectId, sourceId);
        const loaded = await this.load(projectId, sourceId);
        let commit = loaded.pointer.commitHead; const seen = new Set();
        while (commit) {
          if (seen.has(commit.operationId)) throw error('CORRUPT_SOURCE'); seen.add(commit.operationId);
          const previous = await this.commitRecord(loaded.directory, commit);
          if (previous.sourceId !== sourceId) throw error('CORRUPT_SOURCE');
          if (commit.operationId === operationId) {
            if (previous.version !== expectedVersion) return reject('OPERATION_CONFLICT');
            const committedBytes = await readOwnedBytes(join(await childDirectory(loaded.directory, 'blobs'), `${previous.sha256}.bin`), this.limits.sourceBytes);
            if (digest(committedBytes) !== previous.sha256) throw error('CORRUPT_SOURCE');
            return { ok: true, operationId, sourceId, version: previous.version, sha256: previous.sha256, durability: await this.commitDurability(loaded.directory, previous) };
          }
          commit = previous.parent;
        }
        if (loaded.ref.version !== expectedVersion) return reject('REVISION_CONFLICT', { sourceId, version: loaded.ref.version });
        if (loaded.records.some(item => item.record.edit?.operationId === operationId)) return reject('OPERATION_CONFLICT');
        await this.immutable(projectId, join(await childDirectory(loaded.directory, 'blobs'), `${loaded.ref.sha256}.bin`), loaded.bytes);
        await this.fault('source-blob-verified');
        const record = { schema: 1, operationId, sourceId, version: expectedVersion, sha256: loaded.ref.sha256, parent: loaded.pointer.commitHead, durability: this.checkpoint ? 'recovery-degraded' : 'committed' };
        const commits = await childDirectory(loaded.directory, 'commits');
        const commitName = `c-${randomUUID()}.json`;
        const commitHash = await this.immutable(projectId, join(commits, commitName), jsonBytes(record));
        await this.fault('source-commit-verified');
        await this.access('commit', projectId, sourceId);
        await this.select(projectId, loaded.directory, { ...loaded.pointer, commitHead: { operationId, sha256: commitHash, file: commitName } });
        // Exact readback includes the selected journal as well as the materialized blob.
        const current = await this.load(projectId, sourceId);
        if (current.ref.sha256 !== record.sha256 || current.pointer.commitHead.operationId !== operationId) throw error('SOURCE_READBACK_FAILED');
        if (this.checkpoint) {
          try {
            await this.checkpoint({ projectId, sourceRef: current.ref });
            const points = await childDirectory(loaded.directory, 'checkpoints', { create: true });
            await this.immutable(projectId, join(points, `${operationId}.json`), jsonBytes({ operationId, sourceId, version: expectedVersion, sha256: record.sha256 }));
          } catch { /* Verified source stays selected; checkpoint does not erase the commit. */ }
        }
        const durability = await this.commitDurability(loaded.directory, record);
        return { ok: true, operationId, sourceId, version: expectedVersion, sha256: record.sha256, durability };
      }, this.writerOptions);
    } catch (e) { return reject(e.code ?? 'SOURCE_WRITE_FAILED', { operationId, sourceId }); }
  }
}
