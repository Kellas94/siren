// Private MAIN configured-tree DATA authority only. No native loaders or activation.
// A trusted supplied manifest does NOT prove complete executable dependencies.
import * as nodeFilesystem from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,dirname,resolve,parse,isAbsolute} from 'node:path';
import {types,isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {DESKTOP_NATIVE_RESOURCE_PATHS,desktopNativeRuntimeResourcePaths,recheckDesktopNativeRuntimeResources} from './desktop-native-runtime-resources.mjs';
// Electron's patched fs presents .asar files as virtual directories. This
// authority verifies physical manifest bytes and identities, so use its built-in
// OS filesystem in Electron. Missing original-fs refuses; never fall back to the
// patched namespace or mutate process.noAsar. Ordinary Node keeps its same fs.
const {lstat,realpath,opendir,open}=process.versions.electron
 ?createRequire(import.meta.url)('original-fs').promises:nodeFilesystem;
const MAX=8192,FILE=268435456,TOTAL=4294967296,handles=new WeakMap();
const fail=()=>{throw Error('OWNED_TREE_MANIFEST_REFUSED');};
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))fail();
 const out=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();out[k]=d.value;}return out;
}
function array(value){
 if(!value||types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)fail();
 const n=Object.getOwnPropertyDescriptor(value,'length')?.value;if(!Number.isInteger(n)||n>MAX||Reflect.ownKeys(value).length!==n+1)fail();
 const out=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail();out.push(d.value);}return out;
}
function path(value,root=false){
 if(root&&value==='')return value;
 if(typeof value!=='string'||value.length>1024||!value.isWellFormed())fail();
 const parts=value.split('/');if(parts.length>64||parts.some(p=>!p||p==='.'||p==='..'||p.length>255||/[\\<>:"|?*\x00-\x1f\x7f-\x9f]/.test(p)||/[ .]$/.test(p)||p.normalize('NFC')!==p||/~\d/.test(p)||/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(p)))fail();return value;
}
function manifest(value){
 const m=data(value,['directory','files','directories']);
 if(typeof m.directory!=='string'||m.directory.length>1024||! /^[A-Za-z]:\\/.test(m.directory)||/[\x00-\x1f]/.test(m.directory)||!isAbsolute(m.directory)||resolve(m.directory)!==m.directory||m.directory===parse(m.directory).root)fail();
 const folded=new Set(),files=[],directories=[],members=new Map();let total=0;
 for(const row of array(m.files)){
  const r=data(row,['path','bytes','sha256']);path(r.path);const key=r.path.toUpperCase();
  if(folded.has(key)||!Number.isSafeInteger(r.bytes)||r.bytes<0||r.bytes>FILE||typeof r.sha256!=='string'||! /^[a-f0-9]{64}$/.test(r.sha256))fail();folded.add(key);total+=r.bytes;if(total>TOTAL)fail();files.push(Object.freeze(r));
 }
 for(const dir of array(m.directories)){path(dir,true);const key=dir.toUpperCase();if(folded.has(key))fail();folded.add(key);directories.push(dir);members.set(dir,[]);}
 if(!members.has('')||!files.length)fail();
 for(const rel of [...directories.filter(p=>p!==''),...files.map(r=>r.path)]){
  const i=rel.lastIndexOf('/'),parent=i<0?'':rel.slice(0,i),name=rel.slice(i+1);if(!members.has(parent))fail();members.get(parent).push(name);
 }
 for(const names of members.values())names.sort();
 for(const rel of DESKTOP_NATIVE_RESOURCE_PATHS)if(!files.some(r=>r.path===rel))fail();
 return {directory:m.directory,files:Object.freeze(files.sort((a,b)=>a.path<b.path?-1:1)),directories:Object.freeze(directories.sort()),members};
}
const identity=s=>Object.freeze(Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs','birthtimeNs'].map(k=>[k,s[k]])));
const same=(a,b)=>isDeepStrictEqual(a,b);
async function checked(target,directory){
 const chain=[];for(let p=target;;p=dirname(p)){chain.push(p);if(p===parse(p).root)break;}
 let final;
 for(const p of chain.reverse()){
  const s=await lstat(p,{bigint:true});if(s.isSymbolicLink()||p!==target&&!s.isDirectory())throw Error();final=s;
 }
 if(directory?!final.isDirectory():!final.isFile()||final.nlink!==1n||final.size>BigInt(FILE))throw Error();
 if(await realpath(target)!==target)throw Error();return identity(final);
}
async function namesAt(target){
 const names=[],seen=new Set();for await(const e of await opendir(target,{bufferSize:32})){
  path(e.name);const folded=e.name.toUpperCase();if(seen.has(folded)||names.length>=MAX*2)throw Error();seen.add(folded);names.push(e.name);
 }return names.sort();
}
async function inspect(m){
 const rows=[],dirs=[];
 for(const rel of m.directories){const target=rel?join(m.directory,...rel.split('/')):m.directory,before=await checked(target,true),names=await namesAt(target);if(!same(names,m.members.get(rel)))throw Error();dirs.push({rel,target,identity:before,names});}
 for(const expected of m.files){
  const target=join(m.directory,...expected.path.split('/')),before=await checked(target,false);if(before.size!==BigInt(expected.bytes))throw Error();
  const h=await open(target,'r');let digest;
  try{
   if(!same(identity(await h.stat({bigint:true})),before))throw Error();
   const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let offset=0;
   while(offset<expected.bytes){const {bytesRead}=await h.read(buffer,0,Math.min(buffer.length,expected.bytes-offset),offset);if(!Number.isInteger(bytesRead)||bytesRead<=0||bytesRead>Math.min(buffer.length,expected.bytes-offset))throw Error();offset+=bytesRead;hash.update(buffer.subarray(0,bytesRead));}
   if((await h.read(buffer,0,1,offset)).bytesRead!==0||!same(identity(await h.stat({bigint:true})),before))throw Error();digest=hash.digest('hex');
  }finally{await h.close();}
  if(digest!==expected.sha256||!same(before,await checked(target,false)))throw Error();rows.push({path:expected.path,identity:before});
 }
 for(const d of dirs)if(!same(d.identity,await checked(d.target,true))||!same(d.names,await namesAt(d.target)))throw Error();
 return {rows,dirs};
}
export function createDesktopNativeOwnedTreeVerifier(options,...extra){
 if(extra.length)fail();const config=data(options,['manifest']),m=manifest(config.manifest);
 // Trusted MAIN construction captures policy DATA once. No public override.
 let state='idle',resource=null,captured=null,handle=null;
 const snapshot=()=>Object.freeze({state,completeRuntimeClosure:false,loadedModuleProvenanceVerified:false,nativeExecutionAdmitted:false});
 function capture(resources,...args){
  if(args.length||state!=='idle')return Promise.reject(Error('OWNED_TREE_CAPTURE_REFUSED'));
  state='capturing';resource=resources;
  return (async()=>{
   try{
    const p=desktopNativeRuntimeResourcePaths(resource);if(!p||p.directory!==m.directory||!await recheckDesktopNativeRuntimeResources(resource))throw Error();
    for(const row of resource.files){const expected=m.files.find(r=>r.path===row.path);if(!expected||expected.bytes!==row.bytes||expected.sha256!==row.sha256)throw Error();}
    captured=await inspect(m);if(!await recheckDesktopNativeRuntimeResources(resource))throw Error();
    handle=Object.freeze({scope:'OWNED_TREE_DATA_ONLY',ownedTreeVerified:true,files:m.files,directories:m.directories,completeRuntimeClosure:false,loadedModuleProvenanceVerified:false,nativeExecutionAdmitted:false});handles.set(handle,{owner:snapshot,resource,recheck});state='ready';return handle;
   }catch{state='invalid';throw Error('OWNED_TREE_CAPTURE_REFUSED');}
  })();
 }
 function recheck(value,...args){
  if(args.length||state!=='ready'||types.isProxy(value)||value!==handle||handles.get(value)?.owner!==snapshot)return Promise.resolve(false);
  state='checking';return (async()=>{
   try{if(!await recheckDesktopNativeRuntimeResources(resource)||!same(captured,await inspect(m))||!await recheckDesktopNativeRuntimeResources(resource))throw Error();state='ready';return true;}
   catch{state='invalid';return false;}
  })();
 }
 return Object.freeze({capture,recheck,snapshot});
}
// Private MAIN consumers can recheck the genuine captured resource/tree pair
// without accepting a caller-supplied verifier callback as DATA authority.
// This adds no completeness, loaded-module or native-admission claim.
export async function recheckDesktopNativeOwnedTree(resources,handle,...extra){
 try{if(extra.length||types.isProxy(handle))return false;const r=handles.get(handle);if(!r||r.resource!==resources)return false;return await r.recheck(handle);}
 catch{return false;}
}
