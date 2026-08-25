import io, os, sys
# SIREN ui job: central interface declutter (34 -> ~27 controls at rest).
# v2 (fix-ui): 'History' button gets text metrics (no 'icon' class -> no 36px width pin);
# the Day/Night / finish rows sit INSIDE the theme menu's sticky rail so they stay visible
# at any scroll position (the menu keeps its scrollTop between opens).
# Anchor-guarded; applies to FROZEN_1_62_0.html. Usage: python patch_ui_declutter_v2.py <app.html>
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# ---------------------------------------------------------------- H1 header ⋯
rep('<button class="btn ghost" id="guideButton" type="button" aria-label="Guide"',
    '<button class="btn ghost" id="guideButton" type="button" hidden aria-label="Guide"')
rep('<button class="btn ghost" id="importButton" type="button" aria-label="Import"',
    '<button class="btn ghost" id="importButton" type="button" hidden aria-label="Import"')
rep('<button class="btn ghost" id="versionsButton" type="button" aria-label="Restore points"',
    '<button class="btn ghost" id="versionsButton" type="button" hidden aria-label="Restore points"')
rep('        <button class="btn" id="exportButton" type="button">',
    '        <!-- Guide, Import and Restore points are read once a session: one ⋯ holds them.\n'
    '             The three originals stay in the DOM (hidden) so the palette and their handlers keep working. -->\n'
    '        <button class="btn ghost" id="headerMoreButton" type="button" data-palette="skip" aria-haspopup="menu" aria-label="More: guide, import, restore points" title="Guide, import and restore points"><span aria-hidden="true">⋯</span></button>\n'
    '        <button class="btn" id="exportButton" type="button">')
# The Restore points exemption kept a two-line button on a one-line bar; moot now.
rep('      .header-actions .btn:not(#versionsButton) span.optional { display: none; }',
    '      .header-actions .btn span.optional { display: none; }', 2)
rep("'guideButton','importButton','versionsButton','exportButton',",
    "'guideButton','importButton','versionsButton','exportButton','headerMoreButton',")
rep("        el.versionsButton.addEventListener('click', openVersionsDialog);\n",
    "        el.versionsButton.addEventListener('click', openVersionsDialog);\n"
    "        if (el.headerMoreButton) el.headerMoreButton.addEventListener('click', () => {\n"
    "          openStructureMenu(el.headerMoreButton, [\n"
    "            ['guide', '? Guide and Mermaid legend'],\n"
    "            ['import', '↥ Import a project or diagram…'],\n"
    "            ['versions', '◷ Restore points…']\n"
    "          ], '', value => {\n"
    "            if (value === 'guide') openGuideDialog();\n"
    "            else if (value === 'import') showDialog(el.importDialog);\n"
    "            else if (value === 'versions') openVersionsDialog();\n"
    "          }, { keyboard: true, role: 'menu', plain: true, label: 'Guide, import and restore points', restoreFocus: true });\n"
    "        });\n")

# ---------------------------------------------------------------- H2 status chips
# The render chip speaks only when something is wrong or pending by hand: a green
# 'Preview current' that is always on is a light nobody reads.
rep('id="renderStateChip" data-state="warn">', 'id="renderStateChip" data-state="warn" hidden>')
rep("      function markPreviewOutdated() {\n"
    "        el.renderStateChip.dataset.state = 'warn';\n"
    "        el.renderStateText.textContent = 'Preview out of date';\n",
    "      // With auto-render on, the Render button does nothing the app is not already\n"
    "      // doing; it comes back the moment auto-render is switched off. Ctrl+Enter and\n"
    "      // the palette's 'Render diagram' work either way.\n"
    "      function syncRenderButton() {\n"
    "        if (el.renderPreviewButton) el.renderPreviewButton.hidden = Boolean(state.autoRender);\n"
    "      }\n\n"
    "      // The render chip speaks only when there is something to say. 'Out of date' and\n"
    "      // 'Rendering' last one debounce under auto-render, so they stay silent there.\n"
    "      function markPreviewOutdated() {\n"
    "        el.renderStateChip.hidden = Boolean(state.autoRender);\n"
    "        el.renderStateChip.dataset.state = 'warn';\n"
    "        el.renderStateText.textContent = 'Preview out of date';\n")
