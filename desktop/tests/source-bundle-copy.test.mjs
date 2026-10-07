import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from './fixtures/temporary.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {parseSourceBundle} from '../src/sources/bundle-import.mjs';
import {createImportedSourceBundleCopy,readSourceBundleImportStatus} from '../src/navigation/source-bundle-copy.mjs';

async function fixture({unsupported=false}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-bundle-copy-')),projects=new ProjectStore(root),sources=new SourceRepository(root),recovery=new RecoveryStore(root,{sources});
 const initial=await projects.createProject({label:'Original retained',json:'{}'}),bytes=unsupported?Buffer.from([0xff,0x00,0xc3,0x28]):Buffer.from('\ufeffx=123 # Ș😀\r\n'),provenance=JSON.parse('{"agentId":"agent-a","future":{"opaque":[1,"KEEP"]},"__proto__":{"dataOnly":true}}');
 const ref1=await sources.importSource({projectId:initial.project.id,bytes,provenance});let refs=[ref1],expected=[bytes];
 if(!unsupported){const changed=await sources.applyEdit({projectId:initial.project.id,edit:{operationId:'copy-fixture-edit',sourceId:ref1.sourceId,expectedVersion:1,start:3,end:6,insertedText:'124'}});assert.equal(changed.ok,true);refs.push(await sources.getMetrics({projectId:initial.project.id,sourceId:ref1.sourceId,version:2}));expected.push(Buffer.from('\ufeffx=124 # Ș😀\r\n'));}
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[],workpapers:[],codeFiles:refs.map((ref,i)=>({id:`code-${i}`,name:`version-${i}.py`,sourceRef:{sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256}}))}),opaque:'  {"preserve": true}  '},future:{unknown:'KEEP'}};
 const receipt=await commitManifest({projects,repository:sources,recovery,projectId:initial.project.id,baseRevision:1,sourceRefs:refs,metadata,operationId:'copy-fixture-manifest'});assert.equal(receipt.ok,true);const snapshot=await projects.readProject(initial.project.id),bundle=parseSourceBundle(await recovery.exportSourceSnapshot(snapshot));
 return {root,projects,sources,recovery,snapshot,bundle,metadata,expected};
}
const options=f=>({root:f.root,bundle:f.bundle,metadata:f.metadata,recovery:f.recovery,isCurrent:()=>true});

