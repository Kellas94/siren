import { randomUUID } from 'node:crypto';

const roles = new Set(['workspace', 'docs', 'code', 'presenter', 'audience']);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const refuse = (code, message) => Object.assign(new Error(message), { code });

function normalizeRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['role', 'entityId', 'version'].includes(key))
    || !Object.hasOwn(value, 'role') || !Object.hasOwn(value, 'entityId')
    || !roles.has(value.role)
    || !(validId(value.entityId) || value.role === 'workspace' && value.entityId === null)
    || Object.hasOwn(value, 'version') && (!Number.isSafeInteger(value.version) || value.version < 0)) {
    throw refuse('REQUEST_REFUSED', 'Invalid native view request');
  }
  return Object.freeze({ role: value.role, entityId: value.entityId,
    ...(Object.hasOwn(value, 'version') ? { version: value.version } : {}) });
}

function authorized(value, request) {
  if (!value || !validId(value.projectId) || !['normal', 'readonly', 'recovery'].includes(value.mode)
    || !['read', 'write', 'presentation'].includes(value.access)
    || !Array.isArray(value.entityIds) || ![...value.entityIds].every(validId)
    || request.entityId !== null && !value.entityIds.includes(request.entityId)
    || value.mode !== 'normal' && value.access === 'write'
    || request.role === 'audience' && value.access !== 'presentation'
    || request.role !== 'audience' && value.access === 'presentation') {
    throw refuse('ACCESS_REFUSED', 'Native view access refused');
  }
  return { projectId: value.projectId, mode: value.mode, access: value.access, entityIds: [...value.entityIds] };
}

/**
 * Main-process authority. authorize(request) is synchronous and supplies trusted
 * {projectId, mode, access, entityIds}; it must never copy permissions from IPC.
 * createWindow(options) returns a ready, hidden BrowserWindow; the adapter owns
 * sandbox/CSP/navigation policy and shows content only after openView succeeds.
 * Revocation cannot cancel an unresolved factory: its returned window is checked
 * and destroyed before the pending open can publish a grant.
 */
export class WindowRegistry {
  #createWindow;
  #authorize;
  #epoch = 1;
  #views = new Map();
  #retiredContents = new WeakSet();
  #destructionFailed = false;
  #unclosedWindows = new Set();
  #workspace = null;
  #closeTimeoutMs;
  #closedCallers = new WeakMap();
  #captures = new WeakMap();

  constructor({ createWindow, authorize, closeTimeoutMs = 10000 }) {
    if (typeof createWindow !== 'function' || typeof authorize !== 'function') throw new TypeError('Native factory and authorization required');
    if (!Number.isSafeInteger(closeTimeoutMs) || closeTimeoutMs < 1 || closeTimeoutMs > 10000) throw new TypeError('Bounded native close deadline required');
    this.#createWindow = createWindow;
    this.#authorize = authorize;
    this.#closeTimeoutMs = closeTimeoutMs;
  }

