import assert from 'node:assert/strict';
import test from 'node:test';
import {win32 as path} from 'node:path';
import {TerminalHostCandidateOwnership} from '../src/terminal/host-candidate-ownership.mjs';
import {inertConfig} from './fixtures/terminal-production-inert.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {privateManager,deferred,inertTick} from './fixtures/terminal-manager-global.mjs';
const module=await import('../src/terminal/shutdown-graph.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const request=()=>({code:77,deadlineMs:100,shutdownId:'graph_shutdown'});
export function setup(overrides={},configure=null){
 assert.equal(typeof module.createTerminalShutdownGraph,'function','Missing exact private graph factory');
 const native=fixture({noStart:true,hostOrdinals:[]}),h=privateManager();
 const config={projectId:'project1',registry:h.registry,native:native.native,
  ownership:{isCurrent:()=>true,onUnavailable:()=>{},onVerified:()=>{}},
  hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n},
  creator:{executable:'C:\\Runtime\\electron.exe',entry:'C:\\Runtime\\creator.mjs',directory:'C:\\Runtime'},
  cwd:{pickDirectory:()=>Promise.resolve({canceled:true,filePaths:[]}),protectedRoots:['C:\\Protected'],inspectDirectory:()=>Promise.reject(Error('unused'))},
  profiles:{grants:[h.grant],getSystemDirectory:()=>Promise.resolve('C:\\Windows\\System32'),inspectExecutable:()=>Promise.reject(Error('unused')),readEnvironment:()=>Promise.resolve({SYSTEMROOT:'C:\\Windows',PATH:'C:\\Windows\\System32'}),privateEnvironmentKeys:[]},
  access:{prepareWorkspace:()=>Promise.resolve(),retireViews:()=>Promise.resolve(),rollbackWorkspace:()=>Promise.resolve(),isReady:()=>true},
  policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true},deadlineMs:100,...overrides};
 configure?.(config,native,h);const graph=module.createTerminalShutdownGraph(config);return{graph,config,native,h};
}
test('graph constructs its own exact members and passive capture never starts host',async()=>{
 const s=setup();try{
  const handle=s.graph.captureSettlement();assert.equal(handle,s.graph.captureSettlement());
  assert.equal(s.native.calls.length,0);assert.equal(s.graph.start().ok,true);
  const members=s.graph.mainAuthorities();assert(members.manager);assert(members.access);assert(members.cwdAuthority);assert.equal(members.profileCatalogues.length,1);
  const p=s.graph.shutdown(request());assert.equal(p,handle.actualSettled);
  for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();
  assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,1);
  s.native.hostStop.resolve(s.native.finalHost());const result=await p;
  assert.equal(result.scope,'MAIN_PRIVATE_TERMINAL_GRAPH_JS');assert.equal(result.nativeExecutionAdmitted,false);
  assert.equal(result.hostNativeJoined,false);assert.equal(handle.snapshot().pendingObservers,0);
  assert.equal(s.graph.mainAuthorities(),null);assert.equal(s.graph.start().ok,false);
 }finally{await s.h.end();}
});

test('invalid request, getters, Proxy, extra arity and foreign handles never retire graph',async()=>{
 const s=setup();try{s.graph.start();let reads=0;
  const proxy=new Proxy({}, {ownKeys(){reads++;throw Error();}}),getter=Object.defineProperty(request(),'code',{enumerable:true,get(){reads++;throw Error();}});
  for(const r of [null,proxy,getter,{...request(),handle:s.graph.captureSettlement()},{...request(),code:0},{...request(),deadlineMs:0}])assert.equal(s.graph.shutdown(r),null);
  assert.equal(s.graph.shutdown(request(),undefined),null);assert.equal(reads,0);
  assert.equal(s.graph.mainAuthorities().manager.captureManagerSettlement().snapshot().retired,false);
  const p=s.graph.shutdown(request());for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
 }finally{await s.h.end();}
});

test('duplicate shutdown shares exact Promise before and after completion; conflicts refuse',async()=>{
 const s=setup();try{s.graph.start();const p=s.graph.shutdown(request());
  assert.equal(s.graph.shutdown({...request()}),p);assert.equal(s.graph.shutdown({...request(),code:98}),null);
  for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
  assert.equal(s.graph.shutdown({...request()}),p);assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,1);
 }finally{await s.h.end();}
});

