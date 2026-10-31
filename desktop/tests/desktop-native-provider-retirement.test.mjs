// Inert provider-lifetime controls. Real owner/registry/graph, stand-in native
// capabilities and inert resource files only; no addon, Electron or PTY load.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createHook} from 'node:async_hooks';
import {createDesktopNativeRuntimeOwner} from '../src/terminal/desktop-native-runtime.mjs';
import {captureDesktopNativeRuntimeResources,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
import * as graphModule from '../src/terminal/shutdown-graph.mjs';
const {captureTerminalGraphShutdownRequest}=graphModule;
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {privateManager,deferred,inertTick} from './fixtures/terminal-manager-global.mjs';

const fixtures=fileURLToPath(new URL('../../../provider-retirement-controls/fixtures/',import.meta.url));
const providerClean=()=>Object.freeze({retired:true,actualSettled:true,pending:0,nativeExecutionAdmitted:false});
const hostClean=()=>({utilityExited:true,nativeCleanupVerified:true});
async function until(predicate){for(let i=0;i<200&&!predicate();i++)await inertTick();assert(predicate(),'finite inert settlement');}
async function setup({legacy=false,change=()=>{}}={}){
 const directory=join(fixtures,'case-'+randomUUID()),pins={};
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...path.split('/'));await mkdir(dirname(target),{recursive:true});const bytes=Buffer.from('INERT provider-retirement '+path);await writeFile(target,bytes,{flag:'wx'});pins[path]=createHash('sha256').update(bytes).digest('hex');}
 const resources=await captureDesktopNativeRuntimeResources({directory,pins}),h=privateManager(),n=fixture({noStart:true,hostOrdinals:[]});
 const providerCalled=deferred(),providerRetired=deferred(),providerRetireCalled=deferred(),reserved=deferred(),ready=deferred(),hostRetired=deferred(),trace=[],requests=[];
 const providers={cwd:{pickDirectory:async()=>({canceled:true,filePaths:[]}),protectedRoots:[],inspectDirectory:async()=>{throw Error('unused');}},profiles:{getSystemDirectory:async()=> 'C:\\Windows\\System32',inspectExecutable:async()=>{throw Error('unused');},readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows'}),privateEnvironmentKeys:[],modulePathPolicy:'system-seeded',inspectModuleDirectory:async()=>{throw Error('unused');}},policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true}};
 const adapter={captureResources:async()=>{trace.push('capture');return resources;},verifyResourceClosure:async()=>true,providers:async()=>{trace.push('providers');providerCalled.resolve();return providers;},isCurrent:()=>true,reserveHost:()=>{trace.push('reserve');reserved.resolve();return {ready:ready.promise,retire(...args){trace.push('host-retire');requests.push(args);return hostRetired.promise;}};}};
 if(!legacy)adapter.retireProviders=(...args)=>{assert.equal(args.length,0);trace.push('provider-retire');providerRetireCalled.resolve();return providerRetired.promise;};
 const request={registry:h.registry,projectId:'project1',workspaceEvent:h.registry.eventFor(h.grant),access:{prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},isReady:()=>true}};
 const s={adapter,resources,h,n,trace,requests,request,providers,providerCalled,providerRetired,providerRetireCalled,reserved,ready,hostRetired};
 change(s);s.owner=createDesktopNativeRuntimeOwner({adapter});
 s.begin=async()=>{const start=s.owner.createGraph(request);await reserved.promise;ready.resolve({native:n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});return start;};
 return s;
}

test('BEHAVIOR RED: legacy five-field provider allocation cannot be falsely verified clean before host reservation',async()=>{
 let allocated=false;const s=await setup({legacy:true,change:x=>{x.adapter.providers=async()=>{allocated=true;x.trace.push('allocated-provider');return {};};}});
 try{const outcome=await s.owner.createGraph(s.request).then(()=>null,e=>e),disposed=await s.owner.dispose();assert(allocated);assert(!s.trace.includes('reserve'));assert.equal(s.n.calls.length,0);
  assert.equal(disposed.cleanupVerified,false,'allocated provider without a retirement capability must remain UNKNOWN, not cleanupVerified:true');
  assert.equal(s.owner.snapshot().cleanupVerified,false);assert.equal(outcome?.message,'DESKTOP_NATIVE_CLEANUP_UNKNOWN');
 }finally{await s.h.end();}
});

