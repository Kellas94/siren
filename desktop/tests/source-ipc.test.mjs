import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { WindowRegistry } from '../src/windows/registry.mjs';
import { exclusiveWriter } from '../src/projects/atomic.mjs';

const contract = await import('../src/sources/ipc.mjs').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
  return {};
});
const invoke = options => {
  assert.equal(typeof contract.invokeSource, 'function', 'Sources IPC contract must exist');
  return contract.invokeSource(options);
};
class NativeWindow extends EventEmitter {
  constructor(id, url) {
    super(); this.id = id; this.destroyed = false;
    this.webContents = new EventEmitter();
    Object.assign(this.webContents, { id: id + 1000, mainFrame: { url },
      isDestroyed: () => this.destroyed, getURL: () => this.webContents.mainFrame.url });
  }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return false; }
  restore() {}
  focus() {}
  close() { this.destroy(); }
  destroy() { this.destroyed = true; this.webContents.emit('destroyed'); this.emit('closed'); }
}
async function fixture(t, { text = 'a😀b\r\nc', role = 'workspace', readonly = false } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-source-ipc-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new ProjectStore(root);
  const project = await store.createProject({ label: 'Synthetic IPC', json: '{}' });
  const projectId = project.project.id;
  const seed = new SourceRepository(root);
  const ref = await seed.importSource({ projectId, bytes: Buffer.from(text),
    provenance: { documentId: 'private-document', path: 'private-native-path', text: 'private-provenance' } });
  const native = { projectId, mode: readonly ? 'readonly' : 'normal', access: readonly ? 'read' : 'write', entityIds: [ref.sourceId] };
  const windows = [];
  const registry = new WindowRegistry({ authorize: () => native, createWindow: options => {
    const w = new NativeWindow(windows.length + 1, options.mainFrameUrl); windows.push(w); return w;
  } });
  await registry.openView({ role, entityId: role === 'workspace' ? null : ref.sourceId });
  const owner = windows[0]; const event = { sender: owner.webContents, senderFrame: owner.webContents.mainFrame };
  let locked = false; let calls = 0; let options = {};
  const access = (grant, request) => !locked && grant.projectId === projectId && native.entityIds.includes(request.sourceId)
    && (request.action === 'read' || native.mode === 'normal' && native.access === 'write');
  const repositoryFactory = ({ grant, canWrite }) => {
    calls++; assert.equal(grant.projectId, projectId); assert.ok(Object.isFrozen(grant));
    return new SourceRepository(root, { ...options, canWrite });
  };
  const call = (method, payload, overrides = {}) => invoke({ event, method, payload, registry, access, repositoryFactory, ...overrides });
  return { root, projectId, ref, seed, store, native, owner, event, registry, access, repositoryFactory, call,
    count: () => calls, lock: () => { locked = true; }, configure: value => { options = value; } };
}
const edit = (f, extra = {}) => ({ sourceId: f.ref.sourceId, operationId: 'edit-one', expectedVersion: 1, start: 3, end: 3, insertedText: 'Ș', ...extra });
const refused = (result, code = 'ACCESS_REFUSED') => { assert.equal(result.ok, false); assert.equal(result.code, code); };

test('strict data-only payloads and only four methods reject before repository dispatch', async t => {
  const f = await fixture(t); const valid = { sourceId: f.ref.sourceId };
  const getter = Object.defineProperty({}, 'sourceId', { enumerable: true, get() { throw Error('getter executed'); } });
  const hidden = Object.defineProperty({ ...valid }, 'path', { value: 'private', enumerable: false });
  const symbol = { ...valid, [Symbol('native')]: true };
  const invalid = [null, [], Object.create({ sourceId: f.ref.sourceId }), getter, hidden, symbol,
    { ...valid, projectId: f.projectId }, { ...valid, path: 'C:/private' }, { ...valid, role: 'workspace' },
    { ...valid, epoch: 1 }, { ...valid, version: undefined }, { sourceId: '../escape' }];
  for (const payload of invalid) refused(await f.call('getMetrics', payload), 'REQUEST_REFUSED');
  for (const method of ['exportSource', 'readVerifiedVersion', 'importSource', '__proto__', 'toString', null]) refused(await f.call(method, valid), 'REQUEST_REFUSED');
  assert.equal(f.count(), 0);
  assert.equal((await f.call('getMetrics', Object.assign(Object.create(null), valid))).ok, true);
});

