SURFACE: Dialogs, overlays and the narrow layout

CONTROLS AT REST: 17

OVERALL IMPRESSION
The dialog layer is the strongest engineering in SIREN and the weakest thing about it is everything that isn't a dialog. All 19 <dialog> elements go through one showDialog()/closeDialog() pair using native showModal(), so they get real top-layer painting, real modality, a correctly inerted background, Escape, and focus returned to the opener — I measured all eight of the common ones and every single behaviour passed. No dialog overflows the viewport at 1440x900, 1280x800 or 375x812; no footer ever slides below the fold (the min-height:0 comment on .dialog-body is load-bearing and it works); the page never scrolls behind an open dialog; every dialog has a real aria-labelledby target and a specific close label ("Close batch dialog", not "Close"); and the lowest contrast I measured anywhere in any dialog is 5.17:1. That is a genuinely finished layer.

The four hand-rolled overlays never got the same care. Present is a full-screen client-facing takeover that leaves focus on <body>, leaves the whole editor focusable and readable behind it, and carries no role, aria-modal or accessible name. The command palette declares aria-modal="true" but its key handler is bound to the input alone, so one Tab kills Escape, the arrows and Enter while its own footer still promises "Esc to close". The theme menu is a 36-option listbox that shows 17, tabs out into the header after the last option, and has no trap. And because showModal() puts dialogs in the top layer, the z-index:1500 toast system is silently invisible under every open modal — an export failure raised inside the Export dialog is a blurred smear behind the backdrop.

Control counts at rest, per surface: Export 17, House rules 9, Guide 9, Review 8, Compare 8, wpExport 7, Batch 7, Restore points 6, Rename 4, Confirm 3, Import 3, Comments 3, Undo history 3, Analysis 2, Auto-format rules 2 — that spread is healthy and mostly Docs-standard already. The two outliers are the command palette (22 rows) and the theme menu (37), and the theme menu is the one that actually hurts.

Visual hierarchy is right in most dialogs and wrong in exactly two. In Export the eye lands on the blue PDF button bottom-right, which is correct. In Confirm it lands on the red verb button after reading a title that names the object ("Remove Diagram 1?") — that dialog is the model for the whole app. But in Restore points the only emphasised button in the footer is the destructive "Delete all", sitting in the slot every other dialog reserves for the thing you came to do, and in Review two identical blue buttons compete — "Approve" in the body and "Done" in the footer.

The 375px layout is better than I expected: 21 controls at rest, no sub-24px targets, mobile nav in place, and every dialog fits with its footer reachable. What is missing on a phone is not layout but reach — Review, Comments, Compare and Present have no entry point, and the only path to them is Ctrl+K.

======================================================================

### [CRITICAL] Every toast is invisible while any modal dialog is open
TARGET: .toast (CSS line 8720) and the showToast() function

EVIDENCE: showDialog() calls dialog.showModal(), which puts the dialog in the top layer above all z-index, and dialog::backdrop carries backdrop-filter: blur(5px). .toast is position:fixed; z-index:1500 on <body>. I opened #exportDialog, clicked #copyShareLinkButton, and measured the toast at x=1213 y=843 w=209 h=39, z-index 1500, with document.getElementById('exportDialog').matches(':modal') === true. The screenshot (shots/toast_under_modal_1440.png) shows the error text 'Copy was blocked by the browser.' as an unreadable reddish smear behind the blurred backdrop. The in-dialog #exportStatus strip did not update either, so the user gets no feedback at all. This affects every confirmation and error raised from inside Export, Restore points, Review, Import, Compare, Batch, Coverage and Auto-format rules.

RECOMMENDATION: In showToast(), when document.querySelector('dialog[open]') exists, append the toast element to that dialog instead of document.body, and add CSS: dialog .toast { position: absolute; right: 14px; bottom: 76px; z-index: 5; }. Alternatively give .toast a popover="manual" attribute and call showPopover()/hidePopover() so it joins the top layer above the dialog. Keep the existing body-level path for toasts raised with no dialog open.

----------------------------------------------------------------------

### [CRITICAL] Present overlay does not take focus, does not inert the app, and has no accessible identity
TARGET: #presentOverlay, and the .app wrapper

