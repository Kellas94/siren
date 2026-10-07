// Test-owned real Electron host containment; no ConPTY or product admission.
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const output=join(desktop,'evidence/terminal-host-guard',new Date().toISOString().replaceAll(':','-'));
const addon=resolve(process.argv[2]??join(desktop,'evidence/terminal-host-guard-build/not-built/terminal_host_guard.node'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
 try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const executable=join(desktop,'node_modules/electron/dist/electron.exe');
const fixture=join(output,'fixed-job-child.exe'),compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const fixtureSource=join(desktop,'tests/fixtures/terminal-job-list.cs');
const receipt={schema:1,scope:'Isolated actual Electron utility host Job and native host-death monitor; no session/ConPTY/product admission',admitted:false,output,addon,
 runnerSha256:hash(await readFile(fileURLToPath(import.meta.url))),executableSha256:hash(await readFile(executable)),fixtureSourceSha256:hash(await readFile(fixtureSource)),compilerSha256:hash(await readFile(compiler))};
try{receipt.addonSha256=hash(await readFile(addon));}catch(error){receipt.addonReadError=error.message;}
const built=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/out:'+fixture,fixtureSource],{windowsHide:true,timeout:30000,maxBuffer:65536});
await writeFile(join(output,'compiler.txt'),built.stdout+built.stderr,{flag:'wx'});receipt.fixtureSha256=hash(await readFile(fixture));
async function host(config){
 const {spawn}=await import('node:child_process'),{readFile}=await import('node:fs/promises'),{join}=await import('node:path');
 const {setTimeout:delay}=await import('node:timers/promises');
 let begun=false;setTimeout(()=>process.exit(93),8000);
 process.parentPort.on('message',async event=>{
  const m=event.data;
  if(m?.kind==='exit'){setTimeout(()=>process.exit(0),100);return;}
  if(m?.kind!=='go'||begun)return;begun=true;
  try{
   const child=spawn(config.fixture,['root',config.directory],{windowsHide:true,stdio:'ignore'});child.on('error',error=>process.parentPort.postMessage({kind:'failed',error:error.message}));
   const pids={};const deadline=Date.now()+3000;
   for(const key of ['root','branch','grandchild','detached']){
    for(;;){try{pids[key]=Number(await readFile(join(config.directory,key+'.ready'),'utf8'));break;}catch(error){if(error.code!=='ENOENT'||Date.now()>deadline)throw error;await delay(10);}}
   }
   process.parentPort.postMessage({kind:'ready',pids});
  }catch(error){process.parentPort.postMessage({kind:'failed',error:String(error.stack??error)});}
 });
 process.parentPort.postMessage({kind:'hello',pid:process.pid});
}
async function main(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{mkdir,writeFile}=await import('node:fs/promises'),{join}=await import('node:path');
 const {setTimeout:delay}=await import('node:timers/promises');
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const result={admitted:false,runtime:{versions:process.versions,arch:process.arch,pid:process.pid},cases:[],cleanup:[]};
 const owners=[],hosts=[];let native;
 const wait=async fn=>{const deadline=Date.now()+3000;for(;;){const value=fn();if(value)return value;if(Date.now()>deadline)throw Error('HOST_GUARD_WAIT_DEADLINE');await delay(10);}};
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.versions.napi,'10');assert.equal(process.arch,'x64');
  native=createRequire(import.meta.url)(config.addon);
  async function start(label){
   const directory=join(config.output,label);await mkdir(directory);const mark=native.mark();
   const h=utilityProcess.fork(config.hostEntry,[JSON.stringify({fixture:config.fixture,directory})],{serviceName:'SIREN fixed host guard '+label,stdio:'pipe'});
   hosts.push(h);h.stdout?.on('data',()=>{});h.stderr?.on('data',()=>{});
   const state={};h.on('message',m=>{state[m.kind]=m;});h.on('exit',code=>{state.exitCode=code;state.exitObserved=true;});
   await wait(()=>state.hello);assert.equal(state.hello.pid,h.pid);assert.notEqual(h.pid,process.pid);
   assert.throws(()=>native.start(h.pid,config.executable+'.wrong',mark),{code:'HOST_IDENTITY_REFUSED'});
   assert.throws(()=>native.start(h.pid,config.executable,mark+100000000000n),{code:'HOST_IDENTITY_REFUSED'});
   const owner=native.start(h.pid,config.executable,mark);owners.push(owner);
   for(const fake of [null,{},Object.create(owner),new Proxy(owner,{})])assert.throws(()=>native.snapshot(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});
   const initial=native.snapshot(owner);assert.equal(initial.active,1);assert.equal(initial.root.pid,h.pid);assert.equal(initial.root.alive,true);assert.equal(initial.killOnClose,true);assert.equal(initial.breakaway,false);assert.equal(initial.inheritable,false);
   h.postMessage({kind:'go'});await wait(()=>{if(state.failed)throw Error(state.failed.error);return state.ready;});
   const captured=native.capture(owner),pids=Object.values(state.ready.pids);assert.equal(new Set(pids).size,4);
   assert.equal(captured.held.length,captured.active);assert.ok(captured.held.length>=5&&captured.held.length<=9);
   for(const pid of [h.pid,...pids])assert.ok(captured.held.some(p=>p.pid===pid&&p.alive));
   for(const p of captured.held){assert.match(p.createdFileTime,/^[1-9][0-9]+$/);assert.ok(p.image);assert.equal(p.alive,true);assert.ok(p.pid===h.pid||pids.includes(p.pid)||p.image.toLowerCase()===config.conhost.toLowerCase(),'UNEXPECTED_HOST_JOB_MEMBER');}
   result.cases.push({name:label,initial,captured,fixturePids:state.ready.pids});return {owner,h,state};
  }
  const a=await start('session-a'),b=await start('session-b');
  assert.equal(native.stop(a.owner,77),true);const stopped=await wait(()=>{const s=native.snapshot(a.owner);return s.active===0&&s.held.every(p=>!p.alive)?s:null;});
  assert.ok(stopped.held.every(p=>p.exitCode===77));result.stop=stopped;
  const untouched=native.snapshot(b.owner);assert.ok(untouched.active>=5);assert.ok(untouched.held.every(p=>p.alive));result.otherHostStillAlive=untouched;
  const blockedAt=Date.now();b.h.postMessage({kind:'exit'});
  // A native worker must reap descendants while this JS event loop cannot run.
  while(Date.now()-blockedAt<2000){}
  const after=native.snapshot(b.owner);result.afterBlockedHostExit=after;result.blockedMs=Date.now()-blockedAt;
  assert.equal(after.root.alive,false,'HOST_DID_NOT_EXIT_DURING_BLOCK');
  assert.equal(after.active,0,'HOST_DEATH_LEFT_OWNED_DESCENDANTS');assert.ok(after.held.every(p=>!p.alive),'HOST_DEATH_LEFT_HELD_PROCESS');
  assert.equal(after.monitorFired,true);assert.equal(after.monitorTerminateSucceeded,true);assert.ok(after.held.filter(p=>p.pid!==after.root.pid).every(p=>p.exitCode===79));
  result.status='HOST_GUARD_PASSED';
 }catch(error){result.status='FAILED';result.error={code:error.code,message:error.message,stack:error.stack};}
 finally{
  for(const owner of owners){try{native.stop(owner,98);const s=await wait(()=>{const q=native.snapshot(owner);return q.active===0&&q.held.every(p=>!p.alive)?q:null;});result.cleanup.push({verified:true,snapshot:s});native.close(owner);}catch(error){result.cleanup.push({verified:false,error:String(error.stack??error)});result.status='FAILED';}}
  for(const h of hosts){try{h.kill();}catch{}}
  await writeFile(join(config.output,'native-result.json'),JSON.stringify(result,null,2),{flag:'wx'});app.exit(result.status==='HOST_GUARD_PASSED'?0:1);
 }
}
const config={output,addon,fixture,executable,conhost:join(process.env.SystemRoot,'System32/conhost.exe'),hostEntry:join(output,'host.mjs')};
await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});
await writeFile(config.hostEntry,`void (${host.toString()})(JSON.parse(process.argv[2]));`,{flag:'wx'});
await writeFile(join(output,'main.mjs'),`void (${main.toString()})(${JSON.stringify(config)});`,{flag:'wx'});
let logs='';
const child=spawn(executable,[output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].includes(key)))});
child.stdout.on('data',b=>{logs=(logs+b).slice(-32768);});child.stderr.on('data',b=>{logs=(logs+b).slice(-32768);});
const code=await new Promise(resolve=>{
 let settled=false,grace;receipt.exitObserved=false;
 const finish=(code,observed)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);receipt.exitObserved=observed;resolve(code);};
 const timer=setTimeout(()=>{receipt.outerDeadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{receipt.killRequested=child.kill();}catch(error){receipt.killError=error.message;}},40000);
 child.once('error',error=>{receipt.processError=error.message;finish(null,false);});child.once('exit',code=>finish(code,true));
});
receipt.exitCode=code;await writeFile(join(output,'electron.log'),logs,{flag:'wx'});
try{receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));}catch(error){receipt.readbackError=error.message;}
try{receipt.addonReadbackSha256=hash(await readFile(addon));receipt.addonUnchanged=typeof receipt.addonSha256==='string'&&receipt.addonReadbackSha256===receipt.addonSha256;}catch{receipt.addonUnchanged=false;}
receipt.status=code===0&&receipt.exitObserved&&receipt.addonUnchanged&&!receipt.outerDeadlineExceeded&&receipt.native?.status==='HOST_GUARD_PASSED'&&receipt.native?.cleanup?.length===2&&receipt.native.cleanup.every(c=>c.verified)?'HOST_GUARD_PASSED':'FAILED';
await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));assert.equal(receipt.status,'HOST_GUARD_PASSED');
