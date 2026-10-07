# Native close fix independent review

Author: independent agent `/root/source_authority_review`.
Date: 2026-10-03. Scope: `src/windows/registry.mjs`, `src/windows/ipc.mjs`, and their focused Node tests. No product edits, existing tests/harness edits, full suite, or native launch in this review. The separate callback native experiment established the original false-before-closed behavior; its experimental result does not qualify this fix.

**Initial verdict: CHANGES REQUIRED.** The supplied 58 focused tests pass, but independent adverse assertions reproduce two authority failures and one misleading deadline receipt. All findings were sent immediately to `/root`, with actual failing logs. Source identities below describe the initial reviewed implementation; any corrected implementation needs a separate resolution section and fresh identities.

1. **Post-confirmation self-close bypasses final authority validation.** `ipc.mjs` in the awaited-self-close exception exempts an awaited `true` self-close from recheck. Registry confirmation at `registry.mjs` lines 214–222 runs in a preceding promise continuation. A microtask queued after the native `closed` event runs between those two continuations. Mutating project, epoch, exact sender object, exact senderFrame object, entity roster, or mode in that gap yields `{ok:true,closed:true}` instead of `SENDER_REFUSED`. The same parent-close gap correctly refuses. A plain `true` result cannot carry current authority across an await. Recommendation: a registry-owned close confirmation must be checked/consumed synchronously at IPC's final receipt boundary, retaining captured native identity, scope, epoch, and closure provenance while allowing normal self-close grant removal.

2. **Revocation destruction is mistaken for intentional self-close.** While close is pending, registered `will-navigate` or `render-process-gone` revocation invokes the registry's trusted destruction path. With the same scope/epoch and captured event objects, confirmation accepts the resulting destroyed window and IPC returns `{ok:true,closed:true}`. Both independent cases reproduce this. Expected: `SENDER_REFUSED` for a caller revoked by navigation/crash. Recommendation: latch non-close revocation provenance for the pending operation; do not equate arbitrary native destruction with the authorized normal close. Normal destruction's grant forgetting must remain distinguishable from revocation.

3. **Deadline reports observed cancellation without observing it.** The registry's line 247 deadline resolves false and IPC maps false to `CANCELLED`. Independent 20 ms deadline measurement leaves the native window and grant alive but receives `Native window close cancelled`. Expected: a distinct sanitized `WINDOW_CLOSE_TIMEOUT` or equivalent unknown-completion outcome. A deadline alone does not prove a user/native veto, and a later native completion remains possible.

The original independent command `node --test desktop/tests/window-registry.test.mjs desktop/tests/window-ipc.test.mjs` passed **58/58**, Node exit **0**, duration 136.3205 ms. Evidence: `desktop/evidence/native-close-independent-focused.log`. Root's separate RED/GREEN logs are not substituted for this independent run.

The new ignored `desktop/evidence/native-close-fix-independent.test.mjs` imports the actual registry and IPC with EventEmitter native doubles. Initial run, before the two revocation cases were added: **8 tests, 1 pass, 7 fail**, Node exit **1**, duration 84.801 ms; log `native-close-fix-independent-red.log`. Six failures are the post-confirmation self-close cases, one is timeout labeling, and the parent-close control passes. After adding the two revocation cases, `node --test --test-name-pattern='revocation for intentional close' desktop/evidence/native-close-fix-independent.test.mjs` produced **2 tests, 0 pass, 2 fail**, Node exit **1**, duration 62.3677 ms; log `native-close-fix-revocation-independent-red.log`. The current probe contains ten scenarios; these two executions are not falsely represented as a single ten-test run.

The existing implementation correctly waits for an asynchronous native `closed` event, retains a grant while closure is pending, preserves a synchronous fast path, coalesces native close initiation, caps its wait, and avoids forcibly destroying a vetoed/unresponsive view. Those behaviors do not resolve the adverse receipt/authority findings above. This review has not physically exercised unload veto behavior or admitted a production package.

