# SIREN round-two engineering review

Evidence cut: 2026-08-20. This review records only defects that were independently reproduced through the real single-file application or confirmed by a concrete source path and then exercised through the real UI. Speculative concerns are excluded.

The final applied application is `SIREN_v1.35.0_for_codex.html`, SHA-256 `F025ACB5F18E7E81B296E931B6951A1A02110562F9D7B4CE1FDAED5F2928DF6C`. It includes R2.01–R2.20 and is syntax-clean. R2.14–R2.17 (item 4) and R2.18–R2.19 (item 6) completed applied-main UI gates before R2.20. A final cross-browser recovery check then reproduced a WebKit-only focus-return defect and R2.20 fixed it; Chromium, Firefox, and WebKit each passed the focused final-main contract on the exact F025 hash.

Severity is based on the worst credible result of the confirmed path: Critical for silent wrong-file overwrite; High for persistent silent loss/corruption or an unusable export; Medium for deterministic functional, keyboard, accessibility, or max-document performance failure; Low for a bounded quality/offline-contract defect without data loss.

## Ranked findings

| Rank | Severity | Finding | Round-two disposition |
| ---: | --- | --- | --- |
| 1 | Critical | Cancelled or malformed direct Open armed the wrong Ctrl+S target | Fixed by R2.02; applied-main UI pass |
| 2 | High | Raw archived-revision restore silently cut historical evidence | Fixed by R2.18; applied-main recovery/export/undo gate pass |
| 3 | High | Portable-project workpapers were shortened during import without an honest decision boundary | Fixed by R2.05; applied-main UI pass |
| 4 | High | Native Docs JSON silently dropped review/comment/timestamp metadata | Fixed by R2.04; applied-main UI pass |
| 5 | High | Non-UTF text was accepted with U+FFFD and persisted/presented as valid | Fixed by R2.09/R2.09b; applied-main UI pass |
| 6 | High | XML-forbidden controls produced a malformed scoped Docs workbook | Fixed by R2.03; applied-main export gate pass |
| 7 | High | Over-cap Knowledge drops partially imported 80 of 81 files and reported success | Fixed by R2.07; applied-main UI pass |
| 8 | High | Pressing Tab from BODY could mutate the selected Mermaid diagram | Fixed by R2.13; applied-main 375 px UI pass |
| 9 | Medium | Malformed null/array diagram records crossed the project validation boundary | Fixed by R2.06; applied-main UI pass |
| 10 | Medium | A malformed `.json` document fell through to Markdown and imported as prose | Fixed by R2.08; applied-main UI pass |
| 11 | Medium | Docs popovers and palette lacked a complete repeatable keyboard lifecycle | Fixed by R2.16; applied-main keyboard lifecycle pass |
| 12 | Medium | Docs subtree rebuilds lost focus and hover-only block actions were not tabbable | Fixed by R2.17; applied-main keyboard/focus pass |
| 13 | Medium | Core Docs controls/regions exposed incomplete accessible names and disclosure state | Fixed by R2.14; applied-main AX/state pass |
| 14 | Medium | Docs block editors and repeated controls lacked meaningful roles/names | Fixed by R2.15; applied-main AX/keyboard pass |
| 15 | Medium | Max-size Docs change markers performed nested linear scans | Fixed by R2.19; applied-main semantic/performance gate pass |
| 16 | Medium | WebKit dropped focus after Cancel/Escape in bounded revision recovery | Fixed by R2.20; final-main three-browser pass |
| 17 | Medium | The 375 px Docs surface widened the whole document by 177 px | Fixed by R2.11; applied-main 375 px UI pass |
| 18 | Medium | Underlying mobile navigation remained focusable while Docs covered it | Fixed by R2.12; applied-main 375 px UI pass |
| 19 | Medium | Comments, Review, and Compare were clipped/off-screen at 375 px | Fixed by R2.10; applied-main 375 px UI pass |
| 20 | Medium | First Escape from a Docs editor made the documented second Escape unreachable | Fixed by R2.13; applied-main 375 px UI pass |
| 21 | Low | Default offline boot requested an absent optional `mermaid.min.js` and logged a local 404 | Fixed by R2.01; applied-main boot pass |

## Detailed findings and evidence

### 1. Critical — direct Open retargeted Ctrl+S before validation or consent

