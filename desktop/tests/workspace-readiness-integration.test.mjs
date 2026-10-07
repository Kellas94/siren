import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { runAfterWorkspaceLoad } from '../src/windows/readiness.mjs';
import { invokeDesktop, failure } from '../src/ipc.mjs';
const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const first = main.indexOf('  getPinState:'); const last = main.indexOf('  verifyCurrentPin:', first);
assert.ok(first >= 0 && last > first);
class Contents extends EventEmitter {
  loading = true;
  isDestroyed() { return false; }
  getURL() { return 'siren://app/app.html'; }
  isLoadingMainFrame() { return this.loading; }
}
function fixture() {
  const contents = new Contents(); const mutations = [];
  const context = vm.createContext({ window: { webContents: contents }, runAfterWorkspaceLoad:(contents,operation,options)=>runAfterWorkspaceLoad(contents,operation,structuredClone(options)), failure,
    prepareLocalWorkspace: async result => result,
    localPin: { state: () => ({ unlocked: false }), setup: async payload => { mutations.push(['setup', payload]); return { ok: true }; },
      unlock: async payload => { mutations.push(['unlock', payload]); return { ok: true }; } },
  });
  vm.runInContext(`let pinTransition = false; globalThis.busy = () => { pinTransition = true; }; globalThis.services = {${main.slice(first, last)}};`, context);
  return { context, contents, mutations };
}
for (const method of ['setupPin', 'unlockPin']) test(`actual ${method} waits for native load before mutation or successful ACK`, async () => {
  const { context, contents, mutations } = fixture();
  const payload = method === 'setupPin' ? { pin: '4826', confirmation: '4826' } : { pin: '4826' };
  const pending = invokeDesktop({ method, payload, context: { isMainFrame: true, senderUrl: contents.getURL() }, services: context.services, localAccess: context.localPin });
  await Promise.resolve(); assert.equal(mutations.length, 0);
  contents.loading = false; contents.emit('did-finish-load');
  assert.equal((await pending).ok, true); assert.deepEqual(mutations, [[method === 'setupPin' ? 'setup' : 'unlock', payload]]);
});
test('actual startup services refuse a new access transition while waiting and do not mutate on load failure', async () => {
  for (const failLoad of [false, true]) {
    const { context, contents, mutations } = fixture();
    const pending = invokeDesktop({ method: 'unlockPin', payload: { pin: '4826' },
      context: { isMainFrame: true, senderUrl: contents.getURL() }, services: context.services, localAccess: context.localPin });
    if (failLoad) contents.emit('did-fail-load', {}, -2, 'Fixture failure', contents.getURL(), true);
    else { context.busy(); contents.loading = false; contents.emit('did-finish-load'); }
    assert.equal((await pending).code, failLoad ? 'WORKSPACE_NOT_READY' : 'PIN_BUSY'); assert.equal(mutations.length, 0);
  }
});
