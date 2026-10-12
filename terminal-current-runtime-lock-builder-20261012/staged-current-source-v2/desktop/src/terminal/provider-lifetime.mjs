// Narrow source-only lifetime for Cwd and shell catalogue authorities. This
// joins returned provider work and local continuations, never native/host work.
import {types} from 'node:util';
const NativePromise=Promise,prototype=Promise.prototype,then=prototype.then,apply=Reflect.apply;
const species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
export function supportedProviderPromise(value){
 if(!value||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==prototype||Object.hasOwn(value,'constructor'))return false;
 const c=Object.getOwnPropertyDescriptor(prototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species.get&&s.set===species.set&&!Object.hasOwn(s,'value');
}
export function unsafeProviderValue(value){
 if(value===null||!['object','function'].includes(typeof value))return false;
 if(types.isProxy(value)||types.isPromise(value))return true;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return true;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return !Object.hasOwn(d,'value')||typeof d.value==='function';}
 return false;
}
export function providerMethod(object,key){
 try{for(let p=object;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return null;const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))return null;const fn=d.value;return(...args)=>apply(fn,object,args);}}}catch{}return null;
}
const callable=fn=>typeof fn==='function'&&!types.isProxy(fn);
const box=value=>Object.freeze(Object.assign(Object.create(null),{value}));
function passive(scope){
 const c={retired:false,done:false,unknown:false,pending:0,workers:0,frames:0,resolve:null};
 c.handle=Object.freeze({actualSettled:new NativePromise(r=>c.resolve=r),snapshot:()=>Object.freeze({scope,retired:c.retired,actualSettled:c.done,unknown:c.unknown,pending:c.pending,pendingWorkers:c.workers,activeFrames:c.frames,nativeExecutionAdmitted:false})});return c;
}
export function createProviderLifetime({scope,maxPending,refuse,onComplete}){
 const life=passive(scope),entries=new Set();
 const frame=fn=>{life.frames++;try{return fn();}finally{life.frames--;finish();}};
 function finish(){if(life.done||!life.retired||life.unknown||life.pending||life.workers||life.frames)return;const cleanup=onComplete;onComplete=null;cleanup?.();life.done=true;const resolve=life.resolve;life.resolve=null;resolve(Object.freeze(Object.assign(Object.create(null),{scope,actualSettled:true,nativeExecutionAdmitted:false})));}
 function unknown(c){c.unknown=true;life.unknown=true;}
 function complete(c){if(c.unknown||!c.workerDone||!c.workerDrain||!c.publicDrain||c.operations||!entries.has(c))return;entries.delete(c);life.workers--;c.resolve=c.reject=null;finish();}
 function release(c){if(c.occupied&&!c.unknown&&c.workerDone){c.occupied=false;life.pending--;}}
 function observe(c,value,yes,no,drained){
  if(!supportedProviderPromise(value)){unknown(c);return false;}
  try{const secondary=apply(then,value,[v=>frame(()=>yes(v)),e=>frame(()=>no(e))]);if(!supportedProviderPromise(secondary))throw Error();apply(then,secondary,[()=>frame(drained),()=>frame(()=>unknown(c))]);return true;}catch{unknown(c);return false;}
 }
 function publish(c,ok,value){if(c.published)return;c.published=true;const resolve=c.resolve,reject=c.reject;c.resolve=c.reject=null;if(ok)resolve(value);else reject(value);}
 function error(code){try{refuse(code);}catch(e){return e;}}
 function sync(c,fn,...args){
  if(life.retired||c.unknown||!callable(fn))return undefined;
  const value=frame(()=>apply(fn,undefined,args));
  if(unsafeProviderValue(value)){unknown(c);if(supportedProviderPromise(value))try{apply(then,value,[()=>{},()=>{}]);}catch{}return undefined;}return value;
 }
 function run(fn){
  if(life.retired)return new NativePromise((_,reject)=>reject(error('SENDER_REFUSED')));
  if(life.pending>=maxPending||entries.size>=64)return new NativePromise((_,reject)=>reject(error('CAPACITY_EXCEEDED')));
  const c={unknown:false,occupied:true,workerDone:false,workerDrain:false,publicDrain:false,operations:0,published:false,resolve:null,reject:null};
  const reply=new NativePromise((resolve,reject)=>{c.resolve=resolve;c.reject=reject;});entries.add(c);life.pending++;life.workers++;
  frame(()=>{
   if(!observe(c,reply,()=>{},()=>{},()=>{c.publicDrain=true;complete(c);})){publish(c,false,error('SENDER_REFUSED'));return;}
   let worker;try{worker=fn(c);}catch(e){c.workerDone=c.workerDrain=true;release(c);publish(c,false,e);complete(c);return;}
   if(!observe(c,worker,value=>{if(unsafeProviderValue(value)){unknown(c);publish(c,false,error('SENDER_REFUSED'));return;}c.workerDone=true;release(c);publish(c,true,value);},e=>{c.workerDone=true;release(c);const d=e&&!types.isProxy(e)?Object.getOwnPropertyDescriptor(e,'code'):null;const code=d&&Object.hasOwn(d,'value')&&['SENDER_REFUSED','CAPACITY_EXCEEDED','CWD_REFUSED','CANCELLED','PROFILE_UNAVAILABLE','REQUEST_REFUSED'].includes(d.value)?d.value:'SENDER_REFUSED';publish(c,false,error(code));},()=>{c.workerDrain=true;complete(c);}))publish(c,false,error('SENDER_REFUSED'));
  });return reply;
 }
 // Internal awaited envelopes alone have a DATA constructor pinned to the
 // captured native Promise. Public methods return the ordinary Promise above.
 function step(c,assert,fn,code){
  const p=new NativePromise((resolve,reject)=>frame(()=>{
   const failed=()=>{try{if(!c.unknown)assert();}catch(e){reject(e);return;}reject(error(code));};
   const result=value=>{if(unsafeProviderValue(value)){unknown(c);failed();return;}try{assert();}catch(e){reject(e);return;}if(unsafeProviderValue(value)){unknown(c);failed();return;}resolve(box(value));};
   try{assert();}catch(e){reject(e);return;}
   let value;try{if(!callable(fn))throw Error();value=apply(fn,undefined,[]);}catch{failed();return;}
   if(types.isPromise(value)&&!types.isProxy(value)){
    c.operations++;if(!observe(c,value,result,failed,()=>{c.operations--;complete(c);})){reject(error(code));}return;
   }
   result(value);
  }));Object.defineProperty(p,'constructor',{value:NativePromise});return p;
 }
 return Object.freeze({handle:life.handle,run,sync,step,retired:()=>life.retired,retire(){life.retired=true;finish();return life.handle;}});
}
