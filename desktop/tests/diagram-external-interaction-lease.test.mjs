import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto,createHash} from 'node:crypto';
import {parseFragment} from 'parse5';
import {buildDiagramGuided} from '../build/diagram-guided.mjs';
import {buildDiagramStyle} from '../build/diagram-style.mjs';
const guided=(await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)})).script;
const style=(await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)})).script;
const [guidedView,styleView,draftScript]=await Promise.all(['guided-view.js','style-view.js','draft.js'].map(name=>readFile(new URL('../src/ui/diagram/'+name,import.meta.url),'utf8')));
function dom(){
 const document={activeElement:null};
 class E{children=[];dataset={};listeners={};value='';attrs={};disabled=false;selectionStart=0;selectionEnd=0;selectionDirection='none';
  set innerHTML(value){this.value=parseFragment('<textarea>'+value+'</textarea>').childNodes[0]?.childNodes[0]?.value??'';}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(){for(const node of this.children)node.parent=null;this.children=[];}
  replaceWith(node){const at=this.parent.children.indexOf(this);node.parent=this.parent;this.parent.children[at]=node;this.parent=null;}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  setAttribute(key,value){this.attrs[key]=String(value);} removeAttribute(key){delete this.attrs[key];}
  addEventListener(key,run){(this.listeners[key]??=[]).push(run);}
  emit(type,props={}){for(const run of this.listeners[type]??[])run({type,target:this,preventDefault(){},...props});}
  focus(){const previous=document.activeElement;document.activeElement=this;if(previous!==this)previous?.emit('blur');}
  select(){this.setSelectionRange(0,this.value.length,'none');}
  setSelectionRange(start,end,direction='none'){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}
  querySelector(selector){const match=/^\[data-line="(\d+)"\]\[data-field="(\w+)"\]$/.exec(selector);return match?all(this).find(node=>node.dataset.line===match[1]&&node.dataset.field===match[2]):null;}
 }
 document.createElement=()=>new E();document.createTextNode=text=>({textContent:text});const all=node=>[node,...(node.children??[]).flatMap(all)];
 return{document,host:new E(),outside:new E(),all};
}
function fixture(kind){
 const d=dom(),window={};vm.runInNewContext(guided+'\n'+style+'\n'+draftScript+'\n'+guidedView+'\n'+styleView,{window,document:d.document,crypto:webcrypto,structuredClone,TextEncoder});
 const diagram={id:'a',source:'flowchart TD\nA[Original]-->B\nstyle A fill:#ff3366',fontSize:18,nodeStyles:{A:{fill:'#ff3366'}},sirenNativeVersion:1};
 const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram,version:1,sha256:createHash('sha256').update(JSON.stringify(diagram)).digest('hex')},bridge:{}});
 let context={},editable=true;const messages=[],controller=kind==='guided'?window.SirenNativeGuidedView.create({host:d.host,sourceFor:()=>draft.getDiagram().source,contextFor:()=>context,editable:()=>editable,onSource:value=>draft.setSource(value).ok,onStatus:value=>messages.push(value)}):window.SirenNativeDiagramStyleView.create({host:d.host,diagramFor:draft.getDiagram,contextFor:()=>context,editable:()=>editable,onStyle:draft.setStyle,onStatus:value=>messages.push(value)});
 if(kind==='guided')controller.paint();else controller.setTargets([{id:'A',protected:{}}]);
 const field=(id)=>d.all(d.host).find(node=>node.id===id),edit=(value,{invalid=false}={})=>{let input;if(kind==='guided'){d.all(d.host).find(node=>node.dataset.line==='1'&&node.dataset.field===(invalid?'fromId':'fromLabel')).emit('click');input=d.document.activeElement;}else{input=field('diagramStyleSize');input.focus();}input.value=value;if(kind==='style')input.emit('input');input.setSelectionRange(1,2,'backward');return input;};
 return{...d,controller,draft,field,edit,messages,setContext:()=>context={},setEditable:value=>editable=value};
}
// Break caught: focus into an external disclosure must not implicitly mutate real draft/history.
for(const kind of ['guided','style']){
 test(kind+' lease retains valid pending DOM/value/selection and restores before release',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'Pending context':'20'),before=JSON.stringify(f.draft.getDiagram()),state=JSON.stringify(f.draft.getStatus()),history=JSON.stringify(f.draft.getHistory());
  const lease=f.controller.beginExternalInteraction();assert.ok(lease);assert.equal(f.controller.beginExternalInteraction(),lease);f.outside.focus();input.emit('change');f.controller.paint();
  assert.equal(JSON.stringify(f.draft.getDiagram()),before);assert.equal(JSON.stringify(f.draft.getStatus()),state);assert.equal(JSON.stringify(f.draft.getHistory()),history);assert.ok(f.host.contains(input));assert.equal(input.value,kind==='guided'?'Pending context':'20');assert.equal(f.controller.isEditing(),true);
  assert.equal(lease.restore(),true);assert.equal(f.document.activeElement,input);assert.deepEqual([input.selectionStart,input.selectionEnd,input.selectionDirection],[1,2,'backward']);assert.equal(lease.restore(),false);assert.notEqual(f.controller.beginExternalInteraction(),lease);
 });
 test(kind+' lease retains invalid error and explicit prepare commit still refuses',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'bad id':'200',{invalid:true});assert.equal(f.controller.commit(),false);assert.equal(input.attrs['aria-invalid'],'true');input.focus();const lease=f.controller.beginExternalInteraction();f.outside.focus();input.emit('change');
  assert.equal(input.attrs['aria-invalid'],'true');assert.ok(f.host.contains(input));assert.equal(lease.restore(),true);assert.equal(f.controller.commit(),false);assert.equal(input.attrs['aria-invalid'],'true');assert.equal(f.draft.getStatus().dirty,false);
 });
 test(kind+' explicit commit applies exactly once while leased and retire never applies',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'Explicit':'20'),lease=f.controller.beginExternalInteraction();f.outside.focus();assert.equal(f.controller.commit(),true);assert.equal(f.controller.isEditing(),false);assert.equal(lease.restore(),false);assert.equal(f.draft.getStatus().dirty,true);const before=JSON.stringify(f.draft.getDiagram());lease.retire();lease.retire();input.emit('blur');assert.equal(JSON.stringify(f.draft.getDiagram()),before);
 });
 test(kind+' changed context/source and disposed controller never restore old focus',()=>{
  for(const stale of ['context','source','dispose']){const f=fixture(kind),input=f.edit(kind==='guided'?'Private pending':'20'),lease=f.controller.beginExternalInteraction();f.outside.focus();if(stale==='context')f.setContext();else if(stale==='source')f.draft.setSource('flowchart TD\nX-->Y');else f.controller.dispose();const before=JSON.stringify(f.draft.getDiagram());assert.equal(lease.restore(),false);assert.equal(f.document.activeElement,f.outside);assert.equal(JSON.stringify(f.draft.getDiagram()),before);lease.retire();if(stale==='dispose')assert.equal(f.controller.beginExternalInteraction(),null);else assert.ok(f.host.contains(input));}
 });
 test(kind+' actual composition lifecycle refuses acquisition and commit until completion',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'Composing':'20');input.emit('compositionstart');assert.equal(f.controller.beginExternalInteraction(),null);assert.equal(f.controller.commit(),false);assert.equal(f.draft.getStatus().dirty,false);input.emit('compositionend');assert.ok(f.controller.beginExternalInteraction());assert.equal(f.controller.commit(),true);
 });
}
test('Guided choice change is suspended but explicit Escape cancels with no draft mutation',()=>{
 const f=fixture('guided');f.all(f.host).find(node=>node.dataset.line==='0'&&node.dataset.field==='direction').emit('click');const input=f.document.activeElement,lease=f.controller.beginExternalInteraction();input.value='LR';f.outside.focus();input.emit('change');assert.equal(f.draft.getStatus().dirty,false);input.emit('keydown',{key:'Escape'});assert.equal(f.controller.isEditing(),false);assert.equal(lease.restore(),false);assert.equal(f.draft.getStatus().dirty,false);
});
test('Style target and colour changes during lease cannot apply pending text or mutate colours',()=>{
 const f=fixture('style'),input=f.edit('20'),lease=f.controller.beginExternalInteraction(),before=JSON.stringify(f.draft.getDiagram());f.outside.focus();f.field('diagramStyleTarget').emit('change');f.field('diagramStyle_fill').value='#123456';f.field('diagramStyle_fill').emit('change');assert.equal(JSON.stringify(f.draft.getDiagram()),before);assert.equal(input.value,'20');assert.equal(lease.restore(),true);assert.equal(f.controller.commit(),true);assert.equal(f.draft.getDiagram().nodeStyles.A.fill,'#ff3366');
});
test('disposed Guided field cannot apply retained private input through a late blur',()=>{
 const f=fixture('guided'),input=f.edit('Late private value'),lease=f.controller.beginExternalInteraction();f.outside.focus();f.controller.dispose();const before=JSON.stringify(f.draft.getDiagram());lease.retire();input.emit('blur');input.emit('keydown',{key:'Enter'});assert.equal(JSON.stringify(f.draft.getDiagram()),before);assert.equal(f.draft.getStatus().dirty,false);
});
for(const kind of ['guided','style'])test(kind+' suspended private or disabled field refuses restoration without focus',()=>{
 for(const hidden of ['inert','visibility','disabled']){const f=fixture(kind),input=f.edit(kind==='guided'?'Pending':'20'),lease=f.controller.beginExternalInteraction();f.outside.focus();if(hidden==='inert')f.document.body={inert:true};else if(hidden==='visibility')f.document.documentElement={style:{visibility:'hidden'}};else input.disabled=true;assert.equal(lease.restore(),false);assert.equal(f.document.activeElement,f.outside);assert.equal(f.draft.getStatus().dirty,false);}
});
test('Style repaint during external focus cannot replace live colour preview or field error DOM',()=>{
 const f=fixture('style'),input=f.edit('200');assert.equal(f.controller.commit(),false);input.focus();const color=f.field('diagramStyle_fill');color.value='#123456';const lease=f.controller.beginExternalInteraction();f.outside.focus();f.controller.paint();assert.equal(color.value,'#123456');assert.equal(input.attrs['aria-invalid'],'true');assert.equal(input.value,'200');assert.equal(lease.restore(),true);assert.equal(f.controller.commit(),false);assert.equal(f.draft.getDiagram().nodeStyles.A.fill,'#ff3366');
});
for(const kind of ['guided','style']){
 test(kind+' equal-source replacement cannot apply retained pending input after refused lease restoration',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'OLD_PRIVATE_CONTEXT':'20'),lease=f.controller.beginExternalInteraction();f.outside.focus();f.setContext();const source=JSON.stringify(f.draft.getDiagram()),history=JSON.stringify(f.draft.getHistory()),value=input.value;
  assert.equal(lease.restore(),false);input.emit(kind==='guided'?'blur':'change');assert.equal(JSON.stringify(f.draft.getDiagram()),source);assert.equal(JSON.stringify(f.draft.getHistory()),history);assert.equal(f.document.activeElement,f.outside);assert.equal(input.value,value);assert.ok(f.host.contains(input));
 });
 test(kind+' explicit commit and repaint refuse old private fields in equal-source replacement context',()=>{
  const f=fixture(kind),input=f.edit(kind==='guided'?'OLD_EXPLICIT_CONTEXT':'20'),lease=f.controller.beginExternalInteraction();f.outside.focus();f.setContext();assert.equal(lease.restore(),false);const source=JSON.stringify(f.draft.getDiagram()),history=JSON.stringify(f.draft.getHistory()),value=input.value;
  assert.equal(f.controller.commit(),false);f.controller.paint();input.emit('keydown',{key:'Escape'});assert.equal(JSON.stringify(f.draft.getDiagram()),source);assert.equal(JSON.stringify(f.draft.getHistory()),history);assert.equal(f.document.activeElement,f.outside);assert.equal(input.value,value);assert.ok(f.host.contains(input));assert.equal(f.controller.beginExternalInteraction(),null);
 });
}
