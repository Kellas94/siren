# Independent process-identity CI20/deadline review — 2026-10-02

Author: reviewer agent `/root/review_native_launcher`. I authored only `desktop/tests/process-identity-deadline.test.mjs`, `desktop/reviews/native-process-identity-diagnostic.mjs` and this report for this task. The coordinator owns the inspector deadline/diagnostic-hook changes and original fixture change. No policy bypass, process-name termination, product edit or fixture-oracle weakening was performed by this reviewer.

**Disposition: a real five-second query-deadline failure was independently reproduced for controlled native startup latency; the owner's bounded ten-second change passed strict identity and fail-closed cancellation tests. The original CI20 failure cause remains unclassified, and a new CI run is still required.**

## Original CI evidence and uncertainty

I independently read the coordinator-provided decoded job log at `.superpowers/sdd/2026-10-02-siren-portable-foundation-v2/ci20-failure.log`, SHA-256 `292918ffcb56e3f709ea0c45f1f6b718404a4bd4d7bb52ab92443a848a8d2237`. I did not independently download/authenticate that log through GitHub in this task; the supplied binding is run `37041533572`, job `110952572569`.

The log reports checkout of PR merge `3e930ef95a7408e4976b9e3e97911cc8a6f6a8af`, merging head `3f3be6708cabbc93270b0d103210c2a12e0edb33` into `688c48528ff7bdab77908faf041806d10acc54dc`. It records 111 unit tests: 110 passed, one failed, none skipped/cancelled. The failure is the real Windows Unicode process-identity test, duration 5,770.406 ms, at its first `first?.pid` assertion: actual undefined versus expected PID 5316. The job then exits its unit step with code 1 and uploads retained evidence; no later renderer/native/package execution is evidenced by this failed log.

The asserted expression is `first?.pid`. Its undefined value does **not** prove the inspector itself returned undefined: a null observation from a dead process also produces that assertion value. The log has no query-duration measurement, native error code/signal, stdout/parse outcome or pre-cleanup child-exit state. Total test duration includes fixture setup, child startup, query and finally cleanup. A five-second query cancellation is compatible with that duration, but timing alone does not establish it as the CI cause. Ordered test reporting also does not prove an exact host-load sequence.

The fixture creates a real copied Node executable in `Știință-日本`, reads the child's actual `process.execPath`, and keeps it alive with `setInterval`. It deliberately kills that owned child only in finally, after assertions. There is no intended early exit, but the retained CI log cannot exclude an external exit or native query failure. The original strict PID/full Unicode path/stable creation-time/dead-process-null checks remain intact. Empty or unknown observations are not accepted as success.

## Independently measured native diagnostic

`node reviews/native-process-identity-diagnostic.mjs` completed successfully at `desktop/evidence/independent-process-identity-2026-10-02T17-40-57.551Z/`.

Three unmodified production queries against one owned `Știință-日本-Україна-😀` executable took 283.6, 215.3 and 222.5 ms and returned exactly the same actual PID, full executable path and creation time. Direct executions of the same PowerShell query took about 218–228 ms. A deliberately added 5,500 ms delay with the existing five-second native deadline was cancelled at 5,020.7 ms, with `killed:true`, `SIGTERM`, no JSON, while the owned child remained alive. The identical delayed query with a ten-second deadline returned the exact identity in 5,737.9 ms.

This is a controlled latency experiment on this local Windows host. It establishes a possible mechanism, not the state or cause of the original CI runner.

## Meaningful exact-source RED and current GREEN

The new unit test reads and executes the actual `inspectWindowsProcess` function source in a VM. Its only substituted boundary wraps **real** `execFile('powershell.exe', ...)`, prepending an owned `Start-Sleep` to the command. The original command body, actual PID, native result and product options remain real; the test does not return a fabricated identity. Cross-realm identity normalization preserves all keys/values and separately asserts PID, full path and exact creation time.

Two retained preliminary test runs failed on harness construction: the source-signature extraction marker lagged the owner's new optional hook, and an array equality assertion crossed VM realms. These were corrected in the test harness and are not claimed as product RED evidence. Their receipts remain in `desktop/evidence/process-identity-deadline-2026-10-02T17-43-54.534Z/` and `desktop/evidence/process-identity-deadline-2026-10-02T17-44-24.516Z/`. No receipt was overwritten.

The valid five-second RED is retained at `desktop/evidence/process-identity-deadline-2026-10-02T17-45-45.162Z/`: six seconds of controlled startup latency caused real query cancellation at 5,025.8 ms. The trusted failure hook recorded `{name:'Error',code:null,killed:true,signal:'SIGTERM'}`. The inspector returned unknown, while child PID 37080 remained alive. A fresh unmodified query after cancellation returned exactly the same full Unicode path/PID/creation time as before. The test failed its live-identity assertion. This validates the deadline failure independently of any claim about CI20.

After that RED, the owner changed the product deadline to 10,000 ms. I independently ran `node --test tests/process-identity-deadline.test.mjs`: one passed, none failed/skipped/cancelled, duration 28,784.094 ms; evidence `desktop/evidence/process-identity-deadline-2026-10-02T17-47-42.260Z/`.

- Six seconds of controlled native startup completed at 6,233.1 ms with the exact actual child identity and no failure diagnostic.
- A 12-second delayed native query was genuinely cancelled at 10,030.1 ms and returned unknown; its hook reported killed/SIGTERM.
- A second actual 12-second query during `SessionJournal.inspectStartup()` was cancelled at 10,024.0 ms and produced readonly startup, rather than falsely establishing a writable identity.
- The same owned child remained live throughout and a fresh production query still matched its exact original PID/path/creation time. Cleanup killed only this fixture child.

I also independently ran the original strict `node --test tests/process-identity.test.mjs`: one passed, none failed/skipped/cancelled, duration 2,793.693 ms. It retains exact Unicode identity, stable creation time, normal journal recognition and dead-process null behavior. I did not independently run the full 111-test suite in this task.

## Current bindings and assessment

| File | SHA-256 |
| --- | --- |
| Owner's current `desktop/src/recovery/processes.mjs` | `5fce0c2e0a733d41daf1c4fa5fbbbfbdb1b9f7e2e170dd653f5c58c3295e9e1b` |
| Current original `desktop/tests/process-identity.test.mjs` | `bad01d0427543282e8e0921d14bd00bac8fcec9f317c31c121fbcaf897552f56` |
| Reviewer-owned `desktop/tests/process-identity-deadline.test.mjs` | `0e3e892c0e5cc4a298709553170fbcb1398fd79bd0da2c8596158dc03eaf0aa6` |
| Reviewer-owned `desktop/reviews/native-process-identity-diagnostic.mjs` | `e576d012700dab0877f773e332586db4e62d37207c98f87cea69bc51b41b2330` |

The current inspector adds a trusted optional failure hook containing only name/code/killed/signal; it does not log by default or include paths/command/stdout. Hook exceptions cannot grant identity. The original fixture prints only its owned PID plus those metadata on failure. The finite deadline change preserves all query/identity oracles, catches all query failures as unknown, and preserves unknown-to-readonly safety. It allows longer native startup while increasing the maximum wait for a failed query; it is not a retry, empty-observation acceptance or safety bypass. The new test has a bounded 60-second harness timeout.

This review closes the controlled six-second deadline case. It does not close the unclassified original CI20 cause, establish current CI green, qualify every host-load profile, or admit signed updates, launcher races, clean-PC portability or a production release. A future CI observation with the added fixture diagnostic is needed to classify any recurrence.
