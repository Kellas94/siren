// Guarded disposable Windows prerequisite only. Never run locally or in product.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,rename,symlink} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CwdAuthority} from '../../src/terminal/cwd.mjs';
import {createShellProfileCatalogue} from '../../src/terminal/profiles.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');
assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.16.0');assert.equal(process.argv.length,2);
assert.match(process.env.GITHUB_RUN_ID??'',/^\d+$/);assert.match(process.env.GITHUB_RUN_ATTEMPT??'',/^\d+$/);assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=join(root,'desktop/evidence/terminal-session-filesystem',process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex'),pin=async path=>{const b=await readFile(path);return{path,bytes:b.length,sha256:sha(b)};};
const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
await mkdir(dirname(out),{recursive:true});await mkdir(out);
const receipt={scope:'ACTUAL_WINDOWS_FILESYSTEM_PREREQUISITE_ONLY',status:'STARTED_NOT_QUALIFIED',commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,runtime:{node:process.versions.node,platform:process.platform,arch:process.arch},controls:[],inputs:[],helperCalls:0,sessionsCreated:0,shellsCreated:0,nativeExecutionAdmitted:false,productActivation:false};
let cwd,catalogue;
try{
 const manifestPath=join(root,'desktop/tests/native/terminal-session-filesystem-inputs.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.equal(manifest.scope,'SESSION_FILESYSTEM_PREREQUISITE_SOURCE_PINS');assert.equal(manifest.nativeExecutionAdmitted,false);
 for(const r of manifest.inputs){assert.equal(resolve(root,r.path).startsWith(resolve(root)+'\\'),true);const actual=await pin(join(root,r.path));assert.equal(actual.bytes,r.bytes,r.path);assert.equal(actual.sha256,r.sha256,r.path);receipt.inputs.push(actual);}
 receipt.manifest=await pin(manifestPath);await save('source-inputs-before.json',receipt.inputs);
 const source=join(root,'desktop/tests/fixtures/terminal-filesystem-evidence.cs'),compiler='C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',executable=join(out,'filesystem-evidence.exe');
 receipt.compiler=await pin(compiler);receipt.source=await pin(source);
 let build;try{build=await run(compiler,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+executable,source],{cwd:root,windowsHide:true,timeout:30000,maxBuffer:262144});}catch(error){await save('compile-output.json',{exit:error.code,stdout:error.stdout??'',stderr:error.stderr??'',killed:error.killed??false,signal:error.signal??null});throw error;}
 await save('compile-output.json',{exit:0,stdout:build.stdout,stderr:build.stderr});receipt.binary=await pin(executable);
 async function helper(mode,target,refused=null){
  const args=target===undefined?[mode]:[mode,target],number=++receipt.helperCalls;assert.deepEqual(await pin(executable),receipt.binary);
  let result;try{const actual=await run(executable,args,{cwd:out,windowsHide:true,timeout:3000,maxBuffer:262144,encoding:'utf8'});result={exit:0,stdout:actual.stdout,stderr:actual.stderr};}catch(e){result={exit:e.code,stdout:e.stdout??'',stderr:e.stderr??'',killed:e.killed??false,signal:e.signal??null};}
  await save('helper-'+String(number).padStart(3,'0')+'.json',{mode,target:target??null,...result});assert.deepEqual(await pin(executable),receipt.binary);
  if(refused){assert.equal(result.exit,2);assert.equal(result.stdout.trim(),'');assert.equal(result.stderr.trim(),refused);return;}
  assert.equal(result.exit,0);assert.equal(result.stderr.trim(),'');return JSON.parse(result.stdout);
 }
 async function control(name,body){receipt.phase=name;await body();receipt.controls.push({name,passed:true});}
 const project=join(out,'project țară 日本語'),protectedRoot=join(out,'protected');await mkdir(project);await mkdir(protectedRoot);
 let original,grantToken,systemDirectory;
 await control('native-directory-stable',async()=>{original=await helper('directory',project);assert.deepEqual(await helper('directory',project),original);assert.equal(original.directory,true);assert.equal(original.reparse,false);assert.match(original.identity,/^[a-f0-9]{8}:[a-f0-9]{16}$/);assert.equal(original.ancestors.at(-1).identity,original.identity);assert.equal(original.canonicalPath.toLowerCase(),project.toLowerCase());receipt.originalDirectory=original;});
 const grant=Object.freeze({windowId:'workspace1',projectId:'project1',epoch:1,role:'workspace'});
 cwd=new CwdAuthority({pickDirectory:()=>Promise.resolve({canceled:false,filePaths:[project]}),protectedRoots:[protectedRoot],inspectDirectory:p=>helper('directory',p),authorize:()=>true,captureAdmission:()=>Object.freeze({isCurrent:()=>true})});
 await control('cwd-select-resolve-real-evidence',async()=>{grantToken=await cwd.pick(grant);assert.equal(typeof grantToken.cwdId,'string');assert.equal((await cwd.resolve(grant,grantToken.cwdId)).toLowerCase(),project.toLowerCase());});
 await control('profile-native-system-powershell',async()=>{
  systemDirectory=await helper('system');catalogue=createShellProfileCatalogue({getSystemDirectory:()=>Promise.resolve(systemDirectory),inspectExecutable:p=>helper('file',p),readEnvironment:()=>Promise.resolve({SystemRoot:process.env.SystemRoot,PATH:process.env.PATH}),privateEnvironmentKeys:[],authorize:()=>true,captureAdmission:()=>Object.freeze({isCurrent:()=>true})});
  const list=await catalogue.listShellProfiles();assert.equal(list[0].available,true);const profile=await catalogue.resolveShellProfile('powershell');assert.equal(profile.executable.toLowerCase(),join(systemDirectory,'WindowsPowerShell','v1.0','powershell.exe').toLowerCase());assert.deepEqual(profile.args,['-NoLogo','-NoProfile']);assert.equal(Object.keys(profile.env).length,2);receipt.profile={executable:profile.executable,args:profile.args,environmentKeys:Object.keys(profile.env),environmentSha256:sha(Buffer.from(JSON.stringify(profile.env)))};
 });
 await control('cwd-replacement-refused',async()=>{await rename(project,project+'-previous');await mkdir(project);const replaced=await helper('directory',project);assert.notEqual(replaced.identity,original.identity);receipt.replacedDirectory=replaced;await assert.rejects(cwd.resolve(grant,grantToken.cwdId),e=>e.code==='CWD_REFUSED');});
 await control('native-junction-refused',async()=>{const junction=join(out,'junction');await symlink(project,junction,'junction');await helper('directory',junction,'FS_REPARSE_REFUSED');});
 await control('native-missing-refused',()=>helper('directory',join(out,'missing'),'FS_OPEN_FAILED'));
 await control('native-arguments-refused',()=>helper('unknown',project,'FS_ARGUMENTS_REFUSED'));
 await control('frozen-inputs-unchanged',async()=>{for(const r of receipt.inputs)assert.deepEqual(await pin(r.path),r,r.path);assert.deepEqual(await pin(manifestPath),receipt.manifest);assert.deepEqual(await pin(executable),receipt.binary);});
 assert.equal(receipt.controls.length,8);receipt.status='BOUNDED_NATIVE_FILESYSTEM_OBSERVED_NOT_ADMITTED';
}catch(error){receipt.status='FAILED';receipt.error={message:error.message,code:error.code??null,stack:error.stack};console.error(error);process.exitCode=1;}
finally{
 try{cwd?.dispose();catalogue?.dispose();}catch(error){receipt.status='FAILED';receipt.disposalError=error.message;process.exitCode=1;}
 receipt.boundaries={syntheticAuthorization:true,nativeFilesystemHandlesObserved:receipt.controls.some(r=>r.name==='native-directory-stable'),actualCwdConsumerObserved:receipt.controls.some(r=>r.name==='cwd-select-resolve-real-evidence'),actualProfileConsumerObserved:receipt.controls.some(r=>r.name==='profile-native-system-powershell'),realSession:false,realWindowGrant:false,concurrentHostileRaceQualification:false,nativeWindowsProductAdapter:false,toolchainProvenance:'Compiler hash is a declaration; compiler/runtime bytes not archived.'};
 await save('result.json',receipt);console.log(JSON.stringify({status:receipt.status,controls:receipt.controls.length,helperCalls:receipt.helperCalls,nativeExecutionAdmitted:false}));
}
