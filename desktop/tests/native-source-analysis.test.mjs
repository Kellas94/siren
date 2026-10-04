import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAnalysisWorker} from '../build/analysis.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {NativeSourceAnalysis} from '../src/windows/source-analysis.mjs';
import {selectedSourceReference} from '../src/windows/source-reads.mjs';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
let build,root;
test.before(async()=>{root=await mkdtemp(resolve('evidence/native-analysis-'));build=await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:root});});
test.after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
async function fixture(t,{beforeRead=async()=>{}}={}){
 const f=await sourceReadFixture();let snapshot=f.selected;
 const service=new NativeSourceAnalysis({registry:f.registry,owner:f.owner,referenceFor:grant=>selectedSourceReference(snapshot,f.registry,grant),repositoryFactory:({canWrite})=>{const repo=new SourceRepository(f.root,{canWrite}),read=repo.readVerifiedVersion.bind(repo);repo.readVerifiedVersion=async(...args)=>{await beforeRead();return read(...args);};return repo;},workerPath:build.workerPath,workerSha256:build.sha256});
 t.after(()=>service.dispose());return {...f,service,select:value=>{snapshot=value;},call:(method,payload,event=f.event(0))=>service.invoke({event,method,payload}),request:{sourceId:f.refs[0].sourceId,version:1,sha256:f.refs[0].sha256,kind:'index',jobId:'actual-job'}};
}
test('native analysis derives genuine selected Code ref, keeps project/source bytes intact and refuses other roles/frames/versions/raw fields',async t=>{
 const f=await fixture(t),r=await f.call('submit',f.request);assert.equal(r.ok,true);assert.equal(r.sourceId,f.refs[0].sourceId);assert.equal(r.status,'partial');assert.equal(JSON.stringify(r).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);
 for(const event of [f.event(1),{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame},{sender:f.event(0).sender,senderFrame:{...f.event(0).senderFrame}}])assert.equal((await f.call('submit',f.request,event)).code,'ACCESS_REFUSED');
 for(const extra of [{projectId:f.selected.project.id},{path:'C:/secret'},{text:'print(1)'},{budget:{maxNodes:200001}}])assert.equal((await f.call('submit',{...f.request,...extra})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('submit',{...f.request,version:2})).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal((await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:f.refs[0].sourceId})).version,1);
});
test('real pause/drain denies pending source publication and permits a fresh job only after resume',async t=>{
 const f=await fixture(t),pending=f.call('submit',f.request);f.owner.pause('test-lock');f.service.pause();assert.equal(await f.service.drain(),true);assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(f.service.isIdle(),true);
 assert.equal((await f.call('submit',f.request)).code,'ACCESS_REFUSED');f.owner.resume();f.service.resume();assert.equal((await f.call('submit',f.request)).ok,true);
});
test('two genuine captures from one native frame can cancel its pending load; another Code window cannot',async t=>{
 let started,release;const beginning=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{release=resolve;});const f=await fixture(t,{beforeRead:async()=>{started();await gate;}});
 const pending=f.call('submit',f.request);await beginning;await f.registry.openView({role:'code',entityId:f.refs[0].sourceId});
 assert.equal((await f.call('cancel',{jobId:f.request.jobId},f.event(2))).code,'ACCESS_REFUSED');
 const cancel=f.call('cancel',{jobId:f.request.jobId});release();const answer=await cancel,result=await pending;
 assert.equal(answer.ok,true);assert.equal(result.status,'cancelled');assert.equal(f.service.isIdle(),true);
});
