// Real JS channel/startup/gate/history composition. Providers are inert;
// these tests do not establish Windows identity, PTY or package admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TerminalCreatorSession} from '../src/terminal/creator-session.mjs';
import {TerminalSessionCommandChannel} from '../src/terminal/session-command-channel.mjs';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,createProductionHistoryResponder} from '../src/terminal/production-history-channel.mjs';
import {createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {TerminalCreatorHistory} from '../src/terminal/remote-output.mjs';
const api=await import('../src/terminal/production-backend.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const config=()=>({sessionId:'session1',projectId:'project1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Work',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows'}},cols:120,rows:40});
const creator={executable:'C:\\SIREN\\electron.exe',entry:'C:\\SIREN\\production-creator-entry.mjs',directory:'C:\\SIREN'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function streams(){const a=new EventEmitter(),b=new EventEmitter();for(const[s,p]of[[a,b],[b,a]]){s.writableLength=0;s.write=bytes=>{const copy=Buffer.from(bytes);queueMicrotask(()=>{if(!p.dead)p.emit('data',copy);});return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!p.dead)p.emit('end');});};}return[a,b];}
function setup({deadlineMs=500,prepareShell,beforePrepare,beforeConnect,beforeWatch,current=()=>true,stopProvider,verifyProvider,syncStopProvider}={}){
 assert.equal(typeof api.TerminalProductionBackend,'function');const state={calls:[],writes:[],resizes:[],losses:0,spawns:0,stops:0,mainStreams:[],guard:true,active:true,peers:[],snapshots:0};let prepared,session,history;
 const ownership={
  prepareSession(p){state.calls.push('prepare');prepared=p;beforePrepare?.();return {ok:true,sessionOwnerId:'owner1'};},
  allocateSession(p){assert.equal(p.sessionOwnerId,'owner1');state.calls.push('allocate');return {ok:true};},
  async connectSession(p){state.calls.push('connect');await beforeConnect?.();const scope={sessionId:prepared.sessionId,channelId:prepared.channelId},transport={...scope};
   for(const [lane,C]of[['control',ProductionControlChannel],['history',ProductionHistoryChannel],['command',TerminalSessionCommandChannel]]){const[a,b]=streams(),secret=Buffer.alloc(32,lane.length+1);transport[lane]={stream:a,secret};state.mainStreams.push(a);const ch=new C({stream:b,role:'creator',channelId:scope.channelId,...(lane==='control'?{}:{sessionId:scope.sessionId}),secret,deadlineMs});state.peers.push(ch);transport[lane].creator=ch;}
   const prepare=prepareShell??(c=>Promise.resolve({spawn:()=>{
    state.spawns++;state.spawnConfig=c;history.append('ready Ω\r\n');
    return {reportedShell:{pid:73,image},writeInput:d=>{state.writes.push(d);},resize:(c,r)=>{state.resizes.push([c,r]);}};
   }}));
   session=new TerminalCreatorSession({channel:transport.command.creator,assertEndpointsCurrent:()=>state.active,prepareShell:prepare,onUnavailable(){},deadlineMs});
   history=new TerminalCreatorHistory(scope.sessionId);const control=transport.control.creator;
   control.subscribe({message:createProductionGateResponder({channelId:scope.channelId,gate:{apply:p=>session.applyGate(p)},send:p=>control.send(p)}),closed(){session.dispose();}});
   createProductionHistoryResponder({channel:transport.history.creator,history});for(const lane of['control','history','command'])delete transport[lane].creator;
   return {ok:true,transport};
  },
  assertSessionCurrent(){return state.active&&current();},
  watchSessionRoot(p){state.calls.push('watch');assert.equal(p.shellProcessIdentity.pid,73);assert.equal(p.shellProcessIdentity.image,image);assert.equal(typeof p.shellProcessIdentity.since,'bigint');beforeWatch?.();return {ok:true};},
  captureSession(){state.calls.push('capture');state.snapshots++;return {ok:true};},
  async stopSession(){state.stops++;if(stopProvider)return stopProvider(state);state.active=false;for(const p of state.peers)p.dispose();return {ok:true,verifiedExited:true};},
  verifyExit(){return verifyProvider?verifyProvider(state):{identityKnown:!state.active,verifiedExited:!state.active,remainingCount:state.active?1:0};}
 };
 if(syncStopProvider)ownership.stopSession=()=>syncStopProvider(state);
 const backend=new api.TerminalProductionBackend({ownership,hostOwnerId:'host1',creator,onUnavailable(){state.losses++;},deadlineMs});
 const guard={isCurrent:()=>state.guard};
 return {backend,guard,state,ownership,get session(){return session;},history:()=>history,async dispose(){await backend.stopSession({ownerId:'owner1',code:77,deadlineMs});for(const p of state.peers)p.dispose();}};
}
async function ready(s){assert.equal((await s.backend.sendGate({generation:1,open:true})).ok,true);const p=s.backend.prepare(config(),s.guard);assert.equal(p.ok,true);assert.equal(p.ownerId,'owner1');assert.equal(s.backend.allocate({ownerId:p.ownerId}).ok,true);const r=await s.backend.connect({ownerId:p.ownerId},s.guard);assert.equal(r.ok,true);return r;}
const attach=()=>({ownerId:'owner1',windowId:'window1',epoch:4,leaseId:'lease1',generation:1});