- Searchable anchor: `projectFileHandle = handle;` in the direct-disk Open branch, beside `validatePortableProject(JSON.parse(text))` and the `Open portable Siren project?` confirmation.
- Concrete failure: first establish a legitimate save handle, then choose another valid `.siren` file through Ctrl+K → Open project from disk and cancel the confirmation. In the old order, the newly selected handle replaced the prior one before Cancel. A malformed/truncated selection did the same before JSON parsing failed. The next Ctrl+S could therefore overwrite the cancelled or malformed source file with the current workspace while the user believed the prior target was still active.
- Fix/status: `patches/R2_02_arm_disk_handle_after_confirm.py` moves the assignment and disk indicator into the accepted confirmation action, after parsing and project validation. Applied to main.
- UI evidence: `output/regression-suite/target-r2-02-28ed/report.json`, scenario `R2.02.DIRECT_DISK`, passed all nine behavior assertions: a prior handle survived cancelled-valid and malformed selections, rejected handles received zero writes, and only an accepted valid Open became the new Ctrl+S target. Page/console errors were empty and the HTML hash was unchanged. The same boundary remained green in `output/playwright/r2-import-matrix-final/matrix.json`.

### 2. High — archived-revision restore could silently discard exact evidence

- Searchable anchors: `revisions: (Array.isArray(doc.revisions) ? doc.revisions.slice(0, 6) : [])` and the Restore branch that assigned `doc.blocks = (revision.blocks || []).map(sanitizeWorkpaperBlock)`.
- Concrete failure: import a native document or project carrying an archived revision whose rich-text block is 200,048 characters and contains a tail sentinel. Native Docs import reported success but exposed no imported revision; a project reached replace confirmation despite the over-limit snapshot. For a legacy raw snapshot already in browser state, Changes → Restore presented the ordinary confirmation and then applied the normal caps without reporting the cut, losing the tail. The old state pass also shortened an over-limit revision author before the raw evidence could be exported.
- Fix/status: `patches/R2_18_bound_revision_ingress_and_restore.py` separates raw legacy evidence from bounded candidates. New native/project ingress rejects an over-limit revision atomically. Legacy restore offers Cancel, Export exact original, or Restore bounded copy with exact arrived/kept counts; raw blocks and author remain recoverable, and the source revision stays in Changes. Applied to main. R2.20 subsequently made recovery-dialog focus return explicit across browser engines without changing the R2.18 data boundary.
- UI evidence: baseline `output/playwright/r2-18-baseline/report.json`; repaired standalone `output/playwright/r2-18-patched-r5/report.json` passed 17/17. On applied main SHA `3C1DC461…F7CA3`, `output/regression-suite/final-r2-18-19-3c1d-r2/report.json` passed the 12 R2.18 assertions plus R2.19 and hash/read-only gates, 22/22 total. It checked raw block/author tails in the downloaded JSON and persisted Changes state, bounded content, Cancel non-mutation, Undo/Redo, and post-restore focus. The rendered decision and restored states were inspected. Final F025 focus evidence is recorded separately in finding 16.

### 3. High — project workpaper content was shortened behind a generic import confirmation

- Searchable anchors: `function validatePortableProject(payload)`, `function portableProjectWorkpaperLimitMessage(workpapers)`, and `sanitizeWorkpapers(detached, report)`.
- Concrete failure: import or merge a portable project containing a workpaper prompt of 200,028 characters. Before the guard, the project crossed validation and the ordinary replacement/merge flow could sanitise it to 200,000 characters after the user had only consented to opening/merging a project; the 28-character tail had no dedicated arrived/kept decision boundary.
- Fix/status: `patches/R2_05_reject_project_workpaper_cuts.py` sanitises only a detached candidate during preflight and rejects any reported cut before confirmation or state mutation. Applied to main.
- UI evidence: `output/playwright/r2-04-06-main/results.json` records Main, Merge, and Direct Open all rejecting before confirmation, with `200,028 characters arrived, 200,000 characters kept. Nothing was imported.`, unchanged state, and no errors. `output/playwright/r2-04-06-main/r2-05-project-cap.png` was rendered and inspected. Valid controls still reached their normal confirmation. The final import matrix repeated the boundary across all three doors; measured rejection medians were 26 ms Main, 22 ms Merge, and 45 ms Direct.

### 4. High — native Docs JSON lost review and provenance metadata

- Searchable anchor: `function importWorkpaperDocument(payload, fileName, sourceName, sourceChars)` and its `const clean = sanitizeWorkpapers([{ ...doc, ... }])` candidate.
- Concrete failure: export a native Docs JSON document with an Approved review state, one comment, a review-trail detail, owner, and explicit `createdAt`/`updatedAt`, then import it through Docs. The old candidate rebuilt only the basic document and blocks; comments, structured review/trail, and timestamps were not carried into the imported document, while the import itself succeeded.
- Fix/status: `patches/R2_04_roundtrip_native_document_metadata.py` passes the safe native metadata through `sanitizeWorkpapers`, assigns the complete clean document, and preserves a supplied `updatedAt`. Archived revisions were deliberately excluded here and handled separately by R2.18. Applied to main.
- UI evidence: `output/playwright/r2-04-06-main/results.json` and inspected `output/playwright/r2-04-06-main/r2-04-native-roundtrip.png` show one comment, Approved state, the review-trail sentinel, original timestamps, owner/status, and the same values in the re-export. The 40-fixture final matrix repeated this path with no page errors.

