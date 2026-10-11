// Read-only diagnostic DATA. Does not execute or admit any inspected compiler.
import assert from 'node:assert/strict';
import {lstat,open,mkdir,writeFile} from 'node:fs/promises';
import {realpathSync,constants} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(process.versions.node,'24.16.0');
assert.equal(process.argv.length,2);assert.equal(process.argv[1],fileURLToPath(import.meta.url));
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');
assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');assert.equal(process.env.GITHUB_RUN_ATTEMPT,'1');
assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);assert.match(process.env.GITHUB_RUN_ID??'',/^[1-9]\d*$/);
const parent=process.env.RUNNER_TEMP;assert.equal(typeof parent,'string');assert.equal(path.resolve(parent),parent);
assert.match(parent,/^[A-Z]:\\/);const parentStat=await lstat(parent);assert.ok(parentStat.isDirectory()&&!parentStat.isSymbolicLink());assert.equal(path.normalize(realpathSync(parent)),parent);
const output=path.join(parent,'siren-compiler-inventory');await mkdir(output);
const fields=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];
const data=s=>Object.fromEntries(fields.map(k=>[k,String(s[k])]));
const stable=(a,b)=>fields.every(k=>a[k]===b[k]);
const compilers=[
 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
 'C:\\Program Files\\Microsoft Visual Studio\\18\\Enterprise\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe'
];
const candidates=compilers.flatMap(p=>[{path:p,kind:'compiler-binary'},{path:p+'.config',kind:'compiler-config'},{path:path.join(path.dirname(p),'csc.rsp'),kind:'compiler-response'}]);
const result={schema:1,author:'/root',scope:'FIXED_COMPILER_INVENTORY_DATA_ONLY',commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:1,compilerExecuted:false,nativeAdmission:false,realSessions:0,entries:[]};
for(const candidate of candidates){
 const row={...candidate,ok:false,stage:'before-stat'};let handle;
 try{
  const before=await lstat(candidate.path,{bigint:true});row.before=data(before);assert.ok(before.isFile()&&!before.isSymbolicLink());
  const cap=candidate.kind==='compiler-binary'?33554432n:65536n;assert.ok(before.size>=0n&&before.size<=cap);row.canonical=path.normalize(realpathSync(candidate.path));assert.equal(row.canonical,candidate.path);
  row.stage='open';handle=await open(candidate.path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  const held=await handle.stat({bigint:true});row.handleBefore=data(held);assert.ok(stable(before,held));
  row.stage='read';const digest=createHash('sha256'),buffer=Buffer.alloc(65536),chunks=[];let total=0;
  while(total<Number(before.size)){
   const requested=Math.min(buffer.length,Number(before.size)-total),{bytesRead}=await handle.read(buffer,0,requested,total);
   assert.ok(Number.isInteger(bytesRead)&&bytesRead>0&&bytesRead<=requested);const chunk=buffer.subarray(0,bytesRead);digest.update(chunk);
   if(candidate.kind!=='compiler-binary')chunks.push(Buffer.from(chunk));total+=bytesRead;
  }
  assert.equal((await handle.read(buffer,0,1,total)).bytesRead,0);
  row.stage='after-stat';const heldAfter=await handle.stat({bigint:true}),after=await lstat(candidate.path,{bigint:true});row.handleAfter=data(heldAfter);row.after=data(after);assert.ok(stable(before,heldAfter)&&stable(before,after));
  row.bytes=total;row.sha256=digest.digest('hex');row.strictSingleLinkObserved=before.nlink===1n;
  if(candidate.kind!=='compiler-binary')row.literalBase64=Buffer.concat(chunks).toString('base64');
  row.ok=true;row.stage='observed';
 }catch(error){
  const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:null;
  row.failure=['ENOENT','EACCES','EPERM','ERR_ASSERTION'].includes(code)?code:'IO_OR_IDENTITY_REFUSED';
 }finally{
  if(handle){try{await handle.close();row.handleClosed=true;}catch{row.ok=false;row.handleClosed=false;row.closeFailure=true;}}
 }
 result.entries.push(row);
}
// ok means inventory collection completed, never compiler selection/admission.
result.status='INVENTORY_COLLECTED_NOT_ADMITTED';
await writeFile(path.join(output,'inventory.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,entries:result.entries.length,compilerExecuted:false,nativeAdmission:false}));
