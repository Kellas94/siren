// Pure control logic for the future manager/host. No Electron, PTY, process,
// renderer, ownership admission or automatic command execution. Main must bind
// its lifetime-aware bounded control transport and recheck caller/session/lease
// separately. An opaque send callback cannot report known host loss safely.
import {TERMINAL_LIMITS} from './contracts.mjs';
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
  #ledger;#link;#send;#setTimer;#clearTimer;#deadline;#generation=0;#closed=true;#ack=false;#pending=null;#lost=false;
  constructor({ledger,gateLink,setTimer=setTimeout,clearTimer=clearTimeout,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
    if(typeof ledger?.closeInput!=='function'||typeof ledger?.resumeInput!=='function'||![gateLink?.sendGate,gateLink?.subscribeUnavailable,gateLink?.isAvailable,setTimer,clearTimer].every(f=>typeof f==='function')||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs)throw TypeError('Bounded lifetime-aware gate dependencies required');
    this.#ledger=ledger;this.#link=gateLink;this.#send=p=>gateLink.sendGate(p);
    this.#setTimer=setTimer;this.#clearTimer=clearTimer;this.#deadline=deadlineMs;
    ledger.closeInput('initial-input-fence');
    // Bind before any request: even a synchronously closed subscription must
    // invalidate this instance. A lost instance never rebinds or replays input.
    gateLink.subscribeUnavailable(()=>this.#unavailable());
    this.#available();
  }
  get nativeExecutionAdmitted(){return false;}
  snapshot(){return Object.freeze({generation:this.#generation,closed:this.#closed,hostAcknowledged:this.#ack});}
  closeInput(reason){
    // This happens BEFORE any Promise/transport callback, including while a
    // previous open request is in flight. The ledger revokes every old lease.
    this.#closed=true;this.#ack=false;this.#ledger.closeInput(reason);
    if(!this.#available())return Promise.resolve(refusal('HOST_UNAVAILABLE'));
    if(this.#pending&&!this.#pending.open)return this.#pending.promise;
    if(this.#pending)this.#finish(this.#pending,false,'LEASE_STALE');
    return this.#request(false);
  }
  resumeInput(){
    if(!this.#available())return Promise.resolve(refusal('HOST_UNAVAILABLE'));
    if(this.#pending)return this.#pending.open?this.#pending.promise:Promise.resolve(refusal('HOST_UNAVAILABLE'));
    if(!this.#closed&&this.#ack)return Promise.resolve(Object.freeze({ok:true,generation:this.#generation,localInputFenced:false,hostAcknowledged:true}));
    this.#closed=true;this.#ack=false;this.#ledger.closeInput('fresh-input-generation');
    return this.#request(true);
  }
  #finish(token,ok,code){
    if(token.done)return;
    if(ok&&!this.#available())return;
    // Enforce this outer deadline independently of the link's own timeout.
    if(ok&&performance.now()>=token.expires){ok=false;code='HOST_UNAVAILABLE';}
    token.done=true;
    if(token.timer!==null)this.#clearTimer(token.timer);
    if(this.#pending===token){
      this.#pending=null;this.#ack=ok;this.#closed=!ok||!token.open;
      if(ok&&token.open)this.#ledger.resumeInput();
    }
    token.resolve(Object.freeze({ok,generation:token.generation,localInputFenced:!ok||!token.open,hostAcknowledged:ok,...(!ok&&code?{code}:{})}));
  }
  #unavailable(){
    if(this.#lost)return;
    this.#lost=true;this.#closed=true;this.#ack=false;
    try{this.#ledger.closeInput('host-unavailable');}
    finally{if(this.#pending)this.#finish(this.#pending,false,'HOST_UNAVAILABLE');}
  }
  #available(){
    if(this.#lost)return false;
    let available=false;try{available=this.#link.isAvailable()===true;}catch{/* Uncertain lifetime is unavailable. */}
    if(!available)this.#unavailable();
    return available;
  }
  #request(open){
    if(!integer(this.#generation+1))return Promise.resolve(refusal('HOST_UNAVAILABLE'));
    const generation=++this.#generation,token={generation,open,done:false,timer:null,expires:performance.now()+this.#deadline};
    token.promise=new Promise(resolve=>{token.resolve=resolve;});this.#pending=token;
    token.timer=this.#setTimer(()=>this.#finish(token,false,'HOST_UNAVAILABLE'),this.#deadline);
    let result;
    try{result=this.#send(Object.freeze({generation,open}));}catch{this.#finish(token,false,'HOST_UNAVAILABLE');return token.promise;}
    Promise.resolve(result).then(reply=>{
      const r=record(reply,['ok','generation','open']);
      this.#finish(token,!!r&&r.ok===true&&r.generation===generation&&r.open===open,'HOST_UNAVAILABLE');
    },()=>this.#finish(token,false,'HOST_UNAVAILABLE'));
    return token.promise;
  }
}
