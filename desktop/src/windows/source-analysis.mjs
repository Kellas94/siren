import {AnalysisService,normalizeAnalysisRequest} from '../sources/analysis.mjs';
import {randomUUID} from 'node:crypto';
const fail=code=>Object.freeze({ok:false,code});
const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
const empty=input=>input==null||[Object.prototype,null].includes(Object.getPrototypeOf(input))&&Reflect.ownKeys(input).length===0;

/** Code-only static analysis. Requests carry no path, text, project or native
 * identity. Main derives scope and rechecks real authority throughout I/O. */
export class NativeSourceAnalysis {
 #registry;#owner;#reference;#factory;#service;#windows;#jobs=new Map();#disposed=false;
 constructor({registry,owner,referenceFor,repositoryFactory,windowsFor=()=>[],workerPath,workerSha256,onActivity}){
  this.#registry=registry;this.#owner=owner;this.#reference=referenceFor;this.#factory=repositoryFactory;
  this.#windows=windowsFor;
  this.#service=new AnalysisService({workerPath,workerSha256,onActivity,loadSource:async(ref,{jobId,side})=>{
   const job=this.#jobs.get(jobId);if(!job||!this.#current(job))throw Error('ACCESS_REFUSED');
   const context=side==='right'?job.right:job;if(!context||!same(context.ref,ref))throw Error('ACCESS_REFUSED');
   const repository=this.#factory({canWrite:scope=>this.#current(job)&&scope.projectId===context.grant.projectId&&scope.sourceId===context.ref.sourceId&&['read','export'].includes(scope.action)});
   const verified=await repository.readVerifiedVersion({projectId:context.grant.projectId,sourceId:ref.sourceId,version:ref.version});
   if(!this.#current(job)||!same(verified.ref,ref))throw Error('ACCESS_REFUSED');return verified.bytes;
  }});
 }
 #capture(event){
  try{const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
   if(this.#disposed||grant?.role!=='code'||grant.mainFrameUrl!==`siren://app/windows/code.html?windowId=${grant.windowId}`||!this.#registry.isCurrent(grant))return null;
   const ref=this.#reference(grant);return ref&&this.#owner.canRead(grant,ref.sourceId)?{grant,ref}:null;
  }catch{return null;}
 }
 #current(job){try{return !this.#disposed&&[job,...(job.right?[job.right]:[])].every(context=>this.#registry.isCurrent(context.grant)&&this.#owner.canRead(context.grant,context.ref.sourceId)&&same(context.ref,this.#reference(context.grant)));}catch{return false;}}
 #comparisons(context){
  const choices=[];for(const view of this.#windows()){
   if(view?.isDestroyed())continue;
   const other=this.#capture({sender:view?.webContents,senderFrame:view?.webContents?.mainFrame});
   if(!other||other.grant.projectId!==context.grant.projectId||other.grant.windowId===context.grant.windowId)continue;
   choices.push(other);if(choices.length===64)break;
  }return choices;
 }
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
  if(!['submit','cancel','listComparisons'].includes(method))return fail('REQUEST_REFUSED');
  const context=this.#capture(event);if(!context)return fail('ACCESS_REFUSED');
  if(method==='listComparisons')return empty(payload)?{ok:true,items:this.#comparisons(context).map(other=>({windowId:other.grant.windowId,sourceRef:other.ref}))}:fail('REQUEST_REFUSED');
  if(method==='cancel'){
   if(!empty(payload)&&(!payload||![Object.prototype,null].includes(Object.getPrototypeOf(payload))||Reflect.ownKeys(payload).length!==1||typeof Object.getOwnPropertyDescriptor(payload,'jobId')?.value!=='string'))return fail('REQUEST_REFUSED');
   const jobId=Object.getOwnPropertyDescriptor(payload??{},'jobId')?.value;
   const job=[...this.#jobs.values()].find(job=>this.#sameCaller(job.grant,context.grant)&&job.publicId===jobId),key=job?.key;
   if(!job)return fail('ACCESS_REFUSED');
   await this.#service.cancel(key);return {ok:true};
  }
  let rightWindowId,normalized=payload;
  if(payload&&[Object.prototype,null].includes(Object.getPrototypeOf(payload))&&Object.hasOwn(payload,'rightWindowId')){
   const descriptors=Object.getOwnPropertyDescriptors(payload);
   if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'||!('value'in descriptors[key])||!descriptors[key].enumerable))return fail('REQUEST_REFUSED');
   rightWindowId=descriptors.rightWindowId.value;normalized=Object.fromEntries(Object.entries(descriptors).filter(([key])=>key!=='rightWindowId').map(([key,d])=>[key,d.value]));
  }
  const request=normalizeAnalysisRequest(normalized);if(!request)return fail('REQUEST_REFUSED');
  let right;
  if(request.kind==='diff'){
   if(typeof rightWindowId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(rightWindowId))return fail('REQUEST_REFUSED');
   right=this.#comparisons(context).find(other=>other.grant.windowId===rightWindowId);
   if(!right||!same(right.ref,request.rightRef))return fail('ACCESS_REFUSED');
  }else if(rightWindowId!==undefined)return fail('REQUEST_REFUSED');
  if(!same(context.ref,request))return fail('ACCESS_REFUSED');
  if([...this.#jobs.values()].some(job=>job.grant.windowId===context.grant.windowId))return fail('ANALYSIS_BUSY');
  const key=randomUUID();let done;const job={...context,right,key,publicId:request.jobId,done:new Promise(resolve=>{done=resolve;})};this.#jobs.set(key,job);
  const closed=()=>{void this.#service.cancel(key);},rightSender=right?this.#registry.eventFor(right.grant)?.sender:null;event.sender.once('destroyed',closed);rightSender?.once('destroyed',closed);
  try{
   const result=await this.#service.submit({...request,jobId:key},{isCurrent:()=>this.#current(job)});
   if(!this.#current(job))return fail('ACCESS_REFUSED');
   return {ok:true,...result,jobId:request.jobId};
  }finally{event.sender.off('destroyed',closed);rightSender?.off('destroyed',closed);this.#jobs.delete(key);done();}
 }
}
