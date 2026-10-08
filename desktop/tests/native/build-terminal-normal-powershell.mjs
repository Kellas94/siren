// CI-only build of exact checked-in bytes. No product activation or admission.
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join,dirname,resolve,parse,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLICATION_INPUTS,CANDIDATE_SCOPE,requireCandidateCi,validateOwnershipCandidate,validatePublicationInputs,requireWorkflowIsolation,validateCandidateObservation} from './terminal-normal-powershell-contract.mjs';
import {captureTerminalCandidateGraph,recheckTerminalCandidateGraph} from './terminal-candidate-graph.mjs';
requireCandidateCi({platform:process.platform,arch:process.arch,node:process.version,env:process.env});
assert.equal(process.argv.length,3,'EXACT_TOOL_DISCOVERY_ARGUMENT_REQUIRED');
const run=promisify(execFile),hash=b=>createHash('sha256').update(b).digest('hex');
const root=fileURLToPath(new URL('../../../',import.meta.url)),desktop=join(root,'desktop');
const toolsPath=resolve(process.argv[2]);
const output=join(desktop,'evidence/terminal-normal-powershell-build',new Date().toISOString().split(':').join('-')+'-'+randomUUID());
for(let p=dirname(output);p!==parse(p).root;p=dirname(p)){
 try{assert.equal((await lstat(p)).isSymbolicLink(),false,'LINKED_OUTPUT_PARENT');}catch(e){if(e.code!=='ENOENT')throw e;}
}
await mkdir(output,{recursive:true});
const candidate=join(output,'candidate');await mkdir(candidate);
const receipt={schema:1,scope:CANDIDATE_SCOPE,admitted:false,status:'STARTED_NOT_QUALIFIED',output,
 ci:{runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,sha:process.env.GITHUB_SHA,ref:process.env.GITHUB_REF,image:process.env.ImageVersion},
 node:{path:process.execPath,version:process.version,versions:process.versions},sources:[],toolInputs:[],buildInputs:[],binaries:[],phases:[],
 boundaries:{productActivation:false,packagedAdmission:false,normalShellRequiredRoles:['creator','powershell'],exactTotalProcessCountAsserted:false,mainLossRetested:false,historicalStressRepeated:false,filesystem:'Node-visible links refused; native reparse/check-use proof is not asserted'}};
