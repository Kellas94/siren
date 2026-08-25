# C5 — Docs PowerPoint verification

Status at verification handoff: patch ready and deliberately **not applied by this subtask** to `SIREN_v1.35.0_for_codex.html`. The parent engineer applied it after this verification completed; the baseline hash below records the source the patch was built and tested against.

## Patch integrity

- Baseline SHA-256 before and after this subtask's testing: `0F9604F668A029A1102F62DA3044DEE0927808B33D2C154B3428185828E203B2`.
- Patch: `patches/C5_docs_pptx.py`; SHA-256 `7548E976BC4E06DA5B9DBDA776F5C26C90D7D6DF0A3C01AC2BAF1E208C3703E1`.
- The Python patch compiles, exact-count guards all six anchors, writes a same-directory temporary file, flushes + `fsync`s, and commits with `os.replace`.
- Applied first to `qa/SIREN_C5_test.html`; after the handoff, the parent applied it to the reviewed main baseline. The resulting main SHA-256 is `3579173E9E2887ADF8670DDC970D18C8B60132E7E900831B60CF81740A76F8E3`; both copies reported one script block and `node --check exit 0`.
- A reapplication attempt on the parent-applied main stopped at the first moved anchor and left that hash unchanged.
- The installed C5 region does not call Present/Map/deck/ambient functions. It reuses only the permitted ZIP, diagram renderer, SVG/canvas/blob, theme, master and layout helpers.

## Real-UI mixed-document export

Driven through the disposable application's own UI using `qa/c5_pptx_mixed_document.json`; attached `output/logo/logo-comparison.png` with the image block picker, then used the active-document PowerPoint choice.

- UI result: no import warnings, no page errors, download succeeded.
- Package: 7 slides, 2 media parts (image evidence + cold-cache linked diagram), 16:9, 15/15 blocks represented, 1/1 diagram rendered.
- `qa/validate_c5_pptx.py`: CRC clean; every XML part parsed; every relationship target and image embed resolved; all sentinels present; `SIRENExportSummary` present; zero errors.
- Microsoft PowerPoint opened the file read-only without repair and rendered 7/7 slides at 1600×900.
- Visually inspected the title, preamble, condensed image section, condensed multi-table section, long-checklist sampling, diagram and export-summary slides. Text is 16 pt+; section titles are 35 pt and the document title is 50 pt. No collisions remained.
- Dense sections with multiple table-like blocks use an explicit readable block-level fallback; provenance, full confirmed UTC timestamp, payload size and test-run label remain visible and the fallback is counted in the summary.

## Native table, H2 and XML-control case

Driven through the same UI with `qa/c5_pptx_simple_table.json`.

- A document whose shallowest heading is H2 produced separate Overview and H2 section slides.
- The section contains one native DrawingML table (`a:tbl`), not a picture; preamble, H2 and table sentinels were visible.
- An escaped U+0001 input was scrubbed to U+FFFD. All XML parsed and no XML 1.0-invalid control remained.
- CRC clean; Microsoft PowerPoint opened and rendered 4/4 slides; the H2/table slides were visually inspected.

## Scoped multi-document route

- After applying C5, the global Export dialog's Docs scope selected two imported documents and the `Docs (PowerPoint)` action downloaded one 10-slide deck.
- UI status reported 18/18 blocks and 1/1 linked diagram; no page errors occurred. CRC/XML/relationship/sentinel validation returned zero errors, and Microsoft PowerPoint opened and rendered 10/10 slides without repair.

## 311 KB / 254,000-character document

Driven through the same UI with `WP-001_Agent_specification_-_TB_Result_Monthly_Audit_v3_4.json`.

- Input: 311,895 bytes; five knowledge payloads, 254,000 source characters.
- Output: 35,460 bytes, 3 slides, 18,236 bytes of slide XML, 39/39 blocks represented.
- Summary records `payloads: 5`, `payloadCharacters: 254000` and explicit knowledge/section condensation fallbacks. The payload itself is not copied into slide XML and did not create hundreds of slides.
- CRC clean; Microsoft PowerPoint opened and rendered 3/3 slides. The condensed content and export-summary slides were visually inspected at 16 pt+.

## Deliberate boundaries

- No changes were made to Present, Map, deck sequencing or ambient surfaces.
- No external URL, dependency, font, image or network path is introduced; the writer remains CSP-safe, offline and single-file.
- This subtask did not write the real application HTML; the parent engineer applied the handoff patch afterward.
