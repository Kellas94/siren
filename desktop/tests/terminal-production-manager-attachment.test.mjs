import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';

test('actual TerminalPolicy workspace Attach refuses SENDER_REFUSED with zero new lease/history/backend effects',async()=>{
 const h=privateManager({realPolicy:true});try{const session=await h.ready(),before={...h.calls};const r=await h.attach(session);
  assert.equal(r.code,'SENDER_REFUSED');for(const name of ['install','revoke','input','resize','readHistory'])assert.equal(h.calls[name]??0,before[name]??0);
  assert.equal(h.manager.stats().publishedAttachments,0);assert.equal(h.manager.stats().pendingAttachments,0);assert.equal(h.composition.state.writes.length,0);
 }finally{await h.end();}
});
test('synthetic role-neutral policy attaches actual composed backend after one credited prefetch and reports observed bounds',async()=>{
 const h=privateManager();try{const session=await h.ready(),r=await h.attach(session);assert.equal(r.ok,true);assert.equal(r.value.firstSequence,0);assert.equal(r.value.nextSequence,7);
  assert.equal(h.calls.readHistory,1);assert.equal(h.calls.install,1);assert.equal(h.manager.stats().publishedAttachments,1);assert.equal(h.composition.group(session.sessionId).creator.stats().session.commands.leased,true);
  assert.equal(h.manager.list(h.grant,{operationId:'list1',epoch:h.grant.epoch}).value[0].attachedWindowId,h.grant.windowId);assert.equal(h.manager.nativeExecutionAdmitted,false);
 }finally{await h.end();}
});
test('replacement revokes old actual lease before new install and refuses old tokens without respawn',async()=>{
 const h=privateManager();try{const session=await h.ready(),first=(await h.attach(session)).value,second=await h.attach(session);assert.equal(second.ok,true);assert.ok(second.value.generation>first.generation);
  assert.equal(h.calls.revoke,1);assert.equal(h.calls.install,2);assert.equal((await h.input(first)).ok,false);assert.equal((await h.input(second.value)).ok,true);assert.equal(h.composition.state.spawns.length,1);
 }finally{await h.end();}
});
test('detach fences immediately, waits actual revoke, and never makes shell Stop',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;h.composition.holdWrite('creator','command');const pending=h.detach(lease);
  assert.equal(h.manager.stats().publishedAttachments,0);assert.equal((await h.input(lease)).ok,false);h.composition.releaseWrites();assert.equal((await pending).ok,true);assert.equal(h.calls.revoke,1);assert.equal(h.calls.stopSession??0,0);
 }finally{await h.end();}
});
test('actual accepted install with stale final guard retains uncertain remote lease despite backend local refusal',async()=>{
 let checks=0;const h=privateManager({wrap:{install:({args,invoke,h})=>invoke([args[0],{isCurrent:()=>{if(++checks===2)h.access.transition=true;return args[1].isCurrent();}}])}});
 try{const session=await h.ready(),r=await h.attach(session);assert.equal(r.ok,false);assert.equal(h.manager.stats().uncertainAttachments,1);assert.equal(h.composition.group(session.sessionId).creator.stats().session.commands.leased,true);
  h.access.transition=false;assert.equal((await h.attach(session)).ok,false);assert.equal(h.calls.install,1);
  assert.equal((await h.manager.closeInput('resolve uncertain install')).ok,true);assert.equal(h.manager.stats().uncertainAttachments,0);assert.equal(h.composition.group(session.sessionId).creator.stats().session.commands.leased,false);
  assert.equal((await h.manager.resumeInput()).ok,true);checks=0;h.access.transition=false;
 }finally{await h.end();}
});
test('failed actual revoke retains remote uncertainty until a current newer CLOSE acknowledgement',async()=>{
 let refuse=true;const h=privateManager({wrap:{revoke:({args,invoke})=>invoke([args[0],refuse?{isCurrent:()=>false}:args[1]])}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.detach(lease)).ok,false);assert.equal(h.manager.stats().uncertainAttachments,1);
  assert.equal(h.composition.group(session.sessionId).creator.stats().session.commands.leased,true);assert.equal((await h.attach(session)).ok,false);
  await h.manager.closeInput('revoke recovery');assert.equal(h.manager.stats().uncertainAttachments,0);refuse=false;await h.manager.resumeInput();assert.equal((await h.attach(session)).ok,true);
 }finally{await h.end();}
});
test('Lock generation advances and fences all local attachment authority before any awaited CLOSE',async()=>{
 const hold=deferred();let closed=false;const h=privateManager({wrap:{sendGate:({args,invoke})=>{const actual=invoke();return !args[0].open&&closed?actual.then(v=>hold.promise.then(()=>v)):actual;}}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,before=h.manager.stats().accessGeneration;closed=true;const closing=h.manager.closeInput('early lock');
  assert.ok(h.manager.stats().accessGeneration>before);assert.equal(h.manager.stats().publishedAttachments,0);assert.equal(h.registry.isCurrent(h.grant),true);assert.equal(h.access.unlocked,true);assert.equal((await h.input(lease)).ok,false);assert.equal(h.composition.state.writes.length,0);
  hold.resolve();await closing;await h.manager.resumeInput();assert.equal((await h.input(lease)).ok,false);assert.equal((await h.attach(session)).ok,true);
 }finally{hold.resolve();await h.end();}
});
test('fresh actual registry epoch attaches same surviving shell while old captured grant stays refused',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,old=h.grant;await h.manager.closeInput('epoch lock');h.registry.invalidateEpoch({preserveWorkspace:true});h.registry.activateWorkspace();h.refresh();assert.ok(h.grant.epoch>old.epoch);await h.manager.resumeInput();
  const fresh=await h.attach(session);assert.equal(fresh.ok,true);assert.equal((await h.input(lease,0,'old',old)).ok,false);assert.equal((await h.input(fresh.value,0,'fresh')).ok,true);assert.equal(h.composition.state.spawns.length,1);
 }finally{await h.end();}
});
test('prefetch timeout retains actual pending reader through Stop until settlement',async()=>{
 const hold=deferred();const h=privateManager({deadlineMs:25,wrap:{readHistory:({invoke})=>invoke().then(v=>hold.promise.then(()=>v))}});
 try{const session=await h.ready();assert.equal((await h.attach(session)).ok,false);assert.ok(h.manager.stats().pendingOperations>0);await h.manager.stop(h.grant,h.packet(session.sessionId));assert.equal(h.manager.stats().reservedSessions,1);
  hold.resolve();await until(()=>h.manager.stats().pendingOperations===0,'actual history settlement');await h.manager.reconcile();assert.equal(h.manager.stats().reservedSessions,0);
 }finally{hold.resolve();await h.end();}
});
test('reentrant attachment from private policy sees transition reserved before callback',async()=>{
 let nested,enter=false;const h=privateManager({onPolicy:(q,h)=>{if(enter&&q.method==='terminalAttach'&&!nested){enter=false;nested=h.attach({sessionId:q.session.sessionId});}}});
 try{const session=await h.ready();enter=true;const r=await h.attach(session);assert.equal(r.ok,true);assert.equal((await nested).ok,false);assert.equal(h.calls.install,1);assert.equal(h.calls.readHistory,1);
 }finally{await h.end();}
});

