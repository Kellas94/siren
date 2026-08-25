# SIREN Round 3 — patch and evidence handback

Date: 23 August 2026

## Outcome

Jobs A–E were completed in the requested order. Job A changes test/evidence code only. Jobs B–E are delivered as twelve ordered application patches; no merged HTML is part of this handback. Job F was not started.

Frozen source: `FROZEN_1_63_5.html`, 8,212,700 bytes, SHA-256 `E895B205D6E84F2F0E611164AF66FF29722645AD1073A1C6FB97C3DA1DFBD628`.

All twelve application patches guard the exact input and replacement counts, stage the complete transform, and install atomically. Eleven also pin their exact output SHA internally. Job C pins its B06 input and exact anchors; its deterministic output `2C7E0E75DBAF8B0D35A1A708E693D1CB6C35E88FCC4AFE85B238C9FF08DED035` was independently measured by the clean reapply.

## Deliverables

| Job | Result | Evidence |
|---|---|---|
| A — regression suite | Final B–E gate 48/48 scenarios, 472/472 assertions, 31 validated exports; exact-DOM heap oracle; 23/23 mutation kills | `qa_round3/ROUND3_JOB_A_SUMMARY_TEMPLATE.md`, `qa_round3/APPLY_ORDER.md` |
| B — PDF stage two | Six patches: compression, mono/italic fidelity, supported gradients, transparent tiles, marker-mid and measured page budget | `round3_work/pdf_stage2/B_HANDOFF.md` |
| C — Excel export | Multi-diagram workbook, editable shapes, native tables/types, fallback picture and guarded re-import | `round3_work/job_c/JOB_C_FINAL_EVIDENCE.md` |
| D — import robustness | 23/23 fixtures: 7 complete imports and 16 exact, visibly explained refusals | `round3_work/job_d/D_HANDOFF.md` |
| E — storage resilience | 67/67 failure-mode assertions; committed writes, quota, corruption and tab-conflict recovery | `round3_work/job_e/E_HANDOFF.md` |

Patch hashes are in `round3_patches/SHA256SUMS.txt`.

## Application patch order

Apply only in this order:

| Patch | Input SHA-256 | Output SHA-256 |
|---|---|---|
| `R3_B01_pdf_compression.py` | `E895B205D6E84F2F0E611164AF66FF29722645AD1073A1C6FB97C3DA1DFBD628` | `63143AA1264C6EFCDB07A844B4C287FDEF464BF782BAB9229D1A82F911F738AC` |
| `R3_B02_pdf_mono_italic.py` | `63143AA1264C6EFCDB07A844B4C287FDEF464BF782BAB9229D1A82F911F738AC` | `13C9102A163302F360E74A6F6D5F5EF03980002B0784A3796E6E422BFAE30D7E` |
| `R3_B03_pdf_gradients.py` | `13C9102A163302F360E74A6F6D5F5EF03980002B0784A3796E6E422BFAE30D7E` | `78499AD62FE1DDB36EF159AED6CE1FB4F0018E581D249A07C4677928B39C0B0F` |
| `R3_B04_pdf_transparent_tiles.py` | `78499AD62FE1DDB36EF159AED6CE1FB4F0018E581D249A07C4677928B39C0B0F` | `84378252E8A80BB63C1E006BD98879DF9CAFA4BCF122518383C571BC8C1D609E` |
| `R3_B05_pdf_marker_mid.py` | `84378252E8A80BB63C1E006BD98879DF9CAFA4BCF122518383C571BC8C1D609E` | `F327E5416C274A714D87942B700C85B8F7A3B5476DE3C73883860BA8CC43398D` |
| `R3_B06_pdf_page_budget.py` | `F327E5416C274A714D87942B700C85B8F7A3B5476DE3C73883860BA8CC43398D` | `B3AFEC207B13997E9F7BAD19D3E18CB2F9C35AD13FFDB8029FD97DB1F64B134E` |
| `R3_C_finish_excel_export.py` | `B3AFEC207B13997E9F7BAD19D3E18CB2F9C35AD13FFDB8029FD97DB1F64B134E` | `2C7E0E75DBAF8B0D35A1A708E693D1CB6C35E88FCC4AFE85B238C9FF08DED035` |
| `R3_D1_safe_import_ingress.py` | `2C7E0E75DBAF8B0D35A1A708E693D1CB6C35E88FCC4AFE85B238C9FF08DED035` | `6F932E260931FFC30ADBE88A352B822E26E3B3CDE6C665BEDD20EB860275FA40` |
| `R3_D2_csv_integrity.py` | `6F932E260931FFC30ADBE88A352B822E26E3B3CDE6C665BEDD20EB860275FA40` | `2BFA959E47424439F45484B2E2BC273C5B810925EEAD9F08CD58212A820DBA8F` |
| `R3_D3_drawio_loss_gate.py` | `2BFA959E47424439F45484B2E2BC273C5B810925EEAD9F08CD58212A820DBA8F` | `D6892CE0BE357524CD68C33FFAA9ECB8A243BC2DCF09BE3CCC93DDB9811AA1C8` |
| `R3_D4_xlsx_zip_limits.py` | `D6892CE0BE357524CD68C33FFAA9ECB8A243BC2DCF09BE3CCC93DDB9811AA1C8` | `DDDD4461AAD9259B7F10926B62C38ACCC38C5869FE52DA07690D1563FDFF9E53` |
| `R3_E_storage_resilience.py` | `DDDD4461AAD9259B7F10926B62C38ACCC38C5869FE52DA07690D1563FDFF9E53` | `87E50E8B8925BA00B1DD9C2F9ECB4315C06C9F715D59B3637EFA3AE411B719FA` |

