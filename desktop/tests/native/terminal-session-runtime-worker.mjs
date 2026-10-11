// Hosted-only finite Session probe. Genuine Electron windows, MAIN dispatch;
// blank isolated renderers are not the Terminal UI or a packaged-product test.
import assert from 'node:assert/strict';
import {app,BrowserWindow,protocol,utilityProcess,session} from 'electron';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {randomBytes,createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {createLockContinuationFixture} from './terminal-session-command.mjs';

export async function startRuntimeProbe(config){
 const {root,out,execution,electronExecutable,filesystemExecutable,observerExecutable,run,commit}=config;
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');
 assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
 assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.versions.napi,'10');
 assert.equal(process.execPath,electronExecutable);assert.equal(app.isReady(),true);
 const result={scope:'BOUNDED_ACTUAL_ELECTRON_SESSION_MAIN_DISPATCH',status:'STARTED',run,commit,
  nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,rendererInputQualified:false,packagedQualified:false,
  milestones:[],helperCalls:[],unavailable:[],verified:[],nativeCalls:[]};
 const save=(name,data)=>writeFile(join(out,name),JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{flag:'wx'});
 const pin=async p=>{const b=await readFile(p);return{path:p,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};
 const milestone=async(name,data={})=>{result.milestones.push({name,...data});await save(String(result.milestones.length).padStart(2,'0')+'-'+name+'.json',data);};
 const bounded=async(p,ms,label)=>{let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+'_DEADLINE')),ms))]);}finally{clearTimeout(timer);}};
 const waitFile=async(p,expected)=>{for(let i=0;i<300;i++){try{const v=await readFile(p,'utf8');assert.equal(v,expected);return;}catch(e){if(e.code!=='ENOENT')throw e;}await delay(50);}throw Error('FIXTURE_FILE_DEADLINE:'+p);};
 const absent=async p=>{try{await readFile(p);assert.fail('Unexpected fixture execution:'+p);}catch(e){if(e.code!=='ENOENT')throw e;}};
 const nativeState={host:null,sessions:[],hostStops:[],sessionStops:[]},windows=new Set();
 let graph,members,observer,observerExit,observerStdout='',observerStderr='',host,hostExit,locked=false,op=0,helperCount=0;
 const exec=promisify(execFile),helperPin=await pin(filesystemExecutable),observerPin=await pin(observerExecutable);
 const event=w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame});
 const importExecution=p=>import(pathToFileURL(join(execution,p)).href);
 const request=(grant,fields={})=>({operationId:'runtime_'+(++op),epoch:grant.epoch,...fields});
 async function helper(mode,target){
  assert.deepEqual(await pin(filesystemExecutable),helperPin);
  const args=target===undefined?[mode]:[mode,target],row={mode,target:target??null,deadlineMs:10000},started=performance.now();
  try{const r=await exec(filesystemExecutable,args,{cwd:out,windowsHide:true,timeout:10000,maxBuffer:262144});Object.assign(row,{exit:0,stdout:r.stdout,stderr:r.stderr});assert.equal(r.stderr.trim(),'');return JSON.parse(r.stdout);}
  catch(e){Object.assign(row,{exit:e.code??null,stdout:e.stdout??'',stderr:e.stderr??'',message:e.message});throw e;}
  finally{row.elapsedMs=performance.now()-started;result.helperCalls.push(row);await save('filesystem-'+String(++helperCount).padStart(3,'0')+'.json',row);assert.deepEqual(await pin(filesystemExecutable),helperPin);}
 }
 async function windowAt(url){
  const w=new BrowserWindow({show:false,width:640,height:480,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});windows.add(w);
  w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  for(const name of ['will-navigate','will-redirect'])w.webContents.on(name,(e,target)=>{if(target!==url)e.preventDefault();});
  await w.loadURL(url);assert.equal(w.webContents.getURL(),url);assert.equal(w.webContents.mainFrame.url,url);return w;
 }
 try{
  const {WindowRegistry}=await importExecution('desktop/src/windows/registry.mjs');
  const {createTerminalShutdownGraph}=await importExecution('desktop/src/terminal/shutdown-graph.mjs');
  const {validateHostAsyncReceipt}=await importExecution('desktop/src/terminal/host-async-receipt-contract.mjs');
  protocol.handle('siren',request=>{
   const u=new URL(request.url);assert.equal(u.host,'app');assert.ok(u.pathname==='/app.html'||u.pathname==='/windows/terminal.html');
   return new Response('<!doctype html><meta charset="utf-8"><title>Contained Terminal identity probe</title>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
  });
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  const project=join(out,'project țară 日本語');await mkdir(project);
  const fixture=createLockContinuationFixture({projectDirectory:project,token:randomBytes(16).toString('hex')});
  await writeFile(fixture.scriptPath,'\uFEFF'+fixture.script,{flag:'wx'});await save('fixed-command-fixture.json',fixture);
  const entities=[],registry=new WindowRegistry({terminalViews:true,authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:entities}),createWindow:o=>windowAt(o.mainFrameUrl)});
  const workspace=await windowAt('siren://app/app.html');registry.bindWorkspace(workspace);registry.activateWorkspace();
  const workspaceGrant=registry.capture(event(workspace));assert.equal(workspaceGrant.role,'workspace');
  const addonPath=join(execution,'desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node');
  const native=createRequire(import.meta.url)(addonPath),mark=native.mark(),facade=Object.create(null);
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(native))){
   assert.ok(Object.hasOwn(d,'value'));if(typeof d.value!=='function')continue;
   facade[key]=(...args)=>{
    // Record only bounded, non-secret facts. Never record bootstrap bytes,
    // pipe credentials or provider Promise results; preserve original returns.
    const traced=['start','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','assertPeerCurrent'].includes(key);
    const row=traced&&result.nativeCalls.length<512?{method:key,elapsedFromStartMs:performance.now()}:null;
    if(row)result.nativeCalls.push(row);
    try{const value=Reflect.apply(d.value,native,args);if(row){row.returned=true;if(key==='snapshotSession'||key==='watchRoot'||key==='captureSession')row.observation=value;else if(key==='assertPeerCurrent')row.current=value;}
     if(key==='start')nativeState.host=value;if(key==='createPeerSession')nativeState.sessions.push(value);if(key==='stopAndCloseHostAsync')nativeState.hostStops.push(value);if(key==='stopAndCloseSessionAsync')nativeState.sessionStops.push(value);return value;
    }catch(error){if(row)row.error={code:error.code??null,message:error.message};throw error;}
   };
  }
  // Electron utility processes expose process.parentPort, not a Node worker port.
  const hostEntry=join(out,'session-host.mjs');await writeFile(hostEntry,"setInterval(()=>{},1000);\nprocess.parentPort.postMessage({ready:true,electron:process.versions.electron,modules:process.versions.modules,napi:process.versions.napi});\n",{flag:'wx'});
  host=utilityProcess.fork(hostEntry,[],{serviceName:'SIREN bounded Session host',stdio:'pipe'});
  hostExit=new Promise((resolve,reject)=>{host.once('exit',code=>resolve(code));host.once('error',reject);});hostExit.catch(()=>{});
  let hostOut='',hostErr='';host.stdout?.on('data',b=>hostOut+=b);host.stderr?.on('data',b=>hostErr+=b);
  const ready=await bounded(new Promise(resolve=>host.once('message',resolve)),10000,'UTILITY_READY');
  assert.deepEqual(ready,{ready:true,electron:'44.5.1',modules:'149',napi:'10'});
  const system=await helper('system'),systemRoot=dirname(system);
  graph=createTerminalShutdownGraph({projectId:'project1',registry,native:facade,hostProcessIdentity:{pid:host.pid,image:process.execPath,since:mark},
   ownership:{isCurrent:()=>true,onUnavailable:()=>{result.unavailable.push('OWNERSHIP_UNAVAILABLE');},onVerified:()=>{result.verified.push('SESSION_VERIFIED');}},
   creator:{executable:process.execPath,entry:join(execution,'desktop/src/terminal/production-creator-launcher.mjs'),directory:execution},
   cwd:{pickDirectory:async()=>({canceled:false,filePaths:[project]}),protectedRoots:[execution],inspectDirectory:p=>helper('directory',p)},
   profiles:{grants:[workspaceGrant],getSystemDirectory:async()=>system,inspectExecutable:p=>helper('file',p),readEnvironment:async()=>({SystemRoot:systemRoot,PATH:system+';'+systemRoot}),privateEnvironmentKeys:[]},
   access:{prepareWorkspace:async()=>{},retireViews:async()=>{for(const w of windows)if(w!==workspace&&!w.isDestroyed())w.destroy();},rollbackWorkspace:async()=>{},isReady:()=>!locked},
   policy:{isUnlocked:()=>!locked,getMode:()=> 'normal',canExecute:()=>true},deadlineMs:5000});
  assert.equal(graph.start().ok,true);members=graph.mainAuthorities();
  await milestone('actual-native-host',{mainPid:process.pid,utilityPid:host.pid,before:native.capture(nativeState.host),versions:process.versions,workspaceGrant});
  assert.equal((await members.access.beginLock('initial closed gate')).ok,true);
  assert.equal((await members.access.reopen(event(workspace))).ok,true);
  const router=members.access.currentRouter();assert.ok(router);
  const cwd=await members.cwdAuthority.pick(workspaceGrant);assert.equal(cwd.displayPath,project);
  assert.equal((await members.profileCatalogues[0].listShellProfiles())[0].available,true);
  const created=await router.route({event:event(workspace),method:'terminalCreate',payload:request(workspaceGrant,{cwdId:cwd.cwdId,profileId:'powershell',cols:120,rows:40})});
  await milestone('actual-session-create',{created,manager:members.manager.stats()});assert.equal(created.ok,true);assert.equal(nativeState.sessions.length,1);
  const sessionId=created.value.sessionId;entities.push(sessionId);
  async function attach(){const record=await registry.openView({role:'terminal',entityId:sessionId});const w=[...windows].find(w=>!w.isDestroyed()&&w.webContents.getURL()===`siren://app/windows/terminal.html?windowId=${record.windowId}`);assert.ok(w);const grant=registry.capture(event(w));assert.equal(grant.role,'terminal');const router=members.access.currentRouter(),reply=await router.route({event:event(w),method:'terminalAttach',payload:request(grant,{sessionId})});assert.equal(reply.ok,true);return{w,grant,router,lease:{sessionId,leaseId:reply.value.leaseId,generation:reply.value.generation}};}
  const first=await attach();await milestone('actual-terminal-attach',{grant:first.grant,lease:first.lease});
  const input=await first.router.route({event:event(first.w),method:'terminalInput',payload:request(first.grant,{...first.lease,inputSequence:0,data:fixture.input})});assert.equal(input.ok,true);
  await waitFile(fixture.startedPath,fixture.expected);await absent(fixture.completedPath);
  // Capture is one-shot: backend already captured the Session held set, and
  // this probe captured the host above. Observe those same held capabilities.
  const beforeSession=native.snapshotSession(nativeState.sessions[0]),beforeHost=native.snapshot(nativeState.host);
  const expected=new Map();for(const p of [beforeHost.root,...beforeHost.held,beforeSession.root,beforeSession.shell,...beforeSession.held])if(p){assert.equal(p.alive,true);const row={pid:p.pid,image:p.image,createdFileTime:p.createdFileTime};if(expected.has(p.pid))assert.deepEqual(expected.get(p.pid),row);expected.set(p.pid,row);}
  const expectedPath=join(out,'expected-process-identities.json'),observerPath=join(out,'external-process-exits.json');await save('expected-process-identities.json',[...expected.values()]);
  assert.deepEqual(await pin(observerExecutable),observerPin);
  observer=spawn(observerExecutable,['capture',observerPath,expectedPath],{cwd:out,windowsHide:true,stdio:['ignore','pipe','pipe']});
  observerExit=new Promise((resolve,reject)=>{observer.once('exit',(code,signal)=>resolve({code,signal}));observer.once('error',reject);});observerExit.catch(()=>{});
  const observerReady=new Promise((resolve,reject)=>{observer.stdout.on('data',b=>{observerStdout+=b;const line=observerStdout.split(/\r?\n/).find(x=>x.startsWith('{'));if(line)try{resolve(JSON.parse(line));}catch{reject(Error('OBSERVER_READY_JSON'));}});observer.stderr.on('data',b=>observerStderr+=b);observer.once('error',reject);});
  const observed=await bounded(observerReady,5000,'OBSERVER_READY');assert.equal(observed.status,'READY');assert.equal(observed.identities.length,expected.size);
  for(const actual of observed.identities)assert.deepEqual(expected.get(actual.pid),{pid:actual.pid,image:actual.image,createdFileTime:actual.createdFileTime});
  await milestone('before-lock',{beforeSession,beforeHost,input,observer:observed,completionAbsent:true});
  const lock=await members.access.beginLock('actual running PowerShell fixture');assert.equal(lock.ok,true);locked=true;
  assert.equal(nativeState.sessionStops.length,0);assert.equal(nativeState.hostStops.length,0);assert.equal(first.w.isDestroyed(),true);assert.equal(registry.isCurrent(first.grant),false);assert.equal(members.access.currentRouter(),null);
  const refused=await first.router.route({event:event(first.w),method:'terminalInput',payload:request(first.grant,{...first.lease,inputSequence:1,data:fixture.forbiddenInput})});assert.equal(refused.ok,false);
  const afterLock=native.snapshotSession(nativeState.sessions[0]);assert.equal(afterLock.root.alive,true);assert.equal(afterLock.shell.alive,true);
  await absent(fixture.completedPath);await absent(fixture.forbiddenPath);await milestone('lock-ack-input-refused',{lock,refused,afterLock,sessionStopCalls:0,hostStopCalls:0});
  await writeFile(fixture.releasePath,fixture.expected,{flag:'wx'});await waitFile(fixture.completedPath,fixture.expected);await absent(fixture.forbiddenPath);
  assert.equal(locked,true);assert.equal(members.access.currentRouter(),null);assert.equal(nativeState.sessionStops.length,0);
  await milestone('command-completed-while-locked',{completion:await readFile(fixture.completedPath,'utf8'),forbiddenAbsent:true,locked:true});
  locked=false;assert.equal((await members.access.reopen(event(workspace))).ok,true);
  const second=await attach();assert.notEqual(second.grant.windowId,first.grant.windowId);assert.ok(second.lease.generation>first.lease.generation);
  const oldRefused=await first.router.route({event:event(workspace),method:'terminalList',payload:request(workspaceGrant)});assert.equal(oldRefused.ok,false);
  let output='',chunks=0;for(let i=0;i<100&&!output.includes('SIREN_LOCK_CONTINUATION_COMPLETE');i++){
   let transfer;const delivered=await members.manager.deliverAvailable(second.grant,request(second.grant,second.lease),v=>{transfer=v;});assert.equal(delivered.ok,true);
   if(transfer?.chunk){chunks++;output+=transfer.chunk.data;assert.equal(members.manager.commitOutputHandoff(delivered.value.handoffTicket).ok,true);const ack=await second.router.route({event:event(second.w),method:'terminalAck',payload:request(second.grant,{...second.lease,throughSequence:transfer.chunk.sequence+transfer.chunk.utf8Bytes})});assert.equal(ack.ok,true);}else await delay(50);
  }
  assert.ok(chunks>0);assert.ok(output.includes('SIREN_LOCK_CONTINUATION_COMPLETE'));await writeFile(join(out,'replayed-history.txt'),output,{flag:'wx'});
  await milestone('unlock-fresh-lease-history',{grant:second.grant,lease:second.lease,chunks,bytes:Buffer.byteLength(output),oldRouterRefused:oldRefused});
  const stopped=await members.access.currentRouter().route({event:event(workspace),method:'terminalStop',payload:request(workspaceGrant,{sessionId})});assert.equal(stopped.ok,true);assert.equal(nativeState.sessionStops.length,1);
  const sessionReceipt=await nativeState.sessionStops[0];assert.equal(sessionReceipt.closed,true);assert.equal(sessionReceipt.snapshot.active,0);for(const p of [sessionReceipt.snapshot.root,sessionReceipt.snapshot.shell,...sessionReceipt.snapshot.held])if(p)assert.equal(p.alive,false);
  await milestone('session-stop-native-receipt',{stopped,receipt:sessionReceipt});
  const shutdownId='runtime_'+run,handle=graph.captureSettlement(),joined=await bounded(graph.shutdown({code:77,deadlineMs:5000,shutdownId}),15000,'GRAPH_JOIN');assert.equal(joined.actualSettled,true);assert.equal(joined.unknown,false);assert.equal(handle.snapshot().hostNativeJoined,false);
  assert.equal(nativeState.hostStops.length,1);const hostReceipt=await nativeState.hostStops[0],hostExpected=native.captureHostShutdownExpectation(nativeState.host,shutdownId),checked=validateHostAsyncReceipt(hostExpected,hostReceipt);assert.equal(checked.ok,true);
  const externalExit=await bounded(observerExit,10000,'EXTERNAL_JOIN');assert.equal(externalExit.code,0);const external=JSON.parse(await readFile(observerPath,'utf8'));assert.equal(external.status,'EXACT_HELD_PROCESSES_EXITED');
  const utilityExit=await bounded(hostExit,5000,'UTILITY_EXIT');await save('utility-output.json',{stdout:hostOut,stderr:hostErr,exit:utilityExit});
  await milestone('shutdown-separate-native-and-external-joins',{graph:joined,hostReceipt,hostExpected,checked,external,externalExit,utilityExit});
  result.status='BOUNDED_SESSION_RUNTIME_COMPLETE';result.realSessions=1;result.commandCompletedAfterLockAck=true;result.lockRefusedNewInput=true;result.externalProcessJoin=true;
 }catch(error){result.status='FAILED';result.error={message:error.message,code:error.code??null,stack:error.stack};
  if(graph)try{result.failureShutdown=await bounded(graph.shutdown({code:98,deadlineMs:5000,shutdownId:'failure_'+run}),15000,'FAILURE_SHUTDOWN');}catch(e){result.failureShutdownError=e.message;}
 }finally{
  if(observer){await save('observer-output.json',{stdout:observerStdout,stderr:observerStderr});assert.deepEqual(await pin(observerExecutable),observerPin);}
  for(const w of windows)if(!w.isDestroyed())w.destroy();
  await save('worker-result.json',result);
 }
 return result;
}
