// Private MAIN candidate utility reservation. No Electron/addon import, native
// loader, normal initializer or renderer capability. Callbacks are trusted MAIN
// dependencies; fake event controls are not kernel process/cleanup attestation.
import {types} from 'node:util';
import {setTimeout,clearTimeout} from 'node:timers';
import {desktopNativeRuntimeResourcePaths,recheckDesktopNativeRuntimeResources} from './desktop-native-runtime-resources.mjs';
const schema='siren-desktop-utility-host/v1',apply=Reflect.apply;
const frozen=value=>Object.freeze(value),callable=value=>typeof value==='function'&&!types.isProxy(value);
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(key=>!keys.includes(key)))return null;
 const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
function method(object,key){
 if(!object||types.isProxy(object))throw Error('UTILITY_ADAPTER_REFUSED');
 for(let p=object;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))break;const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(Object.hasOwn(d,'value')&&callable(d.value))return (...args)=>apply(d.value,object,args);break;}}
 throw Error('UTILITY_ADAPTER_REFUSED');
}
const pid=value=>Number.isInteger(value)&&value>0&&value<=0xffffffff;
export function createDesktopNativeUtilityLauncher(value,...extra){
 const p=data(value,['utilityProcess','isReady','mark','isCurrent'])??data(value,['utilityProcess','isReady','mark','isCurrent','timers']);
 if(extra.length||!p||![p.isReady,p.mark,p.isCurrent].every(callable))throw Error('UTILITY_ADAPTER_REFUSED');
 const fork=method(p.utilityProcess,'fork'),timing=p.timers===undefined?{setTimeout,clearTimeout}:data(p.timers,['setTimeout','clearTimeout']);
 if(!timing||!Object.values(timing).every(callable))throw Error('UTILITY_ADAPTER_REFUSED');
 // One attempt: allocate deferreds before this factory exposes any callbacks.
 // Promise init hooks cannot reenter a public reservation/retirement mid-assignment.
 let resolveReady,rejectReady,resolveRetirement;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});ready.catch(()=>{});
 const retirement=new Promise(resolve=>{resolveRetirement=resolve;});
 let reserved=null,disposed=false,state='idle';
 function reserveUtilityHost(resources,...args){
  if(args.length||disposed)throw Error('UTILITY_RETIRED');
  if(reserved)throw Error('UTILITY_BUSY');
  let retirementStarted=false,readySettled=false,retired=false,retirementSettled=false;
  let child=null,childMethods=null,spawned=false,childPid=null,exitObserved=false,exitCode=null,exitUnknown=false,helloEntered=false;
  let forkEntered=false,forkReturned=false,forkUnknown=false,startSettled=false,installing=false;
  const timers={ready:null,kill:null,retire:null};
  state='starting';
  function clear(slot){const token=timers[slot];timers[slot]=null;if(token?.id!==null&&token?.id!==undefined)timing.clearTimeout(token.id);}
  function arm(slot,callback,ms){
   clear(slot);const token={id:null};timers[slot]=token;
   const id=timing.setTimeout(()=>{if(timers[slot]!==token)return;timers[slot]=null;callback();},ms);
   token.id=id;if(timers[slot]!==token)timing.clearTimeout(id);
  }
  function cleanup(){if(installing||!childMethods)return;for(const [name,listener]of listeners)try{childMethods.removeListener(name,listener);}catch{};}
  function finishRetirement(verified){
   if(retirementSettled||!retirementStarted)return;retirementSettled=true;clear('retire');clear('kill');clear('ready');
   state=verified?'retired':'blocked';
   resolveRetirement(frozen({utilityExited:verified,exitCode:verified?exitCode:null,nativeCleanupVerified:false,nativeExecutionAdmitted:false}));
   if(exitObserved)cleanup();
  }
  function maybeRetired(){
   if(!retired||retirementSettled)return;
   if(exitObserved){finishRetirement(!exitUnknown);return;}
   if(startSettled&&!forkEntered){finishRetirement(true);return;}
   if(startSettled&&forkUnknown){finishRetirement(false);return;}
  }
  function fail(code){if(!readySettled){readySettled=true;clear('ready');rejectReady(Error(code));}retire();}
  function current(){
   if(retired||disposed)return false;
   const answer=apply(p.isCurrent,undefined,[]);
   return answer===true&&!retired&&!disposed;
  }
  function sendRetirement(){
   if(!childMethods||exitObserved)return;
   try{childMethods.postMessage(frozen({schema,kind:'retire'}));}catch{try{childMethods.kill();}catch{}}
   if(!exitObserved)arm('kill',()=>{try{childMethods.kill();}catch{}},250);
  }
  function retire(...parameters){
   if(parameters.length)throw Error('UTILITY_REQUEST_REFUSED');
   if(retirementStarted)return retirement;
   retirementStarted=true;retired=true;state='retiring';
   if(!readySettled){readySettled=true;rejectReady(Error('UTILITY_RETIRED'));}
   clear('ready');arm('retire',()=>finishRetirement(false),5000);
   sendRetirement();maybeRetired();return retirement;
  }
  function onExit(code){
   if(exitObserved)return;exitObserved=true;exitUnknown=!Number.isInteger(code)||code<0||code>0xffffffff;exitCode=exitUnknown?null:code;
   if(!readySettled)fail('UTILITY_EARLY_EXIT');else if(!retired)retire();
   maybeRetired();cleanup();
  }
  function onError(){if(!retirementSettled)fail('UTILITY_PROCESS_ERROR');}
  function onSpawn(){
   if(exitObserved||retired)return;
   if(spawned){fail('UTILITY_HANDSHAKE_REFUSED');return;}
   const actual=child.pid;if(retired||disposed||exitObserved)return;if(!pid(actual)){fail('UTILITY_HANDSHAKE_REFUSED');return;}spawned=true;childPid=actual;
  }
  function onMessage(value){
   if(retired||exitObserved)return;
   const hello=data(value,['schema','pid','electron','modules','napi']);
   if(helloEntered||!spawned||!hello||hello.schema!==schema||hello.pid!==childPid||hello.electron!=='44.5.1'||hello.modules!=='149'||hello.napi!=='10'){fail('UTILITY_HANDSHAKE_REFUSED');return;}
   helloEntered=true;
   void Promise.resolve().then(async()=>{
    try{if(!current())throw Error('UTILITY_STALE');if(!await recheckDesktopNativeRuntimeResources(resources))throw Error('UTILITY_RESOURCE_REFUSED');if(!current())throw Error('UTILITY_STALE');
     if(readySettled||retired||exitObserved)return;readySettled=true;state='active';clear('ready');
     resolveReady(frozen({hostProcessIdentity:frozen({pid:childPid,image:paths.executable,since})}));
    }catch(error){fail(error?.message==='UTILITY_STALE'?'UTILITY_STALE':'UTILITY_RESOURCE_REFUSED');}
   });
  }
  const listeners=[['exit',onExit],['error',onError],['spawn',onSpawn],['message',onMessage]];
  const handle=reserved=frozen({ready,retire,snapshot:()=>frozen({state,retired,spawned,exitObserved,exitCode,retirementSettled,nativeCleanupVerified:false,nativeExecutionAdmitted:false})});
  let paths=null,since=null;
  void Promise.resolve().then(async()=>{
   try{
    if(retired)throw Error('UTILITY_RETIRED');
    if(!current()||apply(p.isReady,undefined,[])!==true||!current())throw Error('UTILITY_STALE');
    paths=desktopNativeRuntimeResourcePaths(resources);if(!paths||!await recheckDesktopNativeRuntimeResources(resources))throw Error('UTILITY_RESOURCE_REFUSED');
    if(!current())throw Error('UTILITY_STALE');
    since=apply(p.mark,undefined,[]);if(typeof since!=='bigint'||since<=0n||since>0xffffffffffffffffn)throw Error('UTILITY_MARK_REFUSED');
    if(!current())throw Error('UTILITY_STALE');
    forkEntered=true;
    try{child=fork(paths.hostEntry,[],{cwd:paths.directory,serviceName:'SIREN Terminal lifetime host',stdio:'ignore',execArgv:[],env:{}});forkReturned=true;}catch{forkUnknown=true;throw Error('UTILITY_LAUNCH_UNKNOWN');}
    try{childMethods={on:method(child,'on'),removeListener:method(child,'removeListener'),postMessage:method(child,'postMessage'),kill:method(child,'kill')};}catch{forkUnknown=true;throw Error('UTILITY_LAUNCH_UNKNOWN');}
    installing=true;try{for(const [name,listener]of listeners)childMethods.on(name,listener);}finally{installing=false;}
    if(exitObserved){cleanup();throw Error('UTILITY_EARLY_EXIT');}
    if(retired){sendRetirement();throw Error('UTILITY_RETIRED');}
    if(!current())throw Error('UTILITY_STALE');
    arm('ready',()=>fail('UTILITY_READY_TIMEOUT'),5000);
   }catch(error){const code=/^UTILITY_[A-Z_]+$/.test(error?.message)?error.message:'UTILITY_LAUNCH_UNKNOWN';fail(code);}
   finally{startSettled=true;if(forkEntered&&!forkReturned)forkUnknown=true;maybeRetired();}
  });
  return handle;
 }
 return frozen({reserveUtilityHost,dispose(...args){if(args.length)throw Error('UTILITY_REQUEST_REFUSED');disposed=true;if(reserved)return reserved.retire();state='retired';rejectReady(Error('UTILITY_RETIRED'));resolveRetirement(frozen({utilityExited:true,exitCode:null,nativeCleanupVerified:false,nativeExecutionAdmitted:false}));return retirement;},snapshot:()=>frozen({state,disposed,reserved:!!reserved,nativeExecutionAdmitted:false,nativeCleanupVerified:false})});
}
