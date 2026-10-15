// Owner-authored passive-status contract tests. Actual backend, creator and
// ownership run over the unchanged inert fixture. Never native qualification.
// The optional held connect result below delays a backend-facing provider
// continuation after the REAL inert ownership Promise settles. It is not an
// unsettled Windows operation or fabricated cleanup/transport observation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionBackend} from '../src/terminal/production-backend.mjs';
import {TerminalProductionOwnership} from '../src/terminal/production-ownership.mjs';
import {createInertProductionComposition,inertConfig,inertTick,INERT_RUNTIME} from './fixtures/terminal-production-inert.mjs';

const METHOD_NAMES=['prepareSession','allocateSession','connectSession','assertSessionCurrent','watchSessionRoot','captureSession','stopSession','verifyExit'];
const STATUS_KEYS=['phase','failed','backendLost','pendingConnection','cleanupVerified','backendReservationRetained'];
const expected=(phase,values={})=>({phase,failed:false,backendLost:false,pendingConnection:false,cleanupVerified:false,backendReservationRetained:true,...values});
const count=(h,name)=>h.base.state.trace.filter(row=>row.name===name).length;
async function waitUntil(predicate,label){for(let n=0;n<500&&!predicate();n++)await inertTick();assert(predicate(),label);}
function checkStatus(actual,wanted){
 assert(actual&&typeof actual==='object');assert.equal(Object.isFrozen(actual),true);
 assert.deepEqual(Reflect.ownKeys(actual).sort(),[...STATUS_KEYS].sort(),'status discloses cached scalars only; no IDs, leases or native handles');
 for(const key of STATUS_KEYS){const descriptor=Object.getOwnPropertyDescriptor(actual,key);assert.equal(descriptor.enumerable,true);assert.equal(Object.hasOwn(descriptor,'value'),true,'status fields must be DATA, not accessors');}
 assert.equal(typeof actual.phase,'string');for(const key of STATUS_KEYS.slice(1))assert.equal(typeof actual[key],'boolean');
 assert.deepEqual({...actual},wanted);
 assert.equal(actual.backendReservationRetained,!actual.cleanupVerified||actual.pendingConnection);
}
function observedComposition(options={},holdConnect=false){
 const base=createInertProductionComposition({...options,deadlineMs:1000}),calls=[],owners=[],probe={admissionCalls:0,unavailableCalls:0,actualConnectSettled:false,actualConnectRejected:false};
 let releaseConnect=()=>{},released=false;
 const facet=Object.create(null);
 for(const name of METHOD_NAMES){
  const original=Object.getOwnPropertyDescriptor(TerminalProductionOwnership.prototype,name).value;
  facet[name]=(...args)=>{
   calls.push(name);const result=Reflect.apply(original,base.ownership,args);
   if(name==='prepareSession'&&result.ok===true)owners.push(result.sessionOwnerId);
   if(name!=='connectSession'||!holdConnect)return result;
   // Forward only the actual result/rejection of the actual captured method.
   // Test control retains the continuation; no successful outcome is invented.
   let settle,value,rejected=false,resolve,reject;
   const held=new Promise((yes,no)=>{resolve=yes;reject=no;});
   const flush=()=>{if(released&&settle)(rejected?reject:resolve)(value);};
   releaseConnect=()=>{released=true;flush();};
   result.then(v=>{probe.actualConnectSettled=true;settle=true;value=v;flush();},e=>{probe.actualConnectSettled=true;probe.actualConnectRejected=true;settle=true;rejected=true;value=e;flush();});
   return held;
  };
 }
 const guard=Object.freeze({isCurrent:()=>{probe.admissionCalls++;return base.guard.isCurrent();}});
 const backend=new TerminalProductionBackend({ownership:facet,hostOwnerId:base.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable:()=>{probe.unavailableCalls++;},deadlineMs:1000});
 return {base,backend,guard,calls,probe,releaseConnect:()=>releaseConnect(),async dispose(){
  releaseConnect();base.releaseWrites();base.releaseReads();
  const stops=owners.map(ownerId=>backend.stopSession({ownerId,deadlineMs:100,code:98}));
  await base.dispose();await Promise.all(stops);
 }};
}
async function prepared(h,sessionId='session1'){
 if(h.backend.stats().generation===0)assert.equal((await h.backend.sendGate({generation:1,open:true})).ok,true);
 const p=h.backend.prepare(inertConfig(sessionId),h.guard);assert.equal(p.ok,true);return p;
}
async function allocated(h,sessionId='session1'){const p=await prepared(h,sessionId);assert.equal(h.backend.allocate({ownerId:p.ownerId}).ok,true);return p;}
async function ready(h,sessionId='session1'){const p=await allocated(h,sessionId);assert.equal((await h.backend.connect({ownerId:p.ownerId},h.guard)).ok,true);return p;}
const stop=(h,p,deadlineMs=500)=>h.backend.stopSession({ownerId:p.ownerId,deadlineMs,code:77});

