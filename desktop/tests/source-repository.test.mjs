import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rename, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-sources-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = await new ProjectStore(root).createProject({ label: 'Synthetic sources', json: '{}' });
  const { SourceRepository } = await import('../src/sources/repository.mjs');
  return { root, projectId: project.project.id, repo: new SourceRepository(root, options), SourceRepository };
}
const edit = (ref, operationId, start, end, insertedText) => ({ sourceId: ref.sourceId, expectedVersion: ref.version, operationId, start, end, insertedText });

test('exact BOM, mixed newline and Unicode bytes survive import, durable draft, commit and fresh reopen', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const original = Buffer.from('\ufeffa😀b\r\nc\rd\n');
  const ref = await repo.importSource({ projectId, bytes: original, provenance: { documentId: 'doc-one', agentId: 'agent-one', releaseId: 'r1' } });
  assert.equal(ref.sha256, sha(original)); assert.equal(ref.bom, true); assert.equal(ref.newline, 'mixed');
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), original);
  // Offsets address decoded text including its BOM. The emoji spans units 2..4.
  const first = await repo.applyEdit({ projectId, edit: edit(ref, 'insert-one', 4, 4, 'Ș') });
  const expected = Buffer.from('\ufeffa😀Șb\r\nc\rd\n');
  assert.equal(first.ok, true); assert.equal(first.durability, 'draft'); assert.equal(first.sha256, sha(expected));
  const fresh = new SourceRepository(root);
  assert.deepEqual(await fresh.exportSource({ projectId, sourceId: ref.sourceId, version: first.version }), expected);
  assert.deepEqual(await fresh.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), original);
  const receipt = await fresh.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: first.version, operationId: 'commit-one' });
  assert.equal(receipt.ok, true); assert.equal(receipt.durability, 'committed'); assert.equal(receipt.sha256, sha(expected));
  assert.equal(await new SourceRepository(root).readRange({ projectId, sourceId: ref.sourceId, version: first.version, start: 1, end: 6 }), 'a😀Șb');
});

test('duplicate operations survive restart; stale writes and ID reuse cannot replace selected bytes', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('abc'), provenance: {} });
  const request = { projectId, edit: edit(ref, 'op-one', 1, 2, '😀') };
  const first = await repo.applyEdit(request);
  const reopened = new SourceRepository(root);
  assert.deepEqual(await reopened.applyEdit(request), first);
  assert.equal((await reopened.applyEdit({ projectId, edit: edit(ref, 'op-two', 0, 0, 'x') })).code, 'REVISION_CONFLICT');
  assert.equal((await reopened.applyEdit({ projectId, edit: { ...request.edit, insertedText: 'wrong' } })).code, 'OPERATION_CONFLICT');
  assert.equal((await reopened.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: 1, operationId: 'stale-save' })).code, 'REVISION_CONFLICT');
  const saved = await reopened.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: first.version, operationId: 'save-one' });
  assert.deepEqual(await new SourceRepository(root).commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: first.version, operationId: 'save-one' }), saved);
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: first.version }), Buffer.from('a😀c'));
});

test('split surrogate, unpaired input and out-of-range edits preserve original version and bytes', async t => {
  const { projectId, repo } = await fixture(t);
  const bytes = Buffer.from('a😀b\r\nc'); const ref = await repo.importSource({ projectId, bytes });
  for (const request of [edit(ref, 'split-one', 2, 2, 'x'), edit(ref, 'bad-unicode', 1, 1, '\ud800'), edit(ref, 'bad-range', -1, 2, '')]) {
    assert.equal((await repo.applyEdit({ projectId, edit: request })).ok, false);
  }
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), bytes);
});

test('malformed UTF-8 stays exactly exportable and refuses editing without implicit conversion', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0xc3, 0x28, 0xff]);
  const ref = await repo.importSource({ projectId, bytes });
  assert.equal(ref.encoding, 'unsupported'); assert.equal(ref.utf16Units, null);
  assert.equal((await repo.applyEdit({ projectId, edit: edit(ref, 'invalid-input-edit', 0, 0, 'x') })).code, 'UNSUPPORTED_ENCODING');
  assert.deepEqual(await new SourceRepository(root).exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), bytes);
});

