// Isolated candidate22 DATA only. Legacy production PEER21 is unchanged.
// Neither a matching snapshot nor supplied expected DATA grants native authority.
import {types} from 'node:util';
const isProxy=types.isProxy,apply=Reflect.apply,wellFormed=String.prototype.isWellFormed;
const IDENTITY=['pid','image','createdFileTime'],MEMBER=[...IDENTITY,'alive','exitCode','observedBeforeClose'];
const PEER=['pairOrdinal','lane','server','connected','retiring','settled','peer','mainPid','creatorPid','queriedPeerPid','nativeDirection','bothJobsChecked','commonJobMember','sessionJobMember','readPending','writePending','readReservedBytes','writeReservedBytes','heldPeerClosed','generation','readIdleTimeout','nativeExecutionAdmitted'];
const frozen=v=>Object.freeze(Object.assign(Object.create(null),v)),uint=v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff,pid=v=>uint(v)&&v>0;
const result=(ok,matched={})=>frozen({ok,code:ok?'PEER_SNAPSHOT_CONTRACT_MATCHED':'PEER_SNAPSHOT_CONTRACT_REFUSED',scope:'PEER_SNAPSHOT_CONTRACT',nativeExecutionAdmitted:false,hostNativeJoined:false,actualSettlementEstablished:false,rosterAuthorityEstablished:false,...matched}),refused=result(false);
function record(value,keys){
 if(!value||typeof value!=='object'||isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
const image=v=>typeof v==='string'&&v.length>0&&v.length<=32767&&apply(wellFormed,v,[])&&/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+)/.test(v)&&!/[\x00-\x1f\x7f"]/.test(v);
const birth=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)&&BigInt(v)<=0xffffffffffffffffn;
const identity=r=>r&&pid(r.pid)&&image(r.image)&&birth(r.createdFileTime);
export function validateHostAsyncPeerObservation(expectation,value,...extra){
 if(extra.length)return refused;
 const e=record(expectation,['lane','mainPid','root','pairOrdinal']),r=record(value,PEER);
 if(!e||!r||!['control','history','command'].includes(e.lane)||!pid(e.mainPid)||!pid(e.pairOrdinal))return refused;
 const root=record(e.root,IDENTITY),p=record(r.peer,MEMBER);
 if(!identity(root)||!identity(p)||root.pid!==p.pid||root.image!==p.image||root.createdFileTime!==p.createdFileTime||p.alive!==true||!uint(p.exitCode)||p.observedBeforeClose!==false)return refused;
 if(r.pairOrdinal!==e.pairOrdinal||r.lane!==e.lane||r.mainPid!==e.mainPid||r.creatorPid!==root.pid||r.queriedPeerPid!==root.pid||r.nativeDirection!=='client')return refused;
 if(r.server!==true||r.connected!==true||r.retiring!==false||r.settled!==false||r.bothJobsChecked!==true||r.commonJobMember!==true||r.sessionJobMember!==true||r.heldPeerClosed!==false||r.readIdleTimeout!==false||r.nativeExecutionAdmitted!==false)return refused;
 if(!uint(r.generation)||typeof r.readPending!=='boolean'||typeof r.writePending!=='boolean'||r.readReservedBytes!==(r.readPending?32768:0)||!uint(r.writeReservedBytes)||r.writeReservedBytes>(e.lane==='control'?2048:90120)||r.writePending!==(r.writeReservedBytes!==0))return refused;
 return result(true,{matchedPairOrdinal:e.pairOrdinal,matchedLane:e.lane});
}
