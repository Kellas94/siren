### Addendum: review of the two corrections

Both original findings are **resolved in the inspected code and test assertions**. This addendum does not replace the original verdict or reclassify retained adverse executions.

**Important finding — dirty working Code labels:** resolved.

- [main.mjs:513](/C:/Claude/SIREN_WORK/portable/desktop/src/main.mjs:513) captures the genuine native frame and checks its window/project identity. The explicit working descriptor comes only from `NativeWorkingSources.isWorking/referenceFor`.
- [window-labels.mjs:35](/C:/Claude/SIREN_WORK/portable/desktop/src/navigation/window-labels.mjs:35) distinguishes that main-owned working admission from an ordinary reference. Ordinary references still require exact selected-manifest membership. Working references require valid identity metadata, a selected source ID and matching hash whenever that version is already selected.
- Filename metadata comes from the selected snapshot; the helper adds the admitted working version without reading repository “latest,” source bodies or private drafts. It exposes no reference/hash/grant.
- [home-window-labels.test.mjs:27](/C:/Claude/SIREN_WORK/portable/desktop/tests/home-window-labels.test.mjs:27) now exercises actual `ProjectStore`, `WorkspaceCoordinator` and `NativeWorkingSources` behavior with a working v2 absent from the selected manifest. It retains immutable v1, unchanged-project, unadmitted-reference, malformed-reference, wrong-hash and private-content checks.
- [source-link.mjs:54](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/source-link.mjs:54) checks the working v3 shelf **before linking**, alongside immutable v1 and exact unchanged selected-project readback. The later shelf and existing link/close/Lock checks remain.

**Minor finding — recovery comparison oracle:** resolved.

[local-pin.mjs:101](/C:/Claude/SIREN_WORK/portable/desktop/tests/native/local-pin.mjs:101) now requires `comparison?.equal === true`. Missing execution of the breakpoint proof therefore fails, independently of the closed-dialog assertion.

### Findings and evidence boundaries

No new Critical, Important or Minor finding emerged from this correction review.

I inspected the corrected helper, main callback, label tests and fixture, native source-link and PIN assertions, and the qualification start record. I also read the retained `source-link/2026-10-04T20-22-48.796Z/result.json`: it remains **ADVERSE**, reports the unsaved shelf assertion failure and records unchanged inputs.

I executed no tests, builds or application launches and changed no checkout files, index, HEAD or branch state.

### Declined to judge

- The active `home-reviewed-qualification` execution: no completed result was assessed.
- Exact packaged/runtime qualification: no package was inspected or launched.
- Whole-branch, main, release or full-plan readiness: outside this addendum.
- Other behavior covered by the original review: not reopened by this narrowly scoped correction pass.

### Assessment

**The two review findings are addressed; final scoped commit readiness remains pending completed qualification of the corrected frozen inputs.**

The draft may accurately record these corrections and this addendum now. This review grants no PASS to the active runner and no approval of the entire branch or release.
