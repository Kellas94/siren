import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildDiagramStyle} from '../build/diagram-style.mjs';
const built=await buildDiagramStyle({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
function fixture(config={},nodes){let current={};const window={mermaid:{initialize(value){current=value;},parse:async()=>({diagramType:'flowchart',config}),mermaidAPI:{getConfig:()=>({themeVariables:{fontWeight:current.themeVariables?.fontWeight??400}}),getDiagramFromText:async()=>({db:{getData:()=>({nodes:nodes??[{id:'A',cssStyles:['fill:#ff3366;color:#ffffff']},{id:'A-1',cssStyles:[]},{id:'B',cssStyles:[]}]})}})}}};vm.runInNewContext(built.script,{window});return window.SirenNativeDiagramStyle;}
class Element{
 constructor(attrs={}){this.attrs={...attrs};this.values={};this.style={setProperty:(key,value)=>this.values[key]=value};}
 getAttribute(key){return this.attrs[key]??null;}setAttribute(key,value){this.attrs[key]=value;}
 querySelectorAll(selector){return selector==='text,tspan'?this.texts||[]:selector==='rect,polygon,circle,ellipse,path'?this.shapes||[]:this.groups||[];}
}
test('frozen Mermaid-resolved provenance preserves declared colours, paints only exact matching blocks and retains class/own precedence',async()=>{
 const styles=fixture(),appearance=await styles.prepare({},'flowchart TD\nA-->B'),root=new Element();root.groups=['A','A-1','B'].map((id,i)=>{const group=new Element({id:'flowchart-'+id+'-'+i});group.shapes=[new Element()];group.texts=[new Element()];return group;});root.texts=root.groups.flatMap(group=>group.texts);
 const diagram={source:'exact',fontFamily:'Georgia',fontSize:18,nodeClasses:{B:'shared'},styleClasses:{shared:{fill:'#00aa00',text:'#ffffff'}},nodeStyles:{A:{fill:'#000000',text:'#000000'},B:{fill:'#2277cc'},'A-1':{fill:'#ffff00'}}},before=JSON.stringify(diagram),targets=styles.apply(root,diagram,appearance);
 assert.deepEqual(Array.from(targets,v=>v.id),['A','A-1','B']);assert.equal(root.groups[0].shapes[0].values.fill,undefined);assert.equal(root.groups[0].texts[0].values.fill,undefined);
 assert.equal(root.groups[1].shapes[0].values.fill,'#ffff00');assert.equal(root.groups[2].shapes[0].values.fill,'#2277cc');assert.equal(root.groups[2].texts[0].values.fill,'#ffffff');assert.match(root.groups[2].texts[0].values['font-family'],/Georgia/);assert.equal(root.groups[2].texts[0].values['font-size'],'18px');assert.equal(JSON.stringify(diagram),before);
 assert.equal(targets[0].protected.fill,true);assert.equal(targets[2].protected.fill,false);
});
test('imported theme palettes and font declarations stay in Mermaid control; unrendered/unsafe metadata never creates targets or CSS',async()=>{
 const styles=fixture({theme:'dark',fontFamily:'Courier New'}),appearance=await styles.prepare({},'exact'),root=new Element();const group=new Element({'data-id':'B'});group.shapes=[new Element()];group.texts=[new Element()];root.groups=[group];root.texts=group.texts;
 const targets=styles.apply(root,{fontFamily:'Georgia',nodeStyles:{B:{fill:'#2277cc',text:'#ffffff',fontFamily:'Arial'},outside:{fill:'#ff0000'}}},appearance);
 assert.deepEqual(Array.from(targets,v=>v.id),['B']);assert.equal(group.shapes[0].values.fill,undefined);assert.equal(group.texts[0].values.fill,undefined);assert.equal(group.texts[0].values['font-family'],undefined);
 const plain=fixture(),simple=await plain.prepare({},'exact');plain.apply(root,{nodeStyles:{B:{fill:'url(https://unsafe.example)',text:'expression(x)',fontFamily:'evil'}}},simple);assert.equal(group.shapes[0].values.fill,undefined);assert.equal(group.texts[0].values.fill,undefined);
});
test('strict Mermaid render prefixes map by exact DB DOM identity; near matches never receive another block style',async()=>{
 const styles=fixture(),appearance=await styles.prepare({},'exact');appearance.nodes.get('B').domId='flowchart-B-1';const root=new Element({id:'nativeDiagram_2'});root.groups=['nativeDiagram_2-flowchart-B-1','nativeDiagram_2-flowchart-B-10','prefix-nativeDiagram_2-flowchart-B-1'].map(id=>{const group=new Element({id});group.shapes=[new Element()];return group;});
 assert.deepEqual(Array.from(styles.apply(root,{nodeStyles:{B:{fill:'#2277cc'}}},appearance),v=>v.id),['B']);assert.equal(root.groups[0].shapes[0].values.fill,'#2277cc');assert.equal(root.groups[1].shapes[0].values.fill,undefined);assert.equal(root.groups[2].shapes[0].values.fill,undefined);
});
test('source node and global weight declarations prevent global/root and block typography overrides',async()=>{
 const styles=fixture(),appearance=await styles.prepare({},'exact');appearance.nodes.get('B').font=true;const root=new Element(),group=new Element({'data-id':'B'});group.texts=[new Element()];root.groups=[group];root.texts=group.texts;const targets=styles.apply(root,{fontWeight:700,fontSize:20,nodeStyles:{B:{fontWeight:800,fontSize:24}}},appearance);assert.equal(group.texts[0].values['font-weight'],undefined);assert.equal(group.texts[0].values['font-size'],undefined);assert.equal(targets[0].protected.font,true);
 const global=fixture({themeVariables:{fontWeight:600}}),declared=await global.prepare({},'exact'),g=new Element({'data-id':'B'}),r=new Element();g.texts=[new Element()];r.groups=[g];r.texts=g.texts;const t=global.apply(r,{fontWeight:800},declared);assert.equal(g.texts[0].values['font-weight'],undefined);assert.equal(t[0].protected.fontGlobal,true);
});

test('actual extracted Mermaid node CSS provenance identifies family/size/weight and keeps its rendered text untouched',async()=>{
 const styles=fixture({},[{id:'B',cssStyles:['font-family:Georgia;font-size:22px;font-weight:700']}]),appearance=await styles.prepare({},'exact'),root=new Element(),group=new Element({'data-id':'B'});group.texts=[new Element()];root.groups=[group];root.texts=group.texts;const targets=styles.apply(root,{fontFamily:'Verdana',fontSize:20,fontWeight:800,nodeStyles:{B:{fontSize:24}}},appearance);assert.equal(targets[0].protected.font,true);assert.deepEqual(group.texts[0].values,{});
});
