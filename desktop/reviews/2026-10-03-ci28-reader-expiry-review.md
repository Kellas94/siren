# CI28 reader expiry — independent review, 2026-10-03

The recorded CI28 failure is a legitimate expiry of the test's final fresh reader, after its pending-capacity assertion had succeeded. The test correction controls expiry deterministically while preserving the 10-ms TTL, one-reader capacity, real repository/model load, authorization path, closure assertion, and budget assertion. No product change is indicated by this failure. Independent controls confirm the revised test still detects premature capacity release.

This review does not convert the original CI result into a pass or claim native/package acceptance. It independently examines the recorded failure and the focused correction; the coordinator is running the complete corrected suite separately.

## Original failure retained

- CI28 run `37102970910`, desktop job `111145981867`: **407 tests, 406 passed, 1 failed**, zero cancelled/skipped/todo tests, `313336.7889 ms`, process exit **1**. The failing top-level case is numbered 215 in the job log. The supplied run status reports downstream native/package steps skipped and a separate launcher job with 19 successful tests; neither establishes desktop native/package acceptance for this failed run.
- The examined checkout log records merge `843bb9f` of remote head `90b37dcfc729c4dbaec1dd678249de3420c9532a` into `688c48528ff7bdab77908faf041806d10acc54dc`. Local review HEAD is `097c8c170952156eac68952c0465f10bd87f2333`; the remote head is not a locally available Git object. This review does not claim the entire local checkout equals that remote head.
- The retained decoded LF-normalized logs are [job.log](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28/job.log) and [job-111145981867-normalized.log](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/job-111145981867-normalized.log). Both independently hash to SHA-256 `4ee5eb4248ace742d112ff918bd97127ec43347cec8998e4e9297d274a94e5ab`.
- The original test Git blob at local HEAD hashes to `fa903252bfd588b797391688a5a6eca5e5d8b21e9d2a70a24d9f0a8f7f941bc1`. Its line 137 is `const fresh = await repo.openReader(request); fresh.dispose();`.

The original exception is `SOURCE_READER_CLOSED`, with frames at `readers.mjs:32:50`, `SourceReaderPool.open` at `readers.mjs:42:7`, and the test at `source-readers.test.mjs:137:17`. Product line 42 checks openness immediately after `await load()`. The earlier `assert.equal(outcome, 'SOURCE_READER_BUDGET')` is line 135, so the recorded failure happened after pending closure, the second open, and the capacity assertion had completed successfully.

The pool starts its timer before authorization and disk loading. With `ttlMs: 10`, a successful fresh load is not guaranteed to complete before expiry on a busy runner. The final open was admitted and then fenced while awaiting load. No elapsed per-load measurement is retained in CI, so the log proves the expiry boundary but does not identify disk latency versus event-loop scheduling as its finer cause.

## Correction reviewed

Only the pending-open case in `desktop/tests/source-readers.test.mjs` is changed for this correction. It registers pool cleanup, waits until the actual async authorization guard has entered, enables Node's per-test `setTimeout` clock, and advances it by 11 ms across the unchanged 10-ms expiry. The original open must still reject `SOURCE_READER_CLOSED`.

The second admission must return `SOURCE_READER_BUDGET` before a native `setImmediate` turn. If an expired but unsettled open wrongly releases its reservation, the second open enters the still-blocked real authorization path, and the sentinel becomes `ADMITTED_PENDING`. Both promises are settled before the assertion. After settlement, a real fresh disk load must recover capacity and return the imported SHA-256 and text `pending`. That load no longer depends on unrelated wall time beating 10 ms; no TTL is increased and no oracle is removed.

The product's guarded pending-reservation release remains unchanged: timeout closes access, while `opening` retains the reservation until `finally`. The inspected product reader SHA-256 is `c68d1efea2b205caa9d710bb1f5ea944b06a290080f4d83037d8a5768c8f684d`. The corrected tracked test SHA-256 is `1d86c920949b981581925f9afe333319f6d3005146c22c40c18c83eef7ebdded`.

## Verification and controls

The coordinator's retained [focused reader suite](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28/readers-focused.tap) reports **11/11 passed**, zero failures/cancellations/skips/todo, `2944.8845 ms`; its log SHA-256 is `bd978c6a6a58aafb7bd22571885265582a874ac9f0e3164f0bb1a44aac92332d`. This is a corrected focused local result, separate from the original failed CI run.

I independently ran three one-shot controls on Node `v24.16.0` in the ignored `desktop/evidence/ci28-reader-expiry-review/independent-resume` directory. [run-controls.mjs](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/independent-resume/run-controls.mjs) preserves copies and records [results.json](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/independent-resume/results.json). These controls do not edit product, tracked tests, or build inputs.

| Control | Actual result | What it establishes |
| --- | --- | --- |
| Unchanged reader with real repository/model, a deliberate 30-ms delay before the real disk load, TTL still 10 ms | [slow-load.tap](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/independent-resume/slow-load.tap): 1 passed, exit 0, `174.9165 ms` | The fresh open legitimately rejects `SOURCE_READER_CLOSED` at the same post-load reader line 42. A subsequent real fresh open under controlled expiry verifies the original hash and text. This demonstrates the mechanism, not the exact unmeasured CI delay. |
| Exact revised pending-open test, imports relocated only, unchanged copied reader | [green.tap](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/independent-resume/green.tap): 1 passed, exit 0, `132.4201 ms` | The corrected assertions pass with real repository/model behavior. |
| Same exact revised test, single isolated reader mutation from `if (!opening) this.#slots.delete(close)` to unconditional deletion | [red.tap](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci28-reader-expiry-review/independent-resume/red.tap): 1 failed, exit 1, `124.5956 ms` | The test rejects the specific capacity regression: expected `SOURCE_READER_BUDGET`, actual `ADMITTED_PENDING`. The red result is intentional evidence, not a product regression. |

Product reader and tracked test hashes were identical before and after all independent controls. There were no retries, deadline increases, test suppressions, or product/build changes in this review. No PIN or credentials were used.

## Scope and conclusion

No actionable product defect is demonstrated by this CI28 failure. The revised test is an appropriate correction to an incidental wall-clock assumption, and the independent mutation control shows that pending-capacity protection remains enforced by its oracle. The raw original FAIL remains evidence. This review covers the reader expiry mechanism and the test correction only; it does not supply a complete corrected suite result, native UI result, package result, or a remote CI rerun. Those require their own actual execution evidence.
