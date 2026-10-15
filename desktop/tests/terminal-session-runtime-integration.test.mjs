// Pure fixed probe-fragment regressions. No Electron/native/PTY is evaluated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,win32} from 'node:path';
import {runInNewContext} from 'node:vm';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {TerminalPolicy} from '../src/terminal/policy.mjs';
const parent=readFileSync(new URL('./native/terminal-session-runtime.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('./native/terminal-session-runtime-worker.mjs',import.meta.url),'utf8');
test('actual controller root expression yields canonical resource root without terminal separator',()=>{
 const match=parent.match(/const root=(.+?),suffix=context.run/);assert.ok(match);
 const expression=match[1].replace('import.meta.url','moduleUrl');
 const root=runInNewContext(expression,{fileURLToPath,URL,resolve,moduleUrl:new URL('./native/terminal-session-runtime.mjs',import.meta.url).href});
 assert.equal(root,resolve(root),'resource inspector refuses trailing empty path components');
 assert.equal(win32.basename(root),'portable');
});
test('actual pre-Lock observation reads existing held capabilities without recapturing them',()=>{
 const start=worker.indexOf('const beforeSession='),end=worker.indexOf('const expected=',start);assert.ok(start>0&&end>start);
 const host={},session={},calls=[];
 const native={capture(){assert.fail('host held set already captured');},captureSession(){assert.fail('backend already captured Session held set');},snapshot(cap){assert.equal(cap,host);calls.push('host');return{root:{alive:true}};},snapshotSession(cap){assert.equal(cap,session);calls.push('session');return{shell:{alive:true}};}};
 const observed=runInNewContext(worker.slice(start,end)+';({beforeSession,beforeHost})',{native,nativeState:{host,sessions:[session]}});
 assert.equal(observed.beforeSession.shell.alive,true);assert.equal(observed.beforeHost.root.alive,true);assert.deepEqual(calls,['session','host']);
});

test('post-Lock refusal uses the original captured event without touching a destroyed Electron window',async()=>{
 const start=worker.indexOf('const refused=await first.router.route'),end=worker.indexOf(';assert.equal(refused.ok',start);assert.ok(start>0&&end>start);
 const caller={sender:{},senderFrame:{}},first={caller,grant:{epoch:1},lease:{sessionId:'session1'},w:{}};
 first.router={async route(q){assert.equal(q.event,caller);return{ok:false};}};
 const observed=await runInNewContext('(async()=>{'+worker.slice(start,end)+';return refused;})()',{
  first,event(){throw Error('Electron window is already destroyed');},request:(_grant,fields)=>fields,fixture:{forbiddenInput:'fixed probe only'}
 });
 assert.equal(observed.ok,false);
});

test('actual failure path keeps the native capability in scope and preserves history before cleanup',async()=>{
 const declaration=worker.match(/^ let graph[^\n]+/m)[0];
 const nativeLine=worker.match(/^  (?:const native=|native=)[^\n]+/m)[0].replace('import.meta.url','moduleUrl');
 const start=worker.indexOf('  if(members)try{'),end=worker.indexOf('\n  if(graph)try{',start);assert.ok(start>0&&end>start);
 const saved=[],cap={},snapshot={alive:true},history={chunks:['fixed fixture error']},result={};
 await runInNewContext('(async()=>{'+declaration+';members=fixtureMembers;try{'+nativeLine+';throw Error("fixed probe failure");}catch{'+worker.slice(start,end)+'} })()',{
  fixtureMembers:{ownership:{snapshot:()=>({sessions:[{state:'running',sessionOwnerId:'owner'}]})},backend:{readHistory:async q=>{assert.equal(q.ownerId,'owner');return history;}}},
  createRequire:()=>()=>({mark:()=>0,snapshotSession:q=>{assert.equal(q,cap);return snapshot;}}),moduleUrl:'fixed probe',addonPath:'fixed addon',
  nativeState:{sessions:[cap]},Object,result,bounded:async p=>p,save:async(name,value)=>saved.push({name,value})
 });
 assert.equal(result.failureDiagnosticError,undefined);
 assert.deepEqual(saved.map(r=>r.name),['failure-ownership.json','failure-native-session.json','failure-history.json']);
 assert.equal(saved[2].value,history);
});

test('actual attachment retains the router canonical genuine grant for private output handoff',async()=>{
 const start=worker.indexOf('  async function attach(){'),end=worker.indexOf('\n  const first=await attach();',start);assert.ok(start>0&&end>start);
 const record={windowId:'window1'},routerGrants=new Map(),w={isDestroyed:()=>false,webContents:{getURL:()=> 'siren://app/windows/terminal.html?windowId=window1',mainFrame:{}}};
 let managerGrant,sequence=0;
 const registry={openView:async()=>record,capture:()=>{const grant={role:'terminal',windowId:'window1',capture:++sequence};routerGrants.set('window1',grant);return grant;}};
 const router={route:async q=>{managerGrant=registry.capture(q.event);return{ok:true,value:{leaseId:'lease1',generation:1}};}};
 const attached=await runInNewContext('(async()=>{'+worker.slice(start,end)+';return attach();})()',{
  registry,routerGrants,windows:new Set([w]),event:window=>({sender:window.webContents}),members:{access:{currentRouter:()=>router}},sessionId:'session1',request:(_grant,fields)=>fields,assert
 });
 assert.equal(attached.grant,managerGrant);
 assert.equal(attached.grant.capture,2);
});

test('actual policy observer receives genuine grants when native access bypasses own capture hooks',async()=>{
 const routerGrants=new Map();
 const expression=worker.match(/canExecute:(g=>\{routerGrants\.set\(g\.windowId,g\);return true;\})/);assert.ok(expression);
 const canExecute=runInNewContext('('+expression[1]+')',{routerGrants});let view;
 class InertView extends EventEmitter{
  constructor(url){super();this.id=1;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:1001,mainFrame:{url},getURL:()=>url,isDestroyed:()=>false});}
  isDestroyed(){return false;}isMinimized(){return false;}restore(){}focus(){}close(){}destroy(){}
 }
 const registry=new WindowRegistry({terminalViews:true,authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:['session1']}),createWindow:q=>view=new InertView(q.mainFrameUrl)});
 await registry.openView({role:'terminal',entityId:'session1'});assert.equal(Object.getPrototypeOf(registry),WindowRegistry.prototype);
 registry.capture=()=>assert.fail('native access uses its captured original prototype');
 const event={sender:view.webContents,senderFrame:view.webContents.mainFrame};
 const preflight=Reflect.apply(WindowRegistry.prototype.capture,registry,[event]);
 const canonical=Reflect.apply(WindowRegistry.prototype.capture,registry,[event]);assert.notEqual(preflight,canonical);
 const policy=new TerminalPolicy({isCurrentGrant:g=>registry.isCurrent(g),isUnlocked:()=>true,getMode:()=> 'normal',canExecute,isCurrentLease:()=>true});
 const reply=policy.authorize({grant:canonical,method:'terminalAttach',session:{sessionId:'session1',projectId:'project1'},epoch:canonical.epoch});
 assert.equal(reply.ok,true);assert.equal(routerGrants.get(canonical.windowId),canonical);
 assert.equal(registry.isCurrent(canonical),true);assert.equal(registry.isCurrent({...canonical}),false);
});

