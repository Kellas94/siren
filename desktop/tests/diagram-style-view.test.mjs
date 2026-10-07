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
test('global and block typography edit without implicit Save; inheritance removes fields and retains colours/siblings',()=>{
 const f=fixture(),weight=f.field('diagramStyleWeight');assert.ok(weight);weight.value='700';weight.listeners.change();assert.equal(f.draft.getDiagram().fontWeight,700);
 f.field('diagramStyleTarget').value='B';f.field('diagramStyleTarget').listeners.change();const family=f.field('diagramStyleNodeFont'),size=f.field('diagramStyle_nodeSize'),use=f.field('diagramStyleUse_nodeSize'),nodeWeight=f.field('diagramStyleNodeWeight');assert.ok(family&&size&&use&&nodeWeight);
 family.value='Georgia';family.listeners.change();use.checked=true;use.listeners.change();size.value='22';size.listeners.input();assert.equal(f.view.commit(),true);nodeWeight.value='800';nodeWeight.listeners.change();assert.deepEqual(f.draft.getDiagram().nodeStyles.B,{fill:'#2277cc',fontFamily:'Georgia',fontSize:22,fontWeight:800});assert.deepEqual(f.draft.getDiagram().nodeStyles.A,{fill:'#ff3366'});
 family.value='inherit';family.listeners.change();nodeWeight.value='inherit';nodeWeight.listeners.change();use.checked=false;use.listeners.change();assert.deepEqual(f.draft.getDiagram().nodeStyles.B,{fill:'#2277cc'});assert.equal(f.saves(),0);
});
test('invalid block size survives refused target switch; source-owned typography and readonly controls remain disabled',()=>{
 const f=fixture();assert.ok(f.field('diagramStyleNodeFont'));f.field('diagramStyleTarget').value='B';f.field('diagramStyleTarget').listeners.change();const size=f.field('diagramStyle_nodeSize'),use=f.field('diagramStyleUse_nodeSize');use.checked=true;use.listeners.change();size.value='200';size.listeners.input();f.field('diagramStyleTarget').value='A';f.field('diagramStyleTarget').listeners.change();assert.equal(f.field('diagramStyleTarget').value,'B');assert.equal(size.value,'200');assert.equal(f.view.commit(),false);size.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(f.view.isEditing(),false);
 f.view.setTargets([{id:'A',protected:{font:true,fontGlobal:true}},{id:'B',protected:{font:true,fontGlobal:true}}]);assert.equal(f.field('diagramStyleNodeFont').disabled,true);assert.equal(f.field('diagramStyleWeight').disabled,true);assert.match(f.field('diagramStyleNodeFont').title,/Mermaid/);assert.equal(fixture(true).field('diagramStyleNodeWeight').disabled,true);
});
test('changing an admitted font preserves existing opaque block metadata and refuses new or changed opaque fields',()=>{
 const f=fixture(),base=f.draft.getDiagram();base.nodeStyles.B.future={owner:'EXACT'};
 // A fresh actual draft models an imported block field retained by the domain.
 const window={};vm.runInNewContext(script,{window,document:{createElement(){return{};}},crypto:webcrypto,structuredClone,TextEncoder});const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram:base,version:1,sha256:createHash('sha256').update(JSON.stringify(base)).digest('hex')},bridge:{}});
 const nodes=structuredClone(base.nodeStyles);nodes.B.fontFamily='Georgia';assert.equal(draft.setStyle({nodeStyles:nodes}).ok,true);assert.deepEqual(draft.getDiagram().nodeStyles.B.future,{owner:'EXACT'});nodes.B.future.owner='FORGED';assert.equal(draft.setStyle({nodeStyles:nodes}).ok,false);assert.deepEqual(draft.getDiagram().nodeStyles.B.future,{owner:'EXACT'});
});

test('absent global typography shows Theme default and stays absent until explicitly edited',()=>{
 const f=fixture();assert.equal(f.field('diagramStyleFont').value,'');assert.equal(f.field('diagramStyleWeight').value,'');
 for(const id of ['diagramStyleFont','diagramStyleWeight'])assert.equal(f.field(id).children[0].textContent,'Theme default');
 assert.equal(Object.hasOwn(f.draft.getDiagram(),'fontFamily'),false);assert.equal(Object.hasOwn(f.draft.getDiagram(),'fontWeight'),false);
 f.field('diagramStyleWeight').value='600';f.field('diagramStyleWeight').listeners.change();assert.equal(f.draft.getDiagram().fontWeight,600);f.draft.undo();f.view.paint();assert.equal(f.field('diagramStyleWeight').value,'');assert.equal(f.saves(),0);
});

test('source global font ownership disables controls even when no stable block targets exist',()=>{
 const f=fixture();f.view.setTargets([],{fontDeclared:true});for(const id of ['diagramStyleFont','diagramStyleSize','diagramStyleWeight']){assert.equal(f.field(id).disabled,true,id);assert.match(f.field(id).title,/Mermaid/);}
 f.view.setTargets([],{fontDeclared:false});assert.equal(f.field('diagramStyleWeight').disabled,false);assert.equal(f.field('diagramStyleNodeWeight').disabled,true);assert.equal(f.saves(),0);
});

test('an inherited block size without metadata stays blank until the user explicitly enables a size',()=>{
 const f=fixture(),base=f.draft.getDiagram();delete base.fontSize;
 const window={};class E{children=[];listeners={};value='';append(...values){this.children.push(...values);}replaceChildren(){this.children=[];}addEventListener(k,v){this.listeners[k]=v;}setAttribute(){}removeAttribute(){}}
 const document={createElement:()=>new E(),createTextNode:text=>({textContent:text})};vm.runInNewContext(script,{window,document,crypto:webcrypto,structuredClone,TextEncoder});
 const draft=window.SirenNativeDiagramDraft.create({context:{ok:true,readonly:false,diagram:base,version:1,sha256:createHash('sha256').update(JSON.stringify(base)).digest('hex')},bridge:{}}),host=new E(),view=window.SirenNativeDiagramStyleView.create({host,diagramFor:draft.getDiagram,editable:()=>true,onStyle:draft.setStyle,onStatus(){}});view.setTargets([{id:'B',protected:{}}]);
 const all=[];function walk(n){all.push(n);for(const child of n.children||[])walk(child);}walk(host);const size=all.find(n=>n.id==='diagramStyle_nodeSize'),use=all.find(n=>n.id==='diagramStyleUse_nodeSize');assert.equal(size.value,'');assert.equal(size.placeholder,'Inherit');assert.equal(size.disabled,true);assert.equal(all.find(n=>n.id==='diagramStyleSize').value,'');
 use.checked=true;use.listeners.change();assert.equal(draft.getDiagram().nodeStyles.B.fontSize,16);assert.equal(size.value,'16');assert.equal(size.disabled,false);
});
