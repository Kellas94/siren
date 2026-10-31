// Inert private MAIN composition controls, not addon or process attestation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHook} from 'node:async_hooks';
import {createDesktopNativeHostReservation} from '../src/terminal/desktop-native-host-reservation.mjs';
import {createCapturedHostAsyncOperation} from '../src/terminal/host-async-captured-operation.mjs';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {deferred,inertTick} from './fixtures/terminal-manager-global.mjs';

const identity=Object.freeze({pid:101,image:'C:\\Runtime\\electron.exe',since:1n});
const request=Object.freeze({code:98,deadlineMs:400,shutdownId:'reservation_shared'});
const utilityReceipt=()=>Object.freeze({utilityExited:true,exitCode:0,nativeCleanupVerified:false,nativeExecutionAdmitted:false});
async function until(predicate){for(let i=0;i<100&&!predicate();i++)await inertTick();assert(predicate(),'finite inert progress');}
function setup(change=()=>{}){
 const n=fixture({noStart:true,hostOrdinals:[17]}),ready=deferred(),retired=deferred(),trace=[],requests=[];
 const s={n,ready,retired,trace,requests,context:Object.freeze({}),resources:Object.freeze({}),current:true};
 s.options={native:n.native,isCurrent:()=>s.current,reserveUtilityHost(...args){trace.push('reserve');assert.deepEqual(args,[s.resources]);return {ready:ready.promise,retire(...values){trace.push('utility-retire');requests.push(values);return retired.promise;},snapshot:()=>({})};}};
 change(s);s.composer=createDesktopNativeHostReservation(s.options);s.reserve=()=>s.composer.reserveHost(s.context,s.resources);
 s.activate=async()=>{s.reservation=s.reserve();await until(()=>trace.includes('reserve'));ready.resolve({hostProcessIdentity:identity});s.value=await s.reservation.ready;return s.value;};
 s.start=()=>s.value.native.start(identity.pid,identity.image,identity.since);
 s.finish=async(p)=>{await until(()=>n.calls.some(r=>r[0]==='hostStop'));n.hostStop.resolve(n.finalHost());retired.resolve(utilityReceipt());return p;};
 return s;
}

test('STRUCTURAL API: synchronous exact reservation exists before any utility callout',async()=>{
 const s=setup(),r=s.reserve();assert.deepEqual(Reflect.ownKeys(r).sort(),['ready','retire']);assert.equal(s.trace.length,0);assert.throws(s.reserve,/BUSY/);await until(()=>s.trace.includes('reserve'));s.ready.resolve({hostProcessIdentity:identity});const value=await r.ready;assert.deepEqual(Reflect.ownKeys(value).sort(),['hostProcessIdentity','native']);assert.deepEqual({...value.hostProcessIdentity},identity);assert(Object.isFrozen(value.native));const p=r.retire(request);s.retired.resolve(utilityReceipt());assert.deepEqual({...await p},{utilityExited:true,nativeCleanupVerified:true});assert.equal(s.n.calls.length,0);
});

test('captured facade retains raw receiver and starts exactly one opaque host',async()=>{
 const s=setup();s.n.native.start=()=>{throw Error('late mutation must not run');};await s.activate();const host=s.start();assert.deepEqual(host,{});assert.throws(s.start,/START_REFUSED/);assert.equal(s.n.calls.filter(r=>r[0]==='start').length,1);const p=s.reservation.retire(request);assert.equal((await s.finish(p)).nativeCleanupVerified,true);const call=s.n.calls.find(r=>r[0]==='hostStop');assert.equal(call[1],host);assert.equal(call[5],s.n.native);assert.deepEqual(s.requests,[[]]);
});

test('graph and emergency retirement share original captured native operation and roster',async()=>{
 const s=setup();await s.activate();const host=s.start(),graphOperation=createCapturedHostAsyncOperation({native:s.value.native,host});assert.equal(graphOperation.start(request),s.n.hostStop.promise);const p=s.reservation.retire({...request});assert.equal(p,s.reservation.retire(request));const result=await s.finish(p);assert.equal(result.nativeCleanupVerified,true);assert.equal((await graphOperation.captureSettlement().actualSettled).actualSettled,true);assert.equal(s.n.calls.filter(r=>r[0]==='hostStop').length,1);assert(s.n.calls.filter(r=>r[0]==='hostRoster').every(r=>r[2]===request.shutdownId));assert.equal(s.requests.length,1);
});

