// Actual Electron ABI prerequisite only. No PTY, shell or product integration.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join,resolve,dirname,parse} from 'node:path';
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const output=join(desktop,'evidence/terminal-ownership-addon',new Date().toISOString().replaceAll(':','-'));
const addon=resolve(process.argv[2]??join(desktop,'evidence/terminal-ownership-build/not-built/Release/terminal_ownership_probe.node'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
  try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const executable=join(desktop,'node_modules/electron/dist/electron.exe');
const receipt={schema:1,scope:'Native Job primitive load in actual Electron main and utilityProcess; no Terminal admission',admitted:false,
  output,addon,executableSha256:hash(await readFile(executable)),runnerSha256:hash(await readFile(fileURLToPath(import.meta.url)))};
try{receipt.addonSha256=hash(await readFile(addon));}catch(error){receipt.addonReadError=String(error.message??error);}
async function exercise(config){
  const assert=(await import('node:assert/strict')).default;
  const {createRequire}=await import('node:module');
  const {release}=await import('node:os');
  const runtime={versions:process.versions,arch:process.arch,os:release(),pid:process.pid};
  try{
    assert.equal(runtime.versions.electron,'44.5.1');assert.equal(runtime.versions.modules,'149');assert.equal(runtime.versions.napi,'10');assert.equal(runtime.arch,'x64');
    const native=createRequire(import.meta.url)(config.addon);
    const before=native.processHandleCount(),job=native.createJob(),info=native.describeJob(job);
    assert.equal(info.killOnClose,true);assert.equal(info.inheritable,false);assert.equal(info.activeProcesses,0);
    assert.equal(Object.getOwnPropertyNames(job).length,0,'native capabilities must not expose a raw handle');
    const poison={get handle(){throw Error('JS_GETTER_EXECUTED');}};
    for(const fake of [null,undefined,0,1n,{},poison,Object.create(job),new Proxy(job,{})]){
      assert.throws(()=>native.describeJob(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});
      assert.throws(()=>native.closeJob(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});
    }
    assert.throws(()=>native.createJob({}),{code:'OWNERSHIP_REQUEST_REFUSED'});
    assert.throws(()=>native.describeJob(job,{}),{code:'OWNERSHIP_REQUEST_REFUSED'});
    assert.equal(native.closeJob(job),true);assert.equal(native.closeJob(job),false);
    assert.throws(()=>native.describeJob(job),{code:'OWNERSHIP_CLOSED'});
    const held=[];
    for(let i=0;i<2000;i++){const owner=native.createJob();assert.equal(native.describeJob(owner).activeProcesses,0);assert.equal(native.closeJob(owner),true);held.push(owner);}
    const after=native.processHandleCount();assert.ok(after-before<=16,`handle growth ${after-before}`);
    return {status:'PRIMITIVE_PASSED',runtime,checks:['actual-runtime','non-inherited-kill-on-close-job','opaque-native-owner','forged-owner-refused','extra-arguments-refused','closed-owner-refused','idempotent-close','2000-explicit-close-handle-bound'],beforeHandles:before,afterHandles:after};
  }catch(error){return {status:'FAILED',runtime,error:{code:error.code,message:error.message,stack:error.stack}};}
}
const config={addon,output};
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
  host=utilityProcess.fork(config.output+'/host.mjs',[],{serviceName:'SIREN isolated Job primitive',stdio:'pipe'});
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
receipt.status=code===0&&receipt.exitObserved===true&&receipt.addonUnchanged===true&&!receipt.outerDeadlineExceeded&&!receipt.native?.deadlineExceeded&&receipt.native?.hostExitCode===0&&receipt.native?.main?.status==='PRIMITIVE_PASSED'&&receipt.native?.host?.status==='PRIMITIVE_PASSED'?'PREREQUISITE_PASSED':'FAILED';
await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});
console.log(JSON.stringify(receipt));assert.equal(receipt.status,'PREREQUISITE_PASSED');
