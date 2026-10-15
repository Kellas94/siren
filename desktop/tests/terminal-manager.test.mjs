import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalPolicy} from '../src/terminal/policy.mjs';
import {TerminalAggregateGateLink} from '../src/terminal/aggregate-gate.mjs';
import {TerminalGateLink,createGateResponder} from '../src/terminal/gate-link.mjs';
import {HostInputGate} from '../src/terminal/input-gate.mjs';
import {TerminalCreatorHistory} from '../src/terminal/remote-output.mjs';
const {TerminalManager}=await import('../src/terminal/manager.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture(overrides={}){
 assert.equal(typeof TerminalManager,'function','TerminalManager implementation required');
 let current=true,unlocked=true,gateGeneration=0;
 const workspace=Object.freeze({windowId:'w1',projectId:'p1',epoch:3,role:'workspace'}),terminal=Object.freeze({windowId:'t1',projectId:'p1',epoch:3,role:'terminal'});
 const grants=new Set([workspace,terminal]),owners=new Map(),channels=new Map(),calls={start:[],watch:[],stop:[],all:[],write:[],resize:[],close:[],reserve:[],bind:[],release:[]};
 const registry={isCurrent:g=>current&&grants.has(g),captureAdmissionGuard:g=>{const admitted=current&&grants.has(g);return {isCurrent:()=>admitted&&current&&grants.has(g)};}};
 const policy=new TerminalPolicy({isCurrentGrant:registry.isCurrent,isUnlocked:()=>unlocked,getMode:()=> 'normal',isCurrentLease:()=>true,canExecute:()=>true});
 const ownership={
  createSession:p=>{calls.start.push(p);const id='owner_'+calls.start.length;owners.set(id,false);return {ok:true,sessionOwnerId:id};},
  watchSessionRoot:p=>{calls.watch.push(p);return {ok:true};},
  stopSession:async p=>{calls.stop.push(p);owners.set(p.sessionOwnerId,true);return {ok:true,verifiedExited:true};},
  stopAll:async p=>{calls.all.push(p);owners.set('common_owner',true);return {ok:true,verifiedExited:true};},
  verifyExit:({ownerId})=>({identityKnown:owners.has(ownerId),verifiedExited:owners.get(ownerId)===true,remainingCount:owners.get(ownerId)?0:1}),
  ...overrides.ownership,
 };
 const sessionTransport={
  connect:async({sessionId})=>{const channelId='channel_'+sessionId;channels.set(sessionId,channelId);return {channelId,shellProcessIdentity:{pid:42,image:'C:\\Windows\\powershell.exe',since:1n}};},
  isCurrentSession:(sessionId,channelId)=>channels.get(sessionId)===channelId,
  writeInput:async p=>{calls.write.push(p);return {accepted:true};},
  resize:async p=>{calls.resize.push(p);return {accepted:true};},
  ...overrides.sessionTransport,
 };
 const inputFence={
  closeInput:async reason=>{calls.close.push(reason);return {ok:true,localInputFenced:true,hostAcknowledged:true,generation:++gateGeneration};},
  resumeInput:async()=>({ok:true,localInputFenced:false,hostAcknowledged:true,generation:++gateGeneration}),
  reserve:sessionId=>{calls.reserve.push(sessionId);return {ok:true};},
  bind:async(sessionId,channelId)=>{calls.bind.push({sessionId,channelId});return {ok:true};},
  release:sessionId=>{calls.release.push(sessionId);return {ok:true};},
  ...overrides.inputFence,
 };
 const cwdAuthority={resolve:async()=> 'D:\\Lucru Știință',revoke:()=>{},pick:async()=>({cwdId:'cwd1',projectId:'p1',displayPath:'D:\\Lucru Știință'}),...overrides.cwdAuthority};
 const profilesFor=g=>({resolveShellProfile:async()=>({executable:'C:\\Windows\\powershell.exe',args:['-NoLogo','-NoProfile'],env:{SystemRoot:'C:\\Windows'}}),listShellProfiles:async()=>[{profileId:'powershell',label:'PowerShell',available:true}]});
 const atomicStarter={prepare:async()=>({executable:'C:\\siren\\electron.exe',entry:'C:\\siren\\creator.mjs',directory:'D:\\private-bootstrap'}),...overrides.atomicStarter};
 const manager=new TerminalManager({registry,policy,cwdAuthority,profilesFor,ownership,hostOwnerId:'common_owner',sessionTransport,inputFence,aggregateGateLink:overrides.aggregateGateLink,atomicStarter,outputMode:overrides.outputMode,deadlineMs:overrides.deadlineMs??10000});
 const create=(n=0)=>manager.create(workspace,{operationId:'create_'+n,epoch:3,cwdId:'cwd1',profileId:'powershell',cols:100,rows:30});
 const payload=(sessionId,extra={})=>({operationId:'op',epoch:3,sessionId,...extra});
 return {manager,workspace,terminal,grants,owners,channels,calls,create,payload,async open(){assert.equal((await manager.resumeInput()).ok,true);},async attach(id){const r=await manager.attach(terminal,payload(id));assert.equal(r.ok,true);return {sessionId:id,leaseId:r.value.leaseId,generation:r.value.generation};},output(id,data){return manager.sessionOutput({sessionId:id,channelId:channels.get(id),data});},setCurrent:v=>{current=v;},setUnlocked:v=>{unlocked=v;}};
}

