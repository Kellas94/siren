import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { commitManifest, verifySourceManifest, manifestRequestHash } from '../src/sources/manifest.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const pointer = ref => ({ sourceId: ref.sourceId, version: ref.version, sha256: ref.sha256 });
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'siren-manifest-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projects = new ProjectStore(root);
  const initial = await projects.createProject({ label: 'Synthetic manifest', json: '{}' });
  const repository = new SourceRepository(root);
  const bytes = Buffer.from('\uFEFFa😀\r\nb\nc');
  const ref = await repository.importSource({ projectId: initial.project.id, bytes, provenance: { documentId: 'doc-a', rowId: 'row-a' } });
  const metadata = { workpapers: [{ id: 'doc-a', blocks: [{ id: 'block-a', kind: 'knowledge', rows: [{ id: 'row-a', sourceRef: pointer(ref) }] }] }] };
  const request = { projects, repository, projectId: initial.project.id, baseRevision: 1, sourceRefs: [ref], metadata, operationId: 'manifest-one' };
  return { root, projects, repository, initial, ref, bytes, request };
}

test('manifest validates exact bounded reference identities and refuses inline or missing sources', async t => {
  const { initial, ref, request } = await fixture(t);
  const json = JSON.stringify(request.metadata);
  const snapshot = { schema: 2, project: initial.project, revision: 2, json, sha256: sha(json), sourceRefs: [ref], operationId: 'manifest-one', parentRequestHash: null, parentManifestHash: null,
    requestHash: manifestRequestHash({ projectId: initial.project.id, baseRevision: 1, sourceRefs: [ref], json, operationId: 'manifest-one' }) };
  assert.equal(verifySourceManifest(snapshot), snapshot);
  for (const mutation of [
    value => value.sourceRefs[0].sourceId = '../escape',
    value => value.sourceRefs[0].version = 0,
    value => value.sourceRefs[0].utf16Units = -1,
    value => value.sourceRefs[0].encoding = 'latin1',
    value => value.sourceRefs.push(value.sourceRefs[0]),
    value => value.sourceRefs[0].provenance = { data: 'x'.repeat(65537) },
  ]) {
    const invalid = structuredClone(snapshot); mutation(invalid);
    assert.throws(() => verifySourceManifest(invalid));
  }
  for (const metadata of [{ codeFiles: [{ id: 'file', content: 'hidden full source' }] }, { row: { sourceRef: pointer(ref), content: 'duplicate' } }, { row: { sourceRef: { ...pointer(ref), version: 99 } } }, { row: { sourceRef: { ...pointer(ref), version: '1' } } }]) {
    const invalid = { ...snapshot, json: JSON.stringify(metadata) };
    invalid.sha256 = sha(invalid.json);
    invalid.requestHash = manifestRequestHash({ projectId: initial.project.id, baseRevision: 1, sourceRefs: [ref], json: invalid.json, operationId: 'manifest-one' });
    assert.throws(() => verifySourceManifest(invalid));
  }
});

test('commit materializes exact old source versions before selecting schema 2 manifest', async t => {
  const { root, initial, ref, bytes, request } = await fixture(t);
  await request.repository.applyEdit({ projectId: initial.project.id, edit: { sourceId: ref.sourceId, expectedVersion: 1, operationId: 'newer-source', start: 1, end: 2, insertedText: 'Z' } });
  const receipt = await commitManifest(request);
  assert.equal(receipt.ok, true); assert.equal(receipt.revision, 2); assert.equal(receipt.durability, 'committed');
  assert.deepEqual(receipt.sourceRefs, [ref]);
  const reopened = await new ProjectStore(root).readProject(initial.project.id);
  assert.equal(reopened.schema, 2); assert.equal(reopened.sha256, sha(JSON.stringify(request.metadata)));
  assert.deepEqual(reopened.sourceRefs, [ref]);
  const blob = join(await request.repository.sourceDirectory(initial.project.id, ref.sourceId), 'blobs', `${ref.sha256}.bin`);
  assert.deepEqual(await readFile(blob), bytes);
});

