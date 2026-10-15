import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import {SearchAddon} from '@xterm/addon-search';
import {createTerminalSatellite} from './satellite.js';

export function bootTerminalEntry({window:win=window,document:doc=document,createSatellite=createTerminalSatellite}={}){
 const bridge=win.sirenTerminal,container=doc.getElementById('terminalWorkspace');
 let disposed=false,themeSerial=0,helpSerial=0,helpPermit=null,helpContextBound=false,helpReady=false;const offs=[];
 const satellite=createSatellite({container,bridge,onExplain:identity=>helpReady?openHelp(identity):Promise.resolve(false),windowId:new URL(win.location.href).searchParams.get('windowId'),constructors:{Terminal,FitAddon,SearchAddon,ResizeObserver:win.ResizeObserver,requestFrame:win.requestAnimationFrame.bind(win),cancelFrame:win.cancelAnimationFrame.bind(win)}});

 const helpWindowId=new URL(win.location.href).searchParams.get('windowId');
 const helpVisible=()=>!doc.body?.inert&&doc.documentElement.style.visibility!=='hidden'&&doc.documentElement.dataset?.desktopLocked!=='true';
 const helpReadable=()=>!disposed&&helpPermit?.serial===helpSerial&&helpVisible();
 function revokeHelp(){helpPermit=null;helpSerial++;help?.close();return helpSerial;}
 function helpContext(value){
  try{
   const keys=['ok','readable','role','windowId','projectId','epoch'];if(!value||typeof value!=='object'||Reflect.ownKeys(value).length!==keys.length)return null;
   const data={};for(const key of keys){const field=Object.getOwnPropertyDescriptor(value,key);if(!field?.enumerable||!Object.hasOwn(field,'value'))return null;data[key]=field.value;}
   return data.ok===true&&data.readable===true&&data.role==='terminal'&&data.windowId===helpWindowId&&typeof data.projectId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(data.projectId)&&Number.isSafeInteger(data.epoch)&&data.epoch>0?Object.freeze(data):null;
  }catch{return null;}
 }
 function terminalErrorIdentity(value){
  try{const keys=['namespace','operation','code'];if(!value||typeof value!=='object'||Reflect.ownKeys(value).length!==keys.length)return null;
   const safe={};for(const key of keys){const field=Object.getOwnPropertyDescriptor(value,key);if(!field?.enumerable||!Object.hasOwn(field,'value'))return null;safe[key]=field.value;}
   return safe.namespace==='terminal'&&['pick-cwd','create','input','stop','attach'].includes(safe.operation)&&typeof safe.code==='string'&&/^[A-Z][A-Z0-9_]{0,95}$/.test(safe.code)?Object.freeze(safe):null;
  }catch{return null;}
 }
 async function openHelp(identity){
  if(disposed||!helpReady)return false;const serial=revokeHelp();if(!helpContextBound||!helpVisible())return false;
  const safe=identity===undefined?null:terminalErrorIdentity(identity);if(identity!==undefined&&!safe)return false;
  let reply;try{if(typeof bridge?.getTerminalHelpContext!=='function')return false;reply=await bridge.getTerminalHelpContext();}catch{return false;}
  if(disposed||serial!==helpSerial)return false;const receipt=helpContext(reply);if(!receipt)return false;
  helpPermit={serial,receipt};if(!helpReadable()){revokeHelp();return false;}return safe?help?.open({errorIdentity:safe})===true:help?.open()===true;
 }
 const help=win.SirenHelp?.create({document:doc,isAvailable:helpReadable});
 // Any cover mutation retires pending reads, including cover then resume in one turn.
 const helpObserver=typeof win.MutationObserver==='function'?new win.MutationObserver(()=>revokeHelp()):null;
 if(doc.body)helpObserver?.observe(doc.body,{attributes:true,attributeFilter:['inert']});
 helpObserver?.observe(doc.documentElement,{attributes:true,attributeFilter:['style','data-desktop-locked']});
 if(typeof bridge?.onTerminalHelp==='function')offs.push(bridge.onTerminalHelp(id=>{if(id==='desktopHelpDiagnostics')return openHelp();}));
 if(typeof bridge?.onTerminalContext==='function')try{const off=bridge.onTerminalContext(()=>revokeHelp());if(typeof off==='function'){helpContextBound=true;offs.push(off);}}catch{/* No read permission without a live invalidation subscription. */}
 doc.getElementById('terminalHelp')?.addEventListener('click',()=>openHelp());
 async function theme(){const serial=++themeSerial;try{const value=await bridge?.getTerminalTheme?.();if(disposed||serial!==themeSerial||!value?.ok)return;const palette=value.palette;const applied=satellite.setTheme(palette);if(applied?.ok){doc.documentElement.style.setProperty('--terminal-bg',palette.background);doc.documentElement.style.setProperty('--terminal-fg',palette.foreground);doc.documentElement.style.setProperty('--terminal-accent',palette.cursor);doc.documentElement.style.setProperty('--panel-bg',palette.background);doc.documentElement.style.setProperty('--text',palette.foreground);}}catch{}}
 if(typeof bridge?.onTerminalTheme==='function')offs.push(bridge.onTerminalTheme(()=>void theme()));
 const move=doc.getElementById('terminalPlacement');if(move)move.addEventListener('click',async()=>{const r=await bridge?.toggleTerminalPlacement?.();if(!disposed&&r?.ok)move.textContent=r.placement==='attached'?'Detach window':'Attach to workspace';});
 function dispose(){if(disposed)return;disposed=true;helpReady=false;helpContextBound=false;themeSerial++;revokeHelp();helpObserver?.disconnect();help?.dispose();for(const off of offs)try{off();}catch{}satellite.dispose();void satellite.drain();}
 win.addEventListener('pagehide',dispose,{once:true});helpReady=!disposed;void satellite.refresh().then(()=>theme());
 return Object.freeze({dispose,snapshot:()=>satellite.snapshot()});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')bootTerminalEntry();
