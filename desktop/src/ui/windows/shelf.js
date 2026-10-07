(() => {
 'use strict';
 if(!window.sirenWindowDock||!window.sirenWindow||window.sirenNativeShelf)return;
 let bar,tabs,active,notice,rows=[],pending=false,signature='',timer,disposed=false;
 const make=(tag,parent,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;parent.append(node);return node;};
 const button=(parent,text,action)=>{const node=make('button',parent,text);node.type='button';node.addEventListener('click',()=>void act(action));return node;};
 async function act(action){
  if(pending||disposed)return;pending=true;
  try{const result=await action();notice.textContent=result?.ok?'':'View unavailable. Your work was retained.';}
  catch{notice.textContent='View unavailable. Your work was retained.';}
  finally{pending=false;signature='';await refresh();}
 }
 function build(){
  bar=make('nav',document.body);bar.id='nativeWindowShelf';bar.setAttribute('aria-label','Open Code, Docs and Diagrams views');
  button(bar,'Workspace',()=>window.sirenWindowDock.showWorkspace()).title='Return to the main workspace · Ctrl+Alt+1';
  tabs=make('div',bar);tabs.className='native-shelf-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Open views');
  active=button(bar,'Detach',()=>{const item=rows.find(row=>row.selected);return item?window.sirenWindowDock.detach({windowId:item.windowId}):Promise.resolve({ok:false});});
  active.title='Open selected view in its own window · Ctrl+Alt+D';
  notice=make('span',bar);notice.setAttribute('role','status');
 }
 function paint(items){
  rows=items;if(!bar)build();bar.hidden=items.length===0;
  document.body.classList.toggle('native-shelf-open',items.length>0);active.hidden=!items.some(item=>item.selected);
  const focused=document.activeElement?.dataset?.windowId;
  tabs.replaceChildren();const counts={code:0,docs:0,diagram:0},labels={code:'⌘ Code',docs:'Docs',diagram:'Diagrams'};
  for(const item of items){
    const fallback=labels[item.role]+' '+(++counts[item.role]);
    const label=typeof item.label==='string'?item.label:fallback,dirty=label.endsWith(' · Unsaved'),min=item.state==='minimized';
    const name=label+(min?' · Minimized':''),tab=button(tabs,'',()=>window.sirenWindow.focusView({windowId:item.windowId}));
    make('span',tab,dirty?label.slice(0,-10):label).className='native-shelf-name';
    for(const text of [dirty?' · Unsaved':'',min?' · Minimized':''])if(text)make('span',tab,text).className='native-shelf-state';
    tab.setAttribute('aria-label',name);
    tab.dataset.windowId=item.windowId;tab.setAttribute('aria-pressed',String(item.selected));
    tab.title=name+' · '+(item.placement==='attached'?'Attached':'Separate window')+' · '+item.entityId;
    if(item.placement==='detached')tab.classList.add('native-shelf-detached');
    if(item.windowId===focused)tab.focus({preventScroll:true});
  }
 }
 async function refresh(){
  if(disposed)return;
  try{const result=await window.sirenWindowDock.getShelf();if(disposed)return;
    const items=result?.ok&&Array.isArray(result.items)?result.items:[],next=JSON.stringify(items);
    if(next!==signature){signature=next;paint(items);}
  }catch{if(bar){bar.hidden=true;document.body.classList.remove('native-shelf-open');}}
 }
 window.sirenNativeShelf=Object.freeze({refresh});
 const start=()=>{void refresh();timer=setInterval(()=>void refresh(),1200);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.addEventListener('unload',()=>{disposed=true;clearInterval(timer);},{once:true});
})();
