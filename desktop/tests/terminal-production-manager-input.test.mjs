import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';

test('private composed input and resize use exact published lease, known outcomes and zero replay',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.input(lease,0,'print Ω😀\r')).ok,true);assert.equal((await h.input(lease,0,'print Ω😀\r')).ok,true);assert.equal((await h.resize(lease,100,35)).ok,true);
  assert.deepEqual(h.composition.state.writes,['print Ω😀\r']);assert.deepEqual(h.composition.state.resizes,[[100,35]]);assert.equal(h.calls.input,1);assert.equal(h.manager.stats().inputScopeTickets,0);
 }finally{await h.end();}
});
test('wrong lease/generation/copied captured grant refuses before actual write/resize',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;
  for(const altered of [{...lease,leaseId:'forged'},{...lease,generation:lease.generation+1}]){assert.equal((await h.input(altered)).ok,false);assert.equal((await h.resize(altered)).ok,false);}
  assert.equal((await h.input(lease,0,'clone',{...h.grant})).ok,false);assert.equal(h.calls.input??0,0);assert.equal(h.calls.resize??0,0);
 }finally{await h.end();}
});
test('queued duplicate input cannot replace its original revoked scope with a fresher scope',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;h.composition.holdWrite('creator','command');const first=h.input(lease,0,'first');await until(()=>h.composition.state.writes.length===1,'first actual write');
  const second=h.input(lease,1,'queued'),original=h.guards.at(-1);original.current=false;const duplicate=h.input(lease,1,'queued');h.composition.releaseWrites();
  assert.equal((await first).ok,true);assert.equal((await second).ok,false);assert.equal((await duplicate).ok,false);assert.deepEqual(h.composition.state.writes,['first']);assert.equal(h.calls.input,1);
 }finally{await h.end();}
});
test('accepted input ACK after request guard staleness stays known and fresh next input works',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;h.composition.holdWrite('creator','command');const first=h.input(lease,0,'accepted late'),original=h.guards.at(-1);await until(()=>h.composition.state.writes.length===1,'actual accepted write');original.current=false;h.composition.releaseWrites();
  assert.equal((await first).ok,false);assert.equal((await h.input(lease,1,'fresh next')).ok,true);assert.deepEqual(h.composition.state.writes,['accepted late','fresh next']);assert.equal(h.manager.stats().uncertainInputs,0);
 }finally{await h.end();}
});
test('actual pending input and queued requests remain bounded through Lock, fresh lease starts at zero',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;h.composition.holdWrite('creator','command');const first=h.input(lease,0,'old accepted');await until(()=>h.composition.state.writes.length===1,'accepted old');const queued=h.input(lease,1,'must not run');const closing=h.manager.closeInput('lock with input');assert.equal(h.manager.stats().publishedAttachments,0);assert.equal((await queued).ok,false);
  h.composition.releaseWrites();await closing;assert.equal((await first).ok,false);await h.manager.resumeInput();const fresh=(await h.attach(session)).value;assert.equal((await h.input(fresh,0,'new')).ok,true);assert.deepEqual(h.composition.state.writes,['old accepted','new']);
 }finally{await h.end();}
});
test('resize holds shared command slot; one ledger input waits without false refusal or overlap',async()=>{
 const hold=deferred();const h=privateManager({wrap:{resize:({invoke})=>invoke().then(v=>hold.promise.then(()=>v))}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,resizing=h.resize(lease);await until(()=>h.composition.state.resizes.length===1,'actual resize');const input=h.input(lease,0,'after resize');assert.equal(h.calls.input??0,0);assert.equal((await h.resize(lease,91,31)).code,'CAPACITY_EXCEEDED');hold.resolve();assert.equal((await resizing).ok,true);assert.equal((await input).ok,true);assert.equal(h.calls.input,1);
 }finally{hold.resolve();await h.end();}
});
test('replacement waits actual command ACK, not the public input deadline',async()=>{
 const hold=deferred();const h=privateManager({deadlineMs:25,wrap:{input:({invoke})=>invoke().then(v=>hold.promise.then(()=>v))}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,input=h.input(lease,0,'accepted');await until(()=>h.composition.state.writes.length===1,'actual input');const attaching=h.attach(session);await inertTick();assert.equal(h.calls.revoke??0,0);assert.equal((await input).ok,false);assert.equal(h.manager.stats().pendingCommands,1);hold.resolve();await attaching;await inertTick();assert.equal(h.composition.state.writes.length,1);
 }finally{hold.resolve();await h.end();}
});
test('unknown input ACK fences ambiguity without treating it as known refusal or success',async()=>{
 const h=privateManager({wrap:{input:({invoke})=>invoke().then(()=>Object.freeze({accepted:false}))}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.input(lease,0,'one known fixture write but corrupted ACK')).ok,false);assert.equal((await h.input(lease,1,'never')).ok,false);assert.equal((await h.attach(session)).ok,false);assert.equal(h.composition.state.writes.length,1);assert.equal(h.manager.stats().uncertainInputs,1);
 }finally{await h.end();}
});
test('unobservable effectful backend Promise quarantines command/work despite caller timeout',async()=>{
 const hold=deferred();let getters=0;Object.defineProperty(hold.promise,'constructor',{get(){getters++;throw Error('no species');}});
 const h=privateManager({deadlineMs:15,wrap:{input:()=>hold.promise}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.input(lease)).ok,false);assert.equal(getters,0);assert.equal(h.manager.stats().quarantinedOperations,1);assert.equal(h.manager.stats().pendingCommands,1);hold.resolve({accepted:true});await inertTick();assert.equal(h.manager.stats().pendingCommands,1);
 }finally{hold.resolve({accepted:true});await h.end();}
});
test('reentrant Lock from backend input callback blocks later commands before registry/PIN change',async()=>{
 let closing;const h=privateManager({wrap:{input:({invoke,h})=>{closing=h.manager.closeInput('input callback Lock');return invoke();}}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.input(lease)).ok,false);await closing;assert.equal(h.composition.state.writes.length,0);assert.equal(h.registry.isCurrent(h.grant),true);assert.equal(h.access.unlocked,true);
 }finally{await h.end();}
});