test('remote manager reads creator history without creating a duplicate main ring',async()=>{
 let history;const reads=[],f=fixture({outputMode:'remote',sessionTransport:{readHistory:async q=>{reads.push(q);return history.read({sessionId:q.sessionId,fromSequence:q.fromSequence,maxBytes:q.maxBytes});}}});await f.open();const made=await f.create();assert.equal(made.ok,true);history=new TerminalCreatorHistory(made.value.sessionId);history.append('creator startup\r\n');const token=await f.attach(made.value.sessionId);
 const r=await f.manager.deliverAvailable(f.terminal,f.payload(token.sessionId,token));assert.equal(r.value.chunk.data,'creator startup\r\n');assert.equal(f.manager.stats().output.retainedUtf8Bytes,0);assert.equal(f.output(token.sessionId,'main must not ingest').ok,false);assert.equal(reads.length,1);assert.equal(reads[0].channelId,f.channels.get(token.sessionId));assert.equal(f.manager.ack(f.terminal,f.payload(token.sessionId,{...token,throughSequence:r.value.chunk.utf8Bytes})).ok,true);
});
test('remote mode without an authenticated history provider never falls back to local output',async()=>{const f=fixture({outputMode:'remote'});assert.equal((await f.manager.resumeInput()).ok,false);assert.equal((await f.create()).ok,false);assert.equal(f.calls.start.length,0);});
test('remote manager Lock suppresses pending history without stopping ownership',async()=>{const wait=deferred(),f=fixture({outputMode:'remote',sessionTransport:{readHistory:()=>wait.promise}});await f.open();const made=await f.create(),token=await f.attach(made.value.sessionId);const pending=f.manager.deliverAvailable(f.terminal,f.payload(token.sessionId,token));const locked=f.manager.closeInput('lock');assert.equal((await pending).ok,false);assert.equal(f.calls.stop.length,0);assert.equal(f.calls.all.length,0);wait.resolve({firstSequence:0,endSequence:4,chunk:{sequence:0,data:'late',utf8Bytes:4}});await locked;await tick();assert.equal(f.manager.stats().output.outstandingUtf8Bytes,0);});
test('remote manager rejects result if native caller becomes stale while reading',async()=>{const wait=deferred(),f=fixture({outputMode:'remote',sessionTransport:{readHistory:()=>wait.promise}});await f.open();const made=await f.create(),token=await f.attach(made.value.sessionId);const pending=f.manager.deliverAvailable(f.terminal,f.payload(token.sessionId,token));f.setCurrent(false);wait.resolve({firstSequence:0,endSequence:4,chunk:{sequence:0,data:'late',utf8Bytes:4}});assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.manager.stats().output.outstandingUtf8Bytes,0);});

