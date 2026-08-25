#!/usr/bin/env python3
"""
fix_present_build.py — Present wave 2, Builder A: BUILD MODE.

The chips strip at the bottom of the Map is already the deck; this patch makes
Build mode its edit state:
  - a visible "✎ Build" button on the map bar (plus the B key) opens Build;
  - the bar's centre cluster swaps for the Build bar:
      [＋ Add] [● Keep this view] [Tidy up] [⤓ Slides] [Done];
  - the ＋ Add menu adds diagram stops (the ones the route does not walk yet),
    Title slides, Section breaks, Text cards, Facts and Document cards — always
    after the current stop;
  - in Build the chips wear their edit dress: thumbnails (diagram stops reuse
    the tiles' own rendered SVG cache; cards draw a mini card), a permanent ×,
    a grab cursor, and a ＋ marking the insertion point; Shift+←/→ moves the
    current stop for keyboard users, drag still works;
  - "● Record route" retires as a separate concept (Keep this view / Space in
    Build are the same capture); the #mapPanel becomes purely Presenter notes;
  - state.map.curated: the first deliberate edit makes the deck the author's —
    mapSeedRoute stops re-appending removed diagrams and mapPresentationDeckIds
    counts only what the route walks. Persisted inside state.map, so it
    survives save/load and .siren export/import for free.

Seam for the content-slides wave (Builder B): mapAddCard now returns the card
and ends with `if (typeof mapCardEditorOpen === 'function') mapCardEditorOpen(card)`.
When B installs the card editor dialog it assigns mapCardEditorOpen and every
add opens the editor; until then adds behave as today.

Usage: python fix_present_build.py <target.html>
Anchor-guarded: every edit finds its anchor by exact, currently-verified text;
if ANY anchor is missing or ambiguous the script aborts WITHOUT writing.
Atomic write (temp file + os.replace).
"""
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new):
    EDITS.append((name, old, new))


# ---------------------------------------------------------------- E1: #mapPanel
# The panel drops its three action buttons and becomes purely Presenter notes.
# The verbs move to the Build bar (Tidy/Slides keep their ids so their existing
# bindings keep working); ＋ Card grows into ＋ Add on the Build bar.
edit('E1 mapPanel actions', '''          <div class="present-tool-actions">
            <button class="btn ghost compact" id="mapAddCardButton" type="button" title="Add a title, text, document or facts card beside what you are looking at">＋ Card</button>
            <button class="btn ghost compact" id="mapTidyButton" type="button" title="Lay the tiles out again">Tidy up</button>
            <button class="btn ghost compact" id="mapExportButton" type="button" title="Export the route as slides">⤓ Slides</button>
          </div>
''', '''          <!-- The verbs moved to the Build bar: notes are for presenting, authoring
               lives in Build. One home per concept. -->
''')

