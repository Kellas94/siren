import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionBackend} from '../src/terminal/production-backend.mjs';
import {ProductionAggregateGateLink} from '../src/terminal/production-aggregate-gate.mjs';
import {createInertProductionComposition,inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const pending=async p=>{let done=false;p.then(()=>{done=true;},()=>{done=true;});await inertTick();assert.equal(done,false);};
const bounded=async p=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SOURCE_SETTLEMENT_TIMEOUT')),1000);})]);}finally{clearTimeout(timer);}};
async function fixture(run,send){const s=createInertProductionComposition(),proto=ProductionAggregateGateLink.prototype,old=proto.sendGate;if(send)proto.sendGate=send;try{await run(s);}finally{proto.sendGate=old;await s.dispose();}}
const get=b=>{assert.equal(typeof b.captureControlSettlement,'function','new feature API');assert.equal(typeof b.retireControl,'function','new feature API');return b.captureControlSettlement();};

test('control handle is stable frozen and passive before admission',()=>fixture(async s=>{
 const h=get(s.backend);assert.equal(h,s.backend.captureControlSettlement());assert(Object.isFrozen(h));assert(Object.isFrozen(h.snapshot()));assert.equal(h.snapshot().pendingCallers,0);assert.equal(h.snapshot().retired,false);assert.equal(h.snapshot().actualSettled,false);assert.equal(s.state.spawns.length,0);
 let traps=0;const p=new Proxy({},{get(){traps++;throw Error();}});assert.equal(s.backend.captureControlSettlement(p),null);assert.equal(s.backend.retireControl(p),null);assert.equal(traps,0);assert.equal(h.snapshot().retired,false);s.backend.retireControl();const r=await bounded(h.actualSettled);assert.equal(r.scope,'BACKEND_CONTROL_CALLERS');assert.equal(r.nativeExecutionAdmitted,false);assert(Object.isFrozen(r));
}));
test('planned control retirement is idempotent and never fakes host loss or Stop',()=>fixture(async s=>{
 const h=get(s.backend);let notified=0;s.backend.subscribeUnavailable(()=>{notified++;});s.backend.retireControl();s.backend.retireControl();await bounded(h.actualSettled);assert.equal(s.backend.stats().lost,false);assert.equal(s.backend.isAvailable(),false);assert.equal(notified,0);assert.equal(s.state.backendUnavailable,0);assert.equal(s.state.trace.filter(x=>x.name==='native-stop').length,0);assert.equal(s.backend.prepare(inertConfig(),s.guard).ok,false);assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,false);assert.throws(()=>s.backend.subscribeUnavailable(()=>{}));
}));
test('ordinary Lock and Unlock do not terminally settle the caller boundary',()=>fixture(async s=>{
 const h=get(s.backend);assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);assert.equal((await s.backend.sendGate({generation:2,open:false})).ok,true);assert.equal((await s.backend.sendGate({generation:3,open:true})).ok,true);assert.equal(s.backend.stats().open,true);assert.equal(h.snapshot().retired,false);await pending(h.actualSettled);s.backend.retireControl();await bounded(h.actualSettled);
}));
test('held original remains charged after retirement and cannot publish late OPEN',async()=>{
 const d=deferred();await fixture(async s=>{const h=get(s.backend),p=s.backend.sendGate({generation:1,open:true});assert.equal(h.snapshot().pendingCallers,1);s.backend.retireControl();await pending(h.actualSettled);d.resolve(Object.freeze({ok:true,generation:1,open:true}));assert.equal((await p).ok,false);await bounded(h.actualSettled);assert.equal(s.backend.stats().open,false);assert.equal(h.snapshot().pendingCallers,0);},()=>d.promise);
});
test('newer safety CLOSE coexists with superseded OPEN without early refund',async()=>{
 const a=deferred(),b=deferred(),calls=[];await fixture(async s=>{const h=get(s.backend),p=s.backend.sendGate({generation:1,open:true}),q=s.backend.sendGate({generation:2,open:false});assert.equal(h.snapshot().pendingCallers,2);b.resolve(Object.freeze({ok:true,generation:2,open:false}));assert.equal((await q).ok,true);await inertTick();assert.equal(h.snapshot().pendingCallers,1);s.backend.retireControl();await pending(h.actualSettled);a.resolve(Object.freeze({ok:true,generation:1,open:true}));assert.equal((await p).ok,false);await bounded(h.actualSettled);assert.deepEqual(calls,[1,2]);assert.equal(s.backend.stats().open,false);},p=>{calls.push(p.generation);return p.open?a.promise:b.promise;});
});
test('capacity refusal fences locally and reserves safety CLOSE rather than a second OPEN',async()=>{
 const a=deferred(),b=deferred(),calls=[];await fixture(async s=>{const h=get(s.backend),p=s.backend.sendGate({generation:1,open:true});assert.equal((await s.backend.sendGate({generation:2,open:true})).ok,false);assert.equal(h.snapshot().pendingCallers,1);const q=s.backend.sendGate({generation:3,open:false});assert.equal(h.snapshot().pendingCallers,2);assert.equal((await s.backend.sendGate({generation:4,open:false})).ok,false);assert.deepEqual(calls,[1,3]);a.resolve(Object.freeze({ok:true,generation:1,open:true}));b.resolve(Object.freeze({ok:true,generation:3,open:false}));assert.equal((await p).ok,false);assert.equal((await q).ok,false);s.backend.retireControl();await bounded(h.actualSettled);assert.equal(s.backend.stats().open,false);},p=>{calls.push(p.generation);return p.open?a.promise:b.promise;});
});
test('cell exists before aggregate reentry retires control',async()=>{let backend,h;await fixture(async s=>{backend=s.backend;h=get(backend);const result=await backend.sendGate({generation:1,open:true});assert.equal(result.ok,false);await bounded(h.actualSettled);assert.equal(h.snapshot().pendingCallers,0);},p=>{assert.equal(h.snapshot().pendingCallers,1);assert(h.snapshot().activeFrames>0);backend.retireControl();assert.equal(h.snapshot().actualSettled,false);return Promise.resolve(Object.freeze({ok:true,...p}));});});