The pristine chain and protected-scope measurements are in `round3_work/final_chain_reapply_v1/EVIDENCE.md`, SHA-256 `29E929D990CDF6D658FDE49E5D19FF33CCF4AFBC9883C65D58158CA0F5BDE0C3`.

## Job A — regression gate

Public entry point:

```text
node qa_round3/run_round3_suite.js --app <patched-copy.html> --expected-sha <sha256> --output <directory>
```

Canonical current construction and the historical-migration split are documented in `qa_round3/APPLY_ORDER.md`. The final maintained files are:

| File | SHA-256 |
|---|---|
| `qa_round3/run_regression_suite.js` | `46B03B1E6EE93659352EFB7F7458B31BA56CD5D3DA1ADDD2E63E9ECC77DE2A42` |
| `qa_round3/validate_regression_exports.py` | `61D05B3D9F703F6397649CE537DF236F8024B0FCFD75598800506893B2FB0B4F` |
| `qa_round3/run_round3_suite.js` | `D8F76D0BCF731DE5128D9C197FFB5547AC473F3AE00310EBED01D6236A1D3935` |
| `qa_round3/run_round3_mutation_gate.js` | `474A946D82C1E0E8E4F5952D453B346AF9F8B50B97200AAB93813E0EDF5BA283` |

Chronological evidence:

| Gate | Application | Scenarios | Assertions | Result |
|---|---|---:|---:|---|
| Incoming suite | Frozen | 22/34 | 269/285 | Red; stale contracts established |
| A1 modernization | Frozen | 15/15 selected | 141/141 | Green |
| A2 Canvas | Frozen | 10/10 selected | 86/86 | Green |
| A3 exports/surfaces | Frozen | 11/11 selected | 100/100 | Green |
| Pre-D/E integrated | Frozen, earlier runner | 48/48 | 469/469 | Green chronological acceptance |
| Final public gate | Final B–E, runner `46B03B1E…` | 48/48 | 472/472 | Green; 31 exports, `fatal: false` |

Final report: `round3_work/final_regression_bcde_a10_elevated_v1/report.json`, SHA-256 `601E45A474A12F47FF749098D6C321E0B3950F7E9AE48FE628B87BD69ED02A1E`. Export validation SHA-256: `CABCF9654D19A856DF7ADD2D60D459C76801C13529675714F5BFB63D95A6E0B5`. A separate contradiction scan found no passing assertion whose actual value contradicted its expected/detail value.

The corrected A06 heap oracle measured exactly 40 fixture and DOM nodes, no unexpected IDs after Undo, no transient surfaces, 880 focus-ring transitions, six exact edit/Undo cycles, and 435,532 bytes second-phase heap growth against a 2,097,152-byte allowance. Exact-DOM evidence SHA-256: `FA123E17A2786F5CDC0F914DD90E93B56EF39B3BA6F78638A6A6D88E8B2EDA30`.

Mutation calibration `9289C0B80C627133778153E28A64CD6F23B588159E1BD5A6F77618DB36501C65` certified 16/16 pristine baselines and recorded 23/23 exact contracts. Final strict evidence `15F13424B3C47559CD797BB86035BEE5D859ED6989D47D2AF8B1725E25BB069C` certified 16/16 baselines and killed 23/23 mutants, with zero survivors, gate errors, blocked baselines/contracts, red baselines or fatal errors. A13 pins and semantically validates that completed report before publishing the summary.

The A07 conflict modal, A08 duplicate refusal, selected 1×1 table deletion controls and the 375 px Compare menu were rendered from the final evidence and visually inspected.

## Job B — PDF stage two

- Same-deck compression: 144,566 → 74,791 bytes, down 48.3%.
- Combined report: 151,821 → 111,506 bytes, down 26.6%.
- Final deck: 11 pages, SHA-256 `73D1F406A553396DA4B190FBEE9ABB86185BEB658B259C3EFD96CAC8D454321D`.
- Exact extraction retained `Ședință țară ăsta € – — " "`.
- Supported fill gradients are native PDF shadings; marker-mid is native; unsupported element fallbacks retain transparency through an alpha soft mask.
- The budget is 24,000 SVG elements: 23,915 remained vector; 24,015 used the existing honest raster fallback.

