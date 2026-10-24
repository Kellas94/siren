import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import vm from 'node:vm';
import {PinProtector} from '../src/account/pin-protection.mjs';
import {decodePinFrame,encodePinFrame} from '../src/account/pin-protocol.mjs';

// Breaks caught: early Terminal evaluation on private argv, bypassed genuine
// start, duplicate registration/consumption, package replacement, and output
// writes before collision/ancestry admission. Native leaves stay nonexecuting.
const desktop=fileURLToPath(new URL('../',import.meta.url));
const evidence=process.env.SIREN_PIN_DISPATCH_EVIDENCE_ROOT??path.resolve(desktop,'../pin-dispatch-test-evidence');
const control=process.env.SIREN_PIN_DISPATCH_CONTROL??'';
assert(['','invalid-import-instrument','invalid-child-argv'].includes(control));
const hash=b=>createHash('sha256').update(b).digest('hex');
const fixedPackage={name:'siren-terminal-candidate',version:'0.1.0-dev.1',private:true,type:'module',main:'candidate-main.mjs'};
const packageBytes=JSON.stringify(fixedPackage,null,2)+'\n';

function synthetic(context,id,values){return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context,identifier:id});}
async function fixture(){await fs.mkdir(evidence,{recursive:true});return fs.mkdtemp(path.join(evidence,'case-'));}
function counts(){return {renderer:0,copy:0,esbuild:0,layout:0,terminalEvaluations:0,startEvaluations:0,configureCalls:0,takeCalls:0,initializerCalls:0,mainLeaf:0,pinLeaf:0,controlledSpawn:0,nativeLoader:0,addon:0,fork:0,provider:0,utility:0,realChild:0,electron:0};}
async function scenario(name,body){
 const record={name,completed:false,counters:counts(),trace:[]};
 try{await body(record);record.passed=true;}catch(error){record.passed=false;record.error={name:error.name,message:error.message};throw error;}
 finally{record.completed=true;console.log('PIN_DISPATCH_SCENARIO '+JSON.stringify(record));}
}
async function builder(root,record,{fault=null}={}){
 const fixtures=path.join(root,'dependencies'),out=path.join(root,'output','nested');
 for(const [name,version,entry]of [['@xterm/xterm','6.0.0','lib/xterm.js'],['@xterm/addon-fit','0.11.0','lib/addon-fit.js'],['@xterm/addon-search','0.16.0','lib/addon-search.js']]){
  const dir=path.join(fixtures,'node_modules',name);await fs.mkdir(path.dirname(path.join(dir,entry)),{recursive:true});
  await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name,version,license:'MIT'}));await fs.writeFile(path.join(dir,entry),'/* INERT BUNDLE INPUT */');await fs.writeFile(path.join(dir,'LICENSE'),'MIT fixture notice');
  if(name==='@xterm/xterm'){await fs.mkdir(path.join(dir,'css'));await fs.writeFile(path.join(dir,'css/xterm.css'),'/* INERT CSS */');}
 }
 const context=vm.createContext({Buffer,URL,process:{platform:process.platform},console});
 const modules=new Map(),writeCalls=[];
 const fsBoundary={...fs,lstat:async file=>{
  if(fault==='observed-package-link'&&path.resolve(String(file))===path.join(out,'package.json')){record.linkObservation='inert package link observation; native creation unavailable';return {isSymbolicLink:()=>true,isDirectory:()=>false,isFile:()=>false};}
  if(fault==='observed-ancestor-link'&&path.resolve(String(file))===path.join(root,'link')){record.linkObservation='inert ancestor link observation; native creation unavailable';return {isSymbolicLink:()=>true,isDirectory:()=>true,isFile:()=>false};}
  if(fault==='unknown-observation'&&path.resolve(String(file))===path.join(root,'unknown'))throw Object.assign(Error('UNKNOWN_OBSERVATION'),{code:'EACCES'});
  return fs.lstat(file);
 },cp:async()=>{record.counters.copy++;},writeFile:async(file,bytes,options)=>{
  writeCalls.push({path:String(file),options});
  if(fault==='exclusive-collision'&&path.basename(String(file))==='package.json'&&options?.flag==='wx')await fs.writeFile(file,'COLLIDER',{flag:'wx'});
  if(fault==='corrupt-main-readback'&&path.basename(String(file))==='candidate-main.mjs')return fs.writeFile(file,String(bytes)+'// changed after write\n',options);
  return fs.writeFile(file,bytes,options);
 }};
 const renderer={buildRenderer:async({outputDir})=>{record.counters.renderer++;if(fault==='renderer-failure')throw Error('INERT_RENDERER_FAILURE');await fs.mkdir(outputDir,{recursive:true});}};
 const load=id=>{
  if(modules.has(id))return modules.get(id);
  const pending=(async()=>{
  let mod;
  if(id==='node:fs/promises')mod=synthetic(context,id,fsBoundary);
  else if(id==='esbuild')mod=synthetic(context,id,{build:async()=>{record.counters.esbuild++;return {outputFiles:[{text:'void 0;'}],metafile:{inputs:{'INERT_RENDERER_BOUNDARY':{}}}};}});
  else if(id.endsWith('/build/renderer.mjs'))mod=synthetic(context,id,renderer);
  else if(id.endsWith('/build/help.mjs'))mod=synthetic(context,id,{readHelpBrowser:async()=>''});
  else if(id.endsWith('/build/chrome.mjs'))mod=synthetic(context,id,{readDesktopChrome:async()=>''});
  else if(id.endsWith('/build/terminal-native-layout.mjs'))mod=synthetic(context,id,{buildTerminalNativeSourceLayout:async()=>{record.counters.layout++;return {nativeExecutionAdmitted:false,completeRuntimeClosure:false};}});
  else if(id.startsWith('node:'))mod=synthetic(context,id,await import(id));
  else{const text=await fs.readFile(fileURLToPath(id),'utf8');mod=new vm.SourceTextModule(text,{context,identifier:id,initializeImportMeta(meta){meta.url=id;},importModuleDynamically:async(specifier,ref)=>{const child=await load(new URL(specifier,ref.identifier).href);if(child.status==='unlinked')await child.link(link);if(child.status==='linked')await child.evaluate();return child;}});}
  return mod;
  })();modules.set(id,pending);return pending;
 };
 const link=(specifier,ref)=>load(specifier.startsWith('.')?new URL(specifier,ref.identifier).href:specifier);
 const mod=await load(pathToFileURL(path.join(desktop,'build/terminal-window.mjs')).href);await mod.link(link);await mod.evaluate();
 return {out,writeCalls,run:(options={})=>mod.namespace.buildTerminalDesktopCandidate({outputDir:out,dependenciesRoot:fixtures,baselinePath:'INERT_BASELINE',expectedSha256:'INERT_PIN',...options}),window:()=>mod.namespace.buildTerminalWindow(path.join(root,'default-window')),fixtures};
}