test('actual composed startup binds initial closed gate before start and held watch before ready publication',async()=>{const s=setup();try{const r=await ready(s);assert.equal(r.sessionId,'session1');assert.equal(s.state.spawns,1);assert.deepEqual(s.state.calls,['prepare','allocate','connect','watch','capture']);assert.equal(s.state.spawnConfig.cwd,'C:\\Work');assert.deepEqual(s.state.writes,[]);assert.equal(s.backend.nativeExecutionAdmitted,false);}finally{await s.dispose();}});
test('backend retains immutable config before caller mutation and captures ownership callbacks',async()=>{const s=setup();try{await s.backend.sendGate({generation:1,open:true});const c=config(),p=s.backend.prepare(c,s.guard);c.shell.env.PATH='changed';c.cwd='D:\\changed';s.ownership.allocateSession=()=>assert.fail('dynamic provider');s.backend.allocate({ownerId:p.ownerId});assert.equal((await s.backend.connect({ownerId:p.ownerId},s.guard)).ok,true);assert.equal(s.state.spawnConfig.cwd,'C:\\Work');assert.equal(s.state.spawnConfig.shell.env.PATH,'C:\\Windows\\System32');}finally{await s.dispose();}});
test('installed lease is published only after actual correlated creator ACK; input token is private',async()=>{const s=setup();try{await ready(s);assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'no'},s.guard)).accepted,false);assert.equal((await s.backend.install(attach(),s.guard)).ok,true);assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'hello\r'},s.guard)).accepted,true);assert.deepEqual(s.state.writes,['hello\r']);assert.equal((await s.backend.resize({ownerId:'owner1',leaseId:'lease1',generation:1,cols:90,rows:28},s.guard)).accepted,true);assert.deepEqual(s.state.resizes,[[90,28]]);}finally{await s.dispose();}});
test('Lock keeps shell and history, refuses input immediately and requires fresh lease on unlock',async()=>{const s=setup();try{await ready(s);await s.backend.install(attach(),s.guard);await s.backend.sendGate({generation:2,open:false});assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'blocked'},s.guard)).accepted,false);assert.equal(s.state.stops,0);s.history().append('background finished\r\n');await s.backend.sendGate({generation:3,open:true});assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'stale'},s.guard)).accepted,false);assert.equal((await s.backend.install({...attach(),leaseId:'lease2',generation:2},s.guard)).ok,true);const h=await s.backend.readHistory({ownerId:'owner1',fromSequence:0,maxBytes:32768});assert.match(h.chunk.data,/background finished/);assert.equal(s.state.spawns,1);}finally{await s.dispose();}});
test('revocation removes local lease before awaiting creator reply',async()=>{const s=setup();try{await ready(s);await s.backend.install(attach(),s.guard);const revoking=s.backend.revoke({ownerId:'owner1',leaseId:'lease1',generation:1},s.guard);assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'blocked'},s.guard)).accepted,false);assert.equal((await revoking).ok,true);assert.deepEqual(s.state.writes,[]);}finally{await s.dispose();}});
test('guard invalidation while connecting prevents spawn and invokes owned cleanup',async()=>{let release;const wait=new Promise(resolve=>release=resolve);const s=setup({beforeConnect:()=>wait});try{await s.backend.sendGate({generation:1,open:true});s.backend.prepare(config(),s.guard);s.backend.allocate({ownerId:'owner1'});const connecting=s.backend.connect({ownerId:'owner1'},s.guard);s.state.guard=false;release();assert.equal((await connecting).ok,false);await tick();assert.equal(s.state.spawns,0);assert.equal(s.state.stops,1);}finally{await s.dispose();}});
test('Lock during shell module loading prevents late spawn and retains owned rollback',async()=>{let resolve;const pending=new Promise(yes=>resolve=yes);let invoked=0;const s=setup({prepareShell:()=>{invoked++;return pending;}});try{await s.backend.sendGate({generation:1,open:true});s.backend.prepare(config(),s.guard);s.backend.allocate({ownerId:'owner1'});const connecting=s.backend.connect({ownerId:'owner1'},s.guard);for(let n=0;n<100&&!invoked;n++)await tick();assert.equal(invoked,1);await s.backend.sendGate({generation:2,open:false});resolve({spawn:()=>assert.fail('late spawn')});assert.equal((await connecting).ok,false);await tick();assert.equal(s.state.stops,1);}finally{await s.dispose();}});
test('native watch currentness race prevents running publication and cleans owner',async()=>{let s;s=setup({beforeWatch:()=>{s.state.guard=false;}});try{await s.backend.sendGate({generation:1,open:true});s.backend.prepare(config(),s.guard);s.backend.allocate({ownerId:'owner1'});assert.equal((await s.backend.connect({ownerId:'owner1'},s.guard)).ok,false);assert.equal(s.state.snapshots,0);assert.equal((await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:98})).verifiedExited,true);assert.equal(s.state.stops,1);}finally{await s.dispose();}});
test('one startup attempt cannot replay while its session record remains',async()=>{const s=setup();try{await ready(s);assert.equal((await s.backend.connect({ownerId:'owner1'},s.guard)).ok,false);assert.equal(s.state.spawns,1);assert.equal(s.backend.prepare(config(),s.guard).ok,false);}finally{await s.dispose();}});
test('constructor and input reject Proxy/getters without invoking traps',async()=>{let traps=0;const p=new Proxy({},{getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();},get(){traps++;throw Error();}});assert.throws(()=>new api.TerminalProductionBackend(p));assert.equal(traps,0);const s=setup();try{await ready(s);await s.backend.install(attach(),s.guard);assert.equal((await s.backend.input(p,s.guard)).accepted,false);assert.equal(traps,0);}finally{await s.dispose();}});
test('startup absolute deadline settles caller while unresolved connect retains owner capacity',async()=>{const wait=new Promise(()=>{});const s=setup({deadlineMs:25,beforeConnect:()=>wait});try{await s.backend.sendGate({generation:1,open:true});s.backend.prepare(config(),s.guard);s.backend.allocate({ownerId:'owner1'});const result=await s.backend.connect({ownerId:'owner1'},s.guard);assert.equal(result.ok,false);assert.equal(s.state.stops,1);assert.equal(s.backend.stats().pendingConnections,1);}finally{await s.dispose();}});
test('per-operation admission revoked inside endpoint check cannot dispatch old input',async()=>{
 let opCurrent=true,checking=false;const s=setup({current:()=>{if(checking)opCurrent=false;return true;}});
 try{await ready(s);const operationGuard={isCurrent:()=>opCurrent};await s.backend.install(attach(),operationGuard);checking=true;
  const r=await s.backend.input({ownerId:'owner1',leaseId:'lease1',generation:1,inputSequence:0,data:'must-not-run'},operationGuard);
  assert.equal(r.accepted,false);assert.deepEqual(s.state.writes,[]);
 }finally{await s.dispose();}
});
test('successful planned session Stop does not mark the whole backend unavailable',async()=>{
 const s=setup();try{await ready(s);const stopped=await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77});
  assert.equal(stopped.verifiedExited,true);assert.equal(s.backend.isAvailable(),true);assert.equal(s.state.losses,0);
 }finally{await s.dispose();}
});
test('planned Stop receives a fresh real CLOSED gate before invoking native cleanup',async()=>{
 let s,atStop;s=setup({stopProvider:state=>{atStop=s.session.stats().gate;state.active=false;for(const p of state.peers)p.dispose();return {ok:true,verifiedExited:true};}});
 try{await ready(s);await s.backend.install(attach(),s.guard);assert.equal(s.session.stats().gate.open,true);
  assert.equal((await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77})).ok,true);
  assert.equal(atStop.open,false);assert.ok(atStop.generation>1);assert.equal(s.state.stops,1);assert.equal(s.backend.isAvailable(),true);
 }finally{await s.dispose();}
});
test('missing quiesce ACK still invokes native Stop once within caller budget and fences backend',async()=>{
 const s=setup();try{await ready(s);s.state.peers[0].send=()=>true;
  const started=performance.now(),result=await s.backend.stopSession({ownerId:'owner1',deadlineMs:20,code:77});
  assert.equal(result.verifiedExited,true);assert.equal(s.state.stops,1);assert.equal(s.session.stats().gate.open,false);
  assert.ok(performance.now()-started<250,'native cleanup must not wait for the 500ms aggregate timeout');
  assert.equal(s.backend.isAvailable(),false);await s.backend.stopSession({ownerId:'owner1',deadlineMs:20,code:77});assert.equal(s.state.stops,1);
 }finally{await s.dispose();}
});
test('per-operation admission revoked during post-ACK endpoint check cannot publish a lease',async()=>{
 let operationCurrent=true,checks=0,checking=false;
 const s=setup({current:()=>{if(checking&&++checks===2)operationCurrent=false;return true;}});
 try{await ready(s);checking=true;const result=await s.backend.install(attach(),{isCurrent:()=>operationCurrent});
  assert.equal(checks,2);assert.equal(result.ok,false);assert.deepEqual(s.state.writes,[]);
 }finally{await s.dispose();}
});
test('unknown cleanup keeps reservation charged and repeated Stop never retries native cleanup',async()=>{
 const s=setup({stopProvider:()=>({ok:false,verifiedExited:false}),verifyProvider:()=>({identityKnown:false,verifiedExited:false,remainingCount:null})});
 try{await ready(s);const request={ownerId:'owner1',deadlineMs:500,code:77};
  assert.equal((await s.backend.stopSession(request)).ok,false);assert.equal(s.backend.stats().retainedReservations,1);
  assert.equal((await s.backend.stopSession(request)).ok,false);assert.equal(s.state.stops,1);assert.equal(s.backend.stats().retainedReservations,1);
 }finally{await s.dispose();}
});
test('later independently verified cleanup releases reservation without retry or changing old failure',async()=>{
 let verified=false;const s=setup({stopProvider:()=>({ok:false,verifiedExited:false}),verifyProvider:()=>({identityKnown:verified,verifiedExited:verified,remainingCount:verified?0:null})});
 try{await ready(s);const request={ownerId:'owner1',deadlineMs:500,code:77},first=await s.backend.stopSession(request);
  assert.equal(first.ok,false);assert.equal(s.backend.stats().retainedReservations,1);verified=true;
  const next=await s.backend.stopSession(request);assert.equal(next.ok,true);assert.equal(first.ok,false);assert.equal(s.state.stops,1);assert.equal(s.backend.stats().retainedReservations,0);
 }finally{await s.dispose();}
});
test('absolute startup deadline includes synchronous native preparation before reservation publication',async()=>{
 const s=setup({deadlineMs:20,beforePrepare:()=>{const until=performance.now()+30;while(performance.now()<until){}}});
 try{await s.backend.sendGate({generation:1,open:true});const prepared=s.backend.prepare(config(),s.guard);assert.equal(prepared.ok,false);await tick();assert.equal(s.state.stops,1);assert.equal(s.state.spawns,0);assert.equal(s.state.calls.includes('allocate'),false);}finally{await s.dispose();}
});
test('fresh operation grant after Unlock can use existing shell even though startup grant is stale',async()=>{
 const s=setup();try{await ready(s);await s.backend.install(attach(),s.guard);await s.backend.sendGate({generation:2,open:false});s.state.guard=false;
  assert.equal(s.state.spawns,1);assert.equal(s.state.stops,0);await s.backend.sendGate({generation:3,open:true});
  const fresh={isCurrent:()=>true};assert.equal((await s.backend.install({...attach(),leaseId:'lease2',generation:2},fresh)).ok,true);
  assert.equal((await s.backend.input({ownerId:'owner1',leaseId:'lease2',generation:2,inputSequence:0,data:'new-authorized-input'},fresh)).accepted,true);
  assert.deepEqual(s.state.writes,['new-authorized-input']);assert.equal(s.state.spawns,1);
 }finally{await s.dispose();}
});

