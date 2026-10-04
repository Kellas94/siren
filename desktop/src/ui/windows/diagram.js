(() => {
 'use strict';
 const $=id=>document.getElementById(id),status=$('viewStatus'),canvas=$('diagramCanvas'),host=$('diagramRenderHost'),theme=$('diagramTheme'),viewport=$('diagramViewport');
 let disposed=false,paused=false,zoom=1,panX=0,panY=0,drag=null,splitDrag=false,split=32;
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
  onSource(result){$('diagramSource').value=result.diagram.source;$('viewTitle').textContent=result.diagram.name||'Diagrams';document.body.dataset.diagramId=result.diagram.id;document.body.dataset.diagramVersion=String(result.version);document.body.dataset.diagramReadonly='true';document.body.dataset.diagramReady='true';document.body.dataset.diagramRendered='false';canvas.replaceChildren();status.textContent='Rendering saved diagram…';},
  onPreview(svg){canvas.replaceChildren(svg);fit();document.body.dataset.diagramRendered='true';status.textContent='Read only · Mermaid 12.0.0 · Declared colours retained · Refresh to read saved changes';},
  onError(){status.textContent=session.context?.diagram.source.length>50000?'The saved source is available. Preview supports up to 50,000 characters.':'The preview could not render. Your exact saved source and project data were retained.';}
 });
 const refresh=()=>{if(!paused&&!disposed)void session.refresh();};
 $('refreshDiagram').addEventListener('click',refresh);theme.addEventListener('change',refresh);media.addEventListener('change',()=>{if(theme.value==='system')refresh();});
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
 window.sirenViewControl.onPrepare(async()=>{paused=true;document.body.inert=true;document.documentElement.style.visibility='hidden';stop();splitDrag=false;return {ok:await session.pause()};});
 window.sirenViewControl.onResume(()=>{if(disposed||!paused)return;session.resume();paused=false;document.body.inert=false;document.documentElement.style.visibility='';});
 window.addEventListener('pagehide',()=>{disposed=true;session.dispose();canvas.replaceChildren();host.replaceChildren();$('diagramSource').value='';});
 window.sirenWindow.onReady(refresh);appearance();refresh();
})();