test('conflicting shutdown values refuse without replacing original request or promise',async()=>{
 const s=setup();await s.activate();s.start();const p=s.reservation.retire(request);for(const replacement of [{code:77},{deadlineMs:399},{shutdownId:'conflict'}])await assert.rejects(s.reservation.retire({...request,...replacement}),/CONFLICT/);assert.equal(p,s.reservation.retire(request));assert.equal((await s.finish(p)).nativeCleanupVerified,true);assert.equal(s.n.calls.filter(r=>r[0]==='hostStop').length,1);assert.deepEqual(s.n.calls.find(r=>r[0]==='hostStop').slice(2,5),[98,400,'reservation_shared']);
});

test('retirement while utility readiness is pending joins actual utility retirement',async()=>{
 const s=setup(),r=s.reserve();await until(()=>s.trace.includes('reserve'));let done=false;const p=r.retire(request);p.then(()=>done=true);await until(()=>s.trace.includes('utility-retire'));await inertTick();assert.equal(done,false);s.ready.resolve({hostProcessIdentity:identity});await assert.rejects(r.ready,/RETIRED/);s.retired.resolve(utilityReceipt());assert.equal((await p).utilityExited,true);assert.equal(s.n.calls.length,0);
});

test('retirement before deferred startup fences utility creation without a callout',async()=>{
 const s=setup(),r=s.reserve(),p=r.retire(request);await assert.rejects(r.ready,/RETIRED/);assert.deepEqual({...await p},{utilityExited:true,nativeCleanupVerified:true});assert.deepEqual(s.trace,[]);assert.equal(s.n.calls.length,0);
});

test('partially throwing utility reservation remains charged unknown',async()=>{
 const s=setup(x=>{x.options.reserveUtilityHost=()=>{x.trace.push('allocated-then-threw');throw Error('partial');};}),r=s.reserve();await assert.rejects(r.ready,/START_UNKNOWN/);const result=await r.retire(request);assert.equal(result.utilityExited,false);assert.equal(result.nativeCleanupVerified,true);assert.deepEqual(s.trace,['allocated-then-threw']);
});

for(const kind of ['throw','invalid-host'])test('raw native start '+kind+' remains unknown after entry',async()=>{
 let reads=0;const s=setup(x=>{x.n.native.start=()=>{x.trace.push('raw-allocation');if(kind==='throw')throw Error('partial');return Object.defineProperty({},'opaque',{get(){reads++;throw Error();}});};});await s.activate();assert.throws(s.start,/START_UNKNOWN/);const p=s.reservation.retire(request);s.retired.resolve(utilityReceipt());assert.equal((await p).nativeCleanupVerified,false);assert.equal(reads,0);
});

test('reentrant retirement during raw start captures the returned host before stale refusal',async()=>{
 let retirement;const s=setup(x=>{const raw=x.n.native.start;x.n.native.start=function(...args){retirement=x.reservation.retire(request);return Reflect.apply(raw,this,args);};});await s.activate();assert.throws(s.start,/RETIRED/);assert.equal(retirement,s.reservation.retire(request));assert.equal((await s.finish(retirement)).nativeCleanupVerified,true);assert.equal(s.n.calls.filter(r=>r[0]==='start').length,1);
});

test('malformed native receipt publishes explicit unknown without awaiting never-settled actual handle',async()=>{
 const s=setup();await s.activate();s.start();const p=s.reservation.retire(request);await until(()=>s.n.calls.some(r=>r[0]==='hostStop'));s.n.hostStop.resolve({});s.retired.resolve(utilityReceipt());assert.equal((await p).nativeCleanupVerified,false);
});

test('unsupported native thenable is never assimilated and cannot verify cleanup',async()=>{
 let reads=0;const s=setup(x=>{x.n.native.stopAndCloseHostAsync=()=>Object.defineProperty({},'then',{get(){reads++;throw Error();}});});await s.activate();s.start();const p=s.reservation.retire(request);s.retired.resolve(utilityReceipt());assert.equal((await p).nativeCleanupVerified,false);assert.equal(reads,0);
});

test('unresolved native promise is bounded unknown while utility may be verified',async()=>{
 const s=setup();await s.activate();s.start();const p=s.reservation.retire({...request,deadlineMs:10});s.retired.resolve(utilityReceipt());const r=await p;assert.equal(r.nativeCleanupVerified,false);assert.equal(r.utilityExited,true);
});

test('unresolved utility promise is bounded unknown without promoting native state',async()=>{
 const s=setup();await s.activate();s.start();const p=s.reservation.retire({...request,deadlineMs:10});await until(()=>s.n.calls.some(r=>r[0]==='hostStop'));s.n.hostStop.resolve(s.n.finalHost());const r=await p;assert.equal(r.nativeCleanupVerified,true);assert.equal(r.utilityExited,false);
});

