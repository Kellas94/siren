import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/windows/docs-diagram-refresh.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 assert.equal(typeof api.DocsDiagramRefresh,'function','Missing persistent Live refresh scheduler');let blocked=false,listener,prepare,commit,generation=0;const published=[],pending=[];
 const owner={observeDomainSaves:fn=>{listener=fn;return()=>listener=null;},captureDiagramRefresh:()=>{const own=generation;return {isCurrent:()=>own===generation};},invokeDiagramRefresh:async token=>{published.push(token);return commit?commit(token):{ok:true};}};
 const diagrams={listRefreshTargets:async()=>[{documentId:'doc-a',blockId:'embed-a',mode:'live'},{documentId:'doc-a',blockId:'fixed-a',mode:'fixed'}],prepareRefresh:async request=>prepare?prepare(request):{token:{sourceHash:request.sourceHash,blockId:request.blockId}}};
 const service=new api.DocsDiagramRefresh({owner,diagrams,workingState:{isBlocked:()=>blocked,onPending:row=>pending.push(row)}});
 const saved=(hash='a',sourceVersion=1)=>service.onDiagramSaved({projectId:'project-a',diagramId:'flow-a',sourceHash:hash.repeat(64),sourceVersion,projectRevision:sourceVersion});
 return {service,published,pending,saved,blocked:v=>blocked=v,prepare:fn=>prepare=fn,commit:fn=>commit=fn,retire:()=>generation++,observe:event=>listener?.(event)};
}
test('newer saved capture retires a held older render; fixed blocks never refresh',async()=>{
 const f=fixture();let release;f.prepare(r=>r.sourceVersion===1?new Promise(done=>release=()=>done({token:{sourceHash:r.sourceHash,blockId:r.blockId}})):Promise.resolve({token:{sourceHash:r.sourceHash,blockId:r.blockId}}));f.saved('a',1);await tick();f.saved('b',2);release();await f.service.drain();assert.deepEqual(f.published,[{sourceHash:'b'.repeat(64),blockId:'embed-a'}]);assert.equal(f.service.isIdle(),true);
});
test('dirty native working lease defers refresh until an authoritative settlement; hashes include style-only edits',async()=>{
 const f=fixture();f.blocked(true);f.saved('a',1);await f.service.drain();assert.equal(f.published.length,0);assert.equal(f.pending.at(-1).documentId,'doc-a');assert.equal(f.service.isIdle(),true);f.blocked(false);f.service.onDocumentSettled({projectId:'project-a',documentId:'doc-a'});await f.service.drain();assert.equal(f.published.length,1);f.saved('b',2);await f.service.drain();assert.equal(f.published.at(-1).sourceHash,'b'.repeat(64));
});
test('CAS conflict retries only with a fresh preparation; pause retires and joins late rendering',async()=>{
 const f=fixture();let count=0;f.commit(()=>++count===1?{ok:false,code:'DOCUMENT_CONFLICT'}:{ok:true});f.saved();await f.service.drain();assert.equal(count,2);
 let release;f.prepare(()=>new Promise(r=>release=r));f.saved('c',3);await tick();let joined=false;const paused=f.service.pause().then(()=>joined=true);await tick();assert.equal(joined,false);release({token:{sourceHash:'c'.repeat(64)}});await paused;f.service.resume();assert.equal(f.published.length,2);assert.equal(f.service.isIdle(),true);
});
test('real owner metadata observer schedules diagram saves, ignores automatic self receipts and unsubscribes on dispose',async()=>{
 const f=fixture();f.observe({domain:'diagram',projectId:'project-a',entityId:'flow-a',originWindowId:'diagram-window',receipt:{ok:true,version:1,sha256:'a'.repeat(64),projectRevision:1}});await f.service.drain();assert.equal(f.published.length,1);f.observe({domain:'docs',projectId:'project-a',entityId:'doc-a',receipt:{ok:true}});await f.service.drain();assert.equal(f.published.length,1);await f.service.dispose();f.saved('b',2);await f.service.drain();assert.equal(f.published.length,1);
});
test('authoritative project rescan discovers missed saved sources and joins a held scan on pause',async()=>{
 const f=fixture();assert.equal(typeof f.service.rescanProject,'function','Reopen requires an authoritative scan');await f.service.dispose();let release,entered;const ready=new Promise(r=>entered=r),wait=new Promise(r=>release=r),published=[];const service=new api.DocsDiagramRefresh({owner:{observeDomainSaves:()=>()=>{},captureDiagramRefresh:()=>({isCurrent:()=>true}),invokeDiagramRefresh:async token=>{published.push(token);return {ok:true};}},diagrams:{listRefreshSources:async()=>{entered();await wait;return [{projectId:'project-a',diagramId:'gone-source',sourceHash:'f'.repeat(64),sourceVersion:1,projectRevision:4}];},listRefreshTargets:async()=>[{documentId:'doc-a',blockId:'embed-a',mode:'live'}],prepareRefresh:async r=>({token:{id:r.diagramId}})},workingState:{isBlocked:()=>false,onPending(){}}});const scanning=service.rescanProject('project-a');await ready;let joined=false;const paused=service.pause().then(()=>joined=true);await tick();assert.equal(joined,false);release();await scanning;await paused;assert.deepEqual(published,[]);service.resume();await service.rescanProject('project-a');await service.drain();assert.deepEqual(published,[{id:'gone-source'}]);await service.dispose();
});
test('project scan streams more sources than the pending-job budget without dropping settled jobs',async()=>{
 const published=[],rows=Array.from({length:130},(_,i)=>({projectId:'project-a',diagramId:'flow-'+i,sourceHash:'a'.repeat(64),sourceVersion:1,projectRevision:1}));const service=new api.DocsDiagramRefresh({owner:{observeDomainSaves:()=>()=>{},captureDiagramRefresh:()=>({isCurrent:()=>true}),invokeDiagramRefresh:async token=>{published.push(token);return {ok:true};}},diagrams:{listRefreshSources:async()=>rows,listRefreshTargets:async()=>[{documentId:'doc-a',blockId:'embed-a',mode:'live'}],prepareRefresh:async r=>({token:r.diagramId})},workingState:{isBlocked:()=>false,onPending(){}}});assert.equal(await service.rescanProject('project-a'),true);await service.drain();assert.equal(published.length,130);await service.dispose();
});
