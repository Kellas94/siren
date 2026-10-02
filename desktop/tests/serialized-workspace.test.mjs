import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { digest } from '../src/projects/atomic.mjs';

// Hand-derived: 10-byte prefix + 2-byte suffix + paired JSON escapes = 64 MiB.
const escapedWorkspace = pair => '{"text": "' + pair.repeat((67108864 - 12) / 2) + '"}';

test('accepted 64 MiB escaped work survives create, save, pending read and recovery in a fresh store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-serialized-boundary-'));
  const store = new ProjectStore(root);
  const initialJson = escapedWorkspace('\\\\');
  assert.equal(Buffer.byteLength(initialJson), 67108864);
  // Control characters exercise the maximum label length with JSON escaping.
  const initial = await store.createProject({ label: '\u0001'.repeat(200), json: initialJson });
  assert.equal((await new ProjectStore(root).readProject(initial.project.id)).json, initialJson);
  const selected = JSON.parse(await readFile(join(root, 'Projects', initial.project.id, 'current.json')));
  const bytes = await readFile(join(root, 'Projects', initial.project.id, 'revisions', selected.file));
  assert.ok(bytes.length > 134217728, 'regression fixture must cross the old selected-revision limit');
  assert.equal(digest(bytes), selected.sha256);
  const changedJson = escapedWorkspace('\\"');
  const saved = await store.saveProject({ projectId: initial.project.id, baseRevision: 1, json: changedJson, purpose: 'workspace' });
  assert.equal(saved.ok, true);
  const fresh = new ProjectStore(root);
  const loaded = await fresh.readProject(initial.project.id);
  assert.equal(loaded.revision, 2);
  assert.equal(loaded.json, changedJson);
  assert.equal(loaded.sha256, digest(Buffer.from(changedJson)));
  const pending = await fresh.listPending(initial.project.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].json, changedJson);
  const recovery = new RecoveryStore(root);
  const point = await recovery.checkpointProject({ snapshot: loaded, kind: 'saved' });
  assert.equal((await new RecoveryStore(root).readPoint(point.id)).snapshot.json, changedJson);
  assert.equal((await fresh.listProjects())[0].damaged, undefined);
});

test('oversized serialized revision is refused before changing the current pointer or writing a revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-serialized-refusal-'));
  const store = new ProjectStore(root);
  const initial = await store.createProject({ label: 'Original', json: '{"text":"original"}' });
  const dir = await store.directory(initial.project.id);
  const pointerBefore = await readFile(join(dir, 'current.json'));
  const revisionsBefore = await readdir(join(dir, 'revisions'));
  const json = escapedWorkspace('\\\\');
  const oversized = { ...initial, revision: 2, json, sha256: digest(Buffer.from(json)), extra: 'x'.repeat(65536) };
  await assert.rejects(store.commit(dir, oversized));
  assert.deepEqual(await readFile(join(dir, 'current.json')), pointerBefore);
  assert.deepEqual(await readdir(join(dir, 'revisions')), revisionsBefore);
  assert.equal((await new ProjectStore(root).readProject(initial.project.id)).json, initial.json);
});

test('oversized serialized recovery point is refused before retaining an unreadable checkpoint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-serialized-recovery-'));
  const store = new ProjectStore(root);
  const initial = await store.createProject({ label: 'Original', json: '{"text":"original"}' });
  const recovery = new RecoveryStore(root);
  await recovery.checkpointProject({ snapshot: initial, kind: 'saved' });
  const pointDirectory = join(root, 'Recovery', initial.project.id);
  const pointsBefore = await readdir(pointDirectory);
  const catalogBefore = await readFile(join(root, 'Recovery', 'catalog.json'));
  const json = escapedWorkspace('\\\\');
  await assert.rejects(recovery.checkpointProject({ snapshot: { ...initial, json, sha256: digest(Buffer.from(json)), extra: 'x'.repeat(65536) }, kind: 'saved' }));
  assert.deepEqual(await readdir(pointDirectory), pointsBefore);
  assert.deepEqual(await readFile(join(root, 'Recovery', 'catalog.json')), catalogBefore);
  assert.equal((await recovery.scan(initial.project.id)).invalid.length, 0);
});
