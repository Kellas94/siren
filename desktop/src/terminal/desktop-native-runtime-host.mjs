// Fixed candidate resource. No addon, PTY, filesystem, command or renderer API.
// In ordinary Node/MAIN imports this entry does nothing. Explicit utility-only
// startup is private source preparation, never a product/native admission.
import {types} from 'node:util';
import {setInterval,clearInterval} from 'node:timers';
const schema='siren-desktop-utility-host/v1',apply=Reflect.apply;
function data(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const names=Reflect.ownKeys(value);if(names.length!==keys.length||names.some(key=>!keys.includes(key)))return null;
 const out={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
function method(object,key){
 if(!object||types.isProxy(object))throw Error('UTILITY_HOST_CONTEXT_REFUSED');
 for(let p=object;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))break;const d=Object.getOwnPropertyDescriptor(p,key);if(d){if(Object.hasOwn(d,'value')&&typeof d.value==='function'&&!types.isProxy(d.value))return (...args)=>apply(d.value,object,args);break;}}
 throw Error('UTILITY_HOST_CONTEXT_REFUSED');
}
export function startDesktopNativeUtilityHost(value,timing={setInterval,clearInterval},...extra){
 const r=data(value,['type','platform','arch','pid','electron','modules','napi','parentPort','exit']),t=data(timing,['setInterval','clearInterval']);
 if(extra.length||!r||r.type!=='utility'||r.platform!=='win32'||r.arch!=='x64'||r.electron!=='44.5.1'||r.modules!=='149'||r.napi!=='10'||!Number.isInteger(r.pid)||r.pid<=0||r.pid>0xffffffff||typeof r.exit!=='function'||types.isProxy(r.exit)||!t||Object.values(t).some(fn=>typeof fn!=='function'||types.isProxy(fn)))throw Error('UTILITY_HOST_CONTEXT_REFUSED');
 const on=method(r.parentPort,'on'),remove=method(r.parentPort,'removeListener'),send=method(r.parentPort,'postMessage');
 let retired=false,interval=null;
 function stop(code=0){if(retired)return;retired=true;try{remove('message',receive);}finally{if(interval!==null)t.clearInterval(interval);apply(r.exit,undefined,[code]);}}
 function receive(event){
  const p=data(event?.data,['schema','kind']);
  if(!p||p.schema!==schema||p.kind!=='retire'||(event?.ports?.length??0)!==0)return;
  stop();
 }
 try{
  on('message',receive);
  if(!retired){const token=t.setInterval(()=>{},1000);interval=token;if(retired)t.clearInterval(token);}
  if(!retired)send(Object.freeze({schema,pid:r.pid,electron:r.electron,modules:r.modules,napi:r.napi}));
 }catch{stop(91);throw Error('UTILITY_HOST_START_REFUSED');}
 return Object.freeze({stop:()=>stop()});
}
if(process.type==='utility')startDesktopNativeUtilityHost({type:process.type,platform:process.platform,arch:process.arch,pid:process.pid,electron:process.versions.electron,modules:process.versions.modules,napi:process.versions.napi,parentPort:process.parentPort,exit:code=>process.exit(code)});
