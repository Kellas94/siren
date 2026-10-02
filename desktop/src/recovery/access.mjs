import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest } from '../projects/atomic.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { childDirectory } from '../projects/paths.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
// Session grants, file names and damage handles are native-owned; IPC only accepts opaque ids.
export class RecoveryAccess {
  constructor({ projects, recovery, grants }) { this.projects = projects; this.recovery = recovery; this.grants = grants; this.damaged = new Map(); }
  async inspect(projectId) {
    if (!this.grants.has(projectId)) throw new Error('Project refused');
    const state = await this.recovery.inspectRecovery({ projectId });
    const pending = await this.projects.listPending(projectId);
    const emergencies = pending.map(p => ({ id: p.id, projectId, createdAt: p.createdAt, revision: p.baseRevision, schema: 1, sha256: p.sha256, kind: 'emergency', verified: true }));
    for (const [id, record] of this.damaged) if (record.projectId === projectId) this.damaged.delete(id);
    let damage = null;
    try { await this.projects.readProject(projectId); }
    catch {
      const directory = await this.projects.directory(projectId);
      let path = join(directory, 'current.json');
      try {
        const pointer = JSON.parse((await readOwnedBytes(path, 65536)).toString('utf8'));
        if (pointer.schema === 1 && /^[0-9]+-[a-f0-9-]{36}\.json$/.test(pointer.file)) path = join(await childDirectory(directory, 'revisions'), pointer.file);
      } catch { /* retain the owned damaged selection, never follow an unvalidated file name */ }
      try {
        const bytes = await readOwnedBytes(path, 128 * 1024 * 1024 + 65536);
        const id = randomUUID(); this.damaged.set(id, { projectId, path, sha256: digest(bytes) });
        damage = { id, projectId };
      } catch { /* unavailable or unowned file is not exportable */ }
    }
    const points = [...emergencies, ...state.points].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { ...state, mode: damage || emergencies.length ? 'recovery' : state.mode, points, damagedPoints: [...state.damagedPoints, ...(damage ? [damage] : [])], lastRecoverableAt: points[0]?.createdAt || null };
  }
  async point(id) {
    if (!uuid(id)) throw new Error('Recovery id refused');
    for (const projectId of this.grants) {
      const record = (await this.recovery.scan(projectId)).valid.find(p => p.id === id);
      if (record) return record;
      const pending = (await this.projects.listPending(projectId)).find(p => p.id === id);
      if (pending) {
        let label = 'Pending work';
        try { label = (await this.projects.readProject(projectId)).project.label; } catch { /* recovery works with a damaged current project */ }
        return { id, kind: 'emergency', createdAt: pending.createdAt, snapshot: { schema: 1, project: { id: projectId, label, external: false }, revision: pending.baseRevision, json: pending.json, sha256: pending.sha256 } };
      }
    }
    throw new Error('Owned recovery point unavailable');
  }
  async restore(id) {
    const { snapshot } = await this.point(id);
    const restored = await this.projects.createProject({ label: `${snapshot.project.label.slice(0, 175)} — recovered`, json: snapshot.json, purpose: 'recovery' });
    const readback = await this.projects.readProject(restored.project.id);
    if (readback.json !== snapshot.json || readback.sha256 !== snapshot.sha256) throw new Error('Recovered copy verification failed');
    await this.recovery.checkpointProject({ snapshot: readback, kind: 'saved' });
    return readback;
  }
  async export(id) {
    if (!uuid(id)) throw new Error('Recovery id refused');
    const damaged = this.damaged.get(id);
    if (damaged) {
      if (!this.grants.has(damaged.projectId)) throw new Error('Project refused');
      const bytes = await readOwnedBytes(damaged.path, 128 * 1024 * 1024 + 65536);
      if (digest(bytes) !== damaged.sha256) throw new Error('Damaged original changed; inspect recovery again');
      return bytes;
    }
    try { return Buffer.from((await this.point(id)).snapshot.json); }
    catch {
      for (const projectId of this.grants) {
        try { return await this.recovery.readDamagedPoint(id, projectId); } catch { /* only native-owned granted projects */ }
      }
      throw new Error('Owned recovery point unavailable');
    }
  }
}
