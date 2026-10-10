// Pure DATA codec. A hash correlates bytes; it grants no execution authority.
// No timer, transaction state, environment inheritance, filesystem inspection,
// native import, process creation, retry or callback dispatch lives here.
import {types} from 'node:util';
import {createHash} from 'node:crypto';

export const STARTUP_LIMITS=Object.freeze({
 totalBytes:1048576,chunkBytes:16384,chunks:64,maxFrameBytes:45056,
 envKeys:512,envKeyUnits:128,envValueUnits:32768,envBytes:262144,
 pathUnits:32768,privateKeys:128,deadlineMs:10000,
});
const ENVELOPE=['version','sessionId','channelId','projectId','startupId','admissionEpoch','profileId','cwd','shell','cols','rows'];
const COMMON=['version','sessionId','channelId','startupId','sha256'];
const META=[...COMMON,'totalBytes','chunkCount'];
export const STARTUP_FAILURE_CODES=Object.freeze(['STARTUP_REFUSED','STARTUP_LIMIT','STARTUP_HASH_REFUSED','STARTUP_SCOPE_REFUSED','STARTUP_ORDER_REFUSED','STARTUP_GATE_CLOSED','STARTUP_ENDPOINT_UNAVAILABLE','STARTUP_TIMEOUT','STARTUP_AMBIGUOUS','STARTUP_RETIRED','STARTUP_BUSY','STARTUP_UNAVAILABLE']);
const FAILURES=new Set(STARTUP_FAILURE_CODES);
const REQUESTS=new Set(['startup-begin','startup-chunk','startup-seal','startup-start']);
const KEY=/^[A-Za-z_][A-Za-z0-9_()]{0,127}$/;
const POWER_SHELL=/\\WindowsPowerShell\\v1\.0\\powershell\.exe$/i;
const RESERVED=/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i;
const isProxy=types.isProxy,isUint8Array=types.isUint8Array,bufferPrototype=Buffer.prototype;
const from=Buffer.from.bind(Buffer),alloc=Buffer.alloc.bind(Buffer);
const bufferString=Buffer.prototype.toString;
const typed=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(typed,'byteLength').get;
const set=typed.set,fill=typed.fill;
const stringify=JSON.stringify,parse=JSON.parse;
const wellFormed=String.prototype.isWellFormed;
const utf8Decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const positive=v=>Number.isSafeInteger(v)&&v>0;
const validString=v=>typeof v==='string'&&Reflect.apply(wellFormed,v,[]);
const frozen=Object.freeze;

