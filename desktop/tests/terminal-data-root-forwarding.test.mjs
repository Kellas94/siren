// Inert selected-MAIN startup controls; no Electron or real filesystem writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {win32} from 'node:path';
import {types} from 'node:util';

const launchSource=await readFile(new URL('../src/desktop-launch.mjs',import.meta.url),'utf8');
const mainSource=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const preference={preferredDataRoot:'C:\\control\\data',protectedRuntimeRoot:'C:\\control\\runtime'};
const marker='const initializeTerminalCandidate=takeDesktopLaunch();';
const start=mainSource.indexOf(marker),end=mainSource.indexOf('const sessionId = randomUUID();',start);
assert(start>=0&&end>start&&mainSource.indexOf(marker,start+1)===-1,'EXACT_MAINTAINED_STARTUP_REGION');
const startup=mainSource.slice(start,end);

async function fixture({config=preference,packaged=false,args=[],failFirst=false,cancel=false}={}){
 const context=vm.createContext({});
 const launch=new vm.SourceTextModule(launchSource,{context});
 await launch.link(async name=>{
  assert.equal(name,'node:util');
  return new vm.SyntheticModule(['types'],function(){this.setExport('types',types);},{context});
 });
 await launch.evaluate();
 const initializer=()=>{};
 if(config!==null){const local=vm.runInContext('('+JSON.stringify(config)+')',context);launch.namespace.configureDesktopLaunch(initializer,local);}
 const calls=[],events=[];let ready,attempt=0;
 const app={isPackaged:packaged,getPath:name=>{assert.equal(name,'exe');return 'C:\\control\\runtime\\electron\\electron.exe';},
  setPath:(name,value)=>events.push(['setPath',name,value]),whenReady:()=>({then:fn=>{ready=fn;}}),
  requestSingleInstanceLock:()=>true,quit:()=>events.push(['quit']),exit:code=>events.push(['exit',code])};
 const writableDataRoot=async(...actual)=>{calls.push(['writable',...actual]);if(failFirst&&++attempt===1)throw Error('CONTROLLED_PREFERRED_REFUSAL');return actual[0];};
 const chooseDataRoot=async options=>{calls.push(['choose',options]);return cancel?null:options.preferred;};
 const deps={takeDesktopLaunch:launch.namespace.takeDesktopLaunch,captureDesktopLaunchDataPreference:launch.namespace.captureDesktopLaunchDataPreference,
  app,protocol:{registerSchemesAsPrivileged:()=>{}},process:{argv:['electron','C:\\control',...args]},
  dirname:win32.dirname,resolve:win32.resolve,fileURLToPath:()=> 'C:\\control\\runtime\\desktop\\src\\main.mjs',
  writableDataRoot,chooseDataRoot,dialog:{showOpenDialog:async()=>{throw Error('UNEXPECTED_NATIVE_DIALOG');}}};
 const names=Object.keys(deps);
 const controls=new vm.SyntheticModule(names,function(){for(const key of names)this.setExport(key,deps[key]);},{context});
 const selected=new vm.SourceTextModule('import {'+names.join(',')+'} from "controlled:startup";\n'+startup+'return dataRoot;\n});\nexport {dataRoot};',
  {context,initializeImportMeta:meta=>{meta.url='file:///C:/control/runtime/desktop/src/main.mjs';}});
 await selected.link(async name=>{assert.equal(name,'controlled:startup');return controls;});
 let error=null;try{await selected.evaluate();}catch(value){error=value;}
 return {context,launch,initializer,calls,events,error,ready:async()=>{assert.equal(typeof ready,'function');return ready();},namespace:selected.namespace};
}

test('fixed MAIN uses the registered external data preference and protects its first helper attempt',async()=>{
 const f=await fixture();assert.equal(f.error,null);
 assert.equal(f.calls.length,1);assert.equal(f.calls[0][0],'writable');assert.equal(f.calls[0][1],preference.preferredDataRoot);
 assert.equal(f.calls[0][2]?.protectedRuntimeRoot,preference.protectedRuntimeRoot);
 assert.equal(await f.ready(),preference.preferredDataRoot);
 assert.equal(f.events.filter(e=>e[0]==='setPath').at(-1)[2],preference.preferredDataRoot);
});

