(() => {
 'use strict';
 const content=document.getElementById('documentContent'),outline=document.getElementById('documentOutline'),status=document.getElementById('viewStatus'),heading=document.getElementById('viewTitle'),retry=document.getElementById('retryDocument'),theme=document.getElementById('documentTheme');
 let generation=0,disposed=false,paused=false,pending=null,draft=null,readonly=true,latest=null,refreshTimer=null;const media=matchMedia('(prefers-color-scheme: dark)');
 const working=document.getElementById('openWorkingDocument'),save=document.getElementById('saveDocument'),notice=document.getElementById('documentChangesNotice'),noticeMessage=document.getElementById('documentChangesMessage');
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const label=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
 const appearance=()=>{document.documentElement.style.colorScheme=theme.value==='system'?(media.matches?'dark':'light'):theme.value;};
 const clear=()=>{content.replaceChildren();outline.replaceChildren();document.body.dataset.documentReady='false';for(const key of ['documentId','documentVersion','documentSha256'])delete document.body.dataset[key];};
 function text(parent,value){
  const block=make('div',parent);block.className='document-text';let end=0;const span=make('span',block),more=make('button',block,'Show more');more.type='button';
  const extend=()=>{const next=Math.min(end+24576,value.length);span.append(document.createTextNode(value.slice(end,next)));end=next;more.hidden=end===value.length;};
  more.addEventListener('click',extend);extend();
 }
 function items(parent,value,depth){
  const entries=Array.isArray(value)?value.map((item,index)=>[String(index+1),item]):Object.entries(value);let end=0;
  const holder=make('div',parent),more=make('button',parent,'Show more items');more.type='button';
  const extend=()=>{const next=Math.min(end+40,entries.length);for(const [name,item] of entries.slice(end,next))field(holder,name,item,depth+1);end=next;more.hidden=end===entries.length;};
  more.addEventListener('click',extend);extend();
 }
 function field(parent,name,value,depth){
  if(value===null||typeof value!=='object'){
   const row=make('div',parent);row.className='document-field';make('h3',row,label(name));text(row,value===null?'—':String(value));return;
  }
  const details=make('details',parent),summary=make('summary',details);details.className='document-group';
  summary.textContent=label(name)+(Array.isArray(value)?` · ${value.length} items`:'');let rendered=false;
  details.addEventListener('toggle',()=>{if(!details.open||rendered||disposed)return;rendered=true;if(depth>=32){text(details,JSON.stringify(value,null,2));return;}items(details,value,depth);});
 }
 function paint(value,focusBlock=null){
  clear();heading.textContent=value.title||'Docs';make('h1',content,value.title||'Untitled document');
  make('p',content,readonly?'Document · Read only':'Working document · Edit title, headings and plain text. Advanced sections are retained.').className='document-caption';
  if(!readonly)paintEditor(focusBlock);
  const entries=Object.entries(value).filter(([key])=>!(readonly?['id','title']:['id','title','blocks']).includes(key));let end=0,section=0;
  const more=make('button',outline,'More sections');more.type='button';
  const extend=()=>{const next=Math.min(end+40,entries.length);for(const [name,item] of entries.slice(end,next)){
   const node=make('section',content);node.id='document-section-'+(++section);node.className='document-section';
   const link=make('button',outline,label(name));link.type='button';outline.insertBefore(link,more);link.addEventListener('click',()=>node.scrollIntoView({block:'start'}));
   field(node,name,item,0);
  }end=next;more.hidden=end===entries.length;};more.addEventListener('click',extend);extend();
  if(!entries.length&&readonly)make('p',content,'This document has no additional sections.');
 }
 const escapeText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const plainText=block=>{
  if(block?.kind!=='text'||Object.keys(block).some(key=>!['id','kind','html'].includes(key))||typeof block.html!=='string'||!block.html.startsWith('<p>')||!block.html.endsWith('</p>'))return null;
  const body=block.html.slice(3,-4),decoded=body.replace(/&(amp|lt|gt);/g,(_match,code)=>({amp:'&',lt:'<',gt:'>'})[code]);return escapeText(decoded)===body?decoded:null;
 };
 function updateState(){
  if(!draft||disposed)return;const state=draft.getStatus();
  save.hidden=readonly;save.disabled=state.pending||state.paused||state.fenced||!state.dirty;
  for(const element of content.querySelectorAll('.document-edit'))element.disabled=state.pending||state.paused||state.fenced;
  document.body.dataset.documentDirty=String(state.dirty);document.body.dataset.documentVersion=state.version;document.body.dataset.documentSha256=state.sha256;
  status.textContent=readonly?'Read only · Document sections and agent metadata · Refresh to read saved changes':state.pending?'Saving document…':state.fenced?'Save was refused. Your local changes are retained.':state.dirty?'Unsaved changes · Save document or close to save':'Document saved · Other agent sections and source links retained';
 }
 function paintEditor(focusBlock){
  const section=make('section',content);section.className='document-section document-editor';const value=draft.getContent();
  const titleLabel=make('label',section,'Document title'),title=make('input',titleLabel);title.className='document-edit';title.id='documentTitleInput';title.value=value.title;
  const change=(key,newValue)=>{const current=draft.getContent();current[key]=newValue;draft.setContent(current);};title.addEventListener('input',()=>change('title',title.value));
  const holder=make('div',section);let rendered=0;const more=make('button',section,'More blocks');more.type='button';
  const renderBlocks=()=>{
   const current=draft.getContent(),end=Math.min(Math.max(rendered+40,focusBlock===null?0:focusBlock+1),current.blocks.length);focusBlock=null;
   for(let index=rendered;index<end;index++){
    const block=current.blocks[index],card=make('div',holder);card.className='document-block';const editableHeading=block?.kind==='heading'&&Object.keys(block).every(key=>['id','kind','level','text'].includes(key));const plain=plainText(block);
    if(editableHeading||plain!==null){
     const label=make('label',card,editableHeading?'Heading':'Text'),input=make('textarea',label);input.className='document-edit';input.dataset.blockIndex=String(index);input.dataset.blockId=block.id;input.rows=editableHeading?2:5;input.value=editableHeading?block.text??'':plain;
     input.addEventListener('input',()=>{const next=draft.getContent();next.blocks[index]={...next.blocks[index],...(editableHeading?{text:input.value}:{html:'<p>'+escapeText(input.value)+'</p>'})};draft.setContent(next);});
     const remove=make('button',card,'Remove block…');remove.type='button';remove.className='document-edit';remove.addEventListener('click',()=>{if(!confirm('Remove this block from the local document? It is saved only when you save the document.'))return;const next=draft.getContent();next.blocks.splice(index,1);draft.setContent(next);paint(draft.getDocument());updateState();});
    }else{make('h3',card,label(block?.kind??'Preserved block')+' · Preserved');make('p',card,'This section remains exact. This editor currently supports headings and plain text.');field(card,'content',block,0);}
   }rendered=end;more.hidden=rendered===current.blocks.length;
  };more.addEventListener('click',renderBlocks);renderBlocks();
  const actions=make('div',section);actions.className='document-block-actions';
  for(const [kind,title]of [['heading','Add heading'],['text','Add text']]){const button=make('button',actions,title);button.type='button';button.className='document-edit';button.addEventListener('click',()=>{const next=draft.getContent();if(next.blocks.length>=300){status.textContent='The document has reached its 300-block editing limit. Existing blocks were retained.';return;}const at=Math.min(rendered,next.blocks.length);next.blocks.splice(at,0,kind==='heading'?{id:crypto.randomUUID(),kind,level:2,text:''}:{id:crypto.randomUUID(),kind,html:'<p></p>'});draft.setContent(next);paint(draft.getDocument(),at);updateState();content.querySelector('textarea[data-block-index="'+at+'"]')?.focus();});}
 }
 async function readDocument(){
  if(disposed)return false;const token=++generation;retry.hidden=true;status.textContent='Opening selected document…';appearance();
  try{
   const result=await window.sirenDocsRead.getDocument();if(disposed||paused||token!==generation)return false;
   if(result?.ok!==true||typeof result.readonly!=='boolean')throw Error('Document unavailable');
   const own=window.SirenNativeDocsDraft.create({context:result,bridge:window.sirenDocsEdit,onChange:updateState});draft?.dispose();draft=own;readonly=result.readonly;paint(result.document);
   status.textContent=readonly?'Read only · Document sections and agent metadata · Refresh to read saved changes':'Document saved · Edit this working copy and save explicitly';
   working.hidden=!readonly||result.canEdit!==true;save.hidden=readonly;notice.hidden=true;latest=null;
   document.body.dataset.documentReady='true';document.body.dataset.documentId=result.document.id;document.body.dataset.documentVersion=result.version;document.body.dataset.documentSha256=result.sha256;
   document.body.dataset.documentReadonly=String(readonly);document.body.dataset.documentDirty='false';if(!readonly)updateState();
   retry.hidden=false;retry.textContent='Refresh';return true;
  }catch{if(!disposed&&token===generation){if(!draft){clear();heading.textContent='Docs';}status.textContent='Document could not be opened. Existing project data and local changes were retained.';retry.hidden=false;retry.textContent='Retry';}return false;}
 }
 function connect(){
  if(paused||disposed)return Promise.resolve(false);
  const own=readDocument();pending=own;own.finally(()=>{if(pending===own)pending=null;});return own;
 }
 window.sirenViewControl.onPrepare(async()=>{
  paused=true;document.body.inert=true;document.documentElement.style.visibility='hidden';
  if(pending)await pending;
  if(draft&&!readonly){const result=await draft.flushView();return {ok:result.ok===true,...(result.ok!==true?{code:result.code}:{})};}
  return {ok:!disposed&&document.body.dataset.documentReady==='true'};
 });
 window.sirenViewControl.onResume(()=>{
  if(disposed||!paused)return;
  paused=false;draft?.resumeView();document.body.inert=false;document.documentElement.style.visibility='';
 });
 const replace=()=>{if(paused||disposed||pending||draft?.getStatus().pending)return;if(draft?.getStatus().dirty&&!confirm('Discard local document changes and read the latest saved document?'))return;void connect();};
 const saveCurrent=async()=>{if(paused||disposed||readonly||!draft)return;const result=await draft.save();if(!result.ok)status.textContent='Save refused · Your local changes are retained. Review the saved document separately or reload explicitly.';updateState();};
 const openCopy=async method=>{if(paused||disposed)return;const result=await window.sirenDocsEdit[method]();if(!result?.ok)status.textContent='The document window could not be opened. Existing work was retained.';};
 working.addEventListener('click',()=>{void openCopy('openWorkingCopy');});save.addEventListener('click',()=>{void saveCurrent();});
 document.getElementById('reviewLatestDocument').addEventListener('click',()=>{void openCopy('openLatest');});document.getElementById('replaceLatestDocument').addEventListener('click',replace);
 const off=window.sirenDocsEdit.onReferenceChanged(ref=>{if(disposed||paused||readonly||ref.documentId!==draft?.getStatus().documentId||ref.version===draft.getStatus().version||ref.projectRevision<=(latest?.projectRevision??draft.getStatus().projectRevision))return;latest=ref;notice.hidden=false;noticeMessage.textContent='The document changed in another window. Your local changes are retained.';if(!draft.getStatus().dirty&&!draft.getStatus().pending&&!draft.getStatus().fenced){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{refreshTimer=null;if(!paused&&!disposed&&!draft.getStatus().dirty&&!draft.getStatus().pending&&!draft.getStatus().fenced)void connect();},250);}});
 theme.addEventListener('change',appearance);media.addEventListener('change',appearance);retry.addEventListener('click',replace);
 window.addEventListener('keydown',event=>{if(event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.isComposing&&event.key.toLowerCase()==='s'&&!readonly){event.preventDefault();if(!event.repeat)void saveCurrent();}});
 window.addEventListener('beforeunload',()=>{disposed=true;generation++;off();clearTimeout(refreshTimer);draft?.dispose();clear();media.removeEventListener('change',appearance);},{once:true});
 window.sirenNativeDocsView=Object.freeze({connect});
})();
