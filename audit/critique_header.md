SURFACE: App header (brand lockup, version, active-diagram title, status chips, theme control, Guide / Import / Restore points / Export) and the diagram workspace bar (tab strip, diagram count, Add, Duplicate, Rename, Remove, All previews, Back) — everything above the two panes, at 1440x900 and 1280x800.

CONTROLS AT REST: 12

OVERALL IMPRESSION
OVERALL. This band is not overloaded — 12 interactive controls at rest is already close to what the rebuilt Docs surface achieved, and nothing here overflows, wraps or overlaps at either width. The problem is not how many controls there are; it is that the space is allocated backwards and half the labels are missing. Five buttons that act on exactly one diagram (Add, Duplicate, Rename, Remove, All previews) hold a fixed ~460px on the right of the bar forever, while the one control that has to scale with the workspace — the tab strip — takes whatever is left and then fails. Three of the six header controls are naked glyphs with no name of any kind at every width the user actually works at.

WHAT THE EYE HITS FIRST, AND WHETHER THAT IS RIGHT. In the full 1440x900 view (screenshot A_full_1440_fresh.png) the eye lands on the blue Export button in the top-right corner — it is the only saturated fill in the entire header band. Second is the red-tinted Remove in the diagram bar. Third is the centred diagram title. That order is wrong: on a first session the two loudest chrome controls are "send this somewhere" (nothing exists to send yet) and "destroy this" — while the tab strip, which is where the user's actual work lives, is the quietest thing in the band. The brand lockup is well judged and correctly recedes.

CAN A NEWCOMER TELL WHAT THIS IS FOR. From the header alone, on a normal corporate laptop, no. The one sentence of explanatory copy ("Build visually or in Mermaid code · metadata, review, presentation and portable project exchange") is clipped mid-word at 1440x900 ("...and portable projec…", measured scrollWidth 451 vs clientWidth 407) and is set to display:none outright at any viewport under 880px tall — which includes 1280x800 and 1366x768. What saves the newcomer is not the header but the 6-step first-run coach tour, which is genuinely good and should not be touched.

WHERE ARE MY DIAGRAMS. This is where the surface breaks. A diagram tab is min-width 104px / max-width 190px inside a flex scroller. Measured: a realistic audit name ("Vendor master change approval", "Bank reconciliation agent") needs 158–190px of tab. The strip is 901px at 1440 and 741px at 1280. So names begin truncating at 5 diagrams, and at 9 diagrams every tab is pinned to the 104px floor, which leaves 56px of name — about eight characters. With 26 diagrams open I measured 26 of 26 names clipped, 8 tabs fully visible at 1440 and 6 at 1280, against a scrollWidth of 2856px. Screenshot C_hdr_1440_26.png shows the result: "AP invo…", "Vendor …", "PO thre…", "Expense…", "Payroll …", "Journal …", "Bank re…", "Interco…". The strip does not survive 26 diagrams; it stops being a navigator at about 6.

Worse, it does not move. renderDiagramTabs() never calls scrollIntoView on the selected tab. I clicked "+ Diagram" with 26 open: scrollLeft stayed 0, the new tab (index 26) sat 1,850px off-screen, and no tab on screen showed as selected. Compare C_hdr_1440_26.png with D_hdr_1440_after_add.png — the only differences are that the counter reads 27 instead of 26 and tab 1 lost its highlight. A non-coder will read that as "nothing happened", click again, and end up with duplicate empty diagrams. The new diagram is also named "Diagram 1" (nextDiagramName reuses the lowest free number) while sitting in position 27, so the header title contradicts the tab index.

CONSISTENCY. Two controls on this surface do nothing but re-fire a control that already exists three inches away: #activeDiagramTitle's click handler calls renameActiveDiagram() — identical to #renameDiagramButton; #activeFolderChip's click handler literally calls el.multiPreviewButton.click(). Both are the same class of duplication the Docs pass removed. Separately, the folder chip is an interactive control wearing the exact geometry of the two non-interactive status pills next to it (screenshot I_hdr_1440_folderchip.png): same pill, same dot, same size — only the dot colour differs, and nothing suggests it opens the previews board. Also note Guide has a second, better-labelled entry point inside the editor pane (#openGuideInlineButton), which makes the anonymous "?" in the header the weaker of the two.

