SURFACE: Present — the Map and the per-diagram walkthrough (`#presentOverlay`: `#mapLayer`, `#presentBar`, `#presentSidebar`, `.present-stage-shell`), tested at 1440×900 and 1280×800 in a workspace of four Copilot-agent flowcharts plus a 5-stop route.

CONTROLS AT REST: 65

OVERALL IMPRESSION
The camera is the best thing in this application. When the walkthrough frames a single decision block, the diamond fills the stage with a soft glow and the label renders around 40px — it reads from the back of a meeting room, and the logarithmic zoom interpolation in `mapFlyTo` means it glides rather than lurches. That part is finished work.

Everything wrapped around it is still the authoring tool. Counting what is on screen at rest in the walkthrough: 14 controls in the top bar (which wraps onto two rows at 1440 and again at 1280 — it has never fitted on one line) and 51 in the Studio sidebar, so **65 pieces of chrome are facing the client**. Docs went from 27 to 16. Of the sidebar's 51, 52 controls sit inside one panel — "Navigator & sequence" — where each row gives 79px to the step name and 140px to four editing buttons (move up, move down, repeat, delete). The presenter's own notes get a 277×94px box, and at 1280×800 a quarter of it is below the fold along with four of the seven panels, including "Playback & live tools", which is where the laser pointer, spotlight, pen and Clear drawings live. The tools a presenter needs live are the ones you cannot see.

The Map is quieter — 10 visible controls — but it fails at the first job. Tile titles are declared at 34px in plane coordinates and the whole-map camera scales the plane by 0.1527, so they render at **5.19px**. In my first screenshot I could not read a single diagram name. The only affordance that a tile can be opened (`.map-tile-open`, "▶ Present") is `opacity: 0` until hover, and the one hint that teaches the interaction auto-dismisses after 5.2 seconds and never comes back.

Then there are three things a client would actually notice. The tile, the top bar and the big opening title card all read **"Flowchart Preview"** — a stale internal placeholder — while the deck list in the same sidebar correctly says "AP invoice agent". The opening card also announces **"Diagram 2 of 2"** on a map that plainly shows four tiles and five route stops. And underneath the card, in 14px muted grey, it says "12 blocks · 13 connectors" — an authoring statistic on the slide that introduces the workflow.

Colour contrast, for the record, is not a problem: everything I measured lands between 8.15:1 and 19.53:1. The accessibility failures here are structural. `#presentOverlay` has no `role`, no `aria-modal` and no focus trap; `#workspace` is neither `inert` nor `aria-hidden`. While presenting, 257 elements are tab-reachable and **155 of them belong to the editor hidden behind the overlay** — including `#removeDiagramButton`. Focus at rest is not even inside the presentation; it sits on `#zoomViewport` in the editor.

Judged as a client-facing surface: the audience sees a wrong title, a wrong count, an authoring statistic, four route chips with hidden delete buttons, and 65 controls. And the presenter is missing the two things they need most — a legible map and their notes.

======================================================================

### [CRITICAL] Present mode is not modal: 155 editor controls stay tab-reachable behind the overlay
TARGET: #presentOverlay / #workspace / openPresentation() ~line 47782

EVIDENCE: `#presentOverlay` has `role=null`, `aria-modal=null`, `z-index:1260`, and no focus trap; `#workspace` has `inert=false`, `aria-hidden=null`. Enumerating focusable, visible elements during a walkthrough returns **257 total, 102 in the overlay, 155 outside it**. `document.activeElement` at rest is `#zoomViewport` — an element of the editor, not the presentation. Tab order therefore runs: skip link → theme menu → Export → the four diagram tabs → `#removeDiagramButton` → the entire style panel → … and only reaches `#presentMapButton` after 155 stops. A presenter who presses Tab and then Enter can fire 'Remove diagram' in front of a client, seeing nothing. A screen-reader user in Present mode is read the editor.

RECOMMENDATION: On `openPresentation()` (line ~47782, where `el.presentOverlay.hidden = false` is set): add `el.presentOverlay.setAttribute('role','dialog')`, `setAttribute('aria-modal','true')`, `setAttribute('aria-label','Presentation')`, set `document.getElementById('workspace').inert = true`, and move focus with `el.presentStageShell.focus()`. Reverse all four in `closePresentation()`. `inert` alone removes all 155 stray tab stops and hides the editor from assistive tech without touching layout.