test('real exported source versions copy to independent version-one identities with exact bytes provenance and global recovery intact',async()=>{
 const f=await fixture(),before=await f.recovery.scan(),result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);assert.equal(result.snapshot.schema,2);assert.notEqual(result.snapshot.project.id,f.snapshot.project.id);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
 const metadata=JSON.parse(result.snapshot.json),state=JSON.parse(metadata.storage['t-industries-siren-v23-state']);assert.equal(metadata.storage.opaque,f.metadata.storage.opaque);assert.deepEqual(metadata.future,f.metadata.future);assert.equal(state.codeFiles.length,2);assert.notEqual(state.codeFiles[0].sourceRef.sourceId,state.codeFiles[1].sourceRef.sourceId);
 for(let i=0;i<2;i++){const pointer=state.codeFiles[i].sourceRef,ref=result.snapshot.sourceRefs.find(ref=>ref.sourceId===pointer.sourceId);assert.equal(ref.version,1);assert.deepEqual(ref.provenance,f.bundle.sources[i].ref.provenance);assert.deepEqual(await f.sources.exportSource({projectId:result.snapshot.project.id,sourceId:ref.sourceId,version:1}),f.expected[i]);}
 assert.equal(await f.recovery.hasSavedSnapshot(result.snapshot),true);const after=await f.recovery.scan();assert.equal(after.damaged,false);for(const point of before.valid)assert.ok(after.valid.some(item=>item.id===point.id));assert.equal({}.dataOnly,undefined);
 const status=await readSourceBundleImportStatus({projects:f.projects,projectId:result.snapshot.project.id});assert.deepEqual(status,{schema:1,projectId:result.snapshot.project.id,state:'complete',revision:result.snapshot.revision,sha256:result.snapshot.sha256});
 await assert.rejects(readFile(join(f.root,'session-selection.json')),{code:'ENOENT'});
});
test('source mutation or dangling admitted pointer is refused before allocation',async()=>{
 for(const mutation of ['bytes','provenance','pointer']){const f=await fixture(),before=await readdir(join(f.root,'Projects'));if(mutation==='bytes')f.bundle.sources[0].bytes[0]^=1;else if(mutation==='provenance')f.bundle.sources[0].ref.provenance.agentId='forged';else f.metadata.future.sourceRef={sourceId:'unowned',version:1,sha256:'0'.repeat(64)};const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,false);assert.equal(result.incompleteProjectId,undefined);assert.deepEqual(await readdir(join(f.root,'Projects')),before);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);}
});
test('initial revoked authority or missing recovery creates no copy',async()=>{
 const f=await fixture(),before=await readdir(join(f.root,'Projects'));for(const change of [{isCurrent:()=>false},{recovery:undefined}]){const result=await createImportedSourceBundleCopy({...options(f),...change});assert.equal(result.ok,false);assert.equal(result.incompleteProjectId,undefined);}assert.deepEqual(await readdir(join(f.root,'Projects')),before);
});
test('revocation after source allocation leaves an explicit unselected incomplete copy and preserves original',async()=>{
 const f=await fixture();let live=true;
 const result=await createImportedSourceBundleCopy({...options(f),isCurrent:()=>live,writerOptions:{fault:async phase=>{if(phase==='source-blob-verified')live=false;}}});assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.ok(result.incompleteProjectId);assert.notEqual(result.incompleteProjectId,f.snapshot.project.id);assert.ok((await readdir(join(f.root,'Projects'))).includes(result.incompleteProjectId));assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);await assert.rejects(readFile(join(f.root,'session-selection.json')),{code:'ENOENT'});
});
test('failure during initial selector allocation reports only the actual fresh copy identity',async()=>{
 const f=await fixture(),result=await createImportedSourceBundleCopy({...options(f),writerOptions:{fault:async phase=>{if(phase==='before-select')throw Error('Initial selector refused');}}});assert.equal(result.ok,false);assert.ok(result.incompleteProjectId);assert.notEqual(result.incompleteProjectId,f.snapshot.project.id);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});
test('checkpoint failure cannot produce completed import and cannot damage existing global recovery points',async()=>{
 const f=await fixture(),before=await f.recovery.scan();f.recovery.fault=async phase=>{if(phase==='before-rename')throw Error('Checkpoint publication interrupted');};const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,false);assert.ok(result.incompleteProjectId);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);const after=await f.recovery.scan();assert.equal(after.damaged,false);for(const point of before.valid)assert.ok(after.valid.some(item=>item.id===point.id));assert.deepEqual(await readSourceBundleImportStatus({projects:f.projects,projectId:result.incompleteProjectId}),{schema:1,projectId:result.incompleteProjectId,state:'incomplete'});
});
test('an already verified checkpoint is acknowledged despite a later checkpoint hook error',async()=>{
 const f=await fixture();f.recovery.fault=async phase=>{if(phase==='checkpoint-verified')throw Error('Postcommit hook interrupted');};const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);assert.equal(await f.recovery.hasSavedSnapshot(result.snapshot),true);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});
