import { restoreBounds } from './geometry.mjs';
import {setTimeout as nativePause} from 'node:timers/promises';
import {workspaceSurfaceFor} from './surface.mjs';

/** Hidden native shells can acquire a different frame size during creation on
 * a scaled display. Place then size on that display before caching a mode. */
export async function settleHiddenBounds(window,bounds){
  if(typeof window.getBounds!=='function')return;
  const same=b=>['x','y','width','height'].every(k=>b[k]===bounds[k]);
  window.setPosition(bounds.x,bounds.y,false);await nativePause(32);
  if(window.isDestroyed())throw Error('Native geometry retired');
  window.setSize(bounds.width,bounds.height,false);
  const deadline=Date.now()+2000;let stable=0,previous,compensated=false;
  do{
    await nativePause(16);if(window.isDestroyed())throw Error('Native geometry retired');const current=window.getBounds();stable=same(current)?stable+1:0;if(stable===2)return;
    // Windows frame rounding on a scaled display can add one DIP to sizing.
    // One measured compensation is allowed; success still requires the exact
    // requested rectangle over two subsequent native turns, never a tolerance.
    if(!compensated&&previous&&['x','y','width','height'].every(k=>previous[k]===current[k])&&current.x===bounds.x&&current.y===bounds.y){
      compensated=true;const width=2*bounds.width-current.width,height=2*bounds.height-current.height;
      if(Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0&&width<=32768&&height<=32768)window.setSize(width,height,false);
    }
    previous=current;
  }while(Date.now()<deadline);
  console.warn('SIREN_NATIVE_GEOMETRY_INCOMPLETE',JSON.stringify({requested:bounds,observed:window.getBounds()}));
  throw Error('Native geometry incomplete');
}

/** Data-free native shells. Main supplies the native registry's exact role URL. */
export function nativeViewFactory({ BrowserWindow, displays, preload, presentationPreload, layoutMemory, createSurface, onCreated = () => {} }) {
  return async options => {
    const expected = `siren://app/windows/${options.role}.html?windowId=${options.windowId}`;
    const presenting=['presenter','audience'].includes(options.role);
    if (!['code', 'docs', 'diagram','presenter','audience'].includes(options.role) || presenting&&typeof presentationPreload!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(options.windowId) || options.mainFrameUrl !== expected) {
      throw Object.assign(new Error('Native entrypoint refused'), { code: 'REQUEST_REFUSED' });
    }
    const ticket=layoutMemory?.reserve(options);
    const { normalBounds } = ticket?.layout??restoreBounds({}, displays());let window,surface;
    try {
    const windowOptions={ ...normalBounds, show: false, title: 'SIREN — '+({code:'Code',diagram:'Diagrams',docs:'Docs',presenter:'Presenter',audience:'Audience'}[options.role]),
      minWidth: Math.min(480, normalBounds.width), minHeight: Math.min(320, normalBounds.height), backgroundColor: '#171719',
    };
    const webPreferences={ preload:presenting?presentationPreload:preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true };
    if(['code','docs','diagram'].includes(options.role)&&typeof createSurface==='function'){
      surface=createSurface({windowOptions,webPreferences});window=surface?.window;
      if(!window||workspaceSurfaceFor(window)!==surface||window.webContents!==surface.webContents)
        throw Object.assign(Error('Owned native surface required'),{code:'ACCESS_REFUSED'});
    }else window=new BrowserWindow({...windowOptions,webPreferences});
      if(ticket)window.once('closed',()=>layoutMemory.release(ticket));
      const wc = window.webContents;
      wc.setWindowOpenHandler(() => ({ action: 'deny' }));
      wc.on('will-navigate', event => { if (event.url !== expected) event.preventDefault(); });
      wc.on('will-frame-navigate', event => { if (!event.isMainFrame || event.url !== expected) event.preventDefault(); });
      wc.on('will-attach-webview', event => event.preventDefault());
      onCreated(window, options, ticket);
      if(surface)await wc.loadURL(expected);else await window.loadURL(expected);
      if (window.isDestroyed() || wc.isDestroyed() || wc.getURL() !== expected || wc.mainFrame.url !== expected) {
        throw Object.assign(new Error('Native entrypoint unavailable'), { code: 'ACCESS_REFUSED' });
      }
      if(ticket)await settleHiddenBounds(window,normalBounds);
      return window; // Registration, revalidation and show belong to main.
    } catch (error) {
      if(ticket)layoutMemory.release(ticket);
      if(!window)throw error;
      try { if(surface)await surface.dispose();else if (!window.isDestroyed()) window.destroy();
        if (!window.isDestroyed()||surface&&!surface.isDestroyed()) throw new Error('Native destruction not confirmed'); } catch {
        throw Object.assign(new Error('Unregistered native window destruction incomplete'), { code: 'WINDOW_DESTROY_FAILED',...(surface?{nativeWindow:window}:{}) });
      }
      throw error;
    }
  };
}
