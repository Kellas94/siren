// Actual composed JS with controlled forwarding of genuine backend authorities.
// No native execution, shell, PTY, renderer or host teardown qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,deferred,inertTick,until} from './fixtures/terminal-production-manager-private.mjs';
const make=h=>h.manager.create(h.grant,{operationId:'authority-create',epoch:h.grant.epoch,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40});
const frozen=v=>Object.freeze(v);
function harness(transform,options={}){
 let original=null,request=null,allocations=0;
 const h=privateManager({...options,wrap:{...options.wrap,captureBackendSettlement:({args,invoke})=>{request=args[0];original=invoke();return transform(original,args[0]);},allocate:({invoke})=>{allocations++;return invoke();}}});
 return {h,get original(){return original;},get request(){return request;},get allocations(){return allocations;}};
}
function handle(original,actualSettled=original.actualSettled,verifiedRelease=original.verifiedRelease){return frozen({sessionId:original.sessionId,channelId:original.channelId,actualSettled,verifiedRelease,snapshot:original.snapshot});}
for(const lane of ['actual','release','both'])test('manager retains exact charge until '+lane+' backend authority drains, without querying cleanup status',async()=>{
 const a=deferred(),r=deferred(),x=harness(o=>handle(o,lane==='release'?o.actualSettled:a.promise,lane==='actual'?o.verifiedRelease:r.promise));const {h}=x;
 try{const s=await h.ready();await h.manager.stop(h.grant,h.packet(s.sessionId));await inertTick();assert.equal(h.manager.stats().reservedSessions,1,'cleanup metadata cannot substitute for held actual/release authority');assert.ok(x.original);assert.equal(x.original.snapshot().actualSettled,true);assert.equal(x.original.snapshot().verifiedReleased,true);assert.equal(h.calls.sessionStatus??0,0,'reclaim cannot ask an effectful status callback for proof');
  if(lane==='both'){a.resolve(await x.original.actualSettled);await inertTick();assert.equal(h.manager.stats().reservedSessions,1);}
  else a.resolve(await x.original.actualSettled);
  r.resolve(await x.original.verifiedRelease);await inertTick();assert.equal(h.manager.stats().reservedSessions,0,'captured receipts reclaim automatically without reconcile');assert.equal(h.composition.state.trace.filter(t=>t.name==='native-stop').length,1);
 }finally{a.resolve();r.resolve();await h.end();}
});
for(const [name,change] of [
 ['foreign session',v=>({...v,sessionId:'foreign'})],['foreign owner',v=>({...v,ownerId:'foreign'})],['foreign channel',v=>({...v,channelId:'foreign'})],['wrong scope',v=>({...v,scope:'SESSION'})],['nonactual',v=>({...v,actualSettled:false})],['unobserved session',v=>({...v,sessionObserved:false})],['native admission',v=>({...v,nativeExecutionAdmitted:true})],['mutable receipt',v=>({...v})],['extra receipt key',v=>({...v,extra:true})]
])test('invalid actual backend authority retains capacity: '+name,async()=>{
 const a=deferred(),x=harness(o=>handle(o,a.promise)),{h}=x;
 try{const s=await h.ready();await h.manager.stop(h.grant,h.packet(s.sessionId));const value=change(await x.original.actualSettled);a.resolve(name==='mutable receipt'?value:frozen(value));await inertTick();assert.equal(h.manager.stats().reservedSessions,1);assert.equal(h.calls.sessionStatus??0,0);}
 finally{a.resolve();await h.end();}
});
for(const [name,change] of [
 ['foreign session',v=>({...v,sessionId:'foreign'})],['foreign owner',v=>({...v,sessionOwnerId:'foreign'})],['wrong scope',v=>({...v,scope:'BACKEND_SESSION'})],['unknown identity after allocation',v=>({...v,identityKnown:false})],['unverified exit',v=>({...v,verifiedExited:false})],['remaining members',v=>({...v,remainingCount:1})],['native admission',v=>({...v,nativeExecutionAdmitted:true})],['mutable receipt',v=>({...v})],['extra receipt key',v=>({...v,extra:true})]
])test('invalid backend release never substitutes for actual completion: '+name,async()=>{
 const r=deferred(),x=harness(o=>handle(o,o.actualSettled,r.promise)),{h}=x;
 try{const s=await h.ready();await h.manager.stop(h.grant,h.packet(s.sessionId));const value=change(await x.original.verifiedRelease);r.resolve(name==='mutable receipt'?value:frozen(value));await inertTick();assert.equal(h.manager.stats().reservedSessions,1);assert.equal(h.calls.sessionStatus??0,0);}
 finally{r.resolve();await h.end();}
});
for(const lane of ['actual','release'])test('rejected '+lane+' backend authority retains its slot',async()=>{
 const a=deferred(),r=deferred();a.promise.catch(()=>{});r.promise.catch(()=>{});const x=harness(o=>handle(o,a.promise,r.promise)),{h}=x;
 try{const s=await h.ready();await h.manager.stop(h.grant,h.packet(s.sessionId));if(lane==='actual'){a.reject(Error('controlled actual'));r.resolve(await x.original.verifiedRelease);}else{a.resolve(await x.original.actualSettled);r.reject(Error('controlled release'));}await inertTick();assert.equal(h.manager.stats().reservedSessions,1);}
 finally{a.resolve();r.resolve();await h.end();}
});
test('backend capture happens before allocation and cannot invoke own Promise then or passive snapshot',async()=>{
 let getters=0,snapshots=0;const x=harness(o=>{for(const p of [o.actualSettled,o.verifiedRelease])Object.defineProperty(p,'then',{get(){getters++;throw Error('Own then forbidden');}});return frozen({...o,snapshot(){snapshots++;throw Error('Status cannot grant authority');}});}),{h}=x;
 try{const s=await h.ready();assert.equal(x.allocations,1);assert.equal(h.calls.captureBackendSettlement,1);await h.manager.stop(h.grant,h.packet(s.sessionId));await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(getters,0);assert.equal(snapshots,0);assert.equal(h.calls.sessionStatus??0,0);}
 finally{await h.end();}
});
for(const kind of ['null','wrong session','wrong channel','accessor actual','mutable','unsupported release'])test('unusable backend capture refuses before allocation: '+kind,async()=>{
 let getters=0;const x=harness(o=>{if(kind==='null')return null;const v={...o};if(kind==='wrong session')v.sessionId='foreign';if(kind==='wrong channel')v.channelId='foreign';if(kind==='accessor actual')Object.defineProperty(v,'actualSettled',{enumerable:true,get(){getters++;throw Error('Do not invoke');}});if(kind==='unsupported release')v.verifiedRelease={then(){getters++;}};return kind==='mutable'?v:frozen(v);}),{h}=x;
 try{assert.equal((await h.manager.resumeInput()).ok,true);assert.equal((await make(h)).ok,false);await inertTick();assert.equal(x.allocations,0);assert.equal(getters,0);assert.equal(h.manager.stats().reservedSessions,1);}
 finally{await h.end();}
});
test('ordinary Lock keeps the captured backend lifetime running and permits reattachment after resume',async()=>{
 const x=harness(o=>o),{h}=x;try{const s=await h.ready(),l=(await h.attach(s)).value;assert.ok(l);await h.manager.closeInput('lock');assert.equal(x.original.snapshot().retired,false);assert.equal(h.manager.stats().reservedSessions,1);assert.equal((await h.manager.resumeInput()).ok,true);assert.equal((await h.attach(s)).ok,true);await h.manager.stop(h.grant,h.packet(s.sessionId));await inertTick();assert.equal(h.manager.stats().reservedSessions,0);}
 finally{await h.end();}
});
test('genuine backend read cancellation remains charged after public Stop and manager pending work drain',async()=>{
 const x=harness(o=>o,{deadlineMs:25}),{h}=x;
 try{const s=await h.ready();h.composition.holdReadCancellation(s.sessionId);await h.manager.stop(h.grant,h.packet(s.sessionId));await until(()=>h.manager.stats().pendingOperations===0,'manager public Stop observer unwound');assert.equal(x.original.snapshot().actualSettled,false);assert.equal(h.manager.stats().reservedSessions,1);assert.equal(h.calls.sessionStatus??0,0);h.composition.releaseReads();await until(()=>x.original.snapshot().actualSettled,'actual backend read cancellation finished');await until(()=>h.manager.stats().reservedSessions===0,'backend authority auto-reclaimed manager');assert.equal(h.composition.state.trace.filter(t=>t.name==='native-stop').length,1);}
 finally{h.composition.releaseReads();await h.end();}
});
test('eight held backend authority lifetimes refuse ninth before any admission callback and reclaim without polling',async()=>{
 const pending=[];const x=harness(o=>{const a=deferred();pending.push({a,o});return handle(o,a.promise);}),{h}=x;
 try{assert.equal((await h.manager.resumeInput()).ok,true);for(let i=0;i<8;i++){const s=await make(h);assert.equal(s.ok,true);await h.manager.stop(h.grant,h.packet(s.value.sessionId));}assert.equal(h.manager.stats().reservedSessions,8);const before={...h.calls};assert.equal((await make(h)).code,'CAPACITY_EXCEEDED');assert.deepEqual({...h.calls},before,'ninth cannot enter backend or admission callbacks');for(const {a,o}of pending)a.resolve(await o.actualSettled);await until(()=>h.manager.stats().reservedSessions===0,'all exact backend lifetimes completed');assert.equal((await make(h)).ok,true);}
 finally{for(const {a}of pending)a.resolve();await h.end();}
});
