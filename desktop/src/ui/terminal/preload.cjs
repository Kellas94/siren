// Standalone SOURCE_ONLY preload candidate. No BrowserWindow selects it yet.
// Finite transport only: main owns sender/frame/PIN/project/lease authorization.
(() => {
 const {contextBridge,ipcRenderer}=require('electron');
 const invoke=ipcRenderer.invoke.bind(ipcRenderer),on=ipcRenderer.on.bind(ipcRenderer),remove=ipcRenderer.removeListener.bind(ipcRenderer);
 const subscriptions=new Set();let closed=false,pending=0;
 const fail=code=>Object.freeze({ok:false,code});
 const names=['terminalPickCwd','terminalListProfiles','terminalCreate','terminalList','terminalAttach','terminalInput','terminalResize','terminalAck','terminalDetach','terminalStop'];
 const api=Object.fromEntries(names.map(name=>[name,payload=>{
  if(closed)return Promise.resolve(fail('CLIENT_DISPOSED'));if(pending>=32)return Promise.resolve(fail('CAPACITY_EXCEEDED'));pending++;
  let reply;try{reply=invoke('siren:terminal',name,payload);}catch{pending--;return Promise.resolve(fail(closed?'CLIENT_DISPOSED':'BRIDGE_UNAVAILABLE'));}
  return Promise.resolve(reply).then(value=>{pending--;return closed?fail('CLIENT_DISPOSED'):value;},()=>{pending--;return fail(closed?'CLIENT_DISPOSED':'BRIDGE_UNAVAILABLE');});
 }]));
 // Dedicated, argument-free context facade. It grants no execution authority;
 // product main does not register this channel before native admission.
 for(const [method,channel]of [['getTerminalHelpContext','siren:terminal-help-context'],['getTerminalContext','siren:terminal-context'],['getTerminalTheme','siren:terminal-theme'],['toggleTerminalPlacement','siren:terminal-placement']])api[method]=()=>{
  if(closed)return Promise.resolve(fail('CLIENT_DISPOSED'));if(pending>=32)return Promise.resolve(fail('CAPACITY_EXCEEDED'));pending++;
  let reply;try{reply=invoke(channel);}catch{pending--;return Promise.resolve(fail(closed?'CLIENT_DISPOSED':'BRIDGE_UNAVAILABLE'));}
  return Promise.resolve(reply).then(value=>{pending--;return closed?fail('CLIENT_DISPOSED'):value;},()=>{pending--;return fail(closed?'CLIENT_DISPOSED':'BRIDGE_UNAVAILABLE');});
 };
 for(const [name,channel]of [['onTerminalData','siren:terminal-data'],['onTerminalGap','siren:terminal-gap'],['onTerminalState','siren:terminal-state'],['onTerminalContext','siren:terminal-context'],['onTerminalTheme','siren:terminal-theme'],['onTerminalHelp','siren:command']]){
  api[name]=callback=>{
   if(closed)throw Error('CLIENT_DISPOSED');if(typeof callback!=='function')throw TypeError('Expected callback');if(subscriptions.size>=32)throw Error('CAPACITY_EXCEEDED');
   const slot={active:true,channel,listener:null};subscriptions.add(slot);
   slot.listener=(_event,payload)=>{if(closed||!slot.active)return;try{const result=callback(payload);if(result instanceof Promise)result.catch(()=>{});}catch{/* No raw Electron event or callback exception crosses this facade. */}};
   const off=()=>{if(!slot.active)return;slot.active=false;subscriptions.delete(slot);try{remove(channel,slot.listener);}catch{}};
   // The on() call may finish registering after a reentrant unload already
   // retired delivery. Reconcile the completed registration independently.
   try{on(channel,slot.listener);}catch{off();try{remove(channel,slot.listener);}catch{}throw Error(closed?'CLIENT_DISPOSED':'BRIDGE_UNAVAILABLE');}
   if(closed||!slot.active){off();try{remove(channel,slot.listener);}catch{}throw Error('CLIENT_DISPOSED');}return off;
  };
 }
 window.addEventListener('unload',()=>{if(closed)return;closed=true;for(const slot of [...subscriptions]){slot.active=false;subscriptions.delete(slot);try{remove(slot.channel,slot.listener);}catch{}}},{once:true});
 contextBridge.exposeInMainWorld('sirenTerminal',Object.freeze(api));
})();
