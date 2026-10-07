# Isolated Terminal candidate: not admitted

Author: `/root/terminal_contract`, 3 October 2026 Europe/Bucharest. This is actual isolated dependency/native evidence under the user's instruction to start implementation. Product package/lock/main/source were not changed by this agent. Other agents' concurrent Source work is outside this report. No commits, system-tool installation, publisher-trust change, execution-policy change, native Job guard or evaluator approval occurred.

The exact node-pty prebuild loads and the real PowerShell/ConPTY interaction works on this runtime. **The candidate is not admitted:** an explicitly spawned fixture child survived PTY Stop, and no qualified process-family lifetime mechanism exists. Completing the shell scenarios is not a successful ownership or SIREN Lock qualification.

## Reproducible probe and retained identities

Tracked probe: `desktop/tests/native/terminal-candidate.mjs`. All generated entries, profiles, synthetic cwd/child fixtures, packages and result files are under ignored `desktop/evidence/terminal-candidate*` paths. No application Data, account credentials, project source or product runtime is imported by the probe. Native runs were executed through `exec_command` with `sandbox_permissions:require_escalated`; no sandbox bypass was used.

Initial install was exact `npm.cmd install --ignore-scripts --no-audit --no-fund`, with a probe-owned cache. No install/postinstall scripts ran. Commands from `desktop`: `node --check tests/native/terminal-candidate.mjs`, `node tests/native/terminal-candidate.mjs` (inventory only), and approved native `node tests/native/terminal-candidate.mjs --native`. The executable is the already present development Electron distribution, not a rebuilt or packaged SIREN application.

| Evidence | Retained path under `desktop/evidence` |
| --- | --- |
| Exact dependencies and npm lock | `terminal-candidate-dependencies/` |
| First native readiness failure | `terminal-candidate-2026-10-02T21-54-11.969Z/` |
| Probe renderer return-value failure | `terminal-candidate-2026-10-02T21-55-59.837Z/` |
| Captured inherited module publisher prompt | `terminal-candidate-2026-10-02T21-56-15.495Z/` |
| Completed real shell scenarios and failed Stop containment | `terminal-candidate-2026-10-02T21-57-33.264Z/` |
| Expanded renderer/native/license inventory | `terminal-candidate-2026-10-02T21-59-34.517Z/inventory.json` |
| Exact recorded-PID exit verification | `terminal-candidate-cleanup.json` |

Each run retains `inventory.json`, and native runs retain generated `native-entry`, `native-result.json`/`host-result.json`, runtime versions, phase timings and logs. The completed native run binds probe SHA256 `d0b08b123d60c24abbd5921771d31b3f0cf39123f8ba3265e2390fbece5a5afe`. The final probe adds renderer artifact inventory only after that run; its inventory/source hash is `57d575585de9c4258f933d89ed22a0a63880024d4697b91b2706aee09c55cf6c`. These identities are deliberately distinct. No rerun of unchanged native scenarios is claimed for the later inventory-only addition.

## Exact runtime, artifacts and license files

Actual main and utility host both report Electron **44.5.1**, Chromium **152.0.7977.130**, Node **24.21.0**, V8 **15.2.124.28-electron.0**, `process.versions.modules` **149**, `process.versions.napi` **10**, `win32/x64`, OS release **10.0.26200**. ABI/N-API are measured, not inferred from build Node or npm metadata. This is one machine/runtime test; no other Windows build or architecture is qualified. Hardware model was not captured, so timings cannot serve as a declared-hardware performance commitment.

