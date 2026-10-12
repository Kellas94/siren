// Pure command shapes. Tokens carry correlation, never creator authority.
import {types} from 'node:util';
import {TERMINAL_LIMITS} from './contracts.mjs';

export const COMMAND_LIMITS=Object.freeze({inputBytes:32768,maxFrameBytes:45056,maxWriteBytes:90120,maxChunkBytes:131072,deadlineMs:10000});
const OPS=['install','revoke','input','resize'];
const FAILURES=new Set(['REQUEST_REFUSED','SESSION_REFUSED','LEASE_STALE','GATE_CLOSED','ENDPOINT_UNAVAILABLE','INPUT_RECEIPT_EXPIRED','INPUT_SEQUENCE_REFUSED','RESIZE_RECEIPT_EXPIRED','COMMAND_BUSY','COMMAND_AMBIGUOUS','COMMAND_RETIRED']);
const TOKEN=['sessionId','channelId','projectId','windowId','epoch','leaseId','generation','gateGeneration'];
const BASE=['type','op','channelId','sessionId','requestId','token'];
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const result=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
 return result;
}
function identity(value){const r=fields(value,['channelId','sessionId']);return r&&id(r.channelId)&&id(r.sessionId)?r:null;}
function token(value,scope){
 const r=fields(value,TOKEN);
 return r&&['sessionId','channelId','projectId','windowId','leaseId'].every(key=>id(r[key]))&&['epoch','generation','gateGeneration'].every(key=>integer(r[key])&&r[key]>0)&&r.channelId===scope.channelId&&r.sessionId===scope.sessionId?Object.freeze(r):null;
}
function base(value,scope,wire){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const op=Object.getOwnPropertyDescriptor(value,'op');if(!op||!Object.hasOwn(op,'value')||!OPS.includes(op.value))return null;
 const extra=op.value==='input'?['inputSequence',wire?'dataBase64':'data']:op.value==='resize'?['cols','rows']:[];
 const r=fields(value,[...BASE,...extra]);if(!r||r.type!=='command'||r.channelId!==scope.channelId||r.sessionId!==scope.sessionId||!integer(r.requestId)||r.requestId<1)return null;
 const t=token(r.token,scope);if(!t)return null;r.token=t;
 if(r.op==='input'&&!integer(r.inputSequence))return null;
 if(r.op==='resize'&&(!integer(r.cols)||r.cols<TERMINAL_LIMITS.minCols||r.cols>TERMINAL_LIMITS.maxCols||!integer(r.rows)||r.rows<TERMINAL_LIMITS.minRows||r.rows>TERMINAL_LIMITS.maxRows))return null;
 return r;
}

export function encodeTerminalCommandRequest(value,binding){
 try{
  const scope=identity(binding);if(!scope)return null;const r=base(value,scope,false);if(!r)return null;
  if(r.op==='input'){
   if(typeof r.data!=='string'||r.data.length>COMMAND_LIMITS.inputBytes||!r.data.isWellFormed()||Buffer.byteLength(r.data,'utf8')>COMMAND_LIMITS.inputBytes)return null;
   r.dataBase64=Buffer.from(r.data,'utf8').toString('base64');delete r.data;
  }
  return Buffer.byteLength(JSON.stringify(r),'utf8')<=COMMAND_LIMITS.maxFrameBytes?Object.freeze(r):null;
 }catch{return null;}
}

export function decodeTerminalCommandRequest(value,binding){
 try{
  const scope=identity(binding);if(!scope)return null;const r=base(value,scope,true);if(!r)return null;
  if(r.op==='input'){
   if(typeof r.dataBase64!=='string'||r.dataBase64.length>43692||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(r.dataBase64))return null;
   const bytes=Buffer.from(r.dataBase64,'base64');if(bytes.length>COMMAND_LIMITS.inputBytes||bytes.toString('base64')!==r.dataBase64)return null;
   const data=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);if(Buffer.from(data,'utf8').toString('base64')!==r.dataBase64)return null;
   r.data=data;delete r.dataBase64;
  }
  return Object.freeze(r);
 }catch{return null;}
}

export function validateTerminalCommandReply(value,binding){
 try{
  const scope=identity(binding);if(!scope)return null;const r=fields(value,[...BASE,'status','code']);
  if(!r||r.type!=='command-result'||!OPS.includes(r.op)||r.channelId!==scope.channelId||r.sessionId!==scope.sessionId||!integer(r.requestId)||r.requestId<1)return null;
  const t=token(r.token,scope);if(!t)return null;r.token=t;
  return (r.status==='accepted'&&r.code==='COMMAND_ACCEPTED'||r.status==='failed'&&FAILURES.has(r.code))?Object.freeze(r):null;
 }catch{return null;}
}
