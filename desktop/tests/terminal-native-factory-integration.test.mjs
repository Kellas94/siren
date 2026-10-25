// Actual emitted entry/bootstrap/MAIN call/registered launch. Source controls,
// never a full MAIN/Electron boot. Native boundaries remain explicitly inert.
import test,{after} from 'node:test';
import * as vm from 'node:vm';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {appendFileSync} from 'node:fs';
const desktop=path.resolve(process.argv[3]??fileURLToPath(new URL('../',import.meta.url)));
const report=process.argv[2],output=report?path.dirname(report):path.resolve(desktop,'../factory-integration-test-evidence');
const digest=b=>createHash('sha256').update(b).digest('hex'),rows=[];
after(async()=>{if(report)await fs.writeFile(report,JSON.stringify({kind:'TERMINAL_NATIVE_FACTORY_ACTUAL_ROUTE_V1',author:'/root/main_native_carrier_implementation',completed:true,cases:rows,evidenceClass:'controlled-source-only',fullMainBoot:false,actualElectronOrNativeExecution:false},null,2)+'\n',{flag:'wx'});});

// Explicit addon/utility/filesystem boundary model. It implements no owner,
// graph, factory or resource authority; all of those are the actual R modules.
function nativeWorldFactory(runtime){
 const record=globalThis.__factoryRecord,win=globalThis.__factoryWinPath;
 const caps=new WeakMap(),cache=Object.create(null);let nextPid=101;
 const trace=(name,details={})=>{record.nativeBoundaryTrace??=[];record.nativeBoundaryTrace.push({name,...details});record.onBoundaryEvent?.(name);globalThis.__factoryTraceEvent?.({name,...details});};
 const identity=pid=>({pid,image:win.join(runtime,'electron','electron.exe'),createdFileTime:'1001'});
 const member=(value,alive=true)=>({...value,alive,exitCode:alive?259:77});
 const snapshot=(state,final=false)=>({active:final?0:1,root:member(state.root,!final),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:final});
 const stateFor=host=>{const state=caps.get(host);if(!state)throw Error('CONTROLLED_NATIVE_HOST_REQUIRED');return state;};
 const host={
  start(pid,image,since){if(image!==win.join(runtime,'electron','electron.exe')||since!==1n)throw Error('CONTROLLED_NATIVE_IDENTITY');const cap={};caps.set(cap,{root:identity(pid),request:null});trace('host-start',{pid});return cap;},
  snapshot(cap){trace('host-snapshot');return snapshot(stateFor(cap));},
  stopAndCloseHostAsync(cap,code,deadlineMs,shutdownId){const state=stateFor(cap);if(state.pending){if(state.request.code!==code||state.request.deadlineMs!==deadlineMs||state.request.shutdownId!==shutdownId)throw Error('CONTROLLED_SHUTDOWN_CONFLICT');return state.pending;}state.request=Object.freeze({code,deadlineMs,shutdownId});trace('host-stop',{shutdownId});state.pending=Promise.resolve({version:1,...state.request,snapshot:snapshot(state,true),closed:record.factoryControl.unknownHostCleanup!==true,scope:'HOST_AND_EXACT_PEER_ROSTER_ONLY',sessionCleanupJoined:false,peers:[]});return state.pending;},
  captureHostShutdownPeerRoster(cap,shutdownId){stateFor(cap);trace('host-roster');return Object.freeze({version:1,shutdownId,scope:'HOST_ASYNC_CAPTURED_PEER_ROSTER',pairOrdinals:Object.freeze([])});},
  captureHostShutdownExpectation(cap){const state=stateFor(cap);trace('host-expectation');return Object.freeze({request:state.request,root:Object.freeze({...state.root}),held:Object.freeze([]),pairOrdinals:Object.freeze([])});},
  mark(){return 1n;}
 };
 for(const name of ['createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync'])host[name]=()=>{trace('unexpected-session-method',{name});throw Error('CONTROLLED_SESSION_NOT_ENTERED');};
 const guarded=value=>Object.defineProperty(value,'then',{value:undefined});
 const ancestry=path=>{const root=win.parse(path).root,parts=path.slice(root.length).split('\\').filter(Boolean);return [root,...parts.map((_,index)=>win.join(root,...parts.slice(0,index+1)))].map(path=>({path,identity:globalThis.__factoryIdentity(path),directory:true,reparse:false}));};
 const inspect=(path,kind)=>guarded({canonicalPath:path,identity:globalThis.__factoryIdentity(path),[kind]:true,reparse:false,ancestors:ancestry(kind==='file'?win.dirname(path):path)});
 const filesystem={createFilesystemInspector(){trace('filesystem-inspector');return {...(record.factoryControl.holdProvider?{extra:true}:{}),
  getSystemDirectory:()=>{trace('filesystem-system');return Promise.resolve('C:\\Windows\\System32');},
  inspectDirectory:path=>{trace('filesystem-directory');return Promise.resolve(inspect(path,'directory'));},
  inspectFile:path=>{trace('filesystem-file');return Promise.resolve(inspect(path,'file'));},
  retire:()=>{trace('filesystem-retire');if(record.factoryControl.holdProvider)return new Promise(resolve=>{record.releaseProvider=()=>resolve(guarded({retired:true,actualSettled:true,pending:0}));});return Promise.resolve(guarded({retired:true,actualSettled:true,pending:0}));}
 };}};
 function utilityFork(entry,args,options){
  if(entry!==win.join(runtime,'desktop','src','terminal','desktop-native-runtime-host.mjs')||args.length||options.cwd!==runtime)throw Error('CONTROLLED_UTILITY_PATH');
  record.counters.utility++;record.counters.fork++;trace('utility-fork');const child=new globalThis.__factoryEmitter();child.pid=nextPid++;
  child.postMessage=value=>{if(value.kind==='retire'){trace('utility-retire');const hook=record.factoryControl.onUtilityRetire;record.factoryControl.onUtilityRetire=null;hook?.();if(!record.factoryControl.holdExit)queueMicrotask(()=>child.emit('exit',0));}};
  child.kill=()=>{trace('utility-kill');if(!record.factoryControl.holdExit)queueMicrotask(()=>child.emit('exit',0));return true;};
  record.releaseExit=()=>{trace('controlled-exit-release');child.emit('exit',0);};record.releaseUtility=()=>{trace('controlled-utility-release');child.emit('spawn');child.emit('message',{schema:'siren-desktop-utility-host/v1',pid:child.pid,electron:'44.9.3',modules:'149',napi:'10'});};if(!record.factoryControl.holdUtility)queueMicrotask(record.releaseUtility);return child;
 }
 return {host,filesystem,utilityFork,cache};
}
function fixedNativeRequire(context,record,f){
 if(!context.__factoryWorld){Object.assign(context,{__factoryRecord:record,__factoryRoot:f.runtime,__factoryWinPath:path.win32,__factoryEmitter:EventEmitter,__factoryIdentity:value=>'0000000000000001:'+hash(Buffer.from(value.toLowerCase())).slice(0,32),__factoryTraceEvent:value=>appendFileSync(path.join(f.root,'NATIVE-BOUNDARY-PROGRESS.jsonl'),JSON.stringify(value)+'\n')});context.__factoryWorld=vm.runInContext('('+nativeWorldFactory.toString()+')(__factoryRoot)',context);}
 const world=context.__factoryWorld;
 const req=name=>{
  if(name==='original-fs'){record.controlledOriginalFsImports=(record.controlledOriginalFsImports??0)+1;return require('node:fs');}
  const host=path.join(f.runtime,'desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node'),filesystem=path.join(f.runtime,'desktop/native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node');
  if(name!==host&&name!==filesystem){record.counters.addon++;throw Error('UNEXPECTED_ADDON_PATH');}
  record.counters.nativeLoader++;record.controlledAddonLoads??=[];record.controlledAddonLoads.push(name===host?'host':'filesystem');
  context.__factoryTraceEvent({name:'controlled-native-require',kind:name===host?'host':'filesystem'});
  const value=name===host?world.host:world.filesystem;world.cache[name]={filename:name,exports:value,loaded:true};return value;
 };
 req.cache=world.cache;req.resolve=name=>name;return req;
}
function fixedUtilityFork(context,record,f,...args){fixedNativeRequire(context,record,f);return context.__factoryWorld.utilityFork(...args);}

