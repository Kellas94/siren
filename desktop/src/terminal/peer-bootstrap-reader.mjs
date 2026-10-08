// Bounded peer startup reader. No stdin access, NAPI load, HANDLE parsing or
// execution admission. Only native.consumePeerBootstrap interprets SIRENTP2.
import {performance} from 'node:perf_hooks';
import {Readable} from 'node:stream';
import {types} from 'node:util';
import {decodeTerminalBootstrap} from './bootstrap-codec.mjs';

const LIMIT=2064,PAYLOAD_LIMIT=2048;
const streamRefused=()=>Error('TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED');
const refused=()=>Error('TERMINAL_PEER_BOOTSTRAP_REFUSED');
const timeout=()=>Error('TERMINAL_PEER_BOOTSTRAP_TIMEOUT');
// Readable hooks schedule stdin's restart after pause and maintain listener state.
const on=(input,name,callback)=>Readable.prototype.on.call(input,name,callback);
const off=(input,name,callback)=>Readable.prototype.removeListener.call(input,name,callback);
const destroy=input=>Readable.prototype.destroy.call(input);
const read=(input,size)=>Readable.prototype.read.call(input,size);
const state=(input,name)=>Reflect.apply(Object.getOwnPropertyDescriptor(Readable.prototype,name).get,input,[]);
const wipePayload=payload=>{if(Buffer.isBuffer(payload)&&!types.isProxy(payload))payload.fill(0,0,Math.min(payload.length,PAYLOAD_LIMIT+1));};

// Inspect only own DATA descriptors, after rejecting Proxies without traps.
// Native may export other functions; these two callbacks are mandatory and are
// captured once so later mutation cannot change either ownership operation.
function callbacks(options){
 if(!options||typeof options!=='object'||types.isProxy(options)||![Object.prototype,null].includes(Object.getPrototypeOf(options)))throw streamRefused();
 const keys=Reflect.ownKeys(options);if(keys.some(key=>!['native','timeoutMs'].includes(key))||!keys.includes('native'))throw streamRefused();
 const fields=Object.create(null);
 for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(options,key);if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw streamRefused();fields[key]=descriptor.value;}
 const native=fields.native,timeoutMs=fields.timeoutMs===undefined?1000:fields.timeoutMs;
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000||!native||typeof native!=='object'||types.isProxy(native))throw streamRefused();
 const result={timeoutMs};
 for(const name of ['consumePeerBootstrap','closePeerWitness']){
  const descriptor=Object.getOwnPropertyDescriptor(native,name),method=descriptor?.value;
  if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof method!=='function'||types.isProxy(method))throw streamRefused();
  result[name]=value=>Reflect.apply(method,native,[value]);
 }
 return result;
}
function realReadable(input){
 if(!input||typeof input!=='object'||types.isProxy(input))return false;
 // instanceof would follow a Proxy prototype and execute its getPrototypeOf
 // trap. Walk ordinary prototypes only, refusing before touching a Proxy.
 let prototype=Object.getPrototypeOf(input);
 while(prototype&&prototype!==Readable.prototype){if(types.isProxy(prototype))return false;prototype=Object.getPrototypeOf(prototype);}
 if(prototype!==Readable.prototype)return false;
 const descriptor=Object.getOwnPropertyDescriptor(input,'_readableState');
 return !!descriptor&&Object.hasOwn(descriptor,'value')&&!types.isProxy(descriptor.value);
}
function rejectInput(input,reject,error){
 // Teardown requests do not establish actual close. Observe every late error
 // until close even for a stream rejected before reading begins.
 if(realReadable(input)){
  const ignore=()=>{},closed=()=>{if(state(input,'closed')){off(input,'error',ignore);off(input,'close',closed);}};
  try{on(input,'error',ignore);on(input,'close',closed);destroy(input);if(state(input,'closed'))closed();}catch{}
 }
 reject(error);
}

/**
 * Read one peer bootstrap through successful EOF and actual close, then give the
 * bounded packet to native. The native DATA result must own {witness,payload};
 * native is responsible for ownership cleanup if it throws before returning.
 * No property of the opaque witness is inspected or exposed as a raw HANDLE.
 * Result own keys are exactly {bootstrap,witness,dispose}; witness and dispose
 * are non-enumerable. bootstrap retains nativeExecutionAdmitted:false from the
 * existing codec. dispose clears secrets and closes the witness once, returning
 * the same boolean on repeat calls; true permits native deferred HANDLE close.
 */
