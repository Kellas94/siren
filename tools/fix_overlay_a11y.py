#!/usr/bin/env python3
"""
SIREN - modality and keyboard reach across the overlays.

Six fixes, all anchor-guarded:
  1. Present overlay becomes a real dialog: role/aria-modal/accessible name, focus
     moves in on open and back to #presentButton on close, and the editor behind it
     goes inert the same way it already does behind Docs.
  2. Map tiles get a real focusable control ("Present" is a <button> now) and a
     resting affordance, plus a camera that follows keyboard focus. The tile pointer
     handling is untouched, so the 9px capture threshold still stands.
  3. The presentation sequence list stops declaring a listbox nothing could enter and
     becomes a list of focusable steps with roving tabindex and arrow keys.
  4. The keyboard model is surfaced: a "?" button on the Map bar, the "?" key, and a
     real <dialog> that lists every binding Present actually implements.
  5. The command palette's key handler moves from its input to the palette, its rows
     leave the tab order, and closing it returns focus to whatever opened it.
  6. Toasts join the top layer as a popover, so a confirmation raised inside a modal
     <dialog> is readable instead of a blurred smear behind the backdrop.

Usage: python fix_overlay_a11y.py <path-to-T_Industries_SIREN_v1.html>
"""

import os
import sys
import tempfile

EDITS = []


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# ----------------------------------------------------------------------------
# 1. Present overlay is a real modal dialog
# ----------------------------------------------------------------------------

edit(
    "overlay: role, aria-modal, accessible name, focus target",
    '    <div class="present-overlay" id="presentOverlay" hidden>\n',
    '    <div class="present-overlay" id="presentOverlay" role="dialog" aria-modal="true"'
    ' aria-label="Presentation" tabindex="-1" hidden>\n',
)

edit(
    "overlay: focus enters before the editor goes inert",
    "        el.presentOverlay.hidden = false;\n"
    "        document.body.dataset.presenting = 'on';\n",
    "        el.presentOverlay.hidden = false;\n"
    "        // Focus first, inert second: an element blurred by inert hands focus to <body>,\n"
    "        // and a modal takeover with nothing focused inside it is not modal at all.\n"
    "        el.presentOverlay.focus();\n"
    "        setPresentationBackgroundInert(true);\n"
    "        document.body.dataset.presenting = 'on';\n",
)

edit(
    "overlay: take focus back if opening the Map let it slip out",
    "        mapOpen();\n"
    "        if (!document.fullscreenElement) mapToggleFullscreen();\n"
    "      }\n",
    "        mapOpen();\n"
    "        if (!document.fullscreenElement) mapToggleFullscreen();\n"
    "        requestAnimationFrame(() => {\n"
    "          if (!el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) el.presentOverlay.focus();\n"
    "        });\n"
    "      }\n",
)

edit(
    "overlay: Tab and Enter stop editing the diagram behind the presentation",
    "      function handleCanvasCreationKeys(event) {\n"
    "        if (readOnlyMode) return;\n",
    "      function handleCanvasCreationKeys(event) {\n"
    "        if (readOnlyMode) return;\n"
    "        // Present is a takeover. Tab there is how a presenter reaches the Map's tiles and\n"
    "        // Enter is how one opens - neither is a request to add a block to the diagram\n"
    "        // sitting inert behind the overlay.\n"
    "        if (el.presentOverlay && !el.presentOverlay.hidden) return;\n",
)

edit(
    "overlay: release inert before focus goes back to the opener",
    "        updatePresentationAutoFocusButton();\n"
    "        el.presentButton?.focus();\n"
    "      }\n",
    "        updatePresentationAutoFocusButton();\n"
    "        setPresentationBackgroundInert(false);\n"
    "        el.presentButton?.focus();\n"
    "      }\n",
)

