import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/ui/code/source-changes.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const timers = new Map(), notices = [], gates = [], calls = [];
  let next = 0, subscriber, sourceId = 'source-a', visible = true, disposed = false;
  let state = { ready: true, readonly: false, opening: false, dirty: false, pending: 0, saving: false, fenced: false,
    sourceRef: { sourceId, version: 1, sha256: 'a'.repeat(64) } };
  const window = {};
  runInNewContext(source, { window, setTimeout(fn, ms) { assert.equal(ms, 250); const id = ++next; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); } });
  const queue = window.SirenNativeSourceChanges.create({
    subscribe: fn => { subscriber = fn; return () => { disposed = true; }; },
    sourceIdFor: () => sourceId, stateFor: () => state, isCurrent: () => visible,
    onReload: () => { const gate = deferred(); gates.push(gate); calls.push(sourceId); return gate.promise; },
    onRetained: ref => notices.push({ ...ref }), onClear() {}
  });
  return { queue, gates, notices, calls, state: () => state, emit: version => subscriber({ sourceId, version, sha256: 'b'.repeat(64) }),
    fire() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); },
    pause() { visible = false; queue.pause(); }, resume() { visible = true; queue.resume(); },
    changeSource() { queue.reset(); sourceId = 'source-b'; state = { ...state, sourceRef: { sourceId, version: 1, sha256: 'c'.repeat(64) } }; },
    timerCount: () => timers.size, isDisposed: () => disposed };
}

test('control: ordinary held refresh refusal retains the exact known newer source notification', async () => {
  const f = fixture(); f.emit(2); f.fire(); assert.deepEqual(f.calls, ['source-a']);
  f.gates[0].resolve(false); await tick();
  assert.equal(f.notices.length, 1); assert.equal(f.notices[0].version, 2); assert.equal(f.notices[0].sourceId, 'source-a');
  f.queue.dispose();
});

for (const settlement of ['while-paused', 'after-resume']) test('known newer source notification survives pause/resume and held reload refusal '+settlement, async () => {
  const f = fixture(); f.emit(2); f.fire(); f.pause();
  if (settlement === 'after-resume') f.resume();
  f.gates[0].resolve(false); await tick();
  if (settlement === 'while-paused') f.resume();
  // A valid retained notification can either be presented or schedule a fresh
  // retry after resume. Silently forgetting version 2 satisfies neither.
  assert.ok(f.notices.some(ref => ref.sourceId === 'source-a' && ref.version === 2) || f.timerCount() > 0,
    'newer known source version must remain visible or queued after old refresh was cancelled');
  f.queue.dispose();
});

test('control: pause before timer firing retains pending refresh for resume', () => {
  const f = fixture(); f.emit(2); f.pause(); assert.equal(f.timerCount(), 0); f.resume(); assert.equal(f.timerCount(), 1);
  f.queue.dispose();
});

for (const retirement of ['reset', 'dispose']) test('control: old held refresh cannot restore into '+retirement+' lifetime', async () => {
  const f = fixture(); f.emit(2); f.fire(); f.pause();
  if (retirement === 'reset') { f.changeSource(); f.resume(); } else f.queue.dispose();
  f.gates[0].resolve(false); await tick();
  assert.equal(f.notices.length, 0); assert.equal(f.timerCount(), 0); assert.deepEqual(f.calls, ['source-a']);
  if (retirement === 'dispose') assert.equal(f.isDisposed(), true); else f.queue.dispose();
});

test('resumed dirty source retains the interrupted notification without another automatic reload', async () => {
  const f = fixture(); f.emit(2); f.fire(); f.pause();
  f.state().dirty = true; f.resume(); f.gates[0].resolve(false); await tick();
  assert.deepEqual(f.calls, ['source-a']); assert.equal(f.timerCount(), 0);
  assert.equal(f.notices.at(-1).version, 2); assert.equal(f.state().dirty, true);
  f.queue.dispose();
});

test('successful older refresh does not erase a newer notification received while it was held', async () => {
  const f = fixture(); f.emit(2); f.fire(); f.emit(3);
  f.state().sourceRef.version = 2; f.gates[0].resolve(true); await tick();
  assert.equal(f.timerCount(), 1); f.fire(); assert.equal(f.calls.length, 2);
  f.state().sourceRef.version = 3; f.gates[1].resolve(true); await tick();
  assert.equal(f.timerCount(), 0); assert.equal(f.notices.length, 0);
  f.queue.dispose();
});

test('interrupted successful refresh already installed by resume does not schedule a duplicate reload', async () => {
  const f = fixture(); f.emit(2); f.fire(); f.pause();
  f.state().sourceRef.version = 2; f.resume(); f.gates[0].resolve(true); await tick();
  assert.equal(f.timerCount(), 0); assert.equal(f.notices.length, 0);
  assert.deepEqual(f.calls, ['source-a']); f.queue.dispose();
});
