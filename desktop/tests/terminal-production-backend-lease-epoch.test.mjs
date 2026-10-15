// Regression contract over actual production backend/creator/ownership JS.
// All native windows, byte I/O and PTY callbacks are deliberately inert.
// The workspace-grant test exercises the real WindowRegistry epoch authority;
// it is NOT TerminalPolicy, registered terminal-role, PIN or product admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createInertProductionComposition,inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';

const count=(s,name)=>s.state.trace.filter(row=>row.name===name).length;
const lease=(ownerId,epoch=4,generation=1,leaseId=`lease${generation}`,windowId='window1')=>({ownerId,windowId,epoch,leaseId,generation});
const input=(ownerId,generation,data,leaseId=`lease${generation}`)=>({ownerId,leaseId,generation,inputSequence:0,data});
const creatorCommands=s=>s.group('session1').creator.stats().session.commands;
const creatorStartup=s=>s.group('session1').creator.stats().session.startup;
async function ready(s,config=inertConfig(),guard=s.guard){
 assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);
 const prepared=s.backend.prepare(config,guard);assert.equal(prepared.ok,true);
 assert.equal(s.backend.allocate({ownerId:prepared.ownerId}).ok,true);
 assert.equal((await s.backend.connect({ownerId:prepared.ownerId},guard)).ok,true);
 return prepared;
}
async function revoke(s,p,generation,guard=s.guard){
 assert.equal((await s.backend.revoke({ownerId:p.ownerId,leaseId:`lease${generation}`,generation},guard)).ok,true);
}

// Only Electron's window boundary is doubled. Epoch/capture/guard decisions
// below are the unchanged WindowRegistry implementation, not copied grants.
class InertWorkspaceWindow extends EventEmitter {
 constructor(){
  super();this.id=99;this.destroyed=false;this.webContents=new EventEmitter();
  Object.assign(this.webContents,{id:1099,destroyed:false,mainFrame:{url:'siren://app/app.html'},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.webContents.destroyed});
 }
 isDestroyed(){return this.destroyed;}
 isMinimized(){return false;}
 focus(){}
 destroy(){this.destroyed=true;this.webContents.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}
}
async function workspaceAtEpoch4(){
 const access={projectId:'project1',mode:'normal',access:'write',entityIds:[]};
 const state={unlocked:true,transition:false,generation:0};
 const registry=new WindowRegistry({authorize:()=>access,createWindow:()=>{throw Error('NO_SATELLITE_FACTORY_IN_THIS_TEST');},closeTimeoutMs:20});
 const window=new InertWorkspaceWindow();registry.bindWorkspace(window);
 for(let epoch=2;epoch<=4;epoch++)assert.equal(await registry.invalidateEpochAsync({preserveWorkspace:true}),epoch);
 const capture=()=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
 registry.activateWorkspace();const grant=capture();assert.equal(grant.epoch,4);assert.equal(grant.role,'workspace');
 return {registry,window,access,state,capture,grant};
}
function registryGuard(h,grant,packet=null){
 const admitted=h.registry.captureAdmissionGuard(grant),generation=h.state.generation;
 assert(admitted,'test requires a genuine captured current workspace grant');
 let revoked=false;
 return Object.freeze({isCurrent:()=>{
  if(revoked)return false;
  if(!h.state.unlocked||h.state.transition||h.state.generation!==generation||!admitted.isCurrent()||!h.registry.isCurrent(grant)||grant.projectId!=='project1'||packet&&(packet.windowId!==grant.windowId||packet.epoch!==grant.epoch))revoked=true;
  return !revoked;
 }});
}

