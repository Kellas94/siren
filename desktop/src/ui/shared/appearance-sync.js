(() => {
 'use strict';
 window.SirenAppearanceSync=Object.freeze({create({get,set,apply,rejected=()=>{},unavailable=()=>{}}){
  let generation=0,writing=0,closed=false,readSequence=0,completedRead=0;
  const refresh=async()=>{
   if(closed||writing)return;const own=generation,read=++readSequence;
   try{const result=await get();if(closed||writing||own!==generation||read<completedRead)return;completedRead=read;
    if(result?.ok)apply(result);else unavailable();return result;
   }catch{if(!closed&&!writing&&own===generation&&read>=completedRead){completedRead=read;unavailable();}}
  };
  const choose=async (theme,context)=>{
   if(closed)return {ok:false};const own=++generation;writing++;
   try{const result=await set({theme});if(!closed&&own===generation){if(result?.ok)apply(result);else rejected(result,context);}return result;}
   catch{if(!closed&&own===generation)rejected({ok:false,code:'OPERATION_FAILED'},context);return {ok:false};}
   finally{writing--;if(!writing&&!closed)await refresh();}
  };
  return Object.freeze({refresh,choose,dispose(){closed=true;generation++;}});
 }});
})();
