// Main-only inert asset storage. No decoding, rendering or collection/deletion.
import {open,lstat,opendir,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ownedDirectory,childDirectory,validId} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {digest,exclusiveWriter} from '../projects/atomic.mjs';
import {DIAGRAM_EMBED_ASSET_BYTES,normalizeDiagramEmbedAssetRef} from './diagram-embeds.mjs';
export const DIAGRAM_EMBED_PROJECT_BYTES=128*1024*1024;
const fail=code=>{throw Object.assign(Error(code),{code});},kinds=['svg','png','diagram-source'];
function guard(callback){if(typeof callback!=='function')fail('ACCESS_REFUSED');let revoked=false;return()=>{try{if(callback()!==true)revoked=true;}catch{revoked=true;}if(revoked)fail('ACCESS_REFUSED');};}
async function inventory(directory,staging=false){
 const rows=[];let bytes=0;await ownedDirectory(directory);
 for await(const d of await opendir(directory)){
  if(!(staging?/^pending-[a-f0-9-]{36}\.tmp$/:/^[a-f0-9]{64}\.blob$/).test(d.name)||!d.isFile()||d.isSymbolicLink())fail('DIAGRAM_EMBED_ASSET_CORRUPT');
  const info=await lstat(join(directory,d.name));if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size<(staging?0:1)||info.size>DIAGRAM_EMBED_ASSET_BYTES)fail('DIAGRAM_EMBED_ASSET_CORRUPT');
  bytes+=info.size;rows.push({sha256:d.name.slice(0,-5),bytes:info.size});if(rows.length>4096||bytes>DIAGRAM_EMBED_PROJECT_BYTES)fail('DIAGRAM_EMBED_BUDGET');
 }
 return {rows,bytes};
}
export class DiagramEmbedAssetStore{
 #projects;
 constructor({projects}){if(typeof projects?.directory!=='function')throw TypeError('DIAGRAM_EMBED_PROJECT_STORE_REQUIRED');this.#projects=projects;}
 async #directory(projectId,create=false){if(!validId(projectId))fail('DIAGRAM_EMBED_REFUSED');const project=await this.#projects.directory(projectId);await ownedDirectory(project);return childDirectory(project,'diagram-embed-assets',{create});}
 async #verified(directory,ref){
  try{const path=join(directory,ref.sha256+'.blob'),info=await lstat(path);if(info.nlink!==1||!info.isFile()||info.isSymbolicLink()||info.size!==ref.bytes)fail('DIAGRAM_EMBED_ASSET_CORRUPT');const bytes=await readOwnedBytes(path,ref.bytes);if(bytes.length!==ref.bytes||digest(bytes)!==ref.sha256)fail('DIAGRAM_EMBED_ASSET_CORRUPT');return bytes;}
  catch(e){if(e.code==='ENOENT')throw e;fail('DIAGRAM_EMBED_ASSET_CORRUPT');}
 }
 async put({projectId,kind,bytes,isCurrent}){
  const current=guard(isCurrent);current();if(!kinds.includes(kind)||!Buffer.isBuffer(bytes))fail('DIAGRAM_EMBED_REFUSED');if(bytes.length<1||bytes.length>DIAGRAM_EMBED_ASSET_BYTES)fail('DIAGRAM_EMBED_BUDGET');
  const copy=Buffer.from(bytes),ref={kind,bytes:copy.length,sha256:digest(copy)},directory=await this.#directory(projectId,true);current();
  return exclusiveWriter(await this.#projects.directory(projectId),async()=>{
   current();const all=await inventory(directory),existing=all.rows.find(r=>r.sha256===ref.sha256);current();
   if(existing){await this.#verified(directory,ref);current();return ref;}
   const staging=await childDirectory(await this.#projects.directory(projectId),'diagram-embed-staging',{create:true});current();const abandoned=await inventory(staging,true);current();
   if(all.bytes+abandoned.bytes+copy.length>DIAGRAM_EMBED_PROJECT_BYTES||all.rows.length+abandoned.rows.length>=4096)fail('DIAGRAM_EMBED_BUDGET');
   // Incomplete bytes stay outside the immutable namespace; abandoned stages
   // count against its budget and never grant deletion of another asset.
   const temporary=join(staging,'pending-'+randomUUID()+'.tmp');let handle,identity,staged=false;
   try{
    current();handle=await open(temporary,'wx',0o600);staged=true;identity=await handle.stat();current();await handle.writeFile(copy);current();await handle.sync();await handle.close();handle=null;current();
    const actual=await readOwnedBytes(temporary,copy.length);if(!actual.equals(copy))fail('DIAGRAM_EMBED_ASSET_CORRUPT');current();await ownedDirectory(directory);current();
    // Atomic no-replace publication. Always retire our staging name before
    // checking revocation, so ordinary Lock cannot leave a two-link file.
    await link(temporary,join(directory,ref.sha256+'.blob'));await unlink(temporary);staged=false;
    current();await this.#verified(directory,ref);current();return ref;
   }finally{
    if(handle)await handle.close();
    if(staged){await ownedDirectory(staging);const info=await lstat(temporary);if(!identity||!info.isFile()||info.isSymbolicLink()||info.dev!==identity.dev||info.ino!==identity.ino)fail('PENDING_CLEANUP_FAILED');await unlink(temporary);}
   }
  });
 }
 async read({projectId,ref,isCurrent}){
  const current=guard(isCurrent);current();const normalized=normalizeDiagramEmbedAssetRef(ref),directory=await this.#directory(projectId);current();const bytes=await this.#verified(directory,normalized);current();return bytes;
 }
 async scanRetention({projectId,authorities}){
  // This caller supplies already collected main-owned reference classes. The
  // result is advisory only; it never authorizes deletion or bypasses recovery.
  const incomplete=()=>fail('DIAGRAM_EMBED_SCAN_INCOMPLETE');
  try{
   const names=['current','revision','pending','undo','recovery'];if(!Array.isArray(authorities)||authorities.length!==names.length)incomplete();
   const seen=new Set(),refs=new Map();for(const authority of authorities){const descriptors=Object.getOwnPropertyDescriptors(authority??{});if(Reflect.ownKeys(descriptors).length!==2||!Object.hasOwn(descriptors.kind??{},'value')||!Object.hasOwn(descriptors.refs??{},'value'))incomplete();const {kind,refs:list}=Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value]));if(!names.includes(kind)||seen.has(kind)||!Array.isArray(list)||list.length>4096)incomplete();seen.add(kind);for(const value of list){const ref=normalizeDiagramEmbedAssetRef(value),before=refs.get(ref.sha256);if(before&&before.bytes!==ref.bytes)incomplete();refs.set(ref.sha256,ref);}}
   let directory;try{directory=await this.#directory(projectId);}catch(e){if(e.code!=='ENOENT')throw e;if(refs.size)incomplete();return {retained:[],unreferenced:[],deletionAuthorized:false};}
   const all=await inventory(directory);for(const ref of refs.values())await this.#verified(directory,ref);
   return {retained:all.rows.filter(r=>refs.has(r.sha256)),unreferenced:all.rows.filter(r=>!refs.has(r.sha256)),deletionAuthorized:false};
  }catch{incomplete();}
 }
}
