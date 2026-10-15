// Inactive private MAIN binding. No import/construction I/O or native admission.
import {types} from 'node:util';
import {win32 as path} from 'node:path';
import {WindowRegistry} from '../windows/registry.mjs';
import {loadDesktopNativeFilesystemProvider} from './desktop-native-filesystem.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';
import {desktopNativeRuntimeResourcePaths} from './desktop-native-runtime-resources.mjs';
const apply=Reflect.apply,NativePromise=Promise,then=Promise.prototype.then;
const registryMethods=Object.fromEntries(['isCurrent','eventFor','captureAdmissionGuard'].map(k=>[k,Object.getOwnPropertyDescriptor(WindowRegistry.prototype,k).value]));
const fields=['registry','projectId','runtimeDirectory','dataDirectory','privateEnvironmentKeys','parentForWebContents','showOpenDialog','readEnvironment','isUnlocked','getMode','canExecute','assertResourcesCurrent'];
const callbacks=fields.slice(5);
const environmentKeys=Object.freeze(['SystemRoot','PATH','PATHEXT','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir']);
const environmentNames=new Map(environmentKeys.map(k=>[k.toUpperCase(),k]));
const record=o=>Object.freeze(Object.assign(Object.create(null),o));
const failures=new WeakMap();
const fail=code=>{const error=Error(code);failures.set(error,code);throw error;};
const callable=f=>typeof f==='function'&&!types.isProxy(f);
function data(v,keys){
 if(!v||types.isProxy(v)||typeof v!=='object'||![null,Object.prototype].includes(Object.getPrototypeOf(v)))return null;
 const names=Reflect.ownKeys(v);if(names.length!==keys.length||names.some(k=>!keys.includes(k)))return null;
 const r=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
function localPath(v){
 if(typeof v!=='string'||!v.isWellFormed()||v.length<3||v.length>1024||! /^[A-Za-z]:\\/.test(v)||/[\x00-\x1f\x7f-\x9f/<>"|?*~]/.test(v)||v.slice(2).includes(':')||path.normalize(v)!==v)return false;
 return v.length===3||v.slice(3).split('\\').every(s=>s&&s!=='.'&&s!=='..'&&!/[ .]$/.test(s)&&!/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(s));
}
function privateKeys(v){
 if(types.isProxy(v)||!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>128||Reflect.ownKeys(v).length!==v.length+1)fail('DESKTOP_PROVIDERS_REFUSED');
 const result=[],seen=new Set();for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i)),k=d&&Object.hasOwn(d,'value')?d.value:null;if(!d?.enumerable||typeof k!=='string'||! /^[A-Za-z_][A-Za-z0-9_()]{0,127}$/.test(k)||seen.has(k.toUpperCase()))fail('DESKTOP_PROVIDERS_REFUSED');seen.add(k.toUpperCase());result.push(k);}
 if(seen.has('PSMODULEPATH'))fail('DESKTOP_PROVIDERS_PRIVATE_DENY');return Object.freeze(result);
}
function environment(v,denied){
 if(!v||types.isProxy(v)||typeof v!=='object'||![null,Object.prototype].includes(Object.getPrototypeOf(v)))fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');
 const names=Reflect.ownKeys(v);if(names.length>512)fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');
 const selected=new Map();for(const k of names){if(typeof k!=='string')continue;const upper=k.toUpperCase();if(!environmentNames.has(upper))continue;if(selected.has(upper))fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');selected.set(upper,d.value);}
 const out=Object.create(null);let bytes=0,units=1;
 for(const k of environmentKeys){const upper=k.toUpperCase();if(denied.has(upper)||!selected.has(upper))continue;const v=selected.get(upper);if(typeof v!=='string'||v.length>32768||!v.isWellFormed()||v.includes('\0'))fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');bytes+=Buffer.byteLength(k+'='+v+'\0','utf8');units+=k.length+v.length+2;if(bytes>262144||units>32767)fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');out[k]=v;}
 if(!out.SystemRoot||!out.PATH)fail('DESKTOP_PROVIDERS_ENVIRONMENT_REFUSED');return Object.freeze(out);
}
export function createDesktopNativeProviders(options,...extra){
 const o=data(options,fields);if(extra.length||!o||!o.registry||types.isProxy(o.registry)||Object.getPrototypeOf(o.registry)!==WindowRegistry.prototype||typeof o.projectId!=='string'||! /^[a-z0-9][a-z0-9_-]{0,127}$/.test(o.projectId)||!localPath(o.runtimeDirectory)||!localPath(o.dataDirectory)||callbacks.some(k=>!callable(o[k])))fail('DESKTOP_PROVIDERS_REFUSED');
 const keys=privateKeys(o.privateEnvironmentKeys),denied=new Set(keys.map(k=>k.toUpperCase())),roots=Object.freeze([o.runtimeDirectory,o.dataDirectory]);
 let state='idle',retired=false,pending=0,unknown=false,fs=null,context=null,resources=null,fsRetiring=false,fsSettled=false,resolveRetirement,rejectRetirement;
 // Allocate before publication: async_hooks.init cannot duplicate retirement.
 const retirement=new NativePromise((yes,no)=>{resolveRetirement=yes;rejectRetirement=no;});
 // A retirement failure may become known before the caller requests the join.
 apply(then,retirement,[undefined,()=>{}]);
 function finish(){if(!retired||pending||!fsSettled)return;if(unknown){state='blocked';rejectRetirement(Error('DESKTOP_PROVIDERS_RETIREMENT_UNKNOWN'));}else{state='retired';resolveRetirement(record({retired:true,actualSettled:true,pending:0,nativeExecutionAdmitted:false}));}}
 function retireFilesystem(){
  if(!fs||fsRetiring)return;fsRetiring=true;
  try{const p=fs.retire();if(!supportedProviderPromise(p))throw 0;apply(then,p,[r=>{const d=data(r,['retired','actualSettled','pending']);if(!d||d.retired!==true||d.actualSettled!==true||d.pending!==0)unknown=true;fsSettled=true;finish();},()=>{unknown=true;fsSettled=true;finish();}]);}catch{unknown=true;fsSettled=true;finish();}
 }
 function retire(...args){if(args.length)return NativePromise.reject(Error('DESKTOP_PROVIDERS_REFUSED'));retired=true;if(state==='idle')fsSettled=true;state='retiring';retireFilesystem();finish();return retirement;}
 function check(){
  if(retired||state!=='active'&&state!=='loading')fail('DESKTOP_PROVIDERS_RETIRED');
  const answer=apply(o.assertResourcesCurrent,undefined,[context,resources]);
  if(answer!==true||retired)fail('DESKTOP_PROVIDERS_STALE');
 }
 function unlocked(){check();const answer=apply(o.isUnlocked,undefined,[]);check();if(answer!==true)fail('DESKTOP_PROVIDERS_STALE');}
 function run(fn){
  if(retired)return NativePromise.reject(Error('DESKTOP_PROVIDERS_RETIRED'));if(pending>=8)return NativePromise.reject(Error('DESKTOP_PROVIDERS_CAPACITY'));
  pending++; // Reserve before Promise-init or any trusted MAIN callout.
  return NativePromise.resolve().then(fn).catch(error=>{const code=error&&!types.isProxy(error)&&typeof error==='object'?failures.get(error):null;fail(code??'DESKTOP_PROVIDERS_REFUSED');}).finally(()=>{pending--;finish();});
 }
 async function query(name,args){check();unlocked();const p=apply(fs[name],fs,args);if(!supportedProviderPromise(p)){unknown=true;fail('DESKTOP_PROVIDERS_SETTLEMENT_UNKNOWN');}const result=await p;unlocked();return result;}
 function grantScope(grant){
  unlocked();let guard,event;try{if(apply(registryMethods.isCurrent,o.registry,[grant])!==true||grant.projectId!==o.projectId||!['workspace','terminal'].includes(grant.role))throw 0;guard=apply(registryMethods.captureAdmissionGuard,o.registry,[grant]);event=apply(registryMethods.eventFor,o.registry,[grant]);}catch{fail('DESKTOP_PROVIDERS_SENDER_REFUSED');}
  if(!guard||!event)fail('DESKTOP_PROVIDERS_SENDER_REFUSED');
  return ()=>{unlocked();const mode=apply(o.getMode,undefined,[grant]);unlocked();const allowed=apply(o.canExecute,undefined,[grant]);unlocked();if(mode!=='normal'||allowed!==true||!guard.isCurrent()||apply(registryMethods.isCurrent,o.registry,[grant])!==true)fail('DESKTOP_PROVIDERS_SENDER_REFUSED');};
 }
 function pickDirectory(grant,...args){return run(async()=>{
  if(args.length)fail('DESKTOP_PROVIDERS_REFUSED');const current=grantScope(grant);current();const event=apply(registryMethods.eventFor,o.registry,[grant]);const parent=apply(o.parentForWebContents,undefined,[event.sender]);current();if(!parent||types.isProxy(parent)||!['object','function'].includes(typeof parent))fail('DESKTOP_PROVIDERS_SENDER_REFUSED');
  const p=apply(o.showOpenDialog,undefined,[parent,record({properties:Object.freeze(['openDirectory'])})]);if(!supportedProviderPromise(p)){unknown=true;fail('DESKTOP_PROVIDERS_SETTLEMENT_UNKNOWN');}const answer=await p;current();
  const r=data(answer,['canceled','filePaths']);if(!r||typeof r.canceled!=='boolean'||types.isProxy(r.filePaths)||!Array.isArray(r.filePaths)||Object.getPrototypeOf(r.filePaths)!==Array.prototype||r.filePaths.length>2||Reflect.ownKeys(r.filePaths).length!==r.filePaths.length+1)fail('DESKTOP_PROVIDERS_DIALOG_REFUSED');
  const paths=[];for(let i=0;i<r.filePaths.length;i++){const d=Object.getOwnPropertyDescriptor(r.filePaths,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!d.value.isWellFormed()||d.value.length>32768||d.value.includes('\0'))fail('DESKTOP_PROVIDERS_DIALOG_REFUSED');paths.push(d.value);}
  return record({canceled:r.canceled,filePaths:Object.freeze(paths)});
 });}
 function readEnvironment(...args){return run(async()=>{if(args.length)fail('DESKTOP_PROVIDERS_REFUSED');unlocked();const raw=apply(o.readEnvironment,undefined,[]);if(!types.isProxy(raw)&&types.isPromise(raw)){unknown=true;if(supportedProviderPromise(raw))apply(then,raw,[()=>{},()=>{}]);fail('DESKTOP_PROVIDERS_SETTLEMENT_UNKNOWN');}const result=environment(raw,denied);unlocked();return result;});}
 function policy(name,args){try{check();const value=apply(o[name],undefined,args);check();return name==='getMode'?(['normal','readonly','recovery'].includes(value)?value:null):value===true;}catch{return name==='getMode'?null:false;}}
 function providers(value,receipt,...args){
  if(args.length||retired||state!=='idle')return NativePromise.reject(Error('DESKTOP_PROVIDERS_REFUSED'));
  const c=data(value,['registry','projectId','grant']),paths=desktopNativeRuntimeResourcePaths(receipt);let guard;
  try{if(!c||c.registry!==o.registry||c.projectId!==o.projectId||!paths||paths.directory.toLowerCase()!==o.runtimeDirectory.toLowerCase()||apply(registryMethods.isCurrent,o.registry,[c.grant])!==true||c.grant.role!=='workspace'||c.grant.projectId!==o.projectId)throw 0;guard=apply(registryMethods.captureAdmissionGuard,o.registry,[c.grant]);if(!guard)throw 0;}catch{return NativePromise.reject(Error('DESKTOP_PROVIDERS_REFUSED'));}
  context=record(c);resources=receipt;state='loading';
  return run(async()=>{
   let entered=false;try{unlocked();if(!guard.isCurrent())fail('DESKTOP_PROVIDERS_STALE');entered=true;const p=loadDesktopNativeFilesystemProvider({assertResourcesCurrent:()=>{try{unlocked();return true;}catch{return false;}}});if(!supportedProviderPromise(p)){unknown=true;fail('DESKTOP_PROVIDERS_SETTLEMENT_UNKNOWN');}fs=await p;if(retired){retireFilesystem();fail('DESKTOP_PROVIDERS_RETIRED');}unlocked();if(!guard.isCurrent())fail('DESKTOP_PROVIDERS_STALE');state='active';
    return record({cwd:record({pickDirectory,protectedRoots:roots,inspectDirectory:(...args)=>run(()=>query('inspectDirectory',args))}),profiles:record({getSystemDirectory:(...args)=>run(()=>query('getSystemDirectory',args)),inspectExecutable:(...args)=>run(()=>query('inspectExecutable',args)),inspectModuleDirectory:(...args)=>run(()=>query('inspectModuleDirectory',args)),readEnvironment,privateEnvironmentKeys:keys,modulePathPolicy:'system-seeded'}),policy:record({isUnlocked:()=>policy('isUnlocked',[]),getMode:(...args)=>policy('getMode',args),canExecute:(...args)=>policy('canExecute',args)})});
   }catch{if(entered&&!fs){unknown=true;fsSettled=true;}if(!entered)fsSettled=true;retire();fail('DESKTOP_PROVIDERS_START_REFUSED');}
  });
 }
 const snapshot=()=>record({scope:'PRIVATE_MAIN_PROVIDER_BINDING',state,pending,retired,unknown,nativeExecutionAdmitted:false});
 return record({providers,retire,snapshot});
}
