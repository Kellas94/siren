import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageChannel} from 'node:worker_threads';
import {TerminalGateLink,createGateResponder} from '../src/terminal/gate-link.mjs';
import {TerminalInputFence,HostInputGate} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';

const context={projectId:'p',windowId:'view',epoch:1};
function fixture(send){
 const writes=[],ledger=new TerminalSessionLedger({writeInput:p=>{writes.push(p);return {accepted:true};}});
 ledger.register({sessionId:'s',projectId:'p',profileId:'powershell',cwdDisplay:'D:/work'});
 let handlers;const link=new TerminalGateLink({channelId:'loss_regression',send:p=>send(p,handlers),subscribe:h=>{handlers=h;return()=>{};},onUnavailable:()=>ledger.closeInput('known-channel-loss')});
 const fence=new TerminalInputFence({ledger,gateLink:link});
 return {ledger,link,fence,writes,get handlers(){return handlers;}};
}
test('same-turn ACK then channel loss cannot reopen input or issue a fresh lease',async()=>{
 const f=fixture((p,h)=>{h.message({...p,ok:true});h.closed();});
 const receipt=await f.fence.resumeInput();
 assert.equal(f.link.stats().closed,true);
 assert.equal(f.ledger.attach(context,'s').ok,false);
 assert.equal(receipt.ok,false);
 assert.equal(f.fence.snapshot().closed,true);
 assert.equal((await f.fence.resumeInput()).ok,false);
 assert.equal(f.writes.length,0);
});
test('completed open is invalidated synchronously by known channel loss',async()=>{
 const f=fixture((p,h)=>h.message({...p,ok:true}));
 assert.equal((await f.fence.resumeInput()).ok,true);
 const old=f.ledger.attach(context,'s').value;
 f.handlers.closed();
 assert.equal(f.fence.snapshot().closed,true);
 assert.equal(f.fence.snapshot().hostAcknowledged,false);
 assert.equal((await f.fence.resumeInput()).ok,false);
 assert.equal((await f.ledger.input(context,{operationId:'late',epoch:1,sessionId:'s',leaseId:old.leaseId,generation:old.generation,inputSequence:0,data:'late\r'})).ok,false);
 assert.equal(f.writes.length,0);
});
test('opaque sender without lifetime binding is refused during construction',()=>{
 assert.throws(()=>new TerminalInputFence({ledger:new TerminalSessionLedger(),sendGate:()=>({ok:true,generation:1,open:true})}),TypeError);
});
test('a channel closed during subscription can never admit a later fence',async()=>{
 const ledger=new TerminalSessionLedger();let sends=0;
 const link=new TerminalGateLink({channelId:'already_lost',send:()=>sends++,subscribe:h=>{h.closed();return()=>{};}});
 const fence=new TerminalInputFence({ledger,gateLink:link});
 assert.equal(fence.snapshot().closed,true);
 assert.equal((await fence.resumeInput()).code,'HOST_UNAVAILABLE');
 assert.equal((await fence.closeInput('lock')).code,'HOST_UNAVAILABLE');
 assert.equal(sends,0);
});
test('unavailable live status dominates pending ACK even if a transport omits its failure event',async()=>{
 let available=true,resolve,listener;
 const gateLink={isAvailable:()=>available,subscribeUnavailable:f=>{listener=f;},sendGate:p=>new Promise(r=>{resolve=()=>r({ok:true,...p});})};
 const ledger=new TerminalSessionLedger(),fence=new TerminalInputFence({ledger,gateLink});
 const opening=fence.resumeInput();available=false;resolve();
 assert.equal((await opening).ok,false);assert.equal(fence.snapshot().closed,true);
 available=true;listener();assert.equal((await fence.resumeInput()).ok,false,'A failed lifetime cannot recover in-place');
});
test('pending close settles unavailable immediately on channel loss',async()=>{
 const f=fixture(()=>{}),closing=f.fence.closeInput('lock');
 f.handlers.closed();
 assert.equal((await closing).code,'HOST_UNAVAILABLE');
 assert.equal(f.link.stats().pending,0);assert.equal(f.fence.snapshot().hostAcknowledged,false);
});
test('fresh channel requires a new fence and new lease; an old ACK cannot affect either',async()=>{
 let oldPacket;const f=fixture((p,h)=>{oldPacket=p;h.message({...p,ok:true});});
 assert.equal((await f.fence.resumeInput()).ok,true);const old=f.ledger.attach(context,'s').value;f.handlers.closed();
 let freshHandlers;const freshLink=new TerminalGateLink({channelId:'new_host_lifetime',subscribe:h=>{freshHandlers=h;return()=>{};},send:p=>freshHandlers.message({...p,ok:true})});
 const freshFence=new TerminalInputFence({ledger:f.ledger,gateLink:freshLink});
 assert.equal((await freshFence.resumeInput()).ok,true);const fresh=f.ledger.attach(context,'s').value;
 assert.notEqual(fresh.leaseId,old.leaseId);assert.ok(fresh.generation>old.generation);
 f.handlers.message({...oldPacket,ok:true});assert.equal((await f.fence.resumeInput()).ok,false);
 assert.equal(freshFence.snapshot().closed,false);assert.equal(f.ledger.snapshot()[0].attachedWindowId,'view');
 assert.equal((await f.ledger.input(context,{operationId:'old_write',epoch:1,sessionId:'s',leaseId:old.leaseId,generation:old.generation,inputSequence:0,data:'stale\r'})).code,'LEASE_STALE');
 assert.equal(f.writes.length,0);freshLink.dispose();
});
test('one input fence per channel is enforced, and a throwing external observer cannot skip invalidation',async()=>{
 let handlers;const ledger=new TerminalSessionLedger(),link=new TerminalGateLink({channelId:'observer_fault',subscribe:h=>{handlers=h;return()=>{};},send:p=>handlers.message({...p,ok:true}),onUnavailable:()=>{throw Error('observer');}});
 const fence=new TerminalInputFence({ledger,gateLink:link});assert.equal((await fence.resumeInput()).ok,true);
 assert.throws(()=>link.subscribeUnavailable(()=>{}),TypeError);
 handlers.closed();assert.equal(link.stats().failureFenceFailed,true);
 assert.equal(fence.snapshot().closed,true);assert.equal((await fence.resumeInput()).ok,false);
});
test('actual MessageChannel close invalidates completed fence success',async t=>{
 const {port1,port2}=new MessageChannel(),ledger=new TerminalSessionLedger(),gate=new HostInputGate();
 port2.on('message',createGateResponder({channelId:'actual_loss',gate,send:p=>port2.postMessage(p)}));
 const link=new TerminalGateLink({channelId:'actual_loss',send:p=>port1.postMessage(p),subscribe:h=>{port1.on('message',h.message);port1.on('close',h.closed);return()=>{port1.off('message',h.message);port1.off('close',h.closed);};},deadlineMs:1000});
 t.after(()=>{link.dispose();port1.close();port2.close();});const fence=new TerminalInputFence({ledger,gateLink:link});
 assert.equal((await fence.resumeInput()).ok,true);
 const closed=new Promise(resolve=>port1.once('close',resolve));port2.close();await closed;
 assert.equal(fence.snapshot().closed,true);assert.equal(fence.snapshot().hostAcknowledged,false);assert.equal((await fence.resumeInput()).ok,false);
});
