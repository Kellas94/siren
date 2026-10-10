// Additive pure production candidate; source-only, not native admission.
// Dedicated connected-stream control transport; no listener, filesystem,
// native loader, shell, PTY, output lane or process-identity admission.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
import {Duplex} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {TERMINAL_LIMITS} from './contracts.mjs';

const MAX_CHUNK=65536;
const MAX_FRAME=1024,MAX_WRITE=2048;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);

const bufferPrototype=Buffer.prototype;
const typedLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const typedSet=Uint8Array.prototype.set,typedFill=Uint8Array.prototype.fill;
const NativePromise=Promise;
const refused=()=>TypeError('Bounded production lane DATA dependencies required');
const callable=value=>typeof value==='function'&&!types.isProxy(value);
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
function options(value,allowed){
 if(!value||typeof value!=='object'||types.isProxy(value))throw refused();const keys=Reflect.ownKeys(value);
 if(keys.some(key=>!allowed.includes(key)))throw refused();const result=fields(value,keys);if(!result)throw refused();return result;
}
function method(value,name){
 if(!value||typeof value!=='object'||types.isProxy(value))throw refused();
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw refused();const d=Object.getOwnPropertyDescriptor(p,name);if(d){if(!Object.hasOwn(d,'value')||!callable(d.value))throw refused();return d.value;}}throw refused();
}
function copyBinary(value,limit){
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 try{const length=Reflect.apply(typedLength,value,[]);if(!integer(length)||length>limit)return null;const copy=Buffer.alloc(length);Reflect.apply(typedSet,copy,[value]);return copy;}catch{return null;}
}
const wipe=bytes=>Reflect.apply(typedFill,bytes,[0]);
function streamCallbacks(stream){
 const callbacks={};for(const key of ['on','write','destroy'])callbacks[key]=method(stream,key);
 let duplex=false;for(let p=stream;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw refused();if(p===Duplex.prototype)duplex=true;}
 if(duplex){
  const d=Object.getOwnPropertyDescriptor(stream,'_writableState');if(!d||!Object.hasOwn(d,'value')||!d.value||types.isProxy(d.value))throw refused();const state=d.value;
  callbacks.queued=()=>{const current=Object.getOwnPropertyDescriptor(stream,'_writableState'),length=Object.getOwnPropertyDescriptor(state,'length');return current&&Object.hasOwn(current,'value')&&current.value===state&&length&&Object.hasOwn(length,'value')?length.value:null;};
 }else{
  const length=Object.getOwnPropertyDescriptor(stream,'writableLength');
  if(length&&Object.hasOwn(length,'value'))callbacks.queued=()=>{const d=Object.getOwnPropertyDescriptor(stream,'writableLength');return d&&Object.hasOwn(d,'value')?d.value:null;};
  else{const stats=method(stream,'stats');callbacks.queued=()=>{const value=Reflect.apply(stats,stream,[]);if(!value||typeof value!=='object'||types.isProxy(value))return null;const d=Object.getOwnPropertyDescriptor(value,'writableLength');return d&&Object.hasOwn(d,'value')?d.value:null;};}
 }
 return callbacks;
}
function gatePacket(value,channel,reply){
 const r=fields(value,['channelId','requestId','generation','open',...(reply?['ok']:[])]);
 return r&&r.channelId===channel&&integer(r.requestId)&&r.requestId>0&&integer(r.generation)&&typeof r.open==='boolean'&&(!reply||typeof r.ok==='boolean')?Object.freeze(r):null;
}

