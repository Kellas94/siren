// Fixed private MAIN composition. Definitions/configuration are import-inert;
// only a genuine launch enters resources, native loading or owned lifetimes.
import {types} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createDesktopTerminalCandidate} from './candidate-initializer.mjs';
import {createDesktopNativeHostLoader} from './desktop-native-host-loader.mjs';
import {createDesktopNativeHostReservation} from './desktop-native-host-reservation.mjs';
import {createDesktopNativeUtilityLauncher} from './desktop-native-utility-launcher.mjs';
import {createDesktopNativeProviders} from './desktop-native-providers.mjs';
import {createDesktopNativeRuntimeOwner} from './desktop-native-runtime.mjs';
import {desktopNativeRuntimeResourcePaths,recheckDesktopNativeRuntimeResources} from './desktop-native-runtime-resources.mjs';
import {recheckDesktopNativeOwnedTree} from './desktop-native-owned-tree.mjs';
import {captureTerminalGraphAuthorities,captureTerminalGraphShutdownRequest} from './shutdown-graph.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';

const apply=Reflect.apply,then=Promise.prototype.then;
const directory=fileURLToPath(new URL('../../../',import.meta.url)).replace(/[\\/]$/,'');
const carrierKeys=['dataDirectory','utilityProcess','appReady','isUnlocked','getMode','canExecute','captureIncarnation','readEnvironment','privateEnvironmentKeys','parentForWebContents','showOpenDialog'];
const callbackKeys=['appReady','isUnlocked','getMode','canExecute','captureIncarnation','readEnvironment','parentForWebContents','showOpenDialog'];
const record=value=>Object.freeze(Object.assign(Object.create(null),value));
const fail=code=>{throw Error(code);};
const callable=value=>typeof value==='function'&&!types.isProxy(value);
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(key=>!keys.includes(key)))return null;
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
function promise(value){if(!supportedProviderPromise(value))fail('NATIVE_FACTORY_SETTLEMENT_UNKNOWN');return value;}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
// One module/process binding. A new initializer cannot reload a failed addon
// or replace an earlier charged owner. No authority is issued by this record.
let binding=null;
const graphs=new WeakMap();
function processBinding(bundle){
 if(binding){if(binding.resources!==bundle.resources||binding.tree!==bundle.tree)fail('NATIVE_FACTORY_BINDING_REFUSED');return binding;}
 binding={resources:bundle.resources,tree:bundle.tree,loader:null,loaded:null,loading:null,queue:Promise.resolve(),active:null,blocked:false};return binding;
}
function serial(state,work){const pending=state.queue.then(work,work);state.queue=pending.then(()=>{},()=>{});return pending;}
async function verifyBundle(bundle){return await recheckDesktopNativeRuntimeResources(bundle.resources)&&await recheckDesktopNativeOwnedTree(bundle.resources,bundle.tree)&&await recheckDesktopNativeRuntimeResources(bundle.resources);}

