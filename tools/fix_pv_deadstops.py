#!/usr/bin/env python3
"""FIX 3 - a diagram removed in the editor must not leave a dead stop on the Map.

A route stop is the one thing in the deck that can outlive its subject: delete the
diagram it walks and the stop becomes a slide with nothing to draw. Until now the
only thing that pruned it was mapApplySnapshot() - the deck's undo machinery -
which is an accident, not a design.

This patch:
  1. adds three Map-owned functions next to sanitizeMapState:
       mapLiveDiagramIds()  - the workspace's ids, or null when we cannot tell
       mapRouteViewIsLive() - the one definition of "dead stop" (map and card
                              stops own their subject and are never dead)
       mapPruneDeadStops()  - drops the dead stops (and the tiles they left on
                              the plane), re-anchors mapRouteIndex, and speaks
                              one line when the caller asks it to;
  2. teaches sanitizeMapState() to drop dead stops and dead tiles quietly, which
     covers a project read back from storage, an import and a merge - every path
     that reaches ensureWorkspaceState();
  3. adds ONE line to each of the three editor-side paths that remove a diagram,
     right beside the line where each already tells state.presentationDeck.

Usage:  python fix_pv_deadstops.py <target.html>
Anchor-guarded, atomic, aborts without writing on any drift.
"""
import os
import sys
import tempfile


def die(msg):
    print('ABORT (nothing written): ' + msg)
    sys.exit(1)


if len(sys.argv) < 2:
    die('usage: python fix_pv_deadstops.py <target.html>')
target = sys.argv[1]
if not os.path.isfile(target):
    die('no such file: ' + target)

with open(target, 'r', encoding='utf-8') as fh:
    html = fh.read()
original_len = len(html)

# --------------------------------------------------------------------------
# 1 + 2. The Map side: the helpers, and the quiet prune inside sanitizeMapState.
# --------------------------------------------------------------------------
A_OLD = """      function sanitizeMapState(raw) {
        const map = raw && typeof raw === 'object' ? raw : {};
        const tiles = {};
        Object.keys(map.tiles && typeof map.tiles === 'object' ? map.tiles : {}).slice(0, 400).forEach(id => {
          const tile = map.tiles[id];
          if (!tile || typeof tile !== 'object') return;
"""

A_NEW = """      /* ---------------- dead stops ----------------
         A route stop is the one thing in the deck that can outlive its subject:
         delete the diagram it walks and the stop is a slide with nothing to draw.
         Every path that can drop a diagram - the editor's Remove, an import, a
         merge, a project read back from storage - ends here, so nothing outside
         the Map has to learn what a route looks like. */

      // Null, not an empty set: with no workspace to check against we must never
      // prune blind - an unknown id is not the same as a dead one.
      function mapLiveDiagramIds() {
        return Array.isArray(state.diagrams) && state.diagrams.length
          ? new Set(state.diagrams.map(diagram => diagram.id))
          : null;
      }

      // The one definition of a dead stop. A map stop frames the whole plane and a
      // card stop frames a card: both own their subject, so neither can ever die
      // with a diagram.
      function mapRouteViewIsLive(view, live) {
        const target = (view && view.target) || {};
        if (target.kind !== 'diagram' && target.kind !== 'nodes') return true;
        return Boolean(target.diagramId) && live.has(target.diagramId);
      }

      /* The live prune, for the moment a diagram is actually removed. Quiet by
         default; pass `announce` - the line the caller was about to say - and the
         one toast that reaches the author carries both halves, because showToast
         holds one message at a time. */
      function mapPruneDeadStops(options = {}) {
        const map = state.map;
        if (!map) return 0;
        const live = mapLiveDiagramIds();
        if (!live) return 0;
        // The tile is the stop's subject on the plane. Left behind, it keeps
        // stretching mapBounds() over a rectangle nothing draws, so ⌂ and every
        // whole-map stop frame an empty gap where the diagram used to be.
        Object.keys(map.tiles || {}).forEach(id => { if (!live.has(id)) delete map.tiles[id]; });
        const route = Array.isArray(map.route) ? map.route : [];
        const before = route.length;
        if (!before) return 0;
        const here = clamp(mapRouteIndex, 0, before - 1);
        // Counting the survivors in front of the current stop keeps the presenter
        // where they were standing, and cannot point past the end the way a raw
        // index carried across a shorter route would.
        const ahead = route.slice(0, here).filter(view => mapRouteViewIsLive(view, live)).length;
        map.route = route.filter(view => mapRouteViewIsLive(view, live));
        const dropped = before - map.route.length;
        if (!dropped) return 0;
        mapRouteIndex = map.route.length ? clamp(ahead, 0, map.route.length - 1) : 0;
        scheduleSave();
        // Removal happens in the editor, so this is defence rather than a live path:
        // if anything ever prunes while the room is watching, the deck restates
        // itself instead of describing a slide that is no longer there.
        if (mapMode) {
          mapRenderRoute();
          mapRenderThread();
          mapUpdateChrome();
          if (map.route.length) mapGoToView(mapRouteIndex, { instant: false });
        }
        if (options.announce) {
          const lead = String(options.announce);
          setTimeout(() => showToast(`${lead} ${dropped} slide${dropped === 1 ? '' : 's'} left the presentation.`, 'success'), 0);
        }
        return dropped;
      }

      function sanitizeMapState(raw) {
        const map = raw && typeof raw === 'object' ? raw : {};
        // Load, import, merge and recovery all arrive here. A stop or a tile whose
        // diagram is not in the workspace goes quietly: nobody just did anything,
        // so nobody is told.
        const live = mapLiveDiagramIds();
        const tiles = {};
        Object.keys(map.tiles && typeof map.tiles === 'object' ? map.tiles : {}).slice(0, 400).forEach(id => {
          const tile = map.tiles[id];
          if (!tile || typeof tile !== 'object') return;
          if (live && !live.has(String(id))) return;
"""

