SURFACE: Preview pane and its toolbar — render controls, zoom/fit group, Vertical/Horizontal, Connect, Filters, Present, Hide panel, Style, Comments, Review, Compare, zoom slider and percentage, step indicator, and the multi-preview grid with its selection and batch bar. Tested live at http://localhost:8899 at 1440x900 and 1280x800 with a four-diagram workspace of Copilot agent workflows.

CONTROLS AT REST: 20

OVERALL IMPRESSION
The preview does not read as the star of the screen; it reads as the third band of chrome with a diagram underneath it. At 1440x900 with the default 500px editor, my eye lands on the blue "Render" pill top-right, then the blue "Vertical" pill and the blue slider fill in the toolbar, and only then on the diagram. That ordering is wrong three times over: Render duplicates behaviour that is already automatic (autoRender defaults to true), Vertical is a layout preference rather than an action, and the diagram — the thing the auditor is actually building and showing to a client — is the least promoted element in its own pane. Inside the content area the brightest element measured is the card's own title ("Diagram 3", 17.5:1), which repeats the h2 sitting 192px above it. The preview card is 1.02:1 against the pane behind it, so the "card" reads as nothing at all, and the diagram's blocks are 1.17:1 against it, carried entirely by 1px strokes.

The toolbar has two states and neither is right. Above 880px pane width it carries all 12 zoom-tools controls but always wraps to two rows (89-101px tall) — I swept editor widths from 260px to 900px and there is no split-view width at 1440x900 where the full toolbar fits one row. Below 880px it snaps to one clean row by deleting six controls outright, with no overflow menu and no indication: 100%, Fit width, Fit page, Connect, Filters and Hide panel simply cease to exist. That threshold is crossed by default at 1280x800 (pane = 772px), and at 1440x900 by dragging the resizer 60px. Ironically the narrow toolbar is the better-composed one — which tells you the wide layout is carrying about six controls too many, not that the narrow one is broken by width.

The disposable tier is chosen almost exactly backwards. What survives is four separate ways to do one thing (minus, plus, a slider, and a percentage readout, all zoom). What gets deleted is Fit page — and diagrams need it constantly: zoom is stored per diagram and never re-fitted after a content change or a pane resize, so I measured live diagrams sitting at 1.7x and 1.9x the viewport height with the remedy removed from the toolbar. Connect, a core authoring verb, goes too; so does Hide panel, which is the one control that would widen the pane and bring the others back — a self-defeating loop.

Workspace (multi-preview) mode is the weakest state. The whole zoom-tools row is ghosted to 0.42 opacity with pointer-events:none. Five of those controls are not actually disabled and their handlers work — I proved presentButton.click() opens the presentation while a real mouse click lands on .preview-toolbar instead. So Present, Filters, Hide panel and the two layout buttons are inert to the mouse, still in the tab order and still fire on Enter, and look disabled to everyone. Present's own tooltip in that state reads "Present the whole workspace as one map" — the feature is built, wired, advertised, and unclickable. At 1280x800 workspace mode spends 312px — 46% of the pane — on chrome before the first card, and 61px of that is a dead toolbar displaying "56%" zoom for a diagram that is not on screen.

The good news is that the app already knows the right answer. Toggling Hide panel calls fitToPage(), and the result is the best view in the product: one tidy toolbar row, every control present, the diagram fitted and dominant. That state should be the target for the split view, not a special mode.

======================================================================

### [CRITICAL] Present, Filters, Hide panel and both layout buttons are unclickable in workspace mode while looking merely dimmed
TARGET: CSS rule `.preview-pane.is-multi-preview .zoom-tools` (line 7515); function applyMultiPreviewMode() (line 16260-16290)

EVIDENCE: `.preview-pane.is-multi-preview .zoom-tools { opacity: 0.42; pointer-events: none; }` blankets all 12 zoom-tools children. But applyMultiPreviewMode() only sets `.disabled` on ten single-diagram controls; #presentButton, #filterButton, #focusPreviewButton, #verticalLayoutButton and #horizontalLayoutButton are deliberately left enabled. Measured in workspace mode: presentButton.disabled === false, pointerEvents === 'none', document.elementFromPoint at the button's centre returns `.preview-toolbar`, and a real click opened nothing — while a programmatic presentButton.click() DID open the presentation. All five remain focusable and fire on Enter, so keyboard users can use controls mouse users cannot. The code at line 16270 sets el.presentButton.title = 'Present the whole workspace as one map', so this is an intended, built feature. focusPreviewMode also has a dedicated multi-preview branch (line 16245-16246, toast: 'Preview focus mode on. Workspace bar stays visible so you can switch diagrams.') that can never be reached by mouse.

