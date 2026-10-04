(() => {
 'use strict';
 window.SirenNativeDiagramSession=Object.freeze({create({read,render,onSource,onPreview,onError}){
  let generation=0,paused=false,disposed=false,context=null;const pending=new Set();
  const current=token=>!paused&&!disposed&&token===generation;
  function refresh(){
   if(paused||disposed)return Promise.resolve(false);
   const token=++generation;
   const operation=(async()=>{
    try{
     const result=await read();if(!current(token))return false;
     if(result?.ok!==true||result.readonly!==true||typeof result.diagram?.source!=='string')throw Error('Diagram unavailable');
     context=result;onSource(result);
     const preview=await render({source:result.diagram.source,token});if(!current(token))return false;
     onPreview(preview);return true;
    }catch{if(current(token))onError();return false;}
   })();pending.add(operation);operation.finally(()=>pending.delete(operation));return operation;
  }
  return Object.freeze({refresh,get context(){return context;},async pause(){paused=true;++generation;await Promise.allSettled([...pending]);return !disposed&&context!==null;},resume(){if(!disposed)paused=false;},dispose(){disposed=true;paused=true;++generation;context=null;}});
 }});
})();