Electron executable SHA256: `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. Exact probe npm lock SHA256: `2ab2c10ae92ebcf8b581f833139499bce2e47ef7a134a154c58f7f8179c458ba`.

| Resolved package | Version | Inspected actual license file |
| --- | --- | --- |
| `@xterm/xterm` | 6.0.0 | `LICENSE`, MIT text retained/hash bound |
| `@xterm/addon-fit` | 0.11.0 | `LICENSE`, MIT text retained/hash bound |
| `@xterm/addon-search` | 0.16.0 | `LICENSE`, MIT text retained/hash bound |
| `node-pty` | 1.1.0 | Root `LICENSE` plus `deps/winpty/LICENSE`, MIT texts retained/hash bound |
| `node-addon-api` | 7.1.1 | `LICENSE.md`, MIT text retained/hash bound |

The final inventory hashes 42 retained renderer/native/helper/license artifacts, with npm resolved URLs/integrities and actual file sizes. Windows binaries inspected have PE machine `0x8664`. Hash anchors for the OS-inbox ConPTY branch:

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `prebuilds/win32-x64/conpty.node` | 312,320 | `ee8f4e6f4dad71939eecfda11de249400e34bfefe4c8b48af13f3b5476f4035b` |
| `prebuilds/win32-x64/conpty_console_list.node` | 134,656 | `879dd94cfc79f1e263a00077597ae9448a5394b7d193381aaa50d992a1f91090` |
| `lib/conpty_console_list_agent.js` | 721 | `0d010879bb6680a0253d44363183d53e631f42972594eb6dcb1fb842c8c85e52` |
| `lib/worker/conoutSocketWorker.js` | 848 | `3e4bac095ac3870c3248a7302f5d10217de625f30c32b7000fe48a34788e47ac` |
| `lib/windowsConoutConnection.js` | 6,119 | `1440f70908fb1f55911ac8e936a1230f68a9c00c03096fcef6788eac6aad9d62` |

The tarball also carries winpty native/agent/DLL files and bundled ConPTY **1.23.251008001** `conpty.dll`/`OpenConsole.exe` for x64/arm64. Their x64 copies appear both in prebuilds and third_party with identical hashes. These were inventoried but **not selected/exercised**: the probe used `useConpty:true,useConptyDll:false`, whose inspected native source loads OS `kernel32.dll`. No standalone notice file was found under that bundled ConPTY third_party directory. This report does not conclude that the root MIT text settles every bundled-binary obligation. Product packaging must omit unselected winpty/bundled-ConPTY artifacts or independently resolve their distribution evidence; it must not blindly ship the entire tarball.

Read-only tool discovery found Python at `C:/Program Files/Python312/python.exe`, no `cl`/MSBuild on PATH, no installed `@electron/rebuild` in product node_modules, and no Visual Studio/Windows SDK at the conventional inspected directories. This is not exhaustive compiler discovery. No rebuild was required for the exact prebuild that loaded here, and no compiler/header/rebuild tool was installed. A new native ownership module and future runtime upgrades still need a separately available, recorded build environment.

## Native observations and retained failures

The first shell probe sent a command without a live terminal response path and timed out at the fixed 15-second readiness deadline. Its output was not retained as a tail, so its particular prompt cannot retrospectively be asserted. A second changed probe connected xterm but failed in the test harness because its final renderer expression returned a non-cloneable xterm disposer. The third fixed that test return value and retained the actual reason the shell remained at startup: `PSModulePath` inherited from Codex resolved a bundled PSReadLine format file, prompting for an untrusted publisher. `-NoProfile` does not disable module auto-loading. No prompt was accepted and no trust/policy setting was altered.

The fourth run reconstructed shell `PSModulePath` to the OS WindowsPowerShell module directory, explicitly excluded Codex modules, used the absolute Windows system PowerShell and kept `['-NoLogo','-NoProfile']`. It used the synthetic Unicode cwd and an isolated live xterm renderer for protocol responses, including one generated response forwarded through the model input gate. This is a harness/environment correction, not retrying the same failed case until PASS or increasing the deadline. Initial failures remain in their original directories.

| Scenario | Actual result | Scope |
| --- | --- | --- |
| Exact native addon load in utilityProcess | Completed in 6 ms; real export names captured | This prebuild/runtime only |
| No-profile real PowerShell/ConPTY startup | Completed in 383 ms | OS modules only; no profile, command or policy flag at spawn |
| Unicode output | Exact `U_șă😀漢字_E`, 32 ms | Real PTY input/output, sentinel not copied whole in input command |
| Native resize | Shell readback `132x38`, 69 ms | Actual PTY resize and shell dimensions |
| Timed command while model view Locked | Completed; new test input refused | Model gate; no product PIN/Lock/epoch/registry |
| Interactive `Read-Host` | Waited through model Lock, answered after model Unlock | Model gate, real shell prompt |
| Explicit pause/resume | 100 ms pause, completion after resume | Independent probe only; Lock path did not pause |
| 60-second Locked-view flood | Drained 36,670,832 UTF-8 bytes in 60,072 ms | View not forwarded while model locked; shell not paused |
| PTY Stop plus detached fixture child | Root exit observed; child **still alive** after Stop | **Ownership failure**, not PASS |

Flood retained exactly 4,194,304 bytes with 32,765,438 bytes omitted by that phase. Total run received 36,961,361 bytes, retained 4,194,304, omitted 32,767,057. Peak sampled host RSS was 181,174,272 bytes. Peak sampled sum of Electron `getAppMetrics().memory.workingSetSize` was 491,056 KiB; this excludes the separately launched PowerShell and fixture child, is not total physical-memory pressure and does not demonstrate steady-state memory plateau. The ring is a test-owned raw-byte collector; it is **not** the specified production UTF-8/VT-safe ring/credit implementation. Ctrl+C latency under flood, the 500 ms Lock target, control-lane fairness and eight-session aggregate memory were not measured.

Isolated sandboxed hidden BrowserWindow loaded the exact local xterm/fit/search files. It rendered ANSI/Unicode, fit to 107 columns/27 rows and found/selected `needle`. No Node integration was enabled in its renderer. This is a renderer smoke test, not IME, native visible keyboard/paste, multi-monitor or product Code/Docs integration qualification.

## Ownership failure and cleanup

The fixture child was launched explicitly from the real shell using Windows `Start-Process -WindowStyle Hidden`; its own Node fixture timer exits after 12 seconds. node-pty's `pty.kill()` reported root exit, but the child was observed alive immediately afterwards and disappeared only after its finite fixture deadline. The console-list helper logged **`AttachConsole failed`**, including in the completed shell run. This matches the need to investigate the pinned helper path; it does not prove the exact cause of the child's survival or make fallback PID termination safe.

No kill-by-name, broad process-tree kill, publisher acceptance, saved PID restore or native Job guard was used. Probe main/host/root and fixture-child termination were observed; read-only verification of the 20 exact recorded main/host/root/renderer/GPU/utility/child PIDs at `2026-10-02T21:59:38.8348798Z` found all absent. No process was killed during that verification. This verifies recorded probe processes are gone; unknown-descendant discovery/containment is explicitly **unqualified**. Abrupt owner/host loss and grandchild/PID-reuse ownership tests remain open, rather than deliberately leaving further unmanaged families before a guard exists.

## Required next work

Do not admit a product shell from this evidence. Implement and qualify an ownership mechanism with actual held handles/Jobs, non-breakaway inheritance, session adoption before input, root/host/owner-loss containment and verified per-session Stop. The design's proposed Job guard remains a proposal. A build toolchain may be needed for that owned module; request a concrete scoped toolchain action only once its requirements are established, not an unneeded system installation now.

The product shell environment must exclude automation-host module injection: reconstruct an explicit OS/user-supported PowerShell module policy rather than blindly inheriting Codex `PSModulePath`. Preserve source/privacy/registry/epoch/readonly/PIN checks independently of native load success.

Native/helper resources need a positive allowlist and correct relative paths: `conpty.node`, `conpty_console_list.node`, console-list agent, conout worker/shared code and required package JS. The loader searches build/Release, build/Debug, then platform prebuilds relative to its JS. Native and spawned/worker helper paths require explicit unpack/launch qualification outside ASAR as needed. This run is unpackaged; it supplies no ASAR/native/helper release-graph proof, release signing, public update or end-user portability admission.

Product Lock/rollback/epoch/destroyed views, eight sessions, VT/OSC abuse budgets, paste review, IME/themes, Ctrl+C/flood responsiveness, real detach/monitor lifecycle, abrupt host/main death, full native notices/build provenance and packaged tests remain unqualified. Source/native-window implementation can proceed independently. No fresh behavioral approval is requested by this technical failure report.
