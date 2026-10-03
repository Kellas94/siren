(() => {
 'use strict';
 const content=document.getElementById('documentContent'),outline=document.getElementById('documentOutline'),status=document.getElementById('viewStatus'),heading=document.getElementById('viewTitle'),retry=document.getElementById('retryDocument'),theme=document.getElementById('documentTheme');
 let generation=0,disposed=false;const media=matchMedia('(prefers-color-scheme: dark)');
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
 function paint(value){
  clear();heading.textContent=value.title||'Docs';make('h1',content,value.title||'Untitled document');
  make('p',content,'Document · Read only').className='document-caption';
  const entries=Object.entries(value).filter(([key])=>!['id','title'].includes(key));let end=0,section=0;
  const more=make('button',outline,'More sections');more.type='button';
  const extend=()=>{const next=Math.min(end+40,entries.length);for(const [name,item] of entries.slice(end,next)){
   const node=make('section',content);node.id='document-section-'+(++section);node.className='document-section';
   const link=make('button',outline,label(name));link.type='button';outline.insertBefore(link,more);link.addEventListener('click',()=>node.scrollIntoView({block:'start'}));
   field(node,name,item,0);
  }end=next;more.hidden=end===entries.length;};more.addEventListener('click',extend);extend();
  if(!entries.length)make('p',content,'This document has no additional sections.');
 }
 async function connect(){
  if(disposed)return false;const token=++generation;clear();retry.hidden=true;status.textContent='Opening selected document…';appearance();
  try{
   const result=await window.sirenDocsRead.getDocument();if(disposed||token!==generation)return false;
   if(result?.ok!==true||result.readonly!==true)throw Error('Document unavailable');paint(result.document);
   status.textContent='Read only · Document sections and agent metadata · Refresh to read saved changes';
   document.body.dataset.documentReady='true';document.body.dataset.documentId=result.document.id;document.body.dataset.documentVersion=result.version;document.body.dataset.documentSha256=result.sha256;
   retry.hidden=false;retry.textContent='Refresh';return true;
  }catch{if(!disposed&&token===generation){clear();heading.textContent='Docs';status.textContent='Document could not be opened. Existing project data was retained.';retry.hidden=false;retry.textContent='Retry';}return false;}
 }
 theme.addEventListener('change',appearance);media.addEventListener('change',appearance);retry.addEventListener('click',()=>{void connect();});
 window.addEventListener('beforeunload',()=>{disposed=true;generation++;clear();media.removeEventListener('change',appearance);},{once:true});
 window.sirenNativeDocsView=Object.freeze({connect});
})();
