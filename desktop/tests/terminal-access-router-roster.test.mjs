import assert from 'node:assert/strict';
import test from 'node:test';
import {setup} from './fixtures/terminal-access-settlement.mjs';

test('Access retains actual initial and replacement router settlement identities',async()=>{
 const s=setup();try{
  const first=s.router.captureRouterSettlement();
  assert.deepEqual(s.controller.captureRouterSettlementRoster(),[first]);
  assert.equal(s.controller.captureRouterSettlementRoster(undefined),null);
  await s.h.ready('');assert.equal((await s.controller.beginLock()).ok,true);
  assert.equal((await s.controller.reopen(s.event)).ok,true);
  const second=s.controller.currentRouter().captureRouterSettlement();
  assert.notEqual(first,second);assert.deepEqual(s.controller.captureRouterSettlementRoster(),[first,second]);
  const handle=s.controller.retireAccess();await handle.actualSettled;
  assert.equal(first.snapshot().actualSettled,true);assert.equal(second.snapshot().actualSettled,true);
  assert.equal(handle.snapshot().pendingWorkers,0);
 }finally{await s.end();}
});

test('Lock does not retire the manager or start Session Stop',async()=>{
 const s=setup();try{
  await s.h.ready('');await s.controller.beginLock();
  assert.equal(s.h.manager.captureManagerSettlement().snapshot().retired,false);
  assert.equal(s.h.calls.stopSession??0,0);
  await s.controller.retireAccess().actualSettled;
  assert.equal(s.h.calls.stopSession,1);
 }finally{await s.end();}
});
