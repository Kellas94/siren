import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('ordinary Docs Save preserves Undo and Redo against the newly saved baseline',async()=>{
 const code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8'),window={};vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder});
 const original={id:'saved-history',title:'Before',blocks:[{id:'body',kind:'text',text:'Exact original body'}],agent:{future:'preserved'},releases:[{verdict:'historic'}]};let saved=structuredClone(original),revision=1;
 const draft=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document:original,version:'1'.repeat(64),sha256:fingerprint(original),projectRevision:revision},bridge:{applyDocument:async request=>{
  assert.equal(request.action,'replace-content');assert.equal(request.expectedVersion,String(revision).repeat(64));saved={...saved,...structuredClone(request.payload)};revision++;return {ok:true,domain:'docs',entityId:original.id,operationId:request.operationId,version:String(revision).repeat(64),sha256:fingerprint(saved),projectRevision:revision,durability:'committed'};
 }}});
 const next=draft.getContent();next.title='After';next.blocks[0].text='Edited body';assert.equal(draft.setContent(next).ok,true);assert.equal((await draft.save()).ok,true);assert.equal(draft.getStatus().dirty,false);
 assert.equal(draft.getStatus().canUndo,true);assert.equal(draft.undo().ok,true);assert.deepEqual(draft.getContent(),{title:original.title,blocks:original.blocks});assert.equal(draft.getStatus().dirty,true);assert.equal(saved.title,'After');
 assert.equal(draft.redo().ok,true);assert.equal(draft.getContent().title,'After');assert.equal(draft.getStatus().dirty,false);assert.deepEqual(draft.getDocument().agent,original.agent);assert.deepEqual(draft.getDocument().releases,original.releases);
 assert.equal(draft.undo().ok,true);assert.equal((await draft.save()).ok,true);assert.equal(saved.title,'Before');assert.equal(saved.blocks[0].text,'Exact original body');assert.equal(draft.getStatus().canRedo,true);
});

test('local Docs history groups typing, preserves original blocks and metadata, and refuses paused or uncertain edits',async()=>{
 const code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8'),window={};let time=100;
 vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder,Date:{now:()=>time}});
 const document={id:'history-doc',title:'Original',agent:{author:'Original author'},releases:[{verdict:'not-run'}],blocks:[{id:'opaque',kind:'unknown',html:'<custom data-keep="exact">Ș😀</custom>'}]};
 const own=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:fingerprint(document),projectRevision:1},bridge:{applyDocument:async()=>({ok:false,code:'DOCUMENT_CONFLICT'})}});
 own.setContent({title:'A',blocks:document.blocks},{historyGroup:'title'});time+=20;own.setContent({title:'AB',blocks:document.blocks},{historyGroup:'title'});
 assert.equal(own.getStatus().canUndo,true);assert.equal(own.undo().ok,true);assert.equal(own.getContent().title,'Original');assert.equal(own.getStatus().dirty,false);
 assert.equal(own.redo().ok,true);assert.equal(own.getContent().title,'AB');assert.deepEqual(own.getDocument().agent,document.agent);assert.deepEqual(own.getDocument().releases,document.releases);assert.deepEqual(own.getContent().blocks,document.blocks);
 time+=1500;own.setContent({title:'ABC',blocks:document.blocks},{historyGroup:'title'});own.undo();assert.equal(own.getContent().title,'AB');own.setContent({title:'Different',blocks:document.blocks});assert.equal(own.getStatus().canRedo,false);
 const preparing=own.flushView();assert.equal(own.undo().ok,false);await preparing;assert.equal(own.getStatus().fenced,true);own.resumeView();assert.equal(own.undo().ok,false);assert.equal(own.getContent().title,'Different');
});

