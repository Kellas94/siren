// Inert filesystem fixtures only. Never import inspected production sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,link,symlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const MODULE=new URL('./terminal-production-resources.mjs',import.meta.url);
const FIXTURES=fileURLToPath(new URL('../../evidence/workspace-surface/terminal-production-resources-20261009/disposable-fixtures/',import.meta.url));
const ROOTS=['desktop/src/terminal/production-backend.mjs','desktop/src/terminal/production-ownership.mjs','desktop/src/terminal/production-creator-entry.mjs'];
const AUX=['desktop/native/terminal-creator-three-lane/ownership.cc','desktop/native/terminal-creator-three-lane/peer-endpoints.inc','desktop/native/terminal-creator-three-lane/binding.gyp','desktop/runtime/terminal-provider/package.json','desktop/runtime/terminal-provider/package-lock.json'];
const LAUNCHER="import {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n";
const sha=b=>createHash('sha256').update(b).digest('hex');
async function api(){const m=await import(MODULE.href).catch(e=>e.code==='ERR_MODULE_NOT_FOUND'?null:Promise.reject(e));assert.ok(m,'production fixed-resource capture/preparation module is missing');return m;}
async function fixture(t,files={}){
 await mkdir(FIXTURES,{recursive:true});const base=await mkdtemp(path.join(FIXTURES,'siren-production-resources-test-')),sourceRoot=path.join(base,'source'),parentDirectory=path.join(base,'output');
 await mkdir(sourceRoot);await mkdir(parentDirectory);
 t.after(async()=>{assert.equal(path.dirname(path.resolve(base)),path.resolve(FIXTURES));assert.ok(path.basename(base).startsWith('siren-production-resources-test-'));await rm(base,{recursive:true,force:true});});
 async function put(relative,value){const p=path.join(sourceRoot,...relative.split('/'));await mkdir(path.dirname(p),{recursive:true});await writeFile(p,value);return p;}
 for(const r of ROOTS)await put(r,'export const inert = true;\n');
 for(const r of AUX)await put(r,r.endsWith('.json')?'{}\n':'// inert source fixture\n');
 for(const [r,b]of Object.entries(files))await put(r,b);
 return {base,sourceRoot,parentDirectory,put};
}

test('captures fixed roots, explicit auxiliaries, cyclic static closure, exports and builtins without executing code',async t=>{
 const m=await api(),f=await fixture(t,{
  [ROOTS[0]]:"import {value} from './shared.mjs'; import 'node:fs'; export {x} from './reexport.mjs';\nthrow Error('MUST_NOT_EXECUTE');\n",
  'desktop/src/terminal/shared.mjs':"import './production-backend.mjs'; export const value=1;\n",
  'desktop/src/terminal/reexport.mjs':"export * from './shared.mjs';\n"
 });
 const c=await m.captureProductionResources({sourceRoot:f.sourceRoot});
 assert.equal(c.nativeExecutionAdmitted,false);assert.equal(c.sourceOnly,true);assert.equal(c.sourceRootInspectionOnly,true);
 assert.deepEqual(c.entries.map(r=>r.relativePath),[...ROOTS,...AUX,'desktop/src/terminal/shared.mjs','desktop/src/terminal/reexport.mjs'].sort());
 assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.entries)&&c.entries.every(Object.isFrozen));
 assert.equal(c.entries.find(r=>r.relativePath===ROOTS[0]).sha256,sha(await readFile(path.join(f.sourceRoot,ROOTS[0]))));
 assert.equal(await m.recheckProductionResources(c),true);
});

test('new fixed provider-loader static import belongs to closure but loader is never executed',async t=>{
 const m=await api(),f=await fixture(t,{[ROOTS[2]]:"import {load} from './production-provider-loader.mjs';\n",'desktop/src/terminal/production-provider-loader.mjs':"import {createRequire} from 'node:module'; export function load(){throw Error('MUST_NOT_LOAD_NATIVE');}\n"});
 const c=await m.captureProductionResources({sourceRoot:f.sourceRoot});assert.ok(c.entries.some(r=>r.relativePath.endsWith('/production-provider-loader.mjs')));
});

