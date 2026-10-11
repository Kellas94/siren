// Conditional finite orchestration evidence only; no actual process/install/native.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as url from 'node:url';
import * as util from 'node:util';
import {generateTerminalConnectDerivative} from './terminal-connect-derivative.mjs';
import {generateTerminalCreatorTransportDerivative} from './terminal-creator-transport-derivative.mjs';
const candidate=new URL('./terminal-fresh-runtime-provision.mjs',import.meta.url);
let source=null;try{source=readFileSync(candidate,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
async function isolated(overrides={}){
 assert.notEqual(source,null,'Missing inactive once-only build provisioner');
 const calls=[],context=vm.createContext({Buffer,URL,process:{platform:'linux',arch:'x64',versions:{node:'24.16.0'},argv:['node','C:\\repo\\desktop\\tests\\native\\terminal-fresh-runtime-provision.mjs'],env:{},...overrides}});
 const module=new vm.SourceTextModule(source,{context,initializeImportMeta(meta){meta.url='file:///C:/repo/desktop/tests/native/terminal-fresh-runtime-provision.mjs';}});
 const modules=new Map();await module.link(async name=>{const data=name==='./terminal-fresh-pair-driver.mjs'?{runFreshTerminalPair(){calls.push('pair');throw Error('Unexpected pair execution');}}:name==='node:crypto'?crypto:name==='node:path'?{...path,default:path.win32}:name==='node:url'?{...url,fileURLToPath:value=>path.win32.normalize(decodeURIComponent(new URL(value).pathname).slice(1).replaceAll('/','\\'))}:name==='node:fs'?{constants:{COPYFILE_EXCL:1},realpathSync:p=>p}:name==='node:fs/promises'?Object.fromEntries(['readFile','writeFile','mkdir','copyFile','cp','rename','readdir','lstat','open'].map(k=>[k,async()=>{calls.push(k);throw Error('Unexpected actual IO');}])):name==='node:child_process'?{execFile(){calls.push('execFile');throw Error('Unexpected actual process');}}:name==='node:util'?{types:util.types,promisify:fn=>async()=>fn()}:name.includes('inventory')?{captureFreshRuntimeInventory(){calls.push('inventory');throw 0;},recheckFreshRuntimeInventory(){calls.push('recheck');throw 0;}}:name.includes('retention')?{captureFreshRuntimeRetention(){calls.push('copy');throw 0;},recheckFreshRuntimeRetention(){calls.push('retained-recheck');throw 0;}}:name.includes('transport-derivative')?{generateTerminalCreatorTransportDerivative(){throw 0;}}:name.includes('connect-derivative')?{generateTerminalConnectDerivative(){throw 0;}}:null;assert.ok(data,'Unexpected import '+name);if(!modules.has(name))modules.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const key of Object.keys(data))this.setExport(key,data[key]);},{context}));return modules.get(name);});
 await module.evaluate({timeout:500});assert.equal(typeof module.namespace.provisionFreshTerminalRuntime,'function');return {api:module.namespace,calls};
}
test('import is inert and unsafe local context refuses before IO or process',async()=>{const {api,calls}=await isolated();assert.deepEqual(calls,[]);const r=await api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.deepEqual(calls,[]);});
test('extra arguments refuse without coercion or any IO',async()=>{const {api,calls}=await isolated();let hooks=0;const r=await api.provisionFreshTerminalRuntime(new Proxy({},{get(){hooks++;throw 0;}}));assert.equal(r.ok,false);assert.equal(hooks,0);assert.deepEqual(calls,[]);});
test('failed first attempt cannot be retried within the same module',async()=>{const {api,calls}=await isolated();assert.equal((await api.provisionFreshTerminalRuntime()).ok,false);assert.equal((await api.provisionFreshTerminalRuntime()).ok,false);assert.deepEqual(calls,[]);});