test('held Cwd provider delays host cleanup beyond its requested public deadline',async()=>{
 const held=deferred(),s=setup();try{
  s.config.cwd.pickDirectory=()=>held.promise;
  // Configuration was already captured; mutating it cannot alter the graph.
  s.graph.start();const members=s.graph.mainAuthorities();
  assert.equal((await members.cwdAuthority.pick(s.h.grant).catch(e=>e)).code,'CANCELLED');
  const t=setup({cwd:{...s.config.cwd,pickDirectory:()=>held.promise}});try{
   t.graph.start();const pending=t.graph.mainAuthorities().cwdAuthority.pick(t.h.grant).catch(e=>e);
   const p=t.graph.shutdown({...request(),deadlineMs:1});await inertTick();await new Promise(r=>setTimeout(r,10));
   assert.equal(t.native.calls.filter(c=>c[0]==='hostStop').length,0);assert.equal(t.graph.captureSettlement().snapshot().actualSettled,false);
   held.resolve({canceled:true,filePaths:[]});await pending;
   for(let i=0;i<30&&!t.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();
   assert.equal(t.native.calls.filter(c=>c[0]==='hostStop').length,1);t.native.hostStop.resolve(t.native.finalHost());await p;
  }finally{held.resolve({canceled:true,filePaths:[]});await t.h.end();}
  const p=s.graph.shutdown(request());for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
 }finally{held.resolve({canceled:true,filePaths:[]});await s.h.end();}
});

test('unknown provider thenable is retained and never treated as completed',async()=>{
 let reads=0;const bad=Object.defineProperty({},'then',{get(){reads++;throw Error();}}),s=setup({cwd:{pickDirectory:()=>bad,protectedRoots:['C:\\Protected'],inspectDirectory:()=>Promise.reject(Error())}});
 try{s.graph.start();await s.graph.mainAuthorities().cwdAuthority.pick(s.h.grant).catch(()=>{});s.graph.shutdown(request());await inertTick();assert.equal(reads,0);assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,0);assert.equal(s.graph.captureSettlement().snapshot().actualSettled,false);assert.equal(s.graph.captureSettlement().snapshot().unknown,true);}finally{await s.h.end();}
});

