// Pure preparation for one trusted, system PowerShell profile. No environment
// reads, filesystem identity checks, module loading, shell or native execution.
import {win32 as path} from 'node:path';
import {types} from 'node:util';
const refused=()=>{throw TypeError('SHELL_ENVIRONMENT_REFUSED');};
const creatorKeys=Object.freeze(['COMSPEC','ELECTRON_RUN_AS_NODE','PATH','SYSTEMROOT','TEMP','TMP','WINDIR']);
function dataRecord(value,count){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return refused();
 const keys=Reflect.ownKeys(value);if(keys.length!==count||keys.some(k=>typeof k!=='string'))return refused();
 const result=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return refused();result[key]=d.value;}
 return result;
}
function fixedPath(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.length<4||value.length>32767||!/^([A-Za-z]):\\/.test(value)||/[\x00-\x1f\x7f/"<>|?*;]/.test(value)||value.slice(2).includes(':')||value.endsWith('\\')||path.normalize(value)!==value)return refused();
 for(const segment of value.slice(3).split('\\'))if(!segment||segment==='.'||segment==='..'||/[ .]$/.test(segment)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(segment))return refused();
 return value;
}
const samePath=(actual,expected)=>fixedPath(actual).toLowerCase()===expected.toLowerCase();
export function createSystemPowerShellEnvironment(request){
 const args=dataRecord(request,3);if(Object.keys(args).some(k=>!['environment','shell','cwd'].includes(k)))return refused();
 const supplied=dataRecord(args.environment,7),env=Object.create(null);
 for(const [key,value] of Object.entries(supplied)){
  if(!/^[A-Za-z_]+$/.test(key)||!creatorKeys.includes(key.toUpperCase())||Object.hasOwn(env,key.toUpperCase())||typeof value!=='string'||!value.isWellFormed()||value.includes('\0'))return refused();
  env[key.toUpperCase()]=value;
 }
 if(creatorKeys.some(k=>!Object.hasOwn(env,k))||env.ELECTRON_RUN_AS_NODE!=='1')return refused();
 const root=fixedPath(env.SYSTEMROOT),cwd=fixedPath(args.cwd),shell=fixedPath(args.shell),system=path.join(root,'System32'),expectedShell=path.join(system,'WindowsPowerShell','v1.0','powershell.exe');
 if(!samePath(shell,expectedShell)||!samePath(env.COMSPEC,path.join(system,'cmd.exe'))||env.PATH.toLowerCase()!==(system+';'+root).toLowerCase()||!samePath(env.WINDIR,root)||!samePath(env.TEMP,cwd)||!samePath(env.TMP,cwd))return refused();
 const result={COMSPEC:path.join(system,'cmd.exe'),PATH:system+';'+root,SYSTEMROOT:root,TEMP:cwd,TMP:cwd,WINDIR:root,PSModulePath:path.join(path.dirname(shell),'Modules')};
 // Windows environment blocks include each key=value NUL and a final NUL.
 if(1+Object.entries(result).reduce((n,[key,value])=>n+key.length+value.length+2,0)>65536)return refused();
 return Object.freeze(result);
}
