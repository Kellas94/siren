// A single lifetime connected lane carries authenticated startup and then fixed
// commands. This class assembles no startup, invokes no provider and grants no
// native execution authority. The composer owns startup order and its deadline.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {Duplex,Writable} from 'node:stream';
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {COMMAND_LIMITS,encodeTerminalCommandRequest,decodeTerminalCommandRequest,validateTerminalCommandReply} from './command-protocol.mjs';
import {encodeStartupRequest,decodeStartupRequest,encodeStartupReply,validateStartupReply} from './startup-protocol.mjs';

const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const writableLength=Object.getOwnPropertyDescriptor(Writable.prototype,'writableLength').get;
const bufferPrototype=Buffer.prototype;
const typedArrayByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const typedArraySet=Uint8Array.prototype.set,typedArrayFill=Uint8Array.prototype.fill;
const refused=()=>TypeError('Bounded session command data stream required');
function copyBinary(value,limit){
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 try{const length=Reflect.apply(typedArrayByteLength,value,[]);if(!integer(length)||length>limit)return null;const copy=Buffer.alloc(length);Reflect.apply(typedArraySet,copy,[value]);return copy;}catch{return null;}
}
function wipe(value){Reflect.apply(typedArrayFill,value,[0]);}
function fields(value,keys,enumerable=true){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||enumerable&&!d.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function method(value,name){
 let current=value;while(current){if(types.isProxy(current))throw refused();const d=Object.getOwnPropertyDescriptor(current,name);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw refused();return d.value;}current=Object.getPrototypeOf(current);}throw refused();
}
function streamCallbacks(stream){
 if(!stream||typeof stream!=='object'||types.isProxy(stream))throw refused();
 const callbacks={};for(const name of ['on','write','destroy'])callbacks[name]=method(stream,name);
 let current=stream,duplex=false;while(current){if(types.isProxy(current))throw refused();if(current===Duplex.prototype)duplex=true;current=Object.getPrototypeOf(current);}
 if(duplex){
  const state=Object.getOwnPropertyDescriptor(stream,'_writableState');if(!state||!Object.hasOwn(state,'value')||types.isProxy(state.value))throw refused();
  callbacks.queued=()=>Reflect.apply(writableLength,stream,[]);
 }else{
  const length=Object.getOwnPropertyDescriptor(stream,'writableLength');
  if(length&&Object.hasOwn(length,'value'))callbacks.queued=()=>{const d=Object.getOwnPropertyDescriptor(stream,'writableLength');return d&&Object.hasOwn(d,'value')?d.value:null;};
  else{const stats=method(stream,'stats');callbacks.queued=()=>{const r=Reflect.apply(stats,stream,[]);if(!r||typeof r!=='object'||types.isProxy(r))return null;const d=Object.getOwnPropertyDescriptor(r,'writableLength');return d&&Object.hasOwn(d,'value')?d.value:null;};}
 }
 return callbacks;
}

