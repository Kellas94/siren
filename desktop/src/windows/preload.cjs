const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sirenSource', Object.freeze(Object.fromEntries(['getMetrics', 'readRange'].map(method => [method, payload => ipcRenderer.invoke('siren:sources', method, payload)]))));
const methods = ['getView', 'listViews', 'openView', 'focusView', 'closeView'];
const bridge = Object.fromEntries(methods.map(method => [method, payload => ipcRenderer.invoke('siren:windows', method, payload)]));
bridge.onReady = callback => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const listener = () => callback();
  ipcRenderer.on('siren:view-ready', listener);
  return () => ipcRenderer.removeListener('siren:view-ready', listener);
};
contextBridge.exposeInMainWorld('sirenWindow', Object.freeze(bridge));
