// Owned inert resource bytes and simulated Electron events; no process/native launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createHook} from 'node:async_hooks';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {captureDesktopNativeRuntimeResources,DESKTOP_NATIVE_RESOURCE_PATHS} from '../src/terminal/desktop-native-runtime-resources.mjs';
const module=await import('../src/terminal/desktop-native-utility-launcher.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const entry=await import('../src/terminal/desktop-native-runtime-host.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const schema='siren-desktop-utility-host/v1';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function bounded(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('finite owned test deadline')),2000);})]);}finally{clearTimeout(timer);}}
let serial=0;
async function resources(){
 const directory=resolve('terminal-desktop-utility-launcher-20261012/fixtures',Date.now()+'_'+ ++serial),pins={};await mkdir(directory,{recursive:true});
 for(const path of DESKTOP_NATIVE_RESOURCE_PATHS){const target=join(directory,...path.split('/'));await mkdir(dirname(target),{recursive:true});const data=Buffer.from('INERT DATA ONLY '+path);await writeFile(target,data);pins[path]=createHash('sha256').update(data).digest('hex');}
 return {directory,receipt:await captureDesktopNativeRuntimeResources({directory,pins})};
}
function timing(){let serial=0;const timers=new Map();return {timers,api:{setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);}},fire(ms){for(const [id,row]of [...timers])if(row.ms===ms){timers.delete(id);row.fn();}}};}
class Child extends EventEmitter{pid=undefined;sent=[];kills=0;postMessage(value){this.sent.push(value);}kill(){this.kills++;return true;}spawn(pid=123){this.pid=pid;this.emit('spawn');}exit(code=0){this.pid=undefined;this.emit('exit',code);}}
async function setup(change=()=>{}){
 const r=await resources(),child=new Child(),clock=timing(),calls=[];let current=true,ready=true,entered;
 const forked=new Promise(resolve=>entered=resolve);
 const options={utilityProcess:{fork(...args){calls.push(['fork',...args]);entered();return child;}},isReady:()=>ready,mark:()=>7n,isCurrent:()=>current,timers:clock.api};
 const s={r,child,clock,calls,options,forked,entered,setCurrent:v=>current=v,setReady:v=>ready=v};change(s);s.launcher=module.createDesktopNativeUtilityLauncher(options);return s;
}
const hello=child=>({schema,pid:child.pid,electron:'44.9.3',modules:'149',napi:'10'});
async function launched(s){const reserved=s.launcher.reserveUtilityHost(s.r.receipt);reserved.ready.catch(()=>{});await bounded(Promise.race([s.forked,reserved.ready]));return reserved;}
async function complete(s,reserved){s.child.spawn();s.child.emit('message',hello(s.child));return reserved.ready;}

