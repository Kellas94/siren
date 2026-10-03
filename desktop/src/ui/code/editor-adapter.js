import { EditorState, Text } from '@codemirror/state';

const SOURCE_BYTES = 32 * 1024 * 1024, INSERT_BYTES = 8 * 1024 * 1024;
const QUEUE_BYTES = 16 * 1024 * 1024, QUEUE_COUNT = 64;
const failure = code => Object.freeze({ ok: false, code });
const identity = value => value && typeof value.sourceId === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value.sourceId)
  && Number.isSafeInteger(value.version) && value.version >= 1 && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
  ? Object.freeze({ sourceId: value.sourceId, version: value.version, sha256: value.sha256 }) : null;
const same = (a, b) => a && b && a.sourceId === b.sourceId && a.version === b.version && a.sha256 === b.sha256;
function byteLength(text) {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) bytes++;
    else if (c < 2048) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}
function splitPair(doc, position) {
  if (position <= 0 || position >= doc.length) return false;
  const pair = doc.sliceString(position - 1, position + 1, '\n');
  return pair.charCodeAt(0) >= 0xd800 && pair.charCodeAt(0) <= 0xdbff && pair.charCodeAt(1) >= 0xdc00 && pair.charCodeAt(1) <= 0xdfff;
}
function removedBytes(doc, from, to) {
  let bytes = 0;
  for (const iterator = doc.iterRange(from, to); !iterator.next().done;) bytes += byteLength(iterator.value);
  return bytes;
}

/** Isolated CM state/persistence boundary. No DOM, native channel or Docs save.
 * Local text is optimistic; only native receipts establish durable source state.
 * A failed partial multi-range write retains the complete local document and
 * fences further editing instead of rolling back accepted native versions.
 */
