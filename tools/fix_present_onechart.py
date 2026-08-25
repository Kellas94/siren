# -*- coding: utf-8 -*-
"""PRESENT ONE CHART - wave 2, blueprint section 3.

Answers the owner's complaint that Present has no way to present a single chart:

  1. The toolbar Present button becomes a split button (same pattern as the zoom
     cluster): the main half keeps its behaviour, a new caret opens a menu with
     'Present just this diagram · <name>' and 'Present the whole workspace'
     (plus 'Build the presentation…' when Build mode is installed).
  2. Solo mode: presenting one chart goes STRAIGHT into that diagram's existing
     walkthrough - no Map detour - and reuses every step of the walkthrough's
     logic (sequence, branches, camera, autoplay) untouched. The deck is just
     that diagram, so Next never wanders into other diagrams.
  3. First run: a workspace of one diagram with nothing authored on the plane
     "just presents" on a plain Present press. The Map remains one explicit
     menu choice away.
  4. Honest counts: solo shows 'Slide 2 of 7' (overview = slide 1) instead of a
     one-item 'Diagram 1 of 1' deck, and drops the duplicate step counter.
  5. Exit honesty: Escape / Exit from solo returns to the editor the presenter
     left (never to a Map they never saw). The bar's Map button hides in solo.
     Entering a walkthrough FROM the Map keeps today's behaviour: Escape
     returns to the Map.
  6. Solo ends honestly too: applying a wider deck from the Studio returns the
     header to 'Diagram x of y' and brings the Map button back - and that
     button rebuilds the Map when the plane was never built this session,
     instead of resuming onto empty tiles.

Anchor-guarded: every edit finds its anchor exactly once or the script aborts
without writing anything. Atomic write. Usage:  python fix_present_onechart.py <target.html>
"""
import os
import sys
import tempfile

