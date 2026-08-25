# Round 6 — Stage 2 independent verification

Verified against `C:\Claude\SIREN\codex\FROZEN_R6_BASE.html`, 8,528,590 bytes, SHA-256 `DFFFD40E0E5E6BC205B86D779CF6FADAA89426BC04493CB389CD3308CBCF8435`. The application and `ROUND6_GROUNDWORK.md` were not modified.

## Executive verdict

| Job | Verdict on the groundwork plan |
|---|---|
| V | CONFIRMED, but one proposed assertion already passes and another omits the action required to reach the field |
| W | REFUTED: the plan stopped at the confirmation dialog; after confirmation the original defect reproduces on eight types and the Ishikawa variant also reproduces |
| X | CONFIRMED for the measured counters and misleading strings; one proposed assertion already passes 19/19 and several “expected” nouns remain design assumptions |
| Y | REFUTED as an interpretation: the default-state 0×0 measurement is real, but the ordinary Code action reveals the caption exactly beside Text/Guided |
| Z | CONFIRMED and extended: the same failures reproduce on Architecture, which the plan omitted |
| AA | CONFIRMED; the plan stayed design-neutral, although it incorrectly says Stage 2 should make the design decision |

Calibration passed independently: all nineteen reference types returned `Flowchart Preview` in `#diagramTitlePreview`, `#previewHeading` and `#diagramTitle`, with zero exceptions.

## Anchor audit

CONFIRMED — all 18 anchors named by the plan occur exactly once in the frozen file, and every reported first line matches:

| Job | Anchor lines re-counted |
|---|---|
| V | 22289, 69041, 86203 |
| W | 19184, 24785 |
| X | 29693, 29737, 19494 |
| Y | 68594, 68601 |
| Z | 28912, 28935, 28953, 28622 |
| AA | 19151, 22725, 22650, 24834 |

No anchor is duplicated or line-drifted.

## Job V

### Verdicts

- CONFIRMED — 19/19 types display `Flowchart Preview` in all three named surfaces.
- CONFIRMED — after revealing Style with `#styleShortcutButton`, entering `Client title` and loading pie, all three surfaces remain `Client title`.
- UNTESTED — the plan says the field is persisted and consumed by export paths. This verification did not perform save/reload or export, so that runtime claim is not promoted from source observation to confirmed behavior.
- CONFIRMED FROM SOURCE ONLY — `diagramOfficeExportTitle(type)` contains a non-flowchart fallback. Its actual output was not exercised here.

### Evidence

The official reference probe was rerun independently on port 9981. It produced nineteen rows and the same value in all 57 readings. A separate browser context then opened Style, filled `#diagramTitle`, changed the source to pie and read:

- `#diagramTitlePreview` = `Client title`
- `#previewHeading` = `Client title`
- `#diagramTitle.value` = `Client title`

Positive control: the default run remains `Flowchart Preview` before the custom edit.

### Assertion audit

- FAILS CURRENT, valid defect test — non-flowchart/non-graph titles must not contain `Flowchart`. It fails on 17/19.
- PASSES CURRENT — preservation of `Client title` across a type change already works. This is a useful regression guard, but not a test of the proposed fix.
- NOT RUNNABLE AS WRITTEN — `#diagramTitle` is inside collapsed Style. A physical `fill()` timed out until `#styleShortcutButton` was clicked.

### Where the plan is wrong

The plan presents the two-part assertion as one fix test even though its custom-title half already passes. It also omits the required action that makes `#diagramTitle` reachable. A Stage 3 test copied literally from the plan will time out before it tests anything.

### What the plan does not cover

It does not verify the wrong default through save/reload, a newly added diagram, duplicated diagrams, or the export formats that allegedly consume it. Those are the states most likely to reveal whether the fix belongs in initialization, source replacement, diagram activation or export fallback.

## Job W

### Verdicts

