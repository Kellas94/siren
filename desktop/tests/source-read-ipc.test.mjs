import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { WindowRegistry } from '../src/windows/registry.mjs';

const contract = await import('../src/sources/read-ipc.mjs').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return {};
});
class NativeWindow extends EventEmitter {
  constructor(id, url) {
    super(); this.id = id; this.dead = false; this.webContents = new EventEmitter();
    Object.assign(this.webContents, { id: id + 1000, mainFrame: { url },
      isDestroyed: () => this.dead, getURL: () => this.webContents.mainFrame.url });
  }
  isDestroyed() { return this.dead; }
  isMinimized() { return false; }
  restore() {}
  focus() {}
  destroy() { this.dead = true; this.webContents.emit('destroyed'); this.emit('closed'); }
  close() { this.destroy(); }
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'siren-read-ipc-')); t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = (await new ProjectStore(root).createProject({ label: 'Read IPC', json: '{}' })).project.id;
  const repo = new SourceRepository(root); const original = '\ufeff' + 'a'.repeat(131070) + '😀\r\nprivate';
  const ref = await repo.importSource({ projectId, bytes: Buffer.from(original), provenance: { privateField: 'not-disclosed' } });
  const policy = { projectId, mode: 'normal', access: 'write', entityIds: [ref.sourceId] }; const windows = [];
  const registry = new WindowRegistry({ authorize: () => policy, createWindow: options => {
    const window = new NativeWindow(windows.length + 1, options.mainFrameUrl); windows.push(window); return window;
  } });
  await registry.openView({ role: 'workspace', entityId: null }); await registry.openView({ role: 'code', entityId: ref.sourceId, version: 1 });
  const event = i => ({ sender: windows[i].webContents, senderFrame: windows[i].webContents.mainFrame });
  assert.equal(typeof contract.SourceReadService, 'function', 'typed source read service must exist');
  let unlocked = true, count = 0, wrap = reader => reader, factoryFailure = false;
  const service = new contract.SourceReadService({ registry,
    access: (grant, scope) => unlocked && grant.projectId === projectId && policy.entityIds.includes(scope.sourceId) && scope.action === 'read',
    repositoryFactory: ({ canWrite, readers }) => {
      count++; if (factoryFailure) throw null;
      const repository = new SourceRepository(root, { canWrite, readers }), open = repository.openReader.bind(repository);
      repository.openReader = async request => wrap(await open(request)); return repository;
    }
  }); t.after(() => service.dispose());
  const call = (method, payload, i = 0) => service.invoke({ event: event(i), method, payload });
  const open = () => call('openRead', { sourceId: ref.sourceId, version: 1, sha256: ref.sha256 });
  return { root, repo, ref, original, projectId, registry, policy, windows, service, call, open, event, count: () => count,
    lock: () => { unlocked = false; }, wrap: callback => { wrap = callback; }, failFactory: () => { factoryFailure = true; } };
}
const refuse = (result, code) => { assert.equal(result.ok, false); assert.equal(result.code, code); };

test('typed read receipt streams exact source with Unicode-safe acknowledged boundaries and no provenance', async t => {
  const f = await fixture(t); const opened = await f.open(); assert.equal(opened.ok, true);
  assert.equal(opened.sha256, f.ref.sha256); assert.equal(opened.utf16Units, f.original.length);
  assert.equal('provenance' in opened, false); assert.ok(Object.isFrozen(opened));
  const request = { sourceId: f.ref.sourceId, version: 1, readId: opened.readId, start: 0, maxUnits: 131072 };
  const first = await f.call('readChunk', request); assert.equal(first.ok, true); assert.equal(first.end, 131071);
  const last = await f.call('readChunk', { ...request, start: first.end });
  assert.equal(first.text + last.text, f.original); assert.equal(f.count(), 1);
  assert.equal((await f.call('closeRead', { sourceId: f.ref.sourceId, version: 1, readId: opened.readId })).ok, true);
  refuse(await f.call('readChunk', request), 'ACCESS_REFUSED');
});

test('another registered view cannot consume or close a copied read ID', async t => {
  const f = await fixture(t); const opened = await f.open();
  const request = { sourceId: f.ref.sourceId, version: 1, readId: opened.readId };
  refuse(await f.call('readChunk', { ...request, start: 0, maxUnits: 10 }, 1), 'ACCESS_REFUSED');
  refuse(await f.call('closeRead', request, 1), 'ACCESS_REFUSED');
  assert.equal((await f.call('readChunk', { ...request, start: 0, maxUnits: 10 })).text, f.original.slice(0, 10));
  f.lock(); refuse(await f.call('readChunk', { ...request, start: 0, maxUnits: 10 }), 'ACCESS_REFUSED');
  f.service.dispose();
});

