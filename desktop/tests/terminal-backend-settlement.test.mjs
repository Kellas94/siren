import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionBackend} from '../src/terminal/production-backend.mjs';
import {ProductionAggregateGateLink} from '../src/terminal/production-aggregate-gate.mjs';
import {createInertProductionComposition,inertConfig,inertTick,INERT_RUNTIME} from './fixtures/terminal-production-inert.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
test('legacy aggregate reserve/release remains public control',()=>{const a=new ProductionAggregateGateLink({resolveLink:()=>null});assert.equal(a.reserve('a').ok,true);assert.equal(a.release('a').ok,true);assert.equal(a.stats().sessions,0);a.dispose();});
test('legacy prepared backend public cleanup remains control',async()=>{const s=createInertProductionComposition();try{const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);assert.equal((await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:200,code:98})).ok,true);}finally{await s.dispose();}});
test('backend stable captured lifetime is separate from public cleanup',async()=>{const s=createInertProductionComposition();try{const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);assert.equal(typeof TerminalProductionBackend.prototype.captureBackendSettlement,'function');const h=s.backend.captureBackendSettlement({ownerId:p.ownerId});assert.equal(h,s.backend.captureBackendSettlement({ownerId:p.ownerId}));assert.equal(h.snapshot().actualSettled,false);await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:200,code:98});assert.equal((await h.actualSettled).scope,'BACKEND_SESSION');}finally{await s.dispose();}});
test('provisional backend roster exists before first admission reentry',async()=>{const s=createInertProductionComposition();try{assert.equal(typeof TerminalProductionBackend.prototype.captureBackendSettlementRoster,'function');let seen;const p=s.backend.prepare(inertConfig(),{isCurrent(){seen=s.backend.captureBackendSettlementRoster();return false;}});assert.equal(p.ok,false);assert.equal(seen.length,1);assert.equal((await seen[0].actualSettled).sessionObserved,false);}finally{await s.dispose();}});
test('aggregate original held send outlives public release wrapper',async()=>{const d=deferred();let sends=0;const link={sendGate(){sends++;return d.promise;},isAvailable(){return true;},subscribeUnavailable(){},dispose(){}};const a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});a.reserve('a');await a.bind('a','channel');const publicSend=a.sendGate({generation:1,open:true});assert.equal(sends,1);a.release('a');assert.equal((await publicSend).ok,true);assert.equal(typeof ProductionAggregateGateLink.prototype.captureSessionSettlement,'function');d.resolve({ok:true,generation:1,open:true});await inertTick();a.dispose();});

const until=async(p,label='condition')=>{for(let n=0;n<1000&&!p();n++)await inertTick();assert(p(),label);};
const pending=async p=>{let done=false;p.then(()=>done=true,()=>done=true);await inertTick();assert.equal(done,false);};
const METHODS=['prepareSession','allocateSession','connectSession','assertSessionCurrent','watchSessionRoot','captureSession','stopSession','verifyExit','captureSessionSettlement'];
function observed(options={},wrap={}){
 const base=createInertProductionComposition({deadlineMs:200,...options}),facet=Object.create(null),calls=[];
 for(const name of METHODS){const fn=base.ownership[name].bind(base.ownership);facet[name]=(...args)=>{calls.push(name);return wrap[name]?wrap[name](fn,...args):fn(...args);};}
 const backend=new TerminalProductionBackend({ownership:facet,hostOwnerId:base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:200});
 return{base,facet,backend,calls,guard:base.guard,async dispose(){await base.dispose();}};
}
async function prepare(h,id='a'){await h.backend.sendGate({generation:1,open:true});const p=h.backend.prepare(inertConfig(id),h.guard);assert.equal(p.ok,true);return p;}
async function readyBackend(h,id='a'){const p=await prepare(h,id);assert.equal(h.backend.allocate({ownerId:p.ownerId}).ok,true);assert.equal((await h.backend.connect({ownerId:p.ownerId},h.guard)).ok,true);return p;}
const stopBackend=(h,p,deadlineMs=100)=>h.backend.stopSession({ownerId:p.ownerId,deadlineMs,code:98});
async function aggregateFixture(send=packet=>Promise.resolve({ok:true,...packet}),available=()=>true){let listener;const link={sendGate:send,isAvailable:available,subscribeUnavailable:f=>listener=f,dispose(){}};const aggregate=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true}),deadlineMs:200});assert.equal(aggregate.reserve('a').ok,true);assert.equal((await aggregate.bind('a','c')).ok,true);return{aggregate,lose:()=>listener()};}

