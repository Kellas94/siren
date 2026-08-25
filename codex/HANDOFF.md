# SIREN v1.35.0 — final engineering handback

## 1. Delivered state

- Final working copy: `SIREN_v1.35.0_for_codex.html`.
- SHA-256: `F025ACB5F18E7E81B296E931B6951A1A02110562F9D7B4CE1FDAED5F2928DF6C`.
- Size: 3,591,449 bytes.
- Syntax: one inline script, 2,778,888 JavaScript characters, `node --check exit 0`.
- Final immutable checkpoint: `checkpoints/FINAL_SIREN_round2_2026-08-20.html`, byte-identical to the working copy.
- Final all-scenario Chromium gate: 31/31 scenarios, 284/284 assertions, zero failures/skips/fatal errors, and exact pre/post HTML hash identity.
- Deep export validation: 26/26 generated files passed structural and content checks.
- Final R2.20 focus gate: Chromium, Firefox and WebKit each passed 10/10 on the exact F025 application.

The application remains a CSP-safe, offline-capable single file. No external runtime dependency, external image path, `eval`, `new Function`, or CSP weakening was introduced.

The reproducible delivery contract is the ordered set of scripts under `patches/`, not a line-number diff. Every final script checks exact anchor counts and writes through a sibling temporary file followed by `os.replace`. Run with normal Python, never `python -O`, because the guards use `assert`. A failed anchor is a required review stop.

Two Mermaid-loader experiments are deliberately excluded from the applicable sequence: `R2_01_preflight_local_mermaid.py` and `R2_01b_require_explicit_local_mermaid.py`. The final standalone package is `R2_01_quiet_optional_mermaid.py`.

## 2. Ranked findings

`ENGINEERING_REVIEW.md` is the exhaustive first-round ledger. `ROUND2_ENGINEERING_REVIEW.md` is the exhaustive second-round ledger. Each records severity, searchable source anchor, concrete failure scenario, fix, status and evidence. The highest-value first-round results were cross-tab overwrite prevention, prototype-safe import, lossless legacy-state migration/recovery, edit-limit parity, stable release capture, duplicate-id repair and Docs lifecycle teardown.

The complete second-round set is summarised below. Every item was reproduced before its fix; non-reproductions are listed separately.