# ------------------------------------------------------------------ E2: mapBar
# Two mutually exclusive centre clusters. "● Record route" is removed: Build is
# the one authoring entry, visible at rest.
edit('E2 mapBar clusters', '''        <div class="map-bar" id="mapBar">
          <button class="btn ghost compact" id="mapPrevButton" type="button" aria-label="Previous view">◀</button>
          <span class="map-position" id="mapPosition">1 / 1</span>
          <button class="btn secondary compact" id="mapNextButton" type="button" aria-label="Next view">▶</button>
          <span class="map-view-name" id="mapViewName"></span>
          <button class="btn ghost compact" id="mapHomeButton" type="button" title="Pull back to the whole workspace">⌂ Whole map</button>
          <span class="map-authoring">
            <button class="btn ghost compact" id="mapRecordButton" type="button" aria-pressed="false" title="Move the camera, press Space to keep a view">● Record route</button>
            <button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>
            <button class="btn ghost compact" id="mapFullscreenButton" type="button" title="Full screen">⤢</button>
          </span>
          <button class="btn ghost compact" id="mapMoreButton" type="button" aria-pressed="false" title="Authoring tools">⋯</button>
          <button class="btn ghost icon compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>
        </div>''', '''        <div class="map-bar" id="mapBar">
          <button class="btn ghost compact" id="mapPrevButton" type="button" aria-label="Previous view">◀</button>
          <span class="map-position" id="mapPosition">1 / 1</span>
          <button class="btn secondary compact" id="mapNextButton" type="button" aria-label="Next view">▶</button>
          <span class="map-view-name" id="mapViewName"></span>
          <!-- Two mutually exclusive centre clusters - presenting and Build. The swap
               keeps the bar one row wide in front of a client: only one cluster is
               ever laid out, so the at-rest bar grows by exactly one button. -->
          <span class="map-bar-cluster" id="mapBarPresent">
            <button class="btn ghost compact" id="mapHomeButton" type="button" title="Pull back to the whole workspace">⌂ Whole map</button>
            <button class="btn ghost compact" id="mapBuildButton" type="button" aria-pressed="false" title="Build the presentation: add, reorder and remove its slides (B)">✎ Build</button>
            <span class="map-authoring">
              <button class="btn ghost compact" id="mapPresenterButton" type="button" aria-pressed="true" title="Presenter notes">▤ Notes</button>
              <button class="btn ghost compact" id="mapFullscreenButton" type="button" title="Full screen">⤢</button>
            </span>
            <button class="btn ghost compact" id="mapMoreButton" type="button" aria-pressed="false" title="Authoring tools">⋯</button>
          </span>
          <span class="map-bar-cluster" id="mapBarBuild" hidden>
            <button class="btn secondary compact" id="mapAddButton" type="button" aria-haspopup="listbox" title="Add a slide after the current one">＋ Add</button>
            <button class="btn ghost compact" id="mapKeepViewButton" type="button" title="Keep what the camera is looking at as a slide (Space)">● Keep this view</button>
            <button class="btn ghost compact" id="mapTidyButton" type="button" title="Lay the tiles out again">Tidy up</button>
            <button class="btn ghost compact" id="mapExportButton" type="button" title="Export the route as slides">⤓ Slides</button>
            <button class="btn compact" id="mapDoneButton" type="button" title="Finish building (B or Esc)">Done</button>
          </span>
          <button class="btn ghost icon compact" id="presentKeysButton" type="button" aria-haspopup="dialog" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
          <button class="btn ghost compact" id="mapExitButton" type="button">Exit</button>
        </div>''')

# --------------------------------------------------------------- E3: el lookup
edit('E3 element ids', "'mapExportButton','mapBar',",
     "'mapExportButton','mapBar','mapBarPresent','mapBarBuild','mapBuildButton','mapAddButton','mapKeepViewButton','mapDoneButton',")

# --------------------------------------------------- E4: bindEvents build wires
edit('E4 record binding becomes Build bindings', '''        if (el.mapRecordButton) el.mapRecordButton.addEventListener('click', () => {
          mapToggleRecording();
          // The button tells you to press Space; with focus still on it, Space would
          // press the button again instead of keeping the view.
          el.mapRecordButton.blur();
          if (el.mapLayer) el.mapLayer.focus();
        });''', '''        if (el.mapBuildButton) el.mapBuildButton.addEventListener('click', () => {
          mapSetBuild(!mapBuilding);
          // The mode tells you to press Space; with focus still on the button, Space
          // would press it again instead of keeping the view.
          el.mapBuildButton.blur();
          if (el.mapLayer) el.mapLayer.focus();
        });
        if (el.mapDoneButton) el.mapDoneButton.addEventListener('click', () => {
          mapSetBuild(false);
          // Keyboard users land back on the toggle they came in through.
          if (el.mapBuildButton) el.mapBuildButton.focus();
        });
        if (el.mapKeepViewButton) el.mapKeepViewButton.addEventListener('click', () => {
          mapCaptureView();
          el.mapKeepViewButton.blur();
          if (el.mapLayer) el.mapLayer.focus();
        });''')

# ------------------------------------------------------- E5: ＋ Add menu wiring
edit('E5 add menu binding',
     "        if (el.mapAddCardButton) el.mapAddCardButton.addEventListener('click', () => mapOpenCardMenu(el.mapAddCardButton));",
     "        if (el.mapAddButton) el.mapAddButton.addEventListener('click', () => mapOpenAddMenu(el.mapAddButton));")

# ------------------------------------------------------------- E7: module state
edit('E7 mapBuilding flag', '      let mapRecording = false;',
     '''      let mapRecording = false;
      // Session-only: the chips strip's edit state. Never persisted - a reopened
      // presentation always starts presenting, not building.
      let mapBuilding = false;''')

