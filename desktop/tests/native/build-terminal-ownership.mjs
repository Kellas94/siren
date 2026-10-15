// CI-only isolated build prerequisite. Product manifests and native/generated
// are not inputs/outputs. End users never run this compiler.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname,resolve,parse} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isExpectedLifetimeRefusal,isLifetimeComplete} from './terminal-job-lifetime-verdict.mjs';
const run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const toolsPath=resolve(process.argv[2]??join(desktop,'evidence/terminal-build-tool-discovery.json'));
const jobLifetime=process.argv.includes('--job-lifetime');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
// Require observed compiler/SDK inputs before network/header configuration.
const tools=JSON.parse(await readFile(toolsPath,'utf8'));
const compilers=tools.compilers.filter(c=>/[/\\]cl\.exe$/i.test(c.path));
assert.ok(compilers.length>0,'NO_OBSERVED_CPP_COMPILER');
compilers.sort((a,b)=>b.path.localeCompare(a.path,undefined,{numeric:true}));
const compiler=compilers[0],link=tools.compilers.find(c=>c.path===compiler.path.replace(/cl\.exe$/i,'link.exe'));
assert.ok(link);assert.equal(hash(await readFile(compiler.path)),compiler.sha256);assert.equal(hash(await readFile(link.path)),link.sha256);
const version=compiler.path.match(/[/\\]MSVC[/\\]([0-9.]+)[/\\]/)?.[1];assert.ok(version);
assert.equal(tools.visualStudio.length,1,'AMBIGUOUS_VS_ROOT');
const msbuild=join(tools.visualStudio[0],'MSBuild/Current/Bin/amd64/MSBuild.exe');
const sdk=tools.sdks.filter(p=>/[\\/]10\.0\.26100\.0$/.test(p));assert.equal(sdk.length,1,'SDK_NOT_OBSERVED');
const gypRoot=join(dirname(process.execPath),'node_modules/npm/node_modules/node-gyp');
const gypManifest=JSON.parse(await readFile(join(gypRoot,'package.json'),'utf8'));
assert.equal(gypManifest.version,'12.3.0','BUILD_TOOL_VERSION_REFUSED');
const output=join(desktop,'evidence/terminal-ownership-build',new Date().toISOString().replaceAll(':','-'));
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
  try{assert.equal((await lstat(p)).isSymbolicLink(),false,`linked parent: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});
const candidate=join(output,'candidate');await mkdir(candidate);
const receipt={schema:1,scope:'Test-owned C++ Job primitive build and Electron ABI prerequisite, not the product guard',admitted:false,
  output,node:process.version,compiler,link,msvcVersion:version,sdk:sdk[0],toolDiscoverySha256:hash(await readFile(toolsPath)),
  msbuild:{path:msbuild,sha256:hash(await readFile(msbuild))},nodeGyp:{version:gypManifest.version,inputs:[]},sources:[],phases:[],sdkInputs:[]};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2));
async function phase(name,exe,args,cwd,timeout=120000){
  const row={name,exe,args,cwd};receipt.phases.push(row);await save();console.log(JSON.stringify({phase:name,status:'starting',output}));
  try{
    const r=await run(exe,args,{cwd,windowsHide:true,shell:false,timeout,maxBuffer:8*1024*1024,
      env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE'].includes(k)))});
    await writeFile(join(output,name+'.txt'),r.stdout+r.stderr,{flag:'wx'});row.status='success';return r;
  }catch(error){
    await writeFile(join(output,name+'-failed.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});row.status='failed';row.code=error.code;throw error;
  }finally{await save();}
}
try{
  const sdkRoot=dirname(dirname(sdk[0])),msvcRoot=resolve(dirname(compiler.path),'../../..');
  for(const path of [join(sdk[0],'um/Windows.h'),join(sdk[0],'um/jobapi2.h'),join(sdk[0],'um/processthreadsapi.h'),join(sdk[0],'um/handleapi.h'),join(sdkRoot,'Lib/10.0.26100.0/um/x64/kernel32.lib'),join(msvcRoot,'lib/x64/delayimp.lib')]){
    const bytes=await readFile(path);receipt.sdkInputs.push({path,bytes:bytes.length,sha256:hash(bytes)});
  }
  for(const name of ['binding.gyp','primitives.cc','lifetime.cc']){
    const source=join(desktop,'tests/fixtures/terminal-ownership',name),bytes=await readFile(source);
    const copied=join(candidate,name);await writeFile(copied,bytes,{flag:'wx'});
    assert.deepEqual(await readFile(copied),bytes,'COPIED_SOURCE_IDENTITY_CHANGED');
    receipt.sources.push({name,bytes:bytes.length,sha256:hash(bytes),copiedSha256:hash(await readFile(copied))});
  }
  for(const name of ['package.json','LICENSE','src/win_delay_load_hook.cc','bin/node-gyp.js']){
    const bytes=await readFile(join(gypRoot,name));receipt.nodeGyp.inputs.push({name,bytes:bytes.length,sha256:hash(bytes)});
  }
  await phase('configure',process.execPath,[join(gypRoot,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+join(output,'headers'),'--msvs_version=2026','--verbose'],candidate);
  await phase('compile',msbuild,[join(candidate,'build/binding.sln'),'/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+version,'/p:WindowsTargetPlatformVersion=10.0.26100.0','/verbosity:diagnostic'],candidate);
  const binary=join(candidate,'build/Release/terminal_ownership_probe.node'),bytes=await readFile(binary);
  assert.equal(bytes.subarray(0,2).toString(),'MZ');assert.equal(bytes.readUInt16LE(bytes.readUInt32LE(60)+4),0x8664);
  receipt.binary={path:binary,bytes:bytes.length,sha256:hash(bytes),machine:'x64'};
  receipt.binaries=[receipt.binary];
  for(const name of ['terminal_job_lifetime','terminal_job_lifetime_negative']){
    const path=join(candidate,'build/Release',name+'.node'),b=await readFile(path);
    assert.equal(b.subarray(0,2).toString(),'MZ');assert.equal(b.readUInt16LE(b.readUInt32LE(60)+4),0x8664);
    receipt.binaries.push({name,path,bytes:b.length,sha256:hash(b),machine:'x64'});
  }
  receipt.buildInputs=[];
  async function walk(root){for(const item of await readdir(root,{withFileTypes:true})){
    const path=join(root,item.name);if(item.isDirectory())await walk(path);else if(item.isFile()){
      const b=await readFile(path);receipt.buildInputs.push({path,bytes:b.length,sha256:hash(b)});
    }else throw Error('LINKED_BUILD_INPUT');
  }}
  await walk(join(output,'headers'));
  if(jobLifetime){
    receipt.scope='Separate test-only named Job OS lifetime and deliberate retained-owner control; not global process-handle qualification or product guard';
    receipt.originalGlobalHandleProbe='Not executed in this separate scope; no original failure is superseded';
    const positive=receipt.binaries[1],negative=receipt.binaries[2],runner=join(desktop,'tests/native/terminal-job-lifetime.mjs');
    try{await phase('job-lifetime-negative',process.execPath,[runner,negative.path,binary],desktop,60000);throw Error('NEGATIVE_CONTROL_UNEXPECTED_SUCCESS');}
    catch(error){
      assert.equal(error.code,1,'NEGATIVE_CONTROL_DID_NOT_REACH_EXPECTED_FAILURE');
      receipt.negative=JSON.parse(error.stdout.trim());
      assert.equal(isExpectedLifetimeRefusal(receipt.negative,{addonSha256:negative.sha256,metricsSha256:receipt.binary.sha256}),true,'NEGATIVE_CONTROL_WRONG_FAILURE');
      receipt.phases.at(-1).expectedRefusalVerified=true;
    }
    const probe=await phase('job-lifetime-positive',process.execPath,[runner,positive.path,binary],desktop,60000);
    receipt.native=JSON.parse(probe.stdout.trim());
    assert.equal(isLifetimeComplete(receipt.native,{addonSha256:positive.sha256,metricsSha256:receipt.binary.sha256}),true,'JOB_LIFETIME_INCOMPLETE');
    receipt.status='JOB_LIFETIME_CONTROL_VERIFIED_TERMINAL_NOT_ADMITTED';
  }else{
    const probe=await phase('electron-probe',process.execPath,[join(desktop,'tests/native/terminal-ownership-addon.mjs'),binary],desktop,60000);
    receipt.native=JSON.parse(probe.stdout.trim());assert.equal(receipt.native.status,'PREREQUISITE_PASSED');
    receipt.status='ABI_PRIMITIVE_PASSED_TERMINAL_NOT_ADMITTED';
  }
  for(const artifact of receipt.binaries)assert.equal(hash(await readFile(artifact.path)),artifact.sha256);
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message};throw error;}
finally {await save();console.log(JSON.stringify({status:receipt.status,output,binary:receipt.binary,admitted:false}));}
