// OWNER WIP, UNEXECUTED. Future isolated target helper; no addon import or spawn here.
// Only a separately reviewed adapter may supply the actual contained fixture.
import { performance } from 'node:perf_hooks';
import { LIMITS, validateSetup } from './terminal-host-async-candidate-probe-contract.mjs';

const errorValue = error => ({
  code: typeof error?.code === 'string' ? error.code : 'UNCLASSIFIED_WORKER_ERROR',
  message: String(error?.message ?? error).slice(0, 2048),
});
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fixture contract (actual native runtime, NEVER a simulated replacement):
//   native.stopAndCloseHostAsync: exact native export, called directly below
//   describeSetup(): pre-trigger loaded-artifact/native roster/IO/fault evidence
//   takeOwner(): transfers the owner JS reference and clears fixture retention
//   releaseOwnerReferences(): drops all other owner wrapper refs for the GC case
//   beginSessionCleanupForScopeCase(): synchronous real Session cleanup admission;
//     returns {promise, pending:true, source:'ACTUAL_NATIVE_ASYNC_PENDING_OBSERVATION'}
//   collectNativePostCallEvidence(): actual cancellation/diagnostic observations
// Fixture creation and all creator/shell spawning occur in the trusted adapter
// BEFORE independent Safety acquires held handles and triggers this helper.
// The helper never closes Sessions, terminates the Safety Job, or fabricates a join.
export async function runHostAsyncCandidateWorker({ fixture, caseSpec, candidateSha256, shutdownId }) {
  const receipt = {
    version: 1, status: 'OWNER_WIP_NATIVE_WORKER_NOT_ADMITTED',
    admitted: false, independentReview: false, caseId: caseSpec.id, pid: process.pid,
    shutdownId, setup: null, outcome: null, nativeResult: null,
    synchronousCallMs: 0, elapsedMs: 0, gcCalls: 0, duplicatePromiseExact: null,
    heartbeat: { pendingTicks: 0, pendingMaxGapMs: 0 }, postCallNativeEvidence: null,
    scope: 'HOST_AND_EXACT_PEER_ROSTER_ONLY', sessionCleanupJoined: false,
  };
  let phase = 'baseline', lastTick = performance.now(), heartbeat = null, timeout = null;
  let started = null;
  try {
    if (!fixture || typeof fixture.native?.stopAndCloseHostAsync !== 'function') throw new Error('ACTUAL_NATIVE_EXPORT_REQUIRED');
    for (const method of ['describeSetup', 'takeOwner', 'releaseOwnerReferences', 'collectNativePostCallEvidence']) {
      if (typeof fixture[method] !== 'function') throw new Error(`ACTUAL_FIXTURE_METHOD_REQUIRED:${method}`);
    }
    receipt.setup = await fixture.describeSetup();
    if (!caseSpec.sessionCleanupPending) validateSetup(receipt.setup, caseSpec, candidateSha256);
    if (caseSpec.gc && typeof globalThis.gc !== 'function') throw new Error('EXPOSED_GC_REQUIRED');
    let owner = fixture.takeOwner();
    if (!owner || typeof owner !== 'object') throw new Error('ACTUAL_OWNER_REQUIRED');
    heartbeat = setInterval(() => {
      const now = performance.now();
      if (phase === 'pending') {
        receipt.heartbeat.pendingTicks++;
        receipt.heartbeat.pendingMaxGapMs = Math.max(receipt.heartbeat.pendingMaxGapMs, now - lastTick);
      }
      lastTick = now;
    }, LIMITS.heartbeatIntervalMs);
    await pause(20);
    if (caseSpec.sessionCleanupPending) {
      if (typeof fixture.beginSessionCleanupForScopeCase !== 'function') throw new Error('SESSION_ASYNC_SCOPE_FIXTURE_REQUIRED');
      // Start AFTER Safety acquired and sampled its independent live handles.
      // No await occurs between actual Session admission and the host API call.
      const session = fixture.beginSessionCleanupForScopeCase();
      if (!(session?.promise instanceof Promise)) throw new Error('ACTUAL_SESSION_ASYNC_PROMISE_REQUIRED');
      void session.promise.catch(() => {});
      receipt.setup = { ...receipt.setup,
        sessionCleanupPendingAtTrigger: session.pending,
        sessionPendingSource: session.source,
      };
      validateSetup(receipt.setup, caseSpec, candidateSha256);
    }
    lastTick = performance.now(); started = lastTick; phase = 'pending';
    let operation;
    try {
      // Keep this direct call: an async wrapper would destroy Promise identity proof.
      operation = fixture.native.stopAndCloseHostAsync(owner, caseSpec.code, caseSpec.deadlineMs, shutdownId);
      receipt.synchronousCallMs = performance.now() - started;
    } catch (error) {
      receipt.synchronousCallMs = performance.now() - started;
      receipt.outcome = { kind: 'throw', error: errorValue(error) };
    }
    if (!receipt.outcome) {
      if (!(operation instanceof Promise)) throw new Error('NATIVE_PROMISE_REQUIRED');
      if (caseSpec.duplicate) {
        const duplicate = fixture.native.stopAndCloseHostAsync(owner, caseSpec.code, caseSpec.deadlineMs, shutdownId);
        receipt.duplicatePromiseExact = duplicate === operation;
        // Observe any erroneous distinct Promise rejection without hiding inequality.
        if (duplicate instanceof Promise && duplicate !== operation) void duplicate.catch(() => {});
      }
      const settled = operation.then(
        value => ({ kind: 'resolve', value }),
        error => ({ kind: 'reject', error: errorValue(error) }),
      );
      if (caseSpec.gc) {
        fixture.releaseOwnerReferences(); owner = null;
        for (let index = 0; index < 4; index++) { globalThis.gc(); receipt.gcCalls++; }
      }
      const watchdog = new Promise(resolve => {
        timeout = setTimeout(() => resolve({ kind: 'worker-timeout', error: { code: 'WORKER_OPERATION_TIMEOUT', message: 'External Safety still owns cleanup.' } }), Math.min(LIMITS.operationWallMs, caseSpec.deadlineMs + 2000));
      });
      const outcome = await Promise.race([settled, watchdog]);
      receipt.outcome = { kind: outcome.kind, ...(outcome.error ? { error: outcome.error } : {}) };
      if (outcome.kind === 'resolve') receipt.nativeResult = outcome.value;
    }
    receipt.elapsedMs = performance.now() - started;
    receipt.heartbeat.pendingMaxGapMs = Math.max(receipt.heartbeat.pendingMaxGapMs, performance.now() - lastTick);
    phase = 'after';
    receipt.postCallNativeEvidence = await fixture.collectNativePostCallEvidence();
  } catch (error) {
    receipt.outcome = { kind: 'worker-error', error: errorValue(error) };
    if (started !== null) receipt.elapsedMs = performance.now() - started;
  } finally {
    phase = 'finished';
    if (heartbeat !== null) clearInterval(heartbeat);
    if (timeout !== null) clearTimeout(timeout);
  }
  return receipt;
}
