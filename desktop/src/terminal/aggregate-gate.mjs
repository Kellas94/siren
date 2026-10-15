// Pure main-only control fan-out. No PTY, Electron, process, native loader or
// renderer authority. Trusted bootstrap must independently establish that every
// reserved creator starts fenced before it can write. Resolve only authenticated
// synchronous channel bindings; these contracts are not native qualification.
import {TERMINAL_LIMITS as limits} from './contracts.mjs';

const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=(code='HOST_UNAVAILABLE')=>Object.freeze({ok:false,code});
function fields(value,keys){
 try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
  const result={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[k]=d.value;}return result;
 }catch{return null;}
}
function method(object,key){
 try{for(let p=object;p;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d)return Object.hasOwn(d,'value')&&typeof d.value==='function'?d.value.bind(object):null;}}catch{}return null;
}
const receipt=(packet,ok)=>Object.freeze({ok,generation:packet.generation,open:packet.open});

export class TerminalAggregateGateLink {
 #resolve;#observer;#listener=null;#entries=new Map();#tokens=new Map();
 #generation=0;#open=false;#lost=false;#failureFenceFailed=false;#setTimer;#clearTimer;#deadline;
 constructor({resolveLink,onUnavailable=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,deadlineMs=limits.stopDeadlineMs}={}){
  if(![onUnavailable,setTimer,clearTimer].every(f=>typeof f==='function')||!integer(deadlineMs)||deadlineMs<1||deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded aggregate control dependencies required');
  this.#resolve=typeof resolveLink==='function'?resolveLink:null;this.#lost=!this.#resolve;
  this.#observer=onUnavailable;this.#setTimer=setTimer;this.#clearTimer=clearTimer;this.#deadline=deadlineMs;
 }
 get nativeExecutionAdmitted(){return false;}
 isAvailable(){
  if(this.#lost)return false;
  for(const e of this.#entries.values())if(e.link){try{if(e.available()===true)continue;}catch{}this.#lose();return false;}
  return true;
 }
 subscribeUnavailable(listener){
  if(typeof listener!=='function'||this.#listener)throw TypeError('One aggregate input lifetime binding required');
  this.#listener=listener;if(this.#lost)listener();
 }
 reserve(sessionId){
  if(!this.isAvailable())return fail();if(!id(sessionId)||this.#entries.has(sessionId))return fail('REQUEST_REFUSED');
  if(this.#entries.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
  this.#entries.set(sessionId,{sessionId,channelId:null,link:null,binding:false,active:new Map()});return Object.freeze({ok:true});
 }
 async bind(sessionId,channelId){
  const e=this.#entries.get(sessionId);
  if(!this.isAvailable()||!e||e.link||e.binding||!id(channelId)||[...this.#entries.values()].some(x=>x.channelId===channelId))return fail('REQUEST_REFUSED');
  e.binding=true;
  try{
   const resolved=fields(this.#resolve(sessionId,channelId),['link','initiallyClosed']);
   const send=method(resolved?.link,'sendGate'),subscribe=method(resolved?.link,'subscribeUnavailable'),available=method(resolved?.link,'isAvailable'),dispose=method(resolved?.link,'dispose');
   if(!resolved||resolved.initiallyClosed!==true||![send,subscribe,available,dispose].every(f=>typeof f==='function')||[...this.#entries.values()].some(x=>x!==e&&x.link===resolved.link)||this.#entries.get(sessionId)!==e||this.#lost)return fail('REQUEST_REFUSED');
   e.link=resolved.link;e.channelId=channelId;e.send=send;e.available=available;e.dispose=dispose;
   subscribe(()=>{if(this.#entries.get(sessionId)===e)this.#lose();});
   if(!this.isAvailable())return fail();
   const token=this.#tokens.get(this.#generation);
   let work;
   if(token){token.waiting.add(e);this.#dispatch(token,e);work=token.promise;}
   else if(this.#generation===0)work=Promise.resolve(receipt({generation:0,open:false},true));
   else work=this.#perform(e,{generation:this.#generation,open:this.#open});
   const result=await this.#bounded(work);
   return result.ok&&this.isAvailable()&&this.#entries.get(sessionId)===e?Object.freeze({ok:true}):fail();
  }catch{this.#lose();return fail();}
  finally{e.binding=false;}
 }
 // Main-only: caller has already verified the exact native owner is dead.
 // Releasing a reservation is not itself process termination or exit proof.
 release(sessionId){
  const e=this.#entries.get(sessionId);if(!e)return fail('SESSION_REFUSED');
  this.#entries.delete(sessionId);
  for(const token of this.#tokens.values()){token.waiting.delete(e);this.#maybeFinish(token);}
  try{e.dispose?.();}catch{this.#failureFenceFailed=true;}
  return Object.freeze({ok:true});
 }
 sendGate(packet){
  const p=fields(packet,['generation','open']);
  if(!this.isAvailable()||!p||!integer(p.generation)||p.generation<=this.#generation||typeof p.open!=='boolean'||this.#tokens.size>=2)return Promise.resolve(fail());
  if(this.#tokens.size&&(p.open||[...this.#tokens.values()].some(t=>!t.packet.open)))return Promise.resolve(fail());
  // A joining creator is initially closed. Do not partially open siblings
  // while its own initial gate/close handshake is unresolved.
  if(p.open&&[...this.#entries.values()].some(e=>e.binding||e.active.size))return Promise.resolve(fail());
  // Entry identity, not reusable Session ID: a released entry's delayed ACK
  // must never discharge a replacement reservation in this same barrier.
  const token={packet:Object.freeze(p),waiting:new Set([...this.#entries.values()].filter(e=>e.link)),timer:null,expires:performance.now()+this.#deadline};
  token.promise=new Promise(resolve=>token.resolve=resolve);this.#tokens.set(p.generation,token);this.#generation=p.generation;this.#open=p.open;
  token.timer=this.#setTimer(()=>this.#lose(),this.#deadline);
  for(const e of [...token.waiting])this.#dispatch(token,e);
  this.#maybeFinish(token);return token.promise;
 }
 #perform(e,packet){
  if(this.#lost||this.#entries.get(e.sessionId)!==e)return Promise.resolve(receipt(packet,false));
  const existing=e.active.get(packet.generation);if(existing)return existing.promise;
  const operation={packet,promise:null};e.active.set(packet.generation,operation);
  let work;try{work=e.send(Object.freeze({...packet}));}catch{work=Promise.reject(Error('CONTROL_SEND_FAILED'));}
  operation.promise=Promise.resolve(work).then(reply=>{
   const r=fields(reply,['ok','generation','open']);
   const ok=!!r&&r.ok===true&&r.generation===packet.generation&&r.open===packet.open;
   if(!ok&&this.#entries.get(e.sessionId)===e&&packet.generation===this.#generation)this.#lose();
   return receipt(packet,ok);
  },()=>{if(this.#entries.get(e.sessionId)===e)this.#lose();return receipt(packet,false);}).finally(()=>e.active.delete(packet.generation));
  return operation.promise;
 }
 #dispatch(token,e){
  const pendingClose=[...e.active.values()].find(op=>!op.packet.open&&op.packet.generation<token.packet.generation);
  // A real GateLink reserves its second slot for close behind open, not close
  // behind close. Queue at most this one aggregate close after a joining close.
  const work=pendingClose&&!token.packet.open?pendingClose.promise.then(()=>this.#tokens.has(token.packet.generation)?this.#perform(e,token.packet):receipt(token.packet,false)):this.#perform(e,token.packet);
  Promise.resolve(work).then(r=>{
   if(!this.#tokens.has(token.packet.generation))return;
   if(this.#entries.get(e.sessionId)!==e){token.waiting.delete(e);this.#maybeFinish(token);return;}
   if(!r.ok){if(token.packet.generation<this.#generation)this.#finish(token,false);else this.#lose();return;}
   token.waiting.delete(e);this.#maybeFinish(token);
  },()=>this.#lose());
 }
 #maybeFinish(token){
  if(!this.#tokens.has(token.packet.generation)||token.waiting.size)return;
  this.#finish(token,!this.#lost&&token.packet.generation===this.#generation);
 }
 #finish(token,ok){
  if(ok&&performance.now()>=token.expires){this.#lose();return;}
  if(!this.#tokens.delete(token.packet.generation))return;
  if(token.timer!==null)this.#clearTimer(token.timer);token.resolve(receipt(token.packet,ok));
  if(ok&&!token.packet.open)for(const old of [...this.#tokens.values()])if(old.packet.generation<token.packet.generation)this.#finish(old,false);
 }
 #bounded(work){
  return new Promise(resolve=>{
   const expires=performance.now()+this.#deadline;
   let done=false;const finish=r=>{if(done)return;done=true;this.#clearTimer(timer);if(performance.now()>=expires){this.#lose();resolve(fail());}else resolve(r);};
   const timer=this.#setTimer(()=>{this.#lose();finish(fail());},this.#deadline);
   Promise.resolve(work).then(finish,()=>{this.#lose();finish(fail());});
  });
 }
 #lose(){
  if(this.#lost)return;this.#lost=true;this.#open=false;
  try{this.#listener?.();}catch{this.#failureFenceFailed=true;}
  if(integer(this.#generation+1)){
   const packet=Object.freeze({generation:++this.#generation,open:false});
   for(const e of this.#entries.values())if(e.link)try{Promise.resolve(e.send(packet)).catch(()=>{});}catch{this.#failureFenceFailed=true;}
  }
  try{this.#observer();}catch{this.#failureFenceFailed=true;}
  for(const token of [...this.#tokens.values()])this.#finish(token,false);
 }
 dispose(){this.#lose();for(const e of this.#entries.values())try{e.dispose?.();}catch{this.#failureFenceFailed=true;}}
 stats(){return Object.freeze({sessions:this.#entries.size,bound:[...this.#entries.values()].filter(e=>e.link).length,binding:[...this.#entries.values()].filter(e=>e.binding).length,pending:this.#tokens.size,maxPending:2,generation:this.#generation,open:this.#open,closed:this.#lost,failureFenceFailed:this.#failureFenceFailed});}
}
