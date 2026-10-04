import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {NativeCodeDocs} from '../src/windows/code-docs.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DocsLinkService,documentVersion} from '../src/windows/docs.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';

async function fixture(t){
 const f=await sourceReadFixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
 const ref=f.refs[0],point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
 const foreign=f.refs[1],docs=[{id:'doc-a',title:'Agent <b>literal</b>',private:'PLANTED_PRIVATE_BODY',blocks:[{kind:'knowledge',rows:[{id:'row-a',title:'Python version',sourceRef:point},{id:'foreign',sourceRef:{sourceId:foreign.sourceId,version:foreign.version,sha256:foreign.sha256}}]}]}];
 const initialized=await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:2,sourceRefs:f.refs,metadata:{workpapers:docs},operationId:'linked-fixture'});assert.equal(initialized.ok,true,JSON.stringify(initialized));
 let selected=await f.projects.readProject(f.selected.project.id),enabled=true;
 const service=new DocsLinkService({projects:({canWrite})=>new ProjectStore(f.root,{canSave:canWrite}),sources:({canWrite})=>new SourceRepository(f.root,{canWrite})});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),docs:service,access:(grant,scope)=>f.registry.isCurrent(grant)&&enabled&&f.isUnlocked()&&['read','edit','commit','docs-link'].includes(scope.action)});
 const bridge=new NativeCodeDocs({registry:f.registry,owner,canLink:grant=>enabled&&f.isUnlocked()&&grant.role==='code',snapshotFor:()=>selected});
 const invoke=(method,payload={},event=f.event(0))=>bridge.invoke({event,method,payload});
 return {...f,owner,bridge,invoke,getSelected:()=>selected,setSelected:value=>{selected=value;},setEnabled:value=>{enabled=value;}};
}

test('native target catalog returns only bounded matching row metadata and content CAS tokens',async t=>{
 const f=await fixture(t),before=f.getSelected(),result=await f.invoke('listTargets',{offset:0});
 assert.equal(result.ok,true);assert.equal(result.total,1);assert.equal(result.nextOffset,null);
 assert.deepEqual(result.targets,[{documentId:'doc-a',rowId:'row-a',documentTitle:'Agent <b>literal</b>',rowTitle:'Python version',documentVersion:documentVersion(before,'doc-a')}]);
 assert.equal(JSON.stringify(result).includes('PLANTED_PRIVATE_BODY'),false);assert.equal(JSON.stringify(result).includes('foreign'),false);
 assert.deepEqual(await f.projects.readProject(before.project.id),before);
});

test('unlinked Code lists selected-project documents as metadata only and creates through real native owner proof',async t=>{
 const f=await fixture(t),before=f.getSelected(),result=await f.invoke('listDocuments',{});assert.equal(result.ok,true);assert.equal(result.total,1);
 assert.deepEqual(result.documents,[{documentId:'doc-a',documentTitle:'Agent <b>literal</b>',documentVersion:documentVersion(before,'doc-a')}]);assert.equal(JSON.stringify(result).includes('PLANTED_PRIVATE_BODY'),false);assert.equal(JSON.stringify(result).includes('foreign'),false);
 const sourceId=f.refs[0].sourceId,grant=f.registry.capture(f.event(0)),sourceReceipt=await f.owner.invoke(grant,{kind:'source',method:'commitSource',payload:{sourceId,expectedVersion:1,operationId:'first-unlinked-source-save'}});assert.equal(sourceReceipt.ok,true);
 const linked=await f.invoke('createCodeToDocs',{operationId:'explicit-new-row',documentId:'doc-a',expectedDocumentVersion:result.documents[0].documentVersion,rowTitle:'Code source',sourceReceipt});assert.equal(linked.ok,true,JSON.stringify(linked));
 const saved=await f.projects.readProject(before.project.id);assert.equal(saved.revision,before.revision+1);assert.equal(JSON.parse(saved.json).workpapers[0].blocks.at(-1).rows[0].id,linked.rowId);
 assert.equal((await f.invoke('listDocuments',{},f.event(1))).code,'ACCESS_REFUSED');f.owner.pause('lock');assert.equal((await f.invoke('listDocuments')).code,'ACCESS_REFUSED');
});

test('explicit native link proves the real source commit, preserves historical bytes and refuses stale Docs CAS',async t=>{
 const f=await fixture(t),before=f.getSelected(),grant=f.registry.capture(f.event(0)),sourceId=f.refs[0].sourceId;
 const draft=await f.owner.invoke(grant,{kind:'source',method:'applyEdit',payload:{sourceId,expectedVersion:1,operationId:'edit-link',start:0,end:1,insertedText:'X'}});assert.equal(draft.ok,true);
 const sourceReceipt=await f.owner.invoke(grant,{kind:'source',method:'commitSource',payload:{sourceId,expectedVersion:2,operationId:'save-link'}});assert.equal(sourceReceipt.ok,true);
 assert.deepEqual(await f.projects.readProject(before.project.id),before);
 const request={operationId:'explicit-link',documentId:'doc-a',rowId:'row-a',expectedDocumentVersion:documentVersion(before,'doc-a'),sourceReceipt};
 const result=await f.invoke('commitCodeToDocs',request);assert.equal(result.ok,true);assert.equal(result.sourceRef.version,2);
 const selected=await f.projects.readProject(before.project.id);f.setSelected(selected);
 assert.equal(selected.revision,before.revision+1);assert.equal(selected.sourceRefs.length,3);
 assert.deepEqual(await f.sources.exportSource({projectId:before.project.id,sourceId,version:1}),Buffer.from('exact 😀\r\n'));
 assert.equal(JSON.parse(selected.json).workpapers[0].blocks[0].rows[1].id,'foreign');
 assert.equal((await f.invoke('commitCodeToDocs',{...request,operationId:'stale-link'})).code,'DOCUMENT_CONFLICT');
 assert.deepEqual(await f.projects.readProject(before.project.id),selected);
});