export function createDesktopNativeInitializer(value,...extra){
 const b=data(value,['manifest','resources','tree','verifier']);
 const manifest=b&&data(b.manifest,['directory','files','directories']),verifier=b&&data(b.verifier,['capture','recheck','snapshot']);
 const paths=b&&desktopNativeRuntimeResourcePaths(b.resources);
 if(extra.length||!b||!manifest||!verifier||Object.values(verifier).some(fn=>!callable(fn))||!paths||paths.directory!==directory||manifest.directory!==directory||!b.tree||typeof b.tree!=='object'||types.isProxy(b.tree))fail('NATIVE_FACTORY_BUNDLE_REFUSED');
 const bundle=record(b);
 return function initializeDesktopNative(hooks,...args){
  // Inspect this own DATA descriptor before reading any carrier value or
  // entering the legacy initializer. Never invoke a nativeMain accessor.
  if(args.length||!hooks||typeof hooks!=='object'||types.isProxy(hooks))fail('NATIVE_FACTORY_CARRIER_REFUSED');
  const d=Object.getOwnPropertyDescriptor(hooks,'nativeMain'),n=d?.enumerable&&Object.hasOwn(d,'value')?data(d.value,carrierKeys):null;
  const policy=n?.privateEnvironmentKeys;
  if(!n||callbackKeys.some(key=>!callable(n[key]))||!n.utilityProcess||types.isProxy(n.utilityProcess)||typeof n.utilityProcess!=='object'||typeof n.dataDirectory!=='string'||! /^[A-Za-z]:\\/.test(n.dataDirectory)||types.isProxy(policy)||!Array.isArray(policy)||Object.getPrototypeOf(policy)!==Array.prototype||!Object.isFrozen(policy)||Reflect.ownKeys(policy).length!==4)fail('NATIVE_FACTORY_CARRIER_REFUSED');
  for(const [index,key]of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','NODE_PATH'].entries()){const item=Object.getOwnPropertyDescriptor(policy,String(index));if(!item?.enumerable||!Object.hasOwn(item,'value')||item.value!==key)fail('NATIVE_FACTORY_CARRIER_REFUSED');}
  const nativeMain=record(n),state=processBinding(bundle),identity=Symbol('private MAIN initializer');let permanentlyDisposed=false,cleanupCallout=0;

  function contextFields(value){return data(value,['registry','projectId','grant']);}
  function sameContext(a,b){return !!a&&!!b&&a.registry===b.registry&&a.projectId===b.projectId&&a.grant===b.grant;}
  function current(cell,value){
   if(state.blocked||cell.cancelled||cell.retirementStarted||state.active!==cell)return false;
   const fields=contextFields(value);if(!fields)return false;
   if(!cell.contextCaptured){
    cell.contextCaptured=true;cell.context=value;cell.fields=record(fields);
    const captured=apply(nativeMain.captureIncarnation,undefined,[value]),parsed=data(captured,['isCurrent']);
    cell.incarnation=parsed&&callable(parsed.isCurrent)?parsed.isCurrent:null;
   }
   if(!sameContext(fields,cell.fields)||!cell.incarnation)return false;
   let answer;try{answer=apply(cell.incarnation,undefined,[]);}catch{return false;}
   return answer===true&&!state.blocked&&!cell.cancelled&&!cell.retirementStarted&&state.active===cell&&(!state.loaded||state.loader.isCurrent()===true);
  }
  async function load(cell){
   if(state.blocked||!current(cell,cell.context))fail('NATIVE_FACTORY_STALE');
   if(state.loaded){if(!state.loader.isCurrent())fail('NATIVE_FACTORY_LOADER_STALE');return state.loaded;}
   if(!state.loading)state.loading=serial(state,async()=>{
    try{
     if(state.blocked||!await verifyBundle(bundle))fail('NATIVE_FACTORY_RESOURCE_REFUSED');
     state.loader??=createDesktopNativeHostLoader({resources:bundle.resources,ownedTree:bundle.tree});
     const loaded=await promise(state.loader.load());if(!loaded.isCurrent())fail('NATIVE_FACTORY_LOADER_STALE');state.loaded=loaded;return loaded;
    }catch(error){state.blocked=true;throw error;}
   });
   return state.loading;
  }
  function verify(cell,resources){return serial(state,async()=>{
   if(resources!==bundle.resources||state.blocked||!current(cell,cell.context)||!await verifyBundle(bundle))return false;
   if(!state.loader||!state.loaded||!await promise(state.loader.recheck()))return false;
   return current(cell,cell.context);
  });}
  function providerCurrent(cell,context,resources){
   const fields=contextFields(context);return resources===bundle.resources&&sameContext(fields,cell.fields)&&current(cell,cell.context)&&state.loaded?.isCurrent()===true;
  }
  function callCleanup(fn){cleanupCallout++;try{return fn();}finally{cleanupCallout--;}}
  function retire(cell){
   if(cell.allocating)fail('NATIVE_FACTORY_BUSY');
   if(cell.retirementStarted)return cell.cleanup.promise;
   cell.retirementStarted=true;cell.cancelled=true;
   // The cell join never awaits a factory/public facade/generic operation.
   // Request every entered lane before joining any of them.
   let ownerWork=null,providerWork=null,utilityWork=null,requestFailed=false;
   try{if(cell.owner)ownerWork=callCleanup(()=>cell.owner.dispose());}catch{requestFailed=true;}
   try{if(cell.providers)providerWork=callCleanup(()=>cell.providers.retire());}catch{requestFailed=true;}
   try{if(cell.utility)utilityWork=callCleanup(()=>cell.utility.dispose());}catch{requestFailed=true;}
   const observe=(entered,work,keys,idle)=>{
    if(!entered)return Promise.resolve(idle);
    try{return promise(work).then(value=>data(value,keys),()=>null);}catch{return Promise.resolve(null);}
   };
   const ownerJoin=observe(!!cell.owner,ownerWork,['ok','cleanupVerified','nativeExecutionAdmitted'],record({ok:true,cleanupVerified:true,nativeExecutionAdmitted:false}));
   const providerJoin=observe(!!cell.providers,providerWork,['retired','actualSettled','pending','nativeExecutionAdmitted'],record({retired:true,actualSettled:true,pending:0,nativeExecutionAdmitted:false}));
   const utilityJoin=observe(!!cell.utility,utilityWork,['utilityExited','exitCode','nativeCleanupVerified','nativeExecutionAdmitted'],record({utilityExited:true,nativeCleanupVerified:false,nativeExecutionAdmitted:false,exitCode:null}));
   void Promise.all([ownerJoin,providerJoin,utilityJoin]).then(([owner,provider,utility])=>{
    const clean=!requestFailed&&owner?.ok===true&&owner.cleanupVerified===true&&owner.nativeExecutionAdmitted===false&&provider?.retired===true&&provider.actualSettled===true&&provider.pending===0&&provider.nativeExecutionAdmitted===false&&utility?.utilityExited===true&&utility.nativeCleanupVerified===false&&utility.nativeExecutionAdmitted===false;
    if(!clean)state.blocked=true;
    cell.clean=clean;if(clean&&state.active===cell)state.active=null;
    return record({ok:clean,cleanupVerified:clean,nativeExecutionAdmitted:false});
   }).then(cell.cleanup.resolve,()=>{state.blocked=true;cell.clean=false;cell.cleanup.resolve(record({ok:false,cleanupVerified:false,nativeExecutionAdmitted:false}));});
   return cell.cleanup.promise;
  }
  async function createGraph(request,...extra){
   if(extra.length||permanentlyDisposed||state.blocked||state.active)fail('NATIVE_FACTORY_BUSY');
   const cell={initializer:identity,allocating:true,contextCaptured:false,context:null,fields:null,incarnation:null,cancelled:false,returned:false,owner:null,providers:null,utility:null,reservation:null,originalContext:null,retirementStarted:false,cleanup:null,operations:new Map()};state.active=cell;
   cell.cleanup=deferred();cell.allocating=false;
   const adapter={
    isCurrent:context=>current(cell,context),
    captureResources:async()=>{await load(cell);if(!current(cell,cell.context))fail('NATIVE_FACTORY_STALE');return bundle.resources;},
    verifyResourceClosure:resources=>verify(cell,resources),
    providers:async(context,resources)=>{
     if(cell.providers||context!==cell.context||!providerCurrent(cell,context,resources))fail('NATIVE_FACTORY_CONTEXT_REFUSED');
     cell.originalContext=context;
     cell.utility=createDesktopNativeUtilityLauncher({utilityProcess:nativeMain.utilityProcess,isReady:nativeMain.appReady,mark:state.loaded.mark,isCurrent:()=>current(cell,cell.context)});
     cell.reservation=createDesktopNativeHostReservation({native:state.loaded.native,reserveUtilityHost:r=>cell.utility.reserveUtilityHost(r),isCurrent:ctx=>ctx===cell.originalContext&&current(cell,ctx)});
     cell.providers=createDesktopNativeProviders({registry:cell.fields.registry,projectId:cell.fields.projectId,runtimeDirectory:paths.directory,dataDirectory:nativeMain.dataDirectory,privateEnvironmentKeys:nativeMain.privateEnvironmentKeys,parentForWebContents:nativeMain.parentForWebContents,showOpenDialog:nativeMain.showOpenDialog,readEnvironment:nativeMain.readEnvironment,isUnlocked:nativeMain.isUnlocked,getMode:nativeMain.getMode,canExecute:nativeMain.canExecute,assertResourcesCurrent:(ctx,r)=>providerCurrent(cell,ctx,r)});
     return await promise(cell.providers.providers(context,resources));
    },
    reserveHost:resources=>{if(resources!==bundle.resources||!cell.reservation||!cell.originalContext||!current(cell,cell.originalContext))fail('NATIVE_FACTORY_CONTEXT_REFUSED');return cell.reservation.reserveHost(cell.originalContext,resources);},
    retireProviders:()=>cell.providers?cell.providers.retire():Promise.resolve(record({retired:true,actualSettled:true,pending:0,nativeExecutionAdmitted:false}))
   };
   try{
    cell.owner=createDesktopNativeRuntimeOwner({adapter});
    const graph=await promise(cell.owner.createGraph(request));
    if(cell.cancelled||!current(cell,cell.context)||!captureTerminalGraphAuthorities(graph,cell.fields.registry,cell.fields.projectId))fail('NATIVE_FACTORY_STALE');
    graphs.set(graph,cell);cell.returned=true;return graph;
   }catch(error){const result=await retire(cell);if(!result.cleanupVerified)fail('NATIVE_FACTORY_CLEANUP_UNKNOWN');throw error;}
  }
  function retireRuntime(graph,request,...extra){
   const cell=!extra.length&&graph&&!types.isProxy(graph)&&graphs.get(graph);
   if(!cell||cell.initializer!==identity||request!==captureTerminalGraphShutdownRequest(graph))return Promise.reject(Error('NATIVE_FACTORY_SHUTDOWN_REFUSED'));
   return retire(cell);
  }
  const runtime=createDesktopTerminalCandidate({createGraph,retireRuntime})(hooks);
  const facade=Object.create(Object.getPrototypeOf(runtime)),descriptors=Object.getOwnPropertyDescriptors(runtime);
  for(const name of ['shutdown','dispose','prepareTransition']){
   const original=descriptors[name].value;
   descriptors[name]={...descriptors[name],value:function(...args){
    if(name==='dispose')permanentlyDisposed=true;
    const cell=state.active;
    if(!cell||cell.initializer!==identity||cell.returned)return apply(original,this===facade?runtime:this,args);
    if(cleanupCallout||cell.allocating)fail('NATIVE_FACTORY_REENTRANT_CLEANUP_REFUSED');
    const previous=cell.operations.get(name);
    if(previous){if(!previous.result)fail('NATIVE_FACTORY_REENTRANT_CLEANUP_REFUSED');if(previous.args.length!==args.length||previous.args.some((value,index)=>value!==args[index]))fail('NATIVE_FACTORY_OPERATION_CONFLICT');return previous.result.promise;}
    const operation={args:[...args],result:null};cell.operations.set(name,operation);operation.result=deferred();
    const cleanup=retire(cell);let answer;
    try{answer=apply(original,this===facade?runtime:this,args);}catch(error){answer=Promise.reject(error);}
    const originalOutcome=promise(answer).then(value=>({ok:true,value}),error=>({ok:false,error}));
    void Promise.all([originalOutcome,cleanup]).then(([outcome,receipt])=>{
     if(!outcome.ok)throw outcome.error;if(receipt.cleanupVerified!==true)fail('NATIVE_FACTORY_CLEANUP_UNKNOWN');return outcome.value;
    }).then(operation.result.resolve,operation.result.reject);
    return operation.result.promise;
   }};
  }
  Object.defineProperties(facade,descriptors);return Object.isFrozen(runtime)?Object.freeze(facade):facade;
 };
}
