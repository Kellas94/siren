import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';

// Isolated synthetic failure routing. Real close succeeds before its sentinel
// rejection; this is not an OS close failure, leak test or historical EPERM.
async function instrument({ phase, closeFailure, unlinkFailure } = {}) {
  const calls = [], primary = Object.freeze(Object.assign(Error('primary'), { code: 'ACCESS_REFUSED' }));
  const closing = Object.freeze(Object.assign(Error('synthetic close rejection after real close'), { code: 'CLOSE_SENTINEL' }));
  const removing = Object.freeze(Object.assign(Error('synthetic unlink rejection before removal'), { code: 'UNLINK_SENTINEL' }));
  const bindings = { ...fs, open: async (...args) => {
    const handle = await fs.open(...args); calls.push('open');
    return {
      writeFile: async (...values) => { calls.push('write'); if (phase === 'write') throw primary; return handle.writeFile(...values); },
      sync: async () => { calls.push('sync'); if (phase === 'sync') throw primary; return handle.sync(); },
      close: async () => { calls.push('close'); await handle.close(); calls.push('real-close-complete'); if (closeFailure) throw closing; }
    };
  }, unlink: async path => {
    calls.push('unlink'); if (unlinkFailure) throw removing; return fs.unlink(path);
  } };
  const url = new URL('../src/projects/atomic.mjs', import.meta.url);
  const context = createContext({ Buffer, process, AggregateError });
  const module = new SourceTextModule(await fs.readFile(url, 'utf8'), { context, identifier: url.href });
  await module.link(async specifier => {
    const values = specifier === 'node:fs/promises' ? bindings : await import(new URL(specifier, url).href);
    return new SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { ...module.namespace, calls, primary, closing, removing };
}

async function fixture() {
  // Run with TEMP/TMP redirected to an owned retained evidence directory.
  const root = await fs.mkdtemp(join(tmpdir(), 'siren-atomic-cleanup-'));
  const path = join(root, 'selected.json'), before = Buffer.from('{"saved":"before"}\n');
  await fs.writeFile(path, before, { flag: 'wx' });
  return { root, path, before };
}
async function caught(action) {
  try { return { rejected: false, value: await action() }; }
  catch (error) { return { rejected: true, error }; }
}
function combined(actual, primary, cleanup) {
  assert.ok(actual instanceof AggregateError, 'both failures must remain inspectable');
  assert.equal(actual.cause, primary); assert.equal(actual.errors.length, 2);
  assert.equal(actual.errors[0], primary); assert.equal(actual.errors[1], cleanup);
}
async function preserved(f, { pending, bytes } = {}) {
  assert.deepEqual(await fs.readFile(f.path), f.before);
  const names = await fs.readdir(f.root), stages = names.filter(name => /^pending-.*\.tmp$/.test(name));
  assert.equal(stages.length, pending);
  if (pending && bytes !== undefined) assert.deepEqual(await fs.readFile(join(f.root, stages[0])), bytes);
  assert.deepEqual(names.filter(name => !stages.includes(name)), ['selected.json']);
}
const next = Buffer.from('{"saved":"after Ω"}\n');

test('successful atomic replacement retains exact readback and no pending file', async () => {
  const f = await fixture(), m = await instrument();
  assert.equal(await m.atomicWrite(f.path, next), m.digest(next));
  assert.deepEqual(await fs.readFile(f.path), next); assert.deepEqual(await fs.readdir(f.root), ['selected.json']);
  assert.deepEqual(m.calls, ['open', 'write', 'sync', 'close', 'real-close-complete']);
});
for (const phase of ['write', 'sync', 'before-flush', 'after-flush']) {
  for (const closeFailure of [false, true]) test(`atomic ${phase} with close failure ${closeFailure} retains primary`, async () => {
    const f = await fixture(), m = await instrument({ phase, closeFailure });
    const result = await caught(() => m.atomicWrite(f.path, next, { fault: async stage => { if (stage === phase) throw m.primary; } }));
    assert.equal(result.rejected, true);
    // File invariants checked before error oracle, including baseline RED cases.
    await preserved(f, { pending: 1, bytes: phase === 'write' ? Buffer.alloc(0) : next });
    assert.equal(m.calls.filter(x => x === 'real-close-complete').length, 1);
    if (closeFailure) { combined(result.error, m.primary, m.closing); assert.equal(result.error.code, 'ACCESS_REFUSED'); }
    else assert.equal(result.error, m.primary);
  });
}
test('atomic close-only failure retains identity and previous destination', async () => {
  const f = await fixture(), m = await instrument({ closeFailure: true });
  const result = await caught(() => m.atomicWrite(f.path, next));
  assert.equal(result.rejected, true); assert.equal(result.error, m.closing);
  await preserved(f, { pending: 1, bytes: next });
});
for (const primaryKind of ['null', 'undefined', 'throwing-code']) test(`atomic double failure handles ${primaryKind} primary`, async () => {
  const f = await fixture(), m = await instrument({ closeFailure: true });
  const primary = primaryKind === 'null' ? null : primaryKind === 'undefined' ? undefined : Object.freeze(Object.defineProperty(Error('primary getter'), 'code', { get() { throw Error('metadata trap'); } }));
  const result = await caught(() => m.atomicWrite(f.path, next, { fault: async stage => { if (stage === 'before-flush') throw primary; } }));
  assert.equal(result.rejected, true); await preserved(f, { pending: 1, bytes: next });
  combined(result.error, primary, m.closing); assert.equal(result.error.code, undefined);
});
for (const mode of ['best-effort', 'mandatory', 'mandatory-unlink-failure']) test(`atomic combined close failure ${mode} pending cleanup`, async () => {
  const f = await fixture(), m = await instrument({ phase: 'sync', closeFailure: true, unlinkFailure: mode.endsWith('unlink-failure') });
  const result = await caught(() => m.atomicWrite(f.path, next, { cleanupPending: mode === 'best-effort', requirePendingCleanup: mode.startsWith('mandatory') }));
  assert.equal(result.rejected, true);
  const failedRemoval = mode.endsWith('unlink-failure');
  await preserved(f, { pending: failedRemoval ? 1 : 0, bytes: next });
  assert.equal(m.calls.at(-1), 'unlink');
  if (failedRemoval) {
    assert.equal(result.error.code, 'PENDING_CLEANUP_FAILED');
    assert.equal(result.error.errors[1], m.removing); combined(result.error.errors[0], m.primary, m.closing);
  } else { combined(result.error, m.primary, m.closing); assert.equal(result.error.code, 'ACCESS_REFUSED'); }
});

for (const cleanup of ['close', 'unlink']) for (const bodyFails of [false, true]) test(`writer ${cleanup} failure and body failure ${bodyFails} retains lock and releases exclusion`, async () => {
  const f = await fixture(), m = await instrument({ closeFailure: cleanup === 'close', unlinkFailure: cleanup === 'unlink' });
  const lock = join(f.root, 'writer.lock'); let nested = false, lockBytes;
  const result = await caught(() => m.exclusiveWriter(f.root, async () => {
    lockBytes = await fs.readFile(lock);
    const blocked = await caught(() => m.exclusiveWriter(f.root, async () => { nested = true; }));
    assert.equal(blocked.rejected, true); assert.equal(blocked.error.code, 'WRITER_BUSY');
    if (bodyFails) throw m.primary; return 'BODY_OK';
  }));
  assert.equal(result.rejected, true); assert.equal(nested, false);
  assert.deepEqual(await fs.readFile(lock), lockBytes);
  const denied = await caught(() => m.exclusiveWriter(f.root, async () => { nested = true; }));
  assert.equal(denied.rejected, true); assert.equal(denied.error.code, 'WRITER_BUSY'); assert.equal(nested, false);
  const cleanupError = cleanup === 'close' ? m.closing : m.removing;
  if (bodyFails) { combined(result.error, m.primary, cleanupError); assert.equal(result.error.code, 'ACCESS_REFUSED'); }
  else assert.equal(result.error, cleanupError);
  // Move only the known owned lock; a second successful body demonstrates the
  // same module released activeWriters, even though synthetic cleanup still fails.
  await fs.rename(lock, join(f.root, 'retained-writer.lock'));
  let entered = false;
  const again = await caught(() => m.exclusiveWriter(f.root, async () => { entered = true; }));
  assert.equal(entered, true); assert.equal(again.rejected, true); assert.equal(again.error, cleanupError);
  assert.deepEqual(await fs.readFile(join(f.root, 'retained-writer.lock')), lockBytes);
  assert.deepEqual(await fs.readFile(f.path), f.before);
  assert.equal(m.calls.filter(x => x === 'real-close-complete').length, 2);
  assert.equal(m.calls.filter(x => x === 'unlink').length, cleanup === 'close' ? 0 : 2);
});
