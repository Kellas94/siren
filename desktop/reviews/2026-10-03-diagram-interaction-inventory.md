# SIREN diagram interaction inventory — 2026-10-03

Read-only inventory of the frozen web baseline and current generated desktop renderer. Author: Codex diagram inventory agent. No product source, build, project data, or tests were changed for this report.

## Finding

SIREN offers **19 named diagram starters plus Advanced / other Mermaid**. **Flowchart, Swimlane, and Ishikawa** use its flowchart builder; **Sequence** has a restricted form builder. The other **15 named families** are code-first. Their Guided view edits, reorders, and deletes source lines; it is not a canvas builder for those diagram types.

C4 is therefore one example of a broader editor-coverage gap. It is not evidence that the bundled renderer is obsolete or that the diagram family should be removed. The embedded engine is **Mermaid 12.0.0**, not an inferred dependency version. Official Mermaid documentation currently describes C4 as experimental, with fixed styling and statement-order layout. It does not describe C4 as deprecated. [Official C4 documentation](https://mermaid.js.org/syntax/c4.html)

Even the flowchart canvas is a **structural editor**, not a free-position drawing surface: dragging a block body drops it into a connector, handles create steps/connectors, and sibling order changes by swapping source edges. Arbitrary persistent X/Y positioning is not implemented by these handlers.

## Evidence boundary and provenance

This is **static code proof and product-direction advice**, not native mouse qualification, a screenshot-based usability verdict, or an accessibility compliance audit. The Product Design audit skill was read; no fresh screenshots were captured in this resumed pass. Historical comments, release notes, and existing screenshots were not treated as proof of current native behavior. No UI input was synthesized and no tests were run for this read-only report.

The inspected artifacts are SIREN **1.131.0** (`APP_VERSION`, baseline line 23606). Their hashes were calculated directly from the files and agree with the current build receipt:

| Artifact | SHA-256 |
|---|---|
| `desktop/baseline/R78.html` | `5fce39d9afc9d8d9a7367647a23aa5b07a00c61bdc357e369805d0bd3754faa4` |
| `desktop/generated/app.html` | `222c72e960ec0facff468bca11123582194b78335ef1d4845a59cc251220fe93` |
| Embedded Mermaid script, both artifacts | `28fca7ae6ebc7ed7bb63bde63136a74bfef14f296a57e403657eeb8b32836073` |

The embedded script contains `RSi={version:"12.0.0"}`. Its text is identical in baseline and generated app. The desktop package does not list Mermaid as an npm dependency; the renderer is bundled into the HTML. See [build receipt](C:/Claude/SIREN_WORK/portable/desktop/generated/build.json:3), [package](C:/Claude/SIREN_WORK/portable/desktop/package.json:1), and [frozen baseline build check](C:/Claude/SIREN_WORK/portable/desktop/build/renderer.mjs:9).

The key routing, parsing, raw Guided rendering, Sequence builder, canvas connect/delete/splice/sibling-reorder, inspector label/style, pan, and zoom function regions were compared in both artifacts and are identical. Generated line numbers below are current for the recorded renderer hash; regenerate these references if the build changes.

## Definitions

- **Build**: diagram elements edited through typed forms and flowchart canvas actions.
- **Sequence forms**: participants/actors, messages, and notes added through fields; existing message/note steps moved up/down or deleted through buttons.
- **Guided**: source-line chips. Non-flowchart lines remain exact raw text; clicking edits the whole line. Gutter drag reorders lines. Delete removes a line, not a semantically validated diagram object.
- **Canvas authoring**: drawing changes from a mouse action on a rendered element. Pan/zoom, source-line lookup, styling, metadata, and presentation are listed separately because they do not create or restructure diagram elements.
- **Conditional**: source parsed safely, current render available, and the relevant source ID found in the SVG. No native pass is claimed.

## Every offered type: authoring matrix

The selector is [baseline line 21177](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:21177). Starter definitions are `DIAGRAM_TYPE_STARTERS`, baseline lines 27643–27814. References F, G, S, C, N, V, and P resolve to exact functions and current generated lines in the code matrix below.

**Canvas create / connect / delete** in this table means structural authoring on the preview. **Label** describes existing labels; typing a label while creating a new item is not an existing-item rename feature.

| Offered type | Actual starter declaration | Build / second editor slot | Guided / text | Canvas drag | Canvas create / connect / delete | Existing label edit | Style | Recommendation |
|---|---|---|---|---|---|---|---|---|
| Flowchart | `flowchart TD` | Build, conditional F | Semantic flowchart chips; raw fallback; Code G | Handle connect/create; body splice; no free X/Y C | Yes / yes / yes, conditional C | Canvas double-click/F2, inspector, Build, Guided C/N | Per-node/edge conditional; broad diagram controls N/D1 | Keep; improve discoverability and native qualification |
| Swimlane | `flowchart LR` + flat subgraphs | Same Build F | Same flowchart chips G | Same structural gestures C | Same conditional canvas operations C | Same C/N | Same flowchart controls D1 | Keep as a flowchart template; explain lane semantics |
| Ishikawa (fishbone) | `flowchart RL` + subgraphs | Same Build F | Same flowchart chips G | Same structural gestures C | Same conditional canvas operations C | Same C/N | Same flowchart controls D1 | Keep as a flowchart template; qualify actual fishbone editing |
| Sequence | `sequenceDiagram` | Sequence forms S | Raw lines or Code G | No diagram-part drag | No preview create/connect/delete; forms add participants/messages/notes, delete steps S | Existing labels require Code/raw line; creation fields set initial text S/G | Diagram controls D2; node style only if stable target N | Keep and improve; distinguish forms from canvas editing |
| State diagram | `stateDiagram-v2` | Guided, no Build F/G | Raw line edit/reorder/delete; Code G | No diagram-part drag | No / no / no C | Code/raw line; inspector label disabled N | State node styling/metadata conditional N; diagram controls D3 | Improve next; good candidate for a real state/transition editor |
| Architecture | `architecture-beta` | Guided, no Build F/G | Raw lines; Code G | No diagram-part drag | No / no / no C | Code/raw line G | Diagram controls D2; stable node target conditional N | Advanced until a service/group/port editor exists |
| C4 context | `C4Context` | Guided, no Build F/G | Raw lines; Code G | No diagram-part drag | No / no / no C | Code/raw line G | Narrow diagram controls D7; C4 source styling | Advanced; retain all C4 rendering/import compatibility |
| ER diagram | `erDiagram` | Guided, no Build F/G | Raw lines; Code G | No diagram-part drag | No / no / no C | Code/raw line G | Diagram controls D4; stable node target conditional N | Improve if schema modeling is a core workflow |
| Class diagram | `classDiagram` | Guided, no Build F/G | Raw lines; Code G | No diagram-part drag | No / no / no C | Code/raw line G | Diagram controls D3; stable node target conditional N | Advanced now; improve if software modeling is core |
| Block | `block-beta` | Guided, no Build F/G | Raw lines; Code G | No diagram-part drag | No / no / no C | Code/raw line G | Diagram controls D2; stable node target conditional N | Advanced; column-based source layout is not mouse placement |
| Gantt | `gantt` | Guided, no Build F/G | Raw lines; Code G | No task-bar/date drag | No / no / no C | Code/raw line G | Diagram controls D2 | Advanced until a task/date/dependency editor exists |
| Timeline | `timeline` | Guided, no Build F/G | Raw lines; Code G | No event drag | No / no / no C | Code/raw line G | Diagram controls D5 | Advanced, or add a simple periods/events form |
| Kanban | `kanban` | Guided, no Build F/G | Raw lines; Code G | No card-to-column drag | No / no / no C | Code/raw line G | Diagram controls D5 | Advanced until it behaves like a board |
| Journey | `journey` | Guided, no Build F/G | Raw lines; Code G | No step/score drag | No / no / no C | Code/raw line G | Diagram controls D2 | Advanced, or add section/task/actor/score forms |
| Mindmap | `mindmap` | Guided, no Build F/G | Raw lines; indentation/source hierarchy G | No branch drag/reparent | No / no / no C | Code/raw line G | Diagram controls D6; stable node target conditional N | Improve next if brainstorming is core |
| Requirement | `requirementDiagram` | Guided, no Build F/G | Raw lines; Code G | No element drag | No / no / no C | Code/raw line G | Diagram controls D3; stable node target conditional N | Advanced until requirements/traces have forms |
| Git graph | `gitGraph` | Guided, no Build F/G | Raw lines; Code G | No commit/branch drag | No / no / no C | Code/raw line G | Diagram controls D5 plus explicit branch-colour controls V | Advanced; render and explain branch history |
| XY chart | `xychart-beta` | Guided, no Build F/G | Raw lines; Code G | No data point/bar drag | No / no / no C | Code/raw line G | Diagram controls D5 | Advanced, or add a series/data table editor |
| Pie | `pie showData` | Guided, no Build F/G | Raw lines; Code G | No slice/value drag | No / no / no C | Code/raw line G | Diagram controls D5 | Advanced, or add category/value forms |
| Advanced / other Mermaid | No single starter | Guided for unrecognized declarations F/G | Raw source; Code G | No structural canvas authoring | No / no / no for non-flowchart sources | Code/raw line | Generic seeded controls only; actual render varies | Keep as compatibility and expert entry; New starter disabled |

Swimlane and Ishikawa are SIREN flowchart templates, not the Mermaid native syntaxes of those names. Their special detected names depend on exact starter text (baseline 27595–27596); after editing, they generally detect as Flowchart while retaining flowchart capabilities. Advanced is a detector fallback, not a twentieth grammar. `C4Container`, `C4Component`, `C4Dynamic`, and `C4Deployment` are not named in SIREN's type detector; they go through Advanced rather than the C4 context starter. This does not establish a render failure or justify removing them.

## Viewing, inspection, and Presentation

| Capability | Coverage and limit | Code proof |
|---|---|---|
| Pan | Shared rendered viewport, on eligible background drag; interactive nodes/edges and board view are excluded | V1 |
| Zoom / fit / actual size | Shared preview controls and context menu, independent of structural authoring | V1/V2 |
| Click drawn part to locate source | Code-first diagrams use text-to-line matching. One unique line is required; duplicates/no match produce an explanatory message. This is read-only navigation | V3 |
| Stable-node inspector | Catalog ID plus current matching SVG group required. State has a dedicated catalog; other types use a general catalog heuristic. No guarantee of every family/part | N1/N2 |
| Change node label/shape in inspector | Safe flowchart model required; unavailable on code-first sources even if inspector styling works | N3 |
| Whole-diagram Presentation | Shared Presentation entry and rendered SVG loading | P1 |
| Node-by-node Presentation | Stored/node steps filtered against source IDs and SVG groups. Some diagrams can show the overview without a useful node sequence; not equivalent to a per-type presenter builder | P2 |
| Presentation pan/zoom/annotations | Viewing and annotations on the stage, not diagram source restructuring | P3 |

## Style controls: exact seed, not a native appearance verdict

`STYLE_SEED_CONTROLS` and `STYLE_SEED` are baseline lines 41737–41745. `capabilityVerdict` uses seeded live bits and can restore hidden controls when a runtime probe discovers additional capability; it never hides a seeded live control because of a negative probe. Therefore these are **implementation defaults**, not fresh visual measurements.

| Code | Families | Seeded controls still represented in the current UI |
|---|---|---|
| D1 | Flowchart, Swimlane, Ishikawa (`3d7f`) | Font family/size/weight, title, curve, density, node/rank spacing, legend, block numbering, layout engine |
| D2 | Sequence, Architecture, Block, Gantt, Journey, Advanced (`1d04`) | Font family/size/weight, title, legend |
| D3 | State, Class, Requirement (`3d5d`) | Font family/size/weight, title, curve, density, rank spacing, legend, layout engine |
| D4 | ER (`1d05`) | Font family/size/weight, title, legend, layout engine |
| D5 | Pie, Timeline, Kanban, Git graph, XY (`1f04`) | Font family/size/weight, chart colours, title, legend |
| D6 | Mindmap (`1f74`) | Font family/size/weight, chart colours, title, density, node/rank spacing, legend |
| D7 | C4 (`1900`) | Font family, font size, title |

The seed also includes deleted routing/alignment controls for historical measurements; those are not additional current UI promises. Per-node overlays are separate from these diagram-level seeds and require a stable rendered target. C4 styling written in source (`UpdateElementStyle`, `UpdateRelStyle`) is another separate path. Official documentation describes that source styling and order-driven layout. [Mermaid C4](https://mermaid.js.org/syntax/c4.html)

## Exact file / function / line evidence matrix

Each function link is its verified one-based start line. B = frozen `desktop/baseline/R78.html`; G = current `desktop/generated/app.html`.

| ID | Function / evidence | Baseline | Generated | What it proves |
|---|---|---|---|---|
| F1 | `secondEditorSlot` | [B:31431](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31431) | [G:31971](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:31971) | Sequence, flowchart Build, otherwise Guided routing |
| F2 | `parseVisualFlowchartSource` | [B:103561](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:103561) | [G:104106](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:104106) | Flowchart grammar and safe-edit refusal boundary |
| F3 | `refreshVisualBuilder` | [B:34147](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:34147) | [G:34687](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:34687) | Incompatible sources disable Build; Sequence handled separately |
| G1 | `parseStructureRows` | [B:31240](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31240) | [G:31780](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:31780) | Non-flowchart content stays raw; semantic chips only flowchart grammar |
| G2 | `structureRenderRawExact` | [B:33518](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:33518) | [G:34058](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:34058) | Whole raw line click/edit |
| G3 | `ensureStructureRowsInteractions` | [B:31715](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31715) | [G:32255](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32255) | Gutter pointer drag; keyboard move/delete |
| G4 | `structureMoveRowTo` / `structureDeleteRow` | [B:31608](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31608), [B:31861](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31861) | [G:32148](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32148), [G:32401](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32401) | Source-line reorder/delete, not object operations |
| G5 | `structureAddBlock` / `structureAddLink` | [B:31910](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31910), [B:31926](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:31926) | [G:32450](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32450), [G:32466](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32466) | Non-flowchart insertion/connect blocked |
| G6 | `buildStructureRowContextMenu` | [B:32422](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:32422) | [G:32962](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:32962) | Mouse menu move/delete; flowchart-only add/connect |
| S1 | `parseSequenceSource` | [B:42945](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:42945) | [G:43490](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:43490) | Restricted sequence grammar; unsupported statements pause builder |
| S2 | `refreshSequenceBuilder` | [B:43015](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:43015) | [G:43560](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:43560) | Forms, step move buttons, step delete; no existing step label field |
| S3 | `addSequenceParticipant` / `addSequenceMessage` / `addSequenceNote` | [B:43124](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:43124), [B:43137](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:43137), [B:43153](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:43153) | [G:43669](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:43669), [G:43682](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:43682), [G:43698](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:43698) | Adds via fields, not canvas gestures |
| C1 | `canvasModel` | [B:101728](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:101728) | [G:102273](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:102273) | All canvas mutations require compatible flowchart parser |
| C2 | `handleCanvasDragEnd` / `canvasConnect` | [B:102114](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102114), [B:102635](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102635) | [G:102659](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:102659), [G:103180](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103180) | Handle drop connects or opens creation popover |
| C3 | `canvasGrow` / `canvasAddFree` | [B:102488](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102488), [B:102596](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102596) | [G:103033](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103033), [G:103141](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103141) | Structural step/new-node creation; no stored X/Y |
| C4 | `canvasCommitInplace` | [B:102705](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102705) | [G:103250](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103250) | In-place flowchart label mutation |
| C5 | `canvasDeleteAndHeal` | [B:102817](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102817) | [G:103362](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103362) | Flowchart delete/heal with path-loss refusal |
| C6 | `canvasBeginBodyPress` / `handleCanvasMoveEnd` / `canvasSplice` | [B:102920](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102920), [B:103007](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:103007), [B:102864](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:102864) | [G:103465](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103465), [G:103552](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103552), [G:103409](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103409) | Body drag inserts into connector; blank drop does nothing; touch excluded |
| C7 | `canvasReorderSibling` | [B:103032](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:103032) | [G:103577](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:103577) | Keyboard sibling swap; verifies result after render |
| N1 | `renderedNodeStyleCatalog` | [B:37412](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:37412) | [G:37952](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:37952) | Current render + source catalog + matching SVG target |
| N2 | `handlePreviewNodeClick` / `applyNodeInspectorStyleLive` | [B:43531](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:43531), [B:44795](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:44795) | [G:44076](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:44076), [G:45340](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:45340) | Selection, inspector, stable-target style storage |
| N3 | `populateInspectorBlockLabel` / `applyNodeInspectorLabel` | [B:44632](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:44632), [B:44659](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:44659) | [G:45177](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:45177), [G:45204](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:45204) | Label edit disabled without compatible flowchart node |
| N4 | `applyNodeInspectorShapeLive` | [B:44785](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:44785) | [G:45330](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:45330) | Shape changes restricted to editable flowcharts |
| V1 | `beginPan` / `setZoom` | [B:101606](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:101606), [B:101274](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:101274) | [G:102151](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:102151), [G:101819](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:101819) | Viewing gestures, not source layout |
| V2 | `buildDiagramContextMenu` | [B:32468](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:32468) | [G:33008](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:33008) | Code-first fit/size/export; source and Sequence links; Git branch colours |
| V3 | `handleCodeOnlyDiagramClick` | [B:32932](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:32932) | [G:33472](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:33472) | Conditional unique-text line lookup; no source mutation |
| P1 | `openPresentation` / `loadPresentationDiagram` | [B:82167](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:82167), [B:82270](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:82270) | [G:82712](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:82712), [G:82815](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:82815) | Shared rendered diagram stage |
| P2 | `buildPresentationSequence` | [B:82358](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:82358) | [G:82903](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:82903) | Node sequence filtered to valid source/SVG targets |
| P3 | `handlePresentationPointerDown` / `handlePresentationWheel` | [B:83992](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:83992), [B:83981](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:83981) | [G:84537](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:84537), [G:84526](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:84526) | Presentation camera interaction |
| D | `capabilityVerdict` | [B:41763](C:/Claude/SIREN_WORK/portable/desktop/baseline/R78.html:41763) | [G:42308](C:/Claude/SIREN_WORK/portable/desktop/generated/app.html:42308) | Style seed/runtime gate |

## Disposition and next work

1. **Keep and qualify the primary mouse path:** Flowchart, Swimlane, Ishikawa. Make the structural nature of drag explicit; native-check create, connect, rename, delete/heal, connector splice, undo, and saved reload on each starter. Include a flowchart with nested groups/directives/styles to verify graceful fallback.
2. **Keep and improve Sequence:** call it a form builder; add existing participant/message/note editing and explicit participant deletion semantics before implying full no-code sequence editing. Native-check unsupported `alt`, `loop`, activation, and other advanced syntax pauses editing without rewriting source.
3. **Prioritize real builders by workflow:** State and Mindmap are strong candidates for transitions and branch edits. ER/Class can follow if software/schema modeling is a core use case. This is product prioritization, not evidence of current native behavior.
4. **Move code-first starters to Advanced in primary creation navigation:** C4, Architecture, Block, Gantt, Timeline, Kanban, Journey, Requirement, Git graph, XY, and Pie. ER/Class/State/Mindmap should also carry a visible code-first label until improved. A rendered Kanban is not a card-drag board; a rendered Gantt is not a task scheduling editor.
5. **Retire misleading promises, not stored content:** retire generic “visual editing”/“interactive diagram” promotion for families lacking structural canvas editing; retire equal-weight primary starter promotion where it suggests equivalent mouse capability. Do not remove their syntax, saved projects, import, previews, exports, or Presentation. Opening an existing diagram should continue to route to its available editor.
6. **Keep Advanced compatibility broad:** C4 forms beyond Context and any supported Mermaid grammar still need rendering/import access even if absent from the curated starter list. Avoid rewriting existing source just to fit a primary builder.

C4's style/layout constraints are intrinsic to its current Mermaid implementation; adding a SIREN form editor would still improve authoring without making it a free-position canvas. Architecture describes groups, services, edges, and junctions in source, and Block describes columns/blocks in source; neither official grammar is evidence of SIREN mouse support. [Architecture documentation](https://mermaid.js.org/syntax/architecture.html), [Block documentation](https://mermaid.js.org/syntax/block.html), [Mindmap documentation](https://mermaid.js.org/syntax/mindmap.html)

## Remaining qualification

Fresh native Windows input and current screenshots are still needed to establish hit targets, visible handles, drag thresholds, inspector positioning, actual starter render success, style effects, discoverability, keyboard focus, and persistence/undo results for all 19 starters. Parser gates establish implemented scope, not end-to-end success. This report is sufficient to describe truthful creation choices; it must not be cited as an all-types native interaction pass.
