### Scope and strengths

I reviewed the Window-menu batch against HEAD `319ce3d2aa25bbad02ed1ba2246e36aa8463fcf9`: `focus.mjs`, main menu/transition wiring, package whitelist, unit tests, native probe and keyboard instrumentation, plus the registry methods they depend on.

- Cycling uses genuine captured native frames. It rejects mismatched window/project identities, bounds the roster to 64 entries and rechecks the transition predicate before selecting a target.
- `WindowRegistry.focusView()` revalidates the original frame, exact URL, epoch and current native policy before restoring/focusing. Replaced frames and changed permissions therefore fail closed.
- The main predicate covers Lock, selection/access transitions, quiescence, view closing, the workspace barrier and native-shell failure.
- Main-window return restores the permanent window without opening a data view, navigating, saving or issuing a grant. Its availability while locked does not confer project access.
- The package whitelist includes the new runtime module.
- Keyboard instrumentation verifies the launched main-process PID and sends bounded key events through Electron’s actual `WebContents.sendInputEvent` API. The probe observes minimized/focused native state and checks project/source invariance. This exercises Electron’s accelerator route through fixture instrumentation; it is not physical keyboard or monitor qualification.

### Critical findings

None found.

### Important findings

1. **The native probe omits the implementation module from its input provenance.**

   File: [window-focus.mjs:17](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/window-focus.mjs:17)

   The before/after capture includes `main.mjs` and `registry.mjs`, but omits `src/windows/focus.mjs`, which implements the new behavior. A change to that helper during the standalone probe can leave all recorded inputs unchanged and allow a `COMPLETE` receipt.

   Add `src/windows/focus.mjs` to `paths`, then qualify the resulting frozen probe. Preserve the existing adverse receipt separately. This is a qualification/provenance gap; I found no corresponding product-authority defect.

### Minor findings

None identified.

### Evidence and execution boundaries

I inspected `evidence/window-focus/2026-10-04T21-15-48.777Z/result.json`. It remains **ADVERSE**, with zero completed cases, unchanged captured inputs and failure to restore/focus minimized Code through the next-window accelerator. I did not reinterpret that result as success.

The reported focused 50-test result is root-provided execution evidence, not a test run performed by this reviewer. I did not assess a completed outcome for the active native probe.

**I ran no tests, builds or applications, spawned no agents and changed no files, index, HEAD or branch state.**

### Declined to judge

- Completion of the active native probe: no completed result was assessed.
- Exact packaged execution and hosted CI: neither was exercised or inspected for this batch.
- Physical keyboard, monitor and mixed-DPI behavior: fixture input cannot establish those results.
- Whole-branch, release or full-plan readiness: outside this scoped review.
- The preceding malformed-Code fixture: retained separately; not used to judge shortcut behavior.

### Assessment

**Ready for scoped commit: With fixes and completed qualification.**

The product focus/authority paths are sound on static inspection. Correct the native input capture and obtain completed frozen qualification before treating this batch as qualified. This review grants no PASS to the active execution, package, hosted CI or whole plan.