test('comment, quoted text, regexp and template static lookalikes do not create imports',async t=>{
 const m=await api(),f=await fixture(t,{[ROOTS[0]]:"// import './absent.mjs'\n/* import './absent.mjs' */\nconst a=\"import './absent.mjs'\", b=/import absent/, c=`import './absent.mjs' ${1+2}`;\nexport const yes=true;\n"});
 assert.equal((await m.captureProductionResources({sourceRoot:f.sourceRoot})).entries.length,ROOTS.length+AUX.length);
});

for(const [name,code]of [
 ['literal dynamic import',"void import('./shared.mjs');"],
 ['computed dynamic import',"void import(name);"],
 ['dynamic import in template expression',"const x=`safe ${import('./shared.mjs')}`;"],
 ['bare dependency',"import x from 'node-pty';"],
 ['unknown node builtin',"import x from 'node:not-a-real-builtin';"],
 ['import attribute',"import './shared.mjs' with {type:'json'};"],
 ['escaping relative path',"import '../../../../outside.mjs';"],
 ['path alias traversal',"import './folder/../shared.mjs';"],
 ['query alias',"import './shared.mjs?x=1';"],
 ['file URL',"import 'file:///outside.mjs';"],
 ['absolute import',"import '/outside.mjs';"],
 ['backslash alias',"import '.\\\\shared.mjs';"]
])test('refuses '+name,async t=>{
 const m=await api(),f=await fixture(t,{[ROOTS[0]]:code,'desktop/src/terminal/shared.mjs':'export const x=1;'});
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('captures decoded static specifier without executing its module',async t=>{
 const m=await api(),f=await fixture(t,{[ROOTS[0]]:"import './\\u0073hared.mjs';",'desktop/src/terminal/shared.mjs':"throw Error('NEVER_EXECUTE');"});
 assert.ok((await m.captureProductionResources({sourceRoot:f.sourceRoot})).entries.some(r=>r.relativePath.endsWith('/shared.mjs')));
});

test('missing explicit dedicated lock is refused rather than replaced by fixture or ancestor',async t=>{
 const m=await api(),f=await fixture(t);await rename(path.join(f.sourceRoot,AUX[4]),path.join(f.sourceRoot,'irrelevant-lock.json'));
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('source files with additional hardlink names are refused',async t=>{
 const m=await api(),f=await fixture(t);await link(path.join(f.sourceRoot,ROOTS[0]),path.join(f.base,'outside-hardlink.mjs'));
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('Node-visible linked source root is refused',async t=>{
 const m=await api(),f=await fixture(t),alias=path.join(f.base,'alias');await symlink(f.sourceRoot,alias,process.platform==='win32'?'junction':'dir');
 await assert.rejects(m.captureProductionResources({sourceRoot:alias}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('Node-visible linked source subtree is refused',async t=>{
 const m=await api(),f=await fixture(t),old=path.join(f.sourceRoot,'desktop/src/terminal'),held=path.join(f.base,'held-terminal');await rename(old,held);await symlink(held,old,process.platform==='win32'?'junction':'dir');
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('case-only source file alias is refused on case-insensitive filesystems as well',async t=>{
 const m=await api(),f=await fixture(t,{[ROOTS[0]]:"import './SHARED.mjs';",'desktop/src/terminal/shared.mjs':'export const x=1;'});
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('capture refuses file and closure-count budgets without reading arbitrary installed resources',async t=>{
 const m=await api(),f=await fixture(t);await f.put(ROOTS[0],Buffer.alloc(1024*1024+1,32));
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED.*budget/i);
 const imports=[];for(let i=0;i<129;i++){const n='unit-'+i+'.mjs';imports.push("import './"+n+"';");await f.put('desktop/src/terminal/'+n,'export const x=1;');}
 await f.put(ROOTS[0],imports.join('\n'));
 await assert.rejects(m.captureProductionResources({sourceRoot:f.sourceRoot}),/PRODUCTION_RESOURCES_REFUSED.*budget/i);
});

test('source byte mutation and replacement invalidate privately retained capture',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot});await f.put(ROOTS[0],'export const inert=false;');
 await assert.rejects(m.recheckProductionResources(c),/PRODUCTION_RESOURCES_REFUSED/);
 await assert.rejects(m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory}),/PRODUCTION_RESOURCES_REFUSED/);
 assert.deepEqual(await readdir(f.parentDirectory),[]);
});

test('forged receipt, Proxy/options accessors and caller launcher template cannot authorize writes',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot});let observed=0;
 await assert.rejects(m.captureProductionResources(new Proxy({sourceRoot:f.sourceRoot},{get(){observed++;throw Error();}})),/PRODUCTION_RESOURCES_REFUSED/);
 await assert.rejects(m.captureProductionResources({get sourceRoot(){observed++;return f.sourceRoot;}}),/PRODUCTION_RESOURCES_REFUSED/);
 await assert.rejects(m.prepareProductionResources({capture:{...c},parentDirectory:f.parentDirectory}),/PRODUCTION_RESOURCES_REFUSED/);
 await assert.rejects(m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory,launcher:'evil'}),/PRODUCTION_RESOURCES_REFUSED/);
 assert.equal(observed,0);assert.deepEqual(await readdir(f.parentDirectory),[]);
});

test('prepares exclusive unique application and originals trees with exact fixed launcher, no compiled/install claims',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot}),p=await m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory});
 assert.ok(Object.isFrozen(p));assert.equal(p.nativeExecutionAdmitted,false);assert.equal(p.sourceOnly,true);
 assert.equal(await readFile(p.launcherPath,'utf8'),LAUNCHER);
 for(const e of c.entries){const source=await readFile(path.join(f.sourceRoot,e.relativePath));assert.deepEqual(await readFile(path.join(p.applicationDirectory,e.relativePath)),source);assert.deepEqual(await readFile(path.join(p.originalsDirectory,e.relativePath)),source);}
 const manifest=JSON.parse(await readFile(p.manifestPath,'utf8'));assert.equal(manifest.compiledNativeInventory,false);assert.equal(manifest.installedProviderInventory,false);assert.equal(manifest.providerGraphValidated,false);assert.equal(manifest.sourceRootInspectionOnly,true);assert.equal(manifest.launcher.sha256,sha(Buffer.from(LAUNCHER)));
 assert.equal(await m.recheckPreparedProductionResources(p),true);
 const p2=await m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory});assert.notEqual(p.directory,p2.directory);assert.equal(await readFile(p.launcherPath,'utf8'),LAUNCHER);
});

