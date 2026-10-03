import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRenderer } from '../build/renderer.mjs';

test('read-only legacy cache cleanup cannot mutate its mirror, issue schema-1 writes or poison a later Lock drain',async()=>{
  const calls=[],window={sirenDesktopBootstrap:{readonly:true,snapshot:{schema:2,project:{id:'owned'},revision:2,json:'{"source":"unchanged"}'}},sirenDesktop:{saveProject:async payload=>{calls.push(payload);return {ok:false,code:'SOURCE_WORKSPACE_REQUIRED',message:'Schema 2 cannot use whole-envelope saves'};}}};
  vm.runInNewContext(await readFile(new URL('../src/ui/storage.js',import.meta.url),'utf8'),{window});
  const store=window.createSirenDesktopStore({workspaceKey:'workspace'}),original=store.get('workspace'),initialFlush=window.sirenDesktopFlush();
  for(const operation of [()=>store.set('workspace','wrong'),()=>store.setWithBackup('workspace','wrong','backup','wrong'),()=>store.remove('workspace')]){
    const receipt=await operation();assert.equal(receipt.ok,false);assert.equal(receipt.code,'READ_ONLY');
    assert.equal(store.get('workspace'),original);assert.equal(store.get('backup'),null);
    assert.equal(window.sirenDesktopFlush(),initialFlush);
  }
  assert.equal(calls.length,0);assert.notEqual((await window.sirenDesktopFlush())?.ok,false);
});

test('native adapter retains typed refusal and bounded commit receipt fields without reporting success', async () => {
  const native = { ok: false, code: 'RECOVERY_DEGRADED', message: 'Checkpoint was not acknowledged',
    revision: 2, sha256: 'a'.repeat(64), committedRevision: 2, committedSha256: 'a'.repeat(64), workspaceCommitted: true,
    json: 'private synthetic workspace', pin: 'synthetic private field' };
  const window = { sirenDesktopBootstrap: { snapshot: { project: { id: 'owned-project' }, revision: 1, json: '{}' } },
    sirenDesktop: { saveProject: async () => native } };
  vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), vm.createContext({ window }));
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  const receipt = await store.set('workspace', 'owned pending text');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.code, native.code);
  assert.equal(receipt.error.code, native.code);
  assert.equal(receipt.revision, native.revision);
  assert.equal(receipt.sha256, native.sha256);
  assert.equal(receipt.committedRevision, native.committedRevision);
  assert.equal(receipt.committedSha256, native.committedSha256);
  assert.equal(receipt.workspaceCommitted, true);
  assert.equal(receipt.json, undefined);
  assert.equal(receipt.pin, undefined);
  assert.equal(await window.sirenDesktopFlush(), receipt);
});

test('native refusal diagnostics keep CAS and reject malformed receipt metadata', async () => {
  const requests = [];
  const window = { sirenDesktopBootstrap: { snapshot: { project: { id: 'owned-project' }, revision: 1, json: '{}' } },
    sirenDesktop: { saveProject: async request => {
      requests.push(request);
      return { ok: false, code: requests.length === 1 ? 'ACCESS_REFUSED' : 'REVISION_CONFLICT', message: 'Owned refusal',
        revision: -1, committedRevision: '2', sha256: 'workspace text', committedSha256: 'b'.repeat(63), workspaceCommitted: 'true' };
    } } };
  vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), vm.createContext({ window }));
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  for (const code of ['ACCESS_REFUSED', 'REVISION_CONFLICT']) {
    const receipt = await store.set('workspace', 'retained synthetic attempt');
    assert.equal(receipt.ok, false); assert.equal(receipt.code, code);
    for (const key of ['revision', 'sha256', 'committedRevision', 'committedSha256', 'workspaceCommitted']) assert.equal(receipt[key], undefined);
  }
  assert.deepEqual(requests.map(request => request.baseRevision), [1, 1], 'Receipt diagnostics do not advance failed writes');
});

test('adapter reconciles only a degraded exact workspace bag with the immediate next committed revision', async () => {
  for (const variant of ['exact', 'wrong-hash', 'wrong-revision', 'generic-refusal', 'draft', 'unavailable-hash']) {
    const requests = [];
    const window = { sirenDesktopBootstrap: { snapshot: { project: { id: 'owned-project' }, revision: 1, json: '{}' } },
      sirenDesktop: { saveProject: async request => {
        requests.push(request);
        return { ok: false, code: variant === 'generic-refusal' ? 'SAVE_FAILED' : 'RECOVERY_DEGRADED', message: 'Owned degraded receipt',
          workspaceCommitted: true, committedRevision: variant === 'wrong-revision' ? 7 : 2,
          committedSha256: variant === 'wrong-hash' ? 'a'.repeat(64) : createHash('sha256').update(Buffer.from(request.json)).digest('hex'), checkpointAcknowledged: false };
      } } };
    vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), vm.createContext({ window, TextEncoder, crypto: variant === 'unavailable-hash' ? {} : webcrypto }));
    const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
    const first = await store.set(variant === 'draft' ? 'private-draft' : 'workspace', 'Ω😀 exact bytes');
    assert.equal(first.ok, false, variant);
    assert.equal(first.checkpointAcknowledged, false, variant);
    await store.set('workspace', 'next attempt');
    assert.equal(requests[1].baseRevision, variant === 'exact' ? 2 : 1, variant);
  }
});

