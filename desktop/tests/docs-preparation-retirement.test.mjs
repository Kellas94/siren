import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {fixture,deferred,waitFor} from './helpers/docs-functional-continuity-fixture.mjs';

// First regression independently reproduced by capability_libraries_research.
// Check the actual subsequent Save, not only the textarea still on screen.
test('resumed Docs edits survive a previously authorized read whose hash completes late',async()=>{
 const original=webcrypto.subtle.digest,entered=deferred(),release=deferred();let hold=false,f;
 webcrypto.subtle.digest=async function(...args){const value=await Reflect.apply(original,this,args);if(hold){entered.resolve();await release.promise;}return value;};
 try{
  f=await fixture();hold=true;f.setFlush(async()=>({ok:false,code:'ACCESS_REFUSED'}));
  const preparing=f.prepare();await entered.promise;f.resume();f.edit('heading-a','Keep the accepted edit Ș😀');
  hold=false;release.resolve();assert.equal((await preparing).ok,false);assert.equal(f.flushes,0,'retired preparation must not start another flush');
  f.elements.saveDocument.emit();await waitFor(()=>f.writes===1&&f.document.body.dataset.documentDirty==='false');
  assert.equal(f.saved.blocks.find(b=>b.id==='heading-a').text,'Keep the accepted edit Ș😀');
 }finally{hold=false;release.resolve();webcrypto.subtle.digest=original;f?.events.beforeunload();}
});

test('a clean read reply arriving after rollback cannot overwrite accepted edits or dispatch a flush',async()=>{
 const f=await fixture(),read=f.holdRead(),reply=f.read();
 try{
  const preparing=f.prepare();await waitFor(()=>f.reads===2);f.resume();f.edit('heading-a','Typed after rollback');
  read.resolve(reply);assert.equal((await preparing).ok,false);assert.equal(f.flushes,0);assert.equal(f.writes,0);
  f.releaseReads();f.elements.saveDocument.emit();await waitFor(()=>f.writes===1&&f.document.body.dataset.documentDirty==='false');
  assert.equal(f.saved.blocks.find(b=>b.id==='heading-a').text,'Typed after rollback');
 }finally{read.resolve(reply);f.events.beforeunload();}
});

test('rollback while export is pausing cannot start a new draft preparation afterward',async()=>{
 const entered=deferred(),release=deferred(),f=await fixture({pauseExport:async()=>{entered.resolve();await release.promise;}});
 try{
  const preparing=f.prepare();await entered.promise;f.resume();f.edit('heading-a','Work after cancelled preparation');
  release.resolve();assert.equal((await preparing).ok,false);assert.equal(f.writes,0,'no late apply request');assert.equal(f.flushes,0,'no late flush request');
  assert.equal(f.input('heading-a').disabled,false);assert.equal(f.document.body.dataset.documentDirty,'true');
  f.elements.saveDocument.emit();await waitFor(()=>f.writes===1&&f.document.body.dataset.documentDirty==='false');
  assert.equal(f.saved.blocks.find(b=>b.id==='heading-a').text,'Work after cancelled preparation');
 }finally{release.resolve();f.events.beforeunload();}
});

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function draftFixture(bridge,crypto=webcrypto){
 const window={},document={id:'preparation-draft',title:'Original',blocks:[]};
 runInNewContext(await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8'),{window,structuredClone,crypto,TextEncoder});
 return {document,draft:window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:hash(document),projectRevision:1},bridge})};
}

test('a newer preparation remains authoritative when an older clean read completes during its pause',async()=>{
 const old=deferred();let reads=0,flushes=0,document;
 const response=(title,revision)=>{const value={...document,title};return {ok:true,readonly:false,document:value,version:String(revision).repeat(64),sha256:hash(value),projectRevision:revision};};
 const f=await draftFixture({getDocument:()=>++reads===1?old.promise:Promise.resolve(response('Current saved version',3)),flushDocument:async request=>{flushes++;return {ok:true,domain:'docs',entityId:document.id,version:request.expectedVersion,sha256:hash({...document,title:'Current saved version'}),projectRevision:3,durability:'committed'};}});document=f.document;
 try{
  const stale=f.draft.flushView();f.draft.resumeView();assert.equal((await f.draft.flushView()).ok,true);
  old.resolve(response('Stale saved version',2));assert.equal((await stale).ok,false);
  assert.equal(f.draft.getDocument().title,'Current saved version');assert.equal(f.draft.getStatus().paused,true);assert.equal(flushes,1);
 }finally{old.resolve(response('Stale saved version',2));f.draft.dispose();}
});

test('rollback during a durability fingerprint cannot turn the retired preparation into success',async()=>{
 const entered=deferred(),release=deferred();let document;
 const crypto={subtle:{digest:async(...args)=>{const result=await webcrypto.subtle.digest(...args);entered.resolve();await release.promise;return result;}},randomUUID:()=>webcrypto.randomUUID()};
 const f=await draftFixture({flushDocument:async request=>({ok:true,domain:'docs',entityId:document.id,version:request.expectedVersion,sha256:hash(document),projectRevision:1,durability:'committed'})},crypto);document=f.document;
 try{const preparing=f.draft.flushView();await entered.promise;f.draft.resumeView();release.resolve();assert.equal((await preparing).ok,false);assert.equal(f.draft.getStatus().paused,false);}finally{release.resolve();f.draft.dispose();}
});

test('disposing a clean preparation during read preserves the retired view and sends no later flush',async()=>{
 const held=deferred();let flushes=0;const f=await draftFixture({getDocument:()=>held.promise,flushDocument:async()=>{flushes++;return {ok:false};}});
 const preparing=f.draft.flushView();f.draft.dispose();held.resolve({ok:true,readonly:false,document:f.document,version:'1'.repeat(64),sha256:hash(f.document),projectRevision:1});
 assert.equal((await preparing).ok,false);assert.equal(f.draft.getStatus().disposed,true);assert.equal(flushes,0);
});