test('manifest refuses forged metrics and provenance without selecting a new project revision', async t => {
  const { initial, request } = await fixture(t);
  for (const field of ['utf8Bytes', 'lines', 'provenance']) {
    const forged = structuredClone(request.sourceRefs);
    forged[0][field] = field === 'provenance' ? { agentId: 'invented' } : forged[0][field] + 1;
    assert.equal((await commitManifest({ ...request, sourceRefs: forged, operationId: `forged-${field.toLowerCase()}` })).ok, false);
    assert.equal((await request.projects.readProject(initial.project.id)).revision, 1);
  }
});

test('idempotent manifests survive newer commits and changed payload IDs refuse reuse', async t => {
  const { root, initial, request } = await fixture(t);
  const first = await commitManifest(request);
  assert.equal(first.ok, true);
  const second = await commitManifest({ ...request, operationId: 'manifest-two', baseRevision: 2, metadata: { ...request.metadata, name: 'second' } });
  assert.equal(second.revision, 3);
  assert.deepEqual(await commitManifest({ ...request, projects: new ProjectStore(root), repository: new SourceRepository(root) }), first);
  assert.equal((await commitManifest({ ...request, metadata: { ...request.metadata, name: 'changed' } })).code, 'OPERATION_CONFLICT');
  assert.equal((await commitManifest({ ...request, operationId: 'stale-new' })).code, 'REVISION_CONFLICT');
  assert.equal((await request.projects.readProject(initial.project.id)).revision, 3);
});

test('unselected orphan revisions cannot produce a successful duplicate acknowledgement', async t => {
  const { request } = await fixture(t);
  request.projects.fault = async phase => { if (phase === 'before-select') throw new Error('synthetic disk failure'); };
  assert.equal((await commitManifest(request)).ok, false);
  request.projects.fault = async () => {};
  const other = await commitManifest({ ...request, operationId: 'selected-other', metadata: { ...request.metadata, name: 'other' } });
  assert.equal(other.ok, true);
  const orphan = await commitManifest(request);
  assert.equal(orphan.ok, false); assert.equal(orphan.code, 'REVISION_CONFLICT');
});

test('after-selection fault acknowledges exact selected manifest while checkpoint failure remains degraded', async t => {
  const { request } = await fixture(t);
  request.projects.fault = async phase => { if (phase === 'after-select') throw new Error('post-commit failure'); };
  const recovery = { checkpointProject: async () => { throw new Error('checkpoint unavailable'); }, scan: async () => ({ valid: [] }) };
  const receipt = await commitManifest({ ...request, recovery });
  assert.equal(receipt.ok, true); assert.equal(receipt.revision, 2); assert.equal(receipt.durability, 'recovery-degraded');
  request.projects.fault = async () => {};
  assert.deepEqual(await commitManifest({ ...request, recovery }), receipt);
  assert.deepEqual(await commitManifest(request), receipt);
});

test('source verification fault leaves original selection and retains attempted files', async t => {
  const { initial, request } = await fixture(t);
  const receipt = await commitManifest({ ...request, fault: async phase => { if (phase === 'manifest-sources-verified') throw new Error('stop before manifest'); } });
  assert.equal(receipt.ok, false);
  assert.equal((await request.projects.readProject(initial.project.id)).revision, 1);
  assert.equal((await readdir(await request.repository.sourcesDirectory(initial.project.id))).length, 1);
});

