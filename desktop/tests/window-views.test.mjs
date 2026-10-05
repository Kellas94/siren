import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';

let id=100;
class View{
 children=[];visible=true;
 addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}
 removeChildView(view){this.children=this.children.filter(v=>v!==view);view.parent=null;}
 setBounds(value){this.bounds=value;}setVisible(value){this.visible=value;}
}
class Contents extends EventEmitter{
 id=id++;destroyed=false;mainFrame={url:'about:blank'};draft='independent';selection={anchor:3,head:7};history=['original'];
 isDestroyed(){return this.destroyed;}getURL(){return this.mainFrame.url;}focus(){this.focused=true;}
 close(){this.destroyed=true;this.emit('destroyed');}
}
class ContentsView extends View{webContents=new Contents();}
class Window extends EventEmitter{
 id=id++;contentView=new View();destroyed=false;visible=false;minimized=false;
 isDestroyed(){return this.destroyed;}isMinimized(){return this.minimized;}restore(){this.minimized=false;}
 focus(){this.focused=true;}hide(){this.visible=false;}show(){this.visible=true;}
 getContentBounds(){return {width:1000,height:800};}destroy(){this.destroyed=true;this.emit('closed');}close(){this.destroy();}
}
async function fixture({diagram=false}={}){
 const host=new Window();host.webContents=new Contents();host.webContents.mainFrame.url='siren://app/app.html';
 const surfaces=new Map(),entities=new Set(['code_a','doc_a',...(diagram?['diagram_a']:[])]);let allowed=true;
 const registry=new WindowRegistry({authorize:request=>{if(!allowed||request.entityId!==null&&!entities.has(request.entityId))throw Error('retired');return {projectId:'project_a',mode:'normal',access:'write',entityIds:request.entityId===null?[]:[request.entityId]};},
 createWindow:options=>{let surface;surface=createWorkspaceSurface({BaseWindow:Window,WebContentsView:ContentsView,host,isCurrent:()=>!!registry.capture({sender:surface.webContents,senderFrame:surface.webContents.mainFrame})});surface.webContents.mainFrame.url=options.mainFrameUrl;surfaces.set(options.windowId,surface);return surface.window;}});
 registry.bindWorkspace(host);registry.activateWorkspace();
 const code=await registry.openView({role:'code',entityId:'code_a'}),docs=await registry.openView({role:'docs',entityId:'doc_a'});
 const diagramView=diagram?await registry.openView({role:'diagram',entityId:'diagram_a'}):null;
 return {host,registry,surfaces,code,docs,diagram:diagramView,retire:()=>{allowed=false;},retireEntity:entity=>entities.delete(entity)};
}

test('shared shelf names only current owned native views and reports real minimized state without source reads',async()=>{
 const {invokeDock}=await import('../src/windows/dock-ipc.mjs'),f=await fixture({diagram:true});
 try{
 const code=f.surfaces.get(f.code.windowId),docs=f.surfaces.get(f.docs.windowId),diagram=f.surfaces.get(f.diagram.windowId);
 let codeReads=0,peerReads=0;
 code.webContents.getTitle=()=>{codeReads++;return 'SIREN — ⌘ Code — agent Ș😀.py · v3 · Working copy · Unsaved';};
 docs.webContents.getTitle=()=>{peerReads++;return 'SIREN — Docs — Agent notes · r4 · Read only';};
 diagram.webContents.getTitle=()=>{peerReads++;return 'SIREN — Diagrams — Flow · v2 · Read only';};
 code.window.minimized=true;
 const event={sender:code.webContents,senderFrame:code.webContents.mainFrame};
 const own=invokeDock({registry:f.registry,event,method:'getShelf'});
 assert.equal(own.ok,true);assert.equal(own.items.length,1);assert.equal(peerReads,0);assert.equal(codeReads,1);
 assert.equal(own.items[0].label,'⌘ Code · agent Ș😀.py · v3 · Working copy · Unsaved');assert.equal(own.items[0].state,'minimized');
 assert.equal(Object.hasOwn(own.items[0],'draft'),false);assert.equal(JSON.stringify(own).includes('independent'),false);
 const main=invokeDock({registry:f.registry,event:{sender:f.host.webContents,senderFrame:f.host.webContents.mainFrame},method:'getShelf'});
 assert.deepEqual(main.items.map(row=>row.label),[own.items[0].label,'Docs · Agent notes · r4 · Read only','Diagrams · Flow · v2 · Read only']);
 assert.equal(f.registry.focusView(f.code.windowId),true);assert.equal(f.registry.surfaceSummary(f.code.windowId).state,'open');
 code.window.minimized=true;assert.equal(f.registry.attachView(f.code.windowId),true);assert.equal(code.window.minimized,true);
 assert.equal(f.registry.surfaceSummary(f.code.windowId).state,'open','Visible attachment does not inherit hidden shell minimization');
 f.host.minimized=true;assert.equal(f.registry.surfaceSummary(f.code.windowId).state,'minimized');f.host.minimized=false;
 f.retireEntity('code_a');const reads=codeReads;assert.equal(f.registry.surfaceSummary(f.code.windowId),null);assert.equal(codeReads,reads);
 }finally{await f.registry.invalidateEpochAsync({preserveWorkspace:true});}
});