EVIDENCE: After clicking #presentButton I measured: document.activeElement === BODY (focus never enters the overlay); #presentOverlay has role=null, aria-modal=null and no aria-label/aria-labelledby; document.querySelector('.app').hasAttribute('inert') === false and aria-hidden === null. Probing four background controls while Present was open returned exportButton:FOCUSABLE, source:FOCUSABLE, themeMenuButton:FOCUSABLE, addDiagramButton:FOCUSABLE. The same probe with the Docs surface open returns 'blocked' for all four, and with #exportDialog open returns 'blocked' for all four — so the app already knows how to do this and Present is the one place it was skipped. Escape does close Present and does return focus to #presentButton, so only the entry half is missing.

RECOMMENDATION: In the function that runs `el.presentOverlay.hidden = false` (line 48079), also set document.querySelector('.app').inert = true and el.presentOverlay.setAttribute('role','dialog'), setAttribute('aria-modal','true'), setAttribute('aria-label','Presentation — the Map'), then el.mapExitButton.focus(). In closePresentation() (line 51232) clear inert and the role/aria-modal before restoring focus to #presentButton.

----------------------------------------------------------------------

### [CRITICAL] Command palette stops responding to Escape, arrows and Enter as soon as focus leaves its input
TARGET: #commandPalette / #commandPaletteInput, handleCommandPaletteKeydown (line 21127), palette row builder (line 21096)

EVIDENCE: handleCommandPaletteKeydown is bound only to el.commandPaletteInput (line 15068). The result rows built at line 21096 are plain <button class="palette-row"> with no tabindex, so they are in the tab order. Measured: open the palette with Ctrl+K, press Escape immediately -> closes (correct). Open, press Tab twice (activeElement becomes BUTTON.palette-row), press Escape -> window.__UX.visible(#commandPalette) is still true, the palette stays open. ArrowUp/ArrowDown and Enter-runs-highlighted are dead in the same state. The palette's own footer reads 'Esc to close'. It also does not return focus on close: after Escape from the input, document.activeElement is BODY.

RECOMMENDATION: Move the listener from the input to the container: el.commandPalette.addEventListener('keydown', handleCommandPaletteKeydown). In the row builder around line 21096 add row.tabIndex = -1 so Tab keeps focus in the search field (the correct combobox pattern for a palette). In closeCommandPalette(), restore focus to the element recorded when the palette opened.

----------------------------------------------------------------------

### [MODERATE] Theme menu shows 17 of 36 themes and reads as complete
TARGET: .theme-menu (CSS line 2776), #themeMenu

EVIDENCE: #themeMenu computed max-height is min(74dvh, 560px), rendering at 520x540 with clientHeight 538 against scrollHeight 1025. Measured at 1440x900, 1280x800, 1180x800 and 980x760 — identical every time: 17 of 36 .theme-menu-option elements fall inside the box. The cut lands exactly on the 'SIGNATURE' group label, so the last thing visible is a heading with nothing under it and the menu reads as finished. Everything in Signature (Matrix, Art Deco, Synthwave, Cyberpunk, Kawaii, Aurora, Grand Hotel, Abyss, Space Race, Nosferatu, Hacker, Wasteland, Observatory, Grove, Ie) and all of Worlds, plus the #ambientSoftToggle checkbox, are below the fold. scrollbar-width:thin on a dark panel gives no visible cue at rest. See shots/theme_1440.png.

RECOMMENDATION: On .theme-menu (line 2776) raise max-height to min(84dvh, 760px) and add a bottom fade so the cut is legible: -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent). Better still, add a sticky group-filter row at the top of #themeMenu (Essentials / Office / Japan / Signature / Worlds) so 36 options never need one 1025px scroll.

----------------------------------------------------------------------

### [MODERATE] Theme menu is 36 tab stops with no focus containment
TARGET: .theme-menu-option elements inside #themeMenu

EVIDENCE: #themeMenu has role="listbox" and 36 children with role="option" that are all real <button> elements; I measured 36 of 36 with tabIndex >= 0. Tabbing from the menu leaks into the app behind it: after ~36 Tab presses focus reached guideButton, importButton, versionsButton, exportButton, a .diagram-tab and addDiagramButton. Background controls remain focusable (exportButton:FOCUSABLE while the menu is open). Arrow keys do work (Dark -> Navy after two ArrowDown) and Escape correctly closes and returns focus to #themeMenuButton, so only the roving-tabindex half is missing.