# ------------------------------------------------------- E8: default map state
edit('E8 curated default',
     "        return { tiles: {}, cards: [], route: [], settings: { speed: 'smooth', arc: true, loop: false, hold: 8 } };",
     "        return { tiles: {}, cards: [], route: [], curated: false, settings: { speed: 'smooth', arc: true, loop: false, hold: 8 } };")

# --------------------------------------------------------- E9: sanitizeMapState
edit('E9 curated sanitize', '          layoutVersion: Number(map.layoutVersion) || 0,',
     '''          layoutVersion: Number(map.layoutVersion) || 0,
          // Set the first time the author edits the deck on purpose. Lives inside
          // state.map, so it survives save/load and .siren export/import for free.
          curated: Boolean(map.curated),''')

# ------------------------------------------------------ E10: mapSeedRoute gate
edit('E10 seed curated gate', '''        if (state.map.route.length) {
          // Diagrams added since''', '''        if (state.map.route.length) {
          // A curated deck belongs to its author: once a stop has been added,
          // removed or reordered on purpose, nothing is appended behind their
          // back. New diagrams surface in Build's ＋ Add menu instead.
          if (state.map.curated) return;
          // Diagrams added since''')

# --------------------------------------------- E11: mapPresentationDeckIds gate
edit('E11 deck ids curated gate', '''        state.diagrams.forEach(diagram => add(diagram.id));
        return ordered;''', '''        // A curated deck means exactly what it says: only the diagrams the route
        // walks. An untouched route keeps counting the whole workspace.
        if (!(state.map && state.map.curated)) state.diagrams.forEach(diagram => add(diagram.id));
        return ordered;''')

# ----------------------------------------------------- E12: mapSetMode resets
edit('E12 leaving the map closes Build', '        mapMode = Boolean(on);',
     '''        mapMode = Boolean(on);
        // Leaving the Map always closes Build: the mode is the strip's edit
        // state, and the strip is gone.
        if (!mapMode && mapBuilding) mapSetBuild(false);''')

# ----------------------------------- E13: mapSetBuild / mapMarkCurated / move
edit('E13 build mode core', '      /* The plane shows every diagram in the workspace, so a walkthrough entered from',
     '''      /* ---------------- Build mode ----------------
         The chips strip at the bottom is already the deck; Build is its edit
         state. One visible button turns it on, every verb that authors the deck
         lives on the Build bar, and Done hands the room back to the presenter. */
      function mapSetBuild(on) {
        mapBuilding = Boolean(on);
        // Record-route folded into Build: the flag survives for the shared
        // capture branches, but Build is the only door left to it.
        if (mapBuilding && mapRecording) mapToggleRecording(false);
        if (el.mapBuildButton) el.mapBuildButton.setAttribute('aria-pressed', String(mapBuilding));
        if (el.mapBarPresent) el.mapBarPresent.hidden = mapBuilding;
        if (el.mapBarBuild) el.mapBarBuild.hidden = !mapBuilding;
        if (el.mapLayer) {
          if (mapBuilding) el.mapLayer.dataset.building = 'on';
          else delete el.mapLayer.dataset.building;
        }
        if (el.mapFocusRing) el.mapFocusRing.hidden = !mapBuilding;
        mapSetHint(mapBuilding
          ? '＋ adds a slide · move the camera and press Space to keep a view · drag a chip (or Shift+←/→) to reorder · B or Done when finished'
          : MAP_RESTING_HINT);
        mapRenderRoute();
        // The chips grow thumbnails in Build, so the reserved band under the
        // camera changes height with the mode.
        mapMeasureChrome();
        if (!mapBuilding) {
          mapSelectedNodeIds = [];
          // Done returns to presenting standing on the current stop.
          if (mapMode) mapGoToView(mapRouteIndex);
        }
      }

      /* The first deliberate edit makes the deck the author's. From then on
         mapSeedRoute stops appending new diagrams behind their back and the
         walkthrough deck counts only what the route walks. */
      function mapMarkCurated() {
        if (state.map && !state.map.curated) state.map.curated = true;
      }

      /* Keyboard twin of dragging a chip: Shift+arrows move the current stop. */
      function mapMoveView(delta) {
        const route = state.map && state.map.route;
        if (!route || route.length < 2) return;
        const to = mapRouteIndex + delta;
        if (to < 0 || to >= route.length) return;
        const [moved] = route.splice(mapRouteIndex, 1);
        route.splice(to, 0, moved);
        mapRouteIndex = to;
        mapMarkCurated();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
      }

      /* The plane shows every diagram in the workspace, so a walkthrough entered from''')

