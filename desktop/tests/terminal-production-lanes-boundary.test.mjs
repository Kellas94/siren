import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader,createProductionHistoryResponder} from '../src/terminal/production-history-channel.mjs';
import {ProductionGateLink,createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {HostInputGate,TerminalInputFence} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const cases=[['control',ProductionControlChannel],['history',ProductionHistoryChannel]];
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),head=Buffer.alloc(4);head.writeUInt32BE(body.length);return Buffer.concat([head,body]);};
const request=(C,id=1)=>C===ProductionControlChannel?{channelId:'lane',requestId:id,generation:id,open:false}:{type:'read',channelId:'lane',sessionId:'session',requestId:id,fromSequence:0,maxBytes:4};
function wires(){const a=new EventEmitter(),b=new EventEmitter();for(const [s,peer] of [[a,b],[b,a]]){s.writableLength=0;s.writes=[];s.dead=false;s.write=bytes=>{s.writes.push(Buffer.from(bytes));if(s.onWrite)s.onWrite();if(!s.drop)queueMicrotask(()=>{if(!peer.dead)peer.emit('data',Buffer.from(bytes));});return s.accepted!==false;};s.destroy=()=>{if(s.onDestroy)s.onDestroy();if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!peer.dead)peer.emit('end');});};}return[a,b];}
function options(C,stream,role,secret=Buffer.alloc(32,9)){return {stream,role,channelId:'lane',...(C===ProductionHistoryChannel?{sessionId:'session'}:{}),secret,deadlineMs:500};}
async function pair(C,t,{wrap=s=>s,secret=Buffer.alloc(32,9)}={}){const[a,b]=wires();let main,creator;t.after(()=>{if(main)C.prototype.dispose.call(main);if(creator)C.prototype.dispose.call(creator);});creator=new C(options(C,wrap(b),'creator',secret));main=new C(options(C,wrap(a),'main',secret));assert.equal(await main.ready,true);assert.equal(await creator.ready,true);return {a,b,main,creator};}

for(const [name,C]of cases){
 test(`${name} constructor options, secret and stream accessor/Proxy refusal execute zero traps`,()=>{
  const[a,b]=wires();let touched=0;const trap={get(){touched++;throw Error('trap');},getPrototypeOf(){touched++;throw Error('trap');},ownKeys(){touched++;throw Error('trap');}};const base=options(C,a,'creator');const accessor={...base};Object.defineProperty(accessor,'secret',{enumerable:true,get(){touched++;return base.secret;}});const badStream={writableLength:0,write(){},destroy(){}};Object.defineProperty(badStream,'on',{get(){touched++;return ()=>{};}});
  for(const input of [new Proxy(base,trap),accessor,{...base,extra:true},{...base,stream:new Proxy(a,trap)},{...base,stream:badStream},{...base,secret:Object.create(new Proxy(Buffer.prototype,trap))}])assert.throws(()=>new C(input),TypeError);
  assert.equal(touched,0);a.destroy();b.destroy();
 });
 test(`${name} owned binary copy ignores own length/copy/buffer/byteOffset secret and frame accessors`,async t=>{
  let touched=0;const secret=Buffer.alloc(32,9);for(const key of ['length','copy','buffer','byteOffset'])Object.defineProperty(secret,key,{get(){touched++;throw Error('trap');}});
  const p=await pair(C,t,{secret});const seen=[];p.creator.subscribe({message:r=>seen.push(r),closed(){}});const bytes=frame(request(C));for(const key of ['length','copy','buffer','byteOffset'])Object.defineProperty(bytes,key,{get(){touched++;throw Error('trap');}});
  p.b.emit('data',bytes);assert.equal(seen.length,1);assert.equal(touched,0);assert.equal(p.creator.isAvailable(),true);
 });
 test(`${name} captures stream and subscriber callbacks before caller replacement`,async t=>{
  const p=await pair(C,t);let seen=0,closed=0,touched=0;const receiver={message(){seen++;},closed(){closed++;}};p.creator.subscribe(receiver);receiver.message=()=>assert.fail('late receiver');
  for(const key of ['write','destroy'])Object.defineProperty(p.a,key,{configurable:true,get(){touched++;throw Error('late stream getter');}});
  assert.equal(p.main.send(request(C)),true);await tick();assert.equal(seen,1);p.a.emit('end');assert.equal(p.main.isAvailable(),false);await tick();assert.equal(closed,1);assert.equal(touched,0);
 });
 test(`${name} external write reentry cannot publish success after lifetime closure`,async t=>{
  const p=await pair(C,t);p.creator.subscribe({message(){},closed(){}});p.a.onWrite=()=>p.main.dispose();assert.equal(p.main.send(request(C)),false);assert.equal(p.main.isAvailable(),false);
 });
 test(`${name} queue accounting callback reentry closes before any outbound write`,async t=>{
  let target,armed=false;const wrap=s=>({on:s.on.bind(s),write:s.write.bind(s),destroy:s.destroy.bind(s),stats(){if(armed){armed=false;target.dispose();}return{writableLength:0};}});
  const p=await pair(C,t,{wrap});target=p.main;p.creator.subscribe({message(){},closed(){}});const before=p.a.writes.length;armed=true;assert.equal(p.main.send(request(C)),false);assert.equal(p.a.writes.length,before);assert.equal(p.main.isAvailable(),false);
 });
 test(`${name} all raw lifetime events and malformed coalesced tail close exactly once`,async t=>{
  for(const event of ['end','close','error','timeout']){const p=await pair(C,t);let closed=0;p.main.subscribe({message(){},closed(){closed++;}});p.main.dispose=()=>assert.fail('public close used');p.a.emit(event);assert.equal(p.main.isAvailable(),false);assert.equal(closed,1);}
  const p=await pair(C,t),seen=[];p.creator.subscribe({message:r=>seen.push(r),closed(){}});p.b.emit('data',Buffer.concat([frame(request(C)),Buffer.alloc(4),frame(request(C,2))]));assert.equal(seen.length,1);assert.equal(p.creator.isAvailable(),false);
 });
}

