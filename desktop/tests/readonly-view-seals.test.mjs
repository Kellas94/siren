import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {NativeViewControl,NativeAllViewControl} from '../src/windows/control.mjs';
import {NativeWorkspaceBarrier,NativeAllWorkspaceBarrier} from '../src/windows/source-barrier.mjs';
const implementation=await import('../src/windows/readonly-seals.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture({presentation=false}={}){
 assert.equal(typeof implementation.NativeReadonlyViewSeals,'function');
 const root=await mkdtemp(join(tmpdir(),'siren-readonly-seals-')),projects=new ProjectStore(root),sources=new SourceRepository(root);
 const initial=await projects.createProject({label:'Readonly seal owner',json:'{}'}),projectId=initial.project.id;
 const ref=await sources.importSource({projectId,bytes:Buffer.from('print("exact Ș😀")\r\n')}),other=await sources.importSource({projectId,bytes:Buffer.from('PRIVATE_OTHER_SOURCE')});
 const doc={id:'doc-a',title:'Selected document',content:'Exact context',releases:[{verdict:'not-run'}]},metadata={workpapers:[doc,{id:'doc-b',content:'PRIVATE_OTHER_DOC'}],...(presentation?{diagrams:[{id:'deck-a',source:'flowchart TD\nA-->B',presentation:{notes:{overview:{text:'PRIVATE_NOTES'}}}}]}:{})};
 assert.equal((await commitManifest({projects,repository:sources,projectId,baseRevision:1,sourceRefs:[ref,other],metadata,operationId:'readonly-seal-start'})).ok,true);
 const before=await projects.readProject(projectId);let serial=1,unlocked=true,readonly=true,hook=async()=>{};
 const windows=[];const registry=new WindowRegistry({authorize:request=>unlocked?{projectId,mode:'normal',access:request.role==='audience'?'presentation':'read',entityIds:[ref.sourceId,other.sourceId,'doc-a','doc-b',...(presentation?['deck-a']:[])]}:null,createWindow:async options=>{
  const window=new EventEmitter();window.id=serial++;window.isDestroyed=()=>false;window.isMinimized=()=>false;window.restore=window.focus=window.close=window.destroy=()=>{};
  const wc=new EventEmitter();Object.assign(wc,{id:window.id+100,mainFrame:{url:options.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false});window.webContents=wc;windows.push(window);return window;
 }});
 await registry.openView({role:'code',entityId:ref.sourceId,version:1});await registry.openView({role:'docs',entityId:'doc-a'});
 if(presentation)for(const role of ['presenter','audience'])await registry.openView({role,entityId:'deck-a'});
 const grant=index=>registry.capture({sender:windows[index].webContents,senderFrame:windows[index].webContents.mainFrame});
 const seals=new implementation.NativeReadonlyViewSeals({registry,isReadonly:g=>readonly&&['code','docs',...(presentation?['presenter','audience']:[])].includes(g.role),snapshotFor:async()=>{await hook();return projects.readProject(projectId);},sources:({canWrite})=>new SourceRepository(root,{canWrite})});
 return {root,projects,sources,ref,other,doc,before,projectId,registry,windows,grant,seals,setUnlocked:value=>unlocked=value,setReadonly:value=>readonly=value,setHook:value=>hook=value};
}

test('native Presenter and zero-entity Audience need exact readonly deck proofs during all-view preparation',async()=>{
 const f=await fixture({presentation:true});assert.deepEqual(f.grant(3).entityIds,[]);
 const receipt=await f.seals.seal(f.grant(3),{isCurrent:()=>true});assert.equal(receipt.ok,true);assert.equal(receipt.domain,'presentation');assert.equal(receipt.entityId,'deck-a');assert.equal(JSON.stringify(receipt).includes('PRIVATE'),false);
 assert.equal(await f.seals.verify(f.grant(3),{...receipt},{isCurrent:()=>true}),false);
 const domains=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>false}),owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains,access:()=>true,readonlyViews:f.seals});
 const control=new NativeAllViewControl({registry:f.registry,owner,send:(event,request)=>{void control.acknowledge(event,{requestId:request.requestId,ok:true});}}),barrier=new NativeAllWorkspaceBarrier({registry:f.registry,owner,control,cover:()=>{}});
 try{const prepared=await barrier.prepare('lock');assert.equal(prepared.ok,true);assert.equal(prepared.proof.refs.filter(r=>r.domain==='presentation').length,2);assert.equal(barrier.isPrepared(prepared.proof),true);assert.deepEqual(await f.projects.readProject(f.projectId),f.before);}finally{control.dispose();barrier.dispose();}
});
test('changed private notes invalidate a genuine presentation seal without giving Audience content authority',async()=>{
 const f=await fixture({presentation:true}),receipt=await f.seals.seal(f.grant(3),{isCurrent:()=>true});assert.equal(receipt.ok,true);
 const metadata=JSON.parse(f.before.json);metadata.diagrams[0].presentation.notes.overview.text='CHANGED_PRIVATE';
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.projectId,baseRevision:f.before.revision,sourceRefs:f.before.sourceRefs,metadata,operationId:'changed-presentation-notes'})).ok,true);
 assert.equal(await f.seals.verify(f.grant(3),receipt,{isCurrent:()=>true}),false);
});

