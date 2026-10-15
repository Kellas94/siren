import test from 'node:test';
import assert from 'node:assert/strict';
import {docsFixture,deferred,tick} from './helpers/docs-present-source-fixtures.mjs';

// Break caught: an old open action mutates a covered/resumed or replaced Docs
// lifetime. Exercise both actual click callers, with unchanged production JS.
for(const [button,method]of [['openWorkingDocument','openWorkingCopy'],['reviewLatestDocument','openLatest']]){
 test(`${method}: current transport rejection is handled and explained`,async()=>{
  const f=await docsFixture();f.window.sirenDocsEdit[method]=async()=>{throw Error('Inert current open rejection');};f.nodes.get(button).emit();await tick();
  assert.match(f.nodes.get('viewStatus').textContent,/could not be opened/i);assert.equal(f.document.body.dataset.documentReady,'true');
 });
 for(const outcome of ['refusal','rejection'])test(`${method}: cover retires a pending ${outcome} before prepare finishes`,async()=>{
  const f=await docsFixture(),held=deferred();f.window.sirenDocsEdit[method]=()=>held.promise;f.nodes.get(button).emit();
  const preparation=f.prepare(),coveredStatus=f.nodes.get('viewStatus').textContent;
  if(outcome==='rejection')held.reject(Error('Inert open transport rejection'));else held.resolve({ok:false,code:'ACCESS_REFUSED'});
  await tick();assert.equal(f.nodes.get('viewStatus').textContent,coveredStatus);assert.equal((await preparation).ok,true);
  f.resume();assert.equal(f.nodes.get('viewStatus').textContent,coveredStatus);assert.equal(f.document.body.inert,false);
 });
 test(`${method}: a pre-cover refusal cannot overwrite resumed status`,async()=>{
  const f=await docsFixture(),held=deferred();f.window.sirenDocsEdit[method]=()=>held.promise;f.nodes.get(button).emit();assert.equal((await f.prepare()).ok,true);f.resume();
  const before=f.nodes.get('viewStatus').textContent;held.resolve({ok:false});await tick();assert.equal(f.nodes.get('viewStatus').textContent,before);
 });
 test(`${method}: Refresh invalidates the old document action and permits a fresh action`,async()=>{
  const f=await docsFixture(),held=deferred();f.window.sirenDocsEdit[method]=()=>held.promise;f.nodes.get(button).emit();assert.equal(await f.window.sirenNativeDocsView.connect(),true);
  const before=f.nodes.get('viewStatus').textContent;held.resolve({ok:false});await tick();assert.equal(f.nodes.get('viewStatus').textContent,before);
  f.window.sirenDocsEdit[method]=async()=>({ok:false});f.nodes.get(button).emit();await tick();assert.match(f.nodes.get('viewStatus').textContent,/could not be opened/i);
 });
 test(`${method}: disposal retires the pending action`,async()=>{
  const f=await docsFixture(),held=deferred();f.window.sirenDocsEdit[method]=()=>held.promise;f.nodes.get(button).emit();f.events.beforeunload();
  const before=f.nodes.get('viewStatus').textContent;held.resolve({ok:false});await tick();assert.equal(f.nodes.get('viewStatus').textContent,before);
 });
 test(`${method}: duplicate clicks do not create overlapping open actions`,async()=>{
  const f=await docsFixture(),held=deferred();let calls=0;f.window.sirenDocsEdit[method]=()=>{calls++;return held.promise;};f.nodes.get(button).emit();f.nodes.get(button).emit();assert.equal(calls,1);held.resolve({ok:true});await tick();
  f.nodes.get(button).emit();assert.equal(calls,2);await tick();
 });
 test(`${method}: the unknown action keeps its guard through resume until actual settlement`,async()=>{
  const f=await docsFixture(),held=deferred();let calls=0;f.window.sirenDocsEdit[method]=()=>{calls++;return held.promise;};f.nodes.get(button).emit();await f.prepare();f.resume();
  f.nodes.get(button).emit();assert.equal(calls,1);held.resolve({ok:false});await tick();f.window.sirenDocsEdit[method]=async()=>{calls++;return {ok:false};};f.nodes.get(button).emit();await tick();assert.equal(calls,2);assert.match(f.nodes.get('viewStatus').textContent,/could not be opened/i);
 });
}
