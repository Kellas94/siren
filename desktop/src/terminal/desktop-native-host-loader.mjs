// Private MAIN fixed host addon loader. Import-inert; never creates a host.
// Cache identity and configured-tree DATA do not prove OS loader dependencies.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
import {desktopNativeRuntimeResourcePaths,recheckDesktopNativeRuntimeResources} from './desktop-native-runtime-resources.mjs';
import {recheckDesktopNativeOwnedTree} from './desktop-native-owned-tree.mjs';
const requireNative=createRequire(import.meta.url),apply=Reflect.apply;
const directory=fileURLToPath(new URL('../../../',import.meta.url)).replace(/[\\/]$/,''),nativePath=fileURLToPath(new URL('../../native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node',import.meta.url));
const names=Object.freeze(['start','snapshot','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync','stopAndCloseHostAsync','captureHostShutdownPeerRoster','captureHostShutdownExpectation']);
const frozen=v=>Object.freeze(Object.assign(Object.create(null),v));
function fail(code='HOST_LOADER_REFUSED'){throw Error(code);}
function own(value,key){if(!value||types.isProxy(value)||!['object','function'].includes(typeof value))return null;const d=Object.getOwnPropertyDescriptor(value,key);return d&&Object.hasOwn(d,'value')?d:null;}
function exact(value,keys){if(!value||types.isProxy(value)||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const keysActual=Reflect.ownKeys(value);if(keysActual.length!==keys.length||keysActual.some(k=>!keys.includes(k)))return null;const out=Object.create(null);for(const k of keys){const d=own(value,k);if(!d?.enumerable)return null;out[k]=d.value;}return out;}
export function createDesktopNativeHostLoader(options,...extra){
 const o=exact(options,['resources','ownedTree']);if(extra.length||!o)fail();
 let state='idle',loaded=null,raw=null,captured=null,cache=null,record=null;
 const snapshot=()=>frozen({state,configuredTreeVerified:state==='ready',hostAddonCacheVerified:state==='ready',completeRuntimeClosure:false,loadedModuleProvenanceVerified:false,nativeExecutionAdmitted:false});
 function environment(){
  const p=desktopNativeRuntimeResourcePaths(o.resources);
  return p?.directory===directory&&process.platform==='win32'&&process.arch==='x64'&&process.type==='browser'&&process.versions.electron==='44.9.3'&&process.versions.modules==='149'&&process.versions.napi==='10'&&process.execPath===p.executable;
 }
 function cacheCurrent(){
  try{
   if(!cache||requireNative.cache!==cache||types.isProxy(cache)||own(cache,nativePath)?.value!==record||own(record,'exports')?.value!==raw||own(record,'filename')?.value!==nativePath||own(record,'loaded')?.value!==true)return false;
   const keys=Reflect.ownKeys(raw);if(keys.length!==captured.size)return false;
   for(const [key,value] of captured)if(own(raw,key)?.value!==value)return false;
   for(const key of Reflect.ownKeys(cache)){
    if(typeof key!=='string')return false;
    if(key.toLowerCase()===nativePath.toLowerCase()&&key!==nativePath)return false;
    const row=own(cache,key)?.value,filename=own(row,'filename')?.value;
    if(key!==nativePath&&(own(row,'exports')?.value===raw||typeof filename==='string'&&filename.toLowerCase()===nativePath.toLowerCase()))return false;
   }
   return true;
  }catch{return false;}
 }
 function isCurrent(...args){if(args.length||state!=='ready')return false;if(!environment()||!cacheCurrent()){state='invalid';return false;}return true;}
 function assertCurrent(){if(!isCurrent())fail('HOST_LOADER_STALE');}
 async function checkTree(){return await recheckDesktopNativeRuntimeResources(o.resources)&&await recheckDesktopNativeOwnedTree(o.resources,o.ownedTree)&&await recheckDesktopNativeRuntimeResources(o.resources);}
 async function load(...args){
  if(args.length||state!=='idle')fail('HOST_LOADER_BUSY');state='loading';
  try{
   if(!environment()||!await checkTree()||!environment())fail('HOST_LOADER_RESOURCE_REFUSED');
   cache=requireNative.cache;if(!cache||types.isProxy(cache)||Reflect.ownKeys(cache).some(k=>{if(typeof k!=='string'||k.toLowerCase()===nativePath.toLowerCase())return true;const filename=own(own(cache,k)?.value,'filename')?.value;return typeof filename==='string'&&filename.toLowerCase()===nativePath.toLowerCase();}))fail('HOST_LOADER_CACHE_REFUSED');
   raw=requireNative(nativePath);record=own(cache,nativePath)?.value;
   if(!raw||types.isProxy(raw)||typeof raw!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(raw)))fail();
   captured=new Map();for(const key of Reflect.ownKeys(raw)){const d=own(raw,key);if(typeof key!=='string'||!d||typeof d.value!=='function'||types.isProxy(d.value))fail();captured.set(key,d.value);}
   for(const key of [...names,'mark'])if(!captured.has(key))fail();
   if(!cacheCurrent()||!environment()||!await checkTree()||!cacheCurrent()||!environment())fail('HOST_LOADER_RESOURCE_REFUSED');
   const native=Object.create(null);for(const key of names)native[key]=(...args)=>{assertCurrent();return apply(captured.get(key),raw,args);};
   loaded=frozen({native:frozen(native),mark:(...args)=>{assertCurrent();if(args.length)fail();return apply(captured.get('mark'),raw,[]);},isCurrent,snapshot});state='ready';return loaded;
  }catch(error){state='invalid';throw error;}
 }
 async function recheck(...args){
  if(args.length||!isCurrent())return false;
  // Refuse use during the asynchronous DATA recheck; no stale ready window.
  state='checking';try{if(!environment()||!cacheCurrent()||!await checkTree()||!environment()||!cacheCurrent())throw Error();state='ready';return true;}catch{state='invalid';return false;}
 }
 return frozen({load,recheck,isCurrent,snapshot});
}
