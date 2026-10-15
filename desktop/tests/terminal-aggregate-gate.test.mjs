import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalGateLink,createGateResponder} from '../src/terminal/gate-link.mjs';
import {HostInputGate,TerminalInputFence} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const {TerminalAggregateGateLink}=await import('../src/terminal/aggregate-gate.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=()=>new Promise(r=>setImmediate(r));
function peer(channelId,{autoReply=true,deadlineMs=2000}={}){
 const gate=new HostInputGate(),sent=[],replies=[],writes=[];let receiver,automatic=autoReply;
 const responder=createGateResponder({channelId,gate,send:r=>{replies.push(r);if(automatic)receiver.message(r);}});
 const link=new TerminalGateLink({channelId,deadlineMs,send:p=>{sent.push(p);responder(p);},subscribe:r=>{receiver=r;return ()=>{};}});
 return {link,gate,sent,replies,writes,setAuto:v=>{automatic=v;},ack:(n=replies.length-1)=>receiver.message(replies[n]),close:()=>receiver.closed(),write:(generation,data)=>{if(!gate.allows(generation))return false;writes.push(data);return true;}};
}
function fixture(options={}){
 assert.equal(typeof TerminalAggregateGateLink,'function','aggregate gate implementation required');
 const peers=new Map(),observations=[],aggregate=new TerminalAggregateGateLink({deadlineMs:options.deadlineMs??2000,resolveLink:(sessionId,channelId)=>options.resolveLink?options.resolveLink(sessionId,channelId):{link:peers.get(channelId)?.link,initiallyClosed:true},onUnavailable:()=>observations.push('unavailable')});
 const ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),fence=new TerminalInputFence({ledger,gateLink:aggregate,deadlineMs:options.fenceDeadlineMs??options.deadlineMs??2000});
 const add=async(sessionId,opts)=>{const p=peer('channel_'+sessionId,opts);peers.set('channel_'+sessionId,p);assert.equal(aggregate.reserve(sessionId).ok,true);assert.equal((await aggregate.bind(sessionId,'channel_'+sessionId)).ok,true);return p;};
 return {aggregate,ledger,fence,peers,observations,add};
}

test('aggregate defaults unavailable without a trusted channel resolver',async()=>{
 assert.equal(typeof TerminalAggregateGateLink,'function');const a=new TerminalAggregateGateLink();assert.equal(a.isAvailable(),false);assert.equal((await a.sendGate({generation:1,open:true})).ok,false);
});

test('eight real gates share one acknowledged generation and ninth reservation refuses',async()=>{
 const f=fixture();assert.equal((await f.fence.resumeInput()).ok,true);const peers=[];for(let i=0;i<8;i++)peers.push(await f.add('s'+i));
 const generation=f.fence.snapshot().generation;assert.ok(peers.every(p=>p.write(generation,'one')));assert.equal(f.aggregate.reserve('ninth').code,'CAPACITY_EXCEEDED');
 const closed=f.fence.closeInput('lock');assert.equal(f.fence.snapshot().closed,true);assert.equal((await closed).ok,true);assert.ok(peers.every(p=>!p.write(generation,'late')));
 assert.equal((await f.fence.resumeInput()).ok,true);assert.ok(peers.every(p=>p.write(f.fence.snapshot().generation,'two')));
});

test('global close waits for every bound creator ACK instead of common control alone',async()=>{
 const f=fixture();await f.fence.resumeInput();await f.add('one');const slow=await f.add('two');slow.setAuto(false);let settled=false;
 const closing=f.fence.closeInput('lock').then(r=>{settled=true;return r;});await tick();assert.equal(settled,false);assert.equal(f.fence.snapshot().closed,true);
 slow.ack();assert.equal((await closing).ok,true);assert.equal(f.aggregate.stats().pending,0);
});

test('a creator joining an unfinished close participates before global ACK',async()=>{
 const f=fixture();await f.fence.resumeInput();const first=await f.add('first');first.setAuto(false);let settled=false;const close=f.fence.closeInput('lock').then(r=>{settled=true;return r;});
 const joining=peer('joining',{autoReply:false});f.peers.set('joining',joining);f.aggregate.reserve('second');const binding=f.aggregate.bind('second','joining');
 first.ack();await tick();assert.equal(settled,false);assert.equal(joining.gate.allows(f.fence.snapshot().generation),false);
 joining.ack();assert.equal((await binding).ok,true);assert.equal((await close).ok,true);
});

test('joining after acknowledged close stays closed and needs no input or shell restart',async()=>{
 const f=fixture();await f.fence.resumeInput();await f.fence.closeInput('lock');const p=await f.add('late');assert.equal(p.write(f.fence.snapshot().generation,'no'),false);
 assert.equal((await f.fence.resumeInput()).ok,true);assert.equal(p.write(f.fence.snapshot().generation,'yes'),true);assert.deepEqual(p.writes,['yes']);
});

test('new close dominates a pending open and delayed old ACK cannot reopen',async()=>{
 const f=fixture();const p=await f.add('one');p.setAuto(false);const opening=f.fence.resumeInput();const old=p.replies.length-1;
 const closing=f.fence.closeInput('lock');p.ack();assert.equal((await closing).ok,true);p.ack(old);assert.equal((await opening).ok,false);
 assert.equal(f.fence.snapshot().closed,true);assert.equal(p.write(f.fence.snapshot().generation,'late'),false);assert.equal(f.aggregate.stats().pending,0);
});

