// Bounded control lane for the future native manager/host input fence. No PTY,
// process or caller authority. Main must bind a fresh channelId and native host
// endpoint. InputFence binds its mandatory lifetime invalidator separately from
// the optional external failure observer. Port adapter
// owns lifecycle; output data never belongs on this dedicated control lane.
import {TERMINAL_LIMITS} from './contracts.mjs';
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
function dataRecord(value,keys){
 try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
  const r=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
 }catch{return null;}
}
const refused=()=>Promise.resolve(Object.freeze({ok:false}));
export class TerminalGateLink {
 #channel;#send;#unavailable;#setTimer;#clearTimer;#deadline;#unsubscribe=null;
 #pending=new Map();#request=0;#generation=0;#closed=false;#fenceFailed=false;#inputFailure=null;
 constructor({channelId,send,subscribe,onUnavailable=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
  if(!id(channelId)||![send,subscribe,onUnavailable,setTimer,clearTimer].every(f=>typeof f==='function')||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs)throw TypeError('Bounded gate channel dependencies required');
  this.#channel=channelId;this.#send=send;this.#unavailable=onUnavailable;this.#setTimer=setTimer;this.#clearTimer=clearTimer;this.#deadline=deadlineMs;
  try{this.#unsubscribe=subscribe(Object.freeze({message:r=>this.#receive(r),closed:()=>this.dispose()}));if(typeof this.#unsubscribe!=='function')throw TypeError('Disposable gate subscription required');if(this.#closed)this.#unsubscribe();}
  catch(error){this.dispose();throw error;}
 }
 get nativeExecutionAdmitted(){return false;}
 isAvailable(){return !this.#closed;}
 subscribeUnavailable(listener){
  if(typeof listener!=='function'||this.#inputFailure)throw TypeError('One input lifetime binding per channel required');
  this.#inputFailure=listener;
  if(this.#closed)listener();
 }
 stats(){return Object.freeze({pending:this.#pending.size,closed:this.#closed,maxPending:2,failureFenceFailed:this.#fenceFailed});}
 sendGate(packet){
  const p=dataRecord(packet,['generation','open']);
  if(this.#closed||!p||!integer(p.generation)||p.generation<=this.#generation||typeof p.open!=='boolean'||this.#pending.size>=2||!integer(this.#request+1))return refused();
  // Reserve the second slot exclusively for closing behind an in-flight open.
  // While a close is pending, no new open/close can grow the transport queue.
  if(this.#pending.size&&(p.open||[...this.#pending.values()].some(t=>!t.open)))return refused();
  const requestId=++this.#request,token={requestId,generation:p.generation,open:p.open,timer:null,expires:performance.now()+this.#deadline};this.#generation=p.generation;
  token.promise=new Promise(resolve=>token.resolve=resolve);this.#pending.set(requestId,token);
  try{
   token.timer=this.#setTimer(()=>this.dispose(),this.#deadline);
   if(!this.#closed)this.#send(Object.freeze({channelId:this.#channel,requestId,generation:p.generation,open:p.open}));
  }catch{this.dispose();}
  return token.promise;
 }
 #finish(token,ok){
  // A delayed event-loop turn may deliver ACK before an overdue timer runs.
  if(ok&&performance.now()>=token.expires){this.dispose();return;}
  if(!this.#pending.delete(token.requestId))return;
  if(token.timer!==null)this.#clearTimer(token.timer);
  token.resolve(Object.freeze({ok,generation:token.generation,open:token.open}));
 }
 #receive(message){
  if(this.#closed)return;const r=dataRecord(message,['channelId','requestId','generation','open','ok']);
  if(!r||r.channelId!==this.#channel)return;const token=this.#pending.get(r.requestId);if(!token)return;
  if(r.ok!==true||r.generation!==token.generation||r.open!==token.open){this.dispose();return;}
  this.#finish(token,true);
  // A newer confirmed close dominates old open requests. Host applies gates
  // synchronously with monotonic generations, so old packets/ACK cannot reopen.
  if(!token.open)for(const old of [...this.#pending.values()])if(old.requestId<token.requestId)this.#finish(old,false);
 }
 dispose(){
  if(this.#closed)return;this.#closed=true;
  // Fence locally BEFORE publishing failure receipts to asynchronous callers.
  // Invalidate pending/cached InputFence success before external observers and
  // Promise reactions. A ledger-only observer cannot perform that invalidation.
  try{this.#inputFailure?.();}catch{this.#fenceFailed=true;}
  try{this.#unavailable();}catch{this.#fenceFailed=true;}
  for(const token of [...this.#pending.values()])this.#finish(token,false);
  try{this.#unsubscribe?.();}catch{/* Port owner still owns actual disposal. */}this.#unsubscribe=null;
 }
}

// Host-side synchronous responder. The endpoint/channel is supplied by trusted
// native bootstrap, never renderer content. Only one previous receipt is kept.
export function createGateResponder({channelId,gate,send}={}){
 if(!id(channelId)||typeof gate?.apply!=='function'||typeof send!=='function')throw TypeError('Bound gate responder required');
 let latest=0,last=null;
 return message=>{
  const p=dataRecord(message,['channelId','requestId','generation','open']);
  if(!p||p.channelId!==channelId||!integer(p.requestId)||p.requestId<1||!integer(p.generation)||typeof p.open!=='boolean')return false;
  let ok=false;
  if(p.requestId===latest&&last&&p.generation===last.generation&&p.open===last.open)ok=last.ok;
  else if(p.requestId>latest){latest=p.requestId;try{const r=dataRecord(gate.apply({generation:p.generation,open:p.open}),['ok','generation','open']);ok=!!r&&r.ok===true&&r.generation===p.generation&&r.open===p.open;}catch{ok=false;}last={generation:p.generation,open:p.open,ok};}
  const reply=Object.freeze({channelId,requestId:p.requestId,generation:p.generation,open:p.open,ok});
  try{send(reply);}catch{return false;}return ok;
 };
}
