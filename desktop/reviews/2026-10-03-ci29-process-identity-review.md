# CI29 process identity — independent review, 2026-10-03

CI29 contains two real native identity-observation failures. Both tests fail at their initial, unmodified `inspectWindowsProcess` call, before the deliberate six-second delay or cancellation exercises. One failure records a cancelled PowerShell query at approximately the existing ten-second bound. The product correctly keeps unknown identity fail-closed. The hosted cause is unresolved: the retained log does not measure CPU saturation, native startup phases, test overlap, or other host contention.

One independently executed local control of the two exact tests with serialized file scheduling passed and verified real Unicode identity, bounded cancellation, readonly startup, and owned-child cleanup. This is separate evidence; **CI29 remains FAILED, 427/429 tests passed**. The independent reviewer edited only this report and ignored diagnostic harness/evidence. The coordinator subsequently changed workflow scheduling, described separately below.

## Original result and failure boundaries

- Hosted run `37105964051`, Desktop job `111154417846`, PR head `03b41e15fdc39538269bc467a940fb5d07a6ef93`. The checkout log identifies merge `5ad7fb0cd9bbffea2b4cd7b1cd550433d1394a3a` into base `688c48528ff7bdab77908faf041806d10acc54dc`.
- [Original normalized job log](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29/job.log): SHA-256 `3c3428500e43f531551c3771842ca825ece793ce89e595e6813ee205a1511303`, **429 tests, 427 pass, 2 fail**, zero cancelled/skipped/todo tests, `373774.0724 ms`, process exit **1**. The original log hash remained unchanged after the local control.
- The supplied run status reports native/package steps skipped and a separate Launcher result of 20 successful tests. Launcher success does not establish Desktop native/package acceptance. The local workflow also shows native and package steps gated behind successful unit execution.
- Review-time local HEAD was `837e379862b91a3af250b53ed1a2637432337ada`. This review identifies the inspected inputs by hashes below and does not assert that the whole local checkout equals the hosted merge.

| Hosted failure | Exact observed boundary | Supported conclusion |
| --- | --- | --- |
| `process-identity-deadline.test.mjs`, top-level case 100, `10733.2883 ms` | [Initial identity assertion at line 55](C:/Claude/SIREN_WORK/portable/desktop/tests/process-identity-deadline.test.mjs:55): `first?.pid` was undefined, expected owned child PID 5172 | The initial unmodified observation failed. The six-second and twelve-second delayed inspectors were not reached. This first call has no diagnostic hook, so its exact failure type is unrecorded. Duration is consistent with a ten-second query cancellation, but that cause is not directly established for this case. |
| `process-identity.test.mjs`, top-level case 101, `10772.5559 ms` | [Initial identity assertion at line 23](C:/Claude/SIREN_WORK/portable/desktop/tests/process-identity.test.mjs:23): `first?.pid` was undefined, expected owned child PID 8340. Diagnostic: `name: Error`, `code: null`, `killed: true`, `signal: SIGTERM` | A native query was cancelled and returned unknown identity. The diagnostic and elapsed test time are consistent with `execFile`'s ten-second timeout. The log does not establish which host activity caused the query to miss its bound. Unicode-path equality, repeated stable identity, and session checks were not reached. |

Both tests obtain the copied Unicode Node fixture's stdout before the first query. Their `finally` blocks kill only that owned fixture child and await its exit. The failure log supplies no per-query startup timing or detailed child-exit trace; it should not be used to infer precise concurrent scheduling from TAP publication timestamps.

## Product behavior and deadline

[inspectWindowsProcess](C:/Claude/SIREN_WORK/portable/desktop/src/recovery/processes.mjs:6) validates the PID, performs a native `Get-Process` query with explicit UTF-8 stdout encoding, and compares real path/start-time observations. Its external query retains `windowsHide: true`, `timeout: 10000`, and a bounded output buffer. It returns `undefined` on query failure or unknown path, while an actual absent process returns `null`. An optional trusted diagnostic hook cannot grant identity.

Unknown identity has meaningful product consequences: [main startup](C:/Claude/SIREN_WORK/portable/desktop/src/main.mjs:52) chooses readonly when it cannot observe its own identity; [SessionJournal](C:/Claude/SIREN_WORK/portable/desktop/src/recovery/sessions.mjs:39) selects readonly when a previous process cannot be verified; [writer-lock reclamation](C:/Claude/SIREN_WORK/portable/desktop/src/projects/atomic.mjs:48) refuses to reclaim an unknown owner. These are the correct safety outcomes. A repeated real-world query failure could still impair writable startup, so this review does not dismiss the hosted failures as harmless or prove that only test orchestration is at fault.

Retain the ten-second product deadline and the distinction between unknown and dead. Increasing the deadline, treating undefined as dead, retrying the unchanged suite until it passes, or suppressing these assertions would not resolve the missing causal evidence.

## Independent local control

I ran exactly one local serialized execution, with Node `v24.16.0` on Windows:

```text
node --test --test-concurrency=1 --test-reporter=tap tests/process-identity-deadline.test.mjs tests/process-identity.test.mjs
```

The exact tracked tests were executed from `desktop`; there were no test copies, assertion edits, retries, or deadline changes. An inherited Node import supplied owned process/query tracing only. The [runner](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/run-serialized.mjs) and [tracing module](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/trace-native.mjs) live in ignored evidence. The tracer delegates to the actual `spawn` and promisified `execFile`, preserves their options and returned child/process results, and adds query completion and child-exit observations. Its small tracing overhead and the different local host remain limits of the comparison.