### 5. High — permissive decoding converted input bytes to replacement characters

- Searchable anchors: `async function readWorkpaperImportText(file)` and the Register `el.registerImport.addEventListener('change', async () => {` boundary.
- Concrete failure: import CP1252 bytes containing smart quotes through Docs, or drop a valid UTF-8 file followed by a CP1252 file into Knowledge. Before the fix, Docs persisted `�QUOTE_SENTINEL�`; Knowledge persisted `�DROP_CP1252_SENTINEL�` and reported success. Register used its own permissive text reader and could present replacement-character content as checked data.
- Fix/status: `patches/R2_09_lossless_text_decoding.py` uses fatal UTF-8 or BOM-marked UTF-16LE/BE and decodes the whole Knowledge batch before mutation. `patches/R2_09b_strict_register_text_decoding.py` applies the same fail-closed boundary to Register. Applied to main.
- UI evidence: before/after evidence is `output/playwright/r2-import-remaining-baseline/result.json` and `output/playwright/r2-import-remaining-final-v2/result.json`; the latter passed eight cases with no page/console errors. `output/playwright/r2-09b-register/result.json` covers UTF-8, UTF-8 BOM, UTF-16LE, UTF-16BE, and CP1252. The final 40-fixture matrix confirmed supported encodings exactly, CP1252 rejection before mutation/coverage, and no persisted U+FFFD.

### 6. High — scoped Docs XLSX could contain invalid XML

- Searchable anchors: `function xlsxInlineCell(columnIndex, rowNumber, value, styleId = 0)` and `function workpaperExportSafeText(value)`.
- Concrete failure: put U+0001 in document content and run the scoped Docs Excel export. The original inline cell escaped XML metacharacters but emitted the XML 1.0-forbidden control unchanged. `xl/worksheets/sheet2.xml` was not well formed at line 1, column 914, so the workbook was structurally invalid even though the download completed.
- Fix/status: `patches/R2_03_sanitize_xlsx_xml_cells.py` centralises the human-export boundary and represents forbidden controls explicitly, for example `[U+0001]`, across XLSX and other human-readable Docs outputs. Applied to main.
- UI evidence: `output/regression-suite/target-export-docs/report.json` is the independent failing export/validator run. `output/regression-suite/full-73b5/report.json` then passed 199/199 suite assertions and 26/26 artifacts; scoped XLSX was well formed and contained both the content sentinel and `[U+0001]`. The readable PDF-view rendering was inspected at `output/playwright/r2-03-scoped-export-readable-pass/scoped-pdf-control-character.png`.

### 7. High — Knowledge capacity was checked after partial mutation

- Searchable anchor: `const files = Array.from(event.dataTransfer.files || []);` in the Knowledge-row drop handler.
- Concrete failure: with one empty Knowledge row and capacity for 80 sources, drop 81 files. The baseline retained `drop-00.txt` through `drop-79.txt`, silently omitted `drop-80.txt`, and showed a green `80 sources added.` result. The batch was not atomic and the success message did not say that one requested file was absent.
- Fix/status: `patches/R2_07_knowledge_drop_capacity.py` calculates capacity before creating or changing any row and rejects the whole over-cap batch with total/available counts and `Nothing was added.` Applied to main.
- UI evidence: baseline and repaired results are in `output/playwright/r2-import-remaining-baseline/result.json` and `output/playwright/r2-import-remaining-final-v2/result.json`. The exact 80-file boundary still produced 80 rows including `exact-79.txt`; 81 left the original row unchanged. The applied-main matrix repeated both boundaries.

### 8. High — ordinary BODY Tab input mutated the diagram

- Searchable anchors: `function handleCanvasCreationKeys(event)` and `document.addEventListener('keydown', handleCanvasCreationKeys)`.
- Concrete failure: select a Mermaid node, let focus fall to `BODY`, and press Tab to resume normal keyboard navigation. Because a prior node selection remained live and the handler only excluded known controls, the Tab keystroke created a child block and changed Mermaid source even though the canvas did not own focus.
- Fix/status: `patches/R2_13_keep_keyboard_actions_in_context.py` requires the event target to be inside `#zoomViewport`; the intentional canvas shortcut remains live when that viewport owns focus. Applied to main.
- UI evidence: baseline `output/playwright/r2-item3-final2-baseline-408694/report.json` recorded source mutation; the patched-copy and applied-main runs left Mermaid byte-identical from BODY while confirming the canvas shortcut still worked. Final main evidence is `output/playwright/r2-item3-main-11f1/report.json` (14/14) and `output/regression-suite/r2-item3-main-11f1/report.json` (23/23 including hash gates).

