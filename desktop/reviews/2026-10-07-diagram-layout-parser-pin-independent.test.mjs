import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createDiagramLayoutContract} from '../src/documents/diagram-layout.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8'),bundle=await read('generated/.diagram-build/diagram-engine.js');
// Extract exact version-pinned bundle expressions. These VM dependencies affect
// naming/theme variable defaults only; no parser, layout engine or DOM is run.
const naming=value=>value,rpStart=bundle.indexOf('Rp={')+3,rpEnd=bundle.indexOf('});var Cdr',rpStart),cStart=bundle.indexOf('Cdr={')+4,cEnd=bundle.indexOf(',Edr=i(',cStart);
assert.ok(rpStart>=3&&rpEnd>rpStart&&cStart>=4&&cEnd>cStart);
const Rp=vm.runInNewContext('('+bundle.slice(rpStart,rpEnd)+')',{i:naming}),Cdr=vm.runInNewContext('('+bundle.slice(cStart,cEnd)+')',{i:naming,Rp,$k:{default:{getThemeVariables:()=>({})}}});
const keyify=value=>Object.keys(value).flatMap(key=>Array.isArray(value[key])?[]:typeof value[key]==='object'&&value[key]!==null?[key,...keyify(value[key])]:[key]);
const Sdr=new Set(keyify(Cdr)),begin=bundle.indexOf('wV=i(t=>')+5,end=bundle.indexOf(',"sanitizeDirective")',begin);assert.ok(begin>=5&&end>begin);
const context={Pe:{debug(){}},Sdr,e$n:{},t$n(){},dQe:x=>x},sanitize=vm.runInNewContext('('+bundle.slice(begin,end)+')',context);context.wV=sanitize;
const contract=createDiagramLayoutContract(),scopes=['flowchart','class','state','er','requirement'];
test('independent actual bundled default schema and sanitizer drop legacy defaultRenderer and retain supported layout declarations',()=>{
 assert.equal(bundle.includes('defaultRenderer'),false);assert.equal(Sdr.has('defaultRenderer'),false);assert.equal(Sdr.has('layout'),true);
 for(const scope of scopes){const legacy={[scope]:{defaultRenderer:'dagre'}},global={layout:'dagre'},scoped={[scope]:{layout:'dagre'}};sanitize(legacy);sanitize(global);sanitize(scoped);assert.deepEqual(legacy,{[scope]:{}});assert.deepEqual(global,{layout:'dagre'});assert.deepEqual(scoped,{[scope]:{layout:'dagre'}});}
});
test('independent actual sanitized configuration explains both metadata choices while supported scoped/global layout retains ownership',async()=>{
 const diagnostic=JSON.parse(await read('evidence/diagram-layout-scoped-parser-matrix/2026-10-07T11-20-02.718Z/result.json'));
 for(const [family,scope,type]of [['flowchart','flowchart','flowchart-v2'],['classDiagram','class','classDiagram'],['stateDiagram','state','stateDiagram'],['er','er','er'],['requirement','requirement','requirement']])for(const choice of ['dagre','elk']){
  const parsed={[scope]:{defaultRenderer:'dagre'}};sanitize(parsed);assert.deepEqual(diagnostic.families[family].parsed[choice].config,parsed);assert.equal(contract.resolve(parsed,type,choice).sourceOwned,false);assert.equal(contract.resolve(parsed,type,choice).layout,choice);
  for(const supported of [{layout:'dagre'},{[scope]:{layout:'dagre'}}]){sanitize(supported);assert.equal(contract.resolve(supported,type,choice).sourceOwned,true);assert.equal(contract.resolve(supported,type,choice).layout,undefined);}
 }
});
test('independent original P3 CI witness is now rejected for missing utility execution and result retention',async()=>{
 const checker=await read('tests/diagram-layout-ci.test.mjs'),workflow=await read('../.github/workflows/desktop-verify.yml'),start=checker.indexOf('function verify('),stop=checker.indexOf('\ntest(',start),verify=vm.runInNewContext('('+checker.slice(start,stop)+')',{assert});verify(workflow);
 const step="      - name: Actual Diagram layout SVG and Present\n        if: matrix.group == 'diagrams'\n        run: node tests/native/diagram-layout-render.mjs\n";assert.ok(workflow.includes(step));assert.throws(()=>verify(workflow.replace(step,'')));assert.throws(()=>verify(workflow.replace(step,step+step)));
 for(const file of ['result.json','driver-result.json'])assert.throws(()=>verify(workflow.replaceAll('            desktop/evidence/diagram-layout-render/*/'+file+'\n','')));
});
