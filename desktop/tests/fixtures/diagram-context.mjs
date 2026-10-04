import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './temporary.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {DomainRepository} from '../../src/windows/domain.mjs';
import {workspaceMetadata} from '../../src/windows/entities.mjs';

export async function diagramContext(){
 const root=await mkdtemp(join(tmpdir(),'siren-native-diagram-')),projects=new ProjectStore(root),sources=new SourceRepository(root);
 const initial=await projects.createProject({label:'Native diagram scope',json:'{}'}),ref=await sources.importSource({projectId:initial.project.id,bytes:Buffer.from('PRIVATE_PYTHON_SOURCE')});
 const workspace={diagrams:[{id:'diagram-a',name:'Chosen flow',source:'flowchart TD\nA[Exact colour]-->B\nstyle A fill:#ff3366',sirenNativeVersion:1},{id:'diagram-b',name:'Other diagram',source:'sequenceDiagram\nA->>B: PRIVATE_OTHER_DIAGRAM'}],workpapers:[{id:'doc-a',title:'PRIVATE_DOCS',agent:{private:'PRIVATE_AGENT'}}]};
 assert.equal((await commitManifest({projects,repository:sources,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata:{kind:'siren-desktop',schema:1,storage:{'t-industries-siren-v23-state':JSON.stringify(workspace),other:'PRIVATE_UNRELATED'}},operationId:'native-diagram-fixture'})).ok,true);
 let selected=await projects.readProject(initial.project.id),unlocked=true;const windows=[];
 const registry=new WindowRegistry({authorize:()=>unlocked?{projectId:initial.project.id,mode:'readonly',access:'read',entityIds:['diagram-a','diagram-b','doc-a',ref.sourceId]}:null,createWindow:async options=>{
  const native=new EventEmitter();native.id=windows.length+1;let destroyed=false;native.isDestroyed=()=>destroyed;native.isMinimized=()=>false;native.restore=()=>{};native.focus=()=>{};native.close=()=>native.destroy();native.destroy=()=>{destroyed=true;native.webContents.emit('destroyed');native.emit('closed');};
  const wc=native.webContents=new EventEmitter();Object.assign(wc,{id:100+native.id,mainFrame:{url:options.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(native);return native;
 }});
 await registry.openView({role:'diagram',entityId:'diagram-a'});await registry.openView({role:'docs',entityId:'doc-a'});await registry.openView({role:'code',entityId:ref.sourceId});
 const domains=new DomainRepository({projects:()=>new ProjectStore(root,{canSave:()=>false}),sources:()=>new SourceRepository(root,{canWrite:()=>false}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry,domains,sources:()=>new SourceRepository(root,{canWrite:()=>false}),access:(_grant,scope)=>unlocked&&scope.action==='read-domain'&&scope.domain==='diagram'});
 const event=index=>({sender:windows[index].webContents,senderFrame:windows[index].webContents.mainFrame});
 return {root,projects,sources,selected,workspace,ref,registry,owner,domains,windows,event,lock:()=>{unlocked=false;},setSelected:value=>selected=value,diagramFor:(_grant,id)=>workspaceMetadata(selected).diagrams.find(diagram=>diagram.id===id)};
}
