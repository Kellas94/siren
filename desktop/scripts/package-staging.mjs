import {mkdir,lstat,readdir,rm} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ownedDirectory} from '../src/projects/paths.mjs';

const identity=async path=>lstat(path,{bigint:true});
async function unchangedDirectory(path,original){
 await ownedDirectory(path);
 const current=await identity(path);
 if(current.dev!==original.dev||current.ino!==original.ino||current.birthtimeNs!==original.birthtimeNs)throw Error('PACKAGE_STAGING_IDENTITY_CHANGED');
}
async function removeCreatedStaging(parent,staging,parentIdentity,stagingIdentity){
 if(dirname(staging)!==parent||!/^\.build-input-[a-f0-9-]{36}$/.test(basename(staging)))throw Error('PACKAGE_STAGING_PATH_REFUSED');
 await unchangedDirectory(parent,parentIdentity);await unchangedDirectory(staging,stagingIdentity);
 const pending=[staging];
 while(pending.length){
  const directory=pending.pop();
  await ownedDirectory(directory);
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,entry.name),info=await lstat(path);
   if(info.isSymbolicLink()||(!info.isDirectory()&&!info.isFile()))throw Error('PACKAGE_STAGING_ENTRY_REFUSED');
   if(info.isDirectory())pending.push(path);
  }
 }
 // Refuse observed replacements and links; this is not an atomic filesystem sandbox.
 await unchangedDirectory(parent,parentIdentity);await unchangedDirectory(staging,stagingIdentity);
 await rm(staging,{recursive:true});
}
/** Own only this invocation's temporary inputs, never its preview or older staging. */
export async function withPackageStaging(distRoot,build){
 const parent=await ownedDirectory(resolve(distRoot)),parentIdentity=await identity(parent);
 const staging=join(parent,`.build-input-${randomUUID()}`);
 await mkdir(staging);await ownedDirectory(staging);
 const stagingIdentity=await identity(staging);
 let result,buildError,failed=false;
 try{result=await build(staging);}catch(error){failed=true;buildError=error;}
 try{await removeCreatedStaging(parent,staging,parentIdentity,stagingIdentity);}
 catch(cleanupError){
  const error=new AggregateError(failed?[buildError,cleanupError]:[cleanupError],'PACKAGE_STAGING_CLEANUP_FAILED',{cause:failed?buildError:cleanupError});
  error.stagingPath=staging;throw error;
 }
 if(failed)throw buildError;
 return result;
}
