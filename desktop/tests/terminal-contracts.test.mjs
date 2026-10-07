import test from 'node:test';
import assert from 'node:assert/strict';

async function contracts() {
  try { return await import('../src/terminal/contracts.mjs'); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND') assert.fail('Terminal contract implementation is missing'); throw error; }
}
const base = () => ({ operationId: 'operation-1', epoch: 0 });
const leased = () => ({ ...base(), sessionId: 'session-1', leaseId: 'lease-1', generation: 0 });
const cases = [
  ['terminalPickCwd', base()], ['terminalListProfiles', base()],
  ['terminalCreate', { ...base(), cwdId: 'cwd-1', profileId: 'powershell', cols: 80, rows: 24 }],
  ['terminalList', base()], ['terminalAttach', { ...base(), sessionId: 'session-1' }],
  ['terminalInput', { ...leased(), inputSequence: 0, data: 'Ω😀\r\n\x03' }],
  ['terminalResize', { ...leased(), cols: 500, rows: 200 }],
  ['terminalAck', { ...leased(), throughSequence: Number.MAX_SAFE_INTEGER }],
  ['terminalDetach', leased()], ['terminalStop', { ...base(), sessionId: 'session-1' }],
];

test('exact ten Terminal methods accept only their complete typed request and normalize an immutable copy', async () => {
  const { TERMINAL_METHODS, validateTerminalRequest } = await contracts();
  assert.deepEqual(Object.keys(TERMINAL_METHODS).sort(), cases.map(([method]) => method).sort());
  assert.equal(Object.isFrozen(TERMINAL_METHODS), true);
  for (const [method, payload] of cases) {
    const result = validateTerminalRequest(method, payload);
    assert.equal(result.ok, true, method);
    assert.notEqual(result.payload, payload);
    assert.equal(Object.getPrototypeOf(result.payload), null);
    assert.deepEqual({ ...result.payload }, payload);
    assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result.payload), true);
    assert.throws(() => { result.payload.epoch = 2; }, TypeError);
    payload.epoch = 1; assert.equal(result.payload.epoch, 0); payload.epoch = 0;
    const missing = { ...payload }; delete missing.operationId;
    assert.equal(validateTerminalRequest(method, missing).ok, false, method);
    assert.equal(validateTerminalRequest(method, { ...payload, command: 'hidden execution' }).ok, false, method);
  }
});

test('Terminal requests reject unsafe identifiers, numeric coercion, omitted fields and dimension overflow', async () => {
  const { validateTerminalRequest } = await contracts();
  for (const value of ['', 'A', '_hidden', '../escape', 'a'.repeat(129), 'é', null, 1]) {
    assert.equal(validateTerminalRequest('terminalList', { ...base(), operationId: value }).ok, false);
    assert.equal(validateTerminalRequest('terminalAttach', { ...base(), sessionId: value }).ok, false);
  }
  for (const value of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '0', null, undefined]) {
    assert.equal(validateTerminalRequest('terminalList', { ...base(), epoch: value }).ok, false);
    assert.equal(validateTerminalRequest('terminalInput', { ...leased(), generation: value, inputSequence: 0, data: '' }).ok, false);
    assert.equal(validateTerminalRequest('terminalAck', { ...leased(), throughSequence: value }).ok, false);
  }
  for (const [cols, rows] of [[2, 1], [500, 200]]) assert.equal(validateTerminalRequest('terminalCreate', { ...base(), cwdId: 'cwd', profileId: 'powershell', cols, rows }).ok, true);
  for (const [cols, rows] of [[1, 1], [501, 1], [2, 0], [2, 201], [2.1, 1], ['80', 24]]) assert.equal(validateTerminalRequest('terminalCreate', { ...base(), cwdId: 'cwd', profileId: 'powershell', cols, rows }).ok, false);
  assert.equal(validateTerminalRequest('terminalCreate', { ...base(), cwdId: 'cwd', profileId: 'powershell' }).ok, false, 'No renderer dimensions are silently defaulted');
  assert.equal(validateTerminalRequest('terminalInput', { ...leased(), data: '' }).ok, false);
  for (const method of ['terminalSpawn', 'toString', 'constructor', '__proto__', '', null, {}]) assert.equal(validateTerminalRequest(method, base()).ok, false);
});

