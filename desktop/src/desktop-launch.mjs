// Private fixed launch registration: never exposed over IPC/preload/CLI/environment.
import {types} from 'node:util';
let initializer=null,consumed=false,selected=null,dataPreference=null;
function capturePreference(value){
 if(value===undefined)return null;
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError('Private launch DATA required');
 const keys=Reflect.ownKeys(value),names=['preferredDataRoot','protectedRuntimeRoot'];
 if(keys.length!==2||keys.some(key=>!names.includes(key)))throw TypeError('Closed private launch DATA required');
 const result={};
 for(const key of names){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!d.value.length||d.value.length>32768||!d.value.isWellFormed()||/[\x00-\x1f\x7f]/.test(d.value))throw TypeError('Private launch path DATA required');result[key]=d.value;}
 return Object.freeze(result);
}
export function configureDesktopLaunch(value,preference){
 if(consumed||initializer!==null||typeof value!=='function')throw TypeError('One fixed private initializer required');
 const captured=capturePreference(preference);initializer=value;dataPreference=captured;
}
export function takeDesktopLaunch(){if(consumed)throw TypeError('Desktop launch already consumed');consumed=true;const value=initializer;selected=value;initializer=null;return value;}
export function captureDesktopLaunchDataPreference(value){if(!consumed||value!==selected)throw TypeError('Actual consumed desktop initializer required');return dataPreference;}
