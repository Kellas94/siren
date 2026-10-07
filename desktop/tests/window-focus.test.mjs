import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {NativeWindowFocus,bindNativeWindowFocusKeys} from '../src/windows/focus.mjs';

test('close active view targets its captured native shell, never the main workspace or another view',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId),docs=f.windows.get(f.docs.windowId);
 code.focus();assert.equal(f.focus.closeActive(),true);assert.equal(code.dead,true);assert.equal(docs.dead,false);assert.equal(f.main.dead,false);
 assert.equal(f.focus.closeActive(f.main),false);assert.equal(f.main.dead,false);
 f.state.enabled=false;assert.equal(f.focus.closeActive(docs),false);assert.equal(docs.dead,false);
 f.state.enabled=true;docs.webContents.mainFrame={url:docs.webContents.getURL()};assert.equal(f.focus.closeActive(docs),false);assert.equal(docs.dead,false);
});
test('close from main targets only the selected attached view; no selection is a harmless no-op',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId),docs=f.windows.get(f.docs.windowId);
 f.registry.surfaceRecords=()=>[{windowId:f.docs.windowId,selected:false},{windowId:f.code.windowId,selected:true}];
 assert.equal(f.focus.closeActive(f.main),true);assert.equal(code.dead,true);assert.equal(docs.dead,false);assert.equal(f.main.dead,false);
 assert.equal(f.focus.closeActive(f.main),false);assert.equal(docs.dead,false);
});
test('close refuses foreign, revoked and mid-selection transition origins; native veto remains intact',async()=>{
 const f=await fixture(),docs=f.windows.get(f.docs.windowId),foreign=new NativeWindow(200,'siren://app/home.html',f.state);
 assert.equal(f.focus.closeActive(foreign),false);assert.equal(foreign.dead,false);
 f.state.mode='readonly';assert.equal(f.focus.closeActive(docs),false);assert.equal(docs.dead,false);f.state.mode='normal';
 const gated=new NativeWindowFocus({registry:f.registry,mainWindow:f.main,windowFor:id=>{f.state.enabled=false;return f.windows.get(id);},focusedWindow:()=>f.main,canCycle:()=>f.state.enabled});
 f.registry.surfaceRecords=()=>[{windowId:f.docs.windowId,selected:true}];assert.equal(gated.closeActive(f.main),false);assert.equal(docs.dead,false);
 f.state.enabled=true;let requests=0;docs.close=()=>requests++;assert.equal(f.focus.closeActive(docs),true);assert.equal(requests,1);assert.equal(docs.dead,false);
});
test('Quit requests the permanent main close path from any captured native role and also from locked main',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);let requests=0;f.main.close=()=>requests++;
 assert.equal(f.focus.quit(code),true);assert.equal(requests,1);assert.equal(code.dead,false);
 const foreign=new NativeWindow(200,'siren://app/home.html',f.state);assert.equal(f.focus.quit(foreign),false);assert.equal(requests,1);
 code.webContents.mainFrame={url:code.webContents.getURL()};assert.equal(f.focus.quit(code),false);assert.equal(requests,1);
 f.state.mode='locked';assert.equal(f.focus.quit(f.main),true);assert.equal(requests,2);
});
test('Ctrl+W and Ctrl+Q use the genuine input origin once, suppress repeat/menu duplicates and preserve composing keys',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);bindNativeWindowFocusKeys(code,f.focus);let closes=0,quits=0,prevented=0;code.close=()=>closes++;f.main.close=()=>quits++;
 const event={preventDefault(){prevented++;}},input={type:'keyDown',control:true,alt:false,key:'w'};
 for(const changed of [{type:'keyUp'},{shift:true},{meta:true},{isComposing:true},{control:false},{alt:true}])code.webContents.emit('before-input-event',event,{...input,...changed});assert.equal(closes,0);assert.equal(quits,0);assert.equal(prevented,0);
 f.state.focused=f.main;code.webContents.emit('before-input-event',event,input);assert.equal(closes,1);assert.equal(prevented,1);
 code.webContents.emit('before-input-event',event,{...input,isAutoRepeat:true});assert.equal(closes,1);assert.equal(prevented,2);
 code.webContents.emit('before-input-event',event,{...input,key:'Q'});assert.equal(quits,1);assert.equal(prevented,3);
 code.webContents.emit('before-input-event',event,{...input,key:'q',isAutoRepeat:true});assert.equal(quits,1);assert.equal(prevented,4);
});