All 11 final pages and all eight exact-text fixture pages were rasterised with PyMuPDF and visually inspected beside their SVG/raster references. Aggregate exact-text mean absolute channel delta was 2.383; the worst page had 1.843% of pixels above delta 8. Acrobat, Edge and accessibility-tree confirmation is owner-attested, not a Codex measurement.

## Job C — Excel export

- The real UI exported one 181,320-byte, three-sheet workbook.
- Excel 16 COM opened without repair: worksheet counts 1/3, shape counts 5/3/1, one ListObject per sheet.
- OpenPyXL 3.1.5 passed CRC/XML and confirmed native date/number types, deterministic names and native tables.
- Single-sheet re-import retained 3 blocks, 2 edges and all asserted audit metadata; multi-sheet re-import refused before mutation and named the reason.
- Nine Excel-native PNG renders were inspected; editable flowchart geometry, the sequence fallback and the 32-column tables were readable.
- Single-diagram and deck PPTX canonical bytes stayed exact except their normal timestamp treatment.

## Job D — import robustness

Final matrix `round3_work/job_d/post_full_v1/import-matrix.json`, SHA-256 `F7FD96E0D472D5D82AC3F1A6C91891037CC01609B1A58247BD322C9BA84E3FBF`: 23/23 cases, comprising seven complete imports and sixteen exact refusals. Every refusal kept the exact previous IndexedDB/source hash and showed a non-empty explanation. There were no harness, page, console or external-request errors.

Accepted cases cover UTF-8 BOM, UTF-16LE/BE Mermaid, Windows-1252 and UTF-8-BOM CSV, a v1.29.3 project and a named `Structure` worksheet in sheet 3. Refusals cover empty/binary/malformed/wrong-extension inputs, malformed/newer projects, lossy CSV/draw.io cases, unsafe XLSX cases and the 40 MB CSV. The broken-Mermaid, CP1252 CSV, complex draw.io and sheet-3 screenshots were rendered and inspected.

## Job E — storage resilience

Final matrix `round3_work/job_e/final_matrix_v1/storage-matrix.json`, SHA-256 `569EC5B0AC7ABDF01E5D4D72E243B332C1B8F8190D8257D52C89442DB46C6998`: 67/67 assertions, `fatal: false`. The frozen red control failed 13 assertions, proving that the gate detects the repaired contracts.

The matrix exercises IndexedDB unavailable and transaction abort, serialized overlapping autosaves, reload during debounce, two diverging tabs, corrupt primary records with/without last-good, semantically invalid JSON, localStorage pending-shadow recovery, real per-origin localStorage quota and an 80-diagram, 3,985,568-byte workspace. Five final recovery/quota screenshots were rendered and inspected.

## Integrity and protected scope

- Verification-only final B–E output: 8,334,689 bytes, SHA-256 `87E50E8B8925BA00B1DD9C2F9ECB4315C06C9F715D59B3637EFA3AE411B719FA`.
- `syncheck.py`: two script blocks; `node --check` exit 0.
- CSP text is byte-identical; `eval` and `new Function` remain absent; `fetch(` count remains 29.
- The declaration and value of `APP_VERSION` remain exactly `1.63.5`. Whole-file token occurrences are 17→18 because Job C adds export metadata; this is not a version edit.
- The CHANGELOG block is byte-identical and its token count remains 2→2.
- Six exact critical slices are byte-identical, and the full frozen→final diff audit found no hunk in any protected region named by the brief.

## Deliberately not claimed

- Protected Canvas still removes a note hung from a deleted host block, contrary to the requested Job-A contract. It was reported, not patched or normalized.
- Protected Docs revision restore preserves data but returns focus to an unnamed visible button because it targets hidden `#wpChangesButton`.
- Protected speaker-note, ambient-scene and presenter-window exports, a forced out-of-order approved-release drift refresh, native OS print completion and native Narrator/NVDA were not run.
- The full all-scenario Firefox/WebKit matrix was not run; Round 3 browser acceptance is Chromium.
- Job B still tiles `<use>`/nested SVG, textPath, patterns, filters, masks, varying-alpha or repeat/reflect gradients, gradient strokes, rotated characters, vertical writing and mixed direct-text/tspan cases. Arc marker-mid orientation uses the endpoint chord rather than a true elliptical tangent.
- Job C does not claim Excel PDF rendering because the host has no printer; Excel-native PNG rendering was used.
- Job D refuses complex draw.io and formulas without cached values rather than approximating/evaluating them. Its ZIP bounds are not a proof against every adversarial ZIP construction.
- Job E does not claim OS disk-full, multi-gigabyte IndexedDB quota, browser-process kill mid-transaction or a vendor private-window survey. A tiny pre-broadcast two-tab kill window remains.
- Job F was not started. No merged HTML is handed back.
