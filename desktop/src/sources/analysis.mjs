import {readOwnedBytes} from '../projects/io.mjs';
import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
function fields(input,allowed,required=allowed){
 if(!input||![Object.prototype,null].includes(Object.getPrototypeOf(input)))return null;
 const descriptors=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(descriptors);
 if(keys.some(key=>typeof key!=='string'||!allowed.includes(key)||!('value'in descriptors[key])||!descriptors[key].enumerable)||required.some(key=>!keys.includes(key)))return null;
 return Object.fromEntries(keys.map(key=>[key,descriptors[key].value]));
}
export function normalizeAnalysisRequest(input){
 const request=fields(input,['sourceId','version','sha256','kind','jobId','range','budget'],['sourceId','version','sha256','kind','jobId']);
 if(!request||!id(request.sourceId)||!id(request.jobId)||!integer(request.version,1,Number.MAX_SAFE_INTEGER)||!hash(request.sha256)||request.kind!=='index')return null;
 const limits={maxUnits:2*1024*1024,maxDefinitions:2000,maxNodes:200000,wallMs:2500},budget=fields(request.budget??{},Object.keys(limits),[]);
 if(!budget||Object.entries(budget).some(([key,value])=>!integer(value,1,limits[key])))return null;
 request.budget={...limits,...budget};
 if(request.range!==undefined){const range=fields(request.range,['from','to']);if(!range||!integer(range.from,0,32*1024*1024)||!integer(range.to,range.from,32*1024*1024))return null;request.range=range;}
 return Object.freeze(request);
}

/** Main-owned immutable jobs. Cancellation resolves only after actual load and
 * worker exit; no unlimited queue, result cache or source execution. */
export class AnalysisService {
 #path;#hash;#load;#activity;#jobs=new Map();#paused=false;#disposed=false;
 constructor({workerPath,workerSha256,loadSource,onActivity=()=>{}}){
  if(typeof workerPath!=='string'||!hash(workerSha256)||typeof loadSource!=='function')throw TypeError('ANALYSIS_ADAPTERS_REQUIRED');
  if(typeof onActivity!=='function')throw TypeError('ANALYSIS_ADAPTERS_REQUIRED');this.#path=workerPath;this.#hash=workerSha256;this.#load=loadSource;this.#activity=onActivity;
 }
 isIdle(){return this.#jobs.size===0;}
 pause(){this.#paused=true;for(const job of this.#jobs.values())this.#stop(job,'cancelled','CANCELLED');}
 resume(){if(!this.#disposed)this.#paused=false;}
 async drain(){await Promise.all([...this.#jobs.values()].map(job=>job.done));return this.isIdle();}
 async dispose(){this.#disposed=true;this.pause();return this.drain();}
 #stop(job,status,reason){
  if(job.stop)return;job.stop={status,reason};
  if(job.worker)job.worker.terminate().catch(()=>{});
 }
 async cancel(jobId){const job=this.#jobs.get(jobId);if(!job)return false;this.#stop(job,'cancelled','CANCELLED');await job.done;return true;}
 async submit(input,{isCurrent=()=>true}={}){
  const request=normalizeAnalysisRequest(input),base={sourceId:request?.sourceId??null,version:request?.version??null,jobId:request?.jobId??null};
  const result=(status,reason)=>({...base,status,coverage:null,reason});
  if(!request)return result('unsupported','REQUEST_REFUSED');
  if(this.#paused||this.#disposed||!isCurrent())return result('cancelled','CANCELLED');
  if(this.#jobs.has(request.jobId))return result('unsupported','DUPLICATE_JOB');
  if(this.#jobs.size>=2)return result('budget-exceeded','WORKER_CAPACITY');
  let complete;const job={done:new Promise(resolve=>{complete=resolve;}),worker:null,stop:null};this.#jobs.set(request.jobId,job);
  const current=()=>!job.stop&&!this.#paused&&!this.#disposed&&isCurrent();
  try{
   const bytes=await this.#load({sourceId:request.sourceId,version:request.version,sha256:request.sha256},{jobId:request.jobId});
   if(!current())return result(job.stop?.status??'cancelled',job.stop?.reason??'CANCELLED');
   if(!(bytes instanceof Uint8Array)||bytes.length>32*1024*1024)return result('budget-exceeded','SOURCE_BYTES_BUDGET');
   if(digest(bytes)!==request.sha256)return result('error','SOURCE_HASH_MISMATCH');
   let workerBytes;try{workerBytes=await readOwnedBytes(this.#path,2*1024*1024);}catch{return result('error','WORKER_IDENTITY_REFUSED');}
   if(!current())return result('cancelled','CANCELLED');
   if(workerBytes.length>2*1024*1024||digest(workerBytes)!==this.#hash)return result('error','WORKER_IDENTITY_REFUSED');
   let message;const worker=job.worker=new Worker(workerBytes.toString('utf8'),{eval:true,workerData:{bytes,request},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32,stackSizeMb:4}});
   try{this.#activity({phase:'worker-started'});}catch{/* Diagnostics do not grant authority. */}
   const timer=setTimeout(()=>this.#stop(job,'budget-exceeded','WALL_BUDGET'),request.budget.wallMs);
   try{
    await new Promise((resolve,reject)=>{
     worker.once('message',value=>{message=value;worker.terminate().catch(()=>{});});worker.once('error',reject);worker.once('exit',code=>{if(message||job.stop)resolve();else reject(Error('WORKER_EXIT'));});
    });
   }finally{clearTimeout(timer);await worker.terminate();job.worker=null;try{this.#activity({phase:'worker-exited',status:job.stop?.status??message?.status??'error'});}catch{/* Diagnostics only. */}}
   if(!current())return result(job.stop?.status??'cancelled',job.stop?.reason??'CANCELLED');
   if(!message||!['complete','partial','unsupported','budget-exceeded','cancelled','error'].includes(message.status))return result('error','WORKER_RESULT_REFUSED');
   return {...base,...message};
  }catch{return result(job.stop?.status??'error',job.stop?.reason??'ANALYSIS_FAILED');}
  finally{this.#jobs.delete(request.jobId);complete();}
 }
}