test('late rejected install continuation cannot recreate uncertainty cleared by a newer actual CLOSE',async()=>{
 const hold=deferred();let installReply;const h=privateManager({wrap:{install:({invoke})=>invoke().then(v=>{installReply=v;return hold.promise.then(()=>v);})}});
 try{const session=await h.ready(),attaching=h.attach(session);await until(()=>installReply?.ok===true,'actual accepted install before held result');assert.equal(h.manager.stats().uncertainAttachments,1);
  const closed=await h.manager.closeInput('CLOSE during delayed install');assert.equal(closed.ok,true);assert.equal(h.manager.stats().uncertainAttachments,0);hold.resolve();assert.equal((await attaching).ok,false);assert.equal(h.manager.stats().uncertainAttachments,0);await h.manager.resumeInput();assert.equal((await h.attach(session)).ok,true);
 }finally{hold.resolve();await h.end();}
});
test('malformed successful install/revoke DTO cannot clear retained remote uncertainty',async()=>{
 for(const operation of ['install','revoke']){
  const h=privateManager({wrap:{[operation]:({invoke})=>invoke().then(()=>({ok:true}))}});
  try{const session=await h.ready();if(operation==='install')assert.equal((await h.attach(session)).ok,false);else{const lease=(await h.attach(session)).value;assert.equal((await h.detach(lease)).ok,false);}
   assert.equal(h.manager.stats().uncertainAttachments,1);assert.equal((await h.attach(session)).ok,false);await h.manager.closeInput('actual aggregate proof');assert.equal(h.manager.stats().uncertainAttachments,0);
  }finally{await h.end();}
 }
});
test('Stop keeps an actual input continuation and scope ticket despite verified owner exit',async()=>{
 const hold=deferred();const h=privateManager({deadlineMs:20,wrap:{input:({invoke})=>invoke().then(v=>hold.promise.then(()=>v))}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,input=h.input(lease);await until(()=>h.composition.state.writes.length===1,'actual input before Stop');await h.manager.stop(h.grant,h.packet(session.sessionId));assert.equal(h.manager.stats().reservedSessions,1);assert.equal(h.manager.stats().inputScopeTickets,1);await input;hold.resolve();await until(()=>h.manager.stats().pendingCommands===0,'actual command continuation');await h.manager.reconcile();assert.equal(h.manager.stats().reservedSessions,0);
 }finally{hold.resolve();await h.end();}
});

test('a fulfilled substitute or timer cannot refund unobservable effectful install work',async()=>{
 for(const kind of ['thenable','throw','subclass']){
  let effects=0;class AlienPromise extends Promise{};const h=privateManager({deadlineMs:15,wrap:{install:()=>{effects++;if(kind==='throw')throw Error('effect then throw');return kind==='subclass'?AlienPromise.resolve({ok:true}):{then:resolve=>resolve({ok:true})};}}});
  try{const session=await h.ready();assert.equal((await h.attach(session)).ok,false);assert.equal(effects,1);assert.equal(h.manager.stats().pendingCommands,1);assert.equal(h.manager.stats().quarantinedOperations,1);await h.manager.closeInput('CLOSE clears remote uncertainty only');assert.equal(h.manager.stats().pendingCommands,1);assert.equal(h.manager.stats().uncertainAttachments,0);await h.manager.resumeInput();assert.equal((await h.attach(session)).ok,false);assert.equal(effects,1);
  }finally{await h.end();}
 }
});
