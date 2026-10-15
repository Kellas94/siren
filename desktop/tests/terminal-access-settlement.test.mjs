import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './fixtures/terminal-access-settlement.mjs';
import {privateManager,deferred,inertTick,until} from './fixtures/terminal-manager-global.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('manager control capture is strict stable and waits lower original after public deadline',async()=>{
 const held=deferred();let hold=false,genuine;const h=privateManager({deadlineMs:25,wrap:{sendGate:({invoke})=>{const p=invoke();if(hold){genuine=p;return held.promise;}return p;}}});
 try{await h.ready('');hold=true;const p=h.manager.closeInput('held');assert.equal(typeof h.manager.captureManagerRequestSettlement,'function');const handle=h.manager.captureManagerRequestSettlement(p);assert(Object.isFrozen(handle));assert.equal(h.manager.captureManagerRequestSettlement(p),handle);assert.equal((await p).ok,false);await pause(20);assert.equal(handle.snapshot().actualSettled,false);assert.equal(h.manager.closeInput('duplicate'),p);held.resolve(await genuine);assert.equal((await handle.actualSettled).scope,'MANAGER_CONTROL_REQUEST');assert.equal(handle.snapshot().actualSettled,true);}finally{held.resolve();await h.end();}
});
test('access Lock retains worker beyond lower public timeout until original CLOSE drains',async()=>{
 const held=deferred();let hold=false,genuine;const s=setup({deadlineMs:45,manager:{deadlineMs:20,wrap:{sendGate:({invoke})=>{const p=invoke();if(hold){genuine=p;return held.promise;}return p;}}}});
 try{await s.h.ready('');hold=true;assert.equal((await s.controller.beginLock()).ok,false);await pause(40);assert.equal(s.controller.stats().retainedWorkers,1);assert.equal((await s.controller.reopen(s.event)).code,'TRANSITION_BUSY');assert.equal(s.trace.some(x=>x.name==='retire'),false);held.resolve(await genuine);await until(()=>s.controller.stats().retainedWorkers===0,'exact manager request drained');}finally{held.resolve();await s.end();}
});
test('access global retirement stable no-arg handle and no post-retire callbacks',async()=>{
 const s=setup();try{await s.h.ready('');assert.equal(typeof s.controller.captureAccessSettlement,'function');const h=s.controller.captureAccessSettlement();assert(Object.isFrozen(h));assert.equal(s.controller.captureAccessSettlement(1),null);assert.equal(s.controller.retireAccess(1),null);assert.equal(s.controller.retireAccess(),h);assert.equal(s.controller.retireAccess(),h);assert.equal(s.h.manager.stats().retired,true);assert.equal(s.router.stats().revoked,true);const calls=JSON.stringify(s.h.calls),trace=s.trace.length;for(let i=0;i<64;i++){assert.equal((await s.controller.reopen(s.event)).code,'TRANSITION_RETIRED');assert.equal((await s.controller.beginLock()).code,'TRANSITION_RETIRED');assert.equal(s.controller.currentRouter(),null);}const r=await h.actualSettled;assert.deepEqual(r,{scope:'ACCESS_TRANSITIONS',actualSettled:true,nativeExecutionAdmitted:false});assert(Object.isFrozen(r));assert.equal(JSON.stringify(s.h.calls),calls);assert.equal(s.trace.length,trace);}finally{await s.end();}
});
test('retireAccess waits held preparation and never begins late retireViews',async()=>{
 const held=deferred();const s=setup({prepare:()=>held.promise});try{await s.h.ready('');const p=s.controller.beginLock();await until(()=>s.trace.some(x=>x.name==='prepare'),'entered hook');assert.equal(typeof s.controller.retireAccess,'function');const h=s.controller.retireAccess();assert.equal((await p).ok,false);await inertTick();assert.equal(h.snapshot().actualSettled,false);held.resolve();await h.actualSettled;assert.equal(s.trace.some(x=>x.name==='retire'),false);assert.equal(h.snapshot().actualSettled,true);}finally{held.resolve();await s.end();}
});
test('retireAccess waits superseded OPEN rollback and newer Lock as separate workers',async()=>{
 const held=deferred();const s=setup({rollback:()=>held.promise});try{await s.h.ready('');await s.controller.beginLock();const p=s.controller.reopen(s.event);await until(()=>s.trace.some(x=>x.name==='rollback'),'rollback');const q=s.controller.beginLock();assert.equal(typeof s.controller.retireAccess,'function');const h=s.controller.retireAccess();await p;await q;assert.equal(h.snapshot().actualSettled,false);held.resolve();await h.actualSettled;assert.equal(h.snapshot().pendingTransitions,0);assert.equal(s.trace.filter(x=>x.name==='retire').length,1);}finally{held.resolve();await s.end();}
});
test('unknown entered hook keeps permanent access actual pending',async()=>{
 const s=setup({prepare:()=>{throw Error('unknown');},deadlineMs:20});try{await s.h.ready('');await s.controller.beginLock();assert.equal(typeof s.controller.retireAccess,'function');const h=s.controller.retireAccess();await pause(25);assert.equal(h.snapshot().actualSettled,false);assert.equal(s.controller.stats().quarantinedWorkers,1);}finally{await s.end();}
});
test('completed manager request handle belongs to exact original Promise only',async()=>{
 const a=privateManager(),b=privateManager();try{const p=a.manager.resumeInput(),q=b.manager.resumeInput();assert.equal(typeof a.manager.captureManagerRequestSettlement,'function');const h=a.manager.captureManagerRequestSettlement(p);assert.equal(a.manager.captureManagerRequestSettlement(q),null);assert.equal(a.manager.captureManagerRequestSettlement(p,1),null);let gets=0;for(const value of [null,{},new Proxy({}, {get(){gets++;},getPrototypeOf(){gets++;}}),Object.defineProperty({},'then',{get(){gets++;}})])assert.equal(a.manager.captureManagerRequestSettlement(value),null);await p;await h.actualSettled;assert.equal(a.manager.captureManagerRequestSettlement(p),h);assert(Object.isFrozen(h.snapshot()));assert.equal(gets,0);}finally{await a.end();await b.end();}
});
test('completed control handle never becomes authority for a newer same-kind request',async()=>{
 const h=privateManager();try{const p=h.manager.resumeInput(),a=h.manager.captureManagerRequestSettlement(p);await p;await a.actualSettled;const q=h.manager.closeInput('new'),b=h.manager.captureManagerRequestSettlement(q);assert.notEqual(a,b);assert.notEqual(a.requestId,b.requestId);await q;const r=await b.actualSettled;assert.equal(r.kind,'close');assert.equal(r.requestId,b.requestId);assert.equal(a.snapshot().actualSettled,true);}finally{await h.end();}
});
test('manager request handle remains pending for entered unknown gate work',async()=>{
 const h=privateManager({deadlineMs:20,wrap:{sendGate:()=>{throw Error('entered unknown');}}});try{const p=h.manager.resumeInput(),handle=h.manager.captureManagerRequestSettlement(p);await p;await pause(25);assert.equal(handle.snapshot().actualSettled,false);h.manager.retireManager();assert.equal(h.manager.captureManagerSettlement().snapshot().actualSettled,false);}finally{await h.end();}
});
test('access retirement before any input open joins an empty manager',async()=>{
 const s=setup();try{const h=s.controller.retireAccess();await h.actualSettled;assert.equal(h.snapshot().pendingTransitions,0);assert.equal(s.h.calls.allocate??0,0);assert.equal(s.trace.length,0);}finally{await s.end();}
});
test('retirement while async readiness held waits it without running rollback',async()=>{
 const held=deferred();const s=setup({isReady:()=>held.promise});try{await s.h.ready('');await s.controller.beginLock();const p=s.controller.reopen(s.event);await inertTick();const h=s.controller.retireAccess();await p;assert.equal(h.snapshot().actualSettled,false);held.resolve(true);await h.actualSettled;assert.equal(s.trace.some(x=>x.name==='rollback'),false);}finally{held.resolve(false);await s.end();}
});
test('access observer never reads native hook own then getter',async()=>{
 const held=deferred();let reads=0;Object.defineProperty(held.promise,'then',{get(){reads++;throw Error('then');}});const s=setup({prepare:()=>held.promise});try{await s.h.ready('');const p=s.controller.beginLock();await inertTick();const h=s.controller.retireAccess();held.resolve();await p;await h.actualSettled;assert.equal(reads,0);}finally{held.resolve();await s.end();}
});
test('unsafe async-void fulfilled value is refused without reading its then accessor',async()=>{
 const held=deferred();let reads=0;const s=setup({prepare:()=>held.promise});try{await s.h.ready('');const p=s.controller.beginLock();await inertTick();const value={};held.resolve(value);Object.defineProperty(value,'then',{get(){reads++;throw Error('value then');}});assert.equal((await p).ok,false);const h=s.controller.retireAccess();await h.actualSettled;assert.equal(reads,0);assert.equal(s.trace.some(x=>x.name==='retire'),false);}finally{held.resolve();await s.end();}
});
test('hook own constructor getter retains unknown without invocation',async()=>{
 const held=deferred();let gets=0;Object.defineProperty(held.promise,'constructor',{get(){gets++;throw Error('constructor');}});const s=setup({prepare:()=>held.promise,deadlineMs:20});try{await s.h.ready('');await s.controller.beginLock();const h=s.controller.retireAccess();held.resolve();await inertTick();assert.equal(gets,0);assert.equal(h.snapshot().actualSettled,false);assert.equal(s.controller.stats().quarantinedWorkers,1);}finally{held.resolve();await s.end();}
});
test('hook thenable and Proxy are refused without executing their traps',async()=>{
 for(const proxy of [false,true]){let gets=0;const bad=proxy?new Proxy({}, {get(){gets++;},getPrototypeOf(){gets++;}}):Object.defineProperty({},'then',{get(){gets++;}}),s=setup({prepare:()=>bad,deadlineMs:20});try{await s.h.ready('');await s.controller.beginLock();const h=s.controller.retireAccess();await inertTick();assert.equal(gets,0);assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().unknown,true);}finally{await s.end();}}
});
test('retire during CLOSE lower timeout waits actual request and stops session only once',async()=>{
 const held=deferred();let enabled=false,genuine;const s=setup({deadlineMs:35,manager:{deadlineMs:20,wrap:{sendGate:({invoke})=>{const p=invoke();if(enabled){genuine=p;return held.promise;}return p;}}}});try{await s.h.ready('');enabled=true;await s.controller.beginLock();const handle=s.controller.retireAccess();await pause(25);assert.equal(handle.snapshot().actualSettled,false);held.resolve(await genuine);await handle.actualSettled;assert.equal(s.h.calls.stopSession,1);}finally{held.resolve();await s.end();}
});
test('completed retired access handle cannot retain manager or controller capabilities',async()=>{
 assert.equal(typeof global.gc,'function','runner must expose GC');
 async function make(){const s=setup();await s.h.ready('');const handle=s.controller.retireAccess();await handle.actualSettled;await s.end();return {handle,refs:[s.controller,s.h.manager,s.h.registry,s.cwd,s.catalogue,s.router].map(x=>new WeakRef(x))};}
 const r=await make();for(let i=0;i<60;i++){await inertTick();global.gc();await inertTick();if(r.refs.every(x=>!x.deref()))break;}assert(r.refs.every(x=>!x.deref()),'retained completed handle must contain no operational capabilities');assert.equal(r.handle.snapshot().actualSettled,true);
});
test('completed request handle cannot retain manager after global retirement',async()=>{
 assert.equal(typeof global.gc,'function','runner must expose GC');
 async function make(){const h=privateManager();const p=h.manager.resumeInput(),handle=h.manager.captureManagerRequestSettlement(p);await p;await handle.actualSettled;await h.manager.retireManager().actualSettled;await h.end();return {handle,ref:new WeakRef(h.manager)};}
 const r=await make();for(let i=0;i<60;i++){await inertTick();global.gc();await inertTick();if(!r.ref.deref())break;}assert.equal(r.ref.deref(),undefined);assert.equal(r.handle.snapshot().actualSettled,true);
});
test('callback changing Promise prototype constructor is refused without getter invocation',async()=>{
 const original=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');let reads=0;const held=deferred(),s=setup({prepare:()=>{Object.defineProperty(Promise.prototype,'constructor',{configurable:true,get(){reads++;return Promise;}});return held.promise;},deadlineMs:20});
 try{await s.h.ready('');const p=s.controller.beginLock();Object.defineProperty(Promise.prototype,'constructor',original);await p;held.resolve();await inertTick();assert.equal(reads,0);assert.equal(s.controller.stats().retainedWorkers,1);assert.equal(s.controller.retireAccess().snapshot().actualSettled,false);}finally{Object.defineProperty(Promise.prototype,'constructor',original);held.resolve();await s.end();}
});
test('explicit returned readiness Proxy Promise stays unknown with zero trap execution',async()=>{
 const held=deferred();let traps=0;const value=new Proxy(held.promise,{get(){traps++;},getPrototypeOf(){traps++;}}),s=setup({isReady:()=>value,deadlineMs:20});try{await s.h.ready('');await s.controller.beginLock();assert.equal((await s.controller.reopen(s.event)).ok,false);const h=s.controller.retireAccess();await pause(25);assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().unknown,true);assert.equal(traps,0);held.resolve(true);await inertTick();assert.equal(h.snapshot().actualSettled,false);}finally{held.resolve(false);await s.end();}
});
for(const inherited of [false,true])test('readiness '+(inherited?'inherited':'own')+' then accessor stays unknown without invocation',async()=>{
 let gets=0;const base=Object.defineProperty({},'then',{get(){gets++;throw Error('then');}}),value=inherited?Object.create(base):base,s=setup({isReady:()=>value,deadlineMs:20});try{await s.h.ready('');await s.controller.beginLock();await s.controller.reopen(s.event);const h=s.controller.retireAccess();await inertTick();assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().unknown,true);assert.equal(gets,0);}finally{await s.end();}
});