// Reject Proxy before any operation that can run its traps. Inspect DATA
// descriptors only; never evaluate a caller getter, toJSON or iterator.
function record(value,keys=null,max=Infinity){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);
 if(own.length>max||keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const result=Object.create(null);
 for(const key of own){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
 return result;
}
function array(value,max){
 if(!value||typeof value!=='object'||isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const length=Object.getOwnPropertyDescriptor(value,'length');
 if(!length||!Object.hasOwn(length,'value')||!Number.isSafeInteger(length.value)||length.value>max||Reflect.ownKeys(value).length!==length.value+1)return null;
 const result=[];for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result.push(d.value);}return result;
}
function localPath(value){
 if(!validString(value)||value.length>STARTUP_LIMITS.pathUnits||! /^[A-Za-z]:\\/.test(value)||/[\x00-\x1f\x7f<>"|?*]/.test(value)||value.includes('/')||value.slice(2).includes(':'))return null;
 if(value.length===3)return value;
 // Requiring an already canonical form prevents silent traversal, separator,
 // trailing-dot/space and Win32 device-name normalization at this boundary.
 const parts=value.slice(3).split('\\');
 if(parts.some(p=>!p||p==='.'||p==='..'||/[ .]$/.test(p)||RESERVED.test(p)))return null;
 return value;
}
function executable(value){const p=localPath(value);return p&&POWER_SHELL.test(p)?p:null;}
function policyRecord(value){
 if(value===undefined)return {privateKeys:new Set(),expectedExecutable:null};
 const p=record(value,null,2);if(!p||!Object.hasOwn(p,'privateEnvironmentKeys')||Object.keys(p).some(k=>k!=='privateEnvironmentKeys'&&k!=='expectedExecutable'))return null;
 const keys=array(p.privateEnvironmentKeys,STARTUP_LIMITS.privateKeys);if(!keys||!keys.every(k=>typeof k==='string'&&KEY.test(k)))return null;
 let expected=null;if(Object.hasOwn(p,'expectedExecutable')){expected=executable(p.expectedExecutable);if(!expected)return null;}
 return {privateKeys:new Set(keys.map(k=>k.toUpperCase())),expectedExecutable:expected};
}
// Counts UTF-8 without allocating a byte buffer. Inputs must be well formed.
function utf8Bytes(value){
 let bytes=0;for(let i=0;i<value.length;i++){const c=value.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff){bytes+=4;i++;}else bytes+=3;}return bytes;
}
function environment(value,policy){
 const r=record(value,null,STARTUP_LIMITS.envKeys);if(!r)return null;
 const seen=new Set(),result=Object.create(null);let bytes=0,path=false,root=false;
 const keys=Object.keys(r).sort();
 for(const key of keys){
  const val=r[key],upper=key.toUpperCase();
  if(!KEY.test(key)||seen.has(upper)||!validString(val)||val.length>STARTUP_LIMITS.envValueUnits||val.includes('\0'))return null;
  if(/^(?:NODE_|ELECTRON_|VSCODE_|SIREN_)/i.test(key)||upper==='CHROME_LOG_FILE'||upper==='PSMODULEPATH'||policy.privateKeys.has(upper))return null;
  seen.add(upper);bytes+=utf8Bytes(key)+utf8Bytes(val)+2;if(bytes>STARTUP_LIMITS.envBytes)return null;
  if(upper==='PATH'&&val)path=true;if(upper==='SYSTEMROOT'&&val)root=true;result[key]=val;
 }
 return path&&root?frozen(result):null;
}
function envelopeRecord(value,policy){
 const r=record(value,ENVELOPE);if(!r||r.version!==1||!['sessionId','channelId','projectId','startupId'].every(k=>id(r[k]))||!positive(r.admissionEpoch)||r.profileId!=='powershell')return null;
 if(!Number.isSafeInteger(r.cols)||r.cols<2||r.cols>500||!Number.isSafeInteger(r.rows)||r.rows<1||r.rows>200)return null;
 const cwd=localPath(r.cwd),shell=record(r.shell,['executable','args','env']);if(!cwd||!shell)return null;
 const exe=executable(shell.executable),args=array(shell.args,2),env=environment(shell.env,policy);
 if(!exe||policy.expectedExecutable&&exe.toLowerCase()!==policy.expectedExecutable.toLowerCase()||!args||args.length!==2||args[0]!=='-NoLogo'||args[1]!=='-NoProfile'||!env)return null;
 // Explicit construction fixes canonical JSON order independently of caller
 // property insertion order; environment keys were captured in sorted order.
 return frozen({version:1,sessionId:r.sessionId,channelId:r.channelId,projectId:r.projectId,startupId:r.startupId,admissionEpoch:r.admissionEpoch,profileId:'powershell',cwd,shell:frozen({executable:exe,args:frozen(args),env}),cols:r.cols,rows:r.rows});
}

// The exact JSON escaping budget is measured BEFORE stringify or Buffer.from.
// Only trusted captured records reach these functions, never caller toJSON.
function jsonStringBytes(value){
 let n=2;for(let i=0;i<value.length;i++){
  const c=value.charCodeAt(i);
  if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)n+=2;
  else if(c<32)n+=6;else if(c<128)n++;else if(c<2048)n+=2;
  else if(c>=0xd800&&c<=0xdbff){n+=4;i++;}else n+=3;
 }return n;
}
function jsonBytes(value,ceiling=STARTUP_LIMITS.totalBytes){
 if(typeof value==='string')return jsonStringBytes(value);
 if(typeof value==='number')return String(value).length;
 if(typeof value==='boolean')return value?4:5;
 const keys=Object.keys(value);let n=2;
 if(Array.isArray(value)){for(let i=0;i<keys.length;i++){n+=(i?1:0)+jsonBytes(value[i],ceiling);if(n>ceiling)return n;}}
 else for(let i=0;i<keys.length;i++){n+=(i?1:0)+jsonStringBytes(keys[i])+1+jsonBytes(value[keys[i]],ceiling);if(n>ceiling)return n;}
 return n;
}
function json(value){
 if(typeof value!=='object'||value===null)return stringify(value);
 if(Array.isArray(value))return '['+value.map(json).join(',')+']';
 return '{'+Object.keys(value).map(k=>stringify(k)+':'+json(value[k])).join(',')+'}';
}
function wipe(value){Reflect.apply(fill,value,[0]);}
function copyBytes(value,max){
 if(!value||typeof value!=='object'||isProxy(value)||!isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)return null;
 let n;try{n=Reflect.apply(byteLength,value,[]);}catch{return null;}
 if(n>max)return null;const owned=alloc(n);Reflect.apply(set,owned,[value]);return owned;
}
function digest(bytes){return createHash('sha256').update(bytes).digest('hex');}
function text(bytes,encoding){return Reflect.apply(bufferString,bytes,[encoding]);}
function commonValid(r){return r.version===1&&['sessionId','channelId','startupId'].every(k=>id(r[k]))&&typeof r.sha256==='string'&&/^[a-f0-9]{64}$/.test(r.sha256);}
function metaValid(r){return commonValid(r)&&positive(r.totalBytes)&&r.totalBytes<=STARTUP_LIMITS.totalBytes&&positive(r.chunkCount)&&r.chunkCount<=STARTUP_LIMITS.chunks&&r.chunkCount===Math.ceil(r.totalBytes/STARTUP_LIMITS.chunkBytes);}
function scope(value){const r=record(value,['sessionId','channelId']);return r&&id(r.sessionId)&&id(r.channelId)?r:null;}
function beginRecord(value){const r=record(value,['type',...META]);return r&&r.type==='startup-begin'&&metaValid(r)?r:null;}
function same(r,b,keys=COMMON){return keys.every(k=>r[k]===b[k]);}
function packet(value,wire){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const d=Object.getOwnPropertyDescriptor(value,'type');if(!d?.enumerable||!Object.hasOwn(d,'value')||!REQUESTS.has(d.value))return null;
 const type=d.value,keys=type==='startup-begin'?META:type==='startup-chunk'?[...META,'index',wire?'dataBase64':'data']:type==='startup-start'?[...COMMON,'gateGeneration']:COMMON;
 const r=record(value,['type',...keys]);if(!r||!commonValid(r))return null;
 if((type==='startup-begin'||type==='startup-chunk')&&!metaValid(r))return null;
 if(type==='startup-start'&&!positive(r.gateGeneration))return null;
 if(type==='startup-chunk'&&(!Number.isSafeInteger(r.index)||r.index<0||r.index>=r.chunkCount))return null;
 return r;
}
function boundPacket(value,binding,wire){
 const r=packet(value,wire);if(!r)return null;
 if(r.type==='startup-begin'){const s=scope(binding);return s&&same(r,s,['sessionId','channelId'])?r:null;}
 const b=beginRecord(binding);return b&&same(r,b,r.type==='startup-chunk'?META:COMMON)?r:null;
}
function rawLength(r){return Math.min(STARTUP_LIMITS.chunkBytes,r.totalBytes-r.index*STARTUP_LIMITS.chunkBytes);}
function base64Bytes(value,length){
 if(typeof value!=='string'||value.length!==Math.ceil(length/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))return null;
 const bytes=from(value,'base64');if(bytes.length!==length||text(bytes,'base64')!==value){wipe(bytes);return null;}return bytes;
}

export function validateStartupEnvelope(value,policy){
 try{const p=policyRecord(policy),r=p&&envelopeRecord(value,p);return r&&jsonBytes(r)<=STARTUP_LIMITS.totalBytes?r:null;}catch{return null;}
}
export function encodeStartupEnvelope(value,policy){
 let bytes=null;try{
  const p=policyRecord(policy),r=p&&envelopeRecord(value,p);if(!r)return null;
  const totalBytes=jsonBytes(r);if(totalBytes>STARTUP_LIMITS.totalBytes)return null;
  bytes=from(json(r),'utf8');if(bytes.length!==totalBytes){wipe(bytes);return null;}
  const result={version:1,sessionId:r.sessionId,channelId:r.channelId,startupId:r.startupId,totalBytes,chunkCount:Math.ceil(totalBytes/STARTUP_LIMITS.chunkBytes),sha256:digest(bytes)};
  const owned=bytes;Object.defineProperties(result,{bytes:{value:owned},dispose:{value:()=>{wipe(owned);return true;}}});return frozen(result);
 }catch{if(bytes)wipe(bytes);return null;}
}
export function decodeStartupEnvelope(value,begin,policy){
 let bytes=null;try{
  const b=beginRecord(begin),p=policyRecord(policy);if(!b||!p)return null;
  bytes=copyBytes(value,STARTUP_LIMITS.totalBytes);if(!bytes||bytes.length!==b.totalBytes||digest(bytes)!==b.sha256)return null;
  const decoded=utf8Decoder.decode(bytes),r=envelopeRecord(parse(decoded),p);
  if(!r||!same(r,b,['version','sessionId','channelId','startupId'])||jsonBytes(r)!==bytes.length||json(r)!==decoded)return null;
  return r;
 }catch{return null;}finally{if(bytes)wipe(bytes);}
}
export function encodeStartupRequest(value,binding){
 let bytes=null;try{
  const r=boundPacket(value,binding,false);if(!r)return null;
  if(r.type==='startup-chunk'){
   bytes=copyBytes(r.data,STARTUP_LIMITS.chunkBytes);if(!bytes||bytes.length!==rawLength(r))return null;
   r.dataBase64=text(bytes,'base64');delete r.data;
  }
  return jsonBytes(r,STARTUP_LIMITS.maxFrameBytes)<=STARTUP_LIMITS.maxFrameBytes?frozen(r):null;
 }catch{return null;}finally{if(bytes)wipe(bytes);}
}
export function decodeStartupRequest(value,binding){
 let bytes=null;try{
  const r=boundPacket(value,binding,true);if(!r)return null;
  if(r.type==='startup-chunk'){
   bytes=base64Bytes(r.dataBase64,rawLength(r));if(!bytes)return null;
   r.data=bytes;delete r.dataBase64;
  }
  const result=frozen(r);bytes=null;return result;
 }catch{return null;}finally{if(bytes)wipe(bytes);}
}

function replyRequest(value){
 // Requests are intrinsically validated wire DATA. Correlation to an accepted
 // begin and arrival order belongs to the transaction owner, not this codec.
 const r=packet(value,true);if(!r)return null;
 if(r.type==='startup-chunk'){const b=base64Bytes(r.dataBase64,rawLength(r));if(!b)return null;wipe(b);}return r;
}
const finishReply=r=>jsonBytes(r,STARTUP_LIMITS.maxFrameBytes)<=STARTUP_LIMITS.maxFrameBytes?frozen(r):null;
function replyRecord(value,request){
 const q=replyRequest(request);if(!q||!value||typeof value!=='object'||isProxy(value))return null;
 const d=Object.getOwnPropertyDescriptor(value,'type');if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;
 const phase=q.type.slice(8),type=d.value;
 let keys;
 if(type==='startup-failed')keys=[...COMMON,'phase',...(phase==='chunk'?['index']:[]),'status','code'];
 else if(type==='startup-begin-ack'&&phase==='begin')keys=[...COMMON,'status','code'];
 else if(type==='startup-chunk-ack'&&phase==='chunk')keys=[...COMMON,'index','status','code'];
 else if(type==='startup-prepared'&&phase==='seal')keys=[...COMMON,'projectId','admissionEpoch','initiallyClosed','status','code'];
 else if(type==='startup-ready'&&phase==='start')keys=[...COMMON,'gateGeneration','reportedShell','status','code'];
 else return null;
 const r=record(value,['type',...keys]);if(!r||!commonValid(r)||!same(r,q))return null;
 if(type==='startup-failed')return r.phase===phase&&r.status==='failed'&&FAILURES.has(r.code)&&(phase!=='chunk'||r.index===q.index)?finishReply(r):null;
 if(r.status!=='accepted')return null;
 if(type==='startup-prepared')return r.code==='STARTUP_PREPARED'&&id(r.projectId)&&positive(r.admissionEpoch)&&r.initiallyClosed===true?finishReply(r):null;
 if(type==='startup-ready'){
  const shell=record(r.reportedShell,['pid','image']);if(r.code!=='STARTUP_READY'||r.gateGeneration!==q.gateGeneration||!shell||!positive(shell.pid)||shell.pid>0xffffffff||!executable(shell.image))return null;
  r.reportedShell=frozen(shell);return finishReply(r);
 }
 return r.code==='STARTUP_ACCEPTED'&&(phase!=='chunk'||r.index===q.index)?finishReply(r):null;
}
export function encodeStartupReply(value,request){try{return replyRecord(value,request);}catch{return null;}}
export function validateStartupReply(value,request){try{return replyRecord(value,request);}catch{return null;}}

// Memory/ownership contract: limits cover serialized envelope bytes, a chunk
// and each native transport reservation separately, not total JS heap. Encode
// temporarily holds the immutable configuration, JSON string and owned bytes.
// Decode holds a <=1 MiB byte snapshot, decoded JSON, parsed record and frozen
// validated copy. JSON strings are GC-managed and cannot be securely wiped.
// Caller buffers stay caller-owned; returned bytes/data are mutable Buffers.
// The owner must retain/account/dispose them until delivery or retirement; it
// must not infer authority or native process identity from metadata/replies.
