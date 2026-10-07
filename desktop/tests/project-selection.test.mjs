import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, symlink } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { RecoveryAccess } from '../src/recovery/access.mjs';

test('choosing another damaged owned project grants its recovery and keeps the original intact', async () => {
  const { openOwnedSelection } = await import('../src/projects/selection.mjs');
  const root = await mkdtemp(join(tmpdir(), 'siren-selection-')); const projects = new ProjectStore(root), recovery = new RecoveryStore(root);
  const a = await projects.createProject({ label: 'A', json: '{"source":"flowchart TD\\n A-->B"}' });
  await recovery.checkpointProject({ snapshot: a, kind: 'saved' });
  const b = await projects.createProject({ label: 'B', json: '{}' }); const grants = new Set([b.project.id]);
  const damaged = join(root, 'Projects', a.project.id, 'current.json'); await writeFile(damaged, '{damaged original');
  let selectedId = b.project.id;
  const result = await openOwnedSelection({ projectId: a.project.id, projects, grants, selected: async () => { assert.fail('Damaged project is not a normal snapshot'); }, recoverySelected: async id => { selectedId = id; } });
  assert.equal(result.code, 'RECOVERY_REQUIRED'); assert.equal(result.recoveryRequired, true); assert.equal(selectedId, a.project.id);
  const access = new RecoveryAccess({ projects, recovery, grants });
  const state = await access.inspect(a.project.id); assert.equal(state.points.length, 1);
  const restored = await access.restore(state.points[0].id); assert.notEqual(restored.project.id, a.project.id); assert.equal(restored.sha256, a.sha256);
  assert.equal(await import('node:fs/promises').then(fs=>fs.readFile(damaged,'utf8')), '{damaged original');
  const outside = await mkdtemp(join(tmpdir(), 'siren-unowned-')); await symlink(outside, join(root, 'Projects', 'unowned'), 'junction');
  await assert.rejects(openOwnedSelection({ projectId: 'unowned', projects, grants, selected: async()=>{}, recoverySelected: async()=>{assert.fail('No external grant');} }), /refused/i);
  assert.equal(grants.has('unowned'), false);
});