test('new six-field provider cleanup holds startup failure and disposal before host reservation',async()=>{
 const s=await setup({change:x=>{x.adapter.providers=async()=>{x.trace.push('allocated-provider');return {};};}});
 try{let startDone=false,disposeDone=false;const start=s.owner.createGraph(s.request).then(()=>null,e=>{startDone=true;return e;});await s.providerRetireCalled.promise;const disposal=s.owner.dispose().then(r=>{disposeDone=true;return r;});await inertTick();assert.equal(startDone,false);assert.equal(disposeDone,false);assert(!s.trace.includes('reserve'));assert.equal(s.owner.snapshot().cleanupVerified,false);
  s.providerRetired.resolve(providerClean());assert.equal((await start).message,'DESKTOP_NATIVE_START_REFUSED');assert.equal((await disposal).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);assert.equal(s.n.calls.length,0);
 }finally{await s.h.end();}
});

test('provider call still pending prevents cleanup publication even after retirement receipt settles',async()=>{
 const held=deferred(),s=await setup({change:x=>{x.adapter.providers=()=>{x.trace.push('providers');x.providerCalled.resolve();return held.promise;};}});
 try{let done=false;const start=s.owner.createGraph(s.request).catch(e=>e);await s.providerCalled.promise;const disposal=s.owner.dispose().then(r=>{done=true;return r;});await s.providerRetireCalled.promise;s.providerRetired.resolve(providerClean());await inertTick();assert.equal(done,false);assert.equal(s.owner.snapshot().cleanupVerified,false);assert.equal(s.owner.snapshot().pending,true);
  held.resolve({});assert.equal((await start).message,'DESKTOP_NATIVE_START_REFUSED');assert.equal((await disposal).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);assert(!s.trace.includes('reserve'));
 }finally{await s.h.end();}
});

for(const kind of ['throw','reject','invalid-receipt','unsupported-thenable','own-disposal-promise'])test('provider retirement '+kind+' remains UNKNOWN without host cleanup promotion',async()=>{
 let thenReads=0;const s=await setup({change:x=>{x.adapter.providers=async()=>({});x.adapter.retireProviders=()=>{x.trace.push('provider-retire');if(kind==='throw')throw Error('private');if(kind==='reject')return Promise.reject(Error('private'));if(kind==='invalid-receipt')return Promise.resolve({...providerClean(),pending:1});if(kind==='own-disposal-promise')return x.owner.dispose();return Object.defineProperty({},'then',{get(){thenReads++;throw Error('must not read');}});};}});
 try{const start=await s.owner.createGraph(s.request).catch(e=>e);assert.equal(start.message,'DESKTOP_NATIVE_CLEANUP_UNKNOWN');assert.equal((await s.owner.dispose()).cleanupVerified,false);assert.equal(s.owner.snapshot().state,'blocked');assert.equal(thenReads,0);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);assert.equal(s.n.calls.length,0);
 }finally{await s.h.end();}
});

test('provider retirement receipt accessors are not evaluated',async()=>{
 let reads=0;const s=await setup({change:x=>{x.adapter.providers=async()=>({});x.adapter.retireProviders=()=>Promise.resolve(Object.defineProperty({...providerClean()},'retired',{enumerable:true,get(){reads++;return true;}}));}});
 try{await assert.rejects(s.owner.createGraph(s.request),/CLEANUP_UNKNOWN/);assert.equal((await s.owner.dispose()).cleanupVerified,false);assert.equal(reads,0);}finally{await s.h.end();}
});

test('idle disposal requests providers retirement once, waits it, and fences all future startup',async()=>{
 const s=await setup();try{let done=false;const disposal=s.owner.dispose().then(r=>{done=true;return r;});await s.providerRetireCalled.promise;await inertTick();assert.equal(done,false);assert(!s.trace.includes('capture'));await assert.rejects(s.owner.createGraph(s.request),/UNAVAILABLE/);s.providerRetired.resolve(providerClean());assert.equal((await disposal).cleanupVerified,true);assert.equal((await s.owner.dispose()).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);}finally{await s.h.end();}
});

