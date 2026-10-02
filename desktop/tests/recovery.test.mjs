import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { ProjectStore } from '../src/projects/store.mjs';

const fixture = value => JSON.stringify({ diagrams: [{ id: 'd1', source: `flowchart TD\nA[${value}]-->B` }], workpapers: [{ id: 'doc1', blocks: [{ id: 'b1', rows: [{ id: 'src1', content: 'private source', agentId: 'agent1', releaseId: 'rel1' }] }] }], codeDraft: 'unsaved private draft' });
const root = () => mkdtemp(join(tmpdir(), 'siren-recovery-'));

test('checkpoint retention keeps 10 verified saved points, newest private draft and unacknowledged emergency', async () => {
  const { RecoveryStore } = await import('../src/recovery/checkpoints.mjs');
  const dir = await root(); const projects = new ProjectStore(dir); const recovery = new RecoveryStore(dir);
  const initial = await projects.createProject({ label: 'Retention', json: fixture(0) });
  for (let revision = 1; revision <= 14; revision++) await recovery.checkpointProject({ snapshot: { ...initial, revision }, kind: 'saved' });
  await recovery.checkpointProject({ snapshot: initial, kind: 'draft' });
  const latestDraft = await recovery.checkpointProject({ snapshot: { ...initial, revision: 15 }, kind: 'draft' });
  const emergency = await recovery.checkpointProject({ snapshot: initial, kind: 'emergency' });
  const state = await recovery.inspectRecovery({ projectId: initial.project.id });
  assert.equal(state.points.filter(p => p.kind === 'saved').length, 10);
  assert.equal(state.points.filter(p => p.kind === 'draft').length, 1);
  assert.ok(state.points.some(p => p.id === latestDraft.id)); assert.ok(state.points.some(p => p.id === emergency.id));
  assert.equal(state.lastRecoverableAt, latestDraft.createdAt > emergency.createdAt ? latestDraft.createdAt : emergency.createdAt);
});

test('corrupt newest checkpoint and catalog offer an older verified copy while preserving damaged originals', async () => {
  const { RecoveryStore } = await import('../src/recovery/checkpoints.mjs');
  const dir = await root(); const projects = new ProjectStore(dir); const recovery = new RecoveryStore(dir);
  const initial = await projects.createProject({ label: 'Damaged', json: fixture(0) });
  const first = await recovery.checkpointProject({ snapshot: initial, kind: 'saved' });
  const newest = await recovery.checkpointProject({ snapshot: { ...initial, revision: 2 }, kind: 'saved' });
  const checkpoint = join(dir, 'Recovery', initial.project.id, `${newest.id}.json`);
  const catalog = join(dir, 'Recovery', 'catalog.json');
  await writeFile(checkpoint, '{DAMAGED CHECKPOINT'); await writeFile(catalog, '{DAMAGED CATALOG');
  const state = await recovery.inspectRecovery({ projectId: initial.project.id });
  assert.equal(state.mode, 'recovery'); assert.equal(state.points.length, 1); assert.equal(state.points[0].id, first.id);
  assert.equal(state.damagedPoints[0].id, newest.id);
  assert.equal((await recovery.readDamagedPoint(newest.id, initial.project.id)).toString(), '{DAMAGED CHECKPOINT');
  assert.equal(await readFile(checkpoint, 'utf8'), '{DAMAGED CHECKPOINT'); assert.equal(await readFile(catalog, 'utf8'), '{DAMAGED CATALOG');
  const restored = await recovery.restoreRecovery({ pointId: first.id, destination: 'new-project', projects });
  assert.notEqual(restored.project.id, initial.project.id); assert.equal(restored.json, initial.json);
  assert.equal((await projects.readProject(initial.project.id)).json, initial.json);
  assert.equal(JSON.parse(restored.json).codeDraft, 'unsaved private draft');
});

