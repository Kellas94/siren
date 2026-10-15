import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {build} from 'esbuild';
import {buildPatchedPython} from '../build/python.mjs';

const desktop=fileURLToPath(new URL('../',import.meta.url));
const simple=['# comment Ș😀','class Example:','    def f(self, xs):','        return [x + 1 for x in xs if x > 0]','',''];
let root,cm,receipt;
before(async()=>{
 const parent=join(desktop,'evidence');await mkdir(parent,{recursive:true});root=await mkdtemp(join(parent,'python-indent-cm-'));
 receipt=await buildPatchedPython({baselinePath:join(desktop,'baseline/R78.html'),outputPath:join(root,'python.mjs')});
 const editor=join(desktop,'src/ui/code/editor.js');
 const entry=join(root,'entry.mjs'),output=join(root,'cm-test.mjs');
 await writeFile(entry,`export {pythonSupport} from ${JSON.stringify(editor.replaceAll('\\','/'))};\nexport {parser,LRParser} from './python.mjs';\nexport {parser as unbrandedParser} from '@lezer/python';\nexport {Parser,Tree} from '@lezer/common';\nexport {sirenPythonCanReuse as testCanReuse,ContextTracker} from './python-lr.mjs';\nexport {EditorState,Text} from '@codemirror/state';\nexport {ensureSyntaxTree,forceParsing,language,getIndentation,foldable} from '@codemirror/language';\nexport {TreeFragment} from '@lezer/common';\nexport {projectSourceLines,exactSourceExtensions,getSourceText} from ${JSON.stringify(join(desktop,'src/ui/code/source-newlines.js').replaceAll('\\','/'))};\n`);
 await build({entryPoints:[entry],outfile:output,bundle:true,platform:'node',format:'esm',target:'node24',alias:{'@lezer/lr':receipt.lrModulePath},nodePaths:[join(desktop,'node_modules')],plugins:[{name:'expose-unchanged-private-test-functions',setup(builder){
  builder.onLoad({filter:/[/\\]src[/\\]ui[/\\]code[/\\]editor\.js$/},async args=>{assert.equal(args.path,editor);const source=await readFile(editor,'utf8'),suffix='\nexport {pythonSupport};\n',contents=source+suffix;assert.equal(contents.slice(0,-suffix.length),source);return{contents,loader:'js'};});
  builder.onLoad({filter:/[/\\]python-lr\.mjs$/},async args=>{assert.equal(args.path,receipt.lrModulePath);const source=await readFile(receipt.lrModulePath,'utf8'),suffix='\nexport {sirenPythonCanReuse};\n',contents=source+suffix;assert.equal(contents.slice(0,-suffix.length),source);return{contents,loader:'js'};});
 }}]});
 cm=await import(pathToFileURL(output).href);
});