| Severity | Searchable source string | Concrete old failure | Fix |
|---|---|---|---|
| **Critical** | `projectFileHandle = handle;` beside direct Open validation | Cancelling a valid Open, or choosing truncated JSON, armed that rejected file; the next Ctrl+S could overwrite it with the current workspace. | R2.02 moves handle assignment after successful validation, confirmation and apply. |
| **High** | `revisions: (Array.isArray(doc.revisions)` and the Restore assignment to `doc.blocks` | Restoring an oversized archived revision silently cut exact historical content and its author field. | R2.18 rejects new over-limit ingress atomically and gives legacy evidence Cancel / exact export / bounded restore choices. |
| **High** | `function validatePortableProject(payload)` | A 200,028-character project prompt could be accepted and silently shortened to 200,000 characters. | R2.05 performs detached preflight and rejects any cut before confirmation or mutation. |
| **High** | `function importWorkpaperDocument(payload, fileName, sourceName, sourceChars)` | Native Docs JSON imported successfully but lost comments, review trail/state, owner/status and timestamps. | R2.04 round-trips all defined safe native metadata; revisions are handled by R2.18. |
| **High** | `async function readWorkpaperImportText(file)` and the Register import listener | CP1252 bytes were decoded to U+FFFD and persisted or presented as valid content. | R2.09/R2.09b use fatal UTF-8 or BOM-marked UTF-16 decoding and fail atomically. |
| **High** | `function xlsxInlineCell(columnIndex, rowNumber, value, styleId = 0)` | U+0001 produced malformed `sheet2.xml` even though the scoped XLSX download succeeded. | R2.03 emits explicit readable tokens such as `[U+0001]` in human exports; JSON remains exact. |
| **High** | Knowledge drop `const files = Array.from(event.dataTransfer.files || [])` | Dropping 81 files imported 80, silently lost file 81 and showed green success. | R2.07 checks capacity first; 81 is rejected whole and the exact 80-file boundary remains valid. |
| **High** | `function handleCanvasCreationKeys(event)` | Plain Tab from BODY could add a Mermaid child node because stale canvas selection remained active. | R2.13 requires the actual zoom viewport focus context. |
| **Medium** | `function validatePortableProject(payload)` diagram checks | A project containing `null`/array diagram records crossed validation and failed later after confirmation. | R2.06 requires every diagram record to be a non-null, non-array object. |
| **Medium** | `async function handleWorkpaperImportFile(file)` | A malformed `.json` missing `{` was reclassified as Markdown and imported as prose with success. | R2.08 makes the `.json` extension authoritative and fail-closed. |
| **Medium** | `function openStructureMenu(anchor, items, current, onPick, config = null)` | Docs menus, palette and Find lacked repeatable Arrow/Home/End/Escape/Tab behavior and reliable focus return. | R2.16 adds a Docs-only managed keyboard contract. |
| **Medium** | `function renderWorkpaperBlocks(doc)` | Rerenders dropped focus, block actions were absent from Tab order, and duplicate ids could restore focus to the wrong instance. | R2.17 uses per-instance focus identity, keyboard-visible actions and scoped post-render restoration. |
| **Medium** | `#wpDocMenuButton`, `#wpReviewButton`, `function syncWorkpaperPanelDisclosure()` | Core Docs controls and regions exposed incomplete names, state and disclosure relationships. | R2.14 adds names, regions, status and synchronised `aria-expanded`/`aria-controls`. |
| **Medium** | `function buildWorkpaperBlock(doc, block, index)` | Rich editors, headings, cells and repeated actions had generic or ambiguous accessibility semantics. | R2.15 supplies block-position roles, heading levels and contextual control names. |
| **Medium** | `function refreshWorkpaperChangeMarkers(doc)` | At 300 blocks/200 comments one pass made 45,150 block visits and 40,100 comment visits. | R2.19 builds a first-match block Map and open-comment Set once per pass. |
| **Medium** | `function openWorkpaperRevisionRecovery(doc, revision, prepared)` | WebKit preserved data on Cancel/Escape but dropped focus to the Docs root instead of the invoking Restore button. | R2.20 threads and explicitly restores the exact invoker; successful restore still focuses Changes. |
| **Medium** | phone rules for `.wp-blocks, .wp-block` | At 375 px Docs had 375 px client width but 552 px scroll width, clipping the document by 177 px. | R2.11 lets nested grids shrink and keeps dense-table overflow local. |
| **Medium** | `function setWorkpapersOpen(open)` | Covered `.mobile-nav` controls remained in the Tab sequence beneath full-screen Docs. | R2.12 includes mobile navigation in the inert lifecycle and restores it on close. |
| **Medium** | phone `.preview-pane .pane-actions` rules | Review and Compare were beyond the 375 px pointer viewport; focus rings were clipped. | R2.10 wraps the existing controls in natural Comments → Review → Compare order. |
| **Medium** | Docs Escape branch matching `[contenteditable], input, textarea, select` | First Escape blurred to BODY, making the documented second Escape unable to close Docs. | R2.13 returns focus to the Docs surface after stage one, then closes and returns to the launcher. |
| **Low** | `function mermaidSources()` / `LOCAL_MERMAID_SRC` | Default boot requested an absent optional `mermaid.min.js`, generating a local 404 before fallback. | R2.01 tries the sibling only after explicit or remembered local-mode success. |

### Confirmed no-change decisions

- The reported squeezed export filename did not reproduce. At 375 px its row and input were both 301 px wide and the complete value was visible; no filename patch was invented.
- The original Firefox/WebKit item-5 matrix reproduced no app defect in its bounded paths. The later revision-recovery scenario exercised a new path, exposed the WebKit focus defect above, and R2.20 fixed it.
- A valid 20,971,984-byte Merge/Direct fixture reached an honest confirmation in 826/809 ms and was cancelled without mutation. This did not justify inventing a global 20 MB limit for those doors; behavior above the bounded fixture remains unclaimed.
- An apparent 30.344-second over-cap import delay was a Playwright wait for an intentionally absent textarea. Focused medians were 26 ms Main, 22 ms Merge and 45 ms Direct, with no event-loop gap over 50 ms.

## 3. Standalone patch manifest and verification

### First round, logo and initial Docs packages

Apply in this order when reconstructing from the original baseline.

