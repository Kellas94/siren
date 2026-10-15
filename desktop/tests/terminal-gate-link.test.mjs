import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageChannel} from 'node:worker_threads';
import {HostInputGate,TerminalInputFence} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const {TerminalGateLink,createGateResponder}=await import('../src/terminal/gate-link.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function fixture(){
 assert.equal(typeof TerminalGateLink,'function');const sent=[],timers=[],cleared=[];let handlers,unavailable=0,unsubscribed=0;
 const link=new TerminalGateLink({channelId:'host_channel1',send:p=>sent.push(p),subscribe:h=>{handlers=h;return()=>unsubscribed++;},onUnavailable:()=>unavailable++,setTimer:fn=>{timers.push(fn);return timers.length;},clearTimer:n=>cleared.push(n),deadlineMs:100});
 return{link,sent,timers,cleared,get handlers(){return handlers;},get unavailable(){return unavailable;},get unsubscribed(){return unsubscribed;},ack(index,extra={}){handlers.message({...sent[index],ok:true,...extra});}};
}

test('two-slot gate lane permits close behind open but refuses an unbounded control queue',async()=>{
 const f=fixture(),open=f.link.sendGate({generation:1,open:true}),close=f.link.sendGate({generation:2,open:false});
 assert.equal(f.link.stats().pending,2);assert.equal((await f.link.sendGate({generation:3,open:true})).ok,false);assert.equal(f.sent.length,2);
 f.ack(1);assert.deepEqual(await close,{ok:true,generation:2,open:false});assert.equal((await open).ok,false);assert.equal(f.link.stats().pending,0);
 f.ack(0);assert.equal(f.link.stats().pending,0);const fresh=f.link.sendGate({generation:3,open:true});f.ack(2);assert.equal((await fresh).ok,true);f.link.dispose();
});

test('one timeout permanently refuses the link, settles every pending request and fences native caller first',async()=>{
 const f=fixture(),a=f.link.sendGate({generation:1,open:true}),b=f.link.sendGate({generation:2,open:false});f.timers[0]();
 assert.equal(f.unavailable,1);assert.equal(f.unsubscribed,1);assert.equal(f.link.stats().closed,true);assert.equal(f.link.stats().pending,0);assert.equal((await a).ok,false);assert.equal((await b).ok,false);
 f.ack(0);assert.equal((await f.link.sendGate({generation:3,open:true})).ok,false);assert.equal(f.sent.length,2);assert.equal(f.cleared.length,2);f.link.dispose();assert.equal(f.unavailable,1);
});

test('cross-host and unknown receipts cannot acknowledge input; contradictory exact-request ACK fails closed',async()=>{
 const f=fixture(),p=f.link.sendGate({generation:1,open:true});f.ack(0,{channelId:'old_host'});f.ack(0,{requestId:999});assert.equal(f.link.stats().pending,1);
 f.ack(0,{open:false});assert.equal((await p).ok,false);assert.equal(f.unavailable,1);assert.equal(f.link.stats().closed,true);
});

test('send failure and known channel closure settle requests without automatic retries',async()=>{
 const f=fixture(),p=f.link.sendGate({generation:1,open:true});f.handlers.closed();assert.equal((await p).ok,false);assert.equal(f.unavailable,1);assert.equal(f.sent.length,1);
 let unavailable=0;const broken=new TerminalGateLink({channelId:'broken',send:()=>{throw Error('no port');},subscribe:()=>()=>{},onUnavailable:()=>unavailable++});assert.equal((await broken.sendGate({generation:1,open:true})).ok,false);assert.equal(unavailable,1);assert.equal(broken.stats().pending,0);
});

test('malformed and accessor packets never execute getters or enqueue requests',async()=>{
 const f=fixture();let reads=0;const accessor={generation:1};Object.defineProperty(accessor,'open',{enumerable:true,get(){reads++;return true;}});
 for(const r of [accessor,{generation:-1,open:true},{generation:1,open:1},{generation:1,open:true,extra:'x'}])assert.equal((await f.link.sendGate(r)).ok,false);
 assert.equal(reads,0);assert.equal(f.sent.length,0);f.link.dispose();assert.equal(f.link.nativeExecutionAdmitted,false);
});

test('responder binds one channel and refuses stale IDs/generations without reopening the host',()=>{
 assert.equal(typeof createGateResponder,'function');const gate=new HostInputGate(),replies=[],receive=createGateResponder({channelId:'host_channel1',gate,send:r=>replies.push(r)});
 const packet=(requestId,generation,open)=>({channelId:'host_channel1',requestId,generation,open});receive(packet(1,1,true));assert.equal(gate.allows(1),true);receive(packet(2,2,false));assert.equal(gate.allows(1),false);
 receive(packet(1,1,true));assert.equal(replies.at(-1).ok,false);assert.equal(gate.allows(1),false);receive({...packet(3,3,true),channelId:'foreign'});assert.equal(gate.allows(3),false);receive(packet(3,1,true));assert.equal(replies.at(-1).ok,false);assert.equal(gate.allows(1),false);
});

