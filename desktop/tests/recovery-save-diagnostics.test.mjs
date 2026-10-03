import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { RecoveryAccess } from '../src/recovery/access.mjs';
import { atomicWrite, digest } from '../src/projects/atomic.mjs';
import { failure } from '../src/ipc.mjs';
import { buildRenderer } from '../build/renderer.mjs';
import {installPrimaryOwner} from './fixtures/primary-owner-context.mjs';

// Synthetic diagnostics, not a native reproduction or CI26 root-cause verdict.
// Extract the actual current service bodies without importing Electron or
// copying a second implementation of the commit/checkpoint ordering.
const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const storage = await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8');
function sliceUnique(source, start, end) {
  assert.equal(source.split(start).length, 2, `Unique source marker: ${start}`);
  const offset = source.indexOf(start);
  const limit = source.indexOf(end, offset);
  assert.ok(limit > offset, `Source end marker: ${end}`);
  return source.slice(offset, limit);
}
const selectedSource = sliceUnique(main, 'const selected = async next => {', 'const exportBytes =');
const saveSource = sliceUnique(main, '  saveProject: async request => {', '  exportProject:');
const restoreSource = sliceUnique(main, '  restoreRecovery: async id => {', '  exportRecovery:');
const rendererRoot = await mkdtemp(join(tmpdir(), 'siren-recovery-save-renderer-'));
await buildRenderer({ baselinePath: new URL('../baseline/R78.html', import.meta.url), outputDir: rendererRoot });
const html = await readFile(join(rendererRoot, 'app.html'), 'utf8');
const saveStateSource = sliceUnique(html, 'async function saveState() {', '\n      function syncStateFromControls()');
const flushSource = sliceUnique(html, 'let desktopSaveQueue = Promise.resolve', '        let accountTransitionBodyState =');
const workspaceKey = 't-industries-siren-v23-state';
const bag = value => JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: { [workspaceKey]: JSON.stringify({ source: `flowchart TD\nA[${value}]-->B` }) } });
const plain = value => JSON.parse(JSON.stringify(value));
function gate() {
  let enter, release;
  const entered = new Promise(resolve => { enter = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  return { entered, release, async pause() { enter(); await pending; } };
}
async function fixture() {
  const dataRoot = await mkdtemp(join(tmpdir(), 'siren-recovery-save-diagnostic-'));
  const projects = new ProjectStore(dataRoot);
  const recovery = new RecoveryStore(dataRoot);
  const original = await projects.createProject({ label: 'Owned synthetic original', json: bag('original') });
  const point = await recovery.checkpointProject({ snapshot: original, kind: 'saved' });
  const grants = new Set([original.project.id]);
  const recoveryAccess = new RecoveryAccess({ projects, recovery, grants });
  const context = vm.createContext({ projects, recovery, recoveryAccess, grants, writes: new Set(), dataRoot,
    atomicWrite, join, failure, Buffer, account: { accountId: null, policy: { opened() {} } }, retireNativeViews: () => {},
    accountTransition: false, pinTransition: false, window: { webContents: { executeJavaScript: async () => {} } },
    selectedId: original.project.id, snapshot: original, nativeReadonly: false, mode: 'normal', reason: null,
    bootstrap: { mode: 'normal', readonly: false, snapshot: original, recoveryProjectId: original.project.id } });
  vm.runInContext(`${selectedSource}\nconst diagnosticServices = {\n${saveSource}${restoreSource}\n};`, context);
  installPrimaryOwner(context,{projects:()=>projects});
  const services = vm.runInContext('diagnosticServices', context);
  const recovered = await services.restoreRecovery(point.id);
  assert.notEqual(recovered.project.id, original.project.id);
  assert.equal(recovered.revision, 1);
  assert.deepEqual(await projects.readProject(original.project.id), original);
  return { dataRoot, projects, recovery, original, recovered, services, context };
}
function renderer(snapshot, saveProject, value = 'canonicalized') {
  const failures = [], nativeReceipts = [], requests = [], saveStates = [];
  const window = { sirenDesktopBootstrap: { mode: 'normal', snapshot }, sirenDesktop: { saveProject: async request => {
    requests.push(plain(request)); const result = await saveProject(request); nativeReceipts.push(plain(result)); return result;
  } } };
  const context = vm.createContext({ window, crypto: webcrypto, TextEncoder, saveAttemptSerial: 0, readOnlyMode: false, state: { source: value },
    STORAGE_KEY: workspaceKey, STORAGE_BACKUP_KEY: `${workspaceKey}-backup`, remoteWorkspaceValue: null,
    storageFullWarned: false, syncStateFromControls() {}, parseableWorkspaceRaw: raw => { try { JSON.parse(raw); return true; } catch { return false; } },
    setSaveState: (...args) => saveStates.push(args), showToast() {}, saveTimer: null, draftTimer: null, clearTimeout });
  vm.runInContext(storage, context);
  const store = window.createSirenDesktopStore({ workspaceKey });
  store.onWriteError((error, metadata) => failures.push({ message: error.message, ...plain(metadata) }));
  context.sirenStore = store;
  vm.runInContext(`${saveStateSource}\n${flushSource}`, context);
  return { window, context, store, failures, nativeReceipts, requests, saveStates };
}

test('diagnostic control: actual recovered-copy services and production flush acknowledge an initialization save', async () => {
  const f = await fixture(); const r = renderer(f.recovered, f.services.saveProject);
  await r.window.sirenDesktopRequestClose();
  const current = await f.projects.readProject(f.recovered.project.id);
  assert.equal(current.revision, 2);
  assert.equal(digest(Buffer.from(current.json)), current.sha256);
  assert.ok((await f.recovery.scan(current.project.id)).valid.some(point => point.kind === 'saved' && point.snapshot.json === current.json && point.snapshot.sha256 === current.sha256));
  assert.equal((await f.projects.listPending(current.project.id)).length, 0);
  assert.deepEqual(await f.projects.readProject(f.original.project.id), f.original);
});

test('verified partial workspace commit stays failed but next production save uses its exact revision', async () => {
  const f = await fixture();
  f.recovery.fault = async phase => { if (phase === 'checkpoint-verified') throw new Error('Owned synthetic checkpoint acknowledgement fault'); };
  const r = renderer(f.recovered, f.services.saveProject);
  await assert.rejects(r.window.sirenDesktopRequestClose(), /Save not acknowledged: failed/);
  assert.equal(r.nativeReceipts[0].code, 'RECOVERY_DEGRADED');
  assert.equal(r.failures[0].code, 'RECOVERY_DEGRADED');
  const flushed = await r.window.sirenDesktopFlush();
  assert.equal(flushed.ok, false);
  assert.equal(flushed.code, 'RECOVERY_DEGRADED', 'Flush receipt retains the typed refusal');
  const committed = await f.projects.readProject(f.recovered.project.id);
  assert.equal(committed.revision, 2, 'A failed combined receipt is not proof of an uncommitted workspace');
  assert.equal(committed.json, r.requests[0].json);
  assert.equal(digest(Buffer.from(committed.json)), committed.sha256);
  assert.equal(r.nativeReceipts[0].workspaceCommitted, true);
  assert.equal(r.nativeReceipts[0].committedRevision, 2);
  assert.equal(r.nativeReceipts[0].committedSha256, committed.sha256);
  assert.equal(r.nativeReceipts[0].checkpointAcknowledged, false);
  f.recovery.fault = async () => {};
  await r.window.sirenDesktopRequestClose();
  assert.equal(r.requests[1].baseRevision, 2, 'Only exact verified workspace commitment advances CAS');
  assert.equal(r.nativeReceipts[1].ok, true);
  const retried = await f.projects.readProject(committed.project.id);
  assert.deepEqual(retried, committed, 'Acknowledging an unchanged retry repairs recovery without rotating the last-good backup or advancing content CAS');
  assert.equal(retried.json, r.requests[1].json);
  assert.ok((await f.recovery.scan(retried.project.id)).valid.some(point => point.kind === 'saved' && point.snapshot.revision === 2 && point.snapshot.json === retried.json && point.snapshot.sha256 === retried.sha256));
  r.context.state.source = 'edited after recovery acknowledgement';
  await r.window.sirenDesktopRequestClose();
  assert.equal(r.requests[2].baseRevision, 2, 'A subsequent real edit uses the exact repaired workspace CAS');
  assert.equal(r.nativeReceipts[2].ok, true);
  const edited = await f.projects.readProject(committed.project.id);
  assert.equal(edited.revision, 3); assert.equal(edited.json, r.requests[2].json);
  assert.equal(JSON.parse(JSON.parse(edited.json).storage[workspaceKey]).source, 'edited after recovery acknowledgement');
  assert.equal((await f.projects.listPending(committed.project.id)).length, 1, 'Original degraded pending attempt remains recoverable');
  assert.deepEqual(await f.projects.readProject(f.original.project.id), f.original);
});

test('recovery writer contention remains an explicit refusal while a later exact-CAS save succeeds', async () => {
  const f = await fixture(); const blocked = gate();
  f.recovery.fault = async phase => { if (phase === 'checkpoint-verified') await blocked.pause(); };
  const otherCheckpoint = f.recovery.checkpointProject({ snapshot: f.original, kind: 'draft' });
  await blocked.entered;
  const r = renderer(f.recovered, f.services.saveProject);
  try {
    await assert.rejects(r.window.sirenDesktopRequestClose(), /Save not acknowledged: failed/);
    assert.equal(r.nativeReceipts[0].code, 'RECOVERY_DEGRADED');
    assert.equal(r.nativeReceipts[0].checkpointAcknowledged, false);
    assert.equal(r.nativeReceipts[0].recoveryCode, 'WRITER_BUSY');
    const current = await f.projects.readProject(f.recovered.project.id);
    assert.equal(current.revision, 2);
    assert.equal(current.json, r.requests[0].json);
    assert.equal((await f.recovery.scan(current.project.id)).valid.some(point => point.snapshot.revision === 2), false);
  } finally { blocked.release(); await otherCheckpoint; f.recovery.fault = async () => {}; }
  await r.window.sirenDesktopRequestClose();
  assert.equal(r.nativeReceipts[1].ok, true);
  assert.equal(r.requests[1].baseRevision, 2);
});

test('recovery selection drains an old operation before changing the selected bootstrap', async () => {
  const f = await fixture(); const blocked = gate();
  const originalRead = f.projects.readProject.bind(f.projects); let oldReads = 0;
  f.projects.readProject = async id => {
    // Genuine old save reads current for CAS, then for commit readback, then
    // the main service reads it for checkpointing. Pause only the third read.
    if (id === f.recovered.project.id && ++oldReads === 3) await blocked.pause();
    return originalRead(id);
  };
  const oldSave = f.services.saveProject({ projectId: f.recovered.project.id, baseRevision: 1, json: bag('old generation'), purpose: 'workspace' });
  await blocked.entered;
  const point = (await f.recovery.scan(f.original.project.id)).valid.find(point => point.kind === 'saved');
  let next, signal;
  const transitionEntered = new Promise(resolve => { signal = resolve; });
  f.context.window.webContents.executeJavaScript = async code => { if (code.includes('BeginAccountTransition')) signal('transition'); };
  const restoring = f.services.restoreRecovery(point.id);
  try {
    assert.equal(await Promise.race([transitionEntered, restoring.then(() => 'restored')]), 'transition', 'Transition must start before selecting');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.context.writes.size, 1);
    assert.equal(f.context.selectedId, f.recovered.project.id, 'Selection remains unchanged while old operation is pending');
    assert.equal(f.context.bootstrap.snapshot.project.id, f.recovered.project.id);
    const late = await f.services.saveProject({ projectId: f.recovered.project.id, baseRevision: 1, json: bag('late'), purpose: 'workspace' });
    assert.equal(late.ok, false); assert.equal(late.code, 'PROJECT_BUSY', 'Native barrier refuses new save starts after renderer quiescence');
  } finally { blocked.release(); }
  assert.equal((await oldSave).code, 'ACCESS_REFUSED', 'A deliberately non-draining synthetic renderer cannot acknowledge a revoked old operation');
  next = await restoring;
  assert.equal(f.context.selectedId, next.project.id);
  assert.equal(f.context.bootstrap.recoveryProjectId, next.project.id);
  assert.equal(f.context.bootstrap.snapshot.project.id, next.project.id);
  const selected = JSON.parse(await readFile(join(f.dataRoot, 'session-selection.json'), 'utf8'));
  assert.equal(selected.projectId, next.project.id);
  assert.deepEqual(await originalRead(next.project.id), next, 'This diagnostic proves bootstrap mismatch, not recovered pointer corruption');
});

test('old operation cannot publish into a later selection generation, even when the selected project ID matches', async () => {
  const f = await fixture(); const blocked = gate();
  const originalRead = f.projects.readProject.bind(f.projects); let reads = 0;
  f.projects.readProject = async id => {
    if (id === f.recovered.project.id && ++reads === 3) await blocked.pause();
    return originalRead(id);
  };
  const pending = f.services.saveProject({ projectId: f.recovered.project.id, baseRevision: 1, json: bag('old generation'), purpose: 'workspace' });
  await blocked.entered;
  try {
    // Directly exercise the actual selection helper to force a new generation
    // independent of the transition drain; production transitions also drain.
    await vm.runInContext('selected', f.context)(f.recovered);
  } finally { blocked.release(); }
  assert.equal((await pending).code, 'ACCESS_REFUSED');
  assert.deepEqual(plain(f.context.bootstrap.snapshot), f.recovered, 'Old completion must not replace this newly selected generation snapshot');
});

test('failed renderer flush leaves the current recovery selection usable and a later transition can retry', async () => {
  const f = await fixture(); const prior = await f.projects.readProject(f.recovered.project.id);
  const point = (await f.recovery.scan(f.original.project.id)).valid.find(point => point.kind === 'saved');
  const ended = [];
  f.context.window.webContents.executeJavaScript = async code => { if (code.includes('BeginAccountTransition')) throw new Error('Owned flush refusal'); ended.push(code); };
  await assert.rejects(f.services.restoreRecovery(point.id), /Owned flush refusal/);
  assert.equal(f.context.selectedId, f.recovered.project.id);
  assert.equal(f.context.bootstrap.snapshot.project.id, f.recovered.project.id);
  assert.deepEqual(await f.projects.readProject(f.recovered.project.id), prior);
  assert.equal(f.context.writes.selectionTransition, false); assert.equal(f.context.writes.selectionQuiesced, false);
  assert.ok(ended.some(code => code.includes('EndAccountTransition')));
  f.context.window.webContents.executeJavaScript = async () => {};
  const next = await f.services.restoreRecovery(point.id);
  assert.notEqual(next.project.id, f.recovered.project.id);
});
