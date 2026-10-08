import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deriveBrokerSources} from './terminal-conpty-broker-derive.mjs';
import {isElectronCapacityObserved,isExpectedElectronCapacityRefusal} from './terminal-electron-capacity-verdict.mjs';
import {deriveEightCreatorSource} from './terminal-electron-capacity-derive.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const negative=process.argv.includes('--negative'),compileOnly=process.argv.includes('--compile-only');
assert.ok(process.argv.slice(2).every(a=>['--negative','--compile-only'].includes(a)),'FIXED_ARGUMENTS_ONLY');
const output=join(desktop,'evidence/terminal-electron-capacity',new Date().toISOString().replaceAll(':','-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});
const receipt={schema:1,admitted:false,scope:'Eight atomically contained actual Electron/node-pty creators: startup RSS and isolated Stop only; no flood/peak memory/product admission',negative,compileOnly,output,inputs:[],processStarted:false};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
try{
 const originalPath=join(desktop,'tests/fixtures/terminal-job-list.cs'),sharedPath=join(desktop,'tests/fixtures/terminal-conpty-membership.cs'),extension=join(desktop,'tests/fixtures/terminal-electron-capacity.cs'),creator=join(desktop,'tests/fixtures/terminal-electron-broker.cs'),worker=join(desktop,'tests/native/terminal-electron-broker-worker.mjs'),packagePath=join(desktop,'tests/fixtures/terminal-node-pty/package.json');
 for(const path of [fileURLToPath(import.meta.url),originalPath,sharedPath,extension,creator,worker,packagePath,join(desktop,'tests/fixtures/terminal-node-pty/package-lock.json'),join(desktop,'tests/native/terminal-conpty-broker-derive.mjs'),join(desktop,'tests/native/terminal-conpty-platform.mjs'),join(desktop,'tests/native/terminal-electron-capacity-verdict.mjs'),join(desktop,'tests/native/terminal-electron-capacity-derive.mjs')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
 const derived=deriveBrokerSources({original:await readFile(originalPath,'utf8'),shared:await readFile(sharedPath,'utf8')}),paths=[];
 for(const [name,source] of Object.entries(derived)){const path=join(output,name+'-partial.cs');await writeFile(path,source,{flag:'wx'});paths.push(path);receipt.inputs.push({path,bytes:Buffer.byteLength(source),sha256:hash(source)});}
 const creatorSource=deriveEightCreatorSource(await readFile(creator,'utf8')),creatorDerived=join(output,'creator-partial.cs');await writeFile(creatorDerived,creatorSource,{flag:'wx'});paths.push(creatorDerived);receipt.inputs.push({path:creatorDerived,bytes:Buffer.byteLength(creatorSource),sha256:hash(creatorSource)});
 const compiler=join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),executable=join(output,'electron-capacity-study.exe');
 const compilerBytes=await readFile(compiler);receipt.compiler={path:compiler,bytes:compilerBytes.length,sha256:hash(compilerBytes)};
 let compiled;try{compiled=await promisify(execFile)(compiler,['/nologo','/optimize+','/platform:x64','/target:exe','/reference:System.Web.Extensions.dll','/out:'+executable,...paths,extension],{windowsHide:true,timeout:30000,maxBuffer:65536});}catch(e){await writeFile(join(output,'compiler-failed.txt'),(e.stdout??'')+(e.stderr??''),{flag:'wx'});throw e;}
 await writeFile(join(output,'compiler.txt'),compiled.stdout+compiled.stderr,{flag:'wx'});const binary=await readFile(executable);assert.equal(binary.subarray(0,2).toString(),'MZ');receipt.executable={path:executable,bytes:binary.length,sha256:hash(binary)};
 if(compileOnly){receipt.status='COMPILE_ONLY_NATIVE_NOT_EXECUTED';}
 else{
  const electron=join(desktop,'node_modules/electron/dist/electron.exe');
  for(const path of [electron,join(desktop,'tests/fixtures/terminal-node-pty/node_modules/node-pty/prebuilds/win32-x64/conpty.node'),join(desktop,'tests/fixtures/terminal-node-pty/node_modules/node-pty/prebuilds/win32-x64/conpty_console_list.node')]){const b=await readFile(path);receipt.inputs.push({path,bytes:b.length,sha256:hash(b)});}
  assert.equal(JSON.parse(await readFile(packagePath,'utf8')).dependencies['node-pty'],'1.1.0');
  await writeFile(join(output,'study-config.json'),JSON.stringify({electron,script:worker,packagePath}),{flag:'wx'});
  let stdout='',stderr='';const child=spawn(executable,[negative?'capacity-negative':'capacity-positive',output],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')))});
  child.once('spawn',()=>{receipt.processStarted=true;});child.stdout.on('data',b=>{stdout+=b;if(Buffer.byteLength(stdout)>262144){receipt.outputTruncated=true;stdout=stdout.slice(-131072);}});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-32768);});
  receipt.outerExitCode=await new Promise(resolve=>{let settled=false,grace;const finish=(code,observed)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(grace);receipt.outerExitObserved=observed;resolve(code);};const timer=setTimeout(()=>{receipt.deadlineExceeded=true;grace=setTimeout(()=>finish(null,false),3000);try{receipt.killRequested=child.kill();}catch(e){receipt.killError=e.message;}},20000);child.once('error',e=>{receipt.processError={code:e.code,message:e.message};finish(null,false);});child.once('exit',code=>finish(code,true));});
  await writeFile(join(output,'study.log'),stdout+stderr,{flag:'wx'});receipt.native=JSON.parse(await readFile(join(output,'native-result.json'),'utf8'));
 }
 receipt.inputsUnchanged=true;for(const input of [...receipt.inputs,receipt.compiler,receipt.executable])if(hash(await readFile(input.path))!==input.sha256)receipt.inputsUnchanged=false;assert.equal(receipt.inputsUnchanged,true,'INPUT_CHANGED');
 if(!compileOnly){receipt.qualified=receipt.processStarted&&receipt.outerExitObserved&&!receipt.deadlineExceeded&&!receipt.outputTruncated&&receipt.outerExitCode===(negative?1:0)&&(negative?isExpectedElectronCapacityRefusal(receipt.native):isElectronCapacityObserved(receipt.native));assert.equal(receipt.qualified,true,'ELECTRON_CAPACITY_OBSERVATION_INCOMPLETE');receipt.status=negative?'EXPECTED_EIGHT_SESSION_REFUSAL_VERIFIED':'EIGHT_ELECTRON_CREATORS_OBSERVED_NOT_ADMITTED';}
}catch(e){receipt.status='FAILED';receipt.error={code:e.code,message:e.message};throw e;}finally{await save();console.log(JSON.stringify(receipt));}
if(negative&&!compileOnly)process.exitCode=1;
