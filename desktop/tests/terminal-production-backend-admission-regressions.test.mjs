// Owner adverse probes with distinct pre-start versus post-start guarantees.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertProductionComposition,inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';
async function allocated(s){await s.backend.sendGate({generation:1,open:true});const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true);return p;}
test('connect grant revoked before first asynchronous connection settles prevents typed startup and spawn',async()=>{
 const s=createInertProductionComposition();let current=true;
 try{const p=await allocated(s),connecting=s.backend.connect({ownerId:p.ownerId},{isCurrent:()=>current});current=false;
  assert.equal((await connecting).ok,false);assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);
  assert.equal((await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:500,code:98})).verifiedExited,true);
 }finally{await s.dispose();}
});
test('connect grant revoked after dispatched start prevents running publication and cleans known owner',async()=>{
 const s=createInertProductionComposition({manualProvider:true});let current=true;
 try{const p=await allocated(s),connecting=s.backend.connect({ownerId:p.ownerId},{isCurrent:()=>current});
  for(let n=0;n<200&&!s.state.loads;n++)await inertTick();assert.equal(s.state.loads,1);current=false;s.releaseProvider('session1');
  assert.equal((await connecting).ok,false);assert.equal(s.backend.stats().ready,0);
  assert.equal((await s.backend.stopSession({ownerId:p.ownerId,deadlineMs:500,code:98})).verifiedExited,true);
  assert.equal(s.state.trace.filter(r=>r.name==='native-stop').length,1);
 }finally{await s.dispose();}
});
test('connect reserves its one attempt before an admission callback can reenter',async()=>{
 const s=createInertProductionComposition();let nested,reentered=false;
 try{const p=await allocated(s),result=await s.backend.connect({ownerId:p.ownerId},{isCurrent(){
  if(!reentered){reentered=true;nested=s.backend.connect({ownerId:p.ownerId},{isCurrent:()=>true});}return true;
 }});
  assert.equal(result.ok,true);assert.equal((await nested).ok,false);assert.equal(s.state.loads,1);assert.equal(s.state.spawns.length,1);
 }finally{await s.dispose();}
});