// Borrow only maintained fixture/module helper definitions. Their 105 test
// registrations are disabled in this *new* harness; original maintained tests
// and assertions remain untouched and run independently in retained QA.
function mainFixtureSource(main,runtime){
 const section=(from,to)=>{const a=main.indexOf(from),b=main.indexOf(to,a+from.length);if(a<0||b<=a)throw Error('ACTUAL_MAIN_SECTION_MISSING:'+from);return main.slice(a,b);};
 const token=main.match(/let terminalCommittedOwner\s*=\s*[^;]+;/)?.[0];if(!token)throw Error('ACCEPTED_OWNER_TOKEN_MISSING');
 const admission=section('const nativeWindowAdmissionEnabled=','const guardNativeFactory=');
 const call=section("ipcMain.handle('siren:windows',invokeNativeWindow);","ipcMain.handle('siren:window-dock'");
 return `import {WindowRegistry} from './windows/registry.mjs';
import {types} from 'node:util';
import {EventEmitter} from 'node:events';
import {takeDesktopLaunch,captureDesktopLaunchDataPreference} from './desktop-launch.mjs';
import {app,utilityProcess} from 'electron';
const record=globalThis.__factoryRecord;
let selectedId='project1',snapshot={project:{id:'project1'},revision:1},mode='normal',nativeReadonly=false,pinTransition=false,accountTransition=false,accountQuiesced=false,workspaceBarrier=null,nativeShellFailure=false;
const writes=new Set(),nativeShells=new Map(),handlers=new Map(),account={accountId:'account1'},dataRoot=${JSON.stringify(path.join(path.dirname(runtime),'chosen-data'))};
const localPin={state:()=>({unlocked:record.factoryControl.locked!==true})};
let ordinal=10,terminalRuntime=null;
class OwnedWindow extends EventEmitter{
 constructor(url='siren://app/app.html'){super();this.id=ordinal++;this.dead=false;const contents=this.webContents=new EventEmitter();Object.assign(contents,{id:ordinal++,mainFrame:{url,processId:10,routingId:20},isDestroyed:()=>this.dead,getURL:()=>contents.mainFrame.url,setWindowOpenHandler(){},send(){}});}
 isDestroyed(){return this.dead;}isMinimized(){return false;}restore(){}focus(){}show(){}hide(){}
 destroy(){this.dead=true;this.webContents.emit('destroyed');this.emit('closed');}close(){this.destroy();}
}
const window=new OwnedWindow();
const windowRegistry=new WindowRegistry({terminalViews:true,authorize:request=>({projectId:selectedId,mode:'normal',access:'write',entityIds:request.role==='workspace'?(terminalRuntime?.entityIds(selectedId)??[]):[request.entityId]}),createWindow:options=>{const view=new OwnedWindow(options.mainFrameUrl);nativeShells.set(options.windowId,view);return view;}});
windowRegistry.bindWorkspace(window);windowRegistry.activateWorkspace();
const registeredInitializer=takeDesktopLaunch();
record.preference=captureDesktopLaunchDataPreference(registeredInitializer);record.takeCalls++;
function runCarrierProbes(original){let getters=0,refused=0;const carrier=original.nativeMain;for(const kind of ['outer-getter','missing','inherited','proxy-hooks','extra-carrier','getter-carrier','proxy-carrier','wrong-policy']){let hooks=Object.defineProperties({},Object.getOwnPropertyDescriptors(original));if(kind==='outer-getter')Object.defineProperty(hooks,'nativeMain',{enumerable:true,get(){getters++;throw Error('GETTER');}});if(kind==='missing')delete hooks.nativeMain;if(kind==='inherited'){delete hooks.nativeMain;Object.setPrototypeOf(hooks,{nativeMain:carrier});}if(kind==='proxy-hooks')hooks=new Proxy(hooks,{});if(['extra-carrier','getter-carrier','wrong-policy'].includes(kind)){const n=Object.defineProperties(Object.create(null),Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(carrier)).map(([k,d])=>[k,{...d,configurable:true,writable:true}])));if(kind==='extra-carrier')n.extra=true;if(kind==='getter-carrier')Object.defineProperty(n,'appReady',{enumerable:true,get(){getters++;throw Error('GETTER');}});if(kind==='wrong-policy')n.privateEnvironmentKeys=Object.freeze(['NODE_OPTIONS']);hooks.nativeMain=n;}if(kind==='proxy-carrier')hooks.nativeMain=new Proxy(carrier,{});try{registeredInitializer(hooks);}catch(error){if(error.message!=='NATIVE_FACTORY_CARRIER_REFUSED')throw error;refused++;}}return {getters,refused};}
const initializeTerminalCandidate=options=>{if(record.factoryControl.sensitivity==='copied-context'){const original=options.nativeMain;options={...options,nativeMain:Object.freeze(Object.assign(Object.create(null),original,{captureIncarnation:context=>original.captureIncarnation(Object.freeze({...context,grant:Object.freeze({...context.grant})}))}))};record.sensitivityInjected='Copied grant passed to genuine MAIN incarnation capture';}record.mainHooks=options;if(record.factoryControl.shapeBeforeInit){record.preInitCarrierProbes=runCarrierProbes(options);record.preInitShapeResourceCounts={nativeLoader:record.counters.nativeLoader,utility:record.counters.utility};}record.actualMainCarrierKeys=record.factoryControl.sensitivity==='erased-observation'?[]:Object.keys(options.nativeMain);record.carrierDataChoice=options.nativeMain.dataDirectory;return registeredInitializer(options);};
const ipcMain={handle:(channel,fn)=>handlers.set(channel,fn)},nativeTheme={shouldUseDarkColors:false},appearanceStore={read:async()=>({theme:'system'})};
const pinLifecycleHooks={isLockBusy:()=>false,isUnlockBusy:()=>false,enterTransition(){},leaveTransition(){},isUnlocked:()=>true,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},endAccountTransition:async()=>{},activateWorkspace:()=>windowRegistry.activateWorkspace(),commitLock(){},verifyUnlock:async()=>({ok:false}),afterUnlock:async value=>value,runWhenReady:fn=>fn(),captureUnlockScope:()=>({event:{sender:window.webContents,senderFrame:window.webContents.mainFrame},isCurrent:()=>true})};
const isTerminalRollbackScopeCurrent=()=>false;
const invokeNativeWindow=async(_event,request)=>({ok:true,view:await windowRegistry.openView(request)});
const dialog={showOpenDialog:async()=>({canceled:true,filePaths:[]})};
${token}
${admission}
${call}
record.events.push('ACTUAL_MAIN_INITIALIZER_CALL');
record.main={
 isReady:()=>record.mainHooks.isReady(),setMode:value=>{mode=value;},commitOwner:()=>{terminalCommittedOwner={};},
 pinFence:()=>{record.factoryControl.locked=true;windowRegistry.invalidateEpoch({preserveWorkspace:true});},pinUnfence:()=>{record.factoryControl.locked=false;windowRegistry.activateWorkspace();},
 shape:()=>({keys:Reflect.ownKeys(terminalRuntime),frozen:Object.isFrozen(terminalRuntime),pinAccessor:typeof Object.getOwnPropertyDescriptor(terminalRuntime,'pinLifecycle').get==='function',prototype:Object.getPrototypeOf(terminalRuntime)===Object.prototype?'Object.prototype':'other'}),
 invokeList:()=>{const view=[...nativeShells.values()].find(view=>!view.dead);if(!view)return {ok:false};const event={sender:view.webContents,senderFrame:view.webContents.mainFrame},grant=windowRegistry.capture(event);return handlers.get('siren:terminal')(event,'terminalList',{operationId:'factory_list_'+ ++ordinal,epoch:grant?.epoch});},
 refusalProbes:()=>record.preInitCarrierProbes,
 launch:()=>{record.events.push('REGISTERED_TERMINAL_LAUNCH');return handlers.get('siren:terminal-launch')({sender:window.webContents,senderFrame:window.webContents.mainFrame});},runtime:terminalRuntime,registry:windowRegistry,window,handlers};
`;
}

