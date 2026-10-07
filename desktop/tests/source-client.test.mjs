import test from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';

let sourceClient;
try { ({ sourceClient } = await import('../src/ui/code/source-client.js')); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
test('source client exists before any integration', () => assert.equal(typeof sourceClient, 'function'));
const check = (name, body) => test(name, { skip: !sourceClient }, body);
const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64);
const ref = () => ({ sourceId: 'source-a', version: 1, sha256: H1 });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const edit = (operationId = 'edit-one', expectedVersion = 1, insertedText = 'Ș😀') => ({ operationId, expectedVersion, start: 0, end: 1, insertedText });
const mutation = (request, durability = 'draft', sha256 = H2) => ({ ok: true, sourceId: request.sourceId, operationId: request.operationId, version: request.expectedVersion + (durability === 'draft' ? 1 : 0), sha256, durability });
const metrics = (sha256 = H1) => ({ ok: true, sourceId: 'source-a', version: 1, sha256, utf8Bytes: 8, utf16Units: 5, lines: 1, longestLineUnits: 5, encoding: 'utf8', bom: false, newline: 'none' });
const bridge = (overrides = {}) => ({ getMetrics: async () => metrics(), readRange: async request => ({ ok: true, ...request, text: 'a😀b'.slice(request.start, request.end) }), applyEdit: async request => mutation(request), commitSource: async request => mutation(request, 'committed', H2), ...overrides });

check('only an exact successful commit can replay its native operation; edit reuse and changed identities stay fenced',async()=>{
 let calls=0;const client=sourceClient({sourceRef:ref(),bridge:bridge({commitSource:async request=>{calls++;return mutation(request,'committed',H1);}})}),request={operationId:'verified-save',expectedVersion:1};
 assert.equal((await client.commitSource(request)).ok,true);assert.equal((await client.commitSource(request)).ok,true);assert.equal(calls,2);
 assert.equal((await client.applyEdit(edit('verified-save'))).code,'OPERATION_CONFLICT');
 const changed=sourceClient({sourceRef:ref(),bridge:bridge({commitSource:async r=>mutation(r,'committed',H1)})});
 assert.equal((await changed.commitSource(request)).ok,true);assert.equal((await changed.applyEdit(edit('new-edit'))).ok,true);
 assert.equal((await changed.commitSource({operationId:'verified-save',expectedVersion:2})).code,'OPERATION_CONFLICT');
 const reset=sourceClient({sourceRef:ref(),bridge:bridge({commitSource:async r=>mutation(r,'committed',H1)})});await reset.commitSource(request);reset.reset(ref());assert.equal((await reset.commitSource(request)).code,'OPERATION_CONFLICT');
});

check('view pause rejects new edits without fencing admitted local edits; drain waits for every native receipt', async () => {
  const gate=deferred();let count=0;
  const client=sourceClient({sourceRef:ref(),bridge:bridge({applyEdit:async request=>{count++;if(count===1)await gate.promise;return mutation(request,'draft',count===1?H2:H1);}})});
  const first=client.applyEdit(edit()),second=client.applyEdit(edit('pause-second',2));
  assert.equal(client.pauseView().ok,true);assert.equal(client.getState().paused,true);
  assert.equal((await client.applyEdit(edit('late',3))).code,'CLIENT_PAUSED');assert.equal(client.getState().fenced,false);
  assert.equal((await client.commitSource({operationId:'late-save',expectedVersion:3})).code,'CLIENT_PAUSED');
  let drained=false;const waiting=client.drain().then(value=>{drained=true;return value;});
  await Promise.resolve();await Promise.resolve();assert.equal(drained,false);
  assert.equal(client.resumeView().code,'SOURCE_BUSY');gate.resolve();
  const receipts=[await first,await second],result=await waiting;
  assert.equal(result.ok,true);assert.deepEqual(result.receipts,receipts);assert.equal(result.state.version,3);assert.equal(result.state.durability,'draft');
  assert.equal(client.resumeView().ok,true);assert.equal(client.getState().paused,false);
});

