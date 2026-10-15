// Two fixed contained controls; deliberately separate from the shared study.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isConptyBrokerObserved,isExpectedConptyBrokerRefusal} from './terminal-conpty-broker-verdict.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(desktop,'evidence/terminal-conpty-broker-membership-build',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Fixed per-HPCON pre-contained workers; no native Terminal/backend admission',output,inputs:[],phases:[]},runner=join(desktop,'tests/native/terminal-conpty-broker-membership.mjs');
for(const path of [fileURLToPath(import.meta.url),runner,join(desktop,'tests/native/terminal-conpty-broker-verdict.mjs'),join(desktop,'tests/native/terminal-conpty-broker-derive.mjs'),join(desktop,'tests/fixtures/terminal-conpty-broker-membership.cs'),join(desktop,'tests/fixtures/terminal-conpty-membership.cs'),join(desktop,'tests/fixtures/terminal-job-list.cs')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,negative){
 const row={name};receipt.phases.push(row);await save();
 try{const r=await run(process.execPath,[runner,...(negative?['--negative']:[])],{cwd:desktop,windowsHide:true,shell:false,timeout:40000,maxBuffer:8*1024*1024});await writeFile(join(output,name+'.txt'),r.stdout+r.stderr,{flag:'wx'});row.status='success';return r;}
 catch(e){await writeFile(join(output,name+'-failed.txt'),(e.stdout??'')+(e.stderr??''),{flag:'wx'});row.status='failed';row.code=e.code;throw e;}
 finally{await save();}
}
const valid=(r,negative)=>r?.negative===negative&&r.compileOnly===false&&r.processStarted===true&&r.qualified===true&&r.outerExitObserved===true&&r.outerExitCode===(negative?1:0)&&r.inputsUnchanged===true&&!r.deadlineExceeded&&!r.outputTruncated&&(negative?isExpectedConptyBrokerRefusal(r.native):isConptyBrokerObserved(r.native));
try{
 try{await phase('omitted-worker-session-negative',true);throw Error('BROKER_NEGATIVE_UNEXPECTED_SUCCESS');}
 catch(e){assert.equal(e.code,1);receipt.negative=JSON.parse(e.stdout.trim());assert.equal(valid(receipt.negative,true),true,'BROKER_NEGATIVE_NOT_EXPECTED');receipt.phases[0].expectedRefusalVerified=true;}
 const positive=await phase('pre-contained-workers-positive',false);receipt.positive=JSON.parse(positive.stdout.trim());assert.equal(valid(receipt.positive,false),true,'BROKER_POSITIVE_INCOMPLETE');
 for(const input of receipt.inputs)assert.equal(hash(await readFile(input.path)),input.sha256,'INPUT_CHANGED');
 receipt.status='CONPTY_BROKER_CONTROLS_OBSERVED_TERMINAL_NOT_ADMITTED';
}catch(e){receipt.status='FAILED';receipt.error={code:e.code,message:e.message};throw e;}
finally{await save();console.log(JSON.stringify({status:receipt.status,output,admitted:false}));}
