import { Text } from '@codemirror/state';

const MAX_BYTES = 32 * 1024 * 1024, MAX_UNITS = 131072;
const failure = code => Object.freeze({ ok: false, code });
const raise = code => { throw Object.assign(new Error(code), { code }); };
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const version = value => Number.isSafeInteger(value) && value >= 1;
const units = value => Number.isSafeInteger(value) && value >= 0;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function data(value, keys) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
  if (names.length !== keys.length || names.some(key => typeof key !== 'string' || !keys.includes(key) ||
      !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(names.map(key => [key, descriptors[key].value]));
}
const metadata = ['sourceId', 'version', 'sha256', 'utf8Bytes', 'utf16Units', 'lines', 'longestLineUnits', 'encoding', 'bom', 'newline'];
const checkSignal = signal => { if (signal?.aborted) raise('SOURCE_LOAD_CANCELLED'); };
const knownErrors = new Set(['INVALID_REFERENCE', 'INVALID_BRIDGE', 'INVALID_RECEIPT', 'SOURCE_LOAD_CANCELLED',
  'SOURCE_READ_TIMEOUT', 'SOURCE_HASH_MISMATCH', 'ACCESS_REFUSED', 'SOURCE_READER_BUDGET', 'SOURCE_READER_BUSY',
  'SOURCE_READER_CLOSED', 'CORRUPT_SOURCE', 'UNKNOWN_VERSION', 'UNSUPPORTED_ENCODING', 'SOURCE_RESULT_REFUSED', 'SOURCE_REQUEST_FAILED']);
function checkRefusal(value) {
  const refused = data(value, ['ok', 'code']);
  if (refused?.ok === false && typeof refused.code === 'string') raise(knownErrors.has(refused.code) ? refused.code : 'SOURCE_LOAD_FAILED');
}
function request(fn, payload, signal, onLate) {
  checkSignal(signal);
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (callback, value) => {
      if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); callback(value);
    };
    const abort = () => finish(reject, Object.assign(new Error('SOURCE_LOAD_CANCELLED'), { code: 'SOURCE_LOAD_CANCELLED' }));
    const timer = setTimeout(() => finish(reject, Object.assign(new Error('SOURCE_READ_TIMEOUT'), { code: 'SOURCE_READ_TIMEOUT' })), 15000);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { checkSignal(signal); return fn(payload); }).then(value => {
      if (done && onLate) { try { Promise.resolve(onLate(value)).catch(() => {}); } catch { /* Native lease also expires. */ } }
      else finish(resolve, value);
    }, e => finish(reject, e));
  });
}

/** Builds a single immutable CM document from an opaque native read session.
 * Nothing is exposed before complete UTF-8/hash verification and close ACK.
 * Explicit LF splitting retains literal CR, BOM and all source offsets rather
 * than CodeMirror's default newline normalization. Native grants remain owner.
 */
