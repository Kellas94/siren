// Hosted-only pretarget state comparison. Local imports expose pure DATA validators only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertHostedRuntimeContext,validateRuntimePrerequisites,createRuntimeEntry} from './terminal-session-runtime.mjs';
import {createResolutionObservationFixture,resolutionObservationCases,parseResolutionObservation} from './terminal-resolution-observation.mjs';
import {captureShutdownGraphResources} from './terminal-production-resources.mjs';
import {captureTerminalSessionExecutionResources,recheckTerminalSessionExecutionResources} from './terminal-session-execution-resources.mjs';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const controls=Object.freeze(['write-output']);
export function validateSingleCmdletResult(value,{run,commit,control,mode,fixture}){
 assert.ok(controls.includes(control));
 assert.deepEqual(fixture,createResolutionObservationFixture({control,mode,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected}));
 assert.equal(value.scope,'HOSTED_SINGLE_CMDLET_DIAGNOSTIC');assert.equal(value.status,'SINGLE_CMDLET_DIAGNOSTIC_COMPLETE');
 assert.equal(value.run,run);assert.equal(value.commit,commit);assert.equal(value.control,control);assert.equal(value.fixtureVariant,fixture.variant);
 for(const field of ['nativeExecutionAdmitted','productActivation','fullMatrixQualified','rendererInputQualified','packagedQualified'])assert.equal(value[field],false);
 for(const field of ['commandCompleted','mandatoryMarkersObserved','externalProcessJoin','cleanupVerified'])assert.equal(value[field],true);
 assert.equal(value.realSessions,1);assert.deepEqual(value.unavailable,[]);
 for(const field of ['error','failureShutdownError','failureDiagnosticError'])assert.equal(Object.hasOwn(value,field),false);
 assert.deepEqual(value.milestones.map(r=>r.name),['actual-native-host','actual-session-create','actual-terminal-attach','before-command','command-completed','backend-history','session-stop-native-receipt','shutdown-separate-native-and-external-joins']);
 const [,created,,before,completed,history,stopped,joined]=value.milestones;
 assert.equal(created.created?.ok,true);assert.equal(before.commandInputSequence,0);assert.equal(completed.stage,'after-'+control);assert.equal(completed.completion,fixture.expected);
 assert.deepEqual(history.markers,control==='start-sleep'?[fixture.expectedConsole]:[fixture.expectedPipeline,fixture.expectedConsole]);assert.ok(Number.isSafeInteger(history.chunks)&&history.chunks>0);
 assert.equal(stopped.receipt?.closed,true);assert.equal(stopped.receipt?.snapshot?.active,0);
 assert.equal(joined.graph?.actualSettled,true);assert.equal(joined.graph?.unknown,false);assert.equal(joined.checked?.ok,true);
 assert.equal(joined.external?.status,'EXACT_HELD_PROCESSES_EXITED');assert.equal(joined.externalExit?.code,0);assert.equal(joined.utilityExit,77);
}
export function validateDiagnosticLaunch(value){
 assert.equal(value.spawnError,null);assert.equal(value.closeObserved,true);assert.equal(value.watchdog,false);assert.equal(value.overflow,false);assert.equal(value.exit,0);assert.equal(value.signal,null);
}
// Independent DATA consistency check. This does not authenticate native provenance.
export function validateDiagnosticCleanup(value){
 const {code,graph,beforeSession,sessionReceipts,hostExpected,hostReceipt,checked,expected,external,externalExit,utilityExit}=value;
 assert.equal(value.verified,true);assert.ok(code===77||code===98);assert.equal(value.errors?.length??0,0);assert.equal(Object.hasOwn(value,'verificationError'),false);
 assert.equal(graph.actualSettled,true);assert.equal(graph.unknown,false);assert.equal(graph.hostNativeJoined,false);assert.equal(graph.sessionCleanupJoined,false);
 assert.equal(checked.ok,true);assert.equal(checked.actualSettlementEstablished,false);assert.equal(hostExpected.request.code,code);
 assert.equal(validateHostAsyncReceipt(hostExpected,hostReceipt).ok,true);
 const identity=p=>{assert.ok(p&&Number.isInteger(p.pid)&&p.pid>0&&p.pid<=0xffffffff);assert.ok(typeof p.image==='string'&&p.image.isWellFormed()&&/^[A-Za-z]:\\/.test(p.image)&&!/[\x00-\x1f\x7f]/.test(p.image));assert.ok(typeof p.createdFileTime==='string'&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&BigInt(p.createdFileTime)<=0xffffffffffffffffn);return JSON.stringify([p.pid,p.image,p.createdFileTime]);};
 const rows=(wanted,actual)=>{assert.ok(Array.isArray(wanted)&&Array.isArray(actual)&&wanted.length>0);assert.equal(actual.length,wanted.length);const a=new Set(wanted.map(identity)),b=new Set(actual.map(identity));assert.equal(a.size,wanted.length);assert.equal(b.size,actual.length);assert.equal(new Set(wanted.map(p=>p.pid)).size,wanted.length);assert.equal(new Set(actual.map(p=>p.pid)).size,actual.length);for(const key of b)assert.ok(a.has(key));};
 assert.ok(Array.isArray(expected));assert.equal(expected.length,4);assert.ok(beforeSession.active>0);assert.equal(beforeSession.hostPid,hostExpected.root.pid);
 const union=new Map();for(const p of [hostExpected.root,...hostExpected.held,beforeSession.root,beforeSession.shell,...beforeSession.held]){const key=identity(p);if(union.has(p.pid))assert.equal(identity(union.get(p.pid)),key);union.set(p.pid,p);}
 rows(expected,[...union.values()]);
 for(const p of [beforeSession.root,beforeSession.shell,...beforeSession.held]){assert.equal(p.alive,true);assert.equal(p.exitCode,259);}
 assert.ok(Array.isArray(sessionReceipts));assert.equal(sessionReceipts.length,1);const session=sessionReceipts[0];assert.equal(session.closed,true);assert.equal(session.snapshot.active,0);
 const s=session.snapshot;assert.equal(identity(s.root),identity(beforeSession.root));assert.equal(identity(s.shell),identity(beforeSession.shell));rows(beforeSession.held,s.held);
 assert.equal(s.hostPid,beforeSession.hostPid);assert.equal(s.atomicBeforeResume,true);assert.equal(s.killOnClose,true);assert.equal(s.breakaway,false);assert.equal(s.inheritable,false);assert.equal(s.stopping,true);
 for(const p of [s.root,s.shell,...s.held]){assert.equal(p.alive,false);assert.equal(p.exitCode,code);}
 assert.equal(external.status,'EXACT_HELD_PROCESSES_EXITED');rows(expected,external.before);rows(expected,external.after);
 for(const p of external.before){assert.equal(p.wait,258);assert.equal(p.exitCode,259);}for(const p of external.after){assert.equal(p.wait,0);assert.equal(p.exitCode,code);}
 assert.equal(externalExit.code,0);assert.equal(externalExit.signal,null);assert.equal(utilityExit,code);
}

