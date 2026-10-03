const { contextBridge, ipcRenderer } = require('electron');
const methods = ['pickProject', 'saveProject', 'exportProject', 'getAccess', 'beginLogin', 'logout', 'getUpdate', 'checkForUpdates', 'downloadUpdate', 'cancelUpdate', 'restartAndUpdate', 'getRecovery', 'restoreRecovery', 'exportRecovery', 'requestClose', 'exportDiagnostics', 'getPinState', 'setupPin', 'unlockPin', 'verifyCurrentPin', 'changePin', 'lockPin'];
const bridge = Object.fromEntries(methods.map(name => [name, payload => ipcRenderer.invoke('siren:desktop', name, payload)]));
bridge.onStatus = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const listener = (_event, state) => callback(state);
  ipcRenderer.on('siren:status', listener);
  return () => ipcRenderer.removeListener('siren:status', listener);
};
bridge.onCommand = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const allowed = new Set(['desktopOpenProject', 'desktopExportProject', 'desktopLogin', 'desktopCheckUpdates', 'desktopRecovery', 'desktopGuide', 'desktopPinSettings', 'desktopLockPin']);
  const listener = (_event, command) => { if (allowed.has(command)) callback(command); };
  ipcRenderer.on('siren:command', listener);
  return () => ipcRenderer.removeListener('siren:command', listener);
};
contextBridge.exposeInMainWorld('sirenDesktop', Object.freeze(bridge));
const bootstrap = ipcRenderer.sendSync('siren:bootstrap');
contextBridge.exposeInMainWorld('sirenDesktopBootstrap', bootstrap);
contextBridge.exposeInMainWorld('sirenDesktopReady', () => ipcRenderer.send('siren:ready'));
const windowMethods = ['getView', 'listViews', 'openView', 'focusView', 'closeView'];
contextBridge.exposeInMainWorld('sirenWindow', Object.freeze(Object.fromEntries(windowMethods.map(method => [method, payload => ipcRenderer.invoke('siren:windows', method, payload)]))));
