# Independent appearance replacement correction review — 2026-10-06

Author: Codex `/root/shared_workspace_review`. New read-only review and own execution evidence. No production source, repository test, generated output, workflow, UI oracle or deadline was edited by this reviewer. No Electron/package application was launched. All earlier reports and their before-correction evidence remain intact.

## Source identity and scope

Initial inspection read the uncommitted two-file diff over 8993013cf0f3c30dbb0fb6fd18eb4d6c5918dc77. Final source inspection independently resolved commit 8e16957e35c1a4a8b123f53d6c0bf32d04d8be74. Reviewed `src/appearance/store.mjs`, `src/projects/atomic.mjs`, their callers, and the expanded replacement tests. Final independently read SHA256:

- Store: `8741e13ba72a8f8711e8a719db3c2b6880b45d80549dfda589f9c583ea9f374e`.
- Atomic helper: `51acbcfcb3bb9699bfda1a9d53a04e31c21986784898ef32a33ec2af6b42a469`.
- Replacement tests: `cd23dbdb4767271426ca633e17f4920903b1c0244258c17c0668fd9374388b6b`.

Own fixture output is exclusively `C:/Claude/SIREN_WORK/tmp-appearance-replace-correction-review`. It imports actual production modules, performs assertions, and records complete results in `results.json`. The historical original report `reviews/2026-10-06-ci37405358959-appearance-rename-independent.md` remains SHA256 `4f4b9480d86ef9df8018e338db25d9b2d8db0d80c5102dc7029f1da9f7510af6`.

## Findings and implementation assessment

Critical: none established. Important: none established in the correction. Minor: none established in the inspected and executed scope.

The previously established transient Windows replace failure mechanism is addressed by an appearance-only retry transaction. The historical staging cleanup finding is addressed for ordinary uncommitted staging files owned by the transaction's exact generated path. These are local implementation results, not a declaration that the hosted failure has been repaired.

`AppearanceStore` opts into the new atomic replacement callback and cleanup at `store.mjs:26`. Source search found no other production cleanup/replacement opt-in. The root-keyed writer queue remains held across retries, so a later appearance choice cannot overtake the earlier intent. One flushed/closed staging file is reused. At `store.mjs:29-37`, rename alone may retry EPERM/EBUSY, at most three invocations with 20/40ms explicit inter-attempt waits. Validation, phase hooks, unexpected errors and durable readback failures are outside the retry catch. Before each invocation, the store rechecks the owned directory, regular staging/target paths and captured-current/write authority. Error phase distinguishes rename-validation, retry-wait and rename; only actual rename errors add a finite attempts count. Payload names, paths and content do not enter diagnostics.

`atomic.mjs:8` defaults to ordinary rename and cleanupPending=false. Generic callers retain one replacement invocation and their prior staging preservation behavior. At `atomic.mjs:23-26`, committed becomes true immediately after successful replacement and before the after-rename hook/readback. At `atomic.mjs:33-36`, opt-in cleanup only unlinks that transaction's validated staging path while uncommitted, without enumeration or destination deletion. If staging cleanup cannot be validated/performed, its exception is suppressed and the original failure is rethrown. Readback and digest behavior are preserved. A failure after successful rename is a refused acknowledgement of an already committed replacement, not rollback or justification for another rename.

Cleanup is intentionally best-effort: invalid/unavailable staging paths may remain, and previous unrelated staging files are not purged. Captured authority is rechecked before commit attempts; cancellation after successful rename cannot undo committed bytes. Neither caveat is presented as a newly established defect.

## Own targeted unit execution

Executed independently:

`node --test tests/appearance.test.mjs tests/appearance-replace.test.mjs tests/appearance-sync.test.mjs tests/appearance-lifecycle.test.mjs tests/navigation-store.test.mjs`

Observed 37 tests, 37 passed, 0 failed, 0 skipped; duration 2946.1479ms. The replacement file contained 12 cases at execution, including the later EBUSY queue and actual invokeShell transaction seams. These are own executions of repository tests, not independently authored test cases. They cover finite diagnostics, exact UUID staging sentinel preservation, hook/rename distinction, readback mismatch without replay/deletion, target invalidation during wait, cleanup-refusal error preservation, generic defaults, serialized intents, captured authority, and a genuine Windows rename failure/release. Navigation metadata tests exercise unchanged generic failure/readback/fence semantics. This is a targeted suite, not the owner's larger suite or release qualification.

## Own independently authored actual Windows fixture

`probe.mjs` creates four isolated data roots and seeds KPMG using unmodified AppearanceStore. A hidden temporary PowerShell helper holds each owned appearance.json with Read access and FileShare.ReadWrite, omitting Delete sharing. Every first rename refusal is captured from actual `node:fs/promises.rename` as EPERM with syscall=rename; no EPERM is fabricated. The injected replacement seam merely records/delegates the actual rename and coordinates the deliberately controlled release. Production 20/40ms delays are used without a mocked wait callback.

Each case adds an unrelated valid UUID staging file before the transaction, then asserts that its exact name/bytes survive while the attempted write's own uncommitted stage disappears. Complete receipts, actual rename errors, staging paths, diagnostics, target bytes and observations are retained locally.

| Owned Windows case | Receipt | Actual rename invocations | Target | Own failed stage | Unrelated UUID stage |
|---|---|---:|---|---|---|
| Handle released after genuine first EPERM | Success/Dark | 2 | Dark | None remaining | Retained |
| Handle held through all attempts | APPEARANCE_WRITE_FAILED | 3 | KPMG unchanged | Removed | Retained |
| Captured currentness retired during first delay | ACCESS_REFUSED | 1 | KPMG unchanged | Removed | Retained |
| Write authority revoked during first delay | ACCESS_REFUSED | 1 | KPMG unchanged | Removed | Retained |

Persistent failure emitted exactly `{phase:"rename",code:"EPERM",attempts:3}`. Both cancellation cases emitted rename-validation/ACCESS_REFUSED and made no second rename. They deliberately change captured-current/canWrite seams during the default delay; they do not exercise physical native Lock, IPC event timing or account transitions.

The same persistent held target was also passed to actual generic atomicWrite with its default replacement/cleanup settings. It refused rename/EPERM, preserved KPMG and retained its newly created staging file. Combined with the targeted callback-count test and inspected generic default, this verifies the unchanged single-invocation/preserved-stage semantics.

Recorded elapsed transaction times were approximately 185ms transient, 275ms persistent, 47ms retired and 38ms authority revoked. Three invocations and 60ms of explicit requested delay do not constitute a 60ms total wall-clock guarantee: filesystem operations, Windows behavior, scheduling and the controlled holder-release handshake contribute additional time. No UI or CI deadlines were changed or inferred.

All owned helper handles were disposed and helper processes exited 0 before reporting. These fixtures changed only isolated owned temporary files; no application/project/grant/packaged binary was touched.

## Evidence limits and retained original CI outcome

Hosted 37405358959 remains FINAL FAILURE in the retained original evidence. Its before-rename/EPERM boundary did not identify the exact hosted filesystem syscall or locker. This review validates the correction against the genuine Windows failure mechanism I independently demonstrated; it does not identify the CI actor, prove that every EPERM is transient, establish optimal delay values or prove the next copied/hosted run will succeed.

Owner full/native/copied/identity results are not my executions. No current-old-head CI status, production native Lock safety, public presentation pixel behavior, full package integrity, hosted repair or release PASS is claimed. The historical report and its original ZIP/log remain unchanged.