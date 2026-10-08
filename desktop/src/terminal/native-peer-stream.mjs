// Main-side byte-stream adapter for an already authenticated opaque endpoint.
// No native loader, listener, handle/PID admission, shell, PTY or reconnection.
import {types} from 'node:util';

const MAX_READ=32768,MAX_FRAMES=32,MAX_LISTENERS=8;
const EVENTS=['data','drain','end','close','error','timeout'];
const METHODS=['peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint'];
const lengthOf=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const setBytes=Uint8Array.prototype.set;
const fixedError=()=>Error('NATIVE_PEER_STREAM_UNAVAILABLE');

function optionsRecord(value){
 if(!value||typeof value!=='object'||types.isProxy(value))throw TypeError('Native peer stream options required');
 const keys=['native','endpoint','lane','deadlineMs'];
 if(Reflect.ownKeys(value).length!==keys.length)throw TypeError('Native peer stream options required');
 const result=Object.create(null);
 for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))throw TypeError('Native peer stream data options required');result[key]=descriptor.value;}
 return result;
}
function callbacks(value){
 if(!value||typeof value!=='object'||types.isProxy(value))throw TypeError('Native peer data methods required');
 const result=Object.create(null);
 for(const name of METHODS){const descriptor=Object.getOwnPropertyDescriptor(value,name);if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function'||types.isProxy(descriptor.value))throw TypeError('Native peer data methods required');result[name]=descriptor.value;}
 return result;
}
function bufferSize(value){
 if(types.isProxy(value)||!Buffer.isBuffer(value))return null;
 try{return Reflect.apply(lengthOf,value,[]);}catch{return null;}
}
function writtenBytes(value){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const descriptor=Object.getOwnPropertyDescriptor(value,'bytes');
 return descriptor&&Object.hasOwn(descriptor,'value')&&Number.isSafeInteger(descriptor.value)?descriptor.value:null;
}

export function createNativePeerStream(options){
 const {native,endpoint,lane,deadlineMs}=optionsRecord(options);
 const methods=callbacks(native);
 if(!endpoint||typeof endpoint!=='object'||types.isProxy(endpoint)||!['control','history'].includes(lane)||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>10000)throw TypeError('Opaque bounded native peer endpoint required');
 const maxWrite=lane==='control'?2048:90120;
 const listeners=Object.fromEntries(EVENTS.map(event=>[event,[]]));
 let retired=false,generation=0,readScheduled=false,readPending=false,inFlight=null;
 let queued=[],queuedBytes=0,reservedWriteBytes=0,backpressured=false;
 let closeStarted=false,closeSettled=false,closeVerified=null,closedResolved=false;
 let readOperations=0,writeOperations=0,resolveClosed;
 const closed=new Promise(resolve=>{resolveClosed=resolve;});
 const call=(name,args)=>Reflect.apply(methods[name],native,args);
 const current=()=>call('assertPeerCurrent',[endpoint])===true;
 const promised=value=>{if(types.isProxy(value)||!types.isPromise(value))throw fixedError();return value;};

 function finishClose(){
  // A native close receipt alone cannot release the adapter's operation charge.
  if(closeSettled&&!readPending&&!inFlight&&!closedResolved){closedResolved=true;resolveClosed(closeVerified===true);}
 }
 function emit(event,value){
  for(const listener of listeners[event].slice()){
   try{listener(value);}catch{if(!retired&&(event==='data'||event==='drain')){retire('error');return false;}}
   if(retired&&(event==='data'||event==='drain'))return false;
  }
  return !retired;
 }
 async function settleClose(promise){
  try{closeVerified=(await promise)===true;}catch{closeVerified=false;}
  closeSettled=true;finishClose();
 }
 function retire(reason='close'){
  if(retired)return;
  retired=true;generation++;backpressured=false;
  // Only unsent copies can be released now. Native owns pending operation bytes.
  for(const bytes of queued)bytes.fill(0);
  reservedWriteBytes-=queuedBytes;queuedBytes=0;queued=[];
  if(!closeStarted){
   closeStarted=true;
   try{void settleClose(promised(call('closePeerEndpoint',[endpoint,deadlineMs])));}catch{closeVerified=false;closeSettled=true;finishClose();}
  }
  if(reason==='end')emit('end');
  if(reason==='error')emit('error',fixedError());
  emit('close');
 }
 function scheduleRead(){
  if(retired||readPending||readScheduled||!listeners.data.length)return;
  readScheduled=true;
  queueMicrotask(()=>{readScheduled=false;if(!retired&&!readPending&&listeners.data.length)void readNext();});
 }
 async function readNext(){
  const epoch=generation;let bytes,failed=false,stillCurrent=false;
  try{if(!current()){retire('error');return;}}catch{retire('error');return;}
  if(retired||epoch!==generation)return;
  readPending=true;readOperations++;
  try{bytes=await promised(call('peerRead',[endpoint,deadlineMs]));}catch{failed=true;}
  readPending=false;
  if(retired||epoch!==generation){finishClose();return;}
  if(failed){retire('error');return;}
  // Native EOF retires both endpoints before resolving null. It carries no data.
  if(bytes===null){retire('end');return;}
  try{stillCurrent=current();}catch{stillCurrent=false;}
  if(retired||epoch!==generation){finishClose();return;}
  if(!stillCurrent){retire('error');return;}
  const length=bufferSize(bytes);
  if(length===null||length<1||length>MAX_READ){retire('error');return;}
  // Keep binary framing intact. Consumers own any UTF-8 decoding policy.
  if(emit('data',bytes))scheduleRead();
 }
 function frameCount(){return queued.length+(inFlight?1:0);}
 function maybeDrain(){
  if(!retired&&backpressured&&reservedWriteBytes<maxWrite&&frameCount()<MAX_FRAMES){backpressured=false;emit('drain');}
 }
 async function writeNext(bytes){
  const epoch=generation;let result,failed=false,stillCurrent=false;
  // Set the reservation before invoking a callback that might retire the stream.
  inFlight=bytes;
  try{if(!current())throw fixedError();if(retired||epoch!==generation)throw fixedError();writeOperations++;result=await promised(call('peerWrite',[endpoint,bytes,deadlineMs]));}catch{failed=true;}
  try{stillCurrent=current();}catch{stillCurrent=false;}
  reservedWriteBytes-=bytes.length;inFlight=null;bytes.fill(0);
  if(retired||epoch!==generation){finishClose();return;}
  if(failed||!stillCurrent||writtenBytes(result)!==bytes.length){retire('error');return;}
  if(queued.length){const next=queued.shift();queuedBytes-=next.length;void writeNext(next);}
  maybeDrain();
 }
 function on(event,listener){
  if(typeof event!=='string'||!Object.hasOwn(listeners,event)||typeof listener!=='function'||types.isProxy(listener)||listeners[event].length>=MAX_LISTENERS)throw TypeError('Bounded native stream listener required');
  listeners[event].push(listener);if(event==='data')scheduleRead();return stream;
 }
 function write(value){
  const length=bufferSize(value);
  if(length===null)throw TypeError('Native stream writes require Buffer bytes');
  if(length>maxWrite)throw RangeError('Native stream write byte limit exceeded');
  if(retired)return false;
  if(length===0)return true;
  if(reservedWriteBytes+length>maxWrite||frameCount()>=MAX_FRAMES)throw RangeError('Native stream write capacity exceeded');
  try{if(!current()){retire('error');return false;}}catch{retire('error');return false;}
  if(retired)return false;
  const bytes=Buffer.allocUnsafe(length);Reflect.apply(setBytes,bytes,[value]);reservedWriteBytes+=length;
  if(inFlight){queued.push(bytes);queuedBytes+=length;}else void writeNext(bytes);
  if(retired)return false;
  const accepted=reservedWriteBytes<maxWrite&&frameCount()<MAX_FRAMES;
  if(!accepted)backpressured=true;
  return accepted;
 }
 const stream=Object.freeze({
  on,write,destroy(){retire();return stream;},closed,
  get writableLength(){return reservedWriteBytes;},
  stats(){return Object.freeze({lane,retired,nativeExecutionAdmitted:false,readPending,readReservedBytes:readPending?MAX_READ:0,writePending:inFlight!==null,inFlightWriteBytes:inFlight?.length??0,queuedWriteBytes:queuedBytes,queuedFrames:queued.length,writableLength:reservedWriteBytes,retainedBytes:reservedWriteBytes+(readPending?MAX_READ:0),backpressured,maxReadBytes:MAX_READ,maxWriteBytes:maxWrite,maxWriteFrames:MAX_FRAMES,readOperations,writeOperations,closePending:closeStarted&&!closeSettled,closeVerified});},
 });
 return stream;
}
