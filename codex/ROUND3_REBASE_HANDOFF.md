# SIREN Round 3 — v1.64.0 rebase handback

Date: 23 August 2026

## Outcome

The twelve accepted B–E application patches were re-cut against `FROZEN_1_64_0.html` and every input/output SHA was re-pinned. A clean ordered apply and a separate clean reapply both produced 8,379,854 bytes, SHA-256 `CB107D5CC860CBEDD73BC0AC44FB924545177C7BCEACBCC8CEF03C7035593B25`.

No application anchor moved. All 100 guarded anchor checks still occurred exactly once; the v1.64.0 changes were disjoint from the PDF writer, Excel writer, import ingress and `sirenStore` bodies touched by B–E. The only source-script edits outside SHA values were B01's version wording, Job C's corrected usage path, and Job C's missing exact output-SHA postcondition.

No merged HTML is handed back. `round3_rebase_work/verify_reapply_v2.html` is verification-only.

## Apply order

Source identity: 8,257,865 bytes, SHA-256 `F6330D42E570DF0CA722CC7F3149F748315A8DA29AD766EF79DDE4D413EAF59A`.

| Patch | Input SHA-256 | Output SHA-256 |
|---|---|---|
| `R3_B01_pdf_compression.py` | `F6330D42E570DF0CA722CC7F3149F748315A8DA29AD766EF79DDE4D413EAF59A` | `F05DCC4B1CA4993B1BC0DD1B4DAC2BFDF4B78B795760954182098ACA0F9EB541` |
| `R3_B02_pdf_mono_italic.py` | `F05DCC4B1CA4993B1BC0DD1B4DAC2BFDF4B78B795760954182098ACA0F9EB541` | `C553E324E53F5CC35B941B5E1E8EE4E2D41998B890DAE364C24E9D7C20454002` |
| `R3_B03_pdf_gradients.py` | `C553E324E53F5CC35B941B5E1E8EE4E2D41998B890DAE364C24E9D7C20454002` | `EC85512E23277729F9BCE7FD572A5BDE0067FB12FEE77F84948C5C942BB86238` |
| `R3_B04_pdf_transparent_tiles.py` | `EC85512E23277729F9BCE7FD572A5BDE0067FB12FEE77F84948C5C942BB86238` | `5554FF171845ADD323A352BEB0A7FB0D6ADA246D99A8AB10F46A061A00F5E0A2` |
| `R3_B05_pdf_marker_mid.py` | `5554FF171845ADD323A352BEB0A7FB0D6ADA246D99A8AB10F46A061A00F5E0A2` | `9C522EF2C4181597CEE646322385030791191242E11844CA02FED389E71AD3AF` |
| `R3_B06_pdf_page_budget.py` | `9C522EF2C4181597CEE646322385030791191242E11844CA02FED389E71AD3AF` | `3257A0637960301295D77F07A68612FE90F95FF364BC27BFDD2A85CD2DC2F6E5` |
| `R3_C_finish_excel_export.py` | `3257A0637960301295D77F07A68612FE90F95FF364BC27BFDD2A85CD2DC2F6E5` | `775CAC308D3F0F398D9E6C6D035C015432C073BB77B90738323E7D2A73A81581` |
| `R3_D1_safe_import_ingress.py` | `775CAC308D3F0F398D9E6C6D035C015432C073BB77B90738323E7D2A73A81581` | `F7862C19C1F11F7EA0AF33BDDE63E47E8BF9AFD7F49E79DEFC5CB2933F22C0FC` |
| `R3_D2_csv_integrity.py` | `F7862C19C1F11F7EA0AF33BDDE63E47E8BF9AFD7F49E79DEFC5CB2933F22C0FC` | `B2F963887661112FCEEF06EF28CDD1467128AA16BC3BA1B33DE8C6E807A8911B` |
| `R3_D3_drawio_loss_gate.py` | `B2F963887661112FCEEF06EF28CDD1467128AA16BC3BA1B33DE8C6E807A8911B` | `0C96808C2E08CCAA8BDEB6EA6A11A2DB8E8590859672E7407020EA00108018BC` |
| `R3_D4_xlsx_zip_limits.py` | `0C96808C2E08CCAA8BDEB6EA6A11A2DB8E8590859672E7407020EA00108018BC` | `0B796C580B7A8EB44A4047F9F20F6B7D9B7C86476A4BB41F3A8ED42EC8E6119A` |
| `R3_E_storage_resilience.py` | `0B796C580B7A8EB44A4047F9F20F6B7D9B7C86476A4BB41F3A8ED42EC8E6119A` | `CB107D5CC860CBEDD73BC0AC44FB924545177C7BCEACBCC8CEF03C7035593B25` |