test('32 MiB source boundary is accepted, +1 refused; growing edit also obeys bytes rather than lines', async t => {
  const { projectId, repo } = await fixture(t);
  const bytes = Buffer.alloc(32 * 1024 * 1024, 0x61);
  const ref = await repo.importSource({ projectId, bytes });
  assert.equal(ref.utf8Bytes, bytes.length); assert.equal(ref.lines, 1);
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), bytes);
  await assert.rejects(repo.importSource({ projectId, bytes: Buffer.alloc(bytes.length + 1, 0x62) }), { code: 'SOURCE_BUDGET' });
  assert.equal((await repo.applyEdit({ projectId, edit: edit(ref, 'too-big', 0, 0, '😀') })).code, 'SOURCE_BUDGET');
});

test('project disk budget includes retained distinct blobs and journal overhead, refusing before publication', async t => {
  const { projectId, repo } = await fixture(t, { limits: { projectBytes: 12000 } });
  const first = await repo.importSource({ projectId, bytes: Buffer.alloc(4000, 0x61) });
  await assert.rejects(repo.importSource({ projectId, bytes: Buffer.alloc(10000, 0x62) }), { code: 'PROJECT_BUDGET' });
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: first.sourceId, version: 1 }), Buffer.alloc(4000, 0x61));
});

test('blob, journal and preselection faults keep old version; postselection ACK states the durable new version', async t => {
  for (const phase of ['source-blob-verified', 'source-version-verified', 'before-select', 'after-select']) {
    const { root, projectId, repo, SourceRepository } = await fixture(t);
    const ref = await repo.importSource({ projectId, bytes: Buffer.from('old') });
    const faulty = new SourceRepository(root, { fault: async step => { if (step === phase) throw new Error(`injected ${phase}`); } });
    const result = phase === 'source-blob-verified'
      ? await faulty.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: 1, operationId: 'fault-commit' })
      : await faulty.applyEdit({ projectId, edit: edit(ref, 'fault-edit', 0, 3, 'new') });
    if (phase === 'after-select') {
      assert.equal(result.ok, true); assert.equal(result.version, 2); assert.equal(result.sha256, sha(Buffer.from('new')));
      assert.deepEqual(await new SourceRepository(root).exportSource({ projectId, sourceId: ref.sourceId, version: 2 }), Buffer.from('new'));
    } else { assert.equal(result.ok, false); assert.equal((await repo.getMetrics({ projectId, sourceId: ref.sourceId })).version, 1); }
  }
});

test('checkpoint failure after source commit returns committed version with recovery-degraded durability', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('old') });
  const changed = await repo.applyEdit({ projectId, edit: edit(ref, 'change-for-save', 0, 3, 'new') });
  const broken = new SourceRepository(root, { checkpoint: async () => { throw new Error('checkpoint full'); } });
  const receipt = await broken.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: changed.version, operationId: 'save-degraded' });
  assert.equal(receipt.ok, true); assert.equal(receipt.durability, 'recovery-degraded'); assert.equal(receipt.version, changed.version);
  assert.equal(receipt.sha256, sha(Buffer.from('new')));
  assert.deepEqual(await new SourceRepository(root).exportSource({ projectId, sourceId: ref.sourceId, version: receipt.version }), Buffer.from('new'));
  const duplicate = await new SourceRepository(root).commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: changed.version, operationId: 'save-degraded' });
  assert.deepEqual(duplicate, receipt);
});

test('edit and commit share an operation identity namespace, refusing cross-kind reuse', async t => {
  const { projectId, repo } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('base') });
  assert.equal((await repo.commitSource({ projectId, sourceId: ref.sourceId, expectedVersion: 1, operationId: 'shared-id' })).ok, true);
  assert.equal((await repo.applyEdit({ projectId, edit: edit(ref, 'shared-id', 0, 0, 'x') })).code, 'OPERATION_CONFLICT');
});

test('default 256 MiB disk budget refuses the eighth distinct 32 MiB blob and preserves the seven admitted originals', async t => {
  const { projectId, repo } = await fixture(t);
  const admitted = [];
  for (let n = 0; n < 7; n++) admitted.push(await repo.importSource({ projectId, bytes: Buffer.alloc(32 * 1024 * 1024, 0x61 + n) }));
  await assert.rejects(repo.importSource({ projectId, bytes: Buffer.alloc(32 * 1024 * 1024, 0x68) }), { code: 'PROJECT_BUDGET' });
  assert.equal((await repo.getMetrics({ projectId, sourceId: admitted[0].sourceId })).sha256, sha(Buffer.alloc(32 * 1024 * 1024, 0x61)));
  assert.equal((await repo.getMetrics({ projectId, sourceId: admitted[6].sourceId })).sha256, sha(Buffer.alloc(32 * 1024 * 1024, 0x67)));
});

