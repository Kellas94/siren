// Additive UNWIRED private history facet. SOURCE_ONLY / NOT_ADMITTED.
// Output receipts describe local work, never native release or renderer delivery.
import {types} from 'node:util';
import {TerminalProductionRemoteOutput} from './production-remote-output.mjs';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const uint=v=>Number.isSafeInteger(v)&&v>=0;
const callable=v=>typeof v==='function'&&!types.isProxy(v);
const NativePromise=Promise,promisePrototype=Promise.prototype,then=Promise.prototype.then,species=Object.getOwnPropertyDescriptor(Promise,Symbol.species);
const poolCapture=TerminalProductionRemoteOutput.prototype.captureSourceSettlement;
const fail=(code='HOST_UNAVAILABLE')=>Object.freeze({ok:false,code});
const pass=value=>Object.freeze({ok:true,value:Object.freeze(value)});
const resolved=value=>new NativePromise(resolve=>resolve(value));
const opaque=()=>Object.freeze(Object.create(null));
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function actualPromise(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))throw TypeError('Native private reader Promise required');
 const ctor=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 if(!ctor||!Object.hasOwn(ctor,'value')||ctor.value!==NativePromise||!s||s.get!==species.get||s.set!==species.set||Object.hasOwn(s,'value'))throw TypeError('Promise species changed');return value;
}
const requestKeys=['sessionId','leaseId','generation','fromSequence','windowId','projectId','epoch','accessGeneration'];
export class TerminalProductionAttachmentOutput {
 #pool;#records=new Map();#candidates=new WeakMap();#reads=new WeakMap();#closed=true;#viewGeneration=0;
 constructor(options,...extra){const p=data(options,['deadlineMs']);if(extra.length||!p||!uint(p.deadlineMs)||p.deadlineMs<1||p.deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded private history options required');this.#pool=new TerminalProductionRemoteOutput({deadlineMs:p.deadlineMs});}
 get nativeExecutionAdmitted(){return false;}
 #frame(r,run){r.frames++;try{return run();}finally{r.frames--;this.#finish(r);}}
 #frames(run){const records=[...this.#records.values()];for(const r of records)r.frames++;try{return run();}finally{for(const r of records)r.frames--;for(const r of records)this.#finish(r);}}
 #observe(r,work,ok,bad){actualPromise(work);return Reflect.apply(then,work,[v=>{this.#frame(r,()=>ok(v));},v=>{this.#frame(r,()=>bad(v));}]);}
 #observation(r){
  r.frames=0;r.facetWorkers=0;r.worker=null;r.actualDone=false;r.unknown=false;r.poolSettled=false;r.poolHandle=null;
  r.rawRead={entered:false,pending:false,handlerSettled:false,unknown:false,work:null};
  r.handle=Object.freeze({sessionId:r.sessionId,ownerId:r.ownerId,actualSettled:new NativePromise(resolve=>r.actualResolve=resolve),snapshot:()=>Object.freeze({sessionId:r.sessionId,ownerId:r.ownerId,retired:r.retired,actualSettled:r.actualDone,unknown:r.unknown,activeFrames:r.frames,facetWorkers:r.facetWorkers,rawRead:Object.freeze({entered:r.rawRead.entered,pending:r.rawRead.pending,handlerSettled:r.rawRead.handlerSettled,unknown:r.rawRead.unknown}),poolSettled:r.poolSettled,candidatePresent:r.candidate!==null,retainedReadTickets:r.candidate?.frames.size??0,nativeExecutionAdmitted:false})});
 }
 captureOutputSettlement(value,...extra){const p=!extra.length&&data(value,['sessionId','ownerId']);if(!p||!id(p.sessionId)||!id(p.ownerId))return null;const r=this.#records.get(p.sessionId);return r?.ownerId===p.ownerId?r.handle:null;}
 captureOutputSettlementRoster(...extra){return extra.length?null:Object.freeze([...this.#records.values()].map(r=>r.handle));}
 #capturePool(r){
  try{
   const h=Reflect.apply(poolCapture,this.#pool,[r.sessionId]),p=data(h,['sessionId','actualSettled','snapshot']);
   if(!p||!Object.isFrozen(h)||p.sessionId!==r.sessionId||!callable(p.snapshot))throw Error('Exact output pool handle required');r.poolHandle=h;
   this.#observe(r,p.actualSettled,value=>{const receipt=data(value,['scope','sessionId','actualSettled','nativeExecutionAdmitted']);if(!receipt||!Object.isFrozen(value)||receipt.scope!=='OUTPUT_POOL_SOURCE'||receipt.sessionId!==r.sessionId||receipt.actualSettled!==true||receipt.nativeExecutionAdmitted!==false)r.unknown=true;else r.poolSettled=true;},()=>{r.unknown=true;});
  }catch{r.unknown=true;}
 }
 #finish(r){
  if(r.actualDone||!r.retired||r.frames||r.operations||r.facetWorkers||r.rawRead.pending||r.unknown||!r.poolSettled||r.candidate)return;
  r.actualDone=true;r.reader=null;r.rawRead.work=null;r.poolHandle=null;r.worker=null;r.quarantinePromise=null;
  if(this.#records.get(r.sessionId)===r)this.#records.delete(r.sessionId);
  const resolve=r.actualResolve;r.actualResolve=null;resolve(Object.freeze({scope:'OUTPUT_SOURCE',sessionId:r.sessionId,ownerId:r.ownerId,actualSettled:true,nativeExecutionAdmitted:false}));
 }
 #candidate(ticket){return ticket&&typeof ticket==='object'&&!types.isProxy(ticket)?this.#candidates.get(ticket):null;}
 #readTicket(ticket){return ticket&&typeof ticket==='object'&&!types.isProxy(ticket)?this.#reads.get(ticket):null;}
 #local(c){return c?.active===true&&!c.revoked&&!this.#closed&&c.viewGeneration===this.#viewGeneration&&this.#records.get(c.record.sessionId)===c.record&&!c.record.retired&&c.record.candidate===c;}
 #current(c){if(!this.#local(c)){if(c)this.#cancel(c);return false;}let current=false;try{current=c.guard()===true;}catch{}if(!current||!this.#local(c)){this.#cancel(c);return false;}return true;}
 #cancel(c){
  if(!c||!c.active)return;c.active=false;c.revoked=true;c.initial=null;this.#candidates.delete(c.ticket);
  for(const f of c.frames.values()){f.active=false;this.#reads.delete(f.ticket);}c.frames.clear();
  this.#pool.detach(c.token);c.guard=null;c.token=null;c.request=null;if(c.record.candidate===c)c.record.candidate=null;
 }
 #settled(r){const s=this.#pool.sourceStatus(r.sessionId);return r.rawPending===0&&r.operations===0&&s?.pendingRead!==true;}
 reconcile(){for(const r of this.#records.values())this.#finish(r);return Object.freeze({ok:true,retainedRecords:this.#records.size});}
 register(value,...extra){
  const p=data(value,['sessionId','ownerId','readHistory']);if(extra.length||!p||!id(p.sessionId)||!id(p.ownerId)||!callable(p.readHistory))return fail('REQUEST_REFUSED');
  this.reconcile();if(this.#records.has(p.sessionId))return fail(this.#records.get(p.sessionId).retired?'CAPACITY_EXCEEDED':'REQUEST_REFUSED');if([...this.#records.values()].some(r=>r.ownerId===p.ownerId))return fail('REQUEST_REFUSED');if(this.#records.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
  const r={sessionId:p.sessionId,ownerId:p.ownerId,reader:p.readHistory,rawPending:0,operations:0,candidate:null,retired:false,quarantined:false,quarantinePromise:null};this.#observation(r);
  return this.#frame(r,()=>{const result=this.#pool.register(r.sessionId,q=>this.#reader(r,q));if(!result.ok)return result;this.#records.set(r.sessionId,r);this.#capturePool(r);return pass({sessionId:r.sessionId});});
 }
 #reader(r,q){return this.#frame(r,()=>{
  const c=r.candidate;if(!c||!c.reading||q.sessionId!==r.sessionId||!this.#current(c)||r.rawPending)return null;
  // The raw authority is retained independently; the pool receives the exact
  // original Promise, avoiding re-assimilation through a value-returning then.
  r.rawPending++;const cell={entered:true,pending:true,handlerSettled:false,unknown:false,work:null};r.rawRead=cell;let raw;
  try{raw=r.reader(Object.freeze({ownerId:r.ownerId,fromSequence:q.fromSequence,maxBytes:q.maxBytes}));cell.work=raw;actualPromise(raw);}
  catch{return this.#quarantine(r);}
  try{
   const handled=this.#observe(r,raw,()=>{r.rawPending--;},()=>{r.rawPending--;});
   const unwound=this.#observe(r,handled,()=>{cell.handlerSettled=true;},()=>{cell.handlerSettled=true;});
   this.#observe(r,unwound,()=>{cell.pending=false;cell.work=null;},()=>{r.unknown=true;cell.unknown=true;});
   return raw;
  }catch{return this.#quarantine(r);}
 });}
 #quarantine(r){r.quarantined=true;r.unknown=true;r.rawRead.unknown=true;return r.quarantinePromise??=new NativePromise(()=>{});}
 // This complete outer worker owns guard checks, pool dispatch, publication,
 // cancellation and final forwarding. No owned await/async-return ingress.
 #operation(r,c,start,accept){
  r.operations++;r.facetWorkers++;const cell={work:null,result:null};r.worker=cell;let deliver,finished=false;const completion=new NativePromise(resolve=>deliver=resolve);
  const finish=(result,actual=true)=>{if(finished)return;finished=true;c.reading=false;r.operations--;if(actual){r.facetWorkers--;cell.work=null;if(r.worker===cell)r.worker=null;}deliver(result);};
  let begun;try{begun=start();}catch{this.#cancel(c);finish(fail());return completion;}
  if(!Object.hasOwn(begun,'work')){finish(begun);return completion;}
  cell.work=begun.work;
  const accepted=result=>{try{cell.result=accept(result);}catch{this.#cancel(c);cell.result=fail();}};
  const rejected=()=>{this.#cancel(c);cell.result=fail();};
  try{
   const handled=this.#observe(r,cell.work,accepted,rejected);
   const unwound=this.#observe(r,handled,()=>{},()=>{rejected();});
   this.#observe(r,unwound,()=>{finish(cell.result??fail());},()=>{r.unknown=true;finish(fail(),false);});
  }catch{r.unknown=true;this.#cancel(c);finish(fail(),false);}
  return completion;
 }
 prepare(value,admission,...extra){
  const p=data(value,requestKeys),a=data(admission,['isCurrent']);if(extra.length||!p||!a||!callable(a.isCurrent)||!['sessionId','leaseId','windowId','projectId'].every(k=>id(p[k]))||!uint(p.generation)||p.generation<1||!uint(p.fromSequence)||!uint(p.epoch)||p.epoch<1||!uint(p.accessGeneration))return resolved(fail('REQUEST_REFUSED'));
  if(this.#closed)return resolved(fail('PIN_REQUIRED'));const r=this.#records.get(p.sessionId);if(!r||r.retired)return resolved(fail('SESSION_REFUSED'));
  return this.#frame(r,()=>{
   if(r.candidate||r.rawPending||r.operations||r.facetWorkers||r.unknown||this.#pool.sourceStatus(r.sessionId)?.pendingRead)return resolved(fail('CAPACITY_EXCEEDED'));
   const c={record:r,request:Object.freeze({...p}),token:Object.freeze({sessionId:p.sessionId,leaseId:p.leaseId,generation:p.generation}),guard:a.isCurrent,viewGeneration:this.#viewGeneration,active:true,revoked:false,reading:true,initial:null,initialHanded:false,frames:new Map(),ticket:opaque()};r.candidate=c;this.#candidates.set(c.ticket,c);
   return this.#operation(r,c,()=>{
    if(!this.#current(c))return fail('LEASE_STALE');const attached=this.#pool.attach(r.sessionId,{leaseId:p.leaseId,generation:p.generation,fromSequence:p.fromSequence});if(!attached.ok){this.#cancel(c);return attached;}if(!this.#current(c))return fail('LEASE_STALE');return {work:this.#pool.takeWithBounds(c.token)};
   },result=>{if(!result.ok){this.#cancel(c);return result;}if(!this.#current(c))return fail('LEASE_STALE');c.initial=result.value;return pass({candidateTicket:c.ticket,firstSequence:result.value.firstSequence,endSequence:result.value.endSequence});});
  });
 }
 #handoff(c,value){let readTicket=null;if(value.chunk){readTicket=opaque();const end=value.chunk.sequence+value.chunk.utf8Bytes,f={candidate:c,end,active:true,ticket:readTicket};c.frames.set(end,f);this.#reads.set(readTicket,f);}return pass({readTicket,firstSequence:value.firstSequence,endSequence:value.endSequence,chunk:value.chunk,gap:value.gap});}
 handoffInitial(ticket,...extra){const c=this.#candidate(ticket);if(extra.length||!c)return fail('LEASE_STALE');return this.#frame(c.record,()=>{if(!this.#current(c))return fail('LEASE_STALE');if(c.reading||!c.initial||c.initialHanded)return fail('REQUEST_REFUSED');const value=c.initial;c.initial=null;c.initialHanded=true;return this.#handoff(c,value);});}
 read(ticket,...extra){
  const c=this.#candidate(ticket);if(extra.length||!c)return resolved(fail('LEASE_STALE'));const r=c.record;return this.#frame(r,()=>{
   if(!this.#local(c)){this.#cancel(c);return resolved(fail('LEASE_STALE'));}if(c.reading||r.rawPending||r.operations||r.facetWorkers||r.unknown||this.#pool.sourceStatus(r.sessionId)?.pendingRead)return resolved(fail('CAPACITY_EXCEEDED'));if(!c.initialHanded)return resolved(fail('REQUEST_REFUSED'));if(c.frames.size>=256)return resolved(fail('CAPACITY_EXCEEDED'));c.reading=true;
   return this.#operation(r,c,()=>{if(!this.#current(c))return fail('LEASE_STALE');return {work:this.#pool.takeWithBounds(c.token)};},result=>{if(!result.ok){if(result.code!=='CAPACITY_EXCEEDED')this.#cancel(c);return result;}if(!this.#current(c))return fail('LEASE_STALE');return this.#handoff(c,result.value);});
  });
 }
 ack(ticket,value,...extra){const f=this.#readTicket(ticket);if(extra.length||!f)return fail('REQUEST_REFUSED');return this.#frame(f.candidate.record,()=>{const p=data(value,['throughSequence']);if(!p||!uint(p.throughSequence))return fail('REQUEST_REFUSED');const c=f.candidate;if(!this.#current(c)||!f.active||c.frames.get(f.end)!==f)return fail('LEASE_STALE');if(p.throughSequence!==f.end)return fail('REQUEST_REFUSED');const result=this.#pool.ack(c.token,p.throughSequence);if(result.ok)for(const [end,entry]of c.frames)if(end<=p.throughSequence){entry.active=false;this.#reads.delete(entry.ticket);c.frames.delete(end);}return result;});}
 detach(ticket,...extra){const c=this.#candidate(ticket);if(extra.length||!c)return fail('LEASE_STALE');return this.#frame(c.record,()=>{if(!this.#current(c))return fail('LEASE_STALE');this.#cancel(c);return pass({detached:true});});}
 suspendViews(){return this.#frames(()=>{this.#closed=true;this.#viewGeneration++;this.#pool.suspendViews();for(const r of this.#records.values())if(r.candidate)this.#cancel(r.candidate);return pass({viewsSuspended:true});});}
 resumeViews(){return this.#frames(()=>{this.#pool.resumeViews();this.#closed=false;return pass({viewsSuspended:false});});}
 retire(sessionId,...extra){if(extra.length||!id(sessionId))return fail('REQUEST_REFUSED');const r=this.#records.get(sessionId);if(!r)return fail('SESSION_REFUSED');return this.#frame(r,()=>{if(r.candidate)this.#cancel(r.candidate);r.retired=true;this.#pool.retire(sessionId);return pass({retired:true});});}
 // Preserve legacy idle-retirement metadata absence. Captured identity/roster
 // remains retained until the independently observed exact pool receipt drains.
 status(sessionId,...extra){if(extra.length||!id(sessionId))return null;const r=this.#records.get(sessionId);if(!r)return null;const s=this.#pool.sourceStatus(sessionId),c=r.candidate;if(r.retired&&!s&&this.#settled(r))return null;return Object.freeze({registered:s?.registered===true,retiring:r.retired,pendingActualReads:r.rawPending,pendingFacetOperations:r.operations,poolPendingRead:s?.pendingRead===true,poolRetiring:s?.retiring===true,candidatePresent:!!c,heldInitial:!!c?.initial,retainedReadTickets:c?.frames.size??0,viewsSuspended:this.#closed,quarantinedRead:r.quarantined,settled:this.#settled(r)});}
 stats(){return Object.freeze({...this.#pool.stats(),nativeExecutionAdmitted:false,ownerRecords:this.#records.size,pendingActualReads:[...this.#records.values()].reduce((n,r)=>n+r.rawPending,0),pendingFacetOperations:[...this.#records.values()].reduce((n,r)=>n+r.operations,0),viewsSuspended:this.#closed});}
}