// Real registration/initializer/start sources run inside one module graph per
// application selection. MAIN and PIN-worker are explicit leaf boundaries;
// neither Electron nor the encryption worker is evaluated or spawned.
async function dispatch(entry,argv,record,{instrument=control}={}){
 const c=record.counters,trace=record.trace,context=vm.createContext({Buffer,URL,TextDecoder,TextEncoder,AbortController,structuredClone,console,setTimeout,clearTimeout,setImmediate,clearImmediate,queueMicrotask,process:{argv,platform:process.platform},meter:(name)=>{c[name]++;trace.push(name);}}),modules=new Map();
 let terminal=null,capability=null,configureRejected=false,takeRejected=false;
 const realFile=rel=>pathToFileURL(path.join(desktop,rel)).href;
 const mainId=realFile('src/main.mjs'),workerId=realFile('src/account/pin-worker.mjs');
 const load=id=>{
  if(modules.has(id))return modules.get(id);
  const pending=(async()=>{
  let mod;
  if(id===workerId)mod=synthetic(context,id,{selected:true});
  else if(id===mainId){
   mod=new vm.SourceTextModule(`import {takeDesktopLaunch,configureDesktopLaunch} from './desktop-launch.mjs';\nmeter('mainLeaf');const initialize=takeDesktopLaunch();\nif(initialize){meter('initializerCalls');const handlers=new Map();globalThis.actualTerminal=initialize({registry:{capture:()=>({role:'workspace'}),listViews:()=>[]},ipcMain:{handle:(channel,fn)=>handlers.set(channel,fn)},getProjectId:()=>null,isReady:()=>true});globalThis.actualCapability=handlers.get('siren:terminal-capability')({});try{configureDesktopLaunch(initialize);}catch{globalThis.configureRejected=true;}try{takeDesktopLaunch();}catch{globalThis.takeRejected=true;}}`,{context,identifier:id});
  }else if(id==='node:child_process')mod=synthetic(context,id,Object.fromEntries(['spawn','fork','exec','execFile','spawnSync'].map(name=>[name,()=>{c[name==='fork'?'fork':'realChild']++;throw Error('NATIVE_BOUNDARY_REFUSED');}])));
  else if(id==='node:module')mod=synthetic(context,id,{...(await import(id)),createRequire:()=>{
   const denied=()=>{c.nativeLoader++;c.addon++;throw Error('NATIVE_LOADER_BOUNDARY_REFUSED');};denied.resolve=denied;denied.cache=Object.create(null);return denied;
  }});
  else if(id==='electron'){c.electron++;throw Error('ELECTRON_BOUNDARY_REFUSED');}
  else if(id.startsWith('node:'))mod=synthetic(context,id,await import(id));
  else{
   assert(id.startsWith(pathToFileURL(path.join(desktop,'src')+path.sep).href),'Only unchanged source imports admitted: '+id);
   let source=await fs.readFile(fileURLToPath(id),'utf8');
   if(id.includes('/src/terminal/'))source="meter('terminalEvaluations');\n"+source;
   if(id===realFile('src/start.mjs'))source="meter('startEvaluations');\n"+source;
   if(id===realFile('src/desktop-launch.mjs')){
    for(const [anchor,name]of [['export function configureDesktopLaunch(value,preference){','configureCalls'],['export function takeDesktopLaunch(){','takeCalls']]){assert.equal(source.split(anchor).length,2,'Actual function anchor must be unique');source=source.replace(anchor,anchor+`meter('${name}');`);}
   }
   for(const [file,anchor,counter]of [
    ['src/terminal/production-provider-loader.mjs','export function loadProductionPtyProvider(...extra){','provider'],
    ['src/terminal/desktop-native-providers.mjs','export function createDesktopNativeProviders(options,...extra){','provider'],
    ['src/terminal/desktop-native-filesystem.mjs','export async function loadDesktopNativeFilesystemProvider(options,...extra){','nativeLoader'],
    ['src/terminal/desktop-native-utility-launcher.mjs','export function createDesktopNativeUtilityLauncher(value,...extra){','utility']
   ])if(id===realFile(file)){assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+`meter('${counter}');throw Error('NATIVE_FACTORY_BOUNDARY_REFUSED');`);}
   mod=new vm.SourceTextModule(source,{context,identifier:id,importModuleDynamically:dynamic});
  }
  return mod;
  })();modules.set(id,pending);return pending;
 };
 const resolveId=(specifier,ref)=>specifier.startsWith('.')?new URL(specifier,ref.identifier).href:specifier;
 const link=(specifier,ref)=>load(resolveId(specifier,ref));
 async function dynamic(specifier,ref){const id=resolveId(specifier,ref);if(id===workerId){c.pinLeaf++;trace.push('pinLeaf');}const mod=await load(id);if(mod.status==='unlinked')await mod.link(link);if(mod.status==='linked')await mod.evaluate();return mod;}
 let source=await fs.readFile(entry,'utf8');record.entrySha256=hash(source);
 if(instrument==='invalid-import-instrument'){
  // Deliberate blind import-order instrumentation must fail the same assertion
  // path even when the worker route otherwise succeeds.
  context.meter=name=>{if(name!=='terminalEvaluations'){c[name]++;trace.push(name);}};
 }
 const entryId=realFile('candidate-main.mjs'),mod=new vm.SourceTextModule(source,{context,identifier:entryId,importModuleDynamically:dynamic});
 await mod.link(link);await mod.evaluate();
 terminal=context.actualTerminal;capability=context.actualCapability;configureRejected=context.configureRejected===true;takeRejected=context.takeRejected===true;
 return {terminal,capability,configureRejected,takeRejected};
}
function workerAssertions(record){const c=record.counters;assert.equal(c.terminalEvaluations,0,'worker must branch before any Terminal module evaluation');assert.equal(c.configureCalls,0);assert.equal(c.takeCalls,0);assert.equal(c.initializerCalls,0);assert.equal(c.mainLeaf,0,'worker must not select MAIN');assert.equal(c.startEvaluations,1,'must execute genuine start dispatcher');assert.equal(c.pinLeaf,1,'must select genuine start PIN-worker leaf');}
function normalAssertions(record,result){const c=record.counters;assert(c.terminalEvaluations>0,'import-order instrumentation must observe real Terminal modules');assert.equal(c.startEvaluations,1);assert.equal(c.pinLeaf,0);assert.equal(c.mainLeaf,1);assert.equal(c.initializerCalls,1);assert.equal(c.configureCalls,2);assert.equal(c.takeCalls,2);assert(result.configureRejected);assert(result.takeRejected);assert.equal(result.terminal.snapshot().configured,false);assert.equal(result.terminal.snapshot().available,false);assert.equal(result.capability.ok,true);assert.equal(result.capability.available,false);assert(record.trace.indexOf('configureCalls')<record.trace.indexOf('startEvaluations'));}
function noNative(record){for(const key of ['nativeLoader','addon','fork','provider','utility','realChild','electron'])assert.equal(record.counters[key],0,key+' must stay inert');}

