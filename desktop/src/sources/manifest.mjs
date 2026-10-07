import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validId, childDirectory } from '../projects/paths.mjs';
import { digest, exclusiveWriter } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { MAX_WORKSPACE_BYTES, MAX_SERIALIZED_WORKSPACE_BYTES } from '../projects/budgets.mjs';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const error = code => Object.assign(new Error(code), { code });
const keys = (value, allowed, required = allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
export const sourceReferenceKey = ref => `${ref.sourceId}:${ref.version}:${ref.sha256}`;

function canonical(value, depth = 0) {
  if (depth > 64) throw error('INVALID_MANIFEST');
  if (Array.isArray(value)) return value.map(item => canonical(item, depth + 1));
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key], depth + 1)]));
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  throw error('INVALID_MANIFEST');
}
const canonicalJson = value => JSON.stringify(canonical(value));
export const manifestSnapshotHash = snapshot => digest(Buffer.from(canonicalJson(snapshot)));
function orderedRefs(sourceRefs) {
  if (!Array.isArray(sourceRefs) || sourceRefs.length > 65536) throw error('INVALID_SOURCE_REFS');
  return sourceRefs.map(ref => JSON.parse(canonicalJson(ref))).sort((a, b) => sourceReferenceKey(a).localeCompare(sourceReferenceKey(b), 'en'));
}

export function manifestRequestHash({ projectId, baseRevision, sourceRefs, json, operationId }) {
  return digest(Buffer.from(canonicalJson({ projectId, baseRevision, sourceRefs: orderedRefs(sourceRefs), json, operationId })));
}

function verifyRef(ref) {
  if (!keys(ref, ['sourceId','version','sha256','utf8Bytes','utf16Units','lines','longestLineUnits','encoding','bom','newline','provenance']) ||
      !validId(ref.sourceId) || !Number.isSafeInteger(ref.version) || ref.version < 1 || !hash(ref.sha256) ||
      !Number.isSafeInteger(ref.utf8Bytes) || ref.utf8Bytes < 0 || ref.utf8Bytes > 32 * 1024 * 1024 ||
      !['utf8','unsupported'].includes(ref.encoding) || typeof ref.bom !== 'boolean' || !['none','crlf','lf','cr','mixed'].includes(ref.newline) ||
      !record(ref.provenance) || Buffer.byteLength(canonicalJson(ref.provenance)) > 65536) throw error('INVALID_SOURCE_REFS');
  if (ref.encoding === 'unsupported') {
    if (ref.utf16Units !== null || ref.lines !== null || ref.longestLineUnits !== null || ref.newline !== 'none') throw error('INVALID_SOURCE_REFS');
  } else if (!Number.isSafeInteger(ref.utf16Units) || ref.utf16Units < 0 || ref.utf16Units > ref.utf8Bytes ||
      !Number.isSafeInteger(ref.lines) || ref.lines < 1 || ref.lines > ref.utf16Units + 1 ||
      !Number.isSafeInteger(ref.longestLineUnits) || ref.longestLineUnits < 0 || ref.longestLineUnits > ref.utf16Units) throw error('INVALID_SOURCE_REFS');
}

function verifyMetadata(metadata, sourceRefs) {
  if (!record(metadata)) throw error('INVALID_MANIFEST_METADATA');
  const references = new Set(sourceRefs.map(sourceReferenceKey));
  let visited = 0;
  const pointer = value => {
    if (!keys(value, ['sourceId','version','sha256']) || !validId(value.sourceId) || !Number.isSafeInteger(value.version) || value.version < 1 || !hash(value.sha256) || !references.has(sourceReferenceKey(value))) throw error('UNKNOWN_SOURCE_REFERENCE');
  };
  function visit(value, depth = 0) {
    if (++visited > 1000000 || depth > 64) throw error('INVALID_MANIFEST_METADATA');
    if (Array.isArray(value)) { for (const child of value) visit(child, depth + 1); return; }
    if (!record(value)) return;
    if (Object.hasOwn(value, 'sourceRef')) {
      pointer(value.sourceRef);
      if (typeof value.content === 'string' || typeof value.text === 'string') throw error('INLINE_SOURCE_REFUSED');
    }
    if (Object.hasOwn(value, 'baseSourceRef')) {
      pointer(value.baseSourceRef);
      if (typeof value.base === 'string') throw error('INLINE_SOURCE_REFUSED');
    }
    if (value.kind === 'knowledge' && Array.isArray(value.rows) && value.rows.some(row => typeof row?.content === 'string')) throw error('INLINE_SOURCE_REFUSED');
    if (Array.isArray(value.codeFiles) && value.codeFiles.some(file => typeof file?.content === 'string')) throw error('INLINE_SOURCE_REFUSED');
    if (record(value.codeWorkspace) && Array.isArray(value.codeWorkspace.drafts) && value.codeWorkspace.drafts.some(draft => typeof draft?.text === 'string' || typeof draft?.base === 'string')) throw error('INLINE_SOURCE_REFUSED');
    for (const [key, child] of Object.entries(value)) {
      if (key === 'storage' && record(child)) {
        for (const stored of Object.values(child)) {
          if (typeof stored === 'string') {
            let parsed;
            try { parsed = JSON.parse(stored); } catch { continue; }
            visit(parsed, depth + 1);
          } else visit(stored, depth + 1);
        }
      } else visit(child, depth + 1);
    }
  }
  visit(metadata);
}

