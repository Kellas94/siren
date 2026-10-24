"""One-use SOURCE_ONLY derivation. No native execution, imports or publication."""
from pathlib import Path
import hashlib, json, sys

root = Path(__file__).resolve().parent.parent
out = Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
verify = sys.argv[1:] == ['--verify']
refresh = sys.argv[1:] == ['--refresh-correction']
assert not sys.argv[1:] or verify or refresh
def write(path, content):
    data = content if isinstance(content, bytes) else content.encode('utf-8')
    if verify:
        assert (root / path).read_bytes() == data, path
        return
    if refresh:
        prior = json.loads((out/'pre-correction-v1/original-pins.json').read_text())
        row = next(row for row in prior if row['path'] == path)
        assert sha((out/'pre-correction-v1'/path).read_bytes()) == row['sha256'], path
        (root/path).write_bytes(data)
        return
    with (root / path).open('xb') as f:
        f.write(content if isinstance(content, bytes) else content.encode('utf-8'))
def once(text, before, after):
    assert text.count(before) == 1, before
    return text.replace(before, after)

worker = (root / 'desktop/tests/native/terminal-cmdlet-runtime-worker.mjs').read_bytes()
driver = (root / 'desktop/tests/native/terminal-discovery-runtime.mjs').read_bytes()
workflow = (root / '.github/workflows/terminal-discovery-runtime.yml').read_bytes()
assert sha(worker) == '26da5371f6af6e53aade79ebc340d7687596a1b5bbd427dc13cc35caa7f2ab33'
assert sha(driver) == 'dc170bd03671de379299297e04b2c80364b784f35b86735083f8b3d4b3937c01'
assert sha(workflow) == 'e1cd47555d3495114a7ec5b1464b9df5f7f0699678a36f53ff1d93b8d7576949'
workerChanges=[
 (" const probeStarted=performance.now();let observationPhase='setup';", " const commandTiming={scope:'DIAGNOSTIC_MONOTONIC_INPUT_WAIT_V1',clockDomain:'worker-process-performance-now',run,commit,control,workerPid:process.pid,heldShellPid:null,fixtureVariant:null,token:null,commandInputSequence:0,nominalWaitMs:15000,pollCount:300,pollDelayMs:50,inputSubmittedMs:null,inputReturnedMs:null,inputAcceptedMs:null,waitStartedMs:null,nominalDeadlineMs:null,waitEndedMs:null,completionObserved:false,completionObservedMs:null,completionLate:null,completedWithinNominalDeadline:null};result.commandTiming=commandTiming;\n const probeStarted=performance.now();let observationPhase='setup';"),
 ("result.fixtureVariant=fixture.variant;", "result.fixtureVariant=fixture.variant;commandTiming.fixtureVariant=fixture.variant;commandTiming.token=fixture.expected;"),
 ("beforeSession=native.snapshotSession(nativeState.sessions[0]);beforeHost=native.snapshot(nativeState.host);", "beforeSession=native.snapshotSession(nativeState.sessions[0]);beforeHost=native.snapshot(nativeState.host);commandTiming.heldShellPid=beforeSession.shell.pid;"),
 ("observationPhase='single-cmdlet-command';const input=", "observationPhase='single-cmdlet-command';commandTiming.inputSubmittedMs=performance.now();const input="),
 ("data:fixture.input})});assert.equal(input.ok,true);await save('command-input-receipt.json',input);", "data:fixture.input})});commandTiming.inputReturnedMs=performance.now();if(input.ok===true)commandTiming.inputAcceptedMs=performance.now();assert.equal(input.ok,true);await save('command-input-receipt.json',input);"),
 ("  await waitFile(fixture.completedPath,fixture.expected);", "  commandTiming.waitStartedMs=performance.now();commandTiming.nominalDeadlineMs=commandTiming.waitStartedMs+15000;\n  try{await waitFile(fixture.completedPath,fixture.expected);commandTiming.completionObserved=true;commandTiming.completionObservedMs=performance.now();}finally{commandTiming.waitEndedMs=performance.now();}"),
 (" }finally{\n  try{\n   if(observer)", " }finally{\n  if(commandTiming.completionObserved){commandTiming.completionLate=commandTiming.completionObservedMs>commandTiming.nominalDeadlineMs;commandTiming.completedWithinNominalDeadline=!commandTiming.completionLate;}\n  try{await save('command-timing.json',commandTiming);}catch(e){result.commandTimingError={message:e.message,code:e.code??null};result.status='FAILED';completedObservations=false;}\n  try{\n   if(observer)"),
]
for name, adapter in [('original','createOriginalResolutionFixture'),('qualified','createQualifiedResolutionFixture')]:
    source = once(worker.decode('utf-8'), "import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';", "import {"+adapter+" as createSingleCmdletFixture} from './terminal-resolution-observation.mjs';")
    for before,after in workerChanges:source=once(source,before,after)
    write('desktop/tests/native/terminal-resolution-'+name+'-worker.mjs',source)

