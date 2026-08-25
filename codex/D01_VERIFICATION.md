# D01 — delete the selected Docs table row or column

Status: verified on a disposable copy of the complete application, then applied to `SIREN_v1.35.0_for_codex.html`.

- Patch: `patches/D01_docs_delete_selected_table_axis.py`; SHA-256 `5B109037E1D5354107F26914E3D63EAE0FAA1320F995DA54B86D0592DE6B775B`.
- Baseline SHA-256 `EB47D55F5D1CBAD32298BE441C62D05246453BFA1B4DFC5941D5DF2D11124B5D`; applied result `F256AF8685623A751904A48409DBE4536576FD4BEEEC3C544FCBE31A284DE9D5`.
- The existing `− Row` and `− Column` buttons are disabled until a Docs table cell is selected. Focus/click highlights the chosen cell, its row and its column, shows `Selected row N, column N`, and gives each delete button an exact accessible label.
- Real UI middle-axis run: selecting `Preparer` identified 3 row cells and 3 column cells; deleting row 2 removed only `Source identity / PREPARER_EDITED / Complete`; deleting column 2 then removed only `Owner / Reviewer`. Undo restored the deleted row while retaining the immediately preceding `PREPARER_EDITED` cell edit as a separate history step.
- Real UI edge run: deleting the first row promoted the next row to three `<th>` cells; deleting the first column shifted the remaining values left. Deleting the last remaining optional axes stopped at a 1×1 table and disabled both delete controls.
- Selection was re-established on the nearest surviving cell after each rerender. The final 1×1 matrix survived IndexedDB save and a full page reload.
- Chromium reported zero console warnings/errors and zero page errors. Rendered selection evidence was inspected at `output/playwright/D01_docs_selected_row_column.png`.
- The transformed app contains one inline script and `node --check exit 0`. Reapplication stopped at the first exact-count guard and left the applied hash unchanged.
- Independent audit confirmed two exact-count replacements, unique sibling `mkstemp`, flush/`fsync`, atomic `os.replace`, Docs-scoped `.wp-doc-table` selectors, and zero Present/Map/card-editor/ambient identifiers.
