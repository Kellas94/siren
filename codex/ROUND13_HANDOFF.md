# SIREN Round 13 handback

## Delivered artefacts

- Six self-contained, exact-count, SHA-pinned patch scripts in `round13_patches/`.
- `round13_patches/APPLY_ORDER.md` with every script SHA and the complete application hash chain.
- Targeted browser probes and reports under `qa_round13/` and `round13_work/final_*`.
- `round13_replay/SIREN_R13_REPLAY.html` is verification-only. The deliverable is the patch chain, not a merged application.

Frozen base: `8,598,565` bytes, SHA-256 `539C3D5F98BCDB465895F2CAE3222E2BE16F2318234D5F667F8E54370F4E4697`.  
Replayed final: `8,601,836` bytes, SHA-256 `1638793CF08989F68D8CEA7A8D621067EF5A11F18483F54DFD39B8BD6B2F02F3`.

## What landed

| Job | Change | Evidence on the exact final hash |
|---|---|---|
| BE | The document marker claims only a plain unmodified click when no canvas mode is active. Connect, Ctrl-click, double-click, drag and context-menu gestures resolve to the underlying block. The glyph is optically centred without moving the hit target. | 13/13 gesture observations; D→B is written through the marker while continuous Connect mode remains armed; Docs stays closed; marker and block context menus both expose the named Documents row. Measured glyph-to-hit-centre delta: x `-0.578px`, y `-0.5px`. |
| BF | `deckShapeTextBody` uses square wrapping for a single flat collector line and keeps `wrap="none"` only for genuinely pre-split multi-line text. The Round 11 dense-rectangle behaviour remains. | 27/27 assertions, 0 vacuous. Cylinder, diamond and sideways pill flat labels use square wrapping; a three-line edge label remains `none`; 44 dense rectangles stay editable at the 1pt floor with visible overflow. Both emitted PPTX files rendered successfully and the slide overflow check passed. |
| BG | A block promise now requires a real node group in the current signature-valid SVG or its signature-valid preview cache. Unresolvable source tokens keep the honest diagram wording, the context jump is disabled with the existing dangling reason, and a primary click reports the failed landing. | flowchart/state/class remain enabled and land; sequence/ER/mindmap/journey/numbered-flow no longer promise a block. Final BG/BH verifier: 12/12 assertions; signature-valid cached cross-diagram probe: 8/8. |
| BH | One arrival helper synchronises the canvas ring, Style target, Build dropdown/card and inspector, centres the destination in `#zoomViewport`, remeasures after two animation frames, and refuses an off-screen inspector. | At 1024×700, CHARLIE moved from y `689–748` to `444–503`, scrollTop `0→245`; DONE sideways case moved from y `810–868` to `565–623`. Both were fully visible and all four selection surfaces agreed. Sideways verifier: 4/4. |
| BI | The non-modal tour is a polite atomic live region with a programmatic focus target. The first external Tab reaches Skip, Shift+Tab reaches Next, Escape dismisses and persists, native open dialogs keep first claim on Escape, and the dynamic capture listener is torn down. Existing `focusNext` provenance is untouched. | BI/BJ probe: 23/23 assertions. Existing AV interaction suite remains 6/6 scenarios and 37/37 assertions, including Visual, Code, Docs, reduced motion, automatic tour and explicit replay. |
| BJ | Removed the older bare-Tab/bare-Enter mutation binding and its now-dead helper. The newer documented canvas handler remains the sole creation route. | Tab, Shift+Tab, Enter and ArrowDown leave source byte-identical; Ctrl/Cmd+Enter and Ctrl/Cmd+Shift+Enter still open their forward/back creation popovers. Covered inside the 23/23 BI/BJ report. |

## Correction to the brief

The BF diagnosis in the brief says the deck route supplies pre-split lines while the diagram route supplies one flat line. The real writers contradicted that: both routes can reach `deckShapeTextBody` with a one-line flat label. Cylinder, diamond and pill exports all did so. The shared guard therefore keys on `shape.lines.length <= 1`; only an already split array with more than one line retains `wrap="none"`. This is a re-cut of the proposed condition, not an anchor move.

## Anchors

No anchor moved. Every anchor matched exactly once on its pinned input. The guarded surfaces were:

- BE: block-context hit selector; marker glyph coordinates; shared node-id resolver; preview click route; preview double-click route.
- BF: `deckShapeTextBody` prologue and its `<a:bodyPr>` return.
- BG: reference resolver entry/result; context-row wording/state; same- and cross-diagram landing guards; chip title.
- BH: `openWorkpaperReference` entry and its `openTarget` landing body.
- BI: tour lifecycle entry and tour-card accessibility attributes.
- BJ: legacy key binding plus the uniquely bounded keyboard-creation section between its section markers.