RECOMMENDATION: Give every .theme-menu-option tabindex="-1" and set tabindex="0" only on the option whose aria-selected is true; keep the existing arrow handling and add Home/End. Trap Tab while the menu is open (on keydown, if key === 'Tab', preventDefault and move within the option list), so the menu behaves like the listbox it declares itself to be.

----------------------------------------------------------------------

### [MODERATE] Restore points puts the destructive action in the primary slot and has no way out but the ×
TARGET: #versionsDialog .dialog-footer, #clearVersionsButton, #versionsKeep

EVIDENCE: #versionsDialog's footer contains #versionsMeta, a 'Keep newest' label, the #versionsKeep select and #clearVersionsButton (class 'btn danger'). There is no 'Done' or 'Close' — the header × is the only exit, unlike every other dialog in the app, all of which carry a footer Done/Close. 'Delete all' is the only filled, coloured button in the footer and sits bottom-right, the exact slot Export uses for PDF, Review uses for Done, and Confirm uses for the confirm verb. Measured at 1440x900: #versionsKeep renders 537px wide to display the single value '20', making the least important control the widest thing in the footer, while the 'Keep newest' label wraps to two lines. The three real actions ('Restore') are btn secondary compact. See shots/versions_1440.png.

RECOMMENDATION: In the #versionsDialog footer: change #clearVersionsButton to class="btn ghost" and keep its danger colour only on hover; constrain the select with #versionsKeep { width: 88px; flex: 0 0 auto; }; add white-space: nowrap to the 'Keep newest' label; and add a new <button class="btn" id="closeVersionsFooter">Done</button> as the last child, wired to closeDialog(el.versionsDialog).

----------------------------------------------------------------------

### [MODERATE] Dialogs act on an artefact they never name
TARGET: #reviewDialogTitle, #analysisDialogTitle, #exportDialogTitle, #wpExportDialogTitle

EVIDENCE: With four diagrams open (Diagram 1, AP invoice agent, TB reconciliation agent, Joiner access agent), #reviewDialog shows the title 'Review and sign-off', 'Your name', 'Current status: Draft', 'Note' and four decision buttons — nothing anywhere in the dialog says which diagram is about to be approved (markup at line 12958 contains no diagram-name element). The same is true of #analysisDialogTitle ('Diagram analysis'), #exportDialogTitle ('Export diagram') and #compareDialogTitle ('Compare diagrams'). #confirmDialog is the only dialog in the app that names its object — it renders 'Remove Diagram 1?' — and it is noticeably the clearest dialog in the product as a result. For an auditor signing off fifteen process maps, approving the wrong one is a real outcome.

RECOMMENDATION: When opening each dialog, write the active artefact into the title. In the review open handler: el.reviewDialogTitle.textContent = 'Review and sign-off — ' + activeDiagram().name. Same pattern for #analysisDialogTitle ('Analysis — <name>'), #exportDialogTitle ('Export — <name>') and #wpExportDialogTitle ('Export — <document title>'). Follow the shape #confirmDialog already uses.

----------------------------------------------------------------------

### [MODERATE] Thirteen of nineteen dialogs open with focus on the × button
TARGET: #exportDialog, #reviewDialog, #compareDialog, #importDialog, #confirmDialog, #versionsDialog, #wpExportDialog

EVIDENCE: Measured document.activeElement immediately after opening each dialog (opener focused first, so native focus restore was exercised correctly): exportDialog->closeExportDialog, versionsDialog->closeVersionsDialog, reviewDialog->closeReviewDialog, importDialog->closeImportDialog, compareDialog->closeCompareDialog, confirmDialog->closeConfirmDialog, analysisDialog->closeAnalysisDialog, commentsDialog->closeCommentsDialog, houseRulesDialog->closeHouseRules, undoHistoryDialog->closeUndoHistory, rulesDialog->closeRulesDialog, wpExportDialog->closeWpExportDialog, wpImportDialog->closeWpImportDialog. Only renameDialog (->renameDialogInput, it has autofocus), batchDialog (->batchPattern) and workspaceSearchDialog (->workspaceSearchInput) land somewhere useful. A screen-reader user opening Export hears 'Close export dialog, button' as the first thing in the dialog.

RECOMMENDATION: Add the autofocus attribute to the first meaningful control in each: #fileBaseName in #exportDialog, #reviewerName in #reviewDialog, #compareLeft in #compareDialog, #importChooseButton in #importDialog, #cancelConfirmButton in #confirmDialog (safe default for a destructive confirm), the first .version-row .btn in #versionsDialog, and the first .wp-export-choice in #wpExportDialog. Native <dialog> honours autofocus on showModal(), so no JS change is needed.

