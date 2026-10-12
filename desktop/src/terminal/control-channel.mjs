// Dedicated connected-stream control transport; no listener, filesystem,
// native loader, shell, PTY, output lane or process-identity admission.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {TERMINAL_LIMITS} from './contracts.mjs';

const MAX_FRAME=1024,MAX_WRITE=2048;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function fields(value,keys){
 try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
  const result=Object.create(null);
  for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[k]=d.value;}
  return result;
 }catch{return null;}
}
function gatePacket(value,channel,reply){
 const r=fields(value,['channelId','requestId','generation','open',...(reply?['ok']:[])]);
 return r&&r.channelId===channel&&integer(r.requestId)&&r.requestId>0&&integer(r.generation)&&typeof r.open==='boolean'&&(!reply||typeof r.ok==='boolean')?Object.freeze(r):null;
}

export class TerminalControlChannel {
 #stream;#role;#channel;#secret;#mainNonce=null;#creatorNonce=null;#phase;
 #available=false;#closed=false;#subscriber=null;#blocked=false;
 #buffer=Buffer.alloc(MAX_FRAME+4);#used=0;#length=null;#timer;#expires;#resolveReady;
 #received=0;#sent=0;#decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 constructor({stream,role,channelId,secret,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
  if(!['main','creator'].includes(role)||!id(channelId)||!Buffer.isBuffer(secret)||secret.length!==32||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs||!stream||!['on','write','destroy'].every(k=>typeof stream[k]==='function'))throw TypeError('Connected bounded control stream and bootstrap secret required');
  this.#stream=stream;this.#role=role;this.#channel=channelId;this.#secret=Buffer.from(secret);this.#phase=role==='main'?'proof':'challenge';
  this.ready=new Promise(resolve=>this.#resolveReady=resolve);
  this.#expires=performance.now()+deadlineMs;this.#timer=setTimeout(()=>this.dispose(),deadlineMs);
  stream.on('data',bytes=>this.#receive(bytes));
  // Node's configured timeout only emits a notification; it does not close
  // the socket. No default idle timeout is installed by this endpoint.
  for(const event of ['end','close','error','timeout'])stream.on(event,()=>this.dispose());
  stream.on('drain',()=>{this.#blocked=false;});
  // Both endpoints can install their receive handlers before any bytes leave.
  if(role==='main')queueMicrotask(()=>{
   if(this.#closed)return;if(performance.now()>=this.#expires){this.dispose();return;}
   try{this.#mainNonce=randomBytes(32).toString('hex');this.#write({type:'challenge',version:1,channelId:this.#channel,nonce:this.#mainNonce});}catch{this.dispose();}
  });
 }
 get nativeExecutionAdmitted(){return false;}
 isAvailable(){return this.#available&&!this.#closed;}
 subscribe(receiver){
  const r=fields(receiver,['message','closed']);
  if(this.#subscriber||!r||typeof r.message!=='function'||typeof r.closed!=='function')throw TypeError('One disposable control subscriber required');
  this.#subscriber=r;if(this.#closed){try{r.closed();}catch{}}
  return ()=>{if(this.#subscriber===r)this.#subscriber=null;};
 }
 send(value){
  if(!this.isAvailable())return false;
  const packet=gatePacket(value,this.#channel,this.#role==='creator');
  if(!packet){this.dispose();return false;}
  return this.#write(packet);
 }
 #mac(domain){
  return createHmac('sha256',this.#secret).update(JSON.stringify(['siren-terminal-control',1,domain,this.#channel,this.#mainNonce,this.#creatorNonce])).digest('hex');
 }
 #matches(proof,domain){return hex(proof)&&timingSafeEqual(Buffer.from(proof,'hex'),Buffer.from(this.#mac(domain),'hex'));}
 #write(value){
  if(this.#closed||this.#blocked){this.dispose();return false;}
  try{
   const queued=this.#stream.writableLength;
   if(!integer(queued)||queued>MAX_WRITE){this.dispose();return false;}
   const body=Buffer.from(JSON.stringify(value),'utf8');if(!body.length||body.length>MAX_FRAME||queued+body.length+4>MAX_WRITE){this.dispose();return false;}
   const frame=Buffer.allocUnsafe(body.length+4);frame.writeUInt32BE(body.length);body.copy(frame,4);
   const accepted=this.#stream.write(frame);this.#sent++;
   if(typeof accepted!=='boolean'||!integer(this.#stream.writableLength)||this.#stream.writableLength>MAX_WRITE){this.dispose();return false;}
   this.#blocked=!accepted;return !this.#closed;
  }catch{this.dispose();return false;}
 }
 #receive(bytes){
  if(this.#closed)return;
  if(!this.#available&&performance.now()>=this.#expires){this.dispose();return;}
  if(!Buffer.isBuffer(bytes)||bytes.length>64*1024){this.dispose();return;}
  let offset=0;
  while(offset<bytes.length&&!this.#closed){
   const target=this.#length===null?4:this.#length+4;
   const count=Math.min(target-this.#used,bytes.length-offset);bytes.copy(this.#buffer,this.#used,offset,offset+count);this.#used+=count;offset+=count;
   if(this.#length===null&&this.#used===4){
    this.#length=this.#buffer.readUInt32BE(0);if(this.#length===0||this.#length>MAX_FRAME){this.dispose();return;}
   }
   if(this.#length!==null&&this.#used===this.#length+4){
    let value;try{value=JSON.parse(this.#decoder.decode(this.#buffer.subarray(4,this.#used)));}catch{this.dispose();return;}
    this.#used=0;this.#length=null;this.#received++;
    try{this.#packet(value);}catch{this.dispose();}
   }
  }
 }
 #packet(value){
  if(this.#available){
   const packet=gatePacket(value,this.#channel,this.#role==='main');
   if(!packet||!this.#subscriber){this.dispose();return;}
   this.#subscriber.message(packet);return;
  }
  if(this.#phase==='challenge'){
   const p=fields(value,['type','version','channelId','nonce']);
   if(!p||p.type!=='challenge'||p.version!==1||p.channelId!==this.#channel||!hex(p.nonce)){this.dispose();return;}
   this.#mainNonce=p.nonce;this.#creatorNonce=randomBytes(32).toString('hex');this.#phase='accept';
   this.#write({type:'proof',version:1,channelId:this.#channel,nonce:this.#creatorNonce,proof:this.#mac('creator-proof')});return;
  }
  if(this.#phase==='proof'){
   const p=fields(value,['type','version','channelId','nonce','proof']);
   if(!p||p.type!=='proof'||p.version!==1||p.channelId!==this.#channel||!hex(p.nonce)){this.dispose();return;}
   this.#creatorNonce=p.nonce;
   if(!this.#matches(p.proof,'creator-proof')){this.dispose();return;}
   this.#phase='ready';this.#write({type:'accept',version:1,channelId:this.#channel,proof:this.#mac('main-accept')});return;
  }
  const p=fields(value,['type','version','channelId','proof']);
  const accepting=this.#phase==='accept';
  if(!p||p.type!==(accepting?'accept':'ready')||p.version!==1||p.channelId!==this.#channel||!this.#matches(p.proof,accepting?'main-accept':'creator-ready')){this.dispose();return;}
  if(accepting&&!this.#write({type:'ready',version:1,channelId:this.#channel,proof:this.#mac('creator-ready')}))return;
  this.#activate();
 }
 #activate(){
  if(this.#closed)return;if(performance.now()>=this.#expires){this.dispose();return;}
  this.#available=true;this.#phase='complete';clearTimeout(this.#timer);this.#wipe();this.#resolveReady(true);
 }
 #wipe(){this.#secret.fill(0);this.#mainNonce=null;this.#creatorNonce=null;}
 dispose(){
  if(this.#closed)return;this.#closed=true;this.#available=false;this.#phase='closed';clearTimeout(this.#timer);this.#wipe();this.#buffer.fill(0);this.#used=0;this.#length=null;
  // Notify GateLink/fence before publishing async failed readiness or EOF.
  try{this.#subscriber?.closed();}catch{}
  this.#resolveReady(false);try{this.#stream.destroy();}catch{}
 }
 stats(){return Object.freeze({available:this.isAvailable(),closed:this.#closed,backpressured:this.#blocked,bufferedBytes:this.#used,receiveCapacity:this.#buffer.length,maxFrameBytes:MAX_FRAME,maxWriteBytes:MAX_WRITE,receivedFrames:this.#received,sentFrames:this.#sent});}
}
