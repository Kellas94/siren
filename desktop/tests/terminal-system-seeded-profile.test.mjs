import test from 'node:test';
import assert from 'node:assert/strict';
import {win32 as path} from 'node:path';
import {createShellProfileCatalogue,captureShellProfileSettlement} from '../src/terminal/profiles.mjs';

const executable='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const modulePath=path.join(path.dirname(executable),'Modules');
function chain(p){const root=path.parse(p).root,parts=p.slice(root.length).split('\\').filter(Boolean);return[root,...parts.map((_,i)=>path.join(root,...parts.slice(0,i+1)))].map(q=>({path:q,identity:'dir:'+q,directory:true,reparse:false}));}
function file(p=executable){return{canonicalPath:p,identity:'executable',file:true,reparse:false,ancestors:chain(path.dirname(p))};}
function directory(p=modulePath){return{canonicalPath:p,identity:'dir:'+p,directory:true,reparse:false,ancestors:chain(p)};}
function fixture(extra={}){
 const s={calls:[],generation:0,allowed:true,env:{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32',TEMP:'C:\\Temp'},file:file(),directory:directory(),hook:async()=>{}};
 const call=async(name,value)=>{s.calls.push(name);await s.hook(name);return value();};
 const options={getSystemDirectory:()=>call('system',()=> 'C:\\Windows\\System32'),inspectExecutable:p=>call('file',()=>{assert.equal(p,executable);return s.file;}),inspectModuleDirectory:p=>call('module',()=>{assert.equal(p,modulePath);return s.directory;}),readEnvironment:()=>call('environment',()=>s.env),authorize:()=>s.allowed,captureAdmission:()=>{const g=s.generation;return{isCurrent:()=>g===s.generation};},modulePathPolicy:'system-seeded',...extra};
 return{s,options,catalogue:createShellProfileCatalogue(options)};
}
const refuses=(fn,code='PROFILE_UNAVAILABLE')=>assert.rejects(fn,e=>e?.code===code);
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};

test('system-seeded catalogue synthesizes one canonical Modules key and fixed interactive argv',async()=>{
 const {s,catalogue}=fixture();s.env.PsMoDuLePaTh='C:\\Untrusted';const before={...s.env};
 const value=await catalogue.resolveShellProfile('powershell');assert.equal(value.env.PSModulePath,modulePath);assert.deepEqual(Object.keys(value.env),['SystemRoot','PATH','TEMP','PSModulePath']);assert.deepEqual(value.args,['-NoLogo','-NoProfile']);assert.deepEqual(s.env,before);assert(Object.isFrozen(value.env));assert.deepEqual(s.calls,['system','file','module','environment','file','module']);
});
test('omitted policy keeps inherited path omission and never calls optional module provider',async()=>{const {s,options}=fixture();delete options.modulePathPolicy;const a=createShellProfileCatalogue(options);s.env.PSModulePath='C:\\Old';const value=await a.resolveShellProfile('powershell');assert(!Object.hasOwn(value.env,'PSModulePath'));assert(!s.calls.includes('module'));});
test('selected policy without usable inspector refuses rather than falling back',async()=>{for(const inspector of [undefined,null,{},new Proxy(()=>{}, {})]){const {catalogue}=fixture({inspectModuleDirectory:inspector});await refuses(()=>catalogue.resolveShellProfile('powershell'));assert.equal((await catalogue.listShellProfiles())[0].available,false);}});
test('closed profile configuration refuses unknown policy fields and reflection hooks',()=>{let calls=0;const accessor=Object.defineProperty({},'modulePathPolicy',{enumerable:true,get(){calls++;return 'system-seeded';}});for(const options of [{modulePathPolicy:undefined},{modulePathPolicy:'inherit'},{modulePathPolicy:true},{modulePathPolicy:{}},{modulePathPolicy:'system-seeded',foreign:true},accessor,new Proxy({}, {ownKeys(){calls++;throw Error();}})])assert.throws(()=>createShellProfileCatalogue(options),TypeError);assert.equal(calls,0);});
test('module directory evidence requires leaf, complete ancestry, exact canonical path and common engine ancestry',async()=>{
 const mutations=[d=>d.directory=false,d=>d.reparse=true,d=>d.canonicalPath='C:\\Other',d=>d.identity='different-leaf',d=>d.ancestors.pop(),d=>d.ancestors[1].reparse=true,d=>d.ancestors[1].identity='foreign-engine-ancestor',d=>d.ancestors[2].path='C:\\Other',d=>d.extra=true];
 for(const mutate of mutations){const {s,catalogue}=fixture();mutate(s.directory);await refuses(()=>catalogue.resolveShellProfile('powershell'));assert(!s.calls.includes('environment'));}
});
test('module provider getters and proxies refuse without invoking field hooks',async()=>{let reads=0;for(const bad of [Object.defineProperty(directory(),'identity',{enumerable:true,get(){reads++;return 'x';}}),new Proxy({}, {getPrototypeOf(){reads++;throw Error();}})]){const {s,catalogue}=fixture();s.directory=bad;await refuses(()=>catalogue.resolveShellProfile('powershell'));}assert.equal(reads,0);});
test('Modules identity replacement after pinned list or during environment settlement refuses',async()=>{
 for(const when of ['after-list','environment']){const {s,catalogue}=fixture();if(when==='after-list'){assert.equal((await catalogue.listShellProfiles())[0].available,true);s.directory.identity='new';s.directory.ancestors.at(-1).identity='new';}else s.hook=async name=>{if(name==='environment'){s.directory.identity='new';s.directory.ancestors.at(-1).identity='new';}};await refuses(()=>catalogue.resolveShellProfile('powershell'));}
});
test('new module boundaries remain generation fenced before and after provider awaits',async()=>{
 for(const boundary of ['first-module','last-module']){const {s,catalogue}=fixture();let seen=0;s.hook=async name=>{if(name==='module'&&++seen===(boundary==='first-module'?1:2))s.generation++;};await refuses(()=>catalogue.resolveShellProfile('powershell'),'SENDER_REFUSED');}
});
test('disposed catalogue retains actual held module discovery until genuine provider settlement',async()=>{
 let release;const {s,catalogue}=fixture();s.hook=name=>name==='module'?new Promise(r=>release=r):Promise.resolve();const pending=catalogue.resolveShellProfile('powershell');await tick();assert.equal(typeof release,'function');const handle=captureShellProfileSettlement(catalogue);catalogue.dispose();let settled=false;handle.actualSettled.then(()=>settled=true);await tick();assert.equal(settled,false);assert(handle.snapshot().pendingWorkers>0);release();await refuses(()=>pending,'SENDER_REFUSED');await handle.actualSettled;assert.equal(settled,true);
});
test('Lock-style revoke does not publish old discovery and permits a genuinely new generation',async()=>{let release;const {s,catalogue}=fixture();s.hook=name=>name==='module'?new Promise(r=>release=r):Promise.resolve();const old=catalogue.resolveShellProfile('powershell');await tick();catalogue.revoke();s.hook=async()=>{};const fresh=await catalogue.resolveShellProfile('powershell');assert.equal(fresh.env.PSModulePath,modulePath);release();await refuses(()=>old,'SENDER_REFUSED');});
test('seeded envelope refuses output count and Windows environment block overflow',async()=>{
 for(const env of [Object.assign({SystemRoot:'C:\\Windows',PATH:'x'},Object.fromEntries(Array.from({length:510},(_,i)=>['V'+i,'x']))),{SystemRoot:'C:\\Windows',PATH:'x',LONG:'x'.repeat(32700)}]){const {s,catalogue}=fixture();s.env=env;await refuses(()=>catalogue.resolveShellProfile('powershell'));}
});
test('seeded module path cannot become a list or expansion placeholder from an executable root',async()=>{
 for(const system of ['C:\\Win;Other\\System32','C:\\%Windows%\\System32']){const exe=path.join(system,'WindowsPowerShell','v1.0','powershell.exe'),a=createShellProfileCatalogue({modulePathPolicy:'system-seeded',getSystemDirectory:async()=>system,inspectExecutable:async()=>file(exe),inspectModuleDirectory:async p=>directory(p),readEnvironment:async()=>({SystemRoot:'C:\\Windows',PATH:'x'}),authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true})});await refuses(()=>a.resolveShellProfile('powershell'));}
});
test('private policy never becomes renderer-supplied create authority',async()=>{const {dispatchTerminalRequest}=await import('../src/terminal/contracts.mjs');let calls=0;for(const extra of [{modulePathPolicy:'system-seeded'},{inspectModuleDirectory:()=>directory()},{env:{PSModulePath:modulePath}}]){const r=await dispatchTerminalRequest({method:'terminalCreate',payload:{operationId:'op',epoch:1,cwdId:'cwd',profileId:'powershell',cols:80,rows:24,...extra},dispatch:()=>{calls++;return{ok:true};}});assert.equal(r.code,'REQUEST_REFUSED');}assert.equal(calls,0);});
test('unknown module-provider thenable is retained without false lifetime settlement',async()=>{let hooks=0;const {catalogue}=fixture({inspectModuleDirectory:()=>Object.defineProperty({},'then',{get(){hooks++;throw Error('private');}})});await refuses(()=>catalogue.resolveShellProfile('powershell'));const h=captureShellProfileSettlement(catalogue);catalogue.dispose();await tick();assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().actualSettled,false);assert.equal(hooks,0);});
test('oversized module ancestry refuses before traversing entry hooks',async()=>{let hooks=0;const {s,catalogue}=fixture();s.directory.ancestors=Array.from({length:129},()=>Object.defineProperty({},'path',{enumerable:true,get(){hooks++;return 'private';}}));await refuses(()=>catalogue.resolveShellProfile('powershell'));assert.equal(hooks,0);});
test('final Modules provider reentrant revoke cannot publish an environment envelope',async()=>{let a,seen=0;const {s,catalogue}=fixture({inspectModuleDirectory:async p=>{if(++seen===2)a.revoke();return directory(p);}});a=catalogue;await refuses(()=>a.resolveShellProfile('powershell'),'SENDER_REFUSED');assert.equal(seen,2);assert.equal(s.calls.includes('environment'),true);});
