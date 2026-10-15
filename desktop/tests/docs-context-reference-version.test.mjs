// Reviewer-authored causal controls. Full production renderer scripts, actual
// draft/context/model + Registry/Coordinator/Domain/DocsReads/DocsReferences.
// Only DOM/native handles and the immutable in-memory project read adapter are inert.
// No project writes, Electron, provider, subprocess or native application execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {fixture as rendererFixture,settle,waitFor} from '../tests/helpers/docs-functional-continuity-fixture.mjs';
import * as model from '../src/documents/context.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {NativeDocsReads} from '../src/windows/docs-reads.mjs';
import {NativeDocsReferences} from '../src/windows/docs-references.mjs';
const contextScript=await readFile(new URL('../src/ui/docs/context.js',import.meta.url),'utf8');
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const ref=id=>({kind:'document',documentId:id,blockId:'',label:id==='doc-alpha'?'Alpha saved reference':'Beta saved reference',dangling:false});
const traces=[];

async function fixture(){
 const f=await rendererFixture();
 f.store({...f.saved,links:[ref('doc-alpha')],owner:'Saved owner'});
 const snapshot=()=>{const json=JSON.stringify({workpapers:[f.saved,{id:'doc-alpha',title:'Alpha',blocks:[]},{id:'doc-beta',title:'Beta',blocks:[]}]});return {schema:1,project:{id:'review-project',label:'Owned inert review',external:false},revision:f.read().projectRevision,json,sha256:digest(json)};};
 let serial=0,unlocked=true;const windows=[],shown=[],calls=[];
 const registry=new WindowRegistry({authorize:()=>unlocked?{projectId:'review-project',mode:'normal',access:'write',entityIds:['refresh-doc','doc-alpha','doc-beta']}:null,createWindow:record=>{
  const win=new EventEmitter(),wc=new EventEmitter();let dead=false;win.id=++serial;
  Object.assign(win,{isDestroyed:()=>dead,isMinimized:()=>false,restore(){},focus(){},close(){win.destroy();},destroy(){dead=true;win.emit('closed');},webContents:wc});
  Object.assign(wc,{id:100+serial,mainFrame:{url:record.mainFrameUrl},isDestroyed:()=>dead,getURL:()=>wc.mainFrame.url});windows.push(win);return win;
 }});
 await registry.openView({role:'docs',entityId:'refresh-doc'});
 const event={sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame};
 const domains=new DomainRepository({projects:()=>({readProject:async()=>snapshot()}),sources:()=>({}),validatePatch:()=>false});
 const owner=new WorkspaceCoordinator({registry,domains,sources:()=>({}),access:(_grant,scope)=>unlocked&&scope.action==='read-domain'&&scope.domain==='docs'&&scope.entityId==='refresh-doc'});
 const reads=new NativeDocsReads({registry,owner,documentFor:()=>f.saved,readonlyFor:()=>false});
 const references=new NativeDocsReferences({registry,owner,reads,snapshotFor:snapshot,canOpen:()=>unlocked,show:opened=>shown.push(opened.entityId)});
 f.window.sirenDocsRead.getDocument=()=>reads.invoke({event,method:'getDocument'});
 f.window.sirenDocsReferences={getTargets:payload=>references.invoke({event,method:'getTargets',payload:structuredClone(payload)}),openReference:async payload=>{calls.push(structuredClone(payload));const answer=await references.invoke({event,method:'openReference',payload:structuredClone(payload)});calls.at(-1).answer=answer;return answer;}};
 f.window.SirenDocumentContext=Object.fromEntries(Object.entries(model).map(([key,value])=>[key,typeof value==='function'?(...args)=>value(...args.map(v=>structuredClone(v))):value]));
 const create=f.document.createElement;f.document.createElement=tag=>{const node=create(tag);if(tag==='dialog'){node.showModal=()=>node.open=true;node.close=()=>{node.open=false;node.emit('close');};}return node;};
 runInNewContext(contextScript,{window:f.window,document:f.document});
 assert.equal(await f.refresh(),true,'actual renderer accepts genuine domain document receipt');
 const openSheet=()=>{f.elements.documentContext.emit();const dialog=f.nodes.find(n=>n.tagName==='DIALOG'&&n.open);assert.ok(dialog);return dialog;};
 const buttons=()=>f.nodes.filter(n=>n.isConnected&&n.tagName==='BUTTON'&&n.textContent==='Open saved');
 async function replaceLinks(links){f.store({...f.saved,links});const receipt=await reads.invoke({event,method:'getDocument'});assert.equal(receipt.ok,true);f.notify({documentId:f.saved.id,version:receipt.version,projectRevision:receipt.projectRevision});f.runRefreshTimer();await waitFor(()=>f.document.body.dataset.documentVersion===receipt.version);await settle();return receipt;}
 return {...f,shown,calls,registry,owner,reads,references,event,openSheet,buttons,replaceLinks,lock(){unlocked=false;owner.pause('lock');},trace(label){const value={label,version:f.document.body.dataset.documentVersion,labels:f.nodes.filter(n=>n.isConnected&&n.className==='context-reference').map(n=>n.textContent),calls:structuredClone(calls),shown:[...shown],views:registry.listViews().map(v=>({role:v.role,entityId:v.entityId}))};traces.push(value);return value;}};
}

