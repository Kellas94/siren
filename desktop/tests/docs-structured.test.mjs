import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
let source='';try{source=await readFile(new URL('../src/ui/docs/structured.js',import.meta.url),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
function api(){const window={};vm.runInNewContext(source,{window,crypto:{randomUUID:()=> 'native-structured-block'},structuredClone});assert.equal(typeof window.SirenStructuredDocs?.createBlock,'function','Structured Docs controls must exist');return window.SirenStructuredDocs;}

class Element {
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.open=false;}
 append(node){node.parent=this;this.children.push(node);}replaceChildren(){for(const child of this.children)child.parent=null;this.children=[];}
 setAttribute(name,value){this.attributes[name]=String(value);}addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 get isConnected(){return this===this.ownerDocument.root||!!this.parent?.isConnected;}
 fire(name){for(const fn of this.listeners[name]??[])fn({target:this});}
 focus(){this.ownerDocument.focused=this;}
 querySelector(){return this.all().find(node=>['input','textarea'].includes(node.tagName));}
 all(){return this.children.flatMap(child=>[child,...child.all()]);}
}
function view(kind,mutate=()=>{},focus=false){
 const a=api(),document={createElement(tag){return new Element(tag,this);}};document.root=new Element('root',document);
 let content={title:'Exact',blocks:[structuredClone(a.createBlock(kind))]},state={pending:false,paused:false,fenced:false,disposed:false,readonly:false},writes=0,allowed=true;mutate(content.blocks[0]);
 const draft={getContent:()=>structuredClone(content),getStatus:()=>state,setContent(value){content=structuredClone(value);writes++;return {ok:true};}};
 assert.equal(typeof a.renderEditor,'function');const detail=a.renderEditor({parent:document.root,draft,index:0,canEdit:()=>allowed,onRemove:()=>{},onOpen:()=>{},preserved:()=>{},focus});
 const toggle=open=>{detail.open=open;detail.fire('toggle');},find=(key,value)=>document.root.all().find(node=>node.dataset[key]===value);
 return {detail,document,toggle,find,draft,get content(){return content;},get writes(){return writes;},state,set allowed(value){allowed=value;}};
}
test('structured table pages are lazy and bounded, literal edits retain off-page values, role and exact other blocks',()=>{
 const v=view('table',block=>{block.role='test-cases';block.rows=Array.from({length:500},(_,i)=>Array.from({length:12},(_,j)=>`${i}:${j} Ș😀 <tag>`));});
 assert.equal(v.document.root.all().filter(n=>n.tagName==='input').length,0);v.toggle(true);
 assert.equal(v.document.root.all().filter(n=>n.dataset.structuredCell!==undefined).length,240);
 const first=v.find('structuredCell','0:0');first.value='Changed Ș😀 <script>';first.fire('input');assert.equal(v.content.blocks[0].rows[0][0],first.value);assert.equal(v.content.blocks[0].rows[499][11],'499:11 Ș😀 <tag>');assert.equal(v.content.blocks[0].role,'test-cases');
 const next=v.find('structuredAction','next');next.fire('click');assert.equal(first.isConnected,false);first.value='Detached';first.fire('input');assert.equal(v.writes,1);assert.equal(v.find('structuredCell','20:0').value,'20:0 Ș😀 <tag>');
 v.toggle(false);assert.equal(v.document.root.all().filter(n=>n.tagName==='input').length,0);v.toggle(true);assert.equal(v.find('structuredCell','20:0').value,'20:0 Ș😀 <tag>');
});
test('newly added sections retain their focused live input after the asynchronous details toggle',()=>{
 const v=view('prompt',()=>{},true);assert.equal(v.document.focused.isConnected,true);const focused=v.document.focused;v.detail.fire('toggle');assert.equal(focused.isConnected,true);assert.equal(v.document.focused,focused);
});
test('structured mutations refuse pending, paused, fenced, revoked and stale block controls; malformed text does not become a draft',()=>{
 const v=view('checklist');v.toggle(true);const input=v.find('structuredField','text:0');
 for(const key of ['pending','paused','fenced','disposed','readonly']){v.state[key]=true;input.value='Refused';input.fire('input');assert.equal(v.writes,0);v.state[key]=false;}
 v.allowed=false;input.fire('input');assert.equal(v.writes,0);v.allowed=true;input.value='\uD800';input.fire('input');assert.equal(v.writes,0);assert.equal(input.value,'','Refused input must not appear as saved local text');
 input.value='Confirmed';input.fire('input');assert.equal(v.writes,1);assert.equal(v.content.blocks[0].items[0].text,'Confirmed');
 const different=v.draft.getContent();different.blocks[0].id='new identity';v.draft.setContent(different);input.value='Stale';input.fire('input');assert.equal(v.writes,2);assert.equal(v.content.blocks[0].items[0].text,'Confirmed');
});
test('row and column changes keep exact rectangular shape, retained data and confirmation cancellation',()=>{
 const v=view('table');v.document.defaultView={confirm:()=>false};v.toggle(true);v.find('structuredAction','add-row').fire('click');assert.equal(v.content.blocks[0].rows.length,3);v.find('structuredAction','add-column').fire('click');assert.deepEqual(v.content.blocks[0].rows,[['Column 1','Column 2',''],['','',''],['','','']]);
 v.find('structuredAction','remove-row').fire('click');v.find('structuredAction','remove-column').fire('click');assert.equal(v.writes,2);v.document.defaultView.confirm=()=>true;v.find('structuredAction','remove-row').fire('click');v.find('structuredAction','remove-column').fire('click');assert.deepEqual(v.content.blocks[0].rows,[['Column 1','Column 2'],['','']]);
});
test('prompt controls edit literal documentation and preserve exact history and dates; checklist and settings remain bounded',()=>{
 const v=view('prompt',b=>{b.updatedAt='Original date';b.copiedAt='Original copy';b.history=[{at:'Original history',text:'Original instructions'}];});v.toggle(true);const field=v.find('structuredField','text');field.value='def main():\n    return "Ș😀 <tag>"';field.fire('input');
 assert.deepEqual(v.content.blocks[0].history,[{at:'Original history',text:'Original instructions'}]);assert.equal(v.content.blocks[0].updatedAt,'Original date');assert.equal(v.content.blocks[0].copiedAt,'Original copy');assert.equal(v.content.blocks[0].text,field.value);
 for(const [kind,key,limit]of [['checklist','items',200],['settings','rows',80]]){const t=view(kind,b=>{b[key]=Array.from({length:limit},()=>structuredClone(b[key][0]));});t.toggle(true);assert.equal(t.document.root.all().filter(n=>n.dataset.structuredField!==undefined).length,40);t.find('structuredAction','add-row').fire('click');assert.equal(t.writes,0);}
});
test('new structured sections have exact frozen canonical defaults, no source/agent/history authority and independent mutable payloads',()=>{
 const a=api(),expected={table:{id:'native-structured-block',kind:'table',headerRow:true,rows:[['Column 1','Column 2'],['','']]},checklist:{id:'native-structured-block',kind:'checklist',items:[{text:'',done:false}]},prompt:{id:'native-structured-block',kind:'prompt',label:'Agent instructions',model:'',text:'',reasoningEffort:'',updatedAt:'',copiedAt:'',history:[]},settings:{id:'native-structured-block',kind:'settings',rows:[{key:'Model',value:''},{key:'Temperature',value:''},{key:'Tools / plugins',value:''},{key:'Knowledge sources',value:''},{key:'Trigger',value:''}]}};
 for(const kind of Object.keys(expected)){const block=structuredClone(a.createBlock(kind));assert.deepEqual(block,expected[kind]);assert.equal(a.isEditableBlock(block),true);}
 const first=a.createBlock('settings');first.rows[0].value='Changed';assert.equal(a.createBlock('settings').rows[0].value,'');assert.throws(()=>a.createBlock('knowledge'));assert.throws(()=>a.createBlock('unknown'));
});
test('editable canonical shapes remain bounded and refuse opaque provenance rather than silently dropping it',()=>{
 const a=api();for(const kind of ['table','checklist','prompt','settings']){const block=structuredClone(a.createBlock(kind));block.private='EXACT_METADATA';assert.equal(a.isEditableBlock(block),false);}
 const table=structuredClone(a.createBlock('table'));for(const mutate of [b=>b.rows[0].push('Uneven'),b=>b.rows=Array.from({length:501},()=>['x']),b=>b.rows=[Array(13).fill('x')],b=>b.rows[0][0]='x'.repeat(8001),b=>b.headerRow='yes']){const changed=structuredClone(table);mutate(changed);assert.equal(a.isEditableBlock(changed),false);}
 const checklist=structuredClone(a.createBlock('checklist'));checklist.items[0].sourceRef={sourceId:'immutable'};assert.equal(a.isEditableBlock(checklist),false);delete checklist.items[0].sourceRef;checklist.items[0].text='x'.repeat(501);assert.equal(a.isEditableBlock(checklist),false);
 const settings=structuredClone(a.createBlock('settings'));settings.rows[0].value='x'.repeat(4001);assert.equal(a.isEditableBlock(settings),false);settings.rows[0].value='';settings.rows[0].key='x'.repeat(81);assert.equal(a.isEditableBlock(settings),false);
 const prompt=structuredClone(a.createBlock('prompt'));prompt.history=[{at:'Exact date',text:'Original',author:'Original actual author'}];assert.equal(a.isEditableBlock(prompt),false);delete prompt.history[0].author;assert.equal(a.isEditableBlock(prompt),true);prompt.text='x'.repeat(200001);assert.equal(a.isEditableBlock(prompt),false);
});