edit(
    "overlay: the inert helper itself",
    "      async function openPresentation() {\n",
    "      /* Present is client-facing, so the editor behind it leaves the tab order and the\n"
    "         accessibility tree - exactly what Docs already does in setWorkpapersOpen. Without\n"
    "         this, Tab walked 155 authoring controls, 'Remove diagram' among them, in front of\n"
    "         the audience, and a screen reader in Present was read the editor. */\n"
    "      const PRESENT_INERT_REGIONS = ['.skip-link', '.app-header', '.diagram-workspace-bar',\n"
    "        '.workspace', '.wp-surface', '.mobile-nav', '.node-inspector', '.editor-float'];\n"
    "      let presentInertedRegions = [];\n"
    "\n"
    "      function setPresentationBackgroundInert(on) {\n"
    "        if (!on) {\n"
    "          presentInertedRegions.forEach(region => { region.inert = false; });\n"
    "          presentInertedRegions = [];\n"
    "          return;\n"
    "        }\n"
    "        presentInertedRegions = [];\n"
    "        PRESENT_INERT_REGIONS.forEach(selector => {\n"
    "          document.querySelectorAll(selector).forEach(region => {\n"
    "            // Docs may already own a region; leaving it alone keeps closing Present from\n"
    "            // handing the tab order back to a surface that is still covered.\n"
    "            if (region.inert) return;\n"
    "            region.inert = true;\n"
    "            presentInertedRegions.push(region);\n"
    "          });\n"
    "        });\n"
    "      }\n"
    "\n"
    "      async function openPresentation() {\n",
)

# ----------------------------------------------------------------------------
# 2. Map tiles: a real focusable control with a resting affordance
# ----------------------------------------------------------------------------

edit(
    "map tile: the Present chip becomes a real button keyboard focus can reach",
    "        const open = document.createElement('div');\n"
    "        open.className = 'map-tile-open';\n"
    "        open.textContent = '▶ Present';\n"
    "        host.appendChild(open);\n",
    "        // The tile's affordance is a real button, visible at rest. Hover was the only\n"
    "        // thing that ever said a tile opens, and no keyboard could reach it at all.\n"
    "        const open = document.createElement('button');\n"
    "        open.type = 'button';\n"
    "        open.className = 'map-tile-open';\n"
    "        open.textContent = '▶ Present';\n"
    "        open.setAttribute('aria-label', `Present ${diagram.name || diagram.diagramTitle || 'diagram'}`);\n"
    "        // Tabbing to a tile that is off camera would leave the focus ring off screen, so\n"
    "        // the camera follows keyboard focus - and only keyboard focus, or every click\n"
    "        // would fly twice.\n"
    "        open.addEventListener('focus', () => {\n"
    "          if (!open.matches(':focus-visible')) return;\n"
    "          const box = mapTileRect(diagram.id);\n"
    "          if (box) mapFlyTo(mapCameraForRect(box, 1.16));\n"
    "        });\n"
    "        host.appendChild(open);\n",
)

edit(
    "map tile: resting affordance + focus ring CSS",
    "    .map-tile-open {\n"
    "      position: absolute;\n"
    "      right: 26px;\n"
    "      top: 22px;\n"
    "      padding: 10px 22px;\n"
    "      border-radius: 999px;\n"
    "      background: var(--primary);\n"
    "      color: var(--primary-text);\n"
    "      font-size: 34px;\n"
    "      font-weight: 800;\n"
    "      opacity: 0;\n"
    "      transition: opacity .18s ease;\n"
    "      pointer-events: none;\n"
    "      z-index: 2;\n"
    "    }\n"
    "    .map-tile:hover .map-tile-open { opacity: 1; }\n",
    "    .map-tile-open {\n"
    "      position: absolute;\n"
    "      right: 26px;\n"
    "      top: 22px;\n"
    "      border: 0;\n"
    "      border-radius: 999px;\n"
    "      background: var(--primary);\n"
    "      color: var(--primary-text);\n"
    "      font: inherit;\n"
    "      font-weight: 800;\n"
    "      /* The plane is scaled by the camera, so 34px renders at 5px when the whole map is\n"
    "         in frame. Counter-scaling holds a 15px floor pulled back and lands on the tuned\n"
    "         34px once a tile fills the stage; the padding rides the type so the pill keeps\n"
    "         its shape at every zoom. */\n"
    "      font-size: calc(clamp(15px, 34px * var(--map-tile-scale, 1), 34px) / var(--map-tile-scale, 1));\n"
    "      padding: .3em .65em;\n"
    "      /* Legible at rest: the only thing that said a tile could be opened used to be a\n"
    "         hover state, which a client watching a screen never sees. */\n"
    "      opacity: .62;\n"
    "      transition: opacity .18s ease;\n"
    "      cursor: pointer;\n"
    "      z-index: 2;\n"
    "    }\n"
    "    .map-tile:hover .map-tile-open,\n"
    "    .map-tile-open:hover,\n"
    "    .map-tile-open:focus-visible { opacity: 1; }\n"
    "    /* Counter-scaled too, so the ring is the app's 3px at any camera distance. */\n"
    "    .map-tile-open:focus-visible {\n"
    "      outline: calc(3px / var(--map-tile-scale, 1)) solid var(--focus-ring);\n"
    "      outline-offset: calc(3px / var(--map-tile-scale, 1));\n"
    "    }\n"
    "    .map-tile:has(.map-tile-open:focus-visible) {\n"
    "      border-color: var(--primary);\n"
    "      box-shadow: 0 40px 120px rgba(0, 0, 0, .34), 0 0 0 6px color-mix(in srgb, var(--primary) 22%, transparent);\n"
    "    }\n",
)