test('shutdown reentered from startup guard reserves graph before returned host exists',async()=>{
 const s=setup();try{
  const original=s.native.native.start;let nested;
  // Factory already captured methods, so replacement is ignored.
  s.native.native.start=()=>{throw Error('replacement');};
  assert.equal(s.graph.start().ok,true);
  const p=s.graph.shutdown(request());for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
  const t=setup({ownership:{isCurrent:()=>{if(t?.graph&&!nested)nested=t.graph.shutdown(request());return true;},onUnavailable:()=>{},onVerified:()=>{}}});
  try{assert.equal(t.graph.start().ok,false);assert.equal(nested,t.graph.captureSettlement().actualSettled);for(let i=0;i<20&&!t.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();t.native.hostStop.resolve(t.native.finalHost());await nested;}finally{await t.h.end();}
  assert.equal(typeof original,'function');
 }finally{await s.h.end();}
});

test('held Access prepare observer prevents premature host operation',async()=>{
 const held=deferred(),s=setup({access:{prepareWorkspace:()=>held.promise,retireViews:()=>Promise.resolve(),rollbackWorkspace:()=>Promise.resolve(),isReady:()=>true}});
 try{s.graph.start();const a=s.graph.mainAuthorities().access,lock=a.beginLock();await inertTick();const p=s.graph.shutdown(request());await lock;await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,0);held.resolve();for(let i=0;i<30&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;}finally{held.resolve();await s.h.end();}
});

test('failed public host start with a known capability still cleans the exact owned host',async()=>{
 let calls=0;const s=setup({ownership:{isCurrent:()=>++calls<=2,onUnavailable:()=>{},onVerified:()=>{}}});
 try{assert.equal(s.graph.start().ok,false);const p=s.graph.shutdown(request());for(let i=0;i<20&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,1);s.native.hostStop.resolve(s.native.finalHost());await p;}finally{await s.h.end();}
});

function directory(value){const p=path.normalize(value),root=path.parse(p).root,parts=p.slice(root.length).split('\\').filter(Boolean),ancestors=[{path:root,identity:root,directory:true,reparse:false}];let parent=root;for(const part of parts){parent=path.join(parent,part);ancestors.push({path:parent,identity:parent,directory:true,reparse:false});}return {canonicalPath:p,identity:p,directory:true,reparse:false,ancestors};}
function executable(value){const p=path.normalize(value);return {canonicalPath:p,identity:p,file:true,reparse:false,ancestors:directory(path.dirname(p)).ancestors};}
test('manager retirement starts actual Session Stop while accepted lanes are still pending',async()=>{
 const s=setup({cwd:{pickDirectory:()=>Promise.resolve({canceled:false,filePaths:['C:\\Project']}),protectedRoots:['C:\\Protected'],inspectDirectory:p=>Promise.resolve(directory(p))}});
 try{
  // Capture a new graph with executable evidence before its providers are used.
  const config={...s.config,profiles:{...s.config.profiles,inspectExecutable:p=>Promise.resolve(executable(p))}};
  const graph=module.createTerminalShutdownGraph(config);assert.equal(graph.start().ok,true);
  const m=graph.mainAuthorities(),picked=await m.cwdAuthority.pick(s.h.grant);
  assert.equal((await m.manager.resumeInput()).ok,true);
  const creating=m.manager.create(s.h.grant,{operationId:'create_pending',epoch:s.h.grant.epoch,cwdId:picked.cwdId,profileId:'powershell',cols:80,rows:24});
  for(let i=0;i<100&&!s.native.calls.some(c=>c[0]==='accept');i++)await inertTick();assert(s.native.calls.some(c=>c[0]==='accept'));
  const p=graph.shutdown(request());
  for(let i=0;i<100&&!s.native.calls.some(c=>c[0]==='stop');i++)await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='stop').length,1);
  assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,0);
  s.native.nativeStop.resolve(s.native.final());s.native.closeAll();for(const lane of ['control','history','command'])s.native.accept(lane);
  await creating;
  for(let i=0;i<150&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,1);
  s.native.hostStop.resolve(s.native.finalHost());await p;assert.equal(m.manager.captureManagerSettlement().snapshot().actualSettled,true);
 }finally{await s.h.end();}
});