RECOMMENDATION: Delete the blanket `pointer-events: none` from the `.is-multi-preview .zoom-tools` rule. Ghost only what is genuinely off: hide the single-diagram zoom cluster (#zoomOutButton, #zoomInButton, #actualSizeButton, #fitWidthButton, #fitPageButton, #zoomRange, #zoomValue) with `display: none` in workspace mode rather than dimming it, since a 56% zoom readout for a diagram that is not on screen is worse than no readout. Leave #presentButton, #filterButton, #focusPreviewButton, #verticalLayoutButton and #horizontalLayoutButton at full opacity and fully clickable.

----------------------------------------------------------------------

### [CRITICAL] Six toolbar controls vanish with no overflow menu once the preview pane is 880px or narrower — the default state at 1280x800
TARGET: CSS `@container preview-pane (max-width: 880px) { .zoom-tools .text-action { display:none } }` (lines 7211-7213); `.text-action` class on #actualSizeButton, #fitWidthButton, #fitPageButton, #connectModeButton, #filterButton, #focusPreviewButton (lines 11632-11641)

EVIDENCE: `@container preview-pane (max-width: 880px) { .zoom-tools .text-action { display: none; } }` hides every control carrying `.text-action`: #actualSizeButton, #fitWidthButton, #fitPageButton, #connectModeButton, #filterButton, #focusPreviewButton. I swept editor widths at 1440x900: the six drop out the moment the pane hits 872px (editor >= 560px) and never return. At 1280x800 with the default 500px editor the pane is 772px, so they are already gone on load — measured 14 controls at rest versus 20 at 1440x900. Nothing is folded anywhere: no overflow button, no menu, no change in any remaining control. Surviving the cut are #zoomOutButton, #zoomInButton, #zoomRange and #zoomValue — four controls that all do zoom — while Fit page, the highest-value zoom command, is deleted. Partial mitigation: the command palette (Ctrl+K) harvests all `button[id]` without a visibility filter, so 'Fit page', 'Filters and lanes…' and the harvested '⇢ Connect' still run — but nothing in the UI says so.

RECOMMENDATION: Stop hiding by class and collapse by concept instead. Merge #zoomOutButton, #zoomInButton, #actualSizeButton, #fitWidthButton, #fitPageButton, #zoomRange and #zoomValue into one zoom chip: replace #zoomValue with a `#zoomChip` button that shows the live percentage, whose click runs fitToPage() and whose caret opens a small popover holding minus/plus, the slider, 100%, Fit width and Fit page. That is 7 controls down to 1 and removes the need for the breakpoint. Then drop `.text-action` from #connectModeButton, #filterButton and #focusPreviewButton so all three stay visible at every width (make #focusPreviewButton icon-only, '▢', below 900px). Target toolbar at rest: [zoom chip ▾] | [↕][↔] | [⇢ Connect] [⚑ Filters] | [▶ Present] [▢] | ◀ 3/7 ▶ — 11 controls, one row, at any pane width down to ~700px.

----------------------------------------------------------------------

### [CRITICAL] The diagram never re-fits after a content change or a pane resize, so diagrams routinely sit 1.7-1.9x taller than the viewport
TARGET: function fitToPage() (line 54440); function renderDiagram(); add a ResizeObserver on #zoomViewport

EVIDENCE: fitToPage() is called on focus-mode toggle (line 16250-16253), on mobile (line 54553) and in one walkthrough reset (line 54136) — never on render and never on resize. Measured at 1440x900, pane 932px, viewport clientHeight 605px: Diagram 3 sat at 100% zoom with scrollHeight 1026 (1.70x overflow) showing 3 of its 7 blocks. Pasting a 15-step flowchart into a diagram left at 56% produced scrollHeight 1148 (1.90x) with no re-fit. Dragging the resizer across seven widths from 1172px down to 932px left zoom pinned at 35% throughout. Compounding it, the remedy — #fitPageButton — is one of the six controls deleted at pane widths <= 880px, so at 1280x800 the diagram overflows and the one-click fix is absent from the toolbar.

RECOMMENDATION: Call fitToPage() after any render where baseSvgWidth/baseSvgHeight changed from the previous render for that diagram, and on a debounced resize of #zoomViewport (a ResizeObserver at ~150ms). Preserve the existing per-diagram stored zoom when the user has set it explicitly — gate the auto-fit on a flag set by setZoom() from #zoomRange, #zoomInButton, #zoomOutButton and #actualSizeButton, so a deliberate zoom is never overridden but an untouched diagram always arrives fitted.

----------------------------------------------------------------------

### [MODERATE] The Filters panel lands in the top-left corner of the window when its anchor button is hidden
TARGET: function positionFilterPanel() (lines 20452-20466)

EVIDENCE: positionFilterPanel() reads `el.filterButton.getBoundingClientRect()` (line 20454). When #filterButton is hidden by the 880px container query that rect is {x:0,y:0,w:0,h:0}, so left = 0 - 330 = -330, clamped to the 10px margin, and top = 0 + 8. Measured at 1280x800 after running 'Filters and lanes…' from the command palette: panel rendered at x=10, y=14, 330x294 — floating over the T-INDUSTRIES logo, the app header and the Diagram 1-4 tabs, on the opposite side of the screen from the preview it controls. Screenshot confirms it covers the brand lockup and the diagram tab strip.

RECOMMENDATION: Guard the anchor in positionFilterPanel(): `const btn = el.filterButton.getBoundingClientRect(); const anchor = btn.width ? btn : el.previewPane.getBoundingClientRect();` and when falling back, position the panel against the preview pane's top-right (left = paneRect.right - panel.width - 10, top = paneRect.top + 8). Fixing the previous finding so #filterButton never hides makes this defensive, but the guard should exist regardless.

----------------------------------------------------------------------

### [MODERATE] The preview toolbar is two rows tall at every split-view width — it can only reach one row by deleting controls
TARGET: `.zoom-tools` (line 3881); `.preview-pane .pane-header` / `.pane-heading-text` (line 11610-11617)

EVIDENCE: Measured .preview-toolbar height across editor widths at 1440x900: 260px editor / 1172px pane = 89px; 380-500px editor / 1052-932px pane = 101px; 560-900px editor / 872-532px pane = 61px but with six controls deleted. Only focus mode (pane = 1440px) yields 61px with all controls present. So there is no split-view configuration at 1440x900 that shows the complete toolbar in one row. The pane header adds another 77px, giving 178px — 23% of the pane's 783px height — of chrome before any diagram. Non-monotonic reflow along the way (101 -> 61 -> 84 -> 89 -> 101 px as the editor widens) makes the toolbar visibly jump while dragging the resizer.

RECOMMENDATION: The zoom-chip merge in finding 2 removes six controls from `.zoom-tools` and brings the row under one line at ~700px pane width, which resolves this. Additionally collapse the pane header: put the `.eyebrow` ('Preview') and the h2 #previewHeading on one line and move #status into the toolbar row as a small inline status, reclaiming roughly 24px.

----------------------------------------------------------------------

### [MODERATE] Workspace mode spends 46% of the preview pane on chrome before the first card, 61px of it a dead toolbar
TARGET: `.preview-pane.is-multi-preview .zoom-tools` (line 7515); `.multi-preview-bar` (line 7277) and its children #multiPreviewSort, #multiPreviewGroupBy, #multiPreviewFolderFilter, #multiPreviewColumns (lines 11792-11821)

EVIDENCE: Measured at 1280x800 in workspace mode: pane top 117px, pane header 77px, ghosted zoom toolbar 61px, multi-preview bar 146px (wrapping to 3 rows) — 312px from the top of the pane to the top of the first card, 46% of pane height. Of the 21 chrome controls present, 9 are dead. The dead strip displays a '56%' zoom readout and a slider for a diagram that is not on screen. Only 2 of 4 cards are above the fold.

RECOMMENDATION: Hide `.zoom-tools` entirely with `display: none` under `.preview-pane.is-multi-preview` (keeping #presentButton and #focusPreviewButton by moving them out of `.zoom-tools` into a small persistent group in the toolbar). Fold #multiPreviewSort, #multiPreviewGroupBy, #multiPreviewFolderFilter and #multiPreviewColumns behind a single 'View ▾' menu button next to #multiPreviewSearch, matching the '＋ Add block ▾' pattern from the Docs rebuild. That takes the bar from 10 controls to 4 and from 146px to one 44px row.

----------------------------------------------------------------------

### [MODERATE] The batch action bar occupies permanent space with three disabled buttons and a folder picker when nothing is selected
TARGET: `.multi-preview-batch` (line 7294) and its container div (line 11824-11831); the toggle() calls in the selection updater (lines 16571-16574)

EVIDENCE: `.multi-preview-batch` is never hidden. In workspace mode with no selection I measured #workspaceMoveFolderSelect (enabled, 150px wide), #workspaceMoveButton (disabled), #workspaceCompareButton (disabled) and #workspaceDeleteButton (disabled, styled danger red) all rendered at y=362 in the bar. #multiPreviewSelectionCount is correctly hidden when empty, which shows the selection-aware pattern already exists — it just is not applied to the batch group. A permanently visible red Delete that does nothing is the same defect the Docs rebuild removed by folding Export/Import/Duplicate/Delete into '⋯'.

RECOMMENDATION: Hide `.multi-preview-batch` whenever no cards are ticked, in the same code that already toggles #multiPreviewSelectionCount, and reveal it as a selection bar with the count ('3 selected · Move to ▾ · Compare · Delete'). This removes 4 controls from the resting state.

----------------------------------------------------------------------

### [MODERATE] The step walkthrough computes each block's name and then hides it at every reachable pane width
TARGET: `@container preview-pane (max-width: 1220px)` block (lines 7203-7210); `.preview-step-indicator` max-width (line 7140)

EVIDENCE: #previewStepLabel is populated correctly ('Bank detail changed?') and the aria-label is exemplary ('Block 3 of 7: Bank detail changed?. Click to show the whole diagram.'), but `@container preview-pane (max-width: 1220px) { .preview-step-text, .preview-step-label { display: none } }` hides it. The pane maxes out at 1172px in split view at 1440x900, so the name is never visible to sighted users outside focus mode; measured getComputedStyle(#previewStepLabel).display === 'none' at the default 932px pane. The Previous/Next captions are hidden by the same rule, leaving bare '◀' and '▶' in 34px buttons. Net result: 141px of toolbar delivering '◀ 3/7 ▶'. Separately, stepping re-zooms erratically — I measured 145% -> 185% -> 85% across three consecutive Next presses — and silently discards the zoom the user had set.

RECOMMENDATION: Lower the label threshold to `@container preview-pane (max-width: 900px)` and let #previewStepIndicator use its existing `max-width: 230px` with the label ellipsised, so the block name shows at the default split. Keep `.preview-step-text` hidden (the arrows are unambiguous). For the zoom jumps, clamp the per-step zoom to a narrower band (e.g. 0.75x-1.5x of the overview fit zoom) so successive steps do not swing 100 percentage points, and restore the pre-walkthrough zoom when the user clicks #previewStepIndicator to return to Overview.

----------------------------------------------------------------------

### [MODERATE] The Present button's tooltip is wrong in single-diagram mode on every page load
TARGET: function applyMultiPreviewMode(), line 16270

EVIDENCE: applyMultiPreviewMode() line 16270 runs `if (el.presentButton) el.presentButton.title = 'Present the whole workspace as one map';` with no else branch, and the function is called unconditionally at init (line 13953). Measured in single-diagram mode on a normal load: presentButton.title === 'Present the whole workspace as one map', overriding the authored markup value 'Full-screen step-by-step walkthrough'. In single-diagram mode the button presents the active diagram step by step, not the workspace.

RECOMMENDATION: Make it conditional: `el.presentButton.title = state.multiPreview ? 'Present the whole workspace as one map' : 'Full-screen step-by-step walkthrough';`

----------------------------------------------------------------------

### [MODERATE] Render is the loudest control in the preview pane but duplicates behaviour that is already automatic
TARGET: class on #renderPreviewButton (line 11620) and #presentButton (line 11640)

EVIDENCE: #renderPreviewButton is `btn compact` — the only filled primary in the pane header, white on rgb(37,99,235) — while #presentButton is `btn secondary compact` on rgb(36,50,68), visually identical in weight to #zoomOutButton and #zoomInButton. But state.autoRender defaults to true (line 13756) with a debounce, so the preview re-renders on source change without it; render status is already reported twice elsewhere (#renderStateChip 'Preview pending / Preview current' in the app header, and #status in the pane header), and Render is also reachable via Ctrl+Enter, #popoutRenderButton, #mobileRenderButton and the command palette. Present, by contrast, is the auditor's client-facing action and has no equal-weight alternative.

RECOMMENDATION: Demote #renderPreviewButton to `btn ghost compact` and promote #presentButton to `btn compact` (primary). This is a hierarchy correction, not a removal — Render stays as the recovery path when a render errors or autoRender is off.

----------------------------------------------------------------------

### [MINOR] The zoom slider is 16px tall, below the 24px minimum target size
TARGET: `.zoom-range` (line 3882)

EVIDENCE: Measured #zoomRange at 1440x900: 220x16px; at 1280x800: 144x16px. WCAG 2.2 SC 2.5.8 (Target Size, Minimum, AA) requires 24x24 CSS px. `@media (pointer: coarse)` already raises `.preview-toolbar input[type=range]` to 44px (line 8816), so only fine-pointer use is affected. Every other toolbar control measures 32-34px and passes.

RECOMMENDATION: Add `min-height: 24px;` to `.zoom-range` (or give the input a 24px-tall transparent hit area with a thinner painted track). If the zoom-chip merge in finding 2 is adopted the slider moves into a popover, where it should still be built at 24px.

----------------------------------------------------------------------

### [MINOR] The multi-preview card selection checkbox is a 15x15 target
TARGET: `.multi-preview-tick` and the card header markup generated by renderWorkspacePreviews()

EVIDENCE: Measured `.multi-preview-tick` at 15x15px with no wrapping <label>, so the hit area is the box alone — 39% of the 24x24 required by WCAG 2.2 SC 2.5.8. Its aria-label is correct and specific ('Select Diagram 1'). This is the sole entry point to the batch bar's Move / Compare / Delete actions.

RECOMMENDATION: Wrap the input in a `<label>` with `display:inline-flex; min-width:24px; min-height:24px; align-items:center; justify-content:center;` so the padded label carries the hit area while the box keeps its 15px visual size.

----------------------------------------------------------------------

### [MINOR] The zoom slider is linear across 5-800%, compressing the working range into the first fifth of the track
TARGET: #zoomRange min/max attributes (line 11643) and the setZoom()/input handler pair

EVIDENCE: #zoomRange is min=5 max=800 step=5. Computing thumb positions: 25% sits at 2.5% of the track, 50% at 5.7%, 100% at 11.9%, 200% at 24.5%. The entire 25-200% band an auditor actually uses occupies 22% of the track — 48px of the 220px slider at 1440x900, and 32px of 144px at 1280x800. Moving from 100% to 125% is a ~3px drag. Meanwhile 400-800%, which is not usable for reviewing a flowchart, gets half the track.

RECOMMENDATION: Either narrow the range to min=25 max=400 (keeping the existing minus/plus and Fit buttons for the extremes), or keep the range and make the slider logarithmic by mapping the input's 0-100 position through `zoom = 5 * Math.pow(160, pos/100)` on input and the inverse when writing the value back.

----------------------------------------------------------------------

### [MINOR] The preview card is indistinguishable from the pane behind it, so the diagram has no visual container
TARGET: `.preview-card` background-color and border-color

EVIDENCE: Measured `.preview-card` background rgb(12,18,26) against `.preview-pane` background rgb(10,15,22): contrast ratio 1.02:1. Only the 1px border rgb(44,58,75) separates them. Inside the card the diagram's node fill rgb(23,34,48) is 1.17:1 against the card, so blocks are defined entirely by their 1px stroke (5.05:1 against their own fill). Node label text is excellent at 14.94:1, and the card's h3 title is 17.5:1 at 18px — meaning the brightest element in the content area is the title, not the diagram. This is the measurable basis for the preview not reading as the star.

RECOMMENDATION: Lift `.preview-card` background to roughly rgb(18,26,37) (about 1.5:1 against the pane) and strengthen its border to rgb(58,74,94), so the diagram sits on a surface that reads as paper. Do not restyle the Mermaid node fills — that is theme territory — but the container should give the content somewhere to sit.

----------------------------------------------------------------------

### [MINOR] The diagram title is rendered twice in the pane, 192px apart
TARGET: h2#previewHeading (line 11614) and `.pane-heading-text` (line 11612)

EVIDENCE: Measured 'Diagram 4' at y=144 in the pane header (h2#previewHeading, 16px) and again at y=336 inside the card (h3#diagramTitlePreview, 18px). #diagramTitlePreview is genuinely justified — the print stylesheet (line 9990-9992) hides the pane header and keeps `.preview-card`, so the h3 is the printed/PDF title, and fitToPage() measures its height (line 54275). So the redundancy is on screen only.

RECOMMENDATION: Keep #diagramTitlePreview untouched (it is load-bearing for print and fit maths) and make the pane header stop repeating it: collapse `.pane-heading-text` to one line where the `.eyebrow` reads 'Preview' and #previewHeading carries the mode rather than the name — 'Diagram' in single mode, 'Workspace · 4 diagrams' in multi. Keeps the accessible section name while removing the on-screen echo and ~24px of height.

----------------------------------------------------------------------