check('failed or disposed paused queues cannot report a successful drain or reset themselves clean',async()=>{
  const client=sourceClient({sourceRef:ref(),bridge:bridge({applyEdit:async()=>({ok:false,code:'REVISION_CONFLICT'})})});
  const work=client.applyEdit(edit());client.pauseView();
  const drained=await client.drain();assert.equal((await work).ok,false);assert.equal(drained.ok,false);assert.equal(drained.code,'REVISION_CONFLICT');
  assert.equal((await client.drain()).ok,false);assert.equal(client.reset(ref()).code,'CLIENT_PAUSED');
  client.dispose();assert.equal((await client.drain()).code,'CLIENT_DISPOSED');
});

check('pause invalidates pending reads while an unpaused drain refuses a false barrier',async()=>{
  const gate=deferred(),client=sourceClient({sourceRef:ref(),bridge:bridge({readRange:async request=>{await gate.promise;return {ok:true,...request,text:'a'};}})});
  assert.equal((await client.drain()).code,'CLIENT_NOT_PAUSED');
  const read=client.readRange({start:0,end:1});client.pauseView();gate.resolve();
  assert.equal((await read).code,'STALE_RESULT');assert.equal((await client.readRange({start:0,end:1})).code,'CLIENT_PAUSED');
  assert.equal((await client.drain()).ok,true);
});

check('resume and a new pause retire an older drain even when both have the same source identity',async()=>{
  const gate=deferred(),client=sourceClient({sourceRef:ref(),bridge:bridge({applyEdit:async request=>{await gate.promise;return mutation(request);}})});
  const work=client.applyEdit(edit());client.pauseView();
  work.then(()=>{assert.equal(client.resumeView().ok,true);client.pauseView();});
  const drained=client.drain();gate.resolve();
  assert.equal((await drained).code,'STALE_RESULT');
});

