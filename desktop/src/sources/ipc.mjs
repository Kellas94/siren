import { validId } from '../projects/paths.mjs';

export const SOURCE_IPC_LIMITS = Object.freeze({ rangeUnits: 131072, insertedBytes: 8 * 1024 * 1024 });
const methods = Object.freeze({
  getMetrics: { action: 'read', required: ['sourceId'], optional: ['version'] },
  readRange: { action: 'read', required: ['sourceId', 'version', 'start', 'end'], optional: [] },
  applyEdit: { action: 'edit', required: ['sourceId', 'operationId', 'expectedVersion', 'start', 'end', 'insertedText'], optional: [] },
  commitSource: { action: 'commit', required: ['sourceId', 'expectedVersion', 'operationId'], optional: [] },
});
const nativeCodes = new Set(['ACCESS_REFUSED', 'INVALID_ID', 'INVALID_VERSION', 'INVALID_RANGE', 'INVALID_UNICODE',
  'INVALID_EDIT', 'REVISION_CONFLICT', 'OPERATION_CONFLICT', 'UNSUPPORTED_ENCODING', 'SOURCE_BUDGET',
  'PROJECT_BUDGET', 'CORRUPT_SOURCE', 'SOURCE_READBACK_FAILED', 'SOURCE_WRITE_FAILED',
  'WRITER_BUSY', 'OWNED_PATH_REFUSED', 'UNKNOWN_VERSION', 'IMMUTABLE_CONFLICT']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
const version = value => Number.isSafeInteger(value) && value >= 1;
const fail = code => Object.freeze({ ok: false, code, message: code === 'REQUEST_REFUSED' ? 'Source request refused.'
  : code === 'ACCESS_REFUSED' ? 'Source access refused.' : code === 'SOURCE_RESULT_REFUSED' ? 'Source result refused.' : 'Source operation failed.' });

// Never evaluate renderer getters, inherit fields, or keep a renderer-owned object.
function normalize(method, value) {
  if (typeof method !== 'string' || !Object.hasOwn(methods, method) || !value || typeof value !== 'object'
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const schema = methods[method]; const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors); const allowed = [...schema.required, ...schema.optional];
  if (keys.some(key => typeof key !== 'string' || !allowed.includes(key)
    || !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)
    || schema.required.some(key => !Object.hasOwn(descriptors, key))) return null;
  const payload = Object.create(null);
  for (const key of keys) payload[key] = descriptors[key].value;
  if (!validId(payload.sourceId) || Object.hasOwn(payload, 'version') && !version(payload.version)
    || Object.hasOwn(payload, 'expectedVersion') && !version(payload.expectedVersion)
    || Object.hasOwn(payload, 'operationId') && !validId(payload.operationId)) return null;
  if (Object.hasOwn(payload, 'start') && (!nonnegative(payload.start) || !nonnegative(payload.end) || payload.end < payload.start)) return null;
  if (method === 'readRange' && payload.end - payload.start > SOURCE_IPC_LIMITS.rangeUnits) return null;
  if (method === 'applyEdit' && (payload.expectedVersion === Number.MAX_SAFE_INTEGER
    || typeof payload.insertedText !== 'string' || payload.insertedText.length > SOURCE_IPC_LIMITS.insertedBytes
    || !payload.insertedText.isWellFormed() || Buffer.byteLength(payload.insertedText, 'utf8') > SOURCE_IPC_LIMITS.insertedBytes)) return null;
  return Object.freeze(payload);
}

function capturedGrant(caller, sourceId) {
  if (!caller || !['workspace', 'code'].includes(caller.role) || !validId(caller.projectId)
    || !validId(caller.windowId) || !version(caller.epoch) || !version(caller.webContentsId)
    || typeof caller.mainFrameUrl !== 'string' || !Array.isArray(caller.entityIds)
    || !caller.entityIds.every(validId) || !caller.entityIds.includes(sourceId)) return null;
  return Object.freeze({ projectId: caller.projectId, windowId: caller.windowId, role: caller.role,
    epoch: caller.epoch, webContentsId: caller.webContentsId, mainFrameUrl: caller.mainFrameUrl,
    entityIds: Object.freeze([...caller.entityIds]) });
}

function sameGrant(current, grant, sourceId) {
  return current && ['projectId', 'windowId', 'role', 'epoch', 'webContentsId', 'mainFrameUrl'].every(key => current[key] === grant[key])
    && Array.isArray(current.entityIds) && current.entityIds.includes(sourceId);
}

function projectMetrics(value, payload) {
  if (!value || value.sourceId !== payload.sourceId || !version(value.version)
    || Object.hasOwn(payload, 'version') && value.version !== payload.version || !hash(value.sha256)
    || !nonnegative(value.utf8Bytes) || !['utf8', 'unsupported'].includes(value.encoding)
    || typeof value.bom !== 'boolean' || !['none', 'lf', 'cr', 'crlf', 'mixed'].includes(value.newline)) return fail('SOURCE_RESULT_REFUSED');
  if (value.encoding === 'utf8' ? !nonnegative(value.utf16Units) || !version(value.lines)
    || !nonnegative(value.longestLineUnits) || value.longestLineUnits > value.utf16Units
    : value.utf16Units !== null || value.lines !== null || value.longestLineUnits !== null) return fail('SOURCE_RESULT_REFUSED');
  return Object.freeze({ ok: true, sourceId: value.sourceId, version: value.version, sha256: value.sha256,
    utf8Bytes: value.utf8Bytes, utf16Units: value.utf16Units, lines: value.lines, longestLineUnits: value.longestLineUnits,
    encoding: value.encoding, bom: value.bom, newline: value.newline });
}

function projectReceipt(method, value, payload) {
  if (!value || value.ok !== true) return fail(nativeCodes.has(value?.code) ? value.code : 'SOURCE_REQUEST_FAILED');
  const expectedVersion = payload.expectedVersion + (method === 'applyEdit' ? 1 : 0);
  if (value.sourceId !== payload.sourceId || value.operationId !== payload.operationId || value.version !== expectedVersion
    || !version(value.version) || !hash(value.sha256)
    || !(method === 'applyEdit' ? ['draft'] : ['committed', 'recovery-degraded']).includes(value.durability)) return fail('SOURCE_RESULT_REFUSED');
  return Object.freeze({ ok: true, sourceId: payload.sourceId, operationId: payload.operationId,
    version: value.version, sha256: value.sha256, durability: value.durability });
}

/** Isolated main authority contract; no IPC channel or preload is installed here.
 * access is trusted and synchronous. Factory creates a fresh owned repository per
 * invocation and must use canWrite at its native publication boundaries.
 */
export async function invokeSource({ event, method, payload: input, registry, repositoryFactory, access }) {
  let grant; let live;
  try {
    const payload = normalize(method, input);
    if (!payload) return fail('REQUEST_REFUSED');
    if (typeof registry?.caller !== 'function' || typeof repositoryFactory !== 'function' || typeof access !== 'function') return fail('ACCESS_REFUSED');
    // Pin Electron's actual sender/frame references before any asynchronous work.
    const nativeEvent = Object.freeze({ sender: event?.sender, senderFrame: event?.senderFrame });
    grant = capturedGrant(registry.caller(nativeEvent), payload.sourceId);
    if (!grant) return fail('ACCESS_REFUSED');
    const action = methods[method].action;
    const scope = Object.freeze({ sourceId: payload.sourceId, action });
    live = () => {
      try { return sameGrant(registry.caller(nativeEvent), grant, payload.sourceId) && access(grant, scope) === true; }
      catch { return false; }
    };
    if (!live()) return fail('ACCESS_REFUSED');
    const canWrite = context => {
      // SourceRepository internal atomic writes omit sourceId. The exception is
      // bound solely to this captured mutation; reads cannot gain write access.
      const internalWrite = action !== 'read' && context?.action === 'write' && context.sourceId === undefined;
      return context?.projectId === grant.projectId && (internalWrite || context.sourceId === payload.sourceId && context.action === action) && live();
    };
    const repository = repositoryFactory(Object.freeze({ grant, canWrite }));
    if (!repository || typeof repository[method] !== 'function' || !live()) return fail('ACCESS_REFUSED');
    const args = method === 'applyEdit' ? { projectId: grant.projectId, edit: payload } : { projectId: grant.projectId, ...payload };
    const result = await repository[method](args);
    // A valid read/commit may have completed just before Lock/navigation revoked
    // its sender. Disclose neither bytes nor the successful native receipt then.
    if (!live()) return fail('ACCESS_REFUSED');
    if (method === 'getMetrics') return projectMetrics(result, payload);
    if (method === 'readRange') {
      if (typeof result !== 'string' || result.length !== payload.end - payload.start || !result.isWellFormed()) return fail('SOURCE_RESULT_REFUSED');
      return Object.freeze({ ok: true, sourceId: payload.sourceId, version: payload.version, start: payload.start, end: payload.end, text: result });
    }
    return projectReceipt(method, result, payload);
  } catch (error) {
    if (grant && live && !live()) return fail('ACCESS_REFUSED');
    return fail(nativeCodes.has(error?.code) ? error.code : 'SOURCE_REQUEST_FAILED');
  }
}
