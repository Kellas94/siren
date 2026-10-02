const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const empty = value => value === undefined || value === null;
const pin = value => typeof value === 'string' && /^(?:[0-9]{4}|[0-9]{6})$/.test(value);
const pinFields = names => value => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...names].sort().join(',') && names.every(name => pin(value[name]));
const save = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).sort().join(',') !== 'baseRevision,json,projectId,purpose') return false;
  if (!id(value.projectId) || !Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0 || !['workspace', 'recovery'].includes(value.purpose)) return false;
  if (typeof value.json !== 'string' || Buffer.byteLength(value.json) > 64 * 1024 * 1024) return false;
  try { const parsed = JSON.parse(value.json); return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed); } catch { return false; }
};
export const METHODS = Object.freeze({
  pickProject: empty, saveProject: save, exportProject: id,
  getAccess: empty, beginLogin: empty, logout: empty,
  getUpdate: empty, checkForUpdates: empty, downloadUpdate: empty, cancelUpdate: empty, restartAndUpdate: empty,
  getRecovery: id, restoreRecovery: id, exportRecovery: id,
  requestClose: empty,
  exportDiagnostics: empty,
  getPinState: empty, setupPin: pinFields(['pin','confirmation']), unlockPin: pinFields(['pin']), verifyCurrentPin: pinFields(['pin']),
  changePin: pinFields(['currentPin','newPin','confirmation']), lockPin: empty,
});
export const failure = (code, message) => ({ ok: false, code, message });

const lockedMethods = new Set(['getPinState', 'setupPin', 'unlockPin', 'requestClose', 'getUpdate', 'checkForUpdates', 'cancelUpdate']);
export async function invokeDesktop({ method, payload, context, services, localAccess }) {
  if (!context?.isMainFrame || context.senderUrl !== 'siren://app/app.html') return failure('SENDER_REFUSED', 'Untrusted native request');
  if (!Object.hasOwn(METHODS, method) || !METHODS[method](payload)) return failure('REQUEST_REFUSED', 'Invalid native request');
  if (localAccess && !localAccess.state().unlocked && !lockedMethods.has(method)) return failure('PIN_REQUIRED', 'Unlock SIREN with your local PIN first');
  if (!Object.hasOwn(services, method) || typeof services[method] !== 'function') return failure('UNAVAILABLE', 'This service is not configured');
  try { return await services[method](payload); }
  catch { return failure('OPERATION_FAILED', 'The operation failed; existing data was retained'); }
}