check('real paused local queue drains edits and an already admitted commit with exact fresh disk bytes',async t=>{
  const root=await mkdtemp(join(tmpdir(),'siren-paused-client-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const projects=new ProjectStore(root),project=await projects.createProject({label:'Owned paused source',json:'{"workpapers":[]}'}),projectId=project.project.id;
  const repo=new SourceRepository(root),ref=await repo.importSource({projectId,bytes:Buffer.from('a😀b\r\nc')});
  const gate=deferred();let held=false;
  const writer=new SourceRepository(root,{fault:async()=>{if(!held){held=true;await gate.promise;}}});
  const client=sourceClient({sourceRef:ref,bridge:bridge({applyEdit:edit=>writer.applyEdit({projectId,edit}),commitSource:request=>writer.commitSource({projectId,...request})})});
  const first=client.applyEdit({operationId:'real-pause-one',expectedVersion:1,start:0,end:1,insertedText:'X'});
  const second=client.applyEdit({operationId:'real-pause-two',expectedVersion:2,start:3,end:4,insertedText:'Ș'});
  const save=client.commitSource({operationId:'real-pause-save',expectedVersion:3});
  client.pauseView();const drained=client.drain();
  assert.equal((await client.applyEdit({operationId:'real-late',expectedVersion:4,start:0,end:0,insertedText:'WRONG'})).code,'CLIENT_PAUSED');
  gate.resolve();const result=await drained;
  assert.equal(result.ok,true);assert.deepEqual(result.receipts,[await first,await second,await save]);assert.equal(result.state.durability,'committed');
  assert.deepEqual(await new SourceRepository(root).exportSource({projectId,sourceId:ref.sourceId,version:3}),Buffer.from('X😀Ș\r\nc'));
  assert.deepEqual(await projects.readProject(projectId),project);assert.equal(client.getState().fenced,false);
});

check('copies immutable identity and refuses malformed references or bridge', () => {
  const original = ref(); const client = sourceClient({ bridge: bridge(), sourceRef: original }); original.version = 100; original.sha256 = H2;
  assert.equal(client.getState().version, 1); assert.equal(client.getState().sha256, H1); assert.equal(Object.isFrozen(client.getState()), true);
  for (const bad of [null, { ...ref(), version: 0 }, { ...ref(), sha256: H1.toUpperCase() }, { ...ref(), sourceId: '../raw' }]) assert.throws(() => sourceClient({ bridge: bridge(), sourceRef: bad }), { code: 'INVALID_REFERENCE' });
  assert.throws(() => sourceClient({ bridge: {}, sourceRef: ref() }), { code: 'INVALID_BRIDGE' });
  let reads = 0; const getter = { ...ref() }; Object.defineProperty(getter, 'version', { get() { reads++; return 1; } });
  assert.throws(() => sourceClient({ bridge: bridge(), sourceRef: getter }), { code: 'INVALID_REFERENCE' }); assert.equal(reads, 0);
});

check('bounded Unicode reads use bound identity and never accept mismatched receipt coordinates', async () => {
  const client = sourceClient({ bridge: bridge(), sourceRef: ref() });
  assert.deepEqual(await client.readRange({ start: 1, end: 3 }), { ok: true, sourceId: 'source-a', version: 1, start: 1, end: 3, text: '😀' });
  for (const range of [{ start: -1, end: 3 }, { start: 0, end: 131073 }, { start: 0, end: 1, projectId: 'forged' }]) assert.equal((await client.readRange(range)).code, 'INVALID_RANGE');
  for (const extra of [{ sourceId: 'other' }, { version: 2 }, { start: 0 }, { end: 4 }, { text: '\ud800x' }, { text: 'x'.repeat(131073) }, { privateText: 'leak' }]) {
    const bad = sourceClient({ bridge: bridge({ readRange: async () => ({ ok: true, sourceId: 'source-a', version: 1, start: 1, end: 3, text: '😀', ...extra }) }), sourceRef: ref() });
    assert.equal((await bad.readRange({ start: 1, end: 3 })).code, 'INVALID_RECEIPT');
  }
  const cap = sourceClient({ bridge: bridge({ readRange: async request => ({ ok: true, ...request, text: 'x'.repeat(131072) }) }), sourceRef: ref() });
  assert.equal((await cap.readRange({ start: 0, end: 131072 })).text.length, 131072);
});

check('metrics validate full identity and numeric/encoding shape without provenance publication', async () => {
  const client = sourceClient({ bridge: bridge(), sourceRef: ref() }); assert.deepEqual(await client.getMetrics(), metrics());
  for (const extra of [{ sha256: H2 }, { sourceId: 'other' }, { version: 2 }, { utf8Bytes: -1 }, { lines: 0 }, { longestLineUnits: 6 }, { provenance: { secret: 'raw' } }, { bom: 'false' }]) {
    const bad = sourceClient({ bridge: bridge({ getMetrics: async () => ({ ...metrics(), ...extra }) }), sourceRef: ref() }); assert.equal((await bad.getMetrics()).code, 'INVALID_RECEIPT');
  }
  const raw = sourceClient({ bridge: bridge({ getMetrics: async () => ({ ...metrics(), encoding: 'unsupported', utf16Units: null, lines: null, longestLineUnits: null }) }), sourceRef: ref() });
  assert.equal((await raw.getMetrics()).encoding, 'unsupported');
});

check('serializes queued edits and commit; advances only after exact durable acknowledgements', async () => {
  const gate = deferred(); const events = []; let entered = 0;
  const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: async request => { entered++; if (request.operationId === 'edit-one') await gate.promise; return mutation(request, 'draft', entered === 1 ? H2 : H1); }, commitSource: async request => mutation(request, 'recovery-degraded', H1) }) });
  client.subscribeSource(event => events.push(event));
  const first = client.applyEdit(edit()); const second = client.applyEdit(edit('edit-two', 2)); const save = client.commitSource({ operationId: 'save-one', expectedVersion: 3 });
  await Promise.resolve(); await Promise.resolve(); assert.equal(client.getState().version, 1); assert.equal(entered, 1);
  gate.resolve(); assert.equal((await first).version, 2); assert.equal((await second).version, 3); assert.equal((await save).durability, 'recovery-degraded');
  assert.equal(client.getState().version, 3); assert.equal(client.getState().durability, 'recovery-degraded');
  assert.deepEqual(events.map(event => [event.version, event.durability]), [[2, 'draft'], [3, 'draft'], [3, 'recovery-degraded']]);
  assert.equal(JSON.stringify(events).includes('Ș'), false); assert.equal(Object.isFrozen(events[0]), true);
});

