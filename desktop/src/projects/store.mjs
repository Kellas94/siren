import { mkdir, readFile, readdir, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ownedDirectory, childDirectory, ownedFile, validId } from './paths.mjs';
import { atomicWrite, digest, exclusiveWriter } from './atomic.mjs';
import { failure } from '../ipc.mjs';
import { readOwnedBytes } from './io.mjs';
import { MAX_WORKSPACE_BYTES, MAX_SERIALIZED_WORKSPACE_BYTES, serializeWorkspaceRecord } from './budgets.mjs';

export { MAX_WORKSPACE_BYTES } from './budgets.mjs';
export function validateWorkspace(json) {
  if (typeof json !== 'string' || Buffer.byteLength(json) > MAX_WORKSPACE_BYTES) throw new Error('Invalid workspace size');
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid workspace object');
  return json;
}
export function verifySnapshot(record) {
  if (record?.schema !== 1 || !validId(record.project?.id) || typeof record.project.label !== 'string' || record.project.label.length > 200 || typeof record.project.external !== 'boolean' || !Number.isSafeInteger(record.revision) || record.revision < 1 || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Invalid or corrupt snapshot');
  validateWorkspace(record.json);
  if (digest(Buffer.from(record.json)) !== record.sha256) throw new Error('Corrupt workspace hash');
  return record;
}
export class ProjectStore {
  constructor(root, { fault = async () => {}, canSave = () => true, ownerIdentity, inspectProcess } = {}) { this.root = resolve(root); this.fault = fault; this.canSave = canSave; this.writerOptions = { ownerIdentity, inspectProcess }; }
  async projectsRoot() {
    await ownedDirectory(this.root);
    const path = join(this.root, 'Projects');
    try { await mkdir(path); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    return ownedDirectory(path);
  }
  async directory(id) {
    if (!validId(id)) throw new Error('Project id refused');
    return childDirectory(await this.projectsRoot(), id);
  }
  async createProject({ label, json, purpose = 'workspace' }) {
    validateWorkspace(json);
    if (typeof label !== 'string' || label.length > 200) throw new Error('Invalid label');
    if (!await this.canSave({ action: purpose === 'recovery' ? 'restore' : 'create' })) throw new Error('Activation required for new project');
    const id = randomUUID(); const parent = await this.projectsRoot();
    const dir = await childDirectory(parent, id, { create: true });
    await childDirectory(dir, 'revisions', { create: true });
    await childDirectory(dir, 'pending', { create: true });
    const snapshot = { schema: 1, project: { id, label, external: false }, revision: 1, json, sha256: digest(Buffer.from(json)) };
    await exclusiveWriter(dir, () => this.commit(dir, snapshot), this.writerOptions);
    return snapshot;
  }
  async readProject(id) {
    const dir = await this.directory(id);
    let pointer;
    try { pointer = JSON.parse((await readOwnedBytes(join(dir, 'current.json'), 65536)).toString('utf8')); }
    catch { throw new Error('Corrupt project selection; choose explicit recovery'); }
    if (pointer.schema !== 1 || !/^[0-9]+-[a-f0-9-]{36}\.json$/.test(pointer.file) || !/^[a-f0-9]{64}$/.test(pointer.sha256)) throw new Error('Invalid project selection');
    const revisions = await childDirectory(dir, 'revisions');
    const bytes = await readOwnedBytes(join(revisions, pointer.file), MAX_SERIALIZED_WORKSPACE_BYTES);
    if (digest(bytes) !== pointer.sha256) throw new Error('Corrupt selected revision');
    const snapshot = verifySnapshot(JSON.parse(bytes));
    if (snapshot.project.id !== id || snapshot.revision !== pointer.revision) throw new Error('Invalid project identity');
    return snapshot;
  }
  async commit(dir, snapshot) {
    verifySnapshot(snapshot);
    const bytes = serializeWorkspaceRecord(snapshot);
    const file = `${snapshot.revision}-${randomUUID()}.json`;
    const revisions = await childDirectory(dir, 'revisions');
    const sha256 = await atomicWrite(join(revisions, file), bytes, { fault: this.fault });
    await this.fault('revision-verified');
    await atomicWrite(join(dir, 'current.json'), Buffer.from(JSON.stringify({ schema: 1, file, revision: snapshot.revision, sha256 })), { fault: this.fault, selection: true });
    const readback = await this.readProject(snapshot.project.id);
    if (readback.json !== snapshot.json || readback.sha256 !== snapshot.sha256) throw new Error('Project readback mismatch');
  }
  async preservePending(dir, record) {
    const pending = await childDirectory(dir, 'pending');
    const id = randomUUID();
    await atomicWrite(join(pending, `${id}.json`), serializeWorkspaceRecord({ ...record, id, sha256: digest(Buffer.from(record.json)), createdAt: new Date().toISOString() }));
    return id;
  }
  async listPending(id) {
    const dir = await childDirectory(await this.directory(id), 'pending');
    const pending = [];
    for (const name of await readdir(dir)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      try { const r = JSON.parse((await readOwnedBytes(join(dir, name), MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8')); validateWorkspace(r.json); if (name === `${r.id}.json` && Number.isSafeInteger(r.baseRevision) && r.baseRevision >= 1 && Number.isFinite(Date.parse(r.createdAt)) && digest(Buffer.from(r.json)) === r.sha256 && r.projectId === id) pending.push(r); } catch { /* corrupted original remains on disk */ }
    }
    return pending;
  }
  async acknowledgePending(projectId, pendingId) {
    if (!/^[a-f0-9-]{36}$/.test(pendingId)) throw new Error('Pending copy id refused');
    const directory = await childDirectory(await this.directory(projectId), 'pending');
    const path = await ownedFile(join(directory, `${pendingId}.json`));
    const record = JSON.parse((await readOwnedBytes(path, MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8'));
    if (record.projectId !== projectId || digest(Buffer.from(record.json)) !== record.sha256) throw new Error('Pending copy identity refused');
    await unlink(path);
  }
  async saveProject(request) {
    let dir;
    try {
      validateWorkspace(request.json); dir = await this.directory(request.projectId);
      if (!await this.canSave({ action: request.purpose, projectId: request.projectId })) return failure('ACCESS_REFUSED', 'Reauthentication required; recovery/export remain available');
      // Preserve attempted work before writer acquisition/conflict checks. No Docs commit.
      const pendingId = await this.preservePending(dir, request);
      return await exclusiveWriter(dir, async () => {
        if (!await this.canSave({ action: request.purpose, projectId: request.projectId })) return failure('ACCESS_REFUSED', 'Access changed; pending work is retained');
        const current = await this.readProject(request.projectId);
        if (current.revision !== request.baseRevision) return failure('REVISION_CONFLICT', 'A newer revision exists; your pending copy is retained');
        if (request.purpose === 'recovery') return { ok: true, revision: current.revision, sha256: digest(Buffer.from(request.json)), pendingId };
        const snapshot = { ...current, revision: current.revision + 1, json: request.json, sha256: digest(Buffer.from(request.json)) };
        await this.commit(dir, snapshot);
        return { ok: true, revision: snapshot.revision, sha256: snapshot.sha256, pendingId };
      }, this.writerOptions);
    } catch (error) { return failure(error.code === 'WRITER_BUSY' ? 'WRITER_BUSY' : 'SAVE_FAILED', 'Save was not acknowledged; retain/export live work and inspect recovery'); }
  }
  async pruneRevisions({ snapshot, recovery }) {
    verifySnapshot(snapshot);
    const dir = await this.directory(snapshot.project.id);
    await exclusiveWriter(dir, async () => {
      const current = await this.readProject(snapshot.project.id);
      if (current.revision !== snapshot.revision || current.sha256 !== snapshot.sha256) throw new Error('Current revision changed; pruning refused');
      const points = (await recovery.scan(snapshot.project.id)).valid;
      if (!points.some(p => p.kind === 'saved' && p.snapshot.revision === current.revision && p.snapshot.sha256 === current.sha256 && p.snapshot.json === current.json)) throw new Error('Verified current checkpoint required before pruning');
      const revisions = await childDirectory(dir, 'revisions'); const older = [];
      for (const name of await readdir(revisions)) {
        if (!/^[0-9]+-[a-f0-9-]{36}\.json$/.test(name)) continue;
        try {
          const record = verifySnapshot(JSON.parse((await readOwnedBytes(join(revisions, name), MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8')));
          if (record.project.id === current.project.id && record.revision < current.revision) older.push({ name, revision: record.revision });
        } catch { /* damaged originals are retained */ }
      }
      older.sort((a, b) => b.revision - a.revision);
      for (const old of older.slice(9)) await unlink(await ownedFile(join(revisions, old.name)));
    }, this.writerOptions);
  }
  async listProjects() {
    const projects = [];
    for (const id of await readdir(await this.projectsRoot())) {
      if (!validId(id)) continue;
      try { const s = await this.readProject(id); projects.push(s.project); } catch { projects.push({ id, label: 'Recovery required', external: false, damaged: true }); }
    }
    return projects;
  }
}
