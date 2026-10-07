import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createDocumentActivityContract} from '../src/documents/document-activity.mjs';
const source=await readFile(new URL('../src/ui/docs/reader.js',import.meta.url),'utf8');
function fixture(blocks){const nodes=[];class Node{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.events={};this.isConnected=true;nodes.push(this);}append(...children){for(const child of children){child.parent=this;this.children.push(child);}}setAttribute(k,v){this[k]=v;}addEventListener(k,v){this.events[k]=v;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}get lastElementChild(){return this.children.at(-1);}scrollIntoView(){this.scrolled=true;}focus(){this.focused=true;}}
 const document={createElement:tag=>new Node(tag)},window={SirenDocumentActivity:createDocumentActivityContract()},parent=new Node('article'),outline=new Node('nav');runInNewContext(source,{document,window});const handle=window.SirenNativeDocsReader.render({parent,outline,blocks});return {nodes,parent,outline,handle};}
const blocks=()=>Array.from({length:100},(_,i)=>({id:'id-'+i,kind:'heading',text:'Heading '+i}));
test('exact jump beyond the first page appends blocks and keeps existing mounted content',()=>{
 const data=blocks(),before=JSON.stringify(data),f=fixture(data),first=f.nodes.find(n=>n.dataset.blockId==='id-0');assert.ok(first);assert.equal(f.nodes.some(n=>n.dataset.blockId==='id-83'),false);assert.equal(typeof f.handle?.reveal,'function','Reader exact reveal handle missing');const result=f.handle.reveal('id-83');assert.equal(result.ok,true);assert.equal(f.nodes.find(n=>n.dataset.blockId==='id-0'),first);assert.equal(f.nodes.find(n=>n.dataset.blockId==='id-83').focused,true);assert.equal(JSON.stringify(data),before);
});
test('duplicate missing invalid and over-limit jumps refuse before mounting additional blocks',()=>{
 const data=blocks();data[90].id='id-83';const f=fixture(data);assert.equal(typeof f.handle?.reveal,'function');for(const [id,code]of [['id-83','BLOCK_AMBIGUOUS'],['missing','BLOCK_MISSING'],['','BLOCK_ID_INVALID']]){assert.equal(f.handle.reveal(id).code,code);assert.equal(f.nodes.some(n=>n.dataset.blockId==='id-83'),false);}
 const big=fixture(Array.from({length:4097},(_,i)=>({id:String(i),kind:'heading',text:''})));assert.equal(big.handle.reveal('4096').code,'BLOCK_LOOKUP_LIMIT');
});
test('source-only rendering stays empty until an explicit unknown-block jump creates a labelled anchor',()=>{
 const data=[{id:'x]"😀',kind:'knowledge',opaque:'exact',rows:[]}],f=fixture(data);assert.equal(f.parent.children.length,0);assert.equal(f.outline.children.length,0);assert.equal(typeof f.handle?.reveal,'function');assert.equal(f.handle.reveal(data[0].id).ok,true);const target=f.nodes.find(n=>n.dataset.blockId===data[0].id);assert.equal(target.focused,true);assert.ok(target.children.some(n=>/Preserved/i.test(n.textContent)));assert.equal(data[0].opaque,'exact');
});
