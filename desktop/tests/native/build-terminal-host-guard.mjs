// CI-only isolated prototype; product manifests/packages are untouched.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isHostGuardComplete,isExpectedHostMonitorRefusal,isFailedStopGuardComplete,isExpectedFailedStopMonitorRefusal} from './terminal-host-guard-verdict.mjs';
const run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const toolsPath=resolve(process.argv[2]??join(desktop,'evidence/terminal-build-tool-discovery.json'));
const toolBytes=await readFile(toolsPath),tools=JSON.parse(toolBytes.toString());
const compilers=tools.compilers.filter(c=>/[/\\]cl\.exe$/i.test(c.path)).sort((a,b)=>b.path.localeCompare(a.path,undefined,{numeric:true}));
assert.ok(compilers.length);assert.equal(tools.visualStudio.length,1);
const compiler=compilers[0],link=tools.compilers.find(c=>c.path===compiler.path.replace(/cl\.exe$/i,'link.exe'));
assert.ok(link);assert.equal(hash(await readFile(compiler.path)),compiler.sha256);assert.equal(hash(await readFile(link.path)),link.sha256);
const version=compiler.path.match(/[/\\]MSVC[/\\]([0-9.]+)[/\\]/)?.[1];assert.ok(version);
const sdk=tools.sdks.filter(p=>/[\\/]10\.0\.26100\.0$/.test(p));assert.equal(sdk.length,1);
const msbuild=join(tools.visualStudio[0],'MSBuild/Current/Bin/amd64/MSBuild.exe');
const gypRoot=join(dirname(process.execPath),'node_modules/npm/node_modules/node-gyp');
assert.equal(JSON.parse(await readFile(join(gypRoot,'package.json'),'utf8')).version,'12.3.0');
const output=join(desktop,'evidence/terminal-host-guard-build',new Date().toISOString().replaceAll(':','-'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
 try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});const candidate=join(output,'candidate');await mkdir(candidate);
