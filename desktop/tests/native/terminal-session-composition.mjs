// Actual CI-only composition; no local native execution/product shell admission.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {deriveSessionComposition} from './terminal-session-composition-derive.mjs';
import {isSessionCompositionObserved} from './terminal-session-composition-verdict.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),compileOnly=args.includes('--compile-only'),negative=args.includes('--negative');
assert.ok(args.filter(a=>a.startsWith('--')).every(a=>['--compile-only','--negative'].includes(a)));
const addon=resolve(args.find(a=>!a.startsWith('--'))??join(desktop,'evidence/not-built/session.node'));
const output=join(desktop,'evidence/terminal-session-composition',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Finite native Session creator, Stop, natural-root and utility-loss composition with an external Safety observer; no main-loss/input/flood/package admission',output,negative,compileOnly,inputs:[],processStarted:false};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function controlHost(){
 const {parentPort}=process;parentPort.on('message',event=>{if(event.data?.kind==='exit')setTimeout(()=>process.exit(0),100);});
 parentPort.postMessage({kind:'hello',pid:process.pid,versions:process.versions,arch:process.arch,platform:process.platform});
 setTimeout(()=>process.exit(95),25000);setInterval(()=>{},1000);
}
async function creator(worker,directory){
 const {writeFile}=await import('node:fs/promises'),{join}=await import('node:path');
 await writeFile(join(directory,'creator-bootstrap.json'),JSON.stringify({status:'CREATOR_JS_ENTERED_NOT_QUALIFIED',pid:process.pid,argv:process.argv,versions:process.versions,runAsNode:process.env.ELECTRON_RUN_AS_NODE}),{flag:'wx'});
 try{await import(worker);}catch(error){
  await writeFile(join(directory,'creator-import-error.json'),JSON.stringify({status:'FAILED',pid:process.pid,code:error.code,message:error.message,stack:error.stack}),{flag:'wx'});throw error;
 }
}
async function main(config){
 const {app,utilityProcess}=await import('electron'),assert=(await import('node:assert/strict')).default;
 const {createRequire}=await import('node:module'),{readFile,writeFile,rename,mkdir}=await import('node:fs/promises'),{join}=await import('node:path'),{setTimeout:delay}=await import('node:timers/promises');
 app.setPath('userData',join(config.output,'profile'));await app.whenReady();
 const age=Date.now(),result={admitted:false,negative:config.negative,status:'FAILED',runtime:{...process.versions,arch:process.arch,platform:process.platform},groups:[],cleanup:[]};
 const native=createRequire(import.meta.url)(config.addon),states=[],strong=globalThis.__composition={states};let hostOwner,host,hostClosed=false;
 const wait=async(fn,deadline=Date.now()+3000)=>{for(;;){if(Date.now()>deadline)throw Error('COMPOSITION_WAIT_DEADLINE');const r=await fn();if(Date.now()>deadline)throw Error('COMPOSITION_WAIT_DEADLINE');if(r)return r;await delay(5);}};
 const exited=s=>s.active===0&&s.root.alive===false&&(!s.shell||s.shell.alive===false)&&s.held.every(p=>!p.alive);
 const persist=async(path,value)=>{await writeFile(path+'.pending',JSON.stringify(value),{flag:'wx'});await rename(path+'.pending',path);};
 async function stage(label,hostSnapshot){
  const owned=result.groups.filter(g=>label==='first'?['A','B'].includes(g.label):['C','D'].includes(g.label));
  const expected=[hostSnapshot.root,...owned.flatMap(g=>g.before.held)];
  assert.equal(hostSnapshot.active,expected.length);assert.equal(hostSnapshot.held.length,expected.length);
  for(const p of hostSnapshot.held)assert.ok(expected.some(q=>p.pid===q.pid&&p.createdFileTime===q.createdFileTime&&p.image===q.image),'COMPOSITION_HOST_SESSION_SET_MISMATCH');
  await persist(join(config.output,'composition-'+label+'-ready.json'),{mainPid:process.pid,held:hostSnapshot.held});
  await wait(async()=>{try{return (await readFile(join(config.output,'composition-'+label+'-go.request'),'utf8'))==='go';}catch(e){if(e.code!=='ENOENT')throw e;}});
 }
 async function start(label){
  const readyDeadline=Date.now()+3000;
  const directory=join(config.output,label);await mkdir(directory);await writeFile(join(directory,'electron-config.json'),JSON.stringify({fixture:config.fixture,packagePath:config.packagePath}),{flag:'wx'});
  result.phase='create-'+label;
  const mark=native.mark(),owner=native.createSession(hostOwner,config.electron,config.creator,directory),state={label,owner,directory,closed:false};states.push(state);
  result.startup??=[];result.startup.push({label,phase:'created',snapshot:native.snapshotSession(owner),host:native.snapshot(hostOwner)});result.phase='ready-'+label;
  let ready;await wait(async()=>{try{ready=JSON.parse(await readFile(join(directory,'electron-ready.json'),'utf8'));return ready;}catch(e){if(e.code!=='ENOENT')throw e;}},readyDeadline);
  assert.throws(()=>native.watchRoot(owner,ready.rootPid,config.fixture+'.wrong',mark),{code:'SESSION_ROOT_IDENTITY_REFUSED'});
  native.watchRoot(owner,ready.rootPid,config.fixture,mark);
  const fixturePids={};result.phase='fixtures-'+label;
  await wait(async()=>{try{for(const key of ['root','branch','grandchild','detached']){const value=Number(await readFile(join(directory,key+'.ready'),'utf8'));if(!Number.isSafeInteger(value)||value<=0||value>0xffffffff)return false;fixturePids[key]=value;}return true;}catch(e){if(e.code!=='ENOENT')throw e;}},readyDeadline);
  const before=native.captureSession(owner);
  assert.equal(before.root.pid,ready.workerPid);assert.equal(before.shell.pid,ready.rootPid);assert.equal(before.hostPid,host.pid);
  result.groups.push({label,before,ready,fixturePids});return state;
 }
 async function close(state,code){
  if(state.closed)return;
  const prior=native.snapshotSession(state.owner);if(!exited(prior))native.stopSession(state.owner,code);
  const snapshot=await wait(()=>{const s=native.snapshotSession(state.owner);return exited(s)?s:null;});
  const closed=native.closeSession(state.owner);state.closed=closed===true;result.cleanup.push({label:state.label,snapshot,closed});
 }
 const watchdog=setTimeout(()=>app.exit(94),25000);
 try{
  assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.arch,'x64');
  const mark=native.mark(),hello={};
  host=utilityProcess.fork(config.hostEntry,[],{serviceName:'SIREN test composition control',stdio:'pipe'});strong.host=host;host.stdout?.on('data',()=>{});host.stderr?.on('data',()=>{});host.on('message',m=>{hello[m.kind]=m;});
  await wait(()=>hello.hello);assert.equal(hello.hello.pid,host.pid);hostOwner=native.start(host.pid,config.electron,mark);strong.hostOwner=hostOwner;
  assert.equal(native.snapshot(hostOwner).active,1);
  const a=await start('A'),b=await start('B');await stage('first',native.capture(hostOwner));
  const stopping=Date.now();native.stopSession(a.owner,77);result.stoppedA=await wait(()=>{const s=native.snapshotSession(a.owner);return exited(s)?s:null;});result.stopMs=Date.now()-stopping;result.otherAlive=native.snapshotSession(b.owner);
  const rootStart=Date.now();await writeFile(join(b.directory,'root-exit.request'),'fixed-natural-exit-51',{flag:'wx'});
  while(Date.now()-rootStart<2000){}result.blockedRootMs=Date.now()-rootStart;result.rootB=native.snapshotSession(b.owner);result.rootWaitMs=Date.now()-rootStart;
  await close(a,98);await close(b,98);
  const c=await start('C'),d=await start('D');await stage('second',native.captureCompositionHost(hostOwner));
  const hostStart=Date.now();host.postMessage({kind:'exit'});while(Date.now()-hostStart<2000){}result.blockedHostMs=Date.now()-hostStart;result.hostLoss=native.snapshot(hostOwner);
  await close(c,98);await close(d,98);result.fixtureAgeMs=Date.now()-age;
  hostClosed=native.close(hostOwner)===true;result.hostClosed=hostClosed;result.status='SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED';
 }catch(e){result.error={code:e.code,message:e.message,stack:e.stack};result.failureSnapshots=[];for(const state of states){if(state.closed)continue;try{result.failureSnapshots.push({label:state.label,snapshot:native.snapshotSession(state.owner)});}catch(error){result.failureSnapshots.push({label:state.label,error:String(error)});}}}
 finally{
  for(const state of states)if(!state.closed){try{await close(state,98);}catch(e){result.cleanupError=String(e.stack??e);result.status='FAILED';}}
  if(hostOwner&&!hostClosed){try{native.stop(hostOwner,98);await wait(()=>exited(native.snapshot(hostOwner)));native.close(hostOwner);}catch(e){result.hostCleanupError=String(e.stack??e);result.status='FAILED';}}
  clearTimeout(watchdog);await writeFile(join(config.output,'native-result.json'),JSON.stringify(result,null,2),{flag:'wx'});app.exit(result.status==='SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED'?0:1);
 }
}
try{
 const paths=['tests/native/terminal-session-composition.mjs','tests/native/terminal-session-composition-derive.mjs','tests/native/terminal-session-composition-verdict.mjs','tests/native/terminal-conpty-platform.mjs','tests/native/terminal-electron-broker-worker.mjs','tests/fixtures/terminal-host-guard/host.cc','tests/fixtures/terminal-session-composition.inc','tests/fixtures/terminal-job-list.cs','tests/fixtures/terminal-main-owner-observer.cs','tests/fixtures/terminal-session-composition-observer.cs','tests/fixtures/terminal-node-pty/package.json','tests/fixtures/terminal-node-pty/package-lock.json'];
 for(const rel of paths){const path=join(desktop,rel),b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 const derived=deriveSessionComposition({host:await readFile(join(desktop,'tests/fixtures/terminal-host-guard/host.cc'),'utf8'),fixture:await readFile(join(desktop,'tests/fixtures/terminal-job-list.cs'),'utf8'),extension:await readFile(join(desktop,'tests/fixtures/terminal-session-composition.inc'),'utf8')});
 const fixtureSource=join(output,'fixture-derived.cs');await writeFile(fixtureSource,derived.fixture,{flag:'wx'});
 const observerOriginal=await readFile(join(desktop,'tests/fixtures/terminal-main-owner-observer.cs'),'utf8');assert.equal(hash(observerOriginal),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc');
 const replace=(source,before,after)=>{assert.equal(source.split(before).length,2);return source.replace(before,()=>after);};
 const observerBase=join(output,'observer-base.cs');await writeFile(observerBase,replace(replace(observerOriginal,'internal static class TerminalMainOwnerObserver {','internal static partial class TerminalMainOwnerObserver {'),'static int Main(string[] args) {','static int HistoricalMain(string[] args) {'),{flag:'wx'});
 const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),fixture=join(output,'fixed-composition-child.exe'),observer=join(output,'composition-observer.exe');
 for(const [sources,exe,name] of [[[fixtureSource],fixture,'fixture'],[[observerBase,join(desktop,'tests/fixtures/terminal-session-composition-observer.cs')],observer,'observer']]){
  try{const r=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/reference:System.Web.Extensions.dll','/out:'+exe,...sources],{windowsHide:true,timeout:30000,maxBuffer:65536});await writeFile(join(output,name+'-compiler.txt'),r.stdout+r.stderr,{flag:'wx'});}catch(e){await writeFile(join(output,name+'-compiler-failed.txt'),(e.stdout??'')+(e.stderr??''),{flag:'wx'});throw e;}
 }
 for(const path of [compiler,fixtureSource,observerBase,fixture,observer]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 if(compileOnly)receipt.status='COMPILE_ONLY_NATIVE_NOT_EXECUTED';
 else{
  const electron=join(desktop,'node_modules/electron/dist/electron.exe'),hostEntry=join(output,'host.mjs'),creatorEntry=join(output,'creator.mjs');
  const config={output,addon,fixture,electron,hostEntry,creator:creatorEntry,worker:join(desktop,'tests/native/terminal-electron-broker-worker.mjs'),packagePath:join(desktop,'tests/fixtures/terminal-node-pty/package.json'),negative};
  await writeFile(creatorEntry,`void (${creator.toString()})(${JSON.stringify(pathToFileURL(config.worker).href)},process.argv[2]);`,{flag:'wx'});
  await writeFile(join(output,'package.json'),JSON.stringify({type:'module',main:'main.mjs'}),{flag:'wx'});await writeFile(hostEntry,`void (${controlHost.toString()})();`,{flag:'wx'});await writeFile(join(output,'main.mjs'),`void (${main.toString()})(${JSON.stringify(config)});`,{flag:'wx'});
  for(const path of [electron,addon,hostEntry,creatorEntry,join(output,'main.mjs'),join(output,'package.json')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
  const child=spawn(observer,[electron,output,output,fixture],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')))});
  let stdout='',stderr='';child.once('spawn',()=>{receipt.processStarted=true;});child.stdout.on('data',b=>{stdout+=b;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-32768);});
  receipt.outerExitCode=await new Promise(resolve=>{let done=false,grace;const finish=(code,observed)=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};const timer=setTimeout(()=>{receipt.deadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{child.kill();}catch{}},40000);child.once('error',e=>{receipt.processError={code:e.code,message:e.message};finish(null,false);});child.once('exit',code=>finish(code,true));});
  await writeFile(join(output,'observer.log'),stdout+stderr,{flag:'wx'});
  receipt.observer=JSON.parse(await readFile(join(output,'observer-result.json'),'utf8'));receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));
 }
 receipt.inputsUnchanged=true;for(const input of receipt.inputs)if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;assert.equal(receipt.inputsUnchanged,true);
 if(!compileOnly){receipt.qualified=receipt.processStarted&&receipt.outerExitObserved&&receipt.outerExitCode===0&&!receipt.deadlineExceeded&&!receipt.outputTruncated&&receipt.observer.status==='COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED'&&receipt.observer.cleanupVerified===true&&receipt.observer.safetyOpenAtObservation===true&&receipt.observer.activeBeforeSafetyCleanup===0&&isSessionCompositionObserved(receipt.native);assert.equal(receipt.qualified,true,'SESSION_COMPOSITION_INCOMPLETE');receipt.status='SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED';}
}catch(e){receipt.status='FAILED';receipt.error={code:e.code,message:e.message};throw e;}finally{await save();console.log(JSON.stringify(receipt));}
