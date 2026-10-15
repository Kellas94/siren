import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {win32} from 'node:path';
import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {EventEmitter} from 'node:events';
import {createHook} from 'node:async_hooks';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {CwdAuthority} from '../src/terminal/cwd.mjs';
import {createShellProfileCatalogue} from '../src/terminal/profiles.mjs';
import {supportedProviderPromise} from '../src/terminal/provider-lifetime.mjs';
import {captureDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
const url=new URL('../src/terminal/desktop-native-providers.mjs',import.meta.url);
let source='';try{source=await readFile(url,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
const fsSource=await readFile(new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
const identity=p=>'0000000000000001:'+createHash('sha256').update(p.toLowerCase()).digest('hex').slice(0,32);
const ancestry=p=>{const root=win32.parse(p).root,parts=p.slice(root.length).split('\\').filter(Boolean);return [root,...parts.map((_,i)=>win32.join(root,...parts.slice(0,i+1)))].map(path=>({path,identity:identity(path),directory:true,reparse:false}));};
const guarded=v=>Object.defineProperty(v,'then',{value:undefined});
const directory=p=>guarded({canonicalPath:p,identity:identity(p),directory:true,reparse:false,ancestors:ancestry(p)});
const file=p=>guarded({canonicalPath:p,identity:identity(p),file:true,reparse:false,ancestors:ancestry(win32.dirname(p))});
function isolated(loader){
 assert(source,'Missing MAIN-private concrete providers binding');
 const body=source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
 return vm.runInThisContext('(function(types,path,WindowRegistry,loadDesktopNativeFilesystemProvider,supportedProviderPromise,desktopNativeRuntimeResourcePaths){'+body+'\nreturn createDesktopNativeProviders;})')(types,win32,WindowRegistry,loader,supportedProviderPromise,desktopNativeRuntimeResourcePaths);
}
function concreteLoader(s){
 const body=fsSource.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify(new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url).href));
 return vm.runInThisContext('(function(types,createRequire,fileURLToPath,URL){'+body+'\nreturn loadDesktopNativeFilesystemProvider;})')(types,()=>()=>{s.loads++;return {createFilesystemInspector:()=>s.native};},fileURLToPath,URL);
}
let resources;
async function resource(){
 if(resources)return resources;
 const directory=resolve('terminal-desktop-native-providers-20261012/fixtures/runtime'),pins={};
 await mkdir(directory,{recursive:true});for(const p of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...p.split('/')),bytes=Buffer.from('INERT '+p);await mkdir(win32.dirname(target),{recursive:true});await writeFile(target,bytes);pins[p]=createHash('sha256').update(bytes).digest('hex');}
 resources=await captureDesktopNativeRuntimeResources({directory,pins});return resources;
}
async function setup(change=()=>{}){
 const receipt=await resource(),s={loads:0,nativeCalls:[],retireCalls:0,dialogs:[],unlocked:true,current:true,mode:'normal',execute:true,selected:'C:\\Work\\chosen',env:{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32;C:\\Windows',PATHEXT:'.COM;.EXE;.BAT;.CMD',TEMP:'C:\\Temp',TMP:'C:\\Temp',PSModulePath:'DO_NOT_COPY',OPENAI_API_KEY:'DO_NOT_COPY',NODE_OPTIONS:'DO_NOT_COPY'}};
 const window=new EventEmitter();window.id=902;window.webContents=new EventEmitter();Object.assign(window.webContents,{id:1902,mainFrame:{url:'siren://app/app.html'},isDestroyed:()=>false,getURL:()=>window.webContents.mainFrame.url});Object.assign(window,{isDestroyed:()=>false,isMinimized:()=>false,focus(){},restore(){}});
 const views=[];const registry=new WindowRegistry({terminalViews:true,createWindow:request=>{const w=new EventEmitter();w.id=903+views.length;w.webContents=new EventEmitter();Object.assign(w.webContents,{id:1903+views.length,mainFrame:{url:request.mainFrameUrl},getURL:()=>w.webContents.mainFrame.url,isDestroyed:()=>false});Object.assign(w,{isDestroyed:()=>false,isMinimized:()=>false,focus(){},restore(){},close(){w.emit('closed');},destroy(){w.emit('closed');}});views.push(w);return w;},authorize:request=>({projectId:'project1',mode:'normal',access:'write',entityIds:request.entityId?[request.entityId]:[]})});registry.bindWorkspace(window);registry.activateWorkspace();
 const grant=registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
 Object.assign(s,{window,registry,views,grant,receipt,context:Object.freeze({registry,projectId:'project1',grant})});
 s.native={getSystemDirectory:async()=>{s.nativeCalls.push('system');return 'C:\\Windows\\System32';},inspectDirectory:async p=>{s.nativeCalls.push(p);return directory(p);},inspectFile:async p=>{s.nativeCalls.push(p);return file(p);},retire:()=>{s.retireCalls++;return Promise.resolve(guarded({retired:true,actualSettled:true,pending:0}));}};
 s.options={registry,projectId:'project1',runtimeDirectory:desktopNativeRuntimeResourcePaths(receipt).directory,dataDirectory:'C:\\SIREN\\Data',privateEnvironmentKeys:[],parentForWebContents:sender=>{assert.equal(sender,window.webContents);return window;},showOpenDialog:(parent,options)=>{assert.equal(parent,window);s.dialogs.push(options);return Promise.resolve({canceled:false,filePaths:[s.selected]});},readEnvironment:()=>s.env,isUnlocked:()=>s.unlocked,getMode:()=>s.mode,canExecute:()=>s.execute,assertResourcesCurrent:(context,r)=>context.registry===registry&&context.projectId==='project1'&&r===receipt&&s.current};
 change(s);s.binding=isolated(s.loader??concreteLoader(s))(s.options);return s;
}
const providers=s=>s.binding.providers(s.context,s.receipt);
function authority(s,p){return new CwdAuthority({...p.cwd,authorize:g=>s.registry.isCurrent(g)&&s.unlocked,captureAdmission:g=>s.registry.captureAdmissionGuard(g)});}
function catalogue(s,p){return createShellProfileCatalogue({...p.profiles,authorize:()=>s.unlocked&&s.current,captureAdmission:()=>s.registry.captureAdmissionGuard(s.grant)});}
test('actual module import is inert and rejects unconfigured construction',async()=>{const m=await import('../src/terminal/desktop-native-providers.mjs');assert.deepEqual(Object.keys(m),['createDesktopNativeProviders']);assert.throws(()=>m.createDesktopNativeProviders(),/DESKTOP_PROVIDERS_REFUSED/);});
test('binding construction is inert and providers validates genuine context and resource receipt',async()=>{const s=await setup();assert.equal(s.loads,0);assert.equal(s.dialogs.length,0);for(const c of [{...s.context,registry:{}},{...s.context,grant:{...s.grant}},{...s.context,projectId:'other'}])await assert.rejects(s.binding.providers(c,s.receipt));await assert.rejects(s.binding.providers(s.context,{...s.receipt}));assert.equal(s.loads,0);const p=await providers(s);assert.deepEqual(Object.keys(p).sort(),['cwd','policy','profiles']);assert.equal(p.profiles.modulePathPolicy,'system-seeded');assert.equal(s.loads,1);assert.equal((await s.binding.retire()).actualSettled,true);});
test('actual Cwd and seeded catalogue use fixed adapter and preserve explicit folder/env boundaries',async()=>{const s=await setup(),p=await providers(s),a=authority(s,p),c=catalogue(s,p);const picked=await a.pick(s.grant);assert.equal(await a.resolve(s.grant,picked.cwdId),s.selected);assert.equal(s.dialogs.length,1);assert.deepEqual(Object.keys(s.dialogs[0]),['properties']);assert.deepEqual(s.dialogs[0].properties,['openDirectory']);const shell=await c.resolveShellProfile('powershell');assert.equal(shell.env.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');assert(!Object.hasOwn(shell.env,'NODE_OPTIONS'));assert(!Object.hasOwn(shell.env,'OPENAI_API_KEY'));assert.equal(shell.env.PATH,s.env.PATH);assert(s.nativeCalls.includes(shell.env.PSModulePath));c.dispose();await a.retireCwd().actualSettled;await s.binding.retire();});
test('stale held dialog cannot publish and binding retirement retains actual pending dialog',async()=>{const held=deferred();const s=await setup(s=>{s.options.showOpenDialog=()=>held.promise;}),p=await providers(s),a=authority(s,p);const pick=a.pick(s.grant);await tick();let done=false;const retired=s.binding.retire().then(r=>{done=true;return r;});assert.equal(s.retireCalls,1);await tick();assert.equal(done,false);held.resolve({canceled:false,filePaths:[s.selected]});await assert.rejects(pick);assert.equal((await retired).actualSettled,true);await a.retireCwd().actualSettled;});
test('constructor refuses descriptors/proxies/extra selectors and private module denial before loader',async()=>{
 let hooks=0;const s=await setup(),factory=isolated(()=>{throw Error('must not load');});const revoked=Proxy.revocable({},{});revoked.revoke();
 for(const option of [revoked.proxy,{...s.options,loader:()=>{}},{...s.options,runtimeDirectory:'relative'},{...s.options,privateEnvironmentKeys:['PSModulePath']},{...s.options,privateEnvironmentKeys:['TEMP','temp']},{...s.options,get readEnvironment(){hooks++;return ()=>s.env;}},{...s.options,isUnlocked:new Proxy(()=>true,{apply(){hooks++;return true;}})}])assert.throws(()=>factory(option));
 assert.equal(hooks,0);assert.equal(s.loads,0);assert.equal((await s.binding.retire()).actualSettled,true);
});
test('genuine resource mismatch and copied registry methods cannot forge admission',async()=>{
 const s=await setup();const factory=isolated(concreteLoader(s)),other=factory({...s.options,runtimeDirectory:'C:\\AnotherRuntime'});await assert.rejects(other.providers(s.context,s.receipt));assert.equal(s.loads,0);await other.retire();
 s.registry.isCurrent=()=>{throw Error('hostile override');};s.registry.eventFor=()=>{throw Error('hostile override');};await assert.rejects(providers(s));assert.equal(s.loads,0);await s.binding.retire();
});
test('dialog parent derives requesting genuine event, cancellation has no cwd fallback',async()=>{
 const s=await setup(s=>{s.options.showOpenDialog=()=>Promise.resolve({canceled:true,filePaths:[]});}),p=await providers(s),a=authority(s,p);
 await assert.rejects(a.pick(s.grant),e=>e.code==='CANCELLED');assert.deepEqual(s.nativeCalls,[]);
 for(const g of [{...s.grant},{...s.grant,role:'code'},{...s.grant,projectId:'other'}])await assert.rejects(p.cwd.pickDirectory(g));assert.deepEqual(s.nativeCalls,[]);await a.retireCwd().actualSettled;await s.binding.retire();
});
test('dialog lookup and policy callbacks cannot reentrantly revoke then authorize',async()=>{
 for(const hook of ['parentForWebContents','getMode','canExecute']){
  let s;const held=await setup(x=>{const original=x.options[hook];x.options[hook]=(...args)=>{x.registry.invalidateEpoch({preserveWorkspace:true});return original(...args);};});s=held;const p=await providers(s);await assert.rejects(p.cwd.pickDirectory(s.grant));assert.equal(s.dialogs.length,0);await s.binding.retire();
 }
});
test('Lock and epoch invalidation during dialog refuse late results without inspecting selected path',async()=>{
 for(const cause of ['lock','epoch','project']){const held=deferred(),s=await setup(s=>{s.options.showOpenDialog=()=>held.promise;}),p=await providers(s),a=authority(s,p);const q=a.pick(s.grant);await tick();if(cause==='lock')s.unlocked=false;else if(cause==='epoch')s.registry.invalidateEpoch({preserveWorkspace:true});else s.current=false;held.resolve({canceled:false,filePaths:[s.selected]});await assert.rejects(q);assert.deepEqual(s.nativeCalls,[]);await a.retireCwd().actualSettled;await s.binding.retire();}
});
test('readonly/protected runtime/Data and late directory changes remain genuine Cwd refusals',async()=>{
 const s=await setup(),p=await providers(s),a=authority(s,p);s.mode='readonly';await assert.rejects(a.pick(s.grant));assert.equal(s.dialogs.length,0);s.mode='normal';
 for(const protectedPath of [s.options.dataDirectory+'\\nested',s.options.runtimeDirectory+'\\nested']){s.selected=protectedPath;await assert.rejects(a.pick(s.grant),e=>e.code==='CWD_REFUSED');}
 s.selected='C:\\Work\\selected';const selected=await a.pick(s.grant);s.current=false;await assert.rejects(a.resolve(s.grant,selected.cwdId));await a.retireCwd().actualSettled;await s.binding.retire();
});
test('literal environment allowlist does not read unknown secret accessors, preserves order and private denial',async()=>{
 let hooks=0;const s=await setup(s=>{s.options.privateEnvironmentKeys=['USERNAME'];s.env.USERNAME='private';Object.defineProperty(s.env,'API_SECRET',{enumerable:true,get(){hooks++;throw Error('secret');}});Object.defineProperty(s.env,'PSModulePath',{enumerable:true,get(){hooks++;throw Error('module secret');}});}),p=await providers(s);
 const first=await p.profiles.readEnvironment();assert.deepEqual(Object.keys(first),['SystemRoot','PATH','PATHEXT','TEMP','TMP']);assert.equal(hooks,0);assert.equal(Object.getPrototypeOf(first),null);assert(Object.isFrozen(first));s.env.PATHEXT='.EXE';assert.equal((await p.profiles.readEnvironment()).PATHEXT,'.EXE');assert.equal(first.PATHEXT,'.COM;.EXE;.BAT;.CMD');await s.binding.retire();
});
test('selected environment accessors/aliases/proxies/Unicode/NUL and caps fail without coercion',async()=>{
 const variants=[s=>Object.defineProperty(s.env,'PATH',{enumerable:true,get(){throw Error('getter invoked');}}),s=>{s.env.Path='alias';},s=>{s.env.PATH='bad\0path';},s=>{s.env.PATH='\ud800';},s=>{s.env.PATH='x'.repeat(32768);},s=>{s.env=new Proxy(s.env,{ownKeys(){throw Error('proxy invoked');}});},s=>{for(let i=0;i<513;i++)s.env['unknown'+i]='x';}];
 for(const change of variants){const s=await setup(change),p=await providers(s);await assert.rejects(p.profiles.readEnvironment(),e=>e.message==='DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');await s.binding.retire();}
});
test('private callback errors/getters cannot expose text and unsupported pending environment is unknown',async()=>{
 let hooks=0;const s=await setup(s=>{s.options.readEnvironment=()=>{throw {get message(){hooks++;return 'PRIVATE';},get code(){hooks++;return 'PRIVATE';}};};}),p=await providers(s);await assert.rejects(p.profiles.readEnvironment(),e=>e.message==='DESKTOP_PROVIDERS_REFUSED');assert.equal(hooks,0);await s.binding.retire();
 const held=deferred(),q=await setup(s=>{s.options.readEnvironment=()=>held.promise;}),r=await providers(q);await assert.rejects(r.profiles.readEnvironment(),/SETTLEMENT_UNKNOWN/);await assert.rejects(q.binding.retire(),/RETIREMENT_UNKNOWN/);assert.equal(q.binding.snapshot().unknown,true);held.resolve({});
});
test('one load attempt and eight charged held dialogs refuse excess without abandoning joins',async()=>{
 const held=deferred(),s=await setup(s=>{s.options.showOpenDialog=()=>held.promise;}),p=await providers(s);await assert.rejects(providers(s));const work=Array.from({length:8},()=>p.cwd.pickDirectory(s.grant));await tick();assert.equal(s.binding.snapshot().pending,8);await assert.rejects(p.cwd.pickDirectory(s.grant),/CAPACITY/);let settled=false;const retired=s.binding.retire().then(r=>{settled=true;return r;});await tick();assert.equal(settled,false);held.resolve({canceled:true,filePaths:[]});await Promise.all(work.map(q=>assert.rejects(q)));assert.equal((await retired).actualSettled,true);assert.equal(s.retireCalls,1);assert.equal(s.loads,1);
});
test('held load retirement requests captured adapter retirement and never publishes late providers',async()=>{
 const held=deferred();let retireCalls=0;const adapter={retire:()=>{retireCalls++;return Promise.resolve(Object.freeze({retired:true,actualSettled:true,pending:0}));}};
 const s=await setup(s=>{s.loader=()=>held.promise;}),work=providers(s);await tick();const p=s.binding.retire();assert.equal(retireCalls,0);held.resolve(adapter);await assert.rejects(work,/START_REFUSED/);assert.equal(retireCalls,1);assert.equal((await p).actualSettled,true);
});
test('unknown loader or native retirement never becomes verified, retry is refused',async()=>{
 for(const variant of ['load','retire']){const s=await setup(s=>{if(variant==='load')s.loader=()=>Promise.reject(Error('PRIVATE'));else s.native.retire=()=>Promise.resolve(guarded({retired:true,actualSettled:false,pending:1}));});if(variant==='load')await assert.rejects(providers(s),/START_REFUSED/);else await providers(s);await assert.rejects(s.binding.retire(),/RETIREMENT_UNKNOWN/);assert.equal(s.binding.snapshot().unknown,true);await assert.rejects(providers(s));}
});
test('retirement Promise is stable under actual Promise-init reentry without native duplicate retirement',async()=>{
 const s=await setup();await providers(s);let inner,armed=true;const hook=createHook({init(_id,type){if(type==='PROMISE'&&armed){armed=false;inner=s.binding.retire();}}});hook.enable();let outer;try{outer=s.binding.retire();}finally{hook.disable();}assert.equal(inner,outer);assert.equal(s.retireCalls,1);assert.equal((await outer).actualSettled,true);
});
test('resource guard retirement and post-await native results cannot revive local provider authority',async()=>{
 let binding,armed=false;const s=await setup(s=>{const prior=s.options.assertResourcesCurrent;s.options.assertResourcesCurrent=(...args)=>{if(armed)binding.retire();return prior(...args);};});binding=s.binding;const p=await providers(s);armed=true;await assert.rejects(p.profiles.getSystemDirectory());assert.deepEqual(s.nativeCalls,[]);assert.equal((await binding.retire()).actualSettled,true);
});
test('actual registered Terminal grant chooses its own parent with no workspace fallback',async()=>{
 const s=await setup(s=>{s.options.parentForWebContents=sender=>[s.window,...s.views].find(w=>w.webContents===sender);s.options.showOpenDialog=(parent,options)=>{s.dialogs.push({parent,options});return Promise.resolve({canceled:false,filePaths:[s.selected]});}}),p=await providers(s);
 const record=await s.registry.openView({role:'terminal',entityId:'project1'}),window=s.views[0],grant=s.registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});assert.equal(grant.windowId,record.windowId);assert.equal((await p.cwd.pickDirectory(grant)).filePaths[0],s.selected);assert.equal(s.dialogs[0].parent,window);assert.notEqual(s.dialogs[0].parent,s.window);await s.binding.retire();
});
test('native query and retirement retain actual pending work before late result is refused',async()=>{
 const query=deferred(),join=deferred(),s=await setup(s=>{s.native.inspectDirectory=()=>query.promise;s.native.retire=()=>{s.retireCalls++;return join.promise;};}),p=await providers(s),work=p.cwd.inspectDirectory('C:\\Work');await tick();let done=false;const retiring=s.binding.retire().then(r=>{done=true;return r;});assert.equal(s.retireCalls,1);query.resolve(directory('C:\\Work'));await assert.rejects(work);await tick();assert.equal(done,false);join.resolve(guarded({retired:true,actualSettled:true,pending:0}));assert.equal((await retiring).actualSettled,true);
});
test('post-await resource/Modules identity changes remain catalogue refusals',async()=>{
 const held=deferred();let replaced=false;const s=await setup(s=>{s.native.inspectDirectory=async p=>{const d=directory(p);if(p.endsWith('\\Modules')&&replaced){d.identity=identity(p+'replacement');d.ancestors.at(-1).identity=d.identity;}return d;};s.native.inspectFile=async p=>{await held.promise;return file(p);};}),p=await providers(s),c=catalogue(s,p),q=c.resolveShellProfile('powershell');await tick();s.current=false;held.resolve();await assert.rejects(q);s.current=true;c.dispose();const next=catalogue(s,p);await next.resolveShellProfile('powershell');replaced=true;await assert.rejects(next.resolveShellProfile('powershell'));next.dispose();await s.binding.retire();
});
test('callback disposal before fixed load and during environment capture stays fenced',async()=>{
 let binding,armed=true;const s=await setup(s=>{const original=s.options.isUnlocked;s.options.isUnlocked=()=>{if(armed)binding.retire();return original();};});binding=s.binding;await assert.rejects(providers(s),/START_REFUSED/);assert.equal(s.loads,0);assert.equal((await binding.retire()).actualSettled,true);
 const q=await setup(s=>{s.options.readEnvironment=()=>{s.binding.retire();return s.env;};}),p=await providers(q);await assert.rejects(p.profiles.readEnvironment());assert.equal((await q.binding.retire()).actualSettled,true);assert.equal(p.policy.isUnlocked(),false);assert.equal(p.policy.getMode(q.grant),null);assert.equal(p.policy.canExecute(q.grant),false);
});
