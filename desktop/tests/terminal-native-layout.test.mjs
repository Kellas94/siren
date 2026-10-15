import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,lstat,symlink,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {DESKTOP_NATIVE_RESOURCE_PATHS,captureDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths} from '../src/terminal/desktop-native-runtime-resources.mjs';
const desktop=fileURLToPath(new URL('../',import.meta.url)),parent=resolve(desktop,'../terminal-native-layout-20261012/fixtures');
const hash=b=>createHash('sha256').update(b).digest('hex');
const api=()=>import('../build/terminal-native-layout.mjs');
async function fixture(fn){await mkdir(parent,{recursive:true});const root=await mkdtemp(join(parent,'case-'));let success=false;try{await fn(root);success=true;}finally{if(success){assert(root.startsWith(parent+'\\')||root.startsWith(parent+'/'));assert(!(await lstat(root)).isSymbolicLink());await rm(root,{recursive:true});}}}
async function files(root,prefix=''){let out=[];for(const d of await readdir(root,{withFileTypes:true})){assert(!d.isSymbolicLink());const p=prefix?prefix+'/'+d.name:d.name;if(d.isDirectory())out.push(...await files(join(root,d.name),p));else out.push(p);}return out;}
test('fixed native source layout retains exact transitive source bytes and cannot admit native execution',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api(),out=join(root,'runtime'),r=await buildTerminalNativeSourceLayout({outputDir:out});
 assert.equal(r.nativeExecutionAdmitted,false);assert.equal(r.completeRuntimeClosure,false);assert.equal(r.nativeFactoryConfigured,false);assert.equal(r.normalPackageChanged,false);assert(r.sources.length>8&&r.sources.length<80);
 for(const row of r.sources){assert(row.path.startsWith('desktop/src/'));const actual=await readFile(join(out,...row.path.split('/'))),original=await readFile(join(desktop,...row.path.slice(8).split('/')));assert.deepEqual(actual,original);assert.equal(hash(actual),row.sha256);assert.equal(actual.length,row.bytes);}
 const output=await files(out);assert.deepEqual(output.sort(),[...r.sources.map(v=>v.path),'terminal-native-layout.json'].sort());assert(!output.some(p=>/\.node$|\.exe$|node_modules|tests\/|credentials|\.env/.test(p)));assert(r.externalResources.every(v=>v.state==='REQUIRED_NOT_STAGED'));assert(r.totalBytes<1024*1024);
 const manifest=JSON.parse(await readFile(join(out,'terminal-native-layout.json')));assert.deepEqual(manifest,JSON.parse(JSON.stringify(r)));
 });});
test('missing resource roster follows the actual critical guard and fixed filesystem loader',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api(),r=await buildTerminalNativeSourceLayout({outputDir:join(root,'runtime')});
 const loader=await readFile(join(desktop,'src/terminal/desktop-native-filesystem.mjs'),'utf8'),m=[...loader.matchAll(/new URL\('([^']+\.node)',import\.meta\.url\)/g)];assert.equal(m.length,1);
 const fsPath='desktop/'+fileURLToPath(new URL(m[0][1],new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url))).slice(desktop.length).replaceAll('\\','/');
 const present=new Set(r.sources.map(v=>v.path));assert.deepEqual(r.criticalResources.map(v=>v.path),[...DESKTOP_NATIVE_RESOURCE_PATHS,fsPath]);
 for(const row of r.criticalResources)assert.equal(row.state,present.has(row.path)?'SOURCE_STAGED':'REQUIRED_NOT_STAGED');assert(r.externalResources.some(v=>v.path===fsPath));assert.equal(r.providerTreeClosureVerified,false);
 });});
test('source layout refuses existing destination and source selectors without overwriting prior bytes',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api();await writeFile(join(root,'marker'),'original');await assert.rejects(buildTerminalNativeSourceLayout({outputDir:root}),/LAYOUT_OUTPUT_REFUSED/);assert.equal(await readFile(join(root,'marker'),'utf8'),'original');
 await assert.rejects(buildTerminalNativeSourceLayout({outputDir:join(root,'new'),sourceRoot:root}),/LAYOUT_ARGUMENT_REFUSED/);await assert.rejects(buildTerminalNativeSourceLayout({outputDir:join(desktop,'generated')}),/LAYOUT_OUTPUT_REFUSED/);
 });});
