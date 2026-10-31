import {mkdir,lstat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {admitFreshData,captureOwnedData,evidenceStep} from './source-sync-evidence.mjs';

// Capture only freshly admitted synthetic Data. Never copy a used preview's Data.
export async function prepareActivityData({evidence,packageRoot,copyPackage,admissions={}}){
 if(packageRoot)admissions.packageSource=await admitFreshData(join(packageRoot,'Data'));
 const packaged=await copyPackage(),data=packaged?.data??join(evidence,'owned-data');
 admissions.ownedData=await admitFreshData(data);await mkdir(data,{recursive:true});
 return {packaged,data,admissions};
}
async function rawDirectory(evidence){
 for(let at=resolve(evidence);;at=resolve(at,'..')){const info=await lstat(at);if(info.isSymbolicLink()||!info.isDirectory())throw Error('EVIDENCE_DIRECTORY_OR_REPARSE_REFUSED');if(at===resolve(at,'..'))break;}
 const root=join(evidence,'raw-captures');await mkdir(root,{recursive:true});const info=await lstat(root);if(info.isSymbolicLink()||!info.isDirectory())throw Error('EVIDENCE_DIRECTORY_OR_REPARSE_REFUSED');return root;
}
export async function retainActivityRawEvidence(result,{data,evidence},when){
 if(!['beforeClose','afterClose'].includes(when))throw Error('RETENTION_PHASE_REFUSED');
 const raw=result.rawEvidence??={};if(Object.hasOwn(raw,when))return raw[when];
 const phase=when==='afterClose'?'after-close':result.status==='COMPLETE'?'before-close-success':'before-close-failure';
 raw[when]={phase,captureComplete:false,attempted:Boolean(data)};
 await evidenceStep(result,'raw-'+phase,async()=>{
  const root=await rawDirectory(evidence),at=join(root,phase);
  if(!data){await mkdir(at);await writeFile(join(at,'exports.json'),JSON.stringify({phase,state:'UNAVAILABLE_BEFORE_OWNED_DATA_ADMISSION',files:[],limits:'No unadmitted or used Data was read; this is not evidence of export absence.'},null,2),{flag:'wx'});throw Error('OWNED_DATA_NOT_ADMITTED_NO_CAPTURE');}
  const manifest=await captureOwnedData({dataRoot:data,outputRoot:root,phase});raw[when]=manifest;
  const exports=manifest.files.filter(row=>/^Projects\/[^/]+\/exports\//.test(row.relativePath));
  const state=!manifest.captureComplete?'CAPTURE_INCOMPLETE_EXPORT_UNKNOWN':exports.length?'CAPTURED_EXPORT_FILES':'NO_EXPORT_IN_CAPTURE';
  await writeFile(join(at,'exports.json'),JSON.stringify({phase,state,files:exports,scope:'Discovered files under synthetic Projects/*/exports; bytes retained unchanged in files/. Absence is scoped to a complete capture.'},null,2),{flag:'wx'});
  if(!manifest.captureComplete||!manifest.stableAroundCopy)throw Error('RAW_CAPTURE_INCOMPLETE_OR_UNSTABLE: '+JSON.stringify(manifest.errors));
 });
 return raw[when];
}
async function retainRuntimeLog(result,driver,evidence,phase){
 await evidenceStep(result,'runtime-log-'+phase,async()=>{
  const root=await rawDirectory(evidence),bytes=Buffer.from(driver?.logs()??''),retained=bytes.subarray(0,1024*1024);
  (result.runtimeLogs??={})[phase]={available:Boolean(driver),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),retainedBytes:retained.length,truncated:retained.length!==bytes.length};
  await writeFile(join(root,'docs-activity-runtime-'+phase+'.log'),retained,{flag:'wx'});
 });
}
export async function finalizeActivityEvidence({result,driver,data,evidence,captureInputs,inputs,packaged}){
 await retainActivityRawEvidence(result,{data,evidence},'beforeClose');
 await retainRuntimeLog(result,driver,evidence,'before-close');
 await evidenceStep(result,'legacy-runtime-log',async()=>{if(driver)await writeFile(join(evidence,'electron.log'),driver.logs(),{flag:'wx'});});
 result.driverCloseReturned=false;
 await evidenceStep(result,'driver-close',async()=>{if(driver){await driver.close();result.driverCloseReturned=true;}});
 await retainRuntimeLog(result,driver,evidence,'after-close');
 await retainActivityRawEvidence(result,{data,evidence},'afterClose');
 result.afterInputs=await evidenceStep(result,'source-input-readback',captureInputs);
 await evidenceStep(result,'source-input-preservation',async()=>{
  result.changedInputs=Object.keys({...inputs,...result.afterInputs}).filter(path=>inputs?.[path]!==result.afterInputs?.[path]);
  result.inputsUnchanged=Boolean(inputs&&result.afterInputs)&&result.changedInputs.length===0;
  if(!result.inputsUnchanged)throw Error('SOURCE_INPUTS_CHANGED_OR_UNREADABLE');
 });
 if(packaged){
  await evidenceStep(result,'package-identity',async()=>{result.package={sourceCommit:packaged.receipt?.sourceCommit,copy:packaged.copy,archive:packaged.receipt?.appArchive,runtime:packaged.receipt?.runtimeBinary,processReader:packaged.receipt?.processReader};});
  result.packageUnchanged=false;
  await evidenceStep(result,'package-verification',async()=>{try{await packaged.verify();result.packageUnchanged=true;}catch(cause){result.packageError=cause.message;throw cause;}});
 }
 result.rawEvidence.limits='Only freshly admitted synthetic Projects/Recovery/session-selection are captured; PIN/account/cache excluded. Live copy is non-atomic, even when before/after hashes match. After-close requires external process-quiescence and final actual Data evidence. Empty directories are manifest metadata; upload ZIPs may omit physical empty directories. Runtime snapshots can duplicate one event; truncated logs are explicitly identified.';
 if(result.primaryFailure||result.retentionErrorCount)result.status='ADVERSE';
 return result;
}
export async function persistActivityResult({result,evidence}){
 result.endedAt=new Date().toISOString();
 return await evidenceStep(result,'result-json',async()=>{await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});return true;})===true;
}
