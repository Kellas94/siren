import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {EventEmitter} from 'node:events';
import * as controlModule from '../src/windows/control.mjs';
import * as barrierModule from '../src/windows/source-barrier.mjs';
const implementation=await import('../src/windows/primary.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('primary persistence has a native adapter',()=>assert.equal(typeof implementation.PrimaryPersistence,'function'));
async function fixture() {
 const root=await mkdtemp(join(tmpdir(),'siren-primary-')),projects=new ProjectStore(root),recovery=new RecoveryStore(root);
 const original=await projects.createProject({label:'Primary fixture',json:'{"original":true}'});
 let current=true,fault=async()=>{},checkpointFault=async()=>{},published=[];
 const scope={projectId:original.project.id,isCurrent:()=>current};
 const primary=typeof implementation.PrimaryPersistence==='function'?new implementation.PrimaryPersistence({
  projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite,fault:p=>fault(p)}),
  recovery:new RecoveryStore(root,{fault:p=>checkpointFault(p)}),onSelected:(value)=>published.push(value)
 }):null;
 const request=(json='{"changed":true}',purpose='workspace',baseRevision=1)=>({projectId:original.project.id,baseRevision,json,purpose});
 return {root,projects,recovery,original,scope,primary,request,published,setCurrent:v=>current=v,setFault:v=>fault=v,setCheckpointFault:v=>checkpointFault=v};
}
test('revocation at the actual legacy selection boundary retains the previous revision and pending work',async()=>{
 const f=await fixture();let allowed=true;
 const guarded=new ProjectStore(f.root,{canSave:()=>allowed,fault:async phase=>{if(phase==='before-select')allowed=false;}});
 const result=await guarded.saveProject(f.request());
 assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);
 assert.ok((await f.projects.listPending(f.original.project.id)).some(item=>item.json===f.request().json));
});
const check=(name,run)=>test(name,async()=>{assert.equal(typeof implementation.PrimaryPersistence,'function');await run(await fixture());});
check('primary save verifies the selected bytes and recovery point; private draft never changes the selected project',async f=>{
 const saved=await f.primary.save(f.request(),f.scope);assert.equal(saved.ok,true);assert.equal(saved.revision,2);
 assert.equal((await f.projects.readProject(f.original.project.id)).json,f.request().json);assert.equal(f.published.length,1);
 const privateRequest=f.request('{"private":"😀"}','recovery',2),draft=await f.primary.save(privateRequest,f.scope);assert.equal(draft.ok,true);
 const actual=await f.projects.readProject(f.original.project.id);assert.equal(actual.sha256,saved.sha256);assert.equal(actual.revision,2);assert.equal(f.published.length,1);
 const points=await f.recovery.scan(f.original.project.id);assert.ok(points.valid.some(p=>p.kind==='saved'&&p.snapshot.json===f.request().json));assert.ok(points.valid.some(p=>p.kind==='draft'&&p.snapshot.json===privateRequest.json));
});
check('checkpoint failure reports the real selected commit and keeps pending attempted bytes',async f=>{
 f.setCheckpointFault(async phase=>{if(phase==='checkpoint-verified')throw Object.assign(Error('fixture failure'),{code:'ENOSPC'});});
 const result=await f.primary.save(f.request(),f.scope);assert.equal(result.ok,false);assert.equal(result.code,'RECOVERY_DEGRADED');assert.equal(result.workspaceCommitted,true);assert.equal(result.committedRevision,2);assert.equal(result.checkpointAcknowledged,false);
 assert.equal((await f.projects.readProject(f.original.project.id)).sha256,result.committedSha256);assert.ok((await f.projects.listPending(f.original.project.id)).length);
});
check('foreign project, getters and stale CAS cannot mutate or publish primary work',async f=>{
 let evaluated=false;const hostile=f.request();Object.defineProperty(hostile,'json',{enumerable:true,get:()=>{evaluated=true;return '{}';}});
 assert.equal((await f.primary.save(hostile,f.scope)).code,'REQUEST_REFUSED');assert.equal(evaluated,false);
 assert.equal((await f.primary.save({...f.request(),projectId:'foreign'},f.scope)).code,'ACCESS_REFUSED');
 assert.equal((await f.primary.save(f.request(),f.scope)).ok,true);assert.equal((await f.primary.save(f.request('{"stale":true}'),f.scope)).code,'REVISION_CONFLICT');assert.equal(f.published.length,1);
});
check('revocation during checkpoint cannot acknowledge or publish to a later selected project',async f=>{
 f.setCheckpointFault(async phase=>{if(phase==='checkpoint-verified')f.setCurrent(false);});
 const result=await f.primary.save(f.request(),f.scope);assert.equal(result.code,'ACCESS_REFUSED');
 // Selected bytes were committed while authorized; the old frame receives no success.
 assert.equal((await f.projects.readProject(f.original.project.id)).revision,2);assert.equal(f.published.length,0);assert.ok((await f.projects.listPending(f.original.project.id)).length);
});
check('legacy primary saves cannot downgrade a selected source manifest or strip source refs',async f=>{
 const sources=new SourceRepository(f.root),ref=await sources.importSource({projectId:f.original.project.id,bytes:Buffer.from('print(1)')});
 assert.equal((await commitManifest({projects:f.projects,repository:sources,projectId:f.original.project.id,baseRevision:1,sourceRefs:[ref],metadata:{keep:true},operationId:'upgrade-fixture'})).ok,true);
 const manifest=await f.projects.readProject(f.original.project.id);assert.equal((await f.primary.save(f.request('{}','workspace',manifest.revision),f.scope)).code,'SCHEMA_UNSUPPORTED');assert.deepEqual(await f.projects.readProject(f.original.project.id),manifest);
});
test('one owner orders primary and domain persistence; copied intent and revoked captures cannot cross scope',async()=>{
 assert.equal(typeof implementation.PrimaryPersistence,'function');
 let current=true,release,entered;const blocked=new Promise(done=>release=done),started=new Promise(done=>entered=done),calls=[];
 const grant=Object.freeze({role:'workspace',projectId:'owned',entityIds:['doc-a'],windowId:'window-a'}),event={sender:{},senderFrame:{}};
 const registry={isCurrent:g=>g===grant&&current,eventFor:g=>g===grant?event:null,caller:()=>grant};
 const owner=new WorkspaceCoordinator({registry,sources:()=>({}),access:()=>true,primary:{save:async request=>{calls.push(request.json);entered();await blocked;return {ok:true,revision:2,sha256:'a'.repeat(64)};}},domains:{read:async()=>{},flush:async()=>{},apply:async()=>{calls.push('domain');return {ok:false,code:'FIXTURE_STOP'};}}});
 const payload={projectId:'owned',baseRevision:1,json:'{"captured":true}',purpose:'workspace'};
 const first=owner.invoke(grant,{kind:'workspace',method:'saveProject',payload});await started;payload.json='{"mutated":true}';
 const second=owner.invoke(grant,{kind:'docs',method:'applyDocument',payload:{operationId:'doc-edit',documentId:'doc-a',expectedVersion:'b'.repeat(64),action:'rename',payload:{title:'A'}}});
 assert.deepEqual(calls,['{"captured":true}']);release();assert.equal((await first).ok,true);await second;assert.deepEqual(calls,['{"captured":true}','domain']);
 assert.equal((await owner.invoke({...grant},{kind:'workspace',method:'saveProject',payload})).code,'ACCESS_REFUSED');
 current=false;assert.equal((await owner.invoke(grant,{kind:'workspace',method:'saveProject',payload})).code,'ACCESS_REFUSED');
});
test('primary capacity remains 64 MiB independently of the 16 MiB source queue; aggregate admission is bounded',async()=>{
 let release,entered;const gate=new Promise(done=>release=done),started=new Promise(done=>entered=done);
 const grant={role:'workspace',projectId:'owned'},event={sender:{},senderFrame:{}};
 const registry={isCurrent:g=>g===grant,eventFor:()=>event,caller:()=>grant};
 const owner=new WorkspaceCoordinator({registry,sources:()=>({}),access:()=>true,primary:{save:async()=>{entered();await gate;return {ok:true,revision:2,sha256:'a'.repeat(64)};}}});
 const payload={projectId:'owned',baseRevision:1,json:JSON.stringify({text:'x'.repeat(33*1024*1024)}),purpose:'workspace'};
 const pending=owner.saveWorkspace(grant,payload);await started;
 try {assert.equal((await owner.saveWorkspace(grant,payload)).code,'OWNER_BUDGET');owner.pause('transition');assert.equal((await owner.saveWorkspace(grant,payload)).code,'WORKSPACE_PAUSED');}
 finally{release();await pending;}
});
test('receipt accessors and extra fields cannot fabricate primary persistence acknowledgements',()=>{
 assert.equal(typeof implementation.projectWorkspaceResult,'function');let ran=false;
 const receipt={revision:2,sha256:'a'.repeat(64)};Object.defineProperty(receipt,'ok',{enumerable:true,get:()=>{ran=true;return true;}});
 assert.equal(implementation.projectWorkspaceResult(receipt).ok,false);assert.equal(ran,false);
 assert.equal(implementation.projectWorkspaceResult({ok:true,revision:2,sha256:'a'.repeat(64),path:'C:/private'}).code,'WORKSPACE_RESULT_REFUSED');
});
check('native primary seals re-read real saved and private checkpoints; old or degraded receipts cannot prove latest work',async f=>{
 assert.equal(typeof f.primary.verify,'function');
 const first=await f.primary.save(f.request(),f.scope),scope={...f.scope,purpose:'workspace'};
 assert.equal((await f.primary.verify(first,scope)).ok,true);
 const draft=await f.primary.save(f.request('{"private":true}','recovery',2),f.scope);
 assert.equal((await f.primary.verify(draft,{...f.scope,purpose:'recovery'})).ok,true);
 const next=await f.primary.save(f.request('{"newest":true}','workspace',2),f.scope);
 assert.equal((await f.primary.verify(first,scope)).code,'WORKSPACE_VERSION_CHANGED');assert.equal((await f.primary.verify(next,scope)).ok,true);
 f.setCheckpointFault(async()=>{throw Error('fixture checkpoint failure');});
 const degraded=await f.primary.save(f.request('{"unsafely-new":true}','workspace',3),f.scope);assert.equal(degraded.code,'RECOVERY_DEGRADED');
 assert.equal((await f.primary.verify(next,scope)).ok,false);
});
check('paused primary flush accepts only its original native frame and seals both saved work and private recovery',async f=>{
 const grant={role:'workspace',projectId:f.original.project.id,entityIds:[],windowId:'primary-native'},event={sender:{},senderFrame:{}};
 const registry={isCurrent:g=>g===grant,eventFor:()=>event,caller:()=>grant};
 const owner=new WorkspaceCoordinator({registry,sources:()=>({}),access:()=>true,primary:f.primary});
 owner.pause('lock');const nonce=owner.beginViewFlush(grant);
 assert.equal((await owner.invoke({...grant},{kind:'workspace',method:'saveProject',payload:f.request()},nonce)).code,'ACCESS_REFUSED');
 const saved=await owner.invoke(grant,{kind:'workspace',method:'saveProject',payload:f.request()},nonce);assert.equal(saved.ok,true);
 const draft=await owner.invoke(grant,{kind:'workspace',method:'saveProject',payload:f.request('{"private":true}','recovery',2)},nonce);assert.equal(draft.ok,true);
 const sealed=await owner.finishViewFlush(grant,nonce);assert.equal(sealed.ok,true);assert.equal(sealed.receipts.length,2);
 const reconciled=await owner.reconcileWorkspaceReceipts([grant],sealed.receipts,()=>true);assert.equal(reconciled.ok,true);assert.deepEqual(reconciled.refs.map(r=>r.purpose).sort(),['recovery','workspace']);
 assert.equal((await owner.saveWorkspace(grant,f.request('{}','workspace',2))).code,'WORKSPACE_PAUSED');owner.resume();
});
test('primary capture survives a genuine entity removal while old source authority is revoked',()=>{
 const window=new EventEmitter();window.id=1;window.isDestroyed=()=>false;window.webContents=new EventEmitter();Object.assign(window.webContents,{id:101,mainFrame:{url:'siren://app/app.html'},getURL:()=>window.webContents.mainFrame.url,isDestroyed:()=>false});
 const policy={projectId:'owned',mode:'normal',access:'write',entityIds:['doc-old']};
 const registry=new WindowRegistry({createWindow:()=>{},authorize:()=>policy});registry.bindWorkspace(window);registry.activateWorkspace();
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame},source=registry.capture(event);
 assert.equal(typeof registry.capturePrimary,'function');const primary=registry.capturePrimary(event);assert.deepEqual(primary.entityIds,[]);
 policy.entityIds=['doc-new'];assert.equal(registry.isCurrent(source),false);assert.equal(registry.isCurrent(primary),true);
 assert.deepEqual(registry.capture(event).entityIds,['doc-new']);assert.equal(registry.capturePrimary({...event,senderFrame:{url:'siren://app/app.html'}}),null);
 registry.invalidateEpoch({preserveWorkspace:true});assert.equal(registry.isCurrent(primary),false);
});
check('a native readonly seal verifies schema-2 source recovery without rewriting or downgrading the project',async f=>{
 assert.equal(typeof f.primary.sealReadonly,'function');
 const sources=new SourceRepository(f.root),ref=await sources.importSource({projectId:f.original.project.id,bytes:Buffer.from('print("readonly")')});
 assert.equal((await commitManifest({projects:f.projects,repository:sources,projectId:f.original.project.id,baseRevision:1,sourceRefs:[ref],metadata:{future:'kept'},operationId:'readonly-fixture'})).ok,true);
 const manifest=await f.projects.readProject(f.original.project.id);
 const primary=new implementation.PrimaryPersistence({projects:()=>f.projects,recovery:new RecoveryStore(f.root,{sources})});
 const scope={...f.scope,readonly:true,purpose:'readonly'},sealed=await primary.sealReadonly(scope);assert.equal(sealed.ok,true);assert.equal((await primary.verify(sealed,scope)).ok,true);
 assert.deepEqual(await f.projects.readProject(f.original.project.id),manifest);assert.equal((await primary.sealReadonly({...scope,readonly:false})).code,'ACCESS_REFUSED');
});
check('readonly preparation reuses an exact verified saved checkpoint without duplicating recovery histories',async f=>{
 const point=await f.recovery.checkpointProject({snapshot:f.original,kind:'saved'});let created=0;
 f.recovery.checkpointProject=async()=>{created++;throw Error('No duplicate saved checkpoint');};
 const primary=new implementation.PrimaryPersistence({projects:()=>f.projects,recovery:f.recovery});
 const scope={...f.scope,readonly:true,purpose:'readonly'},sealed=await primary.sealReadonly(scope);
 assert.equal(sealed.ok,true,JSON.stringify(sealed));assert.equal((await primary.verify(sealed,scope)).ok,true);assert.equal(created,0);
 assert.equal((await f.recovery.scan(f.original.project.id)).valid.length,1);assert.deepEqual((await f.recovery.readProjectPoint(f.original.project.id,point.id)).snapshot,f.original);
});
check('genuine primary roster preparation requires a native persisted seal before transition authority',async f=>{
 assert.equal(typeof controlModule.NativeAllViewControl,'function');assert.equal(typeof barrierModule.NativeAllWorkspaceBarrier,'function');
 const window=new EventEmitter();window.id=1;window.isDestroyed=()=>false;window.isMinimized=()=>true;
 window.webContents=new EventEmitter();Object.assign(window.webContents,{id:101,mainFrame:{url:'siren://app/app.html'},getURL:()=>window.webContents.mainFrame.url,isDestroyed:()=>false});
 const registry=new WindowRegistry({createWindow:()=>{},authorize:()=>({projectId:f.original.project.id,mode:'normal',access:'write',entityIds:[]})});registry.bindWorkspace(window);registry.activateWorkspace();
 const owner=new WorkspaceCoordinator({registry,sources:()=>({}),access:()=>true,primary:f.primary});let covered=false;
 const control=new controlModule.NativeAllViewControl({registry,owner,send:(event,request)=>{void(async()=>{const grant=registry.capturePrimary(event);const result=await owner.invoke(grant,{kind:'workspace',method:'saveProject',payload:f.request()},request.nonce);await control.acknowledge(event,{requestId:request.requestId,ok:result.ok});})();}});
 const barrier=new barrierModule.NativeAllWorkspaceBarrier({registry,owner,control,cover:()=>covered=true});
 const prepared=await barrier.prepare('lock');assert.equal(covered,true);assert.equal(prepared.ok,true);assert.equal(prepared.proof.refs[0].domain,'workspace');assert.equal(barrier.isPrepared(prepared.proof),true);
 assert.equal(barrier.release(prepared.proof),true);assert.equal(barrier.isPrepared(prepared.proof),false);control.dispose();barrier.dispose();
});
check('checkpoint proof reads only its owned project and exact point instead of scanning every project',async f=>{
 assert.equal(typeof f.recovery.readProjectPoint,'function');const point=await f.recovery.checkpointProject({snapshot:f.original,kind:'saved'});
 f.recovery.scan=async()=>{throw Error('A global scan must not run');};
 assert.deepEqual((await f.recovery.readProjectPoint(f.original.project.id,point.id)).snapshot,f.original);
 await assert.rejects(f.recovery.readProjectPoint('../foreign',point.id));await assert.rejects(f.recovery.readProjectPoint(f.original.project.id,'../foreign'));
});
