# Round 5 R source-span prototype

This directory is an isolated prototype. It does not modify the canonical
`round5_patches/R5_R_guided_source_integrity.py` patch.

## Contents

- `R5_R_span_prototype.py` — exact-count, input-SHA-guarded, atomic prototype
  patch for a copy of `FROZEN_1_66_0.html`. The output SHA remains
  `TO_BE_PINNED` because no Python runtime was available in this environment.
- `SIREN_1_66_0_R_SPAN.html` — directly patched browser-test candidate.
  SHA-256:
  `2B8EDA7CA826406CC1104470055D0EC68631E435326457B61D1B76A4DE2A9EF1`.
- `run_span_prototype.js` — targeted static and Playwright browser harness.
- `output/playwright/report.json` — final 30/30 passing report.
- `output/playwright/flowchart-exact-span-menu.png` — browser evidence with
  the valid preview, exact Guided source, and 14-shape menu visible.

## Implementation shape

The renderer builds its existing semantic chips and callback listeners first.
It then uses one `surgIndex(source)` snapshot per Guided rebuild to remount those
same live DOM nodes on authoritative source spans. Text between spans is copied
unchanged. A token-count, kind, ordering, or range mismatch fails closed to one
exact raw-line editor, never to guessed semantic controls.

The unlabeled-connector action and implicit bare-node shape/label actions have
empty DOM text; their visible glyphs are CSS generated content. Consequently
the idle `.struct-code-text.textContent` stays exactly equal to the source row.

## Re-run

```powershell
node --check round5_r_span_prototype\run_span_prototype.js
node round5_r_span_prototype\run_span_prototype.js `
  --app round5_r_span_prototype\SIREN_1_66_0_R_SPAN.html `
  --output round5_r_span_prototype\output\playwright
```

Expected summary: `{"passed":30,"failed":0,"fatal":false}`.

The browser case verifies a valid `flowchart   LR` source with header
case/spacing, quoted numeric Mermaid entities, comments, a group, irregular
link spacing, a mid-form inline label, an unlabeled connector, a bare node,
trailing spaces, and a whitespace-only row. It also exercises shape, inline
label, and add-label writes; rechecks exact row parity after each write; checks
the explicit and implicit 14-shape menus; checks non-flowchart fail-closed rows;
and captures browser/runtime errors.

## Bounded tradeoffs

- Existing edit callbacks still intentionally rewrite the line being edited
  into their canonical Mermaid form. The next Guided render is exact to that
  newly written source; unrelated rows are not changed.
- Ambiguous or unsupported lines (including rows split into multiple surgical
  statements by a semicolon, such as an HTML-style entity in an unquoted
  mid-link label) render as one exact raw editor. This sacrifices chip-level
  editing on that row rather than attaching a control to the wrong lexeme.
- Exact `textContent` is an idle/committed-render invariant. While an inline
  `<input>` is open, its current `value` is not represented by DOM
  `textContent`; parity is re-established after commit or cancel.
