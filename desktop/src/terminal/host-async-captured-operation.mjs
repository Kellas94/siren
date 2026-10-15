// Main-private, unwired SOURCE_ONLY controller. Captured methods are dependencies,
// not proof of a qualified addon or kernel truth. Never load or start a process.
import {types} from 'node:util';
import {validateHostAsyncReceipt} from './host-async-receipt-contract.mjs';
const apply=Reflect.apply,isProxy=types.isProxy,isPromise=types.isPromise;
const NativePromise=Promise,prototype=Promise.prototype,then=prototype.then,species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species)?.get;
const METHODS=['stopAndCloseHostAsync','captureHostShutdownPeerRoster','captureHostShutdownExpectation'];
const frozen=v=>Object.freeze(Object.assign(Object.create(null),v));
function record(value,keys){
 if(!value||typeof value!=='object'||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const out=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;
}
function nativePromise(value){
 if(!value||typeof value!=='object'||isProxy(value)||!isPromise(value)||Object.getPrototypeOf(value)!==prototype||Object.hasOwn(value,'constructor'))return false;
 const c=Object.getOwnPropertyDescriptor(prototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species&&!Object.hasOwn(s,'value');
}
function request(value){const r=record(value,['code','deadlineMs','shutdownId']);return r&&[77,98].includes(r.code)&&Number.isInteger(r.deadlineMs)&&r.deadlineMs>=1&&r.deadlineMs<=10000&&typeof r.shutdownId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(r.shutdownId)?frozen(r):null;}
function ordinalArray(value){
 if(!value||typeof value!=='object'||isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||!Object.isFrozen(value))return null;
 const d=Object.getOwnPropertyDescriptor(value,'length');if(!d||!Object.hasOwn(d,'value')||!Number.isInteger(d.value)||d.value<0||d.value>8||Reflect.ownKeys(value).length!==d.value+1)return null;
 const out=[];for(let i=0;i<d.value;i++){const p=Object.getOwnPropertyDescriptor(value,String(i));if(!p?.enumerable||!Object.hasOwn(p,'value')||!Number.isInteger(p.value)||p.value<1||p.value>0xffffffff||out.includes(p.value))return null;out.push(p.value);}return Object.freeze(out);
}
function roster(value,id){const r=record(value,['version','shutdownId','scope','pairOrdinals']);if(!r||!Object.isFrozen(value)||r.version!==1||r.shutdownId!==id||r.scope!=='HOST_ASYNC_CAPTURED_PEER_ROSTER')return null;return ordinalArray(r.pairOrdinals);}
function expectedOrdinals(value,reserved){
 const r=record(value,['request','root','held','pairOrdinals']),e=r&&record(r.request,['code','deadlineMs','shutdownId']);
 if(!r||!Object.isFrozen(value)||!e||e.code!==reserved.code||e.deadlineMs!==reserved.deadlineMs||e.shutdownId!==reserved.shutdownId||!Object.isFrozen(r.request)||!record(r.root,['pid','image','createdFileTime'])||!Object.isFrozen(r.root))return null;
 const h=r.held;if(!h||typeof h!=='object'||isProxy(h)||!Array.isArray(h)||Object.getPrototypeOf(h)!==Array.prototype||!Object.isFrozen(h))return null;
 const d=Object.getOwnPropertyDescriptor(h,'length');if(!d||!Object.hasOwn(d,'value')||!Number.isInteger(d.value)||d.value<0||d.value>128||Reflect.ownKeys(h).length!==d.value+1)return null;
 for(let i=0;i<d.value;i++){const p=Object.getOwnPropertyDescriptor(h,String(i));if(!p?.enumerable||!Object.hasOwn(p,'value')||!record(p.value,['pid','image','createdFileTime'])||!Object.isFrozen(p.value))return null;}return ordinalArray(r.pairOrdinals);
}
function captureMethods(native){
 const methods=Object.create(null);
 try{
  if(!native||typeof native!=='object'||isProxy(native)||![Object.prototype,null].includes(Object.getPrototypeOf(native)))throw Error();
  for(const name of METHODS){const d=Object.getOwnPropertyDescriptor(native,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||isProxy(d.value))throw Error();methods[name]=d.value;}
 }catch{throw TypeError('HOST_CAPTURE_DEPENDENCIES_REFUSED');}
 return methods;
}
/** Capture before provider/host creation. Exactly one valid host may bind. */
export function captureHostAsyncOperationFactory(options,...extra){
 const p=record(options,['native']);if(extra.length||!p)throw TypeError('HOST_CAPTURE_DEPENDENCIES_REFUSED');
 let native=p.native,methods=captureMethods(native),bound=false;
 return frozen({bindHost(host,...args){
  if(bound||args.length||!record(host,[]))return null;
  bound=true;const controller=operation(native,host,methods);native=methods=null;return controller;
 }});
}
/** One captured host operation, never a whole-host/Session authority. */
export function createCapturedHostAsyncOperation(options,...extra){
 const p=record(options,['native','host']);if(extra.length||!p||!record(p.host,[]))throw TypeError('HOST_CAPTURE_DEPENDENCIES_REFUSED');
 return operation(p.native,p.host,captureMethods(p.native));
}
function operation(native,host,methods){
 let phase='idle',req=null,original=null,accepted=false,ordinals=null,matched=false,done=false,unknown=false,frames=0,pending=0,resolve;
 const retained=[],observed=new WeakSet();const actualSettled=new NativePromise(r=>resolve=r);
 const flags={nativeExecutionAdmitted:false,hostNativeJoined:false,sessionCleanupJoined:false,rosterAuthorityEstablished:false};
 const summary=()=>frozen({scope:'HOST_ASYNC_CAPTURED_OPERATION_JS',phase,actualSettled:done,unknown,activeFrames:frames,pendingCallbacks:pending,nativeReceiptMatched:matched,...flags});
 const handle=frozen({actualSettled,snapshot:(...args)=>args.length?null:summary()});
 function fail(value,unexpectedCapture=false){unknown=true;phase='unknown';if(retained.length<3&&value!==null&&['object','function'].includes(typeof value))retained.push(value);if(unexpectedCapture&&nativePromise(value)&&!observed.has(value))observe(value,()=>{},()=>{});}
 function finish(){if(done||unknown||!matched||frames||pending)return;done=true;phase='settled';native=host=methods=original=ordinals=null;retained.length=0;const r=resolve;resolve=null;r(summary());}
 function frame(fn){frames++;try{return fn();}finally{frames--;finish();}}
 function observe(promise,fulfilled,rejected){
  observed.add(promise);pending++;
  try{const continuation=apply(then,promise,[v=>frame(()=>fulfilled(v)),e=>frame(()=>rejected(e))]);if(!nativePromise(continuation))throw Error('HOST_OBSERVER_UNKNOWN');apply(then,continuation,[()=>frame(()=>{pending--;}),e=>frame(()=>{pending--;fail(e);})]);}
  catch(e){fail(e);}
 }
 function fulfillment(value){
  if(unknown)return;
  let expected;try{expected=apply(methods.captureHostShutdownExpectation,native,[host,req.shutdownId]);}catch(e){fail(e);return;}
  const peers=expectedOrdinals(expected,req);if(!peers||peers.length!==ordinals.length||!peers.every(n=>ordinals.includes(n))){fail(expected,true);return;}
  const r=validateHostAsyncReceipt(expected,value);if(!r.ok){fail(expected);fail(value);return;}matched=true;
 }
 const controller=frozen({
  captureSettlement:(...args)=>args.length?null:handle,
  start(value,...args){
   if(args.length||done)return null;const r=request(value);if(!r)return null;
   if(req)return req.code===r.code&&req.deadlineMs===r.deadlineMs&&req.shutdownId===r.shutdownId&&accepted?original:null;
   req=r;phase='starting';return frame(()=>{
    try{original=apply(methods.stopAndCloseHostAsync,native,[host,req.code,req.deadlineMs,req.shutdownId]);}catch(e){fail(e);return null;}
    if(!nativePromise(original)){fail(original);return null;}accepted=true;observe(original,fulfillment,fail);if(unknown)return original;
    let captured;try{captured=apply(methods.captureHostShutdownPeerRoster,native,[host,req.shutdownId]);}catch(e){fail(e);return original;}
    ordinals=roster(captured,req.shutdownId);if(!ordinals){fail(captured,true);return original;}phase='pending';return original;
   });
  },
 });return controller;
}
