import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {DocsDiagramRefresh} from '../src/windows/docs-diagram-refresh.mjs';
import {NativeDocsEdits} from '../src/windows/docs-edits.mjs';
const api=await import('../src/windows/docs-diagrams.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
async function fixture(t,{render,show,renderIdentityFor}={}){
 const diagram={id:'flow-a',name:'Saved flow',source:'flowchart TD\n A-->B',sirenNativeVersion:1};
 const f=await sourceReadFixture({workpapers:[{id:'doc-a',blocks:[{id:'text-a',kind:'paragraph',text:'Before'}]}],diagrams:[diagram]});t.after(()=>rm(f.root,{recursive:true,force:true}));
 const assets=new DiagramEmbedAssetStore({projects:f.projects}),repository=new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,diagramAssets:assets,validatePatch:()=>true});let working=true;
 const owner=new WorkspaceCoordinator({registry:f.registry,sources:()=>f.sources,domains:repository,access:()=>f.isUnlocked(),nativeDiagramRefreshAccess:()=>f.isUnlocked()});
 assert.equal(typeof api.NativeDocsDiagrams,'function','Missing Docs diagram service');
 let shows=0;const service=new api.NativeDocsDiagrams({registry:f.registry,owner,projects:f.projects,assets,snapshotFor:g=>f.projects.readProject(g.projectId),workingState:()=>working,renderIdentityFor,show:()=>{shows++;show?.();},render:render??(async()=>({bytes:Buffer.from('<svg/>'),kind:'svg',rendererVersion:'fixture-only',styleHash:'a'.repeat(64)}))});t.after(()=>service.dispose());
 const call=(method,payload,event=f.event(1))=>service.invoke({event,method,payload});const insert=(previewId,patch={})=>call('insert',{previewId,afterBlockId:'text-a',caption:'Flow',expectedDocumentVersion:documentVersion(f.selected,'doc-a'),operationId:'insert-preview',...patch});
 return {...f,assets,owner,service,call,insert,shows:()=>shows,working:v=>working=v};
}
test('preview receipt inserts exact saved source, idempotently, then reads project-owned visual',async t=>{
 const f=await fixture(t),list=await f.call('listDiagrams',{});assert.equal(list.ok,true);assert.equal(list.items[0].id,'flow-a');
 const preview=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(preview.ok,true,JSON.stringify(preview));
 assert.equal(Buffer.from(preview.visual.base64,'base64').toString(),'<svg/>','picker must display the exact preview visual');
 const saved=await f.insert(preview.previewId);assert.equal(saved.ok,true,JSON.stringify(saved));assert.equal((await f.insert(preview.previewId)).ok,true);
 const current=await f.projects.readProject(f.selected.project.id),doc=JSON.parse(current.json).workpapers[0],block=doc.blocks[1];assert.equal(block.mode,'live');assert.equal(block.diagramId,'flow-a');assert.equal(block.snapshot.sourceHash,preview.sourceHash);
 const read=await f.call('readEmbed',{blockId:block.id,expectedDocumentVersion:documentVersion(current,'doc-a')});assert.equal(read.ok,true,JSON.stringify(read));assert.equal(Buffer.from(read.visual.base64,'base64').toString(),'<svg/>');
});
test('main independently qualifies saved selection and discovery; renderer receives only the exact semantic fragment',async t=>{
 let rendered;const f=await fixture(t,{render:async capture=>{rendered=capture;return {bytes:Buffer.from('<svg/>'),kind:'svg',rendererVersion:'fixture-only',styleHash:'a'.repeat(64)};}});
 const discovery=await f.call('inspectSelection',{diagramId:'flow-a'});assert.equal(discovery.ok,true,JSON.stringify(discovery));assert.deepEqual(discovery.nodes.map(n=>n.id),['A','B']);assert.equal(Object.hasOwn(discovery,'source'),false);
 const selected=await f.call('preview',{diagramId:'flow-a',scope:'selection',nodeIds:['A']});assert.equal(selected.ok,true,JSON.stringify(selected));assert.equal(rendered.source,'flowchart TD\nA');assert.deepEqual(selected.boundary.map(e=>[e.from,e.to]),[['A','B']]);assert.equal((await f.insert(selected.previewId)).ok,true);
 const state=await f.projects.readProject(f.selected.project.id),block=JSON.parse(state.json).workpapers[0].blocks[1];assert.equal(block.scope,'selection');assert.deepEqual(block.nodeIds,['A']);const bytes=await f.assets.read({projectId:state.project.id,ref:block.snapshot.sourceAsset,isCurrent:()=>true});assert.equal(JSON.parse(bytes).source,'flowchart TD\n A-->B','original full saved capture remains the authority');
 rendered=null;const missing=await f.call('preview',{diagramId:'flow-a',scope:'selection',nodeIds:['Gone']});assert.equal(missing.code,'DIAGRAM_EMBED_SELECTION_MISSING');assert.equal(rendered,null);
});
test('Send to Docs transfers bounded saved identifiers without writing or trusting caller source',async t=>{
 const f=await fixture(t);await f.registry.openView({role:'diagram',entityId:'flow-a'});const event=f.event(2),diagram=JSON.parse(f.selected.json).diagrams[0],request={documentId:'doc-a',scope:'selection',nodeIds:['A'],expectedVersion:1,expectedSha256:digest(Buffer.from(JSON.stringify(diagram)))};
 const listed=await f.call('listDocuments',{},event);assert.equal(listed.ok,true,JSON.stringify(listed));assert.deepEqual(listed.items.map(n=>n.id),['doc-a']);
 assert.equal((await f.call('sendToDocs',{...request,source:'forged'},event)).code,'REQUEST_REFUSED');assert.equal((await f.call('sendToDocs',{...request,expectedSha256:'0'.repeat(64)},event)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');
 const sent=await f.call('sendToDocs',request,event);assert.equal(sent.ok,true,JSON.stringify(sent));assert.equal(sent.view.role,'docs');assert.equal(f.shows(),1);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected,'transfer cannot publish an embed');
 const proposal=await f.call('getProposal',{});assert.equal(proposal.ok,true,JSON.stringify(proposal));assert.deepEqual(proposal.proposal.nodeIds,['A']);assert.equal(proposal.proposal.diagramId,'flow-a');assert.equal(Object.hasOwn(proposal.proposal,'source'),false);
 assert.equal((await f.call('sendToDocs',request)).code,'ACCESS_REFUSED');f.service.pause();f.service.resume();assert.equal((await f.call('getProposal',{})).proposal,null);
});
test('Lock during Send to Docs destroys the new target and cannot revive its proposal',async t=>{
 const f=await fixture(t);await f.registry.openView({role:'diagram',entityId:'flow-a'});const diagram=JSON.parse(f.selected.json).diagrams[0],original=f.registry.openView.bind(f.registry);let opened;
 f.registry.openView=async request=>{opened=await original(request);f.service.pause();f.service.resume();return opened;};
 const result=await f.call('sendToDocs',{documentId:'doc-a',scope:'whole',nodeIds:[],expectedVersion:1,expectedSha256:digest(Buffer.from(JSON.stringify(diagram)))},f.event(2));assert.equal(result.code,'ACCESS_REFUSED');assert.equal(f.registry.listViews().some(v=>v.windowId===opened.windowId),false);assert.equal(f.shows(),0);assert.equal((await f.call('getProposal',{})).proposal,null);assert.equal(f.service.isIdle(),true);
});
test('a failed target show cannot leave a successful transfer proposal behind',async t=>{
 const f=await fixture(t,{show:()=>{throw Error('fixture show failure');}});await f.registry.openView({role:'diagram',entityId:'flow-a'});const diagram=JSON.parse(f.selected.json).diagrams[0],before=f.registry.listViews().length;
 const result=await f.call('sendToDocs',{documentId:'doc-a',scope:'whole',nodeIds:[],expectedVersion:1,expectedSha256:digest(Buffer.from(JSON.stringify(diagram)))},f.event(2));assert.equal(result.ok,false);assert.equal(f.registry.listViews().length,before);assert.equal((await f.call('getProposal',{})).proposal,null);
});
test('background preparation persists the latest saved source with Docs closed and leaves Fixed exactly unchanged',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);let saved=await f.projects.readProject(f.selected.project.id),metadata=JSON.parse(saved.json),live=metadata.workpapers[0].blocks[1];metadata.workpapers[0].blocks.push({...live,id:'fixed-a',mode:'fixed'});metadata.diagrams[0].source+='\n B-->C';metadata.diagrams[0].sirenNativeVersion=2;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:saved.project.id,baseRevision:saved.revision,sourceRefs:saved.sourceRefs,metadata,operationId:'refresh-source'})).ok,true);await f.registry.discardViewAsync(f.registry.listViews().find(v=>v.role==='docs').windowId);
 assert.equal(typeof f.service.listRefreshTargets,'function','Missing native refresh preparation');const targets=await f.service.listRefreshTargets({projectId:saved.project.id,diagramId:'flow-a',isCurrent:()=>true});assert.deepEqual(targets.map(v=>v.blockId),[live.id]);
 const capability=f.owner.captureDiagramRefresh(saved.project.id,'doc-a'),prepared=await f.service.prepareRefresh({projectId:saved.project.id,documentId:'doc-a',blockId:live.id,capability,isCurrent:()=>true});assert.ok(prepared.token,JSON.stringify(prepared));assert.equal((await f.owner.invokeDiagramRefresh(prepared.token,capability)).ok,true);saved=await f.projects.readProject(saved.project.id);const blocks=JSON.parse(saved.json).workpapers[0].blocks;assert.equal(blocks[1].snapshot.sourceVersion,2);assert.deepEqual(blocks[2],metadata.workpapers[0].blocks[2]);assert.equal((await f.service.prepareRefresh({projectId:saved.project.id,documentId:'doc-a',blockId:live.id,capability,isCurrent:()=>true})).skip,true);
});
test('real native settlement refreshes persisted embeds after user text save without deadlock or lost text',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);let snapshot=await f.projects.readProject(f.selected.project.id),edits;const projectId=snapshot.project.id,notices=[];
 const service=new DocsDiagramRefresh({owner:f.owner,diagrams:f.service,workingState:{isBlocked:(pid,id)=>edits?.canRefresh(pid,id)===false,onPending:r=>notices.push(r)}});t.after(()=>service.dispose());edits=new NativeDocsEdits({registry:f.registry,owner:f.owner,enabled:()=>f.isUnlocked(),snapshotFor:()=>snapshot,onSettled:async ref=>{service.onDocumentSettled(ref);await service.drain();}});t.after(()=>edits.dispose());assert.equal((await edits.admit(f.registry.capture(f.event(1)))).ok,true);
 const metadata=JSON.parse(snapshot.json);metadata.diagrams[0].nodeStyles={A:{fill:'#abcdef'}};metadata.diagrams[0].sirenNativeVersion=2;assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId,baseRevision:snapshot.revision,sourceRefs:snapshot.sourceRefs,metadata,operationId:'style-only-source'})).ok,true);snapshot=await f.projects.readProject(projectId);await service.rescanProject(projectId);await service.drain();assert.equal(notices.at(-1).reason,'working-draft');assert.equal(JSON.parse(snapshot.json).workpapers[0].blocks[1].snapshot.sourceVersion,1);
 const result=await edits.invoke({event:f.event(1),method:'applyDocument',payload:{documentId:'doc-a',operationId:'save-user-context',expectedVersion:documentVersion(snapshot,'doc-a'),action:'rename',payload:{title:'User context retained'}}});assert.equal(result.ok,true,JSON.stringify(result));snapshot=await f.projects.readProject(projectId);const saved=JSON.parse(snapshot.json).workpapers[0];assert.equal(saved.title,'User context retained');assert.equal(saved.blocks[1].snapshot.sourceVersion,2);assert.equal(service.isIdle(),true);
});
test('deleted selected identity and deleted source persist a warning without changing last-good visual/source evidence',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'selection',nodeIds:['A']});assert.equal((await f.insert(p.previewId)).ok,true);let saved=await f.projects.readProject(f.selected.project.id),metadata=JSON.parse(saved.json),before=metadata.workpapers[0].blocks[1];metadata.diagrams[0].source='flowchart TD\n C[A]\n B';metadata.diagrams[0].sirenNativeVersion=2;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:saved.project.id,baseRevision:saved.revision,sourceRefs:saved.sourceRefs,metadata,operationId:'missing-selection'})).ok,true);assert.equal(typeof f.service.prepareRefresh,'function','Missing native refresh preparation');const capability=f.owner.captureDiagramRefresh(saved.project.id,'doc-a');const prepare=()=>f.service.prepareRefresh({projectId:saved.project.id,documentId:'doc-a',blockId:before.id,capability,isCurrent:()=>true});let next=await prepare();assert.equal((await f.owner.invokeDiagramRefresh(next.token,capability)).ok,true);saved=await f.projects.readProject(saved.project.id);metadata=JSON.parse(saved.json);assert.equal(metadata.workpapers[0].blocks[1].status,'missing');assert.deepEqual(metadata.workpapers[0].blocks[1].missingNodeIds,['A']);assert.deepEqual(metadata.workpapers[0].blocks[1].snapshot,before.snapshot);
 metadata.diagrams=[];assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:saved.project.id,baseRevision:saved.revision,sourceRefs:saved.sourceRefs,metadata,operationId:'deleted-source'})).ok,true);next=await prepare();if(next.token)assert.equal((await f.owner.invokeDiagramRefresh(next.token,capability)).ok,true);saved=await f.projects.readProject(saved.project.id);assert.deepEqual(JSON.parse(saved.json).workpapers[0].blocks[1].snapshot,before.snapshot);
});
test('refresh cache binds full capture, selection and trusted renderer appearance and preserves last-good on render failure',async t=>{
 let appearance='a',calls=0,fail=false;const f=await fixture(t,{renderIdentityFor:async()=>({key:appearance.repeat(64)}),render:async(_capture,_selection,scope)=>{calls++;if(fail)throw Error('fixture render failure');assert.equal(scope.renderIdentity.key,appearance.repeat(64));return {bytes:Buffer.from('<svg>'+appearance+'</svg>'),kind:'svg',rendererVersion:'fixture-only',styleHash:appearance.repeat(64)};}}),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);const projectId=f.selected.project.id,capability=f.owner.captureDiagramRefresh(projectId,'doc-a');let saved=await f.projects.readProject(projectId),block=JSON.parse(saved.json).workpapers[0].blocks[1];const prepare=()=>f.service.prepareRefresh({projectId,documentId:'doc-a',blockId:block.id,capability,isCurrent:()=>true});
 await prepare();await prepare();assert.equal(calls,2,'unchanged capture should reuse the same trusted rendering');appearance='b';let next=await prepare();assert.ok(next.token);assert.equal((await f.owner.invokeDiagramRefresh(next.token,capability)).ok,true);saved=await f.projects.readProject(projectId);const good=JSON.parse(saved.json).workpapers[0].blocks[1].snapshot;assert.equal(good.sourceHash,block.snapshot.sourceHash);assert.equal(good.styleHash,'b'.repeat(64));appearance='c';fail=true;next=await prepare();assert.equal((await f.owner.invokeDiagramRefresh(next.token,capability)).ok,true);saved=await f.projects.readProject(projectId);block=JSON.parse(saved.json).workpapers[0].blocks[1];assert.equal(block.status,'render-error');assert.deepEqual(block.snapshot,good);
});

