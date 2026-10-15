import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/ui/docs/diagram-embeds.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const elements=[],calls=[],held=[];
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.isConnected=true;this.textContent='';elements.push(this);}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this[key]=value;}addEventListener(key,callback){this.listeners[key]=callback;}
  emit(key='click'){if(key==='click'&&this.disabled)return false;this.listeners[key]?.({preventDefault(){}});return true;}
  showModal(){this.open=true;}close(){this.open=false;this.emit('close');}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  focus(){}
 }
 const document={createElement:tag=>new Element(tag),body:new Element('body')},window={};
 const api={listDiagrams:async()=>({ok:true,items:[{id:'flow-a',label:'A'},{id:'flow-b',label:'B'}]}),
  preview:payload=>{calls.push({method:'preview',payload:structuredClone(payload)});return new Promise((resolve,reject)=>held.push({payload,resolve,reject}));},
  insert:async payload=>{calls.push({method:'insert',payload:structuredClone(payload)});return{ok:true};}};
 runInNewContext(source,{window,document,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'}});
 const view=window.createDiagramEmbedView({api,getContext:()=>({documentId:'doc-a',version:'b'.repeat(64),dirty:false,readonly:false,blocks:[]})});
 const find=action=>elements.find(e=>e.dataset.embedAction===action);
 const select=id=>{const control=find('choose-diagram');control.value=id;control.emit('change');};
 const finish=index=>held[index].resolve({ok:true,previewId:'receipt-'+held[index].payload.diagramId,visual:{kind:'svg',base64:'PHN2Zy8+'}});
 return{view,elements,calls,held,find,select,finish};
}
async function queued(){const f=fixture();f.view.insert();await f.view.drain();f.select('flow-a');f.find('preview').emit();await tick();f.select('flow-b');f.find('preview').emit();return f;}
test('retired A preview cannot re-enable Preview while current B preview is still held',async()=>{
 const f=await queued();try{assert.equal(f.find('preview').disabled,true);assert.equal(f.held.length,1);f.finish(0);await tick();assert.equal(f.held.length,2);assert.equal(f.held[1].payload.diagramId,'flow-b');assert.equal(f.find('preview').disabled,true,'An old finally must not unlock the current in-flight preview');}
 finally{f.finish(1);await f.view.drain();f.view.dispose();}
});
test('retired A completion does not arm insertion, and current B result inserts B receipt only',async()=>{
 const f=await queued();try{f.finish(0);await tick();assert.equal(f.find('confirm-insert').disabled,true);f.find('confirm-insert').emit();assert.equal(f.calls.some(c=>c.method==='insert'),false);f.finish(1);await f.view.drain();assert.equal(f.find('confirm-insert').disabled,false);f.find('confirm-insert').emit();await f.view.drain();assert.equal(f.calls.at(-1).payload.previewId,'receipt-flow-b');}
 finally{f.view.dispose();}
});
test('settling retired A must not admit a duplicate user preview while current B is held',async()=>{
 const f=await queued();try{f.finish(0);await tick();const clicked=f.find('preview').emit();f.finish(1);await tick();if(f.held.length>2){f.finish(2);await tick();}await f.view.drain();assert.equal(clicked,false,'A disabled in-flight Preview should reject a real click');assert.equal(f.calls.filter(c=>c.method==='preview').length,2);}
 finally{f.view.dispose();}
});
test('retired A rejection cannot replace current B status while B is still held',async()=>{
 const f=await queued();try{const status=f.elements.find(e=>e.role==='status'),currentStatus=status.textContent;f.held[0].reject(Error('A render failed'));await tick();assert.equal(f.held.length,2);assert.equal(status.textContent,currentStatus,'A stale error must not label the current diagram unavailable');}
 finally{f.finish(1);await f.view.drain();f.view.dispose();}
});
test('current preview failure still explains the failure and permits an explicit retry',async()=>{
 const f=fixture();try{f.view.insert();await f.view.drain();f.select('flow-a');f.find('preview').emit();await tick();f.held[0].reject(Error('Current render failed'));await f.view.drain();assert.match(f.elements.find(e=>e.role==='status').textContent,/Preview unavailable/);assert.equal(f.find('preview').disabled,false);assert.equal(f.find('confirm-insert').disabled,true);assert.equal(f.calls.some(c=>c.method==='insert'),false);}
 finally{f.view.dispose();}
});
