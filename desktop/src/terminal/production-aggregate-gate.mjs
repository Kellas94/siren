// Main-only control candidate. Quiescence never proves owner death or refunds
// native capacity. Native execution remains unqualified.
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';
const P=Promise,then=Promise.prototype.then;
const promisePrototype=P.prototype,species=Object.getOwnPropertyDescriptor(P,Symbol.species)?.get;
const follow=(p,ok,bad)=>Reflect.apply(then,p,[ok,bad]);
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const callable=v=>typeof v==='function'&&!types.isProxy(v);
// Node async-hooks may attach DATA symbols. No caller constructor/then access
// or subclass species dispatch is allowed when consuming a returned Promise.
const ownPromise=v=>!!v&&!types.isProxy(v)&&types.isPromise(v)&&Object.getPrototypeOf(v)===P.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='symbol'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'));
const observable=v=>!!v&&typeof v==='object'&&!types.isProxy(v)&&types.isPromise(v)&&Object.getPrototypeOf(v)===promisePrototype&&!Object.hasOwn(v,'constructor')&&Object.getOwnPropertyDescriptor(promisePrototype,'constructor')?.value===P&&Object.getOwnPropertyDescriptor(P,Symbol.species)?.get===species&&typeof species==='function'&&!types.isProxy(species);
const fail=(code='HOST_UNAVAILABLE')=>Object.freeze({ok:false,code});
const success=()=>Object.freeze({ok:true});
const receipt=(p,ok)=>Object.freeze({ok,generation:p.generation,open:p.open});
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const out=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;
}
function options(value){
 if(!value||typeof value!=='object'||types.isProxy(value))throw TypeError('Aggregate DATA options required');
 const keys=Reflect.ownKeys(value),allowed=['resolveLink','onUnavailable','setTimer','clearTimer','deadlineMs'];
 if(keys.some(k=>!allowed.includes(k)))throw TypeError('Aggregate DATA options required');const r=fields(value,keys);if(!r)throw TypeError('Aggregate DATA options required');return r;
}
function method(value,key){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return null;const d=Object.getOwnPropertyDescriptor(p,key);if(d)return Object.hasOwn(d,'value')&&callable(d.value)?(...args)=>Reflect.apply(d.value,value,args):null;}return null;
}
const deferred=()=>{const t={timer:null,done:false};t.promise=new P(r=>t.resolve=r);return t;};
export class ProductionAggregateGateLink {
 #resolve;#observer;#listener=null;#entries=new Map();#tokens=new Map();#binds=new Set();
 #generation=0;#open=false;#lost=false;#failureFenceFailed=false;#setTimer;#clearTimer;#deadline;
 #lifetimes=new Set();
 constructor(value={},...extra){
  if(extra.length)throw TypeError('Aggregate DATA options required');const r=options(value);
  const observer=r.onUnavailable===undefined?()=>{}:r.onUnavailable,set=r.setTimer===undefined?setTimeout:r.setTimer,clear=r.clearTimer===undefined?clearTimeout:r.clearTimer,deadline=r.deadlineMs===undefined?limits.stopDeadlineMs:r.deadlineMs;
  if(![observer,set,clear].every(callable)||!integer(deadline)||deadline<1||deadline>limits.stopDeadlineMs||(r.resolveLink!==undefined&&!callable(r.resolveLink)))throw TypeError('Bounded aggregate dependencies required');
  this.#resolve=r.resolveLink??null;this.#lost=!this.#resolve;this.#observer=observer;this.#setTimer=set;this.#clearTimer=clear;this.#deadline=deadline;
 }
 get nativeExecutionAdmitted(){return false;}
 #frame(e,run){e.frames++;try{return run();}finally{e.frames--;this.#settled(e);}}
 #settled(e){if(e.actualDone||!e.retired||e.frames||e.continuations||e.binding||e.unknown||e.cells.some(c=>c.pending||c.unknown))return;e.actualDone=true;this.#lifetimes.delete(e);const resolve=e.actualResolve;e.actualResolve=null;resolve(Object.freeze({scope:'AGGREGATE_SESSION',sessionId:e.sessionId,actualSettled:true,nativeExecutionAdmitted:false}));}
 #observation(e){e.frames=0;e.continuations=0;e.retired=false;e.actualDone=false;e.unknown=false;e.cleanupStarted=false;e.cells=Array.from({length:3},()=>({entered:false,pending:false,settled:false,unknown:false,promise:null}));e.handle=Object.freeze({sessionId:e.sessionId,actualSettled:new P(resolve=>e.actualResolve=resolve),snapshot:()=>Object.freeze({sessionId:e.sessionId,retired:e.retired,actualSettled:e.actualDone,unknown:e.unknown||e.cells.some(c=>c.unknown),activeFrames:e.frames,continuations:e.continuations,binding:e.binding,operations:Object.freeze(e.cells.map(c=>Object.freeze({entered:c.entered,pending:c.pending,settled:c.settled,unknown:c.unknown}))),nativeExecutionAdmitted:false})});}
 #disposeEntry(e){if(e.cleanupStarted)return;e.cleanupStarted=true;this.#frame(e,()=>{try{e.dispose?.();}catch{this.#failureFenceFailed=true;}});}
 captureSessionSettlement(sessionId,...extra){return !extra.length&&id(sessionId)?this.#entries.get(sessionId)?.handle??null:null;}
 #follow(e,p,ok,bad=()=>{}){if(!observable(p)){e.unknown=true;this.#lose();return;}e.continuations++;try{return follow(p,v=>this.#frame(e,()=>{try{return ok(v);}finally{e.continuations--;}}),v=>this.#frame(e,()=>{try{return bad(v);}finally{e.continuations--;}}));}catch{e.continuations--;e.unknown=true;this.#settled(e);}}
 // The only async ingress uses a private DATA thenable and a non-thenable box.
 #wait(e,work){return Object.freeze(Object.assign(Object.create(null),{then:(resolve,reject)=>{if(!this.#follow(e,work,v=>{resolve(Object.freeze(Object.assign(Object.create(null),{value:v})));},v=>{reject(v);}))reject(Error('WORK_UNOBSERVABLE'));}}));}
 #all(e,values){return new P((resolve,reject)=>{const results=[];let left=values.length;if(!left)resolve(results);for(const [i,p]of values.entries())this.#follow(e,p,v=>{results[i]=v;if(!--left)resolve(results);},reject);});}
 #send(e,packet,fallback,ok,bad){
  const c=fallback?e.cells[2]:e.cells.slice(0,2).find(c=>!c.pending&&!c.unknown);
  if(!c||fallback&&c.entered){e.unknown=true;return false;}c.entered=true;c.pending=true;c.settled=false;
  let work;try{work=e.send(packet);c.promise=work;if(!observable(work))throw Error();
   follow(work,v=>this.#frame(e,()=>{try{ok(v);}finally{c.pending=false;c.settled=true;c.promise=null;}}),v=>this.#frame(e,()=>{try{bad(v);}finally{c.pending=false;c.settled=true;c.promise=null;}}));
  }catch{c.pending=false;c.unknown=true;return false;}
  // Public admission remains stricter than actual observation (own then, etc.).
  return ownPromise(work);
 }
 #current(e){return this.#entries.get(e.sessionId)===e;}
 #available(){
  if(this.#lost)return false;
  for(const e of [...this.#entries.values()])if(this.#current(e)&&e.link&&!e.quiesced){let ok=false;this.#frame(e,()=>{try{ok=e.available()===true;}catch{}});if(this.#lost)return false;if(!this.#current(e)||e.quiesced)continue;if(!ok){this.#lose();return false;}}
  return !this.#lost;
 }
 isAvailable(){return this.#available();}
 subscribeUnavailable(listener){if(!callable(listener)||this.#listener)throw TypeError('One aggregate lifetime listener required');this.#listener=listener;if(this.#lost)Reflect.apply(listener,undefined,[]);}
 reserve(sessionId){return this.#reserve(sessionId).result;}
 // Retain the exact newly reserved handle even if availability reentry removes it.
 reserveObserved(sessionId,...extra){return extra.length?Object.freeze({result:fail('REQUEST_REFUSED'),settlement:null}):this.#reserve(sessionId);}
 #reserve(sessionId){
  if(!id(sessionId)||this.#entries.has(sessionId))return Object.freeze({result:fail('REQUEST_REFUSED'),settlement:null});if(this.#lifetimes.size>=limits.sessions)return Object.freeze({result:fail('CAPACITY_EXCEEDED'),settlement:null});
  const e={sessionId,channelId:null,link:null,binding:false,active:new Map(),lastGeneration:0,quiesce:null,quiesced:false};this.#observation(e);this.#lifetimes.add(e);this.#entries.set(sessionId,e);
  return this.#frame(e,()=>{let result=success();if(!this.#available()||!this.#current(e)){if(this.#current(e))this.#entries.delete(sessionId);e.retired=true;result=fail();}return Object.freeze({result,settlement:e.handle});});
 }
 async bind(sessionId,channelId){
  const e=this.#entries.get(sessionId);
  if(!e||e.link||e.binding||e.quiesce||!id(channelId)||[...this.#entries.values()].some(x=>x.channelId===channelId))return fail('REQUEST_REFUSED');
  e.binding=true;e.frames++;
  try{
   if(!this.#available()||!this.#current(e))return fail('REQUEST_REFUSED');
   const r=fields(Reflect.apply(this.#resolve,undefined,[sessionId,channelId]),['link','initiallyClosed']);
   const send=method(r?.link,'sendGate'),subscribe=method(r?.link,'subscribeUnavailable'),available=method(r?.link,'isAvailable'),dispose=method(r?.link,'dispose');
   if(!r||r.initiallyClosed!==true||![send,subscribe,available,dispose].every(callable)||!this.#current(e)||this.#lost||[...this.#entries.values()].some(x=>x!==e&&(x.link===r.link||x.channelId===channelId)))return fail('REQUEST_REFUSED');
   e.link=r.link;e.channelId=channelId;e.send=send;e.available=available;e.dispose=dispose;
   subscribe(()=>{if(this.#current(e)&&!e.quiesced)this.#lose();});
   if(!this.#available()||!this.#current(e))return fail();
   let work;const token=this.#tokens.get(this.#generation);
   if(token){token.waiting.add(e);this.#dispatch(token,e);work=token.promise;}
   else if(this.#generation===0)work=P.resolve(receipt({generation:0,open:false},true));
   else work=this.#perform(e,{generation:this.#generation,open:this.#open});
   const result=(await this.#wait(e,this.#bounded(work,e))).value;
   return result.ok&&this.#available()&&this.#current(e)&&!e.quiesce?success():fail();
  }catch{this.#lose();return fail();}finally{e.binding=false;e.frames--;this.#settled(e);}
 }
 // Main-only, after independently verifying this exact native owner is dead.
 release(sessionId){
  const e=this.#entries.get(sessionId);return e?this.#retire(e):fail('SESSION_REFUSED');
 }
 // Exact control-entry retirement after backend Stop fences new entry work.
 // It conveys no native owner verification or Session capacity refund.
 retireObserved(handle,...extra){const e=!extra.length&&[...this.#entries.values()].find(e=>e.handle===handle);return e?this.#retire(e):fail('SESSION_REFUSED');}
 #retire(e){return this.#frame(e,()=>{e.retired=true;this.#entries.delete(e.sessionId);
  if(e.quiesce&&!e.quiesce.done)this.#finishQuiesce(e,false);
  for(const op of e.active.values()){op.done=true;op.resolve(receipt(op.packet,false));}e.active.clear();
  for(const b of [...this.#binds])if(b.entry===e)this.#finishBind(b,fail());
  for(const t of [...this.#tokens.values()]){t.waiting.delete(e);this.#maybeFinish(t);}
  this.#disposeEntry(e);return success();});
 }
 sendGate(value){
  const p=fields(value,['generation','open']);
  if(!p||!integer(p.generation)||typeof p.open!=='boolean'||!this.#available()||p.generation<=this.#generation||this.#tokens.size>=2)return P.resolve(fail());
  if(this.#tokens.size&&(p.open||[...this.#tokens.values()].some(t=>!t.packet.open)))return P.resolve(fail());
  if(p.open&&[...this.#entries.values()].some(e=>!e.quiesced&&(e.binding||e.active.size||e.quiesce)))return P.resolve(fail());
  const t=deferred();t.packet=Object.freeze(p);t.waiting=new Set([...this.#entries.values()].filter(e=>e.link&&!e.quiesced));t.expires=performance.now()+this.#deadline;
  this.#tokens.set(p.generation,t);this.#generation=p.generation;this.#open=p.open;this.#arm(t,()=>this.#lose());
  if(!t.done&&!this.#lost)for(const e of [...t.waiting]){if(t.done||this.#lost)break;this.#dispatch(t,e);}
  this.#maybeFinish(t);return t.promise;
 }
 quiesce(sessionId){
  const e=this.#entries.get(sessionId);if(!e)return P.resolve(fail('SESSION_REFUSED'));
  return this.#frame(e,()=>{
  if(e.quiesce)return e.quiesce.promise;
  if(!this.#available()||!this.#current(e))return P.resolve(fail());if(!e.link)return P.resolve(fail('REQUEST_REFUSED'));
  const q=deferred();q.expires=performance.now()+this.#deadline;e.quiesce=q;
  // Retiring entries cannot produce an OPEN receipt. Close barriers retain the
  // entry until a fresh correlated CLOSED receipt is actually confirmed.
  for(const t of [...this.#tokens.values()])if(t.packet.open)this.#finish(t,false);
  this.#arm(q,()=>this.#lose());
  this.#follow(e,this.#all(e,[...e.active.values()].map(op=>op.promise)),()=>{
   if(q.done||this.#lost||!this.#current(e))return;const generation=Math.max(this.#generation,e.lastGeneration)+1;
   if(!integer(generation)||performance.now()>=q.expires){this.#lose();return;}
   this.#follow(e,this.#perform(e,{generation,open:false},true),r=>{
    if(q.done)return;
    if(!r.ok||!this.#current(e)||!this.#available()||performance.now()>=q.expires){if(this.#current(e))this.#lose();else this.#finishQuiesce(e,false);return;}
    this.#finishQuiesce(e,true);
   },()=>this.#lose());
  },()=>this.#lose());return q.promise;});
 }
 #finishQuiesce(e,ok){
  const q=e.quiesce;if(!q||q.done)return;this.#clear(q);if(q.done)return;
  if(ok&&(this.#lost||!this.#current(e)||performance.now()>=q.expires)){this.#lose();ok=false;}
  if(q.done)return;q.done=true;e.quiesced=ok;q.resolve(ok?success():fail());
  if(ok)for(const t of [...this.#tokens.values()]){if(t.packet.open){this.#finish(t,false);continue;}t.waiting.delete(e);this.#maybeFinish(t);}
 }
 #perform(e,packet,quiesce=false){
  if(this.#lost||!this.#current(e)||e.quiesced)return P.resolve(receipt(packet,false));
  if(e.quiesce&&!quiesce)return this.#follow(e,e.quiesce.promise,r=>receipt(packet,!packet.open&&r.ok));
  const existing=e.active.get(packet.generation);if(existing)return existing.promise;
  if(e.active.size>=2||packet.generation<=e.lastGeneration){this.#lose();return P.resolve(receipt(packet,false));}
  const op=deferred();op.packet=Object.freeze({...packet});e.active.set(packet.generation,op);e.lastGeneration=packet.generation;
  // Install an owned Promise BEFORE an external send can reenter.
  const accepted=this.#send(e,op.packet,false,value=>{
   const r=fields(value,['ok','generation','open']);let ok=!!r&&r.ok===true&&r.generation===packet.generation&&r.open===packet.open;
   if(this.#current(e)&&!op.done){if(!ok&&(quiesce||packet.generation===this.#generation))this.#lose();if(ok)ok=this.#available();}
   this.#complete(e,op,ok);
  },()=>{if(this.#current(e)&&!op.done)this.#lose();this.#complete(e,op,false);});if(!accepted){this.#lose();this.#complete(e,op,false);}return op.promise;
 }
 #complete(e,op,ok){if(op.done)return;op.done=true;e.active.delete(op.packet.generation);op.resolve(receipt(op.packet,ok&&!this.#lost&&this.#current(e)));}
 #dispatch(t,e){
  if(t.done||this.#lost||!this.#current(e))return;
  const close=[...e.active.values()].find(op=>!op.packet.open&&op.packet.generation<t.packet.generation);
  const work=e.quiesce?this.#follow(e,e.quiesce.promise,r=>receipt(t.packet,!t.packet.open&&r.ok)):
   close&&!t.packet.open?this.#follow(e,close.promise,()=>t.done?receipt(t.packet,false):this.#perform(e,t.packet)):this.#perform(e,t.packet);
  this.#follow(e,work,r=>{
   if(t.done)return;
   if(!this.#current(e)||e.quiesced){t.waiting.delete(e);this.#maybeFinish(t);return;}
   if(e.quiesce){this.#follow(e,e.quiesce.promise,q=>{if(t.done)return;if(!q.ok){this.#lose();return;}t.waiting.delete(e);this.#maybeFinish(t);});return;}
   if(!r.ok){if(t.packet.generation<this.#generation)this.#finish(t,false);else this.#lose();return;}
   t.waiting.delete(e);this.#maybeFinish(t);
  },()=>this.#lose());
 }
 #maybeFinish(t){if(!t.done&&!t.waiting.size)this.#finish(t,!this.#lost&&t.packet.generation===this.#generation);}
 #finish(t,ok){
  if(t.done)return;if(ok&&performance.now()>=t.expires){this.#lose();return;}this.#clear(t);if(t.done)return;
  if(ok&&(this.#lost||performance.now()>=t.expires)){this.#lose();ok=false;}if(t.done)return;
  t.done=true;this.#tokens.delete(t.packet.generation);t.resolve(receipt(t.packet,ok&&!this.#lost));
  if(ok&&!t.packet.open)for(const old of [...this.#tokens.values()])if(old.packet.generation<t.packet.generation)this.#finish(old,false);
 }
 #arm(t,expire){
  if(t.done||this.#lost)return;
  try{const timer=Reflect.apply(this.#setTimer,undefined,[expire,this.#deadline]);if(t.done||this.#lost){try{Reflect.apply(this.#clearTimer,undefined,[timer]);}catch{this.#failureFenceFailed=true;}}else t.timer=timer;}catch{this.#lose();}
 }
 #clear(t){if(t.timer===null)return;const timer=t.timer;t.timer=null;try{Reflect.apply(this.#clearTimer,undefined,[timer]);}catch{this.#failureFenceFailed=true;this.#lose();}}
 #bounded(work,e){
  const b=deferred();b.entry=e;b.expires=performance.now()+this.#deadline;this.#binds.add(b);this.#arm(b,()=>this.#lose());
  if(this.#lost)this.#finishBind(b,fail());else this.#follow(e,work,r=>this.#finishBind(b,r),()=>{this.#lose();this.#finishBind(b,fail());});return b.promise;
 }
 #finishBind(b,r){if(b.done)return;this.#clear(b);if(b.done)return;if(performance.now()>=b.expires&&!this.#lost)this.#lose();if(b.done)return;b.done=true;this.#binds.delete(b);b.resolve(this.#lost?fail():r);}
 #lose(){
  if(this.#lost)return;this.#lost=true;this.#open=false;const owned=[...this.#lifetimes],fallback=owned.filter(e=>this.#current(e)&&e.link&&!e.quiesced);for(const e of owned){e.frames++;e.retired=true;}try{
  try{if(this.#listener)Reflect.apply(this.#listener,undefined,[]);}catch{this.#failureFenceFailed=true;}
  // Fence lifetime synchronously before observers or Promise settlements.
  for(const e of fallback){const generation=Math.max(this.#generation,e.lastGeneration)+1;if(integer(generation)){if(!this.#send(e,Object.freeze({generation,open:false}),true,()=>{},()=>{}))this.#failureFenceFailed=true;}}
  try{Reflect.apply(this.#observer,undefined,[]);}catch{this.#failureFenceFailed=true;}
  for(const e of this.#entries.values()){this.#finishQuiesce(e,false);for(const op of [...e.active.values()])this.#complete(e,op,false);}
  for(const b of [...this.#binds])this.#finishBind(b,fail());for(const t of [...this.#tokens.values()])this.#finish(t,false);
  for(const e of owned)this.#disposeEntry(e);
  }finally{for(const e of owned){e.frames--;this.#settled(e);}}
 }
 dispose(){const owned=[...this.#lifetimes];for(const e of owned)e.frames++;try{this.#lose();for(const e of this.#entries.values())this.#disposeEntry(e);}finally{for(const e of owned){e.frames--;this.#settled(e);}}}
 stats(){const es=[...this.#entries.values()];return Object.freeze({sessions:es.length,bound:es.filter(e=>e.link).length,binding:es.filter(e=>e.binding).length,quiescing:es.filter(e=>e.quiesce&&!e.quiesce.done).length,quiesced:es.filter(e=>e.quiesced).length,pending:this.#tokens.size,maxPending:2,generation:this.#generation,open:this.#open,closed:this.#lost,failureFenceFailed:this.#failureFenceFailed});}
}
