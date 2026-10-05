(() => {
 'use strict';
 window.SirenAppearanceSync=Object.freeze({create({get,set,apply,rejected=()=>{},unavailable=()=>{}}){
  let generation=0,writing=0,closed=false;
  const refresh=async()=>{
   if(closed||writing)return;const own=generation;
   try{const result=await get();if(closed||writing||own!==generation)return;
    if(result?.ok)apply(result);else unavailable();return result;
   }catch{if(!closed&&!writing&&own===generation)unavailable();}
  };
  const choose=async theme=>{
   if(closed)return {ok:false};const own=++generation;writing++;
   try{apply({ok:true,theme});const result=await set({theme});if(!closed&&!result?.ok&&own===generation)rejected();return result;}
   catch{if(!closed&&own===generation)rejected();return {ok:false};}
   finally{writing--;if(!writing&&!closed)await refresh();}
  };
  return Object.freeze({refresh,choose,dispose(){closed=true;generation++;}});
 }});
})();
