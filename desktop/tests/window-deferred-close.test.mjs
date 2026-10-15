import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {invokeWindow} from '../src/windows/ipc.mjs';

// Actual MAIN listener/registry/IPC composition. The independent adverse
// reproduction by /root/terminal_navigation_independent is preserved separately.
const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
const marker="    view.on('close',event=>{";
const start=main.indexOf(marker),end=main.indexOf('\n    });',start)+11;
assert.ok(start>0&&end>start);
const closeListener=main.slice(start,end);
const eventFor=view=>({sender:view.webContents,senderFrame:view.webContents.mainFrame});
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
class InertWindow extends EventEmitter{
 constructor(id,url){
  super();Object.assign(this,{id,destroyed:false,closeCalls:0,holdNativeClose:false,unloadVeto:false});
  this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+100,mainFrame:{url},isDestroyed:()=>this.destroyed,getURL:()=>this.webContents.mainFrame.url,send:()=>{}});
 }
 isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}focus(){}
 close(){
  this.closeCalls++;const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  this.emit('close',event);
  if(event.defaultPrevented||this.destroyed)return;
  if(this.unloadVeto){const unload={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};this.webContents.emit('will-prevent-unload',unload);if(!unload.defaultPrevented)return;}
  if(!this.holdNativeClose)this.destroy();
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}
}
async function fixture(role='docs',{timeoutMs=300,working=true,freezeRoster=false}={}){
 const windows=[],policy={projectId:'project_a',mode:'normal',access:'write',entityIds:['item_a']};
 const registry=new WindowRegistry({closeTimeoutMs:timeoutMs,authorize:()=>policy,createWindow:spec=>{const view=new InertWindow(windows.length+1,spec.mainFrameUrl);windows.push(view);return view;}});
 await registry.openView({role:'workspace',entityId:null});const record=await registry.openView({role,entityId:'item_a'}),view=windows[1];
 let gate=held(),rollbacks=0,releases=0,prepares=0,roster=null,prepareHook=null,releaseAllowed=true;
 const context={view,windowRegistry:registry,closingWorkingViews:new WeakSet(),workingSources:{isWorking:g=>working&&g?.role==='code'},workingDocs:{isWorking:g=>working&&g?.role==='docs'},workingDiagrams:{isWorking:g=>working&&g?.role==='diagram'},writes:{viewClosing:false},workspaceBarrier:null,pinTransition:false,accountTransition:false,requestDocsDiagramScan:()=>{},window:windows[0],nativeShells:new Map([[record.windowId,view]])};
 context.prepareNativeWorkspace=()=>{prepares++;if(freezeRoster){roster=registry.freezeRoster();context.workspaceBarrier={};}prepareHook?.();return gate.promise;};
 context.rollbackNativePreparation=async()=>{rollbacks++;if(roster)registry.releaseRoster(roster);context.workspaceBarrier=null;};
 vm.runInNewContext(closeListener,context,{filename:'actual-main-working-view-close.js'});
 return {registry,view,record,policy,context,event:()=>eventFor(view),counts:()=>({prepares,rollbacks,releases}),
  complete(){gate.resolve({barrier:{release:()=>{releases++;return releaseAllowed&&(!roster||registry.releaseRoster(roster));}},proof:{}});},
  fail(){gate.reject(Error('Dirty save refused'));},retry(){gate=held();},releaseAllowed:value=>{releaseAllowed=value;},prepareHook:value=>{prepareHook=value;},
  call:(event=eventFor(view))=>invokeWindow({event,method:'closeView',payload:{windowId:record.windowId},registry})};
}
for(const role of ['docs','code','diagram'])test(`${role} working self-close waits for preparation and actual native close, then reports success`,async()=>{
 const s=await fixture(role,{freezeRoster:true});let settled=false;
 const result=s.call().then(value=>{settled=true;return value;});
 try{
  await tick();assert.equal(settled,false,'MAIN prevention for preparation must not be reported as cancellation');
  assert.equal(s.view.isDestroyed(),false);assert.equal(s.context.writes.viewClosing,true);assert.equal(s.view.closeCalls,1);
  s.complete();assert.deepEqual(await result,{ok:true,closed:true});
  assert.equal(s.view.isDestroyed(),true);assert.deepEqual(s.counts(),{prepares:1,rollbacks:0,releases:1});
  assert.equal(s.context.writes.viewClosing,false);assert.equal(s.context.closingWorkingViews.has(s.view),false);
 }finally{s.complete();await result;}
});
for(const role of ['docs','code','diagram'])test(`${role} dirty preparation rejection cancels without losing its current grant or releasing`,async()=>{
 const s=await fixture(role),grant=s.registry.capture(s.event());let settled=false;
 const result=s.call().then(value=>{settled=true;return value;});
 try{await tick();assert.equal(settled,false);s.fail();assert.equal((await result).code,'CANCELLED');assert.equal(s.registry.isCurrent(grant),true);assert.equal(s.view.isDestroyed(),false);assert.deepEqual(s.counts(),{prepares:1,rollbacks:1,releases:0});assert.equal(s.context.writes.viewClosing,false);}
 finally{s.fail();await result;}
});
test('preparation success is insufficient until the exact native view is destroyed',async()=>{
 const s=await fixture();s.view.holdNativeClose=true;let settled=false;
 const result=s.call().then(value=>{settled=true;return value;});
 try{s.complete();await tick();assert.equal(settled,false);assert.equal(s.view.closeCalls,2);assert.equal(s.view.isDestroyed(),false);s.view.destroy();assert.deepEqual(await result,{ok:true,closed:true});}
 finally{s.complete();s.view.destroy();await result;}
});
test('shared close continuations preserve one preparation and each exact self-close proof',async()=>{
 const s=await fixture();const a=s.call(),b=s.call();
 try{await tick();assert.equal(s.view.closeCalls,1);assert.equal(s.counts().prepares,1);s.complete();assert.deepEqual(await a,{ok:true,closed:true});assert.deepEqual(await b,{ok:true,closed:true});}
 finally{s.complete();await Promise.all([a,b]);}
});
test('the existing bounded close deadline retires deferred preparation and prevents a late close',async()=>{
 const s=await fixture('docs',{timeoutMs:15}),grant=s.registry.capture(s.event());
 const result=s.call();
 try{assert.equal((await result).code,'WINDOW_CLOSE_TIMEOUT');s.complete();await tick();assert.equal(s.view.closeCalls,1);assert.equal(s.view.isDestroyed(),false);assert.equal(s.registry.isCurrent(grant),true);assert.deepEqual(s.counts(),{prepares:1,rollbacks:1,releases:0});assert.equal(s.context.writes.viewClosing,false);}
 finally{s.complete();await result;}
});
test('native user close without an IPC waiter also cannot execute after its deferred deadline',async()=>{
 const s=await fixture('code',{timeoutMs:15});s.view.close();
 try{await new Promise(resolve=>setTimeout(resolve,30));s.complete();await tick();assert.equal(s.view.closeCalls,1);assert.equal(s.view.isDestroyed(),false);assert.equal(s.counts().rollbacks,1);assert.equal(s.counts().releases,0);}
 finally{s.complete();}
});
for(const [name,mutate] of [['project',s=>{s.policy.projectId='project_b';}],['mode',s=>{s.policy.mode='readonly';}],['entity',s=>{s.policy.entityIds=[];}],['frame',s=>{s.view.webContents.mainFrame={url:s.view.webContents.mainFrame.url};}]])test(`late preparation after ${name} drift cannot release or close`,async()=>{
 const s=await fixture(),result=s.call();
 try{await tick();mutate(s);s.complete();assert.equal((await result).code,'SENDER_REFUSED');assert.equal(s.view.closeCalls,1);assert.equal(s.view.isDestroyed(),false);assert.equal(s.counts().releases,0);assert.equal(s.counts().rollbacks,1);}
 finally{s.complete();await result;}
});
test('epoch revocation never becomes an intentional close proof when held preparation settles',async()=>{
 const s=await fixture(),result=s.call();
 try{await tick();s.registry.invalidateEpoch();s.complete();assert.equal((await result).code,'SENDER_REFUSED');await tick();assert.equal(s.view.closeCalls,1);assert.equal(s.counts().releases,0);assert.equal(s.counts().rollbacks,1);}
 finally{s.complete();await result;}
});
test('barrier release refusal keeps the dirty view and never calls native close again',async()=>{
 const s=await fixture(),grant=s.registry.capture(s.event()),result=s.call();s.releaseAllowed(false);
 try{s.complete();assert.equal((await result).code,'CANCELLED');assert.equal(s.view.closeCalls,1);assert.equal(s.registry.isCurrent(grant),true);assert.equal(s.view.isDestroyed(),false);assert.equal(s.counts().rollbacks,1);}
 finally{s.complete();await result;}
});
test('a real renderer unload veto is cancellation and the next dirty close must prepare again',async()=>{
 const s=await fixture();s.view.unloadVeto=true;const result=s.call();
 try{s.complete();assert.equal((await result).code,'CANCELLED');await tick();assert.equal(s.view.isDestroyed(),false);assert.equal(s.context.closingWorkingViews.has(s.view),false);s.retry();s.view.unloadVeto=false;const retry=s.call();await tick();assert.equal(s.counts().prepares,2);assert.equal(s.view.isDestroyed(),false);s.complete();assert.deepEqual(await retry,{ok:true,closed:true});}
 finally{s.complete();await result;}
});
test('an overridden renderer unload veto still requires actual native destruction',async()=>{
 const s=await fixture();s.view.unloadVeto=true;s.view.webContents.on('will-prevent-unload',event=>event.preventDefault());const result=s.call();
 try{s.complete();assert.deepEqual(await result,{ok:true,closed:true});assert.equal(s.view.isDestroyed(),true);}
 finally{s.complete();await result;}
});
test('a renderer-like marker on a prevented close cannot create a trusted preparation stage',async()=>{
 const s=await fixture('docs',{working:false});s.view.on('close',event=>{event.preventDefault();event.deferredNativeClose=true;});
 assert.equal((await s.call()).code,'CANCELLED');assert.equal(s.view.isDestroyed(),false);assert.equal(s.counts().prepares,0);
});
test('reentrant MAIN preparation observes one already-reserved close attempt',async()=>{
 const s=await fixture();let nested;s.prepareHook(()=>{nested=s.registry.closeView(s.record.windowId,{caller:s.event()});});const result=s.call();
 try{await tick();assert.equal(s.counts().prepares,1);assert.equal(s.view.closeCalls,1);s.complete();assert.deepEqual(await result,{ok:true,closed:true});assert.equal(await nested,true);}
 finally{s.complete();await result;}
});
test('renderer destruction before shell closure still waits for the actual native closed proof',async()=>{
 const s=await fixture();let contentsDestroyed=false,settled=false;
 s.view.webContents.isDestroyed=()=>contentsDestroyed;
 s.view.destroy=()=>{contentsDestroyed=true;s.view.webContents.emit('destroyed');};
 const result=s.call().then(value=>{settled=true;return value;});
 try{
  s.complete();await tick();assert.equal(contentsDestroyed,true);assert.equal(s.view.isDestroyed(),false);
  assert.equal(settled,false,'Retiring the preparation stage is not a user cancellation when native teardown has begun');
  s.view.destroyed=true;s.view.emit('closed');assert.deepEqual(await result,{ok:true,closed:true});
 }finally{s.complete();s.view.destroyed=true;s.view.emit('closed');await result;}
});