test('unconfigured manager and closed manager never allocate native owners',async()=>{
 assert.equal(typeof TerminalManager,'function');const m=new TerminalManager();assert.equal(m.nativeExecutionAdmitted,false);
 assert.equal((await m.resumeInput()).ok,false);
 const f=fixture();assert.equal((await f.create()).code,'PIN_REQUIRED');assert.equal(f.calls.start.length,0);
});

test('create retains owner through readiness then registers one coherent session',async()=>{
 const wait=deferred(),f=fixture({sessionTransport:{connect:()=>wait.promise}});await f.open();const pending=f.create();await tick();
 assert.equal(f.calls.start.length,1);assert.equal((await f.manager.list(f.workspace,{operationId:'list',epoch:3})).value[0].state,'starting');
 f.channels.set(f.calls.start[0].sessionId,'channel_ready');wait.resolve({channelId:'channel_ready',shellProcessIdentity:{pid:42,image:'C:\\Windows\\powershell.exe',since:1n}});
 const result=await pending;assert.equal(result.ok,true);assert.equal(result.value.state,'running');assert.equal(f.calls.watch.length,1);
 assert.equal(f.manager.stats().output.sessions,1);assert.equal(f.manager.stats().ledgerSessions,1);
 assert.deepEqual(Object.keys(result.value).sort(),['sessionId','projectId','profileId','cwdDisplay','state','exitCode','droppedUtf8Bytes','attachedWindowId'].sort());
});

test('readiness failure cleans already allocated owner before reclaiming every registry',async()=>{
 const f=fixture({sessionTransport:{connect:async()=>{throw Error('ready failed');}}});await f.open();assert.equal((await f.create()).ok,false);
 assert.equal(f.calls.stop[0].sessionOwnerId,'owner_1');assert.equal(f.manager.stats().ledgerSessions,0);assert.equal(f.manager.stats().output.sessions,0);
});

test('watch failure rolls back known owner and never publishes a lease',async()=>{
 const f=fixture({ownership:{watchSessionRoot:()=>({ok:false})}});await f.open();assert.equal((await f.create()).ok,false);assert.equal(f.calls.stop.length,1);
 const s=(await f.manager.list(f.workspace,{operationId:'list',epoch:3})).value[0];assert.equal(s.state,'exited');assert.equal((await f.manager.attach(f.terminal,f.payload(s.sessionId))).ok,false);
});

test('Lock during readiness rejects late running publication and cleans the exact owner',async()=>{
 const wait=deferred(),f=fixture({sessionTransport:{connect:()=>wait.promise}});await f.open();const pending=f.create();await tick();const lock=f.manager.closeInput('lock');
 f.channels.set(f.calls.start[0].sessionId,'late_channel');wait.resolve({channelId:'late_channel',shellProcessIdentity:{pid:42,image:'C:\\Windows\\powershell.exe',since:1n}});
 assert.equal((await pending).ok,false);await lock;assert.equal(f.calls.stop[0].sessionOwnerId,'owner_1');assert.equal(f.calls.watch.length,0);assert.equal(f.manager.stats().ledgerSessions,0);
});

test('Lock during bootstrap preparation causes zero owner allocation',async()=>{
 const wait=deferred(),f=fixture({atomicStarter:{prepare:()=>wait.promise}});await f.open();const pending=f.create();await tick();const locked=f.manager.closeInput('lock');
 wait.resolve({executable:'C:\\siren\\electron.exe',entry:'C:\\siren\\creator.mjs',directory:'D:\\private-bootstrap'});assert.equal((await pending).ok,false);await locked;assert.equal(f.calls.start.length,0);
});

test('eight pending starts reserve capacity; verified Stop allows a lifetime ninth in all registries',async()=>{
 const wait=deferred(),f=fixture({cwdAuthority:{resolve:()=>wait.promise}});await f.open();const pending=Array.from({length:8},(_,i)=>f.create(i));
 assert.equal((await f.create(9)).code,'CAPACITY_EXCEEDED');wait.resolve('D:\\work');const made=await Promise.all(pending);assert.ok(made.every(r=>r.ok));
 const lease=await f.attach(made[0].value.sessionId);f.output(lease.sessionId,'old data');await f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease));
 assert.equal((await f.manager.stop(f.workspace,f.payload(lease.sessionId))).ok,true);assert.equal(f.manager.stats().output.outstandingUtf8Bytes,0);
 const ninth=await f.create(9);assert.equal(ninth.ok,true);assert.equal(f.manager.stats().ledgerSessions,8);assert.equal(f.manager.stats().output.sessions,8);
});

