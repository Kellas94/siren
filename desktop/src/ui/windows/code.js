(() => {
  'use strict';
  const surface=document.getElementById('codeSurface'),status=document.getElementById('viewStatus'),retry=document.getElementById('retrySource'),theme=document.getElementById('codeTheme'),working=document.getElementById('openWorkingCopy');
  const media=matchMedia('(prefers-color-scheme: dark)');let generation=0,editor=null,client=null,disposed=false,paused=false;
  const linkButton=document.getElementById('linkCodeDocs');let links=null;
  const appearance=()=>theme.value==='system'?(media.matches?'dark':'light'):theme.value;
  const clear=()=>{links?.pause();linkButton.hidden=true;editor?.dispose();client?.dispose();editor=null;client=null;surface.replaceChildren();document.body.dataset.sourceReady='false';for(const key of ['sourceId','sourceVersion','sourceSha256','sourceUnits','sourceLines'])delete document.body.dataset[key];};
  const paint=()=>{const value=appearance();document.documentElement.style.colorScheme=value;editor?.setTheme(value);};
  async function connect(){
    if(disposed||paused)return false;
    const token=++generation;clear();retry.hidden=true;status.textContent='Opening selected source…';paint();
    try{
      const context=await window.sirenSourceRead.getReference();if(token!==generation||disposed)return false;
      if(!context?.ok||typeof context.readonly!=='boolean')throw Error('Source reference unavailable');
      const readonly=context.readonly;working.hidden=!readonly||context.canEdit!==true;
      const bridge=Object.freeze(Object.fromEntries([
        ...['getMetrics','readRange',...(!readonly?['applyEdit','commitSource']:[])].map(name=>[name,payload=>window.sirenSource[name](payload)]),
        ...['openRead','readChunk','closeRead'].map(name=>[name,payload=>window.sirenSourceRead[name](payload)])
      ]));
      client=SirenCodeEditor.sourceClient({bridge,sourceRef:context.sourceRef,readonly});
      const metrics=await client.getMetrics();if(token!==generation||disposed)return false;
      if(!metrics.ok)throw Error('Source metrics refused');
      editor=SirenCodeEditor.createCodeEditor({container:surface,client,theme:appearance(),readonly});
      const ownEditor=editor,receipt=await ownEditor.open(context.sourceRef);
      if(token!==generation||disposed||editor!==ownEditor)return false;
      if(!receipt.ok)throw Error('Source load refused');
      const state=ownEditor.getState();
      status.textContent=`${readonly?'Read only':'Working copy'} · Version ${context.sourceRef.version} · ${metrics.utf8Bytes.toLocaleString()} bytes · ${metrics.lines.toLocaleString()} lines`;
      document.body.dataset.sourceReady='true';document.body.dataset.sourceId=context.sourceRef.sourceId;document.body.dataset.sourceVersion=String(context.sourceRef.version);document.body.dataset.sourceSha256=context.sourceRef.sha256;
      document.body.dataset.sourceUnits=String(state.doc.length);document.body.dataset.sourceLines=String(metrics.lines);
      document.body.dataset.sourceReadonly=String(readonly);
      linkButton.hidden=readonly;
      client.subscribeSource(event=>{if(token!==generation||disposed)return;document.body.dataset.sourceVersion=String(event.version);document.body.dataset.sourceSha256=event.sha256;});
      ownEditor.focus();return true;
    }catch{
      if(token===generation&&!disposed){clear();status.textContent='Source could not be opened. Existing project data was retained.';retry.hidden=false;}
      return false;
    }
  }
  links=window.SirenNativeDocsLinks.create({button:linkButton,editorFor:()=>editor,isCurrent:()=>!disposed&&!paused&&document.body.dataset.sourceReady==='true'&&document.body.dataset.sourceReadonly==='false',onStatus:text=>{status.textContent=text;}});
  const changed=()=>paint();theme.addEventListener('change',changed);media.addEventListener('change',changed);
  retry.addEventListener('click',()=>{void connect();});
  working.addEventListener('click',async()=>{
    if(disposed||paused||working.disabled)return;working.disabled=true;
    try{const result=await window.sirenSourceEdit.openWorkingCopy();if(!disposed&&!paused)status.textContent=result?.ok?'Working copy opened in a new Code window. Save source stores a version; linking to Docs is separate.':'Working copy could not be opened. Existing source and Docs were retained.';}
    catch{if(!disposed&&!paused)status.textContent='Working copy could not be opened. Existing source and Docs were retained.';}
    finally{working.disabled=false;}
  });
  window.sirenViewControl.onPrepare(async()=>{
    paused=true;links.pause();document.body.inert=true;document.documentElement.style.visibility='hidden';
    const current=editor;
    if(!current||document.body.dataset.sourceReady!=='true')return {ok:false};
    const result=await current.flushView();
    return {ok:result?.ok===true&&editor===current&&!disposed,...(result?.ok!==true?{code:result?.code||'VIEW_NOT_READY'}:{})};
  });
  window.sirenViewControl.onResume(()=>{
    if(!paused||disposed)return;
    if(editor?.resumeView()?.ok!==true){
      clear();status.textContent='Preparation was refused. The saved source was retained; reopen it to continue.';retry.hidden=false;
    }
    paused=false;document.body.inert=false;document.documentElement.style.visibility='';
  });
  window.addEventListener('beforeunload',()=>{disposed=true;generation++;links.dispose();clear();media.removeEventListener('change',changed);},{once:true});
  window.sirenNativeCodeView=Object.freeze({connect});
})();
