// Owner-authored SOURCE_ONLY tests. Actual registry/policy/backend/creator JS;
// the shared fixture supplies synthetic native observations and byte transport.
// No real Electron window, creator entry, addon, provider, shell or PTY executes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {TerminalPolicy} from '../src/terminal/policy.mjs';
import {TerminalProductionBackend} from '../src/terminal/production-backend.mjs';
import {TerminalProductionOwnership} from '../src/terminal/production-ownership.mjs';
import {createInertProductionComposition,inertConfig,inertTick,INERT_RUNTIME} from './fixtures/terminal-production-inert.mjs';
const {TerminalProductionManager}=await import('../src/terminal/production-manager.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
async function until(predicate,label){for(let n=0;n<400&&!predicate();n++)await inertTick();assert(predicate(),label);}
class InertWindow extends EventEmitter {
 constructor(){super();this.id=901;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:1901,mainFrame:{url:'siren://app/app.html'},isDestroyed:()=>false,getURL:()=>this.webContents.mainFrame.url});}
 isDestroyed(){return false;}isMinimized(){return false;}focus(){}restore(){}
}
function setup(options={}){
 assert.equal(typeof TerminalProductionManager,'function','Additive production lifecycle manager is missing');
 const composition=createInertProductionComposition({deadlineMs:1000,...options.inert}),window=new InertWindow(),access={unlocked:true,transition:false,mode:'normal'};
 const registry=new WindowRegistry({createWindow:()=>{throw Error('No satellite required');},authorize:()=>({projectId:'project1',mode:access.mode,access:'write',entityIds:[]})});registry.bindWorkspace(window);registry.activateWorkspace();
 const capture=()=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
 const policy=new TerminalPolicy({isCurrentGrant:g=>registry.isCurrent(g),isUnlocked:()=>access.unlocked,getMode:()=>access.mode,isCurrentLease:()=>false,canExecute:()=>true});
 const connect={actualSettled:false,release:()=>{}};let backend=composition.backend;
 if(options.holdConnect){
  // Retain only the forwarding continuation of the ACTUAL ownership result.
  // This holds a real backend await, not an invented Windows operation/result.
  const facet=Object.create(null),hold=deferred();connect.release=()=>hold.resolve();
  for(const name of ['prepareSession','allocateSession','connectSession','assertSessionCurrent','watchSessionRoot','captureSession','captureSessionSettlement','stopSession','verifyExit']){
   const original=Object.getOwnPropertyDescriptor(TerminalProductionOwnership.prototype,name).value;
   facet[name]=(...args)=>{const result=Reflect.apply(original,composition.ownership,args);if(name!=='connectSession')return result;
    return result.then(value=>{connect.actualSettled=true;return hold.promise.then(()=>value);},error=>{connect.actualSettled=true;return hold.promise.then(()=>{throw error;});});};
  }
  backend=new TerminalProductionBackend({ownership:facet,hostOwnerId:composition.ownership.snapshot().host.hostOwnerId,creator:INERT_RUNTIME,onUnavailable:()=>{},deadlineMs:1000});
 }
 const calls={cwd:0,profile:0};const config=inertConfig();
 const manager=new TerminalProductionManager({registry,policy,backend,accessReady:()=>access.unlocked&&!access.transition&&access.mode==='normal',deadlineMs:options.deadlineMs??1000,
  cwdAuthority:{resolve:(grant,id)=>{calls.cwd++;assert.equal(registry.isCurrent(grant),true);assert.equal(id,'cwd1');return options.cwd?options.cwd(grant):Promise.resolve(config.cwd);}},
  profilesFor:grant=>{if(options.catalogueFactory)options.catalogueFactory(grant);return{resolveShellProfile:id=>{calls.profile++;assert.equal(id,'powershell');return options.profile?options.profile(grant):Promise.resolve(config.shell);}};}});
 const create=(n=0,grant=capture())=>manager.create(grant,{operationId:'create_'+n,epoch:grant?.epoch??1,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40});
 const packet=(sessionId,n=0,grant=capture())=>({operationId:'stop_'+n,epoch:grant.epoch,sessionId});
 return{composition,backend,connect,window,access,registry,policy,manager,calls,capture,create,packet,
  stops:()=>composition.state.trace.filter(r=>r.name==='native-stop'),
  async open(){assert.equal((await manager.resumeInput()).ok,true);},
  async dispose(){connect.release();await manager.closeInput('test cleanup');await composition.dispose();}};
}

