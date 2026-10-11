// Renderer event shapes only; this grants no caller, lease, credit or input authority.
import {TERMINAL_LIMITS} from './contracts.mjs';
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const counter=value=>Number.isSafeInteger(value)&&value>=0;
const positive=value=>counter(value)&&value>0;
const encoder=new TextEncoder();
const states=['starting','running','exited','host-failed','stopping','cleanup-failed'];
const lease={epoch:counter,sessionId:id,leaseId:id,generation:positive};
const sessionFields={sessionId:id,projectId:id,profileId:id,
 cwdDisplay:value=>typeof value==='string'&&value.length<=32768&&value.isWellFormed(),
 state:value=>typeof value==='string'&&states.includes(value),
 exitCode:value=>value===null||counter(value),droppedUtf8Bytes:counter,
 attachedWindowId:value=>value===null||id(value)};
const eventFields={
 terminalData:{...lease,sequence:counter,data:value=>typeof value==='string'&&value.length>0&&value.length<=TERMINAL_LIMITS.outputBytes&&value.isWellFormed(),utf8Bytes:value=>positive(value)&&value<=TERMINAL_LIMITS.outputBytes},
 terminalGap:{...lease,droppedUtf8Bytes:positive,resumeSequence:counter},
 terminalState:{epoch:counter,session:value=>value!==null&&typeof value==='object'},
};
function copy(value,fields){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const keys=Reflect.ownKeys(value);if(keys.length!==Object.keys(fields).length)return null;
 const result=Object.create(null);
 for(const key of keys){
  if(typeof key!=='string'||!Object.hasOwn(fields,key))return null;
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d?.enumerable||!Object.hasOwn(d,'value')||!fields[key](d.value))return null;
  result[key]=d.value;
 }
 return result;
}
export function validateTerminalEvent(method,payload){
 try{
  if(typeof method!=='string'||!Object.hasOwn(eventFields,method))throw Error();
  const event=copy(payload,eventFields[method]);if(!event)throw Error();
  if(method==='terminalData'&&(encoder.encode(event.data).byteLength!==event.utf8Bytes||!Number.isSafeInteger(event.sequence+event.utf8Bytes)))throw Error();
  if(method==='terminalState'){const session=copy(event.session,sessionFields);if(!session)throw Error();event.session=Object.freeze(session);}
  return Object.freeze({ok:true,event:Object.freeze(event)});
 }catch{return Object.freeze({ok:false,code:'EVENT_REFUSED'});}
}
