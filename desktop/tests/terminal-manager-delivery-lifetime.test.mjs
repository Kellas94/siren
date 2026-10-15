// Synthetic private JS composition; no native/PTY/installed execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';
for(const outcome of ['resolve','reject'])test('refused async output observer stays charged until actual '+outcome,async()=>{
 const hold=deferred(),h=privateManager({deadlineMs:25});try{const session=await h.ready(),lease=(await h.attach(session)).value;
  const delivery=await h.deliver(lease,()=>hold.promise);assert.equal(delivery.ok,false);assert.equal(delivery.code,'REQUEST_REFUSED');
  await h.manager.stop(h.grant,h.packet(session.sessionId));await inertTick();assert.equal(h.manager.stats().reservedSessions,1,'public refusal/Stop is not actual observer completion');
  outcome==='resolve'?hold.resolve('ignored observer result'):hold.reject(Error('observed refusal'));await until(()=>h.manager.stats().reservedSessions===0,'observer and outer delivery unwound');
 }finally{hold.resolve();await h.end();}
});
test('output delivery reserves before policy can reenter the same session',async()=>{
 let enabled=false,depth=0,maximum=0;const nested=[];
 const h=privateManager({onPolicy:(q,h)=>{if(enabled&&q.method==='terminalAck'){depth++;maximum=Math.max(maximum,depth);if(depth<10)nested.push(h.deliver(h.lease));depth--;}}});
 try{const session=await h.ready();h.lease=(await h.attach(session)).value;enabled=true;const first=await h.deliver(h.lease);enabled=false;await Promise.all(nested);assert.equal(maximum,1,'same-session delivery reentry must fail before callbacks');assert.equal(first.ok,true);assert(nested.length>0);for(const answer of await Promise.all(nested)){assert.equal(answer.ok,false);assert.equal(answer.code,'CAPACITY_EXCEEDED');}}
 finally{enabled=false;await h.end();}
});
test('unobservable output observer thenable stays charged without reading its getter',async()=>{
 let gets=0;const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;const result=await h.deliver(lease,()=>Object.defineProperty({},'then',{get(){gets++;return()=>{};}}));assert.equal(result.code,'REQUEST_REFUSED');await h.manager.stop(h.grant,h.packet(session.sessionId));await inertTick();assert.equal(gets,0);assert.equal(h.manager.stats().reservedSessions,1);}
 finally{await h.end();}
});
test('ordinary synchronous observer still commits and acknowledges actual output',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;const delivered=await h.deliver(lease);assert.equal(delivered.ok,true);assert.equal(h.manager.commitOutputHandoff(delivered.value.handoffTicket).ok,true);assert.equal((await h.ack(lease,h.seen[0].chunk.sequence+h.seen[0].chunk.utf8Bytes)).ok,true);const stopped=await h.manager.stop(h.grant,h.packet(session.sessionId));assert.equal(stopped.ok,true);await until(()=>h.manager.stats().reservedSessions===0,'idle output session cleaned');}
 finally{await h.end();}
});
test('native observer Promise own then accessor is ignored and actual settlement still drains',async()=>{
 let gets=0;const hold=deferred(),h=privateManager();Object.defineProperty(hold.promise,'then',{get(){gets++;throw Error('No property assimilation');}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.deliver(lease,()=>hold.promise)).code,'REQUEST_REFUSED');await h.manager.stop(h.grant,h.packet(session.sessionId));assert.equal(h.manager.stats().reservedSessions,1);hold.resolve();await until(()=>h.manager.stats().reservedSessions===0,'original native observer completion');assert.equal(gets,0);}
 finally{hold.resolve();await h.end();}
});
test('observer lifetime survives Lock and cannot deliver into a fresh attachment',async()=>{
 const hold=deferred(),h=privateManager();let oldCalls=0;
 try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.deliver(lease,()=>{oldCalls++;return hold.promise;})).code,'REQUEST_REFUSED');await h.manager.closeInput('synthetic Lock');assert.equal((await h.manager.resumeInput()).ok,true);const fresh=(await h.attach(session)).value;assert.equal((await h.deliver(fresh)).code,'CAPACITY_EXCEEDED');hold.resolve();await inertTick();assert.equal(oldCalls,1);assert.equal(h.manager.stats().outputHandoffTickets,0);const next=await h.deliver(fresh);assert.equal(next.ok,true);assert.equal(oldCalls,1);assert.equal(h.manager.commitOutputHandoff(next.value.handoffTicket).ok,true);}
 finally{hold.resolve();await h.end();}
});
test('invalid synchronous observer value refuses without poisoning normal cleanup',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal((await h.deliver(lease,()=>false)).code,'REQUEST_REFUSED');assert.equal((await h.manager.stop(h.grant,h.packet(session.sessionId))).ok,true);assert.equal(h.manager.stats().reservedSessions,0);}
 finally{await h.end();}
});
