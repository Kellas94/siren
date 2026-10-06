import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {documentVersion} from '../src/windows/docs.mjs';
import {workspaceMetadata} from '../src/windows/entities.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {EventEmitter} from 'node:events';
import {NativeViewControl} from '../src/windows/control.mjs';
import {NativeWorkspaceBarrier} from '../src/windows/source-barrier.mjs';
const module=await import('../src/windows/domain.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('scoped domain repository and strict intent validator exist',()=>{assert.equal(typeof module.DomainRepository,'function');assert.equal(typeof module.normalizeDomainIntent,'function');});
test('Docs body and finite context commit once with exact opaque metadata and same-project reference admission',async()=>{
 const f=await fixture({wrapped:true}),before=workspaceMetadata(f.snapshot),doc=before.workpapers[0],context={type:'agent-spec',owner:'New owner',agent:{agentId:'AG-42',platform:'Python',oversight:{mode:'always'}},references:{add:[{kind:'diagram',id:'diagram-a'}]}};
 const request={...f.docs(),action:'replace-context-content',payload:{title:'Combined context',blocks:[...doc.blocks,{id:'new-block',kind:'heading',text:'Context matters',level:2}],context}};
 const result=await f.repo.apply('docs',request,f.scope);assert.equal(result.ok,true,JSON.stringify(result));
 const saved=await f.projects.readProject(f.projectId),expected=structuredClone(before);expected.workpapers[0]={...doc,title:request.payload.title,blocks:request.payload.blocks,type:'agent-spec',owner:'New owner',agent:{...doc.agent,agentId:'AG-42',platform:'Python',oversight:{...(doc.agent?.oversight??{}),mode:'always'}},links:[...(doc.links??[]),{kind:'diagram',diagramId:'diagram-a',nodeId:'',label:'',dangling:false}]};
 assert.deepEqual(workspaceMetadata(saved),expected);assert.deepEqual(saved.sourceRefs,f.snapshot.sourceRefs);assert.equal(saved.revision,f.snapshot.revision+1);assert.deepEqual(await f.repo.apply('docs',request,f.scope),result);
 assert.equal((await f.repo.apply('docs',{...request,operationId:'stale-context'},f.scope)).code,'DOCUMENT_CONFLICT');
 const next={...request,operationId:'foreign-reference',expectedVersion:documentVersion(saved,'doc-a'),payload:{...request.payload,context:{references:{add:[{kind:'document',id:'foreign-doc'}]}}}};
 assert.equal((await f.repo.apply('docs',next,f.scope)).code,'REFERENCE_TARGET_REFUSED');assert.deepEqual(await f.projects.readProject(f.projectId),saved);
 assert.throws(()=>module.normalizeDomainIntent('docs',{...request,payload:{...request.payload,context:{status:'approved'}}}),/REQUEST_REFUSED/);
});
const check=(name,fn)=>test(name,async t=>{assert.equal(typeof module.DomainRepository,'function');await fn(t);});
test('typed presentation/source/style transaction persists once and rejects stale or ambiguous edits without replacing project context',async()=>{const f=await fixture({wrapped:true}),before=workspaceMetadata(f.snapshot),request={...f.diagram(),action:'replace-deck-content',payload:{source:'flowchart TD\nA-->C',fontFamily:'Georgia',presentationEdits:[{action:'add',id:'text-a',kind:'text'},{action:'update',id:'text-a',changes:{body:'Literal <script> 😀',note:'PRIVATE_NOTE'}}]}};const result=await f.repo.apply('diagram',request,f.scope);assert.equal(result.ok,true,JSON.stringify(result));const saved=await f.projects.readProject(f.projectId),after=workspaceMetadata(saved);assert.equal(saved.revision,f.snapshot.revision+1);assert.equal(after.diagrams[0].source,request.payload.source);assert.equal(after.diagrams[0].presentation.sequence[0].card.html,'<p>Literal &lt;script&gt; 😀</p>');assert.equal(after.diagrams[0].presentation.notes['card:text-a'].text,'PRIVATE_NOTE');assert.deepEqual(after.diagrams[0].future,before.diagrams[0].future);assert.deepEqual(after.diagrams[1],before.diagrams[1]);assert.deepEqual(after.workpapers,before.workpapers);assert.deepEqual(saved.sourceRefs,f.snapshot.sourceRefs);assert.deepEqual(await f.repo.apply('diagram',request,f.scope),result);assert.equal((await f.repo.apply('diagram',{...request,operationId:'stale-deck'},f.scope)).code,'REVISION_CONFLICT');assert.deepEqual(await f.projects.readProject(f.projectId),saved);});
async function fixture({wrapped=false,recovery}={}) {
 const root=await mkdtemp(join(tmpdir(),'siren-domains-')),projects=new ProjectStore(root),sources=new SourceRepository(root),initial=await projects.createProject({label:'Native domain fixture',json:'{}'}),projectId=initial.project.id;
 const ref=await sources.importSource({projectId,bytes:Buffer.from('print("😀")\r\n')}),point={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
 const workspace={diagrams:[{id:'diagram-a',name:'A',source:'flowchart TD\nA-->B',nodeStyles:{A:{fill:'#ff0000'}},future:{keep:true}},{id:'diagram-b',name:'B',source:'sequenceDiagram\nA->>B: old'}],workpapers:['doc-a','doc-b'].map(id=>({id,title:id,agent:{id:'agent-original'},releases:[{id:'release-original',verdict:'not-run'}],blocks:[{kind:'knowledge',rows:[{id:'row-a',sourceRef:point}]}]}))};
 const metadata=wrapped?{kind:'siren-desktop',storage:{'t-industries-siren-v23-state':JSON.stringify(workspace),unrelated:'EXACT'}}:workspace;
 assert.equal((await commitManifest({projects,repository:sources,projectId,baseRevision:1,sourceRefs:[ref],metadata,operationId:'initial-domains'})).ok,true);
 const snapshot=await projects.readProject(projectId);let current=true,fault=async()=>{},validate=async()=>true;
 const scope={projectId,isCurrent:()=>current};
 const repo=new module.DomainRepository({projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite,fault:p=>fault(p)}),sources:({canWrite})=>new SourceRepository(root,{canWrite}),recovery,validatePatch:(...args)=>validate(...args)});
 const diagram=(id='diagram-a',operationId='diagram-edit',source='flowchart TD\nA-->C')=>({operationId,diagramId:id,expectedVersion:1,action:'replace-source',payload:{source}});
 const docs=(id='doc-a',operationId='docs-edit',title='Edited')=>({operationId,documentId:id,expectedVersion:documentVersion(snapshot,id),action:'rename',payload:{title}});
 return {root,projects,sources,ref,snapshot,projectId,scope,repo,diagram,docs,setCurrent:v=>current=v,setFault:v=>fault=v,setValidate:v=>validate=v};
}
check('different diagrams and Docs from one original revision preserve every unrelated field and source ref',async()=>{
 const f=await fixture({wrapped:true}),before=workspaceMetadata(f.snapshot);
 const a=await f.repo.apply('diagram',f.diagram(),f.scope),b=await f.repo.apply('diagram',f.diagram('diagram-b','edit-b','sequenceDiagram\nA->>B: hello'),f.scope),doc=await f.repo.apply('docs',f.docs(),f.scope);
 assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(doc.ok,true);
 const reopened=await new ProjectStore(f.root).readProject(f.projectId),actual=workspaceMetadata(reopened);
 assert.equal(actual.diagrams[0].source,'flowchart TD\nA-->C');assert.equal(actual.diagrams[1].source,'sequenceDiagram\nA->>B: hello');assert.equal(actual.workpapers[0].title,'Edited');
 assert.deepEqual(actual.workpapers[1],before.workpapers[1]);assert.deepEqual(actual.workpapers[0].agent,before.workpapers[0].agent);assert.deepEqual(actual.workpapers[0].releases,before.workpapers[0].releases);
 assert.deepEqual(actual.diagrams[0].nodeStyles,before.diagrams[0].nodeStyles);assert.deepEqual(actual.diagrams[0].future,before.diagrams[0].future);assert.deepEqual(reopened.sourceRefs,f.snapshot.sourceRefs);assert.equal(JSON.parse(reopened.json).storage.unrelated,'EXACT');
});
check('same entity conflicts retain the selected version; duplicates return actual selected historical receipts',async()=>{
 const f=await fixture(),request=f.diagram(),first=await f.repo.apply('diagram',request,f.scope);assert.equal(first.ok,true);assert.equal(first.version,2);
 assert.equal((await f.repo.apply('diagram',f.diagram('diagram-a','stale','wrong'),f.scope)).code,'REVISION_CONFLICT');
 await f.repo.apply('docs',f.docs(),f.scope);assert.deepEqual(await f.repo.apply('diagram',request,f.scope),first);
 assert.equal((await f.repo.apply('diagram',{...request,payload:{source:'different'}},f.scope)).code,'OPERATION_CONFLICT');
 assert.equal((await f.repo.apply('docs',f.docs('doc-a','stale-doc','bad'),f.scope)).code,'DOCUMENT_CONFLICT');
});
check('native validation refuses rather than silently normalizing or replacing imported colors',async()=>{
 const f=await fixture();f.setValidate(async()=>false);
 const result=await f.repo.apply('diagram',{...f.diagram(),action:'update-style',payload:{nodeStyles:{A:{fill:'url(https://unsafe.example)'}}}},f.scope);
 assert.equal(result.code,'DOMAIN_VALIDATION_FAILED');assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});
