// Additive UNWIRED production history/credit pool. SOURCE_ONLY / NOT_ADMITTED.
// Output worker settlement is bookkeeping authority, never native release proof.
import {TerminalOutputCredits} from './credits.mjs';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';
import {types} from 'node:util';
const NativePromise=Promise,promisePrototype=Promise.prototype,promiseThen=Promise.prototype.then,species=Object.getOwnPropertyDescriptor(Promise,Symbol.species);
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0;
const fail=code=>Object.freeze({ok:false,code});
const pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
const resolved=value=>new NativePromise(resolve=>resolve(value));
function environment(){const c=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species.get&&s.set===species.set&&!Object.hasOwn(s,'value');}
function observable(value){return !!value&&typeof value==='object'&&!types.isProxy(value)&&types.isPromise(value)&&Object.getPrototypeOf(value)===promisePrototype&&!Object.hasOwn(value,'constructor')&&environment();}
function record(value,keys){
 try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;}catch{return null;}
}
export class TerminalProductionRemoteOutput {
 #sources=new Map();#retiring=new Set();#credits=new TerminalOutputCredits();#closed=true;#generation=0;#viewEpoch=0;#deadlineMs;#reserved=0;
 constructor({deadlineMs=limits.stopDeadlineMs}={}){if(!uint(deadlineMs)||deadlineMs<1||deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded deadline required');this.#deadlineMs=deadlineMs;}
 get nativeExecutionAdmitted(){return false;}
 #retained(){return [...this.#sources.values(),...this.#retiring];}
 #find(sessionId){return this.#sources.get(sessionId)??[...this.#retiring].find(s=>s.sessionId===sessionId);}
 #frame(s,run){s.frames++;try{return run();}finally{s.frames--;this.#finish(s);}}
 // Unnormalized public token reflection can reenter any retained source.
 #frames(run){const sources=this.#retained();for(const s of sources)s.frames++;try{return run();}finally{for(const s of sources)s.frames--;for(const s of sources)this.#finish(s);}}
 #observation(s){
  s.frames=0;s.takeWorkers=0;s.continuations=0;s.unknown=false;s.actualDone=false;
  s.read={entered:false,pending:false,handlerSettled:false,unknown:false,mode:null,work:null};
  s.handle=Object.freeze({sessionId:s.sessionId,actualSettled:new NativePromise(resolve=>s.actualResolve=resolve),snapshot:()=>Object.freeze({sessionId:s.sessionId,retired:s.retired,actualSettled:s.actualDone,unknown:s.unknown,activeFrames:s.frames,takeWorkers:s.takeWorkers,continuations:s.continuations,reservedUtf8Bytes:s.pending?.maxBytes??0,read:Object.freeze({entered:s.read.entered,pending:s.read.pending,handlerSettled:s.read.handlerSettled,unknown:s.read.unknown,mode:s.read.mode}),nativeExecutionAdmitted:false})});
 }
 captureSourceSettlement(sessionId,...extra){return !extra.length&&id(sessionId)?this.#find(sessionId)?.handle??null:null;}
 captureSourceSettlementRoster(...extra){return extra.length?null:Object.freeze(this.#retained().map(s=>s.handle));}
 #finish(s){
  if(s.actualDone||!s.retired||s.frames||s.takeWorkers||s.continuations||s.unknown||s.read.pending||s.pending||s.attachment)return;
  s.actualDone=true;s.reader=null;s.read.work=null;this.#retiring.delete(s);
  const resolve=s.actualResolve;s.actualResolve=null;resolve(Object.freeze({scope:'OUTPUT_POOL_SOURCE',sessionId:s.sessionId,actualSettled:true,nativeExecutionAdmitted:false}));
 }
 register(sessionId,reader){
  if(!id(sessionId)||typeof reader!=='function'||this.#sources.has(sessionId))return fail('REQUEST_REFUSED');
  if(this.#sources.size+this.#retiring.size>=limits.sessions||[...this.#retiring].some(s=>s.sessionId===sessionId))return fail('CAPACITY_EXCEEDED');
  const s={sessionId,reader,attachment:null,pending:null,available:true,retired:false};this.#observation(s);this.#sources.set(sessionId,s);return pass({sessionId});
 }
 attach(sessionId,request){
  const s=this.#sources.get(sessionId);if(!s||!s.available)return fail('HOST_UNAVAILABLE');
  return this.#frame(s,()=>{
   if(this.#closed)return fail('PIN_REQUIRED');const epoch=this.#viewEpoch,r=record(request,['leaseId','generation','fromSequence']);if(!r||!id(r.leaseId)||!uint(r.generation)||!uint(r.fromSequence))return fail('REQUEST_REFUSED');
   if(this.#closed)return fail('PIN_REQUIRED');if(this.#viewEpoch!==epoch||this.#sources.get(sessionId)!==s||!s.available)return fail('LEASE_STALE');if(r.generation<=this.#generation)return fail('LEASE_STALE');
   if([...this.#sources.values()].some(o=>o!==s&&o.attachment?.leaseId===r.leaseId))return fail('REQUEST_REFUSED');
   if(s.attachment)this.#detach(s);const credits=this.#credits.attach(r.leaseId,r.fromSequence);if(!credits.ok)return credits;
   this.#generation=r.generation;s.attachment={sessionId,leaseId:r.leaseId,generation:r.generation,cursor:r.fromSequence,bytes:0};return pass({sessionId,leaseId:r.leaseId,generation:r.generation});
  });
 }
 #lookup(token){return this.#frames(()=>{const epoch=this.#viewEpoch,r=record(token,['sessionId','leaseId','generation']);if(!r||this.#closed||epoch!==this.#viewEpoch)return null;const s=this.#sources.get(r.sessionId),a=s?.attachment;return a&&a.leaseId===r.leaseId&&a.generation===r.generation?{s,a}:null;});}
 take(token){return this.#take(token,false);}
 takeWithBounds(token){return this.#take(token,true);}
 #take(token,includeBounds){return this.#frames(()=>{
  const found=this.#lookup(token);if(!found)return resolved(fail('LEASE_STALE'));const {s,a}=found;if(!s.available)return resolved(fail('HOST_UNAVAILABLE'));if(s.pending||s.read.pending||s.continuations)return resolved(fail('CAPACITY_EXCEEDED'));
  const maxBytes=Math.min(limits.outputBytes,limits.attachmentOutputBytes-a.bytes,limits.hostOutputBytes-this.#credits.stats().outstandingUtf8Bytes-this.#reserved);
  if(maxBytes<4||this.#credits.stats().frames>=limits.sessions*256)return resolved(fail('CAPACITY_EXCEEDED'));
  let deliver;const completion=new NativePromise(resolve=>deliver=resolve);let delivered=false,released=false;s.takeWorkers++;
  const pending={maxBytes,expires:performance.now()+this.#deadlineMs,result:null,finish:r=>this.#frame(s,()=>{if(!delivered){delivered=true;deliver(r);s.takeWorkers--;}})};
  s.pending=pending;this.#reserved+=maxBytes;
  pending.timer=setTimeout(()=>this.#frame(s,()=>{s.available=false;pending.finish(fail('HOST_UNAVAILABLE'));}),this.#deadlineMs);
  const release=()=>{if(released)return;released=true;clearTimeout(pending.timer);this.#reserved-=maxBytes;if(s.pending===pending)s.pending=null;};
  const finishSettled=r=>{pending.result=r;};
  const unknown=()=>{s.available=false;s.unknown=true;s.read.unknown=true;s.read.mode='unknown';pending.finish(fail('HOST_UNAVAILABLE'));};
  const read={entered:false,pending:true,handlerSettled:false,unknown:false,mode:null,work:null};s.read=read;
  // Refusal before provider entry is a known local attempt, not invented work.
  if(!environment()){s.available=false;read.pending=false;read.handlerSettled=true;release();pending.finish(fail('HOST_UNAVAILABLE'));return completion;}
  let reply;read.entered=true;try{reply=s.reader(Object.freeze({sessionId:s.sessionId,fromSequence:a.cursor,maxBytes}));read.work=reply;}catch{unknown();return completion;}
  const accepted=value=>{
   if(this.#lookup(token)?.a!==a){finishSettled(fail('LEASE_STALE'));return;}
   if(!s.available||performance.now()>=pending.expires){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   const r=this.#validate(value,a.cursor,maxBytes);if(!r){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   if(this.#lookup(token)?.a!==a){finishSettled(fail('LEASE_STALE'));return;}
   if(!s.available||performance.now()>=pending.expires){s.available=false;finishSettled(fail('HOST_UNAVAILABLE'));return;}
   let gap=null;if(a.cursor<r.firstSequence){if(!this.#credits.advanceToRetained(a.leaseId,r.firstSequence).ok){finishSettled(fail('CAPACITY_EXCEEDED'));return;}gap=Object.freeze({fromSequence:a.cursor,resumeSequence:r.firstSequence,droppedUtf8Bytes:r.firstSequence-a.cursor,marker:`Terminal history omitted: ${r.firstSequence-a.cursor} UTF-8 bytes.`,resetParser:true});a.cursor=r.firstSequence;}
   if(r.chunk){const reserved=this.#credits.reserve(a.leaseId,r.chunk);if(!reserved.ok){finishSettled(reserved);return;}a.cursor=r.chunk.sequence+r.chunk.utf8Bytes;a.bytes+=r.chunk.utf8Bytes;}
   finishSettled(pass(includeBounds?{firstSequence:r.firstSequence,endSequence:r.endSequence,chunk:r.chunk,gap}:{chunk:r.chunk,gap}));
  };
  const rejected=()=>{s.available=false;finishSettled(fail(this.#lookup(token)?.a===a?'HOST_UNAVAILABLE':'LEASE_STALE'));};
  if(types.isPromise(reply)){
   read.mode='native-promise';if(!observable(reply)){unknown();return completion;}
   // Attach the finite chain before callbacks run. No await/return assimilates
   // the original outcome. Observer handlers always return undefined.
   s.continuations++;
   try{
    const handled=this.#observe(s,reply,accepted,rejected);
    const unwound=this.#observe(s,handled,()=>{release();read.handlerSettled=true;},()=>{rejected();release();read.handlerSettled=true;});
    this.#observe(s,unwound,()=>{read.pending=false;read.work=null;s.continuations--;release();pending.finish(pending.result??fail('HOST_UNAVAILABLE'));},()=>{unknown();});
   }catch{unknown();}
  }else{
   // Direct synchronous DTO readers remain supported without assimilation.
   read.mode='sync-data';try{this.#frame(s,()=>accepted(reply));}catch{this.#frame(s,rejected);}
   read.handlerSettled=true;read.pending=false;read.work=null;release();pending.finish(pending.result??fail('HOST_UNAVAILABLE'));
  }
  return completion;
 });}
 #observe(s,work,ok,bad){if(!observable(work))throw Error('Native output Promise required');return Reflect.apply(promiseThen,work,[v=>{this.#frame(s,()=>ok(v));},v=>{this.#frame(s,()=>bad(v));}]);}
 #validate(value,cursor,maxBytes){
  const r=record(value,['firstSequence','endSequence','chunk']);if(!r||!uint(r.firstSequence)||!uint(r.endSequence)||r.firstSequence>r.endSequence||cursor>r.endSequence)return null;
  const start=Math.max(cursor,r.firstSequence);if(r.chunk===null)return start===r.endSequence?r:null;
  const c=record(r.chunk,['sequence','data','utf8Bytes']);if(!c||c.sequence!==start||typeof c.data!=='string'||c.data.length>maxBytes||!c.data.isWellFormed()||!uint(c.utf8Bytes)||c.utf8Bytes<1||c.utf8Bytes>maxBytes||Buffer.byteLength(c.data)!==c.utf8Bytes||!uint(c.sequence+c.utf8Bytes)||c.sequence+c.utf8Bytes>r.endSequence)return null;r.chunk=Object.freeze({...c});return r;
 }
 ack(token,throughSequence){return this.#frames(()=>{const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');const result=this.#credits.ack(found.a.leaseId,throughSequence);if(result.ok)found.a.bytes-=result.value.releasedUtf8Bytes;return result;});}
 #detach(s){this.#credits.detach(s.attachment.leaseId);s.attachment=null;s.pending?.finish(fail('LEASE_STALE'));}
 detach(token){return this.#frames(()=>{const found=this.#lookup(token);if(!found)return fail('LEASE_STALE');this.#detach(found.s);return pass({detached:true});});}
 suspendViews(){return this.#frames(()=>{this.#closed=true;this.#viewEpoch++;for(const s of this.#sources.values())if(s.attachment)this.#detach(s);return pass({viewsSuspended:true});});}
 resumeViews(){return this.#frames(()=>{this.#closed=false;return pass({viewsSuspended:false});});}
 // Trusted caller establishes retirement; this conveys no native cleanup proof.
 retire(sessionId){const s=this.#sources.get(sessionId);if(!s)return fail('SESSION_REFUSED');return this.#frame(s,()=>{if(s.attachment)this.#detach(s);s.available=false;s.retired=true;this.#sources.delete(sessionId);this.#retiring.add(s);return pass({sessionId});});}
 sourceStatus(sessionId){if(!id(sessionId))return null;const current=this.#sources.get(sessionId),s=current??this.#find(sessionId);return s?Object.freeze({registered:!!current,retiring:!current,pendingRead:s.pending!==null}):null;}
 stats(){return Object.freeze({sessions:this.#sources.size,retiringCreators:this.#retiring.size,pendingRequests:this.#retained().filter(s=>s.pending).length,reservedUtf8Bytes:this.#reserved,retainedUtf8Bytes:0,...this.#credits.stats()});}
}