WHAT BREAKS AT 1280x800. No layout breakage — the grid resolves to 378px / 460px / 378px, nothing overflows, nothing overlaps, all hit targets stay 32–36px. Three things degrade: the tagline vanishes entirely (max-height:880px rule), the tab strip drops from 901px to 741px so only 6 of 26 diagrams are visible, and the actions cluster now consumes 517px of the 1280px bar — 40% of the width for five single-diagram verbs. The icon-only Guide/Import/Restore problem is identical at both widths, because the rule that strips their labels fires at ≤1640px.

Screenshots: C:\Users\tsinc\AppData\Local\Temp\claude\C--Claude\9a386ac9-d37e-4260-a91e-9812625dad56\scratchpad\shots\ (A_full_1440_fresh.png, B_hdr_1440_fresh.png, C_hdr_1440_26.png, D_hdr_1440_after_add.png, E_hdr_1440_26_scrollend.png, F_hdr_1280_26.png, G_full_1280_26.png, H_hdr_1440_kpmg.png, I_hdr_1440_folderchip.png).

======================================================================

### [CRITICAL] Adding a diagram produces no visible change once more than 8 are open
TARGET: renderDiagramTabs() at line 15888 / #diagramTabs

EVIDENCE: With 26 diagrams open at 1440x900 I clicked #addDiagramButton and measured before/after: #diagramTabs.scrollLeft stayed 0, scrollWidth went 2856 -> 2966, the active index became 26, and the active tab's rect was entirely outside the scroller's rect (activeVisible = false). renderDiagramTabs() (line 15888) rebuilds the strip but never scrolls the selected tab into view; switchDiagram() (line 15967) does not either. Screenshots C_hdr_1440_26.png and D_hdr_1440_after_add.png are visually identical except the counter reading 27 and the fact that NO tab is highlighted anywhere on screen. The only feedback is the centred header title changing to 'Diagram 1' — which reads as if the app jumped back to diagram 1.

RECOMMENDATION: At the end of renderDiagramTabs(), after appending the tabs, scroll the selected tab into view: const active = el.diagramTabs.querySelector('.diagram-tab[aria-selected="true"]'); if (active) active.scrollIntoView({ inline: 'nearest', block: 'nearest' }); Call it from renderDiagramTabs so add / duplicate / remove / switchDiagram / palette 'Go to:' all benefit. Use instant (not smooth) scrolling, matching the existing comment at line 14621.

----------------------------------------------------------------------

### [CRITICAL] The tab strip stops identifying diagrams at 5 and stops showing them at 9
TARGET: .diagram-tab (line 3090) and .diagram-tabs (line 3079)

EVIDENCE: .diagram-tab is min-width:104px; max-width:190px (line 3090) inside .diagram-tabs, a flex scroller 901px wide at 1440 and 741px at 1280. Measured natural tab widths for realistic audit names: 158–190px ('AP invoice intake agent' 176, 'Bank reconciliation agent' 186, 'Vendor master change approval' 190 and already clipped at the 190 cap). With 26 diagrams every tab is squeezed to the 104px floor, leaving the .diagram-tab-name element clientWidth 56px against scrollWidth 110–173px: 26 of 26 names clipped, roughly 8 characters visible. Fully visible tabs: 8 of 26 at 1440, 6 of 26 at 1280 (scrollWidth 2856 vs clientWidth 901 / 741). Thresholds: truncation begins at 5 diagrams (5 x 176 + 4 x 6 = 904 > 901), horizontal scrolling begins at 9 (9 x 104 + 8 x 6 = 984 > 901). Screenshot C_hdr_1440_26.png: 'AP invo… / Vendor … / PO thre… / Expense… / Payroll … / Journal … / Bank re… / Interco…'.

RECOMMENDATION: Stop treating one flat strip as the whole navigator. (a) Raise .diagram-tab min-width to 132px and max-width to 220px so the floor shows ~14 characters instead of 8. (b) Give .diagram-tabs an overflow indicator: add mask-image: linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%) so a clipped tab fades instead of being guillotined by the actions cluster. (c) Cap the strip at the tabs that fit and put the remainder behind an overflow control at the right end of #diagramTabs — a '⋯ N more' button that opens a searchable list — rather than relying on a scrollbar the user cannot see.

----------------------------------------------------------------------

### [CRITICAL] Guide, Import and Restore points have no accessible name and no tooltip at every width the user works at
TARGET: #guideButton, #importButton, #versionsButton (lines 10887–10889) and the rule at line 8753

