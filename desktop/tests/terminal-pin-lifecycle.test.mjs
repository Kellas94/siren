// OWNER: finite MAIN/registry/manager compositions; no native or PIN storage proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {win32 as path} from 'node:path';
import {createPinLifecycleServices} from '../src/account/pin-lifecycle.mjs';
import {allowedAppFile} from '../scripts/package.mjs';
import {TerminalProductionAccessTransitions} from '../src/terminal/production-access-transitions.mjs';
import {TerminalRequestRouter} from '../src/terminal/request-router.mjs';
import {CwdAuthority} from '../src/terminal/cwd.mjs';
import {createShellProfileCatalogue} from '../src/terminal/profiles.mjs';
import {privateManager,deferred,until} from './fixtures/terminal-production-manager-private.mjs';
const api=await import('../src/terminal/pin-lifecycle-owner.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function directory(value){const p=path.normalize(value),root=path.parse(p).root,parts=p.slice(root.length).split('\\').filter(Boolean),ancestors=[{path:root,identity:root,directory:true,reparse:false}];let parent=root;for(const part of parts){parent=path.join(parent,part);ancestors.push({path:parent,identity:parent,directory:true,reparse:false});}return{canonicalPath:p,identity:p,directory:true,reparse:false,ancestors};}
function setup(options={}){
 assert.equal(typeof api.createTerminalPinLifecycleServices,'function','Missing real MAIN/PIN lifecycle services');
 const h=privateManager(options.manager),trace=[],event={sender:h.window.webContents,senderFrame:h.window.webContents.mainFrame};let busy=false,quiesced=false,pin=true,selection=1;
 const prepare=async()=>{trace.push('cancel');trace.push('drain');await options.drain?.();trace.push('prepare');await options.prepare?.();quiesced=true;trace.push('writes');};
 const retire=async()=>{trace.push('retire');await options.retire?.();h.registry.invalidateEpoch({preserveWorkspace:true});};
 const rollback=async()=>{trace.push('rollback');quiesced=false;if(!h.capture())h.registry.activateWorkspace();await options.rollback?.();};
 const cwd=new CwdAuthority({pickDirectory:()=>Promise.resolve({canceled:true,filePaths:[]}),protectedRoots:[],inspectDirectory:p=>Promise.resolve(directory(p)),authorize:g=>h.registry.isCurrent(g),captureAdmission:g=>h.registry.captureAdmissionGuard(g)});
 const catalogue=createShellProfileCatalogue({getSystemDirectory:()=>Promise.resolve('C:\\Windows\\System32'),inspectExecutable:p=>Promise.resolve({...directory(path.dirname(p)),canonicalPath:p,identity:p,file:true,directory:undefined}),readEnvironment:()=>Promise.resolve({}),authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true})});
 const router=new TerminalRequestRouter({registry:h.registry,manager:h.manager});
 const access=new TerminalProductionAccessTransitions({manager:h.manager,router,registry:h.registry,cwdAuthority:cwd,profileCatalogues:[catalogue],projectId:'project1',prepareWorkspace:prepare,retireViews:retire,rollbackWorkspace:rollback,isReady:()=>pin&&!busy&&selection===1,deadlineMs:200});
 const config={isLockBusy:()=>busy,isUnlockBusy:()=>busy,enterTransition:()=>{busy=true;trace.push('enter');},leaveTransition:()=>{busy=false;quiesced=false;trace.push('leave');},isUnlocked:()=>pin,prepareWorkspace:prepare,retireViews:retire,rollbackWorkspace:rollback,endAccountTransition:async()=>{trace.push('end');},activateWorkspace:()=>{trace.push('activate');if(!h.capture())h.registry.activateWorkspace();},commitLock:()=>{pin=false;h.access.unlocked=false;trace.push('commit');},verifyUnlock:async payload=>{trace.push('verify');await options.verify?.();if(payload.pin!=='correct')return{ok:false,code:'WRONG_PIN'};pin=true;h.access.unlocked=true;return{ok:true};},afterUnlock:async result=>{trace.push('after');return result;},runWhenReady:operation=>operation(),captureUnlockScope:()=>{const captured=selection,frame=event.senderFrame;return{event:{sender:event.sender,senderFrame:frame},isCurrent:()=>{options.onCurrent?.({h,changeSelection:()=>selection++});return selection===captured&&frame===h.window.webContents.mainFrame&&!busy;}};},...(options.defaultOff?{}:{terminalAccess:access})};
 const services=options.defaultOff?createPinLifecycleServices(config):api.createTerminalPinLifecycleServices(config);
 return{h,trace,router,access,config,services,event,get pin(){return pin;},get busy(){return busy;},get quiesced(){return quiesced;},changeSelection(){selection++;},async end(){await h.end();}};
}
test('real coordinator fences input and router synchronously before held PIN/editor drain without Stop',async()=>{const hold=deferred(),s=setup({drain:()=>hold.promise});try{const session=await s.h.ready(''),lease=(await s.h.attach(session)).value,before=s.h.calls.stopSession??0;const pending=s.services.lockPin();assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.router.stats().revoked,true);assert.equal(s.access.currentRouter(),null);assert.deepEqual(s.trace.slice(0,3),['enter','cancel','drain']);assert.equal((await s.h.input(lease,0,'must not run')).ok,false);assert.equal(s.h.calls.stopSession??0,before);assert.equal(s.pin,true);hold.resolve();assert.equal((await pending).ok,true);assert.equal(s.pin,false);assert.equal(s.h.calls.stopSession??0,before);}finally{hold.resolve();await s.end();}});
test('correct unlock uses real new registry epoch and correlated OPEN after rollback, old router stays revoked',async()=>{const s=setup();try{await s.h.ready('');const old=s.h.grant;assert.equal((await s.services.lockPin()).ok,true);assert.equal((await s.services.unlockPin({pin:'correct'})).ok,true);assert.equal(s.h.registry.isCurrent(old),false);assert(s.access.currentRouter() instanceof TerminalRequestRouter);const grant=s.h.capture();assert(grant.epoch>old.epoch);assert.equal((await s.access.currentRouter().route({event:s.event,method:'terminalList',payload:{operationId:'fresh',epoch:grant.epoch}})).ok,true);}finally{await s.end();}});
test('wrong PIN leaves actual manager closed and never opens a fresh router',async()=>{const s=setup();try{await s.h.ready('');await s.services.lockPin();const count=s.h.calls.sendGate;assert.equal((await s.services.unlockPin({pin:'wrong'})).code,'WRONG_PIN');assert.equal(s.h.calls.sendGate,count);assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.access.currentRouter(),null);}finally{await s.end();}});
test('selection changed during correct verification cannot reopen',async()=>{const hold=deferred(),s=setup({verify:()=>hold.promise});try{await s.h.ready('');await s.services.lockPin();const pending=s.services.unlockPin({pin:'correct'});s.changeSelection();hold.resolve();assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.access.currentRouter(),null);}finally{hold.resolve();await s.end();}});
test('failed Lock does not commit PIN or OPEN and rollback keeps Terminal fenced',async()=>{const s=setup({prepare:()=>Promise.reject(Error('held editor refused'))});try{await s.h.ready('');const result=await s.services.lockPin();assert.equal(result.code,'SAVE_FAILED');assert.equal(s.pin,true);assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.access.currentRouter(),null);assert(!s.trace.includes('commit'));}finally{await s.end();}});
test('default-off services preserve original Lock order and unlock result identity',async()=>{const s=setup({defaultOff:true});try{await s.h.ready('');assert.equal((await s.services.lockPin()).ok,true);assert.deepEqual(s.trace,['enter','cancel','drain','prepare','writes','retire','commit','leave']);assert.equal(s.h.manager.stats().inputClosed,false,'default path has no Terminal owner');assert.equal((await s.services.unlockPin({pin:'wrong'})).code,'WRONG_PIN');}finally{await s.end();}});
test('forged access and own overrides cannot substitute the actual coordinator methods',async()=>{const s=setup();try{assert.throws(()=>api.createTerminalPinLifecycleServices({...s.config,terminalAccess:{beginLock:()=>Promise.resolve({ok:true})}}));let calls=0;s.access.beginLock=()=>{calls++;return Promise.resolve({ok:true});};await s.h.ready('');assert.equal((await s.services.lockPin()).ok,true);assert.equal(calls,0);assert.equal(s.h.manager.stats().inputClosed,true);}finally{await s.end();}});

