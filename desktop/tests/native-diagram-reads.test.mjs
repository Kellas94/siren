import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {diagramContext} from './fixtures/diagram-context.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
const module=await import('../src/windows/diagram-reads.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function fixture(t){
 const f=await diagramContext();t.after(()=>rm(f.root,{recursive:true,force:true}));assert.equal(typeof module.NativeDiagramReads,'function','Native scoped Diagram reader must exist');
 const service=new module.NativeDiagramReads({registry:f.registry,owner:f.owner,diagramFor:f.diagramFor});
 return {...f,service,call:(method='getDiagram',payload,event=f.event(0))=>service.invoke({event,method,payload})};
}
test('native Diagram receives only its actual selected entity, exact declared colour/source and readonly version/hash',async t=>{
 const f=await fixture(t),result=await f.call();assert.equal(result.ok,true);assert.equal(result.readonly,true);assert.deepEqual(result.diagram,f.workspace.diagrams[0]);assert.equal(result.version,1);assert.match(result.sha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);for(const key of ['project','sources','snapshot','documents','pin'])assert.equal(Object.hasOwn(result,key),false);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);assert.deepEqual(await f.sources.exportSource({projectId:f.selected.project.id,sourceId:f.ref.sourceId,version:1}),Buffer.from('PRIVATE_PYTHON_SOURCE'));
});
test('native Diagram refuses Docs/Code, spoofed frames, identities, mutation methods and payload getters without executing user properties',async t=>{
 const f=await fixture(t);for(const index of [1,2])assert.equal((await f.call('getDiagram',undefined,f.event(index))).code,'ACCESS_REFUSED');
 for(const method of ['applyDiagram','flushDiagram','readProject','getDocument'])assert.equal((await f.call(method,{})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('getDiagram',{entityId:'diagram-b'})).code,'REQUEST_REFUSED');assert.equal((await f.call('getDiagram',undefined,{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame})).code,'ACCESS_REFUSED');
 let called=false;const payload=Object.defineProperty({},'entityId',{enumerable:true,get(){called=true;return 'diagram-a';}});assert.equal((await f.call('getDiagram',payload)).code,'REQUEST_REFUSED');assert.equal(called,false);
 f.lock();assert.equal((await f.call()).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('native Diagram suppresses actual disk-read results after owner pause or selected content replacement',async t=>{
 const f=await fixture(t);let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),read=f.domains.read.bind(f.domains);
 f.domains.read=async(...args)=>{const result=await read(...args);enter();await gate;return result;};const pending=f.call();await entered;f.owner.pause('Lock');release();assert.equal((await pending).code,'ACCESS_REFUSED');
 f.owner.resume();f.domains.read=read;const metadata=JSON.parse(f.selected.json),workspace=JSON.parse(metadata.storage['t-industries-siren-v23-state']);workspace.diagrams[0].source='flowchart TD\nX-->Y';metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);f.setSelected({...f.selected,json:JSON.stringify(metadata)});
 assert.equal((await f.call()).code,'DIAGRAM_VERSION_CHANGED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('paused Diagram reread needs its genuine private draining ticket, cannot borrow another role/entity and cannot seal a read alone',async t=>{
 const f=await fixture(t),grant=f.registry.capture(f.event(0));f.owner.pause('native-close-view');const nonce=f.owner.beginViewFlush(grant);
 assert.equal((await f.service.invoke({event:f.event(0),method:'getDiagram',flushNonce:'forged'})).ok,false);
 assert.equal((await f.service.invoke({event:f.event(1),method:'getDiagram',flushNonce:nonce})).ok,false);
 const actual=await f.service.invoke({event:f.event(0),method:'getDiagram',flushNonce:nonce});assert.equal(actual.ok,true);assert.deepEqual(actual.diagram,f.workspace.diagrams[0]);
 const proof=await f.owner.finishViewFlush(grant,nonce);assert.equal(proof.ok,false,'A read cannot be used as a persistence proof');f.owner.resume();assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('genuine clean preparation reads the selected entity after an earlier queued save, rather than comparing it to the stale pre-queue display',async t=>{
 const f=await fixture(t),grant=f.registry.capture(f.event(0));f.owner.pause('native-close-view');const nonce=f.owner.beginViewFlush(grant);let entered,release;const entry=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve),read=f.domains.read.bind(f.domains);
 f.domains.read=async(...args)=>{entered();await gate;return read(...args);};const pending=f.service.invoke({event:f.event(0),method:'getDiagram',flushNonce:nonce});await entry;
 const metadata=JSON.parse(f.selected.json),workspace=JSON.parse(metadata.storage['t-industries-siren-v23-state']);workspace.diagrams[0]={...workspace.diagrams[0],source:'flowchart TD\nA[Saved before read]-->B',sirenNativeVersion:2};metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'before-preparing-read'})).ok,true);const actual=await f.projects.readProject(f.selected.project.id);f.setSelected(actual);release();
 const result=await pending;assert.equal(result.ok,true);assert.equal(result.version,2);assert.equal(result.diagram.source,workspace.diagrams[0].source);f.owner.cancelViewFlush(grant,nonce);f.owner.resume();assert.deepEqual(await f.projects.readProject(f.selected.project.id),actual);
});