test('source-only manifest cannot stand in for a critical-resource receipt or supply missing binaries',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api(),out=join(root,'runtime'),r=await buildTerminalNativeSourceLayout({outputDir:out});assert.equal(desktopNativeRuntimeResourcePaths(r),null);
 await assert.rejects(captureDesktopNativeRuntimeResources({directory:out,pins:Object.fromEntries(DESKTOP_NATIVE_RESOURCE_PATHS.map(p=>[p,'0'.repeat(64)]))}));
 assert.equal(await readFile(join(out,'terminal-native-layout.json'),'utf8'),JSON.stringify(r,null,2)+'\n');
 });});
test('fixed source layout is deterministic across distinct fresh roots',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api(),a=await buildTerminalNativeSourceLayout({outputDir:join(root,'a')}),b=await buildTerminalNativeSourceLayout({outputDir:join(root,'b')});assert.deepEqual(a,b);assert.deepEqual(await files(join(root,'a')),await files(join(root,'b')));
 });});
test('a junction output ancestor is refused without following or changing its target',async()=>{await fixture(async root=>{
 const {buildTerminalNativeSourceLayout}=await api(),target=join(root,'target'),link=join(root,'link');await mkdir(target);await writeFile(join(target,'marker'),'outside target');await symlink(target,link,'junction');
 try{await assert.rejects(buildTerminalNativeSourceLayout({outputDir:join(link,'runtime')}),/LAYOUT_PATH_REFUSED/);assert.deepEqual(await readdir(target),['marker']);assert.equal(await readFile(join(target,'marker'),'utf8'),'outside target');}finally{await rm(link);} 
 });});
test('closed layout arguments refuse proxies and accessors without executing their hooks',async()=>{
 const {buildTerminalNativeSourceLayout}=await api();let calls=0;await assert.rejects(buildTerminalNativeSourceLayout(new Proxy({}, {ownKeys(){calls++;return [];}})),/LAYOUT_ARGUMENT_REFUSED/);await assert.rejects(buildTerminalNativeSourceLayout({get outputDir(){calls++;return parent;}}),/LAYOUT_ARGUMENT_REFUSED/);assert.equal(calls,0);
});
async function candidateHarness(){
 const text=await readFile(join(desktop,'build/terminal-window.mjs'),'utf8'),body=text.slice(text.indexOf('export async function buildTerminalDesktopCandidate')).replace('export async function','async function').replace('fileURLToPath(new URL(\'../\',import.meta.url))',JSON.stringify(desktop)).replace("await import('./renderer.mjs')",'rendererModule');
 const calls=[],saved=[],windowReceipt=Object.freeze({nativeAdmission:false}),layout=Object.freeze({completeRuntimeClosure:false,nativeExecutionAdmitted:false});
 const context={resolve,relative,isAbsolute,join,process:{platform:process.platform},cp:async()=>calls.push('copy-app-source'),readFile:async()=>Buffer.from('INERT PRELOAD'),writeFile:async(path,text)=>saved.push([path,text]),buildRenderer:async()=>calls.push('renderer'),buildTerminalWindow:async()=>windowReceipt,buildTerminalNativeSourceLayout:async options=>{calls.push(['layout',options]);return layout;}};
 context.rendererModule={buildRenderer:context.buildRenderer};
 vm.runInNewContext(body+'\nthis.run=buildTerminalDesktopCandidate;',context);return {context,calls,saved,layout,windowReceipt};
}
test('actual candidate builder keeps layout opt-in and records missing-resource receipt only when explicitly requested',async()=>{
 const normal=await candidateHarness(),out=resolve(desktop,'../terminal-native-layout-20261012/inert-output');await normal.context.run({outputDir:out,dependenciesRoot:parent});assert.equal(normal.calls.some(c=>Array.isArray(c)),false);assert(!Object.hasOwn(JSON.parse(normal.saved.at(-1)[1]),'nativeSourceLayout'));
 const selected=await candidateHarness();await selected.context.run({outputDir:out,dependenciesRoot:parent,nativeSourceLayout:true});const call=selected.calls.find(c=>Array.isArray(c));assert.equal(call[0],'layout');assert.equal(call[1].outputDir,join(out,'native-runtime'));const receipt=JSON.parse(selected.saved.at(-1)[1]);assert.deepEqual(receipt.nativeSourceLayout,selected.layout);assert.equal(receipt.nativeFactoryConfigured,false);assert.equal(receipt.normalPackageChanged,false);
 const refused=await candidateHarness();await assert.rejects(refused.context.run({outputDir:out,dependenciesRoot:parent,nativeSourceLayout:'yes'}),/Explicit native source layout/);assert.equal(refused.calls.length,0);
});