test('Docs history stays bounded for large content and resets when a clean view adopts an external saved document',async()=>{
 const code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8'),window={};vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder});
 const document={id:'large-history',title:'Original',blocks:[]},context={ok:true,readonly:false,document,version:'1'.repeat(64),sha256:fingerprint(document),projectRevision:1};
 const own=window.SirenNativeDocsDraft.create({context,bridge:{}});
 for(let i=0;i<80;i++)own.setContent({title:String(i),blocks:[]});let count=0;while(own.undo().ok)count++;assert.equal(count,60);
 own.setContent({title:'Huge',blocks:[{id:'large',kind:'text',html:'x'.repeat(3*1024*1024)}]});assert.equal(own.getStatus().canUndo,false);assert.equal(own.getStatus().historyLimited,true);assert.equal(own.getContent().blocks[0].html.length,3*1024*1024);
 const external={...document,title:'External'},receipt={...context,document:external,version:'2'.repeat(64),sha256:fingerprint(external),projectRevision:2};
 const clean=window.SirenNativeDocsDraft.create({context,bridge:{getDocument:async()=>receipt,flushDocument:async request=>({ok:true,domain:'docs',entityId:document.id,version:request.expectedVersion,sha256:receipt.sha256,projectRevision:2,durability:'committed'})}});
 clean.setContent({title:'Temporary',blocks:[]});clean.setContent({title:'Original',blocks:[]});assert.equal(clean.getStatus().canUndo,true);assert.equal((await clean.flushView()).ok,true);clean.resumeView();assert.equal(clean.getContent().title,'External');assert.equal(clean.getStatus().canUndo,false);
 const locked=window.SirenNativeDocsDraft.create({context:{...context,readonly:true},bridge:{}});assert.equal(locked.undo().ok,false);assert.equal(locked.redo().ok,false);
});
test('Docs rejects a well-shaped save receipt with the wrong complete entity hash and fences uncertain commit exceptions',async()=>{
 const code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8');
 for(const fault of ['hash','transport']){
  const window={};vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder});const document={id:'doc-a',title:'Original',agent:{keep:'Exact'},blocks:[]};
  const own=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:fingerprint(document),projectRevision:2},operationId:()=> 'exact-doc-op',bridge:{applyDocument:async request=>{if(fault==='transport')throw Error('Unknown commit');return {ok:true,domain:'docs',entityId:'doc-a',version:'2'.repeat(64),sha256:'0'.repeat(64),projectRevision:3,operationId:request.operationId,durability:'committed'};}}});
  own.setContent({title:'Exact local',blocks:[]});assert.equal((await own.save()).ok,false);assert.equal(own.getStatus().fenced,true);assert.equal(own.getStatus().dirty,true);assert.equal(own.getContent().title,'Exact local');
 }
});
test('clean Docs preparation can recapture one concurrent saved document; dirty conflict never adopts someone else’s text or retries a mutation',async()=>{
 const window={},code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8');vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder});let reads=0,flushes=0;const document={id:'doc-a',title:'Original',agent:{keep:'Exact'},blocks:[]},latest=()=>({...document,title:'Saved '+reads});
 const own=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:fingerprint(document),projectRevision:2},bridge:{getDocument:async()=>{reads++;const value=latest();return {ok:true,readonly:false,document:value,version:String(reads+1).repeat(64),sha256:fingerprint(value),projectRevision:reads+2};},flushDocument:async request=>++flushes===1?{ok:false,code:'DOCUMENT_CONFLICT'}:{ok:true,domain:'docs',entityId:'doc-a',version:request.expectedVersion,sha256:fingerprint(latest()),projectRevision:reads+2,durability:'committed'}}});
 assert.equal((await own.flushView()).ok,true);assert.equal(reads,2);assert.equal(own.getContent().title,'Saved 2');assert.equal(own.getStatus().dirty,false);
});
async function fixture({refusal,wrongReceipt,wait}={}){
 const window={},code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});let serial=0,flushes=0;const calls=[];
 vm.runInNewContext(code,{window,structuredClone,crypto:webcrypto,TextEncoder});assert.equal(typeof window.SirenNativeDocsDraft?.create,'function','Docs draft controller must exist');
 const document={id:'doc-a',title:'Original',agent:{keep:'Exact'},releases:[{id:'historic',verdict:'original'}],blocks:[{id:'heading-a',kind:'heading',level:2,text:'Old'}]};
 let savedDocument=document;
 const controller=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:'a'.repeat(64),projectRevision:2},operationId:()=>`operation-${++serial}`,onChange:()=>{},
  bridge:{applyDocument:async request=>{calls.push(structuredClone(request));if(wait)await wait;if(refusal)return {ok:false,code:refusal};savedDocument={...document,...request.payload};return {ok:true,domain:'docs',entityId:wrongReceipt?'doc-b':'doc-a',version:'2'.repeat(64),sha256:fingerprint(savedDocument),projectRevision:3,operationId:request.operationId,durability:'committed'};},flushDocument:async request=>{flushes++;return {ok:true,domain:'docs',entityId:request.entityId,version:request.expectedVersion,sha256:fingerprint(savedDocument),projectRevision:3,durability:'committed'};}}});
 return {document,controller,calls,flushes:()=>flushes};
}
test('Docs draft changes only local title/blocks; explicit atomic save binds exact document/version and preserves metadata',async()=>{
 const f=await fixture(),content={title:'Edited',blocks:[{id:'new-a',kind:'text',html:'<p>Exact 😀</p>'}]};assert.equal(f.controller.setContent(content).ok,true);assert.equal(f.calls.length,0);assert.equal(f.document.title,'Original');
 const saved=await f.controller.save();assert.equal(saved.ok,true);assert.equal(f.calls.length,1);const request=f.calls[0];assert.equal(request.documentId,'doc-a');assert.equal(request.expectedVersion,'1'.repeat(64));assert.equal(request.action,'replace-content');assert.deepEqual(request.payload,content);assert.equal(Object.hasOwn(request,'agent'),false);assert.equal(Object.hasOwn(request,'projectId'),false);
 const actual=f.controller.getDocument();assert.deepEqual(actual,{...f.document,...content});assert.equal(f.controller.getStatus().dirty,false);
});
test('conflicting or fabricated Docs acknowledgement retains exact local text and does not invent saved success',async()=>{
 for(const options of [{refusal:'DOCUMENT_CONFLICT'},{wrongReceipt:true}]){
  const f=await fixture(options),content={title:'Local retained',blocks:[{id:'local-a',kind:'heading',level:2,text:'Do not drop 😀'}]};f.controller.setContent(content);
  const result=await f.controller.save();assert.equal(result.ok,false);assert.equal(f.controller.getStatus().dirty,true);assert.equal(f.controller.getStatus().fenced,true);assert.deepEqual(f.controller.getContent(),content);assert.equal((await f.controller.flushView()).ok,false);assert.equal(f.flushes(),0);f.controller.resumeView();assert.deepEqual(f.controller.getContent(),content);
 }
});
test('Docs finite prepare pauses input, saves unsaved content and flushes its actual latest token before success',async()=>{
 const f=await fixture();f.controller.setContent({title:'Save on Lock',blocks:f.document.blocks});const result=await f.controller.flushView();assert.equal(result.ok,true);assert.equal(f.calls.length,1);assert.equal(f.flushes(),1);assert.equal(f.controller.getStatus().paused,true);assert.equal(f.controller.setContent({title:'Too late',blocks:[]}).ok,false);assert.equal(f.controller.resumeView().ok,true);assert.equal(f.controller.getStatus().paused,false);
});
test('native rollback during a pending save releases the pause without admitting edits or dropping refused local text',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve),f=await fixture({wait,refusal:'ACCESS_REFUSED'}),content={title:'Retained after timeout',blocks:f.document.blocks};
 f.controller.setContent(content);const preparing=f.controller.flushView();assert.equal(f.controller.getStatus().pending,true);assert.equal(f.controller.getStatus().paused,true);
 assert.equal(f.controller.resumeView().ok,true);assert.equal(f.controller.getStatus().paused,false);assert.equal(f.controller.getStatus().pending,true);assert.equal(f.controller.setContent({title:'Late typing',blocks:[]}).ok,false);
 release();assert.equal((await preparing).ok,false);assert.equal(f.controller.getStatus().pending,false);assert.equal(f.controller.getStatus().paused,false);assert.equal(f.controller.getStatus().dirty,true);assert.equal(f.controller.getStatus().fenced,true);assert.deepEqual(f.controller.getContent(),content);assert.equal(f.flushes(),0);
});
