import { restoreBounds } from './geometry.mjs';

/** Data-free native shells. Main supplies the native registry's exact role URL. */
export function nativeViewFactory({ BrowserWindow, displays, preload, presentationPreload, onCreated = () => {} }) {
  return async options => {
    const expected = `siren://app/windows/${options.role}.html?windowId=${options.windowId}`;
    const presenting=['presenter','audience'].includes(options.role);
    if (!['code', 'docs', 'diagram','presenter','audience'].includes(options.role) || presenting&&typeof presentationPreload!=='string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(options.windowId) || options.mainFrameUrl !== expected) {
      throw Object.assign(new Error('Native entrypoint refused'), { code: 'REQUEST_REFUSED' });
    }
    const { normalBounds } = restoreBounds({}, displays());
    const window = new BrowserWindow({ ...normalBounds, show: false, title: 'SIREN — '+({code:'Code',diagram:'Diagrams',docs:'Docs',presenter:'Presenter',audience:'Audience'}[options.role]),
      minWidth: Math.min(480, normalBounds.width), minHeight: Math.min(320, normalBounds.height), backgroundColor: '#171719',
      webPreferences: { preload:presenting?presentationPreload:preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true },
    });
    try {
      const wc = window.webContents;
      wc.setWindowOpenHandler(() => ({ action: 'deny' }));
      wc.on('will-navigate', event => { if (event.url !== expected) event.preventDefault(); });
      wc.on('will-frame-navigate', event => { if (!event.isMainFrame || event.url !== expected) event.preventDefault(); });
      wc.on('will-attach-webview', event => event.preventDefault());
      onCreated(window, options);
      await window.loadURL(expected);
      if (window.isDestroyed() || wc.isDestroyed() || wc.getURL() !== expected || wc.mainFrame.url !== expected) {
        throw Object.assign(new Error('Native entrypoint unavailable'), { code: 'ACCESS_REFUSED' });
      }
      return window; // Registration, revalidation and show belong to main.
    } catch (error) {
      try { if (!window.isDestroyed()) window.destroy(); if (!window.isDestroyed()) throw new Error('Native destruction not confirmed'); } catch {
        throw Object.assign(new Error('Unregistered native window destruction incomplete'), { code: 'WINDOW_DESTROY_FAILED' });
      }
      throw error;
    }
  };
}