async function harness(record){
 const caseOutput=path.join(output,record.name);await fs.mkdir(caseOutput,{recursive:true});
 const file=path.join(desktop,'tests/terminal-native-bootstrap.test.mjs'),original=await fs.readFile(file,'utf8');
 record.maintainedHelper={path:file,bytes:Buffer.byteLength(original),sha256:digest(original)};
 let source=original;
 const replace=(before,after)=>{assert.equal(source.split(before).length,2,'EXACT_HELPER_ANCHOR:'+before.slice(0,70));source=source.replace(before,after);};
 const registration=source.match(/^function selectedTest\(name,body\)\{[^\r\n]+\}\r?$/m)?.[0];assert(registration,'maintained registration definition');replace(registration,'function selectedTest(){}');
 replace("const desktop=path.resolve(process.env.SIREN_BOOTSTRAP_SOURCE??fileURLToPath(new URL('../',import.meta.url)));",'const desktop='+JSON.stringify(desktop)+';');
 replace("const evidence=path.resolve(process.env.SIREN_BOOTSTRAP_EVIDENCE??path.join(desktop,'../bootstrap-producer-test-evidence'));",'const evidence='+JSON.stringify(path.join(caseOutput,'fixtures'))+';');
 replace("app:{isPackaged:false,getAppPath:","app:{isReady:()=>true,isPackaged:false,getAppPath:");
 replace('console,setTimeout,clearTimeout,setImmediate,clearImmediate,queueMicrotask,process:','console,performance,setTimeout,clearTimeout,setImmediate,clearImmediate,queueMicrotask,process:');
 replace("process:{platform:process.platform,versions:{},argv:","process:{platform:'win32',arch:'x64',type:'browser',pid:process.pid,env:{SystemRoot:'C:\\\\Windows',PATH:'C:\\\\Windows\\\\System32'},versions:{electron:'44.9.3',modules:'149',napi:'10'},argv:");
 replace("if(id==='node:module')return synth(id,{createRequire:()=>name=>{counters.nativeLoader++;if(name==='original-fs')throw Error('UNEXPECTED ORIGINAL FS IN NODE FIXTURE');counters.addon++;throw Error('NATIVE REQUIRE REFUSED');}});", "if(id==='node:module')return synth(id,{createRequire:()=>fixedNativeRequire(context,record,f)});");
 replace("utilityProcess:{fork(){counters.utility++;counters.fork++;throw Error('UTILITY FORK REFUSED');}}", "utilityProcess:{fork(...args){return fixedUtilityFork(context,record,f,...args);}}");
 const from="   if(filename.endsWith(path.sep+'src'+path.sep+'main.mjs'))return synth(id,{},()=>{";
 const a=source.indexOf(from),b=source.indexOf("   if(filename.endsWith(path.sep+'src'+path.sep+'account'+path.sep+'pin-worker.mjs'))",a);assert(a>=0&&b>a,'maintained controlled MAIN boundary');
 source=source.slice(0,a)+`   if(filename.endsWith(path.sep+'src'+path.sep+'main.mjs')){
    counters.controlledMain++;context.__factoryRecord=record;
    const actual=await fs.readFile(filename,'utf8');record.actualMainSource={id,bytes:Buffer.byteLength(actual),sha256:hash(actual)};
    const body=mainFixtureSource(actual,f.runtime);record.actualMainCallBoundary={classification:'Actual retained MAIN call/helper statements with controlled surrounding boot and window capabilities',bodySha256:hash(body)};
    return new vm.SourceTextModule(body,{context,identifier:id,initializeImportMeta(meta){meta.url=id;},importModuleDynamically:async(spec,parent)=>{const child=await load(resolve(spec,parent.identifier));await evaluate(child);return child;}});
   }
`+source.slice(b);
 if(process.argv[4]==='trace-owner-dispose'){
  const before="   const source=await fs.readFile(filename,'utf8');record.modules.push({id,bytes:Buffer.byteLength(source),sha256:hash(source)});";
  const after="   let source=await fs.readFile(filename,'utf8');record.modules.push({id,bytes:Buffer.byteLength(source),sha256:hash(source)});if(filename.endsWith(path.sep+'desktop-native-runtime.mjs')){const anchor=' function dispose(...args){';assert.equal(source.split(anchor).length,2);const raw=hash(source);source=source.replace(anchor,anchor+\"globalThis.__ownerDisposeTrace?.(args.length);\");record.instrumentedOwner={id,rawSha256:raw,evaluatedSha256:hash(source),traceOnlyDiff:'Append globalThis.__ownerDisposeTrace?.(args.length) at dispose entry; no return/control-flow replacement'};context.__ownerDisposeTrace=argc=>{record.ownerTrace??=[];const row={argc,released:record.factoryControl.released===true};record.ownerTrace.push(row);appendFileSync(path.join(f.root,'OWNER-DISPOSE-ENTRY.jsonl'),JSON.stringify(row)+'\\n');};}";
  assert.equal(source.split(before).length,2);source=source.replace(before,after);
 }
 source=source.replaceAll('import.meta.url',JSON.stringify(pathToFileURL(file).href));
 source="import {appendFileSync} from 'node:fs';\n"+source;
 source+='\nconst mainFixtureSource='+mainFixtureSource.toString()+';\nconst nativeWorldFactory='+nativeWorldFactory.toString()+';\nconst fixedNativeRequire='+fixedNativeRequire.toString()+';\nconst fixedUtilityFork='+fixedUtilityFork.toString()+';\nexport {fixture,modules};\n';
 record.helperExtraction={originalRegistrationsPreservedInOriginalFile:true,scope:'new helper definition extraction and controlled MAIN-boot replacement only',sha256:digest(source)};
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(caseOutput,'extracted-helper.mjs'),source,{flag:'wx'});
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}


