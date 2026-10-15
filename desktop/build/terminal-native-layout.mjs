// Explicit source-layout preparation only. No module/native execution or default wiring.
import {mkdir,lstat,realpath,open,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join,relative,isAbsolute,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {build} from 'esbuild';
import {DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
const desktop=fileURLToPath(new URL('../',import.meta.url)),sourceRoot=join(desktop,'src');
const roots=Object.freeze(['src/terminal/desktop-native-runtime-creator.mjs','src/terminal/desktop-native-runtime-host.mjs','src/terminal/desktop-native-filesystem.mjs','src/terminal/desktop-native-runtime-resources.mjs']);
const hash=b=>createHash('sha256').update(b).digest('hex'),fail=code=>{throw Error(code);};
const inside=(p,root)=>{const r=relative(root,p);return !r||!isAbsolute(r)&&r!=='..'&&!r.startsWith('..\\')&&!r.startsWith('../');};
const identity=s=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs','birthtimeNs'].map(k=>String(s[k])).join(':');
async function directories(path){
 const rows=[];for(let p=path;;p=dirname(p)){rows.push(p);if(p===parse(p).root)break;}
 for(const p of rows.reverse()){const s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||await realpath(p)!==p)fail('TERMINAL_LAYOUT_PATH_REFUSED');}
}
async function source(path){
 await directories(dirname(path));const before=await lstat(path,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>524288n||await realpath(path)!==path)fail('TERMINAL_LAYOUT_SOURCE_REFUSED');
 const handle=await open(path,'r');try{if(identity(await handle.stat({bigint:true}))!==identity(before))fail('TERMINAL_LAYOUT_SOURCE_CHANGED');const bytes=await handle.readFile();if(BigInt(bytes.length)!==before.size||identity(await handle.stat({bigint:true}))!==identity(before)||identity(await lstat(path,{bigint:true}))!==identity(before))fail('TERMINAL_LAYOUT_SOURCE_CHANGED');return {path,bytes,identity:identity(before),sha256:hash(bytes)};}finally{await handle.close();}
}
export async function buildTerminalNativeSourceLayout(options,...extra){
 if(extra.length||!options||types.isProxy(options)||typeof options!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(options))||Reflect.ownKeys(options).length!==1)fail('TERMINAL_LAYOUT_ARGUMENT_REFUSED');
 const d=Object.getOwnPropertyDescriptor(options,'outputDir');if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||d.value.length>1024||!isAbsolute(d.value)||resolve(d.value)!==d.value)fail('TERMINAL_LAYOUT_ARGUMENT_REFUSED');
 const out=d.value;if(out===parse(out).root||inside(out,desktop)||inside(desktop,out))fail('TERMINAL_LAYOUT_OUTPUT_REFUSED');
 await directories(dirname(out));try{await lstat(out);fail('TERMINAL_LAYOUT_OUTPUT_REFUSED');}catch(e){if(e.code!=='ENOENT')throw e;}
 // Bundling is an inert import-graph analysis; its generated code is never written/executed.
 const graph=await build({absWorkingDir:desktop,entryPoints:roots,outdir:join(out,'.analysis-unused'),bundle:true,write:false,metafile:true,platform:'node',format:'esm',target:'node24',packages:'external',logLevel:'silent'});
 const paths=Object.keys(graph.metafile.inputs).map(p=>resolve(desktop,p)).sort();
 if(paths.length<roots.length||paths.length>80||paths.some(p=>!inside(p,sourceRoot)||!p.endsWith('.mjs'))||Object.values(graph.metafile.inputs).some(v=>v.imports.some(i=>i.external&&!i.path.startsWith('node:'))))fail('TERMINAL_LAYOUT_IMPORT_REFUSED');
 const inputs=[];let totalBytes=0;for(const path of paths){const value=await source(path);totalBytes+=value.bytes.length;if(totalBytes>4194304)fail('TERMINAL_LAYOUT_SOURCE_REFUSED');inputs.push(value);}
 const filesystem=inputs.find(v=>v.path===join(sourceRoot,'terminal','desktop-native-filesystem.mjs'));
 const nativeURL=[...filesystem.bytes.toString('utf8').matchAll(/new URL\('([^']+\.node)',import\.meta\.url\)/g)];
 if(nativeURL.length!==1)fail('TERMINAL_LAYOUT_LOADER_CHANGED');const nativePath=fileURLToPath(new URL(nativeURL[0][1],new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url)));
 if(!inside(nativePath,join(desktop,'native')))fail('TERMINAL_LAYOUT_LOADER_CHANGED');
 const rows=inputs.map(v=>Object.freeze({path:'desktop/'+relative(desktop,v.path).replaceAll('\\','/'),bytes:v.bytes.length,sha256:v.sha256})),present=new Set(rows.map(v=>v.path));
 const criticalResources=[...DESKTOP_NATIVE_RESOURCE_PATHS,'desktop/'+relative(desktop,nativePath).replaceAll('\\','/')].map(path=>Object.freeze({path,state:present.has(path)?'SOURCE_STAGED':'REQUIRED_NOT_STAGED'}));
 const receipt=Object.freeze({schema:1,scope:'FIXED_NATIVE_ENTRY_SOURCE_LAYOUT_ONLY',entrypoints:Object.freeze(roots.map(p=>'desktop/'+p)),sources:Object.freeze(rows),totalBytes,criticalResources:Object.freeze(criticalResources),externalResources:Object.freeze(criticalResources.filter(v=>v.state==='REQUIRED_NOT_STAGED')),providerTreeClosureVerified:false,completeRuntimeClosure:false,nativeExecutionAdmitted:false,nativeFactoryConfigured:false,normalPackageChanged:false});
 await mkdir(out); // Fresh, separate root; partial failures remain visibly incomplete.
 for(let i=0;i<inputs.length;i++){const target=join(out,...rows[i].path.split('/'));await mkdir(dirname(target),{recursive:true});await directories(dirname(target));await writeFile(target,inputs[i].bytes,{flag:'wx'});if(hash(await readFile(target))!==rows[i].sha256)fail('TERMINAL_LAYOUT_COPY_CHANGED');}
 for(const old of inputs){const now=await source(old.path);if(now.identity!==old.identity||now.sha256!==old.sha256)fail('TERMINAL_LAYOUT_SOURCE_CHANGED');}
 await writeFile(join(out,'terminal-native-layout.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
