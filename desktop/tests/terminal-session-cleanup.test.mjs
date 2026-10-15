// Pure deferred provider observations, never native/process execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const api=await import('../src/terminal/session-cleanup.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=()=>new Promise(r=>setImmediate(r));
const identity=(pid,image='C:\\App\\creator.exe')=>({pid,image,createdFileTime:String(133333333333333330n+BigInt(pid))});
const expected=()=>{const root=identity(41),shell=identity(42,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');return{root,shell,hostPid:40,held:[{...root},{...shell},identity(43,'C:\\App\\helper.exe')]};};
const member=(p,exitCode=77)=>({...p,alive:false,exitCode});
const final=(e=expected())=>({closed:true,snapshot:{active:0,root:member(e.root),shell:e.shell===false?false:member(e.shell),held:e.held.map(p=>member(p)),hostPid:e.hostPid,atomicBeforeResume:true,killOnClose:true,breakaway:false,inheritable:false,stopping:true,monitorFired:false,monitorTerminateSucceeded:false,shellMonitorFired:false,shellMonitorTerminated:false}});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(overrides={}){
 assert.equal(typeof api.TerminalSessionCleanup,'function','TerminalSessionCleanup required');const n=deferred(),p=deferred(),events=[],calls=[],e=expected();let cleanup;
 const opts={expected:e,stopNative(code,timeout){calls.push(['native',code,timeout]);return n.promise;},closePeers(){calls.push(['peers']);return p.promise;},onUnavailable(){events.push('unavailable');},onVerified(){events.push('verified');},...overrides};
 cleanup=new api.TerminalSessionCleanup(opts);return{cleanup,opts,e,n,p,events,calls};
}
const request={deadlineMs:200,code:77};
async function complete(f){f.n.resolve(final(f.e));f.p.resolve(true);await tick();}

test('both actual native final snapshot and all-peer closure are necessary and sufficient',async()=>{
 const f=fixture(),pending=f.cleanup.stop(request);assert.deepEqual(f.calls.map(v=>v[0]),['native','peers']);assert.equal(f.cleanup.stats().retainedReservation,1);await complete(f);
 assert.deepEqual({...await pending},{ok:true,code:'CLEANUP_VERIFIED',verifiedExited:true});assert.equal(f.cleanup.verifyExit().identityKnown,true);assert.equal(f.cleanup.verifyExit().verifiedExited,true);assert.equal(f.cleanup.stats().retainedReservation,0);assert.deepEqual(f.events,['verified']);assert.equal(f.cleanup.nativeExecutionAdmitted,false);
 const again=await f.cleanup.stop({deadlineMs:1,code:98});assert.equal(again.ok,true);assert.equal(f.calls.length,2);f.cleanup.dispose();assert.deepEqual(f.events,['verified']);
});

test('early peer closure cannot manufacture exit while native work is unsettled',async()=>{
 const f=fixture(),pending=f.cleanup.stop(request);f.p.resolve(true);await tick();assert.equal(f.cleanup.stats().nativePending,true);assert.equal(f.cleanup.stats().peerPending,false);assert.equal(f.cleanup.verifyExit().identityKnown,false);assert.equal(f.cleanup.verifyExit().verifiedExited,false);assert.deepEqual(f.events,[]);f.n.resolve(final(f.e));assert.equal((await pending).ok,true);
});

test('validated native accounting zero cannot release reservation while peer I/O is unsettled',async()=>{
 const f=fixture(),pending=f.cleanup.stop(request);f.n.resolve(final(f.e));await tick();assert.equal(f.cleanup.verifyExit().identityKnown,true);assert.equal(f.cleanup.verifyExit().verifiedExited,false);assert.equal(f.cleanup.stats().peerPending,true);assert.equal(f.cleanup.stats().retainedReservation,1);f.p.resolve(true);assert.equal((await pending).ok,true);
});

test('timeout fences before caller receipt while late actual completion verifies once',async()=>{
 const f=fixture(),order=[];f.opts.onUnavailable=()=>{throw Error('mutated callback must not run');};const pending=f.cleanup.stop({deadlineMs:10,code:98});pending.then(()=>order.push('receipt'));const first=await pending;
 assert.equal(first.code,'CLEANUP_TIMEOUT');assert.deepEqual(f.events,['unavailable']);assert.deepEqual(order,['receipt']);assert.equal(f.cleanup.stats().nativePending,true);assert.equal(f.cleanup.stats().peerPending,true);assert.equal(f.cleanup.stats().retainedReservation,1);
 f.n.resolve(final(f.e));await tick();assert.equal(f.cleanup.verifyExit().verifiedExited,false);f.p.resolve(true);await tick();assert.deepEqual(f.events,['unavailable','verified']);assert.equal(f.cleanup.verifyExit().verifiedExited,true);assert.equal(f.cleanup.stats().retainedReservation,0);assert.equal((await pending).code,'CLEANUP_TIMEOUT');assert.equal((await f.cleanup.stop(request)).code,'CLEANUP_VERIFIED');assert.equal(f.calls.length,2);
});

test('repeated stop shares the original pending deadline and never invokes providers again',async()=>{
 const f=fixture(),a=f.cleanup.stop({deadlineMs:10,code:77}),b=f.cleanup.stop({deadlineMs:10000,code:98});assert.equal(a,b);assert.equal((await a).code,'CLEANUP_TIMEOUT');assert.equal(await f.cleanup.stop(request),await a);assert.equal(f.calls.length,2);await complete(f);assert.equal((await f.cleanup.stop(request)).ok,true);
});

test('blocking native callback past deadline refuses first receipt despite already resolved outcomes',async()=>{
 const events=[];const f=fixture({stopNative(){const until=performance.now()+15;while(performance.now()<until){}return Promise.resolve(final());},closePeers(){return Promise.resolve(true);},onUnavailable(){events.push('unavailable');},onVerified(){events.push('verified');}});
 const pending=f.cleanup.stop({deadlineMs:5,code:77});assert.deepEqual(events,['unavailable']);assert.equal((await pending).code,'CLEANUP_TIMEOUT');await tick();assert.deepEqual(events,['unavailable','verified']);assert.equal(f.cleanup.verifyExit().verifiedExited,true);
});

test('invocation reservations precede provider reentrant stop and disposal',async()=>{
 const n=deferred(),p=deferred(),events=[],calls=[];let cleanup,reentrant;
 cleanup=new api.TerminalSessionCleanup({expected:expected(),stopNative(){calls.push('native');assert.equal(cleanup.stats().nativeInvoked,true);assert.equal(cleanup.stats().peerInvoked,true);reentrant=cleanup.stop(request);cleanup.dispose();return n.promise;},closePeers(){calls.push('peer');return p.promise;},onUnavailable(){events.push('unavailable');cleanup.dispose();},onVerified(){events.push('verified');cleanup.dispose();}});
 const original=cleanup.stop(request);assert.equal(reentrant,original);assert.deepEqual(calls,['native','peer']);assert.equal((await original).code,'CLEANUP_FAILED');assert.equal(cleanup.stats().retainedReservation,1);n.resolve(final());p.resolve(true);await tick();assert.deepEqual(events,['unavailable','verified']);assert.equal(cleanup.verifyExit().verifiedExited,true);
});

test('native throw still invokes independent peer cleanup once and leaks no private error',async()=>{
 let peers=0;const f=fixture({stopNative(){throw Error('PRIVATE_NATIVE_SECRET');},closePeers(){peers++;return Promise.resolve(true);}}),receipt=await f.cleanup.stop(request);await tick();assert.equal(receipt.code,'CLEANUP_FAILED');assert.equal(JSON.stringify(receipt).includes('PRIVATE'),false);assert.equal(peers,1);assert.equal(f.cleanup.stats().nativeVerified,false);assert.equal(f.cleanup.stats().retainedReservation,1);assert.equal((await f.cleanup.stop(request)).ok,false);assert.equal(peers,1);
});

test('invalid thenables Proxies and poisoned native Promise species are not inspected',async()=>{
 let traps=0;const bad={get then(){traps++;throw Error('PRIVATE');}};
 const proxy=new Proxy(Promise.resolve(final()),{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});
 const poisoned=Promise.resolve(final());Object.defineProperty(poisoned,'constructor',{get(){traps++;throw Error();}});
 for(const value of[bad,proxy,poisoned]){const f=fixture({stopNative:()=>value,closePeers:()=>Promise.resolve(true)});assert.equal((await f.cleanup.stop(request)).code,'CLEANUP_FAILED');assert.equal(f.cleanup.stats().retainedReservation,1);assert.equal(f.cleanup.verifyExit().identityKnown,false);}
 assert.equal(traps,0);
});

test('provider rejections and non-true peer completion preserve unknown reservation',async()=>{
 for(const side of['native','peer','false','object']){const f=fixture(),pending=f.cleanup.stop(request);if(side==='native')f.n.reject(Error('PRIVATE_NATIVE'));else f.n.resolve(final(f.e));if(side==='peer')f.p.reject(Error('PRIVATE_PEER'));else f.p.resolve(side==='false'?false:side==='object'?{closed:true}:true);const r=await pending;assert.equal(r.code,'CLEANUP_FAILED');await tick();assert.equal(f.cleanup.verifyExit().verifiedExited,false);assert.equal(f.cleanup.stats().retainedReservation,1);assert.equal(f.cleanup.stats().nativePending,false);assert.equal(f.cleanup.stats().peerPending,false);assert.equal(JSON.stringify(r).includes('PRIVATE'),false);}
});

test('exact snapshot keys containment flags zero accounting and all dead observations are mandatory',async()=>{
 const changes=[s=>{s.extra=true;},s=>{delete s.monitorFired;},s=>{s.active=1;},s=>{s.root.alive=true;},s=>{s.held[2].alive=true;},s=>{s.shell.alive=true;},...['atomicBeforeResume','killOnClose','stopping'].map(k=>s=>{s[k]=false;}),...['breakaway','inheritable'].map(k=>s=>{s[k]=true;}),...['monitorFired','monitorTerminateSucceeded','shellMonitorFired','shellMonitorTerminated'].map(k=>s=>{s[k]=0;})];
 for(const change of changes){const f=fixture(),pending=f.cleanup.stop(request),r=final(f.e);change(r.snapshot);f.n.resolve(r);f.p.resolve(true);assert.equal((await pending).code,'CLEANUP_FAILED');assert.equal(f.cleanup.verifyExit().identityKnown,false);assert.equal(f.cleanup.stats().retainedReservation,1);}
});

test('root shell host and exact held identity set cannot drift; duplicate observations must agree',async()=>{
 const changes=[r=>{r.snapshot.root.pid++;},r=>{r.snapshot.shell.image=r.snapshot.shell.image.toLowerCase();},r=>{r.snapshot.held[2].createdFileTime='1';},r=>{r.snapshot.hostPid++;},r=>{r.snapshot.held.pop();},r=>{r.snapshot.held[1]={...r.snapshot.held[0]};},r=>{r.snapshot.held[0].exitCode=98;},r=>{r.snapshot.shell=false;},r=>{r.closed=false;},r=>{r.extra=1;}];
 for(const change of changes){const f=fixture(),pending=f.cleanup.stop(request),r=final(f.e);change(r);f.n.resolve(r);f.p.resolve(true);assert.equal((await pending).ok,false);assert.equal(f.cleanup.verifyExit().verifiedExited,false);}
 const f=fixture(),pending=f.cleanup.stop(request),r=final(f.e);r.snapshot.held.reverse();f.n.resolve(r);f.p.resolve(true);assert.equal((await pending).ok,true);
});

test('shell false and empty held snapshot are supported for failed startup cleanup',async()=>{
 const e={root:identity(41),shell:false,held:[],hostPid:40},f=fixture({expected:e}),pending=f.cleanup.stop(request);f.n.resolve(final(e));f.p.resolve(true);assert.equal((await pending).ok,true);
});

test('expected identities are deep copied before mutable caller records change',async()=>{
 const f=fixture(),correct=final(f.e);f.e.root.image='C:\\Wrong.exe';f.e.held[1].pid=800;f.e.hostPid=800;const p=f.cleanup.stop(request);f.n.resolve(correct);f.p.resolve(true);assert.equal((await p).ok,true);
});

test('options expected records arrays callbacks requests and outcome accessors refuse without traps',async()=>{
 let traps=0;const h={get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();},apply(){traps++;throw Error();}},f=fixture();
 const getter={...f.opts};Object.defineProperty(getter,'stopNative',{enumerable:true,get(){traps++;return()=>{};}});
 for(const value of[getter,new Proxy(f.opts,h),{...f.opts,expected:new Proxy(expected(),h)},{...f.opts,expected:{...expected(),held:new Proxy([],h)}},{...f.opts,onVerified:new Proxy(()=>{},h)},{...f.opts,extra:1}])assert.throws(()=>new api.TerminalSessionCleanup(value),TypeError);
 const accessor={deadlineMs:200};Object.defineProperty(accessor,'code',{enumerable:true,get(){traps++;return 77;}});for(const value of[accessor,new Proxy(request,h),{deadlineMs:0,code:77},{deadlineMs:10001,code:77},{deadlineMs:200,code:1},{...request,extra:true}])assert.equal((await f.cleanup.stop(value)).code,'CLEANUP_REFUSED');assert.equal(f.calls.length,0);
 const r=final(),s=r.snapshot;Object.defineProperty(s,'active',{enumerable:true,get(){traps++;return 0;}});const pending=f.cleanup.stop(request);f.n.resolve(r);f.p.resolve(true);assert.equal((await pending).ok,false);assert.equal(traps,0);
});

test('public method shadows cannot suppress timeout verification or revive disposal',async()=>{
 const f=fixture();for(const name of['dispose','verifyExit','stats'])Object.defineProperty(f.cleanup,name,{get(){throw Error('PUBLIC_SHADOW');}});
 const pending=f.cleanup.stop({deadlineMs:10,code:77});assert.equal((await pending).code,'CLEANUP_TIMEOUT');await complete(f);assert.deepEqual(f.events,['unavailable','verified']);assert.equal((await f.cleanup.stop(request)).ok,true);
});

test('dispose before any stop does not start providers or assert observed identity',async()=>{
 const f=fixture();f.cleanup.dispose();assert.deepEqual(f.events,['unavailable']);assert.equal((await f.cleanup.stop(request)).code,'CLEANUP_FAILED');assert.equal(f.calls.length,0);assert.equal(f.cleanup.verifyExit().identityKnown,false);assert.equal(f.cleanup.stats().retainedReservation,1);
});

test('expected constructor bounds uint64 births held count duplicate identity and exact own fields',()=>{
 const f=fixture();for(const change of[e=>{e.extra=true;},e=>{e.root.createdFileTime='0';},e=>{e.root.createdFileTime='01';},e=>{e.root.createdFileTime='18446744073709551616';},e=>{e.root.pid=0;},e=>{e.root.image='relative';},e=>{e.root.image='C:\\bad\ud800';},e=>{e.held=Array.from({length:33},(_,i)=>identity(100+i));},e=>{e.held[1]={...e.held[0]};},e=>{e.held[0].createdFileTime='1';},e=>{e.held.extra=1;}]){const e=expected();change(e);assert.throws(()=>new api.TerminalSessionCleanup({...f.opts,expected:e}),TypeError);}
 const e=expected();e.held=Array.from({length:32},(_,i)=>identity(100+i));assert.doesNotThrow(()=>new api.TerminalSessionCleanup({...f.opts,expected:e}));
});

test('captured callbacks and native then ignore later public accessor mutations',async()=>{
 const f=fixture();let traps=0;for(const p of[f.n.promise,f.p.promise])Object.defineProperty(p,'then',{get(){traps++;throw Error('PRIVATE_THEN');}});
 for(const key of['stopNative','closePeers','onUnavailable','onVerified'])Object.defineProperty(f.opts,key,{get(){traps++;throw Error('PRIVATE_OPTIONS');}});
 const pending=f.cleanup.stop(request);await complete(f);assert.equal((await pending).ok,true);assert.equal(traps,0);assert.deepEqual(f.events,['verified']);
});

test('inherited Promise constructor accessors cannot run during provider observation',async()=>{
 const original=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');let traps=0;const n=deferred(),p=deferred(),f=fixture({stopNative(){Object.defineProperty(Promise.prototype,'constructor',{configurable:true,get(){traps++;return Promise;}});return n.promise;},closePeers(){return p.promise;}});
 let pending;try{pending=f.cleanup.stop(request);assert.equal(traps,0);}finally{Object.defineProperty(Promise.prototype,'constructor',original);}
 assert.equal((await pending).code,'CLEANUP_FAILED');assert.equal(f.cleanup.stats().retainedReservation,1);assert.equal(f.cleanup.verifyExit().identityKnown,false);n.resolve(final());p.resolve(true);
});

test('peer callback blocking past deadline still keeps both actual outcomes tracked',async()=>{
 const events=[],f=fixture({stopNative:()=>Promise.resolve(final()),closePeers(){const until=performance.now()+15;while(performance.now()<until){}return Promise.resolve(true);},onUnavailable(){events.push('unavailable');},onVerified(){events.push('verified');}});
 const pending=f.cleanup.stop({deadlineMs:5,code:77});assert.deepEqual(events,['unavailable']);assert.equal((await pending).code,'CLEANUP_TIMEOUT');await tick();assert.deepEqual(events,['unavailable','verified']);assert.equal(f.cleanup.stats().retainedReservation,0);
});

test('onVerified throw/reentry is called once and a blocking publication respects first deadline',async()=>{
 let cleanup;const events=[];cleanup=new api.TerminalSessionCleanup({expected:expected(),stopNative:()=>Promise.resolve(final()),closePeers:()=>Promise.resolve(true),onUnavailable(){events.push('unavailable');cleanup.dispose();},onVerified(){events.push('verified');assert.equal(cleanup.verifyExit().verifiedExited,true);cleanup.dispose();const until=performance.now()+15;while(performance.now()<until){}throw Error('PRIVATE_CALLBACK');}});
 const first=await cleanup.stop({deadlineMs:5,code:77});assert.equal(first.code,'CLEANUP_TIMEOUT');assert.deepEqual(events,['verified','unavailable']);assert.equal(cleanup.verifyExit().verifiedExited,true);assert.equal((await cleanup.stop(request)).code,'CLEANUP_VERIFIED');assert.deepEqual(events,['verified','unavailable']);
});

test('Proxy final observations and nested prototype proxies are refused before validation traps',async()=>{
 let traps=0;const h={get(target,key){if(key==='then')return undefined;traps++;throw Error('PRIVATE_PROXY');},ownKeys(){traps++;throw Error();},getOwnPropertyDescriptor(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}};
 const values=[new Proxy(final(),h),{...final(),snapshot:new Proxy(final().snapshot,h)},{...final(),snapshot:Object.create(new Proxy({},h))}];
 for(const value of values){const f=fixture(),pending=f.cleanup.stop(request);f.n.resolve(value);f.p.resolve(true);assert.equal((await pending).ok,false);assert.equal(f.cleanup.verifyExit().identityKnown,false);}
 assert.equal(traps,0);
});

test('replacement Promise species getter is refused without executing it',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(Promise,Symbol.species),n=deferred(),p=deferred();let traps=0;
 const f=fixture({stopNative(){Object.defineProperty(Promise,Symbol.species,{configurable:true,get(){traps++;return Promise;}});return n.promise;},closePeers(){return p.promise;}});
 let pending;try{pending=f.cleanup.stop(request);assert.equal(traps,0);}finally{Object.defineProperty(Promise,Symbol.species,descriptor);}
 assert.equal((await pending).code,'CLEANUP_FAILED');assert.equal(f.cleanup.stats().retainedReservation,1);n.resolve(final());p.resolve(true);
});
