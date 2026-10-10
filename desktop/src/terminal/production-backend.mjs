// Private main-side composition candidate. No loader, Electron, shell, PTY,
// filesystem or renderer bridge. Native providers still need exact qualification.
import {types} from 'node:util';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ProductionControlChannel} from './production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader} from './production-history-channel.mjs';
import {ProductionGateLink} from './production-gate-link.mjs';
import {TerminalSessionCommandChannel} from './session-command-channel.mjs';
import {TerminalSessionLink} from './session-link.mjs';
import {ProductionAggregateGateLink} from './production-aggregate-gate.mjs';
import {validateStartupEnvelope} from './startup-protocol.mjs';

const apply=Reflect.apply,clock=performance.now.bind(performance),NativePromise=Promise;
const promisePrototype=NativePromise.prototype,then=promisePrototype.then;
const species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species).get;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const callable=v=>typeof v==='function'&&!types.isProxy(v);
const failure=()=>Object.freeze({ok:false,code:'HOST_UNAVAILABLE'});
const declined=()=>Object.freeze({accepted:false});
const refused=()=>Object.freeze({accepted:false,knownRefused:true});
const success=value=>Object.freeze({ok:true,...value});
const resolved=v=>new NativePromise(resolve=>resolve(v));
const knownRefusal=Object.freeze({commandKnownRefused:true});
function permitted(g){try{return apply(g,undefined,[])===true;}catch{return false;}}
function data(v,keys=null){
 if(!v||typeof v!=='object'||types.isProxy(v))return null;
 const p=Object.getPrototypeOf(v);if(p!==Object.prototype&&p!==null)return null;
 const own=Reflect.ownKeys(v);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const r=Object.create(null);for(const k of own){const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function method(v,key){
 if(!v||typeof v!=='object'||types.isProxy(v))throw TypeError('Private backend dependencies required');
 for(let p=v;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw TypeError('Proxy dependency refused');const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(!Object.hasOwn(d,'value')||!callable(d.value))throw TypeError('DATA callback required');return d.value.bind(v);}}
 throw TypeError('Missing private ownership method');
}
function optionalMethod(v,key){
 if(!v||typeof v!=='object'||types.isProxy(v))return null;
 for(let p=v;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return null;const d=Object.getOwnPropertyDescriptor(p,key);if(d)return Object.hasOwn(d,'value')&&callable(d.value)?(...args)=>apply(d.value,v,args):null;}return null;
}
function promise(v){
 const c=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 if(!v||typeof v!=='object'||types.isProxy(v)||!types.isPromise(v)||Object.getPrototypeOf(v)!==promisePrototype||Object.hasOwn(v,'constructor')||!c||!Object.hasOwn(c,'value')||c.value!==NativePromise||s?.get!==species)throw Error('Native provider Promise required');return v;
}
function guard(v){const r=data(v,['isCurrent']);return r&&callable(r.isCurrent)?r.isCurrent:null;}
const methods=['prepareSession','allocateSession','connectSession','assertSessionCurrent','watchSessionRoot','captureSession','stopSession','verifyExit'];
const configKeys=['sessionId','projectId','admissionEpoch','profileId','cwd','shell','cols','rows'];
const creatorPath=v=>typeof v==='string'&&/^[A-Za-z]:\\/.test(v)&&v.length<=32768&&v.isWellFormed()&&!/[\x00-\x1f\x7f"]/.test(v);
const cp=ProductionControlChannel.prototype,hp=ProductionHistoryChannel.prototype,sp=TerminalSessionCommandChannel.prototype,lp=TerminalSessionLink.prototype,gp=ProductionGateLink.prototype,rp=ProductionHistoryReader.prototype;
const aggregatePrototype=ProductionAggregateGateLink.prototype,aggregateCapture=aggregatePrototype.captureSessionSettlement,aggregateReserve=aggregatePrototype.reserveObserved,aggregateRetire=aggregatePrototype.retireObserved;

// A completed passive capability retains cached facts, never its backend owner.
function controlObservation(hostOwnerId){
 const c={hostOwnerId,retired:false,done:false,unknown:false,frames:0,calls:new Set(),resolve:null};
 c.handle=Object.freeze({hostOwnerId,actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({hostOwnerId,retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingCallers:c.calls.size,maxPendingCallers:2,nativeExecutionAdmitted:false})});return c;
}
function finishControl(c){
 if(c.done||!c.retired||c.unknown||c.frames||c.calls.size)return;
 c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'BACKEND_CONTROL_CALLERS',hostOwnerId:c.hostOwnerId,actualSettled:true,nativeExecutionAdmitted:false}));
}

/** Owns the preparation-to-ready transaction and private creator lease tokens.
 * A public timeout never clears actual provider/native reservations. All awaits
 * are followed by current admission, endpoint and generation checks. No queue,
 * retries, renderer spawn operation or shell command text is introduced.
 */
