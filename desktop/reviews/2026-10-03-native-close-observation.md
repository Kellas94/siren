# Native close observation — inconclusive

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Scope: one explicitly authorized isolated native experimental launch; no product edits, existing probe/harness edits, retries, full suite, or production package qualification.

**Result: the observer timed out before app readiness. No native role window was created, and no close operation was measured. This supplies neither causal proof that `close()` returns before `closed` nor evidence of cancellation.** The earlier corrected shell probe's unspecified close refusal is not relabeled `CANCELLED` by this report.

The new ignored helper resides solely in `desktop/evidence/native-close-observation/`. It imports the current unmodified native factory, registry, protocol resolver, role preload, and WindowIPC, uses an isolated owned userData directory, and requests a synthetic read-only Docs scope. Its intended measurement calls the unchanged `registry.closeView` once and records native `close`, `closed`, `will-prevent-unload`, destruction, grant, and return-order flags. It installs no unload veto and does not replace native `close` or use `destroy` to simulate normal completion. Those intended measurement steps were **not reached**.

`node --check` passed before launch. One escalated native execution launched the verified Electron executable at `C:/Claude/SIREN_WORK/portable/desktop/node_modules/electron/dist/electron.exe`. The actual process reports Electron **44.5.1**, PID **18028**. Its launcher waited at most 9,500 ms; the observer's internal timeout was 8,000 ms. There was exactly one native launch.

Actual raw JSONL sequence (elapsed microseconds from observer initialization):

| Time | Event | Observation |
| ---: | --- | --- |
| 32 | observer-start | PID 18028; Electron 44.5.1 |
| 8,011,703 | hard-observation-timeout | No window, contents, or registry; `closeReturned=false`, `closedSeen=false`, zero close/unload events |
| 8,012,176 | observation-finished | Exit code 2; same absent native measurement state |
| 8,012,372 | owned-process-cleanup-app-exit | Owned process cleanup via `app.exit(2)` |

The launcher confirmed `waitedExit=true`, `exited=true`, **native exit code 2**, and `cleanup=not-needed`: no external force-stop occurred. A subsequent exact-PID inspection found PID 18028 absent. Native stderr is empty; stdout contains only CRLF. The PowerShell orchestration command itself returned exit code 0; this does **not** override the recorded native timeout/exit code 2.

The observer stops at its top-level `await app.whenReady()` (observer line 42); `app-ready` is absent. An ESM initialization/readiness interaction is a plausible observer limitation, but its mechanism was not verified in this launch. I preserved the observer and its evidence unchanged after execution and sent the inconclusive outcome immediately to `/root`. A new authorized experiment would be needed to establish close timing. This run does not support a registry fix, native PASS, unit PASS, or production/package admission.

SHA-256 identities captured after the single execution:

| File | SHA-256 |
| --- | --- |
| `desktop/evidence/native-close-observation/package.json` | `496ebc72ce21d617ab67f744b582f9fcf9c484f3b8f03909975ae5c9b15bc3a6` |
| `desktop/evidence/native-close-observation/observer.mjs` | `2f3d4de94b997ddeeb97bb68430be0b7bd4dcd6bf517c5354826428b74e83f8a` |
| `desktop/evidence/native-close-observation/observation.jsonl` | `236d0ebf6f7ab6d5a7b91c1f04f7606b31a4c8f62bf360f40e6a6110decc1a84` |
| `desktop/evidence/native-close-observation/launcher.json` | `69129335b34a571ebb017c65675588131aac9be4f69f44fe5435afbf23c84946` |
| `desktop/evidence/native-close-observation/native.stdout.log` | `7eb70257593da06f682a3ddda54a9d260d4fc514f645237f5ca74b08f8da61a6` |
| `desktop/evidence/native-close-observation/native.stderr.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `desktop/src/windows/registry.mjs` | `275926961b2b7fcd1f07f8e3d94e0e1bf8e2bf125c92285a791163324e62ad28` |
| `desktop/src/windows/factory.mjs` | `3cbdf1e52f0512a94af6148a6b531892fe6a439c3726ada46562c4e1d835437d` |
| `desktop/src/windows/ipc.mjs` | `bead48b66f55229514c5c51bdf2ccd71d6002e2db0f93eda96a05eb93a514295` |
| `desktop/src/windows/preload.cjs` | `a9c8efbdd81c4a9c55964530211be2ca819beb439d3283f4634a9ab45f38871b` |
| `desktop/src/windows/geometry.mjs` | `ec4d3f778df89df18db214178ba00690a713714cb3d8937361901d755dbe8333` |
| `desktop/src/protocol.mjs` | `2e9494bc36a63557fd921ed79d2284d6e6452a6f998ed5350e3f342c686538b3` |
| `desktop/generated/windows/docs.html` | `bf3eec20cbadf5d0d966fc2950d99370a5008b839e6eb52d58a213c50c2cec11` |
| `desktop/node_modules/electron/dist/electron.exe` | `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa` |

Dependency identities describe what the observer was prepared to exercise; they are not proof that the native factory/protocol/preload/registry close paths actually ran. `git check-ignore` confirmed the observer is ignored evidence. Only this report is intended as a tracked deliverable.