test('missing checkpoint bytes cannot be called recovered, even with a planted positive catalog entry', async () => {
  const { RecoveryStore } = await import('../src/recovery/checkpoints.mjs');
  const dir = await root(); const projects = new ProjectStore(dir); const recovery = new RecoveryStore(dir);
  const initial = await projects.createProject({ label: 'Negative control', json: fixture(0) });
  await recovery.checkpointProject({ snapshot: initial, kind: 'saved' });
  const fake = { id: '11111111-1111-1111-1111-111111111111', projectId: initial.project.id, verified: true, kind: 'saved', revision: 9, sha256: initial.sha256, createdAt: new Date().toISOString() };
  await writeFile(join(dir, 'Recovery', 'catalog.json'), JSON.stringify({ schema: 1, points: [fake] }));
  const state = await recovery.inspectRecovery({ projectId: initial.project.id });
  assert.equal(state.points.some(p => p.id === fake.id), false);
  await assert.rejects(recovery.restoreRecovery({ pointId: fake.id, destination: 'new-project', projects }), /unavailable|invalid/i);
});

test('owned process killed at write phases restarts with an exact old or new selected revision', async () => {
  for (const phase of ['before-flush', 'after-flush', 'after-rename', 'before-select', 'after-select']) {
    const dir = await root(); const projects = new ProjectStore(dir);
    const initial = await projects.createProject({ label: phase, json: fixture('old') });
    const candidate = fork(new URL('./fixtures/crash-writer.mjs', import.meta.url), [dir, initial.project.id, phase, fixture('new')], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const exit = once(candidate, 'exit');
    const message = await Promise.race([once(candidate, 'message'), new Promise((_, reject) => { const timer = setTimeout(() => { candidate.kill(); reject(new Error('Fault phase was not reached')); }, 15000); timer.unref(); })]);
    assert.equal(message[0].phase, phase); assert.equal(message[0].pid, candidate.pid);
    candidate.kill('SIGKILL'); const [code, signal] = await exit;
    assert.ok(code !== 0 || signal, 'A clean exit cannot satisfy the crash test');
    const readback = await new ProjectStore(dir).readProject(initial.project.id);
    assert.ok([fixture('old'), fixture('new')].includes(readback.json));
    assert.equal(readback.revision, readback.json === fixture('old') ? 1 : 2);
    assert.ok((await projects.listPending(initial.project.id)).some(p => p.json === fixture('new')));
  }
});

test('three verified-dead unclean sessions within five minutes offer Recovery Mode; PID reuse is not a live session', async () => {
  const { SessionJournal } = await import('../src/recovery/sessions.mjs');
  const dir = await root(); const now = Date.now();
  const journal = new SessionJournal(dir, { now: () => now, inspectProcess: async () => ({ pid: 9, path: 'different.exe', startedAt: 'different' }) });
  for (let i = 0; i < 3; i++) await journal.recordSession({ event: 'opened', sessionId: `old-${i}`, version: '0.1.0-dev.1', processIdentity: { pid: 9, path: 'owned.exe', startedAt: `${i}` } });
  assert.equal((await journal.inspectStartup()).mode, 'recovery');
  await journal.recordSession({ event: 'clean-close', sessionId: 'old-0', version: '0.1.0-dev.1', processIdentity: { pid: 9, path: 'owned.exe', startedAt: '0' } });
  assert.equal((await journal.inspectStartup()).mode, 'normal');
});

test('unknown process inspection and malformed session events fail closed instead of treating them as confirmed dead', async () => {
  const { SessionJournal } = await import('../src/recovery/sessions.mjs');
  const dir = await root(); const journal = new SessionJournal(dir);
  await journal.recordSession({ event: 'opened', sessionId: 'unknown', version: 'prototype', processIdentity: { pid: 9, path: 'owned.exe', startedAt: 'creation' } });
  assert.equal((await journal.inspectStartup()).mode, 'readonly');
  await writeFile(join(dir, 'Recovery', 'sessions.json'), '{"schema":1,"events":[null]}');
  assert.equal((await journal.inspectStartup()).mode, 'readonly');
  await journal.recordSession({ event: 'opened', sessionId: 'new', version: 'prototype', processIdentity: { pid: 10, path: 'owned.exe', startedAt: 'new' } });
  const files = await readdir(join(dir, 'Recovery'));
  const damaged = files.find(f => f.startsWith('sessions-damaged-'));
  assert.ok(damaged); assert.equal(await readFile(join(dir, 'Recovery', damaged), 'utf8'), '{"schema":1,"events":[null]}');
});
