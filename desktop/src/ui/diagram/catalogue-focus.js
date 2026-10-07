(() => {
 'use strict';
 window.SirenDiagramCatalogueFocus=Object.freeze({create({views,contextFor,enabled}){
  let held=null,disposed=false,composing=false;
  const retire=()=>{const own=held;held=null;for(const lease of own?.leases??[])lease.retire();};
  function restore(){
   const own=held;if(!own)return;held=null;
   const current=!disposed&&enabled()&&own.context===contextFor()&&!document.body?.inert&&document.documentElement?.style?.visibility!=='hidden';
   try{if(current&&own.focus?.isConnected!==false&&!own.focus?.disabled){own.focus?.focus();if(own.selection)own.focus.setSelectionRange?.(own.selection.start,own.selection.end,own.selection.direction);}}catch{/* A retired field cannot receive private focus. */}
   for(const lease of own.leases){if(current)lease.restore();else lease.retire();}
  }
  function begin(){
   if(disposed||!enabled()||composing)return false;
   const context=contextFor();if(held?.context===context)return true;retire();
   const leases=[];for(const view of views){const lease=view.beginExternalInteraction();if(!lease){for(const previous of leases)previous.retire();return false;}leases.push(lease);}
   const focus=document.activeElement,selection=focus&&typeof focus.selectionStart==='number'?{start:focus.selectionStart,end:focus.selectionEnd,direction:focus.selectionDirection}:null;
   held={context,focus,selection,leases,waitingForReturn:false};return true;
  }
  const start=()=>composing=true,end=()=>composing=false,onFocus=()=>{if(held?.waitingForReturn)restore();};
  document.addEventListener('compositionstart',start,true);document.addEventListener('compositionend',end,true);window.addEventListener('focus',onFocus);
  return Object.freeze({begin,isHeld:()=>held!==null,close({restoreFocus=true}={}){if(restoreFocus)restore();else if(held){held.waitingForReturn=true;if(document.hasFocus?.()===true)restore();}},pause:retire,dispose(){if(disposed)return;disposed=true;retire();document.removeEventListener('compositionstart',start,true);document.removeEventListener('compositionend',end,true);window.removeEventListener('focus',onFocus);}});
 }});
})();