helpers = r"""
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
"""
text=driver.decode('utf-8')
replacements=[
 ("// Hosted-only cold cmdlet diagnosis. Local imports expose pure validators only.","// Hosted-only pretarget state comparison. Local imports expose pure DATA validators only."),
 ("import {createComparedCmdletFixture,coldCmdletComparisonCases} from './terminal-discovery-fixture.mjs';","import {createResolutionObservationFixture,resolutionObservationCases,parseResolutionObservation} from './terminal-resolution-observation.mjs';"),
 ("const controls=Object.freeze(['start-sleep','write-output']);","const controls=Object.freeze(['write-output']);"),
 ('createComparedCmdletFixture({control,mode,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected})','createResolutionObservationFixture({control,mode,projectDirectory:dirname(fixture.scriptPath),token:fixture.expected})'),
 ('export function createCmdletRuntimeEntry(',helpers+'\nexport function createResolutionRuntimeEntry('),
 ("out=join(root,'desktop/evidence/terminal-discovery-runtime',suffix)","out=join(root,'desktop/evidence/terminal-resolution-runtime',suffix)"),
 ("scope:'HOSTED_COLD_CMDLET_RESOLUTION_COMPARISON'","scope:'HOSTED_PRETARGET_RESOLUTION_STATE_COMPARISON'"),
 ("join(root,'desktop/tests/native/terminal-discovery-runtime-inputs.json'),manifest=", "join(root,'desktop/tests/native/terminal-resolution-runtime-inputs.json'),manifest="),
 ("manifest.scope,'CMDLET_COMPARISON_SOURCE_PINS'","manifest.scope,'RESOLUTION_OBSERVATION_SOURCE_PINS'"),
 ("  for(const required of ['desktop/tests/native/terminal-discovery-runtime.mjs'", "  for(const required of ['desktop/tests/native/terminal-resolution-runtime.mjs','desktop/tests/native/terminal-resolution-observation.mjs','desktop/tests/native/terminal-resolution-observation.test.mjs','desktop/tests/native/terminal-resolution-original-worker.mjs','desktop/tests/native/terminal-resolution-qualified-worker.mjs','desktop/tests/terminal-resolution-runtime.test.mjs','.github/workflows/terminal-resolution-runtime.yml','terminal-resolution-controller-20261011/prepare-source.py','terminal-resolution-controller-20261011/source-derivation.json','terminal-resolution-controller-20261011/derivation-inputs/origin.json','desktop/tests/native/terminal-discovery-runtime-inputs.json','desktop/tests/native/terminal-discovery-runtime.mjs'"),
 ("const originalInputs=JSON.parse(await readFile(join(root,'desktop/tests/native/terminal-session-runtime-inputs.json'),'utf8'));assert.equal(originalInputs.scope,'SESSION_RUNTIME_SOURCE_PINS')", "const originalInputs=JSON.parse(await readFile(join(root,'desktop/tests/native/terminal-discovery-runtime-inputs.json'),'utf8'));assert.equal(originalInputs.scope,'CMDLET_COMPARISON_SOURCE_PINS')"),
 ('  for(const {armId,control,mode} of coldCmdletComparisonCases){','  for(const {armId,control,mode} of resolutionObservationCases){'),
 ("mode==='original'?'terminal-cmdlet-runtime-worker.mjs':'terminal-discovery-worker.mjs'", "mode==='original'?'terminal-resolution-original-worker.mjs':'terminal-resolution-qualified-worker.mjs'"),
 ('createCmdletRuntimeEntry(workerPath,options)','createResolutionRuntimeEntry(workerPath,options)'),
]
for before,after in replacements:text=once(text,before,after)
start=text.index('   let worker;')
end=text.index('\n  }\n  await recheckTerminalSessionExecutionResources',start)
oldLoop=text[start:end]
newLoop=r"""   const saveArm=(name,value)=>writeFile(join(armOut,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
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
   if(!observation.cleanupConsistent){arm.nextArmRefused='PREVIOUS_NATIVE_CLEANUP_UNVERIFIED';break;}"""
