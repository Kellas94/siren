import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/ui/windows/code.js',import.meta.url),'utf8');
const ref={sourceId:'source-b',version:2,sha256:'b'.repeat(64)};
const held=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
async function fixture(){
 const noop=()=>{},nodes=new Map(),events={},callbacks={},selected=[];let current=null,claims=0,claimResult={ok:true};
 class Element{dataset={};style={};children=[];classList={toggle:noop};append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}addEventListener(name,fn){events[name]=fn;}removeEventListener(){}remove(){}}
 const document={body:new Element(),documentElement:new Element(),createElement:()=>new Element(),getElementById:id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}};document.getElementById('codeTheme').value='light';
 const client=()=>({getMetrics:async()=>({ok:true,utf8Bytes:10,utf16Units:10,lines:1}),subscribeSource:()=>noop,dispose:noop});
 const editors=[];const api={sourceClient:client,createCodeEditor(){let state={ready:true,sourceRef:{...ref},paused:false};const editor={open:async()=>({ok:true}),getStatus:()=>state,getState:()=>({doc:{length:10},selection:{main:{anchor:0,head:0}}}),select:(from,to)=>selected.push([from,to]),focus:noop,setTheme:noop,subscribe:()=>noop,pauseView:()=>{state.paused=true;return {ok:true};},flushView:async()=>{state.paused=true;return {ok:true};},resumeView:()=>{state.paused=false;return {ok:true};},resumeRefresh:()=>({ok:true}),dispose:()=>state.disposed=true,set:value=>state={...state,...value}};editors.push(editor);current=editor;return editor;}};
 const participant=()=>({reset:noop,reconcile:noop,pause:noop,resume:noop,dispose:noop});
 const window={SirenNativeViewIdentity:{clear:noop,set:noop},SirenNativeDocsLinks:{create:participant},SirenNativeSourceChanges:{create:participant},SirenNativeAnalysis:{create:participant},sirenSourceRead:{getReference:async()=>({ok:true,readonly:true,sourceRef:{...ref}})},sirenSource:{},sirenSourceEdit:{onReferenceChanged:()=>noop},sirenSourceAnalysis:{onComparisonReveal:callback=>{callbacks.reveal=callback;return()=>callbacks.unsubscribed=true;}},sirenViewControl:{onPrepare:callback=>callbacks.prepare=callback,onResume:callback=>callbacks.resume=callback},addEventListener:(name,callback)=>callbacks[name]=callback,confirm:()=>true};
 vm.runInNewContext(source,{window,document,SirenCodeEditor:api,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop})});assert.equal(await window.sirenNativeCodeView.connect(),true);
 const ticket={sourceRef:{...ref},range:{from:2,to:7}};
 return {window,document,callbacks,selected,editors,ticket,editor:()=>current,claims:()=>claims,claim:value=>claimResult=value,reveal:()=>{assert.equal(typeof callbacks.reveal,'function','actual Code receiver must subscribe');return callbacks.reveal(ticket,()=>{claims++;return claimResult;});}};
}
test('full Code controller selects exact clean saved B only after an actual claim',async()=>{const f=await fixture();assert.equal((await f.reveal()).ok,true);assert.deepEqual(f.selected,[[2,7]]);assert.equal(f.claims(),1);});
test('dirty, pending, saving, fenced, stale or out-of-bounds B refuses before claim',async()=>{
 for(const cause of ['dirty','pending','saving','fenced','stale','bounds']){const f=await fixture();if(cause==='stale')f.editor().set({sourceRef:{...ref,version:3}});else if(cause==='bounds')f.ticket.range.to=11;else f.editor().set({[cause]:true});assert.equal((await f.reveal()).ok,false,cause);assert.equal(f.claims(),0,cause);assert.equal(f.selected.length,0);}
});
test('Lock and rollback while claim is held cannot revive the old request',async()=>{const f=await fixture(),gate=held();f.claim(gate.promise);const pending=f.reveal();assert.equal(f.claims(),1);await f.callbacks.prepare();f.callbacks.resume();gate.resolve({ok:true});assert.equal((await pending).ok,false);assert.equal(f.selected.length,0);});
test('replacement, disposal and claim refusal never select a retired editor',async()=>{
 for(const cause of ['replacement','dispose','refuse']){const f=await fixture(),gate=held();f.claim(gate.promise);const pending=f.reveal();if(cause==='replacement')await f.window.sirenNativeCodeView.connect();if(cause==='dispose')f.callbacks.beforeunload();gate.resolve({ok:cause!=='refuse'});assert.equal((await pending).ok,false,cause);assert.equal(f.selected.length,0,cause);}
});
