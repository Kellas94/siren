import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { sourceClient } from '../src/ui/code/source-client.js';

async function fixture(t,{readonly=false}={}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-client-loading-')); t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = (await new ProjectStore(root).createProject({ label: 'Loading', json: '{}' })).project.id;
  const repo = new SourceRepository(root), text = '\ufeff' + 'python😀\r\n'.repeat(20000) + 'end\rbare';
  const ref = await repo.importSource({ projectId, bytes: Buffer.from(text) }), readers = new Map();
  let beforeChunk = async () => {}, afterClose = () => {}, closes = 0;
  const bridge = {
    getMetrics: async request => { const { provenance, ...info } = await repo.getMetrics({ projectId, ...request }); return { ok: true, ...info }; },
    readRange: async request => ({ ok: true, ...request, text: await repo.readRange({ projectId, ...request }) }),
    applyEdit: request => repo.applyEdit({ projectId, edit: request }),
    commitSource: request => repo.commitSource({ projectId, ...request }),
    openRead: async request => { const readId = randomUUID(), reader = await repo.openReader({ projectId, ...request }); readers.set(readId, reader); return { ok: true, readId, ...reader.info }; },
    readChunk: async request => { await beforeChunk(); return { ok: true, readId: request.readId, ...await readers.get(request.readId).readChunk(request) }; },
    closeRead: async request => { closes++; readers.get(request.readId)?.dispose(); readers.delete(request.readId); afterClose(); return { ok: true, ...request }; }
  };
  if(readonly){delete bridge.applyEdit;delete bridge.commitSource;}
  const client = sourceClient({ bridge, sourceRef: ref, readonly });
  t.after(() => { client.dispose(); for (const reader of readers.values()) reader.dispose(); });
  return { repo, projectId, ref, text, client, closes: () => closes, delayChunks: fn => { beforeChunk = fn; }, afterClose: fn => { afterClose = fn; } };
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('explicit readonly client loads exact large Unicode/CRLF CM text through real reader leases without mutation adapters',async t=>{
  const f=await fixture(t,{readonly:true});
  const loaded=await f.client.loadDocument();assert.equal(loaded.ok,true);
  assert.equal(loaded.doc.toString('\n'),f.text);assert.equal(loaded.sha256,f.ref.sha256);assert.equal(f.closes(),1);
  assert.equal((await f.client.applyEdit({operationId:'must-not-edit',expectedVersion:1,start:0,end:0,insertedText:'bad'})).code,'READ_ONLY');
  assert.equal((await f.client.commitSource({operationId:'must-not-commit',expectedVersion:1})).code,'READ_ONLY');
  assert.equal(f.client.getState().fenced,false);assert.equal(f.client.getState().version,1);
  assert.deepEqual(await f.repo.exportSource({projectId:f.projectId,sourceId:f.ref.sourceId,version:1}),Buffer.from(f.text));
  assert.equal((await f.repo.getMetrics({projectId:f.projectId,sourceId:f.ref.sourceId})).version,1);
  assert.equal(f.client.pauseView().ok,true);assert.equal((await f.client.drain()).ok,true);assert.equal(f.client.resumeView().ok,true);
});

test('readonly selection is explicit boolean and default writable clients still require mutation adapters',()=>{
  const sourceRef={sourceId:'source-a',version:1,sha256:'a'.repeat(64)},bridge={getMetrics:async()=>{},readRange:async()=>{}};
  assert.throws(()=>sourceClient({sourceRef,bridge}),/INVALID_BRIDGE/);
  for(const readonly of ['true',null,1])assert.throws(()=>sourceClient({sourceRef,bridge,readonly}),/INVALID_CLIENT_OPTIONS/);
});

test('client loads verified CM Text with exact identity and no retained text in its state', async t => {
  const f = await fixture(t); assert.equal(typeof f.client.loadDocument, 'function');
  const result = await f.client.loadDocument(); assert.equal(result.ok, true);
  assert.equal(result.doc.toString('\n'), f.text); assert.equal(result.sha256, f.ref.sha256);
  assert.equal('doc' in f.client.getState(), false); assert.equal(f.closes(), 1);
});

test('disposal cancels a pending document load without publishing retained text', async t => {
  const f = await fixture(t); assert.equal(typeof f.client.loadDocument, 'function');
  const entered = deferred(), gate = deferred(); f.delayChunks(() => { entered.resolve(); return gate.promise; });
  const loading = f.client.loadDocument(); await entered.promise; f.client.dispose();
  const result = await loading; assert.equal(result.code, 'CLIENT_DISPOSED'); assert.equal('doc' in result, false);
  gate.resolve(); assert.equal(f.closes(), 1);
});

test('reset cancels an old load; its result cannot publish after identity generation changes', async t => {
  const f = await fixture(t); assert.equal(typeof f.client.loadDocument, 'function');
  const entered = deferred(), gate = deferred(); f.delayChunks(() => { entered.resolve(); return gate.promise; });
  const loading = f.client.loadDocument(); await entered.promise;
  assert.equal(f.client.reset(f.ref).ok, true);
  const result = await loading; assert.equal(result.code, 'STALE_RESULT'); assert.equal('doc' in result, false);
  gate.resolve(); assert.equal(f.closes(), 1);
});

test('a durable edit cancels an in-flight initial load and preserves the exact newer source', async t => {
  const f = await fixture(t); assert.equal(typeof f.client.loadDocument, 'function');
  const entered = deferred(), gate = deferred(); f.delayChunks(() => { entered.resolve(); return gate.promise; });
  const loading = f.client.loadDocument(); await entered.promise;
  const edited = await f.client.applyEdit({ operationId: 'newer', expectedVersion: 1, start: 0, end: 0, insertedText: 'new' });
  assert.equal(edited.ok, true); assert.equal(edited.version, 2);
  const result = await loading; assert.equal(result.code, 'STALE_RESULT'); assert.equal('doc' in result, false);
  gate.resolve();
  assert.deepEqual(await f.repo.exportSource({ projectId: f.projectId, sourceId: f.ref.sourceId, version: 2 }), Buffer.from('new' + f.text));
});

test('external cancellation before the final client continuation cannot publish a verified document', async t => {
  const f = await fixture(t), controller = new AbortController(); let listenerRemoved = false, cancelledBeforeCleanup = false;
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.removeEventListener = (...args) => { listenerRemoved = true; return remove(...args); };
  const later = depth => queueMicrotask(() => {
    if (depth > 1) later(depth - 1);
    else { cancelledBeforeCleanup = !listenerRemoved; controller.abort(); }
  });
  f.afterClose(() => later(5));
  const result = await f.client.loadDocument({ signal: controller.signal });
  assert.equal(cancelledBeforeCleanup, true, 'cancellation occurred before client final cleanup');
  assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_LOAD_CANCELLED'); assert.equal('doc' in result, false);
  assert.equal(f.closes(), 1);
});
