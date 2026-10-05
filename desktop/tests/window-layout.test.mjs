import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {NativeWindowFocus,bindNativeWindowFocusKeys} from '../src/windows/focus.mjs';
const implementation=await import('../src/windows/layout.mjs').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const area={x:0,y:40,width:1280,height:800},bounds={x:-3000,y:-100,width:700,height:500};
class NativeWindow extends EventEmitter{
 constructor(id,url){super();this.id=id;this.dead=false;this.normal={...bounds};this.minimum=[480,320];this.minimized=false;this.maximized=false;this.fullscreen=false;this.changes=0;this.focuses=0;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+100,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead});}
 isDestroyed(){return this.dead;}isMinimized(){return this.minimized;}isMaximized(){return this.maximized;}isFullScreen(){return this.fullscreen;}
 getNormalBounds(){return {...this.normal};}getMinimumSize(){return [...this.minimum];}setMinimumSize(w,h){this.minimum=[w,h];}
 setBounds(b){if(this.fail)throw Error('Owned native bounds failure');this.normal={...b};this.changes++;}
 setFullScreen(flag){this.fullscreen=flag;}maximize(){this.maximized=true;}unmaximize(){this.maximized=false;}
 restore(){this.minimized=false;}minimize(){this.minimized=true;}focus(){this.focuses++;}close(){this.destroy();}destroy(){this.dead=true;this.emit('closed');}
}
async function fixture(adapters={}){
 assert.equal(typeof implementation.NativeWindowLayout,'function','Main-owned native display recovery must be implemented');
 const state={enabled:true,mode:'normal',displays:[{id:1,primary:true,workArea:area}]},windows=new Map();let serial=1;
 const registry=new WindowRegistry({authorize:()=>state.mode==='locked'?null:{projectId:'project-a',mode:state.mode,access:'write',entityIds:['code-a','docs-a']},createWindow:options=>{const w=new NativeWindow(serial++,options.mainFrameUrl);windows.set(options.windowId,w);return w;}});
 const main=new NativeWindow(99,'siren://app/home.html');registry.bindWorkspace(main);registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 const code=await registry.openView({role:'code',entityId:'code-a'}),docs=await registry.openView({role:'docs',entityId:'docs-a'});
 const layout=new implementation.NativeWindowLayout({registry,mainWindow:main,windowFor:id=>windows.get(id),displays:()=>state.displays,canRecoverViews:()=>state.enabled&&state.mode!=='locked',...adapters});
 return {state,registry,windows,main,code,docs,layout};
}
test('native placement suspends mode persistence before fullscreen exit and cancels that metadata transaction at Lock',async()=>{
 const ends=[];let held=false;const f=await fixture({placementMemory:{beginPlacement(){held=true;return ok=>{held=false;ends.push(ok);};}}}),docs=f.windows.get(f.docs.windowId);docs.fullscreen=true;
 docs.setFullScreen=flag=>{assert.equal(held,true);docs.fullscreen=flag;if(!flag)queueMicrotask(()=>{f.state.mode='locked';});};
 const ticket=f.layout.prepareMove(docs);assert.equal(await f.layout.moveToMonitor(ticket,1),false);assert.deepEqual(ends,[false]);assert.equal(held,false);
});
test('monitor chooser moves only its captured native Code to the selected negative-coordinate display and preserves modes',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);
 f.state.displays.push({id:2,workArea:{x:-1600,y:0,width:1600,height:900}});code.normal={x:100,y:100,width:700,height:500};code.maximized=true;code.minimized=true;
 const before=f.registry.listViews();
 assert.equal(typeof f.layout.prepareMove,'function');const ticket=f.layout.prepareMove(code);
 assert.equal(ticket.choices.length,2);assert.equal(ticket.choices[0].current,true);assert.equal(ticket.choices[1].current,false);
 assert.equal(await f.layout.moveToMonitor(ticket,2),true);
 assert.deepEqual(code.normal,{x:-1500,y:60,width:700,height:500});assert.equal(code.maximized,true);assert.equal(code.minimized,true);
 assert.equal(f.main.changes,0);assert.equal(f.windows.get(f.docs.windowId).changes,0);assert.equal(f.main.focuses,0);assert.deepEqual(f.registry.listViews(),before);
 assert.equal(await f.layout.moveToMonitor(ticket,1),false,'A consumed chooser cannot be replayed');
});
test('monitor chooser refuses copied tickets, forged displays, retired frames and changed display topology before mutation',async()=>{
 for(const revoke of ['copied','unknown','frame','topology','lock']){
  const f=await fixture(),code=f.windows.get(f.code.windowId);assert.equal(typeof f.layout.prepareMove,'function');let ticket=f.layout.prepareMove(code),id=1;
  if(revoke==='copied')ticket={...ticket};if(revoke==='unknown')id='1';if(revoke==='frame')code.webContents.mainFrame={url:code.webContents.getURL()};if(revoke==='topology')f.state.displays[0].workArea={...area,width:800};if(revoke==='lock')f.state.mode='locked';
  assert.equal(await f.layout.moveToMonitor(ticket,id),false,revoke);assert.equal(code.changes,0);assert.equal(f.main.changes,0);
 }
});
test('cross-DPI monitor movement uses actual DIP bounds and positions before sizing on the destination display',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);f.state.displays.push({id:2,workArea:{x:-1600,y:0,width:1600,height:900}});
 let actual={x:100,y:100,width:700,height:500},cached={...actual,width:1050,height:750},positioned=false,sized=false;
 code.getBounds=()=>({...actual});code.getNormalBounds=()=>({...cached});code.setPosition=(x,y)=>{actual={...actual,x,y};cached={...actual};positioned=true;};code.setSize=(width,height)=>{assert.equal(positioned,true);actual={...actual,width,height};cached={...actual};sized=true;};code.setBounds=b=>{actual={...b,width:Math.round(b.width/1.5),height:Math.round(b.height/1.5)};cached={...actual};};
 assert.equal(await f.layout.moveToMonitor(f.layout.prepareMove(code),2),true);assert.equal(sized,true);assert.deepEqual(actual,{x:-1500,y:60,width:700,height:500});
});
test('native monitor popup uses radio choices and a captured one-use origin without exposing renderer move authority',async()=>{
 assert.equal(typeof implementation.showNativeMonitorMenu,'function');const f=await fixture(),code=f.windows.get(f.code.windowId);let template,popup;
 const Menu={buildFromTemplate(items){template=items;return {popup(options){popup=options;}};}};
 assert.equal(implementation.showNativeMonitorMenu({Menu,layout:f.layout,originWindow:code}),true);assert.equal(popup.window,code);assert.equal(template[0].type,'radio');
 code.webContents.mainFrame={url:code.webContents.getURL()};assert.equal(await template[0].click(),false);assert.equal(code.changes,0);
});
test('removed-display recovery rehomes actual admitted native handles without focus, navigation or grants',async()=>{
 const f=await fixture(),before=f.registry.listViews();assert.equal(await f.layout.recover(),true);
 for(const w of [f.main,...f.windows.values()]){assert.deepEqual(w.normal,{x:0,y:40,width:700,height:500});assert.equal(w.focuses,0);}
 assert.deepEqual(f.registry.listViews(),before);
});
test('automatic metrics recovery preserves reachable windows and minimized, maximized and fullscreen states',async()=>{
 const f=await fixture();f.main.normal={x:80,y:90,width:900,height:600};f.windows.get(f.code.windowId).minimized=true;f.windows.get(f.docs.windowId).maximized=true;f.windows.get(f.docs.windowId).fullscreen=true;
 assert.equal(await f.layout.recover(),true);assert.equal(f.main.changes,0);assert.equal(f.windows.get(f.code.windowId).minimized,true);assert.equal(f.windows.get(f.docs.windowId).maximized,true);assert.equal(f.windows.get(f.docs.windowId).fullscreen,true);
});
test('explicit bring-back moves admitted windows to primary and restores minimized views without selecting or saving',async()=>{
 const f=await fixture();f.state.displays.push({id:2,workArea:{x:-1600,y:0,width:1600,height:900}});const code=f.windows.get(f.code.windowId);code.normal={x:-1200,y:40,width:700,height:500};code.minimized=true;
 assert.equal(await f.layout.bringAllBack(),true);assert.deepEqual(code.normal,{x:0,y:40,width:700,height:500});assert.equal(code.minimized,false);assert.equal(f.main.focuses,1);assert.equal(code.focuses,0);assert.equal(f.registry.listViews().length,3);
});
test('Lock and transition retain only permanent PIN window geometry and never reveal retained native data handles',async()=>{
 for(const mode of ['locked','transition']){const f=await fixture();if(mode==='locked')f.state.mode='locked';else f.state.enabled=false;const code=f.windows.get(f.code.windowId);code.minimized=true;
 assert.equal(await f.layout.bringAllBack(),true);assert.deepEqual(f.main.normal,{x:0,y:40,width:700,height:500});assert.equal(code.changes,0);assert.equal(code.minimized,true);assert.equal(code.focuses,0);}
});
test('replacement frames and aliased native handles cannot enter display recovery',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.webContents.mainFrame={url:code.webContents.getURL()};assert.equal(await f.layout.recover(),true);assert.equal(code.changes,0);
 const alias=new implementation.NativeWindowLayout({registry:f.registry,mainWindow:f.main,windowFor:()=>code,displays:()=>f.state.displays,canRecoverViews:()=>true});assert.equal(await alias.recover(),true);assert.equal(code.changes,0);
});
test('per-view grant and transition are rechecked after native normal bounds are read',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.getNormalBounds=()=>{f.state.enabled=false;return {...bounds};};assert.equal(await f.layout.recover(),false);assert.equal(code.changes,0);assert.equal(f.windows.get(f.docs.windowId).changes,0);
});
test('tiny current workArea reduces native minimum constraints and no usable display makes no changes',async()=>{
 const f=await fixture();f.state.displays=[{id:1,primary:true,workArea:{x:-20,y:10,width:200,height:100}}];assert.equal(await f.layout.recover(),true);assert.deepEqual(f.main.normal,{x:-20,y:10,width:200,height:100});assert.deepEqual(f.main.minimum,[200,100]);
 const empty=await fixture();empty.state.displays=[];assert.equal(await empty.layout.recover(),false);assert.equal(empty.main.changes,0);assert.equal([...empty.windows.values()].some(w=>w.changes),false);
});
test('native failure does not prevent independent live windows from recovering and reports incomplete outcome',async()=>{
 const f=await fixture();f.windows.get(f.code.windowId).fail=true;assert.equal(await f.layout.recover(),false);assert.deepEqual(f.windows.get(f.docs.windowId).normal,{x:0,y:40,width:700,height:500});
});
test('native bring-back shortcut is consumed once from the genuine originating window and repeats do not act',async()=>{
 const f=await fixture(),code=f.windows.get(f.code.windowId);code.minimized=true;const focus=new NativeWindowFocus({registry:f.registry,mainWindow:f.main,windowFor:id=>f.windows.get(id),focusedWindow:()=>code,canCycle:()=>true});let pending;const bring=f.layout.bringAllBack.bind(f.layout);f.layout.bringAllBack=origin=>(pending=bring(origin));bindNativeWindowFocusKeys(code,focus,f.layout);let consumed=0;
 const input={type:'keyDown',control:true,alt:true,key:'b'};code.webContents.emit('before-input-event',{preventDefault(){consumed++;}},input);assert.equal(consumed,1);assert.equal(await pending,true);assert.equal(code.minimized,false);assert.deepEqual(code.normal,{x:0,y:40,width:700,height:500});assert.equal(f.main.focuses,1);
 code.webContents.emit('before-input-event',{preventDefault(){consumed++;}},{...input,isAutoRepeat:true});assert.equal(consumed,2);assert.equal(f.main.focuses,1);
});
test('actual display-event binding recovers on removed/geometry metrics only and can be disposed',async()=>{
 assert.equal(typeof implementation.bindNativeDisplayRecovery,'function');const f=await fixture(),screen=new EventEmitter(),dispose=implementation.bindNativeDisplayRecovery(screen,f.layout);let pending;const recover=f.layout.recover.bind(f.layout);f.layout.recover=()=>(pending=recover());
 screen.emit('display-metrics-changed',{}, {},['colorDepth']);assert.equal(f.main.changes,0);
 screen.emit('display-metrics-changed',{}, {},['scaleFactor']);assert.equal(await pending,true);assert.equal(f.main.changes,1);
 f.main.normal={...bounds};screen.emit('display-removed',{},{});assert.equal(await pending,true);assert.equal(f.main.changes,2);dispose();f.main.normal={...bounds};screen.emit('display-removed',{},{});assert.equal(f.main.changes,2);assert.equal(screen.listenerCount('display-removed'),0);
});
test('fullscreen normal geometry is positioned outside fullscreen before that native state is restored',async()=>{
 const f=await fixture(),w=f.windows.get(f.docs.windowId);w.fullscreen=true;const set=w.setBounds.bind(w);w.setBounds=b=>{if(!w.fullscreen)set(b);};
 assert.equal(await f.layout.bringAllBack(),true);assert.deepEqual(w.normal,{x:0,y:40,width:700,height:500});assert.equal(w.fullscreen,true);
});
test('restored minimized native dimensions are read again before explicit rehome',async()=>{
 const f=await fixture(),w=f.windows.get(f.code.windowId);f.state.displays=[{id:1,primary:true,workArea:{x:0,y:40,width:1000,height:800}}];w.minimized=true;w.normal={x:3000,y:3000,width:700,height:500};w.restore=()=>{w.minimized=false;w.normal.width=720;};
 assert.equal(await f.layout.bringAllBack(),true);assert.deepEqual(w.normal,{x:280,y:340,width:720,height:500});assert.equal(w.minimized,false);
});
test('native placement completes in a later turn before maximize can cache the new normal bounds',async()=>{
 const f=await fixture(),w=f.windows.get(f.docs.windowId);w.maximized=true;let pending=false;const set=w.setBounds.bind(w);w.setBounds=b=>{set(b);pending=true;queueMicrotask(()=>{pending=false;});};w.maximize=()=>{if(pending)w.normal={...bounds};w.maximized=true;};
 assert.equal(await f.layout.bringAllBack(),true);assert.deepEqual(w.normal,{x:0,y:40,width:700,height:500});assert.equal(w.maximized,true);
});
test('later native frame replacement cancels a captured target before geometry mutation',async()=>{
 const f=await fixture(),w=f.windows.get(f.code.windowId),set=f.main.setBounds.bind(f.main);f.main.setBounds=b=>{set(b);queueMicrotask(()=>{w.webContents.mainFrame={url:w.webContents.getURL()};});};
 assert.equal(await f.layout.recover(),false);assert.equal(w.changes,0);
});
test('concurrent explicit recovery is refused rather than interleaved into native state transitions',async()=>{
 const f=await fixture(),first=f.layout.bringAllBack();assert.equal(await f.layout.bringAllBack(),false);assert.equal(await first,true);
});


