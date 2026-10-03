# Hosted CI35 code-recovery timeout

Author: root implementing agent, 3 October 2026; not an independent approval.

Actual private branch HEAD `e0e4047794202de02b150e6eb5fa79a8cfcb869f` maps local356a598. Desktop run37119686313/job111193228816 FAILED; unit behavior538/538 and guarded renderer succeeded, native development step failed, development package skipped. Launcher26/run37119686365 succeeded separately. Prior CI34 success does not relabel CI35.

Artifact11272224811 `desktop-development-evidence` was downloaded and its ZIP SHA-256 matched GitHub metadata: `f721da7fb8d5e54acd646e0f208a9360369c02432872315713cf425d7ae44feb`. Original ZIP retained locally at `evidence/ci35/artifact.zip`. Exact code-recovery failure, log and prior screenshot retained without altering them.

Failure: `CDP timeout: Runtime.evaluate`, original20-second driver deadline, code-recovery fixture `2026-10-03T11-35-24.364Z`. Failure readback is revision5, selected hash `709ea8c476875073fd928e2df81f9b59a74dec983ee8cb2ba733e8b80f45968a`, containing the synthetic private Python draft. The screenshot visibly shows the editor and private recovery status before native Quit. A later UI observation also timed out. No exact failed expression/stage was recorded by that version of the probe. The precise cause remains **UNCONFIRMED**, and this is not classified as a false positive or a fixed product bug.

Diagnostic-only change records controlled phase/method/timestamps and the first failed command in a bounded32-command trace, excluding PIN, Python, expression arguments and response content. Original deadlines, real native draft/Quit/clean-close/restart assertions and product behavior are unchanged. The workflow retains `diagnostic.json`. Fresh local instrumented probe `evidence/code-recovery-2026-10-03T12-09-25.806Z` completed; it does not establish the old hosted cause or a new hosted PASS. No unchanged workflow rerun was requested.
