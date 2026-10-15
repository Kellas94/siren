// Future-manager integration contract; owner-authored pure regression support.
// Actual ledger/backend/creator/ownership JS, unchanged inert native/PTY fixture.
// Ledger-derived tokens are installed in the actual backend. Pure callback-only
// controls are labelled separately and establish no native/product admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionSessionLedger as TerminalSessionLedger} from '../src/terminal/production-session-state.mjs';
import {createInertProductionComposition,inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';
import {COMMAND_LIMITS,decodeTerminalCommandRequest,validateTerminalCommandReply} from '../src/terminal/command-protocol.mjs';

const FIRST=Object.freeze({projectId:'project1',windowId:'window1',epoch:4});
const SECOND=Object.freeze({projectId:'project1',windowId:'window2',epoch:4});
const SPEC=Object.freeze({sessionId:'session1',projectId:'project1',profileId:'powershell',cwdDisplay:'C:\\Project Ω Space'});
const request=(lease,sequence=0,data='inert input',context=FIRST)=>({operationId:`op_${lease.generation}_${sequence}`,sessionId:'session1',epoch:context.epoch,leaseId:lease.leaseId,generation:lease.generation,inputSequence:sequence,data});
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
async function waitUntil(predicate,label){for(let n=0;n<400&&!predicate();n++)await inertTick();assert(predicate(),label);}
const stops=h=>h.s.state.trace.filter(row=>row.name==='native-stop').length;
function noInterruption(h){
 assert.equal(h.s.backend.sessionStatus({ownerId:h.p.ownerId}).phase,'ready');
 assert.equal(h.s.backend.sessionStatus({ownerId:h.p.ownerId}).failed,false);
 assert.equal(stops(h),0);assert.equal(h.s.state.spawns.length,1);assert.equal(h.s.state.loads,1);
}
async function coupled({holdFirstResult=false}={}){
 const s=createInertProductionComposition({deadlineMs:1000}),outcomes=[],calls=[],scopes=new Map(),hold=deferred();
 assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);
 const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,true);
 const ledger=new TerminalSessionLedger({writeInput:packet=>{
  const scope=scopes.get(packet.generation);assert(scope,'private test adapter must retain the actual lease-specific scope');
  assert.equal(packet.leaseId,scope.leaseId);calls.push(Object.freeze({generation:packet.generation,leaseId:packet.leaseId,windowId:scope.context.windowId,data:packet.data}));
  return s.backend.input({ownerId:p.ownerId,leaseId:packet.leaseId,generation:packet.generation,inputSequence:packet.inputSequence,data:packet.data},scope.guard).then(outcome=>{
   outcomes.push(outcome);return holdFirstResult&&packet.generation===1?hold.promise.then(()=>outcome):outcome;
  });
 }});
 assert.equal(ledger.register(SPEC).ok,true);ledger.resumeInput();
 const h={s,p,ledger,outcomes,calls,scopes,releaseFirst:()=>hold.resolve(),async dispose(){hold.resolve();ledger.hostFailed();s.releaseWrites();await s.dispose();}};
 h.attach=async(context=FIRST)=>{
  const attached=ledger.attach(context,'session1');assert.equal(attached.ok,true,'fresh ledger attachment must remain possible after a known refusal');const lease=attached.value;
  const scope={leaseId:lease.leaseId,context,current:true,guard:null};scope.guard=Object.freeze({isCurrent:()=>scope.current});scopes.set(lease.generation,scope);
  assert.equal((await s.backend.install({ownerId:p.ownerId,windowId:context.windowId,epoch:context.epoch,leaseId:lease.leaseId,generation:lease.generation},s.guard)).ok,true);
  return lease;
 };
 return h;
}
async function revokeBackend(h,lease){assert.equal((await h.s.backend.revoke({ownerId:h.p.ownerId,leaseId:lease.leaseId,generation:lease.generation},h.s.guard)).ok,true);}
function heldFrame(h,side){
 const pending=h.s.group('session1').lanes.command.writes[side];assert(pending,'actual held write required');const frame=Buffer.from(pending.bytes);
 assert(frame.length>=5);const bytes=frame.readUInt32BE(0);assert(bytes>0&&bytes<=COMMAND_LIMITS.maxFrameBytes);assert.equal(frame.length,bytes+4);return JSON.parse(frame.subarray(4).toString('utf8'));
}

