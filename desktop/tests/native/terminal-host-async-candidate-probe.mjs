// OWNER WIP preparation, NOT_ADMITTED. No native execution was performed to prepare this.
// Default/--describe prints the blueprint. --run requires a separately reviewed,
// explicitly selected isolated Safety adapter; none is implemented by these files.
// This driver never imports an addon, spawns a child, compiles, or invokes Git/network.
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  API_SCOPE, CASE_MATRIX, EXECUTION_ACK, LIMITS, PREPARATION_GAPS,
  requireAdapter, requireController, validateCaseObservation, validateSafety,
  validateSafetyCleanup,
} from './terminal-host-async-candidate-probe-contract.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const failure = error => ({ code: String(error?.code ?? 'PROBE_REFUSED'), message: String(error?.message ?? error).slice(0, 2048) });
export function describeHostAsyncCandidateProbe() {
  return {
    version: 1, status: 'OWNER_WIP_PREPARED_NOT_EXECUTED', executed: false,
    admitted: false, independentReview: false, qualified: false,
    scope: API_SCOPE, sessionCleanupJoined: false, limits: LIMITS,
    nativeApi: 'stopAndCloseHostAsync(owner, code, deadlineMs, shutdownId)',
    cases: CASE_MATRIX, gaps: PREPARATION_GAPS,
    futureExecutionGate: {
      acknowledgement: EXECUTION_ACK, platform: 'win32', arch: 'x64',
      arguments: ['--run', '--ack', '--adapter', '--adapter-sha256', '--candidate', '--candidate-sha256'],
      requirement: 'Review and pin the complete adapter/native dependency closure; provide contained target, external watchdog, actual native fault evidence, and independent held Safety handles before using --run.',
    },
  };
}

async function bounded(call, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(call),
      new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error(label); error.code = label; reject(error); }, milliseconds); }),
    ]);
  } finally { clearTimeout(timer); }
}
function boundedReceipt(value) {
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, 'utf8') > LIMITS.receiptBytes) throw new Error('RECEIPT_SIZE_REFUSED');
  return JSON.parse(json);
}
async function pinnedFile(path, sha256, extension) {
  if (!isAbsolute(path) || !path.toLowerCase().endsWith(extension)) throw new Error('EXPLICIT_ABSOLUTE_ARTIFACT_PATH_REQUIRED');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('EXPLICIT_ARTIFACT_SHA256_REQUIRED');
  const bytes = await readFile(path);
  if (hash(bytes) !== sha256) throw new Error('PINNED_ARTIFACT_HASH_MISMATCH');
  return { path: resolve(path), sha256, bytes: bytes.length };
}