- [Serialized result](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/serialized-result.json): start `2026-10-03T07:31:29.987Z`, finish `07:32:02.990Z`, wall time `33002.5156 ms`, process exit **0**, input hashes identical before/after. Local `availableParallelism` was 32; no local host-idle or saturation measurement was taken.
- [Original-test TAP](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/serialized-original-tests.tap): **2 passed, 0 failed**, zero skips/cancellations/todo, `32950.3294 ms`. SHA-256 `7457adb5ccf2e25216cd9a8c81d282276fe7f56964fe083d0d072e559b635ff8`.
- [Deadline test's own result](C:/Claude/SIREN_WORK/portable/desktop/evidence/process-identity-deadline-2026-10-03T07-31-30.086Z/result.json): actual six-second injection completed in `6347.5893 ms`; the two twelve-second injections were cancelled after `10030.1467 ms` and `10025.607 ms`, both `killed: true`, `SIGTERM`. The fixture child stayed live across both cancellations, retained its exact Unicode identity afterward, and the actual journal returned readonly for unknown identity. `completed` is true.
- [Deadline native trace](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/native-19288.ndjson): first unmodified query completed in `328.6965 ms`; all five PowerShell query exits are recorded. The owned Node child PID 33144 received the test's `SIGTERM` cleanup and exited.
- [Unicode identity trace](C:/Claude/SIREN_WORK/portable/desktop/evidence/ci29-process-identity-review/native-33080.ndjson): first unmodified query completed in `329.3091 ms`; repeated identity and normal-session checks passed. The owned Node child PID 27432 received cleanup and exited; the subsequent native query returned absent identity. All four PowerShell query exits are recorded.

The local pass demonstrates that the unchanged product and assertions can satisfy their intended native behavior under this local serialized schedule. It is neither an unchanged hosted rerun nor an experiment isolating contention on the CI29 host.

## Workflow assessment and next validation

The CI29/pre-change [workflow](C:/Claude/SIREN_WORK/portable/.github/workflows/desktop-verify.yml), identified by the control snapshot hash below, ran `node --test --test-reporter=tap tests/*.test.mjs` with no explicit file-concurrency limit, and included these native PowerShell probes in the same unit phase as the expanded suite. The pinned local Node 24.16.0 runner implementation defaults CLI file concurrency to `max(availableParallelism() - 1, 1)`. The hosted log does not report its processor-derived limit or active worker count, so neither simultaneous execution of these two probes nor resource saturation is established here.

A dedicated, strictly failing serialized phase for these two native identity tests is a justified validation improvement to try. Run it once per CI attempt, retain both original tests and all cancellation/readonly assertions, and make its failure block native/package acceptance. The remaining unit selection must account explicitly for both extracted files so that no coverage silently disappears. Log native phase start/end, query outcome/elapsed time, and the first deadline test's diagnostic failure type in the next hosted attempt. Any scheduling change is a proposed experiment until that hosted result is actually observed.

Alternatively, an explicit bounded unit file-concurrency setting would make orchestration reproducible. Its value and overall twelve-minute step budget need measurement; serializing the entire expanded suite is not proven to fit that budget. Neither option warrants altering the product deadline. If a dedicated native phase still misses ten seconds, investigate native startup/query stages and the host before changing product semantics.

After the independent control completed, the coordinator implemented two sequential phases within the existing unit step: these two exact identity files run once with `--test-concurrency=1`, followed by every other unit file once under normal scheduling. Both phase exit codes are aggregated into a failing step if either fails; the native identity log is retained as a separate artifact input. I read that workflow diff and checked the current file selection: 53 total test files, two identity files plus 51 remaining, no missing/duplicate selection. The amended workflow snapshot SHA-256 is `bd161357e0416e5db87d1c09f86227df906897404adfd00a69b62d2144f5c303`. Product process code and both identity tests retain their original hashes. This is an orchestration experiment; complete newest-input execution and new hosted qualification are pending, and no outcome is attributed to it here.

## Inspected input hashes and scope

| Input | SHA-256 before and after control |
| --- | --- |
| `desktop/src/recovery/processes.mjs` | `5fce0c2e0a733d41daf1c4fa5fbbbfbdb1b9f7e2e170dd653f5c58c3295e9e1b` |
| `desktop/src/recovery/sessions.mjs` | `8561a54eb16b8eb101c3f12bfebf8c91f299dfc1961c6ace4a5c70c3137ee6bf` |
| `desktop/tests/process-identity.test.mjs` | `bad01d0427543282e8e0921d14bd00bac8fcec9f317c31c121fbcaf897552f56` |
| `desktop/tests/process-identity-deadline.test.mjs` | `0e3e892c0e5cc4a298709553170fbcb1398fd79bd0da2c8596158dc03eaf0aa6` |
| `.github/workflows/desktop-verify.yml` during independent control, before coordinator's scheduling amendment | `6e62597c0cf1fd2f22a03680a9a03fb98a7539cd490c69fe41a7770b169d9cc1` |

The review retains the original FAIL, establishes the exact observed failure boundaries and preserved fail-closed behavior, and records a separate successful native control. It does not confirm hosted contention, provide a complete local suite result, replace a hosted CI attempt, or supply Desktop native/package acceptance. No production PIN or secrets were used.
