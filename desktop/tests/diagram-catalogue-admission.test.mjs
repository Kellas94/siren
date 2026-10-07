import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeDiagramCatalogue} from '../src/windows/diagram-catalogue.mjs';
import {catalogueContext} from './fixtures/catalogue-context.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
const request={entryId:'starter:flowchart',title:'Separate sibling',operationId:'catalogue-admit-b'};
async function fixture(){const f=await catalogueContext(),service=new NativeDiagramCatalogue(f.adapters);return {...f,service,call:(i=1,payload=request)=>service.invoke({event:f.event(i),method:'createDiagram',payload})};}
const suspend=()=>{let release,enter;return {ready:new Promise(r=>enter=r),wait:async()=>{enter();await new Promise(r=>release=r);},release:()=>release()};};

test('append leaves FIFO before genuine working admission and leaves the origin grant/save intact',async()=>{
 const f=await fixture(),origin=f.grant(1),r=await f.call();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.opening.ok,true,JSON.stringify(r));assert.equal(r.opening.view.entityId,'created-b');assert.equal(f.edits.isWorking(f.registry.capture({sender:f.windowFor(r.opening.view.windowId).webContents,senderFrame:f.windowFor(r.opening.view.windowId).webContents.mainFrame})),true);assert.deepEqual(origin.entityIds,['diagram-a']);
 assert.equal((await f.owner.invoke(origin,{kind:'diagram',method:'applyDiagram',payload:{diagramId:'diagram-a',operationId:'origin-after-creation',expectedVersion:1,action:'replace-source',payload:{source:'flowchart LR\nA-->Z'}}})).ok,true);
 assert.equal(workspaceMetadata(f.getSelected()).diagrams.length,3);assert.equal(workspaceMetadata(f.getSelected()).diagrams[0].source,'flowchart LR\nA-->Z');assert.equal(f.notifications.length,1);
});
test('same-operation concurrent requests and retry reuse one admitted window without reloading its draft',async()=>{
 const f=await fixture(),before=f.windows.length,[a,b]=await Promise.all([f.call(),f.call()]);assert.equal(a.opening.ok,true);assert.equal(b.opening.ok,true);assert.equal(a.opening.view.windowId,b.opening.view.windowId);assert.equal(f.windows.length,before+1);const c=await f.call();assert.equal(c.opening.view.windowId,a.opening.view.windowId);assert.equal(f.windows.length,before+1);
});
test('Home empty entity grant may create, while Docs/Code and unknown methods cannot',async()=>{
 const f=await fixture();assert.equal(f.grant(0).entityIds.length,0);assert.equal((await f.call(0)).opening.ok,true);
 for(const i of [2,3])assert.equal((await f.call(i)).code,'ACCESS_REFUSED');assert.equal((await f.service.invoke({event:f.event(0),method:'openSibling',payload:request})).code,'REQUEST_REFUSED');
});
test('browse is bounded and allowed independently of creation; malformed options do not execute getters',async()=>{
 const f=await fixture(),readonly=new NativeDiagramCatalogue({...f.adapters,canCreate:()=>false});const r=await readonly.invoke({event:f.event(1),method:'getPage',payload:{}});assert.equal(r.ok,true);assert.equal(r.rows.length,20);assert.equal(r.canCreate,false);assert.equal((await readonly.invoke({event:f.event(1),method:'createDiagram',payload:request})).code,'ACCESS_REFUSED');let seen=false;assert.equal((await readonly.invoke({event:f.event(1),method:'getPage',payload:{get cursor(){seen=true;return 0;}}})).ok,false);assert.equal(seen,false);
});
test('factory failure retains persistence and exact-operation retry opens it without another append',async()=>{
 const f=await fixture();f.setFactory(async()=>{throw Error('factory failed');});const first=await f.call();assert.equal(first.ok,true);assert.equal(first.opening.ok,false);assert.equal(workspaceMetadata(f.getSelected()).diagrams.length,3);f.setFactory(async()=>{});const retry=await f.call();assert.equal(retry.opening.ok,true);assert.deepEqual(retry.creation,first.creation);assert.equal(workspaceMetadata(f.getSelected()).diagrams.length,3);
});
test('later edited sibling opens current version while historical birth stays version one',async()=>{
 const f=await fixture(),first=await f.call(),w=f.windowFor(first.opening.view.windowId),g=f.registry.capture({sender:w.webContents,senderFrame:w.webContents.mainFrame});assert.equal((await f.owner.invoke(g,{kind:'diagram',method:'applyDiagram',payload:{diagramId:'created-b',operationId:'edit-sibling',expectedVersion:1,action:'replace-source',payload:{source:'flowchart LR\nB-->C'}}})).ok,true);await f.registry.discardViewAsync(first.opening.view.windowId);const retry=await f.call();assert.equal(retry.creation.version,1);assert.equal(retry.current.version,2);assert.equal(retry.opening.ok,true);assert.notEqual(retry.opening.view.windowId,first.opening.view.windowId);
});
test('deleted sibling is not resurrected or opened by historical operation replay',async()=>{
 const f=await fixture(),first=await f.call();await f.registry.discardViewAsync(first.opening.view.windowId);const s=f.getSelected(),meta=JSON.parse(s.json);const key='t-industries-siren-v23-state',workspace=JSON.parse(meta.storage[key]);workspace.diagrams=workspace.diagrams.filter(d=>d.id!=='created-b');meta.storage[key]=JSON.stringify(workspace);assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:s.project.id,baseRevision:s.revision,sourceRefs:s.sourceRefs,metadata:meta,operationId:'delete-created'})).ok,true);const r=await f.call();assert.equal(r.ok,true);assert.equal(r.current.available,false);assert.equal(r.opening.ok,false);assert.equal(workspaceMetadata(f.getSelected()).diagrams.length,2);
});
for(const transition of ['pause','roster','dispose'])test('suspended factory cannot publish a new window after '+transition+' and rollback',async()=>{
 const f=await fixture(),gate=suspend(),count=f.windows.length;f.setFactory(gate.wait);const pending=f.call();await gate.ready;
 if(transition==='pause'){f.owner.pause('lock');f.owner.resume();}else if(transition==='roster'){const p=f.registry.freezeRoster();f.registry.releaseRoster(p);}else f.service.dispose();
 gate.release();const r=await pending;assert.equal(r.ok,false);assert.equal(r.code,'ACCESS_REFUSED');assert.equal(f.shown.length,0);assert.equal(f.registry.listViews().length,count);assert.equal(workspaceMetadata(await f.projects.readProject(f.selected.project.id)).diagrams.length,3);
});
test('admission or show failure destroys only its newly opened native surface and retains creation',async()=>{
 const f=await fixture(),before=f.registry.listViews().length;f.setAdmit(async()=>{throw Error('admission failed');});const a=await f.call();assert.equal(a.ok,true);assert.equal(a.opening.ok,false);assert.equal(f.registry.listViews().length,before);f.setAdmit(async()=>{});f.setShow(()=>{throw Error('show failed');});const b=await f.call();assert.equal(b.ok,true);assert.equal(b.opening.ok,false);assert.equal(f.registry.listViews().length,before);assert.equal(workspaceMetadata(f.getSelected()).diagrams.length,3);
});
test('failed destruction is reported and fences native operation instead of losing the handle',async()=>{
 const f=await fixture();f.setAdmit(async()=>{f.setCleanupFailure(true);throw Error('admission failed');});const r=await f.call();assert.equal(r.ok,false);assert.equal(r.code,'WINDOW_DESTROY_FAILED');assert.equal(f.failures.length,1);f.setCleanupFailure(false);await f.registry.invalidateEpochAsync();
});
