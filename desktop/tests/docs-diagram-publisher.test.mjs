import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
import {createDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
async function fixture(t){
 const diagram={id:'flow-a',name:'Saved flow',source:'flowchart TD\n A-->B',sirenNativeVersion:1};
 const f=await sourceReadFixture({workpapers:[{id:'doc-a',blocks:[{id:'text-a',kind:'paragraph',text:'Keep me'}]}],diagrams:[diagram]});t.after(()=>rm(f.root,{recursive:true,force:true}));
 const assets=new DiagramEmbedAssetStore({projects:f.projects}),scope={projectId:f.selected.project.id,isCurrent:()=>true};
 const sourceAsset=await assets.put({...scope,kind:'diagram-source',bytes:Buffer.from(JSON.stringify(diagram))}),visualAsset=await assets.put({...scope,kind:'svg',bytes:Buffer.from('<svg/>')});
 const block={id:'embed-a',kind:'diagram-embed',schema:1,diagramId:diagram.id,scope:'whole',nodeIds:[],caption:'Context',display:{height:320,fit:'contain'},snapshot:{sourceHash:digest(Buffer.from(JSON.stringify(diagram))),sourceVersion:1,sourceAsset,visualAsset,rendererVersion:'test-only',styleHash:'a'.repeat(64)},status:'current',missingNodeIds:[]};
 const repository=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>true,diagramAssets:assets});
 const request=(patch={})=>createDiagramEmbedPublication({documentId:'doc-a',expectedVersion:documentVersion(f.selected,'doc-a'),operationId:'embed-insert',action:'insert',afterBlockId:'text-a',block,...patch});
 return {...f,diagram,assets,scope,block,repository,request};
}
test('main-only background refresh uses a private sticky capability, the shared FIFO and actual publication receipts',async t=>{
 const f=await fixture(t);assert.equal((await f.repository.commitDiagramEmbed(f.request(),f.scope)).ok,true);const saved=await f.projects.readProject(f.scope.projectId),version=documentVersion(saved,'doc-a');let permitted=true;const notices=[];
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains:f.repository,access:()=>true,nativeDiagramRefreshAccess:(projectId,id)=>permitted&&projectId===f.scope.projectId&&id==='doc-a'});
 assert.equal(typeof owner.captureDiagramRefresh,'function','Missing native refresh authority');assert.equal(typeof owner.invokeDiagramRefresh,'function');assert.equal(typeof owner.observeDomainSaves,'function');const off=owner.observeDomainSaves(r=>notices.push(r));
 const capability=owner.captureDiagramRefresh(f.scope.projectId,'doc-a'),token=f.request({action:'refresh',afterBlockId:null,expectedVersion:version,operationId:'native-refresh',block:{...f.block,mode:'live',snapshot:{...f.block.snapshot,styleHash:'b'.repeat(64)}}});
 assert.throws(()=>structuredClone(capability));assert.equal((await owner.invokeDiagramRefresh(token,{projectId:f.scope.projectId,documentId:'doc-a'})).code,'ACCESS_REFUSED');assert.equal((await owner.invoke(f.registry.capture(f.event(1)),{kind:'docs-diagram',method:'commit',payload:token})).code,'REQUEST_REFUSED');
 const [first,second]=await Promise.all([owner.invokeDiagramRefresh(token,capability),owner.invokeDiagramRefresh(f.request({action:'refresh',afterBlockId:null,expectedVersion:version,operationId:'native-refresh-conflict'}),capability)]);assert.equal(first.ok,true,JSON.stringify(first));assert.equal(second.code,'DOCUMENT_CONFLICT');assert.equal(notices.length,1);assert.equal(notices[0].domain,'docs');assert.equal(notices[0].receipt.version,first.version);off();
 const retired=owner.captureDiagramRefresh(f.scope.projectId,'doc-a');owner.pause('lock');owner.resume();assert.equal(retired.isCurrent(),false);assert.equal((await owner.invokeDiagramRefresh(token,retired)).code,'ACCESS_REFUSED');permitted=false;assert.equal(owner.captureDiagramRefresh(f.scope.projectId,'doc-a'),null);
 const unconfigured=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains:f.repository,access:()=>true});assert.equal(unconfigured.captureDiagramRefresh(f.scope.projectId,'doc-a'),null);
});
test('main-only publisher commits asset references and exact block after selected text, retry is idempotent',async t=>{
 const f=await fixture(t);assert.equal(typeof f.repository.commitDiagramEmbed,'function','Missing main-only publisher');
 const token=f.request(),saved=await f.repository.commitDiagramEmbed(token,f.scope);assert.equal(saved.ok,true,JSON.stringify(saved));
 const current=await f.projects.readProject(f.scope.projectId),metadata=JSON.parse(current.json);assert.deepEqual(metadata.workpapers[0].blocks.map(b=>b.id),['text-a','embed-a']);assert.equal(metadata.workpapers[0].blocks[1].mode,'live');assert.equal(metadata.diagramEmbedAssets.refs.length,2);assert.deepEqual(metadata.diagrams,[f.diagram]);
 assert.equal((await f.repository.commitDiagramEmbed(token,f.scope)).ok,true);assert.deepEqual(await f.projects.readProject(f.scope.projectId),current);
});
test('publisher refuses cloned authority, stale document, missing visual and duplicate block without writing',async t=>{
 const f=await fixture(t);assert.equal(typeof f.repository.commitDiagramEmbed,'function','Missing main-only publisher');
 for(const token of [structuredClone(f.request()),f.request({expectedVersion:'0'.repeat(64)}),f.request({block:{...f.block,id:'text-a'}}),f.request({block:{...f.block,snapshot:{...f.block.snapshot,visualAsset:{...f.block.snapshot.visualAsset,sha256:'b'.repeat(64)}}}})])assert.equal((await f.repository.commitDiagramEmbed(token,f.scope)).ok,false);
 assert.deepEqual(await f.projects.readProject(f.scope.projectId),f.selected);
});
test('publisher checks source again at commit and refuses deleted or changed diagrams',async t=>{
 const f=await fixture(t);assert.equal(typeof f.repository.commitDiagramEmbed,'function','Missing main-only publisher');const token=f.request();
 const metadata=JSON.parse(f.selected.json);metadata.diagrams[0].source+='\n B-->C';metadata.diagrams[0].sirenNativeVersion=2;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.scope.projectId,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'change-source'})).ok,true);
 assert.equal((await f.repository.commitDiagramEmbed(token,f.scope)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');
 const changed=await f.projects.readProject(f.scope.projectId);metadata.diagrams=[];
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.scope.projectId,baseRevision:changed.revision,sourceRefs:changed.sourceRefs,metadata,operationId:'delete-source'})).ok,true);
 assert.equal((await f.repository.commitDiagramEmbed(token,f.scope)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');
});
test('Fixed mode preserves saved visual when source is gone; mode change cannot replace content',async t=>{
 const f=await fixture(t);assert.equal(typeof f.repository.commitDiagramEmbed,'function','Missing main-only publisher');assert.equal((await f.repository.commitDiagramEmbed(f.request(),f.scope)).ok,true);
 let current=await f.projects.readProject(f.scope.projectId);const metadata=JSON.parse(current.json),old=metadata.workpapers[0].blocks[1];metadata.diagrams=[];
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.scope.projectId,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:'remove-source'})).ok,true);current=await f.projects.readProject(f.scope.projectId);
 const args={action:'mode',afterBlockId:null,expectedVersion:documentVersion(current,'doc-a'),operationId:'fix-version',block:{...old,mode:'fixed'}};
 assert.equal((await f.repository.commitDiagramEmbed(f.request({...args,block:{...args.block,caption:'forged replacement'}}),f.scope)).ok,false);
 assert.equal((await f.repository.commitDiagramEmbed(f.request(args),f.scope)).ok,true);
 assert.deepEqual(JSON.parse((await f.projects.readProject(f.scope.projectId)).json).workpapers[0].blocks[1],{...old,mode:'fixed'});
});
test('owner admits private publication into Docs FIFO and rejects copied tokens and foreign document grants',async t=>{
 const f=await fixture(t),owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains:f.repository,access:()=>true}),grant=f.registry.capture(f.event(1));
 const call=(g,token)=>owner.invoke(g,{kind:'docs-diagram',method:'commit',payload:token});
 assert.equal((await call(grant,structuredClone(f.request()))).code,'REQUEST_REFUSED');assert.equal((await call(f.registry.capture(f.event(0)),f.request())).code,'ACCESS_REFUSED');
 const saved=await call(grant,f.request());assert.equal(saved.ok,true,JSON.stringify(saved));assert.equal(saved.domain,'docs');assert.equal((await owner.drain()).length,0);
});
test('owner pause/resume permanently revokes in-flight publication before persistence',async t=>{
 const f=await fixture(t);let release,entered;const wait=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
 const repository=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,diagramAssets:f.assets,validatePatch:async()=>{entered();await wait;return true;}});
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains:repository,access:()=>true}),grant=f.registry.capture(f.event(1));
 const pending=owner.invoke(grant,{kind:'docs-diagram',method:'commit',payload:f.request()});
 assert.equal(await Promise.race([ready.then(()=>true),pending.then(()=>false)]),true,'publication must reach controlled validation');owner.pause('lock');owner.resume();release();
 assert.equal((await pending).code,'ACCESS_REFUSED');await owner.drain();assert.deepEqual(await f.projects.readProject(f.scope.projectId),f.selected);
});
test('ordinary document saves retain embeds but cannot manufacture or change their source authority',async t=>{
 const f=await fixture(t);assert.equal((await f.repository.commitDiagramEmbed(f.request(),f.scope)).ok,true);const current=await f.projects.readProject(f.scope.projectId),blocks=JSON.parse(current.json).workpapers[0].blocks,version=documentVersion(current,'doc-a');
 const apply=(blocks,operationId)=>f.repository.apply('docs',{documentId:'doc-a',expectedVersion:version,operationId,action:'replace-blocks',payload:{blocks}},f.scope);
 assert.equal((await apply([...blocks,{...blocks[1],id:'invented'}],'forge-embed')).ok,false);
 assert.equal((await apply([blocks[0],{...blocks[1],diagramId:'different'}],'forge-source')).ok,false);
 assert.equal((await apply([blocks[0],{...blocks[1],mode:'fixed'}],'forge-mode')).ok,false);
 assert.deepEqual(await f.projects.readProject(f.scope.projectId),current);
 assert.equal((await apply([blocks[1],{...blocks[0],text:'Edited around diagram'}],'keep-embed')).ok,true);
});