# -------------------------------------------------------- E14: mapHandleKey
edit('E14 space captures in Build', '''        if (event.key === ' ' || event.key === 'Spacebar') {
          if (mapRecording) { mapCaptureView(); return true; }''', '''        if (event.key === ' ' || event.key === 'Spacebar') {
          if (mapRecording || mapBuilding) { mapCaptureView(); return true; }''')

edit('E14 shift-arrows reorder', "        if (event.key === 'ArrowRight' || event.key === 'PageDown') { mapStepRoute(1); return true; }",
     '''        if (mapBuilding && event.shiftKey && event.key === 'ArrowRight') { mapMoveView(1); return true; }
        if (mapBuilding && event.shiftKey && event.key === 'ArrowLeft') { mapMoveView(-1); return true; }
        if (event.key === 'ArrowRight' || event.key === 'PageDown') { mapStepRoute(1); return true; }''')

edit('E14 B toggles Build', "        if (event.key === 'r' || event.key === 'R') { mapToggleRecording(); return true; }",
     "        if (event.key === 'b' || event.key === 'B') { mapSetBuild(!mapBuilding); return true; }")

edit('E14 delete in Build', '''        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (mapRecording) { mapDeleteView(); return true; }''', '''        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (mapRecording || mapBuilding) { mapDeleteView(); return true; }''')

edit('E14 escape exits Build first', '''        if (event.key === 'Escape') {
          const bounds = mapBounds();''', '''        if (event.key === 'Escape') {
          // Esc in Build means Done: leave the mode, stay on the Map.
          if (mapBuilding) { mapSetBuild(false); return true; }
          const bounds = mapBounds();''')

# ------------------------------------------------- E15: tile click picks blocks
edit('E15 tile click in Build', '''          if (mapRecording) {
            if (!id) return;''', '''          if (mapRecording || mapBuilding) {
            if (!id) return;''')

# ------------------------------------- E16: chip thumbnails + is-building class
edit('E16 chip thumbs + class plumbing', '''      function mapRenderRoute() {
        if (!el.mapRoute) return;
        el.mapRoute.replaceChildren();''', '''      /* Build dress for a chip: a small true preview. Diagram stops reuse the
         tiles' own rendered SVG cache (no second renderer); card stops draw a
         mini card; the map stop is the house. Presenting keeps the compact text
         pills - the strip only becomes a slide sorter when asked to be one. */
      function mapChipThumb(view) {
        const target = view.target || {};
        const thumb = document.createElement('span');
        thumb.className = 'map-route-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        if (target.kind === 'map') { thumb.textContent = '⌂'; return thumb; }
        if (target.kind === 'card') {
          const card = (state.map.cards || []).find(entry => entry.id === target.cardId);
          thumb.classList.add('is-card');
          thumb.textContent = card && card.kind === 'doc' ? '▤' : card && card.kind === 'facts' ? '≣' : 'Aa';
          return thumb;
        }
        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        const svg = diagram ? mapSvgFor(diagram) : '';
        if (!svg) { thumb.textContent = '▦'; return thumb; }
        let url = mapSvgCache.get(diagram.id + '::' + svg.length);
        if (!url) {
          url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          mapSvgCache.set(diagram.id + '::' + svg.length, url);
        }
        const image = document.createElement('img');
        image.src = url;
        image.alt = '';
        thumb.appendChild(image);
        return thumb;
      }

      function mapRenderRoute() {
        if (!el.mapRoute) return;
        el.mapRoute.classList.toggle('is-building', mapBuilding);
        el.mapRoute.replaceChildren();''')

edit('E16 thumb into chip', '          go.append(number, label);',
     '''          go.append(number, label);
          if (mapBuilding) go.prepend(mapChipThumb(view));''')

