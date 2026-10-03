(() => {
  'use strict';
  const surface=document.getElementById('codeSurface'),status=document.getElementById('viewStatus'),retry=document.getElementById('retrySource'),theme=document.getElementById('codeTheme');
  const media=matchMedia('(prefers-color-scheme: dark)');let generation=0,editor=null,client=null,disposed=false;
  const appearance=()=>theme.value==='system'?(media.matches?'dark':'light'):theme.value;
  const clear=()=>{editor?.dispose();client?.dispose();editor=null;client=null;surface.replaceChildren();document.body.dataset.sourceReady='false';for(const key of ['sourceId','sourceVersion','sourceSha256','sourceUnits','sourceLines'])delete document.body.dataset[key];};
  const paint=()=>{const value=appearance();document.documentElement.style.colorScheme=value;editor?.setTheme(value);};
  async function connect(){
    if(disposed)return false;
    const token=++generation;clear();retry.hidden=true;status.textContent='Opening selected source…';paint();
    try{
      const context=await window.sirenSourceRead.getReference();if(token!==generation||disposed)return false;
      if(!context?.ok||context.readonly!==true)throw Error('Source reference unavailable');
      const bridge=Object.freeze(Object.fromEntries([
        ...['getMetrics','readRange'].map(name=>[name,payload=>window.sirenSource[name](payload)]),
        ...['openRead','readChunk','closeRead'].map(name=>[name,payload=>window.sirenSourceRead[name](payload)])
      ]));
      client=SirenCodeEditor.sourceClient({bridge,sourceRef:context.sourceRef,readonly:true});
      const metrics=await client.getMetrics();if(token!==generation||disposed)return false;
      if(!metrics.ok)throw Error('Source metrics refused');
      editor=SirenCodeEditor.createCodeEditor({container:surface,client,theme:appearance(),readonly:true});
      const ownEditor=editor,receipt=await ownEditor.open(context.sourceRef);
      if(token!==generation||disposed||editor!==ownEditor)return false;
      if(!receipt.ok)throw Error('Source load refused');
      const state=ownEditor.getState();
      status.textContent=`Read only · Version ${context.sourceRef.version} · ${metrics.utf8Bytes.toLocaleString()} bytes · ${metrics.lines.toLocaleString()} lines`;
      document.body.dataset.sourceReady='true';document.body.dataset.sourceId=context.sourceRef.sourceId;document.body.dataset.sourceVersion=String(context.sourceRef.version);document.body.dataset.sourceSha256=context.sourceRef.sha256;
      document.body.dataset.sourceUnits=String(state.doc.length);document.body.dataset.sourceLines=String(metrics.lines);
      ownEditor.focus();return true;
    }catch{
      if(token===generation&&!disposed){clear();status.textContent='Source could not be opened. Existing project data was retained.';retry.hidden=false;}
      return false;
    }
  }
  const changed=()=>paint();theme.addEventListener('change',changed);media.addEventListener('change',changed);
  retry.addEventListener('click',()=>{void connect();});
  window.addEventListener('beforeunload',()=>{disposed=true;generation++;clear();media.removeEventListener('change',changed);},{once:true});
  window.sirenNativeCodeView=Object.freeze({connect});
})();
