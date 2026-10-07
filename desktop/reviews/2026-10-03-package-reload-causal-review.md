# Retained package reload causal investigation

The original packaged reload failure remains **UNKNOWN and unresolved**. One authorized native diagnostic reproduced an early post-unlock reload timeout and captured a wider loss of progress: the native main heartbeat stopped, no second custom-protocol request or bootstrap receipt appeared, no new renderer context appeared, and two additional CDP queries also timed out. This is stronger evidence than a single unacknowledged `Runtime.evaluate`, but it does not identify the blocking native stack or prove a production fix.

## Immutable baseline and previous evidence

The baseline is `desktop/dist/development-27a258e2-d38f-481e-ac6c-9d3c52e4751d`, source commit `1e11a47327bfd012af122816aebc45d48bb3d4bf`. Its ASAR SHA256 is `11b8ce4e4c281e50a262c7457af9d53280f6077a5105ba5ed2765066e6ee5539`; the runtime SHA256 is `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`. The original archive hash was verified before preparation and after the diagnostic. Working-tree runtime changes were not used.

The actual original `desktop/evidence/packaged-2026-10-02T22-18-48.253Z/result.json` is FAILED at wrapper operation 14: the post-unlock reload wait encountered a 20-second `Runtime.evaluate` timeout. Its probe SHA256 is `771f17fb4836d4621f3ba6071edbc10cdc718ae7e4bf29814429686566a9d541`. No recovered project was restored and no save diagnostic was obtained. Its renderer events contain the two initial contexts and `Page.frameStartedLoading`, without a new navigation/context receipt. It remains unchanged.