----------------------------------------------------------------------

### [MODERATE] Opening the Guide and pressing Enter launches the tour instead of reading the guide
TARGET: #startTourButton, #guideDialog .dialog-body, .snippet-copy

EVIDENCE: #startTourButton sits between the <h2> and the × in #guideDialog's header (line 12115), making it the first focusable element. Measured: click #guideButton -> document.activeElement is 'startTourButton'; dispatch Enter -> #guideDialog.open becomes false and a tour coach-mark becomes visible. So the reflex of opening Help and pressing Enter closes the help and starts a six-step overlay tour. No other dialog puts a secondary action in the header. Separately, the guide body is 3404px of scroll in a 640px window at 1440x900 (12.9 screens at 375px) with no section navigation, and its eight .snippet-copy buttons all read 'Copy' with no aria-label, so a screen reader announces eight identical buttons.

RECOMMENDATION: Move #startTourButton out of .dialog-header and into the .dialog-footer next to #closeGuideFooter (as class="btn ghost"), so the first focusable in the guide is #closeGuideDialog or the guide body. Add tabindex="-1" and autofocus to #guideDialog .dialog-body so focus lands on the content. In the snippet markup, add aria-label built from data-copy-snippet, e.g. aria-label="Copy A[Process / activity]". Add a sticky section nav strip at the top of .guide-dialog .dialog-body linking the twelve <section class="guide-section"> headings.

----------------------------------------------------------------------

### [MODERATE] The only way to remove a view from a presentation route is an invisible, unfocusable span
TARGET: .map-route-drop (built at line 50510, styled at line 9427)

EVIDENCE: .map-route-drop is built at line 50510 as a <span> with a click listener, textContent '×' and a title attribute only. CSS at line 9427 sets opacity: 0, revealed to .75 only on .map-route-item:hover or :focus-within. Measured live in Present: tag SPAN, opacity '0', tabindex null, role null, aria-label null, focusable false, rect 12.6 x 16. So it has no accessible name, cannot be reached by keyboard, and is 12.6px wide when it does appear. This is the same transparent-ghost-button pattern that was removed from the Docs block tools.

RECOMMENDATION: Build it as a real button: const drop = document.createElement('button'); drop.type = 'button'; drop.className = 'map-route-drop'; drop.setAttribute('aria-label', 'Remove ' + mapViewLabel(view) + ' from the route'). Change the CSS at line 9427 to .map-route-drop { opacity: .45; min-width: 24px; min-height: 24px; display: inline-flex; align-items: center; justify-content: center; } with opacity: 1 on hover/focus. Note a <button> cannot nest inside the .map-route-item <button> — make .map-route-item a div with role="button" plus tabindex="0", or lay the two out as siblings inside a chip wrapper.

----------------------------------------------------------------------

### [MODERATE] The Present control bar covers a diagram tile
TARGET: .map-bar and the mapCameraForRect/mapBounds fit calculation

EVIDENCE: With four diagrams on the Map at 1440x900, .map-bar measures x=502.5 y=746 w=435 h=50 and geometrically overlaps the 'Joiner access agent' tile (measured intersection > 4px on both axes). In shots/present_1440.png the pill sits across the tile and clips its label to '...ss matrix'. The Map camera fits all tiles to the full viewport without reserving room for its own fixed chrome, so on any layout whose bottom-centre tile lands there, content is occluded during a client presentation.

RECOMMENDATION: Reserve the chrome height in the fit calculation: in mapCameraForRect / mapBounds, inset the target rect by the .map-bar height plus the .map-route strip height (roughly 120px at the bottom, 60px at the top for .map-hint) before fitting. A cheaper stopgap is padding-bottom: 130px on the map canvas element so tiles never lay out under the bar.

----------------------------------------------------------------------

### [MODERATE] At 1280px six preview-tool controls are deleted rather than folded away
TARGET: @container preview-pane (max-width: 880px) at line 7211, .zoom-tools .text-action

