import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
