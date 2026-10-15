// Trusted inert DATA copying only, for selected failed hosted build resources.
import {lstat,mkdir,readdir,open,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,join,relative,sep,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
const selected=['execution','terminal-host-roster-candidate','terminal-creator-three-lane'];
const limits=Object.freeze({files:4096,directories:4096,fileBytes:32*1024*1024,totalBytes:128*1024*1024,depth:64});
const inside=(a,b)=>a.toLowerCase()===b.toLowerCase()||a.toLowerCase().startsWith(b.toLowerCase()+sep);
const stable=(a,b)=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].every(key=>a[key]===b[key]);
const refuse=()=>{throw Error('PROVISION_FAILURE_RETENTION_REFUSED');};
export async function retainSessionProvisionFailure({workDirectory,artifactDirectory}){
 if(typeof workDirectory!=='string'||typeof artifactDirectory!=='string'||!isAbsolute(workDirectory)||!isAbsolute(artifactDirectory))refuse();
 const work=resolve(workDirectory),artifact=resolve(artifactDirectory);if(inside(work,artifact)||inside(artifact,work))refuse();
 for(const path of [work,artifact]){const stat=await lstat(path);if(!stat.isDirectory()||stat.isSymbolicLink())refuse();}
 const destination=join(artifact,'partial');await mkdir(destination);
 const result={copied:[],missing:[],directories:[],totalBytes:0,limits,nativeArtifactsLoaded:false,scope:'BOUNDED_PARTIAL_EXECUTION_AND_NATIVE_CANDIDATES_ONLY'};
 async function walk(source,target,depth){
  if(depth>limits.depth)refuse();const before=await lstat(source,{bigint:true});if(before.isSymbolicLink())refuse();
  if(before.isDirectory()){
   if(result.directories.length>=limits.directories)refuse();await mkdir(target);result.directories.push(relative(work,source).split(sep).join('/'));
   for(const name of (await readdir(source)).sort())await walk(join(source,name),join(target,name),depth+1);return;
  }
  if(!before.isFile()||before.nlink!==1n||before.size>BigInt(limits.fileBytes)||result.copied.length>=limits.files||result.totalBytes+Number(before.size)>limits.totalBytes)refuse();
  const handle=await open(source,constants.O_RDONLY|(constants.O_NOFOLLOW??0));let bytes;
  try{
   if(!stable(before,await handle.stat({bigint:true})))refuse();bytes=Buffer.alloc(Number(before.size));let offset=0;
   while(offset<bytes.length){const read=await handle.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)refuse();offset+=read.bytesRead;}
   if((await handle.read(Buffer.alloc(1),0,1,bytes.length)).bytesRead||!stable(before,await handle.stat({bigint:true})))refuse();
  }finally{await handle.close();}
  await writeFile(target,bytes,{flag:'wx'});result.totalBytes+=bytes.length;result.copied.push({path:relative(work,source).split(sep).join('/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 for(const name of selected){try{await lstat(join(work,name));}catch(error){if(error.code==='ENOENT'){result.missing.push(name);continue;}throw error;}await walk(join(work,name),join(destination,name),0);}
 return result;
}
