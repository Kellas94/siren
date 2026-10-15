import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader} from '../src/terminal/production-history-channel.mjs';
function pair(C,t){
 const a=new EventEmitter(),b=new EventEmitter();for(const [s,peer] of [[a,b],[b,a]]){s.writableLength=0;s.dead=false;s.write=bytes=>{const copy=Buffer.from(bytes);queueMicrotask(()=>{if(!peer.dead)peer.emit('data',copy);});return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!peer.dead)peer.emit('end');});};}
 const options={channelId:'lane',sessionId:'s',secret:Buffer.alloc(32,5),deadlineMs:500};if(C===ProductionControlChannel)delete options.sessionId;const creator=new C({...options,role:'creator',stream:b}),main=new C({...options,role:'main',stream:a});
 t.after(()=>{C.prototype.dispose.call(main);C.prototype.dispose.call(creator);});return {a,b,main,creator};
}
for(const [lane,C] of [['control',ProductionControlChannel],['history',ProductionHistoryChannel]]){
 test(`LL-2 ${lane}: actual Buffer with Proxy prototype cannot trigger a prototype-walk trap`,async t=>{
  const p=pair(C,t);await p.main.ready;await p.creator.ready;p.main.subscribe({message(){},closed(){}});
  const bytes=Buffer.alloc(4);let traps=0,escaped=null;const proto=new Proxy(Buffer.prototype,{getPrototypeOf(){traps++;throw Error('BUFFER_PROTOTYPE_WALK');}});Object.setPrototypeOf(bytes,proto);
  try{p.a.emit('data',bytes);}catch(e){escaped=e.message;}
  console.log(JSON.stringify({case:'LL-2',lane,input:'actual-buffer-proxy-prototype',traps,escaped,available:p.main.isAvailable()}));
  assert.equal(traps,0,'native branding plus exact direct prototype check must avoid prototype traversal');assert.equal(escaped,null);assert.equal(p.main.isAvailable(),false);
 });
}
test('LL-1 isolated reader deadline compares pre-cleanup settlement, not cleanup callbacks',async t=>{
 const p=pair(ProductionHistoryChannel,t);await p.main.ready;await p.creator.ready;p.creator.subscribe({message(){},closed(){}});
 const reader=new ProductionHistoryReader({channel:p.main,sessionId:'s',deadlineMs:15});let settled=false,shadowCalls=0;
 const pending=reader.read({sessionId:'s',fromSequence:0,maxBytes:4}).then(()=>{settled=true;},()=>{settled=true;});p.main.dispose=()=>{shadowCalls++;};
 await new Promise(resolve=>setTimeout(resolve,40));const beforeCleanup={settled,shadowCalls,available:p.main.isAvailable()};console.log(JSON.stringify({case:'LL-1',lane:'isolated-reader',beforeCleanup}));
 ProductionHistoryChannel.prototype.dispose.call(p.main);await pending;
 assert.equal(beforeCleanup.settled,true,'bounded reader promise must reject by its deadline even when public channel disposal was replaced');
 assert.equal(beforeCleanup.available,false);
});

