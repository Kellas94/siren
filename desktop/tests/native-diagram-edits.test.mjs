import test from 'node:test';
import assert from 'node:assert/strict';
import {diagramContext} from './fixtures/diagram-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
const implementation=await import('../src/windows/diagram-edits.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture(){
 assert.equal(typeof implementation.NativeDiagramEdits,'function');const f=await diagramContext();let enabled=true,service;const notices=[];
 const domains=new DomainRepository({projects:({canWrite})=>new ProjectStore(f.root,{canSave:canWrite}),sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),validatePatch:()=>true});
 const owner=new WorkspaceCoordinator({registry:f.registry,domains:{read:(...args)=>domains.read(...args),flush:(...args)=>domains.flush(...args),async apply(...args){const receipt=await domains.apply(...args);if(receipt.ok)f.setSelected(await f.projects.readProject(f.selected.project.id));return receipt;}},sources:()=>f.sources,access:(grant,scope)=>scope.action==='read-domain'?scope.domain==='diagram':['edit-domain','flush-domain'].includes(scope.action)&&service?.isWorking(grant)===true});
 service=new implementation.NativeDiagramEdits({registry:f.registry,owner,enabled:()=>enabled,snapshotFor:()=>f.getSelected(),onReferenceChanged:(grant,reference)=>notices.push({windowId:grant.windowId,...reference})});
 const grant=index=>f.registry.capture(f.event(index)),request=(source,version=1,id='diagram-a')=>({diagramId:id,expectedVersion:version,operationId:'edit-'+version+'-'+id,action:'replace-source',payload:{source}});
 return {...f,owner,service,notices,grant,request,setEnabled:value=>enabled=value,call:(index,method,payload,flushNonce)=>service.invoke({event:f.event(index),method,payload,flushNonce})};
}
test('native Diagram editing requires genuine main admission and refuses readonly/Docs/Code/caller scope fields',async()=>{
 const f=await fixture(),before=await f.projects.readProject(f.selected.project.id);
 assert.equal((await f.call(0,'applyDiagram',f.request('flowchart TD\nA-->B'))).code,'ACCESS_REFUSED');
 assert.equal((await f.service.admit({...f.grant(0)})).ok,false);for(const i of [1,2])assert.equal((await f.service.admit(f.grant(i))).ok,false);
 assert.equal((await f.service.admit(f.grant(0))).ok,true);assert.equal(f.service.isWorking(f.grant(0)),true);
 assert.equal((await f.call(0,'applyDiagram',f.request('FOREIGN',1,'diagram-b'))).ok,false);assert.equal((await f.call(0,'applyDiagram',{...f.request('UNWRITTEN'),projectId:'foreign'})).code,'REQUEST_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),before);f.setEnabled(false);assert.equal((await f.call(0,'applyDiagram',f.request('LOCKED'))).ok,false);f.service.dispose();
});
test('two genuine Diagram windows preserve exact independent edits and foreign Docs/source/agent data; same-diagram stale versions stay refused',async()=>{
 const f=await fixture();await f.registry.openView({role:'diagram',entityId:'diagram-b'});await f.registry.openView({role:'diagram',entityId:'diagram-a'});
 for(const i of [0,3,4])assert.equal((await f.service.admit(f.grant(i))).ok,true);
 const a='flowchart TD\nA-->B\nstyle A fill:#ff3366',b='sequenceDiagram\nA->>B: Exact context';
 const receipts=await Promise.all([f.call(0,'applyDiagram',f.request(a)),f.call(3,'applyDiagram',f.request(b,1,'diagram-b'))]);assert.equal(receipts.every(receipt=>receipt.ok),true);
 const expected=structuredClone(f.workspace);expected.diagrams[0].source=a;expected.diagrams[0].sirenNativeVersion=2;expected.diagrams[1].source=b;expected.diagrams[1].sirenNativeVersion=2;
 const current=await f.projects.readProject(f.selected.project.id);assert.deepEqual(workspaceMetadata(current),expected);assert.deepEqual(current.sourceRefs,f.selected.sourceRefs);
 assert.equal((await f.call(4,'applyDiagram',{...f.request('STALE'),operationId:'stale-other-window'})).code,'REVISION_CONFLICT');assert.deepEqual(await f.projects.readProject(f.selected.project.id),current);
 assert.deepEqual(f.notices,[{windowId:f.grant(4).windowId,diagramId:'diagram-a',version:2,projectRevision:3}]);
 const same=await f.call(0,'applyDiagram',f.request(a));assert.equal(same.ok,true);assert.equal(same.version,2);assert.deepEqual(await f.projects.readProject(f.selected.project.id),current);f.service.dispose();
});
test('genuine Diagram draining nonce permits its typed flush while paused and is retired on disposal',async()=>{
 const f=await fixture();assert.equal((await f.service.admit(f.grant(0))).ok,true);f.owner.pause('lock');const nonce=f.owner.beginViewFlush(f.grant(0));
 assert.equal((await f.call(0,'flushDiagram',{entityId:'diagram-a',expectedVersion:1})).code,'WORKSPACE_PAUSED');
 assert.equal((await f.call(0,'flushDiagram',{entityId:'diagram-a',expectedVersion:1},nonce)).ok,true);f.owner.cancelViewFlush(f.grant(0),nonce);f.owner.resume();f.service.dispose();assert.equal(f.service.isWorking(f.grant(0)),false);assert.equal((await f.call(0,'flushDiagram',{entityId:'diagram-a',expectedVersion:1})).ok,false);
});
