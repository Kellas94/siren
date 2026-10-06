const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sirenShell',Object.freeze(Object.fromEntries(['getAppearance','setAppearance','navigate'].map(method=>[method,payload=>ipcRenderer.invoke('siren:shell',method,payload)]))));
contextBridge.exposeInMainWorld('sirenDocsRead',Object.freeze({getDocument:()=>ipcRenderer.invoke('siren:docs-read','getDocument')}));
contextBridge.exposeInMainWorld('sirenSourceRead', Object.freeze(Object.fromEntries(['getReference', 'openRead', 'readChunk', 'closeRead'].map(method => [method, payload => ipcRenderer.invoke('siren:source-readers', method, payload)]))));
contextBridge.exposeInMainWorld('sirenSource', Object.freeze(Object.fromEntries(['getMetrics', 'readRange'].map(method => [method, payload => ipcRenderer.invoke('siren:sources', method, payload)]))));
const methods = ['pickProject', 'saveProject', 'exportProject', 'getAccess', 'beginLogin', 'logout', 'getUpdate', 'checkForUpdates', 'downloadUpdate', 'cancelUpdate', 'restartAndUpdate', 'getRecovery', 'restoreRecovery', 'exportRecovery', 'requestClose', 'exportDiagnostics', 'getPinState', 'setupPin', 'unlockPin', 'verifyCurrentPin', 'changePin', 'lockPin','goHome'];
const bridge = Object.fromEntries(methods.map(name => [name, payload => ipcRenderer.invoke('siren:desktop', name, payload)]));
bridge.onStatus = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const listener = (_event, state) => callback(state);
  ipcRenderer.on('siren:status', listener);
  return () => ipcRenderer.removeListener('siren:status', listener);
};
bridge.onCommand = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const allowed = new Set(['desktopOpenProject', 'desktopExportProject', 'desktopLogin', 'desktopCheckUpdates', 'desktopRecovery', 'desktopGuide', 'desktopPinSettings', 'desktopLockPin']);
  const listener = (_event, command) => { if (allowed.has(command)) callback(command); };
  ipcRenderer.on('siren:command', listener);
  return () => ipcRenderer.removeListener('siren:command', listener);
};
contextBridge.exposeInMainWorld('sirenDesktop', Object.freeze(bridge));
const bootstrap = ipcRenderer.sendSync('siren:bootstrap');
contextBridge.exposeInMainWorld('sirenDesktopBootstrap', bootstrap);
contextBridge.exposeInMainWorld('sirenDesktopReady', () => ipcRenderer.send('siren:ready'));
const homeBridge=Object.fromEntries(['getHomeState','continueWork','openProject','createProject','recordLocation'].map(method=>[method,payload=>ipcRenderer.invoke('siren:home',method,payload??{})]));
homeBridge.openModule=payload=>ipcRenderer.invoke('siren:home-route',payload);
homeBridge.importProject=()=>ipcRenderer.invoke('siren:home-import',{});
homeBridge.exportSavedBackup=()=>ipcRenderer.invoke('siren:home-export',{});
homeBridge.convertProject=()=>ipcRenderer.invoke('siren:home-convert',{});
homeBridge.importSource=()=>ipcRenderer.invoke('siren:home-source-import',{});
homeBridge.createDocument=payload=>ipcRenderer.invoke('siren:home-document-create',payload);
homeBridge.showRecovery=()=>ipcRenderer.invoke('siren:home-recovery',{});
homeBridge.getCatalog=payload=>ipcRenderer.invoke('siren:windows','getCatalog',payload??{});
homeBridge.openView=payload=>ipcRenderer.invoke('siren:windows','openView',payload);
homeBridge.editDeck=payload=>ipcRenderer.invoke('siren:deck-navigation','edit',payload);
homeBridge.focusView=payload=>ipcRenderer.invoke('siren:windows','focusView',payload);
homeBridge.onInvalidated=callback=>{if(typeof callback!=='function')throw new TypeError('Expected callback');const listener=()=>callback();ipcRenderer.on('siren:home-invalidated',listener);return()=>ipcRenderer.removeListener('siren:home-invalidated',listener);};
homeBridge.onNavigate=callback=>{if(typeof callback!=='function')throw new TypeError('Expected callback');const listener=(_event,surface)=>{if(['diagrams','docs','code','present','find'].includes(surface))callback(surface);};ipcRenderer.on('siren:shell-module',listener);return()=>ipcRenderer.removeListener('siren:shell-module',listener);};
contextBridge.exposeInMainWorld('sirenHome',Object.freeze(homeBridge));
const admitted=bootstrap?.navigationPending===true?new Promise(resolve=>ipcRenderer.once('siren:workspace-admitted',()=>resolve())):Promise.resolve();
contextBridge.exposeInMainWorld('sirenDesktopAdmitted',()=>admitted);
const windowMethods = ['getView', 'listViews', 'openView', 'focusView', 'closeView', 'getCatalog'];
contextBridge.exposeInMainWorld('sirenWindowDock',Object.freeze(Object.fromEntries(['getShelf','attach','detach','showWorkspace'].map(method=>[method,payload=>ipcRenderer.invoke('siren:window-dock',method,payload)]))));
contextBridge.exposeInMainWorld('sirenWindow', Object.freeze(Object.fromEntries(windowMethods.map(method => [method, payload => ipcRenderer.invoke('siren:windows', method, payload)]))));

// The captured native frame alone receives this finite draining ticket.
(() => {
 let active=null,subscribed=false;
 const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
 const unavailable=()=>Promise.resolve({ok:false,code:'VIEW_NOT_PREPARING'});
 const api={
  isPreparing:()=>active!==null,
  saveWorkspace:request=>active?ipcRenderer.invoke('siren:workspace-flush','saveProject',{nonce:active.nonce,request}):unavailable(),
  sealReadonly:()=>active?ipcRenderer.invoke('siren:workspace-flush','sealReadonly',{nonce:active.nonce}):unavailable(),
  onPrepare(callback){
   if(typeof callback!=='function'||subscribed)throw new TypeError('One native preparation callback required');
   subscribed=true;
   const listener=async(_event,ticket)=>{
    if(active||!ticket||Object.keys(ticket).sort().join(',')!=='nonce,requestId'||!uuid(ticket.requestId)||!uuid(ticket.nonce))return;
    const own=Object.freeze({requestId:ticket.requestId,nonce:ticket.nonce});active=own;
    let ok=false,code;try{const result=await callback();ok=result?.ok===true;if(!ok&&typeof result?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(result.code))code=result.code;}catch{/* A failed renderer never supplies a native seal. */}
    finally{if(active===own)active=null;}
    return ipcRenderer.invoke('siren:view-ack',{requestId:own.requestId,ok,...(code?{code}:{})});
   };
   ipcRenderer.on('siren:view-prepare',listener);
   return()=>{ipcRenderer.removeListener('siren:view-prepare',listener);subscribed=false;};
  },
  onResume(callback){
   if(typeof callback!=='function')throw new TypeError('Expected callback');
   const listener=()=>callback();ipcRenderer.on('siren:view-resume',listener);
   return()=>ipcRenderer.removeListener('siren:view-resume',listener);
  }
 };
 contextBridge.exposeInMainWorld('sirenViewControl',Object.freeze(api));
})();