test('ordinary Undo restores only a genuine historical embed and suspends Live until explicit mode choice',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);let saved=await f.projects.readProject(f.selected.project.id);const original=structuredClone(JSON.parse(saved.json).workpapers[0].blocks),block=original[1],projectId=saved.project.id,grant=f.registry.capture(f.event(1));
 const write=async(blocks,operationId)=>{const latest=await f.projects.readProject(projectId);return f.owner.invoke(grant,{kind:'docs',method:'applyDocument',payload:{documentId:'doc-a',expectedVersion:documentVersion(latest,'doc-a'),operationId,action:'replace-blocks',payload:{blocks}}});};
 assert.equal((await write(original.filter(b=>b.id!==block.id),'remove-embed')).ok,true);const restored=await write(original,'undo-remove-embed');assert.equal(restored.ok,true,JSON.stringify(restored));saved=await f.projects.readProject(projectId);assert.deepEqual(JSON.parse(saved.json).workpapers[0].blocks,original);
 const capability=f.owner.captureDiagramRefresh(projectId,'doc-a');assert.equal((await f.service.prepareRefresh({projectId,documentId:'doc-a',blockId:block.id,capability,isCurrent:()=>true})).skip,true);const read=await f.call('readEmbed',{blockId:block.id,expectedDocumentVersion:documentVersion(saved,'doc-a')});assert.equal(read.refreshSuspended,true);
 assert.equal((await write(original.map(b=>b.id===block.id?{...b,snapshot:{...b.snapshot,styleHash:'0'.repeat(64)}}:b),'forged-history')).code,'DIAGRAM_EMBED_REFUSED');
 assert.equal((await f.call('setMode',{blockId:block.id,mode:'live',expectedDocumentVersion:documentVersion(saved,'doc-a'),operationId:'resume-restored'})).ok,true);saved=await f.projects.readProject(projectId);assert.equal((await f.call('readEmbed',{blockId:block.id,expectedDocumentVersion:documentVersion(saved,'doc-a')})).refreshSuspended,false);
});
test('switching a stale Fixed block to Live requires and atomically adopts the exact current preview',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);let saved=await f.projects.readProject(f.selected.project.id),block=JSON.parse(saved.json).workpapers[0].blocks[1];assert.equal((await f.call('setMode',{blockId:block.id,mode:'fixed',expectedDocumentVersion:documentVersion(saved,'doc-a'),operationId:'freeze-before-change'})).ok,true);saved=await f.projects.readProject(saved.project.id);let metadata=JSON.parse(saved.json);metadata.diagrams[0].source+='\n B-->C';metadata.diagrams[0].sirenNativeVersion=2;assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:saved.project.id,baseRevision:saved.revision,sourceRefs:saved.sourceRefs,metadata,operationId:'change-fixed-source'})).ok,true);saved=await f.projects.readProject(saved.project.id);
 const request={blockId:block.id,mode:'live',expectedDocumentVersion:documentVersion(saved,'doc-a'),operationId:'resume-with-preview'};assert.equal((await f.call('setMode',request)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');const current=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});const result=await f.call('setMode',{...request,previewId:current.previewId});assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(await f.call('setMode',{...request,previewId:current.previewId}),result);saved=await f.projects.readProject(saved.project.id);block=JSON.parse(saved.json).workpapers[0].blocks[1];assert.equal(block.mode,'live');assert.equal(block.snapshot.sourceVersion,2);
});

