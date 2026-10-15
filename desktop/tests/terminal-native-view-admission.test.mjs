// Pure actual-registry/policy composition with inert native handles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {TerminalPolicy} from '../src/terminal/policy.mjs';
class View extends EventEmitter {
 constructor(id,url){super();this.id=id;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+1000,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead});}
 isDestroyed(){return this.dead;}isMinimized(){return false;}restore(){}focus(){}close(){this.destroy();}
 destroy(){this.dead=true;this.webContents.emit('destroyed');this.emit('closed');}
}
const event=v=>({sender:v.webContents,senderFrame:v.webContents.mainFrame});
function setup(terminalViews){
 const windows=[],state={projectId:'project1',mode:'normal',access:'write',entityIds:['session1','doc1']};let calls=0,resolveFactory;
 const registry=new WindowRegistry({terminalViews,authorize:()=>state,createWindow:options=>{calls++;const view=new View(calls,options.mainFrameUrl);windows.push(view);return resolveFactory?new Promise(resolve=>resolveFactory(()=>resolve(view))):view;}});
 return {registry,state,windows,get calls(){return calls;},holdFactory:fn=>resolveFactory=fn};
}
test('Terminal view admission remains disabled by default and explicit false before factory',async()=>{
 for(const enabled of [undefined,false]){const s=setup(enabled);await assert.rejects(s.registry.openView({role:'terminal',entityId:'session1'}),e=>e.code==='ACCESS_REFUSED');assert.equal(s.calls,0);}
});
test('main opt-in admits genuine Terminal identity through existing native registry',async()=>{
 const s=setup(true);const record=await s.registry.openView({role:'terminal',entityId:'session1'}),v=s.windows[0],g=s.registry.capture(event(v));
 assert.equal(record.role,'terminal');assert.equal(g.role,'terminal');assert.equal(g.mainFrameUrl,`siren://app/windows/terminal.html?windowId=${record.windowId}`);assert.equal(s.registry.isCurrent(g),true);
 assert.equal(s.registry.isCurrent({...g}),false);assert.equal(s.registry.capture({sender:v.webContents,senderFrame:{url:g.mainFrameUrl}}),null);
 const session={sessionId:'session1',projectId:'project1'},lease={...session,windowId:g.windowId,epoch:g.epoch,leaseId:'lease1',generation:1};
 let unlocked=true;const policy=new TerminalPolicy({isCurrentGrant:x=>s.registry.isCurrent(x),isUnlocked:()=>unlocked,getMode:()=>s.state.mode,canExecute:()=>true,isCurrentLease:()=>true});
 assert.equal(policy.authorize({grant:g,method:'terminalInput',session,lease,epoch:g.epoch}).ok,true);unlocked=false;
 assert.equal(policy.authorize({grant:g,method:'terminalInput',session,lease,epoch:g.epoch}).code,'PIN_REQUIRED');
 s.registry.invalidateEpoch();assert.equal(s.registry.isCurrent(g),false);
});
test('Terminal opt-in requires normal write scope and current owned session',async()=>{
 for(const scope of [{mode:'readonly',access:'read'},{mode:'recovery',access:'read'},{mode:'normal',access:'read'}]){const s=setup(true);Object.assign(s.state,scope);await assert.rejects(s.registry.openView({role:'terminal',entityId:'session1'}),e=>e.code==='ACCESS_REFUSED');assert.equal(s.calls,0);}
 const s=setup(true);await assert.rejects(s.registry.openView({role:'terminal',entityId:'foreign'}),e=>e.code==='ACCESS_REFUSED');assert.equal(s.calls,0);
});
test('late Terminal factory after epoch retirement is destroyed without a usable grant',async()=>{
 const s=setup(true);let release;s.holdFactory(fn=>release=fn);const pending=s.registry.openView({role:'terminal',entityId:'session1'});assert.equal(s.calls,1);s.registry.invalidateEpoch();release();
 await assert.rejects(pending,e=>e.code==='ACCESS_REFUSED');assert.equal(s.windows[0].isDestroyed(),true);assert.equal(s.registry.capture(event(s.windows[0])),null);
});
test('a Terminal factory cannot reuse an existing native Docs renderer',async()=>{
 const state={projectId:'project1',mode:'normal',access:'write',entityIds:['session1','doc1']};let old;
 const registry=new WindowRegistry({terminalViews:true,authorize:()=>state,createWindow:options=>old??=new View(1,options.mainFrameUrl)});await registry.openView({role:'docs',entityId:'doc1'});
 assert.equal(registry.capture(event(old)).role,'docs');
 await assert.rejects(registry.openView({role:'terminal',entityId:'session1'}),e=>e.code==='ACCESS_REFUSED');assert.equal(registry.capture(event(old)).role,'docs');
});
test('Terminal admission rejects truthy configuration instead of enabling it',()=>{
 for(const terminalViews of [1,'true',{},()=>true])assert.throws(()=>setup(terminalViews),TypeError);
});
