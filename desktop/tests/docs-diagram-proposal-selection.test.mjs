import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../src/ui/docs/diagram-embeds.js',import.meta.url),'utf8');
const hash='a'.repeat(64),changedHash='c'.repeat(64);
function fixture({ids=['A','C'],sourceHash=hash}={}){
 const elements=[],calls=[];let context={documentId:'doc-a',version:'b'.repeat(64),dirty:false,readonly:false,blocks:[]};
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.isConnected=true;this.textContent='';elements.push(this);}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this[key]=value;}addEventListener(key,callback){this.listeners[key]=callback;}
  emit(key='click'){return this.listeners[key]?.({preventDefault(){}});}
  showModal(){this.open=true;}close(){this.open=false;this.emit('close');}
  remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
  focus(){}
 }
 const document={createElement:tag=>new Element(tag),body:new Element('body')},window={};
 const api=Object.fromEntries(['getProposal','listDiagrams','inspectSelection','preview','insert'].map(method=>[method,async payload=>{
  calls.push({method,payload:structuredClone(payload)});
  if(method==='getProposal')return{ok:true,proposal:{diagramId:'flow-a',scope:'selection',nodeIds:['A','C'],sourceHash:hash}};
  if(method==='listDiagrams')return{ok:true,items:[{id:'flow-a',label:'Flow'}]};
  if(method==='inspectSelection')return{ok:true,nodes:ids.map(id=>({id,label:'Step '+id})),sourceHash};
  if(method==='preview')return{ok:true,previewId:'reviewed-preview',sourceHash,visual:{kind:'svg',base64:'PHN2Zy8+'},boundary:[]};
  return{ok:true};
 }]));
 runInNewContext(source,{window,document,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},TextEncoder,setTimeout,clearTimeout});
 const view=window.createDiagramEmbedView({api,getContext:()=>context});
 return{view,calls,elements,find:(action,id)=>elements.find(e=>e.dataset.embedAction===action&&(!id||e.dataset.embedId===id)),text:()=>elements.map(e=>e.textContent).join(' ')};
}
async function offered(options){const f=fixture(options);await f.view.offerProposal();await f.view.drain();return f;}
const previews=f=>f.calls.filter(c=>c.method==='preview');

test('missing transferred steps stay visible and cannot silently shrink the proposed selection',async()=>{
 const f=await offered({ids:['A','B'],sourceHash:changedHash});try{
  const missing=f.find('missing-node','C');assert.ok(missing,'Missing C must remain visible');assert.equal(missing.checked,true);assert.equal(missing.disabled,true);
  assert.equal(f.find('select-node','A').checked,true);assert.equal(f.find('preview').disabled,true);assert.match(f.text(),/missing.*C|C.*missing/i);
  f.find('preview').emit();f.find('confirm-insert').emit();await f.view.drain();assert.equal(previews(f).length,0);assert.equal(f.calls.some(c=>c.method==='insert'),false);
 }finally{f.view.dispose();}
});
test('only explicit review acknowledges omitted steps before previewing the remaining IDs',async()=>{
 const f=await offered({ids:['A','B'],sourceHash:changedHash});try{
  const review=f.find('review-selection');assert.ok(review);assert.equal(review.hidden,false);assert.equal(review.disabled,false);review.emit();
  assert.equal(f.find('preview').disabled,false);f.find('preview').emit();await f.view.drain();assert.deepEqual(previews(f)[0].payload,{diagramId:'flow-a',scope:'selection',nodeIds:['A']});
  assert.equal(f.calls.some(c=>c.method==='insert'),false);f.find('confirm-insert').emit();await f.view.drain();assert.equal(f.calls.at(-1).method,'insert');assert.equal(f.calls.at(-1).payload.previewId,'reviewed-preview');
 }finally{f.view.dispose();}
});
test('a changed source with all IDs still present requires review and retains every requested ID',async()=>{
 const f=await offered({sourceHash:changedHash});try{
  assert.equal(f.find('preview').disabled,true);assert.match(f.text(),/changed/i);f.find('preview').emit();await f.view.drain();assert.equal(previews(f).length,0);
  f.find('review-selection').emit();f.find('preview').emit();await f.view.drain();assert.deepEqual(previews(f)[0].payload.nodeIds,['A','C']);
 }finally{f.view.dispose();}
});
test('all missing steps require an explicit new choice before review can enable preview',async()=>{
 const f=await offered({ids:['B'],sourceHash:changedHash});try{
  assert.equal(f.find('review-selection').disabled,true);f.find('review-selection').emit();f.find('preview').emit();await f.view.drain();assert.equal(previews(f).length,0);
  const node=f.find('select-node','B');node.checked=true;node.emit('change');assert.equal(f.find('preview').disabled,true);assert.equal(f.find('review-selection').disabled,false);
  f.find('review-selection').emit();f.find('preview').emit();await f.view.drain();assert.deepEqual(previews(f)[0].payload.nodeIds,['B']);
 }finally{f.view.dispose();}
});
test('unchanged transfer keeps its full selection ready for normal explicit preview',async()=>{
 const f=await offered();try{
  assert.equal(f.find('preview').disabled,false);f.find('preview').emit();await f.view.drain();assert.deepEqual(previews(f)[0].payload.nodeIds,['A','C']);assert.equal(f.calls.some(c=>c.method==='insert'),false);
 }finally{f.view.dispose();}
});
test('whole diagram is an explicit alternative and drops the incomplete selection only after the scope choice',async()=>{
 const f=await offered({ids:['A','B'],sourceHash:changedHash});try{
  const scope=f.find('choose-scope');scope.value='whole';scope.emit('change');assert.equal(f.find('preview').disabled,false);
  f.find('preview').emit();await f.view.drain();assert.deepEqual(previews(f)[0].payload,{diagramId:'flow-a',scope:'whole',nodeIds:[]});
 }finally{f.view.dispose();}
});
test('retired picker review and preview callbacks cannot run after Lock and resume',async()=>{
 const f=await offered({ids:['A','B'],sourceHash:changedHash});try{
  const review=f.find('review-selection');assert.ok(review);await f.view.pause();f.view.resume();review.emit();f.find('preview').emit();await f.view.drain();assert.equal(previews(f).length,0);assert.equal(f.calls.some(c=>c.method==='insert'),false);
 }finally{f.view.dispose();}
});
