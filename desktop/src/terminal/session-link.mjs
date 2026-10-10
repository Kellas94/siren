// Pure main-side startup/command correlation, never native execution admission.
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {TerminalSessionCommandChannel} from './session-command-channel.mjs';
import {STARTUP_LIMITS,validateStartupEnvelope,encodeStartupEnvelope,encodeStartupRequest,validateStartupReply} from './startup-protocol.mjs';
import {encodeTerminalCommandRequest,decodeTerminalCommandRequest,validateTerminalCommandReply} from './command-protocol.mjs';

const invoke=Reflect.apply,clock=performance.now.bind(performance),timer=setTimeout,cancel=clearTimeout;
const proto=TerminalSessionCommandChannel.prototype;
const identity=Object.getOwnPropertyDescriptor(proto,'identity').get,phase=Object.getOwnPropertyDescriptor(proto,'phase').get;
const subscribe=proto.subscribe,send=proto.send,available=proto.isAvailable,close=proto.dispose;
const NativePromise=Promise,promisePrototype=Promise.prototype,then=promisePrototype.then;
const typed=Object.getPrototypeOf(Uint8Array.prototype),fill=typed.fill,alloc=Buffer.alloc.bind(Buffer),copy=Buffer.prototype.copy;
const TOKEN=['sessionId','channelId','projectId','windowId','epoch','leaseId','generation','gateGeneration'];
const error=code=>Error(code),refused=()=>TypeError('Bounded main session link required');
const reject=code=>new NativePromise((yes,no)=>no(error(code)));
function fields(value,keys=null){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const p=Object.getPrototypeOf(value);if(p!==Object.prototype&&p!==null)return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const r=Object.create(null);for(const k of own){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function nativePromise(value){return !!value&&typeof value==='object'&&!types.isProxy(value)&&types.isPromise(value)&&Object.getPrototypeOf(value)===promisePrototype&&!Object.hasOwn(value,'constructor');}
function ownedPromise(channel,name){const d=Object.getOwnPropertyDescriptor(channel,name);return d&&Object.hasOwn(d,'value')&&nativePromise(d.value)?d.value:null;}
function command(value){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const d=Object.getOwnPropertyDescriptor(value,'op');if(!d||!Object.hasOwn(d,'value')||!['install','revoke','input','resize'].includes(d.value))return null;
 return fields(value,['op','token',...(d.value==='input'?['inputSequence','data']:d.value==='resize'?['cols','rows']:[])]);
}
const common=q=>({version:q.version,sessionId:q.sessionId,channelId:q.channelId,startupId:q.startupId,sha256:q.sha256});

/** One lifetime subscription and one pending wire request, without a queue.
 * Startup uses one absolute deadline including authentication/prepared wait.
 * After ready, each command has its own deadline; an idle session does not expire.
 * Unknown correlation remains occupied for this lifetime. Loss/timeouts do NOT
 * settle transport/native/provider work or refund any backend reservation.
 */
export class TerminalSessionLink {
 #channel;#scope;#notify;#deadline;#phase='idle';#fenced=false;#authenticated=false;#ready=false;
 #resolveAuthenticated;#resolveReady;#authWait;#resolveAuthWait;#unsubscribe=null;
 #attempted=false;#expires=null;#startupTimer=null;#body=null;#begin=null;#expected=null;#startup=null;
 #pending=null;#slot=null;#next=0;#replying=false;
 constructor(options,...extra){
  let p,s,authenticated,ready;
  try{
   p=fields(options);if(extra.length||!p||Object.keys(p).some(k=>!['channel','onUnavailable','deadlineMs'].includes(k))||!p.channel||types.isProxy(p.channel)||typeof p.onUnavailable!=='function'||types.isProxy(p.onUnavailable))throw refused();
   s=invoke(identity,p.channel,[]);if(s.role!=='main')throw refused();
   authenticated=ownedPromise(p.channel,'authenticated');ready=ownedPromise(p.channel,'ready');if(!authenticated||!ready)throw refused();
   const deadline=p.deadlineMs===undefined?STARTUP_LIMITS.deadlineMs:p.deadlineMs;if(!Number.isSafeInteger(deadline)||deadline<1||deadline>STARTUP_LIMITS.deadlineMs)throw refused();this.#deadline=deadline;
  }catch{throw refused();}
  this.#channel=p.channel;this.#scope=Object.freeze({sessionId:s.sessionId,channelId:s.channelId});this.#notify=p.onUnavailable;
  this.#authWait=new NativePromise(resolve=>this.#resolveAuthWait=resolve);
  Object.defineProperties(this,{authenticated:{value:new NativePromise(resolve=>this.#resolveAuthenticated=resolve),enumerable:true},ready:{value:new NativePromise(resolve=>this.#resolveReady=resolve),enumerable:true}});
  try{
   this.#unsubscribe=invoke(subscribe,this.#channel,[{message:value=>this.#reply(value),closed:()=>this.#fence()}]);
   if(typeof this.#unsubscribe!=='function'||types.isProxy(this.#unsubscribe)||!nativePromise(authenticated)||!nativePromise(ready))throw refused();
   invoke(then,authenticated,[value=>{
    if(this.#fenced)return;
    if(value!==true||!this.#current()||invoke(phase,this.#channel,[])!=='startup'){this.#fence();return;}
    this.#authenticated=true;this.#resolveAuthenticated(true);this.#resolveAuthWait(true);
   },()=>this.#fence()]);
   invoke(then,ready,[value=>{if(value!==true)this.#fence();},()=>this.#fence()]);
  }catch{this.#fence();throw refused();}
 }
 get nativeExecutionAdmitted(){return false;}
 get identity(){return Object.freeze({role:'main',...this.#scope});}
 #current(){try{return !this.#fenced&&invoke(available,this.#channel,[])===true;}catch{return false;}}
 #deadlineCurrent(){
  if(!this.#fenced&&this.#expires!==null&&clock()>=this.#expires)this.#fence();return !this.#fenced;
 }
 #startupCurrent(){if(!this.#deadlineCurrent()||!this.#current()){this.#fence();return false;}return true;}
 #isAvailable(){
  if(this.#pending&&clock()>=this.#pending.expires)this.#fence();
  if(this.#fenced||!this.#ready||this.#phase!=='commands')return false;
  try{if(this.#current()&&invoke(phase,this.#channel,[])==='commands')return true;}catch{}
  this.#fence();return false;
 }
 isAvailable(){return this.#isAvailable();}
 prepare(value,policy,...extra){
  const began=clock();if(!this.#deadlineCurrent())return reject('STARTUP_UNAVAILABLE');
  if(this.#phase==='preparing'||this.#phase==='starting')return reject('STARTUP_BUSY');
  if(this.#attempted||this.#phase!=='idle')return reject('STARTUP_REFUSED');
  let config,encoded;
  try{
   config=!extra.length&&validateStartupEnvelope(value,policy);
   if(!config||config.sessionId!==this.#scope.sessionId||config.channelId!==this.#scope.channelId)return reject('STARTUP_REFUSED');
   encoded=encodeStartupEnvelope(config,policy);if(!encoded)return reject('STARTUP_REFUSED');
  }catch{return reject('STARTUP_REFUSED');}
  this.#attempted=true;this.#phase='preparing';this.#expires=began+this.#deadline;this.#body=encoded;
  this.#begin=Object.freeze({type:'startup-begin',version:1,...this.#scope,startupId:encoded.startupId,totalBytes:encoded.totalBytes,chunkCount:encoded.chunkCount,sha256:encoded.sha256});
  this.#expected=Object.freeze({projectId:config.projectId,admissionEpoch:config.admissionEpoch,executable:config.shell.executable});
  this.#startup=Object.freeze({kind:'startup',phase:'authentication',...common(this.#begin),totalBytes:encoded.totalBytes,chunkCount:encoded.chunkCount});
  this.#startupTimer=timer(()=>this.#expireStartup(),Math.max(1,Math.ceil(this.#expires-clock())));
  return this.#prepare();
 }
 async #prepare(){
  try{
   if(await this.#authWait!==true||!this.#startupCurrent())throw error('STARTUP_UNAVAILABLE');
   await this.#exchangeStartup(this.#begin);
   for(let index=0;index<this.#begin.chunkCount;index++){
    if(!this.#startupCurrent())throw error('STARTUP_UNAVAILABLE');
    const offset=index*STARTUP_LIMITS.chunkBytes,count=Math.min(STARTUP_LIMITS.chunkBytes,this.#begin.totalBytes-offset),bytes=alloc(count);
    let pending;try{invoke(copy,this.#body.bytes,[bytes,0,offset,offset+count]);pending=this.#exchangeStartup({...this.#begin,type:'startup-chunk',index,data:bytes});}finally{invoke(fill,bytes,[0]);}
    await pending;
   }
   const result=await this.#exchangeStartup({type:'startup-seal',...common(this.#begin)});
   if(!this.#startupCurrent()||this.#phase!=='prepared')throw error('STARTUP_UNAVAILABLE');return result;
  }catch{this.#fence();throw error('STARTUP_UNAVAILABLE');}finally{this.#wipeBody();}
 }
 start(value,...extra){
  if(!this.#deadlineCurrent())return reject('STARTUP_UNAVAILABLE');
  if(this.#phase==='starting')return reject('STARTUP_BUSY');
  if(this.#phase!=='prepared')return reject('STARTUP_REFUSED');
  const p=!extra.length&&fields(value,['gateGeneration']);if(!p||!Number.isSafeInteger(p.gateGeneration)||p.gateGeneration<1)return reject('STARTUP_REFUSED');
  if(!this.#startupCurrent())return reject('STARTUP_UNAVAILABLE');this.#phase='starting';
  return this.#start({type:'startup-start',...common(this.#begin),gateGeneration:p.gateGeneration});
 }
 async #start(value){
  const result=await this.#exchangeStartup(value);if(!this.#isAvailable())throw error('STARTUP_UNAVAILABLE');return result;
 }
 #exchangeStartup(value){
  if(!this.#startupCurrent()||this.#pending)return reject('STARTUP_UNAVAILABLE');
  const wire=encodeStartupRequest(value,value.type==='startup-begin'?this.#scope:this.#begin);if(!wire){this.#fence();return reject('STARTUP_UNAVAILABLE');}
  const metadata=Object.freeze({kind:'startup',phase:value.type,...common(wire),...(wire.index===undefined?{}:{index:wire.index}),totalBytes:this.#begin.totalBytes,chunkCount:this.#begin.chunkCount});
  this.#startup=metadata;return this.#exchange(value,wire,metadata,this.#expires);
 }
 request(value,...extra){
  if(this.#pending&&clock()>=this.#pending.expires)this.#fence();
  if(!this.#isAvailable())return reject('COMMAND_UNAVAILABLE');if(this.#pending)return reject('COMMAND_BUSY');
  if(this.#next===Number.MAX_SAFE_INTEGER){this.#fence();return reject('COMMAND_UNAVAILABLE');}
  let packet;try{
   const p=!extra.length&&command(value);if(!p)return reject('COMMAND_REFUSED');
   const wire=encodeTerminalCommandRequest({type:'command',...this.#scope,requestId:this.#next+1,...p},this.#scope);packet=wire&&decodeTerminalCommandRequest(wire,this.#scope);if(!packet)return reject('COMMAND_REFUSED');
  }catch{return reject('COMMAND_REFUSED');}
  this.#next=packet.requestId;
  const metadata=Object.freeze({kind:'command',op:packet.op,token:packet.token,sessionId:packet.sessionId,channelId:packet.channelId,requestId:packet.requestId});
  return this.#exchange(packet,null,metadata,clock()+this.#deadline);
 }
 #exchange(packet,wire,metadata,expires){
  let resolve,reject;const promise=new NativePromise((yes,no)=>{resolve=yes;reject=no;});
  const p={wire,metadata,expires,resolve,reject,timer:null};this.#pending=p;this.#slot=Object.freeze({state:'pending',metadata});
  if(metadata.kind==='command')p.timer=timer(()=>this.#expireCommand(p),this.#deadline);
  // Reserve before send; valid synchronous replies may arrive inside send.
  try{if(invoke(send,this.#channel,[packet])!==true)this.#fence();}catch{this.#fence();}
  if(this.#pending===p&&clock()>=p.expires)this.#fence();return promise;
 }
 #reply(value){
  if(this.#fenced)return;if(this.#replying){this.#fence();return;}this.#replying=true;
  try{
   const p=this.#pending;if(!p||clock()>=p.expires||!this.#current()){this.#fence();return;}
   const startup=p.metadata.kind==='startup',reply=startup?validateStartupReply(value,p.wire):validateTerminalCommandReply(value,this.#scope);
   if(!reply){this.#fence();return;}
   if(startup){
    if(reply.type==='startup-failed'){this.#fence();return;}
    if(reply.type==='startup-prepared'&&(reply.projectId!==this.#expected.projectId||reply.admissionEpoch!==this.#expected.admissionEpoch||reply.initiallyClosed!==true)){this.#fence();return;}
    const ready=reply.type==='startup-ready';
    if(ready&&reply.reportedShell.image.toLowerCase()!==this.#expected.executable.toLowerCase()||invoke(phase,this.#channel,[])!==(ready?'commands':'startup')){this.#fence();return;}
   }else{
    const m=p.metadata;if(reply.op!==m.op||reply.requestId!==m.requestId||TOKEN.some(k=>reply.token[k]!==m.token[k])||invoke(phase,this.#channel,[])!=='commands'||reply.status==='failed'&&reply.code==='COMMAND_AMBIGUOUS'){this.#fence();return;}
   }
   if(this.#pending!==p||clock()>=p.expires||!this.#current()){this.#fence();return;}
   this.#pending=null;this.#slot=null;p.wire=null;if(p.timer!==null)cancel(p.timer);
   if(startup&&reply.type==='startup-prepared'){this.#phase='prepared';this.#startup=Object.freeze({...p.metadata,phase:'prepared'});}
   if(startup&&reply.type==='startup-ready'){
    this.#phase='commands';this.#ready=true;this.#startup=null;this.#begin=null;this.#expected=null;this.#expires=null;
    if(this.#startupTimer!==null){cancel(this.#startupTimer);this.#startupTimer=null;}this.#resolveReady(true);
   }
   if(!startup&&reply.status==='failed'&&['ENDPOINT_UNAVAILABLE','COMMAND_RETIRED'].includes(reply.code))this.#fence();
   p.resolve(reply);
  }catch{this.#fence();}finally{this.#replying=false;}
 }
 #expireStartup(){
  if(this.#fenced||this.#expires===null)return;const left=this.#expires-clock();
  if(left>0){this.#startupTimer=timer(()=>this.#expireStartup(),Math.ceil(left));return;}this.#fence();
 }
 #expireCommand(p){
  if(this.#fenced||this.#pending!==p)return;const left=p.expires-clock();if(left>0){p.timer=timer(()=>this.#expireCommand(p),Math.ceil(left));return;}this.#fence();
 }
 #wipeBody(){if(this.#body){const body=this.#body;this.#body=null;invoke(body.dispose,undefined,[]);}}
 #fence(){
  if(this.#fenced)return;this.#fenced=true;this.#ready=false;this.#phase='closed';
  const p=this.#pending;this.#pending=null;
  if(p){if(p.timer!==null)cancel(p.timer);p.wire=null;this.#slot=Object.freeze({state:'unknown',metadata:p.metadata});}
  else if(this.#startup&&!this.#slot)this.#slot=Object.freeze({state:'unknown',metadata:this.#startup});
  if(this.#startupTimer!==null){cancel(this.#startupTimer);this.#startupTimer=null;}this.#wipeBody();this.#begin=null;this.#expected=null;this.#startup=null;
  // Fence and wipe before trusted notification, then settle public operations.
  try{invoke(this.#notify,undefined,[]);}catch{}
  const detach=this.#unsubscribe;this.#unsubscribe=null;if(detach)try{invoke(detach,undefined,[]);}catch{}
  try{invoke(close,this.#channel,[]);}catch{}
  this.#resolveAuthenticated(false);this.#resolveAuthWait(false);this.#resolveReady(false);
  if(p)p.reject(error(p.metadata.kind==='startup'?'STARTUP_UNAVAILABLE':'COMMAND_UNAVAILABLE'));
 }
 dispose(){this.#fence();}
 stats(){
  this.#deadlineCurrent();return Object.freeze({available:this.#isAvailable(),fenced:this.#fenced,phase:this.#phase,authenticated:this.#authenticated,startupAttempted:this.#attempted,retainedStartupBytes:this.#body?.totalBytes??0,pendingRequests:this.#pending?1:0,unknownRequests:this.#slot?.state==='unknown'?1:0,retainedRequestSlots:this.#slot?1:0,unknownMetadata:this.#slot?.state==='unknown'?this.#slot.metadata:null,lastRequestId:this.#next,nativeExecutionAdmitted:false});
 }
}
