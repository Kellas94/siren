# Independent shell startup failure investigation — 2026-10-06

Author: Codex `/root/shared_workspace_review`. Read-only source/artifact investigation and own pure causal fixtures. No source, repository test, generated output, workflow or previous review was edited. No Electron, native process provider, PowerShell child, launcher or package application was launched by this reviewer during this task.

## Original evidence and inspected source

Inspected local HEAD 46192c5069acee395c221818cff91ce7cc7b0ae2, with product 8e16957, while the owner subsequently prepared an uncommitted native-provider replacement. This report describes the original PowerShell inspector and the preserved before-correction source snapshots, not that pending replacement.

Original evidence root: `desktop/evidence/workspace-surface/ci37409331278`. Independently verified Desktop ZIP SHA256 `ed147368e66773913924117248014e105306c5f8a266f224875bc5f46de58e91`; extraction receipt identifies artifact 11388567808 and 101 retained files. Original Desktop group result is ADVERSE with only shell failed, 19 other scripts exit 0, changedInputs empty. These are original hosted artifacts, not my executions. The complete decoded original job log reports the version wait failure at native shell line 13. Desktop-ui passed the same version check in a separate invocation; that does not establish shell's startup mode or repair its failure.

Shell's original artifact contains only electron.log, SHA256 `9cbd814d446a73a75e70c952f60c1c1000255a768302d7ac6f5da9da8be63f36`. Its diagnostic is:

`SIREN_PROCESS_IDENTITY_FAILURE {"category":"Error","code":null,"killed":true,"signal":"SIGTERM","phase":"query","reason":"QUERY_FAILED","stdoutBytes":0,"stderrBytes":0}`

The original job error is `UI condition not met: document.readyState === "complete" && document.getElementById("brandVersion")?.textContent === "v1.131.0"` at `tests/native/shell.mjs:13`. No shell bootstrap observation, screenshot or result receipt was retained. That absence limits direct claims about its actual DOM and reason text.

Current shell bytes differ from the artifact's input hash only in CRLF/LF: independently hashing the local text normalized to LF yields the exact recorded input `0ca2f8af926ac7c5be8ff06db92f4e6c9cb8aa49b0fc9ae3d2fa57acfe2f2fa3`. Initial inspected raw SHA256: shell65be0dd1c32bdd1cbf97c151e1ed0ffa2f128202a8673c2cfaf5ef223438444c; drive897408a2e194127b6e3cce4d4a487bdcd231178ce61d69e0443bc3a6ee02a5ca; inspector1f550636541ff7eda3ebe3cb01eb2833a84303a6bae80268f990e217c50a02e9; main3a4d254a841a6c787e7972755ae480fa4d9662a45c2593a8f04ac19d2bfc32ff. Current generated app hash7a3e6dad9bc5859d78e3eeffcaa7cef779aa8c584ba1affad3fb44650af53ebf is not the job's reported generated hash; I do not assert identical whole-renderer bytes. The inspected guard is also explicitly present in the source build transform.

## Findings

Critical: none established. No evidence of bypassed PIN, forged process ownership, privileged renderer access, corrupted data or Audience exposure.

**Important — native identity query failure blocks normal startup.** `src/recovery/processes.mjs:35` starts powershell.exe/Get-Process with a single 10-second deadline and 16KiB buffer. Its actual retained query was killed with SIGTERM before any output. The inspector returns undefined on failure; `src/main.mjs:115` therefore selects readonly before journal inspection. This correctly refuses unverified ownership, but an unavailable/slow process provider prevents an otherwise normal owned session from entering the editing surface. The observed killed/query/empty-output shape and configured deadline strongly support deadline cancellation. No elapsed-query trace identifies whether cold PowerShell startup, Get-Process/Path/StartTime access, host scheduling, security scanning or another internal step consumed the time.

**Minor — normal shell probe reports an impossible version wait instead of the failed startup mode.** `drive.mjs:57` accepts an unlocked readonly/recovery receipt, intentionally supporting recovery probes. At lines 63–65 it navigates such Home state to Recovery and returns. This shell explicitly creates a fresh data root; native Home capabilities use Boolean(snapshot) for diagrams (`main.mjs:558`), so its unselected readonly startup has no diagrams capability. Shell then goes directly to its normal-renderer version wait. `build/renderer.mjs:208-213` intentionally returns before initialize when mode is nonnormal; baseline `R78.html:25014` stamps the badge inside initialize. A readonly Recovery session therefore has no path to satisfying the normal version oracle. This is not evidence that the renderer version constant is wrong or that the native pointer oracle needs retrying.

Additionally, shell launch/unlock occur before its try/finally (`shell.mjs:9-12`), and its result is written only on success. Its current failure leaves only Electron log, explaining the lack of bootstrap/DOM evidence. If unlock itself failed, the shell's own finally would not close the driver; this is a directly inspected control-flow gap, not an assertion that this original invocation leaked a process. Put launch/unlock in the owned cleanup scope and retain bounded failure observations.

