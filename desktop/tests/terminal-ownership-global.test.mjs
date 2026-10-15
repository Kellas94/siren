import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures/terminal-ownership-global.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const held=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const stop=(f,id,deadlineMs=100)=>f.adapter.stopSession({sessionOwnerId:id,deadlineMs,code:77});

test('initial host guard cannot reentrantly start a competing host before reservation',()=>{
 const f=fixture({noStart:true});let entered=false,nested;f.setGuard(()=>{if(!entered){entered=true;nested=f.start();}return true;});
 const outer=f.start();assert.equal(outer.ok,true);assert.equal(nested.ok,false);assert.equal(f.calls.filter(x=>x[0]==='start').length,1);
});
test('lost currentness during native start prevents later snapshot entry',()=>{
 let f;f=fixture({noStart:true,configure:n=>{const start=n.start;n.start=(...args)=>{const cap=start(...args);f.setGuard(()=>false);return cap;};}});
 assert.equal(f.start().ok,false);assert.equal(f.calls.filter(x=>x[0]==='snapshot').length,0);
});
test('lost currentness during native create prevents later Session snapshot entry',()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;f.setHook(kind=>{if(kind==='create')f.setGuard(()=>false);});assert.equal(f.allocate(id).ok,false);assert.equal(f.calls.filter(x=>x[0]==='snapshotSession').length,0);
});
test('unexpected async currentness rejection is refused without unhandled rejection',async()=>{
 const f=fixture({noStart:true});f.setGuard(()=>Promise.reject(Error('private guard failure')));assert.equal(f.start().ok,false);await tick();assert.equal(f.calls.length,0);
});
test('unexpected asynchronous native start cannot enter snapshot or assimilate then getter',()=>{
 let reads=0;const f=fixture({noStart:true,configure:n=>{n.start=()=>Object.defineProperty({},'then',{get(){reads++;return undefined;}});n.snapshot=()=>{throw Error('must not enter');};}});
 const r=f.start();assert.equal(r.ok,false);assert.equal(reads,0);assert.equal(f.calls.filter(x=>x[0]==='snapshot').length,0);
});
test('passive ownership capture is stable and zero-work retirement really settles',async()=>{
 const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();assert.equal(h,f.adapter.captureOwnershipSettlement());assert.equal(h.snapshot().actualSettled,false);assert.equal(f.calls.length,0);assert.equal(f.adapter.retireOwnership(),h);assert.equal(f.adapter.retireOwnership(),h);const r=await h.actualSettled;assert.equal(r.scope,'OWNERSHIP_JS');assert.equal(r.hostNativeJoined,false);assert.equal(r.nativeExecutionAdmitted,false);assert.equal(f.start().ok,false);assert.equal(f.calls.length,0);
});
test('retirement inside native start cannot enter a later snapshot callback',async()=>{
 let a;const f=fixture({noStart:true,configure:n=>{const start=n.start;n.start=(...args)=>{const cap=start(...args);a.retireOwnership();return cap;};}});a=f.adapter;const h=a.captureOwnershipSettlement(),r=f.start();assert.equal(r.ok,false);assert.equal(f.calls.filter(x=>x[0]==='snapshot').length,0);await h.actualSettled;assert.equal(h.snapshot().activeFrames,0);
});
test('global join waits for actual Session cleanup after a public timeout',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;assert.equal(f.allocate(id).ok,true);const h=f.adapter.captureOwnershipSettlement(),p=stop(f,id,5);f.adapter.retireOwnership();assert.equal((await p).code,'CLEANUP_TIMEOUT');await tick();assert.equal(h.snapshot().actualSettled,false);f.nativeStop.resolve(f.final());f.closeAll();await h.actualSettled;assert.equal(h.snapshot().pendingSessions,0);assert.equal(h.snapshot().pendingCallbacks,0);
});
test('a returned onVerified Promise remains joined after reservation release',async()=>{
 const notification=held(),f=fixture({onVerified:()=>notification.promise}),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement();const p=stop(f,id);f.adapter.retireOwnership();f.listenerClose.resolve(true);assert.equal((await p).ok,true);assert.equal(f.adapter.snapshot().reservedSessions,0);await tick();assert.equal(h.snapshot().actualSettled,false);notification.resolve();await h.actualSettled;
});
test('retirement is passive with respect to Stop and explicit cleanup remains usable',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement();f.adapter.retireOwnership();assert.equal(f.calls.some(x=>x[0]==='listenerClose'||x[0]==='stop'),false);assert.equal(h.snapshot().actualSettled,false);assert.equal(f.allocate(id).ok,false);const p=stop(f,id);f.listenerClose.resolve(true);assert.equal((await p).ok,true);await h.actualSettled;
});