export function createEditorAdapter({ client, readonly = false, extensions = [] } = {}) {
  const methods = {};
  for (const name of ['getState', 'loadDocument', 'applyEdit', 'commitSource']) {
    const descriptor = client && Object.getOwnPropertyDescriptor(client, name);
    if (typeof descriptor?.value !== 'function') throw new TypeError('INVALID_CLIENT');
    methods[name] = descriptor.value.bind(client);
  }
  if (typeof readonly !== 'boolean' || !Array.isArray(extensions)) throw new TypeError('INVALID_EDITOR_OPTIONS');
  const configured = [...extensions];
  let state = null, bound = null, bytes = 0, disposed = false, opening = false, fenced = false, dirty = false;
  let error = null, generation = 0, pending = 0, queuedBytes = 0, saving = null, lastReceipt = null;
  let tail = Promise.resolve(), loadingController = null;
  const observers = new Set();
  const lifecycle = () => {
    const current = methods.getState();
    return { ref: identity(current), disposed: current?.disposed, fenced: current?.fenced };
  };
  const status = () => Object.freeze({ ready: !!state, disposed, opening, readonly, fenced, dirty,
    pending, saving: !!saving, code: error, sourceRef: bound, durability: lastReceipt?.durability ?? null });
  function publish() {
    const value = status(), token = generation, clientAtPublish = lifecycle();
    for (const callback of [...observers]) {
      const current = lifecycle();
      if (disposed || token !== generation || !same(clientAtPublish.ref, current.ref)
        || clientAtPublish.disposed !== current.disposed || clientAtPublish.fenced !== current.fenced) break;
      if (observers.has(callback)) try { Promise.resolve(callback(value)).catch(() => {}); } catch { /* Observer does not acknowledge writes. */ }
    }
  }
  function refuse(code) { fenced = true; error ||= code; publish(); return failure(error); }
  function live(token, expected = bound) {
    if (disposed) return failure('EDITOR_DISPOSED');
    if (generation !== token) return failure('EDITOR_IDENTITY_CHANGED');
    const current = methods.getState();
    return current?.disposed || current?.fenced || !same(expected, identity(current)) ? failure('EDITOR_IDENTITY_CHANGED') : null;
  }
  async function open(sourceRef) {
    if (disposed) return failure('EDITOR_DISPOSED');
    if (state) return failure(dirty ? 'EDITOR_DIRTY' : 'EDITOR_ALREADY_OPEN');
    if (opening) return failure('EDITOR_LOADING');
    const requested = identity(sourceRef);
    if (!requested || !same(requested, identity(methods.getState()))) return failure('EDITOR_IDENTITY_CHANGED');
    const token = generation; let result;
    opening = true; error = null; loadingController = new AbortController(); publish();
    try {
      const loaded = await methods.loadDocument({ signal: loadingController.signal });
      const stale = live(token, requested);
      if (stale) result = stale;
      else if (loaded?.ok !== true) result = failure(loaded?.code || 'EDITOR_LOAD_FAILED');
      else if (!same(requested, identity(loaded)) || !(loaded.doc instanceof Text) || loaded.doc.length !== loaded.metrics?.utf16Units
        || !Number.isSafeInteger(loaded.metrics?.utf8Bytes) || loaded.metrics.utf8Bytes < 0 || loaded.metrics.utf8Bytes > SOURCE_BYTES) result = failure('INVALID_RECEIPT');
      else {
        state = EditorState.create({ doc: loaded.doc, extensions: [...configured, EditorState.lineSeparator.of('\n'), EditorState.readOnly.of(readonly)] });
        bound = requested; bytes = loaded.metrics.utf8Bytes; error = null;
        result = Object.freeze({ ok: true, ...bound });
      }
    } catch { result = disposed ? failure('EDITOR_DISPOSED') : failure('EDITOR_LOAD_FAILED'); }
    finally {
      if (result?.ok === false && !disposed) error = result.code;
      opening = false; loadingController = null; publish();
    }
    // Completed-status observers can revoke ownership synchronously. Make the
    // actual outward acknowledgement after their final publication, not before.
    const stale = live(token, requested);
    return stale ? (disposed ? stale : refuse(stale.code)) : result;
  }
  function applyTransaction(transaction) {
    if (disposed) return failure('EDITOR_DISPOSED');
    if (!state) return failure('EDITOR_NOT_READY');
    if (!transaction || transaction.startState !== state) return failure('EDITOR_STALE_TRANSACTION');
    if (!transaction.docChanged) { state = transaction.state; publish(); return Object.freeze({ ok: true }); }
    if (readonly) return failure('EDITOR_READONLY');
    if (fenced) return failure('EDITOR_FENCED');
    if (saving) return failure('EDITOR_SAVING');
    const token = generation, stale = live(token); if (stale) return refuse(stale.code);
    const edits = []; let delta = 0, insertionCost = 0, newBytes = bytes, invalid = null;
    transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
      if (invalid) return;
      if (splitPair(state.doc, from) || splitPair(state.doc, to)) { invalid = 'INVALID_UNICODE'; return; }
      if (inserted.length > INSERT_BYTES) { invalid = 'INVALID_EDIT'; return; }
      const text = inserted.toString('\n');
      if (!text.isWellFormed()) { invalid = 'INVALID_UNICODE'; return; }
      const retained = byteLength(text);
      if (retained > INSERT_BYTES) { invalid = 'INVALID_EDIT'; return; }
      insertionCost += retained; newBytes += retained - removedBytes(state.doc, from, to);
      // Each primitive is a separate durable native version. A later deletion
      // cannot justify publishing an earlier version above the source budget.
      if (newBytes > SOURCE_BYTES) { invalid = 'SOURCE_TOO_LARGE'; return; }
      edits.push({ start: from + delta, end: to + delta, insertedText: text, retained }); delta += inserted.length - (to - from);
    }, true);
    if (invalid) return failure(invalid);
    if (newBytes > SOURCE_BYTES || transaction.newDoc.length > SOURCE_BYTES) return failure('SOURCE_TOO_LARGE');
    if (pending + edits.length > QUEUE_COUNT || queuedBytes + insertionCost > QUEUE_BYTES) return failure('EDITOR_QUEUE_FULL');
    if (!Number.isSafeInteger(bound.version + pending + edits.length)) return failure('REVISION_CONFLICT');
    // Admit the whole transaction before sending any prefix to the native owner.
    state = transaction.state; bytes = newBytes; dirty = true; pending += edits.length; queuedBytes += insertionCost;
    for (const edit of edits) {
      const run = tail.then(async () => {
        if (fenced) return failure(error || 'EDITOR_FENCED');
        const stale = live(token); if (stale) return disposed ? stale : refuse(stale.code);
        const previous = bound, operationId = crypto.randomUUID();
        let receipt;
        try { receipt = await methods.applyEdit({ sourceId: previous.sourceId, expectedVersion: previous.version,
          operationId, start: edit.start, end: edit.end, insertedText: edit.insertedText }); }
        catch { return disposed ? failure('EDITOR_DISPOSED') : refuse('SOURCE_TRANSPORT_FAILED'); }
        if (disposed || token !== generation) return failure('EDITOR_DISPOSED');
        if (receipt?.ok !== true) return refuse(receipt?.code || 'INVALID_RECEIPT');
        const accepted = identity(receipt), changed = live(token, accepted);
        if (!accepted || accepted.sourceId !== previous.sourceId || accepted.version !== previous.version + 1
          || receipt.operationId !== operationId || receipt.durability !== 'draft') return refuse('INVALID_RECEIPT');
        if (changed) return refuse(changed.code);
        bound = accepted; lastReceipt = receipt; return receipt;
      }).catch(() => disposed ? failure('EDITOR_DISPOSED') : refuse('EDITOR_PERSIST_FAILED'));
      tail = run.then(() => { pending--; queuedBytes -= edit.retained; publish(); });
    }
    publish(); return Object.freeze({ ok: true });
  }
  function dispatch(...specs) {
    if (disposed) return failure('EDITOR_DISPOSED');
    if (!state) return failure('EDITOR_NOT_READY');
    try { return applyTransaction(state.update(...specs)); } catch { return failure('INVALID_TRANSACTION'); }
  }
  function flush() {
    if (disposed) return Promise.resolve(failure('EDITOR_DISPOSED'));
    if (!state) return Promise.resolve(failure('EDITOR_NOT_READY'));
    if (readonly) return Promise.resolve(failure('EDITOR_READONLY'));
    if (saving) return saving;
    if (fenced) return Promise.resolve(failure(error || 'EDITOR_FENCED'));
    const token = generation;
    // Reserve synchronously. No newly admitted transaction can enter this commit.
    saving = tail.then(async () => {
      if (fenced) return failure(error || 'EDITOR_FENCED');
      const stale = live(token); if (stale) return disposed ? stale : refuse(stale.code);
      const previous = bound, operationId = crypto.randomUUID(); let receipt;
      try { receipt = await methods.commitSource({ sourceId: previous.sourceId, expectedVersion: previous.version, operationId }); }
      catch { return disposed ? failure('EDITOR_DISPOSED') : refuse('SOURCE_TRANSPORT_FAILED'); }
      if (disposed || token !== generation) return failure('EDITOR_DISPOSED');
      if (receipt?.ok !== true) return refuse(receipt?.code || 'INVALID_RECEIPT');
      if (!same(previous, identity(receipt)) || receipt.operationId !== operationId
        || !['committed', 'recovery-degraded'].includes(receipt.durability)) return refuse('INVALID_RECEIPT');
      const changed = live(token, previous); if (changed) return refuse(changed.code);
      lastReceipt = receipt; dirty = false; return receipt;
    }).catch(() => disposed ? failure('EDITOR_DISPOSED') : refuse('EDITOR_PERSIST_FAILED'))
      .then(receipt => {
        saving = null; publish();
        const stale = live(token);
        return stale ? (disposed ? stale : refuse(stale.code)) : receipt;
      });
    tail = saving.then(() => {}); publish(); return saving;
  }
  return Object.freeze({ open, dispatch, applyTransaction, flush, getState: () => state, getStatus: status,
    subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('INVALID_SUBSCRIBER');
      if (!disposed) observers.add(callback); return () => observers.delete(callback);
    },
    dispose() {
      if (disposed) return; disposed = true; generation++; loadingController?.abort(); state = null; observers.clear();
    }
  });
}
