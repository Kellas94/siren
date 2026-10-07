import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {mkdtemp} from './temporary.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {commitManifest} from '../../src/sources/manifest.mjs';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {invokeSourceRead} from '../../src/windows/source-bridge.mjs';

export async function sourceReadFixture(metadata={workpapers:[{id:'doc-a',private:'PLANTED_DOCS_PRIVATE_CONTENT'}]}){
  const root=await mkdtemp(join(tmpdir(),'siren-source-read-bridge-')),projects=new ProjectStore(root),sources=new SourceRepository(root);
  const first=await projects.createProject({label:'Read-only native bridge',json:'{}'});
  const refs=[];for(const text of ['exact 😀\r\n','foreign secret\n'])refs.push(await sources.importSource({projectId:first.project.id,bytes:Buffer.from(text)}));
  if(typeof metadata==='function')metadata=metadata(refs);
  assert.equal((await commitManifest({projects,repository:sources,projectId:first.project.id,baseRevision:1,sourceRefs:refs,metadata,operationId:'initial-read-bridge'})).ok,true);
  const selected=await projects.readProject(first.project.id),windows=[];let serial=1,unlocked=true,factories=0;
  const registry=new WindowRegistry({authorize:request=>unlocked?{projectId:first.project.id,mode:'readonly',access:request.role==='audience'?'presentation':'read',entityIds:[...refs.map(ref=>ref.sourceId),...(metadata.workpapers??[]).map(v=>v.id),...(metadata.diagrams??[]).map(v=>v.id)]}:null,createWindow:async record=>{
    const window=new EventEmitter();window.id=serial++;let destroyed=false;Object.assign(window,{isDestroyed:()=>destroyed,isMinimized:()=>false,restore(){},focus(){},close:()=>window.destroy(),destroy:()=>{destroyed=true;window.emit('closed');}});
    const wc=window.webContents=new EventEmitter();Object.assign(wc,{id:100+window.id,mainFrame:{url:record.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(window);return window;
  }});
  await registry.openView({role:'code',entityId:refs[0].sourceId});await registry.openView({role:'docs',entityId:'doc-a'});
  const owner=new WorkspaceCoordinator({registry,access:(_grant,scope)=>unlocked&&scope.action==='read',sources:({canWrite})=>{factories++;return new SourceRepository(root,{canWrite});}});
  const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame});
  const invoke=(method,payload,e=event(0))=>invokeSourceRead({event:e,method,payload,registry,owner,referenceFor:(_grant,input)=>refs.find(ref=>ref.sourceId===input.sourceId&&ref.version===input.version)});
  return {root,projects,sources,selected,refs,registry,owner,windows,event,invoke,factories:()=>factories,isUnlocked:()=>unlocked,lock:()=>{unlocked=false;}};
}
