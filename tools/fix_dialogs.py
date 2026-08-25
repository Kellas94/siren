#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dialogs-and-menus fixes for SIREN (critique: dialogs/overlays surface).

Applies anchor-guarded string replacements. Every replacement asserts its
occurrence count BEFORE replacing, so a drifted file fails loudly instead of
patching the wrong place. Writes atomically via tmp + os.replace.

Usage: python fix_dialogs.py <path-to-T_Industries_SIREN_v1.html>
"""
import os
import sys
import tempfile

def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: fix_dialogs.py <target-html>")
    path = sys.argv[1]
    with open(path, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    applied = []

    def rep(name: str, old: str, new: str, count: int = 1) -> None:
        nonlocal text
        found = text.count(old)
        assert found == count, f"{name}: expected {count} occurrence(s), found {found}"
        text = text.replace(old, new, count)
        applied.append(name)

    # ------------------------------------------------------------------
    # 1. Theme menu shows 17 of 36 themes and reads as complete.
    #    Raise the CSS and JS height caps and add a sticky group rail that
    #    names every group and jumps to it, so what is off-screen is both
    #    visible and one click away.
    # ------------------------------------------------------------------
    rep("theme-menu css max-height",
        "      max-height: min(74dvh, 560px);",
        "      max-height: min(88dvh, 800px);")

    rep("theme-menu js height cap",
        "        const menuHeightCap = Math.min(540, Math.max(180, viewportHeight - margin * 2));",
        "        const menuHeightCap = Math.min(800, Math.max(180, viewportHeight - margin * 2));")

    rep("theme-menu js max-height cap",
        "        const maxHeight = Math.max(160, Math.min(540, viewportTop + viewportHeight - top - margin));",
        "        const maxHeight = Math.max(160, Math.min(800, viewportTop + viewportHeight - top - margin));")

    rep("theme-menu jump rail markup",
        '          <div class="theme-menu" id="themeMenu" role="listbox" aria-label="Choose theme" hidden>\n'
        '            <div class="theme-menu-group" role="group" aria-label="Essentials themes">',
        '          <div class="theme-menu" id="themeMenu" role="listbox" aria-label="Choose theme" hidden>\n'
        '            <div class="theme-menu-nav" role="presentation">\n'
        '              <button class="theme-menu-jump" type="button" data-jump-group="Essentials themes">Essentials</button>\n'
        '              <button class="theme-menu-jump" type="button" data-jump-group="Office themes">Office</button>\n'
        '              <button class="theme-menu-jump" type="button" data-jump-group="Japan Collection themes">Japan</button>\n'
        '              <button class="theme-menu-jump" type="button" data-jump-group="Signature themes">Signature</button>\n'
        '              <button class="theme-menu-jump" type="button" data-jump-group="Worlds themes">Worlds</button>\n'
        '            </div>\n'
        '            <div class="theme-menu-group" role="group" aria-label="Essentials themes">')

    rep("theme-menu jump rail css",
        "    .theme-menu[hidden] { display: none !important; }",
        "    .theme-menu[hidden] { display: none !important; }\n"
        "    /* 36 options overflow every viewport this app runs on; the sticky rail names\n"
        "       every group so what is below the fold is visible and one click away,\n"
        "       instead of the list silently cutting off at a bare group heading. */\n"
        "    .theme-menu-nav {\n"
        "      position: sticky;\n"
        "      top: -7px;               /* cancels the menu padding so the rail pins flush */\n"
        "      z-index: 2;\n"
        "      display: flex;\n"
        "      flex-wrap: wrap;\n"
        "      gap: 4px;\n"
        "      margin: -7px -7px 4px;\n"
        "      padding: 8px 9px;\n"
        "      border-bottom: 1px solid var(--border);\n"
        "      background: var(--panel-elevated);\n"
        "    }\n"
        "    .theme-menu-jump {\n"
        "      padding: 3px 10px;\n"
        "      border: 1px solid var(--border);\n"
        "      border-radius: 999px;\n"
        "      background: transparent;\n"
        "      color: var(--muted);\n"
        "      font-size: 10px;\n"
        "      font-weight: 850;\n"
        "      letter-spacing: .05em;\n"
        "      cursor: pointer;\n"
        "    }\n"
        "    .theme-menu-jump:hover,\n"
        "    .theme-menu-jump:focus-visible { border-color: var(--border-strong); background: var(--panel-alt); color: var(--text); }")

    # ------------------------------------------------------------------
    # 2. Theme menu was 36 tab stops with no containment: roving tabindex
    #    (selected option is the only tabbable one) plus a Tab trap.
    # ------------------------------------------------------------------
    rep("theme-menu roving tabindex",
        "        options.forEach(option => {\n"
        "          const active = option.dataset.themeValue === themeName;\n"
        "          option.setAttribute('aria-selected', String(active));\n"
        "          if (active) selected = option;\n"
        "        });",
        "        options.forEach(option => {\n"
        "          const active = option.dataset.themeValue === themeName;\n"
        "          option.setAttribute('aria-selected', String(active));\n"
        "          // Roving tabindex: the listbox is one tab stop and the arrows do the\n"
        "          // walking, so Tab cannot wander through 36 options into the header.\n"
        "          option.tabIndex = active ? 0 : -1;\n"
        "          if (active) selected = option;\n"
        "        });")

    rep("theme-menu keydown containment",
        "      function handleThemeMenuKeydown(event) {\n"
        "        const options = themeMenuOptions();\n"
        "        const current = options.indexOf(document.activeElement);\n"
        "        if (event.key === 'Escape') {\n"
        "          event.preventDefault();\n"
        "          setThemeMenuOpen(false);\n"
        "          el.themeMenuButton?.focus();\n"
        "          return;\n"
        "        }\n"
        "        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;",
        "      function handleThemeMenuKeydown(event) {\n"
        "        const options = themeMenuOptions();\n"
        "        const current = options.indexOf(document.activeElement);\n"
        "        if (event.key === 'Escape') {\n"
        "          event.preventDefault();\n"
        "          setThemeMenuOpen(false);\n"
        "          el.themeMenuButton?.focus();\n"
        "          return;\n"
        "        }\n"
        "        // Tab stays inside the open menu: the rail, one option (the focused or\n"
        "        // selected one) and the soften toggle, instead of leaking into the app.\n"
        "        if (event.key === 'Tab') {\n"
        "          const jumps = Array.from(el.themeMenu.querySelectorAll('.theme-menu-jump'));\n"
        "          const optionStop = current >= 0 ? document.activeElement\n"
        "            : (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0]);\n"
        "          const stops = [...jumps, optionStop, el.ambientSoftToggle].filter(Boolean);\n"
        "          event.preventDefault();\n"
        "          const at = stops.indexOf(document.activeElement);\n"
        "          const to = at === -1 ? (event.shiftKey ? stops.length - 1 : 0)\n"
        "            : (at + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;\n"
        "          stops[to]?.focus();\n"
        "          return;\n"
        "        }\n"
        "        if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key)) return;\n"
        "        if (current === -1) {\n"
        "          // Arrows pressed on the rail or the toggle drop into the option list\n"
        "          // at the current theme rather than computing an index from nowhere.\n"
        "          event.preventDefault();\n"
        "          (options.find(option => option.getAttribute('aria-selected') === 'true') || options[0])?.focus();\n"
        "          return;\n"
        "        }")

    rep("theme-menu click jump handling",
        "      function handleThemeMenuClick(event) {\n"
        "        const option = event.target.closest('.theme-menu-option[data-theme-value]');",
        "      function handleThemeMenuClick(event) {\n"
        "        const jump = event.target.closest('.theme-menu-jump');\n"
        "        if (jump) {\n"
        "          const group = el.themeMenu.querySelector(`.theme-menu-group[aria-label=\"${jump.dataset.jumpGroup}\"]`);\n"
        "          const rail = el.themeMenu.querySelector('.theme-menu-nav');\n"
        "          // offsetTop is relative to the positioned menu, so this lands the group\n"
        "          // heading just below the sticky rail rather than hidden behind it.\n"
        "          if (group) el.themeMenu.scrollTop = Math.max(0, group.offsetTop - (rail ? rail.offsetHeight : 0) - 6);\n"
        "          return;\n"
        "        }\n"
        "        const option = event.target.closest('.theme-menu-option[data-theme-value]');")

    # ------------------------------------------------------------------
    # 3. Restore points: destructive action out of the primary slot, a real
    #    Done exit, and the keep-count select stops being the widest control.
    # ------------------------------------------------------------------
    rep("versions footer markup",
        '        <button class="btn danger" id="clearVersionsButton" type="button">Delete all</button>\n'
        "      </div>\n"
        "    </dialog>",
        '        <button class="btn ghost" id="clearVersionsButton" type="button">Delete all</button>\n'
        '        <button class="btn" id="closeVersionsFooter" type="button" autofocus>Done</button>\n'
        "      </div>\n"
        "    </dialog>")

    rep("versions footer css",
        "    .versions-keep { font-size: 12px; color: var(--muted); }",
        "    .versions-keep { font-size: 12px; color: var(--muted); white-space: nowrap; }\n"
        "    /* The keep-count select was the widest thing in the footer, and the only\n"
        "       emphasised button was the destructive one, sitting in the slot every\n"
        "       other dialog reserves for the thing you came to do. Done takes the\n"
        "       primary slot; Delete all reads as danger only when considered. */\n"
        "    #versionsKeep { width: 88px; flex: 0 0 auto; }\n"
        "    #clearVersionsButton { color: var(--danger); }\n"
        "    #clearVersionsButton:hover { background: var(--danger-bg); border-color: color-mix(in srgb, var(--danger) 40%, var(--border)); }")

    rep("versions footer registry",
        "'versionsDialog','closeVersionsDialog','versionsList','clearVersionsButton','versionsMeta','versionsKeep',",
        "'versionsDialog','closeVersionsDialog','versionsList','clearVersionsButton','versionsMeta','versionsKeep','closeVersionsFooter',")

    rep("versions footer wiring",
        "        el.closeVersionsDialog.addEventListener('click', () => closeDialog(el.versionsDialog));",
        "        el.closeVersionsDialog.addEventListener('click', () => closeDialog(el.versionsDialog));\n"
        "        if (el.closeVersionsFooter) el.closeVersionsFooter.addEventListener('click', () => closeDialog(el.versionsDialog));")

    rep("versions first-restore autofocus",
        "          const restore = document.createElement('button');\n"
        "          restore.className = 'btn secondary compact';\n"
        "          restore.type = 'button';\n"
        "          restore.textContent = 'Restore';",
        "          const restore = document.createElement('button');\n"
        "          restore.className = 'btn secondary compact';\n"
        "          restore.type = 'button';\n"
        "          restore.textContent = 'Restore';\n"
        "          // The newest restore point is the reason the dialog was opened;\n"
        "          // showModal honours autofocus, so focus starts on the work, not the ×.\n"
        "          if (version === versions[0]) restore.autofocus = true;")

    # ------------------------------------------------------------------
    # 4. Dialogs name the artefact they act on, following the confirm
    #    dialog's existing good example ('Remove "AP invoice intake"?').
    # ------------------------------------------------------------------
    rep("review title names diagram",
        "          el.reviewDialogTitle.textContent = reviewSubjectKind === 'document'\n"
        "            ? `Review and sign-off — ${subject.ref || subject.title || 'document'}`\n"
        "            : 'Review and sign-off';",
        "          el.reviewDialogTitle.textContent = reviewSubjectKind === 'document'\n"
        "            ? `Review and sign-off — ${subject.ref || subject.title || 'document'}`\n"
        "            // An auditor signing off fifteen maps must see which one is on the table.\n"
        "            : `Review and sign-off — ${subject.name || 'diagram'}`;")

    rep("analysis title registry",
        "'analysisDialog','closeAnalysisDialog','closeAnalysisFooter','analysisBody',",
        "'analysisDialog','analysisDialogTitle','closeAnalysisDialog','closeAnalysisFooter','analysisBody',")

    rep("analysis title names diagram",
        "        renderAnalysis({ model, orphans, starts, ends, cycles, unreachable, depth, duplicateLabels });\n"
        "        showDialog(el.analysisDialog);",
        "        renderAnalysis({ model, orphans, starts, ends, cycles, unreachable, depth, duplicateLabels });\n"
        "        // Which diagram this report describes — the confirm dialog's naming rule.\n"
        "        if (el.analysisDialogTitle) el.analysisDialogTitle.textContent = `Diagram analysis — ${getActiveDiagram()?.name || 'diagram'}`;\n"
        "        showDialog(el.analysisDialog);")

    rep("export title registry",
        "'exportDialog','closeExportDialog','exportBackground',",
        "'exportDialog','exportDialogTitle','pdfLayoutSection','closeExportDialog','exportBackground',")

    rep("export dialog open naming + pdf fold state",
        "      function openExportDialog() {\n"
        "        persistExportSettings(false);",
        "      function openExportDialog() {\n"
        "        persistExportSettings(false);\n"
        "        // Which diagram is about to be exported — the confirm dialog's naming rule.\n"
        "        if (el.exportDialogTitle) el.exportDialogTitle.textContent = `Export — ${getActiveDiagram()?.name || 'diagram'}`;\n"
        "        // The five PDF layout controls matter only to PDF and PowerPoint; the fold\n"
        "        // opens itself for people whose last export was one of those two.\n"
        "        if (el.pdfLayoutSection) el.pdfLayoutSection.open = ['pdf', 'pptx'].includes(state.export.lastFormat);")

    rep("wpExport title registry",
        "'wpExportDialog','closeWpExportDialog',",
        "'wpExportDialog','wpExportDialogTitle','closeWpExportDialog',")

    rep("wpExport open naming",
        "        if (el.wpExportButton) el.wpExportButton.addEventListener('click', () => {\n"
        "          if (!activeWorkpaper()) { showToast('Open a document first.', 'error'); return; }\n"
        "          showDialog(el.wpExportDialog);\n"
        "        });",
        "        if (el.wpExportButton) el.wpExportButton.addEventListener('click', () => {\n"
        "          const doc = activeWorkpaper();\n"
        "          if (!doc) { showToast('Open a document first.', 'error'); return; }\n"
        "          // Which document is about to be exported — the confirm dialog's naming rule.\n"
        "          if (el.wpExportDialogTitle) el.wpExportDialogTitle.textContent = `Export — ${doc.ref || doc.title || 'document'}`;\n"
        "          showDialog(el.wpExportDialog);\n"
        "        });")

    # ------------------------------------------------------------------
    # 5. Thirteen dialogs opened with focus on the × button. Native <dialog>
    #    honours autofocus on showModal(), so each gets it on the first
    #    meaningful control (input if present, else the primary action).
    # ------------------------------------------------------------------
    rep("autofocus fileBaseName",
        '<input class="file-name-input" id="fileBaseName" type="text" value="t_industries_siren" autocomplete="off" />',
        '<input class="file-name-input" id="fileBaseName" type="text" value="t_industries_siren" autocomplete="off" autofocus />')

    rep("autofocus reviewerName",
        '<input id="reviewerName" type="text" maxlength="80" autocomplete="off" placeholder="Used to sign the trail" />',
        '<input id="reviewerName" type="text" maxlength="80" autocomplete="off" placeholder="Used to sign the trail" autofocus />')

    rep("autofocus compareLeft",
        '<select id="compareLeft"></select>',
        '<select id="compareLeft" autofocus></select>')

    rep("autofocus importChooseButton",
        '<button class="btn" id="importChooseButton" type="button">Choose a file…</button>',
        '<button class="btn" id="importChooseButton" type="button" autofocus>Choose a file…</button>')

    rep("autofocus cancelConfirmButton",
        '<button class="btn ghost" id="cancelConfirmButton" type="button">Cancel</button>',
        '<button class="btn ghost" id="cancelConfirmButton" type="button" autofocus>Cancel</button>')

    rep("autofocus wp-export first choice",
        '<button class="wp-export-choice" type="button" data-wp-export="pdf">',
        '<button class="wp-export-choice" type="button" data-wp-export="pdf" autofocus>')

    rep("autofocus wpChooseImportButton",
        '<button class="btn" id="wpChooseImportButton" type="button">Choose a file…</button>',
        '<button class="btn" id="wpChooseImportButton" type="button" autofocus>Choose a file…</button>')

    rep("autofocus wpImportReportDoneButton",
        '<button class="btn" id="wpImportReportDoneButton" type="button">Done</button>',
        '<button class="btn" id="wpImportReportDoneButton" type="button" autofocus>Done</button>')

    rep("autofocus closeAnalysisFooter",
        '<button class="btn" id="closeAnalysisFooter" type="button">Done</button>',
        '<button class="btn" id="closeAnalysisFooter" type="button" autofocus>Done</button>')

    rep("autofocus commentsFilter",
        '<select id="commentsFilter">',
        '<select id="commentsFilter" autofocus>')

    rep("autofocus closeUndoHistoryFooter",
        '<button class="btn" id="closeUndoHistoryFooter" type="button">Done</button>',
        '<button class="btn" id="closeUndoHistoryFooter" type="button" autofocus>Done</button>')

    rep("autofocus closeCoverageFooter",
        '<button class="btn" id="closeCoverageFooter" type="button">Done</button>',
        '<button class="btn" id="closeCoverageFooter" type="button" autofocus>Done</button>')

    rep("autofocus addRuleButton",
        '<button class="btn secondary compact" id="addRuleButton" type="button">＋ Add rule</button>',
        '<button class="btn secondary compact" id="addRuleButton" type="button" autofocus>＋ Add rule</button>')

    rep("autofocus ruleMaxLabel",
        '<input id="ruleMaxLabel" type="number" min="0" max="200" step="1" />',
        '<input id="ruleMaxLabel" type="number" min="0" max="200" step="1" autofocus />')

    # ------------------------------------------------------------------
    # 6. Guide: Enter used to launch the tour and close the help you asked
    #    for. Focus lands on the readable body; the tour moves to the footer
    #    as an explicit, labelled choice.
    # ------------------------------------------------------------------
    rep("guide header without tour",
        '      <div class="dialog-header">\n'
        '        <h2 id="guideDialogTitle">How to use SIREN</h2>\n'
        '        <button class="btn ghost compact" id="startTourButton" type="button" title="Replay the five-step welcome tour">Tour</button>\n'
        '        <button class="btn ghost icon" id="closeGuideDialog" type="button" aria-label="Close guide">×</button>\n'
        "      </div>",
        '      <div class="dialog-header">\n'
        '        <h2 id="guideDialogTitle">How to use SIREN</h2>\n'
        '        <button class="btn ghost icon" id="closeGuideDialog" type="button" aria-label="Close guide">×</button>\n'
        "      </div>")

    rep("guide body autofocus",
        '      <div class="dialog-body">\n'
        '        <div class="guide-hero">',
        '      <div class="dialog-body" tabindex="-1" autofocus>\n'
        '        <div class="guide-hero">')

    rep("guide footer with tour",
        '      <div class="dialog-footer">\n'
        '        <div class="dialog-actions">\n'
        '          <button class="btn" id="closeGuideFooter" type="button">Done</button>\n'
        "        </div>\n"
        "      </div>\n"
        "    </dialog>\n"
        "\n"
        '    <dialog id="exportDialog"',
        '      <div class="dialog-footer">\n'
        '        <div class="dialog-actions">\n'
        "          <!-- People open a guide to read it; the tour is an explicit choice\n"
        "               here instead of the first thing Enter hits in the header. -->\n"
        '          <button class="btn ghost" id="startTourButton" type="button" title="Replay the welcome tour">Start the tour</button>\n'
        '          <button class="btn" id="closeGuideFooter" type="button">Done</button>\n'
        "        </div>\n"
        "      </div>\n"
        "    </dialog>\n"
        "\n"
        '    <dialog id="exportDialog"')

    # ------------------------------------------------------------------
    # 7. Export: the five PDF layout controls fold away unless the user's
    #    last export was PDF/PowerPoint (SVG and PNG users stop scrolling
    #    past 250px of somebody else's settings).
    # ------------------------------------------------------------------
    rep("pdf layout fold open tag",
        '        <div class="dialog-section">\n'
        "          <h3>PDF layout</h3>\n"
        '          <div class="settings-grid">\n'
        "            <div>\n"
        '              <label for="pdfPageSize">Page size</label>',
        '        <details class="dialog-section pdf-layout-fold" id="pdfLayoutSection">\n'
        "          <summary>PDF layout</summary>\n"
        '          <div class="settings-grid">\n'
        "            <div>\n"
        '              <label for="pdfPageSize">Page size</label>')

    rep("pdf layout fold close tag",
        '          <div class="field-hint">PDF export is generated from the diagram SVG, not from the current UI zoom or screen capture. Automatic pagination keeps larger diagrams readable instead of shrinking them into a narrow strip.</div>\n'
        "        </div>",
        '          <div class="field-hint">PDF export is generated from the diagram SVG, not from the current UI zoom or screen capture. Automatic pagination keeps larger diagrams readable instead of shrinking them into a narrow strip.</div>\n'
        "        </details>")

    rep("pdf layout fold css",
        "    .dialog-section h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }",
        "    .dialog-section h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }\n"
        "    /* A closed fold reads exactly like the section heading it replaces, with\n"
        "       the same chevron the Scope drop uses, so the dialog stays one system. */\n"
        "    .pdf-layout-fold > summary {\n"
        "      cursor: pointer;\n"
        "      user-select: none;\n"
        "      list-style: none;\n"
        "      display: inline-block;\n"
        "      position: relative;\n"
        "      margin: 0 0 10px;\n"
        "      padding-right: 18px;\n"
        "      font-size: 12px;\n"
        "      font-weight: 700;\n"
        "      text-transform: uppercase;\n"
        "      letter-spacing: 0.07em;\n"
        "      color: var(--muted);\n"
        "    }\n"
        "    .pdf-layout-fold > summary::-webkit-details-marker { display: none; }\n"
        "    .pdf-layout-fold > summary:hover { color: var(--text); }\n"
        "    .pdf-layout-fold > summary::after {\n"
        "      content: '';\n"
        "      position: absolute;\n"
        "      right: 4px;\n"
        "      top: 50%;\n"
        "      width: 6px;\n"
        "      height: 6px;\n"
        "      border-right: 2px solid var(--muted);\n"
        "      border-bottom: 2px solid var(--muted);\n"
        "      transform: translateY(-70%) rotate(45deg);\n"
        "    }\n"
        "    .pdf-layout-fold[open] > summary::after { transform: translateY(-30%) rotate(225deg); }")

    rep("persist lastFormat",
        "          pdfSmartBreaks: el.pdfSmartBreaks ? el.pdfSmartBreaks.value !== 'grid' : true\n"
        "        };",
        "          pdfSmartBreaks: el.pdfSmartBreaks ? el.pdfSmartBreaks.value !== 'grid' : true,\n"
        "          // Remembered so the PDF layout fold can open itself for those who use it.\n"
        "          lastFormat: state.export?.lastFormat || ''\n"
        "        };")

    rep("record lastFormat on export",
        "      async function exportDiagram(format) {\n"
        "        persistExportSettings();\n"
        "        const descriptor = getExportDescriptor(format);",
        "      async function exportDiagram(format) {\n"
        "        persistExportSettings();\n"
        "        state.export.lastFormat = format;\n"
        "        const descriptor = getExportDescriptor(format);")

    # ------------------------------------------------------------------
    # 8. Review and sign-off had two competing blue primaries. The decision
    #    (Approve) keeps the fill; the exit (Done) goes quiet.
    # ------------------------------------------------------------------
    rep("review one primary",
        '<button class="btn" id="closeReviewFooter" type="button">Done</button>',
        '<button class="btn ghost" id="closeReviewFooter" type="button">Done</button>')

    # ------------------------------------------------------------------
    # 9. Light dismiss for the non-committal dialogs only. closedby="any"
    #    lets a click on the backdrop close read-only surfaces; confirms,
    #    forms and sign-off keep the default so a stray click cannot
    #    discard typed input or skip a decision.
    # ------------------------------------------------------------------
    for dialog_tag in [
        '<dialog class="guide-dialog" id="guideDialog" aria-labelledby="guideDialogTitle">',
        '<dialog id="analysisDialog" aria-labelledby="analysisDialogTitle">',
        '<dialog id="versionsDialog" aria-labelledby="versionsDialogTitle">',
        '<dialog id="importDialog" aria-labelledby="importDialogTitle">',
        '<dialog id="wpImportDialog" aria-labelledby="wpImportDialogTitle">',
        '<dialog id="wpExportDialog" aria-labelledby="wpExportDialogTitle">',
        '<dialog id="wpImportReportDialog" aria-labelledby="wpImportReportTitle">',
        '<dialog class="comments-dialog" id="commentsDialog" aria-labelledby="commentsDialogTitle">',
        '<dialog id="undoHistoryDialog" aria-labelledby="undoHistoryTitle">',
        '<dialog id="coverageDialog" aria-labelledby="coverageDialogTitle">',
    ]:
        rep("closedby " + dialog_tag[dialog_tag.index('id="') + 4:].split('"')[0],
            dialog_tag,
            dialog_tag[:-1] + ' closedby="any">')

    # ------------------------------------------------------------------
    # 10. House rules and Undo history existed only behind Ctrl+K. House
    #     rules joins its siblings in Quality checks; Undo history gets a
    #     small drop next to the undo/redo pair it extends.
    # ------------------------------------------------------------------
    rep("house rules button markup",
        '                  <button class="btn ghost compact" id="rulesButton" type="button" title="Automatic colouring rules. Example: paint every block whose status metadata is Issue in red, without styling them one by one.">Auto-format rules</button>',
        '                  <button class="btn ghost compact" id="rulesButton" type="button" title="Automatic colouring rules. Example: paint every block whose status metadata is Issue in red, without styling them one by one.">Auto-format rules</button>\n'
        '                  <button class="btn ghost compact" id="houseRulesButton" type="button" title="Workspace conventions checked by every analysis: label length, chain length, decision labels, entry points, owners and statuses.">House rules</button>')

    rep("undo history button markup",
        '              <button class="btn ghost icon" id="redoButton" type="button" title="Redo the last undone change" aria-label="Redo the last undone change">↷</button>',
        '              <button class="btn ghost icon" id="redoButton" type="button" title="Redo the last undone change" aria-label="Redo the last undone change">↷</button>\n'
        '              <button class="btn ghost icon" id="undoHistoryButton" type="button" title="Undo history — every step this session, jump back to any of them" aria-label="Undo history">▾</button>')

    rep("house rules registry",
        "'houseRulesDialog','closeHouseRules',",
        "'houseRulesDialog','houseRulesButton','closeHouseRules',")

    rep("undo history registry",
        "'undoHistoryDialog','closeUndoHistory','closeUndoHistoryFooter','undoHistoryList',",
        "'undoHistoryDialog','undoHistoryButton','closeUndoHistory','closeUndoHistoryFooter','undoHistoryList',")

    rep("house rules wiring",
        "        el.rulesButton.addEventListener('click', openRulesDialog);",
        "        el.rulesButton.addEventListener('click', openRulesDialog);\n"
        "        // Previously reachable only through the command palette; an auditor sets\n"
        "        // these once per engagement, so they get a visible door beside Analyse.\n"
        "        if (el.houseRulesButton) el.houseRulesButton.addEventListener('click', () => { renderHouseRulesForm(); showDialog(el.houseRulesDialog); });")

    rep("undo history wiring",
        "        el.redoButton.addEventListener('click', redoSource);",
        "        el.redoButton.addEventListener('click', redoSource);\n"
        "        // Previously reachable only through the command palette.\n"
        "        if (el.undoHistoryButton) el.undoHistoryButton.addEventListener('click', () => { renderUndoHistory(); showDialog(el.undoHistoryDialog); });")

    # ------------------------------------------------------------------
    # 11a. Phone: the export filename field was squeezed to a third of the
    #      dialog by its nowrap label. Stack them under 520px.
    # ------------------------------------------------------------------
    rep("export name row 520px",
        "      .layout-switch .layout-choice { flex: 1 1 50%; }\n"
        "      .layout-hint { flex-basis: 100%; }\n"
        "    }",
        "      .layout-switch .layout-choice { flex: 1 1 50%; }\n"
        "      .layout-hint { flex-basis: 100%; }\n"
        "      /* 'File name for exports' + a 165px input clipped the value on a phone. */\n"
        "      .export-name-row { grid-template-columns: 1fr; gap: 6px; }\n"
        "      .export-name-row label { white-space: normal; }\n"
        "    }")

    # ------------------------------------------------------------------
    # 11b. Phone: Review, Comments, Compare and Present lose their desktop
    #      buttons under 900px and Ctrl+K is not a phone gesture. A sixth
    #      mobile-nav slot folds them into the existing structure menu.
    # ------------------------------------------------------------------
    rep("mobile nav more button markup",
        '      <button id="mobileExportButton" type="button"><span class="nav-icon" aria-hidden="true">⇩</span><span>Export</span></button>\n'
        "    </nav>",
        '      <button id="mobileExportButton" type="button"><span class="nav-icon" aria-hidden="true">⇩</span><span>Export</span></button>\n'
        '      <button id="mobileMoreButton" type="button" aria-haspopup="menu"><span class="nav-icon" aria-hidden="true">⋯</span><span>More</span></button>\n'
        "    </nav>")

    rep("mobile nav six columns",
        "      .mobile-nav {\n"
        "        z-index: 60;\n"
        "        display: grid;\n"
        "        grid-template-columns: repeat(5, minmax(0, 1fr));",
        "      .mobile-nav {\n"
        "        z-index: 60;\n"
        "        display: grid;\n"
        "        grid-template-columns: repeat(6, minmax(0, 1fr));")

    rep("mobile nav read-only hides more",
        "    body.read-only-mode .mobile-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }",
        "    /* Review, compare and comments are editing verbs; the read-only share view\n"
        "       keeps its four-slot nav untouched. */\n"
        "    body.read-only-mode #mobileMoreButton { display:none !important; }\n"
        "    body.read-only-mode .mobile-nav { grid-template-columns: repeat(4, minmax(0, 1fr)); }")

    rep("mobile more registry",
        "'mobileEditorTab','mobilePreviewTab','mobileGuideButton','mobileRenderButton','mobileExportButton','fileImport',",
        "'mobileEditorTab','mobilePreviewTab','mobileGuideButton','mobileRenderButton','mobileExportButton','mobileMoreButton','fileImport',")

    rep("mobile more wiring",
        "        el.mobileExportButton.addEventListener('click', openExportDialog);",
        "        el.mobileExportButton.addEventListener('click', openExportDialog);\n"
        "        // Review, Comments, Compare and Present lose their desktop buttons under\n"
        "        // 900px; this menu keeps them one tap away instead of Ctrl+K-only.\n"
        "        if (el.mobileMoreButton) el.mobileMoreButton.addEventListener('click', () => {\n"
        "          openStructureMenu(el.mobileMoreButton, [\n"
        "            ['review', 'Review and sign-off…'],\n"
        "            ['comments', 'Review comments…'],\n"
        "            ['compare', 'Compare diagrams…'],\n"
        "            ['present', 'Present — the Map']\n"
        "          ], '', value => {\n"
        "            if (value === 'review') openReviewDialog('diagram');\n"
        "            else if (value === 'comments') openCommentsDialog();\n"
        "            else if (value === 'compare') openCompareDialog();\n"
        "            else if (value === 'present') openPresentation();\n"
        "          });\n"
        "        });")

    # ------------------------------------------------------------------
    # 11c. Docs opened with focus in the search box, so the first Escape
    #      only blurred it and the surface stayed put despite the tooltip's
    #      promise. Focus the document region instead.
    # ------------------------------------------------------------------
    rep("docs open focus",
        "          (state.workpapers.length ? el.wpSearch : el.wpEmptyNewButton)?.focus();",
        "          // Landing in the search box ate the first Escape (it only blurs; the\n"
        "          // second closes). The document region takes focus instead, so Esc\n"
        "          // closes the surface exactly as the Back button's tooltip promises.\n"
        "          if (state.workpapers.length) { if (el.wpDoc) { el.wpDoc.tabIndex = -1; el.wpDoc.focus(); } }\n"
        "          else el.wpEmptyNewButton?.focus();")

    # ------------------------------------------------------------------
    # Atomic write.
    # ------------------------------------------------------------------
    directory = os.path.dirname(os.path.abspath(path)) or "."
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        os.replace(tmp_path, path)
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

    print(f"fix_dialogs: {len(applied)} replacements applied to {path}")
    for name in applied:
        print(f"  - {name}")

if __name__ == "__main__":
    main()
