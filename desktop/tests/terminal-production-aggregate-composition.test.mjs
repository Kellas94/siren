import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionGateLink,createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {ProductionAggregateGateLink} from '../src/terminal/production-aggregate-gate.mjs';
import {TerminalInputFence,HostInputGate} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function streams(){let a,b;const make=peer=>new Duplex({read(){},write(bytes,_enc,done){const owned=Buffer.from(bytes);queueMicrotask(()=>{if(!peer().destroyed)peer().push(owned);done();});},destroy(error,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(null);});done(error);}});a=make(()=>b);b=make(()=>a);return[a,b];}
async function fixture(t){
 const peers=new Map(),aggregate=new ProductionAggregateGateLink({resolveLink:(_,id)=>({link:peers.get(id).link,initiallyClosed:true}),deadlineMs:500});t.after(()=>aggregate.dispose());
 const fence=new TerminalInputFence({ledger:new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),gateLink:aggregate,deadlineMs:500});
 const add=async id=>{const[a,b]=streams(),common={channelId:id,secret:Buffer.alloc(32,33),deadlineMs:500},creator=new ProductionControlChannel({...common,role:'creator',stream:b}),main=new ProductionControlChannel({...common,role:'main',stream:a});
  t.after(()=>{main.dispose();creator.dispose();});assert.equal(await main.ready,true);assert.equal(await creator.ready,true);
  const gate=new HostInputGate();let held=false,reply;const respond=createProductionGateResponder({channelId:id,gate,send:r=>{if(held)reply=r;else creator.send(r);}});creator.subscribe({message:respond,closed(){}});
  const link=new ProductionGateLink({channelId:id,send:r=>{if(!main.send(r))throw Error('send failed');},subscribe:r=>main.subscribe(r),deadlineMs:500});
  const p={gate,link,main,creator,hold:()=>{held=true;},ack:()=>creator.send(reply)};peers.set(id,p);aggregate.reserve(id);assert.equal((await aggregate.bind(id,id)).ok,true);return p;
 };return{aggregate,fence,add};
}
test('real control bytes: eight peers, quiesced EOF preserves global fence and charged reservation',async t=>{
 const f=await fixture(t),peers=[];for(let i=0;i<8;i++)peers.push(await f.add('s'+i));assert.equal((await f.fence.resumeInput()).ok,true);
 assert.equal((await f.aggregate.quiesce('s0')).ok,true);peers[0].creator.dispose();await tick();assert.equal(f.aggregate.isAvailable(),true);assert.equal(f.aggregate.stats().sessions,8);assert.equal(f.aggregate.reserve('ninth').code,'CAPACITY_EXCEEDED');
 assert.equal((await f.fence.closeInput('lock')).ok,true);assert.equal((await f.fence.resumeInput()).ok,true);assert.equal(peers[0].gate.allows(f.fence.snapshot().generation),false);assert.ok(peers.slice(1).every(p=>p.gate.allows(f.fence.snapshot().generation)));
 assert.equal(f.aggregate.release('s0').ok,true);assert.equal(f.aggregate.reserve('replacement').ok,true);
});
test('real control EOF while closed ACK withheld fences the whole lifetime and settles quiescence',async t=>{
 const f=await fixture(t),a=await f.add('a');await f.fence.resumeInput();a.hold();const q=f.aggregate.quiesce('a');await tick();a.creator.dispose();assert.equal((await q).ok,false);assert.equal(f.aggregate.isAvailable(),false);assert.equal(f.fence.snapshot().closed,true);assert.equal(f.aggregate.stats().sessions,1);
});
test('real control close barrier waits for separate quiesce ACK, then sibling EOF remains fatal',async t=>{
 const f=await fixture(t),a=await f.add('a'),b=await f.add('b');await f.fence.resumeInput();a.hold();const q=f.aggregate.quiesce('a');await tick();let settled=false;const close=f.fence.closeInput('lock').then(r=>{settled=true;return r;});await tick();assert.equal(settled,false);a.ack();assert.equal((await q).ok,true);assert.equal((await close).ok,true);
 b.creator.dispose();await tick();assert.equal(f.aggregate.isAvailable(),false);assert.equal(f.fence.snapshot().hostAcknowledged,false);
});