test('sessionStatus rejects malformed, unknown, Proxy, accessor and extra-argument requests without invoking getters',async()=>{
 const h=observedComposition();try{
  const p=await prepared(h);assert.equal(typeof h.backend.sessionStatus,'function','proposed passive private status method must exist');
  let touched=0;const getter={get ownerId(){touched++;throw Error('GETTER_MUST_NOT_RUN');}};
  const proxy=new Proxy({ownerId:p.ownerId},{get(){touched++;throw Error('PROXY_MUST_NOT_RUN');},getPrototypeOf(){touched++;throw Error('PROXY_MUST_NOT_RUN');},ownKeys(){touched++;throw Error('PROXY_MUST_NOT_RUN');},getOwnPropertyDescriptor(){touched++;throw Error('PROXY_MUST_NOT_RUN');}});
  const nonEnumerable=Object.defineProperty({},'ownerId',{value:p.ownerId});
  const invalidOwner={toString(){touched++;throw Error('COERCION_MUST_NOT_RUN');}};
  const before=[...h.calls],admission=h.probe.admissionCalls,trace=h.base.state.trace.length;
  for(const value of [undefined,null,true,1,'owner',[],()=>{},new Date(),{},getter,proxy,nonEnumerable,Object.create({ownerId:p.ownerId}),{ownerId:invalidOwner},{ownerId:''},{ownerId:'unknown_owner'},{ownerId:p.ownerId,extra:true},{ownerId:p.ownerId,[Symbol('extra')]:true}])assert.equal(h.backend.sessionStatus(value),null);
  assert.equal(h.backend.sessionStatus(),null);assert.equal(h.backend.sessionStatus({ownerId:p.ownerId},undefined),null);assert.equal(h.backend.sessionStatus({ownerId:p.ownerId},{}),null);
  const nullPrototype=Object.assign(Object.create(null),{ownerId:p.ownerId});checkStatus(h.backend.sessionStatus(nullPrototype),expected('prepared'));
  assert.equal(touched,0);assert.deepEqual(h.calls,before);assert.equal(h.probe.admissionCalls,admission);assert.equal(h.base.state.trace.length,trace);
 }finally{await h.dispose();}
});

test('prepared status retains listeners-only reservation without observing native identity',async()=>{
 const h=observedComposition();try{
  const p=await prepared(h);assert.equal(count(h,'create'),0);assert.equal(h.base.ownership.snapshot().reservedSessions,1);
  const before=[...h.calls];checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('prepared'));assert.deepEqual(h.calls,before);
 }finally{await h.dispose();}
});

test('allocated status reports allocation before any backend connection publication',async()=>{
 const h=observedComposition();try{
  const p=await allocated(h);assert.equal(count(h,'create'),1);assert.equal(count(h,'accept'),0);assert.equal(h.base.state.spawns.length,0);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('allocated'));
 }finally{await h.dispose();}
});

test('connecting status reports the actual retained backend continuation until real ready publication',async()=>{
 const h=observedComposition({},true);try{
  const p=await allocated(h),connecting=h.backend.connect({ownerId:p.ownerId},h.guard);
  await waitUntil(()=>h.probe.actualConnectSettled,'actual ownership connect result must settle behind the held forwarding continuation');
  assert.equal(h.probe.actualConnectRejected,false);assert.equal(h.backend.stats().pendingConnections,1);assert.equal(count(h,'accept'),3);assert.equal(h.base.state.spawns.length,0);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('connecting',{pendingConnection:true}));
  h.releaseConnect();assert.equal((await connecting).ok,true);checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('ready'));
 }finally{await h.dispose();}
});

