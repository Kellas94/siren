// Additive UNIMPORTED MAIN-private coordination. SOURCE_ONLY / NOT_ADMITTED.
// This controller must be the sole MAIN caller of manager closeInput/resumeInput
// in its future composition. Hooks/readiness must never call those independently.
// Local manager access epochs and host gate generations are distinct counters.
// Manager has no public raw gate telemetry; correlated receipts below are not a
// claim to observe out-of-band pending OPEN, native view destruction or teardown.
// prepareWorkspace/retireViews/rollbackWorkspace are TRUSTED MAIN async-void
// contracts wrapping existing private editor/PIN/retirement glue. They are NOT
// existing exports or renderer callbacks. prepare owns its existing roster fence;
// this class does not freeze another roster or implement PIN commit / Quit / Stop.
import {types} from 'node:util';
import {TerminalProductionManager} from './production-manager.mjs';
import {TerminalRequestRouter} from './request-router.mjs';
import {WindowRegistry} from '../windows/registry.mjs';
import {CwdAuthority} from './cwd.mjs';

const NativePromise=Promise,then=Promise.prototype.then,promisePrototype=Promise.prototype;
const species=Object.getOwnPropertyDescriptor(Promise,Symbol.species),apply=Reflect.apply;
const capture=(type,key)=>Object.getOwnPropertyDescriptor(type.prototype,key).value;
const managerStats=capture(TerminalProductionManager,'stats'),close=capture(TerminalProductionManager,'closeInput'),open=capture(TerminalProductionManager,'resumeInput');
const managerRequest=capture(TerminalProductionManager,'captureManagerRequestSettlement'),managerCapture=capture(TerminalProductionManager,'captureManagerSettlement'),managerRetire=capture(TerminalProductionManager,'retireManager');
const routerStats=capture(TerminalRequestRouter,'stats'),routerRevoke=capture(TerminalRequestRouter,'revoke');
const routerCapture=capture(TerminalRequestRouter,'captureRouterSettlement');
const registryCapture=capture(WindowRegistry,'capture'),registryCurrent=capture(WindowRegistry,'isCurrent'),registryGuard=capture(WindowRegistry,'captureAdmissionGuard'),cwdRevoke=capture(CwdAuthority,'revoke');
const routes=Object.freeze(Object.fromEntries(['create','list','attach','input','resize','ack','detach','stop'].map(key=>[key,capture(TerminalProductionManager,key)])));
const positive=n=>Number.isSafeInteger(n)&&n>0;
const callable=f=>typeof f==='function'&&!types.isProxy(f);
const fail=code=>Object.freeze({ok:false,code});
const resolved=value=>new NativePromise(resolve=>resolve(value));
function data(value,keys=null){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const out=Object.create(null);for(const key of own){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
function exactInstance(value,type){return !!value&&!types.isProxy(value)&&Object.getPrototypeOf(value)===type.prototype;}
function nativePromise(value){
 if(!value||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))return false;
 const ctor=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),now=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!ctor&&Object.hasOwn(ctor,'value')&&ctor.value===NativePromise&&!!now&&now.get===species.get&&now.set===species.set&&!Object.hasOwn(now,'value');
}
function unsafeAsyncShape(value){
 if(value===null||!['object','function'].includes(typeof value))return false;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return true;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return !Object.hasOwn(d,'value')||typeof d.value==='function';}return false;
}
function catalogues(value){
 if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>8||Reflect.ownKeys(value).length!==value.length+1)throw TypeError('Explicit bounded catalogue set required');
 const rows=[],seen=new Set();for(let i=0;i<value.length;i++){
  const d=Object.getOwnPropertyDescriptor(value,String(i)),row=d&&Object.hasOwn(d,'value')?d.value:null;
  if(!row||types.isProxy(row)||!Object.isFrozen(row)||Object.getPrototypeOf(row)!==Object.prototype||seen.has(row))throw TypeError('Retained frozen catalogue identity required');
  const methods=data(row,['listShellProfiles','resolveShellProfile','revoke','dispose']);if(!methods||!Object.values(methods).every(callable))throw TypeError('Frozen catalogue DATA methods required');
  // These supplied closures remain a TRUSTED MAIN prerequisite here. The
  // separate graph factory creates its own WeakMap-branded catalogues.
  rows.push(Object.freeze({object:row,revoke:methods.revoke}));seen.add(row);
 }return Object.freeze(rows);
}
function gateReceipt(value,closed){const r=data(value,['ok','generation','localInputFenced','hostAcknowledged']);return !!r&&r.ok===true&&positive(r.generation)&&r.localInputFenced===closed&&r.hostAcknowledged===true?r:null;}
function accessLifetime(){
 const c={retired:false,done:false,unknown:false,frames:0,pending:new Set(),transitions:0,timers:0,managerDone:false,resolve:null};
 c.handle=Object.freeze({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingWorkers:c.pending.size,pendingTransitions:c.transitions,pendingTimers:c.timers,managerActualSettled:c.managerDone,nativeExecutionAdmitted:false})});return c;
}