async function fixtureInventory(directory){const rows=[];async function visit(parent,prefix=''){for(const entry of (await fs.readdir(parent,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert.equal(entry.isSymbolicLink(),false,'OWNED_FIXTURE_LINK_REFUSED');const relative=prefix?prefix+'/'+entry.name:entry.name,target=path.join(parent,entry.name);if(entry.isDirectory())await visit(target,relative);else{assert(entry.isFile());const bytes=await fs.readFile(target);rows.push({path:relative,bytes:bytes.length,sha256:digest(bytes)});}}}await visit(directory);return rows;}
async function fixtureSnapshot(f,label){
 const controls=[];for(const [name,bytes,expected]of [['runtime-tree.json',f.manifestBytes,f.pins.runtimeTreeSha256],['application-roster.json',f.rosterBytes,f.pins.applicationRosterSha256],['approved-source-build-receipt.bin',f.approvalBytes,f.pins.approvedSourceBuildReceiptSha256]]){assert.equal(digest(bytes),expected);const file=path.join(f.root,'INPUT-'+name);if(label==='BEFORE')await fs.writeFile(file,bytes,{flag:'wx'});const actual=await fs.readFile(file);assert.equal(digest(actual),expected);controls.push({path:file,bytes:actual.length,sha256:digest(actual)});}
 const outputNames=['runtime-tree.json','approved-source-build-receipt.json','runtime-descriptor.json','package.json','candidate-main.mjs','terminal-candidate-receipt.json'],generated=[];
 for(const name of outputNames){const file=path.join(f.control,name);try{const bytes=await fs.readFile(file);generated.push({path:name,bytes:bytes.length,sha256:digest(bytes)});}catch(error){if(error.code!=='ENOENT')throw error;}}
 const value={kind:'OWNED_FACTORY_FIXTURE_'+label,scope:'Fixture created inside this child; BEFORE is readback before build/entry, not before child birth',runtime:f.runtime,runtimeFiles:await fixtureInventory(f.runtime),buildInputs:await fixtureInventory(f.dependencies),controls,generatedControls:generated},file=path.join(f.root,'FIXTURE-'+label+'.json');await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});const bytes=await fs.readFile(file);return {path:file,bytes:bytes.length,sha256:digest(bytes)};
}

