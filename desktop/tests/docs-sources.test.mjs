import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeDocsReads} from '../src/windows/docs-reads.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
const module=await import('../src/windows/docs-sources.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture(){
 const f=await sourceReadFixture(),ref=f.refs[0],point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
 const metadata={workpapers:[{id:'doc-a',title:'Linked agent',blocks:[{id:'block-a',kind:'knowledge',rows:[{id:'row-a',name:'agent.py',sourceRef:point}]}]}]};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:2,sourceRefs:f.refs,metadata,operationId:'docs-open-fixture'})).ok,true);
 let selected=await f.projects.readProject(f.selected.project.id),allowed=true,shown=0,sourceReads=0;
 const domains=new DomainRepository({projects:()=>new ProjectStore(f.root,{canSave:()=>false}),sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),domains,access:(_grant,scope)=>allowed&&f.isUnlocked()&&scope.action==='read-domain'&&scope.domain==='docs'&&scope.entityId==='doc-a'});
 const reads=new NativeDocsReads({registry:f.registry,owner,documentFor:()=>JSON.parse(selected.json).workpapers[0]});
 assert.equal(typeof module.NativeDocsSources,'function','Native scoped linked-source opening must be implemented');
 const repository=new SourceRepository(f.root,{canWrite:({action})=>action==='read'});
 const service=new module.NativeDocsSources({registry:f.registry,owner,reads,snapshotFor:()=>selected,canOpen:()=>allowed,sources:()=>{sourceReads++;return repository;},show:()=>{shown++;}});
 const request={blockId:'block-a',rowId:'row-a',expectedDocumentVersion:documentVersion(selected,'doc-a')};
 return {...f,selected,repository,owner,service,request,call:(payload=request,event=f.event(1),extra={})=>service.invoke({event,method:'openLinkedSource',payload,...extra}),shown:()=>shown,sourceReads:()=>sourceReads,select:value=>{selected=value;},pause:()=>{allowed=false;owner.pause('Lock');}};
}
test('Docs opens only its genuine saved source version as a pinned immutable Code window, preserving newer head and project',async()=>{
 const f=await fixture(),ref=f.refs[0];assert.equal((await f.sources.applyEdit({projectId:f.selected.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'newer-source',start:0,end:0,insertedText:'new head\n'}})).ok,true);
 const result=await f.call();assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.view.role,'code');assert.equal(f.shown(),1);
 const opened=f.registry.listViews().find(v=>v.windowId===result.view.windowId),grant=f.registry.capture(f.event(2));assert.equal(opened.entityId,ref.sourceId);assert.deepEqual(f.registry.sourceScope(grant),{sourceId:ref.sourceId,version:1});
 assert.equal(JSON.stringify(result).includes('PLANTED'),false);assert.equal(result.sourceRef,undefined);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 assert.equal((await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:ref.sourceId})).version,2);
});
test('Docs opener rejects caller identity, getters, foreign frames/roles and private drain nonce before source access',async()=>{
 const f=await fixture();for(const extra of [{sourceId:f.refs[1].sourceId},{projectId:f.selected.project.id},{version:2},{path:'C:/private'},{nonce:'fake'}])assert.equal((await f.call({...f.request,...extra})).code,'REQUEST_REFUSED');
 let ran=false;const value=Object.defineProperty({...f.request},'rowId',{enumerable:true,get(){ran=true;return 'row-a';}});assert.equal((await f.call(value)).code,'REQUEST_REFUSED');assert.equal(ran,false);
 assert.equal((await f.call(f.request,f.event(0))).code,'ACCESS_REFUSED');assert.equal((await f.call(f.request,{sender:{...f.event(1).sender},senderFrame:f.event(1).senderFrame})).code,'ACCESS_REFUSED');
 assert.equal((await f.call(f.request,f.event(1),{flushNonce:'private-ticket'})).code,'REQUEST_REFUSED');assert.equal((await f.call({...f.request,blockId:'other-block'})).code,'LINK_TARGET_REFUSED');
 assert.equal((await f.call({...f.request,expectedDocumentVersion:'0'.repeat(64)})).code,'DOCUMENT_CONFLICT');assert.equal(f.sourceReads(),0);assert.equal(f.shown(),0);assert.equal(f.registry.listViews().length,2);
});
test('actual changed Docs or revoked native owner during source verification refuses opening and preserves both entities',async()=>{
 const f=await fixture(),original=f.repository.getMetrics.bind(f.repository);let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 f.repository.getMetrics=async input=>{const result=await original(input);entered();await gate;return result;};
 const pending=f.call();await ready;f.pause();release();assert.equal((await pending).ok,false);assert.equal(f.registry.listViews().length,2);assert.equal(f.shown(),0);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('late document change while native window is prepared destroys only the new hidden Code window',async()=>{
 const f=await fixture(),original=f.registry.openView.bind(f.registry);f.registry.openView=async request=>{const result=await original(request);f.select({...f.selected,json:JSON.stringify({workpapers:[{id:'doc-a',title:'changed'}]})});return result;};
 const result=await f.call();assert.equal(result.ok,false);assert.equal(f.windows[2].isDestroyed(),true);assert.equal(f.windows[0].isDestroyed(),false);assert.equal(f.windows[1].isDestroyed(),false);assert.equal(f.registry.listViews().length,2);assert.equal(f.shown(),0);
});
test('a duplicate knowledge row refuses a Code grant',async()=>{
 const f=await fixture(),metadata=JSON.parse(f.selected.json);metadata.workpapers[0].blocks[0].rows.push(structuredClone(metadata.workpapers[0].blocks[0].rows[0]));
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:3,sourceRefs:f.refs,metadata,operationId:'duplicate-row'})).ok,true);const duplicate=await f.projects.readProject(f.selected.project.id);f.select(duplicate);
 assert.equal((await f.call({...f.request,expectedDocumentVersion:documentVersion(duplicate,'doc-a')})).code,'LINK_TARGET_REFUSED');assert.equal(f.shown(),0);
});
test('manifest refuses unknown Docs pointers and forged hashes before source-opening admission',async()=>{
 for(const change of ['missing','hash']){
  const f=await fixture(),metadata=JSON.parse(f.selected.json);if(change==='hash')metadata.workpapers[0].blocks[0].rows[0].sourceRef.sha256='0'.repeat(64);
  assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:3,sourceRefs:change==='missing'?[f.refs[1]]:f.refs,metadata,operationId:'refused-'+change})).code,'UNKNOWN_SOURCE_REFERENCE');
  assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal(f.sourceReads(),0);assert.equal(f.shown(),0);assert.equal(f.registry.listViews().length,2);
 }
});
test('native source readback mismatch refuses window creation',async()=>{
 const f=await fixture(),original=f.repository.getMetrics.bind(f.repository);f.repository.getMetrics=async input=>({...await original(input),sha256:'0'.repeat(64)});
 assert.equal((await f.call()).code,'SOURCE_RESULT_REFUSED');assert.equal(f.shown(),0);assert.equal(f.registry.listViews().length,2);
});
test('failed native publication destroys the new window and leaves existing work untouched',async()=>{
 const f=await fixture(),original=f.registry.openView.bind(f.registry);f.registry.openView=async request=>{const result=await original(request);f.windows.at(-1).destroy();return result;};
 const result=await f.call();assert.equal(result.ok,false);assert.equal(f.registry.listViews().length,2);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