test('actual accepted input remains one known write and ledger deduplication does not replay it',async()=>{
 const h=await coupled();try{
  const lease=await h.attach(),packet=request(lease,0,'accepted Ω😀\r');
  const receipt=await h.ledger.input(FIRST,packet);assert.equal(receipt.ok,true);assert.equal(receipt.value.accepted,true);
  assert.deepEqual(h.outcomes,[{accepted:true}]);assert.equal((await h.ledger.input(FIRST,packet)).ok,true);
  assert.deepEqual(h.s.state.writes,[packet.data]);assert.equal(h.calls.length,1);assert.equal(h.ledger.stats('session1').inputUnverified,false);noInterruption(h);
 }finally{await h.dispose();}
});

test('actual pre-dispatch revoked input guard reports the private knownRefused vocabulary without a write',async()=>{
 const h=await coupled();try{
  const lease=await h.attach();h.scopes.get(lease.generation).current=false;
  const receipt=await h.ledger.input(FIRST,request(lease,0,'refused before dispatch'));
  assert.equal(receipt.ok,false);assert.equal(receipt.value?.accepted,undefined);assert.deepEqual(h.s.state.writes,[]);noInterruption(h);
  assert.deepEqual(h.outcomes,[{accepted:false,knownRefused:true}],'trusted backend must distinguish a proven refusal from an unknown transport outcome');
 }finally{await h.dispose();}
});

test('actual known input refusal does not poison ledger; explicit remote revoke plus fresh ledger/backend lease permits next input',async()=>{
 const h=await coupled();try{
  const old=await h.attach();h.scopes.get(old.generation).current=false;
  assert.equal((await h.ledger.input(FIRST,request(old,0,'never written old command'))).ok,false);assert.deepEqual(h.s.state.writes,[]);noInterruption(h);
  assert.equal(h.ledger.stats('session1').inputUnverified,false,'known non-acceptance must not mark a surviving Session ambiguous');
  assert.equal((await h.ledger.input(FIRST,request(old,1,'old lease must not dispatch'))).ok,false);assert.equal(h.calls.length,1);
  // A main-owned adapter must explicitly retire the remotely installed old
  // lease. The knownRefused vocabulary itself grants no backend revocation.
  await revokeBackend(h,old);const fresh=await h.attach(SECOND);assert(fresh.generation>old.generation);
  assert.equal((await h.s.backend.input({ownerId:h.p.ownerId,leaseId:old.leaseId,generation:old.generation,inputSequence:0,data:'old backend token'},h.s.guard)).accepted,false);
  const packet=request(fresh,0,'fresh ledger-derived input',SECOND),receipt=await h.ledger.input(SECOND,packet);
  assert.equal(receipt.ok,true);assert.equal(receipt.value.accepted,true);assert.equal((await h.ledger.input(SECOND,packet)).ok,true);
  assert.deepEqual(h.s.state.writes,['fresh ledger-derived input']);assert.equal(h.calls.length,2);assert.equal(h.calls[1].windowId,SECOND.windowId);
  assert.equal(h.ledger.stats('session1').pendingInputs,0);assert.equal(h.ledger.stats('session1').queuedInputUtf8Bytes,0);noInterruption(h);
 }finally{await h.dispose();}
});

test('pure private callback known refusal drops the old lease/queue without claiming accepted or poisoning future attachment',async()=>{
 let release;const calls=[];let refuse=true;
 const ledger=new TerminalSessionLedger({writeInput:packet=>{calls.push(packet);return refuse?new Promise(resolve=>release=()=>resolve(Object.freeze({accepted:false,knownRefused:true}))):Object.freeze({accepted:true});}});
 ledger.register(SPEC);ledger.resumeInput();const old=ledger.attach(FIRST,'session1').value;
 const active=ledger.input(FIRST,request(old,0,'known refused')),queued=ledger.input(FIRST,request(old,1,'drop queued'));
 release();assert.equal((await active).ok,false);assert.equal((await queued).ok,false);await inertTick();
 assert.equal(ledger.stats('session1').inputUnverified,false,'a private explicit refusal is not transport uncertainty');
 assert.equal(ledger.stats('session1').pendingInputs,0);assert.equal(ledger.stats('session1').queuedInputUtf8Bytes,0);assert.equal(calls.length,1);
 assert.equal((await ledger.input(FIRST,request(old,2,'old refused lease'))).ok,false);assert.equal(calls.length,1);
 refuse=false;const attached=ledger.attach(SECOND,'session1');assert.equal(attached.ok,true);
 assert.equal((await ledger.input(SECOND,request(attached.value,0,'fresh callback input',SECOND))).ok,true);assert.equal(calls.length,2);
});

