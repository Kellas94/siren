// Permanent implementer-authored queued-write regression; original RED retained.
// Actual production byte adapters, synthetic DATA only; no native execution.
// This isolates byte queue scheduling before main protocol/channel creation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createInertProductionComposition,inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';

const waitUntil=async(fn,label)=>{for(let n=0;n<100&&!fn();n++)await inertTick();assert(fn(),label);};

test('synthetic native write slot must be free before each actual adapter issues its queued continuation',async()=>{
 const s=createInertProductionComposition({deadlineMs:1000});
 try{
  assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);
  const p=s.backend.prepare(inertConfig(),s.guard);assert.equal(p.ok,true);
  assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true);
  const connected=await s.ownership.connectSession({sessionOwnerId:p.ownerId,deadlineMs:1000});
  assert.equal(connected.ok,true);
  const main=connected.transport.history.stream,creator=s.group('session1').creatorStreams.history;
  // No main protocol channel is installed. Drain only the creator's initial
  // auth bytes; both sides still use their original actual native adapters.
  main.on('data',bytes=>bytes.fill(0));
  await waitUntil(()=>main.stats().readPending&&creator.stats().readPending&&s.pending('session1').writes===0,'both history adapters must have actual pending reads and no initial write');
  s.holdWrite('main','history');s.holdWrite('creator','history');
  const before={main:main.stats().writeOperations,creator:creator.stats().writeOperations};
  // Two fragments form a valid bounded but incomplete frame header (100-byte
  // body), so the creator parser cannot reject a completed malformed packet.
  // Each side should retain one native write and exactly one queued write.
  for(const stream of [main,creator]){
   assert.equal(stream.write(Buffer.from([0,0])),true);
   assert.equal(stream.write(Buffer.from([0,100])),true);
   assert.equal(stream.stats().readPending,true);
   assert.equal(stream.stats().readReservedBytes,32768);
   assert.equal(stream.stats().writePending,true);
   assert.equal(stream.stats().inFlightWriteBytes,2);
   assert.equal(stream.stats().queuedFrames,1);
   assert.equal(stream.stats().queuedWriteBytes,2);
   assert.equal(stream.stats().writableLength,4);
  }
  assert.equal(s.pending('session1').writes,2);
  assert.equal(s.pending('session1').writeBytes,4);
  console.log(JSON.stringify({synthetic:true,nativeExecutionAdmitted:false,phase:'held-before-release',main:main.stats(),creator:creator.stats(),pending:s.pending('session1')}));
  s.releaseWrites();
  await waitUntil(()=>main.stats().retired||creator.stats().retired||main.stats().writeOperations>=before.main+2&&creator.stats().writeOperations>=before.creator+2&&main.stats().writableLength===0&&creator.stats().writableLength===0,'both queued continuations must attempt or retire');
  console.log(JSON.stringify({synthetic:true,nativeExecutionAdmitted:false,phase:'after-release',main:main.stats(),creator:creator.stats(),pending:s.pending('session1')}));
  assert.deepEqual({mainRetired:main.stats().retired,creatorRetired:creator.stats().retired},{mainRetired:false,creatorRetired:false},'queued byte writes must not spuriously retire either actual adapter');
  assert.equal(main.stats().writeOperations,before.main+2);
  assert.equal(creator.stats().writeOperations,before.creator+2);
  assert.equal(main.stats().writableLength,0);
  assert.equal(creator.stats().writableLength,0);
 }finally{await s.dispose();}
});