test('preparation refuses parent within source root and linked output parent before creating resources',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot});await mkdir(path.join(f.sourceRoot,'output'));
 await assert.rejects(m.prepareProductionResources({capture:c,parentDirectory:path.join(f.sourceRoot,'output')}),/PRODUCTION_RESOURCES_REFUSED/);
 const alias=path.join(f.base,'output-alias');await symlink(f.parentDirectory,alias,process.platform==='win32'?'junction':'dir');
 await assert.rejects(m.prepareProductionResources({capture:c,parentDirectory:alias}),/PRODUCTION_RESOURCES_REFUSED/);
 assert.deepEqual(await readdir(f.parentDirectory),[]);
});

test('prepared byte recheck covers application, originals, launcher and own manifest separately',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot});
 for(const choose of [p=>path.join(p.applicationDirectory,ROOTS[0]),p=>path.join(p.originalsDirectory,AUX[0]),p=>p.launcherPath,p=>p.manifestPath]){
  const p=await m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory});await writeFile(choose(p),'changed');
  await assert.rejects(m.recheckPreparedProductionResources(p),/PRODUCTION_RESOURCES_REFUSED/);
 }
 await assert.rejects(m.recheckPreparedProductionResources({directory:f.parentDirectory}),/PRODUCTION_RESOURCES_REFUSED/);
});

test('source-only prepared membership refuses extra file, empty directory and native/provider lookup shadows',async t=>{
 const m=await api(),f=await fixture(t),c=await m.captureProductionResources({sourceRoot:f.sourceRoot});
 for(const extra of ['extra.txt','empty-directory/','application/desktop/src/terminal/shadow.mjs','application/desktop/native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node','application/desktop/runtime/terminal-provider/node_modules/node-pty/lib/index.js']){
  const p=await m.prepareProductionResources({capture:c,parentDirectory:f.parentDirectory}),target=path.join(p.directory,...extra.split('/').filter(Boolean));
  if(extra.endsWith('/'))await mkdir(target);else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,'unexpected inert bytes');}
  await assert.rejects(m.recheckPreparedProductionResources(p),/PRODUCTION_RESOURCES_REFUSED/);
 }
});