for(const transition of ['close','detach'])test(`late known refusal after ${transition} cannot revoke a newer installed lease or drain fresh input under old authority`,async()=>{
 const h=await coupled({holdFirstResult:true});try{
  const old=await h.attach();h.scopes.get(old.generation).current=false;
  const active=h.ledger.input(FIRST,request(old,0,'held old refusal')),oldQueued=h.ledger.input(FIRST,request(old,1,'old queued must drop'));
  await waitUntil(()=>h.outcomes.length===1,'actual backend must settle old refusal before its ledger delivery is held');assert.deepEqual(h.s.state.writes,[]);
  if(transition==='close'){
   h.ledger.closeInput('lock');assert.equal((await h.s.backend.sendGate({generation:2,open:false})).ok,true);
   assert.equal((await h.s.backend.sendGate({generation:3,open:true})).ok,true);h.ledger.resumeInput();
  }else{assert.equal(h.ledger.detach(FIRST,'session1',old).ok,true);await revokeBackend(h,old);}
  assert.equal((await oldQueued).ok,false);const fresh=await h.attach(SECOND);
  const freshInput=h.ledger.input(SECOND,request(fresh,0,'newer lease input',SECOND));
  assert.equal(h.calls.length,1,'new queue remains behind the actually unsettled old ledger callback');assert.deepEqual(h.s.state.writes,[]);
  h.releaseFirst();assert.equal((await active).ok,false);const receipt=await freshInput;await inertTick();
  assert.equal(h.ledger.stats('session1').inputUnverified,false,'late known refusal belongs only to its old lease');
  assert.equal(receipt.ok,true);assert.equal(receipt.value.accepted,true);assert.equal(h.ledger.snapshot()[0].attachedWindowId,SECOND.windowId);
  assert.deepEqual(h.s.state.writes,['newer lease input']);assert.deepEqual(h.calls.map(row=>[row.generation,row.windowId]),[[old.generation,FIRST.windowId],[fresh.generation,SECOND.windowId]]);
  assert.equal(h.ledger.stats('session1').pendingInputs,0);assert.equal(h.ledger.stats('session1').queuedInputUtf8Bytes,0);noInterruption(h);
 }finally{await h.dispose();}
});

test('actual correlated LEASE_STALE input reply is known refused and fresh post-Lock input can resume without replay',async()=>{
 const h=await coupled();try{
  const old=await h.attach(),scope={sessionId:h.p.sessionId,channelId:h.p.channelId};h.s.holdWrite('main','command');
  const input=h.ledger.input(FIRST,request(old,0,'held old wire input'));
  await waitUntil(()=>h.s.group('session1').lanes.command.writes.main,'actual input dispatch must wait before creator receives it');
  const packet=decodeTerminalCommandRequest(heldFrame(h,'main'),scope);assert(packet);assert.equal(packet.op,'input');assert.equal(packet.token.leaseId,old.leaseId);
  assert.equal((await h.s.backend.sendGate({generation:2,open:false})).ok,true);assert.equal(h.s.group('session1').creator.stats().session.commands.leased,false);
  h.s.releaseWrites();h.s.holdWrite('creator','command');
  await waitUntil(()=>h.s.group('session1').lanes.command.writes.creator,'actual creator refusal reply must be observable before delivery');
  const reply=validateTerminalCommandReply(heldFrame(h,'creator'),scope);assert(reply);assert.equal(reply.status,'failed');assert.equal(reply.code,'LEASE_STALE');
  assert.equal(reply.requestId,packet.requestId);assert.equal(reply.op,packet.op);assert.deepEqual(reply.token,packet.token);
  h.s.releaseWrites();assert.equal((await input).ok,false);assert.deepEqual(h.s.state.writes,[]);noInterruption(h);
  assert.deepEqual(h.outcomes,[{accepted:false,knownRefused:true}]);assert.equal(h.ledger.stats('session1').inputUnverified,false);
  assert.equal((await h.s.backend.sendGate({generation:3,open:true})).ok,true);const fresh=await h.attach(SECOND);
  assert.equal((await h.ledger.input(SECOND,request(fresh,0,'fresh after wire refusal',SECOND))).ok,true);
  assert.deepEqual(h.s.state.writes,['fresh after wire refusal']);noInterruption(h);
 }finally{await h.dispose();}
});

