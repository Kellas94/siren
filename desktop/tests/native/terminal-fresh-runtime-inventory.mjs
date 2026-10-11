// Read-only inventory of a complete fresh retained tree. Never evaluates members.
import {lstat,opendir,open} from 'node:fs/promises';
import {constants,realpathSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';

const LIMITS=Object.freeze({files:8192,directories:8192,depth:64,fileBytes:8*1024**3,totalBytes:128*1024**3,pathBytes:1024});
const captures=new WeakMap();
const fail=code=>{throw Error('FRESH_RUNTIME_INVENTORY_REFUSED: '+code);};
const stable=(a,b)=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].every(key=>a[key]===b[key]);
const sha=raw=>createHash('sha256').update(raw).digest('hex');
function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
function component(name){
 if(typeof name!=='string'||name.length>255||!/^[A-Za-z0-9_.-]+$/.test(name)||name==='.'||name==='..'||name.endsWith('.')||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))fail('MEMBER_PATH');
}
function rootPath(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.includes('\0')||value.length>32768||!path.isAbsolute(value)||path.resolve(value)!==value)fail('ABSOLUTE_CANONICAL_ROOT');
 const parsed=path.parse(value);if(value===parsed.root)fail('FILESYSTEM_ROOT');
 if(process.platform==='win32'&&!/^[A-Z]:\\/.test(value))fail('LOCAL_CANONICAL_DRIVE');
 const parts=value.slice(parsed.root.length).split(path.sep);if(parts.length>64||parts.some(part=>!part||part==='.'||part==='..'))fail('ROOT_DEPTH_OR_ALIAS');
 return value;
}
async function checked(target,directory,root){
 const relative=path.relative(root,target);if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))fail('ROOT_ESCAPE');
 const parts=relative?relative.split(path.sep):[];let current=root,last;
 for(let i=-1;i<parts.length;i++){
  if(i>=0)current=path.join(current,parts[i]);
  const stat=await lstat(current,{bigint:true});
  if(stat.isSymbolicLink()||(i<parts.length-1&&!stat.isDirectory()))fail('LINK_OR_ANCESTOR');last=stat;
 }
 if(directory?!last.isDirectory():!last.isFile()||last.nlink!==1n)fail('REGULAR_UNLINKED_MEMBER');
 if(path.normalize(realpathSync(target))!==target)fail('CANONICAL_ALIAS');
 return last;
}
async function names(target){
 const result=[],seen=new Set();
 for await(const entry of await opendir(target,{bufferSize:32})){
  component(entry.name);const folded=entry.name.toUpperCase();if(seen.has(folded))fail('CASE_ALIAS');seen.add(folded);result.push(entry.name);
  if(result.length>LIMITS.files+LIMITS.directories)fail('DIRECTORY_ENTRY_CAP');
 }
 return result.sort();
}
async function fileDigest(target,before){
 const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  if(!stable(before,await handle.stat({bigint:true})))fail('CHANGED_BEFORE_READ');
  const hash=createHash('sha256'),buffer=Buffer.alloc(65536);let offset=0;
  while(offset<Number(before.size)){
   const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,Number(before.size)-offset),offset);
   if(!bytesRead)fail('SHORT_READ');hash.update(buffer.subarray(0,bytesRead));offset+=bytesRead;
  }
  if((await handle.read(buffer,0,1,offset)).bytesRead||!stable(before,await handle.stat({bigint:true})))fail('CHANGED_DURING_READ');
  return hash.digest('hex');
 }finally{await handle.close();}
}
async function inspect(root){
 const files=[],directories=[],snapshots=[];let totalBytes=0;
 async function visit(relative,depth){
  if(depth>LIMITS.depth||Buffer.byteLength(relative)>LIMITS.pathBytes)fail('PATH_CAP');
  const target=relative?path.join(root,...relative.split('/')):root,before=await checked(target,true,root),members=await names(target);
  directories.push(relative);if(directories.length>LIMITS.directories)fail('DIRECTORY_CAP');
  snapshots.push({target,before,members});
  for(const name of members){
   const rel=relative?relative+'/'+name:name;if(Buffer.byteLength(rel)>LIMITS.pathBytes)fail('PATH_CAP');
   const absolute=path.join(target,name),stat=await lstat(absolute,{bigint:true});
   if(stat.isSymbolicLink())fail('LINK_MEMBER');
   if(stat.isDirectory()){await visit(rel,depth+1);continue;}
   if(files.length>=LIMITS.files)fail('FILE_CAP');
   const fileBefore=await checked(absolute,false,root);
   if(fileBefore.size>BigInt(LIMITS.fileBytes)||BigInt(totalBytes)+fileBefore.size>BigInt(LIMITS.totalBytes))fail('BYTE_CAP');
   const bytes=Number(fileBefore.size),sha256=await fileDigest(absolute,fileBefore);
   files.push({path:rel,bytes,sha256});totalBytes+=bytes;snapshots.push({target:absolute,before:fileBefore});
  }
 }
 await visit('',0);
 for(const snapshot of snapshots){
  if(!stable(snapshot.before,await checked(snapshot.target,!!snapshot.members,root)))fail('CHANGED_SNAPSHOT');
  if(snapshot.members&&!isDeepStrictEqual(snapshot.members,await names(snapshot.target)))fail('CHANGED_MEMBERSHIP');
 }
 files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);directories.sort();
 const sha256=sha(Buffer.from('SIREN_FRESH_TREE_V1\0'+JSON.stringify({files,directories})));
 const receipt=freeze({schema:'siren-terminal-fresh-tree/v1',evidenceClass:'READ_ONLY_COMPLETE_TREE_BYTE_INVENTORY',files,directories,totalBytes,sha256,limits:LIMITS,nativeExecutionAdmitted:false,inspectedModulesExecuted:false,filesystemGuarantee:'Node-visible links/identity/stable reads/membership only; not an atomic snapshot or native Windows reparse/ancestor-race guarantee.',roleBinding:'Not the role-bearing fresh-pair model digest; source/runtime provenance and actual executed identity remain separate.'});
 // Keep actual identities privately across scans. Same-byte replacements must
 // not impersonate this capture; the portable logical digest stays root-free.
 const identities=snapshots.map(snapshot=>({target:snapshot.target,...Object.fromEntries(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].map(key=>[key,snapshot.before[key]]))}));
 return {receipt,identities};
}
async function guarded(work){try{return await work();}catch(error){if(typeof error?.message==='string'&&error.message.startsWith('FRESH_RUNTIME_INVENTORY_REFUSED:'))throw error;fail('FILESYSTEM_UNAVAILABLE');}}
export async function captureFreshRuntimeInventory(root,...extra){
 return guarded(async()=>{if(extra.length)fail('EXTRA_ARGUMENTS');const canonical=rootPath(root),{receipt,identities}=await inspect(canonical);captures.set(receipt,{root:canonical,receipt,identities});return receipt;});
}
export async function recheckFreshRuntimeInventory(receipt,...extra){
 return guarded(async()=>{if(extra.length)fail('EXTRA_ARGUMENTS');const saved=captures.get(receipt);if(!saved)fail('PRIVATE_RECEIPT_REQUIRED');const current=await inspect(saved.root);if(!isDeepStrictEqual(current.receipt,saved.receipt)||!isDeepStrictEqual(current.identities,saved.identities))fail('TREE_OR_IDENTITY_DRIFT');return true;});
}
