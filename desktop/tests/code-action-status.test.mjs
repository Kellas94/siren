import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{runInNewContext}from'node:vm';
const code=await readFile(new URL('../src/ui/windows/code.js',import.meta.url),'utf8');
function fixture(){
 const marker='unsubscribeEditor=ownEditor.subscribe(',start=code.indexOf(marker),end=code.indexOf('});sourceChanges.reconcile();analysis?.reconcile();',start);assert.ok(start>=0&&end>start,'Execute the actual Code subscriber');
 const ownEditor={},status={textContent:''},document={body:{dataset:{}}},context={status,document,window:{SirenNativeViewIdentity:{set(){}}},nativeSourceName:'Owned.py',ownEditor,editor:ownEditor,token:1,generation:1,disposed:false,paused:false,readonly:false,sourceSummary:null,sourceChanges:{reconcile(){}},analysis:{reconcile(){}}};
 const notify=runInNewContext('('+code.slice(start+marker.length,end+1)+')',context);
 const state={ready:true,sourceRef:{sourceId:'owned-source',version:3,sha256:'a'.repeat(64)},dirty:false,pending:false,utf8Bytes:100,utf16Units:90,lines:4};return {notify,state,status,document,context};
}
test('unchanged editor notifications cannot erase the completed Docs link result',()=>{
 const f=fixture();f.notify(f.state);f.status.textContent='Docs now links source version 3.';
 for(let i=0;i<4;i++)f.notify({...f.state,sourceRef:{...f.state.sourceRef}});
 assert.equal(f.status.textContent,'Docs now links source version 3.');assert.equal(f.document.body.dataset.sourceVersion,'3');
});
test('actual new draft metrics and new stored version replace old action feedback',()=>{
 const f=fixture();f.notify(f.state);f.status.textContent='Docs now links source version 3.';
 f.notify({...f.state,dirty:true,utf8Bytes:104,utf16Units:92,lines:5});assert.match(f.status.textContent,/Stored version 3 · Local draft · 104 bytes · 5 lines/);
 f.notify({...f.state,sourceRef:{...f.state.sourceRef,version:4,sha256:'b'.repeat(64)},utf8Bytes:104,utf16Units:92,lines:5});assert.match(f.status.textContent,/Stored version 4/);assert.equal(f.status.textContent.includes('Docs now links'),false);assert.equal(f.document.body.dataset.sourceSha256,'b'.repeat(64));
});
test('paused disposed and stale editor callbacks cannot publish or erase status',()=>{
 for(const field of ['paused','disposed','generation','editor']){const f=fixture();f.notify(f.state);f.status.textContent='Retained result';f.context[field]=field==='generation'?2:field==='editor'?{}:true;f.notify({...f.state,dirty:true});assert.equal(f.status.textContent,'Retained result');}
});
