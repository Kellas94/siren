import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,readFile,writeFile,link} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPatchedPython} from '../build/python.mjs';
import {TreeFragment,Parser,Tree} from '@lezer/common';
const baseline=fileURLToPath(new URL('../baseline/R78.html',import.meta.url));
const baselineHash='5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4';
const block=['# literal Șiren 😀 — never executed','@decorator','class Example:','    async def run(self, value):','        match value:','            case {"item": item}:','                return [x for x in item if x]','    def values(self):','        yield from range(4)','    def nested(self):','        def inner(x):','            return x + 1','        return inner(2)','text = """first','second','third"""','items = {x: x*x for x in range(3)}','if False:','    raise RuntimeError("DO_NOT_EXECUTE")',''];
let root,parser,receipt;
before(async()=>{
 const parent=fileURLToPath(new URL('../evidence/',import.meta.url));await mkdir(parent,{recursive:true});
 root=await mkdtemp(join(parent,'python-crlf-scalability-'));
 const outputPath=join(root,'parser.mjs');receipt=await buildPatchedPython({baselinePath:baseline,outputPath});
 ({parser}=await import(pathToFileURL(outputPath).href));
});
after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
function parse(text){const errors=[],classes=[],variables=[];parser.parse(text).iterate({enter(n){if(n.type.isError)errors.push([n.from,n.to]);if(n.name==='ClassDefinition')classes.push([n.from,n.to]);if(n.name==='VariableName')variables.push([n.from,n.to]);}});return {errors,classes,variables};}
test('160 complex CRLF blocks parse without invented errors and retain original offsets',()=>{
 const text=Array(160).fill(block.join('\r\n')).join('\r\n'),r=parse(text);
 assert.deepEqual(r.errors,[]);assert.equal(r.classes.length,160);
 const expected=[...text.matchAll(/class Example:/g)].map(m=>m.index);
 assert.deepEqual(r.classes.map(c=>c[0]),expected);
 assert.equal(r.variables.filter(([a,b])=>text.slice(a,b)==='Example').length,160);
});
test('5000 complex CRLF blocks remain syntactically valid beyond the analysis prefix',()=>{
 const text=Array(5000).fill(block.join('\r\n')).join('\r\n'),r=parse(text);
 assert.deepEqual(r.errors,[]);assert.equal(r.classes.length,5000);
 assert.equal(text.slice(r.classes.at(-1)[0],r.classes.at(-1)[0]+14),'class Example:');
});
test('LF and lone CR keep their original coordinate units',()=>{
 for(const newline of ['\n','\r']){
  const text='# Ș😀'+newline+'class First:'+newline+'    pass'+newline+'class Last:'+newline+'    pass'+newline,r=parse(text);
  assert.deepEqual(r.errors,[]);assert.deepEqual(r.classes.map(c=>c[0]),[text.indexOf('class First:'),text.indexOf('class Last:')]);
 }
});
test('bracketed CRLF and multiline Unicode strings retain raw variable offsets',()=>{
 const text='values = [\r\n    "Ș😀",\r\n    {\r\n        "item": 2,\r\n    },\r\n]\r\ntext = """first\r\nsecond\r\nthird"""\r\nafter = values\r\n';
 const r=parse(text);assert.deepEqual(r.errors,[]);
 assert.ok(r.variables.some(([a,b])=>a===text.indexOf('after =')&&text.slice(a,b)==='after'));
});
test('malformed Python is still reported and the frozen factory input remains exact',async()=>{
 assert.ok(parse('def broken(:\r\n    pass\r\n').errors.length>0);
 assert.equal(receipt.baselineSha256,baselineHash);
 assert.equal(receipt.factorySha256,'c3b436db7d8d79ae712772ec1ffccb60381f9bfcf5f35646d3e838e2b9a0592b');
 assert.equal(createHash('sha256').update(await readFile(baseline)).digest('hex'),baselineHash);
});

// Exact root-authored adverse oracles, with local identifiers only.
const LF=String.fromCharCode(10),CR=String.fromCharCode(13);
const reviewBlock=['# Șiren 😀 literal input','class Example:','    def compute(self, rows):','        result = [','            row + 1','            for row in rows','            if row > 0','        ]','        try:','            return {"result": result}','        except ValueError as problem:','            raise problem','note = """first','second','third"""',''];
function treeNodes(tree){const rows=[];tree.iterate({enter:n=>rows.push([n.name,n.from,n.to,n.type.isError])});return rows;}
test('all syntax-node spans match LF under mixed physical newline encodings',()=>{const base=Array(320).fill(reviewBlock.join(LF)).join(LF),map=new Array(base.length+1),parts=[];let offset=0,line=0;for(let i=0;i<base.length;i++){map[i]=offset;const value=base[i]===LF?[CR+LF,LF,CR][line++%3]:base[i];parts.push(value);offset+=value.length;}map[base.length]=offset;const mixed=parts.join(''),a=treeNodes(parser.parse(base)),b=treeNodes(parser.parse(mixed));assert.ok(base.length>80000);assert.equal(a.filter(n=>n[3]).length,0);assert.equal(b.filter(n=>n[3]).length,0);assert.deepEqual(b,a.map(([name,from,to,error])=>[name,map[from],map[to],error]));});
test('incremental CRLF parse after a middle insertion equals a fresh parse',()=>{const source=Array(500).fill(reviewBlock.join(CR+LF)).join(CR+LF),old=parser.parse(source);assert.equal(treeNodes(old).filter(n=>n[3]).length,0);const position=source.indexOf('class Example:',Math.floor(source.length/2)),addition='# inserted Ș😀'+CR+LF;assert.ok(position>0);const edited=source.slice(0,position)+addition+source.slice(position),fragments=TreeFragment.applyChanges(TreeFragment.addTree(old),[{fromA:position,toA:position,fromB:position,toB:position+addition.length}]);const incremental=treeNodes(parser.parse(edited,fragments)),fresh=treeNodes(parser.parse(edited));assert.equal(incremental.filter(n=>n[3]).length,0);assert.deepEqual(incremental,fresh);});