test('Stop revokes input and output synchronously before cleanup completes',async()=>{
 const wait=deferred(),f=fixture({ownership:{stopSession:()=>wait.promise}});await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);
 const stopping=f.manager.stop(f.workspace,f.payload(lease.sessionId));
 assert.equal((await f.manager.input(f.terminal,f.payload(lease.sessionId,{...lease,inputSequence:0,data:'must not write'}))).ok,false);
 assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease))).ok,false);assert.equal(f.calls.write.length,0);
 f.owners.set('owner_1',true);wait.resolve({ok:true,verifiedExited:true});assert.equal((await stopping).ok,true);
});

test('failed Stop retains session capacity and refuses further input',async()=>{
 const f=fixture({ownership:{stopSession:async()=>({ok:false})}});await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);
 assert.equal((await f.manager.stop(f.workspace,f.payload(lease.sessionId))).code,'CLEANUP_FAILED');assert.equal(f.manager.stats().ledgerSessions,1);
 assert.equal((await f.manager.input(f.terminal,f.payload(lease.sessionId,{...lease,inputSequence:0,data:'no'}))).ok,false);assert.equal(f.calls.write.length,0);
});

test('attachment replacement shares input/output identity and refuses old or foreign leases',async()=>{
 const f=fixture();await f.open();const made=await f.create(),a=await f.attach(made.value.sessionId);f.output(a.sessionId,'abc');
 assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(a.sessionId,a))).value.chunk.data,'abc');const b=await f.attach(a.sessionId);
 assert.equal(f.manager.stats().output.outstandingUtf8Bytes,0);assert.equal((await f.manager.ack(f.terminal,f.payload(a.sessionId,{...a,throughSequence:3}))).ok,false);
 assert.equal((await f.manager.input(f.terminal,f.payload(a.sessionId,{...a,inputSequence:0,data:'stale'}))).ok,false);
 assert.equal((await f.manager.input(f.workspace,f.payload(b.sessionId,{...b,inputSequence:0,data:'workspace'}))).ok,false);
 assert.equal((await f.manager.input({...f.terminal},f.payload(b.sessionId,{...b,inputSequence:0,data:'forged'}))).ok,false);
 assert.equal((await f.manager.input(f.terminal,f.payload(b.sessionId,{...b,inputSequence:0,data:'ok'}))).ok,true);assert.equal(f.calls.write.length,1);
});

test('input uses separate gate generation and attachment generation with duplicate suppression',async()=>{
 const f=fixture();await f.open();const made=await f.create();await f.attach(made.value.sessionId);await f.attach(made.value.sessionId);const lease=await f.attach(made.value.sessionId);
 const p=f.payload(lease.sessionId,{...lease,inputSequence:0,data:'print(1)\r'});
 assert.equal((await f.manager.input(f.terminal,p)).ok,true);assert.equal((await f.manager.input(f.terminal,p)).ok,true);assert.equal(f.calls.write.length,1);
 assert.equal(f.calls.write[0].gateGeneration,2);assert.equal(f.calls.write[0].generation,3);assert.equal((await f.manager.input(f.terminal,{...p,data:'different'})).ok,false);
});

test('locked output stays bounded and replay emits zero input',async()=>{
 const f=fixture();await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);const locked=f.manager.closeInput('lock');
 for(let i=0;i<160;i++)assert.equal(f.output(lease.sessionId,'x'.repeat(32768)).ok,true);
 assert.equal(f.manager.stats().output.retainedUtf8Bytes,4194304);assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease))).ok,false);
 await locked;await f.open();const replay=await f.attach(lease.sessionId);assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(replay.sessionId,replay))).value.chunk.data.length,32768);
 assert.equal(f.calls.write.length,0);assert.equal(f.calls.stop.length,0);
});

