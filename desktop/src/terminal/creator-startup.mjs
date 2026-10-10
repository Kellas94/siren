// Pure creator-side startup owner. Trusted injected callbacks do the eventual
// provider work; this module imports/spawns no PTY, native addon or child.
// A ready reply reports PID/image only. Main MUST establish held native process
// identity and both Jobs before exposing a product session or input lease.
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {STARTUP_LIMITS,decodeStartupRequest,decodeStartupEnvelope,encodeStartupReply,validateStartupReply} from './startup-protocol.mjs';

const invoke=Reflect.apply,isProxy=types.isProxy,isPromise=types.isPromise;
const promisePrototype=Promise.prototype,then=promisePrototype.then;
const alloc=Buffer.alloc.bind(Buffer),typed=Object.getPrototypeOf(Uint8Array.prototype);
const set=typed.set,fill=typed.fill;
const clock=performance.now.bind(performance),setTimer=setTimeout,clearTimer=clearTimeout;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const callback=v=>typeof v==='function'&&!isProxy(v);
function record(value,keys=null){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const r=Object.create(null);for(const k of own){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function policyCopy(value){
 if(value===undefined)return undefined;
 const p=record(value);if(!p||!Object.hasOwn(p,'privateEnvironmentKeys')||Object.keys(p).some(k=>!['privateEnvironmentKeys','expectedExecutable'].includes(k)))throw Error();
 const a=p.privateEnvironmentKeys;if(!a||typeof a!=='object'||isProxy(a)||!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype)throw Error();
 const n=Object.getOwnPropertyDescriptor(a,'length')?.value;if(!integer(n)||n>STARTUP_LIMITS.privateKeys||Reflect.ownKeys(a).length!==n+1)throw Error();
 const keys=[];for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!/^[A-Za-z_][A-Za-z0-9_()]{0,127}$/.test(d.value))throw Error();keys.push(d.value);}
 const result={privateEnvironmentKeys:Object.freeze(keys)};
 if(Object.hasOwn(p,'expectedExecutable')){if(typeof p.expectedExecutable!=='string'||p.expectedExecutable.length>32768)throw Error();result.expectedExecutable=p.expectedExecutable;}
 return Object.freeze(result);
}
function nativePromise(value){return !!value&&typeof value==='object'&&!isProxy(value)&&isPromise(value)&&Object.getPrototypeOf(value)===promisePrototype&&!Object.hasOwn(value,'constructor');}
const unavailable=()=>Error('STARTUP_UNAVAILABLE');
const common=q=>({version:q.version,sessionId:q.sessionId,channelId:q.channelId,startupId:q.startupId,sha256:q.sha256});
function failure(q,code){return encodeStartupReply({type:'startup-failed',...common(q),phase:q.type.slice(8),...(q.type==='startup-chunk'?{index:q.index}:{}),status:'failed',code},q);}

/**
 * One constructor lifetime, one absolute deadline, one startup configuration,
 * and at most one provider preparation. No replay/reset/refund method exists.
 * Retirement wipes raw assembly and fences synchronously BEFORE settling the
 * pending result. A timed-out provider Promise remains accounted until it
 * actually settles; an uncertain synchronous spawn remains unknown forever
 * here. Only the backend's actual native cleanup may release session budgets.
 *
 * prepareShell(config) must return a native Promise of DATA {spawn}. It may
 * load/prepare the approved provider but MUST NOT spawn. spawn() is synchronous
 * and must attach its bounded output/drain handlers before returning DATA
 * {reportedShell:{pid,image},writeInput,resize}. No await separates the final
 * endpoint/gate/lifetime check from that callback. Injection is trusted glue,
 * not evidence that a native provider or filesystem path is qualified.
 */
