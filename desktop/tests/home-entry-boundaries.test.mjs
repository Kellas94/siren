import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {runAfterWorkspaceLoad} from '../src/windows/readiness.mjs';
const entries=await import('../src/navigation/entries.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function fixture(url='siren://app/home.html') {
 const window=new EventEmitter();window.id=1;window.isDestroyed=()=>false;window.webContents=new EventEmitter();
 let loading=false;Object.assign(window.webContents,{id:101,mainFrame:{url},getURL:()=>window.webContents.mainFrame.url,isDestroyed:()=>false,isLoadingMainFrame:()=>loading});
 const registry=new WindowRegistry({createWindow:()=>{},authorize:()=>({projectId:'owned',mode:'normal',access:'write',entityIds:['doc-a','source-a']})});registry.bindWorkspace(window);
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};return {window,registry,event,setLoading:value=>loading=value};
}
test('entry URLs and native route contracts have one finite shared definition',()=>{
 assert.equal(typeof entries.normalizeRoute,'function');assert.equal(entries.WORKSPACE_ENTRIES?.home,'siren://app/home.html');assert.equal(entries.WORKSPACE_ENTRIES?.module,'siren://app/app.html');
});
test('genuine Home activation grants no source/entity access and explicit App activation retains its native scope',()=>{
 const f=fixture();f.registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 assert.deepEqual(f.registry.capture(f.event).entityIds,[]);assert.equal(f.registry.capturePrimary(f.event).role,'workspace');
 f.registry.invalidateEpoch({preserveWorkspace:true});f.window.webContents.mainFrame={url:'siren://app/app.html'};
 f.registry.activateWorkspace({entryUrl:'siren://app/app.html'});assert.deepEqual(f.registry.capture({sender:f.window.webContents,senderFrame:f.window.webContents.mainFrame}).entityIds,['doc-a','source-a']);
});
test('unknown entry, query, injected activation options and spoofed same-URL frames never activate a workspace',()=>{
 for(const entryUrl of ['siren://app/home.html?x=1','siren://app/other.html','https://example.test/home.html'])assert.throws(()=>fixture(entryUrl).registry.activateWorkspace({entryUrl}),{code:'ACCESS_REFUSED'});
 const f=fixture('siren://app/app.html');assert.throws(()=>f.registry.activateWorkspace({entryUrl:'siren://app/app.html',projectId:'forged'}),{code:'ACCESS_REFUSED'});
 let ran=false;const hostile={};Object.defineProperty(hostile,'entryUrl',{enumerable:true,get:()=>{ran=true;return 'siren://app/app.html';}});assert.throws(()=>f.registry.activateWorkspace(hostile),{code:'ACCESS_REFUSED'});assert.equal(ran,false);
});
test('Home readiness requires an explicit native expected URL; legacy default still requires App',async()=>{
 const f=fixture();let invoked=0;
 await assert.rejects(runAfterWorkspaceLoad(f.window.webContents,()=>invoked++),{code:'WORKSPACE_NOT_READY'});
 assert.equal(await runAfterWorkspaceLoad(f.window.webContents,()=>++invoked,{expectedUrl:'siren://app/home.html'}),1);
 assert.equal(invoked,1);
 for(const expectedUrl of ['siren://app/home.html?x=1','siren://app/app.html/other','https://example.test'])await assert.rejects(runAfterWorkspaceLoad(f.window.webContents,()=>++invoked,{expectedUrl}),{code:'WORKSPACE_NOT_READY'});
 assert.equal(invoked,1);
});
test('navigation away from a pending Home load refuses before invoking the PIN or route operation',async()=>{
 const f=fixture();f.setLoading(true);let invoked=false;
 const operation=runAfterWorkspaceLoad(f.window.webContents,()=>{invoked=true;},{expectedUrl:'siren://app/home.html',timeoutMs:100});
 f.window.webContents.mainFrame={url:'siren://app/app.html'};f.setLoading(false);f.window.webContents.emit('did-start-navigation',{isMainFrame:true});
 await assert.rejects(operation,{code:'WORKSPACE_NOT_READY'});assert.equal(invoked,false);assert.equal(f.window.webContents.listenerCount('did-finish-load'),0);
});
test('routes copy exact source references and never accept caller URLs, epochs or another surface source reference',()=>{
 assert.equal(typeof entries.normalizeRoute,'function');
 const route={surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:4,sha256:'a'.repeat(64)}},copied=entries.normalizeRoute(route);route.sourceRef.version=5;
 assert.equal(copied.sourceRef.version,4);assert.deepEqual(entries.normalizeRoute({surface:'home'}),{surface:'home'});
 for(const value of [{surface:'home',entityId:'doc-a'},{surface:'docs',sourceRef:copied.sourceRef},{surface:'code',entityId:'other',sourceRef:copied.sourceRef},{surface:'diagrams',url:'siren://app/app.html'},{surface:'code',epoch:2},{surface:'unknown'}])assert.throws(()=>entries.normalizeRoute(value),{code:'INVALID_ROUTE'});
 let ran=false;const hostile={};Object.defineProperty(hostile,'surface',{enumerable:true,get:()=>{ran=true;return 'home';}});assert.throws(()=>entries.normalizeRoute(hostile),{code:'INVALID_ROUTE'});assert.equal(ran,false);
});
test('explicit null and accessor readiness/entry options are refused without invoking user code',async()=>{
 const f=fixture('siren://app/app.html');let invoked=false,ran=false;
 assert.throws(()=>f.registry.activateWorkspace({entryUrl:null}),{code:'ACCESS_REFUSED'});
 for(const options of [{expectedUrl:null},{timeoutMs:null},{expectedUrl:'siren://app/app.html',projectId:'forged'}])await assert.rejects(runAfterWorkspaceLoad(f.window.webContents,()=>invoked=true,options),{code:'WORKSPACE_NOT_READY'});
 const hostile={};Object.defineProperty(hostile,'expectedUrl',{enumerable:true,get:()=>{ran=true;return 'siren://app/app.html';}});
 await assert.rejects(runAfterWorkspaceLoad(f.window.webContents,()=>invoked=true,hostile),{code:'WORKSPACE_NOT_READY'});assert.equal(invoked,false);assert.equal(ran,false);
});
