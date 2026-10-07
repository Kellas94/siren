# Native Diagram Walk through — independent ORIGINAL source review

Author: `/root/diagram_history_final_review`, 2026-10-07. Verdict: **correction required** for the label defect below. This report reviews the first implementation after the pending-field pointer/focus guard stabilized, before the wrapped-label correction. Product, tests, builders and native harness were not changed by this reviewer. Previous reports remain unchanged.

## Finding R1 — P2: wrapped SVG labels lose word separators

`src/ui/diagram/walkthrough.js:26` derives the caption from `admitted[0].textContent`. SVG textContent concatenates descendant text nodes without adding the visual separation between lines. The normalizer can collapse existing whitespace but cannot restore a missing separator. Consequently the real source label `Început Ș😀`, rendered on two lines, is announced/displayed as `ÎnceputȘ😀`. This damages the readable block identity used by the walkthrough, including its live status announcement; it does not change saved source.

Independent bounded VM probe using the actual controller reproduces expected `Început Ș😀` versus observed `ÎnceputȘ😀` for adjacent rendered line text nodes. The probe is a DOM model, not a native reproduction. Separately, I read `/root/media_batch_review`'s original actual native report and receipt: `evidence/diagram-walkthrough-native/2026-10-07T01-33-43.317Z/result.json`, SHA256 `da70b24ebdf22c530e8de926fc4f7fd4e38c5d9e89f0c6687e73f40003f29a53`, ADVERSE with zero completed cases. Its exact phrase assertion and captured label establish the real effect on the same helper hash. I did not execute or personally inspect that native UI.

Use bounded rendered-label extraction that preserves visual word/line boundaries, including nested inline spans without inserting spaces inside words. Retain the exact native phrase oracle and add representative line/inline/Unicode tests. Do not parse source or weaken the expected caption to conceal the failure.

## Qualified observations

- `retirePreview()` invalidates both session generation and traversal immediately at accepted source/style/history intent, before the 120/250 ms debounce. Refresh retires before placement awaits. Real session tests cover an older in-flight result resolving during that gap. Error clears traversal even though the old SVG remains connected. Hidden preview, Prepare and disposal clear targets; Resume needs a newly accepted preview.
- State is per controller instance. Admission is capped at 250 target entries and eight groups per semantic ID, deduplicates IDs/groups and checks current SVG containment. Geometry is finite, recomputed from current client rectangles and clipped to the viewport. Independent two-instance probe confirms pausing one does not change the other, within a mock DOM.
- The overlay is HTML outside `diagramCanvas`/SVG and pointer-inert. Traversal reads SVG geometry/text but writes only local controls, overlay and view transform. No draft/history/save/IPC calls were added to navigation. Actual vector and presentation builders do not include the walkthrough helper; saved export remains on its separate rendering path.
- Keyboard handling belongs only to buttons inside the walkthrough host and yields for composition, modifiers and already-handled events. Source textarea/other fields are not globally intercepted. The new pointer guard prevents default focus transfer from INPUT/TEXTAREA/SELECT/contenteditable, and Start/Overview also avoid programmatic focus while such a field remains focused. This addresses the reviewed blur/change path in source. Its unit test models focus without dispatching an actual browser change event; native valid pending Style/title preservation remains a distinct required check. Normal deliberate Tab navigation may invoke the field's existing change behavior before reaching a walkthrough control.
- No further concrete product defect was established in the reviewed lifecycle, invariance or bounds seams. At the adapter's 250-entry cap, prefer copy identifying the count as the shown/admitted set or a bounded subset; the current `250 blocks` cannot establish the total diagram cardinality. This is a disclosure recommendation, not evidence that traversal exceeds its cap.

## Actual checks and identities

Executed `node --test tests/diagram-walkthrough.test.mjs tests/diagram-walkthrough-window.test.mjs tests/diagram-session.test.mjs tests/diagram-draft.test.mjs tests/diagram-history.test.mjs tests/diagram-history-view.test.mjs tests/diagram-style-view.test.mjs`: **37 PASS, zero failed/skipped**, exit0. Log: `evidence/diagram-walkthrough-independent/original-scoped-tests.log`, SHA256 `c9274bb0974236b30e5e40d5acfc81cf1a7f609f80cb3f5e65c0f4f48223a6cf`.

Executed independent `original-probe.mjs`: wrapped-label adverse reproduced; two-instance isolation passed, exit0. Probe SHA256 `a601d86c02054e3233a20863f8abc99dd2d940d7585329366c0b8bcab02338f8`; actual log SHA256 `3f5619e894dec321adbcaf633e75ded346765aee8755a070ccfc89cd44d5f459`, both in `evidence/diagram-walkthrough-independent/`.

All twelve captured source/build/focused-test identities were unchanged before/after these checks. Full paths and hashes are retained in `original-inputs-before.json` (SHA256 `bd7a1b5ed70a33d4d219abae2adb0458c9ff9d9d8684c298171ac74c4b8ca9d6`) and `original-inputs-after.json` (SHA256 `8826e9385fbb41ab772fcb163eb5cfc47d4ae73e19dc7b777aa0febb58ba1ac0`). Primary inputs:

| Input | SHA256 |
| --- | --- |
| walkthrough.js | `25e60d113aca7649edbf1d3475693140242115ebcff7f32e8797a4b44a5a85ff` |
| session.js | `dbdc13f4b017643d161178d0b29ec615bf3980200696b519a48b56b3fa9c2fa8` |
| windows/diagram.js | `1900c032ae0599f5ebd8e225af70fba6148d37ca049d18d64ad4c8abc64cc5dd` |
| window.html | `f435a729172a773b92e83818c987ac21d23085799839c1e0a8f74b8ef4638bbd` |
| build/diagram-window.mjs | `38c101c53f6ccc423135deb1348fe61bff71866607cae94aee439e389a6195f2` |

This is an original source-review snapshot, not final qualification of corrected product. No build, full suite, GUI, real cross-window/docking exercise, native export comparison, hosted operation or copied-package execution was performed by this reviewer. Native pending fields, physical geometry/themes, common Lock and complete exact project invariance must still be established by their actual evidence owner. The original hosted Diagram Save/Attach mis-target remains OPEN. No release, installed replacement or main merge is approved by this report.
