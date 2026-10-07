import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseFragment,serialize} from 'parse5';
import vm from 'node:vm';
const source=await readFile(new URL('../src/ui/docs/rich.js',import.meta.url),'utf8');
function api(){const window={},convert=node=>node.nodeName==='#text'?{nodeType:3}:node.nodeName==='#document-fragment'?{nodeType:11,childNodes:node.childNodes.map(convert)}:{nodeType:1,nodeName:node.tagName?.toUpperCase(),attributes:node.attrs?.map(attr=>({name:attr.name,value:attr.value}))??[],childNodes:node.childNodes?.map(convert)??[]};
 const document={createElement(tag){assert.equal(tag,'template');let tree;return {set innerHTML(value){tree=parseFragment(value);this.content=convert(tree);},get innerHTML(){return serialize(tree);}};}};
 vm.runInNewContext(source,{window,document});return window.SirenNativeDocsRichText;
}
test('rich editing accepts inert formatting and original palette classes while preserving the original block until editing',()=>{
 const rich=api(),html='<p><strong>Ș😀</strong> <em>context</em> <span class="wp-c-blue">blue</span></p><ul><li>Item</li></ul>',block={id:'rich',kind:'text',role:'purpose',html};
 assert.equal(rich.inspect(html).ok,true);assert.equal(rich.editable(block),true);assert.equal(block.html,html);assert.equal(rich.styleColor('color: #2563eb;'),'#2563eb');
});
test('unsupported attributes, executable/resource HTML and oversized/deep rich blocks stay preserved rather than converted',()=>{
 const rich=api();for(const html of ['<script>alert(1)</script>','<img src="https://example.invalid/a">','<p onclick="bad()">Text</p>','<a href="file:///private">Link</a>','<span style="color:red;background:url(x)">Text</span>','<span style="color:var(--private)">Text</span>','<span class="wp-c-blue unknown">Text</span>','<span style="color:blue">Text</span>','<p class="wp-c-blue">Text</p>','<svg><script>bad()</script></svg>','<custom data-exact="kept">Text</custom>','<p><!-- exact comment --></p>','<div>'.repeat(33)+'text'+'</div>'.repeat(33),'x'.repeat(131073),'\uD800'])assert.equal(rich.inspect(html).ok,false,html.slice(0,80));
 assert.equal(rich.editable({id:'x',kind:'text',html:'<p>Exact</p>',opaque:'preserve'}),false);
});