test('native registry authority fences forged senders, subframes, wrong source, roles, epoch and locked access', async t => {
  const f = await fixture(t);
  for (const event of [{ sender: {}, senderFrame: f.event.senderFrame }, { sender: f.event.sender, senderFrame: { url: f.event.senderFrame.url } }]) {
    refused(await f.call('getMetrics', { sourceId: f.ref.sourceId }, { event }));
  }
  refused(await f.call('getMetrics', { sourceId: 'another-source' }));
  const docs = await fixture(t, { role: 'docs' }); refused(await docs.call('getMetrics', { sourceId: docs.ref.sourceId }));
  f.lock(); refused(await f.call('getMetrics', { sourceId: f.ref.sourceId })); assert.equal(f.count(), 0);
  const stale = await fixture(t); stale.registry.invalidateEpoch(); refused(await stale.call('getMetrics', { sourceId: stale.ref.sourceId }));
  const moved = await fixture(t); moved.owner.webContents.mainFrame.url = 'siren://app/other.html';
  refused(await moved.call('getMetrics', { sourceId: moved.ref.sourceId }));
});

test('readonly Code can read bounded immutable versions; metadata and read receipts expose no provenance', async t => {
  const f = await fixture(t, { role: 'code', readonly: true });
  const metrics = await f.call('getMetrics', { sourceId: f.ref.sourceId, version: 1 });
  assert.deepEqual(Object.keys(metrics).sort(), ['ok', 'sourceId', 'version', 'sha256', 'utf8Bytes', 'utf16Units', 'lines', 'longestLineUnits', 'encoding', 'bom', 'newline'].sort());
  assert.equal(metrics.sha256, f.ref.sha256); assert.equal(metrics.utf16Units, 7);
  assert.ok(Object.isFrozen(metrics)); assert.equal(JSON.stringify(metrics).includes('private'), false);
  assert.deepEqual(await f.call('readRange', { sourceId: f.ref.sourceId, version: 1, start: 1, end: 3 }),
    { ok: true, sourceId: f.ref.sourceId, version: 1, start: 1, end: 3, text: '😀' });
  refused(await f.call('applyEdit', edit(f))); refused(await f.call('commitSource', { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'commit-one' }));
});

test('range, version, Unicode and exact UTF8 insertion caps reject before dispatch; TextModel protects split surrogates', async t => {
  const f = await fixture(t);
  for (const payload of [edit(f, { expectedVersion: 0 }), edit(f, { start: -1 }), edit(f, { end: Number.MAX_SAFE_INTEGER + 1 }),
    edit(f, { start: 4, end: 3 }), edit(f, { operationId: '../raw-path' }), edit(f, { insertedText: '\ud800' }),
    edit(f, { expectedVersion: Number.MAX_SAFE_INTEGER }), edit(f, { insertedText: 'é'.repeat(4194304) + 'a' })]) refused(await f.call('applyEdit', payload), 'REQUEST_REFUSED');
  for (const payload of [{ sourceId: f.ref.sourceId, version: 0, start: 0, end: 1 },
    { sourceId: f.ref.sourceId, version: 1, start: 0, end: 131073 },
    { sourceId: f.ref.sourceId, version: 1, start: 0.5, end: 1 }]) refused(await f.call('readRange', payload), 'REQUEST_REFUSED');
  assert.equal(f.count(), 0);
  refused(await f.call('readRange', { sourceId: f.ref.sourceId, version: 1, start: 2, end: 3 }), 'INVALID_UNICODE');
  refused(await f.call('applyEdit', edit(f, { start: 2, end: 2 })), 'INVALID_UNICODE');
  assert.equal((await f.seed.getMetrics({ projectId: f.projectId, sourceId: f.ref.sourceId })).version, 1);
  const bounded = await fixture(t, { text: 'x'.repeat(131073) });
  assert.equal((await bounded.call('readRange', { sourceId: bounded.ref.sourceId, version: 1, start: 0, end: 131072 })).text.length, 131072);
  let received;
  const exact = await f.call('applyEdit', edit(f, { insertedText: 'é'.repeat(4194304) }), {
    repositoryFactory: () => ({ applyEdit: async ({ edit: payload }) => {
      received = payload;
      return { ok: true, sourceId: payload.sourceId, operationId: payload.operationId, version: 2, sha256: 'a'.repeat(64), durability: 'draft' };
    } }),
  });
  assert.equal(exact.ok, true); assert.equal(Buffer.byteLength(received.insertedText), 8388608);
  assert.ok(Object.isFrozen(received)); assert.equal(Object.getPrototypeOf(received), null);
});

