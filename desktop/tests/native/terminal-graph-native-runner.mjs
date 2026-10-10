// Explicit contained fixed graph probe; does not import graph code in the driver.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {graphNativeModes,graphNativeCasePassed,graphNativeBatchPassed} from './terminal-graph-native-verdict.mjs';
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.argv.length,4);
const root=fileURLToPath(new URL('../../../',import.meta.url)),output=resolve(process.argv[2]),addon=resolve(process.argv[3]),run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const pin=async path=>{path=resolve(root,path);const b=await readFile(path);return {path,bytes:b.length,sha256:hash(b)};};
await mkdir(output);const build=join(output,'build');await mkdir(build);
const sources=JSON.parse(await readFile(join(root,'desktop/tests/native/terminal-graph-native-inputs.json'),'utf8'));
const inputs=[];for(const r of sources.inputs){const actual=await pin(r.path);assert.equal(actual.bytes,r.bytes);assert.equal(actual.sha256,r.sha256);inputs.push(actual);}
const prefix=await readFile(join(root,'desktop/tests/fixtures/terminal-main-owner-observer.cs'),'utf8');assert.equal(hash(Buffer.from(prefix)),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc');const pieces=prefix.split('    static List<Held> Hold(');assert.equal(pieces.length,2);
const observerSource=join(build,'graph-observer.cs');await writeFile(observerSource,pieces[0]+await readFile(join(root,'desktop/tests/fixtures/terminal-host-roster-observer-tail.cs'),'utf8'),{flag:'wx'});
const csc='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',observer=join(build,'graph-observer.exe');
const compile=await run(csc,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+observer,observerSource],{cwd:root,windowsHide:true,timeout:30000,maxBuffer:1048576});await writeFile(join(build,'observer-compile.txt'),compile.stdout+compile.stderr,{flag:'wx'});
inputs.push(...await Promise.all([process.execPath,addon,csc,observerSource,observer,join(root,'desktop/tests/native/terminal-graph-native-inputs.json')].map(pin)));
const worker=join(root,'desktop/tests/native/terminal-graph-native-worker.mjs'),payload=join(root,'desktop/tests/fixtures/terminal-host-roster-local-payload.mjs');
const byPath=p=>inputs.find(r=>r.path===resolve(p)),manifest={schema:1,scope:'BOUNDED_WINDOWS_NODE_GRAPH_COMPOSITION',nativeExecutionAdmitted:false,inputs,cases:[],boundaries:{syntheticWindow:true,realNativeAddon:true,sessions:0,electron:false,pty:false,connectedPeers:false,fullFaultMatrix:false,productActivation:false}};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
for(const mode of graphNativeModes){
 const dir=join(output,'case-'+mode);await mkdir(dir);await writeFile(join(dir,'config.json'),JSON.stringify({mode,addon,addonHash:byPath(addon).sha256,nodeHash:byPath(process.execPath).sha256,inputs,payload},null,2)+'\n',{flag:'wx'});
 let exit=0,stdout='',stderr='',executionError=null;try{const r=await run(observer,[process.execPath,worker,dir],{cwd:root,windowsHide:true,timeout:27000,maxBuffer:2*1048576});stdout=r.stdout;stderr=r.stderr;}catch(e){exit=e.code;stdout=e.stdout??'';stderr=e.stderr??'';executionError={message:e.message,errno:e.errno,killed:e.killed,signal:e.signal};}
 await writeFile(join(dir,'driver-output.json'),JSON.stringify({exit,stdout,stderr,executionError},null,2)+'\n',{flag:'wx'});
 let result=null,blocked=null;try{result=JSON.parse(await readFile(join(dir,'observer-result.json'),'utf8'));}catch{}try{blocked=JSON.parse(await readFile(join(dir,'graph-blocked.json'),'utf8'));}catch{}
 const record={mode,exit,result,blocked},passed=graphNativeCasePassed(record);manifest.cases.push(record);console.log(JSON.stringify({mode,exit,status:result?.status??'MISSING_OBSERVER_RESULT',error:result?.error??null,passed}));
 await writeFile(join(output,'progress.json'),JSON.stringify(manifest,null,2)+'\n');if(!result&&typeof exit!=='number')break;
}
for(const r of inputs)assert.equal((await pin(r.path)).sha256,r.sha256,'INPUT_DRIFT:'+r.path);
manifest.status=graphNativeBatchPassed(manifest)?'BOUNDED_GRAPH_CASES_PASSED':'GRAPH_NATIVE_FAILURES';await writeFile(join(output,'result.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});process.exitCode=graphNativeBatchPassed(manifest)?0:1;
