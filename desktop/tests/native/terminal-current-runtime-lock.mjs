// Fixed preparation helper for the CURRENT source runtime. Import does no I/O.
// Trusted MAIN adapters own permission/raw/observer gates and actual cleanup.
// Inert tests cannot establish native evidence; returned admission is always false.
import assert from 'node:assert/strict';
import {createLockContinuationFixture} from './terminal-session-command.mjs';
import {TerminalProductionManager} from '../../src/terminal/production-manager.mjs';
import {TerminalProductionAccessTransitions} from '../../src/terminal/production-access-transitions.mjs';
import {TerminalRequestRouter} from '../../src/terminal/request-router.mjs';
import {assertCurrentRuntimeLockCleanup} from './terminal-current-runtime-lock-cleanup.mjs';
const method=(type,key)=>Object.getOwnPropertyDescriptor(type.prototype,key).value;
const stats=method(TerminalProductionManager,'stats'),accessStats=method(TerminalProductionAccessTransitions,'stats'),currentRouter=method(TerminalProductionAccessTransitions,'currentRouter'),route=method(TerminalRequestRouter,'route');
const invoke=(fn,object,...args)=>Reflect.apply(fn,object,args);
let sequence=0;
const request=(grant,extra={})=>({operationId:'current_lock_'+ ++sequence,epoch:grant.epoch,...extra});
const ok=(reply,phase)=>{assert.equal(reply?.ok,true,phase+':'+reply?.code);return reply.value;};
const freshRouter=members=>{const r=invoke(currentRouter,members.access);assert(r instanceof TerminalRequestRouter);return r;};
function assertRunning(value,prior,sessionId){
 assert.equal(value?.sessionId,sessionId);assert.equal(value.sessionStopCalls,0,'LOCK_MUST_NOT_STOP_SESSION');assert.equal(value.hostStopCalls,0,'LOCK_MUST_NOT_STOP_HOST');
 for(const key of ['root','shell']){const p=value.session?.[key];assert.equal(p?.alive,true,'LOCKED_PROCESS_NOT_ALIVE');assert(Number.isSafeInteger(p.pid)&&p.pid>0);assert.equal(typeof p.image,'string');assert.match(p.createdFileTime,/^[1-9][0-9]*$/);if(prior)for(const field of ['pid','image','createdFileTime'])assert.equal(p[field],prior.session[key][field],'RUNNING_SESSION_IDENTITY_CHANGED');}
}
export async function discoverCurrentRuntimeLock({members,workspace}){
 invoke(stats,members.manager);invoke(accessStats,members.access);
 const {event,grant}=workspace(),router=freshRouter(members);
 const cwd=ok(await invoke(route,router,{event,method:'terminalPickCwd',payload:request(grant)}),'CURRENT_CWD_DISCOVERY');
 const profiles=ok(await invoke(route,router,{event,method:'terminalListProfiles',payload:request(grant)}),'CURRENT_PROFILE_DISCOVERY');
 assert(profiles.some(p=>p.profileId==='powershell'&&p.available===true),'CURRENT_POWERSHELL_UNAVAILABLE');
 return {cwd,profiles};
}
export async function runCurrentRuntimeLockScenario(options){
 const {members,workspace,first,sessionId,projectDirectory,token,io,beforeInput,observeRunning,setLocked,attach,cleanup}=options;
 invoke(stats,members.manager);invoke(accessStats,members.access);
 for(const fn of [workspace,beforeInput,observeRunning,setLocked,attach,cleanup,io?.absent,io?.waitFile,io?.writeExclusive,io?.delay,io?.record])assert.equal(typeof fn,'function');
 const fixture=createLockContinuationFixture({projectDirectory,token});
 assert.equal(first.lease.sessionId,sessionId);assert.equal(first.router,freshRouter(members));
 const records=[];const record=async(name,value)=>{records.push({name,value});await io.record(name,value);};
 await io.absent(fixture.startedPath);await io.absent(fixture.completedPath);await io.absent(fixture.forbiddenPath);await io.absent(fixture.releasePath);
 // The caller must complete the actual parent-permit/raw/held-observer checks
 // here. This private callback result alone is NOT authentication evidence.
 const boundary=await beforeInput({fixture,first,sessionId});assert.equal(boundary?.inputAuthorized,true,'CURRENT_LOCK_PREINPUT_REFUSED');
 // Basic DATA consistency must be checked before any command can be dispatched.
 // This shape never proves native ownership; the caller must still compare the
 // actual held capabilities/raw/observer observations at the private boundary.
 for(const key of ['root','shell']){const p=boundary.beforeSession?.[key];assert(p?.alive===true&&Number.isSafeInteger(p.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&typeof p.createdFileTime==='string'&&/^[1-9][0-9]*$/.test(p.createdFileTime),'HELD_PREINPUT_SESSION_REQUIRED');}
 assert.equal(typeof boundary.isCurrent,'function');assert.equal(boundary.isCurrent(),true,'CURRENT_LOCK_PERMIT_REVOKED');
 const input=await invoke(route,first.router,{event:first.caller,method:'terminalInput',payload:request(first.grant,{...first.lease,inputSequence:0,data:fixture.input})});ok(input,'FIXED_COMMAND_INPUT');await record('command-input',input);
 assert.equal(await io.waitFile(fixture.startedPath,fixture.expected),fixture.expected);await io.absent(fixture.completedPath);
 const beforeLock=await observeRunning({sessionId});assertRunning(beforeLock,{session:boundary.beforeSession},sessionId);await record('running-before-lock',beforeLock);
 // No await or callback lies between beginLock and the closed/router observation
 // and dispatch of the deliberately forbidden request.
 const locking=invoke(method(TerminalProductionAccessTransitions,'beginLock'),members.access,'current running original PowerShell fixture');
 assert.equal(invoke(stats,members.manager).inputClosed,true,'SAME_TURN_INPUT_NOT_CLOSED');assert.equal(invoke(currentRouter,members.access),null,'SAME_TURN_ROUTER_NOT_REVOKED');
 const refusal=invoke(route,first.router,{event:first.caller,method:'terminalInput',payload:request(first.grant,{...first.lease,inputSequence:1,data:fixture.forbiddenInput})});
 setLocked(true);const lock=await locking;ok(lock,'RUNNING_COMMAND_LOCK');const refused=await refusal;assert.equal(refused.ok,false,'LOCKED_INPUT_ACCEPTED');await record('lock-and-input-refusal',{lock,refused});
 const afterLock=await observeRunning({sessionId});assertRunning(afterLock,beforeLock,sessionId);await record('same-session-after-lock',afterLock);
 await io.absent(fixture.completedPath);await io.absent(fixture.forbiddenPath);
 await io.writeExclusive(fixture.releasePath,fixture.expected);
 assert.equal(await io.waitFile(fixture.completedPath,fixture.expected),fixture.expected);await io.absent(fixture.forbiddenPath);
 assert.equal(invoke(stats,members.manager).inputClosed,true);assert.equal(invoke(currentRouter,members.access),null);
 const afterCompletion=await observeRunning({sessionId});assertRunning(afterCompletion,beforeLock,sessionId);await record('same-session-completed-while-locked',afterCompletion);
 const owner=members.ownership.snapshot().sessions.find(r=>r.sessionId===sessionId);assert(owner,'SAME_SESSION_OWNER_MISSING');
 let lockedHistory='';for(let i=0;i<100;i++){
  const history=await members.backend.readHistory({ownerId:owner.sessionOwnerId,fromSequence:0,maxBytes:32768});
  lockedHistory=history.chunk?.data??'';if(lockedHistory.includes('SIREN_LOCK_CONTINUATION_COMPLETE'))break;await io.delay(50);
 }
 assert(lockedHistory.includes('SIREN_LOCK_CONTINUATION_COMPLETE'),'LOCKED_BACKEND_HISTORY_MARKER_MISSING');
 assert(!fixture.input.includes('SIREN_LOCK_CONTINUATION_COMPLETE'),'INPUT_ECHO_CANNOT_QUALIFY');
 await record('completed-while-locked',{sessionId,completed:fixture.expected,lockedHistory,inputClosed:invoke(stats,members.manager).inputClosed});
 setLocked(false);ok(await invoke(method(TerminalProductionAccessTransitions,'reopen'),members.access,workspace().event),'FRESH_REOPEN');
 const discovery=await discoverCurrentRuntimeLock({members,workspace});await record('post-unlock-current-discovery',discovery);
 const second=await attach(sessionId);assert.equal(second.lease.sessionId,sessionId);assert.notEqual(second.grant.windowId,first.grant.windowId);assert(second.lease.generation>first.lease.generation);assert.notEqual(second.router,first.router);
 const stale=await invoke(route,first.router,{event:workspace().event,method:'terminalList',payload:request(workspace().grant)});assert.equal(stale.ok,false);
 let output='';for(let i=0;i<100&&!output.includes('SIREN_LOCK_CONTINUATION_COMPLETE');i++){
  let frame;const delivered=await members.manager.deliverAvailable(second.grant,request(second.grant,second.lease),value=>{frame=value;});ok(delivered,'FRESH_HISTORY_DELIVERY');
  if(frame?.chunk){output+=frame.chunk.data;assert(Buffer.byteLength(output)<=4*1024*1024,'HISTORY_BOUND');ok(members.manager.commitOutputHandoff(delivered.value.handoffTicket),'HISTORY_HANDOFF');ok(await invoke(route,second.router,{event:second.caller,method:'terminalAck',payload:request(second.grant,{...second.lease,throughSequence:frame.chunk.sequence+frame.chunk.utf8Bytes})}),'HISTORY_ACK');}else await io.delay(50);
 }
 assert(output.includes('SIREN_LOCK_CONTINUATION_COMPLETE'),'FRESH_HISTORY_MARKER_MISSING');await record('fresh-lease-history',{sessionId,first:first.lease,second:second.lease,output,stale});
 const w=workspace(),stopped=await invoke(route,freshRouter(members),{event:w.event,method:'terminalStop',payload:request(w.grant,{sessionId})});ok(stopped,'EXPLICIT_STOP');
 const observation=await cleanup({sessionId,stopped,first,second});
 assertCurrentRuntimeLockCleanup(observation);await record('cleanup-observation',observation);
 return Object.freeze({status:'CURRENT_RUNNING_LOCK_OBSERVED_NOT_ADMITTED',sessionId,lockRefusedNewInput:true,commandCompletedWhileLocked:true,historyRetained:true,cleanupDataConsistent:true,nativeExecutionAdmitted:false,productActivation:false,actualPinUiProof:false,records:Object.freeze(records)});
}