test('PIN/access, IDs, unknown project and junctions cannot bypass owned-source access', async t => {
  let unlocked = true; const { root, projectId, repo, SourceRepository } = await fixture(t, { canWrite: () => unlocked });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('owned') }); unlocked = false;
  await assert.rejects(repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), { code: 'ACCESS_REFUSED' });
  assert.equal((await repo.applyEdit({ projectId, edit: edit(ref, 'locked-write', 0, 0, 'x') })).code, 'ACCESS_REFUSED');
  unlocked = true;
  await assert.rejects(repo.importSource({ projectId: '../secret', bytes: Buffer.from('x') }), { code: 'INVALID_ID' });
  await assert.rejects(repo.importSource({ projectId: 'unknown-project', bytes: Buffer.from('x') }));
  await assert.rejects(repo.exportSource({ projectId, sourceId: '../secret', version: 1 }), { code: 'INVALID_ID' });
  const other = await mkdtemp(join(tmpdir(), 'siren-source-junction-')); t.after(() => rm(other, { recursive: true, force: true }));
  const sources = join(root, 'Projects', projectId, 'sources');
  await rename(sources, join(other, 'foreign-sources'));
  await symlink(join(other, 'foreign-sources'), sources, 'junction');
  await assert.rejects(new SourceRepository(root).getMetrics({ projectId, sourceId: ref.sourceId }));
});

test('concurrent owners cannot both select edits from the same source version', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('base') });
  const receipts = await Promise.all([repo, new SourceRepository(root)].map((owner, n) => owner.applyEdit({ projectId, edit: edit(ref, `writer-${n}`, 0, 4, `result-${n}`) })));
  assert.equal(receipts.filter(r => r.ok).length, 1);
  assert.ok(['WRITER_BUSY', 'REVISION_CONFLICT'].includes(receipts.find(r => !r.ok).code));
});

test('access lost immediately before pointer selection cannot publish a new draft', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('before-lock') });
  let unlocked = true;
  const gated = new SourceRepository(root, { canWrite: () => unlocked, fault: async phase => { if (phase === 'before-select') unlocked = false; } });
  const refused = await gated.applyEdit({ projectId, edit: edit(ref, 'lock-at-selection', 0, 11, 'after-lock') });
  assert.equal(refused.ok, false); assert.equal(refused.code, 'ACCESS_REFUSED');
  assert.equal((await repo.getMetrics({ projectId, sourceId: ref.sourceId })).version, 1);
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 }), Buffer.from('before-lock'));
});

test('a successful checkpoint receipt is durable and idempotent after restart', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('checkpoint') });
  let checkpointCalls = 0;
  const owner = new SourceRepository(root, { checkpoint: async () => { checkpointCalls++; } });
  const request = { projectId, sourceId: ref.sourceId, expectedVersion: 1, operationId: 'checkpoint-save' };
  const receipt = await owner.commitSource(request);
  assert.equal(receipt.durability, 'committed'); assert.equal(checkpointCalls, 1);
  assert.deepEqual(await new SourceRepository(root).commitSource(request), receipt);
});

test('an unselected durable commit journal does not poison its operation ID after another commit', async t => {
  const { root, projectId, repo, SourceRepository } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('original') });
  const request = { projectId, sourceId: ref.sourceId, expectedVersion: 1, operationId: 'orphan-save' };
  const broken = new SourceRepository(root, { fault: async phase => { if (phase === 'source-commit-verified') throw new Error('before selection'); } });
  assert.equal((await broken.commitSource(request)).ok, false);
  assert.equal((await repo.commitSource({ ...request, operationId: 'other-save' })).ok, true);
  const resumed = await new SourceRepository(root).commitSource(request);
  assert.equal(resumed.ok, true); assert.equal(resumed.sha256, sha(Buffer.from('original')));
  assert.deepEqual(await new SourceRepository(root).commitSource(request), resumed);
});