edit(
    "map camera: publish the scale so the tile affordance can counter-scale",
    "      function applyMapCamera() {\n"
    "        if (!el.mapPlane) return;\n"
    "        const view = mapViewport();\n"
    "        el.mapPlane.style.transform =\n"
    "          `translate(${view.w / 2}px, ${view.h / 2}px) scale(${mapCamera.scale}) translate(${-mapCamera.x}px, ${-mapCamera.y}px)`;\n"
    "        mapUpdateTileDetail();\n"
    "      }\n",
    "      function applyMapCamera() {\n"
    "        if (!el.mapPlane) return;\n"
    "        const view = mapViewport();\n"
    "        el.mapPlane.style.transform =\n"
    "          `translate(${view.w / 2}px, ${view.h / 2}px) scale(${mapCamera.scale}) translate(${-mapCamera.x}px, ${-mapCamera.y}px)`;\n"
    "        // Anything inside the plane that has to stay a fixed size on screen - the tile's\n"
    "        // Present button, its focus ring - divides by this.\n"
    "        el.mapPlane.style.setProperty('--map-tile-scale', String(mapCamera.scale));\n"
    "        mapUpdateTileDetail();\n"
    "      }\n",
)

edit(
    "map layer: focus must not scroll the plane out from under the camera",
    "      function mapBindPointer() {\n"
    "        if (!el.mapLayer || el.mapLayer.dataset.bound === 'yes') return;\n"
    "        el.mapLayer.dataset.bound = 'yes';\n",
    "      function mapBindPointer() {\n"
    "        if (!el.mapLayer || el.mapLayer.dataset.bound === 'yes') return;\n"
    "        el.mapLayer.dataset.bound = 'yes';\n"
    "        // Focusing a tile off screen makes the browser scroll this overflow:hidden layer,\n"
    "        // which slides the plane out from under the camera. The camera stays the only\n"
    "        // transform on the Map.\n"
    "        el.mapLayer.addEventListener('scroll', () => { el.mapLayer.scrollTop = 0; el.mapLayer.scrollLeft = 0; });\n",
)

edit(
    "map mode: focus stays inside the presentation across the Map/diagram switch",
    "        if (el.mapLayer) el.mapLayer.hidden = !mapMode;\n"
    "        if (el.presentBody) el.presentBody.hidden = mapMode;\n"
    "        if (el.presentBar) el.presentBar.hidden = mapMode;\n"
    "        if (mapMode) {\n"
    "          mapShowBar();\n"
    "          mapUpdateTileDetail();\n"
    "        }\n"
    "      }\n",
    "        if (el.mapLayer) el.mapLayer.hidden = !mapMode;\n"
    "        if (el.presentBody) el.presentBody.hidden = mapMode;\n"
    "        if (el.presentBar) el.presentBar.hidden = mapMode;\n"
    "        if (mapMode) {\n"
    "          mapShowBar();\n"
    "          mapUpdateTileDetail();\n"
    "        }\n"
    "        // Hiding the half that held focus drops it on <body>, and Tab then restarts from\n"
    "        // the top of the overlay. Focus stays inside the presentation across the switch.\n"
    "        requestAnimationFrame(() => {\n"
    "          if (el.presentOverlay && !el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) {\n"
    "            el.presentOverlay.focus();\n"
    "          }\n"
    "        });\n"
    "      }\n",
)

