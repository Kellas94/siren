import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const draftCode=await read('src/ui/diagram/draft.js'),viewCode=await read('src/ui/diagram/style-view.js'),controller=await read('src/ui/windows/diagram.js');
const marker='window.sirenViewControl.onPrepare(',start=controller.indexOf(marker)+marker.length,end=controller.indexOf(');\n window.sirenViewControl.onResume',start);assert.ok(start>=marker.length&&end>start,'Extract the exact frozen onPrepare callback, not a reimplementation');
const prepareCode=controller.slice(start,end),hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fixture(extra={}){
 class E{children=[];listeners={};value='';disabled=false;attrs={};append(...children){this.children.push(...children);}replaceChildren(){this.children=[];}addEventListener(k,v){this.listeners[k]=v;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}}
 const elements=new Map(),document={createElement:()=>new E(),createTextNode:text=>({textContent:text}),body:{inert:false,dataset:{}},documentElement:{style:{}}},window={SirenNativeDiagramStyle:{fonts:['Inter','Georgia'],weights:[400,500,600,700,800]},SirenNativeViewIdentity:{clear(){}}},context={window,document,crypto:webcrypto,structuredClone,TextEncoder,clearTimeout,paused:false,disposed:false,readonly:false,previewTimer:null,refreshTimer:null,exporting:false,exportReceipt:null,lastError:'',renderedSvg:null,renderedTargets:[],$:id=>{if(!elements.has(id))elements.set(id,new E());return elements.get(id);},retireCatalogue(){},walkthrough:{pause(){}},annotations:{guard:()=>true,pause(){}},guidedView:{commit:()=>true,pause(){}},buildView:{commit:()=>true},stop(){},splitDrag:false};
 const calls={apply:0,flush:0,pause:0};context.session={pause:async()=>{calls.pause++;return true;}};vm.createContext(context);vm.runInContext(draftCode+'\n'+viewCode,context);
 const diagram={id:'diagram-a',source:'flowchart TD\nA-->B\nstyle A fill:#ff3366',fontSize:18,...extra};
 const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:hash(diagram)},bridge:{applyDiagram:async r=>{calls.apply++;return{ok:true,domain:'diagram',entityId:diagram.id,version:r.expectedVersion+1,sha256:hash({...draft.getDiagram(),sirenNativeVersion:r.expectedVersion+1}),projectRevision:2,durability:'committed',operationId:r.operationId};},flushDiagram:async r=>{calls.flush++;return{ok:true,domain:'diagram',entityId:diagram.id,version:r.expectedVersion,sha256:hash(draft.getDiagram()),projectRevision:2,durability:'committed'};}}});context.draft=draft;
 const host=new E(),messages=[],view=window.SirenNativeDiagramStyleView.create({host,diagramFor:()=>context.draft.getDiagram(),contextFor:()=>context.draft,editable:()=>!context.paused&&!context.disposed&&!context.draft.getStatus().pending&&!context.draft.getStatus().paused,onStyle:patch=>context.draft.setStyle(patch),onStatus:m=>messages.push(m)});context.styleView=view;view.setTargets([{id:'A',protected:{fill:true}}],{layout:{supported:true,sourceOwned:false}});
 const field=id=>{let result;function walk(n){if(n.id===id)result=n;for(const child of n.children||[])walk(child);}walk(host);return result;};return{context,document,draft,view,field,calls,messages,prepare:vm.runInContext('('+prepareCode+')',context)};
}
test('independent exact controller prepare callback refuses invalid co-pending layout/font without save or flush API calls',async()=>{
 const f=fixture(),size=f.field('diagramStyleSize'),layout=f.field('diagramStyleLayout');size.value='200';size.listeners.input();layout.value='elk';layout.listeners.change();assert.equal(f.draft.getStatus().dirty,false);assert.equal(size.value,'200');assert.equal(layout.value,'elk');
 assert.deepEqual(JSON.parse(JSON.stringify(await f.prepare())),{ok:false,code:'GUIDED_EDIT_PENDING'});assert.deepEqual(f.calls,{apply:0,flush:0,pause:1});assert.equal(f.context.paused,true);assert.equal(f.document.body.inert,true);assert.equal(f.document.documentElement.style.visibility,'hidden');assert.equal(size.value,'200');assert.equal(f.view.isEditing(),true);assert.equal(Object.hasOwn(f.draft.getDiagram(),'sirenNativeLayoutEngine'),false);
});
test('independent exact controller prepare callback commits finite local choice once and flushes before admission',async()=>{
 const f=fixture(),layout=f.field('diagramStyleLayout');layout.value='dagre';layout.listeners.change();assert.deepEqual(f.calls,{apply:0,flush:0,pause:0});assert.equal(f.draft.getDiagram().sirenNativeLayoutEngine,'dagre');
 assert.equal((await f.prepare()).ok,true);assert.deepEqual(f.calls,{apply:1,flush:1,pause:1});assert.equal(f.draft.getStatus().dirty,false);assert.equal(f.draft.getStatus().version,2);assert.equal(f.draft.getStatus().paused,true);
 // Inert/paused UI cannot launch a later finite style mutation or save request.
 layout.value='elk';layout.listeners.change();assert.equal(f.draft.getDiagram().sirenNativeLayoutEngine,'dagre');assert.equal(f.calls.apply,1);
});
test('independent composition precedence refuses layout change and prepare without discarding pending input',async()=>{
 const f=fixture(),size=f.field('diagramStyleSize'),layout=f.field('diagramStyleLayout');size.listeners.compositionstart();size.value='2';size.listeners.input();layout.value='elk';layout.listeners.change();assert.equal(Object.hasOwn(f.draft.getDiagram(),'sirenNativeLayoutEngine'),false);assert.equal((await f.prepare()).ok,false);assert.equal(size.value,'2');assert.equal(f.calls.apply,0);assert.equal(f.calls.flush,0);
});
test('independent source ownership and imported opaque preference disable choice without inventing a saved fallback',()=>{
 for(const prior of ['future',null,{private:'EXACT'}]){const f=fixture({sirenNativeLayoutEngine:prior}),layout=f.field('diagramStyleLayout');assert.equal(layout.disabled,true);assert.match(layout.title,/unsupported.*unchanged/);layout.value='elk';layout.listeners.change();assert.deepEqual(f.draft.getDiagram().sirenNativeLayoutEngine,prior);assert.equal(f.draft.getStatus().dirty,false);assert.equal(f.calls.apply,0);}
 const f=fixture();f.view.setTargets([],{layout:{supported:true,sourceOwned:true}});assert.equal(f.field('diagramStyleLayout').disabled,true);assert.match(f.field('diagramStyleLayout').title,/Mermaid/);assert.equal(Object.hasOwn(f.draft.getDiagram(),'sirenNativeLayoutEngine'),false);
});
test('independent changed draft identity blocks a pending layout commit into an actual replacement draft',()=>{
 const f=fixture(),replacement=fixture(),layout=f.field('diagramStyleLayout');layout.value='elk';layout.listeners.input();const original=f.draft.getDiagram(),before=replacement.draft.getDiagram();f.context.draft=replacement.draft;assert.equal(f.view.commit(),false);assert.deepEqual(f.draft.getDiagram(),original);assert.deepEqual(replacement.draft.getDiagram(),before);assert.equal(f.calls.apply,0);assert.equal(replacement.calls.apply,0);
});