test('unsupported raw source bytes are preserved in a new imported copy',async()=>{
 const f=await fixture({unsupported:true}),result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);const ref=result.snapshot.sourceRefs[0];assert.equal(ref.encoding,'unsupported');assert.deepEqual(await f.sources.exportSource({projectId:result.snapshot.project.id,sourceId:ref.sourceId,version:1}),f.expected[0]);
});
test('validator-admitted metadata changes are retained while source pointer identities are remapped',async()=>{
 const f=await fixture();f.metadata=structuredClone(f.metadata);f.metadata.future.fileClaim={status:'from-file',author:'original name'};const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);assert.deepEqual(JSON.parse(result.snapshot.json).future.fileClaim,f.metadata.future.fileClaim);
});
test('substituting another valid bundled pointer at the same metadata path is refused before allocation',async()=>{
 const f=await fixture(),before=await readdir(join(f.root,'Projects'));f.metadata=structuredClone(f.metadata);const key='t-industries-siren-v23-state',state=JSON.parse(f.metadata.storage[key]);state.codeFiles[0].sourceRef=structuredClone(state.codeFiles[1].sourceRef);f.metadata.storage[key]=JSON.stringify(state);const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,false);assert.equal(result.incompleteProjectId,undefined);assert.deepEqual(await readdir(join(f.root,'Projects')),before);
});
test('completed import status remains valid after a genuine later manifest save',async()=>{
 const f=await fixture(),result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);const metadata=JSON.parse(result.snapshot.json);metadata.future.laterEdit=true;const saved=await commitManifest({projects:f.projects,repository:f.sources,recovery:f.recovery,projectId:result.snapshot.project.id,baseRevision:result.snapshot.revision,sourceRefs:result.snapshot.sourceRefs,metadata,operationId:'later-imported-save'});assert.equal(saved.ok,true);assert.equal((await readSourceBundleImportStatus({projects:f.projects,projectId:result.snapshot.project.id})).state,'complete');
});
test('absent status is normal while corrupted unknown oversized or mismatched status fails closed',async()=>{
 const f=await fixture();assert.equal(await readSourceBundleImportStatus({projects:f.projects,projectId:f.snapshot.project.id}),null);
 for(const value of ['{broken','x'.repeat(4097),JSON.stringify({schema:1,projectId:f.snapshot.project.id,state:'incomplete',unknown:true}),JSON.stringify({schema:1,projectId:'other',state:'incomplete'}),JSON.stringify({schema:1,projectId:f.snapshot.project.id,state:'complete',revision:f.snapshot.revision,sha256:'0'.repeat(64)})]){await writeFile(join(f.root,'Projects',f.snapshot.project.id,'source-import-status.json'),value);await assert.rejects(readSourceBundleImportStatus({projects:f.projects,projectId:f.snapshot.project.id}),{code:'BUNDLE_IMPORT_STATUS_REFUSED'});}
});
test('final completion publication failure is unconfirmed while actual owned marker still verifies incomplete',async()=>{
 const f=await fixture();let checkpointDone=false;f.recovery.fault=async phase=>{if(phase==='catalog-committed')checkpointDone=true;};const result=await createImportedSourceBundleCopy({...options(f),writerOptions:{fault:async phase=>{if(checkpointDone&&phase==='before-rename')throw Error('Final status publication refused');}}});assert.equal(result.ok,false);assert.equal(result.code,'BUNDLE_COMPLETION_UNCONFIRMED');assert.equal(result.completion,'unconfirmed');assert.equal(result.reason,'BUNDLE_COPY_FAILED');assert.ok(result.retainedProjectId);assert.equal(result.incompleteProjectId,undefined);const snapshot=await f.projects.readProject(result.retainedProjectId);assert.equal(snapshot.schema,2);assert.equal(await f.recovery.hasSavedSnapshot(snapshot),true);assert.equal((await readSourceBundleImportStatus({projects:f.projects,projectId:result.retainedProjectId})).state,'incomplete');
});

