#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_present_buildenter.py — SIREN Present / Map, Build mode.

Two frictions, one file, one pass.

(1) "In momentul in care apesi pe build nu poti sa apesi pe o diagrama si sa intri
    in ea."  Pressing Build hid every tile's ▶ Present pill (a CSS rule keyed off
    data-building on #mapLayer) and handed the whole tile to block-picking. The
    author assembling a deck could no longer look inside the diagram the deck is
    about. Both gestures are legitimate in Build, so both get a home on the tile:
      - the tile BODY keeps block-picking (unchanged),
      - the PILL keeps its corner and becomes the door, reading "Open" in Build
        instead of "▶ Present" because in Build the author is looking, not
        presenting.
    Coming back lands in Build again, on the same stop, with the deck intact:
    mapEnterDiagram remembers that it left from Build and mapReturnFromDiagram
    restores it. The deck itself is state.map.route and was never at risk.

(2) The Build hint teaches both gestures, in the order a first-timer needs them.

Nothing outside the Map is touched: no shared primitive, no Present bar control,
no export path, no persisted shape (the resume flag is session-only, like
mapBuilding itself).

Usage:  python fix_present_buildenter.py <path-to-html>
Anchor-guarded: every edit matches a unique string. On any drift the script
aborts WITHOUT writing. The write is atomic (temp file + os.replace).
"""

import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new, count=1):
    EDITS.append((name, old, new, count))


# ---------------------------------------------------------------- 1. CSS ----
# The rule that shut the door. Build now needs the pill more than presenting
# does, so it stays put — same look, same corner, different word.
edit(
    "css: stop hiding the tile pill in Build",
    """    /* While building, a tile's job is picking blocks to frame - not presenting. */
    .map-layer[data-building="on"] .map-tile-open { display: none; }
    .map-layer[data-building="on"] .map-view-name { max-width: 150px; }""",
    """    /* Build carries two legitimate tile gestures at once, so each gets its own
       target: the tile BODY picks a block to frame, the pill in the corner goes
       inside the diagram. Hiding the pill here used to close the only door the
       mouse had, exactly when the author needed to look at what they were
       putting in the deck. Same pill, same corner, same colours - only the word
       changes (mapTileOpenLabel). */
    .map-layer[data-building="on"] .map-view-name { max-width: 150px; }""",
)

# ------------------------------------------------------ 2. session state ----
edit(
    "state: mapBuildResume flag",
    """      // Session-only: the chips strip's edit state. Never persisted - a reopened
      // presentation always starts presenting, not building.
      let mapBuilding = false;""",
    """      // Session-only: the chips strip's edit state. Never persisted - a reopened
      // presentation always starts presenting, not building.
      let mapBuilding = false;
      // Session-only too: going inside a diagram leaves the Map, and leaving the
      // Map closes Build. This remembers that the author was building so the way
      // back lands them in Build rather than in front of a client.
      let mapBuildResume = false;""",
)

# ------------------------------------------------- 3. the pill's two words ----
edit(
    "tile: label helper + record the pill",
    """        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'map-tile-open';
        open.textContent = '▶ Present';
        open.setAttribute('aria-label', `Present ${diagram.name || diagram.diagramTitle || 'diagram'}`);""",
    """        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'map-tile-open';
        // Tiles mount and unmount with the camera, so a tile born mid-Build has to
        // be born with the Build word on it.
        mapTileOpenLabel(open, diagram);""",
)

edit(
    "tile: store the pill on the tile record",
    """        el.mapPlane.appendChild(host);
        tile = { host, body, label, level: '' };
        mapTileEls.set(diagram.id, tile);""",
    """        el.mapPlane.appendChild(host);
        tile = { host, body, label, open, level: '' };
        mapTileEls.set(diagram.id, tile);""",
)

# The helper itself, parked immediately above mapEnsureTile.
edit(
    "tile: mapTileOpenLabel / mapUpdateTileOpenLabels",
    """      function mapEnsureTile(diagram) {
        let tile = mapTileEls.get(diagram.id);
        if (tile) return tile;""",
    """      /* One pill, two jobs, two words. Presenting, it starts the walkthrough and
         says so. Building, it goes inside the diagram to look - the author is
         authoring, not showing a client - and coming back returns to Build. The
         look never changes, so the affordance is learned once. */
      function mapTileOpenLabel(button, diagram) {
        if (!button) return;
        const name = (diagram && (diagram.name || diagram.diagramTitle)) || 'diagram';
        button.textContent = mapBuilding ? 'Open' : '▶ Present';
        button.setAttribute('aria-label', mapBuilding ? `Open ${name} to look inside` : `Present ${name}`);
        button.title = mapBuilding ? 'Look inside this diagram — coming back returns you to Build' : '';
      }

      function mapUpdateTileOpenLabels() {
        mapTileEls.forEach((tile, id) => {
          const diagram = (state.diagrams || []).find(entry => entry.id === id);
          if (diagram) mapTileOpenLabel(tile.open, diagram);
        });
      }

      function mapEnsureTile(diagram) {
        let tile = mapTileEls.get(diagram.id);
        if (tile) return tile;""",
)

# ------------------------------------------------------- 4. click routing ----
# The pill never had a listener of its own: presenting, its click simply bubbled
# to the tile and fell through to mapEnterDiagram. In Build that fall-through is
# swallowed by the block-picking branch, so the pill is answered first, in both
# modes, from the one handler that already exists.
edit(
    "tile: the pill is the door in both modes",
    """          const node = event.target.closest && event.target.closest('.node');
          const id = node ? mapNodeIdFromElement(node) : '';
          if (mapRecording || mapBuilding) {""",
    """          const node = event.target.closest && event.target.closest('.node');
          const id = node ? mapNodeIdFromElement(node) : '';
          // Answered before the picking branch, which would otherwise swallow it:
          // the pill goes inside the diagram whatever mode the Map is in.
          if (event.target.closest && event.target.closest('.map-tile-open')) {
            mapEnterDiagram(diagram.id);
            return;
          }
          if (mapRecording || mapBuilding) {""",
)

# ------------------------------------------------- 5. remember / restore ----
edit(
    "mapEnterDiagram: remember Build",
    """      async function mapEnterDiagram(diagramId, startNodeId) {
        mapHideNodeChip();""",
    """      async function mapEnterDiagram(diagramId, startNodeId) {
        mapHideNodeChip();
        // Read before mapSetMode(false), which closes Build on the way out. Going
        // inside a diagram while building is a look, not an exit.
        mapBuildResume = mapBuilding;""",
)

edit(
    "mapReturnFromDiagram: land back in Build",
    """      function mapReturnFromDiagram() {
        mapSetMode(true);
        const view = state.map && state.map.route[mapRouteIndex];""",
    """      function mapReturnFromDiagram() {
        mapSetMode(true);
        // The deck lives in state.map.route and mapRouteIndex never moved, so putting
        // the mode back is the whole of "come back to where I was". Both doors home -
        // ⌂ Map and Escape - run through here, so both behave the same.
        if (mapBuildResume) { mapBuildResume = false; mapSetBuild(true); }
        const view = state.map && state.map.route[mapRouteIndex];""",
)

edit(
    "mapOpen: a fresh Map owes nothing to a previous Build",
    """        mapRouteIndex = 0;
        mapToggleRecording(false);
        mapSetBuild(false);""",
    """        mapRouteIndex = 0;
        mapToggleRecording(false);
        mapBuildResume = false;
        mapSetBuild(false);""",
)

# --------------------------------------------------- 6. hint + relabelling ----
# The Build hint has to name BOTH tile gestures now, so it becomes a constant:
# mapCaptureView needs to put it back, and one string in two places is one string
# too many.
edit(
    "hint: MAP_BUILD_HINT constant",
    """      const MAP_RESTING_HINT = '→ next stop · Enter opens the diagram · ? keyboard shortcuts';""",
    """      const MAP_RESTING_HINT = '→ next stop · Enter opens the diagram · ? keyboard shortcuts';
      /* Both tile gestures named, in the order a first-timer needs them. Dragging the
         chips is left to the grip the chips visibly grow in Build; what nothing on
         screen said was that a tile can still be opened while the deck is being made. */
      const MAP_BUILD_HINT = '＋ Add a slide · Open on a tile goes inside a diagram · click a block to frame it · Done';""",
)

edit(
    "mapSetBuild: teach both tile gestures, swap the pill's word",
    """        // Three things, in the order a first-timer needs them. The Build bar's own
        // buttons carry the rest in their tooltips.
        mapSetHint(mapBuilding
          ? '＋ Add a slide · drag the chips to reorder · Done when the deck is right'
          : MAP_RESTING_HINT);
        mapRenderRoute();""",
    """        // The tile pill says Present or Open depending on this mode, and tiles
        // already on the plane have to hear about the change.
        mapUpdateTileOpenLabels();
        mapSetHint(mapBuilding ? MAP_BUILD_HINT : MAP_RESTING_HINT);
        mapRenderRoute();""",
)

# The picked-block hint used to stand there for the rest of the session, on top of
# the only line that teaches the rest of Build - including, now, the pill.
edit(
    "mapCaptureView: give the mode hint back once the view is kept",
    """        showToast(`View ${mapRouteIndex + 1} kept.`, 'success');
      }

      function mapDeleteView() {""",
    """        showToast(`View ${mapRouteIndex + 1} kept.`, 'success');
        // 'Block picked. Press Space to keep this view.' has done its job the moment
        // the view is kept. It used to stay for the rest of the session, sitting over
        // the line that teaches everything else Build can do.
        if (mapBuilding) mapSetHint(MAP_BUILD_HINT);
      }

      function mapDeleteView() {""",
)


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("usage: fix_present_buildenter.py <path-to-html>\n")
        return 2
    target = sys.argv[1]
    with io.open(target, "r", encoding="utf-8", newline="") as fh:
        text = fh.read()

    original = text
    for name, old, new, count in EDITS:
        found = text.count(old)
        if found != count:
            sys.stderr.write(
                "DRIFT: anchor '%s' found %d times, expected %d. Nothing written.\n"
                % (name, found, count)
            )
            return 1
        if new in text:
            sys.stderr.write(
                "DRIFT: replacement for '%s' already present. Nothing written.\n" % name
            )
            return 1
        text = text.replace(old, new, count)
        sys.stdout.write("ok   %s\n" % name)

    if text == original:
        sys.stderr.write("DRIFT: no change produced. Nothing written.\n")
        return 1

    # Cheap structural guard: the file is one IIFE, so brace/paren balance must
    # not move. (Both edits add balanced code.)
    for ch in "{}()[]":
        pass
    delta = {c: text.count(c) - original.count(c) for c in "{}()"}
    if delta["{"] != delta["}"] or delta["("] != delta[")"]:
        sys.stderr.write("DRIFT: brace/paren balance moved %r. Nothing written.\n" % delta)
        return 1

    folder = os.path.dirname(os.path.abspath(target)) or "."
    fd, tmp = tempfile.mkstemp(dir=folder, suffix=".tmp")
    try:
        with io.open(fd, "w", encoding="utf-8", newline="") as fh:
            fh.write(text)
        os.replace(tmp, target)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    sys.stdout.write("wrote %s (%d bytes)\n" % (target, len(text.encode("utf-8"))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