/** Schema 2 is intentionally standalone: the project store imports this verifier. */
export function verifySourceManifest(snapshot) {
  const allowed = ['schema','project','revision','json','sha256','sourceRefs','operationId','requestHash','parentRequestHash','parentManifestHash','checkpointRequired'];
  if (!keys(snapshot, allowed, allowed.filter(key => key !== 'checkpointRequired')) || snapshot.schema !== 2 ||
      !keys(snapshot.project, ['id','label','external']) || !validId(snapshot.project.id) || typeof snapshot.project.label !== 'string' || snapshot.project.label.length > 200 || typeof snapshot.project.external !== 'boolean' ||
      !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 2 || !validId(snapshot.operationId) || !hash(snapshot.sha256) || !hash(snapshot.requestHash) ||
      !(snapshot.parentRequestHash === null || hash(snapshot.parentRequestHash)) ||
      !(snapshot.parentManifestHash === null || hash(snapshot.parentManifestHash)) ||
      (snapshot.parentRequestHash === null) !== (snapshot.parentManifestHash === null) ||
      snapshot.checkpointRequired !== undefined && typeof snapshot.checkpointRequired !== 'boolean' ||
      typeof snapshot.json !== 'string' || Buffer.byteLength(snapshot.json) > MAX_WORKSPACE_BYTES) throw error('INVALID_MANIFEST');
  const refs = orderedRefs(snapshot.sourceRefs);
  const seen = new Set();
  for (const ref of refs) { verifyRef(ref); const key = sourceReferenceKey(ref); if (seen.has(key)) throw error('INVALID_SOURCE_REFS'); seen.add(key); }
  if (digest(Buffer.from(snapshot.json)) !== snapshot.sha256 || manifestRequestHash({ projectId: snapshot.project.id, baseRevision: snapshot.revision - 1, sourceRefs: refs, json: snapshot.json, operationId: snapshot.operationId }) !== snapshot.requestHash) throw error('MANIFEST_HASH_MISMATCH');
  verifyMetadata(JSON.parse(snapshot.json), refs);
  return snapshot;
}

async function verifiedSources(repository, projectId, sourceRefs, materialize) {
  for (const ref of sourceRefs) {
    const request={ projectId, sourceId: ref.sourceId, version: ref.version };
    const verified=typeof repository.readVerifiedVersion==='function'?await repository.readVerifiedVersion(request):null;
    const actual = verified?verified.ref:await repository.getMetrics(request);
    if (canonicalJson(actual) !== canonicalJson(ref)) throw error('SOURCE_REFERENCE_MISMATCH');
    const bytes = verified?verified.bytes:await repository.exportSource(request);
    if (bytes.length !== ref.utf8Bytes || digest(bytes) !== ref.sha256) throw error('SOURCE_REFERENCE_MISMATCH');
    if (materialize) {
      const blobs = await childDirectory(await repository.sourceDirectory(projectId, ref.sourceId), 'blobs');
      await repository.immutable(projectId, join(blobs, `${ref.sha256}.bin`), bytes);
      const readback = await readOwnedBytes(join(blobs, `${ref.sha256}.bin`), bytes.length);
      if (!readback.equals(bytes)) throw error('SOURCE_READBACK_FAILED');
    }
  }
}

async function ancestry(projects, directory, current, maxRecords) {
  const selected = [current];
  if (current.schema !== 2 || !current.parentRequestHash) return selected;
  const revisions = await childDirectory(directory, 'revisions');
  const records = [];
  const names=await readdir(revisions);
  if(maxRecords!==undefined){let count=0;for(const name of names)if(/^[0-9]+-[a-f0-9-]{36}\.json$/.test(name)&&++count>maxRecords)throw error('MANIFEST_HISTORY_BUDGET');}
  for (const name of names) {
    if (!/^[0-9]+-[a-f0-9-]{36}\.json$/.test(name)) continue;
    // A damaged retained file cannot prove an ancestor. Never ACK an orphan.
    try {
      const value = JSON.parse(await readOwnedBytes(join(revisions, name), MAX_SERIALIZED_WORKSPACE_BYTES));
      if (value.schema === 2 && value.project?.id === current.project.id) records.push(verifySourceManifest(value));
    } catch { /* Missing identity proof later produces a revision conflict. */ }
  }
  let child = current;
  const seen = new Set([current.requestHash]);
  while (child.parentRequestHash) {
    const candidates = records.filter(value => value.requestHash === child.parentRequestHash && value.revision === child.revision - 1 && manifestSnapshotHash(value) === child.parentManifestHash);
    // A failed selection followed by an exact retry can retain two identical
    // revision files. The complete parent body hash proves their common manifest,
    // including native checkpoint policy absent from the logical request hash.
    const matches = [...new Map(candidates.map(value => [canonicalJson(value), value])).values()];
    if (matches.length !== 1 || seen.has(child.parentRequestHash)) break;
    child = matches[0]; selected.push(child); seen.add(child.requestHash);
  }
  return selected;
}