edit('E16 drop curates', '''            const [moved] = route.splice(from, 1);
            route.splice(index, 0, moved);
            mapRouteIndex = index;
            scheduleSave();
            mapRenderRoute();
            mapRenderThread();''', '''            const [moved] = route.splice(from, 1);
            route.splice(index, 0, moved);
            mapRouteIndex = index;
            mapMarkCurated();
            scheduleSave();
            mapRenderRoute();
            mapRenderThread();
            // The moved chip is now the current stop; the bar must say so.
            mapUpdateChrome();''')

# -------------------------------------------------- E17..E19: curated marking
edit('E17 capture curates', '''        mapRouteIndex += 1;
        mapSelectedNodeIds = [];''', '''        mapRouteIndex += 1;
        mapSelectedNodeIds = [];
        mapMarkCurated();''')

edit('E18 delete curates', '''        if (!state.map || state.map.route.length <= 1) return;
        state.map.route.splice(mapRouteIndex, 1);''', '''        if (!state.map || state.map.route.length <= 1) return;
        state.map.route.splice(mapRouteIndex, 1);
        mapMarkCurated();''')

edit('E19 card add curates', '''        const view = sanitizeRouteView({ target: { kind: 'card', cardId: card.id }, note: '' });
        state.map.route.splice(mapRouteIndex + 1, 0, view);
        mapRouteIndex += 1;''', '''        const view = sanitizeRouteView({ target: { kind: 'card', cardId: card.id }, note: '' });
        state.map.route.splice(mapRouteIndex + 1, 0, view);
        mapRouteIndex += 1;
        mapMarkCurated();''')

edit('E19 card editor seam', '''        mapRenderCards();
        mapRenderRoute();
        mapRenderThread();
        mapGoToView(mapRouteIndex);
      }''', '''        mapRenderCards();
        mapRenderRoute();
        mapRenderThread();
        mapGoToView(mapRouteIndex);
        // Seam for the content-slides wave: when the card editor dialog is
        // installed it assigns mapCardEditorOpen, so a fresh card opens ready to
        // write instead of living on as a "New section" fossil. Until then adds
        // behave as today and the card is edited by clicking it.
        if (typeof mapCardEditorOpen === 'function') mapCardEditorOpen(card);
        return card;
      }''')

