import test from 'node:test';import assert from 'node:assert/strict';
import {mainTerminalRollbackFixture as fixture,until} from './helpers/main-terminal-rollback-fixture.mjs';
test('actual MAIN PIN prepare quiescence is restored before leaveTransition after retire refusal',async()=>{
 const f=await fixture({useActualPinHooks:true,originalPinHooks:process.env.SIREN_ROLLBACK_PIN_ORIGINAL==='1'});let retiredUnderQuiescence=false;try{
  f.context.prepareNativeWorkspace=async()=>{f.calls.prepare++;await f.runtime.prepareTransition();};
  f.context.retireNativeViews=async()=>{retiredUnderQuiescence=f.context.accountQuiesced===true&&f.context.pinTransition===true;throw Object.assign(Error('owned retirement refusal'),{code:'WINDOW_DESTROY_FAILED'});};
  const pending=f.runtime.pinLifecycle.lockPin().then(value=>({value}),error=>({error}));
  await until(()=>f.calls.rollback>0);assert.equal(retiredUnderQuiescence,true,'actual prepare hook entered quiescence before actual retire hook');
  assert.equal(f.context.accountQuiesced,false,'rollback restores native scope while PIN still owns reservation');assert.equal(f.context.pinTransition,true);
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);assert.equal(f.runtime.snapshot().available,false);
  f.held.resolve();const result=await pending;assert.equal(result.error,undefined,'PIN service observes completed rollback');assert.equal(result.value.ok,false);
  assert.equal(f.context.pinTransition,false);assert.equal(f.context.accountQuiesced,false);assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,false);
  assert.equal(f.calls.rollback,2,'outer PIN restoration and existing OPEN callback recurse once, no second OPEN');
  assert.equal(f.s.composition.state.trace.filter(x=>x.name==='native-stop').length,0);
 }finally{await f.finish();}
});
test('configured but unlaunched candidate in Recovery needs no strict normal-mode rollback scope',async()=>{
 const f=await fixture({launch:false,holdRollback:false});try{
  f.context.mode='recovery';assert.equal(f.runtime.snapshot().project,null);assert.equal(f.actual(),null);
  const result=await f.context.login();assert.equal(result.code,'OWNED_ACCOUNT_REFUSAL');assert.equal(f.context.accountTransition,false);assert.equal(f.calls.rollback,0);assert.equal(f.actual(),null);
 }finally{await f.finish();}
});
async function caller(f){
 await f.s.registry.openView({role:'terminal',entityId:'terminal1'});const view=f.s.windows.at(-1),event={sender:view.webContents,senderFrame:view.webContents.mainFrame};let sequence=0;
 const invoke=(method,payload)=>f.handlers.get('siren:terminal')(event,method,{operationId:'main_followup_'+ ++sequence,epoch:f.s.registry.capture(event)?.epoch??1,...payload});
 return{event,invoke};
}
test('actual MAIN Close rollback preserves running-session output and denies old lease without Stop',async()=>{
 const f=await fixture();try{
  const c=await caller(f),picked=await c.invoke('terminalPickCwd',{});assert.equal(picked.ok,true);
  const made=await c.invoke('terminalCreate',{cwdId:picked.value.cwdId,profileId:'powershell',cols:120,rows:40});assert.equal(made.ok,true);
  const sessionId=made.value.sessionId,attached=await c.invoke('terminalAttach',{sessionId});assert.equal(attached.ok,true);
  const lease={sessionId,leaseId:attached.value.leaseId,generation:attached.value.generation};
  assert.equal((await c.invoke('terminalInput',{...lease,inputSequence:0,data:'ACCEPTED BEFORE CLOSE\r'})).ok,true);
  f.s.main.close();await until(()=>f.calls.rollback===1);f.s.composition.emitOutput(sessionId,'OWNED OUTPUT WHILE CLOSED');
  for(const [method,payload] of [['terminalInput',{...lease,inputSequence:1,data:'REFUSED\r'}],['terminalResize',{...lease,cols:130,rows:45}],['terminalCreate',{cwdId:picked.value.cwdId,profileId:'powershell',cols:120,rows:40}]])assert.equal((await c.invoke(method,payload)).ok,false,method);
  assert.deepEqual(f.s.composition.state.writes,['ACCEPTED BEFORE CLOSE\r']);assert.deepEqual(f.s.composition.state.resizes,[]);
  assert.equal(f.s.composition.state.trace.filter(x=>x.name==='native-stop').length,0);
  f.held.resolve();await until(()=>!f.context.pinTransition);const fresh=await caller(f),reattached=await fresh.invoke('terminalAttach',{sessionId});assert.equal(reattached.ok,true);assert.notEqual(reattached.value.leaseId,lease.leaseId);
  assert.equal((await fresh.invoke('terminalInput',{...lease,inputSequence:1,data:'OLD LEASE\r'})).ok,false);
  const authority=f.actual().mainAuthorities(),grant=authority.access.currentRouter().captureDesktopCaller(fresh.event),seen=[];
  const result=await authority.manager.deliverAvailable(grant,{operationId:'main_followup_deliver',epoch:grant.epoch,sessionId,leaseId:reattached.value.leaseId,generation:reattached.value.generation},frame=>{seen.push(frame);});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(seen.at(-1).chunk.data,'OWNED OUTPUT WHILE CLOSED');assert.equal(f.s.composition.state.spawns.length,1);
  assert.equal(f.s.composition.state.trace.filter(x=>x.name==='native-stop').length,0);
 }finally{await f.finish();}
});
