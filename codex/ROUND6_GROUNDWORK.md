# Round 6 — Stage 1 groundwork

Measured only against `C:\Claude\SIREN\codex\FROZEN_R6_BASE.html`: 8,528,590 bytes, SHA-256 `DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`. No application file was edited and no application patch was written.

## Job V — all diagram types inherit the flowchart title

### 1. What is true now

Measured with `qa_exports\r6_probe_reference.js` in one browser session. All nineteen required sources returned `Flowchart Preview` in all three locations:

| Runtime element | Value on 19/19 types |
|---|---|
| `#diagramTitlePreview` | `Flowchart Preview` |
| `#previewHeading` | `Flowchart Preview` |
| `#diagramTitle.value` | `Flowchart Preview` |

Types: flowchart, graph, sequence, classDiagram, state, er, journey, gantt, pie, quadrant, requirement, gitGraph, c4, mindmap, timeline, sankey, xychart, block and kanban. There were zero exceptions. The field value is persisted with the diagram and is consumed by export paths, although `diagramOfficeExportTitle(type)` already substitutes a type label for some Office exports.

Evidence: `r6_probe_reference_result.json`.

### 2. Where

- `const defaultState = {` — occurrence count `1`, line `22289`. This state contains both top-level and first-diagram `diagramTitle: 'Flowchart Preview'` defaults.
- `function applySource(source, { reason =` — occurrence count `1`, line `69041`. The type UI is refreshed here after source replacement, but the untouched default title is not made type-aware.
- `function diagramOfficeExportTitle(type) {` — occurrence count `1`, line `86203`. This is a downstream mitigation, not the source of the UI default.

### 3. What should change

When the source changes diagram type and the current title is still the untouched flowchart default, replace it with a type-appropriate default in state, the active diagram record and the three rendered title surfaces. A title the user has edited must remain unchanged. This belongs in the ordinary source/type synchronization path, not in each exporter.

### 4. How it would be proved fixed

Load each of the nineteen reference sources. After render, read `#diagramTitlePreview.textContent`, `#previewHeading.textContent` and `#diagramTitle.value`. For every type except flowchart and its graph alias, assert that none contains `Flowchart`. Then set `#diagramTitle` to `Client title`, change type and assert all three surfaces still read `Client title`. The first assertion fails on the current build for 17 of 19 types.

### 5. What I could not establish

I could not establish the approved wording convention for each new default, or whether graph should deliberately share the flowchart title. I also did not exercise every exporter here; this job measured the three title surfaces specified by the procedure.

## Job W — the reported type-forgetting does not reproduce for valid select values

### 1. What is true now

The procedure's nine requested assignments were run, followed by a positive control using the select's actual XY value.

| Requested value | 300 ms select / disabled / title / hint | 2200 ms select / disabled / title / hint |
|---|---|---|
| block | `block` / false / `Replace the current source with a Block diagram starter.` / `Block: free block layouts with column control. Code-first, rendered by Full Mermaid.` | identical |
| architecture | `architecture` / false / `Replace the current source with a Architecture starter.` / `Architecture: services, groups and connections. Code-first, rendered by Full Mermaid.` | identical |
| c4 | `c4` / false / `Replace the current source with a C4 context starter.` / `C4 context: systems and people at context level. Code-first, rendered by Full Mermaid.` | identical |
| xychart | empty / false / `Replace the current source with a Mermaid starter.` / empty | identical |
| requirement | `requirement` / false / `Replace the current source with a Requirement diagram starter.` / `Requirement: requirements, elements and traces. Code-first, rendered by Full Mermaid.` | identical |
| mindmap | `mindmap` / false / `Replace the current source with a Mindmap starter.` / `Mindmap: a branching idea tree. Code-first; indentation defines the hierarchy.` | identical |
| timeline | `timeline` / false / `Replace the current source with a Timeline starter.` / `Timeline: periods and events. Code-first, rendered by Full Mermaid.` | identical |
| kanban | `kanban` / false / `Replace the current source with a Kanban starter.` / `Kanban: columns and cards. Code-first, rendered by Full Mermaid (needs a recent Mermaid).` | identical |
| ishikawa | `ishikawa` / false / `Replace the current source with a Ishikawa starter.` / `Ishikawa: cause-and-effect fishbone, built on flowchart syntax - so the Visual builder works here too.` | identical |
| xy, valid control | `xy` / false / `Replace the current source with a XY chart starter.` / `XY chart: bar and line series on axes. Code-first, rendered by Full Mermaid.` | identical |

The empty `xychart` row is caused before any app delay: `xychart` is not an option value. The actual value is `xy`. With `xy`, the selection remains stable. Ishikawa remains `ishikawa`; it is not re-detected as flowchart in either reading.