### 9. Medium — malformed diagram records passed shallow project validation

- Searchable anchors: `function validatePortableProject(payload)` and `const incoming = incomingState?.diagrams` in `mergeProjectPayload`.
- Concrete failure: supply a portable project whose non-empty `state.diagrams` array contains `null` (or another non-object record). The old test verified only that the array existed and was non-empty, so the malformed project reached the replacement/merge decision path instead of being rejected atomically; failure was deferred to later code that assumes diagram objects.
- Fix/status: `patches/R2_06_reject_null_diagram_records.py` requires every record to be a non-null, non-array object in replacement and merge paths. Applied to main.
- UI evidence: `output/playwright/r2-04-06-main/results.json` records Main, Merge, and Direct Open rejecting before confirmation or mutation with the explicit malformed-record message, while valid fixtures still reached their expected confirmations. `output/playwright/r2-04-06-main/r2-06-null-diagrams.png` and `output/playwright/r2-04-06-main/valid-project-controls.png` were inspected. The final matrix repeated Main and Merge safe rejection with zero page errors.

### 10. Medium — malformed `.json` was reclassified as Markdown

- Searchable anchor: `async function handleWorkpaperImportFile(file)` and `const expectsJson = /\.json$/i.test(file.name);`.
- Concrete failure: import `doc-json-missing-opener.json`, a truncated/malformed JSON file whose content does not start with `{`. The old heuristic skipped JSON parsing and called the Markdown importer. Baseline result: a new raw-prose document plus a green import-success toast, rather than a no-mutation JSON error.
- Fix/status: `patches/R2_08_strict_json_document_import.py` makes the `.json` extension authoritative and fail-closed, while retaining Markdown fallback for plain `.txt`. Applied to main.
- UI evidence: baseline and patched evidence is in `output/playwright/r2-import-remaining-baseline/result.json` and `output/playwright/r2-import-remaining-final-v2/result.json`. The malformed `.json` left document count unchanged; a `.txt` control still imported `PLAIN_TEXT_FALLBACK_SENTINEL` as two blocks.

### 11. Medium — Docs menus/palette lacked a deterministic keyboard lifecycle

- Searchable anchors: `function openStructureMenu(anchor, items, current, onPick, config = null)`, `function closeWorkpaperFind(refocus = false)`, and the `#wpTextColourButton` palette handler.
- Concrete failure: open the Docs document/add-block/contents menu or colour palette with Enter, then use Arrow/Home/End, Escape, Tab/Shift+Tab, and reopen it. The pre-patch popovers did not consistently move focus into the popup, expose selected/disabled state, close with focus returned to their invoker, or remain usable on consecutive invocations; Find also returned focus generically rather than to the actual invoker.
- Fix/status: `patches/R2_16_docs_keyboard_popovers.py` adds an opt-in Docs keyboard contract without changing non-Docs callers. Applied to main.
- UI evidence: the full keyboard driver is `qa/r2_item4_docs_keyboard_ax_ui.js`; focused lifecycle controls are `qa/r2_item4_popovers_panels_ui.js` and `qa/r2_item4_find_close_lifecycle_ui.js`. Applied-main item-4 acceptance at SHA `98A3B1C0…FB5223` exercised every listed lifecycle, and unified `R2.ITEM4.A11Y` repeated the discriminating contracts on `3C1DC461…F7CA3` with 10/10 scenario assertions (13/13 including hash/read-only gates). Evidence is in `qa/R2_ITEM4_VERIFICATION.md`, `output/playwright/r2-item4-docs-a11y/`, and `output/regression-suite/final-r2-item4-3c1d-chromium/report.json`.

### 12. Medium — Docs rerenders discarded focus and hid block actions from Tab

