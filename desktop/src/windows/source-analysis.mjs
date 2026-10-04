import {AnalysisService,normalizeAnalysisRequest} from '../sources/analysis.mjs';
import {randomUUID} from 'node:crypto';
const fail=code=>Object.freeze({ok:false,code});
const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
const empty=input=>input==null||[Object.prototype,null].includes(Object.getPrototypeOf(input))&&Reflect.ownKeys(input).length===0;

/** Code-only static analysis. Requests carry no path, text, project or native
 * identity. Main derives scope and rechecks real authority throughout I/O. */
export class NativeSourceAnalysis {
 #registry;#owner;#reference;#factory;#service;#jobs=new Map();#disposed=false;
 constructor({registry,owner,referenceFor,repositoryFactory,workerPath,workerSha256,onActivity}){
  this.#registry=registry;this.#owner=owner;this.#reference=referenceFor;this.#factory=repositoryFactory;
  this.#service=new AnalysisService({workerPath,workerSha256,onActivity,loadSource:async(ref,{jobId})=>{
   const job=this.#jobs.get(jobId);if(!job||!this.#current(job))throw Error('ACCESS_REFUSED');
   const repository=this.#factory({canWrite:scope=>this.#current(job)&&scope.projectId===job.grant.projectId&&scope.sourceId===ref.sourceId&&['read','export'].includes(scope.action)});
   const verified=await repository.readVerifiedVersion({projectId:job.grant.projectId,sourceId:ref.sourceId,version:ref.version});
   if(!this.#current(job)||!same(verified.ref,ref))throw Error('ACCESS_REFUSED');return verified.bytes;
  }});
 }
 #capture(event){
  try{const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
   if(this.#disposed||grant?.role!=='code'||grant.mainFrameUrl!==`siren://app/windows/code.html?windowId=${grant.windowId}`||!this.#registry.isCurrent(grant))return null;
   const ref=this.#reference(grant);return ref&&this.#owner.canRead(grant,ref.sourceId)?{grant,ref}:null;
  }catch{return null;}
 }
 #current(job){try{return !this.#disposed&&this.#registry.isCurrent(job.grant)&&this.#owner.canRead(job.grant,job.ref.sourceId)&&same(job.ref,this.#reference(job.grant));}catch{return false;}}
 #sameCaller(left,right){
  const a=this.#registry.eventFor(left),b=this.#registry.eventFor(right);
  return Boolean(a&&b&&a.sender===b.sender&&a.senderFrame===b.senderFrame&&['windowId','projectId','epoch','webContentsId','mainFrameUrl','role'].every(key=>left[key]===right[key]));
 }
 isIdle(){return this.#jobs.size===0&&this.#service.isIdle();}
 pause(){this.#service.pause();}
 resume(){this.#service.resume();}
 async drain(){await this.#service.drain();await Promise.all([...this.#jobs.values()].map(job=>job.done));return this.isIdle();}
 async dispose(){this.#disposed=true;this.pause();return this.drain();}
 async invoke({event,method,payload}){
  if(method!=='submit'&&method!=='cancel')return fail('REQUEST_REFUSED');
  const context=this.#capture(event);if(!context)return fail('ACCESS_REFUSED');
  if(method==='cancel'){
   if(!empty(payload)&&(!payload||![Object.prototype,null].includes(Object.getPrototypeOf(payload))||Reflect.ownKeys(payload).length!==1||typeof Object.getOwnPropertyDescriptor(payload,'jobId')?.value!=='string'))return fail('REQUEST_REFUSED');
   const jobId=Object.getOwnPropertyDescriptor(payload??{},'jobId')?.value;
   const job=[...this.#jobs.values()].find(job=>this.#sameCaller(job.grant,context.grant)&&job.publicId===jobId),key=job?.key;
   if(!job)return fail('ACCESS_REFUSED');
   await this.#service.cancel(key);return {ok:true};
  }
  const request=normalizeAnalysisRequest(payload);if(!request)return fail('REQUEST_REFUSED');
  if(!same(context.ref,request))return fail('ACCESS_REFUSED');
  if([...this.#jobs.values()].some(job=>job.grant.windowId===context.grant.windowId))return fail('ANALYSIS_BUSY');
  const key=randomUUID();let done;const job={...context,key,publicId:request.jobId,done:new Promise(resolve=>{done=resolve;})};this.#jobs.set(key,job);
  const closed=()=>{void this.#service.cancel(key);};event.sender.once('destroyed',closed);
  try{
   const result=await this.#service.submit({...request,jobId:key},{isCurrent:()=>this.#current(job)});
   if(!this.#current(job))return fail('ACCESS_REFUSED');
   return {ok:true,...result,jobId:request.jobId};
  }finally{event.sender.off('destroyed',closed);this.#jobs.delete(key);done();}
 }
}
