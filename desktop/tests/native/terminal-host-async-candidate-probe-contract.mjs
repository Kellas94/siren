// OWNER WIP preparation. Pure contract only; never loads an addon or starts a process.
// No independent qualification, admission, or production Session join is claimed.
import assert from 'node:assert/strict';

export const PROBE_VERSION = 1;
export const EXECUTION_ACK = 'OWNER_WIP_ISOLATED_NATIVE_QUALIFICATION';
export const API_SCOPE = 'HOST_AND_EXACT_PEER_ROSTER_ONLY';
export const LIMITS = Object.freeze({
  caseWallMs: 25000, operationWallMs: 12000, safetyOperationWallMs: 4000,
  receiptBytes: 262144, caseCount: 10, heldProcesses: 128,
  heartbeatIntervalMs: 5, heartbeatMaxGapMs: 250,
});
export const BASE_CAPABILITIES = Object.freeze([
  'ISOLATED_TARGET_AND_EXTERNAL_WATCHDOG', 'PRECONTAINED_FIXTURE',
  'INDEPENDENT_HELD_SAFETY_HANDLES', 'EXACT_NATIVE_PEER_ORDINALS',
  'SAFETY_OBSERVE_BEFORE_CLEANUP', 'LOADED_CANDIDATE_HASH',
]);
const define = (id, extra = {}) => Object.freeze({
  id, sessionCount: 8, shellCount: 8, peerCount: 8, code: 98,
  deadlineMs: 5000, expected: 'resolve', heldIo: false, gc: false,
  duplicate: false, heartbeatProgress: false, sessionCleanupPending: false,
  nativeFault: null, capabilities: Object.freeze([]), ...extra,
});
export const CASE_MATRIX = Object.freeze([
  define('zero_sessions', { sessionCount: 0, shellCount: 0, peerCount: 0, code: 77 }),
  define('eight_sessions'),
  define('eight_sessions_held_io', { heldIo: true }),
  define('gc_while_shutdown_pending', { gc: true, capabilities: Object.freeze(['GC_EXPOSED']) }),
  define('exact_duplicate_pending_promise', { duplicate: true }),
  define('heartbeat_while_native_reap_delayed', {
    heldIo: true, heartbeatProgress: true, nativeFault: 'DELAY_NATIVE_REAP',
    capabilities: Object.freeze(['AUDITED_NATIVE_REAP_DELAY']),
  }),
  define('deadline_before_native_reap', {
    heldIo: true, deadlineMs: 1, expected: 'reject', nativeFault: 'DELAY_NATIVE_REAP',
    capabilities: Object.freeze(['AUDITED_NATIVE_REAP_DELAY']),
  }),
  define('unknown_job_accounting', {
    expected: 'reject', nativeFault: 'FAIL_JOB_ACCOUNTING_QUERY',
    capabilities: Object.freeze(['AUDITED_NATIVE_JOB_QUERY_FAULT']),
  }),
  define('monitor_cancellation_in_progress', {
    nativeFault: 'DELAY_WAIT_CANCELLATION',
    capabilities: Object.freeze(['AUDITED_NATIVE_WAIT_CANCELLATION']),
  }),
  define('session_async_cleanup_in_progress_scope_limit', {
    sessionCleanupPending: true,
    capabilities: Object.freeze(['NATIVE_SESSION_ASYNC_PENDING_OBSERVATION']),
  }),
]);

export const PREPARATION_GAPS = Object.freeze([
  'No trusted isolated adapter, contained native fixture, or independent Safety implementation is provided by these files.',
  'Native fault injection and monitor-cancellation instrumentation require separately reviewed future implementation.',
  'Full production JavaScript Session cleanup join is UNIMPLEMENTED; host receipts must say sessionCleanupJoined:false.',
  'Deadline rejection cases record actual elapsed time and external watchdog ceilings; hard real-time rejection delivery by deadlineMs is not established.',
  'These files are OWNER WIP source preparation and have not been executed, built, or independently qualified.',
]);

