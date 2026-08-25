# SIREN Round 8 handback

## Outcome

All five application jobs are complete in the required order against the exact shipped v1.68.0 base. A clean replay of `AI → AJ → AK → AL → AM` produced bytes identical to the tested artefact.

- Base: 8,552,615 bytes, `F93B2CD12E05297907D01D965D21C39683048C344FB830797849662AB3886A56`
- Final: 8,557,663 bytes, `B3714C1748274D6C13C1149162D62193FE488ADCE6492AC183BCD82354A99DBB`
- `APP_VERSION`, `CHANGELOG`, and CSP are byte-exact against the base. Their extracted SHA-256 values are respectively `D2C49327…7596`, `88515105…3341`, and `E160CE6A…8E1F` on both files.
- Official syntax gate: 2 script blocks, 7,556,545 characters, `node --check` exit 0.
- The canonical order, every script hash, every input/output hash, byte sizes, and replay command are in `round8_patches/APPLY_ORDER.md`.

No release file outside this workspace and no Downloads copy was touched.

## AI — slash typing preserves the paragraph

The slash add-block affordance now distinguishes a block pick from ordinary typing without changing the global 35-caller structure-menu engine. The first non-modified printable character after `/` closes only the Docs add-block menu, restores it to the marker paragraph, and resumes physical typing at its end.

Measured through the real editor and persistence layer:

- `/2026 field work` remains exact in `.wp-text`, in IndexedDB, and after reload;
- `/mnt/data/evidence.pdf` remains exact;
- block count and block ids remain stable while typing;
- a bare `/` still opens the five-row Add block menu, and selecting a row consumes only the marker paragraph without touching its neighbour.

Space, Enter, and arrow-key menu operation remain the original bare-slash feature; the patch does not reinterpret those keys as text.

## AJ — Undo respects title ownership

Diagram records now carry a persisted, sanitised, snapshotted `diagramTitleTouched` ownership flag. Title input creates its own undo boundary before a later source/type edit, so one Undo reverts the source operation and leaves the person's title intact. Default title synchronisation stops as soon as the title is person-owned.

Legacy migration is conservative: only the known generated `<family> Preview` values are inferred as untouched; every other legacy non-empty title is preserved as person-owned. Newly named or duplicated diagrams are also person-owned.

The suite physically typed a custom title, changed source/type, pressed Undo once, and retained the custom title on all title surfaces. It also covered the sideways case where the person deliberately types the exact default-looking text `Flowchart Preview`; ownership, not string comparison, keeps that value intact.

## AK — short-window Docs block menu is complete

The global `.struct-menu` cap remains exactly `min(72vh, 560px)`. Only the Docs block-action menu opts into a viewport-fit cap (`100vh - 16px`) when opened through its context route. Genuine overflow is exposed with a visible thin scrollbar plus an `aria-description`; menus that fit are not announced as scrollable.

At 1100×620 the full 15-row menu, including `Delete block`, is visible and pointer-hittable. Global blast-radius checks covered Theme, View, Inspect, and Present menus at 1100×620 and 1440×900; all remained inside the viewport with their existing cap and placement.

Rendered evidence was inspected, including `ak-1100x620.png` and the four global-menu screenshots in `round8_work/final_targeted_v3/`.

## AL — Docs submenus follow the physical click

The physical right-click point now travels only through the context dispatcher into the Docs page menu. `Add a block…`, `Contents…`, and `Document type…` reuse that point for their second-level menu. Keyboard invocation still uses the originating element, preserving the non-pointer route.

All three rows were exercised at x=360, 720, 1152, and 1360. The second menu stayed adjacent to the requested point after viewport clamping in all 24 placement assertions. The inspected `al-submenu.png` shows Document type beside the right-click position rather than near the document's left edge.

## AM — complete YAML frontmatter no longer hides the Mermaid family

A shared declaration scanner now recognises complete leading YAML frontmatter and blanks its lines rather than deleting them. This preserves source line numbers for Guided edits. Truncated frontmatter fails closed and is not silently stripped.

The same scanner is used by all six copied declaration consumers: diagram type detection, structure rows, flowchart gating, native summary, Guided guidance, and Office export type. Flowchart frontmatter retains its row/count/guidance behaviour; sideways fixtures with comments and truncated YAML were also exercised.

The embedded Mermaid 11.16.1 support audit rendered valid frontmatter fixtures for Sankey, Radar, Quadrant, and C4Container with their own expected labels. SIREN currently reports those four as `Advanced Mermaid`; see the deliberate limitation below.

## Verification

### Targeted Round 8 suite

`qa_round8/run_round8_targeted.js` drives the real final HTML over localhost, uses physical keyboard and pointer input, reads IndexedDB, reloads the app, exercises sideways fixtures, and takes screenshots after the intro overlay clears.