test('already-entered input remains charged through Lock and no new router publishes until actual settlement',async()=>{const hold=deferred();let held=false;const s=setup({manager:{wrap:{input:({invoke})=>held?hold.promise.then(()=>invoke()):invoke()}}});try{const session=await s.h.ready(''),attached=await s.router.route({event:s.event,method:'terminalAttach',payload:{operationId:'attach',epoch:s.h.grant.epoch,sessionId:session.sessionId}});assert.equal(attached.ok,true);held=true;const lease=attached.value,input=s.router.route({event:s.event,method:'terminalInput',payload:{operationId:'input',epoch:s.h.grant.epoch,sessionId:session.sessionId,leaseId:lease.leaseId,generation:lease.generation,inputSequence:0,data:'entered once'}});await until(()=>s.h.calls.input===1,'actual backend input entered');const stops=s.h.calls.stopSession??0;await s.services.lockPin();assert.equal(s.router.stats().pending,1);assert.equal((await s.services.unlockPin({pin:'correct'})).code,'ACCESS_REFUSED');assert.equal(s.access.currentRouter(),null);assert.equal(s.h.calls.stopSession??0,stops);hold.resolve();assert.equal((await input).ok,false);await until(()=>s.router.stats().pending===0,'actual input settled');assert.equal(s.h.calls.input,1);}finally{hold.resolve();await s.end();}});
test('final selection change after correlated OPEN synchronously fences the reopened router',async()=>{let armed=false,changed=false;const s=setup({onCurrent:({h,changeSelection})=>{if(armed&&!changed&&!h.manager.stats().inputClosed){changed=true;changeSelection();}}});try{await s.h.ready('');await s.services.lockPin();armed=true;assert.equal((await s.services.unlockPin({pin:'correct'})).code,'ACCESS_REFUSED');assert.equal(changed,true);assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.access.currentRouter(),null);}finally{await s.end();}});
test('a newer Lock during PIN verification prevents old correct unlock from OPEN',async()=>{const hold=deferred(),s=setup({verify:()=>hold.promise});try{await s.h.ready('');await s.services.lockPin();const pending=s.services.unlockPin({pin:'correct'});const newer=s.services.lockPin();hold.resolve();await newer;assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal(s.h.manager.stats().inputClosed,true);assert.equal(s.access.currentRouter(),null);}finally{hold.resolve();await s.end();}});

