// Actual Electron ABI prerequisite only. No PTY, shell or product integration.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve,dirname,parse} from 'node:path';
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const output=join(desktop,'evidence/terminal-job-lifetime',new Date().toISOString().replaceAll(':','-'));
const addon=resolve(process.argv[2]??join(desktop,'evidence/terminal-ownership-build/not-built/Release/terminal_job_lifetime.node'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
  try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const executable=join(desktop,'node_modules/electron/dist/electron.exe');
const receipt={schema:1,scope:'Test-only named Job OS lifetime in Electron main and utilityProcess; global process handles diagnostic only; no Terminal admission',admitted:false,
  output,addon,executableSha256:hash(await readFile(executable)),runnerSha256:hash(await readFile(fileURLToPath(import.meta.url)))};
try{receipt.addonSha256=hash(await readFile(addon));}catch(error){receipt.addonReadError=String(error.message??error);}
async function exercise(config){
 const assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{release}=await import('node:os');
 const runtime={versions:process.versions,arch:process.arch,os:release(),pid:process.pid},observations={opened:0,closed:0,verifiedDestroyed:0,globalHandleCountIsDiagnosticOnly:true};
 try{
  assert.equal(runtime.versions.electron,'44.5.1');assert.equal(runtime.versions.modules,'149');assert.equal(runtime.versions.napi,'10');assert.equal(runtime.arch,'x64');
  const require=createRequire(import.meta.url),native=require(config.addon),metrics=require(config.metricsAddon);
  observations.beforeHandles=metrics.processHandleCount();
  const canary=native.create();observations.opened++;
  assert.equal(Object.getOwnPropertyNames(canary).length,0);
  assert.deepEqual(native.probe(canary),{ownerOpen:true,objectExists:true},'OPEN_CANARY_NOT_OBSERVED');
  assert.equal(native.close(canary),true);observations.closed++;
  observations.afterCanaryClose=native.probe(canary);
  assert.deepEqual(observations.afterCanaryClose,{ownerOpen:false,objectExists:false},'JOB_LIFETIME_RETAINED');observations.verifiedDestroyed++;
  assert.equal(native.close(canary),false);
  for(const fake of [null,undefined,0,{},Object.create(canary),new Proxy(canary,{})]){
   assert.throws(()=>native.probe(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});assert.throws(()=>native.close(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});
  }
  assert.throws(()=>native.create({}),{code:'OWNERSHIP_REQUEST_REFUSED'});assert.throws(()=>native.probe(canary,{}),{code:'OWNERSHIP_REQUEST_REFUSED'});assert.throws(()=>native.close(canary,{}),{code:'OWNERSHIP_REQUEST_REFUSED'});
  const held=[canary];
  for(let i=0;i<128;i++){const item=native.create();observations.opened++;held.push(item);assert.deepEqual(native.probe(item),{ownerOpen:true,objectExists:true});}
  observations.simultaneouslyHeldOpen=128;
  for(const item of held.slice(1)){assert.equal(native.close(item),true);observations.closed++;assert.deepEqual(native.probe(item),{ownerOpen:false,objectExists:false},'JOB_LIFETIME_RETAINED');observations.verifiedDestroyed++;}
  for(let i=0;i<2000;i++){const item=native.create();observations.opened++;held.push(item);assert.deepEqual(native.probe(item),{ownerOpen:true,objectExists:true});assert.equal(native.close(item),true);observations.closed++;assert.deepEqual(native.probe(item),{ownerOpen:false,objectExists:false},'JOB_LIFETIME_RETAINED');observations.verifiedDestroyed++;}
  observations.afterHandles=metrics.processHandleCount();observations.globalHandleDelta=observations.afterHandles-observations.beforeHandles;
  assert.equal(observations.opened,2129);assert.equal(observations.verifiedDestroyed,observations.opened);assert.equal(held.length,2129);
  return {status:'PRIMITIVE_PASSED',runtime,observations,checks:['actual-runtime','actual-open-job-canary','same-OS-lifetime-oracle-after-close','held-wrappers-prevent-GC-rescue','128-simultaneously-open-canaries','2000-destroyed-objects','forged-owner-refused','extra-arguments-refused','idempotent-close']};
 }catch(error){return {status:'FAILED',runtime,observations,error:{code:error.code,message:error.message,stack:error.stack}};}
}
const config={addon,output,metricsAddon:resolve(process.argv[3]??join(desktop,'evidence/terminal-ownership-build/not-built/Release/terminal_ownership_probe.node'))};
try{receipt.metricsSha256=hash(await readFile(config.metricsAddon));}catch(error){receipt.metricsReadError=String(error.message??error);}
await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});
await writeFile(join(output,'host.mjs'),`const result=await (${exercise.toString()})(${JSON.stringify(config)});process.parentPort.postMessage(result);setTimeout(()=>process.exit(result.status==='PRIMITIVE_PASSED'?0:1),50);`,{flag:'wx'});
await writeFile(join(output,'main.mjs'),`
import {app,utilityProcess} from 'electron';
import {writeFile} from 'node:fs/promises';
const config=${JSON.stringify(config)};
app.setPath('userData',config.output+'/profile');
let host,done=false,timer,grace;const result={admitted:false};
async function finish(error){if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);if(result.deadlineExceeded&&!error)error=Error('HOST_DEADLINE_EXCEEDED');if(error)result.error=String(error.stack??error);await writeFile(config.output+'/native-result.json',JSON.stringify(result,null,2),{flag:'wx'});app.exit(error?1:0);}
app.whenReady().then(async()=>{
 try{
  result.main=await (${exercise.toString()})(config);
  if(result.main.status!=='PRIMITIVE_PASSED')throw Error('MAIN_PRIMITIVE_FAILED');
  host=utilityProcess.fork(config.output+'/host.mjs',[],{serviceName:'SIREN Job lifetime canary',stdio:'pipe'});
  host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});
  host.on('message',message=>{result.host=message;});
  host.on('exit',code=>{result.hostExitCode=code;void finish(code===0&&result.host?.status==='PRIMITIVE_PASSED'?null:Error('HOST_PRIMITIVE_FAILED'));});
  timer=setTimeout(()=>{result.deadlineExceeded=true;grace=setTimeout(()=>void finish(Error('HOST_EXIT_UNVERIFIED')),3000);try{result.killRequested=host.kill();}catch(error){result.killError=String(error.message??error);}},25000);
 }catch(error){await finish(error);}
});`,{flag:'wx'});
let logs='';
const child=spawn(executable,[output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].includes(key)))});
child.stdout.on('data',b=>{logs=(logs+b).slice(-32768);});child.stderr.on('data',b=>{logs=(logs+b).slice(-32768);});
const code=await new Promise((res,rej)=>{
  let settled=false,grace;receipt.exitObserved=false;
  const finish=(c,observed)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);receipt.exitObserved=observed;res(c);};
  const timer=setTimeout(()=>{receipt.outerDeadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{receipt.killRequested=child.kill();}catch(error){receipt.killError=String(error.message??error);}},40000);
  child.once('error',e=>{receipt.processError=String(e.message??e);finish(null,false);});child.once('exit',c=>finish(c,true));
});
receipt.exitCode=code;await writeFile(join(output,'electron.log'),logs,{flag:'wx'});
try{receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));}
catch(error){receipt.readbackError=error.message;}
try{receipt.addonReadbackSha256=hash(await readFile(addon));receipt.addonUnchanged=typeof receipt.addonSha256==='string'&&receipt.addonSha256===receipt.addonReadbackSha256;}catch(error){receipt.addonUnchanged=false;receipt.addonReadbackError=String(error.message??error);}
try{receipt.metricsReadbackSha256=hash(await readFile(config.metricsAddon));receipt.metricsUnchanged=typeof receipt.metricsSha256==='string'&&receipt.metricsSha256===receipt.metricsReadbackSha256;}catch(error){receipt.metricsUnchanged=false;receipt.metricsReadbackError=String(error.message??error);}
receipt.status=code===0&&receipt.exitObserved===true&&receipt.addonUnchanged===true&&receipt.metricsUnchanged===true&&!receipt.outerDeadlineExceeded&&!receipt.native?.deadlineExceeded&&receipt.native?.hostExitCode===0&&receipt.native?.main?.status==='PRIMITIVE_PASSED'&&receipt.native?.host?.status==='PRIMITIVE_PASSED'?'PREREQUISITE_PASSED':'FAILED';
await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify(receipt));assert.equal(receipt.status,'PREREQUISITE_PASSED');
