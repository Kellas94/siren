#!/usr/bin/env python3
# fix_p6_cursor.py - DEFECT 3: "the readout and the picture are two sources of truth".
#
#   One function, mapGoToStop(index), owns BOTH mapRouteIndex and the camera.
#   Every entry point that changes which slide the room is looking at goes through
#   it. The two writers that deliberately do not are the two that provably keep the
#   SAME VIEW OBJECT under mapRouteIndex (a reorder and an undo), and they now
#   follow that object's identity instead of guessing a number.
#
# Usage:  python fix_p6_cursor.py <target.html>
# Anchor-guarded: every edit asserts its exact anchor text and its exact expected
# occurrence count. Any drift aborts the whole run WITHOUT writing anything.
# Atomic: the file is written to <target>.tmp and os.replace()d into place.

import io, os, sys

TARGET = sys.argv[1] if len(sys.argv) > 1 else ''
if not TARGET or not os.path.isfile(TARGET):
    print('usage: python fix_p6_cursor.py <target.html>')
    sys.exit(2)

src = io.open(TARGET, encoding='utf-8', newline='').read()
ORIGINAL_LEN = len(src)
edits = []


def sub(name, old, new, count=1):
    """Replace `old` exactly `count` times. Abort the whole run on any drift."""
    global src
    found = src.count(old)
    if found != count:
        print('ABORT - anchor drift on [%s]: expected %d occurrence(s), found %d' % (name, count, found))
        print('        first 120 chars of anchor: %r' % old[:120])
        sys.exit(1)
    src = src.replace(old, new, count)
    edits.append((name, count, len(new) - len(old)))


# ---------------------------------------------------------------------------
# E1  mapGoToView -> mapGoToStop.  One name for "stand on stop N": the function
#     already owned both halves; the point of the rename is that the invariant is
#     now greppable - `mapRouteIndex =` outside mapGoToStop is a bug by definition,
#     with exactly two documented exceptions (E2, E8).
# ---------------------------------------------------------------------------
sub('E1a def', """      function mapGoToView(index, options = {}) {
        if (!state.map || !state.map.route.length) return;
        const bounded = clamp(index, 0, state.map.route.length - 1);
        mapRouteIndex = bounded;""",
    """      /* ---------------- the deck cursor ----------------
         THE one place mapRouteIndex and the camera move together. The bar, the
         chip ring, the thread dot, the presenter screen and the picture on the
         wall are all derived from this pair, so anything that changes which slide
         the room is looking at comes through here and nothing else does.

         Two writers of mapRouteIndex stay outside on purpose - mapReorderRoute and
         mapStepHistory - and both are safe for the same reason: they keep the very
         same VIEW OBJECT under the cursor and re-read the number from it, so the
         camera is already correct and must not be disturbed. */
      function mapGoToStop(index, options = {}) {
        if (!state.map || !state.map.route.length) return;
        const bounded = clamp(index, 0, state.map.route.length - 1);
        mapRouteIndex = bounded;
        // Standing on a stop is the definition of being on the route.
        mapOffRoute = false;""")

sub('E1b callers', 'mapGoToView(', 'mapGoToStop(', 13)

# ---------------------------------------------------------------------------
# E0  the off-route flag, declared beside the cursor it qualifies.
# ---------------------------------------------------------------------------
sub('E0 flag', """      let mapRouteIndex = 0;
      let mapMode = false;""",
    """      let mapRouteIndex = 0;
      // True only while the camera has been pulled back off every stop on purpose
      // (the home button on a deck with no whole-map slide). The bar says so rather
      // than naming a slide that is not on the screen. mapGoToStop alone clears it.
      let mapOffRoute = false;
      let mapMode = false;""")

# ---------------------------------------------------------------------------
# E2  mapReorderRoute: the cursor follows the VIEW, not the number.
#     Chosen over "the moved slide becomes the current stop" because a reorder must
#     never change what the room is looking at: move the slide you are standing on
#     and the index follows it (same answer as the old rule); move any other slide
#     and the bar and the camera both stay where they were (the old rule lied).
# ---------------------------------------------------------------------------
sub('E2 reorder', """        const [moved] = route.splice(from, 1);
        route.splice(to, 0, moved);
        mapRouteIndex = to;
        mapMarkCurated();
        scheduleMapHistory();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        // The moved slide is now the current stop; the bar must say so.
        mapUpdateChrome();
        return true;""",
    """        // The stop the presenter is standing on is a VIEW, not a number. Read the
        // view first, splice, then re-read the number off it: moving the current
        // slide carries the cursor with it, and moving any other slide leaves both
        // the bar and the camera exactly where they were. This is why mapGoToStop
        // is not called here - the view under the cursor never changed, so there is
        // nothing to fly to, and a reorder must never move the room.
        const standing = route[mapRouteIndex] || null;
        const [moved] = route.splice(from, 1);
        route.splice(to, 0, moved);
        const landed = standing ? route.indexOf(standing) : -1;
        mapRouteIndex = landed >= 0 ? landed : clamp(mapRouteIndex, 0, route.length - 1);
        mapMarkCurated();
        scheduleMapHistory();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        return true;""")

