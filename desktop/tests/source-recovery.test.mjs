import test from 'node:test';
import assert from 'node:assert/strict';
import { rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { RecoveryAccess } from '../src/recovery/access.mjs';
import { manifestRequestHash } from '../src/sources/manifest.mjs';
import vm from 'node:vm';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'siren-source-recovery-')); t.after(() => rm(root, { recursive: true, force: true }));
  const projects = new ProjectStore(root); const repository = new SourceRepository(root);
  const initial = await projects.createProject({ label: 'Synthetic schema 2', json: '{}' });
  const ref = await repository.importSource({ projectId: initial.project.id, bytes: Buffer.from('\ufeffdef f():\r\n    return "😀"\n'), provenance: { agentId: 'agent-one', releaseId: 'r1' } });
  const pointer = { sourceId: ref.sourceId, version: ref.version, sha256: ref.sha256 };
  const json = JSON.stringify({ docs: [{ id: 'row-one', sourceRef: pointer }, { id: 'row-two', sourceRef: pointer }], unlinked: [{ sourceRef: pointer }] });
  const operationId = 'source-manifest-one';
  const snapshot = { ...initial, schema: 2, revision: 2, json, sha256: sha(Buffer.from(json)), sourceRefs: [ref], operationId, parentRequestHash: null, parentManifestHash: null,
    requestHash: manifestRequestHash({ projectId: initial.project.id, baseRevision: 1, sourceRefs: [ref], json, operationId }) };
  await projects.commit(await projects.directory(initial.project.id), snapshot);
  const recovery = new RecoveryStore(root, { sources: repository });
  return { root, projects, repository, recovery, snapshot, ref };
}

test('schema 2 refuses old renderer workspace save without changing the source manifest', async t => {
  const { projects, snapshot } = await fixture(t);
  const receipt = await projects.saveProject({ projectId: snapshot.project.id, baseRevision: 2, purpose: 'workspace', json: '{"legacy":true}' });
  assert.equal(receipt.ok, false); assert.equal(receipt.code, 'SCHEMA_UNSUPPORTED');
  assert.deepEqual(await projects.readProject(snapshot.project.id), snapshot);
});

test('selecting schema 2 exposes a read-only legacy view instead of allowing metadata-only edits', async t => {
  const { snapshot } = await fixture(t);
  const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
  const start = main.indexOf('const selected = async (next,{isCurrent}={}) => {'); const end = main.indexOf('const changeSelection =', start);
  assert.ok(start >= 0 && end > start);
  const context = vm.createContext({ atomicWrite: async () => {}, join, dataRoot: 'fixture-only', Buffer, selectedId: null, grants: new Set(), snapshot: null,
    account: { accountId: null, policy: { opened() {} } }, mode: 'normal', reason: null, nativeReadonly: false, bootstrap: { selectionGeneration: 0 } });
  vm.runInContext(main.slice(start, end), context);
  await vm.runInContext('selected', context)(snapshot);
  assert.equal(context.bootstrap.readonly, true);
  assert.match(context.bootstrap.reason, /source|schema/i);
});

test('schema 2 checkpoints and exports bind referenced bytes, not only metadata JSON', async t => {
  const { root, projects, repository, recovery, snapshot, ref } = await fixture(t);
  const point = await recovery.checkpointProject({ snapshot, kind: 'saved' });
  assert.equal(point.schema, 2);
  const access = new RecoveryAccess({ projects, recovery, grants: new Set([snapshot.project.id]) });
  const bundle = JSON.parse((await access.export(point.id)).toString('utf8'));
  assert.equal(bundle.schema, 2); assert.equal(bundle.format, 'siren-source-bundle'); assert.equal(bundle.sources.length, 1);
  const bytes = Buffer.from(bundle.sources[0].base64, 'base64');
  assert.equal(sha(bytes), ref.sha256); assert.deepEqual(bytes, await repository.exportSource({ projectId: snapshot.project.id, sourceId: ref.sourceId, version: 1 }));
  const blob = join(root, 'Projects', snapshot.project.id, 'sources', ref.sourceId, 'blobs', `${ref.sha256}.bin`);
  await writeFile(blob, 'damaged');
  await assert.rejects(access.export(point.id));
  assert.equal((await recovery.scan(snapshot.project.id)).damaged, true);
});