- CONFIRMED, but irrelevant to the actual defect — assigning the nonexistent DOM value `xychart` empties the select; the real option value is `xy`.
- REFUTED — the plan concludes that no application defect reproduces for valid values.
- CONFIRMED — opening New starter without confirming leaves the chosen select value stable. That only measures the confirmation screen, not a created starter.
- CONFIRMED ORIGINAL DEFECT — after confirming creation, Block, Architecture, C4, XY, Requirement, Mindmap, Timeline and Kanban all become `advanced` by 300 ms and remain `advanced` at 2300 ms.
- CONFIRMED ISHIKAWA VARIANT — after confirming Ishikawa, the select becomes `flowchart` and remains there.
- CONFIRMED POSITIVE CONTROL — after confirming Flowchart, it remains `flowchart` at both readings.

### Evidence

Each starter was created through its real UI, including `#confirmActionButton`. For all eight affected types, the app simultaneously showed:

- the correct source first line and a success toast naming the requested starter;
- `#diagramTypeSelect.value = advanced`;
- `#newDiagramTypeButton.disabled = true`;
- title `Advanced Mermaid is detected from the source; paste its declaration directly.`;
- the Advanced Mermaid catch-all hint.

For Ishikawa, source began `flowchart RL` and the toast said `Ishikawa starter created.`, while the picker retitled itself as Flowchart. Flowchart itself stayed correctly identified and enabled.

### Assertion audit

- FAILS CURRENT, valid defect test — after confirmed creation, the selected value must remain the requested valid type. It fails on the eight catch-all types and Ishikawa.
- PASSES CURRENT — the starter source first line matches the selected starter. This is a regression guard, not the detection defect.
- FAILS CURRENT BUT TESTS AN UNSTATED CONTRACT — assigning `xychart` and expecting alias normalization. The application UI never exposes that value; Stage 3 should not add an alias merely to satisfy a mistaken probe key.

### Where the plan is wrong

The central conclusion is wrong because the probe stopped before the action occurred. The confirmation dialog was not a blocker; it was the next required UI step. Once confirmed, the brief's reported failure reproduces exactly, including the success toast followed by contradictory disabled UI.

The plan's statement that the prescribed steps “do not confirm” correctly criticizes the Stage 1 procedure, but it should have triggered a follow-through measurement, not a no-defect verdict.

### What the plan does not cover

The mis-detection spreads beyond the select. Independent Z verification found context-menu headings `Advanced Mermaid` for XY, C4, Timeline, Pie and Architecture. Stage 3 should audit every consumer of the detected type, including `#diagramTypeChip` and menu headings, rather than patching only `#diagramTypeSelect`.

## Job X

### Verdicts

- CONFIRMED — the reference fixtures produce 3·3 for flowchart, 3·2 for graph and 0·0 for the other seventeen types.
- CONFIRMED — literal `.struct-row` count is zero on all nineteen; runtime rows are `#structureRows .struct-code`.
- CONFIRMED — `.struct-code` count equals source-line count on all nineteen fixtures.
- CONFIRMED — the tooltip and hint strings are verbatim as reported.
- CONFIRMED BEHAVIORAL MISMATCH — flowchart exposes granular direction/id/shape/label/arrow tokens; Sequence, Gantt, Mindmap, Block and Kanban expose only whole-line `raw` tokens.
- CONFIRMED — on those non-flowchart types the row menu visibly offers `Insert block below` and `Connect from here` but disables both with the explanation that they are flowchart syntax.
- UNTESTED AS PRODUCT TRUTH — the plan's exact type-native nouns and counts for every family are hand interpretation, not an approved application contract.

### Evidence

Positive control on the same run:

- flowchart: 19 granular tokens across four rows; row-menu insert/connect actions enabled;
- sequence: five raw-line tokens; insert/connect disabled;
- gantt: six raw-line tokens; insert/connect disabled;
- mindmap: five raw-line tokens; insert/connect disabled;
- block: five raw-line tokens; insert/connect disabled;
- kanban: five raw-line tokens; insert/connect disabled.

