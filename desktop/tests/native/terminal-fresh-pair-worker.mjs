// Hosted-only, fixed single-cmdlet diagnostic. No running-command Lock.
// Blank genuine Electron windows qualify MAIN dispatch, not renderer/UI/package.
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
import {createOriginalResolutionFixture as createSingleCmdletFixture} from './terminal-resolution-observation.mjs';
import {readTerminalConnectRawFile} from './terminal-connect-raw-file.mjs';
function argsToCommandLine(file, args) {
    if (isCommandLine(args)) {
        if (args.length === 0) {
            return file;
        }
        return argsToCommandLine(file, []) + " " + args;
    }
    var argv = [file];
    Array.prototype.push.apply(argv, args);
    var result = '';
    for (var argIndex = 0; argIndex < argv.length; argIndex++) {
        if (argIndex > 0) {
            result += ' ';
        }
        var arg = argv[argIndex];
        // if it is empty or it contains whitespace and is not already quoted
        var hasLopsidedEnclosingQuote = xOr((arg[0] !== '"'), (arg[arg.length - 1] !== '"'));
        var hasNoEnclosingQuotes = ((arg[0] !== '"') && (arg[arg.length - 1] !== '"'));
        var quote = arg === '' ||
            (arg.indexOf(' ') !== -1 ||
                arg.indexOf('\t') !== -1) &&
                ((arg.length > 1) &&
                    (hasLopsidedEnclosingQuote || hasNoEnclosingQuotes));
        if (quote) {
            result += '\"';
        }
        var bsCount = 0;
        for (var i = 0; i < arg.length; i++) {
            var p = arg[i];
            if (p === '\\') {
                bsCount++;
            }
            else if (p === '"') {
                result += repeatText('\\', bsCount * 2 + 1);
                result += '"';
                bsCount = 0;
            }
            else {
                result += repeatText('\\', bsCount);
                bsCount = 0;
                result += p;
            }
        }
        if (quote) {
            result += repeatText('\\', bsCount * 2);
            result += '\"';
        }
        else {
            result += repeatText('\\', bsCount);
        }
    }
    return result;
}

function isCommandLine(args) {
    return typeof args === 'string';
}
function repeatText(text, count) {
    var result = '';
    for (var i = 0; i < count; i++) {
        result += text;
    }
    return result;
}
function xOr(arg1, arg2) {
    return ((arg1 && !arg2) || (!arg1 && arg2));
}


// FRESH_BOUNDARY_HELPERS_BEGIN
function freshEnvironmentRows(environment){
 const rows=[];for(const [key,value]of Object.entries(environment)){
  assert.equal(typeof value,'string');assert.ok(value.isWellFormed()&&!value.includes('\0')&&Buffer.byteLength(value)<=32768);
  rows.push({key,bytes:Buffer.byteLength(value),sha256:createHash('sha256').update(value).digest('hex')});
 }return rows;
}
function assertFreshBoundary(record,expected){
 assert.equal(record.ok,true);const r=record.decoded.observation;
 assert.equal(r.schema,1);assert.equal(r.boundary,'JS_NATIVE_CONNECT_ARGUMENTS');assert.equal(r.argumentCount,6);
 assert.equal(r.creatorPid,expected.creatorPid);assert.equal(r.returnedPid,expected.shellPid);
 assert.equal(r.count,1);assert.equal(r.duplicate,false);assert.equal(r.phase,'RETURNED');assert.equal(r.returnStatus,'RETURNED');
 assert.equal(r.pidAssignment,'ASSIGNED');assert.equal(r.argumentsUnchanged,true);assert.deepEqual(r.captureCodes,[]);
 assert.equal(r.clock,'PROCESS_MONOTONIC');assert.ok(Number.isFinite(r.beforeConnectMs)&&r.beforeConnectMs>=0&&Number.isFinite(r.afterConnectMs)&&r.afterConnectMs>=r.beforeConnectMs);
 assert.deepEqual(r.before,r.after);assert.equal(r.before.useConptyDll,false);
 assert.deepEqual(r.before.env,expected.env);
 assert.equal(r.before.cwdSha256,createHash('sha256').update(expected.cwd).digest('hex'));
 assert.equal(r.before.cwdBytes,Buffer.byteLength(expected.cwd));
 assert.equal(r.before.commandLineSha256,createHash('sha256').update(expected.commandLine).digest('hex'));
 assert.equal(r.before.commandLineBytes,Buffer.byteLength(expected.commandLine));return r;
}
async function freshParentPermit(challenge){
 const started=performance.now();let pending='',seen=false,timer,invalid=false;
 try{return await new Promise((resolve,reject)=>{
  const bad=()=>{invalid=true;reject(Error('FRESH_PREINPUT_PIPE_REFUSED'));};
  const consume=chunk=>{try{pending+=chunk;if(Buffer.byteLength(pending)>4096)throw 0;const i=pending.indexOf('\n');if(i<0)return;
   assert.equal(seen,false);seen=true;assert.equal(pending.slice(i+1),'');const value=JSON.parse(pending.slice(0,i));
   assert.equal(JSON.stringify(value)+'\n',pending);assert.deepEqual(value,{schema:1,type:'FRESH_PREINPUT_PERMIT',workerPid:process.pid,armId:challenge.armId,token:challenge.token,nonce:challenge.nonce,rawSha256:challenge.rawSha256});
   resolve({startedMs:started,endedMs:performance.now(),isCurrent:()=>!invalid});
  }catch{bad();}};
  process.stdin.setEncoding('utf8');process.stdin.on('data',consume);process.stdin.once('end',bad);process.stdin.once('error',bad);
  timer=setTimeout(()=>reject(Error('FRESH_PREINPUT_PIPE_DEADLINE')),5000);
  process.stdout.write('SIREN_FRESH_PREINPUT '+JSON.stringify(challenge)+'\n');
 });}finally{clearTimeout(timer);}
}
// FRESH_BOUNDARY_HELPERS_END


