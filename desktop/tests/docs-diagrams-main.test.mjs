import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
import {createDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
test('actual main admits background refresh only for the writable selected project and joins it in the native barrier',async t=>{
 const f=await nativeSourceContext();t.after(()=>rm(f.root,{recursive:true,force:true}));const pid=f.selected.project.id;
 assert.equal(vm.runInContext('typeof docsDiagramRefresh',f.context),'object','Main scheduler must be connected');
 assert.equal(f.context.owner.captureDiagramRefresh(pid,'doc-a'),null,'readonly selection cannot publish');f.context.nativeReadonly=false;f.context.mode='normal';
 assert.equal(f.context.owner.captureDiagramRefresh(pid,'doc-a')?.isCurrent(),true);assert.equal(f.context.owner.captureDiagramRefresh('other-project','doc-a'),null);
 f.context.pinTransition=true;assert.equal(f.context.owner.captureDiagramRefresh(pid,'doc-a'),null);f.context.pinTransition=false;
 const source=mainSlice('const prepareNativeWorkspace=',"ipcMain.handle('siren:view-ack'");for(const token of ['docsDiagramRefresh.pause','docsDiagramRefresh.resume','docsDiagramRefresh.drain','docsDiagramRefresh.isIdle'])assert.ok(source.includes(token),token);
 vm.runInContext('void docsDiagramRefresh.pause()',f.context);await vm.runInContext('docsDiagramRefresh.drain()',f.context);assert.equal(vm.runInContext('docsDiagramRefresh.isIdle()',f.context),true);
});
test('actual main background receipt notifies a real scoped readonly Docs frame with metadata only',async t=>{
 const f=await nativeSourceContext();t.after(()=>rm(f.root,{recursive:true,force:true}));const projectId=f.selected.project.id,assets=new DiagramEmbedAssetStore({projects:f.projects}),sourceAsset=await assets.put({projectId,kind:'diagram-source',bytes:Buffer.from('{}'),isCurrent:()=>true}),visualAsset=await assets.put({projectId,kind:'svg',bytes:Buffer.from('<svg/>'),isCurrent:()=>true});const block={id:'embed-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:'whole',nodeIds:[],caption:'Stored flow',display:{height:320,fit:'contain'},snapshot:{sourceHash:sourceAsset.sha256,sourceVersion:1,sourceAsset,visualAsset,rendererVersion:'inert-fixture',styleHash:'a'.repeat(64)},status:'current',missingNodeIds:[]};const metadata={workpapers:[{id:'doc-a',blocks:[block]}],diagramEmbedAssets:{schema:1,refs:[sourceAsset,visualAsset]}};assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'seed-stored-embed'})).ok,true);const current=await f.projects.readProject(projectId);f.context.snapshot=current;f.context.nativeReadonly=false;f.context.mode='normal';
 // Trusted semantic validator is a fixture; no BrowserWindow/import engine runs.
 f.context.validateDomainPatch=async()=>true;const notices=[];f.windows[1].webContents.send=(channel,value)=>notices.push({channel,value});const capability=f.context.owner.captureDiagramRefresh(projectId,'doc-a'),token=createDiagramEmbedPublication({documentId:'doc-a',operationId:'main-background-warning',expectedVersion:documentVersion(current,'doc-a'),action:'status',afterBlockId:null,block:{...block,status:'missing'}}),result=await f.context.owner.invokeDiagramRefresh(token,capability);assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(notices.map(n=>n.channel),['siren:working-docs-changed']);assert.deepEqual(Object.keys(notices[0].value).sort(),['documentId','projectRevision','version']);assert.equal(notices[0].value.version,result.version);f.context.pinTransition=true;assert.equal(f.context.owner.captureDiagramRefresh(projectId,'doc-a'),null);
});
test('actual main routes scoped Docs metadata, rejects Lock, and refuses a declared unsupported passive renderer',async t=>{
 const f=await nativeSourceContext();t.after(()=>rm(f.root,{recursive:true,force:true}));
 // Explicit unsupported-build DATA; current generated output may already support embeds.
 // Keep actual main/Docs routing and project IO, while proving this pre-render refusal.
 const actualRead=f.context.readOwnedBytes,buildPath=join(f.context.rendererRoot,'build.json');let buildReads=0,appearanceCalls=0,renderCalls=0;
 f.context.readOwnedBytes=async(path,cap)=>{if(path!==buildPath)return actualRead(path,cap);assert.equal(cap,65536);buildReads++;return Buffer.from('{"diagramVector":{"embedSupported":false}}');};
 f.context.nativeRenderAppearance=()=>{appearanceCalls++;throw Error('Unsupported renderer must not read appearance');};
 f.context.renderDiagramEmbed=()=>{renderCalls++;throw Error('Unsupported renderer must not start rendering');};
 const metadata={workpapers:[{id:'doc-a',blocks:[]}],diagrams:[{id:'flow-a',name:'Actual saved flow',source:'flowchart TD\n A-->B'}]};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'main-diagram-catalogue'})).ok,true);const current=await f.projects.readProject(f.selected.project.id);f.context.snapshot=current;
 vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);const handler=f.handlers.get('siren:docs-diagrams');assert.equal(typeof handler,'function');
 const list=await handler(f.event(1),'listDiagrams',{});assert.equal(list.ok,true,JSON.stringify(list));assert.equal(list.items[0].label,'Actual saved flow');assert.equal(f.context.writes.size,0);
 assert.equal((await handler(f.event(0),'listDiagrams',{})).code,'ACCESS_REFUSED');
 assert.equal((await handler(f.event(1),'preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]})).code,'DIAGRAM_EMBED_RENDER_UNAVAILABLE');
 assert.equal(buildReads,1);assert.equal(appearanceCalls,0);assert.equal(renderCalls,0,'Unavailable build must refuse before any renderer/BrowserWindow entry');
 f.context.pinTransition=true;assert.equal((await handler(f.event(1),'listDiagrams',{})).code,'ACCESS_REFUSED');assert.equal(f.context.writes.size,0);assert.deepEqual(await f.projects.readProject(f.selected.project.id),current);
});