B_OLD = """          route: (Array.isArray(map.route) ? map.route.slice(0, 600) : []).map(sanitizeRouteView),
"""

B_NEW = """          route: (Array.isArray(map.route) ? map.route.slice(0, 600) : []).map(sanitizeRouteView)
            .filter(view => !live || mapRouteViewIsLive(view, live)),
"""

# --------------------------------------------------------------------------
# 3. The editor side: ONE line per removal path, beside its presentationDeck line.
# --------------------------------------------------------------------------
C_OLD = """        state.presentationDeck = (state.presentationDeck || []).filter(id => id !== removed.id);
        const next = state.diagrams[Math.min(index, state.diagrams.length - 1)];
"""
C_NEW = """        state.presentationDeck = (state.presentationDeck || []).filter(id => id !== removed.id);
        mapPruneDeadStops({ announce: `${removed.name} removed.` });
        const next = state.diagrams[Math.min(index, state.diagrams.length - 1)];
"""

D_OLD = """        state.presentationDeck = (state.presentationDeck || []).filter(entry => entry !== removed.id);
        const activeRemoved = removed.id === state.activeDiagramId;
"""
D_NEW = """        state.presentationDeck = (state.presentationDeck || []).filter(entry => entry !== removed.id);
        mapPruneDeadStops({ announce: `${removed.name} removed.` });
        const activeRemoved = removed.id === state.activeDiagramId;
"""

E_OLD = """            state.presentationDeck = (state.presentationDeck || []).filter(id => keep.some(diagram => diagram.id === id));
            workspaceSelection.clear();
"""
E_NEW = """            state.presentationDeck = (state.presentationDeck || []).filter(id => keep.some(diagram => diagram.id === id));
            mapPruneDeadStops({ announce: `${chosen.length} diagram${chosen.length === 1 ? '' : 's'} removed.` });
            workspaceSelection.clear();
"""

EDITS = [
    ('A  Map helpers + sanitizeMapState header', A_OLD, A_NEW),
    ('B  sanitizeMapState route filter', B_OLD, B_NEW),
    ('C  editor: removeActiveDiagram', C_OLD, C_NEW),
    ('D  editor: deleteWorkspaceDiagramById', D_OLD, D_NEW),
    ('E  editor: deleteSelectedWorkspaceDiagrams', E_OLD, E_NEW),
]

# Already patched? Refuse rather than double-apply.
if 'mapPruneDeadStops' in html:
    die('mapPruneDeadStops already present - target looks patched')

for name, old, new in EDITS:
    hits = html.count(old)
    if hits != 1:
        die('anchor %s matched %d times, expected exactly 1' % (name, hits))

for name, old, new in EDITS:
    html = html.replace(old, new, 1)
    print('patched %s' % name)

# Post-conditions: the traps, checked in the text we are about to write.
checks = [
    ("if (target.kind !== 'diagram' && target.kind !== 'nodes') return true;", 1,
     'card and whole-map stops are never pruned'),
    ('mapRouteIndex = map.route.length ? clamp(ahead, 0, map.route.length - 1) : 0;', 1,
     'route index re-anchored, never past the end'),
    ('mapPruneDeadStops({ announce:', 3,
     'three editor removal paths call the Map'),
    ('.filter(view => !live || mapRouteViewIsLive(view, live)),', 1,
     'load-time prune inside sanitizeMapState'),
]
for needle, want, why in checks:
    got = html.count(needle)
    if got != want:
        die('post-check failed (%s): %d occurrences, expected %d' % (why, got, want))

grew = len(html) - original_len
if grew <= 0 or grew > 8000:
    die('unexpected size delta: %d bytes' % grew)

folder = os.path.dirname(os.path.abspath(target)) or '.'
fd, tmp = tempfile.mkstemp(dir=folder, suffix='.tmp')
try:
    with os.fdopen(fd, 'w', encoding='utf-8', newline='') as out:
        out.write(html)
    os.replace(tmp, target)
except BaseException:
    if os.path.exists(tmp):
        os.remove(tmp)
    raise
print('OK  %s  (+%d bytes)' % (target, grew))
