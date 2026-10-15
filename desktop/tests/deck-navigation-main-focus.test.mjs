// Actual main composition + actual registry/surface/deck service; inert native handles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';
import {NativeDeckNavigation} from '../src/windows/deck-navigation.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const start=main.indexOf('const deckNavigation=new NativeDeckNavigation('),end=main.indexOf('const viewControl=',start);
assert.ok(start>=0&&end>start);
let serial=1;
class Container{children=[];addChildView(v){v.parent?.removeChildView(v);this.children.push(v);v.parent=this;}removeChildView(v){this.children=this.children.filter(x=>x!==v);v.parent=null;}setBounds(){}setVisible(v){this.visible=v;}}
class Contents extends EventEmitter{id=serial++;mainFrame={url:'about:blank'};messages=[];destroyed=false;isDestroyed(){return this.destroyed;}getURL(){return this.mainFrame.url;}send(...a){this.messages.push(a);}focus(){}close(){this.destroyed=true;this.emit('destroyed');}}
class ContentsView extends Container{webContents=new Contents();}
class Shell extends EventEmitter{id=serial++;contentView=new Container();destroyed=false;shown=0;focused=0;isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}hide(){}show(){this.shown++;}focus(){this.focused++;}getContentBounds(){return {width:900,height:650};}destroy(){this.destroyed=true;this.emit('closed');}close(){this.destroy();}}
async function fixture(){
 const host=new Shell();host.webContents=new Contents();host.webContents.mainFrame.url='siren://app/app.html';
 let unlocked=true;const nativeShells=new Map(),surfaces=new Map();
 const registry=new WindowRegistry({authorize:()=>unlocked?{projectId:'project_a',mode:'normal',access:'write',entityIds:['diagram_a','diagram_b']}:null,createWindow:record=>{
  let surface;surface=createWorkspaceSurface({BaseWindow:Shell,WebContentsView:ContentsView,host,isCurrent:()=>Boolean(registry.caller({sender:surface?.webContents,senderFrame:surface?.webContents.mainFrame}))});
  surface.webContents.mainFrame.url=record.mainFrameUrl;nativeShells.set(record.windowId,surface.window);surfaces.set(record.windowId,surface);return surface.window;
 }});
 registry.bindWorkspace(host);registry.activateWorkspace();
 const presenter=await registry.openView({role:'presenter',entityId:'diagram_a'}),editor=await registry.openView({role:'diagram',entityId:'diagram_a'}),peer=await registry.openView({role:'diagram',entityId:'diagram_b'});
 assert.equal(registry.attachView(editor.windowId),true);assert.equal(registry.attachView(peer.windowId),true);
 assert.equal(surfaces.get(editor.windowId).isVisible(),false);
 for(const w of nativeShells.values()){w.shown=0;w.focused=0;}
 const snapshot={project:{id:'project_a'},json:JSON.stringify({diagrams:[{id:'diagram_a',source:'flowchart TD\n A-->B'},{id:'diagram_b',source:'flowchart TD\n C-->D'}]})};
 const context={NativeDeckNavigation,windowRegistry:registry,snapshot,localPin:{state:()=>({unlocked})},pinTransition:false,writes:{},workspaceBarrier:null,accountQuiesced:false,nativeShellFailure:false,selectedId:'project_a',workingEnabled:()=>unlocked,nativeShells,workingDiagrams:{isWorking:g=>g?.role==='diagram'}};
 const service=new vm.Script(main.slice(start,end)+'\ndeckNavigation;').runInNewContext(context);
 const wc=surfaces.get(presenter.windowId).webContents;
 return {registry,nativeShells,surfaces,presenter,editor,peer,host,lock:()=>{unlocked=false;},invoke:()=>service.invoke({event:{sender:wc,senderFrame:wc.mainFrame},method:'edit',payload:{}})};
}
test('Presenter Edit deck selects its existing hidden attached editor instead of showing the empty detached shell',async()=>{
 const f=await fixture(),answer=await f.invoke();assert.equal(answer.ok,true);assert.equal(answer.view.windowId,f.editor.windowId);
 assert.equal(f.registry.surfaceRecords().find(r=>r.selected)?.windowId,f.editor.windowId);
 assert.equal(f.surfaces.get(f.editor.windowId).isVisible(),true);assert.equal(f.surfaces.get(f.peer.windowId).isVisible(),false);
 assert.equal(f.nativeShells.get(f.editor.windowId).shown,0);assert.equal(f.nativeShells.get(f.editor.windowId).focused,0);
 assert.equal(f.surfaces.get(f.editor.windowId).webContents.messages.filter(m=>m[0]==='siren:deck-authoring').length,1);
 assert.equal(f.registry.listViews().length,4);
});
test('Presenter Edit deck reports refusal when genuine registry focus refuses, retaining the existing windows',async()=>{
 const f=await fixture();let focuses=0;f.registry.focusView=()=>{focuses++;return false;};const answer=await f.invoke();
 assert.equal(answer.ok,false);assert.equal(answer.code,'ACCESS_REFUSED');assert.equal(focuses,1);assert.equal(f.registry.listViews().length,4);assert.equal(f.nativeShells.get(f.editor.windowId).shown,0);
});
test('Lock before Presenter Edit deck sends no authoring event and shows no detached editor',async()=>{
 const f=await fixture();f.lock();const answer=await f.invoke();assert.equal(answer.ok,false);assert.equal(answer.code,'ACCESS_REFUSED');
 assert.equal(f.nativeShells.get(f.editor.windowId).shown,0);assert.equal(f.surfaces.get(f.editor.windowId).webContents.messages.length,0);
});
