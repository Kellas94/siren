import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readdir,unlink} from 'node:fs/promises';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest,selectedManifestHistory} from '../src/sources/manifest.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
import {createDiagramCatalogueContract} from '../src/documents/diagram-catalogue.mjs';
const catalogue=createDiagramCatalogueContract(),entry=catalogue.lookup('starter:flowchart').entry;
const request={entryId:entry.id,title:'Separate diagram 😀',operationId:'catalogue-create-b'};
async function fixture({wrap='storage',diagrams,recovery,schema1=false}={}){
 assert.equal(typeof DomainRepository.prototype.appendCatalogueDiagram,'function');
 const root=await mkdtemp(join(tmpdir(),'siren-catalogue-append-')),projects=new ProjectStore(root),sources=new SourceRepository(root);
 const initial=await projects.createProject({label:'Append preservation',json:'{}'}),projectId=initial.project.id;
 const ref=await sources.importSource({projectId,bytes:Buffer.from('print("EXACT 😀")\r\n')});
 const point={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const workspace={diagrams:diagrams===undefined?[{id:'a',name:'Origin',source:'flowchart LR\nA-->B',nodeStyles:{A:{fill:'#ee7733'}},future:{keep:'EXACT',sourceRef:point}}]:diagrams,workpapers:[{id:'doc-a',title:'Original',blocks:[{kind:'knowledge',rows:[{id:'row',sourceRef:point}]}]}],sirenNativeCatalogueCreation:{opaque:'TOP_LEVEL_MUST_SURVIVE'},sirenNativeEntityOperation:{opaque:'EXACT'},future:['retain',point]};
 const metadata=wrap==='storage'?{kind:'siren-desktop',storage:{'t-industries-siren-v23-state':JSON.stringify(workspace),other:'OPAQUE EXACT'},outer:{keep:point}}:wrap==='state'?{state:workspace,outer:{keep:point}}:workspace;
 if(!schema1)assert.equal((await commitManifest({projects,repository:sources,projectId,baseRevision:1,sourceRefs:[ref],metadata,operationId:'initial-catalogue'})).ok,true);
 let live=true,allocated=0,validate=async()=>true,fault=async()=>{};
 const scope={projectId,isCurrent:()=>live},repo=new DomainRepository({projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite,fault:p=>fault(p)}),sources:({canWrite})=>new SourceRepository(root,{canWrite}),recovery,validatePatch:(...args)=>validate(...args),allocateDiagramId:()=>`created-${++allocated}`});
 return {root,projects,sources,projectId,scope,repo,ref,metadata,snapshot:await projects.readProject(projectId),allocations:()=>allocated,setLive:v=>live=v,setValidate:v=>validate=v,setFault:v=>fault=v};
}
test('native domain exposes a separate catalogue append method',()=>assert.equal(typeof DomainRepository.prototype.appendCatalogueDiagram,'function'));
for(const wrap of ['storage','state','direct'])test(`append preserves the complete ${wrap} envelope, source references and opaque existing marker keys`,async()=>{
 const f=await fixture({wrap}),before=workspaceMetadata(f.snapshot),r=await f.repo.appendCatalogueDiagram(request,f.scope);
 assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.entityId,'created-1');assert.equal(r.creation.version,1);assert.equal(r.creation.projectRevision,f.snapshot.revision+1);assert.equal(r.current.available,true);
 const selected=await f.projects.readProject(f.projectId),after=workspaceMetadata(selected);assert.deepEqual(after.diagrams.slice(0,-1),before.diagrams);assert.deepEqual({...after,diagrams:before.diagrams},before);assert.deepEqual(selected.sourceRefs,f.snapshot.sourceRefs);
 const added=after.diagrams.at(-1);assert.deepEqual(Object.keys(added),['id','name','source','sirenNativeVersion','sirenNativeCatalogueCreation']);assert.equal(added.name,request.title);assert.equal(added.source,entry.source);assert.equal(added.sirenNativeVersion,1);assert.equal(added.sirenNativeCatalogueCreation.operationId,request.operationId);
 if(wrap==='storage'){const bag=JSON.parse(selected.json);assert.equal(bag.storage.other,'OPAQUE EXACT');assert.deepEqual(bag.outer,f.metadata.outer);}if(wrap==='state')assert.deepEqual(JSON.parse(selected.json).outer,f.metadata.outer);
});
test('B then C and exact retry append once each without overwriting markers or selecting old revisions',async()=>{
 const f=await fixture(),first=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(first.ok,true);
 const secondRequest={...request,operationId:'catalogue-create-c',title:'C',entryId:'starter:sequence'},second=await f.repo.appendCatalogueDiagram(secondRequest,f.scope);assert.equal(second.ok,true);assert.equal(second.entityId,'created-2');
 const current=await f.projects.readProject(f.projectId),replay=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(replay.ok,true);assert.deepEqual(replay.creation,first.creation);assert.equal(replay.current.projectRevision,current.revision);assert.deepEqual(await f.projects.readProject(f.projectId),current);assert.equal(f.allocations(),2);
});
test('creation replay after origin and new diagram edits keeps current versions and historical birth separate',async()=>{
 const f=await fixture(),first=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(first.ok,true);
 for(const [diagramId,operationId]of [['a','later-origin-save'],[first.entityId,'later-new-save']])assert.equal((await f.repo.apply('diagram',{diagramId,operationId,expectedVersion:1,action:'replace-source',payload:{source:'flowchart TD\nX-->Y'}},f.scope)).ok,true);
 const current=await f.projects.readProject(f.projectId),replay=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(replay.ok,true);assert.equal(replay.creation.version,1);assert.equal(replay.current.version,2);assert.notEqual(replay.current.sha256,replay.creation.sha256);assert.deepEqual(await f.projects.readProject(f.projectId),current);assert.equal(f.allocations(),1);
});
test('replay of deleted creation acknowledges history but never resurrects or advertises current availability',async()=>{
 const f=await fixture(),first=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(first.ok,true);
 const current=await f.projects.readProject(f.projectId),bag=JSON.parse(current.json),workspace=workspaceMetadata(current);workspace.diagrams=workspace.diagrams.filter(d=>d.id!==first.entityId);bag.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.projectId,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata:bag,operationId:'later-delete'})).ok,true);
 const selected=await f.projects.readProject(f.projectId),replay=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(replay.ok,true);assert.deepEqual(replay.creation,first.creation);assert.equal(replay.current.available,false);assert.deepEqual(await f.projects.readProject(f.projectId),selected);assert.equal(f.allocations(),1);
});
test('changed operation reuse and a foreign existing edit operation refuse without UUID or mutation',async()=>{
 const f=await fixture();assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,true);const selected=await f.projects.readProject(f.projectId);
 for(const change of [{title:'Changed'},{entryId:'starter:sequence'},{operationId:'initial-catalogue'}])assert.equal((await f.repo.appendCatalogueDiagram({...request,...change},f.scope)).code,'OPERATION_CONFLICT');
 assert.equal(f.allocations(),1);assert.deepEqual(await f.projects.readProject(f.projectId),selected);
});
test('arbitrary payload/getter/prototype/unknown entry refuses before allocation or evaluation',async()=>{
 const f=await fixture();let executed=0;const getter={...request};Object.defineProperty(getter,'title',{enumerable:true,get(){executed++;return 'bad';}});
 for(const value of [getter,{...request,source:'ARBITRARY'},{...request,diagramId:'a'},{...request,entryId:'unknown'},{...request,title:' '},{...request,title:'x'.repeat(161)},Object.assign(Object.create({}),request)])assert.equal((await f.repo.appendCatalogueDiagram(value,f.scope)).ok,false);
 assert.equal(executed,0);assert.equal(f.allocations(),0);assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});