// Real backend/channel Stop ordering; no provider or process execution.
test('explicit backend Stop reserves ownership cleanup before destroying shared transport',async()=>{
 let invoked=0;const s=setup({stopProvider:state=>{invoked++;assert.equal(state.mainStreams.length,3);assert.equal(state.mainStreams.some(p=>p.dead),false,'shared channel closed before ownership Stop');state.active=false;return Promise.resolve({ok:true,verifiedExited:true});}});
 try{await ready(s);const r=await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77});assert.equal(invoked,1);assert.equal(r.ok,true);assert.equal(s.state.mainStreams.every(p=>p.dead),true);}finally{await s.dispose();}
});
test('ownership Stop rejection still destroys shared transport and retains cleanup failure',async()=>{
 let invoked=0;const s=setup({stopProvider:()=>{invoked++;return Promise.reject(Error('inert Stop rejection'));}});
 try{await ready(s);assert.equal((await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77})).ok,false);assert.equal(invoked,1);assert.equal(s.state.mainStreams.every(p=>p.dead),true);assert.equal(s.backend.stats().retainedReservations,1);}finally{await s.dispose();}
});

test('synchronous ownership Stop throw closes all shared transports without releasing capacity',async()=>{
 let calls=0;const s=setup({syncStopProvider:()=>{calls++;throw Error('inert synchronous Stop failure');}});
 try{await ready(s);assert.equal((await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77})).ok,false);assert.equal(calls,1);assert.equal(s.state.mainStreams.every(p=>p.dead),true);assert.equal(s.backend.stats().retainedReservations,1);await s.backend.stopSession({ownerId:'owner1',deadlineMs:500,code:77});assert.equal(calls,1);}finally{await s.dispose();}
});
