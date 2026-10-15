// Hosted-only actual Electron main/utility ABI probe. No Jobs, shell or Sessions.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {electronRosterAbiPassed} from './terminal-electron-roster-contract.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-roster-20261010');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.argv.length,4);
const output=resolve(process.argv[2]),buildPath=resolve(process.argv[3]),build=JSON.parse(await readFile(buildPath,'utf8'));
assert.equal(build.status,'COMPILED_ELECTRON_TARGET_NOT_RUNTIME_QUALIFIED');
const hash=b=>createHash('sha256').update(b).digest('hex'),pin=async path=>{const b=await readFile(path);return{path,bytes:b.length,sha256:hash(b)};};
await mkdir(output);const addon=build.binary.path,executable=build.executable.path;
assert.deepEqual(await pin(addon),build.binary);assert.deepEqual(await pin(executable),build.executable);
const config={output,addon,executable,addonSha256:build.binary.sha256,executableSha256:build.executable.sha256};
async function exercise(config,role){
 const assert=(await import('node:assert/strict')).default,{createRequire}=await import('node:module'),{readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const digest=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
 const result={role,pid:process.pid,runtime:{...process.versions,arch:process.arch,platform:process.platform,electronRunAsNode:!!process.env.ELECTRON_RUN_AS_NODE,processType:process.type},status:'FAILED'};
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.versions.napi,'10');assert.equal(process.arch,'x64');assert.equal(process.platform,'win32');assert.equal(result.runtime.electronRunAsNode,false);
  result.addonSha256=await digest(config.addon);result.executableSha256=await digest(process.execPath);assert.equal(result.addonSha256,config.addonSha256);assert.equal(result.executableSha256,config.executableSha256);
  const native=createRequire(import.meta.url)(config.addon);
  const names=['createPeerSession','createPeerListeners','acceptPeerLane','connectPeerLane','peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint','closePeerListeners','peerSnapshot','consumePeerBootstrap','closePeerWitness','captureHostShutdownPeerRoster','captureHostShutdownExpectation','stopAndCloseHostAsync','stopAndCloseSessionAsync','createBootstrappedSession','createSession','watchRoot','captureSession','snapshotSession','stopSession','closeSession','captureCompositionHost','mark','start','capture','snapshot','stop','close'];
  assert.deepEqual(Object.getOwnPropertyNames(native).sort(),[...names].sort());for(const name of names)assert.equal(typeof native[name],'function');result.exportsChecked=names.length;
  let previous=0n;for(let i=0;i<2048;i++){const value=native.mark();assert.equal(typeof value,'bigint');assert(value>0n&&value>=previous);previous=value;}result.markSamples=2048;result.markMonotonic=true;
  let getterCalls=0;const poison={get handle(){getterCalls++;throw Error('GETTER_EXECUTED');}};
  const fakes=[null,undefined,0,1n,{},poison,Object.create(null),new Proxy({},{}),[]];
  for(const fake of fakes)assert.throws(()=>native.snapshot(fake),{code:'OWNERSHIP_REQUEST_REFUSED'});
  assert.throws(()=>native.mark(1),{code:'OWNERSHIP_REQUEST_REFUSED'});assert.throws(()=>native.stopAndCloseHostAsync({},77,1,'abi'),{code:'OWNERSHIP_REQUEST_REFUSED'});
  result.forgedRefusals=fakes.length;result.getterCalls=getterCalls;assert.equal(getterCalls,0);
  assert.equal(await digest(config.addon),result.addonSha256);assert.equal(await digest(process.execPath),result.executableSha256);result.status='ABI_CONTEXT_PASSED';
 }catch(e){result.error={message:e.message,stack:e.stack,code:e.code};}return result;
}
await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});
await writeFile(join(output,'utility.mjs'),`const r=await (${exercise.toString()})(${JSON.stringify(config)},'utility');process.parentPort.postMessage(r);setTimeout(()=>process.exit(r.status==='ABI_CONTEXT_PASSED'?0:1),50);`,{flag:'wx'});
await writeFile(join(output,'main.mjs'),`
import {app,utilityProcess} from 'electron';
import {writeFile} from 'node:fs/promises';
const config=${JSON.stringify(config)};
app.setPath('userData',config.output+'/profile');app.disableHardwareAcceleration();
let host,timer,grace,done=false;const result={status:'FAILED',deadlineExceeded:false,hostExitObserved:false};
async function finish(error){if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);if(error)result.error=String(error.stack??error);if(!error&&!result.deadlineExceeded&&result.main?.status==='ABI_CONTEXT_PASSED'&&result.utility?.status==='ABI_CONTEXT_PASSED'&&result.hostExitObserved&&result.hostExitCode===0)result.status='ABI_PAIR_PASSED';await writeFile(config.output+'/native-result.json',JSON.stringify(result,null,2)+'\\n',{flag:'wx'});app.exit(result.status==='ABI_PAIR_PASSED'?0:1);}
app.whenReady().then(async()=>{try{
 result.main=await (${exercise.toString()})(config,'main');if(result.main.status!=='ABI_CONTEXT_PASSED')throw Error('MAIN_ABI_FAILED');
 host=utilityProcess.fork(config.output+'/utility.mjs',[],{serviceName:'SIREN contained ABI prerequisite',stdio:'pipe'});host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});
 host.on('message',r=>{result.utility=r;});host.on('exit',code=>{result.hostExitObserved=true;result.hostExitCode=code;void finish(code===0?null:Error('UTILITY_ABI_FAILED'));});
 timer=setTimeout(()=>{result.deadlineExceeded=true;try{result.killRequested=host.kill();}catch(e){result.killError=String(e);}grace=setTimeout(()=>void finish(Error('UTILITY_EXIT_UNVERIFIED')),3000);},20000);
}catch(e){await finish(e);}});
`,{flag:'wx'});
const receipt={scope:'ELECTRON_ROSTER_ABI_ONLY',nativeExecutionAdmitted:false,build,executable:build.executable,exitObserved:false,exitCode:null,outerDeadlineExceeded:false};
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')));
const child=spawn(executable,[output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env});let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b.toString()).slice(-65536));
await new Promise(resolveDone=>{let done=false,grace;const finish=()=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);resolveDone();};const timer=setTimeout(()=>{receipt.outerDeadlineExceeded=true;try{receipt.killRequested=child.kill();}catch(e){receipt.killError=String(e);}grace=setTimeout(finish,3000);},35000);child.once('error',e=>{receipt.processError=String(e);finish();});child.once('exit',code=>{receipt.exitObserved=true;receipt.exitCode=code;finish();});});
await writeFile(join(output,'electron.log'),logs,{flag:'wx'});
try{receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));}catch(e){receipt.readbackError=String(e);}
receipt.addonReadbackSha256=(await pin(addon)).sha256;receipt.runtimeReadbackSha256=(await pin(executable)).sha256;
receipt.status=electronRosterAbiPassed(receipt)?'ABI_ONLY_SUPPORTED':'FAILED';await writeFile(join(output,'result.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:receipt.status,main:receipt.native?.main?.status,utility:receipt.native?.utility?.status,output,nativeExecutionAdmitted:false}));assert.equal(receipt.status,'ABI_ONLY_SUPPORTED');