edit(
    "map hint: persistent resting line instead of a 5.2s self-destruct",
    "        mapSetHint('Click any diagram to present it. → moves along the route.');\n"
    "        setTimeout(() => { if (!mapRecording) mapSetHint(''); }, 5200);\n",
    "        mapSetHint(MAP_RESTING_HINT);\n",
)

edit(
    "map hint: leaving route recording returns to the resting line",
    "        mapSetHint(mapRecording ? 'Move the camera, then press Space to keep this view."
    " Click a block first to frame just that block.' : '');\n",
    "        mapSetHint(mapRecording ? 'Move the camera, then press Space to keep this view."
    " Click a block first to frame just that block.' : MAP_RESTING_HINT);\n",
)

edit(
    "map hint: the resting text itself",
    "      function mapSetHint(text) {\n",
    "      /* The hint used to teach the interaction and then delete itself after 5.2 seconds,\n"
    "         so anyone arriving late saw nothing at all. The tiles now carry their own Present\n"
    "         button, which leaves this line free to carry the keyboard model instead. */\n"
    "      const MAP_RESTING_HINT = '→ next stop · Enter opens the diagram · ? keyboard shortcuts';\n"
    "\n"
    "      function mapSetHint(text) {\n",
)

# ----------------------------------------------------------------------------
# 3. The sequence list stops being a listbox nothing can enter
# ----------------------------------------------------------------------------

edit(
    "sequence list: role=list, not a listbox with buttons inside its options",
    '<div class="present-sequence-list" id="presentSequenceList" role="listbox"'
    ' aria-label="Presentation sequence"></div>',
    '<div class="present-sequence-list" id="presentSequenceList" role="list"'
    ' aria-label="Presentation sequence"></div>',
)

edit(
    "sequence rows: listitem + roving tabindex + a name worth hearing",
    "          row.setAttribute('role','option');\n"
    "          row.setAttribute('aria-selected',String(index===presentIndex));\n",
    "          // ARIA forbids the four edit buttons these rows carry inside role=option, and\n"
    "          // nothing could enter the listbox anyway - no tabindex, no roving focus. A list\n"
    "          // of focusable steps can be entered, arrowed and run.\n"
    "          row.setAttribute('role','listitem');\n"
    "          row.tabIndex = index === presentIndex ? 0 : -1;\n"
    "          if (index === presentIndex) row.setAttribute('aria-current','true');\n"
    "          row.setAttribute('aria-label', `Step ${index+1} of ${presentSequence.length}: ${label}, ${meta}`);\n",
)

edit(
    "sequence rows: edit buttons leave the tab order and gain names",
    "          row.append(badge,copy,actions);\n",
    "          row.append(badge,copy,actions);\n"
    "          // The row is the keyboard target and the right arrow steps into its buttons, so\n"
    "          // a seven-step list costs one tab stop rather than twenty-eight.\n"
    "          actions.querySelectorAll('button').forEach(button => {\n"
    "            button.tabIndex = -1;\n"
    "            button.setAttribute('aria-label', button.title);\n"
    "          });\n",
)

edit(
    "sequence list: always keep exactly one tab stop",
    "        requestAnimationFrame(() => el.presentSequenceList.querySelector('[data-active=\"true\"]')"
    "?.scrollIntoView({ block:'nearest' }));\n",
    "        // Before the first step is reached presentIndex is -1, so nothing would carry the\n"
    "        // tab stop and the list would be unreachable all over again.\n"
    "        if (!el.presentSequenceList.querySelector('.present-sequence-item[tabindex=\"0\"]')) {\n"
    "          el.presentSequenceList.querySelector('.present-sequence-item')?.setAttribute('tabindex','0');\n"
    "        }\n"
    "        requestAnimationFrame(() => el.presentSequenceList.querySelector('[data-active=\"true\"]')"
    "?.scrollIntoView({ block:'nearest' }));\n",
)

