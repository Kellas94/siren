# Callback native close observation

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Scope: one separately authorized isolated native experimental launch against unchanged product code. This is causal measurement of one native normal-close operation, not a unit-suite PASS, full-app result, or production/package qualification.

**Observed: `registry.closeView()` returned `false` before a successful native normal close completed.** Its return snapshot still had a live window, live contents, and present registry grant. The native `closed` event followed **8,098 microseconds later**, with the window and contents destroyed and the grant absent. The native close event's `defaultPrevented` flag was false both during dispatch and in its microtask; zero `will-prevent-unload` events occurred. No forced destruction simulated normal close.

The original timeout attempt and report remain unchanged. This new helper is solely in ignored `desktop/evidence/native-close-observation-callback/`. The only observer-code difference is replacing the top-level `await app.whenReady()` initialization with `app.whenReady().then(async () => { ... }).catch(...)`. The original measurement body, current product imports, timing, close operation, event listeners, and oracle remain unchanged. `node --check` succeeded before the one native launch. Callback initialization reached app readiness; this controlled differential does not independently establish the exclusive mechanism behind the previous stall.

The actual Electron executable reports **44.5.1**, PID **36496**. The factory loaded the existing generated Docs role entry through the current protocol resolver and sandbox role preload. Recorded preferences were `sandbox=true`, `contextIsolation=true`, `nodeIntegration=false`; the exact registered role URL matched. The project/document identifiers were synthetic (`observation_project`, `observation_doc`), with read-only authorization. The factory-created native window was registered, sent the existing ready notification, and shown before the observation. There was exactly one native launch and one `registry.closeView()` call in this authorized experiment.

Raw sequence (elapsed microseconds from observer initialization):

| Time | Event | Recorded state |
| ---: | --- | --- |
| 27 | observer-start | PID 36496; Electron 44.5.1 |
| 28,449 | app-ready | Callback initialization admitted |
| 46,531 | factory-native-created | Native window ID 1; contents ID 1 |
| 92,329 | registered-ready | Live window/contents; grant present; one view; exact role URL and sandbox preferences verified |
| 217,577 | before-registry-close-call | Live window/contents; grant present; one view |
| 219,487 | native-close-event | `defaultPrevented=false`; window/contents live; grant present |
| 219,707 | after-registry-close-return | **returned=false**; window/contents live; grant present; `closedSeen=false` |
| 219,952 | native-close-event-microtask | `defaultPrevented=false`; window/contents live; grant present |
| 220,122 | after-return-microtask | Window/contents live; grant present |
| 221,958 | native-contents-destroyed | Contents destroyed; grant absent; zero views; window not yet destroyed |
| 227,805 | native-closed-event | Window and contents destroyed; grant absent; zero views |
| 232,640 | after-return-immediate | Window/contents destroyed; grant absent; close observed |
| 384,811 | observation-finished | Exit code 0; destroyed window/contents; grant absent |
| 385,074 | owned-process-cleanup-app-exit | Cleanup of owned process via `app.exit(0)`, after normal close completed |

The raw JSONL also retains the window-all-closed event and 0/25/100 ms timer samples. The 8,000 ms internal hard timeout never fired. The launcher waited at most 9,500 ms and confirmed native exit code **0**, `waitedExit=true`, `exited=true`, `cleanup=not-needed`; there was no external force-stop. Exact PID 36496 was absent on subsequent inspection. Native stdout contains CRLF only; stderr is empty. The PowerShell launcher returned exit code 0 as well.

This establishes an actionable mismatch in the measured registry snapshot: its synchronous destruction check reports false during an accepted native close which later completes. Source inspection shows the existing WindowIPC maps a false close result to `CANCELLED`; **that is a source-derived implication, not a measured IPC receipt in this direct registry experiment**. The earlier corrected shell probe did not retain its refusal code, and this report does not retroactively assign one to it. A change must account separately for pending close, actual cancellation, destruction/grant revocation, and self-close authorization; this measurement does not qualify any proposed fix.

I sent the exact native sequence to `/root` immediately after observation, before any root fix. There were no product edits, existing harness/probe edits, or retries under this authorization.

SHA-256 identities, captured after the execution while product files still matched their prelaunch identities:

| File | SHA-256 |
| --- | --- |
| `desktop/evidence/native-close-observation-callback/package.json` | `496ebc72ce21d617ab67f744b582f9fcf9c484f3b8f03909975ae5c9b15bc3a6` |
| `desktop/evidence/native-close-observation-callback/observer.mjs` | `d29c0b54f813c36eb7c3c58b694157bab913149a047a0c3e0d9f7ea9eb99ba30` |
| `desktop/evidence/native-close-observation-callback/observation.jsonl` | `6227a079ef95757d7893ce5beb8d7090cbad8ce28098bb8534d0600966202bb5` |
| `desktop/evidence/native-close-observation-callback/launcher.json` | `2d3d47bcc68cbfbecd51591ae1c702d64f6fab1d5382b66e1134aa6700896f01` |
| `desktop/evidence/native-close-observation-callback/native.stdout.log` | `7eb70257593da06f682a3ddda54a9d260d4fc514f645237f5ca74b08f8da61a6` |
| `desktop/evidence/native-close-observation-callback/native.stderr.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Preserved original `desktop/evidence/native-close-observation/observer.mjs` | `2f3d4de94b997ddeeb97bb68430be0b7bd4dcd6bf517c5354826428b74e83f8a` |
| Preserved original `desktop/evidence/native-close-observation/observation.jsonl` | `236d0ebf6f7ab6d5a7b91c1f04f7606b31a4c8f62bf360f40e6a6110decc1a84` |
| `desktop/src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `desktop/src/windows/factory.mjs` | `3cbdf1e52f0512a94af6148a6b531892fe6a439c3726ada46562c4e1d835437d` |
| `desktop/src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `desktop/src/windows/preload.cjs` | `a9c8efbdd81c4a9c55964530211be2ca819beb439d3283f4634a9ab45f38871b` |
| `desktop/src/windows/geometry.mjs` | `ec4d3f778df89df18db214178ba00690a713714cb3d8937361901d755dbe8333` |
| `desktop/src/protocol.mjs` | `2e9494bc36a63557fd921ed79d2284d6e6452a6f998ed5350e3f342c686538b3` |
| `desktop/generated/windows/docs.html` | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |
| `desktop/node_modules/electron/dist/electron.exe` | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

`git check-ignore` confirmed the new observer is ignored evidence. Only this report is intended as a tracked deliverable. No physical multi-monitor, full-app PIN/Lock/selection/quit behavior, package identity, user-cancelled close, or corrected close implementation was exercised by this experiment.
