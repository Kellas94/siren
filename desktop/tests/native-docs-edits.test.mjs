import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
const module=await import('../src/windows/docs-edits.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function fixture(t){
 const f=await sourceReadFixture();t.after(()=>rm(f.root,{recursive:true,force:true}));let selected=f.selected,enabled=true,service;const notices=[];
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),
  domains:new DomainRepository({projects:({canWrite})=>new ProjectStore(f.root,{canSave:canWrite}),sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),validatePatch:()=>true}),
  access:(grant,scope)=>f.isUnlocked()&&scope.domain==='docs'&&(scope.action==='read-domain'||service?.isWorking(grant))});
 assert.equal(typeof module.NativeDocsEdits,'function','Native working Docs must exist');
 service=new module.NativeDocsEdits({registry:f.registry,owner,enabled:()=>enabled&&f.isUnlocked(),snapshotFor:()=>selected,onReferenceChanged:(grant,ref)=>notices.push({windowId:grant.windowId,ref})});
 const grant=()=>f.registry.capture(f.event(1));
 return {...f,service,owner,notices,grant,call:(method,payload,event=f.event(1),flushNonce)=>service.invoke({event,method,payload,flushNonce}),enable:v=>{enabled=v;},select:v=>{selected=v;}};
}
test('native working Docs requires explicit main admission and scopes real atomic content saves to its selected document',async t=>{
 const f=await fixture(t),request={operationId:'atomic-docs',documentId:'doc-a',expectedVersion:documentVersion(f.selected,'doc-a'),action:'replace-content',payload:{title:'Native title',blocks:[{id:'heading-a',kind:'heading',level:2,text:'Exact 😀'}]}};
 assert.equal((await f.call('applyDocument',request)).code,'ACCESS_REFUSED');
 assert.equal((await f.service.admit(f.grant())).ok,true);assert.equal(f.service.isWorking(f.grant()),true);
 const result=await f.call('applyDocument',request);assert.equal(result.ok,true,JSON.stringify(result));
 const current=await f.projects.readProject(f.selected.project.id);assert.equal(current.revision,f.selected.revision+1);assert.deepEqual(JSON.parse(current.json).workpapers,[{id:'doc-a',private:'PLANTED_DOCS_PRIVATE_CONTENT',...request.payload}]);assert.deepEqual(current.sourceRefs,f.selected.sourceRefs);
 assert.equal((await f.call('applyDocument',{...request,operationId:'stale-docs'})).code,'DOCUMENT_CONFLICT');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),current);assert.equal(f.notices.length,0,'no origin echo');
});
test('Docs bridge rejects role/frame/identity/getters and revoked admission without changing original storage',async t=>{
 const f=await fixture(t);assert.equal((await f.service.admit(f.grant())).ok,true);
 const request={operationId:'docs-rename',documentId:'doc-a',expectedVersion:documentVersion(f.selected,'doc-a'),action:'rename',payload:{title:'No overwrite'}};
 for(const event of [f.event(0),{sender:{},senderFrame:f.event(1).senderFrame},{sender:f.event(1).sender,senderFrame:{...f.event(1).senderFrame}}])assert.equal((await f.call('applyDocument',request,event)).code,'ACCESS_REFUSED');
 assert.equal((await f.call('applyDocument',{...request,documentId:'doc-b'})).code,'ACCESS_REFUSED');
 assert.equal((await f.call('applyDocument',{...request,projectId:f.selected.project.id})).code,'REQUEST_REFUSED');
 let ran=false;const getter=Object.defineProperty({},'documentId',{enumerable:true,get(){ran=true;return 'doc-a';}});assert.equal((await f.call('applyDocument',getter)).code,'REQUEST_REFUSED');assert.equal(ran,false);
 f.enable(false);assert.equal(f.service.isWorking(f.grant()),false);assert.equal((await f.call('applyDocument',request)).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('working Docs finite flush requires its genuine private ticket and seals actual owner receipts',async t=>{
 const f=await fixture(t);assert.equal((await f.service.admit(f.grant())).ok,true);const grant=f.grant(),expectedVersion=documentVersion(f.selected,'doc-a');
 f.owner.pause('lock');const nonce=f.owner.beginViewFlush(grant);
 assert.equal((await f.call('flushDocument',{entityId:'doc-a',expectedVersion},f.event(1),'forged')).code,'FLUSH_REFUSED');
 const flushed=await f.call('flushDocument',{entityId:'doc-a',expectedVersion},f.event(1),nonce);assert.equal(flushed.ok,true,JSON.stringify(flushed));
 const seal=await f.owner.finishViewFlush(grant,nonce);assert.equal(seal.ok,true);assert.equal(seal.receipts.length,1);assert.equal(seal.receipts[0].domain,'docs');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 f.owner.resume();f.service.dispose();assert.equal(f.service.isWorking(grant),false);
});

test('another genuine working Docs window receives metadata only after real persistence, without origin echo or paused delivery',async t=>{
 const f=await fixture(t);await f.service.admit(f.grant());const second=await f.registry.openView({role:'docs',entityId:'doc-a'}),event=f.event(2),grant=f.registry.capture(event);await f.service.admit(grant);
 const request={operationId:'native-docs-notice',documentId:'doc-a',expectedVersion:documentVersion(f.selected,'doc-a'),action:'rename',payload:{title:'Version saved'}};
 const saved=await f.call('applyDocument',request);assert.equal(saved.ok,true);assert.equal(f.notices.length,1);assert.equal(f.notices[0].windowId,second.windowId);assert.deepEqual(f.notices[0].ref,{documentId:'doc-a',version:saved.version,projectRevision:saved.projectRevision});assert.equal(JSON.stringify(f.notices).includes('PRIVATE'),false);
 f.owner.pause('lock');const nonce=f.owner.beginViewFlush(f.grant());assert.equal((await f.call('flushDocument',{entityId:'doc-a',expectedVersion:saved.version},f.event(1),nonce)).ok,true);assert.equal(f.notices.length,1);f.owner.cancelViewFlush(f.grant(),nonce);f.owner.resume();
});
