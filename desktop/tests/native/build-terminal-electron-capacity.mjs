import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isElectronCapacityObserved,isExpectedElectronCapacityRefusal} from './terminal-electron-capacity-verdict.mjs';
import {captureTerminalCandidateGraph,recheckTerminalCandidateGraph} from './terminal-candidate-graph.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(desktop,'evidence/terminal-electron-capacity-build',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Eight actual Electron/node-pty startup snapshots and isolated Stop; no flood/peak memory/product admission',output,inputs:[],phases:[]},runner=join(desktop,'tests/native/terminal-electron-capacity.mjs');
for(const rel of ['tests/native/build-terminal-electron-capacity.mjs','tests/native/terminal-electron-capacity.mjs','tests/native/terminal-electron-broker-worker.mjs','tests/native/terminal-electron-capacity-verdict.mjs','tests/native/terminal-conpty-broker-derive.mjs','tests/native/terminal-conpty-platform.mjs','tests/native/terminal-candidate-graph.mjs','tests/fixtures/terminal-electron-broker.cs','tests/fixtures/terminal-electron-capacity.cs','tests/native/terminal-electron-capacity-derive.mjs','tests/fixtures/terminal-conpty-membership.cs','tests/fixtures/terminal-job-list.cs','tests/fixtures/terminal-node-pty/package.json','tests/fixtures/terminal-node-pty/package-lock.json']){const path=join(desktop,rel),b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,negative){const row={name};receipt.phases.push(row);await save();try{const r=await run(process.execPath,[runner,...(negative?['--negative']:[])],{cwd:desktop,windowsHide:true,shell:false,timeout:40000,maxBuffer:8*1024*1024});await writeFile(join(output,name+'.txt'),r.stdout+r.stderr,{flag:'wx'});row.status='success';return r;}catch(e){await writeFile(join(output,name+'-failed.txt'),(e.stdout??'')+(e.stderr??''),{flag:'wx'});row.status='failed';row.code=e.code;throw e;}finally{await save();}}
const valid=(r,negative)=>r?.negative===negative&&r.compileOnly===false&&r.processStarted===true&&r.qualified===true&&r.outerExitObserved===true&&r.outerExitCode===(negative?1:0)&&r.inputsUnchanged===true&&!r.deadlineExceeded&&!r.outputTruncated&&(negative?isExpectedElectronCapacityRefusal(r.native):isElectronCapacityObserved(r.native));
try{
 const packagePath=join(desktop,'tests/fixtures/terminal-node-pty/package.json');
 const graph=await captureTerminalCandidateGraph({packagePath}),graphPath=join(output,'dependency-graph.json'),graphBytes=Buffer.from(JSON.stringify(graph,null,2)+'\n');
 await writeFile(graphPath,graphBytes,{flag:'wx'});receipt.dependencyGraph={path:graphPath,bytes:graphBytes.length,sha256:hash(graphBytes),summary:graph.summary,unchanged:false};await save();
 try{await phase('omitted-first-of-eight-session-negative',true);throw Error('ELECTRON_CAPACITY_NEGATIVE_UNEXPECTED_SUCCESS');}catch(e){assert.equal(e.code,1);receipt.negative=JSON.parse(e.stdout.trim());assert.equal(valid(receipt.negative,true),true,'ELECTRON_CAPACITY_NEGATIVE_NOT_EXPECTED');receipt.phases[0].expectedRefusalVerified=true;}
 const positive=await phase('eight-pre-contained-electron-positive',false);receipt.positive=JSON.parse(positive.stdout.trim());assert.equal(valid(receipt.positive,false),true,'ELECTRON_CAPACITY_POSITIVE_INCOMPLETE');for(const input of receipt.inputs)assert.equal(hash(await readFile(input.path)),input.sha256,'INPUT_CHANGED');assert.equal((await recheckTerminalCandidateGraph({packagePath,receipt:graph})).unchanged,true,'CANDIDATE_GRAPH_CHANGED');receipt.dependencyGraph.unchanged=true;receipt.status='EIGHT_ELECTRON_CREATOR_CONTROLS_OBSERVED_NOT_ADMITTED';
}catch(e){receipt.status='FAILED';receipt.error={code:e.code,message:e.message};throw e;}finally{await save();console.log(JSON.stringify({status:receipt.status,output,admitted:false}));}
