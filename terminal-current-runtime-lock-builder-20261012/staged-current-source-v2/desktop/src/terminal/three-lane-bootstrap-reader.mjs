// Separate bounded three-lane startup reader. Native alone interprets SIRENTP3
// and its inherited HANDLE; this module never loads an addon or parses a HANDLE.
import {performance} from 'node:perf_hooks';
import {Readable} from 'node:stream';
import {types} from 'node:util';
import {decodeThreeLaneTerminalBootstrap} from './three-lane-bootstrap-codec.mjs';
const LIMIT=2064,PAYLOAD_LIMIT=2048,bufferPrototype=Buffer.prototype;
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const streamRefused=()=>Error('THREE_LANE_BOOTSTRAP_STREAM_REFUSED');
const refused=()=>Error('THREE_LANE_BOOTSTRAP_REFUSED'),timeout=()=>Error('THREE_LANE_BOOTSTRAP_TIMEOUT');
// Readable registration schedules restart after Node stdin's pause-nextTick stop.
const on=(input,name,callback)=>Readable.prototype.on.call(input,name,callback);
const off=(input,name,callback)=>Readable.prototype.removeListener.call(input,name,callback);
const destroy=input=>Readable.prototype.destroy.call(input),read=(input,size)=>Readable.prototype.read.call(input,size);
const state=(input,name)=>Reflect.apply(Object.getOwnPropertyDescriptor(Readable.prototype,name).get,input,[]);
function size(value){if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;try{return Reflect.apply(byteLength,value,[]);}catch{return null;}}
function wipe(value,limit=PAYLOAD_LIMIT+1){if(types.isProxy(value)||!types.isUint8Array(value))return;try{Reflect.apply(fill,value,[0,0,Math.min(Reflect.apply(byteLength,value,[]),limit)]);}catch{}}
function callbacks(options){
 if(!options||typeof options!=='object'||types.isProxy(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw streamRefused();
 const keys=Reflect.ownKeys(options);if(keys.some(key=>!['native','timeoutMs'].includes(key))||!keys.includes('native'))throw streamRefused();
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(options,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw streamRefused();r[key]=d.value;}
 const native=r.native,timeoutMs=r.timeoutMs===undefined?1000:r.timeoutMs;if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000||!native||typeof native!=='object'||types.isProxy(native))throw streamRefused();
 const result={timeoutMs};for(const name of['consumePeerBootstrap','closePeerWitness']){const d=Object.getOwnPropertyDescriptor(native,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw streamRefused();const fn=d.value;result[name]=value=>Reflect.apply(fn,native,[value]);}return result;
}
function realReadable(input){
 if(!input||typeof input!=='object'||types.isProxy(input))return false;
 let prototype=Object.getPrototypeOf(input);while(prototype&&prototype!==Readable.prototype){if(types.isProxy(prototype))return false;prototype=Object.getPrototypeOf(prototype);}if(prototype!==Readable.prototype)return false;
 const d=Object.getOwnPropertyDescriptor(input,'_readableState');return !!d&&Object.hasOwn(d,'value')&&!types.isProxy(d.value);
}
function rejectInput(input,reject,error){
 if(realReadable(input)){const ignore=()=>{},closed=()=>{if(state(input,'closed')){off(input,'error',ignore);off(input,'close',closed);}};try{on(input,'error',ignore);on(input,'close',closed);destroy(input);if(state(input,'closed'))closed();}catch{}}
 reject(error);
}
/**
 * Read through successful EOF and actual close before native consumption.
 * Native must return own DATA {witness,payload}; it owns cleanup if it throws.
 * The frozen result hides witness/dispose from JSON and never inspects witness.
 * Normal disposal follows connection of ALL THREE native lanes; disposing
 * earlier is an intentional abort and native retires the whole group. Endpoint
 * capabilities independently retain the held main peer until actual IO settles.
 */
export function readThreeLaneTerminalBootstrap(input,options,...extra){
 return new Promise((resolve,reject)=>{
  let native;
  try{if(extra.length||!realReadable(input))throw streamRefused();native=callbacks(options);if(state(input,'destroyed')||state(input,'readableEnded')||state(input,'readableObjectMode')||state(input,'readableEncoding')!==null||state(input,'readableFlowing')===true)throw streamRefused();}
  catch{rejectInput(input,reject,streamRefused());return;}
  const bytes=Buffer.alloc(LIMIT+1),deadline=performance.now()+native.timeoutMs;
  let count=0,done=false,eof=false,consuming=false,payload=null,witness=null,bootstrap=null,disposed=false,disposeResult=false,timer;
  const expired=()=>performance.now()>=deadline;
  function stopReading(){off(input,'readable',drain);off(input,'end',end);}
  function detach(){stopReading();off(input,'error',errorEvent);off(input,'close',close);}
  function dispose(){
   if(disposed)return disposeResult;disposed=true;bootstrap?.dispose();wipe(payload);payload=null;
   if(witness!==null){const owned=witness;witness=null;try{disposeResult=native.closePeerWitness(owned)===true;}catch{disposeResult=false;}}return disposeResult;
  }
  function finish(error,result){
   if(done)return;done=true;clearTimeout(timer);stopReading();wipe(bytes,LIMIT+1);
   // A reentrant error may precede native's return of newly owned capabilities.
   if(error){if(!consuming)dispose();reject(error);}else resolve(result);
   try{destroy(input);if(state(input,'closed')&&!consuming)detach();}catch{if(!error)dispose();}
  }
  function drain(){
   if(done||eof)return;if(expired()){finish(timeout());return;}
   try{
    while(!done){const wanted=Math.min(state(input,'readableLength'),LIMIT+1-count);if(wanted===0){read(input,0);return;}const chunk=read(input,wanted);if(chunk===null)return;
     const length=size(chunk);if(length!==wanted){wipe(chunk,LIMIT+1);finish(streamRefused());return;}Reflect.apply(set,bytes,[chunk,count]);count+=length;wipe(chunk,LIMIT+1);
     if(count>LIMIT){finish(refused());return;}if(expired()){finish(timeout());return;}
    }
   }catch{finish(streamRefused());}
  }
  function end(){if(done)return;drain();if(done)return;if(expired()){finish(timeout());return;}eof=true;stopReading();try{destroy(input);if(state(input,'closed'))close();}catch{finish(streamRefused());}}
  function errorEvent(){if(!done)finish(streamRefused());}
  function close(){
   if(consuming)return;const actuallyClosed=state(input,'closed');if(done){if(actuallyClosed)detach();return;}
   if(expired()){finish(timeout());if(actuallyClosed)detach();return;}if(!eof||!actuallyClosed){finish(streamRefused());if(actuallyClosed)detach();return;}
   consuming=true;
   try{
    const value=native.consumePeerBootstrap(bytes.subarray(0,count));
    if(value&&typeof value==='object'&&!types.isProxy(value)){
     const w=Object.getOwnPropertyDescriptor(value,'witness'),p=Object.getOwnPropertyDescriptor(value,'payload');
     if(w&&Object.hasOwn(w,'value')){const owned=w.value;if(owned!==null&&(typeof owned==='object'||typeof owned==='function')&&!types.isProxy(owned))witness=owned;}
     if(p&&Object.hasOwn(p,'value'))payload=p.value;
     const keys=Reflect.ownKeys(value);if(![Object.prototype,null].includes(Object.getPrototypeOf(value))||keys.length!==2||!keys.includes('witness')||!keys.includes('payload')||!w?.enumerable||!p?.enumerable)throw refused();
    }else throw refused();
    if(!witness||size(payload)===null)throw refused();if(done||expired())throw timeout();bootstrap=decodeThreeLaneTerminalBootstrap(payload);payload=null;if(done||expired())throw timeout();
    const result={bootstrap};Object.defineProperties(result,{witness:{value:witness},dispose:{value:dispose}});finish(null,Object.freeze(result));
   }catch{if(!done)finish(expired()?timeout():refused());dispose();}
   finally{wipe(bytes,LIMIT+1);consuming=false;detach();}
  }
  try{Readable.prototype.pause.call(input);on(input,'readable',drain);on(input,'end',end);on(input,'error',errorEvent);on(input,'close',close);timer=setTimeout(()=>finish(timeout()),native.timeoutMs);read(input,0);drain();}
  catch{finish(streamRefused());}
 });
}