// The external adapter is trusted CODE, not an observation supplied by the candidate.
// Its entry and complete import/native dependency closure require review before use.
// Interface:
//   CONTRACT = {version:1, role:'TRUSTED_ISOLATED_HOST_ASYNC_QUALIFICATION_ADAPTER',
//               admitted:false, capabilities:[...BASE_CAPABILITIES, ...]}
//   openCase({caseSpec, candidate, workerUrl, limits, signal}) -> case controller
// Controller methods, in this exact order:
//   captureSafetyBeforeTrigger() -> held-handle receipt BEFORE shutdown is issued
//   runCandidate() -> {sequence, workerReceipt}; isolated target runs the worker below
//   observeSafetyBeforeCleanup() -> new observations using the SAME held handles
//   cleanupSafety() -> separately recorded cleanup receipt; NEVER repairs candidate proof
// The adapter starts only pre-contained children, retains independent native process
// handles (no PID reopen), provides an external process watchdog, and implements
// bounded cancellation even if target JavaScript/native code hangs. A driver timeout
// stops receipt acceptance; it MUST NOT release handles or perform Safety termination
// until observeSafetyBeforeCleanup has sampled them. The adapter must also observe
// before cleanup when openCase fails after creating any process.
// Controller methods must use nonblocking IPC; they must not run the target addon
// in the driver process. Abort/timeout must preserve pre-cleanup observations.
export function requireAdapter(adapter) {
  const contract = adapter?.CONTRACT;
  assert.equal(contract?.version, 1, 'ADAPTER_CONTRACT_VERSION');
  assert.equal(contract.role, 'TRUSTED_ISOLATED_HOST_ASYNC_QUALIFICATION_ADAPTER', 'ADAPTER_ROLE');
  assert.equal(contract.admitted, false, 'ADAPTER_ADMISSION_REFUSED');
  assert.ok(Array.isArray(contract.capabilities), 'ADAPTER_CAPABILITIES');
  assert.equal(new Set(contract.capabilities).size, contract.capabilities.length, 'ADAPTER_CAPABILITY_DUPLICATE');
  for (const capability of BASE_CAPABILITIES) assert.ok(contract.capabilities.includes(capability), `ADAPTER_${capability}`);
  assert.equal(typeof adapter.openCase, 'function', 'ADAPTER_OPEN_CASE');
  return contract;
}

export function requireController(controller) {
  for (const name of ['captureSafetyBeforeTrigger', 'runCandidate', 'observeSafetyBeforeCleanup', 'cleanupSafety']) {
    assert.equal(typeof controller?.[name], 'function', `ADAPTER_CONTROLLER_${name}`);
  }
}

function uint32(value, label, positive = false) {
  assert.ok(Number.isInteger(value) && value >= (positive ? 1 : 0) && value <= 0xffffffff, label);
  return value;
}
function ordinals(rows) {
  assert.ok(Array.isArray(rows) && rows.length <= 8, 'NATIVE_PAIR_ROSTER_BOUNDS');
  for (const ordinal of rows) uint32(ordinal, 'NATIVE_PAIR_ORDINAL', true);
  assert.equal(new Set(rows).size, rows.length, 'NATIVE_PAIR_ORDINAL_DUPLICATE');
  return [...rows].sort((a, b) => a - b);
}
function identity(value, held = false) {
  assert.ok(value && typeof value === 'object', 'HELD_IDENTITY_REQUIRED');
  uint32(value.pid, 'HELD_PID', true);
  assert.ok(typeof value.image === 'string' && value.image.length > 0 && value.image.length <= 32768 && !value.image.includes('\0'), 'HELD_IMAGE');
  assert.ok(typeof value.createdFileTime === 'string' && /^[1-9][0-9]{0,19}$/.test(value.createdFileTime) && BigInt(value.createdFileTime) <= 0xffffffffffffffffn, 'HELD_BIRTH');
  assert.equal(typeof value.alive, 'boolean', 'HELD_ALIVE');
  uint32(value.exitCode, 'HELD_EXIT_CODE');
  if (value.alive) assert.equal(value.exitCode, 259, 'HELD_LIVE_EXIT_CODE');
  if (held) {
    assert.ok(typeof value.heldToken === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value.heldToken), 'SAFETY_HELD_TOKEN');
    assert.ok(['host', 'creator', 'shell', 'descendant'].includes(value.role), 'SAFETY_IDENTITY_ROLE');
  }
  return value;
}
const sameIdentity = (a, b) => a.pid === b.pid && a.createdFileTime === b.createdFileTime && a.image.toLowerCase() === b.image.toLowerCase();