rep("      function markPreviewCurrent() {\n"
    "        el.renderStateChip.dataset.state = 'good';\n",
    "      function markPreviewCurrent() {\n"
    "        el.renderStateChip.hidden = true;\n"
    "        el.renderStateChip.dataset.state = 'good';\n")
rep("      function markPreviewInvalid() {\n"
    "        el.renderStateChip.dataset.state = 'bad';\n",
    "      function markPreviewInvalid() {\n"
    "        el.renderStateChip.hidden = false;\n"
    "        el.renderStateChip.dataset.state = 'bad';\n")
rep("        el.renderStateChip.dataset.state = 'warn';\n"
    "        el.renderStateText.textContent = 'Rendering…';\n",
    "        el.renderStateChip.hidden = Boolean(state.autoRender);\n"
    "        el.renderStateChip.dataset.state = 'warn';\n"
    "        el.renderStateText.textContent = 'Rendering…';\n")
rep("          el.renderStateChip.dataset.state = 'warn';\n"
    "          el.renderStateText.textContent = 'Full Mermaid required';\n",
    "          el.renderStateChip.hidden = false;\n"
    "          el.renderStateChip.dataset.state = 'warn';\n"
    "          el.renderStateText.textContent = 'Full Mermaid required';\n")
# A drawing with no labels has nothing to measure: that is not a warning.
rep("        if (!report.checked) {\n"
    "          el.inkChip.hidden = false;\n",
    "        if (!report.checked) {\n"
    "          if (!report.labels) {\n"
    "            el.inkChip.hidden = true;\n"
    "            el.inkChip.removeAttribute('title');\n"
    "            return;\n"
    "          }\n"
    "          el.inkChip.hidden = false;\n")

# ---------------------------------------------------------------- H3 pane head
rep('id="renderPreviewButton" type="button" title=', 'id="renderPreviewButton" type="button" hidden title=')
rep("        el.autoRender.addEventListener('change', () => {\n"
    "          state.autoRender = el.autoRender.checked;\n"
    "          scheduleSave();\n",
    "        el.autoRender.addEventListener('change', () => {\n"
    "          state.autoRender = el.autoRender.checked;\n"
    "          syncRenderButton();\n"
    "          scheduleSave();\n")
rep("        el.autoRender.checked = Boolean(state.autoRender);\n        applyEditorMode(state.editorMode, false);\n",
    "        el.autoRender.checked = Boolean(state.autoRender);\n        syncRenderButton();\n        applyEditorMode(state.editorMode, false);\n")
# The tour step that pointed at Render now points at the zoom chip, so the tour keeps six steps.
rep("        { sel: '#renderPreviewButton', title: 'Render', text: 'Draws the preview from your blocks or code. With Auto-render on, it happens by itself as you work.' },",
    "        { sel: '#zoomChipButton', title: 'The preview draws itself', text: 'Auto-render redraws the preview as you work - no Render button to press. This chip fits the whole diagram in the pane; the ▾ beside it holds the zoom controls.' },")
# Compare moves into the diagram ⋯ menu (it is an action on this diagram, used rarely).
rep('id="compareButton" type="button"', 'id="compareButton" type="button" hidden')
rep("            ['remove', 'Remove diagram', lastOne ? 'The last diagram cannot be removed.' : false]\n",
    "            ['compare', 'Compare with another diagram…'],\n"
    "            ['remove', 'Remove diagram', lastOne ? 'The last diagram cannot be removed.' : false]\n")
rep("            else if (value === 'remove') requestRemoveActiveDiagram();\n",
    "            else if (value === 'compare') openCompareDialog();\n"
    "            else if (value === 'remove') requestRemoveActiveDiagram();\n")
# The pane head said the same thing three times (eyebrow, title, idle status) while the
# header chip said it a fourth. The title stays on the card and for aria; idle goes quiet.
rep("    .preview-pane .pane-actions { flex: 0 0 auto; flex-wrap: nowrap; }\n",
    "    .preview-pane .pane-actions { flex: 0 0 auto; flex-wrap: nowrap; }\n"
    "    /* In single view the h2 repeats the card title 150px lower; it stays for aria-labelledby\n"
    "       and screen readers, and comes back in All previews where it carries the count. */\n"
    "    .preview-pane:not(.is-multi-preview) #previewHeading { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n")
