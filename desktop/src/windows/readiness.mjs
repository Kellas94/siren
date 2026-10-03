const refused = () => Object.assign(new Error('The initial workspace did not finish loading; retry after startup.'), { code: 'WORKSPACE_NOT_READY' });
const target = 'siren://app/app.html';
function state(contents) {
  try {
    if (contents.isDestroyed() || contents.getURL() !== target) throw refused();
    return !contents.isLoadingMainFrame();
  } catch { throw refused(); }
}

/** Native load boundary, before any PIN mutation or acknowledgement. */
export async function runAfterWorkspaceLoad(contents, operation, { timeoutMs = 10000 } = {}) {
  if (typeof operation !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw refused();
  let invalidated = false; let cleanup = () => {};
  try {
  if (!state(contents)) await new Promise((resolve, reject) => {
    let settled = false; let timer;
    cleanup = () => {
      clearTimeout(timer);
      contents.off('did-finish-load', finish); contents.off('did-fail-load', fail);
      contents.off('did-stop-loading', finish);
      contents.off('render-process-gone', broken); contents.off('destroyed', broken);
      contents.off('did-start-navigation', navigation);
    };
    const settle = error => {
      if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve();
    };
    const finish = () => { try { if (state(contents)) settle(); } catch { settle(refused()); } };
    const fail = (details, _code, _description, _url, isMainFrame) => {
      if ((details?.isMainFrame ?? isMainFrame) !== false) broken();
    };
    const broken = () => { invalidated = true; settle(refused()); };
    const navigation = (details, _url, _inPlace, isMainFrame) => {
      if ((details?.isMainFrame ?? isMainFrame) === true) broken();
    };
    try {
      contents.on('did-finish-load', finish); contents.on('did-fail-load', fail);
      contents.on('did-stop-loading', finish);
      contents.on('render-process-gone', broken); contents.on('destroyed', broken);
      contents.on('did-start-navigation', navigation);
      timer = setTimeout(broken, timeoutMs);
      finish(); // Recheck after subscribing so completion cannot be lost.
    } catch { broken(); }
  });
  if (invalidated || !state(contents)) throw refused();
  return operation();
  } finally { cleanup(); }
}