test('prototype-bearing, accessor, symbol and hidden payload fields are refused without executing getters', async () => {
  const { validateTerminalRequest } = await contracts(); let reads = 0;
  const accessor = { epoch: 0 }; Object.defineProperty(accessor, 'operationId', { enumerable: true, get() { reads++; return 'operation'; } });
  const hidden = base(); Object.defineProperty(hidden, 'hidden', { value: 'unexpected' });
  const symbol = base(); symbol[Symbol('hidden')] = true;
  const pollution = JSON.parse('{"operationId":"operation","epoch":0,"__proto__":{"admin":true}}');
  const inherited = Object.assign(Object.create({ admin: true }), base());
  class Request { constructor() { Object.assign(this, base()); } }
  for (const payload of [null, [], () => {}, new Date(), new Request(), inherited, accessor, hidden, symbol, pollution]) {
    const result = validateTerminalRequest('terminalList', payload);
    assert.equal(result.ok, false); assert.equal(result.code, 'REQUEST_REFUSED');
    assert.equal(result.payload, undefined);
  }
  assert.equal(reads, 0);
  assert.equal(validateTerminalRequest('terminalList', Object.assign(Object.create(null), base())).ok, true);
});

test('terminal input is bounded by exact UTF-8 bytes and refuses malformed UTF-16 without partial normalization', async () => {
  const { validateTerminalRequest } = await contracts();
  const request = data => ({ ...leased(), inputSequence: 0, data });
  for (const data of ['a'.repeat(32768), '😀'.repeat(8192), 'é'.repeat(16384), '']) {
    assert.equal(validateTerminalRequest('terminalInput', request(data)).ok, true);
  }
  for (const data of ['a'.repeat(32769), '😀'.repeat(8192) + 'a', 'é'.repeat(16385), '\ud800', '\udc00', 'ok\ud800rest', null, {}]) {
    assert.equal(validateTerminalRequest('terminalInput', request(data)).ok, false);
  }
});

test('invalid Terminal payload is refused before dispatch and valid dispatch receives only the immutable copy', async () => {
  const { dispatchTerminalRequest } = await contracts(); const calls = [];
  const dispatch = async (method, payload) => { calls.push({ method, payload }); return { ok: true, operationId: payload.operationId }; };
  const invalid = await dispatchTerminalRequest({ method: 'terminalCreate', payload: { ...base(), command: 'hidden' }, dispatch });
  assert.equal(invalid.ok, false); assert.equal(invalid.code, 'REQUEST_REFUSED'); assert.equal(calls.length, 0);
  const payload = { ...base(), sessionId: 'session' };
  const valid = await dispatchTerminalRequest({ method: 'terminalStop', payload, dispatch });
  assert.equal(valid.ok, true); assert.equal(calls.length, 1); assert.equal(calls[0].method, 'terminalStop');
  assert.notEqual(calls[0].payload, payload); assert.equal(Object.isFrozen(calls[0].payload), true);
});

test('frozen Terminal default budgets equal the approved finite limits', async () => {
  const { TERMINAL_LIMITS } = await contracts();
  assert.deepEqual(TERMINAL_LIMITS, {
    sessions: 8, ringBytes: 4194304, totalRingBytes: 33554432, inputBytes: 32768, outputBytes: 32768,
    attachmentOutputBytes: 262144, hostOutputBytes: 2097152, inputQueueBytes: 262144,
    scrollbackLines: 10000, minCols: 2, maxCols: 500, minRows: 1, maxRows: 200,
    vtSequenceBytes: 4096, inputReceipts: 256, stopDeadlineMs: 10000,
  });
  assert.equal(Object.isFrozen(TERMINAL_LIMITS), true);
});