EVIDENCE: The rule @media (max-width:1640px) and (min-width:901px) { .header-actions .btn span.optional { display:none } } (line 8753) hides the text labels. The glyph spans are aria-hidden="true" and none of the three buttons carries a title or aria-label. I computed the accessible name in the live DOM at 1440x900: #guideButton, #importButton and #versionsButton all resolve to EMPTY (a screen reader announces 'button, button, button'). Sighted users get an unlabelled '?', '↥' and '◷' at 38x36px; '◷' for 'Restore points' is unguessable, and hovering produces nothing. #exportButton is unaffected because its label span lacks the .optional class.

RECOMMENDATION: Add both a permanent accessible name and a tooltip to the three buttons in the markup at lines 10887–10889: aria-label="Guide" title="Guide and Mermaid legend" on #guideButton; aria-label="Import" title="Import a project or diagram" on #importButton; aria-label="Restore points" title="Restore points — earlier saved versions of this workspace" on #versionsButton. Then change the ≤1640px rule so it only hides the label on the two least-used buttons, or better: keep 'Restore points' visible and let Guide/Import go icon-only — the clock glyph is the one nobody can decode.

----------------------------------------------------------------------

### [MODERATE] There is no way to find a diagram by name; the feature that does this is never mentioned anywhere in the UI
TARGET: .diagram-workspace-actions / new #findDiagramButton next to #diagramCount (line 10897)

EVIDENCE: buildCommandRegistry() (line 21008) adds a 'Go to: <name>' command for every diagram, and Alt+1..9 switches to diagrams 1–9 (line 47372). Both work. Neither string 'Ctrl+K', 'Cmd+K', 'command palette' nor 'Alt+1' appears anywhere in user-visible text in the whole 2.9 MB file — 'Alt+1..9' exists only inside a JavaScript comment. So the only reliable way to reach diagram 19 of 26 is to drag a scrollbar the user has to discover first. The numbered badges on the tabs (1..26) actively imply a numeric shortcut that is never revealed.

RECOMMENDATION: Add one control to .diagram-workspace-actions, immediately left of #diagramCount: <button class="btn ghost compact" id="findDiagramButton" type="button" title="Find a diagram by name (Ctrl+K)">⌕ Find</button>, wired to openCommandPalette() with the input pre-filled to filter the 'Diagram' group. Also append the shortcut hint to #diagramCount's title attribute: 'Alt+1 to Alt+9 jump to the first nine diagrams; Ctrl+K searches all of them.'

----------------------------------------------------------------------

### [MODERATE] Two header controls are silent duplicates of diagram-bar buttons
TARGET: #activeDiagramTitle + #renameDiagramButton (line 10900); #activeFolderChip + #multiPreviewButton

