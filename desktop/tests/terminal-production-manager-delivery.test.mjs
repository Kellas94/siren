import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';

test('prefetched initial bytes cannot ACK; actual private observer and opaque commit precede exact ACK',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;assert.equal(h.ack(lease,7).ok,false);assert.equal(h.manager.stats().output.outstandingUtf8Bytes,7);
  const handed=await h.deliver(lease);assert.equal(handed.ok,true);assert.equal(h.seen.length,1);assert.equal(h.seen[0].chunk.data,'AΩ😀');assert.equal(h.ack(lease,7).ok,false);
  assert.equal(h.manager.commitOutputHandoff(handed.value.handoffTicket).ok,true);assert.equal(h.ack(lease,7).ok,true);assert.equal(h.manager.stats().output.outstandingUtf8Bytes,0);assert.equal(h.calls.readHistory,1);
 }finally{await h.end();}
});
test('handoff/commit tickets require opaque identity; guessed ring end and partial frame refuse',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,handed=await h.deliver(lease),ticket=handed.value.handoffTicket;
  for(const forged of [{...ticket},Object.create(ticket),new Proxy(ticket,{})])assert.equal(h.manager.commitOutputHandoff(forged).ok,false);
  assert.equal(h.manager.commitOutputHandoff(ticket).ok,true);assert.equal(h.ack(lease,1).ok,false);assert.equal(h.ack(lease,6).ok,false);assert.equal(h.ack(lease,8).ok,false);assert.equal(h.ack(lease,7).ok,true);assert.equal(h.manager.commitOutputHandoff(ticket).ok,false);
 }finally{await h.end();}
});
test('first frame is delivered once and subsequent real output is cumulative ACKed by exact committed end',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,one=await h.deliver(lease);h.manager.commitOutputHandoff(one.value.handoffTicket);h.composition.emitOutput(session.sessionId,'tail');
  const two=await h.deliver(lease);assert.equal(two.ok,true);assert.equal(h.seen.length,2);assert.equal(h.seen[1].chunk.sequence,7);assert.equal(h.seen[1].chunk.data,'tail');h.manager.commitOutputHandoff(two.value.handoffTicket);assert.equal(h.ack(lease,11).ok,true);assert.equal(h.manager.stats().output.frames,0);assert.equal(h.manager.stats().outputHandoffTickets,0);
 }finally{await h.end();}
});
test('observer not supplied, throwing, asynchronous or nonvoid never yields a commit-able handoff',async()=>{
 for(const observer of [null,()=>{throw Error('observer failed');},()=>Promise.resolve(),()=>true]){
  const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;const r=await h.manager.deliverAvailable(h.grant,h.leasePacket(lease),observer);assert.equal(r.ok,false);assert.equal(h.ack(lease,7).ok,false);assert.equal(h.manager.stats().outputHandoffTickets,0);
  }finally{await h.end();}
 }
});
test('reentrant Lock in actual synthetic observer invalidates its handoff ticket before commit',async()=>{
 let closing;const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,r=await h.deliver(lease,frame=>{h.seen.push(frame);closing=h.manager.closeInput('observer Lock');});assert.equal(r.ok,false);assert.equal(h.seen.length,1);await closing;assert.equal(h.ack(lease,7).ok,false);assert.equal(h.manager.stats().outputHandoffTickets,0);
 }finally{await h.end();}
});
test('Lock after private handoff but before commit invalidates held opaque ticket',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,r=await h.deliver(lease);await h.manager.closeInput('after handoff');assert.equal(h.manager.commitOutputHandoff(r.value.handoffTicket).ok,false);assert.equal(h.ack(lease,7).ok,false);assert.equal(h.manager.stats().outputHandoffTickets,0);
 }finally{await h.end();}
});
test('bounded empty-history handoffs keep no frame ticket metadata',async()=>{
 const h=privateManager();try{const session=await h.ready(''),lease=(await h.attach(session)).value;for(let i=0;i<260;i++){const r=await h.deliver(lease);assert.equal(r.ok,true);assert.equal(r.value.handoffTicket,null);}assert.equal(h.manager.stats().outputHandoffTickets,0);assert.equal(h.manager.stats().output.frames,0);
 }finally{await h.end();}
});
test('one pending private read refuses concurrent delivery, retains actual reader after Lock',async()=>{
 const hold=deferred();let wait=false;const h=privateManager({wrap:{readHistory:({invoke})=>{const actual=invoke();return wait?actual.then(v=>hold.promise.then(()=>v)):actual;}}});
 try{const session=await h.ready(),lease=(await h.attach(session)).value,initial=await h.deliver(lease);h.manager.commitOutputHandoff(initial.value.handoffTicket);h.ack(lease,7);wait=true;const read=h.deliver(lease);await inertTick();assert.equal((await h.deliver(lease)).code,'CAPACITY_EXCEEDED');await h.manager.closeInput('read Lock');assert.equal((await read).ok,false);assert.ok(h.manager.stats().pendingOperations>0);assert.equal(h.seen.length,1);hold.resolve();await until(()=>h.manager.stats().pendingOperations===0,'raw read settlement');
 }finally{hold.resolve();await h.end();}
});
test('private per-session output is capped at 256 KiB and frame metadata remains bounded',async()=>{
 const h=privateManager();try{const session=await h.ready('x'.repeat(32768));for(let i=1;i<9;i++)h.composition.emitOutput(session.sessionId,'x'.repeat(32768));const lease=(await h.attach(session)).value;
  for(let i=0;i<8;i++){const r=await h.deliver(lease);assert.equal(r.ok,true);h.manager.commitOutputHandoff(r.value.handoffTicket);}assert.equal(h.manager.stats().output.outstandingUtf8Bytes,262144);assert.equal((await h.deliver(lease)).code,'CAPACITY_EXCEEDED');assert.equal(h.manager.stats().outputHandoffTickets,8);
  assert.equal(h.ack(lease,262144).ok,true);assert.equal(h.manager.stats().outputHandoffTickets,0);
 }finally{await h.end();}
});
test('stale original attachment guard suppresses observer even when new caller grant is current',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,attachGuard=h.guards.at(-1);attachGuard.current=false;const r=await h.deliver(lease);assert.equal(r.ok,false);assert.equal(h.seen.length,0);assert.equal(h.registry.isCurrent(h.grant),true);
 }finally{await h.end();}
});