test('finite Code-only boundary rejects Docs, subframes, pinned versions, Lock, paused owner and readonly admission',async t=>{
 const f=await fixture(t),before=f.getSelected();
 assert.equal((await f.invoke('listTargets',{},f.event(1))).code,'ACCESS_REFUSED');
 assert.equal((await f.invoke('listTargets',{}, {...f.event(0),senderFrame:{url:f.event(0).senderFrame.url}})).code,'ACCESS_REFUSED');
 await f.registry.openView({role:'code',entityId:f.refs[0].sourceId,version:1});
 assert.equal((await f.invoke('listTargets',{},f.event(2))).code,'ACCESS_REFUSED');
 f.setEnabled(false);assert.equal((await f.invoke('listTargets')).code,'ACCESS_REFUSED');f.setEnabled(true);
 f.owner.pause('lock');assert.equal((await f.invoke('listTargets')).code,'ACCESS_REFUSED');f.owner.resume();
 f.lock();assert.equal((await f.invoke('listTargets')).code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(before.project.id),before);
});

test('strict target request rejects inherited fields, getters, paths and over-budget offsets before mutation',async t=>{
 const f=await fixture(t),before=f.getSelected();let touched=false;
 const getter={};Object.defineProperty(getter,'offset',{enumerable:true,get:()=>{touched=true;return 0;}});
 for(const payload of [getter,{projectId:before.project.id},{path:'C:/secret'},{offset:-1},{offset:4097},{offset:0,limit:1000},Object.create({offset:0})])assert.equal((await f.invoke('listTargets',payload)).code,'REQUEST_REFUSED');
 assert.equal(touched,false);assert.equal((await f.invoke('unknown')).code,'REQUEST_REFUSED');
 assert.equal((await f.invoke('commitCodeToDocs',{sourceReceipt:{}})).code,'REQUEST_REFUSED');
 assert.deepEqual(await f.projects.readProject(before.project.id),before);
});

test('pagination is bounded to 64 metadata targets and oversized catalog refuses rather than truncates silently',async t=>{
 const f=await fixture(t),snapshot=f.getSelected(),metadata=JSON.parse(snapshot.json),point=metadata.workpapers[0].blocks[0].rows[0].sourceRef;
 metadata.workpapers[0].blocks[0].rows=Array.from({length:130},(_,i)=>({id:`row-${i}`,title:'T'.repeat(500),sourceRef:point}));
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:snapshot.project.id,baseRevision:snapshot.revision,sourceRefs:snapshot.sourceRefs,metadata,operationId:'many-targets'})).ok,true);
 f.setSelected(await f.projects.readProject(snapshot.project.id));
 const first=await f.invoke('listTargets'),second=await f.invoke('listTargets',{offset:first.nextOffset}),third=await f.invoke('listTargets',{offset:second.nextOffset});
 assert.deepEqual([first.targets.length,second.targets.length,third.targets.length],[64,64,2]);assert.equal(first.targets[0].rowTitle.length,200);assert.equal(third.nextOffset,null);
 metadata.workpapers[0].blocks[0].rows=Array.from({length:4097},(_,i)=>({id:`row-${i}`,sourceRef:point}));
 const current=f.getSelected();assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:current.project.id,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:'too-many-targets'})).ok,true);f.setSelected(await f.projects.readProject(current.project.id));
 assert.equal((await f.invoke('listTargets')).code,'CATALOG_BUDGET');
});

test('new document catalog pages130 choices without private content and refuses forged new-row authority',async t=>{
 const f=await fixture(t),snapshot=f.getSelected(),metadata=JSON.parse(snapshot.json),original=metadata.workpapers[0];metadata.workpapers=Array.from({length:130},(_,i)=>({...original,id:'doc-'+i,title:'Document '+i,private:'PRIVATE_CATALOG'}));
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:snapshot.project.id,baseRevision:snapshot.revision,sourceRefs:snapshot.sourceRefs,metadata,operationId:'many-documents'})).ok,true);const before=await f.projects.readProject(snapshot.project.id);f.setSelected(before);
 const a=await f.invoke('listDocuments'),b=await f.invoke('listDocuments',{offset:a.nextOffset}),c=await f.invoke('listDocuments',{offset:b.nextOffset});assert.deepEqual([a.documents.length,b.documents.length,c.documents.length],[64,64,2]);assert.equal(c.nextOffset,null);assert.equal(new Set([...a.documents,...b.documents,...c.documents].map(x=>x.documentId)).size,130);assert.equal(JSON.stringify([a,b,c]).includes('PRIVATE_CATALOG'),false);
 let touched=false;const getter={};Object.defineProperty(getter,'offset',{enumerable:true,get(){touched=true;return 0;}});assert.equal((await f.invoke('listDocuments',getter)).code,'REQUEST_REFUSED');assert.equal(touched,false);
 const request={operationId:'forged-new-row',documentId:'doc-0',expectedDocumentVersion:a.documents[0].documentVersion,rowTitle:'agent.py',sourceReceipt:{ok:true,operationId:'foreign-proof',sourceId:f.refs[1].sourceId,version:1,sha256:f.refs[1].sha256,durability:'committed'}};
 assert.equal((await f.invoke('createCodeToDocs',request)).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(snapshot.project.id),before);
});