test('actual serialized MessageChannel carries acknowledged gates and reports port loss',async t=>{
 assert.equal(typeof TerminalGateLink,'function');const {port1,port2}=new MessageChannel(),gate=new HostInputGate();let unavailable=0;
 const receive=createGateResponder({channelId:'native_test_channel',gate,send:p=>port2.postMessage(p)});port2.on('message',receive);
 const link=new TerminalGateLink({channelId:'native_test_channel',send:p=>port1.postMessage(p),subscribe:h=>{port1.on('message',h.message);port1.on('close',h.closed);return()=>{port1.off('message',h.message);port1.off('close',h.closed);};},onUnavailable:()=>unavailable++,deadlineMs:1000});
 t.after(()=>{link.dispose();port1.close();port2.close();});
 assert.deepEqual(await link.sendGate({generation:1,open:true}),{ok:true,generation:1,open:true});assert.equal(gate.allows(1),true);
 assert.deepEqual(await link.sendGate({generation:2,open:false}),{ok:true,generation:2,open:false});assert.equal(gate.allows(1),false);assert.equal(link.stats().pending,0);
 const closed=new Promise(resolve=>port1.once('close',resolve));port2.close();await closed;assert.equal(unavailable,1);assert.equal((await link.sendGate({generation:3,open:true})).ok,false);
});

test('an extra open can never consume the reserved close slot',async t=>{
 const f=fixture();t.after(()=>f.link.dispose());const open=f.link.sendGate({generation:1,open:true});let settled=false,result;
 f.link.sendGate({generation:2,open:true}).then(r=>{settled=true;result=r;});await Promise.resolve();assert.equal(settled,true,'Extra Open must be refused immediately');assert.equal(result.ok,false);assert.equal(f.sent.length,1);
 const close=f.link.sendGate({generation:2,open:false});assert.equal(f.sent.length,2);assert.equal((await f.link.sendGate({generation:3,open:true})).ok,false);f.ack(1);assert.equal((await close).ok,true);assert.equal((await open).ok,false);f.link.dispose();
});

test('a failed native failure-fence callback is explicit and cannot be reported as an acknowledged gate',async()=>{
 let handlers;const link=new TerminalGateLink({channelId:'fence_fault',send:()=>{},subscribe:h=>{handlers=h;return()=>{};},onUnavailable:()=>{throw Error('ledger failure');}});
 const p=link.sendGate({generation:1,open:true});handlers.closed();assert.equal((await p).ok,false);assert.equal(link.stats().failureFenceFailed,true);assert.equal(link.stats().closed,true);
});

test('actual port plus ledger fence rejects a delayed old-open ACK after confirmed Lock',async t=>{
 const {port1,port2}=new MessageChannel(),gate=new HostInputGate(),ledger=new TerminalSessionLedger({writeInput:()=>({accepted:true})});
 ledger.register({sessionId:'s1',projectId:'p1',profileId:'powershell',cwdDisplay:'D:/Lucru'});let delayed;
 const receive=createGateResponder({channelId:'fence_channel',gate,send:r=>{if(r.generation===1)delayed=r;else port2.postMessage(r);}});port2.on('message',receive);
 const link=new TerminalGateLink({channelId:'fence_channel',send:p=>port1.postMessage(p),subscribe:h=>{port1.on('message',h.message);port1.on('close',h.closed);return()=>{port1.off('message',h.message);port1.off('close',h.closed);};},onUnavailable:()=>ledger.closeInput('lost-host'),deadlineMs:1000});
 t.after(()=>{link.dispose();port1.close();port2.close();});const fence=new TerminalInputFence({ledger,gateLink:link,deadlineMs:1000}),context={projectId:'p1',windowId:'t1',epoch:1};
 const opening=fence.resumeInput(),closing=fence.closeInput('lock');assert.equal(ledger.attach(context,'s1').code,'PIN_REQUIRED');assert.equal((await opening).ok,false);assert.equal((await closing).hostAcknowledged,true);assert.equal(gate.allows(1),false);
 const observed=new Promise(resolve=>port1.once('message',resolve));port2.postMessage(delayed);await observed;assert.equal(fence.snapshot().closed,true);assert.equal(ledger.attach(context,'s1').code,'PIN_REQUIRED');assert.equal(link.stats().pending,0);
 assert.equal((await fence.resumeInput()).ok,true);assert.equal(ledger.attach(context,'s1').ok,true);assert.equal(gate.allows(3),true);
});
