// Inert MAIN composition controls; no addon, utility process or native admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createHook} from 'node:async_hooks';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {privateManager,deferred,inertTick} from './fixtures/terminal-manager-global.mjs';
import {createDesktopNativeRuntimeOwner} from '../src/terminal/desktop-native-runtime.mjs';
import {captureDesktopNativeRuntimeResources,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
import * as graphModule from '../src/terminal/shutdown-graph.mjs';

let sequence=0;
async function setup(change=()=>{}){
 const directory=resolve('inert-retirement-fixtures',String(Date.now())+'_'+ ++sequence),pins={};
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...path.split('/'));await mkdir(dirname(target),{recursive:true});const bytes=Buffer.from('INERT DATA '+path);await writeFile(target,bytes);pins[path]=createHash('sha256').update(bytes).digest('hex');}
 const receipt=await captureDesktopNativeRuntimeResources({directory,pins});
 const h=privateManager(),n=fixture({noStart:true,hostOrdinals:[]}),ready=deferred(),retired=deferred(),reserved=deferred(),retireCalled=deferred(),requests=[];
 const providers={cwd:{pickDirectory:async()=>({canceled:true,filePaths:[]}),protectedRoots:[],inspectDirectory:async()=>{throw Error('unused');}},profiles:{getSystemDirectory:async()=> 'C:\\Windows\\System32',inspectExecutable:async()=>{throw Error('unused');},readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows'}),privateEnvironmentKeys:[],modulePathPolicy:'system-seeded',inspectModuleDirectory:async()=>{throw Error('unused');}},policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true}};
 const owner=createDesktopNativeRuntimeOwner({adapter:{retireProviders:async()=>({retired:true,actualSettled:true,pending:0,nativeExecutionAdmitted:false}),captureResources:async()=>receipt,verifyResourceClosure:async()=>true,providers:async()=>providers,isCurrent:()=>true,reserveHost:()=>{reserved.resolve();change(owner);return {ready:ready.promise,retire(...args){requests.push(args);retireCalled.resolve();return retired.promise;}};}}});
 const request={registry:h.registry,projectId:'project1',workspaceEvent:h.registry.eventFor(h.grant),access:{prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},isReady:()=>true}};
 const s={h,n,owner,ready,retired,reserved,retireCalled,requests,request};
 s.begin=async()=>{const p=owner.createGraph(request);await reserved.promise;ready.resolve({native:n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});return p;};
 return s;
}
async function until(f){for(let i=0;i<150&&!f();i++)await inertTick();assert(f(),'finite inert settlement');}
async function finish(s,disposal){
 await until(()=>s.n.calls.some(c=>c[0]==='hostStop'));
 s.n.hostStop.resolve(s.n.finalHost());s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});
 assert.equal((await disposal).cleanupVerified,true);
}
function assertShared(s,graph,expected){
 assert.equal(s.requests.length,1);assert.equal(s.requests[0].length,1,'retire needs one operation request');
 const request=s.requests[0][0];assert(Object.isFrozen(request));assert.deepEqual({...request},expected);
 assert.equal(graphModule.captureTerminalGraphShutdownRequest(graph),request,'actual graph request identity');
 const calls=s.n.calls.filter(c=>c[0]==='hostStop');assert.equal(calls.length,1);
 assert.deepEqual(calls[0].slice(2,5),[request.code,request.deadlineMs,request.shutdownId]);
}


test('synchronous reservation reentry retains the returned host capability and exact fallback request',async()=>{
 let disposal;const s=await setup(owner=>{disposal=owner.dispose();});
 try{const start=s.owner.createGraph(s.request);start.catch(()=>{});await s.reserved.promise;await s.retireCalled.promise;
 assert.equal(s.requests.length,1);assert.equal(s.requests[0].length,1);assert.deepEqual({...s.requests[0][0]},{code:77,deadlineMs:5000,shutdownId:'desktop_native_1'});assert(Object.isFrozen(s.requests[0][0]));
 assert.equal(s.owner.snapshot().pending,true);assert.equal(s.n.calls.length,0);
 s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await inertTick();assert.equal(s.owner.snapshot().cleanupVerified,false);
 s.ready.resolve({native:s.n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});
 await assert.rejects(start,/START_REFUSED/);assert.equal((await disposal).cleanupVerified,true);assert.equal(s.requests.length,1);
 }finally{await s.h.end();}
});
test('genuine graph capture is null before request and retains identical actual request after completion',async()=>{
 const s=await setup();try{const graph=await s.begin(),capture=graphModule.captureTerminalGraphShutdownRequest;
 assert.equal(capture(graph),null);assert.equal(capture(graph,'extra'),null);assert.equal(capture({...graph}),null);
 const external=graph.shutdown({code:98,deadlineMs:250,shutdownId:'completed_external'}),actual=capture(graph);
 assert(actual);assert(Object.isFrozen(actual));assert.equal(capture(graph),actual);assert.equal(capture(graph,'extra'),null);
 const disposal=s.owner.dispose();await s.retireCalled.promise;await until(()=>s.n.calls.some(c=>c[0]==='hostStop'));
 assertShared(s,graph,{code:98,deadlineMs:250,shutdownId:'completed_external'});await finish(s,disposal);await external;
 assert.equal(capture(graph),actual);assert.equal(s.requests[0][0],actual);
 }finally{await s.h.end();}
});
test('unknown graph join still sends its actual request to emergency retirement without claiming cleanup',async()=>{
 const s=await setup();try{s.n.native.start=()=>null;let settled=false;
 const start=s.begin().then(()=>{settled=true;},()=>{settled=true;});await s.retireCalled.promise;
 assert.equal(s.requests.length,1);assert.equal(s.requests[0].length,1);assert(Object.isFrozen(s.requests[0][0]));assert.deepEqual({...s.requests[0][0]},{code:77,deadlineMs:5000,shutdownId:'desktop_native_1'});
 s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});for(let i=0;i<5;i++)await inertTick();
 assert.equal(settled,false);assert.equal(s.owner.snapshot().cleanupVerified,false);assert.equal(s.owner.snapshot().pending,true);void start;
 }finally{await s.h.end();}
});
