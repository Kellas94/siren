// Renderer-side candidate only. Main retains caller/PIN/project/lease authority.
// Not installed in any preload or entrypoint. Output processing/ACK belongs to
// the view; merely receiving an event must never return credit or write input.
import {validateTerminalRequest} from '../../terminal/contracts.mjs';
import {validateTerminalEvent} from '../../terminal/events.mjs';

const routes=Object.freeze({pickCwd:'terminalPickCwd',listProfiles:'terminalListProfiles',create:'terminalCreate',list:'terminalList',attach:'terminalAttach',input:'terminalInput',resize:'terminalResize',ack:'terminalAck',detach:'terminalDetach',stop:'terminalStop'});
const channels=Object.freeze({onData:['onTerminalData','terminalData'],onGap:['onTerminalGap','terminalGap'],onState:['onTerminalState','terminalState']});
const failure=(code,operationId)=>Object.freeze({ok:false,code,...(operationId?{operationId}:{})});
function plainCopy(value,max=16){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const keys=Reflect.ownKeys(value);if(keys.length>max)return null;const result=Object.create(null);
 for(const key of keys){if(typeof key!=='string')return null;const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
 return result;
}
function method(bridge,name){
 const d=Object.getOwnPropertyDescriptor(bridge,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw TypeError('Finite terminal bridge required');
 const fn=d.value;return(...args)=>Reflect.apply(fn,bridge,args);
}
function receipt(value,operationId){
 const r=plainCopy(value,5);if(!r||typeof r.ok!=='boolean'||Object.keys(r).some(k=>!['ok','value','code','message','operationId'].includes(k))||Object.hasOwn(r,'operationId')&&r.operationId!==operationId)return null;
 if(r.ok){if(r.operationId!==operationId||!Object.hasOwn(r,'value'))return null;}
 else if(typeof r.code!=='string'||!/^[A-Z][A-Z0-9_]{0,95}$/.test(r.code))return null;
 if(Object.hasOwn(r,'message')&&(typeof r.message!=='string'||r.message.length>4096))return null;
 return Object.freeze(r);
}
export function createTerminalClient({bridge,epoch,operationId=()=>crypto.randomUUID()}){
 if(!bridge||typeof bridge!=='object'||!Number.isSafeInteger(epoch)||epoch<0||typeof operationId!=='function')throw TypeError('Terminal client scope required');
 const dispatch=Object.fromEntries(Object.values(routes).map(name=>[name,method(bridge,name)]));
 const subscribe=Object.fromEntries(Object.values(channels).map(([name])=>[name,method(bridge,name)]));
 const pending=new Set(),listeners=Object.fromEntries(Object.keys(channels).map(k=>[k,new Set()])),disposers=[];let disposed=false,listenerCount=0;
 function dispose(){
  if(disposed)return;disposed=true;for(const set of Object.values(listeners))set.clear();listenerCount=0;
  for(const off of disposers.splice(0))try{off();}catch{/* Every local subscription must still be retired. */}
 }
 function receive(key,eventMethod,payload){
  if(disposed)return;const r=validateTerminalEvent(eventMethod,payload);if(!r.ok||r.event.epoch!==epoch)return;
  for(const callback of [...listeners[key]]){if(disposed)break;if(!listeners[key].has(callback))continue;try{const result=callback(r.event);if(result instanceof Promise)result.catch(()=>{});}catch{/* A failed view does not ACK unprocessed output. */}}
 }
 try{
  for(const [key,[name,eventMethod]]of Object.entries(channels)){const off=subscribe[name](payload=>receive(key,eventMethod,payload));if(typeof off!=='function')throw TypeError('Terminal subscription disposer required');disposers.push(off);}
 }catch(error){dispose();throw error;}
 function request(name,payload={}){
  if(disposed)return Promise.resolve(failure('CLIENT_DISPOSED'));if(pending.size>=32)return Promise.resolve(failure('CAPACITY_EXCEEDED'));
  // Reflection and the operation-ID factory can reenter. Reserve first, and
  // retain that reservation through the actual bridge outcome if dispatched.
  let resolve;const work=new Promise(yes=>resolve=yes),record={work};pending.add(record);
  const finish=value=>{pending.delete(record);resolve(disposed?failure('CLIENT_DISPOSED',id):value);};
  let normalized,id;
  try{const fields=plainCopy(payload);if(!fields||Object.hasOwn(fields,'operationId')||Object.hasOwn(fields,'epoch'))throw Error();const candidateId=operationId();const checked=validateTerminalRequest(name,{...fields,operationId:candidateId,epoch});if(!checked.ok)throw Error();normalized=checked.payload;id=normalized.operationId;}catch{finish(failure('REQUEST_REFUSED'));return work;}
  if(disposed){finish(failure('CLIENT_DISPOSED'));return work;}
  // Reserve before entering the captured bridge: it may synchronously reenter.
  try{const original=dispatch[name](normalized);Promise.resolve(original).then(value=>{let result;try{result=receipt(value,id);}catch{}finish(result??failure('BRIDGE_UNAVAILABLE',id));},()=>finish(failure('BRIDGE_UNAVAILABLE',id)));}
  catch{finish(failure('BRIDGE_UNAVAILABLE',id));}
  return work;
 }
 const api=Object.fromEntries(Object.entries(routes).map(([name,route])=>[name,payload=>request(route,payload)]));
 for(const key of Object.keys(channels))api[key]=callback=>{
  if(disposed)throw Error('CLIENT_DISPOSED');if(typeof callback!=='function')throw TypeError('Expected callback');if(listenerCount>=32)throw Error('CAPACITY_EXCEEDED');
  const set=listeners[key];if(set.has(callback))throw Error('Duplicate terminal listener');set.add(callback);listenerCount++;let active=true;
  return()=>{if(!active)return;active=false;if(set.delete(callback))listenerCount--;};
 };
 api.dispose=dispose;api.drain=async()=>{while(pending.size)await Promise.all([...pending].map(r=>r.work));};
 return Object.freeze(api);
}