## Own pure causal reproduction

Own files: `C:/Claude/SIREN_WORK/tmp-shell-startup-causal-review/probe.mjs`, `source-snapshots.json`, `results.json`. The snapshots preserve the actual inspector function, actual main identity/startup block, generated renderer guard prefix, and original initialize/version-stamp head used in the fixture.

The independently authored fixture executes those snippets plus actual imported unlockDesktop and waitForNativeCondition. It mocks only the external query, journal, PIN/Home bridge, and small DOM/renderer dependencies. It does not run the complete renderer, actual native identity provider or real Electron IPC. The controlled error has the exact retained killed/SIGTERM/zero-output shape; a separate valid identity is the control. No external command is executed.

| Pure fixture | Native identity result | Actual main selection | Actual unlock route | Renderer guard | Version oracle |
|---|---|---|---|---|---|
| Controlled killed query | undefined, identical finite log | readonly | Recovery/app.html | Stops before initialization | Empty badge; fails |
| Valid native reply control | Exact PID/path/start time | normal | Diagrams/app.html | Allows initialization | v1.131.0; succeeds |

The failing branch executes 300 virtual polls over the unchanged 30000ms condition budget; no real 30-second wait or increased deadline was introduced. The successful branch passes immediately. This proves the inspected source's causal response to the observed class of failure. Because original shell did not retain bootstrap/DOM, the fixture does not manufacture those missing original observations. Other concurrent/independent startup failures are not established.

Own pure command: `node --test tests/process-identity-result.test.mjs tests/startup-identity-diagnostics.test.mjs`: 9 tests, 9 passed, 0 failed/skipped; duration 64.6482ms. These executed the before-correction tests at that time. The owner later began changing provider/tests; no result for those new bytes is claimed here.

## Minimum correction and provider guard review

Keep undefined identity selecting readonly, and keep the normal shell version/security/render checks unchanged. At the normal-only shell caller, assert/record native bootstrap mode immediately after unlock, before waiting for the badge. Do not globally require normal mode in unlockDesktop: other probes intentionally inspect readonly/recovery. Failure observations should retain finite mode/reason category, readiness, URL/surface and query/decode diagnostic, without PIN, snapshot contents or native paths. A screenshot may supplement them, but cannot grant success. Keep the existing deadline/hit predicates.

Address provider cost instead of extending the timeout. A narrowly bundled read-only native provider can query a PID's executable path and creation time through one process handle, without invoking the PowerShell command pipeline. The owner's proposed fixed .NET C# helper is plausible, but is not implemented/qualified by this report. Microsoft documents [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) returning the creation time from the supplied process handle; this supports querying both identity fields from the same opened object. Remaining guard requirements to independently verify:

- Decimal PID only, positive and within DWORD; no caller-controlled executable or shell input. OpenProcess uses only QUERY_LIMITED_INFORMATION and a non-inheritable handle. Close it on every success/failure path.
- Query Unicode path with a finite buffer and creation FILETIME from that same handle, avoiding a second PID lookup/reuse race. Preserve UTC round-trip seven fractional digits. GetLastWin32Error must be captured immediately after failing OpenProcess; only a proven absent PID may produce null. Access denial and API/decode failure remain unknown. Validate the absence mapping against real Windows results, not only a fake error code.
- Fixed executable under the verified owned build/resources root, not PATH. Helper source/binary hashes enter build receipts and packaged/launcher inventories. Missing, swapped or invalid helper refuses; no unverified fallback can grant identity. Handle file validation and the execution path as an integrity boundary.
- Preserve the single query, 10-second deadline, 16KiB reply bound, exact PID/path/time decoder and finite diagnostics. CLR cold start and package integration still require actual measurement/qualification; replacing PowerShell does not itself prove speed or CI repair.

A tempting smaller self-only shortcut using Electron's [process.getCreationTime](https://www.electronjs.org/docs/latest/api/process#processgetcreationtime) returns milliseconds or null. Existing journal/writer identities use seven-digit .NET timestamps and compare startedAt strings exactly (`sessions.mjs:41`, `atomic.mjs` writer reclaim). A naive mixed-precision provider could misclassify a live process or incorrectly reclaim a writer lock. Such a shortcut needs explicit backward-compatible identity matching before adoption; it is not recommended as an unqualified fix. No timestamp rounding or relaxed matching was performed.

## Evidence limits

Original CI 37409331278 remains failed. Owner-reported package 27/unit 1100/Sources 20/Diagrams 18 outcomes are not my executions or independent release evidence. No native run was performed while the owner held the runner. No proposed provider, package-integrity change or future hosted run is certified. No product fix, weakened startup/version oracle, PIN bypass, click retry, timeout relaxation or source edit was made by this reviewer. Previous reports remain unchanged.