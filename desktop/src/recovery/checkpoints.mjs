import { mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ownedDirectory, ownedFile, childDirectory, validId } from '../projects/paths.mjs';
import { atomicWrite, exclusiveWriter } from '../projects/atomic.mjs';
import { verifySnapshot } from '../projects/store.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { MAX_SERIALIZED_WORKSPACE_BYTES, serializeWorkspaceRecord } from '../projects/budgets.mjs';
import { verifySourceSnapshot, exportSourceSnapshot, restoreSourceSnapshot } from '../sources/recovery.mjs';
import {isDeepStrictEqual} from 'node:util';
import {ProjectStore} from '../projects/store.mjs';
import {DiagramEmbedAssetStore} from '../documents/diagram-embed-assets.mjs';
import {diagramBundleRefs,verifyDiagramSnapshot,exportEmbedBundle} from '../documents/diagram-embed-bundle.mjs';

const uuid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
function verifyPoint(record) {
  if (record?.schema !== 1 || !uuid(record.id) || !['saved', 'draft', 'emergency'].includes(record.kind) || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid recovery point');
  verifySnapshot(record.snapshot);
  return record;
}
const publicPoint = record => ({ id: record.id, projectId: record.snapshot.project.id, createdAt: record.createdAt, revision: record.snapshot.revision, schema: record.snapshot.schema, sha256: record.snapshot.sha256, kind: record.kind, verified: true });

export class RecoveryStore {
  constructor(root, { now = () => Date.now(), fault = async () => {}, ownerIdentity, inspectProcess, sources, assets, isCurrent = () => true } = {}) { this.root = resolve(root); this.now = now; this.fault = fault; this.sources = sources; this.assets=assets??new DiagramEmbedAssetStore({projects:new ProjectStore(root)});this.isCurrent=isCurrent; this.writerOptions = { ownerIdentity, inspectProcess }; }
  async verifySources(snapshot){await verifySourceSnapshot({snapshot,repository:this.sources});await verifyDiagramSnapshot({snapshot,assets:this.assets,isCurrent:this.isCurrent});}
  async directory() {
    await ownedDirectory(this.root);
    const path = join(this.root, 'Recovery');
    try { await mkdir(path); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    return ownedDirectory(path);
  }
  async scan(projectId = null) {
    const root = await this.directory(); const valid = []; const invalid = []; let damaged = false;
    for (const id of await readdir(root)) {
      if (!validId(id) || id === 'catalog.json' || id === 'sessions.json') continue;
      if (projectId && id !== projectId) continue;
      let dir;
      try { dir = await childDirectory(root, id); } catch { continue; }
      for (const name of await readdir(dir)) {
        if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
        try {
          const record = verifyPoint(JSON.parse((await readOwnedBytes(join(dir, name), MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8')));
          if (record.snapshot.schema === 2) await this.verifySources(record.snapshot);
          if (record.snapshot.project.id !== id || name !== `${record.id}.json`) throw new Error('Invalid checkpoint identity');
          valid.push(record);
        } catch { damaged = true; invalid.push({ id: name.slice(0, -5), projectId: id }); }
      }
    }
    valid.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.snapshot.revision - a.snapshot.revision);
    return { valid, damaged, invalid };
  }
  async checkpointProject({ snapshot, kind }) {
    verifySnapshot(snapshot);
    if (snapshot.schema === 2) await this.verifySources(snapshot);
    if (!['saved', 'draft', 'emergency'].includes(kind)) throw new Error('Invalid checkpoint kind');
    const root = await this.directory();
    return exclusiveWriter(root, async () => {
      const dir = await childDirectory(root, snapshot.project.id, { create: true });
      const record = { schema: 1, id: randomUUID(), kind, createdAt: new Date(this.now()).toISOString(), snapshot };
      await atomicWrite(join(dir, `${record.id}.json`), serializeWorkspaceRecord(record), { fault: this.fault });
      const verified = verifyPoint(JSON.parse((await readOwnedBytes(join(dir, `${record.id}.json`), MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8')));
      if (verified.snapshot.json !== snapshot.json) throw new Error('Checkpoint readback mismatch');
      if (snapshot.schema === 2) await this.verifySources(verified.snapshot);
      await this.fault('checkpoint-verified');
      const { valid,damaged,invalid } = await this.scan(snapshot.project.id);
      // New point is verified before pruning. Corrupt and emergency originals are untouched.
      const saved = valid.filter(p => p.kind === 'saved');
      const drafts = valid.filter(p => p.kind === 'draft');
      const remove = [...saved.slice(10), ...drafts.filter(p => kind === 'draft' ? p.id !== record.id : p.id !== drafts[0]?.id)];
      if(!damaged&&!invalid.length)for (const old of remove) await unlink(await ownedFile(join(dir, `${old.id}.json`)));
      const points = (await this.scan()).valid.map(publicPoint);
      const catalogPath = join(root, 'catalog.json');
      try {
        const raw = await readOwnedBytes(catalogPath, 16 * 1024 * 1024);
        const old = JSON.parse(raw);
        if (old.schema !== 1 || !Array.isArray(old.points)) throw new Error('Invalid catalog');
      } catch (error) {
        if (error.code !== 'ENOENT') {
          // Retain damaged catalog bytes before replacing its derived index.
          const raw = await readOwnedBytes(catalogPath, 16 * 1024 * 1024);
          await atomicWrite(join(root, `catalog-damaged-${randomUUID()}.json`), raw);
        }
      }
      await atomicWrite(catalogPath, Buffer.from(JSON.stringify({ schema: 1, points })), { fault: this.fault });
      await this.fault('catalog-committed');
      return publicPoint(record);
    }, this.writerOptions);
  }
  async inspectRecovery({ projectId }) {
    if (!validId(projectId)) throw new Error('Recovery project id refused');
    const { valid, damaged, invalid } = await this.scan(projectId);
    let catalogDamaged = false;
    try {
      const index = JSON.parse((await readOwnedBytes(join(await this.directory(), 'catalog.json'), 16 * 1024 * 1024)).toString('utf8'));
      if (index.schema !== 1 || !Array.isArray(index.points) || index.points.some(p => p.projectId === projectId && !valid.some(v => v.id === p.id))) catalogDamaged = true;
    } catch { catalogDamaged = true; }
    const points = valid.map(publicPoint);
    return { mode: damaged || catalogDamaged ? 'recovery' : 'normal', reason: damaged || catalogDamaged ? 'Some recovery data is damaged; only verified points are offered' : null, points, damagedPoints: invalid, lastRecoverableAt: points[0]?.createdAt || null };
  }
  async readDamagedPoint(pointId, projectId) {
    if (!uuid(pointId) || !validId(projectId)) throw new Error('Damaged recovery id refused');
    const { invalid } = await this.scan(projectId);
    if (!invalid.some(p => p.id === pointId)) throw new Error('Damaged point unavailable');
    const dir = await childDirectory(await this.directory(), projectId);
    return readOwnedBytes(join(dir, `${pointId}.json`), MAX_SERIALIZED_WORKSPACE_BYTES);
  }
  async readPoint(pointId) {
    if (!uuid(pointId)) throw new Error('Invalid recovery point');
    const record = (await this.scan()).valid.find(p => p.id === pointId);
    if (!record) throw new Error('Recovery point unavailable or invalid');
    return record;
  }
  async readProjectPoint(projectId,pointId) {
    if(!validId(projectId)||!uuid(pointId))throw new Error('Invalid scoped recovery point');
    const directory=await childDirectory(await this.directory(),projectId);
    const record=verifyPoint(JSON.parse((await readOwnedBytes(join(directory,`${pointId}.json`),MAX_SERIALIZED_WORKSPACE_BYTES)).toString('utf8')));
    if(record.id!==pointId||record.snapshot.project.id!==projectId)throw new Error('Recovery point identity refused');
    if(record.snapshot.schema===2)await this.verifySources(record.snapshot);
    return record;
  }
  // A durability receipt needs one exact saved checkpoint. Historical source
  // replay belongs to recovery inspection/pruning, not each window's flush.
  // Catalog labels and preliminary metadata never authorize the receipt: the
  // candidate is reopened and its actual source bytes are verified once here.
  async findSavedSnapshot(snapshot) {
    try {
      verifySnapshot(snapshot);
      const directory=await childDirectory(await this.directory(),snapshot.project.id);
      for(const name of await readdir(directory)) {
        if(!/^[a-f0-9-]{36}\.json$/.test(name))continue;
        try {
          const candidate=verifyPoint(JSON.parse(await readOwnedBytes(join(directory,name),MAX_SERIALIZED_WORKSPACE_BYTES)));
          if(name!==candidate.id+'.json'||candidate.kind!=='saved'||!isDeepStrictEqual(candidate.snapshot,snapshot))continue;
          const actual=await this.readProjectPoint(snapshot.project.id,candidate.id);
          if(actual.kind==='saved'&&isDeepStrictEqual(actual.snapshot,snapshot))return publicPoint(actual);
        } catch {/* Damaged originals remain untouched and cannot prove durability. */}
      }
    } catch {/* Missing or invalid saved bytes cannot establish recovery. */}
    return null;
  }
  async hasSavedSnapshot(snapshot) {return (await this.findSavedSnapshot(snapshot))!==null;}
  async restoreRecovery({ pointId, destination, projects }) {
    if (destination !== 'new-project') throw new Error('Recovery must create a new project');
    const record = await this.readPoint(pointId);
    if (record.snapshot.schema === 2) return this.restoreSourceSnapshot(record.snapshot, projects);
    const restored = await projects.createProject({ label: `${record.snapshot.project.label.slice(0, 175)} — recovered`, json: record.snapshot.json, purpose: 'recovery' });
    const readback = await projects.readProject(restored.project.id);
    if (readback.sha256 !== record.snapshot.sha256 || readback.json !== record.snapshot.json) throw new Error('Recovered copy verification failed');
    return readback;
  }
  async exportSourceSnapshot(snapshot,{isCurrent=this.isCurrent}={}) { return diagramBundleRefs(snapshot).length?exportEmbedBundle({snapshot,sources:this.sources,assets:this.assets,isCurrent}):exportSourceSnapshot({ snapshot, repository: this.sources }); }
  async restoreSourceSnapshot(snapshot, projects) { return restoreSourceSnapshot({ snapshot, repository: this.sources, projects, recovery: this,assets:this.assets,isCurrent:this.isCurrent }); }
}