| Order | Patch | One-line verification |
|---:|---|---|
| 1 | `A01_harden_deep_merge.py` | The adversarial project no longer polluted `Object.prototype`. |
| 2 | `A02_migrate_legacy_indexeddb.py` | Normal startup loaded the legacy-only IndexedDB sentinel. |
| 3 | `A03_preserve_dangling_links.py` | The supplied fixture retained 3/3 visible unresolved references, 39 blocks and 254,000 Knowledge characters. |
| 4 | `A04_align_edit_limits_and_unbound_register.py` | Seven long-field tail sentinels and 61/61 documents survived real UI edits/import. |
| 5 | `A05_recover_complete_workspace.py` | A workpaper-only crash draft was offered and restored through the real dialog. |
| 6 | `A06_teardown_docs_runtime.py` | Rapid switch/Undo stayed document-local and Docs lifecycle endpoints were torn down. |
| 7 | `A07_prevent_cross_tab_clobber.py` | A stale second tab was blocked while the newer tab survived reload and a recovery copy was written. |
| 8 | `A07b_ignore_identical_remote_snapshot.py` | Equal normalised startup snapshots no longer caused a false conflict. |
| 9 | `A08_repair_duplicate_diagram_ids.py` | The duplicate-id fixture reassigned one id and the second sentinel remained reachable. |
| 10 | `A09_stabilize_agent_releases.py` | Release capture freezes one operational value and malformed snapshots no longer crash rendering. |
| 11 | `A10_report_prompt_history_limits.py` | The 60-version boundary and honest trimming report replaced silent five-entry eviction. |
| 12 | `A11_fix_syncheck_target.py` | The harness checks this real app and returns `node --check exit 0`. |
| 13 | `A12_initialize_release_identity.py` | A no-id Agent Spec captured R1/R2 with stable hashes and zero page errors. |
| 14 | `B01_install_signal_path_logo.py` | Dark/Paper app lockups and 24/32/64 px comparisons were rendered and inspected. |
| 15 | `C1_find_in_document.py` | Ctrl+F found and selected the unique collapsed 254k Knowledge tail at `1 of 1`. |
| 16 | `C2_cross_references.py` | Live refs navigated; deleted targets remained visible warnings; imports/exports preserved meaning. |
| 17 | `C3_image_evidence.py` | PNG/JPEG upload, preview, caption and reload passed; external-src import was rejected without a request. |
| 18 | `C4_knowledge_provenance.py` | Provenance survived legacy/valid/invalid import and all scoped human/JSON export routes. |
| 19 | `C5_docs_pptx.py` | PowerPoint opened/rendered all slides; OOXML/relationships/media and deterministic summary validated. |
| 20 | `C6_performance_pass.py` | 254,000 chars stayed deferred; large-register key handlers improved 13.1 → 0.3 ms median. |
| 21 | `C7_remove_confirmed_dead_code.py` | Removed 5,751 characters; six real-app surfaces rendered with zero errors and reapply stopped safely. |
| 22 | `A13_fix_direct_edge_waypoint.py` | D→C and C→G both created rerendered waypoints and enabled Undo. |
| 23 | `D01_docs_delete_selected_table_axis.py` | Selected row/column deletion, 1×1 guard, Undo isolation and save/reload passed in the real Docs table. |

### Round two

| Order | Patch | One-line verification |
|---:|---|---|
| 1 | `R2_01_quiet_optional_mermaid.py` | Default and explicit/remembered local boot selected the correct source with no local 404 or page error. |
| 2 | `R2_02_arm_disk_handle_after_confirm.py` | Cancelled/malformed selections got zero writes; only an accepted valid Open became the Ctrl+S target. |
| 3 | `R2_03_sanitize_xlsx_xml_cells.py` | Scoped XLSX became well formed and retained U+0001 honestly as `[U+0001]`; PDF rendering was inspected. |
| 4 | `R2_04_roundtrip_native_document_metadata.py` | Approved state, comment, trail, owner/status and original timestamps survived UI import/re-export. |
| 5 | `R2_05_reject_project_workpaper_cuts.py` | Main/Merge/Direct rejected 200,028→200,000 cuts before confirmation or mutation. |
| 6 | `R2_06_reject_null_diagram_records.py` | Main/Merge/Direct rejected malformed records atomically; valid controls still reached confirmation. |
| 7 | `R2_07_knowledge_drop_capacity.py` | An 81-file drop added nothing and reported capacity; the exact 80-file boundary added all 80. |
| 8 | `R2_08_strict_json_document_import.py` | Malformed `.json` left document count unchanged while a plain-text control still imported. |
| 9 | `R2_09_lossless_text_decoding.py` | UTF-8/BOM UTF-16 paths passed and CP1252 Docs/Knowledge batches failed before mutation. |
| 10 | `R2_09b_strict_register_text_decoding.py` | Register accepted supported encodings without U+FFFD and rejected CP1252 with `nothing was checked`. |
| 11 | `R2_10_keep_mobile_compare_visible.py` | Comments/Review/Compare were pointer-visible, Tab-ordered and had unclipped focus rings at 375 px. |
| 12 | `R2_11_contain_mobile_docs_width.py` | Docs overflow fell 177→0 px while table scrolling stayed local. |
| 13 | `R2_12_isolate_mobile_nav_under_docs.py` | Covered mobile navigation could not receive direct/Tab focus and became focusable again after close. |
| 14 | `R2_13_keep_keyboard_actions_in_context.py` | BODY Tab no longer mutated Mermaid; canvas shortcut and two-stage Docs Escape remained functional. |
| 15 | `R2_14_docs_surface_accessible_names_states.py` | Core surface, status, panel names and disclosure states passed AX/state checks. |
| 16 | `R2_15_docs_block_editor_semantics.py` | Rich editors, tables, headings, Knowledge and repeated actions exposed contextual roles/names. |
| 17 | `R2_16_docs_keyboard_popovers.py` | Docs menu/palette/Find Arrow/Tab/Escape lifecycle and exact invoker return passed repeatedly. |
| 18 | `R2_17_docs_rerender_focus_and_block_actions.py` | Focus survived mutation/release/link/duplicate/mobile rebuilds and block actions became keyboard-reachable. |
| 19 | `R2_18_bound_revision_ingress_and_restore.py` | Exact raw block/97-character author tails survived export; bounded restore, Cancel and Undo/Redo passed. |
| 20 | `R2_19_linearize_docs_change_markers.py` | Nested visits fell 45,150/40,100→0/0 and nine-pass median improved 7.9→1.4 ms with duplicate parity. |
| 21 | `R2_20_restore_revision_invoker_focus.py` | Chromium/Firefox/WebKit each passed Cancel, Escape, bounded restore and exact focus return 10/10. |