test('native bounds failure conditionally restores fullscreen while reporting incomplete recovery',async()=>{
 const f=await fixture(),w=f.windows.get(f.docs.windowId);w.fullscreen=true;w.fail=true;
 assert.equal(await f.layout.bringAllBack(),false);assert.equal(w.fullscreen,true);assert.deepEqual(w.normal,bounds);
});
test('Lock during a native await never restores fullscreen or reveals a retired handle',async()=>{
 const f=await fixture(),w=f.windows.get(f.docs.windowId);w.fullscreen=true;let exits=0,reentries=0;w.setFullScreen=flag=>{w.fullscreen=flag;if(flag)reentries++;else{exits++;queueMicrotask(()=>{f.state.mode='locked';});}};
 assert.equal(await f.layout.bringAllBack(),false);assert.equal(exits,1);assert.equal(reentries,0);assert.equal(w.changes,0);
});
test('request origin is captured before scheduling and a replaced originating frame cancels the whole operation',async()=>{
 const f=await fixture(),w=f.windows.get(f.code.windowId),pending=f.layout.bringAllBack(w);w.webContents.mainFrame={url:w.webContents.getURL()};
 assert.equal(await pending,false);assert.equal(f.main.changes,0);assert.equal(w.changes,0);assert.equal(f.main.focuses,0);
});
test('controller disposal cancels queued recovery without native mutations or new requests',async()=>{
 const f=await fixture(),pending=f.layout.bringAllBack();f.layout.dispose();
 assert.equal(await pending,false);assert.equal(await f.layout.recover(),false);assert.equal(await f.layout.bringAllBack(),false);assert.equal(f.main.changes,0);assert.equal(f.main.focuses,0);
});
test('superseded display recovery cancels the old result and completes one coalesced latest-workArea operation',async()=>{
 const f=await fixture(),docs=f.windows.get(f.docs.windowId),code=f.windows.get(f.code.windowId);docs.fullscreen=true;code.minimized=true;
 const first=f.layout.recover();f.state.displays=[{id:2,primary:true,workArea:{x:100,y:200,width:800,height:600}}];const second=f.layout.recover();
 f.state.displays=[{id:3,primary:true,workArea:{x:300,y:400,width:900,height:600}}];const third=f.layout.recover();
 assert.equal(second,third,'Only one pending coalesced completion, not an unbounded queue');assert.equal(await first,false);
 assert.equal(await second,true,'A coalesced request must return its own final native completion, not the cancelled predecessor');assert.equal(await third,true);
 for(const w of [f.main,...f.windows.values()])assert.deepEqual(w.normal,{x:300,y:400,width:700,height:500});
 assert.equal(docs.fullscreen,true);assert.equal(code.minimized,true);assert.equal(f.main.focuses,0);
 f.layout.dispose();
});