test('real workspace grant epoch 4 to 5 resumes the same production Session after Lock without rewriting startup',async()=>{
 const h=await workspaceAtEpoch4(),s=createInertProductionComposition();
 try{
  assert.equal(h.registry.isCurrent({...h.grant}),false,'copied fields are not registry authority');
  const config=inertConfig();assert.equal(config.admissionEpoch,h.grant.epoch);
  const p=await ready(s,config,registryGuard(h,h.grant)),startup=creatorStartup(s),spawn=s.state.spawns[0];
  const first=lease(p.ownerId,h.grant.epoch,1,'lease1',h.grant.windowId),firstGuard=registryGuard(h,h.grant,first);
  assert.equal((await s.backend.install(first,firstGuard)).ok,true);
  assert.equal((await s.backend.input(input(p.ownerId,1,'before lock'),firstGuard)).accepted,true);
  h.state.generation++;h.state.transition=true;h.state.unlocked=false;
  const closing=s.backend.sendGate({generation:2,open:false});
  assert.equal((await s.backend.input(input(p.ownerId,1,'stale locked input'),firstGuard)).accepted,false);
  h.access.mode='locked';assert.equal(await h.registry.invalidateEpochAsync({preserveWorkspace:true}),5);
  assert.equal(h.registry.isCurrent(h.grant),false);assert.equal(firstGuard.isCurrent(),false);
  assert.equal((await closing).ok,true);assert.equal(count(s,'native-stop'),0);
  s.emitOutput('session1','inert background work completes while locked\r\n');
  assert.match((await s.backend.readHistory({ownerId:p.ownerId,fromSequence:0,maxBytes:32768})).chunk.data,/background work completes/);
  h.access.mode='normal';h.state.unlocked=true;h.state.transition=false;h.registry.activateWorkspace();
  const fresh=h.capture();assert.equal(fresh.epoch,5);assert.notEqual(fresh.windowId,h.grant.windowId);
  const next=lease(p.ownerId,fresh.epoch,2,'lease2',fresh.windowId),nextGuard=registryGuard(h,fresh,next);
  const mismatched=registryGuard(h,fresh,{...next,epoch:4});assert.equal(mismatched.isCurrent(),false);
  assert.equal((await s.backend.sendGate({generation:3,open:true})).ok,true);
  assert.equal((await s.backend.install(next,nextGuard)).ok,true,'fresh grant-derived epoch 5 must attach to the surviving startup-epoch-4 Session');
  assert.equal((await s.backend.input(input(p.ownerId,1,'old lease after unlock'),firstGuard)).accepted,false);
  assert.equal((await s.backend.input(input(p.ownerId,2,'after unlock'),nextGuard)).accepted,true);
  assert.deepEqual(s.state.writes,['before lock','after unlock']);assert.equal(s.state.spawns.length,1);assert.equal(s.state.loads,1);
  assert.equal(s.state.spawns[0],spawn);assert.equal(config.admissionEpoch,4);assert.deepEqual(creatorStartup(s),startup);
  assert.equal(creatorStartup(s).spawnAttempts,1);assert.equal(count(s,'native-stop'),0);
  assert.equal(s.ownership.assertSessionCurrent({sessionOwnerId:p.ownerId}),true);
  assert.equal(h.window.isDestroyed(),false);assert.equal(s.backend.nativeExecutionAdmitted,false);
 }finally{await s.dispose();}
});

test('pure lease inputs: equal epoch permits only strictly newer lease generations after revoke',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);assert.equal((await s.backend.install(lease(p.ownerId),s.guard)).ok,true);await revoke(s,p,1);
  assert.equal((await s.backend.install(lease(p.ownerId,4,1),s.guard)).ok,false);
  assert.equal(creatorCommands(s).lastLeaseGeneration,1);
  assert.equal((await s.backend.install(lease(p.ownerId,4,2),s.guard)).ok,true);await revoke(s,p,2);
  assert.equal((await s.backend.install(lease(p.ownerId,4,2),s.guard)).ok,false);
  assert.equal((await s.backend.install(lease(p.ownerId,4,1),s.guard)).ok,false);
  assert.equal(creatorCommands(s).lastLeaseGeneration,2);
  assert.equal((await s.backend.install(lease(p.ownerId,4,3),s.guard)).ok,true);
  assert.equal((await s.backend.input(input(p.ownerId,3,'same epoch replacement'),s.guard)).accepted,true);
  assert.deepEqual(s.state.writes,['same epoch replacement']);assert.equal(s.state.spawns.length,1);assert.equal(count(s,'native-stop'),0);
 }finally{await s.dispose();}
});

test('pure lease inputs: dispatched epoch advancement persists and lower epoch cannot win with a larger generation',async()=>{
 const s=createInertProductionComposition();try{
  const config=inertConfig(),p=await ready(s,config),startup=creatorStartup(s);
  assert.equal((await s.backend.install(lease(p.ownerId,4,1),s.guard)).ok,true);await revoke(s,p,1);
  assert.equal((await s.backend.install(lease(p.ownerId,5,2),s.guard)).ok,true,'authorized new epoch must advance the retained lease floor');await revoke(s,p,2);
  assert.equal((await s.backend.install(lease(p.ownerId,4,99),s.guard)).ok,false,'greater lease generation cannot lower epoch authority');
  assert.equal(creatorCommands(s).lastLeaseGeneration,2,'refused lower epoch must not dispatch or consume generation 99');
  assert.equal((await s.backend.install(lease(p.ownerId,5,3),s.guard)).ok,true);await revoke(s,p,3);
  assert.equal((await s.backend.install(lease(p.ownerId,5,3),s.guard)).ok,false);
  assert.equal((await s.backend.install(lease(p.ownerId,5,2),s.guard)).ok,false);
  assert.equal((await s.backend.install(lease(p.ownerId,5,4),s.guard)).ok,true);
  assert.equal((await s.backend.input(input(p.ownerId,4,'advanced epoch'),s.guard)).accepted,true);
  assert.deepEqual(s.state.writes,['advanced epoch']);assert.equal(config.admissionEpoch,4);assert.deepEqual(creatorStartup(s),startup);
  assert.equal(s.state.spawns.length,1);assert.equal(count(s,'native-stop'),0);
 }finally{await s.dispose();}
});

