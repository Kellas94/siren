// Pure control logic for the future manager/host. No Electron, PTY, process,
// renderer, ownership admission or automatic command execution. Main must bind
// its lifetime-aware bounded control transport and recheck caller/session/lease
// separately. An opaque send callback cannot report known host loss safely.
import {TERMINAL_LIMITS} from './contracts.mjs';
import {types} from 'node:util';
const P=Promise,apply=Reflect.apply,then=P.prototype.then,prototype=P.prototype,species=Object.getOwnPropertyDescriptor(P,Symbol.species).get,microtask=queueMicrotask;
const resolved=v=>new P(resolve=>resolve(v));
function observable(value){const c=Object.getOwnPropertyDescriptor(prototype,'constructor'),s=Object.getOwnPropertyDescriptor(P,Symbol.species);return !!value&&typeof value==='object'&&!types.isProxy(value)&&types.isPromise(value)&&Object.getPrototypeOf(value)===prototype&&!Object.hasOwn(value,'constructor')&&c&&Object.hasOwn(c,'value')&&c.value===P&&s?.get===species&&!Object.hasOwn(s,'value');}
function synchronous(value){if(value===null||!['object','function'].includes(typeof value))return true;if(types.isProxy(value)||types.isPromise(value))return false;for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return false;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return Object.hasOwn(d,'value')&&typeof d.value!=='function';}return true;}
function observation(){const c={retired:false,done:false,unknown:false,frames:0,tokens:new Set(),resolve:null};c.handle=Object.freeze({actualSettled:new P(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingTokens:c.tokens.size,maxPendingTokens:2,nativeExecutionAdmitted:false})});return c;}
function settled(c){if(c.done||!c.retired||c.unknown||c.frames||c.tokens.size)return;c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'INPUT_FENCE',actualSettled:true,nativeExecutionAdmitted:false}));}
const integer=n=>Number.isSafeInteger(n)&&n>=0;
function record(value,keys){
  try{
    if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
    const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))return null;
    const result=Object.create(null);
    for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
    return result;
  }catch{return null;}
}
const refusal=code=>Object.freeze({ok:false,code});
export class HostInputGate {
  #generation=0;#open=false;
  apply(packet){
    const p=record(packet,['generation','open']);
    if(!p||!integer(p.generation)||typeof p.open!=='boolean')return refusal('REQUEST_REFUSED');
    if(p.generation<this.#generation||p.generation===this.#generation&&p.open!==this.#open)return refusal('LEASE_STALE');
    this.#generation=p.generation;this.#open=p.open;
    return Object.freeze({ok:true,generation:this.#generation,open:this.#open});
  }
  allows(generation){return this.#open&&integer(generation)&&generation===this.#generation;}
}
export class TerminalInputFence {
  #ledger;#link;#send;#setTimer;#clearTimer;#deadline;#generation=0;#closed=true;#ack=false;#pending=null;#lost=false;#observation=observation();#ledgerBusy=false;#checkingAvailability=false;#requestHandles=new WeakMap();
  constructor({ledger,gateLink,setTimer=setTimeout,clearTimer=clearTimeout,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
    if(typeof ledger?.closeInput!=='function'||typeof ledger?.resumeInput!=='function'||![gateLink?.sendGate,gateLink?.subscribeUnavailable,gateLink?.isAvailable,setTimer,clearTimer].every(f=>typeof f==='function')||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs)throw TypeError('Bounded lifetime-aware gate dependencies required');
    this.#ledger=ledger;this.#link=gateLink;this.#send=p=>gateLink.sendGate(p);
    this.#setTimer=setTimer;this.#clearTimer=clearTimer;this.#deadline=deadlineMs;
    this.#frame(()=>this.#closeLedger('initial-input-fence'));
    // Bind before any request: even a synchronously closed subscription must
    // invalidate this instance. A lost instance never rebinds or replays input.
    this.#frame(()=>{gateLink.subscribeUnavailable(()=>{if(!this.#observation.retired)this.#frame(()=>this.#unavailable());});this.#available();});
  }
  get nativeExecutionAdmitted(){return false;}
  snapshot(){return Object.freeze({generation:this.#generation,closed:this.#closed,hostAcknowledged:this.#ack});}
  captureFenceSettlement(...extra){return extra.length?null:this.#observation.handle;}
  captureRequestSettlement(promise,...extra){return extra.length||!promise||typeof promise!=='object'||types.isProxy(promise)?null:this.#requestHandles.get(promise)??null;}
  #refused(){return resolved(Object.freeze({ok:false,code:'HOST_UNAVAILABLE',generation:this.#generation,localInputFenced:true,hostAcknowledged:false}));}
  retireFence(...extra){if(extra.length)return null;const c=this.#observation;if(!c.retired)this.#frame(()=>{c.retired=true;this.#closed=true;this.#ack=false;for(const t of c.tokens)this.#finish(t,false,'HOST_UNAVAILABLE');this.#closeLedger('fence-retired');});return c.handle;}
  #frame(run){const c=this.#observation;c.frames++;try{return run();}finally{c.frames--;settled(c);}}
  #closeLedger(reason){if(this.#ledgerBusy)return true;this.#ledgerBusy=true;try{this.#ledger.closeInput(reason);return true;}catch{this.#observation.unknown=true;this.#lost=true;this.#observation.retired=true;this.#closed=true;this.#ack=false;return false;}finally{this.#ledgerBusy=false;}}
  closeInput(reason){
    // This happens BEFORE any Promise/transport callback, including while a
    // previous open request is in flight. The ledger revokes every old lease.
    if(this.#observation.retired)return this.#refused();
    return this.#frame(()=>{this.#closed=true;this.#ack=false;
      if(this.#pending&&!this.#pending.open){const t=this.#pending,p=t.promise;this.#closeLedger(reason);if(!this.#available())this.#finish(t,false,'HOST_UNAVAILABLE');return p;}
      const old=this.#pending,t=this.#reserve(false);if(old)this.#finish(old,false,'LEASE_STALE');
      const fenced=this.#closeLedger(reason);if(!t)return this.#refused();
      if(!fenced||t.done||!this.#available()){this.#finish(t,false,'HOST_UNAVAILABLE');this.#reclaim(t);return t.promise;}
      return this.#request(t);
    });
  }
  resumeInput(){
    if(this.#observation.retired)return this.#refused();
    return this.#frame(()=>{
      if(this.#pending){const t=this.#pending;this.#available();return t.open?t.promise:this.#refused();}
      if(!this.#closed&&this.#ack){if(!this.#available())return this.#refused();return resolved(Object.freeze({ok:true,generation:this.#generation,localInputFenced:false,hostAcknowledged:true}));}
      const t=this.#reserve(true);if(!t)return this.#refused();this.#closed=true;this.#ack=false;
      if(!this.#closeLedger('fresh-input-generation')||t.done||!this.#available()){this.#finish(t,false,'HOST_UNAVAILABLE');this.#reclaim(t);return t.promise;}
      return this.#request(t);
    });
  }
  #reserve(open){const c=this.#observation;if(!integer(this.#generation+1))return null;const generation=++this.#generation;if(c.retired||c.tokens.size>=2||open&&c.tokens.size||!open&&[...c.tokens].some(t=>!t.open))return null;const t={generation,open,done:false,actualDone:false,actualResolve:null,timer:null,installing:false,timerLive:false,worker:false,unknown:false,original:null,secondary:null,receipt:null,expires:performance.now()+this.#deadline};t.promise=new P(resolve=>t.resolve=resolve);const handle=Object.freeze({generation,open,actualSettled:new P(resolve=>t.actualResolve=resolve),snapshot:()=>Object.freeze({generation,open,actualSettled:t.actualDone,unknown:t.unknown,nativeExecutionAdmitted:false})});this.#requestHandles.set(t.promise,handle);c.tokens.add(t);this.#pending=t;return t;}
  #clear(t){if(!t.timerLive||t.installing)return;t.timerLive=false;const timer=t.timer;t.timer=null;try{this.#clearTimer(timer);}catch{t.unknown=true;this.#observation.unknown=true;this.#unavailable();}}
  #reclaim(t){if(!t.done||t.worker||t.installing||t.timerLive||t.unknown)return;this.#observation.tokens.delete(t);if(t.resolve){const resolve=t.resolve;t.resolve=null;let r=t.receipt;t.receipt=null;if(r?.ok&&(this.#observation.retired||this.#lost||t.generation!==this.#generation||t.open&&this.#closed))r=Object.freeze({ok:false,generation:t.generation,localInputFenced:true,hostAcknowledged:false,code:'HOST_UNAVAILABLE'});resolve(r);}if(!t.actualDone){t.actualDone=true;const resolve=t.actualResolve;t.actualResolve=null;resolve(Object.freeze({scope:'INPUT_FENCE_REQUEST',generation:t.generation,open:t.open,actualSettled:true,nativeExecutionAdmitted:false}));}}
  #finish(token,ok,code){
    if(token.done)return;
    if(ok&&!this.#available())return;
    if(token.done)return;
    // Enforce this outer deadline independently of the link's own timeout.
    if(ok&&performance.now()>=token.expires){ok=false;code='HOST_UNAVAILABLE';}
    ok=ok&&!this.#observation.retired&&!this.#lost&&token.generation===this.#generation;token.done=true;
    if(this.#pending===token){
      this.#pending=null;this.#ack=ok;this.#closed=!ok||!token.open;
    }
    this.#clear(token);
    if(ok&&token.open&&!this.#observation.retired&&!this.#lost&&token.generation===this.#generation){try{this.#ledger.resumeInput();}catch{this.#observation.unknown=true;this.#unavailable();}}
    ok=ok&&!this.#observation.retired&&!this.#lost&&token.generation===this.#generation&&(!token.open||!this.#closed);
    token.receipt=Object.freeze({ok,generation:token.generation,localInputFenced:!ok||!token.open,hostAcknowledged:ok,...(!ok?{code:code??'HOST_UNAVAILABLE'}:{})});
    if(!ok&&token.resolve){const resolve=token.resolve;token.resolve=null;resolve(token.receipt);}
    this.#reclaim(token);
  }
  #unavailable(){
    if(this.#lost)return;
    this.#lost=true;this.#observation.retired=true;this.#closed=true;this.#ack=false;
    this.#closeLedger('host-unavailable');for(const t of this.#observation.tokens)this.#finish(t,false,'HOST_UNAVAILABLE');
  }
  #available(){
    if(this.#lost||this.#observation.retired)return false;
    if(this.#checkingAvailability)return true;
    let available=false;this.#checkingAvailability=true;try{available=this.#link.isAvailable()===true;}catch{/* Uncertain lifetime is unavailable. */}finally{this.#checkingAvailability=false;}
    if(this.#observation.retired)return false;if(!available)this.#unavailable();
    return available&&!this.#lost&&!this.#observation.retired;
  }
  #consume(t,reply){const r=!types.isProxy(reply)&&record(reply,['ok','generation','open']);this.#finish(t,!!r&&r.ok===true&&r.generation===t.generation&&r.open===t.open,'HOST_UNAVAILABLE');}
  #request(t){
    if(!observable(t.promise)){this.#unavailable();this.#reclaim(t);return t.promise;}
    t.installing=true;t.timerLive=true;
    try{t.timer=this.#setTimer(()=>{if(t.done&&!t.timerLive)return;this.#frame(()=>{this.#finish(t,false,'HOST_UNAVAILABLE');this.#reclaim(t);});},this.#deadline);}catch{t.unknown=true;this.#observation.unknown=true;this.#unavailable();}finally{t.installing=false;if(t.done)this.#clear(t);}
    if(t.done||this.#observation.retired){this.#finish(t,false,'HOST_UNAVAILABLE');this.#reclaim(t);return t.promise;}
    t.worker=true;
    try{
      t.original=this.#send(Object.freeze({generation:t.generation,open:t.open}));
      if(!observable(t.original)){
        if(!synchronous(t.original))throw Error('UNOBSERVABLE_GATE_WORK');
        const reply=t.original;microtask(()=>this.#frame(()=>{try{this.#consume(t,reply);}catch{this.#unavailable();}finally{t.original=null;t.worker=false;this.#reclaim(t);}}));return t.promise;
      }
      t.secondary=apply(then,t.original,[reply=>{this.#frame(()=>{try{this.#consume(t,reply);}catch{this.#unavailable();}finally{t.original=null;}});},()=>{this.#frame(()=>{t.original=null;this.#unavailable();});}]);
      if(!observable(t.secondary))throw Error('UNOBSERVABLE_GATE_SECONDARY');
      const complete=()=>{this.#frame(()=>{t.secondary=null;t.worker=false;this.#reclaim(t);});};apply(then,t.secondary,[complete,complete]);
    }catch{t.unknown=true;this.#observation.unknown=true;this.#unavailable();}
    return t.promise;
  }
}
