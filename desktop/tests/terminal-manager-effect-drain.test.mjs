// Profile-result observation only; synthetic private admission, no allocation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionManager} from '../src/terminal/production-manager.mjs';
import {inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';
function harness(profile){
 const config=inertConfig(),grant={projectId:'project1',windowId:'window1',epoch:1,role:'workspace'},calls={prepare:0};
 const backend={prepare(){calls.prepare++;throw Error('No owner may be allocated in malformed-profile controls');},allocate(){throw Error('No allocation');},connect(){throw Error('No connection');},stopSession(){throw Error('No owner');},sendGate:p=>Object.freeze({ok:true,...p}),isAvailable:()=>true,subscribeUnavailable:()=>{}};
 const manager=new TerminalProductionManager({registry:{isCurrent:()=>true,captureAdmissionGuard:()=>({isCurrent:()=>true})},policy:{authorize:()=>({ok:true})},backend,accessReady:()=>true,cwdAuthority:{resolve:()=>Promise.resolve(config.cwd)},profilesFor:()=>({resolveShellProfile:profile}),deadlineMs:20});
 return{manager,calls,async open(){assert.equal((await manager.resumeInput()).ok,true);},create:()=>manager.create(grant,{operationId:'profile-observation',epoch:1,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40}),close:()=>manager.closeInput('fixture cleanup')};
}
for(const kind of ['own accessor','own callable','inherited accessor','inherited callable','proxy prototype'])test('settled profile '+kind+' is refused without reentering then or retaining completed work',async()=>{
 let getters=0,thenCalls=0;const value={...inertConfig().shell},raw=Promise.resolve(value);
 const descriptor=kind.includes('accessor')?{get(){getters++;throw Error('Manager must not invoke value.then');}}:{value(){thenCalls++;}};
 if(kind.startsWith('own'))Object.defineProperty(value,'then',descriptor);
 else if(kind.startsWith('inherited'))Object.setPrototypeOf(value,Object.defineProperty({},'then',descriptor));
 else Object.setPrototypeOf(value,new Proxy({}, {get(){getters++;return ()=>{thenCalls++;};},getOwnPropertyDescriptor(){getters++;throw Error('Proxy prototype');},getPrototypeOf(){getters++;throw Error('Proxy prototype');}}));
 const h=harness(()=>raw);try{await h.open();assert.equal((await h.create()).ok,false);await inertTick();assert.equal(getters,0);assert.equal(thenCalls,0);assert.equal(h.calls.prepare,0);assert.equal(h.manager.stats().pendingOperations,0,'known settled malformed value is negative, not unknown entered work');assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().quarantinedOperations,0);}
 finally{await h.close();}
});
test('known malformed DATA profile remains a settled negative without allocation',async()=>{
 const h=harness(()=>Promise.resolve({wrong:'profile'}));try{await h.open();assert.equal((await h.create()).code,'REQUEST_REFUSED');await inertTick();assert.equal(h.calls.prepare,0);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().pendingOperations,0);}
 finally{await h.close();}
});
test('eight timed-out workers reclaim only after original settlement and never enter late then code',async()=>{
 let release,thenCalls=0;const raw=new Promise(resolve=>release=resolve),h=harness(()=>raw),value={...inertConfig().shell};
 try{await h.open();assert((await Promise.all(Array.from({length:8},()=>h.create()))).every(r=>r.ok===false));assert.equal(h.manager.stats().reservedSessions,8);assert.equal(h.manager.stats().pendingOperations,8);assert.equal((await h.create()).code,'CAPACITY_EXCEEDED');
  release(value);Object.defineProperty(value,'then',{value(){thenCalls++;}});for(let i=0;i<30&&h.manager.stats().reservedSessions;i++)await inertTick();assert.equal(thenCalls,0);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().pendingOperations,0);assert.equal(h.manager.stats().quarantinedOperations,0);assert.equal(h.calls.prepare,0);
 }finally{release(value);await h.close();}
});
test('observed late rejection is settled-negative while entered thrown callback stays unknown',async()=>{
 let reject;const raw=new Promise((_,no)=>reject=no),h=harness(()=>raw);try{await h.open();await h.create();assert.equal(h.manager.stats().reservedSessions,1);reject(null);for(let i=0;i<30&&h.manager.stats().reservedSessions;i++)await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().pendingOperations,0);}
 finally{reject(null);await h.close();}
 const unknown=harness(()=>{throw null;});try{await unknown.open();assert((await Promise.all(Array.from({length:8},()=>unknown.create()))).every(r=>r.ok===false));assert.equal(unknown.manager.stats().reservedSessions,8);assert.equal(unknown.manager.stats().quarantinedOperations,8);assert.equal((await unknown.create()).code,'CAPACITY_EXCEEDED');await unknown.close();assert.equal(unknown.manager.stats().reservedSessions,8);}
 finally{await unknown.close();}
});
test('own original Promise then accessor remains untouched during settled-negative observation',async()=>{
 let getters=0;const raw=Promise.resolve({wrong:'profile'});Object.defineProperty(raw,'then',{get(){getters++;throw Error('Own Promise then');}});const h=harness(()=>raw);
 try{await h.open();assert.equal((await h.create()).code,'REQUEST_REFUSED');assert.equal(getters,0);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().pendingOperations,0);}
 finally{await h.close();}
});
