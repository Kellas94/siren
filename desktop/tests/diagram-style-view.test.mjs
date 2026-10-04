import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {buildDiagramStyle} from '../build/diagram-style.mjs';
const script=(await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)})).script+'\n'+await readFile(new URL('../src/ui/diagram/draft.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../src/ui/diagram/style-view.js',import.meta.url),'utf8');
function fixture(readonly=false){
 class Element{children=[];listeners={};value='';disabled=false;attrs={};append(...children){this.children.push(...children);}replaceChildren(){this.children=[];}addEventListener(type,callback){this.listeners[type]=callback;}setAttribute(key,value){this.attrs[key]=value;}removeAttribute(key){delete this.attrs[key];}}
 const window={},document={createElement:()=>new Element(),createTextNode:text=>({textContent:text})};vm.runInNewContext(script,{window,document,crypto:webcrypto,structuredClone,TextEncoder});
 const diagram={id:'d',source:'flowchart TD\nA-->B',fontSize:18,nodeStyles:{A:{fill:'#ff3366'},B:{fill:'#2277cc'}},sirenNativeVersion:1},context={ok:true,readonly,diagram,version:1,sha256:createHash('sha256').update(JSON.stringify(diagram)).digest('hex')};let saves=0;const draft=window.SirenNativeDiagramDraft.create({context,bridge:{applyDiagram:async()=>{saves++;throw Error('No automatic save');}}}),host=new Element(),messages=[];
 const view=window.SirenNativeDiagramStyleView.create({host,diagramFor:draft.getDiagram,editable:()=>!readonly,onStyle:draft.setStyle,onStatus:value=>messages.push(value)});view.setTargets([{id:'A',protected:{fill:true,text:true}},{id:'B',protected:{}}]);
 const field=id=>{const all=[];const walk=node=>{all.push(node);for(const child of node.children||[])walk(child);};walk(host);return all.find(node=>node.id===id);};return{draft,view,field,messages,saves:()=>saves};
}
test('pending style fields survive source repaint; invalid font size cannot be lost, saved or flushed; Escape cancels it',()=>{
 const f=fixture(),size=f.field('diagramStyleSize');size.value='200';size.listeners.input();f.draft.setSource('exact local source');f.view.paint();assert.equal(size.value,'200');assert.equal(f.view.isEditing(),true);assert.equal(f.view.commit(),false);assert.equal(size.value,'200');assert.equal(size.attrs['aria-invalid'],'true');assert.equal(f.draft.getDiagram().fontSize,18);assert.equal(f.saves(),0);
 size.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(size.value,'18');assert.equal(f.view.isEditing(),false);size.value='20';size.listeners.input();assert.equal(f.view.commit(),true);assert.equal(f.draft.getDiagram().fontSize,20);assert.equal(f.saves(),0);
});
test('readonly and source-owned colours cannot be changed through the actual optional controller; stable B targets remain editable',()=>{
 const read=fixture(true);assert.equal(read.field('diagramStyleFont').disabled,true);assert.equal(read.field('diagramStyleUse_fill').disabled,true);read.field('diagramStyle_fill').value='#000000';read.field('diagramStyle_fill').listeners.change();assert.equal(read.draft.getStatus().dirty,false);
 const f=fixture();assert.equal(f.field('diagramStyleUse_fill').disabled,true);const target=f.field('diagramStyleTarget');target.value='B';target.listeners.change();assert.equal(f.field('diagramStyleUse_fill').disabled,false);f.field('diagramStyle_fill').value='#12ab34';f.field('diagramStyle_fill').listeners.change();assert.equal(f.draft.getDiagram().nodeStyles.B.fill,'#12ab34');assert.equal(f.draft.getDiagram().nodeStyles.A.fill,'#ff3366');assert.equal(f.saves(),0);
});
