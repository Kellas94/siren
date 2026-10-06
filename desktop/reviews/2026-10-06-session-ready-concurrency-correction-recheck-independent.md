# Independent limited recheck: session journal and ready fence correction

Author: `/root/native_menu_trace_review`, 2026-10-06. Separate post-change review; no product/test/generated edit and no GUI/package/hosted run. The pre-correction report, regression and source snapshots are preserved unchanged.

**Verdict: no blocking finding within this focused four-file correction.** The journal serializes its complete read-modify-write/readback sequence, and the main handler prevents duplicate readiness work during its pending operation. Genuine write failures still reach the caller and select readonly. The passive shell additions retain the existing action sequence, assertions and deadlines.

This verdict qualifies the inspected local implementation and tests below. It does not identify concurrency as the cause of original hosted run `37526593560`, change that original adverse result, establish native/package/hosted qualification, or qualify unrelated export work.

## Exact reviewed bytes

Hashes were independently calculated before execution and rechecked afterward with no drift.

| File, relative to desktop | SHA-256 |
| --- | --- |
| `src/main.mjs` | `afb62f83614e8536893d0531c6635be257e9ba80f981fedc9948bde6ceedac0a` |
| `src/recovery/sessions.mjs` | `e3d0dd9c67c09194ea8fd1886832b1d40a063d2c83b6f239ce6c9cb2e03cc333` |
| `tests/session-journal-concurrency.test.mjs` | `9b05b8b2852213238b05ed9751064428c9527bb079666033b633a36b744aa189` |
| `tests/native/shell.mjs` | `6c2d8421e38b415b3e135178bd491f64332ffc1c09eb048f7d02c4999b433259` |

`SessionJournal.#records` queues the entire private `#recordSession` body. Later calls therefore cannot read stale history or replace the destination while an earlier record is being verified. The returned `operation` retains its rejection for the caller; the separately caught queue tail only permits a later explicitly requested operation to run. It does not turn the failed operation into success or retry it. Existing validation, damaged-journal preservation, retention and real atomic verification remain in that private body.

The queue is per journal instance, not a cross-process lock. Main constructs a single shared `SessionJournal` at line 116; that is the scope addressed by the correction. This review does not claim protection against independent writers using other journal instances or external processes.

`readyRecording` is checked alongside the original ownership/frame/URL guards and set before the first await. It is cleared in finally, while `readyRecorded` is set only after successful publication. A real failure retains the existing readonly reason and safety notice. A later successful ready operation does not restore normal mode or clear the safety fence.

The shell diff adds only a string-or-null `reason` property, limited to 180 characters, to the two existing startup/failure evaluation expressions. It adds no CDP request, retry, action or new deadline. The normal-startup assertion is unchanged. This makes future reasons machine-readable without using readonly/recovery as successful shell admission.

## Independent execution

With Node `v24.16.0`, I independently ran:

`node --test tests/session-journal-concurrency.test.mjs tests/recovery.test.mjs`

Result: **10 tests passed, 0 failed, 0 skipped**. These include concurrent opened/ready/clean-close request order; genuine filesystem refusal followed by an explicit subsequent write; duplicate ready success/failure handling; recovery retention/corruption; killed-writer phases; and fail-closed process/session inspection. `node --check tests/native/shell.mjs` and focused `git diff --check` also passed. Git emitted only its ordinary CRLF-to-LF warning.

I additionally authored and executed a separate independent probe, without changing or rerunning the original pre-correction probe:

`node evidence/session-ready-concurrency-recheck-independent-2026-10-06/probe.mjs`

It captures the four reviewed files, executes the actual corrected SessionJournal class body in a VM with actual owned filesystem helpers and actual imported atomicWrite, and uses only an existing atomic fault callback as a phase pause. The actual corrected main ready-handler body is independently extracted into a VM for its guard/safety cases.

| Additional independent case | Observed result |
| --- | --- |
| Different ready timestamps; A paused after actual rename before readback, then B submitted | Only seed and A have entered atomicWrite while A is paused; B cannot enter. After release both ready operations fulfill, retaining opened plus both distinct timestamps in order. The pre-correction competing replacement is prevented. |
| Actual main handler: wrong sender, wrong frame, wrong URL; then pending duplicate, genuine failure and later valid success | Invalid targets cause zero journal calls. The duplicate during a pending operation causes no second call. The first genuine failure sends one safety notice and sets readonly. A later valid success can record readiness, but mode, bootstrap and nativeReadonly remain fenced; final readyRecording is false. |

The main-handler adapter simulates a refused journal operation; it is not presented as real IO. The separate journal case uses genuine filesystem writes/readbacks and no injected IO error. Together with the parent-authored real-filesystem refusal test, they cover distinct ordering and failure-preservation requirements.

Independent probe artifacts, relative to desktop:

| Artifact | SHA-256 |
| --- | --- |
| `evidence/session-ready-concurrency-recheck-independent-2026-10-06/probe.mjs` | `5ac6b2a8b6b8b86263f8953bc9b30028177d31af1bc988b2c24f5346c75374dc` |
| Same directory, `result.json` | `7840ff5d918d081fe70fd7caf492942782c6460355f80474bf319be7050e9c05` |

Complete phase records, state, journal events and reviewed source snapshots are retained there. Result status is `PASS`, with two additional independent cases.

## Evidence boundaries retained

The original independent defect report hash remains `16a2d052a3312ff65748e7b5ccdd68558ad733a3a39de66d039553b7f86c35d2`; its original real-writer regression result hash remains `e473a24d9a380cefee17b842423690591e0052063f6132f4df0f90384403daf3`, both rechecked. That report pins the original hosted screenshot to the readiness-journal catch but explicitly does not prove its concurrent-write history.

The correction addresses the separately reproduced same-instance ordering defect. No instrumented Electron lifecycle, native package copy, fresh hosted startup or full-suite result was independently executed in this review. Root must retain those as separate evidence classes. No release, merge or installed replacement is approved by this limited recheck.