// Only the Electron boundary is doubled. Real registry grants, revocation and
// the focus selector run unchanged; native keyboard execution is separate.
class NativeWindow extends EventEmitter{
 constructor(id,url,state){super();this.id=id;this.state=state;this.dead=false;this.minimized=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+1000,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead});}
 isDestroyed(){return this.dead;}isMinimized(){return this.minimized;}restore(){this.minimized=false;}focus(){this.state.focused=this;}close(){this.destroy();}destroy(){this.dead=true;this.emit('closed');}
}
async function fixture(){
 const state={focused:null,enabled:true,mode:'normal'},windows=new Map();let serial=1;
 const registry=new WindowRegistry({authorize:()=>state.mode==='locked'?null:{projectId:'project-a',mode:state.mode,access:state.mode==='normal'?'write':'read',entityIds:['code-a','docs-a','flow-a']},createWindow:options=>{const w=new NativeWindow(serial++,options.mainFrameUrl,state);windows.set(options.windowId,w);return w;}});
 const main=new NativeWindow(99,'siren://app/home.html',state);registry.bindWorkspace(main);registry.activateWorkspace({entryUrl:'siren://app/home.html'});main.focus();
 const code=await registry.openView({role:'code',entityId:'code-a'}),docs=await registry.openView({role:'docs',entityId:'docs-a'}),diagram=await registry.openView({role:'diagram',entityId:'flow-a'});
 const focus=new NativeWindowFocus({registry,mainWindow:main,windowFor:id=>windows.get(id),focusedWindow:()=>state.focused,canCycle:()=>state.enabled&&state.mode!=='locked'});
 return {state,registry,windows,main,code,docs,diagram,focus};
}
test('native cycling restores the selected minimized neighbour and wraps both directions without opening a view',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.minimized=true;const before=f.registry.listViews();
 assert.equal(f.focus.cycle(1),true);assert.equal(code.minimized,false);assert.equal(f.state.focused,code);
 assert.equal(f.focus.cycle(1),true);assert.equal(f.state.focused,f.windows.get(f.docs.windowId));
 assert.equal(f.focus.cycle(-1),true);assert.equal(f.state.focused,code);
 f.main.focus();assert.equal(f.focus.cycle(-1),true);assert.equal(f.state.focused,f.windows.get(f.diagram.windowId));assert.equal(f.registry.listViews().length,before.length);
});
test('main return restores only the permanent window while locked without authorizing a data view',async()=>{
 const f=await fixture();f.main.minimized=true;f.state.mode='locked';f.windows.get(f.code.windowId).focus();
 assert.equal(f.focus.cycle(1),false);assert.equal(f.focus.showMain(),true);assert.equal(f.main.minimized,false);assert.equal(f.state.focused,f.main);assert.equal(f.registry.capture({sender:f.main.webContents,senderFrame:f.main.webContents.mainFrame}),null);
 f.main.dead=true;assert.equal(f.focus.showMain(),false);
});
test('transition fences and invalid directions never restore a minimized data view',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.minimized=true;f.state.enabled=false;
 assert.equal(f.focus.cycle(1),false);assert.equal(code.minimized,true);assert.equal(f.state.focused,f.main);
 f.state.enabled=true;for(const value of [0,2,'1',null,undefined])assert.equal(f.focus.cycle(value),false);assert.equal(code.minimized,true);
});
test('same-URL replacement frames and changed native permissions are excluded from the focus roster',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.minimized=true;code.webContents.mainFrame={url:code.webContents.getURL()};
 assert.equal(f.focus.cycle(1),true);assert.equal(f.state.focused,f.windows.get(f.docs.windowId));assert.equal(code.minimized,true);
 f.state.mode='readonly';f.main.focus();assert.equal(f.focus.cycle(1),false);assert.equal(code.minimized,true);
});
test('a foreign focused native handle is never brought into the registered cycle',async()=>{
 const f=await fixture(),foreign=new NativeWindow(99,'siren://app/home.html',f.state);foreign.focus();
 assert.equal(f.focus.cycle(1),true);assert.equal(f.state.focused,f.main);assert.equal(f.registry.listViews().length,4);
});
test('native window lookup cannot alias another grant and access is rechecked after gathering the roster',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.minimized=true;
 const aliased=new NativeWindowFocus({registry:f.registry,mainWindow:f.main,windowFor:()=>code,focusedWindow:()=>f.main,canCycle:()=>true});assert.equal(aliased.cycle(-1),true);assert.equal(f.state.focused,code);
 f.main.focus();f.state.enabled=true;
 const transitioning=new NativeWindowFocus({registry:f.registry,mainWindow:f.main,windowFor:id=>{f.state.enabled=false;return f.windows.get(id);},focusedWindow:()=>f.main,canCycle:()=>f.state.enabled});
 code.minimized=true;assert.equal(transitioning.cycle(1),false);assert.equal(code.minimized,true);assert.equal(f.state.focused,f.main);
});
test('native key handling uses its genuine source window and consumes the menu accelerator once',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);bindNativeWindowFocusKeys(f.main,f.focus);code.minimized=true;f.state.focused=null;let prevented=0;
 const event={preventDefault(){prevented++;}},input={type:'keyDown',control:true,alt:true,key:'ArrowRight'};
 f.main.webContents.emit('before-input-event',event,input);assert.equal(f.state.focused,code);assert.equal(code.minimized,false);assert.equal(prevented,1);
 f.main.webContents.emit('before-input-event',event,{...input,isAutoRepeat:true});assert.equal(f.state.focused,code);assert.equal(prevented,2);
});
test('native key handling preserves unrelated keys and cannot cycle from an unregistered handle',async()=>{
 const f=await fixture(),foreign=new NativeWindow(200,'siren://app/home.html',f.state);bindNativeWindowFocusKeys(f.main,f.focus);bindNativeWindowFocusKeys(foreign,f.focus);let prevented=0;
 const event={preventDefault(){prevented++;}},input={type:'keyDown',control:true,alt:true,key:'ArrowRight'};
 for(const changed of [{type:'keyUp'},{shift:true},{meta:true},{isComposing:true},{control:false},{alt:false},{key:'x'}])f.main.webContents.emit('before-input-event',event,{...input,...changed});assert.equal(f.state.focused,f.main);assert.equal(prevented,0);
 foreign.webContents.emit('before-input-event',event,input);assert.equal(f.state.focused,f.main);assert.equal(prevented,1);
});
