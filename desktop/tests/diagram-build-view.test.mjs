import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseFragment} from 'parse5';
import {buildDiagramGuided} from '../build/diagram-guided.mjs';
const script=(await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)})).script+'\n'+await readFile(new URL('../src/ui/diagram/build-view.js',import.meta.url),'utf8');
function fixture(){class Element{children=[];listeners={};value='';attrs={};disabled=false;append(child){this.children.push(child);}replaceChildren(){this.children=[];}addEventListener(type,callback){this.listeners[type]=callback;}setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}set innerHTML(value){const tree=parseFragment('<textarea>'+value+'</textarea>');this.value=tree.childNodes[0]?.childNodes[0]?.value??'';}}
 const window={},document={createElement:()=>new Element()};vm.runInNewContext(script,{window,document});let source='flowchart TD\r\nA[Start]-->B[Next]\r\nstyle A fill:#ff3366\r\n',editable=true;const host=new Element(),messages=[],changes=[];
 const view=window.SirenNativeDiagramBuildView.create({host,sourceFor:()=>source,editable:()=>editable,onSource:value=>{source=value;changes.push(value);return true;},onStatus:value=>messages.push(value)});view.setTargets([{id:'A'},{id:'B'}]);const field=id=>{const all=[];const walk=node=>{all.push(node);for(const child of node.children||[])walk(child);};walk(host);return all.find(node=>node.id===id);};return{view,field,messages,changes,source:()=>source,setSource:value=>source=value,setEditable:value=>{editable=value;view.paint();}};}
test('real Build controller selects rendered blocks, applies label/shape without automatic persistence and refuses stale fields',()=>{
 const f=fixture();assert.equal(f.view.select('B'),true);const label=f.field('diagramBuildLabel');label.value='Decision';label.listeners.input();assert.equal(f.view.commit(),true);assert.ok(f.source().includes('B["Decision"]'));assert.equal(f.changes.length,1);
 label.value='Stale draft';label.listeners.input();const saved=f.source().replace('Decision','External');f.setSource(saved);f.view.paint();assert.equal(label.value,'Stale draft');assert.equal(f.view.commit(),false);assert.equal(f.source(),saved);assert.equal(f.view.select('A'),false);label.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(label.value,'External');assert.equal(f.view.isEditing(),false);f.setEditable(false);assert.equal(label.disabled,true);assert.equal(f.view.commit(),true);
});
test('tentative Add/Connect fields refuse Lock-style commit until explicitly applied or cancelled; new blocks retain original source',()=>{
 const f=fixture(),id=f.field('diagramBuildNewId'),label=f.field('diagramBuildNewLabel');id.value='C';id.listeners.input();label.value='Review';label.listeners.input();const before=f.source();assert.equal(f.view.commit(),false);assert.equal(f.source(),before);f.field('diagramBuildAdd').listeners.click();assert.ok(f.source().startsWith(before));assert.ok(f.source().endsWith('C["Review"]\r\n'));assert.equal(f.view.isEditing(),false);
 const to=f.field('diagramBuildTo');to.value='B';to.listeners.change();assert.equal(f.view.commit(),false);f.field('diagramBuildConnect').listeners.click();assert.ok(f.source().endsWith('C --> B\r\n'));assert.equal(f.view.isEditing(),false);
});
