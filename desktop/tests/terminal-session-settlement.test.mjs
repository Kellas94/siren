import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {TerminalProductionOwnership} from '../src/terminal/production-ownership.mjs';

const creator={executable:'C:\\Runtime\\electron.exe',entry:'C:\\Runtime\\creator.mjs',directory:'C:\\Runtime'};
const identity=(pid,image=creator.executable)=>({pid,image,createdFileTime:String(pid+1000)});
const member=(p,alive=true)=>({...p,alive,exitCode:alive?259:77});
const hostIdentity=identity(101),rootIdentity=identity(201),shellIdentity=identity(301,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(options={}){
 const calls=[],events=[],owners=new WeakSet(),pairs=new WeakSet(),sessions=new WeakSet(),endpoints=new Map();
 const accepts=Object.fromEntries(['control','history','command'].map(l=>[l,deferred()]));
 const nativeStop=deferred(),listenerClose=deferred(),endpointCloses=Object.fromEntries(['control','history','command'].map(l=>[l,deferred()]));
 let shell=false,held=[],onNative=null,nowSnapshot=null,guard=()=>true;
 const hostSnapshot=()=>({active:1,root:member(hostIdentity),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false});
 const snapshot=()=>nowSnapshot??({active:shell?2:1,root:member(rootIdentity),held:held.map(p=>member(p)),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false,shell:shell?member(shellIdentity):false,hostPid:hostIdentity.pid,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false});
 const cap=()=>({});
 const native={
  start(...args){calls.push(['start',...args]);const c=cap();owners.add(c);return c;},
  snapshot(c){assert(owners.has(c));calls.push(['snapshot']);if(onNative)onNative('snapshot');return hostSnapshot();},
  createPeerListeners(h,...names){assert(owners.has(h));calls.push(['listeners',...names]);const p=cap();pairs.add(p);if(onNative)onNative('listeners');return p;},
  createPeerSession(h,exe,entry,directory,payload,p){assert(owners.has(h)&&pairs.has(p));calls.push(['create',exe,entry,directory,Buffer.from(payload)]);const c=cap();sessions.add(c);if(onNative)onNative('create');return c;},
  snapshotSession(c){assert(sessions.has(c));calls.push(['snapshotSession']);if(onNative)onNative('snapshotSession');return snapshot();},
  watchRoot(c,pid,image,since){assert(sessions.has(c));calls.push(['watch',pid,image,since]);shell=true;if(onNative)onNative('watch');return snapshot();},
  captureSession(c){assert(sessions.has(c));calls.push(['capture']);held=[rootIdentity,shellIdentity,...(options.withHelper?[identity(401,'C:\\Runtime\\helper.exe')]:[])];if(onNative)onNative('capture');return snapshot();},
  acceptPeerLane(p,lane,ms){assert(pairs.has(p));calls.push(['accept',lane,ms]);return accepts[lane].promise;},
  assertPeerCurrent(e){assert(endpoints.has(e));calls.push(['assert',endpoints.get(e)]);if(onNative)onNative('assert');return true;},
  peerSnapshot(e){const lane=endpoints.get(e);assert(lane);calls.push(['peerSnapshot',lane]);return{lane,server:true,connected:true,retiring:false,settled:false,peer:{...member(rootIdentity),observedBeforeClose:false},mainPid:process.pid,creatorPid:rootIdentity.pid,queriedPeerPid:rootIdentity.pid,nativeDirection:'client',bothJobsChecked:true,commonJobMember:true,sessionJobMember:true,readPending:false,writePending:false,readReservedBytes:0,writeReservedBytes:0,heldPeerClosed:false,generation:0,readIdleTimeout:false,nativeExecutionAdmitted:false};},
  peerRead(e,ms){calls.push(['read',endpoints.get(e),ms]);return new Promise(()=>{});},
  peerWrite(e,bytes,ms){calls.push(['write',endpoints.get(e),bytes.length,ms]);return Promise.resolve({bytes:bytes.length});},
  closePeerEndpoint(e,ms){const lane=endpoints.get(e);calls.push(['endpointClose',lane,ms]);return endpointCloses[lane].promise;},
  closePeerListeners(p,ms){assert(pairs.has(p));calls.push(['listenerClose',ms]);return listenerClose.promise;},
  stopAndCloseSessionAsync(c,code,ms){assert(sessions.has(c));calls.push(['stop',code,ms]);if(onNative)onNative('stop');return nativeStop.promise;},
 };
 if(options.configure)options.configure(native,{calls,events,accepts,nativeStop,listenerClose});
 const adapter=new TerminalProductionOwnership({native,isCurrent:()=>guard(),onUnavailable:r=>{events.push(['unavailable',r]);if(options.onUnavailable)options.onUnavailable(r);},onVerified:r=>{events.push(['verified',r]);if(options.onVerified)options.onVerified(r);}});
 const start=()=>adapter.startHost({hostProcessIdentity:{pid:hostIdentity.pid,image:hostIdentity.image,since:1n}});
 const prepare=(id='session')=>adapter.prepareSession({hostOwnerId:hostId,sessionId:id,channelId:'channel_'+id,creator:{...creator}});
 const {hostOwnerId:hostId}=start();
 const allocate=id=>adapter.allocateSession({sessionOwnerId:id});
 const accept=lane=>{const e=cap();endpoints.set(e,lane);accepts[lane].resolve(e);return e;};
 const connect=async id=>{const p=adapter.connectSession({sessionOwnerId:id,deadlineMs:500});for(const lane of Object.keys(accepts))accept(lane);return p;};
 const final=()=>({snapshot:{...snapshot(),active:0,root:member(rootIdentity,false),held:held.map(p=>member(p,false)),shell:shell?member(shellIdentity,false):false,stopping:true},closed:true});
 const closeAll=()=>{listenerClose.resolve(true);for(const p of Object.values(endpointCloses))p.resolve(true);};
 return{adapter,native,calls,events,prepare,allocate,accept,connect,final,closeAll,nativeStop,listenerClose,endpointCloses,accepts,hostId,setHook:f=>onNative=f,setSnapshot:s=>nowSnapshot=s,setGuard:f=>guard=f,snapshot};
}
const owner=f=>{const p=f.prepare();assert.equal(p.ok,true);assert.equal(f.allocate(p.sessionOwnerId).ok,true);return p.sessionOwnerId;};
const stop=(f,id,deadlineMs=500)=>f.adapter.stopSession({sessionOwnerId:id,deadlineMs,code:77});


import {TerminalSessionCleanup} from '../src/terminal/session-cleanup.mjs';
const ownershipCapture=TerminalProductionOwnership.prototype.captureSessionSettlement;
const cleanupCapture=TerminalSessionCleanup.prototype.captureSettlement;
const captureOwner=(f,id)=>{assert.equal(typeof ownershipCapture,'function','private captured Session settlement API is required');return Reflect.apply(ownershipCapture,f.adapter,[{sessionOwnerId:id}]);};
const captureCleanup=c=>{assert.equal(typeof cleanupCapture,'function','private cleanup actual settlement API is required');return Reflect.apply(cleanupCapture,c,[]);};
const pending=async p=>{let done=false;Reflect.apply(Promise.prototype.then,p,[()=>done=true,()=>done=true]);await tick();assert.equal(done,false,'actual observation must still be pending');};
function cleanupFixture(overrides={}){
 const n=deferred(),p=deferred(),calls=[],events=[],e={root:rootIdentity,shell:false,hostPid:hostIdentity.pid,held:[]};
 const valid=()=>({closed:true,snapshot:{active:0,root:member(rootIdentity,false),shell:false,held:[],hostPid:hostIdentity.pid,atomicBeforeResume:true,killOnClose:true,breakaway:false,inheritable:false,stopping:true,monitorFired:false,monitorTerminateSucceeded:false,shellMonitorFired:false,shellMonitorTerminated:false}});
 const cleanup=new TerminalSessionCleanup({expected:e,stopNative:(...args)=>{calls.push(['native',...args]);return n.promise;},closePeers:()=>{calls.push(['peers']);return p.promise;},onUnavailable:()=>events.push('unavailable'),onVerified:()=>events.push('verified'),...overrides});
 return{cleanup,n,p,calls,events,valid};
}

test('legacy control: timeout stays failed while both original cleanup outcomes remain pending',async()=>{
 const f=cleanupFixture(),a=f.cleanup.stop({deadlineMs:5,code:77}),first=await a;
 assert.equal(first.code,'CLEANUP_TIMEOUT');assert.equal(f.cleanup.stats().nativePending,true);assert.equal(f.cleanup.stats().peerPending,true);
 f.n.resolve(f.valid());f.p.resolve(true);await tick();assert.equal(await a,first);assert.equal(f.cleanup.verifyExit().verifiedExited,true);assert.deepEqual(f.events,['unavailable','verified']);assert.equal(f.calls.length,2);
});
test('legacy control: one held accept survives public timeout and blocks verified release',async()=>{
 const f=fixture(),id=owner(f),c=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:5});f.accept('control');f.accept('history');assert.equal((await c).ok,false);
 const s=stop(f,id,500);f.nativeStop.resolve(f.final());f.closeAll();await tick();assert.equal(f.adapter.snapshot().reservedSessions,1);
 f.accept('command');assert.equal((await s).ok,true);assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);
});
test('cleanup capture is stable and passive across timeout and late true release',async()=>{
 const f=cleanupFixture(),h=captureCleanup(f.cleanup);assert.equal(captureCleanup(f.cleanup),h);assert(Object.isFrozen(h));assert.equal(f.calls.length,0);assert.equal(h.snapshot().actualSettled,false);await pending(h.actualSettled);
 const s=f.cleanup.stop({deadlineMs:5,code:77}),first=await s;assert.equal(first.code,'CLEANUP_TIMEOUT');await pending(h.actualSettled);await pending(h.verifiedRelease);
 const before=f.calls.length;h.snapshot();captureCleanup(f.cleanup);assert.equal(f.calls.length,before);
 f.n.resolve(f.valid());await tick();await pending(h.actualSettled);f.p.resolve(true);
 assert.equal((await h.actualSettled).actualSettled,true);assert.equal((await h.verifiedRelease).verifiedExited,true);assert.equal(await s,first);assert.equal(h.snapshot().actualSettled,true);assert.equal(f.calls.length,2);
});
test('cleanup rejection and invalid receipts settle actual work without verified release',async()=>{
 for(const mode of ['reject','invalid','false-peers']){
  const f=cleanupFixture(),h=captureCleanup(f.cleanup),s=f.cleanup.stop({deadlineMs:100,code:77});
  if(mode==='reject')f.n.reject(Error('private'));else f.n.resolve(mode==='invalid'?{closed:true,snapshot:{}}:f.valid());f.p.resolve(mode==='false-peers'?false:true);
  assert.equal((await s).ok,false);const actual=await h.actualSettled;assert.equal(actual.actualSettled,true);assert.equal(h.snapshot().verifiedReleased,false);await pending(h.verifiedRelease);assert.equal(f.cleanup.stats().retainedReservation,1);
 }
});
test('cleanup entered unobservable work stays quarantined without invoking traps',async()=>{
 let traps=0;const bad={get then(){traps++;throw Error();}};
 for(const value of [bad,new Proxy(Promise.resolve(true),{get(){traps++;},getPrototypeOf(){traps++;}})]){
  const f=cleanupFixture({stopNative:()=>value,closePeers:()=>Promise.resolve(true)}),h=captureCleanup(f.cleanup);assert.equal((await f.cleanup.stop({deadlineMs:100,code:77})).ok,false);await pending(h.actualSettled);await pending(h.verifiedRelease);assert.equal(h.snapshot().unknown,true);
 }
 assert.equal(traps,0);
});
test('cleanup completion waits notification unwind despite reentry and throw',async()=>{
 let h,cleanup,notified=0;const f=cleanupFixture({onVerified(){notified++;assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().verifiedReleased,true);assert.equal(captureCleanup(cleanup),h);cleanup.dispose();throw Error('private callback');}});cleanup=f.cleanup;h=captureCleanup(cleanup);
 const s=cleanup.stop({deadlineMs:500,code:77});f.n.resolve(f.valid());f.p.resolve(true);assert.equal((await s).ok,true);assert.equal((await h.actualSettled).actualSettled,true);assert.equal((await h.verifiedRelease).verifiedExited,true);assert.equal(notified,1);
});
test('ownership handle is passive stable bounded and refuses missing/stale DATA identities',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId,h=captureOwner(f,id),before=f.calls.length;assert.equal(captureOwner(f,id),h);assert(Object.isFrozen(h));h.snapshot();assert.equal(f.calls.length,before);assert.equal(h.sessionOwnerId,id);assert.equal(h.sessionId,'session');await pending(h.actualSettled);
 let traps=0;assert.equal(Reflect.apply(ownershipCapture,f.adapter,[new Proxy({}, {get(){traps++;},ownKeys(){traps++;},getPrototypeOf(){traps++;}})]),null);assert.equal(Reflect.apply(ownershipCapture,f.adapter,[{sessionOwnerId:'missing'}]),null);assert.equal(traps,0);
 const s=stop(f,id);f.listenerClose.resolve(true);assert.equal((await s).ok,true);assert.equal((await h.actualSettled).actualSettled,true);const release=await h.verifiedRelease;assert.equal(release.sessionOwnerId,id);assert.equal(release.identityKnown,false);assert.equal(captureOwner(f,id),null);
});
test('ownership terminal observation waits late accept and exact stream.closed after caller timeout',async()=>{
 const read=deferred(),write=deferred(),f=fixture({configure(n){n.peerRead=()=>read.promise;n.peerWrite=()=>write.promise;}}),id=owner(f),h=captureOwner(f,id),{transport}=await f.connect(id);
 transport.control.stream.on('data',()=>{});transport.history.stream.write(Buffer.from('x'));await tick();const s=stop(f,id,5),first=await s;assert.equal(first.code,'CLEANUP_TIMEOUT');f.nativeStop.resolve(f.final());f.closeAll();await tick();assert.equal(f.adapter.snapshot().reservedSessions,1);await pending(h.actualSettled);
 read.resolve(null);await tick();await pending(h.actualSettled);write.resolve({bytes:1});assert.equal((await h.actualSettled).actualSettled,true);assert.equal((await h.verifiedRelease).verifiedExited,true);assert.equal(await s,first);assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);
});
test('ownership settled-negative native or peer work never refunds its exact slot',async()=>{
 for(const mode of ['native','peer']){
  const f=fixture(),id=owner(f),h=captureOwner(f,id),s=stop(f,id,500);if(mode==='native')f.nativeStop.reject(Error('private'));else f.nativeStop.resolve(f.final());f.listenerClose.resolve(mode==='peer'?false:true);
  assert.equal((await s).ok,false);assert.equal((await h.actualSettled).actualSettled,true);await pending(h.verifiedRelease);assert.equal(h.snapshot().verifiedReleased,false);assert.equal(f.adapter.snapshot().reservedSessions,1);
 }
});
test('captured proof survives more than 128 later closed-cache receipts',async()=>{
 const f=fixture({configure(n){n.closePeerListeners=()=>Promise.resolve(true);}}),id=f.prepare('first').sessionOwnerId,h=captureOwner(f,id);assert.equal((await stop(f,id)).ok,true);const release=await h.verifiedRelease;await h.actualSettled;
 for(let n=0;n<129;n++){const other=f.prepare('later'+n).sessionOwnerId;assert.equal((await stop(f,other)).ok,true);}
 assert.equal(f.adapter.snapshot().closedReceipts,128);assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,false);assert.equal(captureOwner(f,id),null);assert.equal(await h.verifiedRelease,release);assert.equal(release.sessionOwnerId,id);assert.equal(h.snapshot().verifiedReleased,true);
});

