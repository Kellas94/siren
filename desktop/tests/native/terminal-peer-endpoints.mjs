// Guarded, finite hosted native peer experiment derived from the normal fixture. Never product admission.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse,resolve,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {requireCandidateCi,PUBLICATION_INPUTS,validateCandidateObservation} from './terminal-peer-endpoints-contract.mjs';
requireCandidateCi({platform:process.platform,arch:process.arch,node:process.version,env:process.env});
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.argv.length,3,'ONE_ABSOLUTE_ADDON_REQUIRED');assert.ok(isAbsolute(process.argv[2]),'ONE_ABSOLUTE_ADDON_REQUIRED');const addon=resolve(process.argv[2]);
const output=join(desktop,'evidence/terminal-peer-endpoints-observation','SIREN env Ω space-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,negative:false,compileOnly:false,scope:'Finite real PowerShell, fixed command, Lock completion, creator history replay and held Stop; no product input/resize/peer/package admission',output,inputs:[],processStarted:false};
async function controlHost(){process.parentPort.postMessage({kind:'hello',pid:process.pid});setTimeout(()=>process.exit(95),25000);setInterval(()=>{},1000);}
async function creator(worker,reader,addon){
 const {writeFile,rename}=await import('node:fs/promises'),{join}=await import('node:path'),{types}=await import('node:util');
 const stages=['addon-loaded','bootstrap-read','worker-imported','worker-entered','control-connected','history-connected'];
 const diagnostic={schema:1,diagnosticOnly:true,admitted:false,stages:[],failure:null,consumeFailure:null},path=join(process.argv[2],'peer-creator-diagnostic.json');
 const classifyError=function classifyPeerDiagnosticError(error,isProxy){
 const codes=['ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ERR_INVALID_ARG_TYPE','ERR_INVALID_MODULE_SPECIFIER','ERR_ASSERTION','ERR_INVALID_PACKAGE_CONFIG','ERR_UNKNOWN_FILE_EXTENSION','ERR_UNSUPPORTED_DIR_IMPORT','ERR_REQUIRE_ESM','ENOENT','EACCES','EPERM','ENOSPC',
  'TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED','TERMINAL_PEER_BOOTSTRAP_REFUSED','TERMINAL_PEER_BOOTSTRAP_TIMEOUT','NATIVE_PEER_STREAM_UNAVAILABLE','PEER_DIAGNOSTIC_BOUND','PEER_DIAGNOSTIC_STAGE','PEER_DIAGNOSTIC_CALLBACK_REFUSED',
  'PEER_ACCEPT_REFUSED','PEER_BIND_REFUSED','PEER_BOOTSTRAP_REFUSED','PEER_CAPABILITY_CLOSED','PEER_CAPABILITY_FINALIZED','PEER_CAPABILITY_REFUSED','PEER_CAPACITY_REFUSED','PEER_CLOSE_CAPACITY','PEER_CONNECT_FAILED','PEER_CONNECT_REFUSED','PEER_DACL_FAILED','PEER_DEADLINE','PEER_ENDPOINT_STALE','PEER_ENVIRONMENT_CLOSING','PEER_ENVIRONMENT_UNAVAILABLE','PEER_EOF','PEER_EVENT_FAILED','PEER_EXPLICIT_CLOSE','PEER_HOST_UNAVAILABLE','PEER_IDENTITY_DUPLICATE_FAILED','PEER_IDENTITY_LOST','PEER_IDENTITY_REFUSED','PEER_LISTENER_CREATE_FAILED','PEER_MAIN_IDENTITY_FAILED','PEER_NAME_REFUSED','PEER_NAPI_FAILURE','PEER_OWNER_RETIRED','PEER_PARTIAL_WRITE','PEER_PROCESS_EXITED','PEER_READ_BUSY','PEER_READ_FAILED','PEER_READ_LIMIT','PEER_REQUEST_CAPACITY','PEER_REQUEST_REFUSED','PEER_RETIRED','PEER_SESSION_RETIRED','PEER_STALE_COMPLETION','PEER_STARTUP_ABORTED','PEER_STARTUP_DEADLINE','PEER_STARTUP_REFUSED','PEER_THREAD_FAILED','PEER_TSFN_FAILED','PEER_WAIT_FAILED','PEER_WITNESS_CLOSE_FAILED','PEER_WITNESS_CLOSED','PEER_WITNESS_DUPLICATE_FAILED','PEER_WITNESS_REFUSED','PEER_WRITE_CAPACITY','PEER_WRITE_FAILED','PEER_WRITE_REFUSED'];
 const names=['Error','TypeError','RangeError','SyntaxError','ReferenceError','AssertionError','AggregateError'];
 const result={code:'UNKNOWN',name:'Error'};
 if(!error||typeof error!=='object'||isProxy(error))return result;
 for(const key of ['code','message']){
  const descriptor=Object.getOwnPropertyDescriptor(error,key);
  if(descriptor&&Object.hasOwn(descriptor,'value')){const code=codes.find(value=>value===descriptor.value);if(code){result.code=code;break;}}
 }
 let object=error;
 for(let depth=0;object&&depth<4;depth++){
  if(isProxy(object))break;
  const descriptor=Object.getOwnPropertyDescriptor(object,'name');
  if(descriptor){if(Object.hasOwn(descriptor,'value'))result.name=names.find(value=>value===descriptor.value)??'Error';break;}
  object=Object.getPrototypeOf(object);
 }
 return result;
},wrapBootstrap=function wrapPeerBootstrapDiagnostics(native,record,classifyError,isProxy){
 const refuse=()=>{throw Error('PEER_DIAGNOSTIC_CALLBACK_REFUSED');};
 if(!native||typeof native!=='object'||isProxy(native))return refuse();
 const methods=Object.create(null);
 for(const name of ['consumePeerBootstrap','closePeerWitness']){
  const descriptor=Object.getOwnPropertyDescriptor(native,name);
  if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function'||isProxy(descriptor.value))return refuse();
  methods[name]=descriptor.value;
 }
 return Object.freeze({
  consumePeerBootstrap(buffer){try{return Reflect.apply(methods.consumePeerBootstrap,native,[buffer]);}catch(error){record.consumeFailure=classifyError(error,isProxy);throw error;}},
  closePeerWitness(witness){return Reflect.apply(methods.closePeerWitness,native,[witness]);},
 });
};
 const persist=async()=>{const body=JSON.stringify(diagnostic);if(Buffer.byteLength(body,'utf8')>=4096)throw Error('PEER_DIAGNOSTIC_BOUND');await writeFile(path+'.pending',body,{encoding:'utf8',flag:'w'});await rename(path+'.pending',path);};
 const mark=async stage=>{if(stage!==stages[diagnostic.stages.length])throw Error('PEER_DIAGNOSTIC_STAGE');diagnostic.stages.push(stage);await persist();};
 let packet;
 try{
  const {createRequire}=await import('node:module'),native=createRequire(import.meta.url)(addon);await mark('addon-loaded');
  const bootstrapNative=wrapBootstrap(native,diagnostic,classifyError,types.isProxy);
  const {readPeerTerminalBootstrap}=await import(reader);packet=await readPeerTerminalBootstrap(process.stdin,{native:bootstrapNative,timeoutMs:1000});await mark('bootstrap-read');
  const {runPeerWorker}=await import(worker);await mark('worker-imported');await runPeerWorker(packet.bootstrap,process.argv[2],{native,witness:packet.witness,diagnostic:mark});
 }catch(error){diagnostic.failure=classifyError(error,types.isProxy);try{await persist();}catch{}throw error;}finally{packet?.dispose();}
}
async function main(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{readFile,writeFile,rename,mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),{setTimeout:delay}=await import('node:timers/promises');
 const {createTerminalBootstrap}=await import(config.modules.bootstrap),{TerminalControlChannel}=await import(config.modules.control),{TerminalHistoryChannel,TerminalHistoryReader}=await import(config.modules.history),{TerminalGateLink}=await import(config.modules.link),{TerminalInputFence}=await import(config.modules.fence),{TerminalSessionLedger}=await import(config.modules.ledger),{TerminalRemoteOutput}=await import(config.modules.output),{NORMAL_BEGIN,NORMAL_DONE}=await import(config.modules.probe);
 const {createNativePeerStream}=await import(config.modules.peerStream),{types}=await import('node:util');
 const classifyError=function classifyPeerDiagnosticError(error,isProxy){
 const codes=['ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ERR_INVALID_ARG_TYPE','ERR_INVALID_MODULE_SPECIFIER','ERR_ASSERTION','ERR_INVALID_PACKAGE_CONFIG','ERR_UNKNOWN_FILE_EXTENSION','ERR_UNSUPPORTED_DIR_IMPORT','ERR_REQUIRE_ESM','ENOENT','EACCES','EPERM','ENOSPC',
  'TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED','TERMINAL_PEER_BOOTSTRAP_REFUSED','TERMINAL_PEER_BOOTSTRAP_TIMEOUT','NATIVE_PEER_STREAM_UNAVAILABLE','PEER_DIAGNOSTIC_BOUND','PEER_DIAGNOSTIC_STAGE','PEER_DIAGNOSTIC_CALLBACK_REFUSED',
  'PEER_ACCEPT_REFUSED','PEER_BIND_REFUSED','PEER_BOOTSTRAP_REFUSED','PEER_CAPABILITY_CLOSED','PEER_CAPABILITY_FINALIZED','PEER_CAPABILITY_REFUSED','PEER_CAPACITY_REFUSED','PEER_CLOSE_CAPACITY','PEER_CONNECT_FAILED','PEER_CONNECT_REFUSED','PEER_DACL_FAILED','PEER_DEADLINE','PEER_ENDPOINT_STALE','PEER_ENVIRONMENT_CLOSING','PEER_ENVIRONMENT_UNAVAILABLE','PEER_EOF','PEER_EVENT_FAILED','PEER_EXPLICIT_CLOSE','PEER_HOST_UNAVAILABLE','PEER_IDENTITY_DUPLICATE_FAILED','PEER_IDENTITY_LOST','PEER_IDENTITY_REFUSED','PEER_LISTENER_CREATE_FAILED','PEER_MAIN_IDENTITY_FAILED','PEER_NAME_REFUSED','PEER_NAPI_FAILURE','PEER_OWNER_RETIRED','PEER_PARTIAL_WRITE','PEER_PROCESS_EXITED','PEER_READ_BUSY','PEER_READ_FAILED','PEER_READ_LIMIT','PEER_REQUEST_CAPACITY','PEER_REQUEST_REFUSED','PEER_RETIRED','PEER_SESSION_RETIRED','PEER_STALE_COMPLETION','PEER_STARTUP_ABORTED','PEER_STARTUP_DEADLINE','PEER_STARTUP_REFUSED','PEER_THREAD_FAILED','PEER_TSFN_FAILED','PEER_WAIT_FAILED','PEER_WITNESS_CLOSE_FAILED','PEER_WITNESS_CLOSED','PEER_WITNESS_DUPLICATE_FAILED','PEER_WITNESS_REFUSED','PEER_WRITE_CAPACITY','PEER_WRITE_FAILED','PEER_WRITE_REFUSED'];
 const names=['Error','TypeError','RangeError','SyntaxError','ReferenceError','AssertionError','AggregateError'];
 const result={code:'UNKNOWN',name:'Error'};
 if(!error||typeof error!=='object'||isProxy(error))return result;
 for(const key of ['code','message']){
  const descriptor=Object.getOwnPropertyDescriptor(error,key);
  if(descriptor&&Object.hasOwn(descriptor,'value')){const code=codes.find(value=>value===descriptor.value);if(code){result.code=code;break;}}
 }
 let object=error;
 for(let depth=0;object&&depth<4;depth++){
  if(isProxy(object))break;
  const descriptor=Object.getOwnPropertyDescriptor(object,'name');
  if(descriptor){if(Object.hasOwn(descriptor,'value'))result.name=names.find(value=>value===descriptor.value)??'Error';break;}
  object=Object.getPrototypeOf(object);
 }
 return result;
};
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const native=createRequire(import.meta.url)(config.addon),result={admitted:false,status:'FAILED',runtime:{...process.versions,arch:process.arch,platform:process.platform}},strong=globalThis.__normalShell={};
 let host,hostOwner,owner,sessionClosed=false,hostClosed=false,packet,control,historyChannel,pair,pairClosed=false,controlEndpoint,historyEndpoint,controlSocket,historySocket,controlKey,historyKey;
 const wait=async(fn,ms=3000)=>{const deadline=performance.now()+ms;for(;;){assert.ok(performance.now()<deadline,'NORMAL_WAIT_DEADLINE');const r=await fn();assert.ok(performance.now()<deadline,'NORMAL_WAIT_DEADLINE');if(r)return r;await delay(5);}};
 const json=async(name)=>{try{const b=await readFile(join(config.output,'session',name+'.json'));assert.ok(b.length<=65536,'WORKER_RESULT_SIZE');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const persist=async(name,value)=>{const p=join(config.output,name);await writeFile(p+'.pending',JSON.stringify(value),{flag:'wx'});await rename(p+'.pending',p);};
 const dead=s=>s.active===0&&!s.root.alive&&(!s.shell||!s.shell.alive)&&s.held.every(p=>!p.alive);
 const watchdog=setTimeout(()=>app.exit(94),23000);
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');
  const hello={};const hostMark=native.mark();host=utilityProcess.fork(config.hostEntry,[],{serviceName:'SIREN finite normal-shell owner',stdio:'pipe'});strong.host=host;host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});host.on('message',m=>{hello[m.kind]=m;});
  await wait(()=>hello.hello);assert.equal(hello.hello.pid,host.pid);hostOwner=native.start(host.pid,config.electron,hostMark);strong.hostOwner=hostOwner;
  const directory=join(config.output,'session');await mkdir(directory);await writeFile(join(directory,'worker-config.json'),JSON.stringify({packagePath:config.packagePath,shell:config.shell}),{flag:'wx'});
  packet=createTerminalBootstrap({sessionId:'normal-shell',channelId:'normal-data'});
  controlKey=Buffer.from(packet.controlSecret);historyKey=Buffer.from(packet.dataSecret);
  // Native listener creation and creator binding precede endpoint acquisition.
  // HMAC runs only through native endpoints that already checked both peers.
  pair=native.createPeerListeners(hostOwner,packet.controlPipe,packet.dataPipe);
  const creatorMark=native.mark();try{owner=native.createPeerSession(hostOwner,config.electron,config.creator,directory,packet.payload,pair);}finally{packet.dispose();}
  const accepted=await Promise.allSettled([Promise.resolve().then(()=>native.acceptPeerLane(pair,'control',2500)),Promise.resolve().then(()=>native.acceptPeerLane(pair,'history',2500))]);
  if(accepted[0].status==='fulfilled')controlEndpoint=accepted[0].value;
  if(accepted[1].status==='fulfilled')historyEndpoint=accepted[1].value;
  result.nativePeerAccept=accepted.map((outcome,index)=>({lane:['control','history'][index],status:outcome.status,error:outcome.status==='rejected'?classifyError(outcome.reason,types.isProxy):null}));
  assert.ok(accepted.every(value=>value.status==='fulfilled'),'NORMAL_CHANNEL_CONNECTION');
  controlSocket=createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500});
  historySocket=createNativePeerStream({native,endpoint:historyEndpoint,lane:'history',deadlineMs:2500});
  try{control=new TerminalControlChannel({stream:controlSocket,role:'main',channelId:packet.channelId,secret:controlKey,deadlineMs:2500});}finally{controlKey.fill(0);}
  try{historyChannel=new TerminalHistoryChannel({stream:historySocket,role:'main',channelId:packet.channelId,sessionId:packet.sessionId,secret:historyKey,deadlineMs:2500});}finally{historyKey.fill(0);}
  const ledger=new TerminalSessionLedger({writeInput:()=>{throw Error('NO_MAIN_INPUT_RPC_IN_FIXED_FIXTURE');}});
  const link=new TerminalGateLink({channelId:'normal-data',send:p=>{assert.equal(control.send(p),true);},subscribe:r=>control.subscribe(r),onUnavailable:()=>ledger.hostFailed()});
  const reader=new TerminalHistoryReader({channel:historyChannel,sessionId:'normal-shell'});
  assert.equal(await control.ready,true);assert.equal(await historyChannel.ready,true);
  result.nativePeer={control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint),close:{control:null,history:null,listeners:null}};
  const fence=new TerminalInputFence({ledger,gateLink:link});result.ready=await wait(()=>json('worker-ready'),4000);
  native.watchRoot(owner,result.ready.rootPid,config.shell,creatorMark);result.before=native.captureSession(owner);result.hostBefore=native.capture(hostOwner);
  assert.equal(result.before.root.pid,result.ready.workerPid);assert.equal(result.before.shell.pid,result.ready.rootPid);
  assert.equal(ledger.register({sessionId:'normal-shell',projectId:'normal-project',profileId:'powershell',cwdDisplay:directory}).ok,true);
  await persist('normal-safety-ready.json',{mainPid:process.pid,held:result.hostBefore.held});
  await wait(async()=>{try{return await readFile(join(config.output,'normal-safety-go.request'),'utf8')==='go';}catch(e){if(e.code!=='ENOENT')throw e;}},4000);
  const output=new TerminalRemoteOutput();assert.equal(output.register('normal-shell',q=>reader.read(q)).ok,true);output.resumeViews();
  const first={sessionId:'normal-shell',leaseId:'normal-before-lock',generation:1};assert.equal(output.attach(first.sessionId,{leaseId:first.leaseId,generation:first.generation,fromSequence:0}).ok,true);
  const consume=async(token,marker)=>{let text='',bytes=0,frames=0;await wait(async()=>{const r=await output.take(token);assert.equal(r.ok,true);assert.equal(r.value.gap,null);const c=r.value.chunk;if(c){text=(text+c.data).slice(-4096);bytes+=c.utf8Bytes;frames++;assert.equal(output.ack(token,c.sequence+c.utf8Bytes).ok,true);}return text.includes(marker);},4000);return {begin:text.includes(NORMAL_BEGIN),done:text.includes(NORMAL_DONE),bytes,frames};};
  result.openAck=await fence.resumeInput();assert.equal(result.openAck.ok,true);await consume(first,NORMAL_BEGIN);
  output.suspendViews();result.lockedStats=output.stats();result.oldViewRefused=(await output.take(first)).ok===false;result.lockAck=await fence.closeInput('lock');assert.equal(result.lockAck.ok,true);
  result.completion=await wait(()=>json('worker-completion'),4000);assert.equal((await json('worker-error')),null);
  output.resumeViews();const fresh={sessionId:'normal-shell',leaseId:'normal-replay-after-lock',generation:2};assert.equal(output.attach(fresh.sessionId,{leaseId:fresh.leaseId,generation:fresh.generation,fromSequence:0}).ok,true);
  result.historyReplay=await consume(fresh,NORMAL_DONE);result.replayInputFence=fence.snapshot();assert.equal(result.replayInputFence.closed,true);output.suspendViews();
  // Lock above retained both lanes for completion and replay. Explicit Stop
  // starts only after both adapter operation ledgers and native listeners drain.
  control.dispose();historyChannel.dispose();controlSocket.destroy();historySocket.destroy();
  result.nativePeer.close.control=await controlSocket.closed;
  result.nativePeer.close.history=await historySocket.closed;
  result.nativePeer.close.listeners=await native.closePeerListeners(pair,3000);pairClosed=result.nativePeer.close.listeners===true;
  assert.deepEqual(result.nativePeer.close,{control:true,history:true,listeners:true});
  const start=performance.now();let ticks=0,last=start,maxGapMs=0;const timer=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},2);
  try{result.stopped=await native.stopAndCloseSessionAsync(owner,77,3000);sessionClosed=result.stopped.closed===true;}finally{clearInterval(timer);}
  result.asyncRetirement={elapsedMs:performance.now()-start,ticks,maxGapMs:Math.max(maxGapMs,performance.now()-last)};assert.ok(sessionClosed&&dead(result.stopped.snapshot));output.retire('normal-shell');
  native.stop(hostOwner,77);result.hostAfter=await wait(()=>{const s=native.snapshot(hostOwner);return dead(s)?s:null;});hostClosed=native.close(hostOwner)===true;result.hostClosed=hostClosed;assert.equal(hostClosed,true);
  result.status='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED';
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};try{result.diagnosticMilestones={};for(const stage of ['before-begin','after-begin','after-sleep','after-done'])result.diagnosticMilestones[stage]=(await json('normal-script-'+stage))===1;}catch(error){result.diagnosticReadError=String(error);}try{if(owner&&!sessionClosed)result.failureSession=native.snapshotSession(owner);}catch{}try{if(hostOwner&&!hostClosed)result.failureHost=native.snapshot(hostOwner);}catch{}}
 finally{
  packet?.dispose();controlKey?.fill(0);historyKey?.fill(0);control?.dispose();historyChannel?.dispose();controlSocket?.destroy();historySocket?.destroy();
  if(pair&&!pairClosed)try{
   const close={control:controlSocket?await controlSocket.closed:null,history:historySocket?await historySocket.closed:null,listeners:null};result.nativePeerCleanup=close;
   close.listeners=await native.closePeerListeners(pair,3000);pairClosed=close.listeners===true;
   assert.equal(close.listeners,true);if(controlSocket)assert.equal(close.control,true);if(historySocket)assert.equal(close.history,true);
  }catch(e){result.nativePeerCleanupError=String(e.stack??e);result.status='FAILED';}
  if(owner&&!sessionClosed)try{const r=await native.stopAndCloseSessionAsync(owner,98,3000);assert.ok(r.closed&&dead(r.snapshot));sessionClosed=true;}catch(e){result.cleanupError=String(e.stack??e);result.status='FAILED';}
  if(hostOwner&&!hostClosed)try{native.stop(hostOwner,98);await wait(()=>dead(native.snapshot(hostOwner)));assert.equal(native.close(hostOwner),true);}catch(e){result.hostCleanupError=String(e.stack??e);result.status='FAILED';}
  clearTimeout(watchdog);await writeFile(join(config.output,'native-result.json'),JSON.stringify(result,null,2),{flag:'wx'});app.exit(result.status==='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED'?0:1);
 }
}
try{
 for(const rel of PUBLICATION_INPUTS){const path=join(desktop,'..',rel),b=await readFile(path);receipt.inputs.push({path:resolve(path),bytes:b.length,sha256:hash(b)});}
 const original=await readFile(join(desktop,'tests/fixtures/terminal-main-owner-observer.cs'),'utf8');assert.equal(hash(original),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc');
 const replace=(s,a,b)=>{assert.equal(s.split(a).length,2);return s.replace(a,()=>b);};const observerBase=join(output,'observer-base.cs');await writeFile(observerBase,replace(replace(original,'internal static class TerminalMainOwnerObserver {','internal static partial class TerminalMainOwnerObserver {'),'static int Main(string[] args) {','static int HistoricalMain(string[] args) {'),{flag:'wx'});
 const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),observer=join(output,'normal-observer.exe');
 try{const r=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/reference:System.Web.Extensions.dll','/out:'+observer,observerBase,join(desktop,'tests/fixtures/terminal-normal-observer.cs')],{windowsHide:true,timeout:30000,maxBuffer:65536});await writeFile(join(output,'observer-compiler.txt'),r.stdout+r.stderr,{flag:'wx'});}catch(e){await writeFile(join(output,'observer-compiler-failed.txt'),(e.stdout??'')+(e.stderr??''),{flag:'wx'});throw e;}
 const electron=join(desktop,'node_modules/electron/dist/electron.exe'),shell=join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),hostEntry=join(output,'host.mjs'),creatorEntry=join(output,'creator.mjs');
 const modules=Object.fromEntries(Object.entries({bootstrap:'bootstrap-codec',control:'control-channel',history:'history-channel',link:'gate-link',fence:'input-gate',ledger:'session-state',output:'remote-output'}).map(([k,v])=>[k,pathToFileURL(join(desktop,'src/terminal/'+v+'.mjs')).href]));modules.probe=pathToFileURL(join(desktop,'tests/native/terminal-normal-probe-core.mjs')).href;modules.peerStream=pathToFileURL(join(desktop,'src/terminal/native-peer-stream.mjs')).href;
 const config={output,addon,electron,shell,hostEntry,creator:creatorEntry,modules,packagePath:join(desktop,'tests/fixtures/terminal-node-pty/package.json')};
 await writeFile(creatorEntry,`void (${creator.toString()})(${JSON.stringify(pathToFileURL(join(desktop,'tests/native/terminal-peer-worker.mjs')).href)},${JSON.stringify(pathToFileURL(join(desktop,'src/terminal/peer-bootstrap-reader.mjs')).href)},${JSON.stringify(addon)});`,{flag:'wx'});
 await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});await writeFile(hostEntry,`void (${controlHost.toString()})();`,{flag:'wx'});await writeFile(join(output,'main.mjs'),`void (${main.toString()})(${JSON.stringify(config)});`,{flag:'wx'});
 for(const path of [compiler,observerBase,observer,electron,shell,addon,hostEntry,creatorEntry,join(output,'main.mjs'),join(output,'package.json')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 const child=spawn(observer,[electron,output,output,shell],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')))});
 let stdout='',stderr='';child.once('spawn',()=>{receipt.processStarted=true;});child.stdout.on('data',b=>{stdout+=b;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',b=>{stderr+=b;if(Buffer.byteLength(stderr)>65536){receipt.outputTruncated=true;stderr=stderr.slice(-32768);}});
 receipt.outerExitCode=await new Promise(resolve=>{let done=false,grace;const finish=(code,observed)=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};const timer=setTimeout(()=>{receipt.deadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{child.kill();}catch{}},40000);child.once('error',e=>{receipt.processError={code:e.code,message:e.message};finish(null,false);});child.once('exit',code=>finish(code,true));});
 await writeFile(join(output,'observer.log'),stdout+stderr,{flag:'wx'});receipt.observer=JSON.parse(await readFile(join(output,'observer-result.json'),'utf8'));receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));
 receipt.inputsUnchanged=true;for(const input of receipt.inputs)if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;
 receipt.qualified=true;receipt.status='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED';receipt.observation=validateCandidateObservation({result:receipt,addon:receipt.inputs.find(p=>p.path===addon),electron:receipt.inputs.find(p=>p.path===electron)}).normalShell;
}catch(e){receipt.status='FAILED';receipt.qualified=false;receipt.error={code:e.code,message:e.message};throw e;}finally{await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));}
