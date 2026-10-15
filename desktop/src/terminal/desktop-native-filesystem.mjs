import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';

// Import-inert candidate only. The prerequisite is a captured TRUSTED MAIN
// complete-resource/current-authority guard, never renderer DATA or proof from
// callback shape. No default loader, environment discovery or native admission.
const nativePath=fileURLToPath(new URL('../../native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node',import.meta.url));
const requireNative=createRequire(import.meta.url);
const NativePromise=Promise,promiseThen=Promise.prototype.then,promiseSpecies=Object.getOwnPropertyDescriptor(Promise,Symbol.species);
const fail=code=>{throw Error(code);};
const safeCodes=new Set(['FS_ARGUMENT_REFUSED','FS_CAPACITY','FS_RETIRED','FS_OPEN_FAILED','FS_REPARSE_REFUSED','FS_TYPE_REFUSED','FS_CANONICAL_REFUSED','FS_IDENTITY_FAILED','FS_CHANGED','FS_SYSTEM_DIRECTORY_FAILED','FS_INTERNAL']);
function safeError(error){const d=error&&!types.isProxy(error)&&['object','function'].includes(typeof error)?Object.getOwnPropertyDescriptor(error,'code'):null;return Error(d&&Object.hasOwn(d,'value')&&safeCodes.has(d.value)?d.value:'FS_NATIVE_REFUSED');}
function fields(value,keys,guard=false){
 if(!value||types.isProxy(value)||typeof value!=='object')fail('FS_NATIVE_REFUSED');
 const names=Reflect.ownKeys(value);if(names.length!==keys.length+(guard?1:0)||names.some(k=>typeof k!=='string'||!keys.includes(k)&&!(guard&&k==='then')))fail('FS_NATIVE_REFUSED');
 if(guard){const d=Object.getOwnPropertyDescriptor(value,'then');if(!d||!Object.hasOwn(d,'value')||d.value!==undefined||d.enumerable||d.configurable||d.writable)fail('FS_NATIVE_REFUSED');}
 const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('FS_NATIVE_REFUSED');out[key]=d.value;}return out;
}
const nativePathString=v=>{
 if(typeof v!=='string'||v.length<3||v.length>32763||!v.isWellFormed()||! /^[A-Za-z]:\\/.test(v)||/[\x00-\x1f\x7f-\x9f/<>"|?*~]/.test(v)||v.slice(2).includes(':'))return false;
 return v.length===3||v.slice(3).split('\\').every(s=>s.length>0&&s!=='.'&&s!=='..'&&!/[ .]$/.test(s)&&!/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(s));
};
const nativeIdentity=v=>typeof v==='string'&&/^[0-9a-f]{16}:[0-9a-f]{32}$/.test(v);
function snapshot(value,kind){
 const out=fields(value,['canonicalPath','identity',kind,'reparse','ancestors'],true);
 if(!nativePathString(out.canonicalPath)||!nativeIdentity(out.identity)||out[kind]!==true||out.reparse!==false)fail('FS_NATIVE_REFUSED');
 const rows=out.ancestors;if(!rows||types.isProxy(rows)||!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype)fail('FS_NATIVE_REFUSED');
 const length=Object.getOwnPropertyDescriptor(rows,'length')?.value;if(!Number.isSafeInteger(length)||length<1||length>128||Reflect.ownKeys(rows).length!==length+1)fail('FS_NATIVE_REFUSED');
 const entries=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(rows,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('FS_NATIVE_REFUSED');const row=fields(d.value,['path','identity','directory','reparse']);if(!nativePathString(row.path)||!nativeIdentity(row.identity)||row.directory!==true||row.reparse!==false)fail('FS_NATIVE_REFUSED');entries.push(Object.freeze(row));}
 out.ancestors=Object.freeze(entries);return Object.freeze(out);
}
function retirementData(value){const out=fields(value,['retired','actualSettled','pending'],true);if(out.retired!==true||out.actualSettled!==true||out.pending!==0)fail('FS_RETIREMENT_UNKNOWN');return Object.freeze(out);}
function own(value,key){
 if(!value||types.isProxy(value)||!['object','function'].includes(typeof value))return null;
 const d=Object.getOwnPropertyDescriptor(value,key);
 return d&&Object.hasOwn(d,'value')&&typeof d.value==='function'&&!types.isProxy(d.value)?d.value:null;
}
function prerequisite(options){
 if(!options||types.isProxy(options)||typeof options!=='object'||Reflect.ownKeys(options).length!==1)return null;
 return own(options,'assertResourcesCurrent');
}
// No caller path, loader, source selector, fallback or injected native instance.
export async function loadDesktopNativeFilesystemProvider(options,...extra){
 const guard=extra.length?null:prerequisite(options);
 function current(){if(!guard)fail('FS_RESOURCE_REFUSED');let v;try{v=guard();}catch{fail('FS_RESOURCE_REFUSED');}if(v!==true)fail('FS_RESOURCE_REFUSED');}
 current();let addon,instance;
 try{addon=requireNative(nativePath);}catch{fail('FS_NATIVE_UNAVAILABLE');}
 current();const factory=own(addon,'createFilesystemInspector');if(!factory||Reflect.ownKeys(addon).length!==1)fail('FS_NATIVE_REFUSED');
 try{instance=Reflect.apply(factory,addon,[]);}catch{fail('FS_NATIVE_REFUSED');}
 const methods={};for(const key of ['getSystemDirectory','inspectDirectory','inspectFile','retire'])methods[key]=own(instance,key);
 let retired=false,retirementStarted=false,resolveRetirement,rejectRetirement;
 // Allocate while the adapter is unpublished: Promise-init hook reentry during
 // later retirement cannot create a second lifetime or duplicate native retire.
 const retirement=new NativePromise((resolve,reject)=>{resolveRetirement=resolve;rejectRetirement=reject;});
 // Native promise is required; Promise.prototype.then bypasses instance hooks.
 const settled=(value,transform)=>{
  const constructor=Object.getOwnPropertyDescriptor(NativePromise.prototype,'constructor'),species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
  if(types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==NativePromise.prototype||Object.hasOwn(value,'constructor')||!constructor||!Object.hasOwn(constructor,'value')||constructor.value!==NativePromise||!species||Object.hasOwn(species,'value')||!Object.hasOwn(species,'get')||!Object.hasOwn(species,'set')||species.get!==promiseSpecies.get||species.set!==promiseSpecies.set)fail('FS_NATIVE_REFUSED');
  return Reflect.apply(promiseThen,value,[transform,e=>{throw safeError(e);}]);
 };
 function retire(...extra){
  if(extra.length)return new NativePromise((_,reject)=>reject(Error('FS_ARGUMENT_REFUSED')));
  if(retirementStarted)return retirement;retirementStarted=true;retired=true;
  // Reserve before calling a native method (even conditional hostile stubs).
  try{if(!methods.retire)fail('FS_NATIVE_REFUSED');Reflect.apply(promiseThen,settled(Reflect.apply(methods.retire,instance,[]),retirementData),[resolveRetirement,()=>rejectRetirement(Error('FS_RETIREMENT_UNKNOWN'))]);}catch{rejectRetirement(Error('FS_RETIREMENT_UNKNOWN'));}
  return retirement;
 }
 try{if(Object.values(methods).some(v=>!v)||Reflect.ownKeys(instance).length!==4)fail('FS_NATIVE_REFUSED');current();}catch(error){await retire();throw error;}
 async function query(name,args){
  if(retired)fail('FS_RETIRED');current();if(retired)fail('FS_RETIRED');
  let returned;try{returned=Reflect.apply(methods[name],instance,args);}catch(error){throw safeError(error);}
  let pending;try{pending=settled(returned,value=>{if(name==='getSystemDirectory'){if(!nativePathString(value))fail('FS_NATIVE_REFUSED');return value;}return snapshot(value,name==='inspectFile'?'file':'directory');});}catch{fail('FS_NATIVE_REFUSED');}
  const value=await pending;if(retired)fail('FS_RETIRED');current();if(retired)fail('FS_RETIRED');return value;
 }
 return Object.freeze(Object.assign(Object.create(null),{
  nativeExecutionAdmitted:false,
  getSystemDirectory:(...args)=>query('getSystemDirectory',args),
  inspectDirectory:(...args)=>query('inspectDirectory',args),
  inspectExecutable:(...args)=>query('inspectFile',args),
  inspectModuleDirectory:(...args)=>query('inspectDirectory',args),
  retire,
 }));
}
