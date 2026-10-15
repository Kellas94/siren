import { readdir, rmdir, unlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { digest, exclusiveWriter } from '../projects/atomic.mjs';
import { ownedDirectory, ownedFile, childDirectory, validId } from '../projects/paths.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { MAX_SERIALIZED_WORKSPACE_BYTES } from '../projects/budgets.mjs';
import { isDeepStrictEqual } from 'node:util';

const refused = code => Object.assign(new Error(code), { code });
export async function verifySourceSnapshot({ snapshot, repository }) {
  if (snapshot.schema !== 2 || !repository || !Array.isArray(snapshot.sourceRefs)) throw refused('SOURCE_RECOVERY_UNAVAILABLE');
  const verified = [];
  for (const ref of snapshot.sourceRefs) {
    const request = { projectId: snapshot.project.id, sourceId: ref.sourceId, version: ref.version };
    const version=typeof repository.readVerifiedVersion==='function'?await repository.readVerifiedVersion(request):null;
    const actual = version?version.ref:await repository.getMetrics(request);
    if (!isDeepStrictEqual(actual, ref)) throw refused('SOURCE_REF_MISMATCH');
    const bytes = version?version.bytes:await repository.exportSource(request);
    if (digest(bytes) !== ref.sha256 || bytes.length !== ref.utf8Bytes) throw refused('SOURCE_REF_MISMATCH');
    verified.push({ ref, bytes });
  }
  return verified;
}

export async function exportSourceSnapshot({ snapshot, repository }) {
  if ((JSON.parse(snapshot.json).diagramEmbedAssets?.refs?.length ?? 0)>0) throw refused('BUNDLE_DIAGRAM_ASSETS_REQUIRED');
  const sources = await verifySourceSnapshot({ snapshot, repository });
  return Buffer.from(JSON.stringify({ format: 'siren-source-bundle', schema: 2, snapshot,
    sources: sources.map(({ ref, bytes }) => ({ ref, base64: bytes.toString('base64') })) }));
}

export async function restoreSourceSnapshot({ snapshot, repository, projects, recovery, assets, isCurrent=()=>true }) {
  // Verify every original before creating a destination. The original project is
  // read only; imports/manifest writes always target the new owned project.
  const verified = await verifySourceSnapshot({ snapshot, repository });
  const {verifyDiagramSnapshot}=await import('../documents/diagram-embed-bundle.mjs');
  const visuals=await verifyDiagramSnapshot({snapshot,assets,isCurrent});
  const initial = await projects.createProject({ label: `${snapshot.project.label.slice(0, 175)} — recovered`, json: '{}', purpose: 'recovery' });
  const mapping = new Map(); const sourceRefs = [];
  for(const record of visuals){const copied=await assets.put({projectId:initial.project.id,kind:record.ref.kind,bytes:record.bytes,isCurrent});if(!isDeepStrictEqual(copied,record.ref))throw refused('DIAGRAM_EMBED_ASSET_CORRUPT');}
  for (const { ref, bytes } of verified) {
    const copied = await repository.importSource({ projectId: initial.project.id, bytes, provenance: ref.provenance });
    if (copied.sha256 !== ref.sha256 || copied.utf8Bytes !== ref.utf8Bytes) throw refused('SOURCE_COPY_MISMATCH');
    mapping.set(`${ref.sourceId}:${ref.version}:${ref.sha256}`, copied); sourceRefs.push(copied);
  }
  const { remapSourceReferences } = await import('./migration.mjs');
  const { commitManifest } = await import('./manifest.mjs');
  const metadata = remapSourceReferences(JSON.parse(snapshot.json), mapping);
  const receipt = await commitManifest({ projects, repository, recovery, projectId: initial.project.id, baseRevision: initial.revision,
    sourceRefs, metadata, operationId: `restore-${initial.project.id}`, purpose: 'restore' });
  if (!receipt.ok || receipt.durability === 'recovery-degraded') throw refused(receipt.code ?? 'SOURCE_RECOVERY_DEGRADED');
  const restored = await projects.readProject(initial.project.id);
  await verifySourceSnapshot({ snapshot: restored, repository });
  await verifyDiagramSnapshot({snapshot:restored,assets,isCurrent});
  return restored;
}

/** All retained authorities must be readable before any unreferenced deletion. */
export async function scanSourceRecovery({ projectId, projects, repository, recovery }) {
  const snapshots = [await projects.readProject(projectId)];
  const directory = await projects.directory(projectId);
  const { verifySnapshot } = await import('../projects/store.mjs');
  const revisions = await childDirectory(directory, 'revisions');
  for (const name of await readdir(revisions)) {
    if (!/^[0-9]+-[a-f0-9-]{36}\.json$/.test(name)) throw refused('SOURCE_SCAN_INCOMPLETE');
    const snapshot = verifySnapshot(JSON.parse(await readOwnedBytes(join(revisions, name), MAX_SERIALIZED_WORKSPACE_BYTES)));
    if (snapshot.project.id !== projectId) throw refused('SOURCE_SCAN_INCOMPLETE'); snapshots.push(snapshot);
  }
  // Do not rely on listPending's UI filtering: a damaged pending file makes
  // reference coverage unknown, and therefore cannot authorize collection.
  const pending = await childDirectory(directory, 'pending');
  for (const name of await readdir(pending)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(name)) throw refused('SOURCE_SCAN_INCOMPLETE');
    const record = JSON.parse(await readOwnedBytes(join(pending, name), MAX_SERIALIZED_WORKSPACE_BYTES));
    if (record.projectId !== projectId || record.id !== name.slice(0, -5) || typeof record.json !== 'string' || digest(Buffer.from(record.json)) !== record.sha256 || /sourceRef/.test(record.json)) throw refused('SOURCE_SCAN_INCOMPLETE');
  }
  const recoveryRoot = await recovery.directory();
  try {
    const checkpointDirectory = await childDirectory(recoveryRoot, projectId);
    if ((await readdir(checkpointDirectory)).some(name => !/^[a-f0-9-]{36}\.json$/.test(name))) throw refused('SOURCE_SCAN_INCOMPLETE');
  } catch (e) { if (e.code !== 'ENOENT') throw refused('SOURCE_SCAN_INCOMPLETE'); }
  const state = await recovery.scan(projectId);
  if (state.damaged || state.invalid.length) throw refused('SOURCE_SCAN_INCOMPLETE');
  snapshots.push(...state.valid.map(point => point.snapshot));
  for (const snapshot of snapshots.filter(snapshot => snapshot.schema === 2)) {await verifySourceSnapshot({ snapshot, repository });const {verifyDiagramSnapshot}=await import('../documents/diagram-embed-bundle.mjs');await verifyDiagramSnapshot({snapshot,assets:recovery.assets,isCurrent:()=>true});}
  const retained = new Set(snapshots.flatMap(snapshot => snapshot.sourceRefs ?? []).map(ref => ref.sourceId));
  const sources = await repository.sourcesDirectory(projectId);
  for (const sourceId of await readdir(sources)) {
    if (!validId(sourceId)) throw refused('SOURCE_SCAN_INCOMPLETE');
    const source = await childDirectory(sources, sourceId);
    let selected = true;
    try { await ownedFile(join(source, 'current.json')); }
    catch (e) { if (e.code !== 'ENOENT') throw refused('SOURCE_SCAN_INCOMPLETE'); selected = false; }
    if (selected) {
      // ENOENT deeper inside a selected source is damage, never proof of an
      // unselected import. In particular keep private drafts with missing bytes.
      try { await repository.getMetrics({ projectId, sourceId }); retained.add(sourceId); }
      catch { throw refused('SOURCE_SCAN_INCOMPLETE'); }
    } else {
      const entries = await readdir(source);
      if (entries.some(name => !['blobs', 'versions', 'commits'].includes(name))) throw refused('SOURCE_SCAN_INCOMPLETE');
      for (const name of ['versions', 'commits']) if ((await readdir(await childDirectory(source, name))).length) throw refused('SOURCE_SCAN_INCOMPLETE');
      const blobs = await childDirectory(source, 'blobs');
      for (const name of await readdir(blobs)) {
        if (!/^[a-f0-9]{64}\.bin$/.test(name)) throw refused('SOURCE_SCAN_INCOMPLETE');
        const bytes = await readOwnedBytes(join(blobs, name), repository.limits.sourceBytes);
        if (digest(bytes) !== name.slice(0, -4)) throw refused('SOURCE_SCAN_INCOMPLETE');
      }
    }
  }
  return { projectId, complete: true, retainedSourceIds: [...retained] };
}

