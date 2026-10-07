# Hosted Diagram pan failure — independent original analysis

Author: Codex independent reviewer `/root/diagram_history_final_review`, 2026-10-07.

Scope: read-only inspection of retained original hosted 37565124075 evidence, source/harness and prior evidence. No GUI/native execution, build, source/test edits, downloaded-code execution or rerun. This report attributes an unresolved observation, not a fix, approval or package qualification.

## Established observation

The original development Diagram preview receipt is ADVERSE after one completed case. It fails at `tests/native/diagram-preview.mjs:45:532`: the Boolean from `diagramCanvas.style.transform.includes('45px, 25px')` was false. Earlier Zoom In and Fit assertions on that same page succeeded (120% then 100%). The failing sequence reads the viewport's center once, dispatches left mousePressed there, mouseMoved at +45/+25 with `buttons:1`, then mouseReleased, and reads the transform. It does not retain the actual resulting transform, pointer events or hit-tested target.

Receipt state still reports rendered/ready, light theme, detached, read-only, clean version1. Its runtime log has no retained pan exception. This is not proof that no renderer exception occurred: the fixture does not collect a dedicated Runtime.exceptionThrown stream into this receipt.

I personally inspected both the retained pre-pan `diagram-light.png` and satellite `view-failure-7A79F368954337F56782F71AAB9149F5.png`. Both show the two flow nodes in visually the same positions with 100% zoom. Inspector/Filters controls are at the lower right; panels are not visibly open. The viewport center appears on the diagram connection, away from those controls. This supports an absent visible translation, but screenshots cannot prove the event target or exact transform, and they are not event-time geometry samples.

The original group receipt lists only `diagram-preview` with a nonzero exit among its twenty scripts; `changedInputs` is empty. The individual preview receipt's own before/after input maps are unchanged. Focused development Walk/Inspector execution was reported skipped by the parent; this review does not turn that into executed coverage.

## Comparison evidence and limits

I independently read the same-run copied-package preview receipt: COMPLETE, four cases, unchanged inputs, including the pan case. **All twenty captured input hashes match the adverse development receipt.** The package receipt identifies source commit `8bf69ee288811b56457adb4dba890475e54be5c0`, archive SHA-256 `837f89239ad4ab19439de5abb98353043c2768eebf5cb59d4c7c39f72a8073ca` and runtime SHA-256 `49b61a030a520fc36a4b8fa5cce53fb4e935a7bdbbe4b80e9222f598e49cc7fa`.

This is evidence that the same recorded implementation and harness passed under another actual execution context. It does not establish a development-only bug, prove timing as the cause, validate the entire package, or repair/erase the original adverse. I did not execute either run or verify the physical package archive in this task.

I also read prior hosted 37561637890 development preview at `2026-10-07T02-29-38.190Z`: COMPLETE4 with unchanged inputs and the same preview harness hash. Its controller hash is different (`1900c032ae0599f5ebd8e225af70fba6148d37ca049d18d64ad4c8abc64cc5dd`), so that earlier success is not exact-current-controller proof. No causal regression conclusion follows from that chronology alone.

## Source assessment

Current relevant files match both 375651 preview receipts:

| File | SHA-256 |
|---|---|
| src/ui/windows/diagram.js | fbc7b0da4bea0ce02ebe19903dd4cf6521c9fd093821f9ed7bba71e30d605fbf |
| src/ui/diagram/window.html | dbc5f16a49c159cff4ccef60cf3c04743825ab1766411674c14715719395bc7c |
| src/ui/diagram/session.js | dbdc13f4b017643d161178d0b29ec615bf3980200696b519a48b56b3fa9c2fa8 |
| generated/windows/diagram.html | 781303141695a95dd64e95281b917fd410c483cfb8d94e8a74f6d197a850e2d9 |
| tests/native/diagram-preview.mjs | 179025344c089b855a2314e85f0b89b808cfa9b7f13a538f2c970bde33b0ead9 |

Controller lines113–115 start dragging on accepted viewport pointerdown, retain pointer ID and coordinates, capture the pointer, apply client-coordinate deltas on matching pointermove, and clear drag on pointerup/cancel/lostpointercapture. The new annotation exclusions return only for targets inside annotation panels/control containers (or links/non-left buttons). The retained screenshot does not demonstrate such an excluded center hit. There is no evidence sufficient to attribute this failure to those exclusions.

`transform()` serializes current pan values; `fit()` resets them to zero. Preview admission reapplies existing transform rather than resetting pan. The fixture's exact string observation does not distinguish missing movement, a different delta, cancellation, later reset or differing CSS serialization. Same-harness package success makes a universally wrong serialization assumption unlikely, but does not prove which case occurred here.

The `attachNativePage` helper awaits CDP command responses. Ordinary button clicks use stable hit-testing, whereas this pan block calculates its center once and dispatches raw events. It neither records stable pan hit-target geometry nor proves that a pointermove reached the drag handler. These are diagnostic omissions; they are not yet a proven cause or authorization to weaken the original pan assertion.

## Recommended next diagnostic, not executed

Run one separately owned passive diagnostic when root schedules native access. Preserve the original harness/receipt and exact sequence/coordinates/threshold. Before the original pan dispatch, install bounded capture/bubble listeners that record pointerdown/move/up/cancel/gotpointercapture/lostpointercapture with event timestamp, pointer ID, coordinates, buttons, trusted/defaultPrevented state and target/ancestor identifiers. Record viewport containment and pointer-capture state, canvas inline/computed transform before and after each original dispatch, and eventual animation-frame observation separately. Capture viewport/client/offset bounds, visualViewport scale/offset, devicePixelRatio, document focus/activeElement and current window placement. Capture Runtime.exceptionThrown. Do not add focus, delay, retries, target substitution or direct handler calls to the diagnostic's input path.

That separates an excluded/missing pointerdown, missing or cancelled pointermove, a lost-capture event, mismatched coordinates and a subsequent transform reset. Only after the actual failing branch is observed should a narrow correction and adversarial unit be selected. Useful scoped unit coverage can check ordinary SVG drag, exclusion of overlay controls, unrelated pointer IDs and cancel/lostcapture termination; such units cannot establish OS/CDP event delivery or close this hosted failure.

## Retained identities

Full path/hash inventory: `evidence/diagram-pan-hosted-independent/inputs.json`. Original retained evidence is under `evidence/workspace-surface/ci37565124075/`:

- `desktop-native-diagrams-evidence-original/evidence/diagram-preview/2026-10-07T03-12-23.838Z/result.json`: `8e61c17d8708e86ce3e27f90d5dac99003579354f9c21dd5f4863a731946e2f3`.
- Same folder `diagram-light.png`: `a06725482bf9b7d1ee858081262224748cc67b855f32653b7b2acdeed1331a12`.
- Same folder satellite failure screenshot: `36ec73bf6343689b512ebd6ba8fa3c74edbfb6aaed3ddd43916c02e37e6564dc`.
- `desktop-native-diagrams-evidence-original/evidence/native-verification/diagrams.json`: `1335491c9bd88dfa4a4b631be10c50402a0eda1b83807d5509f75b831d02d148`.
- `desktop-packaged-evidence-original/evidence/diagram-preview/2026-10-07T03-13-22.608Z/result.json`: `6a277848b562cbfe763fc4fa3a0a9d18956afa2a013cd192afcaa6ec9106d7aa`.

The development pan failure remains OPEN with cause unproven. Historical Save-to-Attach remains a separate open issue; neither is closed by package success or this analysis.