test('fixed MAIN forwards the same guard into the actual chooser continuation after preferred refusal',async()=>{
 const f=await fixture({failFirst:true});assert.equal(f.error,null);await f.ready();
 assert.equal(f.calls.length,2);const choice=f.calls[1];assert.equal(choice[0],'choose');
 assert.equal(choice[1].preferred,preference.preferredDataRoot);assert.equal(choice[1].protectedRuntimeRoot,preference.protectedRuntimeRoot);
 assert.equal(typeof choice[1].choose,'function');
});

test('conflicting private CLI data override refuses before any helper attempt',async()=>{
 const f=await fixture({args:['--siren-test-root=C:\\other-data']});
 assert(f.error instanceof Error||f.error?.name==='Error');assert.equal(f.calls.length,0);
});

test('private guarded registration refuses packaged startup before helper effects',async()=>{
 const f=await fixture({packaged:true});assert(f.error);assert.equal(f.calls.length,0);
});

test('ordinary MAIN retains its default data location and omitted guard behavior',async()=>{
 const f=await fixture({config:null});assert.equal(f.error,null);
 assert.equal(f.calls[0][1],'C:\\control\\runtime\\desktop\\.dev-data');
 assert.equal(f.calls[0][2],undefined);assert.equal(await f.ready(),f.calls[0][1]);
});

test('ordinary explicit test-root selection and cancellation remain available',async()=>{
 const f=await fixture({config:null,args:['--siren-test-root=C:\\chosen'],failFirst:true,cancel:true});assert.equal(f.error,null);
 await f.ready();assert.equal(f.calls[0][1],'C:\\chosen');assert.equal(f.calls[1][1].protectedRuntimeRoot,undefined);
 assert.equal(f.events.some(e=>e[0]==='exit'&&e[1]===0),true);
});

test('registered function identity and one-use semantics survive metadata capture',async()=>{
 const f=await fixture();assert.equal(f.error,null);const ns=f.launch.namespace;
 assert.equal(typeof ns.captureDesktopLaunchDataPreference,'function');
 const data=ns.captureDesktopLaunchDataPreference(f.initializer);
 assert.equal(data.preferredDataRoot,preference.preferredDataRoot);assert.equal(data.protectedRuntimeRoot,preference.protectedRuntimeRoot);
 assert.equal(Object.isFrozen(data),true);assert.throws(()=>ns.captureDesktopLaunchDataPreference(()=>{}));
 assert.throws(()=>ns.takeDesktopLaunch());assert.throws(()=>ns.configureDesktopLaunch(()=>{}));
});

test('malformed private DATA refuses without consuming registration or invoking accessors',async()=>{
 for(const expression of ['{preferredDataRoot:"C:\\\\data"}',
  '{preferredDataRoot:"C:\\\\data",protectedRuntimeRoot:"C:\\\\runtime",extra:true}',
  '{get preferredDataRoot(){globalThis.reads++;return "C:\\\\data";},protectedRuntimeRoot:"C:\\\\runtime"}',
  'new Proxy({},{ownKeys(){globalThis.reads++;return [];}})']){
  const context=vm.createContext({reads:0});const mod=new vm.SourceTextModule(launchSource,{context});
  await mod.link(async name=>{assert.equal(name,'node:util');return new vm.SyntheticModule(['types'],function(){this.setExport('types',types);},{context});});await mod.evaluate();
  const fn=()=>{},bad=vm.runInContext('('+expression+')',context);
  assert.throws(()=>mod.namespace.configureDesktopLaunch(fn,bad));assert.equal(context.reads,0);
  const good=vm.runInContext('('+JSON.stringify(preference)+')',context);
  mod.namespace.configureDesktopLaunch(fn,good);assert.equal(mod.namespace.takeDesktopLaunch(),fn);
 }
});