const save=()=>writeFile(join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const budget={files:0,bytes:0,maxFiles:16384,maxFileBytes:256*1024*1024,maxBytes:1024*1024*1024};
const recorded=new Map();
async function inspect(path){
 const stat=await lstat(path);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'REGULAR_INPUT_REQUIRED: '+path);
 assert.ok(stat.size<=budget.maxFileBytes&&budget.files+1<=budget.maxFiles&&budget.bytes+stat.size<=budget.maxBytes,'INPUT_READ_BUDGET');
 const bytes=await readFile(path);assert.equal(bytes.length,stat.size,'INPUT_SIZE_CHANGED');budget.files++;budget.bytes+=bytes.length;
 return {path,bytes:bytes.length,sha256:hash(bytes)};
}
async function record(path,rows){
 const item=await inspect(path);if(recorded.has(path))assert.equal(recorded.get(path).sha256,item.sha256,'INPUT_CHANGED_DURING_CAPTURE');
 else recorded.set(path,item);rows.push(item);return item;
}
async function walk(directory,rows,depth=0){
 assert.ok(depth<=64,'INPUT_DEPTH_BUDGET');assert.ok((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink(),'LINKED_INPUT_DIRECTORY');
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const path=join(directory,entry.name);assert.equal(entry.isSymbolicLink(),false,'LINKED_INPUT');
  if(entry.isDirectory())await walk(path,rows,depth+1);else await record(path,rows);
 }
}
async function jsonArtifact(name,value){
 const path=join(output,name),bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');await writeFile(path,bytes,{flag:'wx'});
 return {path,bytes:bytes.length,sha256:hash(bytes)};
}
async function phase(name,exe,args,cwd,timeout=120000){
 const row={name,exe,args,cwd,timeoutMs:timeout,started:new Date().toISOString()};receipt.phases.push(row);await save();
 console.log(JSON.stringify({phase:name,status:'starting',output}));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.toUpperCase().startsWith('NODE_')&&!k.toUpperCase().startsWith('ELECTRON_')));
 try{
  const result=await run(exe,args,{cwd,windowsHide:true,shell:false,timeout,maxBuffer:8*1024*1024,env});
  await writeFile(join(output,name+'.stdout.txt'),result.stdout,{flag:'wx'});await writeFile(join(output,name+'.stderr.txt'),result.stderr,{flag:'wx'});
  row.status='success';return result;
 }catch(error){
  await writeFile(join(output,name+'-failed.stdout.txt'),error.stdout??'',{flag:'wx'});await writeFile(join(output,name+'-failed.stderr.txt'),error.stderr??'',{flag:'wx'});
  row.status='failed';row.error={code:error.code,signal:error.signal,killed:error.killed,message:error.message};throw error;
 }finally{row.finished=new Date().toISOString();await save();}
}
try{
 validatePublicationInputs(PUBLICATION_INPUTS);
 requireWorkflowIsolation({candidate:await readFile(join(root,'.github/workflows/terminal-normal-powershell.yml'),'utf8'),historical:await readFile(join(root,'.github/workflows/terminal-prerequisite.yml'),'utf8'),previous:await readFile(join(root,'.github/workflows/terminal-ownership-candidate.yml'),'utf8')});
 for(const relativePath of PUBLICATION_INPUTS){
  const path=join(root,relativePath),input=await record(path,receipt.sources);input.relativePath=relativePath;
  const preserved=join(output,'originals',relativePath);await mkdir(dirname(preserved),{recursive:true});await writeFile(preserved,await readFile(path),{flag:'wx'});
  assert.equal(hash(await readFile(preserved)),input.sha256,'ORIGINAL_PRESERVATION_FAILED');input.preserved=preserved;
 }
 const source=await readFile(join(desktop,'native/terminal-creator-async/ownership.cc')),binding=await readFile(join(desktop,'native/terminal-creator-async/binding.gyp'));
 receipt.candidate=validateOwnershipCandidate({source,binding});
 for(const [name,bytes] of [['ownership.cc',source],['binding.gyp',binding]]){
  const destination=join(candidate,name);await writeFile(destination,bytes,{flag:'wx'});
  assert.deepEqual(await readFile(destination),bytes,'CANDIDATE_COPY_CHANGED');await record(destination,receipt.buildInputs);
 }
 const toolBytes=await readFile(toolsPath),tools=JSON.parse(toolBytes.toString().trimStart());
 receipt.toolDiscovery=await record(toolsPath,receipt.toolInputs);await writeFile(join(output,'tool-discovery.json'),toolBytes,{flag:'wx'});
 const compilers=tools.compilers.filter(c=>/[/\\]cl\.exe$/i.test(c.path)).sort((a,b)=>b.path.localeCompare(a.path,undefined,{numeric:true}));
 assert.ok(compilers.length);assert.equal(tools.visualStudio.length,1);
 const compiler=compilers[0],link=tools.compilers.find(c=>c.path===compiler.path.replace(/cl\.exe$/i,'link.exe'));assert.ok(link);
 assert.equal(hash(await readFile(compiler.path)),compiler.sha256);assert.equal(hash(await readFile(link.path)),link.sha256);
 const version=compiler.path.match(/[/\\]MSVC[/\\]([0-9.]+)[/\\]/)?.[1];assert.ok(version);
 const sdk=tools.sdks.filter(p=>/[\\/]10\.0\.26100\.0$/.test(p));assert.equal(sdk.length,1);
 const msbuild=join(tools.visualStudio[0],'MSBuild/Current/Bin/amd64/MSBuild.exe');
 const gypRoot=join(dirname(process.execPath),'node_modules/npm/node_modules/node-gyp');
 assert.equal(JSON.parse(await readFile(join(gypRoot,'package.json'),'utf8')).version,'12.3.0');
 assert.ok(tools.python?.path&&isAbsolute(tools.python.path),'PYTHON_DISCOVERY_REQUIRED');
 receipt.toolchain={compiler,link,msvcVersion:version,sdk:sdk[0],msbuild,nodeGyp:'12.3.0',python:tools.python};
 for(const path of [process.execPath,msbuild,compiler.path,link.path,tools.python.path])await record(path,receipt.toolInputs);
 assert.equal(hash(await readFile(tools.python.path)),tools.python.sha256);
 // Keep the entire node-gyp implementation/license and selected compiler DLLs
 // in the hash graph, in addition to the original diagnostic build logs.
 await walk(gypRoot,receipt.toolInputs);
 for(const entry of await readdir(dirname(compiler.path),{withFileTypes:true}))if(entry.isFile()&&/\.(exe|dll)$/i.test(entry.name))await record(join(dirname(compiler.path),entry.name),receipt.toolInputs);
 await phase('python-version',tools.python.path,['--version'],candidate,10000);
 const packagePath=join(desktop,'tests/fixtures/terminal-node-pty/package.json');
 const graph=await captureTerminalCandidateGraph({packagePath});
 receipt.dependencyGraph={...await jsonArtifact('dependency-graph.json',graph),summary:graph.summary,unchanged:false};
 const runtimeRows=[];await walk(join(desktop,'node_modules/electron/dist'),runtimeRows);
 receipt.runtimeDistribution={...await jsonArtifact('runtime-distribution.json',{files:runtimeRows}),files:runtimeRows.length,bytes:runtimeRows.reduce((n,r)=>n+r.bytes,0)};
 assert.equal(JSON.parse(await readFile(join(desktop,'node_modules/electron/package.json'),'utf8')).version,'44.5.1');
 await record(join(desktop,'node_modules/electron/package.json'),receipt.toolInputs);
 await phase('configure',process.execPath,[join(gypRoot,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+join(output,'headers'),'--msvs_version=2026','--python='+tools.python.path,'--verbose'],candidate);
 await walk(join(output,'headers'),receipt.buildInputs);
 await phase('compile',msbuild,[join(candidate,'build/siren_terminal_creator_async.vcxproj'),'/p:SolutionDir='+join(candidate,'build')+'/','/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+version,'/p:WindowsTargetPlatformVersion=10.0.26100.0','/p:TrackFileAccess=true','/verbosity:diagnostic'],candidate);
 // Capture generated compiler/link tracker inputs: actual SDK/MSVC headers,
 // libraries and objects supplement downloaded Electron headers and tools.
 const generated=[];await walk(join(candidate,'build'),generated);receipt.buildInputs.push(...generated);
 const tlogs=generated.filter(r=>/\.(?:read|command)\.\d+\.tlog$/i.test(r.path));
 assert.ok(tlogs.some(r=>/[\\/]CL\.read\.\d+\.tlog$/i.test(r.path)),'COMPILER_HEADER_TRACKING_MISSING');
 const tracked=new Set();
 for(const log of tlogs.filter(r=>/\.read\.\d+\.tlog$/i.test(r.path))){
  const bytes=await readFile(log.path),text=bytes.subarray(0,2).equals(Buffer.from([255,254]))?bytes.toString('utf16le').slice(1):bytes.toString('utf8');
  for(const line of text.split(/\r?\n/)){const path=line.trim();if(isAbsolute(path)&&!path.startsWith('^'))tracked.add(path);}
 }
 receipt.compilerTrackedInputs=[];
 for(const path of [...tracked].sort())await record(path,receipt.compilerTrackedInputs);
 assert.ok(receipt.compilerTrackedInputs.some(r=>/[\\/]node_api\.h$/i.test(r.path)),'NODE_HEADER_LINEAGE_MISSING');
 assert.ok(receipt.compilerTrackedInputs.some(r=>/[\\/]windows\.h$/i.test(r.path)),'WINDOWS_HEADER_LINEAGE_MISSING');
 const addonPath=join(candidate,'build/Release/siren_terminal_creator_async.node'),binary=await record(addonPath,receipt.binaries),pe=await readFile(addonPath);
 assert.equal(pe.subarray(0,2).toString(),'MZ');assert.equal(pe.readUInt16LE(pe.readUInt32LE(60)+4),0x8664);binary.machine='x64';
 const actualNodes=generated.filter(r=>r.path.endsWith('.node'));assert.equal(actualNodes.length,1,'UNEXPECTED_BUILT_TARGET');
 assert.equal(actualNodes[0].sha256,binary.sha256);
 const runner=join(desktop,'tests/native/terminal-normal-powershell.mjs');
 const fixtureCompiler=await record(join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),receipt.toolInputs);
 const tested=await phase('normal-powershell-control-history',process.execPath,[runner,addonPath],desktop,60000);
 const result=JSON.parse(tested.stdout.trim());receipt.positive=result;
 const electron=runtimeRows.find(row=>row.path===join(desktop,'node_modules/electron/dist/electron.exe'));assert.ok(electron,'ELECTRON_RUNTIME_MISSING');
 const {loadedAddon,loadedRuntime}=validateCandidateObservation({result,addon:binary,electron});
 receipt.loadedAddon={...loadedAddon,evidence:'Existing runner explicitly requires this absolute addon path; pre/post input hashes agree. No independent loader-hook attestation is asserted.'};
 receipt.loadedRuntime=loadedRuntime;receipt.normalShellObservation=validateCandidateObservation({result,addon:binary,electron}).normalShell;
 assert.equal(result.inputs.find(row=>row.path===fixtureCompiler.path)?.sha256,fixtureCompiler.sha256,'FIXTURE_COMPILER_IDENTITY_CHANGED');
 receipt.runnerInputs=[];
 for(const input of result.inputs){
  const captured=await record(input.path,receipt.runnerInputs);assert.equal(captured.sha256,input.sha256,'RUNNER_INPUT_IDENTITY_CHANGED');assert.equal(captured.bytes,input.bytes,'RUNNER_INPUT_SIZE_CHANGED');
 }
 for(const artifact of recorded.values())assert.equal(hash(await readFile(artifact.path)),artifact.sha256,'BUILD_INPUT_CHANGED: '+artifact.path);
 for(const original of receipt.sources)assert.equal(hash(await readFile(original.preserved)),original.sha256,'PRESERVED_ORIGINAL_CHANGED');
 assert.equal((await recheckTerminalCandidateGraph({packagePath,receipt:graph})).unchanged,true);receipt.dependencyGraph.unchanged=true;
 receipt.inputBudget={...budget};receipt.status=CANDIDATE_SCOPE;
}catch(error){receipt.status='FAILED';receipt.error={code:error.code,message:error.message,stack:error.stack};throw error;}
finally{await save();console.log(JSON.stringify({status:receipt.status,scope:CANDIDATE_SCOPE,output,admitted:false}));}
