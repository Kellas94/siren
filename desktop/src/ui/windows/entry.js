(() => {
  'use strict';
  const status = document.getElementById('viewStatus');
  const heading = document.getElementById('viewTitle');
  let serial = 0;
  const connect = async () => {
    const current = ++serial;
    const result = await window.sirenWindow.getView();
    if (current !== serial) return;
    if (!result?.ok || result.view.role !== document.body.dataset.role) {
      status.textContent = 'Waiting for the workspace…'; return;
    }
    heading.textContent = result.view.role === 'code' ? '⌘ Code' : 'Docs';
    status.textContent = 'Connected to the project. Shared editor integration is in development.';
    document.body.dataset.connected = 'true';
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