edit(
    "sequence list: its own keyboard model",
    "      function handlePresentationSequenceClick(event) {\n",
    "      function handlePresentationSequenceKeydown(event) {\n"
    "        const row = event.target.closest('.present-sequence-item');\n"
    "        if (!row) return;\n"
    "        const at = Array.from(el.presentSequenceList.querySelectorAll('.present-sequence-item')).indexOf(row);\n"
    "        // Re-queried every time: presenting or editing a step rebuilds the whole list, so\n"
    "        // the row that was under the finger is a detached node by the time focus moves.\n"
    "        const focusRow = next => {\n"
    "          const rows = Array.from(el.presentSequenceList.querySelectorAll('.present-sequence-item'));\n"
    "          const target = rows[clamp(next, 0, rows.length - 1)];\n"
    "          if (!target) return;\n"
    "          rows.forEach(item => { item.tabIndex = item === target ? 0 : -1; });\n"
    "          target.focus();\n"
    "        };\n"
    "        // Focus is on one of the row's edit buttons: the left arrow is the way back out.\n"
    "        if (event.target !== row) {\n"
    "          if (event.key === 'ArrowLeft') { event.preventDefault(); row.focus(); }\n"
    "          else if (event.key === 'Enter' || event.key === ' ') requestAnimationFrame(() => focusRow(at));\n"
    "          return;\n"
    "        }\n"
    "        if (event.key === 'ArrowDown') { event.preventDefault(); focusRow(at + 1); }\n"
    "        else if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(at - 1); }\n"
    "        else if (event.key === 'Home') { event.preventDefault(); focusRow(0); }\n"
    "        else if (event.key === 'End') { event.preventDefault(); focusRow(Number.MAX_SAFE_INTEGER); }\n"
    "        else if (event.key === 'ArrowRight') { event.preventDefault(); row.querySelector('.present-sequence-buttons button')?.focus(); }\n"
    "        else if (event.key === 'Enter' || event.key === ' ') {\n"
    "          event.preventDefault();\n"
    "          row.click();\n"
    "          requestAnimationFrame(() => focusRow(at));\n"
    "        }\n"
    "      }\n"
    "\n"
    "      function handlePresentationSequenceClick(event) {\n",
)

edit(
    "sequence list: bind the keyboard model",
    "        el.presentSequenceList.addEventListener('click', handlePresentationSequenceClick);\n",
    "        el.presentSequenceList.addEventListener('click', handlePresentationSequenceClick);\n"
    "        el.presentSequenceList.addEventListener('keydown', handlePresentationSequenceKeydown);\n",
)

edit(
    "sequence rows: a focusable row needs a visible ring",
    "    .present-sequence-buttons { display: flex; gap: 3px; }\n",
    "    .present-sequence-item:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }\n"
    "    .present-sequence-buttons { display: flex; gap: 3px; }\n",
)

# ----------------------------------------------------------------------------
# 4. The keyboard model, surfaced
# ----------------------------------------------------------------------------

edit(
    "shortcuts: a ? button on the Map bar, beside Exit",
    '          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>\n',
    '          <button class="btn ghost compact" id="presentKeysButton" type="button"'
    ' aria-haspopup="dialog" aria-label="Keyboard shortcuts"'
    ' title="Keyboard shortcuts (?)">?</button>\n'
    '          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>\n',
)

