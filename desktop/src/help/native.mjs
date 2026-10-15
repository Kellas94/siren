// Main-only navigation. No renderer arguments, filesystem API or execution action.
import {types} from 'node:util';
// Sanitized observation, not OS-policy attestation. Never forward loader paths,
// messages or stacks to the renderer; unrelated DLL failures stay unknown.
export function classifyNativeTerminalLoadError(error){
 try{
  if(!error||typeof error!=='object'||types.isProxy(error))return null;
  const code=Object.getOwnPropertyDescriptor(error,'code'),message=Object.getOwnPropertyDescriptor(error,'message');
  if(!code||!message||!Object.hasOwn(code,'value')||!Object.hasOwn(message,'value')||code.value!=='ERR_DLOPEN_FAILED'||typeof message.value!=='string'||message.value.length>16384)return null;
  const text=message.value,prefix='An Application Control policy has blocked this file.';
  if(text!==prefix&&!text.startsWith(prefix+'\r\n')&&!text.startsWith(prefix+'\n'))return null;
  return Object.freeze({namespace:'terminal',operation:'native-load',code:'NATIVE_APPLICATION_CONTROL_REFUSED'});
 }catch{return null;}
}
export function handleNativeHelpInput({event,input,originWindow,dispatch}={}){
 if(!input||input.type!=='keyDown'||input.key!=='F1'||input.control||input.alt||input.shift||input.meta||input.isComposing||typeof dispatch!=='function'||typeof event?.preventDefault!=='function')return false;
 event.preventDefault();if(!input.isAutoRepeat)dispatch(originWindow);return true;
}
export function dispatchNativeHelp({mainWindow,originWindow,windowFor,selectedSurface,capture,isCurrent,canRead}={}){
 try{
  if(typeof canRead!=='function'||canRead()!==true||typeof capture!=='function'||typeof isCurrent!=='function')return false;
  let target=originWindow??mainWindow;
  if(target===mainWindow&&typeof selectedSurface==='function'){const id=selectedSurface();if(id){if(typeof windowFor!=='function')return false;target=windowFor(id);}}
  if(!target||target.isDestroyed()||!target.webContents||target.webContents.isDestroyed?.()===true)return false;
  const sender=target.webContents,frame=sender.mainFrame;if(!frame)return false;
  const grant=capture({sender,senderFrame:frame});
  if(!grant||!['workspace','code','docs','diagram','presenter','terminal'].includes(grant.role)||isCurrent(grant)!==true||canRead()!==true||sender!==target.webContents||frame!==sender.mainFrame)return false;
  sender.send('siren:command','desktopHelpDiagnostics');return true;
 }catch{return false;}
}

// Read authority is independent of Terminal execution availability. This is a
// trusted MAIN adapter; the renderer cannot supply a registry or native window.
export function captureTerminalHelpContext({event,args=[],registry,canRead,windowFor}={}){
 const refused=()=>Object.freeze({ok:false,code:'ACCESS_REFUSED'});
 try{
  if(!Array.isArray(args)||types.isProxy(args)||args.length||!event||types.isProxy(event)||typeof canRead!=='function'||typeof windowFor!=='function'||canRead()!==true)return refused();
  const grant=registry?.capture(event);
  if(grant?.role!=='terminal'||typeof grant.windowId!=='string'||typeof grant.projectId!=='string'||!Number.isSafeInteger(grant.epoch)||grant.epoch<1)return refused();
  const admission=registry.captureAdmissionGuard(grant),view=windowFor(grant.windowId),sender=event.sender,frame=event.senderFrame;
  if(!admission||!view||view.isDestroyed()||view.webContents!==sender||sender.isDestroyed()||sender.mainFrame!==frame||!registry.isCurrent(grant)||!admission.isCurrent()||canRead()!==true)return refused();
  if(view.isDestroyed()||view.webContents!==sender||sender.isDestroyed()||sender.mainFrame!==frame||!registry.isCurrent(grant)||!admission.isCurrent())return refused();
  return Object.freeze({ok:true,readable:true,role:'terminal',windowId:grant.windowId,projectId:grant.projectId,epoch:grant.epoch});
 }catch{return refused();}
}