// Parent-only DATA readback: no command timer resets, worker edits or prewarming.
export async function captureResolutionState({armOut,readBytes=readFile,pinFile,now=()=>performance.now()}){
 const observation={status:'MISSING',parentClock:{domain:'parent-process-performance-now',startedMs:null,endedMs:null}};let bytes=null;
 try{observation.parentClock.startedMs=now();}catch{}
 try{
  assert.ok(typeof armOut==='string'&&isAbsolute(armOut)&&armOut.isWellFormed()&&!/[\x00-\x1f\x7f]/.test(armOut),'TRUSTED_ARM_PATH_REQUIRED');
  const path=join(armOut,'project țară 日本語','resolution-state.tsv'),raw=await readBytes(path),pin=await pinFile(path);observation.pin=pin;observation.status='INVALID';
  assert.ok(Buffer.isBuffer(raw));assert.equal(pin.path,path);assert.equal(pin.bytes,raw.length);assert.equal(pin.sha256,sha(raw));assert.ok(raw.length<=32768,'OBSERVATION_BYTE_CAP');bytes=raw;
 }catch(error){observation.status=error.code==='ENOENT'?'MISSING':'INVALID';observation.error={message:error.message,code:error.code??null};}
 try{observation.parentClock.endedMs=now();for(const field of ['startedMs','endedMs'])assert.ok(Number.isFinite(observation.parentClock[field])&&observation.parentClock[field]>=0);assert.ok(observation.parentClock.endedMs>=observation.parentClock.startedMs);}
 catch(error){observation.status='INVALID';observation.clockError={message:error.message,code:error.code??null};}
 return {observation,bytes};
}
export function validateResolutionTiming(t,{run,commit,control,status,workerPid,heldShellPid,fixtureVariant,token}){
 assert.equal(t.scope,'DIAGNOSTIC_MONOTONIC_INPUT_WAIT_V1');assert.equal(t.clockDomain,'worker-process-performance-now');assert.equal(t.run,run);assert.equal(t.commit,commit);assert.equal(t.control,control);assert.equal(t.commandInputSequence,0);
 assert.ok(Number.isInteger(workerPid)&&workerPid>0&&workerPid<=0xffffffff);assert.equal(t.workerPid,workerPid);assert.equal(t.heldShellPid,heldShellPid);assert.equal(t.fixtureVariant,fixtureVariant);assert.equal(t.token,token);
 assert.equal(t.nominalWaitMs,15000);assert.equal(t.pollCount,300);assert.equal(t.pollDelayMs,50);assert.equal(typeof t.completionObserved,'boolean');
 const fields=['inputSubmittedMs','inputReturnedMs','inputAcceptedMs','waitStartedMs','waitEndedMs'];let missing=false,last=-1;
 for(const field of fields){const value=t[field];if(value===null){missing=true;continue;}assert.ok(!missing&&Number.isFinite(value)&&value>=0&&value>=last,field);last=value;}
 if(t.waitStartedMs===null){assert.equal(t.nominalDeadlineMs,null);assert.equal(t.waitEndedMs,null);}else{assert.ok(Number.isFinite(t.nominalDeadlineMs));assert.equal(t.nominalDeadlineMs,t.waitStartedMs+15000);assert.ok(Number.isFinite(t.waitEndedMs));}
 if(t.completionObserved){assert.ok(Number.isFinite(t.completionObservedMs)&&t.waitStartedMs!==null&&t.completionObservedMs>=t.waitStartedMs&&t.completionObservedMs<=t.waitEndedMs);assert.equal(t.completionLate,t.completionObservedMs>t.nominalDeadlineMs);assert.equal(t.completedWithinNominalDeadline,!t.completionLate);if(t.completionLate)throw Object.assign(Error('COMPLETION_AFTER_NOMINAL_DEADLINE'),{code:'COMPLETION_AFTER_NOMINAL_DEADLINE'});}else{assert.equal(t.completionObservedMs,null);assert.equal(t.completionLate,null);assert.equal(t.completedWithinNominalDeadline,null);}
 if(status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'){assert.ok(fields.every(field=>t[field]!==null));assert.equal(t.completionObserved,true);}else assert.equal(status,'FAILED');
}
export async function observeResolutionArm({worker,fixture,armOut,launchPid,mode,context,readBytes=readFile,pinFile,captured}){
 const capture=captured??await captureResolutionState({armOut,readBytes,pinFile});
 const result={status:'FAILED',workerStatus:worker?.status??null,observation:{...capture.observation},cleanupConsistent:false,timing:{status:'MISSING'}};
 if(worker?.status==='FAILED')result.commandError=worker.error??{message:'WORKER_FAILED_WITHOUT_ERROR'};
 let bindingError=null,beforeSession;
 try{
  assert.ok(typeof armOut==='string'&&isAbsolute(armOut));assert.equal(fixture.control,'write-output');
  assert.deepEqual(fixture,createResolutionObservationFixture({control:'write-output',mode,projectDirectory:join(armOut,'project țară 日本語'),token:fixture.expected}));
  assert.equal(worker.scope,'HOSTED_SINGLE_CMDLET_DIAGNOSTIC');assert.equal(worker.run,context.run);assert.equal(worker.commit,context.commit);assert.equal(worker.control,'write-output');assert.equal(worker.fixtureVariant,fixture.variant);
  const before=worker.milestones.filter(m=>m.name==='before-command');assert.equal(before.length,1);assert.equal(before[0].commandInputSequence,0);beforeSession=before[0].beforeSession;
  assert.ok(Number.isInteger(beforeSession?.shell?.pid)&&beforeSession.shell.pid>0);
 }catch(error){bindingError={message:error.message,code:error.code??null};result.bindingError=bindingError;}
 // Retain and pin raw sidecar even when parsing or worker/cleanup checks fail.
 try{
  assert.equal(capture.observation.error,undefined);assert.equal(capture.observation.clockError,undefined);const bytes=capture.bytes;assert.ok(Buffer.isBuffer(bytes)&&bytes.length<=32768);
  const pin=capture.observation.pin;assert.equal(pin.path,join(armOut,'project țară 日本語','resolution-state.tsv'));assert.equal(pin.bytes,bytes.length);assert.equal(pin.sha256,sha(bytes));
  assert.equal(bindingError,null,'WORKER_NATIVE_BINDING_INVALID');
  const parsed=parseResolutionObservation(bytes,{token:fixture.expected,pid:beforeSession.shell.pid});
  result.observation={...result.observation,status:'VALID',...parsed};
 }catch(error){result.observation={...result.observation,status:capture.observation.status==='MISSING'?'MISSING':'INVALID',bindingOrParseError:{message:error.message,code:error.code??null}};}
 try{
  assert.equal(bindingError,null,'WORKER_NATIVE_BINDING_INVALID');const timingPath=join(armOut,'command-timing.json'),timing=JSON.parse((await readBytes(timingPath)).toString('utf8'));result.timing={status:'INVALID',path:timingPath,value:timing};
  assert.deepEqual(timing,worker.commandTiming);assert.equal(worker.commandTimingError,undefined);validateResolutionTiming(timing,{...context,control:'write-output',status:worker.status,workerPid:launchPid,heldShellPid:beforeSession.shell.pid,fixtureVariant:fixture.variant,token:fixture.expected});result.timing.status='VALID';
 }catch(error){result.timing={...result.timing,status:error.code==='COMPLETION_AFTER_NOMINAL_DEADLINE'?'LATE':result.timing.status,error:{message:error.message,code:error.code??null}};}
 try{
  assert.equal(bindingError,null,'WORKER_NATIVE_BINDING_INVALID');assert.equal(worker.cleanupVerified,true);
  const failed=worker.status==='FAILED';assert.ok(failed||worker.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE');
  const cleanupPath=join(armOut,failed?'failure-cleanup-observation.json':'cleanup-observation.json');
  const cleanup=JSON.parse((await readBytes(cleanupPath)).toString('utf8'));result.cleanupPath=cleanupPath;
  assert.deepEqual(cleanup.beforeSession,beforeSession,'BEFORE_SESSION_IDENTITY_DISAGREEMENT');assert.equal(cleanup.code,failed?98:77);
  if(failed)assert.deepEqual(cleanup,worker.failureCleanup);
  else{
   validateSingleCmdletResult(worker,{...context,control:'write-output',mode,fixture});
   const joined=worker.milestones.at(-1);for(const field of ['graph','hostReceipt','hostExpected','checked','external','externalExit','utilityExit'])assert.deepEqual(joined[field],cleanup[field],field);
   assert.deepEqual(worker.milestones.at(-2).receipt,cleanup.sessionReceipts[0]);
  }
  validateDiagnosticCleanup(cleanup);result.cleanupConsistent=true;
 }catch(error){result.cleanupError={message:error.message,code:error.code??null};}
 if(worker?.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'&&result.observation.status==='VALID'&&result.timing.status==='VALID'&&result.cleanupConsistent)result.status='RESOLUTION_STATE_ARM_OBSERVED';
 return result;
}
export function validateResolutionAggregate(rows){
 assert.deepEqual(rows.map(row=>row.armId),resolutionObservationCases.map(row=>row.armId));
 assert.ok(rows.every(row=>row.status==='RESOLUTION_STATE_ARM_OBSERVED'),'RESOLUTION_STATE_COMPARISON_ADVERSE');
}

export function createResolutionRuntimeEntry(workerPath,options){assert.ok(controls.includes(options.control));return createRuntimeEntry(workerPath,options);}
function inside(parent,target){const rel=relative(resolve(parent),resolve(target));assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'owned path required');return target;}
async function launchFixedControl(executable,entryPath,{out,env}){
 return new Promise(done=>{
  const child=spawn(executable,[entryPath],{cwd:out,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const chunks={stdout:[],stderr:[]};let bytes=0,watchdog=false,overflow=false,spawnError=null,finished=false,fallback;
  const finish=(code,signal,closeObserved)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);if(!closeObserved){child.stdout?.destroy();child.stderr?.destroy();}done({pid:child.pid??null,exit:code,signal,closeObserved,watchdog,overflow,spawnError,stdout:Buffer.concat(chunks.stdout).toString('utf8'),stderr:Buffer.concat(chunks.stderr).toString('utf8')});};
  const timer=setTimeout(()=>{watchdog=true;child.kill();fallback=setTimeout(()=>finish(null,null,false),5000);},120000);
  for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{bytes+=chunk.length;if(bytes<=16*1024*1024)chunks[stream].push(chunk);else if(!overflow){overflow=true;child.kill();}});
  child.on('error',error=>{spawnError={code:error.code??null,message:error.message};});child.on('close',(code,signal)=>finish(code,signal,true));
 });
}
async function main(){
 const context={actions:process.env.GITHUB_ACTIONS,repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,platform:process.platform,arch:process.arch,node:process.versions.node,argc:process.argv.length,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA};assertHostedRuntimeContext(context);
 const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),suffix=context.run+'-'+context.attempt,out=join(root,'desktop/evidence/terminal-resolution-runtime',suffix);
 await mkdir(dirname(out),{recursive:true});await mkdir(out);
 const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const pin=async path=>{const b=await readFile(path);return {path,bytes:b.length,sha256:sha(b)};};
 const receipt={scope:'HOSTED_PRETARGET_RESOLUTION_STATE_COMPARISON',status:'STARTED_NOT_QUALIFIED',run:context.run,attempt:context.attempt,commit:context.commit,inputs:[],arms:[],nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,originalLockScenarioQualified:false};
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('NODE_')&&!key.toUpperCase().startsWith('ELECTRON_')));
 try{
  const manifestPath=join(root,'desktop/tests/native/terminal-resolution-runtime-inputs.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  assert.equal(manifest.scope,'RESOLUTION_OBSERVATION_SOURCE_PINS');assert.equal(manifest.nativeExecutionAdmitted,false);assert.ok(Array.isArray(manifest.inputs)&&manifest.inputs.length>0);
  const seen=new Set();for(const row of manifest.inputs){assert.equal(typeof row.path,'string');assert.ok(!seen.has(row.path));seen.add(row.path);const actual=await pin(inside(root,resolve(root,row.path)));assert.equal(actual.bytes,row.bytes,row.path);assert.equal(actual.sha256,row.sha256,row.path);receipt.inputs.push(actual);}receipt.manifest=await pin(manifestPath);await save('source-inputs-before.json',receipt.inputs);
  for(const required of ['desktop/tests/native/terminal-resolution-runtime.mjs','desktop/tests/native/terminal-resolution-observation.mjs','desktop/tests/native/terminal-resolution-observation.test.mjs','desktop/tests/native/terminal-resolution-original-worker.mjs','desktop/tests/native/terminal-resolution-qualified-worker.mjs','desktop/tests/terminal-resolution-runtime.test.mjs','.github/workflows/terminal-resolution-runtime.yml','terminal-resolution-controller-20261011/prepare-source.py','terminal-resolution-controller-20261011/source-derivation.json','terminal-resolution-controller-20261011/derivation-inputs/origin.json','desktop/tests/native/terminal-discovery-runtime-inputs.json','desktop/tests/native/terminal-discovery-runtime.mjs','desktop/tests/native/terminal-discovery-worker.mjs','desktop/tests/native/terminal-discovery-fixture.mjs','desktop/tests/native/terminal-discovery-fixture.test.mjs','desktop/tests/terminal-discovery-runtime.test.mjs','desktop/tests/native/terminal-cmdlet-runtime.mjs','desktop/tests/native/terminal-cmdlet-runtime-worker.mjs','desktop/tests/native/terminal-cmdlet-fixture.mjs','desktop/tests/native/terminal-session-command.mjs','desktop/tests/native/terminal-session-runtime.mjs','desktop/tests/native/terminal-session-runtime-inputs.json','desktop/tests/native/terminal-production-resources.mjs','desktop/tests/native/terminal-session-execution-resources.mjs','desktop/src/terminal/host-async-receipt-contract.mjs','desktop/tests/fixtures/terminal-session-process-observer.cs','.github/workflows/terminal-discovery-runtime.yml'])assert.ok(seen.has(required),'missing fixed source pin: '+required);
  const originalInputs=JSON.parse(await readFile(join(root,'desktop/tests/native/terminal-discovery-runtime-inputs.json'),'utf8'));assert.equal(originalInputs.scope,'CMDLET_COMPARISON_SOURCE_PINS');assert.equal(originalInputs.nativeExecutionAdmitted,false);
  for(const original of originalInputs.inputs){const actual=manifest.inputs.find(row=>row.path===original.path);assert.deepEqual(actual,original,'original runtime dependency not pinned: '+original.path);}
  const provisionOut=join(root,'desktop/evidence/terminal-session-provision',suffix),filesystemOut=join(root,'desktop/evidence/terminal-session-filesystem',suffix);
  const provisionPath=join(provisionOut,'result.json'),filesystemPath=join(filesystemOut,'result.json');
  const provision=JSON.parse(await readFile(provisionPath,'utf8')),filesystem=JSON.parse(await readFile(filesystemPath,'utf8'));validateRuntimePrerequisites(provision,filesystem,context);receipt.prerequisites=[await pin(provisionPath),await pin(filesystemPath)];
  const execution=inside(provision.work,join(provision.work,'execution')),electronExecutable=inside(provision.work,provision.electronExecutable.path),filesystemExecutable=inside(filesystemOut,filesystem.binary.path);
  assert.equal(electronExecutable,join(provision.work,'electron-deps/node_modules/electron/dist/electron.exe'));assert.equal(filesystemExecutable,join(filesystemOut,'filesystem-evidence.exe'));
  assert.deepEqual(await pin(electronExecutable),provision.electronExecutable);assert.deepEqual(await pin(filesystemExecutable),filesystem.binary);receipt.electronExecutable=provision.electronExecutable;receipt.filesystemExecutable=filesystem.binary;
  const source=await captureShutdownGraphResources({sourceRoot:root}),inventory=await captureTerminalSessionExecutionResources({sourceCapture:source,applicationDirectory:execution});
  assert.deepEqual(inventory,JSON.parse(await readFile(join(provisionOut,'execution-inventory.json'),'utf8')));await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-before.json',inventory);
  const observerSource=join(root,'desktop/tests/fixtures/terminal-session-process-observer.cs'),compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',observerExecutable=join(out,'process-observer.exe');receipt.compiler=await pin(compiler);receipt.observerSource=await pin(observerSource);
  try{const compiled=await promisify(execFile)(compiler,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+observerExecutable,observerSource],{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:262144});await save('observer-compile.json',{exit:0,stdout:compiled.stdout,stderr:compiled.stderr});}
  catch(error){await save('observer-compile.json',{exit:error.code,stdout:error.stdout??'',stderr:error.stderr??'',killed:error.killed??false,signal:error.signal??null});throw error;}
  receipt.observerExecutable=await pin(observerExecutable);
  for(const {armId,control,mode} of resolutionObservationCases){
   const armOut=join(out,armId);await mkdir(armOut);
   const options={root,out:armOut,execution,electronExecutable,filesystemExecutable,observerExecutable,run:context.run,commit:context.commit,control};
   const workerPath=join(root,'desktop/tests/native',mode==='original'?'terminal-resolution-original-worker.mjs':'terminal-resolution-qualified-worker.mjs');
   const entryPath=join(armOut,'runtime-entry.mjs');await writeFile(entryPath,createResolutionRuntimeEntry(workerPath,options),{flag:'wx'});
   const arm={armId,mode,control,status:'STARTED',entry:await pin(entryPath)};receipt.arms.push(arm);
   await writeFile(join(armOut,'launch-before.json'),JSON.stringify({executable:electronExecutable,args:[entryPath],cwd:armOut,environmentPolicy:'NODE_* and ELECTRON_* stripped; no environment values retained',watchdogMs:120000},null,2)+'\n',{flag:'wx'});
   const launch=await launchFixedControl(electronExecutable,entryPath,{out:armOut,env});await writeFile(join(armOut,'launch-after.json'),JSON.stringify(launch,null,2)+'\n',{flag:'wx'});
   const saveArm=(name,value)=>writeFile(join(armOut,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
   const captured=await captureResolutionState({armOut,readBytes:readFile,pinFile:pin});if(captured.observation.pin)arm.state=captured.observation.pin;
   let observation;
   try{
    validateDiagnosticLaunch(launch);
    const worker=JSON.parse(await readFile(join(armOut,'worker-result.json'),'utf8'));
    const fixture=JSON.parse(await readFile(join(armOut,'fixed-command-fixture.json'),'utf8'));
    assert.deepEqual(fixture,createResolutionObservationFixture({control,mode,projectDirectory:join(armOut,'project țară 日本語'),token:fixture.expected}));
    assert.equal(fixture.scriptPath,join(armOut,'project țară 日本語','single-cmdlet.ps1'));assert.equal(await readFile(fixture.scriptPath,'utf8'),'\uFEFF'+fixture.script);
    observation=await observeResolutionArm({worker,fixture,armOut,launchPid:launch.pid,mode,context,readBytes:readFile,pinFile:pin,captured});
    arm.workerResult=await pin(join(armOut,'worker-result.json'));arm.fixture=await pin(join(armOut,'fixed-command-fixture.json'));arm.script=await pin(fixture.scriptPath);
    if(observation.observation.pin)arm.state=observation.observation.pin;
    if(worker.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'){
     try{assert.equal(await readFile(fixture.completedPath,'utf8'),fixture.expected);assert.equal(await readFile(fixture.stagePath,'utf8'),'after-write-output');arm.completed=await pin(fixture.completedPath);arm.stage=await pin(fixture.stagePath);}
     catch(error){observation.status='FAILED';observation.diskCompletionError={message:error.message,code:error.code??null};}
    }
   }catch(error){observation={status:'FAILED',cleanupConsistent:false,observation:{...captured.observation},parentError:{message:error.message,code:error.code??null}};}
   await saveArm('resolution-observation-readback.json',observation);arm.observationReadback=await pin(join(armOut,'resolution-observation-readback.json'));arm.status=observation.status;
   if(!observation.cleanupConsistent){arm.nextArmRefused='PREVIOUS_NATIVE_CLEANUP_UNVERIFIED';break;}
  }
  await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-after.json',inventory);
  for(const row of [...receipt.inputs,...receipt.prerequisites,receipt.manifest,receipt.electronExecutable,receipt.filesystemExecutable,receipt.observerExecutable,receipt.observerSource,receipt.compiler,...receipt.arms.flatMap(a=>[a.entry,a.workerResult,a.fixture,a.script,a.state,a.completed,a.stage,a.observationReadback].filter(Boolean))])assert.deepEqual(await pin(row.path),row);
  validateResolutionAggregate(receipt.arms);
  receipt.status='TWO_RESOLUTION_STATE_ARMS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION';
 }catch(error){receipt.status='FAILED';receipt.error={message:error.message,code:error.code??null,stack:error.stack};process.exitCode=1;console.error(error);}
 finally{await save('result.json',receipt);console.log(JSON.stringify({status:receipt.status,nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,originalLockScenarioQualified:false}));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
