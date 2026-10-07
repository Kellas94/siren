import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAnalysisWorker} from '../build/analysis.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {NativeSourceAnalysis} from '../src/windows/source-analysis.mjs';
import {selectedSourceReference} from '../src/windows/source-reads.mjs';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeWorkingSources} from '../src/windows/working-sources.mjs';
import {selectedCodeMetadata} from '../src/windows/source-context.mjs';
let build,root;
const identity=({sourceId,version,sha256})=>({sourceId,version,sha256});
test.before(async()=>{root=await mkdtemp(resolve('evidence/native-analysis-'));build=await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:root});});
test.after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
async function fixture(t,{beforeRead=async()=>{},languageFor,displayNameFor}={}){
 const f=await sourceReadFixture();let snapshot=f.selected;
 const service=new NativeSourceAnalysis({registry:f.registry,owner:f.owner,languageFor,displayNameFor,windowsFor:()=>f.windows,referenceFor:grant=>selectedSourceReference(snapshot,f.registry,grant),repositoryFactory:({canWrite})=>{const repo=new SourceRepository(f.root,{canWrite}),read=repo.readVerifiedVersion.bind(repo);repo.readVerifiedVersion=async(...args)=>{await beforeRead(...args);return read(...args);};return repo;},workerPath:build.workerPath,workerSha256:build.sha256});
 t.after(()=>service.dispose());return {...f,service,select:value=>{snapshot=value;},call:(method,payload,event=f.event(0))=>service.invoke({event,method,payload}),request:{sourceId:f.refs[0].sourceId,version:1,sha256:f.refs[0].sha256,kind:'index',jobId:'actual-job'}};
}
test('owner-recorded text refuses Python inspection before source I/O but permits exact saved text comparison with bounded labels',async t=>{
 let reads=0;const f=await fixture(t,{beforeRead:async()=>{reads++;},languageFor:()=> 'text',displayNameFor:()=> 'same Ș.py'});
 const refused=await f.call('submit',f.request);assert.equal(refused.code,'LANGUAGE_NOT_SUPPORTED');assert.equal(reads,0);
 const other=await f.registry.openView({role:'code',entityId:f.refs[1].sourceId}),choices=await f.call('listComparisons',{});assert.equal(choices.items[0].displayName,'same Ș.py');assert.deepEqual(choices.items[0].sourceRef,identity(f.refs[1]));
 assert.equal((await f.call('submit',{...f.request,kind:'diff',rightWindowId:other.windowId,rightRef:identity(f.refs[1])})).ok,true);assert.equal(reads,2);
});
test('native analysis derives genuine selected Code ref, keeps project/source bytes intact and refuses other roles/frames/versions/raw fields',async t=>{
 const f=await fixture(t),r=await f.call('submit',f.request);assert.equal(r.ok,true);assert.equal(r.sourceId,f.refs[0].sourceId);assert.equal(r.status,'partial');assert.equal(JSON.stringify(r).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);
 for(const event of [f.event(1),{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame},{sender:f.event(0).sender,senderFrame:{...f.event(0).senderFrame}}])assert.equal((await f.call('submit',f.request,event)).code,'ACCESS_REFUSED');
 for(const extra of [{projectId:f.selected.project.id},{path:'C:/secret'},{text:'print(1)'},{budget:{maxNodes:200001}}])assert.equal((await f.call('submit',{...f.request,...extra})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('submit',{...f.request,version:2})).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal((await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:f.refs[0].sourceId})).version,1);
});

test('native comparison derives both refs from genuine open Code frames, never renderer scope',async t=>{
 const f=await fixture(t),other=await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});
 const choices=await f.call('listComparisons',{});assert.equal(choices.ok,true);assert.equal(choices.items.length,1);assert.equal(choices.items[0].windowId,other.windowId);assert.deepEqual(choices.items[0].sourceRef,identity(f.refs[1]));
 const request={...f.request,kind:'diff',rightWindowId:other.windowId,rightRef:identity(f.refs[1])};
 const result=await f.call('submit',request);assert.equal(result.ok,true);assert.equal(result.status,'complete');assert.deepEqual(result.rightRef,identity(f.refs[1]));assert.equal(result.result.hunks.length,1);
 for(const change of [{rightWindowId:'made-up'},{rightRef:f.refs[0]},{rightRef:{...f.refs[1],version:2}},{rightWindowId:f.registry.listViews().find(view=>view.role==='docs').windowId},{text:'secret'}])assert.equal((await f.call('submit',{...request,...change})).ok,false);
 assert.equal((await f.call('listComparisons',{},f.event(1))).code,'ACCESS_REFUSED');
 assert.equal((await f.call('listComparisons',{projectId:f.selected.project.id})).code,'REQUEST_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});

test('comparison rechecks the other real frame during source I/O and drains cancellation',async t=>{
 let reads=0,started,release;const beginning=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});
 const f=await fixture(t,{beforeRead:async()=>{if(++reads===2){started();await gate;}}}),other=await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});
 const request={...f.request,kind:'diff',rightWindowId:other.windowId,rightRef:identity(f.refs[1])};
 const pending=f.call('submit',request);
 try{await Promise.race([beginning,pending.then(()=>{throw Error('Comparison never loaded its right source');})]);f.windows[2].webContents.mainFrame.url='siren://app/windows/docs.html';release();assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(f.service.isIdle(),true);}finally{release();await pending;}
});
test('real pause/drain denies pending source publication and permits a fresh job only after resume',async t=>{
 const f=await fixture(t),pending=f.call('submit',f.request);f.owner.pause('test-lock');f.service.pause();assert.equal(await f.service.drain(),true);assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(f.service.isIdle(),true);
 assert.equal((await f.call('submit',f.request)).code,'ACCESS_REFUSED');f.owner.resume();f.service.resume();assert.equal((await f.call('submit',f.request)).ok,true);
});

