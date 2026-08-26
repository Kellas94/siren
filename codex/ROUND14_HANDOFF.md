# SIREN Round 14 handback

## Delivered artefacts

- Eight self-contained, exact-count, SHA-pinned patch scripts in `round14_patches/`.
- `round14_patches/APPLY_ORDER.md` with every script SHA, the full application SHA chain, the
  anchor report, fresh replay evidence and wrong-SHA refusal evidence.
- Targeted real-application Playwright probes under `qa_round14/` and their reports under
  `round14_work/`.
- `round14_work/replay/SIREN_R14_REPLAY.html` is verification-only. The deliverable is the patch
  chain, not a merged HTML application.

Frozen base: **8,601,839 bytes**, SHA-256
`60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A`.

Replayed final: **8,599,649 bytes**, SHA-256
`0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97`.

The application diff is 25 inserted and 68 deleted lines. APP_VERSION, CHANGELOG and CSP are
unchanged.

## What landed

| Item | Change | Evidence on the exact final hash |
|---:|---|---|
| 1 | Removed all eight `workpaperMarkerClickTimer` references and ran the marker-document route inline. The existing plain-click, modifier and canvas-mode gate remains. | Base returned from the click with Docs hidden and later changed visible and stored source from `B[Ministry of Finance]` to `B[Payments received]` while a 49-character phrase was being typed. Final made Docs visible and focused in 17.9 ms and left both sources byte-identical at 295 characters. Marker double-click opens one existing document, does not create a second document and does not start rename; body double-click still starts the normal block rename. |
| 2 | Moved the drag-release suppression below the marker branch. | A real block drag still produces a ghost and its own release opens neither Docs nor inspector. A separate marker click started 2.4 ms after release—inside the actual 400 ms window—and opens the linked note on the final; base ignores it. After 542.9 ms, an ordinary body click still opens `Block B`. |
| 3 | Added `[data-t-workpaper-node]` to the body-drag press exclusion. | Marker movement `+8,+4` (8.94 px) creates no ghost and opens Docs on the final; the base creates a ghost and loses the click. The same movement on the block body remains a real drag. A below-threshold marker movement remains a click. Ctrl-click remains multi-select and Connect mode writes `D --> B` without opening Docs. |
| 4 | Deleted the post-scroll `fullyVisible` refusal and retained scroll/centre, the two settling frames and settled inspector opening. | A normal D target at the app's displayed 276% starts off-screen, then becomes fully visible after `scrollTop 0→957`; vertical centre residual is 0.485 px. The natural horizontal residual is recorded as 4.656 px with `scrollWidth/clientWidth 507/506` and `scrollLeft 0` clamped at the origin. An oversized 750.7 px target in a 506 px client viewport cannot fit geometrically, but the final opens `Block CHARLIE` instead of issuing the old refusal. The narrow-layout contradiction is documented below and is not claimed solved. |
| 5 | Removed `selectVisualNode(nodeId)` and `canvasFocusBlock(nodeId)` from reference arrival. | Final preserves Build selection PAY and unapplied `UNSAVED WORK 2026`, leaves source unchanged, opens the CHARLIE inspector/Style target, paints no canvas ring and leaves immediate Delete harmless. The draft remains actionable through the normal Update button. Base replaces the draft with CHARLIE and arms Delete. Two ordinary PAY/REVIEW Build selections still refresh normally. |
| 6 | Deleted only the welcome tour's application-wide Tab branch. | With the tour active, source Tab/Shift+Tab indent and outdent, header Tab reaches the next header control, managed-menu Tab runs its own close/next-focus route, and Visual label Tab reaches Add without discarding the pending label. Explicit tour replay still focuses Next and two replay/dismiss cycles tear down completely. |
| 7 | Moved the tour listener from capture to bubble and made it decline an already prevented event; add/remove flags remain symmetrical. | Inspector Escape reverts `ZZZTEST` to `State` and leaves source byte-identical while the tour remains. Palette and theme Escape close their owner, restore focus and reach document bubble with `defaultPrevented=true`; managed structure menu and native dialog keep their existing ownership. A later neutral Escape dismisses and persists the tour. |
| 8 | Removed cache-miss (`!nodeResolvable`) from the context-row disabling condition; genuinely dangling rows still disable. | A valid cold-cache cross-diagram row changes from disabled with a false “no longer in this workspace” reason to enabled and lands; the warm-cache row also lands. Sequence-participant and class-member phantom rows are enabled but produce the existing honest post-click “does not resolve to a rendered block” error, with no false inspector or source mutation. A genuinely dangling reference remains disabled with the exact existing reason. |

## Corrections and contradictions found by measurement

1. Item 2's suppression interval is **400 ms after pointer-up**, not half a second. A 500 ms
   second click would be outside the guard and would not test the defect.
2. The unique item 6 Tab branch starts on base line 22650, one line before the brief's approximate
   22651 location. The text anchor itself did not drift.
3. The first visual probe wrote `280` directly into the logarithmic slider and therefore measured
   800%. That was a probe defect. The final probe maps zoom through the app's logarithmic contract;
   requested 280% quantizes to the displayed 276%. All published screenshots and reports are from
   the corrected run.
4. Item 4 contains an irreducible deletion-only conflict at widths **900, 820 and 760 px**. After
   the Docs chip closes Docs, `#previewPane`, `#zoomViewport` and the referenced target all measure
   0×0 because the mobile view remains Editor. The base refuses and hides the inspector; the final
   opens the correct `Block CTRL` inspector and removes the false refusal, but the block itself is
   still unseen and cannot be centred. Switching the mobile view would be an added routing/design
   decision, contrary to this round's deletion-only instruction. Narrow target visibility is
   therefore explicitly **not established**.