// INERT_HELPERS_BEGIN
function assertFixedControl(control){
 assert.ok(control==='start-sleep'||control==='write-output','FIXED_CMDLET_CONTROL_REQUIRED');return control;
}
function requireCmdletCompletion(fixture,proof){
 assertFixedControl(fixture.control);assert.equal(proof.started,fixture.expected,'CMDLET_STARTED_TOKEN');
 assert.equal(proof.stage,'after-'+fixture.control,'CMDLET_AFTER_STAGE');assert.equal(proof.completed,fixture.expected,'CMDLET_COMPLETED_TOKEN');
}
function requireHistoryMarkers(fixture,output){
 assertFixedControl(fixture.control);assert.equal(typeof output,'string');
 assert.equal(fixture.expectedConsole,'SIREN_CMDLET_COMPLETE_'+fixture.expected);
 assert.equal(fixture.expectedPipeline,fixture.control==='write-output'?'SIREN_PIPELINE_CONTROL':null);
 const markers=fixture.expectedPipeline?[fixture.expectedPipeline,fixture.expectedConsole]:[fixture.expectedConsole];
 for(const marker of markers){assert.ok(!fixture.input.includes(marker),'INPUT_ECHO_CANNOT_QUALIFY');assert.ok(output.includes(marker),'CMDLET_HISTORY_MARKER_MISSING:'+marker);}
 return markers;
}
function createReadyLineConsumer(resolve,reject){
 let pending='',settled=false;
 return chunk=>{
  if(settled)return;
  if(typeof chunk!=='string'){settled=true;reject(Error('OBSERVER_READY_UTF8_REQUIRED'));return;}
  pending+=chunk;if(Buffer.byteLength(pending,'utf8')>262144){settled=true;reject(Error('OBSERVER_READY_OVERFLOW'));return;}
  const lines=pending.split(/\r?\n/);pending=lines.pop();
  for(const line of lines){if(!line.startsWith('{'))continue;settled=true;try{resolve(JSON.parse(line));}catch{reject(Error('OBSERVER_READY_JSON'));}return;}
 };
}
function identityKey(value){
 assert.ok(value&&Number.isInteger(value.pid)&&value.pid>0&&value.pid<=0xffffffff);
 assert.ok(typeof value.image==='string'&&/^[A-Za-z]:\\/.test(value.image));
 assert.ok(typeof value.createdFileTime==='string'&&/^[1-9][0-9]*$/.test(value.createdFileTime));
 return JSON.stringify([value.pid,value.image,value.createdFileTime]);
}
function assertIdentityRows(expected,rows){
 assert.ok(Array.isArray(expected)&&Array.isArray(rows));assert.equal(rows.length,expected.length);
 const keys=new Set(expected.map(identityKey)),actual=new Set(rows.map(identityKey));
 assert.equal(keys.size,expected.length);assert.equal(actual.size,rows.length);
 assert.equal(new Set(expected.map(p=>p.pid)).size,expected.length);assert.equal(new Set(rows.map(p=>p.pid)).size,rows.length);
 for(const key of actual)assert.ok(keys.has(key),'HELD_IDENTITY_MISMATCH');
}
function assertReadyIdentities(expected,ready){
 assert.equal(expected.length,4,'EXACT_FOUR_HELD_IDENTITIES_REQUIRED');assert.equal(ready.status,'READY');assertIdentityRows(expected,ready.identities);
 for(const p of ready.identities){assert.equal(p.wait,258,'OBSERVER_READY_NOT_LIVE');assert.equal(p.exitCode,259);}
}
function assertSessionClosed(before,receipt,code){
 assert.ok(code===77||code===98);assert.equal(receipt.closed,true);const snapshot=receipt.snapshot;
 assert.equal(snapshot.active,0);assert.equal(identityKey(snapshot.root),identityKey(before.root));assert.equal(identityKey(snapshot.shell),identityKey(before.shell));
 assertIdentityRows(before.held,snapshot.held);
 for(const p of [snapshot.root,snapshot.shell,...snapshot.held]){assert.equal(p.alive,false,'SESSION_MEMBER_STILL_ALIVE');assert.equal(p.exitCode,code);}
}
function assertExternalJoin(expected,external,externalExit,code){
 assert.equal(expected.length,4);assert.equal(external.status,'EXACT_HELD_PROCESSES_EXITED');assert.equal(externalExit.code,0);assert.equal(externalExit.signal,null);
 assertIdentityRows(expected,external.before);assertIdentityRows(expected,external.after);
 for(const p of external.before){assert.equal(p.wait,258);assert.equal(p.exitCode,259);}
 for(const p of external.after){assert.equal(p.wait,0);assert.equal(p.exitCode,code);}
}
function assertCleanupObservation(observation){
 const {code,graph,beforeSession,sessionReceipts,hostReceipt,checked,expected,external,externalExit,utilityExit}=observation;
 assert.ok(code===77||code===98);assert.equal(graph.actualSettled,true);assert.equal(graph.unknown,false);
 assert.equal(graph.hostNativeJoined,false);assert.equal(graph.sessionCleanupJoined,false);
 assert.ok(Array.isArray(sessionReceipts));assert.equal(sessionReceipts.length,1);assertSessionClosed(beforeSession,sessionReceipts[0],code);
 assert.equal(checked.ok,true);assert.equal(checked.actualSettlementEstablished,false);
 assert.equal(hostReceipt.closed,true);assert.equal(hostReceipt.code,code);assert.equal(hostReceipt.snapshot.active,0);
 assert.equal(identityKey(hostReceipt.snapshot.root),identityKey(expected[0]));assertIdentityRows([expected[0]],hostReceipt.snapshot.held);
 for(const p of [hostReceipt.snapshot.root,...hostReceipt.snapshot.held]){assert.equal(p.alive,false);assert.equal(p.exitCode,code);}
 assertExternalJoin(expected,external,externalExit,code);assert.equal(utilityExit,code);
}
// INERT_HELPERS_END