const pause=()=>new Promise(resolve=>setImmediate(resolve));
async function until(check,label){const expires=performance.now()+30000;while(performance.now()<expires){if(check())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('OWNED_PHASE_NOT_REACHED_AFTER_DECLARED_QA_30S:'+label);}
function boundary(record,name){if(nativeCount(record,name)>0)return Promise.resolve();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{record.onBoundaryEvent=null;reject(Error('BOUNDARY_ENTRY_NOT_OBSERVED_AFTER_QA_30S:'+name));},30000);record.onBoundaryEvent=observed=>{if(observed!==name)return;record.onBoundaryEvent=null;clearTimeout(timer);resolve();};});}
function nativeCount(record,name){return (record.nativeBoundaryTrace??[]).filter(row=>row.name===name).length;}
async function setup(record){const h=await harness(record),f=await h.fixture(record);record.fixture=f;record.fixtureBefore=await fixtureSnapshot(f,'BEFORE');if(record.factoryControl.sensitivity==='invalid-fixture'){const target=path.join(f.runtime,'desktop/src/terminal/desktop-native-initializer.mjs'),before=await fs.readFile(target);const after=Buffer.from(before);after[0]^=1;await fs.writeFile(target,after);record.sensitivityInjected={kind:'required-fixture-body-corruption',target,before:digest(before),after:digest(after)};}const m=await h.modules(f,record);await m.build();await m.entry();assert.equal(record.actualMainCarrierKeys.length,11,'MISSING_GENUINE_MAIN_CARRIER_OBSERVATION');assert.equal(record.carrierDataChoice,path.join(f.control,'chosen-data'),'ACTUAL_MAIN_DATA_CHOICE');return {f,m,main:record.main};}
function runCase(name,title,body){if(process.argv[5]&&name!=='actual-route-sequential')return;if(process.argv[4]==='trace-owner-dispose'&&!name.startsWith('held-'))return;test(title,async()=>{
 const row={name,title,completed:false,status:'running'},record={name,factoryControl:{sensitivity:process.argv[5]??null},events:[],modules:[],namespaces:new Map(),takeCalls:0,duplicateRefusals:0};rows.push(row);
 try{await body(record,row);row.status='pass';}catch(error){row.status='fail';row.error={name:error.name,message:String(error.message),code:error.code??null};throw error;}
 finally{if(record.fixture)record.fixtureAfter=await fixtureSnapshot(record.fixture,'AFTER');row.completed=true;row.observations={...row.observations,actualMainSource:record.actualMainSource,actualMainCallBoundary:record.actualMainCallBoundary,actualMainCarrierKeys:record.actualMainCarrierKeys,actualMainDataChoice:record.carrierDataChoice,counters:record.counters,nativeBoundaryTrace:record.nativeBoundaryTrace??[],controlledAddonLoads:record.controlledAddonLoads??[],controlledOriginalFsImports:record.controlledOriginalFsImports??0,ownerTrace:record.ownerTrace??[],instrumentedOwner:record.instrumentedOwner??null,sensitivityInjected:record.sensitivityInjected??null,fullMainBoot:false,actualNativeOrElectronExecution:false};row.inputs={maintainedHelper:record.maintainedHelper,extraction:record.helperExtraction,fixtureRoot:record.root,fixtureBefore:record.fixtureBefore??null,fixtureAfter:record.fixtureAfter??null,modules:record.modules};}
});}