Initial SHA-256 identities:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/registry.mjs` | `868ab882065b5a05b0f47fbbad397611adee2bad9eb97b8ff982111f3c3c3eb1` |
| `desktop/src/windows/ipc.mjs` | `52c9e83a117d67c7eb3ec48997c4bbeae321d494103251528f7f82c01c988112` |
| `desktop/tests/window-registry.test.mjs` | `62e823845373cad4e05bb9e2bf5b9dd49c9c755e0ce9dafa570f9a1a3faeea21` |
| `desktop/tests/window-ipc.test.mjs` | `bf14bda2b2a17d8ff62031c2a1bd17870643247a5e473ba4bbc79dc5347f815b` |
| `desktop/evidence/native-close-independent-focused.log` | `a83bef0908dfefb5ebcb3d67347db6a5881c8097a9585e0edc7ecb0b427cb9df` |
| Current ten-scenario `desktop/evidence/native-close-fix-independent.test.mjs` | `0083e805e524b8eab98041e43d5dcd404344095b9a4a52b2f01169f5c47f5963` |
| `desktop/evidence/native-close-fix-independent-red.log` | `0f9765852b6660b832c7d12611249314ba8c4ab162eda81902e318093896d636` |
| `desktop/evidence/native-close-fix-revocation-independent-red.log` | `70e25ed4bcd74691c7b8eaee2f2057070ed11cbf93cc9b82ad6a23e3c1bb2dd0` |

Failed assertion evidence is preserved. This initial review makes no corrected-source PASS claim.

## Corrected-source resolution

**Final verdict: APPROVED for the reviewed source/unit boundary at the final identities below.** The initial CHANGES REQUIRED findings and failed logs above remain preserved; this section records a distinct corrected implementation. No native/full-suite/package qualification follows from this verdict.

Root now creates a private WeakMap proof only after successful native close confirmation. `confirmClosedCaller` consumes that event-keyed proof once and revalidates the captured sender/frame, current scope/entity authorization, current epoch, and native window destruction synchronously at IPC's final return boundary. Both synchronous and asynchronous self-close receipts require that proof; parent-close awaited receipts retain their ordinary live caller recheck. Navigation/crash and trusted discard latch non-close revocation on the pending entry, preventing those destruction paths from producing an intentional self-close proof. The bounded deadline now rejects a known sanitized `WINDOW_CLOSE_TIMEOUT` instead of asserting cancellation, retaining the unresponsive native window/grant.

I reran the unchanged retained ten-scenario adverse probe together with the current tracked focused tests:

`node --test desktop/tests/window-registry.test.mjs desktop/tests/window-ipc.test.mjs desktop/evidence/native-close-fix-independent.test.mjs`

Actual outcome: **70/70 passed**, Node exit **0**, duration **104.6421 ms**. All six post-confirmation mutation cases now refuse, the parent control still refuses, both navigation/crash cases now refuse, and timeout now reports `WINDOW_CLOSE_TIMEOUT`. Evidence: `desktop/evidence/native-close-fix-independent-final.log`. This count is the actual independent combined execution, not a reproduction of root's separately reported counts.

I also authored and ran `node --test desktop/evidence/native-close-controls-independent.test.mjs`: **6/6 passed**, Node exit **0**, duration **65.0602 ms**. These controls verify one native close initiation for coalesced observers, close-event veto preserving a grant, renderer unload veto preserving a grant, overridden unload veto permitting later closure, webContents destruction alone not confirming BrowserWindow close, and successful self-close consuming its proof so a second consume/forged event has no proof. These are native doubles, not physical veto measurements.

The handler's veto directions match Electron's primary documentation: preventing the BrowserWindow close event cancels closure, while preventing `will-prevent-unload` overrides the renderer's unload veto. Checked against [Electron BrowserWindow close documentation](https://www.electronjs.org/docs/latest/api/browser-window#event-close) and [Electron webContents unload documentation](https://www.electronjs.org/docs/latest/api/web-contents#event-will-prevent-unload). Documentation consistency and data-only controls do not substitute for a native post-fix experiment.

Final SHA-256 identities captured after the independent executions:

| File | SHA-256 |
| --- | --- |
| `desktop/src/windows/registry.mjs` | `bf5138cf8ba028ede0b02722eece85e9185d4f1cf34c243e80e2bc3d8f8b670d` |
| `desktop/src/windows/ipc.mjs` | `d0b094e6cdc9804c97db6457e539bb9f36fdefdc9f94443dd50abd19c006cfd2` |
| `desktop/tests/window-registry.test.mjs` | `406ec796b86d0eb328724abfd3e92aa706eab10824b627099ee085c53338361d` |
| `desktop/tests/window-ipc.test.mjs` | `0608e5217d9718cde7a8db848f392e46c739c8aa821403f9b2dee27eb3d7d2c4` |
| `desktop/evidence/native-close-fix-independent-final.log` | `6ee998e673a40a935e9c63b383ecc7e2bf41b70a26f751f9d07e5de354c37c33` |
| `desktop/evidence/native-close-controls-independent.test.mjs` | `6bf8919fccbbf08d441a511a27d452dbefb5f760e760d0b6fc63ea47f614e060` |
| `desktop/evidence/native-close-controls-independent-green.log` | `4a62f1802ccb69c6aa23f53dae9b63af60bf0b8d5aae75898bfe081f542cfc2f` |

There are no unresolved actionable source findings in this reviewed fix. Actual Electron post-fix self-close receipts, native cancellation/unload-veto behavior, full-app transitions, and production package admission remain outside this review and require their own evidence.

Root subsequently added two tracked test cases without changing the reviewed product bytes. I refreshed the same combined command before the separately authorized native shell experiment: **72/72 passed**, Node exit **0**, duration **113.3667 ms**, log `desktop/evidence/native-close-fix-expanded-independent-final.log` SHA-256 `63c455b17b6ec60d6c57c7509f87f177bc1c56f8e74ca7c2102ba1b8fde99be3`. Final `window-ipc.test.mjs` SHA-256 is now `5a58da178eddadd2cfbd77fb3f98e78155a8e4208a8bac21cf6a65e2d8a8b76c`; `window-registry.test.mjs`, registry, and IPC identities remain as in the resolution table. The prior independent executions and test identities are retained as historical evidence, rather than relabeled as this expanded run. The native shell experiment is documented separately in `2026-10-03-native-window-shell-close-fixed-probe.md`.
