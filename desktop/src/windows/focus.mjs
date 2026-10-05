/** Main-only focus operations. Roster metadata does not grant access: every
 * candidate must retain its actual registered frame, then focusView rechecks
 * native policy. These synchronous operations never open, navigate or save. */
export class NativeWindowFocus{
 #registry;#main;#windowFor;#focused;#canCycle;
 constructor({registry,mainWindow,windowFor,focusedWindow,canCycle}){
  if(!['listViews','capture','focusView'].every(k=>typeof registry?.[k]==='function')||!mainWindow||![windowFor,focusedWindow,canCycle].every(fn=>typeof fn==='function'))throw TypeError('NATIVE_FOCUS_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#main=mainWindow;this.#windowFor=windowFor;this.#focused=focusedWindow;this.#canCycle=canCycle;
 }
 showMain(){
  try{if(this.#main.isDestroyed())return false;
    if(this.#registry.showWorkspace?.()===true)return true;
    if(this.#main.isMinimized())this.#main.restore();this.#main.focus();return true;}catch{return false;}
 }
 cycle(direction,originWindow){
  if(direction!==1&&direction!==-1)return false;
  try{
   if(this.#canCycle()!==true)return false;
   const rows=[];
   for(const view of this.#registry.listViews().slice(0,64)){
    const native=view.role==='workspace'?this.#main:this.#windowFor(view.windowId);
    if(!native||native.isDestroyed())continue;
    const grant=this.#registry.capture({sender:native.webContents,senderFrame:native.webContents.mainFrame});
    if(grant?.windowId===view.windowId&&grant.projectId===view.projectId)rows.push({view,native});
   }
   if(!rows.length||this.#canCycle()!==true)return false;
   let origin=originWindow??this.#focused();
   if(origin===this.#main){const selected=this.#registry.surfaceRecords?.().find(row=>row.selected);if(selected)origin=this.#windowFor(selected.windowId);}
   const at=rows.findIndex(row=>row.native===origin);
   if(originWindow!==undefined&&at<0)return false;
   const next=at<0?(direction===1?0:rows.length-1):(at+direction+rows.length)%rows.length;
   return this.#registry.focusView(rows[next].view.windowId)===true;
  }catch{return false;}
 }
 transfer(method,originWindow){
  if(!['attach','detach'].includes(method))return false;
  try{
   if(this.#canCycle()!==true)return false;
   const origin=originWindow??this.#focused();let grant;
   if(origin===this.#main){const selected=this.#registry.surfaceRecords?.().find(row=>row.selected);if(selected){const w=this.#windowFor(selected.windowId);grant=this.#registry.capture({sender:w?.webContents,senderFrame:w?.webContents.mainFrame});}}
   else grant=this.#registry.capture({sender:origin?.webContents,senderFrame:origin?.webContents.mainFrame});
   return !!grant&&['code','docs'].includes(grant.role)&&this.#registry[method==='attach'?'attachView':'detachView']?.(grant.windowId)===true;
  }catch{return false;}
 }
}

/** Actual Electron input route. preventDefault suppresses both the page event
 * and its menu accelerator, so a physical key press cannot cycle twice. */
export function bindNativeWindowFocusKeys(nativeWindow,focus,layout){
 nativeWindow.webContents.on('before-input-event',(event,input)=>{
  if(input.type!=='keyDown'||!input.control||!input.alt||input.shift||input.meta||input.isComposing)return;
  const action=input.key==='1'?'main':input.key==='ArrowRight'?1:input.key==='ArrowLeft'?-1:layout&&['b','B'].includes(input.key)?'bring-back':['a','A'].includes(input.key)?'attach':['d','D'].includes(input.key)?'detach':null;
  if(action===null)return;
  event.preventDefault();if(input.isAutoRepeat)return;
  if(action==='main')focus.showMain();else if(action==='bring-back')layout.bringAllBack(nativeWindow);else if(action==='attach'||action==='detach')focus.transfer(action,nativeWindow);else focus.cycle(action,nativeWindow);
 });
}
