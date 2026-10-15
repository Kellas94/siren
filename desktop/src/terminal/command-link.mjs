// Pure main-side correlation over an already authenticated command channel.
// No backend bridge, native provider, authority dispatch, shell or replay.
import {performance} from 'node:perf_hooks';
import {types} from 'node:util';
import {TerminalCommandChannel} from './command-channel.mjs';
import {COMMAND_LIMITS,encodeTerminalCommandRequest,decodeTerminalCommandRequest,validateTerminalCommandReply} from './command-protocol.mjs';

const invoke=Reflect.apply;
const channelIdentity=Object.getOwnPropertyDescriptor(TerminalCommandChannel.prototype,'identity').get;
const subscribe=TerminalCommandChannel.prototype.subscribe,send=TerminalCommandChannel.prototype.send,close=TerminalCommandChannel.prototype.dispose,available=TerminalCommandChannel.prototype.isAvailable;
const promisePrototype=Promise.prototype,then=promisePrototype.then;
const TOKEN=['sessionId','channelId','projectId','windowId','epoch','leaseId','generation','gateGeneration'];
const unavailable=()=>Error('COMMAND_UNAVAILABLE');
const refused=()=>TypeError('Bounded main command link required');
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function requestParts(value){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const op=Object.getOwnPropertyDescriptor(value,'op');if(!op||!Object.hasOwn(op,'value')||!['install','revoke','input','resize'].includes(op.value))return null;
 return fields(value,['op','token',...(op.value==='input'?['inputSequence','data']:op.value==='resize'?['cols','rows']:[])]);
}

/**
 * One request may be pending. Known correlated ACKs release its slot. Loss,
 * timeout or ambiguity retains one unknown correlation slot for this instance's
 * entire lifetime, without input data or a reset/replacement admission method.
 *
 * A timeout or fence does not prove that the actual transport/native/provider
 * operation settled. The backend must retain its session and provider budgets
 * until actual cleanup is confirmed; constructing another link supplies no such
 * confirmation. This class exposes no execution or cleanup admission receipt.
 */