test('all sessions share exactly2MiB output credit and keep draining when saturated',async()=>{
 const f=fixture();await f.open();const made=await Promise.all(Array.from({length:8},(_,i)=>f.create(i)));
 for(const s of made){const lease=await f.attach(s.value.sessionId);for(let j=0;j<9;j++)f.output(lease.sessionId,'a'.repeat(32768));for(let j=0;j<8;j++)assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease))).ok,true);assert.equal((await f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease))).code,'CAPACITY_EXCEEDED');}
 assert.equal(f.manager.stats().output.outstandingUtf8Bytes,2097152);
});

test('wrong-channel output and exit events have no state or cleanup effects',async()=>{
 const f=fixture();await f.open();const made=await f.create(),id=made.value.sessionId;
 assert.equal(f.manager.sessionOutput({sessionId:id,channelId:'wrong',data:'secret'}).ok,false);
 assert.equal((await f.manager.sessionExited({sessionId:id,channelId:'wrong'})).ok,false);assert.equal(f.calls.stop.length,0);assert.equal(f.manager.stats().output.retainedUtf8Bytes,0);
});

test('authenticated natural exit triggers owner cleanup proof before retiring capacity',async()=>{
 const f=fixture();await f.open();const made=await f.create(),id=made.value.sessionId;
 assert.equal((await f.manager.sessionExited({sessionId:id,channelId:f.channels.get(id)})).ok,true);
 assert.equal(f.calls.stop[0].sessionOwnerId,'owner_1');assert.equal(f.manager.stats().ledgerSessions,0);assert.equal(f.manager.stats().output.sessions,0);
 const s=(await f.manager.list(f.workspace,{operationId:'list',epoch:3})).value[0];assert.equal(s.state,'exited');assert.equal(s.exitCode,null);
});

test('late resize result after Lock refuses and cannot revive an old lease',async()=>{
 const wait=deferred(),f=fixture({sessionTransport:{resize:()=>wait.promise}});await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);
 const resizing=f.manager.resize(f.terminal,f.payload(lease.sessionId,{...lease,cols:120,rows:40}));const lock=f.manager.closeInput('lock');wait.resolve({accepted:true});assert.equal((await resizing).ok,false);await lock;
});

test('late open ACK after Lock leaves local ledger and output fenced',async()=>{
 const wait=deferred();let count=0;const f=fixture({inputFence:{resumeInput:()=>{count++;return wait.promise;}}});
 const opening=f.manager.resumeInput(),locked=f.manager.closeInput('lock');wait.resolve({ok:true,localInputFenced:false,hostAcknowledged:true,generation:2});
 assert.equal((await opening).ok,false);await locked;assert.equal((await f.create()).ok,false);assert.equal(count,1);
});

test('failed aggregate close ACK remains visible after immediate local refusal',async()=>{
 const f=fixture({inputFence:{closeInput:async()=>({ok:false})}});await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);
 const close=f.manager.closeInput('lock');assert.equal((await f.manager.input(f.terminal,f.payload(lease.sessionId,{...lease,inputSequence:0,data:'no'}))).ok,false);assert.equal((await close).ok,false);assert.equal(f.calls.write.length,0);
});

test('shutdown verifies Session families and the common owner',async()=>{
 const f=fixture();await f.open();await f.create();const done=await f.manager.shutdown('quit');assert.equal(done.ok,true);assert.equal(f.calls.all[0].hostOwnerId,'common_owner');assert.equal(f.manager.stats().ledgerSessions,0);assert.equal((await f.create(1)).ok,false);
});

test('shutdown refuses common-owner cleanup failure even if all Sessions close',async()=>{
 const f=fixture({ownership:{stopAll:async()=>({ok:false})}});await f.open();await f.create();assert.equal((await f.manager.shutdown('quit')).code,'CLEANUP_FAILED');
});

test('PIN and registry revocation refuse with no native side effects',async()=>{
 const f=fixture();await f.open();f.setUnlocked(false);assert.equal((await f.create()).ok,false);f.setUnlocked(true);f.setCurrent(false);assert.equal((await f.create()).ok,false);assert.equal(f.calls.start.length,0);
});