runCase('actual-route-sequential','actual registered launch establishes CLOSE OPEN and two clean graphs share one loader',async(record,row)=>{
 const {main}=await setup(record),shape=main.shape();
 assert.deepEqual(Array.from(shape.keys),['entityIds','pinLifecycle','retireDisplays','shutdown','appearanceChanged','prepareTransition','rollbackTransition','dispose','snapshot']);assert.equal(shape.frozen,true);assert.equal(shape.pinAccessor,true);assert.equal(main.runtime.pinLifecycle,null);
 assert.equal((await main.launch()).ok,true);assert(main.runtime.pinLifecycle);assert.equal(nativeCount(record,'host-start'),1);
 await main.runtime.prepareTransition();assert.equal(nativeCount(record,'host-stop'),0);await main.runtime.rollbackTransition();assert.equal((await main.launch()).ok,true);assert.equal(nativeCount(record,'host-start'),1,'published preparation/rollback retains graph');
 main.setMode('readonly');const refused=await main.invokeList();assert.equal(refused.ok,false);main.setMode('normal');assert.equal((await main.invokeList()).ok,true,'fresh policy restores input on same graph');
 await main.runtime.shutdown('first');assert.equal(nativeCount(record,'host-stop'),1);assert.equal(main.runtime.pinLifecycle,null);
 assert.equal((await main.launch()).ok,true);assert.equal(nativeCount(record,'host-start'),2);assert.equal(nativeCount(record,'filesystem-inspector'),2);assert.equal(nativeCount(record,'utility-fork'),2);assert.deepEqual(record.controlledAddonLoads,['host','filesystem'],'one process loader/cache binding');
 await main.runtime.dispose();assert.equal(nativeCount(record,'host-stop'),2);assert.equal((await main.launch()).ok,false);assert.equal(nativeCount(record,'host-start'),2,'permanent dispose fence');
 row.observations={shape:JSON.parse(JSON.stringify(shape)),graphs:2,initialCloseOpen:true,publishedPrepareRollback:true,freshPolicy:true,permanentDispose:true};
});

