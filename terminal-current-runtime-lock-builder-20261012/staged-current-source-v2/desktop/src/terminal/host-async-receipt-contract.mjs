// Pure DATA validation only. No loader, callbacks, shutdown, Promise observation,
// authority capture or native/Session actual-completion claim is made here.
import {types} from 'node:util';
const isProxy=types.isProxy,apply=Reflect.apply,wellFormed=String.prototype.isWellFormed;
const IDENTITY=['pid','image','createdFileTime'],MEMBER=[...IDENTITY,'alive','exitCode'];
const HOST=['active','root','held','killOnClose','breakaway','inheritable','monitorFired','monitorTerminateSucceeded','stopping'];
const RECEIPT=['version','shutdownId','code','deadlineMs','snapshot','closed','scope','sessionCleanupJoined','peers'];
const PEER=['pairOrdinal','nativeReaped','jsDeliveryVerified','tsfnFinalized'];
const frozen=value=>Object.freeze(Object.assign(Object.create(null),value));
const result=(ok,counts={})=>frozen({ok,code:ok?'HOST_RECEIPT_CONTRACT_MATCHED':'HOST_RECEIPT_CONTRACT_REFUSED',scope:'HOST_RECEIPT_CONTRACT',nativeExecutionAdmitted:false,hostNativeJoined:false,sessionCleanupJoined:false,actualSettlementEstablished:false,...counts});
const refused=result(false),uint=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff,pid=v=>uint(v)&&v>0;
function record(value,keys){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function array(value,max){
 if(!value||typeof value!=='object'||isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const length=Object.getOwnPropertyDescriptor(value,'length');if(!length||!Object.hasOwn(length,'value')||!Number.isInteger(length.value)||length.value<0||length.value>max)return null;
 if(Reflect.ownKeys(value).length!==length.value+1)return null;
 const rows=[];for(let i=0;i<length.value;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;rows.push(d.value);}return rows;
}
const image=v=>typeof v==='string'&&v.length>0&&v.length<=32767&&apply(wellFormed,v,[])&&/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(v)&&!/[\x00-\x1f\x7f"]/.test(v);
const birth=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)&&BigInt(v)<=0xffffffffffffffffn;
function identity(value,dead=false){const r=record(value,dead?MEMBER:IDENTITY);return r&&pid(r.pid)&&image(r.image)&&birth(r.createdFileTime)&&(!dead||r.alive===false&&uint(r.exitCode))?r:null;}
const same=(a,b)=>a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
function held(value,dead=false){
 const rows=array(value,128);if(!rows)return null;const out=[],seen=new Set();for(const row of rows){const r=identity(row,dead);if(!r||seen.has(r.pid))return null;seen.add(r.pid);out.push(r);}return out;
}
function alias(root,rows,dead=false){const row=rows.find(r=>r.pid===root.pid);return !row||same(row,root)&&(!dead||row.exitCode===root.exitCode);}
function ordinals(value){const rows=array(value,8);return rows&&rows.every(pid)&&new Set(rows).size===rows.length?rows:null;}
function expected(value){
 const r=record(value,['request','root','held','pairOrdinals']);if(!r)return null;
 const request=record(r.request,['shutdownId','code','deadlineMs']),root=identity(r.root),rows=held(r.held),peers=ordinals(r.pairOrdinals);
 if(!request||typeof request.shutdownId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(request.shutdownId)||![77,98].includes(request.code)||!Number.isInteger(request.deadlineMs)||request.deadlineMs<1||request.deadlineMs>10000||!root||!rows||!peers||!alias(root,rows))return null;
 return {request,root,held:rows,pairOrdinals:peers};
}
/**
 * A match is only shape/equality against supplied expected DATA. Expected DATA
 * must later come from independently captured native-owned authorities; this
 * function does not brand it, establish provenance, or join any actual work.
 */
export function validateHostAsyncReceipt(expectation,value,...extra){
 if(extra.length)return refused;
 const e=expected(expectation),r=record(value,RECEIPT);if(!e||!r)return refused;
 if(r.version!==1||r.shutdownId!==e.request.shutdownId||r.code!==e.request.code||r.deadlineMs!==e.request.deadlineMs||r.closed!==true||r.scope!=='HOST_AND_EXACT_PEER_ROSTER_ONLY'||r.sessionCleanupJoined!==false)return refused;
 const s=record(r.snapshot,HOST);if(!s||s.active!==0||s.killOnClose!==true||s.breakaway!==false||s.inheritable!==false||s.stopping!==true||typeof s.monitorFired!=='boolean'||typeof s.monitorTerminateSucceeded!=='boolean')return refused;
 const root=identity(s.root,true),rows=held(s.held,true);
 if(!root||!same(root,e.root)||!rows||rows.length!==e.held.length||!rows.every(row=>e.held.some(x=>same(row,x)))||!alias(root,rows,true))return refused;
 const peers=array(r.peers,8);if(!peers||peers.length!==e.pairOrdinals.length)return refused;
 const seen=new Set();for(const row of peers){const p=record(row,PEER);if(!p||!pid(p.pairOrdinal)||seen.has(p.pairOrdinal)||!e.pairOrdinals.includes(p.pairOrdinal)||p.nativeReaped!==true||p.jsDeliveryVerified!==true||p.tsfnFinalized!==true)return refused;seen.add(p.pairOrdinal);}
 return result(true,{matchedPeerCount:peers.length,matchedHeldCount:rows.length});
}