check('failed edit fences queued edits and commit until explicit same-source reset', async () => {
  let writes = 0;
  const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: async () => { writes++; return { ok: false, code: 'REVISION_CONFLICT', message: 'Native conflict' }; } }) });
  const first = client.applyEdit(edit()); const second = client.applyEdit(edit('second', 2)); const commit = client.commitSource({ operationId: 'save-one', expectedVersion: 2 });
  assert.equal((await first).code, 'REVISION_CONFLICT'); assert.equal((await second).code, 'CLIENT_FENCED'); assert.equal((await commit).code, 'CLIENT_FENCED'); assert.equal(writes, 1); assert.equal(client.getState().version, 1);
  assert.equal(client.reset({ ...ref(), sourceId: 'other' }).code, 'INVALID_REFERENCE'); assert.equal(client.getState().fenced, true);
  assert.equal(client.reset(ref()).ok, true); assert.equal(client.getState().fenced, false);
});

check('malformed mutation identity, operation, version, hash or durability never advances', async () => {
  for (const extra of [{ sourceId: 'other' }, { operationId: 'other' }, { version: 1 }, { version: 3 }, { sha256: 'BAD' }, { durability: 'committed' }, { privateText: 'not allowed' }]) {
    const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: async request => ({ ...mutation(request), ...extra }) }) });
    assert.equal((await client.applyEdit(edit())).code, 'INVALID_RECEIPT'); assert.equal(client.getState().version, 1); assert.equal(client.getState().fenced, true);
  }
});

check('commit must preserve exact current hash/version and reports degraded recovery explicitly', async () => {
  for (const extra of [{ sha256: H2 }, { version: 2 }, { operationId: 'other' }, { durability: 'draft' }]) {
    const client = sourceClient({ sourceRef: ref(), bridge: bridge({ commitSource: async request => ({ ...mutation(request, 'committed', H1), ...extra }) }) });
    assert.equal((await client.commitSource({ operationId: 'save-one', expectedVersion: 1 })).code, 'INVALID_RECEIPT'); assert.equal(client.getState().fenced, true);
  }
});

check('stale and duplicate operation requests cannot rebase or double-apply', async () => {
  const client = sourceClient({ sourceRef: ref(), bridge: bridge() }); assert.equal((await client.applyEdit(edit())).ok, true);
  assert.equal((await client.applyEdit(edit())).code, 'OPERATION_CONFLICT'); assert.equal(client.getState().version, 2);
  client.reset({ sourceId: 'source-a', version: 2, sha256: H2 });
  assert.equal((await client.applyEdit(edit('fresh', 1))).code, 'REVISION_CONFLICT'); assert.equal(client.getState().version, 2);
});

check('mutation request validation prevents unpaired or oversized input and accessor evaluation', async () => {
  for (const bad of [{ ...edit(), insertedText: '\ud800' }, { ...edit(), insertedText: 'x'.repeat(8388609) }, { ...edit(), start: -1 }, { ...edit(), projectId: 'forged' }, { ...edit(), sourceId: 'other' }]) {
    const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: async () => { assert.fail('Invalid input reached authority'); } }) });
    assert.equal((await client.applyEdit(bad)).ok, false); assert.equal(client.getState().fenced, true);
  }
  let reads = 0; const request = edit(); Object.defineProperty(request, 'insertedText', { get() { reads++; return 'secret'; } });
  const client = sourceClient({ sourceRef: ref(), bridge: bridge() }); assert.equal((await client.applyEdit(request)).code, 'INVALID_EDIT'); assert.equal(reads, 0);
});

check('accepts the IPC 8MiB insertion byte boundary and refuses multibyte overflow', async () => {
  const client = sourceClient({ sourceRef: ref(), bridge: bridge() });
  assert.equal((await client.applyEdit(edit('at-byte-cap', 1, '😀'.repeat(2097152)))).ok, true);
  const bad = sourceClient({ sourceRef: ref(), bridge: bridge() });
  assert.equal((await bad.applyEdit(edit('over-byte-cap', 1, '😀'.repeat(2097152) + 'x'))).code, 'INVALID_EDIT');
});