test('pre-Lock progress observation requires a returned first sleep and has a finite adverse deadline',async()=>{
 const start=worker.indexOf(' const waitProgress='),end=worker.indexOf('\n',start);assert.ok(start>0);
 const fragment=worker.slice(start,end)+';waitProgress("fixed-stage")';let reads=0,delays=0;
 const progress=await runInNewContext(fragment,{readFile:async()=>++reads===1?'sleeping:0':'checking:1',delay:async()=>{delays++;}});
 assert.equal(progress.observedBeforeLock,true);assert.equal(progress.stage,'checking:1');assert.equal(delays,1);
 reads=0;delays=0;
 await assert.rejects(runInNewContext(fragment,{readFile:async()=>{reads++;return 'sleeping:0';},delay:async()=>{delays++;}}),/FIXTURE_PRELOCK_PROGRESS_DEADLINE/);
 assert.equal(reads,300);assert.equal(delays,300);
});

test('hosted shell environment retains only explicit normal Windows context and pinned system paths',async()=>{
 const expression=worker.match(/readEnvironment:(async\(\)=>\{[^\n]+?\}),privateEnvironmentKeys/);assert.ok(expression);
 const callback=runInNewContext('('+expression[1]+')',{systemRoot:'C:\\Windows',system:'C:\\Windows\\System32',process:{env:{USERPROFILE:'C:\\Users\\fixture',TEMP:'C:\\Temp',APPDATA:'C:\\Users\\fixture\\AppData\\Roaming',PATH:'untrusted inherited path',SystemRoot:'untrusted inherited root',GITHUB_TOKEN:'fixture-secret',ACTIONS_RUNTIME_TOKEN:'fixture-secret',NODE_OPTIONS:'fixture-option',PSModulePath:'fixture-injected-module'}}});
 const env=await callback();assert.equal(env.SystemRoot,'C:\\Windows');assert.equal(env.PATH,'C:\\Windows\\System32;C:\\Windows');
 assert.equal(env.USERPROFILE,'C:\\Users\\fixture');assert.equal(env.TEMP,'C:\\Temp');
 for(const key of ['GITHUB_TOKEN','ACTIONS_RUNTIME_TOKEN','NODE_OPTIONS','PSModulePath'])assert.equal(Object.hasOwn(env,key),false);
});

async function observerReadyFragment(chunks){
 const start=worker.indexOf('const observerReady=new Promise('),end=worker.indexOf('\n  const observed=',start);assert.ok(start>0&&end>start);
 const stdout=new EventEmitter(),stderr=new EventEmitter(),observer=new EventEmitter();observer.stdout=stdout;observer.stderr=stderr;
 const ready=runInNewContext(worker.slice(start,end)+';observerReady',{observer,observerStdout:'',observerStderr:'',Promise,Error});
 let state='pending';ready.then(()=>state='resolved',()=>state='rejected');
 for(const chunk of chunks){stdout.emit('data',chunk);await Promise.resolve();assert.equal(state,'pending','incomplete stdout line cannot settle READY');}
 return {stdout,ready};
}
test('actual observer READY waits for a complete newline-framed JSON across stdout chunks',async()=>{
 const f=await observerReadyFragment(['{"status":"REA','DY","identities":[',']}']);f.stdout.emit('data','\r\n');assert.deepEqual(JSON.parse(JSON.stringify(await f.ready)),{status:'READY',identities:[]});
});
test('complete malformed observer JSON is refused instead of accepted as READY',async()=>{
 const f=await observerReadyFragment(['{"status":']);f.stdout.emit('data','invalid}\n');await assert.rejects(f.ready,/OBSERVER_READY_JSON/);
});
