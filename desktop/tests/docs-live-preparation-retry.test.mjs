// Permanent regression from /root/fixture_retention_independent finite actual-module finding.
// Root adaptation changes only import locations and removes RED from test titles.
// Inert storage/render/window adapters; no native/durability claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {DocsDiagramRefresh} from '../src/windows/docs-diagram-refresh.mjs';
import {NativeDocsDiagrams} from '../src/windows/docs-diagrams.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {documentVersion,documentContentVersion} from '../src/windows/docs.mjs';
import {readDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';
import {formatSavedDocument} from '../src/documents/export.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const jsonhash=v=>hash(Buffer.from(JSON.stringify(v)));
const projectId='bcf40cd6-f96a-4afa-bf03-14da6ab2616e';

// Real scheduler, native preparation, coordinator capability/publication and
// saved-document formatter. Storage/render/window adapters are finite inert
// data, not actual filesystem durability or native SVG/window qualification.
function fixture({fault=true,selection=false}={}){
 let failAsset=fault,revision=2,prepares=0,assetCalls=0;
 const records=new Map(),published=[],notices=[],saveEvents=[];
 const put=({kind,bytes})=>{const ref={kind,bytes:bytes.length,sha256:hash(bytes)};records.set(kind+':'+ref.sha256,{ref,bytes:Buffer.from(bytes)});return ref;};
 const oldSource={id:'flow-a',source:'flowchart TD\n A-->B',sirenNativeVersion:1};
 const sourceAsset=put({kind:'diagram-source',bytes:Buffer.from(JSON.stringify(oldSource))});
 const visualAsset=put({kind:'svg',bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>Saved old visual Ș😀</text></svg>')});
 const live={id:'live-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:selection?'selection':'whole',nodeIds:selection?['A']:[],caption:'Review Ș😀',display:{height:320,fit:'contain'},snapshot:{sourceHash:sourceAsset.sha256,sourceVersion:1,sourceAsset,visualAsset,rendererVersion:'inert-review',styleHash:'a'.repeat(64)},status:'current',missingNodeIds:[]};
 const fixed={...structuredClone(live),id:'fixed-a',mode:'fixed'};
 const metadata={workpapers:[{id:'doc-a',title:'User context',blocks:[{id:'text-a',kind:'text',html:'<p>Keep draft context Ș😀</p>'},live,fixed],future:{keep:'exact'}}],diagrams:[{...oldSource,source:'flowchart TD\n A-->B\n B-->C',sirenNativeVersion:2}],diagramEmbedAssets:{schema:1,refs:[sourceAsset,visualAsset]}};
 const snapshot=()=>{const json=JSON.stringify(metadata);return {schema:1,project:{id:projectId,label:'Owned inert review',external:false},revision,json,sha256:hash(Buffer.from(json))};};
 const receipt=request=>({ok:true,domain:'docs',entityId:'doc-a',operationId:request.operationId,version:documentVersion(snapshot(),'doc-a'),sha256:jsonhash(metadata.workpapers[0]),projectRevision:revision,durability:'committed'});
 const registry={capture(){throw Error('No renderer invocation in this fixture');},isCurrent:()=>true,captureAdmissionGuard:()=>({isCurrent:()=>true}),eventFor:()=>({inertOwnedEvent:true}),caller(){}};
 const domains={read:async()=>({ok:false}),flush:async()=>({ok:false}),apply:async(kind,request)=>{assert.equal(kind,'docs');assert.equal(request.action,'rename');assert.equal(request.expectedVersion,documentVersion(snapshot(),'doc-a'));metadata.workpapers[0].title=request.payload.title;revision++;return receipt(request);},commitDiagramEmbed:async(token,scope)=>{assert.equal(scope.isCurrent(),true);const request=readDiagramEmbedPublication(token);assert.ok(request);assert.equal(request.expectedVersion,documentVersion(snapshot(),'doc-a'));const doc=metadata.workpapers[0],i=doc.blocks.findIndex(b=>b.id===request.block.id);assert.ok(i>=0);doc.blocks[i]=structuredClone(request.block);revision++;published.push(request);metadata.diagramEmbedAssets.refs=[...records.values()].map(r=>r.ref);return receipt(request);}};
 const owner=new WorkspaceCoordinator({registry,sources:()=>null,domains,access:()=>true,nativeDiagramRefreshAccess:()=>true});
 owner.observeDomainSaves(e=>saveEvents.push(e));
 const diagrams=new NativeDocsDiagrams({registry,owner,projects:{readProject:async()=>snapshot()},assets:{read:async r=>records.get(r.ref.kind+':'+r.ref.sha256)?.bytes,put:async r=>{assetCalls++;if(failAsset)throw Object.assign(Error('controlled temporary asset write failure'),{code:'EIO'});return put(r);}},snapshotFor:async()=>snapshot(),render:async()=>({bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>New visual</text></svg>'),kind:'svg',rendererVersion:'inert-review',styleHash:'b'.repeat(64)}),workingState:()=>true});
 const scheduler=new DocsDiagramRefresh({owner,diagrams:{listRefreshTargets:diagrams.listRefreshTargets.bind(diagrams),listRefreshSources:diagrams.listRefreshSources.bind(diagrams),prepareRefresh:async r=>{prepares++;return diagrams.prepareRefresh(r);}},workingState:{isBlocked:()=>false,onPending:r=>notices.push(r)}});
 const saved=()=>scheduler.onDiagramSaved({projectId,diagramId:'flow-a',sourceHash:jsonhash(metadata.diagrams[0]),sourceVersion:2,projectRevision:revision});
 const settle=async()=>{const result=await owner.invoke({role:'docs',projectId,windowId:'working-doc-window',entityIds:['doc-a']},{kind:'docs',method:'applyDocument',payload:{documentId:'doc-a',expectedVersion:documentVersion(snapshot(),'doc-a'),operationId:'user-doc-save',action:'rename',payload:{title:'User context saved after asset recovery'}}});assert.equal(result.ok,true,JSON.stringify(result));await scheduler.drain();assert.ok(saveEvents.some(e=>e.domain==='docs'&&e.originWindowId==='working-doc-window'),'Real coordinator must publish the intended authoritative Docs settlement event');};
 return {metadata,records,live,fixed,published,notices,saveEvents,snapshot,saved,settle,scheduler,diagrams,recover:()=>failAsset=false,counts:()=>({prepares,assetCalls}),close:async()=>{await scheduler.dispose();await diagrams.dispose();}};
}

test('Live asset preparation failure must retry after real coordinator Docs save settlement',async t=>{
 const f=fixture();t.after(()=>f.close());assert.equal(f.saved(),true);await f.scheduler.drain();assert.equal(f.notices.at(-1).reason,'EIO');assert.equal(f.published.length,0);assert.equal(f.counts().prepares,1);
 f.recover();await f.settle();
 assert.equal(f.metadata.workpapers[0].title,'User context saved after asset recovery');
 assert.equal(f.metadata.workpapers[0].blocks[1].snapshot.sourceVersion,2,'Recovered Live block must update on authoritative settlement; old visual should only be temporary');
});

test('duplicate saved-source receipt must not permanently swallow a failed preparation',async t=>{
 const f=fixture();t.after(()=>f.close());f.saved();await f.scheduler.drain();f.recover();assert.equal(f.saved(),true);await f.scheduler.drain();
 assert.equal(f.published.length,1,'Duplicate source receipt after transient preparation failure should retry rather than claim queued success with no work');
});

test('explicit rescan recovers the same failed source, preserves Fixed snapshot and user content',async t=>{
 const f=fixture();t.after(()=>f.close());f.saved();await f.scheduler.drain();f.recover();assert.equal(await f.scheduler.rescanProject(projectId),true);await f.scheduler.drain();
 assert.equal(f.published.length,1);assert.equal(f.metadata.workpapers[0].blocks[1].snapshot.sourceVersion,2);assert.deepEqual(f.metadata.workpapers[0].blocks[2],f.fixed);assert.equal(f.metadata.workpapers[0].blocks[0].html,'<p>Keep draft context Ș😀</p>');
});

test('healthy Live preparation publishes only Live; Fixed stays exact',async t=>{
 const f=fixture({fault:false});t.after(()=>f.close());f.saved();await f.scheduler.drain();assert.equal(f.published.length,1);assert.equal(f.metadata.workpapers[0].blocks[1].snapshot.sourceVersion,2);assert.deepEqual(f.metadata.workpapers[0].blocks[2],f.fixed);assert.equal(f.counts().prepares,1);
});

test('deleted selection publishes missing status and preserves last-good snapshots for offline export',async t=>{
 const f=fixture({fault:false,selection:true});t.after(()=>f.close());f.metadata.diagrams[0].source='flowchart TD\n B-->C';f.saved();await f.scheduler.drain();const block=f.metadata.workpapers[0].blocks[1];assert.equal(block.status,'missing');assert.deepEqual(block.missingNodeIds,['A']);assert.deepEqual(block.snapshot,f.live.snapshot);
 const doc=f.metadata.workpapers[0],records=[...f.records.values()];for(const format of ['html','markdown','json']){const output=formatSavedDocument({format,projectId,document:doc,version:documentVersion(f.snapshot(),'doc-a'),sha256:jsonhash(doc),projectRevision:f.snapshot().revision,exportedAt:'2026-10-12T00:00:00.000Z'},{diagramAssets:records});assert.ok(output.bytes.length>0);assert.equal(output.extension,{html:'html',markdown:'zip',json:'json'}[format]);if(format==='html'){assert.ok(output.bytes.includes(Buffer.from(f.live.snapshot.visualAsset.sha256)));assert.ok(output.bytes.includes(Buffer.from(records.find(r=>r.ref.kind==='svg').bytes.toString('base64'))));}}
});

test('saved Live/Fixed export never adopts changed source bytes; corruption is refused',async t=>{
 const f=fixture();t.after(()=>f.close());const doc=f.metadata.workpapers[0],records=[...f.records.values()],input={format:'json',projectId,document:doc,version:documentVersion(f.snapshot(),'doc-a'),sha256:jsonhash(doc),projectRevision:2,exportedAt:'2026-10-12T00:00:00.000Z'};
 const archive=JSON.parse(formatSavedDocument(input,{diagramAssets:records}).bytes);assert.deepEqual(archive.document,doc);assert.equal(archive.diagramAssets.find(r=>r.ref.kind==='diagram-source').base64,records.find(r=>r.ref.kind==='diagram-source').bytes.toString('base64'));assert.equal(JSON.parse(Buffer.from(archive.diagramAssets.find(r=>r.ref.kind==='diagram-source').base64,'base64')).sirenNativeVersion,1);
 assert.throws(()=>formatSavedDocument(input,{diagramAssets:records.map(r=>r.ref.kind==='svg'?{...r,bytes:Buffer.from('corrupt')}:r)}),{code:'DIAGRAM_EMBED_ASSET_CORRUPT'});
});

test('real draft conflict preserves exact local content and formatter exports exact saved baseline only',async()=>{
 const window={};vm.runInNewContext(await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8'),{window,structuredClone,crypto:webcrypto,TextEncoder});const document={id:'draft-a',title:'Saved baseline',blocks:[{id:'text-a',kind:'text',html:'<p>Saved Ș😀</p>'}],future:{preserve:'exact'}};
 const draft=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:documentContentVersion(projectId,document),sha256:jsonhash(document),projectRevision:1},bridge:{applyDocument:async()=>({ok:false,code:'DOCUMENT_CONFLICT'})}});const local={title:'Local draft',blocks:[{id:'text-a',kind:'text',html:'<p>Exact unsaved Ș😀</p>'}]};assert.equal(draft.setContent(local).ok,true);assert.equal((await draft.save()).ok,false);assert.deepEqual(draft.getContent(),local);assert.equal(draft.getStatus().dirty,true);assert.equal(draft.getStatus().fenced,true);
 const archive=JSON.parse(formatSavedDocument({format:'json',projectId,document,version:documentContentVersion(projectId,document),sha256:jsonhash(document),projectRevision:1,exportedAt:'2026-10-12T00:00:00.000Z'}).bytes);assert.deepEqual(archive.document,document);assert.deepEqual(draft.getContent(),local);
});


test('healthy duplicate saved receipt stays coalesced after successful Live publication',async t=>{
 const f=fixture({fault:false});t.after(()=>f.close());f.saved();await f.scheduler.drain();assert.equal(f.published.length,1);assert.equal(f.counts().prepares,1);
 f.saved();await f.scheduler.drain();assert.equal(f.published.length,1);assert.equal(f.counts().prepares,1);
});

test('failed preparation waits for a matching external trigger without spinning or unrelated settlement',async t=>{
 const f=fixture();t.after(()=>f.close());f.saved();await f.scheduler.drain();assert.equal(f.counts().prepares,1);
 for(let n=0;n<3;n++)await new Promise(r=>setImmediate(r));assert.equal(f.counts().prepares,1);
 f.recover();f.scheduler.onDocumentSettled({projectId,documentId:'unrelated-doc'});f.scheduler.onDocumentSettled({projectId:'unrelated-project',documentId:'doc-a'});await f.scheduler.drain();assert.equal(f.counts().prepares,1);assert.equal(f.published.length,0);
 await f.settle();assert.equal(f.counts().prepares,2);assert.equal(f.published.length,1);
});

test('retiring the scheduler drops failed retry eligibility without a late publication',async t=>{
 const f=fixture();t.after(()=>f.close());f.saved();await f.scheduler.drain();f.recover();await f.scheduler.pause();f.scheduler.resume();f.scheduler.onDocumentSettled({projectId,documentId:'doc-a'});await f.scheduler.drain();assert.equal(f.counts().prepares,1);assert.equal(f.published.length,0);
});