edit(
    "shortcuts: the card itself, inside the overlay so Present never inerts it",
    '    <div class="present-overlay" id="presentOverlay" role="dialog" aria-modal="true"'
    ' aria-label="Presentation" tabindex="-1" hidden>\n',
    '    <div class="present-overlay" id="presentOverlay" role="dialog" aria-modal="true"'
    ' aria-label="Presentation" tabindex="-1" hidden>\n'
    '      <dialog id="presentKeysDialog" aria-labelledby="presentKeysTitle">\n'
    '        <div class="dialog-header">\n'
    '          <h2 id="presentKeysTitle">Presenting by keyboard</h2>\n'
    '          <button class="btn ghost icon" id="closePresentKeysDialog" type="button" aria-label="Close keyboard shortcuts">×</button>\n'
    '        </div>\n'
    '        <div class="dialog-body">\n'
    '          <p class="field-hint">Press <kbd>?</kbd> at any point in Present to bring this back.</p>\n'
    '          <div class="guide-callout"><strong>On the Map:</strong> <kbd>←</kbd>/<kbd>→</kbd> or <kbd>Space</kbd> move along the route · <kbd>↓</kbd> or <kbd>Enter</kbd> go into the diagram under the camera · <kbd>Tab</kbd> walks the Present button on every tile and <kbd>Enter</kbd> opens the one you are on · <kbd>Home</kbd> pull back to everything · <kbd>F</kbd> full screen · <kbd>R</kbd> record a route · <kbd>Esc</kbd> pulls back, then leaves.</div>\n'
    '          <div class="guide-callout"><strong>Inside a diagram:</strong> <kbd>←</kbd>/<kbd>→</kbd>, <kbd>Space</kbd>, <kbd>PageUp</kbd>/<kbd>PageDown</kbd> step · <kbd>Home</kbd> show all · <kbd>F</kbd> auto camera · <kbd>P</kbd> auto-play · <kbd>M</kbd> the Studio panel · <kbd>1</kbd>…<kbd>9</kbd> pick a decision branch · <kbd>+</kbd>/<kbd>-</kbd> zoom · <kbd>Esc</kbd> back to the Map.</div>\n'
    '          <div class="guide-callout"><strong>In the Studio step list:</strong> <kbd>↑</kbd>/<kbd>↓</kbd> move between steps · <kbd>Home</kbd>/<kbd>End</kbd> jump to either end · <kbd>Enter</kbd> presents the step you are on · <kbd>→</kbd> reaches that step’s edit buttons and <kbd>←</kbd> comes back.</div>\n'
    '        </div>\n'
    '        <div class="dialog-footer">\n'
    '          <button class="btn" id="closePresentKeysFooter" type="button">Done</button>\n'
    '        </div>\n'
    '      </dialog>\n',
)

edit(
    "shortcuts: cache the new elements",
    "          'undoHistoryDialog','closeUndoHistory','closeUndoHistoryFooter','undoHistoryList',\n",
    "          'undoHistoryDialog','closeUndoHistory','closeUndoHistoryFooter','undoHistoryList',\n"
    "          'presentKeysButton','presentKeysDialog','closePresentKeysDialog','closePresentKeysFooter',\n",
)

edit(
    "shortcuts: wire the button and both closers",
    "        el.closeUndoHistory.addEventListener('click', () => closeDialog(el.undoHistoryDialog));\n"
    "        el.closeUndoHistoryFooter.addEventListener('click', () => closeDialog(el.undoHistoryDialog));\n",
    "        el.closeUndoHistory.addEventListener('click', () => closeDialog(el.undoHistoryDialog));\n"
    "        el.closeUndoHistoryFooter.addEventListener('click', () => closeDialog(el.undoHistoryDialog));\n"
    "        el.presentKeysButton?.addEventListener('click', () => showDialog(el.presentKeysDialog));\n"
    "        el.closePresentKeysDialog?.addEventListener('click', () => closeDialog(el.presentKeysDialog));\n"
    "        el.closePresentKeysFooter?.addEventListener('click', () => closeDialog(el.presentKeysDialog));\n",
)

edit(
    "shortcuts: ? opens the card, and an open dialog keeps its own keys",
    "      function handlePresentationKeydown(event) {\n"
    "        if(el.presentOverlay.hidden)return;\n"
    "        const target=event.target;\n",
    "      function handlePresentationKeydown(event) {\n"
    "        if(el.presentOverlay.hidden)return;\n"
    "        // A dialog opened over Present owns its own Escape and arrows. This handler is a\n"
    "        // capturing listener on document, so without this it took them first.\n"
    "        if (document.querySelector('dialog[open]')) return;\n"
    "        const target=event.target;\n"
    "        // The step list runs its own roving-focus model; Home would otherwise mean\n"
    "        // 'show every step' while the presenter is only walking the list.\n"
    "        if (target instanceof Element && target.closest('#presentSequenceList')) return;\n"
    "        if (event.key === '?' || (event.shiftKey && event.key === '/')) {\n"
    "          event.preventDefault();\n"
    "          showDialog(el.presentKeysDialog);\n"
    "          return;\n"
    "        }\n",
)

