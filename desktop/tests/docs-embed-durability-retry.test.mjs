// Pure persistence integration: no native app, renderer, provider or subprocess.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
import {createDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';

async function fixture(t,{requireCheckpoint=true}={}){
 const parent=resolve(tmpdir()),root=await mkdtemp(join(parent,'siren-embed-retry-'));
 t.after(async()=>{assert.equal(dirname(resolve(root)),parent);assert.match(basename(root),/^siren-embed-retry-/);await rm(root,{recursive:true,force:true});});
 let canSave=true;
 const projects=new ProjectStore(root,{canSave:()=>canSave}),sources=new SourceRepository(root);
 const diagram={id:'flow-a',source:'flowchart TD\n A-->B',sirenNativeVersion:1};
 const initial=await projects.createProject({label:'Retry durability fixture',json:JSON.stringify({workpapers:[{id:'doc-a',title:'Review',blocks:[]}],diagrams:[diagram]})});
 const assets=new DiagramEmbedAssetStore({projects}),scope={projectId:initial.project.id,isCurrent:()=>true};
 const sourceAsset=await assets.put({...scope,kind:'diagram-source',bytes:Buffer.from(JSON.stringify(diagram))});
 const visualAsset=await assets.put({...scope,kind:'svg',bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0L1 1"/></svg>')});
 const block={id:'embed-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:'whole',nodeIds:[],caption:'Context',display:{height:320,fit:'contain'},snapshot:{sourceHash:sourceAsset.sha256,sourceVersion:1,sourceAsset,visualAsset,rendererVersion:'inert-retry-fixture',styleHash:'a'.repeat(64)},status:'current',missingNodeIds:[]};
 const recovery=new RecoveryStore(root,{sources,assets});
 // Inject only the failed checkpoint write; actual checkpoint proof is read by
 // RecoveryStore from real fixture files, never supplied as a boolean answer.
 const failedRecovery={checkpointProject:async()=>{throw Error('controlled checkpoint write failure');},hasSavedSnapshot:snapshot=>recovery.hasSavedSnapshot(snapshot)};
 const repository=(recoveryAdapter=requireCheckpoint?failedRecovery:undefined)=>new DomainRepository({projects:()=>projects,sources:()=>sources,diagramAssets:assets,recovery:recoveryAdapter,validatePatch:()=>true});
 const domains=repository(),token=createDiagramEmbedPublication({documentId:'doc-a',expectedVersion:documentVersion(initial,'doc-a'),operationId:'insert-embed',action:'insert',afterBlockId:null,block});
 return {projects,scope,domains,token,recovery,repository,denySave:()=>{canSave=false;}};
}

test('exact embed retry preserves recovery-degraded while its required saved checkpoint is absent',async t=>{
 const f=await fixture(t),first=await f.domains.commitDiagramEmbed(f.token,f.scope);
 assert.equal(first.ok,true);assert.equal(first.durability,'recovery-degraded');
 const selected=await f.projects.readProject(f.scope.projectId);
 assert.equal(selected.checkpointRequired,true);assert.equal(await f.recovery.hasSavedSnapshot(selected),false);
 const retry=await f.domains.commitDiagramEmbed(f.token,f.scope);
 assert.equal(retry.ok,true);assert.equal(retry.durability,'recovery-degraded');
 assert.deepEqual(retry,first);assert.deepEqual(await f.projects.readProject(f.scope.projectId),selected);
});

test('embed retry upgrades durability only after the exact recovery checkpoint is verified',async t=>{
 const f=await fixture(t),first=await f.domains.commitDiagramEmbed(f.token,f.scope);
 assert.equal(first.durability,'recovery-degraded');
 const selected=await f.projects.readProject(f.scope.projectId);
 await f.recovery.checkpointProject({snapshot:selected,kind:'saved'});
 assert.equal(await f.recovery.hasSavedSnapshot(selected),true);
 const retry=await f.domains.commitDiagramEmbed(f.token,f.scope);
 assert.equal(retry.ok,true);assert.equal(retry.durability,'committed');
 assert.equal(retry.version,first.version);assert.equal(retry.projectRevision,first.projectRevision);
 assert.deepEqual(await f.projects.readProject(f.scope.projectId),selected);
});

test('embed retry without a recovery adapter retains the saved checkpoint-required policy',async t=>{
 const f=await fixture(t);assert.equal((await f.domains.commitDiagramEmbed(f.token,f.scope)).durability,'recovery-degraded');
 const unavailable=f.repository(null),retry=await unavailable.commitDiagramEmbed(f.token,f.scope);
 assert.equal(retry.ok,true);assert.equal(retry.durability,'recovery-degraded');
});

test('embed retry remains committed when no checkpoint was required by the saved manifest',async t=>{
 const f=await fixture(t,{requireCheckpoint:false}),first=await f.domains.commitDiagramEmbed(f.token,f.scope);
 assert.equal(first.ok,true);assert.equal(first.durability,'committed');
 const selected=await f.projects.readProject(f.scope.projectId);assert.equal(selected.checkpointRequired,false);
 assert.deepEqual(await f.domains.commitDiagramEmbed(f.token,f.scope),first);
 assert.deepEqual(await f.projects.readProject(f.scope.projectId),selected);
});

test('embed retry rechecks save admission before acknowledging the manifest duplicate',async t=>{
 const f=await fixture(t);assert.equal((await f.domains.commitDiagramEmbed(f.token,f.scope)).ok,true);
 const selected=await f.projects.readProject(f.scope.projectId);f.denySave();
 assert.deepEqual(await f.domains.commitDiagramEmbed(f.token,f.scope),{ok:false,code:'ACCESS_REFUSED'});
 assert.deepEqual(await f.projects.readProject(f.scope.projectId),selected);
});
