import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {createHomeProjectCopy} from '../src/navigation/project-copies.mjs';
import {importHomeSource} from '../src/navigation/source-import.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
const implementation=await import('../src/navigation/document-create.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const create=options=>{assert.equal(typeof implementation.createHomeDocument,'function');return implementation.createHomeDocument(options);};
async function fixture(){const root=await mkdtemp(join(tmpdir(),'siren-create-document-')),projects=new ProjectStore(root),repository=new SourceRepository(root),recovery=new RecoveryStore(root,{sources:repository});const first=await createHomeProjectCopy({root,label:'Owned documents',isCurrent:()=>true,recovery});assert.equal(first.ok,true);const bytes=Buffer.from('\uFEFF# Shared Ș😀\r\n'),imported=await importHomeSource({root,snapshot:first.snapshot,bytes,fileName:'shared.py',isCurrent:()=>true,recovery});assert.equal(imported.ok,true);return {root,projects,repository,recovery,snapshot:imported.snapshot,bytes};}
test('new document commits exactly one native identity with no invented agent/release and preserves every existing source, document and diagram',async()=>{
 const f=await fixture(),before=workspaceMetadata(f.snapshot),result=await create({...f,title:'Notes Ș😀 <script>',isCurrent:()=>true});assert.equal(result.ok,true);const saved=await f.projects.readProject(f.snapshot.project.id),after=workspaceMetadata(saved);
 assert.deepEqual(result.snapshot,saved);assert.equal(saved.project.id,f.snapshot.project.id);assert.equal(saved.revision,f.snapshot.revision+1);assert.equal(saved.schema,2);assert.deepEqual(saved.sourceRefs,f.snapshot.sourceRefs);assert.deepEqual(after.diagrams,before.diagrams);assert.deepEqual(after.codeFiles,before.codeFiles);assert.deepEqual(after.workpapers.slice(0,-1),before.workpapers);
 const doc=after.workpapers.at(-1);assert.match(doc.id,/^[a-f0-9-]{36}$/);assert.deepEqual(doc,{id:doc.id,title:'Notes Ș😀 <script>',blocks:[],agent:null,releases:[]});assert.equal(await f.recovery.hasSavedSnapshot(saved),true);assert.deepEqual(await f.repository.exportSource({projectId:saved.project.id,...saved.sourceRefs[0]}),f.bytes);
});
test('title request rejects extra authority, getters, invalid Unicode and length before any project write',async()=>{
 const f=await fixture();assert.equal(typeof implementation.normalizeHomeDocument,'function');let getterRan=false;const hostile={};Object.defineProperty(hostile,'title',{enumerable:true,get(){getterRan=true;return 'Injected';}});
 for(const request of [hostile,{title:'x',projectId:f.snapshot.project.id},{title:'x',documentId:'caller'},{title:''},{title:'   '},{title:'x'.repeat(161)},{title:'bad\ud800'},{title:7}])assert.throws(()=>implementation.normalizeHomeDocument(request));assert.equal(getterRan,false);
 for(const title of ['', ' ', 'x'.repeat(161), 'bad\ud800',7]){assert.equal((await create({...f,title,isCurrent:()=>true})).ok,false);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);}
});
test('stale snapshot, classic project and revoked authority cannot add a document',async()=>{
 const f=await fixture();const first=await create({...f,title:'First',isCurrent:()=>true});assert.equal(first.ok,true);assert.equal((await create({...f,title:'Stale',isCurrent:()=>true})).code,'REVISION_CONFLICT');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),first.snapshot);
 const classic=await f.projects.createProject({label:'Classic',json:'{}'});assert.equal((await create({...f,snapshot:classic,title:'Wrong format',isCurrent:()=>true})).code,'PROJECT_FORMAT_REFUSED');assert.deepEqual(await f.projects.readProject(classic.project.id),classic);
 assert.equal((await create({...f,snapshot:first.snapshot,title:'Locked',isCurrent:()=>false})).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),first.snapshot);
});
test('access loss at the real atomic manifest selector retains the selected snapshot',async()=>{
 const f=await fixture();let live=true;const result=await create({...f,title:'Interrupted',isCurrent:()=>live,writerOptions:{fault:async phase=>{if(phase==='before-select')live=false;}}});assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});
test('the finite 4096-document catalog refuses another document without changing sources or the selected manifest',async()=>{
 const f=await fixture(),workspace=workspaceMetadata(f.snapshot),bag=JSON.parse(f.snapshot.json);workspace.workpapers=Array.from({length:4096},(_,i)=>({id:'bounded-doc-'+i,title:'Existing '+i,blocks:[]}));bag.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);
 assert.equal((await commitManifest({projects:f.projects,repository:f.repository,recovery:f.recovery,projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,sourceRefs:f.snapshot.sourceRefs,metadata:bag,operationId:'bounded-document-catalog'})).ok,true);const selected=await f.projects.readProject(f.snapshot.project.id);
 assert.equal((await create({...f,snapshot:selected,title:'Exceeds catalog',isCurrent:()=>true})).code,'NAVIGATION_LIMIT');assert.deepEqual(await f.projects.readProject(selected.project.id),selected);assert.deepEqual(await f.repository.exportSource({projectId:selected.project.id,...selected.sourceRefs[0]}),f.bytes);
});