- Searchable anchors: `function renderWorkpaperBlocks(doc)`, `.wp-block:hover .wp-block-tools, .wp-block:focus-within .wp-block-tools`, and the block insertion/checklist Enter focus branches.
- Concrete failure: keyboard-edit a Docs control whose mutation rebuilds the block/list/comments/changes subtree, or Tab through a block to reach Move/Delete/Comments. The rebuilt focused node disappeared and focus fell away from the logical control; the toolbar used `display:none` outside hover/focus-within, so its actions were absent from the Tab order. New block and checklist-row insertion could also focus the wrong rebuilt row.
- Fix/status: `patches/R2_17_docs_rerender_focus_and_block_actions.py` captures a stable logical focus key before seven rebuild paths, restores the connected counterpart, keeps actions in the Tab order while visually hidden, and scopes insertion/checklist focus. Applied to main.
- UI evidence: `qa/r2_item4_docs_keyboard_ax_ui.js` exercises block tools, mutations, duplicate, register switching, comments/changes, insertion and checklist Enter entirely by keyboard. Supporting probes are `qa/r2_item4_mutations_ui.js` and `qa/r2_item4_duplicate_idrefs_ui.js`. The applied-main item-4 drivers passed on `98A3B1C0…FB5223`; unified `R2.ITEM4.A11Y` then passed on `3C1DC461…F7CA3`. `candidate-core.png` and `candidate-mutations.png` under `output/playwright/r2-item4-docs-a11y/` were refreshed from applied main and inspected.

### 13. Medium — Docs surface names and panel state were incomplete

- Searchable anchors: `#wpDocMenuButton`, `#wpCommentsButton`, `#wpChangesButton`, `#wpReviewButton`, `#wpBlocks`, and `function syncWorkpaperPanelDisclosure()`.
- Concrete failure: navigate the Docs header and open Comments/Changes/Review with an accessibility tree consumer. The ellipsis/document actions, formatting controls, document/panel regions, and current review state were incompletely named; disclosure buttons did not consistently expose `aria-expanded`/`aria-controls` matching the visible panel, so equivalent controls could not be distinguished reliably from state alone.
- Fix/status: `patches/R2_14_docs_surface_accessible_names_states.py` names the surface, document content, panels, toolbar and actions; synchronises disclosure state; and exposes review state as a polite status. Applied to main.
- UI evidence: `qa/r2_item4_core_ax_ui.js` and `qa/r2_item4_docs_keyboard_ax_ui.js` captured the relevant accessibility snapshots and toggle states on applied main `98A3B1C0…FB5223`; unified `R2.ITEM4.A11Y` repeated the core contract on `3C1DC461…F7CA3`. Rendering is under `output/playwright/r2-item4-docs-a11y/`. This is browser accessibility-tree and keyboard evidence, not a claimed Narrator/NVDA read-through.

### 14. Medium — block editors and repeated controls had ambiguous semantics

- Searchable anchor: `function buildWorkpaperBlock(doc, block, index)`.
- Concrete failure: navigate a rich-text block, heading, empty table cell, checklist, prompt, settings row, Knowledge source, or test run with an accessibility tree consumer. Several editable regions exposed only generic contenteditable/input roles or repeated unlabeled controls, while visual headings did not carry their level. A user could reach a field but not reliably identify its block position, row, purpose, or action.
- Fix/status: `patches/R2_15_docs_block_editor_semantics.py` supplies block-position labels, heading roles/levels, multiline textbox semantics, and contextual names for repeated editors/actions without changing document data or rendering. Applied to main.
- UI evidence: `qa/r2_item4_docs_keyboard_ax_ui.js` captured pre/post snapshots across the complete default Agent-spec block set on applied main. The item-4 driver set passed at `98A3B1C0…FB5223`, and the unified exact-hash gate passed at `3C1DC461…F7CA3`; see `qa/R2_ITEM4_VERIFICATION.md` and `output/regression-suite/final-r2-item4-3c1d-chromium/report.json`.

### 15. Medium — max-document change markers used nested linear scans

- Searchable anchor: `function refreshWorkpaperChangeMarkers(doc)`; specifically `doc.blocks.find(...)` and `(doc.comments || []).some(...)` inside the rendered-block loop.
- Concrete failure: import and render 300 blocks with 200 open comments, edit one block, and let the deferred marker pass run. One baseline pass made exactly 45,150 block-array visits and 40,100 comment-array visits. Nine measured passes were 7.9 ms median / 9.8 ms p95 on the review workstation. The source shape grows quadratically at the supported block limit.
- Fix/status: `patches/R2_19_linearize_docs_change_markers.py` builds a first-match-preserving block `Map` and open-comment `Set` once per pass. Applied to main.
- UI evidence: `output/playwright/r2-19-baseline-r3/report.json` and `output/playwright/r2-19-patched-r3/report.json` both passed the semantic controls. The patched path made zero nested `find`/`some` visits and measured 1.4 ms median / 1.9 ms p95. A duplicate-ID fixture proved first-match parity before and after editing. Unified `R2.19.CHANGE_MARKERS` passed 7/7 on applied main `3C1DC461…F7CA3`; combined with R2.18 and meta gates, `output/regression-suite/final-r2-18-19-3c1d-r2/report.json` passed 22/22. `output/regression-suite/audit-r2-19-baseline-unified/report.json` remains the intentionally discriminating baseline: semantics pass and the zero-visit assertion fails with exactly 45,150/40,100.