rep("          setStatus(rendererMode === 'mermaid' ? 'Diagram rendered with Mermaid.' : 'Diagram rendered with the basic offline renderer.');",
    "          // A successful Mermaid render is the normal state, and the normal state says nothing.\n"
    "          setStatus(rendererMode === 'mermaid' ? '' : 'Diagram rendered with the basic offline renderer.');")

# ---------------------------------------------------------------- T1 stepper: one door until active
rep("        if (el.previewStepControls) el.previewStepControls.hidden = unavailable;\n",
    "        if (el.previewStepControls) {\n"
    "          el.previewStepControls.hidden = unavailable;\n"
    "          // Prev/Next only exist while a walk-through is running; at rest the group is\n"
    "          // one 'Walk through' door (the CSS reads this flag).\n"
    "          el.previewStepControls.dataset.active = String(previewWalkthroughIndex >= 0);\n"
    "        }\n")
rep("          el.previewStepCount.textContent = 'Overview';\n"
    "          el.previewStepLabel.textContent = `${total} block${total === 1 ? '' : 's'}`;\n"
    "          el.previewStepIndicator.title = 'Whole diagram. Click Next to focus the first block.';\n"
    "          el.previewStepIndicator.setAttribute('aria-label', `Whole diagram overview, ${total} blocks`);\n",
    "          el.previewStepCount.textContent = 'Walk through';\n"
    "          el.previewStepLabel.textContent = `${total} block${total === 1 ? '' : 's'}`;\n"
    "          el.previewStepIndicator.title = 'Step through the blocks one at a time.';\n"
    "          el.previewStepIndicator.setAttribute('aria-label', `Walk through the diagram, ${total} blocks`);\n")
rep("        el.previewStepIndicator.addEventListener('click', () => showPreviewWalkthroughOverview(true));\n",
    "        // At rest the indicator is the door in; during a walk-through it is the way back out.\n"
    "        el.previewStepIndicator.addEventListener('click', () => previewWalkthroughIndex < 0 ? stepPreviewWalkthrough(1) : showPreviewWalkthroughOverview(true));\n")
rep("    .preview-step-controls {\n",
    "    .preview-step-controls[data-active=\"false\"] #previewPrevButton,\n"
    "    .preview-step-controls[data-active=\"false\"] #previewNextButton { display: none; }\n"
    "    .preview-step-controls {\n")

# ---------------------------------------------------------------- T2 layout pair icon-only
rep("    @container preview-pane (max-width: 880px) {\n"
    "      .zoom-tools .preview-layout-switch .text-label { display: none; }\n",
    "    /* The layout pair is icon-only at every width: ↕ and ↔ say it, and the words cost\n"
    "       126px of toolbar for no extra meaning (each button keeps its tooltip and aria-label). */\n"
    "    .zoom-tools .preview-layout-switch .text-label { display: none; }\n"
    "    @container preview-pane (max-width: 880px) {\n")

# ---------------------------------------------------------------- T3 finish rows -> theme menu rail
start = s.index('        <div class="kintsugi-finish-bar" id="kpmgFinishBar" hidden aria-label="KPMG Blue appearance">')
end = s.index('        <div class="wasteland-panel" id="wastelandPanel" hidden')
block = s[start:end]
assert block.count('<div class="kintsugi-finish-bar"') == 3 and 'id="kintsugiFinishBar"' in block and block.endswith('</div>\n\n'), block[-80:]
s = s[:start] + s[end:]
moved = '\n'.join(('      ' + line) if line.strip() else line for line in block.rstrip('\n').split('\n'))
# Inside the sticky rail, not under it: the menu keeps its scroll position between opens
# (pick a theme low in the list, reopen: the top is off-screen), so a row that lived in the
# scrolling part was invisible exactly when it mattered. Pinned with the rail it is always there.
rep('              <button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>\n'
    '            </div>\n'
    '            <div class="theme-menu-group" role="group" aria-label="Essentials themes">',
    '              <button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>\n'
    '              <!-- Day/Night (and accent) for the themes that have them: a row pinned under the\n'
    '                   jump pills, not a strip above the diagram. Shown only while that theme is active. -->\n'
    + moved + '\n'
    '            </div>\n'
    '            <div class="theme-menu-group" role="group" aria-label="Essentials themes">')