# ---------------------------------------------------------------------------
# E3  the home button and Escape's pull-back: one home for one concept.
# ---------------------------------------------------------------------------
sub('E3a helpers', """      function mapHighlightView(view) {""",
    """      /* The home button has two different jobs and used to do the second one while
         the bar described the first. When the deck HAS a whole-map slide, pulling
         back IS that slide: go to it, and the bar, the chip ring and the screen all
         agree. When it has not, the gesture is a camera move with no slide behind
         it - so the readout stops naming a slide and the button stops calling
         itself one. */
      function mapWholeMapStop() {
        const route = (state.map && state.map.route) || [];
        const here = route[mapRouteIndex];
        if (here && here.target && here.target.kind === 'map') return mapRouteIndex;
        return route.findIndex(view => view && view.target && view.target.kind === 'map');
      }

      function mapGoWholeMap() {
        const at = mapWholeMapStop();
        if (at >= 0) { mapGoToStop(at); return; }
        mapOffRoute = true;
        mapFlyTo(mapCameraForRect(mapBounds(), 1.06));
        mapRenderRoute();
        mapUpdateChrome();
      }

      /* The label follows the job, so the button never promises a slide the deck
         does not have. Both labels are the same length class, so the bar stays at
         seven controls on one row. */
      function mapSyncHomeButton() {
        if (!el.mapHomeButton) return;
        const has = mapWholeMapStop() >= 0;
        const label = has ? '⌂ Whole map' : '⌂ Pull back';
        if (el.mapHomeButton.textContent !== label) el.mapHomeButton.textContent = label;
        el.mapHomeButton.title = has
          ? 'Go to the slide that frames the whole workspace'
          : 'Pull the camera back over the whole workspace - no slide frames it';
      }

      function mapHighlightView(view) {""")

sub('E3b button',
    """        if (el.mapHomeButton) el.mapHomeButton.addEventListener('click', () => mapFlyTo(mapCameraForRect(mapBounds(), 1.06)));""",
    """        if (el.mapHomeButton) el.mapHomeButton.addEventListener('click', () => mapGoWholeMap());""")

sub('E3c escape', """          if (Math.abs(mapCamera.scale - camera.scale) / camera.scale > 0.08) {
            mapFlyTo(camera);
            return true;
          }""",
    """          if (Math.abs(mapCamera.scale - camera.scale) / camera.scale > 0.08) {
            // Same gesture as the home button, so the same one home: it lands on the
            // whole-map slide when the deck has one. The 8% test still answers 'am I
            // already pulled back?' - a whole-map stop frames at 1.1 against this
            // 1.06, a 3.6% difference, so the second Escape still leaves.
            mapGoWholeMap();
            return true;
          }""")