test('rejected native Promise from unsupported asynchronous observer is safely observed without granting commit',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value;const r=await h.deliver(lease,()=>Promise.reject(Error('not synchronous delivery')));assert.equal(r.ok,false);await inertTick();assert.equal(h.manager.stats().outputHandoffTickets,0);assert.equal(h.ack(lease,7).ok,false);
 }finally{await h.end();}
});

test('cumulative ACK cannot skip an earlier uncommitted private handoff',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,one=await h.deliver(lease);h.composition.emitOutput(session.sessionId,'tail');const two=await h.deliver(lease);h.manager.commitOutputHandoff(two.value.handoffTicket);assert.equal(h.ack(lease,11).ok,false);assert.equal(h.manager.stats().output.outstandingUtf8Bytes,11);h.manager.commitOutputHandoff(one.value.handoffTicket);assert.equal(h.ack(lease,11).ok,true);
 }finally{await h.end();}
});
test('fresh ACK caller cannot refresh a committed handoff whose original guarded request is stale',async()=>{
 const h=privateManager();try{const session=await h.ready(),lease=(await h.attach(session)).value,one=await h.deliver(lease),original=h.guards.at(-1);h.manager.commitOutputHandoff(one.value.handoffTicket);original.current=false;assert.equal(h.ack(lease,7).ok,false);assert.equal(h.manager.stats().output.outstandingUtf8Bytes,7);
 }finally{await h.end();}
});
