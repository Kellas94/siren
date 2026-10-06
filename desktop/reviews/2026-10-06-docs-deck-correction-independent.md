# Independent correction review: Docs Save history

Author: `/root/docs_deck_batch_review`, separately delegated reviewer. Exact correction reviewed: `2c54954c4e789cf428fd54dd625e717bf369a650`. Correction diff against previously reviewed `9807ab5d037c7058c6e30baeb5ae0d72e979b2ad`; original whole-batch comparison was against `206b79e`.

Decision: **the independently reproduced P2 finding is resolved in the reviewed correction**. No additional blocking finding was identified in this correction review. This decision covers inspected code and my independently executed unit/regression tests only; it is not native, packaged, hosted or release approval.

## What changed and why the finding is closed

The accepted Docs save now resets history only when the saved payload contained a context patch. An ordinary title/body `replace-content` save preserves its existing Undo/Redo stacks. The durable new test exercises Save, Undo against the saved baseline, Redo back to clean state, then Undo and a second explicit save using the new version. It also checks retained agent/release fields and a remaining Redo stack. This covers meaningful behavior rather than merely asserting the conditional implementation.

For context saves, the correction deliberately establishes a new history baseline instead of attempting to replay base-relative partial context patches against a changed saved document. The context draft test now explicitly asserts that policy. Both the context sheet and the guide explain that context is undoable until saved, that a context save starts a new history, and that unapplied form values are canceled when closing or locking. This preserves the explicit Apply/Cancel contract and corrects the previously ambiguous introduction. It does not grant a stale retry or silently apply unconfirmed values.

I inspected all six correction product/test files: `src/ui/docs/draft.js`, `src/ui/docs/context.js`, `src/ui/workspace/guide.js`, `tests/docs-draft.test.mjs`, `tests/docs-context-draft.test.mjs`, and `tests/native/docs-format.mjs`. The seventh changed file is the retained original independent report, first committed in this correction; I did not edit that original report. The added native probe has substantive exact before-colour Undo / saved-colour Redo HTML expectations and verifies that these local history operations do not rewrite the saved project. I inspected this probe but did not execute it.

## My independent executions

- My original before/after reproducer and adverse log remain unchanged: `desktop/evidence/docs-deck-independent-history-9807ab5.test.mjs` and `.log` (BASE passed, originally reviewed source failed).
- I created a separate correction reproducer that loads the draft directly from Git at the exact correction SHA, rather than relying on a mutable working-tree read. `desktop/evidence/docs-deck-independent-history-correction-2c54954.test.mjs` and `.log`: **2 passed**, BASE and correction both preserve ordinary Save → Undo, restore the original title and mark the draft dirty; Node exit 0.
- I independently reran the affected suite, adding ordinary Docs draft/history tests to the original review selection. `desktop/evidence/docs-deck-independent-units-correction-2c54954.log`: **74 passed**, zero failures, skips, cancellations or todos; Node exit 0. Files: Docs draft/context/reference, presentation authoring/draft/navigation, scoped domain owner/validator/catalog, and presentation deck/IPC/session boundary tests.
- HEAD was checked as `2c54954c4e789cf428fd54dd625e717bf369a650` around these executions. No production file was changed by this reviewer.

## Limits

The code/security/UI architecture conclusions and scope exclusions in the original report remain applicable. I did not launch Electron or native GUI, perform a build/full-suite run, execute portable copies, verify hosted Actions, inspect physical displays/DPI or grant merge/release approval. Coordinator-provided native/full/package statuses are not my executions. Those qualification steps must apply to the final corrected source independently of this finding closure. Context commits still intentionally reset their history, and unapplied context-sheet values remain temporary proposals; these are disclosed product behaviors, not claims of complete recovery or unbounded editing.
