### Separate addendum: native origin binding and provenance

**The provenance finding is resolved. The final origin binding is sound on static inspection; no new Critical, Important or Minor finding was identified.**

[window-focus.mjs:17](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/window-focus.mjs:17) now includes `src/windows/focus.mjs` in its before/after capture.

The binding at [focus.mjs:35](/C:/Claude/SIREN_WORK/portable/desktop/src/windows/focus.mjs:35):

- Handles only the intended Ctrl+Alt key-down combinations, excluding Shift, Meta and composition.
- Consumes recognized input before suppressing repeats, preventing repeated page/menu handling.
- Supplies the actual bound native window as the cycle origin.
- Reuses the existing transition predicate, captured-frame roster and registry focus-policy checks. An origin absent from that validated roster is refused.
- Keeps main-window return independent of data-view authority.

Main installs the binding on the primary window and created native shells. The existing primary keyboard handler has no overlapping action for these three combinations. The two added boundary tests exercise origin selection, repeat consumption, unrelated-input preservation and refusal from an unregistered handle.

### Inspected execution evidence

The menu-only receipt at `window-focus/2026-10-04T21-18-34.986Z/result.json` remains **ADVERSE**, with zero completed cases and the minimized-Code accelerator failure.

The subsequent `window-focus/2026-10-04T21-21-02.837Z/result.json` records **COMPLETE**, four successful cases, no error and identical before/after captured inputs. It includes the helper hash. I independently compared current `main.mjs`, `focus.mjs`, the native probe and keyboard instrumentation against that receipt; all four hashes match.

These are inspected root execution records. I did not run the probe. They establish the exercised Electron input route and fixture state assertions, without establishing physical keyboard or monitor behavior.

### Boundaries and assessment

I reviewed the corrected helper, main bindings, added tests, capture list and the two receipts. **No tests, builds, applications or subagents were run; no files, index or HEAD were changed.**

Package execution, hosted CI, physical displays and whole-plan readiness remain unjudged.

**The reviewed correction is accepted within scope.** The original adverse reports retain their verdicts; this addendum grants no package, hosted or whole-branch approval.
