(() => {
  'use strict';
  const surface=document.getElementById('codeSurface'),status=document.getElementById('viewStatus'),retry=document.getElementById('retrySource'),theme=document.getElementById('codeTheme'),working=document.getElementById('openWorkingCopy');
  const media=matchMedia('(prefers-color-scheme: dark)');let generation=0,editor=null,client=null,disposed=false,paused=false;
  const linkButton=document.getElementById('linkCodeDocs');let links=null,analysis=null;
  const changeNotice=document.getElementById('sourceChangesNotice'),changeMessage=document.getElementById('sourceChangesMessage'),reviewLatest=document.getElementById('reviewLatestSource');let sourceChanges=null,unsubscribeEditor=null,nativeSourceId=null;
  const appearance=()=>theme.value==='system'?(media.matches?'dark':'light'):theme.value;
  const clear=()=>{analysis?.reset();links?.pause();sourceChanges?.reset();unsubscribeEditor?.();unsubscribeEditor=null;linkButton.hidden=true;editor?.dispose();client?.dispose();editor=null;client=null;surface.replaceChildren();document.body.dataset.sourceReady='false';for(const key of ['sourceId','sourceVersion','sourceSha256','sourceUnits','sourceLines'])delete document.body.dataset[key];analysis?.reconcile();};
  const paint=()=>{const value=appearance();document.documentElement.style.colorScheme=value;editor?.setTheme(value);};
  async function connect({preserveCurrent=false}={}){
    if(disposed||paused)return false;
    const previousEditor=editor,previousClient=client,previousStatus=status.textContent;
    const preserve=preserveCurrent&&previousEditor?.getStatus().ready&&!previousEditor.getStatus().dirty&&!previousEditor.getStatus().pending&&!previousEditor.getStatus().saving&&!previousEditor.getStatus().fenced;
    if(preserve&&previousEditor.pauseView()?.ok!==true)return false;
    const token=++generation;if(!preserve)clear();retry.hidden=true;status.textContent=preserve?'Refreshing source from another window…':'Opening selected source…';paint();
    let candidateEditor=null,candidateClient=null,staging=null;
    try{
      const context=await window.sirenSourceRead.getReference();if(token!==generation||disposed)return false;
      if(!context?.ok||typeof context.readonly!=='boolean')throw Error('Source reference unavailable');
      nativeSourceId=context.sourceRef.sourceId;
      const readonly=context.readonly;working.hidden=!readonly||context.canEdit!==true;
      const bridge=Object.freeze(Object.fromEntries([
        ...['getMetrics','readRange',...(!readonly?['applyEdit','commitSource']:[])].map(name=>[name,payload=>window.sirenSource[name](payload)]),
        ...['openRead','readChunk','closeRead'].map(name=>[name,payload=>window.sirenSourceRead[name](payload)])
      ]));
      candidateClient=SirenCodeEditor.sourceClient({bridge,sourceRef:context.sourceRef,readonly});
      const metrics=await candidateClient.getMetrics();if(token!==generation||disposed)return false;
      if(!metrics.ok)throw Error('Source metrics refused');
      if(preserve){staging=document.createElement('div');staging.style.cssText=`position:fixed;left:-100000px;top:0;width:${surface.clientWidth}px;height:${surface.clientHeight}px;visibility:hidden`;document.body.append(staging);}
      candidateEditor=SirenCodeEditor.createCodeEditor({container:staging??surface,client:candidateClient,theme:appearance(),readonly});
      const ownEditor=candidateEditor,receipt=await ownEditor.open(context.sourceRef);
      if(token!==generation||disposed||paused)return false;
      if(!receipt.ok)throw Error('Source load refused');
      if(preserve){
        const current=await window.sirenSourceRead.getReference();
        if(token!==generation||disposed||paused)return false;
        if(!current?.ok||current.readonly!==readonly||['sourceId','version','sha256'].some(key=>current.sourceRef[key]!==context.sourceRef[key]))throw Error('Source changed during refresh');
        links.pause();unsubscribeEditor?.();previousEditor.dispose();previousClient.dispose();surface.replaceChildren(...staging.childNodes);
      }
      editor=candidateEditor;client=candidateClient;candidateEditor=null;candidateClient=null;
      const state=ownEditor.getState();
      status.textContent=`${readonly?'Read only':'Working copy'} · Version ${context.sourceRef.version} · ${metrics.utf8Bytes.toLocaleString()} bytes · ${metrics.lines.toLocaleString()} lines`;
      document.body.dataset.sourceReady='true';document.body.dataset.sourceId=context.sourceRef.sourceId;document.body.dataset.sourceVersion=String(context.sourceRef.version);document.body.dataset.sourceSha256=context.sourceRef.sha256;
      document.body.dataset.sourceUnits=String(state.doc.length);document.body.dataset.sourceLines=String(metrics.lines);
      document.body.dataset.sourceReadonly=String(readonly);
      linkButton.hidden=readonly;
      client.subscribeSource(event=>{if(token!==generation||disposed)return;document.body.dataset.sourceVersion=String(event.version);document.body.dataset.sourceSha256=event.sha256;});
      unsubscribeEditor=ownEditor.subscribe(()=>{sourceChanges.reconcile();analysis?.reconcile();});sourceChanges.reconcile();analysis?.reconcile();
      ownEditor.focus();return true;
    }catch{
      if(token===generation&&!disposed){
        if(preserve){if(!paused)previousEditor.resumeView();status.textContent=previousStatus;}
        else{clear();status.textContent='Source could not be opened. Existing project data was retained.';}
        retry.hidden=false;
      }
      return false;
    }finally{candidateEditor?.dispose();candidateClient?.dispose();staging?.remove();if(preserve&&editor===previousEditor&&!paused&&!disposed)previousEditor.resumeView();}
  }
  links=window.SirenNativeDocsLinks.create({button:linkButton,editorFor:()=>editor,isCurrent:()=>!disposed&&!paused&&document.body.dataset.sourceReady==='true'&&document.body.dataset.sourceReadonly==='false',onStatus:text=>{status.textContent=text;}});
  sourceChanges=window.SirenNativeSourceChanges.create({subscribe:callback=>window.sirenSourceEdit.onReferenceChanged(callback),sourceIdFor:()=>nativeSourceId,stateFor:()=>editor?.getStatus(),isCurrent:()=>!disposed&&!paused&&nativeSourceId!==null&&document.body.dataset.sourceReadonly!=='true',onReload:async()=>{
    const selection=editor?.getState()?.selection?.main,cursor=selection?{anchor:selection.anchor,head:selection.head}:null;
    const ok=await connect({preserveCurrent:true});if(ok&&cursor&&editor){const length=editor.getState().doc.length;editor.select(Math.min(cursor.anchor,length),Math.min(cursor.head,length));}return ok;
  },onRetained:ref=>{changeNotice.hidden=false;changeMessage.textContent=`Version ${ref.version} was stored in another window. Your local text is retained.`;},onClear:()=>{changeNotice.hidden=true;}});
  const changed=()=>paint();theme.addEventListener('change',changed);media.addEventListener('change',changed);
  analysis=window.SirenNativeAnalysis.create({button:document.getElementById('toggleAnalysis'),panel:document.getElementById('codeAnalysis'),editorFor:()=>editor,bridge:window.sirenSourceAnalysis});
  const replaceLatest=()=>{
    if(disposed||paused)return;const state=editor?.getStatus();
    if((state?.dirty||state?.fenced)&&!window.confirm('Discard the local text in this window and load the latest stored source? Other windows and stored source versions are retained.'))return;
    void connect();
  };
  retry.addEventListener('click',replaceLatest);
  const openWorking=async()=>{
    if(disposed||paused||working.disabled||reviewLatest.disabled)return;working.disabled=reviewLatest.disabled=true;
    try{const result=await window.sirenSourceEdit.openWorkingCopy();if(!disposed&&!paused)status.textContent=result?.ok?'Working copy opened in a new Code window. Save source stores a version; linking to Docs is separate.':'Working copy could not be opened. Existing source and Docs were retained.';}
    catch{if(!disposed&&!paused)status.textContent='Working copy could not be opened. Existing source and Docs were retained.';}
    finally{working.disabled=reviewLatest.disabled=false;}
  };
  working.addEventListener('click',openWorking);reviewLatest.addEventListener('click',openWorking);
  document.getElementById('replaceLatestSource').addEventListener('click',replaceLatest);
  window.sirenViewControl.onPrepare(async()=>{
    paused=true;analysis.pause();links.pause();sourceChanges.pause();document.body.inert=true;document.documentElement.style.visibility='hidden';
    const current=editor;
    if(!current||document.body.dataset.sourceReady!=='true')return {ok:false};
    const result=await current.flushView();
    return {ok:result?.ok===true&&editor===current&&!disposed,...(result?.ok!==true?{code:result?.code||'VIEW_NOT_READY'}:{})};
  });
  window.sirenViewControl.onResume(()=>{
    if(!paused||disposed)return;
    if(editor?.resumeView()?.ok!==true){
      if(editor?.getState()){changeNotice.hidden=false;changeMessage.textContent='Preparation was refused. Your local text is retained.';status.textContent='Review the latest source separately or explicitly replace this local view.';}
      else{clear();status.textContent='Preparation was refused. The saved source was retained; reopen it to continue.';}
      retry.hidden=false;
    }
    paused=false;sourceChanges.resume();analysis.resume();document.body.inert=false;document.documentElement.style.visibility='';
  });
  window.addEventListener('beforeunload',()=>{disposed=true;generation++;analysis.dispose();links.dispose();sourceChanges.dispose();clear();media.removeEventListener('change',changed);},{once:true});
  window.sirenNativeCodeView=Object.freeze({connect});
})();