# ---------------------------------------------------------------------------
# E4  mapUpdateChrome: the readout describes what is ON THE SCREEN.
# ---------------------------------------------------------------------------
sub('E4 chrome', """      function mapUpdateChrome() {
        if (el.mapPosition) {
          el.mapPosition.textContent = state.map && state.map.route.length
            ? `${mapRouteIndex + 1} / ${state.map.route.length}`
            : '0 / 0';
        }
        if (el.mapViewName) {
          const here = state.map && state.map.route.length ? state.map.route[mapRouteIndex] : null;
          const revealTotal = here ? mapRevealTotal(here) : 0;
          el.mapViewName.textContent = here
            ? mapViewLabel(here) + (revealTotal ? ` · reveal ${clamp(presentRevealStep, 0, revealTotal)} of ${revealTotal}` : '')
            : '';
        }
        if (el.mapNextName) {
          const next = state.map && state.map.route[mapRouteIndex + 1];
          el.mapNextName.textContent = next ? `Next: ${mapViewLabel(next)}` : 'Last view';
        }""",
    """      function mapUpdateChrome() {
        // One rule for the whole bar: it describes what is ON THE SCREEN. Off the
        // route no slide is on the screen, so it says that instead of naming the
        // slide the presenter happens to be standing on underneath.
        const routeLength = (state.map && state.map.route.length) || 0;
        if (el.mapPosition) {
          el.mapPosition.textContent = !routeLength ? '0 / 0'
            : mapOffRoute ? `– / ${routeLength}`
            : `${mapRouteIndex + 1} / ${routeLength}`;
        }
        if (el.mapViewName) {
          const here = routeLength ? state.map.route[mapRouteIndex] : null;
          const revealTotal = here ? mapRevealTotal(here) : 0;
          el.mapViewName.textContent = mapOffRoute ? 'Off the route'
            : here
            ? mapViewLabel(here) + (revealTotal ? ` · reveal ${clamp(presentRevealStep, 0, revealTotal)} of ${revealTotal}` : '')
            : '';
        }
        if (el.mapNextName) {
          // Off the route the next press rejoins the deck where it was left, so the
          // presenter screen says that rather than naming the stop after it.
          const resume = routeLength ? state.map.route[mapRouteIndex] : null;
          const next = state.map && state.map.route[mapRouteIndex + 1];
          el.mapNextName.textContent = mapOffRoute
            ? (resume ? `Back to: ${mapViewLabel(resume)}` : 'Last view')
            : next ? `Next: ${mapViewLabel(next)}` : 'Last view';
        }
        mapSyncHomeButton();""")

# ---------------------------------------------------------------------------
# E5  Off the route, the first press rejoins the deck instead of skipping a stop.
# ---------------------------------------------------------------------------
sub('E5 step', """        const backwards = delta < 0;
        let next = mapRouteIndex + delta;""",
    """        // Pulled back off every stop, the first press means 'put me back on the
        // deck', not 'skip the slide I was standing on'. One press rejoins, the
        // next one advances.
        if (mapOffRoute) { mapGoToStop(mapRouteIndex); return; }
        const backwards = delta < 0;
        let next = mapRouteIndex + delta;""")

# ---------------------------------------------------------------------------
# E6  The chips strip marks itself off-route, so no chip claims the screen.
# ---------------------------------------------------------------------------
sub('E6a render', """        el.mapRoute.classList.toggle('is-building', mapBuilding);""",
    """        el.mapRoute.classList.toggle('is-building', mapBuilding);
        // The chip stops claiming the screen and becomes what it actually is while
        // the camera is off the route: where the next press puts you back.
        el.mapRoute.toggleAttribute('data-offroute', mapOffRoute);""")

sub('E6b css', """    .map-route-item.is-current { border-color: var(--primary); background: var(--pill-bg); color: var(--pill-text); font-weight: 700; }""",
    """    .map-route-item.is-current { border-color: var(--primary); background: var(--pill-bg); color: var(--pill-text); font-weight: 700; }
    /* Off the route the camera is on no slide at all, so the current chip drops the
       filled 'this is on screen' pill and shows the dashed 'resume here' outline. */
    .map-route[data-offroute] .map-route-item.is-current {
      background: transparent; color: inherit; font-weight: 600; border-style: dashed;
    }""")

# ---------------------------------------------------------------------------
# E7  Going inside a diagram is a move along the deck, not a step outside it.
# ---------------------------------------------------------------------------
sub('E7a helper', """      async function mapEnterDiagram(diagramId, startNodeId) {""",
    """      /* Which stop a tile's Present button is standing on. A node the presenter
         clicked wins over the diagram as a whole, because that is the slide that
         frames it; otherwise the diagram's own stop, otherwise any stop that walks
         it. -1 means the deck genuinely does not walk this diagram (an uncurated
         route can open a diagram the route never visits), and the cursor is then
         left exactly where it was. */
      function mapStopForDiagram(diagramId, startNodeId) {
        const route = (state.map && state.map.route) || [];
        if (!diagramId) return -1;
        if (startNodeId) {
          const framed = route.findIndex(view => {
            const target = (view && view.target) || {};
            return target.kind === 'nodes' && target.diagramId === diagramId
              && (target.nodeIds || []).includes(startNodeId);
          });
          if (framed >= 0) return framed;
        }
        const whole = route.findIndex(view => {
          const target = (view && view.target) || {};
          return target.kind === 'diagram' && target.diagramId === diagramId;
        });
        if (whole >= 0) return whole;
        return route.findIndex(view => {
          const target = (view && view.target) || {};
          return (target.kind === 'diagram' || target.kind === 'nodes') && target.diagramId === diagramId;
        });
      }

      async function mapEnterDiagram(diagramId, startNodeId) {""")

