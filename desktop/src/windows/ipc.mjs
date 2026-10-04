const roles = new Set(['workspace', 'docs', 'code', 'diagram', 'presenter', 'audience']);
const methods = new Set(['getView', 'listViews', 'openView', 'focusView', 'closeView']);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const messages = Object.freeze({
  SENDER_REFUSED: 'Untrusted native window request',
  REQUEST_REFUSED: 'Invalid native window request',
  ACCESS_REFUSED: 'Native view access refused',
  VIEW_REFUSED: 'Native view unavailable',
  CANCELLED: 'Native window close cancelled',
  WINDOW_DESTROY_FAILED: 'Native window destruction incomplete',
  WINDOW_CLOSE_TIMEOUT: 'Native window close confirmation timed out',
  OPERATION_FAILED: 'Native window operation failed',
});
const failure = code => ({ ok: false, code, message: messages[code] });
const reject = code => { throw Object.assign(new Error(messages[code]), { code }); };
const thenable = value => value !== null && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';

function request(method, payload) {
  if (!methods.has(method)) reject('REQUEST_REFUSED');
  if ((method === 'getView' || method === 'listViews') && payload == null) return {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) reject('REQUEST_REFUSED');
  const prototype = Object.getPrototypeOf(payload);
  if (prototype !== Object.prototype && prototype !== null) reject('REQUEST_REFUSED');
  const descriptors = Object.getOwnPropertyDescriptors(payload);
  const keys = Reflect.ownKeys(descriptors);
  const allowed = method === 'openView' ? ['role', 'entityId', 'version']
    : method === 'focusView' || method === 'closeView' ? ['windowId'] : [];
  if (keys.some(key => !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) reject('REQUEST_REFUSED');
  const data = Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
  if (method === 'openView') {
    if (!roles.has(data.role) || !validId(data.entityId)
      || data.role === 'diagram' && Object.hasOwn(data, 'version')
      || Object.hasOwn(data, 'version') && (!Number.isSafeInteger(data.version) || data.version < 0)) reject('REQUEST_REFUSED');
  } else if ((method === 'focusView' || method === 'closeView') && !validId(data.windowId)) reject('REQUEST_REFUSED');
  return Object.freeze(data);
}

function grant(value) {
  if (!value || !validId(value.windowId) || !validId(value.projectId) || !roles.has(value.role)
    || !Number.isSafeInteger(value.epoch) || value.epoch < 1
    || !Number.isSafeInteger(value.webContentsId) || value.webContentsId < 1
    || typeof value.mainFrameUrl !== 'string' || !Array.isArray(value.entityIds) || !value.entityIds.every(validId)) return null;
  return { webContentsId: value.webContentsId, mainFrameUrl: value.mainFrameUrl, windowId: value.windowId,
    role: value.role, projectId: value.projectId, epoch: value.epoch,
    entityIds: value.role === 'audience' ? [] : [...value.entityIds] };
}

function record(value, caller) {
  if (!value || !validId(value.windowId) || !roles.has(value.role)
    || value.projectId !== caller.projectId || value.epoch !== caller.epoch
    || !(validId(value.entityId) || value.role === 'workspace' && value.entityId === null)
    || !['active', 'minimized'].includes(value.state)) return null;
  return { windowId: value.windowId, role: value.role, projectId: value.projectId,
    epoch: value.epoch, entityId: value.entityId, state: value.state };
}

/** Registry-only authority; payloads never supply caller scope or native identity.
 * Native close may finish asynchronously. The registry confirms intentional
 * self-close under the captured native caller and unchanged epoch/policy.
 * Every other awaited operation is followed by a native caller recheck.
 */
export async function invokeWindow({ event, method, payload, registry }) {
  let initial;
  let sender;
  let senderFrame;
  const current = () => {
    if (event?.sender !== sender || event?.senderFrame !== senderFrame) return null;
    const value = grant(registry.caller(event));
    return value && ['windowId', 'role', 'projectId', 'epoch', 'webContentsId', 'mainFrameUrl']
      .every(key => value[key] === initial[key]) ? value : null;
  };
  const recheck = () => { const value = current(); if (!value) reject('SENDER_REFUSED'); return value; };
  try {
    initial = grant(registry?.caller(event));
    if (!initial) return failure('SENDER_REFUSED');
    sender = event.sender; senderFrame = event.senderFrame;
    const data = request(method, payload);
    if (method === 'getView') return { ok: true, view: initial };
    if (method === 'openView') {
      if (initial.role !== 'workspace' || !['code', 'docs', 'diagram'].includes(data.role)
        || !initial.entityIds.includes(data.entityId)) return failure('ACCESS_REFUSED');
      const opened = await registry.openView(data);
      const live = current();
      const view = live && record(opened, live);
      if (!view || view.role !== data.role || view.entityId !== data.entityId) {
        // Trusted registry disposal bypasses a user-cancelable normal close.
        if (!validId(opened?.windowId) || typeof registry.discardView !== 'function'
          || registry.discardView(opened.windowId) !== true) return failure('WINDOW_DESTROY_FAILED');
        return failure(live ? 'VIEW_REFUSED' : 'SENDER_REFUSED');
      }
      return { ok: true, view };
    }
    if (method === 'listViews' && initial.role !== 'workspace') return failure('ACCESS_REFUSED');
    if ((method === 'focusView' || method === 'closeView') && initial.role !== 'workspace'
      && data.windowId !== initial.windowId) return failure('ACCESS_REFUSED');
    let views = registry.listViews();
    if (thenable(views)) { views = await views; recheck(); }
    const live = recheck();
    if (!Array.isArray(views)) reject('OPERATION_FAILED');
    const scoped = views.map(value => record(value, live)).filter(Boolean);
    if (method === 'listViews') return { ok: true, views: scoped };
    const target = scoped.find(view => view.windowId === data.windowId);
    if (!target) return failure('VIEW_REFUSED');
    if (method === 'closeView' && target.role === 'workspace') return failure('ACCESS_REFUSED');
    recheck();
    let performed = method === 'closeView' ? registry.closeView(target.windowId, { caller: event }) : registry.focusView(target.windowId);
    const waited = thenable(performed);
    if (waited) performed = await performed;
    if (method === 'closeView' && target.windowId === initial.windowId && performed === true) {
      if (event.sender !== sender || event.senderFrame !== senderFrame
        || registry.confirmClosedCaller?.(event, initial) !== true) reject('SENDER_REFUSED');
    } else if (waited) recheck();
    if (performed !== true) return failure(method === 'closeView' ? 'CANCELLED' : 'VIEW_REFUSED');
    return method === 'closeView' ? { ok: true, closed: true } : { ok: true, focused: true };
  } catch (error) {
    // Only known local refusal codes are emitted; never forward native text.
    const code = typeof error?.code === 'string' && Object.hasOwn(messages, error.code) ? error.code : 'OPERATION_FAILED';
    // Rejected awaits need the same fence as fulfilled ones. Destruction failure
    // stays visible even when revocation caused the attempted disposal.
    if (initial && sender && code !== 'WINDOW_DESTROY_FAILED') {
      try { if (!current()) return failure('SENDER_REFUSED'); }
      catch { return failure('SENDER_REFUSED'); }
    }
    return failure(code);
  }
}
