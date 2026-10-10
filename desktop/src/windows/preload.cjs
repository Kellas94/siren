const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sirenDocsDiagramEvents',Object.freeze({onPending(callback){
 if(typeof callback!=='function')throw TypeError('Expected callback');const listener=(_event,value)=>{try{
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return;const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);if(keys.length!==3||keys.some(k=>!['documentId','diagramId','reason'].includes(k)||!Object.hasOwn(fields[k],'value')))return;const documentId=fields.documentId.value,diagramId=fields.diagramId.value,reason=fields.reason.value;
  if(![documentId,diagramId].every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v))||typeof reason!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(reason))return;Promise.resolve(callback(Object.freeze({documentId,diagramId,reason}))).catch(()=>{});
 }catch{/* A pending notice grants no source or document write. */}};ipcRenderer.on('siren:docs-diagram-pending',listener);return()=>ipcRenderer.removeListener('siren:docs-diagram-pending',listener);
}}));
contextBridge.exposeInMainWorld('sirenDiagramCatalogue',Object.freeze(Object.fromEntries(['getPage','createDiagram'].map(method=>[method,payload=>ipcRenderer.invoke('siren:diagram-catalogue',method,payload)]))));
let deckAuthoring=false;const deckListeners=new Set();ipcRenderer.on('siren:deck-authoring',()=>{deckAuthoring=true;for(const callback of deckListeners)callback();});
contextBridge.exposeInMainWorld('sirenDeckNavigation',Object.freeze({play:payload=>ipcRenderer.invoke('siren:deck-navigation','play',payload),edit:payload=>ipcRenderer.invoke('siren:deck-navigation','edit',payload),onAuthoring:callback=>{if(typeof callback!=='function')throw TypeError('Expected callback');deckListeners.add(callback);if(deckAuthoring)callback();return()=>deckListeners.delete(callback);}}));
contextBridge.exposeInMainWorld('sirenShell',Object.freeze({...Object.fromEntries(['getAppearance','setAppearance','navigate'].map(method=>[method,payload=>ipcRenderer.invoke('siren:shell',method,payload)])),onHelp(callback){if(typeof callback!=='function')throw TypeError('Expected callback');const listener=(_event,id)=>{if(id==='desktopHelpDiagnostics')callback();};ipcRenderer.on('siren:command',listener);return()=>ipcRenderer.removeListener('siren:command',listener);}}));
contextBridge.exposeInMainWorld('sirenSourceAnalysis',Object.freeze(Object.fromEntries(['submit','cancel','listComparisons'].map(method=>[method,payload=>ipcRenderer.invoke('siren:source-analysis',method,payload)]))));
contextBridge.exposeInMainWorld('sirenDiagramRead',Object.freeze({getDiagram:()=>sourceFlushNonce===null?ipcRenderer.invoke('siren:diagram-read','getDiagram'):ipcRenderer.invoke('siren:diagram-read','getDiagram',undefined,sourceFlushNonce)}));
contextBridge.exposeInMainWorld('sirenDocsRead',Object.freeze({getDocument:()=>sourceFlushNonce===null?ipcRenderer.invoke('siren:docs-read','getDocument'):ipcRenderer.invoke('siren:docs-read','getDocument',undefined,sourceFlushNonce)}));
contextBridge.exposeInMainWorld('sirenDocsSources',Object.freeze(Object.fromEntries(['openLinkedSource','previewLinkedSource'].map(method=>[method,payload=>ipcRenderer.invoke('siren:docs-sources',method,payload)]))));
contextBridge.exposeInMainWorld('sirenDocsReferences',Object.freeze(Object.fromEntries(['getTargets','openReference'].map(method=>[method,payload=>ipcRenderer.invoke('siren:docs-references',method,payload)]))));
contextBridge.exposeInMainWorld('sirenDocsDiagrams',Object.freeze(Object.fromEntries(['listDocuments','sendToDocs','getProposal','listDiagrams','inspectSelection','preview','insert','readEmbed','openSource','setMode','update'].map(method=>[method,payload=>ipcRenderer.invoke('siren:docs-diagrams',method,payload)]))));
contextBridge.exposeInMainWorld('sirenSourceRead', Object.freeze(Object.fromEntries(['getReference', 'openRead', 'readChunk', 'closeRead'].map(method => [method, payload => ipcRenderer.invoke('siren:source-readers', method, payload)]))));
let sourceFlushNonce=null;
contextBridge.exposeInMainWorld('sirenDiagramEdit',Object.freeze({
 openWorkingCopy:()=>ipcRenderer.invoke('siren:diagram-editors','openWorkingCopy',{}),
 openLatest:()=>ipcRenderer.invoke('siren:diagram-editors','openLatest',{}),
 ...Object.fromEntries(['applyDiagram','flushDiagram'].map(method=>[method,payload=>ipcRenderer.invoke('siren:diagram-editors',method,payload,sourceFlushNonce??undefined)])),
 onReferenceChanged(callback){
  if(typeof callback!=='function')throw TypeError('Expected callback');
  const listener=(_event,value)=>{
   try{
    if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return;
    const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);
    if(keys.length!==3||keys.some(key=>!['diagramId','version','projectRevision'].includes(key)||!('value'in fields[key])))return;
    const diagramId=fields.diagramId.value,version=fields.version.value,projectRevision=fields.projectRevision.value;
    if(typeof diagramId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(diagramId)||!Number.isSafeInteger(version)||version<1||!Number.isSafeInteger(projectRevision)||projectRevision<1)return;
    Promise.resolve(callback(Object.freeze({diagramId,version,projectRevision}))).catch(()=>{});
   }catch{/* Metadata does not grant diagram access. */}
  };ipcRenderer.on('siren:working-diagram-changed',listener);return()=>ipcRenderer.removeListener('siren:working-diagram-changed',listener);
 },
}));
contextBridge.exposeInMainWorld('sirenDocsEdit',Object.freeze({
 openWorkingCopy:()=>ipcRenderer.invoke('siren:docs-editors','openWorkingCopy',{}),
 openLatest:()=>ipcRenderer.invoke('siren:docs-editors','openLatest',{}),
 ...Object.fromEntries(['applyDocument','flushDocument'].map(method=>[method,payload=>ipcRenderer.invoke('siren:docs-editors',method,payload,sourceFlushNonce??undefined)])),
 onReferenceChanged(callback){
  if(typeof callback!=='function')throw TypeError('Expected callback');
  const listener=(_event,value)=>{
   try{
    if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return;
    const fields=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(fields);
    if(keys.length!==3||keys.some(key=>!['documentId','version','projectRevision'].includes(key)||!('value'in fields[key])))return;
    const documentId=fields.documentId.value,version=fields.version.value,projectRevision=fields.projectRevision.value;
    if(typeof documentId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(documentId)||typeof version!=='string'||!/^[a-f0-9]{64}$/.test(version)||!Number.isSafeInteger(projectRevision)||projectRevision<1)return;
    Promise.resolve(callback(Object.freeze({documentId,version,projectRevision}))).catch(()=>{});
   }catch{/* Metadata does not grant document access. */}
  };ipcRenderer.on('siren:working-docs-changed',listener);return()=>ipcRenderer.removeListener('siren:working-docs-changed',listener);
 },
}));
contextBridge.exposeInMainWorld('sirenSource', Object.freeze(Object.fromEntries([
 ...['getMetrics', 'readRange'].map(method => [method, payload => ipcRenderer.invoke('siren:sources', method, payload)]),
 ...['applyEdit','commitSource'].map(method=>[method,payload=>ipcRenderer.invoke('siren:source-mutations',method,payload,sourceFlushNonce??undefined)])
])));
contextBridge.exposeInMainWorld('sirenSourceEdit',Object.freeze({
 openWorkingCopy:()=>ipcRenderer.invoke('siren:source-editors','openWorkingCopy',{}),
 onReferenceChanged(callback){
  if(typeof callback!=='function')throw TypeError('Expected callback');
  const listener=(_event,input)=>{
   try{
    if(!input||![Object.prototype,null].includes(Object.getPrototypeOf(input)))return;
    const fields=Object.getOwnPropertyDescriptors(input),keys=Reflect.ownKeys(fields);
    if(keys.length!==3||keys.some(key=>typeof key!=='string'||!['sourceId','version','sha256'].includes(key)||!('value' in fields[key])))return;
    const sourceId=fields.sourceId.value,version=fields.version.value,sha256=fields.sha256.value;
    if(typeof sourceId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(sourceId)||!Number.isSafeInteger(version)||version<1||typeof sha256!=='string'||!/^[a-f0-9]{64}$/.test(sha256))return;
    Promise.resolve(callback(Object.freeze({sourceId,version,sha256}))).catch(()=>{});
   }catch{/* An invalid native message or failed observer is never a save receipt. */}
  };
  ipcRenderer.on('siren:working-source-changed',listener);return()=>ipcRenderer.removeListener('siren:working-source-changed',listener);
 },
}));
contextBridge.exposeInMainWorld('sirenCodeDocs',Object.freeze(Object.fromEntries(['listTargets','listDocuments','commitCodeToDocs','createCodeToDocs'].map(method=>[method,payload=>ipcRenderer.invoke('siren:code-docs',method,payload)]))));
const methods = ['getView', 'listViews', 'openView', 'focusView', 'closeView'];
contextBridge.exposeInMainWorld('sirenWindowDock',Object.freeze(Object.fromEntries(['getShelf','attach','detach'].map(method=>[method,payload=>ipcRenderer.invoke('siren:window-dock',method,payload)]))));
contextBridge.exposeInMainWorld('sirenDiagramExport',Object.freeze({
 exportSvg:payload=>ipcRenderer.invoke('siren:diagram-export','exportSvg',payload),
 revealExport:payload=>ipcRenderer.invoke('siren:diagram-export','revealExport',payload),
}));
contextBridge.exposeInMainWorld('sirenDocsExport',Object.freeze({
 exportSaved:payload=>ipcRenderer.invoke('siren:docs-export','exportSaved',payload),
 revealExport:payload=>ipcRenderer.invoke('siren:docs-export','revealExport',payload),
}));
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
    const own=Object.freeze({requestId:ticket.requestId,nonce:ticket.nonce});active=own;sourceFlushNonce=own.nonce;
    let ok=false,code;try{const result=await callback();ok=result?.ok===true;if(!ok&&typeof result?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(result.code))code=result.code;}catch{/* A failed renderer never supplies a native seal. */}
    finally{if(active===own){active=null;sourceFlushNonce=null;}}
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