test('zero-entity Audience cannot prepare without genuine native readonly classification',async()=>{
 const f=await fixture({presentation:true});assert.deepEqual(f.grant(3).entityIds,[]);f.setReadonly(false);
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,access:()=>true,readonlyViews:f.seals});
 owner.pause('lock');await owner.drain();
 const result=await owner.reconcileWorkspaceReceipts([f.grant(3)],[],()=>true);
 assert.equal(result.ok,false);assert.equal(result.code,'READONLY_PROOF_FAILED');
 assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
});
test('readonly Code seals the exact selected historical source without committing a newer private draft',async()=>{
 const f=await fixture();assert.equal((await f.sources.applyEdit({projectId:f.projectId,edit:{sourceId:f.ref.sourceId,expectedVersion:1,operationId:'newer-private',start:0,end:0,insertedText:'UNSELECTED_DRAFT\n'}})).ok,true);
 const grant=f.grant(0),receipt=await f.seals.seal(grant,{isCurrent:()=>true});
 assert.deepEqual(receipt,{ok:true,domain:'source',purpose:'readonly',entityId:f.ref.sourceId,sourceId:f.ref.sourceId,version:1,sha256:f.ref.sha256,durability:'readonly'});
 assert.equal(await f.seals.verify(f.grant(0),receipt,{isCurrent:()=>true}),true);
 assert.equal(await f.seals.verify(f.grant(0),{...receipt},{isCurrent:()=>true}),false);
 assert.equal((await f.sources.getMetrics({projectId:f.projectId,sourceId:f.ref.sourceId})).version,2);
 assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
});
test('readonly Docs seals only its exact selected document with native provenance and no content projection',async()=>{
 const f=await fixture(),receipt=await f.seals.seal(f.grant(1),{isCurrent:()=>true});
 assert.deepEqual(receipt,{ok:true,domain:'docs',purpose:'readonly',entityId:'doc-a',version:documentVersion(f.before,'doc-a'),sha256:digest(Buffer.from(JSON.stringify(f.doc))),projectRevision:f.before.revision,durability:'readonly'});
 assert.equal(await f.seals.verify(f.grant(1),receipt,{isCurrent:()=>true}),true);
 assert.equal(JSON.stringify(receipt).includes('Exact context'),false);assert.equal(JSON.stringify(receipt).includes('PRIVATE_OTHER'),false);
 assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
});
test('copied native captures, writable classification and changed Lock scope cannot issue readonly seals',async()=>{
 const f=await fixture();assert.equal((await f.seals.seal({...f.grant(0)},{isCurrent:()=>true})).code,'ACCESS_REFUSED');
 f.setReadonly(false);assert.equal((await f.seals.seal(f.grant(0),{isCurrent:()=>true})).code,'ACCESS_REFUSED');
 f.setReadonly(true);const grant=f.grant(1);f.setHook(async()=>f.setUnlocked(false));
 assert.equal((await f.seals.seal(grant,{isCurrent:()=>true})).code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
});
test('changed selected document or removed source reference invalidates a genuine readonly receipt',async()=>{
 for(const role of ['docs','code']){
  const f=await fixture(),index=role==='docs'?1:0,receipt=await f.seals.seal(f.grant(index),{isCurrent:()=>true});assert.equal(receipt.ok,true);
  const metadata=JSON.parse(f.before.json);if(role==='docs')metadata.workpapers[0].content='New exact context';
  assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.projectId,baseRevision:f.before.revision,sourceRefs:role==='code'?[f.other]:f.before.sourceRefs,metadata,operationId:'changed-'+role})).ok,true);
  assert.equal(await f.seals.verify(f.grant(index),receipt,{isCurrent:()=>true}),false);
 }
});
test('readonly seal keeps actual source corruption as a refusal without manufacturing durability',async()=>{
 const f=await fixture(),{writeFile}=await import('node:fs/promises');
 await writeFile(join(f.root,'Projects',f.projectId,'Sources',f.ref.sourceId,'blobs',f.ref.sha256+'.bin'),'damaged');
 assert.equal((await f.seals.seal(f.grant(0),{isCurrent:()=>true})).ok,false);
 assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
});
test('a native readonly Code/Docs roster prepares without committing the unselected draft or pretending to save',async()=>{
 const f=await fixture();await f.sources.applyEdit({projectId:f.projectId,edit:{sourceId:f.ref.sourceId,expectedVersion:1,operationId:'barrier-private',start:0,end:0,insertedText:'PRIVATE_DRAFT\n'}});
 const domains=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains,access:()=>true,readonlyViews:f.seals});
 const control=new NativeViewControl({registry:f.registry,owner,send:(event,request)=>{void control.acknowledge(event,{requestId:request.requestId,ok:true});}});
 const covered=[],barrier=new NativeWorkspaceBarrier({registry:f.registry,owner,control,cover:g=>covered.push(g.role)});
 try{
  const prepared=await barrier.prepare('home');assert.equal(prepared.ok,true);assert.deepEqual(covered.sort(),['code','docs']);
  assert.deepEqual(prepared.proof.refs.map(r=>[r.domain,r.entityId,r.durability]).sort(),[['docs','doc-a','readonly'],['source',f.ref.sourceId,'readonly']].sort());
  assert.equal(prepared.proof.refs.find(r=>r.domain==='source').version,1);assert.equal(barrier.isPrepared(prepared.proof),true);
  assert.equal((await f.sources.getMetrics({projectId:f.projectId,sourceId:f.ref.sourceId})).version,2);
  assert.deepEqual(await f.projects.readProject(f.projectId),f.before);assert.equal(barrier.release(prepared.proof),true);
 }finally{control.dispose();barrier.dispose();}
});
test('an empty acknowledgement still cannot prepare a writable Code/Docs roster',async()=>{
 const f=await fixture();f.setReadonly(false);const domains=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains,access:()=>true,readonlyViews:f.seals});
 const control=new NativeViewControl({registry:f.registry,owner,send:(event,request)=>{void control.acknowledge(event,{requestId:request.requestId,ok:true});}}),barrier=new NativeWorkspaceBarrier({registry:f.registry,owner,control,cover:()=>{}});
 try{const prepared=await barrier.prepare('home');assert.equal(prepared.code,'VIEW_FLUSH_FAILED');assert.deepEqual(await f.projects.readProject(f.projectId),f.before);}finally{control.dispose();barrier.dispose();}
});
test('readonly classification refuses source writes even with a genuine draining nonce',async()=>{
 const f=await fixture(),owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,access:()=>true,readonlyViews:f.seals});
 owner.pause('home');const grant=f.grant(0),nonce=owner.beginViewFlush(grant);
 const result=await owner.invoke(grant,{kind:'source',method:'applyEdit',payload:{sourceId:f.ref.sourceId,expectedVersion:1,operationId:'forbidden-readonly',start:0,end:0,insertedText:'MUST_NOT_WRITE'}},nonce);
 assert.equal(result.code,'ACCESS_REFUSED');assert.equal((await f.sources.getMetrics({projectId:f.projectId,sourceId:f.ref.sourceId})).version,1);assert.deepEqual(await f.projects.readProject(f.projectId),f.before);
 owner.cancelViewFlush(grant,nonce);
});
test('an unversioned Code admission cannot seal whichever source version later happens to be selected',async()=>{
 const f=await fixture();await f.registry.openView({role:'code',entityId:f.ref.sourceId});
 assert.equal((await f.seals.seal(f.grant(2),{isCurrent:()=>true})).code,'SOURCE_VERSION_CHANGED');
});
