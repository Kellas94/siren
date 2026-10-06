# Independent limited recheck — legacy export cancellation and Lock drain

Author: `/root/media_batch_review`, 2026-10-06. I independently reviewed the uncommitted main/atomic correction against HEAD `518a3306404c031f3b6c48a92e567efbd7a95712`, executed my own extended Node/actual-filesystem probe, and ran focused existing tests. I changed no product, root test or generated input. This is a limited recheck of the demonstrated export/access/cleanup defects and the subsequent Lock integration finding. It is not a global PASS, release approval, native GUI evaluation, packaged verification or hosted CI approval.

No blocker was reproduced in this bounded recheck. The prior adverse report and result remain unchanged; this report records new evidence against new input hashes rather than rewriting that history.

## Reviewed identities

```text
src/main.mjs da8e340374e032dad4ab240d633d58a3ea403854264418b05e0dd1794c949e36
src/projects/atomic.mjs 803eb8c40edd5711bae3a51ade69ab935b779bae7d1ec6e8da5808dbeea77de4
tests/legacy-export-access.test.mjs 5cd930270d8986fd5c2647fe9968a5c75bca7f367ec5cb6dcdcc1c3a844094f0
tests/pin-ipc.test.mjs 28fc7996aab64907f8f7839e2dc4107d699bada65fc133db5d475c494a1a3a34
tests/recovery-save-diagnostics.test.mjs d4cdd52fb4c4b956668cc43a90745b3532f0faf568b6229c4c4b577d410ec039
tests/recovery-access.test.mjs 7ecf3e42f31b6cb2629f0d23c7a70444c634150c3b098de9e2e37d86cd35c795
evidence/export-access-correction-recheck-2026-10-06/probe.mjs 93d24978ccdd7ab9087948282bdc77bc841612f804e44d6fed77f4cd002ccf18
evidence/export-access-correction-recheck-2026-10-06/result.json 80402064f248751889312c0b3fe6f84c16915275b8ffb81d53b190b1e71d6b77
evidence/export-access-correction-recheck-2026-10-06/focused-units.log bb0964ff2e604f131b1b58d9b324b61f92359bc55b3c8bb3700c9c346f51fcd5
```

These three correction input hashes matched both before and after my checks. This is working-tree review, not review of a new immutable commit.

## Independent reproduction results

The new probe extracts the actual normalized main helper, preparation, rollback, export and Lock service bodies into a VM. Electron dialog, account/PIN state and workspace-owner interactions use controlled facades; the atomic writer and filesystem operations are real. In particular, a snapshot-null preparation branch alone does not drain exports: the probe invokes the actual extracted Lock service and observes its `Promise.all([...writes])` join. It does not exercise real PIN cryptography or the full native-window roster.

Node exited 0 with twelve expected observations, retained in the separate directory above:

- Pending project and recovery choosers remain revoked after actual extracted Lock followed by controlled unlock. A failed Lock/preparation rollback also leaves the old chooser revoked: the monotonic epoch is not restored.
- An already-renamed write remains tracked while its actual readback is held. Lock does not settle until the accepted write completes readback; then both succeed, with the committed destination intact.
- The exact prior adverse case is now corrected: pause before rename, start Lock, revoke the epoch, then release. Export returns `ACCESS_REFUSED`, existing destination bytes remain exact, the owned staging file is removed, tracked writes become empty, and actual extracted Lock returns `{ok:true}` with unlocked false.
- Read-only export and dialog cancellation preserve their intended behavior. A refused directory destination leaves no backup staging file in that ordinary cleanup case.
- Strict cleanup failure is exercised through real filesystem replacement: move the parent directory after staging, replace the old parent with a file, start Lock and release the writer. Cleanup returns `AggregateError` with `PENDING_CLEANUP_FAILED`; its nested errors retain both `ACCESS_REFUSED` and `Project path refused`. The moved parent still contains its original pending private bytes, the replacement file is untouched, and Lock returns `SAVE_FAILED` with unlocked true. This is an explicit refusal, not successful cleanup or successful Lock.
- A genuine OS rename failure after a valid publication check produces `EPERM`, not a normalized `ACCESS_REFUSED`. Staging cleanup succeeds, but the tracked operation still rejects and Lock returns `SAVE_FAILED`.
- An actual destination mutation after rename produces `Durable readback mismatch`. Neither export nor Lock falsely succeeds; the already-committed file is not deleted, and no stage remains.
- Existing atomic defaults remain distinct: a normal caller's pre-rename failure preserves its stage, while an existing `cleanupPending:true` caller removes the stage and retains its original error. Strict export cleanup is opt-in.

## Focused test execution and environment limitation

My initial exact four-file test run under the default sandbox TEMP path ended with 24 passing tests and one failed test-file process. `recovery-save-diagnostics.test.mjs` failed during esbuild setup because the sandbox denied reading `C:/Users/Taras`; the generated temporary entry could not resolve its parser/editor imports. This was a compiler/filesystem environment failure, not a completed failing application assertion. It is not silently counted as a passing run.

I then reran the same test files and unchanged source/test hashes, explicitly setting `TEMP` and `TMP` to the new workspace-local evidence `tmp` directory. Command: Node 24.16.0 `--test tests/legacy-export-access.test.mjs tests/pin-ipc.test.mjs tests/recovery-save-diagnostics.test.mjs tests/recovery-access.test.mjs`. This environment-adjusted run exited 0: **30 tests passed, zero failed**; its complete output is retained at the hashed log above. Eighteen of those are the root-authored legacy export regressions; my separate probe supplies the additional adversarial integration and actual-filesystem evidence rather than treating root tests as my own independently designed cases.

## Why the correction addresses the demonstrated findings

`src/main.mjs:198` now tracks the operation which normalizes only a clean `ACCESS_REFUSED` into a normal refusal. Actual storage/readback errors remain rejecting operations for the Lock drain. `src/projects/atomic.mjs:33` requires exact staging cleanup for these exports; cleanup failure is elevated to a distinct aggregate error before it can be mistaken for clean cancellation. `src/main.mjs:527` increments the epoch before preparation awaits, keeping revocation monotonic through rollback. No source-aware bundle encoding or recovery retention policy is changed in this correction.

This evidence addresses the small deterministic failure mechanisms previously demonstrated. It does not establish filesystem race freedom against an adversarial external process at every OS instruction, absence of all export defects, large-source performance, physical multi-monitor UX, or any explanation for earlier unrelated hosted UI timeouts. No GUI, package or hosted run was performed by me in this recheck.

## Preserved adverse evidence

```text
reviews/2026-10-06-legacy-export-access-correction-independent.md eb8540fce521f37a3f9128ae4c1d51f136822eed3548f26a4deaa7cc7767225c
evidence/export-access-correction-review-2026-10-06/result.json dfd298e52457543c524fad5feba519a3ab9ba889830e4c251f36459e36132317
```

I rechecked those identities after the new probes. Their original adverse findings remain intact and are not relabeled as passes.
