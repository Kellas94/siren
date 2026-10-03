# Independent review of the native stop-loading correction

The two-line helper correction resolves the measured missed-event sequence at code-test level. Independent tests reproduce the old helper's refusal and pass against the corrected helper, including invalidation between stop-loading and its queued continuation. **No new native package was run, and the failed `c6fa8d3` package remains unqualified.** This is a narrow code review, not package or Windows1 admission.

## Evidence and correction reviewed

The unchanged package qualification remains FAILED in `desktop/evidence/packaged-2026-10-02T23-10-17.436Z/`. The separate observational reproduction remains FAILED in `desktop/evidence/packaged-2026-10-02T23-14-43.400Z/`. Neither was rewritten, rerun, or reclassified. Their independent review is `desktop/reviews/2026-10-03-readiness-package-independent-review.md`.

Observed native order was setup request while main-frame loading, `did-finish-load` with loading true, `did-stop-loading` one millisecond later with loading false, and `WORKSPACE_NOT_READY` refusal at the existing ten-second deadline. This differs from the old `1e11a4` reload stall, whose native blocking stack remains unknown.

The reviewed diff adds a `did-stop-loading` subscription to the existing `finish` callback and removes that listener in existing cleanup. It preserves the live-target/native-loading state check, invalidation flag, pre-operation recheck, ten-second maximum timeout, and rejection semantics. The stop event cannot by itself admit the operation while native loading remains true. No unrelated helper behavior changed in the reviewed source diff.

The product helper and product regression were written by the parent, not this reviewer. This reviewer independently inspected the actual diff, ran the helper/integration suites, and created separate assertions under ignored evidence. No product file was modified.

## Fresh independent execution

Node `v24.16.0`, Windows, from `portable/desktop`.

1. **Independent RED:** the observed finish(true) → stop(false) invariant against a preserved copy of the committed `c6fa8d3` helper: **1 test, 0 passes, 1 failure**, exit 1, 94.2281 ms total. It refused with `WORKSPACE_NOT_READY` at the test's 30 ms bound. No product source was reverted to perform this check.
2. **Independent GREEN:** the same invariant plus continuation/refusal assertions against the corrected actual helper: **8 tests, 8 passes, 0 failures**, exit 0, 86.4034 ms.
3. **Product focused suites:** actual helper and source-extracted actual native PIN-service integration: **10 tests, 10 passes, 0 failures**, exit 0, 81.5652 ms.

Commands:

```powershell
$env:SIREN_REVIEW_READINESS = './c6fa-readiness.mjs'
node --test --test-name-pattern 'observed native finish' evidence/readiness-stop-event-code-review/continuation.test.mjs
```

The RED command used its own shell process; the override did not carry into subsequent calls. GREEN and integration commands were:

```text
node --test evidence/readiness-stop-event-code-review/continuation.test.mjs
node --test tests/workspace-readiness.test.mjs tests/workspace-readiness-integration.test.mjs
```

`node --check src/windows/readiness.mjs` and `git diff --check` for the helper and product regression both completed without errors. The parent's separately reported 21-test run and earlier RED result are not substituted for these independent results. No full suite or native process launch was performed by this review.

## Independent continuation coverage

| Case | Verified result |
| --- | --- |
| Measured finish(true), then stop(false) | No operation before loading clears; exactly one operation and acknowledgement afterward |
| Crash immediately after stop, before await continuation | `WORKSPACE_NOT_READY`, zero operation calls |
| Main-frame load failure immediately after stop | Refusal, zero operation calls |
| Main-frame navigation immediately after stop | Refusal, zero operation calls |
| Destruction immediately after stop | Refusal, zero operation calls |
| Silent native state invalidation after stop | Destroyed target, wrong URL, loading again, and native query exception each refuse before mutation |
| Stop emitted while loading remains true | No admission; later verified finish may admit once |
| Main-frame aborted load followed by stop | Refusal remains authoritative; stop does not override failure |

Every independent case verifies all readiness listeners are removed. Additional repeated finish/stop events after the acknowledged success cannot invoke the operation again. These are eight suite tests, some with a table of multiple state changes; they are synthetic checks using the actual helper API, not native scenarios.

The continuation checks target invalidation after readiness resolves but before the operation begins. They do not claim cancellation or rollback of an operation that has already started, nor changes to native PIN-write transaction semantics.

## Reviewed file identities and disposition

| Artifact | SHA256 |
| --- | --- |
| Corrected actual helper | `f3b6c8e873f917db4195a340795ca781073c156042c301590b50d921f5f04d2e` |
| Product readiness unit test | `87d431279044a4a29119ec7d45cff16a00b43dc54e5eed6def6605b5841a9874` |
| Product readiness integration test | `1a47c3febe8b5231b4055020bc5c820ee93ca48159057bfa64d848897d1b9aae` |
| Independent evidence test | `6eceebe57b7f51c99ace8d235bd94f653293255cce913a2c4b5e475c7faf2c64` |
| Immutable old helper used for RED | `02a111bbab90dfb5eff482153396391b7405ac2bbc6f47178158fb8ab46e53fc` |

No actionable defect was found in the two-line correction within this scope. The measured helper event-order bug is resolved by independent synthetic tests. A fresh immutable committed package and unchanged native probe are still required before package qualification; the existing failed package and its observational failure continue to count as failures. This review does not admit native terminal ownership, windows/editors, release installation, launcher behavior, online account behavior, or clean-PC execution.
