(() => {
 'use strict';
 const bridge=window.sirenPresentation,role=document.body.dataset.role,status=document.getElementById('viewStatus'),surface=document.getElementById('publicSlide');
 if(role==='presenter')document.getElementById('editDeck').addEventListener('click',async()=>{if(busy||covered||!state)return;const turn=serial;busy=true;controls();try{const result=await bridge.editDeck();if(!covered&&turn===serial)status.textContent=result?.ok?'Deck editor opened · Playback keeps this saved version until Refresh.':'Deck editor unavailable. Your presentation is retained.';}catch{if(!covered&&turn===serial)status.textContent='Deck editor unavailable.';}finally{if(turn===serial){busy=false;controls();flushAppearance();}}});
 let grant=null,state=null,sequence=0,serial=0,busy=false,covered=false,last=0,connecting=null,pendingAppearance=false,appearanceSignature='';
 const flushAppearance=()=>{if(role!=='presenter'||!pendingAppearance||busy||covered||connecting||!state)return;pendingAppearance=false;void navigate(state.slideId);};
 document.addEventListener('siren-appearance',event=>{if(role!=='presenter'||covered)return;const detail=event.detail;if(!detail||typeof detail.theme!=='string'||!['light','dark'].includes(detail.mode))return;const themes=window.SirenAppearancePalette;if(!themes?.some(t=>t.id===(detail.theme==='system'?detail.mode:detail.theme)&&t.mode===detail.mode))return;const next=detail.theme+':'+detail.mode;if(next===appearanceSignature)return;appearanceSignature=next;pendingAppearance=true;flushAppearance();});
 const notesExport=role==='presenter'?window.SirenPresenterNotesExport.create({button:document.getElementById('exportNotes'),revealButton:document.getElementById('revealNotesExport'),bridge:window.sirenPresenterExport,getState:()=>state,isReady:()=>!covered&&!busy&&!!state,onStatus:text=>status.textContent=text}):null;
 const controls=()=>{for(const e of document.querySelectorAll('button,select'))e.disabled=covered||busy;notesExport?.update();};
 const blank=()=>{surface.replaceChildren();last=0;document.body.dataset.publicReady='false';};
 const frame=async value=>{
  const turn=serial;if(covered||!grant||value.epoch!==grant.epoch||value.sequence<=last)return false;
  const publicSlide=value.publicSlide;let content;
  if(publicSlide.kind==='image'){content=new Image();content.alt=publicSlide.title;content.src=publicSlide.image;await content.decode();}
  else{content=document.createElement('div');const title=document.createElement('h1');title.textContent=publicSlide.title;const body=document.createElement('p');body.textContent=publicSlide.body;content.append(title,body);}
  if(covered||turn!==serial||value.sequence<=last)return false;surface.replaceChildren(content);last=value.sequence;document.body.dataset.publicReady='true';document.body.dataset.slideId=value.slideId;document.body.dataset.deckVersion=value.deckVersion;document.body.dataset.sequence=String(last);
  if(role==='audience'){status.textContent=publicSlide.title;const result=await bridge.acknowledge({deckVersion:value.deckVersion,sequence:value.sequence});if(!result?.ok&&!covered&&turn===serial)status.textContent='Presentation changed. Waiting for a new frame.';}
  return true;
 };
 const paint=()=>{
  if(!state)return;document.getElementById('viewTitle').textContent=state.deck.title;
  const list=document.getElementById('slideList');list.replaceChildren();for(const [index,slide]of state.deck.slides.entries()){const b=document.createElement('button');b.type='button';b.textContent=String(index+1).padStart(2,'0')+'  '+slide.title;b.dataset.slideId=slide.id;b.setAttribute('aria-current',String(slide.id===state.slideId));b.addEventListener('click',()=>void navigate(slide.id));list.append(b);}
  const slide=state.deck.slides.find(item=>item.id===state.slideId);document.getElementById('presenterNotes').textContent=slide?.notes||'No presenter notes for this slide.';document.getElementById('position').textContent=(state.deck.slides.indexOf(slide)+1)+' / '+state.deck.slides.length;
  controls();
 };
 const navigate=async id=>{
  if(covered||busy||!state)return;busy=true;controls();status.textContent='Preparing slide…';const turn=serial;
  try{const result=await bridge.navigate({deckVersion:state.deck.version,sequence:++sequence,slideId:id});if(covered||turn!==serial)return;
   if(!result?.ok){status.textContent='This slide could not be rendered. The last public slide and your saved deck are retained.';return;}
   state={...state,slideId:result.slideId};paint();const preview=await bridge.getPreview();if(preview?.ok)await frame(preview.frame);if(!covered&&turn===serial)status.textContent='Presenting · Saved deck version';
  }catch{if(!covered&&turn===serial)status.textContent='Presentation unavailable. Your saved deck is retained.';}finally{if(turn===serial){busy=false;controls();flushAppearance();}}
 };
 const connect=()=>connecting??=(async()=>{
  const turn=serial,view=await window.sirenWindow.getView();if(covered||turn!==serial||!view?.ok||view.view.role!==role)return;grant=view.view;document.body.dataset.connected='true';
  if(role==='presenter'){
   const actual=await bridge.getPresenter();if(covered||turn!==serial||!actual?.ok){status.textContent='The saved presentation is unavailable.';return;}state=actual;sequence=Math.max(sequence,actual.sequence);paint();document.body.dataset.presentationReady='true';
   const displays=await bridge.getDisplays();if(covered||turn!==serial)return;if(displays?.ok){const select=document.getElementById('audienceDisplay');select.replaceChildren();for(const display of displays.displays){const option=document.createElement('option');option.value=display.id;option.textContent=display.label;select.append(option);}}
   pendingAppearance=false;await navigate(state.slideId);
  }else{document.body.dataset.presentationReady='true';const current=await bridge.getFrame();if(current?.ok)await frame(current.frame);else status.textContent='Waiting for the presenter…';}
 })().catch(()=>{if(!covered)status.textContent='Presentation unavailable. Your saved work is retained.';}).finally(()=>{connecting=null;flushAppearance();});
 const reconnect=()=>{const turn=serial;void Promise.resolve(connecting).then(()=>{if(!covered&&turn===serial&&document.body.dataset.presentationReady!=='true')return connect();});};
 bridge.onFrame(value=>{if(role==='audience')return frame(value);});window.sirenWindow.onReady(reconnect);
 bridge.onFullscreen(value=>{document.body.dataset.fullscreen=String(value.enabled);});
 window.sirenViewControl.onPrepare(()=>{covered=true;serial++;busy=false;pendingAppearance=false;appearanceSignature='';grant=null;state=null;blank();document.body.dataset.presentationReady='false';document.getElementById('presenterNotes')?.replaceChildren();document.getElementById('slideList')?.replaceChildren();document.body.inert=true;document.documentElement.style.visibility='hidden';return notesExport?.pause()??{ok:true};});
 window.sirenViewControl.onResume(()=>{covered=false;serial++;document.body.inert=false;document.documentElement.style.visibility='';notesExport?.resume();blank();reconnect();});
 document.getElementById('closeView').addEventListener('click',()=>{if(grant)void window.sirenWindow.closeView({windowId:grant.windowId});});
 document.getElementById('fullscreen').addEventListener('click',()=>void bridge.setFullscreen({enabled:true}));
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();void bridge.setFullscreen({enabled:false});}
  if(event.ctrlKey&&event.key.toLowerCase()==='w'){event.preventDefault();if(grant)void window.sirenWindow.closeView({windowId:grant.windowId});}
  const interactive=event.target?.isContentEditable||event.target?.closest?.('button,select,input,textarea,a[href],[role="button"],[contenteditable]');
  if(role==='presenter'&&!interactive&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&['ArrowRight','ArrowLeft','PageDown','PageUp',' '].includes(event.key)){event.preventDefault();const offset=['ArrowLeft','PageUp'].includes(event.key)?-1:1,index=state?.deck.slides.findIndex(s=>s.id===state.slideId);if(index>=0)void navigate(state.deck.slides[Math.max(0,Math.min(state.deck.slides.length-1,index+offset))].id);}
 });
 if(role==='presenter'){
  for(const [id,offset]of [['previousSlide',-1],['nextSlide',1]])document.getElementById(id).addEventListener('click',()=>{const index=state?.deck.slides.findIndex(s=>s.id===state.slideId);if(index>=0)void navigate(state.deck.slides[Math.max(0,Math.min(state.deck.slides.length-1,index+offset))].id);});
  document.getElementById('refreshDeck').addEventListener('click',async()=>{if(busy||covered||!state)return;notesExport.reset();busy=true;controls();const turn=serial;try{const result=await bridge.refreshDeck({deckVersion:state.deck.version});if(covered||turn!==serial)return;if(!result?.ok){status.textContent='The saved deck could not be refreshed. Your current version is retained.';return;}const actual=await bridge.getPresenter();if(covered||turn!==serial)return;if(!actual?.ok){status.textContent='The saved deck could not be read. Your current view is retained.';return;}state=actual;sequence=Math.max(sequence,actual.sequence);blank();paint();busy=false;await navigate(state.slideId);}catch{if(!covered&&turn===serial)status.textContent='Refresh unavailable. Your current view and saved deck are retained.';}finally{if(turn===serial){busy=false;controls();flushAppearance();}}});
  document.getElementById('openAudience').addEventListener('click',async()=>{if(busy||covered||!state)return;busy=true;controls();const turn=serial;try{const displayId=document.getElementById('audienceDisplay').value,result=await bridge.openAudience(displayId?{displayId}:{});if(covered||turn!==serial)return;if(!result?.ok){status.textContent='Audience could not be opened. Your presentation remains available.';return;}busy=false;await navigate(state.slideId);}catch{if(!covered&&turn===serial)status.textContent='Audience unavailable. Your presentation remains available.';}finally{if(turn===serial){busy=false;controls();flushAppearance();}}});
 }
 window.addEventListener('pagehide',()=>{covered=true;serial++;pendingAppearance=false;grant=null;state=null;},{once:true});
 void connect();
})();
