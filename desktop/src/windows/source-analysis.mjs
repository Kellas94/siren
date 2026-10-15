import {AnalysisService,normalizeAnalysisRequest} from '../sources/analysis.mjs';
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
const fail=code=>Object.freeze({ok:false,code});
const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
const empty=input=>input==null||[Object.prototype,null].includes(Object.getPrototypeOf(input))&&Reflect.ownKeys(input).length===0;
const navigationFields=(input,keys)=>{
 if(!input||types.isProxy(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))return null;
 const descriptors=Object.getOwnPropertyDescriptors(input),own=Reflect.ownKeys(descriptors);
 if(own.length!==keys.length||own.some(key=>typeof key!=='string'||!keys.includes(key)||!descriptors[key].enumerable||!Object.hasOwn(descriptors[key],'value')))return null;
 return Object.fromEntries(own.map(key=>[key,descriptors[key].value]));
};
const navigationRef=input=>{const value=navigationFields(input,['sourceId','version','sha256']);return value&&typeof value.sourceId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value.sourceId)&&Number.isSafeInteger(value.version)&&value.version>0&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)?Object.freeze(value):null;};
const navigationRange=input=>{const value=navigationFields(input,['from','to']);return value&&Number.isSafeInteger(value.from)&&Number.isSafeInteger(value.to)&&value.from>=0&&value.to>=value.from&&value.to<=32*1024*1024?Object.freeze(value):null;};

/** Code-only static analysis. Requests carry no path, text, project or native
 * identity. Main derives scope and rechecks real authority throughout I/O. */
