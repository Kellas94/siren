import test from 'node:test';
import assert from 'node:assert/strict';
import {CwdAuthority} from '../src/terminal/cwd.mjs';
import * as profiles from '../src/terminal/profiles.mjs';

const grant=Object.freeze({windowId:'w',projectId:'p',epoch:1,role:'workspace'});
const tick=()=>new Promise(r=>setImmediate(r));
const held=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);
const cwd=(extra={})=>new CwdAuthority({protectedRoots:['D:\\Private'],authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true}),pickDirectory:()=>({canceled:true,filePaths:[]}),inspectDirectory:()=>null,...extra});
const catalogue=(extra={})=>profiles.createShellProfileCatalogue({authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true}),getSystemDirectory:()=>null,...extra});

test('cwd never assimilates unsupported picker then getter and retains capacity',async()=>{
 let reads=0;const a=cwd({maxPending:1,pickDirectory:()=>Object.defineProperty({},'then',{get(){reads++;return undefined;}})});
 await rejects(a.pick(grant),'CWD_REFUSED');assert.equal(reads,0);await rejects(a.pick(grant),'CAPACITY_EXCEEDED');
});
test('catalogue never assimilates unsupported discovery then getter and retains capacity',async()=>{
 let reads=0;const a=catalogue({maxPending:1,getSystemDirectory:()=>Object.defineProperty({},'then',{get(){reads++;return undefined;}})});
 assert.equal((await a.listShellProfiles())[0].available,false);assert.equal(reads,0);await rejects(a.listShellProfiles(),'CAPACITY_EXCEEDED');
});
test('cwd reserves before reentrant authorization so maxPending one admits one picker',async()=>{
 let a,inside=false,nested,calls=0;const h=held();a=cwd({maxPending:1,authorize:()=>{if(!inside&&!nested){inside=true;nested=a.pick(grant);nested.catch(()=>{});inside=false;}return true;},pickDirectory:()=>{calls++;return h.promise;}});
 const outer=a.pick(grant);outer.catch(()=>{});await tick();h.resolve({canceled:true,filePaths:[]});await rejects(outer,'CANCELLED');await rejects(nested,'CAPACITY_EXCEEDED');assert.equal(calls,1);
});
test('catalogue reserves before reentrant authorization so one discovery is admitted',async()=>{
 let a,inside=false,nested,calls=0;const h=held();a=catalogue({maxPending:1,authorize:()=>{if(!inside&&!nested){inside=true;nested=a.listShellProfiles();nested.catch(()=>{});inside=false;}return true;},getSystemDirectory:()=>{calls++;return h.promise;}});
 const outer=a.listShellProfiles();outer.catch(()=>{});await tick();h.resolve(null);assert.equal((await outer)[0].available,false);await rejects(nested,'CAPACITY_EXCEEDED');assert.equal(calls,1);
});
test('cwd guard accessor is refused without invoking it',async()=>{
 let reads=0;const a=cwd({captureAdmission:()=>Object.defineProperty({},'isCurrent',{get(){reads++;return ()=>true;}})});await rejects(a.pick(grant),'SENDER_REFUSED');assert.equal(reads,0);
});
test('catalogue guard accessor is refused without invoking it',async()=>{
 let reads=0;const a=catalogue({captureAdmission:()=>Object.defineProperty({},'isCurrent',{get(){reads++;return ()=>true;}})});await rejects(a.listShellProfiles(),'SENDER_REFUSED');assert.equal(reads,0);
});
test('cwd passive stable handle waits for held returned provider after retirement',async()=>{
 const h=held(),a=cwd({pickDirectory:()=>h.promise});const handle=a.captureCwdSettlement();assert.equal(handle,a.captureCwdSettlement());assert.equal(handle.snapshot().actualSettled,false);const p=a.pick(grant);p.catch(()=>{});assert.equal(a.retireCwd(),handle);let done=false;handle.actualSettled.then(()=>done=true);await tick();assert.equal(done,false);await rejects(a.pick(grant),'SENDER_REFUSED');h.resolve({canceled:true,filePaths:[]});await rejects(p,'SENDER_REFUSED');const receipt=await handle.actualSettled;assert.equal(receipt.scope,'CWD_AUTHORITY');assert.equal(receipt.nativeExecutionAdmitted,false);assert.equal(handle.snapshot().pendingWorkers,0);
});
test('catalogue branded helpers keep four-method interface and join held discovery',async()=>{
 const h=held(),a=catalogue({getSystemDirectory:()=>h.promise});assert.deepEqual(Object.keys(a).sort(),['dispose','listShellProfiles','resolveShellProfile','revoke']);const handle=profiles.captureShellProfileSettlement(a);assert.equal(handle,profiles.captureShellProfileSettlement(a));assert.equal(profiles.captureShellProfileSettlement({...a}),null);const p=a.listShellProfiles();p.catch(()=>{});assert.equal(profiles.retireShellProfileCatalogue(a),handle);let done=false;handle.actualSettled.then(()=>done=true);await tick();assert.equal(done,false);h.resolve(null);await rejects(p,'SENDER_REFUSED');const receipt=await handle.actualSettled;assert.equal(receipt.scope,'SHELL_PROFILE_CATALOGUE');assert.equal(receipt.nativeExecutionAdmitted,false);
});