test('post-rename completion hook failure retains a complete verified copy without claiming incomplete or successful selection',async()=>{
 const f=await fixture();let checkpointDone=false;f.recovery.fault=async phase=>{if(phase==='catalog-committed')checkpointDone=true;};const result=await createImportedSourceBundleCopy({...options(f),writerOptions:{fault:async phase=>{if(checkpointDone&&phase==='after-rename')throw Object.assign(Error('Final marker hook interrupted'),{code:'OWN_HOOK_FAILED'});}}});
 assert.equal(result.ok,false);assert.equal(result.code,'BUNDLE_COMPLETION_UNCONFIRMED');assert.equal(result.reason,'OWN_HOOK_FAILED');assert.equal(result.completion,'unconfirmed');assert.ok(result.retainedProjectId);assert.equal(result.incompleteProjectId,undefined);
 const snapshot=await f.projects.readProject(result.retainedProjectId);assert.equal(await f.recovery.hasSavedSnapshot(snapshot),true);assert.deepEqual(await readSourceBundleImportStatus({projects:f.projects,projectId:result.retainedProjectId}),{schema:1,projectId:result.retainedProjectId,state:'complete',revision:snapshot.revision,sha256:snapshot.sha256});assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);await assert.rejects(readFile(join(f.root,'session-selection.json')),{code:'ENOENT'});
});

test('authority revoked after final marker publication retains complete copy unselected with unconfirmed result',async()=>{
 const f=await fixture();let checkpointDone=false,live=true;f.recovery.fault=async phase=>{if(phase==='catalog-committed')checkpointDone=true;};const result=await createImportedSourceBundleCopy({...options(f),isCurrent:()=>live,writerOptions:{fault:async phase=>{if(checkpointDone&&phase==='after-rename')live=false;}}});
 assert.equal(live,false);assert.equal(result.ok,false);assert.equal(result.code,'BUNDLE_COMPLETION_UNCONFIRMED');assert.equal(result.reason,'ACCESS_REFUSED');assert.equal(result.completion,'unconfirmed');assert.ok(result.retainedProjectId);assert.equal(result.incompleteProjectId,undefined);
 const snapshot=await f.projects.readProject(result.retainedProjectId);assert.equal(await f.recovery.hasSavedSnapshot(snapshot),true);assert.equal((await readSourceBundleImportStatus({projects:f.projects,projectId:result.retainedProjectId})).state,'complete');assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);await assert.rejects(readFile(join(f.root,'session-selection.json')),{code:'ENOENT'});
});
test('equal bytes with distinct original source identities and provenance remain distinct in the copy',async()=>{
 const f=await fixture({unsupported:true}),extra=await f.sources.importSource({projectId:f.snapshot.project.id,bytes:f.expected[0],provenance:{agentId:'different-agent',future:{keep:'separate'}}});
 const metadata=JSON.parse(f.snapshot.json),key='t-industries-siren-v23-state',state=JSON.parse(metadata.storage[key]);state.codeFiles.push({id:'code-extra',sourceRef:{sourceId:extra.sourceId,version:extra.version,sha256:extra.sha256}});metadata.storage[key]=JSON.stringify(state);
 const saved=await commitManifest({projects:f.projects,repository:f.sources,recovery:f.recovery,projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,sourceRefs:[...f.snapshot.sourceRefs,extra],metadata,operationId:'distinct-provenance-save'});assert.equal(saved.ok,true);f.snapshot=await f.projects.readProject(f.snapshot.project.id);f.bundle=parseSourceBundle(await f.recovery.exportSourceSnapshot(f.snapshot));f.metadata=metadata;
 const result=await createImportedSourceBundleCopy(options(f));assert.equal(result.ok,true);assert.equal(result.snapshot.sourceRefs.length,2);assert.notEqual(result.snapshot.sourceRefs[0].sourceId,result.snapshot.sourceRefs[1].sourceId);assert.equal(result.snapshot.sourceRefs[0].sha256,result.snapshot.sourceRefs[1].sha256);assert.deepEqual(new Set(result.snapshot.sourceRefs.map(ref=>ref.provenance.agentId)),new Set(['agent-a','different-agent']));
});
