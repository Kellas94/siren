import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {rm} from 'node:fs/promises';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {DocsLinkService,documentVersion} from '../src/windows/docs.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';

async function fixture(t,{wrapped=false,checkpoint}={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-source-docs-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const projects=new ProjectStore(root),initial=await projects.createProject({label:'Owned Docs',json:'{}'}),projectId=initial.project.id;
  const repository=new SourceRepository(root,{checkpoint});
  const ref=await repository.importSource({projectId,bytes:Buffer.from('print("😀")\r\n'),provenance:{agentId:'agent-a',releaseId:'release-one'}});
  const point={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
  const workspace={workpapers:['doc-a','doc-b'].map(id=>({id,agent:{agentId:id},releases:[{id:'release-old',snapshot:{knowledge:[{id:'old',sourceRef:point}]}}],blocks:[{id:'block-a',kind:'knowledge',rows:[{id:'row-a',title:'Keep title',sourceRef:point}]}]}))};
  const metadata=wrapped?{kind:'siren-desktop',storage:{'t-industries-siren-v23-state':JSON.stringify(workspace),'opaque-backup':'EXACT unrelated storage'}}:workspace;
  const first=await commitManifest({projects,repository,projectId,baseRevision:1,sourceRefs:[ref],metadata,operationId:'initial-manifest'});assert.equal(first.ok,true);
  const snapshot=await projects.readProject(projectId),draft=await repository.applyEdit({projectId,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'edit-source',start:0,end:5,insertedText:'hello'}});
  const sourceReceipt=await repository.commitSource({projectId,sourceId:ref.sourceId,expectedVersion:draft.version,operationId:'save-source'});
  let current=true,fault=async()=>{};
  const scope={projectId,isCurrent:()=>current};
  const service=new DocsLinkService({projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite,fault:phase=>fault(phase)}),sources:({canWrite})=>new SourceRepository(root,{canWrite})});
  const request=id=>({operationId:`link-${id}`,documentId:id,rowId:'row-a',expectedDocumentVersion:documentVersion(snapshot,id),sourceReceipt:{...sourceReceipt}});
  return {root,projects,repository,ref,point,snapshot,sourceReceipt,service,scope,request,projectId,setCurrent:value=>{current=value;},setFault:value=>{fault=value;}};
}
const active=snapshot=>{const json=JSON.parse(snapshot.json);return json.storage?JSON.parse(json.storage['t-industries-siren-v23-state']):json;};

test('explicit Docs save links exact committed source while preserving other Docs, agent, release and source bytes',async t=>{
  const f=await fixture(t),before=active(f.snapshot);
  const result=await f.service.commitCodeToDocs(f.request('doc-a'),f.scope);
  assert.equal(result.ok,true);assert.equal(result.projectRevision,3);assert.equal(result.durability,'committed');
  const reopened=await new ProjectStore(f.root).readProject(f.projectId),after=active(reopened);
  assert.deepEqual(after.workpapers[1],before.workpapers[1]);
  assert.deepEqual(after.workpapers[0].agent,before.workpapers[0].agent);
  assert.deepEqual(after.workpapers[0].releases,before.workpapers[0].releases);
  assert.equal(after.workpapers[0].blocks[0].rows[0].title,'Keep title');
  assert.deepEqual(after.workpapers[0].blocks[0].rows[0].sourceRef,result.sourceRef);
  assert.equal(result.documentVersion,documentVersion(reopened,'doc-a'));
  assert.deepEqual(await f.repository.exportSource({projectId:f.projectId,sourceId:f.ref.sourceId,version:2}),Buffer.from('hello("😀")\r\n'));
  assert.equal(reopened.sourceRefs.length,2);assert.deepEqual(reopened.sourceRefs.find(ref=>ref.version===1),f.ref);
});

test('distinct document content tokens permit sequential owner saves without refreshing stale envelopes',async t=>{
  const f=await fixture(t);
  assert.equal((await f.service.commitCodeToDocs(f.request('doc-a'),f.scope)).ok,true);
  assert.equal((await f.service.commitCodeToDocs(f.request('doc-b'),f.scope)).ok,true);
  const saved=await f.projects.readProject(f.projectId);assert.equal(saved.revision,4);
  assert.equal(active(saved).workpapers.every(doc=>doc.blocks[0].rows[0].sourceRef.version===2),true);
  const stale={...f.request('doc-a'),operationId:'stale-a'};
  assert.equal((await f.service.commitCodeToDocs(stale,f.scope)).code,'DOCUMENT_CONFLICT');
  assert.deepEqual(await f.projects.readProject(f.projectId),saved);
});

