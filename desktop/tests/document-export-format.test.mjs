import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parse} from 'parse5';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {documentContentVersion} from '../src/windows/docs.mjs';
const module=await import('../src/documents/export.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const digest=value=>createHash('sha256').update(Buffer.from(JSON.stringify(value))).digest('hex');
const projectId='00000000-0000-4000-8000-000000000001';
const document={id:'doc-a',title:'A < B · Ș😀',blocks:[{id:'h',kind:'heading',level:2,text:'Scope'},{id:'t',kind:'text',html:'<p>Hello <strong>world</strong> &amp; context.</p>'},{id:'p',kind:'prompt',label:'Agent instructions',text:'```\nprint("Ș😀")\r\n~~~'},{id:'table',kind:'table',headerRow:true,rows:[['Name','Value'],['a|b','<img src=x onerror=boom()>\nnext']]},{id:'c',kind:'checklist',items:[{text:'Verify',done:true}]},{id:'k',kind:'knowledge',rows:[{id:'row',name:'agent.py',sourceRef:{sourceId:'ref-a',version:3,sha256:'a'.repeat(64)}}]},{id:'unknown',kind:'future-kind',opaque:{approval:'IMPORTED_UNVERIFIED'}}],agent:{humanReview:'unknown'},comments:[{text:'Keep exact'}],releases:[{claim:'not independently verified'}],opaque:{v:17}};
const input=(format,doc=document)=>({format,projectId,document:doc,version:documentContentVersion(projectId,doc),sha256:digest(doc),projectRevision:7,exportedAt:'2026-10-07T00:00:00.000Z'});
const format=data=>{assert.equal(typeof module.formatSavedDocument,'function','Saved document formatter must exist');return module.formatSavedDocument(data);};
const nodes=node=>[node,...(node.childNodes??[]).flatMap(nodes),...(node.content?nodes(node.content):[])];
test('JSON archive preserves exact saved data and actual CAS/hash with honest references-only metadata',()=>{
 const before=JSON.stringify(document),result=format(input('json')),archive=JSON.parse(result.bytes.toString('utf8'));
 assert.deepEqual(archive.document,document);assert.equal(archive.format,'siren-document-archive');assert.equal(archive.schema,1);assert.equal(archive.sourcePolicy,'references-only');assert.equal(archive.version,input('json').version);assert.equal(archive.documentSha256,digest(document));assert.equal(archive.projectRevision,7);assert.equal(archive.exportedAt,'2026-10-07T00:00:00.000Z');assert.equal(result.extension,'json');assert.equal(JSON.stringify(document),before);
});
test('standalone HTML renders normal rich content, keeps exact archival appendix and has no active/external resources',()=>{
 const result=format(input('html')),html=result.bytes.toString('utf8'),tree=nodes(parse(html));
 assert.equal(result.extension,'html');assert.ok(tree.some(n=>n.tagName==='strong'&&n.childNodes[0]?.value==='world'));
 const archive=tree.find(n=>n.tagName==='pre'&&n.attrs.some(a=>a.name==='id'&&a.value==='siren-archive'));
 assert.deepEqual(JSON.parse(archive.childNodes.map(n=>n.value??'').join('')).document,document);
 assert.equal(tree.some(n=>['script','iframe','form','object','embed','svg','math','link','img'].includes(n.tagName)),false);
 assert.equal(tree.some(n=>n.attrs?.some(a=>/^on|^(?:src|href|srcdoc)$/i.test(a.name))),false);
 const policy=tree.find(n=>n.tagName==='meta'&&n.attrs.some(a=>a.value==='Content-Security-Policy')).attrs.find(a=>a.name==='content').value;
 assert.match(policy,/default-src 'none'/);assert.match(policy,/style-src 'sha256-/);assert.doesNotMatch(policy,/unsafe-inline/);
 const css=tree.find(n=>n.tagName==='style').childNodes[0].value;assert.ok(policy.includes(createHash('sha256').update(css).digest('base64')));
 assert.match(html,/references only/i);assert.match(html,/preserved data/i);assert.match(html,/IMPORTED_UNVERIFIED/);
});
test('unsafe and unknown rich structures remain escaped preserved data without executing markup',()=>{
 for(const html of ['<script>alert(1)</script><p>safe</p>','<img src="https://private.invalid/x" onerror="bad()">','<svg><foreignObject><iframe srcdoc=x></iframe></foreignObject></svg>','<p onclick=bad()>Hi</p>','<a href="file:///secret">Secret</a>']){
  const result=format(input('html',{id:'doc-a',title:'Unsafe',blocks:[{id:'x',kind:'text',html}]})),tree=nodes(parse(result.bytes.toString('utf8')));
  assert.equal(tree.some(n=>['script','img','svg','iframe','a'].includes(n.tagName)),false);assert.equal(tree.some(n=>n.attrs?.some(a=>a.name.startsWith('on'))),false);
  const archive=tree.find(n=>n.tagName==='pre'&&n.attrs.some(a=>a.value==='siren-archive'));assert.equal(JSON.parse(archive.childNodes[0].value).document.blocks[0].html,html);
 }
});
test('Markdown escapes table/fence controls and includes a complete indented JSON archive',()=>{
 const result=format(input('markdown')),text=result.bytes.toString('utf8');assert.equal(result.extension,'md');assert.match(text,/a\\\|b/);assert.match(text,/    ```\n    print/);assert.doesNotMatch(text,/^```/m);
 const raw=text.split('\nPreserved data (JSON archive)\n\n')[1];assert.ok(raw);assert.deepEqual(JSON.parse(raw.split('\n').map(line=>line.startsWith('    ')?line.slice(4):line).join('\n')).document,document);
 assert.match(text,/references only/i);assert.match(text,/\[x\] Verify/);assert.match(text,/future-kind/);
});
test('mismatched identity, malformed input, accessors, depth/node and read/output budgets refuse without coercion',()=>{
 const data=input('json');for(const value of [{...data,format:'pdf'},{...data,sha256:'0'.repeat(64)},{...data,version:'0'.repeat(64)},{...data,projectRevision:0},{...data,exportedAt:'invalid'},{...data,path:'arbitrary'}])assert.throws(()=>format(value));
 let invoked=false;const doc=Object.defineProperty({id:'doc-a'},'title',{enumerable:true,get(){invoked=true;return 'x';}});assert.throws(()=>format({...data,document:doc}));assert.equal(invoked,false);
 let nested={};for(let i=0;i<34;i++)nested={next:nested};assert.throws(()=>format({...data,document:{id:'doc-a',nested}}));
 assert.throws(()=>format({...data,document:{id:'doc-a',array:Array(50001).fill(0)}}));
 assert.throws(()=>format({...data,document:{id:'doc-a',text:'x'.repeat(8*1024*1024+1)}}));
 const large={id:'doc-a',title:'Expansion',blocks:[{kind:'prompt',text:'<'.repeat(4*1024*1024)}]};assert.throws(()=>format(input('html',large)),/EXPORT_BUDGET/);
});
test('complex rich blocks stop finite traversal and preserve full exact input in the appendix',()=>{
 const doc={id:'doc-a',title:'Complex',blocks:[{kind:'text',html:'<div>'.repeat(50)+'kept'+'</div>'.repeat(50)},{kind:'text',html:'<span>x</span>'.repeat(4200)}]};
 const bytes=format(input('html',doc)).bytes,tree=nodes(parse(bytes.toString('utf8'))),archive=tree.find(n=>n.tagName==='pre'&&n.attrs.some(a=>a.value==='siren-archive'));
 assert.deepEqual(JSON.parse(archive.childNodes[0].value).document,doc);assert.match(bytes.toString(),/formatting.*preserved/i);
});
test('jagged tables preflight aggregate rendered cells before Markdown padding; HTML never builds unused padded Markdown',()=>{
 const table=size=>({kind:'table',rows:[...Array.from({length:size},()=>[]),Array(size).fill('x')]}),jagged={id:'doc-a',blocks:[table(500)]};
 assert.throws(()=>format(input('markdown',jagged)),/EXPORT_BUDGET/);
 const html=format(input('html',jagged)).bytes.toString('utf8');assert.equal(nodes(parse(html)).filter(n=>n.tagName==='td').length,500);
 const multiple={id:'doc-a',blocks:[table(200),table(200)]};assert.throws(()=>format(input('markdown',multiple)),/EXPORT_BUDGET/);
});
test('lone CR cannot escape Markdown prompt/rich-fallback indentation into active HTML in the actual existing Markdown parser',async()=>{
 const baseline=await readFile(new URL('../baseline/R78.html',import.meta.url),'utf8');assert.equal(createHash('sha256').update(baseline).digest('hex'),'5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4');
 const from=baseline.indexOf('function _rt()'),to=baseline.indexOf('});function tYn(',from);assert.ok(from>=0&&to>from);const source=baseline.slice(from,to+3);assert.equal(createHash('sha256').update(source).digest('hex'),'dd1740338c5c2e0c294518274c37bcedeca14a4f7b944fe00ebf9c47bfd8e979');
 const context={i:value=>value,ee:fn=>fn};runInNewContext(source+';c2r();globalThis.marked=Iu;',context,{timeout:1000});
 for(const block of [{kind:'prompt',text:'kept\r<script>owned_synthetic()</script>\rnext'},{kind:'text',html:'<p onclick="owned()">kept</p>\r<img src="https://owned.invalid/test">'}]){
  const doc={id:'doc-a',title:'CR preservation',blocks:[block]},markdown=format(input('markdown',doc)).bytes.toString('utf8'),reading=markdown.split('\nPreserved data (JSON archive)')[0],tree=nodes(parse(context.marked(reading)));
  assert.equal(tree.some(n=>['script','img','iframe','svg','object','form'].includes(n.tagName)),false);
  const raw=markdown.split('\nPreserved data (JSON archive)\n\n')[1].split('\n').map(line=>line.startsWith('    ')?line.slice(4):line).join('\n');assert.deepEqual(JSON.parse(raw).document,doc);
 }
});
