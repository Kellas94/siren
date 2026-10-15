import test from 'node:test';import assert from 'node:assert/strict';
const module=await import('../src/terminal/ownership.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const {TerminalOwnership}=module;
const birth=134041392000000000n,image='C:\\SIREN\\electron.exe',shellImage='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const member=(pid,exe=image)=>({pid,image:exe,createdFileTime:String(birth+BigInt(pid)),alive:true,exitCode:259});
function fixture(overrides={}){
 assert.equal(typeof TerminalOwnership,'function');let serial=0,admitted=true;const caps=new Map(),calls=[];
 const make=(root,session=false)=>{const cap=Object.freeze({});caps.set(cap,{root,held:[],active:1,killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false,...(session?{shell:false,hostPid:100,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false}:{})});return cap;};
 const clone=cap=>structuredClone(caps.get(cap));
 const die=cap=>{const s=caps.get(cap);s.active=0;s.stopping=true;for(const p of [s.root,s.shell,...s.held])if(p){p.alive=false;p.exitCode=77;}};
 const native={
  start(pid,exe,since){calls.push(['start',pid,exe,since]);return make(member(pid,exe));},
  snapshot:clone,
  createSession(host,exe,entry,directory){calls.push(['create',host,exe,entry,directory]);return make(member(200+(++serial),exe),true);},
  snapshotSession:clone,
  watchRoot(cap,pid,exe,since){calls.push(['watch',cap,pid,exe,since]);const s=caps.get(cap);s.shell=member(pid,exe);s.active=2;return clone(cap);},
  captureSession(cap){const s=caps.get(cap);s.held=[structuredClone(s.root),structuredClone(s.shell)];return clone(cap);},
  stopSession(cap,code){calls.push(['stopSession',cap,code]);die(cap);return true;},
  closeSession(cap){calls.push(['closeSession',cap]);caps.get(cap).closed=true;return true;},
  stop(cap,code){calls.push(['stopHost',cap,code]);for(const c of caps.keys())die(c);return true;},
  close(cap){calls.push(['closeHost',cap]);caps.get(cap).closed=true;return true;},
  ...overrides,
 };
 const owner=new TerminalOwnership({native,isAdmitted:()=>admitted});
 return {owner,native,caps,calls,setAdmitted(v){admitted=v;},die,
  async host(){const r=await owner.startHost({hostProcessIdentity:{pid:100,image,since:birth}});assert.equal(r.ok,true);return r.hostOwnerId;},
  async session(hostOwnerId,n=1){return owner.createSession({hostOwnerId,sessionId:'s_'+n,creator:{executable:image,entry:'C:\\SIREN\\creator.mjs',directory:'D:\\SIREN Data\\session_'+n}});},
  async running(hostOwnerId,n=1){const r=await this.session(hostOwnerId,n);assert.equal(r.ok,true);const w=await owner.watchSessionRoot({sessionOwnerId:r.sessionOwnerId,shellProcessIdentity:{pid:300+n,image:shellImage,since:birth}});assert.equal(w.ok,true);return r.sessionOwnerId;},
 };
}
test('unconfigured ownership refuses all native work and never claims qualification',async()=>{
 assert.equal(typeof TerminalOwnership,'function');const owner=new TerminalOwnership();assert.equal(owner.nativeExecutionAdmitted,false);
 assert.equal((await owner.startHost({hostProcessIdentity:{pid:100,image,since:birth}})).ok,false);
 assert.equal((await owner.adoptSession({})).ok,false);
});
test('host and Session capabilities stay private; two-member creator/shell capture is sufficient',async()=>{
 const f=fixture(),h=await f.host(),s=await f.running(h);
 assert.equal(typeof h,'string');assert.equal(typeof s,'string');assert.equal(f.owner.snapshot().sessions[0].state,'running');
 assert.equal(JSON.stringify(f.owner.snapshot()).includes('createdFileTime'),false);assert.equal(f.calls.filter(c=>c[0]==='create').length,1);
 assert.equal((await f.owner.verifyExit({ownerId:s})).verifiedExited,false);
 assert.equal((await f.owner.stopSession({sessionOwnerId:s,deadlineMs:10000})).ok,true);
 assert.deepEqual(await f.owner.verifyExit({ownerId:s}),{identityKnown:true,verifiedExited:true,remainingCount:0});
});
test('forged IDs, payload accessors and non-atomic adoption never reach native creation',async()=>{
 const f=fixture(),h=await f.host();let gets=0;const bad={};Object.defineProperty(bad,'hostOwnerId',{enumerable:true,get(){gets++;throw Error('getter');}});
 assert.equal((await f.owner.createSession(bad)).ok,false);assert.equal(gets,0);
 assert.equal((await f.owner.createSession({hostOwnerId:'forged',sessionId:'s_1',creator:{executable:image,entry:'C:\\creator.mjs',directory:'D:\\work'}})).ok,false);
 assert.equal((await f.owner.adoptSession({hostOwnerId:h,sessionId:'s_1',shellProcessIdentity:{pid:5}})).ok,false);
 assert.equal(f.calls.some(c=>c[0]==='create'),false);
});
test('ninth atomic creator is refused; verified Stop frees native capacity without reusing owner IDs',async()=>{
 const f=fixture(),h=await f.host(),ids=[];for(let n=1;n<=8;n++)ids.push(await f.running(h,n));
 assert.equal((await f.session(h,9)).code,'CAPACITY_EXCEEDED');assert.equal(f.calls.filter(c=>c[0]==='create').length,8);
 assert.equal((await f.owner.stopSession({sessionOwnerId:ids[0],deadlineMs:10000})).ok,true);
 const fresh=await f.session(h,9);assert.equal(fresh.ok,true);assert.notEqual(fresh.sessionOwnerId,ids[0]);
 assert.ok(f.owner.snapshot().sessions.length<=8);
});
test('unknown create outcome holds capacity; admission revocation prevents subsequent native requests',async()=>{
 const f=fixture({createSession(){throw Error('creation outcome uncertain');}}),h=await f.host();
 for(let n=1;n<=8;n++)assert.equal((await f.session(h,n)).code,'CLEANUP_FAILED');
 assert.equal((await f.session(h,9)).code,'CAPACITY_EXCEEDED');assert.ok(f.owner.snapshot().sessions.every(s=>s.state==='cleanup-failed'));
 f.setAdmitted(false);assert.equal((await f.session(h,10)).code,'HOST_UNAVAILABLE');
});
test('mismatched root birth, wrong host binding and absent containment refuse rather than issue a running owner',async()=>{
 for(const change of [s=>{s.atomicBeforeResume=false;},s=>{s.hostPid=999;},s=>{s.breakaway=true;}]){
  const f=fixture(),h=await f.host(),original=f.native.snapshotSession;f.native.snapshotSession=cap=>{const s=original(cap);change(s);return s;};
  // Native callbacks are captured at construction; exercise mutation through snapshot data instead.
  const create=f.native.createSession;f.native.createSession=(...a)=>{const cap=create(...a);change(f.caps.get(cap));return cap;};
  // A separate adapter captures this deliberately invalid binding.
  const owner=new TerminalOwnership({native:f.native,isAdmitted:()=>true});const hh=await owner.startHost({hostProcessIdentity:{pid:100,image,since:birth}});
  const r=await owner.createSession({hostOwnerId:hh.hostOwnerId,sessionId:'invalid',creator:{executable:image,entry:'C:\\creator.mjs',directory:'D:\\work'}});
  assert.equal(r.ok,false);assert.equal(owner.snapshot().sessions[0].state,'cleanup-failed');
 }
});
test('shell watch must bind the expected image/birth and both held creator and shell identities',async()=>{
 const f=fixture(),h=await f.host(),s=await f.session(h);const cap=f.calls.find(c=>c[0]==='create')&&[...f.caps.keys()].at(-1);
 f.caps.get(cap).shell=false;
 const bad=await f.owner.watchSessionRoot({sessionOwnerId:s.sessionOwnerId,shellProcessIdentity:{pid:301,image:shellImage,since:birth+10000n}});
 assert.equal(bad.ok,false);assert.equal(f.owner.snapshot().sessions[0].state,'cleanup-failed');
});
test('Stop succeeds only after accounting zero and every exact held identity is dead, then native close',async()=>{
 const f=fixture({stopSession(){return true;}}),h=await f.host(),s=await f.running(h);const cap=[...f.caps.keys()].at(-1);
 const pending=f.owner.stopSession({sessionOwnerId:s,deadlineMs:200});
 await new Promise(r=>setTimeout(r,5));assert.equal(f.calls.some(c=>c[0]==='closeSession'),false);
 f.die(cap);assert.equal((await pending).ok,true);assert.equal(f.calls.filter(c=>c[0]==='closeSession').length,1);
});
test('accounting zero with live held process or identity drift remains cleanup-failed',async()=>{
 for(const mutate of [s=>{s.held[0].alive=true;s.held[0].exitCode=259;},s=>{s.root.createdFileTime=String(birth+999n);}]){
  const f=fixture({stopSession(cap){f.die(cap);mutate(f.caps.get(cap));return true;}}),h=await f.host(),s=await f.running(h);
  const r=await f.owner.stopSession({sessionOwnerId:s,deadlineMs:8});
  assert.equal(r.ok,false);assert.equal((await f.owner.verifyExit({ownerId:s})).verifiedExited,false);
  assert.equal(f.calls.some(c=>c[0]==='closeSession'),false);
 }
});
test('close failure does not publish verified exit; a known owner can retry cleanup',async()=>{
 let fail=true;const f=fixture({closeSession(){if(fail)throw Error('wait cancellation failed');return true;}}),h=await f.host(),s=await f.running(h);
 assert.equal((await f.owner.stopSession({sessionOwnerId:s,deadlineMs:10000})).code,'CLEANUP_FAILED');
 assert.equal((await f.owner.verifyExit({ownerId:s})).verifiedExited,false);fail=false;
 assert.equal((await f.owner.stopSession({sessionOwnerId:s,deadlineMs:10000})).ok,true);
});
test('concurrent Session Stop shares one native termination and all-owner cleanup verifies each Session before Host close',async()=>{
 const f=fixture(),h=await f.host(),a=await f.running(h,1);await f.running(h,2);
 const results=await Promise.all(Array.from({length:20},()=>f.owner.stopSession({sessionOwnerId:a,deadlineMs:10000})));
 assert.ok(results.every(r=>r.ok));assert.equal(f.calls.filter(c=>c[0]==='stopSession').length,1);
 assert.equal((await f.owner.stopAll({hostOwnerId:h,deadlineMs:10000})).ok,true);
 assert.equal(f.calls.filter(c=>c[0]==='closeSession').length,2);assert.equal(f.calls.filter(c=>c[0]==='closeHost').length,1);
 assert.equal((await f.owner.verifyExit({ownerId:h})).verifiedExited,true);
});

test('StopAll keeps its own deadline while joining a longer Session cleanup, without freeing its pending work',async()=>{
 let stops=0;const f=fixture({stop(){return true;},stopSession(){stops++;return true;}}),h=await f.host(),s=await f.running(h);
 const pending=f.owner.stopSession({sessionOwnerId:s,deadlineMs:2000});
 await new Promise(r=>setTimeout(r,5));const start=performance.now();
 assert.equal((await f.owner.stopAll({hostOwnerId:h,deadlineMs:20})).ok,false);
 assert.ok(performance.now()-start<1000,'StopAll waited for the longer Session deadline');
 const retry=await f.owner.stopSession({sessionOwnerId:s,deadlineMs:20});assert.equal(retry.ok,false);
 assert.equal(stops,1);assert.equal(f.owner.snapshot().sessions.length,1);
 f.die([...f.caps.keys()].at(-1));assert.equal((await pending).ok,true);
});

test('invalid deadlines and payload Proxies refuse without side effects or property rereads',async()=>{
 const f=fixture(),h=await f.host(),s=await f.running(h);let reads=0;
 const proxy=new Proxy({},{get(){reads++;throw Error('get');},ownKeys(){throw Error('ownKeys');}});
 assert.equal((await f.owner.stopSession(proxy)).ok,false);assert.equal(reads,0);
 for(const deadlineMs of [0,-1,10001,Infinity,NaN,'5'])assert.equal((await f.owner.stopSession({sessionOwnerId:s,deadlineMs})).ok,false);
 assert.equal(f.calls.some(c=>c[0]==='stopSession'),false);
});

test('duplicate or missing captured identities fail closed and unknown create cannot produce a verified Host stop',async()=>{
 for(const mutate of [s=>{s.held[1]=structuredClone(s.held[0]);},s=>{s.held.pop();}]){
  const f=fixture({captureSession(cap){const s=f.caps.get(cap);s.held=[structuredClone(s.root),structuredClone(s.shell)];mutate(s);return structuredClone(s);}}),h=await f.host(),s=await f.session(h);
  assert.equal((await f.owner.watchSessionRoot({sessionOwnerId:s.sessionOwnerId,shellProcessIdentity:{pid:301,image:shellImage,since:birth}})).ok,false);
 }
 const f=fixture({createSession(){throw Error('unknown');}}),h=await f.host();await f.session(h);
 assert.equal((await f.owner.stopAll({hostOwnerId:h,deadlineMs:30})).ok,false);
 assert.equal((await f.owner.verifyExit({ownerId:h})).verifiedExited,false);assert.equal(f.calls.some(c=>c[0]==='closeHost'),false);
});

for(const method of ['stopSession','stopAll'])test(`${method}: each caller has a deadline while eight unresolved slots and one cleanup stay owned`,async()=>{
 let hostStops=0,sessionStops=0;const f=fixture({stop(){hostStops++;return true;},stopSession(){sessionStops++;return true;}}),h=await f.host(),s=await f.running(h,1);
 for(let n=2;n<=8;n++)await f.running(h,n);
 const payload=deadlineMs=>({... (method==='stopSession'?{sessionOwnerId:s}:{hostOwnerId:h}),deadlineMs});
 const first=f.owner[method](payload(2000));await new Promise(r=>setTimeout(r,5));
 const start=performance.now(),short=f.owner[method](payload(20));const result=await short;
 assert.equal(result.ok,false);assert.ok(performance.now()-start<1000);
 assert.equal(f.owner.snapshot().sessions.length,8);assert.equal((await f.owner.verifyExit({ownerId:s})).verifiedExited,false);
 assert.equal(hostStops,method==='stopAll'?1:0);assert.equal(sessionStops,method==='stopAll'?8:1);
 for(const cap of f.caps.keys())f.die(cap);
 assert.equal((await first).ok,true);
});

test('startHost refuses admission revoked during normalization before reserving or starting native work',async()=>{
 const f=fixture();const p=new Proxy({hostProcessIdentity:{pid:100,image,since:birth}},{ownKeys(target){f.setAdmitted(false);return Reflect.ownKeys(target);}});
 assert.equal((await f.owner.startHost(p)).code,'HOST_UNAVAILABLE');assert.equal(f.calls.length,0);assert.equal(f.owner.snapshot().host,null);
 f.setAdmitted(true);const h=await f.host();f.setAdmitted(false);
 assert.equal((await f.owner.stopAll({hostOwnerId:h,deadlineMs:1000})).ok,true,'revoked admission must not disable cleanup');
});