test('pure lease inputs: a newer epoch with repeated or older generation refuses without consuming that epoch',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);assert.equal((await s.backend.install(lease(p.ownerId,4,2),s.guard)).ok,true);await revoke(s,p,2);
  assert.equal((await s.backend.install(lease(p.ownerId,5,2),s.guard)).ok,false);
  assert.equal((await s.backend.install(lease(p.ownerId,5,1),s.guard)).ok,false);
  assert.equal(creatorCommands(s).lastLeaseGeneration,2);
  assert.equal((await s.backend.install(lease(p.ownerId,4,3),s.guard)).ok,true,'undispatched invalid generation must not advance the epoch floor');
  assert.equal((await s.backend.input(input(p.ownerId,3,'retained epoch four'),s.guard)).accepted,true);
  assert.deepEqual(s.state.writes,['retained epoch four']);assert.equal(count(s,'native-stop'),0);
 }finally{await s.dispose();}
});

test('final install guard reentering Lock cannot consume generation or retire a Session before dispatch',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s),startup=creatorStartup(s);let calls=0,closing,nested;
  const reentrant=Object.freeze({isCurrent:()=>{
   calls++;nested=s.backend.install(lease(p.ownerId,4,8),s.guard);
   closing=s.backend.sendGate({generation:2,open:false});return true;
  }});
  assert.equal((await s.backend.install(lease(p.ownerId,4,7),reentrant)).ok,false);
  assert.equal(calls,1);assert.equal((await nested).ok,false,'busy reservation must precede final external guard');
  assert.equal((await closing).ok,true);await inertTick();await inertTick();
  assert.equal(creatorCommands(s).lastLeaseGeneration,0,'neither reentrant candidate may reach actual creator install');assert.deepEqual(s.state.writes,[]);
  assert.equal(count(s,'native-stop'),0,'a known local pre-dispatch Lock refusal must preserve existing work');
  assert.equal(s.backend.stats().ready,1);assert.deepEqual(creatorStartup(s),startup);assert.equal(s.state.spawns.length,1);
  assert.equal((await s.backend.sendGate({generation:3,open:true})).ok,true);
  assert.equal((await s.backend.install(lease(p.ownerId,4,1),s.guard)).ok,true,'undispatched generation 7 must remain unconsumed');
  assert.equal((await s.backend.input(input(p.ownerId,1,'fresh after refused reentrant install'),s.guard)).accepted,true);
  assert.deepEqual(s.state.writes,['fresh after refused reentrant install']);assert.equal(s.state.spawns.length,1);
 }finally{await s.dispose();}
});

test('final stale guard for higher epoch cannot consume epoch or generation before dispatch',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s),startup=creatorStartup(s);let calls=0;
  const stale=Object.freeze({isCurrent:()=>{calls++;return false;}});
  assert.equal((await s.backend.install(lease(p.ownerId,5,7),stale)).ok,false);
  assert.equal(calls,1,'otherwise-valid newer epoch must reach final guard before any epoch/generation consumption');
  assert.equal(creatorCommands(s).lastLeaseGeneration,0);assert.equal(count(s,'native-stop'),0);assert.deepEqual(s.state.writes,[]);
  assert.equal((await s.backend.install(lease(p.ownerId,4,1),s.guard)).ok,true,'undispatched epoch 5 and generation 7 must leave startup floor 4 and generation 1 usable');
  assert.equal((await s.backend.input(input(p.ownerId,1,'fresh after stale higher epoch'),s.guard)).accepted,true);
  assert.deepEqual(s.state.writes,['fresh after stale higher epoch']);assert.deepEqual(creatorStartup(s),startup);assert.equal(s.state.spawns.length,1);
 }finally{await s.dispose();}
});