EVIDENCE: At line 14046 el.activeDiagramTitle's click handler calls renameActiveDiagram() — the exact function bound to #renameDiagramButton at line 14092. At line 14052 el.activeFolderChip's click handler calls el.multiPreviewButton.click() — literally re-firing the 'All previews' button at line 14094. Guide additionally has a second entry point inside the editor pane (#openGuideInlineButton, line 14782). So of the 12 controls at rest, 2 are pure duplicates of controls visible at the same time on the same screen.

RECOMMENDATION: Pick one home for each concept. Keep the click-to-rename on #activeDiagramTitle (it is the Apple-correct affordance — edit the thing where it is named) and delete #renameDiagramButton from the bar, recovering 75px for the tab strip. Keep #activeFolderChip as the folder indicator but change what it does (see the next finding) rather than duplicating #multiPreviewButton.

----------------------------------------------------------------------

### [MODERATE] The folder chip is an interactive control disguised as a status pill
TARGET: #activeFolderChip (line 10815) and its handler at line 14052

EVIDENCE: #activeFolderChip renders with the same .status-chip class, same 999px pill, same dot and same 11px type as the two purely informational chips beside it — measured 120px x 20px next to 'Saved locally' 101px and 'Preview current' 85px, all on the same baseline (screenshot I_hdr_1440_folderchip.png). Only the dot colour differs (data-state="info" blue vs "good" green). There is no folder glyph, no chevron, no visible affordance; cursor:pointer only appears on hover (line 2731). Its title text says 'Click to see all previews', which is a different concept from 'this diagram lives in folder X'.

RECOMMENDATION: Give it a distinct shape and a truthful action. Prefix the label with a folder glyph and a chevron — <span class="status-dot"></span>🗀 <span id="activeFolderText"></span><span aria-hidden="true">⌄</span> — add a .status-chip.is-action modifier with border-color: var(--border-strong) and a hover background so it does not read as status, and change the handler at line 14052 to open the previews board already filtered to that folder (set #multiPreviewFolderFilter to the active folderId, then toggle multiPreview) instead of blindly clicking #multiPreviewButton.

----------------------------------------------------------------------

### [MODERATE] Space in the workspace bar is allocated backwards
TARGET: #duplicateDiagramButton, #renameDiagramButton, #removeDiagramButton (lines 10899–10901)

EVIDENCE: Measured at 1280x800: the five buttons in .diagram-workspace-actions occupy x=830 to x=1268, i.e. 438px plus the 61px counter — 40% of the bar — and that width is fixed regardless of how many diagrams exist. Four of the five act on exactly one diagram. The tab strip, whose job scales with the workspace, gets 741px and shows 6 of 26. At 1440 the split is 901 / 517. Duplicate, Rename and Remove are each used far less often than switching diagrams, and Rename is already reachable from the header title.

RECOMMENDATION: Apply the Docs pattern: collapse the long tail into one menu. Keep '＋ Diagram' and '▦ All previews' as buttons; replace #duplicateDiagramButton, #renameDiagramButton and #removeDiagramButton with a single <button class="btn ghost compact" id="diagramMoreButton" aria-haspopup="menu" title="More actions for this diagram">⋯</button> whose menu holds Duplicate / Rename / Move to folder… / Remove. That returns roughly 180px to the tab strip at both widths and takes the destructive action out of one-click reach without removing it.

----------------------------------------------------------------------

### [MODERATE] What the app is for is invisible on a standard corporate laptop
TARGET: .brand-copy p (line 2642) and the rule at line 8010

EVIDENCE: The tagline <p> in .brand-copy is the only sentence on screen that explains the product. At 1440x900 it is clipped mid-word: scrollWidth 451 vs clientWidth 407, rendering 'Build visually or in Mermaid code · metadata, review, presentation and portable projec…' (screenshot B_hdr_1440_fresh.png). At 1280x800 it is display:none — not from the width breakpoint but from @media (max-height: 880px) { .brand-copy p { display:none } } at line 8010, which also fires on 1366x768 and 1920x1080-scaled-to-125%. Measured brand-copy width drops from 407px to 193px.

RECOMMENDATION: Shorten the copy so it fits the 407px column instead of relying on truncation — 'Mermaid diagrams, workpapers and client-ready exports.' measures well under 407px at 10.5px — and delete the max-height:880px rule at line 8010 so it survives on 800px-tall laptops. If vertical space must be recovered on short screens, take it from .app-header padding (5px 14px) rather than from the only orientation copy in the product.

----------------------------------------------------------------------

### [MODERATE] A new diagram is named 'Diagram 1' while sitting in position 27
TARGET: nextDiagramName() used by addDiagram() at line 16035

EVIDENCE: After renaming all 26 diagrams to real names and clicking #addDiagramButton, the header title showed 'Diagram 1' while the new tab carried index badge 27 (measured headerTitle:'Diagram 1', active index 26). nextDiagramName() reuses the lowest unused 'Diagram N', so once the user has named their work every new diagram is called 'Diagram 1'. The tab strip's own numbering says 27. The two contradict each other in the same 48px band.

RECOMMENDATION: Name new diagrams by position, not by lowest free slot: in addDiagram() (line 16031) use uniqueDiagramName('Diagram ' + (state.diagrams.length + 1)) so the name and the tab index agree. Better still for this user, seed the name from the diagram type — 'Untitled flowchart' — so it is obvious the name is a placeholder to be replaced.

----------------------------------------------------------------------

### [MODERATE] The keyboard focus ring on diagram tabs is clipped by its own scroller
TARGET: .diagram-tabs padding (line 3088)

EVIDENCE: .diagram-tabs sets overflow-x:auto with padding 1px 1px 3px (line 3079). Because overflow-x is auto, the computed overflow-y is also auto (measured: overflowX 'auto', overflowY 'auto'), so the container clips vertically. The global focus style is 3px solid + 2px offset (line 2526), needing 5px of bleed. Measured with a tab focused: strip top 73.19 / tab top 74.19 — the ring is clipped by 4px at the top and 2px at the bottom, leaving only the left and right edges of the ring visible. A keyboard user tabbing into the tablist gets a broken-looking sliver instead of a ring.

RECOMMENDATION: Change .diagram-tabs padding from '1px 1px 3px' to '6px 6px 8px' and reduce .diagram-workspace-bar padding from '7px 12px' to '3px 12px' so the bar height does not grow. That gives the 5px ring room on both axes without changing the bar's overall geometry.

----------------------------------------------------------------------

### [MINOR] The diagram counter fails WCAG AA contrast in the KPMG Blue theme
TARGET: .diagram-count (line 3127) and .brand-version (line 2037)

EVIDENCE: Measured computed contrast against the actual composited background. Dark theme: #diagramCount 6.08:1, #brandVersion 5.59:1 — both pass. KPMG Blue (the theme a KPMG auditor will select): #diagramCount 3.99:1 at 10px/850 and #brandVersion 4.40:1 at 10px/700 — both below the 4.5:1 requirement for text under 18.66px (screenshot H_hdr_1440_kpmg.png shows the counter as pale grey on white). Everything else on the surface passes comfortably in both themes (tabs 8.15–9.39:1, header buttons 14.5–19.5:1, status chips 6.5–11.5:1).

RECOMMENDATION: Change .diagram-count colour from var(--subtle) to var(--muted) (line 3129) and .brand-version from var(--subtle) to var(--muted) (line 2040). In KPMG Blue that lifts them to roughly 6:1 and 6:1 while keeping them visually secondary. Alternatively raise the --subtle token for light themes only.

----------------------------------------------------------------------

### [MINOR] The workspace bar's aria-label is not exposed to assistive technology
TARGET: #diagramWorkspaceBar (line 10894)

EVIDENCE: #diagramWorkspaceBar is a plain <div> carrying aria-label="Diagram workspace" with no role (measured: tag DIV, role null). An aria-label on a generic element with no role is ignored by screen readers, so the label is dead markup and the bar is announced as nothing. The nested #diagramTabs is correctly role="tablist" with its own label, so only the outer container is affected.

RECOMMENDATION: Add role="toolbar" to #diagramWorkspaceBar (line 10894) so its aria-label is exposed, or drop the aria-label and wrap the bar in a <nav aria-label="Diagrams">.

----------------------------------------------------------------------

### [MINOR] The tab strip cannot be scrolled with the mouse wheel, and gaining a scrollbar makes the bar jump 10px taller
TARGET: #diagramTabs (line 10895) / .diagram-tabs (line 3079)

EVIDENCE: There is no wheel listener on #diagramTabs (the file binds wheel only on #presentStageShell, #zoomViewport and #mapLayer). A vertical wheel over a horizontal scroller does nothing in Chrome, so with 9+ diagrams the only mouse route is dragging the thin scrollbar or knowing shift+wheel. On the live machine the bar height was measured at 48px with 8 diagrams and 58px with 26 — the scrollbar appearing pushes the whole workspace down by 10px the moment the ninth diagram is created.

RECOMMENDATION: Add a wheel handler on #diagramTabs that maps deltaY to horizontal scroll: el.diagramTabs.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); el.diagramTabs.scrollLeft += e.deltaY; } }, { passive: false }); and add scrollbar-gutter: stable to .diagram-tabs so the bar height does not change when the scrollbar appears.

----------------------------------------------------------------------

### [MINOR] A stale '1 / 15' counter is painted before the app initialises
TARGET: #diagramCount initial text (line 10897)

EVIDENCE: The static markup at line 10897 reads <span class="diagram-count" id="diagramCount">1 / 15</span>, but MAX_DIAGRAMS is Infinity (line 13204) and renderDiagramTabs() replaces the text with the '<n> diagrams' format (line 15926). Any slow first paint shows a limit of 15 diagrams that does not exist — I captured it in a headless render where the app had not yet booted.

RECOMMENDATION: Change the static text at line 10897 to an empty span (or '1 diagram') so the first paint never advertises a cap that was removed.

----------------------------------------------------------------------

### [MINOR] The theme picker is the widest control in the header actions
TARGET: .theme-menu-button width (lines 2758, 8755, 8764)

EVIDENCE: #headerThemeControl measures 153px wide at both 1280 and 1440 (the .theme-menu-button alone is 118px, line 2758), against 38px each for Guide, Import and Restore points — 114px for all three combined. A cosmetic preference therefore occupies more header real estate than the three functional controls next to it, and it is the only header control that carries a visible text label at these widths.

RECOMMENDATION: Reduce .theme-menu-button width from 132px/118px to a content-fit max-width:96px with text-overflow:ellipsis (lines 2758 and 8755), and give the reclaimed ~50px back to the labels on Guide/Import/Restore per the accessible-name finding. Do not remove the theme control — the theme range is a deliberate feature of this product.

----------------------------------------------------------------------
