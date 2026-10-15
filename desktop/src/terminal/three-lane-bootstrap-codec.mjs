// Separate pure SIRENTB2 packet. No loader, HANDLE parser or native admission.
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
const MAGIC=Buffer.from('SIRENTB2'),MAX=2048,HEADER=18,KEY_BYTES=32;
const bufferPrototype=Buffer.prototype;
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const pipe=(value,role)=>typeof value==='string'&&new RegExp('^\\\\\\\\\\.\\\\pipe\\\\siren-terminal-'+role+'-[a-f0-9]{32}$').test(value);
const refused=()=>{throw Error('THREE_LANE_BOOTSTRAP_REFUSED');};
function binary(value){
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 const length=Reflect.apply(byteLength,value,[]);if(!Number.isSafeInteger(length)||length>MAX)return null;
 const copy=Buffer.alloc(length);Reflect.apply(set,copy,[value]);return copy;
}
function wipe(value,limit=MAX+1){
 if(types.isProxy(value)||!types.isUint8Array(value))return;
 try{Reflect.apply(fill,value,[0,0,Math.min(Reflect.apply(byteLength,value,[]),limit)]);}catch{}
}
function request(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return refused();
 const keys=Reflect.ownKeys(value);if(keys.length!==2||keys.some(key=>!['sessionId','channelId'].includes(key)))return refused();
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return refused();r[key]=d.value;}if(!id(r.sessionId)||!id(r.channelId))return refused();return r;
}
function keysValid(keys){return keys.every(key=>key.length===KEY_BYTES&&key.some(byte=>byte!==0))&&!timingSafeEqual(keys[0],keys[1])&&!timingSafeEqual(keys[0],keys[2])&&!timingSafeEqual(keys[1],keys[2]);}
function privateRecord(meta,keys,payload=null){
 const r={...meta,nativeExecutionAdmitted:false};Object.defineProperties(r,{controlSecret:{value:keys[0]},historySecret:{value:keys[1]},commandSecret:{value:keys[2]},...(payload?{payload:{value:payload}}:{}),dispose:{value:()=>{keys.forEach(key=>wipe(key,KEY_BYTES));if(payload)wipe(payload,MAX);}}});return Object.freeze(r);
}
export function createThreeLaneTerminalBootstrap(value,...extra){
 let keys=null,payload=null;
 try{
  if(extra.length)return refused();const fields=request(value),meta={...fields,controlPipe:'\\\\.\\pipe\\siren-terminal-control-'+randomBytes(16).toString('hex'),historyPipe:'\\\\.\\pipe\\siren-terminal-data-'+randomBytes(16).toString('hex'),commandPipe:'\\\\.\\pipe\\siren-terminal-command-'+randomBytes(16).toString('hex')};
  keys=[];for(let index=0;index<3;index++)keys.push(randomBytes(KEY_BYTES));if(!keysValid(keys))return refused();
  const parts=[meta.sessionId,meta.channelId,meta.controlPipe,meta.historyPipe,meta.commandPipe].map(text=>Buffer.from(text,'utf8'));
  const size=HEADER+parts.reduce((n,part)=>n+part.length,0)+3*KEY_BYTES;if(size>MAX)return refused();payload=Buffer.alloc(size);MAGIC.copy(payload);let offset=HEADER;
  parts.forEach((part,index)=>{payload.writeUInt16BE(part.length,8+index*2);part.copy(payload,offset);offset+=part.length;});keys.forEach((key,index)=>key.copy(payload,offset+index*KEY_BYTES));return privateRecord(meta,keys,payload);
 }catch{keys?.forEach(key=>wipe(key,KEY_BYTES));if(payload)wipe(payload,MAX);return refused();}
}
export function decodeThreeLaneTerminalBootstrap(value,...extra){
 let bytes=null,keys=null;
 try{
  if(extra.length)return refused();bytes=binary(value);if(!bytes||bytes.length<HEADER+5+96||!bytes.subarray(0,8).equals(MAGIC))return refused();
  const fields=[],decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});let offset=HEADER;
  for(let index=0;index<5;index++){const size=bytes.readUInt16BE(8+index*2);if(!size||offset+size>bytes.length-96)return refused();const part=bytes.subarray(offset,offset+size),text=decoder.decode(part);if(!Buffer.from(text,'utf8').equals(part))return refused();fields.push(text);offset+=size;}
  if(offset+96!==bytes.length)return refused();const[sessionId,channelId,controlPipe,historyPipe,commandPipe]=fields;
  if(!id(sessionId)||!id(channelId)||!pipe(controlPipe,'control')||!pipe(historyPipe,'data')||!pipe(commandPipe,'command')||new Set([controlPipe,historyPipe,commandPipe]).size!==3)return refused();
  keys=[];for(let index=0;index<3;index++)keys.push(Buffer.from(bytes.subarray(offset+index*KEY_BYTES,offset+(index+1)*KEY_BYTES)));if(!keysValid(keys))return refused();return privateRecord({sessionId,channelId,controlPipe,historyPipe,commandPipe},keys);
 }catch{keys?.forEach(key=>wipe(key,KEY_BYTES));return refused();}
 finally{wipe(value);if(bytes)wipe(bytes,MAX);}
}