test('title metadata cannot cross a retired grant, navigate a view or execute getters in IPC payloads',async()=>{
 const {invokeDock}=await import('../src/windows/dock-ipc.mjs'),f=await fixture();
 try{
 const code=f.surfaces.get(f.code.windowId),event={sender:code.webContents,senderFrame:code.webContents.mainFrame};
 let called=false;const payload={get windowId(){called=true;return f.docs.windowId;}};
 assert.equal(invokeDock({registry:f.registry,event,method:'getShelf',payload}).code,'REQUEST_REFUSED');assert.equal(called,false);
 code.webContents.getTitle=()=>{f.retire();return 'SIREN — ⌘ Code — SECRET_RETIRED';};
 const result=invokeDock({registry:f.registry,event,method:'getShelf'});assert.equal(result.code,'ACCESS_REFUSED');assert.equal(JSON.stringify(result).includes('SECRET'),false);
 }finally{await f.registry.invalidateEpochAsync({preserveWorkspace:true});}
});

test('Diagram docking retains its renderer and captured grant while refusing borrowed IDs and stale peers',async()=>{
 const {invokeDock}=await import('../src/windows/dock-ipc.mjs'),f=await fixture({diagram:true});
 try{
 const diagram=f.surfaces.get(f.diagram.windowId),code=f.surfaces.get(f.code.windowId),own={sender:diagram.webContents,senderFrame:diagram.webContents.mainFrame};
 const grant=f.registry.capture(own),frame=diagram.webContents.mainFrame;
 diagram.webContents.draft='flowchart TD\nA[Unsaved] --> B[Exact]';
 assert.equal(invokeDock({registry:f.registry,event:own,method:'attach',payload:{windowId:f.diagram.windowId}}).ok,true);
 assert.equal(diagram.placement(),'attached');assert.equal(diagram.webContents.mainFrame,frame);assert.equal(f.registry.isCurrent(grant),true);
 assert.deepEqual(invokeDock({registry:f.registry,event:own,method:'getShelf'}).items,[{windowId:f.diagram.windowId,role:'diagram',entityId:'diagram_a',placement:'attached',selected:true,label:'Diagrams · diagram_',state:'open'}]);
 assert.equal(invokeDock({registry:f.registry,event:own,method:'detach',payload:{windowId:f.code.windowId}}).code,'ACCESS_REFUSED');
 assert.equal(f.registry.attachView(f.code.windowId),true);assert.equal(diagram.view.visible,false);assert.equal(code.view.visible,true);
 assert.equal(f.registry.focusView(f.diagram.windowId),true);assert.equal(code.view.visible,false);assert.equal(diagram.webContents.draft,'flowchart TD\nA[Unsaved] --> B[Exact]');
 assert.equal(invokeDock({registry:f.registry,event:own,method:'detach',payload:{windowId:f.diagram.windowId}}).ok,true);assert.equal(diagram.window.visible,true);
 assert.equal(f.registry.attachView(f.diagram.windowId),true);f.retireEntity('diagram_a');assert.equal(f.registry.attachView(f.docs.windowId),false);
 assert.equal(invokeDock({registry:f.registry,event:own,method:'getShelf'}).code,'ACCESS_REFUSED');
 }finally{await f.registry.invalidateEpochAsync({preserveWorkspace:true});}
});
test('two attached native views retain independent renderer draft/selection/history and only the selected one is visible',async()=>{
 const f=await fixture(),code=f.surfaces.get(f.code.windowId),docs=f.surfaces.get(f.docs.windowId);
 const identity=[code.webContents,code.webContents.mainFrame,code.webContents.selection,code.webContents.history];
 code.webContents.draft='edited Code';docs.webContents.draft='edited Docs';
 assert.equal(f.registry.attachView(f.code.windowId),true);assert.equal(f.registry.attachView(f.docs.windowId),true);
 assert.equal(code.view.visible,false);assert.equal(docs.view.visible,true);assert.equal(code.window.visible,false);assert.equal(docs.window.visible,false);
 assert.equal(f.registry.focusView(f.code.windowId),true);assert.equal(code.view.visible,true);assert.equal(docs.view.visible,false);
 assert.deepEqual([code.webContents,code.webContents.mainFrame,code.webContents.selection,code.webContents.history],identity);
 assert.equal(code.webContents.draft,'edited Code');assert.equal(docs.webContents.draft,'edited Docs');
 assert.equal(f.registry.detachView(f.code.windowId),true);assert.equal(code.window.visible,true);assert.deepEqual(code.view.bounds,{x:0,y:0,width:1000,height:800});
 assert.equal(docs.view.visible,false);await f.registry.invalidateEpochAsync({preserveWorkspace:true});
});
test('a stale attached peer refuses a new attachment before changing native ownership or visibility',async()=>{
 const f=await fixture(),code=f.surfaces.get(f.code.windowId),docs=f.surfaces.get(f.docs.windowId);
 assert.equal(f.registry.attachView(f.docs.windowId),true);f.retireEntity('doc_a');
 assert.equal(f.registry.attachView(f.code.windowId),false);assert.equal(code.placement(),'detached');
 assert.equal(docs.view.visible,true);assert.equal(f.host.contentView.children.length,1);
 await f.registry.invalidateEpochAsync({preserveWorkspace:true});
});
test('release of a preparation roster and focusing an attached view catch up a host resize without reattachment',async()=>{
 const f=await fixture(),surface=f.surfaces.get(f.code.windowId);assert.equal(f.registry.attachView(f.code.windowId),true);
 const roster=f.registry.freezeRoster();f.host.getContentBounds=()=>({width:1120,height:700});
 assert.equal(f.registry.resizeAttached(),false);assert.equal(f.registry.releaseRoster(roster),true);
 assert.equal(f.registry.focusView(f.code.windowId),true);assert.deepEqual(surface.view.bounds,{x:0,y:102,width:1120,height:598});
 await f.registry.invalidateEpochAsync({preserveWorkspace:true});
});
test('returning to the main workspace hides attached pixels without navigating or discarding them',async()=>{
 const f=await fixture(),surface=f.surfaces.get(f.code.windowId),frame=f.host.webContents.mainFrame;
 assert.equal(f.registry.attachView(f.code.windowId),true);assert.equal(f.registry.showWorkspace(),true);
 assert.equal(surface.view.visible,false);assert.equal(surface.placement(),'attached');assert.equal(f.host.webContents.mainFrame,frame);
 assert.equal(f.registry.focusView(f.code.windowId),true);assert.equal(surface.view.visible,true);
 const rows=f.registry.surfaceRecords();assert.equal(rows.length,2);assert.equal(rows.find(r=>r.windowId===f.code.windowId).selected,true);
 assert.equal(Object.hasOwn(rows[0],'draft'),false);await f.registry.invalidateEpochAsync({preserveWorkspace:true});
});
test('retired grants and a frozen writer roster refuse movement or activation before native changes',async()=>{
 for(const kind of ['policy','roster']){
 const f=await fixture(),surface=f.surfaces.get(f.code.windowId);const before=surface.webContents.mainFrame;
 if(kind==='policy')f.retire();else f.registry.freezeRoster();
 for(const method of ['attachView','detachView','focusView'])assert.equal(f.registry[method](f.code.windowId),false,method);
 assert.equal(surface.placement(),'detached');assert.equal(surface.webContents.mainFrame,before);
 await f.registry.invalidateEpochAsync({preserveWorkspace:true});
 }
});
test('dock IPC derives actual caller identity and rejects borrowed IDs, getters, subframes and revoked grants',async()=>{
 const {invokeDock}=await import('../src/windows/dock-ipc.mjs'),f=await fixture();
 const event={sender:f.host.webContents,senderFrame:f.host.webContents.mainFrame};
 const code=f.surfaces.get(f.code.windowId),own={sender:code.webContents,senderFrame:code.webContents.mainFrame};
 const invoke=(method,payload,e=event)=>invokeDock({registry:f.registry,event:e,method,payload});
 assert.equal((await invoke('attach',{windowId:f.code.windowId})).ok,true);
 assert.equal((await invoke('getShelf')).items.length,2);
 assert.equal((await invoke('getShelf',undefined,own)).items.length,1);
 assert.equal((await invoke('detach',{windowId:f.docs.windowId},own)).code,'ACCESS_REFUSED');
 let touched=false;const attack={get windowId(){touched=true;return f.code.windowId;}};
 assert.equal((await invoke('attach',attack)).code,'REQUEST_REFUSED');assert.equal(touched,false);
 assert.equal((await invoke('attach',{windowId:f.code.windowId,epoch:1})).code,'REQUEST_REFUSED');
 assert.equal((await invoke('getShelf',undefined,{sender:code.webContents,senderFrame:{url:code.webContents.getURL()}})).code,'ACCESS_REFUSED');
 assert.equal((await invoke('showWorkspace')).ok,true);assert.equal(code.view.visible,false);
 f.retire();assert.equal((await invoke('detach',{windowId:f.code.windowId})).code,'ACCESS_REFUSED');
 await f.registry.invalidateEpochAsync({preserveWorkspace:true});
});