check('stalled authority cannot retain an unbounded mutation queue', async () => {
  const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: () => gate.promise }) });
  const active = client.applyEdit(edit('active')); await Promise.resolve(); await Promise.resolve();
  const queued = [];
  for (let index = 0; index < 63; index++) queued.push(client.applyEdit(edit('queued-' + index, 2)));
  const excess = client.applyEdit(edit('too-many', 2));
  assert.equal((await Promise.race([excess, Promise.resolve({ code: 'NOT_BOUNDED' })])).code, 'CLIENT_BUSY');
  gate.resolve(mutation({ ...edit('active'), sourceId: 'source-a' })); assert.equal((await active).ok, true);
  assert.equal((await queued[0]).code, 'CLIENT_FENCED'); await Promise.all(queued);
});

check('pending inserted bytes are bounded separately from operation count', async () => {
  const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: () => gate.promise }) });
  const active = client.applyEdit(edit('active', 1, 'x'.repeat(8388608))); await Promise.resolve(); await Promise.resolve();
  const queued = client.applyEdit(edit('second', 2, 'x'.repeat(8388608)));
  assert.equal((await Promise.race([client.applyEdit(edit('overflow', 3, 'x')), Promise.resolve({ code: 'NOT_BOUNDED' })])).code, 'CLIENT_BUSY');
  gate.resolve(mutation({ ...edit('active'), sourceId: 'source-a' })); await active; assert.equal((await queued).code, 'CLIENT_FENCED');
});

check('late range and metric replies after disposal/reset contain no source data', async () => {
  for (const method of ['readRange', 'getMetrics']) {
    const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ [method]: () => gate.promise }) });
    const work = method === 'readRange' ? client.readRange({ start: 0, end: 1 }) : client.getMetrics(); client.dispose();
    gate.resolve(method === 'readRange' ? { ok: true, sourceId: 'source-a', version: 1, start: 0, end: 1, text: 'a' } : metrics());
    const result = await work; assert.deepEqual(result, { ok: false, code: 'CLIENT_DISPOSED' });
  }
});

check('read started before an edit cannot publish stale text after durable version changes', async () => {
  const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ readRange: () => gate.promise }) });
  const read = client.readRange({ start: 0, end: 1 }); assert.equal((await client.applyEdit(edit())).ok, true);
  gate.resolve({ ok: true, sourceId: 'source-a', version: 1, start: 0, end: 1, text: 'a' }); const result = await read;
  assert.equal(result.code, 'STALE_RESULT'); assert.equal('text' in result, false);
});

check('dispose discards in-flight reads/mutations and notifications; queued mutations never call bridge', async () => {
  const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: () => gate.promise }) }); const events = []; client.subscribeSource(event => events.push(event));
  const first = client.applyEdit(edit()); const queued = client.commitSource({ operationId: 'save-one', expectedVersion: 2 }); await Promise.resolve(); await Promise.resolve(); client.dispose();
  gate.resolve(mutation({ ...edit(), sourceId: 'source-a' })); assert.equal((await first).code, 'CLIENT_DISPOSED'); assert.equal((await queued).code, 'CLIENT_DISPOSED'); assert.equal(events.length, 0); assert.equal(client.getState().version, 1);
  assert.equal((await client.readRange({ start: 0, end: 1 })).code, 'CLIENT_DISPOSED');
});

check('reset invalidates late completions without altering another source or queued work', async () => {
  const gate = deferred(); const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: () => gate.promise }) }); const events = []; client.subscribeSource(event => events.push(event));
  const first = client.applyEdit(edit()); const second = client.applyEdit(edit('second', 2)); await Promise.resolve(); await Promise.resolve();
  assert.equal(client.reset(ref()).ok, true); gate.resolve(mutation({ ...edit(), sourceId: 'source-a' })); assert.equal((await first).code, 'STALE_RESULT'); assert.equal((await second).code, 'STALE_RESULT'); assert.equal(client.getState().version, 1); assert.deepEqual(events.map(event => event.type), ['reset']);
});

