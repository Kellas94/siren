// Pure finite normal-shell receipt checks; never loads native code or admits Terminal.
import assert from 'node:assert/strict';
import {win32 as path} from 'node:path';
import {PUBLICATION_INPUTS as previousInputs,validateOwnershipCandidate} from './terminal-bootstrap-async-contract.mjs';
import {NORMAL_BEGIN,NORMAL_DONE} from './terminal-normal-probe-core.mjs';
export {validateOwnershipCandidate};
export const CANDIDATE_BRANCH='probe/terminal-normal-powershell-2026-10-08';
export const CANDIDATE_SCOPE='ACTUAL_NORMAL_POWERSHELL_CONTROL_HISTORY_NOT_ADMITTED';
export const PUBLICATION_INPUTS=Object.freeze([...previousInputs,
 '.github/workflows/terminal-normal-powershell.yml',
 'desktop/src/terminal/control-channel.mjs','desktop/src/terminal/history-channel.mjs','desktop/src/terminal/remote-output.mjs','desktop/src/terminal/output.mjs','desktop/src/terminal/credits.mjs','desktop/src/terminal/contracts.mjs','desktop/src/terminal/input-gate.mjs','desktop/src/terminal/gate-link.mjs','desktop/src/terminal/session-state.mjs',
 'desktop/tests/fixtures/terminal-normal-observer.cs',
 'desktop/tests/native/terminal-normal-probe-core.mjs','desktop/tests/native/terminal-normal-worker.mjs','desktop/tests/native/terminal-normal-powershell.mjs','desktop/tests/native/terminal-normal-powershell-contract.mjs','desktop/tests/native/terminal-normal-powershell-derive.mjs','desktop/tests/native/build-terminal-normal-powershell.mjs','desktop/tests/native/terminal-normal-contract-fixture.mjs',
 'desktop/tests/terminal-normal-probe.test.mjs','desktop/tests/terminal-normal-contract.test.mjs','desktop/tests/terminal-normal-builder.test.mjs',
]);
export function validatePublicationInputs(rows){assert.ok(Array.isArray(rows)&&new Set(rows).size===rows.length,'NORMAL_PUBLICATION_DUPLICATE');assert.deepEqual([...rows].sort(),[...PUBLICATION_INPUTS].sort(),'NORMAL_PUBLICATION_CLOSURE');}
export function requireCandidateCi({platform,arch,node,env}){assert.ok(platform==='win32'&&arch==='x64'&&node==='v24.16.0'&&env?.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Windows'&&env.GITHUB_REF==='refs/heads/'+CANDIDATE_BRANCH,'NORMAL_POWERSHELL_CI_ONLY');}
function push(text){return /^  push:[^\n]*\n((?:^    .*\n|^\n)*)/m.exec(text)?.[1]??'';}
function branches(text){const declaration=/^    branches: \[([^\]]*)\]\r?$/m.exec(push(text));assert.ok(declaration,'NORMAL_WORKFLOW_BRANCH');const rows=[...declaration[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.ok(rows.length>0&&rows.map(x=>"'"+x+"'").join(', ')===declaration[1],'NORMAL_WORKFLOW_BRANCH');return rows;}
export function requireWorkflowIsolation({candidate,historical,previous}){assert.deepEqual(branches(candidate),[CANDIDATE_BRANCH],'NORMAL_WORKFLOW_BRANCH');validatePublicationInputs([...push(candidate).matchAll(/^      - '([^']+)'/gm)].map(m=>m[1]));for(const old of [historical,previous])for(const branch of branches(old)){assert.doesNotMatch(branch,/[*?!\[\]{}]/,'NORMAL_HISTORICAL_BRANCH');assert.notEqual(branch,CANDIDATE_BRANCH,'NORMAL_WORKFLOW_COLLISION');}}
const require=(condition,label)=>assert.ok(condition,'NORMAL_'+label);
const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const finite=(v,min=0,max=25000)=>Number.isFinite(v)&&v>=min&&v<max;
const absolute=v=>typeof v==='string'&&v.length<=32768&&/^[a-z]:\\/i.test(v)&&!/[\0/]/.test(v)&&path.normalize(v)===v;
const same=(a,b)=>a.pid===b.pid&&a.createdFileTime===b.createdFileTime&&a.image.toLowerCase()===b.image.toLowerCase();
function identity(p){
 require(p&&integer(p.pid,1,0xffffffff),'PID');require(absolute(p.image),'IMAGE');
 require(typeof p.createdFileTime==='string'&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&BigInt(p.createdFileTime)<=0xffffffffffffffffn,'BIRTH');
 require(typeof p.alive==='boolean'&&integer(p.exitCode,0,0xffffffff),'PROCESS_STATE');if(p.alive)assert.equal(p.exitCode,259,'NORMAL_LIVE_EXIT');return p;
}
function identities(rows,min,max){
 require(Array.isArray(rows)&&rows.length>=min&&rows.length<=max,'HELD_BOUNDS');const map=new Map();
 for(const p of rows){identity(p);require(!map.has(p.pid),'HELD_DUPLICATE');map.set(p.pid,p);}return map;
}
function coverage(required,actual){for(const [pid,p] of required)require(actual.has(pid)&&same(p,actual.get(pid)),'IDENTITY_COVERAGE');}
function flags(s,stopping){
 require(s&&s.killOnClose===true&&s.breakaway===false&&s.inheritable===false,'JOB_FLAGS');assert.equal(s.stopping,stopping,'NORMAL_STOPPING_STATE');
 require(typeof s.monitorFired==='boolean'&&s.monitorTerminateSucceeded===false,'UNEXPECTED_MONITOR_TERMINATION');
}
function snapshot(s,{min,max,live,session}){
 flags(s,!live);const held=identities(s.held,min,max),root=identity(s.root);require(held.has(root.pid)&&same(root,held.get(root.pid)),'ROOT_COVERAGE');
 assert.equal(root.alive,live,'NORMAL_ROOT_LIVENESS');assert.equal(root.exitCode,live?259:77,'NORMAL_ROOT_EXIT');assert.equal(s.active,live?held.size:0,'NORMAL_JOB_ACCOUNTING');
 for(const p of held.values()){assert.equal(p.alive,live,'NORMAL_HELD_LIVENESS');assert.equal(p.exitCode,live?259:77,'NORMAL_HELD_EXIT');}
 if(session){const shell=identity(s.shell);require(held.has(shell.pid)&&same(shell,held.get(shell.pid))&&shell.pid!==root.pid,'SHELL_COVERAGE');require(shell.alive===live&&shell.exitCode===(live?259:77),'SHELL_STATE');require(integer(s.hostPid,1,0xffffffff),'HOST_PID');require(s.atomicBeforeResume===true,'ATOMIC_CREATOR');require(typeof s.shellMonitorFired==='boolean'&&s.shellMonitorTerminated===false,'SHELL_MONITOR');if(live)require(s.monitorFired===false&&s.shellMonitorFired===false,'EARLY_MONITOR');}
 return held;
}
function runtime(r){require(r&&r.electron==='44.5.1'&&r.modules==='149'&&r.napi==='10'&&r.arch==='x64'&&r.platform==='win32'&&typeof r.node==='string'&&/^24\.[0-9]+\.[0-9]+$/.test(r.node),'RUNTIME');}
function probe(p,initial=false){
 require(p&&integer(p.inputWrites,0,1)&&typeof p.writeKnown==='boolean'&&integer(p.refusedInput,initial?1:2)&&integer(p.receivedBytes,0,4194304)&&integer(p.parserCharacters,0,1024)&&p.parserCharacters<=p.receivedBytes,'PROBE_BOUNDS');
 if(initial){require(p.inputWrites===0&&p.writeKnown===false&&p.beginMs===null&&p.lockMs===null&&p.doneMs===null,'INITIAL_INPUT_FENCE');}
 else{require(p.inputWrites===1&&p.writeKnown===true&&p.receivedBytes>0,'FIXED_COMMAND_EXECUTION');require(finite(p.beginMs)&&finite(p.lockMs)&&finite(p.doneMs)&&p.beginMs<p.lockMs&&p.lockMs<p.doneMs,'LOCK_DURING_COMMAND');}
}
function history(h,receivedBytes){
 const keys=['firstSequence','nextSequence','retainedUtf8Bytes','droppedUtf8Bytes','blockCount','allocatedBytes','pendingVtUtf8Bytes','omittedSequences'];require(h&&keys.every(k=>integer(h[k])),'HISTORY_COUNTERS');
 require(h.firstSequence===0&&h.droppedUtf8Bytes===0&&h.omittedSequences===0,'FINITE_HISTORY_LOSS');
 require(h.nextSequence===h.retainedUtf8Bytes&&h.nextSequence>0&&h.nextSequence<=receivedBytes&&h.retainedUtf8Bytes<=h.allocatedBytes&&h.allocatedBytes<=4194304,'CREATOR_RING_BOUND');
 require(h.blockCount>=1&&h.blockCount<=128&&h.allocatedBytes===h.blockCount*32768&&h.pendingVtUtf8Bytes<=4096,'PHYSICAL_RING_BOUND');
}
function inputIdentity(row){require(row&&absolute(row.path)&&typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256)&&integer(row.bytes,1),'INPUT_IDENTITY');}
export function validateCandidateObservation({result,addon,electron}){
 require(result&&result.admitted===false&&result.negative===false&&result.compileOnly===false&&result.inputsUnchanged===true,'POSITIVE_SOURCE_RECEIPT');
 require(result.processStarted===true&&result.outerExitObserved===true&&result.outerExitCode===0&&result.qualified===true,'OUTER_COMPLETION');assert.equal(result.status,'NORMAL_POWERSHELL_OBSERVED_NOT_ADMITTED');
 require(result.deadlineExceeded===undefined&&result.outputTruncated===undefined,'OUTER_DEADLINE');require(absolute(result.output)&&path.basename(result.output).startsWith('SIREN env Ω space-'),'UNICODE_SPACE_DIRECTORY');
 const n=result.native,o=result.observer;for(const scope of [result,n,o])require(scope&&scope.admitted===false&&scope.error===undefined&&scope.cleanupError===undefined,'NO_ERROR');
 assert.equal(n.status,result.status,'NORMAL_NATIVE_STATUS');assert.equal(o.status,'NORMAL_SAFETY_OBSERVED_NOT_ADMITTED');
 runtime(n.runtime);runtime(n.ready?.runtime);assert.deepEqual(n.ready.runtime,n.runtime,'NORMAL_RUNTIME_MATCH');
 require(n.ready.nodePty==='1.1.0'&&n.ready.osConpty===true&&n.ready.useConptyDll===false,'OS_CONPTY');probe(n.ready.initial,true);probe(n.completion);history(n.completion.history,n.completion.receivedBytes);
 const keys=n.ready.environmentKeys;require(Array.isArray(keys)&&keys.every(k=>typeof k==='string'),'CREATOR_ENV_KEYS');assert.deepEqual(keys.map(k=>k.toUpperCase()).sort(),['COMSPEC','ELECTRON_RUN_AS_NODE','PATH','SYSTEMROOT','TEMP','TMP','WINDIR'],'NORMAL_CREATOR_ENVIRONMENT');
 const before=snapshot(n.before,{min:2,max:32,live:true,session:true}),hostBefore=snapshot(n.hostBefore,{min:3,max:48,live:true,session:false});coverage(before,hostBefore);
 const creator=n.before.root,shell=n.before.shell,host=n.hostBefore.root;require(creator.pid!==host.pid&&shell.pid!==host.pid&&n.before.hostPid===host.pid,'HOST_CREATOR_DISTINCT');
 require(n.ready.workerPid===creator.pid&&n.ready.rootPid===shell.pid,'READY_NATIVE_BINDING');require(absolute(n.ready.shell)&&/\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i.test(n.ready.shell),'POWERSHELL_ABSOLUTE');
 assert.equal(shell.image.toLowerCase(),n.ready.shell.toLowerCase(),'NORMAL_SHELL_IMAGE');assert.equal(creator.image.toLowerCase(),electron.path.toLowerCase(),'NORMAL_CREATOR_IMAGE');assert.equal(host.image.toLowerCase(),electron.path.toLowerCase(),'NORMAL_HOST_IMAGE');
 const conhost=path.join(path.dirname(path.dirname(path.dirname(n.ready.shell))),'conhost.exe').toLowerCase(),images=new Set([electron.path.toLowerCase(),conhost,n.ready.shell.toLowerCase()]);
 for(const p of hostBefore.values()){require(images.has(p.image.toLowerCase()),'NATIVE_IMAGE_ALLOWLIST');require(p.image.toLowerCase()!==n.ready.shell.toLowerCase()||p.pid===shell.pid,'EXTRA_SHELL');}
 assert.deepEqual(n.openAck,{ok:true,generation:1,localInputFenced:false,hostAcknowledged:true},'NORMAL_OPEN_ACK');
 assert.deepEqual(n.lockAck,{ok:true,generation:2,localInputFenced:true,hostAcknowledged:true},'NORMAL_LOCK_ACK');require(n.oldViewRefused===true,'OLD_VIEW_REFUSED');
 assert.deepEqual(n.replayInputFence,{generation:2,closed:true,hostAcknowledged:true},'NORMAL_REPLAY_CANNOT_REOPEN_INPUT');
 assert.deepEqual(n.lockedStats,{sessions:1,retiringCreators:0,pendingRequests:0,reservedUtf8Bytes:0,retainedUtf8Bytes:0,attachments:0,outstandingUtf8Bytes:0,frames:0},'NORMAL_LOCKED_OUTPUT_ACCOUNTING');
 require(n.historyReplay?.begin===true&&n.historyReplay.done===true&&integer(n.historyReplay.bytes,Buffer.byteLength(NORMAL_BEGIN+NORMAL_DONE),4194304)&&integer(n.historyReplay.frames,1,4096),'HISTORY_REPLAY');
 require(n.stopped?.closed===true,'ASYNC_DISPOSAL');const stopped=snapshot(n.stopped.snapshot,{min:2,max:32,live:false,session:true});coverage(before,stopped);assert.equal(stopped.size,before.size,'NORMAL_STOPPED_COUNT');require(n.stopped.snapshot.hostPid===host.pid,'STOPPED_HOST_BINDING');
 const hostAfter=snapshot(n.hostAfter,{min:3,max:48,live:false,session:false});coverage(hostBefore,hostAfter);assert.equal(hostAfter.size,hostBefore.size,'NORMAL_HOST_FINAL_COUNT');require(same(host,n.hostAfter.root)&&same(creator,n.stopped.snapshot.root)&&same(shell,n.stopped.snapshot.shell),'FINAL_ROOT_IDENTITY');require(n.hostClosed===true,'HOST_DISPOSAL');
 const a=n.asyncRetirement;require(a&&finite(a.elapsedMs,0,3000)&&integer(a.ticks)&&finite(a.maxGapMs,0,250)&&(a.elapsedMs<50||a.ticks>0),'ASYNC_STOP_TIMING');
 require(o.safetyHeldBeforeGo===true&&o.safetyOpenAtObservation===true&&o.activeBeforeSafetyCleanup===0&&o.cleanupVerified===true&&finite(o.ageMs,0,25000),'SAFETY_OBSERVATION');
 const main=identity(o.main);require(main.alive&&main.image.toLowerCase()===electron.path.toLowerCase()&&!hostBefore.has(main.pid),'SAFETY_MAIN');const safetyBefore=identities(o.before,4,48),safetyAfter=identities(o.after,4,48);coverage(hostBefore,safetyBefore);coverage(new Map([[main.pid,main]]),safetyBefore);coverage(safetyBefore,safetyAfter);assert.equal(safetyAfter.size,safetyBefore.size,'NORMAL_SAFETY_FINAL_COUNT');
 for(const [pid,p] of safetyBefore){require(p.alive&&p.exitCode===259&&BigInt(p.createdFileTime)>=BigInt(main.createdFileTime)&&images.has(p.image.toLowerCase()),'SAFETY_LIVE_IDENTITY');require(p.image.toLowerCase()!==n.ready.shell.toLowerCase()||pid===shell.pid,'SAFETY_EXTRA_SHELL');const end=safetyAfter.get(pid);require(end.alive===false,'SAFETY_SURVIVOR');if(pid===main.pid)assert.equal(end.exitCode,0,'NORMAL_MAIN_EXIT');if(hostAfter.has(pid))assert.equal(end.exitCode,77,'NORMAL_CAUSAL_NATIVE_EXIT');}
 inputIdentity(addon);inputIdentity(electron);require(Array.isArray(result.inputs)&&result.inputs.length>=2&&result.inputs.length<=1024,'INPUT_SET');const inputs=new Map();for(const row of result.inputs){inputIdentity(row);const key=row.path.toLowerCase();require(!inputs.has(key),'INPUT_DUPLICATE');inputs.set(key,row);}
 const match=expected=>{const r=inputs.get(expected.path.toLowerCase());require(r&&r.path===expected.path&&r.sha256===expected.sha256&&r.bytes===expected.bytes,'LOADED_INPUT_IDENTITY');return r;};const loadedAddon=match(addon);match(electron);
 return {loadedAddon,loadedRuntime:n.runtime,normalShell:{admitted:false,status:result.status,logicalRequiredMembers:2,sessionHeldMembers:before.size,hostHeldMembers:hostBefore.size,safetyHeldMembers:safetyBefore.size,inputWrites:n.completion.inputWrites,lockDuringCommand:true,historyReplayed:true,asyncClosed:true,elapsedMs:a.elapsedMs,ticks:a.ticks,maxGapMs:a.maxGapMs}};
}