### 16. Medium — WebKit lost the revision Restore invoker after Cancel/Escape

- Searchable anchors: `function openWorkpaperRevisionRecovery(doc, revision, prepared)`, `const dismiss = () => closeDialog(dialog);`, and the Changes-row `requestWorkpaperRevisionRestore(doc, revision)` call.
- Concrete failure: in WebKit 26.5, open Docs → Changes, invoke Restore on an oversized archived revision, then choose Cancel or press Escape. The live body correctly remained unchanged, but focus fell to the Docs/root surface instead of returning to the specific Restore button that opened the modal. Chromium and Firefox happened to restore it natively, so the cross-engine failure survived the earlier Chromium-focused UI review.
- Fix/status: `patches/R2_20_restore_revision_invoker_focus.py` threads the exact Changes-row button into bounded recovery and explicitly returns focus after Cancel/Escape. Successful bounded restore deliberately bypasses that return so the existing `restorePreparedWorkpaperRevision` path still focuses `#wpChangesButton`. Applied to final main.
- UI evidence: on exact final SHA `F025ACB5…28DF6C`, Chromium 151, Firefox 153, and WebKit 26.5 each passed 10/10 focused assertions: initial Cancel focus, exact-element return after both Cancel and Escape, no body mutation, bounded live content, raw-revision retention, `wpChangesButton` focus after restore, clean app telemetry, and unchanged pre/post hash. Reports are `output/playwright/r2-20-main-f025-chromium/report.json`, `output/playwright/r2-20-main-f025-firefox/report.json`, and `output/playwright/r2-20-main-f025-webkit/report.json`; all six dialog/restored screenshots were rendered and inspected. The anchor-guarded patch passed dry-run/syntax on the 3C1D base and its reapply guard stopped at count zero without changing the patched hash.

### 17. Medium — nested Docs grids widened the phone document

- Searchable anchor: the phone media-query rules around `.layout-hint` and the added `.wp-blocks, .wp-block { grid-template-columns: minmax(0, 1fr); }` containment rule.
- Concrete failure: at 375×812 open Docs with table, Knowledge, and Settings content. Baseline `#wpDoc` was 375 px client width but 552 px scroll width, so the entire document moved horizontally by 177 px instead of keeping dense table overflow local.
- Fix/status: `patches/R2_11_contain_mobile_docs_width.py` lets nested grids shrink and leaves the table wrapper as the local `overflow-x:auto` owner. Applied to main.
- UI evidence: applied-main `output/playwright/r2-item3-main-11f1/report.json` measured 375/375 at `#wpDoc`; the table wrapper stayed inside the viewport and local scrolling remained. `output/playwright/r2-item3-main-11f1/03-docs-mobile.png` was inspected.

### 18. Medium — covered mobile navigation leaked into the Docs Tab sequence

- Searchable anchor: `function setWorkpapersOpen(open)` and the list `['.app-header', '.diagram-workspace-bar', '.workspace', '.mobile-nav']`.
- Concrete failure: open full-screen Docs at 375×812 and Tab from its last control. Baseline `.mobile-nav.inert` was false and focus landed on `#mobileEditorTab`, a control visually hidden underneath the Docs overlay.
- Fix/status: `patches/R2_12_isolate_mobile_nav_under_docs.py` includes `.mobile-nav` in the same inert lifecycle as the other covered regions. Applied to main.
- UI evidence: the applied-main item-3 runs proved boundary Tab and direct scripted focus could not enter the mobile navigation while Docs was open, then confirmed focusability returned after close. Standalone 14/14 and unified 23/23 reports are under `output/playwright/r2-item3-main-11f1/` and `output/regression-suite/r2-item3-main-11f1/`.

### 19. Medium — phone review actions were outside the pointer viewport

- Searchable anchor: the 375 px `.preview-pane .pane-header` and `.preview-pane .pane-actions` rules.
- Concrete failure: at 375 px, Comments ended at x=380.3, Review occupied x=385.3..458.1, and Compare occupied x=463.1..546.2. Comments was clipped and Review/Compare were outside the pointer viewport; keyboard focus did not make the clipped toolbar usable.
- Fix/status: `patches/R2_10_keep_mobile_compare_visible.py` wraps the existing action row without reordering or restyling its controls. Applied to main.
- UI evidence: on main, Comments, Review, and Compare occupied x=11..108.9, 113.9..186.8, and 191.8..274.8. All three were physically clicked, reached in DOM Tab order, matched `:focus-visible`, and retained their full five-pixel focus-ring envelope. Evidence is in the item-3 standalone/unified reports and `r2-item3-narrow-review-actions.png`.