check('one Diagram source/style transaction commits once, preserves all other metadata and refuses stale/unknown fields',async()=>{
 const f=await fixture({wrapped:true}),before=workspaceMetadata(f.snapshot),payload={source:'flowchart TD\r\nA-->C\r\nstyle A fill:#ff3366',fontFamily:'Georgia',fontSize:18,nodeStyles:{...before.diagrams[0].nodeStyles,C:{fill:'#2277cc'}}};
 const request={...f.diagram(),action:'replace-content',payload};
 assert.throws(()=>module.normalizeDomainIntent('diagram',{...request,payload:{...payload,path:'C:/outside'}}),/REQUEST_REFUSED/);
 const result=await f.repo.apply('diagram',request,f.scope);assert.equal(result.ok,true,JSON.stringify(result));
 const saved=await f.projects.readProject(f.projectId),expected=structuredClone(before);Object.assign(expected.diagrams[0],payload,{sirenNativeVersion:2});
 assert.deepEqual(workspaceMetadata(saved),expected);assert.deepEqual(saved.sourceRefs,f.snapshot.sourceRefs);assert.equal(saved.revision,f.snapshot.revision+1);assert.deepEqual(await f.repo.apply('diagram',request,f.scope),result);
 assert.equal((await f.repo.apply('diagram',{...request,operationId:'stale-combined'},f.scope)).code,'REVISION_CONFLICT');assert.deepEqual(await f.projects.readProject(f.projectId),saved);
});
check('Docs replacement preserves linked source pointers, release provenance and exact independently expected content',async()=>{
 const f=await fixture(),before=workspaceMetadata(f.snapshot),blocks=[{kind:'text',text:'Exact 😀 documentation\r\n'},...before.workpapers[0].blocks];
 const result=await f.repo.apply('docs',{...f.docs(),action:'replace-blocks',payload:{blocks}},f.scope);assert.equal(result.ok,true);
 const current=await f.projects.readProject(f.projectId);assert.deepEqual(workspaceMetadata(current).workpapers[0],{...before.workpapers[0],blocks});assert.equal(result.version,documentVersion(current,'doc-a'));assert.deepEqual(current.sourceRefs,f.snapshot.sourceRefs);
});