test('history reader uses captured branded capabilities despite public method/identity replacement',async t=>{
 const p=await pair(ProductionHistoryChannel,t);let reads=0;const history={read(){reads++;return {firstSequence:0,endSequence:1,chunk:{sequence:0,data:'a',utf8Bytes:1}};}};createProductionHistoryResponder({channel:p.creator,history});history.read=()=>assert.fail('late history callback');
 const reader=new ProductionHistoryReader({channel:p.main,sessionId:'session',deadlineMs:50});for(const key of ['send','isAvailable','dispose','identity'])Object.defineProperty(p.main,key,{get(){assert.fail('public channel lookup');}});
 const result=await reader.read({sessionId:'session',fromSequence:0,maxBytes:4});assert.equal(result.chunk.data,'a');assert.equal(reads,1);reader.dispose();assert.equal(ProductionHistoryChannel.prototype.isAvailable.call(p.main),false);
});

test('history deadline rejects before backend close callback and does not manufacture cleanup proof',async t=>{
 const p=await pair(ProductionHistoryChannel,t);p.creator.subscribe({message(){},closed(){}});const reader=new ProductionHistoryReader({channel:p.main,sessionId:'session',deadlineMs:15});let settlement='pending',atDestroy;
 const pending=reader.read({sessionId:'session',fromSequence:0,maxBytes:4}).then(()=>{settlement='resolved';},()=>{settlement='rejected';});p.a.onDestroy=()=>{atDestroy=ProductionHistoryChannel.prototype.isAvailable.call(p.main);};p.main.dispose=()=>assert.fail('public disposal');await pending;
 assert.equal(settlement,'rejected');assert.equal(atDestroy,false);assert.equal(p.main.stats().closed,true);assert.equal(Object.hasOwn(p.main.stats(),'verifiedExited'),false);
});

test('gate DATA options and Proxy packets/callbacks reject without any trap',async()=>{
 let touched=0;const trap={get(){touched++;throw Error('trap');},getPrototypeOf(){touched++;throw Error('trap');},ownKeys(){touched++;throw Error('trap');}};const opts={channelId:'gate',send(){},subscribe(){return()=>{};}};const accessor={...opts};Object.defineProperty(accessor,'send',{enumerable:true,get(){touched++;return opts.send;}});
 for(const bad of [new Proxy(opts,trap),accessor,{...opts,extra:true},{...opts,send:new Proxy(()=>{},trap)}])assert.throws(()=>new ProductionGateLink(bad),TypeError);
 const link=new ProductionGateLink(opts);assert.equal((await link.sendGate(new Proxy({generation:1,open:true},trap))).ok,false);link.dispose();assert.equal(touched,0);
});

test('gate failure fences ledger before observer and shadowed public dispose cannot suppress timers',async t=>{
 let receive,fire;const sent=[],order=[];const ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})});ledger.register({sessionId:'s',projectId:'p',profileId:'profile',cwdDisplay:'inert'});
 const link=new ProductionGateLink({channelId:'gate',send:p=>sent.push(p),subscribe:r=>{receive=r;return()=>{};},onUnavailable:()=>{order.push('observer');assert.equal(ledger.attach({projectId:'p',windowId:'w',epoch:1},'s').ok,false);},setTimer:fn=>{fire=fn;return 1;},clearTimer(){},deadlineMs:500});t.after(()=>ProductionGateLink.prototype.dispose.call(link));const fence=new TerminalInputFence({ledger,gateLink:link,deadlineMs:500});const opened=fence.resumeInput();receive.message({...sent[0],ok:true});await opened;
 link.dispose=()=>assert.fail('public disposal');const pending=link.sendGate({generation:2,open:false}).then(r=>{order.push('receipt');return r;});fire();assert.equal(fence.snapshot().closed,true);assert.equal((await pending).ok,false);assert.deepEqual(order,['observer','receipt']);
});

test('gate elapsed ACK refuses even before a held timer and clearTimer reentry cannot publish success',async t=>{
 for(const mode of ['elapsed','clear-reentry']){let receive,link,armed=false;const sent=[];link=new ProductionGateLink({channelId:'gate',send:p=>sent.push(p),subscribe:r=>{receive=r;return()=>{};},setTimer:()=>1,clearTimer(){if(armed){armed=false;link.dispose();}},deadlineMs:5});t.after(()=>link.dispose());const pending=link.sendGate({generation:1,open:true});if(mode==='elapsed'){const until=performance.now()+10;while(performance.now()<until){}}else armed=true;receive.message({...sent[0],ok:true});assert.equal((await pending).ok,false);assert.equal(link.isAvailable(),false);}
});

test('creator gate responder captures apply and refuses getter/Proxy providers before reading',()=>{
 let touched=0;const gate=new HostInputGate(),replies=[];const respond=createProductionGateResponder({channelId:'gate',gate,send:r=>replies.push(r)});Object.defineProperty(gate,'apply',{get(){touched++;throw Error('late lookup');}});
 assert.equal(respond({channelId:'gate',requestId:1,generation:1,open:true}),true);assert.equal(replies[0].ok,true);assert.equal(gate.allows(1),true);
 const bad={};Object.defineProperty(bad,'apply',{get(){touched++;return()=>{};}});assert.throws(()=>createProductionGateResponder({channelId:'gate',gate:bad,send(){}}),TypeError);assert.equal(touched,0);
});

