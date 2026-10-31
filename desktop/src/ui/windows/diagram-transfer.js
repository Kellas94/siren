(() => {
 'use strict';
 const close=document.getElementById('closeView');
 if(!close||!window.sirenWindowDock||!window.sirenWindow)return;
 const button=document.createElement('button');button.id='transferView';button.type='button';button.hidden=true;button.disabled=true;
 close.before(button);
 let disposed=false,busy=false,refreshing=false,placed=false,placement=null,windowId=null,timer,refreshDone=Promise.resolve();
 function unavailable(){windowId=null;if(!placed)button.hidden=true;button.disabled=true;}
 let settlePlacement;
 const initiallyPlaced=new Promise(resolve=>{settlePlacement=resolve;});
 window.SirenNativeDiagramTransfer=Object.freeze({whenPlaced:()=>initiallyPlaced});
 async function refresh(){
  if(disposed||refreshing)return;refreshing=true;
  let finishRefresh;refreshDone=new Promise(resolve=>{finishRefresh=resolve;});
  try{
   const current=await window.sirenWindow.getView();
   if(disposed)return;
   if(!current?.ok||current.view.role!=='diagram'){unavailable();return;}
   const result=await window.sirenWindowDock.getShelf();
   if(disposed)return;
   const own=result?.ok&&Array.isArray(result.items)?result.items.find(item=>item.windowId===current.view.windowId&&item.role==='diagram'):null;
   if(!own||!['attached','detached'].includes(own.placement)){unavailable();return;}
   windowId=own.windowId;placement=own.placement;document.body.dataset.nativePlacement=placement;
   placed=true;button.hidden=false;button.disabled=busy;button.textContent=placement==='attached'?'Detach window':'Attach to workspace';
   button.title=placement==='attached'?'Open separately · Ctrl+Alt+D':'Keep this diagram in the workspace · Ctrl+Alt+A';
   // Finish the first header layout before the editor exposes ready content.
   // Later transfers preserve the existing renderer and working draft.
   settlePlacement(true);
  }catch{if(!disposed)unavailable();}
  finally{refreshing=false;finishRefresh();}
 }
 button.addEventListener('click',async()=>{
  if(disposed||busy||!windowId)return;busy=true;button.disabled=true;
  const selected=windowId,method=placement==='attached'?'detach':'attach';
  try{
   const result=await window.sirenWindowDock[method]({windowId:selected});
   if(!disposed){button.dataset.result=result?.ok?'moved':'refused';if(!result?.ok)button.title='The diagram could not be moved. Your work was retained.';}
  }catch{if(!disposed)button.dataset.result='refused';}
  finally{
   // A transfer can settle while placement polling is still in flight. Keep
   // duplicate actions fenced until that observation and a fresh check finish.
   if(!disposed){unavailable();if(refreshing)await refreshDone;await refresh();}
   busy=false;if(!disposed)button.disabled=!windowId;
  }
 });
 window.sirenWindow.onReady(()=>void refresh());timer=setInterval(()=>void refresh(),1200);void refresh();
 window.addEventListener('unload',()=>{disposed=true;settlePlacement(false);clearInterval(timer);},{once:true});
})();
