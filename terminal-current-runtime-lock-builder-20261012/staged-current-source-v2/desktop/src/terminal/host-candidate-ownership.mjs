// Derived isolated candidate; legacy production/default remains unchanged. SOURCE_ONLY, unwired.
// Private main composition only. No addon loader, admission, renderer bridge,
// process lookup, native polling or legacy synchronous cleanup fallback.
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {createThreeLaneTerminalBootstrap} from './three-lane-bootstrap-codec.mjs';
import {createNativeThreeLaneStream} from './native-three-lane-stream.mjs';
import {TerminalSessionCleanup} from './session-cleanup.mjs';
import {captureHostAsyncOperationFactory} from './host-async-captured-operation.mjs';

const apply=Reflect.apply,clock=performance.now.bind(performance),timer=setTimeout,untimer=clearTimeout;
const NativePromise=Promise,promisePrototype=Promise.prototype,then=promisePrototype.then;
const species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species)?.get;
const isProxy=types.isProxy,isPromise=types.isPromise,wellFormed=String.prototype.isWellFormed;
const fill=Uint8Array.prototype.fill,mainPid=process.pid;
const LANES=['control','history','command'];
const METHODS=['start','snapshot','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync'];
const IDENTITY=['pid','image','createdFileTime'],MEMBER=[...IDENTITY,'alive','exitCode'];
const HOST=['active','root','held','killOnClose','breakaway','inheritable','monitorFired','monitorTerminateSucceeded','stopping'];
const SESSION=[...HOST,'shell','hostPid','atomicBeforeResume','shellMonitorFired','shellMonitorTerminated'];
const PEER=['pairOrdinal','lane','server','connected','retiring','settled','peer','mainPid','creatorPid','queriedPeerPid','nativeDirection','bothJobsChecked','commonJobMember','sessionJobMember','readPending','writePending','readReservedBytes','writeReservedBytes','heldPeerClosed','generation','readIdleTimeout','nativeExecutionAdmitted'];
const cleanupStop=TerminalSessionCleanup.prototype.stop,cleanupVerify=TerminalSessionCleanup.prototype.verifyExit,cleanupStats=TerminalSessionCleanup.prototype.stats,cleanupCapture=TerminalSessionCleanup.prototype.captureSettlement;
const frozen=value=>Object.freeze(Object.assign(Object.create(null),value));
const fail=(code='REQUEST_REFUSED')=>frozen({ok:false,code});
const success=value=>frozen({ok:true,...value});
const cleanupFailure=()=>frozen({ok:false,code:'CLEANUP_FAILED',verifiedExited:false});
const cleanupTimeout=()=>frozen({ok:false,code:'CLEANUP_TIMEOUT',verifiedExited:false});
const cleanupSuccess=()=>frozen({ok:true,code:'CLEANUP_VERIFIED',verifiedExited:true});
const resolved=value=>new NativePromise(resolve=>resolve(value));
const pid=v=>Number.isInteger(v)&&v>0&&v<=0xffffffff;
const uint=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const callback=v=>typeof v==='function'&&!isProxy(v);
const deadline=v=>Number.isInteger(v)&&v>=1&&v<=10000;
function record(value,keys){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const p=Object.getPrototypeOf(value);if(p!==Object.prototype&&p!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const r=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function array(value,max){
 if(!value||typeof value!=='object'||isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const d=Object.getOwnPropertyDescriptor(value,'length');if(!d||!Object.hasOwn(d,'value')||!Number.isInteger(d.value)||d.value<0||d.value>max||Reflect.ownKeys(value).length!==d.value+1)return null;
 const out=[];for(let i=0;i<d.value;i++){const p=Object.getOwnPropertyDescriptor(value,String(i));if(!p?.enumerable||!Object.hasOwn(p,'value'))return null;out.push(p.value);}return out;
}
function absolute(v){return typeof v==='string'&&v.length>0&&v.length<=32767&&apply(wellFormed,v,[])&&/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(v)&&!/[\x00-\x1f\x7f"]/.test(v);}
function birth(v){return typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)&&BigInt(v)<=0xffffffffffffffffn;}
function identity(value,withState=false){
 const r=record(value,withState?MEMBER:IDENTITY);if(!r||!pid(r.pid)||!absolute(r.image)||!birth(r.createdFileTime)||withState&&(typeof r.alive!=='boolean'||!uint(r.exitCode)))return null;return frozen(r);
}
const same=(a,b)=>a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
const expectedIdentity=m=>frozen({pid:m.pid,image:m.image,createdFileTime:m.createdFileTime});
function requestIdentity(value){const r=record(value,['pid','image','since']);return r&&pid(r.pid)&&absolute(r.image)&&typeof r.since==='bigint'&&r.since>0n&&r.since<=0xffffffffffffffffn?r:null;}
const matches=(m,e)=>m.pid===e.pid&&m.image===e.image&&BigInt(m.createdFileTime)>=e.since;
function observation(value,session){
 const r=record(value,session?SESSION:HOST);if(!r||!uint(r.active)||r.killOnClose!==true||r.breakaway!==false||r.inheritable!==false||!['monitorFired','monitorTerminateSucceeded','stopping',...(session?['shellMonitorFired','shellMonitorTerminated']:[])].every(k=>typeof r[k]==='boolean'))return null;
 const root=identity(r.root,true),values=array(r.held,session?32:128);if(!root||!values)return null;
 const held=[],seen=new Set();for(const v of values){const m=identity(v,true);if(!m||seen.has(m.pid))return null;seen.add(m.pid);held.push(m);}
 const shell=session?(r.shell===false?false:identity(r.shell,true)):false;
 if(session&&(!pid(r.hostPid)||r.atomicBeforeResume!==true||shell===null||shell&&shell.pid===root.pid))return null;
 for(const p of[root,shell].filter(Boolean)){const d=held.find(m=>m.pid===p.pid);if(d&&(!same(d,p)||d.alive!==p.alive||d.exitCode!==p.exitCode))return null;}
 return frozen({...r,root,shell,...(!session?{}:{hostPid:r.hostPid}),held:Object.freeze(held)});
}
function nativePromise(value){
 if(!value||typeof value!=='object'||isProxy(value)||!isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))return false;
 const c=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species&&!Object.hasOwn(s,'value');
}
function observe(value,fulfilled,rejected){if(!nativePromise(value))return false;apply(then,value,[v=>{fulfilled(v);},()=>{rejected();}]);return true;}
// JS settlement is deliberately separate from native host destruction.
const ASYNC_METHODS=new Set(['acceptPeerLane','peerRead','peerWrite','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync']);
const CLEANUP_METHODS=new Set(['closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync']);
function unsafeReturned(value){
 if(value===null||!['object','function'].includes(typeof value))return false;
 if(isProxy(value)||isPromise(value))return true;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(isProxy(p))return true;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return !Object.hasOwn(d,'value')||typeof d.value==='function';}return false;
}
function ownershipLifetime(){
 const c={retired:false,done:false,unknown:false,blocked:false,frames:0,pending:0,sessions:0,resolve:null};
 c.handle=frozen({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>frozen({scope:'OWNERSHIP_JS',retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingCallbacks:c.pending,pendingSessions:c.sessions,maxCallbackCells:128,maxFrames:64,maxSessionContinuations:16,hostNativeJoined:false,nativeExecutionAdmitted:false})});return c;
}
function hostShutdownRequest(value){const r=record(value,['code','deadlineMs','shutdownId']);return r&&[77,98].includes(r.code)&&deadline(r.deadlineMs)&&typeof r.shutdownId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(r.shutdownId)?frozen(r):null;}
function hostShutdownLifetime(ownership){
 const c={request:null,launched:false,matched:false,unknown:false,pending:0,done:false,inner:null,resolve:null};
 c.handle=frozen({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:(...extra)=>extra.length?null:frozen({scope:'OWNERSHIP_AND_CAPTURED_HOST_JS',requested:!!c.request,hostStarted:c.launched,ownershipJsSettled:ownership.done,hostOperationJsSettled:c.matched,actualSettled:c.done,unknown:c.unknown||ownership.unknown||!!c.inner?.snapshot().unknown,pendingCallbacks:c.pending,hostNativeJoined:false,sessionCleanupJoined:false,rosterAuthorityEstablished:false,nativeExecutionAdmitted:false})});return c;
}
function opaque(value){return !!value&&typeof value==='object'&&!isProxy(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Reflect.ownKeys(value).length===0;}
function expected(snapshot){return frozen({root:expectedIdentity(snapshot.root),shell:snapshot.shell===false?false:expectedIdentity(snapshot.shell),hostPid:snapshot.hostPid,held:Object.freeze(snapshot.held.map(expectedIdentity))});}
function peerObservation(value,lane,root){
 const r=record(value,PEER),p=r&&record(r.peer,[...MEMBER,'observedBeforeClose']);
 if(!r||!p||!pid(r.pairOrdinal))return false;const m=identity({pid:p.pid,image:p.image,createdFileTime:p.createdFileTime,alive:p.alive,exitCode:p.exitCode},true);
 return !!m&&same(m,root)&&m.alive===true&&p.observedBeforeClose===false&&r.lane===lane&&r.server===true&&r.connected===true&&r.retiring===false&&r.settled===false&&r.mainPid===mainPid&&r.creatorPid===root.pid&&r.queriedPeerPid===root.pid&&r.nativeDirection==='client'&&r.bothJobsChecked===true&&r.commonJobMember===true&&r.sessionJobMember===true&&r.heldPeerClosed===false&&r.readIdleTimeout===false&&r.nativeExecutionAdmitted===false&&uint(r.generation)&&typeof r.readPending==='boolean'&&typeof r.writePending==='boolean'&&r.readReservedBytes===(r.readPending?32768:0)&&uint(r.writeReservedBytes)&&r.writeReservedBytes<=(lane==='control'?2048:90120)&&r.writePending===(r.writeReservedBytes!==0);
}

/**
 * Same-addon capabilities never leave this instance. The native addon itself
 * enforces its distinct opaque type tags; this pure adapter cannot establish
 * binary provenance or kernel truth. isCurrent is a captured main lifetime
 * guard. Provider observations and pure tests never admit native execution.
 * Unknown attempts retain one of eight reservations. Only actual verified
 * Session cleanup AND all peer settlements, or a never-created listeners-only
 * group with a true close receipt, release it. No automatic native retry.
 */
export class TerminalHostCandidateOwnership {
 #native;#methods;#isCurrent;#onUnavailable;#onVerified;#checking=false;#calling=0;
 #life=ownershipLifetime();#callbacks=new Set();#actualSessions=new Set();#publicPromises=new WeakSet();
 #hostFactory=null;#hostOperation=null;#hostLife=hostShutdownLifetime(this.#life);
 #host=null;#sessions=new Map();#closed=new Map();#caps=new WeakSet();
 constructor(options,...extra){
  try{
   const p=record(options,['native','isCurrent','onUnavailable','onVerified']);
   if(extra.length||!p||!['isCurrent','onUnavailable','onVerified'].every(k=>callback(p[k]))||!p.native||typeof p.native!=='object'||isProxy(p.native)||![Object.prototype,null].includes(Object.getPrototypeOf(p.native)))throw Error();
   this.#hostFactory=captureHostAsyncOperationFactory({native:p.native});
   const methods=Object.create(null);for(const name of METHODS){const d=Object.getOwnPropertyDescriptor(p.native,name);if(!d||!Object.hasOwn(d,'value')||!callback(d.value))throw Error();methods[name]=d.value;}
   this.#native=p.native;this.#methods=methods;this.#isCurrent=p.isCurrent;this.#onUnavailable=p.onUnavailable;this.#onVerified=p.onVerified;
  }catch{throw TypeError('Same-addon production ownership DATA dependencies required');}
 }
 get nativeExecutionAdmitted(){return false;}
 captureOwnershipSettlement(...extra){return extra.length?null:this.#life.handle;}
 retireOwnership(...extra){if(extra.length)return null;this.#life.retired=true;for(const r of this.#actualSessions)r.fenced=true;this.#finishOwnership();return this.#life.handle;}
 #finishOwnership(){
  const c=this.#life;if(!c.done&&c.retired&&!c.unknown&&!c.frames&&!c.pending&&!c.sessions){c.done=true;this.#isCurrent=this.#onUnavailable=this.#onVerified=null;const resolve=c.resolve;c.resolve=null;resolve(frozen({scope:'OWNERSHIP_JS',actualSettled:true,hostNativeJoined:false,nativeExecutionAdmitted:false}));}
  this.#launchHostShutdown();this.#finishHostShutdown();
 }
 captureHostShutdownSettlement(...extra){return extra.length?null:this.#hostLife.handle;}
 beginHostShutdown(value,...extra){
  const r=!extra.length&&hostShutdownRequest(value),c=this.#hostLife;if(!r)return null;
  if(c.request)return c.request.code===r.code&&c.request.deadlineMs===r.deadlineMs&&c.request.shutdownId===r.shutdownId?c.handle.actualSettled:null;
  if(!this.#hostOperation)return null;
  return this.#globalFrame(()=>{c.request=r;this.#life.retired=true;for(const session of this.#actualSessions)session.fenced=true;this.#finishOwnership();return c.handle.actualSettled;});
 }
 #launchHostShutdown(){
  const c=this.#hostLife;if(!c.request||c.launched||!this.#life.done||this.#life.frames||this.#life.pending||this.#life.sessions||this.#life.unknown)return;
  c.launched=true;c.inner=this.#hostOperation.captureSettlement();c.pending=1;
  try{
   const observer=apply(then,c.inner.actualSettled,[()=>this.#globalFrame(()=>{c.matched=true;}),()=>this.#globalFrame(()=>{c.unknown=true;})]);
   if(!nativePromise(observer))throw Error('HOST_JOIN_OBSERVER_UNKNOWN');
   apply(then,observer,[()=>this.#globalFrame(()=>{c.pending--;}),()=>this.#globalFrame(()=>{c.unknown=true;})]);
   if(this.#hostOperation.start(c.request)===null)c.unknown=true;
  }catch{c.unknown=true;}
 }
 #finishHostShutdown(){
  const c=this.#hostLife;if(c.done||!c.matched||c.unknown||c.pending||this.#life.frames||!this.#life.done)return;
  c.done=true;c.inner=null;this.#hostOperation=this.#hostFactory=this.#native=this.#methods=null;if(this.#host)this.#host.cap=null;this.#sessions.clear();this.#caps=new WeakSet();
  const resolve=c.resolve;c.resolve=null;resolve(c.handle.snapshot());
 }
 #globalFrame(fn){this.#life.frames++;try{return fn();}finally{this.#life.frames--;this.#finishOwnership();}}
 #reserve(){if(this.#callbacks.size>=128||this.#life.frames>=64)throw Error('OWNERSHIP_UNAVAILABLE');const c={unknown:false,original:null,onDrain:null};this.#callbacks.add(c);this.#life.pending++;return c;}
 #drop(c){if(!this.#callbacks.delete(c))return;this.#life.pending--;c.original=null;const drained=c.onDrain;c.onDrain=null;drained?.();this.#finishOwnership();}
 #unknownCallback(c,value,block=false){c.unknown=true;c.original=value;this.#life.unknown=true;if(block)this.#life.blocked=true;}
 #observeCallback(c,promise){
  if(!nativePromise(promise)){this.#unknownCallback(c,promise);return false;}
  c.original=promise;
  try{const secondary=apply(then,promise,[()=>this.#globalFrame(()=>{}),()=>this.#globalFrame(()=>{})]);if(!nativePromise(secondary))throw Error();apply(then,secondary,[()=>this.#globalFrame(()=>this.#drop(c)),()=>this.#globalFrame(()=>this.#unknownCallback(c,promise))]);return true;}catch{this.#unknownCallback(c,promise);return false;}
 }
 #invoke(fn,receiver,args,async=false,onEnter=null){
  const c=this.#reserve();return this.#globalFrame(()=>{
   let value;try{onEnter?.();value=apply(fn,receiver,args);}catch(e){this.#drop(c);throw e;}
   if(async){this.#observeCallback(c,value);return value;}
   if(unsafeReturned(value)){this.#unknownCallback(c,value,true);if(nativePromise(value))try{apply(then,value,[()=>{},()=>{}]);}catch{}throw Error('OWNERSHIP_UNAVAILABLE');}
   this.#drop(c);return value;
  });
 }
 #finishRoster(r){if(r.globalActualDrained&&r.globalNotifications===0&&this.#actualSessions.delete(r))this.#life.sessions--;}
 #notification(fn,value,r){
  if(!fn||this.#life.done)return;
  let c;try{c=this.#reserve();}catch{this.#life.unknown=true;return;}
  if(r?.settlement){r.globalNotifications++;c.onDrain=()=>{r.globalNotifications--;this.#finishRoster(r);};}
  this.#globalFrame(()=>{let result;try{result=apply(fn,undefined,[value]);}catch{this.#drop(c);return;}
   if(nativePromise(result)){this.#observeCallback(c,result);return;}
   if(unsafeReturned(result)){this.#unknownCallback(c,result);return;}this.#drop(c);
  });
 }
 #trackPublic(promise){
  if(this.#publicPromises.has(promise))return;this.#publicPromises.add(promise);
  let c;try{c=this.#reserve();}catch{this.#life.unknown=true;return;}this.#observeCallback(c,promise);
 }
 #entry(fn,async=false,boolean=false,cleanup=false){
  if(this.#life.done||this.#life.frames>=64||(this.#life.retired||this.#life.blocked)&&!cleanup)return boolean?false:async?resolved(fail('OWNERSHIP_UNAVAILABLE')):fail('OWNERSHIP_UNAVAILABLE');
  return this.#globalFrame(()=>{const value=fn();if(isPromise(value)&&!isProxy(value))this.#trackPublic(value);return value;});
 }
 #call(name,args,r=null,onEnter=null,allowStoppedIdentity=false){const cleanup=CLEANUP_METHODS.has(name);if(!cleanup&&(!this.#guard()||r&&!allowStoppedIdentity&&(r.fenced||r.stopPromise)))throw Error('OWNERSHIP_UNAVAILABLE');this.#calling++;try{return this.#invoke(this.#methods[name],this.#native,args,ASYNC_METHODS.has(name),onEnter);}finally{this.#calling--;}}
 #frame(r,fn){return this.#globalFrame(()=>{r.workFrames++;try{return fn();}finally{r.workFrames--;this.#maybeClosed(r);this.#finishActual(r);}});}
 #observation(r){
  r.workFrames=0;r.actualDone=false;r.releaseProof=null;r.pairCell={pending:false,settled:false,unknown:false,promise:null};r.cleanupActualPending=false;r.cleanupActualDone=false;r.cleanupHandle=null;r.cleanupSnapshot=null;r.forwardPending=false;r.forwardUnknown=false;r.closedUnknown=false;
  r.unknownNativeCell={entered:false,pending:false,settled:false,unknown:false,promise:null};
  r.settlement=frozen({sessionOwnerId:r.ownerId,sessionId:r.sessionId,actualSettled:new NativePromise(resolve=>r.actualResolve=resolve),verifiedRelease:new NativePromise(resolve=>r.releaseResolve=resolve),snapshot:()=>this.#settlementSnapshot(r)});
  r.globalActualDrained=false;r.globalNotifications=0;this.#actualSessions.add(r);this.#life.sessions++;
  let c;try{c=this.#reserve();c.onDrain=()=>{r.globalActualDrained=true;this.#finishRoster(r);};this.#observeCallback(c,r.settlement.actualSettled);}catch{this.#life.unknown=true;}
 }
 #ioUnknown(r){return Object.values(r.lanes).some(l=>l.io&&Object.values(l.io).some(c=>c.unknown));}
 #unknown(r){return r.acceptUnknown||r.closedUnknown||r.pairCell.unknown||r.forwardUnknown||r.unknownNativeCell.unknown||this.#ioUnknown(r)||!!(r.cleanupSnapshot&&apply(r.cleanupSnapshot,undefined,[]).unknown)||!!(r.stopLaunched&&r.nativeAttempted&&!r.cleanup&&!r.unknownNativeCell.entered);}
 #settlementSnapshot(r){return frozen({sessionOwnerId:r.ownerId,sessionId:r.sessionId,stopping:!!r.stopPromise,actualSettled:r.actualDone,verifiedReleased:r.releaseProof!==null,unknown:this.#unknown(r),activeFrames:r.workFrames,pair:frozen({settled:r.pairCell.settled,unknown:r.pairCell.unknown}),cleanup:r.cleanupSnapshot?apply(r.cleanupSnapshot,undefined,[]):null,lanes:Object.freeze(LANES.map(lane=>{const l=r.lanes[lane];return frozen({lane,acceptSettled:!!l?.handlerDone,acceptUnknown:!!l?.acceptUnknown,streamSettled:!!l?.closedDone,io:l?.io?frozen(Object.fromEntries(Object.entries(l.io).map(([name,c])=>[name,frozen({entered:c.entered,pending:c.pending,settled:c.settled,unknown:c.unknown})]))):null});})),nativeExecutionAdmitted:false});}
 // Main-private passive DATA handle. Capture while owned; retained proof survives
 // release/cache eviction. Neither observation is a whole-host teardown receipt.
 captureSessionSettlement(value,...extra){const p=!extra.length&&record(value,['sessionOwnerId']);return p&&typeof p.sessionOwnerId==='string'?this.#sessions.get(p.sessionOwnerId)?.settlement??null:null;}
 #finishActual(r){
  if(r.actualDone||!r.stopPromise||r.workFrames||r.allocating||!r.closeStarted||!r.pairCell.settled||r.acceptPending||r.streamPending||r.cleanupActualPending||r.forwardPending||this.#unknown(r))return;
  if(r.nativeAttempted&&(r.cleanup?!r.cleanupActualDone:!r.unknownNativeCell.settled))return;
  for(const l of Object.values(r.lanes)){if(!l.handlerDone||l.stream&&!l.closedDone||l.io&&Object.values(l.io).some(c=>c.pending))return;}
  r.actualDone=true;const resolve=r.actualResolve;r.actualResolve=null;resolve(frozen({scope:'SESSION',sessionOwnerId:r.ownerId,sessionId:r.sessionId,actualSettled:true,verifiedExited:r.releaseProof!==null,nativeExecutionAdmitted:false}));
 }
 #streamCall(r,l,name,args){
  if(args[0]!==l.endpoint)throw Error('OWNERSHIP_UNAVAILABLE');
  return this.#frame(r,()=>{
   if(name==='assertPeerCurrent')return this.#call(name,args,r);
   const c=l.io[{peerRead:'read',peerWrite:'write',closePeerEndpoint:'close'}[name]];
   if(!c||c.pending||c.unknown)throw Error('OWNERSHIP_UNAVAILABLE');
   let entered=false;
   // The stream may turn an unobservable entered call into a local failure.
   // Its closed Boolean cannot erase this original lane's unknown I/O charge.
   try{const value=this.#call(name,args,r,()=>{entered=true;c.entered=true;c.pending=true;c.settled=false;});if(!nativePromise(value))throw Error();c.promise=value;
    const done=()=>this.#frame(r,()=>{c.pending=false;c.settled=true;c.promise=null;});
    if(!observe(value,done,done))throw Error();return value;
   }catch{if(entered){c.pending=false;c.unknown=true;}throw Error('OWNERSHIP_UNAVAILABLE');}
  });
 }
 #cap(value){if(!opaque(value)||this.#caps.has(value))throw Error();this.#caps.add(value);return value;}
 #guard(){if(this.#life.retired||this.#life.blocked||this.#checking||this.#calling)return false;this.#checking=true;try{const value=this.#invoke(this.#isCurrent,undefined,[]);return !this.#life.retired&&!this.#life.blocked&&value===true;}catch{return false;}finally{this.#checking=false;}}
 #notify(r){if(r.notified)return;const run=()=>{r.notified=true;this.#notification(this.#onUnavailable,frozen({sessionOwnerId:r.ownerId??null,sessionId:r.sessionId??null,code:'OWNERSHIP_UNAVAILABLE'}),r);};if(r.settlement)this.#frame(r,run);else run();}
 #fence(r){r.fenced=true;if(r.state!=='stopping'&&r.state!=='exited')r.state='cleanup-failed';if(r.pair)this.#closePeers(r);this.#notify(r);}
 #hostCurrent(){const h=this.#host;if(!h||h.state!=='running'||!this.#guard()||h.state!=='running')return false;
  try{const s=observation(this.#call('snapshot',[h.cap]),false);return h.state==='running'&&!!s&&same(s.root,h.root)&&s.root.alive&&s.active>=1&&!s.stopping&&this.#guard()&&h.state==='running';}catch{return false;}
 }
 startHost(...args){return this.#entry(()=>this.#startHost(...args),false,false,false);}
 #startHost(value,...extra){
  const p=!extra.length&&record(value,['hostProcessIdentity']),e=p&&requestIdentity(p.hostProcessIdentity);
  if(!p||!e)return fail();if(this.#host||!this.#guard())return fail('HOST_UNAVAILABLE');
  const h={ownerId:randomUUID(),state:'starting',cap:null,root:null,notified:false};this.#host=h;
  try{h.cap=this.#cap(this.#call('start',[e.pid,e.image,e.since]));this.#hostOperation=this.#hostFactory.bindHost(h.cap);this.#hostFactory=null;if(!this.#hostOperation)throw Error('HOST_BIND_REFUSED');if(!this.#guard()||h.state!=='starting')throw Error();const s=observation(this.#call('snapshot',[h.cap]),false);if(!s||!matches(s.root,e)||!s.root.alive||s.active<1||s.stopping||!this.#guard()||h.state!=='starting')throw Error();h.root=s.root;h.state='running';return success({hostOwnerId:h.ownerId});}
  catch{h.state='cleanup-failed';this.#notify(h);return fail('CLEANUP_FAILED');}
 }
 prepareSession(...args){return this.#entry(()=>this.#prepareSession(...args),false,false,false);}
 #prepareSession(value,...extra){
  const p=!extra.length&&record(value,['hostOwnerId','sessionId','channelId','creator']),c=p&&record(p.creator,['executable','entry','directory']);
  if(!p||!c||typeof p.hostOwnerId!=='string'||!id(p.sessionId)||!id(p.channelId)||!Object.values(c).every(absolute))return fail();
  if(!this.#host||this.#host.ownerId!==p.hostOwnerId||!this.#hostCurrent())return fail('HOST_UNAVAILABLE');
  if(this.#sessions.size>=8||this.#actualSessions.size>=16)return fail('CAPACITY_EXCEEDED');if([...this.#sessions.values()].some(r=>r.sessionId===p.sessionId||r.channelId===p.channelId))return fail();
  if(c.executable!==this.#host.root.image)return fail();
  const r={ownerId:randomUUID(),sessionId:p.sessionId,channelId:p.channelId,creator:frozen(c),hostPid:this.#host.root.pid,state:'preparing',fenced:false,notified:false,verifiedNotified:false,pair:null,cap:null,bootstrap:null,snapshot:null,nativeAttempted:false,allocating:false,acceptStarted:false,acceptPending:0,acceptUnknown:false,lanes:Object.create(null),connectPromise:null,connectResolve:null,connectTimer:null,connectExpires:null,connectDone:false,transport:null,closeStarted:false,closePromise:null,closeResolve:null,pairSettled:false,pairVerified:false,streamPending:0,streamVerified:true,closeDeadline:10000,cleanup:null,stopPromise:null,stopResolve:null,stopResult:null,stopTimer:null,stopExpires:null,stopCode:null};
  this.#observation(r);this.#sessions.set(r.ownerId,r); // Reserve before any provider or callback.
  return this.#frame(r,()=>{
  r.allocating=true;
  try{r.bootstrap=createThreeLaneTerminalBootstrap({sessionId:r.sessionId,channelId:r.channelId});r.pair=this.#cap(this.#call('createPeerListeners',[this.#host.cap,r.bootstrap.controlPipe,r.bootstrap.historyPipe,r.bootstrap.commandPipe],r));if(r.fenced||r.state!=='preparing'||!this.#guard()||r.fenced)throw Error();r.state='prepared';return success({sessionOwnerId:r.ownerId});}
  catch{this.#fence(r);return fail('CLEANUP_FAILED');}
  finally{r.allocating=false;if(r.stopPromise)this.#launchStop(r);}
  });
 }
 allocateSession(...args){return this.#entry(()=>this.#allocateSession(...args),false,false,false);}
 #allocateSession(value,...extra){
  const p=!extra.length&&record(value,['sessionOwnerId']),r=p&&this.#sessions.get(p.sessionOwnerId);if(!r||r.state!=='prepared'||r.fenced)return fail();
  return this.#frame(r,()=>{
  if(!this.#hostCurrent()||r.fenced||r.state!=='prepared'){this.#fence(r);return fail('HOST_UNAVAILABLE');}
  r.state='allocating';r.allocating=true;
  try{
   r.cap=this.#cap(this.#call('createPeerSession',[this.#host.cap,r.creator.executable,r.creator.entry,r.creator.directory,r.bootstrap.payload,r.pair],r,()=>{r.nativeAttempted=true;}));
   if(!this.#guard())throw Error();
   const s=observation(this.#call('snapshotSession',[r.cap],r,null,true),true);
   if(!s||s.hostPid!==r.hostPid||s.root.image!==r.creator.executable||!s.root.alive||s.active<1||s.stopping||s.shell!==false||s.held.length!==0)throw Error();r.snapshot=s;
   if(r.fenced||r.stopPromise||!this.#guard()||r.fenced)throw Error();r.state='allocated';return success({});
  }catch{this.#fence(r);return fail('CLEANUP_FAILED');}
  finally{r.allocating=false;if(r.bootstrap)try{apply(fill,r.bootstrap.payload,[0]);}catch{}if(r.stopPromise)this.#launchStop(r);}
  });
 }
 #readSession(r){
  if(!r.cap||!r.snapshot||r.stopPromise||r.fenced)return null;
  const s=observation(this.#call('snapshotSession',[r.cap],r),true),old=r.snapshot;
  if(!s||!same(s.root,old.root)||s.hostPid!==r.hostPid||!s.root.alive||s.active<1||s.stopping||old.shell!==false&&(!s.shell||!same(s.shell,old.shell)||!s.shell.alive)||s.held.length!==old.held.length||!s.held.every(m=>m.alive&&old.held.some(n=>same(m,n))))return null;return s;
 }
 connectSession(...args){return this.#entry(()=>this.#connectSession(...args),true,false,false);}
 #connectSession(value,...extra){
  const p=!extra.length&&record(value,['sessionOwnerId','deadlineMs']),r=p&&this.#sessions.get(p.sessionOwnerId);
  if(!r||!deadline(p.deadlineMs)||r.state!=='allocated'||r.fenced||r.acceptStarted)return resolved(fail());
  return this.#frame(r,()=>{
  if(!this.#hostCurrent()||r.fenced||r.state!=='allocated'){this.#fence(r);return resolved(fail('HOST_UNAVAILABLE'));}
  r.state='connecting';r.acceptStarted=true;r.acceptPending=3;r.closeDeadline=p.deadlineMs;r.connectExpires=clock()+p.deadlineMs;
  r.connectPromise=new NativePromise(resolve=>r.connectResolve=resolve);r.connectTimer=timer(()=>this.#connectTimeout(r),p.deadlineMs);
  // Reserve all three settlement slots before any captured provider can reenter.
  for(const lane of LANES){r.lanes[lane]={endpoint:null,stream:null,destroy:null,closed:null,settled:false,handlerDone:false,acceptUnknown:false,closedDone:false,io:Object.fromEntries(['read','write','close'].map(name=>[name,{entered:false,pending:false,settled:false,unknown:false,promise:null}]))};}
  for(const lane of LANES){let entered=false;try{const promise=this.#call('acceptPeerLane',[r.pair,lane,p.deadlineMs],r,()=>{entered=true;});if(!observe(promise,e=>this.#frame(r,()=>{try{this.#accepted(r,lane,e);}finally{r.lanes[lane].handlerDone=true;}}),()=>this.#frame(r,()=>{try{this.#acceptFailed(r,lane);}finally{r.lanes[lane].handlerDone=true;}})))throw Error();}catch{if(entered){r.acceptUnknown=true;r.lanes[lane].acceptUnknown=true;}this.#acceptFailed(r,lane);r.lanes[lane].handlerDone=true;}}
  this.#checkConnect(r);return r.connectPromise;
  });
 }
 #acceptFailed(r,lane){const l=r.lanes[lane];if(l.settled)return;l.settled=true;r.acceptPending--;this.#fence(r);this.#finishConnect(r,fail('PEER_UNAVAILABLE'));this.#maybeClosed(r);}
 #accepted(r,lane,value){
  const l=r.lanes[lane];if(l.settled)return;l.settled=true;r.acceptPending--;
  try{
   l.endpoint=this.#cap(value);
   // Own the endpoint even after a timeout, so late success is closed/reaped.
   l.native=Object.freeze(Object.fromEntries(['peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint'].map(name=>[name,(...args)=>this.#streamCall(r,l,name,args)])));
   l.stream=createNativeThreeLaneStream({native:l.native,endpoint:l.endpoint,lane,deadlineMs:r.closeDeadline});
   const d=Object.getOwnPropertyDescriptor(l.stream,'destroy'),c=Object.getOwnPropertyDescriptor(l.stream,'closed'),on=Object.getOwnPropertyDescriptor(l.stream,'on');
   if(!d||!callback(d.value)||!c||!Object.hasOwn(c,'value')||!nativePromise(c.value)||!on||!callback(on.value))throw Error();l.destroy=d.value;l.closed=c.value;
   apply(on.value,l.stream,['close',()=>{if(!r.closeStarted){this.#fence(r);this.#finishConnect(r,fail('PEER_UNAVAILABLE'));}}]);
   if(r.fenced||r.closeStarted){this.#closeStream(r,l);this.#maybeClosed(r);return;}
   if(!r.snapshot||!this.#guard()||r.fenced||this.#call('assertPeerCurrent',[l.endpoint],r)!==true||!this.#guard()||r.fenced||!peerObservation(this.#call('peerSnapshot',[l.endpoint],r),lane,r.snapshot.root)||!this.#guard()||r.fenced)throw Error();
  }catch{r.streamVerified=false;this.#fence(r);this.#finishConnect(r,fail('PEER_UNAVAILABLE'));}
  this.#checkConnect(r);this.#maybeClosed(r);
 }
 #checkConnect(r){
  if(r.connectDone)return;if(clock()>=r.connectExpires){this.#connectTimeout(r);return;}
  if(r.fenced){this.#finishConnect(r,fail('PEER_UNAVAILABLE'));return;}if(r.acceptPending)return;
  try{
   if(!this.#guard()||r.fenced||r.stopPromise)throw Error();
   for(const lane of LANES){const l=r.lanes[lane];if(!l.endpoint||!l.stream||this.#call('assertPeerCurrent',[l.endpoint],r)!==true||r.fenced||r.stopPromise)throw Error();}
   if(!this.#guard()||r.fenced||r.stopPromise||clock()>=r.connectExpires)throw Error();const t={sessionId:r.sessionId,channelId:r.channelId};for(const lane of LANES)t[lane]=frozen({stream:r.lanes[lane].stream,secret:Buffer.from(r.bootstrap[lane+'Secret'])});
   r.transport=frozen(t);r.state='connected';this.#finishConnect(r,success({transport:r.transport}));
  }catch{this.#fence(r);this.#finishConnect(r,fail('PEER_UNAVAILABLE'));}
 }
 #connectTimeout(r){if(r.connectDone)return;const remaining=r.connectExpires-clock();if(remaining>0){r.connectTimer=timer(()=>this.#connectTimeout(r),Math.ceil(remaining));return;}this.#fence(r);this.#finishConnect(r,fail('PEER_TIMEOUT'));}
 #finishConnect(r,result){if(r.connectDone)return;r.connectDone=true;if(r.connectTimer!==null){untimer(r.connectTimer);r.connectTimer=null;}const resolve=r.connectResolve;r.connectResolve=null;if(resolve)resolve(result);}
 watchSessionRoot(...args){return this.#entry(()=>this.#watchSessionRoot(...args),false,false,false);}
 #watchSessionRoot(value,...extra){
  const p=!extra.length&&record(value,['sessionOwnerId','shellProcessIdentity']),e=p&&requestIdentity(p.shellProcessIdentity),r=p&&this.#sessions.get(p.sessionOwnerId);
  if(!r||!e||r.state!=='connected'||r.fenced||r.stopPromise)return fail();
  return this.#frame(r,()=>{
  if(!this.#assertCurrent(r))return fail('PEER_UNAVAILABLE');r.state='watching';r.allocating=true;
  try{const s=observation(this.#call('watchRoot',[r.cap,e.pid,e.image,e.since],r),true);if(!s||!same(s.root,r.snapshot.root)||s.hostPid!==r.hostPid||!s.shell||!matches(s.shell,e)||!s.shell.alive||!s.root.alive||s.active<2||s.stopping||s.held.length!==0)throw Error();r.snapshot=s;if(r.fenced||r.stopPromise||!this.#guard()||r.fenced)throw Error();r.state='watched';return success({});}
  catch{this.#fence(r);return fail('CLEANUP_FAILED');}
  finally{r.allocating=false;if(r.stopPromise)this.#launchStop(r);}
  });
 }
 captureSession(...args){return this.#entry(()=>this.#captureSession(...args),false,false,false);}
 #captureSession(value,...extra){
  const p=!extra.length&&record(value,['sessionOwnerId']),r=p&&this.#sessions.get(p.sessionOwnerId);if(!r||r.state!=='watched'||r.fenced||r.stopPromise)return fail();
  return this.#frame(r,()=>{
  if(!this.#assertCurrent(r))return fail('PEER_UNAVAILABLE');r.state='capturing';r.allocating=true;
  try{const s=observation(this.#call('captureSession',[r.cap],r),true),old=r.snapshot;if(!s||!same(s.root,old.root)||s.hostPid!==r.hostPid||!s.shell||!same(s.shell,old.shell)||s.active<2||s.stopping||s.held.length<2||![s.root,s.shell,...s.held].every(m=>m.alive)||!s.held.some(m=>same(m,s.root))||!s.held.some(m=>same(m,s.shell)))throw Error();r.snapshot=s;if(r.fenced||r.stopPromise||!this.#guard()||r.fenced)throw Error();r.state='running';return success({});}
  catch{this.#fence(r);return fail('CLEANUP_FAILED');}
  finally{r.allocating=false;if(r.stopPromise)this.#launchStop(r);}
  });
 }
 #assertCurrent(r){
  if(!r||r.fenced||r.stopPromise||!['connected','watched','running'].includes(r.state))return false;
  try{if(!this.#hostCurrent()||r.fenced||r.stopPromise)throw Error();for(const lane of LANES){const l=r.lanes[lane];if(!l?.endpoint||this.#call('assertPeerCurrent',[l.endpoint],r)!==true||r.fenced||r.stopPromise)throw Error();}if(!this.#readSession(r)||r.fenced||r.stopPromise||!this.#guard()||r.fenced||r.stopPromise)throw Error();return true;}
  catch{this.#fence(r);return false;}
 }
 assertSessionCurrent(...args){return this.#entry(()=>this.#assertSessionCurrent(...args),false,true,false);}
 #assertSessionCurrent(value,...extra){const p=!extra.length&&record(value,['sessionOwnerId']),r=p&&this.#sessions.get(p.sessionOwnerId);return !!r&&this.#frame(r,()=>this.#assertCurrent(r));}
 #closeStream(r,l){
  if(!l.stream||l.closeObserved)return;return this.#frame(r,()=>{l.closeObserved=true;r.streamPending++;
  if(!observe(l.closed,v=>this.#frame(r,()=>{r.streamPending--;if(v!==true)r.streamVerified=false;l.closedDone=true;}),()=>this.#frame(r,()=>{r.streamPending--;r.streamVerified=false;l.closedDone=true;}))){r.streamPending--;r.streamVerified=false;r.closedUnknown=true;}
  try{apply(l.destroy,l.stream,[]);}catch{r.streamVerified=false;r.closedUnknown=true;}});
 }
 #closePeers(r){
  if(r.closeStarted)return r.closePromise;return this.#frame(r,()=>{r.closeStarted=true;r.closePromise=new NativePromise(resolve=>r.closeResolve=resolve);
  for(const l of Object.values(r.lanes))this.#closeStream(r,l);
  if(r.pair){r.pairCell.pending=true;try{const promise=this.#call('closePeerListeners',[r.pair,r.closeDeadline]);r.pairCell.promise=promise;if(!observe(promise,v=>this.#frame(r,()=>{r.pairSettled=true;r.pairVerified=v===true;r.pairCell.pending=false;r.pairCell.settled=true;r.pairCell.promise=null;}),()=>this.#frame(r,()=>{r.pairSettled=true;r.pairCell.pending=false;r.pairCell.settled=true;r.pairCell.promise=null;})))throw Error();}catch{r.pairSettled=true;r.pairVerified=false;r.pairCell.pending=false;r.pairCell.unknown=true;}}
  else{r.pairSettled=true;r.pairVerified=false;r.pairCell.unknown=true;}
  this.#maybeClosed(r);return r.closePromise;
  });
 }
 #maybeClosed(r){if(!r.closeStarted||!r.pairSettled||r.workFrames||r.acceptPending||r.streamPending||Object.values(r.lanes).some(l=>!l.handlerDone||l.io&&Object.values(l.io).some(c=>c.pending))||!r.closeResolve)return;const resolve=r.closeResolve;r.closeResolve=null;resolve(r.pairVerified&&r.streamVerified&&!r.acceptUnknown&&!this.#ioUnknown(r));}
 stopSession(...args){return this.#entry(()=>this.#stopSession(...args),true,false,true);}
 #stopSession(value,...extra){
  const p=!extra.length&&record(value,['sessionOwnerId','deadlineMs','code']);if(!p||typeof p.sessionOwnerId!=='string'||!deadline(p.deadlineMs)||![77,98].includes(p.code))return resolved(fail());
  const closed=this.#closed.get(p.sessionOwnerId);if(closed)return resolved(cleanupSuccess());const r=this.#sessions.get(p.sessionOwnerId);if(!r)return resolved(fail());
  if(r.stopPromise)return r.stopPromise;
  return this.#frame(r,()=>{
  r.stopPromise=new NativePromise(resolve=>r.stopResolve=resolve);r.stopExpires=clock()+p.deadlineMs;r.stopCode=p.code;r.closeDeadline=p.deadlineMs;r.state='stopping';r.fenced=true;
  r.stopTimer=timer(()=>this.#stopTimeout(r),p.deadlineMs);this.#finishConnect(r,fail('PEER_UNAVAILABLE'));
  if(!r.allocating)this.#launchStop(r);return r.stopPromise;
  });
 }
 #launchStop(r){
  if(r.cleanup||r.stopLaunched)return;return this.#frame(r,()=>{r.stopLaunched=true;
  if(!r.nativeAttempted){r.forwardPending=true;const peers=this.#closePeers(r);if(!observe(peers,v=>this.#frame(r,()=>{try{this.#checkStop(r);if(v===true){this.#release(r,false);this.#settleStop(r,cleanupSuccess());}else this.#failStop(r);}finally{r.forwardPending=false;}}),()=>this.#frame(r,()=>{try{this.#failStop(r);}finally{r.forwardPending=false;}}))){r.forwardPending=false;r.forwardUnknown=true;}return;}
  if(!r.cap||!r.snapshot){
   // A known opaque Session must still receive one actual cleanup attempt,
   // even when its identity observation was invalid. Nothing can verify or
   // refund this unknown reservation; do not let a close Boolean invent it.
   if(r.cap){r.unknownNativePending=true;const c=r.unknownNativeCell;c.entered=true;c.pending=true;try{const ms=Math.max(1,Math.min(10000,Math.ceil(r.stopExpires-clock()))),promise=this.#call('stopAndCloseSessionAsync',[r.cap,r.stopCode,ms]);c.promise=promise;const done=()=>this.#frame(r,()=>{r.unknownNativePending=false;r.unknownNativeSettled=true;c.pending=false;c.settled=true;c.promise=null;});if(!observe(promise,done,done))throw Error();}catch{r.unknownNativePending=false;c.pending=false;c.unknown=true;}}
   this.#closePeers(r);this.#failStop(r);return;
  }
  try{
   r.cleanup=new TerminalSessionCleanup({expected:expected(r.snapshot),stopNative:(code,ms)=>this.#call('stopAndCloseSessionAsync',[r.cap,code,ms]),closePeers:()=>this.#closePeers(r),onUnavailable:()=>{this.#notify(r);},onVerified:()=>this.#release(r,true)});
   r.cleanupHandle=apply(cleanupCapture,r.cleanup,[]);r.cleanupSnapshot=r.cleanupHandle.snapshot;r.cleanupActualPending=true;
   if(!observe(r.cleanupHandle.actualSettled,()=>this.#frame(r,()=>{r.cleanupActualPending=false;r.cleanupActualDone=true;}),()=>this.#frame(r,()=>{r.cleanupActualPending=false;r.forwardUnknown=true;})))throw Error();
   r.forwardPending=true;
   const remaining=Math.max(1,Math.min(10000,Math.ceil(r.stopExpires-clock()))),promise=apply(cleanupStop,r.cleanup,[{deadlineMs:remaining,code:r.stopCode}]);
   if(!observe(promise,v=>this.#frame(r,()=>{try{this.#checkStop(r);if(v.ok===true)this.#settleStop(r,r.releaseProof?cleanupSuccess():cleanupFailure());else this.#settleStop(r,v);}finally{r.forwardPending=false;}}),()=>this.#frame(r,()=>{try{this.#failStop(r);}finally{r.forwardPending=false;}})))throw Error();this.#checkStop(r);
  }catch{r.forwardPending=false;r.forwardUnknown=true;this.#closePeers(r);this.#failStop(r);}
  });
 }
 #checkStop(r){if(!r.stopResult&&clock()>=r.stopExpires)this.#timeoutStop(r);}
 #stopTimeout(r){if(r.stopResult)return;const remaining=r.stopExpires-clock();if(remaining>0){r.stopTimer=timer(()=>this.#stopTimeout(r),Math.ceil(remaining));return;}this.#timeoutStop(r);}
 #timeoutStop(r){if(r.stopResult)return;r.stopResult=cleanupTimeout();this.#notify(r);this.#settleStop(r,r.stopResult,true);}
 #failStop(r){if(r.stopResult)return;r.stopResult=cleanupFailure();this.#notify(r);this.#settleStop(r,r.stopResult,true);}
 #settleStop(r,value,selected=false){if(r.stopResult&&!selected)return;if(!selected)r.stopResult=value;if(r.stopTimer!==null){untimer(r.stopTimer);r.stopTimer=null;}const resolve=r.stopResolve;r.stopResolve=null;if(resolve)resolve(r.stopResult);}
 #release(r,identityKnown){
  if(r.state==='exited'||this.#ioUnknown(r))return;return this.#frame(r,()=>{r.state='exited';r.fenced=true;this.#sessions.delete(r.ownerId);this.#closed.set(r.ownerId,frozen({identityKnown,verifiedExited:true,remainingCount:0}));while(this.#closed.size>128)this.#closed.delete(this.#closed.keys().next().value);
  if(r.bootstrap){r.bootstrap.dispose();r.bootstrap=null;}if(r.transport)for(const lane of LANES)try{apply(fill,r.transport[lane].secret,[0]);}catch{}r.transport=null;r.cap=null;r.pair=null;
  r.releaseProof=frozen({scope:'SESSION',sessionOwnerId:r.ownerId,sessionId:r.sessionId,identityKnown,verifiedExited:true,remainingCount:0,nativeExecutionAdmitted:false});
  if(!r.verifiedNotified){r.verifiedNotified=true;try{this.#notification(this.#onVerified,frozen({sessionOwnerId:r.ownerId,sessionId:r.sessionId}),r);}catch{}finally{const resolve=r.releaseResolve;r.releaseResolve=null;if(resolve)resolve(r.releaseProof);}}
  });
 }
 verifyExit(value,...extra){
  const p=!extra.length&&record(value,['ownerId']);if(!p||typeof p.ownerId!=='string')return frozen({identityKnown:false,verifiedExited:false,remainingCount:null});
  const closed=this.#closed.get(p.ownerId);if(closed)return closed;const r=this.#sessions.get(p.ownerId),s=r?.cleanup?apply(cleanupVerify,r.cleanup,[]):null;
  return frozen({identityKnown:s?.identityKnown===true,verifiedExited:s?.verifiedExited===true,remainingCount:s?.remainingCount??null});
 }
 snapshot(){return frozen({nativeExecutionAdmitted:false,host:this.#host?frozen({hostOwnerId:this.#host.ownerId,state:this.#host.state,asyncTeardownAvailable:false}):null,reservedSessions:this.#sessions.size,maxSessions:8,sessions:Object.freeze([...this.#sessions.values()].map(r=>frozen({sessionOwnerId:r.ownerId,sessionId:r.sessionId,channelId:r.channelId,state:r.state,fenced:r.fenced,allocated:r.cap!==null,allocationAttempted:r.nativeAttempted,acceptPending:r.acceptPending,peerClosePending:r.closeStarted&&r.closeResolve!==null,cleanup:r.cleanup?apply(cleanupStats,r.cleanup,[]):null}))),closedReceipts:this.#closed.size});}
}