test('utility malformed receipt does not borrow native success',async()=>{
 const s=setup();await s.activate();s.start();const p=s.reservation.retire(request);await until(()=>s.n.calls.some(r=>r[0]==='hostStop'));s.n.hostStop.resolve(s.n.finalHost());s.retired.resolve({...utilityReceipt(),nativeCleanupVerified:true});assert.equal((await p).utilityExited,false);
});

test('retirement callback and Promise-init reentry retain one promise and one operation',async()=>{
 let nested;const s=setup(x=>{x.options.reserveUtilityHost=()=>{x.trace.push('reserve');return {ready:x.ready.promise,retire(){x.trace.push('utility-retire');nested=x.reservation.retire(request);return x.retired.promise;}};};});await s.activate();s.start();let once=false,hook,fromHook;hook=createHook({init(_id,type){if(type==='PROMISE'&&!once){once=true;fromHook=s.reservation.retire(request);}}});let p;hook.enable();try{p=s.reservation.retire(request);}finally{hook.disable();}assert.equal(fromHook,p);assert.equal((await s.finish(p)).nativeCleanupVerified,true);assert.equal(nested,p);assert.equal(s.trace.filter(v=>v==='utility-retire').length,1);assert.equal(s.n.calls.filter(r=>r[0]==='hostStop').length,1);
});

test('freshness callback reentry fences raw start and preserves utility cleanup',async()=>{
 let retireOnCheck=false;const s=setup(x=>{x.options.isCurrent=()=>{if(retireOnCheck)x.reservation.retire(request);return true;};});await s.activate();retireOnCheck=true;assert.throws(s.start,/RETIRED/);const p=s.reservation.retire(request);s.retired.resolve(utilityReceipt());assert.equal((await p).nativeCleanupVerified,true);assert.equal(s.n.calls.length,0);
});

test('adapter and shutdown accessors or proxies are refused without evaluating getters',async()=>{
 let reads=0;const s=setup();assert.throws(()=>createDesktopNativeHostReservation(Object.defineProperty({},'native',{get(){reads++;throw Error();}})),/ADAPTER_REFUSED/);const r=s.reserve();await assert.rejects(r.retire(Object.defineProperty({...request},'code',{enumerable:true,get(){reads++;throw Error();}})),/REQUEST_REFUSED/);await assert.rejects(r.retire(new Proxy(request,{})),/REQUEST_REFUSED/);const p=r.retire(request);s.retired.resolve(utilityReceipt());assert.equal((await p).utilityExited,true);assert.equal(reads,0);
});

test('same stop request after successful settlement keeps original native promise',async()=>{
 const s=setup();await s.activate();const host=s.start(),p=s.reservation.retire(request);await s.finish(p);assert.equal(s.value.native.stopAndCloseHostAsync(host,request.code,request.deadlineMs,request.shutdownId),s.n.hostStop.promise);assert.equal(s.n.calls.filter(r=>r[0]==='hostStop').length,1);assert.equal(s.reservation.retire(request),p);
});

test('malformed utility readiness still requests its retained retirement but remains unknown',async()=>{
 let reads=0;const s=setup(x=>{x.options.reserveUtilityHost=()=>({ready:Object.defineProperty({},'then',{get(){reads++;throw Error();}}),retire(...args){x.trace.push('utility-retire');assert.equal(args.length,0);return x.retired.promise;}});}),r=s.reserve();await assert.rejects(r.ready,/START_UNKNOWN/);const p=r.retire(request);await until(()=>s.trace.includes('utility-retire'));s.retired.resolve(utilityReceipt());assert.equal((await p).utilityExited,false);assert.equal(reads,0);
});

test('utility reservation callback reentry cannot replace the reserved capability',async()=>{
 let nested,nestedRetire;const s=setup(x=>{x.options.reserveUtilityHost=()=>{x.trace.push('reserve');assert.throws(()=>x.reserve(),/BUSY/);nestedRetire=x.reservation.retire(request);return {ready:x.ready.promise,retire(){nested=x.reservation.retire(request);return x.retired.promise;}};};}),r=s.reservation=s.reserve();await until(()=>s.trace.includes('reserve'));await assert.rejects(r.ready,/RETIRED/);s.retired.resolve(utilityReceipt());assert.equal((await nestedRetire).utilityExited,true);assert.equal(nestedRetire,r.retire(request));assert.equal(nested,nestedRetire);assert.equal(s.n.calls.length,0);
});