check('one Docs content transaction changes title and blocks atomically while retaining agent/releases/other entities',async()=>{
 const f=await fixture({wrapped:true}),before=workspaceMetadata(f.snapshot),blocks=[{id:'new-heading',kind:'heading',level:2,text:'Exact 😀 heading'},...before.workpapers[0].blocks];
 const request={...f.docs(),action:'replace-content',payload:{title:'One atomic title',blocks}};
 const result=await f.repo.apply('docs',request,f.scope);assert.equal(result.ok,true,JSON.stringify(result));
 const current=await f.projects.readProject(f.projectId),expected=structuredClone(before);expected.workpapers[0].title='One atomic title';expected.workpapers[0].blocks=blocks;
 assert.deepEqual(workspaceMetadata(current),expected);assert.deepEqual(current.sourceRefs,f.snapshot.sourceRefs);assert.equal(current.revision,f.snapshot.revision+1);
 assert.deepEqual(await f.repo.apply('docs',request,f.scope),result);
 assert.equal((await f.repo.apply('docs',{...request,operationId:'stale-content'},f.scope)).code,'DOCUMENT_CONFLICT');
 assert.deepEqual(await f.projects.readProject(f.projectId),current);
});
check('getters, prototype authority, unknown fields, oversize and sparse blocks are refused before user code executes',async()=>{
 const f=await fixture();let evaluated=false;const request=f.diagram();Object.defineProperty(request.payload,'source',{get:()=>{evaluated=true;return 'x';},enumerable:true});
 assert.equal((await f.repo.apply('diagram',request,f.scope)).code,'REQUEST_REFUSED');assert.equal(evaluated,false);
 for(const input of [{...f.docs(),path:'C:/outside'},{...f.diagram(),payload:{source:'x'.repeat(2*1024*1024)}},{...f.docs(),action:'replace-blocks',payload:{blocks:new Array(2)}}])assert.equal((await f.repo.apply(input.diagramId?'diagram':'docs',input,f.scope)).ok,false);
 assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});
