import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as common from '@lezer/common';
import * as lr from '@lezer/lr';
import * as highlight from '@lezer/highlight';
import {mapSelectedSyntax} from '../src/sources/map-worker.mjs';

// Read the admitted parser in memory; do not build or alter baseline/generated files.
const sha256=value=>createHash('sha256').update(value).digest('hex');
const baseline=await readFile(new URL('../baseline/R78.html',import.meta.url));
assert.equal(sha256(baseline),'5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4');
const html=baseline.toString('utf8').replace(/\r\n/g,'\n');
const prefix='const SirenPythonLanguage=(()=>{const factories=';
const start=html.indexOf(prefix),end=html.indexOf(';const cache={};function load',start);
assert.ok(start>=0&&end>start);
const factories=new vm.Script('('+html.slice(start+prefix.length,end)+')').runInContext(vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}}),{timeout:1000});
const local=['@lezer/python','@siren/python/terms','@siren/python/tokens','@siren/python/highlight'];
const factory='{'+local.map(name=>JSON.stringify(name)+':'+factories[name].toString()).join(',')+'}';
assert.equal(sha256(factory),'c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b');
const cache=Object.create(null),external={'@lezer/common':common,'@lezer/lr':lr,'@lezer/highlight':highlight};
function load(name){
 if(Object.hasOwn(external,name))return external[name];
 if(Object.hasOwn(cache,name))return cache[name].exports;
 assert.ok(local.includes(name),'Only admitted parser modules may load');
 const module=cache[name]={exports:{}};factories[name](module,module.exports,load);return module.exports;
}
const parser=load('@lezer/python').parser;
const budget={maxNodes:200000,maxGraphNodes:120,maxGraphEdges:120};
function project(input,{from=0,firstLine=1,...limits}={}){
 const tree=parser.parse(input);
 const result=mapSelectedSyntax(tree,{input,from,to:from+input.length,lineFor:offset=>firstLine+input.slice(0,offset-from).split('\n').length-1,budget:{...budget,...limits}});
 return {tree,result};
}
const blocks=result=>result.nodes.filter(node=>node.id!==0);
function assertIntegrity(result,input,from=0){
 assert.equal(result.semantics,'syntax-containment');
 assert.deepEqual(result.nodes.map(node=>node.id),result.nodes.map((_,index)=>index));
 assert.equal(result.edges.length,result.nodes.length-1);
 for(const node of blocks(result)){
  assert.ok(node.from>=from&&node.to<=from+input.length&&node.to>=node.from);
  const parent=result.nodes[node.parent];assert.ok(parent);
  assert.ok(parent.from<=node.from&&parent.to>=node.to);
  assert.deepEqual(result.edges.find(edge=>edge.to===node.id),{from:node.parent,to:node.id,kind:'contains'});
 }
}

test('real admitted parser projects values, annotations without values and updates distinctly',()=>{
 const input='x = 1\nx: int\ny: int = 3\nx += 1\n';
 const {tree,result}=project(input);
 assert.match(tree.toString(),/AssignStatement/);assert.match(tree.toString(),/UpdateStatement/);
 assert.deepEqual(result.errors,[]);
 assert.deepEqual(blocks(result).map(node=>[node.kind,node.label]),[['assignment','x = 1'],['annotation','x: int'],['assignment','y: int = 3'],['assignment','x += 1']]);
 assertIntegrity(result,input);
});

test('annotation classification follows direct parser operator, not equals in strings or nested calls',()=>{
 const input='x: Literal["="]\ny: tuple[int, str] = make(value=1)\ndef f(argument: int = 2):\n    return argument == 2\n';
 const {result}=project(input);assert.deepEqual(result.errors,[]);
 assert.deepEqual(blocks(result).filter(node=>['assignment','annotation'].includes(node.kind)).map(node=>[node.kind,node.label]),[['annotation','x: Literal["="]'],['assignment','y: tuple[int, str] = make(value=1)']]);
 const assigned=blocks(result).find(node=>node.kind==='assignment'),call=blocks(result).find(node=>node.kind==='call');assert.equal(call.parent,assigned.id);
 assertIntegrity(result,input);
});

test('chained, destructured, attribute, subscript and Unicode assignments retain exact source ranges',()=>{
 const lines=['a = b = factory()','left, *rest = values','[first, second] = pair','obj.attr = 1','items[0] += 2','变量: int','变量 = 3'];
 const input=lines.join('\r\n')+'\r\n',from=73;
 const {result}=project(input,{from,firstLine:8});assert.deepEqual(result.errors,[]);
 const mapped=blocks(result).filter(node=>['assignment','annotation'].includes(node.kind));
 assert.deepEqual(mapped.map(node=>node.label),lines);assert.deepEqual(mapped.map(node=>node.line),lines.map((_,index)=>8+index));
 for(const [index,node] of mapped.entries())assert.equal(input.slice(node.from-from,node.to-from).trim(),lines[index]);
 assertIntegrity(result,input,from);
});

test('function and branch containment includes assignments without claiming execution or data flow',()=>{
 const input='def calculate(flag):\n    value = source()\n    if flag:\n        value *= 2\n    return value\n';
 const {result}=project(input);assert.deepEqual(result.errors,[]);
 const fn=blocks(result).find(node=>node.kind==='function'),branch=blocks(result).find(node=>node.kind==='branch');
 const assignments=blocks(result).filter(node=>node.kind==='assignment');assert.equal(assignments.length,2);
 assert.equal(assignments[0].parent,fn.id);assert.equal(assignments[1].parent,branch.id);
 assert.equal(blocks(result).find(node=>node.kind==='call').parent,assignments[0].id);
 assert.equal(result.edges.every(edge=>edge.kind==='contains'),true);assertIntegrity(result,input);
});