## Anchors

No replacement anchor moved. Every anchor in all eight scripts matched exactly once on its pinned
input; no line number was used as an anchor.

- Item 1: timer declaration, double-click cancellation, delayed click body and double-click timer
  cleanup.
- Item 2: pre-marker suppression block and post-marker insertion point.
- Item 3: the unique body-drag interactive-target exclusion.
- Item 4: the arrival comment and the complete `fullyVisible` refusal body.
- Item 5: the arrival comment and the adjacent Build/canvas selection calls.
- Item 6: the complete tour Tab branch.
- Item 7: tour key-handler entry plus matched add/remove listener registrations.
- Item 8: cache-miss declaration and the context-row disabled reason.

During the first dry run, item 4's **post-condition** was tightened from a file-wide nested-animation-
frame census (the file has two) to the unique settling pair inside `landWorkpaperDiagramNode`. No
application write occurred before that verifier correction passed; this was not anchor drift.

## Verification

- A fresh replay from the frozen base applied all eight already pinned scripts and reached the
  exact final SHA above, byte-identical to the independently built private copy.
- All eight scripts reject the final file as a wrong-SHA input with non-zero exit; the target stayed
  byte-identical after every attempt.
- All patch scripts and all final targeted probes pass `node --check`.
- Final inline syntax: 2 executable script blocks, 7,592,254 JavaScript characters, parse PASS.
- Static scope verifier: 13/13. The Round 13 BF deck text writer and BJ canvas keyboard repair are
  byte-identical to the base; APP_VERSION, the full CHANGELOG array and CSP are also unchanged.
- Targeted final result: **25/25 scenarios, 152/152 assertions**, 0 page exceptions and 0 console
  errors.
  - items 1–3: 7/7, 30/30;
  - items 4, 5 and 8: 9/9, 46/46;
  - items 6–7: 9/9, 76/76.
- Positive controls were measured on the exact frozen base. Marker and arrival probes assert the
  observed defective/base contract explicitly; the tour fixed-contract probe is red on the base at
  3/9 scenarios and 52/76 assertions, with 24 failures on precisely the stolen Tab/Escape routes.
- Visual inspection was performed on the corrected 276% ordinary-centred and oversized arrivals,
  all three narrow widths, the enabled cold-cache row and the honest phantom-reference error.
- The application SHA remained unchanged throughout the broad suite and all probes.

Primary evidence:

- `round14_work/targeted_summary.json`
- `round14_work/qa_marker/base/report.json` and `fixed/report.json`
- `round14_work/qa_arrival_refs/base/report.json` and `fixed/report.json`
- `round14_work/qa_tour_keys/base_v3/report.json` and `fixed_v3/report.json`
- `round14_work/qa_arrival_refs/fixed/fixed-desktop-ordinary-centred.png`
- `round14_work/qa_arrival_refs/fixed/fixed-desktop-arrival.png`
- `round14_work/qa_arrival_refs/fixed/fixed-narrow-900.png`
- `round14_work/qa_arrival_refs/fixed/fixed-cold-cache-menu.png`
- `round14_work/qa_arrival_refs/fixed/fixed-phantom-sequence-result.png`
- `round14_work/scope_report.json`, `syntax_report.json`, and `wrong_sha/report.json`

## Broad-suite findings outside this patch chain

The unmodified legacy suite completed **19/31 scenarios and 206/227 assertions**, `fatal: false`,
with the final application hash unchanged. That is the exact same scenario/assertion count and the
same 21 failed assertion ids as its prior run on this exact frozen base SHA: no new red id and no
resolved red id.

The same 12 legacy groups remain red: BOOT, XBR.PERSISTENCE, A07/A07B, A08, A11, R2.18, A13,
R2.ITEM3.NARROW, R2.ITEM4.A11Y, C7.EMPTY, EXPORT.MAIN and EXPORT.VALIDATOR. They are the already
documented stale status/Docs selectors, confirmation/tour ordering, hidden Changes control, old
waypoint/narrow-toolbar/Style-fold routes, the stale syntax-block expectation, and the validator
treating its OOXML `.doc` harness file as UTF-8. None is a new Round 14 application failure.

Reports: `round14_work/final_regression_chromium/report.json` and
`round14_work/regression_comparison.json`.

## Deliberately not done or claimed

- I do not claim item 4 makes the referenced block visible at 900 px or narrower. It restores the
  requested inspector and removes the false refusal, but the preview remains the hidden mobile pane.
  No mobile-view switch was added.
- I did not change the two-animation-frame disappearance path; if the target vanishes between render
  and settled lookup, the function still returns without a dedicated toast.
- I did not filter the reference picker or change cold-cache wording. Phantom rows now act and fail
  honestly, but they first open their diagram; the picker cleanup remains separate work.
- I did not change the welcome tour's untracked delayed-start timer. The previously identified race
  where Docs can open before that timer creates the first card remains outside items 6–7.
- I did not claim every application Tab route, browser or assistive technology. The targeted probe
  covers representative source, Build, header, managed-menu, inspector, palette, theme, structure-
  menu and native-dialog paths in Chromium only.
- I did not alter marker modifier/mode semantics. A marker double-click now opens its document, as
  explicitly requested; ordinary block-body double-click remains rename.
- I did not touch BF or BJ logic, the Round 15 inscribed-shape word-break issue, APP_VERSION,
  CHANGELOG or CSP.
- I did not modify the legacy broad suite to make its known red set look green.