const receipt={schema:1,admitted:false,scope:'Test-only native utility host Job and native death monitor; no ConPTY/session/product admission',output,node:process.version,
 compiler,link,msvcVersion:version,sdk:sdk[0],toolDiscoverySha256:hash(toolBytes),msbuild:{path:msbuild,sha256:hash(await readFile(msbuild))},sources:[],toolInputs:[],buildInputs:[],binaries:[],phases:[]};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,exe,args,cwd,timeout=120000){
 const row={name,exe,args,cwd};receipt.phases.push(row);await save();console.log(JSON.stringify({phase:name,status:'starting',output}));
 try{const r=await run(exe,args,{cwd,windowsHide:true,shell:false,timeout,maxBuffer:8*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE'].includes(k)))});await writeFile(join(output,name+'.txt'),r.stdout+r.stderr,{flag:'wx'});row.status='success';return r;}
 catch(error){await writeFile(join(output,name+'-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});row.status='failed';row.code=error.code;throw error;}
 finally{await save();}
}
try{
 for(const name of ['host.cc','binding.gyp']){
  const path=join(desktop,'tests/fixtures/terminal-host-guard',name),bytes=await readFile(path),copied=join(candidate,name);
  await writeFile(copied,bytes,{flag:'wx'});assert.deepEqual(await readFile(copied),bytes);receipt.sources.push({path,bytes:bytes.length,sha256:hash(bytes),copiedSha256:hash(await readFile(copied))});
 }
 for(const path of [fileURLToPath(import.meta.url),join(desktop,'tests/native/terminal-host-guard.mjs'),join(desktop,'tests/native/terminal-host-guard-verdict.mjs'),join(desktop,'tests/fixtures/terminal-job-list.cs')]){
  const b=await readFile(path);receipt.sources.push({path,bytes:b.length,sha256:hash(b)});
 }
 const msvcRoot=resolve(dirname(compiler.path),'../../..'),sdkRoot=dirname(dirname(sdk[0]));
 for(const path of [join(gypRoot,'package.json'),join(gypRoot,'LICENSE'),join(gypRoot,'src/win_delay_load_hook.cc'),join(gypRoot,'bin/node-gyp.js'),join(sdk[0],'um/Windows.h'),join(sdk[0],'um/jobapi2.h'),join(sdk[0],'um/threadpoollegacyapiset.h'),join(sdk[0],'um/processthreadsapi.h'),join(sdkRoot,'Lib/10.0.26100.0/um/x64/kernel32.lib'),join(msvcRoot,'lib/x64/delayimp.lib')]){
  const b=await readFile(path);receipt.toolInputs.push({path,bytes:b.length,sha256:hash(b)});
 }
 await phase('configure',process.execPath,[join(gypRoot,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+join(output,'headers'),'--msvs_version=2026','--verbose'],candidate);
 await phase('compile',msbuild,[join(candidate,'build/binding.sln'),'/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+version,'/p:WindowsTargetPlatformVersion=10.0.26100.0','/verbosity:diagnostic'],candidate);
 async function walk(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()){const b=await readFile(path);receipt.buildInputs.push({path,bytes:b.length,sha256:hash(b)});}else throw Error('LINKED_BUILD_INPUT');}}
 await walk(join(output,'headers'));
 for(const name of ['terminal_host_guard','terminal_host_guard_negative','terminal_host_guard_stop_failure','terminal_host_guard_legacy_stop_failure']){
  const path=join(candidate,'build/Release',name+'.node'),b=await readFile(path);assert.equal(b.subarray(0,2).toString(),'MZ');assert.equal(b.readUInt16LE(b.readUInt32LE(60)+4),0x8664);
  receipt.binaries.push({name,path,bytes:b.length,sha256:hash(b),machine:'x64'});
 }
 const executable=join(desktop,'node_modules/electron/dist/electron.exe'),runner=join(desktop,'tests/native/terminal-host-guard.mjs');
 const fixed={executableSha256:hash(await readFile(executable)),runnerSha256:hash(await readFile(runner))};
 const negative=receipt.binaries[1],positive=receipt.binaries[0];
 try{await phase('host-monitor-negative',process.execPath,[runner,negative.path],desktop,60000);throw Error('NEGATIVE_CONTROL_UNEXPECTED_SUCCESS');}
 catch(error){assert.equal(error.code,1,'NEGATIVE_CONTROL_EXIT_UNEXPECTED');const native=JSON.parse(error.stdout.trim());receipt.negative=native;assert.equal(isExpectedHostMonitorRefusal(native,{...fixed,addonSha256:negative.sha256}),true,'NEGATIVE_CONTROL_NOT_THE_EXPECTED_CONTAINED_MONITOR_FAILURE');receipt.phases.find(p=>p.name==='host-monitor-negative').expectedRefusalVerified=true;}
 const tested=await phase('host-monitor-positive',process.execPath,[runner,positive.path],desktop,60000);receipt.positive=JSON.parse(tested.stdout.trim());
 assert.equal(isHostGuardComplete(receipt.positive,{...fixed,addonSha256:positive.sha256}),true,'HOST_MONITOR_QUALIFICATION_INCOMPLETE');
 const legacy=receipt.binaries[3],fixedFailure=receipt.binaries[2];
 try{await phase('failed-stop-legacy-negative',process.execPath,[runner,legacy.path,'--stop-failure-control'],desktop,60000);throw Error('LEGACY_STOP_CONTROL_UNEXPECTED_SUCCESS');}
 catch(error){assert.equal(error.code,1,'LEGACY_STOP_CONTROL_EXIT_UNEXPECTED');const native=JSON.parse(error.stdout.trim());receipt.legacyFailedStop=native;assert.equal(isExpectedFailedStopMonitorRefusal(native,{...fixed,addonSha256:legacy.sha256}),true,'LEGACY_STOP_CONTROL_NOT_THE_EXPECTED_CONTAINED_FAILURE');receipt.phases.find(p=>p.name==='failed-stop-legacy-negative').expectedRefusalVerified=true;}
 const repaired=await phase('failed-stop-fixed-positive',process.execPath,[runner,fixedFailure.path,'--stop-failure-control'],desktop,60000);receipt.fixedFailedStop=JSON.parse(repaired.stdout.trim());
 assert.equal(isFailedStopGuardComplete(receipt.fixedFailedStop,{...fixed,addonSha256:fixedFailure.sha256}),true,'FAILED_STOP_MONITOR_QUALIFICATION_INCOMPLETE');
 for(const artifact of [...receipt.sources,...receipt.binaries,compiler,link,receipt.msbuild])assert.equal(hash(await readFile(artifact.path)),artifact.sha256,'INPUT_IDENTITY_CHANGED');
 assert.equal(hash(await readFile(executable)),fixed.executableSha256);receipt.status='HOST_GUARD_CONTROL_VERIFIED_TERMINAL_NOT_ADMITTED';
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message};throw error;}
finally{await save();console.log(JSON.stringify({status:receipt.status,output,admitted:false}));}