for(const mode of ['throw','thenable','proxy','own-constructor'])test('entered '+mode+' retains unknown caller without forged completion',async()=>{
 let traps=0;await fixture(async s=>{const h=get(s.backend),p=s.backend.sendGate({generation:1,open:true});assert.equal((await p).ok,false);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().pendingCallers,1);assert.equal(h.snapshot().retired,true);assert.equal(traps,0);await pending(h.actualSettled);},()=>{if(mode==='throw')throw Error('ENTERED');if(mode==='thenable')return{get then(){traps++;throw Error();}};if(mode==='proxy')return new Proxy(Promise.resolve(false),{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});const p=Promise.resolve(false);Object.defineProperty(p,'constructor',{get(){traps++;throw Error();}});return p;});
});
test('legally observed rejection settles negative after complete notification unwind',async()=>{
 const d=deferred();let h,inside;await fixture(async s=>{h=get(s.backend);s.backend.subscribeUnavailable(()=>{inside=h.snapshot();assert.equal(inside.actualSettled,false);assert(inside.activeFrames>0);});const p=s.backend.sendGate({generation:1,open:true});d.reject(Error('LEGAL_REJECTION'));assert.equal((await p).ok,false);await bounded(h.actualSettled);assert(inside);assert.equal(h.snapshot().unknown,false);},()=>d.promise);
});
test('fulfillment uses exact immutable DATA receipt and ignores own then shadow',async()=>{
 const reply=Object.freeze({ok:true,generation:1,open:true});let getters=0;await fixture(async s=>{const h=get(s.backend);assert.equal(await s.backend.sendGate({generation:1,open:true}),reply);s.backend.retireControl();await bounded(h.actualSettled);assert.equal(getters,0);},()=>{const p=Promise.resolve(reply);Object.defineProperty(p,'then',{get(){getters++;throw Error();}});return p;});
});
for(const mode of ['accessor','mismatch','mutable'])test('malformed '+mode+' reply cannot publish OPEN or run getters',async()=>{
 let getters=0;await fixture(async s=>{const h=get(s.backend);assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,false);s.backend.retireControl();await bounded(h.actualSettled);assert.equal(s.backend.stats().open,false);assert.equal(getters,0);},()=>Promise.resolve(mode==='accessor'?Object.freeze({get ok(){getters++;throw Error();},generation:1,open:true}):mode==='mismatch'?Object.freeze({ok:true,generation:2,open:true}):{ok:true,generation:1,open:true}));
});