test('emitted worker argv bypasses all Terminal evaluation and selects unchanged start PIN leaf',()=>scenario('worker-private-prefix',async r=>{
 const root=await fixture(),b=await builder(root,r);await b.run();const entry=path.join(b.out,'candidate-main.mjs');await dispatch(entry,['electron.exe',b.out,'--siren-pin-worker-v1=C:/owned/Access/PinProtection'],r);workerAssertions(r);noNative(r);
}));
for(const [name,argv,worker]of [
 ['normal',['electron.exe','C:/candidate'],false],
 ['near-prefix',['electron.exe','C:/candidate','--siren-pin-worke-v1=owned'],false],
 ['exact-prefix',['electron.exe','C:/candidate','--siren-pin-worker'],true],
 ['prefix-in-executable',['--siren-pin-worker-exe','C:/candidate'],true],
 ['prefix-in-script',['electron.exe','--siren-pin-worker-script'],true]
])test('emitted entry preserves genuine argv selection: '+name,()=>scenario('argv-'+name,async r=>{
 const root=await fixture(),b=await builder(root,r);await b.run();const result=await dispatch(path.join(b.out,'candidate-main.mjs'),argv,r);if(worker)workerAssertions(r);else normalAssertions(r,result);noNative(r);
}));

test('fixed package main re-enters genuine dispatch using actual PinProtector controlled spawn argv',()=>scenario('pin-protector-package-route',async r=>{
 const root=await fixture(),b=await builder(root,r);await b.run();const packagePath=path.join(b.out,'package.json');const pkg=JSON.parse(await fs.readFile(packagePath,'utf8'));assert.deepEqual(pkg,fixedPackage);assert.equal(await fs.readFile(packagePath,'utf8'),packageBytes);
 const data=path.join(root,'owned-data'),profile=path.join(data,'Access','PinProtection'),executable=path.join(root,'inert-electron.exe');await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'Local State'),'SYNTHETIC OWNED KEY FIXTURE');await fs.writeFile(executable,'NONEXECUTABLE FIXTURE');let captured;
 const protector=new PinProtector(data,{executable,application:b.out,spawnWorker:(exe,args,options)=>{
  r.counters.controlledSpawn++;captured={exe,args:[...args],options};const child=new EventEmitter();child.stderr=new PassThrough();child.stdio=[null,null,child.stderr,new PassThrough()];child.kill=()=>{throw Error('No kill expected');};
  child.stdin=new Writable({write(bytes,encoding,done){const request=decodePinFrame(bytes);r.request={operation:request.operation,requireKey:request.requireKey,bytes:bytes.length,sha256:hash(bytes)};const response=encodePinFrame({schema:1,nonce:request.nonce,operation:request.operation,text:'controlled plaintext'});r.response={bytes:response.length,sha256:hash(response)};setImmediate(()=>{child.stdio[3].write(response);r.controlledChildClose={code:0,signal:null,kind:'CONTROLLED_STREAM_BOUNDARY_NOT_REAL_CHILD'};child.emit('close',0,null);});done();}});return child;
 }});
 assert.equal(await protector.decryptString(Buffer.from('synthetic ciphertext')),'controlled plaintext');assert.equal(captured.exe,path.resolve(executable));assert.deepEqual(captured.args,[path.resolve(b.out),'--siren-pin-worker-v1='+profile]);assert.equal(captured.options.cwd,path.dirname(executable));assert.equal(captured.options.shell,false);assert.equal(captured.options.windowsHide,true);assert.deepEqual(captured.options.stdio,['pipe','ignore','pipe','pipe']);assert.equal(Object.keys(captured.options.env).some(key=>/^(?:ELECTRON_|NODE_|VSCODE_)/i.test(key)||key==='CHROME_LOG_FILE'),false);assert.equal(r.request.requireKey,true);r.actualChildArgv=[captured.exe,...captured.args];
 const argv=[...r.actualChildArgv];if(control==='invalid-child-argv')argv[2]='--siren-pin-worke-v1='+profile;
 await dispatch(path.join(captured.args[0],pkg.main),argv,r);workerAssertions(r);assert.equal(r.counters.controlledSpawn,1);noNative(r);
}));