test('exact duplicate returns selected historical receipt after other changes; operation reuse refuses',async t=>{
  const f=await fixture(t),request=f.request('doc-a'),first=await f.service.commitCodeToDocs(request,f.scope);
  await f.service.commitCodeToDocs(f.request('doc-b'),f.scope);
  assert.deepEqual(await f.service.commitCodeToDocs(request,f.scope),first);
  assert.equal((await f.service.commitCodeToDocs({...request,rowId:'other-row'},f.scope)).code,'OPERATION_CONFLICT');
});

test('forged commit and unknown/foreign targets refuse with unchanged native Docs selection',async t=>{
  const f=await fixture(t);
  for(const mutation of [r=>r.sourceReceipt.operationId='edit-source',r=>r.sourceReceipt.sha256='f'.repeat(64),r=>r.rowId='absent',r=>r.documentId='absent',r=>r.sourceReceipt.sourceId='foreign-source']) {
    const request=f.request('doc-a');mutation(request);
    assert.equal((await f.service.commitCodeToDocs(request,f.scope)).ok,false);
    assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
  }
});

test('active storage envelope is updated without changing unrelated bag keys',async t=>{
  const f=await fixture(t,{wrapped:true});assert.equal((await f.service.commitCodeToDocs(f.request('doc-a'),f.scope)).ok,true);
  const bag=JSON.parse((await f.projects.readProject(f.projectId)).json);
  assert.equal(bag.storage['opaque-backup'],'EXACT unrelated storage');assert.equal(bag.kind,'siren-desktop');
  assert.equal(JSON.parse(bag.storage['t-industries-siren-v23-state']).workpapers[0].blocks[0].rows[0].sourceRef.version,2);
});

test('revocation inside native before-select hook cannot publish a linked Docs revision',async t=>{
  const f=await fixture(t);f.setFault(async phase=>{if(phase==='before-select')f.setCurrent(false);});
  assert.equal((await f.service.commitCodeToDocs(f.request('doc-a'),f.scope)).code,'ACCESS_REFUSED');
  assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
  assert.deepEqual(await f.repository.exportSource({projectId:f.projectId,sourceId:f.ref.sourceId,version:2}),Buffer.from('hello("😀")\r\n'));
});

test('recovery-degraded source cannot produce an unqualified committed Docs receipt',async t=>{
  const f=await fixture(t,{checkpoint:async()=>{throw Error('Owned unavailable recovery');}});
  const result=await f.service.commitCodeToDocs(f.request('doc-a'),f.scope);
  assert.equal(result.ok,true);assert.equal(result.durability,'recovery-degraded');
  assert.deepEqual(await f.service.commitCodeToDocs(f.request('doc-a'),f.scope),result);
});

test('strict link input rejects getters and extra fields without evaluating user code',async t=>{
  const f=await fixture(t),request=f.request('doc-a');let evaluated=false;
  Object.defineProperty(request.sourceReceipt,'sha256',{get:()=>{evaluated=true;return f.ref.sha256;},enumerable:true});
  assert.equal((await f.service.commitCodeToDocs(request,f.scope)).ok,false);assert.equal(evaluated,false);
  assert.equal((await f.service.commitCodeToDocs({...f.request('doc-a'),path:'outside'},f.scope)).ok,false);
  assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});

async function owner(f,{docs=f.service}={}) {
  const windows=[],policy={projectId:f.projectId,mode:'normal',access:'write',entityIds:[f.ref.sourceId,'doc-a','doc-b']};
  const registry=new WindowRegistry({authorize:()=>policy,createWindow:async input=>{
    const window=new EventEmitter();window.id=windows.length+1;window.destroyed=false;window.isDestroyed=()=>window.destroyed;
    window.isMinimized=()=>false;window.restore=()=>{};window.focus=()=>{};
    window.destroy=()=>{window.destroyed=true;window.webContents.emit('destroyed');window.emit('closed');};window.close=()=>window.destroy();
    window.webContents=new EventEmitter();Object.assign(window.webContents,{id:windows.length+100,mainFrame:{url:input.mainFrameUrl},getURL:()=>input.mainFrameUrl,isDestroyed:()=>window.destroyed});
    windows.push(window);return window;
  }});
  for(const [role,entityId] of [['code',f.ref.sourceId],['docs','doc-a'],['docs','doc-b']])await registry.openView({role,entityId});
  const grants=windows.map(window=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame}));
  const coordinator=new WorkspaceCoordinator({registry,docs,sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),access:()=>policy.mode==='normal'});
  return {registry,grants,coordinator,policy};
}
const linkIntent=payload=>({kind:'docs',method:'commitCodeToDocs',payload});