test('selected map uses the same genuine immutable Code frame authority and refuses Docs or missing ranges',async t=>{
 const f=await fixture(t),request={...f.request,kind:'map',range:{from:0,to:5}},result=await f.call('submit',request);assert.equal(result.ok,true);assert.equal(result.result.semantics,'syntax-containment');assert.equal(result.coverage.from,0);assert.equal(result.coverage.to,5);
 assert.equal((await f.call('submit',request,f.event(1))).code,'ACCESS_REFUSED');assert.equal((await f.call('submit',{...request,range:undefined})).code,'REQUEST_REFUSED');assert.equal((await f.call('submit',{...request,text:'forged'})).code,'REQUEST_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('two genuine captures from one native frame can cancel its pending load; another Code window cannot',async t=>{
 let started,release;const beginning=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});const f=await fixture(t,{beforeRead:async()=>{started();await gate;}});
 const pending=f.call('submit',f.request);await beginning;await f.registry.openView({role:'code',entityId:f.refs[0].sourceId});
 assert.equal((await f.call('cancel',{jobId:f.request.jobId},f.event(2))).code,'ACCESS_REFUSED');
 const cancel=f.call('cancel',{jobId:f.request.jobId});release();const answer=await cancel,result=await pending;
 assert.equal(answer.ok,true);assert.equal(result.status,'cancelled');assert.equal(f.service.isIdle(),true);
});
test('production metadata adapter permits actual saved working Python v2 analysis while Docs and manifest remain v1',async t=>{
 const f=await sourceReadFixture(refs=>({workpapers:[{id:'doc-a',blocks:[{kind:'knowledge',rows:[{sourceRef:identity(refs[0]),fileType:'python',name:'agent.py'}]}]}]}));
 const owner=new WorkspaceCoordinator({registry:f.registry,access:()=>f.isUnlocked(),sources:({canWrite})=>new SourceRepository(f.root,{canWrite})});
 const working=new NativeWorkingSources({registry:f.registry,owner,enabled:()=>f.isUnlocked(),snapshotFor:()=>f.selected});t.after(()=>working.dispose());const grant=f.registry.capture(f.event(0));await working.admit(grant);
 const sourceId=f.refs[0].sourceId;assert.equal((await owner.invoke(grant,{kind:'source',method:'applyEdit',payload:{sourceId,expectedVersion:1,operationId:'metadata-analysis-edit',start:0,end:0,insertedText:'def real_saved():\n    return 1\n'}})).ok,true);
 assert.equal((await owner.invoke(grant,{kind:'source',method:'commitSource',payload:{sourceId,expectedVersion:2,operationId:'metadata-analysis-save'}})).ok,true);
 const service=new NativeSourceAnalysis({registry:f.registry,owner,referenceFor:g=>working.referenceFor(g),languageFor:(g,r)=>selectedCodeMetadata(f.selected,f.registry,working,g,r)?.language,repositoryFactory:({canWrite})=>new SourceRepository(f.root,{canWrite}),workerPath:build.workerPath,workerSha256:build.sha256});t.after(()=>service.dispose());
 const current=working.referenceFor(grant),answer=await service.invoke({event:f.event(0),method:'submit',payload:{...current,kind:'index',jobId:'saved-v2'}});assert.equal(answer.ok,true);assert.equal(answer.version,2);assert.equal(answer.result.definitions[0].name,'real_saved');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 f.lock();assert.equal((await service.invoke({event:f.event(0),method:'submit',payload:{...current,kind:'index',jobId:'after-lock'}})).code,'ACCESS_REFUSED');
});
