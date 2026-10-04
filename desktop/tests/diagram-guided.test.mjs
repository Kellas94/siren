import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {parseFragment} from 'parse5';
const implementation=await import('../build/diagram-guided.mjs').catch(cause=>{if(cause.code!=='ERR_MODULE_NOT_FOUND')throw cause;return {};});
async function fixture(){
 assert.equal(typeof implementation.buildDiagramGuided,'function','Frozen Guided helper builder must exist');
 const built=await implementation.buildDiagramGuided({baselinePath:new URL('../baseline/R78.html',import.meta.url)}),window={};
 const document={createElement:()=>({set innerHTML(value){const tree=parseFragment('<textarea>'+value+'</textarea>');this.value=tree.childNodes[0]?.childNodes[0]?.value??'';}})};
 vm.runInNewContext(built.script,{window,document,TextEncoder});assert.equal(typeof window.SirenNativeGuided?.inspect,'function');return window.SirenNativeGuided;
}
test('frozen Guided parses flowchart chips/inline labels while preserving complete CRLF, frontmatter and unknown syntax',async()=>{
 const api=await fixture(),source='---\r\nconfig:\r\n  theme: dark\r\n---\r\nflowchart TD\r\n  A[Start] -- Yes --> B[Next]\r\nstyle A fill:#ff3366\r\n';
 const before=createHash('sha256').update(source).digest('hex'),read=api.inspect(source);assert.equal(read.ok,true);assert.equal(read.rows[4].kind,'header');assert.equal(read.rows[5].kind,'link');assert.equal(read.rows[5].label,'Yes');assert.equal(read.rows[6].kind,'code');
 for(let index=0;index<4;index++)assert.equal(read.rows[index].kind,'code');
 assert.equal(read.rows.map(row=>row.text+row.ending).join(''),source);assert.equal(createHash('sha256').update(source).digest('hex'),before);
 const edit=api.edit(source,{index:4,expectedLine:'flowchart TD',field:'direction',value:'LR'});assert.equal(edit.ok,true);assert.equal(edit.source,source.replace('flowchart TD','flowchart LR'));
 const refused=api.edit(source,{index:5,expectedLine:'changed elsewhere',field:'label',value:'Wrong'});assert.equal(refused.ok,false);assert.equal(refused.code,'GUIDED_LINE_CHANGED');
});
test('Guided single-field edits preserve imported colour lines and unrelated labels and escape executable/literal input',async()=>{
 const api=await fixture(),source='flowchart TD\nA[Start]-->B[Next]\nstyle A fill:#ff3366\n%% exact note\n';
 const edited=api.edit(source,{index:1,expectedLine:'A[Start]-->B[Next]',field:'label',value:'<script>|" & context'});assert.equal(edited.ok,true);
 assert.equal(edited.source.split('\n')[2],'style A fill:#ff3366');assert.equal(edited.source.split('\n')[3],'%% exact note');assert.equal(edited.source.includes('<script>'),false);assert.ok(edited.source.includes('&lt;script&gt;'));assert.ok(edited.source.includes('B[Next]'));
 for(const field of ['source','projectId','unknown'])assert.equal(api.edit(source,{index:1,expectedLine:'A[Start]-->B[Next]',field,value:'anything'}).ok,false);
 const node=api.edit(source,{index:1,expectedLine:'A[Start]-->B[Next]',field:'fromLabel',value:'Changed context'});assert.equal(node.ok,true);assert.equal(node.source,'flowchart TD\nA["Changed context"] --> B[Next]\nstyle A fill:#ff3366\n%% exact note\n');
});
test('other diagram grammars remain exact raw rows; long/ambiguous chains fall back and finite source budgets refuse',async()=>{
 const api=await fixture(),sequence='sequenceDiagram\nA->>B: context\nactivate B\n';const read=api.inspect(sequence);assert.equal(read.ok,true);assert.equal(read.rows[2].kind,'code');
 const raw=api.edit(sequence,{index:1,expectedLine:'A->>B: context',field:'text',value:'A->>B: changed'});assert.equal(raw.ok,true);assert.equal(raw.source,sequence.replace('context','changed'));
 const long='flowchart TD\n'+Array.from({length:200},(_,i)=>'N'+i).join('-->');assert.equal(api.inspect(long).rows[1].kind,'code');
 const huge='x'.repeat(50001);assert.equal(api.inspect(huge).code,'GUIDED_BUDGET');assert.equal(api.edit(sequence,{index:0,expectedLine:'sequenceDiagram',field:'text',value:'x'.repeat(513)}).ok,false);
});
