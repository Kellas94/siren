# Diagram Inspector/Filters Task3 and native harness — independent ORIGINAL review

Author and scoped Node executor: `/root/diagram_history_final_review`, 2026-10-07. Scope: handed-off annotations controller, native integration/overlay markup, build admission and root-authored `tests/native/diagram-annotations.mjs`. **One P2 product finding and one Important native-oracle gap remain.** No product/test edits, build, GUI/native execution, full suite or approval/release verdict. This is not a rerun of Tasks1/2 to manufacture a passing review.

## R1 — P2: real upstream target truncation loses the coverage warning

`src/ui/diagram/annotations.js` initializes `limited` from `targets.length > 250`. However actual `styleTargets` in `src/ui/diagram/style.js` slices semantic IDs to250 before returning targets. A supported render with251 distinct IDs therefore reaches Inspector with exactly250 entries and never triggers this warning. Inspector offers250 choices and Filters states `250 / 250 blocks match`, without explaining the omitted semantic node. The omitted node is not selectable or evaluated by the facets, which can mislead a user filtering a larger diagram.

Independent retained `coverage-probe.mjs` composes the actual production `styleTargets` function with the actual annotations controller, using the existing finite DOM fixture. It provides251 matching semantic nodes, observes250 returned targets/choices, confirms N250 is not selectable and captures no `limited` disclosure in either Inspector notice or Filter summary. Existing direct controller test supplies251 targets itself; that bypasses the real upstream cap and therefore does not cover this path.

Conservatively disclose limited/admitted coverage at `>=250`, or propagate trustworthy truncation metadata from the adapter without increasing its cap. Add an actual adapter→controller regression. Do not imply a complete count when the source list was already truncated.

## R2 — Important harness gap: counts and unchanged SVG do not establish visual dimming

The reviewed native `local-facets` case checks OR/AND counts, zero-match copy, exclusion of unrendered values, exact SVG outerHTML/local/project equality and Reset. It never reads computed node opacity or edge visibility before/during/after filtering. Its screenshot is taken after Reset. Consequently a controller that produces correct counts but never installs/effectively applies the external CSS projection can satisfy this case. A projection that dims connecting edges could also satisfy these assertions. This is a coverage defect, not evidence that either rendering bug actually occurs.

Keep the byte-invariance oracles and add actual computed-style/geometry observations for representative matching and unmatched groups and connecting edges, including Reset restoration. Preserve the original harness before strengthening it and distinguish new evidence. The existing unit fixture implements its own small CSS matcher and explicitly cannot prove Chromium cascade, native stylesheet admission or physical hit-testing.

## Qualified source observations

- Inspector pending text is retained in a separate set; selection, Apply/Cancel, Refresh, source/history/presentation/Save and auto-refresh checks use that state. Common Prepare pauses and clears render authority while pending Inspector causes explicit `INSPECTOR_EDIT_PENDING`; Resume retains fields and waits for current targets. Source/session errors and render intent remove projection and targets synchronously.
- Filters use exact raw values for identity, OR within each field and AND across fields. Metadata remains unchanged. The projection writes a removable style element in document head, builds numeric child selectors, checks connected current groups, scales the original computed opacity, deduplicates nested unmatched groups, and protects matching descendants' ancestors. Unsupported/overridden opacity is disclosed as partial. Native CSS/edge behavior still needs R2's observation.
- The metadata editor delegates through the existing draft operation, not a new IPC path. Source refs/unknown metadata are not interpreted as links. Unsupported retained fields are disabled. Saved SVG export stays on the independent saved render surface; projection/helper dependencies are not added to vector/presentation builders. Full public Audience privacy was not exercised here.
- Toolbar/panel pointer gestures are excluded from canvas pointer capture and Ctrl+wheel zoom. Preserve-focus handling avoids blur commits when opening Inspector/Filters from pending external fields. The pending-field and overlay-gesture unit checks are relevant but do not establish real browser selection, focus, IME or native geometry.
- Root's native harness uses real disk projects/sources and independent whole-snapshot/source-byte expectations, explicit expected Save deltas, actual UI Apply/Cancel/history/Save, scoped readback of exported SVG, a second dirty working peer for stale CAS, and ordinary common Lock. These are meaningful bounded scenarios. The reviewed harness does not prove all pending-invalid permutations, arbitrary grammar, 250-node native scale, full-theme matrix, docking, public Audience exclusion or physical input behavior; no such qualification is inferred.

## Actual independent execution and snapshot

Executed `node --test tests/diagram-annotations.test.mjs tests/diagram-annotations-window.test.mjs tests/diagram-walkthrough.test.mjs tests/diagram-session.test.mjs`: **34 passed, zero failed/skipped**, exit0. Independent composed coverage probe exited0 because it asserts the observed R1 adverse behavior, not because the product meets coverage requirements. The first probe attempt lacked `structuredClone` in my wrapper VM and failed before reaching the product; that setup log is retained. The corrected wrapper then reproduced R1 without product changes.

Eleven captured inputs remained unchanged throughout review. Original annotations and harness bytes are copied to `evidence/diagram-annotations-independent/original-annotations.js` and `original-native-harness.mjs`. Principal identities:

| Input | SHA256 |
| --- | --- |
| src/ui/diagram/annotations.js | `2e64c0dc563e62f0c4d7ef388aaba46e7deb3c777d1709b104715b937fe01c57` |
| src/ui/windows/diagram.js | `fbc7b0da4bea0ce02ebe19903dd4cf6521c9fd093821f9ed7bba71e30d605fbf` |
| src/ui/diagram/window.html | `dbc5f16a49c159cff4ccef60cf3c04743825ab1766411674c14715719395bc7c` |
| build/diagram-window.mjs | `21ebf8ca538a8076332a866cc090e023a890ce64c93f655a64e3c80c863422bf` |
| tests/native/diagram-annotations.mjs | `1c12b65d888fc140aed879f2d8ed77c0626590d0746c8e387ec569fb6bc9d183` |

Evidence under `evidence/diagram-annotations-independent/`:

| File | SHA256 |
| --- | --- |
| inputs-before.json | `9c791deb74be083a17558c783c490cfae77374274a81183869c7e7192b07bef9` |
| inputs-after.json | `496c21f7b50560986914201ae6c5bf2aff33a38e5e9803699d0a26dc1a8979c3` |
| scoped-tests.log | `fee343f2323e1d11844f593ad9b47ff440720904818342caa8153fa304a473b5` |
| coverage-probe.mjs | `f6a6cc3fc69e3676eed40d10e7ae58076411dd415beb9df56274f9afb37b4cb6` |
| coverage-probe-final.log | `358233c394ac1a9968505f0593d86198041637202086a45c0ef4852c2889d3a4` |

Root independently began native execution while this source review ran. No runtime result from that execution is attributed to this reviewer or certified by this report. Corrected source/harness need a separate recheck; original metadata reports and historical Diagram Save→Attach cause remain unchanged.