test('ready status remains ready across an acknowledged CLOSED gate while background work survives',async()=>{
 const h=observedComposition();try{
  const p=await ready(h);assert.equal((await h.backend.sendGate({generation:2,open:false})).ok,true);assert.equal(h.backend.stats().open,false);
  assert.equal(h.base.group('session1').creator.stats().session.commands.gateOpen,false);assert.equal(count(h,'native-stop'),0);assert.equal(h.base.state.spawns.length,1);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('ready'));
 }finally{await h.dispose();}
});

test('planned Stop reports cached verified cleanup only after actual Session and peer closure',async()=>{
 const h=observedComposition();try{
  const p=await ready(h);assert.equal((await stop(h,p)).verifiedExited,true);assert.equal(h.base.ownership.snapshot().reservedSessions,0);assert.equal(h.base.group('session1').peerClosed,true);assert.equal(count(h,'native-stop'),1);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('exited',{cleanupVerified:true,backendReservationRetained:false}));
 }finally{await h.dispose();}
});

test('unknown identity cleanup retains the backend reservation despite settled native and peer callbacks',async()=>{
 const h=observedComposition({finalIdentityMismatch:true});try{
  const p=await ready(h);assert.equal((await stop(h,p)).ok,false);assert.equal(h.base.group('session1').nativeExited,true);assert.equal(h.base.group('session1').peerClosed,true);assert.equal(h.base.ownership.snapshot().reservedSessions,1);
  assert.equal(h.base.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,false);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('stopping'));
 }finally{await h.dispose();}
});

test('late ownership proof does not refresh passive cached status; explicit repeated Stop reconciles without a second native Stop',async()=>{
 const h=observedComposition({manualNative:true});try{
  const p=await ready(h);assert.equal((await stop(h,p,20)).ok,false);assert.equal(count(h,'native-stop'),1);
  h.base.completeNative('session1');await waitUntil(()=>h.base.ownership.snapshot().reservedSessions===0,'actual late verified ownership cleanup must settle');
  assert.equal(h.base.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,true);assert.equal(h.backend.stats().retainedReservations,1);
  const before=[...h.calls];checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('stopping'));assert.deepEqual(h.calls,before,'passive read cannot reconcile native cleanup');
  assert.equal((await stop(h,p)).verifiedExited,true);assert.equal(count(h,'native-stop'),1);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('exited',{cleanupVerified:true,backendReservationRetained:false}));
 }finally{await h.dispose();}
});

test('verified cleanup still retains reservation while an actual backend-facing connection continuation is unsettled',async()=>{
 const h=observedComposition({},true);try{
  const p=await allocated(h),connecting=h.backend.connect({ownerId:p.ownerId},h.guard);
  await waitUntil(()=>h.probe.actualConnectSettled,'actual ownership connection result must be retained before Stop');assert.equal(h.probe.actualConnectRejected,false);
  assert.equal((await stop(h,p)).verifiedExited,true);assert.equal((await connecting).ok,false,'Stop refuses public connection publication before delayed provider settlement');
  assert.equal(h.base.ownership.snapshot().reservedSessions,0);assert.equal(h.backend.stats().pendingConnections,1);assert.equal(h.backend.stats().retainedReservations,1);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('exited',{pendingConnection:true,cleanupVerified:true,backendReservationRetained:true}));
  h.releaseConnect();await waitUntil(()=>h.backend.stats().pendingConnections===0,'late real provider continuation must actually leave the backend await');
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('exited',{cleanupVerified:true,backendReservationRetained:false}));assert.equal(count(h,'native-stop'),1);
 }finally{await h.dispose();}
});

