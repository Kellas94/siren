const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sirenDocsRead',Object.freeze({getDocument:()=>ipcRenderer.invoke('siren:docs-read','getDocument')}));
contextBridge.exposeInMainWorld('sirenSourceRead', Object.freeze(Object.fromEntries(['getReference', 'openRead', 'readChunk', 'closeRead'].map(method => [method, payload => ipcRenderer.invoke('siren:source-readers', method, payload)]))));
contextBridge.exposeInMainWorld('sirenSource', Object.freeze(Object.fromEntries(['getMetrics', 'readRange'].map(method => [method, payload => ipcRenderer.invoke('siren:sources', method, payload)]))));
const methods = ['getView', 'listViews', 'openView', 'focusView', 'closeView'];
const bridge = Object.fromEntries(methods.map(method => [method, payload => ipcRenderer.invoke('siren:windows', method, payload)]));
bridge.onReady = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const listener = () => callback();
  ipcRenderer.on('siren:view-ready', listener);
  return () => ipcRenderer.removeListener('siren:view-ready', listener);
};
contextBridge.exposeInMainWorld('sirenWindow', Object.freeze(bridge));

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
