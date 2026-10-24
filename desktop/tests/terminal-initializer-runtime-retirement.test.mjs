import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesktopTerminalCandidate} from '../src/terminal/candidate-initializer.mjs';
import * as graphModule from '../src/terminal/shutdown-graph.mjs';
const {createTerminalShutdownGraph,captureTerminalGraphShutdownRequest}=graphModule;
import {desktopFixture} from './helpers/terminal-desktop-lifecycle-fixture.mjs';
import {inertTick} from './fixtures/terminal-production-inert.mjs';
const clean=()=>({ok:true,cleanupVerified:true,nativeExecutionAdmitted:false});
function deferred(){let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};}
async function setup(retireRuntime,{stale=false}={}){
 const s=await desktopFixture(),handlers=new Map();let graph,creates=0;
 const hooks={isLockBusy:()=>false,isUnlockBusy:()=>false,enterTransition:()=>{},leaveTransition:()=>{},isUnlocked:()=>true,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},endAccountTransition:async()=>{},activateWorkspace:()=>s.registry.activateWorkspace(),commitLock:()=>{},verifyUnlock:async()=>({ok:true}),afterUnlock:async r=>r,runWhenReady:async f=>f(),captureUnlockScope:()=>({event:s.mainEvent,isCurrent:()=>true})};
 const runtime=createDesktopTerminalCandidate({createGraph:async o=>{creates++;graph=createTerminalShutdownGraph({...s.config,access:o.access});assert.equal(graph.start().ok,true);if(stale){await s.registry.invalidateEpochAsync({preserveWorkspace:true});s.registry.activateWorkspace();}return graph;},retireRuntime})({registry:s.registry,ipcMain:{handle:(c,f)=>handlers.set(c,f)},getProjectId:()=>s.state.project,isReady:()=>s.state.ready,workspaceEvent:()=>s.mainEvent,pinHooks:hooks,windowFor:()=>s.view,getAppearance:async()=>({theme:'dark'}),systemDark:()=>true,openWindow:async()=>({ok:true})});
 return {s,runtime,launch:()=>handlers.get('siren:terminal-launch')(s.mainEvent),get graph(){return graph;},get creates(){return creates;},async end(){try{await runtime.dispose();}catch{}await s.end();}};
}

test('shutdown requests graph first and waits for the separate owner cleanup before completion',async()=>{
 const owner=deferred();let calls=0,actualRequest;
 const f=await setup((graph,request)=>{calls++;actualRequest=captureTerminalGraphShutdownRequest(graph);assert.equal(request,actualRequest);assert.equal(Object.isFrozen(request),true);return owner.promise;});
 let operation;
 try{assert.equal((await f.launch()).ok,true);let done=false;operation=f.runtime.shutdown().then(()=>done=true);for(let i=0;i<20;i++)await inertTick();assert.equal(calls,1);assert.equal(actualRequest.code,77);assert.equal(actualRequest.deadlineMs,5000);assert.equal(done,false);owner.resolve(clean());await operation;assert.equal(done,true);await f.runtime.shutdown();assert.equal(calls,1);}finally{owner.resolve(clean());await operation;await f.end();}
});

test('owner cleanup unknown is retained and refuses replacement or a later clean shutdown claim',async()=>{
 let calls=0;const f=await setup(async()=>{calls++;return {ok:false,cleanupVerified:false,nativeExecutionAdmitted:false};});
 try{assert.equal((await f.launch()).ok,true);await assert.rejects(f.runtime.shutdown(),/HOST_SHUTDOWN_UNVERIFIED/);assert.equal(calls,1);assert.equal((await f.launch()).ok,false);assert.equal(f.creates,1);await assert.rejects(f.runtime.shutdown(),/HOST_SHUTDOWN_UNVERIFIED/);assert.equal(calls,1);}finally{await f.end();}
});

test('a throwing runtime retirement still leaves graph shutdown requested and prevents replacement',async()=>{
 let calls=0;const f=await setup((graph,request)=>{calls++;assert.equal(captureTerminalGraphShutdownRequest(graph),request);throw Error('OWNED_RETIREMENT_UNKNOWN');});
 try{assert.equal((await f.launch()).ok,true);await assert.rejects(f.runtime.shutdown(),/HOST_SHUTDOWN_UNVERIFIED/);assert.equal(calls,1);assert.ok(captureTerminalGraphShutdownRequest(f.graph));assert.equal((await f.launch()).ok,false);assert.equal(f.creates,1);}finally{await f.end();}
});

