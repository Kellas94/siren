import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { buildRenderer } from '../build/renderer.mjs';

const dir = await mkdtemp(join(tmpdir(), 'siren-close-drain-'));
await buildRenderer({ baselinePath: new URL('../baseline/R78.html', import.meta.url), outputDir: dir });
const html = await readFile(join(dir, 'app.html'), 'utf8');
const saveStart = html.indexOf('async function saveState() {');
const saveSource = html.slice(saveStart, html.indexOf('\n      function syncStateFromControls()', saveStart));
const closeStart = html.indexOf('window.sirenDesktopApplySafety =');
const closeSource = html.slice(closeStart, html.indexOf('let accountTransitionBodyState =', closeStart));
const storage = await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture({ failSecond = false, receiptHook = null } = {}) {
  const first = deferred(); const entered = deferred(); const requests = [];
  const window = { sirenDesktopBootstrap: { mode: 'normal', snapshot: { project: { id: 'owned' }, revision: 1, json: '{"kind":"siren-desktop","schema":1,"storage":{}}' } },
    sirenDesktop: { saveProject: async request => {
      requests.push(request); const index = requests.length;
      if (index === 1) { entered.resolve(); await first.promise; }
      const injected = await receiptHook?.(index);
      if (injected) return injected;
      return index === 2 && failSecond ? { ok: false, message: 'Late write failed' } : { ok: true, revision: index + 1, sha256: String(index).repeat(64) };
    } },
  };
  const context = vm.createContext({ window, clearTimeout, saveTimer: null, draftTimer: null,
    saveAttemptSerial: 0, readOnlyMode: false, state: { source: 'first edit' }, remoteWorkspaceValue: null,
    remoteWorkspaceRecoveryKey: '', remoteWorkspaceRecoveryWriteWarned: false, remoteWorkspaceConflictWarned: false,
    remoteWorkspaceConflictOfferShown: false, storageFullWarned: false, STORAGE_KEY: 'workspace', STORAGE_BACKUP_KEY: 'backup',
    parseableWorkspaceRaw: () => false, syncStateFromControls: () => {}, setSaveState: () => {}, showToast: () => {}, offerStorageConflictRecovery: () => {},
  });
  vm.runInContext(storage, context); context.sirenStore = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  vm.runInContext(saveSource + '\n' + closeSource, context);
  return { context, window, requests, first, entered };
}

test('close drains a newer queued save and acknowledges its exact bytes instead of rejecting supersession', async () => {
  const f = fixture();
  const closing = f.window.sirenDesktopRequestClose();
  // Retain the old close rejection immediately so the RED is not unhandled.
  const settled = closing.then(() => ({ ok: true }), error => ({ ok: false, message: error.message }));
  await f.entered.promise;
  f.context.state.source = 'newer edit while first native receipt is pending';
  const newer = vm.runInContext('saveState()', f.context);
  await new Promise(r => setImmediate(r)); f.first.resolve();
  assert.equal((await newer).status, 'confirmed');
  assert.deepEqual(await settled, { ok: true });
  assert.equal(f.requests.length, 2);
  assert.equal(JSON.parse(JSON.parse(f.requests.at(-1).json).storage.workspace).source, f.context.state.source);
  assert.equal((await f.window.sirenDesktopFlush()).ok, true);
});

for (const failLast of [false, true]) {
  test(`close waits for a newer workspace receipt queued during private recovery flush (${failLast ? 'failed' : 'confirmed'})`, async () => {
    const privateReceipt = deferred(), privateEntered = deferred(), lastReceipt = deferred(), lastEntered = deferred();
    const f = fixture({ receiptHook: async index => {
      if (index === 2) { privateEntered.resolve(); await privateReceipt.promise; }
      if (index === 3) { lastEntered.resolve(); await lastReceipt.promise; if (failLast) return { ok: false, message: 'Late workspace failure' }; }
    } });
    let finished = false;
    const closing = f.window.sirenDesktopRequestClose().then(() => { finished = true; return { ok: true }; }, error => { finished = true; return { ok: false, message: error.message }; });
    await f.entered.promise;
    const privateSave = f.context.sirenStore.set('private-code', 'private Python edit');
    f.first.resolve(); await privateEntered.promise;
    await new Promise(r => setImmediate(r));
    f.context.state.source = 'workspace edit while private recovery is pending';
    const newer = vm.runInContext('saveState()', f.context);
    await new Promise(r => setImmediate(r)); privateReceipt.resolve(); await lastEntered.promise;
    await new Promise(r => setImmediate(r));
    assert.equal(finished, false, 'Close cannot acknowledge an older private flush while the newer workspace receipt remains pending');
    lastReceipt.resolve();
    assert.equal((await newer).status, failLast ? 'failed' : 'confirmed');
    assert.equal((await privateSave).ok, true);
    const result = await closing;
    assert.equal(result.ok, !failLast);
    if (failLast) assert.match(result.message, /not acknowledged/);
    assert.equal(JSON.parse(JSON.parse(f.requests.at(-1).json).storage.workspace).source, f.context.state.source);
  });
}

test('close refuses a newer failed receipt even if its own earlier save succeeded', async () => {
  const f = fixture({ failSecond: true });
  const closing = f.window.sirenDesktopRequestClose();
  const settled = closing.then(() => null, error => error.message);
  await f.entered.promise; f.context.state.source = 'late attempted edit';
  const newer = vm.runInContext('saveState()', f.context);
  await new Promise(r => setImmediate(r)); f.first.resolve();
  assert.equal((await newer).status, 'failed');
  assert.match(await settled, /not acknowledged|Recovery not acknowledged/);
  assert.equal((await f.window.sirenDesktopFlush()).ok, false);
});
