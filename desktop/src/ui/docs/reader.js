(() => {
 'use strict';
 const tags=new Set('P BR STRONG B EM I U S UL OL LI BLOCKQUOTE PRE CODE H1 H2 H3 H4 H5 H6 SPAN DIV'.split(' '));
 const forbidden=new Set('SCRIPT STYLE IFRAME OBJECT EMBED LINK META SVG MATH FORM INPUT BUTTON VIDEO AUDIO'.split(' '));
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 function html(parent,value){
  if(value.length>131072){const plain=make('pre',parent,value.slice(0,24576));plain.className='document-reader-code';make('p',parent,'Large rich block · The exact saved content remains available in Preserved fields.').className='document-caption';return;}
  const template=document.createElement('template');template.innerHTML=value;let count=0,truncated=false;
  const copy=(node,target,depth)=>{
   if(++count>4096||depth>32){truncated=true;return;}
   if(node.nodeType===3){target.append(document.createTextNode(node.textContent));return;}
   if(node.nodeType!==1&&node.nodeType!==11)return;
   if(forbidden.has(node.nodeName))return;
   const next=tags.has(node.nodeName)?make(node.nodeName.toLowerCase(),target):target;
   const ink=window.SirenNativeDocsRichText?.styleColor(node.getAttribute?.('style'));if(next!==target&&ink)next.style.color=ink;
   const classes=node.nodeName==='SPAN'?window.SirenNativeDocsRichText?.textClasses(node.getAttribute?.('class')):null;if(next!==target&&classes)next.className=classes.join(' ');
   for(const child of node.childNodes)copy(child,next,depth+1);
  };copy(template.content,parent,0);
  if(truncated)make('p',parent,'Complex rich block · Display limited; saved content is unchanged.').className='document-caption';
 }
 function renderBlock(parent,block){
  const card=make('section',parent);card.className='document-reader-block';card.dataset.blockId=typeof block?.id==='string'?block.id:'';
  if(block?.kind==='heading'&&typeof block.text==='string'){make('h'+Math.max(2,Math.min(6,Number.isSafeInteger(block.level)?block.level:2)),card,block.text);return true;}
  if(block?.kind==='text'&&typeof block.html==='string'){html(card,block.html);return true;}
  if(block?.kind==='table'&&Array.isArray(block.rows)){
   const table=make('table',card);table.className='document-reader-table';const body=make('tbody',table);let at=0;
   const more=make('button',card,'More rows');more.type='button';
   const extend=()=>{const end=Math.min(at+20,block.rows.length);for(let i=at;i<end;i++){const row=make('tr',body);for(const cell of (Array.isArray(block.rows[i])?block.rows[i]:[]).slice(0,32))make(i===0&&block.headerRow?'th':'td',row,typeof cell==='string'?cell:String(cell??''));}at=end;more.hidden=at===block.rows.length;};more.addEventListener('click',extend);extend();return true;
  }
  if(block?.kind==='checklist'&&Array.isArray(block.items)){
   const list=make('ul',card);list.className='document-reader-checklist';for(const item of block.items.slice(0,40)){if(typeof item?.text!=='string')continue;const row=make('li',list);make('span',row,item.done?'✓':'○').setAttribute('aria-label',item.done?'Completed':'Open');make('span',row,item.text);}
   if(block.items.length>40)make('p',card,'Additional checklist items are available in Preserved fields.').className='document-caption';return true;
  }
  if(block?.kind==='prompt'&&typeof block.text==='string'){
   make('h3',card,block.label||'Agent instructions');const pre=make('pre',card);pre.className='document-reader-code';
   const notice=make('p',card);notice.className='document-caption';const more=make('button',card,'More instructions');more.type='button';let end=0;
   const extend=()=>{end=Math.min(end+24576,block.text.length);pre.textContent=block.text.slice(0,end);more.hidden=end===block.text.length;notice.textContent='Documented instructions · Not executed'+(more.hidden?'':' · Excerpt: '+end.toLocaleString()+' of '+block.text.length.toLocaleString()+' characters');};
   more.addEventListener('click',extend);extend();return true;
  }
  card.remove();return false;
 }
 window.SirenNativeDocsReader=Object.freeze({render({parent,outline,blocks}){
  if(!Array.isArray(blocks)||!blocks.length)return;
  if(!blocks.some(block=>['heading','text','table','checklist','prompt'].includes(block?.kind)))return;
  const page=make('section',parent);page.className='document-reader';page.setAttribute('aria-label','Document content');
  const nav=make('button',outline,'Contents');nav.type='button';nav.addEventListener('click',()=>page.scrollIntoView({block:'start'}));
  const holder=make('div',page),more=make('button',page,'More document blocks');more.type='button';let at=0;
  const extend=()=>{const end=Math.min(at+40,blocks.length);for(let index=at;index<end;index++){
   const block=blocks[index];if(renderBlock(holder,block)&&block.kind==='heading'){const section=holder.lastElementChild;section.id='document-reading-'+index;const link=make('button',outline,block.text||'Untitled section');link.type='button';link.className='document-reader-outline';link.addEventListener('click',()=>section.scrollIntoView({block:'start'}));}
  }at=end;more.hidden=at===blocks.length;};more.addEventListener('click',extend);extend();
 }});
})();