test('stale graph returned by startup also joins its owner before launch returns unavailable',async()=>{
 const owner=deferred();let calls=0;const f=await setup((graph,request)=>{calls++;assert.equal(captureTerminalGraphShutdownRequest(graph),request);return owner.promise;},{stale:true});let launch;
 try{let done=false;launch=f.launch().then(value=>{done=true;return value;});for(let i=0;i<30;i++)await inertTick();assert.equal(calls,1);assert.equal(done,false);owner.resolve(clean());assert.equal((await launch).ok,false);}finally{owner.resolve(clean());await launch;await f.end();}
});

test('runtime callback requires a callable private adapter when supplied',()=>{
 assert.throws(()=>createDesktopTerminalCandidate({createGraph:async()=>null,retireRuntime:{}}),TypeError);
});

test('overlapping shutdown and dispose both wait for the retained owner join',async()=>{
 const owner=deferred();let calls=0;const f=await setup(()=>{calls++;return owner.promise;});let first,second,third;
 try{assert.equal((await f.launch()).ok,true);let done1=false,done2=false,done3=false;first=f.runtime.shutdown().then(()=>done1=true);second=f.runtime.shutdown().then(()=>done2=true);third=f.runtime.dispose().then(()=>done3=true);for(let i=0;i<20;i++)await inertTick();assert.equal(done1,false);assert.equal(done2,false);assert.equal(done3,false);assert.equal(calls,1);owner.resolve(clean());await Promise.all([first,second,third]);assert.equal(done1&&done2&&done3,true);}finally{owner.resolve(clean());await Promise.allSettled([first,second,third]);await f.end();}
});


for(const reenter of [false,true])test('held startup disposal joins the returned graph and owner '+(reenter?'with synchronous factory reentry':'from an external caller'),async()=>{
 const s=await desktopFixture(),handlers=new Map(),returned=deferred(),owner=deferred();
 let graph,creates=0,retireCalls=0,started=false,launch,disposal,disposed=false,runtime;
 const hooks={isLockBusy:()=>false,isUnlockBusy:()=>false,enterTransition:()=>{},leaveTransition:()=>{},isUnlocked:()=>true,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},endAccountTransition:async()=>{},activateWorkspace:()=>s.registry.activateWorkspace(),commitLock:()=>{},verifyUnlock:async()=>({ok:true}),afterUnlock:async r=>r,runWhenReady:async f=>f(),captureUnlockScope:()=>({event:s.mainEvent,isCurrent:()=>true})};
 runtime=createDesktopTerminalCandidate({createGraph:async o=>{
   creates++;graph=createTerminalShutdownGraph({...s.config,access:o.access});assert.equal(graph.start().ok,true);started=true;
   if(reenter)disposal=runtime.dispose().then(()=>{disposed=true;});
   return returned.promise;
  },retireRuntime:(actual,request)=>{retireCalls++;assert.equal(actual,graph);assert.equal(captureTerminalGraphShutdownRequest(actual),request);return owner.promise;}
 })({registry:s.registry,ipcMain:{handle:(c,f)=>handlers.set(c,f)},getProjectId:()=>s.state.project,isReady:()=>s.state.ready,workspaceEvent:()=>s.mainEvent,pinHooks:hooks,windowFor:()=>s.view,getAppearance:async()=>({theme:'dark'}),systemDark:()=>true,openWindow:async()=>({ok:true})});
 try{
  launch=handlers.get('siren:terminal-launch')(s.mainEvent);
  for(let i=0;i<30&&!started;i++)await inertTick();assert.equal(started,true);assert.equal(creates,1);
  if(!reenter)disposal=runtime.dispose().then(()=>{disposed=true;});
  for(let i=0;i<20;i++)await inertTick();assert.equal(disposed,false,'dispose cannot finish while startup still owns the unpublished graph');assert.equal(retireCalls,0);
  returned.resolve(graph);for(let i=0;i<30&&!retireCalls;i++)await inertTick();assert.equal(retireCalls,1);
  assert.equal(disposed,false,'dispose must also join actual owner retirement after the stale graph returns');
  owner.resolve(clean());await disposal;assert.equal(disposed,true);assert.equal((await launch).ok,false);assert.equal(retireCalls,1);
 }finally{
  returned.resolve(graph);owner.resolve(clean());await Promise.allSettled([launch,disposal]);try{await runtime.dispose();}catch{}await s.end();
 }
});