All final scripts are standalone, exact-count guarded and atomic. Reapplying the late packages to the final application stops at an anchor-count guard without changing F025.

### Shared primitive disclosure

R2.16 deliberately changes the shared `openStructureMenu` primitive. The change is opt-in behind `config.keyboard` for Docs callers. The default branch used by unmanaged and protected callers retains its prior listbox/options, first-focus, selection, away-close and no-return-focus behavior; a real config-null non-Docs control retained all 14 options and its original pick/close behavior. No other shared primitive was changed without disclosure.

## 4. Deliverable evidence

### Regression suite

- Entry point: `qa/run_regression_suite.js`.
- Runbook: `qa/REGRESSION_SUITE.md`.
- Exhaustive driver/evidence inventory: `qa/QA_INVENTORY.md` (53/53 `qa/*.js`, zero missing/extra).
- Final report: `output/regression-suite/full-final-f025/report.json`.
- Final export validation: `output/regression-suite/full-final-f025/export-validation.json`.
- The suite covers boot/telemetry, the supplied 39-block and 254,000-character fixture, save/reload, crash recovery, A01–A13, C7, D01, R2.01–R2.19 discriminators, active/scoped exports and read-only hash gates.

### Import robustness matrix

- Final matrix: `output/playwright/r2-import-matrix-final/matrix.json`.
- Report: `qa/R2_IMPORT_MATRIX_FINAL.md`.
- 40 deterministic fixtures / 43,222,250 bytes, 47 original path cases, three Register encoding controls and nine timing repetitions.
- Covered native Docs, Knowledge, main Import, Merge, direct Open, Register, both Copilot doors, Markdown/Mermaid, sanitizer, UTF-8/UTF-16 BOM variants, malformed/truncated JSON, CP1252, caps and large files.
- All recorded page-error arrays were empty; safe rejection paths left state unchanged.

### Narrow viewports

- Verification: `R2_ITEM3_VERIFICATION.md`.
- Applied-main report: `output/playwright/r2-item3-main-11f1/report.json`.
- Unified suite report: `output/regression-suite/r2-item3-main-11f1/report.json`.
- All claimed 375×812 states were rendered and inspected; the filename field remained an explicit no-change pass.

### Docs accessibility and keyboard operation

- Verification: `qa/R2_ITEM4_VERIFICATION.md`.
- Evidence bundle: `output/playwright/r2-item4-docs-a11y/`.
- Unified `R2.ITEM4.A11Y` passed on the integrated app and remained green in the final F025 suite.
- Evidence includes keyboard-only actions, accessibility-tree roles/names/states, menu/Find lifecycle, focus after subtree rebuilds, duplicate raw ids, Agent/Governance dialogs and the 375 px register switch.
- No native Narrator/NVDA pass is claimed. The Narrator attempt was stopped by the Computer Use safety layer because it could not establish the isolated browser URL; browser AX evidence is not relabelled as a screen-reader session.