test('creation reserves all eight slots before held cwd resolution and ninth never invokes a resolver',async()=>{
 const held=deferred(),h=setup({cwd:()=>held.promise});try{await h.open();const pending=Array.from({length:8},(_,n)=>h.create(n));
  assert.equal(h.manager.stats().reservedSessions,8);assert.equal(h.calls.cwd,8);assert.equal((await h.create(9)).code,'CAPACITY_EXCEEDED');assert.equal(h.calls.cwd,8);assert.equal(h.composition.state.groups.length,0);
  await h.manager.closeInput('cancel held creates');held.resolve(inertConfig().cwd);assert((await Promise.all(pending)).every(r=>!r.ok));await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.composition.state.groups.length,0);
 }finally{held.resolve(inertConfig().cwd);await h.dispose();}
});

test('held profile resolution also retains eight slots without preparing a native owner',async()=>{
 const held=deferred(),h=setup({profile:()=>held.promise});try{await h.open();const pending=Array.from({length:8},(_,n)=>h.create(n));await until(()=>h.calls.profile===8,'all profiles held');
  assert.equal((await h.create(9)).code,'CAPACITY_EXCEEDED');assert.equal(h.composition.state.groups.length,0);await h.manager.closeInput('profile cancellation');held.resolve(inertConfig().shell);
  assert((await Promise.all(pending)).every(r=>!r.ok));assert.equal(h.manager.stats().reservedSessions,0);
 }finally{held.resolve(inertConfig().shell);await h.dispose();}
});

test('actual readiness publishes only safe session metadata and registers the production ledger',async()=>{
 const h=setup();try{await h.open();const r=await h.create();assert.equal(r.ok,true);assert.equal(r.value.state,'running');assert.equal(r.value.projectId,'project1');assert.equal(r.value.cwdDisplay,'C:\\Project Ω Space');
  assert.deepEqual(Object.keys(r.value).sort(),['attachedWindowId','cwdDisplay','droppedUtf8Bytes','exitCode','profileId','projectId','sessionId','state'].sort());assert.equal(h.manager.stats().ledgerSessions,1);assert.equal(h.composition.state.spawns.length,1);
  assert.equal(h.manager.nativeExecutionAdmitted,false);assert.equal(h.manager.stats().outputImplemented,true);
 }finally{await h.dispose();}
});

test('a cloned actual registry grant refuses before cwd/profile or native preparation',async()=>{
 const h=setup();try{await h.open();assert.equal((await h.create(0,{...h.capture()})).code,'SENDER_REFUSED');assert.equal(h.calls.cwd,0);assert.equal(h.calls.profile,0);assert.equal(h.composition.state.groups.length,0);
 }finally{await h.dispose();}
});

test('Lock start fences and advances access synchronously while registry and PIN still appear live',async()=>{
 const held=deferred(),h=setup({cwd:()=>held.promise});try{await h.open();const grant=h.capture(),pending=h.create(0,grant),before=h.manager.stats().accessGeneration;
  const closing=h.manager.closeInput('lock start');assert.equal(h.manager.stats().inputClosed,true);assert(h.manager.stats().accessGeneration>before);assert.equal(h.registry.isCurrent(grant),true);assert.equal(h.access.unlocked,true);
  assert.equal((await h.create(1,grant)).code,'PIN_REQUIRED');held.resolve(inertConfig().cwd);assert.equal((await pending).ok,false);await closing;assert.equal(h.composition.state.groups.length,0);
 }finally{held.resolve(inertConfig().cwd);await h.dispose();}
});

test('same-epoch aborted Lock reopening cannot revive an unobserved old cwd continuation',async()=>{
 const held=deferred(),h=setup({cwd:()=>held.promise});try{await h.open();const grant=h.capture(),pending=h.create(0,grant);await h.manager.closeInput('aborted lock');await h.open();
  assert.equal(h.registry.isCurrent(grant),true);held.resolve(inertConfig().cwd);assert.equal((await pending).ok,false);assert.equal(h.composition.state.groups.length,0);assert.equal((await h.create(1)).ok,true);assert.equal(h.composition.state.groups.length,1);
 }finally{held.resolve(inertConfig().cwd);await h.dispose();}
});

