# Independent review: local Mermaid semantics and CI/PIN fixture corrections

Author: `/root/catalogue_view`, 2026-10-07. Read-only product review; no GUI/build/product edits. **19/19 focused Node/VM checks passed**, including three independently authored checks. No product precedence defect was established for the ignored legacy key. The earlier CI coverage P3 is fixed for the reviewed bytes. No hosted/runtime/release approval is implied.

## Why the scoped legacy oracle failed

The exact local `generated/.diagram-build/diagram-engine.js` contains **zero `defaultRenderer` occurrences**. Its `sanitizeDirective` checks keys against a set derived from default configuration (`Sdr = new Set(Edr(Cdr, ""))`). Unknown keys are deleted recursively. The preprocessing/config path calls this sanitizer through `addDirective`; `parse` returns that same sanitized source config object.

The reviewer independently extracted the actual default-schema expressions and sanitizer from that frozen bundle, then executed them in a Node VM. The naming wrapper was inert and the theme-variable factory was a placeholder; unrelated dictionary/CSS branches were not exercised. The resulting allowlist had 411 keys: `layout` was admitted and `defaultRenderer` was absent.

For all five scopes—flowchart, class, state, er and requirement—`{scope:{defaultRenderer:'dagre'}}` became exactly `{scope:{}}`. Both global `layout:'dagre'` and scoped `{scope:{layout:'dagre'}}` survived. The reviewer did not run the full Mermaid parser or a browser. These are real extracted sanitizer checks on already-parsed configurations.

Root's retained parser diagnostic `2026-10-07T11-20-02.718Z/result.json` independently supplies actual parser output with those same empty scopes for both saved choices. Its author remains root. The native layout contract sees no source-owned layout in that empty object, so allowing the saved finite Dagre/ELK preference matches the actual parsed semantics. Expecting global Dagre or source-only default geometry for an ignored key was an unsupported oracle, not proof of a precedence defect.

The supported scoped `layout` key should receive its own strict actual geometry check, alongside global frontmatter/init layout. Do not conflate that declaration with ignored `defaultRenderer`. The contract already treats parsed scoped `layout` as source-owned in the independent VM checks.

## Geometry observer assessment

Random RoughJS path control points are unsuitable as a strict cross-render geometry identity oracle. Root retained the original broad observer and changed the family observer to semantic groups (`g.node`, `g.stateGroup`, `g.entityBox`) with bounding boxes/transforms/text and a minimum of two groups. Keeping strict SVG/Present equality and Dagre/ELK inequality makes the new oracle meaningful; reducing assertions to nonempty SVG would not.

This review does not approve newly executed family geometry. The parser diagnostic itself retained a broad shape/path snapshot containing `d`, so its `distinct:true` flag alone cannot prove different engines independently of rendering randomness. Its parsed-config output is the relevant evidence for the ignored-key diagnosis. Later root-owned semantic geometry runs require their own record inspection.

## CI coverage P3 correction

The reviewer reran the original in-memory omission scenario against the current `tests/diagram-layout-ci.test.mjs` checker. Omitted or duplicated utility execution, each missing utility result upload and broad utility evidence upload are now rejected. The current workflow is accepted and the three local CI contract tests pass. **LAYOUT-CI-COVERAGE-01 is closed for these recorded bytes**; this does not establish a hosted workflow outcome.

## PIN fixture correction

`tests/pin-protection.test.mjs` now uses a test-local mock for `setTimeout` in the output-before-close case. Filesystem setup/worker response completes before ticking the deadline. The test checks that output alone does not settle the operation, advances 99 ms, releases the worker's actual close and checks successful settlement; the remaining tick cannot change it. This preserves the event under test without depending on concurrent disk scheduling.

The separate timeout-refusal case still uses the real timer and passed in this review at approximately 104 ms. No production timeout was widened. Current `src/account/pin-protection.mjs` and `pin-protocol.mjs` hashes match the original full-suite capture exactly.

Root's original full suite remains **ADVERSE**, identity 4/4 and units 1578/1579 with unchanged inputs. The isolated original PIN case passed, while the preserved delayed synthetic worker reproduced deadline refusal and its warning. Those originals are retained and not relabeled. This focused correction and 19/19 run do not substitute for a later full-suite run.

The companion JSON preserves execution output, exact inspected identities and original evidence paths. `reviews/2026-10-07-diagram-layout-parser-pin-independent.test.mjs` reproduces the three independent bundle/contract/CI checks. No source, package, GUI, full suite or release was changed or approved by this reviewer.
