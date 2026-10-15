import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiagramGuided} from '../build/diagram-guided.mjs';
import {runInNewContext} from 'node:vm';
import {parseFragment} from 'parse5';
const api=await import('../src/documents/diagram-selection.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const inspect=input=>{assert.equal(typeof api.inspectDiagramSelection,'function','Missing qualified selection reader');return api.inspectDiagramSelection(input);};
test('branch/merge selection preserves exact internal edges and incoming/outgoing boundary',()=>{
 const source='flowchart LR\nX[Before] --> A[Check]\nA -->|"Yes"| B[Accept]\nA -->|"No"| C[Review]\nB --> D[Merge]\nC --> D\nD --> Y[After]';
 const result=inspect({source,nodeIds:['A','B','C']});assert.equal(result.ok,true,JSON.stringify(result));assert.deepEqual(result.nodes.map(n=>n.id),['A','B','C']);assert.deepEqual(result.edges.map(e=>[e.from,e.to,e.label]),[['A','B','"Yes"'],['A','C','"No"']]);assert.deepEqual(result.boundary.map(e=>[e.direction,e.from,e.to]),[['incoming','X','A'],['outgoing','B','D'],['outgoing','C','D']]);assert.equal(result.source.includes('X[Before]'),false);assert.equal(result.source.includes('D[Merge]'),false);assert.equal(result.source.includes('A -->|"Yes"| B'),true);
});
test('cycles and entity/escaped labels retain exact Mermaid tokens and explicit selected styles',()=>{
 const source='graph TD\nA["Value #quot; &amp; \\"x\\""] --> B{Decision}\nB -.->|"retry"| A\nstyle A fill:#ff3366,stroke:#111\nstyle B fill:#f0f\nclassDef hot fill:#123456,color:#fff\nclass A,B hot';
 const result=inspect({source,nodeIds:['A']});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.nodes[0].token,'A["Value #quot; &amp; \\"x\\""]');assert.equal(result.edges.length,0);assert.equal(result.boundary.length,2);assert.match(result.source,/style A fill:#ff3366/);assert.doesNotMatch(result.source,/style B/);assert.match(result.source,/classDef hot fill:#123456/);assert.match(result.source,/class A hot/);
});
test('missing identity never maps to a colliding label or shrinks the selection',()=>{
 const result=inspect({source:'flowchart TD\nA[Same]\nC[Same]',nodeIds:['A','B']});assert.equal(result.ok,false);assert.equal(result.code,'DIAGRAM_EMBED_SELECTION_MISSING');assert.deepEqual(result.missingNodeIds,['B']);assert.equal(Object.hasOwn(result,'source'),false);
});
test('ambiguous declarations/chains/groups/subgraphs/directives/foreign grammars refuse with Whole diagram fallback',()=>{
 for(const source of ['flowchart TD\nA[One]\nA[Two]','flowchart TD\nA --> B --> C','flowchart TD\nA & B --> C','flowchart TD\nsubgraph g\nA --> B\nend','flowchart TD\n%%{init: {"theme":"dark"}}%%\nA --> B','flowchart TD\nA --> B\nlinkStyle 0 stroke:red','sequenceDiagram\nA->>B: text','flowchart TD\nA[broken','flowchart TD\nA --> B\nclick A "https://example.com"']){
  const r=inspect({source,nodeIds:['A']});assert.equal(r.ok,false,source);assert.equal(r.code,'DIAGRAM_EMBED_SELECTION_UNSUPPORTED',source);assert.equal(r.wholeDiagramAvailable,true);
 }
});
test('selection has bounded strict IDs/source; discovery and shared Guided capability use the same reader',async()=>{
 for(const input of [{source:'flowchart TD\nA',nodeIds:['A','A']},{source:'x'.repeat(50001),nodeIds:['A']},{source:'flowchart TD\nA',nodeIds:['../A']}])assert.equal(inspect(input).ok,false);
 const source='flowchart TD\nA[Start] --> B[Next]',r=inspect({source,nodeIds:[]});assert.equal(r.ok,true);assert.deepEqual(r.nodes.map(n=>n.id),['A','B']);
 const built=await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)}),window={},document={createElement:()=>({set innerHTML(v){const tree=parseFragment('<textarea>'+v+'</textarea>');this.value=tree.childNodes[0]?.childNodes[0]?.value??'';}})};
 runInNewContext(built.script,{window,document,TextEncoder});assert.equal(typeof window.SirenNativeDiagramBuild.inspectSelection,'function');assert.deepEqual(JSON.parse(JSON.stringify(window.SirenNativeDiagramBuild.inspectSelection({source,nodeIds:['A']}))),inspect({source,nodeIds:['A']}));assert.deepEqual(Array.from(window.SirenNativeDiagramBuild.inspect(source).nodes,n=>n.id),r.nodes.map(n=>n.id));
});
