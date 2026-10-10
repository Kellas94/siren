// Disposable hosted build/inventory prerequisite; no native/provider/code load.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,cp,readdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {sessionProvisionLocations} from './terminal-session-provision-paths.mjs';
import {retainSessionProvisionFailure} from './terminal-session-provision-retention.mjs';
import {captureShutdownGraphResources,prepareProductionResources,recheckPreparedProductionResources} from './terminal-production-resources.mjs';
import {captureTerminalSessionExecutionResources,recheckTerminalSessionExecutionResources} from './terminal-session-execution-resources.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');assert.equal(process.env.GITHUB_REF,'refs/heads/probe/terminal-session-20261010');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.16.0');assert.equal(process.argv.length,2);
assert.match(process.env.GITHUB_RUN_ID??'',/^\d+$/);assert.match(process.env.GITHUB_RUN_ATTEMPT??'',/^\d+$/);assert.match(process.env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
const locations=sessionProvisionLocations(import.meta.url,process.env.RUNNER_TEMP,randomUUID()),root=locations.root,run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const pin=async path=>{const b=await readFile(path);return{path,bytes:b.length,sha256:sha(b)};},out=join(root,'desktop/evidence/terminal-session-provision',process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
const save=(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
await mkdir(dirname(out),{recursive:true});await mkdir(out);
const receipt={scope:'HOSTED_SEPARATE_EXECUTION_TREE_BUILD_AND_INVENTORY_ONLY',status:'STARTED_NOT_QUALIFIED',commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,inputs:[],phases:[],builds:[],nativeExecutionAdmitted:false,nativeArtifactsLoaded:false,providerCodeLoaded:false,realSession:false,productActivation:false};
let ownedWork=null;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('NODE_')&&!key.toUpperCase().startsWith('ELECTRON_')));
async function phase(name,executable,args,cwd,timeout=120000){
 const row={name,executable,args,cwd};receipt.phases.push(row);await save(`phase-${name}-before.json`,row);
 try{const result=await run(executable,args,{cwd,env,windowsHide:true,timeout,maxBuffer:16*1024*1024});row.exit=0;await writeFile(join(out,name+'.txt'),result.stdout+result.stderr,{flag:'wx'});return result.stdout;}
 catch(error){row.exit=error.code;row.killed=error.killed??false;row.signal=error.signal??null;await writeFile(join(out,name+'.txt'),(error.stdout??'')+(error.stderr??''),{flag:'wx'});throw error;}
 finally{await save(`phase-${name}-after.json`,row);}
}
try{
 const manifestPath=join(root,'desktop/tests/native/terminal-session-provision-inputs.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8'));
 assert.equal(manifest.scope,'SESSION_PROVISION_PREREQUISITE_SOURCE_PINS');assert.equal(manifest.nativeExecutionAdmitted,false);
 for(const row of manifest.inputs){assert.equal(resolve(root,row.path).startsWith(resolve(root)+'\\'),true);const actual=await pin(join(root,row.path));assert.equal(actual.bytes,row.bytes,row.path);assert.equal(actual.sha256,row.sha256,row.path);receipt.inputs.push(actual);}receipt.manifest=await pin(manifestPath);
 const work=locations.work;await mkdir(work);ownedWork=work;receipt.work=work;
 const source=await captureShutdownGraphResources({sourceRoot:root});assert.equal(source.entries.length,55);await save('source-capture.json',source);
 const prepared=await prepareProductionResources({capture:source,parentDirectory:work});receipt.prepared={directory:prepared.directory,manifest:prepared.manifest};
 const application=join(work,'execution');await mkdir(application);await cp(prepared.applicationDirectory,application,{recursive:true,errorOnExist:true,force:false});
 const deps=join(work,'electron-deps');await mkdir(deps);for(const name of ['package.json','package-lock.json'])await copyFile(join(root,'desktop',name),join(deps,name));
 const npm=join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),gyp=join(dirname(process.execPath),'node_modules/npm/node_modules/node-gyp');assert.equal(JSON.parse(await readFile(join(gyp,'package.json'),'utf8')).version,'12.3.0');
 await phase('locked-electron-packages',process.execPath,[npm,'--prefix',deps,'ci','--ignore-scripts','--no-audit','--no-fund'],root);
 const electronRoot=join(deps,'node_modules/electron');assert.equal(JSON.parse(await readFile(join(electronRoot,'package.json'),'utf8')).version,'44.5.1');
 await phase('electron-distribution',process.execPath,[join(electronRoot,'install.js')],root);receipt.electronExecutable=await pin(join(electronRoot,'dist/electron.exe'));
 const provider=join(application,'desktop/runtime/terminal-provider');await phase('locked-provider-packages',process.execPath,[npm,'--prefix',provider,'ci','--ignore-scripts','--no-audit','--no-fund'],root);
 const locator=join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe');
 const vs=(await phase('compiler-discovery',locator,['-products','*','-latest','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],root)).trim();assert.ok(vs&&!/[\r\n]/.test(vs));
 const versions=(await readdir(join(vs,'VC/Tools/MSVC'))).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));assert.ok(versions.length);
 const msbuild=join(vs,'MSBuild/Current/Bin/amd64/MSBuild.exe'),hook=join(gyp,'src/win_delay_load_hook.cc');receipt.tools=[];for(const path of [process.execPath,npm,join(gyp,'bin/node-gyp.js'),locator,msbuild,hook])receipt.tools.push(await pin(path));
 const targets=[['terminal-host-roster-candidate','siren_terminal_host_roster_candidate'],['terminal-creator-three-lane','siren_terminal_creator_three_lane']];
 for(const [folder,target] of targets){
  const candidate=join(work,folder);await mkdir(candidate);const build={folder,target,source:[],trackedInputs:[]};receipt.builds.push(build);
  for(const name of ['ownership.cc','peer-endpoints.inc','binding.gyp']){const original=join(root,'desktop/native',folder,name);build.source.push(await pin(original));await copyFile(original,join(candidate,name));}
  await phase(folder+'-configure',process.execPath,[join(gyp,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+join(work,'headers'),'--msvs_version=2026','--verbose'],candidate);
  await phase(folder+'-compile',msbuild,['build/'+target+'.vcxproj','/p:SolutionDir='+join(candidate,'build')+'/', '/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+versions[0],'/p:WindowsTargetPlatformVersion=10.0.26100.0','/p:TrackFileAccess=true','/verbosity:diagnostic'],candidate);
  const project=await readFile(join(candidate,'build',target+'.vcxproj'),'utf8');assert.ok(project.includes('win_delay_load_hook.cc'));assert.match(project,/<DelayLoadDLLs>node.exe(?:;|<)/i);
  const tracked=new Set();async function walk(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else if(/\.read\.\d+\.tlog$/i.test(entry.name)){const bytes=await readFile(path);await copyFile(path,join(out,folder+'-'+entry.name));for(const line of bytes.toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/)){for(const name of line.trim().replace(/^\^/,'').split('|'))if(/^[A-Za-z]:[\\/]/.test(name))tracked.add(name);}}}}await walk(join(candidate,'build'));
  for(const path of [...tracked].sort())build.trackedInputs.push(await pin(path));for(const required of [/[/\\]win_delay_load_hook\.cc$/i,/[/\\]node_api\.h$/i,/[/\\]windows\.h$/i])assert.ok(build.trackedInputs.some(row=>required.test(row.path)));
  const binary=join(candidate,'build/Release',target+'.node'),bytes=await readFile(binary);assert.equal(bytes.readUInt16LE(0),0x5a4d);assert.equal(bytes.readUInt16LE(bytes.readUInt32LE(0x3c)+4),0x8664);build.binary=await pin(binary);
  const destination=join(application,'desktop/native',folder,'build/Release');await mkdir(destination,{recursive:true});await copyFile(binary,join(destination,target+'.node'));await copyFile(binary,join(out,target+'.node'));await copyFile(join(candidate,'build',target+'.vcxproj'),join(out,target+'.vcxproj'));
 }
 await recheckPreparedProductionResources(prepared);const inventory=await captureTerminalSessionExecutionResources({sourceCapture:source,applicationDirectory:application});await recheckTerminalSessionExecutionResources(inventory);await recheckPreparedProductionResources(prepared);
 assert.equal(inventory.nativeBinaries.length,2);for(const row of inventory.nativeBinaries){const build=receipt.builds.find(b=>row.relativePath.endsWith('/'+b.target+'.node'));assert.equal(row.sha256,build.binary.sha256);assert.equal(row.bytes,build.binary.bytes);}
 await save('execution-inventory.json',inventory);receipt.inventory={files:inventory.files.length,directories:inventory.directories.length,totalBytes:inventory.totalBytes,binaryCompatibility:inventory.binaryCompatibility};
 // Retain every exact execution file as inert DATA in the artifact. Never run it.
 const retained=join(out,'execution');await cp(application,retained,{recursive:true,errorOnExist:true,force:false});for(const row of inventory.files){const actual=await pin(join(retained,...row.relativePath.split('/')));assert.equal(actual.bytes,row.bytes);assert.equal(actual.sha256,row.sha256);}
 for(const row of receipt.inputs)assert.deepEqual(await pin(row.path),row);assert.deepEqual(await pin(manifestPath),receipt.manifest);for(const row of receipt.tools)assert.deepEqual(await pin(row.path),row);for(const build of receipt.builds)assert.deepEqual(await pin(build.binary.path),build.binary);
 receipt.status='SEPARATE_EXECUTION_TREE_COMPILED_AND_INVENTORIED_NOT_LOADED';
}catch(error){receipt.status='FAILED';receipt.error={code:error.code??null,message:error.message,stack:error.stack};process.exitCode=1;console.error(error);}
finally{
 if(receipt.status==='FAILED'&&ownedWork){try{receipt.failureRetention=await retainSessionProvisionFailure({workDirectory:ownedWork,artifactDirectory:out});await save('failure-retention.json',receipt.failureRetention);}catch(error){receipt.failureRetentionError={message:error.message,code:error.code??null};process.exitCode=1;}}
 else if(receipt.status==='FAILED')receipt.failureRetention={workCreated:false,selectedTreesCreated:false};
 await save('result.json',receipt);console.log(JSON.stringify({status:receipt.status,builds:receipt.builds.length,inventory:receipt.inventory??null,nativeExecutionAdmitted:false}));
}
