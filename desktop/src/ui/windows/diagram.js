(() => {
 'use strict';
 const $=id=>document.getElementById(id),status=$('viewStatus'),canvas=$('diagramCanvas'),host=$('diagramRenderHost'),theme=$('diagramTheme'),viewport=$('diagramViewport');
 let disposed=false,paused=false,zoom=1,panX=0,panY=0,drag=null,splitDrag=false,split=32;
 let draft=null,readonly=true,latest=null,previewTimer=null,refreshTimer=null,lastError='';
 const sourceInput=$('diagramSource'),saveButton=$('saveDiagram'),workingButton=$('openWorkingDiagram'),notice=$('diagramChangesNotice');
 function updateState(){
  if(!draft||disposed)return;const state=draft.getStatus();
  saveButton.hidden=readonly;saveButton.disabled=state.pending||state.paused||state.fenced||!state.dirty;
  sourceInput.readOnly=readonly||state.paused||state.pending||state.fenced;
  document.body.dataset.diagramDirty=String(state.dirty);document.body.dataset.diagramVersion=String(state.version);document.body.dataset.diagramSha256=state.sha256;
  status.textContent=lastError||(readonly?'Read only · Mermaid 12.0.0 · Mermaid source colours retained':state.pending?'Saving diagram…':state.fenced?'Save refused · Your local Mermaid source is retained':state.dirty?'Unsaved source · Preview only · Ctrl + S to save':'Diagram saved · Mermaid 12.0.0 · Other project data retained');
 }
 const media=matchMedia('(prefers-color-scheme: dark)'),dark=()=>theme.value==='dark'||theme.value==='system'&&media.matches;
 function appearance(){document.documentElement.style.colorScheme=theme.value==='system'?'light dark':theme.value;document.body.dataset.diagramTheme=dark()?'dark':'light';}
 function transform(){canvas.style.transform='translate('+panX+'px,'+panY+'px) scale('+zoom+')';$('diagramZoom').textContent=Math.round(zoom*100)+'%';}
 function fit(){zoom=1;panX=panY=0;transform();}
 function sanitize(svg){
  const parsed=new DOMParser().parseFromString(svg,'image/svg+xml'),root=parsed.documentElement;
  if(root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg'||parsed.querySelector('parsererror'))throw Error('Invalid preview');
  for(const node of root.querySelectorAll('script,foreignObject,iframe,object,embed,link,image,use'))node.remove();
  for(const node of [root,...root.querySelectorAll('*')]){
   for(const attr of [...node.attributes]){
    const key=attr.localName.toLowerCase(),value=attr.value;
    const externalUrl=[...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(match=>!match[2].trim().startsWith('#'));
    if(key.startsWith('on')||key==='href'&&!value.startsWith('#')||/@import/i.test(value)||externalUrl)node.removeAttributeNode(attr);
   }
   if(node.localName==='style')node.textContent=node.textContent.replace(/@import[^;]*;/gi,'').replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi,(all,_quote,url)=>url.trim().startsWith('#')?all:'none');
  }
  return document.importNode(root,true);
 }
 if(window.__SIREN_ELK)window.mermaid.registerLayoutLoaders(window.__SIREN_ELK);
 const session=window.SirenNativeDiagramSession.create({
  read:()=>window.sirenDiagramRead.getDiagram(),
  async render({source,token}){
   if(source.length>50000)throw Error('Preview budget');
   appearance();window.mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,theme:dark()?'dark':'default',maxTextSize:50000,maxEdges:500,htmlLabels:false,flowchart:{htmlLabels:false},secure:['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','suppressErrorRendering']});
   const target=document.createElement('div');host.append(target);
   try{const result=await window.mermaid.render('nativeDiagram_'+token,source,target);return sanitize(result.svg);}finally{target.remove();}
  },
  onSource(result){
   const own=window.SirenNativeDiagramDraft.create({context:result,bridge:{...window.sirenDiagramEdit,getDiagram:window.sirenDiagramRead.getDiagram},onChange:updateState});draft?.dispose();draft=own;readonly=result.readonly;lastError='';latest=null;notice.hidden=true;
   sourceInput.value=result.diagram.source;$('diagramSourceLabel').textContent=readonly?'Exact saved Mermaid · Read only':'Working Mermaid · Save explicitly';workingButton.hidden=!readonly||result.canEdit!==true;
   $('viewTitle').textContent=result.diagram.name||'Diagrams';document.body.dataset.diagramId=result.diagram.id;document.body.dataset.diagramReadonly=String(readonly);document.body.dataset.diagramReady='true';document.body.dataset.diagramRendered='false';canvas.replaceChildren();updateState();
  },
  onPreview(svg){canvas.replaceChildren(svg);fit();document.body.dataset.diagramRendered='true';lastError='';updateState();},
  onError(){document.body.dataset.diagramRendered='false';lastError=sourceInput.value.length>50000?'Your source is retained. Preview supports up to 50,000 characters.':'The preview could not render. Your exact source and project data were retained.';updateState();}
 });
 const refresh=()=>{if(!paused&&!disposed)void session.refresh();};
 const replace=()=>{if(paused||disposed||draft?.getStatus().pending)return;if(draft?.getStatus().dirty&&!confirm('Discard local Mermaid changes and read the latest saved diagram?'))return;clearTimeout(previewTimer);refresh();};
 const preview=()=>{if(paused||disposed||!draft)return;document.body.dataset.diagramRendered='false';void session.renderLocal(draft.getDiagram().source);};
 $('refreshDiagram').addEventListener('click',replace);theme.addEventListener('change',preview);media.addEventListener('change',()=>{if(theme.value==='system')preview();});
 sourceInput.addEventListener('input',()=>{if(!draft)return;lastError='';const result=draft.setSource(sourceInput.value);if(!result.ok){sourceInput.value=draft.getDiagram().source;return;}clearTimeout(previewTimer);previewTimer=setTimeout(preview,250);});
 const save=async()=>{if(paused||disposed||readonly||!draft)return;lastError='';const result=await draft.save();if(!result.ok){lastError=result.code==='DOMAIN_VALIDATION_FAILED'?'Save refused by project validation · Correct the source and try again':'Save refused · Your local source is retained. Review the saved diagram separately or reload explicitly.';notice.hidden=false;$('diagramChangesMessage').textContent='Your local source was retained.';}updateState();};
 const openCopy=async method=>{if(paused||disposed)return;const result=await window.sirenDiagramEdit[method]();if(!result?.ok){lastError='The diagram window could not open. Your source is retained.';updateState();}};
 workingButton.addEventListener('click',()=>{void openCopy('openWorkingCopy');});saveButton.addEventListener('click',()=>{void save();});$('reviewLatestDiagram').addEventListener('click',()=>{void openCopy('openLatest');});$('replaceLatestDiagram').addEventListener('click',replace);
 const off=window.sirenDiagramEdit.onReferenceChanged(ref=>{if(disposed||paused||readonly||ref.diagramId!==draft?.getStatus().diagramId||ref.version===draft.getStatus().version||ref.projectRevision<=(latest?.projectRevision??draft.getStatus().projectRevision))return;latest=ref;notice.hidden=false;$('diagramChangesMessage').textContent='The saved diagram changed in another window. Your local source is retained.';if(!draft.getStatus().dirty&&!draft.getStatus().pending&&!draft.getStatus().fenced){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(!paused&&!disposed&&!draft.getStatus().dirty&&!draft.getStatus().pending&&!draft.getStatus().fenced)refresh();},250);}});
 window.addEventListener('keydown',event=>{if(event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.isComposing&&event.key.toLowerCase()==='s'&&!readonly){event.preventDefault();if(!event.repeat)void save();}});
 $('toggleDiagramSource').addEventListener('click',()=>{const hidden=!$('diagramSourcePanel').hidden;$('diagramSourcePanel').hidden=$('diagramDivider').hidden=hidden;$('diagramLayout').dataset.sourceHidden=String(hidden);$('toggleDiagramSource').textContent=hidden?'Show source':'Hide source';$('toggleDiagramSource').setAttribute('aria-expanded',String(!hidden));});
 const scale=amount=>{zoom=Math.max(.2,Math.min(5,zoom*amount));transform();};$('diagramZoomIn').addEventListener('click',()=>scale(1.2));$('diagramZoomOut').addEventListener('click',()=>scale(1/1.2));$('diagramFit').addEventListener('click',fit);
 viewport.addEventListener('wheel',event=>{if(!event.ctrlKey)return;event.preventDefault();scale(event.deltaY<0?1.1:1/1.1);},{passive:false});
 viewport.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('a'))return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,panX,panY};viewport.setPointerCapture(event.pointerId);});
 viewport.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;panX=drag.panX+event.clientX-drag.x;panY=drag.panY+event.clientY-drag.y;transform();});
 const stop=()=>{drag=null;};viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',stop);viewport.addEventListener('lostpointercapture',stop);
 const divider=$('diagramDivider');function resize(value){split=Math.max(20,Math.min(70,value));$('diagramLayout').style.setProperty('--source-width',split+'%');divider.setAttribute('aria-valuenow',String(Math.round(split)));}
 divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;splitDrag=true;divider.setPointerCapture(event.pointerId);});divider.addEventListener('pointermove',event=>{if(!splitDrag)return;const rect=$('diagramLayout').getBoundingClientRect();resize(100*(event.clientX-rect.left)/rect.width);});for(const name of ['pointerup','pointercancel','lostpointercapture'])divider.addEventListener(name,()=>{splitDrag=false;});
 divider.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();resize(split+(event.key==='ArrowRight'?2:-2));}});
 $('closeView').addEventListener('click',async()=>{const own=await window.sirenWindow.getView();if(own?.ok!==true)return;const result=await window.sirenWindow.closeView({windowId:own.view.windowId});if(!result?.ok)status.textContent='The window could not close. Your saved diagram was retained.';});
 window.sirenViewControl.onPrepare(async()=>{paused=true;clearTimeout(previewTimer);clearTimeout(refreshTimer);document.body.inert=true;document.documentElement.style.visibility='hidden';stop();splitDrag=false;const ready=await session.pause();if(draft&&!readonly){const result=await draft.flushView();return {ok:ready&&result.ok===true,...(!result.ok?{code:result.code}:{})};}return {ok:ready};});
 window.sirenViewControl.onResume(()=>{if(disposed||!paused)return;session.resume();paused=false;draft?.resumeView();if(draft)sourceInput.value=draft.getDiagram().source;document.body.inert=false;document.documentElement.style.visibility='';preview();});
 window.addEventListener('pagehide',()=>{disposed=true;off();clearTimeout(previewTimer);clearTimeout(refreshTimer);draft?.dispose();session.dispose();canvas.replaceChildren();host.replaceChildren();sourceInput.value='';});
 window.sirenWindow.onReady(refresh);appearance();refresh();
})();
