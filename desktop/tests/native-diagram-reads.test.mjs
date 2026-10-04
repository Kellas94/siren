import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {diagramContext} from './fixtures/diagram-context.mjs';
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