Clicking `#newDiagramTypeButton` opens `#confirmDialog`. The procedure does not confirm it, so the app has not created a starter or told the user it succeeded during this measurement. The stated defect did not reproduce on any valid value tested.

Evidence: `r6_probe_w_result.json`.

### 2. Where

- `<option value="xy">XY chart</option>` — occurrence count `1`, line `19184`.
- `function requestNewDiagramTypeStarter()` — occurrence count `1`, line `24785`. This path opens the confirmation dialog before applying the starter.

### 3. What should change

No application change is justified by this run. The test contract should use `xy` and should press `#confirmActionButton` if the intended question is persistence after creation. If an external contract genuinely requires the alias `xychart`, that requirement must be stated before adding alias normalization.

### 4. How it would be proved fixed

For the current contract, select each valid option, click New starter, confirm, wait 300 ms and a further 2000 ms, and assert `#diagramTypeSelect.value` remains the selected value. Also assert the created source's first line matches the requested starter. If the reviewer requires `xychart` as an alias, add the failing-current assertion that assigning `xychart` normalizes to `xy` rather than `""`.

### 5. What I could not establish

I could not establish whether `xychart` in the procedure was meant as a DOM option value or as a diagram-family name. I also could not test the claimed post-success transition literally because the prescribed steps stop at an open confirmation dialog.

## Job X — the Guided counter is flowchart-specific while Guided rows still render

### 1. What is true now

After each source loaded, Guided was selected and the required 1400 ms elapsed. The literal `.struct-row` count is zero on all nineteen types. That selector is not used by the runtime rows: the actual rendered line elements are `#structureRows .struct-code`, and those provide a positive control on every type.

| Type | `#structureCount` | `.struct-row` | `.struct-code` | Hand reading of type-native items | Agreement |
|---|---:|---:|---:|---|---|
| flowchart | 3 blocks · 3 connections | 0 | 4 | 3 blocks, 3 connections | yes |
| graph | 3 blocks · 2 connections | 0 | 2 | 3 blocks, 2 connections | yes |
| sequence | 0 blocks · 0 connections | 0 | 5 | 2 participants, 2 messages | no |
| classDiagram | 0 blocks · 0 connections | 0 | 6 | 2 classes, 1 inheritance relation | no |
| state | 0 blocks · 0 connections | 0 | 4 | 2 named states, 3 transitions | no |
| er | 0 blocks · 0 connections | 0 | 2 | 2 entities, 1 relationship | no |
| journey | 0 blocks · 0 connections | 0 | 4 | 1 task | no |
| gantt | 0 blocks · 0 connections | 0 | 6 | 2 tasks, 1 dependency | no |
| pie | 0 blocks · 0 connections | 0 | 3 | 2 slices | no |
| quadrant | 0 blocks · 0 connections | 0 | 5 | 1 plotted point | no |
| requirement | 0 blocks · 0 connections | 0 | 5 | 1 requirement | no |
| gitGraph | 0 blocks · 0 connections | 0 | 6 | 3 commits including merge, 1 merge action | no |
| c4 | 0 blocks · 0 connections | 0 | 3 | 1 person | no |
| mindmap | 0 blocks · 0 connections | 0 | 5 | 4 nodes, 3 parent-child links | no |
| timeline | 0 blocks · 0 connections | 0 | 3 | 2 events | no |
| sankey | 0 blocks · 0 connections | 0 | 2 | 2 nodes, 1 flow | no |
| xychart | 0 blocks · 0 connections | 0 | 4 | 2 categories and 1 series | no |
| block | 0 blocks · 0 connections | 0 | 5 | 6 blocks | no |
| kanban | 0 blocks · 0 connections | 0 | 5 | 2 columns and 2 cards | no |

The counter agrees only for flowchart and graph in this required fixture set. The earlier claim that kanban is accidentally right is refuted here. Swimlane and ishikawa are not among the nineteen required `SOURCES` and were not substituted into this table.

The Guided switch tooltip is verbatim: `The same Mermaid code, with its parts clickable: rename a block, swap a shape, change a connector`.

The Guided hint is verbatim on all types: `Click a chip to edit it in place. Drag a line number to reorder; right-click a line to add, move or delete it.`

Evidence: `r6_probe_x_result.json`.

### 2. Where

- `structureRenderedSource = el.source.value;` — occurrence count `1`, line `29693`. The next line parses all types through `parseStructureRows`.
- `el.structureCount.textContent = namedBlocks.size` — occurrence count `1`, line `29737`.
- `<p class="struct-guide-hint"><span>Click a chip to edit it in place.` — occurrence count `1`, line `19494`.

### 3. What should change

The count and nouns must be type-aware, or the count should be absent on types for which `blocks · connections` has no honest meaning. The tooltip and hint must describe only interactions actually produced for the active type. The existing Guided line rendering should remain intact.

