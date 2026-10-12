// Inactive hosted diagnostic parent capture. Never starts a process or grants input.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {win32 as path} from 'node:path';
import {hashFreshEnvironment} from './terminal-fresh-pair-model.mjs';

const OPTIONAL=['USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir'];
let attempted=false;
const fail=()=>{throw 0;};
const digest=value=>createHash('sha256').update(value,'utf8').digest('hex');
const refusal=()=>Object.freeze({ok:false,code:'FRESH_ENVIRONMENT_REFUSED',nativeAdmission:false,inputAuthorized:false});
function scalar(value,max=32768){
 if(typeof value!=='string'||value.length>max||!value.isWellFormed()||value.includes('\0')||Buffer.byteLength(value,'utf8')>max)fail();
 return value;
}
function ownValue(env,key){
 const descriptor=Object.getOwnPropertyDescriptor(env,key);
 if(!descriptor)return undefined;
 if(!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail();
 return descriptor.value;
}
function arm(environment){
 const vector=[],rows=[];let totalBytes=0,blockCodeUnits=1;
 for(const [key,value] of Object.entries(environment)){
  scalar(value);const bytes=Buffer.byteLength(value,'utf8'),pair=key+'='+value;
  totalBytes+=Buffer.byteLength(key,'utf8')+bytes+2;blockCodeUnits+=pair.length+1;
  if(totalBytes>262144||blockCodeUnits>32767)fail();
  vector.push(pair);rows.push({key,bytes,sha256:digest(value)});
 }
 const hashed=hashFreshEnvironment(rows);if(!hashed.ok)fail();
 // The startup wire codec sorts exact key spelling before the creator receives
 // the shell environment. Keep launch DATA unchanged and model that distinct
 // boundary explicitly; raw native comparisons remain ordered and exact.
 const startup=hashFreshEnvironment([...rows].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0));if(!startup.ok)fail();
 // Match the plain DATA records decoded from the raw JSON; the pure hashing
 // model's internal null-prototype records are not the startup wire shape.
 const startupEnv=Object.freeze(startup.entries.map(row=>Object.freeze({key:row.key,bytes:row.bytes,sha256:row.sha256})));
 return Object.freeze({environment:Object.freeze(environment),vector:Object.freeze(vector),env:hashed.entries,envSha256:hashed.sha256,totalBytes,blockCodeUnits,startupEnv,startupEnvSha256:startup.sha256});
}
export function captureFreshPairLaunchEnvironment(systemDirectory,...extra){
 if(attempted)return refusal();attempted=true;
 try{
  if(extra.length||process.platform!=='win32')fail();
  scalar(systemDirectory,32767);
  if(!/^[A-Z]:\\/.test(systemDirectory)||systemDirectory.endsWith('\\')||path.normalize(systemDirectory)!==systemDirectory||path.basename(systemDirectory).toUpperCase()!=='SYSTEM32'||systemDirectory.slice(2).includes(':')||systemDirectory.split('\\').some(part=>/[ .]$/.test(part)))fail();
  const systemRoot=path.dirname(systemDirectory);if(systemRoot===path.parse(systemRoot).root)fail();
  // Parent must supply the genuine helper's SystemDirectory result. This string
  // check does not authenticate that result or the executable subsequently used.
  const env=process.env;if(!env||typeof env!=='object'||types.isProxy(env))fail();
  const common=Object.assign(Object.create(null),{SystemRoot:systemRoot,PATH:systemDirectory+';'+systemRoot});
  // Matches the original diagnostic profile's minimal PATH and fixed field order.
  // No ambient runner PATH/SystemRoot, NODE_*, ELECTRON_* or private keys copied.
  for(const key of OPTIONAL){const value=ownValue(env,key);if(typeof value==='string'&&value)common[key]=scalar(value);}
  if(!common.TEMP||!common.TMP)fail();
  const pathext=scalar(ownValue(env,'PATHEXT'),1024);if(!pathext)fail();
  const omitted=arm(common),trusted=arm(Object.assign(Object.create(null),common,{PATHEXT:pathext}));
  return Object.freeze({ok:true,evidenceClass:'ONE_ATTEMPT_PARENT_ENVIRONMENT_CAPTURE_NOT_NATIVE_ATTESTATION',systemDirectory,systemRoot,omitted,trusted,trustedPathext:Object.freeze({source:'CURRENT_RUNNER_PATHEXT',bytes:Buffer.byteLength(pathext,'utf8'),sha256:digest(pathext)}),nativeAdmission:false,inputAuthorized:false});
 }catch{return refusal();}
}