export function validateSetup(setup, spec, candidateSha256) {
  assert.equal(setup?.version, 1, 'FIXTURE_VERSION');
  assert.equal(setup.loadedCandidateSha256, candidateSha256, 'LOADED_CANDIDATE_DRIFT');
  assert.equal(setup.sessionCount, spec.sessionCount, 'FIXTURE_SESSION_COUNT');
  assert.equal(setup.shellCount, spec.shellCount, 'FIXTURE_SHELL_COUNT');
  assert.equal(setup.nativePairOrdinals?.length, spec.peerCount, 'FIXTURE_PEER_COUNT');
  ordinals(setup.nativePairOrdinals);
  assert.equal(setup.precontained, true, 'FIXTURE_PRECONTAINMENT');
  assert.equal(setup.pairOrdinalSource, 'ACTUAL_NATIVE_PEER_SNAPSHOT', 'FIXTURE_ROSTER_SOURCE');
  if (spec.heldIo) {
    assert.ok(Array.isArray(setup.heldIo) && setup.heldIo.length >= 2 && setup.heldIo.length <= 128, 'HELD_IO_EVIDENCE');
    const covered = new Set();
    for (const row of setup.heldIo) {
      assert.ok(setup.nativePairOrdinals.includes(row.pairOrdinal), 'HELD_IO_FOREIGN_PAIR');
      assert.ok(['control', 'history', 'command'].includes(row.lane), 'HELD_IO_LANE');
      assert.ok(['read', 'write'].includes(row.kind), 'HELD_IO_KIND');
      assert.equal(row.source, 'ACTUAL_NATIVE_OVERLAPPED_OBSERVATION', 'HELD_IO_SOURCE');
      assert.equal(row.nativePending, true, 'HELD_IO_NOT_PENDING');
      assert.equal(row.bufferRetained, true, 'HELD_IO_BUFFER_NOT_RETAINED');
      covered.add(row.kind);
    }
    assert.ok(covered.has('read') && covered.has('write'), 'HELD_READ_AND_WRITE_REQUIRED');
  }
  if (spec.nativeFault) {
    assert.equal(setup.nativeFault?.kind, spec.nativeFault, 'NATIVE_FAULT_KIND');
    assert.equal(setup.nativeFault.source, 'AUDITED_NATIVE_FAULT_INJECTION', 'NATIVE_FAULT_SOURCE');
    assert.equal(setup.nativeFault.armedBeforeTrigger, true, 'NATIVE_FAULT_NOT_ARMED');
    assert.match(setup.nativeFault.instrumentedArtifactSha256, /^[a-f0-9]{64}$/, 'NATIVE_FAULT_ARTIFACT_ID');
    assert.equal(setup.nativeFault.instrumentedArtifactSha256, candidateSha256, 'NATIVE_FAULT_ARTIFACT_DRIFT');
  }
  if (spec.expected === 'reject') assert.match(setup.expectedNativeErrorCode, /^[A-Z][A-Z0-9_]{1,127}$/, 'EXPECTED_NATIVE_ERROR_CODE');
  if (spec.sessionCleanupPending) {
    assert.equal(setup.sessionCleanupPendingAtTrigger, true, 'SESSION_ASYNC_NOT_PENDING');
    assert.equal(setup.sessionPendingSource, 'ACTUAL_NATIVE_ASYNC_PENDING_OBSERVATION', 'SESSION_ASYNC_PENDING_SOURCE');
  }
  return setup;
}

