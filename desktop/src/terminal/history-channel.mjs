// Dedicated authenticated read-only history lane; no listener, filesystem,
// native loader, shell, PTY, input/gate operations or process-identity admission.
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {TERMINAL_LIMITS} from './contracts.mjs';

const MAX_FRAME=45056,MAX_WRITE=90120;
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
function historyPacket(value,channel,session,reply){
 const keys=reply?['type','channelId','sessionId','requestId','firstSequence','endSequence','sequence','dataBase64']:['type','channelId','sessionId','requestId','fromSequence','maxBytes'];
 const r=fields(value,keys);if(!r||r.channelId!==channel||r.sessionId!==session||!integer(r.requestId)||r.requestId<1)return null;
 if(!reply)return r.type==='read'&&integer(r.fromSequence)&&integer(r.maxBytes)&&r.maxBytes>=4&&r.maxBytes<=32768?Object.freeze(r):null;
 if(r.type!=='history'||!integer(r.firstSequence)||!integer(r.endSequence)||r.firstSequence>r.endSequence||!integer(r.sequence)||r.sequence<r.firstSequence||r.sequence>r.endSequence||typeof r.dataBase64!=='string'||r.dataBase64.length>43692||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(r.dataBase64))return null;
 const b=Buffer.from(r.dataBase64,'base64');if(b.length>32768||b.toString('base64')!==r.dataBase64||r.sequence+b.length>r.endSequence)return null;
 try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b);}catch{return null;}
 return Object.freeze(r);
}
export class TerminalHistoryChannel {
 #stream;#role;#channel;#session;#secret;#mainNonce=null;#creatorNonce=null;#phase;
 #available=false;#closed=false;#subscriber=null;#blocked=false;
 #buffer=Buffer.alloc(MAX_FRAME+4);#used=0;#length=null;#timer;#expires;#resolveReady;
 #received=0;#sent=0;#decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
 constructor({stream,role,channelId,sessionId,secret,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
  if(!['main','creator'].includes(role)||!id(channelId)||!id(sessionId)||!Buffer.isBuffer(secret)||secret.length!==32||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs||!stream||!['on','write','destroy'].every(k=>typeof stream[k]==='function'))throw TypeError('Connected bounded history stream and bootstrap secret required');
  this.#stream=stream;this.#role=role;this.#channel=channelId;this.#session=sessionId;this.#secret=Buffer.from(secret);this.#phase=role==='main'?'proof':'challenge';
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
 get identity(){return Object.freeze({role:this.#role,channelId:this.#channel,sessionId:this.#session});}
 isAvailable(){return this.#available&&!this.#closed;}
 subscribe(receiver){
  const r=fields(receiver,['message','closed']);
  if(this.#subscriber||!r||typeof r.message!=='function'||typeof r.closed!=='function')throw TypeError('One disposable history subscriber required');
  this.#subscriber=r;if(this.#closed){try{r.closed();}catch{}}
  return ()=>{if(this.#subscriber===r)this.#subscriber=null;};
 }
 send(value){
  if(!this.isAvailable())return false;
  const packet=historyPacket(value,this.#channel,this.#session,this.#role==='creator');
  if(!packet){this.dispose();return false;}
  return this.#write(packet);
 }
 #mac(domain){
  return createHmac('sha256',this.#secret).update(JSON.stringify(['siren-terminal-history',1,domain,this.#channel,this.#session,this.#mainNonce,this.#creatorNonce])).digest('hex');
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
  if(!Buffer.isBuffer(bytes)||bytes.length>128*1024){this.dispose();return;}
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
   const packet=historyPacket(value,this.#channel,this.#session,this.#role==='main');
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
 // Notify the reader before publishing failed readiness or EOF.
  try{this.#subscriber?.closed();}catch{}
  this.#resolveReady(false);try{this.#stream.destroy();}catch{}
 }
 stats(){return Object.freeze({available:this.isAvailable(),closed:this.#closed,backpressured:this.#blocked,bufferedBytes:this.#used,receiveCapacity:this.#buffer.length,maxFrameBytes:MAX_FRAME,maxWriteBytes:MAX_WRITE,receivedFrames:this.#received,sentFrames:this.#sent});}
}

export class TerminalHistoryReader {
 #channel;#session;#pending=null;#next=0;#deadlineMs;
 constructor({channel,sessionId,deadlineMs=TERMINAL_LIMITS.stopDeadlineMs}={}){
  if(!(channel instanceof TerminalHistoryChannel)||channel.identity.role!=='main'||channel.identity.sessionId!==sessionId||!integer(deadlineMs)||deadlineMs<1||deadlineMs>TERMINAL_LIMITS.stopDeadlineMs)throw TypeError('Bound history lane required');
  this.#channel=channel;this.#session=sessionId;this.#deadlineMs=deadlineMs;
  channel.subscribe({message:r=>this.#reply(r),closed:()=>this.#refuse()});
 }
 #refuse(){const p=this.#pending;if(!p)return;this.#pending=null;clearTimeout(p.timer);p.reject(Error('HISTORY_UNAVAILABLE'));}
 #reply(r){
  const p=this.#pending;if(!p||r.requestId!==p.requestId||r.sessionId!==this.#session||performance.now()>=p.expires){this.#channel.dispose();return;}
  const bytes=Buffer.from(r.dataBase64,'base64');
  const start=Math.max(p.fromSequence,r.firstSequence);
  if(r.sequence!==start||p.fromSequence>r.endSequence||bytes.length>p.maxBytes||(!bytes.length&&start!==r.endSequence)){this.#channel.dispose();return;}
  const data=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  this.#pending=null;clearTimeout(p.timer);p.resolve(Object.freeze({firstSequence:r.firstSequence,endSequence:r.endSequence,chunk:bytes.length?Object.freeze({sequence:r.sequence,data,utf8Bytes:bytes.length}):null}));
 }
 async read(request){
  const r=fields(request,['sessionId','fromSequence','maxBytes']);
  if(!r||r.sessionId!==this.#session||!integer(r.fromSequence)||!integer(r.maxBytes)||r.maxBytes<4||r.maxBytes>32768||!this.#channel.isAvailable()||this.#pending||this.#next===Number.MAX_SAFE_INTEGER)throw Error('HISTORY_UNAVAILABLE');
  return new Promise((resolve,reject)=>{
   const p={...r,requestId:++this.#next,resolve,reject,expires:performance.now()+this.#deadlineMs};this.#pending=p;
   p.timer=setTimeout(()=>this.#channel.dispose(),this.#deadlineMs);
   if(!this.#channel.send({type:'read',channelId:this.#channel.identity.channelId,sessionId:this.#session,requestId:p.requestId,fromSequence:r.fromSequence,maxBytes:r.maxBytes}))this.#channel.dispose();
  });
 }
 dispose(){this.#channel.dispose();}
}

export function createHistoryResponder({channel,history}={}){
 if(!(channel instanceof TerminalHistoryChannel)||channel.identity.role!=='creator'||!history||typeof history.read!=='function')throw TypeError('Creator history lane required');
 let previous=0;
 return channel.subscribe({closed:()=>{},message:r=>{
  if(r.requestId<=previous){channel.dispose();return;}previous=r.requestId;
  let value;try{value=history.read({sessionId:r.sessionId,fromSequence:r.fromSequence,maxBytes:r.maxBytes});}catch{channel.dispose();return;}
  const result=fields(value,['firstSequence','endSequence','chunk']);if(!result){channel.dispose();return;}
  const chunk=result.chunk===null?null:fields(result.chunk,['sequence','data','utf8Bytes']);
  if(result.chunk!==null&&(!chunk||typeof chunk.data!=='string'||chunk.data.length>r.maxBytes||!chunk.data.isWellFormed()||Buffer.byteLength(chunk.data)!==chunk.utf8Bytes||chunk.utf8Bytes>r.maxBytes)){channel.dispose();return;}
  channel.send({type:'history',channelId:channel.identity.channelId,sessionId:r.sessionId,requestId:r.requestId,firstSequence:result.firstSequence,endSequence:result.endSequence,sequence:chunk?.sequence??Math.max(r.fromSequence,result.firstSequence),dataBase64:chunk?Buffer.from(chunk.data,'utf8').toString('base64'):''});
 }});
}
