// Guarded, finite hosted normal-shell experiment. Never product admission.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse,resolve,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {requireCandidateCi,PUBLICATION_INPUTS,validateCandidateObservation} from './terminal-normal-powershell-contract.mjs';
requireCandidateCi({platform:process.platform,arch:process.arch,node:process.version,env:process.env});
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.argv.length,3,'ONE_ABSOLUTE_ADDON_REQUIRED');assert.ok(isAbsolute(process.argv[2]),'ONE_ABSOLUTE_ADDON_REQUIRED');const addon=resolve(process.argv[2]);
const output=join(desktop,'evidence/terminal-normal-powershell-observation','SIREN env Ω space-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,negative:false,compileOnly:false,scope:'Finite real PowerShell, fixed command, Lock completion, creator history replay and held Stop; no product input/resize/peer/package admission',output,inputs:[],processStarted:false};
async function controlHost(){process.parentPort.postMessage({kind:'hello',pid:process.pid});setTimeout(()=>process.exit(95),25000);setInterval(()=>{},1000);}
async function creator(worker,reader){
 const {readTerminalBootstrap}=await import(reader);const packet=await readTerminalBootstrap(process.stdin,{timeoutMs:1000});
 try{const {runNormalWorker}=await import(worker);await runNormalWorker(packet,process.argv[2]);}finally{packet.dispose();}
}
async function main(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{readFile,writeFile,rename,mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),{setTimeout:delay}=await import('node:timers/promises'),net=(await import('node:net')).default;
 const {createTerminalBootstrap}=await import(config.modules.bootstrap),{TerminalControlChannel}=await import(config.modules.control),{TerminalHistoryChannel,TerminalHistoryReader}=await import(config.modules.history),{TerminalGateLink}=await import(config.modules.link),{TerminalInputFence}=await import(config.modules.fence),{TerminalSessionLedger}=await import(config.modules.ledger),{TerminalRemoteOutput}=await import(config.modules.output),{NORMAL_BEGIN,NORMAL_DONE}=await import(config.modules.probe);
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const native=createRequire(import.meta.url)(config.addon),result={admitted:false,status:'FAILED',runtime:{...process.versions,arch:process.arch,platform:process.platform}},strong=globalThis.__normalShell={};
 let host,hostOwner,owner,sessionClosed=false,hostClosed=false,packet,control,historyChannel;const listeners=[];
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
  const controlKey=Buffer.from(packet.controlSecret),historyKey=Buffer.from(packet.dataSecret);
  // Wait for each listener before creating its contained connector. Accept at
  // most one stream; HMAC is not a claim of kernel peer identity/admission.
  const prepare=async(name,create)=>{
   let resolveOutcome,settled=false;const sockets=new Set(),server=net.createServer();server.maxConnections=1;
   const ready=new Promise(resolve=>resolveOutcome=resolve);const finish=r=>{if(settled)return;settled=true;clearTimeout(timer);resolveOutcome(r);};
   const timer=setTimeout(()=>{finish({error:'LISTENER_DEADLINE'});server.close();for(const s of sockets)s.destroy();},4000);
   listeners.push(()=>{clearTimeout(timer);controlKey.fill(0);historyKey.fill(0);finish({error:'LISTENER_DISPOSED'});server.close();for(const s of sockets)s.destroy();});
   server.on('error',e=>finish({error:e.message}));server.on('connection',s=>{sockets.add(s);if(settled){s.destroy();return;}try{finish({value:create(s)});server.close();}catch(e){finish({error:e.message});s.destroy();}});
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(name,resolve);});return {ready};
  };
  const c=await prepare(packet.controlPipe,s=>{try{return new TerminalControlChannel({stream:s,role:'main',channelId:packet.channelId,secret:controlKey,deadlineMs:2500});}finally{controlKey.fill(0);}});
  const h=await prepare(packet.dataPipe,s=>{try{return new TerminalHistoryChannel({stream:s,role:'main',channelId:packet.channelId,sessionId:packet.sessionId,secret:historyKey,deadlineMs:2500});}finally{historyKey.fill(0);}});
  const creatorMark=native.mark();try{owner=native.createBootstrappedSession(hostOwner,config.electron,config.creator,directory,packet.payload);}finally{packet.dispose();}
  const [cr,hr]=await Promise.all([c.ready,h.ready]);assert.ok(cr.value&&hr.value,'NORMAL_CHANNEL_CONNECTION');control=cr.value;historyChannel=hr.value;
  const ledger=new TerminalSessionLedger({writeInput:()=>{throw Error('NO_MAIN_INPUT_RPC_IN_FIXED_FIXTURE');}});
  const link=new TerminalGateLink({channelId:'normal-data',send:p=>{assert.equal(control.send(p),true);},subscribe:r=>control.subscribe(r),onUnavailable:()=>ledger.hostFailed()});
  const reader=new TerminalHistoryReader({channel:historyChannel,sessionId:'normal-shell'});
  assert.equal(await control.ready,true);assert.equal(await historyChannel.ready,true);
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
  const start=performance.now();let ticks=0,last=start,maxGapMs=0;const timer=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},2);
  try{result.stopped=await native.stopAndCloseSessionAsync(owner,77,3000);sessionClosed=result.stopped.closed===true;}finally{clearInterval(timer);}
  result.asyncRetirement={elapsedMs:performance.now()-start,ticks,maxGapMs:Math.max(maxGapMs,performance.now()-last)};assert.ok(sessionClosed&&dead(result.stopped.snapshot));output.retire('normal-shell');
  native.stop(hostOwner,77);result.hostAfter=await wait(()=>{const s=native.snapshot(hostOwner);return dead(s)?s:null;});hostClosed=native.close(hostOwner)===true;result.hostClosed=hostClosed;assert.equal(hostClosed,true);
  result.status='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED';
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};try{if(owner&&!sessionClosed)result.failureSession=native.snapshotSession(owner);}catch{}try{if(hostOwner&&!hostClosed)result.failureHost=native.snapshot(hostOwner);}catch{}}
 finally{
  packet?.dispose();for(const dispose of listeners)dispose();control?.dispose();historyChannel?.dispose();
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
 const modules=Object.fromEntries(Object.entries({bootstrap:'bootstrap-codec',control:'control-channel',history:'history-channel',link:'gate-link',fence:'input-gate',ledger:'session-state',output:'remote-output'}).map(([k,v])=>[k,pathToFileURL(join(desktop,'src/terminal/'+v+'.mjs')).href]));modules.probe=pathToFileURL(join(desktop,'tests/native/terminal-normal-probe-core.mjs')).href;
 const config={output,addon,electron,shell,hostEntry,creator:creatorEntry,modules,packagePath:join(desktop,'tests/fixtures/terminal-node-pty/package.json')};
 await writeFile(creatorEntry,`void (${creator.toString()})(${JSON.stringify(pathToFileURL(join(desktop,'tests/native/terminal-normal-worker.mjs')).href)},${JSON.stringify(pathToFileURL(join(desktop,'src/terminal/bootstrap-reader.mjs')).href)});`,{flag:'wx'});
 await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});await writeFile(hostEntry,`void (${controlHost.toString()})();`,{flag:'wx'});await writeFile(join(output,'main.mjs'),`void (${main.toString()})(${JSON.stringify(config)});`,{flag:'wx'});
 for(const path of [compiler,observerBase,observer,electron,shell,addon,hostEntry,creatorEntry,join(output,'main.mjs'),join(output,'package.json')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 const child=spawn(observer,[electron,output,output,shell],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')))});
 let stdout='',stderr='';child.once('spawn',()=>{receipt.processStarted=true;});child.stdout.on('data',b=>{stdout+=b;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',b=>{stderr+=b;if(Buffer.byteLength(stderr)>65536){receipt.outputTruncated=true;stderr=stderr.slice(-32768);}});
 receipt.outerExitCode=await new Promise(resolve=>{let done=false,grace;const finish=(code,observed)=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};const timer=setTimeout(()=>{receipt.deadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{child.kill();}catch{}},40000);child.once('error',e=>{receipt.processError={code:e.code,message:e.message};finish(null,false);});child.once('exit',code=>finish(code,true));});
 await writeFile(join(output,'observer.log'),stdout+stderr,{flag:'wx'});receipt.observer=JSON.parse(await readFile(join(output,'observer-result.json'),'utf8'));receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));
 receipt.inputsUnchanged=true;for(const input of receipt.inputs)if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;
 receipt.qualified=true;receipt.status='NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED';receipt.observation=validateCandidateObservation({result:receipt,addon:receipt.inputs.find(p=>p.path===addon),electron:receipt.inputs.find(p=>p.path===electron)}).normalShell;
}catch(e){receipt.status='FAILED';receipt.qualified=false;receipt.error={code:e.code,message:e.message};throw e;}finally{await writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx'});console.log(JSON.stringify(receipt));}
