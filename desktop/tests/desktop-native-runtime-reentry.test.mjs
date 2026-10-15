// Maintained regression from independently captured db4a9991 adverse controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createHook} from 'node:async_hooks';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {privateManager,deferred,inertTick} from './fixtures/terminal-manager-global.mjs';
import {captureTerminalGraphAuthorities} from '../src/terminal/shutdown-graph.mjs';
import {captureDesktopNativeRuntimeResources,recheckDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
const module=await import('../src/terminal/desktop-native-runtime.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
let sequence=0;
async function resources(){
 const directory=resolve('terminal-desktop-runtime-reentry-fix-20261012/fixtures',String(Date.now())+'_'+ ++sequence),pins={};await mkdir(directory,{recursive:true});
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...path.split('/'));await mkdir(dirname(target),{recursive:true});const bytes=Buffer.from(path.endsWith('package.json')?JSON.stringify({name:'node-pty',version:'1.1.0',main:'./lib/index.js'}):'INERT DATA '+path);await writeFile(target,bytes);pins[path]=createHash('sha256').update(bytes).digest('hex');}
 return {directory,pins,receipt:await captureDesktopNativeRuntimeResources({directory,pins})};
}
async function setup(change=()=>{}){
 const r=await resources(),h=privateManager(),n=fixture({noStart:true,hostOrdinals:[]}),trace=[];
 const providers={cwd:{pickDirectory:async()=>({canceled:true,filePaths:[]}),protectedRoots:[],inspectDirectory:async()=>{throw Error('unused');}},profiles:{getSystemDirectory:async()=> 'C:\\Windows\\System32',inspectExecutable:async()=>{throw Error('unused');},readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows'}),privateEnvironmentKeys:[],modulePathPolicy:'system-seeded',inspectModuleDirectory:async()=>{throw Error('unused');}},policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true}};
 const ready=deferred(),retired=deferred(),reserved=deferred();let current=true;
 const adapter={captureResources:async()=>{trace.push('capture');return r.receipt;},verifyResourceClosure:async receipt=>{assert.equal(receipt,r.receipt);trace.push('closure');return true;},providers:async()=>{trace.push('providers');return providers;},isCurrent:()=>current,reserveHost:()=>{trace.push('reserve');reserved.resolve();return {ready:ready.promise,retire(){trace.push('retire');return retired.promise;}};}};
 const request={registry:h.registry,projectId:'project1',workspaceEvent:h.registry.eventFor(h.grant),access:{prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},isReady:()=>current}};
 const s={r,h,n,ready,retired,reserved,adapter,providers,request,trace,setCurrent:v=>{current=v;},async end(){await h.end();}};change(s);s.owner=module.createDesktopNativeRuntimeOwner({adapter});return s;
}
const hostReady=s=>s.ready.resolve({native:s.n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});
async function until(f){for(let i=0;i<100&&!f();i++)await inertTick();assert(f(),'finite test settlement');}



const cleanup={utilityExited:true,nativeCleanupVerified:true};
test('createGraph reserves the first attempt before its done-Promise init can start another capture',async()=>{
 const held=deferred(),s=await setup(x=>x.adapter.captureResources=()=>{x.trace.push('capture');return held.promise;});
 let count=0,nested;const hook=createHook({init(_id,type){if(type==='PROMISE'&&++count===2){nested=s.owner.createGraph(s.request);nested.catch(()=>{});}}});
 let first;try{
  hook.enable();try{first=s.owner.createGraph(s.request);first.catch(()=>{});}finally{hook.disable();}
  assert.equal(s.trace.filter(v=>v==='capture').length,1,'first invocation owns the only resource capture');
 }finally{hook.disable();const disposal=s.owner.dispose();held.resolve(s.r.receipt);hostReady(s);s.retired.resolve(cleanup);await Promise.allSettled([first,nested,disposal]);await s.end();}
});
test('dispose fences an idle owner before its return-Promise init can start resource capture',async()=>{
 const held=deferred(),s=await setup(x=>x.adapter.captureResources=()=>{x.trace.push('capture');return held.promise;});
 let once=false,nested;const hook=createHook({init(_id,type){if(type==='PROMISE'&&!once){once=true;nested=s.owner.createGraph(s.request);nested.catch(()=>{});}}});
 let disposal;try{
  hook.enable();try{disposal=s.owner.dispose();}finally{hook.disable();}
  assert.equal(s.trace.filter(v=>v==='capture').length,0,'a begun disposal cannot authorize resource work');
 }finally{hook.disable();held.resolve(s.r.receipt);hostReady(s);s.retired.resolve(cleanup);await Promise.allSettled([nested,disposal]);await s.end();}
});
test('retirement work is published before Promise.resolve init can request duplicate host retirement',async()=>{
 const s=await setup();const start=s.owner.createGraph(s.request);start.catch(()=>{});await s.reserved.promise;
 let count=0,nested;const hook=createHook({init(_id,type){if(type==='PROMISE'&&++count===3){nested=s.owner.dispose();nested.catch(()=>{});}}});
 let disposal;try{
  hook.enable();try{disposal=s.owner.dispose();}finally{hook.disable();}
  await inertTick();assert.equal(s.trace.filter(v=>v==='retire').length,1,'exactly one trusted native/utility retirement request');
 }finally{hook.disable();hostReady(s);s.retired.resolve(cleanup);await Promise.allSettled([start,nested,disposal]);await s.end();}
});
test('disposal from first startup Promise init sees reserved lifetime and prevents resource capture',async()=>{
 const s=await setup();let once=false,disposal;
 const hook=createHook({init(_id,type){if(type==='PROMISE'&&!once){once=true;disposal=s.owner.dispose();}}});
 let start;try{
  hook.enable();try{start=s.owner.createGraph(s.request);start.catch(()=>{});}finally{hook.disable();}
  await assert.rejects(start,/START_REFUSED/);assert.equal((await disposal).cleanupVerified,true);
  assert.deepEqual(s.trace,[]);assert.equal(s.n.calls.length,0);assert.equal(s.owner.snapshot().pending,false);
 }finally{hook.disable();await s.end();}
});
test('idle disposal returns one stable promise and invalid argument rejection never unsets its fence',async()=>{
 const s=await setup();try{
  await assert.rejects(s.owner.dispose('invalid'),/REQUEST_REFUSED/);assert.equal(s.owner.snapshot().disposed,false);
  const first=s.owner.dispose();assert.equal(s.owner.dispose(),first);assert.equal((await first).cleanupVerified,true);
  await assert.rejects(s.owner.createGraph(s.request),/UNAVAILABLE/);assert.deepEqual(s.trace,[]);
 }finally{await s.end();}
});
