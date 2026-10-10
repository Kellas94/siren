// Independently authenticated connected command stream. No authority dispatch,
// request tracker, native loader, shell, PTY, gate or history execution.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {Duplex,Writable} from 'node:stream';
import {types} from 'node:util';
import {COMMAND_LIMITS,encodeTerminalCommandRequest,decodeTerminalCommandRequest,validateTerminalCommandReply} from './command-protocol.mjs';

const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const writableLength=Object.getOwnPropertyDescriptor(Writable.prototype,'writableLength').get;
const bufferPrototype=Buffer.prototype;
const typedArrayByteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const typedArraySet=Uint8Array.prototype.set;
const refused=()=>TypeError('Bounded command data stream required');
function copyBinary(value,limit){
 // Buffer.isBuffer can walk a caller-controlled prototype chain. Native view
 // branding and an exact prototype check refuse it without running traps.
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 try{
  const length=Reflect.apply(typedArrayByteLength,value,[]);if(!integer(length)||length>limit)return null;
  const copy=Buffer.alloc(length);Reflect.apply(typedArraySet,copy,[value]);return copy;
 }catch{return null;}
}
function fields(value,keys,enumerable=true){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||enumerable&&!d.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function method(value,name,optional=false){
 let current=value;
 while(current){
  if(types.isProxy(current))throw refused();const d=Object.getOwnPropertyDescriptor(current,name);
  if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw refused();return d.value;}
  current=Object.getPrototypeOf(current);
 }
 if(optional)return null;throw refused();
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
  else{
   // Opaque adapters can report their reservation through a captured DATA
   // method; arbitrary writableLength accessors are never invoked here.
   const stats=method(stream,'stats');callbacks.queued=()=>{const r=Reflect.apply(stats,stream,[]);if(!r||typeof r!=='object'||types.isProxy(r))return null;const d=Object.getOwnPropertyDescriptor(r,'writableLength');return d&&Object.hasOwn(d,'value')?d.value:null;};
  }
 }
 return callbacks;
}