const fixtures=[
 ['simple',simple],
 ['nested',['# comment Ș😀','class Outer:','    class Inner:','        def method(self):','            def nested(x):','                return x + 1','            return nested(2)','    def other(self):','        return 3','','']],
 ['blocks',['# comment Ș😀','def work(xs):','    for x in xs:','        if x:','            try:','                with context() as y:','                    result = y + x','            except ValueError:','                result = 0','    return result','','']],
 ['brackets',['# comment Ș😀','def work(xs):','    values = [','        {','            "item": (x, x + 1),','        }','        for x in xs','    ]','    return values','','']],
 ['strings',['# comment Ș😀','class A:','    def work(self):','        message = """first','class TextOnly:','    pass','last"""','        raw = r"literal\\n"','        return f"{message}: {raw}"','','']],
 ['decorators',['# comment Ș😀','@first','@second("literal")','def work(x):','    return x + 1','class A:','    @staticmethod','    def other():','        return 2','','']],
 ['tabs',simple.map(s=>s.replace(/^        /,'\t\t').replace(/^    /,'\t'))],
 ['formfeed',simple.map(s=>s.startsWith('    ')?'\f'+s:s)],
 ['continuation',['# comment Ș😀','def work():','    value = 1 + \\','        2','    return value','','']],
 ['async-match',['# comment Ș😀','async def work(xs):','    async for x in xs:','        match x:','            case {"item": item}:','                yield item','    return','','']]
];
for(const [name,block] of fixtures)for(const newline of ['\n','\r\n'])test(`CodeMirror ${name} ${newline.length===1?'LF':'CRLF'} insert/delete matches every fresh node`,()=>{
 const text=Array(100).fill(block.join(newline)).join(newline),before=settled(state(text));assert.deepEqual(rows(tree(before)),rows(before.facet(cm.language).parser.parse(before.doc.toString())),`${name} before-edit full CM vs direct configured parser`);
 const from=text.indexOf('# comment',Math.floor(text.length/2)),end=from+text.slice(from).indexOf(newline)+newline.length;
 for(const [to,insert] of [[end,''],[from,'# added'+newline]]){
  const edited=text.slice(0,from)+insert+text.slice(to),next=settled(before.update({changes:{from,to,insert}}).state),fresh=settled(state(edited));
  assert.deepEqual(rows(tree(next)),rows(tree(fresh)),`${name} ${JSON.stringify(newline)} ${insert?'insert':'delete'}`);assert.equal(cm.getSourceText(next).sliceString(0),edited);
  for(const pos of [from,edited.indexOf('return',from)].filter(n=>n>=0)){
   assert.equal(cm.getIndentation(next,pos),cm.getIndentation(fresh,pos));
   const a=next.doc.lineAt(pos),b=fresh.doc.lineAt(pos);assert.deepEqual(cm.foldable(next,a.from,a.to),cm.foldable(fresh,b.from,b.to));
  }
 }
});

test('private Python guard rejects context-dependent/sparse reuse without input reads; unbranded core remains unchanged',()=>{
 const tracker=cm.parser.context;
 const parse={parser:{context:tracker},input:{length:123,read(){throw Error('guard must not read source');}},ranges:[{from:0,to:123}]};
 let calls=0;const node=hash=>({prop(){calls++;return hash;}});
 assert.equal(cm.testCanReuse(parse,node(0)),true);assert.equal(cm.testCanReuse(parse,node(undefined)),true);
 assert.equal(cm.testCanReuse(parse,node(34952)),false);assert.equal(calls,3);
 for(const ranges of [[{from:1,to:123}],[{from:0,to:122}],[{from:0,to:50},{from:51,to:123}]]){
  assert.equal(cm.testCanReuse({...parse,ranges},{prop(){throw Error('sparse nodes must not be inspected');}}),false);
 }
 const unbranded=new cm.ContextTracker(cm.parser.context);
 assert.equal(cm.testCanReuse({parser:{context:unbranded},get input(){throw Error('must not inspect non-opted parser');}},{prop(){throw Error('must not inspect non-opted node');}}),true);
});

test('incremental parse retains actual context-free cached nodes instead of disabling reuse',()=>{
 const text=Array(1200).fill(simple.join('\r\n')).join('\r\n'),old=cm.parser.parse(text),from=text.indexOf('# comment',Math.floor(text.length/2)),to=from+text.slice(from).indexOf('\r\n')+2,edited=text.slice(0,from)+text.slice(to);
 const fragments=cm.TreeFragment.applyChanges(cm.TreeFragment.addTree(old),[{fromA:from,toA:to,fromB:from,toB:from}]),parse=cm.parser.startParse(edited,fragments);let next,steps=0;while(!next){assert.ok(++steps<2000000);next=parse.advance();}
 assert.deepEqual(rows(next),rows(cm.parser.parse(edited)));assert.ok(parse.reused.length>0);assert.ok(parse.reused.reduce((n,t)=>n+t.length,0)>edited.length/4);
});
after(async()=>{if(root)await rm(root,{recursive:true,force:true});});