### 4. How it would be proved fixed

Load the same nineteen sources, click `#structureModeButton` and wait 1400 ms. Assert the exact type-native expected count for sequence (2 participants, 2 messages), gantt (2 tasks, 1 dependency), mindmap (4 nodes, 3 links), block (6 blocks) and kanban (2 columns, 2 cards), while flowchart remains 3 blocks · 3 connections. Assert `#structureRows .struct-code` equals the number of source lines for every fixture. These type-native counter assertions fail on the current build.

### 5. What I could not establish

I could not establish the product-approved nouns for every Mermaid family, especially git graph, XY, pie and journey. The requested `.struct-row` selector is absent from runtime row construction, so its zero count cannot be used as evidence that Guided rendered nothing.

## Job Y — the required caption and Text/Guided switch are both hidden in the measured state

### 1. What is true now

Measured on pie, gantt and sequence without adding interactions not specified by the procedure:

| Type | Hint text | Hint title | Hint rect | Text/Guided rect | Distance to switch | Distance to vertical | Distance to horizontal |
|---|---|---|---|---|---:|---:|---:|
| pie | Applies to flowcharts only. | Vertical / horizontal applies to flowcharts — pie sets its own direction in code. | 0,0,0,0 | 0,0,0,0 | 0 px, degenerate | 686 px | 717 px |
| gantt | Applies to flowcharts only. | Vertical / horizontal applies to flowcharts — gantt sets its own direction in code. | 0,0,0,0 | 0,0,0,0 | 0 px, degenerate | 686 px | 717 px |
| sequence | Applies to flowcharts only. | Vertical / horizontal applies to flowcharts — sequenceDiagram sets its own direction in code. | 0,0,0,0 | 0,0,0,0 | 0 px, degenerate | 686 px | 717 px |

The zero-pixel distance to Text/Guided is not visual proximity: both rectangles collapse to the origin. The layout buttons are visible at `638,196,28,34` and `669,196,32,34`. Therefore the brief's claim that the caption is visibly printed beside Guided is not reproduced in this state; the stronger measured fact is that the caption is unreachable while the layout controls remain visible.

Evidence: `r6_probe_y_result.json`.

### 2. Where

- `function syncLayoutOrientationControl(direction, disabled = false, type = '')` — occurrence count `1`, line `68594`.
- `el.orientationHint.title =` — occurrence count `1`, line `68601`. The following two lines set the text and unhide flag.

### 3. What should change

Do not move the caption based only on the original screenshot claim. First define the intended visible state. In any state where disabled layout controls are visible, their limitation must be exposed adjacent to them or through an accessible description; a hidden zero-size caption cannot carry that explanation.

### 4. How it would be proved fixed

Load pie, gantt and sequence. If `#verticalLayoutButton` has a non-zero rect and is disabled, assert either: (a) `#orientationHint` has a non-zero rect and its center is within the accepted design distance of the layout-button group, or (b) both layout buttons reference the same text through `aria-describedby`. The current build fails both alternatives.

### 5. What I could not establish

I could not establish whether returning the popped-out editor or explicitly switching editor mode is meant to reveal both the hint and Text/Guided switch; the procedure did not instruct either action. I also could not establish a design-approved pixel threshold, so no arbitrary 40 px rule is presented as product truth.

## Job Z — the one-time code-only chip promises a click that never reaches the diagram and colours most menus lack

### 1. What is true now

The first code-only hint observed was on sequence. Its sentence is:

`Drawn from its code · click a part to find its line · right-click for fit, size, export and colours`

A real Playwright mouse click was sent to the centre of a rendered child inside `#diagram`. The receiver before the click came from `document.elementFromPoint`; a capturing listener on `#diagram` recorded the actual click event target.

| Type | Receiver before physical click | Click event received by `#diagram` |
|---|---|---|
| flowchart, positive control | `P`, text `Check` | `P`, text `Check` |
| xychart | `rect.background` | none |
| pie | `path.pieCircle` | none |
| sequence | `tspan`, text `B` | none |
| c4 | `image` | none |
| gantt | `rect.section.section0` | none |
| timeline | `path.node-bkg.node-undefined` | none |
| journey | `circle.actor-0` | none |
| gitGraph | rendered `svg` | none |

The positive control proves the probe can deliver and observe a diagram click. All eight specified code-only types fail to deliver the click to `#diagram`.

The real right-click menu rows were:

| Type | Rows, verbatim |
|---|---|
| xychart | `Diagram 1 · Advanced Mermaid`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| pie | `Diagram 1 · Advanced Mermaid`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| sequence | `Diagram 1 · Sequence diagram`; `Go to “B” in the code`; `Open the Sequence builder`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| c4 | `Diagram 1 · Advanced Mermaid`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| gantt | `Diagram 1 · Gantt`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| timeline | `Diagram 1 · Advanced Mermaid`; `Go to “2026” in the code`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| journey | `Diagram 1 · Journey map`; `Go to “Me” in the code`; `Edit as code`; `Fit to page`; `Actual size (100%)`; `Export PNG` |
| gitGraph | `Diagram 1 · Git graph`; `Edit as code`; `Branch colours…`; `Fit to page`; `Actual size (100%)`; `Export PNG` |

Only gitGraph has a colour action among the eight measured types. Four headings also report `Advanced Mermaid` rather than their rendered family: xychart, pie, c4 and timeline.

After the chip had appeared and state had time to save, the app was reloaded in the same browser profile and xychart was loaded. `.canvas-hint:not([hidden])` was absent (`null`): the chip did not return.

Evidence: `r6_probe_z_verified_result.json`.

### 2. Where

- `function handleCodeOnlyDiagramClick(event)` — occurrence count `1`, line `28912`.
- `function codeOnlyMaybeShowHint()` — occurrence count `1`, line `28935`.
- `text.textContent = 'Drawn from its code` — occurrence count `1`, line `28953`.
- `function buildDiagramContextMenu(target)` — occurrence count `1`, line `28622`.

### 3. What should change

Facts only; no design is selected in Stage 1. Any later wording must match the per-type click and menu capabilities, and the lifetime decision must account for the fact that the only hint is currently profile-once.

### 4. How it would be proved fixed

Repeat the physical-click table. For every type whose chip says `click a part`, the capturing `#diagram` listener must receive a non-null event target and the promised line-location response must appear. For every type whose chip says `colours`, the opened `.struct-menu` must contain a visible colour action. Reload the same profile and assert the accepted lifetime policy explicitly. The click assertion fails on all eight code-only types today; the colour assertion fails on seven of eight; a repeat-on-next-load policy would also fail.

### 5. What I could not establish

I could not establish which types should keep each promise or whether the correct design is to change interaction, change wording, or omit the hint. I also did not extrapolate the seven-of-eight colour result to all nineteen types.

## Job AA — both discoverability routes require four interactions to create Gantt

### 1. What is true now

Fresh-load facts:

- `#diagramTypeSelect` is inside a closed `details` whose summary is `Diagram type, templates & tools`.
- The selected type is `flowchart`.
- `#addDiagramButton` reads `＋ Diagram` with title `Add a new diagram`.
- One click on `#addDiagramButton` increases the tab count from 1 to 2, creates source beginning `flowchart TD`, leaves the type `flowchart` and opens no confirmation dialog.
- The Job U chip is visible as `Flowchart`, has accessible label `Open diagram type controls`, and its click opens the details.

The complete classic route was measured as four interactions:

1. Open `Diagram type, templates & tools`.
2. Select Gantt.
3. Click `New starter`.
4. Confirm `Create starter`.

It ended with select value `gantt`, source first line `gantt` and a closed confirmation dialog.

The complete Job U chip route was also four interactions:

1. Click `#diagramTypeChip`.
2. Select Gantt.
3. Click `New starter`.
4. Confirm `Create starter`.

It produced the same final state. The chip improves the label and opening route, but it is not a shorter interaction route. The earlier three-interaction result omitted the confirmation and had not created a Gantt chart.

Evidence: `r6_probe_aa_verified_result.json`.

### 2. Where

- `<summary>Diagram type, templates &amp; tools</summary>` — occurrence count `1`, line `19151`.
- `el.addDiagramButton.addEventListener('click', addDiagram);` — occurrence count `1`, line `22725`.
- `el.diagramTypeChip.addEventListener('click', revealDiagramTypeControls);` — occurrence count `1`, line `22650`.
- `function revealDiagramTypeControls()` — occurrence count `1`, line `24834`.

### 3. What should change

Facts only; no navigation design is selected in Stage 1. The one-click blank-flowchart path is a confirmed fast path and must be preserved. Stage 2 must decide whether the visible type chip is sufficiently discoverable or whether a genuinely shorter type-creation route is required.

### 4. How it would be proved fixed

Preserve the current assertion that one click on `#addDiagramButton` creates a flowchart without asking. For any accepted shortcut, drive it from a fresh load through confirmation and assert the resulting source starts with `gantt`. If the acceptance criterion is “shorter than the current disclosure route,” assert `shortcutInteractions < 4`; the Job U chip route fails that assertion today because it also requires 4.

### 5. What I could not establish

I could not establish the approved maximum interaction count or whether discoverability rather than count is the primary requirement. I also could not infer a preferred UI design from the measured routes, and deliberately did not propose one.