test('aggregate captures exact original normal and fallback work after public loss',async()=>{
 const normal=deferred(),fallback=deferred();let sends=0;const f=await aggregateFixture(()=>++sends===1?normal.promise:fallback.promise);const h=f.aggregate.captureSessionSettlement('a');const publicSend=f.aggregate.sendGate({generation:1,open:true});f.lose();assert.equal((await publicSend).ok,false);assert.equal(sends,2);f.aggregate.release('a');assert.equal(f.aggregate.captureSessionSettlement('a'),null);await pending(h.actualSettled);normal.resolve({ok:true,generation:1,open:true});await pending(h.actualSettled);fallback.resolve({ok:true,generation:2,open:false});assert.equal((await h.actualSettled).scope,'AGGREGATE_SESSION');f.aggregate.dispose();assert.equal(sends,2);
});
test('aggregate reserveObserved keeps original handle under availability deletion and replacement',async()=>{
 let a,armed=false,old,replacement;const link={sendGate:p=>Promise.resolve({ok:true,...p}),subscribeUnavailable(){},dispose(){},isAvailable(){if(armed){armed=false;old=a.captureSessionSettlement('new');assert(old);assert.equal(old.snapshot().activeFrames,1);a.release('new');replacement=a.reserveObserved('new');}return true;}};
 a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});a.reserve('a');await a.bind('a','c');armed=true;const original=a.reserveObserved('new');assert.equal(original.result.ok,false);assert.equal(original.settlement,old);assert.equal(replacement.result.ok,true);assert.notEqual(replacement.settlement,old);assert.equal(a.captureSessionSettlement('new'),replacement.settlement);await old.actualSettled;assert.equal(replacement.settlement.snapshot().actualSettled,false);a.dispose();
});
test('aggregate loss reserves fallback before listener release and notification unwind',async()=>{
 const d=deferred();let h,inside=false,sends=0,a;const link={sendGate(){sends++;return d.promise;},isAvailable:()=>true,subscribeUnavailable(){},dispose(){assert.equal(h.snapshot().actualSettled,false);}};
 a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true}),onUnavailable(){inside=true;assert.equal(h.snapshot().actualSettled,false);assert(h.snapshot().activeFrames>0);inside=false;}});a.reserve('a');await a.bind('a','c');h=a.captureSessionSettlement('a');a.subscribeUnavailable(()=>{a.release('a');assert.equal(h.snapshot().actualSettled,false);});a.dispose();assert.equal(inside,false);assert.equal(sends,1);await pending(h.actualSettled);d.resolve({ok:false,generation:1,open:false});await h.actualSettled;
});
test('aggregate retains eight released held lifetimes and reuses only actual completed cell',async()=>{
 const ds=[],handles=[],links=new Map();const a=new ProductionAggregateGateLink({resolveLink:s=>({link:links.get(s),initiallyClosed:true})});
 for(let i=0;i<8;i++){const d=deferred(),id='s'+i;let hold=false;ds.push(d);links.set(id,{sendGate:packet=>hold?d.promise:Promise.resolve({ok:true,...packet}),isAvailable:()=>true,subscribeUnavailable(){},dispose(){}});assert.equal(a.reserve(id).ok,true);assert.equal((await a.bind(id,'c'+i)).ok,true);hold=true;handles.push(a.captureSessionSettlement(id));const p=a.sendGate({generation:i+1,open:true});a.release(id);await p;}
 assert.equal(a.stats().sessions,0);assert.equal(a.reserve('ninth').code,'CAPACITY_EXCEEDED');await pending(handles[0].actualSettled);ds[0].resolve({ok:true,generation:1,open:true});await handles[0].actualSettled;assert.equal(a.reserve('ninth').ok,true);for(let i=1;i<8;i++)ds[i].resolve({ok:true,generation:i+1,open:true});a.dispose();await Promise.all(handles.map(h=>h.actualSettled));
});
test('aggregate same-ID successor cannot settle old original work',async()=>{
 const d=deferred();const f=await aggregateFixture(()=>d.promise),old=f.aggregate.captureSessionSettlement('a');const p=f.aggregate.sendGate({generation:1,open:true});f.aggregate.release('a');await p;const next=f.aggregate.reserveObserved('a');assert.equal(next.result.ok,true);assert.notEqual(next.settlement,old);f.aggregate.release('a');await next.settlement.actualSettled;await pending(old.actualSettled);d.resolve({ok:true,generation:1,open:true});await old.actualSettled;f.aggregate.dispose();
});
test('aggregate canonical own then is observable despite unchanged public decoration refusal',async()=>{
 let getters=0;const ds=[];const f=await aggregateFixture(()=>{const d=deferred();Object.defineProperty(d.promise,'then',{get(){getters++;throw Error();}});ds.push(d);return d.promise;});const h=f.aggregate.captureSessionSettlement('a');assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);assert.equal(ds.length,2);assert.equal(getters,0);assert.equal(h.snapshot().unknown,false);await pending(h.actualSettled);ds.forEach((d,i)=>d.resolve({ok:false,generation:i+1,open:!i}));await h.actualSettled;assert.equal(getters,0);f.aggregate.dispose();
});
for(const mode of ['throw','thenable','proxy','constructor'])test('aggregate entered '+mode+' send remains unknown without traps',async()=>{
 let traps=0;const f=await aggregateFixture(()=>{if(mode==='throw')throw Error();if(mode==='thenable')return{get then(){traps++;throw Error();}};if(mode==='proxy')return new Proxy(Promise.resolve(),{get(){traps++;throw Error();}});const p=Promise.resolve();Object.defineProperty(p,'constructor',{get(){traps++;throw Error();}});return p;});const h=f.aggregate.captureSessionSettlement('a');assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);assert.equal(traps,0);assert.equal(h.snapshot().unknown,true);await pending(h.actualSettled);f.aggregate.release('a');await pending(h.actualSettled);f.aggregate.dispose();
});
test('aggregate observable rejected originals settle negative after public failure',async()=>{const f=await aggregateFixture(()=>Promise.reject(Error('negative')));const h=f.aggregate.captureSessionSettlement('a');assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);await h.actualSettled;assert.equal(h.snapshot().unknown,false);f.aggregate.dispose();});
test('backend real release forwards exact Session receipt identity and snapshots are passive',async()=>{
 const h=observed();try{const p=await prepare(h),s=h.base.ownership.captureSessionSettlement({sessionOwnerId:p.ownerId}),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});assert.equal(b,h.backend.captureBackendSettlementRoster()[0]);const calls=[...h.calls];for(let i=0;i<5;i++){assert.equal(b.snapshot().ownerId,p.ownerId);h.backend.captureBackendSettlement({ownerId:p.ownerId});h.backend.captureBackendSettlementRoster();}assert.deepEqual(h.calls,calls);await stopBackend(h,p);assert.equal(await b.verifiedRelease,await s.verifiedRelease);assert.equal((await b.actualSettled).sessionObserved,true);assert.equal(h.backend.captureBackendSettlementRoster().length,0);}finally{await h.dispose();}
});
test('backend full connect worker remains held after real ownership release',async()=>{
 const d=deferred();let actual,done=false;const h=observed({}, {connectSession(fn,...args){const p=fn(...args);p.then(v=>{actual=v;done=true;},()=>{});return d.promise;}});try{const p=await prepare(h);h.backend.allocate({ownerId:p.ownerId});const b=h.backend.captureBackendSettlement({ownerId:p.ownerId}),connecting=h.backend.connect({ownerId:p.ownerId},h.guard);await until(()=>done);const stopped=await stopBackend(h,p);assert.equal(stopped.ok,true);assert.equal((await connecting).ok,false);assert.equal(b.snapshot().connectWorker,true);await pending(b.actualSettled);d.resolve(actual);await b.actualSettled;assert.equal(b.snapshot().connectWorker,false);assert.equal(h.base.state.spawns.length,0);}finally{if(actual)d.resolve(actual);await h.dispose();}
});
test('backend Stop helper return and real Session release do not erase original forwarding observer',async()=>{
 const d=deferred();let actual,done=false,calls=0;const h=observed({}, {stopSession(fn,...args){calls++;const p=fn(...args);p.then(v=>{actual=v;done=true;});return d.promise;}});try{const p=await prepare(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId}),stopping=stopBackend(h,p);await until(()=>done);await b.verifiedRelease;assert.equal(b.snapshot().stopWorker,false);assert.equal(b.snapshot().stopObserverPending,true);await pending(b.actualSettled);d.resolve(actual);assert.equal((await stopping).ok,true);await b.actualSettled;assert.equal(calls,1);}finally{if(actual)d.resolve(actual);await h.dispose();}
});
test('backend late real Session release retires aggregate after fixed public timeout without verification query',async()=>{
 const h=observed({manualNative:true});try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId}),s=h.base.ownership.captureSessionSettlement({sessionOwnerId:p.ownerId});h.base.holdReadCancellation('a');const stopping=stopBackend(h,p,15);const first=await stopping;assert.equal(first.ok,false);await pending(b.actualSettled);const verifications=h.calls.filter(x=>x==='verifyExit').length;h.base.completeNative('a');await pending(b.actualSettled);h.base.releaseReads();await b.actualSettled;assert.equal(await b.verifiedRelease,await s.verifiedRelease);assert.equal(h.calls.filter(x=>x==='verifyExit').length,verifications);assert.equal(first.ok,false);assert.equal((await stopBackend(h,p)).ok,true);assert.equal(h.calls.filter(x=>x==='verifyExit').length,verifications);}finally{await h.dispose();}
});
test('backend legacy absent optional capture preserves public cached results but retains unknown cell',async()=>{
 const h=observed();delete h.facet.captureSessionSettlement;const b=new TerminalProductionBackend({ownership:h.facet,hostOwnerId:h.base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:200});try{const p=b.prepare(inertConfig('legacy'),h.guard);assert.equal(p.ok,true);const s=b.captureBackendSettlement({ownerId:p.ownerId});assert.equal((await b.stopSession({ownerId:p.ownerId,deadlineMs:100,code:98})).ok,true);assert.equal(b.stats().retainedReservations,0);assert.equal(s.snapshot().observationUnavailable,true);assert.equal(s.snapshot().unknown,true);assert.equal(b.captureBackendSettlementRoster().length,1);await pending(s.actualSettled);await pending(s.verifiedRelease);}finally{await h.dispose();}
});
test('backend invalid optional capture descriptor executes zero getters and cannot borrow cached verification',async()=>{
 let reads=0;const h=observed();Object.defineProperty(h.facet,'captureSessionSettlement',{get(){reads++;throw Error();}});const b=new TerminalProductionBackend({ownership:h.facet,hostOwnerId:h.base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:200});try{const p=b.prepare(inertConfig('invalid'),h.guard);assert.equal(p.ok,true);const s=b.captureBackendSettlement({ownerId:p.ownerId});await b.stopSession({ownerId:p.ownerId,deadlineMs:100,code:98});assert.equal(reads,0);assert.equal(s.snapshot().unknown,true);await pending(s.actualSettled);}finally{await h.dispose();}
});
test('backend captures optional method once and rejects malformed passive lookup without traps',async()=>{
 const h=observed();h.facet.captureSessionSettlement=()=>assert.fail('late shadow');try{const p=await prepare(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});let traps=0;const proxy=new Proxy({},{get(){traps++;},ownKeys(){traps++;return[];},getPrototypeOf(){traps++;return null;}});assert.equal(h.backend.captureBackendSettlement(proxy),null);assert.equal(h.backend.captureBackendSettlement({ownerId:p.ownerId},1),null);assert.equal(h.backend.captureBackendSettlementRoster(1),null);assert.equal(traps,0);assert(Object.isFrozen(b));await stopBackend(h,p);await b.actualSettled;}finally{await h.dispose();}
});
test('backend eight provisional guards exist before effects and known local refusal retires them',async()=>{
 const h=observed();const handles=[];try{const recurse=i=>h.backend.prepare(inertConfig('p'+i),{isCurrent(){const roster=h.backend.captureBackendSettlementRoster();handles.push(roster.at(-1));assert.equal(roster.length,i+1);if(i<7)assert.equal(recurse(i+1).ok,false);else assert.equal(h.backend.prepare(inertConfig('ninth'),h.guard).ok,false);assert.equal(roster.at(-1).snapshot().activeFrames,1);return false;}});assert.equal(recurse(0).ok,false);await Promise.all(handles.map(h=>h.actualSettled));assert.equal(h.backend.captureBackendSettlementRoster().length,0);assert.equal(h.calls.includes('prepareSession'),false);}finally{await h.dispose();}
});
test('backend eight entered ambiguous prepares retain eight unknown cells with no synthetic Session',async()=>{
 const h=observed();let b,entered=0;const facet={...h.facet,prepareSession(){const i=entered++;if(i<7)b.prepare(inertConfig('u'+(i+1)),h.guard);else assert.equal(b.prepare(inertConfig('ninth'),h.guard).ok,false);return null;}};b=new TerminalProductionBackend({ownership:facet,hostOwnerId:h.base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:200});try{assert.equal(b.prepare(inertConfig('u0'),h.guard).ok,false);assert.equal(entered,8);const roster=b.captureBackendSettlementRoster();assert.equal(roster.length,8);for(const s of roster){assert.equal(s.snapshot().unknown,true);assert.equal(s.snapshot().sessionObserved,false);await pending(s.actualSettled);}}finally{await h.dispose();}
});
test('backend complete outer install remains occupied through post-ACK endpoint callback',async()=>{
 let armed=false,checks=0,nested,b,insideSnapshot;const h=observed({}, {assertSessionCurrent(fn,...args){const result=fn(...args);if(armed&&++checks===2){insideSnapshot=b.snapshot();nested=h.backend.install({ownerId:b.snapshot().ownerId,windowId:'w2',epoch:4,leaseId:'l2',generation:2},h.guard);}return result;}});try{const p=await readyBackend(h);b=h.backend.captureBackendSettlement({ownerId:p.ownerId});armed=true;const result=await h.backend.install({ownerId:p.ownerId,windowId:'w',epoch:4,leaseId:'l',generation:1},h.guard);assert.equal(result.ok,true);assert.equal((await nested).ok,false);assert.equal(insideSnapshot.commandWorker,true);assert.equal(b.snapshot().commandWorker,false);await stopBackend(h,p);await b.actualSettled;}finally{await h.dispose();}
});
test('backend actual negative Session completion never publishes verified release or reusable cell',async()=>{
 const h=observed({finalIdentityMismatch:true});try{const p=await prepare(h);h.backend.allocate({ownerId:p.ownerId});const b=h.backend.captureBackendSettlement({ownerId:p.ownerId});assert.equal((await stopBackend(h,p)).ok,false);await b.actualSettled;await pending(b.verifiedRelease);assert.equal(h.backend.captureBackendSettlementRoster().length,1);assert.equal(b.snapshot().unknown,false);}finally{await h.dispose();}
});
test('backend allocated identity rule rejects real listeners-only release after allocation refusal',async()=>{
 const h=observed();try{const p=await prepare(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId}),s=h.base.ownership.captureSessionSettlement({sessionOwnerId:p.ownerId});h.base.setLifetime(false);assert.equal(h.backend.allocate({ownerId:p.ownerId}).ok,false);assert.equal((await s.verifiedRelease).identityKnown,false);await boundedSourceActual(b.actualSettled);assert.equal(b.snapshot().unknown,false);await pending(b.verifiedRelease);assert.equal(h.backend.captureBackendSettlementRoster().length,1);}finally{await h.dispose();}
});
for(const mode of ['constructor','species'])test('aggregate inherited '+mode+' mutation refuses observation without getter execution',async()=>{
 let getters=0;const target=mode==='constructor'?Promise.prototype:Promise,key=mode==='constructor'?'constructor':Symbol.species,original=Object.getOwnPropertyDescriptor(target,key);const f=await aggregateFixture(()=>{Object.defineProperty(target,key,{configurable:true,get(){getters++;return Promise;}});return Promise.resolve({ok:false,generation:1,open:true});});const h=f.aggregate.captureSessionSettlement('a');let result;try{result=f.aggregate.sendGate({generation:1,open:true});}finally{Object.defineProperty(target,key,original);}assert.equal((await result).ok,false);assert.equal(getters,0);assert.equal(h.snapshot().unknown,true);await pending(h.actualSettled);f.aggregate.dispose();
});
test('aggregate retireObserved is exact control retirement and refuses stale successor handles',async()=>{
 const d=deferred(),f=await aggregateFixture(()=>d.promise),old=f.aggregate.captureSessionSettlement('a');const p=f.aggregate.sendGate({generation:1,open:true});assert.equal(f.aggregate.retireObserved(old).ok,true);await p;const next=f.aggregate.reserveObserved('a');assert.equal(next.result.ok,true);assert.equal(f.aggregate.retireObserved(old).ok,false);assert.equal(f.aggregate.captureSessionSettlement('a'),next.settlement);await pending(old.actualSettled);assert.equal(f.aggregate.retireObserved(next.settlement).ok,true);await next.settlement.actualSettled;d.resolve({ok:true,generation:1,open:true});await old.actualSettled;f.aggregate.dispose();
});
test('backend command timeout cannot join held original lane write and read cancellation',async()=>{
 const h=observed();try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});h.base.holdWrite('main','command');h.base.holdReadCancellation('a');const failed=await h.backend.install({ownerId:p.ownerId,windowId:'w',epoch:4,leaseId:'l',generation:1},h.guard);assert.equal(failed.ok,false);await until(()=>h.base.state.trace.some(r=>r.name==='native-stop'));assert.equal(b.snapshot().commandWorker,false);await pending(b.actualSettled);h.base.releaseWrites();await pending(b.actualSettled);h.base.releaseReads();await b.actualSettled;assert.equal(h.base.state.trace.filter(r=>r.name==='native-stop').length,1);assert.equal(failed.ok,false);assert.equal((await h.backend.input({ownerId:p.ownerId,leaseId:'l',generation:1,inputSequence:0,data:'no replay'},h.guard)).accepted,false);assert.equal(h.base.state.spawns.length,1);}finally{await h.dispose();}
});
test('backend short quiesce budget starts one real Stop while control I/O remains held',async()=>{
 const h=observed();try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});h.base.holdWrite('main','control');const first=await stopBackend(h,p,15);assert.equal(first.ok,false);assert.equal(h.base.state.trace.filter(r=>r.name==='native-stop').length,1);await pending(b.actualSettled);h.base.releaseWrites();await b.actualSettled;assert.equal(first.ok,false);assert.equal(h.base.state.trace.filter(r=>r.name==='native-stop').length,1);}finally{await h.dispose();}
});
test('backend canonical rejected connect is settled negative rather than unobservable',async()=>{
 const h=observed({}, {connectSession(fn,...args){return fn(...args).then(()=>{throw Error('observed-negative');});}});try{const p=await prepare(h);h.backend.allocate({ownerId:p.ownerId});const b=h.backend.captureBackendSettlement({ownerId:p.ownerId});assert.equal((await h.backend.connect({ownerId:p.ownerId},h.guard)).ok,false);await b.actualSettled;assert.equal(b.snapshot().unknown,false);await b.verifiedRelease;}finally{await h.dispose();}
});
for(const operation of ['connectSession','stopSession'])test('backend original '+operation+' unobservable wrapper stays unknown after real Session release',async()=>{
 let traps=0;const wrap={[operation](fn,...args){fn(...args);return{get then(){traps++;throw Error();}};}};const h=observed({},wrap);try{const p=await prepare(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});if(operation==='connectSession'){h.backend.allocate({ownerId:p.ownerId});assert.equal((await h.backend.connect({ownerId:p.ownerId},h.guard)).ok,false);}else assert.equal((await stopBackend(h,p)).ok,false);await b.verifiedRelease;assert.equal(traps,0);assert.equal(b.snapshot().unknown,true);await pending(b.actualSettled);assert.equal(h.backend.captureBackendSettlementRoster().length,1);}finally{await h.dispose();}
});
test('backend eight legacy verified caller results cannot reuse unobserved actual cells',async()=>{
 const h=observed();delete h.facet.captureSessionSettlement;const b=new TerminalProductionBackend({ownership:h.facet,hostOwnerId:h.base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:200});try{for(let i=0;i<8;i++){const p=b.prepare(inertConfig('legacy'+i),h.guard);assert.equal(p.ok,true);assert.equal((await b.stopSession({ownerId:p.ownerId,deadlineMs:100,code:98})).ok,true);}assert.equal(b.stats().retainedReservations,0);assert.equal(b.captureBackendSettlementRoster().length,8);assert.equal(b.prepare(inertConfig('ninth'),h.guard).ok,false);}finally{await h.dispose();}
});
test('aggregate terminal cleanup is one shot and later release cannot enter work after settlement',async()=>{
 let h;const states=[],link={sendGate:()=>Promise.reject(Error('negative')),isAvailable:()=>true,subscribeUnavailable(){},dispose(){states.push(h.snapshot().actualSettled);}};const a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});a.reserve('a');await a.bind('a','c');h=a.captureSessionSettlement('a');assert.equal((await a.sendGate({generation:1,open:true})).ok,false);await h.actualSettled;a.dispose();a.release('a');a.dispose();assert.deepEqual(states,[false]);
});
test('aggregate first cleanup reentry cannot repeat callback or retire a same-ID successor',async()=>{
 let a,old,successor,calls=0;const link={sendGate:p=>Promise.resolve({ok:true,...p}),isAvailable:()=>true,subscribeUnavailable(){},dispose(){calls++;assert.equal(old.snapshot().actualSettled,false);assert(old.snapshot().activeFrames>0);assert.equal(a.retireObserved(old).ok,false);successor=a.reserveObserved('a');assert.equal(successor.result.ok,true);assert.equal(a.retireObserved(old).ok,false);assert.equal(a.captureSessionSettlement('a'),successor.settlement);a.dispose();}};
 a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});a.reserve('a');await a.bind('a','c');old=a.captureSessionSettlement('a');assert.equal(a.release('a').ok,true);await old.actualSettled;await successor.settlement.actualSettled;assert.notEqual(old,successor.settlement);assert.equal(calls,1);a.release('a');a.dispose();assert.equal(calls,1);
});
test('backend native connect await ignores own then getter on original observable Promise',async()=>{
 let getters=0;const h=observed({}, {connectSession(fn,...args){const p=fn(...args);Object.defineProperty(p,'then',{get(){getters++;throw Error();}});return p;}});try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});assert.equal(getters,0);await stopBackend(h,p);await b.actualSettled;assert.equal(getters,0);}finally{await h.dispose();}
});
for(const mode of ['constructor','species'])test('aggregate quiesce '+mode+' mutation cannot reenter inherited getters through joins',async()=>{
 let getters=0;const target=mode==='constructor'?Promise.prototype:Promise,key=mode==='constructor'?'constructor':Symbol.species,original=Object.getOwnPropertyDescriptor(target,key);const f=await aggregateFixture(()=>{Object.defineProperty(target,key,{configurable:true,get(){getters++;return Promise;}});queueMicrotask(()=>Object.defineProperty(target,key,original));return Promise.resolve({ok:false,generation:1,open:false});});const h=f.aggregate.captureSessionSettlement('a');try{assert.equal((await f.aggregate.quiesce('a')).ok,false);assert.equal(getters,0);assert.equal(h.snapshot().unknown,true);await pending(h.actualSettled);}finally{Object.defineProperty(target,key,original);f.aggregate.dispose();}
});

