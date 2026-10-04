import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {createHomeProjectCopy} from '../src/navigation/project-copies.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
const implementation=await import('../src/navigation/source-import.mjs').catch(cause=>{if(cause.code!=='ERR_MODULE_NOT_FOUND')throw cause;return {};});
const perform=options=>{assert.equal(typeof implementation.importHomeSource,'function');return implementation.importHomeSource(options);};
async function fixture(){const root=await mkdtemp(join(tmpdir(),'siren-home-source-import-')),projects=new ProjectStore(root),repository=new SourceRepository(root),recovery=new RecoveryStore(root,{sources:repository});const result=await createHomeProjectCopy({root,label:'Owned source imports',isCurrent:()=>true,recovery});assert.equal(result.ok,true);return {root,projects,repository,recovery,snapshot:result.snapshot};}
test('owned Python import adds one unlinked source and preserves every prior Docs/Diagram field and exact BOM/CRLF/Unicode bytes',async()=>{
 const f=await fixture(),bytes=Buffer.from('\uFEFFdef test():\r\n    return "Ș😀"\r\n'),result=await perform({...f,bytes,fileName:'script.py',isCurrent:()=>true});assert.equal(result.ok,true);
 const saved=await f.projects.readProject(f.snapshot.project.id),before=workspaceMetadata(f.snapshot),after=workspaceMetadata(saved);assert.equal(saved.revision,f.snapshot.revision+1);assert.equal(saved.schema,2);assert.deepEqual(after.diagrams,before.diagrams);assert.deepEqual(after.workpapers,before.workpapers);assert.equal(after.codeFiles.length,1);assert.equal(after.codeFiles[0].name,'script.py');assert.equal(after.codeFiles[0].language,'python');assert.equal(after.codeFiles[0].linkedRef,null);assert.equal(Object.hasOwn(after.codeFiles[0],'content'),false);
 const ref=saved.sourceRefs[0];assert.deepEqual(await f.repository.exportSource({projectId:saved.project.id,...ref}),bytes);assert.deepEqual(ref.provenance,{kind:'standalone',fileId:after.codeFiles[0].id,fileName:'script.py'});assert.equal(ref.bom,true);assert.equal(ref.newline,'crlf');assert.equal(await f.recovery.hasSavedSnapshot(saved),true);
 const second=await perform({...f,snapshot:saved,bytes:Buffer.from('another'),fileName:'second.txt',isCurrent:()=>true});assert.equal(second.ok,true);
 // Manifest refs have canonical source-ID order, not import order. Preserve the
 // exact original record by identity, regardless of the newly generated UUID.
 assert.equal(second.snapshot.sourceRefs.length,2);assert.deepEqual(second.snapshot.sourceRefs.find(item=>item.sourceId===ref.sourceId),ref);
 assert.deepEqual(workspaceMetadata(second.snapshot).codeFiles[0],after.codeFiles[0]);const next=workspaceMetadata(second.snapshot).codeFiles[1];assert.equal(next.language,'text');
 assert.deepEqual(await f.repository.exportSource({projectId:saved.project.id,...next.sourceRef}),Buffer.from('another'));
 assert.deepEqual(await f.repository.exportSource({projectId:saved.project.id,...ref}),bytes);
});
test('invalid encoding, oversized source and path-like filename cannot modify the project',async()=>{
 const f=await fixture();for(const [bytes,fileName] of [[Buffer.from([255,254]),'invalid.py'],[Buffer.alloc(32*1024*1024+1),'too-large.py'],[Buffer.from('code'),'C:/private.py'],[Buffer.from('code'),'../private.py']]){assert.equal((await perform({...f,bytes,fileName,isCurrent:()=>true})).ok,false);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);}
});
test('access change after source bytes are written cannot select a new manifest or return success',async()=>{
 const f=await fixture();let live=true;const result=await perform({...f,bytes:Buffer.from('retained orphan'),fileName:'retained.py',isCurrent:()=>live,writerOptions:{fault:async phase=>{if(phase==='source-blob-verified')live=false;}}});assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});
test('stale selected snapshot and classic projects are refused before imports',async()=>{
 const f=await fixture(),bytes=Buffer.from('one');assert.equal((await perform({...f,bytes,fileName:'one.py',isCurrent:()=>true})).ok,true);const latest=await f.projects.readProject(f.snapshot.project.id);assert.equal((await perform({...f,bytes,fileName:'stale.py',isCurrent:()=>true})).code,'REVISION_CONFLICT');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),latest);
 const classic=await f.projects.createProject({label:'Classic',json:'{}'});assert.equal((await perform({...f,snapshot:classic,bytes,fileName:'classic.py',isCurrent:()=>true})).ok,false);assert.deepEqual(await f.projects.readProject(classic.project.id),classic);
});
