import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseFragment} from 'parse5';
import {buildDiagramGuided} from '../build/diagram-guided.mjs';
const built=await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)}),view=await readFile(new URL('../src/ui/diagram/guided-view.js',import.meta.url),'utf8');
async function fixture(initial){
 class Element{
  children=[];dataset={};listeners={};value='';disabled=false;textContent='';
  set innerHTML(value){const tree=parseFragment('<textarea>'+value+'</textarea>');this.value=tree.childNodes[0]?.childNodes[0]?.value??'';}
  append(child){child.parent=this;this.children.push(child);}
  replaceChildren(){this.children=[];}
  replaceWith(child){const index=this.parent.children.indexOf(this);child.parent=this.parent;this.parent.children[index]=child;}
  setAttribute(name,value){this[name]=value;} addEventListener(name,callback){this.listeners[name]=callback;} focus(){} select(){}
  querySelector(){return null;}
 }
 const window={},document={createElement:()=>new Element()},host=new Element();vm.runInNewContext(built.script+'\n'+view,{window,document,TextEncoder});
 let source=initial,editable=true,accept=true;const saved=[],messages=[];
 const controller=window.SirenNativeGuidedView.create({host,sourceFor:()=>source,editable:()=>editable,onSource:value=>{if(!accept)return false;source=value;saved.push(value);return true;},onStatus:value=>messages.push(value)});
 const all=()=>{const result=[];const visit=node=>{result.push(node);node.children.forEach(visit);};visit(host);return result;};controller.paint();
 return {controller,host,all,saved,messages,source:()=>source,setSource:value=>source=value,setEditable:value=>editable=value,setAccept:value=>accept=value,chip:(line,field)=>all().find(node=>node.dataset.line===String(line)&&node.dataset.field===field)};
}
test('real Guided controller retains invalid, stale and refused fields across repaint/pause; Escape cancels without changing source',async()=>{
 const original='flowchart TD\nA[Original]-->B\nstyle A fill:#ff3366';
 for(const failure of ['invalid','stale','refused']){
  const f=await fixture(original);f.chip(1,'fromId').listeners.click();const input=f.all().find(node=>node.dataset.guidedInput==='fromId');input.value=failure==='invalid'?'bad id':'Valid';
  if(failure==='stale')f.setSource(original.replace('Original','External'));if(failure==='refused')f.setAccept(false);
  const expected=f.source();assert.equal(f.controller.commit(),false);assert.equal(input['aria-invalid'],'true');assert.match(input.title,/Esc to cancel/);assert.equal(f.controller.isEditing(),true);f.controller.paint();f.controller.pause();assert.ok(f.all().includes(input));assert.equal(input.value,failure==='invalid'?'bad id':'Valid');assert.equal(f.source(),expected);assert.equal(f.saved.length,0);
  input.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(f.controller.isEditing(),false);assert.equal(f.source(),expected);assert.ok(!f.all().includes(input));
 }
});
test('actual Guided inline field commits once and preserves every other line; readonly never opens an editor',async()=>{
 const original='flowchart TD\r\nA[Original]-->B\r\nstyle A fill:#ff3366';const f=await fixture(original);f.chip(1,'fromLabel').listeners.click();const input=f.all().find(node=>node.dataset.guidedInput==='fromLabel');input.value='Context';
 assert.equal(f.controller.commit(),true);assert.equal(f.source(),'flowchart TD\r\nA["Context"] --> B\r\nstyle A fill:#ff3366');assert.equal(f.saved.length,1);input.listeners.blur();assert.equal(f.saved.length,1);assert.equal(f.controller.isEditing(),false);
 f.setEditable(false);f.controller.paint();assert.equal(f.chip(1,'fromLabel').disabled,true);f.chip(1,'fromLabel').listeners.click();assert.equal(f.controller.isEditing(),false);
});
test('actual Guided mounts at most 64 rows and keeps a tentative field when source notification tries to repaint',async()=>{
 const f=await fixture('flowchart TD\n'+Array.from({length:129},(_,index)=>'%% note '+index).join('\n'));assert.equal(f.all().filter(node=>node.dataset.guidedLine!==undefined).length,64);
 f.all().find(node=>node.textContent==='Next lines').listeners.click();assert.equal(f.all().filter(node=>node.dataset.guidedLine!==undefined).length,64);assert.equal(f.all().find(node=>node.dataset.guidedLine!==undefined).dataset.guidedLine,'64');
 f.chip(64,'body').listeners.click();const input=f.all().find(node=>node.dataset.guidedInput==='body');input.value='Tentative';f.setSource(f.source().replace('note 63','changed elsewhere'));f.controller.paint();assert.ok(f.all().includes(input));assert.equal(input.value,'Tentative');assert.equal(f.controller.commit(),false);
});
