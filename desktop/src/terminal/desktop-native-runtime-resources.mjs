// Candidate-only critical resource DATA capture. Never loads a module/binary.
// This is NOT a complete runtime inventory, native attestation or atomic I/O.
import {open,lstat,realpath} from 'node:fs/promises';
import {join,resolve,isAbsolute,dirname,parse} from 'node:path';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
export const DESKTOP_NATIVE_RESOURCE_PATHS=Object.freeze([
 'electron/electron.exe',
 'desktop/src/terminal/production-creator-entry.mjs',
 'desktop/src/terminal/desktop-native-runtime-creator.mjs',
 'desktop/src/terminal/desktop-native-runtime-host.mjs',
 'desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node',
 'desktop/native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node',
 'desktop/runtime/terminal-provider/node_modules/node-pty/package.json',
 'desktop/runtime/terminal-provider/node_modules/node-pty/lib/index.js'
]);
const receipts=new WeakMap(),limit=268435456;
const fail=()=>{throw Error('DESKTOP_NATIVE_RESOURCE_REFUSED');};
function plain(v,keys){if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return null;const names=Reflect.ownKeys(v);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))return null;const o=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;o[k]=d.value;}return o;}
const identity=s=>Object.freeze(Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs','birthtimeNs'].map(k=>[k,s[k]])));
const same=(a,b)=>Object.keys(a).every(k=>a[k]===b[k]);
async function directory(path){const s=await lstat(path,{bigint:true});if(s.isSymbolicLink()||!s.isDirectory()||await realpath(path)!==path)fail();return identity(s);}
async function read(root,relative){
 const path=join(root,...relative.split('/'));let parent=dirname(path),ancestors=[];
 while(parent!==root){ancestors.push(parent);const next=dirname(parent);if(next===parent)fail();parent=next;}
 for(const p of ancestors.reverse())await directory(p);
 const before=await lstat(path,{bigint:true});if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1n||before.size>BigInt(limit)||await realpath(path)!==path)fail();
 let handle;try{
  handle=await open(path,'r');const initial=await handle.stat({bigint:true});if(!same(identity(before),identity(initial)))fail();
  const buffer=Buffer.alloc(65536),hash=createHash('sha256');let total=0;
  for(;;){const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!Number.isInteger(bytesRead)||bytesRead<0||bytesRead>buffer.length)fail();if(!bytesRead)break;total+=bytesRead;if(total>limit)fail();hash.update(buffer.subarray(0,bytesRead));}
  const after=await handle.stat({bigint:true}),pathAfter=await lstat(path,{bigint:true});if(BigInt(total)!==before.size||!same(identity(before),identity(after))||!same(identity(before),identity(pathAfter))||await realpath(path)!==path)fail();
  return Object.freeze({path:relative,bytes:total,sha256:hash.digest('hex'),identity:identity(before)});
 }finally{if(handle)await handle.close();}
}
export async function captureDesktopNativeRuntimeResources(options,...extra){
 const p=plain(options,['directory','pins']);if(extra.length||!p||typeof p.directory!=='string'||p.directory.length>1024||!/^[A-Za-z]:\\/.test(p.directory)||/[\x00-\x1f]/.test(p.directory)||!isAbsolute(p.directory)||resolve(p.directory)!==p.directory||p.directory===parse(p.directory).root)fail();
 const pins=plain(p.pins,DESKTOP_NATIVE_RESOURCE_PATHS);if(!pins||Object.values(pins).some(v=>typeof v!=='string'||! /^[a-f0-9]{64}$/.test(v)))fail();
 const rootIdentity=await directory(p.directory),rows=[];
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const r=await read(p.directory,path);if(r.sha256!==pins[path])fail();rows.push(r);}
 if(!same(rootIdentity,await directory(p.directory)))fail();
 const receipt=Object.freeze({scope:'CANDIDATE_CRITICAL_RESOURCE_DATA',files:Object.freeze(rows.map(r=>Object.freeze({path:r.path,bytes:r.bytes,sha256:r.sha256}))),nativeExecutionAdmitted:false,completeRuntimeClosure:false});
 receipts.set(receipt,{directory:p.directory,rootIdentity,rows});return receipt;
}
export async function recheckDesktopNativeRuntimeResources(receipt,...extra){
 try{if(extra.length||types.isProxy(receipt))return false;const r=receipts.get(receipt);if(!r||!same(r.rootIdentity,await directory(r.directory)))return false;
  for(const old of r.rows){const now=await read(r.directory,old.path);if(now.sha256!==old.sha256||now.bytes!==old.bytes||!same(now.identity,old.identity))return false;}
  return same(r.rootIdentity,await directory(r.directory));
 }catch{return false;}
}
export function desktopNativeRuntimeResourcePaths(receipt,...extra){
 if(extra.length||types.isProxy(receipt))return null;const r=receipts.get(receipt);if(!r)return null;
 return Object.freeze({directory:r.directory,executable:join(r.directory,'electron','electron.exe'),entry:join(r.directory,'desktop','src','terminal','desktop-native-runtime-creator.mjs'),hostEntry:join(r.directory,'desktop','src','terminal','desktop-native-runtime-host.mjs'),creatorDirectory:r.directory});
}
