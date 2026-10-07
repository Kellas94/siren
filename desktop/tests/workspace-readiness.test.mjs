import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
const readiness = await import('../src/windows/readiness.mjs').catch(e => ({ missing: e.code }));
class Contents extends EventEmitter {
  loading = true; destroyed = false; url = 'siren://app/app.html';
  isLoadingMainFrame() { return this.loading; }
  isDestroyed() { return this.destroyed; }
  getURL() { return this.url; }
}
const api = () => { assert.equal(typeof readiness.runAfterWorkspaceLoad, 'function', 'Workspace load barrier is missing'); return readiness.runAfterWorkspaceLoad; };

test('PIN side effects and acknowledgement wait for the native main-frame load boundary', async () => {
  const run = api(); const wc = new Contents(); let calls = 0; let acknowledged = false;
  const pending = run(wc, async () => { calls++; return { ok: true }; }).then(r => { acknowledged = true; return r; });
  await Promise.resolve(); assert.equal(calls, 0); assert.equal(acknowledged, false);
  wc.loading = false; wc.emit('did-finish-load');
  assert.deepEqual(await pending, { ok: true }); assert.equal(calls, 1); assert.equal(acknowledged, true);
  for (const name of ['did-finish-load','did-fail-load','render-process-gone','destroyed']) assert.equal(wc.listenerCount(name), 0);
});

test('a loaded live workspace runs once without adding a delayed acknowledgement', async () => {
  const run = api(); const wc = new Contents(); wc.loading = false; let calls = 0;
  assert.deepEqual(await run(wc, () => { calls++; return { ok: true }; }), { ok: true }); assert.equal(calls, 1);
});

test('load failure, crash, destruction or navigation refuses before PIN mutation', async () => {
  const run = api();
  for (const event of ['did-fail-load','render-process-gone','destroyed','wrong-url']) {
    const wc = new Contents(); let calls = 0;
    const pending = run(wc, () => { calls++; });
    const rejection = assert.rejects(pending, e => e.code === 'WORKSPACE_NOT_READY');
    if (event === 'wrong-url') { wc.loading = false; wc.url = 'https://example.invalid/'; wc.emit('did-finish-load'); }
    else wc.emit(event, {}, -2, 'Owned synthetic load failed', wc.url, true);
    await rejection; assert.equal(calls, 0);
    for (const name of ['did-finish-load','did-fail-load','render-process-gone','destroyed']) assert.equal(wc.listenerCount(name), 0);
  }
});

test('readiness deadline refuses without changing the PIN and removes listeners', async () => {
  const run = api(); const wc = new Contents(); let calls = 0;
  await assert.rejects(run(wc, () => { calls++; }, { timeoutMs: 10 }), e => e.code === 'WORKSPACE_NOT_READY');
  assert.equal(calls, 0); assert.equal(wc.listenerCount('did-finish-load'), 0);
});

test('a main-frame recheck closes the event-subscription race and failed native identity refuses', async () => {
  const run = api(); const wc = new Contents(); let reads = 0;
  wc.isLoadingMainFrame = () => ++reads === 1;
  assert.equal(await run(wc, () => 'ack'), 'ack');
  for (const key of ['isLoadingMainFrame','isDestroyed','getURL']) {
    const bad = new Contents(); bad[key] = () => { throw new Error('Unavailable native state'); };
    await assert.rejects(run(bad, () => { assert.fail('Must not mutate'); }), e => e.code === 'WORKSPACE_NOT_READY');
  }
});

test('renderer loss or fresh navigation after finish but before continuation still refuses PIN mutation', async () => {
  const run = api();
  for (const event of ['render-process-gone', 'did-fail-load', 'did-start-navigation']) {
    const wc = new Contents(); let calls = 0;
    const pending = run(wc, () => { calls++; });
    const rejected = assert.rejects(pending, e => e.code === 'WORKSPACE_NOT_READY');
    wc.loading = false; wc.emit('did-finish-load');
    wc.emit(event, { isMainFrame: true });
    await rejected; assert.equal(calls, 0); assert.equal(wc.eventNames().length, 0);
  }
});

test('native did-finish-load can precede the end of main-frame loading; stop event completes the gate', async () => {
  const run = api(); const wc = new Contents(); let calls = 0;
  const pending = run(wc, () => { calls++; return 'ack'; }, { timeoutMs: 30 });
  wc.emit('did-finish-load'); await Promise.resolve(); assert.equal(calls, 0);
  wc.loading = false; wc.emit('did-stop-loading');
  assert.equal(await pending, 'ack'); assert.equal(calls, 1); assert.equal(wc.eventNames().length, 0);
});