### Cross-browser

- Report: `qa/R2_ITEM5_CROSS_BROWSER_REPORT.md`.
- Original bounded Firefox/WebKit matrix: 76/76 per engine; focused persistence: 10/10; final-harness boot: 13/13; validator: 11/11 artifacts per engine.
- Final revision-focus reports: `output/playwright/r2-20-main-f025-chromium/report.json`, `output/playwright/r2-20-main-f025-firefox/report.json`, `output/playwright/r2-20-main-f025-webkit/report.json`.
- R2.20 consolidated evidence: `output/audit-r2-20/verification.json`.

### Historical revision ingress and marker performance

- Verification: `R2_ITEM6_VERIFICATION.md`.
- Final suite scenarios: `R2.18.REVISION_RECOVERY` and `R2.19.CHANGE_MARKERS`.
- The two deliberately deferred item-6 problems are now fixed; they are not remaining gaps.

## 5. Logo package

Three distinct, theme-aware SVG directions and rendered comparisons are under `output/logo/`:

- `output/logo/direction-1-signal-path.svg` — recommended and installed; a process route resolving into a signal.
- `output/logo/direction-2-beacon-grid.svg` — structured grid becoming a beacon; distinctive but megaphone-like at 24 px.
- `output/logo/direction-3-process-lens.svg` — compact process/lens form; weaker signal association.
- `output/logo/logo-comparison.png` — rendered light/dark comparison at 24/32/64 px.
- `output/logo/in-app-dark.png` and `output/logo/in-app-paper.png` — actual application lockups rendered and inspected.

`LOGO_DIRECTIONS.md` records the comparison and recommendation. The existing house/project typography, divider and version hierarchy were preserved.

## 6. Protected-surface handoff

Present, Map, deck/card editor, presenter/audience windows and `AMBIENT_SCENES` remained parallel-engineer territory. No fix was made there.

- **High — missing Present arrowheads.** Search `function presentationSvgForDiagram(diagram)` and `el.presentStage.innerHTML = svgString`. With `flowchart LR\n A[Origin] -->|CENTRE EDGE LABEL| B[Target]`, the editor arrow is visible but Present loses it because duplicate Mermaid marker ids resolve to the editor SVG. Evidence: `output/playwright/agent-present/editor-arrowhead-reference.png` and `output/playwright/agent-present/present-arrowhead-missing.png`.
- **High — Present route badge covers an edge label.** Search `function mapRenderThread()`. Building the presentation for the same edge puts the route dot over `CENTRE EDGE LABEL`; measured intersection is 61.15×26.26 CSS px (1,605.8 px²). Evidence: `output/playwright/agent-present/map-step-badge-edge-label-overlap.png`.

Speaker notes, presentation snapshots, Map route exports, deck/card exports and Observatory/Wasteland presets were excluded, not silently counted as passes.

## 7. Honest remaining limits

- No real Narrator or NVDA read-through was completed. Keyboard and browser accessibility-tree checks are strong evidence but a distinct layer.
- No hours-long heap-growth/observer soak was run.
- Native OS print-dialog completion and desktop Word/Excel interoperability were not automated in the final round. Generated artifacts and browser print/PDF paths were structurally and visually checked; PowerPoint interoperability was exercised earlier for the scoped deck.
- No macOS PowerPoint or LibreOffice Impress run was performed.
- Behavior above the bounded approximately 21 MB Merge/Direct fixture is not claimed.
- Protected Present/Map/deck/card/ambient paths remain the explicit handoff above.

## 8. Final acceptance

- Main/checkpoint SHA-256: `F025ACB5F18E7E81B296E931B6951A1A02110562F9D7B4CE1FDAED5F2928DF6C`.
- Main/checkpoint size: 3,591,449 bytes.
- `syncheck.py`: one script, 2,778,888 characters, `node --check exit 0`.
- `qa/run_regression_suite.js`: `node --check exit 0`.
- `output/regression-suite/full-final-f025/report.json`: 31/31 scenarios, 284/284 assertions, zero failed/skipped/fatal, exact pre/post hash.
- `output/regression-suite/full-final-f025/export-validation.json`: 26/26 artifacts, `passed: true`, no errors.
- Final R2.20 main reports: Chromium, Firefox and WebKit each 10/10 with zero application page/console errors and unchanged F025.

`PROGRESS.md` contains the short completion note for every requested deliverable. The two review ledgers remain the canonical finding-level audit trails.
