// Pure coordination of actual provider receipts. No native import, polling,
// legacy synchronous stop/close, process lookup, retry or budget refund fallback.
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';

const invoke=Reflect.apply,clock=performance.now.bind(performance),setTimer=setTimeout,clearTimer=clearTimeout;
const NativePromise=Promise,promisePrototype=Promise.prototype,then=promisePrototype.then;
const species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species)?.get;
const isProxy=types.isProxy,isPromise=types.isPromise,wellFormed=String.prototype.isWellFormed;
const IDENTITY=['pid','image','createdFileTime'],MEMBER=[...IDENTITY,'alive','exitCode'];
const SNAPSHOT=['active','root','held','killOnClose','breakaway','inheritable','monitorFired','monitorTerminateSucceeded','stopping','shell','hostPid','atomicBeforeResume','shellMonitorFired','shellMonitorTerminated'];
const MONITORS=['monitorFired','monitorTerminateSucceeded','shellMonitorFired','shellMonitorTerminated'];
const uint32=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff;
const pid=v=>uint32(v)&&v>0;
const callback=v=>typeof v==='function'&&!isProxy(v);
const receipt=(ok,code)=>Object.freeze(Object.assign(Object.create(null),{ok,code,verifiedExited:ok}));
const knownSuccess=receipt(true,'CLEANUP_VERIFIED');
const resolved=v=>new NativePromise(resolve=>resolve(v));
function record(value,keys){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const p=Object.getPrototypeOf(value);if(p!==Object.prototype&&p!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const r=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function array(value){
 if(!value||typeof value!=='object'||isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const n=Object.getOwnPropertyDescriptor(value,'length');if(!n||!Object.hasOwn(n,'value')||!Number.isSafeInteger(n.value)||n.value<0||n.value>32||Reflect.ownKeys(value).length!==n.value+1)return null;
 const r=[];for(let i=0;i<n.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r.push(d.value);}return r;
}
function image(value){return typeof value==='string'&&value.length>0&&value.length<=32767&&invoke(wellFormed,value,[])&&/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(value)&&!/[\x00-\x1f\x7f"]/.test(value);}
function birth(value){return typeof value==='string'&&/^[1-9][0-9]{0,19}$/.test(value)&&BigInt(value)<=0xffffffffffffffffn;}
function identity(value,member=false){
 const p=record(value,member?MEMBER:IDENTITY);if(!p||!pid(p.pid)||!image(p.image)||!birth(p.createdFileTime)||member&&(p.alive!==false||!uint32(p.exitCode)))return null;return Object.freeze(p);
}
const same=(a,b)=>a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
function identities(value,member=false){
 const values=array(value);if(!values)return null;const result=[],seen=new Set();
 for(const v of values){const p=identity(v,member);if(!p||seen.has(p.pid))return null;seen.add(p.pid);result.push(p);}return Object.freeze(result);
}
function expectedRecord(value){
 const r=record(value,['root','shell','hostPid','held']);if(!r||!pid(r.hostPid))return null;
 const root=identity(r.root),shell=r.shell===false?false:identity(r.shell),held=identities(r.held);if(!root||shell===null||!held||shell&&shell.pid===root.pid)return null;
 for(const p of[root,shell].filter(Boolean)){const duplicate=held.find(q=>q.pid===p.pid);if(duplicate&&!same(duplicate,p))return null;}
 return Object.freeze({root,shell,hostPid:r.hostPid,held});
}
function finalNative(value,expected){
 const r=record(value,['snapshot','closed']);if(!r||r.closed!==true)return false;
 const s=record(r.snapshot,SNAPSHOT);if(!s||s.active!==0||s.killOnClose!==true||s.breakaway!==false||s.inheritable!==false||s.stopping!==true||s.atomicBeforeResume!==true||s.hostPid!==expected.hostPid||!MONITORS.every(k=>typeof s[k]==='boolean'))return false;
 const root=identity(s.root,true),shell=s.shell===false?false:identity(s.shell,true),held=identities(s.held,true);
 if(!root||!same(root,expected.root)||shell===null||!held||held.length!==expected.held.length||!held.every(p=>expected.held.some(q=>same(p,q))))return false;
 if(expected.shell===false?shell!==false:!shell||!same(shell,expected.shell))return false;
 for(const p of[root,shell].filter(Boolean)){const duplicate=held.find(q=>q.pid===p.pid);if(duplicate&&(!same(duplicate,p)||duplicate.alive!==p.alive||duplicate.exitCode!==p.exitCode))return false;}
 return true;
}
function nativePromise(value){
 if(!value||typeof value!=='object'||isProxy(value)||!isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))return false;
 // Native then still reads inherited constructor/species. Check descriptors
 // before attaching handlers, without invoking replacement getters.
 const c=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species&&typeof species==='function'&&!isProxy(species);
}

/**
 * At most one native stop and one aggregate peer close per lifetime. Their
 * actual Promises remain observed after caller timeout/disposal. An invalid
 * Promise or outcome leaves an unknown reservation: there is no retry/reset.
 * A late verified native receipt plus true peer closure releases this pure
 * coordinator's reservation and notifies once, without changing the original
 * timeout/failure result. Native qualification/provenance remains external.
 */
export class TerminalSessionCleanup {
 #expected;#stopNative;#closePeers;#onUnavailable;#onVerified;
 #started=false;#fenced=false;#notified=false;#verifiedNotified=false;#verified=false;
 #nativeInvoked=false;#peerInvoked=false;#nativePending=false;#peerPending=false;
 #nativeSettled=false;#peerSettled=false;#nativeVerified=false;#peersVerified=false;
 #nativeUnknown=false;#peerUnknown=false;#nativePromise=null;#peerPromise=null;
 #firstPromise=null;#resolveFirst=null;#firstResult=null;#expires=null;#timer=null;
 #settlement;#resolveActual;#resolveRelease;#actualDone=false;#active=0;
 #nativeActualUnknown=false;#peerActualUnknown=false;#nativeHandlerDone=false;#peerHandlerDone=false;
 constructor(options,...extra){
  try{
   const p=record(options,['expected','stopNative','closePeers','onUnavailable','onVerified']),expected=p&&expectedRecord(p.expected);
   if(extra.length||!p||!expected||!['stopNative','closePeers','onUnavailable','onVerified'].every(k=>callback(p[k])))throw Error();
   this.#expected=expected;this.#stopNative=p.stopNative;this.#closePeers=p.closePeers;this.#onUnavailable=p.onUnavailable;this.#onVerified=p.onVerified;
   this.#settlement=Object.freeze({actualSettled:new NativePromise(resolve=>this.#resolveActual=resolve),verifiedRelease:new NativePromise(resolve=>this.#resolveRelease=resolve),snapshot:()=>this.#settlementSnapshot()});
  }catch{throw TypeError('Bounded async session cleanup dependencies required');}
 }
 get nativeExecutionAdmitted(){return false;}
 // Passive lifetime observation, separate from the fixed first caller result.
 // Settled-negative actual work is not verified release; unknown stays retained.
 captureSettlement(...extra){return extra.length?null:this.#settlement;}
 #settlementSnapshot(){return Object.freeze({started:this.#started,actualSettled:this.#actualDone,verifiedReleased:this.#verified,unknown:this.#nativeActualUnknown||this.#peerActualUnknown,native:Object.freeze({invoked:this.#nativeInvoked,settled:this.#nativeHandlerDone,unknown:this.#nativeActualUnknown}),peers:Object.freeze({invoked:this.#peerInvoked,settled:this.#peerHandlerDone,unknown:this.#peerActualUnknown}),activeFrames:this.#active,nativeExecutionAdmitted:false});}
 #finishActual(){
  if(this.#actualDone||(!this.#started&&!this.#fenced)||this.#active||this.#nativeActualUnknown||this.#peerActualUnknown||this.#nativeInvoked&&!this.#nativeHandlerDone||this.#peerInvoked&&!this.#peerHandlerDone)return;
  this.#actualDone=true;const resolve=this.#resolveActual;this.#resolveActual=null;resolve(Object.freeze({scope:'SESSION_CLEANUP',actualSettled:true,verifiedExited:this.#verified,nativeSettled:this.#nativeHandlerDone,peersSettled:this.#peerHandlerDone,nativeExecutionAdmitted:false}));
 }
 stop(value,...extra){
  const p=!extra.length&&record(value,['deadlineMs','code']);
  if(!p||!Number.isSafeInteger(p.deadlineMs)||p.deadlineMs<1||p.deadlineMs>10000||![77,98].includes(p.code))return resolved(receipt(false,'CLEANUP_REFUSED'));
  if(this.#verified)return resolved(knownSuccess);
  if(this.#firstPromise)return this.#firstPromise;
  if(this.#fenced)return resolved(this.#firstResult??receipt(false,'CLEANUP_FAILED'));
  this.#firstPromise=new NativePromise(resolve=>this.#resolveFirst=resolve);
  this.#active++;try{
  this.#started=true;this.#nativeInvoked=true;this.#peerInvoked=true;
  this.#nativePending=true;this.#peerPending=true;this.#expires=clock()+p.deadlineMs;
  this.#timer=setTimer(()=>this.#expire(),p.deadlineMs);
  // Reserve BOTH invocations before either trusted callback can reenter.
  this.#invokeNative(p.code);this.#checkDeadline();
  this.#invokePeers();this.#checkDeadline();return this.#firstPromise;
  }finally{this.#active--;this.#finishActual();}
 }
 #invokeNative(code){
  let value;try{
   const remaining=Math.max(1,Math.min(10000,Math.ceil(this.#expires-clock())));
   value=invoke(this.#stopNative,undefined,[code,remaining]);
   if(!nativePromise(value))throw Error();this.#nativePromise=value;
   invoke(then,value,[result=>this.#nativeComplete(result),()=>this.#nativeRejected()]);
  }catch{this.#nativePromise=null;this.#nativePending=false;this.#nativeUnknown=true;this.#nativeActualUnknown=true;this.#fail('CLEANUP_FAILED');}
 }
 #invokePeers(){
  let value;try{
   value=invoke(this.#closePeers,undefined,[]);if(!nativePromise(value))throw Error();this.#peerPromise=value;
   invoke(then,value,[result=>this.#peersComplete(result),()=>this.#peersRejected()]);
  }catch{this.#peerPromise=null;this.#peerPending=false;this.#peerUnknown=true;this.#peerActualUnknown=true;this.#fail('CLEANUP_FAILED');}
 }
 #nativeComplete(value){
  this.#active++;try{
  this.#nativePending=false;this.#nativeSettled=true;
  let valid=false;try{valid=finalNative(value,this.#expected);}catch{}
  this.#nativeVerified=valid;this.#nativeUnknown=!valid;
  this.#checkDeadline();if(!valid)this.#fail('CLEANUP_FAILED');this.#verifyBoth();
  }finally{this.#nativePromise=null;this.#nativeHandlerDone=true;this.#active--;this.#finishActual();}
 }
 #nativeRejected(){
  this.#active++;try{
  this.#nativePending=false;this.#nativeSettled=true;this.#nativeUnknown=true;
  this.#checkDeadline();this.#fail('CLEANUP_FAILED');
  }finally{this.#nativePromise=null;this.#nativeHandlerDone=true;this.#active--;this.#finishActual();}
 }
 #peersComplete(value){
  this.#active++;try{
  this.#peerPending=false;this.#peerSettled=true;this.#peersVerified=value===true;this.#peerUnknown=value!==true;
  this.#checkDeadline();if(value!==true)this.#fail('CLEANUP_FAILED');this.#verifyBoth();
  }finally{this.#peerPromise=null;this.#peerHandlerDone=true;this.#active--;this.#finishActual();}
 }
 #peersRejected(){
  this.#active++;try{
  this.#peerPending=false;this.#peerSettled=true;this.#peerUnknown=true;
  this.#checkDeadline();this.#fail('CLEANUP_FAILED');
  }finally{this.#peerPromise=null;this.#peerHandlerDone=true;this.#active--;this.#finishActual();}
 }
 #verifyBoth(){
  if(this.#verified||!this.#nativeVerified||!this.#peersVerified)return;
  this.#checkDeadline();this.#verified=true;
  if(this.#timer!==null){clearTimer(this.#timer);this.#timer=null;}
  // State is final before callback reentry. Provider receipts are observations,
  // not evidence that this pure module has admitted actual native execution.
  if(!this.#verifiedNotified){this.#verifiedNotified=true;const proof=Object.freeze({scope:'SESSION_CLEANUP',verifiedExited:true,nativeExecutionAdmitted:false});try{invoke(this.#onVerified,undefined,[]);}catch{}finally{const resolve=this.#resolveRelease;this.#resolveRelease=null;if(resolve)resolve(proof);}}
  this.#checkDeadline();if(!this.#firstResult)this.#settle(knownSuccess);
 }
 #settle(value){
  if(this.#firstResult)return;this.#firstResult=value;
  if(this.#timer!==null){clearTimer(this.#timer);this.#timer=null;}
  const resolve=this.#resolveFirst;this.#resolveFirst=null;if(resolve)resolve(value);
 }
 #fail(code){
  if(this.#firstResult)return;this.#active++;try{this.#fenced=true;
  const result=receipt(false,code);this.#firstResult=result;
  if(this.#timer!==null){clearTimer(this.#timer);this.#timer=null;}
  if(!this.#notified){this.#notified=true;try{invoke(this.#onUnavailable,undefined,[]);}catch{}}
  const resolve=this.#resolveFirst;this.#resolveFirst=null;if(resolve)resolve(result);
  }finally{this.#active--;this.#finishActual();}
 }
 #checkDeadline(){if(this.#started&&!this.#firstResult&&clock()>=this.#expires)this.#fail('CLEANUP_TIMEOUT');}
 #expire(){
  if(this.#firstResult)return;const remaining=this.#expires-clock();if(remaining>0){this.#timer=setTimer(()=>this.#expire(),Math.ceil(remaining));return;}this.#fail('CLEANUP_TIMEOUT');
 }
 dispose(){if(!this.#verified)this.#fail('CLEANUP_FAILED');}
 verifyExit(){
  this.#checkDeadline();return Object.freeze({identityKnown:this.#nativeVerified,verifiedExited:this.#verified,remainingCount:this.#nativeVerified?0:null,nativeExecutionAdmitted:false});
 }
 stats(){
  this.#checkDeadline();return Object.freeze({started:this.#started,fenced:this.#fenced,nativeInvoked:this.#nativeInvoked,peerInvoked:this.#peerInvoked,nativePending:this.#nativePending,peerPending:this.#peerPending,nativeSettled:this.#nativeSettled,peerSettled:this.#peerSettled,nativeVerified:this.#nativeVerified,peersVerified:this.#peersVerified,verifiedExited:this.#verified,retainedReservation:this.#verified?0:1,unknownReservation:!this.#verified&&(this.#fenced||this.#nativeUnknown||this.#peerUnknown)?1:0,firstResultPending:this.#started&&!this.#firstResult,nativeExecutionAdmitted:false});
 }
}