test('one native owner serializes concurrent distinct Docs and publishes only immutable matching document receipts',async t=>{
  const f=await fixture(t),o=await owner(f),a=[],b=[];
  o.coordinator.subscribe(o.grants[1],'doc-a',receipt=>{a.push(receipt);assert.throws(()=>{receipt.sourceRef.version=99;},TypeError);});
  const dispose=o.coordinator.subscribe(o.grants[2],'doc-b',receipt=>b.push(receipt));
  const results=await Promise.all(['doc-a','doc-b'].map(id=>o.coordinator.invoke(o.grants[0],linkIntent(f.request(id)))));
  assert.equal(results.every(value=>value.ok),true);assert.equal(a.length,1);assert.equal(b.length,1);
  assert.equal(results[0].sourceRef.version,2);assert.equal(JSON.stringify(results).includes('hello'),false);
  const selected=await f.projects.readProject(f.projectId);assert.equal(selected.revision,4);
  dispose();await o.coordinator.invoke(o.grants[2],linkIntent(f.request('doc-b')));assert.equal(b.length,1);
  assert.equal((await o.coordinator.invoke(o.grants[1],linkIntent(f.request('doc-b')))).code,'ACCESS_REFUSED');
  o.policy.mode='readonly';assert.equal((await o.coordinator.invoke(o.grants[0],linkIntent(f.request('doc-a')))).code,'ACCESS_REFUSED');
  assert.deepEqual(await f.projects.readProject(f.projectId),selected);
});

test('unsafe Docs adapter output is refused before publication instead of forwarding text or forged refs',async t=>{
  const f=await fixture(t),request=f.request('doc-a'),real=await f.service.commitCodeToDocs(request,f.scope);
  for(const bad of [{...real,text:'private source'},{...real,sourceRef:{...real.sourceRef,version:99}}]) {
    const o=await owner(f,{docs:{commitCodeToDocs:async()=>bad}}),events=[];
    o.coordinator.subscribe(o.grants[1],'doc-a',receipt=>events.push(receipt));
    assert.equal((await o.coordinator.invoke(o.grants[0],linkIntent(request))).code,'DOCS_RESULT_REFUSED');assert.deepEqual(events,[]);
  }
});

test('selected marker without the actual linked document cannot fabricate a successful historical operation',async t=>{
  const f=await fixture(t),request=f.request('doc-a'),metadata=JSON.parse(f.snapshot.json);
  metadata.sirenNativeDocsLink={schema:1,projectId:f.projectId,operationId:request.operationId,requestHash:createHash('sha256').update(JSON.stringify(request)).digest('hex'),documentId:'doc-a',rowId:'row-a',documentVersion:'f'.repeat(64),sourceRef:{sourceId:f.ref.sourceId,version:2,sha256:f.sourceReceipt.sha256}};
  const actualRef=await f.repository.getMetrics({projectId:f.projectId,sourceId:f.ref.sourceId,version:2});
  assert.equal((await commitManifest({projects:f.projects,repository:f.repository,projectId:f.projectId,baseRevision:2,sourceRefs:[f.ref,actualRef],metadata,operationId:request.operationId})).ok,true);
  const before=await f.projects.readProject(f.projectId);
  assert.equal((await f.service.commitCodeToDocs(request,f.scope)).ok,false);
  assert.deepEqual(await f.projects.readProject(f.projectId),before);
});

test('unselected orphan operation cannot manufacture an acknowledgement; explicit retry must select and read back',async t=>{
  const f=await fixture(t);let failed=false;
  f.setFault(async phase=>{if(phase==='before-select'&&!failed){failed=true;throw Error('Owned preselection fault');}});
  assert.equal((await f.service.commitCodeToDocs(f.request('doc-a'),f.scope)).ok,false);
  assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
  f.setFault(async()=>{});
  const result=await f.service.commitCodeToDocs(f.request('doc-a'),f.scope);assert.equal(result.ok,true);
  const fresh=await new ProjectStore(f.root).readProject(f.projectId);assert.equal(fresh.revision,result.projectRevision);
  assert.equal(active(fresh).workpapers[0].blocks[0].rows[0].sourceRef.version,2);
});