test('malformed and stale requests never enter aggregate or consume cells',async()=>{
 let calls=0,traps=0;await fixture(async s=>{const h=get(s.backend),proxy=new Proxy({},{get(){traps++;throw Error();},ownKeys(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});for(const p of [proxy,{generation:0,open:true},{generation:1,open:1},{generation:1,open:true,extra:1}])assert.equal((await s.backend.sendGate(p)).ok,false);assert.equal((await s.backend.sendGate({generation:1,open:true},proxy)).ok,false);assert.equal(calls,0);assert.equal(traps,0);assert.equal(h.snapshot().pendingCallers,0);assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);assert.equal((await s.backend.sendGate({generation:1,open:false})).ok,false);assert.equal(calls,1);s.backend.retireControl();await bounded(h.actualSettled);},p=>{calls++;return Promise.resolve(Object.freeze({ok:true,...p}));});
});
for(const mode of ['constructor','species'])for(const when of ['before-entry','after-entry'])test('strict '+mode+' guard '+when+' executes zero inherited getters',async()=>{
 const target=mode==='constructor'?Promise.prototype:Promise,key=mode==='constructor'?'constructor':Symbol.species,original=Object.getOwnPropertyDescriptor(target,key);let getters=0,calls=0;
 const arm=()=>Object.defineProperty(target,key,{configurable:true,get(){getters++;throw Error('MUST_NOT_EXECUTE');}}),restore=()=>Object.defineProperty(target,key,original);
 await fixture(async s=>{const h=get(s.backend);let p;try{if(when==='before-entry')arm();p=s.backend.sendGate({generation:1,open:true});}finally{restore();}assert.equal((await p).ok,false);assert.equal(getters,0);assert.equal(calls,when==='before-entry'?0:1);assert.equal(h.snapshot().unknown,when==='after-entry');assert.equal(h.snapshot().pendingCallers,when==='after-entry'?1:0);if(when==='before-entry')await bounded(h.actualSettled);else await pending(h.actualSettled);},p=>{calls++;const result=Promise.resolve(Object.freeze({ok:true,...p}));if(when==='after-entry')arm();return result;});
});
test('loss listener retirement observes charged work until both handlers unwind',async()=>{
 const d=deferred();await fixture(async s=>{const h=get(s.backend);let entered=false;s.backend.subscribeUnavailable(()=>{entered=true;assert.equal(s.backend.retireControl(),h);assert.equal(h.snapshot().pendingCallers,1);assert.equal(h.snapshot().actualSettled,false);assert.throws(()=>s.backend.subscribeUnavailable(()=>{}));});const p=s.backend.sendGate({generation:1,open:true});d.reject(Error('OBSERVABLE'));assert.equal((await p).ok,false);const r=await bounded(h.actualSettled);assert(entered);assert.equal(r.actualSettled,true);assert.equal(h.snapshot().activeFrames,0);assert.equal(h.snapshot().unknown,false);},()=>d.promise);
});
test('retirement keeps a prepared Session alive and separate from caller settlement',()=>fixture(async s=>{
 const h=get(s.backend);const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);const entry=s.backend.captureBackendSettlement({ownerId:p.ownerId});s.backend.retireControl();await bounded(h.actualSettled);assert.equal(entry.snapshot().actualSettled,false);assert.equal(s.state.trace.filter(x=>x.name==='native-stop').length,0);assert.equal((await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:200,code:98})).ok,true);await bounded(entry.actualSettled);assert.equal(h.snapshot().actualSettled,true);
}));
test('completed caller receipt cannot be broadened by later unrelated Session loss',()=>fixture(async s=>{
 const h=get(s.backend),p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);s.backend.retireControl();const r=await bounded(h.actualSettled);s.setLifetime(false);await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:200,code:98});assert.equal(await h.actualSettled,r);assert.equal(r.scope,'BACKEND_CONTROL_CALLERS');assert.equal(r.nativeExecutionAdmitted,false);
}));