EVIDENCE: @container preview-pane (max-width: 880px) at line 7211 applies .zoom-tools .text-action { display: none }. At a 1280x800 viewport with the editor pane open the preview pane is under 880px, so I measured display:'none' on #fitWidthButton, #filterButton and #focusPreviewButton — and #actualSizeButton, #fitPageButton and #connectModeButton carry the same class. Six controls vanish with no ⋯ overflow menu and no other entry point in the UI: 100%, Fit width, Fit page, ⇢ Connect, ⚑ Filters, ▢ Hide panel. Filters/swimlanes/badges is a core audit feature and at 1280 it is reachable only through Ctrl+K. (Credit where due: they are cleanly display:none, not clipped ghosts — I checked, none of them remain focusable.)

RECOMMENDATION: Replace the blanket display:none with a fold. Add a <details class="export-group" id="zoomMoreGroup"><summary>⋯ View</summary><div class="export-group-body">…</div></details> to .zoom-tools containing the six .text-action buttons, and in the container query show that summary and hide only the flat buttons, so nothing is lost — exactly the ＋ Add block ▾ / ⋯ pattern used in Docs.

----------------------------------------------------------------------

### [MODERATE] Review and sign-off has two competing blue primaries
TARGET: #closeReviewFooter

EVIDENCE: #reviewApproveButton is class="btn compact" (filled blue) and sits mid-body in .block-style-actions; #closeReviewFooter is class="btn" (filled blue) and sits bottom-right in .dialog-footer. Both render the same fill and weight. In shots/review_1440.png the eye lands on 'Approve' first because it is higher, then hits an equally emphasised 'Done' below it that only closes the dialog. The real decision lives in the body; the footer holds the exit.

RECOMMENDATION: Change #closeReviewFooter to class="btn ghost" so the only filled button in #reviewDialog is #reviewApproveButton. This matches the pattern the Docs rebuild used when the status dropdown and Sign-off button were merged into one emphasised control.

----------------------------------------------------------------------

### [MINOR] Export always shows the five PDF layout controls whatever format you are about to click
TARGET: the PDF LAYOUT .dialog-section inside #exportDialog

EVIDENCE: #exportDialog's body is 656px tall at 1440x900, of which the 'PDF LAYOUT' section (#pdfPageSize, #pdfOrientation, #pdfLayout, #pdfSmartBreaks, #pdfMargin plus a two-line explanatory hint) occupies roughly 250px — about 40% of the visible body — and is always expanded. A user exporting SVG or PNG scrolls past all of it. At 1280x800 this is what pushes the body into scroll (656 against a 602px window); at 375x812 the body is 930px against 569.

RECOMMENDATION: Wrap the PDF layout block in <details class="dialog-section"><summary>PDF layout</summary>…</details>, closed by default, and open it programmatically when the user has previously chosen PDF or PowerPoint. That drops the resting control count of #exportDialog from 17 to 12 and stops the body scrolling at 1280.

----------------------------------------------------------------------

### [MINOR] No dialog can be dismissed by clicking outside it
TARGET: the <dialog> elements listed in the recommendation

EVIDENCE: Measured: with #exportDialog open, a click at (60, 450) on the backdrop leaves .open === true; same for #guideDialog. No dialog carries a closedby attribute (getAttribute('closedby') is null). Chrome 151 is running here and supports closedby="any". Escape does work everywhere, so this is a light-dismiss gap rather than a trap, but for read-only surfaces like Guide, Analysis, Restore points and Import, clicking away is the expected gesture.

RECOMMENDATION: Add closedby="any" to the non-committal dialogs: #guideDialog, #analysisDialog, #versionsDialog, #importDialog, #wpImportDialog, #wpExportDialog, #wpImportReportDialog, #commentsDialog, #undoHistoryDialog, #coverageDialog. Leave #confirmDialog, #renameDialog, #batchDialog, #reviewDialog and #houseRulesDialog on the default (closerequest) so an accidental click cannot discard typed input or skip a decision.

----------------------------------------------------------------------

### [MINOR] House rules and Undo history have no visible entry point
TARGET: #houseRulesDialog, #undoHistoryDialog, .advanced-tool-group[aria-label="Quality tools"]

EVIDENCE: Grep of the whole file finds showDialog(el.houseRulesDialog) only at line 20993 and showDialog(el.undoHistoryDialog) only at line 20976 — both inside the command palette command registry ('House rules…', 'Undo history…'). There is no button, menu item or chip anywhere in the UI that opens either. #houseRulesDialog enforces diagram quality standards (max label length, max chain, decision labels, single entry, require owner, require status) — exactly the thing a KPMG reviewer would want to set once per engagement, and it is invisible unless the user discovers Ctrl+K.

