// Permanent owner adaptation of the independently authored PCI-C1 controls.
// Actual coupled JS, synthetic DATA only. No native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertProductionComposition,inertConfig,inertTick,INERT_RUNTIME} from './fixtures/terminal-production-inert.mjs';
import {TerminalProductionOwnership} from '../src/terminal/production-ownership.mjs';
import {TerminalProductionBackend} from '../src/terminal/production-backend.mjs';
for(const stage of ['entry','after-capture'])test('retained connect guard reentrant Stop at '+stage+' cannot publish running',async()=>{
 const s=createInertProductionComposition({deadlineMs:500});let captured=false,p,stopping,stopped=false;
 const native={...s.native,captureSession(...args){const v=s.native.captureSession(...args);captured=true;return v;}};
 const ownership=new TerminalProductionOwnership({native,isCurrent:()=>true,onUnavailable(){},onVerified(){}});
 const h=ownership.startHost({hostProcessIdentity:{pid:101,image:INERT_RUNTIME.executable,since:1n}});assert.equal(h.ok,true);
 const backend=new TerminalProductionBackend({ownership,hostOwnerId:h.hostOwnerId,creator:INERT_RUNTIME,onUnavailable(){},deadlineMs:500});
 try{await backend.sendGate({generation:1,open:true});p=backend.prepare(inertConfig('stopreentry'),s.guard);assert.equal(p.ok,true);assert.equal(backend.allocate({ownerId:p.ownerId}).ok,true);
  const result=await backend.connect({ownerId:p.ownerId},{isCurrent(){if(!stopped&&(stage==='entry'||captured)){stopped=true;stopping=backend.stopSession({ownerId:p.ownerId,deadlineMs:250,code:77});}return true;}});
  assert.equal(stopped,true);assert.equal(result.ok,false);assert.equal(backend.stats().ready,0);assert.equal((await stopping).verifiedExited,true);assert.equal(ownership.snapshot().reservedSessions,0);assert.equal(s.state.trace.filter(x=>x.name==='native-stop').length,1);
  if(stage==='entry'){assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);}
 }finally{if(p?.ok)await backend.stopSession({ownerId:p.ownerId,deadlineMs:250,code:98});await s.dispose();}
});
