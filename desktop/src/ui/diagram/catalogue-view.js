(() => {
 'use strict';
 const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const integer=value=>Number.isSafeInteger(value)&&value>=0;
 const text=(value,max,empty=false)=>typeof value==='string'&&(empty||value.length>0)&&value.length<=max&&value.isWellFormed();
 const fields=(value,names)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const descriptors=Object.getOwnPropertyDescriptors(value),out={};
  for(const name of names){const d=descriptors[name];if(!d||!Object.hasOwn(d,'value'))return null;out[name]=d.value;}
  return out;
 };
 function finitePage(value,kind,cursor){
  try{
   const page=fields(value,['ok','rows','total','nextCursor','canCreate','version','referenceSha256']);
   if(page?.ok!==true||!Array.isArray(page.rows)||page.rows.length>20||!integer(page.total)||page.total>32||cursor>page.total||page.rows.length>page.total-cursor||typeof page.canCreate!=='boolean'||page.version!==1||!hash(page.referenceSha256))return null;
   const next=cursor+page.rows.length;
   if(page.nextCursor!==(next<page.total?next:null)||next<page.total&&!page.rows.length)return null;
   let bytes=0;const ids=new Set(),rows=[];
   for(const value of page.rows){
    const row=fields(value,['id','title','kind','group','description','source','build','guided','sourceSha256']);
    if(!row||!text(row.id,128)||!/^(starter|template):[a-z0-9-]+$/.test(row.id)||ids.has(row.id)||!['starter','template'].includes(row.kind)||!row.id.startsWith(row.kind+':')||kind!=='all'&&row.kind!==kind||!text(row.title,160)||!text(row.group,80)||!text(row.description,512,true)||!text(row.source,8192)||row.source.split('\n').length>200||!['flowchart-subset','code-first'].includes(row.build)||row.guided!=='source-lines'||!hash(row.sourceSha256))return null;
    const size=new TextEncoder().encode(row.source).byteLength;bytes+=size;if(size>8192||bytes>131072)return null;
    ids.add(row.id);rows.push(Object.freeze(row));
   }
   return Object.freeze({...page,rows:Object.freeze(rows)});
  }catch{return null;}
 }
 function finiteReceipt(value,attempt){
  try{
   const result=fields(value,['ok','entityId','creation','current','opening']),creation=fields(result?.creation,['version','sha256','projectRevision','durability']),current=fields(result?.current,['available','projectRevision']),opening=fields(result?.opening,['ok']);
   if(result?.ok!==true||!text(result.entityId,128)||!creation||creation.version!==1||!hash(creation.sha256)||!integer(creation.projectRevision)||creation.projectRevision<1||!['committed','recovery-degraded'].includes(creation.durability)||!current||typeof current.available!=='boolean'||!integer(current.projectRevision)||current.projectRevision<creation.projectRevision||!opening||typeof opening.ok!=='boolean')return null;
   const op=Object.getOwnPropertyDescriptor(value,'operationId');if(op&&(!Object.hasOwn(op,'value')||op.value!==attempt.operationId))return null;
   if(current.available){const live=fields(result.current,['version','sha256']);if(!live||!integer(live.version)||live.version<1||!hash(live.sha256))return null;}
   else if(!text(fields(result.current,['code'])?.code,80))return null;
   if(opening.ok){const view=fields(fields(result.opening,['view'])?.view,['windowId','role','entityId','epoch']);if(!current.available||!view||!text(view.windowId,128)||view.role!=='diagram'||view.entityId!==result.entityId||!integer(view.epoch))return null;}
   else if(!text(fields(result.opening,['code'])?.code,80))return null;
   return{available:current.available,opened:opening.ok,degraded:creation.durability==='recovery-degraded'};
  }catch{return null;}
 }
 window.SirenDiagramCatalogueView=Object.freeze({create({host,bridge,enabled=()=>true,onClose=()=>{}}){
  if(!host||typeof bridge?.getPage!=='function'||typeof bridge?.createDiagram!=='function'||typeof enabled!=='function'||typeof onClose!=='function')throw TypeError('CATALOGUE_VIEW_ADAPTERS_REQUIRED');
  let disposed=false,opened=false,generation=0,pageGeneration=0,ui=null,rows=[],selected=null,kind='all',cursor=0,total=0,nextCursor=null,canCreate=false,loading=false,busy=false,attempt=null,savedAttempt=false,titleValue='';
  const listeners=[],rowListeners=[];
  host.hidden=true;
  const allowed=()=>{try{return enabled()===true;}catch{return false;}};
  const remove=bucket=>{for(const [node,type,callback]of bucket)node.removeEventListener(type,callback);bucket.length=0;};
  const listen=(node,type,callback,bucket=listeners)=>{node.addEventListener(type,callback);bucket.push([node,type,callback]);};
  function clear(){
   generation++;pageGeneration++;opened=false;remove(rowListeners);remove(listeners);rows=[];selected=null;attempt=null;savedAttempt=false;titleValue='';canCreate=false;loading=false;busy=false;ui=null;host.replaceChildren();host.hidden=true;
  }
  function current(token){if(disposed||!opened||token!==generation)return false;if(!allowed()){clear();return false;}return true;}
  function close(options){if(!opened)return false;clear();try{onClose({restoreFocus:options?.restoreFocus!==false});}catch{/* Closing stays closed if a host notification fails. */}return true;}
  const make=(tag,parent,value,control)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=value;if(control)node.setAttribute('data-catalogue-control',control);parent.append(node);return node;};
  const button=(parent,label,control)=>{const node=make('button',parent,label,control);node.type='button';return node;};
  const chosenTitle=()=>titleValue.trim()?titleValue:selected?.title||'';
  const validTitle=()=>text(titleValue,160,true)&&text(chosenTitle(),160);
  function paintControls(){
   if(!ui)return;const invalid=!!selected&&!validTitle();
   ui.kind.value=kind;ui.kind.disabled=loading||busy;ui.title.value=titleValue;ui.title.disabled=!selected||busy;
   if(invalid)ui.title.setAttribute('aria-invalid','true');else ui.title.removeAttribute('aria-invalid');
   ui.create.disabled=loading||busy||!canCreate||!selected||invalid;
   ui.create.textContent=busy?'Creating…':savedAttempt?'Retry opening saved diagram':'Create separate diagram';
   ui.previous.disabled=loading||busy||cursor===0;ui.next.disabled=loading||busy||nextCursor===null;
   ui.count.textContent=total?(cursor+1)+'–'+(cursor+rows.length)+' of '+total:'No diagrams to show';
   host.setAttribute('aria-busy',String(loading||busy));
   for(const node of ui.entryButtons)node.disabled=loading||busy;
  }
  function resetSelection(){selected=null;attempt=null;savedAttempt=false;titleValue='';if(ui){ui.heading.textContent='Choose your starting point';ui.description.textContent='Start small, or build on a ready-made example.';ui.capabilities.textContent='';ui.source.textContent='';ui.title.placeholder='Optional diagram title';}}
  function choose(row){
   if(!current(generation)||loading||busy)return;
   const changed=selected?.id!==row.id;
   if(changed){selected=row;titleValue=row.title;attempt=null;savedAttempt=false;}
   ui.heading.textContent=row.title;ui.description.textContent=row.description;
   ui.capabilities.textContent=(row.build==='flowchart-subset'?'Build · supported flowchart subset':'Mermaid · code first')+'  ·  Guided · source lines';
   ui.source.textContent=row.source;ui.title.placeholder=row.title;
   for(const node of ui.entryButtons)node.setAttribute('aria-pressed',String(node.getAttribute('data-catalogue-entry')===row.id));
   if(changed)ui.status.textContent=canCreate?'Creates a new diagram. Your current diagram stays as it is.':'Read-only browsing · Creating diagrams is unavailable in this project.';
   paintControls();
  }
  function paintRows(){
   remove(rowListeners);ui.list.replaceChildren();ui.entryButtons=[];const groups=new Map();
   for(const row of rows){
    const key=row.kind+':'+row.group;let section=groups.get(key);
    if(!section){section=make('section',ui.list);section.className='siren-catalogue-group';make('h3',section,(row.kind==='starter'?'Starters':'Templates')+' · '+row.group);groups.set(key,section);}
    const item=button(section,undefined);item.className='siren-catalogue-entry';item.setAttribute('data-catalogue-entry',row.id);item.setAttribute('aria-pressed','false');make('span',item,row.title);make('small',item,row.build==='flowchart-subset'?'Build + Mermaid':'Mermaid source');listen(item,'click',()=>choose(row),rowListeners);ui.entryButtons.push(item);
   }
  }
  async function load(nextKind=kind,next=cursor){
   const token=generation;if(!current(token)||busy)return false;
   const ownPage=++pageGeneration;kind=nextKind;cursor=next;rows=[];total=0;nextCursor=null;canCreate=false;loading=true;resetSelection();paintRows();ui.retry.hidden=true;ui.status.textContent='Loading diagram catalogue…';paintControls();
   let value;try{value=await bridge.getPage({kind,cursor,limit:20});}catch{/* Error details stay in main-process diagnostics. */}
   if(!current(token)||ownPage!==pageGeneration)return false;
   loading=false;const page=finitePage(value,kind,cursor);
   if(!page){ui.status.textContent='Diagram catalogue unavailable. Retry when you are ready.';ui.retry.hidden=false;paintControls();return false;}
   rows=page.rows;total=page.total;nextCursor=page.nextCursor;canCreate=page.canCreate;paintRows();ui.status.textContent=canCreate?'Choose a starter or template to preview its source.':'Read-only browsing · Creating diagrams is unavailable in this project.';paintControls();return true;
  }
  async function createDiagram(){
   const token=generation;if(!current(token)||busy||loading||!canCreate||!selected||!validTitle())return;
   const title=chosenTitle();
   try{if(!attempt)attempt=Object.freeze({entryId:selected.id,title,operationId:crypto.randomUUID()});}catch{ui.status.textContent='Creation unavailable. Your current work is retained.';return;}
   const ownAttempt=attempt;busy=true;ui.status.textContent=savedAttempt?'Opening the saved diagram…':'Creating a separate diagram…';paintControls();
   let result;try{result=await bridge.createDiagram(ownAttempt);}catch{/* An interrupted response does not prove that persistence failed. */}
   if(!current(token)||attempt!==ownAttempt)return;busy=false;
   const receipt=finiteReceipt(result,ownAttempt);
   if(!receipt){ui.status.textContent='Creation not confirmed. Retry this same request to check safely.';paintControls();return;}
   savedAttempt=true;
   if(receipt.opened){close({restoreFocus:false});return;}
   ui.status.textContent=receipt.available?'Diagram saved, but its window could not open. Retry opening the saved diagram.':'Diagram saved, but it is no longer available in this project. Retrying will not create a duplicate.';
   if(receipt.degraded)ui.status.textContent+=' The recovery copy is unavailable.';
   paintControls();
  }
  function mount(){
   if(!host.className.split(/\s+/).includes('siren-diagram-catalogue'))host.className=(host.className+' siren-diagram-catalogue').trim();host.hidden=false;host.setAttribute('aria-label','Diagram catalogue');
   const header=make('header',host);header.className='siren-catalogue-header';const heading=make('div',header);make('p',heading,'A place to begin').className='siren-catalogue-eyebrow';make('h2',heading,'Create a diagram');const cancel=button(header,'Cancel','cancel');
   const body=make('div',host);body.className='siren-catalogue-body';const browse=make('section',body);browse.className='siren-catalogue-browse';const filterLabel=make('label',browse,'Browse');const filter=make('select',filterLabel,undefined,'kind');for(const [value,label]of [['all','All diagrams'],['starter','Starters'],['template','Templates']]){const option=make('option',filter,label);option.value=value;}
   const list=make('div',browse,undefined,'list');list.className='siren-catalogue-list';const pager=make('div',browse);pager.className='siren-catalogue-pager';const previous=button(pager,'Previous','previous'),count=make('span',pager,'','count'),next=button(pager,'Next','next');
   const detail=make('section',body);detail.className='siren-catalogue-detail';const detailHeading=make('h3',detail,undefined,'heading'),description=make('p',detail,undefined,'description'),capabilities=make('p',detail,undefined,'capabilities');capabilities.className='siren-catalogue-capabilities';const source=make('pre',detail,'','source');source.className='siren-catalogue-source';source.setAttribute('aria-label','Literal Mermaid source preview');source.tabIndex=0;const titleLabel=make('label',detail,'Diagram title · optional'),title=make('input',titleLabel,undefined,'title');title.type='text';title.maxLength=160;title.autocomplete='off';title.spellcheck=false;
   const footer=make('footer',host);footer.className='siren-catalogue-footer';const status=make('p',footer,'','status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const actions=make('div',footer);actions.className='siren-catalogue-actions';const retry=button(actions,'Retry catalogue','retry'),create=button(actions,'Create separate diagram','create');create.className='siren-catalogue-create';retry.hidden=true;
   ui={kind:filter,list,previous,count,next,heading:detailHeading,description,capabilities,source,title,status,retry,create,entryButtons:[]};resetSelection();
   listen(cancel,'click',()=>close());listen(host,'keydown',event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopPropagation();close();}});
   listen(filter,'change',()=>{if(!current(generation)||loading||busy){paintControls();return;}if(!['all','starter','template'].includes(filter.value)){paintControls();return;}void load(filter.value,0);});
   listen(previous,'click',()=>{if(current(generation)&&!busy&&!loading&&cursor>0)void load(kind,Math.max(0,cursor-20));});listen(next,'click',()=>{if(current(generation)&&!busy&&!loading&&nextCursor!==null)void load(kind,nextCursor);});listen(retry,'click',()=>{if(current(generation)&&!busy&&!loading)void load();});
   listen(title,'input',()=>{if(!current(generation))return;if(busy){paintControls();return;}if(titleValue!==title.value){titleValue=title.value;attempt=null;savedAttempt=false;ui.status.textContent=!canCreate?'Read-only browsing · Creating diagrams is unavailable in this project.':validTitle()?'Creates a new diagram. Your current diagram stays as it is.':'Use a well-formed title of up to 160 characters.';}paintControls();});
   listen(create,'click',()=>{void createDiagram();});paintControls();cancel.focus();
  }
  return Object.freeze({async open(){if(disposed||!allowed())return false;if(opened)return true;opened=true;generation++;kind='all';cursor=0;mount();return load();},close,pause(){clear();},dispose(){if(disposed)return;clear();disposed=true;},isOpen:()=>opened&&!disposed});
 }});
})();
