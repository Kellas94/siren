# SIREN Round 4 — corrective follow-up handback

Date: 24 August 2026

## Outcome

The Round 4 recheck found one application defect in the released Job I seam and one evidence-quality
defect in the targeted runner. Both are corrected with separate exact-count, SHA-pinned, atomic
patches. No owner file was overwritten.

Application input: the verified Round 4 F–J artefact, 8,435,599 bytes, SHA-256
`31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707`.

Corrected verification artefact: `round4_followup_work/SIREN_1_65_0_R4_FOLLOWUP.html`,
8,437,187 bytes, SHA-256
`29011D34EFFC8E7F0F88542B3DEBEE3B5190AEDB3A065550DBADB71C6D8BDC22`.

The correction deliberately leaves `APP_VERSION` at `1.65.0`. The complete CSP and the complete
21,999-character `CHANGELOG` block are byte-identical to the input. Counts of `https://` (50),
`eval(` (0) and `new Function(` (0) are unchanged.

## Patch identities

| Patch | Target | Input SHA-256 | Output SHA-256 | Script SHA-256 |
|---|---|---|---|---|
| `R4_FOLLOWUP_01_docs_rail_visibility.py` | Round 4 application artefact | `31596D69DA933AE7D57CD0F3C572F9D639168A5749CD6F2789CC5F80CD308707` | `29011D34EFFC8E7F0F88542B3DEBEE3B5190AEDB3A065550DBADB71C6D8BDC22` | `D59701F9DCB630A5078825756E410457F420C174E8DDF95639B026AAFDDD13DF` |
| `R4_FOLLOWUP_02_targeted_suite.py` | `qa_round4/run_round4_targeted.js` | `2F1D8B00EC9D6C0CEF0FE631DB0E294C764A0BE1CF254F518107184B7C2B462A` | `2C788BC3D3D20B94C943AA0F74156639BA9044994743AF8C2F2E9A763EBE0FD1` | `0492AFA55BEF7A617876EBE3F25C26411CCAB87E6B94B1348D1FD7A05D161197` |

The concise application instructions are in `round4_followup_patches/APPLY_ORDER.md`. Both scripts
reject an incorrect whole-file input under normal Python and `python -O`, without changing the file.
A clean reapply of each patch produced the exact pinned output SHA.

## Corrected application defect — Docs heading rail

At 375×812 the rail could be reduced to 32 px of visible height while retaining a 72 px CSS floor.
Pressing End moved DOM focus to the last heading with `preventScroll`, but did not scroll the rail;
the focused control and its external outline could remain below the viewport. The active mark could
also move out of the rail during natural document scrolling, and the active-heading threshold still
used a fixed 90 px offset instead of the measured wrapped toolbar.

The patch:

- scrolls only `#wpHeadingRailList`, never the outer Docs surface, to reveal a roving or active mark;
- leaves 4 px internal breathing room and draws the focus outline inward at `-2px`;
- keeps End, Home, Arrow navigation and natural active-section tracking visible;
- lowers the positioning floor from 72 px to the actual 32 px minimum available at a narrow edge;
- derives the active line from the current sticky-toolbar bottom when the toolbar is present.

Measured through the real application at 375×812:

- End focused `Appendix`, moved rail `scrollTop` to 203, kept Docs `scrollTop` at 0 and placed the
  button at 778–806 inside the 778–810 rail and the 812 px viewport;
- Home focused the first heading, returned rail `scrollTop` to 3 and again left Docs `scrollTop` at 0;
- after natural document scroll, `Appendix` was active at 632–660 inside a 431–665 rail;
- computed `outline-offset` was `-2px` for both keyboard endpoints.

The 375×812 screenshot in `round4_followup_work/targeted_FINAL_VERIFIED/r4-i-docs-375.png` was
rendered from the corrected artefact and inspected. The bottom control and orange focus ring are
fully visible; the centre document surface remains unobscured.

## Corrected evidence defects

Seven passing checks in the original targeted runner reported a literal opposite boolean as their
`actual` payload. The predicates were real, so this did not create a false green, but it made the
report self-contradictory. The patch captures and reports the same measured boolean used by each
predicate, and adds a suite-level invariant that rejects any future passing boolean assertion whose
expected and actual values are opposites.

