#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Present-mode polish: one installer for four independent fixes.

    python install_presentpolish.py <target.html>

FIX 1  presenter view      the NOW frame becomes the dominant one - the grid split
                           in PRESENTER_WINDOW_HTML is reversed and the emphasised
                           border follows it, so the slide the room is looking at is
                           no longer the smaller of the two.
FIX 2  Studio rail         the eight-panel sidebar is fitted to the screen it is on
                           instead of a hard-coded open set: panels are offered in
                           presenting order and each is MEASURED after it opens, so
                           the rail does not overflow at rest. The presenter outranks
                           the fit - touch a panel and it stops rearranging.
FIX 3  dead stops          a diagram removed in the editor no longer leaves a route
                           stop with nothing to draw; the tile it left behind goes
                           too, and the same predicate runs quietly at load, import,
                           merge and recovery.
FIX 4  segmented controls  the card editor's Text size / Alignment / Framing rails and
                           its kind rail become keyboard-reachable, sharing the settings
                           panel's radiogroup dialect (rovingRadioKeydown) instead of
                           inventing a second one.

Properties:
  * IDEMPOTENT - a fully patched target is detected and left byte-untouched (exit 0).
  * ANCHOR-GUARDED - all 23 anchors must match exactly once and the required
    invariants must still hold before a single byte is written.
  * ATOMIC - written to a temp file in the same directory, moved with os.replace.
  * ABORTS WITHOUT WRITING on any drift, including a PARTIALLY patched target.
