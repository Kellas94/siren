import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalRequestRouter} from '../src/terminal/request-router.mjs';
const later=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('original boundary does not assimilate provider then getters or refund unknown work',async()=>{
 let reads=0;const value=Object.defineProperty({},'then',{get(){reads++;throw Error('PRIVATE');}}),f=fixture(()=>value,{maxPending:1,maxPendingPerCaller:1});
 assert.equal((await f.route()).code,'HOST_UNAVAILABLE');assert.equal(reads,0);assert.equal(f.router.stats().pending,1);assert.equal((await f.route()).code,'CAPACITY_EXCEEDED');
});
function fixture(list=()=>({ok:true}),limits={}){
 const sender={},senderFrame={},event={sender,senderFrame},grant=Object.freeze({windowId:'w',projectId:'p',epoch:1,role:'workspace',webContentsId:1,mainFrameUrl:'siren://app'});
 const state={calls:0,captures:0,guards:0,admissionCaptures:0,captureHook:null,guardHook:null,currentHook:null,captureResult:null};
 const registry={capture(){state.captures++;state.captureHook?.();return state.captureResult??grant;},isCurrent(){return state.currentHook?.()??true;},captureAdmissionGuard(){state.admissionCaptures++;return{isCurrent(){state.guards++;state.guardHook?.();return true;}};}};
 const manager={list(...args){state.calls++;return list(...args);},stop(){assert.fail('router retirement cannot Stop');}};
 const router=new TerminalRequestRouter({registry,manager,...limits});
 const route=()=>router.route({event,method:'terminalList',payload:{operationId:'op1',epoch:1}});
 return{router,route,state,manager,registry,event};
}
test('stable router retirement is passive strict and permanently fenced',async()=>{
 const f=fixture(),h=f.router.captureRouterSettlement();assert.equal(Object.isFrozen(h),true);assert.equal(h,f.router.captureRouterSettlement());assert.equal(h.snapshot().actualSettled,false);
 let reads=0;const p=new Proxy({},{get(){reads++;throw Error();}});assert.equal(f.router.captureRouterSettlement(p),null);assert.equal(f.router.retireRouter(p),null);assert.equal(reads,0);
 assert.equal(f.router.retireRouter(),h);assert.equal(f.router.retireRouter(),h);const receipt=await h.actualSettled;assert.equal(receipt.scope,'ROUTER_REQUESTS');assert.equal(receipt.nativeExecutionAdmitted,false);assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.state.captures,0);
});
test('revoke waits held original manager work and stale public response unwind',async()=>{
 const d=deferred(),f=fixture(()=>d.promise),h=f.router.captureRouterSettlement(),r=f.route();f.router.revoke();assert.equal(h.snapshot().actualSettled,false);assert.equal(f.router.stats().pending,1);
 d.resolve({ok:true,secret:'NO'});assert.equal((await r).code,'SENDER_REFUSED');await h.actualSettled;assert.equal(h.snapshot().pending,0);assert.equal(f.router.stats().callers,0);
});
test('reentrant capture retirement cannot resolve until entered callback unwinds',async()=>{
 const f=fixture(),h=f.router.captureRouterSettlement();let inside;
 f.state.captureHook=()=>{f.router.retireRouter();inside=h.snapshot();};assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(inside.actualSettled,false);assert(inside.activeFrames>0);await h.actualSettled;assert.equal(f.state.calls,0);
});
test('manager retirement reentry retains the already reserved dispatch',async()=>{
 const d=deferred();let f,inside;f=fixture(()=>{f.router.retireRouter();inside=f.router.captureRouterSettlement().snapshot();return d.promise;});const h=f.router.captureRouterSettlement(),r=f.route();assert.equal(inside.actualSettled,false);assert.equal(inside.pending,1);d.resolve({ok:true});assert.equal((await r).code,'SENDER_REFUSED');await h.actualSettled;
});
test('two originals with same operation ID are joined independently',async()=>{
 const a=deferred(),b=deferred();let n=0;const f=fixture(()=>[a,b][n++].promise),h=f.router.captureRouterSettlement(),ra=f.route(),rb=f.route();f.router.dispose();a.resolve({ok:true});await ra;await later();assert.equal(h.snapshot().actualSettled,false);assert.equal(f.router.stats().pending,1);b.reject(Error('SECRET'));assert.equal((await rb).code,'SENDER_REFUSED');await h.actualSettled;
});
test('own then on genuine native original is never called',async()=>{
 let reads=0;const d=deferred();Object.defineProperty(d.promise,'then',{get(){reads++;throw Error();}});const f=fixture(()=>d.promise),h=f.router.captureRouterSettlement(),r=f.route();f.router.retireRouter();d.resolve({ok:true});assert.equal((await r).code,'SENDER_REFUSED');await h.actualSettled;assert.equal(reads,0);
});
for(const shape of ['proxy','then-getter','then-function','inherited-getter','constructor-getter'])test('unsafe original '+shape+' refuses without evaluation and retains finite charge',async()=>{
 let reads=0;const d=deferred();let value=d.promise;
 if(shape==='proxy')value=new Proxy(value,{get(){reads++;throw Error();}});
 if(shape==='then-getter')value=Object.defineProperty({},'then',{get(){reads++;throw Error();}});
 if(shape==='then-function')value={then(){reads++;}};
 if(shape==='inherited-getter')value=Object.create(Object.defineProperty({},'then',{get(){reads++;throw Error();}}));
 if(shape==='constructor-getter')Object.defineProperty(value,'constructor',{get(){reads++;throw Error();}});
 const f=fixture(()=>value,{maxPending:1,maxPendingPerCaller:1}),h=f.router.captureRouterSettlement();assert.equal((await f.route()).code,'HOST_UNAVAILABLE');assert.equal(reads,0);assert.equal(f.router.stats().pending,1);assert.equal((await f.route()).code,'CAPACITY_EXCEEDED');f.router.retireRouter();d.resolve({ok:true});await later();assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().unknown,true);assert.equal(reads,0);
});
test('known synchronous throw and original rejection complete negative calls',async()=>{
 for(const mode of ['throw','reject']){const f=fixture(()=>{if(mode==='throw')throw Error('SECRET');return Promise.reject(Error('SECRET'));}),h=f.router.captureRouterSettlement();const r=await f.route();assert.equal(r.code,'HOST_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('SECRET'),false);f.router.retireRouter();await h.actualSettled;assert.equal(h.snapshot().unknown,false);}
});
test('reentrant guard cannot turn checked synchronous DTO into an assimilated thenable',async()=>{
 let reads=0,dispatched=false;const result={ok:true},f=fixture(()=>{dispatched=true;return result;});
 f.state.guardHook=()=>{if(dispatched)result.then=resolve=>{reads++;resolve({ok:true,private:'NO'});};};
 const answer=await f.route();assert.equal(reads,0);assert.equal(answer.code,'HOST_UNAVAILABLE');assert.equal(f.router.stats().pending,1);f.router.retireRouter();assert.equal(f.router.captureRouterSettlement().snapshot().unknown,true);
});
test('passive snapshots and repeated retirement do not execute callback capabilities',async()=>{
 const f=fixture(),h=f.router.captureRouterSettlement();await f.route();const before={...f.state};for(let i=0;i<20;i++){h.snapshot();f.router.captureRouterSettlement();}assert.deepEqual(f.state,before);f.router.retireRouter();await h.actualSettled;for(let i=0;i<20;i++)f.router.retireRouter();assert.deepEqual(f.state,before);
});
test('retained completed handle does not retain manager or registry objects',async()=>{
 assert.equal(typeof global.gc,'function');let f=fixture();const h=f.router.captureRouterSettlement(),refs=[new WeakRef(f.router),new WeakRef(f.manager),new WeakRef(f.registry)];await f.route();f.router.dispose();await h.actualSettled;f=null;for(let i=0;i<30;i++){await later();global.gc();}assert.equal(h.snapshot().actualSettled,true);assert(refs.every(r=>r.deref()===undefined));
});
test('unexpected async capture retains only bounded pre-admission workers',async()=>{
 const f=fixture(),h=f.router.captureRouterSettlement();f.registry.capture=()=>Promise.resolve(null);
 // Dependencies are captured at construction; construct a fresh router.
 const router=new TerminalRequestRouter({registry:f.registry,manager:f.manager});const r=()=>router.route({event:f.event,method:'terminalList',payload:{operationId:'op1',epoch:1}});
 for(let i=0;i<64;i++)assert.equal((await r()).code,'SENDER_REFUSED');assert.equal((await r()).code,'CAPACITY_EXCEEDED');router.retireRouter();assert.equal(router.captureRouterSettlement().snapshot().pendingWorkers,64);assert.equal(router.captureRouterSettlement().snapshot().unknown,true);assert.equal(f.state.calls,0);f.router.retireRouter();await h.actualSettled;
});
test('router actual waits for full public continuation after dispatch charge drains',async()=>{
 const f=fixture(),h=f.router.captureRouterSettlement(),r=f.route();f.router.retireRouter();const inside=await r.then(()=>h.snapshot());assert.equal(inside.actualSettled,false);assert.equal(inside.pending,0);await h.actualSettled;assert.equal(h.snapshot().pendingWorkers,0);
});
test('async result made unsafe before router handler is never assimilated',async()=>{
 let reads=0;const value={ok:true},original=Promise.resolve(value),f=fixture(()=>original);Object.defineProperty(value,'then',{get(){reads++;throw Error('PRIVATE');}});assert.equal((await f.route()).code,'HOST_UNAVAILABLE');assert.equal(reads,0);f.router.retireRouter();assert.equal(f.router.captureRouterSettlement().snapshot().unknown,true);
});
test('registry current retirement fences a later admission-guard capture',async()=>{
 const f=fixture();f.state.currentHook=()=>f.router.retireRouter();assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.state.admissionCaptures,0);await f.router.captureRouterSettlement().actualSettled;
});
test('live registry callback retirement fences a later guard invocation',async()=>{
 const f=fixture();let n=0;f.state.currentHook=()=>{if(++n===2)f.router.retireRouter();};assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.state.guards,0);await f.router.captureRouterSettlement().actualSettled;
});
test('native sender getter retirement fences senderFrame and registry capture',async()=>{
 const f=fixture();let reads=0;const event={get sender(){f.router.retireRouter();return{};},get senderFrame(){reads++;return{};}};assert.equal((await f.router.route({event,method:'terminalList',payload:{operationId:'op1',epoch:1}})).code,'SENDER_REFUSED');assert.equal(reads,0);assert.equal(f.state.captures,0);await f.router.captureRouterSettlement().actualSettled;
});
test('unsafe asynchronous grant-shaped capture never becomes dispatch authority',async()=>{
 let reads=0;const f=fixture();f.state.captureResult={windowId:'w',projectId:'p',epoch:1,role:'workspace',webContentsId:1,mainFrameUrl:'siren://app',then(){reads++;}};
 assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.state.calls,0);assert.equal(f.state.admissionCaptures,0);assert.equal(reads,0);f.router.retireRouter();assert.equal(f.router.captureRouterSettlement().snapshot().unknown,true);
});
test('final admission guard reentry cannot bypass global or per-caller capacity',async()=>{
 const d=deferred(),f=fixture(()=>d.promise,{maxPending:1,maxPendingPerCaller:1});let nested;
 f.state.guardHook=()=>{if(f.state.guards===2)nested=f.route();};const outer=f.route();try{assert.equal(f.router.stats().pending,1);assert.equal(f.state.calls,1);}finally{d.resolve({ok:true});await Promise.all([outer,nested]);}f.router.retireRouter();await f.router.captureRouterSettlement().actualSettled;
});
for(const target of ['manager','guard'])for(const meta of ['bind','length','name'])test('callable own '+meta+' accessor is never evaluated for '+target,async()=>{
 let reads=0;const fn=()=>target==='manager'?{ok:true}:true;Object.defineProperty(fn,meta,{get(){reads++;return meta==='bind'?Function.prototype.bind:meta==='length'?0:'fn';}});const f=fixture();
 if(target==='manager')f.manager.list=fn;else f.registry.captureAdmissionGuard=()=>({isCurrent:fn});const router=new TerminalRequestRouter({registry:f.registry,manager:f.manager});assert.equal((await router.route({event:f.event,method:'terminalList',payload:{operationId:'op1',epoch:1}})).ok,true);assert.equal(reads,0);router.retireRouter();await router.captureRouterSettlement().actualSettled;f.router.retireRouter();
});
for(const mode of ['canonical','idle-eviction'])test('unknown current callback cannot rotate caller or restore admission in '+mode,async()=>{
 const f=fixture(()=>({ok:true}),{maxCallers:1});await f.route();await later();let calls=0;f.state.currentHook=()=>++calls===2?Promise.resolve(true):true;
 const result=await f.router.route({event:mode==='canonical'?f.event:{sender:{},senderFrame:{}},method:'terminalList',payload:{operationId:'op1',epoch:1}});assert.equal(result.code,'SENDER_REFUSED');assert.equal(f.state.calls,1);assert.equal(f.router.stats().callers,1);f.router.retireRouter();assert.equal(f.router.captureRouterSettlement().snapshot().unknown,true);
});