async function removeOwnedTree(directory, assertAccess) {
  await ownedDirectory(directory);
  for (const name of await readdir(directory)) {
    const path = join(directory, name); const info = await lstat(path);
    if (info.isSymbolicLink()) throw refused('OWNED_PATH_REFUSED');
    if (info.isDirectory()) await removeOwnedTree(await ownedDirectory(path), assertAccess);
    else { await assertAccess(); await unlink(await ownedFile(path)); }
  }
  await assertAccess(); await rmdir(await ownedDirectory(directory));
}

export async function collectUnreferencedSources({ projectId, projects, repository, recovery }) {
  const access = () => repository.access('collect', projectId); await access();
  return exclusiveWriter(await projects.directory(projectId), async () => {
    let scan;
    try { scan = await scanSourceRecovery({ projectId, projects, repository, recovery }); }
    catch (e) { if (e.code === 'ACCESS_REFUSED') throw e; throw refused('SOURCE_SCAN_INCOMPLETE'); }
    const retained = new Set(scan.retainedSourceIds); const removedSourceIds = [];
    const sources = await repository.sourcesDirectory(projectId);
    for (const sourceId of await readdir(sources)) {
      if (retained.has(sourceId)) continue;
      await removeOwnedTree(await childDirectory(sources, sourceId), access); removedSourceIds.push(sourceId);
    }
    return { ok: true, projectId, removedSourceIds };
  }, projects.writerOptions);
}
