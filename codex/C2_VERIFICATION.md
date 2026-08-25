# C2 cross-references verification

Status: the package was first verified on a disposable copy as recorded below, then rebased and applied by the parent review to `SIREN_v1.35.0_for_codex.html` before C3.

## Mechanical checks

- Baseline: current C1-updated application, SHA-256 `09dbd7e2723e12e796a694c40871464aeb49f8c88aecab50b30bd579e468122c`.
- `python patches/C2_cross_references.py --check`: passed all 17 exact-count anchors and did not write the target.
- Applied only to `output/c2-verification/SIREN_C2_patched_copy.html`: atomic replacement succeeded; patched SHA-256 `1a59e3065d2d78e18f54dd752f31bb09ef42fb58ac53ad4b321f281522da6b48`.
- `python syncheck.py output/c2-verification/SIREN_C2_patched_copy.html`: one inline script, `node --check` exit 0.
- The patch script contains no Present/Map anchors or edits.

## Real-application UI checks

Playwright drove the patched copy served by SIREN's normal local server, not a standalone harness. All cases completed with zero page errors:

- Authored document and block references; chips navigated to the target document and focused the referenced block.
- Deleted the referenced block; its chip remained visible, disabled and dashed with a warning instead of disappearing.
- Imported a standalone document with self-document and self-block references; the fresh document id was remapped and both references stayed live.
- Imported a legacy `{ diagramId, nodeId, label }` link; it remained a diagram reference and an absent target was shown as a visible warning.
- Merged a project containing cross-document, cross-block and legacy diagram references; the two-pass id remap kept all three live.
- Exported Markdown and HTML through the Docs UI; both contained readable document and block references. The same readable helper feeds Word/PDF and Excel; JSON retains the structured links.

Rendered evidence: `output/playwright/c2-cross-references/links-live-and-dangling.png`.