test('malformed or duplicate raw diagrams containers refuse without normalizing unrelated saved data',async()=>{
 for(const diagrams of [null,{},[null],[{id:'duplicate'},{id:'duplicate'}],[{id:'invalid id'}]]){
  const f=await fixture({diagrams});assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,false);assert.equal(f.allocations(),0);assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
 }
});
test('a missing diagrams field is an explicit empty project case; desktop missing-primary bags are refused',async()=>{
 const f=await fixture({wrap:'direct'}),metadata={workpapers:[],opaque:'EMPTY EXACT'};assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.projectId,baseRevision:f.snapshot.revision,sourceRefs:f.snapshot.sourceRefs,metadata,operationId:'empty-code-project'})).ok,true);
 assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,true);assert.equal(workspaceMetadata(await f.projects.readProject(f.projectId)).opaque,'EMPTY EXACT');
 const g=await fixture();assert.equal((await commitManifest({projects:g.projects,repository:g.sources,projectId:g.projectId,baseRevision:g.snapshot.revision,sourceRefs:g.snapshot.sourceRefs,metadata:{kind:'siren-desktop',storage:{other:'{}'}},operationId:'missing-primary'})).ok,true);const selected=await g.projects.readProject(g.projectId);assert.equal((await g.repo.appendCatalogueDiagram(request,g.scope)).ok,false);assert.deepEqual(await g.projects.readProject(g.projectId),selected);
});
test('imported matching-operation marker is opaque and cannot prove creation or trigger a second append',async()=>{
 const f=await fixture({diagrams:[{id:'imported',source:entry.source,sirenNativeCatalogueCreation:{schema:1,operationId:request.operationId,projectId:'foreign'}}]});
 assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).code,'OPERATION_CONFLICT');assert.equal(f.allocations(),0);assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});