test('owner startup admission failure is cached separately from backend loss and listeners-only cleanup needs no invented identity',async()=>{
 const h=observedComposition();try{
  const p=await prepared(h);h.base.setAdmission(false);assert.equal(h.backend.allocate({ownerId:p.ownerId}).ok,false);
  await waitUntil(()=>h.backend.stats().retainedReservations===0,'actual listeners-only cleanup must be cached as verified');
  assert.equal(h.backend.isAvailable(),true);assert.equal(h.backend.stats().lost,false);assert.equal(h.base.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,false);assert.equal(count(h,'create'),0);assert.equal(count(h,'native-stop'),0);
  checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('exited',{failed:true,cleanupVerified:true,backendReservationRetained:false}));
 }finally{await h.dispose();}
});

test('backend loss does not rewrite the already-exited owner failure bit while live owner failure remains explicit',async()=>{
 const h=observedComposition();try{
  const first=await ready(h);assert.equal((await stop(h,first)).verifiedExited,true);const second=await ready(h,'session2');
  h.base.group('session2').creator.dispose();await waitUntil(()=>h.backend.stats().lost&&h.base.ownership.snapshot().reservedSessions===0,'actual lane EOF must cause aggregate loss and owned cleanup');
  assert.equal(h.backend.isAvailable(),false);assert.equal(h.probe.unavailableCalls,1);
  checkStatus(h.backend.sessionStatus({ownerId:first.ownerId}),expected('exited',{backendLost:true,cleanupVerified:true,backendReservationRetained:false}));
  checkStatus(h.backend.sessionStatus({ownerId:second.ownerId}),expected('exited',{failed:true,backendLost:true,cleanupVerified:true,backendReservationRetained:false}));
 }finally{await h.dispose();}
});

test('every status snapshot is fresh, frozen, stale after transition and unusable as admission or owner authority',async()=>{
 const h=observedComposition();try{
  const p=await prepared(h),first=h.backend.sessionStatus({ownerId:p.ownerId}),copy={...first},second=h.backend.sessionStatus({ownerId:p.ownerId});
  checkStatus(first,expected('prepared'));checkStatus(second,expected('prepared'));assert.notEqual(first,second);assert.equal(Object.isFrozen(copy),false);
  assert.equal(Reflect.set(first,'phase','ready'),false);assert.equal(Reflect.deleteProperty(first,'failed'),false);assert.throws(()=>Object.defineProperty(first,'ownerId',{value:p.ownerId}),TypeError);
  assert.equal(h.backend.sessionStatus(copy),null);assert.equal(h.backend.allocate(copy).ok,false);
  assert.equal(h.backend.allocate({ownerId:p.ownerId}).ok,true);checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('allocated'));checkStatus(first,expected('prepared'));
  assert.equal((await h.backend.connect({ownerId:p.ownerId},h.guard)).ok,true);
  const packet={ownerId:p.ownerId,windowId:'window1',epoch:4,leaseId:'lease1',generation:1};
  assert.equal((await h.backend.install(packet,first)).ok,false);assert.equal(h.base.group('session1').creator.stats().session.commands.leased,false);assert.deepEqual(h.base.state.writes,[]);
  assert.equal((await h.backend.install(packet,h.guard)).ok,true,'only a separate trusted operation guard may install a lease');
 }finally{await h.dispose();}
});

test('status reads execute no captured ownership, native verification, endpoint, admission or Stop callback',async()=>{
 const h=observedComposition();try{
  const p=await ready(h);h.base.setAdmission(false);h.base.setLifetime(false);
  const before=[...h.calls],admission=h.probe.admissionCalls,unavailable=h.probe.unavailableCalls,trace=h.base.state.trace.length;
  // Deliberately invalid currentness would fence if a read invoked assert or
  // admission. The contract reports cached ready state without testing it.
  for(let n=0;n<100;n++)checkStatus(h.backend.sessionStatus({ownerId:p.ownerId}),expected('ready'));
  assert.deepEqual(h.calls,before);assert.equal(h.probe.admissionCalls,admission);assert.equal(h.probe.unavailableCalls,unavailable);assert.equal(h.base.state.trace.length,trace);assert.equal(count(h,'native-stop'),0);
 }finally{await h.dispose();}
});