test('sixteen released Session notification continuations cannot grow an unbounded roster',async()=>{
 const notification=held(),f=fixture({onVerified:()=>notification.promise}),h=f.adapter.captureOwnershipSettlement();f.listenerClose.resolve(true);
 for(let i=0;i<16;i++){const p=f.prepare('draining'+i);assert.equal(p.ok,true);assert.equal((await stop(f,p.sessionOwnerId)).ok,true);await tick();}
 assert.equal(f.adapter.snapshot().reservedSessions,0);assert.equal(h.snapshot().pendingSessions,16);assert.equal(f.prepare('overflow').code,'CAPACITY_EXCEEDED');
 f.adapter.retireOwnership();notification.resolve();await h.actualSettled;assert.equal(h.snapshot().pendingSessions,0);
});
test('held onUnavailable notification is joined even after a failed host start',async()=>{
 const notification=held(),f=fixture({noStart:true,onUnavailable:()=>notification.promise,configure:n=>{n.start=()=>{throw Error('known negative');};}}),h=f.adapter.captureOwnershipSettlement();assert.equal(f.start().ok,false);f.adapter.retireOwnership();await tick();assert.equal(h.snapshot().actualSettled,false);notification.resolve();await h.actualSettled;
});
test('retiring during an initial guard prevents native start entry',async()=>{
 const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();f.setGuard(()=>{f.adapter.retireOwnership();assert.equal(h.snapshot().actualSettled,false);return true;});assert.equal(f.start().ok,false);await h.actualSettled;assert.equal(f.calls.length,0);
});
test('pending nominal-sync guard with DATA then shadow taints lifetime without becoming authority',async()=>{
 const promise=held();Object.defineProperty(promise.promise,'then',{value:undefined});const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();f.setGuard(()=>promise.promise);assert.equal(f.start().ok,false);f.adapter.retireOwnership();promise.resolve(true);await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);assert.equal(f.calls.length,0);
});
test('Promise original returned by native start cannot be mistaken for finished synchronous work',async()=>{
 const promise=held(),f=fixture({noStart:true,configure:n=>{n.start=()=>promise.promise;}}),h=f.adapter.captureOwnershipSettlement();assert.equal(f.start().ok,false);f.adapter.retireOwnership();promise.resolve({});await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
});
test('catalogue-like thenable native return is neither invoked nor refunded',async()=>{
 let calls=0;const value={then(){calls++;}},f=fixture({noStart:true,configure:n=>{n.start=()=>value;}}),h=f.adapter.captureOwnershipSettlement();assert.equal(f.start().ok,false);f.adapter.retireOwnership();await tick();assert.equal(calls,0);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
});
test('revoked Proxy native return is rejected without reflective traps',async()=>{
 const {proxy,revoke}=Proxy.revocable({},{});revoke();const f=fixture({noStart:true,configure:n=>{n.start=()=>proxy;}}),h=f.adapter.captureOwnershipSettlement();assert.equal(f.start().ok,false);f.adapter.retireOwnership();await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
});
test('ordinary isCurrent denial remains a completed negative and permits later current work',async()=>{
 const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();f.setGuard(()=>false);assert.equal(f.start().ok,false);assert.equal(h.snapshot().unknown,false);f.setGuard(()=>true);assert.equal(f.start().ok,true);f.adapter.retireOwnership();await h.actualSettled;
});
test('completed passive ownership handle releases an exercised owner and native capabilities',async()=>{
 assert.equal(typeof global.gc,'function');async function build(){const f=fixture(),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement(),refs=[new WeakRef(f.adapter),new WeakRef(f.native)];const p=stop(f,id);f.adapter.retireOwnership();f.listenerClose.resolve(true);await p;await h.actualSettled;return {h,refs};}
 const {h,refs}=await build();for(let i=0;i<40;i++){await tick();global.gc();}assert.equal(h.snapshot().actualSettled,true);assert.deepEqual(refs.map(r=>r.deref()),[undefined,undefined]);
});