test('forged receipt, renderer project, foreign frame, readonly write and stale CAS are refused',async t=>{
 const f=await fixture(t);assert.equal((await f.insert('forged')).ok,false);assert.equal((await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[],projectId:f.selected.project.id})).code,'REQUEST_REFUSED');
 assert.equal((await f.call('listDiagrams',{},f.event(0))).code,'ACCESS_REFUSED');
 const p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(p.ok,true);
 assert.equal((await f.insert(p.previewId,{expectedDocumentVersion:'0'.repeat(64)})).code,'DOCUMENT_CONFLICT');f.working(false);assert.equal((await f.insert(p.previewId)).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('saved source change and deletion invalidate exact preview',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(p.ok,true);
 const metadata=JSON.parse(f.selected.json);metadata.diagrams[0].source+='\n B-->C';metadata.diagrams[0].sirenNativeVersion=2;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'source-edit'})).ok,true);
 assert.equal((await f.insert(p.previewId)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');const current=await f.projects.readProject(f.selected.project.id);metadata.diagrams=[];
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:'source-delete'})).ok,true);assert.equal((await f.insert(p.previewId)).code,'DIAGRAM_EMBED_SOURCE_CHANGED');
});
test('pause/resume during render cannot revive preview; drain waits for rendering work',async t=>{
 let release,entered;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r);const f=await fixture(t,{render:async()=>{entered();await wait;return {bytes:Buffer.from('<svg/>'),kind:'svg',rendererVersion:'fixture-only',styleHash:'a'.repeat(64)};}});
 const pending=f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(await Promise.race([ready.then(()=>true),pending.then(()=>false)]),true);assert.equal(f.service.isIdle(),false);
 f.owner.pause('lock');f.owner.resume();let drained=false;const drain=f.service.drain().then(()=>drained=true);await Promise.resolve();assert.equal(drained,false);release();assert.equal((await pending).code,'ACCESS_REFUSED');await drain;assert.equal(f.service.isIdle(),true);
});
test('closed caller cannot use its preview in a new Docs window; mode save preserves visual',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(p.ok,true);assert.equal((await f.insert(p.previewId)).ok,true);
 const current=await f.projects.readProject(f.selected.project.id),block=JSON.parse(current.json).workpapers[0].blocks[1];
 const fixed=await f.call('setMode',{blockId:block.id,mode:'fixed',expectedDocumentVersion:documentVersion(current,'doc-a'),operationId:'fix-mode'});assert.equal(fixed.ok,true,JSON.stringify(fixed));
 assert.deepEqual(await f.call('setMode',{blockId:block.id,mode:'fixed',expectedDocumentVersion:documentVersion(current,'doc-a'),operationId:'fix-mode'}),fixed,'mode retry must acknowledge the same commit');
 const changed=JSON.parse((await f.projects.readProject(f.selected.project.id)).json).workpapers[0].blocks[1];assert.equal(changed.mode,'fixed');assert.deepEqual(changed.snapshot,block.snapshot);
 f.windows[1].destroy();await f.registry.openView({role:'docs',entityId:'doc-a'});assert.equal((await f.call('insert',{previewId:p.previewId,afterBlockId:null,caption:'Other',expectedDocumentVersion:fixed.version,operationId:'foreign-preview'},f.event(2))).code,'DIAGRAM_EMBED_PREVIEW_REFUSED');
});
test('manual update refreshes fixed visual without changing mode and retries the exact publication',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);let current=await f.projects.readProject(f.selected.project.id);const block=JSON.parse(current.json).workpapers[0].blocks[1];
 assert.equal((await f.call('setMode',{blockId:block.id,mode:'fixed',expectedDocumentVersion:documentVersion(current,'doc-a'),operationId:'first-fix'})).ok,true);current=await f.projects.readProject(f.selected.project.id);
 const metadata=JSON.parse(current.json);metadata.diagrams[0].source+='\n B-->C';metadata.diagrams[0].sirenNativeVersion=2;
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:'refresh-source'})).ok,true);current=await f.projects.readProject(f.selected.project.id);
 const request={blockId:block.id,expectedDocumentVersion:documentVersion(current,'doc-a'),operationId:'manual-update'},saved=await f.call('update',request);assert.equal(saved.ok,true,JSON.stringify(saved));assert.deepEqual(await f.call('update',request),saved);
 const updated=JSON.parse((await f.projects.readProject(f.selected.project.id)).json).workpapers[0].blocks[1];assert.equal(updated.mode,'fixed');assert.equal(updated.snapshot.sourceVersion,2);assert.notEqual(updated.snapshot.sourceHash,block.snapshot.sourceHash);
});
test('receipt is refused in a second live Docs window and duplicate diagram IDs are refused',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(p.ok,true);await f.registry.openView({role:'docs',entityId:'doc-a'});
 assert.equal((await f.call('insert',{previewId:p.previewId,afterBlockId:null,caption:'Foreign',expectedDocumentVersion:documentVersion(f.selected,'doc-a'),operationId:'other-window'},f.event(2))).code,'DIAGRAM_EMBED_PREVIEW_REFUSED');
 const metadata=JSON.parse(f.selected.json);metadata.diagrams.push({...metadata.diagrams[0]});assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.selected.sourceRefs,metadata,operationId:'duplicate-diagram'})).ok,true);
 assert.equal((await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]})).code,'DIAGRAM_EMBED_SOURCE_CHANGED');assert.equal((await f.call('listDiagrams',{})).code,'DIAGRAM_EMBED_SOURCE_CHANGED');
});
test('Lock during asset write drains the real write and prevents any document reference commit',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal(p.ok,true);const put=f.assets.put.bind(f.assets);let entered,release;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r);
 f.assets.put=async args=>{const ref=await put(args);entered();await wait;return ref;};
 const pending=f.insert(p.previewId);assert.equal(await Promise.race([ready.then(()=>true),pending.then(()=>false)]),true);f.service.pause();f.service.resume();let drained=false;const drain=f.service.drain().then(()=>drained=true);await Promise.resolve();assert.equal(drained,false);release();assert.equal((await pending).code,'ACCESS_REFUSED');await drain;assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('accessor-bearing selection is refused without executing caller code',async t=>{
 const f=await fixture(t);let ran=0;const nodeIds=[];Object.defineProperty(nodeIds,0,{enumerable:true,get(){ran++;return 'A';}});
 assert.equal((await f.call('preview',{diagramId:'flow-a',scope:'selection',nodeIds})).code,'REQUEST_REFUSED');assert.equal(ran,0);
});
test('Open source resolves the saved block under current document CAS and opens the actual same-project diagram',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);const current=await f.projects.readProject(f.selected.project.id),block=JSON.parse(current.json).workpapers[0].blocks[1];
 const request={blockId:block.id,expectedDocumentVersion:documentVersion(current,'doc-a')};assert.equal((await f.call('openSource',{...request,diagramId:'foreign'})).code,'REQUEST_REFUSED');
 const opened=await f.call('openSource',request);assert.equal(opened.ok,true,JSON.stringify(opened));assert.equal(opened.view.entityId,'flow-a');assert.equal(opened.view.projectId,f.selected.project.id);assert.equal(f.shows(),1);
});
test('Lock while opening source joins the new window destruction before returning a refusal',async t=>{
 const f=await fixture(t),p=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(p.previewId)).ok,true);const current=await f.projects.readProject(f.selected.project.id),block=JSON.parse(current.json).workpapers[0].blocks[1];let release,entered;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r),original=f.registry.openView.bind(f.registry);
 f.registry.openView=async req=>{const opened=await original(req);entered();await wait;return opened;};
 const pending=f.call('openSource',{blockId:block.id,expectedDocumentVersion:documentVersion(current,'doc-a')});assert.equal(await Promise.race([ready.then(()=>true),pending.then(()=>false)]),true);f.service.pause();release();assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(f.windows.at(-1).isDestroyed(),true);assert.equal(f.shows(),0);await f.service.drain();
});

test('readEmbed resolves retained source name when the original diagram is gone',async t=>{
 const f=await fixture(t),preview=await f.call('preview',{diagramId:'flow-a',scope:'whole',nodeIds:[]});assert.equal((await f.insert(preview.previewId)).ok,true);const state=await f.projects.readProject(f.selected.project.id),data=JSON.parse(state.json),block=data.workpapers[0].blocks[1];data.diagrams=[];
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:state.project.id,baseRevision:state.revision,sourceRefs:state.sourceRefs,metadata:data,operationId:'delete-original-for-name'})).ok,true);
 const current=await f.projects.readProject(state.project.id),read=await f.call('readEmbed',{blockId:block.id,expectedDocumentVersion:documentVersion(current,'doc-a')});assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.sourceName,'Saved flow');
});
