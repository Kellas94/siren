import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Only harmless synthetic JS packages are loaded; no entry, native/provider code,
// PTY or shell is executed. Root helper bytes are copied without modification.
const source=new URL('../src/terminal/production-provider-loader.mjs',import.meta.url);
async function fixture(t,{local=true,ancestor=false,manifest={},entry=true}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'siren-private-provider-'));
 const signal='siren-inert-provider-'+root;globalThis[signal]=[];
 t.after(()=>delete globalThis[signal]);
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const moduleDir=path.join(root,'desktop/src/terminal'),runtime=path.join(root,'desktop/runtime/terminal-provider');
 fs.mkdirSync(moduleDir,{recursive:true});fs.mkdirSync(runtime,{recursive:true});
 const helper=path.join(moduleDir,'production-provider-loader.mjs');fs.copyFileSync(source,helper);
 fs.writeFileSync(path.join(runtime,'package.json'),'{"private":true}');
 const localDir=path.join(runtime,'node_modules/node-pty'),ancestorDir=path.join(root,'desktop/node_modules/node-pty');
 function pack(dir,marker,includeEntry,extra={}){
  fs.mkdirSync(path.join(dir,'lib'),{recursive:true});
  // Matches the inspected node-pty 1.1.0 installed metadata, including './'.
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'node-pty',version:'1.1.0',main:'./lib/index.js',...extra}));
  if(includeEntry)fs.writeFileSync(path.join(dir,'lib/index.js'),`globalThis[${JSON.stringify(signal)}].push(${JSON.stringify(marker)});module.exports={marker:${JSON.stringify(marker)},spawn(){throw Error('INERT_SPAWN_MUST_NOT_RUN')}};`);
 }
 if(local)pack(localDir,'dedicated',entry,manifest);
 if(ancestor)pack(ancestorDir,'ancestor',true);
 const module=await import(pathToFileURL(helper).href);
 return {root,runtime,localDir,ancestorDir,signal,evaluations:()=>globalThis[signal],load:module.loadProductionPtyProvider};
}
test('fixed loader selects only the dedicated absolute lib/index.js without spawning',async t=>{
 const f=await fixture(t,{ancestor:true});assert.deepEqual(f.evaluations(),[]);const pty=f.load();assert.equal(pty.marker,'dedicated');assert.equal(typeof pty.spawn,'function');assert.deepEqual(f.evaluations(),['dedicated']);
});
test('missing dedicated package refuses an otherwise compatible ancestor provider',async t=>{
 const f=await fixture(t,{local:false,ancestor:true});assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('a missing private root manifest cannot enable ancestor fallback',async t=>{
 const f=await fixture(t,{local:false,ancestor:true});fs.unlinkSync(path.join(f.runtime,'package.json'));assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('partial local package cannot split local metadata from an ancestor entry',async t=>{
 const f=await fixture(t,{entry:false,ancestor:true});assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('local entry with missing metadata cannot borrow the ancestor manifest',async t=>{
 const f=await fixture(t,{ancestor:true});fs.unlinkSync(path.join(f.localDir,'package.json'));
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('missing package.json refuses Node extension fallback package.json.js',async t=>{
 const f=await fixture(t);fs.unlinkSync(path.join(f.localDir,'package.json'));
 fs.writeFileSync(path.join(f.localDir,'package.json.js'),`globalThis[${JSON.stringify(f.signal)}].push('manifest-alias');throw Error('MANIFEST_ALIAS_EXECUTED')`);
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('missing lib/index.js refuses Node extension fallback index.js.js',async t=>{
 const f=await fixture(t);fs.unlinkSync(path.join(f.localDir,'lib/index.js'));
 fs.writeFileSync(path.join(f.localDir,'lib/index.js.js'),`globalThis[${JSON.stringify(f.signal)}].push('entry-alias');throw Error('ENTRY_ALIAS_EXECUTED')`);
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('selected entry cannot become a directory with an alternate index',async t=>{
 const f=await fixture(t);const selected=path.join(f.localDir,'lib/index.js');fs.unlinkSync(selected);fs.mkdirSync(selected);
 fs.writeFileSync(path.join(selected,'index.js'),`globalThis[${JSON.stringify(f.signal)}].push('directory-alias');module.exports={spawn(){}}`);
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('selected manifest cannot become a directory with an alternate index',async t=>{
 const f=await fixture(t);const selected=path.join(f.localDir,'package.json');fs.unlinkSync(selected);fs.mkdirSync(selected);
 fs.writeFileSync(path.join(selected,'index.js'),`globalThis[${JSON.stringify(f.signal)}].push('manifest-directory-alias');module.exports={name:'node-pty',version:'1.1.0',main:'./lib/index.js'}`);
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
for(const [label,manifest] of [['version',{version:'9.0.0'}],['name',{name:'other'}],['main',{main:'../../outside.js'}],['main spelling',{main:'lib/index.js'}],['exports',{exports:{}}],['type',{type:'commonjs'}],['imports',{imports:{}}]])test('refuses wrong dedicated '+label,async t=>{
 const f=await fixture(t,{manifest});assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('refuses caller-selected resource arguments',async t=>{
 const f=await fixture(t,{ancestor:true});assert.throws(()=>f.load(f.ancestorDir),/CREATOR_PROVIDER_REFUSED/);
});
test('refuses spawn accessor without invoking it',async t=>{
 const f=await fixture(t);fs.writeFileSync(path.join(f.localDir,'lib/index.js'),`Object.defineProperty(module.exports,'spawn',{get(){globalThis[${JSON.stringify(f.signal)}].push('spawn-accessor');throw Error('ACCESSOR_EXECUTED')}})`);
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);assert.deepEqual(f.evaluations(),[]);
});
test('refuses a missing or nonfunction spawn export',async t=>{
 const f=await fixture(t);fs.writeFileSync(path.join(f.localDir,'lib/index.js'),'module.exports={spawn:42}');
 assert.throws(()=>f.load(),/CREATOR_PROVIDER_REFUSED/);
});