export class TerminalCreatorStartup {
 #scope;#policy;#readGate;#endpoints;#prepare;#notify;#expires;#timer=null;
 #phase='await-begin';#retired=null;#begin=null;#bytes=null;#chunks=0;#received=0;
 #config=null;#pending=null;#pendingProvider=false;#unknownPreparation=false;#unknownSpawn=false;#attempts=0;#busy=false;#provider=null;
 constructor(options,...extra){
  try{
   const p=record(options);if(extra.length||!p||Object.keys(p).some(k=>!['sessionId','channelId','readGate','assertEndpointsCurrent','prepareShell','onUnavailable','deadlineMs','policy'].includes(k))||![p.sessionId,p.channelId].every(id)||!['readGate','assertEndpointsCurrent','prepareShell','onUnavailable'].every(k=>callback(p[k])))throw Error();
   const deadline=p.deadlineMs===undefined?STARTUP_LIMITS.deadlineMs:p.deadlineMs;if(!Number.isSafeInteger(deadline)||deadline<1||deadline>STARTUP_LIMITS.deadlineMs)throw Error();
   this.#scope=Object.freeze({sessionId:p.sessionId,channelId:p.channelId});this.#policy=policyCopy(p.policy);this.#readGate=p.readGate;this.#endpoints=p.assertEndpointsCurrent;this.#prepare=p.prepareShell;this.#notify=p.onUnavailable;
   this.#expires=clock()+deadline;this.#timer=setTimer(()=>this.#expire(),deadline);
  }catch{throw TypeError('Bounded creator startup dependencies required');}
 }
 get nativeExecutionAdmitted(){return false;}
 #wipe(){if(this.#bytes){invoke(fill,this.#bytes,[0]);this.#bytes=null;}}
 #settle(reply){const p=this.#pending;if(!p)return;this.#pending=null;p.resolve(reply);}
 #retire(code){
  if(this.#retired)return;
  this.#retired=code;this.#phase='retired';this.#wipe();this.#config=null;this.#provider=null;
  if(this.#timer!==null){clearTimer(this.#timer);this.#timer=null;}
  try{invoke(this.#notify,undefined,[code]);}catch{/* Fixed classification; no exception/environment disclosure. */}
  if(this.#pending)this.#settle(failure(this.#pending.wire,code));
 }
 #expire(){
  if(this.#retired||this.#phase==='ready')return;
  const left=this.#expires-clock();if(left>0){this.#timer=setTimer(()=>this.#expire(),Math.ceil(left));return;}
  this.#retire('STARTUP_TIMEOUT');
 }
 #live(){if(!this.#retired&&this.#phase!=='ready'&&clock()>=this.#expires)this.#retire('STARTUP_TIMEOUT');return !this.#retired;}
 #gate(){
  let r;try{r=record(invoke(this.#readGate,undefined,[]),['generation','open']);}catch{}
  if(!this.#live())return null;
  if(!r||!integer(r.generation)||typeof r.open!=='boolean'){this.#retire('STARTUP_GATE_CLOSED');return null;}return r;
 }
 #current(){
  if(!this.#live())return false;
  let current=false;try{current=invoke(this.#endpoints,undefined,[])===true;}catch{}
  if(!this.#live())return false;if(!current){this.#retire('STARTUP_ENDPOINT_UNAVAILABLE');return false;}return true;
 }
 #readyForSpawn(generation){
  if(!this.#current())return false;
  const gate=this.#gate();if(!gate)return false;
  if(!gate.open||gate.generation!==generation){this.#retire('STARTUP_GATE_CLOSED');return false;}return this.#live();
 }
 #decline(wire,code){this.#retire(code);return Promise.resolve(failure(wire,this.#retired));}
 #reply(wire,value){
  if(!this.#live())return Promise.resolve(failure(wire,this.#retired));
  const reply=encodeStartupReply(value,wire);
  return Promise.resolve(this.#live()?reply:failure(wire,this.#retired));
 }
 handle(value,...extra){
  let q,wire;
  try{
   q=!extra.length&&decodeStartupRequest(value,this.#begin??this.#scope);
   if(!q){this.#retire('STARTUP_REFUSED');return Promise.reject(unavailable());}
   // Wire DATA is consumed synchronously for replies. Only the owned decoded
   // start packet is retained across the provider await. Chunk data is wiped.
   wire=value;
   if(!this.#live())return Promise.resolve(failure(wire,this.#retired));
   if(this.#busy||this.#pending)return Promise.resolve(failure(wire,'STARTUP_BUSY'));
   this.#busy=true;
   try{
    if(q.type==='startup-begin'){
     if(this.#phase!=='await-begin')return this.#decline(wire,'STARTUP_ORDER_REFUSED');
     this.#begin=Object.freeze({type:q.type,...common(q),totalBytes:q.totalBytes,chunkCount:q.chunkCount});
     this.#bytes=alloc(q.totalBytes);this.#phase='receiving';
     return this.#reply(wire,{type:'startup-begin-ack',...common(q),status:'accepted',code:'STARTUP_ACCEPTED'});
    }
    if(q.type==='startup-chunk'){
     if(this.#phase!=='receiving'||q.index!==this.#chunks)return this.#decline(wire,'STARTUP_ORDER_REFUSED');
     invoke(set,this.#bytes,[q.data,this.#received]);this.#received+=q.data.length;this.#chunks++;
     return this.#reply(wire,{type:'startup-chunk-ack',...common(q),index:q.index,status:'accepted',code:'STARTUP_ACCEPTED'});
    }
    if(q.type==='startup-seal'){
     if(this.#phase!=='receiving'||this.#chunks!==this.#begin.chunkCount||this.#received!==this.#begin.totalBytes)return this.#decline(wire,'STARTUP_ORDER_REFUSED');
     const config=decodeStartupEnvelope(this.#bytes,this.#begin,this.#policy);this.#wipe();
     if(!config)return this.#decline(wire,'STARTUP_HASH_REFUSED');
     if(!this.#current())return Promise.resolve(failure(wire,this.#retired));
     const gate=this.#gate();if(!gate)return Promise.resolve(failure(wire,this.#retired));
     if(gate.open)return this.#decline(wire,'STARTUP_GATE_CLOSED');
     this.#config=config;this.#phase='prepared';
     return this.#reply(wire,{type:'startup-prepared',...common(q),projectId:config.projectId,admissionEpoch:config.admissionEpoch,initiallyClosed:true,status:'accepted',code:'STARTUP_PREPARED'});
    }
    if(this.#phase!=='prepared')return this.#decline(wire,'STARTUP_ORDER_REFUSED');
    if(!this.#readyForSpawn(q.gateGeneration))return Promise.resolve(failure(wire,this.#retired));
    // Consume the one-use permission BEFORE calling any provider code.
    this.#phase='preparing-provider';this.#pendingProvider=true;
    const config=this.#config;let resolve;const promise=new Promise(yes=>{resolve=yes;});
    this.#pending={wire:Object.freeze({...q}),resolve};
    let preparation;try{preparation=invoke(this.#prepare,undefined,[config]);}catch{this.#unknownPreparation=true;this.#retire('STARTUP_AMBIGUOUS');return promise;}
    if(!nativePromise(preparation)){this.#unknownPreparation=true;this.#retire('STARTUP_AMBIGUOUS');return promise;}
    invoke(then,preparation,[value=>this.#preparedProvider(value,q,config),()=>{this.#pendingProvider=false;this.#retire('STARTUP_AMBIGUOUS');}]);
    this.#live();return promise;
   }finally{this.#busy=false;}
  }catch{this.#retire(this.#attempts?'STARTUP_AMBIGUOUS':'STARTUP_REFUSED');return Promise.reject(unavailable());}
  finally{if(q?.type==='startup-chunk')invoke(fill,q.data,[0]);}
 }
 #preparedProvider(value,q,config){
  this.#pendingProvider=false;if(!this.#live())return;
  let prepared;try{prepared=record(value,['spawn']);}catch{}
  if(!prepared||!callback(prepared.spawn)){this.#retire('STARTUP_AMBIGUOUS');return;}
  if(!this.#readyForSpawn(q.gateGeneration))return;
  this.#phase='spawning';this.#attempts++;this.#unknownSpawn=true;
  let outcome;try{outcome=invoke(prepared.spawn,undefined,[]);}catch{this.#retire('STARTUP_AMBIGUOUS');return;}
  // A callback may reenter disposal or occupy the event loop past the deadline.
  // Even a plausible outcome does not cancel that fence or establish cleanup.
  if(!this.#live())return;
  let p,shell;try{p=record(outcome,['reportedShell','writeInput','resize']);shell=p&&record(p.reportedShell,['pid','image']);}catch{}
  if(!p||!shell||!callback(p.writeInput)||!callback(p.resize)||typeof shell.image!=='string'||shell.image.toLowerCase()!==config.shell.executable.toLowerCase())return this.#retire('STARTUP_AMBIGUOUS');
  const reply=encodeStartupReply({type:'startup-ready',...common(q),gateGeneration:q.gateGeneration,reportedShell:shell,status:'accepted',code:'STARTUP_READY'},q);
  if(!reply||!validateStartupReply(reply,q))return this.#retire('STARTUP_AMBIGUOUS');
  // Recheck after the synchronous provider callback as well; uncertain shell
  // existence is held for backend cleanup if Lock happened inside the callback.
  if(!this.#readyForSpawn(q.gateGeneration))return;
  this.#provider=Object.freeze({writeInput:p.writeInput,resize:p.resize});this.#unknownSpawn=false;this.#phase='ready';this.#config=null;
  if(this.#timer!==null){clearTimer(this.#timer);this.#timer=null;}this.#settle(reply);
 }
 commandCallbacks(){
  if(this.#retired||this.#phase!=='ready'||!this.#provider)return null;
  // Private trusted glue for CreatorCommands ONLY, not a standalone input API.
  // That authority checks the exact lease/gate immediately before dispatch.
  // Calling an arbitrary currentness/gate callback here could reenter Lock or
  // revoke the lease AFTER its final check and before the provider side effect.
  return Object.freeze({writeInput:data=>this.#command('writeInput',[data]),resize:(cols,rows)=>this.#command('resize',[cols,rows])});
 }
 #command(kind,args){
  if(this.#retired||this.#phase!=='ready'||!this.#provider)throw unavailable();
  // No arbitrary callback or await intervenes between the authority's final
  // lease/gate check and this captured synchronous provider function.
  let result;try{result=invoke(this.#provider[kind],undefined,args);}catch{this.#retire('STARTUP_AMBIGUOUS');throw unavailable();}
  if(result!==undefined){this.#retire('STARTUP_AMBIGUOUS');throw unavailable();}
 }
 dispose(...extra){if(extra.length)return false;this.#retire('STARTUP_RETIRED');return true;}
 stats(){return Object.freeze({nativeExecutionAdmitted:false,phase:this.#phase,retired:!!this.#retired,code:this.#retired,receivedChunks:this.#chunks,receivedBytes:this.#received,rawReservedBytes:this.#bytes?.length??0,pendingProvider:this.#pendingProvider,unknownPreparation:this.#unknownPreparation,unknownSpawn:this.#unknownSpawn,spawnAttempts:this.#attempts});}
}
