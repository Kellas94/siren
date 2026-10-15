import test from 'node:test';
import assert from 'node:assert/strict';
import {ProductionAggregateGateLink} from '../src/terminal/production-aggregate-gate.mjs';
import {ProductionGateLink,createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {HostInputGate} from '../src/terminal/input-gate.mjs';
import {performance} from 'node:perf_hooks';
const tick=()=>new Promise(r=>setImmediate(r));
function setup(options={}){
 const peers=new Map();let losses=0;
 const aggregate=new ProductionAggregateGateLink({deadlineMs:1000,resolveLink:(_s,c)=>({link:peers.get(c).link,initiallyClosed:true}),onUnavailable:()=>losses++,...options});
 async function add(s,{automatic=true,sendHook}={}){
  let receiver;const sent=[],replies=[],gate=new HostInputGate();
  const responder=createProductionGateResponder({channelId:s,gate,send:r=>{replies.push(r);if(automatic)receiver.message(r);}});
  const link=new ProductionGateLink({channelId:s,deadlineMs:2000,subscribe:r=>{receiver=r;return ()=>{};},send:p=>{sent.push(p);responder(p);sendHook?.(p,receiver);}});
  const peer={link,gate,sent,replies,auto:v=>{automatic=v;},ack:(i=replies.length-1)=>receiver.message(replies[i]),eof:()=>receiver.closed()};peers.set(s,peer);
  assert.equal(aggregate.reserve(s).ok,true);peer.binding=aggregate.bind(s,s);return peer;
 }
 return {aggregate,add,peers,losses:()=>losses};
}
async function ready(f,s,opts){const p=await f.add(s,opts);assert.equal((await p.binding).ok,true);return p;}
test('planned quiesce obtains closed ACK, retains capacity and preserves siblings after EOF',async()=>{
 const f=setup(),a=await ready(f,'a'),b=await ready(f,'b');await f.aggregate.sendGate({generation:1,open:true});
 assert.equal((await f.aggregate.quiesce('a')).ok,true);assert.equal(a.gate.allows(1),false);a.eof();
 assert.equal(f.aggregate.isAvailable(),true);assert.equal(f.losses(),0);assert.equal(f.aggregate.stats().sessions,2);
 assert.equal((await f.aggregate.sendGate({generation:2,open:true})).ok,true);assert.equal(b.gate.allows(2),true);assert.equal(a.sent.length,2);
 assert.equal(f.aggregate.release('a').ok,true);assert.equal(f.aggregate.stats().sessions,1);f.aggregate.dispose();
});
test('repeated quiesce shares one bounded operation and refuses open before touching siblings',async()=>{
 const f=setup(),a=await ready(f,'a'),b=await ready(f,'b');a.auto(false);
 const q=f.aggregate.quiesce('a');assert.equal(f.aggregate.quiesce('a'),q);await tick();const n=b.sent.length;
 assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);assert.equal(b.sent.length,n);assert.equal(a.sent.length,1);
 a.ack();assert.equal((await q).ok,true);assert.equal((await f.aggregate.quiesce('a')).ok,true);assert.equal(a.sent.length,1);f.aggregate.dispose();
});
test('pending open fails without fabricated ACK; quiesce waits then closes at a newer generation',async()=>{
 const f=setup(),a=await ready(f,'a');a.auto(false);const open=f.aggregate.sendGate({generation:1,open:true}),q=f.aggregate.quiesce('a');
 assert.equal((await open).ok,false);assert.equal(a.sent.length,1);a.ack();await tick();assert.equal(a.sent.length,2);assert.equal(a.sent[1].open,false);
 a.ack();assert.equal((await q).ok,true);assert.equal(f.aggregate.stats().pending,0);assert.equal(f.aggregate.isAvailable(),true);f.aggregate.dispose();
});
test('pending close barrier cannot ACK until quiescence actual fresh close ACK',async()=>{
 const f=setup(),a=await ready(f,'a');a.auto(false);let done=false;
 const close=f.aggregate.sendGate({generation:1,open:false}).then(r=>{done=true;return r;}),q=f.aggregate.quiesce('a');
 a.ack();await tick();assert.equal(done,false);assert.equal(a.sent.length,2);a.ack();assert.equal((await q).ok,true);assert.equal((await close).ok,true);f.aggregate.dispose();
});
test('new global close joins quiescence and never sends close behind close to the retiring peer',async()=>{
 const f=setup(),a=await ready(f,'a'),b=await ready(f,'b');a.auto(false);const q=f.aggregate.quiesce('a');await tick();
 let done=false;const close=f.aggregate.sendGate({generation:1,open:false}).then(r=>{done=true;return r;});await tick();assert.equal(done,false);assert.equal(a.sent.length,1);
 a.ack();assert.equal((await q).ok,true);assert.equal((await close).ok,true);assert.equal(b.sent.length,1);f.aggregate.dispose();
});
test('joining close and queued global close settle through quiescence without reopening',async()=>{
 const f=setup();await f.aggregate.sendGate({generation:1,open:false});const a=await f.add('a',{automatic:false});
 const close=f.aggregate.sendGate({generation:2,open:false}),q=f.aggregate.quiesce('a');a.ack();await tick();
 assert.equal(a.sent.length,2);assert.equal(a.sent[1].generation,3);a.ack();assert.equal((await q).ok,true);assert.equal((await close).ok,true);await a.binding;
 assert.equal(f.aggregate.stats().pending,0);assert.equal(f.aggregate.isAvailable(),true);f.aggregate.dispose();
});
test('EOF before actual quiesce ACK fails aggregate and pending quiescence',async()=>{
 const f=setup(),a=await ready(f,'a');a.auto(false);const q=f.aggregate.quiesce('a');await tick();a.eof();assert.equal(f.aggregate.isAvailable(),false);assert.equal((await q).ok,false);assert.equal(f.losses(),1);f.aggregate.dispose();
});
test('synchronous ACK then send failure cannot qualify quiescence',async()=>{
 let armed=false;const f=setup(),a=await ready(f,'a',{sendHook:()=>{if(armed)throw Error('write failed after ACK');}});armed=true;
 assert.equal((await f.aggregate.quiesce('a')).ok,false);assert.equal(f.aggregate.isAvailable(),false);f.aggregate.dispose();
});
test('silent peer times out quiescence and keeps reservation charged',async()=>{
 const f=setup({deadlineMs:20}),a=await ready(f,'a');a.auto(false);assert.equal((await f.aggregate.quiesce('a')).ok,false);
 assert.equal(f.aggregate.isAvailable(),false);assert.equal(f.aggregate.stats().sessions,1);f.aggregate.dispose();
});
test('eight quiesced reservations still block ninth and two global slots stay bounded',async()=>{
 const f=setup(),peers=[];for(let i=0;i<8;i++)peers.push(await ready(f,'s'+i));peers.forEach(p=>p.auto(false));
 const opening=f.aggregate.sendGate({generation:1,open:true}),closing=f.aggregate.sendGate({generation:2,open:false});assert.equal(f.aggregate.stats().pending,2);
 assert.equal((await f.aggregate.sendGate({generation:3,open:false})).ok,false);peers.forEach(p=>p.ack());assert.equal((await closing).ok,true);assert.equal((await opening).ok,false);
 peers.forEach(p=>p.auto(true));assert.ok((await Promise.all(peers.map((_p,i)=>f.aggregate.quiesce('s'+i)))).every(r=>r.ok));
 assert.equal(f.aggregate.reserve('ninth').code,'CAPACITY_EXCEEDED');assert.equal(f.aggregate.stats().sessions,8);assert.equal(f.aggregate.stats().pending,0);f.aggregate.dispose();
});
test('verified release inside send cannot complete stale quiescence or affect same-ID replacement',async()=>{
 let armed=false;const f=setup(),a=await ready(f,'a',{sendHook:()=>{if(armed){armed=false;f.aggregate.release('a');f.aggregate.reserve('a');}}});armed=true;
 assert.equal((await f.aggregate.quiesce('a')).ok,false);assert.equal(f.aggregate.stats().sessions,1);assert.equal(f.aggregate.isAvailable(),true);f.aggregate.dispose();
});
test('constructor and packets reject Proxy and accessor records without executing them',async()=>{
 let traps=0;const proxy=new Proxy({},{getPrototypeOf(){traps++;return Object.prototype;},ownKeys(){traps++;return [];}});
 assert.throws(()=>new ProductionAggregateGateLink(proxy));assert.equal(traps,0);
 const f=setup();assert.equal((await f.aggregate.sendGate(proxy)).ok,false);assert.equal(traps,0);
 let reads=0;assert.throws(()=>new ProductionAggregateGateLink({get resolveLink(){reads++;return ()=>{};}}));assert.equal(reads,0);f.aggregate.dispose();
});
test('public availability/disposal shadow cannot bypass internal EOF fence',async()=>{
 const f=setup(),a=await ready(f,'a');f.aggregate.isAvailable=()=>true;f.aggregate.dispose=()=>{};a.eof();
 assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);assert.equal(f.aggregate.reserve('late').ok,false);assert.equal(f.aggregate.stats().closed,true);
});
test('quiesce called reentrantly inside open send observes installed operation',async()=>{
 let q;const f=setup();const a=await ready(f,'a',{sendHook:p=>{if(p.open)q=f.aggregate.quiesce('a');}});
 assert.equal((await f.aggregate.sendGate({generation:1,open:true})).ok,false);assert.equal((await q).ok,true);
 assert.deepEqual(a.sent.map(p=>[p.generation,p.open]),[[1,true],[2,false]]);assert.equal(f.aggregate.isAvailable(),true);f.aggregate.dispose();
});
test('elapsed deadline refuses delayed ACK even when injected timer callback has not run',async()=>{
 const f=setup({deadlineMs:10,setTimer:()=>7,clearTimer(){}}),a=await ready(f,'a');a.auto(false);const q=f.aggregate.quiesce('a');await tick();
 const until=performance.now()+20;while(performance.now()<until){}a.ack();assert.equal((await q).ok,false);assert.equal(f.aggregate.isAvailable(),false);f.aggregate.dispose();
});
test('ACK then synchronous EOF before send returns still loses aggregate',async()=>{
 let armed=false;const f=setup(),a=await ready(f,'a',{sendHook:(_p,receiver)=>{if(armed)receiver.closed();}});armed=true;
 assert.equal((await f.aggregate.quiesce('a')).ok,false);assert.equal(f.aggregate.isAvailable(),false);assert.equal(f.aggregate.stats().sessions,1);f.aggregate.dispose();
});
test('quiesce clearTimer callback cannot release and replace entry then fabricate success',async()=>{
 let armed=false,f;f=setup({clearTimer:t=>{clearTimeout(t);if(armed){armed=false;f.aggregate.release('a');f.aggregate.reserve('a');}}});await ready(f,'a');armed=true;
 assert.equal((await f.aggregate.quiesce('a')).ok,false);assert.equal(f.aggregate.stats().sessions,1);assert.equal(f.aggregate.isAvailable(),true);f.aggregate.dispose();
});
test('unavailable listener runs before observer and quiesce settlement',async()=>{
 const order=[],f=setup({onUnavailable:()=>order.push('observer')}),a=await ready(f,'a');f.aggregate.subscribeUnavailable(()=>order.push('fence'));a.auto(false);
 const q=f.aggregate.quiesce('a').then(r=>{order.push('settled');return r;});await tick();a.eof();assert.deepEqual(order,['fence','observer']);assert.equal((await q).ok,false);assert.deepEqual(order,['fence','observer','settled']);f.aggregate.dispose();
});
test('captured link methods survive public shadowing after bind',async()=>{
 const f=setup(),a=await ready(f,'a');a.link.sendGate=()=>assert.fail('shadow send');a.link.isAvailable=()=>assert.fail('shadow availability');a.link.dispose=()=>assert.fail('shadow dispose');
 assert.equal((await f.aggregate.quiesce('a')).ok,true);assert.equal(f.aggregate.release('a').ok,true);assert.equal(ProductionGateLink.prototype.isAvailable.call(a.link),false);f.aggregate.dispose();
});
test('proxy link prototype and invalid ACK accessor are rejected without trap execution',async()=>{
 let traps=0;const proxy=new Proxy({},{getPrototypeOf(){traps++;return null;},getOwnPropertyDescriptor(){traps++;return undefined;}});
 const a=new ProductionAggregateGateLink({resolveLink:()=>({link:Object.create(proxy),initiallyClosed:true})});a.reserve('s');assert.equal((await a.bind('s','c')).ok,false);assert.equal(traps,0);a.dispose();
 let reads=0;const link={isAvailable:()=>true,subscribeUnavailable(){},dispose(){},sendGate:p=>Promise.resolve({get ok(){reads++;return true;},generation:p.generation,open:p.open})};
 const b=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});b.reserve('s');await b.bind('s','c');assert.equal((await b.quiesce('s')).ok,false);assert.equal(reads,0);b.dispose();
});
test('unbound/missing sessions never claim actual closed ACK or release reservation',async()=>{
 const f=setup();f.aggregate.reserve('s');assert.equal((await f.aggregate.quiesce('s')).code,'REQUEST_REFUSED');assert.equal((await f.aggregate.quiesce('missing')).code,'SESSION_REFUSED');assert.equal(f.aggregate.stats().sessions,1);f.aggregate.dispose();
});
test('caller Promise constructor accessor never runs during gate result intake',async()=>{
 let reads=0;const work=Promise.resolve({ok:true,generation:1,open:false});Object.defineProperty(work,'constructor',{get(){reads++;return Promise;}});
 const link={isAvailable:()=>true,subscribeUnavailable(){},dispose(){},sendGate:()=>work};const a=new ProductionAggregateGateLink({resolveLink:()=>({link,initiallyClosed:true})});a.reserve('a');await a.bind('a','a');
 assert.equal((await a.quiesce('a')).ok,false);assert.equal(reads,0);a.dispose();
});
test('reentrant resolver cannot bind the same channel to two reservation identities',async()=>{
 const link=()=>({isAvailable:()=>true,subscribeUnavailable(){},dispose(){},sendGate:p=>Promise.resolve({...p,ok:true})});const links={a:link(),b:link()};let nested;
 const a=new ProductionAggregateGateLink({resolveLink:s=>{if(s==='a')nested=a.bind('b','same');return{link:links[s],initiallyClosed:true};}});a.reserve('a');a.reserve('b');
 const outer=await a.bind('a','same'),inner=await nested;assert.equal(Number(outer.ok)+Number(inner.ok),1);assert.equal(a.stats().bound,1);a.dispose();
});