for(const stage of ['start','snapshot','createPeerListeners','createPeerSession','snapshotSession'])test('unsupported synchronous '+stage+' return keeps global lifetime unknown without getters',async()=>{
 let reads=0;const bad=Object.defineProperty({},'then',{get(){reads++;return undefined;}}),f=fixture({noStart:true,configure:n=>{n[stage]=()=>bad;}}),h=f.adapter.captureOwnershipSettlement();
 const started=f.start();if(started.ok){const prepared=f.adapter.prepareSession({hostOwnerId:started.hostOwnerId,sessionId:'s',channelId:'c',creator:{executable:'C:\\Runtime\\electron.exe',entry:'C:\\Runtime\\creator.mjs',directory:'C:\\Runtime'}});if(prepared.ok)f.allocate(prepared.sessionOwnerId);}
 f.adapter.retireOwnership();await tick();assert.equal(reads,0);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
});
test('supported native listener-close observation ignores own then getter',async()=>{
 const close=held();let reads=0;Object.defineProperty(close.promise,'then',{get(){reads++;throw Error('never');}});const f=fixture({configure:n=>{n.closePeerListeners=()=>close.promise;}}),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement(),p=stop(f,id);f.adapter.retireOwnership();close.resolve(true);assert.equal((await p).ok,true);await h.actualSettled;assert.equal(reads,0);
});
test('supported notification Promise ignores own then getter and completes after original',async()=>{
 const n=held();let reads=0;Object.defineProperty(n.promise,'then',{get(){reads++;throw Error('never');}});const f=fixture({onVerified:()=>n.promise}),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement(),p=stop(f,id);f.adapter.retireOwnership();f.listenerClose.resolve(true);assert.equal((await p).ok,true);await tick();assert.equal(h.snapshot().actualSettled,false);n.resolve();await h.actualSettled;assert.equal(reads,0);
});
test('unsafe notification result retains a bounded Session continuation without running then',async()=>{
 let calls=0;const bad={then(){calls++;}},f=fixture({onVerified:()=>bad}),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement(),p=stop(f,id);f.adapter.retireOwnership();f.listenerClose.resolve(true);assert.equal((await p).ok,true);await tick();assert.equal(calls,0);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().pendingSessions,1);assert.equal(h.snapshot().actualSettled,false);
});
test('retiring while accepts are held retains exact late endpoints and their cleanup',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId;assert.equal(f.allocate(id).ok,true);const h=f.adapter.captureOwnershipSettlement(),connected=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:100});f.adapter.retireOwnership();const stopped=stop(f,id,5);f.nativeStop.resolve(f.final());f.closeAll();assert.equal((await connected).ok,false);assert.equal((await stopped).ok,false);assert.equal(h.snapshot().actualSettled,false);for(const lane of ['control','history','command'])f.accept(lane);await h.actualSettled;assert.equal(h.snapshot().pendingSessions,0);assert.equal(h.snapshot().pendingCallbacks,0);
});
test('retire plus Stop inside native create observes returned capability through cleanup',async()=>{
 const f=fixture(),id=f.prepare().sessionOwnerId,h=f.adapter.captureOwnershipSettlement();let p;f.setHook(kind=>{if(kind==='create'){f.adapter.retireOwnership();p=stop(f,id);}});assert.equal(f.allocate(id).ok,false);f.nativeStop.resolve({closed:true,snapshot:{}});f.closeAll();assert.equal((await p).ok,false);await h.actualSettled;assert.equal(f.calls.filter(x=>x[0]==='stop').length,1);assert.equal(h.snapshot().actualSettled,true);assert.equal(f.adapter.verifyExit({ownerId:id}).verifiedExited,false);
});
test('closed ownership cannot be reopened by activity or duplicate cleanup calls',async()=>{
 const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();f.adapter.retireOwnership();await h.actualSettled;const before=h.snapshot();assert.equal(f.start().ok,false);assert.equal(f.adapter.prepareSession({}).ok,false);assert.equal((await f.adapter.connectSession({})).ok,false);assert.equal((await f.adapter.stopSession({sessionOwnerId:'unknown',deadlineMs:1,code:77})).ok,false);assert.deepEqual(h.snapshot(),before);assert.equal(f.calls.length,0);
});
test('capture and retire reject extra arguments without changing authority',async()=>{
 const f=fixture({noStart:true}),h=f.adapter.captureOwnershipSettlement();assert.equal(f.adapter.captureOwnershipSettlement({}),null);assert.equal(f.adapter.retireOwnership({}),null);assert.equal(h.snapshot().retired,false);f.adapter.retireOwnership();await h.actualSettled;
});