test('existing yield, await and call blocks survive assignment projection',()=>{
 const input='def producer(items):\n    yield 1\n    yield from items\nasync def consume():\n    result = await work()\n';
 const {result}=project(input);assert.deepEqual(result.errors,[]);
 assert.equal(blocks(result).filter(node=>node.kind==='yield').length,2);
 const assigned=blocks(result).find(node=>node.kind==='assignment'),awaited=blocks(result).find(node=>node.kind==='await'),call=blocks(result).find(node=>node.kind==='call');
 assert.ok(assigned);assert.equal(awaited.parent,assigned.id);assert.equal(call.parent,awaited.id);assertIntegrity(result,input);
});

test('syntax errors retain absolute locations and bounded diagnostics, not successful runtime claims',()=>{
 const input='x =\ny +=\ndef broken(:\n    z: int =\n',from=19;
 const {result}=project(input,{from});assert.ok(result.errors.length>0);assert.ok(result.errors.length<=128);
 for(const error of result.errors)assert.ok(error.from>=from&&error.to<=from+input.length);
 assertIntegrity(result,input,from);
 const many=project('value =\n'.repeat(300)).result;assert.ok(many.errors.length>0&&many.errors.length<=128);
});

test('new assignment blocks honor graph, edge and visit caps',()=>{
 const input=Array.from({length:200},(_,index)=>`value_${index} = call()`).join('\n');
 for(const limits of [{maxGraphNodes:3},{maxGraphEdges:1},{maxNodes:3}]){
  const {result}=project(input,limits);assert.equal(result.limited,true);
  assert.ok(result.nodes.length<=(limits.maxGraphNodes??budget.maxGraphNodes));
  assert.ok(result.edges.length<=(limits.maxGraphEdges??budget.maxGraphEdges));
  assert.ok(result.visited<=(limits.maxNodes??budget.maxNodes)+1);assertIntegrity(result,input);
 }
});

test('shortened assignment labels never split a Unicode surrogate pair',()=>{
 const start='value = "',input=start+'a'.repeat(159-start.length)+'😀"';
 const {result}=project(input);assert.deepEqual(result.errors,[]);
 const assigned=blocks(result).find(node=>node.kind==='assignment');assert.ok(assigned);
 assert.equal(assigned.label.length,159);assert.equal(result.labelTruncated,true);
 assert.equal(/[\uD800-\uDBFF]$/.test(assigned.label),false);assert.equal(assigned.to,input.length);assertIntegrity(result,input);
});

test('actual map view accepts annotation literally with an accurate explanation and immutable navigation',async()=>{
 const source=await readFile(new URL('../src/ui/code/analysis.js',import.meta.url),'utf8');
 class Element{children=[];dataset={};listeners={};value='';classList={toggle(){}};append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this[key]=value;}addEventListener(name,fn){this.listeners[name]=fn;}removeEventListener(){}focus(){}}
 const panel=new Element();panel.id='panel';const button=new Element(),window={};
 const document={createElement:()=>new Element(),getElementById:()=>new Element(),addEventListener(){},removeEventListener(){}};
 vm.runInNewContext(source,{window,document,crypto:{randomUUID:()=> 'projection-job'}});
 const input='变量: Literal["="]\n变量 = 2\n',result=project(input).result,selected=[];
 const sourceRef={sourceId:'source-a',version:1,sha256:'a'.repeat(64)};let current={ready:true,sourceRef};
 const editor={getStatus:()=>current,getState:()=>({doc:{length:input.length},selection:{main:{from:0,to:input.length}}}),select:(...range)=>selected.push(range)};
 let resolve;const bridge={submit:()=>new Promise(done=>{resolve=done;}),cancel:async()=>({ok:true}),listComparisons:async()=>({ok:true,items:[]})};
 const view=window.SirenNativeAnalysis.create({button,panel,editorFor:()=>editor,bridge});
 const all=()=>{const found=[];const walk=node=>{found.push(node);node.children.forEach(walk);};walk(panel);return found;};const find=id=>all().find(node=>node.id===id);
 find('analysisScope').value='map';find('analysisScope').listeners.change();find('analyzeSource').listeners.click();
 resolve({ok:true,sourceId:sourceRef.sourceId,version:1,jobId:'projection-job',status:'complete',coverage:{from:0,to:input.length,totalUnits:input.length,syntaxErrors:0,limited:false},result});
 await new Promise(done=>setImmediate(done));
 const annotation=all().find(node=>node.dataset.mapKind==='annotation');assert.ok(annotation);
 const select=annotation.children.find(node=>node.dataset.mapNodeId);assert.equal(select.children[0].textContent,'变量: Literal["="]');assert.match(select.children[1].textContent,/^annotation · line 1$/);
 assert.match(select.title,/type annotation without assigning a value here/i);assert.match(select.title,/does not check runtime types/i);assert.doesNotMatch(select.title,/Stores a value/);
 const mapped=blocks(result).find(node=>node.kind==='annotation');select.listeners.click();assert.deepEqual(selected,[[mapped.from,mapped.to]]);
 current={ready:true,sourceRef:{...sourceRef,version:2}};select.listeners.click();assert.equal(selected.length,1);view.reconcile();assert.equal(find('analysisDefinitions').children.length,0);view.dispose();
});
