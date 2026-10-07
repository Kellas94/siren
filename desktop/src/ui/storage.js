// Executed in the unprivileged renderer before the frozen SIREN IIFE.
window.createSirenDesktopStore = ({ workspaceKey }) => {
  const bootstrap = window.sirenDesktopBootstrap;
  let snapshot = bootstrap?.snapshot || null;
  const mirror = new Map(); let writeError = null; let readError = null; let queue = Promise.resolve();
  const locked = () => ({ ok: false, backend: 'native', error: new Error('Account transition pending; editing is temporarily paused') });
  const readonly = () => bootstrap?.readonly === true || window.sirenDesktopSafetyReadonly === true;
  const readonlyReceipt = () => ({ ok: false, backend: 'native', code: 'READ_ONLY', error: Object.assign(new Error('This workspace is read-only'), { code: 'READ_ONLY' }) });
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
      const baseRevision = snapshot?.revision;
      if (!snapshot) result = { ok: false, code: 'NO_PROJECT', message: 'Choose or import a desktop project before saving' };
      else {
        const request={ projectId: snapshot.project.id, baseRevision: snapshot.revision, json, purpose };
        result=await (window.sirenViewControl?.isPreparing() ? window.sirenViewControl.saveWorkspace(request) : window.sirenDesktop.saveProject(request));
      }
      // Retain only typed receipt metadata. Never copy workspace text or other
      // arbitrary native fields into diagnostics, and never infer commitment.
      const receipt = { ok: result.ok, backend: 'native', error: result.ok ? null : new Error(result.message) };
      if (typeof result.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(result.code)) {
        receipt.code = result.code; if (receipt.error) receipt.error.code = result.code;
      }
      for (const key of ['revision', 'committedRevision']) if (Number.isSafeInteger(result[key]) && result[key] >= 1) receipt[key] = result[key];
      for (const key of ['sha256', 'committedSha256']) if (typeof result[key] === 'string' && /^[a-f0-9]{64}$/.test(result[key])) receipt[key] = result[key];
      if (typeof result.workspaceCommitted === 'boolean') receipt.workspaceCommitted = result.workspaceCommitted;
      if (result.unchanged === true) receipt.unchanged = true;
      if (typeof result.checkpointAcknowledged === 'boolean') receipt.checkpointAcknowledged = result.checkpointAcknowledged;
      if (typeof result.recoveryCode === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(result.recoveryCode)) receipt.recoveryCode = result.recoveryCode;
      if (result.ok) snapshot = { ...snapshot, revision: result.revision, sha256: result.sha256, json };
      else {
        if (purpose === 'workspace' && receipt.code === 'RECOVERY_DEGRADED' && receipt.workspaceCommitted === true && receipt.committedRevision === baseRevision + (receipt.unchanged === true ? 0 : 1) && receipt.committedSha256) {
          try {
            const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
            if (hash === receipt.committedSha256) snapshot = { ...snapshot, revision: receipt.committedRevision, sha256: hash, json };
          } catch { /* No exact independent hash: keep the old CAS revision. */ }
        }
        if (writeError) writeError(receipt.error, { backend: 'native', code: receipt.code });
      }
      return receipt;
    };
    const result = queue.then(operation, operation); queue = result.catch(error => ({ ok: false, backend: 'native', error })); return result;
  };
  window.sirenDesktopFlush = () => queue;
  return {
    ready: Promise.resolve(), start() { return this.ready; }, get(key) { return mirror.get(key) ?? null; }, keys() { return [...mirror.keys()]; },
    set(key, value) { if (window.sirenDesktopStorageLocked) return Promise.resolve(locked()); if (readonly()) return Promise.resolve(readonlyReceipt()); mirror.set(key, value); return persist(key === workspaceKey ? 'workspace' : 'recovery'); },
    setWithBackup(key, value, backupKey, backupValue) {
      if (window.sirenDesktopStorageLocked) return Promise.resolve(locked());
      if (readonly()) return Promise.resolve(readonlyReceipt());
      const changed=mirror.get(key)!==value;
      mirror.set(key, value);
      // A repeated flush must preserve the prior good state. Rotating it to
      // the unchanged current state loses recovery history and advances CAS.
      if(changed||!mirror.has(backupKey))mirror.set(backupKey, backupValue);
      return persist('workspace');
    },
    remove(key) { if (window.sirenDesktopStorageLocked) return Promise.resolve(locked()); if (readonly()) return Promise.resolve(readonlyReceipt()); mirror.delete(key); return persist('recovery'); },
    onWriteError(handler) { writeError = handler; }, onRemoteChange() {},
    foreignRecord: async () => null, readFailure: () => readError, usingFallback: () => false,
  };
};
