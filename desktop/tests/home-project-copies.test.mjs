import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
const implementation=await import('../src/navigation/project-copies.mjs').catch(cause=>{if(cause.code!=='ERR_MODULE_NOT_FOUND')throw cause;return {};});
const create=options=>{assert.equal(typeof implementation.createHomeProjectCopy,'function');return implementation.createHomeProjectCopy(options);};

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-home-source-copy-')),projects=new ProjectStore(root),repository=new SourceRepository(root),recovery=new RecoveryStore(root,{sources:repository});
 return {root,projects,repository,recovery};
}
test('desktop New creates one durable source-aware project with real editable Docs/Diagram entities and a saved checkpoint',async()=>{
 const f=await fixture(),result=await create({root:f.root,label:'Desktop Ș😀',isCurrent:()=>true,recovery:f.recovery});
 assert.equal(result.ok,true);assert.equal((await readdir(join(f.root,'Projects'))).length,1);
 const saved=await f.projects.readProject(result.snapshot.project.id);assert.deepEqual(saved,result.snapshot);assert.equal(saved.schema,2);assert.equal(saved.project.label,'Desktop Ș😀');assert.deepEqual(saved.sourceRefs,[]);
 const workspace=workspaceMetadata(saved);assert.equal(workspace.diagrams.length,1);assert.equal(workspace.workpapers.length,1);assert.equal(workspace.diagrams[0].source,'flowchart TD\n    A[Start] --> B[Next step]');assert.equal(workspace.diagrams[0].sirenNativeVersion,1);assert.deepEqual(workspace.workpapers[0].blocks,[]);
 assert.equal(await f.recovery.hasSavedSnapshot(saved),true);
});
test('Home conversion preserves original pointer/revision bytes and source/agent/release identities in a separate selected-ready copy',async()=>{
 const f=await fixture(),text='\uFEFFdef proces():\r\n    return "😀"\n',metadata={diagrams:[{id:'original-diagram',source:'flowchart TD\nA-->B',nodeMetadata:{A:{owner:'exact-agent'}}}],workpapers:[{id:'doc-a',title:'Exact title',agent:{agentId:'exact-agent',version:7},releases:[{id:'release',author:'Actual author',verdict:'not-run',snapshot:{knowledge:[{sourceId:'historic-source',content:'historic.py'}]}}],blocks:[{id:'knowledge-a',kind:'knowledge',rows:[{id:'row-a',sourceId:'original-source',content:text}]}]}],codeFiles:[{id:'unlinked-a',name:'unlinked.py',content:'unlinked'}]};
 const legacy=await f.projects.createProject({label:'Original',json:JSON.stringify(metadata)}),dir=await f.projects.directory(legacy.project.id),pointer=await readFile(join(dir,'current.json')),names=await readdir(join(dir,'revisions')),revision=await readFile(join(dir,'revisions',names[0]));
 const result=await create({root:f.root,legacySnapshot:legacy,isCurrent:()=>true,recovery:f.recovery});assert.equal(result.ok,true);assert.notEqual(result.snapshot.project.id,legacy.project.id);assert.deepEqual(await f.projects.readProject(legacy.project.id),legacy);assert.deepEqual(await readFile(join(dir,'current.json')),pointer);assert.deepEqual(await readFile(join(dir,'revisions',names[0])),revision);
 const workspace=workspaceMetadata(result.snapshot);assert.deepEqual(workspace.diagrams,metadata.diagrams);assert.deepEqual(workspace.workpapers[0].agent,metadata.workpapers[0].agent);assert.equal(workspace.workpapers[0].releases[0].author,'Actual author');assert.equal(workspace.workpapers[0].releases[0].verdict,'not-run');
 assert.deepEqual(await f.repository.exportSource({projectId:result.snapshot.project.id,...workspace.workpapers[0].blocks[0].rows[0].sourceRef}),Buffer.from(text));assert.equal(await f.recovery.hasSavedSnapshot(result.snapshot),true);
});
test('Lock/navigation during source extraction cannot select a source manifest or acknowledge a successful copy',async()=>{
 const f=await fixture(),legacy=await f.projects.createProject({label:'Original',json:JSON.stringify({codeFiles:[{id:'first',content:'first.py'},{id:'second',content:'second.py'}]})});let current=true;
 const result=await create({root:f.root,legacySnapshot:legacy,isCurrent:()=>current,recovery:f.recovery,writerOptions:{fault:async phase=>{if(phase==='source-blob-verified')current=false;}}});assert.equal(result.ok,false);assert.deepEqual(await f.projects.readProject(legacy.project.id),legacy);
 const ids=await readdir(join(f.root,'Projects'));assert.equal(ids.length,2);const copy=await f.projects.readProject(ids.find(id=>id!==legacy.project.id));assert.equal(copy.schema,1);assert.equal(copy.json,legacy.json);assert.equal((await f.recovery.scan(copy.project.id)).valid.length,0);
});
test('expired native scope refuses before creating anything; schema2 conversion is rejected without writes',async()=>{
 const f=await fixture();assert.equal((await create({root:f.root,label:'Denied',isCurrent:()=>false,recovery:f.recovery})).ok,false);await assert.rejects(readdir(join(f.root,'Projects')),{code:'ENOENT'});
 const made=await create({root:f.root,label:'Desktop',isCurrent:()=>true,recovery:f.recovery}),before=await readdir(join(f.root,'Projects'));assert.equal((await create({root:f.root,legacySnapshot:made.snapshot,isCurrent:()=>true,recovery:f.recovery})).ok,false);assert.deepEqual(await readdir(join(f.root,'Projects')),before);assert.deepEqual(await f.projects.readProject(made.snapshot.project.id),made.snapshot);
});

test('a retained copy without a verified saved recovery point is not admitted as a completed Home conversion',async()=>{
 const f=await fixture(),legacy=await f.projects.createProject({label:'Original',json:'{"codeFiles":[{"id":"file","content":"exact.py"}]}'});f.recovery.fault=async()=>{throw Error('Owned simulated full disk');};
 const result=await create({root:f.root,legacySnapshot:legacy,isCurrent:()=>true,recovery:f.recovery});assert.equal(result.ok,false);assert.deepEqual(await f.projects.readProject(legacy.project.id),legacy);assert.equal((await readdir(join(f.root,'Projects'))).length,2);
});
