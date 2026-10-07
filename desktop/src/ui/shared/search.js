(() => {
 'use strict';
 let dialog=null,serial=0,off=null;
 const names={docs:'Docs',code:'⌘ Code',diagram:'Diagrams',presenter:'Present'};
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const close=()=>{serial++;off?.();off=null;if(dialog){dialog.replaceChildren();dialog.remove();dialog=null;}};
 window.SirenProjectSearch=Object.freeze({open(){
  if(location.href!=='siren://app/home.html'||!window.sirenHomeView||dialog)return;
  const own=++serial;dialog=make('dialog',document.body);dialog.id='sirenProjectFind';dialog.setAttribute('aria-labelledby','sirenProjectFindTitle');
  make('h2',dialog,'Find in project').id='sirenProjectFindTitle';make('p',dialog,'Search saved names across Diagrams, Docs, Code and Present. Code text search remains Ctrl+F inside Code.').className='document-caption';
  const form=make('form',dialog),label=make('label',form,'Name');label.htmlFor='sirenProjectFindQuery';const input=make('input',form);input.id='sirenProjectFindQuery';input.type='search';input.maxLength=160;input.autocomplete='off';
  const submit=make('button',form,'Search');submit.type='submit';submit.id='sirenProjectFindSubmit';
  const rows=make('div',dialog);rows.id='sirenProjectFindResults';const notice=make('p',dialog,'');notice.setAttribute('role','status');
  const more=make('button',dialog,'More results');more.type='button';more.hidden=true;const done=make('button',dialog,'Done');done.type='button';done.addEventListener('click',close);
  let cursor=0,query='',count=0,busy=false;
  const current=()=>own===serial&&dialog?.open===true;
  const load=async()=>{
   if(!current()||busy)return;busy=true;submit.disabled=more.disabled=input.disabled=true;notice.textContent='Searching saved names…';
   try{const result=await window.sirenHome.getCatalog({role:'all',cursor,...(query?{query}:{})});if(!current())return;
    if(!result?.ok){notice.textContent='Open a project to search its saved items.';more.hidden=true;return;}
    for(const item of result.items){if(!Object.hasOwn(names,item.role))continue;const row=make('button',rows);row.type='button';row.dataset.entityId=item.entityId;row.dataset.role=item.role;
     make('span',row,item.label).className='siren-find-name';make('small',row,names[item.role]+(item.sourceRef?' · v'+item.sourceRef.version:''));count++;
     row.addEventListener('click',()=>{if(!current()||busy)return;close();void window.sirenHomeView.openFoundItem(item);});
    }cursor=result.nextCursor;more.hidden=result.hasMore!==true;
    notice.textContent=count?count+' saved items'+(result.truncated?' · Search limited to 4,096 items':''):'No matching saved names.';
   }catch{if(current())notice.textContent='Search unavailable. Your work was retained.';}
   finally{busy=false;if(current())submit.disabled=more.disabled=input.disabled=false;}
  };
  form.addEventListener('submit',event=>{event.preventDefault();if(busy||!current())return;query=input.value.trim();cursor=count=0;rows.replaceChildren();void load();});more.addEventListener('click',()=>void load());dialog.addEventListener('close',close,{once:true});off=window.sirenHome.onInvalidated(close);dialog.showModal();input.focus();void load();
 }});
})();
