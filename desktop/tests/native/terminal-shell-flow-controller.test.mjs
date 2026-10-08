// Pure test instrumentation. No Electron/native imports or command execution.
import test from 'node:test';
import assert from 'node:assert/strict';
let createShellFlowController;
try{({createShellFlowController}=await import('./terminal-shell-flow-controller.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
import {createShellFlowCore} from './terminal-shell-flow-core.mjs';
function setup(){
 assert.equal(typeof createShellFlowController,'function','MISSING_SHELL_FLOW_CONTROLLER');
 const writes=[],requests=[],pending=[],core=createShellFlowCore({write:d=>writes.push(d),resize:()=>{}});
 let clock=0,alive=true;
 const exchange=packet=>new Promise((resolve,reject)=>pending.push({packet,resolve,reject}));
 const controller=createShellFlowController({exchange,isAlive:()=>alive,now:()=>clock});
 function deliver(index=0){const p=pending.splice(index,1)[0];assert.ok(p);requests.push(p.packet);let result;
  if(p.packet.kind==='gate')result=core.applyGate({generation:p.packet.generation,open:p.packet.open});
  else if(p.packet.kind==='input')result=core.submit(p.packet.generation,p.packet.data);
  else if(p.packet.kind==='resize')result=core.fit(p.packet.generation,p.packet.cols,p.packet.rows);
  else if(p.packet.kind==='snapshot')result=core.read({fromSequence:p.packet.fromSequence});
  p.resolve({admitted:false,sequence:p.packet.sequence,kind:p.packet.kind,result,stats:core.stats(),ageMs:clock});
 }
 return {controller,writes,requests,pending,core,deliver,tick:n=>clock+=n,lose:()=>{alive=false;controller.dispose();}};
}
test('initial fence and in-flight open refuse input before invoking transport',async()=>{
 const r=setup();assert.equal((await r.controller.submit('x\r')).ok,false);assert.equal(r.pending.length,0);
 const opening=r.controller.unlock();assert.equal((await r.controller.submit('x\r')).ok,false);r.deliver();assert.equal((await opening).ok,true);
 const write=r.controller.submit('fixed\r');r.deliver();assert.equal((await write).ok,true);assert.deepEqual(r.writes,['fixed\r']);
});
test('Lock fences synchronously before host ACK; stale host attempts do not write; fresh Unlock never replays',async()=>{
 const r=setup();const opening=r.controller.unlock();r.deliver();await opening;
 const command=r.controller.submit('fixed\r');r.deliver();await command;
 const locking=r.controller.lock();assert.equal(r.controller.snapshot().closed,true);assert.equal((await r.controller.submit('late\r')).ok,false);assert.deepEqual(r.writes,['fixed\r']);
 r.deliver();assert.equal((await locking).ok,true);assert.equal(r.core.submit(1,'direct-stale\r').ok,false);
 r.core.append('command completed while locked\r\n');const read=r.controller.read(0);r.deliver();assert.match((await read).result.chunks[0].data,/completed while locked/);
 const reopening=r.controller.unlock();r.deliver();await reopening;assert.deepEqual(r.writes,['fixed\r']);
 const fresh=r.controller.submit('fresh\r');r.deliver();await fresh;assert.deepEqual(r.writes,['fixed\r','fresh\r']);
});
test('new close dominates an open ACK arriving later',async()=>{
 const r=setup();const opening=r.controller.unlock(),locking=r.controller.lock();assert.equal(r.pending.length,2);
 r.deliver(1);assert.equal((await locking).ok,true);assert.equal((await opening).ok,false);r.deliver();await Promise.resolve();
 assert.equal(r.controller.snapshot().closed,true);assert.equal((await r.controller.submit('late\r')).ok,false);assert.deepEqual(r.writes,[]);
});
test('a saturated output request does not queue or block an independent Lock request',async()=>{
 const r=setup();const opening=r.controller.unlock();r.deliver();await opening;
 const read=r.controller.read(0);assert.equal((await r.controller.read(0)).code,'TEST_LANE_BUSY');
 const close=r.controller.lock();assert.equal(r.pending.length,2);assert.equal(r.pending[1].packet.kind,'gate');r.deliver(1);assert.equal((await close).ok,true);r.deliver();await read;
});
test('known endpoint loss invalidates cached ACK permanently and never retries input',async()=>{
 const r=setup();const opening=r.controller.unlock();r.deliver();await opening;r.lose();
 assert.equal((await r.controller.submit('x')).ok,false);assert.equal((await r.controller.unlock()).ok,false);assert.equal(r.pending.length,0);assert.deepEqual(r.writes,[]);
});
test('wrong sequence or altered gate reply makes the controller unavailable',async()=>{
 const r=setup();const opening=r.controller.unlock();const pending=r.pending.shift();pending.resolve({admitted:false,sequence:999,kind:'gate',result:{ok:true,generation:1,open:true}});
 assert.equal((await opening).ok,false);assert.equal(r.controller.snapshot().closed,true);assert.equal((await r.controller.unlock()).ok,false);
});
test('input callback failure remains uncertain and is never retried',async()=>{
 const r=setup();const opening=r.controller.unlock();r.deliver();await opening;
 const input=r.controller.submit('fixed\r');r.pending.shift().reject(Error('unknown write'));assert.equal((await input).ok,false);
 assert.equal((await r.controller.submit('fixed\r')).ok,false);assert.equal(r.pending.length,0);
});
test('invalid or oversized requests refuse before transport; sequence is finite',async()=>{
 const r=setup();for(const data of ['',123,'\ud800','x'.repeat(32769)])assert.equal((await r.controller.submit(data)).ok,false);
 for(const cursor of [-1,NaN,0.5,Number.MAX_SAFE_INTEGER+1])assert.equal((await r.controller.read(cursor)).ok,false);
 assert.equal(r.pending.length,0);
});
test('probe latency is measured around the actual ACK, never fabricated',async()=>{
 const r=setup();const open=r.controller.unlock();r.tick(123);r.deliver();await open;
 assert.equal(r.controller.metrics().gateAckMs[0],123);assert.equal(r.controller.metrics().nativeExecutionAdmitted,false);
});
