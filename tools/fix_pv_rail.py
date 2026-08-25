#!/usr/bin/env python3
"""FIX 2 - the Studio sidebar overflows at rest.

Measured on T_Industries_SIREN_v1.html (1440x900, Present -> a diagram, Studio open):
the rail is 841px tall and holds 1238px of content, so 'Navigator & sequence' and the
three panels under it sit below the fold before the presenter has pressed anything.

Collapsed, the eight panels already cost 8 x 41px + 7 x 9px of margin + 20px of rail
padding = 411px.  What is left for open panels is 430px at 1440x900, 330px at 1280x800
and 124px at 1024x640, while an open 'Presenter notes' alone costs 466px.  No single
fixed arrangement fits all three screens, so the open set stops being fixed: the rail
is fitted to the screen it is on, in the order a presenter needs a panel, and every
candidate is MEASURED after it opens - it stays open only while the rail still fits.

This patch is confined to the Present-mode Studio rail.  It touches no other pane.

Usage:  python fix_pv_rail.py <path-to-html>
"""

import io
import os
import sys
import tempfile


def patch(text):
    edits = []

    # ---------------------------------------------------------------- 1. panel ids
    # The fit needs to name the panels it opens; only the settings panel had an id.
    # The two panels that carried `open` lose it: the conservative arrangement is now
    # the pre-script one, and the fit opens more the moment it can measure the rail,
    # so no screen ever paints an overflowing rail on the way in.
    edits.append((
        '          <details class="present-panel" open>\n'
        '            <summary>Current step</summary>',
        '          <details class="present-panel" id="presentStepPanel" open>\n'
        '            <summary>Current step</summary>',
    ))
    edits.append((
        '          <details class="present-panel" open>\n'
        '            <summary>Presenter notes</summary>',
        '          <details class="present-panel" id="presentNotesPanel">\n'
        '            <summary>Presenter notes</summary>',
    ))
    edits.append((
        '          <details class="present-panel" open>\n'
        '            <summary>Playback & live tools</summary>',
        '          <details class="present-panel" id="presentToolsPanel">\n'
        '            <summary>Playback & live tools</summary>',
    ))
    edits.append((
        '          <details class="present-panel">\n'
        '            <summary>Navigator & sequence</summary>',
        '          <details class="present-panel" id="presentSequencePanel">\n'
        '            <summary>Navigator & sequence</summary>',
    ))
    edits.append((
        '          <details class="present-panel">\n'
        '            <summary>Chapters</summary>',
        '          <details class="present-panel" id="presentChaptersPanel">\n'
        '            <summary>Chapters</summary>',
    ))

    # ------------------------------------------------------- 2. the el() id roster
    edits.append((
        "'presentAutoplaySeconds','presentAutoplayLoop','presentPlaybackPanel','presentPlaybackSettings'",
        "'presentAutoplaySeconds','presentAutoplayLoop','presentPlaybackPanel','presentPlaybackSettings',"
        "'presentStepPanel','presentNotesPanel','presentToolsPanel','presentSequencePanel','presentChaptersPanel'",
    ))

    # ------------------------------------------------------------- 3. the fit itself
    edits.append((
        '      let presentCheckpointResumeAutoplay = false;',
        '      let presentCheckpointResumeAutoplay = false;\n'
        '\n'
        '      /* The Studio rail is eight panels deep, and which of them started open was a\n'
        '         fixed arrangement that did not fit: 1238px of content in an 841px rail on a\n'
        '         1440x900 laptop, so the presenter was scrolling before they had said a word.\n'
        '         Collapsed, the eight panels already cost 411px of the rail; what is left for\n'
        '         open ones is 430px at 1440x900, 330px at 1280x800 and 124px at 1024x640 - and\n'
        '         an open Presenter notes alone costs 466px. One arrangement cannot fit all\n'
        '         three, so the open set is fitted to the screen instead of hard-coded: the\n'
        '         panels are offered in the order a presenter needs them while the room is\n'
        '         watching, and each one is measured after it opens. Measure, do not budget -\n'
        '         scrollHeight past clientHeight IS the overflow, so the panel that would cause\n'
        '         it closes again. Nothing is taken away; a closed panel is one press.\n'
        '\n'
        '         Presenting first, authoring last, and the panel with no second door first\n'
        '         of all:\n'
        '           Playback & live tools - the laser, spotlight, pen and arrow have no other\n'
        '                                   door anywhere in the app: no key, no bar button,\n'
        '                                   no menu row. Clear drawings, Snapshot and Record\n'
        '                                   are pressed live and live only here.\n'
        '           Current step          - previous, this, next. The cheapest panel in the\n'
        '                                   rail at 95px and the only place the step AFTER\n'
        '                                   this one is named - but the bar already carries\n'
        '                                   the diagram, the step and the position, so it\n'
        '                                   yields to the tools when only one of them fits.\n'
        '           Chapters              - a one-press jump mid-talk, and worth a slot only\n'
        '                                   when this diagram actually has subgraphs.\n'
        '           Presenter notes       - written here, but READ in the presenter view, where\n'
        '                                   they are set at 21px for a glance. Five of its six\n'
        '                                   controls - owner, seconds, source, reveal,\n'
        '                                   checkpoint - are authoring, so it yields early.\n'
        '           Navigator & sequence  - a jump the chip strip and the Map list already\n'
        '                                   offer, wrapped around the sequence editor.\n'
        '         Camera/motion/decisions, Saved branch scenarios and Workspace deck are set up\n'
        '         before anyone is in the room, so the fit never opens them. */\n'
        '      const PRESENT_RAIL_ORDER = [\n'
        "        ['presentToolsPanel', () => true],\n"
        "        ['presentStepPanel', () => true],\n"
        "        ['presentChaptersPanel', () => Boolean(el.presentChapters && el.presentChapters.childElementCount)],\n"
        "        ['presentNotesPanel', () => true],\n"
        "        ['presentSequencePanel', () => true]\n"
        '      ];\n'
        '      // What the fit last left behind. The presenter outranks it: the moment the rail\n'
        '      // says something this function did not, the fit stops rearranging their rail.\n'
        '      let presentRailPlan = null;\n'
        '\n'
        '      function layoutPresentationRail() {\n'
        '        const rail = el.presentSidebar;\n'
        '        const body = el.presentBody;\n'
        '        if (!rail || !body || el.presentOverlay.hidden || body.hidden) return;\n'
        "        if (body.classList.contains('sidebar-collapsed')) return;\n"
        "        const panels = Array.from(rail.querySelectorAll('details.present-panel'));\n"
        '        if (!panels.length) return;\n'
        '        // A rail that has not been laid out yet measures zero, and fitting to zero would\n'
        '        // close every panel. Leave it alone; the next frame or resize fits it.\n'
        '        if (rail.clientHeight < 120) return;\n'
        '        if (presentRailPlan && (presentRailPlan.length !== panels.length\n'
        '          || panels.some((panel, index) => panel.open !== presentRailPlan[index]))) return;\n'
        '        panels.forEach(panel => { panel.open = false; });\n'
        '        PRESENT_RAIL_ORDER.forEach(([key, worthOpening]) => {\n'
        '          const panel = el[key];\n'
        '          if (!panel || !worthOpening()) return;\n'
        '          panel.open = true;\n'
        '          if (rail.scrollHeight > rail.clientHeight) panel.open = false;\n'
        '        });\n'
        '        presentRailPlan = panels.map(panel => panel.open);\n'
        '      }',
    ))

    # ------------------------------------------------- 4. a fresh fit for each talk
    edits.append((
        "        el.presentBody.classList.remove('sidebar-collapsed');\n"
        "        el.presentSidebarToggle.setAttribute('aria-pressed', 'true');",
        "        el.presentBody.classList.remove('sidebar-collapsed');\n"
        '        // A new presentation starts from the fit this screen allows, not from the\n'
        '        // arrangement the last one happened to be left in.\n'
        '        presentRailPlan = null;\n'
        "        el.presentSidebarToggle.setAttribute('aria-pressed', 'true');",
    ))

    # ---------------------------------- 5. fit when the walkthrough half becomes real
    # presentBody is hidden while the Map is up, so the rail is only measurable here.
    edits.append((
        '        requestAnimationFrame(() => {\n'
        '          if (el.presentOverlay && !el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) {\n'
        '            el.presentOverlay.focus();\n'
        '          }\n'
        '        });',
        '        requestAnimationFrame(() => {\n'
        '          if (el.presentOverlay && !el.presentOverlay.hidden && !el.presentOverlay.contains(document.activeElement)) {\n'
        '            el.presentOverlay.focus();\n'
        '          }\n'
        '          // The rail has a height only once the walkthrough half is on screen.\n'
        '          layoutPresentationRail();\n'
        '        });',
    ))

    # ------------------------------------------------ 6. and when the rail comes back
    edits.append((
        '        requestAnimationFrame(() => { resizePresentationCanvas(true); '
        'if (presentAutoFocus) schedulePresentationCameraUpdate(false); });',
        '        requestAnimationFrame(() => { resizePresentationCanvas(true); '
        'if (presentAutoFocus) schedulePresentationCameraUpdate(false); layoutPresentationRail(); });',
    ))

    # -------------------------------------------------- 7. and when the screen changes
    # Full screen, a projector, a rotated laptop: the room the rail has just changed.
    edits.append((
        '        if(el.presentOverlay.hidden)return;mapMeasureChrome();resizePresentationCanvas(true);'
        'if(presentAutoFocus)schedulePresentationCameraUpdate(false);else updatePresentationMiniMapViewport();'
        'scheduleAudienceBroadcast();',
        '        if(el.presentOverlay.hidden)return;mapMeasureChrome();resizePresentationCanvas(true);'
        'if(presentAutoFocus)schedulePresentationCameraUpdate(false);else updatePresentationMiniMapViewport();'
        'scheduleAudienceBroadcast();layoutPresentationRail();',
    ))

    # ------------------------------ 8. Chapters is worth a slot only once it has any
    edits.append((
        '          el.presentChapters.appendChild(button);\n'
        '        });\n'
        '      }',
        '          el.presentChapters.appendChild(button);\n'
        '        });\n'
        '        // The rail only spends a slot on Chapters when there are chapters, and this\n'
        '        // is the moment that answer changes.\n'
        '        layoutPresentationRail();\n'
        '      }',
    ))

    for index, (old, new) in enumerate(edits, 1):
        found = text.count(old)
        if found != 1:
            raise SystemExit(
                'ABORT - edit %d matched %d times, expected 1. The file has drifted; '
                'nothing was written.\n  anchor: %r' % (index, found, old[:120])
            )
        text = text.replace(old, new, 1)
    return text


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python fix_pv_rail.py <path-to-html>')
    target = sys.argv[1]
    original = io.open(target, encoding='utf-8', newline='').read()

    # Refuse to run twice: the ids are this patch's fingerprint.
    if 'presentStepPanel' in original or 'layoutPresentationRail' in original:
        raise SystemExit('ABORT - fix_pv_rail has already been applied. Nothing was written.')

    patched = patch(original)

    folder = os.path.dirname(os.path.abspath(target))
    handle, temp = tempfile.mkstemp(dir=folder, suffix='.tmp')
    os.close(handle)
    with io.open(temp, 'w', encoding='utf-8', newline='') as out:
        out.write(patched)
    os.replace(temp, target)
    print('fix_pv_rail applied to %s (%d -> %d bytes)' % (target, len(original), len(patched)))


if __name__ == '__main__':
    main()
