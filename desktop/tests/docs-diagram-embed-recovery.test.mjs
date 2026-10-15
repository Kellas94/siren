import test from 'node:test';
import assert from 'node:assert/strict';
import {embedContext} from './fixtures/docs-diagram-embed-context.mjs';
import {readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {sanitizeDiagramEmbedSvg} from '../src/documents/diagram-embed-svg.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {exportSourceSnapshot,scanSourceRecovery} from '../src/sources/recovery.mjs';
import {createImportedSourceBundleCopy} from '../src/navigation/source-bundle-copy.mjs';
import {parseSourceBundle} from '../src/sources/bundle-import.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {manifestRequestHash} from '../src/sources/manifest.mjs';
const validator=async()=>({validateBundleMetadata:async text=>text,validateDiagramAsset:async(kind,text)=>{assert.equal(kind,'svg');sanitizeDiagramEmbedSvg(text,{DOMParser,XMLSerializer});return true;},dispose:async()=>{}});
const api=await import('../src/documents/diagram-embed-bundle.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('workspace bundle version1 preserves frozen visuals and source identities with deduplicated verified assets',async t=>{
 const f=await embedContext(t);assert.equal(typeof api.exportEmbedBundle,'function','Missing versioned workspace asset bundle');const bytes=await api.exportEmbedBundle({snapshot:f.snapshot,sources:f.sources,assets:f.assets,isCurrent:()=>true});const wire=JSON.parse(bytes);assert.equal(wire.format,'siren-workspace-bundle');assert.equal(wire.version,1);assert.equal(wire.assets.length,2);assert.deepEqual(wire.snapshot,f.snapshot);assert.equal(bytes.length<=64*1024*1024,true);
});
test('version dispatch refuses missing, duplicate, corrupt and noncanonical asset DATA; source-only export cannot omit snapshots',async t=>{
 const f=await embedContext(t),bytes=await api.exportEmbedBundle({...f,snapshot:f.snapshot,isCurrent:()=>true}),wire=JSON.parse(bytes);assert.equal(api.parseEmbedBundle(bytes).assets.length,2);
 for(const mutate of [v=>v.version=2,v=>v.assets.pop(),v=>v.assets.push(v.assets[0]),v=>v.assets[0].base64='!',v=>v.assets[0].ref.kind='png',v=>v.assets[1].base64=Buffer.alloc(v.assets[1].ref.bytes).toString('base64')]){const v=structuredClone(wire);mutate(v);assert.throws(()=>api.parseEmbedBundle(Buffer.from(JSON.stringify(v))));}
 await assert.rejects(exportSourceSnapshot({snapshot:f.snapshot,repository:f.sources}),{code:'BUNDLE_DIAGRAM_ASSETS_REQUIRED'});
 assert.throws(()=>parseSourceBundle(Buffer.from(JSON.stringify({format:'siren-source-bundle',schema:2,snapshot:f.snapshot,sources:wire.sources}))),{code:'BUNDLE_DIAGRAM_ASSETS_REQUIRED'});
});
test('offline bundle copies exact visuals, frozen deleted source and unknown fields into a different owned project with verified checkpoint',async t=>{
 const f=await embedContext(t),recovery=new RecoveryStore(f.root,{sources:f.sources,assets:f.assets}),before=await f.projects.readProject(f.snapshot.project.id),bytes=await recovery.exportSourceSnapshot(f.snapshot);
 const restored=await api.importEmbedBundle({bytes,projects:f.projects,sources:f.sources,assets:f.assets,recovery,isCurrent:()=>true,createValidator:validator});assert.notEqual(restored.project.id,before.project.id);assert.deepEqual(await f.projects.readProject(before.project.id),before);const metadata=JSON.parse(restored.json);assert.deepEqual(metadata.workpapers,f.metadata.workpapers);assert.deepEqual(metadata.future,f.metadata.future);assert.deepEqual(metadata.diagramEmbedAssets,f.metadata.diagramEmbedAssets);assert.equal(await recovery.hasSavedSnapshot(restored),true);
 for(const ref of metadata.diagramEmbedAssets.refs)assert.deepEqual(await f.assets.read({projectId:restored.project.id,ref,isCurrent:()=>true}),await f.assets.read({projectId:before.project.id,ref,isCurrent:()=>true}));
});
test('raw parsed assets and cloned admission cannot authorize a destination; refusal allocates no project',async t=>{
 const f=await embedContext(t),recovery=new RecoveryStore(f.root,{sources:f.sources,assets:f.assets}),bytes=await api.exportEmbedBundle({...f,snapshot:f.snapshot,isCurrent:()=>true}),parsed=api.parseEmbedBundle(bytes),before=await readdir(await f.projects.projectsRoot());
 for(const diagramAdmission of [undefined,{},structuredClone(await api.qualifyEmbedBundle({parsed,createValidator:validator,isCurrent:()=>true}))]){const result=await createImportedSourceBundleCopy({root:f.root,bundle:parsed.bundle,metadata:parsed.bundle.metadata,diagramAdmission,recovery,isCurrent:()=>true});assert.equal(result.code,'BUNDLE_DIAGRAM_ADMISSION_REQUIRED');assert.deepEqual(await readdir(await f.projects.projectsRoot()),before);}
});
test('Lock during isolated visual qualification disposes resource and refuses the late result before project creation',async t=>{
 const f=await embedContext(t),bytes=await api.exportEmbedBundle({...f,snapshot:f.snapshot,isCurrent:()=>true}),parsed=api.parseEmbedBundle(bytes);let live=true,disposed=0;
 await assert.rejects(api.qualifyEmbedBundle({parsed,isCurrent:()=>live,createValidator:async()=>({validateDiagramAsset:async()=>{live=false;return true;},dispose:async()=>disposed++})}),{code:'ACCESS_REFUSED'});assert.equal(disposed,1);
});
test('owned recovery verifies diagram blobs, restores them to a fresh project and fails collection closed on damaged authority',async t=>{
 const f=await embedContext(t),recovery=new RecoveryStore(f.root,{sources:f.sources,assets:f.assets});await recovery.checkpointProject({snapshot:f.snapshot,kind:'saved'});const restored=await recovery.restoreSourceSnapshot(f.snapshot,f.projects);assert.notEqual(restored.project.id,f.snapshot.project.id);assert.deepEqual(JSON.parse(restored.json).workpapers,f.metadata.workpapers);
 const ref=f.block.snapshot.visualAsset,path=join(await f.projects.directory(f.snapshot.project.id),'diagram-embed-assets',ref.sha256+'.blob');await writeFile(path,Buffer.alloc(ref.bytes));assert.equal((await recovery.scan(f.snapshot.project.id)).damaged,true);await assert.rejects(scanSourceRecovery({projectId:f.snapshot.project.id,projects:f.projects,repository:f.sources,recovery}));
});
test('bundle export checks base64 wire expansion before reading sources or visuals',async t=>{
 const f=await embedContext(t),{commitManifest}=await import('../src/sources/manifest.mjs');const big=await f.sources.importSource({projectId:f.snapshot.project.id,bytes:Buffer.alloc(25*1024*1024,120)}),big2=await f.sources.importSource({projectId:f.snapshot.project.id,bytes:Buffer.alloc(25*1024*1024,121)});assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,sourceRefs:[...f.snapshot.sourceRefs,big,big2],metadata:f.metadata,operationId:'expanded-backup-budget'})).ok,true);let reads=0;await assert.rejects(api.exportEmbedBundle({snapshot:await f.projects.readProject(f.snapshot.project.id),sources:{readVerifiedVersion:()=>{reads++;assert.fail();}},assets:{read:()=>{reads++;assert.fail();}},isCurrent:()=>true}),{code:'BACKUP_BUDGET'});assert.equal(reads,0);
});
test('correct digest does not admit active SVG; semantic source-version mismatch also refuses before allocation',async t=>{
 const f=await embedContext(t),{commitManifest}=await import('../src/sources/manifest.mjs'),recovery=new RecoveryStore(f.root,{sources:f.sources,assets:f.assets});const evil=await f.assets.put({projectId:f.snapshot.project.id,kind:'svg',bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>alert(1)</script></svg>'),isCurrent:()=>true});const metadata=structuredClone(f.metadata);metadata.diagramEmbedAssets.refs[1]=evil;for(const b of metadata.workpapers[0].blocks)if(b.kind==='diagram-embed')b.snapshot.visualAsset=evil;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.snapshot.project.id,baseRevision:f.snapshot.revision,sourceRefs:f.snapshot.sourceRefs,metadata,operationId:'evil-svg-fixture'})).ok,true);const snapshot=await f.projects.readProject(f.snapshot.project.id),bytes=await api.exportEmbedBundle({snapshot,sources:f.sources,assets:f.assets,isCurrent:()=>true}),before=await readdir(await f.projects.projectsRoot());await assert.rejects(api.importEmbedBundle({bytes,projects:f.projects,sources:f.sources,assets:f.assets,recovery,isCurrent:()=>true,createValidator:validator}),{code:'DIAGRAM_EMBED_SVG_REFUSED'});assert.deepEqual(await readdir(await f.projects.projectsRoot()),before);
 const parsed=api.parseEmbedBundle(bytes);let disposed=false;await assert.rejects(api.qualifyEmbedBundle({parsed,isCurrent:()=>true,createValidator:async()=>({validateDiagramAsset:async()=>false,dispose:async()=>{disposed=true;}})}),{code:'BUNDLE_DIAGRAM_VISUAL_REFUSED'});assert.equal(disposed,true);
 const wire=JSON.parse(bytes),wrong=JSON.parse(wire.snapshot.json);for(const b of wrong.workpapers[0].blocks)if(b.kind==='diagram-embed')b.snapshot.sourceVersion=4;wire.snapshot.json=JSON.stringify(wrong);wire.snapshot.sha256=digest(Buffer.from(wire.snapshot.json));wire.snapshot.requestHash=manifestRequestHash({projectId:wire.snapshot.project.id,baseRevision:wire.snapshot.revision-1,sourceRefs:wire.snapshot.sourceRefs,json:wire.snapshot.json,operationId:wire.snapshot.operationId});await assert.rejects(api.qualifyEmbedBundle({parsed:api.parseEmbedBundle(Buffer.from(JSON.stringify(wire))),isCurrent:()=>true,createValidator:()=>assert.fail('Mismatched capture must refuse before validator creation')}),{code:'BUNDLE_DIAGRAM_SOURCE_INVALID'});
});
