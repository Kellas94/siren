# -*- coding: utf-8 -*-
"""SIREN header + diagram workspace bar fixes (critique plan items 4, 5, 6, 7, 8, 11, 12, 13 - header halves).

Every replacement is anchor-guarded: it asserts the exact occurrence count of the
old text BEFORE replacing, so a drifted file fails loudly instead of patching the
wrong place. Writes atomically via tmp + os.replace.

Usage: python fix_header.py <path-to-T_Industries_SIREN_v1.html>
"""
import os
import sys


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python fix_header.py <target.html>')
    path = sys.argv[1]
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        text = handle.read()

    applied = []

    def rep(label, old, new, count=1):
        nonlocal text
        found = text.count(old)
        assert found == count, (
            f'{label}: expected {count} occurrence(s) of anchor, found {found}.\n'
            f'Anchor starts: {old[:120]!r}'
        )
        text = text.replace(old, new, count)
        applied.append(label)

    # ------------------------------------------------------------------ item 5
    # Guide / Import / Restore points: permanent accessible name + tooltip.
    rep('item5-guide-name',
        '<button class="btn ghost" id="guideButton" type="button">'
        '<span aria-hidden="true">?</span><span class="optional">Guide</span></button>',
        '<button class="btn ghost" id="guideButton" type="button" aria-label="Guide" '
        'title="Guide and Mermaid legend">'
        '<span aria-hidden="true">?</span><span class="optional">Guide</span></button>')
    rep('item5-import-name',
        '<button class="btn ghost" id="importButton" type="button">'
        '<span aria-hidden="true">↥</span><span class="optional">Import</span></button>',
        '<button class="btn ghost" id="importButton" type="button" aria-label="Import" '
        'title="Import a project or diagram">'
        '<span aria-hidden="true">↥</span><span class="optional">Import</span></button>')
    rep('item5-versions-name',
        '<button class="btn ghost" id="versionsButton" type="button">'
        '<span aria-hidden="true">◷</span><span class="optional">Restore points</span></button>',
        '<button class="btn ghost" id="versionsButton" type="button" aria-label="Restore points" '
        'title="Restore points — earlier saved versions of this workspace">'
        '<span aria-hidden="true">◷</span><span class="optional">Restore points</span></button>')
    # Both label-stripping media rules (~1640px and ~1180px) spare Restore points:
    # the clock glyph is the one label nobody can decode without its words.
    rep('item5-optional-rules',
        '      .header-actions .btn span.optional { display: none; }',
        '      .header-actions .btn:not(#versionsButton) span.optional { display: none; }',
        count=2)

    # ------------------------------------------------------------------ item 4
    # Wider tabs: 104px left ~8 characters of an audit name; 132px shows ~14.
    rep('item4-tab-widths',
        '      min-width: 104px;\n'
        '      max-width: 190px;',
        '      min-width: 132px;\n'
        '      max-width: 220px;')
    # Strip: reserve the scrollbar track from the start (no 10px jump at diagram
    # nine), give the 3px+2px focus ring the 5px of padding it needs, and fade the
    # clipped edge instead of guillotining a tab mid-letter.
    rep('item4+12-diagram-tabs-css',
        '    .diagram-tabs {\n'
        '      display: flex;\n'
        '      align-items: center;\n'
        '      gap: 6px;\n'
        '      min-width: 0;\n'
        '      flex: 1 1 auto;\n'
        '      overflow-x: auto;\n'
        '      overscroll-behavior-x: contain;\n'
        '      scrollbar-width: thin;\n'
        '      padding: 1px 1px 3px;\n'
        '    }',
        '    .diagram-tabs {\n'
        '      display: flex;\n'
        '      align-items: center;\n'
        '      gap: 6px;\n'
        '      min-width: 0;\n'
        '      flex: 1 1 auto;\n'
        '      /* scroll, not auto: the track keeps its height from the first paint, so\n'
        '         the bar no longer jumps ~10px taller when diagram nine arrives. */\n'
        '      overflow-x: scroll;\n'
        '      overscroll-behavior-x: contain;\n'
        '      scrollbar-width: thin;\n'
        '      /* The global focus ring is 3px + 2px offset; under 5px of padding the\n'
        '         scroller clips it to a sliver. */\n'
        '      padding: 6px 6px;\n'
        '    }\n'
        '    /* A clipped tab fades at the overflowing edge instead of being guillotined;\n'
        '       the data-fade flag follows the scroll position (updateDiagramTabOverflow). */\n'
        '    .diagram-tabs[data-fade="both"] { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%); mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%); }\n'
        '    .diagram-tabs[data-fade="left"] { -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 14px); mask-image: linear-gradient(90deg, transparent 0, #000 14px); }\n'
        '    .diagram-tabs[data-fade="right"] { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 14px), transparent 100%); mask-image: linear-gradient(90deg, #000 calc(100% - 14px), transparent 100%); }\n'
        '    .diagram-tabs-more { flex: 0 0 auto; }')
    # The strip padding grew 10px; the bar gives back 4px of its own so the whole
    # band lands at the height it already had once a scrollbar appeared.
    rep('item12-bar-padding',
        '    #diagramWorkspaceBar { padding-top: 4px; padding-bottom: 4px; }',
        '    #diagramWorkspaceBar { padding-top: 2px; padding-bottom: 2px; }')

    # -------------------------------------------------------- items 4+6+7+13 markup
    # One ghost menu replaces Duplicate/Rename/Remove; Find sits by the counter with
    # the shortcut hint; the static counter no longer advertises a "/ 15" cap that
    # MAX_DIAGRAMS removed; the overflow button completes the tab strip.
    rep('bar-markup',
        '      <div class="diagram-tabs" id="diagramTabs" role="tablist" aria-label="Open Mermaid diagrams"></div>\n'
        '      <div class="diagram-workspace-actions">\n'
        '        <span class="diagram-count" id="diagramCount">1 / 15</span>\n'
        '        <button class="btn ghost compact" id="addDiagramButton" type="button" title="Add a new diagram">＋ Diagram</button>\n'
        '        <button class="btn ghost compact duplicate-action" id="duplicateDiagramButton" type="button" title="Duplicate active diagram">Duplicate</button>\n'
        '        <button class="btn ghost compact rename-action" id="renameDiagramButton" type="button" title="Rename active diagram">Rename</button>\n'
        '        <button class="btn danger compact remove-action" id="removeDiagramButton" type="button" title="Remove active diagram">Remove</button>\n'
        '        <button class="btn secondary compact multi-preview-toggle" id="multiPreviewButton" type="button" aria-pressed="false" title="Show all open diagrams at the same time">▦ All previews</button>',
        '      <div class="diagram-tabs" id="diagramTabs" role="tablist" aria-label="Open Mermaid diagrams"></div>\n'
        '      <button class="btn ghost compact diagram-tabs-more" id="diagramTabsOverflowButton" type="button" hidden aria-haspopup="listbox" title="All diagrams, including the tabs scrolled out of view">⋯ more</button>\n'
        '      <div class="diagram-workspace-actions">\n'
        '        <button class="btn ghost compact" id="findDiagramButton" type="button" title="Find a diagram by name (Ctrl+K)">⌕ Find</button>\n'
        '        <span class="diagram-count" id="diagramCount" title="Alt+1 to Alt+9 jump to the first nine diagrams; Ctrl+K searches all of them.">1 diagram</span>\n'
        '        <button class="btn ghost compact" id="addDiagramButton" type="button" title="Add a new diagram">＋ Diagram</button>\n'
        '        <button class="btn ghost compact" id="diagramMoreButton" type="button" aria-haspopup="menu" aria-label="More actions for this diagram" title="Duplicate, rename or remove this diagram">⋯</button>\n'
        '        <button class="btn secondary compact multi-preview-toggle" id="multiPreviewButton" type="button" aria-pressed="false" title="Show all open diagrams at the same time">▦ All previews</button>')

    # Element registry follows the markup.
    rep('el-registry',
        "'addDiagramButton','duplicateDiagramButton','renameDiagramButton','removeDiagramButton','multiPreviewButton'",
        "'addDiagramButton','diagramMoreButton','findDiagramButton','diagramTabsOverflowButton','multiPreviewButton'")

    # ------------------------------------------------------------- items 6+7+12 wiring
    rep('bar-wiring',
        "        el.addDiagramButton.addEventListener('click', addDiagram);\n"
        "        el.duplicateDiagramButton.addEventListener('click', duplicateActiveDiagram);\n"
        "        el.renameDiagramButton.addEventListener('click', renameActiveDiagram);\n"
        "        el.removeDiagramButton.addEventListener('click', requestRemoveActiveDiagram);\n"
        "        el.multiPreviewButton.addEventListener('click', () => applyMultiPreviewMode(!state.multiPreview, true));",
        "        el.addDiagramButton.addEventListener('click', addDiagram);\n"
        "        // Duplicate, Rename and Remove each act on one diagram yet held ~180px of\n"
        "        // the bar forever; one menu returns that width to the tab strip - the only\n"
        "        // control here whose job grows with the workspace. Remove keeps its named\n"
        "        // confirmation via requestRemoveActiveDiagram, and at one diagram the entry\n"
        "        // is disabled in place so the action still teaches that it exists.\n"
        "        el.diagramMoreButton.addEventListener('click', () => {\n"
        "          const lastOne = state.diagrams.length <= 1;\n"
        "          openStructureMenu(el.diagramMoreButton, [\n"
        "            ['duplicate', 'Duplicate'],\n"
        "            ['rename', 'Rename…'],\n"
        "            ['remove', 'Remove diagram', lastOne ? 'The last diagram cannot be removed.' : false]\n"
        "          ], '', value => {\n"
        "            if (value === 'duplicate') duplicateActiveDiagram();\n"
        "            else if (value === 'rename') renameActiveDiagram();\n"
        "            else if (value === 'remove') requestRemoveActiveDiagram();\n"
        "          });\n"
        "        });\n"
        "        // 'Go to: <name>' commands already exist for every diagram - the palette\n"
        "        // just never said so anywhere a non-coder could find it.\n"
        "        el.findDiagramButton.addEventListener('click', () => {\n"
        "          openCommandPalette();\n"
        "          el.commandPaletteInput.value = 'Go to: ';\n"
        "          filterCommandPalette();\n"
        "          requestAnimationFrame(() => {\n"
        "            el.commandPaletteInput.focus();\n"
        "            const end = el.commandPaletteInput.value.length;\n"
        "            el.commandPaletteInput.setSelectionRange(end, end);\n"
        "          });\n"
        "        });\n"
        "        el.diagramTabsOverflowButton.addEventListener('click', () => {\n"
        "          openStructureMenu(el.diagramTabsOverflowButton,\n"
        "            state.diagrams.map((diagram, index) => [diagram.id, `${index + 1}. ${diagram.name}`]),\n"
        "            state.activeDiagramId,\n"
        "            id => switchDiagram(id));\n"
        "          // The list can outgrow the menu's 320px; start it at the current diagram.\n"
        "          document.querySelector('.struct-menu .struct-menu-item[aria-selected=\"true\"]')?.scrollIntoView({ block: 'nearest' });\n"
        "        });\n"
        "        // A vertical wheel over a horizontal scroller does nothing in Chrome, so\n"
        "        // the strip ignored the very device it is mostly driven with.\n"
        "        el.diagramTabs.addEventListener('wheel', event => {\n"
        "          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {\n"
        "            event.preventDefault();\n"
        "            el.diagramTabs.scrollLeft += event.deltaY;\n"
        "          }\n"
        "        }, { passive: false });\n"
        "        el.diagramTabs.addEventListener('scroll', updateDiagramTabOverflow, { passive: true });\n"
        "        window.addEventListener('resize', updateDiagramTabOverflow);\n"
        "        el.multiPreviewButton.addEventListener('click', () => applyMultiPreviewMode(!state.multiPreview, true));")

    # ------------------------------------------------------------------ item 4 render
    # Overflow/fade state helper, declared just above the renderer that calls it.
    rep('item4-overflow-helper',
        '      function renderDiagramTabs() {\n'
        '        ensureWorkspaceState();',
        '      // The strip shows at most ~8 of the open diagrams; this keeps three honest\n'
        "      // signals in step with the scroll position: the '⋯ N more' button, its\n"
        '      // count of tabs not fully in view, and the edge-fade flags on the strip.\n'
        '      function updateDiagramTabOverflow() {\n'
        '        const strip = el.diagramTabs;\n'
        '        const button = el.diagramTabsOverflowButton;\n'
        '        if (!strip || !button) return;\n'
        '        const overflowing = strip.scrollWidth > strip.clientWidth + 1;\n'
        '        if (overflowing) {\n'
        '          const stripBox = strip.getBoundingClientRect();\n'
        "          const clipped = Array.from(strip.querySelectorAll('.diagram-tab')).filter(tab => {\n"
        '            const box = tab.getBoundingClientRect();\n'
        '            return box.left < stripBox.left - 1 || box.right > stripBox.right + 1;\n'
        '          }).length;\n'
        '          button.textContent = clipped > 0 ? `⋯ ${clipped} more` : `⋯ ${state.diagrams.length}`;\n'
        '          button.setAttribute(\'aria-label\', `${clipped} diagrams are out of view - show all ${state.diagrams.length} as a list`);\n'
        '        }\n'
        '        button.hidden = !overflowing;\n'
        '        const fadeLeft = strip.scrollLeft > 1;\n'
        '        const fadeRight = overflowing && strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;\n'
        "        strip.dataset.fade = fadeLeft && fadeRight ? 'both' : fadeLeft ? 'left' : fadeRight ? 'right' : '';\n"
        '      }\n'
        '\n'
        '      function renderDiagramTabs() {\n'
        '        ensureWorkspaceState();')
    rep('item4-overflow-call',
        "        if (activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest' });\n"
        '        renderPopoutDiagramOptions();',
        "        if (activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest' });\n"
        '        updateDiagramTabOverflow();\n'
        '        renderPopoutDiagramOptions();')

    # Duplicate/Remove availability is decided when the menu opens, not per render.
    rep('item6-disabled-sync',
        '        el.addDiagramButton.disabled = state.diagrams.length >= MAX_DIAGRAMS;\n'
        '        el.duplicateDiagramButton.disabled = state.diagrams.length >= MAX_DIAGRAMS;\n'
        '        el.removeDiagramButton.disabled = state.diagrams.length <= 1;\n'
        '        el.multiPreviewButton.disabled = state.diagrams.length <= 1;',
        '        el.addDiagramButton.disabled = state.diagrams.length >= MAX_DIAGRAMS;\n'
        "        // Duplicate/Remove availability is decided when the ⋯ menu opens - see\n"
        '        // el.diagramMoreButton\'s click wiring.\n'
        '        el.multiPreviewButton.disabled = state.diagrams.length <= 1;')

    # ------------------------------------------------------------------ item 6 menu
    # openStructureMenu learns a backward-compatible disabled flag: an optional third
    # tuple entry disables the row in place (a string becomes its tooltip), matching
    # the app's other honest disabled states instead of hiding the action.
    rep('item6-menu-disabled',
        '        options.forEach(([value, label]) => {\n'
        "          const item = document.createElement('button');\n"
        "          item.type = 'button';\n"
        "          item.className = 'struct-menu-item';\n"
        "          item.setAttribute('role', 'option');\n"
        "          item.setAttribute('aria-selected', String(value === current));\n"
        '          item.textContent = label;\n'
        "          item.addEventListener('click', () => { closeStructureMenu(); onPick(value); });\n"
        '          menu.appendChild(item);\n'
        '        });',
        '        options.forEach(([value, label, disabled]) => {\n'
        "          const item = document.createElement('button');\n"
        "          item.type = 'button';\n"
        "          item.className = 'struct-menu-item';\n"
        "          item.setAttribute('role', 'option');\n"
        "          item.setAttribute('aria-selected', String(value === current));\n"
        '          item.textContent = label;\n'
        '          // An optional third tuple entry disables the row in place (a string\n'
        '          // becomes the tooltip saying why): the action stays visible and teaches\n'
        "          // that it exists, matching the app's other honest disabled states.\n"
        '          if (disabled) {\n'
        '            item.disabled = true;\n'
        "            item.setAttribute('aria-disabled', 'true');\n"
        "            if (typeof disabled === 'string') item.title = disabled;\n"
        '          } else {\n'
        "            item.addEventListener('click', () => { closeStructureMenu(); onPick(value); });\n"
        '          }\n'
        '          menu.appendChild(item);\n'
        '        });')
    rep('item6-menu-focus',
        "        const first = menu.querySelector('.struct-menu-item');",
        "        const first = menu.querySelector('.struct-menu-item:not(:disabled)');")
    rep('item6-menu-disabled-css',
        '    .struct-menu-item[aria-selected="true"] { color: var(--primary); font-weight: 700; }',
        '    .struct-menu-item[aria-selected="true"] { color: var(--primary); font-weight: 700; }\n'
        '    .struct-menu-item:disabled { opacity: .45; cursor: default; }')

    # Read-only mode hid the three verbs; it hides their menu now.
    rep('item6-readonly-1',
        '    body.read-only-mode #addDiagramButton, body.read-only-mode #duplicateDiagramButton, '
        'body.read-only-mode #renameDiagramButton, body.read-only-mode #removeDiagramButton, '
        'body.read-only-mode #connectModeButton, body.read-only-mode #commentsButton { display:none !important; }',
        '    body.read-only-mode #addDiagramButton, body.read-only-mode #diagramMoreButton, '
        'body.read-only-mode #connectModeButton, body.read-only-mode #commentsButton { display:none !important; }')
    rep('item6-readonly-2',
        '    body.read-only-mode .diagram-workspace-actions .danger,\n'
        '    body.read-only-mode #addDiagramButton,\n'
        '    body.read-only-mode #duplicateDiagramButton,\n'
        '    body.read-only-mode #renameDiagramButton,\n'
        '    body.read-only-mode #removeDiagramButton,\n'
        '    body.read-only-mode #connectModeButton,\n'
        '    body.read-only-mode #commentsButton { display:none!important; }',
        '    body.read-only-mode .diagram-workspace-actions .danger,\n'
        '    body.read-only-mode #addDiagramButton,\n'
        '    body.read-only-mode #diagramMoreButton,\n'
        '    body.read-only-mode #connectModeButton,\n'
        '    body.read-only-mode #commentsButton { display:none!important; }')
    # The mobile rule that hid the three buttons loses its dead selectors.
    rep('item6-mobile-css',
        '      .diagram-workspace-actions .rename-action,\n'
        '      .diagram-workspace-actions .remove-action,\n'
        '      .diagram-workspace-actions .compare-action,\n'
        '      .diagram-workspace-actions .duplicate-action { display: none; }',
        '      .diagram-workspace-actions .compare-action { display: none; }')
    # Wasteland terminal decorations follow the surviving control.
    rep('item6-wasteland-icons',
        "duplicateDiagramButton:'CPY', renameDiagramButton:'REN', removeDiagramButton:'DEL', ",
        "diagramMoreButton:'OPS', ")

    # ------------------------------------------------------------------ item 8
    # The folder chip stops impersonating the two read-only pills beside it: a
    # stronger border, a folder glyph and a caret say it acts, and its action is
    # truthful - the previews board opens already narrowed to that folder.
    rep('item8-chip-markup',
        '          <span class="status-chip" id="activeFolderChip" data-state="info" role="button" tabindex="0" hidden '
        'title="Folder of the active diagram. Click to see all previews.">'
        '<span class="status-dot"></span><span id="activeFolderText"></span></span>',
        '          <span class="status-chip is-action" id="activeFolderChip" data-state="info" role="button" tabindex="0" hidden '
        'title="Folder of the active diagram. Click to preview every diagram in this folder.">'
        '<span class="status-dot"></span><span aria-hidden="true">\U0001f5c0</span>'
        '<span id="activeFolderText"></span><span class="chip-caret" aria-hidden="true">⌄</span></span>')
    rep('item8-chip-css',
        '    .status-chip[role="button"] { cursor: pointer; }\n'
        '    .status-chip[role="button"]:hover { border-color: var(--border-strong); color: var(--text); }',
        '    .status-chip[role="button"] { cursor: pointer; }\n'
        '    .status-chip[role="button"]:hover { border-color: var(--border-strong); color: var(--text); }\n'
        '    /* The folder chip acts (it opens the previews board) while its neighbours\n'
        '       only report; a stronger border, a folder glyph and a caret keep it from\n'
        '       impersonating them - same pill geometry, visibly different job. */\n'
        '    .status-chip.is-action { border-color: var(--border-strong); cursor: pointer; }\n'
        '    .status-chip.is-action:hover { background: var(--secondary); }\n'
        '    .status-chip.is-action .chip-caret { flex: 0 0 auto; font-size: 9px; opacity: .8; }\n'
        '    .status-chip.is-action #activeFolderText { min-width: 0; overflow: hidden; text-overflow: ellipsis; }')
    rep('item8-chip-handler',
        '        if (el.activeFolderChip) {\n'
        "          el.activeFolderChip.addEventListener('click', () => el.multiPreviewButton?.click());\n"
        "          el.activeFolderChip.addEventListener('keydown', event => {\n"
        "            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.multiPreviewButton?.click(); }\n"
        '          });\n'
        '        }',
        '        if (el.activeFolderChip) {\n'
        '          // The chip names a folder, so acting on it opens the previews board\n'
        '          // already narrowed to that folder - not a blind re-fire of the\n'
        '          // All previews button three inches away.\n'
        '          const openFolderPreviews = () => {\n'
        '            const folderId = getActiveDiagram()?.folderId;\n'
        '            state.workspaceBoard = sanitizeWorkspaceBoard({\n'
        '              ...sanitizeWorkspaceBoard(state.workspaceBoard, state.workspaceFolders),\n'
        "              folderFilter: folderId || 'unfiled'\n"
        '            }, state.workspaceFolders);\n'
        '            applyMultiPreviewMode(true, true);\n'
        '          };\n'
        "          el.activeFolderChip.addEventListener('click', openFolderPreviews);\n"
        "          el.activeFolderChip.addEventListener('keydown', event => {\n"
        "            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFolderPreviews(); }\n"
        '          });\n'
        '        }')

    # ------------------------------------------------------------------ item 11
    rep('item11-name-by-position',
        '        const name = nextDiagramName();',
        "        // The name follows the tab position ('Diagram 27' lands in slot 27),\n"
        "        // stepping upward past any existing 'Diagram N' rather than reusing a\n"
        "        // lower free number: a new diagram called 'Diagram 1' beside an index\n"
        '        // badge saying 27 read as the app jumping back to the first diagram.\n'
        "        const usedNames = new Set(state.diagrams.map(diagram => String(diagram.name || '').toLocaleLowerCase()));\n"
        '        let position = state.diagrams.length + 1;\n'
        '        while (usedNames.has(`diagram ${position}`)) position += 1;\n'
        '        const name = `Diagram ${position}`;')

    # ------------------------------------------------------------------ item 13
    rep('item13-count-contrast',
        '    .diagram-count {\n'
        '      min-width: 42px;\n'
        '      color: var(--subtle);',
        '    .diagram-count {\n'
        '      min-width: 42px;\n'
        '      /* --subtle measured 3.99:1 on KPMG Blue - below AA for 10px text; --muted\n'
        '         clears 4.5:1 in the light themes while staying visually secondary. */\n'
        '      color: var(--muted);')
    rep('item13-version-contrast',
        '    .brand-version {\n'
        '      display: inline-block;\n'
        '      margin-top: 2px;\n'
        '      color: var(--subtle);',
        '    .brand-version {\n'
        '      display: inline-block;\n'
        '      margin-top: 2px;\n'
        '      /* Same AA lift as .diagram-count: 4.40:1 on KPMG Blue was below 4.5:1. */\n'
        '      color: var(--muted);')
    # The one sentence explaining the product now fits its column instead of
    # relying on a mid-word ellipsis, and short screens keep it - the header wins
    # the height back from its own padding instead.
    rep('item13-tagline-copy',
        '          <p>Build visually or in Mermaid code · metadata, review, presentation and portable project exchange.</p>',
        '          <p>Mermaid diagrams, workpapers and client-ready exports.</p>')
    rep('item13-tagline-survives',
        '    @media (max-height: 880px) { .brand-copy p { display: none; } }',
        '    /* Short screens (1280x800, 1366x768) keep the only sentence that says what\n'
        '       the product is for; the header pays for it from its own padding. */\n'
        '    @media (max-height: 880px) { .app-header { padding-top: 2px; padding-bottom: 2px; } }')

    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)
    os.replace(tmp, path)
    print(f'applied {len(applied)} replacements:')
    for label in applied:
        print(f'  - {label}')


if __name__ == '__main__':
    main()
