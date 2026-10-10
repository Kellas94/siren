import {types} from 'node:util';
import {createProviderLifetime,providerMethod} from './provider-lifetime.mjs';
import {win32 as path} from 'node:path';

// Pure catalogue only. No OS discovery, process.env, fs, shell/PTY or Electron
// defaults. Main binds authorize(method) and captureAdmission(method) to one
// real native request; callers never supply executable, argv or environment.
// getSystemDirectory() supplies a trusted native Windows system directory.
// inspectExecutable(path) supplies DATA {canonicalPath,identity,file:true,
// reparse:false,ancestors:[{path,identity,directory:true,reparse:false},...]},
// covering every directory from drive root to executable parent. Native file
// identity/reparse provenance remains the future adapter's responsibility.
// PSModulePath is omitted explicitly rather than retaining app-injected module
// locations or replacing it with a guessed OS path. This may affect inherited
// custom module search paths; actual shell behavior requires later qualification.
class Refusal extends Error{constructor(code){super(code);this.code=code;}}
const refuse=code=>{throw new Refusal(code);};
function data(value){
 try{
 if(!value||types.isProxy(value)||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const result=Object.create(null);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
 }catch{return null;}
}
function array(value,max){try{if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)return null;const result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result.push(d.value);}return result;}catch{return null;}}
function localPath(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.length>32768||! /^[A-Za-z]:[\\/]/.test(value)||/[\x00-\x1f\x7f<>"|?*]/.test(value)||value.slice(2).includes(':'))return null;
 if(value.slice(3).split(/[\\/]/).filter(Boolean).some(p=>p!=='.'&&p!=='..'&&(/[ .]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(p))))return null;
 const normalized=path.normalize(value.replaceAll('/','\\'));return normalized.length>3&&normalized.endsWith('\\')?normalized.slice(0,-1):normalized;
}
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=256&&v.isWellFormed()&&!/[\x00-\x1f\x7f]/.test(v);
function evidence(value,requested){
 const v=data(value),canonical=v&&localPath(v.canonicalPath),parents=v&&array(v.ancestors,128);
 if(!v||Object.keys(v).sort().join(',')!=='ancestors,canonicalPath,file,identity,reparse'||!canonical||canonical.toLowerCase()!==requested.toLowerCase()||v.file!==true||v.reparse!==false||!identity(v.identity)||!parents||parents.length===0)refuse('PROFILE_UNAVAILABLE');
 const parent=path.dirname(requested),root=path.parse(parent).root,parts=parent.slice(root.length).split('\\').filter(Boolean);
 if(parts.length+1!==parents.length)refuse('PROFILE_UNAVAILABLE');
 const expected=[root,...parts.map((_,i)=>path.join(root,...parts.slice(0,i+1)))];
 const entries=parents.map((p,i)=>{const d=data(p),name=d&&localPath(d.path);if(!d||Object.keys(d).sort().join(',')!=='directory,identity,path,reparse'||!name||name.toLowerCase()!==expected[i].toLowerCase()||d.directory!==true||d.reparse!==false||!identity(d.identity))refuse('PROFILE_UNAVAILABLE');return [name.toLowerCase(),d.identity];});
 return Object.freeze({executable:canonical,signature:JSON.stringify([canonical.toLowerCase(),v.identity,entries])});
}
const keySyntax=/^[A-Za-z_][A-Za-z0-9_()]{0,127}$/;
function environment(value,privateKeys){
 const snapshot=data(value);if(!snapshot||!privateKeys||Object.keys(snapshot).length>512)refuse('PROFILE_UNAVAILABLE');
 const seen=new Set(),result=Object.create(null);let bytes=0;
 for(const [key,val] of Object.entries(snapshot)){
  const upper=key.toUpperCase();if(!keySyntax.test(key)||seen.has(upper)||typeof val!=='string'||!val.isWellFormed()||val.length>32768||val.includes('\0'))refuse('PROFILE_UNAVAILABLE');seen.add(upper);
  bytes+=Buffer.byteLength(key,'utf8')+Buffer.byteLength(val,'utf8')+2;if(bytes>256*1024)refuse('PROFILE_UNAVAILABLE');
  if(/^(?:NODE_|ELECTRON_|VSCODE_|SIREN_)/i.test(key)||['CHROME_LOG_FILE','PSMODULEPATH'].includes(upper)||privateKeys.has(upper))continue;
  result[key]=val;
 }
 if(!Object.entries(result).some(([k,v])=>k.toUpperCase()==='SYSTEMROOT'&&v)||!Object.entries(result).some(([k,v])=>k.toUpperCase()==='PATH'&&v))refuse('PROFILE_UNAVAILABLE');
 return Object.freeze(result);
}
const profile=available=>Object.freeze([Object.freeze({profileId:'powershell',label:'Windows PowerShell',available})]);
const lifetimes=new WeakMap();
export function captureShellProfileSettlement(catalogue,...extra){return extra.length?null:lifetimes.get(catalogue)?.handle??null;}
export function retireShellProfileCatalogue(catalogue,...extra){return extra.length?null:lifetimes.get(catalogue)?.retire()??null;}
export function createShellProfileCatalogue({getSystemDirectory,inspectExecutable,readEnvironment,authorize,captureAdmission,privateEnvironmentKeys=[],maxPending=8}={}){
 if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>8)throw TypeError('Bounded profile limits required');
 getSystemDirectory=typeof getSystemDirectory==='function'&&!types.isProxy(getSystemDirectory)?getSystemDirectory:null;
 inspectExecutable=typeof inspectExecutable==='function'&&!types.isProxy(inspectExecutable)?inspectExecutable:null;
 readEnvironment=typeof readEnvironment==='function'&&!types.isProxy(readEnvironment)?readEnvironment:null;
 const keys=array(privateEnvironmentKeys,128),privateKeys=keys&&keys.every(k=>typeof k==='string'&&keySyntax.test(k))?new Set(keys.map(k=>k.toUpperCase())):null;
 let generation=Symbol(),disposed=false,pinned=null;
 const life=createProviderLifetime({scope:'SHELL_PROFILE_CATALOGUE',maxPending,refuse,onComplete:()=>{getSystemDirectory=inspectExecutable=readEnvironment=authorize=captureAdmission=null;pinned=null;}});
 function current(scope){try{if(!disposed&&!scope.cell.unknown&&scope.generation===generation&&life.sync(scope.cell,authorize,scope.method)===true&&!disposed&&scope.generation===generation&&life.sync(scope.cell,scope.isCurrent)===true&&!disposed&&!scope.cell.unknown&&scope.generation===generation)return;}catch{/* Refuse failed authority. */}refuse('SENDER_REFUSED');}
 function begin(cell,method){let scope;try{const captured=generation;if(disposed||life.sync(cell,authorize,method)!==true||disposed||captured!==generation)refuse('SENDER_REFUSED');scope={cell,method,generation:captured,isCurrent:providerMethod(life.sync(cell,captureAdmission,method),'isCurrent')};}catch{refuse('SENDER_REFUSED');}current(scope);return scope;}
 function step(scope,fn){return life.step(scope.cell,()=>current(scope),fn,'PROFILE_UNAVAILABLE');}
 async function inspect(scope,executable){return evidence((await step(scope,()=>{if(typeof inspectExecutable!=='function')refuse('PROFILE_UNAVAILABLE');return inspectExecutable(executable);})).value,executable);}
 async function discover(scope){
  const directory=localPath((await step(scope,()=>{if(typeof getSystemDirectory!=='function')refuse('PROFILE_UNAVAILABLE');return getSystemDirectory();})).value);
  if(!directory)refuse('PROFILE_UNAVAILABLE');
  const resolved=await inspect(scope,path.join(directory,'WindowsPowerShell','v1.0','powershell.exe'));
  if(pinned&&pinned.signature!==resolved.signature)refuse('PROFILE_UNAVAILABLE');current(scope);pinned??=resolved;return resolved;
 }
 const catalogue={
  listShellProfiles(...args){return life.run(async cell=>{if(args.length)refuse('REQUEST_REFUSED');const scope=begin(cell,'terminalListProfiles');try{await discover(scope);current(scope);return profile(true);}catch(e){if(!cell.unknown)current(scope);if(e instanceof Refusal&&e.code==='PROFILE_UNAVAILABLE')return profile(false);throw e;}});},
  resolveShellProfile(profileId,...args){return life.run(async cell=>{if(args.length)refuse('REQUEST_REFUSED');const scope=begin(cell,'terminalCreate');
   if(profileId!=='powershell')refuse('PROFILE_UNAVAILABLE');const resolved=await discover(scope);
   const env=environment((await step(scope,()=>{if(typeof readEnvironment!=='function')refuse('PROFILE_UNAVAILABLE');return readEnvironment();})).value,privateKeys);
   const final=await inspect(scope,resolved.executable);if(final.signature!==resolved.signature)refuse('PROFILE_UNAVAILABLE');current(scope);
   return Object.freeze({executable:resolved.executable,args:Object.freeze(['-NoLogo','-NoProfile']),env});
  });},
  revoke(){generation=Symbol();pinned=null;},
  dispose(){disposed=true;catalogue.revoke();life.retire();},
 };
 lifetimes.set(catalogue,{handle:life.handle,retire:()=>{catalogue.dispose();return life.handle;}});return Object.freeze(catalogue);
}
// Approved zero-argument list and profile-id resolver remain safe unconfigured.
// Main creates a private catalogue with request-bound providers for integration.
const unconfigured=createShellProfileCatalogue();
export const listShellProfiles=()=>unconfigured.listShellProfiles();
export const resolveShellProfile=profileId=>unconfigured.resolveShellProfile(profileId);
