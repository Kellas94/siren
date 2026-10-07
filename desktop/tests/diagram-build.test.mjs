import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {parseFragment} from 'parse5';
import {buildDiagramGuided} from '../build/diagram-guided.mjs';
const built=await buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)});
function api(){const window={},document={createElement:()=>({set innerHTML(value){const tree=parseFragment('<textarea>'+value+'</textarea>');this.value=tree.childNodes[0]?.childNodes[0]?.value??'';}})};vm.runInNewContext(built.script,{window,document,TextEncoder});assert.equal(typeof window.SirenNativeDiagramBuild?.inspect,'function');return window.SirenNativeDiagramBuild;}
test('Build edits actual block declarations and link endpoints without changing imported colours/frontmatter/comments or unselected nodes',()=>{
 const build=api(),source='---\r\nconfig:\r\n  theme: dark\r\n---\r\nflowchart TD\r\nA[Original]-->B[Next]\r\nA[Original]\r\nstyle A fill:#ff3366\r\n%% untouched note\r\n';
 const model=build.inspect(source);assert.equal(model.ok,true);assert.deepEqual(Array.from(model.nodes,n=>n.id),['A','B']);
 const edited=build.edit(source,{action:'edit-node',id:'A',label:'Context Ș😀 <script> "quote"',shape:'diamond',expectedSource:source});assert.equal(edited.ok,true);assert.equal(edited.source.split('\r\n')[7],'style A fill:#ff3366');assert.equal(edited.source.split('\r\n')[8],'%% untouched note');assert.ok(edited.source.startsWith(source.slice(0,source.indexOf('A[Original]'))));assert.ok(edited.source.includes('B[Next]'));assert.equal(edited.source.includes('<script>'),false);assert.equal(build.inspect(edited.source).nodes.find(n=>n.id==='A').shape,'diamond');
 assert.equal(build.edit(source,{action:'edit-node',id:'A',label:'wrong',shape:'rect',expectedSource:'stale'}).ok,false);
});
test('Build adds bounded new blocks/connections and direction, refuses collisions/unsupported diagram grammars and retains source',()=>{
 const build=api(),source='flowchart TD\r\nA[Start]-->B[Next]\r\nstyle A fill:#ff3366\r\n';
 const added=build.edit(source,{action:'add-node',id:'C',label:'Decision',shape:'diamond',expectedSource:source});assert.equal(added.ok,true);assert.ok(added.source.startsWith(source));assert.ok(added.source.endsWith('C{"Decision"}\r\n'));
 const linked=build.edit(added.source,{action:'connect',from:'B',to:'C',label:'Yes',arrow:'-->',expectedSource:added.source});assert.equal(linked.ok,true);assert.ok(linked.source.endsWith('B -->|"Yes"| C\r\n'));
 assert.equal(build.edit(source,{action:'add-node',id:'A',label:'Duplicate',shape:'rect',expectedSource:source}).ok,false);
 assert.equal(build.edit(source,{action:'connect',from:'A',to:'outside',arrow:'-->',label:'x',expectedSource:source}).ok,false);
 assert.equal(build.edit(source,{action:'direction',direction:'LR',expectedSource:source}).source,source.replace('flowchart TD','flowchart LR'));
 assert.equal(build.inspect('C4Context\nPerson(a,"Exact")').ok,false);assert.equal(build.inspect('sequenceDiagram\nA->>B: exact').ok,false);assert.equal(build.inspect('x'.repeat(50001)).ok,false);
});
