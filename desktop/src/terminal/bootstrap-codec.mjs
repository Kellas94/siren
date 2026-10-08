// Pure bounded startup packet. No stdin, pipe listener, native loader or admission.
import {randomBytes,timingSafeEqual} from 'node:crypto';
const MAGIC=Buffer.from('SIRENTB1'),MAX=2048,KEY_BYTES=32;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const pipe=(v,role)=>typeof v==='string'&&new RegExp('^\\\\\\\\\\.\\\\pipe\\\\siren-terminal-'+role+'-[a-f0-9]{32}$').test(v);
const refused=()=>{throw Error('TERMINAL_BOOTSTRAP_REFUSED');};
function request(value){
 try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return refused();
  const keys=Reflect.ownKeys(value);if(keys.length!==2||keys.some(k=>!['sessionId','channelId'].includes(k)))return refused();
  const fields={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return refused();fields[key]=d.value;}
  if(!id(fields.sessionId)||!id(fields.channelId))return refused();return fields;
 }catch{return refused();}
}
function keysValid(control,data){return control.length===KEY_BYTES&&data.length===KEY_BYTES&&control.some(b=>b!==0)&&data.some(b=>b!==0)&&!timingSafeEqual(control,data);}
function privateRecord(meta,control,data,payload){
 const result={...meta,nativeExecutionAdmitted:false};
 // Default JSON/string inspection exposes metadata only, never key bytes.
 Object.defineProperties(result,{
  controlSecret:{value:control},dataSecret:{value:data},...(payload?{payload:{value:payload}}:{}),
  dispose:{value:()=>{control.fill(0);data.fill(0);payload?.fill(0);}},
 });return Object.freeze(result);
}
export function createTerminalBootstrap(value){
 const fields=request(value),meta={...fields,controlPipe:'\\\\.\\pipe\\siren-terminal-control-'+randomBytes(16).toString('hex'),dataPipe:'\\\\.\\pipe\\siren-terminal-data-'+randomBytes(16).toString('hex')};
 const control=randomBytes(KEY_BYTES),data=randomBytes(KEY_BYTES);if(!keysValid(control,data)){control.fill(0);data.fill(0);return refused();}
 const parts=[meta.sessionId,meta.channelId,meta.controlPipe,meta.dataPipe].map(s=>Buffer.from(s,'utf8'));
 const size=16+parts.reduce((n,b)=>n+b.length,0)+2*KEY_BYTES;if(size>MAX){control.fill(0);data.fill(0);return refused();}
 const payload=Buffer.alloc(size);MAGIC.copy(payload);let offset=16;
 for(let i=0;i<4;i++){payload.writeUInt16BE(parts[i].length,8+2*i);parts[i].copy(payload,offset);offset+=parts[i].length;}
 control.copy(payload,offset);data.copy(payload,offset+KEY_BYTES);return privateRecord(meta,control,data,payload);
}
export function decodeTerminalBootstrap(input){
 try{
  if(!Buffer.isBuffer(input)||input.length<80||input.length>MAX||!input.subarray(0,8).equals(MAGIC))return refused();
  const strings=[],decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});let offset=16;
  for(let i=0;i<4;i++){const size=input.readUInt16BE(8+2*i);if(!size||offset+size>input.length-64)return refused();strings.push(decoder.decode(input.subarray(offset,offset+size)));offset+=size;}
  if(offset+64!==input.length)return refused();const [sessionId,channelId,controlPipe,dataPipe]=strings;
  if(!id(sessionId)||!id(channelId)||!pipe(controlPipe,'control')||!pipe(dataPipe,'data'))return refused();
  const control=input.subarray(offset,offset+KEY_BYTES),data=input.subarray(offset+KEY_BYTES);if(!keysValid(control,data))return refused();
  return privateRecord({sessionId,channelId,controlPipe,dataPipe},Buffer.from(control),Buffer.from(data));
 }catch{return refused();}
 finally{
  // A real stdin reader must cap its read at MAX+1. Do not scan attacker-sized
  // buffers merely to clear rejected data; clear at most that bounded window.
  if(Buffer.isBuffer(input))input.fill(0,0,Math.min(input.length,MAX+1));
 }
}
