import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../src/terminal/lifecycle.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const {TerminalLifecycle} = module;
const deferred = () => {let resolve; const promise = new Promise(r => resolve = r); return {promise, resolve};};
const tick = () => new Promise(resolve => setImmediate(resolve));
const grant = Object.freeze({windowId:'workspace_1',projectId:'project_1',epoch:3,role:'workspace'});
const request = (n = 0) => ({operationId:'create_'+n,epoch:3,cwdId:'cwd_1',profileId:'powershell',cols:100,rows:30});
function fixture(overrides = {}) {
  assert.equal(typeof TerminalLifecycle,'function','pure lifecycle implementation required');
  let current = true;
  const calls = {prepare:[],create:[],stop:[],verify:[],close:[]};
  const deps = {
    authorize: () => current,
    captureAdmission: () => ({isCurrent:() => current}),
    inputFence: {
      closeInput(reason) {calls.close.push(reason);return Promise.resolve({ok:true,localInputFenced:true,hostAcknowledged:true});},
      resumeInput: async () => ({ok:true,localInputFenced:false,hostAcknowledged:true}),
    },
    prepareSession: async (g,p) => {calls.prepare.push([g,p]);return {profileId:'powershell',cwdDisplay:'D:\\Lucru Știință',envelope:Object.freeze({trusted:true})};},
    createOwnedSession: async p => {calls.create.push(p);return {ownerId:'owner_'+calls.create.length};},
    stopOwnedSession: async p => {calls.stop.push(p);return {ok:true,verifiedExited:true};},
    verifyOwnedExit: async p => {calls.verify.push(p);return {identityKnown:true,verifiedExited:true,remainingCount:0};},
    ...overrides,
  };
  const lifecycle = new TerminalLifecycle(deps);
  return {lifecycle,calls,setCurrent(v){current=v;},async open(){assert.equal((await lifecycle.resumeInput()).ok,true);}};
}
test('default refuses execution; closed configured lifecycle has zero native effects',async () => {
  assert.equal(typeof TerminalLifecycle,'function');
  const unavailable = new TerminalLifecycle();
  assert.equal((await unavailable.create(grant,request())).ok,false);
  assert.equal(unavailable.nativeExecutionAdmitted,false);
  const f=fixture();assert.equal((await f.lifecycle.create(grant,request())).code,'PIN_REQUIRED');
  assert.equal(f.calls.create.length,0);assert.equal(f.calls.prepare.length,0);
});
test('eight pending creates reserve all capacity before awaits; ninth never prepares or starts',async () => {
  const wait=deferred(),f=fixture({prepareSession:async()=>{await wait.promise;return {profileId:'powershell',cwdDisplay:'D:\\work',envelope:{}};}});await f.open();
  const pending=Array.from({length:8},(_,i)=>f.lifecycle.create(grant,request(i)));
  assert.equal(f.lifecycle.snapshot().length,8);assert.ok(f.lifecycle.snapshot().every(s=>s.state==='starting'));
  assert.equal((await f.lifecycle.create(grant,request(9))).code,'CAPACITY_EXCEEDED');assert.equal(f.calls.create.length,0);
  wait.resolve();const all=await Promise.all(pending);assert.ok(all.every(r=>r.ok));assert.equal(new Set(all.map(r=>r.value.sessionId)).size,8);
  assert.equal(f.calls.create.length,8);assert.ok(f.calls.create.every(p=>p.projectId==='project_1'));
});
test('unknown renderer fields and foreign epoch refuse without prepare/create',async () => {
  const f=fixture();await f.open();
  for (const extra of [{command:'python unsafe.py'},{env:{}},{projectId:'foreign'},{executable:'cmd.exe'}])
    assert.equal((await f.lifecycle.create(grant,{...request(),...extra})).code,'REQUEST_REFUSED');
  assert.equal((await f.lifecycle.create(grant,{...request(),epoch:4})).code,'EPOCH_STALE');
  assert.equal(f.calls.prepare.length,0);assert.equal(f.calls.create.length,0);
});
test('Lock fences immediately; late preparation cannot create, running sessions are untouched',async () => {
  const wait=deferred();let count=0;const f=fixture({prepareSession:async()=>{if(++count===2)await wait.promise;return {profileId:'powershell',cwdDisplay:'D:\\work',envelope:{}};}});await f.open();
  const running=await f.lifecycle.create(grant,request());const pending=f.lifecycle.create(grant,request(1));
  const locked=f.lifecycle.closeInput('lock');assert.equal((await f.lifecycle.create(grant,request(2))).code,'PIN_REQUIRED');
  wait.resolve();assert.equal((await pending).ok,false);assert.equal((await locked).hostAcknowledged,true);
  assert.equal(f.calls.create.length,1);assert.equal(f.calls.stop.length,0);
  assert.equal(f.lifecycle.snapshot().find(s=>s.sessionId===running.value.sessionId).state,'running');
});
test('caller revocation while preparing refuses with zero start; internal metadata never trusts renderer project',async () => {
  const wait=deferred(),f=fixture({prepareSession:()=>wait.promise});await f.open();
  const pending=f.lifecycle.create(grant,request());f.setCurrent(false);wait.resolve({profileId:'powershell',cwdDisplay:'D:\\work',envelope:{}});
  assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.calls.create.length,0);
});
test('Lock during native start keeps its reservation until exact owner cleanup is verified',async () => {
  const start=deferred(),cleanup=deferred(),f=fixture({createOwnedSession:()=>start.promise,stopOwnedSession:()=>cleanup.promise});await f.open();
  const pending=f.lifecycle.create(grant,request());await tick();const locked=f.lifecycle.closeInput('lock');
  start.resolve({ownerId:'late_owner'});await tick();
  assert.equal(f.lifecycle.snapshot()[0].state,'stopping');assert.equal(f.lifecycle.snapshot().length,1);
  cleanup.resolve({ok:true,verifiedExited:true});assert.equal((await pending).ok,false);await locked;
  assert.equal(f.calls.verify[0].ownerId,'late_owner');assert.equal(f.lifecycle.snapshot()[0].state,'exited');
});
test('Stop coalesces; unverified cleanup is visible and consumes capacity until a verified retry',async () => {
  const wait=deferred();let verified=false;const f=fixture({stopOwnedSession:()=>wait.promise,verifyOwnedExit:async()=>({identityKnown:verified,verifiedExited:verified,remainingCount:verified?0:1})});await f.open();
  const made=await Promise.all(Array.from({length:8},(_,i)=>f.lifecycle.create(grant,request(i))));
  const p={operationId:'stop_1',epoch:3,sessionId:made[0].value.sessionId};
  const a=f.lifecycle.stop(grant,p),b=f.lifecycle.stop(grant,{...p,operationId:'stop_2'});wait.resolve({ok:true,verifiedExited:true});
  assert.equal((await a).code,'CLEANUP_FAILED');assert.equal((await b).operationId,'stop_2');assert.equal((await b).code,'CLEANUP_FAILED');
  assert.equal(f.lifecycle.snapshot()[0].state,'cleanup-failed');assert.equal((await f.lifecycle.create(grant,request(9))).code,'CAPACITY_EXCEEDED');
  verified=true;assert.equal((await f.lifecycle.stop(grant,p)).ok,true);assert.equal((await f.lifecycle.create(grant,request(9))).ok,true);assert.equal(f.lifecycle.snapshot().length,8);
});
test('unknown native create outcome remains cleanup-failed, never silently frees a possibly live slot',async () => {
  const f=fixture({createOwnedSession:async()=>{throw Error('ACK lost');}});await f.open();
  const r=await f.lifecycle.create(grant,request());assert.equal(r.code,'CLEANUP_FAILED');assert.equal(f.lifecycle.snapshot()[0].state,'cleanup-failed');
  assert.equal((await f.lifecycle.stop(grant,{operationId:'stop',epoch:3,sessionId:f.lifecycle.snapshot()[0].sessionId})).code,'CLEANUP_FAILED');
  assert.equal(f.calls.stop.length,0);
});
test('deadline refuses without later starting after a preparation timeout',async () => {
  const wait=deferred(),timers=[],f=fixture({prepareSession:()=>wait.promise,setTimer:fn=>{timers.push(fn);return fn;},clearTimer:()=>{}});await f.open();
  const pending=f.lifecycle.create(grant,request());timers.at(-1)();assert.equal((await pending).code,'HOST_UNAVAILABLE');
  wait.resolve({profileId:'powershell',cwdDisplay:'D:\\work',envelope:{}});await tick();assert.equal(f.calls.create.length,0);assert.equal(f.lifecycle.snapshot()[0].state,'exited');
});
test('native-start timeout holds uncertain slot; late owner is cleaned, never published or replayed',async () => {
  const start=deferred(),timers=[],f=fixture({createOwnedSession:()=>start.promise,setTimer:fn=>{timers.push(fn);return fn;},clearTimer:()=>{}});await f.open();
  const pending=f.lifecycle.create(grant,request());await tick();timers.at(-1)();assert.equal((await pending).code,'CLEANUP_FAILED');
  assert.equal(f.lifecycle.snapshot()[0].state,'cleanup-failed');start.resolve({ownerId:'late_owner'});await tick();await tick();
  assert.equal(f.calls.stop.length,1);assert.equal(f.calls.stop[0].ownerId,'late_owner');assert.equal(f.lifecycle.snapshot()[0].state,'exited');
});
test('host failure closes input, retains ownership identities and requires verified cleanup on shutdown',async () => {
  const f=fixture();await f.open();await f.lifecycle.create(grant,request());f.lifecycle.hostFailed();
  assert.equal(f.lifecycle.snapshot()[0].state,'host-failed');assert.equal((await f.lifecycle.resumeInput()).code,'HOST_UNAVAILABLE');
  assert.equal((await f.lifecycle.shutdown('quit')).ok,true);assert.equal(f.calls.stop.length,1);assert.equal(f.lifecycle.snapshot()[0].state,'exited');
  assert.equal((await f.lifecycle.create(grant,request(1))).ok,false);
});
test('foreign project Stop and readonly authorization have no owner side effects; snapshots are immutable',async () => {
  const f=fixture();await f.open();const r=await f.lifecycle.create(grant,request()),p={operationId:'stop',epoch:3,sessionId:r.value.sessionId};
  assert.equal((await f.lifecycle.stop({...grant,projectId:'foreign'},p)).code,'SESSION_REFUSED');f.setCurrent(false);
  assert.equal((await f.lifecycle.stop(grant,p)).code,'SENDER_REFUSED');assert.equal(f.calls.stop.length,0);
  const s=f.lifecycle.snapshot();assert.ok(Object.isFrozen(s)&&Object.isFrozen(s[0]));assert.equal('ownerId' in s[0],false);
});
test('Lock invokes its ledger/host fence synchronously before returning a Promise',async()=>{
  const f=fixture();await f.open();const before=f.calls.close.length;
  const pending=f.lifecycle.closeInput('lock');
  assert.equal(f.calls.close.length,before+1,'external input fence must not wait a microtask');
  assert.equal(f.calls.close.at(-1),'lock');await pending;
});
test('late Stop response cannot deliver metadata to a revoked caller; cleanup still completes',async()=>{
  const wait=deferred(),f=fixture({stopOwnedSession:()=>wait.promise});await f.open();
  const made=await f.lifecycle.create(grant,request());
  const pending=f.lifecycle.stop(grant,{operationId:'stop',epoch:3,sessionId:made.value.sessionId});
  await tick();f.setCurrent(false);wait.resolve({ok:true,verifiedExited:true});
  assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.lifecycle.snapshot()[0].state,'exited');
});
test('unsettled native Stop stays single flight after timeout; repeated retries cannot grow the control queue',async t=>{
  const wait=deferred(),timers=[];let stops=0;
  t.after(()=>wait.resolve({ok:true,verifiedExited:true}));
  const f=fixture({stopOwnedSession:()=>{stops++;return wait.promise;},setTimer:fn=>{timers.push(fn);return fn;},clearTimer:()=>{}});await f.open();
  const made=await f.lifecycle.create(grant,request()),p={operationId:'stop',epoch:3,sessionId:made.value.sessionId};
  const pending=f.lifecycle.stop(grant,p);await tick();timers.at(-1)();assert.equal((await pending).code,'CLEANUP_FAILED');
  for(let i=0;i<300;i++)assert.equal((await Promise.race([f.lifecycle.stop(grant,p),tick().then(()=>({code:'UNBOUNDED_PENDING_RETRY'}))])).code,'CLEANUP_FAILED');
  assert.equal(stops,1);wait.resolve({ok:true,verifiedExited:true});await tick();
  assert.equal(f.lifecycle.snapshot()[0].state,'cleanup-failed','late ACK alone cannot upgrade a timed-out Stop');
  assert.equal((await f.lifecycle.stop(grant,p)).ok,true);assert.equal(stops,2);
});
test('timed-out unresolved preparation retains finite pending capacity',async()=>{
  const wait=deferred(),timers=[],f=fixture({prepareSession:()=>wait.promise,setTimer:fn=>{timers.push(fn);return fn;},clearTimer:()=>{}});await f.open();
  const pending=Array.from({length:8},(_,i)=>f.lifecycle.create(grant,request(i)));await tick();
  for(const timeout of timers.slice(-8))timeout();assert.ok((await Promise.all(pending)).every(r=>!r.ok));
  assert.equal((await f.lifecycle.create(grant,request(9))).code,'CAPACITY_EXCEEDED');
  wait.resolve({profileId:'powershell',cwdDisplay:'D:\\work',envelope:{}});await tick();
  assert.equal(f.calls.create.length,0);assert.equal((await f.lifecycle.create(grant,request(9))).ok,true);
});
test('duplicate owner identity is not adopted and cannot Stop a running sibling by alias',async()=>{
  const f=fixture({createOwnedSession:async()=>({ownerId:'same_owner'})});await f.open();
  const first=await f.lifecycle.create(grant,request()),second=await f.lifecycle.create(grant,request(1));
  assert.equal(first.ok,true);assert.equal(second.code,'CLEANUP_FAILED');assert.equal(f.calls.stop.length,0);
  assert.deepEqual(f.lifecycle.snapshot().map(s=>s.state),['running','cleanup-failed']);
});
test('metadata list is project scoped, authorized and unavailable while Locked',async()=>{
  const f=fixture();await f.open();await f.lifecycle.create(grant,request());
  const p={operationId:'list',epoch:3};assert.equal(typeof f.lifecycle.list,'function');
  const own=await f.lifecycle.list(grant,p);assert.equal(own.value.length,1);assert.ok(Object.isFrozen(own.value));
  assert.equal((await f.lifecycle.list({...grant,projectId:'other'},p)).value.length,0);
  const closed=f.lifecycle.closeInput('lock');assert.equal((await f.lifecycle.list(grant,p)).code,'PIN_REQUIRED');await closed;
});
