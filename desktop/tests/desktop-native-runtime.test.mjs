import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {fixture} from './fixtures/terminal-host-candidate-ownership.mjs';
import {privateManager,deferred,inertTick} from './fixtures/terminal-manager-global.mjs';
import {captureTerminalGraphAuthorities} from '../src/terminal/shutdown-graph.mjs';
import {captureDesktopNativeRuntimeResources,recheckDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
const module=await import('../src/terminal/desktop-native-runtime.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('candidate runtime API exists without native loading or activation',()=>{
 assert.equal(typeof module.createDesktopNativeRuntimeOwner,'function','Missing candidate-only owner');
});
let sequence=0;
async function resources(){
 const directory=resolve('terminal-desktop-native-runtime-20261012/fixtures',String(Date.now())+'_'+ ++sequence),pins={};await mkdir(directory,{recursive:true});
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...path.split('/'));await mkdir(dirname(target),{recursive:true});const bytes=Buffer.from(path.endsWith('package.json')?JSON.stringify({name:'node-pty',version:'1.1.0',main:'./lib/index.js'}):'INERT DATA '+path);await writeFile(target,bytes);pins[path]=createHash('sha256').update(bytes).digest('hex');}
 return {directory,pins,receipt:await captureDesktopNativeRuntimeResources({directory,pins})};
}
async function setup(change=()=>{}){
 const r=await resources(),h=privateManager(),n=fixture({noStart:true,hostOrdinals:[]}),trace=[];
 const providers={cwd:{pickDirectory:async()=>({canceled:true,filePaths:[]}),protectedRoots:[],inspectDirectory:async()=>{throw Error('unused');}},profiles:{getSystemDirectory:async()=> 'C:\\Windows\\System32',inspectExecutable:async()=>{throw Error('unused');},readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows'}),privateEnvironmentKeys:[],modulePathPolicy:'system-seeded',inspectModuleDirectory:async()=>{throw Error('unused');}},policy:{isUnlocked:()=>true,getMode:()=> 'normal',canExecute:()=>true}};
 const ready=deferred(),retired=deferred(),reserved=deferred();let current=true;
 const adapter={captureResources:async()=>{trace.push('capture');return r.receipt;},verifyResourceClosure:async receipt=>{assert.equal(receipt,r.receipt);trace.push('closure');return true;},providers:async()=>{trace.push('providers');return providers;},isCurrent:()=>current,reserveHost:()=>{trace.push('reserve');reserved.resolve();return {ready:ready.promise,retire(){trace.push('retire');return retired.promise;}};}};
 const request={registry:h.registry,projectId:'project1',workspaceEvent:h.registry.eventFor(h.grant),access:{prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{},isReady:()=>current}};
 const s={r,h,n,ready,retired,reserved,adapter,providers,request,trace,setCurrent:v=>{current=v;},async end(){await h.end();}};change(s);s.owner=module.createDesktopNativeRuntimeOwner({adapter});return s;
}
const hostReady=s=>s.ready.resolve({native:s.n.native,hostProcessIdentity:{pid:101,image:'C:\\Runtime\\electron.exe',since:1n}});
async function until(f){for(let i=0;i<100&&!f();i++)await inertTick();assert(f(),'finite test settlement');}
test('construction is lazy, genuine graph is returned, disposal waits JS AND separate native/utility settlement',async()=>{
 const s=await setup();try{assert.deepEqual(s.trace,[]);assert.equal(s.n.calls.length,0);const pending=s.owner.createGraph(s.request);await s.reserved.promise;hostReady(s);const graph=await pending;assert(captureTerminalGraphAuthorities(graph,s.h.registry,'project1'));assert.equal(s.owner.snapshot().state,'active');assert.equal(s.n.calls.filter(r=>r[0]==='start').length,1);
 let done=false;const disposing=s.owner.dispose().then(r=>{done=true;return r;});await until(()=>s.n.calls.some(r=>r[0]==='hostStop'));assert.equal(done,false);s.n.hostStop.resolve(s.n.finalHost());await until(()=>s.trace.includes('retire'));assert.equal(done,false);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});assert.equal((await disposing).cleanupVerified,true);assert.equal(s.owner.snapshot().nativeExecutionAdmitted,false);
 }finally{await s.end();}
});
test('duplicate concurrent start refuses before another capture or reservation',async()=>{
 const s=await setup();try{const p=s.owner.createGraph(s.request);await s.reserved.promise;await assert.rejects(s.owner.createGraph(s.request),/BUSY/);assert.equal(s.trace.filter(v=>v==='capture').length,1);s.setCurrent(false);hostReady(s);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await assert.rejects(p,/START_REFUSED/);assert.equal(s.n.calls.length,0);}finally{await s.end();}
});
test('stale project during held host startup retires actual reserved lifetime before refusal',async()=>{
 const s=await setup();try{let done=false;const p=s.owner.createGraph(s.request).catch(e=>{done=true;throw e;});await s.reserved.promise;s.setCurrent(false);hostReady(s);await until(()=>s.trace.includes('retire'));assert.equal(done,false);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await assert.rejects(p,/START_REFUSED/);assert.equal(s.n.calls.length,0);assert.equal(s.owner.snapshot().cleanupVerified,true);}finally{await s.end();}
});
test('dispose while startup is held retains the pending lifetime and waits actual cleanup',async()=>{
 const s=await setup();try{const p=s.owner.createGraph(s.request);await s.reserved.promise;let done=false;const d=s.owner.dispose().then(r=>{done=true;return r;});await inertTick();assert.equal(done,false);hostReady(s);await until(()=>s.trace.includes('retire'));assert.equal(done,false);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await assert.rejects(p,/START_REFUSED/);assert.equal((await d).cleanupVerified,true);assert.equal(s.n.calls.length,0);}finally{await s.end();}
});
test('throwing partial launcher remains blocked and cannot silently retry',async()=>{
 const s=await setup(x=>{x.adapter.reserveHost=()=>{x.trace.push('partial');throw Error('sensitive');};});try{await assert.rejects(s.owner.createGraph(s.request),/^Error: DESKTOP_NATIVE_CLEANUP_UNKNOWN$/);assert.equal(s.owner.snapshot().state,'blocked');await assert.rejects(s.owner.createGraph(s.request),/BUSY/);assert.equal((await s.owner.dispose()).cleanupVerified,false);}finally{await s.end();}
});
test('unverified utility exit or native cleanup does not release owner',async()=>{
 for(const result of [{utilityExited:false,nativeCleanupVerified:true},{utilityExited:true,nativeCleanupVerified:false}]){const s=await setup();try{const p=s.owner.createGraph(s.request);await s.reserved.promise;s.setCurrent(false);hostReady(s);s.retired.resolve(result);await assert.rejects(p,/CLEANUP_UNKNOWN/);assert.equal(s.owner.snapshot().state,'blocked');}finally{await s.end();}}
});
test('forged registry, foreign project or changed epoch refuses before resource IO',async()=>{
 const s=await setup();try{await assert.rejects(s.owner.createGraph({...s.request,registry:{}}),/REQUEST_REFUSED/);await assert.rejects(s.owner.createGraph({...s.request,projectId:'other'}),/REQUEST_REFUSED/);s.h.registry.invalidateEpoch({preserveWorkspace:true});await assert.rejects(s.owner.createGraph(s.request),/REQUEST_REFUSED/);assert.deepEqual(s.trace,[]);}finally{await s.end();}
});
test('private current callback disposing this owner cannot authorize subsequent capture',async()=>{
 let disposal;const s=await setup(x=>{x.adapter.isCurrent=()=>{disposal=x.owner.dispose();return true;};});try{await assert.rejects(s.owner.createGraph(s.request),/START_REFUSED/);await disposal;assert.deepEqual(s.trace,[]);assert.equal(s.n.calls.length,0);}finally{await s.end();}
});
test('reentrant private current callback cannot revive admission it just revoked',async()=>{
 const s=await setup(x=>{let once=false;x.adapter.isCurrent=()=>{if(!once){once=true;x.h.registry.invalidateEpoch({preserveWorkspace:true});}return true;};});try{await assert.rejects(s.owner.createGraph(s.request),/START_REFUSED/);assert.deepEqual(s.trace,[]);assert.equal(s.n.calls.length,0);}finally{await s.end();}
});
test('critical resource receipt refuses clones/mutation/replacement and preserves fixed creator layout',async()=>{
 const r=await resources();assert.equal(await recheckDesktopNativeRuntimeResources({...r.receipt}),false);assert.equal(desktopNativeRuntimeResourcePaths({}),null);assert.equal(await recheckDesktopNativeRuntimeResources(r.receipt),true);assert.equal(desktopNativeRuntimeResourcePaths(r.receipt).entry,join(r.directory,'desktop/src/terminal/desktop-native-runtime-creator.mjs'));
 const path=join(r.directory,DESKTOP_NATIVE_RESOURCE_PATHS[1]),bytes=await readFile(path);await rename(path,path+'.original');await writeFile(path,bytes);assert.equal(await recheckDesktopNativeRuntimeResources(r.receipt),false);
});
test('resource/provider closure refusal and resource change before launch prevent reservation',async()=>{
 for(const kind of ['closure','provider','bytes']){const s=await setup(x=>{if(kind==='closure')x.adapter.verifyResourceClosure=async()=>false;if(kind==='provider')x.adapter.providers=async()=>({});if(kind==='bytes')x.adapter.providers=async()=>{await writeFile(join(x.r.directory,DESKTOP_NATIVE_RESOURCE_PATHS[1]),'changed');return x.providers;};});try{await assert.rejects(s.owner.createGraph(s.request),/START_REFUSED/);assert.equal(s.trace.includes('reserve'),false);assert.equal(s.n.calls.length,0);}finally{await s.end();}}
});
test('accessors/proxies/foreign adapter fields do not execute during option capture',()=>{
 let calls=0;const accessor=Object.defineProperty({},'adapter',{enumerable:true,get(){calls++;throw Error();}});assert.throws(()=>module.createDesktopNativeRuntimeOwner(accessor),/ADAPTER_REFUSED/);assert.throws(()=>module.createDesktopNativeRuntimeOwner(new Proxy({},{ownKeys(){calls++;throw Error();}})),/ADAPTER_REFUSED/);assert.throws(()=>module.createDesktopNativeRuntimeOwner({adapter:{reserveHost(){},extra:true}}),/ADAPTER_REFUSED/);assert.equal(calls,0);
});
test('complete private closure must be rechecked after providers and after held utility startup',async()=>{
 for(const phase of ['providers','ready']){let valid=true;const s=await setup(x=>{x.adapter.verifyResourceClosure=async()=>valid;if(phase==='providers')x.adapter.providers=async()=>{valid=false;return x.providers;};});try{if(phase==='providers')hostReady(s);const p=s.owner.createGraph(s.request);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});if(phase==='ready'){await s.reserved.promise;valid=false;hostReady(s);}await assert.rejects(p,/START_REFUSED/);assert.equal(s.n.calls.length,0);if(phase==='providers')assert.equal(s.trace.includes('reserve'),false);}finally{await s.end();}}
});
test('failed actual graph start requests emergency host retirement even when graph JS join is unknown',async()=>{
 const reached=deferred(),s=await setup(x=>{x.n.native.start=()=>{reached.resolve();return null;};});try{let settled=false;const p=s.owner.createGraph(s.request).then(()=>{settled=true;},()=>{settled=true;});await s.reserved.promise;hostReady(s);await reached.promise;await until(()=>s.trace.includes('retire'));assert.equal(settled,false);s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await inertTick();assert.equal(settled,false,'unknown JS join is not promoted by native adapter settlement');assert.equal(s.owner.snapshot().cleanupVerified,false);assert.equal(s.owner.snapshot().pending,true);void p;}finally{await s.end();}
});
test('private resource roots refuse nonlocal aliases before any filesystem access',async()=>{
 await assert.rejects(captureDesktopNativeRuntimeResources({directory:'\\\\server\\share\\candidate',pins:{}}),/RESOURCE_REFUSED/);
});
test('dispose requests reserved utility retirement BEFORE a held ready promise settles',async()=>{
 const s=await setup();try{let started=false,disposed=false;const p=s.owner.createGraph(s.request).catch(e=>{started=true;throw e;});await s.reserved.promise;const d=s.owner.dispose().then(r=>{disposed=true;return r;});await until(()=>s.trace.includes('retire'));s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await inertTick();assert.equal(started,false);assert.equal(disposed,false);assert.equal(s.owner.snapshot().pending,true);assert.equal(s.owner.snapshot().cleanupVerified,false);hostReady(s);await assert.rejects(p,/START_REFUSED/);assert.equal((await d).cleanupVerified,true);assert.equal(s.n.calls.length,0);}finally{await s.end();}
});
test('candidate-initiated graph shutdown and owner disposal join the SAME actual graph settlement',async()=>{
 const s=await setup();try{const p=s.owner.createGraph(s.request);await s.reserved.promise;hostReady(s);const graph=await p;const external=graph.shutdown({code:77,deadlineMs:100,shutdownId:'candidate_shutdown'});const disposal=s.owner.dispose();await until(()=>s.trace.includes('retire'));s.retired.resolve({utilityExited:true,nativeCleanupVerified:true});await until(()=>s.n.calls.some(r=>r[0]==='hostStop'));s.n.hostStop.resolve(s.n.finalHost());assert.equal((await external).actualSettled,true);assert.equal((await disposal).cleanupVerified,true);assert.equal(s.n.calls.filter(r=>r[0]==='hostStop').length,1);}finally{await s.end();}
});
test('fixed creator entry is an awaited once-only launcher rather than the inert exported implementation',async()=>{
 const r=await resources(),paths=desktopNativeRuntimeResourcePaths(r.receipt);assert.equal(paths.entry,join(r.directory,'desktop/src/terminal/desktop-native-runtime-creator.mjs'));
 const source=await readFile(new URL('../src/terminal/desktop-native-runtime-creator.mjs',import.meta.url),'utf8');
 assert.equal(source,"// Fixed executable candidate resource; never imported by the default app.\nimport {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n");
 const held=deferred();let calls=0,complete=false;const body=source.replace("import {runProductionCreatorEntry} from './production-creator-entry.mjs';\n",'');const context=vm.createContext({runProductionCreatorEntry:()=>{calls++;return held.promise;}});const p=vm.runInContext('(async()=>{'+body+'})()',context,{timeout:1000}).then(()=>{complete=true;});assert.equal(calls,1);assert.equal(complete,false);held.resolve();await p;assert.equal(complete,true);assert.equal(calls,1);
});
test('unconfigured candidate refuses graph creation and stays unavailable',async()=>{
 assert.equal(typeof module.createDesktopNativeRuntimeOwner,'function','Missing candidate-only owner');
 const owner=module.createDesktopNativeRuntimeOwner();
 await assert.rejects(owner.createGraph({}),{message:'DESKTOP_NATIVE_RUNTIME_UNAVAILABLE'});
 assert.equal(owner.snapshot().configured,false);assert.equal(owner.snapshot().nativeExecutionAdmitted,false);
});