# ------------------------------------ E20: mapOpenCardMenu becomes mapOpenAddMenu
edit('E20 the one Add menu', '''      function mapOpenCardMenu(anchorEl) {
        const camera = mapCameraRect();
        const covering = state.diagrams.filter(diagram => {
          const tile = mapTileRect(diagram.id);
          return tile && mapRectsIntersect(tile, camera);
        });
        const diagramId = covering.length === 1 ? covering[0].id : '';
        const options = [];
        // Documents already linked to the diagram in view come first: that is the
        // two-click path from a written workpaper to a slide.
        (state.workpapers || []).forEach(doc => {
          const linked = (doc.links || []).some(link => link.diagramId === diagramId);
          if (!linked) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        options.push(['title', 'Title card'], ['text', 'Text card']);
        if (diagramId) options.push(['facts', 'Facts about the blocks in view']);
        (state.workpapers || []).forEach(doc => {
          if ((doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        openStructureMenu(anchorEl, options.slice(0, 14), '', value => {
          if (value === 'title') {
            mapAddCard('title', { eyebrow: 'Section', title: 'New section', body: '' });
          } else if (value === 'text') {
            mapAddCard('text', { title: 'Note', body: 'Write here.' });
          } else if (value === 'facts') {
            const tile = mapTileEls.get(diagramId);
            const svg = tile && tile.body.querySelector('svg');
            const ids = svg ? Array.from(svg.querySelectorAll('.node')).map(mapNodeIdFromElement).filter(Boolean).slice(0, 8) : [];
            mapAddCard('facts', { title: 'Block facts', diagramId, nodeIds: mapSelectedNodeIds.length ? mapSelectedNodeIds : ids });
          } else if (value.startsWith('doc:')) {
            const doc = (state.workpapers || []).find(entry => entry.id === value.slice(4));
            if (doc) mapAddCard('doc', { title: doc.title, docId: doc.id });
          }
        });
      }''', '''      /* One menu, everything addable. Diagrams the route does not walk yet come
         first - they no longer auto-append (see mapSeedRoute), so this is where a
         new or removed diagram rejoins the deck. Then slides, then documents.
         One insertion rule, stated once: everything lands after the current stop,
         and the chips strip is on screen to show it arrive. */
      function mapOpenAddMenu(anchorEl) {
        const camera = mapCameraRect();
        const covering = state.diagrams.filter(diagram => {
          const tile = mapTileRect(diagram.id);
          return tile && mapRectsIntersect(tile, camera);
        });
        const diagramId = covering.length === 1 ? covering[0].id : '';
        const options = [];
        const walked = new Set((state.map.route || [])
          .filter(view => view.target && (view.target.kind === 'diagram' || view.target.kind === 'nodes'))
          .map(view => view.target.diagramId));
        state.diagrams.forEach(diagram => {
          if (walked.has(diagram.id)) return;
          options.push([`diagram:${diagram.id}`, `Diagram · ${diagram.name || diagram.diagramTitle || 'Diagram'}`]);
        });
        // Documents already linked to the diagram in view come first: that is the
        // two-click path from a written workpaper to a slide.
        (state.workpapers || []).forEach(doc => {
          const linked = (doc.links || []).some(link => link.diagramId === diagramId);
          if (!linked) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        options.push(['title', 'Title slide'], ['section', 'Section break'], ['text', 'Text card']);
        if (diagramId) options.push(['facts', 'Facts about the blocks in view']);
        (state.workpapers || []).forEach(doc => {
          if ((doc.links || []).some(link => link.diagramId === diagramId)) return;
          options.push([`doc:${doc.id}`, `Document · ${doc.title}`]);
        });
        openStructureMenu(anchorEl, options.slice(0, 14), '', value => {
          if (value.startsWith('diagram:')) {
            mapAddDiagramStop(value.slice(8));
          } else if (value === 'title') {
            mapAddCard('title', { eyebrow: '', title: state.projectName || 'Presentation', body: '' });
          } else if (value === 'section') {
            mapAddCard('title', { eyebrow: 'Section', title: 'New section', body: '' });
          } else if (value === 'text') {
            mapAddCard('text', { title: 'Note', body: 'Write here.' });
          } else if (value === 'facts') {
            const tile = mapTileEls.get(diagramId);
            const svg = tile && tile.body.querySelector('svg');
            const ids = svg ? Array.from(svg.querySelectorAll('.node')).map(mapNodeIdFromElement).filter(Boolean).slice(0, 8) : [];
            mapAddCard('facts', { title: 'Block facts', diagramId, nodeIds: mapSelectedNodeIds.length ? mapSelectedNodeIds : ids });
          } else if (value.startsWith('doc:')) {
            const doc = (state.workpapers || []).find(entry => entry.id === value.slice(4));
            if (doc) mapAddCard('doc', { title: doc.title, docId: doc.id });
          }
        });
      }

      /* A diagram stop is the ＋ Add twin of mapCaptureView: same splice, same
         insertion rule - after the current stop. */
      function mapAddDiagramStop(diagramId) {
        if (!state.map || !state.diagrams.some(diagram => diagram.id === diagramId)) return;
        const view = sanitizeRouteView({ target: { kind: 'diagram', diagramId }, note: '' });
        state.map.route.splice(mapRouteIndex + 1, 0, view);
        mapRouteIndex += 1;
        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapGoToView(mapRouteIndex);
      }''')

# ------------------------------------------------------------- E21: mapOpen
edit('E21 open resets Build', '''        mapRouteIndex = 0;
        mapToggleRecording(false);
        mapSetMode(true);''', '''        mapRouteIndex = 0;
        mapToggleRecording(false);
        mapSetBuild(false);
        mapSetMode(true);''')

# ------------------------------------------------------ E22: shortcut teaching
edit('E22 guide dialog R->B',
     '<kbd>R</kbd> record a route: move the camera, then <kbd>Space</kbd> keeps the view',
     '<kbd>B</kbd> Build the presentation: ＋ adds a slide, <kbd>Space</kbd> keeps the camera view, <kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> moves the current stop')

edit('E22 present keys R->B',
     '<kbd>F</kbd> full screen · <kbd>R</kbd> record a route · <kbd>Esc</kbd> pulls back, then leaves.',
     '<kbd>F</kbd> full screen · <kbd>B</kbd> Build - add, reorder and remove slides (<kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> moves the current stop) · <kbd>Esc</kbd> pulls back, then leaves.')