// ROOT-maintained regression bodies derived from the independently reproduced WX01 blockers.
test('global unsafe authority barrier blocks pending accepts from entering activity providers',async()=>{
 const f=fixture(),id=f.prepare('pending').sessionOwnerId;assert.equal(f.allocate(id).ok,true);
 const connected=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:50});
 const authority=held();f.setGuard(()=>authority.promise);
 assert.equal(f.prepare('poison').ok,false);assert.equal(f.adapter.captureOwnershipSettlement().snapshot().unknown,true);
 const cut=f.calls.length;
 for(const lane of ['control','history','command'])f.accept(lane);
 await connected;await tick();
 const later=f.calls.slice(cut).filter(c=>['assert','peerSnapshot','read','write','accept','snapshotSession','create','listeners','snapshot'].includes(c[0]));
 console.log('INDEPENDENT_AUTHORITY_BARRIER_AFTER_POISON',JSON.stringify(later));
 authority.resolve(true);f.closeAll();f.nativeStop.resolve(f.final());await stop(f,id);
 assert.deepEqual(later,[],'global blocked authority must refuse subsequent nominal-sync activity providers');
});

test('retirement inside host snapshot cannot add a new inaccessible Session reservation',async()=>{
 const f=fixture(),h=f.adapter.captureOwnershipSettlement();
 f.setHook(kind=>{if(kind==='snapshot')f.adapter.retireOwnership();});
 const result=f.prepare('retire_during_snapshot');assert.equal(result.ok,false);await tick();
 const snapshot=h.snapshot();console.log('INDEPENDENT_RETIRE_PREPARE_ROSTER',JSON.stringify(snapshot));
 assert.equal(snapshot.pendingSessions,0,'retirement must be rechecked before creating the new Session record');
 assert.equal(snapshot.actualSettled,true);
});

// ROOT-authored neighboring revoke regressions; independent assertions remain in reviewer-owned WX files.
test('ordinary revoke inside host snapshot refuses Session reservation before listener allocation',async()=>{
 const f=fixture(),h=f.adapter.captureOwnershipSettlement();f.setHook(kind=>{if(kind==='snapshot')f.setGuard(()=>false);});
 assert.equal(f.prepare('revoked_snapshot').ok,false);assert.equal(f.calls.filter(c=>c[0]==='listeners').length,0);assert.equal(h.snapshot().pendingSessions,0);
 f.adapter.retireOwnership();await h.actualSettled;
});
test('ordinary revoke while accepts are pending refuses identity providers but cleans endpoints',async()=>{
 const f=fixture(),id=f.prepare('revoked_accept').sessionOwnerId;assert.equal(f.allocate(id).ok,true);const p=f.adapter.connectSession({sessionOwnerId:id,deadlineMs:50});f.setGuard(()=>false);const cut=f.calls.length;
 for(const lane of ['control','history','command'])f.accept(lane);assert.equal((await p).ok,false);await tick();
 const after=f.calls.slice(cut).filter(c=>c[0]==='assert'||c[0]==='peerSnapshot');f.closeAll();f.nativeStop.resolve(f.final());await stop(f,id);assert.deepEqual(after,[]);
});
test('revoke during peer assertion prevents subsequent peer snapshot entry',async()=>{
 const f=fixture(),id=f.prepare('revoke_assert').sessionOwnerId;assert.equal(f.allocate(id).ok,true);f.setHook(kind=>{if(kind==='assert')f.setGuard(()=>false);});const cut=f.calls.length;
 assert.equal((await f.connect(id)).ok,false);await tick();const snapshots=f.calls.slice(cut).filter(c=>c[0]==='peerSnapshot');f.closeAll();f.nativeStop.resolve(f.final());await stop(f,id);assert.deepEqual(snapshots,[]);
});

// ROOT-maintained regressions derived from independently reproduced WX13/WX15 findings.
const cleanup=async(f,id)=>{const h=f.adapter.captureOwnershipSettlement();f.adapter.retireOwnership();const p=stop(f,id);f.closeAll();f.nativeStop.resolve(f.final());await p;await h.actualSettled;};
test('final connect assertion revocation cannot enter later assertions or publish connected transport',async()=>{
 const f=fixture(),id=f.prepare('final_check').sessionOwnerId;assert.equal(f.allocate(id).ok,true);let assertions=0,cut;
 f.setHook(kind=>{if(kind==='assert'&&++assertions===4){f.setGuard(()=>false);cut=f.calls.length;}});
 const result=await f.connect(id);await tick();const later=f.calls.slice(cut).filter(c=>['assert','peerSnapshot','snapshotSession','read','write'].includes(c[0]));
 console.log('INDEPENDENT_FINAL_CONNECT_REVOKE',JSON.stringify({resultOk:result.ok,later}));
 await cleanup(f,id);assert.equal(result.ok,false);assert.deepEqual(later,[]);
});