check('revocation during validation or native selection cannot publish an edited document or successful receipt',async()=>{
 for(const phase of ['validate','select']) {
  const f=await fixture();if(phase==='validate')f.setValidate(async()=>{f.setCurrent(false);return true;});else f.setFault(async p=>{if(p==='before-select')f.setCurrent(false);});
  const result=await f.repo.apply('docs',{...f.docs(),action:'replace-blocks',payload:{blocks:[{kind:'text',text:'retained private draft'}]}},f.scope);
  assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
 }
});
check('read and flush verify the current entity version and never claim an old version is the latest',async()=>{
 const f=await fixture(),read=await f.repo.read('diagram',{entityId:'diagram-a'},f.scope);assert.equal(read.ok,true);assert.equal(read.version,1);assert.equal(read.entity.source,'flowchart TD\nA-->B');
 const saved=await f.repo.apply('diagram',f.diagram(),f.scope);assert.equal((await f.repo.flush('diagram',{entityId:'diagram-a',expectedVersion:1},f.scope)).code,'REVISION_CONFLICT');
 const flushed=await f.repo.flush('diagram',{entityId:'diagram-a',expectedVersion:2},f.scope);assert.equal(flushed.ok,true);assert.equal(flushed.sha256,saved.sha256);assert.equal(Object.hasOwn(flushed,'entity'),false);
 const current=await f.projects.readProject(f.projectId);assert.equal(current.revision,saved.projectRevision);
});
check('checkpoint failure returns recovery-degraded instead of a false committed acknowledgement',async()=>{
 const f=await fixture({recovery:{checkpointProject:async()=>{throw Error('unavailable');},hasCheckpoint:async()=>false}});
 const saved=await f.repo.apply('diagram',f.diagram(),f.scope);assert.equal(saved.ok,true);assert.equal(saved.durability,'recovery-degraded');
 const flushed=await f.repo.flush('diagram',{entityId:'diagram-a',expectedVersion:2},f.scope);assert.equal(flushed.durability,'recovery-degraded');
});
async function owner(f,{domain=f.repo,role='docs',entities=['doc-a','doc-b']}={}) {
 const windows=[],policy={projectId:f.projectId,mode:'normal',access:'write',entityIds:['doc-a','doc-b','diagram-a','diagram-b',f.ref.sourceId]};
 const registry=new WindowRegistry({authorize:()=>policy,createWindow:async options=>{const w=new EventEmitter();w.id=windows.length+1;w.destroyed=false;w.isDestroyed=()=>w.destroyed;w.isMinimized=()=>false;w.restore=()=>{};w.focus=()=>{};w.close=()=>w.destroy();w.destroy=()=>{w.destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.webContents=new EventEmitter();Object.assign(w.webContents,{id:w.id+100,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:()=>w.destroyed});windows.push(w);return w;}});
 for(const entityId of entities)await registry.openView({role,entityId});
 const grants=windows.map(w=>registry.capture({sender:w.webContents,senderFrame:w.webContents.mainFrame}));
 const coordinator=new WorkspaceCoordinator({registry,sources:({canWrite})=>new SourceRepository(f.root,{canWrite}),domains:domain,access:(_g,scope)=>policy.mode==='normal'||scope.action.startsWith('read')});
 return {windows,registry,grants,coordinator,policy};
}
check('one native owner serializes document edits and finite flushes preserve both independent changes',async()=>{
 const f=await fixture(),o=await owner(f),intents=['doc-a','doc-b'].map((id,i)=>({kind:'docs',method:'applyDocument',payload:f.docs(id,'owner-'+i,'Title '+i)}));
 const results=await Promise.all(intents.map((intent,i)=>o.coordinator.invoke(o.grants[i],intent)));assert.equal(results.every(r=>r.ok),true);
 const current=await f.projects.readProject(f.projectId);assert.deepEqual(workspaceMetadata(current).workpapers.map(d=>d.title),['Title 0','Title 1']);
 o.coordinator.pause('lock');const nonce=o.coordinator.beginViewFlush(o.grants[0]);
 assert.equal((await o.coordinator.invoke(o.grants[1],{kind:'docs',method:'flushDocument',payload:{entityId:'doc-b',expectedVersion:documentVersion(current,'doc-b')}},nonce)).code,'FLUSH_REFUSED');
 const saved=await o.coordinator.invoke(o.grants[0],{kind:'docs',method:'flushDocument',payload:{entityId:'doc-a',expectedVersion:documentVersion(current,'doc-a')}},nonce);assert.equal(saved.ok,true);assert.equal((await o.coordinator.finishViewFlush(o.grants[0],nonce)).ok,true);
});
check('native role/entity/access and result projection refuse cross-document or fabricated persistence',async()=>{
 const f=await fixture(),o=await owner(f),intent={kind:'docs',method:'applyDocument',payload:f.docs('doc-b')};assert.equal((await o.coordinator.invoke(o.grants[0],intent)).code,'ACCESS_REFUSED');
 o.policy.mode='readonly';o.policy.access='read';assert.equal((await o.coordinator.invoke(o.grants[1],intent)).code,'ACCESS_REFUSED');
 const fake=await owner(f,{domain:{read:async()=>({ok:true,entity:{id:'doc-a',text:'leak'},path:'outside'}),apply:async()=>({ok:true,entityId:'doc-a',durability:'committed',extra:'leak'}),flush:async()=>({ok:true})}});
 assert.equal((await fake.coordinator.invoke(fake.grants[0],{kind:'docs',method:'applyDocument',payload:f.docs()})).code,'DOMAIN_RESULT_REFUSED');assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});
check('complete Docs roster uses native seals and latest document tokens before prepared authority',async()=>{
 const f=await fixture(),o=await owner(f);let control;
 control=new NativeViewControl({registry:o.registry,owner:o.coordinator,send:(event,request)=>{void(async()=>{const g=o.registry.capture(event),id=g.entityIds[0],current=await f.projects.readProject(f.projectId);const result=await o.coordinator.invoke(g,{kind:'docs',method:'flushDocument',payload:{entityId:id,expectedVersion:documentVersion(current,id)}},request.nonce);await control.acknowledge(event,{requestId:request.requestId,ok:result.ok});})();}});
 const barrier=new NativeWorkspaceBarrier({registry:o.registry,owner:o.coordinator,control,cover:()=>{}});
 const prepared=await barrier.prepare('lock');assert.equal(prepared.ok,true);assert.equal(prepared.proof.refs.length,2);assert.equal(barrier.isPrepared(prepared.proof),true);assert.equal(barrier.isPrepared({...prepared.proof}),false);assert.equal(barrier.release(prepared.proof),true);control.dispose();barrier.dispose();
});
check('a missing document flush or a changed document is not established by earlier domain commits',async()=>{
 const f=await fixture(),o=await owner(f),saved=await o.coordinator.invoke(o.grants[0],{kind:'docs',method:'applyDocument',payload:f.docs()});
 o.coordinator.pause('quit');assert.equal((await o.coordinator.reconcileWorkspaceReceipts(o.grants,[saved],()=>true)).code,'DOMAIN_NOT_FLUSHED');
 const current=await f.projects.readProject(f.projectId),old=await f.repo.flush('docs',{entityId:'doc-a',expectedVersion:documentVersion(current,'doc-a')},f.scope);
 const changed=await f.repo.apply('docs',{...f.docs('doc-a','later-change','Changed'),expectedVersion:old.version},f.scope);assert.equal(changed.ok,true);
 const result=await o.coordinator.reconcileWorkspaceReceipts([o.grants[0]],[old],()=>true);assert.equal(result.code,'DOMAIN_VERSION_CHANGED');
});
check('read result digest must describe the exact entity delivered to the renderer',async()=>{
 const f=await fixture(),read=await f.repo.read('diagram',{entityId:'diagram-a'},f.scope),request={entityId:'diagram-a'};
 assert.equal(module.projectDomainResult('diagram','readDiagram',read,request).ok,true);
 assert.equal(module.projectDomainResult('diagram','readDiagram',{...read,entity:{...read.entity,source:'fabricated'}},request).code,'DOMAIN_RESULT_REFUSED');
});

check('a clean preparing peer may seal one exact conflict/read/flush recapture after the other native Diagram saves',async()=>{
 const f=await fixture(),o=await owner(f,{role:'diagram',entities:['diagram-a','diagram-a']});o.coordinator.pause('native-close');
 const a=o.coordinator.beginViewFlush(o.grants[0]),b=o.coordinator.beginViewFlush(o.grants[1]);
 const invoke=(i,method,payload,nonce)=>o.coordinator.invoke(o.grants[i],{kind:'diagram',method,payload},nonce);
 const before=await invoke(1,'readDiagram',{entityId:'diagram-a'},b);assert.equal(before.version,1);
 assert.equal((await invoke(0,'applyDiagram',f.diagram(),a)).ok,true);
 assert.equal((await invoke(1,'flushDiagram',{entityId:'diagram-a',expectedVersion:before.version},b)).code,'REVISION_CONFLICT');
 const latest=await invoke(1,'readDiagram',{entityId:'diagram-a'},b);assert.equal(latest.version,2);
 const flushed=await invoke(1,'flushDiagram',{entityId:'diagram-a',expectedVersion:latest.version},b);assert.equal(flushed.ok,true);assert.equal(flushed.sha256,latest.sha256);
 const sealed=await o.coordinator.finishViewFlush(o.grants[1],b);assert.equal(sealed.ok,true,JSON.stringify(sealed));assert.equal(sealed.receipts.every(r=>r.ok===true),true);assert.equal(sealed.receipts.at(-1).sha256,latest.sha256);
 assert.equal((await invoke(0,'flushDiagram',{entityId:'diagram-a',expectedVersion:2},a)).ok,true);assert.equal((await o.coordinator.finishViewFlush(o.grants[0],a)).ok,true);
 assert.equal((await o.coordinator.reconcileWorkspaceReceipts(o.grants,sealed.receipts,()=>true)).ok,true);
});
check('failed mutations and unverified or repeated flush conflicts cannot be hidden by a later successful native receipt',async()=>{
 for(const scenario of ['mutation','no-read','repeated','wrong-read']){
  const f=await fixture(),o=await owner(f,{role:'diagram',entities:['diagram-a']}),saved=await f.repo.apply('diagram',f.diagram(),f.scope);assert.equal(saved.ok,true);o.coordinator.pause('native-close');const nonce=o.coordinator.beginViewFlush(o.grants[0]);
  const invoke=(method,payload)=>o.coordinator.invoke(o.grants[0],{kind:'diagram',method,payload},nonce);
  const method=scenario==='mutation'?'applyDiagram':'flushDiagram',payload=scenario==='mutation'?{...f.diagram(),operationId:'stale-local',payload:{source:'DO NOT OVERWRITE'}}:{entityId:'diagram-a',expectedVersion:1};
  assert.equal((await invoke(method,payload)).code,'REVISION_CONFLICT');
  if(scenario==='repeated')assert.equal((await invoke('flushDiagram',payload)).code,'REVISION_CONFLICT');
  if(scenario!=='no-read')assert.equal((await invoke('readDiagram',{entityId:scenario==='wrong-read'?'diagram-b':'diagram-a'})).ok,scenario!=='wrong-read');
  assert.equal((await invoke('flushDiagram',{entityId:'diagram-a',expectedVersion:2})).ok,true);
  assert.equal((await o.coordinator.finishViewFlush(o.grants[0],nonce)).code,'FLUSH_FAILED',scenario);assert.equal(workspaceMetadata(await f.projects.readProject(f.projectId)).diagrams[0].source,'flowchart TD\nA-->C');
 }
});
check('the same bounded clean recapture binds Docs to the full saved document hash, not its old token',async()=>{
 const f=await fixture(),o=await owner(f,{entities:['doc-a','doc-a']});o.coordinator.pause('native-close');const a=o.coordinator.beginViewFlush(o.grants[0]),b=o.coordinator.beginViewFlush(o.grants[1]);
 const invoke=(i,method,payload,nonce)=>o.coordinator.invoke(o.grants[i],{kind:'docs',method,payload},nonce);
 const before=await invoke(1,'readDocument',{entityId:'doc-a'},b);assert.equal((await invoke(0,'applyDocument',f.docs(),a)).ok,true);
 assert.equal((await invoke(1,'flushDocument',{entityId:'doc-a',expectedVersion:before.version},b)).code,'DOCUMENT_CONFLICT');
 const latest=await invoke(1,'readDocument',{entityId:'doc-a'},b),flushed=await invoke(1,'flushDocument',{entityId:'doc-a',expectedVersion:latest.version},b);assert.equal(flushed.sha256,latest.sha256);assert.notEqual(latest.version,before.version);
 const sealed=await o.coordinator.finishViewFlush(o.grants[1],b);assert.equal(sealed.ok,true);assert.equal(sealed.receipts.at(-1).sha256,latest.sha256);o.coordinator.cancelViewFlush(o.grants[0],a);
});
