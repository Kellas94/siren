import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {EventEmitter} from 'node:events';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader,createProductionHistoryResponder} from '../src/terminal/production-history-channel.mjs';
import {ProductionGateLink,createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {TerminalAggregateGateLink} from '../src/terminal/aggregate-gate.mjs';
import {TerminalInputFence,HostInputGate} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function duplexes(){let a,b;const create=peer=>new Duplex({read(){},write(data,encoding,done){const copy=Buffer.from(data);queueMicrotask(()=>{if(!peer().destroyed)peer().push(copy);done();});},destroy(error,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(null);});done(error);}});a=create(()=>b);b=create(()=>a);return[a,b];}
function synchronousStreams(){const a=new EventEmitter(),b=new EventEmitter();for(const[s,p]of[[a,b],[b,a]]){s.writableLength=0;s.write=bytes=>{if(!p.dead)p.emit('data',Buffer.from(bytes));s.afterWrite?.();return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!p.dead)p.emit('end');});};}return[a,b];}
async function channels(C,t,{sync=false,id='lane'}={}){const[a,b]=sync?synchronousStreams():duplexes(),options={channelId:id,secret:Buffer.alloc(32,33),deadlineMs:500,...(C===ProductionHistoryChannel?{sessionId:'s'}:{})};const creator=new C({...options,role:'creator',stream:b}),main=new C({...options,role:'main',stream:a});t.after(()=>{C.prototype.dispose.call(main);C.prototype.dispose.call(creator);});assert.equal(await main.ready,true);assert.equal(await creator.ready,true);return{a,b,main,creator};}

test('actual memory Duplex uses captured queue accounting for control and history exchanges',async t=>{
 const control=await channels(ProductionControlChannel,t);const gate=new HostInputGate();control.creator.subscribe({message:createProductionGateResponder({channelId:'lane',gate,send:p=>control.creator.send(p)}),closed(){}});
 const link=new ProductionGateLink({channelId:'lane',send:p=>{if(!control.main.send(p))throw Error('send');},subscribe:r=>control.main.subscribe(r)});t.after(()=>link.dispose());assert.equal((await link.sendGate({generation:1,open:true})).ok,true);assert.equal(gate.allows(1),true);assert.equal((await link.sendGate({generation:2,open:false})).ok,true);assert.equal(gate.allows(1),false);
 const history=await channels(ProductionHistoryChannel,t);createProductionHistoryResponder({channel:history.creator,history:{read:()=>({firstSequence:0,endSequence:4,chunk:{sequence:0,data:'😀',utf8Bytes:4}})}});const reader=new ProductionHistoryReader({channel:history.main,sessionId:'s'});assert.equal((await reader.read({sessionId:'s',fromSequence:0,maxBytes:4})).chunk.data,'😀');
});

test('all eight production control links satisfy the real aggregate close barrier',async t=>{
 const peers=new Map(),aggregate=new TerminalAggregateGateLink({resolveLink:(_,channel)=>({link:peers.get(channel).link,initiallyClosed:true}),deadlineMs:500});t.after(()=>aggregate.dispose());const fence=new TerminalInputFence({ledger:new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),gateLink:aggregate,deadlineMs:500});
 for(let i=0;i<8;i++){const id='lane'+i,p=await channels(ProductionControlChannel,t,{id}),gate=new HostInputGate();let held=false,reply;
  const respond=createProductionGateResponder({channelId:id,gate,send:r=>{if(held)reply=r;else p.creator.send(r);}});p.creator.subscribe({message:respond,closed(){}});const link=new ProductionGateLink({channelId:id,send:r=>{if(!p.main.send(r))throw Error('send');},subscribe:r=>p.main.subscribe(r),deadlineMs:500});peers.set(id,{link,gate,hold(){held=true;},ack(){p.creator.send(reply);}});aggregate.reserve('s'+i);assert.equal((await aggregate.bind('s'+i,id)).ok,true);
 }
 assert.equal((await fence.resumeInput()).ok,true);peers.get('lane7').hold();let settled=false;const closing=fence.closeInput('lock').then(r=>{settled=true;return r;});await tick();assert.equal(settled,false);peers.get('lane7').ack();assert.equal((await closing).ok,true);for(const peer of peers.values())assert.equal(peer.gate.allows(1),false);assert.equal(aggregate.stats().pending,0);
});

test('synchronous history reply cannot succeed when external write closes before returning',async t=>{
 const p=await channels(ProductionHistoryChannel,t,{sync:true});createProductionHistoryResponder({channel:p.creator,history:{read:()=>({firstSequence:0,endSequence:1,chunk:{sequence:0,data:'a',utf8Bytes:1}})}});const reader=new ProductionHistoryReader({channel:p.main,sessionId:'s'});p.a.afterWrite=()=>p.main.dispose();await assert.rejects(reader.read({sessionId:'s',fromSequence:0,maxBytes:4}),/HISTORY_UNAVAILABLE/);assert.equal(p.main.isAvailable(),false);
});

test('gate stages synchronous ACK until send returns and failure cannot cache success',async()=>{
 let receiver,link;link=new ProductionGateLink({channelId:'lane',subscribe:r=>{receiver=r;return()=>{};},send:p=>{receiver.message({...p,ok:true});link.dispose();}});assert.equal((await link.sendGate({generation:1,open:true})).ok,false);assert.equal(link.isAvailable(),false);
 let closed=0;const early=new ProductionGateLink({channelId:'lane',subscribe:()=>()=>{closed++;},send(){assert.fail('send after synchronous timer');},setTimer:fire=>{fire();return 7;},clearTimer(){}});assert.equal((await early.sendGate({generation:1,open:true})).ok,false);assert.equal(closed,1);
});

test('gate callback-triggered close preserves pending bounds and no late success',async()=>{
 let receiver;const order=[];const link=new ProductionGateLink({channelId:'lane',send(){},subscribe:r=>{receiver=r;return()=>{};},onUnavailable(){order.push('observer');}});link.subscribeUnavailable(()=>order.push('fence'));const a=link.sendGate({generation:1,open:true}),b=link.sendGate({generation:2,open:false});assert.equal(link.stats().pending,2);receiver.closed();assert.deepEqual(order,['fence','observer']);assert.equal((await a).ok,false);assert.equal((await b).ok,false);assert.equal(link.stats().pending,0);
});
