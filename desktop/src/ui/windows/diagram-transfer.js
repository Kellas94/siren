(() => {
 'use strict';
 const close=document.getElementById('closeView');
 if(!close||!window.sirenWindowDock||!window.sirenWindow)return;
 const button=document.createElement('button');button.id='transferView';button.type='button';button.hidden=true;
 close.before(button);
 let disposed=false,busy=false,refreshing=false,placement=null,windowId=null,timer;
 async function refresh(){
  if(disposed||refreshing)return;refreshing=true;
  try{
   const current=await window.sirenWindow.getView();
   if(disposed)return;
   if(!current?.ok||current.view.role!=='diagram'){button.hidden=true;windowId=null;return;}
   const result=await window.sirenWindowDock.getShelf();
   if(disposed)return;
   const own=result?.ok&&Array.isArray(result.items)?result.items.find(item=>item.windowId===current.view.windowId&&item.role==='diagram'):null;
   if(!own){button.hidden=true;windowId=null;return;}
   windowId=own.windowId;placement=own.placement;document.body.dataset.nativePlacement=placement;
   button.hidden=false;button.textContent=placement==='attached'?'Detach window':'Attach to workspace';
   button.title=placement==='attached'?'Open separately · Ctrl+Alt+D':'Keep this diagram in the workspace · Ctrl+Alt+A';
  }catch{if(!disposed){button.hidden=true;windowId=null;}}
  finally{refreshing=false;}
 }
 button.addEventListener('click',async()=>{
  if(disposed||busy||!windowId)return;busy=true;button.disabled=true;
  const selected=windowId,method=placement==='attached'?'detach':'attach';
  try{
   const result=await window.sirenWindowDock[method]({windowId:selected});
   if(!disposed){button.dataset.result=result?.ok?'moved':'refused';if(!result?.ok)button.title='The diagram could not be moved. Your work was retained.';}
  }catch{if(!disposed)button.dataset.result='refused';}
  finally{busy=false;if(!disposed){button.disabled=false;await refresh();}}
 });
 window.sirenWindow.onReady(()=>void refresh());timer=setInterval(()=>void refresh(),1200);void refresh();
 window.addEventListener('unload',()=>{disposed=true;clearInterval(timer);},{once:true});
})();
