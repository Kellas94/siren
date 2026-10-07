# Independent review — hosted identity adverse, stderr refusal and Unicode capacity

Author: `/root/workspace_surface_review`. Date: 2026-10-05. Scope: original first-package artifacts from hosted run 37364770356; the independently demonstrated stderr-to-missing process-identity defect and its current minimal correction; retained root Unicode-capacity evidence. No Electron execution, remote workflow execution, broad suite or package qualification was performed by this reviewer.

**Verdict: the hosted first-package failure remains ADVERSE. The separate stderr refusal is corrected for the inspected local contract; the zero-output hosted cancellation cause remains OPEN.** The Unicode evidence supports its four repository/reader cases, within the limits below. Historical reports and original evidence were not modified.

## Original hosted first-package evidence

I independently parsed the original ZIP central directory, inflated every entry in memory and compared each entry byte-for-byte with its retained expanded file. All seven entries match. Artifact metadata identifies artifact 11367519981, run 37364770356, head `1575b58ba9ef0e54fd010a9601215419aeec1d41`. The ZIP is exactly 104,318 bytes and SHA-256 `d94dba6db5a3b9f079dd0247a059e07bb764e7ff32ba382a0bc63c960d3d348a`, matching its recorded size/digest.

The decoded original job 111949112663 log has SHA-256 `d35cee9f84f02e56414287c6608f3a2099cfc96f1c48f1886b2676aeff5c5bf1` and identifies actual synthetic checkout `ce84709981a5e28ea59231dd88e78b7704c6a3c2`. It records failure of the original first packaged probe's UI condition. The original result has `completed:false`, fails at operation 21 waiting for the original version/diagram-node condition, and has SHA-256 `ba1328ef130d711627103d700658815e83acf9e41f798f53ef3e940cb3a66a0b`.

Directly read original `electron.log` (271 bytes, SHA-256 `0b02681cf239a5e11d0eb5aa419631b3bf07e017675894b9cd591ddd28781d8e`) records `SIREN_PROCESS_IDENTITY_FAILURE`: category Error, code null, killed true, signal SIGTERM, phase query, reason QUERY_FAILED, stdoutBytes 0, stderrBytes 0. `failure-state.json` records bootstrap readonly and `desktop-recovery-mode`. I viewed the actual failure screenshot: Disaster Recovery with “Process identity unavailable; use explicit recovery/export.” This establishes an actual refused startup identity observation; it does not establish why PowerShell failed to produce output before cancellation.

The seven original ZIP entries are result, electron/runtime logs, failure state/events/screenshot and BUILD-IDENTITY. No Diagram export result exists in this first-package artifact. The package workflow stopped at its first original packaged probe, so the later package probes/export commands cannot be qualified by the presence of newly corrected upload patterns. This is an execution failure before those probes, not a demonstrated recurrence of the old missing-export upload defect. The entire hosted run's later job conclusions are outside this report's first-package artifact scope.

The result's hosted archive identity is 53,568,014 bytes/SHA-256 `54d896061f332e3e2c851f28be258f7331733584aed3161078af6549cd69a945`; runtime is 245,726,208 bytes/SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. These are original receipt fields, not an independent extraction of the hosted application archive. No release or package PASS follows from them.

## Separate concrete defect and scoped correction

**[P2, original provider] A successful external process invocation returning `null` plus stderr was accepted as proof of process absence.** Original provider SHA-256 `431197f68621c3e98b9b7f9a02b183b30e4287fb488bd3500d8625490d4208be` destructured stdout/stderr but decoded only stdout. I independently executed that actual source function in a VM with only its external query boundary controlled: stdout `null\r\n`, stderr identifying unavailable Get-Process. It returned null without a failure diagnostic. The actual SessionJournal startup method, with a recent opened event supplied in memory, then returned mode normal instead of readonly. Thus provider uncertainty could be classified as absence and escape the journal's unknown-identity refusal.

I also reviewed root's real Windows controlled reproduction, not executed by me: `evidence/process-module-refusal/2026-10-05T19-52-15.958Z/result.json`, SHA-256 `1f260798914b7c00f6dabb8e10562d0d11892558e9cdf0da3ebd034e0f07d464`. It inspects only the executing owned live Node PID and prepends `$PSModuleAutoLoadingPreference='None'` at the external process boundary. The original provider returns missing from `null` stdout despite 559 bytes of actual CommandNotFound stderr. Its original ADVERSE assertion remains retained. This is a controlled cmdlet-resolution refusal, distinct from the hosted failure's zero-byte output.

The local correction refuses any nonempty native stderr after successful response decoding, returns unknown through the existing catch path, and emits only finite `NATIVE_STDERR` diagnostics. Main adds that finite reason to its existing diagnostic whitelist. Valid-looking identity plus stderr is refused as well as null plus stderr. The original query/script, UTF-8 setup, 10,000 ms timeout, 16,384-byte maxBuffer, hidden execution and single-query behavior remain unchanged. No retry, timeout increase, alternate provider or ownership fallback is added. Existing empty/malformed-response refusal remains unknown even if its diagnostic reason takes precedence over stderr.

Exact current local inputs inspected and recaptured:

