#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SIREN editor-pane fixes (critique plan items 1, 3, 8-editor, 9, 10 + editor findings).

Applies anchor-guarded string replacements to the SIREN single-file app:
  1.  Shape wall collapsed: Add button moved above the fold and named after the
      chosen shape; #recentShapes seeded with 6 defaults; 14-tile palette folded
      behind a "More shapes" menu (openStructureMenu).
  2.  Mode switch selected state promoted to var(--primary); Text/Guided and
      Vertical/Horizontal sub-switches demoted to the pill treatment.
  3.  Block inspector clamped below the preview toolbar; its action row (Done)
      is sticky so it can never scroll itself off screen.
  4.  Visual tab gets the honest disabled treatment for diagram types the
      builder does not cover, with the reason in its title.
  5.  One home per concept: Edit-a-block Shape select folded into the shared
      shape menu; sidebar per-block style grid folded behind the inspector;
      duplicate starter library and Advanced direction folded away.
  6.  Docs is a plain button beside undo/redo, not a fake third tab.
  7.  Guided mode: row actions visible at rest, clickable tokens are chips,
      one-line hint added above the rows.
  8.  Connector list rows lead with human names, Mermaid code demoted.
  9.  Block/connector lists no longer cap at 320px.
  10. Narrow panes keep ⇢ Connect and ▢ Hide panel in the preview toolbar.