export function validateSafety(receipt, phase, spec) {
  assert.equal(receipt?.version, 1, 'SAFETY_VERSION');
  assert.equal(receipt.phase, phase, 'SAFETY_PHASE');
  uint32(receipt.sequence, 'SAFETY_SEQUENCE', true);
  uint32(receipt.candidatePid, 'CANDIDATE_PID', true);
  uint32(receipt.observerPid, 'SAFETY_PID', true);
  assert.notEqual(receipt.observerPid, receipt.candidatePid, 'SAFETY_NOT_INDEPENDENT_PROCESS');
  assert.equal(receipt.source, 'INDEPENDENT_NATIVE_HELD_HANDLES', 'SAFETY_SOURCE');
  assert.equal(receipt.handlesHeld, true, 'SAFETY_HANDLES_NOT_HELD');
  assert.equal(receipt.cleanupStarted, false, 'SAFETY_CLEANUP_PRECEDED_OBSERVATION');
  assert.equal(receipt.jobAccountingKnown, true, 'SAFETY_JOB_ACCOUNTING_UNKNOWN');
  uint32(receipt.safetyJobActive, 'SAFETY_ACTIVE_COUNT');
  assert.ok(Array.isArray(receipt.identities) && receipt.identities.length >= 1 && receipt.identities.length <= LIMITS.heldProcesses, 'SAFETY_HELD_BOUNDS');
  const tokens = new Set(), pids = new Set();
  for (const row of receipt.identities) {
    identity(row, true);
    assert.ok(!tokens.has(row.heldToken) && !pids.has(row.pid), 'SAFETY_HELD_DUPLICATE');
    tokens.add(row.heldToken); pids.add(row.pid);
  }
  assert.equal(receipt.identities.filter(row => row.role === 'host').length, 1, 'SAFETY_HOST_COVERAGE');
  assert.equal(receipt.identities.filter(row => row.role === 'creator').length, spec.sessionCount, 'SAFETY_CREATOR_COVERAGE');
  assert.equal(receipt.identities.filter(row => row.role === 'shell').length, spec.shellCount, 'SAFETY_SHELL_COVERAGE');
  if (phase === 'BEFORE_SHUTDOWN') for (const row of receipt.identities) assert.equal(row.alive, true, 'SAFETY_INITIAL_PROCESS_NOT_LIVE');
  return receipt;
}