runCase('closed-input-shapes','closed initializer bundle and own DATA carrier refuse before callbacks',async(record,row)=>{
 record.factoryControl.shapeBeforeInit=true;const {main,m,f}=await setup(record);const checks=main.refusalProbes();assert.equal(record.preInitShapeResourceCounts.nativeLoader,0);assert.equal(record.preInitShapeResourceCounts.utility,0);assert.equal(checks.getters,0);assert.equal(checks.refused,8);assert.equal(record.counters.nativeLoader,0);assert.equal(record.counters.utility,0);
 const wrapper=await m.load(pathToFileURL(path.join(f.runtime,'desktop/src/terminal/desktop-native-initializer.mjs')).href);await m.evaluate(wrapper);m.context.__makeInitializer=wrapper.namespace.createDesktopNativeInitializer;
 const bundle=vm.runInContext(`(()=>{let hooks=0,refused=0;const errors=[];for(const value of [null,{},Object.assign(Object.create(null),{manifest:{},resources:{},tree:{},verifier:{}}),Object.defineProperty({},'manifest',{enumerable:true,get(){hooks++;throw Error('GETTER');}})])try{__makeInitializer(value);}catch(error){errors.push(error.message);refused++;}return {hooks,refused,errors};})()`,m.context);
 assert.equal(bundle.hooks,0);assert.equal(bundle.refused,4);assert(Array.from(bundle.errors).every(message=>message==='NATIVE_FACTORY_BUNDLE_REFUSED'));assert.equal((await main.launch()).ok,true,'FIRST_VALID_MAIN_INITIALIZATION_AFTER_SHAPE_REFUSALS_MUST_REMAIN_USABLE');await main.runtime.dispose();row.observations={carrierChecks:JSON.parse(JSON.stringify(checks)),bundleChecks:JSON.parse(JSON.stringify(bundle))};
});

runCase('cancel-before-entry','cancellation before factory entry creates no native resources',async(record,row)=>{
 const {main}=await setup(record);const launch=main.launch(),shutdown=main.runtime.shutdown('cancel-before-entry');await shutdown;assert.equal((await launch).ok,false);assert.equal(record.counters.nativeLoader,0);assert.equal(record.counters.utility,0);assert.equal(nativeCount(record,'filesystem-inspector'),0);row.observations={cancelledBeforeFactory:true};
});