const rows=tree=>{const out=[];tree.iterate({enter:n=>out.push([n.name,n.from,n.to,n.type.isError])});return out;};
function state(text){const raw=cm.Text.of(text.split('\n'));return cm.EditorState.create({doc:cm.projectSourceLines(raw),extensions:[cm.pythonSupport(cm.parser),...cm.exactSourceExtensions(raw),cm.EditorState.lineSeparator.of('\n')]});}
function settled(s){const view={state:s,dispatch(spec){this.state=this.state.update(spec).state;}};assert.equal(cm.forceParsing(view,s.doc.length,2000),true);return view.state;}
function tree(s){const value=cm.ensureSyntaxTree(s,s.doc.length,2000);assert.ok(value,'bounded CodeMirror parse must complete');return value;}

test('actual CodeMirror Python support preserves class/function/body spans after middle comment deletion',()=>{
 for(const newline of ['\n','\r\n']){
  const text=Array(100).fill(simple.join(newline)).join(newline),old=settled(state(text));assert.equal(rows(tree(old)).filter(n=>n[3]).length,0);
  const from=text.indexOf('# comment',Math.floor(text.length/2)),to=from+text.slice(from).indexOf(newline)+newline.length,edited=text.slice(0,from)+text.slice(to);
  const next=settled(old.update({changes:{from,to,insert:''}}).state),actual=rows(tree(next)),fresh=rows(tree(settled(state(edited))));
  assert.equal(cm.getSourceText(next).sliceString(0),edited);
  assert.deepEqual(actual,fresh,`actual CM ${JSON.stringify(newline)} named spans`);
 }
});

test('exact derivative inverse and constructor provenance; unbranded parser still uses real cached nodes',async()=>{
 const raw=await readFile(new URL('../node_modules/@lezer/lr/dist/index.js',import.meta.url),'utf8');
 let source=await readFile(receipt.lrModulePath,'utf8');
 const helper=`const sirenPythonIndentTrackers = new WeakSet();
class SirenPythonContextTracker extends ContextTracker {
    constructor(spec) { super(spec); sirenPythonIndentTrackers.add(this); }
}
function sirenPythonCanReuse(parse, cached) {
    if (!sirenPythonIndentTrackers.has(parse.parser.context)) return true;
    const {input, ranges} = parse;
    return ranges.length === 1 && ranges[0].from === 0 && ranges[0].to === input.length
        && !cached.prop(NodeProp.contextHash);
}
`;
 for(const [after,before] of [[helper,''],['                if (!sirenPythonCanReuse(this, cached)) break;\n',''],['export { SirenPythonContextTracker, ContextTracker,','export { ContextTracker,'],['((_a = this.p.parser.nodeSet.types[type]) && !_a.isAnonymous)','!((_a = this.p.parser.nodeSet.types[type]) === null || _a === void 0 ? void 0 : _a.isAnonymous)']]){
  assert.equal(source.split(after).length,2);source=source.replace(after,before);
 }
 assert.equal(source,raw,'every upstream byte is restored');
 assert.equal(cm.parser.constructor,cm.LRParser);assert.equal(cm.unbrandedParser.constructor,cm.LRParser);
 assert.ok(cm.parser instanceof cm.Parser);assert.ok(cm.parser.parse('x=1\n') instanceof cm.Tree);
 assert.notEqual(cm.parser.context.constructor,cm.unbrandedParser.context.constructor);
 const text=Array(2000).fill('x = 1\ny = x + 1\n').join(''),old=cm.unbrandedParser.parse(text),parse=cm.unbrandedParser.startParse(text,cm.TreeFragment.addTree(old));
 let tree,steps=0;while(!tree){assert.ok(++steps<200000);tree=parse.advance();}
 assert.deepEqual(rows(tree),rows(old));assert.ok(parse.reused.length>0,'unbranded actual useNode remains active');
});
