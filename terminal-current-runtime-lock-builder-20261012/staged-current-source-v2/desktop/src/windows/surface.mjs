const failure=code=>Object.assign(new Error(code==='SURFACE_MOVE_FAILED'
  ?'Native workspace movement incomplete':'Native workspace destruction incomplete'),{code});
const live=value=>value&&typeof value.isDestroyed==='function'&&!value.isDestroyed();
const surfaces=new WeakMap();
const ownedWindows=new WeakSet();
// Only the main process can associate actual native handles. This lookup is
// never exposed by preloads and cannot be recreated with projected IDs.
export const workspaceSurfaceFor=window=>surfaces.get(window)??null;
export const ownsWorkspaceWindow=window=>ownedWindows.has(window);

/** Main-only surface for Code/Docs docking. Disposal is asynchronous;
 * production retirement must await dispose() before granting a
 * Lock/close/retirement receipt. Keeping the hidden empty shell retains native
 * identity; reparenting its one view never creates/reloads/copies a renderer.
 * isCurrent is a trusted captured-grant check, never a renderer-supplied flag.
 */
export function createWorkspaceSurface({BaseWindow,WebContentsView,host,windowOptions={},
  webPreferences={},isCurrent,destructionTimeoutMs=10000,onFailure=()=>{}}){
  if(typeof BaseWindow!=='function'||typeof WebContentsView!=='function'||typeof isCurrent!=='function'
    ||typeof onFailure!=='function'||!live(host)||!live(host.webContents)||!host.contentView
    ||typeof host.on!=='function'||typeof host.off!=='function'
    ||!Number.isSafeInteger(destructionTimeoutMs)||destructionTimeoutMs<1||destructionTimeoutMs>10000)
    throw new TypeError('Owned native surface and bounded disposal required');
  const window=new BaseWindow({...windowOptions,show:false});ownedWindows.add(window);let view;
  try{view=new WebContentsView({webPreferences:{
    ...(typeof webPreferences.preload==='string'?{preload:webPreferences.preload}:{}),
    sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,
  }});}catch(error){try{window.destroy();if(!window.isDestroyed())throw failure('WINDOW_DESTROY_FAILED');}
    catch{throw Object.assign(failure('WINDOW_DESTROY_FAILED'),{nativeWindow:window});}throw error;}
  const webContents=view.webContents;
  Object.defineProperty(window,'webContents',{value:webContents});
  let parent=window,placement='detached',visible=true,retiring=false,pending=null;
  const current=()=>{
    try{return !retiring&&live(window)&&live(webContents)&&live(host)&&live(host.webContents)&&isCurrent()===true;}
    catch{return false;}
  };
  const viewport=target=>{
    // The main host reserves the 54px application navigation and 48px view shelf.
    const {width,height}=target.getContentBounds();const top=target===host?102:0;
    return Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&width<=32768&&height>top&&height<=32768
      ?{x:0,y:top,width,height:height-top}:null;
  };
  const owned=target=>live(target)&&target.contentView.children.includes(view);
  const move=target=>{
    if(!current())return false;
    const bounds=viewport(target);if(!bounds)return false;
    try{
      target.contentView.addChildView(view);parent=target;
      const other=target===host?window:host;
      if(!owned(target)||owned(other))throw failure('SURFACE_MOVE_FAILED');
      view.setBounds(bounds);view.setVisible(true);visible=true;
      placement=target===host?'attached':'detached';
      if(target===host)window.hide();else window.show();
      if(!current())throw failure('SURFACE_MOVE_FAILED');
      return true;
    }catch{
      retiring=true;
      try{view.setVisible(false);}catch{}
      throw failure('SURFACE_MOVE_FAILED');
    }
  };
  // BaseWindow does not own/destroy the view's webContents. Remove confidential
  // pixels before the first await and prove the actual destroyed event before
  // destroying the native shell. A deadline never becomes a success receipt.
  const conceal=()=>{
    let failed=false;
    try{view.setVisible(false);visible=false;}catch{failed=true;}
    for(const target of [host,window]){
      if(!live(target))continue;
      try{if(target.contentView.children.includes(view))target.contentView.removeChildView(view);
        if(target.contentView.children.includes(view))failed=true;}catch{failed=true;}
    }
    try{if(live(window))window.hide();}catch{failed=true;}
    if(failed)throw failure('WINDOW_DESTROY_FAILED');
  };
  const closeContents=()=>{
    if(!live(webContents))return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let settled=false,timer;
      const finish=success=>{
        if(settled)return;settled=true;clearTimeout(timer);webContents.off('destroyed',destroyed);
        if(success&&webContents.isDestroyed())resolve();else reject(failure('WINDOW_DESTROY_FAILED'));
      };
      const destroyed=()=>finish(true);
      webContents.on('destroyed',destroyed);
      timer=setTimeout(()=>finish(false),destructionTimeoutMs);
      try{webContents.close({waitForBeforeUnload:false});if(webContents.isDestroyed())finish(true);}
      catch{finish(false);}
    });
  };
  const dispose=()=>{
    if(pending)return pending;
    if(window.isDestroyed()&&webContents.isDestroyed())return Promise.resolve(true);
    retiring=true;
    // Deferring the promise body would leave sensitive pixels present for an
    // extra turn. The concealment is synchronous even though destruction isn't.
    let preparation;
    try{conceal();preparation=closeContents();}catch{preparation=Promise.reject(failure('WINDOW_DESTROY_FAILED'));}
    const operation=preparation.then(()=>{
      if(live(webContents))throw failure('WINDOW_DESTROY_FAILED');
      try{if(live(window))window.destroy();}catch{throw failure('WINDOW_DESTROY_FAILED');}
      if(live(window)||live(webContents))throw failure('WINDOW_DESTROY_FAILED');
      window.off('closed',emergency);host.off('closed',emergency);webContents.off('destroyed',emergency);
      placement='destroyed';return true;
    });
    pending=operation.finally(()=>{pending=null;});return pending;
  };
  const emergency=()=>{
    if(placement==='destroyed')return;
    void dispose().catch(error=>{try{onFailure(error);}catch{}});
  };
  window.on('closed',emergency);
  host.on('closed',emergency);webContents.on('destroyed',emergency);
  const surface=Object.freeze({window,view,webContents,
    attach:()=>move(host),detach:()=>move(window),
    setAttachedVisible:value=>{
      if(typeof value!=='boolean'||!current()||placement!=='attached'||!owned(host))return false;
      try{view.setVisible(value);visible=value;return current();}
      catch{retiring=true;try{view.setVisible(false);}catch{}throw failure('SURFACE_MOVE_FAILED');}
    },
    resize:()=>{
      if(!current()||!owned(parent))return false;const bounds=viewport(parent);if(!bounds)return false;
      try{view.setBounds(bounds);return true;}catch{return false;}
    },
    focus:()=>{
      if(!current()||!owned(parent)||!visible)return false;
      try{
        // On Windows a minimized BaseWindow reports a genuine 0x0 client area.
        // Restore only after the grant check, then recheck before measuring it.
        if(parent.isMinimized())parent.restore();
        if(!current()||!owned(parent))return false;
        const bounds=viewport(parent);if(!bounds)return false;
        view.setBounds(bounds);parent.show();parent.focus();webContents.focus();return current();
      }catch{return false;}
    },
    dispose,isDestroyed:()=>window.isDestroyed()&&webContents.isDestroyed(),
    placement:()=>placement,isVisible:()=>visible,
  });
  surfaces.set(window,surface);
  try{const bounds=viewport(window);if(!bounds)throw failure('SURFACE_MOVE_FAILED');
    window.contentView.addChildView(view);view.setBounds(bounds);}
  catch{emergency();throw Object.assign(failure('SURFACE_MOVE_FAILED'),{nativeWindow:window});}
  return surface;
}