No line-number anchor was used.

## Verification

- Fresh-base replay reached the exact final SHA above, byte-identical to the working artefact.
- All six scripts rejected a deliberately wrong input SHA with a non-zero exit and left the target unchanged.
- All six patch scripts pass `node --check`.
- `syncheck.py` on the replayed application: 2 script blocks, 7,584,004 JavaScript characters, `node --check exit 0`.
- Protected sections compare byte-for-byte with the base: APP_VERSION, the complete CHANGELOG array, and the CSP meta element.
- Target reports contain no page exceptions or console errors.
- Visual inspection was performed on the marker/context menu, CHARLIE and DONE arrivals, the ordinary BF export and the 44-block dense BF export.

Primary evidence files:

- `round13_work/final_be/report.json`
- `round13_work/final_bf/report.json` and the rendered `round13_work/final_bf/bf-target/slide-1.png`
- `round13_work/final_bg_bh/report.json`, `round13_work/final_bh_done/report.json`, and `round13_work/bg_bh_audit_cross/report.json`
- `round13_work/final_bi_bj_v4/report.json`
- `round13_work/final_av_interaction/report.json`

The broad legacy regression suite was also run as a diagnostic, not used as the Round 13 acceptance gate. Its result and the exact frozen-base comparison are recorded below.

## Broad-suite findings outside this patch chain

The unmodified legacy suite finished `19/31` scenarios and `206/227` assertions on the replayed final, `fatal: false`, with the application hash unchanged. That is not a clean gate, so I reran every red scenario on the exact frozen base and reran the export validator with the base's real Docs exports.

- The same 12 scenario groups are red on the frozen base: BOOT, XBR.PERSISTENCE, A07/A07B, A08, A11, R2.18, A13, R2.ITEM3.NARROW, R2.ITEM4.A11Y, C7.EMPTY, EXPORT.MAIN and EXPORT.VALIDATOR.
- Twenty of the final's 21 red assertions reproduce on the frozen base: empty default status; stale Docs-empty-state selectors; confirmation/tour ordering; the now-hidden Changes control; old waypoint, narrow toolbar and Style-fold routes; the two-script-block syntax expectation; and the validator treating an OOXML package saved under its harness name `active-doc.doc` as UTF-8 text.
- The only additional red assertion is intentionally obsolete after BJ: `R2.ITEM3.NARROW.12` still requires bare Tab to create a child block. The accepted Round 13 contract removes that mutation and retains Ctrl/Cmd+Enter instead; the targeted final probe proves both halves.
- Therefore none of the broad-suite reds identifies an application regression introduced by BE–BJ. The suite needs maintenance before it can be used as a release gate for this base.

Reports: `round13_work/final_regression/report.json`, `round13_work/base_regression_failures/report.json`, and `round13_work/base_export_validator/report.json`.

## Deliberately not done or claimed

- I did not filter the reference picker. It still offers source tokens such as `TD`, `mindmap`, `Day`, relationship/message labels and class members. BG makes the downstream promise honest and leaves that optional cleanup visible.
- I did not change the Presentation-stage/static-SVG marker promise, fuzzy hyphen-fragment node matching, the tour's 6-versus-4 step counter, the PPTX run-level Arial omission, or the other smaller findings listed at the end of the brief.
- I did not make dense 44-block text legible. It remains at the truthful 1pt floor; the warning is the useful outcome there.
- I did not change the very pale edge-label colour visible on the white BF render. That contrast and the dense 1pt readability limit predate BF; the job restores containment, not full visual legibility.
- I did not claim that NVDA or Narrator spoke the live region. Automated checks establish the keyboard and ARIA contract; no manual screen-reader session was run.
- I did not prove a cold-cache cross-diagram block reference. Its conservative fallback is diagram wording until a signature-valid SVG exists. A signature-valid cached cross-diagram arrival was separately UI-tested at 8/8; the cold-cache fallback was not.
- I did not prove BH below the 720px inspector breakpoint. The measured 1024×700 arrivals are fully visible before the inspector opens; on phone layouts the later bottom-sheet inspector may occlude a centred node. A target disappearing during the two-animation-frame recheck also fails closed without an inspector, but that narrow rerender race has no dedicated toast.
- I did not rebase Round 12 or modify its artefacts.
- I did not touch APP_VERSION, CHANGELOG or CSP.