export class TerminalCommandLink {
 #channel;#scope;#notify;#deadline;#ready=false;#fenced=false;#next=0;
 #pending=null;#slot=null;#unsubscribe=null;#resolveReady;#onTimeout;
 constructor(options,...extra){
  let p,identity,channelReady;
  try{
   if(!options||typeof options!=='object'||types.isProxy(options))throw refused();
   const keys=Reflect.ownKeys(options);if(keys.some(key=>!['channel','onUnavailable','deadlineMs'].includes(key)))throw refused();p=fields(options,keys);
   if(extra.length||!p||!p.channel||types.isProxy(p.channel)||typeof p.onUnavailable!=='function'||types.isProxy(p.onUnavailable))throw refused();
   identity=invoke(channelIdentity,p.channel,[]);if(identity.role!=='main')throw refused();
   const d=Object.getOwnPropertyDescriptor(p.channel,'ready');if(!d||!Object.hasOwn(d,'value')||types.isProxy(d.value)||!types.isPromise(d.value))throw refused();
   // Native Promise.then still consults constructor/species. Reject caller
   // constructor overrides or a foreign prototype before it can execute them.
   if(Object.getPrototypeOf(d.value)!==promisePrototype||Object.hasOwn(d.value,'constructor'))throw refused();channelReady=d.value;
   const deadline=p.deadlineMs===undefined?COMMAND_LIMITS.deadlineMs:p.deadlineMs;if(!Number.isSafeInteger(deadline)||deadline<1||deadline>COMMAND_LIMITS.deadlineMs)throw refused();this.#deadline=deadline;
  }catch{throw refused();}
  this.#channel=p.channel;this.#scope=Object.freeze({channelId:identity.channelId,sessionId:identity.sessionId});this.#notify=p.onUnavailable;
  this.#onTimeout=()=>this.#expire();
  Object.defineProperty(this,'ready',{value:new Promise(resolve=>this.#resolveReady=resolve),enumerable:true});
  try{
   this.#unsubscribe=invoke(subscribe,this.#channel,[{message:value=>this.#reply(value),closed:()=>this.#fence()}]);
   if(this.#fenced)this.#detach();
   invoke(then,channelReady,[value=>{
    if(this.#fenced)return;
    if(value!==true||invoke(available,this.#channel,[])!==true){this.#fence();return;}
    this.#ready=true;this.#resolveReady(true);
   },()=>this.#fence()]);
  }catch{this.#fence();throw refused();}
 }
 get nativeExecutionAdmitted(){return false;}
 get identity(){return Object.freeze({role:'main',...this.#scope});}
 isAvailable(){
  if(this.#fenced||!this.#ready)return false;
  try{if(invoke(available,this.#channel,[])===true)return true;}catch{}
  this.#fence();return false;
 }
 request(value,...extra){
  if(this.#pending&&performance.now()>=this.#pending.expires)this.#fence();
  if(!this.isAvailable())return Promise.reject(unavailable());
  if(this.#pending)return Promise.reject(Error('COMMAND_BUSY'));
  if(this.#next===Number.MAX_SAFE_INTEGER){this.#fence();return Promise.reject(unavailable());}
  let packet;
  try{
   const p=requestParts(value);if(extra.length||!p)return Promise.reject(Error('COMMAND_REFUSED'));
   const wire=encodeTerminalCommandRequest({type:'command',...this.#scope,requestId:this.#next+1,...p},this.#scope);
   packet=wire&&decodeTerminalCommandRequest(wire,this.#scope);if(!packet)return Promise.reject(Error('COMMAND_REFUSED'));
  }catch{return Promise.reject(Error('COMMAND_REFUSED'));}
  this.#next=packet.requestId;
  const metadata=Object.freeze({op:packet.op,token:packet.token,channelId:packet.channelId,sessionId:packet.sessionId,requestId:packet.requestId});
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const pending={metadata,resolve,reject,expires:performance.now()+this.#deadline,timer:null};
  this.#pending=pending;this.#slot=Object.freeze({state:'pending',metadata});
  // The timer captures only this instance, never the submitted input body.
  pending.timer=setTimeout(this.#onTimeout,this.#deadline);
  try{if(invoke(send,this.#channel,[packet])!==true)this.#fence();}catch{this.#fence();}
  if(this.#pending===pending&&performance.now()>=pending.expires)this.#fence();
  return promise;
 }
 #reply(value){
  if(this.#fenced)return;
  const pending=this.#pending,reply=validateTerminalCommandReply(value,this.#scope);
  if(!pending||!reply||performance.now()>=pending.expires){this.#fence();return;}
  const m=pending.metadata;
  if(reply.op!==m.op||reply.requestId!==m.requestId||reply.channelId!==m.channelId||reply.sessionId!==m.sessionId||TOKEN.some(key=>reply.token[key]!==m.token[key])){this.#fence();return;}
  if(reply.status==='failed'&&reply.code==='COMMAND_AMBIGUOUS'){this.#fence();return;}
  clearTimeout(pending.timer);this.#pending=null;this.#slot=null;
  if(reply.status==='failed'&&['ENDPOINT_UNAVAILABLE','COMMAND_RETIRED'].includes(reply.code))this.#fence();
  pending.resolve(reply);
 }
 #expire(){
  if(this.#fenced||!this.#pending)return;
  const remaining=this.#pending.expires-performance.now();if(remaining>0){this.#pending.timer=setTimeout(this.#onTimeout,Math.ceil(remaining));return;}
  this.#fence();
 }
 #detach(){if(this.#unsubscribe){const fn=this.#unsubscribe;this.#unsubscribe=null;try{invoke(fn,undefined,[]);}catch{}}}
 #fence(){
  if(this.#fenced)return;this.#fenced=true;this.#ready=false;
  const pending=this.#pending;this.#pending=null;
  if(pending){clearTimeout(pending.timer);this.#slot=Object.freeze({state:'unknown',metadata:pending.metadata});}
  // Publish the synchronous fence before settling promises, even if the trusted
  // notification throws or reenters disposal. Unknown slot metadata stays held.
  try{invoke(this.#notify,undefined,[]);}catch{}
  this.#detach();try{invoke(close,this.#channel,[]);}catch{}
  this.#resolveReady(false);if(pending)pending.reject(unavailable());
 }
 dispose(){this.#fence();}
 stats(){return Object.freeze({available:this.isAvailable(),fenced:this.#fenced,pendingRequests:this.#pending?1:0,unknownRequests:this.#slot?.state==='unknown'?1:0,retainedRequestSlots:this.#slot?1:0,lastRequestId:this.#next,nativeExecutionAdmitted:false});}
}
