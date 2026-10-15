// Real production JS composed over deliberately synthetic bounded native DATA.
// Pure integration evidence only, never native/Windows/PTy/shell qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertProductionComposition,inertConfig,inertTick,INERT_SHELL} from './fixtures/terminal-production-inert.mjs';

const count=(s,name)=>s.state.trace.filter(r=>r.name===name).length;
const waitUntil=async(fn,label)=>{for(let n=0;n<200&&!fn();n++)await inertTick();assert(fn(),label);};
async function allocate(s,config=inertConfig()){
 if(s.backend.stats().generation===0)assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);
 const p=s.backend.prepare(config,s.guard);assert.equal(p.ok,true);assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true);return p;
}
async function ready(s,config=inertConfig()){const p=await allocate(s,config);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,true);return p;}
const lease=(ownerId,leaseId='lease1',generation=1)=>({ownerId,windowId:'window1',epoch:4,leaseId,generation});
const input=(p,data='typed inert text\r',inputSequence=0,leaseId='lease1',generation=1)=>({ownerId:p.ownerId,leaseId,generation,inputSequence,data});
const stop=(s,p,deadlineMs=500)=>s.backend.stopSession({ownerId:p.ownerId,deadlineMs,code:77});

test('actual ownership + creator + backend allocate before connecting all three lanes',async()=>{
 const s=createInertProductionComposition();
 try{
  assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);
  const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);
  assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true,'actual adapter must permit backend allocation before peer connect');
  assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);assert.equal(count(s,'accept'),0);assert.equal(s.group('session1').creator.stats().connectPending,3);
  const connected=await s.backend.connect({ownerId:p.ownerId},s.guard);assert.equal(connected.ok,true);
  assert.equal(s.state.loads,1);assert.equal(s.state.spawns.length,1);assert.equal(s.state.spawns[0].executable,INERT_SHELL);
  assert.equal(await s.group('session1').creator.ready,true);assert.equal(s.group('session1').creator.stats().authenticated,true);assert.equal(count(s,'accept'),3);assert.equal(count(s,'connect'),3);
  const names=s.state.trace.map(r=>r.name);assert(names.indexOf('listeners')<names.indexOf('create'));assert(names.indexOf('output-attached')<names.indexOf('watch'));assert(names.indexOf('watch')<names.indexOf('capture'));
  assert.equal(s.state.trace.find(r=>r.name==='provider-load').startupPhase,'preparing-provider');
  assert.equal(s.state.snapshotDuringAsync,0);assert.equal(s.backend.nativeExecutionAdmitted,false);
 }finally{await s.dispose();}
});
test('real UTF8 startup chunks reach one interactive spawn and caller mutation cannot change configuration',async()=>{
 const s=createInertProductionComposition();try{
  const config=inertConfig();config.shell.env.INERT_MARK='Ω'.repeat(10000);const original=config.shell.env.INERT_MARK,p=await allocate(s,config);
  config.cwd='D:\\caller mutation';config.shell.env.INERT_MARK='changed';assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,true);
  const g=s.group('session1'),spawn=s.state.spawns[0];assert(g.creator.stats().session.startup.receivedChunks>1);assert.equal(g.creator.stats().session.startup.rawReservedBytes,0);assert.equal(s.state.spawns.length,1);
  assert.deepEqual(spawn.args,['-NoLogo','-NoProfile']);assert.equal(spawn.options.cwd,'C:\\Project Ω Space');assert.equal(spawn.options.env.INERT_MARK,original);assert.equal(spawn.options.useConpty,true);assert.equal(spawn.options.useConptyDll,false);assert.equal(spawn.options.handleFlowControl,false);assert.equal(spawn.options.cols,120);assert.equal(spawn.options.rows,40);
 }finally{await s.dispose();}
});
test('backend grants no input lease until actual install ACK crosses the native byte adapters',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);assert.equal((await s.backend.input(input(p),s.guard)).accepted,false);
  s.holdWrite('creator','command');const installing=s.backend.install(lease(p.ownerId),s.guard);
  await waitUntil(()=>s.group('session1').creator.stats().session.commands.leased,'creator must accept real install before held ACK');
  assert.equal((await s.backend.input(input(p,'before ACK'),s.guard)).accepted,false);assert.deepEqual(s.state.writes,[]);assert(s.pending('session1').writeBytes>0);
  s.releaseWrites();assert.equal((await installing).ok,true);assert.equal((await s.backend.input(input(p),s.guard)).accepted,true);assert.deepEqual(s.state.writes,['typed inert text\r']);
  assert.equal((await s.backend.resize({ownerId:p.ownerId,leaseId:'lease1',generation:1,cols:88,rows:29},s.guard)).accepted,true);assert.deepEqual(s.state.resizes,[[88,29]]);
 }finally{await s.dispose();}
});
test('input deduplication and conflicting duplicate refusal are enforced by actual creator authority',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);await s.backend.install(lease(p.ownerId),s.guard);
  assert.equal((await s.backend.input(input(p,'one real write'),s.guard)).accepted,true);assert.equal((await s.backend.input(input(p,'one real write'),s.guard)).accepted,true);
  assert.equal((await s.backend.input(input(p,'conflicting duplicate'),s.guard)).accepted,false);assert.deepEqual(s.state.writes,['one real write']);
  assert.equal((await s.backend.input(input(p,'next',1),s.guard)).accepted,true);assert.deepEqual(s.state.writes,['one real write','next']);assert.equal(s.state.spawns.length,1);
 }finally{await s.dispose();}
});
test('Lock immediately refuses commands while real background output remains readable, then needs a fresh lease',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);await s.backend.install(lease(p.ownerId),s.guard);s.emitOutput('session1','before Ω\r\n');
  const closing=s.backend.sendGate({generation:2,open:false});assert.equal((await s.backend.input(input(p,'blocked'),s.guard)).accepted,false);assert.equal((await closing).ok,true);
  assert.equal(s.ownership.assertSessionCurrent({sessionOwnerId:p.ownerId}),true);s.emitOutput('session1','background finished 😀\r\n');
  const h=await s.backend.readHistory({ownerId:p.ownerId,fromSequence:0,maxBytes:32768});assert.equal(h.chunk.data,'before Ω\r\nbackground finished 😀\r\n');assert.equal(count(s,'native-stop'),0);assert.equal(s.state.spawns.length,1);
  assert.equal((await s.backend.sendGate({generation:3,open:true})).ok,true);assert.equal((await s.backend.input(input(p,'old lease'),s.guard)).accepted,false);
  assert.equal((await s.backend.install(lease(p.ownerId,'lease2',2),s.guard)).ok,true);assert.equal((await s.backend.input(input(p,'fresh',0,'lease2',2),s.guard)).accepted,true);assert.deepEqual(s.state.writes,['fresh']);
 }finally{await s.dispose();}
});
test('planned Stop joins actual Session and every native peer closure without poisoning backend availability',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);const receipt=await stop(s,p);assert.equal(receipt.verifiedExited,true);assert.equal(s.ownership.snapshot().reservedSessions,0);assert.equal(s.group('session1').peerClosed,true);assert.equal(s.pending('session1').reads,0);assert.equal(s.pending('session1').writes,0);assert.equal(count(s,'native-stop'),1);assert.equal(count(s,'listeners-close'),1);assert.equal(s.state.snapshotDuringAsync,0);
  assert.equal(s.backend.isAvailable(),true);assert.equal(s.state.backendUnavailable,0);
 }finally{await s.dispose();}
});
test('early true peer closure cannot refund while actual native Session cleanup stays pending',async()=>{
 const s=createInertProductionComposition({manualNative:true});try{
  const p=await ready(s),stopping=stop(s,p);await waitUntil(()=>s.group('session1').peerClosed,'all synthetic native IO should settle');
  assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,false);assert.equal(s.backend.stats().retainedReservations,1);assert.equal(s.state.snapshotDuringAsync,0);
  s.completeNative('session1');assert.equal((await stopping).verifiedExited,true);assert.equal(s.ownership.snapshot().reservedSessions,0);
 }finally{await s.dispose();}
});
test('validated native final observation cannot refund before all peer receipts settle',async()=>{
 const s=createInertProductionComposition({manualPeerClose:true});try{
  const p=await ready(s),stopping=stop(s,p);await waitUntil(()=>s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,'native receipt must arrive');
  assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,false);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.group('session1').peerClosed,false);
  s.completePeers('session1');assert.equal((await stopping).verifiedExited,true);assert.equal(s.ownership.snapshot().reservedSessions,0);
 }finally{await s.dispose();}
});
test('retired read operations remain charged until synthetic cancellation actually settles',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);await waitUntil(()=>s.pending('session1').reads===6,'one real native adapter read for each lane-side');s.holdReadCancellation('session1');const stopping=stop(s,p);
  await waitUntil(()=>s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,'native exit must arrive independently');assert.equal(s.pending('session1').reads,6);assert.equal(s.pending('session1').readBytes,6*32768);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.group('session1').peerClosed,false);
  for(const stream of Object.values(s.group('session1').creatorStreams))assert.equal(stream.stats().readPending,true);
  s.releaseReads();assert.equal((await stopping).verifiedExited,true);assert.equal(s.pending('session1').readBytes,0);
 }finally{await s.dispose();}
});
test('a held command ACK keeps native write ownership while control and history still respond through Lock',async()=>{
 const s=createInertProductionComposition({deadlineMs:150,manualNative:true});try{
  const p=await ready(s);await s.backend.install(lease(p.ownerId),s.guard);s.holdWrite('creator','command');const writing=s.backend.input(input(p,'known provider write'),s.guard);
  await waitUntil(()=>s.state.writes.length===1&&s.pending('session1').writes>0,'real input executes once while its ACK is held');
  assert.equal((await s.backend.sendGate({generation:2,open:false})).ok,true);s.emitOutput('session1','output during command backpressure\r\n');const h=await s.backend.readHistory({ownerId:p.ownerId,fromSequence:0,maxBytes:32768});assert.equal(h.chunk.data,'output during command backpressure\r\n');
  assert.equal((await writing).accepted,false);assert.deepEqual(s.state.writes,['known provider write']);assert.equal((await s.backend.input(input(p,'do not retry'),s.guard)).accepted,false);
  assert(s.pending('session1').writeBytes>0);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(count(s,'native-stop'),1);
  s.completeNative('session1');await inertTick();assert.equal(s.ownership.snapshot().reservedSessions,1);s.releaseWrites();await waitUntil(()=>s.ownership.snapshot().reservedSessions===0,'actual late IO settlement releases owner');assert.deepEqual(s.state.writes,['known provider write']);
 }finally{await s.dispose();}
});
test('Lock during actual creator provider preparation prevents late spawn and performs owned rollback',async()=>{
 const s=createInertProductionComposition({manualProvider:true});try{
  const p=await allocate(s),connecting=s.backend.connect({ownerId:p.ownerId},s.guard);await waitUntil(()=>s.state.loads===1,'typed start must reach provider');assert.equal(s.state.spawns.length,0);
  assert.equal((await s.backend.sendGate({generation:2,open:false})).ok,true);s.releaseProvider('session1');assert.equal((await connecting).ok,false);await waitUntil(()=>s.ownership.snapshot().reservedSessions===0,'root-only actual synthetic cleanup should finish');
  assert.equal(s.state.spawns.length,0);assert.equal(count(s,'watch'),0);assert.equal(count(s,'native-stop'),1);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,false);
 }finally{await s.dispose();}
});
test('ambiguous shell provider retains reservation until actual root-only native cleanup completes',async()=>{
 const s=createInertProductionComposition({spawnAmbiguous:true,manualNative:true});try{
  const p=await allocate(s);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,false);await waitUntil(()=>count(s,'native-stop')===1,'owned async cleanup must start');
  assert.equal(s.state.spawns.length,1);assert.equal(count(s,'watch'),0);assert.equal(count(s,'capture'),0);assert.equal(s.group('session1').creator.stats().providerUnknown,true);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,false);
  assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,false);s.completeNative('session1');await waitUntil(()=>s.ownership.snapshot().reservedSessions===0,'actual known creator root + active0 cleanup may release');assert.equal(s.state.spawns.length,1);
 }finally{await s.dispose();}
});
test('ambiguous native create cannot manufacture exit from peer closure or retry creation',async()=>{
 const s=createInertProductionComposition({createAmbiguous:true});try{
  assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,false);await waitUntil(()=>s.group('session1').peerClosed,'owned listeners must close');
  assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);assert.equal(count(s,'native-stop'),0);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,false);assert.equal(s.backend.stats().retainedReservations,1);assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,false);assert.equal(count(s,'create'),1);
 }finally{await s.dispose();}
});
test('real command HMAC mismatch refuses provider load and rolls back the owned Session',async()=>{
 const s=createInertProductionComposition({wrongCommandKey:true});try{
  const p=await allocate(s);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,false);await waitUntil(()=>s.ownership.snapshot().reservedSessions===0,'failed authentication actual cleanup');assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);assert.equal(count(s,'watch'),0);assert.equal(count(s,'native-stop'),1);
 }finally{await s.dispose();}
});
test('stopping one live Session leaves another usable through its real creator lease',async()=>{
 const s=createInertProductionComposition();try{
  const first=await ready(s),second=await ready(s,inertConfig('session2'));await s.backend.install(lease(second.ownerId),s.guard);
  assert.equal((await stop(s,first)).verifiedExited,true);assert.equal(s.backend.isAvailable(),true);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal((await s.backend.input(input(second,'second still live'),s.guard)).accepted,true);assert.deepEqual(s.state.writes,['second still live']);
  assert.equal(s.state.trace.filter(r=>r.name==='native-stop'&&r.sessionId==='session2').length,0);assert.equal(s.state.spawns.length,2);
 }finally{await s.dispose();}
});
test('actual bounded preparation refuses ninth reservation and refunds only settled listeners-only cleanup',async()=>{
 const s=createInertProductionComposition();try{
  await s.backend.sendGate({generation:1,open:true});const prepared=[];for(let n=0;n<8;n++){const p=s.backend.prepare(inertConfig('s'+n),s.guard);assert.equal(p.ok,true);prepared.push(p);}
  assert.equal(s.backend.prepare(inertConfig('ninth'),s.guard).ok,false);assert.equal(s.ownership.snapshot().reservedSessions,8);assert.equal(count(s,'create'),0);
  assert.equal((await stop(s,prepared[0])).verifiedExited,true);assert.equal(s.ownership.snapshot().reservedSessions,7);assert.equal(s.ownership.verifyExit({ownerId:prepared[0].ownerId}).identityKnown,false);
  assert.equal(s.backend.prepare(inertConfig('replacement'),s.guard).ok,true);assert.equal(s.ownership.snapshot().reservedSessions,8);assert.equal(s.state.loads,0);
 }finally{await s.dispose();}
});
test('lower or unauthorized epoch never creates a real creator lease or consumes fresh authority',async()=>{
 const s=createInertProductionComposition();try{
  const p=await ready(s);
  assert.equal((await s.backend.install({...lease(p.ownerId),epoch:3},s.guard)).ok,false);
  assert.equal((await s.backend.install({...lease(p.ownerId),epoch:5},{isCurrent:()=>false})).ok,false);
  assert.equal(s.group('session1').creator.stats().session.commands.leased,false);
  assert.equal((await s.backend.input(input(p,'forged epoch'),s.guard)).accepted,false);assert.deepEqual(s.state.writes,[]);
  assert.equal(count(s,'native-stop'),0);assert.equal(s.backend.stats().ready,1);
  assert.equal((await s.backend.install(lease(p.ownerId),s.guard)).ok,true,'undispatched refusals cannot consume generation1 or advance the epoch floor');
  assert.equal((await s.backend.input(input(p,'authorized epoch'),s.guard)).accepted,true);assert.deepEqual(s.state.writes,['authorized epoch']);
 }finally{await s.dispose();}
});
test('mismatched actual watch identity prevents running publication and retains unknown cleanup',async()=>{
 const s=createInertProductionComposition({watchIdentityMismatch:true});try{
  const p=await allocate(s);assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,false);await waitUntil(()=>s.group('session1').peerClosed&&s.group('session1').nativeExited,'synthetic cleanup settles without a valid expected shell');
  assert.equal(count(s,'watch'),1);assert.equal(count(s,'capture'),0);assert.equal(s.state.spawns.length,1);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,false);assert.equal(s.backend.stats().ready,0);
 }finally{await s.dispose();}
});
test('native active0 and peer true cannot refund an exact held-birth mismatch',async()=>{
 const s=createInertProductionComposition({finalIdentityMismatch:true,withHelper:true});try{
  const p=await ready(s);assert.equal((await stop(s,p)).ok,false);assert.equal(s.group('session1').nativeExited,true);assert.equal(s.group('session1').peerClosed,true);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,false);assert.equal(s.backend.stats().retainedReservations,1);
 }finally{await s.dispose();}
});
test('false peer-close observation cannot refund a validated native exit',async()=>{
 const s=createInertProductionComposition({peerCloseFalse:true});try{
  const p=await ready(s);assert.equal((await stop(s,p)).ok,false);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).identityKnown,true);assert.equal(s.ownership.verifyExit({ownerId:p.ownerId}).verifiedExited,false);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(count(s,'native-stop'),1);
 }finally{await s.dispose();}
});
test('outer Stop timeout remains failed after late actual provider settlement and later reconciliation',async()=>{
 const s=createInertProductionComposition({manualNative:true});try{
  const p=await ready(s),first=stop(s,p,5);assert.equal((await first).ok,false);assert.equal(s.ownership.snapshot().reservedSessions,1);assert.equal(s.backend.stats().retainedReservations,1);assert.equal(count(s,'native-stop'),1);
  s.completeNative('session1');await waitUntil(()=>s.ownership.snapshot().reservedSessions===0,'late synthetic receipt remains observed');assert.equal((await first).ok,false);assert.equal((await stop(s,p)).verifiedExited,true);assert.equal(s.backend.stats().retainedReservations,0);assert.equal(count(s,'native-stop'),1);
 }finally{await s.dispose();}
});