| File | SHA-256 |
| --- | --- |
| `src/recovery/processes.mjs` | `1f550636541ff7eda3ebe3cb01eb2833a84303a6bae80268f990e217c50a02e9` |
| `src/main.mjs` | `ecb49919db6af95538cd52aa104d5f908310e51680df9c9b353ba98ff7232d2e` |
| `src/recovery/sessions.mjs` | `8561a54eb16b8eb101c3f12bfebf8c91f299dfc1961c6ace4a5c70c3137ee6bf` |
| `tests/process-identity-result.test.mjs` | `c0065bff72426638768b253a6634567f05a153d8e0626884ca2a6edcdf78d78c` |
| `tests/startup-identity-diagnostics.test.mjs` | `217d49dc81ce9dd282a0de94254d781938dba70896c792622048bcc1f06392ed` |

I independently ran `node --test desktop/tests/process-identity-result.test.mjs desktop/tests/startup-identity-diagnostics.test.mjs` from the repository root: 9/9 passed, exit 0, zero fail/skip/cancel/todo, 104.983 ms. This command does not execute the separate native PowerShell latency tests.

I authored and executed a separate controlled adversarial probe, `evidence/workspace-dock/process-stderr-independent-probe.mjs`, SHA-256 `31bc1f8ff7212c60413c357170f64a1de36d1aad3957a75a9a81e12c9719952c`. It uses the actual inspector source with only the external process reply controlled, and actual SessionJournal filesystem reads/writes in new isolated owned data directories. Its result `evidence/process-stderr-independent/2026-10-05T19-55-56.655Z/result.json` is COMPLETE4, SHA-256 `dd1abdfb3913ffb34946cff9c01736de954f1d573418dcd7302f9e44693f7728`, with captured inputs unchanged. Both null+stderr and exact Unicode-owner+stderr yield readonly; clean null and clean exact identity retain their normal-mode behavior. Each startup performs exactly one query, validates the unchanged options, leaves the recorded journal bytes unchanged and publishes no private stderr text. This independently closes the demonstrated interpretation defect for the inspected local contract, without claiming an actual Windows provider execution by this reviewer.

Root's same real Windows probe after correction, `evidence/process-module-refusal/2026-10-05T19-53-37.013Z/result.json`, is COMPLETE, SHA-256 `9485119550f98f0be2de6711de5d9a87bbc5e2af2e07e6e6983c73c64ee6b626`. It records unknown from the same controlled null/stderr559 query, one observation and NATIVE_STDERR. Root's helper SHA-256 is `26c67c01b33dd6111517ffe5a0262c1970279ff876d49189bfae77afe4f77a1b`. These root native observations are not attributed to me.

## Unicode source-capacity evidence

I inspected the root Node repository/reader probe and both retained results. The first preparation result at `2026-10-05T19-47-32.556Z` remains ADVERSE with ENOENT before any case (SHA-256 `47eced01d83693522ff13dad5d9cd12a1e229f07fea7001d7519cea4d5045740`). Its helper hash differs from the corrected preparation helper; it is not retroactively relabeled.

The actual final result at `evidence/source-unicode-capacity/2026-10-05T19-47-46.272Z/result.json` is COMPLETE4, SHA-256 `2128590c2d87f660e7ee2e5c42a4bebb31831877ab90f18fbb4c3012a874dced`. The current helper `evidence/workspace-dock/unicode-source-capacity-probe.mjs` has SHA-256 `08f23426ad37fc26cf1ee1617a8fc058bee92574a70233d72583206710d2d7ff`.

I independently rehashed all five captured input files and confirmed equality with their before/after maps and current files. I enumerated the actual isolated disk files: all five files still exactly match the result's disk-before sizes/hashes. I read the actual retained blob and compared it with an independently constructed `# ` + 8,388,607 emoji + `aa` fixture: exactly 33,554,432 UTF-8 bytes, 16,777,218 UTF-16 units, one line, well-formed Unicode, SHA-256 `9995726510249a363583d18dfdb7c730344badc00b3d986a2a1130bdb34221a5`.

The reviewed oracle tests exact cap admission, one-byte import overflow and four-byte edit growth refusal without disk change, adjacent surrogate-safe bounded reader chunks and EOF, split/oversized chunk refusal, disposal fencing and fresh exact export/project preservation. The repository cap is actually 32 MiB and the reader bound is actually 131,072 UTF-16 units. I did not rerun root's capacity probe. Its five captured inputs cover the listed direct source modules/helper, not a complete transitive dependency closure. One emoji-heavy source does not qualify two simultaneous max-sized models, arbitrary encoding/text workloads, project-wide capacity, editor rendering, analysis throughput, memory ceiling or physical interaction. Timings are observations for that fixture, not performance guarantees.

## Remaining limits

The hosted query cancellation with zero stdout/stderr remains unexplained by this stderr-only hardening. No inference that module autoload caused the hosted timeout is supported by these distinct observations. No broad/full-suite, generated bundle, new copied-package execution, canonical source synchronization or subsequent hosted PASS is qualified here; those require their own exact current receipts. Earlier hosted failures, the historical retention gap and previous reports remain unchanged.
