// Pure, main-only orchestration. No native loader, spawn, IPC or product admission.
import { randomUUID } from 'node:crypto';
import { TERMINAL_LIMITS } from './contracts.mjs';

const refuse = (code = 'REQUEST_REFUSED') => Object.freeze({ ok: false, code });
const success = fields => Object.freeze({ ok: true, ...fields });
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const pid = value => Number.isInteger(value) && value > 0 && value <= 0xffffffff;
const absolute = value => typeof value === 'string' && value.length <= 32767 && /^(?:[a-z]:\\|\\\\)/i.test(value) && !/[\u0000-\u001f"]/.test(value);
const since = value => typeof value === 'bigint' && value > 0n && value <= 0xffffffffffffffffn;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function joinUntil(work, deadline) {
  // A caller timeout does not cancel or free the underlying Session operation.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('DEADLINE')), Math.max(0, deadline - performance.now()));
    work.then(value => {
      clearTimeout(timer);
      // A synchronous provider can block past a timer; late success is still refused.
      if (performance.now() >= deadline) reject(Error('DEADLINE'));
      else resolve(value);
    }, error => { clearTimeout(timer); reject(error); });
  });
}

// Never invoke payload accessors, including while constructing an error response.
function data(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('SHAPE');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw Error('SHAPE');
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string' || !required.includes(key) && !optional.includes(key))) throw Error('SHAPE');
  const out = Object.create(null);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) throw Error('SHAPE');
    out[key] = d.value;
  }
  if (required.some(key => !Object.hasOwn(out, key))) throw Error('SHAPE');
  return out;
}
function identity(value) {
  const p = data(value, ['pid', 'image', 'since']);
  if (!pid(p.pid) || !absolute(p.image) || !since(p.since)) throw Error('IDENTITY');
  return p;
}
function member(value) {
  const p = data(value, ['pid', 'image', 'createdFileTime', 'alive', 'exitCode']);
  if (!pid(p.pid) || !absolute(p.image) || typeof p.createdFileTime !== 'string' || !/^[1-9][0-9]{0,19}$/.test(p.createdFileTime) || !since(BigInt(p.createdFileTime)) || typeof p.alive !== 'boolean' || !Number.isInteger(p.exitCode) || p.exitCode < 0 || p.exitCode > 0xffffffff) throw Error('IDENTITY');
  return p;
}
const same = (a, b) => a.pid === b.pid && a.image === b.image && a.createdFileTime === b.createdFileTime;
const matches = (actual, expected) => actual.pid === expected.pid && actual.image === expected.image && BigInt(actual.createdFileTime) >= expected.since;
function observation(value, session) {
  const s = data(value, ['active', 'root', 'held', 'killOnClose', 'breakaway', 'inheritable', 'monitorFired', 'monitorTerminateSucceeded', 'stopping', ...(session ? ['shell', 'hostPid', 'atomicBeforeResume', 'shellMonitorFired', 'shellMonitorTerminated'] : [])]);
  if (!Number.isInteger(s.active) || s.active < 0 || s.active > 0xffffffff || s.killOnClose !== true || s.breakaway !== false || s.inheritable !== false) throw Error('CONTAINMENT');
  for (const key of ['monitorFired', 'monitorTerminateSucceeded', 'stopping', ...(session ? ['shellMonitorFired', 'shellMonitorTerminated'] : [])]) if (typeof s[key] !== 'boolean') throw Error('SHAPE');
  if (!Array.isArray(s.held) || s.held.length > (session ? 32 : 128)) throw Error('CAPACITY');
  s.root = member(s.root);
  // Own data descriptors prevent array getters from running during verification.
  const held = [];
  for (let n = 0; n < s.held.length; n++) {
    const d = Object.getOwnPropertyDescriptor(s.held, String(n));
    if (!d || !Object.hasOwn(d, 'value')) throw Error('SHAPE');
    held.push(member(d.value));
  }
  s.held = held;
  if (new Set(held.map(p => p.pid)).size !== held.length) throw Error('IDENTITY');
  if (session) {
    if (!pid(s.hostPid) || s.atomicBeforeResume !== true) throw Error('CONTAINMENT');
    s.shell = s.shell === false ? false : member(s.shell);
  }
  for (const p of [s.root, s.shell].filter(Boolean)) {
    const duplicate = held.find(q => q.pid === p.pid);
    if (duplicate && (!same(duplicate, p) || duplicate.alive !== p.alive || duplicate.exitCode !== p.exitCode)) throw Error('IDENTITY');
  }
  return s;
}

export class TerminalOwnership {
  #native = Object.create(null);
  #isAdmitted;
  #host;
  #sessions = new Map();
  #closed = new Map();

