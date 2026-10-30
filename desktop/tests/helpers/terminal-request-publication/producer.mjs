// QA only: closed body + closed bound manifest, then atomic empty commit marker.
// Not authority, crash durability, or three-file filesystem atomicity.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import {join,resolve,basename,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const names=new Set(['ui-operator-ready','ui-folder-cancel','ui-folder-select','native-live','native-capacity','native-stopped','native-closed'].map(x=>x+'-request.json'));
const digest=b=>createHash('sha256').update(b).digest('hex');
export function createRequestPublisher({directory,actorPid,io=fs}){
 assert.equal(resolve(directory),directory);assert.equal(basename(directory),'native-attempt-v1');assert(Number.isSafeInteger(actorPid)&&actorPid>0);
 let halted=false;const used=new Set();
 async function ordinary(p,directory=false){let cursor=p;while(true){const s=await io.lstat(cursor);assert(!s.isSymbolicLink(),'REQUEST_LINK_REFUSED');const parent=dirname(cursor);if(parent===cursor)break;cursor=parent;}const s=await io.lstat(p);assert(directory?s.isDirectory():s.isFile()&&s.nlink===1);assert.equal(await io.realpath(p),p);return s;}
 async function closed(path,bytes){await io.writeFile(path,bytes,{flag:'wx'});const before=await ordinary(path),actual=await io.readFile(path),after=await ordinary(path);assert.equal(before.dev,after.dev);assert.equal(before.ino,after.ino);assert.equal(before.size,after.size);assert.equal(before.mtimeMs,after.mtimeMs);assert.equal(before.ctimeMs,after.ctimeMs);assert.deepEqual(actual,bytes);return {path,bytes:actual.length,sha256:digest(actual)};}
 return Object.freeze({async publish({filename,request}){
  assert(!halted,'REQUEST_PUBLISHER_HALTED');
  try{
   assert(names.has(filename)&&!used.has(filename),'ONE_EXACT_REQUEST_NAME_REQUIRED');used.add(filename);
   await ordinary(directory,true);assert.equal(request.actorPid,actorPid);const name=filename.slice(0,-'-request.json'.length).replace(/^ui-/,'');assert.equal(request.name,name);
   const body=Buffer.from(JSON.stringify(request,null,2)+'\n');assert(body.length>0&&body.length<=2097152,'REQUEST_METADATA_BOUND');
   const reference=await closed(join(directory,filename),body);
   const manifest={kind:'OWNED_REQUEST_COMPLETION_V1',scope:'R12_TC08_EIGHT_SESSIONS_AND_CLEANUP_ATTEMPT',actorPid,name,request:reference};
   const completion=await closed(join(directory,filename+'.completion.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
   // Empty-file exclusive creation is the sole commit point; it has no partial JSON body.
   const marker=join(directory,filename+'.published');await io.writeFile(marker,Buffer.alloc(0),{flag:'wx'});const s=await ordinary(marker);assert.equal(s.size,0);
   return {request:reference,completion,marker:{path:marker,bytes:0},authority:false};
  }catch(e){halted=true;throw e;}
 }});
}
