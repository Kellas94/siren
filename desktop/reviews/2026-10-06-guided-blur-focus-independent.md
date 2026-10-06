# Independent limited review — Guided blur focus

Author: `/root/media_batch_review`. Reviewed the current **three-file working-tree correction** against `e9acbf1d0e41bc47d3ba3456c4fd24938555c2c6`, not an immutable candidate commit. Verdict: **no blocking finding within the focused blur-focus correction**. This verdict does not close the original hosted Save timeout or qualify the complete media batch.

| Reviewed file | SHA-256 |
| --- | --- |
| desktop/src/ui/diagram/guided-view.js | b8ac07090f2bcc222dce02c68a155725da546df78647d7e983253e2dc5d6e8ff |
| desktop/tests/diagram-guided-view.test.mjs | 0acd0a60f42ba2d01d8d981810eb94b58d8d40bd4f478574e82427ed2c7fcc53 |
| desktop/tests/native/diagram-build.mjs | c3d36cb3cd49a2b3a80fe2af170664b6f439caaf3786b4bdd4fb54d381719763 |

The product change separates automatic blur from explicit completion: `finish(apply,restoreFocus=true)` preserves the previous Enter/Escape/explicit-commit return to the newly rendered chip, while blur calls `finish(true,false)`. It still uses the original finite Guided mutation, expected-line checks, refusal behavior, repaint and single-close guard. Invalid, stale or refused edits retain the tentative input and cannot become accepted source changes through the focus flag. No save authority, CAS version, retry or validation rule changes.

The unit fixture now tracks active focus and resolves actual chips, replacing previous no-op focus/query-selector mocks. The new assertions meaningfully distinguish blur from explicit keyboard/commit behavior and verify that retired blur cannot apply twice. Existing invalid/stale/refused cases exercise blur before refused commit and retain exact fields/source. My own Node 24.16.0 command ran `tests/diagram-guided-view.test.mjs`, `tests/diagram-guided.test.mjs` and `tests/diagram-draft.test.mjs`: **14 passed / 0 failed**. Native probe syntax check also passed. These are controller/unit checks, not browser-focus qualification.

The native probe retains one real pointer Save and every original exact save/version/project/source/Lock assertion. Its additional trace is bounded to 120 records; it requires Save focus and forbids a focus return to the Guided label during that first Save. There is no Enter-before-Save workaround, repeated click, longer deadline or retry-to-pass. The optional 8x CPU throttle is probe-only and restored after the first-save assertion; a failed probe closes its own process. This is stress instrumentation, not a production timing change.

I read the retained old-product trace at `desktop/evidence/diagram-build/2026-10-06T19-38-58.618Z/result.json`: Save receives pointer press/release/click with constant geometry while Guided blur focuses the label chip. I also independently read `2026-10-06T19-41-32.842Z/result.json`: status ADVERSE, inputs/package unchanged, failure **“Guided blur must let Save receive focus”**. Those observations support a real focus-stealing defect; they do **not** reproduce or explain the original hosted version-1 Save timeout. The old product can accept the Save while still exhibiting the focus defect.

I did not launch native GUI probes, build/copy a package, run full qualification or verify hosted CI for the correction. Root must obtain separate actual native/package/hosted results. The original adverse hosted receipt and earlier independent reports remain unchanged. Blur still repaints the Guided host; interactions that click another chip in that same host are outside this focused correction and must not be claimed repaired without their own evidence.
