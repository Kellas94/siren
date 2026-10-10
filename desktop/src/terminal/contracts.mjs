// Pure shape validation only. Native caller/project/PIN/epoch/lease authority
// and process ownership must be checked separately before any shell side effect.
export const TERMINAL_LIMITS = Object.freeze({
  sessions: 8, ringBytes: 4 * 1024 * 1024, totalRingBytes: 32 * 1024 * 1024,
  inputBytes: 32 * 1024, outputBytes: 32 * 1024, attachmentOutputBytes: 256 * 1024,
  hostOutputBytes: 2 * 1024 * 1024, inputQueueBytes: 256 * 1024,
  scrollbackLines: 10000, minCols: 2, maxCols: 500, minRows: 1, maxRows: 200,
  vtSequenceBytes: 4096, inputReceipts: 256, stopDeadlineMs: 10000,
});

const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const columns = value => integer(value) && value >= TERMINAL_LIMITS.minCols && value <= TERMINAL_LIMITS.maxCols;
const rows = value => integer(value) && value >= TERMINAL_LIMITS.minRows && value <= TERMINAL_LIMITS.maxRows;
function input(value) {
  if (typeof value !== 'string' || value.length > TERMINAL_LIMITS.inputBytes) return false;
  // Count bytes without allocating a second attacker-sized encoded string.
  // Refuse unpaired surrogates instead of converting them to replacement bytes.
  let bytes = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      bytes += 4;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
    else bytes += 3;
    if (bytes > TERMINAL_LIMITS.inputBytes) return false;
  }
  return true;
}
const request = { operationId: id, epoch: integer };
const session = { sessionId: id };
const attachment = { ...session, leaseId: id, generation: integer };
const schema = fields => Object.freeze({ ...request, ...fields });
export const TERMINAL_METHODS = Object.freeze({
  terminalPickCwd: schema({}), terminalListProfiles: schema({}),
  terminalCreate: schema({ cwdId: id, profileId: id, cols: columns, rows }),
  terminalList: schema({}), terminalAttach: schema(session),
  terminalInput: schema({ ...attachment, inputSequence: integer, data: input }),
  terminalResize: schema({ ...attachment, cols: columns, rows }),
  terminalAck: schema({ ...attachment, throughSequence: integer }),
  terminalDetach: schema(attachment), terminalStop: schema(session),
});
const refused = () => Object.freeze({ ok: false, code: 'REQUEST_REFUSED' });

export function validateTerminalRequest(method, payload) {
  try {
    if (typeof method !== 'string' || !Object.hasOwn(TERMINAL_METHODS, method)) return refused();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return refused();
    const prototype = Object.getPrototypeOf(payload);
    if (prototype !== Object.prototype && prototype !== null) return refused();
    const fields = TERMINAL_METHODS[method];
    const keys = Reflect.ownKeys(payload);
    if (keys.length !== Object.keys(fields).length || keys.some(key => typeof key !== 'string' || !Object.hasOwn(fields, key))) return refused();
    const normalized = Object.create(null);
    for (const [key, validate] of Object.entries(fields)) {
      const descriptor = Object.getOwnPropertyDescriptor(payload, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || !validate(descriptor.value)) return refused();
      normalized[key] = descriptor.value;
    }
    return Object.freeze({ ok: true, payload: Object.freeze(normalized) });
  } catch { return refused(); }
}

// Trusted native integration supplies dispatch. Passing this boundary proves
// request shape only; it never issues a caller grant or an execution permission.
export async function dispatchTerminalRequest({ method, payload, dispatch }) {
  const result = validateTerminalRequest(method, payload);
  if (!result.ok) return result;
  if (typeof dispatch !== 'function') return Object.freeze({ ok: false, code: 'UNAVAILABLE' });
  return dispatch(method, result.payload);
}