test('origin retirement during native completion cancels all remaining mutations and main focus',async()=>{
 const f=await fixture(),origin=f.windows.get(f.code.windowId),set=f.main.setBounds.bind(f.main);f.main.setBounds=b=>{set(b);queueMicrotask(()=>{origin.webContents.mainFrame={url:origin.webContents.getURL()};});};
 assert.equal(await f.layout.bringAllBack(origin),false);assert.equal(origin.changes,0);assert.equal(f.windows.get(f.docs.windowId).changes,0);assert.equal(f.main.focuses,0);
});
test('dispose during native completion prevents restoration, following target moves and focus',async()=>{
 const f=await fixture(),set=f.main.setBounds.bind(f.main);f.main.setBounds=b=>{set(b);queueMicrotask(()=>f.layout.dispose());};
 assert.equal(await f.layout.bringAllBack(),false);assert.equal(f.main.changes,1);assert.equal(f.windows.get(f.code.windowId).changes,0);assert.equal(f.windows.get(f.docs.windowId).changes,0);assert.equal(f.main.focuses,0);
});


test('disposing a queued coalesced completion resolves false without leaving a pending listener or moving targets',async()=>{
 const f=await fixture(),first=f.layout.recover(),queued=f.layout.recover();f.layout.dispose();
 assert.equal(await queued,false);assert.equal(await first,false);assert.equal(f.main.changes,0);assert.equal(f.windows.get(f.code.windowId).changes,0);assert.equal(f.windows.get(f.docs.windowId).changes,0);
});
