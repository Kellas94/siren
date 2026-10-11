// Inactive hosted prerequisite: default build-only, fixed diagnostic opt-in. Import never provisions or launches.
import {readFile,writeFile,mkdir,copyFile,cp,rename,readdir,lstat} from 'node:fs/promises';
import {constants,realpathSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify,types} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {captureFreshRuntimeInventory,recheckFreshRuntimeInventory} from './terminal-fresh-runtime-inventory.mjs';
import {captureFreshRuntimeRetention,recheckFreshRuntimeRetention} from './terminal-fresh-runtime-retention.mjs';
import {generateTerminalConnectDerivative} from './terminal-connect-derivative.mjs';
import {generateTerminalCreatorTransportDerivative} from './terminal-creator-transport-derivative.mjs';

const SCOPE='FRESH_RUNTIME_BUILD_SOURCE_PINS',PREP='terminal-fresh-provisioner-preparation-20261011';
const REQUIRED=['desktop/tests/native/terminal-fresh-runtime-provision.mjs','desktop/tests/native/terminal_historical_source_stage.py','desktop/tests/native/terminal-fresh-runtime-inventory.mjs','desktop/tests/native/terminal-fresh-runtime-retention.mjs','desktop/tests/native/terminal-connect-derivative.mjs','desktop/tests/native/terminal-creator-transport-derivative.mjs','desktop/tests/native/terminal-connect-raw-json.mjs','desktop/tests/native/terminal-connect-raw-file.mjs','desktop/tests/native/terminal-fresh-environment.mjs','desktop/tests/native/terminal-fresh-pair-model.mjs',PREP+'/pins.json',PREP+'/historical-source-mapping.json',PREP+'/historical-execution-mapping.json',PREP+'/resource-manifest-design.json','terminal-resolution-observation-20261011/hosted-v1.zip'];
const PAIR_DIAGNOSTICS=['terminal-fresh-runtime-provision','terminal-fresh-runtime-inventory','terminal-fresh-runtime-retention','terminal-connect-derivative','terminal-creator-transport-derivative','terminal-connect-raw-json','terminal-connect-raw-file','terminal-fresh-environment','terminal-fresh-pair-model','terminal-connect-comparison','terminal-fresh-pair-driver','terminal-fresh-pair-worker','terminal-resolution-observation','terminal-discovery-fixture','terminal-cmdlet-fixture','terminal-session-command'].map(n=>'desktop/tests/native/'+n+'.mjs');
const FIXED=new Map([[PREP+'/pins.json',[31970,'0544d8e3597fe4eb227191183f070b38af002a6898425b5f42dba506f794b9a4']],[PREP+'/historical-source-mapping.json',[37600,'ad06aa0da323453bd6052a5248e17a1e3fae9f106c7fc31d1dbe73809590f712']],[PREP+'/resource-manifest-design.json',[32849,'c54ff90c442979d13c7ed150da38b8b6f4d4c7af5a1449e54ef7f176bfd9fac8']],['terminal-resolution-observation-20261011/hosted-v1.zip',[17469677,'0bde86db6923889ed7256096b516554234aa09140a7e6a346d5c3f528d60f7a2']]]);
const TARGETS=[['terminal-host-roster-candidate','siren_terminal_host_roster_candidate'],['terminal-creator-three-lane','siren_terminal_creator_three_lane']];
const own=new WeakMap(),failures=new WeakMap();let attempted=false,entryMode=null;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{const e=Object.freeze(Object.create(null));failures.set(e,code);throw e;};
function errorValue(e,key){if(!e||!['object','function'].includes(typeof e)||types.isProxy(e))return undefined;const d=Object.getOwnPropertyDescriptor(e,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;}
const check=(value,code='SOURCE_REFUSED')=>{if(!value)fail(code);};
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
const flags={nativeAdmission:false,inputAuthorized:false,sessionAdmission:false,armProgressionAuthorized:false,oldRuntimeEquivalent:false,productActivation:false};
function canonical(s){check(typeof s==='string'&&s.length<=32768&&s.isWellFormed()&&!/[\0]/.test(s)&&/^[A-Z]:\\/.test(s)&&path.resolve(s)===s&&s!==path.parse(s).root,'CONTEXT_REFUSED');return s;}
function relative(s){return typeof s==='string'&&s.length<=1024&&/^[A-Za-z0-9_.\/-]+$/.test(s)&&!s.startsWith('/')&&s.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.endsWith('.')&&!/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p));}
function context(extra){
 check(!extra.length&&process.platform==='win32'&&process.arch==='x64'&&process.versions.node==='24.16.0','CONTEXT_REFUSED');
 const env=process.env,entry=fileURLToPath(import.meta.url),root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
 const argv=process.argv,mode=argv.length===2?'build':argv.length===3&&argv[2]==='--fixed-pathext-pair'?'fixed-pathext-pair':null;
 check(mode!==null&&argv[1]===entry&&env.GITHUB_ACTIONS==='true'&&env.GITHUB_REPOSITORY==='Kellas94/siren'&&env.GITHUB_REF==='refs/heads/probe/terminal-session-20261010'&&/^[1-9]\d*$/.test(env.GITHUB_RUN_ID??'')&&/^[1-9]\d*$/.test(env.GITHUB_RUN_ATTEMPT??'')&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??''),'CONTEXT_REFUSED');
 const temp=canonical(env.RUNNER_TEMP);canonical(root);check(!temp.toUpperCase().startsWith(root.toUpperCase()+path.sep)&&!root.toUpperCase().startsWith(temp.toUpperCase()+path.sep)&&temp.toUpperCase()!==root.toUpperCase(),'CONTEXT_REFUSED');
 return {root,temp,run:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,commit:env.GITHUB_SHA,mode};
}
async function regular(p){const s=await lstat(p,{bigint:true});check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1n&&s.size>=0n&&s.size<=536870912n&&path.normalize(realpathSync(p))===p);return s;}
const stable=(a,b)=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].every(k=>a[k]===b[k]);
async function pin(p){const before=await regular(p),bytes=await readFile(p);check(BigInt(bytes.length)===before.size&&stable(before,await regular(p)));return {path:p,bytes:bytes.length,sha256:sha(bytes)};}
async function directory(p){const s=await lstat(p,{bigint:true});check(s.isDirectory()&&!s.isSymbolicLink()&&path.normalize(realpathSync(p))===p,'PATH_REFUSED');return s;}
async function absent(p){try{await lstat(p,{bigint:true});}catch(e){if(errorValue(e,'code')==='ENOENT')return;fail('PATH_REFUSED');}fail('TARGET_EXISTS');}
async function copyPinned(source,target,expected){const before=await pin(source);check(expected&&before.bytes===expected.bytes&&before.sha256===expected.sha256);await copyFile(source,target,constants.COPYFILE_EXCL);const after=await pin(target);check(after.bytes===expected.bytes&&after.sha256===expected.sha256);check((await pin(source)).sha256===before.sha256);}
async function exclusive(p,bytes){await writeFile(p,bytes,{flag:'wx'});return pin(p);}
async function manifest(root,mode){
 const p=path.join(root,'desktop/tests/native/terminal-fresh-runtime-provision-inputs.json'),before=await pin(p);check(before.bytes<=1048576);
 const text=await readFile(p,'utf8'),m=JSON.parse(text);check(JSON.stringify(m)+'\n'===text&&Object.keys(m).join(',')==='schema,scope,nativeAdmission,inputs,diagnostics'&&m.schema===1&&m.scope===SCOPE&&m.nativeAdmission===false&&Array.isArray(m.inputs)&&m.inputs.length<=2048&&Array.isArray(m.diagnostics)&&m.diagnostics.length<=512);
 const map=new Map();for(const row of m.inputs){check(Object.keys(row).join(',')==='path,bytes,sha256'&&relative(row.path)&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=536870912&&/^[a-f0-9]{64}$/.test(row.sha256)&&![...map.keys()].some(k=>k.toUpperCase()===row.path.toUpperCase()));const actual=await pin(path.join(root,...row.path.split('/')));check(actual.bytes===row.bytes&&actual.sha256===row.sha256);map.set(row.path,row);}
 check(REQUIRED.every(p=>map.has(p)));for(const [name,[bytes,hash]] of FIXED)check(map.get(name)?.bytes===bytes&&map.get(name)?.sha256===hash);
 const seen=new Set();for(const p of m.diagnostics){check(relative(p)&&map.has(p)&&!seen.has(p.toUpperCase()));seen.add(p.toUpperCase());}
 check(REQUIRED.filter(p=>p.startsWith('desktop/tests/native/')&&p.endsWith('.mjs')).every(p=>m.diagnostics.includes(p)));
 if(mode==='fixed-pathext-pair')check(PAIR_DIAGNOSTICS.every(p=>map.has(p)&&m.diagnostics.includes(p)));
 check((await pin(before.path)).sha256===before.sha256);return {record:before,data:m,map};
}
function buildEnvironment(){
 const env=Object.create(null);for(const key of ['PATH','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','ProgramFiles','ProgramFiles(x86)','ProgramData','ComSpec','HOMEDRIVE','HOMEPATH','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','CI']){const v=process.env[key];if(typeof v==='string'&&v){check(v.length<=32768&&v.isWellFormed()&&!v.includes('\0'),'CONTEXT_REFUSED');env[key]=v;}}
 check(env.PATH&&env.SystemRoot&&env.TEMP&&env.TMP,'CONTEXT_REFUSED');return env;
}
export async function provisionFreshTerminalRuntime(...extra){
 if(attempted)return freeze({ok:false,code:'ATTEMPT_CONSUMED',...flags});attempted=true;
 let receipt={ok:false,scope:'HOSTED_ONCE_ONLY_FRESH_RUNTIME_BUILD_NOT_SESSION_ADMISSION',status:'STARTED',phases:[],tools:[],builds:[],inputs:[],helperExecutions:0,providerLoaded:false,electronExecuted:false,realSessions:0,...flags},job=null,jobCreated=false,save=null;
 try{
  const c=context(extra);entryMode=c.mode;
  const checked=await manifest(c.root,c.mode),env=buildEnvironment(),run=promisify(execFile);await directory(c.temp);
  const supportMapping=JSON.parse(await readFile(path.join(c.root,PREP,'historical-source-mapping.json'),'utf8'));
  for(const name of ['desktop/package.json','desktop/package-lock.json','desktop/tests/fixtures/terminal-filesystem-evidence.cs','desktop/tests/fixtures/terminal-session-process-observer.cs']){const row=supportMapping.inputs.find(r=>r.path===name),p=row&&PREP+'/'+row.snapshot;check(row&&relative(row.snapshot)&&checked.map.get(p)?.bytes===row.bytes&&checked.map.get(p)?.sha256===row.sha256);}
  job=path.join(c.temp,'siren-fresh-runtime-'+randomUUID());await absent(job);await mkdir(job);jobCreated=true;await directory(job);receipt={...receipt,...c,jobRoot:job,inputs:checked.data.inputs,manifest:checked.record};
  const live=path.join(job,'fresh-runtime'),out=path.join(job,'fresh-evidence'),work=path.join(job,'build-work'),retainedParent=path.join(job,'retained');
  for(const p of [live,out,work,retainedParent])await mkdir(p);for(const p of [path.join(out,'connect'),path.join(retainedParent,'fresh-evidence'),path.join(retainedParent,'fresh-evidence','connect'),path.join(job,'project-Șiren-Δ')])await mkdir(p);
  save=(name,value)=>exclusive(path.join(out,name),JSON.stringify(value,null,2)+'\n');
  async function phase(name,executable,args,cwd,timeout=120000){
   const tool=await pin(executable),row={name,executable,args,cwd,tool,timeoutMs:timeout};receipt.phases.push(row);await save(name+'-before.json',row);
   let stdout='',stderr='',adverse=false;
   try{try{const result=await run(executable,args,{cwd,env,windowsHide:true,timeout,maxBuffer:16*1024*1024,encoding:'utf8'});row.exit=0;stdout=result.stdout;stderr=result.stderr;}
    catch(e){adverse=true;const code=errorValue(e,'code'),signal=errorValue(e,'signal'),out=errorValue(e,'stdout'),err=errorValue(e,'stderr');row.exit=typeof code==='number'?code:null;row.killed=errorValue(e,'killed')===true;row.signal=typeof signal==='string'?signal:null;stdout=typeof out==='string'?out:'';stderr=typeof err==='string'?err:'';}
    await exclusive(path.join(out,name+'.stdout.txt'),stdout);await exclusive(path.join(out,name+'.stderr.txt'),stderr);if(adverse)fail('BUILD_PHASE_FAILED');return stdout;}
   finally{await save(name+'-after.json',row);check((await pin(executable)).sha256===tool.sha256,'TOOL_CHANGED');}
  }
  const execution=path.join(live,'execution'),python=path.join(canonical(process.env.pythonLocation),'python.exe'),stager=path.join(c.root,'desktop/tests/native/terminal_historical_source_stage.py');
  const bridge="import json,runpy,sys; m=runpy.run_path(sys.argv[1],run_name='siren_fixed_historical_stage'); r=m['stage_historical_sources'](sys.argv[2]); sys.stdout.write(json.dumps(r,separators=(',',':')))";
  const stage=JSON.parse(await phase('historical-source-stage',python,['-I','-c',bridge,stager,execution],c.root));check(stage.schema==='siren-terminal-historical-source-stage/v1'&&stage.sourceEntries===55&&stage.sourceBytes===840444&&stage.nativeAdmission===false&&stage.executionAuthorized===false&&Array.isArray(stage.files)&&stage.files.length===55);await save('historical-source-stage.json',stage);
  const resource=JSON.parse(await readFile(path.join(c.root,PREP,'resource-manifest-design.json'),'utf8')),mapping=JSON.parse(await readFile(path.join(c.root,PREP,'historical-source-mapping.json'),'utf8'));
  check(resource.sourceGraph.length===55);for(const row of resource.sourceGraph){check(relative(row.path));const a=await pin(path.join(execution,...row.path.split('/')));check(a.bytes===row.bytes&&a.sha256===row.sha256);}
  async function historical(name){const row=mapping.inputs.find(r=>r.path===name);check(row&&relative(row.snapshot));const source=PREP+'/'+row.snapshot;check(checked.map.has(source));const p=path.join(c.root,...source.split('/')),actual=await pin(p);check(actual.bytes===row.bytes&&actual.sha256===row.sha256);return p;}
  const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),gyp=path.join(path.dirname(process.execPath),'node_modules/npm/node_modules/node-gyp');check(JSON.parse(await readFile(path.join(gyp,'package.json'),'utf8')).version==='12.3.0');
  const deps=path.join(work,'electron-deps');await mkdir(deps);for(const n of ['package.json','package-lock.json']){const src=await historical('desktop/'+n);await copyPinned(src,path.join(deps,n),checked.map.get(path.relative(c.root,src).replaceAll('\\','/')));}
  await phase('locked-electron-packages',process.execPath,[npm,'--prefix',deps,'ci','--ignore-scripts','--no-audit','--no-fund'],c.root);
  const electron=path.join(deps,'node_modules/electron');check(JSON.parse(await readFile(path.join(electron,'package.json'),'utf8')).version==='44.5.1');await phase('electron-distribution',process.execPath,[path.join(electron,'install.js')],c.root);
  await mkdir(path.join(live,'electron'));await cp(path.join(electron,'dist'),path.join(live,'electron','dist'),{recursive:true,errorOnExist:true,force:false});for(const n of ['electron.exe','LICENSE','LICENSES.chromium.html'])await pin(path.join(live,'electron','dist',n));
  const provider=path.join(execution,'desktop/runtime/terminal-provider');await phase('locked-provider-packages',process.execPath,[npm,'--prefix',provider,'ci','--ignore-scripts','--no-audit','--no-fund'],c.root);check(JSON.parse(await readFile(path.join(provider,'node_modules/node-pty/package.json'),'utf8')).version==='1.1.0');
  const locator=path.join(canonical(process.env['ProgramFiles(x86)']),'Microsoft Visual Studio/Installer/vswhere.exe'),vs=canonical((await phase('compiler-discovery',locator,['-products','*','-latest','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath'],c.root)).trim());
  const versions=(await readdir(path.join(vs,'VC/Tools/MSVC'))).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));check(versions.length>0);
  const msbuild=path.join(vs,'MSBuild/Current/Bin/amd64/MSBuild.exe'),hook=path.join(gyp,'src/win_delay_load_hook.cc');for(const p of [process.execPath,npm,path.join(gyp,'bin/node-gyp.js'),path.join(gyp,'package.json'),locator,msbuild,hook])receipt.tools.push(await pin(p));
  for(const [folder,target] of TARGETS){
   const candidate=path.join(work,folder);await mkdir(candidate);const build={folder,target,source:[],trackedInputs:[]};receipt.builds.push(build);
   for(const name of ['ownership.cc','peer-endpoints.inc','binding.gyp']){const relative='desktop/native/'+folder+'/'+name,original=path.join(execution,...relative.split('/'));build.source.push(await pin(original));await copyPinned(original,path.join(candidate,name),resource.sourceGraph.find(r=>r.path===relative));}
   await phase(folder+'-configure',process.execPath,[path.join(gyp,'bin/node-gyp.js'),'configure','--target=44.5.1','--arch=x64','--dist-url=https://electronjs.org/headers','--devdir='+path.join(work,'headers'),'--msvs_version=2026','--verbose'],candidate);
   await phase(folder+'-compile',msbuild,['build/'+target+'.vcxproj','/p:SolutionDir='+path.join(candidate,'build')+'/', '/p:Configuration=Release','/p:Platform=x64','/p:VCToolsVersion='+versions[0],'/p:WindowsTargetPlatformVersion=10.0.26100.0','/p:TrackFileAccess=true','/verbosity:diagnostic'],candidate);
   const project=await readFile(path.join(candidate,'build',target+'.vcxproj'),'utf8');check(project.includes('win_delay_load_hook.cc')&&/<DelayLoadDLLs>node.exe(?:;|<)/i.test(project));
   const tracked=new Set();let count=0;async function walk(dir,depth=0){check(depth<=64);for(const entry of await readdir(dir,{withFileTypes:true})){check(++count<=8192);const p=path.join(dir,entry.name);check(!entry.isSymbolicLink());if(entry.isDirectory())await walk(p,depth+1);else if(/\.read\.\d+\.tlog$/i.test(entry.name)){for(const line of (await readFile(p)).toString('utf16le').replace(/^\uFEFF/,'').split(/\r?\n/))for(const name of line.trim().replace(/^\^/,'').split('|'))if(/^[A-Za-z]:[\\/]/.test(name))tracked.add(path.normalize(name));}}}await walk(path.join(candidate,'build'));
   check(tracked.size<=8192);for(const p of [...tracked].sort())build.trackedInputs.push(await pin(p));for(const re of [/[/\\]win_delay_load_hook\.cc$/i,/[/\\]node_api\.h$/i,/[/\\]windows\.h$/i])check(build.trackedInputs.some(r=>re.test(r.path)));
   const binary=path.join(candidate,'build/Release',target+'.node'),bytes=await readFile(binary);check(bytes.length>=64&&bytes.readUInt16LE(0)===0x5a4d);const pe=bytes.readUInt32LE(0x3c);check(pe+6<=bytes.length&&bytes.readUInt32LE(pe)===0x4550&&bytes.readUInt16LE(pe+4)===0x8664);build.binary=await pin(binary);
   const dest=path.join(execution,'desktop/native',folder,'build');await mkdir(dest);await mkdir(path.join(dest,'Release'));await copyPinned(binary,path.join(dest,'Release',target+'.node'),build.binary);
  }
  const helpers=path.join(live,'helpers');await mkdir(helpers);const compiler='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';receipt.tools.push(await pin(compiler));
  for(const [name,file] of [['filesystem-evidence','terminal-filesystem-evidence.cs'],['process-observer','terminal-session-process-observer.cs']]){const src=await historical('desktop/tests/fixtures/'+file);await copyPinned(src,path.join(helpers,file),checked.map.get(path.relative(c.root,src).replaceAll('\\','/')));await phase(name+'-compile',compiler,['/nologo','/target:exe','/platform:x64','/r:System.Web.Extensions.dll','/out:'+path.join(helpers,name+'.exe'),path.join(helpers,file)],work,30000);await pin(path.join(helpers,name+'.exe'));}
  const diagnostics=path.join(live,'diagnostics');await mkdir(diagnostics);for(const p of checked.data.diagnostics){const target=path.join(diagnostics,...p.split('/'));await mkdir(path.dirname(target),{recursive:true});await copyPinned(path.join(c.root,...p.split('/')),target,checked.map.get(p));}
  const agent=path.join(provider,'node_modules/node-pty/lib/windowsPtyAgent.js'),agentOriginal=await readFile(agent,'utf8'),derivedAgent=generateTerminalConnectDerivative(agentOriginal);check(derivedAgent.ok);await absent(agent+'.original.txt');await rename(agent,agent+'.original.txt');await exclusive(agent,derivedAgent.derivative);await save('agent-byte-map.json',derivedAgent.map);await exclusive(path.join(diagnostics,'windowsPtyAgent.original.txt'),agentOriginal);await exclusive(path.join(diagnostics,'windowsPtyAgent.map.json'),JSON.stringify(derivedAgent.map)+'\n');
  const originalEntry=path.join(execution,'desktop/src/terminal/production-creator-entry.mjs'),creator=generateTerminalCreatorTransportDerivative(await readFile(originalEntry,'utf8'));check(creator.ok);await exclusive(path.join(path.dirname(originalEntry),'diagnostic-creator-entry.mjs'),creator.derivative);await exclusive(path.join(path.dirname(originalEntry),'diagnostic-creator-launcher.mjs'),"import {runProductionCreatorEntry} from './diagnostic-creator-entry.mjs';\nawait runProductionCreatorEntry();\n");await exclusive(path.join(diagnostics,'creator-byte-map.json'),JSON.stringify(creator.map)+'\n');await save('creator-byte-map.json',creator.map);
  for(const row of resource.sourceGraph){const a=await pin(path.join(execution,...row.path.split('/')));check(a.bytes===row.bytes&&a.sha256===row.sha256);}
  for(const row of checked.data.inputs){const a=await pin(path.join(c.root,...row.path.split('/')));check(a.bytes===row.bytes&&a.sha256===row.sha256);}for(const row of receipt.tools)check((await pin(row.path)).sha256===row.sha256);check((await pin(checked.record.path)).sha256===checked.record.sha256);
  const inventory=await captureFreshRuntimeInventory(live);await save('whole-live-runtime-inventory.json',inventory);
  const retained=path.join(retainedParent,'fresh-runtime'),retention=await captureFreshRuntimeRetention({sourceDirectory:live,retainedDirectory:retained});await recheckFreshRuntimeInventory(inventory);await recheckFreshRuntimeRetention(retention);await save('whole-runtime-retention.json',retention);
  receipt={...receipt,ok:true,status:'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION',liveRuntime:live,retainedRuntime:retained,projectDirectory:path.join(job,'project-Șiren-Δ'),inventory,retention};own.set(receipt,{retention});
 }catch(error){receipt={...receipt,ok:false,status:'FAILED_NOT_SESSION_ADMISSION',code:failures.get(error)??'BUILD_UNAVAILABLE',partialTreesRetained:jobCreated,...(jobCreated?{jobRoot:job}:{})};}
 if(save){try{await save('build-result.json',receipt);}catch{receipt={...receipt,ok:false,status:'FAILED_NOT_SESSION_ADMISSION',code:'RESULT_RETENTION_FAILED'};}}
 return freeze(receipt);
}
export async function recheckProvisionedFreshRuntime(receipt,...extra){const captured=!extra.length&&own.get(receipt);if(!captured)return false;try{return await recheckFreshRuntimeRetention(captured.retention)===true;}catch{return false;}}
if(import.meta.main===true){
 const receipt=await provisionFreshTerminalRuntime();console.log(JSON.stringify({ok:receipt.ok,status:receipt.status,jobRoot:receipt.jobRoot??null,...flags}));
 if(!receipt.ok)process.exitCode=1;
 else if(entryMode==='fixed-pathext-pair'){
  try{
   const {runFreshTerminalPair}=await import('./terminal-fresh-pair-driver.mjs'),pair=await runFreshTerminalPair(receipt);
   console.log(JSON.stringify({ok:pair.ok,status:pair.status,...flags}));
   if(pair.ok!==true||pair.status!=='FRESH_PAIR_OBSERVED_NOT_ADMITTED'||pair.hasAdverseArm===true)process.exitCode=1;
  }catch{console.log(JSON.stringify({ok:false,status:'FRESH_PAIR_CONTINUATION_UNAVAILABLE',...flags}));process.exitCode=1;}
 }
}
