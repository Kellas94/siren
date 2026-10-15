import {createTerminalControls} from './controls.js';
import {createXtermAdapter} from './xterm-adapter.js';

// SOURCE_ONLY. Main must provide genuine context and authorize every operation.
// No production entry supplies admitted xterm constructors at this checkpoint.
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function context(value){
 try{
  if(!value||Object.getPrototypeOf(value)!==Object.prototype)return null;
  const keys=['windowId','role','projectId','epoch','mode','access','available'];
  if(Reflect.ownKeys(value).length!==keys.length)return null;
  const result={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
  return typeof result.windowId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(result.windowId)&&result.role==='terminal'&&id(result.projectId)&&Number.isSafeInteger(result.epoch)&&result.epoch>0&&result.mode==='normal'&&result.access==='write'&&result.available===true?Object.freeze(result):null;
 }catch{return null;}
}
export function createTerminalSatellite({container,bridge,windowId,constructors,createControls=createTerminalControls,createAdapter=createXtermAdapter,onExplain=null}={}){
 if(!container||typeof createControls!=='function'||typeof createAdapter!=='function')throw TypeError('Terminal satellite adapters required');
 let generation=0,disposed=false,current=null,unsubscribe=null,theme=null;
 const work=new Set();
 const retain=promise=>{const owned=Promise.resolve(promise);work.add(owned);owned.then(()=>work.delete(owned),()=>work.delete(owned));return owned;};
 function retire(){const old=current;current=null;if(!old)return;try{old.dispose();}finally{try{retain(old.drain());}catch{}}}
 function unavailable(){if(!disposed)current=createControls({container,available:false});}
 function refresh(){
  const serial=++generation;retire();if(disposed)return Promise.resolve(false);unavailable();
  // Missing constructors are an explicit dependency boundary, never a textarea
  // substitute or a reason to call an unconfigured native bridge.
  if(!constructors||typeof bridge?.getTerminalContext!=='function'||typeof unsubscribe!=='function'||typeof windowId!=='string')return Promise.resolve(false);
  return retain((async()=>{
   let raw;try{raw=await bridge.getTerminalContext();}catch{return false;}
   if(disposed||serial!==generation)return false;const identity=context(raw);
   if(!identity||identity.windowId!==windowId||disposed||serial!==generation)return false;
   let adapter;try{adapter=createAdapter(constructors);}catch{return false;}
   if(disposed||serial!==generation)return false;
   retire();if(disposed||serial!==generation)return false;
   let candidate;
   const explain=typeof onExplain==='function'?identity=>{
    if(disposed||serial!==generation||current!==candidate||!candidate)return Promise.resolve(false);
    try{return Promise.resolve(onExplain(identity)).catch(()=>false);}catch{return Promise.resolve(false);}
   }:null;
   try{candidate=createControls({container,bridge,epoch:identity.epoch,projectId:identity.projectId,available:true,terminalFactory:adapter.terminalFactory,search:adapter.search,...(explain?{onExplain:explain}:{})});}
   catch{if(!disposed&&serial===generation)unavailable();return false;}
   if(disposed||serial!==generation){try{candidate.dispose();}finally{try{retain(candidate.drain());}catch{}}return false;}
   current=candidate;if(theme)current.setTheme?.(theme);return true;
  })());
 }
 function dispose(){if(disposed)return;disposed=true;generation++;try{unsubscribe?.();}finally{unsubscribe=null;retire();}}
 async function drain(){while(work.size)await Promise.allSettled([...work]);await current?.drain();}
 unavailable();
 if(constructors&&typeof bridge?.onTerminalContext==='function'){
  try{const off=bridge.onTerminalContext(()=>{void refresh();});if(typeof off!=='function')throw Error('Context subscription unavailable');if(disposed)off();else unsubscribe=off;}
  catch{dispose();throw Error('Terminal context subscription unavailable');}
 }
 return Object.freeze({refresh,dispose,drain,setTheme:value=>{if(disposed)return {ok:false,code:'VIEW_DISPOSED'};const reply=current?.setTheme(value);if(reply?.ok)theme=value;return reply;},snapshot:()=>Object.freeze({disposed,generation,available:current?.snapshot().available===true})});
}