test('fixed launcher and entry exist without import-time process creation',()=>{assert.equal(typeof module.createDesktopNativeUtilityLauncher,'function');assert.equal(typeof entry.startDesktopNativeUtilityHost,'function');});
test('lazy construction; actual fixed fork arguments and resource-bound identity; exit proof excludes native cleanup',async()=>{
 const s=await setup();assert.equal(s.calls.length,0);const r=await launched(s);const call=s.calls[0];assert.equal(call[1],join(s.r.directory,'desktop/src/terminal/desktop-native-runtime-host.mjs'));assert.deepEqual(call[2],[]);assert.deepEqual(call[3],{cwd:s.r.directory,serviceName:'SIREN Terminal lifetime host',stdio:'ignore',execArgv:[],env:{}});
 const value=await complete(s,r);assert.deepEqual(value.hostProcessIdentity,{pid:123,image:join(s.r.directory,'electron/electron.exe'),since:7n});assert.equal(s.launcher.snapshot().nativeExecutionAdmitted,false);
 let done=false;const retired=r.retire().then(v=>{done=true;return v;});await tick();assert.equal(done,false);assert.deepEqual(s.child.sent,[{schema,kind:'retire'}]);s.child.exit(0);assert.deepEqual(await retired,{utilityExited:true,exitCode:0,nativeCleanupVerified:false,nativeExecutionAdmitted:false});assert.equal(s.clock.timers.size,0);
});
test('cloned/foreign resource refuses before fork and one reservation cannot retry',async()=>{const s=await setup();const r=s.launcher.reserveUtilityHost({...s.r.receipt});await assert.rejects(r.ready,/RESOURCE_REFUSED/);assert.equal(s.calls.length,0);assert.equal((await r.retire()).utilityExited,true);assert.throws(()=>s.launcher.reserveUtilityHost(s.r.receipt),/BUSY/);});
test('not-ready or stale MAIN refuses without a fork',async()=>{for(const kind of ['ready','current']){const s=await setup();if(kind==='ready')s.setReady(false);else s.setCurrent(false);const r=s.launcher.reserveUtilityHost(s.r.receipt);await assert.rejects(r.ready,/STALE/);assert.equal(s.calls.length,0);assert.equal((await r.retire()).utilityExited,true);}});
test('retirement reserved before async capture prevents any late launch',async()=>{const s=await setup();const r=s.launcher.reserveUtilityHost(s.r.receipt);const retirement=r.retire();assert.equal(retirement,r.retire());await assert.rejects(r.ready,/RETIRED/);assert.equal((await retirement).utilityExited,true);assert.equal(s.calls.length,0);});
test('held handshake cannot publish after MAIN invalidation and actual exit is still required',async()=>{const s=await setup(),r=await launched(s);s.setCurrent(false);s.child.spawn();s.child.emit('message',hello(s.child));await assert.rejects(r.ready,/STALE/);let done=false;const p=r.retire().then(v=>{done=true;return v;});await tick();assert.equal(done,false);s.child.exit(98);assert.equal((await p).utilityExited,true);});
test('wrong PID/version/extra field or accessor hello never publishes readiness',async()=>{for(const kind of ['pid','version','extra','getter']){const s=await setup(),r=await launched(s);s.child.spawn();const h=hello(s.child);if(kind==='pid')h.pid++;if(kind==='version')h.modules='148';if(kind==='extra')h.secret='ignored?';let reads=0;if(kind==='getter')Object.defineProperty(h,'pid',{enumerable:true,get(){reads++;return 123;}});s.child.emit('message',h);await assert.rejects(r.ready,/HANDSHAKE_REFUSED/);assert.equal(reads,0);s.child.exit(1);assert.equal((await r.retire()).utilityExited,true);}});
test('message before spawn and duplicate readiness are refused; no false ready',async()=>{const s=await setup(),r=await launched(s);s.child.pid=123;s.child.emit('message',hello(s.child));await assert.rejects(r.ready,/HANDSHAKE_REFUSED/);s.child.spawn();s.child.emit('message',hello(s.child));s.child.exit();assert.equal((await r.retire()).utilityExited,true);});
test('resource replacement after fork cannot publish readiness',async()=>{const s=await setup(),r=await launched(s);await writeFile(join(s.r.directory,DESKTOP_NATIVE_RESOURCE_PATHS[3]),'changed');s.child.spawn();s.child.emit('message',hello(s.child));await assert.rejects(r.ready,/RESOURCE_REFUSED/);s.child.exit();assert.equal((await r.retire()).utilityExited,true);});
test('kill success is not exit; retirement deadline refuses, no retry upgrade by late exit',async()=>{const s=await setup(),r=await launched(s);await complete(s,r);const p=r.retire();s.clock.fire(250);assert.equal(s.child.kills,1);let done=false;p.then(()=>done=true);await tick();assert.equal(done,false);s.clock.fire(5000);assert.equal((await p).utilityExited,false);s.child.exit();assert.equal((await r.retire()).utilityExited,false);});
test('startup timeout and error event retire without pretending they are exit',async()=>{for(const kind of ['timer','error']){const s=await setup(),r=await launched(s);if(kind==='timer')s.clock.fire(5000);else s.child.emit('error','FatalError','private-location','private-report');await assert.rejects(r.ready,/READY_TIMEOUT|PROCESS_ERROR/);s.clock.fire(5000);const result=await r.retire();assert.equal(result.utilityExited,false);s.child.exit();}});
test('fork throw remains unknown; no synthetic clean retirement',async()=>{const s=await setup(x=>x.options.utilityProcess.fork=()=>{throw Error('private failure');});const r=s.launcher.reserveUtilityHost(s.r.receipt);await assert.rejects(r.ready,/LAUNCH_UNKNOWN/);assert.equal((await r.retire()).utilityExited,false);});
test('reentrant retirement from fork retains returned child and prevents readiness',async()=>{let reserved;const s=await setup(x=>x.options.utilityProcess.fork=(...args)=>{x.calls.push(['fork',...args]);reserved.retire();x.entered();return x.child;});reserved=s.launcher.reserveUtilityHost(s.r.receipt);reserved.ready.catch(()=>{});await bounded(s.forked);await assert.rejects(reserved.ready,/RETIRED/);s.child.exit();assert.equal((await reserved.retire()).utilityExited,true);});
test('dependency getters/proxies refuse without invoking them; mark must be actual positive bigint',async()=>{
 let gets=0;const getter=Object.defineProperty({},'utilityProcess',{enumerable:true,get(){gets++;throw Error();}});assert.throws(()=>module.createDesktopNativeUtilityLauncher(getter),/ADAPTER_REFUSED/);assert.throws(()=>module.createDesktopNativeUtilityLauncher(new Proxy({},{ownKeys(){gets++;throw Error();}})),/ADAPTER_REFUSED/);assert.equal(gets,0);
 const s=await setup(x=>x.options.mark=()=>0n);const r=s.launcher.reserveUtilityHost(s.r.receipt);await assert.rejects(r.ready,/MARK_REFUSED/);assert.equal(s.calls.length,0);assert.equal((await r.retire()).utilityExited,true);
});

