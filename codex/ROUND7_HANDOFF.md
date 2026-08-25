# SIREN Round 7 handback

## Outcome

Four application patches are complete in the required order, against the exact v1.67.0 frozen base. A fresh replay of `AE → AF → AG → AH` produced bytes identical to the verified final artefact.

- Base: 8,528,590 bytes, `DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`
- Final: 8,535,830 bytes, `8837F47624FD2E2F1006D91180662A9E1425200AB0DA66FFED1A322096700FEE`
- `APP_VERSION`, `CHANGELOG`, and the CSP are byte-exact against the base.
- The two inline scripts parse successfully: 2 blocks, 7,539,716 characters in the independent Node parser; the official Job A syntax check also exits 0.

The canonical order and every script/input/output hash are in `round7_patches/APPLY_ORDER.md`. No merged HTML is part of the handback.

## AE — truthful Guided counts and guidance

The flowchart-only count is replaced by a type-aware summary. The reference fixtures now read:

- flowchart: `3 blocks · 3 connections`
- graph: `3 blocks · 2 connections`
- sequence: `2 participants · 2 messages`
- gantt: `2 tasks · 1 dependency`
- mindmap: `4 nodes · 3 links`
- block: `6 blocks`
- kanban: `2 columns · 2 cards`

Families without an honest native summary show no count instead of `0 blocks · 0 connections`. The Guided tooltip and hint now describe line-level operations on code-first types and retain block/shape/connector language only for flowchart syntax. Row construction was not changed: `#structureRows .struct-code` remains equal to source-line count on all nineteen fixtures.

## AF — starter type persists

The central Mermaid-family detector now recognises every explicit starter declaration. The nine requested values remain selected and leave `New starter` enabled at both 300 ms and 2,200 ms after confirmation: block, architecture, c4, xy, requirement, mindmap, timeline, kanban, and ishikawa.

I chose detection rather than a transient picker override because the detected family feeds the type chip, starter controls, render/error copy, and context menus. Swimlane and Ishikawa use ordinary flowchart syntax, so only the exact sources created by SIREN's own starters retain those two specialised identities; arbitrary flowcharts are not guessed from appearance.

## AG — type-aware untouched titles

The normal source synchronisation paths now replace generated default titles with `<family> Preview` on all three surfaces and in the active diagram record. This covers typed/pasted source, starter/template replacement, and legacy state loaded with the old `Flowchart Preview` sentinel. `Flowchart Preview` remains correct for flowchart and graph aliases.

A physically edited title is preserved: after entering `Client title` through the expanded Style surface and changing to Pie, `#diagramTitle`, `#diagramTitlePreview`, and `#previewHeading` all remain `Client title`.

The downstream `diagramOfficeExportTitle(type)` mitigation was not extended or used as the fix.

## AH — truthful code-only chip and family headings

The one-time code-only chip names branch colours only for Git graph, the only family whose right-click menu contains a colour action. The other seven measured families promise only fit, size, and export. The click half of the sentence was deliberately left untouched.

The four wrong menu headings are corrected through AF's shared detector: XY chart, Pie chart, C4 context, and Timeline now name the rendered family instead of `Advanced Mermaid`. Real right-clicks were used; `.struct-menu-heading` and visible action rows were asserted.

## Verification

### Targeted Round 7 suite

`qa_round7/run_round7_targeted.js` drives the real final application over localhost, uses the actual confirmation dialog, physically opens Code/Guided and Style, and opens code-only menus with a real right mouse click.

- 4/4 scenarios
- 210/210 assertions
- 0 page exceptions
- report: `round7_work/targeted_final_accepted/report.json`
- report SHA-256: `17459BAC6E0BA46176C4D4FBA92AC5FE36FE35F4BD9F24AB4910568677D7E038`

Rendered evidence inspected:

- `ae-ag-mindmap-guided.png`: Mindmap title, 4-node/3-link count, five Guided rows and type-truthful hint are visible together.
- `ag-custom-title.png`: Pie renders under `Client title`, with the same text still in the Style field.
- `af-ishikawa-picker.png`: Ishikawa remains selected after creation and `New starter` is enabled.
- `ah-c4-context-menu.png`: chip omits colours; the menu heading reads C4 context and has no colour action.

### Job A gate

The complete gate ran against final SHA `8837F476…0FEE` and left the application SHA unchanged.

Raw managed-session report:

- 45/48 scenarios
- 466/470 assertions
- fatal: false
- 31 exports structurally validated
- report: `round7_work/job_a_gate_final/report.json`
- report SHA-256: `3AB800226F1D597E92D6D93901D095AD8F3C0F9D4090BF464CE802995F9359FA`

Two failed scenarios were environmental Office COM failures (`0x80070520`) in the isolated Windows logon session. The exact DOCX and PPTX scenarios were rerun in the interactive Windows session and passed 5/5 scenarios, 37/37 assertions; Word opened the DOCX without repair at CompatibilityMode 15, PowerPoint opened all 11 slides without repair, and both files remained hash-identical after inspection.

- interactive report: `round7_work/job_a_office_interactive/report.json`
- report SHA-256: `C989871FDC00B9EECCC8A2A420994CE2998429B29FE07958C77BC9FAA312C260`

The remaining failed scenario is owner/suite drift, not a Round 7 regression. `R3.SURFACE.CENSUS` expects four header controls while its collector returns five because it includes `#activeDiagramTitle` in the header region even though the same scenario says the editable title is reported separately. The failure reproduces unchanged on the frozen base (10/12 bounded assertions; the same two failures), and the mobile count/Connect assertions pass.

- frozen-base census report: `round7_work/job_a_baseline_census/report.json`
- report SHA-256: `20BD8124C028FFDC1C83189989C0DE5E817D9587770C56835949598F319E34C8`

After the interactive Office rerun, the effective application result is 47/48 scenarios. The sole remaining red is the demonstrated pre-existing census-harness contradiction.

## Anchor audit

No brief anchor moved because of drift in the frozen base. The following authoring candidates were tightened before any application write:

- AE: the first candidate encoded CRLF around `updateDiagramTypeStarterUi();`; the frozen file is LF. The anchor text was corrected to the exact byte representation.
- AG: `function handleSourceInput() {` followed by `clearTimeout(inputTimer);` occurs zero times because the current function begins with the Guided-row redraw guard. It was expanded to the unique function/comment preamble actually present.
- AG: the short pair `updateDiagramTypeChip();` / `refreshNodeStyleTargets();` occurs three times, not two. It was split into three unique contextual anchors for boot migration, `handleSourceInput`, and `applySource`, preventing an unrelated occurrence from being changed.

Final application anchors used:

- AE: the unique `updateDiagramTypeStarterUi()`/`codeOnlyMaybeShowHint()` pair; `function renderStructureEditor()`; and the exact old `linkCount`/`structureCount` assignment block.
- AF: the complete unique `function detectMermaidDiagramType(source)` body.
- AG: `function updateTitlePreview()`; the unique boot synchronisation block; the unique `handleSourceInput` state-sync block; and the unique `applySource` preamble/state-sync block.
- AH: the unique source guard inside `codeOnlyMaybeShowHint()` and the exact old code-only chip sentence.

Every final replacement anchor is exact-count guarded by its patch script.

## Deliberately not done or claimed

- I did not implement the held-back caption-at-0×0 decision, diagram-type discoverability route, or the click half of the code-only chip.
- I did not alter Present, Map, deck behaviour, ambient scenes, the Style structure, visual-builder structure, canvas type gating, APP_VERSION, CHANGELOG, or CSP.
- I did not change the Job A census expectation; it is outside the four jobs, and the bounded frozen-base run proves it is already inconsistent.
- I do not claim arbitrary edited flowchart syntax can always be distinguished as Swimlane or Ishikawa. SIREN preserves those identities for the exact starters it creates; after structural edits, the syntax is truthfully a flowchart unless future design adds persistent type metadata.
