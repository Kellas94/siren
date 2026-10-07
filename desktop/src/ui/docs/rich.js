(() => {
 'use strict';
 const tags=new Set('P BR STRONG B EM I U UL OL LI H1 H2 H3 SPAN DIV'.split(' '));
 const classNames=new Set('wp-c-accent wp-c-muted wp-c-red wp-c-orange wp-c-amber wp-c-olive wp-c-green wp-c-teal wp-c-blue wp-c-indigo wp-c-purple wp-c-pink wp-c-brown wp-hl-yellow wp-hl-orange wp-hl-green wp-hl-teal wp-hl-blue wp-hl-purple wp-hl-pink wp-hl-grey'.split(' '));
 const textClasses=value=>{if(typeof value!=='string'||!value)return null;const parts=value.split(' ');return parts.every(name=>classNames.has(name))?parts:null;};
 const color=value=>typeof value==='string'&&/^(?:#[a-f0-9]{3}(?:[a-f0-9]{3})?|(?:rgb|rgba)\([\d.,%\s]+\)|black|white|red|green|blue|purple|orange|gray)$/i.test(value.trim())?value.trim():null;
 const styleColor=value=>{const match=typeof value==='string'&&/^\s*color\s*:\s*([^;]+)\s*;?\s*$/i.exec(value);return match?color(match[1]):null;};
 function inspect(value,doc=document){
  if(typeof value!=='string'||value.length>131072||!value.isWellFormed())return {ok:false};
  const template=doc.createElement('template');template.innerHTML=value;let nodes=0;
  const safe=(node,depth)=>{
   if(++nodes>4096||depth>32)return false;if(node.nodeType===3)return true;
   if(node.nodeType!==1&&node.nodeType!==11)return false;
   if(node.nodeType===1&&(!tags.has(node.nodeName)||Array.from(node.attributes).some(attr=>node.nodeName!=='SPAN'||attr.name!=='class'||!textClasses(attr.value))))return false;
   return Array.from(node.childNodes).every(child=>safe(child,depth+1));
  };
  return safe(template.content,0)?{ok:true,html:template.innerHTML}:{ok:false};
 }
 const editable=block=>block?.kind==='text'&&typeof block.id==='string'&&Object.keys(block).every(key=>['id','kind','html','role'].includes(key))&&inspect(block.html).ok;
 function render({parent,draft,index,canEdit,onRejected=()=>{}}){
  const doc=parent.ownerDocument,original=draft.getContent().blocks[index];if(!editable(original))throw TypeError('Supported inert rich text required');
  const make=(tag,holder,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;holder.append(node);return node;};
  const section=make('section',parent);section.className='document-rich';
  const tools=make('div',section);tools.className='document-format-tools';tools.setAttribute('role','toolbar');tools.setAttribute('aria-label','Text formatting');
  const editor=make('div',section);editor.className='document-rich-input';editor.dataset.richBlockId=original.id;editor.dataset.blockIndex=String(index);editor.setAttribute('role','textbox');editor.setAttribute('aria-label','Document text');editor.setAttribute('aria-multiline','true');editor.contentEditable='true';editor.innerHTML=original.html;let accepted=original.html;
  const target=()=>{const state=draft.getStatus();if(!section.isConnected||!canEdit()||state.readonly||state.pending||state.paused||state.fenced||state.disposed)return null;const next=draft.getContent();return next.blocks[index]?.id===original.id?next:null;};
  const commit=(group=true)=>{
   const next=target(),checked=inspect(editor.innerHTML,doc);if(!next||!checked.ok){editor.innerHTML=accepted;onRejected();return false;}
   next.blocks[index]={...next.blocks[index],html:checked.html};if(!draft.setContent(next,{historyGroup:group?'rich:'+original.id:null}).ok){editor.innerHTML=accepted;return false;}accepted=checked.html;return true;
  };
  const selection=()=>{const s=doc.getSelection();if(!s?.rangeCount)return null;const r=s.getRangeAt(0);return editor.contains(r.startContainer)&&editor.contains(r.endContainer)?{s,r}:null;};
  const format=(tag,ink=null)=>{
   if(!target())return;const selected=selection();if(!selected||selected.r.collapsed){onRejected('Select text to format.');return;}
   const wrapper=doc.createElement(tag);if(ink)wrapper.className=ink;
   const fragment=selected.r.extractContents();if(tag==='ul'||tag==='ol'){const item=doc.createElement('li');item.append(fragment);wrapper.append(item);}else wrapper.append(fragment);
   selected.r.insertNode(wrapper);selected.r.selectNodeContents(wrapper);if(commit(false)){editor.focus({preventScroll:true});selected.s.removeAllRanges();selected.s.addRange(selected.r);}
  };
  for(const [label,tag,title] of [['B','strong','Bold · Ctrl+B'],['I','em','Italic · Ctrl+I'],['U','u','Underline · Ctrl+U'],['• List','ul','Bulleted list'],['1. List','ol','Numbered list']]){
   const button=make('button',tools,label);button.type='button';button.className='document-edit';button.dataset.format=tag;button.title=title;button.setAttribute('aria-label',title);button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>format(tag));
  }
  const clear=make('button',tools,'Clear block formatting');clear.type='button';clear.className='document-edit';clear.dataset.clearBlockFormatting=original.id;clear.title='Remove emphasis and colours from this text block; keep paragraphs, headings and lists';clear.addEventListener('pointerdown',event=>event.preventDefault());clear.addEventListener('click',()=>{if(!target())return;const checked=inspect(editor.innerHTML,doc);if(!checked.ok){onRejected('Formatting could not be removed. Previous text retained.');return;}const marks=Array.from(editor.querySelectorAll('strong,b,em,i,u,span'));if(!marks.length)return;for(const mark of marks.reverse())mark.replaceWith(...mark.childNodes);if(commit(false))editor.focus({preventScroll:true});});
  const colors=make('details',tools),colourToggle=make('summary',colors,'Colour');colourToggle.addEventListener('pointerdown',event=>event.preventDefault());const palette=make('div',colors);palette.className='document-colour-options';
  for(const name of ['accent','muted','red','orange','amber','olive','green','teal','blue','indigo','purple','pink','brown']){const ink='wp-c-'+name,button=make('button',palette,name[0].toUpperCase()+name.slice(1));button.type='button';button.className='document-edit';button.dataset.textColour=ink;button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',()=>{format('span',ink);colors.open=false;});}
  editor.addEventListener('beforeinput',event=>{if(!target()||['insertFromPaste','insertFromDrop'].includes(event.inputType))event.preventDefault();});
  editor.addEventListener('input',()=>commit());
  editor.addEventListener('paste',event=>{event.preventDefault();if(!target())return;const value=event.clipboardData?.getData('text/plain');if(typeof value!=='string'||!value.isWellFormed()){onRejected('Paste contains invalid text. Previous content retained.');return;}if(value.length>131072){onRejected('Paste is too large for inline formatting. Use a plain text block or paste a smaller section.');return;}const selected=selection();if(!selected){onRejected('Place the cursor in this text block before pasting.');return;}selected.r.deleteContents();const node=doc.createTextNode(value);selected.r.insertNode(node);selected.r.setStartAfter(node);selected.r.collapse(true);selected.s.removeAllRanges();selected.s.addRange(selected.r);commit(false);});
  editor.addEventListener('drop',event=>event.preventDefault());
  editor.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&!event.shiftKey&&!event.isComposing){const tag={b:'strong',i:'em',u:'u'}[event.key.toLowerCase()];if(tag){event.preventDefault();if(!event.repeat)format(tag);}}});
  return editor;
 }
 window.SirenNativeDocsRichText=Object.freeze({inspect,editable,render,color,styleColor,textClasses});
})();
