import {setTimeout as nativePause} from 'node:timers/promises';
import {restoreBounds} from './geometry.mjs';
const equalBounds=(a,b)=>['x','y','width','height'].every(k=>a[k]===b[k]);
function controlsReachable(bounds,displays){
 const width=Math.min(160,bounds.width),height=Math.min(32,bounds.height),x=bounds.x+bounds.width-width;
 return displays.some(({workArea:a})=>x>=a.x&&bounds.y>=a.y&&x+width<=a.x+a.width&&bounds.y+height<=a.y+a.height);
}
/** Geometry only, owned by main. Native setters are requests: completion is
 * established by bounded readbacks across native turns, never by setter return.
 * No project/source state, renderer IPC, navigation or persistence is involved. */
export class NativeWindowLayout{
 #registry;#main;#windowFor;#displays;#canRecover;#minimum=new WeakMap();
 #active=null;#pending=false;#generation=0;#disposed=false;
 constructor({registry,mainWindow,windowFor,displays,canRecoverViews}){
  if(!['listViews','capture','isCurrent'].every(k=>typeof registry?.[k]==='function')||!mainWindow||![windowFor,displays,canRecoverViews].every(fn=>typeof fn==='function'))throw TypeError('NATIVE_LAYOUT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#main=mainWindow;this.#windowFor=windowFor;this.#displays=displays;this.#canRecover=canRecoverViews;
 }
 #capture(window){
  if(this.#disposed||!window||window.isDestroyed())return null;
  if(window===this.#main)return {window};
  if(this.#canRecover()!==true)return null;
  const grant=this.#registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
  return grant&&this.#windowFor(grant.windowId)===window&&this.#registry.isCurrent(grant)?{window,grant}:null;
 }
 #current(target){
  if(this.#disposed||this.#main.isDestroyed()||target.window.isDestroyed())return false;
  if(target.window===this.#main)return true;
  if(this.#canRecover()!==true||!this.#registry.isCurrent(target.grant)||this.#windowFor(target.grant.windowId)!==target.window)return false;
  const fresh=this.#registry.capture({sender:target.window.webContents,senderFrame:target.window.webContents.mainFrame});
  return fresh?.windowId===target.grant.windowId&&fresh.projectId===target.grant.projectId;
 }
 #areas(){
  return this.#displays().slice(0,64).flatMap(d=>{try{const r=restoreBounds({},[d]);return [{id:r.displayId,workArea:restoreBounds({normalBounds:d.workArea},[d]).normalBounds,primary:d.primary===true}];}catch{return [];}});
 }
 #valid(request,target){
  return request.generation===this.#generation&&this.#current(request.origin)&&this.#current(target)&&JSON.stringify(this.#areas())===request.fingerprint;
 }
 async #settled(request,target,condition){
  const deadline=Date.now()+2000;let consecutive=0;
  // Read-only observation, not mutation retries or a fixed success delay.
  do{
   await nativePause(16);
   if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
   consecutive=condition()?consecutive+1:0;
   if(consecutive===2)return;
  }while(Date.now()<deadline);
  throw Error('NATIVE_LAYOUT_INCOMPLETE');
 }
 #restoreMode(target,state,explicit){
  if(!this.#current(target))return;
  const w=target.window;
  if(state.maximized&&!w.isMaximized())w.maximize();
  if(!this.#current(target))return;
  if(state.fullscreen&&!w.isFullScreen())w.setFullScreen(true);
  if(!this.#current(target))return;
  if(!explicit&&state.minimized&&!w.isMinimized())w.minimize();
 }
 async #run(request){
  const displays=request.displays,primary=restoreBounds({},displays).displayId;let complete=true;
  for(const target of request.targets){let state;
   try{
    if(!this.#valid(request,target)){complete=false;continue;}
    const w=target.window;let normal=w.getNormalBounds();state={minimized:w.isMinimized(),maximized:w.isMaximized(),fullscreen:w.isFullScreen()};
    if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
    if(!request.explicit&&controlsReachable(normal,displays))continue;
    if(state.fullscreen)w.setFullScreen(false);
    if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
    if(state.maximized)w.unmaximize();
    if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
    if(request.explicit&&state.minimized)w.restore();
    await this.#settled(request,target,()=>!w.isFullScreen()&&!w.isMaximized()&&(!request.explicit||!w.isMinimized()));
    normal=w.getNormalBounds();
    const areas=request.explicit?displays.filter(d=>d.id===primary):displays;
    const next=restoreBounds({normalBounds:normal},areas).normalBounds;
    if(!this.#minimum.has(w))this.#minimum.set(w,w.getMinimumSize());
    const minimum=this.#minimum.get(w);
    if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
    w.setMinimumSize(Math.min(minimum[0],next.width),Math.min(minimum[1],next.height));
    if(!this.#valid(request,target))throw Error('NATIVE_LAYOUT_CANCELLED');
    if(!equalBounds(w.getNormalBounds(),next))w.setBounds(next,false);
    await this.#settled(request,target,()=>equalBounds(w.getNormalBounds(),next));
    this.#restoreMode(target,state,request.explicit);
    await this.#settled(request,target,()=>equalBounds(w.getNormalBounds(),next)&&w.isMaximized()===state.maximized&&w.isFullScreen()===state.fullscreen&&w.isMinimized()===(request.explicit?false:state.minimized));
   }catch{
    complete=false;
    // Restore presentation mode after a native error only for the still-current
    // grant. A retired/replaced/locked native handle must never be revealed.
    try{if(state)this.#restoreMode(target,state,false);}catch{}
   }
  }
  if(request.explicit)try{if(this.#valid(request,request.origin))this.#main.focus();else complete=false;}catch{complete=false;}
  return complete;
 }
 #start(explicit,origin){
  if(this.#disposed||this.#active)return Promise.resolve(false);
  let request;
  try{
   const proof=this.#capture(origin);if(!proof)return Promise.resolve(false);
   const displays=this.#areas();restoreBounds({},displays);
   const targets=[this.#capture(this.#main)];if(!targets[0])return Promise.resolve(false);
   if(this.#canRecover()===true)for(const view of this.#registry.listViews().slice(0,64)){
    if(view.role==='workspace')continue;
    const target=this.#capture(this.#windowFor(view.windowId));
    if(target?.grant?.windowId===view.windowId&&target.grant.projectId===view.projectId)targets.push(target);
   }
   request={explicit,origin:proof,targets,displays,fingerprint:JSON.stringify(displays),generation:this.#generation};
  }catch{return Promise.resolve(false);}
  const operation=Promise.resolve().then(()=>this.#run(request)).catch(()=>false).finally(()=>{
   if(this.#active===operation)this.#active=null;
   if(this.#pending&&!this.#disposed){this.#pending=false;void this.#start(false,this.#main);}
  });
  this.#active=operation;return operation;
 }
 recover(){
  if(this.#disposed)return Promise.resolve(false);
  this.#generation++;
  if(this.#active){this.#pending=true;return this.#active;}
  return this.#start(false,this.#main);
 }
 bringAllBack(originWindow=this.#main){return this.#start(true,originWindow);}
 dispose(){this.#disposed=true;this.#generation++;this.#pending=false;}
}
export function bindNativeDisplayRecovery(screen,layout){
 const removed=()=>layout.recover(),metrics=(_event,_display,changed)=>{if(Array.isArray(changed)&&changed.some(k=>['bounds','workArea','scaleFactor','rotation'].includes(k)))return layout.recover();};
 screen.on('display-removed',removed);screen.on('display-metrics-changed',metrics);
 return ()=>{screen.off('display-removed',removed);screen.off('display-metrics-changed',metrics);};
}