test('unknown resize result is fenced even if request-only guard expires before receipt',async()=>{
 const hold=deferred();const h=privateManager({wrap:{resize:({invoke})=>invoke().then(()=>hold.promise)}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,resize=h.resize(lease),original=h.guards.at(-1);await until(()=>h.composition.state.resizes.length===1,'actual resize before corrupt receipt');original.current=false;hold.resolve({accepted:false});assert.equal((await resize).ok,false);assert.equal(h.manager.stats().uncertainInputs,1);assert.equal((await h.input(lease)).ok,false);assert.equal((await h.attach(session)).ok,false);
 }finally{hold.resolve({accepted:false});await h.end();}
});
test('malformed known refusal marker for resize remains unknown and fences future input',async()=>{
 const h=privateManager({wrap:{resize:({invoke})=>invoke().then(()=>({accepted:false,knownRefused:true,extra:true}))}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.resize(lease)).ok,false);assert.equal(h.manager.stats().uncertainInputs,1);assert.equal((await h.attach(session)).ok,false);
 }finally{await h.end();}
});
test('effectful rejected resize Promise has unknown outcome and cannot leave an active lease',async()=>{
 const h=privateManager({wrap:{resize:({invoke})=>invoke().then(()=>{throw Error('lost outcome');})}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.resize(lease)).ok,false);assert.equal(h.manager.stats().uncertainInputs,1);assert.equal((await h.input(lease)).ok,false);
 }finally{await h.end();}
});

test('effect observer ignores a provider Promise own then getter and preserves its real pending input',async()=>{
 const hold=deferred();let getterCalls=0;Object.defineProperty(hold.promise,'then',{get(){getterCalls++;throw Error('shadow then');}});const h=privateManager({wrap:{input:()=>hold.promise}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,input=h.input(lease);await inertTick();assert.equal(getterCalls,0);assert.equal(h.manager.stats().pendingCommands,1);hold.resolve({accepted:true});assert.equal((await input).ok,true);assert.equal(getterCalls,0);assert.equal(h.manager.stats().pendingCommands,0);
 }finally{hold.resolve({accepted:true});await h.end();}
});
test('256 original input scope tickets share the finite ledger byte budget and cannot grow past capacity',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;h.composition.holdWrite('creator','command');const inputs=[];for(let i=0;i<256;i++)inputs.push(h.input(lease,i,'x'));assert.equal(h.manager.stats().inputScopeTickets,256);assert.equal((await h.input(lease,256,'x')).code,'CAPACITY_EXCEEDED');assert.equal(h.manager.stats().inputScopeTickets,256);
  const closing=h.manager.closeInput('finite queued scope drain');h.composition.releaseWrites();await closing;await Promise.all(inputs);assert.equal(h.manager.stats().inputScopeTickets,0);assert.ok(h.composition.state.writes.length<=1);
 }finally{await h.end();}
});

test('isCurrentLease is a pure exact retained identity observation and invokes no admission callback',async()=>{
 let exact;const h=privateManager({onPolicy:q=>{if(q.method==='terminalInput')exact=q.lease;}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,guard=h.guards.at(-1);await h.input(lease,0,'capture exact policy argument');let callbacks=0;Object.defineProperty(guard,'current',{configurable:true,get(){callbacks++;return true;}});assert.equal(h.manager.isCurrentLease(exact,h.grant,session),true);assert.equal(callbacks,0);Object.defineProperty(guard,'current',{value:true,writable:true,configurable:true});
 }finally{await h.end();}
});
test('leased final callback reentrancy cannot dispatch resize after its exact attachment was unpublished',async()=>{
 let checks=0,lease,detaching;const h=privateManager({onPolicy:(q,h)=>{if(q.method==='terminalResize'&&++checks===2){const bit=h.guards.at(-1);let fire=true;Object.defineProperty(bit,'current',{configurable:true,get(){if(fire){fire=false;detaching=h.detach(lease);}return true;}});}}});
 try{const session=await h.ready();lease=(await h.attach(session)).value;assert.equal((await h.resize(lease)).ok,false);if(detaching)await detaching;assert.equal(h.composition.state.resizes.length,0,'backend guard must recheck exact publication after its final callback');
 }finally{await h.end();}
});