PATCHES = [

# ---------------------------------------------------------------- 1. CSS: the split cluster
(
"css present-cluster",
"    .zoom-chip-caret { width: 28px; margin-left: -1px; border-top-left-radius: 0; border-bottom-left-radius: 0; font-size: 12px; }\n",
"    .zoom-chip-caret { width: 28px; margin-left: -1px; border-top-left-radius: 0; border-bottom-left-radius: 0; font-size: 12px; }\n"
"    .present-cluster { display: inline-flex; align-items: center; flex: 0 0 auto; }\n",
),

# ---------------------------------------------------------------- 2. Toolbar: Present grows a caret
(
"toolbar split button",
'            <button class="btn compact" id="presentButton" type="button" title="Full-screen step-by-step walkthrough"><span aria-hidden="true">▶</span> <span>Present</span></button>\n',
'            <div class="present-cluster" role="group" aria-label="Present">'
'<button class="btn compact zoom-chip" id="presentButton" type="button" title="Full-screen step-by-step walkthrough"><span aria-hidden="true">▶</span> <span>Present</span></button>'
'<button class="btn compact zoom-chip-caret" id="presentMenuButton" type="button" aria-haspopup="listbox" aria-label="Choose what to present" title="Present just this diagram, or the whole workspace"><span aria-hidden="true">▾</span></button>'
'</div>\n',
),

# ---------------------------------------------------------------- 3. Keys dialogs stay honest about Esc
# (two guide callouts carry this text: the Present keys dialog and the app guide)
(
"keys dialog esc text",
"<kbd>Esc</kbd> back to the Map.</div>",
"<kbd>Esc</kbd> back to the Map — or straight out when presenting a single diagram.</div>",
2,
),

# ---------------------------------------------------------------- 4. el cache learns the new button
(
"el id list",
"'connectModeButton','presentButton','focusPreviewButton',",
"'connectModeButton','presentButton','presentMenuButton','focusPreviewButton',",
),

# ---------------------------------------------------------------- 5. Bind the caret
(
"bind caret",
"        el.presentButton.addEventListener('click', openPresentation);\n",
"        el.presentButton.addEventListener('click', openPresentation);\n"
"        if (el.presentMenuButton) el.presentMenuButton.addEventListener('click', openPresentMenu);\n",
),

# ---------------------------------------------------------------- 6. Solo state
(
"presentSolo declaration",
"      let presentDeckIds = [];\n      let presentDeckIndex = 0;\n",
"      let presentDeckIds = [];\n      let presentDeckIndex = 0;\n"
"      // Presenting one chart as its own deck, entered without the Map. Session-only:\n"
"      // Escape and Exit leave Present directly instead of returning to a Map the\n"
"      // presenter never saw, and the bar counts slides instead of a one-item deck.\n"
"      let presentSolo = false;\n",
),

# ---------------------------------------------------------------- 7. The front door: request + helpers + menu
(
"solo helpers before openPresentation",
"      async function openPresentation() {\n        syncStateFromControls();\n",
"""      // What the next openPresentation() should show. '' lets the workspace decide,
      // 'map' forces the Map, a diagram id presents that one chart alone. Cleared on
      // every open so a stale request can never redirect a later plain press.
      let presentOpenRequest = '';

      function presentSoloTargetId(request) {
        if (request === 'map') return '';
        if (request) return state.diagrams.some(diagram => diagram.id === request) ? request : '';
        // A plain press decides by what exists. One diagram with nothing authored on
        // the plane means the Map would be a single tile and a detour: just present.
        // Seeded route stops (bare whole-map + this diagram) do not count as authoring;
        // anything recorded, framed, noted, held, curated or added as a card does.
        if (state.diagrams.length !== 1) return '';
        const map = state.map || {};
        if ((map.cards || []).length || map.curated) return '';
        const only = state.diagrams[0].id;
        const authored = (map.route || []).some(view => {
          if (!view || !view.target) return false;
          if (view.note || view.framed || view.rect || view.hold) return true;
          if (view.target.kind === 'map') return false;
          return !(view.target.kind === 'diagram' && view.target.diagramId === only);
        });
        return authored ? '' : only;
      }

      function setPresentationSoloChrome(on) {
        // The Map button is the one bar control that leads somewhere solo never was.
        if (el.presentMapButton) el.presentMapButton.hidden = Boolean(on);
      }

      function openPresentMenu() {
        const active = getActiveDiagram();
        const name = String(active?.name || active?.diagramTitle || '').trim();
        const soloLabel = 'Present just this diagram' + (name ? ` · ${name.slice(0, 40)}` : '');
        const options = [
          ['solo', soloLabel, active ? false : 'Add a diagram first'],
          ['map', 'Present the whole workspace']
        ];
        if (typeof mapSetBuild === 'function') options.push(['build', 'Build the presentation…']);
        openStructureMenu(el.presentMenuButton, options, '', async choice => {
          presentOpenRequest = choice === 'solo' ? (getActiveDiagram()?.id || '') : 'map';
          await openPresentation();
          if (choice === 'build' && typeof mapSetBuild === 'function' && !el.presentOverlay.hidden) mapSetBuild(true);
        });
      }

      async function openPresentation() {
        const openRequest = presentOpenRequest;
        presentOpenRequest = '';
        syncStateFromControls();
""",
),

# ---------------------------------------------------------------- 8. Solo skips the Map, reuses the walkthrough
(
"openPresentation tail",
"""        // Present opens on the Map now: the whole workspace at once, with a route
        // already drawn through it. A diagram is one press away, and the walk that
        // Present has always had is what that press opens.
        mapOpen();
        if (!document.fullscreenElement) mapToggleFullscreen();
""",
"""        // Present opens on the Map when there is a workspace to map: every diagram
        // at once, with a route drawn through it. A single diagram with nothing else
        // authored skips the detour - the Map would be one tile - and an explicit
        // 'Present just this diagram' request skips it from anywhere. Solo reuses the
        // walkthrough exactly as the Map does; only the deck and the exits differ.
        const soloId = presentSoloTargetId(openRequest);
        presentSolo = Boolean(soloId);
        setPresentationSoloChrome(presentSolo);
        if (presentSolo) {
          mapSetMode(false);
          presentDeckIds = [soloId];
          presentDeckIndex = 0;
          const loaded = await loadPresentationDiagram(0, { startAt: -1, animate: false });
          if (!loaded) { closePresentation(); return; }
        } else {
          mapOpen();
        }
        if (!document.fullscreenElement) mapToggleFullscreen();
""",
),

# ---------------------------------------------------------------- 9. Honest counts in solo
(
"header counts",
"""        el.presentStep.textContent = presentIndex < 0
          ? label
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`;
        el.presentDeckPosition.textContent = `Diagram ${presentDeckIndex + 1} of ${presentDeckIds.length}`;
""",
"""        el.presentStep.textContent = presentIndex < 0 || presentSolo
          ? label
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`;
        // Solo counts slides, not a one-item diagram deck: the overview is slide 1,
        // so 'Slide 2 of 7' is literally what the audience has been shown so far.
        el.presentDeckPosition.textContent = presentSolo
          ? `Slide ${presentIndex + 2} of ${presentSequence.length + 1}`
          : `Diagram ${presentDeckIndex + 1} of ${presentDeckIds.length}`;
""",
),

# ---------------------------------------------------------------- 10. Escape leaves solo directly
(
"escape gate",
"        if (event.key === 'Escape' && !mapMode && state.map && state.map.route.length) {",
"        if (event.key === 'Escape' && !mapMode && !presentSolo && state.map && state.map.route.length) {",
),

# ---------------------------------------------------------------- 11. Close resets solo
(
"closePresentation reset",
"        updatePresentationAutoFocusButton();\n        setPresentationBackgroundInert(false);",
"        presentSolo = false;\n        setPresentationSoloChrome(false);\n"
"        updatePresentationAutoFocusButton();\n        setPresentationBackgroundInert(false);",
),

# ---------------------------------------------------------------- 12. Entering from the Map is never solo
(
"mapEnterDiagram reset",
"      async function mapEnterDiagram(diagramId, startNodeId) {\n        mapHideNodeChip();\n",
"      async function mapEnterDiagram(diagramId, startNodeId) {\n        mapHideNodeChip();\n"
"        // Entering from the Map is by definition not solo: Escape from this\n"
"        // walkthrough must return to the Map the presenter just left.\n"
"        presentSolo = false;\n        setPresentationSoloChrome(false);\n",
),

# ---------------------------------------------------------------- 13. Command palette entries
(
"command palette",
"        add('Present', 'Diagram', openPresentation);\n",
"        add('Present', 'Diagram', openPresentation);\n"
"        add('Present just this diagram', 'Diagram', () => { presentOpenRequest = getActiveDiagram()?.id || ''; openPresentation(); });\n"
"        add('Present the whole workspace', 'Diagram', () => { presentOpenRequest = 'map'; openPresentation(); });\n",
),

# ---------------------------------------------------------------- 14. Applying a bigger deck ends solo honestly
(
"apply deck un-solo",
"""        state.presentationDeck=selected;
        presentDeckIds=[...selected];
        presentDeckIndex=Math.max(0,presentDeckIds.indexOf(currentId));
""",
"""        state.presentationDeck=selected;
        presentDeckIds=[...selected];
        // Applying a wider deck from the Studio ends solo mode honestly: the header
        // goes back to counting diagrams and the Map button returns for the tour.
        if (presentSolo && presentDeckIds.length > 1) { presentSolo = false; setPresentationSoloChrome(false); }
        presentDeckIndex=Math.max(0,presentDeckIds.indexOf(currentId));
""",
),

# ---------------------------------------------------------------- 15. Map button never resumes an unbuilt plane
(
"map button rebuild guard",
"""        if (el.presentMapButton) el.presentMapButton.addEventListener('click', () => {
          if (!state.map || !state.map.route.length) mapOpen();
          else mapReturnFromDiagram();
        });
""",
"""        if (el.presentMapButton) el.presentMapButton.addEventListener('click', () => {
          // A route can exist while the plane was never built this session (Present
          // entered solo, then a wider deck was applied): resuming would show empty
          // tiles, so rebuild the Map instead.
          if (!state.map || !state.map.route.length || !mapTileEls.size) mapOpen();
          else mapReturnFromDiagram();
        });
""",
),
]


def main():
    if len(sys.argv) != 2:
        print('usage: python fix_present_onechart.py <target.html>')
        sys.exit(2)
    path = sys.argv[1]
    with open(path, encoding='utf-8') as handle:
        src = handle.read()

    problems = []
    for patch in PATCHES:
        name, find = patch[0], patch[1]
        expected = patch[3] if len(patch) > 3 else 1
        count = src.count(find)
        if count != expected:
            problems.append(f'  {name}: anchor found {count} times (need exactly {expected})')
    if problems:
        print('ABORT - anchors drifted, nothing written:')
        print('\n'.join(problems))
        sys.exit(1)

    for patch in PATCHES:
        name, find, repl = patch[0], patch[1], patch[2]
        expected = patch[3] if len(patch) > 3 else 1
        src = src.replace(find, repl, expected)

    directory = os.path.dirname(os.path.abspath(path)) or '.'
    fd, tmp = tempfile.mkstemp(dir=directory, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
            handle.write(src)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print(f'OK - {len(PATCHES)} patches applied to {path}')


if __name__ == '__main__':
    main()
