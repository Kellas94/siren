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
async function fixture(sourceText){
 const f=await sourceReadFixture();if(sourceText!==undefined)f.refs[0]=await f.sources.importSource({projectId:f.selected.project.id,bytes:Buffer.from(sourceText)});
 const ref=f.refs[0],point={sourceId:ref.sourceId,version:1,sha256:ref.sha256};
 const metadata={workpapers:[{id:'doc-a',title:'Linked agent',blocks:[{id:'block-a',kind:'knowledge',rows:[{id:'row-a',name:'agent.py',sourceRef:point}]}]}]};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:2,sourceRefs:f.refs,metadata,operationId:'docs-open-fixture'})).ok,true);
 let selected=await f.projects.readProject(f.selected.project.id),allowed=true,shown=0,sourceReads=0;
 const domains=new DomainRepository({projects:()=>new ProjectStore(f.root,{canSave:()=>false}),sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),domains,access:(_grant,scope)=>allowed&&f.isUnlocked()&&scope.action==='read-domain'&&scope.domain==='docs'&&scope.entityId==='doc-a'});
 const reads=new NativeDocsReads({registry:f.registry,owner,documentFor:()=>JSON.parse(selected.json).workpapers[0]});
 assert.equal(typeof module.NativeDocsSources,'function','Native scoped linked-source opening must be implemented');
 const repository=new SourceRepository(f.root,{canWrite:({action})=>action==='read'});
 const service=new module.NativeDocsSources({registry:f.registry,owner,reads,snapshotFor:()=>selected,canOpen:()=>allowed,sources:({readers})=>{sourceReads++;if(readers)repository.readers=readers;return repository;},show:()=>{shown++;}});
 const request={blockId:'block-a',rowId:'row-a',expectedDocumentVersion:documentVersion(selected,'doc-a')};
 return {...f,selected,repository,owner,service,request,call:(payload=request,event=f.event(1),extra={})=>service.invoke({event,method:'openLinkedSource',payload,...extra}),shown:()=>shown,sourceReads:()=>sourceReads,select:value=>{selected=value;},pause:()=>{allowed=false;owner.pause('Lock');}};
}
test('Docs preview returns bounded exact historical source pages and disposes readers without opening or saving',async()=>{
 const text='\uFEFF'+('value = "Ș😀"\r\n'.repeat(2500)),f=await fixture(text),ref=f.refs[0],before=await f.projects.readProject(f.selected.project.id);
 assert.equal((await f.sources.applyEdit({projectId:before.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'preview-newer',start:0,end:0,insertedText:'new head\n'}})).ok,true);
 let closed=0;const open=f.repository.openReader.bind(f.repository);f.repository.openReader=async input=>{const r=await open(input);return {...r,dispose(){closed++;r.dispose();}};};
 const preview=start=>f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start}});
 const first=await preview(0);assert.equal(first.ok,true,JSON.stringify(first));assert.deepEqual(Object.keys(first).sort(),['end','ok','sourceRef','start','text','totalUnits']);assert.deepEqual(first.sourceRef,{sourceId:ref.sourceId,version:1,sha256:ref.sha256});assert.equal(first.totalUnits,text.length);assert.ok(first.end<=8192);assert.equal(first.text,text.slice(0,first.end));assert.equal(first.text.isWellFormed(),true);
 const second=await preview(first.end);assert.equal(second.ok,true);assert.equal(second.start,first.end);assert.equal(second.text,text.slice(second.start,second.end));assert.ok(second.end-second.start<=8192);assert.equal(second.text.isWellFormed(),true);
 assert.equal(closed,2);assert.equal(f.shown(),0);assert.equal(f.registry.listViews().length,2);assert.deepEqual(await f.projects.readProject(before.project.id),before);
});
test('Docs preview refuses malformed ranges, borrowed caller authority and payload getters before source reads',async()=>{
 const f=await fixture(),preview=(payload,event=f.event(1),extra={})=>f.service.invoke({event,method:'previewLinkedSource',payload,...extra});
 for(const start of [-1,NaN,1.5,Number.MAX_SAFE_INTEGER+1,'0'])assert.equal((await preview({...f.request,start})).code,'REQUEST_REFUSED');
 for(const extra of [{sourceId:f.refs[0].sourceId},{version:1},{projectId:f.selected.project.id},{maxUnits:999999}])assert.equal((await preview({...f.request,start:0,...extra})).code,'REQUEST_REFUSED');
 let read=false;const hostile={...f.request};Object.defineProperty(hostile,'start',{enumerable:true,get(){read=true;return 0;}});assert.equal((await preview(hostile)).code,'REQUEST_REFUSED');assert.equal(read,false);assert.equal(f.sourceReads(),0);
 assert.equal((await preview({...f.request,start:0},f.event(0))).code,'ACCESS_REFUSED');assert.equal((await preview({...f.request,start:0},f.event(1),{flushNonce:'borrowed'})).code,'REQUEST_REFUSED');assert.equal(f.sourceReads(),0);
});
test('Docs preview cannot publish text read before Lock and closes the genuine held reader',async()=>{
 const f=await fixture(),open=f.repository.openReader.bind(f.repository);let release,entered,closed=0;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 assert.equal((await f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start:0}})).ok,true,'Scoped native preview must be present before the held-read test');
 f.repository.openReader=async input=>{const reader=await open(input);return {...reader,dispose(){closed++;reader.dispose();},async readChunk(range){const actual=await reader.readChunk(range);entered();await gate;return actual;}};};
 const pending=f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start:0}});await ready;f.pause();release();
 assert.deepEqual(await pending,{ok:false,code:'ACCESS_REFUSED'});assert.equal(closed,1);assert.equal(f.shown(),0);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('Docs preview reserves a finite whole-operation budget and releases it after refused held requests',async()=>{
 const f=await fixture(),open=f.repository.openReader.bind(f.repository);let release,entered,opened=0,closed=0;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 assert.equal((await f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start:0}})).ok,true,'Scoped native preview must be present before the budget test');
 f.repository.openReader=async input=>{const reader=await open(input);if(++opened===2)entered();await gate;return {...reader,dispose(){closed++;reader.dispose();}};};
 const preview=()=>f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start:0}}),a=preview(),b=preview();await ready;
 assert.deepEqual(await preview(),{ok:false,code:'SOURCE_READER_BUDGET'});assert.equal(opened,2);f.pause();release();assert.equal((await a).code,'ACCESS_REFUSED');assert.equal((await b).code,'ACCESS_REFUSED');assert.equal(closed,2);
});
test('Docs preview retains exact Unicode boundaries, empty EOF and refuses a changed document before publication',async()=>{
 const f=await fixture('a😀\r\nz'),preview=start=>f.service.invoke({event:f.event(1),method:'previewLinkedSource',payload:{...f.request,start}});
 assert.equal((await preview(2)).code,'SOURCE_RANGE_REFUSED');assert.equal((await preview(7)).code,'SOURCE_RANGE_REFUSED');assert.deepEqual(await preview(6),{ok:true,sourceRef:{sourceId:f.refs[0].sourceId,version:1,sha256:f.refs[0].sha256},start:6,end:6,totalUnits:6,text:''});
 const open=f.repository.openReader.bind(f.repository);f.repository.openReader=async input=>{const reader=await open(input);return {...reader,async readChunk(range){const actual=await reader.readChunk(range),changed=structuredClone(f.selected);const metadata=JSON.parse(changed.json);metadata.workpapers[0].title='Concurrent saved change';changed.json=JSON.stringify(metadata);const {digest}=await import('../src/projects/atomic.mjs');changed.sha256=digest(Buffer.from(changed.json));f.select(changed);return actual;}};};
 assert.deepEqual(await preview(0),{ok:false,code:'ACCESS_REFUSED'});assert.equal(f.shown(),0);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
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