// Native selected ancestry only; orphan revisions never prove an operation.
export async function selectedManifestHistory(projects, projectId, options) {
  let maxRecords;
  if(options!==undefined){
    if(!record(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw error('MANIFEST_HISTORY_BUDGET');
    const fields=Object.getOwnPropertyDescriptors(options);
    if(Reflect.ownKeys(fields).length!==1||!Object.hasOwn(fields,'maxRecords')||!Object.hasOwn(fields.maxRecords,'value')||!Number.isSafeInteger(fields.maxRecords.value)||fields.maxRecords.value<1||fields.maxRecords.value>32768)throw error('MANIFEST_HISTORY_BUDGET');
    maxRecords=fields.maxRecords.value;
  }
  const current = await projects.readProject(projectId);
  return ancestry(projects, await projects.directory(projectId), current, maxRecords);
}

async function durability(snapshot, recovery) {
  if (!snapshot.checkpointRequired) return 'committed';
  if (recovery) {
    try {
      if(typeof recovery.hasSavedSnapshot==='function')return await recovery.hasSavedSnapshot(snapshot)?'committed':'recovery-degraded';
      const points = (await recovery.scan(snapshot.project.id)).valid;
      if (points.some(point => point.kind === 'saved' && canonicalJson(point.snapshot) === canonicalJson(snapshot))) return 'committed';
    } catch { /* Selected bytes remain committed, without recovery proof. */ }
  }
  return 'recovery-degraded';
}
const receipt = (snapshot, durability) => ({ ok: true, operationId: snapshot.operationId, projectId: snapshot.project.id, revision: snapshot.revision, sha256: snapshot.sha256, sourceRefs: snapshot.sourceRefs, durability });

export async function commitManifest({ projects, repository, recovery, projectId, baseRevision, sourceRefs, metadata, operationId, purpose = 'workspace', fault = async () => {} }) {
  try {
    if (!validId(projectId) || !validId(operationId) || !Number.isSafeInteger(baseRevision) || baseRevision < 1 || !['workspace','restore'].includes(purpose)) throw error('INVALID_MANIFEST_REQUEST');
    const refs = orderedRefs(sourceRefs);
    const json = JSON.stringify(metadata);
    const requestHash = manifestRequestHash({ projectId, baseRevision, sourceRefs: refs, json, operationId });
    const directory = await projects.directory(projectId);
    return await exclusiveWriter(directory, async () => {
      const canSelect = async () => {
        if (!await projects.canSave({ action: purpose, projectId })) throw error('ACCESS_REFUSED');
        await repository.access('commit', projectId);
        return true;
      };
      await canSelect();
      const current = await projects.readProject(projectId);
      const selected = await ancestry(projects, directory, current);
      const prior = selected.find(value => value.schema === 2 && value.operationId === operationId);
      if (prior) {
        if (prior.requestHash !== requestHash) throw error('OPERATION_CONFLICT');
        await verifiedSources(repository, projectId, prior.sourceRefs, false);
        return receipt(prior, await durability(prior, recovery));
      }
      if (current.revision !== baseRevision) return { ok: false, code: 'REVISION_CONFLICT', operationId, projectId, revision: current.revision };
      const snapshot = { schema: 2, project: current.project, revision: baseRevision + 1, json, sha256: digest(Buffer.from(json)), sourceRefs: refs, operationId, requestHash,
        parentRequestHash: current.schema === 2 ? current.requestHash : null,
        parentManifestHash: current.schema === 2 ? manifestSnapshotHash(current) : null,
        checkpointRequired: Boolean(recovery) };
      verifySourceManifest(snapshot);
      await verifiedSources(repository, projectId, refs, true);
      await fault('manifest-sources-verified');
      await canSelect();
      try { await projects.commit(directory, snapshot, { canSelect }); }
      catch (failure) {
        let actual;
        try { actual = await projects.readProject(projectId); } catch { throw failure; }
        if (canonicalJson(actual) !== canonicalJson(snapshot)) throw failure;
      }
      const actual = await projects.readProject(projectId);
      if (canonicalJson(actual) !== canonicalJson(snapshot)) throw error('MANIFEST_READBACK_FAILED');
      if (recovery) {
        try { await recovery.checkpointProject({ snapshot: actual, kind: 'saved' }); }
        catch { /* Exact selected version remains the acknowledged committed state. */ }
      }
      return receipt(actual, await durability(actual, recovery));
    }, projects.writerOptions);
  } catch (failure) { return { ok: false, code: failure.code ?? 'MANIFEST_WRITE_FAILED', operationId, projectId }; }
}