test('real named-expression depth safeguard remains active',()=>{
 const text='value = a'+' + a'.repeat(5000)+'\n',parse=parser.startParse(text);let tree,named='';const wrapped=new WeakSet();let guardObserved=false;
 while(!tree){
  for(const stack of parse.stacks){if(wrapped.has(stack))continue;wrapped.add(stack);const reduce=stack.reduce;stack.reduce=function(action){const prior=parse.bigReductionCount,value=Reflect.apply(reduce,this,[action]),type=parser.nodeSet.types[action&65535];if(parse.bigReductionCount>prior&&type&&!type.isAnonymous)named=type.name;return value;};}
  if(parse.bigReductionCount>300&&parse.stacks.length===1){assert.equal(named,'BinaryExpression');guardObserved=true;}
  tree=parse.advance();
 }
 assert.equal(guardObserved,true,'the existing named/deep limit must still run');assert.ok(treeNodes(tree).some(n=>n[3]),'guard-limited tree remains explicitly partial');
});
test('unrelated existing LR sibling is refused without overwriting it',async()=>{
 const collision=join(root,'collision');await mkdir(collision);const path=join(collision,'python-lr.mjs');await (await import('node:fs/promises')).writeFile(path,'retain unrelated bytes');
 await assert.rejects(buildPatchedPython({baselinePath:baseline,outputPath:join(collision,'parser.mjs')}),{code:'OUTPUT_REFUSED'});
 assert.equal(await readFile(path,'utf8'),'retain unrelated bytes');
});
test('parser output cannot collide with the fixed shared LR sibling',async()=>{
 const collision=join(root,'output-collision');await mkdir(collision);await assert.rejects(buildPatchedPython({baselinePath:baseline,outputPath:join(collision,'python-lr.mjs')}),{code:'OUTPUT_REFUSED'});
});

test('shared core and complete MIT notice have exact pinned provenance and shared common identity',async()=>{
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const core=await import(pathToFileURL(receipt.lrModulePath).href);
 assert.equal(parser.constructor,core.LRParser);assert.equal(parser instanceof Parser,true);assert.equal(parser.parse('x=1\n') instanceof Tree,true);
 assert.equal(receipt.lrSourceSha256,'8d9b94f7c47b5226914e60613ec8bb49c3c3043df4e8d78ee7d19852fe34d582');
 assert.equal(hash(await readFile(receipt.lrModulePath)),receipt.lrPatchedSha256);
 assert.equal(receipt.lrPatchedSha256,'ed284a689b1c5b0f8ec17c869107bcce28c7dba8baecd1d5cba8a9ca103d533b');
 assert.deepEqual(await readFile(join(root,'python-lr.LICENSE.txt')),await readFile(new URL('../node_modules/@lezer/lr/LICENSE',import.meta.url)));
 assert.equal(hash(await readFile(join(root,'python-lr.LICENSE.txt'))),receipt.lrLicenseSha256);
});

test('existing exact core hardlink is refused without writing either alias',async()=>{
 const directory=join(root,'linked-core');await mkdir(directory);const sibling=join(directory,'python-lr.mjs');await link(receipt.lrModulePath,sibling);
 const original=await readFile(receipt.lrModulePath);await assert.rejects(buildPatchedPython({baselinePath:baseline,outputPath:join(directory,'parser.mjs')}),{code:'OUTPUT_REFUSED'});
 assert.deepEqual(await readFile(sibling),original);assert.deepEqual(await readFile(receipt.lrModulePath),original);
});

test('unrelated parser output and linked output are refused without overwrite',async()=>{
 const directory=join(root,'output-retained');await mkdir(directory);const outputPath=join(directory,'parser.mjs');await writeFile(outputPath,'retain parser bytes');
 await assert.rejects(buildPatchedPython({baselinePath:baseline,outputPath}),{code:'OUTPUT_REFUSED'});assert.equal(await readFile(outputPath,'utf8'),'retain parser bytes');
 const alias=join(directory,'alias.mjs');await link(outputPath,alias);await assert.rejects(buildPatchedPython({baselinePath:baseline,outputPath:alias}),{code:'OUTPUT_REFUSED'});assert.equal(await readFile(outputPath,'utf8'),'retain parser bytes');
});