A first X-detail probe was discarded because it left Guided active and then reported the flowchart result for later types. Restoring Visual or Text between loads produced distinct, source-correct measurements. This control failure is evidence that the accepted run was not a zero-everywhere instrument.

### Assertion audit

- FAILS CURRENT — the proposed type-native counter assertions for Sequence, Gantt, Mindmap, Block and Kanban.
- PASSES CURRENT 19/19 — `#structureRows .struct-code` equals the number of source lines. This should remain as a regression guard, but it is not evidence of the counter fix.
- UNDERSPECIFIED — exact new text for Git graph, XY, Pie and Journey cannot be asserted until the product nouns are chosen.

### Where the plan is wrong

It labels the type-native counter assertion “exact” while simultaneously admitting that the approved nouns are unknown. The numerical examples are useful evidence, but they are not yet a complete acceptance contract.

It also includes an already-passing row-render assertion among tests that the Stage 2 brief says should fail on the current app.

### What the plan does not cover

The plan counts rows but does not describe the stronger misleading state: non-flowchart raw lines are focusable chips, while the global tooltip promises rename-block, swap-shape and change-connector affordances that only the flowchart tokens actually expose. It also does not test keyboard activation of those raw tokens or how a screen reader announces the disabled flowchart-only menu commands.

## Job Y

### Verdicts

- CONFIRMED — in the default Visual state, both `#orientationHint` and the Text/Guided switch measure 0×0.
- REFUTED — the plan treats that default-state result as the meaningful user state and says the original “beside Guided” claim did not reproduce.
- CONFIRMED ORIGINAL CLAIM — after the normal `#codeModeButton` action, the hint becomes visible immediately to the right of Text/Guided on Pie, Gantt and Sequence.
- CONFIRMED — the visible layout buttons remain hundreds of pixels away and disabled.

### Evidence

Identical readings on Pie, Gantt and Sequence after opening Code:

- hint rect: `x=202, y=314, w=116, h=14`;
- Text/Guided switch rect: `x=39, y=300, w=154, h=42`;
- the switch ends at x=193 and the hint starts at x=202: a 9 px edge gap, vertically centered on the same y=321 line;
- vertical layout rect: `638,196,28,34`;
- horizontal layout rect: `669,196,32,34`.

The hint therefore visually reads as a caption for Guided, while its title explicitly describes Vertical/Horizontal. The plan's original 686/717 px figures are distances from a collapsed 0×0 rectangle at the origin, not layout evidence.

Positive control: opening Code makes both the switch and hint non-zero in the same run; the measurement is not reporting hidden everywhere.

### Assertion audit

- FAILS CURRENT in default state — visible disabled layout buttons have neither a visible adjacent hint nor `aria-describedby`.
- FAILS CURRENT in Code state — the hint is visible but is beside Text/Guided, not the layout buttons, and there is still no accessible description relationship.
- UNDERSPECIFIED — “accepted design distance” has no approved numeric value.

### Where the plan is wrong

The plan explicitly placed Code/popup state under “could not establish” and then used that missing state to reject the brief's placement claim. The ordinary Code action establishes it immediately and confirms the original defect. “Do not move the caption” is therefore not supported by the running application.

### What the plan does not cover

It does not test narrow viewports, keyboard focus order or a screen-reader relationship between the disabled layout buttons and the explanation. Moving pixels alone could fix the screenshot while leaving the accessible claim disconnected.

## Job Z

### Verdicts

- CONFIRMED — exact hint sentence.
- CONFIRMED — physical click reaches `#diagram` on flowchart positive control.
- CONFIRMED — physical click does not reach `#diagram` on XY, Pie, Sequence, C4, Gantt, Timeline, Journey or Git graph.
- CONFIRMED AND EXTENDED — Architecture also receives no `#diagram` click.
- CONFIRMED — only Git graph has a colour action among the nine code-only types measured.
- CONFIRMED — the hint is absent after reload in the same browser profile.
- CONFIRMED — the plan chose no design, as Stage 1 required.