test('control: unchanged Context sheet opens the exact displayed saved reference through genuine service',async()=>{
 const f=await fixture();f.openSheet();const button=f.buttons()[0];assert.match(button.parent.textContent,/Alpha saved reference/);
 await button.emit();assert.deepEqual(f.shown,['doc-alpha']);assert.equal(f.calls[0].answer.ok,true);assert.equal(f.writes,0);f.trace('unchanged');
});

test('adverse: automatic saved refresh must not make the displayed Alpha row open Beta',async()=>{
 const f=await fixture(),dialog=f.openSheet(),button=f.buttons()[0],oldVersion=f.document.body.dataset.documentVersion;
 await f.replaceLinks([ref('doc-beta')]);assert.equal(dialog.open,true,'production refresh currently leaves Context open');assert.equal(button.isConnected,true);assert.match(button.parent.textContent,/Alpha saved reference/);assert.notEqual(f.document.body.dataset.documentVersion,oldVersion);
 await button.emit();f.trace('stale-label-new-version');
 assert.equal(f.shown.includes('doc-beta'),false,'A displayed Alpha reference must refuse or open Alpha; it must never open newly substituted Beta.');
});

test('control: the main service refuses the original old document version after link replacement',async()=>{
 const f=await fixture();f.openSheet();const oldVersion=f.document.body.dataset.documentVersion;await f.replaceLinks([ref('doc-beta')]);
 const answer=await f.references.invoke({event:f.event,method:'openReference',payload:{index:0,expectedDocumentVersion:oldVersion}});
 assert.equal(answer.ok,false);assert.equal(answer.code,'DOCUMENT_CONFLICT');assert.deepEqual(f.shown,[]);f.trace('old-version-refused');
});

test('control: Lock refuses the same displayed reference without creating a peer',async()=>{
 const f=await fixture();f.openSheet();f.lock();await f.buttons()[0].emit();assert.equal(f.calls[0].answer.ok,false);assert.equal(f.calls[0].answer.code,'ACCESS_REFUSED');assert.deepEqual(f.shown,[]);assert.equal(f.registry.listViews().length,1);f.trace('lock');
});

test.after(()=>{process.stdout.write('REVIEW_TRACES '+JSON.stringify(traces)+'\n');});


test('stale Context cannot apply its patch over peer changes and retains typed values for review',async()=>{
 const f=await fixture(),dialog=f.openSheet();const owner=f.nodes.find(n=>n.isConnected&&n.dataset.contextField==='owner');assert.ok(owner);owner.value='Unapplied local owner';owner.emit('input');
 await f.replaceLinks([ref('doc-beta')]);const apply=f.nodes.find(n=>n.isConnected&&n.id==='applyDocumentContext');assert.ok(apply);await apply.parent.parent.emit('submit');
 assert.equal(dialog.open,true);assert.equal(owner.value,'Unapplied local owner');assert.equal(f.saved.owner,'Saved owner');assert.equal(f.document.body.dataset.documentDirty,'false');assert.equal(f.writes,0);assert.ok(f.nodes.some(n=>n.isConnected&&/unapplied values are retained here/.test(n.textContent)));assert.deepEqual(f.shown,[]);
});

test('current Context can still apply local metadata without committing the project',async()=>{
 const f=await fixture(),dialog=f.openSheet();const owner=f.nodes.find(n=>n.isConnected&&n.dataset.contextField==='owner');owner.value='New draft owner';owner.emit('input');const apply=f.nodes.find(n=>n.isConnected&&n.id==='applyDocumentContext');await apply.parent.parent.emit('submit');
 assert.equal(dialog.open,false);assert.equal(f.saved.owner,'Saved owner');assert.equal(f.document.body.dataset.documentDirty,'true');assert.equal(f.writes,0);
});

test('stale Context does not issue a new target search against a different saved document version',async()=>{
 const f=await fixture();f.openSheet();let searches=0;f.window.sirenDocsReferences.getTargets=async()=>{searches++;return {ok:false};};await f.replaceLinks([ref('doc-beta')]);const find=f.nodes.find(n=>n.isConnected&&n.tagName==='BUTTON'&&n.textContent==='Find');assert.ok(find);await find.emit();assert.equal(searches,0);assert.equal(f.writes,0);
});
