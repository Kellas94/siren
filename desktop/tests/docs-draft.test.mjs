import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
async function fixture({refusal,wrongReceipt,wait}={}){
 const window={},code=await readFile(new URL('../src/ui/docs/draft.js',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});let serial=0,flushes=0;const calls=[];
 vm.runInNewContext(code,{window,structuredClone});assert.equal(typeof window.SirenNativeDocsDraft?.create,'function','Docs draft controller must exist');
 const document={id:'doc-a',title:'Original',agent:{keep:'Exact'},releases:[{id:'historic',verdict:'original'}],blocks:[{id:'heading-a',kind:'heading',level:2,text:'Old'}]};
 const controller=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document,version:'1'.repeat(64),sha256:'a'.repeat(64),projectRevision:2},operationId:()=>`operation-${++serial}`,onChange:()=>{},
  bridge:{applyDocument:async request=>{calls.push(structuredClone(request));if(wait)await wait;return refusal?{ok:false,code:refusal}:{ok:true,domain:'docs',entityId:wrongReceipt?'doc-b':'doc-a',version:'2'.repeat(64),sha256:'b'.repeat(64),projectRevision:3,operationId:request.operationId,durability:'committed'};},flushDocument:async request=>{flushes++;return {ok:true,domain:'docs',entityId:request.entityId,version:request.expectedVersion,sha256:'b'.repeat(64),projectRevision:3,durability:'committed'};}}});
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