test('candidate on-disk receipt adds package/main pins while original returned renderer receipt stays unchanged',()=>scenario('package-receipt',async r=>{
 const root=await fixture(),b=await builder(root,r),returned=await b.run();const receipt=JSON.parse(await fs.readFile(path.join(b.out,'terminal-candidate-receipt.json'),'utf8'));
 assert.equal(receipt.candidatePackageSha256,hash(await fs.readFile(path.join(b.out,'package.json'))));assert.equal(receipt.candidateMainSha256,hash(await fs.readFile(path.join(b.out,'candidate-main.mjs'))));assert.equal(receipt.entrySha256,returned.entrySha256);assert.equal(receipt.scriptSha256,returned.scriptSha256);assert.equal(Object.hasOwn(returned,'candidatePackageSha256'),false);assert.equal(Object.hasOwn(returned,'candidateMainSha256'),false);assert.equal(Object.hasOwn(receipt,'nativeSourceLayout'),false);assert.equal(r.counters.layout,0);assert.equal(receipt.nativeFactoryConfigured,false);assert.equal(receipt.normalPackageChanged,false);assert.equal(returned.nativeAdmission,false);assert.equal(b.writeCalls[0].path,path.join(b.out,'package.json'));assert.equal(b.writeCalls[0].options.flag,'wx');noNative(r);
}));

