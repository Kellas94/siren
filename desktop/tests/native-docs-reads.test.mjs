import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';

const module=await import('../src/windows/docs-reads.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture(){
 const f=await sourceReadFixture();let selected=f.selected;
 const domains=new DomainRepository({projects:()=>new ProjectStore(f.root,{canSave:()=>false}),sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>new SourceRepository(f.root,{canWrite:()=>false}),domains,access:(_grant,scope)=>f.isUnlocked()&&scope.action==='read-domain'&&scope.domain==='docs'&&scope.entityId==='doc-a'});
 assert.equal(typeof module.NativeDocsReads,'function','Native scoped Docs reading must be implemented');
 const service=new module.NativeDocsReads({registry:f.registry,owner,documentFor:()=>JSON.parse(selected.json).workpapers.find(doc=>doc.id==='doc-a')});
 return {...f,owner,domains,service,call:(method='getDocument',payload,event=f.event(1))=>service.invoke({event,method,payload}),select:value=>{selected=value;}};
}
test('native Docs receives only its exact selected document through a readonly context',async()=>{
 const f=await fixture(),result=await f.call();assert.equal(result.ok,true);assert.equal(result.readonly,true);assert.equal(result.document.id,'doc-a');assert.equal(result.document.private,'PLANTED_DOCS_PRIVATE_CONTENT');
 assert.equal(JSON.stringify(result).includes('foreign secret'),false);assert.equal(result.project,undefined);assert.equal(result.sources,undefined);assert.equal(result.snapshot,undefined);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.equal(result.sha256.length,64);
});
test('native Docs refuses source/primary spoofing, write methods, identity payloads and getters without opening another document',async()=>{
 const f=await fixture();for(const method of ['applyDocument','flushDocument','readProject','getMetrics'])assert.equal((await f.call(method,{})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('getDocument',undefined,f.event(0))).code,'ACCESS_REFUSED');assert.equal((await f.call('getDocument',{entityId:'doc-b'})).code,'REQUEST_REFUSED');
 let ran=false;const p=Object.defineProperty({},'projectId',{enumerable:true,get(){ran=true;return f.selected.project.id;}});assert.equal((await f.call('getDocument',p)).code,'REQUEST_REFUSED');assert.equal(ran,false);
 assert.equal((await f.call('getDocument',undefined,{sender:{...f.event(1).sender},senderFrame:f.event(1).senderFrame})).code,'ACCESS_REFUSED');
 f.lock();assert.equal((await f.call()).code,'ACCESS_REFUSED');
});
test('native Docs refuses publication after owner pause or selected document change during actual disk read',async()=>{
 const f=await fixture();let entered,release;const ready=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;}),original=f.domains.read.bind(f.domains);
 f.domains.read=async(...args)=>{const result=await original(...args);entered();await gate;return result;};
 const pending=f.call();await ready;f.owner.pause('Lock');release();const refused=await pending;assert.equal(refused.ok,false);assert.equal(refused.document,undefined);
 f.owner.resume();f.domains.read=original;f.select({...f.selected,json:JSON.stringify({workpapers:[{id:'doc-a',title:'changed selected content'}]})});
 assert.equal((await f.call()).code,'DOCUMENT_VERSION_CHANGED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('Docs preparation read is bound to its own genuine private ticket, cannot borrow Code or seal a read as persistence',async()=>{
 const f=await fixture(),grant=f.registry.capture(f.event(1));f.owner.pause('native-close-view');const nonce=f.owner.beginViewFlush(grant);
 assert.equal((await f.service.invoke({event:f.event(1),method:'getDocument',flushNonce:'forged'})).ok,false);
 assert.equal((await f.service.invoke({event:f.event(0),method:'getDocument',flushNonce:nonce})).ok,false);
 assert.equal((await f.call()).ok,false);const result=await f.service.invoke({event:f.event(1),method:'getDocument',flushNonce:nonce});assert.equal(result.ok,true);assert.equal(result.document.private,'PLANTED_DOCS_PRIVATE_CONTENT');
 assert.equal((await f.owner.finishViewFlush(grant,nonce)).ok,false);f.owner.resume();assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
