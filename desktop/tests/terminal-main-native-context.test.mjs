// Actual MAIN call/commit literals and one canonical genuine WindowRegistry.
// All Electron handles are controlled; this is source evidence, not native QA.
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {win32} from 'node:path';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createDesktopTerminalCandidate} from '../src/terminal/candidate-initializer.mjs';
import {failure} from '../src/ipc.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';
import {supportedProviderPromise} from '../src/terminal/provider-lifetime.mjs';
import {captureDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import Module,{syncBuiltinESMExports} from 'node:module';
import childProcess from 'node:child_process';
import {openOwnedSelection} from '../src/projects/selection.mjs';

const source=await readFile(process.argv[3]||new URL('../src/main.mjs',import.meta.url),'utf8');
const mode=process.argv[4]||'normal',cases=[];
const counters={nativeRequire:0,nativeFork:0,utilityFork:0,nativeProviderStart:0,nativeOwnerStart:0};
const originalLoad=Module._load,originalDlopen=process.dlopen,originalChildren=new Map(),activationAttempts=[];
Module._load=function(name,...args){if(typeof name==='string'&&/\.node$/i.test(name)){counters.nativeRequire++;activationAttempts.push('named-addon-require');throw Error('UNEXPECTED_NATIVE_ADDON');}return Reflect.apply(originalLoad,this,[name,...args]);};
process.dlopen=function(){counters.nativeRequire++;activationAttempts.push('default-addon-dlopen');throw Error('UNEXPECTED_NATIVE_DLOPEN');};
for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']){originalChildren.set(key,childProcess[key]);childProcess[key]=function(){counters.nativeFork++;activationAttempts.push('child-process-'+key);throw Error('UNEXPECTED_CHILD_PROCESS');};}
syncBuiltinESMExports();
function literal(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert(a>=0&&b>a,'ACTUAL_MAIN_REGION:'+start);assert.equal(source.indexOf(start,a+start.length),-1,'UNIQUE_MAIN_REGION:'+start);return source.slice(a,b);}
function scenario(name,fn){test(name,async()=>{const row={name,completed:false,status:'running'};cases.push(row);try{await fn(row);row.status='pass';}catch(error){row.status='fail';row.error={name:error.name,code:error.code||null,message:String(error.message)};throw error;}finally{row.completed=true;}});}
after(async()=>{Module._load=originalLoad;process.dlopen=originalDlopen;for(const [key,value]of originalChildren)childProcess[key]=value;syncBuiltinESMExports();if(process.argv[2])await writeFile(process.argv[2],JSON.stringify({kind:'TERMINAL_MAIN_NATIVE_CONTEXT_DIRECT_RESULT_V1',author:'/root/main_native_carrier_implementation',mode,completed:true,cases,counters,activationAttempts,instrumentation:{nativeRequire:'Explicit named .node Module._load and default process.dlopen traps during scenarios; initial static imports precede traps.',nativeFork:'All seven child_process named/default methods trapped and builtin named exports synchronized.',utilityFork:'Explicit exact utilityProcess.fork trap.',nativeProviderStart:'Zero native filesystem-loading calls by source exclusion plus explicitly inert provider VM loading boundary; controlled genuine provider constructors exercised separately.',nativeOwnerStart:'Source exclusion: unchanged unavailable initializer has no configured createGraph; no runtime-owner constructor imported or executed.'},evidenceClass:'controlled-source-only',actualNativeActivation:false},null,2)+'\n',{flag:'wx'});});
let serial=10;
function ownedWindow(url='siren://app/app.html'){
 const w=new EventEmitter();w.id=serial++;w.destroyed=false;w.isDestroyed=()=>w.destroyed;w.isMinimized=()=>false;w.restore=()=>{};w.focus=()=>{};
 const wc=w.webContents=new EventEmitter();Object.assign(wc,{id:serial++,destroyed:false,mainFrame:{url,processId:10,routingId:20},isDestroyed:()=>wc.destroyed,getURL:()=>wc.mainFrame.url,setWindowOpenHandler(){},send(){},executeJavaScript:async()=>{}});
 w.contentView={children:[],addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;},removeChildView(view){this.children=this.children.filter(v=>v!==view);view.parent=null;}};w.getContentBounds=()=>({width:1000,height:800});w.show=()=>{};w.hide=()=>{};
 wc.close=()=>{wc.destroyed=true;wc.emit('destroyed');};
 w.destroy=()=>{w.destroyed=true;wc.destroyed=true;wc.emit('destroyed');w.emit('closed');};w.close=w.destroy;return w;
}
function fixture(){
 const window=ownedWindow(),handlers=new Map(),nativeShells=new Map(),trace=[];
 const state={pin:true,pinHook:null,appReady:true,appHook:null,write:null,login:null,logout:null,dialog:null};
 const utilityProcess=Object.freeze({fork(){counters.utilityFork++;throw Error('UNEXPECTED_UTILITY_FORK');}});
 const context=vm.createContext({types,Buffer,WindowRegistry,window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},nativeShells,selectedId:'project1',snapshot:{project:{id:'project1'},revision:1},mode:'normal',nativeReadonly:false,pinTransition:false,accountTransition:false,accountQuiesced:false,workspaceBarrier:null,nativeShellFailure:false,writes:new Set(),bootstrap:{selectionGeneration:1},grants:new Set(['project1']),reason:null,dataRoot:'C:\\owned\\chosen-external-data',utilityProcess,
  process:{env:{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32',TEMP:'C:\\OwnedTemp'}},
  account:{accountId:'account1',policy:{opened(){}},beginLogin:async options=>state.login?state.login(options):{ok:false},logout:async()=>state.logout?state.logout():{ok:false}},
  localPin:{state:()=>{state.pinHook?.();return {unlocked:state.pin};}},app:{isReady:()=>{state.appHook?.();return state.appReady;}},
  dialog:{showOpenDialog:(parent,options)=>{trace.push({kind:'dialog',parent,options});return state.dialog?state.dialog(parent,options):Promise.resolve({canceled:true,filePaths:[]});}},
  failure,invokeNativeWindow:async()=>({ok:true}),pinLifecycleHooks:{},isTerminalRollbackScopeCurrent:()=>false,appearanceStore:{read:async()=>({theme:'system'})},nativeTheme:{shouldUseDarkColors:false},
  prepareNativeWorkspace:async()=>{},retireNativeViews:async()=>{},rollbackNativePreparation:async()=>{},atomicWrite:async(...args)=>{if(state.write)return state.write(...args);},join:win32.join,
 });
 const registry=new WindowRegistry({terminalViews:true,authorize:request=>!state.pin||!context.selectedId||!context.snapshot||context.accountQuiesced||context.writes.selectionQuiesced||context.nativeShellFailure?null:{projectId:context.selectedId,mode:context.mode==='normal'&&!context.nativeReadonly?'normal':context.mode==='recovery'?'recovery':'readonly',access:context.mode==='normal'&&!context.nativeReadonly?'write':'read',entityIds:request.entityId?[request.entityId]:[]},createWindow:request=>{const child=state.createWindow?state.createWindow(request):ownedWindow(request.mainFrameUrl);nativeShells.set(request.windowId,child);return child;}});
 registry.bindWorkspace(window);registry.activateWorkspace();context.windowRegistry=registry;
 const owner=source.match(/let terminalCommittedOwner\s*=\s*[^;]+;/)?.[0]||'';
 const admission=literal('const nativeWindowAdmissionEnabled=','const guardNativeFactory=');
 vm.runInContext(owner+'\n'+admission,context,{timeout:1000});
 const initialize=createDesktopTerminalCandidate();
 context.initializeTerminalCandidate=options=>{trace.push({kind:'initializer',options});return initialize(options);};
 context.terminalRuntime=null;
 const call=literal("ipcMain.handle('siren:windows',invokeNativeWindow);","ipcMain.handle('siren:window-dock'");
 vm.runInContext(call,context,{timeout:1000});
 const observed=trace.find(row=>row.kind==='initializer');
 if(mode==='erase-carrier'&&observed)delete observed.options.nativeMain;
 const carrier=observed?.options.nativeMain;
 const event=()=>({sender:window.webContents,senderFrame:window.webContents.mainFrame});
 const grant=()=>registry.capturePrimary(event());
 const makeContext=g=>{context.testGrant=g;return vm.runInContext('({registry:windowRegistry,projectId:selectedId,grant:'+(mode==='corrupt-context'?'{...testGrant}':'testGrant')+'})',context);};
 const evalSource=body=>vm.runInContext(body,context,{timeout:1000});
 const data=body=>evalSource('('+body+')');
 const commits=()=>{evalSource(literal('const selected = async (next,{isCurrent}={}) => {','const changeSelection =')+'\nglobalThis.selectActual=selected;\nconst accounts={'+literal('  beginLogin: async () => {','  getUpdate:')+'};globalThis.loginActual=accounts.beginLogin;globalThis.logoutActual=accounts.logout;');const recoveryStart=source.indexOf('recoverySelected: async projectId => {'),recoveryEnd=source.indexOf('      } });',recoveryStart);assert(recoveryStart>=0&&recoveryEnd>recoveryStart);evalSource('globalThis.recoverActual=({'+source.slice(recoveryStart,recoveryEnd)+'}}).recoverySelected;');
  Object.assign(context,{openOwnedSelection,legacyExportEpoch:0,assertImportComplete:async()=>{},basename:win32.basename,resolve:win32.resolve,requestDocsDiagramScan(){},projects:{directory:async id=>win32.join(context.dataRoot,'Projects',id),readProject:async()=>{throw Error('CONTROLLED_DAMAGED_PROJECT');}}});
  context.dialog.showMessageBox=async()=>({response:1});
  evalSource(literal('const changeSelection = async action => {','const captureLegacyExportAccess =')+'\nconst recoveryRoute={'+literal('  pickProject: async () => {','  saveProject: async request => {')+'};globalThis.pickProjectActual=recoveryRoute.pickProject;');
 };
 return {context,state,window,registry,handlers,trace,carrier,event,grant,makeContext,utilityProcess,observed,evalSource,data,commits};
}

scenario('actual MAIN initializer forwards the private chosen data root and genuine capabilities',async row=>{
 const f=fixture();assert(f.observed,'ACTUAL_INITIALIZER_CALLED');assert.equal(f.observed.options.registry,f.registry);assert.equal(f.context.dataRoot,'C:\\owned\\chosen-external-data');
 row.observations={actualInitializerCalls:1,genuineRegistry:true,chosenExternalDataDirectory:true,observedInitializerKeys:Object.keys(f.observed.options),hasNativeMain:Object.hasOwn(f.observed.options,'nativeMain')};
 assert.ok(f.carrier,'MISSING_NATIVE_MAIN_CARRIER_AT_ACTUAL_INITIALIZER');
 assert.equal(f.carrier.dataDirectory,f.context.dataRoot);assert.equal(f.carrier.utilityProcess,f.utilityProcess);
 assert.equal((await f.handlers.get('siren:terminal-launch')(f.event())).code,'TERMINAL_UNAVAILABLE');
});

const expectedKeys=['dataDirectory','utilityProcess','appReady','isUnlocked','getMode','canExecute','captureIncarnation','readEnvironment','privateEnvironmentKeys','parentForWebContents','showOpenDialog'];
const capture=f=>{const c=f.carrier.captureIncarnation(f.makeContext(f.grant()));assert(c,'GENUINE_OWNER_CONTEXT_CAPTURED');return c;};
const delay=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
scenario('carrier has exactly frozen own DATA keys and fresh app and PIN callbacks',()=>{
 const f=fixture(),c=f.carrier;assert.deepEqual(Object.keys(c),expectedKeys);assert(Object.isFrozen(c));assert.equal(Object.getPrototypeOf(c),null);
 for(const key of expectedKeys)assert(Object.hasOwn(Object.getOwnPropertyDescriptor(c,key),'value'));
 assert.deepEqual(Array.from(c.privateEnvironmentKeys),['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH']);assert(Object.isFrozen(c.privateEnvironmentKeys));
 assert.equal(c.appReady(),true);f.state.appReady=false;assert.equal(c.appReady(),false);f.state.appHook=()=>{throw Error('controlled');};assert.equal(c.appReady(),false);
 assert.equal(c.isUnlocked(),true);f.state.pin=false;assert.equal(c.isUnlocked(),false);f.state.pinHook=()=>{throw Error('controlled');};assert.equal(c.isUnlocked(),false);
});
scenario('fresh genuine workspace and Terminal grants require complete execution policy',async()=>{
 const f=fixture(),c=f.carrier;assert.equal(c.getMode(f.grant()),'normal');assert.equal(c.canExecute(f.grant()),true);
 await f.registry.openView({role:'terminal',entityId:'terminal1'});const child=[...f.context.nativeShells.values()][0];const terminal=f.registry.capture({sender:child.webContents,senderFrame:child.webContents.mainFrame});assert(terminal);assert.equal(c.canExecute(terminal),true);
 for(const [container,key] of [[f.context,'pinTransition'],[f.context,'accountTransition'],[f.context,'accountQuiesced'],[f.context,'workspaceBarrier'],[f.context,'nativeShellFailure'],[f.context.writes,'selectionTransition'],[f.context.writes,'selectionQuiesced'],[f.context.writes,'viewClosing']]){container[key]=true;assert.equal(c.canExecute(f.grant()),false,key);container[key]=false;assert.equal(c.canExecute(f.grant()),true,key+' restored');}
 f.state.pin=false;assert.equal(c.canExecute(terminal),false);f.state.pin=true;f.context.snapshot=null;assert.equal(c.canExecute(terminal),false);f.context.snapshot={project:{id:'project1'}};
 for(const m of ['readonly','recovery']){await f.registry.invalidateEpochAsync({preserveWorkspace:true});f.context.mode=m;f.registry.activateWorkspace();assert.equal(c.getMode(f.grant()),m);assert.equal(c.canExecute(f.grant()),false);}await f.registry.invalidateEpochAsync({preserveWorkspace:true});f.context.mode='normal';f.context.nativeReadonly=true;f.registry.activateWorkspace();assert.equal(c.getMode(f.grant()),'readonly');assert.equal(c.canExecute(f.grant()),false);
});
scenario('forged stale foreign and hostile grant inputs refuse before input hooks',()=>{
 const f=fixture(),c=f.carrier,g=f.grant();let hooks=0;
 const values=[null,{},Object.freeze({...g}),new Proxy(g,{get(){hooks++;throw Error('trap');}}),{get projectId(){hooks++;throw Error('getter');}}];
 for(const value of values){assert.equal(c.getMode(value),null);assert.equal(c.canExecute(value),false);}assert.equal(hooks,0);
 f.registry.invalidateEpoch({preserveWorkspace:true});assert.equal(c.getMode(g),null);assert.equal(c.canExecute(g),false);
});
scenario('trusted PIN callout reentry cannot authorize changed selection or barriers',()=>{
 for(const change of [f=>{f.context.selectedId='other';},f=>{f.context.writes.viewClosing=true;},f=>{f.context.mode='readonly';},f=>{f.context.snapshot=null;}]){
  const f=fixture(),g=f.grant();let once=true;f.state.pinHook=()=>{if(once){once=false;change(f);}};assert.equal(f.carrier.canExecute(g),false);
 }
});
scenario('capture accepts distinct genuine grants but refuses closed-context violations without hooks',()=>{
 const f=fixture(),a=f.grant(),b=f.grant();assert.notEqual(a,b);assert(f.carrier.captureIncarnation(f.makeContext(a)));assert(f.carrier.captureIncarnation(f.makeContext(b)));
 let hooks=0;const bad=[null,{},new Proxy({},{ownKeys(){hooks++;throw Error('trap');}}),f.data('{registry:windowRegistry,projectId:selectedId,grant:testGrant,extra:true}'),f.data('{registry:windowRegistry,projectId:selectedId,get grant(){throw Error("getter")}}'),f.data('Object.create({registry:windowRegistry,projectId:selectedId,grant:testGrant})')];
 for(const value of bad)assert.equal(f.carrier.captureIncarnation(value),null);assert.equal(hooks,0);
 const other=fixture();assert.equal(f.carrier.captureIncarnation(f.makeContext(other.grant())),null);
});
scenario('initial incarnation requires actual app readiness and rejects owner commit during trusted readiness',()=>{
 const f=fixture();f.state.appReady=false;assert.equal(f.carrier.captureIncarnation(f.makeContext(f.grant())),null);f.state.appReady=true;f.state.appHook=()=>{f.evalSource('terminalCommittedOwner={}');};assert.equal(f.carrier.captureIncarnation(f.makeContext(f.grant())),null);
});
scenario('owner lifetime preserves edits snapshot replacements PIN fences and grant epoch changes',()=>{
 const f=fixture(),c=capture(f);assert.deepEqual(Object.keys(c),['isCurrent']);assert(Object.isFrozen(c));
 f.context.snapshot={project:{id:'project1'},revision:999};assert.equal(c.isCurrent(),true);f.state.pin=false;f.context.pinTransition=true;assert.equal(c.isCurrent(),true);assert.equal(f.carrier.canExecute(f.grant()),false);
 f.registry.invalidateEpoch({preserveWorkspace:true});assert.equal(c.isCurrent(),true);f.state.pin=true;f.context.pinTransition=false;f.context.workspaceBarrier={};assert.equal(c.isCurrent(),true);f.context.workspaceBarrier=null;assert.equal(c.isCurrent(),true);
});
scenario('owner lifetime sticks on actual frame IDs URL windows contents or project replacements',()=>{
 const changes=[f=>{f.window.webContents.mainFrame={...f.window.webContents.mainFrame};},f=>{f.window.webContents.mainFrame.routingId++;},f=>{f.window.webContents.mainFrame.processId++;},f=>{f.window.webContents.mainFrame.url='siren://app/home.html';},f=>{f.window.id++;},f=>{f.window.webContents.id++;},f=>{f.context.selectedId='other';},f=>{f.window.webContents=ownedWindow().webContents;},f=>{f.context.window=ownedWindow();},f=>{f.window.destroy();}];
 for(const change of changes){const f=fixture(),c=capture(f);change(f);assert.equal(c.isCurrent(),false);f.context.selectedId='project1';assert.equal(c.isCurrent(),false);}
});
scenario('account transient mismatch survives rollback but final mismatch retires stickily',()=>{
 const f=fixture(),c=capture(f);f.context.accountTransition=true;f.context.account.accountId='transient';assert.equal(c.isCurrent(),true);assert.equal(f.carrier.canExecute(f.grant()),false);f.context.account.accountId='account1';f.context.accountTransition=false;assert.equal(c.isCurrent(),true);
 f.context.account.accountId='readAccess-changed';assert.equal(c.isCurrent(),false);f.context.account.accountId='account1';assert.equal(c.isCurrent(),false);
});
scenario('actual selected commit retires same-ID and unobserved project ABA owners',async()=>{
 const f=fixture();f.commits();let duringPolicy=null;const c=capture(f);f.context.account.policy.opened=()=>{duringPolicy=c.isCurrent();};await f.context.selectActual({schema:1,project:{id:'project1'}});assert.equal(duringPolicy,false);assert.equal(c.isCurrent(),false);
 const fresh=capture(f);await f.context.selectActual({schema:1,project:{id:'project2'}});await f.context.selectActual({schema:1,project:{id:'project1'}});assert.equal(fresh.isCurrent(),false);
});
scenario('actual failed selection preserves owner and accepted-unconfirmed publication retires it',async()=>{
 const f=fixture();f.commits();const c=capture(f);f.state.write=async()=>{throw Error('before pointer commit');};await assert.rejects(f.context.selectActual({schema:1,project:{id:'project2'}}));assert.equal(c.isCurrent(),true);
 f.state.write=async(_path,_bytes,options)=>{await options.fault('after-rename');throw Error('after pointer commit');};await assert.rejects(f.context.selectActual({schema:1,project:{id:'project1'}},{isCurrent:()=>true}),error=>error.code==='SELECTION_UNCONFIRMED');assert.equal(c.isCurrent(),false);assert.equal(f.context.mode,'recovery');assert.equal(f.context.snapshot,null);
});
scenario('actual pickProject to genuine selection recovery same-project and unobserved ABA rotate owner',async row=>{
 const f=fixture();f.commits();let chosen='project1';f.state.dialog=()=>Promise.resolve({canceled:false,filePaths:[win32.join(f.context.dataRoot,'Projects',chosen)]});const c=capture(f);assert.equal((await f.context.pickProjectActual()).code,'RECOVERY_REQUIRED');assert.equal(c.isCurrent(),false);assert.equal(f.context.mode,'recovery');
 f.context.mode='normal';f.context.snapshot={schema:1,project:{id:'project1'}};f.registry.activateWorkspace();const next=capture(f);for(const id of ['project2','project1']){chosen=id;assert.equal((await f.context.pickProjectActual()).code,'RECOVERY_REQUIRED');}assert.equal(next.isCurrent(),false);row.observations={actualPickProject:true,actualChangeSelection:true,genuineOpenOwnedSelection:true,actualRecoveryCommit:true,importCompletionBoundary:'explicitly inert',damagedProjectReader:'controlled refusal',workspacePreparation:'controlled inert'};
});
scenario('actual failed recovery pointer write preserves committed owner',async()=>{
 const f=fixture();f.commits();const c=capture(f);f.state.write=async()=>{throw Error('owned pointer refusal');};await assert.rejects(f.context.recoverActual('project1'));assert.equal(c.isCurrent(),true);assert.equal(f.context.mode,'normal');
});
scenario('actual failed login and failed logout rollback preserve unchanged owner',async()=>{
 for(const method of ['loginActual','logoutActual']){const f=fixture();f.commits();const c=capture(f);if(method==='loginActual')f.state.login=async()=>({ok:false});else f.state.logout=async()=>{throw Error('owned logout refusal');};try{await f.context[method]();}catch{}assert.equal(f.context.accountTransition,false);assert.equal(c.isCurrent(),true);}
});
scenario('held actual login fences policy and transient identity before rollback',async()=>{
 const f=fixture();f.commits();const c=capture(f),held=deferred(),entered=deferred();f.state.login=async()=>{f.context.account.accountId='transient';entered.resolve();await held.promise;f.context.account.accountId='account1';return {ok:false};};const q=f.context.loginActual();await entered.promise;assert.equal(c.isCurrent(),true);assert.equal(f.carrier.canExecute(f.grant()),false);held.resolve();await q;assert.equal(c.isCurrent(),true);
});
scenario('actual successful same-account login and logout retire committed incarnations',async()=>{
 for(const method of ['loginActual','logoutActual']){const f=fixture();f.commits();const c=capture(f);f.state.login=async()=>({state:'online'});f.state.logout=async()=>({state:'offline'});await f.context[method]();f.context.selectedId='project1';f.context.snapshot={project:{id:'project1'}};assert.equal(f.context.account.accountId,'account1');assert.equal(c.isCurrent(),false);}
});
scenario('actual successful account A to B to A without intermediate lifetime query retires owner',async()=>{
 const f=fixture();f.commits();const c=capture(f);for(const id of ['account2','account1']){f.state.login=async()=>{f.context.account.accountId=id;return {state:'online'};};await f.context.loginActual();f.context.selectedId='project1';f.context.snapshot={project:{id:'project1'}};}assert.equal(c.isCurrent(),false);
});
scenario('fresh environment projects allowlisted own DATA including actual host-object prototype shape',()=>{
 const f=fixture();let hooks=0;const env=Object.assign(Object.create({inherited:'ignored'}),{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32',TEMP:'C:\\One',NODE_OPTIONS:'secret'});Object.defineProperty(env,'API_SECRET',{enumerable:true,get(){hooks++;throw Error('secret');}});f.context.process.env=env;
 const first=f.carrier.readEnvironment();assert(Object.isFrozen(first));assert.equal(Object.getPrototypeOf(first),null);assert.deepEqual(Object.keys(first),['SystemRoot','PATH','TEMP']);assert.equal(hooks,0);env.TEMP='C:\\Two';const second=f.carrier.readEnvironment();assert.notEqual(first,second);assert.equal(first.TEMP,'C:\\One');assert.equal(second.TEMP,'C:\\Two');
});
scenario('environment aliases selected getters proxies Promise malformed Unicode NUL and budgets refuse',()=>{
 const changes=[e=>{e.Path='alias';},e=>Object.defineProperty(e,'PATH',{enumerable:true,get(){throw Error('GETTER_MUST_NOT_RUN');}}),e=>{e.PATH='bad\0';},e=>{e.PATH='\ud800';},e=>{e.PATH='x'.repeat(32768);},e=>{delete e.SystemRoot;},e=>{for(let i=0;i<513;i++)e['unknown'+i]='value';}];
 for(const change of changes){const f=fixture();change(f.context.process.env);assert.throws(()=>f.carrier.readEnvironment(),/TERMINAL_MAIN_ENVIRONMENT_REFUSED/);}
 for(const value of [Promise.resolve({}),new Proxy({},{ownKeys(){throw Error('TRAP_MUST_NOT_RUN');}})]){const f=fixture();f.context.process.env=value;assert.throws(()=>f.carrier.readEnvironment(),/TERMINAL_MAIN_ENVIRONMENT_REFUSED/);}
});
scenario('workspace picker parent is exact owned live frame and closed options only',async()=>{
 const f=fixture();assert.equal(f.carrier.parentForWebContents(f.window.webContents),f.window);assert.equal(f.carrier.parentForWebContents(ownedWindow().webContents),null);assert.equal(f.carrier.parentForWebContents(new Proxy(f.window.webContents,{})),null);
 f.state.dialog=()=>Promise.resolve(f.data('{canceled:false,filePaths:["C:\\\\Work"]}'));const r=await f.carrier.showOpenDialog(f.window,f.data('{properties:["openDirectory"]}'));assert.equal(r.canceled,false);assert.deepEqual(Array.from(r.filePaths),['C:\\Work']);assert(Object.isFrozen(r));assert(Object.isFrozen(r.filePaths));
 for(const expression of ['{properties:["openFile"]}','{properties:["openDirectory"],defaultPath:"C:\\\\selected"}','{properties:[,"openDirectory"]}','{get properties(){throw Error("getter")}}'])await assert.rejects(f.carrier.showOpenDialog(f.window,f.data(expression)),/TERMINAL_MAIN_DIALOG_REFUSED/);
 await assert.rejects(f.carrier.showOpenDialog(ownedWindow(),f.data('{properties:["openDirectory"]}')));f.window.webContents.mainFrame={url:'siren://app/app.html',processId:10,routingId:20};assert.equal(f.carrier.parentForWebContents(f.window.webContents),null);
});
scenario('malformed dialog DATA refuses and stale held parent cannot publish returned paths',async()=>{
 for(const expression of ['{canceled:false,filePaths:["ok"],extra:true}','{canceled:false,filePaths:["bad\\u0000"]}','{canceled:false,filePaths:[,,]}','{canceled:false,get filePaths(){throw Error("getter")}}']){const f=fixture();f.state.dialog=()=>Promise.resolve(f.data(expression));await assert.rejects(f.carrier.showOpenDialog(f.window,f.data('{properties:["openDirectory"]}')),/TERMINAL_MAIN_DIALOG_REFUSED/);}
 const f=fixture(),held=deferred();f.state.dialog=()=>held.promise;const q=f.carrier.showOpenDialog(f.window,f.data('{properties:["openDirectory"]}'));f.registry.invalidateEpoch({preserveWorkspace:false});held.resolve(f.data('{canceled:false,filePaths:["C:\\\\Work"]}'));await assert.rejects(q,/TERMINAL_MAIN_DIALOG_REFUSED/);
});
scenario('reentrant parent retirement keeps actual entered dialog pending until its reply settles',async()=>{
 const f=fixture(),held=deferred();let done=false;f.state.dialog=()=>{f.registry.invalidateEpoch({preserveWorkspace:true});f.context.pinTransition=true;f.window.webContents.mainFrame={url:'siren://app/app.html',processId:10,routingId:20};return held.promise;};const result=f.carrier.showOpenDialog(f.window,f.data('{properties:["openDirectory"]}')).then(v=>({value:v}),error=>({error})).finally(()=>{done=true;});await delay();assert.equal(done,false);held.resolve(f.data('{canceled:true,filePaths:[]}'));assert((await result).error);assert.equal(done,true);
});
scenario('genuine surface placement resolves attached and detached actual picker parents',async()=>{
 const f=fixture();let surface;
 class BaseWindow{constructor(){return ownedWindow();}}
 class ContentsView{constructor(){this.webContents=ownedWindow().webContents;}setBounds(){}setVisible(){}}
 f.state.createWindow=request=>{surface=createWorkspaceSurface({BaseWindow,WebContentsView:ContentsView,host:f.window,isCurrent:()=>true});surface.webContents.mainFrame.url=request.mainFrameUrl;return surface.window;};
 await f.registry.openView({role:'terminal',entityId:'terminal1'});assert.equal(f.carrier.parentForWebContents(surface.webContents),surface.window);assert.equal(surface.attach(),true);assert.equal(f.carrier.parentForWebContents(surface.webContents),f.window);assert.equal(surface.detach(),true);assert.equal(f.carrier.parentForWebContents(surface.webContents),surface.window);
 f.context.nativeShells.clear();assert.equal(f.carrier.parentForWebContents(surface.webContents),null);await surface.dispose();
});

async function genuineProvider(f,row){
 const root=join(process.argv[2]?dirname(process.argv[2]):fileURLToPath(new URL('../../../qa-fixtures/',import.meta.url)),'provider-resources-'+randomUUID());await mkdir(root,{recursive:true});const pins={};
 for(const name of DESKTOP_NATIVE_RESOURCE_PATHS){const body=Buffer.from('INERT MAIN-CARRIER RESOURCE DATA ONLY: '+name+'\n'),path=join(root,...name.split('/'));await mkdir(dirname(path),{recursive:true});await writeFile(path,body,{flag:'wx'});pins[name]=createHash('sha256').update(body).digest('hex');}
 const receipt=await captureDesktopNativeRuntimeResources({directory:root,pins}),cache=new Map();let loads=0,queries=0;
 const sources={providers:await readFile(new URL('../src/terminal/desktop-native-providers.mjs',import.meta.url),'utf8'),lifetime:await readFile(new URL('../src/terminal/provider-lifetime.mjs',import.meta.url),'utf8')};
 async function synthetic(name,exports){if(cache.has(name))return cache.get(name);const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value]of Object.entries(exports))this.setExport(key,value);},{context:f.context,identifier:'controlled:'+name});cache.set(name,m);return m;}
 f.context.controlledFilesystemQuery=()=>{queries++;throw Error('UNEXPECTED_FILESYSTEM_QUERY');};
 const loader=()=>{loads++;return f.evalSource('Promise.resolve({retire:()=>Promise.resolve({retired:true,actualSettled:true,pending:0}),inspectDirectory:controlledFilesystemQuery,inspectFile:controlledFilesystemQuery,getSystemDirectory:controlledFilesystemQuery})');};
 async function link(name){
  if(name==='node:util')return synthetic(name,{types});if(name==='node:path')return synthetic(name,{win32});
  if(name==='../windows/registry.mjs')return synthetic(name,{WindowRegistry});
  if(name==='./desktop-native-filesystem.mjs')return synthetic(name,{loadDesktopNativeFilesystemProvider:loader});
  if(name==='./desktop-native-runtime-resources.mjs')return synthetic(name,{desktopNativeRuntimeResourcePaths});
  if(name==='./provider-lifetime.mjs'){if(cache.has(name))return cache.get(name);const m=new vm.SourceTextModule(sources.lifetime,{context:f.context,identifier:new URL('../src/terminal/provider-lifetime.mjs',import.meta.url).href});cache.set(name,m);await m.link(link);return m;}
  throw Error('UNEXPECTED_PROVIDER_IMPORT:'+name);
 }
 const module=new vm.SourceTextModule(sources.providers,{context:f.context,identifier:new URL('../src/terminal/desktop-native-providers.mjs',import.meta.url).href});await module.link(link);await module.evaluate();
 const incarnation=capture(f);f.context.testCarrier=f.carrier;f.context.testReceipt=receipt;f.context.testRuntimeDirectory=root;f.context.testIncarnation=incarnation;
 const options=f.evalSource('({registry:windowRegistry,projectId:selectedId,runtimeDirectory:testRuntimeDirectory,dataDirectory:dataRoot,privateEnvironmentKeys:testCarrier.privateEnvironmentKeys,parentForWebContents:testCarrier.parentForWebContents,showOpenDialog:testCarrier.showOpenDialog,readEnvironment:testCarrier.readEnvironment,isUnlocked:testCarrier.isUnlocked,getMode:testCarrier.getMode,canExecute:testCarrier.canExecute,assertResourcesCurrent:(context,receipt)=>context.registry===windowRegistry&&context.projectId===selectedId&&receipt===testReceipt&&testIncarnation.isCurrent()})');
 const binding=module.namespace.createDesktopNativeProviders(options),providers=await binding.providers(f.makeContext(f.grant()),receipt);
 row.observations={genuineProviderSourceUnmodified:true,sameCanonicalWindowRegistry:true,actualFilesystemLoads:0,inertFilesystemLoadingBoundaryCalls:loads,realNativeActivation:false,resourceKind:receipt.scope,resourceNativeAdmission:receipt.nativeExecutionAdmitted,resourceDirectory:root};
 return {binding,providers,loads,queries:()=>queries};
}
scenario('carrier to genuine provider held picker refuses stale admission after awaited reply',async row=>{
 const f=fixture(),g=f.grant(),p=await genuineProvider(f,row),held=deferred(),entered=deferred();f.state.dialog=()=>{entered.resolve();return held.promise;};
 const request=p.providers.cwd.pickDirectory(g);await entered.promise;f.context.pinTransition=true;held.resolve(f.data('{canceled:false,filePaths:["C:\\\\Work"]}'));await assert.rejects(request,/DESKTOP_PROVIDERS_SENDER_REFUSED/);assert.equal(p.loads,1);assert.equal(p.queries(),0);row.observations.controlledFilesystemQueryAttempts=p.queries();assert.equal((await p.binding.retire()).actualSettled,true);
});
scenario('carrier to genuine provider current picker returns data through exact actual dialog',async row=>{
 const f=fixture(),p=await genuineProvider(f,row);f.state.dialog=()=>Promise.resolve(f.data('{canceled:false,filePaths:["C:\\\\Work"]}'));const answer=await p.providers.cwd.pickDirectory(f.grant());assert.equal(answer.canceled,false);assert.deepEqual(Array.from(answer.filePaths),['C:\\Work']);row.observations.controlledFilesystemQueryAttempts=p.queries();assert.equal((await p.binding.retire()).actualSettled,true);
});
scenario('explicit addon child-process and utility traps have zero attempts with unavailable owner unchanged',()=>{assert.deepEqual(counters,{nativeRequire:0,nativeFork:0,utilityFork:0,nativeProviderStart:0,nativeOwnerStart:0});assert.deepEqual(activationAttempts,[]);});
scenario('independent counterexample reentrant getURL frame replacement must refuse old incarnation',row=>{
 const f=fixture(),c=capture(f),contents=f.window.webContents,previous=contents.mainFrame;
 contents.getURL=()=>{contents.mainFrame={...previous};return previous.url;};
 const answer=c.isCurrent();row.observations={frameReplacedDuringTrustedGetURL:contents.mainFrame!==previous,returnedCurrent:answer};
 assert.equal(answer,false,'REENTRANT_LIVE_MAINFRAME_REPLACEMENT_MUST_REFUSE');
 contents.mainFrame=previous;contents.getURL=()=>previous.url;assert.equal(c.isCurrent(),false,'Actual replacement remains sticky after restoration');
});
scenario('independent counterexample second appReady call fencing input must refuse incarnation capture',row=>{
 for(const key of ['pinTransition','unlocked','workspaceBarrier']){
  const f=fixture();let readyCalls=0;f.state.appHook=()=>{if(++readyCalls===2){if(key==='unlocked')f.state.pin=false;else f.context[key]=true;}};
  const captured=f.carrier.captureIncarnation(f.makeContext(f.grant()));
  row.observations??=[];row.observations.push({key,readyCalls,captureReturned:captured!==null});
  assert.equal(captured,null,'APP_READY_REENTRY_FENCED_POLICY_MUST_REFUSE_CAPTURE');
 }
});
scenario('independent counterexample final parent destruction query retiring admission must refuse parent',row=>{
 const f=fixture(),contents=f.window.webContents,grant=f.grant();let directQueries=0,fired=false;
 contents.isDestroyed=function(){const direct=String(new Error().stack).split('\n')[2]||'';if(direct.includes('nativeParentFor')&&++directQueries===2){fired=true;f.registry.invalidateEpoch({preserveWorkspace:true});}return false;};
 const parent=f.carrier.parentForWebContents(contents);
 row.observations={directQueries,retirementHookFired:fired,oldGrantCurrent:f.registry.isCurrent(grant),returnedWorkspace:parent===f.window};
 assert.equal(fired,true,'FIXTURE_FINAL_DIRECT_DESTRUCTION_QUERY_REQUIRED');
 assert.equal(parent,null,'POST_QUERY_RETIRED_ADMISSION_MUST_REFUSE_PARENT');
});
scenario('residual counterexample getURL destroys owned handles and must retire incarnation',row=>{
 const f=fixture(),c=capture(f),contents=f.window.webContents,url=contents.mainFrame.url;
 contents.getURL=()=>{f.window.destroy();return url;};const current=c.isCurrent();
 row.observations={ownerDestroyed:f.window.destroyed,contentsDestroyed:contents.destroyed,returnedCurrent:current};
 assert.equal(current,false,'DESTRUCTION_DURING_GET_URL_MUST_REFUSE');assert.equal(c.isCurrent(),false);
});
scenario('residual counterexample final PIN query changing account identity must refuse capture',row=>{
 const f=fixture();let queries=0;f.state.pinHook=()=>{if(++queries===7)f.context.account.accountId='different';};
 const result=f.carrier.captureIncarnation(f.makeContext(f.grant()));row.observations={queries,captured:result!==null,accountIdChanged:f.context.account.accountId!=='account1'};
 assert.equal(result,null,'FINAL_PIN_QUERY_OWNER_IDENTITY_CHANGE_MUST_REFUSE');
});
scenario('residual counterexample final seventh PIN query changing routing identity must refuse capture',row=>{
 const f=fixture();let queries=0;f.state.pinHook=()=>{if(++queries===7)f.window.webContents.mainFrame.routingId++;};
 const result=f.carrier.captureIncarnation(f.makeContext(f.grant()));row.observations={queries,captured:result!==null,routingChanged:f.window.webContents.mainFrame.routingId!==20};
 assert.equal(result,null,'FINAL_PIN_ROUTING_CHANGE_MUST_REFUSE');
});