const repo=new URL('../../../',import.meta.url),prep='terminal-fresh-provisioner-preparation-20261011';
const mapping=JSON.parse(readFileSync(new URL(prep+'/historical-source-mapping.json',repo),'utf8'));
const graph=JSON.parse(readFileSync(new URL(prep+'/resource-manifest-design.json',repo),'utf8')).sourceGraph;
const required=['desktop/tests/native/terminal-fresh-runtime-provision.mjs','desktop/tests/native/terminal_historical_source_stage.py','desktop/tests/native/terminal-fresh-runtime-inventory.mjs','desktop/tests/native/terminal-fresh-runtime-retention.mjs','desktop/tests/native/terminal-connect-derivative.mjs','desktop/tests/native/terminal-creator-transport-derivative.mjs','desktop/tests/native/terminal-connect-raw-json.mjs','desktop/tests/native/terminal-connect-raw-file.mjs','desktop/tests/native/terminal-fresh-environment.mjs','desktop/tests/native/terminal-fresh-pair-model.mjs',prep+'/pins.json',prep+'/historical-source-mapping.json',prep+'/historical-execution-mapping.json',prep+'/resource-manifest-design.json','terminal-resolution-observation-20261011/hosted-v1.zip'];
const support=['desktop/package.json','desktop/package-lock.json','desktop/tests/fixtures/terminal-filesystem-evidence.cs','desktop/tests/fixtures/terminal-session-process-observer.cs'].map(name=>prep+'/'+mapping.inputs.find(r=>r.path===name).snapshot);
const resources=new Map([...required,...support].map(p=>[p,readFileSync(new URL(p,repo))]));
const sourceFiles=new Map(graph.map(row=>[row.path,readFileSync(new URL(prep+'/'+mapping.inputs.find(r=>r.path===row.path).snapshot,repo))]));
const originalAgent=readFileSync(new URL('../../../terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',import.meta.url));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const win=path.win32,root='C:\\repo',temp='C:\\temp',nonce='11111111-1111-4111-8111-111111111111',job=temp+'\\siren-fresh-runtime-'+nonce;
function hosted(){return {platform:'win32',arch:'x64',versions:{node:'24.16.0'},execPath:'C:\\node\\node.exe',argv:['C:\\node\\node.exe',root+'\\desktop\\tests\\native\\terminal-fresh-runtime-provision.mjs'],env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Kellas94/siren',GITHUB_REF:'refs/heads/probe/terminal-session-20261010',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),RUNNER_TEMP:temp,pythonLocation:'C:\\python','ProgramFiles(x86)':'C:\\Program Files (x86)',PATH:'C:\\tools',SystemRoot:'C:\\Windows',TEMP:'C:\\temp',TMP:'C:\\temp',GITHUB_TOKEN:'NEVER_IN_CHILD_ENV'}};}
async function orchestration(options={}){
 const files=new Map(),dirs=new Set(['C:\\',root,temp]),calls=[],writes=[],process=hosted();let copies=0,inventoryCalls=0,rechecks=0,retainedReceipt=null;
 const normal=p=>win.normalize(p),put=(p,b)=>{p=normal(p);for(let q=win.dirname(p);q!==win.dirname(q);q=win.dirname(q))dirs.add(q);files.set(p,Buffer.isBuffer(b)?b:Buffer.from(b));};
 const error=code=>Object.assign(Error('conditional '+code),{code});
 const refusedPath=options.trackedPath??'C:\\repo\\tracked\\refused.input';let trackedStats=0,diagnosticHooks=0,faultReady=false;
 const opaqueError=new Proxy({},{get(){diagnosticHooks++;throw Error('secret must not be inspected');},getOwnPropertyDescriptor(){diagnosticHooks++;throw Error('secret must not be inspected');}});
 for(const [p,b] of resources)put(win.join(root,...p.split('/')),b);
 const rows=[...resources].map(([p,b])=>({path:p,bytes:b.length,sha256:hash(b)}));
 const manifest={schema:1,scope:'FRESH_RUNTIME_BUILD_SOURCE_PINS',nativeAdmission:false,inputs:rows,diagnostics:required.filter(p=>p.startsWith('desktop/tests/native/')&&p.endsWith('.mjs'))};
 if(options.manifestMutate)options.manifestMutate(manifest);
 const manifestPath=root+'\\desktop\\tests\\native\\terminal-fresh-runtime-provision-inputs.json';put(manifestPath,JSON.stringify(manifest)+'\n');
 if(options.driftInput)put(root+'\\desktop\\tests\\native\\terminal-fresh-pair-model.mjs','changed');
 const node='C:\\node',gyp=node+'\\node_modules\\npm\\node_modules\\node-gyp',vsInstallation=options.vsInstallation??'C:\\VS',vsCompiler=win.join(vsInstallation,'MSBuild/Current/Bin/Roslyn/csc.exe');
 for(const p of [node+'\\node.exe',node+'\\node_modules\\npm\\bin\\npm-cli.js',gyp+'\\bin\\node-gyp.js',gyp+'\\src\\win_delay_load_hook.cc','C:\\python\\python.exe','C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',win.join(vsInstallation,'MSBuild/Current/Bin/amd64/MSBuild.exe'),vsCompiler,'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe','C:\\tools\\node_api.h','C:\\tools\\windows.h'])put(p,'inert tool');put(gyp+'\\package.json','{"version":"12.3.0"}');
 if(options.vsCompilerMissing)files.delete(vsCompiler);dirs.add(win.join(vsInstallation,'VC/Tools/MSVC'));dirs.add(win.join(vsInstallation,'VC/Tools/MSVC/14.50.12345'));
 const fakeStat=p=>{p=normal(p);if(!dirs.has(p)&&!files.has(p))throw error('ENOENT');return {dev:1n,ino:1n,mode:dirs.has(p)?16877n:33188n,nlink:p===vsCompiler?BigInt(options.vsCompilerAfterRunNlink&&calls.some(x=>x[0]==='phase'&&x[1]==='helper')?options.vsCompilerAfterRunNlink:options.vsCompilerNlink??1):1n,size:BigInt(files.get(p)?.length??0),mtimeNs:2n,ctimeNs:3n,isFile:()=>files.has(p),isDirectory:()=>dirs.has(p),isSymbolicLink:()=>false};};
 const fs={
  async open(p,flags){p=normal(p);calls.push(['open',p,flags]);assert.equal(flags,0);if(!files.has(p))throw error('ENOENT');if(p===refusedPath&&options.pinFault==='open')throw opaqueError;let stats=0;return {async stat(){calls.push(['handle-stat',p]);stats++;const st=fakeStat(p);if(p===refusedPath){if(options.pinFault==='nlink')st.nlink=2n;if(options.pinFault==='handle-before'&&stats===1)st.ino=77n;if(options.pinFault==='handle-after'&&stats===2)st.ctimeNs=77n;}return st;},async read(buffer,offset,length,position){calls.push(['handle-read',p,length,position]);if(p===refusedPath&&['handle-read','read-and-close'].includes(options.pinFault))throw opaqueError;const bytes=files.get(p);let n=Math.min(length,Math.max(0,bytes.length-position));if(p===refusedPath&&options.pinFault==='partial-read')n=Math.min(n,3);if(p===refusedPath&&options.pinFault==='short-read')n=0;if(p===refusedPath&&options.pinFault==='extra-byte'&&position===bytes.length){buffer[offset]=1;return {bytesRead:1};}bytes.copy(buffer,offset,position,position+n);return {bytesRead:n};},async close(){calls.push(['close',p]);if(p===refusedPath&&['close','read-and-close'].includes(options.pinFault))throw opaqueError;}};},
  async lstat(p){calls.push(['lstat',p]);const stat=fakeStat(p);if(p===refusedPath&&faultReady&&options.pinFault){trackedStats++;if(options.pinFault==='lstat')throw opaqueError;if(['nlink','accessor','metadata-limit','metadata-proxy'].includes(options.pinFault)){stat.nlink=2n;if(options.pinFault==='accessor')Object.defineProperty(stat,'dev',{get(){diagnosticHooks++;throw Error('do not read metadata getter');}});}if(options.pinFault==='nlink-zero')stat.nlink=0n;if(options.pinFault==='nlink-negative')stat.nlink=-1n;if(options.pinFault==='nlink-limit')stat.nlink=1n<<64n;if(options.pinFault==='metadata-limit')stat.dev=1n<<200n;if(options.pinFault==='metadata-proxy')return new Proxy(stat,{getOwnPropertyDescriptor(){diagnosticHooks++;throw Error('do not inspect proxy metadata');}});if(options.pinFault==='directory')stat.isFile=()=>false;if(options.pinFault==='symlink')stat.isSymbolicLink=()=>true;if(options.pinFault==='negative-size')stat.size=-1n;if(options.pinFault==='size-limit')stat.size=536870913n;if(options.pinFault==='changed'&&trackedStats===2)stat.ctimeNs=99n;}return stat;},
  async readFile(p,encoding){p=normal(p);calls.push(['readFile',p]);if(!files.has(p))throw error('ENOENT');if(p===refusedPath&&options.pinFault==='read')throw opaqueError;if(p===refusedPath&&options.pinFault==='read-size')return Buffer.from('different length');return encoding?files.get(p).toString(encoding):files.get(p);},
  async writeFile(p,b,o){p=normal(p);writes.push(p);if(options.writeFail&&p.endsWith(options.writeFail))throw error('EIO');assert.equal(o.flag,'wx');if(files.has(p)||dirs.has(p))throw error('EEXIST');put(p,b);},
  async mkdir(p,o){p=normal(p);if(o?.recursive){for(let q=p;q!==win.dirname(q);q=win.dirname(q))dirs.add(q);return;}if(files.has(p)||dirs.has(p))throw error('EEXIST');assert.ok(dirs.has(win.dirname(p)),p);dirs.add(p);},
  async copyFile(a,b,flags){a=normal(a);b=normal(b);calls.push(['copyFile',a,b]);assert.equal(flags,1);if(!files.has(a))throw error('ENOENT');if(files.has(b)||dirs.has(b))throw error('EEXIST');put(b,options.diagnosticCopyDrift&&b.includes("\\diagnostics\\")?Buffer.from("changed diagnostic"):files.get(a));},
  async rename(a,b){a=normal(a);b=normal(b);if(files.has(b)||dirs.has(b))throw error('EEXIST');assert.ok(files.has(a));put(b,files.get(a));files.delete(a);},
  async cp(a,b,o){a=normal(a);b=normal(b);assert.deepEqual(o&&JSON.parse(JSON.stringify(o)),{recursive:true,errorOnExist:true,force:false});assert.ok(!dirs.has(b)&&!files.has(b));for(const p of [...dirs])if(p===a||p.startsWith(a+'\\'))dirs.add(b+p.slice(a.length));for(const [p,bytes] of [...files])if(p.startsWith(a+'\\'))put(b+p.slice(a.length),bytes);},
  async readdir(p,o){p=normal(p);const names=new Set();for(const q of [...dirs,...files.keys()])if(win.dirname(q)===p)names.add(win.basename(q));return [...names].map(name=>o?.withFileTypes?{name,isDirectory:()=>dirs.has(win.join(p,name)),isSymbolicLink:()=>false}:name);}
 };
 const run=async(executable,args,opts)=>{
  const name=args.includes('-c')?'stage':args.includes('ci')?(args.includes(job+'\\build-work\\electron-deps')?'desktop-npm':'provider-npm'):executable.endsWith('vswhere.exe')?'locator':args[0]?.endsWith('install.js')?'electron-install':args.includes('configure')?'configure':executable.endsWith('csc.exe')?'helper':'compile';
  calls.push(['phase',name,executable,[...args],opts]);assert.equal(opts.windowsHide,true);assert.equal(opts.env.GITHUB_TOKEN,undefined);assert.ok(opts.timeout<=120000);let stdout='';
  if(options.failPhase===name)throw Object.assign(Error('conditional process failure'),{code:7,stdout:'retained failing stdout',stderr:'retained failing stderr',killed:false});
  if(name==='stage'){assert.equal(args[0],'-I');const target=args.at(-1);for(const [p,b] of sourceFiles)put(win.join(target,...p.split('/')),b);stdout=JSON.stringify({schema:'siren-terminal-historical-source-stage/v1',sourceEntries:55,sourceBytes:840444,nativeAdmission:false,executionAuthorized:false,files:graph.map(({path,bytes,sha256})=>({path,bytes,sha256}))});}
  else if(name==='desktop-npm'){const electron=job+'\\build-work\\electron-deps\\node_modules\\electron';put(electron+'\\package.json',JSON.stringify({version:options.electronVersion??'44.5.1'}));put(electron+'\\install.js','inert installer');}
  else if(name==='electron-install'){const dist=job+'\\build-work\\electron-deps\\node_modules\\electron\\dist';for(const p of ['electron.exe','LICENSE','LICENSES.chromium.html','snapshot_blob.bin','hidden-extra.dll','locales\\ro.pak'])put(dist+'\\'+p,'inert entire dist member');dirs.add(dist+'\\empty-directory');}
  else if(name==='provider-npm'){const p=job+'\\fresh-runtime\\execution\\desktop\\runtime\\terminal-provider\\node_modules\\node-pty';put(p+'\\package.json','{"version":"1.1.0"}');put(p+'\\lib\\windowsPtyAgent.js',originalAgent);put(p+'\\prebuilds\\win32-x64\\pty.node','inert provider binary');}
  else if(name==='locator')stdout=vsInstallation+'\r\n';
  else if(name==='configure'){const target=win.basename(opts.cwd)==='terminal-host-roster-candidate'?'siren_terminal_host_roster_candidate':'siren_terminal_creator_three_lane';put(win.join(opts.cwd,'build',target+'.vcxproj'),'<DelayLoadDLLs>node.exe</DelayLoadDLLs>win_delay_load_hook.cc');}
  else if(name==='compile'){const target=args[0].slice(6,-8),bytes=Buffer.alloc(256);bytes.writeUInt16LE(0x5a4d);bytes.writeUInt32LE(128,0x3c);bytes.writeUInt32LE(0x4550,128);bytes.writeUInt16LE(0x8664,132);put(win.join(opts.cwd,'build','Release',target+'.node'),bytes);if(options.pinFault)put(refusedPath,options.pinFault==='empty-input'?'':'inert input');put(win.join(opts.cwd,'build','native.read.1.tlog'),Buffer.from((options.pinFault?refusedPath+'\r\n':'')+gyp+'\\src\\win_delay_load_hook.cc\r\n'+(options.omitTrackedHeaders?'':'C:\\tools\\node_api.h\r\nC:\\tools\\windows.h\r\n'),'utf16le'));faultReady=true;}
  else if(name==='helper')put(args.find(a=>a.startsWith('/out:')).slice(5),'inert helper binary');
  return {stdout,stderr:''};
 };
 const debugErrors=[];const context=vm.createContext({Buffer,URL,process,captureDebugError:e=>debugErrors.push(e),console:{log(){throw Error('Unexpected CLI execution');}}});
 const candidateModule=new vm.SourceTextModule(source,{context,initializeImportMeta(meta){meta.url='file:///C:/repo/desktop/tests/native/terminal-fresh-runtime-provision.mjs';meta.main=false;}});
 const cached=new Map();await candidateModule.link(async name=>{const data=name==='./terminal-fresh-pair-driver.mjs'?{runFreshTerminalPair(){calls.push('pair');throw Error('Unexpected pair execution');}}:name==='node:crypto'?{...crypto,randomUUID:()=>nonce}:name==='node:path'?{...path,default:win}:name==='node:url'?{...url,fileURLToPath:value=>win.normalize(decodeURIComponent(new URL(value).pathname).slice(1).replaceAll('/','\\'))}:name==='node:fs'?{constants:{COPYFILE_EXCL:1,O_RDONLY:0,O_NOFOLLOW:0},realpathSync:p=>{if(p===refusedPath&&options.pinFault==='realpath')throw opaqueError;return p===refusedPath&&options.pinFault==='canonical'?normal(p).toLowerCase():normal(p);}}:name==='node:fs/promises'?fs:name==='node:child_process'?{execFile(){throw Error('Never call host process');}}:name==='node:util'?{types:util.types,promisify:()=>run}:name.includes('inventory')?{async captureFreshRuntimeInventory(p){inventoryCalls++;calls.push(['inventory',p]);if(options.inventoryFail)throw Error('conditional collector refusal');return {sha256:'a'.repeat(64),files:[...files.keys()].filter(x=>x.startsWith(p+'\\')).map(path=>({path:path.slice(p.length+1)}))};},async recheckFreshRuntimeInventory(){calls.push(['live-recheck']);return true;}}:name.includes('retention')?{async captureFreshRuntimeRetention(value){copies++;calls.push(['retention',value.sourceDirectory,value.retainedDirectory]);if(options.copyFail){dirs.add(value.retainedDirectory);put(value.retainedDirectory+'\\partial.txt','retain partial');throw Error('conditional copy failure');}for(const p of [...dirs])if(p===value.sourceDirectory||p.startsWith(value.sourceDirectory+'\\'))dirs.add(value.retainedDirectory+p.slice(value.sourceDirectory.length));for(const [p,b] of [...files])if(p.startsWith(value.sourceDirectory+'\\'))put(value.retainedDirectory+p.slice(value.sourceDirectory.length),b);retainedReceipt={copiedFiles:files.size,sha256:'b'.repeat(64)};return retainedReceipt;},async recheckFreshRuntimeRetention(receipt){assert.equal(receipt,retainedReceipt);rechecks++;if(options.recheckFail)throw Error('conditional retained identity drift');return true;}}:name.includes('transport-derivative')?{generateTerminalCreatorTransportDerivative}:name.includes('connect-derivative')?{generateTerminalConnectDerivative}:null;assert.ok(data,name);if(!cached.has(name))cached.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const key of Object.keys(data))this.setExport(key,data[key]);},{context}));return cached.get(name);});
 await candidateModule.evaluate({timeout:500});assert.equal(calls.length,0,'import must be inert even in valid hosted DATA context');return {api:candidateModule.namespace,files,dirs,calls,writes,counts:()=>({copies,inventoryCalls,rechecks}),manifest,manifestPath,process,debugErrors,refusedPath,diagnosticCounts:()=>({trackedStats,diagnosticHooks})};
}
test('conditional hosted once-only full build precedes complete retention without shell execution',async()=>{const f=await orchestration(),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.status,'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION');assert.equal(r.helperExecutions,0);assert.equal(r.realSessions,0);assert.equal(r.electronExecuted,false);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(r.armProgressionAuthorized,false);assert.deepEqual(f.counts(),{copies:1,inventoryCalls:1,rechecks:1});assert.equal(f.calls.filter(x=>x[0]==='phase').length,11);for(const p of ['electron\\dist\\hidden-extra.dll','electron\\dist\\LICENSES.chromium.html','helpers\\filesystem-evidence.exe','helpers\\process-observer.exe','execution\\desktop\\src\\terminal\\diagnostic-creator-entry.mjs'])assert.ok(f.files.has(job+'\\retained\\fresh-runtime\\'+p),p);assert.ok(f.dirs.has(job+'\\retained\\fresh-runtime\\electron\\dist\\empty-directory'));assert.ok(f.dirs.has(job+'\\retained\\fresh-evidence\\connect'));assert.ok(f.dirs.has(job+'\\project-Șiren-Δ'));assert.equal(await f.api.recheckProvisionedFreshRuntime(r),true);assert.equal(await f.api.recheckProvisionedFreshRuntime({...r}),false);assert.equal((await f.api.provisionFreshTerminalRuntime()).ok,false);});
test('conditional mismatched manifest input prevents all build and owned writes',async()=>{const f=await orchestration({driftInput:true}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(f.calls.some(x=>x[0]==='phase'),false);assert.equal(f.writes.length,0);assert.equal(f.dirs.has(job),false);});
test('conditional old scope missing resource duplicate or escaping manifest refuses before build',async()=>{for(const manifestMutate of [m=>m.scope='SESSION_PROVISION_PREREQUISITE_SOURCE_PINS',m=>m.inputs.pop(),m=>m.inputs.push(m.inputs[0]),m=>m.inputs[0].path='../outside',m=>m.diagnostics.push('unlisted.mjs')]){const f=await orchestration({manifestMutate}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(f.calls.some(x=>x[0]==='phase'),false);assert.equal(f.writes.length,0);}});
test('conditional failed child build preserves stdout stderr and partial job with no retry or copy',async()=>{const f=await orchestration({failPhase:'provider-npm'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.partialTreesRetained,true);assert.equal(f.calls.filter(x=>x[0]==='phase'&&x[1]==='provider-npm').length,1);assert.ok(f.files.has(job+'\\fresh-evidence\\locked-provider-packages.stdout.txt'));assert.equal(f.files.get(job+'\\fresh-evidence\\locked-provider-packages.stderr.txt').toString(),'retained failing stderr');assert.equal(f.counts().copies,0);assert.ok(f.files.has(job+'\\fresh-runtime\\electron\\dist\\hidden-extra.dll'));});
test('conditional wrong Electron version refuses before installer or native compilation',async()=>{const f=await orchestration({electronVersion:'44.5.2'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(f.calls.some(x=>x[0]==='phase'&&x[1]==='electron-install'),false);assert.equal(f.counts().copies,0);});
test('conditional collector or retained-copy failures remain adverse and preserve partial roots',async()=>{for(const options of [{inventoryFail:true},{copyFail:true},{recheckFail:true}]){const f=await orchestration(options),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.partialTreesRetained,true);assert.equal(r.nativeAdmission,false);assert.ok(f.dirs.has(job+'\\fresh-runtime'));if(options.copyFail)assert.ok(f.files.has(job+'\\retained\\fresh-runtime\\partial.txt'));assert.equal(await f.api.recheckProvisionedFreshRuntime(r),false);}});
test('conditional each hosted CLI identity mismatch refuses before any IO or build',async()=>{const bad=[p=>p.platform='linux',p=>p.arch='arm64',p=>p.versions.node='24.15.0',p=>p.argv.push('extra'),p=>p.argv[1]='C:\\other.mjs',p=>p.env.GITHUB_ACTIONS='false',p=>p.env.GITHUB_REPOSITORY='other/siren',p=>p.env.GITHUB_REF='refs/heads/main',p=>p.env.GITHUB_RUN_ID='0',p=>p.env.GITHUB_RUN_ATTEMPT='x',p=>p.env.GITHUB_SHA='invalid',p=>p.env.RUNNER_TEMP=root+'\\nested'];for(const mutate of bad){const f=await orchestration();mutate(f.process);const r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'CONTEXT_REFUSED');assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);}});
test('conditional source-copy diagnostic drift must refuse before whole runtime retention',async()=>{const f=await orchestration({diagnosticCopyDrift:true}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(f.counts().copies,0);});
test('conditional failed output write is never retried or replaced',async()=>{const f=await orchestration({writeFail:'locked-provider-packages.stderr.txt'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);const p=job+'\\fresh-evidence\\locked-provider-packages.stdout.txt';assert.equal(f.writes.filter(x=>x===p).length,1);assert.equal(f.counts().copies,0);});
test('conditional pre-existing job is refused without claiming ownership or modifying it',async()=>{const f=await orchestration();f.dirs.add(job);const r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.partialTreesRetained,false);assert.equal(r.jobRoot,undefined);assert.equal(f.writes.length,0);assert.equal(f.calls.some(x=>x[0]==='phase'),false);});


test('tracked hardlink refusal retains exact first path phase condition and plain stat DATA',async()=>{
 const f=await orchestration({pinFault:'nlink'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'SOURCE_REFUSED');
 const d=r.trackedInputFailure;assert.ok(d,'missing actual first-pin diagnostic');assert.equal(d.schema,1);assert.equal(d.phase,'terminal-host-roster-candidate-tracked-input-pin');assert.equal(d.index,1);assert.equal(d.total,4);assert.equal(d.requestedPath.value,f.refusedPath);assert.equal(d.stage,'before-stat');assert.equal(d.condition,'link-count');assert.equal(d.before.nlink,'2');assert.equal(d.after,null);assert.equal(d.canonical,null);
 assert.equal(r.builds.length,1);assert.equal(r.builds[0].trackedInputs.length,1);assert.equal(r.builds[0].binary,undefined);assert.equal(f.counts().copies,0);assert.equal(f.calls.filter(x=>x[0]==='phase').length,7);assert.equal(f.calls.some(x=>x[0]==='readFile'&&x[1]===f.refusedPath),false);
 const retained=JSON.parse(f.files.get(job+'\\fresh-evidence\\build-result.json'));assert.deepEqual(retained.trackedInputFailure,JSON.parse(JSON.stringify(d)));assert.equal(Object.isFrozen(d),true);assert.equal(Object.isFrozen(d.before),true);
});

test('tracked canonical mismatch retains actual comparison without weakening literal gate',async()=>{
 const f=await orchestration({pinFault:'canonical'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');const d=r.trackedInputFailure;assert.ok(d);assert.equal(d.condition,'canonical-mismatch');assert.equal(d.canonical.raw.value,f.refusedPath.toLowerCase());assert.equal(d.canonical.normalized.value,f.refusedPath.toLowerCase());assert.equal(d.canonical.matches,false);assert.equal(f.diagnosticCounts().trackedStats,1);
});

test('tracked changed stat and read-size refusals retain both stages without extra IO',async()=>{
 for(const pinFault of ['changed','read-size']){const f=await orchestration({pinFault}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');const d=r.trackedInputFailure;assert.ok(d);assert.equal(d.condition,pinFault==='changed'?'stat-changed':'read-size-mismatch');assert.equal(d.stage,pinFault==='changed'?'stability':'read-size');assert.equal(d.before.ctimeNs,'3');assert.equal(d.after?.ctimeNs??null,pinFault==='changed'?'99':null);assert.equal(f.diagnosticCounts().trackedStats,pinFault==='changed'?2:1);}
});

test('tracked unknown IO errors keep prior classification and never inspect thrown hooks',async()=>{
 for(const pinFault of ['lstat','read','realpath']){const f=await orchestration({pinFault}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'BUILD_UNAVAILABLE');assert.equal(f.diagnosticCounts().diagnosticHooks,0);assert.ok(r.trackedInputFailure);assert.equal(r.trackedInputFailure.condition,pinFault+'-unavailable');assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(f.counts().copies,0);}
});

test('tracked diagnostics do not invoke stat accessor metadata while preserving link refusal',async()=>{
 const f=await orchestration({pinFault:'accessor'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');assert.equal(f.diagnosticCounts().diagnosticHooks,0);assert.ok(r.trackedInputFailure);assert.equal(r.trackedInputFailure.before.dev,null);assert.equal(r.trackedInputFailure.before.nlink,'2');
});

test('tracked existing regular symlink and size gates remain closed with distinct conditions',async()=>{
 for(const [pinFault,condition] of [['directory','not-regular'],['symlink','symlink'],['negative-size','size-negative'],['size-limit','size-limit']]){const f=await orchestration({pinFault}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');assert.ok(r.trackedInputFailure);assert.equal(r.trackedInputFailure.condition,condition);assert.equal(f.diagnosticCounts().trackedStats,1);assert.equal(r.builds[0].binary,undefined);}
});

test('tracked diagnostic paths are sanitized bounded and preserve exact original digest',async()=>{
 for(const trackedPath of ['C:\\repo\\tracked\\internal\tcontrol.input','C:\\repo\\tracked\\'+('x'.repeat(5000))+'.input']){const f=await orchestration({pinFault:'nlink',trackedPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');assert.ok(r.trackedInputFailure);const p=r.trackedInputFailure.requestedPath;assert.equal(p.sha256,hash(Buffer.from(trackedPath)));assert.ok(p.value===null||p.value.length<=2048);assert.ok(p.value===null||!/[\u0000-\u001f\u007f]/.test(p.value));assert.equal(p.redacted,true);assert.ok(JSON.stringify(r.trackedInputFailure).length<5000);}
});

test('successful conditional build has no failure diagnostic and unchanged phases',async()=>{const f=await orchestration(),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,true);assert.equal(Object.hasOwn(r,'trackedInputFailure'),false);assert.equal(f.calls.filter(x=>x[0]==='phase').length,11);});


test('tracked diagnostics bound unexpected bigint metadata and refuse proxy introspection',async()=>{
 for(const pinFault of ['metadata-limit','metadata-proxy']){const f=await orchestration({pinFault}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');assert.ok(r.trackedInputFailure);assert.equal(r.trackedInputFailure.condition,'link-count');assert.equal(f.diagnosticCounts().diagnosticHooks,0);if(pinFault==='metadata-limit')assert.equal(r.trackedInputFailure.before.dev,null);else assert.equal(r.trackedInputFailure.before,null);assert.ok(JSON.stringify(r.trackedInputFailure).length<5000);}
});

test('tracked diagnostic oversized path does not allocate a whole-path digest or weaken refusal',async()=>{
 const trackedPath='C:\\repo\\tracked\\'+'x'.repeat(32769),f=await orchestration({pinFault:'nlink',trackedPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');const p=r.trackedInputFailure.requestedPath;assert.equal(p.value,null);assert.equal(p.bytes,null);assert.equal(p.sha256,null);assert.equal(p.redacted,true);assert.equal(p.codeUnits,trackedPath.length);assert.equal(r.builds[0].binary,undefined);
});


test('tracked path display sanitizes every bidi control without changing exact UTF8 digest',async()=>{
 const controls='\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069',trackedPath='C:\\repo\\tracked\\'+controls+'display.input';
 const f=await orchestration({pinFault:'nlink',trackedPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.code,'SOURCE_REFUSED');const p=r.trackedInputFailure.requestedPath;assert.equal(p.sha256,hash(Buffer.from(trackedPath)));assert.equal(p.bytes,Buffer.byteLength(trackedPath));assert.equal(p.redacted,true);assert.equal(p.value,trackedPath.replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'\uFFFD'));assert.equal(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(JSON.stringify(r.trackedInputFailure)),false);
});


const externalPath='C:\\Windows\\Globalization\\Sorting\\SortDefault.nls';
test('external postcompile nlink2 snapshot retains identity digest all inputs and grants no authority',async()=>{
 const f=await orchestration({pinFault:'nlink',trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(r.realSessions,0);
 for(const build of r.builds){assert.equal(build.trackedInputs.length,4);const row=build.trackedInputs.find(x=>x.path===externalPath);assert.ok(row);assert.equal(row.role,'external-compiler-read');assert.equal(row.snapshotTiming,'POST_COMPILE');assert.equal(row.bytes,11);assert.equal(row.sha256,hash(Buffer.from('inert input')));assert.deepEqual(JSON.parse(JSON.stringify(row.before)),{dev:'1',ino:'1',mode:'33188',nlink:'2',size:'11',mtimeNs:'2',ctimeNs:'3'});assert.deepEqual(JSON.parse(JSON.stringify(row.after)),JSON.parse(JSON.stringify(row.before)));assert.equal(Object.isFrozen(row.before),true);assert.deepEqual(Array.from(build.trackedInputs,x=>x.path),Array.from(build.trackedInputs,x=>x.path).sort());assert.equal(build.trackedInputs.filter(x=>x.role==='external-compiler-read').length,3);}
 assert.equal(f.calls.filter(x=>x[0]==='open'&&x[1]===externalPath).length,2);assert.equal(f.calls.filter(x=>x[0]==='close'&&x[1]===externalPath).length,2);assert.equal(f.writes.includes(externalPath),false);assert.equal(f.calls.some(x=>x[0]==='copyFile'&&(x[1]===externalPath||x[2]===externalPath)),false);assert.equal(f.calls.some(x=>x[0]==='readFile'&&x[1]===externalPath),false);assert.equal(Object.hasOwn(r,'trackedInputFailure'),false);
});

test('owned repo job and exact known external tool paths keep nlink1 including folded aliases',async()=>{
 const paths=[root+'\\tracked\\strict.input',job+'\\tracked\\strict.input','c:\\REPO\\tracked\\strict.input',job.toLowerCase()+'\\tracked\\strict.input','C:\\node\\node_modules\\npm\\node_modules\\node-gyp\\src\\win_delay_load_hook.cc','C:\\NODE\\node_modules\\NPM\\node_modules\\node-gyp\\src\\WIN_DELAY_LOAD_HOOK.CC'];
 for(const trackedPath of paths){const f=await orchestration({pinFault:'nlink',trackedPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false,trackedPath);assert.equal(r.code,'SOURCE_REFUSED');assert.equal(r.trackedInputFailure.condition,'link-count');assert.equal(f.calls.some(x=>x[0]==='open'&&x[1]===trackedPath),false);assert.equal(r.builds[0].binary,undefined);}
});

test('separator-boundary sibling paths are external rather than owned by prefix',async()=>{
 for(const trackedPath of [root+'-sibling\\read.input',job+'-sibling\\read.input']){const f=await orchestration({pinFault:'nlink',trackedPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.builds[0].trackedInputs.find(x=>x.path===trackedPath).role,'external-compiler-read');}
});

test('external invalid nlink type symlink size and literal canonical gates remain closed',async()=>{
 for(const [pinFault,condition] of [['nlink-zero','link-count'],['nlink-negative','link-count'],['nlink-limit','link-count'],['directory','not-regular'],['symlink','symlink'],['negative-size','size-negative'],['size-limit','size-limit'],['canonical','canonical-mismatch']]){const f=await orchestration({pinFault,trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false,pinFault);assert.equal(r.code,'SOURCE_REFUSED');assert.equal(r.trackedInputFailure.condition,condition);assert.equal(f.calls.some(x=>x[0]==='open'&&x[1]===externalPath),false);assert.equal(r.builds[0].binary,undefined);}
});

test('external handle binding short read trailing bytes and path drift fail with retained diagnostic',async()=>{
 for(const [pinFault,condition] of [['handle-before','handle-before-changed'],['handle-after','handle-after-changed'],['short-read','short-read'],['extra-byte','extra-byte'],['changed','stat-changed']]){const f=await orchestration({pinFault,trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false,pinFault);assert.equal(r.code,'SOURCE_REFUSED');assert.equal(r.trackedInputFailure.condition,condition);assert.equal(r.trackedInputFailure.role,'external-compiler-read');assert.equal(f.calls.filter(x=>x[0]==='close'&&x[1]===externalPath).length,1);assert.equal(r.builds[0].binary,undefined);assert.equal(f.counts().copies,0);}
});

test('external open read close and combined errors remain adverse without error inspection or retry',async()=>{
 for(const [pinFault,condition] of [['open','open-unavailable'],['handle-read','read-unavailable'],['close','close-unavailable'],['read-and-close','read-unavailable']]){const f=await orchestration({pinFault,trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false,pinFault);assert.equal(r.code,'BUILD_UNAVAILABLE');assert.equal(r.trackedInputFailure.condition,condition);assert.equal(f.diagnosticCounts().diagnosticHooks,0);assert.equal(f.calls.filter(x=>x[0]==='open'&&x[1]===externalPath).length,1);assert.equal(f.calls.filter(x=>x[0]==='close'&&x[1]===externalPath).length,pinFault==='open'?0:1);if(pinFault==='read-and-close')assert.equal(r.trackedInputFailure.secondaryCloseFailure,true);assert.equal(f.counts().copies,0);const retained=JSON.parse(f.files.get(job+'\\fresh-evidence\\build-result.json'));assert.equal(retained.trackedInputFailure.condition,condition);}
});


test('external finite partial reads and empty files produce exact digest without a second open',async()=>{
 for(const pinFault of ['partial-read','empty-input']){const f=await orchestration({pinFault,trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,true,JSON.stringify(r));const row=r.builds[0].trackedInputs.find(x=>x.path===externalPath),bytes=Buffer.from(pinFault==='empty-input'?'':'inert input');assert.equal(row.bytes,bytes.length);assert.equal(row.sha256,hash(bytes));assert.equal(f.calls.filter(x=>x[0]==='open'&&x[1]===externalPath).length,2);const reads=f.calls.filter(x=>x[0]==='handle-read'&&x[1]===externalPath);assert.ok(reads.every(x=>x[2]>=1&&x[2]<=65536));assert.equal(reads.length,pinFault==='empty-input'?2:10);}
});

test('external snapshots never bypass required tracked headers or execute on partial build failure',async()=>{
 const f=await orchestration({pinFault:'nlink',trackedPath:externalPath,omitTrackedHeaders:true}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'SOURCE_REFUSED');assert.equal(r.builds.length,1);assert.equal(r.builds[0].trackedInputs.length,2);assert.ok(r.builds[0].trackedInputs.some(x=>x.path===externalPath&&x.role==='external-compiler-read'));assert.equal(r.builds[0].binary,undefined);assert.equal(f.counts().copies,0);assert.equal(r.providerLoaded,false);assert.equal(r.electronExecuted,false);assert.equal(r.realSessions,0);assert.equal(f.calls.filter(x=>x[0]==='close'&&x[1]===externalPath).length,1);
});

test('external unknown initial stat and canonical IO failures remain distinct adverse observations',async()=>{
 for(const pinFault of ['lstat','realpath']){const f=await orchestration({pinFault,trackedPath:externalPath}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'BUILD_UNAVAILABLE');assert.equal(r.trackedInputFailure.condition,pinFault+'-unavailable');assert.equal(r.trackedInputFailure.role,'external-compiler-read');assert.equal(f.diagnosticCounts().diagnosticHooks,0);assert.equal(f.calls.some(x=>x[0]==='open'&&x[1]===externalPath),false);}
});


// SOURCE-ONLY compiler-selection regression: all tool/process/FS values here
// are finite in-memory VM fixtures. The legacy compiler is deliberately present
// to prove it is never selected as fallback. No compiler is executed by tests.
test('VS compiler selection uses the already-discovered installation for both unchanged C# helper phases',async()=>{
 const f=await orchestration(),r=await f.api.provisionFreshTerminalRuntime(),selected='C:\\VS\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe';
 assert.equal(r.ok,true,JSON.stringify(r));assert.ok(r.tools.some(row=>row.path===selected));
 const helpers=f.calls.filter(row=>row[0]==='phase'&&row[1]==='helper');assert.equal(helpers.length,2);assert.ok(helpers.every(row=>row[2]===selected));
 for(const row of helpers){assert.deepEqual(row[3].slice(0,4),['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll']);assert.equal(row[4].timeout,30000);assert.equal(row[4].windowsHide,true);}
 assert.equal(r.helperExecutions,0);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(r.providerLoaded,false);assert.equal(r.electronExecuted,false);
 assert.equal(f.calls.some(row=>row[0]==='lstat'&&row[1]==='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'),false);
});

test('VS compiler selection follows a different discovered installation without a fixed host edition or PATH lookup',async()=>{
 const vsInstallation='D:\\VS Custom\\Enterprise',selected=win.join(vsInstallation,'MSBuild/Current/Bin/Roslyn/csc.exe'),f=await orchestration({vsInstallation}),r=await f.api.provisionFreshTerminalRuntime();
 assert.equal(r.ok,true,JSON.stringify(r));assert.ok(r.tools.some(row=>row.path===selected));assert.ok(f.calls.filter(row=>row[0]==='phase'&&row[1]==='helper').every(row=>row[2]===selected));
 assert.equal(f.calls.some(row=>row[0]==='phase'&&row[2]==='csc.exe'),false);assert.equal(f.counts().copies,1);
});

test('VS compiler multi-link identity is refused before helper process or external-read promotion',async()=>{
 for(const vsCompilerNlink of [2,3]){const f=await orchestration({vsCompilerNlink}),r=await f.api.provisionFreshTerminalRuntime(),selected='C:\\VS\\MSBuild\\Current\\Bin\\Roslyn\\csc.exe';
  assert.equal(r.ok,false);assert.equal(r.code,'SOURCE_REFUSED');assert.equal(r.partialTreesRetained,true);assert.equal(f.calls.some(row=>row[0]==='phase'&&row[1]==='helper'),false);
  assert.equal(f.calls.some(row=>row[0]==='open'&&row[1]===selected),false);assert.equal(f.calls.some(row=>row[0]==='readFile'&&row[1]===selected),false);assert.equal(f.counts().copies,0);assert.equal(r.helperExecutions,0);assert.equal(r.nativeAdmission,false);
  const retained=JSON.parse(f.files.get(job+'\\fresh-evidence\\build-result.json'));assert.equal(retained.code,'SOURCE_REFUSED');
  const calls=f.calls.length;assert.equal((await f.api.provisionFreshTerminalRuntime()).code,'ATTEMPT_CONSUMED');assert.equal(f.calls.length,calls);
 }
});

test('missing VS compiler refuses and never falls back to an available Framework compiler',async()=>{
 const f=await orchestration({vsCompilerMissing:true}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'BUILD_UNAVAILABLE');
 assert.ok(f.files.has('C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'));assert.equal(f.calls.some(row=>row[0]==='phase'&&row[1]==='helper'),false);
 assert.equal(f.calls.some(row=>row[0]==='lstat'&&row[1]==='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe'),false);assert.equal(f.counts().copies,0);assert.equal(r.partialTreesRetained,true);
});

test('selected VS compiler identity drift after one helper remains adverse without retry or retention promotion',async()=>{
 const f=await orchestration({vsCompilerAfterRunNlink:2}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'SOURCE_REFUSED');
 assert.equal(f.calls.filter(row=>row[0]==='phase'&&row[1]==='helper').length,1);assert.equal(f.counts().copies,0);assert.equal(r.partialTreesRetained,true);
 assert.ok(f.files.has(job+'\\fresh-evidence\\filesystem-evidence-compile.stdout.txt'));assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);
});

test('selected VS compiler phase failure preserves original outputs without another compiler attempt',async()=>{
 const f=await orchestration({failPhase:'helper'}),r=await f.api.provisionFreshTerminalRuntime();assert.equal(r.ok,false);assert.equal(r.code,'BUILD_PHASE_FAILED');
 assert.equal(f.calls.filter(row=>row[0]==='phase'&&row[1]==='helper').length,1);assert.equal(f.files.get(job+'\\fresh-evidence\\filesystem-evidence-compile.stderr.txt').toString(),'retained failing stderr');
 assert.equal(f.counts().copies,0);assert.equal(r.helperExecutions,0);assert.equal(r.providerLoaded,false);assert.equal(r.realSessions,0);assert.equal(r.nativeAdmission,false);
});
