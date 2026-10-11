// Inactive actual fixed diagnostic orchestration. Import does not build or run.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomBytes} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {recheckProvisionedFreshRuntime} from './terminal-fresh-runtime-provision.mjs';
import {captureFreshPairLaunchEnvironment} from './terminal-fresh-environment.mjs';
import {readTerminalConnectRawFile} from './terminal-connect-raw-file.mjs';
import {createOriginalResolutionFixture} from './terminal-resolution-observation.mjs';

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

const flags={nativeAdmission:false,inputAuthorized:false,productActivation:false,originalLockQualified:false,oldRuntimeEquivalent:false};
let consumed=false;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pin=async p=>{const b=await readFile(p);return {path:p,bytes:b.length,sha256:sha(b)};};
const samePin=(a,b)=>a.path===b.path&&a.bytes===b.bytes&&a.sha256===b.sha256;
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
// DRIVER_INERT_HELPERS_BEGIN
function freshIdentity(value){assert.ok(value&&Number.isInteger(value.pid)&&value.pid>0&&value.pid<=0xffffffff);assert.match(value.image,/^[A-Za-z]:\\/);assert.match(value.createdFileTime,/^[1-9][0-9]*$/);return JSON.stringify([value.pid,value.image,value.createdFileTime]);}
function identities(expected,actual){assert.ok(Array.isArray(expected)&&Array.isArray(actual));assert.equal(actual.length,expected.length);assert.equal(new Set(expected.map(freshIdentity)).size,expected.length);assert.equal(new Set(actual.map(freshIdentity)).size,actual.length);assert.deepEqual(new Set(actual.map(freshIdentity)),new Set(expected.map(freshIdentity)));}
function requireFreshCleanup(value){
 const {code,graph,beforeSession,sessionReceipts,hostReceipt,hostExpected,checked,expected,external,externalExit,utilityExit}=value;
 assert.ok(code===77||code===98);assert.equal(graph.actualSettled,true);assert.equal(graph.unknown,false);assert.equal(graph.hostNativeJoined,false);assert.equal(graph.sessionCleanupJoined,false);
 assert.equal(expected.length,4);assert.equal(new Set(expected.map(x=>x.pid)).size,4);assert.equal(sessionReceipts.length,1);
 const s=sessionReceipts[0];assert.equal(s.closed,true);assert.equal(s.snapshot.active,0);assert.equal(freshIdentity(s.snapshot.root),freshIdentity(beforeSession.root));assert.equal(freshIdentity(s.snapshot.shell),freshIdentity(beforeSession.shell));identities(beforeSession.held,s.snapshot.held);
 for(const p of [s.snapshot.root,s.snapshot.shell,...s.snapshot.held]){assert.equal(p.alive,false);assert.equal(p.exitCode,code);}
 assert.equal(checked.ok,true);assert.equal(checked.actualSettlementEstablished,false);assert.equal(hostReceipt.closed,true);assert.equal(hostReceipt.code,code);assert.equal(hostReceipt.snapshot.active,0);assert.equal(freshIdentity(hostReceipt.snapshot.root),freshIdentity(expected[0]));identities([expected[0]],hostReceipt.snapshot.held);
 for(const p of [hostReceipt.snapshot.root,...hostReceipt.snapshot.held]){assert.equal(p.alive,false);assert.equal(p.exitCode,code);}
 assert.equal(hostExpected.root.pid,expected[0].pid);assert.equal(external.status,'EXACT_HELD_PROCESSES_EXITED');identities(expected,external.before);identities(expected,external.after);
 for(const p of external.before){assert.equal(p.wait,258);assert.equal(p.exitCode,259);}for(const p of external.after){assert.equal(p.wait,0);assert.equal(p.exitCode,code);}
 assert.equal(externalExit.code,0);assert.equal(externalExit.signal,null);assert.equal(utilityExit,code);return true;
}
function requireParentRaw(record,challenge,expected){
 assert.equal(record.ok,true);assert.equal(record.rawSha256,challenge.rawSha256);const r=record.decoded.observation;
 assert.equal(r.creatorPid,challenge.creatorPid);assert.equal(r.returnedPid,challenge.shellPid);assert.notEqual(r.creatorPid,r.returnedPid);
 assert.equal(r.argumentCount,6);assert.equal(r.count,1);assert.equal(r.duplicate,false);assert.equal(r.phase,'RETURNED');assert.equal(r.returnStatus,'RETURNED');assert.equal(r.pidAssignment,'ASSIGNED');assert.equal(r.argumentsUnchanged,true);assert.deepEqual(r.captureCodes,[]);assert.deepEqual(r.before,r.after);assert.equal(r.before.useConptyDll,false);assert.deepEqual(r.before.env,expected.env);
 assert.equal(r.before.cwdSha256,sha(expected.cwd));assert.equal(r.before.commandLineSha256,sha(expected.commandLine));return true;
}
function consumeFreshChallenge(line,expected){
 const prefix='SIREN_FRESH_PREINPUT ';assert.ok(line.startsWith(prefix));const raw=line.slice(prefix.length),c=JSON.parse(raw);assert.equal(JSON.stringify(c),raw);
 assert.deepEqual(Object.keys(c),['schema','type','workerPid','creatorPid','shellPid','armId','token','nonce','rawSha256']);assert.equal(c.schema,1);assert.equal(c.type,'FRESH_PREINPUT_CHALLENGE');assert.equal(c.workerPid,expected.workerPid);assert.equal(c.armId,expected.armId);assert.equal(c.token,expected.token);
 for(const k of ['creatorPid','shellPid'])assert.ok(Number.isInteger(c[k])&&c[k]>0&&c[k]<=0xffffffff);assert.notEqual(c.creatorPid,c.shellPid);assert.notEqual(c.workerPid,c.creatorPid);assert.notEqual(c.workerPid,c.shellPid);assert.match(c.nonce,/^[a-f0-9]{32}$/);assert.match(c.rawSha256,/^[a-f0-9]{64}$/);return c;
}
function classifyFreshCommand(observed,expected){
 const timing=observed.commandTiming;assert.equal(timing.workerPid,expected.workerPid);assert.equal(timing.heldShellPid,expected.shellPid);assert.equal(timing.token,expected.token);assert.equal(timing.pollCount,300);assert.equal(timing.pollDelayMs,50);assert.equal(timing.nominalWaitMs,15000);assert.equal(timing.nominalDeadlineMs,timing.waitStartedMs+15000);
 for(const key of ['inputSubmittedMs','inputReturnedMs','inputAcceptedMs','waitStartedMs','waitEndedMs'])assert.ok(Number.isFinite(timing[key])&&timing[key]>=0);
 assert.ok(timing.inputReturnedMs>=timing.inputSubmittedMs&&timing.inputAcceptedMs>=timing.inputReturnedMs&&timing.waitStartedMs>=timing.inputAcceptedMs&&timing.waitEndedMs>=timing.waitStartedMs);
 if(observed.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'){assert.equal(observed.commandCompleted,true);assert.equal(observed.mandatoryMarkersObserved,true);assert.equal(observed.externalProcessJoin,true);assert.equal(timing.completedWithinNominalDeadline,true);assert.equal(timing.completionObserved,true);assert.ok(Number.isFinite(timing.completionObservedMs)&&timing.completionObservedMs>=timing.waitStartedMs&&timing.completionObservedMs<=timing.nominalDeadlineMs);return 'COMPLETE';}
 assert.equal(observed.status,'FAILED');assert.equal(typeof observed.error?.message,'string');assert.ok(observed.error.message.startsWith('FIXTURE_FILE_DEADLINE:'));assert.equal(timing.completionObserved,false);assert.equal(timing.completedWithinNominalDeadline,null);assert.ok(timing.waitEndedMs>=timing.nominalDeadlineMs);return 'BOUNDED_TARGET_ADVERSE';
}
// DRIVER_INERT_HELPERS_END

export async function runFreshTerminalPair(provision,...extra){
 if(consumed)return freeze({ok:false,status:'FRESH_PAIR_REFUSED',code:'ATTEMPT_CONSUMED',failureStage:'ATTEMPT_CONSUMED',...flags});consumed=true;
 const result={ok:false,status:'FRESH_PAIR_STARTED_NOT_ADMITTED',scope:'WITHIN_JOB_PATHEXT_SINGLE_VARIABLE_ORIGINAL_WRITE_OUTPUT',arms:[],failureStage:null,nativeHelperCalls:[],modelStatus:'UNAVAILABLE_EXTERNAL_ENGINE_NOT_IN_RETAINED_RUNTIME',...flags};let out,save,stage='ARGUMENTS';
 try{
  assert.equal(extra.length,0);stage='PRIVATE_RETENTION';assert.equal(await recheckProvisionedFreshRuntime(provision),true,'GENUINE_PRIVATE_RETENTION_REQUIRED');
  stage='HOSTED_CONTEXT';assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.16.0');
  const env=process.env;assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(env.GITHUB_REPOSITORY,'Kellas94/siren');assert.equal(env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');assert.equal(env.GITHUB_RUN_ID,provision.run);assert.equal(env.GITHUB_RUN_ATTEMPT,provision.attempt);assert.equal(env.GITHUB_SHA,provision.commit);
  assert.equal(provision.ok,true);assert.equal(provision.status,'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION');
  const retained=provision.retainedRuntime,retainedJobRoot=path.dirname(retained);assert.equal(path.basename(retained),'fresh-runtime');assert.equal(retainedJobRoot,path.join(provision.jobRoot,'retained'));
  stage='RESULT_DIRECTORY';out=path.join(provision.jobRoot,'fresh-evidence','fresh-pair');await mkdir(out);save=(name,value)=>writeFile(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const execution=path.join(retained,'execution'),base=path.join(retained,'diagnostics','desktop/tests/native'),worker=path.join(base,'terminal-fresh-pair-worker.mjs'),driver=path.join(base,'terminal-fresh-pair-driver.mjs'),electron=path.join(retained,'electron/dist/electron.exe'),helper=path.join(retained,'helpers/filesystem-evidence.exe'),observer=path.join(retained,'helpers/process-observer.exe');
  stage='RETAINED_INPUT_PINS';const pins=[];for(const p of [worker,driver,electron,helper,observer])pins.push(await pin(p));
  // Trusted same-instance Node controller is distinct from retained-only child
  // execution. Every diagnostic dependency must have been staged before capture.
  const controllerNames=['terminal-fresh-pair-driver.mjs','terminal-fresh-pair-worker.mjs','terminal-fresh-runtime-provision.mjs','terminal-fresh-runtime-inventory.mjs','terminal-fresh-runtime-retention.mjs','terminal-connect-derivative.mjs','terminal-creator-transport-derivative.mjs','terminal-connect-raw-file.mjs','terminal-connect-raw-json.mjs','terminal-fresh-environment.mjs','terminal-fresh-pair-model.mjs','terminal-resolution-observation.mjs','terminal-discovery-fixture.mjs','terminal-cmdlet-fixture.mjs','terminal-session-command.mjs'];
  stage='CONTROLLER_PINS';const controllerPins=[];for(const name of controllerNames){const source=await pin(path.join(provision.root,'desktop/tests/native',name)),copy=await pin(path.join(base,name));assert.equal(source.bytes,copy.bytes);assert.equal(source.sha256,copy.sha256);controllerPins.push(source,copy);}
  const parentNodePin=await pin(process.execPath);result.controllerRole={kind:'TRUSTED_SAME_INSTANCE_MANIFEST_BOUND_NODE_CONTROLLER',parentPid:process.pid,parentNodePin,files:controllerPins,nativeAuthentication:false};
  stage='HOST_RECEIPT_MODULE';const {validateHostAsyncReceipt}=await import(pathToFileURL(path.join(execution,'desktop/src/terminal/host-async-receipt-contract.mjs')).href);
  stage='WORKER_WAIT_CONTRACT';const originalWorker=await readFile(worker,'utf8');assert.ok(originalWorker.includes("for(let i=0;i<300;i++)")&&originalWorker.includes("await delay(50)"));
  const run=promisify(execFile);async function actualHelper(mode,target){const before=await pin(helper),args=target===undefined?[mode]:[mode,target];let row={mode,target:target??null,actualNativeHelperExecution:true};result.nativeHelperCalls.push(row);try{const r=await run(helper,args,{cwd:out,windowsHide:true,timeout:10000,maxBuffer:262144,encoding:'utf8'});row.exit=0;row.stdout=r.stdout;row.stderr=r.stderr;assert.equal(r.stderr.trim(),'');return JSON.parse(r.stdout);}finally{assert.equal(samePin(await pin(helper),before),true);await save('parent-helper-'+result.nativeHelperCalls.length+'.json',row);}}
  stage='ENGINE_IDENTITY';const system=await actualHelper('system');assert.equal(typeof system,'string');const enginePath=path.join(system,'WindowsPowerShell/v1.0/powershell.exe'),engine=await actualHelper('file',enginePath);assert.equal(engine.file,true);assert.equal(engine.reparse,false);const enginePin=await pin(engine.canonicalPath);
  stage='COMMON_ENVIRONMENT';const common=captureFreshPairLaunchEnvironment(system);assert.equal(common.ok,true,'COMMON_ENVIRONMENT_CAPTURE_REQUIRED');
  stage='COMMON_PROJECT';const project=provision.projectDirectory;assert.equal(project,path.join(provision.jobRoot,'project-\u0218iren-\u0394'));
  const cases=[['pathext-omitted',common.omitted],['pathext-trusted',common.trusted]],prepared=[];
  stage='FIXTURE_PREPARATION';for(const [armId,arm]of cases){const fixtureDirectory=path.join(project,armId);await mkdir(fixtureDirectory);const fixture=createOriginalResolutionFixture({projectDirectory:fixtureDirectory,token:randomBytes(16).toString('hex'),control:'write-output'});await writeFile(fixture.scriptPath,'\uFEFF'+fixture.script,{flag:'wx'});const armOut=path.join(out,armId);await mkdir(armOut);prepared.push({armId,arm,fixture,fixtureDirectory,armOut});}
  // All fixture bytes exist before either shell; runtime is never changed.
  stage='PLAN_RETENTION';await save('parent-plan.json',{run:provision.run,attempt:provision.attempt,commit:provision.commit,retainedRuntime:retained,projectDirectory:project,environment:prepared.map(p=>({armId:p.armId,env:p.arm.env,envSha256:p.arm.envSha256,token:p.fixture.expected,script:sha(p.fixture.script)})),trustedPathext:common.trustedPathext,engine,enginePin,runtimePins:pins,modelStatus:result.modelStatus,...flags});
  // Same exact pinned pure node-pty quoting bodies, without provider evaluation.
  const commandLine=argsToCommandLine(engine.canonicalPath,['-NoLogo','-NoProfile']);
  for(const preparedArm of prepared){
   stage='PRE_ARM_RECHECK';assert.equal(await recheckProvisionedFreshRuntime(provision),true);assert.equal(samePin(await pin(engine.canonicalPath),enginePin),true);for(const p of [...pins,...controllerPins,parentNodePin])assert.equal(samePin(await pin(p.path),p),true);
   const {armId,arm,fixture,fixtureDirectory,armOut}=preparedArm,options={root:provision.root,out:armOut,execution,electronExecutable:electron,filesystemExecutable:helper,observerExecutable:observer,run:provision.run,commit:provision.commit,control:'write-output',armId,projectDirectory:project,fixtureDirectory,expectedEnvironment:arm.env,retainedJobRoot,expectedFixture:fixture};
   stage='ARM_ENTRY_RETENTION';const entry=path.join(armOut,'entry.mjs'),entrySource=`import {app,protocol} from 'electron';\nprotocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);\napp.on('window-all-closed',event=>event?.preventDefault?.());\napp.whenReady().then(async()=>{const {startRuntimeProbe}=await import(${JSON.stringify(pathToFileURL(worker).href)});await startRuntimeProbe(${JSON.stringify(options)});app.exit(0);}).catch(()=>app.exit(1));\n`;await writeFile(entry,entrySource,{flag:'wx'});
   const launchEnvironment=Object.assign(Object.create(null),arm.environment,{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Kellas94/siren',GITHUB_REF:'refs/heads/probe/terminal-session-20261010',GITHUB_RUN_ID:provision.run,GITHUB_RUN_ATTEMPT:provision.attempt,GITHUB_SHA:provision.commit});
   stage='ARM_CHILD_LAUNCH';const child=spawn(electron,[entry],{cwd:project,env:launchEnvironment,windowsHide:true,stdio:['pipe','pipe','pipe']});
   const launch={armId,workerPid:child.pid,status:'STARTED',pipeStatus:'WAITING',stdout:'',stderr:'',partialFrame:'',...flags};result.arms.push(launch);let pending='',challenges=0,pipeFailed=false,challengeTask=Promise.resolve(),timer;
   child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
   const failPipe=()=>{pipeFailed=true;launch.pipeStatus='REFUSED';try{child.stdin.end();}catch{}};
   child.stdout.on('data',chunk=>{launch.stdout+=chunk;if(Buffer.byteLength(launch.stdout)>1048576){launch.stdout=launch.stdout.slice(0,1048576);failPipe();return;}pending+=chunk;if(Buffer.byteLength(pending)>32768){failPipe();return;}let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i).replace(/\r$/,'');pending=pending.slice(i+1);if(!line.startsWith('SIREN_FRESH_PREINPUT '))continue;if(++challenges!==1){failPipe();continue;}challengeTask=(async()=>{try{
    const c=consumeFreshChallenge(line,{workerPid:child.pid,armId,token:fixture.expected}),startedMs=performance.now();assert.equal(await recheckProvisionedFreshRuntime(provision),true);
    const raw=await readTerminalConnectRawFile(retainedJobRoot,c.creatorPid);await save(armId+'-parent-raw-data.json',{challenge:c,raw,...flags});requireParentRaw(raw,c,{env:arm.env,cwd:project,commandLine});for(const p of [...pins,...controllerPins,parentNodePin])assert.equal(samePin(await pin(p.path),p),true);assert.equal(pipeFailed,false);assert.equal(challenges,1);
    assert.equal(await recheckProvisionedFreshRuntime(provision),true);
    const permit={schema:1,type:'FRESH_PREINPUT_PERMIT',workerPid:child.pid,armId,token:fixture.expected,nonce:c.nonce,rawSha256:raw.rawSha256};await save(armId+'-parent-preinput.json',{challenge:c,raw,startedMs,endedMs:performance.now(),...flags});launch.preinput=c;child.stdin.write(JSON.stringify(permit)+'\n');launch.pipeStatus='PERMIT_WRITTEN';
   }catch{failPipe();}})();}});
   child.stderr.on('data',chunk=>{launch.stderr+=chunk;if(Buffer.byteLength(launch.stderr)>1048576){launch.stderr=launch.stderr.slice(0,1048576);failPipe();}});child.stdin.on('error',failPipe);
   stage='ARM_CHANNEL_HANDSHAKE';const exited=await new Promise(resolve=>{child.once('close',(code,signal)=>resolve({code,signal}));child.once('error',()=>resolve({code:null,signal:null,launchError:true}));timer=setTimeout(()=>{launch.watchdog=true;failPipe();try{child.kill();}catch{}resolve({code:null,signal:null,unknownNativeCleanup:true});},120000);});clearTimeout(timer);await challengeTask;launch.partialFrame=pending;launch.exit=exited;await save(armId+'-launch.json',launch);
   stage='ARM_WORKER_RESULT';const bytes=await readFile(path.join(armOut,'worker-result.json'));assert.ok(bytes.length<=2097152);const observed=JSON.parse(bytes.toString('utf8'));launch.status=observed.status;
   stage='ARM_CLEANUP';const cleanup=JSON.parse(await readFile(path.join(armOut,observed.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'?'cleanup-observation.json':'failure-cleanup-observation.json'),'utf8'));requireFreshCleanup(cleanup);assert.equal(validateHostAsyncReceipt(cleanup.hostExpected,cleanup.hostReceipt).ok,true);launch.actualCleanupVerified=true;
   stage='POST_ARM_RECHECK';assert.equal(await recheckProvisionedFreshRuntime(provision),true);assert.equal(samePin(await pin(engine.canonicalPath),enginePin),true);for(const p of [...pins,...controllerPins,parentNodePin])assert.equal(samePin(await pin(p.path),p),true);
   stage='ARM_EXIT_CHANNEL';stage='ARM_EXIT_CODE';assert.equal(exited.code,0);stage='ARM_EXIT_SIGNAL';assert.equal(exited.signal,null);stage='ARM_PIPE_INTEGRITY';assert.equal(pipeFailed,false);stage='ARM_CHALLENGE_COUNT';assert.equal(challenges,1);stage='ARM_PERMIT_STATUS';assert.equal(launch.pipeStatus,'PERMIT_WRITTEN');stage='ARM_FRAME_REMAINDER';assert.equal(pending.trim(),'');stage='ARM_RUN_IDENTITY';assert.equal(observed.run,provision.run);stage='ARM_COMMIT_IDENTITY';assert.equal(observed.commit,provision.commit);stage='ARM_CLEANUP_VERIFIED';assert.equal(observed.cleanupVerified,true);stage='ARM_UNAVAILABLE_CALLBACKS';assert.deepEqual(observed.unavailable,[]);
   stage='ARM_INPUT_RECEIPT';const input=JSON.parse(await readFile(path.join(armOut,'command-input-receipt.json'),'utf8'));assert.equal(input.ok,true);
   stage='ARM_HELD_IDENTITY';assert.equal(cleanup.beforeSession.root.pid,launch.preinput.creatorPid);assert.equal(cleanup.beforeSession.shell.pid,launch.preinput.shellPid);
   stage='ARM_COMMAND_CLASSIFICATION';launch.commandStatus=classifyFreshCommand(observed,{workerPid:child.pid,shellPid:launch.preinput.shellPid,token:fixture.expected});if(launch.commandStatus==='BOUNDED_TARGET_ADVERSE')result.hasAdverseArm=true;
  }
  result.ok=true;result.status=result.hasAdverseArm?'FRESH_PAIR_COMPLETE_WITH_ADVERSE_ARM_NOT_ADMITTED':'FRESH_PAIR_OBSERVED_NOT_ADMITTED';
 }catch{result.ok=false;result.status='FRESH_PAIR_FAILED_NOT_ADMITTED';result.code='FIXED_PAIR_GATE_UNAVAILABLE';result.failureStage=stage;}
 if(save)try{await save('pair-result.json',result);}catch{result.ok=false;result.status='FRESH_PAIR_FAILED_NOT_ADMITTED';result.code='PAIR_RESULT_RETENTION_FAILED';if(result.failureStage===null)result.failureStage='PAIR_RESULT_RETENTION';result.retentionFailureStage='PAIR_RESULT_RETENTION';}
 return freeze(result);
}
// Fixed provisioner continuation only; module import remains inert.
