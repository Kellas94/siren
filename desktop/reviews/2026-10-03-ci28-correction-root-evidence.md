# CI28 deterministic reader expiry correction — coordinator evidence

Author: root coordinator, 3 October 2026. This report records root's own verification; the independent evaluator authored `2026-10-03-ci28-reader-expiry-review.md` separately.

Hosted Desktop CI28 run `37102970910`, job `111145981867`, head `90b37dcfc729c4dbaec1dd678249de3420c9532a` remains FAILED: 407 tests, 406 passed, one failed, exit 1, 313336.7889 ms. Native/package steps were skipped; the separate Launcher CI19 succeeded. Decoded LF-normalized job log `evidence/ci28/job.log` SHA-256 is `4ee5eb4248ace742d112ff918bd97127ec43347cec8998e4e9297d274a94e5ab`; this identity is not a raw artifact ZIP hash.

The failed case had already passed its capacity assertion. Its final fresh real repository load exceeded the test's 10-ms expiry boundary and correctly rejected `SOURCE_READER_CLOSED` at reader line 42, after `await load()`, called from original test line 137. The log does not measure disk versus scheduling latency. No product fault is demonstrated by this final open.

Only the tracked pending-open test changes. It waits for the actual authorization guard to enter, advances Node's mocked `setTimeout` clock by 11 ms across the unchanged 10-ms TTL, checks closure and uses a real `setImmediate` sentinel to detect an improperly admitted second open. After both pending calls settle it independently checks fresh disk text `pending` and the original imported source hash. Cleanup is registered with the test. Product code, default TTL, capacity and access fencing remain unchanged. The test preserves the original budget oracle and adds exact readback.

Root verification, single executions:

| Scope | Retained output | Actual result |
| --- | --- | --- |
| Focused reader suite | `evidence/ci28/readers-focused.tap` | 11/11, exit 0, 2944.8845 ms |
| Full frozen unit/build suite | `evidence/ci28-corrected-suite.log`, start/result JSON | 407/407, exit 0, 181075.8989 ms, zero fail/skip/cancel/todo, captured inputs unchanged |

Full suite started `2026-10-03T06:50:39.839Z`, completed `2026-10-03T06:53:40.976Z`; log SHA-256 `7a449752209a5d134cf346048c6166dcc0ca5fb59283cffbe31a87064501f892`. Frozen inputs include recursive source/build/tests, manifest/lock, package builder, baseline and editor dependency inventory. The final result's `changedInputs` is empty. Source reader SHA-256 is `c68d1efea2b205caa9d710bb1f5ea944b06a290080f4d83037d8a5768c8f684d`; corrected raw test is `1d86c920949b981581925f9afe333319f6d3005146c22c40c18c83eef7ebdded`. Git newline normalization is a distinct committed identity, not a native test execution claim.

The independent evaluator's retained real-model slow-load, corrected GREEN and premature-reservation-release RED controls establish mechanism and oracle strength; their author, exact results and unchanged-input hashes are in the separately authored report. Root did not write an independent approval on that agent's behalf.

This is corrected local unit/build evidence only. It does not convert CI28 to PASS, execute the production editor, qualify a new binary, or establish native/physical multi-monitor acceptance. No unchanged failing run was retried, timeout increased or test suppressed for this correction.
