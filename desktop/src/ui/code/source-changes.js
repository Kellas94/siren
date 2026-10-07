(() => {
 'use strict';
 window.SirenNativeSourceChanges=Object.freeze({create({subscribe,sourceIdFor,stateFor,isCurrent,onReload,onRetained,onClear}){
  let latest=null,shown=null,timer=null,disposed=false,paused=false,reloading=false,generation=0,failedVersion=0;
  const cancel=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
  const current=()=>!disposed&&!paused&&isCurrent();
  const clean=state=>state?.ready&&!state.readonly&&!state.opening&&!state.dirty&&!state.pending&&!state.saving&&!state.fenced;
  const retain=()=>{if(latest&&shown!==latest.version){shown=latest.version;onRetained(latest);}};
  function reconcile(){
   if(!current()){cancel();return;}
   if(!latest)return;
   const state=stateFor();
   if(state?.sourceRef?.sourceId===latest.sourceId&&state.sourceRef.version>=latest.version){latest=null;shown=null;cancel();onClear();return;}
   if(!clean(state)||latest.version<=failedVersion){cancel();retain();return;}
   if(reloading)return;
   cancel();const token=generation;
   timer=setTimeout(()=>{
    timer=null;if(!current()||token!==generation||!latest)return;
    if(!clean(stateFor())){retain();return;}
    const ref=latest;latest=null;reloading=true;
    // Invoke synchronously after the clean-state check: no input can slip
    // between that check and the editor's admission/disposal barrier.
    Promise.resolve(onReload()).then(ok=>{
     if(!current()||token!==generation)return;
     if(ok===false){failedVersion=ref.version;latest??=ref;retain();}
    }).catch(()=>{if(current()&&token===generation){failedVersion=ref.version;latest??=ref;retain();}}).finally(()=>{reloading=false;reconcile();});
   },250);
  }
  const unsubscribe=subscribe(ref=>{
   if(!current()||ref?.sourceId!==sourceIdFor()||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))return;
   const state=stateFor();if(ref.version<=(state?.sourceRef?.version??0)||latest&&ref.version<=latest.version)return;
   latest=Object.freeze({sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256});reconcile();
  });
  return Object.freeze({reconcile,
   reset(){generation++;latest=null;shown=null;failedVersion=0;cancel();onClear();},
   pause(){paused=true;generation++;cancel();},
   resume(){paused=false;reconcile();},
   dispose(){if(disposed)return;disposed=true;generation++;cancel();unsubscribe();},
  });
 }});
})();
