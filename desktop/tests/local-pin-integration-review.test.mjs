// Legacy primary coordinator regression. Updated by the implementing coordinator;
// it is not a new independent approval of the native all-view transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdir, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdtemp } from './fixtures/temporary.mjs';
import { LocalPinAccess } from '../src/account/local-pin.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { atomicWrite } from '../src/projects/atomic.mjs';
import { invokeDesktop, failure } from '../src/ipc.mjs';
import {installPrimaryOwner} from './fixtures/primary-owner-context.mjs';

const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const builder = await readFile(new URL('../build/renderer.mjs', import.meta.url), 'utf8');
const between = (source, start, end) => {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Actual integration extraction markers must match');
  return source.slice(first, last);
};
const selection = between(main, 'const selected = async next => {', 'const exportBytes =');
const prepare = between(main, 'const prepareLocalWorkspace =', 'session.defaultSession');
const pinServices = between(main, '  getPinState:', '  requestClose:');
const saveService = between(main, '  saveProject:', '  exportProject:');
const factory = between(main, 'const projects = new ProjectStore(', '\nconst recovery =');
const transition = between(builder, 'let accountTransitionBodyState =', 'window.sirenDesktopStartOpening =');

// Explicit external OS-storage double; actual service scrypt and native IO are used.
function protectedStorage() {
  const key = randomBytes(32);
  return { isEncryptionAvailable: () => true,
    encryptString(text) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv); const b = Buffer.concat([c.update(text, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), b]); },
    decryptString(b) { const d = createDecipheriv('aes-256-gcm', key, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'); },
  };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'siren-pin-integration-review-'));
  const localPin = new LocalPinAccess(root, protectedStorage()); await localPin.initialize();
  return { root, localPin };
}
const owner = { isMainFrame: true, senderUrl: 'siren://app/app.html' };

test('PIN unlock creates no implicit project, and failed explicit durable selection cannot publish selected state', async () => {
  const { root, localPin } = await fixture();
  const context = vm.createContext({ join, Buffer, atomicWrite, failure, dataRoot: root, localPin,
    projects: new ProjectStore(root, { canSave: () => localPin.state().unlocked }),
    account: { accountId: null, policy: { opened() {} } },
  });
  vm.runInContext(`let selectedId=null,snapshot=null,mode='normal',reason=null,nativeReadonly=false;const grants=new Set();let bootstrap={snapshot:null,readonly:true};` + selection + prepare + ';globalThis.prepare=prepareLocalWorkspace;globalThis.select=selected;globalThis.view=()=>({selectedId,bootstrap,grants:[...grants]});', context);
  await mkdir(join(root, 'session-selection.json'));
  const setup = await context.prepare(await localPin.setup({ pin: '4826', confirmation: '4826' }));
  assert.equal(setup.ok, true); assert.equal(localPin.state().configured, true); assert.equal(localPin.state().unlocked, true);
  assert.equal(context.view().selectedId, null); assert.equal(context.view().bootstrap.snapshot, null); assert.equal(context.view().grants.length, 0);
  const next=await context.projects.createProject({label:'Explicit project',json:'{}'});
  await assert.rejects(context.select(next));assert.equal(context.view().selectedId,null);assert.equal(context.view().bootstrap.snapshot,null);assert.equal(context.view().grants.length,0);
  // Remove only this freshly created empty, test-owned hostile selector directory.
  await rmdir(join(root, 'session-selection.json'));
  await context.select(next);
  const view = context.view(); assert.ok(view.bootstrap.snapshot); assert.equal(view.bootstrap.readonly, false);
  const durable = JSON.parse(await readFile(join(root, 'session-selection.json'), 'utf8'));
  assert.equal(durable.projectId, view.selectedId); assert.equal(view.grants[0], durable.projectId);
});

