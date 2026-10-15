// Permanent DR-1 regression retained from the genuine peer fixture.
// Fixture and first assertion body are unchanged except static import locations.
// Independent finite source evidence: real scheduler/coordinator/working lease/registry.
// Domain storage, renderer and native windows are inert adapters; no durable/native claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {DocsDiagramRefresh} from '../src/windows/docs-diagram-refresh.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeDocsEdits} from '../src/windows/docs-edits.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createDiagramEmbedPublication,readDiagramEmbedPublication} from '../src/documents/diagram-embed-publication.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
 let serial=0,working,release,entered=0,settledResolve,version='a'.repeat(64),revision=1;
 const windows=[],published=[],notices=[],capabilities=[],settled=new Promise(r=>settledResolve=r),doc={id:'doc-a',title:'Before',blocks:[]};
 const snapshot={schema:2,project:{id:'project-a'},sourceRefs:[],json:JSON.stringify({workpapers:[doc],diagrams:[]})};
 const registry=new WindowRegistry({authorize:()=>({projectId:'project-a',mode:'normal',access:'write',entityIds:['doc-a']}),createWindow:async record=>{
  const window=new EventEmitter();let dead=false;Object.assign(window,{id:++serial,isDestroyed:()=>dead,isMinimized:()=>false,restore(){},focus(){},close(){window.destroy();},destroy(){dead=true;window.emit('closed');}});
  const wc=window.webContents=new EventEmitter();Object.assign(wc,{id:100+serial,mainFrame:{url:record.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>dead});windows.push(window);return window;
 }});
 const receipt=extra=>({ok:true,domain:'docs',entityId:'doc-a',version,sha256:hash(doc),projectRevision:revision,durability:'committed',...extra});
 const owner=new WorkspaceCoordinator({registry,sources:()=>null,access:()=>true,nativeDiagramRefreshAccess:()=>!working||working.canRefresh('project-a','doc-a'),domains:{
  read:async()=>receipt({entity:{...doc,blocks:[]}}),
  apply:async(_kind,request)=>{revision++;version='b'.repeat(64);doc.title=request.payload.title;return receipt({operationId:request.operationId});},flush:async()=>receipt(),
  commitDiagramEmbed:async(token,scope)=>{assert.equal(scope.isCurrent(),true);const request=readDiagramEmbedPublication(token);assert.ok(request);published.push(request);return receipt({operationId:request.operationId});},
 }});
 const block=sourceHash=>({id:'embed-a',kind:'diagram-embed',schema:1,diagramId:'flow-a',mode:'live',scope:'whole',nodeIds:[],caption:'Flow',display:{height:100,fit:'contain'},snapshot:{sourceHash,sourceVersion:1,sourceAsset:{sha256:'c'.repeat(64),bytes:1,kind:'diagram-source'},visualAsset:{sha256:'d'.repeat(64),bytes:1,kind:'svg'},rendererVersion:'inert',styleHash:'e'.repeat(64)},status:'current',missingNodeIds:[]});
 const prepare=request=>({token:createDiagramEmbedPublication({documentId:'doc-a',expectedVersion:version,operationId:'refresh-'+entered,action:'refresh',afterBlockId:null,block:block(request.sourceHash)})});
 const scheduler=new DocsDiagramRefresh({owner:{observeDomainSaves:owner.observeDomainSaves.bind(owner),captureDiagramRefresh:(...args)=>{const c=owner.captureDiagramRefresh(...args);capabilities.push(c);return c;},invokeDiagramRefresh:owner.invokeDiagramRefresh.bind(owner)},diagrams:{listRefreshTargets:async()=>[{documentId:'doc-a',blockId:'embed-a',mode:'live'}],prepareRefresh:async request=>{entered++;if(entered===1)return new Promise(resolve=>release=()=>resolve(prepare(request)));return prepare(request);}},workingState:{isBlocked:()=>working?.canRefresh('project-a','doc-a')===false,onPending:r=>notices.push(r)}});
 working=new NativeDocsEdits({registry,owner,enabled:()=>true,snapshotFor:()=>snapshot,onSettled:async ref=>{assert.equal(working.canRefresh('project-a','doc-a'),true);scheduler.onDocumentSettled(ref);settledResolve();await scheduler.drain();}});
 const open=async()=>{await registry.openView({role:'docs',entityId:'doc-a'});const event={sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame},grant=registry.capture(event);assert.equal((await working.admit(grant)).ok,true);return{event,grant};};
 return{owner,scheduler,working,registry,published,notices,capabilities,settled,open,release:()=>release(),entered:()=>entered,saved:()=>scheduler.onDiagramSaved({projectId:'project-a',diagramId:'flow-a',sourceHash:'f'.repeat(64),sourceVersion:1,projectRevision:1}),save:event=>working.invoke({event,method:'applyDocument',payload:{operationId:'save-doc',documentId:'doc-a',expectedVersion:version,action:'rename',payload:{title:'After'}}})};
}
test('independent DR-1 genuine working save settles before held prepare returns and must not lose pending Live refresh',async()=>{
 const f=await fixture();f.saved();await tick();assert.equal(f.entered(),1);
 const {event}=await f.open();const old=f.capabilities[0];assert.equal(old.isCurrent(),false,'genuine newly admitted working lease retires scope');
 const saving=f.save(event);await f.settled;assert.equal(old.isCurrent(),false);assert.equal(f.working.canRefresh('project-a','doc-a'),true,'actual settlement grants temporary refresh authority');
 f.release();const result=await saving;assert.equal(result.ok,true);await f.scheduler.drain();
 assert.equal(f.published.length,1,'fresh preparation/publication must run inside authoritative settlement');assert.equal(f.entered(),2);
 f.working.dispose();await f.scheduler.dispose();
});

test('unrelated settlement does not retire an active document or queue a completed refresh',async()=>{
 const f=await fixture();f.saved();await tick();assert.equal(f.entered(),1);const current=f.capabilities[0];
 f.scheduler.onDocumentSettled({projectId:'project-a',documentId:'doc-other'});
 f.scheduler.onDocumentSettled({projectId:'project-other',documentId:'doc-a'});
 assert.equal(current.isCurrent(),true,'only the current project/document may invalidate this preparation');
 f.release();await f.scheduler.drain();assert.equal(f.entered(),1);assert.equal(f.published.length,1);
 f.scheduler.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.scheduler.drain();
 assert.equal(f.entered(),1,'completed targets are no longer eligible solely as in-flight work');assert.equal(f.published.length,1);
 f.working.dispose();await f.scheduler.dispose();
});
