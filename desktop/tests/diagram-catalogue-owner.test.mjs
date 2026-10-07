import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {diagramContext} from './fixtures/diagram-context.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
const request={entryId:'starter:flowchart',title:'New separate diagram',operationId:'owner-create-b'};
const intent=payload=>({kind:'catalogue',method:'appendDiagram',payload});
async function fixture({maxPending=64,maxQueueBytes=16*1024*1024,project=true}={}){
 assert.equal(typeof WindowRegistry.prototype.captureAdmissionGuard,'function');
 const base=await diagramContext();let selected=base.selected,allow=true,working=true,beforeAppend=async()=>{},appendOverride=null;const windows=[];
 function native(url){const w=new EventEmitter();w.id=windows.length+1;let destroyed=false;w.isDestroyed=()=>destroyed;w.isMinimized=()=>false;w.focus=()=>{};w.restore=()=>{};w.destroy=()=>{destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.close=w.destroy;const wc=w.webContents=new EventEmitter();Object.assign(wc,{id:w.id+100,mainFrame:{url},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(w);return w;}
 const registry=new WindowRegistry({authorize:()=>allow?{projectId:selected.project.id,mode:'normal',access:'write',entityIds:[...workspaceMetadata(selected).diagrams.map(d=>d.id),'doc-a',base.ref.sourceId]}:null,createWindow:async options=>native(options.mainFrameUrl)});
 const primary=native('siren://app/home.html');registry.bindWorkspace(primary);registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 for(const [role,entityId]of [['diagram','diagram-a'],['docs','doc-a'],['code',base.ref.sourceId]])await registry.openView({role,entityId});
 const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame}),grant=i=>i===0?registry.capturePrimary(event(i)):registry.capture(event(i));
 const domains=new DomainRepository({projects:({canWrite})=>new ProjectStore(base.root,{canSave:canWrite}),sources:({canWrite})=>new SourceRepository(base.root,{canWrite}),validatePatch:()=>true,allocateDiagramId:()=> 'created-b'});
 const access=(g,s)=>s.action==='create-catalogue-diagram'?allow&&(g.role==='workspace'||g.role==='diagram'&&working):s.action==='read-domain'||['edit-domain','flush-domain'].includes(s.action)&&working;
 const owner=new WorkspaceCoordinator({registry,sources:()=>base.sources,domains:{read:(...args)=>domains.read(...args),apply:(...args)=>domains.apply(...args),flush:(...args)=>domains.flush(...args),async appendCatalogueDiagram(payload,scope){await beforeAppend(scope);if(appendOverride)return appendOverride(payload,scope);const r=await domains.appendCatalogueDiagram(payload,scope);if(r.ok&&scope.isCurrent())selected=await base.projects.readProject(scope.projectId);return r;}},access,maxPending,maxQueueBytes});
 return {...base,registry,owner,windows,event,grant,getSelected:()=>selected,setWorking:v=>working=v,setAllow:v=>allow=v,setBefore:v=>beforeAppend=v,setAppend:v=>appendOverride=v,call:(i=1,payload=request,nonce)=>owner.invoke(grant(i),intent(payload),nonce)};
}
test('catalogue append is its own owner action and preserves a later origin save at its original version',async()=>{
 const f=await fixture(),origin=f.grant(1),first=await f.call();assert.equal(first.ok,true,JSON.stringify(first));assert.deepEqual(origin.entityIds,['diagram-a']);
 const a=await f.owner.invoke(origin,{kind:'diagram',method:'applyDiagram',payload:{diagramId:'diagram-a',operationId:'later-owner-a',expectedVersion:1,action:'replace-source',payload:{source:'flowchart LR\nA-->C'}}});assert.equal(a.ok,true);const current=await f.projects.readProject(f.selected.project.id);assert.equal(workspaceMetadata(current).diagrams.at(-1).id,'created-b');assert.equal(workspaceMetadata(current).diagrams[0].source,'flowchart LR\nA-->C');
});
test('authentic empty-grant Home can append; Docs/Code/unadmitted Diagram and cloned grant cannot',async()=>{
 const f=await fixture();assert.equal(f.grant(0).entityIds.length,0);assert.equal((await f.call(0)).ok,true);
 for(const i of [2,3])assert.equal((await f.call(i,{...request,operationId:'foreign-'+i})).ok,false);
 f.setWorking(false);assert.equal((await f.call(1,{...request,operationId:'not-working'})).ok,false);assert.equal((await f.owner.invoke({...f.grant(0)},intent({...request,operationId:'cloned'}))).ok,false);
});
test('same-operation concurrent append requests serialize and create one retained entity',async()=>{
 const f=await fixture(),results=await Promise.all([f.call(),f.call()]);assert(results.every(r=>r.ok),JSON.stringify(results));assert.equal(results[0].entityId,results[1].entityId);assert.deepEqual(results[0].creation,results[1].creation);assert.equal(workspaceMetadata(await f.projects.readProject(f.selected.project.id)).diagrams.filter(d=>d.id==='created-b').length,1);
});
test('a genuine private flush nonce never authorizes catalogue append',async()=>{
 const f=await fixture();f.owner.pause('lock');const g=f.grant(1),nonce=f.owner.beginViewFlush(g);assert.equal((await f.owner.invoke(g,intent(request),nonce)).code,'FLUSH_REFUSED');f.owner.cancelViewFlush(g,nonce);f.owner.resume();assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('a queued append cannot revive after pause/resume while an earlier operation is suspended',async()=>{
 const f=await fixture();let release,entered;const ready=new Promise(r=>entered=r);let calls=0;f.setBefore(async()=>{if(++calls===1){entered();await new Promise(r=>release=r);}});
 const first=f.call(),second=f.call(1,{...request,operationId:'queued-c'});await ready;f.owner.pause('lock');f.owner.resume();release();const result=await Promise.all([first,second]);assert(result.every(r=>r.ok===false),JSON.stringify(result));assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('an intervening roster freeze and release permanently revokes a suspended append',async()=>{
 const f=await fixture();let release,entered;const ready=new Promise(r=>entered=r);f.setBefore(async()=>{entered();await new Promise(r=>release=r);});const operation=f.call();await ready;const roster=f.registry.freezeRoster();assert.equal(f.registry.releaseRoster(roster),true);release();assert.equal((await operation).ok,false);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('captured admission guards reject forged captures and do not revive after roster rollback',async()=>{
 const f=await fixture();assert.equal(typeof f.registry.captureAdmissionGuard,'function');const g=f.grant(1),proof=f.registry.captureAdmissionGuard(g);assert.equal(proof.isCurrent(),true);assert.equal(f.registry.captureAdmissionGuard({...g}),null);const roster=f.registry.freezeRoster();assert.equal(proof.isCurrent(),false);f.registry.releaseRoster(roster);assert.equal(proof.isCurrent(),false);assert.equal(f.registry.captureAdmissionGuard(g).isCurrent(),true);
});
test('finite owner projection refuses an adapter answer with extra private fields or invalid birth/current versions',async()=>{
 const f=await fixture();f.setAppend(async()=>({ok:true,operationId:request.operationId,entityId:'created-b',creation:{version:1,sha256:'a'.repeat(64),projectRevision:3,durability:'committed'},current:{available:true,version:1,sha256:'a'.repeat(64),projectRevision:3},private:'NEVER_PROJECT'}));assert.equal((await f.call()).code,'CATALOGUE_RESULT_REFUSED');
});
test('catalogue action consumes the existing owner queue request/byte budgets',async()=>{
 const f=await fixture({maxPending:1});let release,entered;const ready=new Promise(r=>entered=r);f.setBefore(async()=>{entered();await new Promise(r=>release=r);});const operation=f.call();await ready;assert.equal((await f.call()).code,'OWNER_BUDGET');release();assert.equal((await operation).ok,true);
 const g=await fixture({maxQueueBytes:16});assert.equal((await g.call()).code,'OWNER_BUDGET');assert.deepEqual(await g.projects.readProject(g.selected.project.id),g.selected);
});
