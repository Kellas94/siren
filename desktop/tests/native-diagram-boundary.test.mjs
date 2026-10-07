import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {diagramContext} from './fixtures/diagram-context.mjs';
import {workspaceEntities} from '../src/windows/entities.mjs';
import {NativeReadonlyViewSeals} from '../src/windows/readonly-seals.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeViewControl} from '../src/windows/control.mjs';
import {NativeWorkspaceBarrier} from '../src/windows/source-barrier.mjs';
import {resolveLocalResource} from '../src/protocol.mjs';
import {allowedAppFile} from '../scripts/package.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {EventEmitter} from 'node:events';
import {invokeHomeWindow} from '../src/windows/home-admission.mjs';
import {NativeWindowCatalog} from '../src/windows/catalog.mjs';
import {nativeViewFactory} from '../src/windows/factory.mjs';

test('only primary active diagram IDs enter the native roster, never cached or released diagrams',async()=>{
 const f=await diagramContext();
 assert.deepEqual(workspaceEntities(f.selected).diagram,['diagram-a','diagram-b']);
 const bag=JSON.parse(f.selected.json);bag.diagrams=[{id:'foreign-direct'}];bag.storage['backup']=JSON.stringify({diagrams:[{id:'foreign-backup'}]});
 const active=JSON.parse(bag.storage['t-industries-siren-v23-state']);active.releases=[{diagrams:[{id:'foreign-release'}]}];bag.storage['t-industries-siren-v23-state']=JSON.stringify(active);
 assert.deepEqual(workspaceEntities({...f.selected,json:JSON.stringify(bag)}).diagram,['diagram-a','diagram-b']);
 assert.deepEqual(workspaceEntities({...f.selected,json:JSON.stringify({kind:'siren-desktop',storage:{backup:JSON.stringify(active)}})}),{code:[],docs:[],diagram:[]});
});

test('native Diagram entry is finite, package admitted and rejects borrowed selectors/traversal',async()=>{
 const f=await diagramContext(),url=f.event(0).senderFrame.url;
 const {mkdir}=await import('node:fs/promises');await mkdir(join(f.root,'windows'));await writeFile(join(f.root,'windows','diagram.html'),'owned selected diagram');
 assert.equal(await resolveLocalResource({url,rendererRoot:f.root}),join(f.root,'windows','diagram.html'));
 assert.equal(allowedAppFile('generated/windows/diagram.html',new Set()),true);
 assert.equal(allowedAppFile('src/windows/diagram-reads.mjs',new Set()),true);
 for(const refused of [url+'&entityId=diagram-b',url.replace('?windowId=','?projectId='),url.replace('diagram.html','other.html'),url.replace('windows/diagram','windows/%2e%2e/diagram')])await assert.rejects(resolveLocalResource({url:refused,rendererRoot:f.root}));
});

test('Home catalog exposes selected diagram metadata only and admission opens a genuine independent shell',async()=>{
 const f=await diagramContext(),primary=new EventEmitter(),wc=primary.webContents=new EventEmitter();
 Object.assign(primary,{id:900,isDestroyed:()=>false});Object.assign(wc,{id:901,mainFrame:{url:'siren://app/home.html'},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false});f.registry.bindWorkspace(primary);f.registry.activateWorkspace({entryUrl:wc.getURL()});
 const event={sender:wc,senderFrame:wc.mainFrame},catalog=new NativeWindowCatalog({registry:f.registry,snapshotFor:()=>f.selected}),listed=await catalog.invoke({event,payload:{role:'diagram'}});
 assert.equal(listed.ok,true);assert.deepEqual(listed.items.map(row=>row.entityId),['diagram-a','diagram-b']);assert.equal(JSON.stringify(listed).includes('PRIVATE'),false);assert.equal(JSON.stringify(listed).includes('ff3366'),false);
 const result=await invokeHomeWindow({event,payload:{role:'diagram',entityId:'diagram-b'},registry:f.registry,snapshot:f.selected});assert.equal(result.ok,true);assert.deepEqual(f.registry.capturePrimary(event).entityIds,[]);
 for(const payload of [{role:'diagram',entityId:'diagram-b',version:1},{role:'diagram',entityId:'doc-a'},{role:'diagram',entityId:'diagram-b',projectId:f.selected.project.id}])assert.equal((await invokeHomeWindow({event,payload,registry:f.registry,snapshot:f.selected})).ok,false);
 let created;class Boundary extends EventEmitter{constructor(options){super();this.options=options;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>false,setWindowOpenHandler:fn=>this.popup=fn});created=this;}isDestroyed(){return false;}async loadURL(url){this.webContents.mainFrame.url=url;}}
 const factory=nativeViewFactory({BrowserWindow:Boundary,displays:()=>[{id:1,workArea:{x:0,y:0,width:1280,height:800}}],preload:'/owned/preload.cjs'});
 await factory({role:'diagram',windowId:result.view.windowId,mainFrameUrl:'siren://app/windows/diagram.html?windowId='+result.view.windowId});assert.equal(created.options.show,false);assert.equal(Object.hasOwn(created.options,'parent'),false);assert.equal(created.options.webPreferences.nodeIntegration,false);assert.deepEqual(created.popup(),{action:'deny'});
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});

test('readonly Diagram issues genuine exact byte seals and joins the all-view preparation barrier',async()=>{
 const f=await diagramContext(),seals=new NativeReadonlyViewSeals({registry:f.registry,isReadonly:()=>true,snapshotFor:()=>f.projects.readProject(f.selected.project.id),sources:()=>f.sources});
 const diagram=f.registry.capture(f.event(0)),receipt=await seals.seal(diagram,{isCurrent:()=>true});
 assert.deepEqual(receipt,{ok:true,domain:'diagram',purpose:'readonly',entityId:'diagram-a',version:1,sha256:digest(Buffer.from(JSON.stringify(f.workspace.diagrams[0]))),projectRevision:f.selected.revision,durability:'readonly'});
 assert.equal(await seals.verify(f.registry.capture(f.event(0)),receipt,{isCurrent:()=>true}),true);
 assert.equal(await seals.verify(f.registry.capture(f.event(0)),{...receipt},{isCurrent:()=>true}),false);
 assert.equal(JSON.stringify(receipt).includes('Exact colour'),false);
 // Real roster contains Code/Docs too. Their native read-only proofs must still
 // work; admit an explicit source version instead of an unversioned grant.
 f.registry.discardView(f.registry.capture(f.event(2)).windowId);await f.registry.openView({role:'code',entityId:f.ref.sourceId,version:1});
 const owner=new WorkspaceCoordinator({registry:f.registry,domains:f.domains,sources:()=>f.sources,readonlyViews:seals,access:()=>true});
 let control;control=new NativeViewControl({registry:f.registry,owner,send:(event,request)=>{void control.acknowledge(event,{requestId:request.requestId,ok:true});}});
 const barrier=new NativeWorkspaceBarrier({registry:f.registry,owner,control,cover:()=>{}});
 try{const prepared=await barrier.prepare('lock');assert.equal(prepared.ok,true);assert.ok(prepared.proof.refs.some(ref=>ref.domain==='diagram'&&ref.sha256===receipt.sha256));assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal(barrier.release(prepared.proof),true);}
 finally{barrier.dispose();control.dispose();}
 f.lock();assert.equal(await seals.verify(diagram,receipt,{isCurrent:()=>true}),false);
});