# ----------------------------------------------------------------- E23: CSS
edit('E23 build css', '    .map-bar[data-more="on"] #mapMoreButton { border-color: var(--primary); color: var(--primary); }',
     '''    .map-bar[data-more="on"] #mapMoreButton { border-color: var(--primary); color: var(--primary); }
    /* Build mode. The chips strip is the deck; this is its edit dress. Both
       centre clusters share one flex home so the bar swaps rather than grows. */
    /* left:50% shrink-to-fit caps an absolute box at half its container, which
       wrapped the Build bar's labels onto two lines. Size to content instead. */
    .map-bar { width: max-content; max-width: calc(100vw - 24px); }
    .map-bar .btn, .map-bar .map-position { white-space: nowrap; }
    .map-bar-cluster { display: inline-flex; align-items: center; gap: 8px; }
    .map-bar-cluster[hidden] { display: none; }
    #mapBuildButton[aria-pressed="true"] { border-color: var(--primary); color: var(--primary); }
    /* While building, a tile's job is picking blocks to frame - not presenting. */
    .map-layer[data-building="on"] .map-tile-open { display: none; }
    .map-layer[data-building="on"] .map-view-name { max-width: 150px; }
    .map-route.is-building { gap: 16px; padding-top: 12px; padding-bottom: 12px; }
    .map-route.is-building .map-route-item { cursor: grab; border-radius: 12px; padding: 4px 6px; }
    .map-route.is-building .map-route-item:active { cursor: grabbing; }
    .map-route.is-building .map-route-item::before { content: '⠿'; opacity: .4; font-size: 11px; padding-left: 4px; }
    /* The x stops hiding behind hover: in Build every stop is visibly removable. */
    .map-route.is-building .map-route-drop { opacity: 1; }
    .map-route-thumb { display: none; }
    .map-route.is-building .map-route-thumb {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 40px;
      flex: 0 0 auto;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--panel-bg);
      overflow: hidden;
      font-size: 15px;
      color: var(--muted);
    }
    .map-route.is-building .map-route-thumb img { width: 100%; height: 100%; object-fit: contain; }
    .map-route.is-building .map-route-thumb.is-card { flex-direction: column; gap: 2px; font-size: 12px; font-weight: 800; }
    .map-route.is-building .map-route-thumb.is-card::before { content: ''; width: 66%; height: 4px; border-radius: 2px; background: var(--primary); }
    /* Everything new lands after the current chip - the + marks where. */
    .map-route.is-building .map-route-item.is-current { position: relative; }
    .map-route.is-building .map-route-item.is-current::after {
      content: '＋';
      position: absolute;
      right: -15px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--primary);
      font-weight: 800;
      font-size: 12px;
      pointer-events: none;
    }''')

# --------------------------------------- E24: late SVG renders refresh the strip
edit('E24 thumb refresh on late render', '''            mapUpdateTileDetail();
            mapRenderThread();
          }
        }).catch''', '''            mapUpdateTileDetail();
            mapRenderThread();
            // A chip thumbnail may have been waiting on exactly this render.
            if (mapBuilding) mapRenderRoute();
          }
        }).catch''')


def main():
    if len(sys.argv) != 2:
        print('usage: python fix_present_build.py <target.html>')
        return 2
    path = sys.argv[1]
    with open(path, encoding='utf-8', newline='') as handle:
        src = handle.read()
    if 'mapSetBuild' in src:
        print('ABORT: target already contains mapSetBuild - patch appears to be applied.')
        return 1
    problems = []
    out = src
    for name, old, new in EDITS:
        count = out.count(old)
        if count != 1:
            problems.append(f'{name}: anchor found {count} times (need exactly 1)')
            continue
        out = out.replace(old, new, 1)
    if problems:
        print('ABORT - nothing written. Anchor drift:')
        for problem in problems:
            print('  ' + problem)
        return 1
    directory = os.path.dirname(os.path.abspath(path)) or '.'
    fd, tmp = tempfile.mkstemp(dir=directory, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='') as handle:
            handle.write(out)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    print(f'OK: {len(EDITS)} edits applied to {path} ({len(src)} -> {len(out)} bytes)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
