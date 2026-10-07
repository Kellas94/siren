// Main-only navigation. No renderer arguments, filesystem API or execution action.
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
  if(!grant||!['workspace','code','docs','diagram','presenter'].includes(grant.role)||isCurrent(grant)!==true||canRead()!==true||sender!==target.webContents||frame!==sender.mainFrame)return false;
  sender.send('siren:command','desktopHelpDiagnostics');return true;
 }catch{return false;}
}
