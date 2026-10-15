// Fixed Win32 ConPTY membership study; no user shell, node-pty or product import.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {join,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isConptyMembershipObserved,isExpectedConptyMembershipRefusal} from './terminal-conpty-membership-verdict.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const output=join(desktop,'evidence/terminal-conpty-membership',new Date().toISOString().replaceAll(':','-')),negative=process.argv.includes('--negative');
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Fixed Win32-only pseudoconsole helper/session membership observation; not Electron/node-pty admission',negative,output,inputs:[],processStarted:false};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
try{
 const originalPath=join(desktop,'tests/fixtures/terminal-job-list.cs'),extension=join(desktop,'tests/fixtures/terminal-conpty-membership.cs'),verdict=join(desktop,'tests/native/terminal-conpty-membership-verdict.mjs');
 for(const path of [fileURLToPath(import.meta.url),originalPath,extension,verdict]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 const original=await readFile(originalPath,'utf8');assert.equal(hash(Buffer.from(original)),'a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a');
 let derived=original;
 for(const [before,after] of [['internal static class TerminalJobListProbe {','internal static partial class TerminalJobListProbe {'],['static int Main(string[] args) {','static int OriginalMain(string[] args) {']]){assert.equal(derived.split(before).length,2);derived=derived.replace(before,after);}
 const derivedPath=join(output,'fixed-original-partial.cs');await writeFile(derivedPath,derived,{flag:'wx'});receipt.derivation={originalSha256:hash(Buffer.from(original)),derivedSha256:hash(Buffer.from(derived)),changes:['class becomes partial','original entry renamed; fixed fixture logic unchanged']};
 receipt.inputs.push({path:derivedPath,bytes:Buffer.byteLength(derived),sha256:hash(Buffer.from(derived))});
 const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),executable=join(output,'study.exe');
 const c=await readFile(compiler);receipt.compiler={path:compiler,bytes:c.length,sha256:hash(c)};
 let compiled;try{compiled=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/reference:System.Web.Extensions.dll','/out:'+executable,derivedPath,extension],{windowsHide:true,timeout:30000,maxBuffer:65536});}
 catch(error){await writeFile(join(output,'compiler-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});throw error;}
 await writeFile(join(output,'compiler.txt'),compiled.stdout+compiled.stderr,{flag:'wx'});
 const b=await readFile(executable);assert.equal(b.subarray(0,2).toString(),'MZ');receipt.executable={path:executable,bytes:b.length,sha256:hash(b)};
 let stdout='',stderr='',child;
 try{child=spawn(executable,[negative?'conpty-negative':'conpty-positive',output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE'].includes(k)))});receipt.processStarted=true;}
 catch(e){receipt.processError={code:e.code,message:e.message};receipt.outerExitObserved=false;throw e;}
 child.stdout.on('data',data=>{stdout+=data;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',data=>{stderr=(stderr+data).slice(-32768);});
 receipt.outerExitObserved=false;
 receipt.outerExitCode=await new Promise(resolve=>{
  let settled=false,grace;
  const finish=(code,observed)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};
  const timer=setTimeout(()=>{receipt.deadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{receipt.killRequested=child.kill();}catch(e){receipt.killError=e.message;}},20000);
  child.once('error',e=>{receipt.processError=e.message;finish(null,false);});child.once('exit',code=>finish(code,true));
 });
 await writeFile(join(output,'study.log'),stdout+stderr,{flag:'wx'});
 receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));
 receipt.inputsUnchanged=true;for(const input of [...receipt.inputs,receipt.compiler,receipt.executable])if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;
 receipt.qualified=receipt.outerExitObserved&&!receipt.deadlineExceeded&&!receipt.outputTruncated&&receipt.inputsUnchanged&&receipt.outerExitCode===(negative?1:0)&&(negative?isExpectedConptyMembershipRefusal(receipt.native):isConptyMembershipObserved(receipt.native));
 assert.equal(receipt.qualified,true,'CONPTY_OBSERVATION_INCOMPLETE');
 receipt.status=negative?'EXPECTED_CONPTY_MEMBERSHIP_REFUSAL_VERIFIED':'CONPTY_MEMBERSHIP_OBSERVED_TERMINAL_NOT_ADMITTED';
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message};throw error;}
finally{await save();console.log(JSON.stringify(receipt));}
if(negative)process.exitCode=1;
