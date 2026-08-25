SURFACE: Editor pane — Visual / Code / Docs mode tabs, Advanced settings disclosure, visual block builder (14 shape tiles + Add/Edit forms), Guided editor rows, style + legend controls, and the block inspector that opens over the diagram. Measured in headless Chrome at 1440×900 and 1280×800 against http://localhost:8899/T_Industries_SIREN_v1.html (v1.26.0, Dark theme, fresh profile).

CONTROLS AT REST: 20

OVERALL IMPRESSION
OVERALL

The editor pane is not badly made — the typography, the labelled groups inside Advanced settings, the numbered step diamonds and the per-group one-line hints are all genuinely good work. The problem is that it has never been subtracted from. At rest, on first open, the pane shows 20 interactive controls and 12 of them are shape tiles. The one button that actually performs step 1 (#addVisualNodeButton, "＋ Add block") sits 135 px below the fold at 1440×900 and 235 px below at 1280×800, because the 14-tile gallery above it is 517 px tall — 66% of the pane's entire visible height. A non-coder's first impression of "Build without code" is a wall of shape swatches with no visible way to commit one.

Underneath that, the pane is 2,125 px tall in a 783 px window — 2.71 screens on first open, 2.84 with the builder's sections expanded. Open Diagram settings and the same scroll surface reaches 4,694 px.

VISUAL HIERARCHY — WHAT THE EYE HITS FIRST, AND WHETHER THAT IS RIGHT

In Visual mode my eye lands on the shape gallery: fourteen bordered tiles in a two-column block, one of them ringed in blue. Second is the blue "Render" button in the preview. The mode switch — the single most important control on this surface, the thing that decides which of three completely different workflows you are in — is the last thing I notice.

That is measurable, not taste. I sampled the rendered pixels:
· .editor-mode-switch selected pill = rgb(24,36,49) on a track of rgb(19,28,39) → 1.09:1.
· .layout-switch selected pill (Text/Guided, inside the Code panel) = rgb(37,99,235) on rgb(13,21,31) → 3.55:1.
· .preview-layout-switch (Vertical/Horizontal) uses the same 3.55:1 blue.

So the app has an accessible, high-salience selected-state treatment, applies it to the two sub-toggles, and withholds it from the primary one. The hierarchy is inverted: in the Code-mode screenshot the loudest thing in the editor pane is "Text" — a switch between two views of the same code — while "Visual | Code | Docs" whispers. 1.09:1 also fails WCAG 1.4.11 (3:1 for non-text state indicators); the only real cue is the label colour shift (#f4f7fb vs #a9b7c8).

DO THE THREE MODES READ AS THREE MODES?

No. Visual and Code are two role="tabpanel" siblings inside the editor pane. Docs is a full-screen takeover with its own top bar and its own "← Back" — I clicked it and both panes were replaced. Consistently, #workpapersButton carries role="tab" but aria-controls=null and there is no panel with that id, so a screen reader is told "tab 3 of 3" for a tab that controls nothing.

Worse, the first tab is conditional and doesn't say so. I created a Gantt starter: #visualModeButton flipped to aria-selected="false", #visualModePanel hid itself, all 37 visual-builder controls went disabled — and the tab still rendered at full brightness, identical to before. Nothing dimmed. Meanwhile the preview toolbar correctly greys out ↕ Vertical / ↔ Horizontal for the same diagram. The app knows how to show "not available here" and doesn't do it on the one control where the whole mental model depends on it. Of the 20 types in #diagramTypeSelect, the visual builder only really serves flowchart / swimlane / ishikawa (plus a separate sequence builder).

CONSISTENCY

· Two controls on the same scroll surface carry the identical label "Connector style": #visualEdgeType (Arrow / Dotted / Strong / Line — arrowhead semantics, y≈1371) and #curve (Smooth / Straight / Monotone / Step / Orthogonal — curve geometry, y≈3054). This is exactly the "two identical Agent spec dropdowns" defect from Docs. A third, #layoutRouting "Connector routing", sits 307 px below #curve and its default option literally reads "Use connector style".
· Shape is chosen in four places with byte-identical 14-item lists: #visualShapePalette, #visualNodeEditShape, #nodeShape, #inspectorShape. Two of them (the tile gallery and the "Shape" dropdown in Edit a block) are visible side by side, ~180 px apart.
· Direction is set in four places: #visualDirection ("Flow direction"), #direction ("Advanced direction", offering TB which is a Mermaid alias of TD), the Vertical/Horizontal buttons, and line 1 of the source.
· #templateSelect and #quickStarterSelect offer the same six template values in two different disclosures, with "Apply" vs "Use in editor".
· #inspectorFillColor/Border/Text/Shape/FontFamily/FontSize/FontWeight duplicate #nodeFillColor/… one-for-one; the inspector even has a button ("Sidebar settings") whose job is to send you to the duplicate.
· The block list rows lead with the human label ("State", then "A · Process"). The connector list rows lead with the code ("A --> B", then "State → Ministry of Finance") — code-first, in the mode named "Build without code".
· Four disclosure cards at two nesting levels with three different chrome treatments: #advancedToolsCard and #settingsSection are dark; #quickGuideSection is blue-tinted; the builder's own sections use a diamond+numeral and a ::after "+"/"−".

ACCESSIBILITY MEASUREMENTS

· Mode-switch selected state: 1.09:1 (fails 1.4.11). Sub-switch: 3.55:1 (passes).
· .struct-token[role="button"] in the Guided editor: 52 of 100 tokens are clickable; measured sizes include 9×16 and 16×16 px. WCAG 2.5.8 minimum is 24×24. Their only affordance is a 1 px dotted bottom border of #2563eb at 55% alpha — roughly 1.7:1 against the editor background, also under 3:1.
· .struct-line-actions { opacity: 0 } — 48 row buttons (↑ ↓ ×, 24×32 px) across 16 rows are fully transparent until :hover or :focus-within. Keyboard users are covered by focus-within; mouse users get no hint they exist.
· Roving tabindex is broken on the tablist: #visualModeButton tabindex="0", #codeModeButton tabindex="-1", #workpapersButton has no tabindex at all — so the tablist has two tab stops instead of one. (ArrowRight navigation does work.)
· #legendEnabled checkbox 16×16; #autoRender 13×13.
· .visual-section-title rows are 184×24 px at 12 px — exactly at the 2.5.8 floor; the +/− expand glyph is drawn in rgb(124,140,159), the dimmest text token on the surface.
· 10 px type is used for .visual-sync-note, .field-hint and the shape-tile captions.
· Focus rings are fine: a global :focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px } is in place. Not a defect.

WHAT BREAKS AT 1280×800

· #editorPane stays a hard 500 px, so it goes from 35% to 39% of the window and the preview absorbs the entire loss (932 → 772 px).
· Six preview controls silently vanish: #actualSizeButton, #fitWidthButton, #fitPageButton, #connectModeButton, #filterButton and #focusPreviewButton. The last is "▢ Hide panel" — the only control that collapses the 500 px editor pane, removed at precisely the width where you need it most. #connectModeButton is also one of only two ways to draw a connector; with it gone, the other one (Add a connector) is collapsed and 300 px below the fold.
· #addVisualNodeButton falls 235 px below the fold.
· The block inspector (fixed, 340×610) covers 39% of the preview area, its bottom edge is 24 px from the window edge, and it hides Fit width / Fit page / Connect / Filters / Hide panel entirely.

The pane never overflows horizontally at either size — that part is solid.

======================================================================

### [CRITICAL] Selected mode is 1.09:1 against its track — the primary switch is the quietest control on the surface
TARGET: .editor-mode-button[aria-selected="true"] / .layout-switch .layout-choice[aria-pressed="true"] / .preview-layout-switch .layout-choice[aria-pressed="true"]

EVIDENCE: Sampled rendered pixels from the 1440×900 capture: .editor-mode-switch selected pill = rgb(24,36,49) on track rgb(19,28,39) → 1.09:1 contrast. The Text/Guided switch inside the same pane uses #2563eb on #0d151f → 3.55:1, and the preview's Vertical/Horizontal switch uses the same blue. So the sub-mode toggle is 3× louder than the mode toggle it lives inside. 1.09:1 fails WCAG 1.4.11 (3:1 for non-text state indicators); the only remaining cue is label colour (#f4f7fb vs #a9b7c8).

RECOMMENDATION: Give .editor-mode-button[aria-selected="true"] the same treatment the layout switch already uses: background var(--primary) (#2563eb) with colour #fff, and drop the near-invisible rgb(24,36,49) fill. Then de-escalate the two sub-switches so they do not out-shout it — change .layout-switch .layout-choice[aria-pressed="true"] and .preview-layout-switch .layout-choice[aria-pressed="true"] to the quiet filled-pill treatment (background var(--panel-alt), 1px solid var(--border-strong), colour var(--text)). Only one segmented control on screen should be blue, and it should be the one that changes what the whole pane is.

----------------------------------------------------------------------

### [CRITICAL] The primary action of step 1 is below the fold because 14 shape tiles occupy 66% of the pane
TARGET: #visualShapePalette (grid-template-columns and the 14 .visual-shape-button children) + #addVisualNodeButton

EVIDENCE: #visualShapePalette measures 184×517 px (2 columns × 89 px tiles, 7 rows) inside a pane whose visible height is 783 px. #addVisualNodeButton sits at y=1035 — 135 px below the 900 px fold at 1440×900 and 235 px below at 1280×800. Of the 20 controls visible at rest in the editor pane, 12 are shape tiles. A first-time user sees the gallery and the empty "Block label" field but not the button that commits either.

RECOMMENDATION: Cut the palette at rest to the six shapes an auditor actually uses — rect, diamond, stadium, cylinder, subroutine, parallelogram — laid out in a 3-column grid (grid-template-columns: repeat(3, 1fr)) so it is 2 rows ≈ 150 px instead of 7 rows × 517 px. Move the remaining eight behind a 7th tile reading "More shapes ▾" that opens the existing #visualNodeEditShape list as a menu. That alone lifts #addVisualNodeButton roughly 370 px, putting it above the fold at both widths. Also collapse the four near-duplicate tiles the gallery currently spends space on: "Input / output" vs "Output / input" (parallelogram/parallelogramAlt) and "Manual operation" vs "Manual input" (trapezoid/trapezoidAlt) differ only by word order and are unreadable as a pair.

----------------------------------------------------------------------

### [CRITICAL] The block inspector covers the preview toolbar it belongs to, and hides its own Done button
TARGET: #nodeInspector (top / max-height) and .node-inspector-actions

EVIDENCE: Clicked a block at 1440×900. #nodeInspector renders fixed at (726,231), 340×610. It overlaps .preview-toolbar by 340×64 px: it covers 214 of the 220 px of #zoomRange, all of #zoomValue, and clips the bottom 10 px of #verticalLayoutButton, #horizontalLayoutButton and #connectModeButton. You cannot use the zoom slider while inspecting a block. Separately, with all three of its <details> closed — its default state — the inspector's scrollHeight is 794 px against a clientHeight of 608 px, and #inspectorDoneButton computes to y=982, outside the panel box (bottom 841). doneVisible = false. At 1280×800 it covers 39% of the preview area and its bottom edge is 24 px from the window edge.

RECOMMENDATION: Two fixes. (1) Constrain the panel to the canvas, not the pane: change #nodeInspector's top from its current value to calc(<preview-toolbar bottom> + 12px) — with the current layout that is top: 300px at 1440×900 — and add a clamp so it never starts above .preview-toolbar's bottom edge. (2) Pin the action row: give .node-inspector-actions position: sticky; bottom: 0; background: var(--panel); border-top: 1px solid var(--border); padding: 10px 0; and move the overflow to a wrapper around .node-inspector-grid + the three <details> so Reset block / Sidebar settings / Done are always on screen. This is the same defect as the Clear button that sat below the fold in the Docs dialog.

----------------------------------------------------------------------

### [CRITICAL] The Visual tab stays fully lit for diagram types it cannot edit, then silently drops you into Code
TARGET: #visualModeButton (aria-disabled + disabled styling, driven from the same branch that sets el.visualModeButton.textContent)

EVIDENCE: Created a Gantt starter via #diagramTypeSelect + #newDiagramTypeButton. Result: #visualModeButton flipped to aria-selected="false", #visualModePanel became hidden, all 37 controls under #visualBuilderControls went disabled — and the tab itself rendered identically to before: no dimming, no disabled attribute, no aria-disabled. The explanation appears only as a 45-word paragraph in #visualBuilderStatus that you cannot see, because the panel it lives in is hidden. Meanwhile the preview toolbar correctly greys #verticalLayoutButton and #horizontalLayoutButton for the same diagram. Only ~3 of the 20 types in #diagramTypeSelect drive the flowchart builder.

RECOMMENDATION: When the active diagram is not flowchart/swimlane/ishikawa/sequence, set #visualModeButton to aria-disabled="true" and apply the pane's existing disabled treatment (opacity .45, cursor not-allowed) — the same one already used on #verticalLayoutButton — and put the reason in its title, e.g. "Visual builder works on flowcharts, swimlanes, fishbones and sequences. This is a Gantt — edit it in Code." Do not leave a lit tab that silently redirects.

----------------------------------------------------------------------

### [MODERATE] Two different controls on the same scroll surface both read "Connector style"
TARGET: label[for="visualEdgeType"], label[for="curve"], and remove #layoutRouting from .advanced-tool-grid

EVIDENCE: Enumerated every label[for] in #editorPane: "Connector style" resolves to two elements — #visualEdgeType (Arrow / Dotted arrow / Strong arrow / Line without arrow, at y≈1371 in the scroll surface) and #curve (Smooth / Straight / Monotone / Step before / Step after / Orthogonal, at y≈3054). They control arrowhead semantics and curve geometry respectively. A third control, #layoutRouting "Connector routing", sits 307 px below #curve and its default option reads "Use connector style" — an admission that two of the three overlap.

RECOMMENDATION: Relabel #visualEdgeType to "Arrow type" (it sets the arrowhead: -->, -.->, ==>, ---). Relabel #curve to "Line shape" and delete #layoutRouting entirely, folding its smooth/straight/orthogonal values into #curve — they are the same three options with an "inherit" wrapper around them. That leaves one control per concept: Arrow type in the builder, Line shape in settings.

----------------------------------------------------------------------

### [MODERATE] Shape is chosen in four places with identical 14-item lists; two of them are visible at once
TARGET: #visualNodeEditShape (remove) and #nodeShape (remove); wire #visualShapePalette to the current selection

EVIDENCE: #visualShapePalette (data-shape values), #visualNodeEditShape, #nodeShape and #inspectorShape all enumerate byte-identical lists: rect,rounded,diamond,circle,doublecircle,stadium,cylinder,subroutine,hexagon,parallelogram,parallelogramAlt,trapezoid,trapezoidAlt,flag. With "Edit a block" expanded, the 14-tile gallery and the 14-option "Shape" dropdown sit side by side ~180 px apart in the same card, doing the same job in two idioms.

RECOMMENDATION: Delete #visualNodeEditShape from the "Edit a block" section and make the palette do double duty: when a block is selected, #visualShapePalette reflects that block's shape as aria-pressed and clicking a tile updates it immediately. The section then reduces to Selected block / Label / Update / Delete, and the gallery gains a reason to be large. Keep #inspectorShape (it is the in-context editor) and delete #nodeShape from the Block styling group — the inspector already covers it and #inspectorMoreButton exists only to bridge the duplication.

----------------------------------------------------------------------

### [MODERATE] "Edit a block" leaves ~640 px of dead space beside the shape gallery when collapsed
TARGET: .visual-builder-grid { align-items: start } + .visual-section.is-collapsed

EVIDENCE: .visual-builder-grid is a two-column grid. On first open, section 1 ("Add a block") is expanded and measures 210×691; section 2 ("Edit a block") is is-collapsed but the grid row stretches it to 210×691 as well — an empty 210×~640 box. Sections 3–5, which sit in later rows, correctly measure 210×50 when collapsed. The result at both 1440 and 1280 is a pane that looks cramped on the left and blank on the right, in exactly the viewport region where the eye first lands.

RECOMMENDATION: Add align-items: start to .visual-builder-grid so collapsed sections shrink to their header height, and give .visual-section.is-collapsed an explicit height: auto. Better still: put "Add a block" and "Edit a block" in a single full-width section with the palette in a 3-column grid across the whole 432 px, since they are the same concept (see the shape-duplication finding).

----------------------------------------------------------------------

### [MODERATE] Guided mode is indistinguishable from Text, and its row actions are opacity: 0
TARGET: .struct-line-actions { opacity } and .struct-token[role="button"] (padding / min-height / background)

EVIDENCE: Side-by-side captures of Text and Guided show the same monospace font, the same gutter, the same line spacing — the only difference is coloured tokens with a 1 px dotted underline. Source confirms .struct-line-actions { display:flex; gap:2px; opacity:0 } with .struct-code:hover / :focus-within revealing them: 48 buttons (↑ ↓ ×, 24×32 px) across 16 rows are invisible at rest. 52 of the 100 .struct-token elements carry role="button" with measured targets as small as 9×16 px, and the clickable affordance is a 1 px dotted border of #2563eb at 55% alpha ≈ 1.7:1 against the background. Nothing on screen tells a non-coder that this view is interactive.

RECOMMENDATION: Raise .struct-line-actions to opacity: .5 at rest (keep 1 on hover/focus-within) so the controls are discoverable — the same fix applied to the Docs block tools. Replace the dotted underline on .struct-token[role="button"] with a real chip: background: color-mix(in srgb, var(--primary) 14%, transparent); border-radius: 4px; padding: 2px 5px; min-height: 24px — that also lifts the 9×16 targets to the WCAG 2.5.8 floor. And put a one-line header inside #structureEditor above #structureRows: "Click any blue chip to change it — labels, shapes and arrows."

----------------------------------------------------------------------

### [MODERATE] The connector list leads with Mermaid IDs inside the mode called "Build without code"
TARGET: #visualEdgeList row template (.visual-edge-copy — swap primary and secondary text)

EVIDENCE: With a populated flowchart, each row in #visualEdgeList renders as "A --> B" (monospace, primary line) with "State → Ministry of Finance" as the secondary line. Rows in #visualNodeList do the opposite and correctly lead with "State" then "A · Process". Same card, same list idiom, inverted information priority — and the wrong one is in the panel that exists specifically for people who do not read Mermaid.

RECOMMENDATION: Swap the two lines in the connector row builder: make the human route ("State → Ministry of Finance · \"ownership / governance\"") the primary .visual-edge-copy line and demote "A --> B" to the secondary caption, matching the block rows exactly.

----------------------------------------------------------------------

### [MODERATE] Block and connector lists are capped at 320 px, creating an inner scroll inside a 2.8-screen pane
TARGET: #visualNodeList and #visualEdgeList { max-height: 320px } — remove or raise to 60vh

EVIDENCE: #visualNodeList and #visualEdgeList both have max-height: 320px with overflow-y: auto. With a realistic diagram (10 blocks × 52 px = 574 px; 6 connectors × 54 px = 354 px) both become inner scroll regions. In the captured screenshot both lists show a row clipped mid-height at the top and another clipped at the bottom, with its Edit and × buttons half-cut — it reads as broken rendering, not as "scroll for more".

RECOMMENDATION: Remove the max-height from both lists and let them flow into the pane's single scroll (#editorScroll), which already handles 2,125 px. If a cap is required, raise it to 60vh and add a fade mask plus a visible "N more" row so the clipping reads as intentional.

----------------------------------------------------------------------

### [MODERATE] Diagram settings is 74 controls and 2,516 px behind one summary, reachable from the other side of the splitter
TARGET: #settingsSection (split into three <details>), #legendItems (hide unless #legendEnabled is checked), #styleShortcutButton

EVIDENCE: Opening #settingsSection renders 74 visible controls (24 buttons, 21 selects, 11 text inputs, 8 colour pickers, 6 checkboxes, 4 number fields) in a 2,516 px stack, taking #editorScroll to 4,694 px. Five sub-groups (Auto-layout, Typography, Block styling, Reusable style classes, Brand preset, Legend) live under one <summary> that lists five nouns. The legend's 20 controls (5 rows × checkbox + colour + shape + label) render whether or not #legendEnabled is ticked. Clicking #styleShortcutButton in the preview pane scrolls the editor pane to scrollTop 2164 — a control on the right of the splitter jumping the left side 2 km down.

RECOMMENDATION: Split #settingsSection into three sibling <details> — "Layout & spacing" (direction, numbering, engine, curve, the Auto-layout group), "Type & colour" (Typography, Block styling, Style classes, Brand preset) and "Legend" — and shorten the summary text to those three names. Gate the legend rows on the checkbox: hide #legendItems until #legendEnabled is checked, which removes 20 controls from the default state. Change #styleShortcutButton to open the relevant one of the three rather than scrolling to a 2,516 px wall.

----------------------------------------------------------------------

### [MINOR] Template picking exists twice with the same six values in two different disclosures
TARGET: .starter-library inside #quickGuideSection (remove); keep #templateSelect

EVIDENCE: #templateSelect (Advanced settings → Templates & rendering) offers generic, decision, audit, data, governance, customer plus three org examples, with an "Apply" button. #quickStarterSelect (Quick guide → Reusable starter) offers exactly the same first six values with "Copy starter" and "Use in editor". Two dropdowns, same content, ~700 px apart, three verbs for two outcomes.

RECOMMENDATION: Delete the whole .starter-library block from #quickGuideSection, including #quickStarterSelect, #copyQuickStarterButton, #useQuickStarterButton and #quickStarterPreview, and keep #templateSelect as the single entry point. If the code preview is worth keeping, move #quickStarterPreview under #templateSelect and drive it from that select.

----------------------------------------------------------------------

### [MINOR] Flow direction is settable in four places, one of them offering a meaningless option
TARGET: #direction (remove from .settings-grid in #settingsSection)

EVIDENCE: #visualDirection ("Flow direction", TD/BT/LR/RL) at y≈1636 and #direction ("Advanced direction", TD/TB/LR/RL/BT) at y≈2949 sit on the same scroll surface 1,313 px apart, plus #verticalLayoutButton/#horizontalLayoutButton in the preview and line 1 of the source. TB is a Mermaid alias for TD, so #direction's fifth option changes nothing.

RECOMMENDATION: Delete #direction and its .field-hint from the settings grid. #visualDirection already covers all four meaningful values and the Vertical/Horizontal buttons cover the two common ones; the settings duplicate adds only a synonym and a conflict.

----------------------------------------------------------------------

### [MINOR] Docs is a tab that controls nothing, and the tablist has two tab stops
TARGET: #workpapersButton (remove role="tab", move out of .editor-mode-switch into .editor-mode-history)

EVIDENCE: #workpapersButton has role="tab" but aria-controls=null and no element with a matching id exists — clicking it replaces the whole screen with a separate Workpapers view that has its own top bar and its own "← Back", and no mode switch. The roving tabindex is also incomplete: #visualModeButton tabindex="0", #codeModeButton tabindex="-1", #workpapersButton has no tabindex at all, so the group presents two tab stops instead of one. (ArrowRight navigation itself works correctly.)

RECOMMENDATION: Take Docs out of the tablist. Remove role="tab" from #workpapersButton, move it out of .editor-mode-switch, and render it beside the undo/redo pair in .editor-mode-history as a normal button — it is a destination, not a panel. That leaves a true two-tab switch (Visual | Code) that matches what the panels actually are, and lets the roving tabindex be correct by construction.

----------------------------------------------------------------------

### [MODERATE] At 1280×800 the only control that hides the 500 px editor pane disappears
TARGET: .text-action media-query hide rule — exempt #focusPreviewButton and #connectModeButton

EVIDENCE: #editorPane is a fixed 500 px at both sizes, so at 1280 it takes 39% of the window and the preview absorbs the entire loss (932 → 772 px). At exactly that width six preview controls are dropped: #actualSizeButton, #fitWidthButton, #fitPageButton, #connectModeButton, #filterButton and #focusPreviewButton. #focusPreviewButton is "▢ Hide panel" — the one control that collapses the editor pane. #connectModeButton is one of only two ways to create a connector; with it gone the alternative is the collapsed "Add a connector" section ~300 px below the fold.

RECOMMENDATION: Exempt #focusPreviewButton and #connectModeButton from the .text-action hide rule that fires below 1400 px — keep them and drop their text labels instead (icon + aria-label, as #zoomInButton already does). The four view-fit buttons can fold into a single "Fit ▾" menu rather than vanishing.

----------------------------------------------------------------------

### [MINOR] Recent shapes adds controls instead of shrinking the gallery
TARGET: #recentShapes / #visualShapePalette (collapse the full palette once recents exist)

EVIDENCE: #recentShapes is hidden until at least two distinct shapes have been used (renderRecentShapes sets hidden = list.length < 2), then inserts a "Recent" label plus N extra shape buttons directly above the 14-tile palette. After real use the user has more shape controls on screen, not fewer — the opposite of what a recency feature is for.

RECOMMENDATION: Once #recentShapes is populated, collapse #visualShapePalette behind a "More shapes ▾" disclosure so the resting state is Recent + one button rather than Recent + 14 tiles. Combined with the 6-tile default this makes the gallery earn its space instead of paying for it every session.

----------------------------------------------------------------------
