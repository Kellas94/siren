// Explicit local qualification driver. Does not activate any product adapter.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localNativeCasePassed,localNativeBatchPassed} from './terminal-local-case-verdict.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),run=promisify(execFile);
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert([3,4].includes(process.argv.length));
const prepareOnly=process.argv[3]==='--prepare-only',diagnosticOnly=process.argv[3]==='--diagnostic-only';
assert(process.argv.length===3||prepareOnly||diagnosticOnly);
const output=resolve(process.argv[2]),build=join(output,'build');
const digest=b=>createHash('sha256').update(b).digest('hex');
const input=async path=>{path=resolve(root,path);const b=await readFile(path);return {path,bytes:b.length,sha256:digest(b)};};
const helper=await input('desktop/tests/fixtures/terminal-main-owner-observer.cs');
assert.equal(helper.sha256,'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc');
const prefix=(await readFile(helper.path,'utf8')).split('    static List<Held> Hold(');assert.equal(prefix.length,2);
const observerSource=join(build,'local-observer.cs');
await writeFile(observerSource,prefix[0]+await readFile(join(root,'desktop/tests/fixtures/terminal-host-roster-observer-tail.cs'),'utf8'),{flag:'wx'});
const csc='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',observer=join(build,'local-observer.exe');
const compiled=await run(csc,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+observer,observerSource],{cwd:root,windowsHide:true,timeout:30000,maxBuffer:1048576});
await writeFile(join(build,'observer-compile.txt'),compiled.stdout+compiled.stderr,{flag:'wx'});
const inputs=await Promise.all([
 'desktop/native/terminal-host-roster-candidate/ownership.cc',
 'desktop/native/terminal-host-roster-candidate/peer-endpoints.inc',
 'desktop/tests/native/terminal-host-roster-local-worker.mjs',
 'desktop/tests/native/terminal-local-fixture-contract.mjs',
 'desktop/tests/native/terminal-local-case-verdict.mjs',
 'desktop/tests/fixtures/terminal-host-roster-local-payload.mjs',
 'desktop/tests/fixtures/terminal-host-roster-local-creator.mjs',
 'desktop/tests/fixtures/terminal-host-roster-observer-tail.cs',
 'desktop/tests/native/terminal-host-roster-local-runner.mjs',
 'desktop/src/terminal/host-async-receipt-contract.mjs',
 'desktop/src/terminal/host-async-captured-operation.mjs',
 helper.path,observerSource,observer,csc,process.execPath,
 join(build,'siren_terminal_host_roster_candidate.node'),
].map(input));
const byPath=p=>inputs.find(row=>row.path===resolve(p));
const worker=join(root,'desktop/tests/native/terminal-host-roster-local-worker.mjs');
const addon=join(build,'siren_terminal_host_roster_candidate.node');
const manifest={schema:1,scope:'LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION',nativeExecutionAdmitted:false,diagnosticOnly,node:process.versions,inputs,cases:[],boundaries:{electron:false,pty:false,connectedPeers:false,fullFaultMatrix:false,productActivation:false}};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
if(prepareOnly){await writeFile(join(output,'prepared.json'),JSON.stringify({status:'PREPARED_NOT_EXECUTED',nativeExecutionAdmitted:false,manifest},null,2)+'\n',{flag:'wx'});console.log('PREPARED_NOT_EXECUTED');process.exit(0);}
for(const mode of (diagnosticOnly?['zero','host-loss']:['zero','eight','listeners','accepts','captured','gc','session-async','host-loss','negative-no-stop','negative-js-hang'])){
 const dir=join(output,'case-'+mode);await mkdir(dir);
 const config={mode,addon,addonHash:byPath(addon).sha256,nodeHash:byPath(process.execPath).sha256,inputs,payload:join(root,'desktop/tests/fixtures/terminal-host-roster-local-payload.mjs'),creator:join(root,'desktop/tests/fixtures/terminal-host-roster-local-creator.mjs')};
 await writeFile(join(dir,'config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
 let exit=0,stdout='',stderr='',executionError=null;const started=new Date().toISOString();
 try{const r=await run(observer,[process.execPath,worker,dir],{cwd:root,windowsHide:true,timeout:27000,maxBuffer:2*1048576});stdout=r.stdout;stderr=r.stderr;}
 catch(error){exit=error.code;stdout=error.stdout??'';stderr=error.stderr??'';executionError={message:error.message,errno:error.errno,syscall:error.syscall,killed:error.killed,signal:error.signal};}
 await writeFile(join(dir,'driver-output.json'),JSON.stringify({started,exit,stdout,stderr,executionError},null,2)+'\n',{flag:'wx'});
 let result=null;try{result=JSON.parse(await readFile(join(dir,'observer-result.json'),'utf8'));}catch{}
 const negative=mode.startsWith('negative-');
 const passed=localNativeCasePassed({mode,exit,result});
 manifest.cases.push({mode,exit,status:result?.status??'MISSING_OBSERVER_RESULT',error:result?.error??null,passed,negative});
 await writeFile(join(output,'progress.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log(JSON.stringify(manifest.cases.at(-1)));
 if(!result&&typeof exit!=='number'){manifest.blockedByObserverStartup=true;break;}
 // Continue bounded cases on failure, preserving every original result.
}
for(const row of inputs)assert.equal((await input(row.path)).sha256,row.sha256,'INPUT_DRIFT:'+row.path);
manifest.status='BOUNDED_LOCAL_NATIVE_CASES_PASSED';
if(!localNativeBatchPassed(manifest))manifest.status='LOCAL_NATIVE_FAILURES';
if(diagnosticOnly)manifest.status='DIAGNOSTIC_ONLY_NOT_QUALIFIED';
await writeFile(join(output,'result.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
process.exitCode=localNativeBatchPassed(manifest)?0:1;
