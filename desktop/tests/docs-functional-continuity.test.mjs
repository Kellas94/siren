import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,settle,waitFor,deferred} from './helpers/docs-functional-continuity-fixture.mjs';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeDocsEdits} from '../src/windows/docs-edits.mjs';
import {DocsDiagramRefresh} from '../src/windows/docs-diagram-refresh.mjs';
import {createDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';

// OWNER causal checks: actual Docs renderer/draft/reader/activity/embed scripts,
// finite inert DOM and bridges. No native window, IPC or filesystem publication.
test('a newer saved reference arriving during Refresh is retained and read after the older reply',async()=>{
 const f=await fixture({readonly:true}),old=f.read(),held=f.holdRead(),reading=f.refresh();
 f.store({...f.saved,title:'Newer saved document'});f.notify();f.runRefreshTimer();
 assert.equal(f.reads,2,'a held read must not overlap another automatic read');
 f.releaseReads();held.resolve(old);assert.equal(await reading,true);await settle();
 f.runRefreshTimer();await waitFor(()=>f.elements.viewTitle.textContent==='Newer saved document');
 assert.equal(f.elements.viewTitle.textContent,'Newer saved document','the notification cannot be erased by an older successful read');
 assert.equal(f.document.body.dataset.documentVersion,'2'.repeat(64));assert.equal(f.reads,3);assert.equal(f.writes,0);
 f.events.beforeunload();
});

test('a diagram pending notice offers explicit Save for an unchanged working document',async()=>{
 const f=await fixture({embed:true});assert.equal(f.elements.saveDocument.disabled,true);
 f.pendingDiagram();assert.match(f.elements.documentChangesMessage.textContent,/save when ready/i);
 assert.equal(f.elements.saveDocument.disabled,false,'the advertised Save must be reachable for a clean blocked working copy');
 f.elements.saveDocument.emit();await settle();assert.equal(f.flushes,1);assert.equal(f.writes,0,'unchanged Save uses only its existing flush contract');
 f.events.beforeunload();
});

test('clean pending Save reaches genuine working settlement and a fresh branded Live publication',async()=>{
 const f=await fixture({embed:true}),windows=[];let working,settlements=0,publications=0;
 const registry=new WindowRegistry({authorize:()=>({projectId:'project-a',mode:'normal',access:'write',entityIds:['refresh-doc']}),createWindow:async record=>{
  const window=new EventEmitter();let dead=false;Object.assign(window,{id:1,isDestroyed:()=>dead,isMinimized:()=>false,restore(){},focus(){},close(){window.destroy();},destroy(){dead=true;window.emit('closed');}});
  const wc=window.webContents=new EventEmitter();Object.assign(wc,{id:101,mainFrame:{url:record.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>dead});windows.push(window);return window;
 }});
 const receipt=extra=>({ok:true,domain:'docs',entityId:'refresh-doc',version:f.read().version,sha256:createHash('sha256').update(JSON.stringify(f.saved)).digest('hex'),projectRevision:f.read().projectRevision,durability:'committed',...extra});
 const owner=new WorkspaceCoordinator({registry,sources:()=>null,access:()=>true,nativeDiagramRefreshAccess:()=>working.canRefresh('project-a','refresh-doc'),domains:{
  read:async()=>receipt({entity:structuredClone(f.saved)}),apply:async()=>assert.fail('unchanged Save must not replace document content'),flush:async()=>receipt(),
  commitDiagramEmbed:async(token,scope)=>{assert.equal(scope.isCurrent(),true);publications++;f.store({...f.saved,title:'Authoritative Live refresh'});return receipt({operationId:'refresh-pending'});},
 }});
 const block={id:'embed-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:'whole',nodeIds:[],caption:'Flow',display:{height:100,fit:'contain'},snapshot:{sourceHash:'a'.repeat(64),sourceVersion:1,sourceAsset:{sha256:'c'.repeat(64),bytes:1,kind:'diagram-source'},visualAsset:{sha256:'d'.repeat(64),bytes:1,kind:'svg'},rendererVersion:'inert',styleHash:'e'.repeat(64)},status:'current',missingNodeIds:[]};
 const scheduler=new DocsDiagramRefresh({owner,diagrams:{listRefreshTargets:async()=>[{documentId:'refresh-doc',blockId:'embed-a',mode:'live'}],prepareRefresh:async()=>({token:createDiagramEmbedPublication({documentId:'refresh-doc',expectedVersion:f.read().version,operationId:'refresh-pending',action:'refresh',afterBlockId:null,block})})},workingState:{isBlocked:()=>!working.canRefresh('project-a','refresh-doc'),onPending:()=>f.pendingDiagram()}});
 working=new NativeDocsEdits({registry,owner,enabled:()=>true,snapshotFor:()=>({schema:2,project:{id:'project-a'},sourceRefs:[],json:JSON.stringify({workpapers:[f.saved],diagrams:[]})}),onReferenceChanged:()=>f.notify(),onSettled:async ref=>{settlements++;assert.equal(working.canRefresh('project-a','refresh-doc'),true);scheduler.onDocumentSettled(ref);await scheduler.drain();}});
 try{
  await registry.openView({role:'docs',entityId:'refresh-doc'});const event={sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame},grant=registry.capture(event);assert.equal((await working.admit(grant)).ok,true);
  f.setFlush(request=>working.invoke({event,method:'flushDocument',payload:structuredClone(request)}));
  scheduler.onDiagramSaved({projectId:'project-a',diagramId:'flow-a',sourceHash:'a'.repeat(64),sourceVersion:1,projectRevision:1});await scheduler.drain();
  assert.equal(publications,0);assert.match(f.elements.documentChangesMessage.textContent,/pending/i);f.elements.saveDocument.emit();await waitFor(()=>settlements===1&&publications===1&&/Document saved/.test(f.elements.viewStatus.textContent));
  assert.equal(settlements,1,'the explicit clean Save must enter NativeDocsEdits authoritative settlement');assert.equal(publications,1,'genuine scheduler/coordinator must publish through the branded token');assert.equal(f.flushes,1);assert.equal(f.writes,0);
  f.runRefreshTimer();await waitFor(()=>f.elements.viewTitle.textContent==='Authoritative Live refresh');assert.equal(f.elements.viewTitle.textContent,'Authoritative Live refresh');
  // The owner's flush save event can issue a fresh pending notice before its
  // genuine settlement runs. That newer notice must survive this earlier Save.
  assert.equal(f.elements.saveDocument.disabled,false);assert.equal(f.elements.documentChangesNotice.hidden,false);
  f.elements.saveDocument.emit();await waitFor(()=>settlements===2&&f.elements.saveDocument.disabled&&/Document saved/.test(f.elements.viewStatus.textContent));
  assert.equal(publications,1,'no automatic or duplicate refresh publication');assert.equal(f.flushes,2);assert.equal(f.elements.documentChangesNotice.hidden,true);
 }finally{f.events.beforeunload();working.dispose();await scheduler.dispose();}
});

test('Undo and Redo remain usable while Refresh holds a reply and retire that older read',async()=>{
 const f=await fixture(),held=f.holdRead(),old=f.read(),reading=f.refresh();f.edit('heading-a','Temporary local edit').focus();
 const undo=f.elements.documentContent.querySelector('[data-document-history="undo"]');assert.equal(undo.disabled,false);let prevented=0;
 f.events.keydown({key:'z',ctrlKey:true,preventDefault(){prevented++;}});
 assert.equal(prevented,1);assert.equal(f.input('heading-a').value,'Saved heading','an enabled Undo must work during the read');
 f.input('heading-a').focus();f.events.keydown({key:'z',ctrlKey:true,shiftKey:true,preventDefault(){prevented++;}});
 assert.equal(prevented,2);assert.equal(f.input('heading-a').value,'Temporary local edit');
 held.resolve(old);assert.equal(await reading,false);assert.equal(f.input('heading-a').value,'Temporary local edit');assert.equal(f.writes,0);f.events.beforeunload();
});

test('a stale reply for an already-known reference keeps the notice without an automatic retry loop',async()=>{
 const f=await fixture({readonly:true}),old=f.read();f.store({...f.saved,title:'Known latest saved'});f.notify();
 const held=f.holdRead(),reading=f.refresh();f.runRefreshTimer();f.releaseReads();held.resolve(old);assert.equal(await reading,true);await settle();
 for(let n=0;n<3;n++){f.runRefreshTimer();await settle();}
 assert.equal(f.reads,2);assert.equal(f.elements.documentChangesNotice.hidden,false);assert.match(f.elements.documentChangesMessage.textContent,/another window/i);
 assert.equal(await f.refresh(),true);assert.equal(f.elements.viewTitle.textContent,'Known latest saved');assert.equal(f.reads,3);assert.equal(f.elements.documentChangesNotice.hidden,true);f.events.beforeunload();
});

test('newer references during Refresh do not replace a newly edited local draft',async()=>{
 const f=await fixture(),old=f.read(),held=f.holdRead(),reading=f.refresh();f.edit('heading-a','Preserve this local change');f.store({...f.saved,title:'Saved elsewhere'});f.notify();f.runRefreshTimer();
 f.releaseReads();held.resolve(old);assert.equal(await reading,false);f.runRefreshTimer();await settle();
 assert.equal(f.reads,2);assert.equal(f.input('heading-a').value,'Preserve this local change');assert.equal(f.document.body.dataset.documentDirty,'true');assert.equal(f.elements.documentChangesNotice.hidden,false);assert.equal(f.writes,0);f.events.beforeunload();
});

test('refused pending flush preserves the notice and permits only an explicit retry',async()=>{
 const f=await fixture({embed:true});f.pendingDiagram();f.setFlush(async()=>({ok:false,code:'DOCUMENT_CONFLICT'}));f.elements.saveDocument.emit();await waitFor(()=>f.flushes===1&&/Save refused/.test(f.elements.viewStatus.textContent));
 assert.equal(f.elements.documentChangesNotice.hidden,false);assert.equal(f.elements.saveDocument.disabled,false);f.runRefreshTimer();await settle();assert.equal(f.flushes,1);assert.equal(f.writes,0);
 f.setFlush(async()=>flushReceipt(f));f.elements.saveDocument.emit();await waitFor(()=>f.flushes===2&&f.elements.saveDocument.disabled);assert.equal(f.elements.documentChangesNotice.hidden,true);f.events.beforeunload();
});

function flushReceipt(f){const saved=f.read();return {ok:true,domain:'docs',entityId:saved.document.id,version:saved.version,sha256:saved.sha256,projectRevision:saved.projectRevision,durability:'committed'};}

test('fresh pending notice during held flush survives and duplicate Save shortcut does not consume it',async()=>{
 const f=await fixture({embed:true}),held=deferred();f.pendingDiagram();f.setFlush(()=>held.promise);f.elements.saveDocument.emit();await waitFor(()=>f.flushes===1);f.pendingDiagram();
 f.events.keydown({key:'s',ctrlKey:true,preventDefault(){}});assert.equal(f.flushes,1);assert.equal(f.elements.saveDocument.disabled,true);
 held.resolve(flushReceipt(f));await waitFor(()=>/Document saved/.test(f.elements.viewStatus.textContent));assert.equal(f.elements.saveDocument.disabled,false);assert.equal(f.elements.documentChangesNotice.hidden,false);assert.equal(f.writes,0);f.events.beforeunload();
});

test('read-only pending diagram retains disclosure with no Save capability',async()=>{
 const f=await fixture({readonly:true,embed:true});f.pendingDiagram();assert.equal(f.elements.saveDocument.hidden,true);assert.equal(f.elements.saveDocument.disabled,true);assert.match(f.elements.documentChangesMessage.textContent,/working copies/i);
 f.elements.saveDocument.emit();f.events.keydown({key:'s',ctrlKey:true,preventDefault(){}});await settle();assert.equal(f.flushes,0);assert.equal(f.writes,0);f.events.beforeunload();
});

test('disposal retires a queued saved-reference follow-up without another read',async()=>{
 const f=await fixture({readonly:true}),old=f.read(),held=f.holdRead(),reading=f.refresh();f.store({...f.saved,title:'Later saved'});f.notify();f.runRefreshTimer();f.releaseReads();held.resolve(old);assert.equal(await reading,true);await settle();
 f.events.beforeunload();f.runRefreshTimer();await settle();assert.equal(f.reads,2);assert.equal(f.writes,0);
});
