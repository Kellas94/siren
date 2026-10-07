import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';import{createHash,webcrypto}from'node:crypto';import * as model from '../src/documents/context.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function draft({readonly=false,conflict=false}={}){
 // The VM stands in for an IPC realm; normalize fixture values through the
 // same structured-clone boundary instead of weakening plain-object admission.
 const window={SirenDocumentContext:Object.fromEntries(['applyDocumentContext','documentContextDelta'].map(key=>[key,(...args)=>model[key](...args.map(v=>structuredClone(v)))]))},code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8');vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder,Date});
 const document={id:'doc-a',title:'Original',owner:'Old',agent:{platform:'old',future:{keep:'Exact'}},comments:[{text:'human'}],releases:[{hash:'original'}],blocks:[]},calls=[];
 const own=window.SirenNativeDocsDraft.create({context:{ok:true,readonly,document,version:'1'.repeat(64),sha256:hash(document),projectRevision:2},operationId:()=> 'context-op',bridge:{applyDocument:async r=>{calls.push(structuredClone(r));if(conflict)return {ok:false,code:'DOCUMENT_CONFLICT'};const expected={...document,title:r.payload.title,owner:'New',agent:{...document.agent,platform:'Python'},blocks:r.payload.blocks};return {ok:true,domain:'docs',entityId:'doc-a',version:'2'.repeat(64),sha256:hash(expected),projectRevision:3,durability:'committed',operationId:r.operationId};}}});return {own,document,calls};
}
test('body and context share history and one exact save acknowledgement with preserved provenance',async()=>{
 const f=await draft();assert.equal(typeof f.own.setContext,'function');assert.equal(f.own.setContext({owner:'New',agent:{platform:'Python'}}).ok,true);const content=f.own.getContent();content.title='Combined';f.own.setContent(content);assert.equal(f.calls.length,0);
 assert.equal(f.own.undo().ok,true);assert.equal(f.own.getDocument().title,'Original');assert.equal(f.own.getDocument().owner,'New');assert.equal(f.own.redo().ok,true);
 assert.equal((await f.own.save()).ok,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'replace-context-content');assert.deepEqual(f.calls[0].payload.context,{owner:'New',agent:{platform:'Python'}});assert.equal(f.own.getStatus().dirty,false);assert.equal(f.own.getStatus().canUndo,false,'Saved partial context establishes an explicit new history baseline');assert.deepEqual(f.own.getDocument().releases,f.document.releases);assert.deepEqual(f.own.getDocument().agent.future,f.document.agent.future);
});
test('returning context to original clears dirtiness; readonly and conflicting views cannot mutate or falsely save',async()=>{
 const f=await draft();assert.equal(typeof f.own.setContext,'function');f.own.setContext({owner:'Temporary'});f.own.setContext({owner:'Old'});assert.equal(f.own.getStatus().dirty,false);assert.equal((await f.own.save()).unchanged,true);assert.equal(f.calls.length,0);
 const read=await draft({readonly:true});assert.equal(read.own.setContext({owner:'New'}).ok,false);
 const bad=await draft({conflict:true});bad.own.setContext({owner:'New',agent:{platform:'Python'}});assert.equal((await bad.own.save()).ok,false);assert.equal(bad.own.getStatus().fenced,true);assert.equal(bad.own.getDocument().owner,'New');assert.equal(bad.own.getStatus().dirty,true);assert.equal(bad.own.setContext({owner:'Overwrite'}).ok,false);
});