test('locked IPC refuses all project bytes and mutations, while PIN unlock cannot override native readonly creation safety', async () => {
  const { root, localPin } = await fixture();
  let touched = false;
  for (const [method, payload] of [['exportProject', 'owned'], ['getRecovery', 'owned'], ['restoreRecovery', 'owned'], ['exportRecovery', 'owned'], ['pickProject'], ['exportDiagnostics'], ['getAccess'], ['beginLogin'], ['logout'], ['saveProject', { projectId: 'owned', baseRevision: 1, purpose: 'workspace', json: '{}' }]]) {
    const result = await invokeDesktop({ method, payload, context: owner, localAccess: localPin, services: { [method]: () => { touched = true; return { ok: true }; } } });
    assert.equal(result.code, 'PIN_REQUIRED');
  }
  assert.equal(touched, false);
  await localPin.setup({ pin: '4826', confirmation: '4826' });
  const context = vm.createContext({ ProjectStore, SourceRepository, dataRoot: root, writerOptions: {}, localPin, accountQuiesced: false, nativeReadonly: true, mode: 'readonly' });
  vm.runInContext(factory + ';globalThis.projects=projects;', context);
  await assert.rejects(context.projects.createProject({ label: 'Refused', json: '{}' }), /Activation required/);
  assert.equal(localPin.state().unlocked, true, 'PIN grant remains distinct from native startup safety');
});

for (const failWrite of [false, true]) test(`native PIN lock drains private recovery writes and ${failWrite ? 'resumes after rejected persistence' : 'grants lock only after durable ACK'}`, async () => {
  const { root, localPin } = await fixture(); await localPin.setup({ pin: '4826', confirmation: '4826' });
  const seed = new ProjectStore(root); const original = await seed.createProject({ label: 'Owned lock fixture', json: '{}' });
  let release, entered; const paused = new Promise(r => { entered = r; }); const gate = new Promise(r => { release = r; }); let first = true;
  const body = { inert: false, classList: { add() {}, remove() {} } };
  const context = vm.createContext({ ProjectStore, SourceRepository, localPin, failure, dataRoot: root, writerOptions: {
    fault: async stage => { if (stage === 'revision-verified' && first) { first = false; entered(); await gate; if (failWrite) throw new Error('Owned test persistence failure'); } },
  }, mode: 'normal', nativeReadonly: false, accountQuiesced: false, accountTransition: false, pinTransition: false,
    grants: new Set([original.project.id]), selectedId: original.project.id, snapshot: original, bootstrap: { mode: 'normal', snapshot: original, readonly: false },
    writes: new Set(), recovery: new RecoveryStore(root), document: { body }, window: {}, retireNativeViews: () => {},
  });
  const window = context.window;
  window.webContents = { executeJavaScript: async text => vm.runInContext(text, context) };
  vm.runInContext(factory + '\nconst services={\n' + pinServices + saveService + '\n};globalThis.services=services;', context);
  installPrimaryOwner(context);
  window.sirenDesktop = context.services; window.sirenDesktopBootstrap = context.bootstrap;
  vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), context);
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  // Explicit renderer close seam: actual transition and native storage queue are
  // exercised; full frozen-editor saveState is separately covered by close-drain.
  window.sirenDesktopRequestClose = async () => { const receipt = await window.sirenDesktopFlush(); if (receipt?.ok === false) throw new Error('Private write refused'); };
  vm.runInContext(transition, context);
  const draft = store.setWithBackup('workspace', '{}', 'siren-code-drafts-v1', 'owned private draft bytes'); await paused;
  const locking = context.services.lockPin();
  assert.equal(body.inert, true); assert.equal(localPin.state().unlocked, true, 'Pending private bytes must not be abandoned by early native lock');
  assert.equal((await context.services.unlockPin({ pin: '4826' })).code, 'PIN_BUSY');
  release(); const written = await draft; const result = await locking;
  if (failWrite) {
    assert.equal(written.ok, false); assert.equal(result.code, 'SAVE_FAILED'); assert.equal(localPin.state().unlocked, true);
    assert.equal(body.inert, false); assert.equal(window.sirenDesktopStorageLocked, false);
    assert.equal((await seed.readProject(original.project.id)).json, original.json);
  } else {
    assert.equal(written.ok, true); assert.equal(result.ok, true); assert.equal(localPin.state().unlocked, false);
    assert.equal(body.inert, true); assert.equal(window.sirenDesktopStorageLocked, true);
    const saved = JSON.parse((await seed.readProject(original.project.id)).json);
    assert.equal(saved.storage['siren-code-drafts-v1'], 'owned private draft bytes');
    assert.equal((await store.set('siren-code-drafts-v1', 'late bytes')).ok, false);
    assert.equal(store.get('siren-code-drafts-v1'), 'owned private draft bytes');
  }
});