Earlier diagnostic `package-unlock-diagnostic-2026-10-02T22-27-10.796Z` changed inspector flags, inserted a one-second delay and queried a frame before the wait. Its renderer observed a new unlocked context. Its attempted native snapshots used dynamic imports that failed with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`; those results are not native window-state readbacks.

The subsequent same-archive comparison `package-reload-boundary-2026-10-02T22-30-34.047Z` completed both immediate and new-context variants, each observing `document.readyState === 'loading'` before setup. It therefore supplied no causal proof for an evaluation race or universal failure whenever the DOM is still loading. Neither successful diagnostic replaces the failed original.

## Single native diagnostic

Evidence directory: `desktop/evidence/package-reload-causal-2026-10-02T22-51-41.381Z/`. Its `result.json`, `electron.log`, `manifest.json`, `probe.mjs`, original and diagnostic driver copies, baseline main copy, extracted archive tree and isolated package are retained.

Preparation used a copy of the retained package and extracted its ASAR. Only `src/main.mjs` was instrumented; content hashes of all **105 other archive members** were compared successfully against the original after repacking. Instrumentation emits timestamped protocol entry/resolution/fetch-return, bootstrap entry/return, native navigation/loading events and a 250 ms main heartbeat. The heartbeat reads `webContents.isLoading()` when a window exists. Logs contain no PIN or project source text. This adds native calls and logging, so timing and observer effects remain limitations.

The native probe creates synthetic schema-1 data using the extracted baseline ProjectStore and RecoveryStore, then executes the original packaged pre-unlock assertions and the exact retained driver's `unlockDesktop` implementation. It does not change the original reload expression, immediate next wait, 20-second command deadline or 30-second condition deadline. There is no inspector flag, added pre-reload observation, sleep, context gating or timeout expansion. Driver changes record send/response/event metadata; after failure only, two independent CDP observations receive their own bounded 5-second diagnostic deadlines. They cannot make the original oracle pass.

The launched flags were `--disable-backgrounding-occluded-windows`, `--remote-debugging-port=57137`, `--enable-logging=file`, `--log-file=<evidence>/runtime.log`, `--siren-test-root=<evidence>/must-not-be-used` and `--siren-test-project=ignored-project`. The last two are the original test arguments and remain ignored by the packaged app; their forbidden root was verified absent. No flags expose non-loopback debugging.

Command from `portable/desktop`:

```text
node evidence/package-reload-causal-2026-10-02T22-51-41.381Z/probe.mjs
```

The launch used `require_escalated` and was approved. Exactly **one native process launch/run** occurred. The diagnostic command exited 0 because it records failure rather than treating the observation script's process exit as the package oracle; `result.completed` is **false**, with `CDP timeout: Runtime.evaluate`. No rerun followed. Preparation had two non-native Windows ASAR path-normalization errors before final validation; neither attempt launched Electron.

## Captured boundaries

Main times are relative to instrumented main entry. CDP times are relative to the driver socket attachment; the clocks have different origins and must not be subtracted from one another.

| Main time | Observation |
| --- | --- |
| 329 ms | Initial `loadURL` entered |
| 334 ms | Initial native navigation/loading began |
| 339 ms | `/app.html` protocol handler entered and path resolved |
| 342 ms | File `net.fetch` returned status 200; this does not certify full response-body consumption |
| 384 ms | Initial frame navigation receipts |
| 386 ms | Synchronous bootstrap entered and returned, PIN locked, native schema-1 selection present |
| 513 ms | Last main heartbeat: window present and loading true |
| 724 ms | Native `did-start-navigation` for the reload |
| Thereafter | No further heartbeat, protocol entry, bootstrap entry, DOM-ready, initial `loadURL` return, readiness signal, load-failure or renderer-process-gone receipt during the remaining diagnostic observation |

The initial HTML is 13,681,930 bytes. The first native `loadURL` had not completed and the initial document had not emitted `dom-ready` when the new reload began. This captures startup/navigation overlap; it does not by itself establish the cause.

| CDP time | Observation |
| --- | --- |
| 301–306 ms | Command 14 confirms locked renderer bootstrap after native setup |
| 306–307 ms | Command 15 schedules `setTimeout(() => location.reload(), 0); true` and receives its response |
| 307 ms | Command 16 sends the unchanged post-reload condition |
| 355–359 ms | Reload scheduled/requested/started navigation and started loading events |
| 20,316 ms | Command 16 times out; no new context/navigation-complete receipt |
| 20,316–25,316 ms | `Browser.getVersion` and `Page.getFrameTree` both time out at their independent 5-second diagnostic bounds; no additional socket messages |

These command IDs belong to this diagnostic's CDP trace, not the original probe's wrapper operation numbering. The setup and unlocked native PIN checks completed before command 14 through the retained helper. `lockedBoundaryAcknowledged` is true and the unchanged unlocked-renderer oracle did not complete.

## Causal interpretation and remaining uncertainty

The narrow hypothesis before the run was that immediate evaluation during reload/context replacement loses one renderer evaluation response while navigation otherwise progresses. The captured failure does **not** support that narrow version: navigation never reaches the second protocol handler/bootstrap and other CDP requests also stop. A false condition alone cannot explain it either; the evaluation never returns. An application protocol refusal is not observed: initial fetch returns 200, and the second request never reaches the instrumented handler.

The evidence instead supports investigating an Electron/Chromium native browser/main stall at early navigation cancellation or replacement, with an immediate renderer evaluation in flight and the initial large custom-protocol document still loading. This is a **hypothesis**, not a confirmed engine bug. Lack of heartbeat shows the instrumented main callback ceases to complete; it does not tell whether JavaScript dispatch, the heartbeat's native `isLoading()` call, another native lock, or browser navigation machinery is blocked. The observation itself can perturb timing. Both after-failure queries use the same target socket, so they cannot independently prove the socket transport remains healthy. No native stack or OS wait-chain was captured.

Exact baseline source boundaries are retained in `baseline-main.mjs`: protocol `net.fetch` at line 131; synchronous bootstrap handler at line 276; navigation guards at lines 300 and 302; initial `await window.loadURL` at line 306. The retained preload sends synchronous bootstrap at `extracted/src/preload.cjs:18`. The retained driver's startup qualification checks bridge/bootstrap fields at `original-drive.mjs:13`, schedules renderer reload at line 46, and immediately polls at line 47. Its qualification does not require DOM readiness or initial navigation completion. The actual PIN UI is mounted after `DOMContentLoaded` at `extracted/generated/app.html:23875`, whereas the probe can set up PIN earlier through the native bridge. Earlier successful loading-state comparisons prevent treating that difference as sufficient causality.

No product fix is justified by this run. The next discriminating investigation, if separately authorized, should capture native/browser thread stacks or a Windows wait-chain from a failed process before terminating it, without another inspector dynamic-import path. An event-boundary control that admits setup only after native DOM-ready/initial-load completion may test the early-startup difference using the original condition and deadlines; its success alone would still not prove the blocking mechanism or resolve the original failed package. A product reload change or driver oracle change requires evidence beyond this report.

## Delivered identities and scope

| Artifact | SHA256 |
| --- | --- |
| Baseline ASAR | `11b8ce4e4c281e50a262c7457af9d53280f6077a5105ba5ed2765066e6ee5539` |
| Diagnostic ASAR | `80b813ee10a4db1ad33c02dcfc1c0e5834e0e2b9ff348473a29ee851185e9a8d` |
| Baseline main | `77f706255af90164e7f93a6e60a6910a19fd681756585a547f3cf4a9c434f355` |
| Diagnostic main | `e0019c750aa3b405b94673cc6e09ac8aec12a24217ae87b3bf86efa36d846726` |
| Retained driver | `e6e30f2832d55aefc05c8b294f1dc2ce3d8bcd23fc323d0823018db580d3e5d4` |
| Diagnostic driver | `63a2ed8fe8c56570cbb50466c3233f66c4fa16cd6436042663b72ff23c60e7c0` |
| Native diagnostic probe | `986d5351bfdfd2673ebaa925007848b5969895a21726b2da28bab43cd6df0740` |
| Preparation script | `09a0b7683c8a9b45690076bdedbabeba81c8ffbcd64277cc41d27d31ba79b82f` |

Diagnostic files are under ignored evidence; this report is the only review file added. No product main/bridge/driver/packaged-test edit, runtime build, dependency change, retry-to-pass, full suite, commit, push or original evidence rewrite occurred. This investigation does not admit Windows1, terminal shell ownership or recovery behavior.

## Addendum: separately authorized initial-load gate control

After the failed diagnostic above, the parent authorized exactly one differential native control for a new concrete hypothesis: native bridge PIN setup/unlock can acknowledge while the initial document is still loading, permitting the probe to reload during the first native load; delaying mutation and acknowledgement until that first load finishes may prevent the captured boundary. The first failure record and all its result/log/source artifacts remain unchanged. Its original preparation script is also retained as `package-reload-causal-2026-10-02T22-51-41.381Z/preparation.mjs` with the SHA256 recorded above.

Separate evidence: `desktop/evidence/package-reload-causal-gated-2026-10-02T22-58-32.008Z/`. The new clone has the same logging instrumentation, driver, byte-identical native probe, synthetic fixture, flag set, immediate reload expression, condition, and 20/30-second command/condition deadlines. Its only behavioral change creates an initial-load promise from listeners attached before `loadURL`, settles it on native `did-finish-load`, and requires it before `setupPin` or `unlockPin` can mutate PIN state or acknowledge success. A 10-second gate timeout or a main-frame load failure other than aborted navigation refuses mutation; the oracle deadlines were not expanded. All 105 other archive members and the runtime executable were again verified byte-identical to baseline.

The command, executed once with approved `require_escalated`, was:

```text
node evidence/package-reload-causal-gated-2026-10-02T22-58-32.008Z/probe.mjs
```

This diagnostic returned `completed: true` and `unlockedRendererObserved: true`. There were two total native runs in this investigation, one failing ungated observation and this separately authorized control; neither variant was retried.

| Gated main time | Captured boundary |
| --- | --- |
| 320 ms | Initial gate listeners bound before initial `loadURL` entry at 321 ms |
| 570 ms | Native setup service waits for initial load before mutation |
| 762 ms | Main heartbeat continues while the initial document loads |
| 799 ms | Initial native DOM-ready |
| 803 ms | Native `did-finish-load`; gate settles and admits setup; initial `loadURL` returns |
| 897 ms | Native setup succeeds and acknowledges unlocked state |
| 901 ms | Reload starts |
| 902–903 ms | Second `/app.html` protocol entry, resolution and fetch return status 200 |
| 908 ms | New frame navigation and synchronous bootstrap returns with native unlocked state |

The initial load completed before native setup acknowledgement. The immediate post-reload CDP condition was sent at driver time 535 ms, new contexts arrived at 546 ms, and the condition responded successfully at 546 ms. The driver and main clocks remain separately based. No post-reload heartbeat tick was captured: the short successful observation ended before the next 250 ms interval. The second protocol request and bootstrap receipt directly show main-side progress after reload.

The subsequent observation still reported `readyState: 'loading'` and `bodyPresent: false`, with mode normal, readonly false, PIN unlocked and snapshot schema 1. Thus this control verifies the original bootstrap oracle, **not** completion of the reloaded DOM, rendering, restoration, save, or a full packaged probe.

| Control artifact | SHA256 |
| --- | --- |
| Gated diagnostic ASAR | `3bc200cc7ce2f824c1e8e12b0c2fc50a088834dcebf072209a25a4ba3b7bd00b` |
| Gated diagnostic main | `10e00f383a9a0235f8f0c26438b752909db19e9ae3ab0526279035a41830132a` |
| Driver (same as failed diagnostic) | `63a2ed8fe8c56570cbb50466c3233f66c4fa16cd6436042663b72ff23c60e7c0` |
| Probe (byte-identical to failed diagnostic) | `986d5351bfdfd2673ebaa925007848b5969895a21726b2da28bab43cd6df0740` |
| Gated preparation script copy | `6a19d7717a8b0b57f484cdfa6a84df31e3488a7ddb3004c276993240ba4c9d33` |

The differential supports enforcing the narrow invariant that the initial native workspace load must finish before bridge PIN setup/unlock mutation and acknowledgement permits a reload. The gate prevented the previously captured early-startup overlap in this control. It does not establish the precise native deadlock mechanism, make every earlier loading-state success contradictory, or demonstrate a universal fix. The immutable original package probe remains FAILED, its blocking stack remains **UNKNOWN**, and any production helper/integration and full package verification belong to the parent. No product code was edited by this investigation.
