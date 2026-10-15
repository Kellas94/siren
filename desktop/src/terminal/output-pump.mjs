// Pure composition of bounded history and delivery credits. No PTY, transport,
// process, renderer grant or execution authority. Future native manager binds
// caller/project/epoch and attachment lease before invoking these methods.
import {createOutputRing} from './output.mjs';
import {TerminalOutputCredits} from './credits.mjs';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=code=>Object.freeze({ok:false,code});
const pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
function dataRecord(value,keys){
 try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
  const result=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
 }catch{return null;}
}
export class TerminalOutputPump {
 #sessions=new Map();#credits=new TerminalOutputCredits();#closed=true;#generation=0;
 get nativeExecutionAdmitted(){return false;}
 register(sessionId){
  if(!id(sessionId)||this.#sessions.has(sessionId))return fail('REQUEST_REFUSED');
  if(this.#sessions.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
  this.#sessions.set(sessionId,{ring:createOutputRing(),attachment:null});return pass({sessionId});
 }
 append(sessionId,data){
  const s=this.#sessions.get(sessionId);if(!s)return fail('SESSION_REFUSED');
  try{return pass(s.ring.append(data));}catch{return fail('REQUEST_REFUSED');}
 }
 attach(sessionId,request){
  const s=this.#sessions.get(sessionId);if(!s)return fail('SESSION_REFUSED');if(this.#closed)return fail('PIN_REQUIRED');
  const r=dataRecord(request,['leaseId','generation','fromSequence']);
  if(!r||!id(r.leaseId)||!integer(r.generation)||!integer(r.fromSequence))return fail('REQUEST_REFUSED');
  if(r.generation<=this.#generation)return fail('LEASE_STALE');
  if([...this.#sessions.values()].some(other=>other!==s&&other.attachment?.leaseId===r.leaseId))return fail('REQUEST_REFUSED');
  // Validate the requested cursor BEFORE replacing a valid current attachment.
  try{s.ring.read({fromSequence:r.fromSequence,maxBytes:1});}catch{return fail('REQUEST_REFUSED');}
  if(s.attachment)this.#credits.detach(s.attachment.leaseId);
  const attached=this.#credits.attach(r.leaseId,r.fromSequence);if(!attached.ok)throw Error('OUTPUT_CREDIT_INVARIANT');
  this.#generation=r.generation;s.attachment={sessionId,leaseId:r.leaseId,generation:r.generation,cursor:r.fromSequence};
  return pass({sessionId,leaseId:r.leaseId,generation:r.generation});
 }
 #lookup(token){
  const r=dataRecord(token,['sessionId','leaseId','generation']);if(!r)return null;
  const s=this.#sessions.get(r.sessionId),a=s?.attachment;
  return a&&a.leaseId===r.leaseId&&a.generation===r.generation?{s,a}:null;
 }
 take(token){
  const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');const {s,a}=found;
  const read=s.ring.read({fromSequence:a.cursor});
  if(read.gap){
   // A history gap cannot silently refund deliveries still awaiting renderer ACK.
   const advanced=this.#credits.advanceToRetained(a.leaseId,read.firstSequence);
   if(!advanced.ok)return fail('CAPACITY_EXCEEDED');a.cursor=read.firstSequence;
  }
  const chunk=read.chunks[0]??null;
  if(chunk){const reserved=this.#credits.reserve(a.leaseId,{sequence:chunk.sequence,utf8Bytes:chunk.utf8Bytes});if(!reserved.ok)return reserved;a.cursor=chunk.sequence+chunk.utf8Bytes;}
  return pass({chunk:chunk?Object.freeze(chunk):null,gap:read.gap?Object.freeze(read.gap):null});
 }
 ack(token,throughSequence){const found=this.#lookup(token);return found?this.#credits.ack(found.a.leaseId,throughSequence):fail('LEASE_STALE');}
 detach(token){const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');const r=this.#credits.detach(found.a.leaseId);found.s.attachment=null;return r;}
 suspendViews(){this.#closed=true;for(const s of this.#sessions.values()){if(s.attachment)this.#credits.detach(s.attachment.leaseId);s.attachment=null;}return pass({viewsSuspended:true});}
 resumeViews(){this.#closed=false;return pass({viewsSuspended:false});}
  clear(sessionId){const s=this.#sessions.get(sessionId);return s?pass(s.ring.clear()):fail('SESSION_REFUSED');}
  // Main-only retirement follows verified owner cleanup; it releases this
  // ring and its own credits without changing any sibling's delivery budget.
  retire(sessionId){const s=this.#sessions.get(sessionId);if(!s)return fail('SESSION_REFUSED');if(s.attachment)this.#credits.detach(s.attachment.leaseId);this.#sessions.delete(sessionId);return pass({sessionId});}
  sessionStats(sessionId){const s=this.#sessions.get(sessionId);return s?Object.freeze(s.ring.stats()):null;}
 stats(){const rings=[...this.#sessions.values()].map(s=>s.ring.stats());return Object.freeze({sessions:rings.length,retainedUtf8Bytes:rings.reduce((n,r)=>n+r.retainedUtf8Bytes,0),allocatedBytes:rings.reduce((n,r)=>n+r.allocatedBytes,0),droppedUtf8Bytes:rings.reduce((n,r)=>n+r.droppedUtf8Bytes,0),...this.#credits.stats()});}
}