test('source/hash/version confusion and renderer authority fields refuse without disclosing text', async t => {
  const f = await fixture(t);
  const request = { sourceId: f.ref.sourceId, version: 1, sha256: f.ref.sha256 };
  for (const extra of [{ projectId: f.projectId }, { path: 'C:/private' }, { role: 'workspace' }, { epoch: 1 }]) {
    refuse(await f.call('openRead', { ...request, ...extra }), 'REQUEST_REFUSED');
  }
  const getter = Object.defineProperty({}, 'sourceId', { enumerable: true, get() { throw Error('Getter must not execute'); } });
  refuse(await f.call('openRead', getter), 'REQUEST_REFUSED'); assert.equal(f.count(), 0);
  refuse(await f.call('openRead', { ...request, sha256: '0'.repeat(64) }), 'SOURCE_RESULT_REFUSED');
  const opened = await f.open(); assert.equal(opened.ok, true);
  refuse(await f.call('readChunk', { sourceId: f.ref.sourceId, version: 2, readId: opened.readId, start: 0, maxUnits: 10 }), 'ACCESS_REFUSED');
  f.registry.invalidateEpoch();
  refuse(await f.call('readChunk', { sourceId: f.ref.sourceId, version: 1, readId: opened.readId, start: 0, maxUnits: 10 }), 'ACCESS_REFUSED');
});

test('service bounds opening and active handles; disposal fences pending admission', async t => {
  const f = await fixture(t); const [one, two, refusedThird] = await Promise.all([f.open(), f.open(), f.open()]);
  assert.equal(one.ok, true); assert.equal(two.ok, true); refuse(refusedThird, 'SOURCE_READER_BUDGET');
  f.service.dispose(); refuse(await f.open(), 'ACCESS_REFUSED');
});

test('destroying one native reader window immediately releases its budget without closing another window lease', async t => {
  const f=await fixture(t),request={sourceId:f.ref.sourceId,version:1,sha256:f.ref.sha256};
  const primary=await f.open(),code=await f.call('openRead',request,1);assert.equal(primary.ok,true);assert.equal(code.ok,true);
  refuse(await f.open(),'SOURCE_READER_BUDGET');
  f.windows[1].destroy();
  assert.equal(f.windows[1].webContents.listenerCount('destroyed'),0);assert.equal(f.windows[1].webContents.listenerCount('did-start-navigation'),0);
  const replacement=await f.open();assert.equal(replacement.ok,true,'Closed native window must not consume the shared reader budget until TTL');
  assert.equal((await f.call('readChunk',{sourceId:f.ref.sourceId,version:1,readId:primary.readId,start:0,maxUnits:2})).text,f.original.slice(0,2));
  refuse(await f.call('readChunk',{sourceId:f.ref.sourceId,version:1,readId:code.readId,start:0,maxUnits:2},1),'ACCESS_REFUSED');
});

test('a native window lost while a reader opens cannot publish bytes or retain the opening budget', async t => {
  const f=await fixture(t);let entered,release;
  const ready=new Promise(resolve=>{entered=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  // Hold the real repository admission after its reader was acquired.
  f.wrap(reader=>{entered();return gate.then(()=>reader);});
  const pending=f.call('openRead',{sourceId:f.ref.sourceId,version:1,sha256:f.ref.sha256},1);await ready;
  f.windows[1].destroy();release();refuse(await pending,'ACCESS_REFUSED');
  f.wrap(reader=>reader);
  assert.equal((await f.open()).ok,true);assert.equal((await f.open()).ok,true);
});

test('legitimate disk corruption retains its error attribution and releases the failed open', async t => {
  const f = await fixture(t);
  const blob = join(f.root, 'Projects', f.projectId, 'sources', f.ref.sourceId, 'blobs', `${f.ref.sha256}.bin`);
  await writeFile(blob, 'corrupt');
  refuse(await f.open(), 'CORRUPT_SOURCE');
  await writeFile(blob, Buffer.from(f.original));
  assert.equal((await f.open()).ok, true);
});

test('a null native rejection becomes a sanitized failure rather than rejecting the invocation', async t => {
  const f = await fixture(t); f.failFactory();
  refuse(await f.open(), 'SOURCE_REQUEST_FAILED');
});

test('native adapter extensions cannot add private fields to typed open or chunk receipts', async t => {
  const f = await fixture(t);
  // Real repository/pool underneath a future native adapter with extra fields.
  // This tests boundary projection, not a current renderer-triggered disclosure.
  f.wrap(reader => ({ info: { ...reader.info, provenance: { private: 'not-public' }, rawPath: 'private-path' },
    dispose: reader.dispose, readChunk: async request => ({ ...await reader.readChunk(request), private: 'not-public', rawPath: 'private-path' }) }));
  const opened = await f.open(); assert.equal(opened.ok, true); assert.equal('provenance' in opened, false); assert.equal('rawPath' in opened, false);
  const chunk = await f.call('readChunk', { sourceId: f.ref.sourceId, version: 1, readId: opened.readId, start: 0, maxUnits: 10 });
  assert.equal(chunk.ok, true); assert.equal('private' in chunk, false); assert.equal('rawPath' in chunk, false);
  assert.equal(chunk.text, f.original.slice(0, 10));
});
