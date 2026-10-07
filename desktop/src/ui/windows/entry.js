(() => {
  'use strict';
  const status = document.getElementById('viewStatus');
  const heading = document.getElementById('viewTitle');
  let serial = 0;
  const transfer=document.createElement('button');transfer.id='transferView';transfer.type='button';transfer.textContent='Attach to workspace';
  document.getElementById('closeView').before(transfer);
  let moving=false,placement='detached';
  async function refreshPlacement(){
    const result=await window.sirenWindowDock?.getShelf();
    const item=result?.ok?result.items[0]:null;if(!item)return;
    placement=item.placement;document.body.dataset.nativePlacement=placement;
    transfer.textContent=placement==='attached'?'Detach window':'Attach to workspace';
    transfer.title=placement==='attached'?'Open separately · Ctrl+Alt+D':'Keep this editor inside the workspace · Ctrl+Alt+A';
  }
  transfer.addEventListener('click',async()=>{
    if(moving)return;moving=true;transfer.disabled=true;
    try{const result=await window.sirenWindow.getView();if(!result?.ok)return;
      const moved=await window.sirenWindowDock[placement==='attached'?'detach':'attach']({windowId:result.view.windowId});
      if(!moved?.ok)status.textContent='The view could not be moved. Your work was retained.';
      await refreshPlacement();
    }finally{moving=false;transfer.disabled=false;}
  });
  const placementTimer=setInterval(()=>void refreshPlacement(),1200);
  window.addEventListener('unload',()=>clearInterval(placementTimer),{once:true});
  const connect = async () => {
    const current = ++serial;
    const result = await window.sirenWindow.getView();
    if (current !== serial) return;
    if (!result?.ok || result.view.role !== document.body.dataset.role) {
      status.textContent = 'Waiting for the workspace…'; return;
    }
    heading.textContent = result.view.role === 'code' ? '⌘ Code' : 'Docs';
    document.body.dataset.connected = 'true';
    await refreshPlacement();
    if(result.view.role==='code'&&window.sirenNativeCodeView){await window.sirenNativeCodeView.connect();return;}
    if(result.view.role==='docs'&&window.sirenNativeDocsView){await window.sirenNativeDocsView.connect();return;}
    status.textContent = 'Connected to the project. Shared editor integration is in development.';
  };
  window.sirenWindow.onReady(() => { void connect(); });
  document.getElementById('closeView').addEventListener('click', async () => {
    const result = await window.sirenWindow.getView();
    if (!result?.ok) return;
    const closed = await window.sirenWindow.closeView({ windowId: result.view.windowId });
    if (!closed?.ok) status.textContent = 'The window could not be closed. Your project was retained.';
  });
  void connect();
})();