RECOMMENDATION: Add both to the Advanced settings > Quality checks group, beside #analysisButton and #rulesButton: <button class="btn ghost compact" id="houseRulesButton">House rules</button>. Put Undo history behind the existing undo/redo cluster instead, as a small ▾ on #undoButton.

----------------------------------------------------------------------

### [MINOR] On a phone the export filename field is squeezed to a third of the dialog
TARGET: .export-name-row inside #exportDialog

EVIDENCE: .export-name-row (line 2681) is grid-template-columns: auto minmax(0, 1fr) with .export-name-row label { white-space: nowrap }. At 375x812 the dialog is 341px wide, the label 'File name for exports' consumes about 145px, and #fileBaseName gets roughly 165px with right-aligned text, so 't_industries_siren' is clipped at its left edge. The @media (max-width: 520px) block at line 8860 already restacks .starter-controls and .guide-starter-row but not this row. See shots/export_375.png.

RECOMMENDATION: In the @media (max-width: 520px) block add: .export-name-row { grid-template-columns: 1fr; gap: 6px; } .export-name-row label { white-space: normal; }

----------------------------------------------------------------------

### [MINOR] Review, Comments, Compare and Present are unreachable on a phone
TARGET: .header-actions / #reviewChip / .mobile-nav in the @media (max-width: 900px) block at line 8767

EVIDENCE: Diffing the visible-control sets at 1280x800 and 375x812: #reviewButton, #commentsButton, #compareButton, #presentButton, #styleShortcutButton, #duplicateDiagramButton, #renameDiagramButton and #removeDiagramButton are all present at 1280 and absent at 375 (hidden by .header-actions { display: none } and .pane-actions .desktop-only { display: none } in the max-width:900px block). The mobile nav gains only Editor, Preview, Guide, Render and Export. The command palette works at 375 (box 347x552, list scrolls correctly) but Ctrl+K is not a gesture available on a phone. Document-level sign-off is still reachable through Docs > #wpReviewButton, so only the diagram-level review path is lost.

RECOMMENDATION: Either make the existing #reviewChip a tap target on mobile that opens #reviewDialog (it is already a status chip in .status-cluster, and .status-chip:not(#renderStateChip) is display:none at ≤900px — show #reviewChip instead), or convert the fifth mobile-nav slot into '⋯ More' opening a sheet with Review, Comments, Compare and Export.

----------------------------------------------------------------------

### [MINOR] Docs opens with focus in the search box, so the first Escape appears to do nothing
TARGET: setWorkpapersOpen / the element focused when #wpWorkspace opens

EVIDENCE: #closeWpButton's title reads 'Back to the diagrams (Esc)'. The Escape listener at line 14303 deliberately blurs an input/contenteditable first and only closes on a second press — a considered choice with a comment explaining it. But focus on open lands on #wpSearch (measured), so the very first Escape a user presses after opening Docs is consumed by the blur and the surface does not close. I confirmed both halves: Escape with focus on #closeWpButton closes it; Escape from the initial focus does not.

RECOMMENDATION: Focus something non-editable on open. In setWorkpapersOpen(true), focus #wpDoc (giving it tabindex="-1") or #closeWpButton instead of #wpSearch, so the first Escape closes the surface as the tooltip promises and the two-stage behaviour is reserved for when the user is genuinely mid-edit.

----------------------------------------------------------------------

### [MINOR] Two Export dialogs in the same product use two different interaction models
TARGET: #exportDialog .dialog-footer vs #wpExportDialog .wp-export-grid

EVIDENCE: #wpExportDialog presents six clickable .wp-export-choice cards with a title and one line of guidance each, no footer, and a picking-a-format mental model. #exportDialog presents the same job as a settings form with a footer row of six format buttons, two of which (Data ▾, Workspace ▾) are <details> menus that pop upward. #importDialog and #wpImportDialog have a third shape again: static descriptive cards plus a 'Choose a file…' footer button. The card grid in #wpExportDialog is the clearest of the three and needs no footer at all.

RECOMMENDATION: Not a bug, but if the export surfaces are ever revisited, take #wpExportDialog's card grid as the pattern: turn #exportDialog's SVG/PNG/PowerPoint/PDF/Data/Workspace row into a .wp-export-grid of labelled cards, and keep the settings (file name, background, scope, PDF layout) above it.

----------------------------------------------------------------------