export class NativeSourceAnalysis {
 #registry;#owner;#reference;#factory;#service;#windows;#jobs=new Map();#disposed=false;#language;#displayName;
 #navigation;#navigations=new Map();#paused=false;#navigationGeneration=0;
 constructor({registry,owner,referenceFor,repositoryFactory,windowsFor=()=>[],workerPath,workerSha256,onActivity,languageFor,displayNameFor,navigation}){
  if(languageFor!==undefined&&typeof languageFor!=='function'||displayNameFor!==undefined&&typeof displayNameFor!=='function')throw TypeError('NATIVE_ANALYSIS_METADATA_ADAPTERS_REQUIRED');
  this.#language=languageFor;this.#displayName=displayNameFor;
  if(navigation!==undefined&&(!navigation||!['enabled','send','focus'].every(key=>typeof navigation[key]==='function')))throw TypeError('NATIVE_COMPARISON_NAVIGATION_ADAPTERS_REQUIRED');
  this.#navigation=navigation;
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
 #navigationCurrent(job){
  try{return !job.finished&&!this.#paused&&job.generation===this.#navigationGeneration&&this.#navigation?.enabled()===true&&this.#current(job)&&job.leftGuard.isCurrent()===true&&job.rightGuard.isCurrent()===true&&!job.finished&&!this.#paused&&!this.#disposed&&job.generation===this.#navigationGeneration;}catch{return false;}
 }
 #finishNavigation(job,result){
  if(job.finished)return;job.finished=true;clearTimeout(job.timer);job.resolve(Object.freeze(result));
  // A public timeout/Lock cannot refund a slot while its original repository
  // call is still unsettled. The actual loader finally releases that slot.
  if(!job.loading){this.#navigations.delete(job.key);job.complete();}
 }
 async #loadNavigation(job,range){
  try{
   if(!this.#navigationCurrent(job))return this.#finishNavigation(job,fail('ACCESS_REFUSED'));
   const repository=this.#factory({canWrite:scope=>this.#navigationCurrent(job)&&scope.action==='read'&&scope.projectId===job.right.grant.projectId&&scope.sourceId===job.right.ref.sourceId});
   if(!this.#navigationCurrent(job))return this.#finishNavigation(job,fail('ACCESS_REFUSED'));
   const metrics=await repository.getMetrics({projectId:job.right.grant.projectId,sourceId:job.right.ref.sourceId,version:job.right.ref.version});
   if(!this.#navigationCurrent(job)||!same(metrics,job.right.ref))return this.#finishNavigation(job,fail('ACCESS_REFUSED'));
   if(!Number.isSafeInteger(metrics.utf16Units)||range.to>metrics.utf16Units)return this.#finishNavigation(job,fail('RANGE_REFUSED'));
   const target=this.#registry.eventFor(job.right.grant);if(!target||!this.#navigationCurrent(job))return this.#finishNavigation(job,fail('ACCESS_REFUSED'));
   job.delivered=true;
   this.#navigation.send(target,Object.freeze({requestId:job.key,sourceRef:job.right.ref,range}));
   if(!job.finished&&!this.#navigationCurrent(job))this.#finishNavigation(job,fail('ACCESS_REFUSED'));
  }catch{this.#finishNavigation(job,fail('COMPARISON_NAVIGATION_FAILED'));}
  finally{job.loading=false;if(job.finished){this.#navigations.delete(job.key);job.complete();}}
 }
 #navigate(context,method,payload){
  if(!this.#navigation||this.#paused||this.#disposed)return fail('ACCESS_REFUSED');
  try{
   if(method!=='revealComparison'){
    const input=navigationFields(payload,method==='claimComparison'?['requestId']:['requestId','ok']);
    if(!input||typeof input.requestId!=='string'||!/^[-a-f0-9]{36}$/.test(input.requestId)||method==='completeComparison'&&typeof input.ok!=='boolean')return fail('REQUEST_REFUSED');
    const job=this.#navigations.get(input.requestId);
    if(!job||!job.delivered||!this.#sameCaller(job.right.grant,context.grant)||!this.#navigationCurrent(job))return fail('ACCESS_REFUSED');
    if(method==='claimComparison'){if(job.claimed)return fail('ACCESS_REFUSED');job.claimed=true;return {ok:true};}
    if(!job.claimed||job.completing)return fail('ACCESS_REFUSED');job.completing=true;
    if(!input.ok){this.#finishNavigation(job,fail('TARGET_NOT_READY'));return {ok:true};}
    // The adapter is synchronous and may call native show/focus only while
    // this exact captured scope remains current. A receipt grants no new view.
    let focused=false;try{focused=this.#navigation.focus(job.right.grant,Object.freeze({isCurrent:()=>this.#navigationCurrent(job)}))===true;}catch{}
    const ok=focused&&this.#navigationCurrent(job);this.#finishNavigation(job,ok?{ok:true}:fail('ACCESS_REFUSED'));return ok?{ok:true}:fail('ACCESS_REFUSED');
   }
   const input=navigationFields(payload,['sourceRef','rightWindowId','rightRef','range']);
   if(!input)return fail('REQUEST_REFUSED');
   const leftRef=navigationRef(input.sourceRef),rightRef=navigationRef(input.rightRef),range=navigationRange(input.range);
   if(!leftRef||!rightRef||!range||typeof input.rightWindowId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(input.rightWindowId))return fail('REQUEST_REFUSED');
   const right=this.#comparisons(context).find(other=>other.grant.windowId===input.rightWindowId);
   if(!right||!same(context.ref,leftRef)||!same(right.ref,rightRef))return fail('ACCESS_REFUSED');
   if(this.#navigations.size>=8||[...this.#navigations.values()].some(job=>job.grant.windowId===context.grant.windowId||job.right.grant.windowId===right.grant.windowId))return fail('COMPARISON_NAVIGATION_BUSY');
   const leftGuard=this.#registry.captureAdmissionGuard(context.grant),rightGuard=this.#registry.captureAdmissionGuard(right.grant);
   if(!leftGuard||!rightGuard)return fail('ACCESS_REFUSED');
   let resolve,complete;const answer=new Promise(done=>resolve=done),done=new Promise(finish=>complete=finish),key=randomUUID();
   const job={...context,ref:leftRef,right:{...right,ref:rightRef},leftGuard,rightGuard,generation:this.#navigationGeneration,key,resolve,complete,done,loading:true,finished:false,delivered:false,claimed:false};
   if(!this.#navigationCurrent(job))return fail('ACCESS_REFUSED');
   this.#navigations.set(key,job);job.timer=setTimeout(()=>this.#finishNavigation(job,fail('COMPARISON_NAVIGATION_TIMEOUT')),1500);
   void this.#loadNavigation(job,range);return answer;
  }catch{return fail('REQUEST_REFUSED');}
 }
 isIdle(){return this.#jobs.size===0&&this.#navigations.size===0&&this.#service.isIdle();}
 pause(){this.#paused=true;this.#navigationGeneration++;for(const job of this.#navigations.values())this.#finishNavigation(job,fail('ACCESS_REFUSED'));this.#service.pause();}
 resume(){if(!this.#disposed)this.#paused=false;this.#service.resume();}
 async drain(){await this.#service.drain();await Promise.all([...this.#jobs.values(),...this.#navigations.values()].map(job=>job.done));return this.isIdle();}
 async dispose(){this.#disposed=true;this.pause();return this.drain();}
 async invoke({event,method,payload}){
  if(!['submit','cancel','listComparisons','revealComparison','claimComparison','completeComparison'].includes(method))return fail('REQUEST_REFUSED');
  const context=this.#capture(event);if(!context)return fail('ACCESS_REFUSED');
  if(['revealComparison','claimComparison','completeComparison'].includes(method))return this.#navigate(context,method,payload);
  if(method==='listComparisons'){
   if(!empty(payload))return fail('REQUEST_REFUSED');
   const items=this.#comparisons(context).map(other=>{let name;try{name=this.#displayName?.(other.grant,other.ref);}catch{}
    const safe=typeof name==='string'&&name.length>0&&name.length<=200&&name.isWellFormed()&&!/[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name);
    return {windowId:other.grant.windowId,sourceRef:other.ref,...(safe?{displayName:name}:{})};});
   return this.#current(context)?{ok:true,items}:fail('ACCESS_REFUSED');
  }
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
  if(request.kind!=='diff'&&this.#language){let language;try{language=this.#language(context.grant,context.ref);}catch{}if(language!=='python')return fail('LANGUAGE_NOT_SUPPORTED');}
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