test('loss of one creator invalidates cached global success and fences siblings',async()=>{
 const f=fixture();await f.fence.resumeInput();const a=await f.add('a'),b=await f.add('b');const generation=f.fence.snapshot().generation;
 a.close();assert.equal(f.fence.snapshot().closed,true);assert.equal(f.fence.snapshot().hostAcknowledged,false);assert.equal(f.aggregate.isAvailable(),false);
 assert.equal((await f.fence.resumeInput()).ok,false);assert.equal(b.write(generation,'late'),false);assert.deepEqual(f.observations,['unavailable']);
});

test('verified retirement removes one creator without invalidating sibling gates',async()=>{
 const f=fixture();await f.fence.resumeInput();await f.add('a');const b=await f.add('b');assert.equal(f.aggregate.release('a').ok,true);
 assert.equal(f.aggregate.isAvailable(),true);assert.equal(b.write(f.fence.snapshot().generation,'keep'),true);assert.equal(f.aggregate.stats().sessions,1);assert.equal(f.aggregate.reserve('replacement').ok,true);
});

test('retirement during pending close releases that dead writer from the barrier',async()=>{
 const f=fixture();await f.fence.resumeInput();const p=await f.add('a');p.setAuto(false);const close=f.fence.closeInput('lock');assert.equal(f.aggregate.release('a').ok,true);
 assert.equal((await close).ok,true);assert.equal(f.aggregate.isAvailable(),true);p.ack();await tick();assert.equal(f.aggregate.stats().pending,0);
});

test('released entry completion cannot acknowledge a same-ID replacement in the close barrier',async()=>{
 const f=fixture();await f.fence.resumeInput();const old=await f.add('same'),other=await f.add('other');old.setAuto(false);other.setAuto(false);
 let closed=false,bound=false;const closing=f.fence.closeInput('lock').then(r=>{closed=true;return r;});
 assert.equal(f.aggregate.release('same').ok,true);const replacement=peer('new_channel',{autoReply:false});f.peers.set('new_channel',replacement);
 assert.equal(f.aggregate.reserve('same').ok,true);const binding=f.aggregate.bind('same','new_channel').then(r=>{bound=true;return r;});
 await tick();other.ack();await tick();assert.equal(closed,false,'replacement ACK must remain required');assert.equal(bound,false);
 replacement.ack();assert.equal((await closing).ok,true);assert.equal((await binding).ok,true);assert.equal(f.aggregate.stats().pending,0);
});

test('close behind a joining closed bind remains bounded and waits for both ACKs',async()=>{
 const f=fixture();await f.fence.closeInput('initial');const p=peer('joining',{autoReply:false});f.peers.set('joining',p);f.aggregate.reserve('join');const bind=f.aggregate.bind('join','joining');
 let settled=false;const close=f.fence.closeInput('lock').then(r=>{settled=true;return r;});await tick();assert.equal(settled,false);assert.ok(f.aggregate.stats().pending<=2);
 p.ack();await tick();assert.equal(settled,false);p.ack();assert.equal((await bind).ok,true);assert.equal((await close).ok,true);assert.equal(p.write(f.fence.snapshot().generation,'no'),false);
});

test('open refuses during unresolved joining bind without opening siblings',async()=>{
 const f=fixture();await f.fence.closeInput('initial');const a=await f.add('a'),joining=peer('joining',{autoReply:false});f.peers.set('joining',joining);f.aggregate.reserve('b');const bind=f.aggregate.bind('b','joining');
 const sent=a.sent.length;assert.equal((await f.fence.resumeInput()).ok,false);assert.equal(a.sent.length,sent);joining.ack();assert.equal((await bind).ok,true);joining.setAuto(true);assert.equal((await f.fence.resumeInput()).ok,true);
});

test('missing creator ACK fails the whole barrier and cannot cache a false PASS',async()=>{
 const f=fixture({deadlineMs:40,fenceDeadlineMs:200});await f.fence.resumeInput();const p=await f.add('a');p.setAuto(false);assert.equal((await f.fence.closeInput('lock')).ok,false);
 assert.equal(f.aggregate.isAvailable(),false);p.ack();await tick();assert.equal(f.fence.snapshot().closed,true);assert.equal((await f.fence.resumeInput()).ok,false);
});

test('untrusted bootstrap, duplicate channel and accessor packets refuse without evaluating getters',async()=>{
 const bad=fixture({resolveLink:()=>({link:peer('bad').link,initiallyClosed:false})});bad.aggregate.reserve('bad');assert.equal((await bad.aggregate.bind('bad','bad')).ok,false);
 const f=fixture();await f.fence.resumeInput();await f.add('a');f.aggregate.reserve('b');assert.equal((await f.aggregate.bind('b','channel_a')).ok,false);
 let reads=0;const p={generation:100};Object.defineProperty(p,'open',{enumerable:true,get(){reads++;return true;}});assert.equal((await f.aggregate.sendGate(p)).ok,false);assert.equal(reads,0);
});