test('legacy idle owner without entered providers retains harmless disposal compatibility',async()=>{
 const s=await setup({legacy:true});try{assert.equal((await s.owner.dispose()).cleanupVerified,true);assert.equal(s.trace.length,0);}finally{await s.h.end();}
});

test('provider retire callback reentry shares one disposal and cannot restart providers',async()=>{
 let nested,otherStart;const s=await setup({change:x=>{x.adapter.providers=async()=>({});x.adapter.retireProviders=()=>{x.trace.push('provider-retire');nested=x.owner.dispose();otherStart=x.owner.createGraph(x.request).catch(e=>e);x.providerRetireCalled.resolve();return x.providerRetired.promise;};}});
 try{const start=s.owner.createGraph(s.request).catch(e=>e);await s.providerRetireCalled.promise;const disposal=s.owner.dispose();assert.equal(disposal,nested);assert.equal((await otherStart).message,'DESKTOP_NATIVE_RUNTIME_UNAVAILABLE');s.providerRetired.resolve(providerClean());assert.equal((await start).message,'DESKTOP_NATIVE_START_REFUSED');assert.equal((await disposal).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);}finally{await s.h.end();}
});

test('dispose reentered inside provider allocation retains its later actual settlement',async()=>{
 const held=deferred();let disposal;const s=await setup({change:x=>{x.adapter.providers=()=>{x.trace.push('providers');disposal=x.owner.dispose();x.providerCalled.resolve();return held.promise;};}});
 try{const start=s.owner.createGraph(s.request).catch(e=>e);await s.providerCalled.promise;await s.providerRetireCalled.promise;s.providerRetired.resolve(providerClean());let done=false;disposal.then(()=>{done=true;});await inertTick();assert.equal(done,false);held.resolve({});assert.equal((await start).message,'DESKTOP_NATIVE_START_REFUSED');assert.equal((await disposal).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);assert(!s.trace.includes('reserve'));}finally{await s.h.end();}
});

test('Promise-init disposal reentry cannot duplicate provider retirement',async()=>{
 const s=await setup();let hook,nested;try{let once=false;hook=createHook({init(_id,type){if(type==='PROMISE'&&!once){once=true;nested=s.owner.dispose();}}});let disposal;hook.enable();try{disposal=s.owner.dispose();}finally{hook.disable();}await s.providerRetireCalled.promise;s.providerRetired.resolve(providerClean());assert.equal((await disposal).cleanupVerified,true);await nested;assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);}finally{hook?.disable();await s.h.end();}
});

test('active graph keeps exact shared shutdown request and waits provider, JS and host joins',async()=>{
 const s=await setup();try{const graph=await s.begin(),input={code:98,deadlineMs:100,shutdownId:'provider_shared_shutdown'},external=graph.shutdown(input);let done=false;const disposal=s.owner.dispose().then(r=>{done=true;return r;});await s.providerRetireCalled.promise;await until(()=>s.trace.includes('host-retire')&&s.n.calls.some(r=>r[0]==='hostStop'));
  assert.equal(s.requests.length,1);assert.equal(s.requests[0].length,1);const actual=captureTerminalGraphShutdownRequest(graph);assert.equal(s.requests[0][0],actual);assert.notEqual(actual,input);assert.deepEqual({...actual},input);s.n.hostStop.resolve(s.n.finalHost());s.hostRetired.resolve(hostClean());await external;await inertTick();assert.equal(done,false);assert.equal(s.owner.snapshot().cleanupVerified,false);
  s.providerRetired.resolve(providerClean());assert.equal((await disposal).cleanupVerified,true);assert.equal(s.trace.filter(x=>x==='provider-retire').length,1);assert.equal(s.n.calls.filter(x=>x[0]==='hostStop').length,1);
 }finally{await s.h.end();}
});

test('provider cleanup success cannot promote unknown native cleanup',async()=>{
 const s=await setup();try{const start=s.owner.createGraph(s.request).catch(e=>e);await s.reserved.promise;const disposal=s.owner.dispose();s.ready.resolve({native:s.n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});await s.providerRetireCalled.promise;s.providerRetired.resolve(providerClean());s.hostRetired.resolve({utilityExited:true,nativeCleanupVerified:false});assert.equal((await start).message,'DESKTOP_NATIVE_CLEANUP_UNKNOWN');assert.equal((await disposal).cleanupVerified,false);}finally{await s.h.end();}
});
