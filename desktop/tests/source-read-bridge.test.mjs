import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';

test('native read admission reflects genuine private captures, owner pause and access revocation without creating writes',async()=>{
  const f=await sourceReadFixture(),grant=f.registry.capture(f.event(0)),id=f.refs[0].sourceId;
  assert.equal(f.owner.canRead(grant,id),true);
  assert.equal(f.owner.canRead({...grant},id),false);assert.equal(f.owner.canRead(grant,f.refs[1].sourceId),false);
  f.owner.pause('prepare native source readers');assert.equal(f.owner.canRead(grant,id),false);
  f.owner.resume();assert.equal(f.owner.canRead(grant,id),true);
  f.lock();assert.equal(f.owner.canRead(grant,id),false);assert.equal(f.factories(),0);
});

test('production reads require an explicit selected version and cannot disclose a newer unselected draft',async()=>{
  const f=await sourceReadFixture(),ref=f.refs[0];
  const edited=await f.sources.applyEdit({projectId:f.selected.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'private-newer-draft',start:0,end:0,insertedText:'PRIVATE_FUTURE_VERSION'}});
  assert.equal(edited.ok,true);
  assert.equal((await f.invoke('getMetrics',{sourceId:ref.sourceId})).code,'REQUEST_REFUSED');
  assert.equal((await f.invoke('getMetrics',{sourceId:ref.sourceId,version:2})).code,'ACCESS_REFUSED');
  assert.equal((await f.invoke('readRange',{sourceId:ref.sourceId,version:2,start:0,end:5})).code,'ACCESS_REFUSED');
  assert.equal((await f.invoke('getMetrics',{sourceId:ref.sourceId,version:1})).sha256,ref.sha256);
});

test('native Code reads exact versioned bytes and metrics without project, Docs or another source content',async()=>{
  const f=await sourceReadFixture(),ref=f.refs[0];
  const metrics=await f.invoke('getMetrics',{sourceId:ref.sourceId,version:1});assert.equal(metrics.ok,true);assert.equal(metrics.sha256,ref.sha256);
  const range=await f.invoke('readRange',{sourceId:ref.sourceId,version:1,start:0,end:metrics.utf16Units});assert.equal(range.ok,true);assert.equal(range.text,'exact 😀\r\n');
  assert.equal(JSON.stringify({metrics,range}).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);assert.equal(JSON.stringify({metrics,range}).includes(f.selected.json),false);
  assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('write and unknown methods are refused before obtaining any native source repository',async()=>{
  const f=await sourceReadFixture();for(const method of ['applyEdit','commitSource','exportSource','readProject',null])assert.equal((await f.invoke(method,{sourceId:f.refs[0].sourceId})).code,'REQUEST_REFUSED');
  assert.equal(f.factories(),0);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('Docs, copied same-URL sender, subframe, foreign source and locked callers cannot read native source bytes',async()=>{
  const f=await sourceReadFixture(),payload={sourceId:f.refs[0].sourceId,version:1};
  assert.equal((await f.invoke('getMetrics',payload,f.event(1))).code,'ACCESS_REFUSED');
  assert.equal((await f.invoke('getMetrics',payload,{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame})).code,'ACCESS_REFUSED');
  assert.equal((await f.invoke('getMetrics',payload,{sender:f.event(0).sender,senderFrame:{url:f.event(0).senderFrame.url}})).code,'ACCESS_REFUSED');
  assert.equal((await f.invoke('getMetrics',{sourceId:f.refs[1].sourceId,version:1})).code,'ACCESS_REFUSED');assert.equal(f.factories(),0);
  f.lock();assert.equal((await f.invoke('getMetrics',payload)).code,'ACCESS_REFUSED');assert.equal(f.factories(),0);
});
test('Home cannot reuse the workspace role to obtain source data and malformed payloads cannot evaluate accessors',async()=>{
  const f=await sourceReadFixture();const event=f.event(0);event.sender.mainFrame.url='siren://app/home.html';
  assert.equal((await f.invoke('getMetrics',{sourceId:f.refs[0].sourceId,version:1},event)).code,'ACCESS_REFUSED');
  event.sender.mainFrame.url='siren://app/windows/code.html?windowId='+f.registry.listViews()[0].windowId;
  let ran=false;const payload={};Object.defineProperty(payload,'sourceId',{enumerable:true,get:()=>{ran=true;return f.refs[0].sourceId;}});
  assert.equal((await f.invoke('getMetrics',payload)).code,'REQUEST_REFUSED');assert.equal(ran,false);assert.equal(f.factories(),0);
});
test('read bridge obeys owner pause and cannot lift a transition fence',async()=>{
  const f=await sourceReadFixture();f.owner.pause('native Lock preparation');
  assert.equal((await f.invoke('getMetrics',{sourceId:f.refs[0].sourceId,version:1})).code,'WORKSPACE_PAUSED');assert.equal(f.factories(),0);
  assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