----------------------------------------------------------------------

### [CRITICAL] The client-facing title is a stale placeholder: tile, bar and opening card all read "Flowchart Preview"
TARGET: line 50147 (.map-tile-label), line 48235 (#presentSectionTitle), line 48254 (#presentTitle)

EVIDENCE: Line 50147: `label.textContent = diagram.diagramTitle || diagram.name;` — the map tile prefers the internal render title over the name the auditor typed. The same precedence is repeated at line 48235 (`#presentSectionTitle`) and 48254 (`#presentTitle`). In my workspace the diagram is named 'AP invoice agent'; the tile label, the top-bar title and the full-screen opening card all say **'Flowchart Preview'**, and so does the audience-window header (`broadcastPresentationState` sends `el.presentTitle.textContent`). Inside the very same tile, `img.map-tile-image` has `alt="AP invoice agent"` — the visible label and the alt text of one element disagree. The Workspace-deck list in the sidebar also renders '1. AP invoice agent' correctly, so two panels on one screen contradict each other.

RECOMMENDATION: Invert the precedence everywhere the audience can see it: `diagram.name || diagram.diagramTitle` at lines 50147, 48235 and 48254. `diagramTitle` is the caption baked into the rendered SVG and defaults to 'Flowchart Preview'; the diagram *name* is what the auditor deliberately set and what every other surface shows.

----------------------------------------------------------------------

### [CRITICAL] Opening card announces "Diagram 2 of 2" over a map showing four tiles and five stops
TARGET: mapEnterDiagram(), line 50473

EVIDENCE: `#presentSectionKind` and `#presentDeckPosition` both read 'Diagram 2 of 2' after clicking the first tile on a map with 4 tiles and a 5-stop route strip. Cause: `mapEnterDiagram` line 50473 — `if (!presentDeckIds.includes(diagramId)) presentDeckIds = state.diagrams.map(d => d.id);` — only rebuilds the deck when the clicked diagram is *absent*. `openPresentation()` (47758-47761) had already seeded a 2-entry deck from a stale `state.presentationDeck`, so entering via the Map inherits it. The number is wrong on the single largest element on the opening slide.

RECOMMENDATION: In `mapEnterDiagram` (line 50473) drop the conditional and always align the deck with what the Map is showing: `presentDeckIds = state.map.route.filter(v => v.target.diagramId).map(v => v.target.diagramId).filter((id,i,a) => a.indexOf(id)===i);` falling back to `state.diagrams.map(d => d.id)` when the route holds no diagram stops. Entering from the Map should never disagree with the Map.

----------------------------------------------------------------------

### [CRITICAL] Map tile titles render at 5.19px — the client cannot read what any tile is
TARGET: .map-tile-label (line 9306) + applyMapCamera() (line 9728)

EVIDENCE: `.map-tile-label { font-size: 34px }` (line 9308) lives inside `#mapPlane`, which `applyMapCamera()` (line 9731) scales by `mapCamera.scale`. At the default whole-map framing the plane transform is `matrix(0.152646, …)`, giving an **effective 5.19px** and a measured line box of 13.6px tall. Contrast is fine (8.15:1) — the text is simply too small to resolve. In the first screenshot of the Map none of the four diagram names was legible.

RECOMMENDATION: Counter-scale the label so it is sized in screen space. In `applyMapCamera()` add `el.mapPlane.style.setProperty('--map-scale', mapCamera.scale)`, then change `.map-tile-label` (line 9306) to `font-size: calc(clamp(14px, 34px * var(--map-scale,1), 34px) / var(--map-scale,1));` and add `transform-origin: left top;`. Titles then hold a 14px floor when pulled back and grow to 34px on fly-in.

----------------------------------------------------------------------

### [CRITICAL] Top bar carries 14 controls and has never fitted on one row
TARGET: .present-actions (line 9567) / #presentBar (line 12584)

EVIDENCE: `.present-actions { flex-wrap: wrap }` (line 9572). At **1440×900** the bar is 2 rows (9 controls at y=9, 5 at y=47) and `#presentResumeButton` ends at x=1428 of 1440. At **1280×800** it is still 2 rows, 89px tall, with `#presentAllButton` ending at x=1268 of 1280 — 12px of margin. Of the 14: three are `<select>` at `font-size: 11px` (line 9580), one (`#presentResumeButton`) is disabled at `opacity:.45` in the default state, and `◀ Previous` / `Next ▶` — the only two controls the presenter uses on 95% of steps — sit in the middle of row one styled identically to `Camera · Block`.

RECOMMENDATION: Reduce `#presentBar .present-actions` to six: `⌂ Map`, `◀ Previous`, `Next ▶`, `☰ Studio`, `◐ Dim`, `Exit`. Fold `#presentCameraMode`, `#presentTransition`, `#presentDecisionMode`, `#presentAllButton`, `#presentAutoFocusButton`, `#presentResumeButton`, `#presentAutoplayButton`, `#presentAudienceButton` into one `⋯` menu button — the same move that took Docs' nine ＋block buttons to one. Give `#presentPrevButton`/`#presentNextButton` `min-height:40px` and their own group with a separator, and remove `flex-wrap: wrap` so a regression back to two rows is visible immediately.

----------------------------------------------------------------------

### [MODERATE] At 1280×800 the mini-map steals 64px of the decision prompt's escape-hatch button
TARGET: .present-minimap (line 9851), .present-decision-prompt (line 9786), .present-checkpoint-card (line 9957)

EVIDENCE: `.present-minimap` is `z-index:45` (line 9853); `.present-decision-prompt` is `z-index:42` (line 9788). At 1280×800 the prompt occupies x 445-1165 / y 643-776 and the mini-map x 1086-1266 / y 674-786 — an overlap of **79 × 102 px**. `#presentDecisionContinueButton` ('Continue sequence instead') runs x 970-1150; 64 of its 180px are covered. `document.elementFromPoint(1120, 746)` returns `#presentMiniMap`: a click that visually lands on the button moves the camera instead. No overlap at 1440×900 (prompt ends x=1080, mini-map starts x=1246), so this appears only at the narrower size.

RECOMMENDATION: Two lines. Raise the prompts above the mini-map: `.present-decision-prompt { z-index: 60 }` (line 9788) and `.present-checkpoint-card { z-index: 60 }` (line 9957 — currently 24, which also puts it under `.present-annotation-canvas` at 35, so pen strokes paint over it). Then hide the mini-map while a prompt is up: `.present-stage-shell:has(#presentDecisionPrompt:not([hidden])) .present-minimap, .present-stage-shell:has(#presentCheckpointCard:not([hidden])) .present-minimap { display: none; }`.

----------------------------------------------------------------------

### [MODERATE] Two different branch choosers for one action, and which one appears depends on the sidebar
TARGET: #presentBranchPanel (line 12629) / #presentDecisionPrompt (line 12716) / promptPresentationBranchChoice() line 48303

EVIDENCE: At a decision block with the Studio open, the chooser renders only in `#presentBranchPanel` — a 277px amber panel at x=21 in the sidebar — and `#presentDecisionPrompt` stays `hidden:true`, so the client-facing stage shows nothing. With the sidebar collapsed, `Next ▶` relabels to 'Choose path ▶' and a second click opens the on-stage `#presentDecisionPrompt` (720×133, centred). At 1280×800 with the sidebar open, both are on screen at once offering the same two choices. The purpose-built, legible, audience-facing card is the one that gets suppressed.

RECOMMENDATION: Make `#presentDecisionPrompt` the single chooser: show it whenever `presentPendingBranch` is true or `needsBranchChoice` is true, regardless of `#presentBody.sidebar-collapsed`. Delete `#presentBranchPanel` (lines 12629-12636) and keep only `#presentReturnDecisionButton`, moving it into `.present-decision-prompt-actions`. One decision, one card, on the stage where the client is looking.

----------------------------------------------------------------------

### [MODERATE] The map camera does not reserve room for its own chrome; the bar and route strip sit on the tiles
TARGET: mapViewport() line 9710, applyMapCamera() line 9728, .map-bar line 9366

EVIDENCE: `mapViewport()` (line 9710) returns the full `#mapLayer` box and `mapCameraForRect` fits the plane to it, but `.map-bar` is `bottom:104px` (line 9369) and `.map-route` is `bottom:0` with a 51px height (line 9391) — 155px of chrome the fit ignores. At 1440×900 the floating bar overlaps the 'Agent inventory & DPIA' tile by **244 × 50 px**. At 1280×800 the same bar overlap persists *and* the route strip (top y=749) covers the bottom **61px** of that tile, whose box runs to y=810. The tile the presenter is about to open is the one partly hidden.

RECOMMENDATION: Have `mapViewport()` subtract the chrome: `const bar = el.mapBar?.offsetHeight || 0, route = el.mapRoute?.offsetHeight || 0; return { w: Math.max(320, box.width), h: Math.max(240, box.height - route - bar - 32) };` and offset the vertical centre in `applyMapCamera()` by `-(route + bar + 32)/2` so the fit is centred in the free area rather than the whole window.

----------------------------------------------------------------------

### [MODERATE] The Studio sidebar buries the live presenting tools below the fold behind 52 editing controls
TARGET: #presentSidebar (line 12624), #presentNotes (line 12658), 'Playback & live tools' panel (line 12690)

EVIDENCE: `#presentSidebar` is 811px tall at 1440×900 with 1224px of content (711 / 1184 at 1280×800). Three panels are open by default; 'Navigator & sequence' alone holds **52 of the sidebar's 51 visible controls** and runs y=203→711. Panel start positions at 1440×900: Saved branch scenarios y=1112, Chapters y=1162, Workspace deck y=1212, **Playback & live tools y=1262** — four of seven panels begin more than 200px below the fold, and the last one contains the laser pointer, spotlight, pen, arrow, Clear drawings, Snapshot and Record. `#presentNotes` is 277×94px at y=771; at 1280×800 only 70 of its 94px are visible and the Owner / Seconds / Source / checkpoint fields are entirely off-screen. This is the Docs 'Clear button below the fold of a dialog that never constrained its height' defect, at seven times the scale.

RECOMMENDATION: Reorder `#presentSidebar` (line 12624) for the live task: `Current step`, `Presenter notes` (open, `#presentNotes` raised to `min-height:180px`), `Playback & live tools` (open), then `Navigator & sequence` (closed by default), then Scenarios / Chapters / Deck. Move the four per-row editing buttons out of the always-visible list (see next finding) and the Navigator collapses to a readable jump list.

----------------------------------------------------------------------

### [MODERATE] Sequence rows give 79px to the step name and 140px to four editing buttons
TARGET: .present-sequence-item / .present-sequence-buttons / #presentSequenceList (line 12651)

EVIDENCE: Measured on `.present-sequence-item` (265px wide): `.present-sequence-index` 20px, `.present-sequence-copy` **79px**, `.present-sequence-buttons` **140px**. Editing chrome takes 53% of the row and the content 30%, so 'Invoice arrives in shared mailbox' renders as 'Invoice arrives…'. Seven rows × 4 buttons = 28 icon buttons in the presenter's navigator. None of the four (`↑ ↓ ⧉ ×`) is usable during a live presentation, and they have `title` but **no `aria-label`**, so a screen reader announces the raw glyphs.

RECOMMENDATION: Hide the per-row buttons unless the row is hovered/focused *and* an explicit 'Edit sequence' mode is on: `.present-sequence-buttons { display:none }` with `.present-sequence-item:hover .present-sequence-buttons, #presentSequenceList.is-editing .present-sequence-buttons { display:flex }`, and add an `＋ Edit sequence` toggle next to `#presentResetSequenceButton`. Add `aria-label="Move up" / "Move down" / "Repeat step" / "Remove from presentation"` to the four buttons where they are created. The label then gets ~219px and reads.

----------------------------------------------------------------------

### [MODERATE] Route chips carry an invisible 13×16px destructive delete
TARGET: .map-route-drop / .map-route-item

EVIDENCE: Each `.map-route-item` is 30px tall and contains `.map-route-drop` ('×') at **`opacity: 0`**, 13 × 16px, revealed only on hover. It removes a stop from the presentation route. Five of these sit along the bottom edge of a client-facing screen. This is the same defect the Docs critique named — 'the block tools were transparent ghost buttons over a border'. WCAG 2.2 target-size minimum is 24×24px; this is 13×16 and invisible.

RECOMMENDATION: Remove `.map-route-drop` from the chip entirely and make chip removal a right-click / long-press context action, or move it behind the existing `#mapMoreButton` (⋯) as 'Remove this stop'. If it must stay inline, make it `opacity:.55` at rest, `min-width:24px; min-height:24px`, with `aria-label="Remove <name> from the route"` — and confirm before deleting, since there is no undo.

----------------------------------------------------------------------

### [MODERATE] Map tiles are not keyboard reachable and carry no visible affordance at rest
TARGET: mapEnsureTile() line 50138, .map-tile-open line 9249, mapOpen() lines 50509-50510

EVIDENCE: `mapEnsureTile` (line 50138) creates `<div class="map-tile">` with no `role`, no `tabindex` and no `aria-label`; the click handler is on the div. The only affordance, `.map-tile-open` ('▶ Present'), is `opacity: 0` (line 9259) until `.map-tile:hover`. The single hint that teaches this — 'Click any diagram to present it. → moves along the route.' — is set at line 50509 and cleared by `setTimeout(…, 5200)` at line 50510, never to return. So a keyboard user cannot open any diagram except the current route stop (via Enter in `mapHandleKey`), and a mouse user who arrives after 5 seconds has nothing on screen telling them tiles are clickable.

RECOMMENDATION: In `mapEnsureTile` set `host.tabIndex = 0`, `host.setAttribute('role','button')`, `host.setAttribute('aria-label', 'Present ' + diagram.name)` and add a `keydown` handler for Enter/Space mirroring the click. Add `.map-tile:focus-visible { outline: 3px solid var(--primary); outline-offset: 4px }` and `.map-tile:focus-visible .map-tile-open { opacity: 1 }`. Replace the 5.2s toast with a persistent one-line footnote in `#mapBar` ('Click a diagram to present it · → next stop'), or leave `.map-tile-open` at `opacity:.35` at rest.

----------------------------------------------------------------------

### [MODERATE] '↺ Resume' and '◎ Auto camera' are one concept split into two controls, one of them dead at rest
TARGET: #presentResumeButton (line 12615), updatePresentationControls() line 48282

EVIDENCE: `updatePresentationControls` line 48282: `el.presentResumeButton.disabled = presentAutoFocus;`. Since `presentAutoFocus` starts `true`, `#presentResumeButton` is disabled at `opacity:.45` in the default state of every presentation — a permanently greyed-out button occupying one of the 14 slots on the client-facing bar until the presenter manually pans. And 'resume automatic framing' is exactly what pressing `◎ Auto camera` back on does. Same pattern as Docs' status dropdown plus Sign-off button.

RECOMMENDATION: Delete `#presentResumeButton` (line 12615) and its handler. Make `#presentAutoFocusButton` the single state chip: label it `◎ Auto camera` when `presentAutoFocus` is true and `◎ Camera held · resume` when false, with `aria-pressed` tracking the state. One control, one concept, never dead.

----------------------------------------------------------------------

### [MODERATE] '▣ Audience' is one-way — the presenter cannot close the audience screen
TARGET: #presentAudienceButton (line 12617), line 14672, openPresentationAudienceWindow() line 49489

EVIDENCE: Line 14672: `el.presentAudienceButton.addEventListener('click', openPresentationAudienceWindow);`. `openPresentationAudienceWindow` (line 49489) begins `if (presentAudienceWindow && !presentAudienceWindow.closed) { focus(); broadcast(); return; }` — pressing the button again only re-focuses the popup. `closePresentationAudienceWindow` exists but is never wired to the button, and `#presentAudienceButton` carries no `aria-pressed` and no state label. Mid-presentation there is no way to blank the client screen for a private aside. The popup is also opened at a fixed `width=1280,height=800` with no way to fullscreen it onto a projector.

RECOMMENDATION: Make the button a toggle: `if (presentAudienceWindow && !presentAudienceWindow.closed) closePresentationAudienceWindow(); else openPresentationAudienceWindow();`, set `aria-pressed` and swap the label to `▣ Audience on`. Inside the popup HTML (line 49495) add a `documentElement.requestFullscreen()` call bound to a double-click on `#stage`, and add `left=0,top=0` plus `screen.availWidth/Height` sizing so it lands usefully on a second display.

----------------------------------------------------------------------

### [MODERATE] Checkpoint card puts the redundant information at 21px and the actual question at 14px muted
TARGET: .present-checkpoint-card (line 9957), #presentCheckpointTitle, #presentCheckpointPrompt

EVIDENCE: On the checkpoint card, `#presentCheckpointTitle` is the block label ('Confidence above 0.85?') at **21px, #f4f7fb** — text the audience can already read on the diagram behind. `#presentCheckpointPrompt`, the presenter's actual question ('Does this match the control owner you interviewed?'), is **14px, #a9b7c8**. The card background is `color(srgb 0.502 0.352 0.091 / 0.234)` with `backdrop-filter: blur(18px)` — 23% alpha, so contrast is not deterministic; it varies with whatever diagram is behind. Meanwhile `#presentBranchPanel` in the sidebar was still showing the branch chooser underneath, so two prompts were live at once.

RECOMMENDATION: Swap the type scale on `.present-checkpoint-card`: `h2` (line 9959) down to 15px `var(--muted)` and `p` (line 9960) up to `clamp(20px, 2.2vw, 28px)` with `color: var(--text)`. Raise the background alpha to at least 92% (`background: color-mix(in srgb, var(--panel-elevated) 94%, transparent)` already used by `.map-panel`) so the contrast is a fixed, testable number. Hide `#presentBranchPanel` whenever `#presentCheckpointCard` is visible.

----------------------------------------------------------------------

### [MODERATE] Wide (LR) diagrams collapse to a 73px sliver on the Map
TARGET: MAP_TILE_MIN_H line 49832 / MAP_TILE_MAX_H line 49836 / layoutMap line 49964

EVIDENCE: `layoutMap` line 49964: `const h = clamp(MAP_TILE_W / aspect, MAP_TILE_MIN_H, MAP_TILE_MAX_H)` with `MAP_TILE_W=1600`, `MAP_TILE_MIN_H=480`, `MAP_TILE_MAX_H=2200`. A `flowchart LR` diagram hits the 480 floor while a `flowchart TD` hits the 2200 ceiling — a 4.6:1 spread. On screen at whole-map zoom the 'Access request agent' tile measures **244 × 73 px** against 244 × 336 for its neighbours; after the label strip, its diagram gets a 59px-tall band and renders as an unreadable row of dashes. Visual weight on the Map is being assigned by diagram orientation rather than by importance.

RECOMMENDATION: Narrow the range so tiles read as siblings: `MAP_TILE_MIN_H = 900` and `MAP_TILE_MAX_H = 1800` (lines 49832/49836), and for tiles whose natural aspect is wider than the box, letterbox the SVG inside — `.map-tile-body { place-items: center }` already does this, so the only change needed is the floor. A wide diagram then reads as a wide picture inside a card of comparable size rather than as a strip.

----------------------------------------------------------------------

### [MINOR] Three visually identical selects, one of them unlabelled
TARGET: #presentTransition options, lines 12602-12607

EVIDENCE: `#presentCameraMode` shows 'Camera · Block', `#presentDecisionMode` shows 'Decision · Ask', and between them `#presentTransition` shows just **'Smooth'** — same 11px `.present-actions select` styling, same size, no prefix. On a screen a client is watching, one dropdown says a bare adjective with no indication of what it governs. This is the Docs 'two visually identical Agent-spec dropdowns meaning different things' pattern, with three.

RECOMMENDATION: If these survive the bar reduction, prefix the transition options the way the other two are prefixed: `Motion · Instant` / `Motion · Fast` / `Motion · Smooth` / `Motion · Cinematic` (lines 12603-12606). Better: move all three into the `⋯` menu, where each gets a full text label and none of them faces the audience.

----------------------------------------------------------------------

### [MINOR] 'Dim UI' is a four-state cycle wearing a toggle's clothes and ARIA
TARGET: #presentDimButton (line 12619), handler line 14736, .present-overlay[data-dim] rules lines 9507-9511

EVIDENCE: The handler at line 14737 computes `(Number(dataset.dim||0) + 1) % 4` — pressing it walks 0 → 1 → 2 → 3 → 0, driving `.present-bar`/`.present-sidebar` opacity through .6 / .25 / .05 (lines 9507-9509). But `aria-pressed` is a boolean (`String(level > 0)`), and the resting label '◐ Dim UI' gives no hint that three presses are needed to reach the client-ready state or that a fourth returns. At level 3 the chrome is at `opacity:.05` but still occupies layout, still receives pointer events and is still in the tab order — a stray click on invisible chrome fires a real action.

RECOMMENDATION: Replace `aria-pressed` with `aria-label="Presenter chrome: level N of 3"` and label the button `◐ Chrome 1/3` etc. from the outset, or convert it to a plain two-state 'Hide controls' that goes straight to level 3 with a hover-to-reveal (the `:hover` rule at line 9510 already exists). At levels 2-3 add `pointer-events: none` to `.present-bar`/`.present-sidebar`, restored by the existing `:hover`/`:focus-within` rule, so an invisible control cannot be clicked by accident.

----------------------------------------------------------------------

### [MINOR] The sequence list is an ARIA listbox no keyboard can enter
TARGET: #presentSequenceList (line 12651) and .present-sequence-item

EVIDENCE: `#presentSequenceList` has `role="listbox"` (line 12651); its children are `<div class="present-sequence-item" role="option" aria-selected="false">` each containing four `<button>` elements. ARIA forbids interactive descendants inside `option`. Neither the container nor any option carries `tabindex`, so there is no roving-tabindex and no way to reach or arrow through the list by keyboard — the only keyboard route to a step is repeated `→` presses on the stage.

RECOMMENDATION: Either drop the ARIA pattern — `role="list"` on the container, `role="listitem"` on rows, and make the label region a real `<button>` — or implement the pattern properly: `tabindex="0"` on `#presentSequenceList`, `tabindex="-1"` on each option with roving focus, `aria-activedescendant` on the container, ArrowUp/ArrowDown handlers, and move the four edit buttons out of the options (see the hover/edit-mode recommendation above).

----------------------------------------------------------------------

### [MINOR] A well-designed keyboard model is documented nowhere in the UI
TARGET: handlePresentationKeydown() line 50952, mapHandleKey() lines 50534-50538

EVIDENCE: `handlePresentationKeydown` (line 50952) implements arrows / Space / PageUp / PageDown to step, `Home` for Show all, `1`-`9` to pick a decision branch, `F` for auto-focus, `P` for autoplay, `M` for the Studio, `+`/`-` for zoom, and a correct Escape hierarchy (diagram → Map → exit, lines 50960-50966). `mapHandleKey` adds `R` for route recording and `F` for fullscreen. None of this appears anywhere on screen. The only mention of any key is inside the Map hint that self-destructs after 5.2s. Separately, `R` toggles route *recording* with no modifier — an accidental keypress mid-presentation puts an authoring hint on the client's screen.

RECOMMENDATION: Add a `?` item to the `⋯` menu opening a small shortcuts card (reuse `.present-decision-prompt` styling), and bind `?` / `Shift+/` to it in `handlePresentationKeydown`. Gate the authoring keys behind a modifier: change `if (event.key === 'r' || event.key === 'R')` at line 50534 to require `event.altKey`, and do the same for the `Delete`/`Backspace` view-deletion at line 50535.

----------------------------------------------------------------------

### [MINOR] Copy defects on the two most-read strings of the walkthrough
TARGET: line 48256 (#presentStep), line 48236 (#presentSectionSubtitle), line 12576 (#mapPresenterButton)

EVIDENCE: `#presentStep` reads **'Overview · Overview'** on entry — line 48256 builds `` `Overview · ${label}` `` where `label` is already 'Overview'. `#presentSectionSubtitle` on the full-screen opening card reads **'12 blocks · 13 connectors'** (line 48236) — an authoring statistic on the slide that introduces an agent workflow to a client. `#mapPresenterButton` ships with a hard-coded `aria-pressed="true"` (line 12576) while `#mapPanel` is hidden, and the attribute is never updated on click: I measured `aria-pressed="true"` both before and after toggling, so assistive tech is told the notes panel is open when it is closed and hears no change when it opens.

RECOMMENDATION: Line 48256: `el.presentStep.textContent = presentIndex < 0 ? label : \`Step ${presentIndex+1} of ${presentSequence.length} · ${label}\`;`. Line 48236: replace the block/connector count with the diagram's own subtitle or leave it empty — put the count in the Studio, not on the client's slide. In the `#mapPresenterButton` click handler, set `aria-pressed` from `!el.mapPanel.hidden` after toggling, and change the HTML default at line 12576 to `aria-pressed="false"`.

----------------------------------------------------------------------
