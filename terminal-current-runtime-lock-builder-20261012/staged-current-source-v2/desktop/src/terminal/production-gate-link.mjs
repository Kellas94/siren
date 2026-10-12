// Additive pure gate candidate. No native execution or process/peer admission.
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {TERMINAL_LIMITS} from './contracts.mjs';
const NativePromise=Promise;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const callable=v=>typeof v==='function'&&!types.isProxy(v);
const refused=()=>NativePromise.resolve(Object.freeze({ok:false}));
const bad=()=>TypeError('Bounded production gate DATA dependencies required');
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const result=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[k]=d.value;}return result;
}
function options(value,allowed){
 if(!value||typeof value!=='object'||types.isProxy(value))throw bad();const keys=Reflect.ownKeys(value);if(keys.some(k=>!allowed.includes(k)))throw bad();const r=fields(value,keys);if(!r)throw bad();return r;
}
function method(value,key){
 if(!value||typeof value!=='object'||types.isProxy(value))throw bad();
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw bad();const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(!Object.hasOwn(d,'value')||!callable(d.value))throw bad();return d.value;}}throw bad();
}
export class ProductionGateLink {
 #channel;#send;#observer;#setTimer;#clearTimer;#deadline;#unsubscribe=null;
 #pending=new Map();#request=0;#generation=0;#closed=false;#fenceFailed=false;#listener=null;
 constructor(value,...extra){
  if(extra.length)throw bad();const r=options(value,['channelId','send','subscribe','onUnavailable','setTimer','clearTimer','deadlineMs']);
  const observer=r.onUnavailable===undefined?()=>{}:r.onUnavailable,set=r.setTimer===undefined?setTimeout:r.setTimer,clear=r.clearTimer===undefined?clearTimeout:r.clearTimer,deadline=r.deadlineMs===undefined?TERMINAL_LIMITS.stopDeadlineMs:r.deadlineMs;
  if(!id(r.channelId)||![r.send,r.subscribe,observer,set,clear].every(callable)||!integer(deadline)||deadline<1||deadline>TERMINAL_LIMITS.stopDeadlineMs)throw bad();
  this.#channel=r.channelId;this.#send=r.send;this.#observer=observer;this.#setTimer=set;this.#clearTimer=clear;this.#deadline=deadline;
  try{
   const unsubscribe=Reflect.apply(r.subscribe,undefined,[Object.freeze({message:v=>this.#receive(v),closed:()=>this.#close()})]);
   if(!callable(unsubscribe))throw bad();if(this.#closed){try{Reflect.apply(unsubscribe,undefined,[]);}catch{this.#fenceFailed=true;}}else this.#unsubscribe=unsubscribe;
  }catch{this.#close();throw bad();}
 }
 get nativeExecutionAdmitted(){return false;}
 isAvailable(){return !this.#closed;}
 subscribeUnavailable(listener){if(!callable(listener)||this.#listener)throw bad();this.#listener=listener;if(this.#closed)Reflect.apply(listener,undefined,[]);}
 sendGate(value){
  const p=fields(value,['generation','open']);
  if(this.#closed||!p||!integer(p.generation)||p.generation<=this.#generation||typeof p.open!=='boolean'||this.#pending.size>=2||!integer(this.#request+1))return refused();
  if(this.#pending.size&&(p.open||[...this.#pending.values()].some(t=>!t.open)))return refused();
  const token={requestId:++this.#request,generation:p.generation,open:p.open,timer:null,expires:performance.now()+this.#deadline,sending:true,ack:false};this.#generation=p.generation;
  token.promise=new NativePromise(resolve=>token.resolve=resolve);this.#pending.set(token.requestId,token);
  try{
   const timer=Reflect.apply(this.#setTimer,undefined,[()=>this.#close(),this.#deadline]);
   if(this.#closed||!this.#pending.has(token.requestId)){try{Reflect.apply(this.#clearTimer,undefined,[timer]);}catch{this.#fenceFailed=true;}return token.promise;}
   token.timer=timer;Reflect.apply(this.#send,undefined,[Object.freeze({channelId:this.#channel,requestId:token.requestId,generation:token.generation,open:token.open})]);
   token.sending=false;if(token.ack)this.#confirm(token);
  }catch{token.sending=false;this.#close();}
  return token.promise;
 }
 #finish(token,ok){
  if(!this.#pending.has(token.requestId))return;
  if(ok&&(this.#closed||performance.now()>=token.expires)){this.#close();return;}
  if(token.timer!==null){const timer=token.timer;token.timer=null;try{Reflect.apply(this.#clearTimer,undefined,[timer]);}catch{this.#fenceFailed=true;this.#close();}}
  if(ok&&(this.#closed||performance.now()>=token.expires)){this.#close();return;}
  if(!this.#pending.delete(token.requestId))return;
  token.resolve(Object.freeze({ok:ok&&!this.#closed&&performance.now()<token.expires,generation:token.generation,open:token.open}));
 }
 #confirm(token){
  if(!this.#pending.has(token.requestId))return;if(this.#closed||performance.now()>=token.expires){this.#close();return;}
  this.#finish(token,true);
  if(!this.#closed&&!token.open)for(const old of [...this.#pending.values()])if(old.requestId<token.requestId)this.#finish(old,false);
 }
 #receive(value){
  if(this.#closed)return;const r=fields(value,['channelId','requestId','generation','open','ok']);if(!r||r.channelId!==this.#channel)return;
  const token=this.#pending.get(r.requestId);if(!token)return;
  if(r.ok!==true||r.generation!==token.generation||r.open!==token.open||performance.now()>=token.expires){this.#close();return;}
  token.ack=true;if(!token.sending)this.#confirm(token);
 }
 #close(){
  if(this.#closed)return;this.#closed=true;
  try{if(this.#listener)Reflect.apply(this.#listener,undefined,[]);}catch{this.#fenceFailed=true;}
  try{Reflect.apply(this.#observer,undefined,[]);}catch{this.#fenceFailed=true;}
  for(const token of [...this.#pending.values()])this.#finish(token,false);
  const unsubscribe=this.#unsubscribe;this.#unsubscribe=null;try{if(unsubscribe)Reflect.apply(unsubscribe,undefined,[]);}catch{this.#fenceFailed=true;}
 }
 dispose(){this.#close();}
 stats(){return Object.freeze({pending:this.#pending.size,closed:this.#closed,maxPending:2,failureFenceFailed:this.#fenceFailed});}
}

export function createProductionGateResponder(value){
 const r=fields(value,['channelId','gate','send']);if(!r||!id(r.channelId)||!callable(r.send))throw bad();const apply=method(r.gate,'apply');let latest=0,last=null,busy=false;
 return value=>{
  const p=fields(value,['channelId','requestId','generation','open']);if(busy||!p||p.channelId!==r.channelId||!integer(p.requestId)||p.requestId<1||!integer(p.generation)||typeof p.open!=='boolean')return false;
  busy=true;let ok=false;
  try{
   if(p.requestId===latest&&last&&p.generation===last.generation&&p.open===last.open)ok=last.ok;
   else if(p.requestId>latest){latest=p.requestId;try{const result=fields(Reflect.apply(apply,r.gate,[{generation:p.generation,open:p.open}]),['ok','generation','open']);ok=!!result&&result.ok===true&&result.generation===p.generation&&result.open===p.open;}catch{ok=false;}last={generation:p.generation,open:p.open,ok};}
   Reflect.apply(r.send,undefined,[Object.freeze({channelId:r.channelId,requestId:p.requestId,generation:p.generation,open:p.open,ok})]);return ok;
  }catch{return false;}finally{busy=false;}
 };
}
