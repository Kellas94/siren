import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';
import {NativeSourceAnalysis} from '../src/windows/source-analysis.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
const source=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const start=source.indexOf("ipcMain.handle('siren:source-analysis',"),end=source.indexOf("ipcMain.handle('siren:source-mutations',",start),guard=source.match(/const nativeWindowAdmissionEnabled=[^\r\n]+/)[0];assert.ok(start>0&&end>start);
const identity=({sourceId,version,sha256})=>({sourceId,version,sha256});
const held=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
async function fixture(t){
 const f=await sourceReadFixture();t.after(()=>rm(f.root,{recursive:true,force:true}));await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});let invoke;const delivered=held(),effects=[];let reads=0;
 const nativeShells=new Map(f.registry.listViews().map(record=>[record.windowId,f.windows.find(view=>f.registry.capture({sender:view.webContents,senderFrame:view.webContents.mainFrame})?.windowId===record.windowId)]));
 for(const view of nativeShells.values()){view.show=()=>effects.push('show');view.focus=()=>effects.push('focus');view.webContents.send=(channel,ticket)=>{assert.equal(channel,'siren:source-comparison-reveal');delivered.resolve(ticket);};}
 const context={ipcMain:{handle:(channel,handler)=>{assert.equal(channel,'siren:source-analysis');invoke=handler;}},windowRegistry:f.registry,workspaceOwner:f.owner,sourceReferenceFor:grant=>identity(f.refs.find(ref=>ref.sourceId===f.registry.sourceScope(grant)?.sourceId)),NativeSourceAnalysis,SourceRepository,sourceAnalysis:null,nativeShells,writes:new Set(),pinTransition:false,accountTransition:false,accountQuiesced:false,nativeShellFailure:false,workspaceBarrier:null,snapshot:f.selected,workingSources:null,selectedCodeMetadata:()=>null,rendererRoot:'inert-renderer-root',join,dataRoot:f.root,writerOptions:{},readOwnedBytes:async()=>{reads++;return Buffer.from(JSON.stringify({sourceAnalysis:{entrySha256:'a'.repeat(64)}}));},console};
 vm.runInNewContext(guard+'\n'+source.slice(start,end),context);t.after(()=>context.sourceAnalysis?.dispose());
 const payload={sourceRef:identity(f.refs[0]),rightWindowId:f.registry.capture(f.event(2)).windowId,rightRef:identity(f.refs[1]),range:{from:0,to:7}};
 return {...f,context,effects,reads:()=>reads,payload,delivered:delivered.promise,invoke:(method,input=payload,event=f.event(0))=>invoke(event,method,input)};
}
test('actual main handler targets existing B, then registry focus occurs only after B completion',async t=>{
 const f=await fixture(t),pending=f.invoke('revealComparison'),ticket=await f.delivered;assert.deepEqual(f.effects,[]);await f.invoke('claimComparison',{requestId:ticket.requestId},f.event(2));await f.invoke('completeComparison',{requestId:ticket.requestId,ok:true},f.event(2));assert.equal((await pending).ok,true);assert.deepEqual(f.effects,['focus']);assert.equal(f.windows.length,3);assert.equal(f.context.writes.size,0);
});
test('actual main admission flags refuse every transition before any navigation metadata read or native effect',async t=>{
 const f=await fixture(t);for(const [object,key] of [[f.context,'pinTransition'],[f.context,'accountTransition'],[f.context,'accountQuiesced'],[f.context,'nativeShellFailure'],[f.context,'workspaceBarrier'],[f.context.writes,'selectionTransition'],[f.context.writes,'selectionQuiesced'],[f.context.writes,'viewClosing']]){object[key]=true;assert.equal((await f.invoke('revealComparison')).code,'ACCESS_REFUSED',key);object[key]=false;}assert.equal(f.reads(),0);assert.deepEqual(f.effects,[]);f.lock();assert.equal((await f.invoke('revealComparison')).code,'ACCESS_REFUSED');
});
test('actual main focus adapter selects hidden attached B and focuses its content without exposing the empty B shell',async()=>{
 let id=100;
 class ChildView{children=[];addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}removeChildView(view){this.children=this.children.filter(item=>item!==view);view.parent=null;}setBounds(){}setVisible(value){this.visible=value;}}
 class Contents extends EventEmitter{id=id++;mainFrame={url:'about:blank'};focused=0;isDestroyed(){return false;}getURL(){return this.mainFrame.url;}focus(){this.focused++;}}
 class ContentsView extends ChildView{webContents=new Contents();}
 class Shell extends EventEmitter{id=id++;contentView=new ChildView();shown=0;focused=0;destroyed=false;isDestroyed(){return this.destroyed;}close(){this.destroy();}destroy(){this.destroyed=true;this.emit('closed');}isMinimized(){return false;}restore(){}show(){this.shown++;}hide(){}focus(){this.focused++;}getContentBounds(){return {width:900,height:650};}}
 const host=new Shell();host.webContents=new Contents();host.webContents.mainFrame.url='siren://app/app.html';const surfaces=[],nativeShells=new Map();
 const registry=new WindowRegistry({authorize:()=>({projectId:'project-a',mode:'normal',access:'write',entityIds:['source-a','source-b']}),createWindow:record=>{let surface;surface=createWorkspaceSurface({BaseWindow:Shell,WebContentsView:ContentsView,host,isCurrent:()=>Boolean(registry.capture({sender:surface.webContents,senderFrame:surface.webContents.mainFrame}))});surface.webContents.mainFrame.url=record.mainFrameUrl;surfaces.push(surface);nativeShells.set(record.windowId,surface.window);return surface.window;}});
 registry.bindWorkspace(host);registry.activateWorkspace();const a=await registry.openView({role:'code',entityId:'source-a'}),b=await registry.openView({role:'code',entityId:'source-b'});assert.equal(registry.attachView(b.windowId),true);assert.equal(registry.attachView(a.windowId),true);assert.equal(surfaces[1].isVisible(),false);
 host.focused=0;surfaces[1].window.shown=0;surfaces[1].webContents.focused=0;
 const focusStart=source.indexOf('focus:(target,scope)=>{',start),focusEnd=source.indexOf('\n    }}});',focusStart);assert.ok(focusStart>start&&focusEnd>focusStart);
 const focus=vm.runInNewContext('('+source.slice(focusStart+'focus:'.length,focusEnd)+'\n})',{nativeShells,windowRegistry:registry,nativeWindowAdmissionEnabled:()=>true});
 const target=registry.capture({sender:surfaces[1].webContents,senderFrame:surfaces[1].webContents.mainFrame}),guard=registry.captureAdmissionGuard(target);
 assert.equal(focus(target,guard),true);assert.equal(surfaces[1].isVisible(),true);assert.equal(surfaces[0].isVisible(),false);assert.equal(surfaces[1].window.shown,0);assert.equal(host.focused,1);assert.equal(surfaces[1].webContents.focused,1);
});