  #policy(request) {
    try { return authorized(this.#authorize(request), request); }
    catch { throw refuse('ACCESS_REFUSED', 'Native view access refused'); }
  }

  // Main binds the one genuine workspace owner before loading a locked page.
  // This creates no grant. IPC cannot select or substitute the native owner.
  bindWorkspace(window) {
    const wc = window?.webContents;
    if (this.#workspace || !window || !wc || !Number.isSafeInteger(window.id) || window.id < 1
      || !Number.isSafeInteger(wc.id) || wc.id < 1 || window.isDestroyed() || wc.isDestroyed()
      || [...this.#views.values()].some(entry => entry.record.role === 'workspace' || entry.window === window || entry.webContents === wc || entry.nativeId === window.id || entry.webContentsId === wc.id)) {
      throw refuse('ACCESS_REFUSED', 'Workspace owner binding refused');
    }
    this.#workspace = Object.freeze({ window, webContents: wc, nativeId: window.id, webContentsId: wc.id });
  }

  // Explicit native activation after a successful PIN unlock/reload. Unlike
  // satellite factories, only the permanently pinned owner can be reactivated.
  activateWorkspace() {
    const bound = this.#workspace; const request = normalizeRequest({ role: 'workspace', entityId: null });
    if (!bound || this.#destructionFailed) throw refuse('ACCESS_REFUSED', 'Workspace activation refused');
    const scope = this.#policy(request); const { window, webContents: wc } = bound;
    if (window.isDestroyed() || wc.isDestroyed() || window.id !== bound.nativeId || window.webContents !== wc
      || wc.id !== bound.webContentsId || wc.getURL() !== 'siren://app/app.html' || wc.mainFrame?.url !== 'siren://app/app.html') {
      throw refuse('ACCESS_REFUSED', 'Workspace native identity unavailable');
    }
    const existing = [...this.#views.values()].find(entry => entry.window === window);
    if (existing) {
      if (!this.caller({ sender: wc, senderFrame: wc.mainFrame })) throw refuse('ACCESS_REFUSED', 'Workspace must retire its previous epoch');
      return existing.record;
    }
    const record = Object.freeze({ windowId: randomUUID(), role: 'workspace', projectId: scope.projectId,
      epoch: this.#epoch, entityId: null, state: 'active' });
    this.#register({ window, request, scope, record, mainFrameUrl: 'siren://app/app.html' });
    return record;
  }

  async openView(value) {
    const request = normalizeRequest(value);
    if (request.role === 'workspace' && this.#workspace) throw refuse('REQUEST_REFUSED', 'The native workspace owner is already bound');
    if (this.#destructionFailed) throw refuse('ACCESS_REFUSED', 'Native window destruction still incomplete');
    const scope = this.#policy(request);
    const windowId = randomUUID();
    const mainFrameUrl = request.role === 'workspace' ? 'siren://app/app.html'
      : `siren://app/windows/${request.role}.html?windowId=${windowId}`;
    const record = Object.freeze({ windowId, role: request.role, projectId: scope.projectId,
      epoch: this.#epoch, entityId: request.entityId, state: 'active' });
    const window = await this.#createWindow(Object.freeze({ ...record,
      ...(Object.hasOwn(request, 'version') ? { version: request.version } : {}), mainFrameUrl, modal: false }));
    const webContents = window?.webContents;
    const reused = window === this.#workspace?.window || webContents === this.#workspace?.webContents
      || [...this.#views.values()].some(entry => entry.window === window || entry.webContents === webContents);
    if (reused || webContents && this.#retiredContents.has(webContents)) {
      throw refuse('ACCESS_REFUSED', 'Native renderer already used');
    }
    try {
      const current = this.#policy(request);
      if (request.role === 'workspace' && this.#workspace || this.#destructionFailed || record.epoch !== this.#epoch || current.projectId !== scope.projectId || current.mode !== scope.mode
        || current.access !== scope.access || !scope.entityIds.every(id => current.entityIds.includes(id))
        || !window || !Number.isSafeInteger(window.id) || window.id < 1
        || !webContents || !Number.isSafeInteger(webContents.id) || webContents.id < 1
        || !['isDestroyed', 'isMinimized', 'restore', 'focus', 'close', 'destroy', 'on', 'off'].every(key => typeof window[key] === 'function')
        || !['isDestroyed', 'getURL', 'on', 'off'].every(key => typeof webContents[key] === 'function')
        || window.isDestroyed() || webContents.isDestroyed()
        || window.id === this.#workspace?.nativeId || webContents.id === this.#workspace?.webContentsId
        || [...this.#views.values()].some(entry => entry.nativeId === window.id || entry.webContentsId === webContents.id)) {
        throw refuse('ACCESS_REFUSED', 'Native view no longer authorized');
      }
    } catch (error) {
      if (webContents && typeof webContents === 'object') this.#retiredContents.add(webContents);
      if (!this.#destroyWindow(window)) throw refuse('WINDOW_DESTROY_FAILED', 'Native rejected window destruction incomplete');
      throw error;
    }
    this.#register({ record, window, request, scope, mainFrameUrl });
    return record;
  }

  #register({ record, window, request, scope, mainFrameUrl }) {
    const webContents = window.webContents;
    const entry = { record, window, request, scope, mainFrameUrl,
      nativeId: window.id, webContents, mainFrame: webContents.mainFrame, webContentsId: webContents.id, revoked: false, listeners: [] };
    this.#views.set(record.windowId, entry);
    const listen = (target, name, callback) => {
      target.on(name, callback);
      entry.listeners.push([target, name, callback]);
    };
    const forget = () => this.#forget(entry);
    const revoke = () => {
      entry.closeInvalidated = true;
      if (this.#workspace?.window === window) {
        try { this.invalidateEpoch({ preserveWorkspace: true }); } catch { /* Failed handles remain fenced and retained. */ }
        return;
      }
      entry.revoked = true;
      this.#retiredContents.add(webContents);
      if (this.#destroyWindow(window)) this.#forget(entry);
    };
    listen(window, 'closed', forget);
    listen(webContents, 'destroyed', forget);
    listen(webContents, 'render-process-gone', revoke);
    listen(webContents, 'will-navigate', revoke);
    listen(webContents, 'did-start-navigation', (details, _url, _inPlace, isMainFrame) => { if ((details?.isMainFrame ?? isMainFrame) === true) revoke(); });
  }

  #destroyWindow(window) {
    if (typeof window?.destroy !== 'function' || typeof window?.isDestroyed !== 'function') return true;
    try {
      if (!window.isDestroyed()) window.destroy();
      if (window.isDestroyed()) {
        this.#unclosedWindows.delete(window);
        return true;
      }
    } catch { /* Retain the native handle for the next epoch destruction attempt. */ }
    this.#unclosedWindows.add(window);
    this.#destructionFailed = true;
    return false;
  }

  #forget(entry) {
    entry.revoked = true;
    this.#retiredContents.add(entry.webContents);
    if (this.#views.get(entry.record.windowId) === entry) this.#views.delete(entry.record.windowId);
    for (const [target, name, callback] of entry.listeners) target.off(name, callback);
    entry.listeners = [];
  }

  #live(entry) {
    const { window, webContents } = entry;
    return !entry.revoked && entry.record.epoch === this.#epoch && !window.isDestroyed() && !webContents.isDestroyed()
      && window.id === entry.nativeId && window.webContents === webContents && webContents.id === entry.webContentsId;
  }

  listViews() {
    return [...this.#views.values()].filter(entry => this.#live(entry)).map(({ record, window }) => ({
      ...record, state: window.isMinimized() ? 'minimized' : 'active',
    }));
  }

  focusView(windowId) {
    const entry = this.#views.get(windowId);
    if (!entry || !this.caller({ sender: entry.webContents, senderFrame: entry.webContents.mainFrame })) return false;
    if (entry.window.isMinimized()) entry.window.restore();
    entry.window.focus();
    return true;
  }

  closeView(windowId, { caller } = {}) {
    const entry = this.#views.get(windowId);
    if (!entry || !this.#live(entry)) return false;
    const captured = caller && this.caller(caller);
    if (caller && !captured) return false;
    const sender = caller?.sender; const frame = caller?.senderFrame;
    // The intentional self-close loses its grant. Prove that exact native close
    // under the unchanged epoch/policy instead of accepting any revoked sender.
    const authorizedClose = () => {
      if (entry.closeInvalidated || !entry.window.isDestroyed() || entry.record.epoch !== this.#epoch) return false;
      if (!captured || captured.windowId !== windowId) return true;
      if (caller.sender !== sender || caller.senderFrame !== frame || sender !== entry.webContents || frame !== entry.mainFrame) return false;
      try {
        const policy = this.#policy(entry.request);
        return policy.projectId === entry.scope.projectId && policy.mode === entry.scope.mode
          && policy.access === entry.scope.access && captured.entityIds.every(id => policy.entityIds.includes(id));
      } catch { return false; }
    };
    const confirm = closed => {
      if (!closed || !authorizedClose()) return false;
      if (captured?.windowId === windowId) this.#closedCallers.set(caller, { grant: captured, authorizedClose });
      return true;
    };
    if (entry.pendingClose) return entry.pendingClose.then(confirm);
    let resolve; let reject; let timer; let settled = false; let closeEvent;
    const pending = new Promise((done, fail) => { resolve = done; reject = fail; });
    const finish = (closed, timedOut = false) => {
      if (settled) return; settled = true;
      clearTimeout(timer);
      entry.window.off('closed', onClosed); entry.window.off('close', onClose);
      entry.webContents.off('will-prevent-unload', onPreventUnload);
      entry.pendingClose = null;
      if (timedOut) reject(refuse('WINDOW_CLOSE_TIMEOUT', 'Native window close confirmation timed out'));
      else resolve(closed);
    };
    const onClosed = () => finish(entry.window.isDestroyed());
    const onClose = event => {
      closeEvent = event;
      queueMicrotask(() => { if (event.defaultPrevented === true && !entry.window.isDestroyed()) finish(false); });
    };
    const onPreventUnload = event => {
      // Electron's preventDefault here permits unloading; an unoverridden
      // renderer veto leaves the window and its grant intact.
      queueMicrotask(() => { if (event.defaultPrevented !== true && !entry.window.isDestroyed()) finish(false); });
    };
    entry.window.on('closed', onClosed); entry.window.on('close', onClose);
    entry.webContents.on('will-prevent-unload', onPreventUnload);
    entry.pendingClose = pending;
    timer = setTimeout(() => finish(false, true), this.#closeTimeoutMs);
    try { entry.window.close(); }
    catch (error) { finish(false); throw error; }
    if (entry.window.isDestroyed()) { finish(true); return confirm(true); }
    if (closeEvent?.defaultPrevented === true) { finish(false); return false; }
    return pending.then(confirm);
  }

  // One-use native proof at the IPC return boundary. No renderer can create it,
  // and a closed renderer cannot inherit a grant or bypass a later Lock/switch.
  confirmClosedCaller(event, expected) {
    const proof = this.#closedCallers.get(event);
    this.#closedCallers.delete(event);
    return Boolean(proof && expected && ['windowId', 'role', 'projectId', 'epoch', 'webContentsId', 'mainFrameUrl']
      .every(key => proof.grant[key] === expected[key]) && proof.authorizedClose());
  }

  discardView(windowId) {
    const entry = this.#views.get(windowId);
    if (!entry || entry.window === this.#workspace?.window) return false;
    entry.revoked = true; entry.closeInvalidated = true; this.#retiredContents.add(entry.webContents);
    if (!this.#destroyWindow(entry.window)) return false;
    this.#forget(entry); return true;
  }

  invalidateEpoch({ preserveWorkspace = false } = {}) {
    this.#epoch += 1;
    const entries = [...this.#views.values()];
    for (const entry of entries) {
      entry.revoked = true;
      this.#retiredContents.add(entry.webContents);
    }
    let failed = false;
    const windows = new Set([...entries.map(entry => entry.window), ...this.#unclosedWindows]);
    for (const window of windows) {
      if (preserveWorkspace && window === this.#workspace?.window && !this.#unclosedWindows.has(window)) continue;
      if (!this.#destroyWindow(window)) failed = true;
    }
    for (const entry of entries) if (entry.window.isDestroyed() || preserveWorkspace && entry.window === this.#workspace?.window) this.#forget(entry);
    this.#destructionFailed = failed;
    if (failed) throw refuse('WINDOW_DESTROY_FAILED', 'Native data window destruction incomplete');
    return this.#epoch;
  }

  // Native-only queued-operation proof. Identifiers projected to renderers are
  // insufficient: only this registry can associate a grant with real handles.
  capture(event) {
    const pinned=Object.freeze({sender:event?.sender,senderFrame:event?.senderFrame});
    const grant=this.caller(pinned);
    if(grant)this.#captures.set(grant,pinned);
    return grant;
  }

  isCurrent(grant) {
    const event=grant && this.#captures.get(grant);
    if(!event)return false;
    const current=this.caller(event);
    return Boolean(current && ['windowId','role','projectId','epoch','webContentsId','mainFrameUrl'].every(key=>current[key]===grant[key]) && grant.entityIds.every(id=>current.entityIds.includes(id)));
  }

  // Trusted native adapters only; no preload or IPC exposes captured handles.
  eventFor(grant) {return this.isCurrent(grant)?this.#captures.get(grant):null;}

  caller(event) {
    try {
      for (const entry of this.#views.values()) {
        const { webContents, record, mainFrameUrl, request, scope } = entry;
        if (event?.sender !== webContents) continue;
        if (!this.#live(entry)
          || !event.senderFrame || event.senderFrame !== entry.mainFrame || event.senderFrame !== webContents.mainFrame
          || event.senderFrame.url !== mainFrameUrl || webContents.getURL() !== mainFrameUrl) return null;
        const current = this.#policy(request);
        if (current.projectId !== scope.projectId || current.mode !== scope.mode || current.access !== scope.access) return null;
        const entityIds = request.role === 'audience' ? []
          : request.entityId === null ? scope.entityIds : [request.entityId];
        if (!entityIds.every(id => current.entityIds.includes(id))) return null;
        return Object.freeze({ webContentsId: entry.webContentsId, mainFrameUrl, windowId: record.windowId,
          role: record.role, projectId: record.projectId, epoch: record.epoch, entityIds: Object.freeze([...entityIds]) });
      }
    } catch { /* Unavailable native identity or policy fails closed. */ }
    return null;
  }
}
