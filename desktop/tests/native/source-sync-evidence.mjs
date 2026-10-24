import {lstat,readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative,sep,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stamp=()=>new Date().toISOString();
const inside=(path,root)=>{const rel=relative(root,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep));};
async function noLinks(path){for(let node=resolve(path);;node=resolve(node,'..')){const s=await lstat(node);if(s.isSymbolicLink())throw Error('SYMLINK_OR_JUNCTION_REFUSED');if(node===resolve(node,'..'))break;}}
export async function admitFreshData(path){
 const data=resolve(path);await noLinks(resolve(data,'..'));
 let stat;try{stat=await lstat(data);}catch(error){if(error.code==='ENOENT')return {path:data,state:'ABSENT',policy:'Owned fixture requires absent-or-empty nonreparse Data before use'};throw error;}
 if(stat.isSymbolicLink())throw Error('DATA_REPARSE_REFUSED');
 if(!stat.isDirectory())throw Error('DATA_DIRECTORY_REQUIRED');
 if((await readdir(data)).length!==0)throw Error('DATA_NOT_EMPTY');
 return {path:data,state:'EMPTY',policy:'Owned fixture requires absent-or-empty nonreparse Data before use'};
}
const pathHash=rows=>sha(Buffer.from(rows.map(r=>r.relativePath).sort().join('\n'),'utf8'));
export async function captureOwnedData({dataRoot,outputRoot,phase,limits={files:4096,fileBytes:16*1024**2,totalBytes:128*1024**2}}){
 if(!Number.isInteger(limits.files)||limits.files<1||limits.files>4096||!Number.isInteger(limits.fileBytes)||limits.fileBytes<1||limits.fileBytes>16*1024**2||!Number.isInteger(limits.totalBytes)||limits.totalBytes<1||limits.totalBytes>128*1024**2)throw Error('CAPTURE_LIMITS_REFUSED');
 if(!['before-close-failure','before-close-success','after-close'].includes(phase))throw Error('CAPTURE_PHASE_REFUSED');
 const source=resolve(dataRoot),out=resolve(outputRoot,phase);if(inside(out,source)||inside(source,out))throw Error('CAPTURE_ROOT_OVERLAP');
 await noLinks(source);await noLinks(resolve(outputRoot));await mkdir(out);const filesAt=join(out,'files');await mkdir(filesAt);
 const manifest={schema:1,phase,source,startedAt:stamp(),limits,scope:['Projects/**','Recovery/**','session-selection.json'],coherence:phase==='after-close'?'POST_CLOSE_REQUIRES_EXTERNAL_QUIESCENCE':'LIVE_NOT_COHERENT',errors:[],files:[]};
 let errorCount=0;const problem=(stage,path,e)=>{errorCount++;if(manifest.errors.length<64)manifest.errors.push({stage,path,message:String(e.message??e).slice(0,1000),code:e.code});};
 async function inventory(){const rows=[];let total=0,directories=0;async function walk(path){const s=await lstat(path);if(s.isSymbolicLink())throw Error('SYMLINK_OR_JUNCTION_REFUSED');
   if(s.isDirectory()){if(++directories>4096)throw Error('DIRECTORY_BUDGET_EXCEEDED');rows.push({relativePath:relative(source,path).split(sep).join('/'),kind:'directory'});for(const name of (await readdir(path)).sort())await walk(join(path,name));return;}
   if(!s.isFile())throw Error('NONREGULAR_FILE_REFUSED');
   if(rows.filter(r=>r.kind==='file').length>=limits.files||s.size>limits.fileBytes||total+s.size>limits.totalBytes)throw Error('CAPTURE_BUDGET_EXCEEDED');
   const b=await readFile(path);if(b.length!==s.size)throw Error('FILE_CHANGED_DURING_INVENTORY');total+=b.length;rows.push({relativePath:relative(source,path).split(sep).join('/'),kind:'file',bytes:b.length,sha256:sha(b)});}
  for(const name of manifest.scope.map(x=>x.replace('/**',''))){const child=join(source,name);let stat;try{stat=await lstat(child);}catch(e){if(e.code==='ENOENT'&&name!=='Projects'){rows.push({relativePath:name,absent:true});continue;}throw e;}if(['Projects','Recovery'].includes(name)&&!stat.isDirectory())throw Error('SCOPE_DIRECTORY_REQUIRED');if(name==='session-selection.json'&&!stat.isFile())throw Error('SCOPE_FILE_REQUIRED');await walk(child);}
  return rows.sort((a,b)=>a.relativePath<b.relativePath?-1:a.relativePath>b.relativePath?1:0);}
 try{
  const before=await inventory();manifest.before=before;manifest.beforePathsetSha256=pathHash(before);manifest.directories=before.filter(r=>r.kind==='directory');
  manifest.beforeFilePathsetSha256=pathHash(before.filter(r=>r.kind==='file'));manifest.beforeDirectoryPathsetSha256=pathHash(manifest.directories);
  for(const row of before){if(row.absent)continue;const from=join(source,row.relativePath),to=join(filesAt,row.relativePath);if(row.kind==='directory'){await mkdir(to,{recursive:true});continue;}await noLinks(from);const bytes=await readFile(from);await mkdir(resolve(to,'..'),{recursive:true});await writeFile(to,bytes,{flag:'wx'});manifest.files.push({relativePath:row.relativePath,bytes:bytes.length,sha256:sha(bytes)});}
  manifest.after=await inventory();manifest.afterPathsetSha256=pathHash(manifest.after);
  manifest.afterFilePathsetSha256=pathHash(manifest.after.filter(r=>r.kind==='file'));manifest.afterDirectoryPathsetSha256=pathHash(manifest.after.filter(r=>r.kind==='directory'));
  manifest.stableAroundCopy=JSON.stringify(before)===JSON.stringify(manifest.after)&&manifest.files.every(row=>before.some(old=>old.relativePath===row.relativePath&&old.bytes===row.bytes&&old.sha256===row.sha256));
  // Explicit current.json and session pointers surround the whole byte copy.
  manifest.pointerStability=before.filter(r=>r.relativePath.endsWith('/current.json')||r.relativePath==='session-selection.json').map(row=>({...row,unchanged:manifest.after.some(after=>JSON.stringify(after)===JSON.stringify(row))}));
 }catch(e){problem('inventory-or-copy',source,e);manifest.stableAroundCopy=false;}
 manifest.errorCount=errorCount;manifest.finishedAt=stamp();manifest.captureComplete=errorCount===0;
 await writeFile(join(out,'capture.json'),JSON.stringify(manifest,null,2),{flag:'wx'});return manifest;
}

