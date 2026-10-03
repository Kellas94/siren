import { loadSource } from './source-loader.js';

const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const version = value => Number.isSafeInteger(value) && value >= 1;
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const units = value => Number.isSafeInteger(value) && value >= 0;
const RANGE_UNITS = 131072;
const SOURCE_BYTES = 32 * 1024 * 1024;
const INSERT_BYTES = 8 * 1024 * 1024;
const QUEUE_BYTES = 16 * 1024 * 1024;
const QUEUE_COUNT = 64;
const OPERATION_LIMIT = 4096;
const failure = code => Object.freeze({ ok: false, code });
const invalid = code => { throw Object.assign(new TypeError(code), { code }); };

// Inspect own data descriptors only; neither getters nor inherited fields are authority.
function fields(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    result[key] = descriptor.value;
  }
  return required.every(key => Object.hasOwn(result, key)) ? result : null;
}
function reference(value) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const result = {};
  for (const key of ['sourceId', 'version', 'sha256']) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    result[key] = descriptor.value;
  }
  return id(result.sourceId) && version(result.version) && hash(result.sha256) ? Object.freeze(result) : null;
}
function refused(receipt) {
  const data = fields(receipt, ['ok', 'code', 'message'], ['ok', 'code']);
  return data?.ok === false && typeof data.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(data.code)
    && (!Object.hasOwn(data, 'message') || typeof data.message === 'string') ? failure(data.code) : null;
}
function insertionBytes(text) {
  if (text.length > INSERT_BYTES) return INSERT_BYTES + 1;
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length
      && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
    if (bytes > INSERT_BYTES) break;
  }
  return bytes;
}