for(const operation of ['shutdown','prepareTransition','dispose'])runCase('held-utility-'+operation,'held utility startup '+operation+' requests cleanup before release and joins reentry',async(record,row)=>{
 record.factoryControl.holdUtility=true;record.factoryControl.holdExit=true;const {main}=await setup(record);const launch=main.launch();await boundary(record,'utility-fork');
 let reentry;record.factoryControl.onUtilityRetire=()=>{try{main.runtime[operation]('cancel');reentry='RETURNED';}catch(error){reentry=error.message;}};
 const args=operation==='shutdown'?['cancel']:[],pending=main.runtime[operation](...args);let done=false;pending.then(()=>done=true,()=>done=true);
 const joined=main.runtime[operation](...args);assert.equal(joined,pending,'same unpublished operation shares reserved join');
 if(operation==='shutdown')assert.throws(()=>main.runtime.shutdown('conflicting'),/NATIVE_FACTORY_OPERATION_CONFLICT/);
 await boundary(record,'utility-retire');await pause();assert.equal(done,false);assert.equal(reentry,'NATIVE_FACTORY_REENTRANT_CLEANUP_REFUSED');
 if(process.argv[4]==='trace-owner-dispose'){assert.equal(record.ownerTrace[0]?.argc,0);assert.equal(record.ownerTrace[0]?.released,false);}
 record.factoryControl.released=true;record.releaseExit();await pending;assert.equal((await launch).ok,false);assert.equal(nativeCount(record,'host-start'),0);
 record.factoryControl.holdUtility=false;record.factoryControl.holdExit=false;delete record.factoryControl.onUtilityRetire;
 if(operation==='dispose'){assert.equal((await main.launch()).ok,false);assert.equal(nativeCount(record,'utility-fork'),1);}else{assert.equal((await main.launch()).ok,true);await main.runtime.dispose();assert.equal(nativeCount(record,'host-stop'),1);}
 row.observations={operation,cleanupEnteredBeforeRelease:true,actualJoinPendingBeforeRelease:true,reentry,ownerEntryMeasurement:process.argv[4]==='trace-owner-dispose'?'trace-only evaluated owner body':'utility-retirement side effect; owner entry source inference'};
});

runCase('held-provider-unknown','held failed provider startup remains charged and refuses replacement after cleanup uncertainty',async(record,row)=>{
 record.factoryControl.holdProvider=true;const {main}=await setup(record);const launch=main.launch();await boundary(record,'filesystem-retire');
 const shutdown=main.runtime.shutdown('held-provider');let done=false;shutdown.then(()=>done=true,()=>done=true);await pause();assert.equal(done,false);
 if(process.argv[4]==='trace-owner-dispose'){await until(()=>record.ownerTrace?.length>0,'owner-dispose');assert.equal(record.ownerTrace[0].argc,0);assert.equal(record.ownerTrace[0].released,false);}
 record.factoryControl.released=true;record.releaseProvider();await assert.rejects(shutdown,/NATIVE_FACTORY_CLEANUP_UNKNOWN/);assert.equal((await launch).ok,false);main.setMode('normal');record.factoryControl.locked=false;record.factoryControl.holdProvider=false;assert.equal(main.isReady(),true,'genuine MAIN readiness restored before replacement refusal');assert.equal((await main.launch()).ok,false);assert.equal(nativeCount(record,'filesystem-inspector'),1);assert.equal(record.counters.utility,0);row.observations={heldNativeProviderFailure:true,unknownBlocksReplacement:true,pendingUntilActualRelease:true};
});

runCase('stale-held-startup','committed owner change during held startup refuses old graph and cleanly retires entered work',async(record,row)=>{
 record.factoryControl.holdUtility=true;const {main}=await setup(record);const launch=main.launch();await boundary(record,'utility-fork');main.commitOwner();record.releaseUtility();assert.equal((await launch).ok,false);assert.equal(nativeCount(record,'utility-retire'),1);assert.equal(nativeCount(record,'host-start'),0);record.factoryControl.holdUtility=false;assert.equal((await main.launch()).ok,true);await main.runtime.dispose();row.observations={staleStartupRefused:true,freshSequentialOwner:true};
});

runCase('pin-independent-lifetime','PIN fence and workspace epoch rotation retain the same graph for rollback',async(record,row)=>{
 const {main}=await setup(record);assert.equal((await main.launch()).ok,true);await main.runtime.prepareTransition();main.pinFence();assert.equal((await main.launch()).ok,false);assert.equal(nativeCount(record,'host-stop'),0);main.pinUnfence();await main.runtime.rollbackTransition();assert.equal((await main.launch()).ok,true);assert.equal(nativeCount(record,'host-start'),1);await main.runtime.dispose();row.observations={sameGraphAcrossPinEpoch:true};
});

runCase('unknown-native-cleanup','malformed native cleanup proof blocks replacement and positive shutdown acknowledgement',async(record,row)=>{
 const {main}=await setup(record);assert.equal((await main.launch()).ok,true);record.factoryControl.unknownHostCleanup=true;let acknowledged=false;const shutdown=main.runtime.shutdown('unknown');shutdown.then(()=>acknowledged=true,()=>{});await boundary(record,'host-stop');await pause();await pause();assert.equal(acknowledged,false);main.setMode('normal');record.factoryControl.locked=false;record.factoryControl.unknownHostCleanup=false;assert.equal(main.isReady(),true,'genuine MAIN readiness restored before replacement refusal');assert.equal((await main.launch()).ok,false);assert.equal(nativeCount(record,'host-start'),1);assert.equal(nativeCount(record,'host-stop'),1);row.observations={malformedNativeClosedProof:true,replacementBlocked:true,positiveAcknowledgementObserved:false,cleanupCompletion:'pending or unknown; no completion claimed'};
});