test('private Code recovery waits for a native receipt and never labels rejected writes stored', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'siren-renderer-receipt-'));
  await buildRenderer({ baselinePath: new URL('../baseline/R78.html', import.meta.url), outputDir });
  const html = await readFile(join(outputDir, 'app.html'), 'utf8');
  const snippet = html.slice(html.indexOf('function createCodeDrafts(storage={}){'), html.indexOf('\nfunction codeLines(text)'));
  const storageSource = await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8');
  const receipts = []; let updates = 0;
  const window = { sirenDesktopBootstrap: { snapshot: { project: { id: 'owned-project' }, revision: 1, json: '{}' } }, sirenDesktop: { saveProject: () => new Promise(resolve => receipts.push(resolve)) } };
  const context = vm.createContext({ window, TextEncoder, structuredClone, codeSourceKey: () => '' });
  vm.runInContext(storageSource + '\n' + snippet, context);
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  const drafts = context.createCodeDrafts({ read: () => store.get('siren-code-drafts-v1'), write: value => store.set('siren-code-drafts-v1', value), onStatus: () => { updates++; } });
  const draft = drafts.create(null, 'print("pending")', 'Receipt.py'); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'pending', 'An unacknowledged asynchronous write is not stored');
  receipts.shift()({ ok: false, message: 'Disk failed' }); await window.sirenDesktopFlush(); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'failed'); assert.ok(updates > 0);
  drafts.edit(draft.id, 'print("acknowledged")'); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'pending');
  receipts.shift()({ ok: true, revision: 1, sha256: 'a'.repeat(64) }); await window.sirenDesktopFlush(); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'stored');
  drafts.edit(draft.id, 'print("older pending")'); await new Promise(r => setImmediate(r));
  drafts.edit(draft.id, 'print("newer pending")');
  receipts.shift()({ ok: true, revision: 1, sha256: 'b'.repeat(64) }); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'pending', 'Older acknowledgement must not label newer text stored');
  receipts.shift()({ ok: false, message: 'Newer write failed' }); await window.sirenDesktopFlush(); await new Promise(r => setImmediate(r));
  assert.equal(draft.recovery, 'failed');
});

test('account-transition storage lock retains the acknowledged mirror and a failed flush is not hidden', async () => {
  const window = { sirenDesktopBootstrap: { snapshot: { project: { id: 'owned-project' }, revision: 1, json: '{}' } },
    sirenDesktop: { saveProject: async () => { throw new Error('Native save disconnected'); } } };
  vm.runInContext(await readFile(new URL('../src/ui/storage.js', import.meta.url), 'utf8'), vm.createContext({ window }));
  const store = window.createSirenDesktopStore({ workspaceKey: 'workspace' });
  await assert.rejects(store.set('workspace', 'pending'), /disconnected/);
  assert.equal((await window.sirenDesktopFlush())?.ok, false);
  window.sirenDesktopStorageLocked = true;
  const result = await store.set('workspace', 'discarded edit');
  assert.equal(result.ok, false); assert.equal(store.get('workspace'), 'pending');
  await store.remove('workspace'); assert.equal(store.get('workspace'), 'pending');
  await store.setWithBackup('workspace', 'discarded', 'backup', 'discarded'); assert.equal(store.get('backup'), null);
});

test('built renderer freezes final account commit, drains writes, and safely resumes after a failed flush', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'siren-renderer-transition-'));
  await buildRenderer({ baselinePath: new URL('../baseline/R78.html', import.meta.url), outputDir });
  const html = await readFile(join(outputDir, 'app.html'), 'utf8');
  const start = html.indexOf('let accountTransitionBodyState =');
  assert.ok(start > 0, 'A native commit requires an explicit renderer transition guard');
  const snippet = html.slice(start, html.indexOf('\n        if (window.sirenDesktopBootstrap?.mode', start));
  let release; const pending = new Promise(resolve => { release = resolve; });
  const body = { inert: false, classList: { add() {}, remove() {} } };
  const window = { sirenDesktopRequestClose: async () => pending };
  const context = vm.createContext({ window, document: { body } }); vm.runInContext(snippet, context);
  const transition = window.sirenDesktopBeginAccountTransition(); assert.equal(body.inert, true);
  assert.equal(window.sirenDesktopStorageLocked, undefined); release(); await transition;
  assert.equal(window.sirenDesktopStorageLocked, true); assert.equal(body.inert, true);
  window.sirenDesktopEndAccountTransition(); assert.equal(body.inert, false); assert.equal(window.sirenDesktopStorageLocked, false);
  window.sirenDesktopRequestClose = async () => { throw new Error('Recovery write failed'); };
  await assert.rejects(window.sirenDesktopBeginAccountTransition(), /failed/);
  assert.equal(body.inert, false); assert.equal(window.sirenDesktopStorageLocked, false);
  const saveStart = html.indexOf('async function saveState() {');
  const saveSource = html.slice(saveStart, html.indexOf('\n      function syncStateFromControls()', saveStart));
  const paused = vm.createContext({ window: { sirenDesktopStorageLocked: true }, saveAttemptSerial: 0, readOnlyMode: false,
    syncStateFromControls: () => { throw new Error('A paused callback must not touch live state'); } });
  vm.runInContext(saveSource, paused);
  assert.equal((await vm.runInContext('saveState()', paused)).status, 'read-only');
});