test('restoring schema 2 creates independent sources and preserves every byte of the original project', async t => {
  const { projects, repository, recovery, snapshot, ref } = await fixture(t);
  const point = await recovery.checkpointProject({ snapshot, kind: 'emergency' });
  const original = await projects.readProject(snapshot.project.id);
  const access = new RecoveryAccess({ projects, recovery, grants: new Set([snapshot.project.id]) });
  const restored = await access.restore(point.id);
  assert.notEqual(restored.project.id, snapshot.project.id); assert.equal(restored.schema, 2); assert.equal(restored.sourceRefs.length, 1);
  const copied = restored.sourceRefs[0]; assert.equal(copied.sha256, ref.sha256);
  assert.deepEqual(await repository.exportSource({ projectId: restored.project.id, sourceId: copied.sourceId, version: copied.version }), await repository.exportSource({ projectId: snapshot.project.id, sourceId: ref.sourceId, version: ref.version }));
  const metadata = JSON.parse(restored.json);
  assert.equal(metadata.docs[0].sourceRef.sourceId, copied.sourceId); assert.equal(metadata.docs[1].sourceRef.sourceId, copied.sourceId);
  assert.equal(metadata.unlinked[0].sourceRef.sourceId, copied.sourceId);
  assert.deepEqual(await projects.readProject(snapshot.project.id), original);
});

test('source collection preserves emergency references and selected private drafts, removing only unselected import debris', async t => {
  const { root, projects, repository, recovery, snapshot, ref } = await fixture(t);
  await recovery.checkpointProject({ snapshot, kind: 'emergency' });
  const draft = await repository.importSource({ projectId: snapshot.project.id, bytes: Buffer.from('private draft') });
  const failed = new SourceRepository(root, { fault: async phase => { if (phase === 'source-blob-verified') throw new Error('import before selection'); } });
  await assert.rejects(failed.importSource({ projectId: snapshot.project.id, bytes: Buffer.from('unselected debris') }));
  const sources = join(root, 'Projects', snapshot.project.id, 'sources');
  const before = await readdir(sources);
  const { collectUnreferencedSources } = await import('../src/sources/recovery.mjs');
  const receipt = await collectUnreferencedSources({ projectId: snapshot.project.id, projects, repository, recovery });
  assert.equal(receipt.ok, true); assert.equal(receipt.removedSourceIds.length, 1);
  assert.equal(before.length, 3); assert.deepEqual((await readdir(sources)).sort(), [ref.sourceId, draft.sourceId].sort());
  assert.deepEqual(await repository.exportSource({ projectId: snapshot.project.id, sourceId: draft.sourceId, version: 1 }), Buffer.from('private draft'));
});

test('damaged recovery scan refuses collection and retains original source/debris bytes', async t => {
  const { root, projects, repository, recovery, snapshot } = await fixture(t);
  const point = await recovery.checkpointProject({ snapshot, kind: 'emergency' });
  const damaged = join(root, 'Recovery', snapshot.project.id, `${point.id}.json`);
  await writeFile(damaged, '{damaged original');
  const sources = join(root, 'Projects', snapshot.project.id, 'sources'); const before = await readdir(sources);
  const { collectUnreferencedSources } = await import('../src/sources/recovery.mjs');
  await assert.rejects(collectUnreferencedSources({ projectId: snapshot.project.id, projects, repository, recovery }), { code: 'SOURCE_SCAN_INCOMPLETE' });
  assert.deepEqual(await readdir(sources), before); assert.equal(await readFile(damaged, 'utf8'), '{damaged original');
});

test('missing bytes of a selected unlinked source refuse collection instead of classifying it as an import orphan', async t => {
  const { root, projects, repository, recovery, snapshot } = await fixture(t);
  const draft = await repository.importSource({ projectId: snapshot.project.id, bytes: Buffer.from('private missing bytes') });
  const source = join(root, 'Projects', snapshot.project.id, 'sources', draft.sourceId);
  const pointerBefore = await readFile(join(source, 'current.json'));
  await rm(join(source, 'blobs', `${draft.sha256}.bin`));
  const { collectUnreferencedSources } = await import('../src/sources/recovery.mjs');
  await assert.rejects(collectUnreferencedSources({ projectId: snapshot.project.id, projects, repository, recovery }), { code: 'SOURCE_SCAN_INCOMPLETE' });
  assert.deepEqual(await readFile(join(source, 'current.json')), pointerBefore);
});

test('an unscanned checkpoint temporary refuses collection because recovery coverage is incomplete', async t => {
  const { root, projects, repository, recovery, snapshot } = await fixture(t);
  await recovery.checkpointProject({ snapshot, kind: 'saved' });
  const path = join(root, 'Recovery', snapshot.project.id, 'pending-unscanned.tmp'); await writeFile(path, 'unverified possible source reference');
  const { collectUnreferencedSources } = await import('../src/sources/recovery.mjs');
  await assert.rejects(collectUnreferencedSources({ projectId: snapshot.project.id, projects, repository, recovery }), { code: 'SOURCE_SCAN_INCOMPLETE' });
  assert.equal(await readFile(path, 'utf8'), 'unverified possible source reference');
});
