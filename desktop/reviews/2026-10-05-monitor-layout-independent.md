# Independent scoped review: monitor chooser and layout memory

Author: `/root/monitor_layout_review`, separate reviewer agent. Date: 2026-10-05.

This is a scoped source review and the explicitly described Node boundary execution below. It is not a whole-feature PASS, release approval, package qualification, physical monitor test, or a claim that the reviewer executed the root agent's evidence. Source was being changed concurrently by the implementing root agent; intermediate findings and test results are retained here rather than rewritten as pre-existing approvals.

## Findings

### P2 — Native layout reservation initially rejected valid imported entity IDs

Initial reviewed `src/windows/layout-memory.mjs:57` applied the project/source `validId` grammar to every native entity. Existing `src/windows/entities.mjs:5` and `src/windows/registry.mjs` accept `^[A-Za-z0-9_-]{1,128}$` for Docs/Diagram/deck identity, so valid imported `DocA`, `_notes`, `FlowA`, and `_deck` entries passed the roster but threw `INVALID_LAYOUT_IDENTITY` when the factory reserved geometry. This prevents native Docs/Diagram/Presenter/Audience windows from opening, even though the ID is only hashed for layout storage and is never used as a filesystem component.

Independent no-file-write Node execution confirmed the roster included those IDs and all eight role/identity reservation calls threw the error. The root agent subsequently changed line 57 to the native registry entity grammar while retaining project ID validation. The reviewer inspected that correction; the newly added identity test passed during the reviewer's focused rerun. The original adverse observation remains valid for the initial reviewed version.

### P2 — Cancelled native placement can persist a temporary fullscreen exit

At the initially reviewed `src/windows/layout.mjs:67–72`, moving a fullscreen native view first exits fullscreen and waits for ordinary geometry. `src/windows/layout-memory.mjs:51,67–69` immediately captures those native events as persistent metadata. If Lock/selection retires the view during that wait, `layout.mjs:89–93` correctly refuses to restore its now-retired native handle, but the metadata has already been changed from fullscreen=true to fullscreen=false. Reopening/restarting consequently restores the temporary mode instead of the last stable user mode. The same mechanism can affect maximized state.

Independent Node execution used the real `NativeWindowLayout` and `NativeLayoutMemory` classes with a method-complete EventEmitter native boundary and an in-memory metadata store. The control case completed the move with initial/saved/actual fullscreen=true. The otherwise identical case emitted the real capture callback on fullscreen exit, then revoked the captured grant in a microtask to represent Lock. It returned false and left saved fullscreen=false, starting from true. This establishes the integration defect at the adapter boundary; it does not claim reproduction on physical Electron displays.

Correction requested: fence/defer metadata capture for the temporary native layout transaction and retain the last stable mode on cancellation. Do not weaken the existing current-grant checks or restore/reveal a retired data window merely to repair metadata. Root was implementing this correction during the review; its final tests and native evidence are separate work.

## Actual reviewer execution

- `node --test tests/window-layout.test.mjs tests/window-layout-memory.test.mjs`: 31/31 passed, zero skips/cancellations/todos, before the implementing root agent added the two regression tests above. This did not detect either integration gap.
- Independent no-file-write imported-ID boundary reproduction: all eight initially admitted uppercase/underscore Docs/Diagram/Presenter/Audience reservations failed as described above.
- Independent cancelled-placement boundary reproduction, with a complete native geometry adapter: `{lock:false, initialSavedFullscreen:true, moveResult:true, savedFullscreen:true, actualFullscreen:true}`; `{lock:true, initialSavedFullscreen:true, moveResult:false, savedFullscreen:false, actualFullscreen:false}`.
- Actual temporary-directory Windows junction checks: with `UI` pointing to a separately owned outside directory, an absent layout file allowed initial empty-store fallback but flush returned false and created no outside file; an existing outside layout file made initialize/remember/flush all return false and left its exact sentinel bytes unchanged. These checks do not qualify arbitrary filesystem races or file symlink scenarios.
- A subsequent focused `node --test tests/window-layout-memory.test.mjs` ran concurrently with root edits: 7 cases, 6 passed and 1 failed. The imported-ID regression was GREEN. The new cancelled-placement case was RED because its requested `beginPlacement` adapter was not implemented yet (`typeof` actual `undefined`, expected `function`). This is an explicitly intermediate result, not final qualification.

## Remaining static review scope

Reviewed native opaque one-use monitor tickets, captured origin frame, display topology/generation invalidation, bounded staged native readbacks, mode preservation, ordinary owned-file/directory checks, 64 live reservations and 128 persisted entries/64 KiB metadata bounds, duplicate-slot reuse, hidden factory creation and admission/show integration, all-window close/Lock retirement, restart restoration, and package inclusion of `layout-memory.mjs`. No additional concrete issue was established in those inspected paths. Duplicate slots are keyed by project/role/entity/version plus a finite slot; metadata contains only hashed identity and layout. Monitor move authority remains inside a native menu closure and is not exposed as a renderer IPC channel.

Physical unplug, mixed-DPI display transitions, actual Electron cancellation/restart timing, final corrected-source tests, package identities, and hosted CI remain the root agent's explicit qualification scope. This report does not attest to those executions.

## Implementer follow-up received after this report was written

The root agent reported reproducing the second defect at both the memory boundary and controller invocation, retaining the REDs, adding a one-use `NativeLayoutMemory.beginPlacement` suspension/finalization adapter, injecting it in main, and finalizing only after settled native modes. Root reported 41/41 focused tests GREEN (memory 7, layout 27, integration 7). These are explicitly root-owned correction and test claims delivered to the reviewer; this reviewer did not execute that final 41-test set. Runtime verification was still ongoing at the handoff. The original observations and intermediate RED above are preserved without conversion to a reviewer-authored PASS.
