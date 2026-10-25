// Inactive private MAIN composition only. No addon/Electron import, loading,
// process creation or native qualification. MAIN must supply the genuine
// resource-bound facade; structural acceptance here is not that attestation.
import {types} from 'node:util';
import {setTimeout,clearTimeout} from 'node:timers';
import {createCapturedHostAsyncOperation} from './host-async-captured-operation.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';
const apply=Reflect.apply,then=Promise.prototype.then;
const METHODS=['start','snapshot','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync','stopAndCloseHostAsync','captureHostShutdownPeerRoster','captureHostShutdownExpectation'];
const frozen=value=>Object.freeze(Object.assign(Object.create(null),value));
const callable=value=>typeof value==='function'&&!types.isProxy(value);
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))return null;
 const out=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;
}
const same=(a,b)=>a.code===b.code&&a.deadlineMs===b.deadlineMs&&a.shutdownId===b.shutdownId;
function request(value){const p=data(value,['code','deadlineMs','shutdownId']);return p&&[77,98].includes(p.code)&&Number.isInteger(p.deadlineMs)&&p.deadlineMs>=1&&p.deadlineMs<=10000&&typeof p.shutdownId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(p.shutdownId)?frozen(p):null;}
const fail=code=>{throw Error(code);};
/** One trusted MAIN runtime incarnation, one utility reservation, one raw host. */
export function createDesktopNativeHostReservation(value,...extra){
 const p=data(value,['native','reserveUtilityHost','isCurrent']);
 if(extra.length||!p||![p.reserveUtilityHost,p.isCurrent].every(callable)||!p.native||typeof p.native!=='object'||types.isProxy(p.native)||![Object.prototype,null].includes(Object.getPrototypeOf(p.native)))fail('HOST_RESERVATION_ADAPTER_REFUSED');
 const raw=Object.create(null);
 for(const name of METHODS){const d=Object.getOwnPropertyDescriptor(p.native,name);if(!d||!Object.hasOwn(d,'value')||!callable(d.value))fail('HOST_RESERVATION_ADAPTER_REFUSED');raw[name]=d.value;}
 // Capture receiver/methods before exposure; graph and emergency use the same
 // maintained operation. Neither later native-object mutation nor this facade
 // may choose another addon, opaque host or stop operation.
 const rawFacade=frozen(Object.fromEntries(METHODS.map(name=>[name,(...args)=>apply(raw[name],p.native,args)])));
 let resolveReady,rejectReady,resolveRetirement;
 const ready=new Promise((yes,no)=>{resolveReady=yes;rejectReady=no;});ready.catch(()=>{});
 const retirement=new Promise(resolve=>{resolveRetirement=resolve;});
 let reserved=false,retired=false,context=null,identity=null,utility=null,utilityEntered=false,utilityUnknown=false;
 let host=null,startEntered=false,startPending=false,startUnknown=false,operation=null,sharedRequest=null,retirementRequest=null,stopEntered=false,originalStop=null;
 function current(){if(retired)return false;const answer=apply(p.isCurrent,undefined,[context]);return answer===true&&!retired;}
 function operationStart(r){
  if(!operation)return null;
  if(sharedRequest&&!same(sharedRequest,r))return null;
  if(stopEntered)return originalStop;
  sharedRequest??=r;
  stopEntered=true;originalStop=operation.start(sharedRequest);return originalStop;
 }
 const facade=frozen(Object.fromEntries(METHODS.map(name=>[name,name==='start'?function(...args){
  if(startEntered)fail('HOST_RESERVATION_START_REFUSED');
  if(!identity||!current()||retired)fail('HOST_RESERVATION_RETIRED');
  if(args.length!==3||args[0]!==identity.pid||args[1]!==identity.image||args[2]!==identity.since)fail('HOST_RESERVATION_START_REFUSED');
  startEntered=true;startPending=true;
  try{
   let actual;try{actual=apply(raw.start,p.native,args);}catch{startUnknown=true;fail('HOST_RESERVATION_START_UNKNOWN');}
   // Capture the returned capability before freshness callouts or retirement.
   if(!data(actual,[])){startUnknown=true;fail('HOST_RESERVATION_START_UNKNOWN');}
   host=actual;
   try{operation=createCapturedHostAsyncOperation({native:rawFacade,host});}catch{startUnknown=true;fail('HOST_RESERVATION_START_UNKNOWN');}
   if(!current()||retired)fail('HOST_RESERVATION_RETIRED');
   return host;
  }finally{startPending=false;}
 }:name==='stopAndCloseHostAsync'?function(actual,code,deadlineMs,shutdownId,...args){
  const r=!args.length&&request({code,deadlineMs,shutdownId});if(!r||actual!==host)return null;
  return operationStart(r);
 }:(...args)=>apply(raw[name],p.native,args)])));
 // Timers bound uncertainty only; they never prove an operation settled, retry
 // native work, promote a late result or substitute synchronous cleanup.
 function bounded(ms,observe){
  return new Promise(resolve=>{let done=false,timer=null;const finish=value=>{if(done)return;done=true;if(timer!==null)clearTimeout(timer);resolve(value===true);};timer=setTimeout(()=>finish(false),ms);try{observe(finish);}catch{finish(false);}});
 }
 function nativeRetirement(r){
  if(!startEntered)return Promise.resolve(true);
  if(startPending||startUnknown||!operation)return Promise.resolve(false);
  return bounded(r.deadlineMs,finish=>{
   const original=operationStart(r),handle=operation.captureSettlement();
   if(!supportedProviderPromise(original)||handle.snapshot().unknown){finish(false);return;}
   // An UNKNOWN handle intentionally never resolves actualSettled. Observe the
   // original too, so a rejected/malformed native result explicitly returns
   // uncertainty rather than hanging on that deliberate never-settlement.
   apply(then,original,[()=>{if(handle.snapshot().unknown)finish(false);},()=>finish(false)]);
   apply(then,handle.actualSettled,[()=>{const s=handle.snapshot();finish(s.actualSettled===true&&s.unknown===false&&s.nativeReceiptMatched===true);},()=>finish(false)]);
  });
 }
 function utilityRetirement(r){
  if(!utilityEntered)return Promise.resolve(true);
  if(!utility)return Promise.resolve(false);
  return bounded(r.deadlineMs,finish=>{
   const pending=apply(utility.retire,utility.receiver,[]);
   if(pending===retirement||pending===ready||!supportedProviderPromise(pending)){finish(false);return;}
   apply(then,pending,[value=>{const d=data(value,['utilityExited','exitCode','nativeCleanupVerified','nativeExecutionAdmitted']);finish(!utilityUnknown&&!!d&&d.utilityExited===true&&(d.exitCode===null||Number.isInteger(d.exitCode)&&d.exitCode>=0&&d.exitCode<=0xffffffff)&&d.nativeCleanupVerified===false&&d.nativeExecutionAdmitted===false);},()=>finish(false)]);
  });
 }
 function retire(value,...args){
  const r=!args.length&&request(value);if(!r)return Promise.reject(Error('HOST_RESERVATION_REQUEST_REFUSED'));
  if(retirementRequest)return same(retirementRequest,r)?retirement:Promise.reject(Error('HOST_RESERVATION_CONFLICT'));
  if(sharedRequest&&!same(sharedRequest,r))return Promise.reject(Error('HOST_RESERVATION_CONFLICT'));
  // Reserve identity before Promise-init or private callback reentry.
  retirementRequest=sharedRequest??r;retired=true;rejectReady(Error('HOST_RESERVATION_RETIRED'));
  void Promise.resolve().then(async()=>{
   const nativeWork=nativeRetirement(retirementRequest),utilityWork=utilityRetirement(retirementRequest);
   const [nativeCleanupVerified,utilityExited]=await Promise.all([nativeWork,utilityWork]);
   resolveRetirement(frozen({utilityExited,nativeCleanupVerified}));
  }).catch(()=>resolveRetirement(frozen({utilityExited:false,nativeCleanupVerified:false})));
  return retirement;
 }
 const capability=frozen({ready,retire});
 return frozen({reserveHost(value,resources,...args){
  if(reserved)fail('HOST_RESERVATION_BUSY');
  if(args.length||!value||typeof value!=='object'||types.isProxy(value)||!resources||typeof resources!=='object'||types.isProxy(resources))fail('HOST_RESERVATION_REQUEST_REFUSED');
  reserved=true;context=value;
  // Callers receive actual retained retirement before a launcher can call out,
  // throw after allocation, synchronously reenter or return pending readiness.
  void Promise.resolve().then(()=>{
   if(retired)return;
   try{
    if(!current())fail('HOST_RESERVATION_STALE');
    utilityEntered=true;
    let actual;try{actual=apply(p.reserveUtilityHost,undefined,[resources]);}catch{utilityUnknown=true;fail('HOST_RESERVATION_START_UNKNOWN');}
    // Retain an actual returned retirement method even if another readiness
    // field is malformed. Request its cleanup while keeping the result UNKNOWN.
    if(actual&&typeof actual==='object'&&!types.isProxy(actual)&&[Object.prototype,null].includes(Object.getPrototypeOf(actual))){const d=Object.getOwnPropertyDescriptor(actual,'retire');if(d&&Object.hasOwn(d,'value')&&callable(d.value))utility={receiver:actual,retire:d.value};}
    const u=data(actual,['ready','retire'])??data(actual,['ready','retire','snapshot']);
    if(!u||!callable(u.retire)||!supportedProviderPromise(u.ready)){utilityUnknown=true;fail('HOST_RESERVATION_START_UNKNOWN');}
    utility={receiver:actual,retire:u.retire};
    apply(then,u.ready,[value=>{
     try{
      const d=data(value,['hostProcessIdentity']),i=d&&data(d.hostProcessIdentity,['pid','image','since']);
      if(!i||!Number.isInteger(i.pid)||i.pid<1||i.pid>0xffffffff||typeof i.image!=='string'||!i.image||i.image.length>32768||typeof i.since!=='bigint'||i.since<1n||i.since>0xffffffffffffffffn)fail('HOST_RESERVATION_START_UNKNOWN');
      if(!current())fail('HOST_RESERVATION_RETIRED');identity=frozen(i);resolveReady(frozen({native:facade,hostProcessIdentity:identity}));
     }catch(error){rejectReady(error);}
    },()=>rejectReady(Error('HOST_RESERVATION_START_UNKNOWN'))]);
   }catch(error){rejectReady(error);}
  }).catch(()=>rejectReady(Error('HOST_RESERVATION_START_UNKNOWN')));
  return capability;
 }});
}