export function retainPrimaryFailure(result,cause,stage='native-test'){
 if(!Object.hasOwn(result,'primaryFailure')){
  const original=result.error??{message:String(cause?.message??cause),stack:cause?.stack};
  Object.defineProperty(result,'error',{value:original,enumerable:true,writable:false,configurable:false});
  Object.defineProperty(result,'primaryFailure',{value:Object.freeze({stage,at:stamp(),message:original.message,stack:original.stack}),enumerable:true,writable:false,configurable:false});
 }
 result.status='ADVERSE';return result.error;
}
function retentionError(result,stage,error){
 result.retentionErrorCount=(result.retentionErrorCount??0)+1;
 const errors=result.retentionErrors??=[];
 if(errors.length<32)errors.push({stage,at:stamp(),message:String(error?.message??error).slice(0,2000),code:error?.code});
 retainPrimaryFailure(result,error,stage);
}
export async function evidenceStep(result,stage,action){
 try{return await action();}catch(error){retentionError(result,stage,error);return undefined;}
}
export async function retainRawEvidence(result,{data,evidence},when){
 if(!['beforeClose','afterClose'].includes(when))throw Error('RETENTION_PHASE_REFUSED');
 const raw=result.rawEvidence??={};if(Object.hasOwn(raw,when))return raw[when];
 const phase=when==='afterClose'?'after-close':result.status==='COMPLETE'?'before-close-success':'before-close-failure';
 raw[when]={phase,captureComplete:false,attempted:true};
 await evidenceStep(result,'raw-'+phase,async()=>{
  const out=join(evidence,'raw-captures');await mkdir(out,{recursive:true});
  raw[when]=await captureOwnedData({dataRoot:data,outputRoot:out,phase});
  if(!raw[when].captureComplete)throw Error('RAW_CAPTURE_INCOMPLETE: '+JSON.stringify(raw[when].errors));
 });
 return raw[when];
}
async function retainRuntimeLog(result,driver,evidence,phase){
 await evidenceStep(result,'runtime-log-'+phase,async()=>{
  const bytes=Buffer.from(driver?.logs()??''),retained=bytes.subarray(0,1024*1024);
  (result.runtimeLogs??={})[phase]={bytes:bytes.length,sha256:sha(bytes),retainedBytes:retained.length,truncated:retained.length!==bytes.length};
  await writeFile(join(evidence,'raw-captures','source-sync-runtime-'+phase+'.log'),retained,{flag:'wx'});
 });
}
export async function finalizeEvidence({result,driver,data,evidence,captureInputs,inputs}){
 await retainRawEvidence(result,{data,evidence},'beforeClose');
 await retainRuntimeLog(result,driver,evidence,'before-close');
 await evidenceStep(result,'driver-close',async()=>{await driver?.close();result.driverCloseReturned=true;});
 await retainRuntimeLog(result,driver,evidence,'after-close');
 await retainRawEvidence(result,{data,evidence},'afterClose');
 result.afterInputs=await evidenceStep(result,'source-input-readback',captureInputs);
 result.inputsUnchanged=JSON.stringify(inputs)===JSON.stringify(result.afterInputs);
 if(!result.inputsUnchanged)retentionError(result,'source-input-preservation',Error('SOURCE_INPUTS_CHANGED_OR_UNREADABLE'));
 result.rawEvidence.limits='Live capture is non-atomic. After-close capture requires independent process quiescence and actual Data recheck; archive upload may omit physical empty directories, which remain enumerated in capture manifests.';
 if(result.primaryFailure||result.retentionErrorCount)result.status='ADVERSE';return result;
}
