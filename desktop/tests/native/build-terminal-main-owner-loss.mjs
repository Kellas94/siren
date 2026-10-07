// Consume only this job's exactly qualified host prototype. No product input.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {join,dirname,parse} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal} from './terminal-main-owner-loss-verdict.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex'),run=promisify(execFile);
const buildRoot=join(desktop,'evidence/terminal-host-guard-build'),output=join(desktop,'evidence/terminal-main-owner-loss-build',new Date().toISOString().replaceAll(':','-'));
for(const root of [buildRoot,dirname(output)])for(let p=root;p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(error){if(error.code!=='ENOENT')throw error;}}
const entries=await readdir(buildRoot,{withFileTypes:true});assert.equal(entries.length,1,'EXACTLY_ONE_FRESH_HOST_BUILD_REQUIRED');assert.equal(entries[0].isDirectory(),true);assert.match(entries[0].name,/^[0-9TZ.-]+$/);
const parent=join(buildRoot,entries[0].name),hostReceiptPath=join(parent,'receipt.json'),hostReceiptBytes=await readFile(hostReceiptPath),host=JSON.parse(hostReceiptBytes);
assert.equal(host.status,'HOST_GUARD_CONTROL_VERIFIED_TERMINAL_NOT_ADMITTED');
assert.equal(host.negative.status,'FAILED');assert.equal(host.positive.status,'HOST_GUARD_PASSED');assert.equal(host.legacyFailedStop.status,'FAILED');assert.equal(host.fixedFailedStop.status,'HOST_GUARD_PASSED');
for(const input of host.sources)assert.equal(hash(await readFile(input.path)),input.sha256,'HOST_SOURCE_CHANGED');
const binary=host.binaries.find(b=>b.name==='terminal_host_guard');assert.ok(binary);assert.equal(binary.path,join(parent,'candidate/build/Release/terminal_host_guard.node'));assert.equal(hash(await readFile(binary.path)),binary.sha256,'HOST_BINARY_CHANGED');
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Actual externally observed Electron main-owner loss; no session/ConPTY/product admission',output,hostReceiptPath,hostReceiptSha256:hash(hostReceiptBytes),binary,inputs:[],phases:[]};
for(const path of [fileURLToPath(import.meta.url),join(desktop,'tests/native/terminal-main-owner-loss.mjs'),join(desktop,'tests/native/terminal-main-owner-loss-verdict.mjs'),join(desktop,'tests/fixtures/terminal-main-owner-observer.cs')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,args){
 const row={name,args};receipt.phases.push(row);await save();
 try{const result=await run(process.execPath,args,{cwd:desktop,windowsHide:true,shell:false,timeout:45000,maxBuffer:8*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].includes(key)))});await writeFile(join(output,name+'.txt'),result.stdout+result.stderr,{flag:'wx'});row.status='success';return result;}
 catch(error){await writeFile(join(output,name+'-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});row.status='failed';row.code=error.code;throw error;}
 finally{await save();}
}
const runner=join(desktop,'tests/native/terminal-main-owner-loss.mjs');
const valid=(r,negative)=>r?.negative===negative&&r.inputsUnchanged===true&&r.runtimeVerified===true&&!r.outerDeadlineExceeded&&!r.outputTruncated&&r.outerExitObserved===true&&r.addonSha256===binary.sha256&&r.qualified===true&&(negative?isExpectedMainOwnerLossRefusal(r.observer):isMainOwnerLossComplete(r.observer));
try{
 try{await phase('main-owner-loss-negative',[runner,binary.path,'--negative']);throw Error('MAIN_LOSS_NEGATIVE_UNEXPECTED_SUCCESS');}
 catch(error){assert.equal(error.code,1,'MAIN_LOSS_NEGATIVE_EXIT_UNEXPECTED');receipt.negative=JSON.parse(error.stdout.trim());assert.equal(valid(receipt.negative,true),true,'MAIN_LOSS_NEGATIVE_NOT_THE_EXPECTED_CONTAINED_FAILURE');receipt.phases[0].expectedRefusalVerified=true;}
 const tested=await phase('main-owner-loss-positive',[runner,binary.path]);receipt.positive=JSON.parse(tested.stdout.trim());assert.equal(valid(receipt.positive,false),true,'MAIN_LOSS_POSITIVE_INCOMPLETE');
 for(const input of [...receipt.inputs,binary,...host.sources])assert.equal(hash(await readFile(input.path)),input.sha256,'INPUT_CHANGED');assert.equal(hash(await readFile(hostReceiptPath)),receipt.hostReceiptSha256);
 receipt.status='MAIN_OWNER_LOSS_CONTROL_VERIFIED_TERMINAL_NOT_ADMITTED';
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message};throw error;}
finally{await save();console.log(JSON.stringify({status:receipt.status,output,admitted:false}));}
