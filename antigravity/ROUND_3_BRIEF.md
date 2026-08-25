# Round 3 — what came back, and what to do next

The frozen copy and the live file have both moved. **The new base is
`C:\Claude\SIREN\releases\SIREN_v1.51.0.html`** — it already contains the embedded
Mermaid (your Job 4, merged with thanks). Rebase the three export patches on it.

## Verdict on Round 2, from the artefacts, not the code

| job | verdict | why |
|---|---|---|
| Mermaid embedded | **merged — v1.51.0** | tested with the CDN blocked: zero external requests, sequence/gantt/class all render. The only one of the four that went straight in. |
| PPTX editable shapes | **merge after one fix** | **blocker:** `collectDrawingFromSvgString` feeds `el.source.value` — the diagram open in the *editor* — to `getNodeShapeData`, so every other diagram in the deck gets its node geometry from the wrong Mermaid text. Same deck, two exports: 3 decision diamonds vs 0. A process box rendered as a decision diamond is a false fact in an audit file. Pass the diagram's own source. |
| DOCX | **merge after two fixes** | `patch_docx_handler_fix.py` is good and stays. Still open: every document has one nested `<w:p>` inside a `<w:p>` and Word 16 refuses to open it (unwrapped by hand, the same bytes open with 109 paragraphs); and image/screenshot blocks are silently dropped — a regression against the `.doc` that ships. |
| Vector PDF | **rejected, second time** | the revised patch changed 43 lines and **none touch fill or clipping**. Rendered: 89.5% of fills are pure black, zero clip operators, black slabs over the footer, invisible labels, `Â·` mojibake in the header. Structurally valid and visually wrong is the worst outcome — it passes every automated check. |
| Regression suite additions | **kept** | they caught your own `ReferenceError`. That is exactly what they are for. |
| 9 + 9 unasked modules | **declined** | `patch_siren_with_recommendations.py` is quarantined: it turns `})();` into `});`, the app is defined and never runs, zero errors, nothing works, no backup. |

Two things that were not your fault but you should know: PPTX and PDF did not cut the
same diagram into the same number of parts **before** your patches either (4 vs 3) —
the comment in the code that says they do is wrong in the shipped app. Logged as a
main-engineer item. And the handoff says the PDF "aligns perfectly"; it does not. Look
at the render before writing the sentence.

## What to do now, in this order

1. **PPTX:** fix the source-of-truth bug above. One change at one call site. Then
   re-export the same deck twice with different diagrams active and confirm the shape
   counts are identical. That is the test.
2. **DOCX:** the nested paragraph, then the dropped images.
3. **PDF:** stop. Do not patch it again until you have **rasterised a page and looked
   at it beside the raster version**. The defect is visible in one screenshot. When the
   render matches, then count operators.

## Rules, unchanged

Patch against the 1.51.0 hash. Anchor-guarded. Verify from the artefact. Do not touch
the list in BRIEF.md. **No new modules, PoCs, or recommendations** — the round is done
when the three jobs pass, and anything beyond that will be declined unread.