# ----------------------------------------------------------------------------
# 5. Command palette keeps its keys after focus leaves the input
# ----------------------------------------------------------------------------

edit(
    "palette: the key handler belongs to the palette, not its input",
    "        el.commandPaletteInput.addEventListener('keydown', handleCommandPaletteKeydown);\n",
    "        // Bound to the input, one Tab took Escape, the arrows and Enter away while the\n"
    "        // palette's own footer still promised all three.\n"
    "        el.commandPalette.addEventListener('keydown', handleCommandPaletteKeydown);\n",
)

edit(
    "palette: Tab keeps focus in the field it declares itself modal over",
    "      function handleCommandPaletteKeydown(event) {\n"
    "        if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }\n",
    "      function handleCommandPaletteKeydown(event) {\n"
    "        // The palette declares aria-modal=\"true\" and then let Tab walk straight out into\n"
    "        // the editor behind it, which is where Escape, the arrows and Enter were lost. It\n"
    "        // is a combobox: the field is the only focus target and the list is driven from it.\n"
    "        if (event.key === 'Tab') { event.preventDefault(); el.commandPaletteInput.focus(); return; }\n"
    "        if (event.key === 'Escape') { event.preventDefault(); closeCommandPalette(); return; }\n",
)

edit(
    "palette: rows leave the tab order so focus stays in the search field",
    "          row.className = 'palette-row';\n"
    "          row.dataset.active = String(index === paletteIndex);\n",
    "          row.className = 'palette-row';\n"
    "          // The correct combobox pattern for a palette: the list is driven from the field.\n"
    "          row.tabIndex = -1;\n"
    "          row.dataset.active = String(index === paletteIndex);\n",
)

edit(
    "palette: remember what opened it",
    "      let paletteCommands = [];\n"
    "      let paletteFiltered = [];\n"
    "      let paletteIndex = 0;\n",
    "      let paletteCommands = [];\n"
    "      let paletteFiltered = [];\n"
    "      let paletteIndex = 0;\n"
    "      let paletteReturnFocus = null;\n",
)

edit(
    "palette: record the opener and take focus without waiting for a frame",
    "      function openCommandPalette() {\n"
    "        paletteCommands = buildCommandRegistry();\n"
    "        el.commandPalette.hidden = false;\n"
    "        el.commandPaletteInput.value = '';\n"
    "        filterCommandPalette();\n"
    "        requestAnimationFrame(() => el.commandPaletteInput.focus());\n"
    "      }\n",
    "      function openCommandPalette() {\n"
    "        paletteCommands = buildCommandRegistry();\n"
    "        paletteReturnFocus = document.activeElement;\n"
    "        el.commandPalette.hidden = false;\n"
    "        el.commandPaletteInput.value = '';\n"
    "        filterCommandPalette();\n"
    "        // Straight away, not on the next frame: a frame that never comes - a background\n"
    "        // tab, a pane that is not compositing - left the palette open with focus still on\n"
    "        // the button behind it, which is where its keys went missing.\n"
    "        el.commandPaletteInput.focus();\n"
    "        requestAnimationFrame(() => el.commandPaletteInput.focus());\n"
    "      }\n",
)

edit(
    "palette: give focus back on close",
    "      function closeCommandPalette() {\n"
    "        el.commandPalette.hidden = true;\n"
    "      }\n",
    "      function closeCommandPalette() {\n"
    "        el.commandPalette.hidden = true;\n"
    "        // Closing dropped focus on <body>, which restarts Tab at the top of the page.\n"
    "        const back = paletteReturnFocus;\n"
    "        paletteReturnFocus = null;\n"
    "        if (back && back.isConnected && typeof back.focus === 'function') back.focus();\n"
    "      }\n",
)

# ----------------------------------------------------------------------------
# 6. Toasts above an open dialog
# ----------------------------------------------------------------------------