test('accessor payload is refused without evaluating the accessor',async()=>{
 const f=fixture();await f.open();let reads=0;const p={operationId:'create',epoch:3,cwdId:'cwd1',profileId:'powershell',cols:100};Object.defineProperty(p,'rows',{enumerable:true,get(){reads++;return 30;}});
 assert.equal((await f.manager.create(f.workspace,p)).code,'REQUEST_REFUSED');assert.equal(reads,0);assert.equal(f.calls.start.length,0);
});

test('state subscriptions are scoped and revoked at Lock',async()=>{
 const f=fixture();await f.open();const states=[];const dispose=f.manager.subscribeState(f.workspace,{operationId:'list',epoch:3},s=>states.push(s));assert.equal(typeof dispose,'function');
 await f.create();assert.ok(states.length>0);const count=states.length;await f.manager.closeInput('lock');await f.open();await f.create(1);assert.equal(states.length,count);dispose();
});

test('split oversized VT control is omitted with an explicit marker and resumes plain output',async()=>{
 const f=fixture();await f.open();const made=await f.create(),lease=await f.attach(made.value.sessionId);
 f.output(lease.sessionId,'before\x1b]52;c;'+ 'a'.repeat(4000));
 f.output(lease.sessionId,'a'.repeat(200)+'\x07after');
 let text='';for(let i=0;i<8;i++){const r=f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease));if(r.value?.chunk)text+=r.value.chunk.data;else break;}
 assert.ok(text.includes('before'));assert.ok(text.includes('after'));assert.ok(text.includes('Terminal control data omitted'));
 assert.ok(!text.includes('\x1b]52'));assert.ok(!text.includes('a'.repeat(200)));assert.ok((await f.manager.list(f.workspace,{operationId:'list',epoch:3})).value[0].droppedUtf8Bytes>4096);
});

test('transport input timeout closes all input and never replays a late accepted write',async()=>{
 const wait=deferred(),f=fixture({deadlineMs:20,sessionTransport:{writeInput:p=>{f.calls.write.push(p);return wait.promise;}}});await f.open();
 const made=await f.create(),lease=await f.attach(made.value.sessionId),p=f.payload(lease.sessionId,{...lease,inputSequence:0,data:'one'});
 assert.equal((await f.manager.input(f.terminal,p)).ok,false);assert.equal((await f.create(2)).ok,false);
 wait.resolve({accepted:true});await tick();await f.open();
 assert.equal(f.manager.attach(f.terminal,f.payload(lease.sessionId)).code,'HOST_UNAVAILABLE');
 assert.equal(f.calls.write.length,1);assert.equal((await f.manager.input(f.terminal,p)).ok,false);assert.equal(f.calls.write.length,1);
 assert.equal((await f.manager.stop(f.workspace,f.payload(lease.sessionId))).ok,true);
});

test('Lock during aggregate gate binding cleans the retained owner without publishing running',async()=>{
 const wait=deferred(),f=fixture({inputFence:{bind:()=>wait.promise}});await f.open();const pending=f.create();await tick();
 const locked=f.manager.closeInput('lock');wait.resolve({ok:true});assert.equal((await pending).ok,false);await locked;
 assert.equal(f.calls.stop[0].sessionOwnerId,'owner_1');assert.equal(f.manager.stats().ledgerSessions,0);assert.equal(f.manager.stats().output.sessions,0);
});

test('failure to retire aggregate reservation remains cleanup-failed despite dead process',async()=>{
 const f=fixture({inputFence:{release:()=>({ok:false})}});await f.open();const made=await f.create();
 assert.equal((await f.manager.stop(f.workspace,f.payload(made.value.sessionId))).code,'CLEANUP_FAILED');assert.equal(f.manager.stats().ownershipReservations,1);
 const state=f.manager.list(f.workspace,{operationId:'list',epoch:3}).value[0];assert.equal(state.state,'cleanup-failed');
});

test('reentrant state callback Lock prevents subsequent callbacks receiving state',async()=>{
 const f=fixture();await f.open();let later=0;f.manager.subscribeState(f.workspace,{operationId:'list1',epoch:3},()=>{f.manager.closeInput('lock');});
 f.manager.subscribeState(f.workspace,{operationId:'list2',epoch:3},()=>later++);assert.equal((await f.create()).ok,false);assert.equal(later,0);
});

