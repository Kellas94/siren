// Separate byte adapter for the three-lane native variant's opaque endpoints.
// No addon loader, pipe listener, peer admission, PTY, shell or reconnection.
import {types} from 'node:util';
const MAX_READ=32768,MAX_FRAMES=32,MAX_LISTENERS=8;
const CAPS=Object.freeze({control:2048,history:90120,command:90120});
const EVENTS=['data','drain','end','close','error','timeout'];
const METHODS=['peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint'];
const bufferPrototype=Buffer.prototype,promisePrototype=Promise.prototype;
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const error=()=>Error('NATIVE_THREE_LANE_STREAM_UNAVAILABLE');
const refused=()=>TypeError('Bounded three-lane native DATA options required');
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw refused();
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))throw refused();
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value'))throw refused();r[key]=d.value;}return r;
}
function callbacks(native){
 if(!native||typeof native!=='object'||types.isProxy(native))throw refused();const r=Object.create(null);
 for(const name of METHODS){const d=Object.getOwnPropertyDescriptor(native,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))throw refused();r[name]=d.value;}return r;
}
function copyBinary(value,limit){
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 try{const length=Reflect.apply(byteLength,value,[]);if(!Number.isSafeInteger(length)||length>limit)return null;const bytes=Buffer.alloc(length);Reflect.apply(set,bytes,[value]);return{bytes,length};}catch{return null;}
}
function wipe(value,limit){if(types.isProxy(value)||!types.isUint8Array(value))return;try{Reflect.apply(fill,value,[0,0,Math.min(Reflect.apply(byteLength,value,[]),limit)]);}catch{}}
function promised(value){
 if(types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))throw error();return value;
}
function writtenBytes(value){try{const r=fields(value,['bytes']);return Number.isSafeInteger(r.bytes)?r.bytes:null;}catch{return null;}}

/**
 * Native owns the three-lane group: closing any endpoint retires all three.
 * Read timeout is a cancellation ceiling, never an idle expiry or empty polling
 * timer. Each adapter retains its actual pending read/write reservation after
 * retirement until that operation settles; an early close receipt cannot free
 * the charge or resolve closed. No true receipt is manufactured on timeout.
 */
