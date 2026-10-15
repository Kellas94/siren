import {deriveSessionComposition} from './terminal-session-composition-derive.mjs';
import {isSessionCompositionObserved} from './terminal-session-composition-verdict.mjs';
import {captureTerminalCandidateGraph,recheckTerminalCandidateGraph} from './terminal-candidate-graph.mjs';
// CI-only isolated prototype; product manifests/packages are untouched.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
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
const output=join(desktop,'evidence/terminal-session-composition-build',new Date().toISOString().replaceAll(':','-'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
 try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});const candidate=join(output,'candidate');await mkdir(candidate);
const receipt={schema:1,admitted:false,scope:'Test-only composed native Session creators and Host/root monitoring; no product admission',output,node:process.version,
 compiler,link,msvcVersion:version,sdk:sdk[0],toolDiscoverySha256:hash(toolBytes),msbuild:{path:msbuild,sha256:hash(await readFile(msbuild))},sources:[],toolInputs:[],buildInputs:[],binaries:[],phases:[]};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,exe,args,cwd,timeout=120000){
 const row={name,exe,args,cwd};receipt.phases.push(row);await save();console.log(JSON.stringify({phase:name,status:'starting',output}));
 try{const r=await run(exe,args,{cwd,windowsHide:true,shell:false,timeout,maxBuffer:8*1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')))});await writeFile(join(output,name+'.txt'),r.stdout+r.stderr,{flag:'wx'});row.status='success';return r;}
 catch(error){await writeFile(join(output,name+'-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});row.status='failed';row.code=error.code;throw error;}
 finally{await save();}
}
try{
 const names=['tests/native/build-terminal-session-composition.mjs','tests/native/terminal-session-composition.mjs','tests/native/terminal-session-composition-derive.mjs','tests/native/terminal-session-composition-verdict.mjs','tests/native/terminal-conpty-platform.mjs','tests/native/terminal-candidate-graph.mjs','tests/native/terminal-electron-broker-worker.mjs','tests/fixtures/terminal-host-guard/host.cc','tests/fixtures/terminal-session-composition.inc','tests/fixtures/terminal-session-composition-observer.cs','tests/fixtures/terminal-main-owner-observer.cs','tests/fixtures/terminal-job-list.cs','tests/fixtures/terminal-node-pty/package.json','tests/fixtures/terminal-node-pty/package-lock.json'];
 for(const rel of names){const path=join(desktop,rel),bytes=await readFile(path);receipt.sources.push({path,bytes:bytes.length,sha256:hash(bytes)});}
 const packagePath=join(desktop,'tests/fixtures/terminal-node-pty/package.json'),graph=await captureTerminalCandidateGraph({packagePath}),graphPath=join(output,'dependency-graph.json'),graphBytes=Buffer.from(JSON.stringify(graph,null,2)+'\n');
 await writeFile(graphPath,graphBytes,{flag:'wx'});receipt.dependencyGraph={path:graphPath,bytes:graphBytes.length,sha256:hash(graphBytes),summary:graph.summary,unchanged:false};
 const derived=deriveSessionComposition({host:await readFile(join(desktop,'tests/fixtures/terminal-host-guard/host.cc'),'utf8'),fixture:await readFile(join(desktop,'tests/fixtures/terminal-job-list.cs'),'utf8'),extension:await readFile(join(desktop,'tests/fixtures/terminal-session-composition.inc'),'utf8')});
 const binding={targets:['terminal_session_composition','terminal_session_composition_negative'].map((name,i)=>({target_name:name,sources:['host.cc'],defines:['NAPI_VERSION=10','_WIN32_WINNT=0x0A00','WIN32_LEAN_AND_MEAN','NOMINMAX',...(i?['SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1']:[])],win_delay_load_hook:'true',libraries:['kernel32.lib'],msvs_settings:{VCCLCompilerTool:{AdditionalOptions:['/std:c++20']}}}))};
 for(const [name,source] of [['host.cc',derived.host],['binding.gyp',JSON.stringify(binding,null,2)]]){const path=join(candidate,name);await writeFile(path,source,{flag:'wx'});receipt.sources.push({path,bytes:Buffer.byteLength(source),sha256:hash(source)});}
 const msvcRoot=resolve(dirname(compiler.path),'../../..'),sdkRoot=dirname(dirname(sdk[0]));
 for(const path of [join(gypRoot,'package.json'),join(gypRoot,'LICENSE'),join(gypRoot,'src/win_delay_load_hook.cc'),join(gypRoot,'bin/node-gyp.js'),join(sdk[0],'um/Windows.h'),join(sdk[0],'um/jobapi2.h'),join(sdk[0],'um/threadpoollegacyapiset.h'),join(sdk[0],'um/processthreadsapi.h'),join(sdkRoot,'Lib/10.0.26100.0/um/x64/kernel32.lib'),join(msvcRoot,'lib/x64/delayimp.lib')]){
  const b=await readFile(path);receipt.toolInputs.push({path,bytes:b.length,sha256:hash(b)});
 }
 await phase('configure',process.execPath,[join(gypRoot,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+join(output,'headers'),'--msvs_version=2026','--verbose'],candidate);
 await phase('compile',msbuild,[join(candidate,'build/binding.sln'),'/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+version,'/p:WindowsTargetPlatformVersion=10.0.26100.0','/verbosity:diagnostic'],candidate);
 async function walk(root){for(const entry of await readdir(root,{withFileTypes:true})){const path=join(root,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile()){const b=await readFile(path);receipt.buildInputs.push({path,bytes:b.length,sha256:hash(b)});}else throw Error('LINKED_BUILD_INPUT');}}
 await walk(join(output,'headers'));
 for(const name of ['terminal_session_composition','terminal_session_composition_negative']){
  const path=join(candidate,'build/Release',name+'.node'),b=await readFile(path);assert.equal(b.subarray(0,2).toString(),'MZ');assert.equal(b.readUInt16LE(b.readUInt32LE(60)+4),0x8664);
  receipt.binaries.push({name,path,bytes:b.length,sha256:hash(b),machine:'x64'});
 }

 const runner=join(desktop,'tests/native/terminal-session-composition.mjs');
 for(const [index,name] of [[1,'disabled-root-monitor-survival-control'],[0,'composed-stop-root-utility-control']]){
  const addon=receipt.binaries[index];const tested=await phase(name,process.execPath,[runner,addon.path,...(index?['--negative']:[])],desktop,60000);
  const r=JSON.parse(tested.stdout.trim());receipt[index?'negative':'positive']=r;
  assert.equal(r.negative,index===1);assert.equal(r.compileOnly,false);assert.equal(r.inputsUnchanged,true);assert.equal(r.processStarted,true);assert.equal(r.outerExitObserved,true);assert.equal(r.outerExitCode,0);assert.equal(r.qualified,true);assert.equal(r.deadlineExceeded,undefined);assert.equal(r.outputTruncated,undefined);
  assert.equal(isSessionCompositionObserved(r.native),true,'COMPOSITION_NATIVE_OBSERVATION_INCOMPLETE');assert.equal(r.inputs.find(p=>p.path===addon.path)?.sha256,addon.sha256,'ADDON_IDENTITY_CHANGED');
 }
 for(const artifact of [...receipt.sources,...receipt.binaries,compiler,link,receipt.msbuild,...receipt.toolInputs,...receipt.buildInputs])assert.equal(hash(await readFile(artifact.path)),artifact.sha256,'BUILD_INPUT_CHANGED');
 assert.equal((await recheckTerminalCandidateGraph({packagePath,receipt:graph})).unchanged,true);receipt.dependencyGraph.unchanged=true;receipt.status='COMPOSED_SESSION_CONTROLS_OBSERVED_NOT_ADMITTED';
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message};throw error;}
finally{await save();console.log(JSON.stringify({status:receipt.status,output,admitted:false}));}
