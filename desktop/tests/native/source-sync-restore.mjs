// Preserve Python's raw JSON bytes: Win32 FILETIME exceeds JS Number precision.
import {spawn} from 'node:child_process';
import {mkdir,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {retainReceipt} from './restore-v7/receipt-retention.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),args=process.argv.slice(2);
assert(args.length===0||(args.length===2&&args[0]==='--package'&&isAbsolute(args[1])),'EXPLICIT_PACKAGE_ARGUMENTS_REQUIRED');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const python=process.env.SIREN_QA_PYTHON,head=process.env.SIREN_QA_SOURCE_COMMIT??process.env.GITHUB_SHA;
assert(python&&isAbsolute(python),'EXPLICIT_QA_PYTHON_REQUIRED');assert.match(head??'',/^[a-f0-9]{40}$/,'EXACT_SOURCE_COMMIT_REQUIRED');
const systemRoot=process.env.SystemRoot;assert(systemRoot&&isAbsolute(systemRoot),'WINDOWS_SYSTEM_ROOT_REQUIRED');
const powershell=join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'),conhost=join(systemRoot,'System32','conhost.exe');
const directory=resolve(root,'evidence/restore-v7-pipeline');await mkdir(directory,{recursive:true});
const id=randomUUID(),output=process.env.SIREN_QA_OUTPUT_ROOT??join(directory,id);assert(isAbsolute(output));
const command=[ '-B','-I','-S','-X','utf8',fileURLToPath(new URL('./restore-v7/pipeline.py',import.meta.url)),
 '--app',root,'--output',output,'--node',process.execPath,'--powershell',powershell,'--conhost',conhost,'--source-commit',head,...args];
const receipt={reviewMode:'AUTOMATED_OBSERVATIONS_REQUIRE_EXTERNAL_DATA_REVIEW',command:[python,...command],output,primaryError:null,finalErrors:[]};
let stdout,stderr;
try{
 stdout=await open(join(directory,id+'-stdout.bin'),'wx');stderr=await open(join(directory,id+'-stderr.bin'),'wx');
 const exit=await new Promise((ok,no)=>{
  const child=spawn(python,command,{cwd:root,windowsHide:true,shell:false,stdio:['ignore',stdout.fd,stderr.fd],timeout:900000});
  child.once('error',no);child.once('exit',(code,signal)=>ok({code,signal}));
 });Object.assign(receipt,exit);
 if(exit.code!==0||exit.signal!==null)receipt.primaryError={type:'PipelineExitFailure',...exit};
}catch(error){receipt.primaryError={type:error.name,message:error.message,code:error.code??null};}
finally{
 for(const [stage,handle] of [['stdout',stdout],['stderr',stderr]])if(handle)try{await handle.sync();await handle.close();}catch(error){receipt.finalErrors.push({stage,type:error.name,message:error.message});}
 await retainReceipt(join(directory,id+'-exit.json'),receipt,join(directory,id+'-exit-fallback.json'));
}
console.log(JSON.stringify({status:receipt.primaryError||receipt.finalErrors.length?'ADVERSE':'PIPELINE_COMPLETE_REQUIRES_INDEPENDENT_DATA',evidence:output}));
if(receipt.primaryError||receipt.finalErrors.length)process.exitCode=1;