for(const operation of ['read','write'])test('entered unobservable '+operation+' cannot manufacture verified Session release or refund',async()=>{
 let entered=0,traps=0;const unobservable={get then(){traps++;throw Error('private then');}};
 const f=fixture({configure(native){native[operation==='read'?'peerRead':'peerWrite']=()=>{entered++;return unobservable;};}}),id=owner(f),{transport}=await f.connect(id);
 if(operation==='read')transport.control.stream.on('data',()=>{});else transport.control.stream.write(Buffer.from('x'));
 await tick();assert.equal(entered,1);const s=stop(f,id,500);f.nativeStop.resolve(f.final());f.closeAll();const result=await s;await tick();
 const actual={operation,entered,traps,result:{...result},reservedSessions:f.adapter.snapshot().reservedSessions,exit:{...f.adapter.verifyExit({ownerId:id})},nativeStopCalls:f.calls.filter(c=>c[0]==='stop').length};
 console.log('CURRENT_ACTUAL '+JSON.stringify(actual));assert.equal(traps,0);assert.equal(actual.nativeStopCalls,1);
 assert.equal(actual.reservedSessions,1,'unobservable entered I/O must retain the exact finite Session charge');assert.equal(result.verifiedExited,false);assert.equal(actual.exit.verifiedExited,false);
});