test('assertSessionCurrent must recheck ordinary revocation before next identity callback',async()=>{
 const f=fixture(),id=f.prepare('current_check').sessionOwnerId;assert.equal(f.allocate(id).ok,true);assert.equal((await f.connect(id)).ok,true);let cut;
 f.setHook(kind=>{if(kind==='assert'&&cut===undefined){f.setGuard(()=>false);cut=f.calls.length;}});
 assert.equal(f.adapter.assertSessionCurrent({sessionOwnerId:id}),false);
 const later=f.calls.slice(cut).filter(c=>['assert','peerSnapshot','snapshotSession','read','write'].includes(c[0]));
 console.log('INDEPENDENT_CURRENT_REVOKE',JSON.stringify(later));await cleanup(f,id);assert.deepEqual(later,[]);
});
test('stream write callback must not enter native write after current assertion revokes authority',async()=>{
 const f=fixture(),id=f.prepare('stream_revoke').sessionOwnerId;assert.equal(f.allocate(id).ok,true);const connected=await f.connect(id);assert.equal(connected.ok,true);let cut;
 f.setHook(kind=>{if(kind==='assert'&&cut===undefined){f.setGuard(()=>false);cut=f.calls.length;}});
 connected.transport.control.stream.write(Buffer.from('owned bytes'));await tick();
 const later=f.calls.slice(cut).filter(c=>['assert','peerSnapshot','snapshotSession','read','write'].includes(c[0]));
 console.log('INDEPENDENT_STREAM_REVOKE',JSON.stringify(later));
 const h=f.adapter.captureOwnershipSettlement();f.adapter.retireOwnership();const p=f.adapter.stopSession({sessionOwnerId:id,deadlineMs:50,code:77});f.closeAll();f.nativeStop.resolve(f.final());await p;await h.actualSettled;
 assert.deepEqual(later,[]);
});

test('last final-connect assertion cannot publish transport after revocation',async()=>{
 const f=fixture(),id=f.prepare('last_assert').sessionOwnerId;assert.equal(f.allocate(id).ok,true);let n=0;
 f.setHook(kind=>{if(kind==='assert'&&++n===6)f.setGuard(()=>false);});assert.equal((await f.connect(id)).ok,false);await cleanup(f,id);
});
for(const operation of ['read','write'])test('pre-entry '+operation+' denial is known negative rather than invented entered I/O',async()=>{
 const f=fixture(),id=f.prepare('deny_'+operation).sessionOwnerId;assert.equal(f.allocate(id).ok,true);const connected=await f.connect(id);assert.equal(connected.ok,true);
 const sh=f.adapter.captureSessionSettlement({sessionOwnerId:id});let guards=0;f.setGuard(()=>++guards<(operation==='read'?2:3));const cut=f.calls.length;
 if(operation==='read')connected.transport.control.stream.on('data',()=>{});else connected.transport.control.stream.write(Buffer.from('no native bytes'));await tick();
 assert.equal(f.calls.slice(cut).some(c=>c[0]===operation),false);const io=sh.snapshot().lanes.find(l=>l.lane==='control').io[operation];assert.equal(io.entered,false);assert.equal(io.unknown,false);
 await cleanup(f,id);assert.equal(sh.snapshot().unknown,false);assert.equal(f.adapter.captureOwnershipSettlement().snapshot().unknown,false);
});
test('Stop reentry in pre-create guard prevents native allocation without inventing a native attempt',async()=>{
 const f=fixture(),id=f.prepare('guard_stop_create').sessionOwnerId,h=f.adapter.captureOwnershipSettlement();let guards=0,p;
 f.setGuard(()=>{if(++guards===4)p=stop(f,id);return true;});assert.equal(f.allocate(id).ok,false);assert.equal(f.calls.some(c=>c[0]==='create'),false);
 f.closeAll();assert.equal((await p).ok,true);f.adapter.retireOwnership();await h.actualSettled;assert.equal(h.snapshot().unknown,false);
});
test('Stop reentry in first accept guard is a known refusal of all unentered accept slots',async()=>{
 const f=fixture(),id=f.prepare('guard_stop_accept').sessionOwnerId;assert.equal(f.allocate(id).ok,true);const h=f.adapter.captureOwnershipSettlement();let guards=0,p;
 f.setGuard(()=>{if(++guards===4)p=stop(f,id);return true;});assert.equal((await f.adapter.connectSession({sessionOwnerId:id,deadlineMs:50})).ok,false);assert.equal(f.calls.some(c=>c[0]==='accept'),false);
 f.closeAll();f.nativeStop.resolve(f.final());assert.equal((await p).ok,true);f.adapter.retireOwnership();await h.actualSettled;assert.equal(h.snapshot().unknown,false);
});
