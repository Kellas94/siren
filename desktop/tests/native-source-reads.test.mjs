import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {NativeSourceReads,selectedSourceReference} from '../src/windows/source-reads.mjs';

async function fixture(t){
 const f=await sourceReadFixture();let snapshot=f.selected,wrap=reader=>reader,factories=0;
 const options={registry:f.registry,owner:f.owner,referenceFor:(grant,request)=>selectedSourceReference(snapshot,f.registry,grant,request),repositoryFactory:({canWrite,readers})=>{
  factories++;const repo=new SourceRepository(f.root,{canWrite,readers}),open=repo.openReader.bind(repo);repo.openReader=async args=>wrap(await open(args));return repo;
 }};
 const service=new NativeSourceReads(options);t.after(()=>service.dispose());
 return {...f,service,options,call:(method,payload,event=f.event(0))=>service.invoke({event,method,payload}),wrap:fn=>{wrap=fn;},select:value=>{snapshot=value;},factories:()=>factories};
}

test('working read context offers only an independently verified exact saved operation and rechecks Lock after proof',async t=>{
 const f=await fixture(t),ref=f.refs[0];
 const service=new NativeSourceReads({...f.options,readonlyFor:()=>false});t.after(()=>service.dispose());
 assert.equal(Object.hasOwn(await service.invoke({event:f.event(0),method:'getReference'}),'committedOperationId'),false);
 assert.equal((await f.sources.commitSource({projectId:f.selected.project.id,sourceId:ref.sourceId,expectedVersion:1,operationId:'actual-base-save'})).ok,true);
 assert.equal((await service.invoke({event:f.event(0),method:'getReference'})).committedOperationId,'actual-base-save');
 await f.sources.applyEdit({projectId:f.selected.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'later-edit',start:0,end:0,insertedText:'later '}});
 await f.sources.commitSource({projectId:f.selected.project.id,sourceId:ref.sourceId,expectedVersion:2,operationId:'later-save'});
 assert.equal(Object.hasOwn(await service.invoke({event:f.event(0),method:'getReference'}),'committedOperationId'),false);
 const racing=new NativeSourceReads({...f.options,readonlyFor:()=>false,repositoryFactory:options=>{const repository=f.options.repositoryFactory(options),load=repository.load.bind(repository);repository.load=async(...args)=>{const result=await load(...args);f.lock();return result;};return repository;}});t.after(()=>racing.dispose());
 assert.equal((await racing.invoke({event:f.event(0),method:'getReference'})).code,'ACCESS_REFUSED');
});

test('selected owner language is finite metadata and cannot alter immutable source admission',async t=>{
 const f=await fixture(t),service=new NativeSourceReads({...f.options,languageFor:()=> 'text'});t.after(()=>service.dispose());
 const result=await service.invoke({event:f.event(0),method:'getReference'});assert.equal(result.language,'text');assert.equal(result.sourceRef.sha256,f.refs[0].sha256);
 const invalid=new NativeSourceReads({...f.options,languageFor:()=> 'C:/PRIVATE/python'});t.after(()=>invalid.dispose());assert.equal((await invalid.invoke({event:f.event(0),method:'getReference'})).language,'unknown');
 f.lock();assert.equal((await service.invoke({event:f.event(0),method:'getReference'})).code,'ACCESS_REFUSED');
});
test('native Code reference is selected-version metadata only; historical admission and private capture checks remain exact',async t=>{
 const f=await fixture(t),ref=f.refs[0];
 assert.deepEqual(await f.call('getReference'),{ok:true,readonly:true,sourceRef:{sourceId:ref.sourceId,version:1,sha256:ref.sha256}});
 assert.equal(JSON.stringify(await f.call('getReference')).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);
 assert.equal((await f.call('getReference',{},f.event(1))).code,'ACCESS_REFUSED');
 assert.equal((await f.call('getReference',{sourceId:ref.sourceId})).code,'REQUEST_REFUSED');assert.equal(f.factories(),0);
 const grant=f.registry.capture(f.event(0));assert.equal(selectedSourceReference(f.selected,f.registry,{...grant}),null);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('native read session loads exact immutable bytes and closes without any source commit or metadata change',async t=>{
 const f=await fixture(t),ref=f.refs[0],opened=await f.call('openRead',{sourceId:ref.sourceId,version:1,sha256:ref.sha256});assert.equal(opened.ok,true);
 const payload={sourceId:ref.sourceId,version:1,readId:opened.readId};
 const chunk=await f.call('readChunk',{...payload,start:0,maxUnits:131072});assert.equal(chunk.text,'exact 😀\r\n');
 assert.equal((await f.call('closeRead',payload)).ok,true);assert.equal((await f.call('readChunk',{...payload,start:0,maxUnits:2})).code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal((await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:ref.sourceId})).version,1);
});
test('another registered Code window, Docs and a copied sender cannot consume a native read lease',async t=>{
 const f=await fixture(t),ref=f.refs[0],opened=await f.call('openRead',{sourceId:ref.sourceId,version:1,sha256:ref.sha256});assert.equal(opened.ok,true);
 await f.registry.openView({role:'code',entityId:f.refs[1].sourceId,version:1});
 const p={sourceId:ref.sourceId,version:1,readId:opened.readId,start:0,maxUnits:2};
 for(const event of [f.event(1),f.event(2),{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame}])assert.equal((await f.call('readChunk',p,event)).code,'ACCESS_REFUSED');
 assert.equal((await f.call('readChunk',p)).text,'ex');
});
test('native readonly readers refuse writes, unselected versions, changed references and getter payloads before repository creation',async t=>{
 const f=await fixture(t),ref=f.refs[0];
 for(const method of ['applyEdit','commitSource','readProject','exportSource'])assert.equal((await f.call(method,{})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('openRead',{sourceId:ref.sourceId,version:2,sha256:ref.sha256})).code,'ACCESS_REFUSED');
 let ran=false;const p={};Object.defineProperty(p,'sourceId',{enumerable:true,get:()=>{ran=true;return ref.sourceId;}});
 assert.equal((await f.call('openRead',p)).code,'REQUEST_REFUSED');assert.equal(ran,false);
 f.select({...f.selected,sourceRefs:[]});assert.equal((await f.call('getReference')).code,'ACCESS_REFUSED');assert.equal(f.factories(),0);
});
test('owner pause during a pending native chunk suppresses bytes and disposal makes every old read ID unusable',async t=>{
 const f=await fixture(t),ref=f.refs[0];let enter,release;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 f.wrap(reader=>({...reader,readChunk:async p=>{enter();await gate;return reader.readChunk(p);}}));
 const opened=await f.call('openRead',{sourceId:ref.sourceId,version:1,sha256:ref.sha256});assert.equal(opened.ok,true);
 const p={sourceId:ref.sourceId,version:1,readId:opened.readId,start:0,maxUnits:2},pending=f.call('readChunk',p);await entered;
 f.owner.pause('native transition');release();const result=await pending;assert.equal(result.code,'ACCESS_REFUSED');assert.equal(result.text,undefined);
 f.service.dispose();f.owner.resume();assert.equal((await f.call('getReference')).code,'ACCESS_REFUSED');
 const fresh=new NativeSourceReads(f.options);t.after(()=>fresh.dispose());assert.equal((await fresh.invoke({event:f.event(0),method:'readChunk',payload:p})).code,'ACCESS_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
