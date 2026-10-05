(() => {
 'use strict';
 const content=document.getElementById('documentContent'),outline=document.getElementById('documentOutline'),status=document.getElementById('viewStatus'),heading=document.getElementById('viewTitle'),retry=document.getElementById('retryDocument'),theme=document.getElementById('documentTheme');
 let generation=0,disposed=false,paused=false,pending=null,draft=null,readonly=true,latest=null,refreshTimer=null,sourceOpening=null;const media=matchMedia('(prefers-color-scheme: dark)');
 const working=document.getElementById('openWorkingDocument'),save=document.getElementById('saveDocument'),notice=document.getElementById('documentChangesNotice'),noticeMessage=document.getElementById('documentChangesMessage');
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const label=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
 const appearance=()=>{document.documentElement.style.colorScheme=theme.value==='system'?(media.matches?'dark':'light'):theme.value;};
 const clear=()=>{window.SirenNativeViewIdentity.clear('docs');content.replaceChildren();outline.replaceChildren();document.body.dataset.documentReady='false';for(const key of ['documentId','documentVersion','documentSha256'])delete document.body.dataset[key];};
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
  make('p',content,readonly?'Document · Read only':'Working document · Edit sections and linked-code context. Save when ready.').className='document-caption';
  if(!readonly)paintEditor(focusBlock);
  paintSources(value);
  const entries=Object.entries(value).filter(([key,item])=>!(readonly?['id','title']:['id','title','blocks']).includes(key)&&
    !(key==='agent'&&item===null||key==='releases'&&Array.isArray(item)&&item.length===0));let end=0,section=0;
  const more=make('button',outline,'More sections');more.type='button';
  const extend=()=>{const next=Math.min(end+40,entries.length);for(const [name,item] of entries.slice(end,next)){
   const node=make('section',content);node.id='document-section-'+(++section);node.className='document-section';
   const link=make('button',outline,label(name));link.type='button';outline.insertBefore(link,more);link.addEventListener('click',()=>node.scrollIntoView({block:'start'}));
   field(node,name,item,0);
  }end=next;more.hidden=end===entries.length;};more.addEventListener('click',extend);extend();
  if(!entries.length&&readonly)make('p',content,'This document has no additional sections.');
 }
 function paintSources(value){
  if(!Array.isArray(value.blocks)||value.blocks.length>4096)return;
  const links=[];let scanned=0;
  for(const block of value.blocks){
   if(block?.kind!=='knowledge'||typeof block.id!=='string'||!Array.isArray(block.rows))continue;
   scanned+=block.rows.length;if(scanned>65536)return;
   for(const row of block.rows){const ref=row?.sourceRef;
    if(typeof row?.id==='string'&&typeof ref?.sourceId==='string'&&Number.isSafeInteger(ref.version)&&ref.version>0&&typeof ref.sha256==='string'&&/^[a-f0-9]{64}$/.test(ref.sha256))links.push({blockId:block.id,rowId:row.id,name:typeof(row.name??row.title)==='string'?(row.name??row.title).slice(0,200):'Linked source',sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256});
   }
  }
  if(!links.length)return;
  const section=make('section',content);section.className='document-section document-sources';section.id='document-linked-sources';make('h2',section,'Linked code');make('p',section,'Preview the saved code here, or open its exact version in Code. Local document edits stay here.').className='document-caption';
  const nav=make('button',outline,'Linked code');nav.type='button';nav.addEventListener('click',()=>section.scrollIntoView({block:'start'}));
  const holder=make('div',section),more=make('button',section,'More linked sources');more.type='button';let end=0;
  const extend=()=>{const next=Math.min(end+40,links.length);for(const link of links.slice(end,next)){
   const card=make('div',holder);card.className='document-source';const text=make('div',card);make('strong',text,link.name);make('span',text,'Saved version '+link.version);
   const toggle=make('button',card,'Preview');toggle.type='button';toggle.className='document-source-preview-toggle';toggle.setAttribute('aria-expanded','false');
   const button=make('button',card,'Open in Code');button.type='button';button.className='document-source-open';button.dataset.blockId=link.blockId;button.dataset.rowId=link.rowId;
   const preview=make('section',holder);preview.className='document-source-preview';preview.hidden=true;preview.setAttribute('aria-label',link.name+' · Saved code preview');
   const caption=make('p',preview,'Saved version '+link.version+' · Plain text preview');
   const paging=make('div',preview);paging.className='document-preview-paging';const previous=make('button',paging,'Previous'),range=make('span',paging),nextPage=make('button',paging,'Next');previous.type=nextPage.type='button';previous.className='document-preview-previous';nextPage.className='document-preview-next';range.setAttribute('aria-live','polite');
   const code=make('pre',preview);code.tabIndex=0;code.setAttribute('aria-label','Saved source text');
   let page=null,history=[];
   const readPage=(start,move)=>{
    if(paused||disposed||pending||sourceOpening||draft?.getStatus().pending)return;
    const token=generation,expectedDocumentVersion=draft?.getStatus().version;toggle.disabled=previous.disabled=nextPage.disabled=true;preview.dataset.previewReady='false';range.textContent='Loading saved code…';
    const own=Promise.resolve().then(async()=>{try{
     const result=await window.sirenDocsSources.previewLinkedSource({blockId:link.blockId,rowId:link.rowId,expectedDocumentVersion,start});
     if(disposed||paused||token!==generation)return;
     if(result?.ok!==true){range.textContent=result?.code==='DOCUMENT_CONFLICT'?'The saved document changed. Refresh to preview it.':'Preview could not load. Your work is retained.';return;}
     if(result.sourceRef?.sourceId!==link.sourceId||result.sourceRef.version!==link.version||result.sourceRef.sha256!==link.sha256||result.start!==start||!Number.isSafeInteger(result.end)||!Number.isSafeInteger(result.totalUnits)||result.end<start||result.end>result.totalUnits||result.end-start>8192||typeof result.text!=='string'||result.text.length!==result.end-start||!result.text.isWellFormed())throw Error('Invalid saved preview');
     if(move==='next'&&page){history.push(page.start);if(history.length>128)history.shift();}else if(move==='previous')history.pop();else if(move==='start')history=[];
     page={start:result.start,end:result.end,total:result.totalUnits};code.textContent=result.text;caption.textContent='Saved version '+link.version+' · Plain text preview';range.textContent=result.totalUnits?`${(result.start+1).toLocaleString()}–${result.end.toLocaleString()} of ${result.totalUnits.toLocaleString()} characters`:'Empty source';preview.dataset.previewStart=String(result.start);preview.dataset.previewEnd=String(result.end);preview.dataset.previewTotal=String(result.totalUnits);preview.dataset.previewReady='true';
    }catch{if(!disposed&&!paused&&token===generation)range.textContent='Preview could not load. Your work is retained.';}
    finally{if(sourceOpening===own)sourceOpening=null;if(!disposed&&!paused&&token===generation){toggle.disabled=false;previous.disabled=!history.length;nextPage.disabled=!page||page.end>=page.total||preview.dataset.previewReady!=='true';}}});sourceOpening=own;
   };
   toggle.addEventListener('click',()=>{if(paused||disposed||sourceOpening)return;if(!preview.hidden){preview.hidden=true;toggle.textContent='Preview';toggle.setAttribute('aria-expanded','false');code.textContent='';page=null;history=[];return;}preview.hidden=false;toggle.textContent='Hide preview';toggle.setAttribute('aria-expanded','true');readPage(0,'start');});previous.addEventListener('click',()=>{if(history.length)readPage(history.at(-1),'previous');});nextPage.addEventListener('click',()=>{if(page&&page.end<page.total)readPage(page.end,'next');});
   button.addEventListener('click',()=>{
    if(paused||disposed||pending||sourceOpening||draft?.getStatus().pending)return;
    const token=generation,expectedDocumentVersion=draft?.getStatus().version;button.disabled=true;status.textContent='Opening saved code version '+link.version+'…';
    const own=Promise.resolve().then(async()=>{try{
     const result=await window.sirenDocsSources.openLinkedSource({blockId:link.blockId,rowId:link.rowId,expectedDocumentVersion});
     if(disposed||paused||token!==generation)return;
     status.textContent=result?.ok?'Saved code version '+link.version+' opened · Your document changes are retained':result?.code==='DOCUMENT_CONFLICT'?'The saved document changed. Refresh or open the saved document separately; your local changes are retained.':'Linked code could not be opened. Your document and source are unchanged.';
    }catch{if(!disposed&&!paused&&token===generation)status.textContent='Linked code could not be opened. Your document changes are retained.';}finally{if(sourceOpening===own)sourceOpening=null;if(!disposed&&!paused&&token===generation)button.disabled=false;}});sourceOpening=own;
   });
  }end=next;more.hidden=end===links.length;};more.addEventListener('click',extend);extend();
 }
 const escapeText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const plainText=block=>{
  if(block?.kind!=='text'||Object.keys(block).some(key=>!['id','kind','html'].includes(key))||typeof block.html!=='string'||!block.html.startsWith('<p>')||!block.html.endsWith('</p>'))return null;
  const body=block.html.slice(3,-4),decoded=body.replace(/&(amp|lt|gt);/g,(_match,code)=>({amp:'&',lt:'<',gt:'>'})[code]);return escapeText(decoded)===body?decoded:null;
 };
 function updateState(){
  if(!draft||disposed)return;const state=draft.getStatus();
  if(!paused){const name=draft.getDocument().title;window.SirenNativeViewIdentity.set({role:'docs',name,revision:state.projectRevision,readonly,dirty:state.dirty});const title=content.querySelector(':scope > h1');if(title)title.textContent=name||'Untitled document';}
  save.hidden=readonly;save.disabled=state.pending||state.paused||state.fenced||!state.dirty;
  for(const element of content.querySelectorAll('.document-edit'))element.disabled=state.pending||state.paused||state.fenced||element.dataset.documentAtLimit==='true';
  document.body.dataset.documentDirty=String(state.dirty);document.body.dataset.documentVersion=state.version;document.body.dataset.documentSha256=state.sha256;
  status.textContent=readonly?'Read only · Document sections and agent metadata · Refresh to read saved changes':state.pending?'Saving document…':state.fenced?'Save was refused. Your local changes are retained.':state.dirty?'Unsaved changes · Save document or close to save':'Document saved · Other agent sections and source links retained';
 }
 function paintEditor(focusBlock){
  const section=make('section',content);section.className='document-section document-editor';const value=draft.getContent();
  const titleLabel=make('label',section,'Document title'),title=make('input',titleLabel);title.className='document-edit';title.id='documentTitleInput';title.value=value.title;
  const change=(key,newValue)=>{const current=draft.getContent();current[key]=newValue;draft.setContent(current);};title.addEventListener('input',()=>change('title',title.value));
  const holder=make('div',section);let rendered=0;const more=make('button',section,'More blocks');more.type='button';
  const owner=draft,canEdit=()=>!readonly&&!disposed&&!paused&&!pending&&draft===owner;
  const removeBlock=(index,id)=>{const state=owner.getStatus();if(!canEdit()||state.pending||state.paused||state.fenced||state.disposed)return;if(!confirm('Remove this block from the local document? It is saved only when you save the document.'))return;const next=owner.getContent();if(next.blocks[index]?.id!==id)return;next.blocks.splice(index,1);owner.setContent(next);paint(owner.getDocument());updateState();};
  const openStructured=details=>{for(const other of holder.querySelectorAll('.document-structured'))if(other!==details){other.open=false;other.querySelector(':scope > div')?.replaceChildren();}};
  const renderBlocks=()=>{
   const current=draft.getContent(),requestedFocus=focusBlock,end=Math.min(Math.max(rendered+40,focusBlock===null?0:focusBlock+1),current.blocks.length);focusBlock=null;
   for(let index=rendered;index<end;index++){
    const block=current.blocks[index],card=make('div',holder);card.className='document-block';const editableHeading=block?.kind==='heading'&&Object.keys(block).every(key=>['id','kind','level','text'].includes(key));const plain=plainText(block);
    if(editableHeading||plain!==null){
     const label=make('label',card,editableHeading?'Heading':'Text'),input=make('textarea',label);input.className='document-edit';input.dataset.blockIndex=String(index);input.dataset.blockId=block.id;input.rows=editableHeading?2:5;input.value=editableHeading?block.text??'':plain;
     input.addEventListener('input',()=>{const next=draft.getContent();next.blocks[index]={...next.blocks[index],...(editableHeading?{text:input.value}:{html:'<p>'+escapeText(input.value)+'</p>'})};draft.setContent(next);});
     const remove=make('button',card,'Remove block…');remove.type='button';remove.className='document-edit';remove.addEventListener('click',()=>{if(!confirm('Remove this block from the local document? It is saved only when you save the document.'))return;const next=draft.getContent();next.blocks.splice(index,1);draft.setContent(next);paint(draft.getDocument());updateState();});
    }else if(window.SirenStructuredDocs.isEditableBlock(block)){
     window.SirenStructuredDocs.renderEditor({parent:card,draft:owner,index,canEdit,onOpen:openStructured,onRemove:()=>removeBlock(index,block.id),preserved:field,focus:requestedFocus===index});
    }else if(block?.kind==='knowledge'&&Array.isArray(block.rows)&&block.rows.some(row=>typeof row?.id==='string'&&row.id&&typeof row.sourceRef?.sourceId==='string')){
     make('h3',card,'Linked-code context');make('p',card,'Names and notes explain the saved code. Source versions and other fields stay intact.').className='document-caption';
     const rows=make('div',card),moreRows=make('button',card,'More sources');moreRows.type='button';let at=0;
     const extendRows=()=>{const end=Math.min(at+40,block.rows.length);for(let rowIndex=at;rowIndex<end;rowIndex++){
      const row=block.rows[rowIndex];if(typeof row?.id!=='string'||!row.id||typeof row.sourceRef?.sourceId!=='string')continue;
      const group=make('fieldset',rows);group.className='document-knowledge';make('legend',group,String(row.name??row.title??'Linked source').slice(0,160)+' · Saved version '+row.sourceRef.version);
      for(const [key,title,max]of [['name','Source name',160],['notes','Context and notes',2000]]){
       if(Object.hasOwn(row,key)&&typeof row[key]!=='string')continue;
       const name=make('label',group,title),input=make(key==='name'?'input':'textarea',name);input.className='document-edit';input.dataset.knowledgeRow=row.id;input.dataset.knowledgeField=key;input.maxLength=max;input.value=row[key]??(key==='name'?row.title??'':'');if(key==='notes')input.rows=4;
       input.addEventListener('input',()=>{const next=draft.getContent(),target=next.blocks[index]?.rows?.[rowIndex];if(!target||target.id!==row.id)return;target[key]=input.value;draft.setContent(next);});
      }
     }at=end;moreRows.hidden=at===block.rows.length;};moreRows.addEventListener('click',extendRows);extendRows();field(card,'Preserved fields',block,0);
    }else{make('h3',card,label(block?.kind??'Preserved block')+' · Preserved');make('p',card,'This section remains exact. Advanced or unrecognized fields are available for review.');field(card,'content',block,0);}
   }rendered=end;more.hidden=rendered===current.blocks.length;
  };more.addEventListener('click',renderBlocks);renderBlocks();
  const actions=make('div',section);actions.className='document-block-actions';
  for(const [kind,title]of [['heading','Add heading'],['text','Add text']]){const button=make('button',actions,title);button.type='button';button.className='document-edit';button.addEventListener('click',()=>{const next=draft.getContent();if(next.blocks.length>=300){status.textContent='The document has reached its 300-block editing limit. Existing blocks were retained.';return;}const at=Math.min(rendered,next.blocks.length);next.blocks.splice(at,0,kind==='heading'?{id:crypto.randomUUID(),kind,level:2,text:''}:{id:crypto.randomUUID(),kind,html:'<p></p>'});draft.setContent(next);paint(draft.getDocument(),at);updateState();content.querySelector('textarea[data-block-index="'+at+'"]')?.focus();});}
  const add=make('details',actions);add.className='document-add-section';make('summary',add,'Add section…');
  for(const [kind,title]of Object.entries(window.SirenStructuredDocs.names)){const button=make('button',add,title);button.type='button';button.className='document-edit';button.dataset.addStructured=kind;button.addEventListener('click',()=>{const state=owner.getStatus();if(!button.isConnected||!canEdit()||state.pending||state.paused||state.fenced||state.disposed)return;const next=owner.getContent();if(next.blocks.length>=300){status.textContent='The document has reached its 300-block editing limit. Existing blocks were retained.';return;}const at=Math.min(rendered,next.blocks.length);next.blocks.splice(at,0,window.SirenStructuredDocs.createBlock(kind));owner.setContent(next);paint(owner.getDocument(),at);updateState();});}
 }
 async function readDocument(){
  if(disposed)return false;const token=++generation;retry.hidden=true;status.textContent='Opening selected document…';appearance();
  try{
   const result=await window.sirenDocsRead.getDocument();if(disposed||paused||token!==generation)return false;
   if(result?.ok!==true||typeof result.readonly!=='boolean')throw Error('Document unavailable');
   const own=window.SirenNativeDocsDraft.create({context:result,bridge:{...window.sirenDocsEdit,getDocument:window.sirenDocsRead.getDocument},onChange:updateState});draft?.dispose();draft=own;readonly=result.readonly;paint(result.document);
   status.textContent=readonly?'Read only · Document sections and agent metadata · Refresh to read saved changes':'Document saved · Edit this working copy and save explicitly';
   working.hidden=!readonly||result.canEdit!==true;save.hidden=readonly;notice.hidden=true;latest=null;
   document.body.dataset.documentReady='true';document.body.dataset.documentId=result.document.id;document.body.dataset.documentVersion=result.version;document.body.dataset.documentSha256=result.sha256;
   document.body.dataset.documentReadonly=String(readonly);document.body.dataset.documentDirty='false';updateState();
   retry.hidden=false;retry.textContent='Refresh';return true;
  }catch{if(!disposed&&token===generation){if(!draft){clear();heading.textContent='Docs';}status.textContent='Document could not be opened. Existing project data and local changes were retained.';retry.hidden=false;retry.textContent='Retry';}return false;}
 }
 function connect(){
  if(paused||disposed)return Promise.resolve(false);
  const own=readDocument();pending=own;own.finally(()=>{if(pending===own)pending=null;});return own;
 }
 window.sirenViewControl.onPrepare(async()=>{
  paused=true;document.body.inert=true;document.documentElement.style.visibility='hidden';
  window.SirenNativeViewIdentity.clear('docs');
  if(pending)await pending;
  if(sourceOpening)await sourceOpening;
  if(draft&&!readonly){const result=await draft.flushView();return {ok:result.ok===true,...(result.ok!==true?{code:result.code}:{})};}
  return {ok:!disposed&&document.body.dataset.documentReady==='true'};
 });
 window.sirenViewControl.onResume(()=>{
  if(disposed||!paused)return;
  paused=false;draft?.resumeView();if(draft&&!readonly)paint(draft.getDocument());updateState();document.body.inert=false;document.documentElement.style.visibility='';
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