export class TerminalCommandChannel {
 #stream;#methods;#role;#scope;#secret;#mainNonce=null;#creatorNonce=null;#phase;
 #available=false;#closed=false;#subscriber=null;#blocked=false;
 #buffer=Buffer.alloc(COMMAND_LIMITS.maxFrameBytes+4);#used=0;#length=null;#timer;#expires;#resolveReady;
 #received=0;#sent=0;#decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 constructor(options){
  if(!options||typeof options!=='object'||types.isProxy(options))throw refused();
  const keys=Reflect.ownKeys(options);if(keys.some(key=>!['stream','role','channelId','sessionId','secret','deadlineMs'].includes(key)))throw refused();
  const r=fields(options,keys);if(!r)throw refused();const deadlineMs=r.deadlineMs===undefined?COMMAND_LIMITS.deadlineMs:r.deadlineMs;
  const secret=copyBinary(r.secret,32);
  if(!['main','creator'].includes(r.role)||!id(r.channelId)||!id(r.sessionId)||!secret||secret.length!==32||!integer(deadlineMs)||deadlineMs<1||deadlineMs>COMMAND_LIMITS.deadlineMs)throw refused();
  const methods=streamCallbacks(r.stream);if(!integer(methods.queued())||methods.queued()>COMMAND_LIMITS.maxWriteBytes)throw refused();
  this.#stream=r.stream;this.#methods=methods;this.#role=r.role;this.#scope=Object.freeze({channelId:r.channelId,sessionId:r.sessionId});this.#secret=secret;this.#phase=r.role==='main'?'proof':'challenge';
  Object.defineProperty(this,'ready',{value:new Promise(resolve=>this.#resolveReady=resolve),enumerable:true});
  this.#expires=performance.now()+deadlineMs;this.#timer=setTimeout(()=>this.dispose(),deadlineMs);
  try{
   this.#call('on',['data',bytes=>this.#receive(bytes)]);
   for(const event of ['end','close','error','timeout'])this.#call('on',[event,()=>this.dispose()]);
   this.#call('on',['drain',()=>{if(!this.#closed)this.#blocked=false;}]);
  }catch{this.dispose();throw refused();}
  if(r.role==='main')queueMicrotask(()=>{
   if(this.#closed)return;if(performance.now()>=this.#expires){this.dispose();return;}
   try{this.#mainNonce=randomBytes(32).toString('hex');this.#write({type:'challenge',version:1,...this.#scope,nonce:this.#mainNonce});}catch{this.dispose();}
  });
 }
 get nativeExecutionAdmitted(){return false;}
 get identity(){return Object.freeze({role:this.#role,...this.#scope});}
 isAvailable(){return this.#available&&!this.#closed;}
 subscribe(receiver){
  const r=fields(receiver,['message','closed'],false);
  if(this.#subscriber||!r||['message','closed'].some(key=>typeof r[key]!=='function'||types.isProxy(r[key])))throw TypeError('One disposable command data subscriber required');
  this.#subscriber=r;if(this.#closed){try{Reflect.apply(r.closed,undefined,[]);}catch{}}
  return()=>{if(this.#subscriber===r)this.#subscriber=null;};
 }
 send(value){
  if(!this.isAvailable())return false;
  const packet=this.#role==='main'?encodeTerminalCommandRequest(value,this.#scope):validateTerminalCommandReply(value,this.#scope);
  if(!packet){this.dispose();return false;}return this.#write(packet);
 }
 #call(name,args){return Reflect.apply(this.#methods[name],this.#stream,args);}
 #mac(domain){return createHmac('sha256',this.#secret).update(JSON.stringify(['siren-terminal-command',1,domain,this.#scope.channelId,this.#scope.sessionId,this.#mainNonce,this.#creatorNonce])).digest('hex');}
 #matches(proof,domain){return hex(proof)&&timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(this.#mac(domain),'hex'));}
 #write(value){
  if(this.#closed||this.#blocked){this.dispose();return false;}
  try{
   const queued=this.#methods.queued();
   // An adapter's queue report may synchronously close or fence this lane.
   if(this.#closed||this.#blocked||!integer(queued)||queued>COMMAND_LIMITS.maxWriteBytes){this.dispose();return false;}
   const body=Buffer.from(JSON.stringify(value),'utf8');if(!body.length||body.length>COMMAND_LIMITS.maxFrameBytes||queued+body.length+4>COMMAND_LIMITS.maxWriteBytes){this.dispose();return false;}
   const frame=Buffer.allocUnsafe(body.length+4);frame.writeUInt32BE(body.length);body.copy(frame,4);
   const accepted=this.#call('write',[frame]);this.#sent++;const remaining=this.#methods.queued();
   if(typeof accepted!=='boolean'||!integer(remaining)||remaining>COMMAND_LIMITS.maxWriteBytes){this.dispose();return false;}
   this.#blocked=!accepted;return !this.#closed;
  }catch{this.dispose();return false;}
 }
 #receive(bytes){
  if(this.#closed)return;if(!this.#available&&performance.now()>=this.#expires){this.dispose();return;}
  bytes=copyBinary(bytes,COMMAND_LIMITS.maxChunkBytes);if(!bytes){this.dispose();return;}
  let offset=0;
  while(offset<bytes.length&&!this.#closed){
   const target=this.#length===null?4:this.#length+4,count=Math.min(target-this.#used,bytes.length-offset);
   bytes.copy(this.#buffer,this.#used,offset,offset+count);this.#used+=count;offset+=count;
   if(this.#length===null&&this.#used===4){this.#length=this.#buffer.readUInt32BE(0);if(!this.#length||this.#length>COMMAND_LIMITS.maxFrameBytes){this.dispose();return;}}
   if(this.#length!==null&&this.#used===this.#length+4){
    let value;try{value=JSON.parse(this.#decoder.decode(this.#buffer.subarray(4,this.#used)));}catch{this.dispose();return;}
    this.#buffer.fill(0,0,this.#used);this.#used=0;this.#length=null;this.#received++;
    try{this.#packet(value);}catch{this.dispose();}
   }
  }
 }
 #packet(value){
  if(this.#available){
   const packet=this.#role==='creator'?decodeTerminalCommandRequest(value,this.#scope):validateTerminalCommandReply(value,this.#scope);
   if(!packet||!this.#subscriber){this.dispose();return;}Reflect.apply(this.#subscriber.message,undefined,[packet]);return;
  }
  if(this.#phase==='challenge'){
   const p=fields(value,['type','version','channelId','sessionId','nonce']);
   if(!this.#handshake(p,'challenge')||!hex(p.nonce)){this.dispose();return;}
   this.#mainNonce=p.nonce;this.#creatorNonce=randomBytes(32).toString('hex');this.#phase='accept';
   this.#write({type:'proof',version:1,...this.#scope,nonce:this.#creatorNonce,proof:this.#mac('creator-proof')});return;
  }
  if(this.#phase==='proof'){
   const p=fields(value,['type','version','channelId','sessionId','nonce','proof']);
   if(!this.#handshake(p,'proof')||!hex(p.nonce)){this.dispose();return;}this.#creatorNonce=p.nonce;
   if(!this.#matches(p.proof,'creator-proof')){this.dispose();return;}this.#phase='ready';this.#write({type:'accept',version:1,...this.#scope,proof:this.#mac('main-accept')});return;
  }
  const p=fields(value,['type','version','channelId','sessionId','proof']),accepting=this.#phase==='accept';
  if(!this.#handshake(p,accepting?'accept':'ready')||!this.#matches(p.proof,accepting?'main-accept':'creator-ready')){this.dispose();return;}
  if(accepting&&!this.#write({type:'ready',version:1,...this.#scope,proof:this.#mac('creator-ready')}))return;
  this.#activate();
 }
 #handshake(p,type){return p&&p.type===type&&p.version===1&&p.channelId===this.#scope.channelId&&p.sessionId===this.#scope.sessionId;}
 #activate(){if(this.#closed)return;if(performance.now()>=this.#expires){this.dispose();return;}this.#available=true;this.#phase='complete';clearTimeout(this.#timer);this.#wipe();this.#resolveReady(true);}
 #wipe(){this.#secret.fill(0);this.#mainNonce=null;this.#creatorNonce=null;}
 dispose(){
  if(this.#closed)return;this.#closed=true;this.#available=false;this.#phase='closed';clearTimeout(this.#timer);this.#wipe();this.#buffer.fill(0);this.#used=0;this.#length=null;
  // Fence the subscriber synchronously before failed readiness or stream EOF.
  try{if(this.#subscriber)Reflect.apply(this.#subscriber.closed,undefined,[]);}catch{}
  this.#resolveReady(false);try{this.#call('destroy',[]);}catch{}
 }
 stats(){return Object.freeze({available:this.isAvailable(),closed:this.#closed,backpressured:this.#blocked,bufferedBytes:this.#used,receiveCapacity:this.#buffer.length,maxFrameBytes:COMMAND_LIMITS.maxFrameBytes,maxWriteBytes:COMMAND_LIMITS.maxWriteBytes,receivedFrames:this.#received,sentFrames:this.#sent});}
}
