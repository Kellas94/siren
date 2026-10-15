// ROOT synthetic composed JS; no native/PTy/shell execution or host receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionSessionLedger} from '../src/terminal/production-session-state.mjs';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';
test('manager retains capacity until retired ledger final write/secondary actually settles',async()=>{
 const hold=deferred(),h=privateManager({deadlineMs:25,wrap:{input:()=>hold.promise}}),original=TerminalProductionSessionLedger.prototype.retire,remove=Map.prototype.delete;let sessionId,observed,handle,deleted;
 TerminalProductionSessionLedger.prototype.retire=function(id){const captured=this.captureLedgerSettlement({sessionId:id}),result=Reflect.apply(original,this,[id]);if(id===sessionId){handle=captured;observed=handle.snapshot();}return result;};
 // Observe the exact record deletion, rather than assuming a later queued
 // microtask precedes the ledger's own already-queued secondary completion.
 Map.prototype.delete=function(key){const r=this.get(key),target=key===sessionId&&typeof r?.activeCreate==='boolean'&&r?.inputs instanceof Map,result=Reflect.apply(remove,this,[key]);if(target)deleted={ledger:handle.snapshot(),manager:h.manager.stats().reservedSessions};return result;};
 try{const session=await h.ready(),lease=(await h.attach(session)).value;sessionId=session.sessionId;const input=h.input(lease);await until(()=>h.calls.input===1,'actual composed input entered');await h.manager.stop(h.grant,h.packet(sessionId));assert.equal(h.manager.stats().reservedSessions,1);
  hold.resolve({accepted:true});await input;await until(()=>deleted,'exact manager retirement sampled');console.log(JSON.stringify({retired:observed,deletion:deleted}));assert.equal(observed.actualSettled,false);assert.equal(observed.pendingWrites,1);assert.equal(deleted.ledger.actualSettled,true,'manager deletion must wait for the ledger original/secondary actual receipt');assert.equal(deleted.manager,0);
 }finally{hold.resolve({accepted:true});TerminalProductionSessionLedger.prototype.retire=original;Map.prototype.delete=remove;await h.end();}
});
test('ordinary composed create/stop still releases idle ledger and reports success',async()=>{
 const h=privateManager();try{const session=await h.ready();const result=await h.manager.stop(h.grant,h.packet(session.sessionId));assert.equal(result.ok,true);await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().ledgerSessions,0);assert.equal(h.manager.stats().asyncTeardownAvailable,false);}finally{await h.end();}
});