test('actual registry epoch invalidation prevents late source publication even after fresh activation',async()=>{
 const held=deferred(),h=setup({profile:()=>held.promise});try{await h.open();const grant=h.capture(),pending=h.create(0,grant);await until(()=>h.calls.profile===1,'held profile');
  h.registry.invalidateEpoch({preserveWorkspace:true});h.registry.activateWorkspace();const fresh=h.capture();assert(fresh.epoch>grant.epoch);held.resolve(inertConfig().shell);
  assert.equal((await pending).ok,false);assert.equal(h.composition.state.groups.length,0);assert.equal((await h.create(1,fresh)).ok,true);
 }finally{held.resolve(inertConfig().shell);await h.dispose();}
});

test('public create timeout retains an actual held resolver and refuses a ninth until settlement',async()=>{
 const held=deferred(),h=setup({deadlineMs:25,cwd:()=>held.promise});try{await h.open();const pending=Array.from({length:8},(_,n)=>h.create(n));const results=await Promise.all(pending);assert(results.every(r=>!r.ok));
  assert.equal(h.manager.stats().reservedSessions,8);assert.equal(h.manager.stats().pendingOperations,8);assert.equal((await h.create(9)).code,'CAPACITY_EXCEEDED');held.resolve(inertConfig().cwd);
  await until(()=>h.manager.stats().reservedSessions===0,'actual resolvers settled');assert.equal(h.composition.state.groups.length,0);assert.equal((await h.create(10)).ok,true);
 }finally{held.resolve(inertConfig().cwd);await h.dispose();}
});

test('Lock during actual provider readiness rolls back prepared ownership once without late running publication',async()=>{
 const h=setup({inert:{manualProvider:true}});try{await h.open();const pending=h.create();await until(()=>h.composition.state.groups[0]?.provider,'actual provider load held');const sessionId=h.composition.state.groups[0].id;
  await h.manager.closeInput('lock during connect');h.composition.releaseProvider(sessionId);assert.equal((await pending).ok,false);await until(()=>h.stops().length===1,'rollback stop');await h.manager.reconcile();
  assert.equal(h.stops()[0].code,98);assert.equal(h.manager.stats().ledgerSessions,0);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.composition.state.spawns.length,0);
 }finally{for(const g of h.composition.state.groups)if(g.provider)h.composition.releaseProvider(g.id);await h.dispose();}
});

test('explicit Stop uses 77 and retains capacity through unknown native cleanup, then reconciles without a second native Stop',async()=>{
 const h=setup({deadlineMs:50,inert:{manualNative:true,manualPeerClose:true}});try{await h.open();const made=await h.create();assert.equal(made.ok,true);const sessionId=made.value.sessionId;
  const first=await h.manager.stop(h.capture(),h.packet(sessionId));assert.equal(first.ok,false);assert.equal(h.manager.stats().reservedSessions,1);assert.equal(h.stops().length,1);assert.equal(h.stops()[0].code,77);
  h.composition.completeNative(sessionId);h.composition.completePeers(sessionId);await inertTick();await h.manager.reconcile();assert.equal(first.ok,false);assert.equal(h.stops().length,1);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.manager.stats().ledgerSessions,0);
 }finally{await h.dispose();}
});

test('failed caller connect receipt does not refund a still-running backend continuation after cleanup proof',async()=>{
 const h=setup({deadlineMs:40,holdConnect:true});try{await h.open();const pending=h.create();await until(()=>h.connect.actualSettled,'actual ownership connected behind held forwarding continuation');const sessionId=h.composition.state.groups[0].id;
  assert.equal((await pending).ok,false);await until(()=>h.stops().length===1,'rollback stop');await h.manager.reconcile();assert.equal(h.manager.stats().reservedSessions,1,'actual connect still retains backend reservation');
  assert.equal(h.backend.stats().pendingConnections,1);h.connect.release();await until(()=>h.backend.stats().pendingConnections===0,'actual connect finally');await h.manager.reconcile();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.stops().length,1);assert.equal(h.composition.state.spawns.length,0);assert.equal(typeof sessionId,'string');
 }finally{await h.dispose();}
});