Files: `round3_rebase_patches/`. Exact script hashes: `round3_rebase_patches/SHA256SUMS.txt`.

## Job A refresh

Apply `round3_rebase_patches/R3_REBASE_A1_refresh_1640_suite.py` once to the accepted Round 3 test files. It is exact-input, exact-anchor and exact-output guarded. It makes four maintained-file updates and writes two pinned historical runtime copies:

- `R3.SURFACE.CENSUS` now expects nine desktop preview-toolbar controls and separately measures ten visible phone controls at 375×812, including Connect.
- `EXPORT.MAIN` opens Style with `#styleShortcutButton`, waits for the title input, types, and verifies the rendered `#diagramTitlePreview` value.
- A07/A07B declares `requiresPatch: R3_E`; A08 declares `requiresPatch: R3_D`. On an unpatched build the suite reports `expected red: requires R3_*` before opening a browser context. On a patched build both run normally, so unrelated failures cannot be masked.
- The accepted mutation gate remains honestly pinned to its 1.63.5 runner, surface module and calibration evidence. It was not partially or falsely re-labelled as a 1.64.0 mutation calibration. Its 23/23 exact anchors pass from the archived runtime.

Updated maintained test hashes:

| File | SHA-256 |
|---|---|
| `qa_round3/run_regression_suite.js` | `ACC72AA71FA02D875EB269D6DE59F678F48F0A069832FEA75F6356ACD9BD5E1F` |
| `qa_round3/surface_suite_additions.js` | `542C415467B0EF8DD04660698FFB0BD0110066F646EDAC226192A1F5E1EC39C4` |
| `qa_round3/run_round3_suite.js` | `0BF9DDC0C928D129E3267E8ECD3967A7817C0002335351428B19261590C5253E` |
| `qa_round3/run_round3_mutation_gate.js` | `F7F9A9397D5A56658ADB8AEDC8D15FDA08C6CF5D016D443FC150381F9CAE7813` |

## What happened to the four live-1.64.0 failures

The owner's pre-rebase evidence, `run_on_1640/report.json`, contains 44/48 passing scenarios and 428/433 passing assertions. The result after the suite refresh is:

| Prior red | Final classification/result |
|---|---|
| `EXPORT.MAIN` | Green after opening the collapsed Style fold; input and rendered title agree. |
| `R3.SURFACE.CENSUS` | Green at desktop 9 / mobile 10; Connect is visible, nonzero, inside the phone toolbar and centred in the viewport. Its measured box is 32×44 px, so no invented 44×44 assertion was added. |
| `A07.A07B` | `expected red: requires R3_E` on unpatched 1.64.0; 12/12 assertions green on the rebased final. |
| `A08` | `expected red: requires R3_D` on unpatched 1.64.0; 8/8 assertions green on the rebased final. |

The unpatched dependency-classification run has two expected-red scenarios, zero failed scenarios/assertions, `fatal: false` and an unchanged source hash.

## Final Job A gate

Command:

```text
node qa_round3/run_round3_suite.js --app round3_rebase_work/verify_reapply_v2.html --expected-sha CB107D5CC860CBEDD73BC0AC44FB924545177C7BCEACBCC8CEF03C7035593B25 --output round3_rebase_work/job_a_gate_final_1640
```

Result: 48/48 scenarios, 475/475 assertions, zero failed/skipped/expected-red, 31/31 exports structurally valid, Word COM green, PowerPoint COM green, `fatal: false`, and the application SHA unchanged. Report: `round3_rebase_work/job_a_gate_final_1640/report.json`, SHA-256 `382E67E075DB26BAD0ABAE53117BAF2AE061C5DDCE0F92B0984C15E5E1185CC9`.

The focused four-contract run passed 7/7 scenarios and 70/70 assertions. Its Style and 375 px captures were rendered and inspected.

## Integrity and protected scope

- Correct syntax checker: two script blocks, 7,420,062 JavaScript characters, `node --check` exit 0.
- `APP_VERSION` remains exactly 1.64.0; CHANGELOG, CSP and all seven audited protected slices are byte-identical.
- `eval` and `new Function` remain absent; `sirenStore.set` caller count stays 19→19.
- Present, Map, the deck, ambient scenes and protected Docs/Canvas regions were not edited.
- Machine-readable evidence: `round3_rebase_work/rebase_integrity.json`.

## Deliberately not done

- Job F remains on hold.
- No protected-region finding was fixed or normalized.
- The accepted 23-mutant 1.63.5 gate was preserved, its 23 anchors were checked, and one bounded live smoke certified the pristine baseline then killed `grow-edge`. It is not claimed as a new 1.64.0 live mutation recalibration.
- No merged HTML is part of this handback.