for(const kind of ['cwd','profiles']){
 const make=extra=>kind==='cwd'?cwd(extra):catalogue(extra);
 const call=a=>kind==='cwd'?a.pick(grant):a.listShellProfiles();
 const capture=a=>kind==='cwd'?a.captureCwdSettlement():profiles.captureShellProfileSettlement(a);
 const retire=a=>kind==='cwd'?a.retireCwd():profiles.retireShellProfileCatalogue(a);
 const provider=kind==='cwd'?'pickDirectory':'getSystemDirectory';
 const negative=kind==='cwd'?{canceled:true,filePaths:[]}:null;
 const outcome=p=>kind==='cwd'?rejects(p,'CANCELLED'):p.then(x=>assert.equal(x[0].available,false));
 test(kind+' rejects direct Proxy provider functions without executing apply traps',async()=>{
  let calls=0;const fn=new Proxy(()=>negative,{apply(){calls++;return negative;}}),a=make({[provider]:fn});
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  assert.equal(calls,0);
 });
 test(kind+' scope revoke in authorize prevents subsequent captured guard callback',async()=>{
  let a,armed=false,guards=0,beforeProvider;a=make({authorize:()=>{if(armed)a.revoke();return true;},captureAdmission:()=>({isCurrent:()=>{guards++;return true;}}),[provider]:()=>{beforeProvider=guards;armed=true;return negative;}});
  await rejects(call(a),'SENDER_REFUSED');assert.equal(guards,beforeProvider);
 });
 test(kind+' capture is passive and zero-work retirement is stable',async()=>{
  let calls=0;const a=make({authorize:()=>{calls++;return true;}}),h=capture(a);assert.equal(calls,0);assert.equal(h.snapshot().retired,false);assert.equal(retire(a),h);assert.equal(retire(a),h);await h.actualSettled;assert.equal(h.snapshot().actualSettled,true);assert.equal(calls,0);await rejects(call(a),'SENDER_REFUSED');
 });
 test(kind+' ordinary revoke is reopenable while old returned provider is still pending',async()=>{
  const h=held();let first=true;const a=make({[provider]:()=>{if(first){first=false;return h.promise;}return negative;}}),handle=capture(a),old=call(a);old.catch(()=>{});a.revoke();await outcome(call(a));assert.equal(handle.snapshot().retired,false);h.resolve(negative);await rejects(old,'SENDER_REFUSED');retire(a);await handle.actualSettled;assert.equal(handle.snapshot().pending,0);
 });
 test(kind+' known provider rejection releases capacity and can genuinely settle',async()=>{
  let first=true;const a=make({maxPending:1,[provider]:()=>{if(first){first=false;return Promise.reject(Error('private'));}return negative;}}),h=capture(a);
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  await outcome(call(a));retire(a);await h.actualSettled;assert.equal(h.snapshot().unknown,false);
 });
 test(kind+' unsupported original Promise constructor is never read and cannot settle',async()=>{
  const original=held();let reads=0;Object.defineProperty(original.promise,'constructor',{get(){reads++;return Promise;}});
  const a=make({maxPending:1,[provider]:()=>original.promise}),h=capture(a);
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  retire(a);original.resolve(negative);await tick();assert.equal(reads,0);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);assert.equal(h.snapshot().pending,1);
 });
 test(kind+' safe native provider observation bypasses own then getter',async()=>{
  const original=held();let reads=0;Object.defineProperty(original.promise,'then',{get(){reads++;throw Error('never');}});
  const a=make({[provider]:()=>original.promise}),p=call(a);original.resolve(negative);await outcome(p);retire(a);await capture(a).actualSettled;assert.equal(reads,0);
 });
 test(kind+' returned Proxy never executes reflective traps and stays unknown',async()=>{
  let traps=0;const proxy=new Proxy({},{get(){traps++;return undefined;},getPrototypeOf(){traps++;return null;},ownKeys(){traps++;return [];}}),a=make({[provider]:()=>proxy}),h=capture(a);
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  retire(a);await tick();assert.equal(traps,0);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
 });
 test(kind+' retirement in provider waits for its returned held Promise',async()=>{
  const hold=held();let a;a=make({[provider]:()=>{retire(a);return hold.promise;}});const h=capture(a),p=call(a);p.catch(()=>{});await tick();assert.equal(h.snapshot().actualSettled,false);hold.resolve(negative);await rejects(p,'SENDER_REFUSED');await h.actualSettled;assert.equal(h.snapshot().activeFrames,0);
 });
 test(kind+' async authorization refuses and permanently retains unknown finite charge',async()=>{
  const hold=held(),a=make({maxPending:1,authorize:()=>hold.promise}),h=capture(a);await rejects(call(a),'SENDER_REFUSED');await rejects(call(a),'CAPACITY_EXCEEDED');retire(a);hold.resolve(true);await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
 });
 test(kind+' nominal sync authorization cannot hide pending Promise with a DATA then shadow',async()=>{
  const hold=held();Object.defineProperty(hold.promise,'then',{value:undefined});const a=make({maxPending:1,authorize:()=>hold.promise}),h=capture(a);
  await rejects(call(a),'SENDER_REFUSED');assert.equal(h.snapshot().unknown,true);await rejects(call(a),'CAPACITY_EXCEEDED');retire(a);hold.resolve(true);await tick();assert.equal(h.snapshot().actualSettled,false);
 });
 test(kind+' native Promise subclass is not adopted as a supported provider authority',async()=>{
  class Other extends Promise{}const original=new Other(()=>{}),a=make({[provider]:()=>original}),h=capture(a);
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  retire(a);await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);
 });
 test(kind+' retiring in authorize enters no capture or provider callbacks',async()=>{
  let a,calls=0;a=make({authorize:()=>{retire(a);return true;},captureAdmission:()=>{calls++;return {isCurrent:()=>true};},[provider]:()=>{calls++;return negative;}});await rejects(call(a),'SENDER_REFUSED');await capture(a).actualSettled;assert.equal(calls,0);
 });
 test(kind+' synchronous provider throw is a completed negative without poisoning lifetime',async()=>{
  const a=make({[provider]:()=>{throw Error('private');}}),h=capture(a);
  if(kind==='cwd')await rejects(call(a),'CWD_REFUSED');else assert.equal((await call(a))[0].available,false);
  retire(a);await h.actualSettled;assert.equal(h.snapshot().unknown,false);
 });
 test(kind+' public request Promise keeps ordinary manager-compatible constructor identity',async()=>{
  const a=make(),p=call(a);assert.equal(Object.hasOwn(p,'constructor'),false);assert.equal(Object.getPrototypeOf(p),Promise.prototype);await outcome(p);retire(a);await capture(a).actualSettled;
 });
 test(kind+' repeated completed requests do not exhaust local continuation budget',async()=>{
  const a=make({maxPending:1});for(let i=0;i<130;i++)await outcome(call(a));retire(a);await capture(a).actualSettled;assert.equal(capture(a).snapshot().pendingWorkers,0);
 });
 test(kind+' retained completed passive handle releases authority and provider capabilities',async()=>{
  assert.equal(typeof global.gc,'function','Run this qualification with --expose-gc');
  function build(){const capability={secret:Math.random()},fn=()=>{void capability.secret;return negative;};const a=make({[provider]:fn}),h=capture(a),refs=[new WeakRef(a),new WeakRef(fn),new WeakRef(capability)];retire(a);return {h,refs};}
  const {h,refs}=build();await h.actualSettled;for(let i=0;i<40;i++){await tick();global.gc();}
  assert.equal(h.snapshot().actualSettled,true);assert.deepEqual(refs.map(r=>r.deref()),[undefined,undefined,undefined]);
 });
}

test('cwd malformed Proxy grant is refused without reflective trap execution',async()=>{
 let traps=0;const proxy=new Proxy(grant,{getOwnPropertyDescriptor(){traps++;throw Error();}}),a=cwd();await rejects(a.pick(proxy),'SENDER_REFUSED');assert.equal(traps,0);a.retireCwd();await a.captureCwdSettlement().actualSettled;
});
test('catalogue helper brand checks never reflect on unknown Proxy objects',()=>{
 let traps=0;const p=new Proxy({},{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});assert.equal(profiles.captureShellProfileSettlement(p),null);assert.equal(profiles.retireShellProfileCatalogue(p),null);assert.equal(traps,0);
});
