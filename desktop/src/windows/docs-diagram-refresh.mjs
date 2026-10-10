import {navigationFields} from '../navigation/contracts.mjs';
/** Main-owned scheduler. Adapters resolve immutable saved sources and native
 * working leases. Neither a renderer dirty flag nor a timer grants a write. */
export class DocsDiagramRefresh{
 #owner;#diagrams;#working;#jobs=new Map();#running=null;#activeJob=null;#scans=new Set();#paused=false;#disposed=false;#generation=0;#off;
 constructor({owner,diagrams,workingState}){
  if(!['observeDomainSaves','captureDiagramRefresh','invokeDiagramRefresh'].every(k=>typeof owner?.[k]==='function')||!['listRefreshTargets','prepareRefresh'].every(k=>typeof diagrams?.[k]==='function')||!['isBlocked','onPending'].every(k=>typeof workingState?.[k]==='function'))throw TypeError('DOCS_REFRESH_ADAPTERS_REQUIRED');
  this.#owner=owner;this.#diagrams=diagrams;this.#working=workingState;
  this.#off=owner.observeDomainSaves(event=>{if(event.receipt?.ok!==true)return;if(event.domain==='diagram')this.onDiagramSaved({projectId:event.projectId,diagramId:event.entityId,sourceHash:event.receipt.sha256,sourceVersion:event.receipt.version,projectRevision:event.receipt.projectRevision});else if(event.domain==='docs'&&event.originWindowId)this.onDocumentSettled({projectId:event.projectId,documentId:event.entityId});});
 }
 onDiagramSaved(value,force=false){
  if(this.#paused||this.#disposed)return false;let r;try{r=navigationFields(value,['projectId','diagramId','sourceHash','sourceVersion','projectRevision']);}catch{return false;}
  if(!['projectId','diagramId'].every(k=>typeof r[k]==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(r[k]))||typeof r.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(r.sourceHash)||!['sourceVersion','projectRevision'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=1))return false;
  const key=r.projectId+':'+r.diagramId,old=this.#jobs.get(key);if(old&&old.receipt.projectRevision>r.projectRevision)return false;if(!force&&old&&old.receipt.sourceHash===r.sourceHash&&old.receipt.sourceVersion===r.sourceVersion)return true;
  if(!old&&this.#jobs.size>=128){for(const [key,job]of this.#jobs)if(job!==this.#activeJob&&!job.queued&&!job.deferred.size){this.#jobs.delete(key);break;}if(this.#jobs.size>=128)return false;}const job=old??{revision:0,deferred:new Set()};job.receipt={...r};job.revision++;job.queued=true;this.#jobs.set(key,job);this.#schedule();return true;
 }
 onDocumentSettled(value){
  if(this.#paused||this.#disposed||typeof value?.projectId!=='string'||typeof value?.documentId!=='string')return false;
  for(const job of this.#jobs.values())if(job.receipt.projectId===value.projectId&&(job.deferred.has(value.documentId)||job.deferred.has('*'))){job.revision++;job.queued=true;}this.#schedule();return true;
 }
 rescanProject(projectId){
  if(this.#paused||this.#disposed||typeof this.#diagrams.listRefreshSources!=='function'||this.#scans.size>=1)return Promise.resolve(false);const generation=this.#generation,current=()=>!this.#paused&&!this.#disposed&&generation===this.#generation;
  const operation=Promise.resolve().then(async()=>{const rows=await this.#diagrams.listRefreshSources({projectId,isCurrent:current});if(!current())return false;let accepted=true;for(const row of rows){if(!current())return false;if(!this.onDiagramSaved(row,true)){if(this.#running)await this.#running;if(!current())return false;if(!this.onDiagramSaved(row,true))accepted=false;}}return accepted;}).catch(()=>false);this.#scans.add(operation);operation.finally(()=>this.#scans.delete(operation));return operation;
 }
 #notice(row){try{this.#working.onPending(row);}catch{/* A notice cannot grant a write or erase retained content. */}}
 #schedule(){
  if(this.#running||this.#paused||this.#disposed)return;
  const operation=Promise.resolve().then(async()=>{while(!this.#paused&&!this.#disposed){const job=[...this.#jobs.values()].find(j=>j.queued);if(!job)break;job.queued=false;this.#activeJob=job;try{await this.#run(job);}finally{this.#activeJob=null;}}}).catch(()=>{});
  this.#running=operation;operation.finally(()=>{if(this.#running===operation)this.#running=null;if(!this.#paused&&!this.#disposed&&[...this.#jobs.values()].some(j=>j.queued))this.#schedule();});
 }
 async #run(job){
  const generation=this.#generation,revision=job.revision,receipt={...job.receipt};
  const current=()=>!this.#paused&&!this.#disposed&&generation===this.#generation&&revision===job.revision;
  try{
   const targets=await this.#diagrams.listRefreshTargets({...receipt,isCurrent:current});if(!current())return;
   job.deferred.clear();
   for(const target of targets){
    if(!current())return;if(target.mode!=='live')continue;
    const request={...receipt,documentId:target.documentId,blockId:target.blockId,isCurrent:current};
    if(this.#working.isBlocked(receipt.projectId,target.documentId)!==false){job.deferred.add(target.documentId);this.#notice({...request,isCurrent:undefined,reason:'working-draft'});continue;}
    for(let attempt=0;attempt<2&&current();attempt++){
     const capability=this.#owner.captureDiagramRefresh(receipt.projectId,target.documentId,current);
     if(!capability){job.deferred.add(target.documentId);this.#notice({...request,isCurrent:undefined,reason:'native-lease'});break;}
     const prepared=await this.#diagrams.prepareRefresh({...request,capability});if(!current()||!capability.isCurrent())break;if(prepared?.skip)break;
     if(!prepared?.token){this.#notice({...request,isCurrent:undefined,reason:prepared?.code??'refresh-failed'});break;}
     const result=await this.#owner.invokeDiagramRefresh(prepared.token,capability);if(!current())break;if(result?.ok)break;
     if(!['DOCUMENT_CONFLICT','DIAGRAM_EMBED_SOURCE_CHANGED'].includes(result?.code)||attempt===1){job.deferred.add(target.documentId);this.#notice({...request,isCurrent:undefined,reason:result?.code??'refresh-failed'});break;}
    }
   }
  }catch{if(current()){job.deferred.add('*');this.#notice({...receipt,reason:'refresh-failed'});}}
 }
 async drain(){while(this.#running||this.#scans.size)await Promise.all([...(this.#running?[this.#running]:[]),...this.#scans]);}
 isIdle(){return this.#running===null&&this.#scans.size===0;}
 async pause(){this.#paused=true;this.#generation++;this.#jobs.clear();await this.drain();}
 resume(){if(this.#disposed)return;this.#paused=false;this.#generation++;}
 async dispose(){if(this.#disposed)return;this.#disposed=true;this.#off();await this.pause();}
}