export function createNativeThreeLaneStream(options,...extra){
 const{native,endpoint,lane,deadlineMs}=fields(options,['native','endpoint','lane','deadlineMs']),methods=callbacks(native);
 if(extra.length||!endpoint||typeof endpoint!=='object'||types.isProxy(endpoint)||typeof lane!=='string'||!Object.hasOwn(CAPS,lane)||!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>10000)throw refused();
 const maxWrite=CAPS[lane],listeners=Object.fromEntries(EVENTS.map(event=>[event,[]]));
 let retired=false,generation=0,readScheduled=false,readPending=false,inFlight=null,queue=[],queuedBytes=0,reservedWriteBytes=0,backpressured=false;
 let closeStarted=false,closeSettled=false,closeVerified=null,closedResolved=false,readOperations=0,writeOperations=0,resolveClosed;
 const closed=new Promise(resolve=>resolveClosed=resolve),call=(name,args)=>Reflect.apply(methods[name],native,args),current=()=>call('assertPeerCurrent',[endpoint])===true;
 function finishClose(){if(closeSettled&&!readPending&&!inFlight&&!closedResolved){closedResolved=true;resolveClosed(closeVerified===true);}}
 function emit(event,value){
  for(const fn of listeners[event].slice()){try{fn(value);}catch{if(!retired&&(event==='data'||event==='drain')){retire('error');return false;}}if(retired&&(event==='data'||event==='drain'))return false;}return !retired;
 }
 async function settleClose(promise){try{closeVerified=(await promise)===true;}catch{closeVerified=false;}closeSettled=true;finishClose();}
 function retire(reason='close'){
  if(retired)return;retired=true;generation++;backpressured=false;
  for(const entry of queue)wipe(entry.bytes,entry.length);reservedWriteBytes-=queuedBytes;queuedBytes=0;queue=[];
  if(!closeStarted){closeStarted=true;try{void settleClose(promised(call('closePeerEndpoint',[endpoint,deadlineMs])));}catch{closeVerified=false;closeSettled=true;finishClose();}}
  if(reason==='end')emit('end');if(reason==='error')emit('error',error());emit('close');
 }
 function scheduleRead(){
  if(retired||readPending||readScheduled||!listeners.data.length)return;readScheduled=true;
  queueMicrotask(()=>{readScheduled=false;if(!retired&&!readPending&&listeners.data.length)void readNext();});
 }
 async function readNext(){
  const epoch=generation;let value,failed=false,stillCurrent=false;
  try{if(!current()){retire('error');return;}}catch{retire('error');return;}if(retired||epoch!==generation)return;
  readPending=true;readOperations++;
  try{value=await promised(call('peerRead',[endpoint,deadlineMs]));}catch{failed=true;}readPending=false;
  if(retired||epoch!==generation){wipe(value,MAX_READ+1);finishClose();return;}
  if(failed){retire('error');return;}if(value===null){retire('end');return;}
  try{stillCurrent=current();}catch{stillCurrent=false;}
  if(retired||epoch!==generation){wipe(value,MAX_READ+1);finishClose();return;}
  if(!stillCurrent){wipe(value,MAX_READ+1);retire('error');return;}
  const entry=copyBinary(value,MAX_READ);wipe(value,MAX_READ+1);
  if(!entry||entry.length<1){retire('error');return;}
  if(emit('data',entry.bytes))scheduleRead();
 }
 const frameCount=()=>queue.length+(inFlight?1:0);
 function maybeDrain(){if(!retired&&backpressured&&reservedWriteBytes<maxWrite&&frameCount()<MAX_FRAMES){backpressured=false;emit('drain');}}
 async function writeNext(entry){
  const epoch=generation;let result,failed=false,stillCurrent=false;inFlight=entry;
  try{if(!current()||retired||epoch!==generation)throw error();writeOperations++;result=await promised(call('peerWrite',[endpoint,entry.bytes,deadlineMs]));}catch{failed=true;}
  try{stillCurrent=current();}catch{stillCurrent=false;}
  reservedWriteBytes-=entry.length;inFlight=null;wipe(entry.bytes,entry.length);
  if(retired||epoch!==generation){finishClose();return;}
  if(failed||!stillCurrent||writtenBytes(result)!==entry.length){retire('error');return;}
  if(queue.length){const next=queue.shift();queuedBytes-=next.length;void writeNext(next);}maybeDrain();
 }
 function on(event,fn){
  if(typeof event!=='string'||!Object.hasOwn(listeners,event)||typeof fn!=='function'||types.isProxy(fn)||listeners[event].length>=MAX_LISTENERS)throw TypeError('Bounded three-lane stream listener required');listeners[event].push(fn);if(event==='data')scheduleRead();return stream;
 }
 function write(value){
  const entry=copyBinary(value,maxWrite);if(!entry){
   // Distinguish a canonical oversize Buffer from a nonbinary/hostile value.
   if(!types.isProxy(value)&&types.isUint8Array(value)&&Object.getPrototypeOf(value)===bufferPrototype&&Reflect.apply(byteLength,value,[])>maxWrite)throw RangeError('Three-lane write byte limit exceeded');
   throw TypeError('Three-lane writes require canonical Buffer bytes');
  }
  if(retired){wipe(entry.bytes,entry.length);return false;}if(entry.length===0)return true;
  const capacity=()=>reservedWriteBytes+entry.length<=maxWrite&&frameCount()<MAX_FRAMES;
  if(!capacity()){wipe(entry.bytes,entry.length);throw RangeError('Three-lane write capacity exceeded');}
  const epoch=generation;try{if(!current()){wipe(entry.bytes,entry.length);retire('error');return false;}}catch{wipe(entry.bytes,entry.length);retire('error');return false;}
  if(retired||epoch!==generation){wipe(entry.bytes,entry.length);return false;}
  if(!capacity()){wipe(entry.bytes,entry.length);throw RangeError('Three-lane write capacity exceeded');}
  reservedWriteBytes+=entry.length;if(inFlight){queue.push(entry);queuedBytes+=entry.length;}else void writeNext(entry);
  if(retired)return false;const accepted=reservedWriteBytes<maxWrite&&frameCount()<MAX_FRAMES;if(!accepted)backpressured=true;return accepted;
 }
 const stream=Object.freeze({on,write,destroy(){retire();return stream;},closed,get writableLength(){return reservedWriteBytes;},stats(){return Object.freeze({lane,retired,generation,nativeExecutionAdmitted:false,readIdleTimeout:false,readPending,readReservedBytes:readPending?MAX_READ:0,writePending:inFlight!==null,inFlightWriteBytes:inFlight?.length??0,queuedWriteBytes:queuedBytes,queuedFrames:queue.length,writableLength:reservedWriteBytes,retainedBytes:reservedWriteBytes+(readPending?MAX_READ:0),backpressured,maxReadBytes:MAX_READ,maxWriteBytes:maxWrite,maxWriteFrames:MAX_FRAMES,readOperations,writeOperations,closePending:closeStarted&&!closeSettled,closeVerified});}});return stream;
}