test('completed passive graph handle does not retain graph or components',async()=>{
 assert.equal(typeof global.gc,'function');let handle,weak;
 await (async()=>{const s=setup();try{s.graph.start();handle=s.graph.captureSettlement();weak=new WeakRef(s.graph);const p=s.graph.shutdown(request());for(let i=0;i<30&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;}finally{await s.h.end();}})();
 for(let i=0;i<30;i++){await inertTick();global.gc();await inertTick();if(!weak.deref())break;}
 assert.equal(weak.deref(),undefined);assert.equal(handle.snapshot().actualSettled,true);
});

test('startup provider cannot replace ownership methods subsequently captured by backend',async()=>{
 const proto=TerminalHostCandidateOwnership.prototype,original=Object.getOwnPropertyDescriptor(proto,'prepareSession');let hooks=0;
 const s=setup({},(config,native)=>{const start=native.native.start;native.native.start=function(...args){Object.defineProperty(proto,'prepareSession',{...original,value:()=>{hooks++;throw Error('replaced');}});return Reflect.apply(start,this,args);};});
 try{s.graph.start();const config=inertConfig(),m=s.graph.mainAuthorities(),prepared=m.backend.prepare({...config,sessionId:'captured_before_start',projectId:'project1',admissionEpoch:1},{isCurrent:()=>true});
  assert.equal(hooks,0);assert.equal(prepared.ok,true);
  const stopping=m.backend.stopSession({ownerId:prepared.ownerId,code:98,deadlineMs:100});s.native.closeAll();await stopping;
  const p=s.graph.shutdown(request());s.native.closeAll();for(let i=0;i<80&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
 }finally{Object.defineProperty(proto,'prepareSession',original);await s.h.end();}
});

test('factory rejects fake registry, caller components, hostile config and oversized catalogue roster',async()=>{
 const s=setup();try{let hooks=0;const proxy=new Proxy({}, {getPrototypeOf(){hooks++;throw Error();},ownKeys(){hooks++;throw Error();}}),getter=Object.defineProperty({...s.config},'native',{enumerable:true,get(){hooks++;throw Error();}});
  for(const config of [proxy,getter,{...s.config,registry:Object.create(WindowRegistry.prototype)},{...s.config,registry:proxy},{...s.config,manager:s.h.manager},{...s.config,profiles:{...s.config.profiles,grants:Array(9).fill(s.h.grant)}}])assert.throws(()=>module.createTerminalShutdownGraph(config),TypeError);
  assert.equal(hooks,0);assert.equal(s.native.calls.length,0);assert.equal(s.graph.shutdown(request()),null);assert.equal(s.graph.captureSettlement(undefined),null);
 }finally{await s.h.end();}
});

test('one graph cannot shut down or substitute authorities belonging to another graph',async()=>{
 const a=setup(),b=setup();try{a.graph.start();b.graph.start();const foreign=b.graph.mainAuthorities();
  assert.equal(a.graph.shutdown({...request(),manager:foreign.manager}),null);
  assert.equal(a.graph.shutdown({...request(),actualSettled:b.graph.captureSettlement().actualSettled}),null);
  const p=a.graph.shutdown(request());for(let i=0;i<30&&!a.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();
  assert.equal(b.native.calls.filter(c=>c[0]==='hostStop').length,0);assert.equal(foreign.manager.captureManagerSettlement().snapshot().retired,false);
  a.native.hostStop.resolve(a.native.finalHost());await p;
  const q=b.graph.shutdown(request());for(let i=0;i<30&&!b.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();b.native.hostStop.resolve(b.native.finalHost());await q;
 }finally{await a.h.end();await b.h.end();}
});

test('held bound profile provider must drain before host operation',async()=>{
 const held=deferred(),s=setup({},config=>{config.profiles={...config.profiles,getSystemDirectory:()=>held.promise};});
 try{s.graph.start();const catalogue=s.graph.mainAuthorities().profileCatalogues[0],pending=catalogue.listShellProfiles().catch(e=>e);const p=s.graph.shutdown(request());await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,0);held.resolve('C:\\Windows\\System32');await pending;for(let i=0;i<30&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;}finally{held.resolve('C:\\Windows\\System32');await s.h.end();}
});

test('held Access rollback blocks graph after public transition reply',async()=>{
 const held=deferred(),s=setup({access:{prepareWorkspace:()=>Promise.resolve(),retireViews:()=>Promise.resolve(),rollbackWorkspace:()=>held.promise,isReady:()=>true}});
 try{s.graph.start();const a=s.graph.mainAuthorities().access;assert.equal((await a.beginLock()).ok,true);const event={sender:s.h.window.webContents,senderFrame:s.h.window.webContents.mainFrame},opening=a.reopen(event);await inertTick();const p=s.graph.shutdown(request());assert.equal((await opening).ok,false);await inertTick();assert.equal(s.native.calls.filter(c=>c[0]==='hostStop').length,0);held.resolve();for(let i=0;i<40&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;}finally{held.resolve();await s.h.end();}
});

test('a mismatched final host receipt is unknown, never a whole graph PASS',async()=>{
 const s=setup();try{s.graph.start();s.graph.shutdown(request());for(let i=0;i<30&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();const bad=s.native.finalHost();bad.shutdownId='unrelated';s.native.hostStop.resolve(bad);await inertTick();await inertTick();assert.equal(s.graph.captureSettlement().snapshot().unknown,true);assert.equal(s.graph.captureSettlement().snapshot().actualSettled,false);}finally{await s.h.end();}
});

test('ordinary Lock preserves host and Session lifetime and later explicit shutdown works',async()=>{
 const s=setup();try{s.graph.start();const m=s.graph.mainAuthorities();assert.equal((await m.access.beginLock()).ok,true);assert.equal(s.native.calls.filter(c=>c[0]==='hostStop'||c[0]==='stop').length,0);assert.equal(m.ownership.captureOwnershipSettlement().snapshot().retired,false);assert.equal(m.manager.captureManagerSettlement().snapshot().retired,false);assert.equal(s.graph.captureSettlement().snapshot().requested,false);
  const p=s.graph.shutdown(request());for(let i=0;i<30&&!s.native.calls.some(c=>c[0]==='hostStop');i++)await inertTick();s.native.hostStop.resolve(s.native.finalHost());await p;
 }finally{await s.h.end();}
});