sub('E7b enter', """        const deckIndex = Math.max(0, presentDeckIds.indexOf(diagramId));
        mapSetMode(false);""",
    """        const deckIndex = Math.max(0, presentDeckIds.indexOf(diagramId));
        // Standing on that diagram's stop BEFORE leaving the Map is the whole of the
        // fix: the bar, the chips and the presenter screen stop describing slide 1
        // while the room is inside slide 4, and mapReturnFromDiagram - the one door
        // home for both the Map button and Escape - re-frames the slide that was
        // just shown instead of throwing the presenter back to the start of the deck.
        // Instant: the plane is about to be hidden, so the camera is set, not flown.
        const stop = mapStopForDiagram(diagramId, startNodeId);
        if (stop >= 0) mapGoToStop(stop, { instant: true });
        mapSetMode(false);""")

# ---------------------------------------------------------------------------
# E8  Undo/redo: follow the view id, not the number. Same rule as E2 - the camera
#     deliberately does not move, so the number is the half that has to bend.
# ---------------------------------------------------------------------------
sub('E8 history', """        if (!mapApplySnapshot(target)) return;
        mapRouteIndex = clamp(mapRouteIndex, 0, Math.max(0, state.map.route.length - 1));""",
    """        const standing = state.map.route[mapRouteIndex] || null;
        if (!mapApplySnapshot(target)) return;
        // The snapshot comes back as fresh objects carrying their old ids, so the
        // cursor follows the ID of the slide that is still on the screen. Undoing a
        // reorder used to leave the bar naming whichever slide had landed on that
        // number - the same two-sources bug the reorder itself had.
        const again = standing && standing.id
          ? state.map.route.findIndex(view => view && view.id === standing.id)
          : -1;
        mapRouteIndex = again >= 0 ? again : clamp(mapRouteIndex, 0, Math.max(0, state.map.route.length - 1));""")

# ---------------------------------------------------------------------------
# E9  A mouse click on a chip rebuilt the strip under the finger and dropped focus
#     on <body> - outside an overlay that is meant to be modal. Keyboard activation
#     goes back to its row (roving focus); a mouse click goes to the plane, where
#     the arrows keep meaning "next slide".
# ---------------------------------------------------------------------------
sub('E9 focus', """          go.addEventListener('click', event => {
            mapGoToStop(index);
            // Enter on the button rebuilds the list under the finger; put focus back on
            // the row it belongs to. A mouse click carries detail > 0.
            if (!event.detail) requestAnimationFrame(() => mapFocusRouteIndex(index));
          });""",
    """          go.addEventListener('click', event => {
            mapGoToStop(index);
            // Going to a slide rebuilds the strip, which detaches the node under the
            // finger. Enter on the button (detail 0) belongs back on its row, where
            // the arrows rove. A mouse click has no row to sit on and must not land
            // on <body> outside the modal overlay, so it lands on the plane - where
            // the arrows still mean 'next slide'.
            if (!event.detail) requestAnimationFrame(() => mapFocusRouteIndex(index));
            else requestAnimationFrame(() => {
              if (document.activeElement === document.body && el.mapLayer) el.mapLayer.focus();
            });
          });""")

# ---------------------------------------------------------------------------
# E10  Opening Present is a fresh deck: the flag must not survive from the last
#      one, or mapOpen's own mapRenderRoute/mapUpdateChrome would paint one frame
#      of "Off the route" and a dashed chip before mapGoToStop(0) clears it.
# ---------------------------------------------------------------------------
sub('E10 open', """        mapRouteIndex = 0;
        // The rendering is the author's saved choice; the filter is not - nobody wants""",
    """        mapRouteIndex = 0;
        mapOffRoute = false;
        // The rendering is the author's saved choice; the filter is not - nobody wants""")

# ---------------------------------------------------------------------------
# Post-conditions: the invariant must be greppable.
# ---------------------------------------------------------------------------
if 'mapGoToView' in src:
    print('ABORT - mapGoToView survived the rename')
    sys.exit(1)
if src.count('function mapGoToStop(') != 1:
    print('ABORT - mapGoToStop is not defined exactly once')
    sys.exit(1)

tmp = TARGET + '.tmp'
with io.open(tmp, 'w', encoding='utf-8', newline='') as fh:
    fh.write(src)
os.replace(tmp, TARGET)

print('patched %s' % TARGET)
print('  %d chars -> %d chars (%+d)' % (ORIGINAL_LEN, len(src), len(src) - ORIGINAL_LEN))
for name, count, delta in edits:
    print('  %-14s x%-3d %+d' % (name, count, delta))
