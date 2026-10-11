// Hosted, disposable actual Session probe. Never a product or release gate.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {captureShutdownGraphResources} from './terminal-production-resources.mjs';
import {captureTerminalSessionExecutionResources,recheckTerminalSessionExecutionResources} from './terminal-session-execution-resources.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function assertHostedRuntimeContext(value){
 assert.equal(value.actions,'true');assert.equal(value.repository,'Kellas94/siren');assert.equal(value.ref,'refs/heads/probe/terminal-session-20261010');
 assert.equal(value.platform,'win32');assert.equal(value.arch,'x64');assert.equal(value.node,'24.16.0');assert.equal(value.argc,2);
 for(const name of ['run','attempt'])assert.match(value[name]??'',/^[1-9]\d*$/);assert.match(value.commit??'',/^[a-f0-9]{40}$/);
}
export function validateRuntimePrerequisites(provision,filesystem,{run,attempt,commit}){
 for(const value of [provision,filesystem]){assert.equal(value.run,run);assert.equal(value.attempt,attempt);assert.equal(value.commit,commit);assert.equal(value.nativeExecutionAdmitted,false);assert.equal(value.productActivation,false);}
 assert.equal(provision.status,'SEPARATE_EXECUTION_TREE_COMPILED_AND_INVENTORIED_NOT_LOADED');
 assert.equal(provision.nativeArtifactsLoaded,false);assert.equal(provision.providerCodeLoaded,false);assert.equal(provision.realSession,false);
 assert.equal(filesystem.status,'BOUNDED_NATIVE_FILESYSTEM_OBSERVED_NOT_ADMITTED');assert.equal(filesystem.controls.length,8);assert.ok(filesystem.controls.every(row=>row.passed===true));
 assert.equal(provision.builds.length,2);assert.ok(provision.electronExecutable?.sha256);assert.ok(filesystem.binary?.sha256);
}
export function validateRuntimeWorkerResult(value,{run,commit}){
 assert.equal(value.status,'BOUNDED_SESSION_RUNTIME_COMPLETE');assert.equal(value.run,run);assert.equal(value.commit,commit);
 for(const field of ['nativeExecutionAdmitted','productActivation','fullMatrixQualified','rendererInputQualified','packagedQualified'])assert.equal(value[field],false);
 assert.equal(value.realSessions,1);for(const field of ['commandCompletedAfterLockAck','lockRefusedNewInput','externalProcessJoin'])assert.equal(value[field],true);
 assert.ok(!Object.hasOwn(value,'error'));assert.ok(Array.isArray(value.milestones));
 assert.deepEqual(value.milestones.map(row=>row.name),[
  'actual-native-host','actual-session-create','actual-terminal-attach','before-lock','lock-ack-input-refused',
  'command-completed-while-locked','unlock-fresh-lease-history','session-stop-native-receipt','shutdown-separate-native-and-external-joins'
 ]);
 const [,created,,before,lock,completed,unlocked,stopped,joined]=value.milestones;
 assert.equal(created.created?.ok,true);assert.equal(before.completionAbsent,true);
 assert.equal(lock.sessionStopCalls,0);assert.equal(lock.hostStopCalls,0);assert.equal(lock.refused?.ok,false);
 assert.equal(completed.locked,true);assert.equal(completed.forbiddenAbsent,true);
 assert.ok(unlocked.chunks>0);assert.equal(unlocked.oldRouterRefused?.ok,false);
 assert.equal(stopped.receipt?.closed,true);assert.equal(stopped.receipt?.snapshot?.active,0);
 assert.equal(joined.graph?.actualSettled,true);assert.equal(joined.graph?.unknown,false);assert.equal(joined.checked?.ok,true);
 assert.equal(joined.external?.status,'EXACT_HELD_PROCESSES_EXITED');assert.equal(joined.externalExit?.code,0);
}
export function createRuntimeEntry(workerPath,options){
 assert.ok(isAbsolute(workerPath));assert.equal(typeof options,'object');
 // The fixed worker is imported only after app readiness. Registration precedes it.
 return `import {app,protocol} from 'electron';\nimport {writeFile} from 'node:fs/promises';\n`+
 `protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);\n`+
 `app.on('window-all-closed',event=>event?.preventDefault?.());\n`+
 `app.whenReady().then(async()=>{const {startRuntimeProbe}=await import(${JSON.stringify(pathToFileURL(workerPath).href)});await startRuntimeProbe(${JSON.stringify(options)});app.exit(0);}).catch(async error=>{console.error(error);try{await writeFile(${JSON.stringify(join(options.out,'bootstrap-failure.json'))},JSON.stringify({status:'FAILED',message:error.message,stack:error.stack},null,2)+'\\n',{flag:'wx'});}finally{app.exit(1);}});\n`;
}
function inside(parent,target){const rel=relative(resolve(parent),resolve(target));assert.ok(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'owned path required');return target;}
async function main(){
 const context={actions:process.env.GITHUB_ACTIONS,repository:process.env.GITHUB_REPOSITORY,ref:process.env.GITHUB_REF,platform:process.platform,arch:process.arch,node:process.versions.node,argc:process.argv.length,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA};assertHostedRuntimeContext(context);
 const root=resolve(fileURLToPath(new URL('../../../',import.meta.url))),suffix=context.run+'-'+context.attempt,out=join(root,'desktop/evidence/terminal-session-runtime',suffix);
 await mkdir(dirname(out),{recursive:true});await mkdir(out);
 const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'}),pin=async path=>{const bytes=await readFile(path);return{path,bytes:bytes.length,sha256:sha(bytes)};};
 const receipt={scope:'HOSTED_BOUNDED_ACTUAL_SESSION_RUNTIME',status:'STARTED_NOT_QUALIFIED',run:context.run,attempt:context.attempt,commit:context.commit,inputs:[],nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false};
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('NODE_')&&!key.toUpperCase().startsWith('ELECTRON_')));
 let inventory;
 try{
  const manifestPath=join(root,'desktop/tests/native/terminal-session-runtime-inputs.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  assert.equal(manifest.scope,'SESSION_RUNTIME_SOURCE_PINS');assert.equal(manifest.nativeExecutionAdmitted,false);assert.ok(Array.isArray(manifest.inputs)&&manifest.inputs.length>0);
  const seen=new Set();for(const row of manifest.inputs){assert.equal(typeof row.path,'string');assert.ok(!seen.has(row.path));seen.add(row.path);const actual=await pin(inside(root,resolve(root,row.path)));assert.equal(actual.bytes,row.bytes,row.path);assert.equal(actual.sha256,row.sha256,row.path);receipt.inputs.push(actual);}receipt.manifest=await pin(manifestPath);await save('source-inputs-before.json',receipt.inputs);
  for(const required of ['desktop/tests/native/terminal-session-runtime.mjs','desktop/tests/native/terminal-session-runtime-worker.mjs','desktop/tests/fixtures/terminal-session-process-observer.cs','.github/workflows/terminal-session-runtime.yml'])assert.ok(seen.has(required),'missing fixed source pin: '+required);
  const provisionOut=join(root,'desktop/evidence/terminal-session-provision',suffix),filesystemOut=join(root,'desktop/evidence/terminal-session-filesystem',suffix);
  const provisionPath=join(provisionOut,'result.json'),filesystemPath=join(filesystemOut,'result.json');
  const provision=JSON.parse(await readFile(provisionPath,'utf8')),filesystem=JSON.parse(await readFile(filesystemPath,'utf8'));validateRuntimePrerequisites(provision,filesystem,context);receipt.prerequisites=[await pin(provisionPath),await pin(filesystemPath)];
  const execution=inside(provision.work,join(provision.work,'execution')),electronExecutable=inside(provision.work,provision.electronExecutable.path),filesystemExecutable=inside(filesystemOut,filesystem.binary.path);
  assert.equal(electronExecutable,join(provision.work,'electron-deps/node_modules/electron/dist/electron.exe'));assert.equal(filesystemExecutable,join(filesystemOut,'filesystem-evidence.exe'));
  assert.deepEqual(await pin(electronExecutable),provision.electronExecutable);assert.deepEqual(await pin(filesystemExecutable),filesystem.binary);receipt.electronExecutable=provision.electronExecutable;receipt.filesystemExecutable=filesystem.binary;
  const source=await captureShutdownGraphResources({sourceRoot:root});inventory=await captureTerminalSessionExecutionResources({sourceCapture:source,applicationDirectory:execution});
  assert.deepEqual(inventory,JSON.parse(await readFile(join(provisionOut,'execution-inventory.json'),'utf8')));await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-before.json',inventory);
  const observerSource=join(root,'desktop/tests/fixtures/terminal-session-process-observer.cs'),compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',observerExecutable=join(out,'process-observer.exe');receipt.compiler=await pin(compiler);receipt.observerSource=await pin(observerSource);
  try{const compiled=await promisify(execFile)(compiler,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+observerExecutable,observerSource],{cwd:root,env,windowsHide:true,timeout:30000,maxBuffer:262144});await save('observer-compile.json',{exit:0,stdout:compiled.stdout,stderr:compiled.stderr});}
  catch(error){await save('observer-compile.json',{exit:error.code,stdout:error.stdout??'',stderr:error.stderr??'',killed:error.killed??false,signal:error.signal??null});throw error;}
  receipt.observerExecutable=await pin(observerExecutable);
  const options={root,out,execution,electronExecutable,filesystemExecutable,observerExecutable,run:context.run,commit:context.commit},entryPath=join(out,'runtime-entry.mjs');await writeFile(entryPath,createRuntimeEntry(join(root,'desktop/tests/native/terminal-session-runtime-worker.mjs'),options),{flag:'wx'});receipt.entry=await pin(entryPath);
  await save('launch-before.json',{executable:electronExecutable,args:[entryPath],cwd:out,environmentPolicy:'NODE_* and ELECTRON_* stripped; no environment values retained',watchdogMs:120000});
  const launch=await new Promise(done=>{
   const child=spawn(electronExecutable,[entryPath],{cwd:out,env,windowsHide:true,stdio:['ignore','pipe','pipe']});const chunks={stdout:[],stderr:[]};let bytes=0,watchdog=false,overflow=false,spawnError=null,finished=false,fallback;
   const finish=(code,signal,closeObserved)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(fallback);if(!closeObserved){child.stdout.destroy();child.stderr.destroy();}done({pid:child.pid??null,exit:code,signal,closeObserved,watchdog,overflow,spawnError,stdout:Buffer.concat(chunks.stdout).toString('utf8'),stderr:Buffer.concat(chunks.stderr).toString('utf8')});};
   const timer=setTimeout(()=>{watchdog=true;child.kill();fallback=setTimeout(()=>finish(null,null,false),5000);},120000);
   for(const stream of ['stdout','stderr'])child[stream].on('data',chunk=>{bytes+=chunk.length;if(bytes<=16*1024*1024)chunks[stream].push(chunk);else if(!overflow){overflow=true;child.kill();}});
   child.on('error',error=>{spawnError={code:error.code??null,message:error.message};});
   child.on('close',(code,signal)=>finish(code,signal,true));
  });
  await save('launch-after.json',launch);assert.equal(launch.spawnError,null);assert.equal(launch.closeObserved,true);assert.equal(launch.watchdog,false);assert.equal(launch.overflow,false);assert.equal(launch.exit,0);assert.equal(launch.signal,null);
  const worker=JSON.parse(await readFile(join(out,'worker-result.json'),'utf8'));validateRuntimeWorkerResult(worker,context);receipt.workerResult=await pin(join(out,'worker-result.json'));
  await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-after.json',inventory);
  for(const row of [...receipt.inputs,...receipt.prerequisites,receipt.manifest,receipt.electronExecutable,receipt.filesystemExecutable,receipt.observerExecutable,receipt.observerSource,receipt.compiler,receipt.entry])assert.deepEqual(await pin(row.path),row);
  receipt.status='BOUNDED_SESSION_RUNTIME_OBSERVED_NOT_ADMITTED';
 }catch(error){receipt.status='FAILED';receipt.error={message:error.message,code:error.code??null,stack:error.stack};process.exitCode=1;console.error(error);}
 finally{await save('result.json',receipt);console.log(JSON.stringify({status:receipt.status,nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false}));}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