/** One source identity, no text cache. The registered native bridge owns access and bytes. */
export function sourceClient({ bridge, sourceRef } = {}) {
  let current = reference(sourceRef);
  if (!current) invalid('INVALID_REFERENCE');
  const functions = {};
  for (const method of ['getMetrics', 'readRange', 'applyEdit', 'commitSource']) {
    const descriptor = bridge && Object.getOwnPropertyDescriptor(bridge, method);
    if (typeof descriptor?.value !== 'function') invalid('INVALID_BRIDGE');
    functions[method] = descriptor.value.bind(bridge);
  }
  const readBridge = Object.fromEntries(['openRead', 'readChunk', 'closeRead'].map(method => {
    const descriptor = bridge && Object.getOwnPropertyDescriptor(bridge, method);
    return [method, typeof descriptor?.value === 'function' ? descriptor.value.bind(bridge) : null];
  }));
  let disposed = false, fenced = false, durability = null, generation = 0, readGeneration = 0, pending = 0, pendingBytes = 0;
  let tail = Promise.resolve();
  const operations = new Set(), subscribers = new Set();
  const loads = new Set();
  const abortLoads = () => { for (const controller of loads) controller.abort(); };
  const getState = () => Object.freeze({ ...current, durability, fenced, disposed });
  const live = token => disposed ? failure('CLIENT_DISPOSED') : token !== generation ? failure('STALE_RESULT') : null;
  function publish(type, code) {
    const token = generation;
    const event = Object.freeze({ type, sourceId: current.sourceId, version: current.version, sha256: current.sha256, durability, fenced, ...(code ? { code } : {}) });
    for (const callback of [...subscribers]) {
      if (disposed || token !== generation) break;
      if (!subscribers.has(callback)) continue;
      try { callback(event); } catch { /* Observers cannot alter durable acceptance. */ }
    }
  }
  function fence(result) {
    fenced = true; readGeneration++; abortLoads(); publish('refused', result.code); return result;
  }
  async function loadDocument({ signal, onProgress } = {}) {
    if (disposed) return failure('CLIENT_DISPOSED');
    if (fenced) return failure('CLIENT_FENCED');
    if (pending || loads.size) return failure('SOURCE_BUSY');
    if (Object.values(readBridge).some(method => typeof method !== 'function')) return failure('SOURCE_READER_UNAVAILABLE');
    const controller = new AbortController(), token = generation, revision = readGeneration, bound = current;
    const cancel = () => controller.abort();
    if (signal?.aborted) cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    loads.add(controller);
    try {
      const result = await loadSource({ bridge: readBridge, sourceRef: bound, signal: controller.signal, onProgress });
      const stale = live(token) || (revision !== readGeneration ? failure('STALE_RESULT') : null);
      return stale || (controller.signal.aborted ? failure('SOURCE_LOAD_CANCELLED') : result);
    } finally { loads.delete(controller); signal?.removeEventListener('abort', cancel); }
  }
  async function read(method, input) {
    if (disposed) return failure('CLIENT_DISPOSED');
    if (fenced) return failure('CLIENT_FENCED');
    if (pending) return failure('SOURCE_BUSY');
    let range;
    if (method === 'readRange') {
      range = fields(input, ['start', 'end']);
      if (!range || !units(range.start) || !units(range.end) || range.end < range.start || range.end - range.start > RANGE_UNITS) return failure('INVALID_RANGE');
    }
    const bound = current, token = generation, revision = readGeneration;
    let receipt;
    try { receipt = await functions[method]({ sourceId: bound.sourceId, version: bound.version, ...(range || {}) }); }
    catch { return live(token) || (revision !== readGeneration ? failure('STALE_RESULT') : failure('SOURCE_TRANSPORT_FAILED')); }
    const late = live(token) || (revision !== readGeneration ? failure('STALE_RESULT') : null);
    if (late) return late;
    const refusal = refused(receipt); if (refusal) return refusal;
    if (method === 'readRange') {
      const data = fields(receipt, ['ok', 'sourceId', 'version', 'start', 'end', 'text']);
      if (!data || data.ok !== true || data.sourceId !== bound.sourceId || data.version !== bound.version
        || data.start !== range.start || data.end !== range.end || typeof data.text !== 'string'
        || data.text.length !== range.end - range.start || data.text.length > RANGE_UNITS || !data.text.isWellFormed()) return failure('INVALID_RECEIPT');
      return Object.freeze({ ...data });
    }
    const data = fields(receipt, ['ok', 'sourceId', 'version', 'sha256', 'utf8Bytes', 'utf16Units', 'lines', 'longestLineUnits', 'encoding', 'bom', 'newline']);
    if (!data || data.ok !== true || data.sourceId !== bound.sourceId || data.version !== bound.version || data.sha256 !== bound.sha256
      || !units(data.utf8Bytes) || data.utf8Bytes > SOURCE_BYTES || !['utf8', 'unsupported'].includes(data.encoding)
      || typeof data.bom !== 'boolean' || !['none', 'lf', 'crlf', 'cr', 'mixed'].includes(data.newline)) return failure('INVALID_RECEIPT');
    if (data.encoding === 'unsupported' ? data.utf16Units !== null || data.lines !== null || data.longestLineUnits !== null
      : !units(data.utf16Units) || data.utf16Units > SOURCE_BYTES || !version(data.lines) || data.lines > data.utf16Units + 1
        || !units(data.longestLineUnits) || data.longestLineUnits > data.utf16Units) return failure('INVALID_RECEIPT');
    return Object.freeze({ ...data });
  }
  function mutate(method, input) {
    if (disposed) return Promise.resolve(failure('CLIENT_DISPOSED'));
    if (fenced) return Promise.resolve(failure('CLIENT_FENCED'));
    const allowed = method === 'applyEdit' ? ['operationId', 'expectedVersion', 'start', 'end', 'insertedText', 'sourceId'] : ['operationId', 'expectedVersion', 'sourceId'];
    const data = fields(input, allowed, allowed.filter(key => key !== 'sourceId'));
    const retainedBytes = method === 'applyEdit' && typeof data?.insertedText === 'string' ? insertionBytes(data.insertedText) : 0;
    if (retainedBytes > INSERT_BYTES) return Promise.resolve(fence(failure('INVALID_EDIT')));
    if (pending >= QUEUE_COUNT || pendingBytes + retainedBytes > QUEUE_BYTES) return Promise.resolve(fence(failure('CLIENT_BUSY')));
    const token = generation;
    pending++; pendingBytes += retainedBytes;
    const result = tail.then(async () => {
      const late = live(token); if (late) return late;
      if (fenced) return failure('CLIENT_FENCED');
      if (!data || !id(data.operationId) || !version(data.expectedVersion)
        || (Object.hasOwn(data, 'sourceId') && data.sourceId !== current.sourceId)) return fence(failure('INVALID_EDIT'));
      if (operations.has(data.operationId)) return fence(failure('OPERATION_CONFLICT'));
      if (data.expectedVersion !== current.version) return fence(failure('REVISION_CONFLICT'));
      if (method === 'applyEdit' && (!units(data.start) || !units(data.end) || data.end < data.start
        || typeof data.insertedText !== 'string' || !data.insertedText.isWellFormed()
        || current.version === Number.MAX_SAFE_INTEGER)) return fence(failure('INVALID_EDIT'));
      if (operations.size >= OPERATION_LIMIT) operations.delete(operations.values().next().value);
      operations.add(data.operationId); readGeneration++; abortLoads();
      const bound = current;
      const request = Object.freeze({ ...data, sourceId: bound.sourceId });
      let receipt;
      try { receipt = await functions[method](request); }
      catch { return live(token) || fence(failure('SOURCE_TRANSPORT_FAILED')); }
      const stale = live(token); if (stale) return stale;
      const refusal = refused(receipt); if (refusal) return fence(refusal);
      const accepted = fields(receipt, ['ok', 'sourceId', 'operationId', 'version', 'sha256', 'durability']);
      const validDurability = method === 'applyEdit' ? ['draft'] : ['committed', 'recovery-degraded'];
      if (!accepted || accepted.ok !== true || accepted.sourceId !== bound.sourceId || accepted.operationId !== request.operationId
        || accepted.version !== bound.version + (method === 'applyEdit' ? 1 : 0) || !hash(accepted.sha256)
        || !validDurability.includes(accepted.durability) || (method === 'commitSource' && accepted.sha256 !== bound.sha256)) return fence(failure('INVALID_RECEIPT'));
      current = Object.freeze({ sourceId: bound.sourceId, version: accepted.version, sha256: accepted.sha256 });
      durability = accepted.durability; publish(durability);
      return Object.freeze({ ...accepted });
    });
    tail = result.then(() => { pending--; pendingBytes -= retainedBytes; }, () => { pending--; pendingBytes -= retainedBytes; });
    return result;
  }
  return Object.freeze({
    getState,
    loadDocument,
    getMetrics: () => read('getMetrics'),
    readRange: range => read('readRange', range),
    applyEdit: edit => mutate('applyEdit', edit),
    commitSource: request => mutate('commitSource', request),
    subscribeSource: callback => {
      if (typeof callback !== 'function') invalid('INVALID_SUBSCRIBER');
      if (!disposed) subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    reset: sourceRef => {
      if (disposed) return failure('CLIENT_DISPOSED');
      const next = reference(sourceRef);
      if (!next || next.sourceId !== current.sourceId) return failure('INVALID_REFERENCE');
      generation++; readGeneration++; abortLoads(); current = next; fenced = false; durability = null; publish('reset');
      return Object.freeze({ ok: true, ...current });
    },
    dispose: () => { if (!disposed) { disposed = true; generation++; readGeneration++; abortLoads(); subscribers.clear(); } },
  });
}