### 20. Medium — the second Docs Escape became unreachable

- Searchable anchor: the Docs Escape branch containing `event.target.closest('[contenteditable], input, textarea, select')`.
- Concrete failure: focus a Docs contenteditable, press Escape once to leave the editor, then Escape again to close Docs. Baseline first Escape blurred to BODY; the second no longer reached the Docs surface handler, so Docs remained open despite the two-stage behavior.
- Fix/status: the Docs half of `patches/R2_13_keep_keyboard_actions_in_context.py` returns focus to `#wpDoc` (or the empty-state create button) after the first Escape. Applied to main.
- UI evidence: main acceptance showed first Escape kept Docs open and focused `#wpDoc`; the second closed Docs and returned focus to `#workpapersButton`. The post-Escape rendering was inspected in `output/playwright/r2-item3-main-11f1/05-docs-after-escape.png`.

### 21. Low — a missing optional local Mermaid file dirtied every default boot

- Searchable anchor: `function mermaidSources()` and `LOCAL_MERMAID_SRC`.
- Concrete failure: serve the HTML normally without a sibling `mermaid.min.js` and block external CDN responses to model offline use. The source list still tried `/mermaid.min.js`; Chromium reported `404 (Not Found)` even though the basic renderer recovered. The original clean-offline boot contract therefore failed.
- Fix/status: `patches/R2_01_quiet_optional_mermaid.py` tries the sibling file only after explicit `?offline=1` or remembered prior success; otherwise the bundled basic renderer is the quiet fallback. Applied to main. A HEAD-preflight experiment was honestly rejected because a handled HEAD 404 still appeared in the console.
- UI evidence: `output/regression-suite/r2-01-boot-acceptance/report.json` failed only the console-error assertion with the local 404. `output/regression-suite/r2-01b-boot-acceptance/report.json` passed 13/13 with zero page/console errors and no successful external response. The final Chromium full gate retained that result.

## Honest non-reproductions and no-change decisions

### Export filename at 375 px — no defect reproduced

The reported filename truncation did not reproduce. `.export-name-row` measured 301/301 client/scroll px, the input ended at x=333, and the complete `t_industries_siren` value was visible. The patched and applied-main item-3 runs retained exactly the same passing geometry. No filename patch was created; R2.11 explicitly asserts that the export-name rule is unchanged.

### Firefox/WebKit broad item-5 matrix — no defect reproduced in those tested paths

No patch was invented from the original item-5 matrix. On the unchanged `11F1…C941D` main, Firefox 153 and WebKit 26.5 each passed 76/76 matrix assertions, 10/10 focused IndexedDB persistence assertions, 13/13 final-harness boot assertions, and 11/11 deep-validated export artifacts. Both retained UI-created diagram and Docs content after reload and completed the item-3 375 px contract. Reports are `output/regression-suite/item5-firefox-11f1-final/report.json` and `output/regression-suite/item5-webkit-11f1/report.json` plus `qa/R2_ITEM5_CROSS_BROWSER_REPORT.md`.

Firefox's two exact diagnostics were browser/runtime messages, not app failures: warnings for deliberately aborted Mermaid CDN requests and a browser-internal favicon CSP message from `resource:///modules/FaviconLoader.sys.mjs`. The classifier is Firefox-only and exact; application page errors, console errors, and console warnings remained empty. WebKit emitted neither warning. Firefox required an outside-sandbox launch because Windows denied its already-installed tab subprocess; no browser/runtime was downloaded or changed.

The later final R2.18 recovery scenario covered a modal focus path that this broad matrix did not. It reproduced one genuine WebKit-only focus-return defect, now finding 16 and fixed by R2.20. This does not retroactively turn the earlier item-5 paths into failures; it narrows the no-reproduction claim to the matrix that was actually exercised.

### Merge/direct Open global 20 MB cap — bounded result, no invented fix

The matrix did not establish a missing global-size-guard defect for Merge or Direct Open. A valid 20,971,984-byte fixture reached an honest confirmation in 826 ms and 809 ms respectively; each confirmation was cancelled and state did not change. Main Import separately rejected a 20,971,521-byte fixture at its documented 20 MB boundary. No behavior is claimed for larger Merge/Direct inputs and no guard was added on this evidence.

### Apparent 30.344-second over-cap delay — harness timeout, not app latency

