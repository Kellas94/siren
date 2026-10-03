import { randomUUID } from 'node:crypto';
import { validId } from '../projects/paths.mjs';
import { SourceReaderPool } from './readers.mjs';

const schemas = Object.freeze({ openRead: ['sourceId', 'version', 'sha256'],
  readChunk: ['sourceId', 'version', 'readId', 'start', 'maxUnits'], closeRead: ['sourceId', 'version', 'readId'] });
const codes = new Set(['ACCESS_REFUSED', 'SOURCE_READER_CLOSED', 'SOURCE_READER_BUDGET', 'INVALID_RANGE',
  'INVALID_UNICODE', 'UNKNOWN_VERSION', 'CORRUPT_SOURCE', 'OWNED_PATH_REFUSED', 'UNSUPPORTED_ENCODING']);
const fail = code => Object.freeze({ ok: false, code });
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 1;
const metrics = ['sourceId', 'version', 'sha256', 'utf8Bytes', 'utf16Units', 'lines', 'longestLineUnits', 'encoding', 'bom', 'newline'];
function normalize(method, input) {
  if (!Object.hasOwn(schemas, method) || !input || typeof input !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
  const allowed = schemas[method], descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== allowed.length || keys.some(key => typeof key !== 'string' || !allowed.includes(key) ||
      !Object.hasOwn(descriptors[key], 'value') || !descriptors[key].enumerable)) return null;
  const value = Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
  if (!validId(value.sourceId) || !integer(value.version) ||
      (method === 'openRead' ? !hash(value.sha256) : !validId(value.readId))) return null;
  if (method === 'readChunk' && (!Number.isSafeInteger(value.start) || value.start < 0 ||
      !integer(value.maxUnits) || value.maxUnits < 2 || value.maxUnits > 131072)) return null;
  return Object.freeze(value);
}
function capture(caller, sourceId) {
  if (!caller || !['workspace', 'code'].includes(caller.role) || !validId(caller.projectId) ||
      !validId(caller.windowId) || !integer(caller.epoch) || !integer(caller.webContentsId) ||
      typeof caller.mainFrameUrl !== 'string' || !Array.isArray(caller.entityIds) || !caller.entityIds.includes(sourceId)) return null;
  return Object.freeze(Object.fromEntries(['projectId', 'windowId', 'role', 'epoch', 'webContentsId', 'mainFrameUrl']
    .map(key => [key, caller[key]])));
}
const same = (caller, grant, sourceId) => caller && Object.keys(grant).every(key => caller[key] === grant[key]) &&
  Array.isArray(caller.entityIds) && caller.entityIds.includes(sourceId);

/** Isolated native authority. No live IPC/preload is installed by this module.
 * Read IDs are opaque references bound to an actual window/frame/epoch/source,
 * never bearer tokens. One shared pool bounds all pending and active snapshots.
 */
export class SourceReadService {
  #entries = new Map();
  #readers = new SourceReaderPool();
  #disposed = false;
  #registry; #factory; #access;
  constructor({ registry, repositoryFactory, access }) {
    this.#registry = registry; this.#factory = repositoryFactory; this.#access = access;
  }
  #close(entry) {
    entry.closed = true; clearTimeout(entry.timer);
    entry.reader?.dispose(); this.#entries.delete(entry.readId);
  }
  dispose() {
    this.#disposed = true;
    for (const entry of this.#entries.values()) this.#close(entry);
    this.#readers.dispose();
  }
  async invoke({ event, method, payload: input }) {
    let entry, opened = false, live;
    try {
      if (typeof method !== 'string') return fail('REQUEST_REFUSED');
      const payload = normalize(method, input); if (!payload) return fail('REQUEST_REFUSED');
      const nativeEvent = Object.freeze({ sender: event?.sender, senderFrame: event?.senderFrame });
      const grant = capture(this.#registry.caller(nativeEvent), payload.sourceId);
      if (!grant || this.#disposed) return fail('ACCESS_REFUSED');
      live = () => {
        try { return !this.#disposed && !entry?.closed && same(this.#registry.caller(nativeEvent), grant, payload.sourceId) &&
          this.#access(grant, Object.freeze({ sourceId: payload.sourceId, action: 'read' })) === true; }
        catch { return false; }
      };
      if (!live()) return fail('ACCESS_REFUSED');
      if (method === 'openRead') {
        if (this.#entries.size >= 2) return fail('SOURCE_READER_BUDGET');
        const readId = randomUUID();
        entry = { readId, grant, sourceId: payload.sourceId, version: payload.version, reader: null, closed: false, reading: false };
        this.#entries.set(readId, entry); opened = true;
        entry.timer = setTimeout(() => this.#close(entry), 60000); entry.timer.unref();
        const canWrite = context => context?.action === 'read' && context.projectId === grant.projectId &&
          context.sourceId === payload.sourceId && live();
        const repository = this.#factory(Object.freeze({ grant, canWrite, readers: this.#readers }));
        if (!repository || repository.readers !== this.#readers || !live()) { this.#close(entry); return fail('ACCESS_REFUSED'); }
        const reader = await repository.openReader({ projectId: grant.projectId, sourceId: payload.sourceId, version: payload.version });
        entry.reader = reader;
        if (!live()) { this.#close(entry); return fail('ACCESS_REFUSED'); }
        if (reader.info.sourceId !== payload.sourceId || reader.info.version !== payload.version || reader.info.sha256 !== payload.sha256) {
          this.#close(entry); return fail('SOURCE_RESULT_REFUSED');
        }
        return Object.freeze({ ok: true, readId, ...Object.fromEntries(metrics.map(key => [key, reader.info[key]])) });
      }
      entry = this.#entries.get(payload.readId);
      if (!entry || entry.closed || !entry.reader || entry.sourceId !== payload.sourceId || entry.version !== payload.version ||
          !same(this.#registry.caller(nativeEvent), entry.grant, payload.sourceId) || !live()) return fail('ACCESS_REFUSED');
      if (method === 'closeRead') { this.#close(entry); return Object.freeze({ ok: true, readId: payload.readId, sourceId: payload.sourceId, version: payload.version }); }
      if (entry.reading) return fail('SOURCE_READER_BUSY');
      entry.reading = true;
      try {
        const result = await entry.reader.readChunk({ start: payload.start, maxUnits: payload.maxUnits });
        if (!live()) { this.#close(entry); return fail('ACCESS_REFUSED'); }
        if (result.sourceId !== payload.sourceId || result.version !== payload.version || result.start !== payload.start ||
            !Number.isSafeInteger(result.end) || result.end < result.start || result.end - result.start > payload.maxUnits ||
            typeof result.text !== 'string' || result.text.length !== result.end - result.start || !result.text.isWellFormed()) return fail('SOURCE_RESULT_REFUSED');
        return Object.freeze({ ok: true, readId: payload.readId, sourceId: payload.sourceId, version: payload.version,
          start: result.start, end: result.end, text: result.text });
      } finally { entry.reading = false; }
    } catch (e) {
      const revoked = live && !live();
      if (opened && entry) this.#close(entry);
      if (revoked) return fail('ACCESS_REFUSED');
      if (entry && e?.code === 'SOURCE_READER_CLOSED') this.#close(entry);
      return fail(codes.has(e?.code) ? e.code : 'SOURCE_REQUEST_FAILED');
    }
  }
}
