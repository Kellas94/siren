// Hosted-only cold cmdlet diagnosis. Local imports expose pure validators only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertHostedRuntimeContext,validateRuntimePrerequisites,createRuntimeEntry} from './terminal-session-runtime.mjs';
import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';
import {captureShutdownGraphResources} from './terminal-production-resources.mjs';
import {captureTerminalSessionExecutionResources,recheckTerminalSessionExecutionResources} from './terminal-session-execution-resources.mjs';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const controls=Object.freeze(['start-sleep','write-output']);
export function validateSingleCmdletResult(value,{run,commit,control,fixture}){
 assert.ok(controls.includes(control));
 assert.deepEqual(fixture,createSingleCmdletFixture({control,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected}));
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
export function createCmdletRuntimeEntry(workerPath,options){assert.ok(controls.includes(options.control));return createRuntimeEntry(workerPath,options);}
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
 const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),suffix=context.run+'-'+context.attempt,out=join(root,'desktop/evidence/terminal-cmdlet-runtime',suffix);
 await mkdir(dirname(out),{recursive:true});await mkdir(out);
 const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 const pin=async path=>{const b=await readFile(path);return {path,bytes:b.length,sha256:sha(b)};};
 const receipt={scope:'HOSTED_COLD_SINGLE_CMDLET_DIAGNOSIS',status:'STARTED_NOT_QUALIFIED',run:context.run,attempt:context.attempt,commit:context.commit,inputs:[],arms:[],nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,originalLockScenarioQualified:false};
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('NODE_')&&!key.toUpperCase().startsWith('ELECTRON_')));
 try{
  const manifestPath=join(root,'desktop/tests/native/terminal-cmdlet-runtime-inputs.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  assert.equal(manifest.scope,'CMDLET_DIAGNOSTIC_SOURCE_PINS');assert.equal(manifest.nativeExecutionAdmitted,false);assert.ok(Array.isArray(manifest.inputs)&&manifest.inputs.length>0);
  const seen=new Set();for(const row of manifest.inputs){assert.equal(typeof row.path,'string');assert.ok(!seen.has(row.path));seen.add(row.path);const actual=await pin(inside(root,resolve(root,row.path)));assert.equal(actual.bytes,row.bytes,row.path);assert.equal(actual.sha256,row.sha256,row.path);receipt.inputs.push(actual);}receipt.manifest=await pin(manifestPath);await save('source-inputs-before.json',receipt.inputs);
  for(const required of ['desktop/tests/native/terminal-cmdlet-runtime.mjs','desktop/tests/native/terminal-cmdlet-runtime-worker.mjs','desktop/tests/native/terminal-cmdlet-fixture.mjs','desktop/tests/native/terminal-session-command.mjs','desktop/tests/native/terminal-session-runtime.mjs','desktop/tests/native/terminal-session-runtime-inputs.json','desktop/tests/native/terminal-production-resources.mjs','desktop/tests/native/terminal-session-execution-resources.mjs','desktop/src/terminal/host-async-receipt-contract.mjs','desktop/tests/fixtures/terminal-session-process-observer.cs','.github/workflows/terminal-cmdlet-runtime.yml'])assert.ok(seen.has(required),'missing fixed source pin: '+required);
  const originalInputs=JSON.parse(await readFile(join(root,'desktop/tests/native/terminal-session-runtime-inputs.json'),'utf8'));assert.equal(originalInputs.scope,'SESSION_RUNTIME_SOURCE_PINS');assert.equal(originalInputs.nativeExecutionAdmitted,false);
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
  for(const control of controls){
   const armOut=join(out,control);await mkdir(armOut);
   const options={root,out:armOut,execution,electronExecutable,filesystemExecutable,observerExecutable,run:context.run,commit:context.commit,control};
   const entryPath=join(armOut,'runtime-entry.mjs');await writeFile(entryPath,createCmdletRuntimeEntry(join(root,'desktop/tests/native/terminal-cmdlet-runtime-worker.mjs'),options),{flag:'wx'});
   const arm={control,status:'STARTED',entry:await pin(entryPath)};receipt.arms.push(arm);
   await writeFile(join(armOut,'launch-before.json'),JSON.stringify({executable:electronExecutable,args:[entryPath],cwd:armOut,environmentPolicy:'NODE_* and ELECTRON_* stripped; no environment values retained',watchdogMs:120000},null,2)+'\n',{flag:'wx'});
   const launch=await launchFixedControl(electronExecutable,entryPath,{out:armOut,env});await writeFile(join(armOut,'launch-after.json'),JSON.stringify(launch,null,2)+'\n',{flag:'wx'});
   let worker;
   try{
    validateDiagnosticLaunch(launch);worker=JSON.parse(await readFile(join(armOut,'worker-result.json'),'utf8'));
    const fixture=JSON.parse(await readFile(join(armOut,'fixed-command-fixture.json'),'utf8'));
    assert.equal(fixture.scriptPath,join(armOut,'project țară 日本語','single-cmdlet.ps1'));assert.equal(await readFile(fixture.scriptPath,'utf8'),'\uFEFF'+fixture.script);
    validateSingleCmdletResult(worker,{...context,control,fixture});arm.status='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE';arm.workerResult=await pin(join(armOut,'worker-result.json'));arm.fixture=await pin(join(armOut,'fixed-command-fixture.json'));arm.script=await pin(fixture.scriptPath);
   }catch(error){arm.status='FAILED';arm.error={message:error.message,code:error.code??null};if(!worker)try{worker=JSON.parse(await readFile(join(armOut,'worker-result.json'),'utf8'));}catch{}
    // Revalidate actual-shaped receipt DATA; a true summary flag is insufficient.
    let cleanupConsistent=false;
    try{validateDiagnosticLaunch(launch);assert.equal(worker?.scope,'HOSTED_SINGLE_CMDLET_DIAGNOSTIC');assert.equal(worker.status,'FAILED');assert.equal(worker.run,context.run);assert.equal(worker.commit,context.commit);assert.equal(worker.control,control);assert.equal(worker.cleanupVerified,true);assert.equal(worker.failureCleanup.code,98);validateDiagnosticCleanup(worker.failureCleanup);cleanupConsistent=true;}catch{}
    if(!cleanupConsistent){arm.nextArmRefused='PREVIOUS_NATIVE_CLEANUP_UNVERIFIED';break;}
   }
  }
  await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-after.json',inventory);
  for(const row of [...receipt.inputs,...receipt.prerequisites,receipt.manifest,receipt.electronExecutable,receipt.filesystemExecutable,receipt.observerExecutable,receipt.observerSource,receipt.compiler,...receipt.arms.flatMap(a=>[a.entry,a.workerResult,a.fixture,a.script].filter(Boolean))])assert.deepEqual(await pin(row.path),row);
  assert.deepEqual(receipt.arms.map(a=>a.control),controls);assert.ok(receipt.arms.every(a=>a.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'),'CMDLET_DIAGNOSTIC_ADVERSE');
  receipt.status='TWO_COLD_CMDLET_CONTROLS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION';
 }catch(error){receipt.status='FAILED';receipt.error={message:error.message,code:error.code??null,stack:error.stack};process.exitCode=1;console.error(error);}
 finally{await save('result.json',receipt);console.log(JSON.stringify({status:receipt.status,nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,originalLockScenarioQualified:false}));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