export class ProductionControlChannel {
 #methods;#subscribed=false;#writeDepth=0;#reservedWrite=0;#checkingQueue=false;#receiveDepth=0;
 #stream;#role;#channel;#secret;#mainNonce=null;#creatorNonce=null;#phase;
 #available=false;#closed=false;#subscriber=null;#blocked=false;
 #buffer=Buffer.alloc(MAX_FRAME+4);#used=0;#length=null;#timer;#expires;#resolveReady;
 #received=0;#sent=0;#decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 constructor(value,...extra){
  if(extra.length)throw refused();const r=options(value,['stream','role','channelId','secret','deadlineMs']);
  const deadlineMs=r.deadlineMs===undefined?TERMINAL_LIMITS.stopDeadlineMs:r.deadlineMs,secret=copyBinary(r.secret,32);
  if(!['main','creator'].includes(r.role)||!id(r.channelId)||!secret||secret.length!==32||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs){if(secret)wipe(secret);throw refused();}
  let methods;try{methods=streamCallbacks(r.stream);const queued=methods.queued();if(!integer(queued)||queued>MAX_WRITE)throw refused();}catch{wipe(secret);throw refused();}
  this.#methods=methods;this.#stream=r.stream;this.#role=r.role;this.#channel=r.channelId;this.#secret=secret;this.#phase=r.role==='main'?'proof':'challenge';
  const ready=new NativePromise(resolve=>this.#resolveReady=resolve);Object.defineProperty(this,'ready',{value:ready,enumerable:true});
  
  this.#expires=performance.now()+deadlineMs;this.#timer=setTimeout(()=>this.#close(),deadlineMs);
  try{
   this.#call('on',['data',bytes=>this.#receive(bytes)]);
   for(const event of ['end','close','error','timeout']){if(this.#closed)break;this.#call('on',[event,()=>this.#close()]);}
   if(!this.#closed)this.#call('on',['drain',()=>{if(!this.#closed)this.#blocked=false;}]);
  }catch{this.#close();throw refused();}
  if(r.role==='main')queueMicrotask(()=>{if(this.#closed)return;if(performance.now()>=this.#expires){this.#close();return;}try{this.#mainNonce=randomBytes(32).toString('hex');this.#write({type:'challenge',version:1,channelId:this.#channel,nonce:this.#mainNonce});}catch{this.#close();}});
 }
 #call(name,args){return Reflect.apply(this.#methods[name],this.#stream,args);}
 get nativeExecutionAdmitted(){return false;}
 isAvailable(){return this.#isAvailable();}
 #isAvailable(){return this.#available&&!this.#closed;}
 subscribe(receiver){return this.#subscribe(receiver);}
 #subscribe(receiver){
  const r=fields(receiver,['message','closed']);if(this.#subscribed||!r||!callable(r.message)||!callable(r.closed))throw refused();
  this.#subscribed=true;this.#subscriber=Object.freeze(r);if(this.#closed){try{Reflect.apply(r.closed,undefined,[]);}catch{}}
  return()=>this.#close();
 }
 send(value){return this.#send(value);}
 #send(value){
  if(!this.#isAvailable())return false;const packet=gatePacket(value,this.#channel,this.#role==='creator');
  if(!packet){this.#close();return false;}return this.#write(packet);
 }
 #mac(domain){
  return createHmac('sha256',this.#secret).update(JSON.stringify(['siren-terminal-control',1,domain,this.#channel,this.#mainNonce,this.#creatorNonce])).digest('hex');
 }
 #matches(proof,domain){return hex(proof)&&timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(this.#mac(domain),'hex'));}

 #write(value){
  if(this.#closed||this.#blocked||this.#checkingQueue||this.#writeDepth>=2){this.#close();return false;}
  this.#writeDepth++;
  try{
   this.#checkingQueue=true;let queued;try{queued=this.#methods.queued();}finally{this.#checkingQueue=false;}
   if(this.#closed||this.#blocked||!integer(queued)||queued>MAX_WRITE){this.#close();return false;}
   const body=Buffer.from(JSON.stringify(value),'utf8');if(!body.length||body.length>MAX_FRAME||queued+body.length+4+this.#reservedWrite>MAX_WRITE){this.#close();return false;}
   const frame=Buffer.allocUnsafe(body.length+4);frame.writeUInt32BE(body.length);body.copy(frame,4);
   this.#reservedWrite+=frame.length;let accepted;
   try{accepted=this.#call('write',[frame]);}finally{this.#reservedWrite-=frame.length;}
   this.#sent++;
   if(this.#closed)return false;
   this.#checkingQueue=true;let remaining;try{remaining=this.#methods.queued();}finally{this.#checkingQueue=false;}
   if(this.#closed||typeof accepted!=='boolean'||!integer(remaining)||remaining>MAX_WRITE){this.#close();return false;}
   this.#blocked=!accepted;return !this.#closed;
  }catch{this.#close();return false;}finally{this.#writeDepth--;}
 }
 #receive(value){
  if(this.#closed)return;if(!this.#available&&performance.now()>=this.#expires){this.#close();return;}
  if(this.#receiveDepth>=2){this.#close();return;}
  const bytes=copyBinary(value,MAX_CHUNK);if(!bytes){this.#close();return;}
  this.#receiveDepth++;
  try{
   let offset=0;while(offset<bytes.length&&!this.#closed){
    const target=this.#length===null?4:this.#length+4,count=Math.min(target-this.#used,bytes.length-offset);
    bytes.copy(this.#buffer,this.#used,offset,offset+count);this.#used+=count;offset+=count;
    if(this.#length===null&&this.#used===4){this.#length=this.#buffer.readUInt32BE(0);if(!this.#length||this.#length>MAX_FRAME){this.#close();return;}}
    if(this.#length!==null&&this.#used===this.#length+4){
     let packet;try{packet=JSON.parse(this.#decoder.decode(this.#buffer.subarray(4,this.#used)));}catch{this.#close();return;}
     this.#buffer.fill(0,0,this.#used);this.#used=0;this.#length=null;this.#received++;
     try{this.#packet(packet);}catch{this.#close();}
    }
   }
  }finally{wipe(bytes);this.#receiveDepth--;}
 }
 #packet(value){
  if(this.#available){
   const packet=gatePacket(value,this.#channel,this.#role==='main');
   if(!packet||!this.#subscriber){this.#close();return;}
   Reflect.apply(this.#subscriber.message,undefined,[packet]);return;
  }
  if(this.#phase==='challenge'){
   const p=fields(value,['type','version','channelId','nonce']);
   if(!p||p.type!=='challenge'||p.version!==1||p.channelId!==this.#channel||!hex(p.nonce)){this.#close();return;}
   this.#mainNonce=p.nonce;this.#creatorNonce=randomBytes(32).toString('hex');this.#phase='accept';
   this.#write({type:'proof',version:1,channelId:this.#channel,nonce:this.#creatorNonce,proof:this.#mac('creator-proof')});return;
  }
  if(this.#phase==='proof'){
   const p=fields(value,['type','version','channelId','nonce','proof']);
   if(!p||p.type!=='proof'||p.version!==1||p.channelId!==this.#channel||!hex(p.nonce)){this.#close();return;}
   this.#creatorNonce=p.nonce;
   if(!this.#matches(p.proof,'creator-proof')){this.#close();return;}
   this.#phase='ready';this.#write({type:'accept',version:1,channelId:this.#channel,proof:this.#mac('main-accept')});return;
  }
  const p=fields(value,['type','version','channelId','proof']);
  const accepting=this.#phase==='accept';
  if(!p||p.type!==(accepting?'accept':'ready')||p.version!==1||p.channelId!==this.#channel||!this.#matches(p.proof,accepting?'main-accept':'creator-ready')){this.#close();return;}
  if(accepting&&!this.#write({type:'ready',version:1,channelId:this.#channel,proof:this.#mac('creator-ready')}))return;
  this.#activate();
 }
 #activate(){
  if(this.#closed)return;if(performance.now()>=this.#expires){this.#close();return;}
  this.#available=true;this.#phase='complete';clearTimeout(this.#timer);this.#wipe();this.#resolveReady(true);
 }
 #wipe(){wipe(this.#secret);this.#mainNonce=null;this.#creatorNonce=null;}
 dispose(){this.#close();}
 #close(){
  if(this.#closed)return;this.#closed=true;this.#available=false;this.#phase='closed';clearTimeout(this.#timer);this.#wipe();this.#buffer.fill(0);this.#used=0;this.#length=null;
  // Notify GateLink/fence before publishing async failed readiness or EOF.
  try{this.#subscriber&&Reflect.apply(this.#subscriber.closed,undefined,[]);}catch{}
  this.#resolveReady(false);try{this.#call('destroy',[]);}catch{}
 }
 stats(){return Object.freeze({available:this.#isAvailable(),closed:this.#closed,backpressured:this.#blocked,bufferedBytes:this.#used,receiveCapacity:this.#buffer.length,maxFrameBytes:MAX_FRAME,maxWriteBytes:MAX_WRITE,receivedFrames:this.#received,sentFrames:this.#sent});}
}