function hostRuntime(change=()=>{}){
 const port=new EventEmitter(),sent=[],exits=[],cleared=[],intervals=[];port.postMessage=v=>sent.push(v);
 const options={type:'utility',platform:'win32',arch:'x64',pid:321,electron:'44.9.3',modules:'149',napi:'10',parentPort:port,exit:code=>exits.push(code)};
 const timers={setInterval(fn,ms){intervals.push({fn,ms});return intervals.length;},clearInterval:id=>cleared.push(id)};change(options);return {options,timers,port,sent,exits,cleared,intervals};
}
test('fixed child handshake and sole retirement message, no command execution or path transfer',()=>{
 const f=hostRuntime(),h=entry.startDesktopNativeUtilityHost(f.options,f.timers);assert.deepEqual(f.sent,[{schema,pid:321,electron:'44.9.3',modules:'149',napi:'10'}]);assert.equal(f.intervals[0].ms,1000);
 for(const data of [{schema,kind:'input',data:'Write-Output unsafe'}, {schema,kind:'retire',path:'other'},null])f.port.emit('message',{data,ports:[]});assert.deepEqual(f.exits,[]);
 f.port.emit('message',{data:{schema,kind:'retire'},ports:[]});h.stop();assert.deepEqual(f.exits,[0]);assert.deepEqual(f.cleared,[1]);assert.equal(f.port.listenerCount('message'),0);
});
test('child wrong role/runtime or option getter cannot install handler/timer',()=>{for(const field of ['type','platform','arch','electron','modules','napi']){const f=hostRuntime(o=>o[field]='wrong');assert.throws(()=>entry.startDesktopNativeUtilityHost(f.options,f.timers),/CONTEXT_REFUSED/);assert.equal(f.intervals.length,0);assert.equal(f.port.listenerCount('message'),0);}let gets=0;const f=hostRuntime();Object.defineProperty(f.options,'pid',{enumerable:true,get(){gets++;throw Error();}});assert.throws(()=>entry.startDesktopNativeUtilityHost(f.options,f.timers),/CONTEXT_REFUSED/);assert.equal(gets,0);});
test('actual fixed host function composes with launcher handshake and retirement over inert event lanes',async()=>{
 const s=await setup(),f=hostRuntime(o=>{o.pid=123;o.exit=code=>s.child.exit(code);});
 f.port.postMessage=value=>s.child.emit('message',value);s.child.postMessage=value=>f.port.emit('message',{data:value,ports:[]});
 const r=await launched(s);
 s.child.spawn(123);entry.startDesktopNativeUtilityHost(f.options,f.timers);const ready=await bounded(r.ready);assert.equal(ready.hostProcessIdentity.pid,123);
 const result=await r.retire();assert.equal(result.utilityExited,true);assert.equal(result.nativeCleanupVerified,false);assert.equal(s.child.kills,0);assert.equal(f.port.listenerCount('message'),0);assert.equal(s.clock.timers.size,0);
});
test('duplicate ready after successful publication retires this utility instead of authorizing a second lifetime',async()=>{const s=await setup(),r=await launched(s);await complete(s,r);s.child.emit('message',hello(s.child));assert.equal(r.snapshot().retired,true);s.child.exit();assert.equal((await r.retire()).utilityExited,true);assert.throws(()=>s.launcher.reserveUtilityHost(s.r.receipt),/BUSY/);});
test('malformed exit code is not proof and later valid-looking event cannot upgrade same receipt',async()=>{const s=await setup(),r=await launched(s);await complete(s,r);const p=r.retire();s.child.exit('0');assert.equal((await p).utilityExited,false);s.child.exit(0);assert.equal((await r.retire()).utilityExited,false);});
test('reentrant disposal from mark or readiness callback prevents fork despite callback success',async()=>{
 for(const key of ['mark','isReady']){let launcher;const s=await setup(x=>x.options[key]=()=>{launcher.dispose();return key==='mark'?7n:true;});launcher=s.launcher;const r=launcher.reserveUtilityHost(s.r.receipt);await assert.rejects(r.ready,/RETIRED|STALE/);assert.equal(s.calls.length,0);assert.equal((await r.retire()).utilityExited,true);}
});
test('partially registered listener error retains actual child exit and removes installed listeners',async()=>{
 const s=await setup();const original=s.child.on;s.child.on=function(name,fn){original.call(this,name,fn);if(name==='spawn')throw Error('inert listener registration failure');return this;};
 const r=await launched(s);await assert.rejects(r.ready,/LAUNCH_UNKNOWN/);let done=false;const p=r.retire().then(v=>{done=true;return v;});await tick();assert.equal(done,false);s.child.exit(1);assert.equal((await p).utilityExited,true);for(const key of ['exit','error','spawn','message'])assert.equal(s.child.listenerCount(key),0);
});
test('child readiness-send failure cleans handler and interval and reports only fixed failure exit',()=>{
 const f=hostRuntime();f.port.postMessage=()=>{throw Error('private failure');};assert.throws(()=>entry.startDesktopNativeUtilityHost(f.options,f.timers),/^Error: UTILITY_HOST_START_REFUSED$/);assert.deepEqual(f.exits,[91]);assert.deepEqual(f.cleared,[1]);assert.equal(f.port.listenerCount('message'),0);
});
test('child retirement delivered while listener registers does not install a late keepalive or hello',()=>{
 const f=hostRuntime(),original=f.port.on;f.port.on=function(name,fn){original.call(this,name,fn);fn({data:{schema,kind:'retire'},ports:[]});return this;};entry.startDesktopNativeUtilityHost(f.options,f.timers);assert.deepEqual(f.exits,[0]);assert.equal(f.intervals.length,0);assert.equal(f.sent.length,0);assert.equal(f.port.listenerCount('message'),0);
});
test('actual Promise init hook cannot create a second reservation before the first is published',async()=>{
 const s=await setup();let entered=false,second,error;
 const hook=createHook({init(_id,type){if(type==='PROMISE'&&!entered){entered=true;try{second=s.launcher.reserveUtilityHost(s.r.receipt);}catch(e){error=e;}}}});
 let first;hook.enable();try{first=s.launcher.reserveUtilityHost(s.r.receipt);}finally{hook.disable();}
 first.ready.catch(()=>{});second?.ready.catch(()=>{});
 assert.match(error?.message??'',/UTILITY_BUSY/);assert.equal(second,undefined);
 const retired=first.retire();await assert.rejects(first.ready,/RETIRED/);assert.equal((await retired).utilityExited,true);assert.equal(s.calls.length,0);
});
test('actual Promise init hook cannot duplicate retirement or replace its resolver',async()=>{
 const s=await setup(),r=await launched(s);await complete(s,r);let entered=false,nested;
 const hook=createHook({init(_id,type){if(type==='PROMISE'&&!entered){entered=true;nested=r.retire();}}});
 let first;hook.enable();try{first=r.retire();}finally{hook.disable();}
 // Correct retirement allocates no Promise here; any reentrant call returns the same pre-reserved work.
 if(entered)assert.equal(nested,first);assert.equal(r.retire(),first);assert.equal(s.child.sent.length,1);
 s.child.exit();assert.equal((await bounded(first)).utilityExited,true);
});
test('spawn PID getter reentrant retirement cannot publish a spawned identity',async()=>{
 const s=await setup(),r=await launched(s);Object.defineProperty(s.child,'pid',{configurable:true,get(){r.retire();return 123;}});
 s.child.emit('spawn');assert.equal(r.snapshot().spawned,false);await assert.rejects(r.ready,/RETIRED/);
 s.child.emit('exit',0);assert.equal((await r.retire()).utilityExited,true);
});

test('corrected exact utility runtime accepts44.9.3 and refuses former or alternative44 patches',()=>{
 const current=hostRuntime(o=>{o.electron='44.9.3';});
 const host=entry.startDesktopNativeUtilityHost(current.options,current.timers);
 assert.equal(current.sent[0].electron,'44.9.3');host.stop();
 for(const version of ['44.5.1','44.9.1','44.9.2','44.9.4','44.999.0']){
  const old=hostRuntime(o=>{o.electron=version;});
  assert.throws(()=>entry.startDesktopNativeUtilityHost(old.options,old.timers),/CONTEXT_REFUSED/);
  assert.equal(old.intervals.length,0);assert.equal(old.port.listenerCount('message'),0);
 }
});

test('parent readiness refuses former Electron and other same-major patches with exact ABI unchanged',async()=>{
 for(const electron of ['44.5.1','44.9.1','44.9.4']){const s=await setup(),r=await launched(s);s.child.spawn();s.child.emit('message',{...hello(s.child),electron});await assert.rejects(r.ready,/HANDSHAKE_REFUSED/);s.child.exit(1);assert.equal((await r.retire()).utilityExited,true);}
});