"""

import io
import os
import sys
import tempfile

# Invariants the fixes depend on. Never modified - only required to still be true.
REQUIRED = ["        if (document.querySelector('dialog[open]')) return;\n", "        dialog.id = 'mapCardEditor';\n", "        group.setAttribute('role', 'radiogroup');\n", "        rail.setAttribute('role', 'radiogroup');\n"]

# (tag, name, old, new). Generated from the four verified per-fix scripts.
EDITS = [
    ('frames',
     'pv-panes column split: NOW dominant, NEXT supporting',
     '.pv-panes{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:14px;min-height:0}',
     '.pv-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.6fr);gap:14px;min-height:0}'),
    ('frames',
     'emphasised frame border follows the dominant pane',
     "+ '.pv-pane.is-next .pv-frame{border-color:#41586b}'",
     "+ '.pv-pane.is-now .pv-frame{border-color:#41586b}'"),
    ('frames',
     "step-preview comment names the supporting frame's real width",
     '// diagram in a 700px panel is a picture of nothing - the block the walk is',
     '// diagram in a 420px panel is a picture of nothing - the block the walk is'),
    ('rail',
     'rail edit 1',
     '          <details class="present-panel" open>\n            <summary>Current step</summary>',
     '          <details class="present-panel" id="presentStepPanel" open>\n            <summary>Current step</summary>'),
    ('rail',
     'rail edit 2',
     '          <details class="present-panel" open>\n            <summary>Presenter notes</summary>',
     '          <details class="present-panel" id="presentNotesPanel">\n            <summary>Presenter notes</summary>'),
    ('rail',
     'rail edit 3',
     '          <details class="present-panel" open>\n            <summary>Playback & live tools</summary>',
     '          <details class="present-panel" id="presentToolsPanel">\n            <summary>Playback & live tools</summary>'),
    ('rail',
     'rail edit 4',
     '          <details class="present-panel">\n            <summary>Navigator & sequence</summary>',
     '          <details class="present-panel" id="presentSequencePanel">\n            <summary>Navigator & sequence</summary>'),
    ('rail',
     'rail edit 5',
     '          <details class="present-panel">\n            <summary>Chapters</summary>',
     '          <details class="present-panel" id="presentChaptersPanel">\n            <summary>Chapters</summary>'),
    ('rail',
     'rail edit 6',
     "'presentAutoplaySeconds','presentAutoplayLoop','presentPlaybackPanel','presentPlaybackSettings'",
     "'presentAutoplaySeconds','presentAutoplayLoop','presentPlaybackPanel','presentPlaybackSettings','presentStepPanel','presentNotesPanel','presentToolsPanel','presentSequencePanel','presentChaptersPanel'"),
    ('rail',
     'rail edit 7',
     '      let presentCheckpointResumeAutoplay = false;',
     "      let presentCheckpointResumeAutoplay = false;\n\n      /* The Studio rail is eight panels deep, and which of them started open was a\n         fixed arrangement that did not fit: 1238px of content in an 841px rail on a\n         1440x900 laptop, so the presenter was scrolling before they had said a word.\n         Collapsed, the eight panels already cost 411px of the rail; what is left for\n         open ones is 430px at 1440x900, 330px at 1280x800 and 124px at 1024x640 - and\n         an open Presenter notes alone costs 466px. One arrangement cannot fit all\n         three, so the open set is fitted to the screen instead of hard-coded: the\n         panels are offered in the order a presenter needs them while the room is\n         watching, and each one is measured after it opens. Measure, do not budget -\n         scrollHeight past clientHeight IS the overflow, so the panel that would cause\n         it closes again. Nothing is taken away; a closed panel is one press.\n\n         Presenting first, authoring last, and the panel with no second door first\n         of all:\n           Playback & live tools - the laser, spotlight, pen and arrow have no other\n                                   door anywhere in the app: no key, no bar button,\n                                   no menu row. Clear drawings, Snapshot and Record\n                                   are pressed live and live only here.\n           Current step          - previous, this, next. The cheapest panel in the\n                                   rail at 95px and the only place the step AFTER\n                                   this one is named - but the bar already carries\n                                   the diagram, the step and the position, so it\n                                   yields to the tools when only one of them fits.\n           Chapters              - a one-press jump mid-talk, and worth a slot only\n                                   when this diagram actually has subgraphs.\n           Presenter notes       - written here, but READ in the presenter view, where\n                                   they are set at 21px for a glance. Five of its six\n                                   controls - owner, seconds, source, reveal,\n                                   checkpoint - are authoring, so it yields early.\n           Navigator & sequence  - a jump the chip strip and the Map list already\n                                   offer, wrapped around the sequence editor.\n         Camera/motion/decisions, Saved branch scenarios and Workspace deck are set up\n         before anyone is in the room, so the fit never opens them. */\n      const PRESENT_RAIL_ORDER = [\n        ['presentToolsPanel', () => true],\n        ['presentStepPanel', () => true],\n        ['presentChaptersPanel', () => Boolean(el.presentChapters && el.presentChapters.childElementCount)],\n        ['presentNotesPanel', () => true],\n        ['presentSequencePanel', () => true]\n      ];\n      // What the fit last left behind. The presenter outranks it: the moment the rail\n      // says something this function did not, the fit stops rearranging their rail.\n      let presentRailPlan = null;\n\n      function layoutPresentationRail() {\n        const rail = el.presentSidebar;\n        const body = el.presentBody;\n        if (!rail || !body || el.presentOverlay.hidden || body.hidden) return;\n        if (body.classList.contains('sidebar-collapsed')) return;\n        const panels = Array.from(rail.querySelectorAll('details.present-panel'));\n        if (!panels.length) return;\n        // A rail that has not been laid out yet measures zero, and fitting to zero would\n        // close every panel. Leave it alone; the next frame or resize fits it.\n        if (rail.clientHeight < 120) return;\n        if (presentRailPlan && (presentRailPlan.length !== panels.length\n          || panels.some((panel, index) => panel.open !== presentRailPlan[index]))) return;\n        panels.forEach(panel => { panel.open = false; });\n        PRESENT_RAIL_ORDER.forEach(([key, worthOpening]) => {\n          const panel = el[key];\n          if (!panel || !worthOpening()) return;\n          panel.open = true;\n          if (rail.scrollHeight > rail.clientHeight) panel.open = false;\n        });\n        presentRailPlan = panels.map(panel => panel.open);\n      }"),
    ('rail',
     'rail edit 8',
     "        el.presentBody.classList.remove('sidebar-collapsed');\n        el.presentSidebarToggle.setAttribute('aria-pressed', 'true');",
     "        el.presentBody.classList.remove('sidebar-collapsed');\n        // A new presentation starts from the fit this screen allows, not from the\n        // arrangement the last one happened to be left in.\n        presentRailPlan = null;\n        el.presentSidebarToggle.setAttribute('aria-pressed', 'true');"),
    ('rail',
     'rail edit 9',
     '        requestAnimationFrame(() => {\n          if (el.presentOverlay && !el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) {\n            el.presentOverlay.focus();\n          }\n        });',
     '        requestAnimationFrame(() => {\n          if (el.presentOverlay && !el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) {\n            el.presentOverlay.focus();\n          }\n          // The rail has a height only once the walkthrough half is on screen.\n          layoutPresentationRail();\n        });'),
    ('rail',
     'rail edit 10',
     '        requestAnimationFrame(() => { resizePresentationCanvas(true); if (presentAutoFocus) schedulePresentationCameraUpdate(false); });',
     '        requestAnimationFrame(() => { resizePresentationCanvas(true); if (presentAutoFocus) schedulePresentationCameraUpdate(false); layoutPresentationRail(); });'),
    ('rail',
     'rail edit 11',
     '        if(el.presentOverlay.hidden)return;mapMeasureChrome();resizePresentationCanvas(true);if(presentAutoFocus)schedulePresentationCameraUpdate(false);else updatePresentationMiniMapViewport();scheduleAudienceBroadcast();',
     '        if(el.presentOverlay.hidden)return;mapMeasureChrome();resizePresentationCanvas(true);if(presentAutoFocus)schedulePresentationCameraUpdate(false);else updatePresentationMiniMapViewport();scheduleAudienceBroadcast();layoutPresentationRail();'),
    ('rail',
     'rail edit 12',
     '          el.presentChapters.appendChild(button);\n        });\n      }',
     '          el.presentChapters.appendChild(button);\n        });\n        // The rail only spends a slot on Chapters when there are chapters, and this\n        // is the moment that answer changes.\n        layoutPresentationRail();\n      }'),
    ('deadstops',
     'A  Map helpers + sanitizeMapState header',
     "      function sanitizeMapState(raw) {\n        const map = raw && typeof raw === 'object' ? raw : {};\n        const tiles = {};\n        Object.keys(map.tiles && typeof map.tiles === 'object' ? map.tiles : {}).slice(0, 400).forEach(id => {\n          const tile = map.tiles[id];\n          if (!tile || typeof tile !== 'object') return;\n",
     "      /* ---------------- dead stops ----------------\n         A route stop is the one thing in the deck that can outlive its subject:\n         delete the diagram it walks and the stop is a slide with nothing to draw.\n         Every path that can drop a diagram - the editor's Remove, an import, a\n         merge, a project read back from storage - ends here, so nothing outside\n         the Map has to learn what a route looks like. */\n\n      // Null, not an empty set: with no workspace to check against we must never\n      // prune blind - an unknown id is not the same as a dead one.\n      function mapLiveDiagramIds() {\n        return Array.isArray(state.diagrams) && state.diagrams.length\n          ? new Set(state.diagrams.map(diagram => diagram.id))\n          : null;\n      }\n\n      // The one definition of a dead stop. A map stop frames the whole plane and a\n      // card stop frames a card: both own their subject, so neither can ever die\n      // with a diagram.\n      function mapRouteViewIsLive(view, live) {\n        const target = (view && view.target) || {};\n        if (target.kind !== 'diagram' && target.kind !== 'nodes') return true;\n        return Boolean(target.diagramId) && live.has(target.diagramId);\n      }\n\n      /* The live prune, for the moment a diagram is actually removed. Quiet by\n         default; pass `announce` - the line the caller was about to say - and the\n         one toast that reaches the author carries both halves, because showToast\n         holds one message at a time. */\n      function mapPruneDeadStops(options = {}) {\n        const map = state.map;\n        if (!map) return 0;\n        const live = mapLiveDiagramIds();\n        if (!live) return 0;\n        // The tile is the stop's subject on the plane. Left behind, it keeps\n        // stretching mapBounds() over a rectangle nothing draws, so ⌂ and every\n        // whole-map stop frame an empty gap where the diagram used to be.\n        Object.keys(map.tiles || {}).forEach(id => { if (!live.has(id)) delete map.tiles[id]; });\n        const route = Array.isArray(map.route) ? map.route : [];\n        const before = route.length;\n        if (!before) return 0;\n        const here = clamp(mapRouteIndex, 0, before - 1);\n        // Counting the survivors in front of the current stop keeps the presenter\n        // where they were standing, and cannot point past the end the way a raw\n        // index carried across a shorter route would.\n        const ahead = route.slice(0, here).filter(view => mapRouteViewIsLive(view, live)).length;\n        map.route = route.filter(view => mapRouteViewIsLive(view, live));\n        const dropped = before - map.route.length;\n        if (!dropped) return 0;\n        mapRouteIndex = map.route.length ? clamp(ahead, 0, map.route.length - 1) : 0;\n        scheduleSave();\n        // Removal happens in the editor, so this is defence rather than a live path:\n        // if anything ever prunes while the room is watching, the deck restates\n        // itself instead of describing a slide that is no longer there.\n        if (mapMode) {\n          mapRenderRoute();\n          mapRenderThread();\n          mapUpdateChrome();\n          if (map.route.length) mapGoToView(mapRouteIndex, { instant: false });\n        }\n        if (options.announce) {\n          const lead = String(options.announce);\n          setTimeout(() => showToast(`${lead} ${dropped} slide${dropped === 1 ? '' : 's'} left the presentation.`, 'success'), 0);\n        }\n        return dropped;\n      }\n\n      function sanitizeMapState(raw) {\n        const map = raw && typeof raw === 'object' ? raw : {};\n        // Load, import, merge and recovery all arrive here. A stop or a tile whose\n        // diagram is not in the workspace goes quietly: nobody just did anything,\n        // so nobody is told.\n        const live = mapLiveDiagramIds();\n        const tiles = {};\n        Object.keys(map.tiles && typeof map.tiles === 'object' ? map.tiles : {}).slice(0, 400).forEach(id => {\n          const tile = map.tiles[id];\n          if (!tile || typeof tile !== 'object') return;\n          if (live && !live.has(String(id))) return;\n"),
    ('deadstops',
     'B  sanitizeMapState route filter',
     '          route: (Array.isArray(map.route) ? map.route.slice(0, 600) : []).map(sanitizeRouteView),\n',
     '          route: (Array.isArray(map.route) ? map.route.slice(0, 600) : []).map(sanitizeRouteView)\n            .filter(view => !live || mapRouteViewIsLive(view, live)),\n'),
    ('deadstops',
     'C  editor: removeActiveDiagram',
     '        state.presentationDeck = (state.presentationDeck || []).filter(id => id !== removed.id);\n        const next = state.diagrams[Math.min(index, state.diagrams.length - 1)];\n',
     '        state.presentationDeck = (state.presentationDeck || []).filter(id => id !== removed.id);\n        mapPruneDeadStops({ announce: `${removed.name} removed.` });\n        const next = state.diagrams[Math.min(index, state.diagrams.length - 1)];\n'),
    ('deadstops',
     'D  editor: deleteWorkspaceDiagramById',
     '        state.presentationDeck = (state.presentationDeck || []).filter(entry => entry !== removed.id);\n        const activeRemoved = removed.id === state.activeDiagramId;\n',
     '        state.presentationDeck = (state.presentationDeck || []).filter(entry => entry !== removed.id);\n        mapPruneDeadStops({ announce: `${removed.name} removed.` });\n        const activeRemoved = removed.id === state.activeDiagramId;\n'),
    ('deadstops',
     'E  editor: deleteSelectedWorkspaceDiagrams',
     '            state.presentationDeck = (state.presentationDeck || []).filter(id => keep.some(diagram => diagram.id === id));\n            workspaceSelection.clear();\n',
     "            state.presentationDeck = (state.presentationDeck || []).filter(id => keep.some(diagram => diagram.id === id));\n            mapPruneDeadStops({ announce: `${chosen.length} diagram${chosen.length === 1 ? '' : 's'} removed.` });\n            workspaceSelection.clear();\n"),
    ('segments',
     'handlePresentationSettingKeydown -> shared helper',
     "      function handlePresentationSettingKeydown(event) {\n        const button = event.target instanceof Element ? event.target.closest('.present-seg-button') : null;\n        const rail = button && button.closest('.present-seg');\n        if (!rail) return;\n        const buttons = Array.from(rail.querySelectorAll('.present-seg-button'));\n        const index = buttons.indexOf(button);\n        let next = -1;\n        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;\n        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;\n        else if (event.key === 'Home') next = 0;\n        else if (event.key === 'End') next = buttons.length - 1;\n        else return;\n        event.preventDefault();\n        setPresentationSetting(rail.dataset.setting, buttons[next].dataset.value);\n        buttons[next].focus();\n      }\n",
     '      /* One radiogroup dialect for the whole app, lifted out of the settings rail\n         so the card editor cannot drift into a second one. This is the WAI-ARIA\n         radio group contract: the arrows move inside the group and wrap round,\n         Home and End reach its ends, and selection follows focus. Only the commit\n         differs between callers - the settings rail writes through its <select>,\n         the card editor through a closure - so that is the one thing passed in. */\n      function rovingRadioKeydown(event, item, choose) {\n        const button = event.target instanceof Element ? event.target.closest(item) : null;\n        const group = button && button.closest(\'[role="radiogroup"]\');\n        if (!group) return false;\n        const buttons = Array.from(group.querySelectorAll(item));\n        const index = buttons.indexOf(button);\n        let next = -1;\n        if (event.key === \'ArrowRight\' || event.key === \'ArrowDown\') next = (index + 1) % buttons.length;\n        else if (event.key === \'ArrowLeft\' || event.key === \'ArrowUp\') next = (index - 1 + buttons.length) % buttons.length;\n        else if (event.key === \'Home\') next = 0;\n        else if (event.key === \'End\') next = buttons.length - 1;\n        else return false;\n        event.preventDefault();\n        choose(buttons[next], group);\n        buttons[next].focus();\n        return true;\n      }\n\n      function handlePresentationSettingKeydown(event) {\n        rovingRadioKeydown(event, \'.present-seg-button\', (button, rail) => {\n          setPresentationSetting(rail.dataset.setting, button.dataset.value);\n        });\n      }\n'),
    ('segments',
     'mapEditorSegmented -> arrow keys',
     "      function mapEditorSegmented(label, options, get, set) {\n        const field = mapEditorField(label);\n        field.wrap.classList.add('card-field-inline');\n        const group = document.createElement('div');\n        group.className = 'card-seg';\n        group.setAttribute('role', 'radiogroup');\n        group.setAttribute('aria-label', label);\n        const buttons = [];\n        const sync = () => {\n          const current = String(get());\n          buttons.forEach(([value, button]) => {\n            const on = String(value) === current;\n            button.classList.toggle('is-on', on);\n            button.setAttribute('aria-checked', String(on));\n            button.tabIndex = on ? 0 : -1;\n          });\n        };\n        options.forEach(([value, text, title]) => {\n          const button = document.createElement('button');\n          button.type = 'button';\n          button.className = 'card-seg-button';\n          button.textContent = text;\n          button.setAttribute('role', 'radio');\n          if (title) button.title = title;\n          button.addEventListener('click', () => { set(value); sync(); mapTouchCard(false); });\n          buttons.push([value, button]);\n          group.appendChild(button);\n        });\n        sync();\n        field.body.appendChild(group);\n        return field.wrap;\n      }\n",
     "      function mapEditorSegmented(label, options, get, set) {\n        const field = mapEditorField(label);\n        field.wrap.classList.add('card-field-inline');\n        const group = document.createElement('div');\n        group.className = 'card-seg';\n        group.setAttribute('role', 'radiogroup');\n        group.setAttribute('aria-label', label);\n        const buttons = [];\n        const sync = () => {\n          const current = String(get());\n          buttons.forEach(([value, button]) => {\n            const on = String(value) === current;\n            button.classList.toggle('is-on', on);\n            button.setAttribute('aria-checked', String(on));\n            button.tabIndex = on ? 0 : -1;\n          });\n        };\n        // One commit, so the mouse and the arrows cannot mean different things.\n        const choose = value => { set(value); sync(); mapTouchCard(false); };\n        options.forEach(([value, text, title]) => {\n          const button = document.createElement('button');\n          button.type = 'button';\n          button.className = 'card-seg-button';\n          button.textContent = text;\n          button.setAttribute('role', 'radio');\n          if (title) button.title = title;\n          button.addEventListener('click', () => choose(value));\n          buttons.push([value, button]);\n          group.appendChild(button);\n        });\n        /* The roving tabindex above is only half a radiogroup. Without the arrows\n           the one Tab stop it leaves lands on the chosen option and every other\n           option is unreachable - visible, focusable by nothing. */\n        group.addEventListener('keydown', event => rovingRadioKeydown(event, '.card-seg-button', button => {\n          const entry = buttons.find(item => item[1] === button);\n          if (entry) choose(entry[0]);\n        }));\n        sync();\n        field.body.appendChild(group);\n        return field.wrap;\n      }\n"),
    ('segments',
     'card editor kind rail -> arrow keys',
     "        const kindButtons = [];\n        MAP_CARD_KINDS.forEach(([kind, label, glyph, hint]) => {\n          const button = document.createElement('button');\n          button.type = 'button';\n          button.className = 'card-kind-tile';\n          button.setAttribute('role', 'radio');\n          button.title = hint;\n          const mark = document.createElement('span');\n          mark.className = 'card-kind-glyph';\n          mark.textContent = glyph;\n          const text = document.createElement('span');\n          text.className = 'card-kind-label';\n          text.textContent = label;\n          button.append(mark, text);\n          button.addEventListener('click', () => {\n            if (!mapCardEditorCard || mapCardEditorCard.kind === kind) return;\n            mapCardEditorCard.kind = kind;\n            mapEnsureCardPayload(mapCardEditorCard);\n            mapRenderCardEditorPane();\n            mapTouchCard(false);\n          });\n          kindButtons.push([kind, button]);\n          rail.appendChild(button);\n        });\n",
     "        const kindButtons = [];\n        // One commit, so the mouse and the arrows cannot mean different things.\n        const chooseKind = kind => {\n          if (!mapCardEditorCard || mapCardEditorCard.kind === kind) return;\n          mapCardEditorCard.kind = kind;\n          mapEnsureCardPayload(mapCardEditorCard);\n          mapRenderCardEditorPane();\n          mapTouchCard(false);\n        };\n        MAP_CARD_KINDS.forEach(([kind, label, glyph, hint]) => {\n          const button = document.createElement('button');\n          button.type = 'button';\n          button.className = 'card-kind-tile';\n          button.setAttribute('role', 'radio');\n          button.title = hint;\n          const mark = document.createElement('span');\n          mark.className = 'card-kind-glyph';\n          mark.textContent = glyph;\n          const text = document.createElement('span');\n          text.className = 'card-kind-label';\n          text.textContent = label;\n          button.append(mark, text);\n          button.addEventListener('click', () => chooseKind(kind));\n          kindButtons.push([kind, button]);\n          rail.appendChild(button);\n        });\n        // The rail is a radiogroup too, and was missing the same half.\n        rail.addEventListener('keydown', event => rovingRadioKeydown(event, '.card-kind-tile', button => {\n          const entry = kindButtons.find(item => item[1] === button);\n          if (entry) chooseKind(entry[0]);\n        }));\n"),
]

NL = chr(10)


def main():
    if len(sys.argv) != 2:
        print('usage: install_presentpolish.py <target.html>', file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    if not os.path.isfile(target):
        print('ABORT: no such file: ' + target, file=sys.stderr)
        return 2

    text = io.open(target, encoding='utf-8', newline='').read()
    before = len(text)

    problems = []
    for needle in REQUIRED:
        if needle not in text:
            problems.append('required invariant missing: ' + needle.strip()[:90])

    applied, pending = [], []
    for tag, name, old, new in EDITS:
        # `new` is checked first: several replacements CONTAIN their own anchor, so a
        # patched file still counts `old` once. `new` present is what "done" means.
        if text.count(new) >= 1:
            applied.append((tag, name))
        elif text.count(old) == 1:
            pending.append((tag, name, old, new))
        else:
            problems.append('%s / %s: anchor found %d times, expected 1'
                            % (tag, name, text.count(old)))

    if problems:
        print('ABORT - drift, nothing written:', file=sys.stderr)
        for problem in problems:
            print('  - ' + problem, file=sys.stderr)
        return 1

    if applied and pending:
        print('ABORT - target is PARTIALLY patched (%d of %d edits already present), '
              'nothing written.' % (len(applied), len(EDITS)), file=sys.stderr)
        for tag, name in applied:
            print('  already present: %s / %s' % (tag, name), file=sys.stderr)
        return 1

    if not pending:
        print('Already installed: all %d edits present. %s left byte-untouched.'
              % (len(EDITS), target))
        return 0

    out = text
    for tag, name, old, new in pending:
        out = out.replace(old, new, 1)

    expected = sum(len(new) - len(old) for _, _, old, new in pending)
    if len(out) - before != expected:
        print('ABORT: length delta %d, expected %d - nothing written.'
              % (len(out) - before, expected), file=sys.stderr)
        return 1

    # Post-conditions: the traps each fix was written around, checked in the text we
    # are about to write rather than asserted about the one we read.
    checks = [
        ('.pv-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.6fr)', 1,
         'FIX 1 NOW is the dominant presenter frame'),
        ('function layoutPresentationRail()', 1, 'FIX 2 the rail fit exists'),
        ('if (rail.scrollHeight > rail.clientHeight) panel.open = false;', 1,
         'FIX 2 the fit MEASURES rather than budgets'),
        ("if (target.kind !== 'diagram' && target.kind !== 'nodes') return true;", 1,
         'FIX 3 card and whole-map stops are never pruned'),
        ('mapRouteIndex = map.route.length ? clamp(ahead, 0, map.route.length - 1) : 0;', 1,
         'FIX 3 route index re-anchored, never past the end'),
        ('mapPruneDeadStops({ announce:', 3, 'FIX 3 all three editor removal paths call the Map'),
        ('function rovingRadioKeydown(event, item, choose)', 1,
         'FIX 4 one radiogroup dialect for the whole app'),
    ]
    for needle, want, why in checks:
        got = out.count(needle)
        if got != want:
            print('ABORT: post-check failed (%s): %d occurrences, expected %d - nothing '
                  'written.' % (why, got, want), file=sys.stderr)
            return 1

    folder = os.path.dirname(target) or '.'
    handle, tmp = tempfile.mkstemp(dir=folder, suffix='.tmp')
    os.close(handle)
    try:
        with io.open(tmp, 'w', encoding='utf-8', newline='') as fh:
            fh.write(out)
        os.replace(tmp, target)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise

    for tag, name, _old, _new in pending:
        print('  applied  %-10s %s' % (tag, name))
    print('OK  %s  (%d -> %d chars, %+d)' % (target, before, len(out), len(out) - before))
    return 0


if __name__ == '__main__':
    sys.exit(main())