test('oversized and accessor native output causes zero retained bytes',async()=>{
 const f=fixture();await f.open();const made=await f.create(),sessionId=made.value.sessionId;let reads=0;
 assert.equal(f.output(sessionId,'x'.repeat(32769)).ok,false);
 const e={sessionId,channelId:f.channels.get(sessionId)};Object.defineProperty(e,'data',{enumerable:true,get(){reads++;return 'unsafe';}});
 assert.equal(f.manager.sessionOutput(e).ok,false);assert.equal(reads,0);assert.equal(f.manager.stats().output.retainedUtf8Bytes,0);
});

test('known pre-Lock write acceptance refuses old delivery but permits fresh attachment and input',async()=>{
 const wait=deferred(),f=fixture({sessionTransport:{writeInput:p=>{f.calls.write.push(p);return f.calls.write.length===1?wait.promise:Promise.resolve({accepted:true});}}});await f.open();
 const made=await f.create(),lease=await f.attach(made.value.sessionId),p=f.payload(lease.sessionId,{...lease,inputSequence:0,data:'first'});
 const pending=f.manager.input(f.terminal,p);await f.manager.closeInput('lock');wait.resolve({accepted:true});assert.equal((await pending).ok,false);await tick();await f.open();
 const fresh=await f.attach(lease.sessionId);assert.equal(f.calls.write.length,1);
 assert.equal((await f.manager.input(f.terminal,f.payload(fresh.sessionId,{...fresh,inputSequence:0,data:'second'}))).ok,true);
 assert.deepEqual(f.calls.write.map(p=>p.data),['first','second']);
});

test('known acceptance under replaced lease preserves the new lease without replay',async()=>{
 const wait=deferred(),f=fixture({sessionTransport:{writeInput:p=>{f.calls.write.push(p);return f.calls.write.length===1?wait.promise:Promise.resolve({accepted:true});}}});await f.open();
 const made=await f.create(),lease=await f.attach(made.value.sessionId),p=f.payload(lease.sessionId,{...lease,inputSequence:0,data:'old'});
 const pending=f.manager.input(f.terminal,p),fresh=await f.attach(lease.sessionId);wait.resolve({accepted:true});assert.equal((await pending).ok,false);await tick();
 assert.equal((await f.manager.input(f.terminal,f.payload(fresh.sessionId,{...fresh,inputSequence:0,data:'new'}))).ok,true);
 assert.deepEqual(f.calls.write.map(p=>p.data),['old','new']);
});

test('authenticated startup output is captured before bind while renderer attachment remains refused',async()=>{
 const wait=deferred(),f=fixture({inputFence:{bind:()=>wait.promise}});await f.open();const pending=f.create();await tick();const sessionId=f.calls.start[0].sessionId;
 assert.equal(f.output(sessionId,'startup banner\r\n').ok,true);assert.equal(f.manager.attach(f.terminal,f.payload(sessionId)).ok,false);
 wait.resolve({ok:true});assert.equal((await pending).ok,true);const lease=await f.attach(sessionId);
 assert.equal(f.manager.deliverAvailable(f.terminal,f.payload(sessionId,lease)).value.chunk.data,'startup banner\r\n');assert.equal(f.calls.write.length,0);
});

test('early startup ring remains bounded and Lock cleanup releases it without exposing a view',async()=>{
 const wait=deferred(),f=fixture({inputFence:{bind:()=>wait.promise}});await f.open();const pending=f.create();await tick();const sessionId=f.calls.start[0].sessionId;
 for(let i=0;i<160;i++)assert.equal(f.output(sessionId,'x'.repeat(32768)).ok,true);
 assert.equal(f.manager.stats().output.retainedUtf8Bytes,4194304);assert.equal(f.manager.stats().ledgerSessions,0);
 const lock=f.manager.closeInput('lock');wait.resolve({ok:true});assert.equal((await pending).ok,false);await lock;
 assert.equal(f.manager.stats().output.sessions,0);assert.equal(f.manager.stats().output.outstandingUtf8Bytes,0);assert.equal(f.calls.stop[0].sessionOwnerId,'owner_1');
});

