// SOURCE_ONLY actual provisioner-copy and literal import composition; no runtime/provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const D='desktop/tests/native/terminal-fresh-pair-driver.mjs',W='desktop/tests/native/terminal-fresh-pair-worker.mjs',P='desktop/tests/native/terminal-fresh-runtime-provision.mjs';
const manifest=()=>JSON.parse(read('desktop/tests/native/terminal-fresh-runtime-provision-inputs.json'));
const historical=JSON.parse(read('terminal-fresh-provisioner-preparation-20261011/historical-execution-mapping.json'));
async function materialization(previous=false){
 const before=p=>read('terminal-parent-permit-retained-closure-20261012/before/'+p.replaceAll('/','__'));const source=previous?before(P):read(P),line=source.split('\n').find(s=>s.includes("const diagnostics=path.join(live,'diagnostics')"));assert.ok(line);
 const copies=[],m=previous?JSON.parse(before('desktop/tests/native/terminal-fresh-runtime-provision-inputs.json')):manifest(),ctx=vm.createContext({path:path.posix,live:'/owned/fresh-runtime',c:{root:'/source'},checked:{data:m,map:new Map(m.inputs.map(r=>[r.path,r]))},mkdir:async()=>{},copyPinned:async(source,target,pin)=>{copies.push({source,target,pin});}});
 await new vm.Script('(async()=>{'+line+'})()').runInContext(ctx,{timeout:500});
 return {copies,files:new Set([...historical.sourceGraph.map(r=>'/owned/fresh-runtime/execution/'+r.path),...copies.map(r=>r.target)])};
}
function importLine(source){return source.match(/const \{TerminalControlChannel\}=await [^;]+;/)?.[0];}
async function literalImport(text,files){
 const context=vm.createContext({path:path.posix,join:path.posix.join,dirname:path.posix.dirname,pathToFileURL:p=>new URL('file://'+p),retained:'/owned/fresh-runtime',execution:'/owned/fresh-runtime/execution'}),seen=[];
 const line=importLine(text);assert.ok(line,'literal control class import');
 const prefix="const importExecution=p=>import(pathToFileURL(join(execution,p)).href);";
 const mod=new vm.SourceTextModule(prefix+line,{context,importModuleDynamically:async url=>{const file=new URL(url).pathname;seen.push(file);assert.equal(files.has(file),true,'DECLARED_RETAINED_MODULE_MISSING '+file);const target=new vm.SyntheticModule(['TerminalControlChannel'],function(){this.setExport('TerminalControlChannel',class{});},{context});await target.link(()=>{});await target.evaluate();return target;}});await mod.link(()=>{});await mod.evaluate({timeout:500});return seen;
}
test('actual driver class import is materialized by actual declared provisioner copy layout',async()=>{const built=await materialization();assert.deepEqual(await literalImport(read(D),built.files),['/owned/fresh-runtime/diagnostics/desktop/src/terminal/control-channel.mjs']);});
test('actual worker class import is materialized independently of historical execution55',async()=>{const built=await materialization();assert.deepEqual(await literalImport(read(W),built.files),['/owned/fresh-runtime/diagnostics/desktop/src/terminal/control-channel.mjs']);assert.equal(historical.sourceGraph.length,55);assert.equal(historical.sourceGraph.some(r=>r.path==='desktop/src/terminal/control-channel.mjs'),false);});
test('class relative contracts import has its exact unchanged sibling in diagnostics and manifest',async()=>{const built=await materialization(),m=manifest();for(const name of ['control-channel','contracts']){const p='desktop/src/terminal/'+name+'.mjs',r=m.inputs.find(r=>r.path===p);assert.ok(r,p);const bytes=readFileSync(new URL(p,root));assert.equal(r.bytes,bytes.length);assert.equal(r.sha256,createHash('sha256').update(bytes).digest('hex'));assert.ok(built.files.has('/owned/fresh-runtime/diagnostics/'+p));}assert.match(read('desktop/src/terminal/control-channel.mjs'),/from '\.\/contracts\.mjs'/);});

test('genuine failed-candidate before copies reproduce both absent actual imports with corrected platform-neutral URL fixture',async()=>{const built=await materialization(true);for(const p of [D,W])await assert.rejects(literalImport(read('terminal-parent-permit-retained-closure-20261012/before/'+p.replaceAll('/','__')),built.files),/DECLARED_RETAINED_MODULE_MISSING \/owned\/fresh-runtime\/execution\/desktop\/src\/terminal\/control-channel.mjs/);});

async function controllerPins(mismatch=null){const source=read(D),names=source.match(/const controllerNames=([^;]+);/)[0],line=source.split('\n').find(x=>x.includes("stage='CONTROLLER_PINS';")),calls=[],ctx=vm.createContext({path:path.posix,assert,provision:{root:'/source'},retained:'/owned/fresh-runtime',pin:async p=>{calls.push(p);return {path:p,bytes:p==='/owned/fresh-runtime/diagnostics/'+mismatch?2:1,sha256:'a'};}});await new vm.Script('(async()=>{let stage;'+names+line+'return controllerPins;})()').runInContext(ctx,{timeout:500});return calls;}
test('actual controller source/copy pin loop includes both module copies and rejects either byte drift',async()=>{const calls=await controllerPins();for(const p of ['desktop/src/terminal/control-channel.mjs','desktop/src/terminal/contracts.mjs']){assert.ok(calls.includes('/source/'+p));assert.ok(calls.includes('/owned/fresh-runtime/diagnostics/'+p));await assert.rejects(controllerPins(p),/Expected values to be strictly equal/);}});
test('every closure source insertion reverses exactly; class/contracts/helper and historical mapping bytes stay unchanged',()=>{const ns='terminal-parent-permit-retained-closure-20261012/',delta=JSON.parse(read(ns+'closure-source-delta.json')).replacements;for(const p of new Set(delta.map(r=>r.path))){let text=read(p);for(const row of delta.filter(r=>r.path===p).reverse()){assert.equal(text.split(row.after).length,2);text=text.replace(row.after,row.before);}assert.equal(text,read(ns+'before/'+p.replaceAll('/','__')));}const old=JSON.parse(read(ns+'unchanged-source-pins.json'));for(const p of ['desktop/src/terminal/control-channel.mjs','desktop/src/terminal/contracts.mjs','desktop/tests/native/terminal-fresh-parent-permit.mjs','terminal-fresh-provisioner-preparation-20261011/historical-source-mapping.json','terminal-fresh-provisioner-preparation-20261011/historical-execution-mapping.json']){const row=old.rows.find(r=>r.path===p);assert.ok(row,p);const bytes=readFileSync(new URL(p,root));assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}});
