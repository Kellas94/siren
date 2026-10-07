### Separate addendum: exact style restoration and VM initialization

**The prior Minor finding is resolved. No remaining Critical, Important or Minor finding was identified in this scoped follow-up.**

[toast-observation.mjs:8](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/toast-observation.mjs:8) now captures the raw `style` attribute. Its `finally` restores that exact string, or removes the attribute when originally absent. This preserves CSS priorities and unrelated inline declarations.

The actual priority case at [toast-transition.mjs:21](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/toast-transition.mjs:21) sets both properties with `!important`, then compares complete `cssText` and both priorities after observation. The opacity, top-layer, hidden-visibility and deliberately visible negative-control checks remain.

The unit fixture explicitly models only the DOM attribute boundary. It does not claim to reproduce CSS transitions or priorities; those are exercised by the native characterization.

The integration fixture now imports the actual `NativeWindowFocus` and binding function, and executes the controller-construction slice from main before admitting shells. Existing admission, authority, destruction and close assertions remain. The added listener-count assertion verifies binding installation; it does not independently qualify keyboard routing.

### Inspected evidence

- `toast-transition/2026-10-04T21-38-12.283Z/result.json` remains **ADVERSE**, showing the lost `!important` priorities with unchanged captured inputs.
- `toast-transition/2026-10-04T21-39-16.518Z/result.json` records **COMPLETE**, three cases, restored priorities, a detected visible negative control and unchanged captured inputs.
- `window-focus-qualification-result.json` remains **ADVERSE**, with its full-suite child exiting 1 and no changed inputs.

These are inspected root execution records. I did not execute them or independently verify the reported focused 17/17 run.

### Boundaries and assessment

I inspected only the four requested test files, their relevant diff and the receipts above. **No tests, builds, applications or subagents were run; no files, index or HEAD were changed.**

The upcoming frozen qualification, hosted CI, package execution and whole-feature readiness remain unjudged.

**The scoped corrections are accepted on review.** Earlier reports and adverse executions retain their original verdicts; this addendum grants no whole-feature or execution PASS.