export function validateCaseObservation({ spec, before, after, worker, candidateSha256 }) {
  validateSafety(before, 'BEFORE_SHUTDOWN', spec);
  validateSafety(after, 'BEFORE_SAFETY_CLEANUP', spec);
  assert.ok(after.sequence > before.sequence, 'SAFETY_ORDER');
  assert.equal(after.observerPid, before.observerPid, 'SAFETY_OBSERVER_CHANGED');
  assert.equal(after.candidatePid, before.candidatePid, 'CANDIDATE_PROCESS_CHANGED');
  assert.equal(after.identities.length, before.identities.length, 'SAFETY_ROSTER_CHANGED');
  for (const initial of before.identities) {
    const final = after.identities.find(row => row.heldToken === initial.heldToken);
    assert.ok(final && sameIdentity(initial, final) && initial.role === final.role, 'SAFETY_HANDLE_IDENTITY_CHANGED');
  }
  assert.equal(worker?.version, 1, 'WORKER_VERSION');
  assert.equal(worker.caseId, spec.id, 'WORKER_CASE_ID');
  assert.equal(worker.pid, before.candidatePid, 'WORKER_PROCESS_ID');
  assert.equal(worker.admitted, false, 'WORKER_ADMISSION_REFUSED');
  assert.equal(worker.independentReview, false, 'WORKER_INDEPENDENT_REVIEW_REFUSED');
  validateSetup(worker.setup, spec, candidateSha256);
  assert.ok(Number.isFinite(worker.elapsedMs) && worker.elapsedMs >= 0 && worker.elapsedMs <= LIMITS.operationWallMs, 'WORKER_OPERATION_DEADLINE');
  assert.ok(Number.isFinite(worker.synchronousCallMs) && worker.synchronousCallMs >= 0 && worker.synchronousCallMs < LIMITS.heartbeatMaxGapMs, 'SYNCHRONOUS_HOST_SHUTDOWN_BLOCK');
  if (spec.gc) assert.ok(Number.isInteger(worker.gcCalls) && worker.gcCalls >= 2, 'GC_CASE_NOT_EXERCISED');
  if (spec.duplicate) assert.equal(worker.duplicatePromiseExact, true, 'DUPLICATE_PROMISE_IDENTITY');
  if (spec.heartbeatProgress) {
    assert.ok(worker.heartbeat?.pendingTicks >= 2, 'PENDING_HEARTBEAT_PROGRESS_UNPROVEN');
    assert.ok(Number.isFinite(worker.heartbeat.pendingMaxGapMs) && worker.heartbeat.pendingMaxGapMs < LIMITS.heartbeatMaxGapMs, 'PENDING_HEARTBEAT_BLOCKED');
  }
  if (spec.nativeFault) {
    const proof = worker.postCallNativeEvidence?.nativeFault;
    assert.equal(proof?.source, 'ACTUAL_NATIVE_FAULT_EXECUTION_OBSERVATION', 'NATIVE_FAULT_EXECUTION_SOURCE');
    assert.equal(proof.kind, spec.nativeFault, 'NATIVE_FAULT_EXECUTION_KIND');
    assert.equal(proof.exercised, true, 'NATIVE_FAULT_NOT_EXERCISED');
  }
  if (spec.expected === 'reject') {
    assert.equal(worker.outcome?.kind, 'reject', 'NATIVE_FAILURE_DID_NOT_REJECT');
    assert.equal(worker.outcome.error?.code, worker.setup.expectedNativeErrorCode, 'NATIVE_ERROR_CODE_MISMATCH');
    assert.equal(worker.nativeResult, null, 'NATIVE_FAILURE_RESULT_FORGED');
    return { observed: true, expectedNativeRejection: worker.outcome.error.code,
      elapsedMs: worker.elapsedMs, requestedDeadlineMs: spec.deadlineMs,
      hardRealtimeRejectionDeliveryProven: false, sessionCleanupJoined: false };
  }
  assert.equal(worker.outcome?.kind, 'resolve', 'NATIVE_SHUTDOWN_DID_NOT_RESOLVE');
  assert.ok(worker.elapsedMs < spec.deadlineMs, 'HOST_SUCCESS_DELIVERED_AFTER_DEADLINE');
  const result = worker.nativeResult;
  assert.deepEqual(Object.keys(result ?? {}).sort(), ['version', 'shutdownId', 'code', 'deadlineMs', 'snapshot', 'closed', 'scope', 'sessionCleanupJoined', 'peers'].sort(), 'HOST_RECEIPT_EXACT_KEYS');
  assert.equal(result.version, 1, 'HOST_RECEIPT_VERSION');
  assert.equal(result.shutdownId, worker.shutdownId, 'HOST_SHUTDOWN_ID');
  assert.equal(result.code, spec.code, 'HOST_SHUTDOWN_CODE');
  assert.equal(result.deadlineMs, spec.deadlineMs, 'HOST_SHUTDOWN_DEADLINE');
  assert.equal(result.closed, true, 'HOST_NOT_CLOSED');
  assert.equal(result.scope, API_SCOPE, 'HOST_SCOPE');
  assert.equal(result.sessionCleanupJoined, false, 'UNIMPLEMENTED_SESSION_JOIN_CLAIM');
  assert.ok(Array.isArray(result.peers), 'HOST_PEER_RECEIPTS');
  for (const peer of result.peers) {
    assert.deepEqual(Object.keys(peer).sort(), ['pairOrdinal', 'nativeReaped', 'jsDeliveryVerified', 'tsfnFinalized'].sort(), 'HOST_PEER_EXACT_KEYS');
    for (const key of ['nativeReaped', 'jsDeliveryVerified', 'tsfnFinalized']) assert.equal(peer[key], true, `HOST_PEER_${key}`);
  }
  assert.deepEqual(ordinals(result.peers.map(peer => peer.pairOrdinal)), ordinals(worker.setup.nativePairOrdinals), 'HOST_EXACT_PEER_ROSTER');
  const snapshot = result.snapshot;
  assert.equal(snapshot?.active, 0, 'HOST_JOB_NOT_EMPTY');
  assert.equal(snapshot.killOnClose, true, 'HOST_KILL_ON_CLOSE_LOST');
  assert.equal(snapshot.breakaway, false, 'HOST_BREAKAWAY');
  assert.equal(snapshot.inheritable, false, 'HOST_INHERITABLE_HANDLE');
  assert.ok(Array.isArray(snapshot.held) && snapshot.held.length <= LIMITS.heldProcesses, 'HOST_HELD_SNAPSHOT');
  const nativeRows = [snapshot.root, ...snapshot.held];
  for (const row of nativeRows) {
    identity(row);
    assert.equal(row.alive, false, 'HOST_NATIVE_HELD_PROCESS_LIVE');
    const safety = after.identities.find(held => sameIdentity(row, held));
    assert.ok(safety, 'HOST_NATIVE_IDENTITY_NOT_IN_SAFETY');
    assert.equal(safety.exitCode, row.exitCode, 'HOST_EXIT_CODE_NOT_INDEPENDENTLY_CONFIRMED');
  }
  assert.equal(after.safetyJobActive, 0, 'ACTIVE_BEFORE_SAFETY_CLEANUP');
  for (const row of after.identities) assert.equal(row.alive, false, 'LIVE_BEFORE_SAFETY_CLEANUP');
  if (spec.nativeFault === 'DELAY_WAIT_CANCELLATION') {
    const proof = worker.postCallNativeEvidence?.monitorCancellation;
    assert.equal(proof?.source, 'ACTUAL_NATIVE_WAIT_CANCELLATION_OBSERVATION', 'MONITOR_CANCELLATION_SOURCE');
    uint32(proof.requested, 'MONITOR_CANCELLATION_REQUESTED', true);
    assert.equal(proof.completed, proof.requested, 'MONITOR_CANCELLATION_INCOMPLETE');
    assert.equal(proof.callbacksInFlight, 0, 'MONITOR_CALLBACK_STILL_LIVE');
  }
  return { observed: true, closed: true, exactPairOrdinals: ordinals(worker.setup.nativePairOrdinals), sessionCleanupJoined: false };
}

export function validateSafetyCleanup(cleanup, observationSequence) {
  assert.equal(cleanup?.phase, 'SAFETY_CLEANUP', 'CLEANUP_PHASE');
  assert.ok(Number.isInteger(cleanup.startSequence) && cleanup.startSequence > observationSequence, 'CLEANUP_BEFORE_OBSERVATION');
  assert.ok(Number.isInteger(cleanup.endSequence) && cleanup.endSequence > cleanup.startSequence, 'CLEANUP_ORDER');
  assert.equal(cleanup.completed, true, 'SAFETY_CLEANUP_INCOMPLETE');
  assert.equal(cleanup.jobAccountingKnown, true, 'SAFETY_CLEANUP_ACCOUNTING_UNKNOWN');
  assert.equal(cleanup.activeAfter, 0, 'SAFETY_CLEANUP_LIVE_PROCESS');
  assert.equal(cleanup.heldHandlesClosed, true, 'SAFETY_HANDLE_LEAK');
  assert.equal(cleanup.watchdogExited, true, 'SAFETY_WATCHDOG_NOT_JOINED');
  return { cleanupVerified: true };
}