test('per-call guard binds repository context to captured project/source/action and rejects asynchronous access policy', async t => {
  const f = await fixture(t);
  let checks;
  const repositoryFactory = ({ grant, canWrite }) => {
    checks = [canWrite({ projectId: grant.projectId, sourceId: f.ref.sourceId, action: 'read' }),
      canWrite({ projectId: 'wrong-project', sourceId: f.ref.sourceId, action: 'read' }),
      canWrite({ projectId: grant.projectId, sourceId: 'wrong-source', action: 'read' }),
      canWrite({ projectId: grant.projectId, sourceId: f.ref.sourceId, action: 'edit' }),
      canWrite({ projectId: grant.projectId, action: 'write' })];
    return new SourceRepository(f.root, { canWrite });
  };
  assert.equal((await f.call('getMetrics', { sourceId: f.ref.sourceId }, { repositoryFactory })).ok, true);
  assert.deepEqual(checks, [true, false, false, false, false]);
  refused(await f.call('getMetrics', { sourceId: f.ref.sourceId }, { access: async () => true }));
  const mutationFactory = ({ grant, canWrite }) => {
    assert.deepEqual([
      canWrite({ projectId: grant.projectId, sourceId: f.ref.sourceId, action: 'edit' }),
      canWrite({ projectId: grant.projectId, action: 'write' }),
      canWrite({ projectId: 'wrong-project', action: 'write' }),
      canWrite({ projectId: grant.projectId, sourceId: 'wrong-source', action: 'write' }),
      canWrite({ projectId: grant.projectId, sourceId: f.ref.sourceId, action: 'write' }),
      canWrite({ projectId: grant.projectId, sourceId: f.ref.sourceId, action: 'commit' }),
      canWrite({ projectId: grant.projectId, action: 'edit' }),
    ], [true, true, false, false, false, false, false]);
    return new SourceRepository(f.root, { canWrite });
  };
  assert.equal((await f.call('applyEdit', edit(f), { repositoryFactory: mutationFactory })).ok, true);
});