  constructor({ native, isAdmitted } = {}) {
    this.#isAdmitted = typeof isAdmitted === 'function' ? isAdmitted : () => false;
    for (const name of ['start', 'snapshot', 'createSession', 'snapshotSession', 'watchRoot', 'captureSession', 'stopSession', 'closeSession', 'stop', 'close']) {
      const d = native && Object.getOwnPropertyDescriptor(native, name);
      if (d && Object.hasOwn(d, 'value') && typeof d.value === 'function') this.#native[name] = d.value.bind(native);
    }
  }
  get nativeExecutionAdmitted() { return false; }
  #available() { try { return this.#isAdmitted() === true; } catch { return false; } }
  #call(name, ...args) {
    if (typeof this.#native[name] !== 'function') throw Error('NATIVE_UNAVAILABLE');
    // The qualified N-API contract is synchronous. Never await an unknown provider.
    return this.#native[name](...args);
  }
  #read(record) {
    const s = observation(this.#call(record.session ? 'snapshotSession' : 'snapshot', record.cap), record.session);
    if (!same(s.root, record.root)) throw Error('IDENTITY_DRIFT');
    if (record.session && s.hostPid !== record.hostPid) throw Error('HOST_DRIFT');
    if (record.shell && (!s.shell || !same(s.shell, record.shell))) throw Error('IDENTITY_DRIFT');
    if (record.held && (s.held.length !== record.held.length || record.held.some(p => !s.held.some(q => same(p, q))))) throw Error('IDENTITY_DRIFT');
    return s;
  }
  #rememberClosed(record) {
    record.state = 'exited';
    this.#closed.set(record.ownerId, true);
    while (this.#closed.size > 128) this.#closed.delete(this.#closed.keys().next().value);
    if (record.session) this.#sessions.delete(record.ownerId);
  }
  startHost(payload) {
    if (!this.#available()) return refuse('HOST_UNAVAILABLE');
    let expected;
    try { expected = identity(data(payload, ['hostProcessIdentity']).hostProcessIdentity); } catch { return refuse(); }
    if (!this.#available()) return refuse('HOST_UNAVAILABLE');
    if (this.#host) return refuse('HOST_UNAVAILABLE');
    const r = { ownerId: randomUUID(), state: 'starting', session: false, cap: null };
    this.#host = r; // Uncertain native outcomes retain their ownership reservation.
    try {
      r.cap = this.#call('start', expected.pid, expected.image, expected.since);
      const s = observation(this.#call('snapshot', r.cap), false);
      if (!matches(s.root, expected) || !s.root.alive || s.active < 1 || s.stopping) throw Error('HOST_IDENTITY');
      r.root = s.root;
      r.state = 'running';
      return success({ hostOwnerId: r.ownerId });
    } catch { r.state = 'cleanup-failed'; return refuse('CLEANUP_FAILED'); }
  }
  adoptSession() { return refuse('ATOMIC_CREATION_REQUIRED'); }
  createSession(payload) {
    if (!this.#available()) return refuse('HOST_UNAVAILABLE');
    let p, creator;
    try {
      p = data(payload, ['hostOwnerId', 'sessionId', 'creator']);
      creator = data(p.creator, ['executable', 'entry', 'directory']);
      if (typeof p.hostOwnerId !== 'string' || !id(p.sessionId) || !Object.values(creator).every(absolute)) throw Error('SHAPE');
    } catch { return refuse(); }
    const h = this.#host;
    if (!h || h.ownerId !== p.hostOwnerId || h.state !== 'running') return refuse('HOST_UNAVAILABLE');
    if (this.#sessions.size >= TERMINAL_LIMITS.sessions) return refuse('CAPACITY_EXCEEDED');
    if ([...this.#sessions.values()].some(r => r.sessionId === p.sessionId)) return refuse();
    const r = { ownerId: randomUUID(), sessionId: p.sessionId, hostPid: h.root.pid, state: 'starting', session: true, cap: null };
    this.#sessions.set(r.ownerId, r);
    try {
      const host = this.#read(h);
      if (!host.root.alive || host.stopping || creator.executable !== h.root.image || !this.#available()) throw Error('HOST_UNAVAILABLE');
      r.cap = this.#call('createSession', h.cap, creator.executable, creator.entry, creator.directory);
      const s = observation(this.#call('snapshotSession', r.cap), true);
      if (s.hostPid !== h.root.pid || s.root.image !== creator.executable || !s.root.alive || s.active < 1 || s.stopping) throw Error('SESSION_IDENTITY');
      r.root = s.root;
      r.state = 'awaiting-shell';
      return success({ sessionOwnerId: r.ownerId });
    } catch { r.state = 'cleanup-failed'; return refuse('CLEANUP_FAILED'); }
  }
  watchSessionRoot(payload) {
    if (!this.#available()) return refuse('HOST_UNAVAILABLE');
    let p, expected;
    try { p = data(payload, ['sessionOwnerId', 'shellProcessIdentity']); expected = identity(p.shellProcessIdentity); } catch { return refuse(); }
    const r = this.#sessions.get(p.sessionOwnerId);
    if (!r || r.state !== 'awaiting-shell') return refuse();
    try {
      const h = this.#read(this.#host);
      if (this.#host.state !== 'running' || !h.root.alive || h.stopping || !this.#available()) throw Error('HOST_UNAVAILABLE');
      this.#call('watchRoot', r.cap, expected.pid, expected.image, expected.since);
      const s = observation(this.#call('captureSession', r.cap), true);
      if (!same(s.root, r.root) || s.hostPid !== r.hostPid || !s.shell || !matches(s.shell, expected) || s.active < 2 || s.stopping || s.held.length < 2 || !s.held.every(p => p.alive) || !s.held.some(p => same(p, s.root)) || !s.held.some(p => same(p, s.shell))) throw Error('SHELL_IDENTITY');
      r.shell = s.shell;
      r.held = s.held;
      r.state = 'running';
      return success({});
    } catch { r.state = 'cleanup-failed'; return refuse('CLEANUP_FAILED'); }
  }
  #deadline(value) {
    if (!Number.isInteger(value) || value < 1 || value > TERMINAL_LIMITS.stopDeadlineMs) throw Error('DEADLINE');
    return performance.now() + value;
  }
  #wait(work, deadline) {
    return joinUntil(work, deadline).catch(() => refuse('CLEANUP_FAILED'));
  }
  async #finish(record, deadline) {
    try {
      if (!record.cap || !record.root) throw Error('UNKNOWN_IDENTITY');
      while (performance.now() < deadline) {
        const s = this.#read(record);
        if (s.active === 0 && [s.root, s.shell, ...s.held].filter(Boolean).every(p => !p.alive)) {
          if (this.#call(record.session ? 'closeSession' : 'close', record.cap) !== true) throw Error('CLOSE_REFUSED');
          this.#rememberClosed(record);
          return success({ verifiedExited: true });
        }
        await delay(Math.min(5, Math.max(1, deadline - performance.now())));
      }
    } catch { /* Unknown identity/close errors are never converted into verified exit. */ }
    record.state = 'cleanup-failed';
    return refuse('CLEANUP_FAILED');
  }
  #stop(record, deadline) {
    if (record.pending) return record.pending;
    record.state = 'stopping';
    record.pending = Promise.resolve().then(async () => {
      try {
        if (!record.cap || this.#call(record.session ? 'stopSession' : 'stop', record.cap, 77) !== true) throw Error('STOP_REFUSED');
        return await this.#finish(record, deadline);
      } catch { record.state = 'cleanup-failed'; return refuse('CLEANUP_FAILED'); }
    }).finally(() => { record.pending = null; });
    return record.pending;
  }
  stopSession(payload) {
    let p, deadline;
    try { p = data(payload, ['sessionOwnerId', 'deadlineMs']); deadline = this.#deadline(p.deadlineMs); } catch { return Promise.resolve(refuse()); }
    if (this.#closed.has(p.sessionOwnerId)) return Promise.resolve(success({ verifiedExited: true }));
    const r = this.#sessions.get(p.sessionOwnerId);
    return r ? this.#wait(this.#stop(r, deadline), deadline) : Promise.resolve(refuse());
  }
  stopAll(payload) {
    let p, deadline;
    try { p = data(payload, ['hostOwnerId', 'deadlineMs']); deadline = this.#deadline(p.deadlineMs); } catch { return Promise.resolve(refuse()); }
    const h = this.#host;
    if (!h || h.ownerId !== p.hostOwnerId) return Promise.resolve(refuse());
    if (h.state === 'exited') return Promise.resolve(success({ verifiedExited: true }));
    if (h.pending) return this.#wait(h.pending, deadline);
    h.state = 'stopping';
    h.pending = Promise.resolve().then(async () => {
      try {
        if (!h.cap || this.#call('stop', h.cap, 77) !== true) throw Error('STOP_REFUSED');
        const sessions = [...this.#sessions.values()];
        const results = await joinUntil(Promise.all(sessions.map(r => this.#stop(r, deadline))), deadline);
        if (results.some(r => !r.ok)) throw Error('SESSION_UNVERIFIED');
        return await this.#finish(h, deadline);
      } catch { h.state = 'cleanup-failed'; return refuse('CLEANUP_FAILED'); }
    }).finally(() => { h.pending = null; });
    return this.#wait(h.pending, deadline);
  }
  verifyExit(payload) {
    let p;
    try { p = data(payload, ['ownerId']); if (typeof p.ownerId !== 'string') throw Error('SHAPE'); } catch { return Object.freeze({ identityKnown: false, verifiedExited: false, remainingCount: null }); }
    if (this.#closed.has(p.ownerId)) return Object.freeze({ identityKnown: true, verifiedExited: true, remainingCount: 0 });
    const r = this.#sessions.get(p.ownerId) ?? (this.#host?.ownerId === p.ownerId ? this.#host : null);
    try {
      if (!r || !r.root) throw Error('UNKNOWN_IDENTITY');
      const s = this.#read(r);
      // Only successful native close publishes verified exit, even at accounting zero.
      return Object.freeze({ identityKnown: true, verifiedExited: false, remainingCount: s.active });
    } catch { return Object.freeze({ identityKnown: false, verifiedExited: false, remainingCount: null }); }
  }
  snapshot() {
    return Object.freeze({
      host: this.#host ? Object.freeze({ hostOwnerId: this.#host.ownerId, state: this.#host.state }) : null,
      sessions: Object.freeze([...this.#sessions.values()].map(r => Object.freeze({ sessionOwnerId: r.ownerId, sessionId: r.sessionId, state: r.state }))),
    });
  }
}
