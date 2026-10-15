// Source preparation: one creator history, no main-side history copy.
// Injected readers require separately authenticated/native-bound plumbing.
import {createOutputRing,VtBudgetFilter} from './output.mjs';
import {TerminalOutputCredits} from './credits.mjs';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0;
const fail=code=>Object.freeze({ok:false,code});
const pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
function record(value,keys){
 try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;}catch{return null;}
}
export class TerminalCreatorHistory {
 #session;#ring=createOutputRing();#filter=new VtBudgetFilter();
 constructor(sessionId){if(!id(sessionId))throw TypeError('Session required');this.#session=sessionId;}
 get nativeExecutionAdmitted(){return false;}
 append(data){
  try{const filtered=this.#filter.push(data);for(const chunk of filtered.chunks)this.#ring.append(chunk);if(filtered.marker)this.#ring.append('\r\n['+filtered.marker+']\r\n');return pass(this.stats());}catch{return fail('REQUEST_REFUSED');}
 }
 read(request){
  const r=record(request,['sessionId','fromSequence','maxBytes']);
  if(!r||r.sessionId!==this.#session||!uint(r.fromSequence)||!uint(r.maxBytes)||r.maxBytes<4||r.maxBytes>limits.outputBytes)return fail('REQUEST_REFUSED');
  try{const result=this.#ring.read(r);return Object.freeze({firstSequence:result.firstSequence,endSequence:result.endSequence,chunk:result.chunks[0]?Object.freeze(result.chunks[0]):null});}catch{return fail('REQUEST_REFUSED');}
 }
 clear(){this.#filter.reset();return pass(this.#ring.clear());}
 stats(){return Object.freeze({...this.#ring.stats(),pendingVtUtf8Bytes:this.#filter.stats().pendingUtf8Bytes,omittedSequences:this.#filter.stats().totalOmittedSequences});}
}

export class TerminalRemoteOutput {
 #sources=new Map();#retiring=new Set();#credits=new TerminalOutputCredits();#closed=true;#generation=0;#viewEpoch=0;#deadlineMs;#reserved=0;
 constructor({deadlineMs=limits.stopDeadlineMs}={}){if(!uint(deadlineMs)||deadlineMs<1||deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded deadline required');this.#deadlineMs=deadlineMs;}
 get nativeExecutionAdmitted(){return false;}
 register(sessionId,reader){
  if(!id(sessionId)||typeof reader!=='function'||this.#sources.has(sessionId))return fail('REQUEST_REFUSED');
  if(this.#sources.size+this.#retiring.size>=limits.sessions||[...this.#retiring].some(s=>s.sessionId===sessionId))return fail('CAPACITY_EXCEEDED');
  this.#sources.set(sessionId,{sessionId,reader,attachment:null,pending:null,available:true,retired:false});return pass({sessionId});
 }
 attach(sessionId,request){
  const s=this.#sources.get(sessionId);if(!s||!s.available)return fail('HOST_UNAVAILABLE');if(this.#closed)return fail('PIN_REQUIRED');
  const epoch=this.#viewEpoch,r=record(request,['leaseId','generation','fromSequence']);if(!r||!id(r.leaseId)||!uint(r.generation)||!uint(r.fromSequence))return fail('REQUEST_REFUSED');
  // Reflection can invoke Proxy hooks. Recheck authority after normalization.
  if(this.#closed)return fail('PIN_REQUIRED');if(this.#viewEpoch!==epoch||this.#sources.get(sessionId)!==s||!s.available)return fail('LEASE_STALE');if(r.generation<=this.#generation)return fail('LEASE_STALE');
  if([...this.#sources.values()].some(o=>o!==s&&o.attachment?.leaseId===r.leaseId))return fail('REQUEST_REFUSED');
  if(s.attachment)this.#detach(s);
  const credits=this.#credits.attach(r.leaseId,r.fromSequence);if(!credits.ok)return credits;
  this.#generation=r.generation;s.attachment={sessionId,leaseId:r.leaseId,generation:r.generation,cursor:r.fromSequence,bytes:0};return pass({sessionId,leaseId:r.leaseId,generation:r.generation});
 }
 #lookup(token){const epoch=this.#viewEpoch,r=record(token,['sessionId','leaseId','generation']);if(!r||this.#closed||epoch!==this.#viewEpoch)return null;const s=this.#sources.get(r.sessionId),a=s?.attachment;return a&&a.leaseId===r.leaseId&&a.generation===r.generation?{s,a}:null;}
 async take(token){
  const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');const {s,a}=found;if(!s.available)return fail('HOST_UNAVAILABLE');if(s.pending)return fail('CAPACITY_EXCEEDED');
  const maxBytes=Math.min(limits.outputBytes,limits.attachmentOutputBytes-a.bytes,limits.hostOutputBytes-this.#credits.stats().outstandingUtf8Bytes-this.#reserved);
  if(maxBytes<4||this.#credits.stats().frames>=limits.sessions*256)return fail('CAPACITY_EXCEEDED');
  let deliver;const completion=new Promise(resolve=>deliver=resolve);let delivered=false;
  const pending={maxBytes,expires:performance.now()+this.#deadlineMs,finish:r=>{if(!delivered){delivered=true;deliver(r);}}};
  s.pending=pending;this.#reserved+=maxBytes;
  pending.timer=setTimeout(()=>{s.available=false;pending.finish(fail('HOST_UNAVAILABLE'));},this.#deadlineMs);
  let released=false;const release=()=>{if(released)return;released=true;clearTimeout(pending.timer);this.#reserved-=maxBytes;s.pending=null;if(s.retired)this.#retiring.delete(s);};
  const finishSettled=r=>{release();pending.finish(r);};
  let reply;try{reply=s.reader(Object.freeze({sessionId:s.sessionId,fromSequence:a.cursor,maxBytes}));}catch{reply=Promise.reject(Error('READER_FAILED'));}
  Promise.resolve(reply).then(value=>{
   if(this.#lookup(token)?.a!==a){finishSettled(fail('LEASE_STALE'));return;}
   if(!s.available||performance.now()>=pending.expires){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   const r=this.#validate(value,a.cursor,maxBytes);if(!r){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   // A reply Proxy may replace/Lock the attachment while being normalized.
   if(this.#lookup(token)?.a!==a){finishSettled(fail('LEASE_STALE'));return;}
   if(!s.available||performance.now()>=pending.expires){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   let gap=null;
   if(a.cursor<r.firstSequence){
    if(!this.#credits.advanceToRetained(a.leaseId,r.firstSequence).ok){finishSettled(fail('CAPACITY_EXCEEDED'));return;}
    gap=Object.freeze({fromSequence:a.cursor,resumeSequence:r.firstSequence,droppedUtf8Bytes:r.firstSequence-a.cursor,marker:`Terminal history omitted: ${r.firstSequence-a.cursor} UTF-8 bytes.`,resetParser:true});a.cursor=r.firstSequence;
   }
   if(r.chunk){const reserved=this.#credits.reserve(a.leaseId,r.chunk);if(!reserved.ok){finishSettled(reserved);return;}a.cursor=r.chunk.sequence+r.chunk.utf8Bytes;a.bytes+=r.chunk.utf8Bytes;}
   finishSettled(pass({chunk:r.chunk,gap}));
  },()=>{s.available=false;finishSettled(fail(this.#lookup(token)?.a===a?'HOST_UNAVAILABLE':'LEASE_STALE'));}).catch(()=>{s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));}).finally(release);
  return completion;
 }
 #validate(value,cursor,maxBytes){
  const r=record(value,['firstSequence','endSequence','chunk']);if(!r||!uint(r.firstSequence)||!uint(r.endSequence)||r.firstSequence>r.endSequence||cursor>r.endSequence)return null;
  const start=Math.max(cursor,r.firstSequence);if(r.chunk===null)return start===r.endSequence?r:null;
  const c=record(r.chunk,['sequence','data','utf8Bytes']);if(!c||c.sequence!==start||typeof c.data!=='string'||c.data.length>maxBytes||!c.data.isWellFormed()||!uint(c.utf8Bytes)||c.utf8Bytes<1||c.utf8Bytes>maxBytes||Buffer.byteLength(c.data)!==c.utf8Bytes||!uint(c.sequence+c.utf8Bytes)||c.sequence+c.utf8Bytes>r.endSequence)return null;
  r.chunk=Object.freeze({...c});return r;
 }
 ack(token,throughSequence){const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');const result=this.#credits.ack(found.a.leaseId,throughSequence);if(result.ok)found.a.bytes-=result.value.releasedUtf8Bytes;return result;}
 #detach(s){this.#credits.detach(s.attachment.leaseId);s.attachment=null;s.pending?.finish(fail('LEASE_STALE'));}
 detach(token){const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');this.#detach(found.s);return pass({detached:true});}
 suspendViews(){this.#closed=true;this.#viewEpoch++;for(const s of this.#sources.values())if(s.attachment)this.#detach(s);return pass({viewsSuspended:true});}
 resumeViews(){this.#closed=false;return pass({viewsSuspended:false});}
 // Trusted caller must first establish owner retirement; this method does not.
 retire(sessionId){const s=this.#sources.get(sessionId);if(!s)return fail('SESSION_REFUSED');if(s.attachment)this.#detach(s);s.available=false;s.retired=true;this.#sources.delete(sessionId);if(s.pending)this.#retiring.add(s);return pass({sessionId});}
 stats(){return Object.freeze({sessions:this.#sources.size,retiringCreators:this.#retiring.size,pendingRequests:[...this.#sources.values(),...this.#retiring].filter(s=>s.pending).length,reservedUtf8Bytes:this.#reserved,retainedUtf8Bytes:0,...this.#credits.stats()});}
}
