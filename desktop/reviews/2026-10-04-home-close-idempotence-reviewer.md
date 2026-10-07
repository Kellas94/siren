### Separate addendum: repeated preparation idempotence

**The correction is sound on static review. No new Critical, Important or Minor finding was identified in this narrowly scoped change.** Execution qualification and replacement-package qualification remain pending.

The hook at [renderer.mjs:95](/C:/Claude/SIREN_WORK/portable/desktop/build/renderer.mjs:95) retains the existing draft only when its timestamp is valid and its entire parsed body, excluding `savedAt`, matches the newly serialized body. It suppresses timestamp-only churn without changing the selected-project oracle.

I checked the requested boundaries:

- **Complete equality and unknown fields:** the comparison retains every other enumerable JSON field, including nested diagram, Docs and Map fields. It does not filter caches, unknown fields or content. An older-only unknown field prevents deduplication. Property-order differences can also prevent deduplication; that is conservative extra writing, not false equality.
- **Larger recovery drafts:** unequal bodies continue into the existing diagram/document count guard. The new return cannot make a larger draft equal to a smaller payload. The intentional-shrink mechanism remains unchanged.
- **Private Code:** draft deduplication does not skip whole-bag serialization. Private Code still resides in the storage mirror and reaches the final selected workspace save.
- **Refusal:** the return exits `writeDraft`, not `markCleanExit` or close preparation. The final workspace operation and its acknowledgement checks still run. Recovery-only success still cannot substitute for a refused selected commit.
- **Rollback:** cancellation still unlocks storage, restores the running marker and queues its selected save. The timestamp hook does not bypass that path.
- **Baseline preservation:** the change is an asserted desktop build substitution; the frozen baseline is untouched.

The new deterministic test at [close-draft.test.mjs:80](/C:/Claude/SIREN_WORK/portable/desktop/tests/close-draft.test.mjs:80) compares the **complete selected snapshot** after repeated preparation. It does not discard timestamps, revisions or hashes. The following test verifies that changed zoom, private Code and the corresponding draft timestamp still reach selected storage. Existing larger-draft, refusal and cancellation cases remain.

### Inspected evidence

The retained packaged probe still fails its exact pre-restore preservation assertion at [packaged.mjs:124](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/packaged.mjs:124). Its package-probe record reports exit 1, unchanged captured inputs and identical before/after ASAR hashes.

`close-repeat-real-red.log` retains the deterministic timestamp-only revision failure. `close-repeat-real-green.log` reports 22/22 passing. These are inspected implementer records; I did not execute them.

I inspected the current diff from HEAD `310f0390f5f21bf759bf2657a2f8b8274b13faab`, the draft/save/transition code, all eight real-close test cases, the original packaged preservation assertion and the relevant evidence records. **I ran no tests, builds or applications and changed no files, index, HEAD or branch state.**

### Declined to judge

- The active `home-stable-qualification` outcome: no completed result was assessed.
- A replacement package: none was built or exercised by this reviewer.
- General preservation of older-only top-level draft fields during the baseline’s ordinary replacement path: unchanged behavior outside this timestamp correction.
- Whole-branch, main, release or full-plan readiness: outside this addendum.

### Assessment

**Code correction accepted within this scope; final commit/package readiness remains pending qualification.**

The next package must replay the unchanged exact pre-restore assertion successfully. The retained packaged failure remains adverse, and this addendum grants no PASS to the active runner or an unbuilt package.
