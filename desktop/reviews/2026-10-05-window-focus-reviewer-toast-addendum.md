### Separate addendum: toast observer, characterization and CI integration

**The observer correction is appropriate as a test-only change. No Critical or Important finding was identified. It does not establish a product security repair or a CI75 PASS.**

[toast-observation.mjs:12](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/toast-observation.mjs:12) suspends the synthetic toast’s transition before forcing its opacity. Observation remains synchronous and still reads the actual popover state, computed opacity, computed visibility and `checkVisibility()`. The product rule hiding toast notifications beneath the open access screen is unchanged.

The new characterization preserves meaningful oracles:

- The retained RED reports a real top-layer toast with opacity 0 and visibility hidden, failing the opaque-fixture precondition.
- The GREEN reports opacity 1, visibility hidden and two completed cases with unchanged captured inputs.
- Its deliberate visibility override is detected as `visible: true`; the observer does not manufacture an isolation success.
- The characterization compares the restored synthetic fixture’s complete inline style, text, class state and popover state.

The CI change adds `window-focus` and `toast-transition` once to the desktop group, bringing it to 20 checks. Original checks, child-result requirements and job deadlines remain. Workflow additions retain the new JSON/PNG evidence. Window guide text matches the implemented commands, and the package whitelist includes the focus dependency.

### Minor finding

**Inline CSS priorities are not preserved by the observer’s restoration.**

File: [toast-observation.mjs:8](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/toast-observation.mjs:8)

The observer saves property values but not `getPropertyPriority()`. If the prior inline `transition` or `opacity` has `!important`, assignment followed by value-only restoration loses that priority. The current native characterization uses ordinary declarations, so its exact-restoration assertion does not cover this trigger.

This is a nonblocking fixture-restoration limitation, with no demonstrated product-security effect. Preserve each property’s priority using `setProperty`, or narrow the restoration claim to the tested fixture.

### Evidence and review boundaries

I inspected the observer, characterization, existing observer tests, access-screen assertions, native grouping/test changes, workflow diff, guide/package additions and retained RED/GREEN receipts.

The original copied CI75 result remains `completed: false`, at `light:toast-isolation`, failing the opacity precondition at `access-screen.mjs:63`. I did not independently verify hosted job outcomes or the downloaded ZIP identity.

**I ran no tests, builds or applications and changed no files, index or HEAD.**

### Declined to judge and assessment

Hosted CI75 recovery, whole-suite completion, exact packaged execution, physical-display behavior and whole-plan readiness remain unjudged. Transition-animation behavior is also not qualified by an observer that intentionally suspends that synthetic transition.

**The scoped test correction and CI integration are acceptable, with the minor restoration caveat above.** Retained adverse executions keep their original verdicts.
