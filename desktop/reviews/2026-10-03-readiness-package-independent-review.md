# Readiness-gate package independent qualification

The unchanged packaged probe **FAILED on its first and only qualification run**, before reload. Native PIN setup returned `ok: false`, producing `Owned fixture PIN setup must acknowledge` at `tests/native/drive.mjs:32`, reached from `packaged.mjs:63`. This build is **not qualified** by this review. No retry or oracle change followed.

## Exact retained build and source comparison

Build: `desktop/dist/development-4f340d8d-aa09-4149-bb95-f9aa063a19d6`, commit `c6fa8d39227d0784b423a8fc49e06ec2d753f76b`. Before launch and after the result, actual ASAR hash was verified as `c40af4b4c52789449728a0785ccf335def3d11bbdf8b4d35089210bdda7423c5` (14,356,444 bytes). Runtime hash is `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`; extracted renderer hash is `fce4cf13ec180acd7823e2dcc597ea6e0c699b40d80b2ea369556a3bf170cfa0`.

The archived code was compared to **the named Git commit**, not evolving working-tree main code. All 35 archived source files have equal content after CRLF-to-LF normalization; 32 are also raw-byte equal to committed blobs. `src/main.mjs`, `src/ipc.mjs`, and `src/preload.cjs` retain mixed Windows line endings and differ in bytes only by CRLF versus LF, including when compared to Git's filtered output. This is explicitly not an all-files raw-byte identity claim. The readiness helper is raw-byte equal to its committed blob.

Full source identities and comparisons are in `desktop/evidence/readiness-package-identity-2026-10-02T23-10-05.420Z/identity.json`.

| Archived component | Actual SHA256 | Git blob SHA256 |
| --- | --- | --- |
| Main | `0c3f56c0fa6d60c77453a9a03ec53976d131ad2b145dd1fe317ab63c30a87058` | `3a56e328b18d34a31ca07e28e83a5cfd1987a83fa56e48d6f0ffae891f415539` |
| IPC | `d695a1133654472479e5338525ce36c81630461ee62bd9fbfac01981b93ecaf5` | `a97c47f7d3800456729a621078c2e9d3c0d13257061877d988e34c457ca32b15` |
| Preload | `198353950873f884d48604e0238e3cf270412da2679666b2c7238b70d89f9206` | `7e88c308d6b276a5db563cb61071da15aac7d445075b6ac4a11b09377ec575e0` |
| Native readiness helper | `02a111bbab90dfb5eff482153396391b7405ac2bbc6f47178158fb8ab46e53fc` | Same |

The unchanged packaged probe, driver, ProjectStore fixture, RecoveryStore fixture, and hash utility were also checked against committed bytes. Probe SHA256 is `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541`, driver SHA256 `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4`; both remain equal after the run.

## Actual run and adverse evidence

Approved `require_escalated` command from `portable/desktop`:

```text
node tests/native/packaged.mjs dist/development-4f340d8d-aa09-4149-bb95-f9aa063a19d6
```

Exit: **1**. Evidence: `desktop/evidence/packaged-2026-10-02T23-10-17.436Z/`. The probe's retained `result.json` has `completed: false`, failed wrapper operation **9**, masked native PIN operation, and `saveDiagnostic: null`. It failed before post-unlock reload, renderer edit/save, recovery restore, or Unicode closed-folder copy. The unchanged helper asserts `setup.ok` and does not retain the refusal code; the actual code is therefore **unknown in this qualification evidence**.

`failure-events.json` contains the initial isolated/default contexts and `Page.frameStoppedLoading`. `failure-state.json` was successfully observed: document visible and focused, body not inert, bootstrap mode locked and readonly true. `failure.png` was captured. This failure differs from the prior reload/transport stall: the failure observations remained responsive.

The original probe's `finally` wrote `electron.log` and awaited its owned driver cleanup. An initially sandbox-denied Windows process-inventory query cannot prove cleanup; its zero-count output was disregarded. A subsequent approved read-only `Get-CimInstance Win32_Process` query restricted executable paths to this evidence directory succeeded and found **0 remaining owned SIREN processes**. No unrelated process was killed.

## Static causal lead, not a confirmed refusal code

