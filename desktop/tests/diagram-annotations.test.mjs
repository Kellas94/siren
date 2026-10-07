import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createDiagramMetadataContract} from '../src/documents/diagram-metadata.mjs';
const script=await readFile(new URL('../src/ui/diagram/annotations.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
function fixture({readonly=false,strictTextarea=false,diagram:initial={},onEdit:edit}={}){
 class Element {
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attrs={};this.dataset={};this.style={};this.hidden=false;this.isConnected=true;this.value='';this.textContent='';if(strictTextarea&&this.tagName==='TEXTAREA')Object.defineProperty(this,'type',{get:()=> 'textarea'});}
  append(...items){for(const child of items){child.parentElement=this;this.children.push(child);}}
  replaceChildren(...items){this.children=[];this.append(...items);}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.isConnected=false;}
  contains(node){return this===node||this.children.some(c=>c.contains?.(node));}addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]??[]).filter(x=>x!==fn);}
  setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}focus(){document.activeElement=this;}
  querySelectorAll(selector){const all=[];const walk=n=>{for(const c of n.children){all.push(c);walk(c);}};walk(this);return selector==='text'?all.filter(x=>x.tagName==='TEXT'):selector==='tspan.text-outer-tspan'?all.filter(x=>x.tagName==='TSPAN'&&x.attrs.class==='text-outer-tspan'):all;}
 }
 const document={head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag),activeElement:null},window={SirenDiagramMetadata:createDiagramMetadataContract()},status=[],edits=[],projection=[];
 // Finite CSS adapter for unit tests only. Genuine computed-style precedence
 // and rendering remain native acceptance, not established by this stand-in.
 const getComputedStyle=node=>{let opacity=String(node.opacity??1);if(!node.ignoreProjection&&node.style.getPropertyPriority?.('opacity')!=='important'){
   const parts=[];let item=node;while(item.parentElement&&item.tagName!=='SVG'){parts.unshift('>:nth-child('+(item.parentElement.children.indexOf(item)+1)+')');item=item.parentElement;}const selector='#diagramCanvas>svg'+parts.join('');
   for(const style of document.head.children)for(const rule of style.textContent.split('\n'))if(rule.startsWith(selector+'{'))opacity=rule.slice((selector+'{opacity:').length).split('!')[0];
  }return {opacity};};
 vm.runInNewContext(script,{window,document,getComputedStyle,structuredClone});
 assert.equal(typeof window.SirenNativeDiagramAnnotations?.create,'function','actual annotations controller must exist');
 const inspectorHost=new Element(),filtersHost=new Element(),inspectorButton=new Element('button'),filtersButton=new Element('button');let diagram={id:'D',source:'flowchart TD\nA-->B',...structuredClone(initial)},enabled=true,paused=false;
 let diagramReads=0;const view=window.SirenNativeDiagramAnnotations.create({inspectorHost,filtersHost,inspectorButton,filtersButton,diagramFor:()=>{diagramReads++;return structuredClone(diagram);},readonlyFor:()=>readonly,editable:()=>!readonly&&!paused,enabled:()=>enabled,onEdit:value=>{edits.push(structuredClone(value));if(edit)return edit(value);diagram.nodeMetadata??={};diagram.nodeMetadata[value.id]={...(diagram.nodeMetadata[value.id]??{}),...value.changes};return {ok:true};},onStatus:value=>status.push(value),onPending(){},onProjectionChange:()=>projection.push(true)});
 const canvas=new Element();canvas.id='diagramCanvas';const svg=new Element('svg');canvas.append(svg);const a=new Element('g'),b=new Element('g'),c=new Element('g');a.textContent='Început Ș 😀';b.textContent='Next';c.textContent='End';svg.append(a,b,c);
 const targets=[{id:'A',groups:[a]},{id:'B',groups:[b]},{id:'C',groups:[c]}];view.bind(svg,targets);
 const all=()=>[...inspectorHost.querySelectorAll('*'),...filtersHost.querySelectorAll('*')],field=id=>all().find(x=>x.id===id),fire=(node,type,event={})=>{const actual={target:node,button:0,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...event};for(const fn of node.listeners[type]??[])fn(actual);return actual;},input=(name,value)=>{const node=field('diagramMetadata_'+name);node.value=value;fire(node,'input');return node;};
 const serialize=node=>JSON.stringify({tag:node.tagName,attrs:node.attrs,text:node.textContent,children:node.children.map(serialize)});
 return {view,field,fire,input,svg,a,b,c,targets,document,Element,inspectorHost,filtersHost,inspectorButton,filtersButton,status,edits,projection,serialize,diagram:()=>diagram,diagramReads:()=>diagramReads,setEnabled:value=>enabled=value,setPaused:value=>paused=value};
}
test('pending metadata survives repaint/invalidation/Lock rollback and guard never autoapplies',()=>{
 const f=fixture();f.fire(f.inspectorButton,'click');f.input('owner','pending owner');assert.equal(f.view.guard(),false);assert.equal(f.edits.length,0);assert.match(f.status.at(-1),/Apply.*Cancel/i);
 f.view.paint();f.view.invalidate();f.view.pause();f.view.resume();f.view.bind(f.svg,f.targets);assert.equal(f.field('diagramMetadata_owner').value,'pending owner');assert.equal(f.view.isEditing(),true);assert.equal(f.view.select('B'),false);assert.equal(f.field('diagramInspectorTarget').value,'A');
 f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.edits.length,1);assert.equal(f.edits[0].id,'A');assert.equal(f.edits[0].changes.owner,'pending owner');assert.equal(f.view.isEditing(),false);
});
test('Apply rejection retains exact invalid field and Cancel restores saved values',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'saved'}}},onEdit:()=>({ok:false,code:'METADATA_REFUSED'})});f.fire(f.inspectorButton,'click');f.input('owner','x'.repeat(101));f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.view.isEditing(),true);assert.equal(f.field('diagramMetadata_owner').value.length,101);assert.equal(f.edits.length,0,'strict field validation precedes edit delegation');
 f.input('owner','valid');f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.edits.length,1);assert.equal(f.field('diagramMetadata_owner').value,'valid');assert.equal(f.view.guard(),false);f.fire(f.field('diagramInspectorCancel'),'click');assert.equal(f.view.isEditing(),false);assert.equal(f.field('diagramMetadata_owner').value,'saved');
});
test('readonly inspection does not delegate edits and unsupported imported values remain inert',()=>{
 const raw={nodeMetadata:{A:{owner:{sourceRef:{sourceId:'source-a',version:1,sha256:'a'.repeat(64)}},status:'foreign',reference:'javascript:alert(1)'}}};const f=fixture({readonly:true,diagram:raw});f.fire(f.inspectorButton,'click');assert.equal(f.field('diagramMetadata_owner').disabled,true);assert.match(f.field('diagramInspectorNotice').textContent,/retained|unsupported/i);assert.equal(f.field('diagramMetadata_reference').value,'javascript:alert(1)');assert.equal(f.view.guard(),true);f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.edits.length,0);assert.deepEqual(f.diagram().nodeMetadata,raw.nodeMetadata);
});
test('facets use exact Unicode values, AND across fields, OR within fields; reset preserves SVG and project',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'Ș 😀',status:'draft'},B:{owner:'Ș 😀',status:'approved'},C:{owner:'Other',status:'approved'}},nodeClasses:{A:'class1',B:'class2'}}});const before=f.serialize(f.svg),saved=JSON.stringify(f.diagram());f.fire(f.filtersButton,'click');
 const choose=(field,value,checked=true)=>{const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterField===field&&x.dataset.filterValue===value);assert.ok(checkbox,field+value);checkbox.checked=checked;f.fire(checkbox,'change');};
 choose('owner','Ș 😀');assert.match(f.field('diagramFilterSummary').textContent,/2 \/ 3/);choose('status','approved');assert.match(f.field('diagramFilterSummary').textContent,/1 \/ 3/);choose('owner','Other');assert.match(f.field('diagramFilterSummary').textContent,/2 \/ 3/);choose('class','class1');assert.match(f.field('diagramFilterSummary').textContent,/0 \/ 3/);assert.match(f.field('diagramFilterSummary').textContent,/No matches/);assert.ok(f.document.head.children.some(n=>n.textContent.includes('opacity:')));assert.equal(f.serialize(f.svg),before);assert.equal(JSON.stringify(f.diagram()),saved);assert.equal(f.edits.length,0);
 f.fire(f.field('diagramFilterReset'),'click');assert.match(f.field('diagramFilterSummary').textContent,/3 \/ 3/);assert.equal(f.document.head.children.length,0);assert.equal(f.serialize(f.svg),before);
});
test('projection uses numeric child paths, preserves source opacity, deduplicates nested unmatched groups',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'show'},B:{owner:'hide'},C:{owner:'hide'}}}});f.b.children=[];f.b.append(f.c);f.svg.children=f.svg.children.filter(x=>x!==f.c);f.b.opacity=.5;f.view.bind(f.svg,f.targets);const before=f.serialize(f.svg);f.fire(f.filtersButton,'click');const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterField==='owner'&&x.dataset.filterValue==='show');checkbox.checked=true;f.fire(checkbox,'change');const css=f.document.head.children[0].textContent;assert.equal((css.match(/opacity:/g)||[]).length,1);assert.match(css,/opacity:0\.08/);assert.match(css,/:nth-child\(2\)/);assert.equal(f.serialize(f.svg),before);f.view.invalidate();assert.equal(f.document.head.children.length,0);
});
test('unmatched semantic container with matching descendant is retained as context and reported',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'hide'},B:{owner:'show'},C:{owner:'hide'}}}});f.a.append(f.b);f.svg.children=f.svg.children.filter(x=>x!==f.b);f.view.bind(f.svg,f.targets);f.fire(f.filtersButton,'click');const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterField==='owner'&&x.dataset.filterValue==='show');checkbox.checked=true;f.fire(checkbox,'change');assert.match(f.field('diagramFilterSummary').textContent,/context|partial/i);assert.equal((f.document.head.children[0].textContent.match(/opacity:/g)||[]).length,1);
});
test('target cap and eight-group cap are truthful, stale/disconnected groups cannot be edited',()=>{
 const f=fixture(),targets=Array.from({length:251},(_,i)=>{const group=new f.Element('g');f.svg.append(group);return {id:'N'+i,groups:Array(9).fill(group)};});f.view.bind(f.svg,targets);assert.equal(f.field('diagramInspectorTarget').children.length,250);assert.match(f.field('diagramInspectorNotice').textContent,/250|limited/i);assert.equal(f.view.select('N250'),false);f.view.invalidate();assert.equal(f.view.select('N0'),false);assert.equal(f.inspectorButton.disabled,true);assert.equal(f.filtersButton.disabled,true);
});
test('toolbar pointerdown preserves active editor focus; pending selection/closing refuses',()=>{
 const f=fixture(),external=new f.Element('input');external.focus();const event=f.fire(f.inspectorButton,'pointerdown');assert.equal(event.defaultPrevented,true);assert.equal(f.document.activeElement,external);f.fire(f.inspectorButton,'click');f.input('risk','pending');f.fire(f.inspectorButton,'click');assert.equal(f.inspectorHost.hidden,false);assert.equal(f.view.isEditing(),true);f.view.cancel();assert.equal(f.view.guard(),true);
});
test('local filters and selections isolate between controller instances and dispose removes only owned CSS',()=>{
 const raw={nodeMetadata:{A:{owner:'first'},B:{owner:'second'},C:{owner:'second'}}},f=fixture({diagram:raw}),other=fixture({diagram:raw});f.fire(f.filtersButton,'click');const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterValue==='first');checkbox.checked=true;f.fire(checkbox,'change');assert.equal(other.document.head.children.length,0);assert.equal(other.filtersButton.textContent,'Filters');f.view.dispose();assert.equal(f.document.head.children.length,0);assert.equal(f.view.select('A'),false);assert.equal(f.inspectorHost.children.length,0);
});
test('excluded long semantic IDs and protected inline opacity are reported as partial coverage',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'show'},B:{owner:'hide'},C:{owner:'hide'}}}});f.b.style.getPropertyPriority=key=>key==='opacity'?'important':'';f.view.bind(f.svg,[...f.targets,{id:'X'.repeat(201),groups:[f.c]}]);assert.match(f.field('diagramInspectorNotice').textContent,/limited/i);f.fire(f.filtersButton,'click');const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterValue==='show');checkbox.checked=true;f.fire(checkbox,'change');assert.match(f.field('diagramFilterSummary').textContent,/Partial dimming: 1/);assert.equal((f.document.head.children[0].textContent.match(/opacity:/g)||[]).length,1);
});
test('computed readback reports author-stylesheet precedence instead of claiming all unmatched groups dim',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:'show'},B:{owner:'hide'},C:{owner:'hide'}}}});f.b.ignoreProjection=true;f.fire(f.filtersButton,'click');const checkbox=f.filtersHost.querySelectorAll('*').find(x=>x.dataset.filterValue==='show');checkbox.checked=true;f.fire(checkbox,'change');assert.match(f.field('diagramFilterSummary').textContent,/Partial dimming: 1/);assert.equal((f.document.head.children[0].textContent.match(/opacity:/g)||[]).length,2);
});
test('a repaint captures the potentially large diagram once, not once per facet value',()=>{
 const f=fixture(),before=f.diagramReads();f.view.paint();assert.equal(f.diagramReads()-before,1);
});
test('unsupported retained managed fields are immutable while valid fields on the same node remain editable',()=>{
 const f=fixture({diagram:{nodeMetadata:{A:{owner:{sourceRef:{sourceId:'S',version:1,sha256:'a'.repeat(64)}},status:'foreign',system:'valid'}}}});f.fire(f.inspectorButton,'click');assert.equal(f.field('diagramMetadata_owner').disabled,true);assert.equal(f.field('diagramMetadata_status').disabled,true);assert.equal(f.field('diagramMetadata_system').disabled,false);assert.match(f.field('diagramInspectorNotice').textContent,/retained unchanged; cannot edit here/);f.input('owner','replacement');assert.equal(f.view.isEditing(),false);f.input('system','new');f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.edits.length,1);assert.deepEqual(Object.keys(f.edits[0].changes),['system']);
});
test('disabled retained overlength values have bounded previews without rewriting the saved value',()=>{
 const raw='x'.repeat(10000),f=fixture({diagram:{nodeMetadata:{A:{owner:raw}}}});f.fire(f.inspectorButton,'click');assert.equal(f.field('diagramMetadata_owner').value.length,100);assert.match(f.field('diagramInspectorNotice').textContent,/shortened preview/i);assert.equal(f.diagram().nodeMetadata.A.owner,raw);assert.equal(f.edits.length,0);
});
test('working context with another editor pending is not mislabelled read only',()=>{
 const f=fixture();f.setPaused(true);f.view.paint();assert.match(f.field('diagramInspectorNotice').textContent,/Working annotations/);assert.match(f.field('diagramInspectorNotice').textContent,/Finish or cancel pending editor/);assert.doesNotMatch(f.field('diagramInspectorNotice').textContent,/Read only/);assert.equal(f.field('diagramMetadata_owner').disabled,true);
});