The first project-cap driver waited 30 seconds for a workpaper textarea that correctly did not exist after rejection. A focused three-run-per-door probe measured rejection medians of 26 ms Main, 22 ms Merge, and 45 ms Direct, with no event-loop gap over 50 ms and no page errors. No performance patch was created for the false 30-second signal.

## Protected-surface handoffs

Present, Map, deck/card, presenter/audience, and ambient code remains parallel-engineer territory. Round two neither edited these paths nor silently counted their exports as covered.

- **High — Present arrowheads disappear with duplicate marker IDs.** Search `function presentationSvgForDiagram(diagram)` and `el.presentStage.innerHTML = svgString`. With `flowchart LR\n A[Origin] -->|CENTRE EDGE LABEL| B[Target]`, the editor arrowhead is visible and the Present arrowhead is absent because the duplicated marker reference resolves to the editor SVG. Evidence: `output/playwright/agent-present/editor-arrowhead-reference.png` and `output/playwright/agent-present/present-arrowhead-missing.png`. This is reported only; no round-two edit or fix proposal is made here.
- **High — Present route badge covers an edge label.** Search `function mapRenderThread()`. Building the presentation for the same labelled edge placed the route dot over `CENTRE EDGE LABEL`; measured intersection was 61.15×26.26 CSS px (1,605.8 px²). Evidence: `output/playwright/agent-present/map-step-badge-edge-label-overlap.png`. This is reported only; no round-two edit or fix proposal is made here.
- **Explicitly unexercised protected routes:** speaker notes, presentation snapshots, Map route exports, deck/card exports, and Observatory/Wasteland snapshots/presets. They are inventory exclusions, not passes or failures.

## Verification state and honest remaining limits

Applied-main evidence is complete:

- R2.01/R2.03 and the broad Chromium gate: SHA-256 `73B5B72794E6D965001649A4704AD41952F9B6582CDB4A9B20A895C45B587EF5`, 22/22 scenarios, 199/199 assertions, 26/26 validated artifacts, unchanged pre/post hash.
- R2.02–R2.09b import matrix: SHA-256 `D465384751C24346717A88768CAA60AFB755FE4824916263988C578BB4D6AFA1`, 40 deterministic fixtures totalling 43,222,250 bytes, 47 original path cases plus three Register controls and nine timing repetitions, no page errors, unchanged pre/post hash.
- R2.10–R2.13 phone/editor fixes: SHA-256 `11F1CC853B457601A3DA54209F6F55910F7D3F58B6BA6CA21BD3B403265C941D`, standalone 14/14 and unified 23/23, inspected screenshots, unchanged pre/post hash.
- R2.14–R2.17 item-4 acceptance: applied-main SHA `98A3B1C0A44529090EEC8F9C5F4B302702FC6CD3945CDCB0AC98333F66FB5223`; all focused keyboard, focus-restoration, duplicate-ID, disclosure and accessibility-tree drivers passed. Unified `R2.ITEM4.A11Y` repeated 10/10 contracts on `3C1DC461…F7CA3` (13/13 including hash/read-only gates). Syntax and every reapply guard passed their declared mechanical checks.
- R2.18–R2.19 item-6 acceptance: applied-main SHA `3C1DC46105066053452E01CD20C0053C8A6EE55D9C956C9ECF819AB0491F7CA3`; combined Chromium report passed 22/22 with unchanged pre/post hash. Firefox passed the combined item-4/item-6 selection 32/32. WebKit passed 31/32 and isolated one focus-return failure while all data/export/undo/marker contracts remained green; that exact failure became R2.20 rather than being relabelled a warning.
- R2.20 final focus acceptance: exact final SHA `F025ACB5F18E7E81B296E931B6951A1A02110562F9D7B4CE1FDAED5F2928DF6C`; Chromium, Firefox, and WebKit each passed 10/10 with zero app page/console errors, zero successful external responses, and unchanged pre/post hash. The patch was exact-count guarded, atomic, syntax-clean, and protected-scope-free.
- Final all-scenario Chromium gate: `output/regression-suite/full-final-f025/report.json` passed 31/31 scenarios and 284/284 assertions with zero failures or skips, 26/26 export-validator results, and exact F025 pre/post identity.

The honest remaining limits are human/tool boundaries, not unresolved round-two application failures. No real Narrator or NVDA session was run; the accessibility evidence is keyboard behavior plus browser accessibility trees, roles, names and states. Native OS print dialogs and desktop Word/PowerPoint/Excel were not automated, although the generated artifacts and browser-rendered print/PDF paths were structurally and visually checked. Protected Present/Map/deck/card/ambient routes remain the explicit handoffs above.