### Evidence

The positive-control click produced `P / Check` both before the physical mouse click and as the captured `#diagram` click target. All nine code-only tests had a real rendered receiver from `document.elementFromPoint` but a null captured click target.

Architecture was created through the built-in starter. Its receiver was rendered SVG, its `#diagram` click target was null, and its menu was:

- `Diagram 1 · Advanced Mermaid`
- `Go to “Data layer” in the code`
- `Edit as code`
- `Fit to page`
- `Actual size (100%)`
- `Export PNG`

No colour action was present. After the first hint was saved, reloading the same profile and loading XY returned no visible `.canvas-hint`.

### Assertion audit

- FAILS CURRENT on nine of nine code-only types — any chip that promises `click a part` must produce a captured diagram target and line-location response.
- FAILS CURRENT on eight of nine — any chip that promises `colours` must expose a colour action. Git graph is the positive control.
- FAILS CURRENT if the accepted lifetime is repeat-per-load — the current profile-once policy returns null after reload.
- DEPENDS ON DESIGN — the lifetime assertion cannot have one expected value until the owner chooses it.

### Where the plan is wrong

Its eight-type table is accurate for those eight, but it calls them “all specified code-only types” and omits Architecture. The brief's claim covered nine. Architecture reproduces both failures and adds another `Advanced Mermaid` heading.

### What the plan does not cover

It does not test touch, keyboard activation, the hint's close button, auto-hide duration or whether a successful future click announces the located source line accessibly. It also walks past five confirmed wrong menu headings: Architecture, XY, Pie, C4 and Timeline are presented as `Advanced Mermaid`.

## Job AA

### Verdicts

- CONFIRMED — fresh type controls are inside closed `Diagram type, templates & tools`.
- CONFIRMED — one `+ Diagram` interaction creates a second flowchart without asking.
- CONFIRMED — classic Gantt creation requires four interactions through confirmation.
- CONFIRMED — the visible type-chip route also requires four interactions and creates Gantt.
- CONFIRMED — the Job U chip opens the disclosure but does not reduce the interaction count.
- CONFIRMED — the plan did not choose a design.

### Evidence

Three fresh browser contexts produced:

| Route | Interactions | Final state |
|---|---:|---|
| `+ Diagram` | 1 | two diagrams, source `flowchart TD`, no confirmation |
| disclosure → Gantt | 4 | source `gantt`, select `gantt`, confirmation closed |
| type chip → Gantt | 4 | source `gantt`, select `gantt`, confirmation closed |

Positive control: the one-click flowchart fast path works in the same verification set.

### Assertion audit

- PASSES CURRENT — one click on `#addDiagramButton` creates a flowchart without asking. This is a preservation guard.
- FAILS CURRENT — a shortcut satisfying `shortcutInteractions < 4` does not exist in the measured routes.
- DEPENDS ON DESIGN — fewer interactions are not automatically more discoverable; the owner has not approved a numeric budget.

### Where the plan is wrong

The factual measurements are sound. The process sentence “Stage 2 must decide” is not: Stage 2 verifies facts and assertions. The design choice belongs to the owner/reviewer before Stage 3 integration.

### What the plan does not cover

It does not measure keyboard-only interaction counts, phone layout, whether the chip's accessible name is understood as a creation route, or whether a visible type menu can preserve the one-click flowchart shortcut without adding competing primary actions.

## Final Stage 2 disposition

Stage 3 should not implement `ROUND6_GROUNDWORK.md` verbatim.

- V can proceed after fixing the test setup and separating the failing default-title test from the already-passing custom-title guard.
- W must be rewritten around the confirmed post-confirmation mis-detection; the plan's no-change recommendation is rejected.
- X can proceed only after product nouns are chosen; retain the already-passing row test as a regression guard.
- Y must be based on the visible Code state, where the original placement defect is confirmed.
- Z facts are accepted with Architecture added; design remains open.
- AA facts are accepted; design remains open and the one-click flowchart path is protected.

