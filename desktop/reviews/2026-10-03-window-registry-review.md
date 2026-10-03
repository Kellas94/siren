# WindowRegistry core independent review

Date: 2026-10-03. Reviewer and author: `/root/source_authority_review`, independent child reviewer assigned by `/root`. Scope: `desktop/src/windows/registry.mjs`, `desktop/tests/window-registry.test.mjs`, and the original implementation report, against Native Workspaces Task 1 and `docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md`. The reviewer owns only this report and made no runtime/test edits, commits, native launches, full-suite runs or package builds.

Final verdict: **APPROVED for the registry core source/unit boundary**, at the final hashes below. One P2 factory race was independently reproduced, reported before commit, corrected by `/root`, and independently verified. No unresolved blocking core correctness finding was identified. Native Workspaces Task 1 as a whole remains incomplete: main/preload/IPC/protocol/entrypoint/package integration and a native role-shell probe are outside this delivery.

## Original adverse review and resolved finding

Original verdict: **CHANGES REQUIRED**, despite an independent focused run of **27/27 tests passing**, exit 0, 70.0153 ms. The reviewed registry hash was `7d6c948bacf9cb0ce011e9e6a3881c6ed1fa9fbd4ce684ad120f1de08e36a5ce`; its test hash was `98b97d0492fe503e7810cd33c4e2ea66036185338f0403811e1ba79bb30ff130`.

**P2 — pending factory can publish a grant after another view's destruction fails.** Original location: `registry.mjs:79`, following the awaited native factory. `openView` checked `#destructionFailed` only at entry. A navigation destruction failure set that flag without changing the epoch, so an opening already awaiting its factory could pass the post-await policy/epoch validation and register a new active grant.

Independent reproduction used an EventEmitter native-boundary double with ordinary window/webContents IDs, frame URL, live/destroy APIs and events. Sequence:

1. Open a Docs view; start a Code opening whose ready factory promise remains unresolved.
2. Make Docs `destroy()` throw; emit Docs `will-navigate`.
3. Resolve the Code factory.

Actual original result: Code `openView` returned an active epoch-1 `ViewRecord`; `listViews()` contained that new Code view while destruction remained incomplete. The ad hoc script exited 0 and recorded the wrong result rather than asserting PASS. Expected: reject the pending opening, destroy its returned native window, publish no new grant, and require successful destruction retry before reopening. The reviewer sent this exact sequence to `/root` immediately.

Resolution by `/root`: add `this.#destructionFailed` to the post-await validation predicate at `registry.mjs:79` and add the focused pending-factory regression. The implementation owner reports an actual RED result of 27 passes/1 failure followed by 28/28 GREEN, retaining `desktop/evidence/window-registry-review-race-red.log` and `window-registry-review-race-green.log`. That RED is owner-reported evidence, separate from the reviewer's observed original reproduction and final verification. The implementation agent's original 27-test report remains untouched and retains its own authorship.

## Independent final verification

Command from `portable/desktop`: `node --test tests/window-registry.test.mjs`.

Actual live final result: **28 tests passed, 0 failed/skipped/cancelled, process exit 0, 70.9101 ms**. The added race regression passed.

The reviewer separately reran the factory-race scenario with assertions: the pending opening now rejects `ACCESS_REFUSED`, its returned native window is destroyed, no view/grant is published, and `listViews()` is empty. Restoring the failed native destroy implementation then successfully invalidates the epoch and permits a new authorized view. The same script opens a minimized Docs view and an Audience view, checks Audience's empty source entity grant, applies locked policy and invalidates, then checks every native double is destroyed and the old Audience caller is null. Actual exit 0: `independent fixed factory race, destruction retry, minimized/Audience invalidation, and empty Audience grant assertions passed`.

## Core assessment and integration obligations

Requests accept only the declared role/entity/version shape; project, window ID and epoch assertions cannot be supplied by the renderer. Native authorization is synchronous and validated, and pending factories are checked again after await. Unsupported/locked modes, readonly write policy, wrong entities, exceptions and asynchronous policy fail closed.

Caller identity binds the registered webContents object, native window/renderer IDs and relationship, original/current main-frame object, exact frame URL and webContents URL, epoch and current trusted project/mode/access/entity policy. Same-origin URLs, forged numeric IDs, subframes and replacement main-frame objects cannot independently authorize a caller. Grants and entity lists are frozen snapshots; later policy additions do not expand prior authority. Audience requires presentation authorization and receives no source entity IDs. A future role bridge must also forbid Audience source/project reads and writes; the empty entity grant alone is not a delivered IPC permission matrix or public-slide payload filter.

Crash/main navigation revokes the affected grant before destruction. Failed destruction retains the handle, blocks new admission, and can be retried through epoch invalidation. Epoch invalidation revokes all grants before attempting destruction and covers minimized and Audience views. A failed invalidation does not return success. Cancelled native closes remain registered, and closing one view preserves unrelated views. Focus restores minimized eligible views. The core imports no Electron and does not implement editor flush, source persistence, Lock, project selection, Quit, workspace reload or clean-close journaling; those later coordinator/integration boundaries must still prove their own acknowledgements.

The factory contract requires a ready hidden BrowserWindow and no project bootstrap/content publication while its promise is pending. The registry cannot cancel an unresolved external factory. The adapter owns sandbox/contextIsolation/no Node, readiness and show ordering, local resources/CSP, arbitrary navigation/popup/webview refusal, and window UI. `invalidateEpoch()` destroys all tracked views; the future coordinator must handle the specified locked workspace reload with null snapshot and editor drain before success. No actual BrowserWindow wrapper identity, native Lock, physical monitor behavior, window shelf, audience payload isolation, package/runtime allowlist, or integration was qualified by these unit doubles.

## Final reviewed SHA256

Captured after the independent final focused run and separate assertion script, on 2026-10-03:

| File | SHA256 |
| --- | --- |
| `desktop/src/windows/registry.mjs` | `ac2bbf4266884bdaf2cedd76ea4b34755d32c5cd8eb96a3b1ec03252274a1d26` |
| `desktop/tests/window-registry.test.mjs` | `32b0d2ce25cad8a93ca06ec8c09d0a93b691764c402a0fccf66f0e5999611a42` |
| `desktop/reviews/2026-10-03-window-registry-implementation.md` | `55c0d2d08efe7609494bc4e568fe37354ab7adce8c4ef8326c2c4a8585b7cbef` |

These hashes bind this source/core review; they are not package, ASAR, native binary or monitor qualification identities.
