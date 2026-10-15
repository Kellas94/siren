// Test-owned fixtures only. Successful cases are disposable; failures remain.
// No cleanup runs on import, construction or failed assertions.
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdir,mkdtemp,lstat,realpath,rm} from 'node:fs/promises';
import {isAbsolute,resolve,parse,join,dirname,basename,normalize} from 'node:path';
export function createDisposableFixtureScope(parent){
 if(typeof parent!=='string'||!isAbsolute(parent)||resolve(parent)===parse(parent).root)throw TypeError('Explicit non-root fixture parent required');
 const expected=resolve(parent),storage=new AsyncLocalStorage();
 async function parentCurrent(){
  const stat=await lstat(expected,{bigint:true});
  if(!stat.isDirectory()||stat.isSymbolicLink()||normalize(await realpath(expected))!==expected)throw Error('Fixture parent must be canonical and not a link');
 }
 async function verify(row){
  await parentCurrent();
  if(dirname(row.root)!==expected||!row.prefixes.includes(basename(row.root).slice(0,basename(row.root).lastIndexOf('-')+1)))throw Error('Fixture root outside explicit parent/prefix');
  const stat=await lstat(row.root,{bigint:true});
  if(stat.isSymbolicLink()||!stat.isDirectory()||stat.dev!==row.dev||stat.ino!==row.ino||normalize(await realpath(row.root))!==row.root)throw Error('Fixture root link/identity/canonical mismatch');
 }
 return Object.freeze({
  async create(prefix){
   const rows=storage.getStore();if(!rows)throw Error('Fixture creation requires an active scope');
   if(!['case-','ancestor-'].includes(prefix))throw Error('Fixture prefix refused');
   await mkdir(expected,{recursive:true});await parentCurrent();
   const root=await mkdtemp(join(expected,prefix)),stat=await lstat(root,{bigint:true}),row={root,dev:stat.dev,ino:stat.ino,prefixes:[prefix]};rows.push(row);await verify(row);return root;
  },
  async run(fn){
   if(typeof fn!=='function')throw TypeError('Fixture scope callback required');
   const rows=[];const result=await storage.run(rows,fn);
   // If the body throws, control never reaches cleanup and all roots survive.
   // Verify the complete roster before removing any successful-case directory.
   for(const row of rows)await verify(row);
   for(const row of rows){await verify(row);await rm(row.root,{recursive:true,force:false});}
   return result;
  }
 });
}