export async function loadSource({ bridge, sourceRef, onProgress, signal } = {}) {
  let readId = null, bound = null, result = null, methods;
  try {
    bound = Object.freeze(Object.fromEntries(['sourceId', 'version', 'sha256'].map(key => {
      const descriptor = sourceRef && Object.getOwnPropertyDescriptor(sourceRef, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) raise('INVALID_REFERENCE');
      return [key, descriptor.value];
    })));
    if (!id(bound.sourceId) || !version(bound.version) || !hash(bound.sha256)) raise('INVALID_REFERENCE');
    methods = Object.fromEntries(['openRead', 'readChunk', 'closeRead'].map(key => {
      const descriptor = bridge && Object.getOwnPropertyDescriptor(bridge, key);
      if (typeof descriptor?.value !== 'function') raise('INVALID_BRIDGE');
      return [key, descriptor.value.bind(bridge)];
    }));
    const opened = await request(methods.openRead, bound, signal, late => {
      const descriptor = late && Object.getOwnPropertyDescriptor(late, 'readId');
      if (id(descriptor?.value)) return request(methods.closeRead, { readId: descriptor.value, sourceId: bound.sourceId, version: bound.version });
    });
    // Retain an owned-data ID for cleanup even if the rest of this receipt is
    // malformed. Never evaluate a getter from a rejected result.
    const idDescriptor = opened && Object.getOwnPropertyDescriptor(opened, 'readId');
    if (id(idDescriptor?.value)) readId = idDescriptor.value;
    checkSignal(signal); checkRefusal(opened);
    const info = data(opened, ['ok', 'readId', ...metadata]);
    if (!info || info.ok !== true || !readId || info.sourceId !== bound.sourceId || info.version !== bound.version ||
        info.sha256 !== bound.sha256 || !units(info.utf8Bytes) || info.utf8Bytes > MAX_BYTES ||
        !units(info.utf16Units) || info.utf16Units > MAX_BYTES || !version(info.lines) || info.lines > info.utf16Units + 1 ||
        !units(info.longestLineUnits) || info.longestLineUnits > info.utf16Units || info.encoding !== 'utf8' ||
        typeof info.bom !== 'boolean' || !['none', 'lf', 'crlf', 'cr', 'mixed'].includes(info.newline)) raise('INVALID_RECEIPT');
    let doc = Text.of(['']), start = 0;
    while (start < info.utf16Units) {
      const raw = await request(methods.readChunk, { sourceId: bound.sourceId, version: bound.version, readId, start, maxUnits: MAX_UNITS }, signal);
      checkSignal(signal);
      checkRefusal(raw);
      const chunk = data(raw, ['ok', 'readId', 'sourceId', 'version', 'start', 'end', 'text']);
      if (!chunk || chunk.ok !== true || chunk.readId !== readId || chunk.sourceId !== bound.sourceId || chunk.version !== bound.version ||
          chunk.start !== start || !units(chunk.end) || chunk.end <= start || chunk.end > info.utf16Units || chunk.end - start > MAX_UNITS ||
          typeof chunk.text !== 'string' || chunk.text.length !== chunk.end - start || !chunk.text.isWellFormed()) raise('INVALID_RECEIPT');
      doc = doc.append(Text.of(chunk.text.split('\n'))); start = chunk.end;
      if (typeof onProgress === 'function') {
        try { Promise.resolve(onProgress(Object.freeze({ ...bound, loadedUnits: start, totalUnits: info.utf16Units }))).catch(() => {}); } catch { /* Observer cannot alter source. */ }
      }
      checkSignal(signal);
    }
    const text = doc.toString('\n'), bytes = new TextEncoder().encode(text);
    if (bytes.length !== info.utf8Bytes || bytes.length > MAX_BYTES) raise('SOURCE_HASH_MISMATCH');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes); checkSignal(signal);
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== bound.sha256) raise('SOURCE_HASH_MISMATCH');
    result = Object.freeze({ ok: true, ...bound, doc, metrics: Object.freeze(Object.fromEntries(metadata.map(key => [key, info[key]]))) });
  } catch (e) {
    result = failure(knownErrors.has(e?.code) ? e.code : 'SOURCE_LOAD_FAILED');
  } finally {
    if (readId && methods) {
      try {
        const expected = Object.freeze({ readId, sourceId: bound.sourceId, version: bound.version });
        const closed = data(await request(methods.closeRead, expected), ['ok', 'readId', 'sourceId', 'version']);
        if (!closed || closed.ok !== true || Object.keys(expected).some(key => closed[key] !== expected[key])) {
          if (result?.ok) result = failure('SOURCE_READER_CLOSE_FAILED');
        }
      } catch { if (result?.ok) result = failure('SOURCE_READER_CLOSE_FAILED'); }
    }
  }
  if (signal?.aborted) return failure('SOURCE_LOAD_CANCELLED');
  return result;
}
