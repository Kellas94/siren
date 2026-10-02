import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { AccessPolicy } from '../src/account/access.mjs';
import { failure } from '../src/ipc.mjs';

const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const between = (start, end) => main.slice(main.indexOf(start), main.indexOf(end));
const factory = between('const projects = new ProjectStore(', '\nconst recovery =');
const save = between('  saveProject: async request => {', '\n  exportProject:');
const login = between('  beginLogin: async () => {', '\n  logout:');
const readiness = between('let readyRecorded = false;', "\nipcMain.handle('siren:desktop'");
const selection = between('const selected = async next => {', '\nconst exportBytes =');

for (const scenario of [{ packaged: true, mode: 'readonly' }, { packaged: false, mode: 'normal', failReady: true }, { packaged: true, mode: 'normal', failReady: true }]) {
  test(`native safety refuses original writes: ${JSON.stringify(scenario)}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'siren-native-safety-')); const seed = new ProjectStore(root);
    const original = await seed.createProject({ label: 'Original', json: '{"source":"unchanged"}' });
    const policy = new AccessPolicy({ state: 'offline', recoveryOnly: false }); policy.opened(original.project.id);
    let listener; const notices = []; const webContents = { mainFrame: { url: 'siren://app/app.html' }, send: (...args) => notices.push(args) };
    const context = vm.createContext({ ProjectStore, dataRoot: root, writerOptions: {}, app: { isPackaged: scenario.packaged, getVersion: () => 'fixture' },
      mode: scenario.mode, nativeReadonly: scenario.mode === 'readonly', reason: null, accountQuiesced: false,
      account: { policy, canPerform: request => policy.canPerform(request) }, grants: new Set([original.project.id]),
      recovery: new RecoveryStore(root), writes: new Set(), snapshot: original, bootstrap: { mode: scenario.mode, snapshot: original, readonly: scenario.mode !== 'normal' }, failure,
      ipcMain: { on: (_name, callback) => { listener = callback; } }, window: { webContents, isDestroyed: () => false },
      processIdentity: { pid: process.pid }, sessionId: 'fixture', journal: { recordSession: async () => { throw new Error('Readiness journal unavailable'); } },
    });
    vm.runInContext(factory + '\nconst services = {\n' + save + '\n};\n' + readiness, context);
    if (scenario.failReady) await listener({ sender: webContents, senderFrame: webContents.mainFrame });
    const result = await vm.runInContext('services', context).saveProject({ projectId: original.project.id, baseRevision: 1, purpose: 'workspace', json: '{"source":"forbidden"}' });
    assert.equal(result.ok, false, 'An active account cannot override native safety');
    assert.equal((await seed.readProject(original.project.id)).json, original.json);
    assert.equal((await seed.readProject(original.project.id)).revision, 1);
    if (scenario.failReady) { assert.equal(vm.runInContext('mode', context), 'readonly'); assert.equal(notices[0]?.[1]?.kind, 'safety'); }
    const recovered = await vm.runInContext('projects', context).createProject({ label: 'Recovered copy', purpose: 'recovery', json: original.json });
    assert.notEqual(recovered.project.id, original.project.id, 'Explicit new-copy recovery remains available');
    context.atomicWrite = async () => {}; context.join = join; context.Buffer = Buffer; context.dataRoot = root;
    vm.runInContext(selection, context); await vm.runInContext('selected', context)(recovered);
    assert.equal(vm.runInContext('bootstrap.readonly', context), true, 'Selecting a copy cannot reset native safety');
  });
}

test('successful login preserves edits queued during the browser round trip before clearing grants or reloading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-login-transition-')); const seed = new ProjectStore(root);
  const original = await seed.createProject({ label: 'Account switch', json: '{}' });
  let releaseFirst, firstEntered, finishLogin, switched = false, reloaded = false;
  const entered = new Promise(resolve => { firstEntered = resolve; }); const browser = new Promise(resolve => { finishLogin = resolve; });
  let pause = true;
  const context = vm.createContext({ selectedId: original.project.id, snapshot: original, grants: new Set([original.project.id]),
    mode: 'normal', nativeReadonly: false, reason: null, accountTransition: false, accountQuiesced: false,
    bootstrap: { mode: 'normal', snapshot: original, readonly: false }, failure,
    account: { beginLogin: async ({ beforeCommit } = {}) => { await browser; await beforeCommit?.(); switched = true; return { state: 'online', recoveryOnly: false }; } },
    projects: new ProjectStore(root, { fault: async stage => { if (stage === 'revision-verified' && pause) { pause = false; firstEntered(); await new Promise(resolve => { releaseFirst = resolve; }); } } }),
    recovery: new RecoveryStore(root), writes: new Set(), window: { webContents: { executeJavaScript: async code => vm.runInContext(code, context) } },
    location: { reload: () => { reloaded = true; } }, message: () => {},
  });
  vm.runInContext('const services = {\n' + login + '\n' + save + '\n};', context);
  const window = context.window; window.sirenDesktopBootstrap = { snapshot: original }; window.sirenDesktop = vm.runInContext('services', context); context.bridge = window.sirenDesktop;
  vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), context);
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  window.sirenDesktopBeginAccountTransition = async () => { const result = await window.sirenDesktopFlush(); if (result?.ok === false) throw new Error('Save failed'); };
  window.sirenDesktopEndAccountTransition = () => {};
  const ui = await readFile(new URL('../src/ui/desktop.js', import.meta.url), 'utf8');
  const callbackMatch = ui.match(/'desktopAccessOnline', 'Activate online', (async \(\) => \{[\s\S]*?\n    \})\);/);
  assert.ok(callbackMatch, 'Exercise the access screen actual native activation handler');
  const callback = callbackMatch[1];
  context.pin = { value: '' }; context.state = { textContent: '' };
  context.document = { getElementById: () => ({ disabled: false, isConnected: true }) };
  const first = store.set('workspace', 'older'); await entered;
  const signingIn = vm.runInContext('(' + callback + ')()', context);
  const newer = store.set('workspace', 'newer during browser login'); finishLogin();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(switched, false); assert.equal(reloaded, false); assert.equal(context.grants.has(original.project.id), true);
  releaseFirst(); assert.equal((await first).ok, true); assert.equal((await newer).ok, true); await signingIn;
  assert.equal(switched, true); assert.equal(reloaded, true); assert.equal(context.grants.size, 0);
  assert.equal(JSON.parse((await seed.readProject(original.project.id)).json).storage.workspace, 'newer during browser login');
});

test('failed account-transition flush retains original authority and does not reload', async () => {
  let switched = false; const originalGrant = 'owned';
  const context = vm.createContext({ grants: new Set([originalGrant]), selectedId: originalGrant, snapshot: {}, mode: 'normal', nativeReadonly: false, reason: null,
    bootstrap: {}, accountTransition: false, accountQuiesced: false, writes: new Set(), failure,
    account: { beginLogin: async ({ beforeCommit } = {}) => { try { await beforeCommit?.(); switched = true; return { state: 'online' }; } catch { return failure('LOGIN_FAILED', 'Save refused'); } } },
    window: { webContents: { executeJavaScript: async code => vm.runInContext(code, context) }, sirenDesktopBeginAccountTransition: async () => { throw new Error('Disk full'); }, sirenDesktopEndAccountTransition: () => {} },
  });
  vm.runInContext('const services = {\n' + login + '\n};', context);
  const result = await vm.runInContext('services', context).beginLogin();
  assert.equal(result.ok, false); assert.equal(switched, false); assert.equal(context.grants.has(originalGrant), true);
  assert.equal(vm.runInContext('accountTransition', context), false);
});