# Keyboard users reach the row with Tab inside the open menu, like the rail and the toggle.
rep("          const stops = [...jumps, optionStop, el.ambientSoftToggle].filter(Boolean);",
    "          const finish = Array.from(el.themeMenu.querySelectorAll('.kintsugi-finish-bar:not([hidden]) .kintsugi-finish'));\n"
    "          const stops = [...jumps, ...finish, optionStop, el.ambientSoftToggle].filter(Boolean);")
rep("    .kintsugi-finish-bar {\n      display: none;\n",
    "    /* Inside the theme menu rail the finish row is a full-width plain row under the jump\n"
    "       pills (the rail's own side padding and bottom border frame it); it pins with the rail. */\n"
    "    .theme-menu-nav .kintsugi-finish-bar { flex: 1 0 100%; margin: 2px -9px -8px; padding: 7px 9px; border: 0; border-top: 1px solid var(--border); border-radius: 0; background: transparent; box-shadow: none; }\n"
    "    /* T4: Cupertino glass menus read the buttons underneath through them; a menu is the\n"
    "       one surface that must be solid to be read. Night keeps its dark glass. */\n"
    "    [data-theme=\"cupertino\"] .struct-menu,\n"
    "    [data-theme=\"cupertino\"] .theme-menu { background: rgba(255, 255, 255, .94); backdrop-filter: blur(18px) saturate(1.3); -webkit-backdrop-filter: blur(18px) saturate(1.3); }\n"
    "    [data-theme=\"cupertino\"] .theme-menu-nav { background: rgba(255, 255, 255, .96); }\n"
    "    [data-theme=\"cupertino\"][data-cupertino-variant^=\"night\"] .struct-menu,\n"
    "    [data-theme=\"cupertino\"][data-cupertino-variant^=\"night\"] .theme-menu { background: rgba(30, 35, 45, .94); }\n"
    "    [data-theme=\"cupertino\"][data-cupertino-variant^=\"night\"] .theme-menu-nav { background: rgba(30, 35, 45, .96); }\n"
    "    .kintsugi-finish-bar {\n      display: none;\n")

# ---------------------------------------------------------------- M1 mode bar wording
rep('aria-controls="codeModePanel" title="Mermaid code: direct source editing with live validation">⌘ Code</button>',
    'aria-controls="codeModePanel" title="Mermaid code: direct source editing with live validation">&lt;/&gt; Code</button>')
# The word needs text metrics: 'icon' pins the box at 36px and the label spilled past both
# borders. 'compact' is what Docs beside it uses; the rule below gives both the same metrics.
rep('<button class="btn ghost icon" id="undoHistoryButton" type="button" title="Undo history — every step this session, jump back to any of them" aria-label="Undo history">▾</button>',
    '<button class="btn ghost compact" id="undoHistoryButton" type="button" title="Undo history — every step this session, jump back to any of them" aria-label="Undo history">History</button>')
rep("    .editor-mode-history #workpapersButton { padding: 0 10px; font-size: 12px; font-weight: 800; }\n",
    "    .editor-mode-history #workpapersButton,\n"
    "    .editor-mode-history #undoHistoryButton { padding: 0 10px; font-size: 12px; font-weight: 800; }\n")

# ---------------------------------------------------------------- L1 collapsible names
rep("<summary>Advanced settings</summary>", "<summary>Diagram type, templates &amp; tools</summary>")
rep("<summary>Diagram settings · title, fonts, spacing, block styling, legend</summary>",
    "<summary>Style · title, fonts, spacing, block styling, legend</summary>")
rep("<h3>Advanced settings, tool by tool</h3>", "<h3>Diagram type, templates &amp; tools - one by one</h3>")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
