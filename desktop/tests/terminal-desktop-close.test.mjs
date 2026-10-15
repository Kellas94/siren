// Regression cases originally authored by capability_libraries_research against real graph/registry, with an inert native transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopFixture} from './helpers/terminal-desktop-lifecycle-fixture.mjs';
let op=0;
function packet(s,caller,fields={}){const grant=s.registry.capture(caller);assert.ok(grant);return {operationId:'independent_close_'+ ++op,epoch:grant.epoch,...fields};}
async function replacement(s){await s.registry.openView({role:'terminal',entityId:'terminal1'});const win=s.windows.at(-1);return {win,caller:{sender:win.webContents,senderFrame:win.webContents.mainFrame}};}
const dataRows=s=>s.sent.filter(r=>r.c==='siren:terminal-data');
async function initial(s){const lease=await s.create();await s.tick();s.composition.emitOutput(lease.sessionId,'unacknowledged Ω');await s.tick();assert.equal(dataRows(s).length,1);assert.equal(s.members.manager.stats().outputHandoffTickets,1);return lease;}
function noStop(s){assert.equal(s.composition.state.trace.filter(r=>r.name==='native-stop').length,0);assert.equal(s.composition.state.groups.length,1);assert.equal(s.members.manager.stats().inputClosed,false);}
test('actual manager transfers an unacknowledged old frame to fresh same-session lease after native destruction without Lock',async()=>{
 const s=await desktopFixture();try{
  const old=await initial(s),oldData=dataRows(s)[0].p;s.view.destroy();assert.equal(s.registry.capture(s.caller),null);
  const n=await replacement(s),attached=await s.bridge.invoke(n.caller,'terminalAttach',packet(s,n.caller,{sessionId:old.sessionId}));assert.equal(attached.ok,true,attached.code);
  const lease={sessionId:old.sessionId,leaseId:attached.value.leaseId,generation:attached.value.generation};assert.notEqual(lease.leaseId,old.leaseId);assert.ok(lease.generation>old.generation);
  assert.equal((await s.bridge.invoke(s.caller,'terminalAck',s.packet({...old,throughSequence:oldData.sequence+oldData.utf8Bytes}))).ok,false);
  await s.tick();const replay=dataRows(s).at(-1);assert.equal(replay.e.sender,n.win.webContents);assert.equal(replay.p.data,'unacknowledged Ω');assert.equal(replay.p.leaseId,lease.leaseId);
  const ack=await s.bridge.invoke(n.caller,'terminalAck',packet(s,n.caller,{...lease,throughSequence:replay.p.sequence+replay.p.utf8Bytes}));assert.equal(ack.ok,true,ack.code);assert.equal(s.members.manager.stats().outputHandoffTickets,0);
  s.composition.emitOutput(lease.sessionId,'continued');await s.tick();assert.equal(dataRows(s).at(-1).p.data,'continued');noStop(s);
 }finally{await s.end();}
});
test('destroyed ACK-waiting windows cannot consume all eight bridge attachment slots and prevent later same-session restore',async()=>{
 const s=await desktopFixture();try{
  const old=await initial(s);s.view.destroy();
  for(let i=0;i<8;i++){
   const n=await replacement(s);const attached=await s.bridge.invoke(n.caller,'terminalAttach',packet(s,n.caller,{sessionId:old.sessionId}));
   assert.equal(attached.ok,true,`replacement ${i+1} refused: ${attached.code}`);
   await s.tick();const row=dataRows(s).at(-1);assert.equal(row.e.sender,n.win.webContents);assert.equal(row.p.data,'unacknowledged Ω');noStop(s);n.win.destroy();
  }
 }finally{await s.end();}
});
test('destroyed idle window retires on existing timer without Stop or Lock',async()=>{
 const s=await desktopFixture();try{await s.create();assert.equal(s.timers.size,1);s.view.destroy();await s.tick();assert.equal(s.bridge.snapshot().attachments,0);assert.equal(s.timers.size,0);noStop(s);}finally{await s.end();}
});