for(const type of ['file','link-observation'])test('preexisting '+type+' package refuses before renderer or copy effects',()=>scenario('package-existing-'+type,async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:type==='file'?null:'observed-package-link'});await fs.mkdir(b.out,{recursive:true});const packagePath=path.join(b.out,'package.json'),sentinel=path.join(root,'sentinel');await fs.writeFile(sentinel,'UNCHANGED');await fs.writeFile(packagePath,'UNCHANGED');
 await assert.rejects(b.run());assert.equal(r.counters.renderer,0);assert.equal(r.counters.copy,0);assert.equal(r.counters.esbuild,0);assert.equal(await fs.readFile(sentinel,'utf8'),'UNCHANGED');assert.equal(await fs.readFile(packagePath,'utf8'),'UNCHANGED');if(type!=='file')assert(r.linkObservation);noNative(r);
}));
test('output ancestry refuses link observations, non-directory, source overlap and filesystem root before effects',()=>scenario('output-ancestry',async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:'observed-ancestor-link'}),link=path.join(root,'link'),file=path.join(root,'file');await fs.mkdir(link);await fs.writeFile(file,'UNCHANGED');
 for(const outputDir of [path.join(link,'new'),path.join(file,'new'),desktop,path.dirname(desktop),path.join(desktop,'must-not-create'),path.parse(desktop).root])await assert.rejects(b.run({outputDir}));
 assert.equal(r.counters.renderer,0);assert.equal(r.counters.copy,0);assert.equal(r.counters.esbuild,0);assert.deepEqual(await fs.readdir(link),[]);assert.equal(await fs.readFile(file,'utf8'),'UNCHANGED');assert(r.linkObservation);noNative(r);
}));
test('unknown ancestry observations refuse instead of treating permission failure as missing',()=>scenario('unknown-ancestry-observation',async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:'unknown-observation'});await assert.rejects(b.run({outputDir:path.join(root,'unknown','new')}));assert.equal(r.counters.renderer,0);assert.equal(r.counters.copy,0);noNative(r);
}));
test('exclusive package collision refuses with collider retained and no renderer/copy effects',()=>scenario('exclusive-collision',async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:'exclusive-collision'});await assert.rejects(b.run());assert.equal(await fs.readFile(path.join(b.out,'package.json'),'utf8'),'COLLIDER');assert.equal(r.counters.renderer,0);assert.equal(r.counters.copy,0);noNative(r);
}));
test('failed later build retains first package and refuses reuse of consumed root',()=>scenario('partial-output-retained',async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:'renderer-failure'});await assert.rejects(b.run(),/INERT_RENDERER_FAILURE/);assert.equal(await fs.readFile(path.join(b.out,'package.json'),'utf8'),packageBytes);await assert.rejects(b.run());assert.equal(r.counters.renderer,1);assert.equal(r.counters.copy,0);noNative(r);
}));
test('main readback mismatch rejects instead of issuing a successful candidate receipt',()=>scenario('readback-mismatch',async r=>{
 const root=await fixture(),b=await builder(root,r,{fault:'corrupt-main-readback'});await assert.rejects(b.run());await assert.rejects(fs.readFile(path.join(b.out,'terminal-candidate-receipt.json')),e=>e.code==='ENOENT');assert.equal(await fs.readFile(path.join(b.out,'package.json'),'utf8'),packageBytes);noNative(r);
}));
test('source-layout opt-in remains explicit and default standalone window route emits no package',()=>scenario('layout-and-default-preserved',async r=>{
 const root=await fixture(),b=await builder(root,r);const receipt=await b.window();assert.equal(receipt.constructorsBundled,false);assert.equal(receipt.nativeAdmission,false);await assert.rejects(fs.readFile(path.join(root,'default-window/package.json')),e=>e.code==='ENOENT');
 await b.run({nativeSourceLayout:true});assert.equal(r.counters.layout,1);const disk=JSON.parse(await fs.readFile(path.join(b.out,'terminal-candidate-receipt.json')));assert.equal(disk.nativeSourceLayout.nativeExecutionAdmitted,false);assert.equal(disk.nativeSourceLayout.completeRuntimeClosure,false);noNative(r);
}));