test('real edits and blob commits are durable and idempotent; stale versions and operation ID reuse refuse without manifest save', async t => {
  const f = await fixture(t); const before = await f.store.readProject(f.projectId);
  const first = await f.call('applyEdit', edit(f));
  assert.deepEqual(Object.keys(first).sort(), ['ok', 'sourceId', 'operationId', 'version', 'sha256', 'durability'].sort());
  assert.equal(first.ok, true); assert.equal(first.version, 2); assert.equal(first.durability, 'draft');
  assert.deepEqual(await f.call('applyEdit', edit(f)), first);
  refused(await f.call('applyEdit', edit(f, { insertedText: 'changed' })), 'OPERATION_CONFLICT');
  refused(await f.call('applyEdit', edit(f, { operationId: 'stale-edit' })), 'REVISION_CONFLICT');
  const payload = { sourceId: f.ref.sourceId, expectedVersion: 2, operationId: 'commit-one' };
  const receipt = await f.call('commitSource', payload); assert.equal(receipt.ok, true); assert.equal(receipt.durability, 'committed');
  assert.deepEqual(await f.call('commitSource', payload), receipt);
  assert.equal(receipt.sha256, first.sha256);
  assert.deepEqual(await f.store.readProject(f.projectId), before);
  assert.equal((await f.call('readRange', { sourceId: f.ref.sourceId, version: 1, start: 0, end: 7 })).text, 'a😀b\r\nc');
  assert.equal(await new SourceRepository(f.root).readRange({ projectId: f.projectId, sourceId: f.ref.sourceId, version: 2, start: 0, end: 8 }), 'a😀Șb\r\nc');
});

test('revocation after awaited read or mutation withholds every stale byte and acknowledgement', async t => {
  for (const method of ['getMetrics', 'readRange', 'applyEdit', 'commitSource']) {
    const f = await fixture(t); const payload = method === 'getMetrics' ? { sourceId: f.ref.sourceId }
      : method === 'readRange' ? { sourceId: f.ref.sourceId, version: 1, start: 0, end: 7 }
        : method === 'applyEdit' ? edit(f) : { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'commit-one' };
    const repositoryFactory = ({ canWrite }) => {
      const actual = new SourceRepository(f.root, { canWrite });
      return { [method]: async args => {
        const result = await actual[method](args);
        if (method === 'getMetrics') f.lock();
        else if (method === 'readRange') f.registry.invalidateEpoch();
        else if (method === 'applyEdit') f.owner.webContents.mainFrame = { url: f.event.senderFrame.url };
        else f.owner.webContents.mainFrame.url = 'siren://app/other.html';
        return result;
      } };
    };
    const result = await f.call(method, payload, { repositoryFactory }); refused(result);
    assert.equal(Object.hasOwn(result, 'text'), false); assert.equal(Object.hasOwn(result, 'sha256'), false);
  }
});

test('publication fault revokes during native before-select guard and leaves the selected source pointer unchanged', async t => {
  for (const method of ['applyEdit', 'commitSource']) {
    for (const boundary of ['before-rename', 'before-select']) {
      const f = await fixture(t); const selected = join(f.root, 'Projects', f.projectId, 'sources', f.ref.sourceId, 'current.json');
      const before = await readFile(selected); let hit = false;
      f.configure({ fault: async stage => { if (stage === boundary) { hit = true; f.lock(); } } });
      refused(await f.call(method, method === 'applyEdit' ? edit(f) : { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'commit-one' }));
      assert.equal(hit, true); assert.deepEqual(await readFile(selected), before);
      assert.equal((await f.seed.getMetrics({ projectId: f.projectId, sourceId: f.ref.sourceId })).version, 1);
    }
  }
});

test('actual owned writer contention and native version/budget failures keep fixed sanitized codes', async t => {
  const f = await fixture(t);
  refused(await f.call('getMetrics', { sourceId: f.ref.sourceId, version: 999 }), 'UNKNOWN_VERSION');
  await exclusiveWriter(join(f.root, 'Projects', f.projectId), async () => {
    refused(await f.call('applyEdit', edit(f)), 'WRITER_BUSY');
    refused(await f.call('commitSource', { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'commit-one' }), 'WRITER_BUSY');
  });
  f.configure({ limits: { projectBytes: 128 } });
  refused(await f.call('applyEdit', edit(f)), 'PROJECT_BUDGET');
  assert.equal((await f.seed.getMetrics({ projectId: f.projectId, sourceId: f.ref.sourceId })).version, 1);
});