export class TerminalSessionCommandChannel {
 #stream;#methods;#role;#scope;#secret;#mainNonce=null;#creatorNonce=null;#authPhase;#phase='startup';
 #available=false;#closed=false;#subscriber=null;#subscribed=false;#blocked=false;#begin=null;#pending=null;
 #transition=null;#staged=[];#stagedBytes=0;
 #buffer=Buffer.alloc(COMMAND_LIMITS.maxFrameBytes+4);#used=0;#length=null;#timer;#expires;#resolveAuthenticated;#resolveReady;
 #received=0;#sent=0;#decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 constructor(options){
  if(!options||typeof options!=='object'||types.isProxy(options))throw refused();
  const keys=Reflect.ownKeys(options);if(keys.some(key=>!['stream','role','channelId','sessionId','secret','deadlineMs'].includes(key)))throw refused();
  const r=fields(options,keys);if(!r)throw refused();const deadlineMs=r.deadlineMs===undefined?COMMAND_LIMITS.deadlineMs:r.deadlineMs,secret=copyBinary(r.secret,32);
  if(!['main','creator'].includes(r.role)||!id(r.channelId)||!id(r.sessionId)||!secret||secret.length!==32||!integer(deadlineMs)||deadlineMs<1||deadlineMs>COMMAND_LIMITS.deadlineMs){if(secret)wipe(secret);throw refused();}
  let methods;try{methods=streamCallbacks(r.stream);const queued=methods.queued();if(!integer(queued)||queued>COMMAND_LIMITS.maxWriteBytes)throw refused();}catch{wipe(secret);throw refused();}
  this.#stream=r.stream;this.#methods=methods;this.#role=r.role;this.#scope=Object.freeze({channelId:r.channelId,sessionId:r.sessionId});this.#secret=secret;this.#authPhase=r.role==='main'?'proof':'challenge';
  Object.defineProperties(this,{authenticated:{value:new Promise(resolve=>this.#resolveAuthenticated=resolve),enumerable:true},ready:{value:new Promise(resolve=>this.#resolveReady=resolve),enumerable:true}});
  this.#expires=performance.now()+deadlineMs;this.#timer=setTimeout(()=>this.#close(),deadlineMs);
  try{
   this.#call('on',['data',bytes=>this.#receive(bytes)]);
   for(const event of ['end','close','error','timeout'])this.#call('on',[event,()=>this.#close()]);
   this.#call('on',['drain',()=>{if(!this.#closed)this.#blocked=false;}]);
  }catch{this.#close();throw refused();}
  if(r.role==='main')queueMicrotask(()=>{
   if(this.#closed)return;if(!this.#subscriber||performance.now()>=this.#expires){this.#close();return;}
   try{this.#mainNonce=randomBytes(32).toString('hex');this.#write({type:'challenge',version:1,...this.#scope,nonce:this.#mainNonce});}catch{this.#close();}
  });
 }
 get nativeExecutionAdmitted(){return false;}
 get identity(){return Object.freeze({role:this.#role,...this.#scope});}
 get phase(){return this.#phase;}
 isAvailable(){return this.#isAvailable();}
 #isAvailable(){return this.#available&&!this.#closed;}
 subscribe(receiver){
  const r=fields(receiver,['message','closed'],false);
  if(this.#closed||this.#subscribed||!r||['message','closed'].some(key=>typeof r[key]!=='function'||types.isProxy(r[key])))throw TypeError('One lifetime session command data subscriber required');
  this.#subscriber=r;this.#subscribed=true;return()=>this.#close();
 }
 send(value){
  if(!this.#isAvailable())return false;
  if(this.#phase==='commands'){
   if(this.#transition==='writing'){this.#close();return false;}
   const packet=this.#role==='main'?encodeTerminalCommandRequest(value,this.#scope):validateTerminalCommandReply(value,this.#scope);
   if(!packet){this.#close();return false;}return this.#write(packet);
  }
  if(this.#role==='main'){
   if(this.#pending){this.#close();return false;}
   const type=this.#type(value),binding=type==='startup-begin'?this.#scope:this.#begin;
   if(type==='startup-begin'&&this.#begin||!binding){this.#close();return false;}
   const packet=encodeStartupRequest(value,binding);if(!packet){this.#close();return false;}
   if(type==='startup-begin')this.#begin=packet;
   // Reserve before write: a finite connected stream may reply synchronously.
   this.#pending=packet;return this.#write(packet);
  }
  if(!this.#pending){this.#close();return false;}
  const packet=encodeStartupReply(value,this.#pending);if(!packet){this.#close();return false;}
  this.#pending=null;
  const ready=packet.type==='startup-ready';
  // The phase changes after preflight, immediately before actual publication.
  if(!this.#write(packet,ready))return false;
  if(ready){
   this.#resolveReady(true);this.#transition='draining';
   while(this.#staged.length&&!this.#closed){const next=this.#staged.shift();this.#stagedBytes-=next.bytes;this.#deliver(next.packet);}
   this.#transition=null;
  }
  return !this.#closed;
 }
 #type(value){if(!value||typeof value!=='object'||types.isProxy(value))return null;const d=Object.getOwnPropertyDescriptor(value,'type');return d&&Object.hasOwn(d,'value')?d.value:null;}
 #call(name,args){return Reflect.apply(this.#methods[name],this.#stream,args);}
 #mac(domain){return createHmac('sha256',this.#secret).update(JSON.stringify(['siren-terminal-session-command',1,domain,this.#scope.channelId,this.#scope.sessionId,this.#mainNonce,this.#creatorNonce])).digest('hex');}
 #matches(proof,domain){return hex(proof)&&timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(this.#mac(domain),'hex'));}
 #write(value,activateCommands=false){
  if(this.#closed||this.#blocked){this.#close();return false;}
  try{
   const queued=this.#methods.queued();
   if(this.#closed||this.#blocked||!integer(queued)||queued>COMMAND_LIMITS.maxWriteBytes){this.#close();return false;}
   const body=Buffer.from(JSON.stringify(value),'utf8');if(!body.length||body.length>COMMAND_LIMITS.maxFrameBytes||queued+body.length+4>COMMAND_LIMITS.maxWriteBytes){this.#close();return false;}
   const frame=Buffer.allocUnsafe(body.length+4);frame.writeUInt32BE(body.length);body.copy(frame,4);
   // External queue callbacks cannot admit a command before this ready write.
   // The captured write may synchronously deliver the peer's first command.
   if(activateCommands){this.#phase='commands';this.#transition='writing';}
   const accepted=this.#call('write',[frame]);this.#sent++;const remaining=this.#methods.queued();
   if(this.#closed||typeof accepted!=='boolean'||!integer(remaining)||remaining>COMMAND_LIMITS.maxWriteBytes){this.#close();return false;}
   // Never clear backpressure established by a nested synchronous write.
   if(!accepted)this.#blocked=true;return true;
  }catch{this.#close();return false;}
 }
 #receive(value){
  if(this.#closed)return;if(!this.#available&&performance.now()>=this.#expires){this.#close();return;}
  const bytes=copyBinary(value,COMMAND_LIMITS.maxChunkBytes);if(!bytes){this.#close();return;}
  try{
   let offset=0;while(offset<bytes.length&&!this.#closed){
    const target=this.#length===null?4:this.#length+4,count=Math.min(target-this.#used,bytes.length-offset);
    bytes.copy(this.#buffer,this.#used,offset,offset+count);this.#used+=count;offset+=count;
    if(this.#length===null&&this.#used===4){this.#length=this.#buffer.readUInt32BE(0);if(!this.#length||this.#length>COMMAND_LIMITS.maxFrameBytes){this.#close();return;}}
    if(this.#length!==null&&this.#used===this.#length+4){
     const frameBytes=this.#used;let packet;try{packet=JSON.parse(this.#decoder.decode(this.#buffer.subarray(4,this.#used)));}catch{this.#close();return;}
     this.#buffer.fill(0,0,this.#used);this.#used=0;this.#length=null;this.#received++;
     try{this.#packet(packet,frameBytes);}catch{this.#close();}
    }
   }
  }finally{wipe(bytes);}
 }
 #deliver(packet){
  if(!this.#subscriber){if(packet.type==='startup-chunk')wipe(packet.data);this.#close();return;}
  try{Reflect.apply(this.#subscriber.message,undefined,[packet]);}catch{if(packet.type==='startup-chunk')wipe(packet.data);this.#close();}
 }
 #packet(value,frameBytes){
  if(this.#available){
   if(this.#phase==='commands'){
    const packet=this.#role==='creator'?decodeTerminalCommandRequest(value,this.#scope):validateTerminalCommandReply(value,this.#scope);
    if(!packet){this.#close();return;}
    if(this.#transition){
     // A write callback may deliver a command and then fail. Retain bounded
     // decoded DATA until the ready write and its queue validation succeed.
     if(this.#stagedBytes+frameBytes>COMMAND_LIMITS.maxWriteBytes){this.#close();return;}
     this.#staged.push({packet,bytes:frameBytes});this.#stagedBytes+=frameBytes;return;
    }
    this.#deliver(packet);return;
   }
   if(this.#role==='creator'){
    if(this.#pending){this.#close();return;}
    const type=this.#type(value),binding=type==='startup-begin'?this.#scope:this.#begin;
    if(type==='startup-begin'&&this.#begin||!binding){this.#close();return;}
    const packet=decodeStartupRequest(value,binding);if(!packet){this.#close();return;}
    const wire=encodeStartupRequest(packet,binding);if(!wire){if(packet.data)wipe(packet.data);this.#close();return;}
    if(type==='startup-begin')this.#begin=wire;
    this.#pending=wire;this.#deliver(packet);return;
   }
   const packet=this.#pending&&validateStartupReply(value,this.#pending);if(!packet){this.#close();return;}
   this.#pending=null;
   if(packet.type==='startup-ready'){this.#phase='commands';this.#resolveReady(true);}
   this.#deliver(packet);return;
  }
  if(!this.#subscriber){this.#close();return;}
  if(this.#authPhase==='challenge'){
   const p=fields(value,['type','version','channelId','sessionId','nonce']);if(!this.#handshake(p,'challenge')||!hex(p.nonce)){this.#close();return;}
   this.#mainNonce=p.nonce;this.#creatorNonce=randomBytes(32).toString('hex');this.#authPhase='accept';
   this.#write({type:'proof',version:1,...this.#scope,nonce:this.#creatorNonce,proof:this.#mac('creator-proof')});return;
  }
  if(this.#authPhase==='proof'){
   const p=fields(value,['type','version','channelId','sessionId','nonce','proof']);if(!this.#handshake(p,'proof')||!hex(p.nonce)){this.#close();return;}
   this.#creatorNonce=p.nonce;if(!this.#matches(p.proof,'creator-proof')){this.#close();return;}
   this.#authPhase='ready';this.#write({type:'accept',version:1,...this.#scope,proof:this.#mac('main-accept')});return;
  }
  const p=fields(value,['type','version','channelId','sessionId','proof']),accepting=this.#authPhase==='accept';
  if(!this.#handshake(p,accepting?'accept':'ready')||!this.#matches(p.proof,accepting?'main-accept':'creator-ready')){this.#close();return;}
  if(accepting&&!this.#write({type:'ready',version:1,...this.#scope,proof:this.#mac('creator-ready')}))return;
  this.#activate();
 }
 #handshake(p,type){return p&&p.type===type&&p.version===1&&p.channelId===this.#scope.channelId&&p.sessionId===this.#scope.sessionId;}
 #activate(){if(this.#closed)return;if(!this.#subscriber||performance.now()>=this.#expires){this.#close();return;}this.#available=true;this.#authPhase='complete';clearTimeout(this.#timer);this.#wipe();this.#resolveAuthenticated(true);}
 #wipe(){wipe(this.#secret);this.#mainNonce=null;this.#creatorNonce=null;}
 dispose(){this.#close();}
 #close(){
  if(this.#closed)return;this.#closed=true;this.#available=false;this.#phase='closed';clearTimeout(this.#timer);this.#wipe();this.#buffer.fill(0);this.#used=0;this.#length=null;this.#pending=null;this.#begin=null;this.#transition=null;this.#staged.length=0;this.#stagedBytes=0;
  // This fence is synchronous. It is no native/process settlement receipt.
  try{if(this.#subscriber)Reflect.apply(this.#subscriber.closed,undefined,[]);}catch{}
  this.#resolveAuthenticated(false);this.#resolveReady(false);try{this.#call('destroy',[]);}catch{}
 }
 stats(){return Object.freeze({available:this.#isAvailable(),closed:this.#closed,phase:this.#phase,backpressured:this.#blocked,bufferedBytes:this.#used,receiveCapacity:this.#buffer.length,maxFrameBytes:COMMAND_LIMITS.maxFrameBytes,maxWriteBytes:COMMAND_LIMITS.maxWriteBytes,receivedFrames:this.#received,sentFrames:this.#sent,pendingStartupRequests:this.#pending?1:0,stagedCommandFrames:this.#staged.length,stagedCommandBytes:this.#stagedBytes,nativeExecutionAdmitted:false});}
}

// A decoded startup chunk's independent Buffer transfers to the lifetime
// subscriber. Its owner must account for and wipe it after use/retirement.
// Undelivered or throwing delivery is wiped here; immutable JSON strings cannot
// be securely erased. Reported shell metadata remains unverified.
