import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader} from '../src/terminal/production-history-channel.mjs';
import {ProductionGateLink} from '../src/terminal/production-gate-link.mjs';
import {TerminalInputFence} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const variants=[['control',ProductionControlChannel],['history',ProductionHistoryChannel]];
function wirePair(){
 const a=new EventEmitter(),b=new EventEmitter();
 for(const [s,other] of [[a,b],[b,a]]){
  s.writableLength=0;s.dead=false;s.writes=[];
  s.write=bytes=>{const copy=Buffer.from(bytes);s.writes.push(copy);queueMicrotask(()=>{if(!other.dead)other.emit('data',copy);});return true;};
  s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!other.dead)other.emit('end');});};
 }
 return[a,b];
}
async function pair(C,t){
 const [a,b]=wirePair(),options={channelId:'lane',sessionId:'session',secret:Buffer.alloc(32,51),deadlineMs:500};
 if(C===ProductionControlChannel)delete options.sessionId;
 const creator=new C({...options,stream:b,role:'creator'}),main=new C({...options,stream:a,role:'main'});
 // Cleanup invokes the unshadowed class method, only after observations.
 t.after(()=>{C.prototype.dispose.call(main);C.prototype.dispose.call(creator);});
 assert.equal(await main.ready,true);assert.equal(await creator.ready,true);return {a,b,main,creator};
}

for(const [name,C] of variants){
 test(`LL-1 ${name}: own dispose shadow cannot suppress authenticated EOF invalidation`,async t=>{
  const p=await pair(C,t);let closed=0,shadowCalls=0;p.main.subscribe({message(){},closed(){closed++;}});
  p.main.dispose=()=>{shadowCalls++;};p.a.emit('end');
  console.log(JSON.stringify({case:'LL-1',lane:name,available:p.main.isAvailable(),closedNotifications:closed,shadowCalls,streamDestroyed:p.a.dead}));
  assert.equal(p.main.isAvailable(),false,'internal stream end must close lifetime despite caller-owned dispose shadow');
  assert.equal(closed,1);
 });

 test(`LL-2 ${name}: binary Proxy intake must not traverse user traps or escape its event handler`,async t=>{
  const p=await pair(C,t);p.main.subscribe({message(){},closed(){}});let traps=0,escaped=null;
  const value=new Proxy(Buffer.alloc(4),{getPrototypeOf(){traps++;throw Error('BINARY_PROTOTYPE_TRAP');}});
  try{p.a.emit('data',value);}catch(e){escaped=e.message;}
  console.log(JSON.stringify({case:'LL-2',lane:name,input:'proxy',traps,escaped,available:p.main.isAvailable()}));
  assert.equal(traps,0,'Buffer branding must reject Proxy before prototype traversal');
  assert.equal(escaped,null);assert.equal(p.main.isAvailable(),false);
 });

 test(`LL-2 ${name}: canonical Buffer own copy getter must not run during framed intake`,async t=>{
  const p=await pair(C,t);p.main.subscribe({message(){},closed(){}});let reads=0,escaped=null;const value=Buffer.alloc(4);
  Object.defineProperty(value,'copy',{get(){reads++;throw Error('BINARY_COPY_GETTER');}});
  try{p.a.emit('data',value);}catch(e){escaped=e.message;}
  console.log(JSON.stringify({case:'LL-2',lane:name,input:'buffer-copy-getter',reads,escaped,available:p.main.isAvailable()}));
  assert.equal(reads,0,'intake must copy bytes through captured intrinsic operations');assert.equal(escaped,null);assert.equal(p.main.isAvailable(),false);
 });

 test(`LL-2 ${name}: bootstrap secret Proxy must reject without invoking traps`,()=>{
  const [a,b]=wirePair();let traps=0;const secret=new Proxy(Buffer.alloc(32),{getPrototypeOf(){traps++;throw Error('SECRET_PROTOTYPE_TRAP');}});
  assert.throws(()=>new C({stream:a,role:'creator',channelId:'lane',...(C===ProductionHistoryChannel?{sessionId:'session'}:{}),secret,deadlineMs:50}));
  a.destroy();b.destroy();console.log(JSON.stringify({case:'LL-2',lane:name,input:'secret-proxy',traps}));assert.equal(traps,0);
 });
}

test('LL-1 gate: own dispose shadow cannot retain cached-open actual fence after known closure',async t=>{
 let handler;const packets=[];const link=new ProductionGateLink({channelId:'gate',send:p=>packets.push(p),subscribe:h=>{handler=h;return()=>{};},deadlineMs:500});
 t.after(()=>ProductionGateLink.prototype.dispose.call(link));const ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})});
 ledger.register({sessionId:'session',projectId:'project',profileId:'profile',cwdDisplay:'inert'});
 const fence=new TerminalInputFence({ledger,gateLink:link,deadlineMs:500});const opening=fence.resumeInput();handler.message({...packets[0],ok:true});assert.equal((await opening).ok,true);
 let shadowCalls=0;link.dispose=()=>{shadowCalls++;};handler.closed();
 const resumed=await fence.resumeInput(),attached=ledger.attach({projectId:'project',windowId:'window',epoch:1},'session');
 console.log(JSON.stringify({case:'LL-1',lane:'gate',shadowCalls,available:link.isAvailable(),snapshot:fence.snapshot(),resumed,attachedOk:attached.ok}));
 assert.equal(fence.snapshot().closed,true,'known close must revoke cached success before any future input admission');assert.equal(resumed.ok,false);assert.equal(attached.ok,false);
});

test('ordinary Buffer malformed frames still close both historical lanes without privileged mutation',async t=>{
 for(const [,C] of variants){const p=await pair(C,t);let closed=0;p.main.subscribe({message(){assert.fail('malformed frame dispatched');},closed(){closed++;}});p.a.emit('data',Buffer.alloc(4));assert.equal(p.main.isAvailable(),false);assert.equal(closed,1);}
});

test('normal lifetime EOF revokes actual fence before a later cached-open request',async t=>{
 let handler;const packets=[];const link=new ProductionGateLink({channelId:'gate',send:p=>packets.push(p),subscribe:h=>{handler=h;return()=>{};},deadlineMs:500});t.after(()=>link.dispose());
 const fence=new TerminalInputFence({ledger:new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),gateLink:link,deadlineMs:500});const opening=fence.resumeInput();handler.message({...packets[0],ok:true});assert.equal((await opening).ok,true);
 handler.closed();assert.equal(fence.snapshot().closed,true);assert.equal((await fence.resumeInput()).ok,false);await turn();
});

