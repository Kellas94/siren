import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
// Exercise the actual renderer function with transformed SVG geometry.
const source=await readFile(new URL('../src/ui/presentation/render.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf(' function focusNode('),source.indexOf(' if(window.__SIREN_ELK)'));
const focus=runInNewContext(body+';focusNode',{fail:()=>{throw Error('refused');},DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return {x:this.x+120,y:this.y+80};}}});
const matrix={inverse(){return this;},multiply(){return this;}};
const node=(id,data=null)=>({id,getAttribute:()=>data,getBBox:()=>({x:-76,y:-21.5,width:152,height:43}),getCTM:()=>matrix});
const root=nodes=>({querySelectorAll:()=>nodes,getCTM:()=>matrix,setAttribute(name,value){this[name]=value;}});
test('authored node uses exact Mermaid12 render-prefixed identity and transformed geometry',()=>{
 const svg=root([node('presentationPublic-flowchart-A-0'),node('presentationPublic-flowchart-B-1')]);
 focus(svg,'A');assert.equal(svg.viewBox,'-24.400000000000006 -9.900000000000006 288.8 179.8');
});
test('exact imported data-id and legacy Mermaid identity remain supported',()=>{
 for(const candidate of [node('unrelated','A'),node('flowchart-A-12')]){const svg=root([candidate]);focus(svg,'A');assert.ok(svg.viewBox);}
});
test('missing, ambiguous and lookalike node identities cannot focus an unrelated block',()=>{
 for(const nodes of [[node('presentationPublic-flowchart-AB-0')],[node('otherPublic-flowchart-A-0')],[node('presentationPublic-flowchart-A-x')],[node('presentationPublic-flowchart-A-0'),node('presentationPublic-flowchart-A-1')]])assert.throws(()=>focus(root(nodes),'A'));
 assert.throws(()=>focus(root([node('presentationPublic-flowchart-A-0')]),'MISSING'));
});
