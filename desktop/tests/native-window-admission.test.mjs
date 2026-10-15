import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {nativeViewFactory} from '../src/windows/factory.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';
import {invokeWindow} from '../src/windows/ipc.mjs';
import {failure} from '../src/ipc.mjs';

// Actual main admission handler, actual registry/factory, inert owned windows.
// These are source composition controls, never Electron/native timing proof.
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const start=main.indexOf('const invokeNativeWindow='),end=main.indexOf("ipcMain.handle('siren:window-dock'",start);
assert.ok(start>=0&&end>start,'Actual main admission boundary missing');
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function fixture({surface=false,holdClose=false,failClose=false}={}){
 let serial=1,held=null,failDestroy=false,onReady=()=>{},onShow=()=>{};const windows=[],nativeShells=new Map(),handlers=new Map(),closeEntered=deferred();
 class View{
  children=[];addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}
  removeChildView(view){this.children=this.children.filter(item=>item!==view);view.parent=null;}
  setBounds(){}setVisible(){}
 }
 const contents=()=>{const wc=new EventEmitter();wc.id=serial+++100;wc.destroyed=false;wc.mainFrame={url:''};wc.getURL=()=>wc.mainFrame.url;wc.isDestroyed=()=>wc.destroyed;wc.setWindowOpenHandler=()=>{};wc.focus=()=>{};wc.send=()=>{};
  wc.loadURL=async url=>{wc.mainFrame.url=url;if(held)await held;};wc.complete=()=>{wc.destroyed=true;wc.emit('destroyed');};
  wc.close=()=>{closeEntered.resolve();if(failClose)throw Error('Controlled contents refusal');if(!holdClose)wc.complete();};return wc;};
 class ContentsView extends View{webContents=contents();}
 class Window extends EventEmitter{
  destroyed=false;shown=false;ready=0;contentView=new View();
  constructor(options={}){super();this.options=options;this.id=serial++;windows.push(this);this.webContents=contents();}
  isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}focus(){}close(){this.destroy();}
  getContentBounds(){return {width:1000,height:800};}hide(){this.shown=false;}
  destroy(){if(failDestroy&&this.options.show===false)throw Error('Controlled destruction refusal');this.destroyed=true;this.webContents.complete();this.emit('closed');}
  show(){this.shown=true;onShow();}
  async loadURL(url){this.webContents.mainFrame.url=url;if(held)await held;}
 }
 const owner=new Window();owner.webContents.mainFrame.url='siren://app/app.html';
 const context={initializeTerminalCandidate:null,terminalRuntime:null,pinTransition:false,accountTransition:false,accountQuiesced:false,workspaceBarrier:null,nativeShellFailure:false,writes:new Set(),nativeShells,invokeWindow,failure,
  invokeHomeWindow:()=>{throw Error('Home route outside this fixture');},snapshot:{},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}};
 const create=nativeViewFactory({BrowserWindow:Window,displays:()=>[{id:1,primary:true,workArea:{x:0,y:0,width:1000,height:800}}],preload:'/owned/preload.cjs',
  createSurface:surface?options=>createWorkspaceSurface({...options,BaseWindow:Window,WebContentsView:ContentsView,host:owner,isCurrent:()=>!context.pinTransition,onFailure:()=>{context.nativeShellFailure=true;}}):undefined,
  onCreated:(window,record)=>{nativeShells.set(record.windowId,window);window.webContents.send=()=>{window.ready++;onReady();};}});
 // The original main has no wrapper. When present, execute its literal helper
 // around the same genuine factory; never substitute an admission boolean.
 const guardStart=main.indexOf('const nativeWindowAdmissionEnabled='),guardEnd=main.indexOf('const windowRegistry =',guardStart);
 let guarded=create;if(guardStart>=0){guarded=vm.runInNewContext(main.slice(guardStart,guardEnd)+'guardNativeFactory;',context)(create);}
 const registry=new WindowRegistry({authorize:()=>context.accountQuiesced||context.writes.selectionQuiesced?null:{projectId:'owned_project',mode:'normal',access:'write',entityIds:['doc_a','doc_b']},createWindow:guarded});
 context.window=owner;
 registry.bindWorkspace(owner);registry.activateWorkspace();context.windowRegistry=registry;vm.runInNewContext(main.slice(start,end),context);
 const admissions=[],openActual=registry.openView.bind(registry);registry.openView=async value=>{const record=await openActual(value);const child=nativeShells.get(record.windowId);admissions.push(registry.capture({sender:child.webContents,senderFrame:child.webContents.mainFrame}));return record;};
 const event=()=>({sender:owner.webContents,senderFrame:owner.webContents.mainFrame});
 return {context,owner,windows,registry,admissions,closeEntered:closeEntered.promise,hold:promise=>{held=promise;},failDestroy:()=>{failDestroy=true;},onReady:fn=>{onReady=fn;},onShow:fn=>{onShow=fn;},open:(entityId='doc_a')=>handlers.get('siren:windows')(event(),'openView',{role:'docs',entityId})};
}
test('valid current native open sends ready and shows exactly its genuine registered window',async()=>{
 const f=fixture(),result=await f.open();assert.equal(result.ok,true);assert.equal(f.windows[1].ready,1);assert.equal(f.windows[1].shown,true);assert.equal(f.registry.listViews().length,2);
});
for(const [container,key]of [['context','pinTransition'],['context','accountTransition'],['context','accountQuiesced'],['context','workspaceBarrier'],['context','nativeShellFailure'],['writes','selectionTransition'],['writes','selectionQuiesced'],['writes','viewClosing']]){
 test('held native factory refuses late '+key+' before ready/show',async()=>{
  const f=fixture(),held=deferred();f.hold(held.promise);const pending=f.open();assert.equal(f.windows.length,2);
  (container==='writes'?f.context.writes:f.context)[key]=true;held.resolve();const result=await pending;
  assert.equal(result.ok,false);assert.equal(f.windows[1].ready,0);assert.equal(f.windows[1].shown,false);assert.equal(f.windows[1].destroyed,true);assert.equal(f.registry.listViews().length,1);
 });
}
test('late factory destruction refusal returns failure and retains the admission fence',async()=>{
 const f=fixture(),held=deferred();f.hold(held.promise);const pending=f.open();f.context.pinTransition=true;f.failDestroy();held.resolve();
 const result=await pending;assert.equal(result.code,'WINDOW_DESTROY_FAILED');assert.equal(f.windows[1].ready,0);assert.equal(f.windows[1].shown,false);assert.equal(f.windows[1].destroyed,false);
 f.context.pinTransition=false;assert.equal((await f.open('doc_b')).code,'PROJECT_BUSY');assert.equal(f.windows.length,2);
});
test('ready callback transition prevents show and returns refusal after actual discard',async()=>{
 const f=fixture();f.onReady(()=>{f.context.pinTransition=true;});const result=await f.open();assert.equal(result.ok,false);assert.equal(f.windows[1].ready,1);assert.equal(f.windows[1].shown,false);assert.equal(f.windows[1].destroyed,true);
});
test('show callback retirement cannot publish a successful open receipt',async()=>{
 const f=fixture();f.onShow(()=>{f.context.accountTransition=true;});const result=await f.open();assert.equal(result.ok,false);assert.equal(f.windows[1].destroyed,true);assert.equal(f.registry.listViews().length,1);
});
test('a completed registry roster freeze/release never revives its older pending factory',async()=>{
 const f=fixture(),held=deferred();f.hold(held.promise);const pending=f.open(),roster=f.registry.freezeRoster();assert.equal(f.registry.releaseRoster(roster),true);held.resolve();const result=await pending;
 assert.equal(result.ok,false);assert.equal(f.windows[1].ready,0);assert.equal(f.windows[1].shown,false);assert.equal(f.windows[1].destroyed,true);
});
test('successful late discard permits a separately requested fresh open after rollback',async()=>{
 const f=fixture(),held=deferred();f.hold(held.promise);const pending=f.open();f.context.pinTransition=true;held.resolve();assert.equal((await pending).ok,false);
 f.context.pinTransition=false;f.hold(null);const result=await f.open('doc_b');assert.equal(result.ok,true);assert.equal(f.windows[2].ready,1);assert.equal(f.windows[2].shown,true);assert.equal(f.windows[1].destroyed,true);
});
test('transition refusal occurs before the registry can return any child admission grant',async()=>{
 const f=fixture(),held=deferred();f.hold(held.promise);const pending=f.open();f.context.pinTransition=true;held.resolve();assert.equal((await pending).ok,false);assert.deepEqual(f.admissions,[]);assert.equal(f.windows[1].destroyed,true);
});
test('genuine surface refusal retains its actual contents disposal until settlement without a grant',{timeout:5000},async()=>{
 const f=fixture({surface:true,holdClose:true}),held=deferred();f.hold(held.promise);const pending=f.open();f.context.pinTransition=true;held.resolve();await f.closeEntered;
 try{
  const child=f.windows[1];assert.equal(f.registry.capture({sender:child.webContents,senderFrame:child.webContents.mainFrame}),null);assert.deepEqual(f.admissions,[]);assert.equal(child.ready,0);assert.equal(child.shown,false);assert.equal(child.destroyed,false);
  f.context.pinTransition=false;assert.equal((await f.open('doc_b')).ok,false);assert.equal(f.windows.length,2);
 }finally{f.windows[1].webContents.complete();}
 assert.equal((await pending).ok,false);assert.equal(f.windows[1].destroyed,true);
});
test('genuine surface disposal refusal remains retained and fences every later open',async()=>{
 const f=fixture({surface:true,failClose:true}),held=deferred();f.hold(held.promise);const pending=f.open();f.context.pinTransition=true;held.resolve();assert.equal((await pending).code,'WINDOW_DESTROY_FAILED');assert.deepEqual(f.admissions,[]);assert.equal(f.windows[1].destroyed,false);assert.equal(f.windows[1].ready,0);assert.equal(f.windows[1].shown,false);
 f.context.pinTransition=false;assert.equal((await f.open('doc_b')).code,'PROJECT_BUSY');assert.equal(f.windows.length,2);
});