edit(
    "toast: joins the top layer as a popover",
    '    <div class="toast" id="toast" role="status" aria-live="polite"></div>\n',
    '    <div class="toast" id="toast" role="status" aria-live="polite" popover="manual"></div>\n',
)

edit(
    "toast: pin the corner against the popover UA inset",
    "    .toast {\n"
    "      position: fixed;\n"
    "      /* Toasts confirm actions taken inside the Docs surface (1250) and the floating\n"
    "         editor (1150), so they have to paint above both. */\n"
    "      z-index: 1500;\n"
    "      right: 18px;\n"
    "      bottom: 18px;\n",
    "    .toast {\n"
    "      position: fixed;\n"
    "      /* Toasts confirm actions taken inside the Docs surface (1250) and the floating\n"
    "         editor (1150), so they have to paint above both. A modal <dialog> paints in the\n"
    "         top layer, above every z-index there is, so the toast is a popover and joins the\n"
    "         same layer - inset, not right/bottom, because the popover UA rule sets all four. */\n"
    "      z-index: 1500;\n"
    "      inset: auto 18px 18px auto;\n"
    "      margin: 0;\n",
)

edit(
    "toast: same pinning on the mobile override",
    "      .toast { bottom: calc(var(--mobile-nav-height) + 12px); right: 10px; }\n",
    "      .toast { inset: auto 10px calc(var(--mobile-nav-height) + 12px) auto; }\n",
)

edit(
    "toast: show it in the top layer",
    "      function showToast(message, kind = 'normal') {\n"
    "        clearTimeout(toastTimer);\n"
    "        el.toast.textContent = message;\n"
    "        el.toast.dataset.kind = kind;\n"
    "        el.toast.classList.add('is-visible');\n"
    "        toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), 3200);\n"
    "      }\n",
    "      function showToast(message, kind = 'normal') {\n"
    "        clearTimeout(toastTimer);\n"
    "        // Every confirmation raised from inside Export, Restore points, Review or Import\n"
    "        // used to be an unreadable smear behind the dialog's blurred backdrop. The top\n"
    "        // layer is ordered by entry, so a toast raised while a dialog is up re-enters it.\n"
    "        if (typeof el.toast.showPopover === 'function') {\n"
    "          const overDialog = Boolean(document.querySelector('dialog[open]'));\n"
    "          try { if (overDialog && el.toast.matches(':popover-open')) el.toast.hidePopover(); }\n"
    "          catch (error) { /* already gone */ }\n"
    "          try { if (!el.toast.matches(':popover-open')) el.toast.showPopover(); }\n"
    "          catch (error) { /* already showing */ }\n"
    "        }\n"
    "        el.toast.textContent = message;\n"
    "        el.toast.dataset.kind = kind;\n"
    "        el.toast.classList.add('is-visible');\n"
    "        toastTimer = setTimeout(() => {\n"
    "          el.toast.classList.remove('is-visible');\n"
    "          // Leave the top layer only once the fade has finished.\n"
    "          setTimeout(() => { try { el.toast.hidePopover?.(); } catch (error) { /* already hidden */ } }, 240);\n"
    "        }, 3200);\n"
    "      }\n",
)


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: python fix_overlay_a11y.py <path-to-siren.html>")
    target = os.path.abspath(sys.argv[1])
    with open(target, "r", encoding="utf-8", newline="") as handle:
        src = handle.read()

    original_len = len(src)
    for name, old, new, count in EDITS:
        found = src.count(old)
        if found != count:
            sys.exit(
                "ABORT [%s]: expected %d occurrence(s) of the anchor, found %d.\n  anchor starts: %r"
                % (name, count, found, old[:140])
            )
        src = src.replace(old, new, count)
        print("ok  " + name)

    directory = os.path.dirname(target) or "."
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", dir=directory,
        prefix=".siren_a11y_", suffix=".tmp", delete=False,
    )
    try:
        handle.write(src)
        handle.flush()
        os.fsync(handle.fileno())
    finally:
        handle.close()
    os.replace(handle.name, target)
    print("\nwrote %s  (%d -> %d bytes, %d edits)" % (target, original_len, len(src), len(EDITS)))


if __name__ == "__main__":
    main()