- Base positive control: 6 scenarios, 24/51 assertions; all five disclosed jobs reproduced, 27 red.
- Final: 8/8 scenarios, 75/75 assertions, 0 page exceptions.
- Final report: `round8_work/final_targeted_v3/report.json`
- Final report SHA-256: `E5BBE30099A6FA0701AF6ACD8A7795C2D8CB7F0D640BEE4167CF5312B076DEFB`

Rendered evidence inspected:

- `ak-1100x620.png`: complete Docs block menu and visible Delete action.
- `ak-theme-1100x620.png`, `ak-view-1100x620.png`, `ak-inspect-1100x620.png`, `ak-present-1100x620.png`: unaffected global menus.
- `al-submenu.png`: second-level Document type menu at the click.

### Patch-chain and guards

- A fresh base replay ended at the exact final SHA and byte size above.
- All five scripts and the targeted runner pass `node --check`.
- A deliberate wrong-SHA application exited 1 before writing; before/after SHA remained `B3714C17…9DBB`.
- Every replacement is exact-count guarded before transformation and each write uses a same-directory temporary file followed by rename.

### Job A gate

Job AL necessarily changes the suite's unique mutation anchor from `buildDocsContextMenu(target)` to `buildDocsContextMenu(target, point)`. The companion test-only adjustment in `qa_round3/surface_suite_additions.js` re-points that one anchor. Its isolated recheck is 3/3 scenarios and 11/11 assertions.

The complete recalibrated gate then ran against final SHA `B3714C17…9DBB` and left the application byte-identical:

- raw: 42/48 scenarios, 419/432 assertions;
- fatal: false;
- 15 exported files passed structural validation;
- report: `round8_work/job_a_gate_final/report.json`;
- report SHA-256: `8464334CD5C764EAF4F20A7346157057F56D61C3C0B678C376F0312632996A0B`.

All 13 remaining red assertions reproduce on the unmodified frozen base in the bounded comparison (`round8_work/job_a_base_failures/report.json`):

- six `R2.ITEM3.NARROW` assertions directly probe hidden desktop Comments/Review buttons at 375px instead of the grouped mobile route;
- `EXPORT.MAIN` directly clicks hidden `#styleShortcutButton`, and `R3.SURFACE.MINIMAP` directly clicks hidden `#zoomMenuButton`; both controls were grouped before Round 8 and the method explicitly records that state;
- three `R3.SURFACE.CENSUS` assertions retain pre-grouping counts (base measures header 5, preview head 0, desktop preview toolbar 7, mobile preview toolbar 8);
- Word and PowerPoint COM inspection fail in this managed Windows logon with `0x80070520`. Their DOCX/PPTX packages still pass XML, relationship, bounds, editable-shape, and deep export validation. I did not claim an interactive Office rerun.

These are owner/suite drift or environment, not changes introduced by AI–AM. The one Round 8-specific mutation-anchor failure was fixed and is green in the final report.

## Anchor audit

No brief anchor drifted on the exact frozen base, and no guard was loosened. Every application anchor used by the final scripts occurred exactly once.

- AI: the `.wp-text` slash handler, `openWorkpaperAddMenu` signature, and its unique menu-options tail.
- AJ: default diagram record, title input listener, `diagramTypeLabel` tail, diagram sanitiser, new/duplicate constructors, `handleSourceInput`, default-title synchroniser, undo declarations/commit, `applySource`, snapshot capture, and snapshot restore.
- AK: global menu CSS cap/padding and menu-item boundary, menu creation/append blocks, `openContextMenu` signature/options, pointer and keyboard callers, and Docs block menu return.
- AL: physical context dispatcher, `buildContextMenu`, Docs dispatcher, `buildDocsContextMenu`, Docs page router/builder, Contents and Type menu signatures/options, and Add menu options.
- AM: `detectMermaidDiagramType` preamble/cleaner, `parseStructureRows`, `structureIsFlowchart`, `structureNativeSummary`, `updateStructureGuidance`, and Office export declaration scan.

One AM script draft initially encoded a JavaScript regex anchor without `String.raw`. Its postcondition stopped execution before any HTML write; the authoring literal was corrected and the pinned patch then replayed cleanly. This was a script-escaping correction, not application anchor drift.

## Deliberately not done or claimed

- I did not add first-class SIREN types for Sankey, Radar, Quadrant, or C4Container. Embedded Mermaid renders them, but the current product has no honest labels/routes for those exact families; mapping C4Container to the existing `C4 context` label would itself over-promise.
- I did not change the global structure-menu focus/key engine, its 72vh cap, or its 35 callers to solve AI or AK.
- I did not change Space-after-slash semantics; it remains a menu-selection key.
- I did not change the Style card, visual-builder panel, canvas type gating, Present, Map, deck behaviour, ambient scenes, APP_VERSION, CHANGELOG, or CSP.
- I did not repair the inherited grouped-preview expectations in the full Job A suite beyond the single AL mutation anchor that this round necessarily moved.
- I did not claim Word or PowerPoint COM validation in an interactive desktop session; only the managed-session failure and successful structural validation are reported.