test('missing selected parent history refuses replay rather than duplicating an existing creation',async()=>{
 const f=await fixture();assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,true);const selected=await f.projects.readProject(f.projectId),dir=join(await f.projects.directory(f.projectId),'revisions');
 for(const name of await readdir(dir))if(name.startsWith('2-'))await unlink(join(dir,name));
 assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,false);assert.equal(f.allocations(),1);assert.deepEqual(await f.projects.readProject(f.projectId),selected);
});
test('validation rejection, schema1 and revocation before native selection preserve exact selected bytes',async()=>{
 for(const phase of ['validation','validate-revoke','before-select','schema1']){
  const f=await fixture({schema1:phase==='schema1'});if(phase==='validation')f.setValidate(async()=>false);if(phase==='validate-revoke')f.setValidate(async()=>{f.setLive(false);return true;});if(phase==='before-select')f.setFault(async p=>{if(p==='before-select')f.setLive(false);});
  assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,false,phase);assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
 }
});
test('recovery failure truthfully acknowledges committed data as recovery-degraded and exact replay',async()=>{
 const f=await fixture({recovery:{checkpointProject:async()=>{throw Error('offline');},hasSavedSnapshot:async()=>false}}),first=await f.repo.appendCatalogueDiagram(request,f.scope);assert.equal(first.ok,true);assert.equal(first.creation.durability,'recovery-degraded');assert.deepEqual((await f.repo.appendCatalogueDiagram(request,f.scope)).creation,first.creation);assert.equal(f.allocations(),1);
});
test('append-only count ceiling accepts9999→10000 and refuses10000→10001 without lowering read compatibility',async()=>{
 const diagrams=Array.from({length:9999},(_,i)=>({id:'d'+i,source:'flowchart TD\nA'})),f=await fixture({diagrams});assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,true);const selected=await f.projects.readProject(f.projectId);assert.equal(workspaceMetadata(selected).diagrams.length,10000);
 assert.equal((await f.repo.appendCatalogueDiagram({...request,operationId:'over-count'},f.scope)).code,'DIAGRAM_LIMIT');assert.equal(f.allocations(),1);assert.deepEqual(await f.projects.readProject(f.projectId),selected);assert.equal((await f.repo.read('diagram',{entityId:'d9998'},f.scope)).ok,true);
});
test('selected ancestry read can enforce a native-only retained-record budget before reading extra files',async()=>{
 const f=await fixture();assert.equal((await f.repo.appendCatalogueDiagram(request,f.scope)).ok,true);await assert.rejects(selectedManifestHistory(f.projects,f.projectId,{maxRecords:1}),{code:'MANIFEST_HISTORY_BUDGET'});
});