export function readPeerTerminalBootstrap(input,options,...extra){
 return new Promise((resolve,reject)=>{
  let native;
  try{
   if(extra.length||!realReadable(input))throw streamRefused();
   native=callbacks(options);
   if(state(input,'destroyed')||state(input,'readableEnded')||state(input,'readableObjectMode')||state(input,'readableEncoding')!==null||state(input,'readableFlowing')===true)throw streamRefused();
  }catch{rejectInput(input,reject,streamRefused());return;}

  const bytes=Buffer.alloc(LIMIT+1),deadline=performance.now()+native.timeoutMs;
  let count=0,done=false,eof=false,consuming=false,payload=null,witness=null,bootstrap=null,disposed=false,disposeResult=false,timer;
  const expired=()=>performance.now()>=deadline;
  function stopReading(){off(input,'readable',drain);off(input,'end',end);}
  function detach(){stopReading();off(input,'error',errorEvent);off(input,'close',close);}
  function dispose(){
   if(disposed)return disposeResult;disposed=true;
   bootstrap?.dispose();wipePayload(payload);payload=null;
   if(witness!==null){const owned=witness;witness=null;try{disposeResult=native.closePeerWitness(owned)===true;}catch{disposeResult=false;}}
   return disposeResult;
  }
  function finish(error,result){
   if(done)return;done=true;clearTimeout(timer);stopReading();bytes.fill(0);
   // A callback may emit an error reentrantly before returning ownership. Wait
   // for its return before disposing the newly returned payload and witness.
   if(error){if(!consuming)dispose();reject(error);}else resolve(result);
   try{destroy(input);if(state(input,'closed')&&!consuming)detach();}catch{if(!error)dispose();}
  }
  function drain(){
   if(done||eof)return;
   if(expired()){finish(timeout());return;}
   try{
    while(!done){
     const size=Math.min(state(input,'readableLength'),LIMIT+1-count);
     if(size===0){read(input,0);return;}
     const chunk=read(input,size);if(chunk===null)return;
     if(!Buffer.isBuffer(chunk)||types.isProxy(chunk)||chunk.length!==size){finish(streamRefused());return;}
     chunk.copy(bytes,count);count+=chunk.length;chunk.fill(0);
     if(count>LIMIT){finish(refused());return;}
     if(expired()){finish(timeout());return;}
    }
   }catch{finish(streamRefused());}
  }
  function end(){
   if(done)return;drain();if(done)return;
   if(expired()){finish(timeout());return;}
   eof=true;stopReading();
   try{destroy(input);if(state(input,'closed'))close();}catch{finish(streamRefused());}
  }
  function errorEvent(){if(!done)finish(streamRefused());}
  function close(){
   if(consuming)return;
   const actuallyClosed=state(input,'closed');
   if(done){if(actuallyClosed)detach();return;}
   if(expired()){finish(timeout());if(actuallyClosed)detach();return;}
   if(!eof||!actuallyClosed){finish(streamRefused());if(actuallyClosed)detach();return;}
   consuming=true;
   try{
    const value=native.consumePeerBootstrap(bytes.subarray(0,count));
    // Salvage only accessible DATA ownership before validating the complete
    // result. Never execute accessors or Proxy traps for malformed native data.
    if(value&&typeof value==='object'&&!types.isProxy(value)){
     const witnessDescriptor=Object.getOwnPropertyDescriptor(value,'witness'),payloadDescriptor=Object.getOwnPropertyDescriptor(value,'payload');
     if(witnessDescriptor&&Object.hasOwn(witnessDescriptor,'value')){
      const owned=witnessDescriptor.value;
      if(owned!==null&&(typeof owned==='object'||typeof owned==='function')&&!types.isProxy(owned))witness=owned;
     }
     if(payloadDescriptor&&Object.hasOwn(payloadDescriptor,'value'))payload=payloadDescriptor.value;
     const keys=Reflect.ownKeys(value);
     if(![Object.prototype,null].includes(Object.getPrototypeOf(value))||keys.length!==2||!keys.includes('witness')||!keys.includes('payload')||!witnessDescriptor?.enumerable||!payloadDescriptor?.enumerable)throw refused();
    }else throw refused();
    if(!witness||!Buffer.isBuffer(payload)||types.isProxy(payload))throw refused();
    if(done||expired())throw timeout();
    bootstrap=decodeTerminalBootstrap(payload);payload=null;
    if(done||expired())throw timeout();
    const result={bootstrap};Object.defineProperties(result,{witness:{value:witness},dispose:{value:dispose}});
    finish(null,Object.freeze(result));
   }catch{if(!done)finish(expired()?timeout():refused());dispose();}
   finally{bytes.fill(0);consuming=false;detach();}
  }
  try{
   Readable.prototype.pause.call(input);on(input,'readable',drain);on(input,'end',end);on(input,'error',errorEvent);on(input,'close',close);
   timer=setTimeout(()=>finish(timeout()),native.timeoutMs);read(input,0);drain();
  }catch{finish(streamRefused());}
 });
}