Usage: python fix_editor.py <path-to-T_Industries_SIREN_v1.html>
Every replacement asserts its exact occurrence count BEFORE replacing; the file
is written atomically via tmp + os.replace. Exits non-zero if any anchor drifts.
"""
import io
import os
import sys
import tempfile

def main():
    if len(sys.argv) != 2:
        print('usage: fix_editor.py <target.html>', file=sys.stderr)
        return 2
    path = sys.argv[1]
    with io.open(path, encoding='utf-8') as fh:
        text = fh.read()

    applied = []
    failed = []

    def rep(name, old, new, count=1):
        nonlocal text
        found = text.count(old)
        if found != count:
            failed.append('%s: expected %d occurrence(s), found %d' % (name, count, found))
            return
        text = text.replace(old, new)
        applied.append(name)

    # ------------------------------------------------------------------
    # ITEM 2 (plan item 3): one selected-state hierarchy.
    # Mode switch (which pane am I in) takes the primary fill...
    rep('css-mode-selected',
        '.editor-mode-button[aria-selected="true"] {\n'
        '      background: var(--panel-elevated);\n'
        '      color: var(--text);\n'
        '      box-shadow: 0 1px 5px rgba(0, 0, 0, .28), inset 0 0 0 1px var(--border);\n'
        '    }',
        '.editor-mode-button[aria-selected="true"] {\n'
        '      /* The top-level mode decides which workflow the pane is: it carries the\n'
        '         one primary fill so it can never whisper under its own sub-toggles. */\n'
        '      background: var(--primary);\n'
        '      color: var(--primary-text);\n'
        '      box-shadow: none;\n'
        '    }')

    # ...and the sub-switches (Text/Guided, Vertical/Horizontal share this rule)
    # step down to the pill treatment the diagram tabs already use.
    rep('css-layout-selected',
        '.layout-switch .layout-choice[aria-pressed="true"] {\n'
        '      border-color: color-mix(in srgb, var(--primary) 72%, var(--border));\n'
        '      background: var(--primary); color: var(--primary-text);\n'
        '    }',
        '.layout-switch .layout-choice[aria-pressed="true"] {\n'
        '      /* Pill treatment (same recipe as the selected diagram tab): the sub-view\n'
        '         toggles must not out-shout the mode switch that contains them. */\n'
        '      border-color: color-mix(in srgb, var(--primary) 55%, var(--border));\n'
        '      background: var(--pill-bg); color: var(--pill-text);\n'
        '    }')

    # ------------------------------------------------------------------
    # ITEM 4: honest unavailable treatment for the Visual tab (matches the
    # .layout-switch .layout-choice:disabled opacity used by Vertical/Horizontal).
    rep('css-mode-unavailable',
        '.editor-mode-button:hover { color: var(--text); }',
        '.editor-mode-button:hover { color: var(--text); }\n'
        '    .editor-mode-button.is-unavailable { opacity: .45; cursor: not-allowed; }')

    rep('js-visual-tab-honesty',
        "// The tab names itself after the builder it actually opens.\n"
        "        el.visualModeButton.textContent = sequence ? '⇄ Sequence' : '▦ Visual';",
        "// The tab names itself after the builder it actually opens.\n"
        "        el.visualModeButton.textContent = sequence ? '⇄ Sequence' : '▦ Visual';\n"
        "        // An honest tab: when the visual builder cannot serve this diagram type it\n"
        "        // says so on the tab itself, instead of glowing and then landing in Code.\n"
        "        const sourceType = detectDiagramType(el.source?.value || '') || '';\n"
        "        const builds = sequence || /^(flowchart|graph)$/i.test(sourceType);\n"
        "        el.visualModeButton.classList.toggle('is-unavailable', !builds);\n"
        "        el.visualModeButton.setAttribute('aria-disabled', String(!builds));\n"
        "        el.visualModeButton.title = builds\n"
        "          ? 'Visual builder: blocks and connectors through forms, no code'\n"
        "          : `The visual builder does not cover ${sourceType || 'this kind of'} diagrams — edit this one in Code.`;")

    # ------------------------------------------------------------------
    # ITEM 6 (plan item 9): Docs is a destination, not a tab. Move it out of the
    # tablist so the tablist has exactly one tab stop (roving tabindex is already
    # correct for Visual/Code in syncEditorPanels).
    rep('html-docs-button-move',
        '              <button class="editor-mode-button" id="workpapersButton" type="button" role="tab" aria-selected="false" title="Documentation and agent specs (workpapers), full screen">▤ Docs<span class="wp-docs-count" id="workpapersCount"></span></button>\n'
        '            </div>\n'
        '            <div class="editor-mode-history">',
        '            </div>\n'
        '            <div class="editor-mode-history">\n'
        '              <button class="btn ghost compact" id="workpapersButton" type="button" aria-haspopup="dialog" aria-expanded="false" title="Documentation and agent specs (workpapers), full screen">▤ Docs<span class="wp-docs-count" id="workpapersCount"></span></button>')

    rep('css-mode-switch-2col',
        'grid-template-columns: repeat(3, minmax(0, 1fr));\n      flex: 1 1 auto;',
        'grid-template-columns: repeat(2, minmax(0, 1fr));\n      flex: 1 1 auto;')

    rep('css-docs-count-selector',
        '.editor-mode-button .wp-docs-count { margin-left: 6px; }',
        '.editor-mode-button .wp-docs-count, .editor-mode-history .wp-docs-count { margin-left: 6px; }')

    rep('css-docs-button-in-history',
        '    .editor-mode-history .btn {',
        '    /* Docs lives beside undo/redo as a plain button; it needs text metrics,\n'
        '       not the square icon-button ones. */\n'
        '    .editor-mode-history #workpapersButton { padding: 0 10px; font-size: 12px; font-weight: 800; }\n'
        '    .editor-mode-history .btn {')

    rep('js-docs-no-aria-selected',
        'if (el.workpapersButton) {\n'
        "          el.workpapersButton.setAttribute('aria-expanded', String(Boolean(open)));\n"
        "          el.workpapersButton.setAttribute('aria-selected', String(Boolean(open)));\n"
        '        }',
        'if (el.workpapersButton) {\n'
        '          // Docs is a plain button opening a full-screen view, not a tab in the\n'
        '          // mode tablist: it carries expanded state, never tab selection.\n'
        "          el.workpapersButton.setAttribute('aria-expanded', String(Boolean(open)));\n"
        '        }')

    rep('js-tour-step-text',
        "{ sel: '.editor-mode-switch', title: 'Three ways in', text: 'Visual builds with forms, Code edits Mermaid directly, Docs holds your documentation and agent specs. All three work on the same project.' },",
        "{ sel: '.editor-mode-switch', title: 'Two ways in', text: 'Visual builds with forms; Code edits Mermaid directly. The ▤ Docs button beside them opens your documentation and agent specs - all working on the same project.' },")

    # ------------------------------------------------------------------
    # ITEM 1 (plan item 1, top ranked): the primary action above the fold.
    # Move the Add button directly under the label field; always-on 6-shape
    # picker; the 14-tile wall folds away.
    rep('html-add-button-up',
        '<div class="recent-shapes" id="recentShapes" hidden></div>\n'
        '                  <div class="visual-shape-palette" id="visualShapePalette" role="group" aria-label="Choose block shape">',
        '<button class="btn secondary" id="addVisualNodeButton" type="button">＋ Add Process block</button>\n'
        '                  <div class="recent-shapes" id="recentShapes"></div>\n'
        '                  <div class="visual-shape-palette" id="visualShapePalette" role="group" aria-label="Choose block shape" hidden>')

    rep('html-more-shapes-button',
        '                  <button class="btn secondary" id="addVisualNodeButton" type="button">＋ Add block</button>',
        '                  <button class="btn ghost compact" id="moreShapesButton" type="button" aria-haspopup="listbox" title="All 14 block shapes">More shapes ▾</button>',
        count=1)

    rep('css-recent-pressed',
        '.recent-shape:hover { border-color: var(--primary); color: var(--text); }',
        '.recent-shape:hover { border-color: var(--primary); color: var(--text); }\n'
        '    .recent-shape[aria-pressed="true"] {\n'
        '      border-color: var(--primary);\n'
        '      background: color-mix(in srgb, var(--primary) 15%, var(--input-bg));\n'
        '      color: var(--text);\n'
        '    }')

    # Collapsed sections must not stretch to the height of their row partner.
    rep('css-builder-grid-start',
        '.visual-builder-grid {\n'
        '      display: grid;\n'
        '      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));\n'
        '      gap: 12px;\n'
        '    }',
        '.visual-builder-grid {\n'
        '      display: grid;\n'
        '      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));\n'
        '      gap: 12px;\n'
        '      /* A collapsed section keeps its header height instead of stretching to\n'
        '         its row partner and leaving a tall empty box where the eye lands. */\n'
        '      align-items: start;\n'
        '    }')

    # renderRecentShapes: seeded, never hidden, delegation-friendly buttons.
    rep('js-render-recent-shapes',
        "      function renderRecentShapes() {\n"
        "        if (!el.recentShapes) return;\n"
        "        const list = readRecents().shape || [];\n"
        "        el.recentShapes.replaceChildren();\n"
        "        el.recentShapes.hidden = list.length < 2;\n"
        "        if (list.length < 2) return;\n"
        "        const label = document.createElement('span');\n"
        "        label.className = 'recent-label';\n"
        "        label.textContent = 'Recent';\n"
        "        el.recentShapes.appendChild(label);\n"
        "        list.forEach(shape => {\n"
        "          const button = document.createElement('button');\n"
        "          button.type = 'button';\n"
        "          button.className = 'recent-shape';\n"
        "          button.title = shapeDisplayName(shape);\n"
        "          button.setAttribute('aria-label', `Use ${shapeDisplayName(shape)}`);\n"
        "          const preview = document.createElement('span');\n"
        "          preview.className = `shape-preview ${shape}`;\n"
        "          preview.setAttribute('aria-hidden', 'true');\n"
        "          button.appendChild(preview);\n"
        "          button.addEventListener('click', () => setVisualPendingShape(shape));\n"
        "          el.recentShapes.appendChild(button);\n"
        "        });\n"
        "      }",
        "      function renderRecentShapes() {\n"
        "        if (!el.recentShapes) return;\n"
        "        // Seeded with the six shapes an auditor actually reaches for, so the picker\n"
        "        // is never empty and the 14-tile wall stays folded behind More shapes.\n"
        "        const defaults = ['rect', 'rounded', 'diamond', 'stadium', 'cylinder', 'subroutine'];\n"
        "        const list = [...new Set([...(readRecents().shape || []), ...defaults])].slice(0, 6);\n"
        "        el.recentShapes.replaceChildren();\n"
        "        el.recentShapes.hidden = false;\n"
        "        const label = document.createElement('span');\n"
        "        label.className = 'recent-label';\n"
        "        label.textContent = 'Shape';\n"
        "        el.recentShapes.appendChild(label);\n"
        "        list.forEach(shape => {\n"
        "          const button = document.createElement('button');\n"
        "          button.type = 'button';\n"
        "          button.className = 'recent-shape';\n"
        "          button.dataset.shape = shape;\n"
        "          button.title = shapeDisplayName(shape);\n"
        "          button.setAttribute('aria-label', `Use ${shapeDisplayName(shape)}`);\n"
        "          button.setAttribute('aria-pressed', String(shape === visualPendingShape));\n"
        "          const preview = document.createElement('span');\n"
        "          preview.className = `shape-preview ${shape}`;\n"
        "          preview.setAttribute('aria-hidden', 'true');\n"
        "          button.appendChild(preview);\n"
        "          el.recentShapes.appendChild(button);\n"
        "        });\n"
        "      }")

    # setVisualPendingShape: state first (recency re-renders the picker), sync
    # every shape host, and let the Add button name the shape it will create.
    rep('js-set-pending-shape',
        "      function setVisualPendingShape(shape) {\n"
        "        if (typeof pushRecent === 'function' && shape) pushRecent('shape', shape);\n"
        "        visualPendingShape = NODE_SHAPES.includes(shape) ? shape : 'rect';\n"
        "        el.visualShapePalette.querySelectorAll('[data-shape]').forEach(button => {\n"
        "          button.setAttribute('aria-pressed', String(button.dataset.shape === visualPendingShape));\n"
        "        });\n"
        "      }",
        "      function setVisualPendingShape(shape) {\n"
        "        visualPendingShape = NODE_SHAPES.includes(shape) ? shape : 'rect';\n"
        "        // Recency re-renders the picker, so the state must be settled first.\n"
        "        if (typeof pushRecent === 'function' && shape) pushRecent('shape', visualPendingShape);\n"
        "        [el.visualShapePalette, el.recentShapes].forEach(host => {\n"
        "          if (!host) return;\n"
        "          host.querySelectorAll('[data-shape]').forEach(button => {\n"
        "            button.setAttribute('aria-pressed', String(button.dataset.shape === visualPendingShape));\n"
        "          });\n"
        "        });\n"
        "        // The primary action names its outcome: \"+ Add Decision block\".\n"
        "        if (el.addVisualNodeButton) el.addVisualNodeButton.textContent = `＋ Add ${shapeDisplayName(visualPendingShape)} block`;\n"
        "      }")

    rep('js-bind-shape-picker',
        "el.visualShapePalette.addEventListener('click', handleVisualShapePaletteClick);\n"
        "        el.addVisualNodeButton.addEventListener('click', addVisualNode);",
        "el.visualShapePalette.addEventListener('click', handleVisualShapePaletteClick);\n"
        "        // The seeded picker row shares the palette's delegation; the long tail of\n"
        "        // shapes lives in one menu built on the house primitive.\n"
        "        if (el.recentShapes) el.recentShapes.addEventListener('click', handleVisualShapePaletteClick);\n"
        "        if (el.moreShapesButton) el.moreShapesButton.addEventListener('click', () => {\n"
        "          openStructureMenu(el.moreShapesButton, structureShapeChoices(), visualPendingShape, shape => setVisualPendingShape(shape));\n"
        "        });\n"
        "        el.addVisualNodeButton.addEventListener('click', addVisualNode);")

    rep('js-register-more-shapes',
        "'batchButton','recentShapes','layoutEngineSelect',",
        "'batchButton','recentShapes','moreShapesButton','layoutEngineSelect',")

    # ------------------------------------------------------------------
    # ITEM 5a (plan item 8, editor half): the Edit-a-block Shape select was a
    # byte-identical copy of the palette 180px away. It becomes a menu button
    # that reuses the shared shape menu and applies immediately.
    start = text.find('<select id="visualNodeEditShape">')
    if start == -1:
        failed.append('html-edit-shape-menu: opening tag not found')
    else:
        end = text.find('</select>', start)
        span = text[start:end + len('</select>')]
        if end == -1 or len(span) > 1400 or 'trapezoidAlt' not in span:
            failed.append('html-edit-shape-menu: select span looks wrong (%d chars)' % len(span))
        else:
            text = text[:start] + (
                '<button class="btn ghost compact" id="visualNodeEditShape" type="button" value="rect" aria-haspopup="listbox" title="Change the shape of the selected block — applies immediately">Process ▾</button>'
            ) + text[end + len('</select>'):]
            applied.append('html-edit-shape-menu')

    rep('js-edit-shape-face',
        "el.visualNodeEditLabel.value = selected?.label || '';\n"
        "        el.visualNodeEditShape.value = selected?.shape || 'rect';",
        "el.visualNodeEditLabel.value = selected?.label || '';\n"
        "        el.visualNodeEditShape.value = selected?.shape || 'rect';\n"
        "        // The Shape control is a menu button now; its face names the value it holds.\n"
        "        el.visualNodeEditShape.textContent = `${shapeDisplayName(selected?.shape || 'rect')} ▾`;")

    rep('js-edit-shape-menu-open',
        "el.updateVisualNodeButton.addEventListener('click', updateVisualNode);\n"
        "        el.visualNodeEditLabel.addEventListener('keydown', event => {",
        "el.updateVisualNodeButton.addEventListener('click', updateVisualNode);\n"
        "        // One home per concept: Shape opens the same menu the picker uses and\n"
        "        // applies to the selected block immediately.\n"
        "        el.visualNodeEditShape.addEventListener('click', () => {\n"
        "          openStructureMenu(el.visualNodeEditShape, structureShapeChoices(), el.visualNodeEditShape.value, shape => {\n"
        "            const model = parseVisualFlowchartSource(el.source.value);\n"
        "            if (!model.compatible) return;\n"
        "            const node = model.nodes.find(item => item.id === el.visualNodeSelect.value);\n"
        "            if (!node) return;\n"
        "            node.shape = shape;\n"
        "            applyVisualModel(model, 'Visual block shape changed', node.id);\n"
        "            showToast('Block shape updated.', 'success');\n"
        "          });\n"
        "        });\n"
        "        el.visualNodeEditLabel.addEventListener('keydown', event => {",
        )

    # ------------------------------------------------------------------
    # ITEM 5b: the sidebar per-block style grid duplicated the inspector
    # one-for-one. Fold the duplicates (elements stay in the DOM: the inspector
    # reads and writes them), keep the Block chooser, and open the inspector
    # from it. "Sidebar settings" existed only to bridge the duplication.
    for field in ['nodeFillColor', 'nodeBorderColor', 'nodeTextColor', 'nodeShape',
                  'nodeFontFamily', 'nodeFontSize', 'nodeFontWeight']:
        rep('html-fold-%s' % field,
            '                    <div>\n                      <label for="%s">' % field,
            '                    <div hidden>\n                      <label for="%s">' % field)

    rep('html-fold-swatches',
        '<div class="swatch-row" id="paletteSwatches" role="group" aria-label="Accessible fill colours"></div>',
        '<div class="swatch-row" id="paletteSwatches" role="group" aria-label="Accessible fill colours" hidden></div>')

    rep('html-fold-apply-node-style',
        '<button class="btn secondary compact" id="applyNodeStyleButton" type="button">Apply to block</button>',
        '<button class="btn secondary compact" id="applyNodeStyleButton" type="button" hidden>Apply to block</button>')

    rep('html-fold-reset-node-style',
        '<button class="btn ghost compact" id="resetNodeStyleButton" type="button">Reset block</button>',
        '<button class="btn ghost compact" id="resetNodeStyleButton" type="button" hidden>Reset block</button>')

    rep('html-block-styling-head',
        '<div><strong>Block styling</strong><span>Select a block here or click a block in the preview, then change its colours and font.</span></div>',
        '<div><strong>Block styling</strong><span>Pick a block here or click one in the preview — its colours, shape and font are edited in place in the block inspector.</span></div>')

    rep('js-node-style-target-opens-inspector',
        "el.nodeStyleTarget.addEventListener('change', loadSelectedNodeStyleControls);",
        "el.nodeStyleTarget.addEventListener('change', () => {\n"
        "          loadSelectedNodeStyleControls();\n"
        "          // The duplicated sidebar style grid is folded away: picking a block here\n"
        "          // opens the block inspector, the one home for per-block styling.\n"
        "          if (el.nodeStyleTarget.value) openNodeInspector(el.nodeStyleTarget.value);\n"
        "        });")

    rep('html-hide-inspector-more',
        '<button class="btn secondary compact" id="inspectorMoreButton" type="button">Sidebar settings</button>',
        '<button class="btn secondary compact" id="inspectorMoreButton" type="button" hidden>Sidebar settings</button>')

    # ITEM 5c: template picking existed twice with the same six values.
    rep('html-fold-starter-library',
        '<div class="starter-library" aria-label="Reusable Mermaid starter library">',
        '<div class="starter-library" aria-label="Reusable Mermaid starter library" hidden>')

    # ITEM 5d: flow direction was settable in four places; the settings copy
    # only added a TB alias of TD. #visualDirection and the layout buttons stay.
    rep('html-fold-advanced-direction',
        '<div>\n                  <label for="direction">Advanced direction</label>',
        '<div hidden>\n                  <label for="direction">Advanced direction</label>')

    # ------------------------------------------------------------------
    # ITEM 10 relabels: two controls both read "Connector style".
    # "Arrow type" matches the connector inspector's existing label for the
    # identical option set, so the concept has exactly one name in the pane.
    rep('html-label-arrow-type',
        '<label for="visualEdgeType">Connector style</label>',
        '<label for="visualEdgeType">Arrow type</label>')

    rep('html-label-connector-curve',
        '<label for="curve">Connector style</label>',
        '<label for="curve">Connector curve</label>')

    rep('html-option-follow-curve',
        '<option value="inherit">Use connector style</option>',
        '<option value="inherit">Follow connector curve</option>')

    # ------------------------------------------------------------------
    # ITEM 3: the block inspector must never cover the toolbar it belongs to,
    # nor its own Done button.
    rep('js-inspector-clear-maxheight',
        "panel.style.left = '';\n"
        "          panel.style.top = '';\n"
        "          panel.style.right = '';\n"
        "          panel.style.bottom = '';\n"
        "          return;",
        "panel.style.left = '';\n"
        "          panel.style.top = '';\n"
        "          panel.style.right = '';\n"
        "          panel.style.bottom = '';\n"
        "          panel.style.maxHeight = '';\n"
        "          return;")

    rep('js-inspector-toolbar-clamp',
        'const gap = 12;\n'
        '        const margin = 12;\n'
        '        const minLeft = viewportLeft + margin;\n'
        '        const maxRight = viewportLeft + viewportWidth - margin;\n'
        '        const minTop = viewportTop + margin;',
        'const gap = 12;\n'
        '        const margin = 12;\n'
        '        // The inspector serves the canvas below the preview toolbar; letting it\n'
        '        // rise over the toolbar hid the zoom and layout controls it works with.\n'
        "        const toolbar = document.querySelector('.preview-toolbar');\n"
        '        const toolbarRect = toolbar && toolbar.offsetParent ? toolbar.getBoundingClientRect() : null;\n'
        '        const minLeft = viewportLeft + margin;\n'
        '        const maxRight = viewportLeft + viewportWidth - margin;\n'
        '        const minTop = Math.max(viewportTop + margin, toolbarRect ? toolbarRect.bottom + gap : 0);')

    rep('js-inspector-maxheight',
        "top = clamp(top, minTop, Math.max(minTop, maxBottom - panelRect.height));\n"
        "        panel.style.right = '';",
        "top = clamp(top, minTop, Math.max(minTop, maxBottom - panelRect.height));\n"
        "        // Cap the panel to the room actually left below its clamped top, so the\n"
        "        // sticky action row (and Done) can never land outside the viewport.\n"
        "        panel.style.maxHeight = `${Math.round(Math.min(610, Math.max(220, maxBottom - top)))}px`;\n"
        "        panel.style.right = '';")

    rep('css-inspector-padding',
        'padding: 12px;\n      scrollbar-gutter: stable;',
        'padding: 12px 12px 0;\n      scrollbar-gutter: stable;')

    rep('css-inspector-sticky-actions',
        '.node-inspector-actions {\n'
        '      display: flex;\n'
        '      justify-content: space-between;\n'
        '      gap: 8px;\n'
        '      margin-top: 11px;\n'
        '      padding-top: 10px;\n'
        '      border-top: 1px solid var(--border);\n'
        '    }',
        '.node-inspector-actions {\n'
        '      /* The action row rides the bottom of the panel scroll, so Done is always\n'
        '         on screen no matter how much the sections above it unfold. */\n'
        '      position: sticky;\n'
        '      bottom: 0;\n'
        '      z-index: 2;\n'
        '      display: flex;\n'
        '      justify-content: space-between;\n'
        '      gap: 8px;\n'
        '      margin: 11px -12px 0;\n'
        '      padding: 10px 12px 12px;\n'
        '      border-top: 1px solid var(--border);\n'
        '      background: var(--ui-dialog-bg);\n'
        '    }')

    # ------------------------------------------------------------------
    # ITEM 7: Guided mode readable at rest.
    rep('css-struct-actions-visible',
        '.struct-line-actions { display: flex; gap: 2px; opacity: 0; transition: opacity .12s ease; }',
        '/* Half-visible at rest so a mouse user can discover the row tools exist;\n'
        '       full strength on hover or keyboard focus. */\n'
        '    .struct-line-actions { display: flex; gap: 2px; opacity: .55; transition: opacity .12s ease; }')

    rep('css-struct-token-chip',
        '.struct-token[role="button"] { cursor: pointer; border-bottom: 1px dotted color-mix(in srgb, var(--primary) 55%, transparent); }',
        '/* Clickable parts read as chips, not as a 1px dotted whisper: the tint also\n'
        '       lifts 9×16px tokens to the 24px interaction floor. */\n'
        '    .struct-token[role="button"] {\n'
        '      cursor: pointer;\n'
        '      display: inline-flex;\n'
        '      align-items: center;\n'
        '      justify-content: center;\n'
        '      min-height: 24px;\n'
        '      min-width: 24px;\n'
        '      padding: 2px 5px;\n'
        '      border-radius: 4px;\n'
        '      background: color-mix(in srgb, var(--primary) 14%, transparent);\n'
        '    }')

    rep('css-struct-hint',
        '#structureRows { background: var(--panel-bg); }',
        '#structureRows { background: var(--panel-bg); }\n'
        '    .struct-guide-hint { margin: 0 0 7px; padding: 0 2px; color: var(--muted); font-size: 11px; line-height: 1.4; }')

    rep('html-struct-hint',
        '<div class="structure-editor" id="structureEditor" hidden aria-label="Structured editor">\n'
        '              <div class="structure-rows" id="structureRows" role="list" aria-label="Diagram lines"></div>',
        '<div class="structure-editor" id="structureEditor" hidden aria-label="Structured editor">\n'
        '              <p class="struct-guide-hint">Click any blue chip to change it — labels, shapes and connectors are edited where they sit.</p>\n'
        '              <div class="structure-rows" id="structureRows" role="list" aria-label="Diagram lines"></div>')

    # ------------------------------------------------------------------
    # ITEM 8: connector rows lead with human names in "Build without code".
    rep('js-edge-list-human-first',
        "          const route = document.createElement('strong');\n"
        "          route.textContent = `${edge.from} ${edge.type} ${edge.to}`;\n"
        "          const meta = document.createElement('small');\n"
        "          meta.textContent = edge.label\n"
        "            ? `${labels.get(edge.from) || edge.from} → ${labels.get(edge.to) || edge.to} · “${edge.label}”`\n"
        "            : `${labels.get(edge.from) || edge.from} → ${labels.get(edge.to) || edge.to}`;",
        "          // Human route first, Mermaid code second — matching the block rows, in\n"
        "          // the mode whose whole promise is \"build without code\".\n"
        "          const route = document.createElement('strong');\n"
        "          route.textContent = edge.label\n"
        "            ? `${labels.get(edge.from) || edge.from} → ${labels.get(edge.to) || edge.to} · “${edge.label}”`\n"
        "            : `${labels.get(edge.from) || edge.from} → ${labels.get(edge.to) || edge.to}`;\n"
        "          const meta = document.createElement('small');\n"
        "          meta.textContent = `${edge.from} ${edge.type} ${edge.to}`;")

    # ------------------------------------------------------------------
    # ITEM 9: no inner 320px scrollbox inside an already-scrolling pane.
    rep('css-visual-list-grow',
        '.visual-list {\n'
        '      display: grid;\n'
        '      gap: 6px;\n'
        '      /* Long diagrams stay reachable without stretching the column: the list scrolls\n'
        '         inside itself past this height. */\n'
        '      max-height: 320px;\n'
        '      overflow-y: auto;\n'
        '      scrollbar-width: thin;\n'
        '    }',
        '.visual-list {\n'
        '      display: grid;\n'
        '      gap: 6px;\n'
        '      /* The pane already scrolls as one surface; an inner 320px scrollbox clipped\n'
        '         rows mid-height and read as broken rendering, so the lists flow freely. */\n'
        '    }')

    # ------------------------------------------------------------------
    # ITEM 10: narrow preview panes keep the connector tool and the one control
    # that reclaims the 500px editor pane.
    rep('css-keep-fold-controls',
        '@container preview-pane (max-width: 880px) {\n'
        '      .zoom-tools .text-action { display: none; }',
        '@container preview-pane (max-width: 880px) {\n'
        '      /* Keep ⇢ Connect and ▢ Hide panel: hiding the only control that\n'
        '         collapses the 500px editor pane at exactly the width that needs it\n'
        '         stranded the user (and Connect is one of only two ways to draw a\n'
        '         connector). */\n'
        '      .zoom-tools .text-action:not(#connectModeButton):not(#focusPreviewButton) { display: none; }')

    # ------------------------------------------------------------------
    if failed:
        for item in failed:
            print('ANCHOR DRIFT: ' + item, file=sys.stderr)
        print('No changes written (%d of %d edits failed).' % (len(failed), len(failed) + len(applied)), file=sys.stderr)
        return 1

    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix='.tmp')
    try:
        with io.open(fd, 'w', encoding='utf-8', newline='') as fh:
            fh.write(text)
        os.replace(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    print('Applied %d edits:' % len(applied))
    for name in applied:
        print('  ' + name)
    return 0

if __name__ == '__main__':
    sys.exit(main())