test('actual lost input ACK after a real write remains unknown, fences ledger and never replays or auto-recovers',async()=>{
 const h=await coupled();try{
  const lease=await h.attach();h.s.holdWrite('creator','command');
  const active=h.ledger.input(FIRST,request(lease,0,'write happened but ACK lost')),queued=h.ledger.input(FIRST,request(lease,1,'never replay queued input'));
  await waitUntil(()=>h.s.state.writes.length===1&&h.s.group('session1').lanes.command.writes.creator,'real inert provider write and held accepted ACK must exist');
  const ack=validateTerminalCommandReply(heldFrame(h,'creator'),{sessionId:h.p.sessionId,channelId:h.p.channelId});assert(ack);assert.equal(ack.status,'accepted');assert.equal(ack.code,'COMMAND_ACCEPTED');
  h.s.group('session1').creator.dispose();h.s.releaseWrites();
  assert.equal((await active).ok,false);assert.equal((await queued).ok,false);await inertTick();
  assert.equal(h.outcomes.length,1);assert.equal(h.outcomes[0].accepted,false);assert.notEqual(h.outcomes[0].knownRefused,true,'a lost correlated ACK is never a proven refusal');
  assert.equal(h.ledger.stats('session1').inputUnverified,true);assert.equal(h.ledger.stats('session1').pendingInputs,0);assert.equal(h.ledger.stats('session1').queuedInputUtf8Bytes,0);
  assert.equal(h.ledger.attach(FIRST,'session1').code,'HOST_UNAVAILABLE');h.ledger.closeInput('lock');h.ledger.resumeInput();assert.equal(h.ledger.attach(SECOND,'session1').code,'HOST_UNAVAILABLE');
  assert.equal(h.calls.length,1);assert.deepEqual(h.s.state.writes,['write happened but ACK lost']);await waitUntil(()=>stops(h)===1,'actual unknown transport must retain fail-closed cleanup');
 }finally{await h.dispose();}
});

test('pure callback unmarked false, throw and malformed refusal flags remain unknown and unrecoverable',async t=>{
 const cases=[
  ['unmarked false',()=>({accepted:false})],['false flag',()=>({accepted:false,knownRefused:false})],['string flag',()=>({accepted:false,knownRefused:'true'})],['numeric flag',()=>({accepted:false,knownRefused:1})],
  ['missing accepted',()=>({knownRefused:true})],['nonboolean accepted',()=>({accepted:0,knownRefused:true})],['null',()=>null],['undefined',()=>undefined],['empty object',()=>({})],['throw',()=>{throw Error('INERT_UNKNOWN_CALLBACK');}],
 ];
 for(const [name,write]of cases)await t.test(name,async()=>{
  let calls=0;const ledger=new TerminalSessionLedger({writeInput:()=>{calls++;return write();}});ledger.register(SPEC);ledger.resumeInput();const lease=ledger.attach(FIRST,'session1').value;
  assert.equal((await ledger.input(FIRST,request(lease))).ok,false);await inertTick();assert.equal(ledger.stats('session1').inputUnverified,true);
  assert.equal(ledger.stats('session1').pendingInputs,0);assert.equal(ledger.stats('session1').queuedInputUtf8Bytes,0);ledger.closeInput('lock');ledger.resumeInput();assert.equal(ledger.attach(FIRST,'session1').code,'HOST_UNAVAILABLE');assert.equal(calls,1);
 });
});

test('pure accepted true keeps its known ACK semantics even if a knownRefused flag is also present',async()=>{
 let calls=0;const ledger=new TerminalSessionLedger({writeInput:()=>{calls++;return Object.freeze({accepted:true,knownRefused:true});}});
 ledger.register(SPEC);ledger.resumeInput();const lease=ledger.attach(FIRST,'session1').value,packet=request(lease);
 const receipt=await ledger.input(FIRST,packet);assert.equal(receipt.ok,true);assert.equal(receipt.value.accepted,true);assert.equal(ledger.stats('session1').inputUnverified,false);
 assert.equal((await ledger.input(FIRST,packet)).ok,true);assert.equal(calls,1);
});