text=text[:start]+newLoop+text[end:]
text=once(text,'[a.entry,a.workerResult,a.fixture,a.script]','[a.entry,a.workerResult,a.fixture,a.script,a.state,a.completed,a.stage,a.observationReadback]')
aggregate="assert.deepEqual(receipt.arms.map(a=>a.armId),coldCmdletComparisonCases.map(a=>a.armId));assert.ok(receipt.arms.every(a=>a.status==='SINGLE_CMDLET_DIAGNOSTIC_COMPLETE'),'CMDLET_COMPARISON_ADVERSE');"
text=once(text,aggregate,'validateResolutionAggregate(receipt.arms);')
text=once(text,"'FOUR_COLD_CMDLET_COMPARISON_ARMS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION'","'TWO_RESOLUTION_STATE_ARMS_OBSERVED_NOT_ORIGINAL_LOCK_QUALIFICATION'")
write('desktop/tests/native/terminal-resolution-runtime.mjs',text)

w=workflow.decode('utf-8').replace('terminal-discovery-runtime','terminal-resolution-runtime')
w=once(w,'name: Terminal cold command-resolution comparison (not admitted)','name: Terminal pretarget resolution observations (not admitted)')
w=once(w,"      - 'desktop/tests/native/terminal-discovery-*'","      - 'desktop/tests/native/terminal-resolution-*'")
w=once(w,'Compare original and module-qualified cmdlets in four fresh processes','Observe qualified then original Write-Output in two fresh processes')
w=once(w,'            desktop/tests/native/terminal-discovery-*','            desktop/tests/native/terminal-discovery-*\n            desktop/tests/native/terminal-resolution-*\n            desktop/tests/terminal-discovery-runtime.test.mjs')
w=once(w,'            desktop/tests/terminal-resolution-runtime-*.test.mjs','            desktop/tests/terminal-discovery-runtime-*.test.mjs\n            desktop/tests/terminal-resolution-runtime-*.test.mjs')
w=once(w,'            .github/workflows/terminal-resolution-runtime.yml','            .github/workflows/terminal-discovery-runtime.yml\n            .github/workflows/terminal-resolution-runtime.yml')
w+='            terminal-resolution-controller-20261011/prepare-source.py\n            terminal-resolution-controller-20261011/source-derivation.json\n            terminal-resolution-controller-20261011/derivation-inputs/**\n'
write('.github/workflows/terminal-resolution-runtime.yml',w)
if not verify and not refresh:(out/'derivation-inputs').mkdir()
origin={'author':'/root/session_native_failure_diagnosis','classification':'IMPLEMENTER_SOURCE_DERIVATION_NOT_INDEPENDENT_APPROVAL','originals':[{'path':p,'bytes':len(b),'sha256':sha(b)} for p,b in [('desktop/tests/native/terminal-cmdlet-runtime-worker.mjs',worker),('desktop/tests/native/terminal-discovery-runtime.mjs',driver),('.github/workflows/terminal-discovery-runtime.yml',workflow)]],'nativeExecutionAdmitted':False,'originalSourcesModified':False}
write('terminal-resolution-controller-20261011/derivation-inputs/origin.json',json.dumps(origin,indent=2)+'\n')
write('terminal-resolution-controller-20261011/source-derivation.json',json.dumps({**origin,'revision':'RS1_RS2_RS3_CORRECTION_V2','workerChanges':'Fixed fixture import plus seven literal diagnostic timing additions; earlier import-only claim explicitly superseded for corrected new workers. Original300x50 loop, lifecycle and nominal timer unchanged.','workerLiteralReplacements':[{'before':a,'after':b} for a,b in workerChanges],'driverLiteralReplacements':[{'before':a,'after':b} for a,b in replacements],'driverArmLoopBefore':oldLoop,'driverArmLoopAfter':newLoop,'driverAggregateChange':'Require exact two resolution cases, retain any adverse worker/state/timing result including late completion.','workflowChanges':'Derived old workflow; retain all previous closure plus model, workers, driver, tests, own workflow and derivation provenance.'},indent=2)+'\n')
print('Prepared source only. No native execution or dispatch.')
