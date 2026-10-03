import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {NativeWorkingSources} from '../src/windows/working-sources.mjs';

async function fixture(t,options={}){
 const f=await sourceReadFixture();let enabled=true;
 const owner=new WorkspaceCoordinator({registry:f.registry,access:()=>f.isUnlocked()&&enabled,sources:({canWrite})=>new SourceRepository(f.root,{canWrite})});
 const working=new NativeWorkingSources({registry:f.registry,owner,enabled:()=>enabled&&f.isUnlocked(),snapshotFor:()=>f.selected,...options});t.after(()=>working.dispose());
 const grant=()=>f.registry.capture(f.event(0));
 return {...f,owner,working,grant,disable:()=>{enabled=false;}};
}
test('working-source admission reads the actual latest draft while immutable selected refs and Docs remain exact',async t=>{
 const f=await fixture(t),ref=f.refs[0];
 assert.equal(f.working.referenceFor(f.grant()),null);
 assert.equal((await f.sources.applyEdit({projectId:f.selected.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'retained-draft',start:0,end:1,insertedText:'X'}})).ok,true);
 const admitted=await f.working.admit(f.grant());assert.equal(admitted.ok,true);
 const actual=await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:ref.sourceId});
 assert.deepEqual(f.working.referenceFor(f.grant()),{sourceId:ref.sourceId,version:2,sha256:actual.sha256});
 assert.equal(f.working.referenceFor(f.grant(),{sourceId:ref.sourceId,version:1}),null);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 assert.equal(JSON.stringify(admitted).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);
});

test('genuine owner publishes only metadata changes to other working views, never echoes the origin or a readonly view',async t=>{
 const notices=[],f=await fixture(t,{onReferenceChanged:(grant,ref)=>notices.push({windowId:grant.windowId,ref})}),sourceId=f.refs[0].sourceId;
 await f.working.admit(f.grant());await f.registry.openView({role:'code',entityId:sourceId});const second=f.registry.capture(f.event(2));await f.working.admit(second);
 await f.registry.openView({role:'code',entityId:sourceId,version:1});
 const draft=await f.owner.invoke(f.grant(),{kind:'source',method:'applyEdit',payload:{sourceId,expectedVersion:1,operationId:'other-window-edit',start:0,end:1,insertedText:'X'}});assert.equal(draft.ok,true);
 assert.deepEqual(notices,[{windowId:second.windowId,ref:{sourceId,version:2,sha256:draft.sha256}}]);
 assert.equal(JSON.stringify(notices).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);assert.equal(JSON.stringify(notices).includes('insertedText'),false);
 await f.owner.invoke(f.grant(),{kind:'source',method:'commitSource',payload:{sourceId,expectedVersion:2,operationId:'same-version-commit'}});assert.equal(notices.length,1);
 f.owner.pause('lock');const nonce=f.owner.beginViewFlush(f.grant());
 const drained=await f.owner.invoke(f.grant(),{kind:'source',method:'applyEdit',payload:{sourceId,expectedVersion:2,operationId:'finite-paused-edit',start:0,end:1,insertedText:'Y'}},nonce);assert.equal(drained.ok,true);
 assert.equal(f.working.referenceFor(second).version,3);assert.equal(notices.length,1,'Paused views receive no fresh metadata disclosure');
 f.owner.cancelViewFlush(f.grant(),nonce);f.owner.resume();f.working.dispose();
 assert.equal((await f.working.admit(second)).code,'ACCESS_REFUSED');
});
test('working source references advance from actual owner receipts shared across genuine views, never from renderer metadata',async t=>{
 const f=await fixture(t),ref=f.refs[0];assert.equal((await f.working.admit(f.grant())).ok,true);
 await f.registry.openView({role:'code',entityId:ref.sourceId});const second=f.registry.capture(f.event(2));assert.equal((await f.working.admit(second)).ok,true);
 const receipt=await f.owner.invoke(f.grant(),{kind:'source',method:'applyEdit',payload:{sourceId:ref.sourceId,expectedVersion:1,operationId:'native-shared-draft',start:0,end:1,insertedText:'X'}});assert.equal(receipt.ok,true);
 const expected={sourceId:ref.sourceId,version:2,sha256:receipt.sha256};assert.deepEqual(f.working.referenceFor(f.grant()),expected);assert.deepEqual(f.working.referenceFor(second),expected);
 assert.equal(f.working.referenceFor({...second}),null);assert.equal(f.working.isWorking({...second}),false);
 assert.equal(f.working.referenceFor(second,{sourceId:f.refs[1].sourceId,version:2}),null);
 assert.deepEqual(await f.sources.exportSource({projectId:f.selected.project.id,sourceId:ref.sourceId,version:2}),Buffer.from('Xxact 😀\r\n'));
});
test('historical Code, Docs, readonly policy and Lock cannot obtain a native working-source admission',async t=>{
 const f=await fixture(t),ref=f.refs[0];await f.registry.openView({role:'code',entityId:ref.sourceId,version:1});
 for(const grant of [f.registry.capture(f.event(1)),f.registry.capture(f.event(2)),{...f.grant()}])assert.equal((await f.working.admit(grant)).code,'ACCESS_REFUSED');
 f.disable();assert.equal((await f.working.admit(f.grant())).code,'ACCESS_REFUSED');assert.equal(f.working.isWorking(f.grant()),false);
 f.lock();assert.equal((await f.working.admit(f.grant())).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('working-source pause, disposal and removed selected membership revoke cached draft references',async t=>{
 const f=await fixture(t),grant=f.grant();assert.equal((await f.working.admit(grant)).ok,true);
 f.owner.pause('Lock');assert.equal((await f.working.admit(grant)).code,'WORKSPACE_PAUSED');f.owner.resume();
 f.selected.sourceRefs=[];assert.equal(f.working.referenceFor(grant),null);assert.equal(f.working.isWorking(grant),false);
 f.working.dispose();assert.equal(f.working.referenceFor(grant),null);assert.equal((await f.working.admit(grant)).code,'ACCESS_REFUSED');
});