test('readonly or unavailable access refuses reopening and fresh creation without native work',async()=>{
 const h=setup();try{h.access.transition=true;assert.equal((await h.manager.resumeInput()).ok,false);h.access.transition=false;await h.open();h.access.mode='readonly';
  assert.equal((await h.create()).ok,false);assert.equal(h.composition.state.groups.length,0);assert.equal(h.manager.stats().reservedSessions,0);
 }finally{await h.dispose();}
});

test('actual backend loss fences retained sessions and cannot reopen the lost manager lifetime',async()=>{
 const h=setup();try{await h.open();const made=await h.create();assert.equal(made.ok,true);h.composition.group(made.value.sessionId).creator.dispose();
  await until(()=>h.manager.stats().lost,'actual control/channel EOF fences manager via sole subscription');
  assert.equal((await h.manager.resumeInput()).ok,false);assert.equal(h.manager.stats().inputClosed,true);assert.equal((await h.create(1)).ok,false);
 }finally{await h.dispose();}
});

test('unimplemented attachment/output and host shutdown fail closed without claiming host exit',async()=>{
 const h=setup();try{await h.open();const made=await h.create();assert.equal(made.ok,true);
  assert.equal(h.policy.authorize({grant:h.capture(),method:'terminalAttach',session:made.value,epoch:h.capture().epoch}).ok,false,'actual policy currently rejects workspace attach');
  assert.equal((await h.manager.attach(h.capture(),h.packet(made.value.sessionId))).code,'SENDER_REFUSED');assert.equal((await h.manager.shutdown('test')).code,'HOST_SHUTDOWN_UNVERIFIED');
  assert.equal(h.manager.stats().inputClosed,true);assert.equal(h.composition.state.writes.length,0);
 }finally{await h.dispose();}
});

test('malformed resolved cwd or shell is validated before backend preparation and cannot consume lifetime capacity',async()=>{
 for(const kind of ['cwd','profile']){
  let valid=false,touched=0;const badShell={executable:inertConfig().shell.executable,args:['-NoLogo','-NoProfile'],get env(){touched++;throw Error('Getter must not run');}};
  const h=setup(kind==='cwd'?{cwd:()=>Promise.resolve(valid?inertConfig().cwd:'C:\\Project\\..\\Escape')}:{profile:()=>Promise.resolve(valid?inertConfig().shell:badShell)});
  try{await h.open();for(let n=0;n<9;n++){assert.equal((await h.create(n)).ok,false);assert.equal(h.manager.stats().reservedSessions,0,'invalid local DATA cannot reach ambiguous prepare');}
   assert.equal(touched,0);assert.equal(h.composition.state.groups.length,0);valid=true;assert.equal((await h.create(10)).ok,true);
  }finally{await h.dispose();}
 }
});

test('reentrant Lock from the trusted catalogue factory refuses its returned source without native allocation',async()=>{
 let h,closing;h=setup({catalogueFactory:()=>{closing=h.manager.closeInput('catalogue callback lock');}});try{await h.open();const pending=h.create();assert.equal((await pending).ok,false);await closing;
  assert.equal(h.calls.profile,0);assert.equal(h.composition.state.groups.length,0);assert.equal(h.manager.stats().reservedSessions,0);
 }finally{await h.dispose();}
});

test('tracking consumes the actual native Promise settlement without invoking an own then accessor or leaking a slot',async()=>{
 let touched=0;const h=setup({cwd:()=>{const actual=Promise.resolve(inertConfig().cwd);Object.defineProperty(actual,'then',{get(){touched++;throw Error('An own then property is not actual settlement');}});return actual;}});
 try{await h.open();const made=await h.create();assert.equal(touched,0,'private tracking must use the captured intrinsic Promise handler');assert.equal(made.ok,true);assert.equal(h.manager.stats().pendingOperations,0);
  const stopped=await h.manager.stop(h.capture(),h.packet(made.value.sessionId));assert.equal(stopped.ok,true);assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.stops().length,1);
 }finally{await h.dispose();}
});