test('default package admits only lightweight PIN services and refuses optional Terminal owner',()=>{
 assert.equal(allowedAppFile('src/account/pin-lifecycle.mjs',new Set()),true);
 for(const path of ['src/terminal/pin-lifecycle-owner.mjs','src/terminal/production-access-transitions.mjs'])assert.equal(allowedAppFile(path,new Set()),false);
});
test('optional genuine-owner bridge refuses forged prototype, accessor and proxy without callouts',async()=>{
 const s=setup();let calls=0;try{
  const forged=Object.create(TerminalProductionAccessTransitions.prototype);
  assert.throws(()=>api.createTerminalPinLifecycleServices({...s.config,terminalAccess:forged}));
  const accessor={...s.config};Object.defineProperty(accessor,'terminalAccess',{enumerable:true,get(){calls++;return s.access;}});
  assert.throws(()=>api.createTerminalPinLifecycleServices(accessor));
  assert.throws(()=>api.createTerminalPinLifecycleServices({...s.config,terminalAccess:new Proxy(s.access,{get(){calls++;}})}));
  assert.throws(()=>api.createTerminalPinLifecycleServices({...s.config,terminalCoordination:{beginLock(){calls++;},reopen(){calls++;}}}));
  assert.equal(calls,0);
 }finally{await s.end();}
});
test('lightweight factory rejects Terminal access DATA and malformed trusted coordination',async()=>{
 const s=setup();try{
  assert.throws(()=>createPinLifecycleServices(s.config));
  const {terminalAccess,...plain}=s.config;
  for(const bad of [null,{},new Proxy({},{})])assert.throws(()=>createPinLifecycleServices({...plain,terminalCoordination:bad}));
  let calls=0;const getter={};Object.defineProperty(getter,'beginLock',{enumerable:true,get(){calls++;}});
  assert.throws(()=>createPinLifecycleServices({...plain,terminalCoordination:getter}));assert.equal(calls,0);
 }finally{await s.end();}
});
test('MAIN async unlock contract turns a synchronous readiness hook throw into Promise rejection',async()=>{
 const s=setup({defaultOff:true});try{
  const fault=Error('fixed readiness refusal');const services=createPinLifecycleServices({...s.config,runWhenReady(){throw fault;}});
  let pending;assert.doesNotThrow(()=>{pending=services.unlockPin({pin:'correct'});});
  assert(pending instanceof Promise);await assert.rejects(pending,error=>error===fault);
 }finally{await s.end();}
});