export class TerminalProductionBackend {
 #native;#host;#creator;#notify;#deadline;#policy;#aggregate;#records=new Map();
 #lost=false;#listener=null;#generation=0;#open=false;#gatePending=false;
 #lifetimes=new Set();#captureSession;#control;
 constructor(options,...extra){
  const p=data(options);if(extra.length||!p||Object.keys(p).some(k=>!['ownership','hostOwnerId','creator','onUnavailable','deadlineMs','policy'].includes(k))||!id(p.hostOwnerId)||!callable(p.onUnavailable))throw TypeError('Private backend DATA options required');
  const c=data(p.creator,['executable','entry','directory']),deadline=p.deadlineMs??10000;
  if(!c||!Object.values(c).every(creatorPath)||!positive(deadline)||deadline>10000)throw TypeError('Fixed runtime paths and deadline required');
  this.#native=Object.fromEntries(methods.map(k=>[k,method(p.ownership,k)]));this.#host=p.hostOwnerId;this.#creator=Object.freeze(c);this.#notify=p.onUnavailable;this.#deadline=deadline;this.#policy=p.policy;
  this.#captureSession=optionalMethod(p.ownership,'captureSessionSettlement');this.#control=controlObservation(this.#host);
  this.#aggregate=new ProductionAggregateGateLink({resolveLink:(sessionId,channelId)=>{
   const r=[...this.#records.values()].find(r=>r.sessionId===sessionId&&r.channelId===channelId);
   return r&&r.prepared?{link:r.gate,initiallyClosed:true}:null;
  },onUnavailable:()=>this.#lose(),deadlineMs:deadline});
 }
 get nativeExecutionAdmitted(){return false;}
 #frame(r,run){r.frames++;try{return run();}finally{r.frames--;this.#finishActual(r);}}
 #observe(r,work,ok,bad){try{promise(work);apply(then,work,[v=>this.#frame(r,()=>ok(v)),v=>this.#frame(r,()=>bad(v))]);return true;}catch{return false;}}
 #awaitObserve(r,work,ok,bad){const cell={work};r.awaiting.add(cell);if(!this.#observe(r,work,v=>{try{ok(v);}finally{r.awaiting.delete(cell);}},v=>{try{bad(v);}finally{r.awaiting.delete(cell);}})){r.unknown=true;return false;}return true;}
 // Await assimilates this private DATA thenable, never the original Promise.
 // Recheck at assimilation time and box values to avoid a second assimilation.
 #wait(r,work){return Object.freeze(Object.assign(Object.create(null),{then:(resolve,reject)=>{if(!this.#awaitObserve(r,work,v=>{resolve(Object.freeze(Object.assign(Object.create(null),{value:v})));},v=>{reject(v);}))reject(Error('WORK_UNOBSERVABLE'));}}));}
 #all(r,values){return new NativePromise(resolve=>{const results=[];let left=values.length;if(!left)resolve(results);for(const [i,work]of values.entries()){const done=v=>{results[i]=v;if(!--left)resolve(results);};if(!this.#awaitObserve(r,work,done,()=>{done(false);}))done(false);}});}
 #observation(r){
  r.awaiting=new Set();
  r.frames=0;r.retired=false;r.actualDone=false;r.unknown=false;r.sessionAttempted=false;r.sessionObserved=false;r.observationUnavailable=false;r.sessionActualDone=false;r.sessionReleaseProof=null;r.aggregate=null;r.aggregateEntering=false;r.aggregateDone=true;r.stopObserverPending=false;r.quiesceObserverPending=false;r.outerCommand=false;r.connectWorker=false;r.stopWorker=false;
  r.handle=Object.freeze({sessionId:r.sessionId,channelId:r.channelId,actualSettled:new NativePromise(resolve=>r.actualResolve=resolve),verifiedRelease:new NativePromise(resolve=>r.releaseResolve=resolve),snapshot:()=>Object.freeze({sessionId:r.sessionId,channelId:r.channelId,ownerId:r.ownerId,retired:r.retired,actualSettled:r.actualDone,unknown:r.unknown,observationUnavailable:r.observationUnavailable,activeFrames:r.frames,connectWorker:r.connectWorker,stopWorker:r.stopWorker,stopObserverPending:r.stopObserverPending,quiesceObserverPending:r.quiesceObserverPending,commandWorker:r.outerCommand,aggregateSettled:r.aggregateDone&&!r.aggregateEntering,sessionObserved:r.sessionObserved,sessionSettled:r.sessionActualDone,verifiedReleased:r.sessionReleaseProof!==null,nativeExecutionAdmitted:false})});
 }
 captureBackendSettlement(value,...extra){const p=!extra.length&&data(value,['ownerId']);return p&&id(p.ownerId)?this.#records.get(p.ownerId)?.handle??null:null;}
 captureBackendSettlementRoster(...extra){return extra.length?null:Object.freeze([...this.#lifetimes].map(r=>r.handle));}
 #finishActual(r){
  if(!r.actualDone&&r.retired&&!r.frames&&!r.connectWorker&&!r.stopWorker&&!r.stopObserverPending&&!r.quiesceObserverPending&&!r.outerCommand&&!r.aggregateEntering&&r.aggregateDone&&!r.unknown&&(!r.sessionAttempted||r.sessionObserved&&r.sessionActualDone)){
   r.actualDone=true;const resolve=r.actualResolve;r.actualResolve=null;resolve(Object.freeze({scope:'BACKEND_SESSION',sessionId:r.sessionId,channelId:r.channelId,ownerId:r.ownerId,actualSettled:true,sessionObserved:r.sessionObserved,nativeExecutionAdmitted:false}));
  }
  if(r.actualDone&&(!r.sessionAttempted||r.sessionReleaseProof))this.#lifetimes.delete(r);
 }
 #releaseAggregate(r){if(r.aggregate&&apply(aggregateCapture,this.#aggregate,[r.sessionId])===r.aggregate)this.#aggregate.release(r.sessionId);}
 #retireAggregate(r){if(r.aggregate)apply(aggregateRetire,this.#aggregate,[r.aggregate]);}
 #capture(r){
  if(!this.#captureSession){r.observationUnavailable=true;r.unknown=true;return;}
  try{
   const handle=this.#captureSession({sessionOwnerId:r.ownerId}),h=data(handle,['sessionOwnerId','sessionId','actualSettled','verifiedRelease','snapshot']);
   if(!h||!Object.isFrozen(handle)||h.sessionOwnerId!==r.ownerId||h.sessionId!==r.sessionId||!callable(h.snapshot))throw Error();promise(h.actualSettled);promise(h.verifiedRelease);r.sessionObserved=true;r.sessionHandle=handle;r.sessionSnapshot=h.snapshot;
   if(!this.#observe(r,h.actualSettled,v=>{const p=data(v,['scope','sessionOwnerId','sessionId','actualSettled','verifiedExited','nativeExecutionAdmitted']);if(!p||!Object.isFrozen(v)||p.scope!=='SESSION'||p.sessionOwnerId!==r.ownerId||p.sessionId!==r.sessionId||p.actualSettled!==true||typeof p.verifiedExited!=='boolean'||p.nativeExecutionAdmitted!==false)r.unknown=true;else r.sessionActualDone=true;},()=>{r.unknown=true;}))throw Error();
   // A legally observed negative release proof cannot poison independent actual
   // authority. It grants neither verification nor reuse of the retained slot.
   if(!this.#observe(r,h.verifiedRelease,v=>{const p=data(v,['scope','sessionOwnerId','sessionId','identityKnown','verifiedExited','remainingCount','nativeExecutionAdmitted']);if(!p||!Object.isFrozen(v)||p.scope!=='SESSION'||p.sessionOwnerId!==r.ownerId||p.sessionId!==r.sessionId||typeof p.identityKnown!=='boolean'||r.allocated&&p.identityKnown!==true||p.verifiedExited!==true||p.remainingCount!==0||p.nativeExecutionAdmitted!==false)return;r.sessionReleaseProof=v;if(r.retired)this.#releaseAggregate(r);const resolve=r.releaseResolve;r.releaseResolve=null;resolve(v);},()=>{}))throw Error();
  }catch{r.observationUnavailable=true;r.unknown=true;}
 }
 #aggregateObservation(r,handle){
  if(!handle)return;r.aggregate=handle;r.aggregateDone=false;
  const h=data(handle,['sessionId','actualSettled','snapshot']);
  if(!h||h.sessionId!==r.sessionId||!this.#observe(r,h.actualSettled,v=>{const p=data(v,['scope','sessionId','actualSettled','nativeExecutionAdmitted']);if(!p||p.scope!=='AGGREGATE_SESSION'||p.sessionId!==r.sessionId||p.actualSettled!==true||p.nativeExecutionAdmitted!==false)r.unknown=true;else r.aggregateDone=true;},()=>{r.unknown=true;}))r.unknown=true;
 }
 #controlFrame(run){const c=this.#control;if(c.done)return run();c.frames++;try{return run();}finally{c.frames--;finishControl(c);}}
 captureControlSettlement(...extra){return extra.length?null:this.#control.handle;}
 retireControl(...extra){if(extra.length)return null;const c=this.#control;if(!c.retired)this.#controlFrame(()=>{c.retired=true;this.#open=false;this.#gatePending=false;for(const r of this.#records.values())r.lease=null;});return c.handle;}
 isAvailable(){return !this.#lost&&!this.#control.retired&&this.#aggregate.isAvailable();}
 subscribeUnavailable(listener){if(this.#control.retired||!callable(listener)||this.#listener)throw TypeError('One live backend fence required');this.#listener=listener;}
 sendGate(value,...extra){
  const c=this.#control,p=!extra.length&&data(value,['generation','open']);if(c.retired||this.#lost||!p||!positive(p.generation)||p.generation<=this.#generation||typeof p.open!=='boolean')return resolved(failure());
  return this.#controlFrame(()=>{
   // A valid refused request still fences locally; it cannot let an old OPEN
   // publish. Keep the second retained slot available for a safety CLOSE.
   this.#generation=p.generation;this.#open=false;this.#gatePending=true;for(const r of this.#records.values())r.lease=null;
   if(c.calls.size>=2||p.open&&c.calls.size||!p.open&&[...c.calls].some(x=>!x.open))return resolved(failure());
   const cell={open:p.open,original:null,secondary:null,reply:failure()};c.calls.add(cell);
   let replyResolve;const replyPromise=new NativePromise(resolve=>replyResolve=resolve);
   // Refuse a poisoned observation environment BEFORE aggregate entry.
   try{promise(replyPromise);}catch{c.calls.delete(cell);this.#lose();replyResolve(failure());return replyPromise;}
   try{
    cell.original=this.#aggregate.sendGate(p);promise(cell.original);
    cell.secondary=apply(then,cell.original,[value=>{this.#controlFrame(()=>{try{
     const r=data(value,['ok','generation','open']);
     if(c.retired||this.#lost||p.generation!==this.#generation||!r||!Object.isFrozen(value)||r.ok!==true||r.generation!==p.generation||r.open!==p.open)return;
     this.#gatePending=false;this.#open=p.open;cell.reply=value;
    }catch{this.#lose();}finally{cell.original=null;}});},()=>{this.#controlFrame(()=>{try{this.#lose();}finally{cell.original=null;}});}]);
    promise(cell.secondary);
    const complete=()=>{this.#controlFrame(()=>{cell.secondary=null;c.calls.delete(cell);const reply=cell.reply;cell.reply=null;replyResolve(c.retired?failure():reply);});};
    // These terminal observers return undefined and cannot assimilate provider
    // work. The secondary covers the complete backend reply/notification path.
    apply(then,cell.secondary,[complete,complete]);
   }catch{c.unknown=true;this.#lose();replyResolve(failure());}
   return replyPromise;
  });
 }
 #check(r,{open=false,phase=null}={}){
  const expectedPhase=r.phase;
  if(this.#lost||this.#control.retired||this.#records.get(r.ownerId)!==r||r.failed||r.stop||phase&&r.phase!==phase||r.phase!=='ready'&&!r.guard)throw Error('BACKEND_RETIRED');
  if(r.phase!=='ready'&&clock()>=r.expires)throw Error('STARTUP_TIMEOUT');
  if(r.phase!=='ready'&&apply(r.guard,undefined,[])!==true)throw Error('ADMISSION_REFUSED');
  if(r.phase!=='ready'&&r.connectGuard&&apply(r.connectGuard,undefined,[])!==true)throw Error('ADMISSION_REFUSED');
  // Allocation validates the retained process in the ownership adapter. The
  // three-endpoint predicate is meaningful only after connect has succeeded.
  if(r.connected&&this.#native.assertSessionCurrent({sessionOwnerId:r.ownerId})!==true)throw Error('ENDPOINT_UNAVAILABLE');
  if(r.phase!=='ready'&&apply(r.guard,undefined,[])!==true)throw Error('ADMISSION_REFUSED');
  if(r.phase!=='ready'&&r.connectGuard&&apply(r.connectGuard,undefined,[])!==true)throw Error('ADMISSION_REFUSED');
  // Arbitrary trusted providers above may reenter Lock/Stop. Final state check
  // must occur after them and before any publication or command dispatch.
  if(this.#lost||this.#control.retired||r.failed||r.stop||r.phase!==expectedPhase||this.#records.get(r.ownerId)!==r||phase&&r.phase!==phase||open&&(!this.#open||this.#gatePending)||r.phase!=='ready'&&clock()>=r.expires)throw Error('BACKEND_RETIRED');
 }
 prepare(value,admission,...extra){
  const began=clock(),p=!extra.length&&data(value,configKeys),g=guard(admission);if(!p||!g||this.#lost||this.#control.retired)return failure();
  const c=validateStartupEnvelope({version:1,...p,channelId:randomUUID(),startupId:randomUUID()},this.#policy);if(!c||this.#lifetimes.size>=8||[...this.#records.values(),...this.#lifetimes].some(r=>r.sessionId===c.sessionId))return failure();
  const r={ownerId:null,sessionId:c.sessionId,channelId:c.channelId,projectId:c.projectId,epoch:c.admissionEpoch,leaseEpochFloor:c.admissionEpoch,config:c,guard:g,connectGuard:null,phase:'prepared',failed:false,allocated:false,connected:false,attempted:false,prepared:false,gateBinding:false,gateBound:false,lease:null,lastLeaseGeneration:0,busy:false,channels:null,link:null,gate:null,reader:null,pendingConnection:false,verified:false,stop:null,expires:began+this.#deadline,timer:null,finish:null};
  this.#observation(r);this.#lifetimes.add(r);
  return this.#frame(r,()=>{try{
  if(apply(g,undefined,[])!==true||this.#lost||this.#control.retired||r.retired){r.retired=true;return failure();}
  if(this.#records.size>=8){const old=[...this.#records.values()].find(r=>!r.pendingConnection&&r.actualDone&&r.sessionReleaseProof);if(!old){r.retired=true;return failure();}this.#records.delete(old.ownerId);}
  r.aggregateEntering=true;let reserved;try{reserved=apply(aggregateReserve,this.#aggregate,[c.sessionId]);this.#aggregateObservation(r,reserved.settlement);}finally{r.aggregateEntering=false;}
  if(reserved.result.ok!==true||this.#lost||this.#control.retired||r.retired){r.retired=true;this.#releaseAggregate(r);return failure();}
  r.sessionAttempted=true;let prepared;try{prepared=data(this.#native.prepareSession({hostOwnerId:this.#host,sessionId:c.sessionId,channelId:c.channelId,creator:this.#creator}));}catch{r.unknown=true;this.#lose();return failure();}
  if(!prepared||prepared.ok!==true||!id(prepared.sessionOwnerId)||this.#records.has(prepared.sessionOwnerId)){r.unknown=true;this.#lose();return failure();}
  r.ownerId=prepared.sessionOwnerId;this.#capture(r);
  this.#records.set(r.ownerId,r);r.timer=setTimeout(()=>this.#fail(r),Math.max(1,Math.ceil(r.expires-clock())));
  if(this.#lost||this.#control.retired||r.retired){this.#fail(r);if(!r.stop)this.#stop(r,98,this.#deadline);return failure();}
  try{this.#check(r);}catch{this.#fail(r);return failure();}return success({ownerId:r.ownerId,sessionId:r.sessionId,channelId:r.channelId});
  }catch{r.retired=true;if(r.sessionAttempted)r.unknown=true;this.#releaseAggregate(r);return failure();}});
 }
 allocate(value,...extra){
  const p=!extra.length&&data(value,['ownerId']),r=p&&this.#records.get(p.ownerId);if(!r||r.allocated)return failure();
  return this.#frame(r,()=>{try{this.#check(r,{phase:'prepared'});r.allocated=true;r.phase='allocated';if(this.#native.allocateSession({sessionOwnerId:r.ownerId})?.ok!==true)throw Error();this.#check(r);return success({ownerId:r.ownerId});}catch{this.#fail(r);return failure();}});
 }
 connect(value,admission,...extra){
  const p=!extra.length&&data(value,['ownerId']),r=p&&this.#records.get(p.ownerId),g=guard(admission);
  if(!r||!g||r.attempted||r.phase!=='allocated')return resolved(failure());
  return this.#frame(r,()=>{r.connectWorker=true;
  // Reserve before either admission callback can reenter. Keep the distinct
  // operation grant through every startup await and endpoint observation.
  r.attempted=true;r.connectGuard=g;
  try{this.#check(r,{open:true});}catch{this.#fail(r);r.connectWorker=false;return resolved(failure());}
  r.pendingConnection=true;r.phase='connecting';
  const result=new NativePromise(resolve=>r.finish=resolve);void this.#connect(r);return result;});
 }
 async #connect(r){
  try{
   let original;try{r.connectOriginal=this.#native.connectSession({sessionOwnerId:r.ownerId,deadlineMs:Math.max(1,Math.ceil(r.expires-clock()))});original=promise(r.connectOriginal);}catch{r.connectUnknown=true;r.unknown=true;throw Error('CONNECTION_UNOBSERVABLE');}
   const outcome=data((await this.#wait(r,original)).value,['ok','transport']);this.#check(r,{open:true});
   const t=outcome?.ok===true&&data(outcome.transport,['sessionId','channelId','control','history','command']);if(!t||t.sessionId!==r.sessionId||t.channelId!==r.channelId)throw Error();
   r.connected=true;this.#check(r,{open:true});
   const channels={};r.channels=channels;
   for(const [lane,C]of[['control',ProductionControlChannel],['history',ProductionHistoryChannel],['command',TerminalSessionCommandChannel]]){
    const laneData=data(t[lane],['stream','secret']);if(!laneData)throw Error();
    channels[lane]=new C({stream:laneData.stream,secret:laneData.secret,...(lane==='control'?{}:{sessionId:r.sessionId}),channelId:r.channelId,role:'main',deadlineMs:Math.max(1,Math.ceil(r.expires-clock()))});
   }
   const control=channels.control;
   r.gate=new ProductionGateLink({channelId:r.channelId,send:p=>{if(apply(cp.send,control,[p])!==true)throw Error();},subscribe:s=>apply(cp.subscribe,control,[s]),onUnavailable:()=>{if(!['stopping','exited'].includes(r.phase))this.#fail(r);},deadlineMs:this.#deadline});
   r.reader=new ProductionHistoryReader({channel:channels.history,sessionId:r.sessionId,deadlineMs:this.#deadline});
   // Refuse a mutated Promise environment before the unchanged link constructor
   // attaches its internal observers. This is a descriptor-only guard.
   promise(control.ready);
   r.link=new TerminalSessionLink({channel:channels.command,onUnavailable:()=>{if(!['stopping','exited'].includes(r.phase))this.#fail(r);},deadlineMs:Math.max(1,Math.ceil(r.expires-clock()))});
   if(!(await this.#wait(r,this.#all(r,[control.ready,channels.history.ready,r.link.authenticated]))).value.every(v=>v===true))throw Error();this.#check(r,{open:true});
   const prepared=(await this.#wait(r,apply(lp.prepare,r.link,[r.config,this.#policy]))).value;this.#check(r,{open:true});if(prepared.initiallyClosed!==true)throw Error();r.prepared=true;
   r.gateBinding=true;let bound;
   try{bound=(await this.#wait(r,this.#aggregate.bind(r.sessionId,r.channelId))).value;}finally{r.gateBinding=false;}
   if(bound.ok!==true)throw Error();r.gateBound=true;this.#check(r,{open:true});
   const generation=this.#generation,since=BigInt(Date.now())*10000n+116444736000000000n;
   const ready=(await this.#wait(r,apply(lp.start,r.link,[{gateGeneration:generation}]))).value;this.#check(r,{open:true});if(this.#generation!==generation)throw Error();
   if(this.#native.watchSessionRoot({sessionOwnerId:r.ownerId,shellProcessIdentity:{pid:ready.reportedShell.pid,image:ready.reportedShell.image,since}})?.ok!==true)throw Error();this.#check(r,{open:true});
   if(this.#native.captureSession({sessionOwnerId:r.ownerId})?.ok!==true)throw Error();this.#check(r,{open:true});
   // The startup grant expires at this publication boundary. Later operations
   // use their own fresh main admission guards, including after Lock/Unlock.
   r.phase='ready';r.guard=null;r.connectGuard=null;r.config=null;clearTimeout(r.timer);r.timer=null;
   const finish=r.finish;r.finish=null;finish?.(success({ownerId:r.ownerId,sessionId:r.sessionId,channelId:r.channelId}));
  }catch{this.#fail(r);}finally{if(!r.connectUnknown)r.connectOriginal=null;r.pendingConnection=false;r.connectWorker=false;this.#finishActual(r);}
 }
 #fail(r){
  if(r.failed||r.phase==='exited')return;return this.#frame(r,()=>{r.retired=true;r.failed=true;r.lease=null;r.config=null;if(r.timer!==null)clearTimeout(r.timer);r.timer=null;
  const finish=r.finish;r.finish=null;finish?.(failure());if(r.ownerId)void this.#stop(r,98,this.#deadline);else if(!r.aggregateEntering)this.#releaseAggregate(r);});
 }
 #lose(){
  if(this.#lost)return;return this.#controlFrame(()=>{this.#control.retired=true;this.#lost=true;this.#open=false;this.#generation++;
  const owned=[...this.#lifetimes];for(const r of owned)r.frames++;try{for(const r of owned){r.lease=null;this.#fail(r);}
  try{if(this.#listener)apply(this.#listener,undefined,[]);}catch{}
  try{apply(this.#notify,undefined,[]);}catch{}
  }finally{for(const r of owned){r.frames--;this.#finishActual(r);}}});
 }
 async #command(r,packet,admission){
  if(r.busy)throw Error('COMMAND_BUSY');r.busy=true;
  try{this.#check(r,{phase:'ready'});
   // Endpoint observation is an external callback. Perform the operation's
   // final admission check after it, then only local immutable comparisons.
   if(!this.#open||this.#gatePending||!permitted(admission))throw knownRefusal;const generation=this.#generation;
   if(this.#lost||r.failed||r.stop||r.phase!=='ready'||!this.#open||this.#gatePending||packet.token.gateGeneration!==generation||['input','resize'].includes(packet.op)&&r.lease!==packet.token)throw knownRefusal;
   if(packet.op==='install'){
    if(packet.token.epoch<r.leaseEpochFloor||packet.token.generation<=r.lastLeaseGeneration||r.lease)throw knownRefusal;
    // Reserve only at authorized dispatch. A sent/unknown or known refused
    // request remains consumed; an undispatched Lock/guard refusal does not.
    r.leaseEpochFloor=packet.token.epoch;r.lastLeaseGeneration=packet.token.generation;
   }
   const reply=(await this.#wait(r,apply(lp.request,r.link,[packet]))).value;
   // A known write ACK remains known even when its old view becomes stale.
   // Install/revoke publication still requires current authority below.
   if(reply.status==='failed'&&['GATE_CLOSED','LEASE_STALE'].includes(reply.code))throw knownRefusal;
   if(reply.status!=='accepted'||reply.code!=='COMMAND_ACCEPTED')throw Error();return {reply,generation};
  }catch(error){if(r.link&&apply(lp.stats,r.link,[]).unknownRequests>0)this.#fail(r);if(error===knownRefusal)throw error;throw Error('COMMAND_UNAVAILABLE');}finally{r.busy=false;}
 }
 install(value,admission,...extra){
  const p=!extra.length&&data(value,['ownerId','windowId','epoch','leaseId','generation']),g=guard(admission),r=p&&this.#records.get(p.ownerId);
  if(!r||!g||!id(p.windowId)||!id(p.leaseId)||!positive(p.epoch)||p.epoch<r.leaseEpochFloor||!positive(p.generation)||p.generation<=r.lastLeaseGeneration||r.lease||r.busy||r.outerCommand)return resolved(failure());
  const token=Object.freeze({sessionId:r.sessionId,channelId:r.channelId,projectId:r.projectId,windowId:p.windowId,epoch:p.epoch,leaseId:p.leaseId,generation:p.generation,gateGeneration:this.#generation});
  r.outerCommand=true;return this.#install(r,token,g);
 }
 async #install(r,token,g){try{
  const result=(await this.#wait(r,this.#command(r,{op:'install',token},g))).value;this.#check(r,{phase:'ready'});
  if(!permitted(g)||this.#lost||r.failed||r.stop||r.phase!=='ready'||r.busy||r.lease||!this.#open||this.#gatePending||result.generation!==this.#generation||token.gateGeneration!==this.#generation||token.generation!==r.lastLeaseGeneration||token.epoch!==r.leaseEpochFloor)throw knownRefusal;
  r.lease=token;return success({leaseId:token.leaseId,generation:token.generation});
 }catch(error){if(error!==knownRefusal)this.#fail(r);return failure();}finally{r.outerCommand=false;this.#finishActual(r);}}
 revoke(value,admission,...extra){
  const p=!extra.length&&data(value,['ownerId','leaseId','generation']),g=guard(admission),r=p&&this.#records.get(p.ownerId),token=r?.lease;
  if(!r||!g||!token||token.leaseId!==p.leaseId||token.generation!==p.generation||r.busy||r.outerCommand)return resolved(failure());r.lease=null;r.outerCommand=true;
  return this.#revoke(r,token,g);
 }
 async #revoke(r,token,g){try{await this.#wait(r,this.#command(r,{op:'revoke',token},g));return success({revoked:true});}catch(error){if(error!==knownRefusal)this.#fail(r);return failure();}finally{r.outerCommand=false;this.#finishActual(r);}}
 input(value,admission,...extra){return this.#io('input',value,admission,extra);}
 resize(value,admission,...extra){return this.#io('resize',value,admission,extra);}
 #io(op,value,admission,extra){
  const p=!extra.length&&data(value,['ownerId','leaseId','generation',...(op==='input'?['inputSequence','data']:['cols','rows'])]),g=guard(admission),r=p&&this.#records.get(p.ownerId),token=r?.lease;
  if(!r||!g||!token||token.leaseId!==p.leaseId||token.generation!==p.generation||token.gateGeneration!==this.#generation||!this.#open||r.busy||r.outerCommand)return resolved(refused());
  const packet={op,token,...(op==='input'?{inputSequence:p.inputSequence,data:p.data}:{cols:p.cols,rows:p.rows})};
  r.outerCommand=true;return this.#write(r,packet,g);
 }
 async #write(r,packet,g){try{await this.#wait(r,this.#command(r,packet,g));return Object.freeze({accepted:true});}catch(error){return error===knownRefusal?refused():declined();}finally{r.outerCommand=false;this.#finishActual(r);}}
 readHistory(value,...extra){const p=!extra.length&&data(value,['ownerId','fromSequence','maxBytes']),r=p&&this.#records.get(p.ownerId);if(!r||r.phase!=='ready'||r.failed||!r.reader)return new NativePromise((resolve,reject)=>reject(Error('HISTORY_UNAVAILABLE')));return apply(rp.read,r.reader,[{sessionId:r.sessionId,fromSequence:p.fromSequence,maxBytes:p.maxBytes}]);}
 stopSession(value,...extra){const p=!extra.length&&data(value,['ownerId','deadlineMs','code']),r=p&&this.#records.get(p.ownerId);if(!r||!positive(p.deadlineMs)||p.deadlineMs>10000||![77,98].includes(p.code))return resolved(failure());return this.#frame(r,()=>this.#stop(r,p.code,p.deadlineMs));}
 #verifyFinal(r){
  if(r.verified)return true;if(r.actualDone){if(!r.sessionReleaseProof)return false;r.verified=true;r.phase='exited';r.lease=null;return true;}if(r.verifying)return false;r.verifying=true;
  let v;try{v=this.#frame(r,()=>data(this.#native.verifyExit({ownerId:r.ownerId}),['identityKnown','verifiedExited','remainingCount']));}catch{}finally{r.verifying=false;}
  if(!v||v.verifiedExited!==true||v.remainingCount!==0||v.identityKnown!==true&&r.allocated)return false;
  r.verified=true;r.phase='exited';r.lease=null;this.#releaseAggregate(r);return true;
 }
 #stop(r,code,deadlineMs){
  if(r.stop)return this.#verifyFinal(r)?resolved(success({verifiedExited:true})):r.stop;r.retired=true;r.phase='stopping';r.lease=null;r.config=null;if(r.timer!==null)clearTimeout(r.timer);r.timer=null;const finish=r.finish;r.finish=null;finish?.(failure());
  // Reserve cleanup before any callback can reenter. Retain the actual provider
  // Promise; failed caller receipts never refund native or connection capacity.
  let resolve;const result=new NativePromise(yes=>resolve=yes);r.stop=result;
  r.stopWorker=true;void this.#stopOwned(r,code,deadlineMs,clock(),resolve);return result;
 }
 async #stopOwned(r,code,deadlineMs,began,resolve){
  try{
  if(r.gateBound||r.gateBinding){
   // Expected channel EOF becomes harmless only after a real CLOSED receipt.
   // A stuck/failed close must still reach native Stop once within this budget.
   let timer,quiesced=false;
   try{
    r.quiesceOriginal=this.#aggregate.quiesce(r.sessionId);const work=promise(r.quiesceOriginal);
    r.quiesceObserverPending=true;if(!this.#observe(r,work,()=>{r.quiesceObserverPending=false;r.quiesceOriginal=null;},()=>{r.quiesceObserverPending=false;r.quiesceOriginal=null;})){r.quiesceObserverPending=false;r.unknown=true;}
    const reply=(await this.#wait(r,new NativePromise(yes=>{
     timer=setTimeout(()=>yes(failure()),Math.max(1,Math.ceil(deadlineMs-(clock()-began))));
     if(!this.#observe(r,work,v=>{yes(v);},()=>{yes(failure());})){r.unknown=true;yes(failure());}
    }))).value;
    quiesced=data(reply,['ok'])?.ok===true;
   }catch{r.unknown=true;}finally{if(timer!==undefined)clearTimeout(timer);}
   if(!quiesced)this.#aggregate.dispose();
  }
  for(const [lane,proto]of[['command',sp],['history',hp],['control',cp]])try{if(r.channels?.[lane])apply(proto.dispose,r.channels[lane],[]);}catch{}
  r.stopObserverPending=true;let work;try{r.stopOriginal=this.#native.stopSession({sessionOwnerId:r.ownerId,deadlineMs:Math.max(1,Math.ceil(deadlineMs-(clock()-began))),code});work=promise(r.stopOriginal);}catch{r.stopObserverPending=false;r.unknown=true;resolve(failure());return;}finally{this.#retireAggregate(r);}
  if(!this.#observe(r,work,reply=>{try{const value=data(reply);if(value?.ok===true&&value.verifiedExited===true&&this.#verifyFinal(r))resolve(success({verifiedExited:true}));else resolve(failure());}finally{r.stopObserverPending=false;r.stopOriginal=null;}},()=>{try{resolve(failure());}finally{r.stopObserverPending=false;r.stopOriginal=null;}})){r.stopObserverPending=false;r.unknown=true;resolve(failure());}
  }finally{r.stopWorker=false;this.#finishActual(r);}
 }
 // Passive main-only metadata. Absence is not cleanup proof; observing this
 // snapshot performs no endpoint/admission/native check or reconciliation.
 sessionStatus(value,...extra){
  const p=!extra.length&&data(value,['ownerId']),r=p&&id(p.ownerId)&&this.#records.get(p.ownerId);
  return r?Object.freeze({phase:r.phase,failed:r.failed,backendLost:this.#lost,pendingConnection:r.pendingConnection,cleanupVerified:r.verified,backendReservationRetained:!r.verified||r.pendingConnection}):null;
 }
 stats(){return Object.freeze({sessions:this.#records.size,pendingConnections:[...this.#records.values()].filter(r=>r.pendingConnection).length,ready:[...this.#records.values()].filter(r=>r.phase==='ready'&&!r.failed).length,retainedReservations:[...this.#records.values()].filter(r=>!r.verified||r.pendingConnection).length,generation:this.#generation,open:this.#open,lost:this.#lost,nativeExecutionAdmitted:false});}
}
