// Exact original four-held-identity cleanup assertions, derived without weakening.
// DATA consistency only: callers must supply actual native/external receipts.
import assert from 'node:assert/strict';
function identityKey(value){
 assert.ok(value&&Number.isInteger(value.pid)&&value.pid>0&&value.pid<=0xffffffff);
 assert.ok(typeof value.image==='string'&&/^[A-Za-z]:\\/.test(value.image));
 assert.ok(typeof value.createdFileTime==='string'&&/^[1-9][0-9]*$/.test(value.createdFileTime));
 return JSON.stringify([value.pid,value.image,value.createdFileTime]);
}
function assertIdentityRows(expected,rows){
 assert.ok(Array.isArray(expected)&&Array.isArray(rows));assert.equal(rows.length,expected.length);
 const keys=new Set(expected.map(identityKey)),actual=new Set(rows.map(identityKey));
 assert.equal(keys.size,expected.length);assert.equal(actual.size,rows.length);
 assert.equal(new Set(expected.map(p=>p.pid)).size,expected.length);assert.equal(new Set(rows.map(p=>p.pid)).size,rows.length);
 for(const key of actual)assert.ok(keys.has(key),'HELD_IDENTITY_MISMATCH');
}
function assertReadyIdentities(expected,ready){
 assert.equal(expected.length,4,'EXACT_FOUR_HELD_IDENTITIES_REQUIRED');assert.equal(ready.status,'READY');assertIdentityRows(expected,ready.identities);
 for(const p of ready.identities){assert.equal(p.wait,258,'OBSERVER_READY_NOT_LIVE');assert.equal(p.exitCode,259);}
}
function assertSessionClosed(before,receipt,code){
 assert.ok(code===77||code===98);assert.equal(receipt.closed,true);const snapshot=receipt.snapshot;
 assert.equal(snapshot.active,0);assert.equal(identityKey(snapshot.root),identityKey(before.root));assert.equal(identityKey(snapshot.shell),identityKey(before.shell));
 assertIdentityRows(before.held,snapshot.held);
 for(const p of [snapshot.root,snapshot.shell,...snapshot.held]){assert.equal(p.alive,false,'SESSION_MEMBER_STILL_ALIVE');assert.equal(p.exitCode,code);}
}
function assertExternalJoin(expected,external,externalExit,code){
 assert.equal(expected.length,4);assert.equal(external.status,'EXACT_HELD_PROCESSES_EXITED');assert.equal(externalExit.code,0);assert.equal(externalExit.signal,null);
 assertIdentityRows(expected,external.before);assertIdentityRows(expected,external.after);
 for(const p of external.before){assert.equal(p.wait,258);assert.equal(p.exitCode,259);}
 for(const p of external.after){assert.equal(p.wait,0);assert.equal(p.exitCode,code);}
}
export function assertCurrentRuntimeLockCleanup(observation){
 const {code,graph,beforeSession,sessionReceipts,hostReceipt,checked,expected,external,externalExit,utilityExit}=observation;
 assert.ok(code===77||code===98);assert.equal(graph.actualSettled,true);assert.equal(graph.unknown,false);
 assert.equal(graph.hostNativeJoined,false);assert.equal(graph.sessionCleanupJoined,false);
 assert.ok(Array.isArray(sessionReceipts));assert.equal(sessionReceipts.length,1);assertSessionClosed(beforeSession,sessionReceipts[0],code);
 assert.equal(checked.ok,true);assert.equal(checked.actualSettlementEstablished,false);
 assert.equal(hostReceipt.closed,true);assert.equal(hostReceipt.code,code);assert.equal(hostReceipt.snapshot.active,0);
 assert.equal(identityKey(hostReceipt.snapshot.root),identityKey(expected[0]));assertIdentityRows([expected[0]],hostReceipt.snapshot.held);
 for(const p of [hostReceipt.snapshot.root,...hostReceipt.snapshot.held]){assert.equal(p.alive,false);assert.equal(p.exitCode,code);}
 assertExternalJoin(expected,external,externalExit,code);assert.equal(utilityExit,code);
}