// Literal independent reflection fixtures/events/assertions; no native execution.
const P=Promise,observations=[];
const resolved=v=>new P(resolve=>resolve(v));
const tick=()=>new P(resolve=>setImmediate(resolve));

function poisoning(mode){
 const target=mode==='constructor'?P.prototype:P,key=mode==='constructor'?'constructor':Symbol.species;
 const original=Object.getOwnPropertyDescriptor(target,key),traps=[];let active=false;
 return {traps,arm(){if(active)return;active=true;Object.defineProperty(target,key,{configurable:true,get(){traps.push(new Error('candidate getter observation').stack);return P;}});},restore(){if(active){Object.defineProperty(target,key,original);active=false;}}};
}
for(const mode of ['constructor','species'])test('aggregate bind refuses inherited '+mode+' getter without executing it',async()=>{
 const poison=poisoning(mode);let handle;
 const link={sendGate:p=>resolved({ok:true,...p}),isAvailable:()=>true,subscribeUnavailable(){},dispose(){}};
 const a=new ProductionAggregateGateLink({resolveLink:()=>{poison.arm();return{link,initiallyClosed:true};},setTimer:()=>1,clearTimer(){}});
 assert.equal(a.reserve('a').ok,true);handle=a.captureSessionSettlement('a');let pending;
 try{pending=a.bind('a','c');}finally{poison.restore();}
 const reply=await pending;const row={case:'aggregate-bind-'+mode,getters:poison.traps.length,stacks:poison.traps,publicReply:reply,lifetime:handle.snapshot()};observations.push(row);
 a.dispose();
 assert.equal(reply.ok,false);assert.equal(row.lifetime.unknown,true);
 assert.equal(poison.traps.length,0,'guarded bind must not execute inherited Promise getter');
});
const image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const config=()=>({sessionId:'a',projectId:'project1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Work',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows'}},cols:120,rows:40});
const creator={executable:'C:\\SIREN\\electron.exe',entry:'C:\\SIREN\\production-creator-entry.mjs',directory:'C:\\SIREN'};
function backendFixture(mode){
 const poison=poisoning(mode),actual=deferred(),release=deferred();let prepared,stops=0,verify=0,registrations=0;const callbacks={};
 const ownership={
  prepareSession(p){prepared=p;return{ok:true,sessionOwnerId:'owner1'};},allocateSession(){return{ok:true};},
  connectSession(){const transport={sessionId:prepared.sessionId,channelId:prepared.channelId};
   for(const lane of ['control','history','command']){
    const events=new Map();const stream={writableLength:0,on(event,cb){events.set(event,cb);registrations++;if(lane==='command'&&event==='drain'){poison.arm();queueMicrotask(()=>poison.restore());}return this;},write(){return true;},destroy(){events.get('close')?.();}};
    callbacks[lane]=events;transport[lane]={stream,secret:Buffer.alloc(32,lane.length+1)};
   }return resolved({ok:true,transport});
  },assertSessionCurrent(){return true;},watchSessionRoot(){return{ok:true};},captureSession(){return{ok:true};},
  captureSessionSettlement(){return Object.freeze({sessionOwnerId:'owner1',sessionId:'a',actualSettled:actual.promise,verifiedRelease:release.promise,snapshot:()=>Object.freeze({})});},
  stopSession(){stops++;release.resolve(Object.freeze({scope:'SESSION',sessionOwnerId:'owner1',sessionId:'a',identityKnown:true,verifiedExited:true,remainingCount:0,nativeExecutionAdmitted:false}));actual.resolve(Object.freeze({scope:'SESSION',sessionOwnerId:'owner1',sessionId:'a',actualSettled:true,verifiedExited:true,nativeExecutionAdmitted:false}));return resolved({ok:true,verifiedExited:true});},
  verifyExit(){verify++;return{identityKnown:true,verifiedExited:true,remainingCount:0};}
 };
 const backend=new TerminalProductionBackend({ownership,hostOwnerId:'host1',creator,onUnavailable(){},deadlineMs:25});
 return{backend,poison,counts:()=>({stops,verify,registrations}),guard:{isCurrent:()=>true}};
}
for(const mode of ['constructor','species'])test('backend readiness aggregation refuses inherited '+mode+' getter without executing it',async()=>{
 const f=backendFixture(mode);let row;
 try{
  assert.equal((await f.backend.sendGate({generation:1,open:true})).ok,true);
  const p=f.backend.prepare(config(),f.guard);assert.equal(p.ok,true);assert.equal(f.backend.allocate({ownerId:p.ownerId}).ok,true);
  const h=f.backend.captureBackendSettlement({ownerId:p.ownerId});const reply=await f.backend.connect({ownerId:p.ownerId},f.guard);await tick();await tick();
  row={case:'backend-readiness-'+mode,getters:f.poison.traps.length,stacks:f.poison.traps,publicReply:reply,lifetime:h.snapshot(),counts:f.counts()};observations.push(row);
  assert.equal(reply.ok,false);assert.equal(row.counts.stops,1);
  assert.equal(f.poison.traps.length,0,'readiness construction must not execute inherited Promise getter');
 }finally{f.poison.restore();await f.backend.stopSession({ownerId:'owner1',code:98,deadlineMs:25});}
});
test('backend direct sendGate guard refuses inherited species before entry observer',async()=>{
 const f=backendFixture('species');let reply;
 try{f.poison.arm();reply=f.backend.sendGate({generation:1,open:true});}finally{f.poison.restore();}
 assert.equal((await reply).ok,false);observations.push({case:'backend-direct-gate-species-control',getters:f.poison.traps.length,stacks:f.poison.traps,stats:f.backend.stats()});assert.equal(f.poison.traps.length,0);
});

const boundedSourceActual=async work=>{let timer;try{return await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Actual source boundary did not complete')),1000);})]);}finally{clearTimeout(timer);}};

// V2 release authority controls use real captured Session handles and unchanged
// actual receipt/Promise authority. Synthetic release mutations are negative only.
for(const mode of ['invalid','rejected'])test('v2 legally observed '+mode+' release proof cannot poison valid real Session actual authority',async()=>{
 const h=observed({}, {captureSessionSettlement(fn,...args){const real=fn(...args);const verifiedRelease=real.verifiedRelease.then(proof=>{if(mode==='rejected')throw Error('SYNTHETIC_RELEASE_REJECTION');return Object.freeze({...proof,identityKnown:false});});return Object.freeze({...real,verifiedRelease});}});
 try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId}),real=h.base.ownership.captureSessionSettlement({sessionOwnerId:p.ownerId});await stopBackend(h,p);assert.equal((await real.actualSettled).actualSettled,true);await boundedSourceActual(b.actualSettled);assert.equal(b.snapshot().unknown,false);assert.equal(b.snapshot().sessionSettled,true);assert.equal(b.snapshot().verifiedReleased,false);await pending(b.verifiedRelease);assert.equal(h.backend.captureBackendSettlementRoster().length,1);}finally{await h.dispose();}
});
test('v2 invalid release never substitutes for held original real Session actual authority',async()=>{
 const held=deferred();let original,actualValue;const h=observed({}, {captureSessionSettlement(fn,...args){const real=fn(...args);original=real;real.actualSettled.then(value=>{actualValue=value;});return Object.freeze({...real,actualSettled:held.promise,verifiedRelease:real.verifiedRelease.then(proof=>Object.freeze({...proof,identityKnown:false}))});}});
 try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});await stopBackend(h,p);await original.actualSettled;await until(()=>actualValue!==undefined);assert.equal(b.snapshot().sessionSettled,false);await pending(b.actualSettled);held.resolve(actualValue);await boundedSourceActual(b.actualSettled);assert.equal(b.snapshot().unknown,false);await pending(b.verifiedRelease);assert.equal(h.backend.captureBackendSettlementRoster().length,1);}finally{await h.dispose();}
});
for(const mode of ['invalid','rejected'])test('v2 '+mode+' actual authority remains unknown even with valid real release proof',async()=>{
 const h=observed({}, {captureSessionSettlement(fn,...args){const real=fn(...args);const actualSettled=real.actualSettled.then(value=>{if(mode==='rejected')throw Error('SYNTHETIC_ACTUAL_REJECTION');return Object.freeze({...value,actualSettled:false});});return Object.freeze({...real,actualSettled});}});
 try{const p=await readyBackend(h),b=h.backend.captureBackendSettlement({ownerId:p.ownerId});await stopBackend(h,p);await b.verifiedRelease;await until(()=>b.snapshot().unknown);assert.equal(b.snapshot().sessionSettled,false);await pending(b.actualSettled);assert.equal(h.backend.captureBackendSettlementRoster().length,1);}finally{await h.dispose();}
});
