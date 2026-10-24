// Inactive candidate-only owner. No import/construction I/O or native loading.
// Adapter callbacks are trusted private MAIN prerequisites, NOT renderer APIs.
import {types} from 'node:util';
import {WindowRegistry} from '../windows/registry.mjs';
import {createTerminalShutdownGraph,shutdownTerminalGraph,captureTerminalGraphAuthorities,captureTerminalGraphShutdownRequest} from './shutdown-graph.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';
import {recheckDesktopNativeRuntimeResources,desktopNativeRuntimeResourcePaths} from './desktop-native-runtime-resources.mjs';
const apply=Reflect.apply;
const methods=Object.fromEntries(['capture','isCurrent','captureAdmissionGuard'].map(k=>[k,Object.getOwnPropertyDescriptor(WindowRegistry.prototype,k).value]));
const frozen=o=>Object.freeze(o),failure=code=>{throw Error(code);};
function data(v,keys){if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return null;const names=Reflect.ownKeys(v);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))return null;const r=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;}
const callable=f=>typeof f==='function'&&!types.isProxy(f);
function callbacks(v,keys){const r=data(v,keys);if(!r||Object.values(r).some(f=>!callable(f)))failure('DESKTOP_NATIVE_ADAPTER_REFUSED');return frozen(r);}
function promise(p){if(!supportedProviderPromise(p))failure('DESKTOP_NATIVE_SETTLEMENT_UNKNOWN');return p;}
export function createDesktopNativeRuntimeOwner(options={},...extra){
 const o=data(options,[])??data(options,['adapter']);if(extra.length||!o)failure('DESKTOP_NATIVE_ADAPTER_REFUSED');
 const adapterKeys=['captureResources','verifyResourceClosure','reserveHost','providers','isCurrent'];
 // Future MAIN bindings supply the sixth callback. Legacy construction remains
 // compatible, but entered providers without retirement cannot verify cleanup.
 const adapter=o.adapter==null?null:callbacks(o.adapter,data(o.adapter,[...adapterKeys,'retireProviders'])?[...adapterKeys,'retireProviders']:adapterKeys);
 // One real startup attempt. Allocate all settlement promises while private,
 // before public methods can be reentered by native Promise-init hooks.
 const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
 const started=deferred(),finished=deferred(),retirement=deferred(),disposal=deferred();started.promise.catch(()=>{});
 let state='idle',cell=null,serial=0,disposed=false;
 let validating=false;
 const snapshot=()=>frozen({scope:'UNQUALIFIED_DESKTOP_NATIVE_CANDIDATE',configured:!!adapter,state,disposed,pending:!!cell?.pending,cleanupVerified:cell?.clean===true,nativeExecutionAdmitted:false});
 function completed(c){c.clean=!c.pending&&c.parts===true;if(c.retirement&&!c.pending&&c.parts!==undefined)state=c.clean?'retired':'blocked';}
 function retire(c){
  if(c.retirement)return c.retirement;
  c.retirement=retirement.promise;
  state='retiring';
  // Select the actual graph operation before allocating observer promises.
  // shutdown() copies its input; recapture that stored immutable request so
  // emergency retirement shares the same object, code, deadline and ID.
  const fallback=()=>frozen({code:77,deadlineMs:5000,shutdownId:'desktop_native_'+ ++serial});
  const jsRequired=!!(c.graph&&c.started);let jsActual=null,requestVerified=!jsRequired;
  if(jsRequired){
   try{
    c.shutdownRequest=captureTerminalGraphShutdownRequest(c.graph)??fallback();
    jsActual=shutdownTerminalGraph(c.graph,c.shutdownRequest);
    const actual=captureTerminalGraphShutdownRequest(c.graph);
    if(actual){c.shutdownRequest=actual;requestVerified=true;}
   }catch{}
  }
  c.shutdownRequest??=fallback();
  // Reserve before reentrant private retirement callbacks. Request every lane
  // before awaiting either: an unknown graph join must not suppress emergency
  // utility/native retirement, and that retirement cannot prove the JS join.
  // Keep this deferral: a reentrant reserveHost must first return its capability.
  void Promise.resolve().then(async()=>{
   const jsWork=(async()=>{if(!jsRequired)return true;if(!requestVerified)return false;try{const r=await promise(jsActual);return r?.actualSettled===true&&r.unknown===false;}catch{return false;}})();
   const nativeWork=(async()=>{if(!c.host)return !c.reservationEntered;try{const result=await promise(apply(c.host.retire,c.host.receiver,[c.shutdownRequest]));const r=data(result,['utilityExited','nativeCleanupVerified']);return r?.utilityExited===true&&r.nativeCleanupVerified===true;}catch{return false;}})();
   const providerWork=(async()=>{
    if(!adapter?.retireProviders)return !c.providersEntered;
    try{
     const pending=apply(adapter.retireProviders,undefined,[]);
     // Owner settlements cannot be returned as provider settlements: disposal
     // itself joins this lane, so accepting them would create a self-dependency.
     if([started.promise,finished.promise,retirement.promise,disposal.promise].includes(pending))return false;
     const result=await promise(pending),r=data(result,['retired','actualSettled','pending','nativeExecutionAdmitted']);
     return r?.retired===true&&r.actualSettled===true&&r.pending===0&&r.nativeExecutionAdmitted===false;
    }catch{return false;}
   })();
   const [js,native,providers]=await Promise.all([jsWork,nativeWork,providerWork]);
   c.parts=js&&native&&providers;completed(c);
  }).then(()=>retirement.resolve(),()=>{c.parts=false;completed(c);retirement.resolve();});return c.retirement;
 }
 function createGraph(value,...args){
  // Preserve rejected-Promise outcomes while fencing before any promise or
  // private callback can expose an apparently idle second startup attempt.
  let ownsValidation=false;try{
  if(!adapter||disposed)failure('DESKTOP_NATIVE_RUNTIME_UNAVAILABLE');
  if(args.length||state!=='idle'||validating)failure('DESKTOP_NATIVE_RUNTIME_BUSY');
  validating=true;ownsValidation=true;
  const p=data(value,['registry','projectId','workspaceEvent','access']);
  if(!p||!p.registry||types.isProxy(p.registry)||Object.getPrototypeOf(p.registry)!==WindowRegistry.prototype||typeof p.projectId!=='string'||! /^[a-z0-9][a-z0-9_-]{0,127}$/.test(p.projectId))failure('DESKTOP_NATIVE_REQUEST_REFUSED');
  let grant,guard;try{grant=apply(methods.capture,p.registry,[p.workspaceEvent]);guard=apply(methods.captureAdmissionGuard,p.registry,[grant]);}catch{failure('DESKTOP_NATIVE_REQUEST_REFUSED');}
  if(!guard||grant.role!=='workspace'||grant.projectId!==p.projectId)failure('DESKTOP_NATIVE_REQUEST_REFUSED');
  const access=callbacks(p.access,['prepareWorkspace','retireViews','rollbackWorkspace','isReady']);
  if(disposed)failure('DESKTOP_NATIVE_RUNTIME_UNAVAILABLE');
  const context=frozen({registry:p.registry,projectId:p.projectId,grant});
  const c=cell={pending:true,done:finished.promise,graph:null,host:null,started:false,clean:false,reservationEntered:false,providersEntered:false,retirement:null};state='starting';validating=false;ownsValidation=false;
  const current=()=>{
   if(disposed||cell!==c||c.retirement)return false;
   const answer=apply(adapter.isCurrent,undefined,[context]);
   // Recheck genuine admission AFTER the private reentrant MAIN callback.
   return answer===true&&!disposed&&cell===c&&!c.retirement&&guard.isCurrent()&&apply(methods.isCurrent,p.registry,[grant])===true;
  };
  async function begin(){try{
   if(!current())failure('DESKTOP_NATIVE_STALE');
   const resources=await promise(apply(adapter.captureResources,undefined,[]));
   const paths=desktopNativeRuntimeResourcePaths(resources);if(!paths||!current()||!await recheckDesktopNativeRuntimeResources(resources))failure('DESKTOP_NATIVE_RESOURCE_REFUSED');
   if(!current()||await promise(apply(adapter.verifyResourceClosure,undefined,[resources]))!==true||!current())failure('DESKTOP_NATIVE_RESOURCE_REFUSED');
   c.providersEntered=true;
   const providers=await promise(apply(adapter.providers,undefined,[context,resources]));
   const provider=data(providers,['cwd','profiles','policy']);if(!provider||!current()||!await recheckDesktopNativeRuntimeResources(resources)||!current())failure('DESKTOP_NATIVE_PROVIDERS_REFUSED');
   const pp=data(provider.profiles,['getSystemDirectory','inspectExecutable','readEnvironment','privateEnvironmentKeys','modulePathPolicy','inspectModuleDirectory']);
   const cp=data(provider.cwd,['pickDirectory','protectedRoots','inspectDirectory']);
   const pol=callbacks(provider.policy,['isUnlocked','getMode','canExecute']);
   if(!pp||!cp||pp.modulePathPolicy!=='system-seeded'||![pp.getSystemDirectory,pp.inspectExecutable,pp.readEnvironment,pp.inspectModuleDirectory,cp.pickDirectory,cp.inspectDirectory].every(callable))failure('DESKTOP_NATIVE_PROVIDERS_REFUSED');
   // The graph validates/copies bounded arrays; copy before the host await so
   // private adapter mutation cannot redirect the captured provider methods.
   const array=(value,max)=>{if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)failure('DESKTOP_NATIVE_PROVIDERS_REFUSED');const out=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string')failure('DESKTOP_NATIVE_PROVIDERS_REFUSED');out.push(d.value);}if(Reflect.ownKeys(value).length!==out.length+1)failure('DESKTOP_NATIVE_PROVIDERS_REFUSED');return frozen(out);};
   pp.privateEnvironmentKeys=array(pp.privateEnvironmentKeys,128);cp.protectedRoots=array(cp.protectedRoots,16);
   if(await promise(apply(adapter.verifyResourceClosure,undefined,[resources]))!==true||!current())failure('DESKTOP_NATIVE_RESOURCE_REFUSED');
   // Reservation is synchronous; its retained actual retirement capability must
   // exist before waiting for utility startup. A throwing launcher is UNKNOWN.
   c.reservationEntered=true;
   const raw=apply(adapter.reserveHost,undefined,[resources]);const host=data(raw,['ready','retire']);
   if(!host||!callable(host.retire)||!supportedProviderPromise(host.ready))failure('DESKTOP_NATIVE_SETTLEMENT_UNKNOWN');
   c.host={receiver:raw,retire:host.retire};
   const started=await host.ready,ready=data(started,['native','hostProcessIdentity']);
   if(!ready||!current()||!await recheckDesktopNativeRuntimeResources(resources)||!current())failure('DESKTOP_NATIVE_STALE');
   if(await promise(apply(adapter.verifyResourceClosure,undefined,[resources]))!==true||!current())failure('DESKTOP_NATIVE_RESOURCE_REFUSED');
   // Never accept an adapter-supplied graph, grant roster or creator path.
   c.graph=createTerminalShutdownGraph({registry:p.registry,projectId:p.projectId,native:ready.native,hostProcessIdentity:ready.hostProcessIdentity,creator:{executable:paths.executable,entry:paths.entry,directory:paths.creatorDirectory},ownership:{isCurrent:()=>{if(disposed||c.retirement)return false;const answer=apply(adapter.isCurrent,undefined,[context]);return answer===true&&!disposed&&!c.retirement;},onUnavailable:()=>{state='blocked';},onVerified:()=>{}},cwd:cp,profiles:{...pp,grants:[grant]},policy:pol,access,deadlineMs:5000});
   c.graphHandle=c.graph.captureSettlement();
   if(!current())failure('DESKTOP_NATIVE_STALE');
   c.started=true;const result=c.graph.start();
   if(result.ok!==true||!current()||!captureTerminalGraphAuthorities(c.graph,p.registry,p.projectId))failure('DESKTOP_NATIVE_START_REFUSED');
   state='active';return c.graph;
  }catch{
   await retire(c);c.pending=false;completed(c);failure(c.clean?'DESKTOP_NATIVE_START_REFUSED':'DESKTOP_NATIVE_CLEANUP_UNKNOWN');
  }finally{c.pending=false;completed(c);finished.resolve();}}
  void begin().then(started.resolve,started.reject);return started.promise;
  }catch(error){if(ownsValidation)validating=false;return Promise.reject(error);}
 }
 function dispose(...args){
  if(args.length)return Promise.reject(Error('DESKTOP_NATIVE_REQUEST_REFUSED'));
  if(disposed)return disposal.promise;disposed=true;
  // The private provider binding may already own resources before graph start.
  // Idle disposal uses the same single retirement cell, reserved before any
  // promise/callback reentry; it must join that binding's actual retirement too.
  cell??={pending:false,done:finished.promise,graph:null,host:null,started:false,clean:false,reservationEntered:false,providersEntered:false,retirement:null};
  const c=cell,work=retire(c);
  void (async()=>{if(c.pending)await c.done;await work;completed(c);return frozen({ok:c.clean,cleanupVerified:c.clean,nativeExecutionAdmitted:false});})().then(disposal.resolve,()=>{c.clean=false;state='blocked';disposal.resolve(frozen({ok:false,cleanupVerified:false,nativeExecutionAdmitted:false}));});
  return disposal.promise;
 }
 return frozen({createGraph,dispose,snapshot});
}
