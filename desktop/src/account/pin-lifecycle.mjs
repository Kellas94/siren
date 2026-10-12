// Private MAIN service composition. Production supplies no Terminal authority.
// This module neither creates a native graph nor exposes gate controls to IPC.
import {types} from 'node:util';
import {failure} from '../ipc.mjs';


const apply=Reflect.apply;

const hooks=Object.freeze(['isLockBusy','isUnlockBusy','enterTransition','leaveTransition','isUnlocked','prepareWorkspace','retireViews','rollbackWorkspace','endAccountTransition','activateWorkspace','commitLock','verifyUnlock','afterUnlock','runWhenReady','captureUnlockScope']);
function record(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const result=Object.create(null);for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
}
function code(error){if(!error||!['object','function'].includes(typeof error)||types.isProxy(error))return null;const d=Object.getOwnPropertyDescriptor(error,'code');return d&&Object.hasOwn(d,'value')?d.value:null;}
const busy=()=>failure('PIN_BUSY','Local access is changing.');
const denied=()=>failure('ACCESS_REFUSED','Local access changed. Unlock again before using Terminal.');

export function createPinLifecycleServices(options,...extra){
 const p=record(options);
 if(extra.length||!p||hooks.some(key=>typeof p[key]!=='function'||types.isProxy(p[key]))||Object.keys(p).some(key=>!hooks.includes(key)&&key!=='terminalCoordination'))throw TypeError('Private PIN lifecycle hooks required');
 // These optional closures are trusted MAIN composition, never renderer DATA.
 // Callback shape is not proof of native/access authority; the separate Terminal
 // owner factory performs that genuine brand check and captures actual methods.
 const access=p.terminalCoordination===undefined?null:record(p.terminalCoordination);
 if(p.terminalCoordination!==undefined&&(!access||Object.keys(access).length!==2||['beginLock','reopen'].some(key=>typeof access[key]!=='function'||types.isProxy(access[key]))))throw TypeError('Trusted MAIN coordination hooks required');
 const invoke=(name,...args)=>apply(p[name],undefined,args);
 async function lockPin(){
  if(invoke('isLockBusy'))return busy();
  invoke('enterTransition');
  try{
   if(access){
    // beginLock performs the synchronous manager/router/catalogue fence BEFORE
    // its trusted preparation hook may await PIN/editor drain. Never Stop here.
    const result=record(await apply(access.beginLock,undefined,['Lock']));
    if(result?.ok!==true)throw Error('Terminal access transition refused');
   }else{
    await invoke('prepareWorkspace');
    await invoke('retireViews');
   }
   invoke('commitLock');return {ok:true};
  }catch(error){
   await invoke('rollbackWorkspace');
   await invoke('endAccountTransition');
   if(code(error)==='WINDOW_DESTROY_FAILED')return failure('WINDOW_DESTROY_FAILED','SIREN could not protect every native window. Lock was not confirmed; your project was retained.');
   return failure('SAVE_FAILED','SIREN could not confirm your local changes. The workspace remains open.');
  }finally{
   invoke('leaveTransition');
   if(invoke('isUnlocked')){try{invoke('activateWorkspace');}catch{/* Existing native failure remains fenced. */}}
  }
 }
 async function unlockPin(payload){
  if(invoke('isUnlockBusy'))return Promise.resolve(busy());
  return invoke('runWhenReady',async()=>{
   if(invoke('isUnlockBusy'))return busy();
   // Default production behavior is unchanged. Optional Terminal composition
   // additionally captures selection/frame scope before PIN verification.
   const scope=access?record(invoke('captureUnlockScope')):null;
   if(access&&(!scope||Object.keys(scope).length!==2||!scope.event||typeof scope.isCurrent!=='function'||types.isProxy(scope.isCurrent)))return denied();
   const current=()=>{try{return !invoke('isUnlockBusy')&&apply(scope.isCurrent,undefined,[])===true;}catch{return false;}};
   const result=await invoke('verifyUnlock',payload);
   if(access&&record(result)?.ok===true&&!current())return denied();
   const prepared=await invoke('afterUnlock',result);
   if(!access||record(result)?.ok!==true)return prepared;
   if(!invoke('isUnlocked')||!current())return denied();
   // Existing coordinator rolls back editor preparation, captures a genuine
   // fresh registry grant, and requires correlated OPEN before router publish.
   const reopened=record(await apply(access.reopen,undefined,[scope.event]));
   if(reopened?.ok!==true)return denied();
   if(!current()){
    // A final private selection/frame check can fail after OPEN settlement.
    // Reuse the sole coordinator to synchronously fence that authority again.
    await apply(access.beginLock,undefined,['PIN continuation changed']);
    return denied();
   }
   return prepared;
  });
 }
 return Object.freeze({lockPin,unlockPin});
}
