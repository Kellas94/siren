import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const code=await readFile(new URL('../src/ui/docs/export.js',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const nodes=[];class Node{constructor(tag){this.tagName=tag;this.listeners={};this.children=[];this.disabled=false;this.hidden=false;this.textContent='';this.value='';this.open=false;nodes.push(this);}append(...items){this.children.push(...items);}setAttribute(key,value){this[key]=value;}addEventListener(key,fn){this.listeners[key]=fn;}removeEventListener(key){delete this.listeners[key];}showModal(){this.open=true;}close(){this.open=false;}remove(){this.removed=true;}emit(key='click',event={}){return this.listeners[key]?.(event);}}
 const window={},document={createElement:tag=>new Node(tag),body:new Node('body')};runInNewContext(code,{window,document});assert.equal(typeof window.SirenNativeDocsExportView?.create,'function');
 const button=new Node('button'),revealButton=new Node('button'),messages=[],calls=[];let ready=true,context={documentId:'doc-a',version:'a'.repeat(64),sha256:'b'.repeat(64),projectRevision:7,dirty:true},answer;
 const bridge={exportSaved:async request=>{calls.push(JSON.parse(JSON.stringify(request)));return typeof answer==='function'?answer(request):answer;},revealExport:async request=>{calls.push(JSON.parse(JSON.stringify(request)));return {ok:true};}};
 const view=window.SirenNativeDocsExportView.create({button,revealButton,getContext:()=>context,isReady:()=>ready,onStatus:text=>messages.push(text),bridge});
 const byId=id=>nodes.find(n=>n.id===id),receipt=(format='html')=>({ok:true,exportId:'00000000-0000-4000-8000-000000000001',filename:'document-00000000-0000-4000-8000-000000000001.'+({html:'html',markdown:'md',json:'json'}[format]),format,bytes:123,sha256:'c'.repeat(64),entityId:'doc-a',version:'a'.repeat(64),entitySha256:'b'.repeat(64),projectRevision:7});
 return {view,button,revealButton,messages,calls,byId,nodes,receipt,answer:value=>answer=value,ready:value=>ready=value,context:value=>context=value};
}
test('Docs export picker explains dirty saved-only semantics, cancels without IPC and submits only finite expected identity',async()=>{
 const f=fixture();f.button.emit();assert.ok(f.byId('documentExportPicker').open);assert.match(f.byId('documentExportDisclosure').textContent,/unsaved/i);assert.match(f.byId('documentExportDisclosure').textContent,/references/i);f.byId('documentExportCancel').emit();assert.equal(f.calls.length,0);
 f.button.emit();f.answer(f.receipt());f.byId('documentExportConfirm').emit();await tick();assert.deepEqual(f.calls,[{format:'html',expectedVersion:'a'.repeat(64),expectedSha256:'b'.repeat(64)}]);assert.match(f.messages.at(-1),/saved/i);assert.match(f.messages.at(-1),/unsaved/i);assert.equal(f.revealButton.hidden,false);assert.equal(f.button.disabled,false);
 f.revealButton.emit();await tick();assert.deepEqual(f.calls[1],{exportId:'00000000-0000-4000-8000-000000000001'});
});
test('pending export is unique and prepare hides/joins it; late completion cannot restore receipt after resume',async()=>{
 const f=fixture();let release;f.answer(()=>new Promise(r=>release=r));f.button.emit();f.byId('documentExportConfirm').emit();await tick();f.byId('documentExportConfirm').emit();assert.equal(f.calls.length,1);assert.equal(f.button.disabled,true);
 let joined=false;const pause=f.view.pause().then(()=>joined=true);await tick();assert.equal(joined,false);assert.equal(f.byId('documentExportPicker').open,false);const messages=f.messages.length;release(f.receipt());await pause;assert.equal(f.messages.length,messages);assert.equal(f.revealButton.hidden,true);f.view.resume();assert.equal(f.button.disabled,false);assert.equal(f.revealButton.hidden,true);
});
test('stale/refused or malformed saved receipt never shows file or implies draft saved',async()=>{
 const f=fixture();for(const result of [{ok:false,code:'DOCUMENT_VERSION_CHANGED'},{...f.receipt(),version:'d'.repeat(64)},{...f.receipt(),filename:'outside.exe'}]){f.answer(result);f.button.emit();f.byId('documentExportConfirm').emit();await tick();assert.equal(f.revealButton.hidden,true);assert.doesNotMatch(f.messages.at(-1),/exported/i);}
 assert.match(f.messages.at(-1),/retained/i);
});
test('unready or disposed Docs refuses picker; disposal removes handlers and cached receipt',async()=>{
 const f=fixture();f.ready(false);f.view.update();assert.equal(f.button.disabled,true);f.button.emit();assert.equal(f.byId('documentExportPicker'),undefined);f.ready(true);f.view.update();f.answer(f.receipt());f.button.emit();f.byId('documentExportConfirm').emit();await tick();f.view.dispose();assert.equal(f.revealButton.hidden,true);assert.equal(f.button.disabled,true);const count=f.calls.length;f.button.emit();f.revealButton.emit();assert.equal(f.calls.length,count);
});
test('Enter on Cancel or format selection never triggers a saved-document export',async()=>{
 const f=fixture();f.answer(f.receipt());f.button.emit();let prevented=0;
 for(const target of [f.byId('documentExportCancel'),f.byId('documentExportFormat')]){
  f.byId('documentExportPicker').emit('keydown',{key:'Enter',target,preventDefault:()=>prevented++});await tick();assert.equal(f.calls.length,0);assert.equal(f.byId('documentExportPicker').open,true);
 }
 assert.equal(prevented,0);f.byId('documentExportCancel').emit();assert.equal(f.byId('documentExportPicker').open,false);assert.equal(f.calls.length,0);
});
