import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {NativeWorkingSources} from '../src/windows/working-sources.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
const module=await import('../src/navigation/window-labels.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const reference={sourceId:'agent-source',version:2,sha256:'a'.repeat(64)};
const snapshot={schema:2,revision:12,project:{id:'selected'},sourceRefs:[{...reference,provenance:{kind:'standalone',fileName:'agent Ș😀.py'}}],json:JSON.stringify({workpapers:[{id:'doc-a',title:'Audit Ș😀',content:'PRIVATE_DOC_BODY'}],diagrams:[{id:'diagram-a',name:'Agent flow',version:4,source:'PRIVATE_DIAGRAM_BODY'}],releases:[{name:'PRIVATE_RELEASE'}]})};
const view=(role,entityId,id=role)=>({windowId:id,projectId:'selected',role,entityId,state:'active'});

test('native shelf titles are literal bounded metadata with an exact role prefix and Unicode safety',()=>{
 const label=module.surfaceWindowLabel;assert.equal(typeof label,'function');
 assert.equal(label('code','SIREN — ⌘ Code — agent.py · v2 · Working copy · Unsaved','source'),'⌘ Code · agent.py · v2 · Working copy · Unsaved');
 assert.equal(label('docs','SIREN — ⌘ Code — OTHER_PRIVATE','doc-owned'),'Docs · doc-owne');
 assert.equal(label('audience','PRIVATE_SLIDE','slide'),null);
 const unsafe=label('diagram','SIREN — Diagrams — <img onerror=bad>\n\u202e'+'😀'.repeat(200),'own');
 assert.ok(unsafe.length<=256);assert.equal(unsafe.isWellFormed(),true);assert.doesNotMatch(unsafe,/[\n\u202e]/);assert.match(unsafe,/<img onerror=bad>/);
 const long=label('code','SIREN — ⌘ Code — '+'x'.repeat(120)+' · v9007199254740991 · Working copy · Unsaved','own');
 assert.match(long,/ · v9007199254740991 · Working copy · Unsaved$/);assert.ok(long.length<=256);
});

test('Home distinguishes real registered Code, Docs, diagram and presentation names from generic roles',()=>{
 assert.equal(typeof module.homeWindowSummaries,'function');
 const result=module.homeWindowSummaries(snapshot,[view('code','agent-source'),view('docs','doc-a'),view('diagram','diagram-a'),view('presenter','diagram-a'),view('audience','diagram-a')],()=>reference);
 assert.deepEqual(result.map(row=>row.label),['⌘ Code · agent Ș😀.py · v2','Docs · Audit Ș😀 · project r12','Diagrams · Agent flow · v4','Presenter · Agent flow','Audience · Agent flow']);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 assert.deepEqual(Object.keys(result[0]).sort(),['entityId','label','role','state','windowId']);
});
test('Code windows label their own exact admitted version and cannot borrow another hash or document name',()=>{
 assert.equal(typeof module.homeWindowSummaries,'function');
 const older={...reference,version:1,provenance:{kind:'standalone',fileName:'older.py'}};
 const selected={...snapshot,sourceRefs:[older,...snapshot.sourceRefs]};
 const rows=module.homeWindowSummaries(selected,[view('code','agent-source','older'),view('code','agent-source','current'),view('code','agent-source','wrong')],row=>row.windowId==='older'?older:row.windowId==='wrong'?{...reference,sha256:'b'.repeat(64)}:reference);
 assert.equal(rows[0].label,'⌘ Code · older.py · v1');assert.equal(rows[1].label,'⌘ Code · agent Ș😀.py · v2');assert.equal(rows[2].label,'⌘ Code · agent-so');
});
test('a genuinely admitted unsaved working source retains its selected filename and current version on Home',async t=>{
 const f=await sourceReadFixture(),source=f.refs[0];
 const point={sourceId:source.sourceId,version:source.version,sha256:source.sha256};
 assert.equal((await commitManifest({projects:f.projects,repository:f.sources,projectId:f.selected.project.id,baseRevision:f.selected.revision,sourceRefs:f.refs,metadata:{codeFiles:[{id:'file-a',name:'agent Ș😀.py',sourceRef:point}],workpapers:[{id:'doc-a',content:'PRIVATE_BODY'}]},operationId:'named-working-source'})).ok,true);
 const selected=await f.projects.readProject(f.selected.project.id);
 const owner=new WorkspaceCoordinator({registry:f.registry,access:()=>f.isUnlocked(),sources:({canWrite})=>new SourceRepository(f.root,{canWrite})});
 const working=new NativeWorkingSources({registry:f.registry,owner,enabled:()=>f.isUnlocked(),snapshotFor:()=>selected});t.after(()=>working.dispose());
 const grant=f.registry.capture(f.event(0));assert.equal((await working.admit(grant)).ok,true);
 await f.registry.openView({role:'code',entityId:source.sourceId,version:1});
 const receipt=await owner.invoke(grant,{kind:'source',method:'applyEdit',payload:{sourceId:source.sourceId,expectedVersion:1,operationId:'unsaved-name-proof',start:0,end:1,insertedText:'X'}});assert.equal(receipt.ok,true);
 const original=structuredClone(selected),roster=f.registry.listViews(),plain={sourceId:source.sourceId,version:2,sha256:receipt.sha256};
 const rows=module.homeWindowSummaries(selected,roster,row=>{
  const window=f.windows.find(window=>f.registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame})?.windowId===row.windowId);
  const captured=window&&f.registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
  return working.isWorking(captured)?{reference:working.referenceFor(captured),working:true}:source;
 });
 assert.equal(rows.find(row=>row.windowId===grant.windowId).label,'⌘ Code · agent Ș😀.py · v2');
 assert.equal(rows.find(row=>row.role==='code'&&row.windowId!==grant.windowId).label,'⌘ Code · agent Ș😀.py · v1');
 assert.deepEqual(await f.projects.readProject(selected.project.id),original);
 assert.equal(selected.sourceRefs.some(ref=>ref.version===2&&ref.sha256===receipt.sha256),false);
 assert.equal(JSON.stringify(rows).includes('PRIVATE_BODY'),false);assert.equal(JSON.stringify(rows).includes(receipt.sha256),false);
 assert.equal(module.homeWindowSummaries(selected,[roster.find(row=>row.windowId===grant.windowId)],()=>plain)[0].label,'⌘ Code · '+source.sourceId.slice(0,8),'Unadmitted references remain refused');
 assert.equal(working.referenceFor({...grant}),null);f.lock();assert.equal(working.referenceFor(grant),null);
});
test('working label admission cannot name an unselected source or supply malformed version metadata',()=>{
 const working={...reference,version:3,sha256:'b'.repeat(64)};
 const samples=[working,{reference:working,working:false},{reference:{...working,version:0},working:true},{reference:{...working,sourceId:'unselected'},working:true},{reference:{...reference,sha256:'b'.repeat(64)},working:true}];
 for(const sample of samples)assert.equal(module.homeWindowSummaries(snapshot,[view('code','agent-source')],()=>sample)[0].label,'⌘ Code · agent-so');
});
test('Home omits other-project, primary and unknown windows and bounds the shelf without requesting their sources',()=>{
 assert.equal(typeof module.homeWindowSummaries,'function');let reads=0;
 const rows=module.homeWindowSummaries(snapshot,[{...view('code','agent-source','foreign'),projectId:'other'},view('workspace',null),view('unknown','x'),...Array.from({length:20},(_,n)=>view('code','agent-source','own-'+n))],()=>{reads++;return reference;});
 assert.equal(rows.length,16);assert.equal(reads,16);assert.equal(rows[0].windowId,'own-0');assert.equal(rows.at(-1).windowId,'own-15');
});
test('saved title metadata stays bounded and literal, with safe fallbacks and correct minimized state',()=>{
 assert.equal(typeof module.homeWindowSummaries,'function');
 const selected={...snapshot,json:JSON.stringify({workpapers:[{id:'doc-a',title:'<img onerror=alert(1)>\u202e\n'+'😀'.repeat(200)},{id:'empty',title:'',content:'PRIVATE_BODY_FALLBACK'}]})};
 const rows=module.homeWindowSummaries(selected,[{...view('docs','doc-a'),state:'minimized'},view('docs','empty','empty')]);
 assert.equal(rows[0].state,'minimized');assert.ok(rows[0].label.length<=256);assert.equal(rows[0].label.isWellFormed(),true);assert.match(rows[0].label,/^Docs · <img onerror=alert\(1\)>/);assert.doesNotMatch(rows[0].label,/[\u202e\n]/);
 assert.equal(rows[1].label,'Docs · empty · project r12');assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);
 const before=structuredClone(snapshot);module.homeWindowSummaries(snapshot,[view('docs','missing')]);assert.deepEqual(snapshot,before);
});