export class TerminalProductionAccessTransitions {
 #manager;#router;#registry;#cwd;#catalogues;#project;#prepare;#retire;#rollback;#ready;#deadline;
 #epoch=0;#active=null;#workers=new Set();#fenced=false;#life=accessLifetime();#managerHandle;#retiredReply=resolved(fail('TRANSITION_RETIRED'));
 #routerHandles=[];#retainedRouters=new Set();
 constructor(options){
  const o=data(options,['manager','router','registry','cwdAuthority','profileCatalogues','projectId','prepareWorkspace','retireViews','rollbackWorkspace','isReady','deadlineMs']);
  if(!o||!exactInstance(o.manager,TerminalProductionManager)||!exactInstance(o.router,TerminalRequestRouter)||!exactInstance(o.registry,WindowRegistry)||!exactInstance(o.cwdAuthority,CwdAuthority)||typeof o.projectId!=='string'||!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(o.projectId)||![o.prepareWorkspace,o.retireViews,o.rollbackWorkspace,o.isReady].every(callable)||!positive(o.deadlineMs)||o.deadlineMs>5000)throw TypeError('Private actual transition dependencies required');
  // Actual private fields brand-check the observations. Cwd has no passive
  // brand API; captured revoke failure is fail-closed at the effectful boundary.
  apply(managerStats,o.manager,[]);apply(routerStats,o.router,[]);apply(registryCurrent,o.registry,[Object.freeze({})]);
  this.#manager=o.manager;this.#router=o.router;this.#registry=o.registry;this.#cwd=o.cwdAuthority;this.#catalogues=catalogues(o.profileCatalogues);this.#project=o.projectId;
  this.#prepare=o.prepareWorkspace;this.#retire=o.retireViews;this.#rollback=o.rollbackWorkspace;this.#ready=o.isReady;this.#deadline=o.deadlineMs;
  this.#managerHandle=apply(managerCapture,this.#manager,[]);
  this.#retainRouter(this.#router);
 }
 get nativeExecutionAdmitted(){return false;}
 captureAccessSettlement(...extra){return extra.length?null:this.#life.handle;}
 captureRouterSettlementRoster(...extra){return extra.length?null:Object.freeze([...this.#routerHandles]);}
 #retainRouter(router){
  if(this.#routerHandles.length>=32)throw TypeError('Bounded router history exhausted');
  const handle=apply(routerCapture,router,[]),row={router,handle};
  this.#routerHandles.push(handle);this.#retainedRouters.add(row);
  this.#observe(null,()=>handle.actualSettled,{accept:value=>{const r=data(value,['scope','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='ROUTER_REQUESTS'&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;},onSettled:()=>{row.router=null;this.#retainedRouters.delete(row);}});
  if(this.#life.retired)apply(routerRevoke,router,[]);
  return router;
 }
 #frame(callback){this.#life.frames++;try{return callback();}finally{this.#life.frames--;this.#finish();}}
 #finish(){
  const c=this.#life;if(c.done||!c.retired||c.unknown||c.frames||c.pending.size||c.transitions||c.timers||!c.managerDone)return;
  this.#manager=this.#router=this.#registry=this.#cwd=this.#catalogues=this.#prepare=this.#retire=this.#rollback=this.#ready=this.#managerHandle=null;this.#active=null;c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'ACCESS_TRANSITIONS',actualSettled:true,nativeExecutionAdmitted:false}));
 }
 retireAccess(...extra){
  const c=this.#life;if(extra.length)return null;if(c.retired)return c.handle;
  return this.#frame(()=>{c.retired=true;this.#fenced=true;this.#epoch++;for(const t of this.#workers){t.revoked=true;this.#publish(t,fail('TRANSITION_RETIRED'));}
   // Manager retirement fences input first and starts Stop independently of a
   // held CLOSE; revocation cannot be mistaken for native/provider completion.
   try{if(apply(managerRetire,this.#manager,[])!==this.#managerHandle)c.unknown=true;}catch{c.unknown=true;}
   if(!this.#invalidate(this.#active))c.unknown=true;
   for(const row of this.#retainedRouters)try{if(apply(routerRevoke,row.router,[])!==undefined)c.unknown=true;}catch{c.unknown=true;}
   const h=data(this.#managerHandle,['actualSettled','sessionReservationsReleased','snapshot']);
   if(!h||!Object.isFrozen(this.#managerHandle)||!callable(h.snapshot))c.unknown=true;
   else this.#observe(null,()=>h.actualSettled,{accept:value=>{const r=data(value,['scope','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='MANAGER_GLOBAL'&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;},onSettled:()=>{c.managerDone=true;}});
   return c.handle;
  });
 }
 #ms(){return apply(managerStats,this.#manager,[]);}
 #rs(){return apply(routerStats,this.#router,[]);}
 #identity(t,closed){if(this.#life.retired)return false;const m=this.#ms();return this.#active===t&&!t.revoked&&t.epoch===this.#epoch&&m.accessGeneration===t.localEpoch&&m.inputClosed===closed&&!m.lost&&!m.retired;}
 #invalidate(t){
  let ok=true;const callbacks=[()=>apply(routerRevoke,this.#router,[]),()=>apply(cwdRevoke,this.#cwd,[]),...this.#catalogues.map(c=>()=>apply(c.revoke,c.object,[]))];
  if(t?.candidateRouter)callbacks.push(()=>apply(routerRevoke,t.candidateRouter,[]));
  // Every known authority is attempted even after another revocation throws.
  for(const fn of callbacks)try{const value=fn();if(value!==undefined){ok=false;if(types.isPromise(value)&&!types.isProxy(value))this.#observe(t??null,()=>value);else this.#life.unknown=true;}}catch{ok=false;}
  this.#fenced=true;return ok;
 }
 #token(kind){
  const t={kind,epoch:++this.#epoch,revoked:false,publicDone:false,quarantined:false,localEpoch:null,safety:null,candidateRouter:null,timer:null,operations:new Set()};
  t.promise=new NativePromise(resolve=>{t.resolve=resolve;});t.settled=new NativePromise(resolve=>{t.actualResolve=resolve;});
  this.#active=t;this.#workers.add(t);this.#life.transitions++;this.#life.timers++;t.timer=setTimeout(()=>this.#frame(()=>{
   if(t.publicDone)return;t.revoked=true;if(t.kind==='open')this.#safetyFence(t);else this.#invalidate(t);
   this.#publish(t,fail('TRANSITION_TIMEOUT'));
  }),this.#deadline);return t;
 }
 #publish(t,value){if(t.publicDone)return;t.publicDone=true;clearTimeout(t.timer);t.timer=null;this.#life.timers--;const resolve=t.resolve;t.resolve=null;resolve(value);}
 #quarantine(t){t.quarantined=true;const pending=new NativePromise(()=>{});t.operations.add(pending);return pending;}
 #observe(t,invoke,{voidOnly=false,accept=null,onSettled=null,outer=false}={}){
  const c={original:null,secondary:null,outcome:null,unknown:false,resolve:null},observed=new NativePromise(resolve=>c.resolve=resolve);this.#life.pending.add(c);if(t&&!outer)t.operations.add(observed);
  const unknown=()=>{c.unknown=true;this.#life.unknown=true;if(t)t.quarantined=true;};
  const complete=()=>this.#frame(()=>{if(c.unknown||!c.outcome)return;try{onSettled?.(c.outcome);const result=c.outcome,resolve=c.resolve;c.original=c.secondary=c.outcome=c.resolve=null;invoke=accept=onSettled=null;this.#life.pending.delete(c);resolve(result);}catch{unknown();}});
  this.#frame(()=>{try{c.original=invoke();if(!nativePromise(c.original))throw TypeError('Native private Promise required');c.secondary=apply(then,c.original,[value=>{try{if(accept&&accept(value)!==true){unknown();return;}c.outcome=voidOnly&&value!==undefined?{ok:false}:{ok:true,value};}catch{unknown();}c.original=null;},()=>{if(accept)unknown();else c.outcome={ok:false};c.original=null;}]);if(!nativePromise(c.secondary))throw TypeError('Native secondary required');apply(then,c.secondary,[complete,complete]);}catch{unknown();}});
  return observed;
 }
 #await(t,promise){
  if(nativePromise(promise))return promise;t.quarantined=true;this.#life.unknown=true;
  // Known private, never-settling await operand. Its own DATA constructor keeps
  // the engine's await fast path from reading a changed inherited constructor.
  // No foreign Promise is patched, observed unsafely or refunded as settled.
  const pending=new NativePromise(()=>{});Object.defineProperty(pending,'constructor',{value:NativePromise});return pending;
 }
 #managerRequest(t,invoke){
  return this.#observe(t,()=>{const raw=invoke(),handle=apply(managerRequest,this.#manager,[raw]),h=data(handle,['kind','requestId','actualSettled','snapshot']);
   if(!h||!Object.isFrozen(handle)||!['open','close'].includes(h.kind)||!positive(h.requestId)||!callable(h.snapshot))throw TypeError('Exact manager request authority required');
   this.#observe(t,()=>h.actualSettled,{accept:value=>{const r=data(value,['scope','kind','requestId','actualSettled','nativeExecutionAdmitted']);return !!r&&Object.isFrozen(value)&&r.scope==='MANAGER_CONTROL_REQUEST'&&r.kind===h.kind&&r.requestId===h.requestId&&r.actualSettled===true&&r.nativeExecutionAdmitted===false;}});
   return raw;
  });
 }
 #safetyFence(t){
  if(t.safety||this.#life.retired)return;t.revoked=true;
  // Synchronous CLOSE precedes all other callback invalidations on failure too.
  t.safety=this.#managerRequest(t,()=>apply(close,this.#manager,['transition reopen refused']));this.#invalidate(t);
 }
 #launch(t,run){
  // This Promise is created here, never supplied by a dependency.
  this.#observe(t,async()=>{let result;try{result=await this.#await(t,run());}catch{result=fail('TRANSITION_REFUSED');}
   // A superseded OPEN cannot dispatch another CLOSE over the newer Lock's
   // correlated epoch/receipt. The new current owner already fenced/revoked;
   // it waits this exact old worker before preparing/retiring any views.
   if(!this.#life.retired&&result?.ok!==true&&this.#active===t&&t.epoch===this.#epoch){if(t.kind==='open')this.#safetyFence(t);else{this.#invalidate(t);if(!this.#ms().inputClosed)this.#safetyFence(t);}}
   // Includes a CLOSE started before a later invalidation/refusal, even when
   // the workflow never reached its normal await. Public timeout cannot release
   // these actual returned workers. The finite Set iterator includes a safety
   // CLOSE added by a deadline while another observation is settling.
   for(const operation of t.operations)await this.#await(t,operation);
   return result;
  },{outer:true,onSettled:outcome=>{if(!outcome.ok){t.quarantined=true;this.#life.unknown=true;this.#publish(t,fail('TRANSITION_REFUSED'));return;}this.#workers.delete(t);this.#life.transitions--;if(this.#active===t)this.#active=null;t.operations.clear();const resolve=t.actualResolve;t.actualResolve=null;t.candidateRouter=null;resolve();this.#publish(t,outcome.value);}});
 }
 beginLock(reason='Lock'){
  if(this.#life.retired)return this.#retiredReply;
  return this.#frame(()=>this.#beginLock(reason));
 }
 #beginLock(reason){
  const prior=this.#active;
  if(this.#workers.size&&(prior?.kind!=='open'||prior.safety||this.#workers.size!==1))return resolved(fail('TRANSITION_BUSY'));
  if(prior){prior.revoked=true;this.#publish(prior,fail('TRANSITION_STALE'));}
  const before=this.#ms(),t=this.#token('close');t.localEpoch=before.accessGeneration+1;
  // FIRST effectful operation. No editor/PIN/readiness/provider wait precedes it.
  const closing=this.#managerRequest(t,()=>apply(close,this.#manager,[typeof reason==='string'?reason:'Lock']));
  const invalidated=this.#invalidate(t),initialCurrent=this.#identity(t,true);
  this.#launch(t,async()=>{
   if(!invalidated||!initialCurrent)return fail('TRANSITION_REFUSED');
   if(prior){await this.#await(t,prior.settled);if(!this.#identity(t,true))return fail('TRANSITION_STALE');}
   const prepared=await this.#await(t,this.#observe(t,()=>apply(this.#prepare,undefined,[]),{voidOnly:true}));
   if(!prepared.ok||!this.#identity(t,true))return fail('TRANSITION_REFUSED');
   const observed=await this.#await(t,closing),receipt=observed.ok&&gateReceipt(observed.value,true);
   if(!receipt||!this.#identity(t,true))return fail('TRANSITION_REFUSED');
   const retired=await this.#await(t,this.#observe(t,()=>apply(this.#retire,undefined,[]),{voidOnly:true}));
   if(!retired.ok||!this.#identity(t,true))return fail('TRANSITION_REFUSED');
   return Object.freeze({ok:true,localAccessGeneration:t.localEpoch,gateGeneration:receipt.generation});
  });return t.promise;
 }
 #admitted(t,scope,closed){
  if(!this.#identity(t,closed))return false;
  try{
   if(apply(registryCurrent,this.#registry,[scope.grant])!==true||apply(scope.guard,undefined,[])!==true||!this.#readiness(t,closed))return false;
   return apply(scope.guard,undefined,[])===true&&apply(registryCurrent,this.#registry,[scope.grant])===true&&this.#identity(t,closed);
  }catch{return false;}
 }
 #readiness(t,closed){
  if(!this.#identity(t,closed))return false;
  try{const value=apply(this.#ready,undefined,[]);
   // The contract is synchronous boolean. Observe unexpected native rejection
   // without granting authority or refunding actual pending async work.
   if(types.isPromise(value)||unsafeAsyncShape(value))this.#observe(t,()=>value);
   return value===true&&this.#identity(t,closed);
  }catch{return false;}
 }
 #newRouter(){
  // Captured actual prototype methods keep own overrides out of later routes.
  // Missing pickCwd/listProfiles remain genuinely unavailable; no fake adapter.
  const registry=Object.freeze({capture:e=>apply(registryCapture,this.#registry,[e]),isCurrent:g=>apply(registryCurrent,this.#registry,[g]),captureAdmissionGuard:g=>apply(registryGuard,this.#registry,[g])});
  const manager=Object.freeze(Object.fromEntries(Object.entries(routes).map(([key,fn])=>[key,(...args)=>apply(fn,this.#manager,args)])));
  if(this.#routerHandles.length>=32)throw TypeError('Bounded router history exhausted');
  return this.#retainRouter(new TerminalRequestRouter({registry,manager}));
 }
 reopen(event){
  if(this.#life.retired)return this.#retiredReply;
  return this.#frame(()=>this.#reopen(event));
 }
 #reopen(event){
  if(this.#workers.size)return resolved(fail('TRANSITION_BUSY'));
  if(!this.#fenced)return resolved(fail('TRANSITION_REFUSED'));
  const pinned=data(event,['sender','senderFrame']);if(!pinned?.sender||!pinned.senderFrame)return resolved(fail('SENDER_REFUSED'));
  const old=this.#rs();if(!old.revoked||old.disposed)return resolved(fail('TRANSITION_REFUSED'));if(old.pending!==0)return resolved(fail('AUTHORITY_PENDING'));
  const t=this.#token('open');t.localEpoch=this.#ms().accessGeneration;
  this.#launch(t,async()=>{
   // Readiness is checked before editor rollback, while capture/admission must
   // wait until the existing editor barrier has actually been released.
   if(!this.#readiness(t,true))return fail('TRANSITION_REFUSED');
   const rolled=await this.#await(t,this.#observe(t,()=>apply(this.#rollback,undefined,[]),{voidOnly:true}));
   if(!rolled.ok||!this.#identity(t,true))return fail('TRANSITION_REFUSED');
   // Only AFTER trusted editor rollback: real capture and new admission guard.
   const grant=apply(registryCapture,this.#registry,[Object.freeze(pinned)]),g=data(grant);
   if(!g||g.projectId!==this.#project||g.role!=='workspace'||!this.#identity(t,true))return fail('SENDER_REFUSED');
   const guard=data(apply(registryGuard,this.#registry,[grant]),['isCurrent']);if(!guard||!callable(guard.isCurrent))return fail('SENDER_REFUSED');
   const scope={grant,guard:guard.isCurrent};if(!this.#admitted(t,scope,true))return fail('SENDER_REFUSED');
   const previous=this.#rs();if(!previous.revoked||previous.pending!==0||previous.disposed)return fail('AUTHORITY_PENDING');
   const observed=await this.#await(t,this.#managerRequest(t,()=>apply(open,this.#manager,[]))),receipt=observed.ok&&gateReceipt(observed.value,false);
   if(!receipt||!this.#admitted(t,scope,false))return fail('TRANSITION_REFUSED');
   const finalOld=this.#rs();if(!finalOld.revoked||finalOld.pending!==0||finalOld.disposed)return fail('AUTHORITY_PENDING');
   const candidate=this.#newRouter();t.candidateRouter=candidate;
   if(!this.#admitted(t,scope,false))return fail('SENDER_REFUSED');
   this.#router=candidate;this.#fenced=false;
   return Object.freeze({ok:true,localAccessGeneration:t.localEpoch,gateGeneration:receipt.generation});
  });return t.promise;
 }
 currentRouter(){if(this.#life.retired)return null;const m=this.#ms();return !this.#fenced&&!this.#active&&!m.inputClosed&&!m.lost&&!m.retired?this.#router:null;}
 stats(){return Object.freeze({nativeExecutionAdmitted:false,retainedWorkers:this.#workers.size,quarantinedWorkers:[...this.#workers].filter(t=>t.quarantined).length,transition:this.#active?.kind??null,controllerGeneration:this.#epoch,inputFenced:this.#fenced});}
}