test('checkpoint degradation remains explicit blob durability and unsafe repository outputs cannot disclose data', async t => {
  const f = await fixture(t); f.configure({ checkpoint: async () => { throw Error('private-native-path private-content'); } });
  const payload = { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'commit-one' };
  const degraded = await f.call('commitSource', payload);
  assert.equal(degraded.ok, true); assert.equal(degraded.durability, 'recovery-degraded');
  const wrong = { ok: true, sourceId: 'wrong-source', operationId: 'commit-one', version: 1, sha256: 'a'.repeat(64), durability: 'committed', path: 'private' };
  refused(await f.call('commitSource', payload, { repositoryFactory: () => ({ commitSource: async () => wrong }) }), 'SOURCE_RESULT_REFUSED');
  for (const extra of [{ operationId: 'wrong-operation' }, { version: 2 }, { sha256: 'private-content' }, { durability: 'draft' }]) {
    refused(await f.call('commitSource', payload, { repositoryFactory: () => ({ commitSource: async () => ({ ...wrong, sourceId: f.ref.sourceId, ...extra }) }) }), 'SOURCE_RESULT_REFUSED');
  }
  const unknown = await f.call('commitSource', payload, { repositoryFactory: () => ({ commitSource: async () => { throw Object.assign(Error('private'), { code: 'private-native-path' }); } }) });
  refused(unknown, 'SOURCE_REQUEST_FAILED'); assert.equal(JSON.stringify(unknown).includes('private'), false);
  const oversized = await f.call('readRange', { sourceId: f.ref.sourceId, version: 1, start: 0, end: 1 },
    { repositoryFactory: () => ({ readRange: async () => 'private-excess-text' }) });
  refused(oversized, 'SOURCE_RESULT_REFUSED');
});

test('main-only diagnostics retain native failure code without exposing private errors or logging rejected renderer authority', async t => {
  const f = await fixture(t); const selected = join(f.root, 'Projects', f.projectId, 'sources', f.ref.sourceId, 'current.json');
  const before = await readFile(selected); const diagnostics = [];
  const onNativeFailure = value => diagnostics.push(value);
  f.configure({ fault: async stage => { if (stage === 'source-commit-verified') throw Object.assign(Error('private-path private-code private-pin'), { code: 'EIO' }); } });
  const payload = { sourceId: f.ref.sourceId, expectedVersion: 1, operationId: 'diagnostic-commit' };
  refused(await f.call('commitSource', payload, { onNativeFailure }), 'SOURCE_REQUEST_FAILED');
  assert.deepEqual(diagnostics, [{ method: 'commitSource', code: 'EIO' }]);
  assert.ok(Object.isFrozen(diagnostics[0])); assert.equal(JSON.stringify(diagnostics).includes('private'), false);
  assert.deepEqual(await readFile(selected), before);
  assert.equal((await f.seed.getMetrics({ projectId: f.projectId, sourceId: f.ref.sourceId })).version, 1);
  const getter = Object.defineProperty({}, 'sourceId', { enumerable: true, get() { throw Error('renderer getter evaluated'); } });
  refused(await f.call('getMetrics', getter, { onNativeFailure }), 'REQUEST_REFUSED');
  refused(await f.call('commitSource', payload, { onNativeFailure, event: { sender: {}, senderFrame: {} } }));
  assert.equal(diagnostics.length, 1);
  // A bad trusted logging adapter cannot alter the public failure or pointer.
  refused(await f.call('commitSource', payload, { onNativeFailure() { throw Error('logger'); } }), 'SOURCE_REQUEST_FAILED');
  assert.deepEqual(await readFile(selected), before);
  const invalidCode = await f.call('getMetrics', { sourceId: f.ref.sourceId }, { onNativeFailure,
    repositoryFactory: () => ({ getMetrics() { throw Object.assign(Error('private'), { code: 'private-path' }); } }) });
  refused(invalidCode, 'SOURCE_REQUEST_FAILED');
  assert.deepEqual(diagnostics.at(-1), { method: 'getMetrics', code: 'SOURCE_WRITE_FAILED' });
});