The committed readiness helper waits on `did-finish-load` and resolves only if `isLoadingMainFrame()` is already false at that callback. It does not subscribe to `did-stop-loading`. If Electron still reports loading at `did-finish-load` and clears it only for `did-stop-loading`, the helper can keep waiting until its 10-second refusal even though the document finishes. The earlier successful instrumented gate settled at `did-finish-load` without this final loading-state check, so it did not qualify this implementation. The native event/state order was not captured in the unchanged qualification run and must be measured before calling this the actual failure cause.

The first result remains FAILED and immutable. Parent-authorized observational follow-up, if performed, must be reported separately, retain the same readiness behavior/oracle/deadlines/flags, and cannot convert this qualification failure to PASS. No product edits, altered native tests, delay, timeout expansion, build, dependency change, commit or push occurred in this qualification. Windows1, terminal, editor, launcher, online account and clean-PC qualification remain outside this review.

## Addendum: observational reproduction confirms the missed stop boundary

The parent subsequently authorized one observational run against an isolated copy of the immutable `c6fa8d3` package. The retained readiness helper is unchanged. Only cloned main logging was added: native load-event/state boundaries and masked PIN request/receipt metadata. No readiness behavior, flags, command/condition deadline, oracle or probe/driver byte changed. A wrapper awaits the original IPC service result solely to record its returned code; no payload or PIN is logged.

Preparation identity and extracted source are in `desktop/evidence/readiness-boundary-observation-2026-10-02T23-14-23.193Z/`. Its source package ASAR is the original `c40af4b4...`; the cloned diagnostic ASAR is `87bc529075ed19b208e128c79874d8803fcdf4164216c1dfe3b1866c550e679a`, 14,357,965 bytes. Content hashes of all **106 members other than main** were verified unchanged, including readiness helper SHA256 `02a111bbab90dfb5eff482153396391b7405ac2bbc6f47178158fb8ab46e53fc`. Cloned main SHA256 is `325e3d47b5b7d380c478d23422ae0b5104c4854c97d68f687c110a6eaf5d8d37`. The preparation copy SHA256 is `d4879f55d3bf5c288be484031b706e44cb2e2051d6fede9b7530b385f503cd91`.

The diagnostic copy's build receipt was updated to identify its actual instrumented ASAR, so the unchanged probe's archive check still binds its executed bytes. It is explicitly a diagnostic artifact, not the original readiness package qualification.

Approved single command from `portable/desktop`:

```text
node tests/native/packaged.mjs evidence/readiness-boundary-observation-2026-10-02T23-14-23.193Z/Observational-package
```

Result: **FAILED**, exit 1, same wrapper operation 9/setup acknowledgement assertion. Its independent result/log/state/screenshot evidence is `desktop/evidence/packaged-2026-10-02T23-14-43.400Z/`. `saveDiagnostic` remains null; no reload or recovery occurred. The native receipt is now directly retained in `electron.log`: `ok: false`, code **WORKSPACE_NOT_READY**, native unlocked false.

| Main timestamp | Native evidence |
| --- | --- |
| 542 ms | `setupPin` request enters while URL is the target and both loading flags are true |
| 774 ms | DOM-ready; main-frame loading remains true |
| 778 ms | `did-finish-load`; `isLoadingMainFrame()` and `isLoading()` both still true |
| 778 ms | Initial `loadURL` returns; both loading flags still true |
| 779 ms | `did-stop-loading`; both loading flags now false |
| 2,609 ms | Renderer readiness signal; loading false |
| 10,545 ms | Setup receipt refuses with `WORKSPACE_NOT_READY`; loading false, PIN still locked |

These native timestamps establish the static causal lead in the observational run. The helper's `finish()` checks native state while loading is still true, so it ignores the completion event. The next event clears loading, but the helper has no stop-loading listener; its existing ten-second timeout then rejects a request despite completed loading. This is a concrete implementation bug in the new readiness helper. It does **not** identify the blocking stack of the separate old `1e11a4` reload stall, nor qualify a future fix.

The parent owns the adverse regression test for exactly `did-finish-load` with loading true followed by `did-stop-loading` with loading false, and any product correction. A further qualification requires a separately built immutable artifact and authorized probe; neither failed run here is rewritten or rerun. The original `c40af4b4...` ASAR and `771f17fb...` unchanged probe were reverified after this observation.

Original and observational probe `finally` cleanup both completed. A second approved process query restricted to the observational execution directory found **0 remaining owned SIREN processes**. Two native runs occurred in this review, each separately authorized: the unchanged first qualification and the one observational reproduction. No product file was modified by this investigator.
