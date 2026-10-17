// QA diagnostics only: no process creation, product imports, retries or identity grants.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const LIMIT=16384,sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function streamEvidence(value){
 if(typeof value!=='string'&&!Buffer.isBuffer(value))return {availability:value===undefined?'not-provided':'unsupported-type',bytes:null,sha256:null,retainedBytes:0,retainedSha256:null,truncated:false,base64:null};
 const bytes=Buffer.isBuffer(value)?value:Buffer.from(value,'utf8'),retained=bytes.subarray(0,LIMIT);
 return {availability:'available',representation:Buffer.isBuffer(value)?'buffer-bytes':'execFile-utf8-text-reencoded',bytes:bytes.length,sha256:sha(bytes),retainedBytes:retained.length,retainedSha256:sha(retained),truncated:retained.length<bytes.length,base64:retained.toString('base64')};
}
function text(value){return typeof value==='string'?value.slice(0,LIMIT):null;}
export function errorEvidence(error){
 try{return {name:text(error?.name),message:text(error?.message),code:typeof error?.code==='number'||typeof error?.code==='string'?error.code:null,codeAvailable:error?.code!==undefined,killed:typeof error?.killed==='boolean'?error.killed:null,killedAvailable:typeof error?.killed==='boolean',signal:text(error?.signal),signalAvailable:error?.signal!==undefined,cmd:text(error?.cmd),stack:streamEvidence(typeof error?.stack==='string'?error.stack:undefined),stdout:streamEvidence(error?.stdout),stderr:streamEvidence(error?.stderr)};}
 catch{return {availability:'metadata-unavailable'};}
}
function childEvidence(child){
 if(!child)return {availability:'not-provided'};
 try{return {availability:'available',pid:Number.isSafeInteger(child.pid)?child.pid:null,exitCode:typeof child.exitCode==='number'?child.exitCode:null,signalCode:text(child.signalCode),killed:typeof child.killed==='boolean'?child.killed:null};}catch{return {availability:'metadata-unavailable'};}
}
export async function observeProcessReference(result,run,command,args,options,ownedPid){
 const before=performance.now(),receipt={phase:'independent-powershell-reference',ownedPid,command,args:[...args],configuration:{timeout:options.timeout,maxBuffer:options.maxBuffer,windowsHide:options.windowsHide},outcome:'PENDING'};
 result.reference=receipt;result.phase=receipt.phase;
 let child;
 try{const pending=run(command,args,options);child=pending.child;receipt.childBefore=childEvidence(child);const reply=await pending;receipt.outcome='RESOLVED';receipt.stdout=streamEvidence(reply.stdout);receipt.stderr=streamEvidence(reply.stderr);return reply;}
 catch(error){receipt.outcome='REJECTED';receipt.error=errorEvidence(error);throw error;}
 finally{receipt.elapsedMs=performance.now()-before;receipt.childAfter=childEvidence(child);}
}
export async function finishProcessEvidence(result,primary,cleanup,write,report){
 let first=primary,stage=primary?result.phase:null;result.finalErrors=[];
 const remember=(where,error)=>{if(!first){first=error;stage=where;}result.finalErrors.push({stage:where,error:errorEvidence(error)});};
 try{await cleanup();}catch(error){remember('cleanup',error);}
 const reflect=()=>{if(first){result.status='ADVERSE';result.primaryError={stage,error:errorEvidence(first)};try{const raw=String(first.stack||first);result.error=raw.slice(0,LIMIT);result.errorTruncated=raw.length>LIMIT;}catch{result.error='Primary error text unavailable';}}};
 reflect();
 try{await write(result);}catch(error){
  remember('result-write',error);reflect();
  try{report({status:'ADVERSE',primaryError:result.primaryError,finalErrors:result.finalErrors,reference:result.reference??null,limits:'Result write failed; diagnostic only, original primary thrown unchanged. killed alone is not proof of timeout.'});}
  catch(reportError){remember('fallback-report',reportError);}
 }
 if(first)throw first;
 return result;
}