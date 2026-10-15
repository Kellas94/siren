import test from 'node:test';
import assert from 'node:assert/strict';
import {DocsDiagramRefresh} from '../src/windows/docs-diagram-refresh.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';

// Actual scheduler and genuine sticky coordinator capability, with inert working
// policy/render/publication adapters. No native window, filesystem write or
// receipt authenticity is exercised; the publication callback counts intent.
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const saved=(hash='a',version=2)=>({projectId:'project-a',diagramId:'flow-a',sourceHash:hash.repeat(64),sourceVersion:version,projectRevision:version});
function fixture(){
 let blocked=false,hold=false,release,entered=0;
 const published=[],notices=[],capabilities=[];
 const owner=new WorkspaceCoordinator({registry:{isCurrent:()=>true,eventFor(){},caller(){}},sources:()=>null,access:()=>true,nativeDiagramRefreshAccess:()=>!blocked});
 const service=new DocsDiagramRefresh({
  owner:{observeDomainSaves:owner.observeDomainSaves.bind(owner),captureDiagramRefresh:(...args)=>{const capability=owner.captureDiagramRefresh(...args);capabilities.push(capability);return capability;},invokeDiagramRefresh:async token=>{published.push(token);return {ok:true};}},
  diagrams:{listRefreshTargets:async()=>[{documentId:'doc-a',blockId:'embed-a',mode:'live'}],prepareRefresh:async request=>{
   entered++;if(hold){hold=false;return new Promise(resolve=>{release=()=>resolve({token:{sourceHash:request.sourceHash,capability:request.capability}});});}
   return {token:{sourceHash:request.sourceHash,capability:request.capability}};
  }},
  workingState:{isBlocked:()=>blocked,onPending:row=>notices.push(row)},
 });
 return {service,published,notices,capabilities,setBlocked:value=>blocked=value,hold:()=>hold=true,
  release:()=>{assert.equal(typeof release,'function');release();},get entered(){return entered;}};
}

test('working admission during held preparation defers Live refresh until authoritative settlement mints a fresh capability',async()=>{
 const f=fixture();f.hold();f.service.onDiagramSaved(saved());await tick();assert.equal(f.entered,1);
 const retired=f.capabilities[0];f.setBlocked(true);assert.equal(retired.isCurrent(),false);
 f.release();await f.service.drain();assert.equal(f.published.length,0);assert.equal(f.service.isIdle(),true);
 f.setBlocked(false);assert.equal(retired.isCurrent(),false,'old authority remains permanently retired');
 f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();
 assert.equal(f.entered,2,'Live refresh must retain a document deferred while preparation loses its working-view capability');
 assert.equal(f.published.length,1);assert.notEqual(f.capabilities[1],retired);assert.equal(f.capabilities[1].isCurrent(),true);
 assert.equal(f.notices.length,1);assert.equal(f.notices[0].documentId,'doc-a');assert.equal(f.notices[0].reason,'native-lease');
 await f.service.dispose();
});

test('control an initially blocked target stays deferred and settles through fresh preparation',async()=>{
 const f=fixture();f.setBlocked(true);f.service.onDiagramSaved(saved());await f.service.drain();
 assert.equal(f.entered,0);assert.equal(f.published.length,0);assert.equal(f.notices[0].reason,'working-draft');
 f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();assert.equal(f.entered,0);
 f.setBlocked(false);f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();
 assert.equal(f.entered,1);assert.equal(f.published.length,1);await f.service.dispose();
});

test('a newer source retires held preparation and publishes only the queued current source without duplicate settlement work',async()=>{
 const f=fixture();f.hold();f.service.onDiagramSaved(saved());await tick();const old=f.capabilities[0];
 f.service.onDiagramSaved(saved('b',3));assert.equal(old.isCurrent(),false);f.release();await f.service.drain();
 assert.equal(f.entered,2);assert.equal(f.published.length,1);assert.equal(f.published[0].sourceHash,'b'.repeat(64));assert.equal(f.notices.length,0);
 f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();assert.equal(f.entered,2);assert.equal(f.published.length,1);
 await f.service.dispose();
});

test('pause joins held preparation without reviving its cleared job after resume or a later document settlement',async()=>{
 const f=fixture();f.hold();f.service.onDiagramSaved(saved());await tick();let paused=false;
 const closing=f.service.pause().then(()=>paused=true);await tick();assert.equal(paused,false);assert.equal(f.capabilities[0].isCurrent(),false);
 f.release();await closing;f.service.resume();f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();
 assert.equal(f.entered,1);assert.equal(f.published.length,0);assert.equal(f.notices.length,0);await f.service.dispose();
});
