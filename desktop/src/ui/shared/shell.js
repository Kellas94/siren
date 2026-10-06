(() => {
 'use strict';
 if(!window.sirenShell||document.body?.dataset.role==='audience')return;
 const palette=window.SirenAppearancePalette,media=matchMedia('(prefers-color-scheme: dark)');
 const aliases={'app-bg':'bg','panel-bg':'panel','panel-alt':'alt','input-bg':'input',text:'ink',muted:'muted',border:'line',primary:'accent','primary-text':'accent-ink','focus-ring':'focus'};
 let bar,select,note,caption,signature='',pending=false,disposed=false,timer,syncing=false,offResume,offReady;
 const preference=window.SirenAppearanceSync.create({get:()=>window.sirenShell.getAppearance(),set:value=>window.sirenShell.setAppearance(value),apply:result=>{
  if(!bar||disposed)return;bar.hidden=false;apply(result.theme);if(typeof result.projectName==='string'){caption.textContent=result.projectName||'Local workspace';caption.title=caption.textContent;}
  if(result.warning==='INVALID_APPEARANCE')note.textContent='Theme settings need recovery. Default appearance in use.';
 },rejected:result=>{signature='';if(note){const code=['ACCESS_REFUSED','INVALID_APPEARANCE','APPEARANCE_WRITE_FAILED','OPERATION_FAILED','REQUEST_REFUSED'].includes(result?.code)?result.code:'OPERATION_FAILED';note.dataset.appearanceError=code;note.textContent=code==='ACCESS_REFUSED'?'Theme change unavailable while the workspace is changing. Try again when ready.':code==='INVALID_APPEARANCE'?'Theme settings need recovery. Your previous settings were retained.':'Theme change could not be confirmed. Check the current theme before trying again.';}},unavailable:()=>{if(bar)bar.hidden=true;}});
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const navigate=async surface=>{
  if(pending||disposed)return;pending=true;bar.setAttribute('aria-busy','true');
  try{const result=await window.sirenShell.navigate({surface});if(!result?.ok)note.textContent='Navigation unavailable. Your work was retained.';}
  catch{note.textContent='Navigation unavailable. Your work was retained.';}
  finally{pending=false;bar.setAttribute('aria-busy','false');}
 };
 function build(){
  bar=make('nav',document.body);bar.id='sirenAppNavigation';bar.hidden=true;bar.setAttribute('aria-label','SIREN workspace');
  const brand=make('button',bar,'S I R Ξ N');brand.type='button';brand.className='siren-wordmark';brand.title='Home';brand.addEventListener('click',()=>void navigate('home'));
  caption=make('small',brand,'Local workspace');caption.className='siren-project-caption';
  const modules=make('div',bar);modules.className='siren-module-navigation';
  const current=document.body.dataset.role|| (location.pathname==='/home.html'?'home':'diagrams');
  for(const [surface,label] of [['home','Home'],['diagrams','Diagrams'],['docs','Docs'],['code','⌘ Code'],['present','Present']]){
   const button=make('button',modules,label);button.type='button';button.dataset.surface=surface;
   if(surface===(current==='diagram'?'diagrams':current==='presenter'?'present':current))button.setAttribute('aria-current','page');
   button.addEventListener('click',()=>void navigate(surface));
  }
  const jump=make('select',bar);jump.className='siren-module-jump';jump.setAttribute('aria-label','Go to module');
  for(const [surface,label] of [['home','Home'],['diagrams','Diagrams'],['docs','Docs'],['code','⌘ Code'],['present','Present']]){const option=make('option',jump,label);option.value=surface;}
  jump.value=current==='diagram'?'diagrams':current==='presenter'?'present':current;
  jump.addEventListener('change',()=>void navigate(jump.value));
  const appearance=make('label',bar);appearance.className='siren-appearance';appearance.title='Application theme';
  const find=make('button',bar,'⌕ Find');find.type='button';find.id='sirenProjectFindButton';find.title='Find saved items by name · Ctrl+Shift+F';find.addEventListener('click',()=>void navigate('find'));bar.insertBefore(find,appearance);
  const label=make('span',appearance,'Theme');label.className='siren-appearance-label';select=make('select',appearance);select.id='sirenAppTheme';select.setAttribute('aria-label','Application theme');
  for(const theme of [{id:'system',name:'System'},...palette]){const option=make('option',select,theme.name);option.value=theme.id;}
  select.addEventListener('change',async()=>{select.disabled=true;try{const result=await preference.choose(select.value);if(result?.ok){note.textContent='';delete note.dataset.appearanceError;}}finally{select.disabled=false;}});
  note=make('span',bar);note.className='siren-navigation-status';note.setAttribute('role','status');
  // Existing light/dark controls remain functional quick choices for the same
  // preference. Programmatic synchronization must never recursively save it.
  for(const key of ['codeTheme','documentTheme','diagramTheme']){const field=document.getElementById(key);if(field){field.title='Quick application theme · More themes in the top bar';field.addEventListener('change',async()=>{
   if(syncing||disposed)return;await preference.choose(field.value);
  });}}
  document.body.classList.add('siren-shell-open');
 }
 function apply(id){
  const effective=id==='system'?(media.matches?'dark':'light'):id,theme=palette.find(t=>t.id===effective);if(!theme)return;
  const next=id+':'+theme.mode;if(signature===next&&(!window.sirenClassicAppearance||window.sirenClassicAppearance.current()===theme.id))return;signature=next;
  syncing=true;try{window.sirenClassicAppearance?.apply(theme.id);}finally{syncing=false;}
  document.documentElement.dataset.theme=theme.id;document.body.dataset.theme=theme.id;document.documentElement.style.colorScheme=theme.mode;
  for(const [key,value] of Object.entries(theme.colors)){
   document.documentElement.style.setProperty('--'+key,value);
   document.documentElement.style.setProperty('--siren-'+aliases[key],value);
  }
  select.value=id;
  syncing=true;try{for(const key of ['codeTheme','documentTheme','diagramTheme']){const field=document.getElementById(key);if(field){field.value=id==='system'?'system':theme.mode;field.dispatchEvent(new Event('change'));}}}finally{syncing=false;}
  document.dispatchEvent(new CustomEvent('siren-appearance',{detail:{theme:id,mode:theme.mode}}));
 }
 const refresh=()=>preference.refresh();
 const start=()=>{build();void refresh();timer=setInterval(()=>void refresh(),1200);offResume=window.sirenViewControl?.onResume(()=>void refresh());offReady=window.sirenWindow?.onReady?.(()=>void refresh());};
 document.addEventListener('siren-classic-appearance',async event=>{
  if(syncing||disposed||event.detail?.user!==true||!palette.some(t=>t.id===event.detail.theme))return;
  const result=await preference.choose(event.detail.theme);if(result?.ok&&note)note.textContent='';
 });
 media.addEventListener('change',()=>{signature='';void refresh();});
 document.addEventListener('keydown',event=>{if(!event.repeat&&(event.ctrlKey||event.metaKey)&&event.shiftKey&&event.key.toLowerCase()==='f'&&!event.altKey){event.preventDefault();void navigate('find');}});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('pagehide',()=>{disposed=true;preference.dispose();clearInterval(timer);offResume?.();offReady?.();},{once:true});
})();
