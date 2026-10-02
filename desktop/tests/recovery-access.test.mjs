import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';

const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-recovery-access-'));
  const projects = new ProjectStore(root); const recovery = new RecoveryStore(root);
  const first = await projects.createProject({ label: 'Agent α', json: JSON.stringify({ source: 'flowchart TD\n A-->B', privateCodeDrafts: 'uncommitted Python' }) });
  await recovery.checkpointProject({ snapshot: first, kind: 'saved' });
  return { root, projects, recovery, first };
};

test('unacknowledged conflicting work is offered and restores a new exact copy without altering either original', async () => {
  const { RecoveryAccess } = await import('../src/recovery/access.mjs');
  const { projects, recovery, first } = await setup();
  await projects.saveProject({ projectId: first.project.id, baseRevision: 1, purpose: 'workspace', json: '{"source":"committed"}' });
  const stale = '{"privateCodeDrafts":"exact private unsaved code α","source":"conflict"}';
  assert.equal((await projects.saveProject({ projectId: first.project.id, baseRevision: 1, purpose: 'workspace', json: stale })).code, 'REVISION_CONFLICT');
  const access = new RecoveryAccess({ projects, recovery, grants: new Set([first.project.id]) });
  const state = await access.inspect(first.project.id);
  const pendingHash = (await projects.listPending(first.project.id)).find(p => p.json === stale).sha256;
  const point = state.points.find(p => p.kind === 'emergency' && p.sha256 === pendingHash);
  assert.ok(point); assert.equal('json' in point, false);
  const restored = await access.restore(point.id);
  assert.notEqual(restored.project.id, first.project.id); assert.equal(restored.json, stale);
  assert.equal((await projects.readProject(first.project.id)).json, '{"source":"committed"}');
  assert.ok((await projects.listPending(first.project.id)).some(p => p.json === stale));
  assert.equal((await access.export(point.id)).toString(), stale);
  await assert.rejects(new RecoveryAccess({ projects, recovery, grants: new Set() }).restore(point.id), /refused|unavailable/i);
});

test('damaged selection and revision have opaque export handles; unknown paths and changed bytes are refused', async () => {
  const { RecoveryAccess } = await import('../src/recovery/access.mjs');
  const { root, projects, recovery, first } = await setup();
  const directory = join(root, 'Projects', first.project.id);
  const selected = JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
  const path = join(directory, 'revisions', selected.file);
  await writeFile(path, '{DAMAGED_PRIVATE_ORIGINAL');
  const access = new RecoveryAccess({ projects, recovery, grants: new Set([first.project.id]) });
  let state = await access.inspect(first.project.id);
  assert.equal(state.damagedPoints.length, 1);
  const damaged = state.damagedPoints[0]; assert.equal('path' in damaged, false);
  assert.equal((await access.export(damaged.id)).toString(), '{DAMAGED_PRIVATE_ORIGINAL');
  await assert.rejects(access.restore(damaged.id), /unavailable/i);
  await assert.rejects(access.export(path), /refused|unavailable/i);
  await writeFile(path, '{DIFFERENT_BYTES'); await assert.rejects(access.export(damaged.id), /changed/i);
  await writeFile(join(directory, 'current.json'), '{DAMAGED_SELECTION');
  state = await access.inspect(first.project.id);
  assert.equal((await access.export(state.damagedPoints[0].id)).toString(), '{DAMAGED_SELECTION');
});

test('revision pruning requires verified current checkpoint and retains ten committed copies plus damaged and future originals', async () => {
  const { root, projects, recovery, first } = await setup();
  for (let i = 1; i < 14; i++) {
    const current = await projects.readProject(first.project.id);
    assert.equal((await projects.saveProject({ projectId: first.project.id, baseRevision: current.revision, purpose: 'workspace', json: JSON.stringify({ source: `revision ${i + 1}` }) })).ok, true);
  }
  const directory = join(root, 'Projects', first.project.id, 'revisions');
  const damaged = '1-00000000-0000-4000-8000-000000000001.json';
  await writeFile(join(directory, damaged), '{BROKEN');
  const current = await projects.readProject(first.project.id);
  const future = '99-00000000-0000-4000-8000-000000000002.json';
  await writeFile(join(directory, future), JSON.stringify({ ...current, revision: 99 }));
  await assert.rejects(projects.pruneRevisions({ snapshot: current, recovery }), /checkpoint/i);
  await recovery.checkpointProject({ snapshot: current, kind: 'saved' });
  await projects.pruneRevisions({ snapshot: current, recovery });
  assert.equal((await readdir(directory)).length, 12);
  assert.equal(await readFile(join(directory, damaged), 'utf8'), '{BROKEN');
  assert.equal(JSON.parse(await readFile(join(directory, future))).revision, 99);
  assert.equal((await projects.readProject(first.project.id)).json, current.json);
  assert.equal((await projects.listPending(first.project.id)).length, 13);
});
