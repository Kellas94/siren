// Actual pure router/manager composition with inert ownership and shell providers.
// No Electron/native/PTY/shell execution; fake native identity is not admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalRequestRouter} from '../src/terminal/request-router.mjs';
import {TerminalManager} from '../src/terminal/manager.mjs';
import {TerminalPolicy} from '../src/terminal/policy.mjs';
const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(write){
 const ws={},term={},wf={},tf={},captures=new WeakSet(),state={current:true,epoch:1},calls={write:[],resize:[],stop:[],gate:[]},channels=new Map(),owners=new Map();
 const registry={
  capture(e){if(!state.current||!((e.sender===ws&&e.senderFrame===wf)||(e.sender===term&&e.senderFrame===tf)))return null;
   const role=e.sender===ws?'workspace':'terminal',g=Object.freeze({windowId:role==='workspace'?'w1':'t1',projectId:'p1',epoch:state.epoch,role,webContentsId:role==='workspace'?1:2,mainFrameUrl:role==='workspace'?'siren://app/app.html':'siren://app/windows/terminal.html',entityIds:[]});captures.add(g);return g;},
  isCurrent:g=>state.current&&captures.has(g)&&g.epoch===state.epoch,
  captureAdmissionGuard(g){const epoch=state.epoch;return {isCurrent:()=>registry.isCurrent(g)&&state.epoch===epoch};}
 };
 let generation=0;
 const manager=new TerminalManager({registry,
  policy:new TerminalPolicy({isCurrentGrant:registry.isCurrent,isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true,isCurrentLease:()=>true}),
  cwdAuthority:{resolve:async()=> 'D:\\Project',pick:async()=>({cwdId:'cwd1',projectId:'p1',displayPath:'D:\\Project'}),revoke(){}},
  profilesFor:()=>({resolveShellProfile:async()=>({executable:'C:\\Windows\\powershell.exe',args:[],env:{}}),listShellProfiles:async()=>[]}),
  hostOwnerId:'host1',
  ownership:{createSession:()=>{owners.set('owner1',false);return {ok:true,sessionOwnerId:'owner1'};},watchSessionRoot:()=>({ok:true}),
   stopSession:async p=>{calls.stop.push(p);owners.set(p.sessionOwnerId,true);return {ok:true,verifiedExited:true};},stopAll:async()=>({ok:true,verifiedExited:true}),verifyExit:({ownerId})=>({identityKnown:owners.has(ownerId),verifiedExited:owners.get(ownerId)===true,remainingCount:owners.get(ownerId)?0:1})},
  atomicStarter:{prepare:async()=>({executable:'C:\\Siren\\electron.exe',entry:'C:\\Siren\\creator.mjs',directory:'D:\\Private'})},
  sessionTransport:{connect:async({sessionId})=>{channels.set(sessionId,'channel1');return {channelId:'channel1',shellProcessIdentity:{inert:true}};},isCurrentSession:(id,channel)=>channels.get(id)===channel,
   writeInput:p=>{calls.write.push(p);return write?.(p)??{accepted:true};},resize:p=>{calls.resize.push(p);return {accepted:true};}},
  inputFence:{closeInput:async reason=>{calls.gate.push(reason);return {ok:true,localInputFenced:true,hostAcknowledged:true,generation:++generation};},
   resumeInput:async()=>({ok:true,localInputFenced:false,hostAcknowledged:true,generation:++generation}),reserve:()=>({ok:true}),bind:async()=>({ok:true}),release:()=>({ok:true})}
 });
 const router=new TerminalRequestRouter({registry,manager});
 const route=(role,method,extra={})=>router.route({event:role==='workspace'?{sender:ws,senderFrame:wf}:{sender:term,senderFrame:tf},method,payload:{operationId:'op1',epoch:1,...extra}});
 const setup=async()=>{assert.equal((await manager.resumeInput()).ok,true);const made=await route('workspace','terminalCreate',{cwdId:'cwd1',profileId:'powershell',cols:80,rows:25});assert.equal(made.ok,true);
  const attached=await route('terminal','terminalAttach',{sessionId:made.value.sessionId});assert.equal(attached.ok,true);return {sessionId:made.value.sessionId,leaseId:attached.value.leaseId,generation:attached.value.generation};};
 return {manager,router,route,setup,calls,state};
}
test('fresh registry captures compose actual manager attachment input and resize without losing the native grant',async()=>{
 const f=fixture(),lease=await f.setup();
 assert.equal((await f.route('terminal','terminalInput',{...lease,inputSequence:0,data:'user input'})).ok,true);
 assert.equal((await f.route('terminal','terminalResize',{...lease,cols:120,rows:40})).ok,true);
 assert.equal(f.calls.write.length,1);assert.equal(f.calls.resize.length,1);assert.equal(f.calls.stop.length,0);
});
test('actual manager policy refuses workspace input and stale leases before any write',async()=>{
 const f=fixture(),lease=await f.setup();
 assert.equal((await f.route('workspace','terminalInput',{...lease,inputSequence:0,data:'forbidden'})).ok,false);
 assert.equal((await f.route('terminal','terminalInput',{...lease,leaseId:'foreign',inputSequence:0,data:'forbidden'})).ok,false);
 assert.equal(f.calls.write.length,0);
});
test('Lock keeps already handed-off pure transport work pending and suppresses its late result without Stop',async()=>{
 const pending=wait(),f=fixture(()=>pending.promise),lease=await f.setup();
 const result=f.route('terminal','terminalInput',{...lease,inputSequence:0,data:'already delivered'});
 assert.equal(f.calls.write.length,1);assert.equal(f.router.stats().pending,1);
 const fence=f.manager.closeInput('lock');f.router.revoke();
 assert.equal(f.router.stats().pending,1);
 assert.equal((await f.route('terminal','terminalInput',{...lease,inputSequence:1,data:'after lock'})).ok,false);
 assert.equal(f.calls.write.length,1);assert.equal(f.calls.stop.length,0);
 pending.resolve({accepted:true});assert.equal((await result).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,0);assert.equal((await fence).ok,true);
});