test('unsupported raw source bytes remain exactly referenced and exportable after a manifest commit', async t => {
  const { root, initial, request } = await fixture(t);
  const bytes = Buffer.from([0xef,0xbb,0xbf,0xff,0x00,0x0d,0x0a]);
  const raw = await request.repository.importSource({ projectId: initial.project.id, bytes, provenance: { kind: 'raw-original', fileId: 'raw-file' } });
  const result = await commitManifest({ ...request, sourceRefs: [raw], metadata: { raw: { sourceRef: pointer(raw) } } });
  assert.equal(result.ok, true);
  assert.equal(result.sourceRefs[0].encoding, 'unsupported'); assert.equal(result.sourceRefs[0].bom, true);
  const fresh = new SourceRepository(root);
  assert.deepEqual(await fresh.exportSource({ projectId: initial.project.id, sourceId: raw.sourceId, version: 1 }), bytes);
  await assert.rejects(fresh.readRange({ projectId: initial.project.id, sourceId: raw.sourceId, version: 1, start: 0, end: 1 }), { code: 'UNSUPPORTED_ENCODING' });
});

test('access revoked after source materialization refuses manifest publication', async t => {
  const { initial, request } = await fixture(t);
  const result = await commitManifest({ ...request, fault: async phase => {
    if (phase === 'manifest-sources-verified') request.repository.canWrite = () => false;
  } });
  assert.equal(result.ok, false); assert.equal(result.code, 'ACCESS_REFUSED');
  assert.equal((await request.projects.readProject(initial.project.id)).revision, 1);
});

test('concurrent manifest owners cannot both publish against one project revision', async t => {
  const { initial, request } = await fixture(t);
  const attempts = await Promise.all([commitManifest(request), commitManifest({ ...request, operationId: 'other-owner', metadata: { ...request.metadata, owner: 'second' } })]);
  assert.equal(attempts.filter(result => result.ok).length, 1);
  assert.ok(['WRITER_BUSY','REVISION_CONFLICT'].includes(attempts.find(result => !result.ok).code));
  const selected = await request.projects.readProject(initial.project.id);
  assert.equal(selected.revision, 2);
  assert.equal(selected.operationId, attempts.find(result => result.ok).operationId);
});

test('identical orphan and successful retry records still prove selected ancestry for duplicate receipts', async t => {
  const { request } = await fixture(t);
  request.projects.fault = async phase => { if (phase === 'before-select') throw new Error('failed first selection'); };
  assert.equal((await commitManifest(request)).ok, false);
  request.projects.fault = async () => {};
  const committed = await commitManifest(request);
  assert.equal(committed.ok, true);
  assert.equal((await commitManifest({ ...request, baseRevision: 2, operationId: 'after-retry' })).ok, true);
  assert.deepEqual(await commitManifest(request), committed);
});

test('native restore purpose permits new manifest selection when ordinary workspace saves are refused', async t => {
  const { request } = await fixture(t);
  request.projects.canSave = ({ action }) => action === 'restore';
  assert.equal((await commitManifest(request)).code, 'ACCESS_REFUSED');
  const restored = await commitManifest({ ...request, purpose: 'restore' });
  assert.equal(restored.ok, true); assert.equal(restored.revision, 2);
});

test('permission revoked in the awaited before-select hook cannot publish a new manifest', async t => {
  const { initial, request } = await fixture(t);
  request.projects.fault = async phase => {
    if (phase === 'before-select') request.projects.canSave = () => false;
  };
  const result = await commitManifest(request);
  assert.equal(result.ok, false); assert.equal(result.code, 'ACCESS_REFUSED');
  assert.equal((await request.projects.readProject(initial.project.id)).revision, 1);
});

test('selected parent identity distinguishes an orphan with a different checkpoint policy', async t => {
  const { request } = await fixture(t);
  const recovery = { checkpointProject: async () => {}, scan: async () => ({ valid: [] }) };
  request.projects.fault = async phase => { if (phase === 'before-select') throw new Error('orphan with checkpoint policy'); };
  assert.equal((await commitManifest({ ...request, recovery })).ok, false);
  request.projects.fault = async () => {};
  const selected = await commitManifest(request);
  assert.equal(selected.ok, true); assert.equal(selected.durability, 'committed');
  assert.equal((await commitManifest({ ...request, baseRevision: 2, operationId: 'next-selected' })).ok, true);
  assert.deepEqual(await commitManifest(request), selected);
});