check('subscriber teardown and throwing observers cannot change receipt acceptance', async () => {
  const client = sourceClient({ sourceRef: ref(), bridge: bridge() }); const events = []; const off = client.subscribeSource(event => events.push(event)); client.subscribeSource(() => { throw new Error('observer'); }); off(); off();
  assert.equal((await client.applyEdit(edit())).ok, true); assert.equal(events.length, 0); assert.equal(client.getState().version, 2);
});

check('bounded recent operation cache does not stop normal editing after 4096 acknowledgements', async () => {
  let oldestCalls = 0;
  const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: async request => request.operationId === 'oldest-reuse' && ++oldestCalls > 1
    ? { ok: false, code: 'OPERATION_CONFLICT', message: 'Refused' } : mutation(request) }) });
  for (let index = 0; index < 4100; index++) {
    const receipt = await client.applyEdit(edit(index === 0 ? 'oldest-reuse' : 'edit-' + index, index + 1));
    assert.equal(receipt.ok, true, 'normal edit ' + index);
  }
  assert.equal(client.getState().version, 4101);
  assert.equal((await client.applyEdit(edit('oldest-reuse', 4101))).code, 'OPERATION_CONFLICT');
  assert.equal(client.getState().version, 4101); assert.equal(client.getState().fenced, true);
});

check('subscriber reset invalidates older notification delivery to remaining observers', async () => {
  const client = sourceClient({ sourceRef: ref(), bridge: bridge() }); const events = [];
  client.subscribeSource(event => { if (event.type === 'draft') client.reset(ref()); });
  client.subscribeSource(event => events.push(event));
  await client.applyEdit(edit()); assert.deepEqual(events.map(event => event.type), ['reset']); assert.equal(client.getState().version, 1);
});

check('transport failures and malformed failures fence without publishing bridge secrets', async () => {
  for (const refusal of [() => Promise.reject(new Error('PRIVATE_BYTES')), async () => ({ ok: false, code: 'bad secret code', message: 'PRIVATE_BYTES' }), async () => ({ ok: false, code: 'ACCESS_REFUSED', message: 'PRIVATE_BYTES', text: 'PRIVATE_BYTES' })]) {
    const client = sourceClient({ sourceRef: ref(), bridge: bridge({ applyEdit: refusal }) }); const result = await client.applyEdit(edit());
    assert.equal(result.ok, false); assert.equal(JSON.stringify(result).includes('PRIVATE_BYTES'), false); assert.equal(client.getState().fenced, true);
  }
});

check('real repository byte receipts survive Unicode edit, no-op and commit without source copying', async t => {
  const root = await mkdtemp(join(tmpdir(), 'siren-source-client-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = await new ProjectStore(root).createProject({ label: 'client', json: '{}' }); const repo = new SourceRepository(root);
  const imported = await repo.importSource({ projectId: project.project.id, bytes: Buffer.from('a😀b\r\nc') });
  const realBridge = {
    getMetrics: async request => { const { provenance, ...data } = await repo.getMetrics({ projectId: project.project.id, ...request }); return { ok: true, ...data }; },
    readRange: async request => ({ ok: true, ...request, text: await repo.readRange({ projectId: project.project.id, ...request }) }),
    applyEdit: request => repo.applyEdit({ projectId: project.project.id, edit: request }),
    commitSource: request => repo.commitSource({ projectId: project.project.id, ...request }),
  };
  const client = sourceClient({ bridge: realBridge, sourceRef: imported });
  assert.equal((await client.readRange({ start: 1, end: 3 })).text, '😀');
  const first = await client.applyEdit({ operationId: 'unicode', expectedVersion: 1, start: 3, end: 4, insertedText: 'Ș' });
  assert.equal(first.sha256, createHash('sha256').update(Buffer.from('a😀Ș\r\nc')).digest('hex')); assert.equal(first.version, 2);
  const noop = await client.applyEdit({ operationId: 'noop', expectedVersion: 2, start: 3, end: 4, insertedText: 'Ș' }); assert.equal(noop.version, 3); assert.equal(noop.sha256, first.sha256);
  assert.equal((await client.commitSource({ operationId: 'save', expectedVersion: 3 })).durability, 'committed');
  assert.deepEqual(await repo.exportSource({ projectId: project.project.id, sourceId: imported.sourceId, version: 3 }), Buffer.from('a😀Ș\r\nc'));
});
