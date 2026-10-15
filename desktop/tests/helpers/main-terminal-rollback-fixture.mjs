// Actual MAIN literals + candidate/graph/registry; every native/provider event is inert.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {types} from 'node:util';
import {createDesktopTerminalCandidate} from '../../src/terminal/candidate-initializer.mjs';
import {createTerminalShutdownGraph} from '../../src/terminal/shutdown-graph.mjs';
import {failure} from '../../src/ipc.mjs';
import {inertTick} from '../fixtures/terminal-production-inert.mjs';
// Add only a test-owned export of the actual bound inert MAIN window; all
// original helper composition and imported production module identities stay intact.
const donorURL=new URL('./terminal-desktop-lifecycle-fixture.mjs',import.meta.url);
const donor=await fs.readFile(donorURL,'utf8');
assert.equal(donor.split('return {graph,config,members,bridge,composition,state,registry,windows,caller,mainEvent,view,g,packet,create,tick,sent,timers,').length,2);
const exposed=donor.replace('return {graph,config,members,bridge,composition,state,registry,windows,caller,mainEvent,view,g,packet,create,tick,sent,timers,','return {main,graph,config,members,bridge,composition,state,registry,windows,caller,mainEvent,view,g,packet,create,tick,sent,timers,').replaceAll(/from '(\.[^']+)'/g,(_,path)=>`from '${new URL(path,donorURL).href}'`);
const {desktopFixture}=await import('data:text/javascript;base64,'+Buffer.from(exposed).toString('base64'));
const main=await fs.readFile(new URL('../../src/main.mjs',import.meta.url),'utf8');
function literal(start,end){const a=main.indexOf(start),b=main.indexOf(end,a+start.length);assert(a>=0&&b>a,start);return main.slice(a,b);}
const scopeStart=main.indexOf('// MAIN_TERMINAL_ROLLBACK_SCOPE_BEGIN'),scopeEnd=main.indexOf('// MAIN_TERMINAL_ROLLBACK_SCOPE_END');
const scopeLiteral=scopeStart<0?'':main.slice(scopeStart,scopeEnd+'// MAIN_TERMINAL_ROLLBACK_SCOPE_END'.length);
if(scopeStart>=0)assert(scopeEnd>scopeStart,'complete actual MAIN scope block');
const rollbackStart=main.match(/const rollbackNativePreparation\s*=\s*async[^{}]*=>\s*\{/)?.[0];assert(rollbackStart,'actual MAIN rollback function');
const rollbackLiteral=literal(rollbackStart,'const prepareNativeWorkspace=');
const closeLiteral=literal('let closing = false;','requestDocsDiagramScan();');
const accountLiteral=literal('  beginLogin: async () => {','  getUpdate:');
const readiness=main.match(/isReady:(\(\)=>Boolean\([^\r\n]+?\)),workspaceEvent:/)?.[1];assert(readiness,'actual public MAIN Terminal readiness expression');
const pinRollback=main.match(/rollbackWorkspace:(async\(\)=>\{await rollbackNativePreparation\([^)]*\);\})/)?.[1];assert(pinRollback,'actual PIN rollback callback');
export const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
export async function until(predicate,label='finite condition'){for(let i=0;i<240;i++){if(predicate())return;await inertTick();}assert.fail(label);}
export async function mainTerminalRollbackFixture({holdRollback=true,rejectRollback=false,enabled=true,launch=true,useActualPinHooks=false,originalPinHooks=false}={}){
 const s=await desktopFixture(),held=deferred(),entered=deferred(),rendererEnd=deferred(),handlers=new Map(),calls={rollback:0,prepare:0,rendererEnd:0,dialogs:[],warnings:[],activations:[],tokens:[]};
 const state={pin:true,dead:false,holdRendererEnd:false,onPrivateReady:null,onEditorResume:null},services={resume(){state.onEditorResume?.();},dispose(){}};
 let runtime=null,actual=null,context;
 const originalActivate=s.registry.activateWorkspace;
 s.registry.activateWorkspace=function(...args){
  // MAIN literals run in the VM realm. Translate only this closed DATA option;
  // actual registry navigation validation remains unchanged and authoritative.
  if(args.length===1&&args[0]&&typeof args[0]==='object'&&!types.isProxy(args[0])){const keys=Reflect.ownKeys(args[0]),d=Object.getOwnPropertyDescriptor(args[0],'entryUrl');if(keys.length===1&&keys[0]==='entryUrl'&&d&&Object.hasOwn(d,'value')&&typeof d.value==='string')args=[{entryUrl:d.value}];}
  const result=Reflect.apply(originalActivate,this,args);if(context)calls.activations.push({pin:context.pinTransition,account:context.accountTransition,selection:context.writes.selectionTransition===true,inputClosed:actual?.mainAuthorities().manager.stats().inputClosed??null,publicReady:context.terminalReady()});return result;
 };
 s.main.webContents.send=()=>{};
 const originalClose=s.main.close.bind(s.main);s.main.close=()=>{let prevented=false;s.main.emit('close',{preventDefault(){prevented=true;}});if(!prevented)originalClose();};
 s.main.webContents.executeJavaScript=async source=>{if(source.includes('EndAccountTransition')){calls.rendererEnd++;if(state.holdRendererEnd)await rendererEnd.promise;}};
 context=vm.createContext({window:s.main,terminalRuntime:null,workspaceBarrier:{dispose(){}},workspaceOwner:services,presentationSession:services,sourceAnalysis:services,diagramExports:services,docsExports:services,docsDiagrams:services,docsDiagramRefresh:services,presenterExports:services,nativeShells:new Map(),requestDocsDiagramScan(){},windowRegistry:s.registry,writes:new Set(),accountTransition:false,pinTransition:false,accountQuiesced:false,nativeReadonly:false,nativeShellFailure:false,
  failure,account:{beginLogin:async()=>({ok:false,code:'OWNED_ACCOUNT_REFUSAL'}),logout:async()=>({ok:false})},grants:new Set(),selectedId:'project1',snapshot:{project:{id:'project1'},revision:1,json:'{}',sha256:'a'.repeat(64),sourceRefs:[]},bootstrap:{selectionGeneration:1},mode:'normal',reason:null,
  localPin:{busy:false,state:()=>({unlocked:state.pin}),cancelPending(){},drain:async()=>{}},prepareNativeWorkspace:async()=>{calls.prepare++;if(runtime)await runtime.prepareTransition();throw Object.assign(Error('owned save refusal'),{code:'SAVE_FAILED'});},retireNativeViews:async()=>{},nativeLayoutMemory:{flush:async()=>true},app:{getVersion:()=> 'owned'},processIdentity:{pid:1},sessionId:'owned',journal:{recordSession:async()=>{}},dialog:{showErrorBox:(...args)=>calls.dialogs.push(args)},console:{info(){},warn:(...args)=>calls.warnings.push(args)}});
 vm.runInContext(scopeLiteral+'\n'+rollbackLiteral+'\nconst services={'+accountLiteral+'};globalThis.login=services.beginLogin;globalThis.logout=services.logout;\n'+closeLiteral+`\nglobalThis.terminalReady=${readiness};globalThis.actualPinRollback=${pinRollback};globalThis.rollback=rollbackNativePreparation;globalThis.captureScope=typeof captureTerminalRollbackScope==='function'?captureTerminalRollbackScope:()=>null;globalThis.scopeCurrent=typeof isTerminalRollbackScopeCurrent==='function'?isTerminalRollbackScopeCurrent:()=>false;globalThis.bindScope=typeof bindTerminalRollbackScope==='function'?bindTerminalRollbackScope:()=>false;globalThis.retireScope=typeof retireTerminalRollbackScope==='function'?retireTerminalRollbackScope:()=>{};`,context,{timeout:1000});
 if(enabled){let hooks={isLockBusy:()=>context.pinTransition||context.accountTransition,isUnlockBusy:()=>context.pinTransition,enterTransition:()=>{context.pinTransition=true;},leaveTransition:()=>{context.pinTransition=false;},isUnlocked:()=>state.pin,prepareWorkspace:async()=>{},retireViews:async()=>{},rollbackWorkspace:async()=>{calls.rollback++;entered.resolve();await context.actualPinRollback();if(rejectRollback)throw Error('OWNED_ROLLBACK_REFUSED');if(holdRollback)await held.promise;},endAccountTransition:async()=>{},activateWorkspace:()=>s.registry.activateWorkspace(),commitLock:()=>{state.pin=false;},verifyUnlock:async()=>({ok:false}),afterUnlock:async r=>r,runWhenReady:f=>f(),captureUnlockScope:()=>({event:s.mainEvent,isCurrent:()=>true})};
  if(useActualPinHooks){
   const hookSource=originalPinHooks?await fs.readFile(new URL('../../../main-terminal-rollback-correction-20261012/main-original.mjs',import.meta.url),'utf8'):main;
   const start=hookSource.indexOf('const pinLifecycleHooks={'),end=hookSource.indexOf('const pinLifecycle=',start);assert(start>=0&&end>start);
   vm.runInContext(hookSource.slice(start,end)+'\nglobalThis.actualMainPinHooks=pinLifecycleHooks;',context,{timeout:1000});
   const raw=context.actualMainPinHooks;hooks={};for(const key of Reflect.ownKeys(raw)){const d=Object.getOwnPropertyDescriptor(raw,key);assert.equal(typeof key,'string');assert(d&&Object.hasOwn(d,'value')&&typeof d.value==='function');hooks[key]=d.value;}
   hooks.rollbackWorkspace=async()=>{calls.rollback++;entered.resolve();await raw.rollbackWorkspace();if(rejectRollback)throw Error('OWNED_ROLLBACK_REFUSED');if(holdRollback)await held.promise;};
  }
  runtime=createDesktopTerminalCandidate({createGraph:async o=>{actual=createTerminalShutdownGraph({...s.config,access:o.access});assert.equal(actual.start().ok,true);return actual;}})({registry:s.registry,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},getProjectId:()=>context.selectedId,isReady:()=>context.terminalReady(),isRollbackReady:scope=>{calls.tokens.push(scope);state.onPrivateReady?.(scope);return context.scopeCurrent(scope);},workspaceEvent:()=>({sender:s.main.webContents,senderFrame:s.main.webContents.mainFrame}),pinHooks:hooks,windowFor:()=>s.view,getAppearance:async()=>({theme:'dark'}),systemDark:()=>true,openWindow:async()=>({ok:true})});
  context.terminalRuntime=runtime;if(launch)assert.equal((await handlers.get('siren:terminal-launch')(s.mainEvent)).ok,true,'actual initial candidate OPEN');
 }
 return{s,state,held,entered,rendererEnd,calls,context,runtime,handlers,actual:()=>actual,closeRequested:()=>vm.runInContext('closeRequested',context),async finish(){held.resolve();rendererEnd.resolve();for(let i=0;i<24;i++)await inertTick();context.selectedId='project1';s.state.project='project1';s.state.ready=true;state.pin=true;if(runtime)await runtime.dispose();await s.end();}};
}