function realAggregateFixture(){
 const peers=new Map(),aggregate=new TerminalAggregateGateLink({resolveLink:(sessionId,channelId)=>({link:peers.get(channelId)?.link,initiallyClosed:true})});
 const f=fixture({aggregateGateLink:aggregate,sessionTransport:{
  connect:async({sessionId})=>{
   const channelId='channel_'+sessionId,gate=new HostInputGate(),replies=[];let receiver,auto=true;
   const respond=createGateResponder({channelId,gate,send:r=>{replies.push(r);if(auto)receiver.message(r);}});
   const link=new TerminalGateLink({channelId,send:respond,subscribe:r=>{receiver=r;return ()=>{};}});
   peers.set(channelId,{link,gate,replies,setAuto:v=>{auto=v;},ack:()=>receiver.message(replies.at(-1)),close:()=>receiver.closed()});f.channels.set(sessionId,channelId);
   return {channelId,shellProcessIdentity:{pid:42,image:'C:\\Windows\\powershell.exe',since:1n}};
  },
  writeInput:async p=>{const accepted=peers.get(p.channelId)?.gate.allows(p.gateGeneration)===true;if(accepted)f.calls.write.push(p);return {accepted};},
 }});
 return {...f,aggregate,peers};
}

test('manager composes actual aggregate/InputFence/gate links and Lock waits all eight creator ACKs',async()=>{
 const f=realAggregateFixture();await tick();await f.open();const made=await Promise.all(Array.from({length:8},(_,i)=>f.create(i))),leases=[];
 for(const s of made){assert.equal(s.ok,true);leases.push(await f.attach(s.value.sessionId));}
 const first=leases[0];assert.equal((await f.manager.input(f.terminal,f.payload(first.sessionId,{...first,inputSequence:0,data:'one'}))).ok,true);
 const slow=f.peers.get(f.channels.get(leases[7].sessionId));slow.setAuto(false);let settled=false;
 const locking=f.manager.closeInput('lock').then(r=>{settled=true;return r;});
 assert.equal((await f.manager.input(f.terminal,f.payload(first.sessionId,{...first,inputSequence:1,data:'late'}))).ok,false);await tick();assert.equal(settled,false);
 assert.equal(f.output(first.sessionId,'completed while locked').ok,true);assert.equal(f.calls.stop.length,0);slow.ack();assert.equal((await locking).ok,true);
 slow.setAuto(true);await f.open();const fresh=await f.attach(first.sessionId);assert.equal((await f.manager.input(f.terminal,f.payload(fresh.sessionId,{...fresh,inputSequence:0,data:'two'}))).ok,true);
 assert.deepEqual(f.calls.write.map(p=>p.data),['one','two']);assert.equal(f.manager.deliverAvailable(f.terminal,f.payload(fresh.sessionId,fresh)).value.chunk.data,'completed while locked');
});

test('aggregate channel loss synchronously revokes manager input, views and cached availability',async()=>{
 const f=realAggregateFixture();await tick();await f.open();const a=await f.create(),b=await f.create(1),lease=await f.attach(b.value.sessionId);
 f.peers.get(f.channels.get(a.value.sessionId)).close();
 assert.equal((await f.manager.input(f.terminal,f.payload(lease.sessionId,{...lease,inputSequence:0,data:'no'}))).ok,false);
 assert.equal(f.manager.deliverAvailable(f.terminal,f.payload(lease.sessionId,lease)).ok,false);assert.equal((await f.manager.resumeInput()).ok,false);
 assert.equal((await f.create(2)).ok,false);assert.equal(f.calls.start.length,2);assert.equal(f.calls.write.length,0);assert.equal(f.calls.stop.length,0);
});

test('missing aggregate resolver cannot fall back to a successful opaque fence',async()=>{
 const f=fixture({aggregateGateLink:new TerminalAggregateGateLink()});await tick();assert.equal((await f.manager.resumeInput()).ok,false);assert.equal((await f.create()).ok,false);assert.equal(f.calls.start.length,0);
});