// Future execution only. Interface and order are specified in the contract file.
// A Promise timeout is not process containment; the reviewed adapter MUST supply
// the independent watchdog and cleanup even when target JS/native code is stuck.
export async function runHostAsyncCandidateProbe(options) {
  if (options?.ack !== EXECUTION_ACK) throw new Error('EXPLICIT_NATIVE_EXECUTION_ACK_REQUIRED');
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('WINDOWS_X64_REQUIRED');
  const adapterInput = await pinnedFile(options.adapter, options.adapterSha256, '.mjs');
  const candidate = await pinnedFile(options.candidate, options.candidateSha256, '.node');
  const adapter = await import(pathToFileURL(adapterInput.path).href);
  const adapterContract = requireAdapter(adapter);
  const workerUrl = new URL('./terminal-host-async-candidate-worker.mjs', import.meta.url).href;
  const report = {
    version: 1, status: 'OWNER_WIP_NATIVE_INCOMPLETE_NOT_ADMITTED', executed: true,
    admitted: false, independentReview: false, qualified: false,
    scope: API_SCOPE, sessionCleanupJoined: false,
    inputs: { adapter: adapterInput, candidate }, cases: [],
    gaps: ['Full production JavaScript Session cleanup join is UNIMPLEMENTED.'],
  };
  for (const spec of CASE_MATRIX) {
    const missing = spec.capabilities.filter(capability => !adapterContract.capabilities.includes(capability));
    if (missing.length) {
      report.cases.push({ caseId: spec.id, status: 'TECHNICAL_LIMITATION', executed: false, missingCapabilities: missing });
      continue;
    }
    const caseAbort = new AbortController();
    const caseTimer = setTimeout(() => caseAbort.abort(new Error('CASE_WALL_DEADLINE')), LIMITS.caseWallMs);
    const row = { caseId: spec.id, status: 'OWNER_WIP_NATIVE_FAILED_NOT_ADMITTED', executed: false,
      shutdownId: `host-async-${randomUUID()}`,
      before: null, worker: null, after: null, observation: null, cleanup: null,
      cleanupVerified: false, errors: [] };
    let controller = null;
    try {
      controller = await bounded(() => adapter.openCase({
        caseSpec: spec, candidate, workerUrl, limits: LIMITS,
        shutdownId: row.shutdownId, signal: caseAbort.signal,
      }), LIMITS.safetyOperationWallMs, 'ISOLATED_FIXTURE_START_TIMEOUT');
      requireController(controller);
      row.before = boundedReceipt(await bounded(() => controller.captureSafetyBeforeTrigger(), LIMITS.safetyOperationWallMs, 'INITIAL_SAFETY_TIMEOUT'));
      validateSafety(row.before, 'BEFORE_SHUTDOWN', spec);
      row.executed = true;
      const delivery = boundedReceipt(await bounded(() => controller.runCandidate(), LIMITS.operationWallMs, 'ISOLATED_NATIVE_OPERATION_TIMEOUT'));
      if (!Number.isInteger(delivery.sequence) || delivery.sequence <= row.before.sequence) throw new Error('WORKER_RECEIPT_ORDER');
      row.worker = delivery.workerReceipt;
      if (row.worker?.shutdownId !== row.shutdownId) throw new Error('WORKER_SHUTDOWN_ID_CORRELATION');
      row.workerReceiptSequence = delivery.sequence;
    } catch (error) { row.errors.push({ stage: 'candidate', ...failure(error) }); }
    finally {
      // Always attempt a fresh Safety observation BEFORE cleanup, including timeout.
      // If observation fails, cleanup is still mandatory, but this case stays failed.
      if (controller) {
        try {
          row.after = boundedReceipt(await bounded(() => controller.observeSafetyBeforeCleanup(), LIMITS.safetyOperationWallMs, 'PRE_CLEANUP_SAFETY_TIMEOUT'));
          validateSafety(row.after, 'BEFORE_SAFETY_CLEANUP', spec);
          if (row.workerReceiptSequence !== undefined && row.after.sequence <= row.workerReceiptSequence) throw new Error('PRE_CLEANUP_OBSERVATION_ORDER');
          if (row.errors.length === 0) row.observation = validateCaseObservation({ spec, before: row.before, after: row.after, worker: row.worker, candidateSha256: candidate.sha256 });
        } catch (error) { row.errors.push({ stage: 'pre-cleanup-observation', ...failure(error) }); }
        try {
          row.cleanup = boundedReceipt(await bounded(() => controller.cleanupSafety(), LIMITS.safetyOperationWallMs, 'SAFETY_CLEANUP_TIMEOUT'));
          // An absent/invalid pre-cleanup observation can never be repaired here.
          if (row.after) row.cleanupVerified = validateSafetyCleanup(row.cleanup, row.after.sequence).cleanupVerified;
          else throw new Error('SAFETY_OBSERVATION_MISSING_BEFORE_CLEANUP');
        } catch (error) { row.errors.push({ stage: 'safety-cleanup', ...failure(error) }); }
      }
      clearTimeout(caseTimer);
    }
    if (caseAbort.signal.aborted) row.errors.push({ stage: 'case-deadline', code: 'CASE_WALL_DEADLINE', message: 'Candidate observation exceeded its case ceiling; Safety cleanup does not repair it.' });
    if (row.errors.length === 0 && row.observation?.observed === true) row.status = 'OWNER_WIP_NATIVE_OBSERVED_NOT_ADMITTED';
    report.cases.push(row);
    if (!row.cleanupVerified) {
      report.abortedAfterCase = spec.id;
      report.gaps.push('Further cases were not started because independent Safety cleanup was not verified.');
      break;
    }
  }
  report.coverageComplete = report.cases.length === CASE_MATRIX.length && report.cases.every(row => row.status === 'OWNER_WIP_NATIVE_OBSERVED_NOT_ADMITTED');
  if (report.coverageComplete) report.status = 'OWNER_WIP_NATIVE_OBSERVED_NOT_ADMITTED';
  return report;
}

function parseArguments(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--describe')) return { describe: true };
  if (args[0] !== '--run') throw new Error('DESCRIBE_OR_EXPLICIT_RUN_REQUIRED');
  const keys = new Map([
    ['--ack', 'ack'], ['--adapter', 'adapter'], ['--adapter-sha256', 'adapterSha256'],
    ['--candidate', 'candidate'], ['--candidate-sha256', 'candidateSha256'],
  ]);
  const options = {};
  for (let index = 1; index < args.length; index += 2) {
    const key = keys.get(args[index]);
    if (!key || options[key] !== undefined || !args[index + 1]) throw new Error('PROBE_ARGUMENT_REFUSED');
    options[key] = args[index + 1];
  }
  if (Object.keys(options).length !== keys.size) throw new Error('PROBE_GATE_ARGUMENT_MISSING');
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const report = options.describe ? describeHostAsyncCandidateProbe() : await runHostAsyncCandidateProbe(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!options.describe && !report.coverageComplete) process.exitCode = 1;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ version: 1, status: 'OWNER_WIP_PROBE_REFUSED_NOT_ADMITTED', admitted: false, independentReview: false, qualified: false, error: failure(error) })}\n`);
    process.exitCode = 1;
  }
}