The Map Build check previously accepted matching visible text. It now clicks the last, non-first
flowchart node and requires that exact normalized node id to be the active walkthrough block. The
measured click was node `G`, `Financial statements`; the only active id was `G`, and the UI reported
`Step 22 of 22 · Financial statements`.

The Job I scenario now separately asserts narrow-height containment, End, Home, inner-rail scroll,
unchanged document scroll, computed focus-outline placement and visibility of the naturally active
mark.

## Anchors

No pinned anchor had to be moved after either script was cut. The application patch uses six exact,
single-occurrence semantic seams:

1. `.wp-heading-rail-button:focus-visible`;
2. the boundary from `workpaperHeadingRailName` to the rail keydown handler;
3. the roving-tabindex focus assignment;
4. the active-button/`aria-current` update loop;
5. the rail top/right/max-height positioning block;
6. the active-heading scan that previously used `scroller top + 90`.

The runner patch uses the seven contradictory assertion call sites, the complete Map flow-node
click block, the Job I active-line oracle, the existing 375 px Job I block, and the final telemetry
checks. These semantic anchors were selected because they bound the measured contracts without
touching unrelated fixtures or protected implementation regions.

## Verification

### Round 4 targeted gate

Runner: `qa_round4/run_round4_targeted.js`, SHA-256
`2C788BC3D3D20B94C943AA0F74156639BA9044994743AF8C2F2E9A763EBE0FD1`.

Result: **5/5 scenarios, 95/95 assertions, `fatal: false`**. There were zero page errors, zero
unexpected console errors and zero warnings. The one deliberately aborted ELK request is recorded
as expected. The application SHA before and after remained exactly `29011D34…BDC22`. No passing
boolean assertion had an opposite actual value.

Report: `round4_followup_work/targeted_FINAL_VERIFIED/report.json`, SHA-256
`A5ECA3BB60F6454219F4461712267F032ED797ABD52D4CCB59B0419773BC6741`.

### Job A gate

The complete gate was rerun against the corrected immutable artefact in the interactive Windows
session. Result: **48/48 scenarios, 475/475 assertions, zero expected-red, zero skipped,
`fatal: false`**. All 31 exports passed ZIP CRC, XML, relationship, OOXML, PNG, PDF and text
validation. Word opened the DOCX without repair in compatibility mode 15; PowerPoint opened the
11-slide deck without repair. Both Office files were byte-identical after COM inspection. The
application SHA was unchanged.

Report: `round4_followup_work/job_a_FINAL_INTERACTIVE/report.json`, SHA-256
`C529FDB500D40C6F7B7DB5FCA19E5CCDA34A6E2704E9A653D1B1A00D0A8F399D`.

Export report: `round4_followup_work/job_a_FINAL_INTERACTIVE/export-validation.json`, SHA-256
`2DA216EC0902E8B14C9E8813C8268C23A93879A97FAF7CAF32D9417B53989949`.

For provenance, an initial isolated run reached 46/48 and 468/470 with all 31 structural export
checks green. Its only failures were Word and PowerPoint startup errors with HRESULT `0x80070520`
(`A specified logon session does not exist`). The same immutable artefact passed both scenarios
37/37 in an interactive bounded rerun, then passed the complete 475-assertion interactive gate
above. This is an execution-session limitation, not an application defect.

`C:\Claude\SIREN\syncheck.py` reports two script blocks and `node --check exit 0`; the patched
targeted runner also passes `node --check`.

## Deliberately not changed or claimed

- No application code in F, G, H or J changed; the stronger H work is test-only.
- Present, deck, ambient scenes and unrelated Map surfaces were not edited. The app diff is limited
  to the released Docs heading-rail seam.
- `FROZEN_1_65_0.html`, `APP_VERSION`, `CHANGELOG`, CSP and the original Round 4 patch chain remain
  untouched.
- The two owner-known defects remain reported, not patched: deleting a host also removes its hung
  note, and Docs revision restore does not return focus to the intended stable named control.
- Physical touch-hold, manual Narrator/NVDA reading and the complete Firefox/WebKit matrix were not
  claimed. The maintained Job A report retains those and three other broader coverage gaps.

This document supplements `ROUND4_HANDOFF.md`; it replaces only that handoff's Job I narrow-height
claim and targeted-runner evidence quality, not the original F–J patch chain.
