// Test-owned external observer. Main is killed through the process handle the
// observer created; the outer safety Job remains open through observation.
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal} from './terminal-main-owner-loss-verdict.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(desktop,'evidence/terminal-main-owner-loss',new Date().toISOString().replaceAll(':','-'));
const addon=resolve(process.argv[2]??join(desktop,'evidence/terminal-host-guard-build/not-built/terminal_host_guard.node')),negative=process.argv.includes('--negative');
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(error){if(error.code!=='ENOENT')throw error;}}
await mkdir(output,{recursive:true});
const executable=join(desktop,'node_modules/electron/dist/electron.exe'),compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const receipt={schema:1,author:'coordinator native runner',admitted:false,scope:'External held-identity observer of abrupt actual Electron main-owner loss; no PTY/session/product admission',output,negative,inputs:[]};
const inputs=[fileURLToPath(import.meta.url),join(desktop,'tests/native/terminal-main-owner-loss-verdict.mjs'),join(desktop,'tests/native/terminal-host-guard.mjs'),join(desktop,'tests/fixtures/terminal-main-owner-observer.cs'),join(desktop,'tests/fixtures/terminal-job-list.cs'),executable,compiler];
for(const path of inputs){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
try{const b=await readFile(addon);receipt.inputs.push({path:addon,bytes:b.length,sha256:hash(b)});receipt.addonSha256=hash(b);}
catch(error){receipt.addonReadError=error.message;if(!negative){receipt.status='FAILED';await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));throw error;}}
const observer=join(output,'observer.exe'),fixture=join(output,'fixed-job-child.exe');
for(const [source,exe,extra] of [['tests/fixtures/terminal-main-owner-observer.cs',observer,['/reference:System.Web.Extensions.dll']],['tests/fixtures/terminal-job-list.cs',fixture,[]]]){
 const result=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/out:'+exe,...extra,join(desktop,source)],{windowsHide:true,timeout:30000,maxBuffer:65536});
 await writeFile(join(output,exe===observer?'observer-compiler.txt':'fixture-compiler.txt'),result.stdout+result.stderr,{flag:'wx'});const b=await readFile(exe);receipt.inputs.push({path:exe,bytes:b.length,sha256:hash(b)});
}
async function main(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{mkdir,writeFile,rename}=await import('node:fs/promises'),{join}=await import('node:path'),{setTimeout:delay}=await import('node:timers/promises');
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();setTimeout(()=>app.exit(94),7000);
 // Strongly hold wrappers until abrupt OS termination: GC must not close Jobs.
 const owners=globalThis.__mainLossOwners=[],hosts=globalThis.__mainLossHosts=[];
 const native=config.negative?null:createRequire(import.meta.url)(config.addon),groups=[];
 const wait=async fn=>{const deadline=Date.now()+2500;for(;;){const r=fn();if(r)return r;if(Date.now()>deadline)throw Error('MAIN_LOSS_HOST_READY_DEADLINE');await delay(5);}};
 for(const label of ['A','B']){
  const directory=join(config.output,label);await mkdir(directory);const mark=native?.mark();
  const h=utilityProcess.fork(config.hostEntry,[JSON.stringify({fixture:config.fixture,directory})],{serviceName:'SIREN fixed main-loss '+label,stdio:'pipe'});hosts.push(h);h.stdout?.on('data',()=>{});h.stderr?.on('data',()=>{});
  const state={};h.on('message',m=>{state[m.kind]=m;});h.on('exit',code=>{state.exited=code;});
  await wait(()=>state.hello);assert.equal(state.hello.pid,h.pid);assert.notEqual(h.pid,process.pid);
  for(const r of [process.versions,state.hello.versions]){assert.equal(r.electron,'44.5.1');assert.equal(r.node,'24.21.0');assert.equal(r.modules,'149');assert.equal(r.napi,'10');}assert.equal(state.hello.arch,'x64');assert.equal(process.arch,'x64');
  let owner;if(native){owner=native.start(h.pid,config.executable,mark);owners.push(owner);const initial=native.snapshot(owner);assert.equal(initial.root.pid,h.pid);assert.equal(initial.active,1);assert.equal(initial.killOnClose,true);assert.equal(initial.breakaway,false);assert.equal(initial.inheritable,false);}
  // In the intentional negative ONLY this inner guard is omitted. The external
  // observer's non-breakaway safety Job already contains main and every child.
  h.postMessage({kind:'go'});await wait(()=>{if(state.failed)throw Error(state.failed.error);return state.ready;});
  const captured=native?.capture(owner)??null,fixedPids=Object.values(state.ready.pids),requiredPids=captured?captured.held.map(p=>p.pid):[h.pid,...fixedPids];
  assert.equal(new Set([h.pid,...fixedPids]).size,5);for(const pid of [h.pid,...fixedPids])assert.ok(requiredPids.includes(pid));
  groups.push({hostPid:h.pid,hostRuntime:{versions:state.hello.versions,arch:state.hello.arch},fixturePids:state.ready.pids,requiredPids,captured});
 }
 const ready={mainPid:process.pid,guardEnabled:!config.negative,runtime:{versions:process.versions,arch:process.arch},groups};
 const temporary=join(config.output,'owner-ready.pending');await writeFile(temporary,JSON.stringify(ready),{flag:'wx'});await rename(temporary,join(config.output,'owner-ready.json'));
}
const original=await readFile(join(desktop,'tests/native/terminal-host-guard.mjs'),'utf8');
let host=original.slice(original.indexOf('async function host(config){'),original.indexOf('async function main(config){')).trim();
assert.ok(host.startsWith('async function host(config){'));
const hello="process.parentPort.postMessage({kind:'hello',pid:process.pid});";
assert.equal(host.split(hello).length,2);host=host.replace(hello,"process.parentPort.postMessage({kind:'hello',pid:process.pid,versions:process.versions,arch:process.arch});");
const application=join(output,'app');await mkdir(application);const hostEntry=join(application,'host.mjs');
const config={output,addon,negative,executable,fixture,hostEntry};
await writeFile(join(application,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});
await writeFile(hostEntry,'void ('+host+')(JSON.parse(process.argv[2]));',{flag:'wx'});
await writeFile(join(application,'main.mjs'),'void ('+main.toString()+')('+JSON.stringify(config)+').catch(error=>{console.error(error);process.exit(95);});',{flag:'wx'});
for(const name of ['package.json','host.mjs','main.mjs']){const path=join(application,name),b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
let stdout='',stderr='';
let child;
try{child=spawn(observer,[executable,application,output,fixture,negative?'negative':'positive'],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].includes(key)))});}
catch(error){receipt.processError={code:error.code,message:error.message};receipt.outerExitObserved=false;receipt.outerExitCode=null;receipt.status='FAILED';await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));throw error;}
child.stdout.on('data',b=>{stdout+=b;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-32768);});
const exitCode=await new Promise(resolve=>{
 let settled=false,grace;receipt.outerExitObserved=false;
 const finish=(code,observed)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};
 const timer=setTimeout(()=>{receipt.outerDeadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{receipt.killRequested=child.kill();}catch(error){receipt.killError=error.message;}},20000);
 child.once('error',error=>{receipt.processError=error.message;finish(null,false);});child.once('exit',code=>finish(code,true));
});
receipt.outerExitCode=exitCode;await writeFile(join(output,'observer.log'),stdout+stderr,{flag:'wx'});
try{receipt.observer=JSON.parse(await readFile(join(output,'observer-result.json'),'utf8'));receipt.observer.outerExitObserved=receipt.outerExitObserved;receipt.observer.outerExitCode=exitCode;}
catch(error){receipt.readbackError=error.message;}
receipt.inputsUnchanged=true;for(const input of receipt.inputs){try{if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;}catch{receipt.inputsUnchanged=false;}}
const runtime=r=>r?.versions?.electron==='44.5.1'&&r.versions.node==='24.21.0'&&r.versions.modules==='149'&&r.versions.napi==='10'&&r.arch==='x64';
receipt.runtimeVerified=runtime(receipt.observer?.ready?.runtime)&&receipt.observer.ready.groups.every(g=>runtime(g.hostRuntime));
receipt.qualified=!receipt.outerDeadlineExceeded&&!receipt.outputTruncated&&receipt.inputsUnchanged&&receipt.runtimeVerified&&(negative?isExpectedMainOwnerLossRefusal(receipt.observer):isMainOwnerLossComplete(receipt.observer));
receipt.status=receipt.qualified?(negative?'EXPECTED_MAIN_OWNER_LOSS_REFUSAL_VERIFIED':'MAIN_OWNER_LOSS_PASSED'):'FAILED';
await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));
if(negative){assert.equal(receipt.qualified,true);process.exitCode=1;}else assert.equal(receipt.status,'MAIN_OWNER_LOSS_PASSED');
