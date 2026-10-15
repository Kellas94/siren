import test from 'node:test';
import assert from 'node:assert/strict';
import {mainTerminalRollbackFixture as fixture,until} from './helpers/main-terminal-rollback-fixture.mjs';
async function pendingClose(f){f.s.main.close();await until(()=>f.calls.rollback>0||f.calls.dialogs.length>0,'Close reached rollback or refusal');assert.equal(f.calls.rollback,1,'held MAIN reservation must reach actual rollback OPEN');}
test('MC3 Close holds MAIN reservation during actual rollback; account/new close cannot enter',async()=>{
 const f=await fixture();try{
  await pendingClose(f);assert.equal(f.context.pinTransition,true);assert.equal(f.closeRequested(),true);
  assert.equal((await f.context.login()).code,'ACCOUNT_BUSY');f.s.main.close();assert.equal(f.calls.prepare,1);
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);assert.equal(f.runtime.snapshot().available,false);
  f.held.resolve();await until(()=>!f.context.pinTransition);assert.equal(f.closeRequested(),false);
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,false);assert.equal(f.calls.rollback,1,'recursive PIN rollback must not start a second OPEN');
  assert(f.calls.activations.some(r=>r.pin&&r.inputClosed===false&&!r.publicReady),'activation occurs under reservation after OPEN');
 }finally{await f.finish();}
});
test('MC4 failed account beforeCommit restores OPEN before releasing account transition and renderer-end',async()=>{
 const f=await fixture();try{
  f.state.holdRendererEnd=true;f.context.account.beginLogin=async({beforeCommit})=>{await beforeCommit();return{ok:true};};
  const result=f.context.login().then(value=>({value}),error=>({error}));
  await until(()=>f.calls.rollback>0||f.calls.rendererEnd>0||!f.context.accountTransition);assert.equal(f.calls.rollback,1,'owned account reservation must reach actual rollback OPEN');
  assert.equal(f.context.accountTransition,true);f.held.resolve();await until(()=>!f.actual().mainAuthorities().manager.stats().inputClosed);
  assert.equal(f.context.accountTransition,true);assert.equal(f.runtime.snapshot().available,false);assert.equal((await f.context.login()).code,'ACCOUNT_BUSY');
  f.rendererEnd.resolve();assert.match((await result).error?.message??'',/owned save refusal/);assert.equal(f.context.accountTransition,false);assert.equal(f.runtime.snapshot().available,true);
 }finally{await f.finish();}
});
test('actual rollback rejection is observed by Close; no activation and MAIN reservation reliably releases',async()=>{
 const f=await fixture({rejectRollback:true});try{
  f.s.main.close();await until(()=>f.calls.dialogs.length>0);assert.equal(f.calls.rollback,1);
  assert.equal(f.context.pinTransition,false);assert.equal(f.closeRequested(),false);assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);
  assert(!f.calls.activations.some(r=>r.inputClosed===false),'failed rollback must not reactivate workspace');
 }finally{await f.finish();}
});
for(const drift of ['selection-generation','snapshot','project','lock','mode','readonly','account-quiesced','selection-quiesced','frame','native-admission','native-failure','competing-owner'])test('held actual MAIN rollback scope rejects '+drift+' drift',async()=>{
 const f=await fixture();const savedFrame=f.s.main.webContents.mainFrame;let roster;try{
  await pendingClose(f);
  if(drift==='selection-generation')f.context.bootstrap.selectionGeneration++;
  if(drift==='snapshot')f.context.snapshot={sourceRefs:[]};
  if(drift==='project')f.context.selectedId='project2';
  if(drift==='lock')f.state.pin=false;
  if(drift==='mode')f.context.mode='recovery';
  if(drift==='readonly')f.context.nativeReadonly=true;
  if(drift==='account-quiesced')f.context.accountQuiesced=true;
  if(drift==='selection-quiesced')f.context.writes.selectionQuiesced=true;
  if(drift==='frame')f.s.main.webContents.mainFrame={url:'siren://app/app.html'};
  if(drift==='native-admission')roster=f.s.registry.freezeRoster();
  if(drift==='native-failure')f.context.nativeShellFailure=true;
  if(drift==='competing-owner')f.context.accountTransition=true;
  f.held.resolve();await until(()=>f.calls.dialogs.length>0&&f.actual().mainAuthorities().access.stats().retainedWorkers===0);
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);assert.equal(f.calls.rollback,1);
  assert(!f.calls.activations.some(r=>r.inputClosed===false),'stale rollback cannot reactivate workspace');
 }finally{if(roster)f.s.registry.releaseRoster(roster);f.s.main.webContents.mainFrame=savedFrame;await f.finish();}
});
test('actual opaque MAIN token is foreign-resistant, one-use at candidate and retired after helper completion',async()=>{
 const f=await fixture({holdRollback:false});try{
  await f.runtime.prepareTransition();f.context.pinTransition=true;
  const token=f.context.captureScope();assert(token&&typeof token==='object','MAIN creates actual opaque scope');
  f.context.workspaceBarrier.dispose();f.context.workspaceBarrier=null;f.context.bindScope(token);
  assert.equal(f.context.scopeCurrent(token),true);assert.equal(f.context.scopeCurrent(Object.freeze({})),false);
  await assert.rejects(f.runtime.rollbackTransition(Object.freeze({})));
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);
  await f.runtime.rollbackTransition(token);assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,false);
  await f.runtime.prepareTransition();await assert.rejects(f.runtime.rollbackTransition(token),'same opaque token cannot dispatch another OPEN');
  assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true);f.context.retireScope(token);assert.equal(f.context.scopeCurrent(token),false);
 }finally{await f.finish();}
});
test('same-owner reentrant MAIN rollback cannot borrow active attempt or create another OPEN',async()=>{
 const f=await fixture();try{
  await pendingClose(f);assert.equal(f.calls.rollback,1);
  await assert.rejects(f.context.rollback(),'foreign reentry during active rollback is refused');
  assert.equal(f.calls.rollback,1);f.held.resolve();await until(()=>!f.context.pinTransition);assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,false);
  const token=f.calls.tokens.find(x=>x&&typeof x==='object');assert(token);assert.equal(f.context.scopeCurrent(token),false,'completed helper retires its exact token');
 }finally{await f.finish();}
});
test('no-runtime failed Close retains ordinary recovery/refusal behavior',async()=>{
 const f=await fixture({enabled:false});try{f.s.main.close();await until(()=>f.calls.dialogs.length>0);assert.equal(f.context.pinTransition,false);assert.equal(f.closeRequested(),false);assert.equal(f.calls.rollback,0);}finally{await f.finish();}
});
test('scope capture precedes resumed editor callbacks and rejects selection change from resume',async()=>{
 const f=await fixture({holdRollback:false});let changed=false;try{
  f.state.onEditorResume=()=>{if(!changed){changed=true;f.context.bootstrap.selectionGeneration++;}};
  f.s.main.close();await until(()=>f.calls.dialogs.length>0&&f.actual().mainAuthorities().access.stats().retainedWorkers===0);
  assert.equal(changed,true);assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true,'resumed callback drift must not be recaptured as a new valid scope');
 }finally{await f.finish();}
});
test('post-OPEN scope drift starts safety CLOSE before MAIN releases reservation',async()=>{
 const f=await fixture();let changed=false;try{
  await pendingClose(f);
  f.state.onPrivateReady=()=>{const members=f.actual().mainAuthorities();if(!changed&&members.access.stats().transition===null&&!members.manager.stats().inputClosed){changed=true;f.context.bootstrap.selectionGeneration++;}};
  f.held.resolve();await until(()=>f.calls.dialogs.length>0&&f.actual().mainAuthorities().access.stats().retainedWorkers===0);
  assert.equal(changed,true,'actual final candidate check after OPEN is exercised');assert.equal(f.actual().mainAuthorities().manager.stats().inputClosed,true,'private permit expiration must not leave host input OPEN');
  assert.equal(f.s.composition.state.trace.filter(x=>x.name==='native-stop').length,0);
 }finally{await f.finish();}
});