test('native textarea type is getter-only; Evidence mounts and preserves multiline input',()=>{const f=fixture({strictTextarea:true});f.fire(f.inspectorButton,'click');const evidence=f.input('evidence','line one\nȘ😀 line two');assert.equal(evidence.type,'textarea');assert.equal(evidence.value,'line one\nȘ😀 line two');f.fire(f.field('diagramInspectorApply'),'click');assert.equal(f.edits[0].changes.evidence,'line one\nȘ😀 line two');});

test('actual style adapter cap discloses admitted coverage even when upstream already truncated 251 IDs',async()=>{const f=fixture(),appearance={nodes:new Map()},groups=[];for(let i=0;i<251;i++){const g=new f.Element('g');g.setAttribute('data-id','N'+i);f.svg.append(g);groups.push(g);appearance.nodes.set('N'+i,{});}const style=await readFile(new URL('../src/ui/diagram/style.js',import.meta.url),'utf8'),scope={root:{querySelectorAll:()=>groups,getAttribute:()=>null},appearance};vm.runInNewContext(style.slice(0,style.indexOf('async function prepareStyle'))+'\nglobalThis.targets=styleTargets(root,appearance);',scope);assert.equal(scope.targets.length,250);f.view.bind(f.svg,scope.targets);assert.equal(f.field('diagramInspectorTarget').children.length,250);assert.equal(f.view.select('N250'),false);assert.match(f.field('diagramInspectorNotice').textContent,/limited/i);assert.match(f.field('diagramFilterSummary').textContent,/limited/i);});
