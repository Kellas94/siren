(() => {
 'use strict';
 // Layout state only: resizing never reloads the editor or the analysis result.
 window.SirenCodeSplit=Object.freeze({create({layout,separator,panel,resetButton}){
  let disposed=false,paused=false,visible=false,preferred=null,width=0,drag=null;
  const listeners=[];
  const listen=(target,type,callback)=>{target?.addEventListener(type,callback);listeners.push([target,type,callback]);};
  const limits=()=>{
   const measured=layout.getBoundingClientRect().width,size=Number.isFinite(measured)?Math.max(0,measured):0;
   const available=Math.max(0,size-22),max=Math.max(0,Math.min(available*.65,available-240)),min=Math.min(160,max);
   return {min,max,default:Math.max(min,Math.min(max,Math.max(240,Math.min(360,size*.28))))};
  };
  const enabled=()=>!disposed&&!paused&&visible&&!panel.hidden;
  const paint=()=>{
   if(disposed)return;const range=limits();
   width=Math.max(range.min,Math.min(range.max,preferred??range.default));
   layout.style.setProperty('--code-analysis-width',`${width}px`);
   separator.setAttribute('aria-valuemin',String(range.min));separator.setAttribute('aria-valuemax',String(range.max));separator.setAttribute('aria-valuenow',String(width));separator.setAttribute('aria-valuetext',`${Math.round(width)} pixels for analysis`);
  };
  const setWidth=value=>{if(!Number.isFinite(value))return;const range=limits();preferred=Math.max(range.min,Math.min(range.max,value));paint();};
  const endDrag=(restore=false)=>{
   const previous=drag;drag=null;if(!previous)return;
   if(separator.hasPointerCapture?.(previous.id)){try{separator.releasePointerCapture(previous.id);}catch{}}
   layout.classList.remove('is-resizing-analysis');
   // Cancellation restores the layout mode too: null means responsive default.
   if(restore){preferred=previous.preferred;paint();}
  };
  const sync=()=>{separator.hidden=!visible||disposed;separator.tabIndex=enabled()?0:-1;separator.setAttribute('aria-disabled',String(!enabled()));if(resetButton)resetButton.disabled=!enabled();};
  const reset=()=>{if(!enabled())return;endDrag();preferred=null;paint();};
  const down=event=>{
   if(!enabled()||drag||event.button!==0||event.isPrimary===false||!Number.isFinite(event.clientX))return;
   try{separator.setPointerCapture(event.pointerId);}catch{return;}
   drag={id:event.pointerId,x:event.clientX,width,preferred};layout.classList.add('is-resizing-analysis');separator.focus({preventScroll:true});event.preventDefault();
  };
  const move=event=>{if(!enabled()||!drag||event.pointerId!==drag.id||!Number.isFinite(event.clientX))return;setWidth(drag.width+drag.x-event.clientX);event.preventDefault();};
  const up=event=>{if(drag&&event.pointerId===drag.id)endDrag();};
  const cancel=event=>{if(drag&&event.pointerId===drag.id)endDrag(true);};
  const lost=event=>{if(drag&&event.pointerId===drag.id)endDrag();};
  const key=event=>{
   if(!enabled())return;
   if(event.key==='Escape'){if(drag){endDrag(true);event.preventDefault();}return;}
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   const step=event.shiftKey?64:16,range=limits();
   switch(event.key){
    case 'ArrowLeft':endDrag();setWidth(width+step);break;
    case 'ArrowRight':endDrag();setWidth(width-step);break;
    case 'Home':endDrag();setWidth(range.min);break;
    case 'End':endDrag();setWidth(range.max);break;
    case 'Enter':reset();break;
    default:return;
   }
   event.preventDefault();
  };
  const resized=()=>{if(enabled()){endDrag();paint();}};
  const escape=event=>{if(enabled()&&drag&&event.key==='Escape'){endDrag(true);event.preventDefault();}};
  listen(separator,'pointerdown',down);listen(separator,'pointermove',move);listen(separator,'pointerup',up);listen(separator,'pointercancel',cancel);listen(separator,'lostpointercapture',lost);listen(separator,'keydown',key);listen(separator,'dblclick',reset);listen(resetButton,'click',reset);listen(window,'resize',resized);
  listen(document,'keydown',escape);listen(window,'blur',()=>endDrag());
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resized):null;observer?.observe(layout);sync();
  return Object.freeze({
   setVisible(value){if(disposed)return;endDrag();visible=value===true;sync();if(enabled())paint();},
   pause(){if(disposed)return;endDrag();paused=true;sync();},
   resume(){if(disposed)return;paused=false;sync();if(enabled())paint();},
   dispose(){if(disposed)return;endDrag();disposed=true;sync();observer?.disconnect();for(const [target,type,callback]of listeners)target?.removeEventListener(type,callback);}
  });
 }});
})();