for(const operation of ['shutdown','prepareTransition'])test('held startup '+operation+' fences publication and joins graph plus owner',async()=>{
 const s=await desktopFixture(),handlers=new Map(),returned=deferred(),owner=deferred();
 let graph,started=false,retireCalls=0,opened=0,launch,transition,completed=false,runtime;
 const hooks={isLockBusy:()=>false,isUnlockBusy:()=>false,enterTransition:()=>{},leaveTransition:()=>{},isUnlocked:()=>true,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},endAccountTransition:async()=>{},activateWorkspace:()=>s.registry.activateWorkspace(),commitLock:()=>{},verifyUnlock:async()=>({ok:true}),afterUnlock:async r=>r,runWhenReady:async f=>f(),captureUnlockScope:()=>({event:s.mainEvent,isCurrent:()=>true})};
 runtime=createDesktopTerminalCandidate({createGraph:async o=>{graph=createTerminalShutdownGraph({...s.config,access:o.access});assert.equal(graph.start().ok,true);started=true;return returned.promise;},retireRuntime:(actual,request)=>{retireCalls++;assert.equal(actual,graph);assert.equal(captureTerminalGraphShutdownRequest(actual),request);return owner.promise;}})({registry:s.registry,ipcMain:{handle:(c,f)=>handlers.set(c,f)},getProjectId:()=>s.state.project,isReady:()=>s.state.ready,workspaceEvent:()=>s.mainEvent,pinHooks:hooks,windowFor:()=>s.view,getAppearance:async()=>({theme:'dark'}),systemDark:()=>true,openWindow:async()=>{opened++;return {ok:true};}});
 try{
  launch=handlers.get('siren:terminal-launch')(s.mainEvent);for(let i=0;i<30&&!started;i++)await inertTick();assert.equal(started,true);
  transition=runtime[operation]().then(()=>{completed=true;});for(let i=0;i<20;i++)await inertTick();
  assert.equal(completed,false,'public lifecycle operation must not finish while the unpublished graph is held');
  returned.resolve(graph);for(let i=0;i<30&&!retireCalls;i++)await inertTick();assert.equal(retireCalls,1);assert.equal(completed,false);
  owner.resolve(clean());await transition;assert.equal(completed,true);assert.equal((await launch).ok,false);assert.equal(opened,0);assert.equal(retireCalls,1);
 }finally{returned.resolve(graph);owner.resolve(clean());await Promise.allSettled([launch,transition]);try{await runtime.dispose();}catch{}await s.end();}
});


for(const operation of ['shutdown','dispose'])test('cancelled replacement never dispatches a factory after held old retirement '+operation,async()=>{
 const s=await desktopFixture(),handlers=new Map(),oldOwner=deferred();
 let firstGraph,factories=0,retireCalls=0,replacement,cancel,complete=false,runtime;
 const hooks={isLockBusy:()=>false,isUnlockBusy:()=>false,enterTransition:()=>{},leaveTransition:()=>{},isUnlocked:()=>true,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},endAccountTransition:async()=>{},activateWorkspace:()=>s.registry.activateWorkspace(),commitLock:()=>{},verifyUnlock:async()=>({ok:true}),afterUnlock:async r=>r,runWhenReady:async f=>f(),captureUnlockScope:()=>({event:s.mainEvent,isCurrent:()=>true})};
 runtime=createDesktopTerminalCandidate({createGraph:async o=>{
   factories++;if(factories!==1)return null;
   firstGraph=createTerminalShutdownGraph({...s.config,access:o.access});assert.equal(firstGraph.start().ok,true);return firstGraph;
  },retireRuntime:(actual,request)=>{retireCalls++;assert.equal(actual,firstGraph);assert.equal(captureTerminalGraphShutdownRequest(actual),request);return oldOwner.promise;}
 })({registry:s.registry,ipcMain:{handle:(c,f)=>handlers.set(c,f)},getProjectId:()=>s.state.project,isReady:()=>s.state.ready,workspaceEvent:()=>s.mainEvent,pinHooks:hooks,windowFor:()=>s.view,getAppearance:async()=>({theme:'dark'}),systemDark:()=>true,openWindow:async()=>({ok:true})});
 const launch=()=>handlers.get('siren:terminal-launch')(s.mainEvent);
 try{
  assert.equal((await launch()).ok,true);assert.equal(factories,1);
  s.state.project='project2';await s.registry.invalidateEpochAsync({preserveWorkspace:true});s.registry.activateWorkspace();
  assert.equal(s.registry.capture(s.mainEvent).projectId,'project2');
  replacement=launch();for(let i=0;i<30&&!retireCalls;i++)await inertTick();assert.equal(retireCalls,1);assert.equal(factories,1);
  cancel=runtime[operation]().then(()=>{complete=true;});for(let i=0;i<20;i++)await inertTick();assert.equal(complete,false);
  oldOwner.resolve(clean());await cancel;assert.equal((await replacement).ok,false);
  assert.equal(factories-1,0,'cancelled replacement must not dispatch its new private factory after old retirement');assert.equal(retireCalls,1);
 }finally{oldOwner.resolve(clean());await Promise.allSettled([replacement,cancel]);try{await runtime.dispose();}catch{}await s.end();}
});