export async function startRuntimeProbe(config){
 const {root,out,execution,electronExecutable,filesystemExecutable,observerExecutable,run,commit,control,armId,projectDirectory,fixtureDirectory,expectedEnvironment,retainedJobRoot,expectedFixture}=config;
 assert.ok(armId==='pathext-omitted'||armId==='pathext-trusted');assert.equal(control,'write-output');
 assertFixedControl(control);
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');
 assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
 assert.equal(process.versions.electron,'44.5.1');assert.equal(process.versions.modules,'149');assert.equal(process.versions.napi,'10');
 assert.equal(process.execPath,electronExecutable);assert.equal(app.isReady(),true);
 const result={scope:'HOSTED_FRESH_PATHEXT_PAIR_ARM_NOT_SESSION_ADMISSION',status:'STARTED',control,run,commit,
  nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,rendererInputQualified:false,packagedQualified:false,
  realSessions:0,commandCompleted:false,mandatoryMarkersObserved:false,externalProcessJoin:false,cleanupVerified:false,
  milestones:[],helperCalls:[],nativeCalls:[],ownershipEvents:[],unavailable:[],verified:[]};
 const commandTiming={scope:'DIAGNOSTIC_MONOTONIC_INPUT_WAIT_V1',clockDomain:'worker-process-performance-now',run,commit,control,workerPid:process.pid,heldShellPid:null,fixtureVariant:null,token:null,commandInputSequence:0,nominalWaitMs:15000,pollCount:300,pollDelayMs:50,inputSubmittedMs:null,inputReturnedMs:null,inputAcceptedMs:null,waitStartedMs:null,nominalDeadlineMs:null,waitEndedMs:null,completionObserved:false,completionObservedMs:null,completionLate:null,completedWithinNominalDeadline:null};result.commandTiming=commandTiming;
 const probeStarted=performance.now();let observationPhase='setup';
 const save=(name,data)=>writeFile(join(out,name),JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v,2)+'\n',{flag:'wx'});
 const pin=async path=>{const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
 const milestone=async(name,data={})=>{result.milestones.push({name,...data});await save(String(result.milestones.length).padStart(2,'0')+'-'+name+'.json',data);};
 const bounded=async(promise,ms,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label+'_DEADLINE')),ms))]);}finally{clearTimeout(timer);}};
 const waitFile=async(path,expected)=>{for(let i=0;i<300;i++){try{const value=await readFile(path,'utf8');assert.equal(value,expected);return value;}catch(e){if(e.code!=='ENOENT')throw e;}await delay(50);}throw Error('FIXTURE_FILE_DEADLINE:'+path);};
 const absent=async path=>{try{await readFile(path);assert.fail('Unexpected pre-command execution:'+path);}catch(e){if(e.code!=='ENOENT')throw e;}};
 const observeOwnership=(kind,value)=>{
  result.ownershipEvents.push({kind,phase:observationPhase,elapsedMs:performance.now()-probeStarted,afterMilestone:result.milestones.at(-1)?.name??null,sessionOwnerId:value?.sessionOwnerId??null,sessionId:value?.sessionId??null,code:value?.code??null,stack:String(new Error('Ownership callback observation').stack).slice(0,4096)});
  result[kind==='unavailable'?'unavailable':'verified'].push(kind==='unavailable'?'OWNERSHIP_UNAVAILABLE':'SESSION_VERIFIED');
 };
 const nativeState={host:null,sessions:[],hostStops:[],sessionStops:[]},windows=new Set();
 let graph,members,native,fixture,workspace,workspaceGrant,sessionId,sessionOwnerId,beforeSession,beforeHost,expected,observerPath,
  observer,observerExit,observerStdout='',observerStderr='',host,hostExit,hostOut='',hostErr='',validateHostAsyncReceipt,
  op=0,helperCount=0,completedObservations=false;
 const exec=promisify(execFile),helperPin=await pin(filesystemExecutable),observerPin=await pin(observerExecutable);
 const event=w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame});
 const importExecution=path=>import(pathToFileURL(join(execution,path)).href);
 const request=(grant,fields={})=>({operationId:'cmdlet_'+(++op),epoch:grant.epoch,...fields});
 async function helper(mode,target){
  assert.deepEqual(await pin(filesystemExecutable),helperPin);
  const args=target===undefined?[mode]:[mode,target],row={mode,target:target??null,deadlineMs:10000},started=performance.now();
  try{const reply=await exec(filesystemExecutable,args,{cwd:out,windowsHide:true,timeout:10000,maxBuffer:262144});Object.assign(row,{exit:0,stdout:reply.stdout,stderr:reply.stderr});assert.equal(reply.stderr.trim(),'');return JSON.parse(reply.stdout);}
  catch(e){Object.assign(row,{exit:e.code??null,stdout:e.stdout??'',stderr:e.stderr??'',message:e.message});throw e;}
  finally{row.elapsedMs=performance.now()-started;result.helperCalls.push(row);await save('filesystem-'+String(++helperCount).padStart(3,'0')+'.json',row);assert.deepEqual(await pin(filesystemExecutable),helperPin);}
 }
 async function windowAt(url){
  const window=new BrowserWindow({show:false,width:640,height:480,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});windows.add(window);
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  for(const name of ['will-navigate','will-redirect'])window.webContents.on(name,(e,target)=>{if(target!==url)e.preventDefault();});
  await window.loadURL(url);assert.equal(window.webContents.getURL(),url);assert.equal(window.webContents.mainFrame.url,url);return window;
 }
 async function captureFailureEvidence(){
  // Every observation is saved before cleanup; one read failure does not hide the others.
  const record=async(name,fn)=>{try{await save(name,await fn());}catch(e){(result.failureObservationErrors??=[]).push({name,message:e.message});}};
  if(fixture){
   await record('failure-fixture-state.json',async()=>{
    const state={};for(const [key,path]of Object.entries({started:fixture.startedPath,stage:fixture.stagePath,completed:fixture.completedPath}))try{state[key]={value:await readFile(path,'utf8')};}catch(e){state[key]={error:e.code??e.message};}return state;
   });
   await record('failure-script.json',async()=>({pin:await pin(fixture.scriptPath),body:await readFile(fixture.scriptPath,'utf8')}));
  }
  if(members){
   let ownership;await record('failure-ownership.json',()=>{ownership=members.ownership.snapshot();return ownership;});
   if(native&&nativeState.sessions.length)await record('failure-native-session.json',()=>native.snapshotSession(nativeState.sessions[0]));
   const owner=ownership?.sessions.find(row=>row.sessionId===sessionId)??ownership?.sessions.find(row=>row.state==='running'),ownerId=owner?.sessionOwnerId??sessionOwnerId;
   if(ownerId)await record('failure-history.json',()=>bounded(members.backend.readHistory({ownerId,fromSequence:0,maxBytes:32768}),2000,'FAILURE_HISTORY'));
  }
 }
 async function collectCleanup(graphObservation,code,shutdownId){
  const observation={code,graph:graphObservation,beforeSession,expected,verified:false};
  const collect=async(key,fn)=>{try{observation[key]=await fn();}catch(e){(observation.errors??=[]).push({key,message:e.message});}};
  await collect('sessionReceipts',()=>bounded(Promise.all(nativeState.sessionStops),10000,'SESSION_NATIVE_RECEIPTS'));
  await collect('hostReceipt',async()=>{assert.equal(nativeState.hostStops.length,1);return bounded(nativeState.hostStops[0],10000,'HOST_NATIVE_RECEIPT');});
  if(native&&nativeState.host&&validateHostAsyncReceipt)await collect('hostExpected',()=>native.captureHostShutdownExpectation(nativeState.host,shutdownId));
  if(observation.hostExpected&&observation.hostReceipt)await collect('checked',()=>validateHostAsyncReceipt(observation.hostExpected,observation.hostReceipt));
  if(observerExit)await collect('externalExit',()=>bounded(observerExit,10000,'EXTERNAL_JOIN'));
  if(observerPath)await collect('external',async()=>JSON.parse(await readFile(observerPath,'utf8')));
  if(hostExit)await collect('utilityExit',()=>bounded(hostExit,5000,'UTILITY_EXIT'));
  observation.utilityOutput={stdout:hostOut,stderr:hostErr};
  try{assertCleanupObservation(observation);assert.equal(observation.errors?.length??0,0);observation.verified=true;}catch(e){observation.verificationError=e.message;}
  return observation;
 }
 try{
  const {WindowRegistry}=await importExecution('desktop/src/windows/registry.mjs');
  const {createTerminalShutdownGraph}=await importExecution('desktop/src/terminal/shutdown-graph.mjs');
  ({validateHostAsyncReceipt}=await importExecution('desktop/src/terminal/host-async-receipt-contract.mjs'));
  protocol.handle('siren',request=>{
   const url=new URL(request.url);assert.equal(url.host,'app');assert.ok(url.pathname==='/app.html'||url.pathname==='/windows/terminal.html');
   return new Response('<!doctype html><meta charset="utf-8"><title>Contained single-cmdlet identity probe</title>',{headers:{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
  });
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);
  const project=projectDirectory;assert.equal(project,join(retainedJobRoot,'..','project-Șiren-Δ'));
  assert.equal(fixtureDirectory,join(project,armId));
  fixture=createSingleCmdletFixture({projectDirectory:fixtureDirectory,token:expectedFixture.expected,control});assert.deepEqual(fixture,expectedFixture);result.fixtureVariant=fixture.variant;commandTiming.fixtureVariant=fixture.variant;commandTiming.token=fixture.expected;
  assert.equal(await readFile(fixture.scriptPath,'utf8'),'\uFEFF'+fixture.script);await save('fixed-command-fixture.json',fixture);
  const routerGrants=new Map(),entities=[];
  const registry=new WindowRegistry({terminalViews:true,authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:entities}),createWindow:options=>windowAt(options.mainFrameUrl)});
  workspace=await windowAt('siren://app/app.html');registry.bindWorkspace(workspace);registry.activateWorkspace();workspaceGrant=registry.capture(event(workspace));assert.equal(workspaceGrant.role,'workspace');
  const addonPath=join(execution,'desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node');
  native=createRequire(import.meta.url)(addonPath);const mark=native.mark(),facade=Object.create(null);
  for(const [key,descriptor]of Object.entries(Object.getOwnPropertyDescriptors(native))){
   assert.ok(Object.hasOwn(descriptor,'value'));if(typeof descriptor.value!=='function')continue;
   facade[key]=(...args)=>{
    const traced=['start','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','assertPeerCurrent'].includes(key);
    const row=traced&&result.nativeCalls.length<512?{method:key,elapsedFromStartMs:performance.now()-probeStarted}:null;if(row)result.nativeCalls.push(row);
    try{const value=Reflect.apply(descriptor.value,native,args);if(row){row.returned=true;if(['snapshotSession','watchRoot','captureSession'].includes(key))row.observation=value;else if(key==='assertPeerCurrent')row.current=value;}
     if(key==='start')nativeState.host=value;if(key==='createPeerSession')nativeState.sessions.push(value);if(key==='stopAndCloseHostAsync')nativeState.hostStops.push(value);if(key==='stopAndCloseSessionAsync')nativeState.sessionStops.push(value);return value;
    }catch(e){if(row)row.error={code:e.code??null,message:e.message};throw e;}
   };
  }
  const hostEntry=join(out,'session-host.mjs');await writeFile(hostEntry,"setInterval(()=>{},1000);\nprocess.parentPort.postMessage({ready:true,electron:process.versions.electron,modules:process.versions.modules,napi:process.versions.napi});\n",{flag:'wx'});
  host=utilityProcess.fork(hostEntry,[],{serviceName:'SIREN bounded single-cmdlet host',stdio:'pipe'});
  hostExit=new Promise((resolve,reject)=>{host.once('exit',code=>resolve(code));host.once('error',reject);});hostExit.catch(()=>{});
  host.stdout?.setEncoding('utf8');host.stderr?.setEncoding('utf8');host.stdout?.on('data',chunk=>hostOut+=chunk);host.stderr?.on('data',chunk=>hostErr+=chunk);
  const ready=await bounded(new Promise(resolve=>host.once('message',resolve)),10000,'UTILITY_READY');assert.deepEqual(ready,{ready:true,electron:'44.5.1',modules:'149',napi:'10'});
  const system=await helper('system'),systemRoot=dirname(system);
  graph=createTerminalShutdownGraph({projectId:'project1',registry,native:facade,hostProcessIdentity:{pid:host.pid,image:process.execPath,since:mark},
   ownership:{isCurrent:()=>true,onUnavailable:value=>observeOwnership('unavailable',value),onVerified:value=>observeOwnership('verified',value)},
   creator:{executable:process.execPath,entry:join(execution,'desktop/src/terminal/diagnostic-creator-launcher.mjs'),directory:execution},
   cwd:{pickDirectory:async()=>({canceled:false,filePaths:[project]}),protectedRoots:[execution],inspectDirectory:path=>helper('directory',path)},
   profiles:{grants:[workspaceGrant],getSystemDirectory:async()=>system,inspectExecutable:path=>helper('file',path),readEnvironment:async()=>{const env={SystemRoot:systemRoot,PATH:system+';'+systemRoot};for(const key of ['USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir'])if(typeof process.env[key]==='string'&&process.env[key])env[key]=process.env[key];if(armId==='pathext-trusted'){assert.equal(typeof process.env.PATHEXT,'string');env.PATHEXT=process.env.PATHEXT;}else assert.equal(process.env.PATHEXT,undefined);assert.deepEqual(freshEnvironmentRows(env),expectedEnvironment);return env;},privateEnvironmentKeys:[]},
   access:{prepareWorkspace:async()=>{},retireViews:async()=>{for(const window of windows)if(window!==workspace&&!window.isDestroyed())window.destroy();},rollbackWorkspace:async()=>{},isReady:()=>true},
   policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:grant=>{routerGrants.set(grant.windowId,grant);return true;}},deadlineMs:5000});
  observationPhase='host-start';assert.equal(graph.start().ok,true);members=graph.mainAuthorities();
  await milestone('actual-native-host',{mainPid:process.pid,utilityPid:host.pid,before:native.capture(nativeState.host),versions:process.versions,workspaceGrant});
  assert.equal((await members.access.beginLock('initial closed gate before any session')).ok,true);assert.equal((await members.access.reopen(event(workspace))).ok,true);
  const router=members.access.currentRouter();assert.ok(router);const cwd=await members.cwdAuthority.pick(workspaceGrant);assert.equal(cwd.displayPath,project);assert.equal((await members.profileCatalogues[0].listShellProfiles())[0].available,true);
  observationPhase='session-create';const created=await router.route({event:event(workspace),method:'terminalCreate',payload:request(workspaceGrant,{cwdId:cwd.cwdId,profileId:'powershell',cols:120,rows:40})});
  await milestone('actual-session-create',{created,manager:members.manager.stats()});assert.equal(created.ok,true);assert.equal(nativeState.sessions.length,1);result.realSessions=1;
  sessionId=created.value.sessionId;entities.push(sessionId);sessionOwnerId=members.ownership.snapshot().sessions.find(row=>row.sessionId===sessionId)?.sessionOwnerId;assert.ok(sessionOwnerId);
  observationPhase='first-attach';
  async function attach(){
   const record=await registry.openView({role:'terminal',entityId:sessionId});const window=[...windows].find(w=>!w.isDestroyed()&&w.webContents.getURL()===`siren://app/windows/terminal.html?windowId=${record.windowId}`);assert.ok(window);
   const grant=registry.capture(event(window));assert.equal(grant.role,'terminal');const router=members.access.currentRouter(),reply=await router.route({event:event(window),method:'terminalAttach',payload:request(grant,{sessionId})});assert.equal(reply.ok,true);
   const canonicalGrant=routerGrants.get(record.windowId);assert.ok(canonicalGrant);return{w:window,caller:event(window),grant:canonicalGrant,router,lease:{sessionId,leaseId:reply.value.leaseId,generation:reply.value.generation}};
  }
  const first=await attach();await milestone('actual-terminal-attach',{grant:first.grant,lease:first.lease});
  // These held capabilities are already captured by host/backend. Never recapture.
  beforeSession=native.snapshotSession(nativeState.sessions[0]);beforeHost=native.snapshot(nativeState.host);commandTiming.heldShellPid=beforeSession.shell.pid;
  const expectedMap=new Map();for(const member of [beforeHost.root,...beforeHost.held,beforeSession.root,beforeSession.shell,...beforeSession.held])if(member){assert.equal(member.alive,true);const row={pid:member.pid,image:member.image,createdFileTime:member.createdFileTime};if(expectedMap.has(row.pid))assert.deepEqual(expectedMap.get(row.pid),row);expectedMap.set(row.pid,row);}
  expected=[...expectedMap.values()];assert.equal(expected.length,4);
  const expectedPath=join(out,'expected-process-identities.json');observerPath=join(out,'external-process-exits.json');await save('expected-process-identities.json',expected);
  assert.deepEqual(await pin(observerExecutable),observerPin);observer=spawn(observerExecutable,['capture',observerPath,expectedPath],{cwd:out,windowsHide:true,stdio:['ignore','pipe','pipe']});
  observerExit=new Promise((resolve,reject)=>{observer.once('exit',(code,signal)=>resolve({code,signal}));observer.once('error',reject);});observerExit.catch(()=>{});
  observer.stdout.setEncoding('utf8');observer.stderr.setEncoding('utf8');
  const observerReady=new Promise((resolve,reject)=>{const consume=createReadyLineConsumer(resolve,reject);observer.stdout.on('data',chunk=>{observerStdout+=chunk;consume(chunk);});observer.stderr.on('data',chunk=>observerStderr+=chunk);observer.once('error',reject);});
  const observed=await bounded(observerReady,5000,'OBSERVER_READY');assertReadyIdentities(expected,observed);
  await absent(fixture.startedPath);await absent(fixture.completedPath);
  await milestone('before-command',{beforeSession,beforeHost,observer:observed,commandInputSequence:0,completionAbsent:true,runningCommandLock:false});
  // Genuine held capabilities and fixed raw DATA must agree BEFORE pipe permit.
  const enginePath=join(system,'WindowsPowerShell','v1.0','powershell.exe');assert.equal(beforeSession.shell.image.toUpperCase(),enginePath.toUpperCase());
  const engineFile=await helper('file',enginePath),enginePin=await pin(enginePath);assert.equal(engineFile.file,true);assert.equal(engineFile.reparse,false);
  const raw=await readTerminalConnectRawFile(retainedJobRoot,beforeSession.root.pid);await save('preinput-raw-file-data.json',raw);
  const rawObservation=assertFreshBoundary(raw,{creatorPid:beforeSession.root.pid,shellPid:beforeSession.shell.pid,env:expectedEnvironment,cwd:project,commandLine:argsToCommandLine(engineFile.canonicalPath,['-NoLogo','-NoProfile'])});
  await save('preinput-native-raw-binding.json',{raw,engineFile,enginePin,beforeSession,beforeHost,externalReady:observed,modelStatus:'UNAVAILABLE_EXTERNAL_ENGINE_NOT_IN_RETAINED_RUNTIME',inputAuthorized:false});
  const challenge={schema:1,type:'FRESH_PREINPUT_CHALLENGE',workerPid:process.pid,creatorPid:beforeSession.root.pid,shellPid:beforeSession.shell.pid,armId,token:fixture.expected,nonce:randomBytes(16).toString('hex'),rawSha256:raw.rawSha256};
  const handoff=await freshParentPermit(challenge);await save('preinput-pipe-handoff.json',{challenge,...handoff,inputAuthorized:false});
  assert.deepEqual(native.snapshotSession(nativeState.sessions[0]),beforeSession);assert.deepEqual(native.snapshot(nativeState.host),beforeHost);
  assert.deepEqual(await pin(enginePath),enginePin);assert.deepEqual(await helper('file',enginePath),engineFile);
  assertReadyIdentities(expected,observed);assertFreshBoundary(raw,{creatorPid:beforeSession.root.pid,shellPid:beforeSession.shell.pid,env:expectedEnvironment,cwd:project,commandLine:argsToCommandLine(engineFile.canonicalPath,['-NoLogo','-NoProfile'])});assert.equal(handoff.isCurrent(),true,'FRESH_PIPE_REVOKED');
  // The observer owns all four live handles before the one fixed input write.
  observationPhase='single-cmdlet-command';commandTiming.inputSubmittedMs=performance.now();const input=await first.router.route({event:first.caller,method:'terminalInput',payload:request(first.grant,{...first.lease,inputSequence:0,data:fixture.input})});commandTiming.inputReturnedMs=performance.now();if(input.ok===true)commandTiming.inputAcceptedMs=performance.now();assert.equal(input.ok,true);await save('command-input-receipt.json',input);
  commandTiming.waitStartedMs=performance.now();commandTiming.nominalDeadlineMs=commandTiming.waitStartedMs+15000;
  try{await waitFile(fixture.completedPath,fixture.expected);commandTiming.completionObserved=true;commandTiming.completionObservedMs=performance.now();}finally{commandTiming.waitEndedMs=performance.now();}
  const proof={started:await readFile(fixture.startedPath,'utf8'),stage:await readFile(fixture.stagePath,'utf8'),completed:await readFile(fixture.completedPath,'utf8')};requireCmdletCompletion(fixture,proof);
  await milestone('command-completed',{...proof,completion:proof.completed,commandInputSequence:0,runningCommandLock:false});
  observationPhase='backend-history';
  const historyStarted=performance.now(),polls=[];let output='',chunks=0,markers;
  for(let i=0;i<100;i++){
   try{markers=requireHistoryMarkers(fixture,output);break;}catch{}
   let transfer;const delivered=await members.manager.deliverAvailable(first.grant,request(first.grant,first.lease),value=>{transfer=value;});assert.equal(delivered.ok,true);
   polls.push({iteration:i,elapsedMs:performance.now()-historyStarted,sequence:transfer?.chunk?.sequence??null,utf8Bytes:transfer?.chunk?.utf8Bytes??0});
   if(transfer?.chunk){chunks++;output+=transfer.chunk.data;const commit=members.manager.commitOutputHandoff(delivered.value.handoffTicket);assert.equal(commit.ok,true);const ack=await first.router.route({event:first.caller,method:'terminalAck',payload:request(first.grant,{...first.lease,throughSequence:transfer.chunk.sequence+transfer.chunk.utf8Bytes})});assert.equal(ack.ok,true);}
   else await delay(50);
  }
  await save('history-observation.json',{elapsedMs:performance.now()-historyStarted,chunks,output,polls});
  markers=requireHistoryMarkers(fixture,output);assert.ok(chunks>0);await writeFile(join(out,'replayed-history.txt'),output,{flag:'wx'});
  const owner=members.ownership.snapshot().sessions.find(row=>row.sessionId===sessionId);assert.ok(owner);
  const backendHistory=await bounded(members.backend.readHistory({ownerId:owner.sessionOwnerId,fromSequence:0,maxBytes:32768}),2000,'BACKEND_HISTORY');await save('backend-history.json',backendHistory);
  requireHistoryMarkers(fixture,backendHistory.chunk?.data??'');
  await milestone('backend-history',{markers,chunks,bytes:Buffer.byteLength(output),backendMarkersObserved:true,grant:first.grant,lease:first.lease});
  observationPhase='explicit-session-stop';const stopped=await members.access.currentRouter().route({event:event(workspace),method:'terminalStop',payload:request(workspaceGrant,{sessionId})});assert.equal(stopped.ok,true);assert.equal(nativeState.sessionStops.length,1);
  const sessionReceipt=await bounded(nativeState.sessionStops[0],10000,'SESSION_NATIVE_RECEIPT');assertSessionClosed(beforeSession,sessionReceipt,77);
  await milestone('session-stop-native-receipt',{stopped,receipt:sessionReceipt});
  observationPhase='graph-shutdown';const shutdownId='cmdlet_'+run,joined=await bounded(graph.shutdown({code:77,deadlineMs:5000,shutdownId}),15000,'GRAPH_JOIN');
  const cleanup=await collectCleanup(joined,77,shutdownId);await save('cleanup-observation.json',cleanup);assert.equal(cleanup.verified,true,'ACTUAL_CLEANUP_UNKNOWN');
  await save('utility-output.json',{...cleanup.utilityOutput,exit:cleanup.utilityExit});
  await milestone('shutdown-separate-native-and-external-joins',{graph:joined,hostReceipt:cleanup.hostReceipt,hostExpected:cleanup.hostExpected,checked:cleanup.checked,external:cleanup.external,externalExit:cleanup.externalExit,utilityExit:cleanup.utilityExit});
  assert.equal(result.unavailable.length,0,'OWNERSHIP_UNAVAILABLE_CALLBACK_UNRESOLVED');completedObservations=true;
 }catch(error){
  observationPhase='failure-observation';result.status='FAILED';result.error={message:error.message,code:error.code??null,stack:error.stack};
  await captureFailureEvidence();observationPhase='failure-cleanup';let failureGraph;
  const shutdownId='failure_'+run;
  if(graph)try{failureGraph=await bounded(graph.shutdown({code:98,deadlineMs:5000,shutdownId}),15000,'FAILURE_SHUTDOWN');result.failureShutdown=failureGraph;}catch(e){result.failureShutdownError=e.message;}
  result.failureCleanup=await collectCleanup(failureGraph,98,shutdownId);result.cleanupVerified=result.failureCleanup.verified===true;
  await save('failure-cleanup-observation.json',result.failureCleanup);
 }finally{
  if(commandTiming.completionObserved){commandTiming.completionLate=commandTiming.completionObservedMs>commandTiming.nominalDeadlineMs;commandTiming.completedWithinNominalDeadline=!commandTiming.completionLate;}
  try{await save('command-timing.json',commandTiming);}catch(e){result.commandTimingError={message:e.message,code:e.code??null};result.status='FAILED';completedObservations=false;}
  try{
   if(observer){await save('observer-output.json',{stdout:observerStdout,stderr:observerStderr});assert.deepEqual(await pin(observerExecutable),observerPin);}
   for(const window of windows)if(!window.isDestroyed())window.destroy();
   await save('ownership-callback-observations.json',result.ownershipEvents);
   if(completedObservations){assert.equal(result.unavailable.length,0,'LATE_OWNERSHIP_UNAVAILABLE');result.status='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE';result.commandCompleted=true;result.mandatoryMarkersObserved=true;result.externalProcessJoin=true;result.cleanupVerified=true;}
  }catch(e){result.status='FAILED';result.finalizationError={message:e.message,code:e.code??null};result.commandCompleted=false;result.mandatoryMarkersObserved=false;result.externalProcessJoin=false;}
  await save('worker-result.json',result);
 }
 return result;
}
