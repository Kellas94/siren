// Additive, UNWIRED private lifecycle/admission core. SOURCE_ONLY / NOT_ADMITTED.
// No runtime loader/native entry/Electron/PTY/shell or renderer bridge. Credited
// attachments are private synthetic composition only; host teardown is unverified.
import {types} from 'node:util';
import {randomUUID} from 'node:crypto';
import {TerminalProductionSessionLedger} from './production-session-state.mjs';
import {TerminalProductionAttachmentOutput} from './production-attachment-output.mjs';
import {TerminalInputFence} from './input-gate.mjs';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from './contracts.mjs';
import {validateStartupEnvelope} from './startup-protocol.mjs';

const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const knownOutcome=v=>{const d=data(v);return d?.accepted===true?'accepted':d?.accepted===false&&d.knownRefused===true&&Reflect.ownKeys(d).length===2?'refused':'unknown';};
const callable=v=>typeof v==='function'&&!types.isProxy(v);
const NativePromise=Promise,promisePrototype=Promise.prototype,promiseThen=Promise.prototype.then,promiseSpecies=Object.getOwnPropertyDescriptor(Promise,Symbol.species);
const fail=(code='HOST_UNAVAILABLE',operationId)=>Object.freeze({ok:false,code,message:code,...(operationId===undefined?{}:{operationId})});
function errorCode(error){
 // Error handling must not execute an arbitrary thrown object's getter/trap
 // or throw again on a primitive. Preserve only bounded own DATA codes.
 if(error===null||!['object','function'].includes(typeof error)||types.isProxy(error))return 'HOST_UNAVAILABLE';
 try{const d=Object.getOwnPropertyDescriptor(error,'code');return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&/^[A-Z][A-Z0-9_]{0,127}$/.test(d.value)?d.value:'HOST_UNAVAILABLE';}catch{return 'HOST_UNAVAILABLE';}
}
function settledValue(value){
 // Native Promise handlers must not return an arbitrary fulfilled value and
 // re-assimilate a later-added then getter/function. Descriptor inspection
 // admits only values whose Promise resolution cannot enter such work.
 if(value===null||!['object','function'].includes(typeof value))return true;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return false;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return Object.hasOwn(d,'value')&&typeof d.value!=='function';}return true;
}
function forwardedValue(value){if(!settledValue(value))refuse('REQUEST_REFUSED');return value;}
const pass=(value,operationId)=>Object.freeze({ok:true,value:Object.freeze(value),...(operationId===undefined?{}:{operationId})});
const refuse=code=>{throw Object.assign(new Error(code),{code});};
function data(value,keys=null){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const result=Object.create(null);for(const key of own){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
}
function method(object,key){
 if(!object||typeof object!=='object'||types.isProxy(object))throw TypeError('Private DATA dependencies required');
 for(let p=object;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw TypeError('Proxy dependency refused');const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(!Object.hasOwn(d,'value')||!callable(d.value))throw TypeError('DATA callback required');return d.value.bind(object);}}
 throw TypeError('Missing private dependency');
}
function promiseEnvironmentIntact(){const ctor=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);return !!ctor&&Object.hasOwn(ctor,'value')&&ctor.value===NativePromise&&!!species&&species.get===promiseSpecies.get&&species.set===promiseSpecies.set&&!Object.hasOwn(species,'value');}
function nativePromise(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))throw TypeError('Native private Promise required');
 if(!promiseEnvironmentIntact())throw TypeError('Changed Promise species');return value;
}
function context(grant){
 if(!grant||typeof grant!=='object'||types.isProxy(grant))return null;const result={};
 for(const key of ['projectId','windowId','epoch','role']){const d=Object.getOwnPropertyDescriptor(grant,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
 return id(result.projectId)&&id(result.windowId)&&positive(result.epoch)&&['workspace','terminal'].includes(result.role)?Object.freeze(result):null;
}
function managerLifetime(sessionId){
 const c={sessionId,retired:false,done:false,unknown:false,frames:0,workers:new Set(),target:null,resolve:null};
 c.handle=Object.freeze({sessionId,actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({sessionId,retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingWorkers:c.workers.size,nativeExecutionAdmitted:false})});return c;
}
function globalLifetime(){
 const c={retired:false,done:false,unknown:false,frames:0,workers:new Set(),bootstrap:true,fenceDone:false,controlDone:false,controlHandle:null,fenceHandle:null,controlRetired:false,fenceRetired:false,pendingSessions:new Set(),slots:new Map(),callbackSlots:0,listBusy:false,release:{ids:new Set(),done:false,resolve:null},resolve:null};
 c.handle=Object.freeze({actualSettled:new NativePromise(resolve=>c.resolve=resolve),sessionReservationsReleased:new NativePromise(resolve=>c.release.resolve=resolve),snapshot:()=>Object.freeze({retired:c.retired,actualSettled:c.done,unknown:c.unknown,bootstrapPending:c.bootstrap,activeFrames:c.frames,pendingWorkers:c.workers.size,pendingOperations:c.slots.size,pendingCallbacks:c.callbackSlots,pendingSessions:c.pendingSessions.size,retainedReservations:c.release.ids.size,sessionReservationsReleased:c.release.done,nativeExecutionAdmitted:false})});return c;
}
function requestLifetime(kind,requestId){
 const c={kind,requestId,done:false,resolve:null};c.handle=Object.freeze({kind,requestId,actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({kind:c.kind,requestId:c.requestId,actualSettled:c.done,nativeExecutionAdmitted:false})});return c;
}
function finishReservationAccounting(c){if(c.done||!c.retired||c.ids.size)return;c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'MANAGER_SESSION_RESERVATIONS',remainingCount:0,nativeExecutionAdmitted:false}));}
function subscriptionBridge(cell){return ()=>{const target=cell.target,listener=cell.listener;if(target)target(listener);};}
function observeManagerRelease(carrier,promise){
 Reflect.apply(promiseThen,nativePromise(promise),[value=>{
  const r=data(value,['scope','sessionOwnerId','sessionId','identityKnown','verifiedExited','remainingCount','nativeExecutionAdmitted']);if(!r||!Object.isFrozen(value)||r.scope!=='SESSION'||r.sessionOwnerId!==carrier.ownerId||r.sessionId!==carrier.sessionId||typeof r.identityKnown!=='boolean'||r.verifiedExited!==true||r.remainingCount!==0||r.nativeExecutionAdmitted!==false)return;
  if(carrier.record){carrier.record.backendReleaseProof=Object.freeze({identityKnown:r.identityKnown});carrier.target?.();return;}
  const a=carrier.accounting;if(!a||a.allocationEntered&&!r.identityKnown)return;a.records.delete(carrier.sessionId);a.release.ids.delete(carrier.sessionId);finishReservationAccounting(a.release);carrier.accounting=null;
 },()=>{}]);
}
export class TerminalProductionManager {
 #deps;#fence;#ledger;#output;#handoffs=new WeakMap();#records=new Map();#deadline;
 #globalRecord={life:globalLifetime()};#bridge={target:null,listener:null};#cachedClosed=null;#cachedShutdown=null;#cachedReconcile=null;#requestHandles=new WeakMap();#requestSequence=0;
 #closed=true;#generation=0;#lost=false;#retired=false;#lifetimes=new Set();#sessionHandles=new WeakMap();
 constructor(options,...extra){
  const p=data(options,['registry','policy','backend','accessReady','cwdAuthority','profilesFor','deadlineMs']);
  if(extra.length||!p||!callable(p.accessReady)||!callable(p.profilesFor)||!positive(p.deadlineMs)||p.deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded private lifecycle dependencies required');
  this.#deadline=p.deadlineMs;this.#deps={current:method(p.registry,'isCurrent'),capture:method(p.registry,'captureAdmissionGuard'),authorize:method(p.policy,'authorize'),cwd:method(p.cwdAuthority,'resolve'),profiles:p.profilesFor,ready:p.accessReady};
  for(const name of ['prepare','allocate','connect','stopSession','sendGate','isAvailable','subscribeUnavailable'])this.#deps[name]=method(p.backend,name);
  for(const name of ['captureBackendSettlement','captureControlSettlement','retireControl','install','revoke','input','resize','readHistory']){try{this.#deps[name]=method(p.backend,name);}catch{this.#deps[name]=null;}}
  this.#ledger=new TerminalProductionSessionLedger({writeInput:p=>{const r=this.#records.get(p.sessionId);return r?this.#work(r,()=>this.#writeInput(p)):this.#writeInput(p);}});
  this.#output=new TerminalProductionAttachmentOutput({deadlineMs:this.#deadline});
  const g=this.#globalRecord.life;g.frames++;
  try{
   // Backend control authority precedes constructor subscription/availability.
   this.#captureGlobalControl();this.#bridge.target=listener=>this.#frame(this.#globalRecord,()=>{this.#hostFailed();listener?.();});
   this.#fence=new TerminalInputFence({ledger:this.#ledger,deadlineMs:this.#deadline,gateLink:{sendGate:p=>this.#deps.sendGate(p),isAvailable:()=>this.#retired?false:this.#sync(()=>this.#deps.isAvailable()),subscribeUnavailable:listener=>{this.#bridge.listener=listener;return this.#sync(()=>this.#deps.subscribeUnavailable(subscriptionBridge(this.#bridge)));}}});
   g.fenceHandle=this.#fence.captureFenceSettlement();const h=data(g.fenceHandle,['actualSettled','snapshot']);if(!h||!Object.isFrozen(g.fenceHandle)||!callable(h.snapshot))g.unknown=true;else this.#watchGlobal(h.actualSettled,value=>{const r=data(value,['scope','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='INPUT_FENCE'&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;},()=>{g.fenceDone=true;});
  }catch(error){g.unknown=true;this.retireManager();throw error;}
  finally{g.bootstrap=false;if(g.retired)this.#retireGlobalLower();g.frames--;this.#finishGlobal();}
 }
 captureManagerSettlement(...extra){return extra.length?null:this.#globalRecord.life.handle;}
 captureManagerRequestSettlement(promise,...extra){return extra.length||!promise||typeof promise!=='object'||types.isProxy(promise)?null:this.#requestHandles.get(promise)??null;}
 #captureGlobalControl(){const g=this.#globalRecord.life;try{if(!this.#deps.captureControlSettlement||!this.#deps.retireControl)throw Error('NO_CONTROL_AUTHORITY');const handle=this.#sync(()=>this.#deps.captureControlSettlement()),h=data(handle,['hostOwnerId','actualSettled','snapshot']);if(!h||!Object.isFrozen(handle)||!id(h.hostOwnerId)||!callable(h.snapshot))throw Error('INVALID_CONTROL_AUTHORITY');g.controlHandle=handle;const hostOwnerId=h.hostOwnerId;this.#watchGlobal(h.actualSettled,value=>{const r=data(value,['scope','hostOwnerId','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='BACKEND_CONTROL_CALLERS'&&r.hostOwnerId===hostOwnerId&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;},()=>{g.controlDone=true;});}catch{g.unknown=true;}}
 #watchGlobal(promise,validate,accept){const g=this.#globalRecord.life;void this.#work(this.#globalRecord,()=>nativePromise(promise),{consume:value=>{if(validate(value))accept();else g.unknown=true;},swallow:true,onRejected:()=>{g.unknown=true;}});}
 #retireGlobalLower(){const g=this.#globalRecord.life;if(g.controlHandle&&!g.controlRetired){g.controlRetired=true;try{if(this.#deps.retireControl()!==g.controlHandle)g.unknown=true;}catch{g.unknown=true;}}if(this.#fence&&g.fenceHandle&&!g.fenceRetired){g.fenceRetired=true;try{if(this.#fence.retireFence()!==g.fenceHandle)g.unknown=true;}catch{g.unknown=true;}}}
 retireManager(...extra){
  if(extra.length)return null;const g=this.#globalRecord.life;if(g.retired)return g.handle;
  return this.#frame(this.#globalRecord,()=>{g.retired=true;this.#retired=true;this.#closed=true;this.#generation++;g.release.retired=true;g.release.ids=new Set(this.#records.keys());const handles=[...this.#lifetimes].map(c=>c.handle);for(const handle of handles){g.pendingSessions.add(handle.sessionId);this.#watchGlobal(handle.actualSettled,value=>{const r=data(value,['scope','sessionId','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='MANAGER_SESSION'&&r.sessionId===handle.sessionId&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;},()=>{g.pendingSessions.delete(handle.sessionId);});}
   this.#bridge.target=null;this.#bridge.listener=null;this.#ledger.closeInput('manager-retired');this.#output.suspendViews();for(const r of this.#records.values()){this.#unpublish(r);if(r.transition)r.transition.active=false;}
   // Stop is independent of held global CLOSE/control work, never a self-join.
   this.#retireGlobalLower();for(const handle of handles)this.retireManagerSession(handle);return g.handle;
  });
 }
 #finishGlobal(){
  const g=this.#globalRecord.life;finishReservationAccounting(g.release);if(g.done||!g.retired||g.bootstrap||g.frames||g.workers.size||g.callbackSlots||g.listBusy||g.slots.size||g.unknown||g.pendingSessions.size||!g.fenceDone||!g.controlDone)return;
  // Completed handles and dormant release observers retain accounting only.
  for(const r of this.#records.values()){const c=r.releaseCarrier;if(c){c.accounting={records:this.#records,release:g.release,allocationEntered:r.backendAllocationEntered};c.record=null;c.target=null;}r.backendHandle=null;r.stopTask=null;r.stopResult=null;}
  this.#bridge.target=null;this.#bridge.listener=null;g.controlHandle=null;g.fenceHandle=null;this.#deps=null;g.done=true;const resolve=g.resolve;g.resolve=null;resolve(Object.freeze({scope:'MANAGER_GLOBAL',actualSettled:true,nativeExecutionAdmitted:false}));
 }
 #sync(callback){
  const g=this.#globalRecord.life;if(g.callbackSlots>=64)refuse('CAPACITY_EXCEEDED');g.callbackSlots++;let transferred=false;
  try{return this.#frame(this.#globalRecord,()=>{const value=callback();if(value&&typeof value==='object'&&!types.isProxy(value)&&types.isPromise(value)){transferred=true;void this.#work(this.#globalRecord,()=>value,{consume:()=>{},swallow:true,onSettled:()=>{g.callbackSlots--;}});refuse('SENDER_REFUSED');}if(!settledValue(value)){g.unknown=true;refuse('REQUEST_REFUSED');}return value;});}finally{if(!transferred)g.callbackSlots--;this.#finishGlobal();}
 }
 #lane(kind,callback,onTimeout=()=>{},code='HOST_UNAVAILABLE'){
  const g=this.#globalRecord.life,existing=g.slots.get(kind);if(existing)return existing.reply;const slot={kind,epoch:this.#generation,requests:0,publicDrained:false,unknown:false},state=requestLifetime(kind,++this.#requestSequence);let resolve;const actual=new NativePromise(yes=>resolve=yes);
  slot.requestState=state;slot.handle=state.handle;
  slot.reply=this.#public(actual,onTimeout,code,undefined,null,this.#globalRecord,null,()=>{slot.publicDrained=true;this.#releaseLane(slot);});g.slots.set(kind,slot);
  this.#requestHandles.set(slot.reply,slot.handle);
  void this.#work(this.#globalRecord,()=>callback(slot),{consume:value=>{resolve(forwardedValue(value));resolve=null;},swallow:true,onRejected:()=>{resolve(fail(code));resolve=null;}});return slot.reply;
 }
 #releaseLane(slot){if(slot.publicDrained&&!slot.requests&&!slot.unknown&&this.#globalRecord.life.slots.get(slot.kind)===slot){this.#globalRecord.life.slots.delete(slot.kind);const c=slot.requestState;c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'MANAGER_CONTROL_REQUEST',kind:c.kind,requestId:c.requestId,actualSettled:true,nativeExecutionAdmitted:false}));}}
 #fenceRequest(slot,promise){
  const handle=this.#fence.captureRequestSettlement(promise);if(!handle)return nativePromise(promise);const h=data(handle,['generation','open','actualSettled','snapshot']),g=this.#globalRecord.life;if(!h||!Object.isFrozen(handle)||!positive(h.generation)||typeof h.open!=='boolean'||!callable(h.snapshot)){g.unknown=true;slot.unknown=true;return nativePromise(promise);}
  slot.requests++;void this.#work(this.#globalRecord,()=>nativePromise(h.actualSettled),{consume:value=>{const r=data(value,['scope','generation','open','actualSettled','nativeExecutionAdmitted']);if(!r||!Object.isFrozen(value)||r.scope!=='INPUT_FENCE_REQUEST'||r.generation!==h.generation||r.open!==h.open||r.actualSettled!==true||r.nativeExecutionAdmitted!==false){g.unknown=true;slot.unknown=true;}},swallow:true,onRejected:()=>{g.unknown=true;slot.unknown=true;},onSettled:()=>{slot.requests--;this.#releaseLane(slot);}});return nativePromise(promise);
 }
 get nativeExecutionAdmitted(){return false;}
 captureManagerSessionSettlement(value,...extra){const p=!extra.length&&data(value,['sessionId']);return p&&id(p.sessionId)?this.#records.get(p.sessionId)?.life.handle??null:null;}
 captureManagerSessionSettlementRoster(...extra){return extra.length?null:Object.freeze([...this.#lifetimes].map(c=>c.handle));}
 retireManagerSession(handle,...extra){const c=!extra.length&&handle&&typeof handle==='object'?this.#sessionHandles.get(handle):null;if(!c)return null;if(!c.retired&&c.target)this.#frame(c.target,()=>this.#abort(c.target,98));return c.handle;}
 #frame(r,callback){r.life.frames++;try{return callback();}finally{r.life.frames--;this.#reclaim(r);}}
 #work(r,callback,{consume=null,swallow=false,onSettled=null,onRejected=null}={}){
  const c={original:null,secondary:null,outcome:null,unknown:false};r.life.workers.add(c);let resolve,reject;const task=new NativePromise((yes,no)=>{resolve=yes;reject=no;});
  const unknown=()=>{c.unknown=true;r.life.unknown=true;};
  const complete=()=>this.#frame(r,()=>{if(c.unknown)return;const outcome=c.outcome;if(!outcome){unknown();return;}try{
   if(onSettled)onSettled(outcome);if(outcome.ok){try{resolve(forwardedValue(outcome.value));}catch(error){reject(error);}}else reject(outcome.value);
   c.original=null;c.secondary=null;c.outcome=null;resolve=null;reject=null;consume=null;onSettled=null;onRejected=null;callback=null;r.life.workers.delete(c);
  }catch{unknown();}});
  this.#frame(r,()=>{try{c.original=nativePromise(callback());c.secondary=nativePromise(Reflect.apply(promiseThen,c.original,[value=>{try{if(consume)consume(value);c.outcome={ok:true,value:consume?undefined:value};}catch(error){c.outcome={ok:swallow,value:swallow?undefined:error};if(swallow)r.life.unknown=true;}c.original=null;},error=>{onRejected?.();c.outcome={ok:swallow,value:swallow?undefined:error};c.original=null;}]));Reflect.apply(promiseThen,c.secondary,[complete,complete]);}catch{unknown();}});return task;
 }
 #releaseCaller(entry){if(!entry?.callerHeld)return;entry.callerHeld=false;const r=entry.record;if(entry.kind==='input')r.inputCallers--;else r.callSlots.delete(entry.kind);}
 #ready(){if(this.#retired||this.#lost)return false;try{return this.#sync(()=>this.#deps.ready())===true;}catch{return false;}}
 #local(scope){if(this.#closed)refuse('PIN_REQUIRED');if(this.#lost||this.#retired)refuse('HOST_UNAVAILABLE');if(scope.revoked||scope.generation!==this.#generation)refuse('SENDER_REFUSED');}
 #info(record){return Object.freeze({sessionId:record.sessionId,projectId:record.projectId,profileId:record.profileId,cwdDisplay:record.cwdDisplay,state:record.state,exitCode:null,droppedUtf8Bytes:record.dropped??0,attachedWindowId:record.published?.lease.windowId??null});}
 #check(scope,record=null,control=false){
  try{
   this.#local(scope);if(!this.#ready()||this.#sync(()=>this.#deps.current(scope.grant))!==true||this.#sync(()=>scope.guard())!==true)refuse('SENDER_REFUSED');this.#local(scope);
   if(record&&(record.projectId!==scope.context.projectId||record.cancelled&&scope.operation==='terminalCreate'))refuse('SESSION_REFUSED');
   const leased=!control&&['terminalInput','terminalResize','terminalAck','terminalDetach'].includes(scope.operation);
   const attachment=leased?record?.published:null;
   const exact=()=>attachment&&record.published===attachment&&scope.payload.leaseId===attachment.lease.leaseId&&scope.payload.generation===attachment.lease.generation&&this.isCurrentLease(attachment.lease,scope.grant,this.#info(record));
   if(leased){if(!exact())refuse('LEASE_STALE');this.#local(attachment.scope);if(this.#sync(()=>attachment.scope.guard())!==true)refuse('LEASE_STALE');if(!exact())refuse('LEASE_STALE');}
   const allowed=data(this.#sync(()=>this.#deps.authorize({grant:scope.grant,method:control?'terminalAttach':scope.operation,session:record?this.#info(record):null,epoch:scope.payload.epoch,...(leased?{lease:attachment.lease}:{})}))); 
   if(allowed?.ok!==true)refuse(typeof allowed?.code==='string'?allowed.code:'SENDER_REFUSED');
   if(scope.payload.epoch!==scope.context.epoch)refuse('EPOCH_STALE');
   if(!this.#ready()||this.#sync(()=>this.#deps.current(scope.grant))!==true||this.#sync(()=>scope.guard())!==true)refuse('SENDER_REFUSED');if(leased){this.#local(attachment.scope);if(this.#sync(()=>attachment.scope.guard())!==true)refuse('LEASE_STALE');}this.#local(scope);
   // No external callbacks after this final publication/identity observation.
   if(leased&&!exact())refuse('LEASE_STALE');
  }catch(error){scope.revoked=true;throw error;}
 }
 #begin(grant,operation,payload,check=true){
  if(types.isProxy(payload))refuse('REQUEST_REFUSED');const validated=validateTerminalRequest(operation,payload),c=context(grant);if(!validated.ok)refuse('REQUEST_REFUSED');if(!c)refuse('SENDER_REFUSED');
  if(this.#retired||this.#lost)refuse('HOST_UNAVAILABLE');if(this.#closed)refuse('PIN_REQUIRED');const captured=this.#sync(()=>this.#deps.capture(grant)),guard=data(captured,['isCurrent']);if(!guard||!callable(guard.isCurrent))refuse('SENDER_REFUSED');
  const scope={grant,context:c,operation,payload:validated.payload,generation:this.#generation,guard:guard.isCurrent,revoked:false};
  if(check)this.#check(scope,validated.payload.sessionId?this.#records.get(validated.payload.sessionId):null);return scope;
 }
 #reserveEntry(grant,operation,payload,kind){
  // Pure preflight precedes all registry/policy/readiness callbacks. Separate
  // operation slots preserve Stop and Detach safety cancellation during entry;
  // any synchronous cross-operation cycle has at most these five frames.
  if(types.isProxy(payload))refuse('REQUEST_REFUSED');const v=validateTerminalRequest(operation,payload);if(!v.ok)refuse('REQUEST_REFUSED');if(!context(grant))refuse('SENDER_REFUSED');
  const record=this.#records.get(v.payload.sessionId);if(!record)refuse('SESSION_REFUSED');const asyncCaller=['attach','detach','resize','input','stop'].includes(kind);if(record.admissionFrames.has(kind)||asyncCaller&&(kind==='input'?record.inputCallers>=limits.inputReceipts:record.callSlots.has(kind)))return {refused:true,operationId:v.payload.operationId};
  const cell={record,kind,operationId:v.payload.operationId,callerHeld:asyncCaller,transferred:false};record.admissionFrames.set(kind,cell);record.life.frames++;if(asyncCaller){if(kind==='input')record.inputCallers++;else record.callSlots.set(kind,cell);}return cell;
 }
 #finishEntry(cell){if(!cell||cell.refused)return;const r=cell.record;if(r.admissionFrames.get(cell.kind)===cell)r.admissionFrames.delete(cell.kind);r.life.frames--;if(!cell.transferred)this.#releaseCaller(cell);this.#reclaim(r);}
 #guard(scope,record){return Object.freeze({isCurrent:()=>{try{this.#check(scope,record);return this.#records.get(record.sessionId)===record&&!record.cancelled;}catch{return false;}}});}
 #track(record,callback){
  // Create dependencies have the same actual-work rule as commands: an
  // entered throw/unobservable result cannot refund its retained reservation.
  return this.#effect(record,callback);
 }
 #public(actual,onTimeout,code,operationId,onFinished=null,record=null,entry=null,onDrained=null){
  if(record){
   const cell={original:null,secondary:null,outcome:null};record.life.workers.add(cell);if(entry)entry.transferred=true;let resolve,done=false,timer;const reply=new NativePromise(yes=>resolve=yes);
   const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);resolve=null;const callback=onFinished;onFinished=null;callback?.();};
   const complete=()=>this.#frame(record,()=>{try{clearTimeout(timer);const outcome=cell.outcome;finish(outcome?.ok?forwardedValue(outcome.value):fail(code,operationId));cell.original=null;cell.secondary=null;cell.outcome=null;actual=null;onTimeout=null;onFinished=null;this.#releaseCaller(entry);entry=null;record.life.workers.delete(cell);onDrained?.();onDrained=null;}catch{record.life.unknown=true;}});
   this.#frame(record,()=>{try{timer=setTimeout(()=>this.#frame(record,()=>{if(done)return;try{onTimeout();}catch{}finish(fail(code,operationId));}),this.#deadline);cell.original=nativePromise(actual);cell.secondary=nativePromise(Reflect.apply(promiseThen,cell.original,[value=>{cell.outcome={ok:true,value};cell.original=null;},()=>{cell.outcome={ok:false};cell.original=null;}]));Reflect.apply(promiseThen,cell.secondary,[complete,complete]);}catch{record.life.unknown=true;}});return reply;
  }
  return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);onFinished?.();};
   const timer=setTimeout(()=>{if(done)return;try{onTimeout();}catch{}finish(fail(code,operationId));},this.#deadline);
   Reflect.apply(promiseThen,actual,[finish,()=>finish(fail(code,operationId))]);
  });
 }
 #captureLedger(record){
  const handle=this.#ledger.captureLedgerSettlement({sessionId:record.sessionId}),h=data(handle,['sessionId','actualSettled','snapshot']);
  if(!h||!Object.isFrozen(handle)||h.sessionId!==record.sessionId||!callable(h.snapshot))refuse('HOST_UNAVAILABLE');record.ledgerHandle=handle;
  void this.#work(record,()=>nativePromise(h.actualSettled),{consume:value=>{const r=data(value,['scope','sessionId','actualSettled','nativeExecutionAdmitted']);if(!r||!Object.isFrozen(value)||r.scope!=='LEDGER_SESSION_INPUT'||r.sessionId!==record.sessionId||r.actualSettled!==true||r.nativeExecutionAdmitted!==false){record.life.unknown=true;return;}record.ledgerActualDone=true;record.ledgerHandle=null;},swallow:true,onRejected:()=>{record.life.unknown=true;}});
 }
 #captureOutput(record){
  const handle=this.#output.captureOutputSettlement({sessionId:record.sessionId,ownerId:record.ownerId}),h=data(handle,['sessionId','ownerId','actualSettled','snapshot']);
  if(!h||!Object.isFrozen(handle)||h.sessionId!==record.sessionId||h.ownerId!==record.ownerId||!callable(h.snapshot))refuse('HOST_UNAVAILABLE');record.outputHandle=handle;
  void this.#work(record,()=>nativePromise(h.actualSettled),{consume:value=>{const r=data(value,['scope','sessionId','ownerId','actualSettled','nativeExecutionAdmitted']);if(!r||!Object.isFrozen(value)||r.scope!=='OUTPUT_SOURCE'||r.sessionId!==record.sessionId||r.ownerId!==record.ownerId||r.actualSettled!==true||r.nativeExecutionAdmitted!==false){record.life.unknown=true;return;}record.outputActualDone=true;record.outputHandle=null;},swallow:true,onRejected:()=>{record.life.unknown=true;}});
 }
 #captureBackend(record){
  // Capture before allocation/admission callbacks can retire or replace the
  // prepared owner. Status rows and public Stop replies grant neither fact.
  if(!this.#deps.captureBackendSettlement)refuse('HOST_UNAVAILABLE');
  const handle=this.#deps.captureBackendSettlement({ownerId:record.ownerId}),h=data(handle,['sessionId','channelId','actualSettled','verifiedRelease','snapshot']);
  if(!h||!Object.isFrozen(handle)||h.sessionId!==record.sessionId||h.channelId!==record.channelId||!callable(h.snapshot))refuse('HOST_UNAVAILABLE');
  const actual=nativePromise(h.actualSettled),release=nativePromise(h.verifiedRelease);record.backendHandle=handle;
  const finish=()=>{if(record.backendActualDone&&record.backendReleaseProof)record.backendHandle=null;this.#reclaim(record);};
  void this.#work(record,()=>actual,{consume:value=>{const r=data(value,['scope','sessionId','channelId','ownerId','actualSettled','sessionObserved','nativeExecutionAdmitted']);if(!r||!Object.isFrozen(value)||r.scope!=='BACKEND_SESSION'||r.sessionId!==record.sessionId||r.channelId!==record.channelId||r.ownerId!==record.ownerId||r.actualSettled!==true||r.sessionObserved!==true||r.nativeExecutionAdmitted!==false){record.life.unknown=true;return;}record.backendActualDone=true;finish();},swallow:true,onRejected:()=>{record.life.unknown=true;}});
  const carrier={ownerId:record.ownerId,sessionId:record.sessionId,record,target:finish,accounting:null};record.releaseCarrier=carrier;observeManagerRelease(carrier,release);
 }
 #retireOutput(record){
  if(!record.outputRegistered||record.outputRetired)return;record.outputRetired=true;
  // Fence before a held read can finish; the captured actual receipt, rather
  // than a public retirement result or absent status row, owns completion.
  try{this.#output.retire(record.sessionId);}catch{/* Missing actual authority retains capacity. */}
 }
 #actualReady(record){return record.cancelled&&!record.pending&&!record.effectFrames&&!record.activeCreate&&!record.unknownOwner&&!record.transactions&&!record.command&&!record.inputs.size&&!record.deliveryWorker&&!record.admissionFrames.size&&!record.life.unknown&&(!record.outputRegistered||record.outputActualDone)&&(!record.ledger||record.ledgerActualDone)&&(!record.ownerId||record.backendActualDone);}
 #cleanupReady(record){return this.#actualReady(record)&&(!record.ownerId||record.backendReleaseProof&&(!record.backendAllocationEntered||record.backendReleaseProof.identityKnown));}
 #reclaim(record){
  if(record===this.#globalRecord){this.#finishGlobal();return false;}
  if(this.#records.get(record.sessionId)!==record||!record.cancelled)return false;const c=record.life;
  if(!c.done&&c.retired&&!c.frames&&!c.workers.size&&this.#actualReady(record)){c.done=true;c.target=null;const resolve=c.resolve;c.resolve=null;this.#lifetimes.delete(c);resolve(Object.freeze({scope:'MANAGER_SESSION',sessionId:record.sessionId,actualSettled:true,nativeExecutionAdmitted:false}));}
  // Pending release is a separate bounded accounting carrier; it cannot
  // resurrect session capabilities or substitute for actual manager work.
  if(!c.done||!this.#cleanupReady(record))return false;record.outputRegistered=false;record.ledger=false;record.backendHandle=null;record.stopTask=null;record.stopResult=null;this.#records.delete(record.sessionId);this.#globalRecord.life.release.ids.delete(record.sessionId);finishReservationAccounting(this.#globalRecord.life.release);return true;
 }
 #abort(record,code=98){
  this.#unpublish(record);if(record.transition)record.transition.active=false;record.cancelled=true;record.life.retired=true;record.state='stopping';if(record.ledger&&!record.ledgerRetired){record.ledgerRetired=true;this.#ledger.fenceSession(record.sessionId);this.#ledger.retire(record.sessionId);}this.#retireOutput(record);
  if(record.stopCode===null)record.stopCode=code;
  if(record.ownerId)void this.#stopOwned(record);else this.#reclaim(record);
 }
 #stopOwned(record){
  if(record.stopStarted)return record.stopTask??Promise.resolve(record.stopResult??fail('CLEANUP_FAILED'));if(!record.ownerId)return Promise.resolve(fail('CLEANUP_FAILED'));
  // Reserve before the effectful backend callback. Backend alone owns native
  // Stop-once; explicit later reconciliation may consume its retained proof.
  record.stopStarted=true;let resolve;const task=new NativePromise(yes=>resolve=yes);record.stopTask=task;
  void this.#work(record,()=>this.#track(record,()=>this.#deps.stopSession({ownerId:record.ownerId,deadlineMs:this.#deadline,code:record.stopCode??98})),{consume:value=>{record.stopResult=data(value)?.ok===true?Object.freeze({ok:true}):fail('CLEANUP_FAILED');},swallow:true,onSettled:()=>{record.stopResult??=fail('CLEANUP_FAILED');record.stopTask=null;resolve(record.stopResult);resolve=null;}});return task;
 }
 create(grant,payload){
  let scope,record,validated,started=false;
  try{
   if(types.isProxy(payload))refuse('REQUEST_REFUSED');validated=validateTerminalRequest('terminalCreate',payload);const c=context(grant);if(!validated.ok)refuse('REQUEST_REFUSED');if(!c)refuse('SENDER_REFUSED');
   if(this.#closed)refuse('PIN_REQUIRED');if(this.#lost||this.#retired)refuse('HOST_UNAVAILABLE');if(this.#records.size>=limits.sessions)refuse('CAPACITY_EXCEEDED');
   // Provisional lifetimes are capturable before the first admission callback.
   record={sessionId:randomUUID(),projectId:c.projectId,profileId:validated.payload.profileId,cwdDisplay:'',state:'starting',ownerId:null,channelId:null,backendHandle:null,backendActualDone:false,backendReleaseProof:null,backendAllocationEntered:false,pending:0,effectFrames:0,activeCreate:true,cancelled:false,unknownOwner:false,stopTask:null,stopStarted:false,stopResult:null,stopCode:null,ledger:false,ledgerRetired:false,ledgerActualDone:false,ledgerHandle:null,outputRegistered:false,outputRetired:false,outputActualDone:false,outputHandle:null,published:null,remoteLease:null,uncertain:null,transition:null,transactions:0,command:null,tasks:new Set(),quarantined:0,inputs:new Map(),uncertainInput:false,deliveryWorker:null,admissionFrames:new Map(),callSlots:new Map(),inputCallers:0,dropped:0};record.life=managerLifetime(record.sessionId);record.life.target=record;record.life.frames++;this.#records.set(record.sessionId,record);this.#lifetimes.add(record.life);this.#sessionHandles.set(record.life.handle,record.life);
   scope=this.#begin(grant,'terminalCreate',payload);this.#check(scope,record);started=true;const actual=this.#work(record,()=>this.#create(scope,record));
   return this.#public(actual,()=>this.#abort(record,98),'HOST_UNAVAILABLE',scope.payload.operationId,null,record);
  }catch(error){if(record)this.#abort(record,98);return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??validated?.payload?.operationId));}
  finally{if(record){if(!started)record.activeCreate=false;record.life.frames--;this.#reclaim(record);}}
 }
 async #create(scope,record){
  try{
   const cwd=await nativePromise(this.#track(record,()=>this.#deps.cwd(scope.grant,scope.payload.cwdId)));this.#check(scope,record);
   const catalogue=this.#sync(()=>this.#deps.profiles(scope.grant)),resolve=method(catalogue,'resolveShellProfile');this.#check(scope,record);
   const shell=await nativePromise(this.#track(record,()=>resolve(scope.payload.profileId)));this.#check(scope,record);
   const guard=this.#guard(scope,record),config={sessionId:record.sessionId,projectId:record.projectId,admissionEpoch:scope.context.epoch,profileId:record.profileId,cwd,shell,cols:scope.payload.cols,rows:scope.payload.rows};
   // Validate the resolved DATA before entering the effectful prepare boundary.
   // Backend repeats its own validation/policy; this preflight grants no owner.
   if(!validateStartupEnvelope({version:1,...config,channelId:randomUUID(),startupId:randomUUID()}))refuse('REQUEST_REFUSED');this.#check(scope,record);
   // prepare/allocate are synchronous. Retain exact owner before allocate or any
   // asynchronous connect. A failed prepare can hide a retained backend owner:
   // absence/aggregate counts cannot refund that uncertain manager reservation.
   record.unknownOwner=true;const prepared=data(this.#deps.prepare(config,guard),['ok','ownerId','sessionId','channelId']);
   if(!prepared||prepared.ok!==true||!id(prepared.ownerId)||prepared.sessionId!==record.sessionId||!id(prepared.channelId))refuse('HOST_UNAVAILABLE');
   record.ownerId=prepared.ownerId;record.channelId=prepared.channelId;record.unknownOwner=false;this.#captureBackend(record);this.#check(scope,record);record.cwdDisplay=cwd;
   record.backendAllocationEntered=true;if(data(this.#deps.allocate({ownerId:record.ownerId}))?.ok!==true)refuse('HOST_UNAVAILABLE');this.#check(scope,record);
   const connected=data(await nativePromise(this.#track(record,()=>this.#deps.connect({ownerId:record.ownerId},guard))),['ok','ownerId','sessionId','channelId']);this.#check(scope,record);
   if(!connected||connected.ok!==true||connected.ownerId!==record.ownerId||connected.sessionId!==record.sessionId||connected.channelId!==prepared.channelId)refuse('HOST_UNAVAILABLE');
   if(this.#ledger.register({sessionId:record.sessionId,projectId:record.projectId,profileId:record.profileId,cwdDisplay:record.cwdDisplay}).ok!==true)refuse('CAPACITY_EXCEEDED');record.ledger=true;this.#captureLedger(record);
   this.#check(scope,record);if(this.#deps.readHistory){const registered=this.#output.register({sessionId:record.sessionId,ownerId:record.ownerId,readHistory:q=>this.#effect(record,()=>this.#deps.readHistory(q))});if(!registered.ok)refuse(registered.code);record.outputRegistered=true;this.#captureOutput(record);}record.state='running';return pass(this.#info(record),scope.payload.operationId);
  }catch(error){if(record.unknownOwner)record.life.unknown=true;this.#abort(record,98);return fail(errorCode(error),scope.payload.operationId);}
  finally{record.activeCreate=false;this.#reclaim(record);}
 }
 list(grant,payload){const g=this.#globalRecord.life;if(g.listBusy)return fail('CAPACITY_EXCEEDED');if(this.#retired||this.#lost)return fail();g.listBusy=true;try{return this.#frame(this.#globalRecord,()=>{let scope;try{scope=this.#begin(grant,'terminalList',payload);const rows=[...this.#records.values()].filter(r=>r.projectId===scope.context.projectId).map(r=>this.#info(r));this.#check(scope);return pass(Object.freeze(rows),scope.payload.operationId);}catch(error){return fail(errorCode(error),scope?.payload.operationId);}});}finally{g.listBusy=false;this.#finishGlobal();}}
 stop(grant,payload){
  let scope,record,entry;try{entry=this.#reserveEntry(grant,'terminalStop',payload,'stop');if(entry?.refused)return Promise.resolve(fail('CAPACITY_EXCEEDED',entry.operationId));scope=this.#begin(grant,'terminalStop',payload);record=this.#records.get(scope.payload.sessionId);if(!record)refuse('SESSION_REFUSED');this.#abort(record,77);
   const actual=this.#work(record,async()=>{try{await nativePromise(this.#stopOwned(record));this.#check(scope,record);return this.#cleanupReady(record)?pass({...this.#info(record),state:'exited'},scope.payload.operationId):fail('CLEANUP_FAILED',scope.payload.operationId);}catch{if(!promiseEnvironmentIntact())record.life.unknown=true;return fail('CLEANUP_FAILED',scope.payload.operationId);}});
   return this.#public(actual,()=>{},'CLEANUP_FAILED',scope.payload.operationId,null,record,entry);
  }catch(error){return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??entry?.operationId));}finally{this.#finishEntry(entry);}
 }
 // Explicit private main reconciliation only. Passive status never dispatches a
 // Stop, and a missing owner/status never proves cleanup or grants capacity.
 reconcile(){
  const g=this.#globalRecord.life;if(g.slots.has('reconcile'))return g.slots.get('reconcile').reply;if(this.#retired)return this.#cachedReconcile??=new NativePromise(resolve=>resolve(Object.freeze({ok:true,retainedReservations:this.#records.size})));
  return this.#lane('reconcile',async()=>{try{for(const record of [...this.#records.values()])if(record.cancelled){if(record.ownerId&&!this.#reclaim(record))await nativePromise(this.#stopOwned(record));this.#reclaim(record);}return Object.freeze({ok:true,retainedReservations:this.#records.size});}catch{return fail('CLEANUP_FAILED');}});
 }
 #localClose(reason){this.#ledger.closeInput(reason);this.#output.suspendViews();for(const record of this.#records.values()){this.#unpublish(record);if(record.transition)record.transition.active=false;if(record.activeCreate)this.#abort(record,98);}}
 closeInput(reason){
  if(this.#retired)return this.#cachedClosed??=new NativePromise(resolve=>resolve(fail()));this.#closed=true;this.#generation++;
  return this.#frame(this.#globalRecord,()=>{const existing=this.#globalRecord.life.slots.get('close');if(existing){existing.epoch=this.#generation;this.#localClose(reason);return existing.reply;}return this.#lane('close',async slot=>{try{this.#localClose(reason);const reply=await this.#fenceRequest(slot,this.#fence.closeInput(reason)),r=data(reply),snapshot=this.#fence.snapshot();if(!this.#retired&&slot.epoch===this.#generation&&this.#closed&&r?.ok===true&&r.hostAcknowledged===true&&snapshot.closed&&snapshot.hostAcknowledged&&snapshot.generation===r.generation)for(const record of this.#records.values()){if(record.uncertain&&r.generation>record.uncertain.gateGeneration)record.uncertain=null;if(record.remoteLease&&r.generation>record.remoteGateGeneration)record.remoteLease=null;}return this.#retired?fail():forwardedValue(reply);}catch{return fail();}});});
 }
 resumeInput(){
  if(this.#retired||this.#lost)return this.#cachedClosed??=new NativePromise(resolve=>resolve(fail()));
  return this.#lane('open',async slot=>{try{if(!this.#ready())return fail();const generation=this.#generation,reply=await this.#fenceRequest(slot,this.#fence.resumeInput()),r=data(reply);if(generation!==this.#generation||this.#retired||this.#lost||!this.#ready()||r?.ok!==true||r.hostAcknowledged!==true||r.localInputFenced!==false){if(generation===this.#generation&&!this.#retired&&!this.#lost)void this.closeInput('open admission changed');return fail();}this.#closed=false;this.#output.resumeViews();return forwardedValue(reply);}catch{if(!this.#retired&&!this.#lost)void this.closeInput('open observation refused');return fail();}},()=>{if(!this.#retired&&!this.#lost)void this.closeInput('open public deadline');});
 }
 #hostFailed(){if(this.#lost||this.#globalRecord.life.done)return;this.#lost=true;this.#closed=true;this.#generation++;this.#ledger.hostFailed();this.retireManager();}
 // Pure retained identity/state observation for private policy composition.
 // Outer #check authenticates genuine grant, readiness and stored guards; this
 // method invokes no policy, registry, provider or other admission callback.
 isCurrentLease(lease,grant,session){
  try{const s=data(session),r=this.#records.get(s?.sessionId),a=r?.published;if(!a||a.lease!==lease||a.grant!==grant||r.cancelled||r.transition||this.#closed||this.#lost||this.#retired||a.scope.generation!==this.#generation||a.scope.revoked)return false;
   return lease.projectId===r.projectId&&lease.sessionId===r.sessionId&&lease.windowId===a.scope.context.windowId&&lease.epoch===a.scope.context.epoch;
  }catch{return false;}
 }
 #effect(record,callback){
  // Reserve before callback entry. A public deadline never completes actual
  // work; entered throws/unobservable originals or observers stay charged.
  record.pending++;let resolve,reject;const task=new NativePromise((yes,no)=>{resolve=yes;reject=no;}),cell={original:null,secondary:null,outcome:null,unknown:false};record.tasks.add(task);
  const quarantine=()=>{if(!cell.unknown){cell.unknown=true;record.quarantined++;record.life.unknown=true;}};
  const complete=()=>{if(cell.unknown)return;record.effectFrames++;try{
   const outcome=cell.outcome;if(!outcome){quarantine();return;}
   if(outcome.ok){if(settledValue(outcome.value))resolve(outcome.value);else reject(Object.assign(new Error('REQUEST_REFUSED'),{code:'REQUEST_REFUSED'}));}else reject(outcome.value);
   cell.original=null;cell.secondary=null;cell.outcome=null;resolve=null;reject=null;record.pending--;record.tasks.delete(task);
  }catch{quarantine();}finally{record.effectFrames--;this.#reclaim(record);}};
  try{cell.original=nativePromise(callback());cell.secondary=Reflect.apply(promiseThen,cell.original,[v=>{cell.outcome={ok:true,value:v};cell.original=null;},e=>{cell.outcome={ok:false,value:e};cell.original=null;}]);nativePromise(cell.secondary);Reflect.apply(promiseThen,cell.secondary,[complete,complete]);}catch{quarantine();}
  return task;
 }
 #unpublish(r){
  const a=r.published;if(!a)return;r.published=null;
  for(const f of a.frames.values())this.#handoffs.delete(f.ticket);a.frames.clear();a.active=false;
  if(a.candidate)this.#output.detach(a.candidate);if(r.ledger)this.#ledger.detach(a.scope.context,r.sessionId,a.lease);
 }
 #transaction(scope,r,t){this.#check(scope,r,true);if(this.#records.get(r.sessionId)!==r||r.cancelled||r.state!=='running'||!t.active||r.transition!==t)refuse('LEASE_STALE');}
 async #drain(r){
  try{while(r.command||r.inputs.size||r.tasks.size||r.outputRegistered&&this.#output.status(r.sessionId)?.settled!==true){
   const pending=[...(r.command?[r.command.done]:[]),...[...r.inputs.values()].map(e=>e.done),...r.tasks];
   // Only internal retained tasks enter this barrier. Capture native handlers
   // after descriptor validation; Promise.allSettled would read mutable then
   // and constructor/species paths even for these manager-owned Promises.
   if(pending.length){const tasks=pending.map(nativePromise);await nativePromise(new NativePromise(resolve=>{let remaining=tasks.length;const done=()=>{if(--remaining===0)resolve();};for(const task of tasks)Reflect.apply(promiseThen,task,[done,done]);}));}else await nativePromise(new NativePromise(resolve=>setImmediate(resolve)));
  }}catch(error){if(!promiseEnvironmentIntact()){r.life.unknown=true;return;}throw error;}
 }
 #command(r,callback){
  if(r.command)refuse('CAPACITY_EXCEEDED');let finish;const slot={done:new NativePromise(resolve=>finish=resolve)};r.command=slot;
  let actual;try{actual=this.#effect(r,callback);}catch{actual=new NativePromise(()=>{});}
  return this.#work(r,()=>Reflect.apply(promiseThen,nativePromise(actual),[v=>{if(r.command===slot)r.command=null;finish();this.#reclaim(r);return forwardedValue(v);},e=>{if(r.command===slot)r.command=null;finish();this.#reclaim(r);throw e;}]));
 }
 #attempt(r){const attempt={gateGeneration:this.#fence.snapshot().generation};r.uncertain=attempt;return attempt;}
 async #revoke(scope,r,t){
  try{if(!r.remoteLease)return;this.#transaction(scope,r,t);const old=r.remoteLease,attempt=this.#attempt(r);
  const reply=data(await nativePromise(this.#command(r,()=>this.#deps.revoke({ownerId:r.ownerId,leaseId:old.leaseId,generation:old.generation},{isCurrent:()=>{try{this.#transaction(scope,r,t);return r.remoteLease===old;}catch{return false;}}}))),['ok','revoked']);
  this.#transaction(scope,r,t);if(!reply||reply.ok!==true||reply.revoked!==true)refuse('HOST_UNAVAILABLE');if(r.uncertain===attempt)r.uncertain=null;r.remoteLease=null;}catch(error){if(!promiseEnvironmentIntact()){r.life.unknown=true;return;}throw error;}
 }
 attach(grant,payload){
  let scope,r,t,entry;try{entry=this.#reserveEntry(grant,'terminalAttach',payload,'attach');if(entry?.refused)return Promise.resolve(fail('CAPACITY_EXCEEDED',entry.operationId));scope=this.#begin(grant,'terminalAttach',payload,false);r=this.#records.get(scope.payload.sessionId);if(!r)refuse('SESSION_REFUSED');if(r.transition)refuse('CAPACITY_EXCEEDED');t={active:true,candidate:null};r.transition=t;r.transactions++;
   this.#check(scope,r);if(r.cancelled||r.state!=='running')refuse('SESSION_REFUSED');if(!r.outputRegistered||!['install','revoke','input','resize'].every(k=>this.#deps[k]))refuse('UNAVAILABLE');if(r.uncertain||r.uncertainInput)refuse('HOST_UNAVAILABLE');
   this.#unpublish(r);const actual=this.#work(r,()=>this.#attach(scope,r,t));return this.#public(actual,()=>{t.active=false;if(t.candidate)this.#output.detach(t.candidate);if(r.published?.scope===scope)this.#unpublish(r);},'HOST_UNAVAILABLE',scope.payload.operationId,null,r,entry);
  }catch(error){if(t){t.active=false;if(r.transition===t)r.transition=null;r.transactions--;this.#reclaim(r);}return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??entry?.operationId));}finally{this.#finishEntry(entry);}
 }
 async #attach(scope,r,t){
  try{await nativePromise(this.#drain(r));this.#transaction(scope,r,t);if(r.uncertain||r.uncertainInput)refuse('HOST_UNAVAILABLE');await nativePromise(this.#revoke(scope,r,t));this.#transaction(scope,r,t);
   const minted=this.#ledger.attach(scope.context,r.sessionId);if(!minted.ok)refuse(minted.code);
   const lease=Object.freeze({sessionId:r.sessionId,projectId:r.projectId,windowId:scope.context.windowId,epoch:scope.context.epoch,leaseId:minted.value.leaseId,generation:minted.value.generation});
   const guard={isCurrent:()=>{try{if(r.published?.lease===lease){this.#check(scope,r,true);return this.isCurrentLease(lease,scope.grant,this.#info(r));}this.#transaction(scope,r,t);return true;}catch{return false;}}};
   const prepared=await nativePromise(this.#output.prepare({sessionId:r.sessionId,leaseId:lease.leaseId,generation:lease.generation,fromSequence:0,windowId:lease.windowId,projectId:lease.projectId,epoch:lease.epoch,accessGeneration:scope.generation},guard));
   this.#transaction(scope,r,t);if(!prepared.ok)refuse(prepared.code);t.candidate=prepared.value.candidateTicket;
   const attempt=this.#attempt(r);const reply=data(await nativePromise(this.#command(r,()=>this.#deps.install({ownerId:r.ownerId,windowId:lease.windowId,epoch:lease.epoch,leaseId:lease.leaseId,generation:lease.generation},guard))),['ok','leaseId','generation']);
   this.#transaction(scope,r,t);if(!reply||reply.ok!==true||reply.leaseId!==lease.leaseId||reply.generation!==lease.generation)refuse('HOST_UNAVAILABLE');
   if(r.uncertain===attempt)r.uncertain=null;r.remoteLease=lease;r.remoteGateGeneration=attempt.gateGeneration;r.dropped=Math.max(r.dropped,prepared.value.firstSequence);
   r.published={lease,grant:scope.grant,scope,candidate:t.candidate,initial:true,frames:new Map(),active:true,reading:false};
   return pass({session:this.#info(r),leaseId:lease.leaseId,generation:lease.generation,firstSequence:prepared.value.firstSequence,nextSequence:prepared.value.endSequence},scope.payload.operationId);
  }catch(error){if(t.candidate)this.#output.detach(t.candidate);return fail(errorCode(error),scope.payload.operationId);}
  finally{t.active=false;if(r.transition===t)r.transition=null;r.transactions--;this.#reclaim(r);}
 }
 detach(grant,payload){
  let scope,r,t,entry;try{entry=this.#reserveEntry(grant,'terminalDetach',payload,'detach');if(entry?.refused)return Promise.resolve(fail('CAPACITY_EXCEEDED',entry.operationId));scope=this.#begin(grant,'terminalDetach',payload);r=this.#records.get(scope.payload.sessionId);if(!r||r.transition)refuse('CAPACITY_EXCEEDED');t={active:true};r.transition=t;r.transactions++;this.#unpublish(r);
   const actual=this.#work(r,async()=>{try{await nativePromise(this.#drain(r));this.#transaction(scope,r,t);await nativePromise(this.#revoke(scope,r,t));return pass({detached:true},scope.payload.operationId);}catch(error){return fail(errorCode(error),scope.payload.operationId);}finally{t.active=false;if(r.transition===t)r.transition=null;r.transactions--;this.#reclaim(r);}});
   return this.#public(actual,()=>{t.active=false;},'HOST_UNAVAILABLE',scope.payload.operationId,null,r,entry);
  }catch(error){return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??entry?.operationId));}finally{this.#finishEntry(entry);}
 }
 #finishInput(r,e){if(!e.ledgerDone||e.started&&!e.adapterDone)return;if(r.inputs.get(e.key)===e)r.inputs.delete(e.key);e.resolve();this.#reclaim(r);}
 input(grant,payload){
  let scope,r,entry;try{entry=this.#reserveEntry(grant,'terminalInput',payload,'input');if(entry?.refused)return Promise.resolve(fail('CAPACITY_EXCEEDED',entry.operationId));scope=this.#begin(grant,'terminalInput',payload);r=this.#records.get(scope.payload.sessionId);if(r.transition||r.uncertain||r.uncertainInput)refuse('LEASE_STALE');const key=scope.payload.leaseId+':'+scope.payload.inputSequence;
   let e=r.inputs.get(key);if(e&&e.scope.payload.data!==scope.payload.data)refuse('REQUEST_REFUSED');if(!e){if(r.inputs.size>=limits.inputReceipts)refuse('CAPACITY_EXCEEDED');let resolve;e={key,scope,started:false,adapterDone:false,ledgerDone:false,done:new NativePromise(yes=>resolve=yes),resolve};r.inputs.set(key,e);}
   // Capture the original scope BEFORE ledger.input synchronously pumps. A
   // duplicate reuses that original entry and can never refresh its authority.
   if(!e.promise){e.promise=this.#ledger.input(scope.context,scope.payload);Reflect.apply(promiseThen,nativePromise(e.promise),[()=>{e.ledgerDone=true;this.#finishInput(r,e);},()=>{e.ledgerDone=true;this.#finishInput(r,e);}]);}
   const actual=this.#work(r,()=>Reflect.apply(promiseThen,nativePromise(e.promise),[receipt=>{try{this.#check(scope,r);const result=data(receipt);if(result?.ok!==true)return fail(errorCode(receipt),scope.payload.operationId);const accepted=data(result.value,['inputSequence','accepted']);return accepted?.accepted===true&&accepted.inputSequence===scope.payload.inputSequence?pass({inputSequence:accepted.inputSequence,accepted:true},scope.payload.operationId):fail('HOST_UNAVAILABLE',scope.payload.operationId);}catch(error){return fail(errorCode(error),scope.payload.operationId);}}]));return this.#public(actual,()=>{},'HOST_UNAVAILABLE',scope.payload.operationId,null,r,entry);
  }catch(error){return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??entry?.operationId));}finally{this.#finishEntry(entry);}
 }
 async #writeInput(payload){
  const r=this.#records.get(payload.sessionId),key=payload.leaseId+':'+payload.inputSequence,e=r?.inputs.get(key);if(!e)return Object.freeze({accepted:false,knownRefused:true});e.started=true;
  try{while(r.command)await nativePromise(r.command.done);this.#check(e.scope,r);if(r.transition||r.uncertain||r.cancelled)refuse('LEASE_STALE');
   e.dispatched=true;const outcome=await nativePromise(this.#command(r,()=>this.#deps.input({ownerId:r.ownerId,leaseId:payload.leaseId,generation:payload.generation,inputSequence:payload.inputSequence,data:payload.data},{isCurrent:()=>{try{this.#check(e.scope,r);return !r.transition&&!r.cancelled;}catch{return false;}}})));
   const d=data(outcome),known=d?.accepted===true||d?.accepted===false&&d.knownRefused===true&&Reflect.ownKeys(d).length===2;if(!known){r.uncertainInput=true;this.#unpublish(r);}else if(d.accepted===false&&r.published?.lease.leaseId===payload.leaseId)this.#unpublish(r);return forwardedValue(outcome);
  }catch(error){if(!e.dispatched){if(r.published?.lease.leaseId===payload.leaseId)this.#unpublish(r);return Object.freeze({accepted:false,knownRefused:true});}r.uncertainInput=true;this.#unpublish(r);return Object.freeze({accepted:false});}
  finally{e.adapterDone=true;this.#finishInput(r,e);}
 }
 resize(grant,payload){
  let scope,r,entry;try{entry=this.#reserveEntry(grant,'terminalResize',payload,'resize');if(entry?.refused)return Promise.resolve(fail('CAPACITY_EXCEEDED',entry.operationId));scope=this.#begin(grant,'terminalResize',payload);r=this.#records.get(scope.payload.sessionId);if(r.command||r.inputs.size||r.transition||r.uncertain)refuse('CAPACITY_EXCEEDED');
   r.transactions++;const actual=this.#work(r,async()=>{let known=false;try{const outcome=await nativePromise(this.#command(r,()=>this.#deps.resize({ownerId:r.ownerId,leaseId:scope.payload.leaseId,generation:scope.payload.generation,cols:scope.payload.cols,rows:scope.payload.rows},this.#guard(scope,r))));const kind=knownOutcome(outcome);known=kind!=='unknown';if(!known)r.uncertainInput=true;if(kind!=='accepted'){this.#unpublish(r);return fail('HOST_UNAVAILABLE',scope.payload.operationId);}this.#check(scope,r);return pass({resized:true},scope.payload.operationId);}catch(error){if(!known){r.uncertainInput=true;this.#unpublish(r);}return fail(errorCode(error),scope.payload.operationId);}finally{r.transactions--;this.#reclaim(r);}});
   return this.#public(actual,()=>{},'HOST_UNAVAILABLE',scope.payload.operationId,null,r,entry);
  }catch(error){return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??entry?.operationId));}finally{this.#finishEntry(entry);}
 }
 ack(grant,payload){
  let scope,entry;try{entry=this.#reserveEntry(grant,'terminalAck',payload,'ack');if(entry?.refused)return fail('CAPACITY_EXCEEDED',entry.operationId);scope=this.#begin(grant,'terminalAck',payload);const r=this.#records.get(scope.payload.sessionId),a=r.published,f=a.frames.get(scope.payload.throughSequence);if(!f||!f.committed)refuse('REQUEST_REFUSED');
   // A cumulative release cannot refresh or skip earlier main-only receipts.
   // Revalidate each original handoff scope before releasing its held credits.
   for(const entry of a.frames.values())if(entry.end<=f.end){if(!entry.committed)refuse('REQUEST_REFUSED');this.#check(entry.scope,r);}
   const reply=this.#output.ack(f.readTicket,{throughSequence:f.end});if(!reply.ok)return fail(reply.code,scope.payload.operationId);for(const [end,entry] of a.frames)if(end<=f.end){this.#handoffs.delete(entry.ticket);a.frames.delete(end);}return pass({acknowledged:true},scope.payload.operationId);
  }catch(error){return fail(errorCode(error),scope?.payload.operationId??entry?.operationId);}finally{this.#finishEntry(entry);}
 }
 #finishDelivery(r,cell){
  if(cell.entryFrame||!cell.outerDone||!cell.publicDone||!cell.observerDone||cell.unknown)return;
  if(r.deliveryWorker===cell){r.deliveryWorker=null;this.#reclaim(r);}
 }
 #watchDelivery(r,cell,work,field,complete=null){
  // Observe the returned original and our complete handlers without forwarding
  // an arbitrary observer fulfillment value through Promise assimilation.
  try{let value;const raw=nativePromise(work),handled=nativePromise(Reflect.apply(promiseThen,raw,[v=>{if(complete)value=v;},()=>{if(complete)value=fail();}])),secondary=nativePromise(Reflect.apply(promiseThen,handled,[()=>{},()=>{}]));
   Reflect.apply(promiseThen,secondary,[()=>{cell[field]=true;this.#finishDelivery(r,cell);complete?.(value);},()=>{cell.unknown=true;}]);
  }catch{cell.unknown=true;}
 }
 deliverAvailable(grant,payload,observer){
  let scope,r,a,cell,actual,validated;try{
   if(types.isProxy(payload))refuse('REQUEST_REFUSED');validated=validateTerminalRequest('terminalDetach',payload);if(!validated.ok||!callable(observer))refuse('REQUEST_REFUSED');if(!context(grant))refuse('SENDER_REFUSED');
   if(this.#closed)refuse('PIN_REQUIRED');if(this.#lost||this.#retired)refuse('HOST_UNAVAILABLE');r=this.#records.get(validated.payload.sessionId);if(!r)refuse('SESSION_REFUSED');if(r.deliveryWorker)refuse('CAPACITY_EXCEEDED');
   // Bound and retain the outer caller before registry/policy can reenter.
   cell={entryFrame:true,outerDone:false,publicDone:false,observerDone:true,unknown:false};r.deliveryWorker=cell;
   scope=this.#begin(grant,'terminalDetach',payload,false);scope.operation='terminalAck';this.#check(scope,r);a=r.published;if(a.reading)refuse('CAPACITY_EXCEEDED');a.reading=true;
   actual=(async()=>{try{this.#check(scope,r);const frame=a.initial?this.#output.handoffInitial(a.candidate):await nativePromise(this.#output.read(a.candidate));a.initial=false;if(!frame.ok)return fail(frame.code,scope.payload.operationId);this.#check(scope,r);if(r.published!==a)refuse('LEASE_STALE');
    const v=frame.value,transfer=Object.freeze({epoch:a.lease.epoch,sessionId:r.sessionId,leaseId:a.lease.leaseId,generation:a.lease.generation,firstSequence:v.firstSequence,endSequence:v.endSequence,chunk:v.chunk,gap:v.gap});
    const result=observer(transfer);if(result!==undefined){if(result!==null&&['object','function'].includes(typeof result)){cell.observerDone=false;this.#watchDelivery(r,cell,result,'observerDone');}refuse('REQUEST_REFUSED');}
    this.#check(scope,r);if(r.published!==a)refuse('LEASE_STALE');let ticket=null;
    if(v.chunk){ticket=Object.freeze(Object.create(null));const f={ticket,readTicket:v.readTicket,end:v.chunk.sequence+v.chunk.utf8Bytes,scope,record:r,attachment:a,committed:false};a.frames.set(f.end,f);this.#handoffs.set(ticket,f);}
    return pass({handoffTicket:ticket},scope.payload.operationId);
   }catch(error){this.#unpublish(r);return fail(errorCode(error),scope.payload.operationId);}finally{a.reading=false;this.#reclaim(r);}})();
   let complete;const completion=new NativePromise(resolve=>complete=resolve),reply=this.#public(completion,()=>{this.#unpublish(r);},'HOST_UNAVAILABLE',scope.payload.operationId,()=>{cell.publicDone=true;this.#finishDelivery(r,cell);},r);this.#watchDelivery(r,cell,actual,'outerDone',complete);return reply;
  }catch(error){if(cell&&!actual){cell.outerDone=true;cell.publicDone=true;}return Promise.resolve(fail(errorCode(error),scope?.payload.operationId??validated?.payload?.operationId));}
  finally{if(cell){cell.entryFrame=false;this.#finishDelivery(r,cell);}}
 }
 commitOutputHandoff(ticket,...extra){
  const f=ticket&&typeof ticket==='object'&&!types.isProxy(ticket)?this.#handoffs.get(ticket):null;if(extra.length||!f||f.committed)return fail('REQUEST_REFUSED');
  let entry;try{entry=this.#reserveEntry(f.scope.grant,'terminalAck',{...f.scope.payload,throughSequence:f.end},'commit');if(entry?.refused)return fail('CAPACITY_EXCEEDED');this.#check(f.scope,f.record);if(f.record.published!==f.attachment||f.attachment.frames.get(f.end)!==f)refuse('LEASE_STALE');f.committed=true;return pass({committed:true});}catch(error){return fail(errorCode(error));}finally{this.#finishEntry(entry);}
 }
 shutdown(reason){const g=this.#globalRecord.life;if(g.slots.has('shutdown'))return g.slots.get('shutdown').reply;if(g.done)return this.#cachedShutdown??=new NativePromise(resolve=>resolve(fail('HOST_SHUTDOWN_UNVERIFIED')));return this.#lane('shutdown',()=>{this.retireManager();return new NativePromise(resolve=>resolve(fail('HOST_SHUTDOWN_UNVERIFIED')));},()=>{},'HOST_SHUTDOWN_UNVERIFIED');}
 stats(){const rows=[...this.#records.values()],output=this.#output.stats();return Object.freeze({nativeExecutionAdmitted:false,reservedSessions:this.#records.size,pendingOperations:rows.reduce((n,r)=>n+r.pending,0)+output.pendingFacetOperations,ledgerSessions:this.#ledger.snapshot().length,inputClosed:this.#closed,accessGeneration:this.#generation,lost:this.#lost,retired:this.#retired,outputImplemented:true,privateOutputImplemented:true,asyncTeardownAvailable:false,publishedAttachments:rows.filter(r=>r.published).length,pendingAttachments:rows.filter(r=>r.transition).length,uncertainAttachments:rows.filter(r=>r.uncertain).length,pendingCommands:rows.filter(r=>r.command).length,quarantinedOperations:rows.reduce((n,r)=>n+r.quarantined,0),inputScopeTickets:rows.reduce((n,r)=>n+r.inputs.size,0),uncertainInputs:rows.filter(r=>r.uncertainInput).length,outputHandoffTickets:rows.reduce((n,r)=>n+(r.published?.frames.size??0),0),output});}
}
