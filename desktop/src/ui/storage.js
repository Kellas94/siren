// Executed in the unprivileged renderer before the frozen SIREN IIFE.
window.createSirenDesktopStore = ({ workspaceKey }) => {
  const bootstrap = window.sirenDesktopBootstrap;
  let snapshot = bootstrap?.snapshot || null;
  const mirror = new Map(); let writeError = null; let readError = null; let queue = Promise.resolve();
  if (snapshot) {
    try {
      const value = JSON.parse(snapshot.json);
      if (value.kind === 'siren-desktop' && value.schema === 1 && value.storage && typeof value.storage === 'object') {
        for (const [key, text] of Object.entries(value.storage)) { if (typeof text === 'string') mirror.set(key, text); }
      } else mirror.set(workspaceKey, snapshot.json);
    } catch (error) { readError = error; }
  }
  const persist = purpose => {
    // Capture the exact attempted bag now, including private Code drafts and legacy managed keys.
    const json = JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: Object.fromEntries(mirror) });
    const operation = async () => {
      let result;
      if (!snapshot) result = { ok: false, code: 'NO_PROJECT', message: 'Choose or import a desktop project before saving' };
      else result = await window.sirenDesktop.saveProject({ projectId: snapshot.project.id, baseRevision: snapshot.revision, json, purpose });
      if (result.ok) snapshot = { ...snapshot, revision: result.revision, sha256: result.sha256, json };
      else { if (writeError) writeError(new Error(result.message), { backend: 'native', code: result.code }); }
      return { ok: result.ok, backend: 'native', error: result.ok ? null : new Error(result.message) };
    };
    const result = queue.then(operation, operation); queue = result.catch(() => {}); return result;
  };
  window.sirenDesktopFlush = () => queue;
  return {
    ready: Promise.resolve(), start() { return this.ready; }, get(key) { return mirror.get(key) ?? null; }, keys() { return [...mirror.keys()]; },
    set(key, value) { mirror.set(key, value); return persist(key === workspaceKey ? 'workspace' : 'recovery'); },
    setWithBackup(key, value, backupKey, backupValue) { mirror.set(key, value); mirror.set(backupKey, backupValue); return persist('workspace'); },
    remove(key) { mirror.delete(key); void persist('recovery'); },
    onWriteError(handler) { writeError = handler; }, onRemoteChange() {},
    foreignRecord: async () => null, readFailure: () => readError, usingFallback: () => false,
  };
};
