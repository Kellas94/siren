# Round 2 / item 3 — narrow viewport verification

Scope: editor/Docs only at `375×812`. Present, Map, deck/card, presenter/audience and ambient code were excluded. The application file was not edited; all transformed runs used disposable copies.

## Ordered patches

1. `patches/R2_10_keep_mobile_compare_visible.py` — wraps the existing phone preview action row while preserving natural Comments → Review → Compare order; no markup, reorder, or control restyling.
2. `patches/R2_11_contain_mobile_docs_width.py` — lets nested Docs grids shrink to the viewport while keeping the existing table wrapper as the local horizontal-overflow owner.
3. `patches/R2_12_isolate_mobile_nav_under_docs.py` — adds `.mobile-nav` to the regions toggled `inert` by `setWorkpapersOpen`.
4. `patches/R2_13_keep_keyboard_actions_in_context.py` — one shared focus-context fix: canvas creation keys require `#zoomViewport`, and the first Escape from a Docs editor returns focus to Docs so a deliberate second Escape closes it.

Each script asserts every replacement anchor occurs exactly once, supports `--check [target]`, writes a sibling temporary file, calls `fsync`, and commits with `os.replace`.

## Confirmed baseline failures

Real-app baseline copy SHA-256: `40869437291203ABF7EDEECB597121D4EB273898DA088CD25900B138CA807F46`, byte-identical to the current application at the final rebase boundary.

| Contract | Baseline result at 375 px | Wrong result |
|---|---|---|
| Review actions | Comments ended at `x=380.3`, Review occupied `x=385.3..458.1`, and Compare occupied `x=463.1..546.2` in a 375 px viewport | Comments was clipped and Review/Compare were outside pointer view; keyboard focus exposed a focus ring at a clipping boundary rather than making the toolbar usable. |
| Docs content width | `#wpDoc` client `375`, scroll `552` | The entire document moved horizontally by 177 px because nested table/Knowledge/Settings min-content widened implicit grids. |
| Covered mobile navigation | `.mobile-nav.inert === false`; Tab from the last Docs control landed on `#mobileEditorTab` | Keyboard focus entered controls hidden underneath the full-screen Docs surface. |
| BODY Tab | active target `BODY`; Mermaid source changed | Normal focus navigation added a child diagram block because a prior node selection remained live. |
| Docs Escape | first Escape blurred the editor to `BODY`; second Escape left Docs open | The promised two-stage blur/close behavior became unreachable after focus left the Docs event path. |

The export filename is a confirmed no-change pass: `.export-name-row` was `301/301` client/scroll px, the input ended at `x=333`, and the full `t_industries_siren` value remained visible.

## Patched acceptance

Disposable cumulative copy SHA-256: `C19BCBED16BD76353B075A7ABABD87EF007BEBE885E0254F7A94E6E8E4DA1A11`.

- Comments (`x=11..108.9`), Review (`x=113.9..186.8`) and Compare (`x=191.8..274.8`) all stayed wholly inside the viewport in natural order. Physical pointer clicks opened Comments and Review; Compare produced its honest one-diagram response.
- Real Tab input reached Comments → Review → Compare in DOM order. Each matched `:focus-visible`; the full five-pixel ring envelope stayed inside every clipping ancestor and `scrollX` remained zero.
- `#wpDoc` became `375/375` client/scroll px; the table wrapper stayed wholly inside the viewport with `overflow-x:auto`; no document-wide horizontal scrollbar remained.
- `.mobile-nav.inert === true` while Docs was open. Boundary Tab and a direct focus attempt could not enter it; closing Docs restored focusability.
- Tab from `BODY` left Mermaid source byte-identical. Tab while `#zoomViewport` owned focus still exercised the intended child-creation shortcut.
- First Escape from a contenteditable kept Docs open and focused `#wpDoc`; the second closed Docs and returned focus to `#workpapersButton`.
- Export filename geometry remained the same passing `301/301`, `x=333` result.
- Browser evidence: zero page errors, console errors, console warnings, or successful external responses.
- Syntax: one inline script (`2,742,204` characters), `node --check exit 0`. All four Python scripts compiled with warnings treated as errors.
- Reapplication: every script stopped on a zero-count original anchor; the cumulative-copy hash remained unchanged.
- Harness integrity: both the baseline and patched files retained their pre-run SHA-256 hashes; the exact main file also remained `40869437291203ABF7EDEECB597121D4EB273898DA088CD25900B138CA807F46`.

Machine-readable reports:

- Baseline: `output/playwright/r2-item3-final2-baseline-408694/report.json` — 14/14 assertions passed against the expected broken-state contracts.
- Patched: `output/playwright/r2-item3-final2-patched-408694/report.json` — 14/14 assertions passed against the repaired-state contracts.

Inspected captures:

- `output/playwright/r2-item3-final2-baseline-408694/02-compare-control.png`
- `output/playwright/r2-item3-final2-patched-408694/02-compare-control.png`
- `output/playwright/r2-item3-final2-baseline-408694/03-docs-mobile.png`
- `output/playwright/r2-item3-final2-patched-408694/03-docs-mobile.png`
- `output/playwright/r2-item3-final2-patched-408694/04-docs-table-local-scroll.png`
- `output/playwright/r2-item3-final2-patched-408694/01-export-filename.png`
- `output/playwright/r2-item3-final2-patched-408694/05-docs-after-escape.png`

## Post-landing main acceptance

- Applied-main SHA-256 before and after the real-app run: `11F1CC853B457601A3DA54209F6F55910F7D3F58B6BA6CA21BD3B403265C941D`.
- Standalone focused report: `output/playwright/r2-item3-main-11f1/report.json` — 14/14 contracts passed. All five captures in that directory were inspected.
- Unified scenario id: `R2.ITEM3.NARROW` in `qa/run_regression_suite.js`.
- Unified focused report: `output/regression-suite/r2-item3-main-11f1/report.json` — 20/20 scenario assertions passed, including browser telemetry; the complete filtered run passed 23/23 assertions including hash gates.
- Unified evidence captures: `r2-item3-narrow-export.png`, `r2-item3-narrow-review-actions.png`, `r2-item3-narrow-docs.png`, and `r2-item3-narrow-after-escape.png` in that run directory; all were inspected.

## Honest gaps

- Chromium is the measured acceptance browser; this item does not claim a screen-reader, Firefox, WebKit, or mobile Safari pass.
- The test checks the existing local table-scroll owner and document containment; it does not attempt to restyle dense table columns.
