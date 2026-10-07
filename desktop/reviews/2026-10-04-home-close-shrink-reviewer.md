### Separate addendum: idempotence after intentional shrink

**The relocation addresses the reported case. No new finding was identified in this narrow static review.**

At [renderer.mjs:92](/C:/Claude/SIREN_WORK/portable/desktop/build/renderer.mjs:92), deduplication now reads `retainedDraft` before applying the eight-second shrink allowance. An already acknowledged smaller draft therefore keeps its timestamp during repeated preparation.

The comparison still excludes only `savedAt`. Different bodies continue to the original count guard, with `previous` suppressed only during the explicit shrink allowance. This preserves intentional deletion, protection of larger recovery drafts outside that allowance, and conservative handling of unknown fields. Unreadable drafts fall through to the existing replacement path. Clean-marker finalization, selected-save acknowledgement, refusal and rollback code are unchanged.

The new [real-close test](/C:/Claude/SIREN_WORK/portable/desktop/tests/close-draft.test.mjs) invokes the extracted baseline `allowRecoveryDraftShrink()` function, verifies that the acknowledged draft shrinks to one diagram, advances the deterministic clock by one second and compares the complete selected snapshot after preparation repeats. Its retained RED log shows timestamp-only churn and revision 4 versus 3; the oracle was not weakened.

I inspected only this relocation, the new fixture extraction/test and its retained RED evidence. **I executed no tests or builds and changed no files, index or HEAD.**

**Assessment:** this code correction is accepted within scope. The active qualification outcome, replacement-package result and whole-branch readiness remain unjudged. Earlier reports and the packaged failure retain their original verdicts.
