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
 const adapter=new TerminalProductionOwnership({native,isCurrent:()=>guard(),onUnavailable:r=>events.push(['unavailable',r]),onVerified:r=>events.push(['verified',r])});
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

test('listeners precede atomic create; private transport has three distinct lanes and keys',async()=>{
 const f=fixture(),id=owner(f),r=await f.connect(id);
 assert.deepEqual(Object.keys(r),['ok','transport']);assert.equal(r.ok,true);
 assert.deepEqual(Object.keys(r.transport),['sessionId','channelId','control','history','command']);
 assert.equal(r.transport.sessionId,'session');assert.equal(r.transport.channelId,'channel_session');
 for(const lane of ['control','history','command']){assert.deepEqual(Object.keys(r.transport[lane]),['stream','secret']);assert.equal(r.transport[lane].secret.length,32);assert.equal(r.transport[lane].stream.stats().lane,lane);}
 assert.notDeepEqual(r.transport.control.secret,r.transport.history.secret);assert.notDeepEqual(r.transport.control.secret,r.transport.command.secret);
 assert(f.calls.findIndex(c=>c[0]==='listeners')<f.calls.findIndex(c=>c[0]==='create'));
 assert.equal(f.calls.find(c=>c[0]==='create')[4].subarray(0,8).toString(),'SIRENTB2');
 assert.equal(f.adapter.assertSessionCurrent({sessionOwnerId:id}),true);
 const p=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).verifiedExited,true);
});
test('cleanup before watch/capture uses actual root, shell false and held empty',async()=>{
 const f=fixture(),id=owner(f),p=stop(f,id);f.nativeStop.resolve(f.final());await tick();
 assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,false);assert.equal(f.adapter.snapshot().reservedSessions,1);
 f.listenerClose.resolve(true);assert.equal((await p).verifiedExited,true);assert.equal(f.adapter.snapshot().reservedSessions,0);
 assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);assert.equal(f.calls.filter(c=>c[0]==='listenerClose').length,1);
});
test('held watch/capture identities are verified and passed to async cleanup',async()=>{
 const f=fixture(),id=owner(f);await f.connect(id);
 assert.equal(f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}).ok,true);
 assert.equal(f.adapter.captureSession({sessionOwnerId:id}).ok,true);
 const p=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).ok,true);
 assert.equal(f.events.filter(e=>e[0]==='verified').length,1);assert.equal(f.adapter.verifyExit({ownerId:id}).identityKnown,true);
});
test('outer timeout retains actual cleanup and reservation until both late receipts',async()=>{
 const f=fixture(),id=owner(f),p=stop(f,id,5),r=await p;assert.equal(r.ok,false);assert.equal(r.code,'CLEANUP_TIMEOUT');
 assert.equal(f.events[0][0],'unavailable');assert.equal(f.adapter.snapshot().reservedSessions,1);
 const reads=f.calls.filter(c=>c[0]==='snapshotSession').length;f.adapter.verifyExit({ownerId:id});f.adapter.assertSessionCurrent({sessionOwnerId:id});
 assert.equal(f.calls.filter(c=>c[0]==='snapshotSession').length,reads);
 f.nativeStop.resolve(f.final());f.closeAll();await tick();assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,true);assert.equal(f.adapter.snapshot().reservedSessions,0);
 assert.equal((await p).ok,false);assert.equal((await stop(f,id)).ok,true);
});
test('one native cleanup invocation even when trusted provider reenters stop',async()=>{
 const f=fixture(),id=owner(f);let nested;f.setHook(name=>{if(name==='stop')nested=stop(f,id);});
 const p=stop(f,id);assert.equal(p,nested);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).ok,true);assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);
});
test('eight reservations include prepared and failed allocation; ninth refused',()=>{
 const f=fixture();f.native.createPeerSession=()=>{throw Error('shadow must not replace capture');};
 for(let n=0;n<8;n++)assert.equal(f.prepare('s'+n).ok,true);assert.equal(f.prepare('ninth').code,'CAPACITY_EXCEEDED');assert.equal(f.adapter.snapshot().reservedSessions,8);
});
test('listeners-only preparation is refunded solely after actual listener close',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId,p=stop(f,id);assert.equal(f.calls.filter(c=>c[0]==='stop').length,0);assert.equal(f.adapter.snapshot().reservedSessions,1);
 f.listenerClose.resolve(true);assert.equal((await p).ok,true);assert.equal(f.adapter.snapshot().reservedSessions,0);assert.equal(f.adapter.verifyExit({ownerId:id}).identityKnown,false);
});
test('failed listener allocation remains unknown and never manufactures release',async()=>{
 const f=fixture();f.setHook(name=>{if(name==='listeners')throw Error('private secret');});const r=f.prepare();assert.equal(r.ok,false);assert.equal(r.code,'CLEANUP_FAILED');
 assert.equal(f.adapter.snapshot().reservedSessions,1);const id=f.adapter.snapshot().sessions[0].sessionOwnerId;assert.equal((await stop(f,id)).ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);
 assert(!JSON.stringify(f.adapter.snapshot()).includes('private secret'));
});
test('failed create after pair capture closes owned listeners but retains unknown Session outcome',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;f.setHook(name=>{if(name==='create')throw Error('private');});assert.equal(f.allocate(id).ok,false);
 const p=stop(f,id);f.listenerClose.resolve(true);assert.equal((await p).ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(f.calls.filter(c=>c[0]==='stop').length,0);
});
test('invalid final identity does not refund even after peer closure',async()=>{
 const f=fixture(),id=owner(f),p=stop(f,id),value=f.final();value.snapshot.root.createdFileTime='999';f.nativeStop.resolve(value);f.closeAll();assert.equal((await p).ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(f.adapter.verifyExit({ownerId:id}).identityKnown,false);
});
test('connection timeout observes late accepted endpoints and waits their actual close',async()=>{
 const f=fixture(),id=owner(f),connect=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:5});assert.equal((await connect).ok,false);
 const p=stop(f,id);f.nativeStop.resolve(f.final());f.listenerClose.resolve(true);await tick();assert.equal(f.adapter.snapshot().reservedSessions,1);
 for(const lane of ['control','history','command'])f.accept(lane);await tick();assert.equal(f.calls.filter(c=>c[0]==='endpointClose').length,3);assert.equal(f.adapter.snapshot().reservedSessions,1);
 for(const d of Object.values(f.endpointCloses))d.resolve(true);assert.equal((await p).ok,true);
});
test('all endpoint close receipts and in-flight stream work are required',async()=>{
 const f=fixture(),id=owner(f);const{transport}=await f.connect(id);let resolveRead;f.native.peerRead=()=>Promise.resolve(null);
 // Captured addon method must win over shadow; its pending read stays charged.
 transport.control.stream.on('data',()=>{});await tick();const p=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();await tick();
 assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(transport.control.stream.stats().readPending,true);assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,false);
 assert.equal((await p).ok,false);
});
test('stop paths do not use legacy methods or query an async-pending Session',async()=>{
 const f=fixture(),id=owner(f);for(const name of ['stopSession','closeSession','stop','close'])f.native[name]=()=>assert.fail('legacy');
 const p=stop(f,id);f.setHook(name=>{if(name==='snapshotSession')assert.fail('asyncPending query');});
 assert.equal(f.adapter.assertSessionCurrent({sessionOwnerId:id}),false);f.adapter.verifyExit({ownerId:id});f.adapter.snapshot();f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).ok,true);
});
test('DATA and opaque capability boundaries reject Proxy/accessors without traps',()=>{
 const f=fixture();let traps=0;const hostile=new Proxy({}, {get(){traps++;},getPrototypeOf(){traps++;},ownKeys(){traps++;}});
 assert.equal(f.adapter.prepareSession(hostile).ok,false);assert.equal(f.adapter.allocateSession(hostile).ok,false);assert.equal(f.adapter.assertSessionCurrent(hostile),false);
 const q={hostOwnerId:f.hostId,sessionId:'s',channelId:'c',creator};Object.defineProperty(q,'creator',{enumerable:true,get(){traps++;return creator;}});assert.equal(f.adapter.prepareSession(q).ok,false);
 assert.throws(()=>new TerminalProductionOwnership(hostile));assert.equal(traps,0);
});
test('caller mutation and public method shadows do not alter captured authority',async()=>{
 const f=fixture(),id=owner(f);for(const name of ['allocateSession','assertSessionCurrent','verifyExit','snapshot','stopSession'])Object.defineProperty(f.adapter,name,{get(){throw Error('public shadow');}});
 const proto=TerminalProductionOwnership.prototype,p=Reflect.apply(proto.stopSession,f.adapter,[{sessionOwnerId:id,deadlineMs:500,code:77}]);
 f.native.stopAndCloseSessionAsync=()=>assert.fail('native shadow');f.native.closePeerListeners=()=>assert.fail('native shadow');f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).ok,true);
});
test('guard reentry and allocation callback retirement prevent later side effects',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;let stopped;f.setHook(name=>{if(name==='create')stopped=stop(f,id);});
 assert.equal(f.allocate(id).ok,false);f.listenerClose.resolve(true);assert.equal((await stopped).ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);
 const g=fixture();g.setGuard(()=>{g.adapter.prepareSession({hostOwnerId:g.hostId,sessionId:'nested',channelId:'n',creator});return true;});
 assert.equal(g.prepare().ok,true);assert.equal(g.calls.filter(c=>c[0]==='listeners').length,1);
});
test('malformed stop does not consume invocation or publish provider errors',async()=>{
 const f=fixture(),id=owner(f);assert.equal((await f.adapter.stopSession({sessionOwnerId:id,deadlineMs:0,code:77})).ok,false);assert.equal(f.calls.filter(c=>c[0]==='stop').length,0);
 const p=stop(f,id);f.nativeStop.reject(Error('secret native exception'));f.closeAll();assert.equal((await p).code,'CLEANUP_FAILED');assert(!JSON.stringify(f.events).includes('secret'));
});
test('reentrant stop during listener creation retains and closes the returned pair',async()=>{
 const f=fixture();let pending;f.setHook(name=>{if(name==='listeners')pending=stop(f,f.adapter.snapshot().sessions[0].sessionOwnerId);});
 assert.equal(f.prepare().ok,false);assert.equal(f.calls.filter(c=>c[0]==='listenerClose').length,1);
 f.listenerClose.resolve(true);assert.equal((await pending).ok,true);assert.equal(f.adapter.snapshot().reservedSessions,0);
});
test('known Session capability with invalid allocation snapshot is still stopped once without claiming exit',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;f.setSnapshot({});assert.equal(f.allocate(id).ok,false);
 const p=stop(f,id);assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);f.nativeStop.resolve({snapshot:{},closed:true});f.closeAll();assert.equal((await p).ok,false);await tick();assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,false);
});
test('watch and capture callback retirement waits for the current synchronous observation',async()=>{
 for(const during of ['watch','capture']){
  const f=fixture(),id=owner(f);await f.connect(id);let pending;
  if(during==='capture')assert.equal(f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}).ok,true);
  f.setHook(name=>{if(name===during)pending=stop(f,id);});
  if(during==='watch')assert.equal(f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}).ok,false);
  else assert.equal(f.adapter.captureSession({sessionOwnerId:id}).ok,false);
  assert.equal(f.calls.filter(c=>c[0]==='stop').length,1);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await pending).ok,true);assert.equal(f.adapter.snapshot().reservedSessions,0);
 }
});
test('native provider reentry cannot mint a second preparation before the first reserves',()=>{
 const f=fixture();let entered=false,nested;f.setHook(name=>{if(name==='snapshot'&&!entered){entered=true;nested=f.prepare('nested');}});
 assert.equal(f.prepare().ok,true);assert.equal(nested.ok,false);assert.equal(f.calls.filter(c=>c[0]==='listeners').length,1);
});
test('known dead shell or captured helper fences currentness immediately',async()=>{
 for(const field of ['shell','held']){
  const f=fixture({withHelper:true}),id=owner(f);await f.connect(id);assert.equal(f.adapter.watchSessionRoot({sessionOwnerId:id,shellProcessIdentity:{pid:shellIdentity.pid,image:shellIdentity.image,since:1n}}).ok,true);assert.equal(f.adapter.captureSession({sessionOwnerId:id}).ok,true);
  const s=f.snapshot();if(field==='shell'){s.shell={...s.shell,alive:false,exitCode:1};s.held=s.held.map(m=>m.pid===shellIdentity.pid?{...m,alive:false,exitCode:1}:m);}else s.held=s.held.map(m=>m.pid===401?{...m,alive:false,exitCode:1}:m);f.setSnapshot(s);
  assert.equal(f.adapter.assertSessionCurrent({sessionOwnerId:id}),false);assert.equal(f.events.filter(e=>e[0]==='unavailable').length,1);
 }
});
test('returned private transport keys are wiped when verified cleanup releases its reservation',async()=>{
 const f=fixture(),id=owner(f),{transport}=await f.connect(id),p=stop(f,id);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await p).ok,true);
 for(const lane of ['control','history','command'])assert(transport[lane].secret.every(byte=>byte===0));
});
test('fixed expected identities and native API callbacks are copied before caller mutation',()=>{
 const f=fixture(),c={...creator},p=f.adapter.prepareSession({hostOwnerId:f.hostId,sessionId:'immutable',channelId:'immutable_channel',creator:c});c.entry='C:\\Other\\bad.mjs';c.directory='C:\\Other';
 assert.equal(f.allocate(p.sessionOwnerId).ok,true);const call=f.calls.find(c=>c[0]==='create');assert.equal(call[2],creator.entry);assert.equal(call[3],creator.directory);
 assert.deepEqual(Object.keys(f.adapter.verifyExit({ownerId:p.sessionOwnerId})),['identityKnown','verifiedExited','remainingCount']);
});
test('malformed addon method records and Proxy capabilities are refused without executing traps',()=>{
 let traps=0;const proxy=new Proxy({}, {get(){traps++;},ownKeys(){traps++;},getPrototypeOf(){traps++;}});
 assert.throws(()=>fixture({configure(native){Object.defineProperty(native,'createPeerSession',{get(){traps++;}});}}));
 assert.throws(()=>fixture({configure(native){native.createPeerSession=new Proxy(()=>{}, {apply(){traps++;}});}}));
 const f=fixture({configure(native){native.createPeerListeners=()=>proxy;}});assert.equal(f.prepare().ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);assert.equal(traps,0);
 const g=fixture({configure(native){native.snapshotSession=()=>proxy;}}),id=g.prepare().sessionOwnerId;assert.equal(g.allocate(id).ok,false);assert.equal(traps,0);
});
test('peer direction, exact identities, both Jobs and all fields are checked before transport publication',async()=>{
 const mutations=[s=>({...s,nativeDirection:'server'}),s=>({...s,mainPid:process.pid+1}),s=>({...s,creatorPid:999}),s=>({...s,queriedPeerPid:999}),s=>({...s,bothJobsChecked:false}),s=>({...s,commonJobMember:null}),s=>({...s,sessionJobMember:false}),s=>({...s,server:false}),s=>({...s,lane:'history'}),s=>({...s,peer:{...s.peer,createdFileTime:'999'}}),s=>({...s,readIdleTimeout:true}),s=>({...s,extra:'forbidden'})];
 for(const mutate of mutations){const f=fixture({configure(native){const original=native.peerSnapshot;native.peerSnapshot=e=>mutate(original(e));}}),id=owner(f),r=await f.connect(id);assert.equal(r.ok,false);assert.equal(f.adapter.snapshot().reservedSessions,1);f.closeAll();}
});
test('invalid native async values, accessor outcomes and poisoned inherited Promise constructor do not run getters',async()=>{
 let traps=0;const hostile=new Proxy({}, {get(){traps++;},getPrototypeOf(){traps++;},ownKeys(){traps++;}});
 const f=fixture({configure(native){native.acceptPeerLane=()=>hostile;}}),id=owner(f);assert.equal((await f.adapter.connectSession({sessionOwnerId:id,deadlineMs:500})).ok,false);assert.equal(traps,0);
 const g=fixture({configure(native){native.stopAndCloseSessionAsync=()=>({get then(){traps++;}});}}),gid=owner(g);assert.equal((await stop(g,gid)).ok,false);assert.equal(traps,0);
 const h=fixture(),hid=owner(h),p=stop(h,hid),result={closed:true};Object.defineProperty(result,'snapshot',{enumerable:true,get(){traps++;}});h.nativeStop.resolve(result);h.closeAll();assert.equal((await p).ok,false);assert.equal(traps,0);
 const j=fixture(),jid=owner(j),original=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');let pending;
 try{Object.defineProperty(Promise.prototype,'constructor',{configurable:true,get(){traps++;return Promise;}});pending=j.adapter.connectSession({sessionOwnerId:jid,deadlineMs:500});assert.equal(traps,0);}finally{Object.defineProperty(Promise.prototype,'constructor',original);}
 assert.equal((await pending).ok,false);assert.equal(traps,0);
});
test('capacity refunds only a verified slot and duplicate IDs/channels cannot allocate',async()=>{
 const f=fixture(),ids=[];for(let n=0;n<8;n++)ids.push(f.prepare('s'+n).sessionOwnerId);
 assert.equal(f.adapter.prepareSession({hostOwnerId:f.hostId,sessionId:'other',channelId:'channel_s1',creator}).ok,false);
 const p=stop(f,ids[0]);f.listenerClose.resolve(true);assert.equal((await p).ok,true);assert.equal(f.prepare('replacement').ok,true);assert.equal(f.prepare('ninth').code,'CAPACITY_EXCEEDED');
});
test('blocking providers past absolute deadline cannot publish late success',async()=>{
 const f=fixture({configure(native){const original=native.acceptPeerLane;native.acceptPeerLane=(...args)=>{const end=performance.now()+8;while(performance.now()<end){}return original(...args);};}}),id=owner(f);
 const pending=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:5});for(const lane of ['control','history','command'])f.accept(lane);assert.equal((await pending).ok,false);assert.equal(f.events[0][0],'unavailable');
 const g=fixture(),gid=owner(g);g.setHook(name=>{if(name==='stop'){const end=performance.now()+10;while(performance.now()<end){}}});const p=stop(g,gid,5);g.nativeStop.resolve(g.final());g.closeAll();assert.equal((await p).code,'CLEANUP_TIMEOUT');await tick();assert.equal(g.adapter.verifyExit({ownerId:gid}).verifiedExited,true);
});
test('stream provider boundary blocks inherited Promise constructor poisoning without getters',async()=>{
 const f=fixture(),id=owner(f),{transport}=await f.connect(id),original=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');let traps=0;
 try{Object.defineProperty(Promise.prototype,'constructor',{configurable:true,get(){traps++;return Promise;}});transport.command.stream.write(Buffer.from('x'));assert.equal(traps,0);}finally{Object.defineProperty(Promise.prototype,'constructor',original);}
 await tick();assert.equal(f.adapter.assertSessionCurrent({sessionOwnerId:id}),false);assert.equal(f.adapter.snapshot().reservedSessions,1);
});