test('new handle snapshots never delegate to deadline-checking public queries',async()=>{
 let h,cleanup,observed=0;const events=[],n=deferred(),p=deferred();
 const f=cleanupFixture({stopNative(){const end=performance.now()+12;while(performance.now()<end){}h.snapshot();captureCleanup(cleanup);assert.deepEqual(events,[]);observed++;return n.promise;},closePeers:()=>p.promise,onUnavailable:()=>events.push('unavailable')});cleanup=f.cleanup;h=captureCleanup(cleanup);
 for(const name of ['stats','verifyExit','captureSettlement'])Object.defineProperty(cleanup,name,{get(){assert.fail('public shadow');}});
 const s=cleanup.stop({deadlineMs:3,code:77});assert.equal(observed,1);assert.equal((await s).code,'CLEANUP_TIMEOUT');n.resolve(f.valid());p.resolve(true);await h.actualSettled;await h.verifiedRelease;
 const g=fixture(),id=g.prepare().sessionOwnerId,held=captureOwner(g,id),before=g.calls.length;for(const name of ['snapshot','verifyExit','captureSessionSettlement'])Object.defineProperty(g.adapter,name,{get(){assert.fail('public shadow');}});
 assert.equal(captureOwner(g,id),held);held.snapshot();assert.equal(g.calls.length,before);const stopped=stop(g,id);g.listenerClose.resolve(true);await stopped;await held.actualSettled;
});
test('own then getters on canonical native promises remain observable without invoking getters',async()=>{
 let traps=0;const read=deferred(),write=deferred(),closes=Object.fromEntries(['control','history','command'].map(l=>[l,deferred()]));
 for(const p of [read.promise,write.promise,...Object.values(closes).map(d=>d.promise)])Object.defineProperty(p,'then',{get(){traps++;throw Error('private getter');}});
 const f=fixture({configure(n){n.peerRead=()=>read.promise;n.peerWrite=()=>write.promise;n.closePeerEndpoint=e=>{for(const lane of ['control','history','command'])if(!closes[lane].used){closes[lane].used=true;return closes[lane].promise;}assert.fail('close repeated');};}}),id=owner(f),h=captureOwner(f,id),{transport}=await f.connect(id);
 transport.control.stream.on('data',()=>{});transport.history.stream.write(Buffer.from('x'));await tick();const s=stop(f,id);f.nativeStop.resolve(f.final());f.listenerClose.resolve(true);for(const d of Object.values(closes))d.resolve(true);read.resolve(null);write.resolve({bytes:1});assert.equal((await s).ok,true);await h.actualSettled;await h.verifiedRelease;assert.equal(traps,0);
});
test('entered throw Proxy or own-constructor async refusal keeps each lane charge unknown',async()=>{
 for(const operation of ['read','write','close'])for(const mode of ['throw','proxy','constructor']){
  let traps=0,entered=0;const value=mode==='proxy'?new Proxy(Promise.resolve(true),{get(){traps++;},getPrototypeOf(){traps++;},ownKeys(){traps++;}}):Promise.resolve(true);
  if(mode==='constructor')Object.defineProperty(value,'constructor',{get(){traps++;throw Error();}});
  const f=fixture({configure(n){n[{read:'peerRead',write:'peerWrite',close:'closePeerEndpoint'}[operation]]=()=>{entered++;if(mode==='throw')throw Error('private');return value;};}}),id=owner(f),h=captureOwner(f,id),{transport}=await f.connect(id);
  if(operation==='read')transport.control.stream.on('data',()=>{});if(operation==='write')transport.control.stream.write(Buffer.from('x'));await tick();const s=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,false);await pending(h.actualSettled);await pending(h.verifiedRelease);assert.equal(h.snapshot().unknown,true);assert.equal(f.adapter.snapshot().reservedSessions,1);assert(entered>=1&&entered<=3);assert.equal(traps,0);
 }
});
test('valid native I/O rejection settles the real stream and permits later exact cleanup proof',async()=>{
 const read=deferred(),f=fixture({configure(n){n.peerRead=()=>read.promise;}}),id=owner(f),h=captureOwner(f,id),{transport}=await f.connect(id);transport.control.stream.on('data',()=>{});await tick();read.reject(Error('observed rejection'));await tick();const s=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,true);assert.equal((await h.actualSettled).actualSettled,true);assert.equal((await h.verifiedRelease).verifiedExited,true);assert.equal(h.snapshot().unknown,false);
});
test('eight entered unknown I/O records retain all eight slots and cannot create a ninth',async()=>{
 const bad={then:null},f=fixture({configure(n){n.peerRead=()=>bad;}}),handles=[];f.nativeStop.resolve(f.final());f.closeAll();
 for(let n=0;n<8;n++){
  const id=f.prepare('unknown'+n).sessionOwnerId;assert.equal(f.allocate(id).ok,true);for(const lane of ['control','history','command'])f.accepts[lane]=deferred();const {transport}=await f.connect(id),h=captureOwner(f,id);handles.push(h);transport.control.stream.on('data',()=>{});await tick();assert.equal((await stop(f,id)).ok,false);assert.equal(h.snapshot().lanes[0].io.read.unknown,true);
 }
 assert.equal(f.adapter.snapshot().reservedSessions,8);assert.equal(f.adapter.snapshot().closedReceipts,0);assert.equal(f.prepare('ninth').code,'CAPACITY_EXCEEDED');assert.equal(f.calls.filter(c=>c[0]==='stop').length,8);for(const h of handles){await pending(h.actualSettled);await pending(h.verifiedRelease);}
});
test('unobservable accepts and pair closure stay unknown after their substitute public failure',async()=>{
 for(const boundary of ['accept','pair']){
  let traps=0;const bad={get then(){traps++;throw Error();}},f=fixture({configure(n){n[boundary==='accept'?'acceptPeerLane':'closePeerListeners']=()=>bad;}}),id=owner(f),h=captureOwner(f,id);
  if(boundary==='accept')assert.equal((await f.adapter.connectSession({sessionOwnerId:id,deadlineMs:500})).ok,false);const s=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,false);await pending(h.actualSettled);assert.equal(h.snapshot().unknown,true);assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(traps,0);
 }
});
test('invalid identity with known capability observes one unknown-identity stop without verified release',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;f.setSnapshot({});assert.equal(f.allocate(id).ok,false);const h=captureOwner(f,id),s=stop(f,id);assert.equal((await s).ok,false);f.listenerClose.resolve(true);await pending(h.actualSettled);f.nativeStop.resolve({closed:true,snapshot:{}});assert.equal((await h.actualSettled).actualSettled,true);await pending(h.verifiedRelease);assert.equal(h.snapshot().unknown,false);assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);
});
test('Session frames precede effectful host guard snapshot before allocation and connection',async()=>{
 for(const phase of ['allocate','connect']){
  const f=fixture(),id=f.prepare().sessionOwnerId;if(phase==='connect')assert.equal(f.allocate(id).ok,true);const h=captureOwner(f,id);let s,entered=0;
  f.setHook(name=>{if(name==='snapshot'&&!entered++){s=stop(f,id);assert(h.snapshot().activeFrames>0);assert.equal(h.snapshot().actualSettled,false);}});
  const r=phase==='allocate'?f.allocate(id):await f.adapter.connectSession({sessionOwnerId:id,deadlineMs:500});assert.equal(r.ok,false);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,true);assert.equal((await h.actualSettled).actualSettled,true);assert.equal((await h.verifiedRelease).identityKnown,phase==='connect');
 }
});
test('prepare allocation watch and capture Stop reentry retain frames through late resource transfer',async()=>{
 for(const phase of ['listeners','create','watch','capture']){
  const f=fixture();let id,h,s,entered=0;
  if(phase!=='listeners'){id=f.prepare().sessionOwnerId;h=captureOwner(f,id);if(phase!=='create'){assert.equal(f.allocate(id).ok,true);await f.connect(id);if(phase==='capture')assert.equal(f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}).ok,true);}}
  f.setHook(name=>{if(name===phase&&!entered++){if(!id){id=f.adapter.snapshot().sessions[0].sessionOwnerId;h=captureOwner(f,id);}s=stop(f,id);assert(h.snapshot().activeFrames>0);assert.equal(h.snapshot().actualSettled,false);assert.equal(f.calls.filter(c=>c[0]==='stop').length,0);}});
  const r=phase==='listeners'?f.prepare():phase==='create'?f.allocate(id):phase==='watch'?f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}):f.adapter.captureSession({sessionOwnerId:id});assert.equal(r.ok,false);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,true);await h.actualSettled;await h.verifiedRelease;assert.equal(f.calls.filter(c=>c[0]==='stop').length,phase==='listeners'?0:1);
 }
});
test('late accepted endpoint handler and synchronous destroy callback unwind before observation',async()=>{
 let f,h,closeEntered=0;f=fixture({configure(n){const close=n.closePeerEndpoint;n.closePeerEndpoint=(...args)=>{closeEntered++;assert(h.snapshot().activeFrames>0);assert.equal(h.snapshot().actualSettled,false);return close(...args);};}});const id=owner(f);h=captureOwner(f,id);const c=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:5});assert.equal((await c).ok,false);const s=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();await pending(h.actualSettled);for(const lane of ['control','history','command'])f.accept(lane);assert.equal((await s).ok,true);await h.actualSettled;assert.equal(closeEntered,3);assert(h.snapshot().lanes.every(l=>l.acceptSettled&&l.streamSettled));
});
test('release notification sees immutable proof and complete internal state before actual completion',async()=>{
 let h,adapter,notifications=0;const f=fixture({onVerified(value){notifications++;assert.equal(value.sessionOwnerId,h.sessionOwnerId);assert.equal(h.snapshot().verifiedReleased,true);assert.equal(h.snapshot().actualSettled,false);assert.equal(captureOwner({adapter},h.sessionOwnerId),null);throw Error('private observer');}});adapter=f.adapter;const id=owner(f);h=captureOwner(f,id);const s=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await s).ok,true);const actual=await h.actualSettled,release=await h.verifiedRelease;assert(Object.isFrozen(actual));assert(Object.isFrozen(release));assert.equal(notifications,1);assert.equal(release.sessionOwnerId,id);assert.equal(release.sessionId,'session');assert.deepEqual(Object.keys(h),['sessionOwnerId','sessionId','actualSettled','verifiedRelease','snapshot']);assert.equal(adapter.snapshot().host.asyncTeardownAvailable,false);
});
