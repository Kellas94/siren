#!/usr/bin/env python3
"""SIREN Present mode — content, sizing and copy fixes for the client-facing surface.

Covers the four content/sizing CRITICALs plus the copy defects from critique_present.md:

  1. Tile, top bar and opening card all read the stale 'Flowchart Preview' placeholder
     instead of the diagram name the auditor typed.
  2. The opening card counts a stale presentation deck ('Diagram 2 of 2') instead of
     what the Map is showing.
  3. Map tile titles are declared in plane coordinates and render at ~5px.
  4. The checkpoint card sizes the redundant block label at 21px and the presenter's
     actual question at 14px muted, over a 23%-alpha background.
  5. '#presentStep' reads 'Overview · Overview'; the opening card carries an authoring
     statistic ('12 blocks · 13 connectors').
  6. Wide (LR) diagrams collapse to a 73px sliver on the Map.

Deliberately does NOT touch the Present top bar layout or Present-mode focus/modality:
other work owns those.

Usage:  python fix_present_copy.py <path-to-T_Industries_SIREN_v1.html>
Every replacement asserts its occurrence count before it runs, so a moved anchor fails
loudly instead of silently patching the wrong place. Writes atomically (tmp + os.replace).
"""

import os
import sys
import tempfile

# (label, expected occurrences, old, new)
PATCHES = []


def patch(label, old, new, count=1):
    PATCHES.append((label, count, old, new))


# ---------------------------------------------------------------------------
# 1. The client-facing title: prefer the name the auditor typed
#    `diagramTitle` is the caption baked into the rendered SVG and still defaults to
#    'Flowchart Preview'; `name` is what every other surface in the app already shows.
# ---------------------------------------------------------------------------

patch(
    "map tile label uses diagram.name",
    """        label.className = 'map-tile-label';
        label.textContent = diagram.diagramTitle || diagram.name;""",
    """        label.className = 'map-tile-label';
        // The audience reads the name the auditor typed. diagramTitle is the caption
        // baked into the rendered SVG and still defaults to 'Flowchart Preview'.
        label.textContent = diagram.name || diagram.diagramTitle;""",
)

patch(
    "map route chip label uses diagram.name",
    """        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        const name = diagram ? (diagram.diagramTitle || diagram.name) : 'Diagram';""",
    """        const diagram = state.diagrams.find(entry => entry.id === target.diagramId);
        // Same precedence as the tile above it: the route strip runs along the bottom of a
        // client-facing screen and was reading 'Flowchart Preview' on every stop.
        const name = diagram ? (diagram.name || diagram.diagramTitle) : 'Diagram';""",
)

patch(
    "opening card title uses diagram.name",
    "          el.presentSectionTitle.textContent = diagram?.diagramTitle || diagram?.name || 'Flowchart';",
    "          el.presentSectionTitle.textContent = diagram?.name || diagram?.diagramTitle || 'Flowchart';",
)

patch(
    "present bar title uses diagram.name",
    "        el.presentTitle.textContent = diagram?.diagramTitle || diagram?.name || 'Presentation';",
    "        el.presentTitle.textContent = diagram?.name || diagram?.diagramTitle || 'Presentation';",
)

patch(
    "present bar title on diagram load uses diagram.name",
    "        el.presentTitle.textContent = diagram.diagramTitle || diagram.name;",
    "        el.presentTitle.textContent = diagram.name || diagram.diagramTitle;",
)

# ---------------------------------------------------------------------------
# 2. 'Diagram N of M' has to agree with the Map that is on screen
# ---------------------------------------------------------------------------

patch(
    "deck from the Map, not from a stale saved deck",
    """      async function mapEnterDiagram(diagramId, startNodeId) {
        mapHideNodeChip();
        if (!presentDeckIds.includes(diagramId)) presentDeckIds = state.diagrams.map(diagram => diagram.id);
        const deckIndex = Math.max(0, presentDeckIds.indexOf(diagramId));""",
    """      /* The plane shows every diagram in the workspace, so a walkthrough entered from
         the plane counts every diagram - ordered by the route where the route has an
         opinion, and the rest behind it. */
      function mapPresentationDeckIds() {
        const ordered = [];
        const add = id => {
          if (id && !ordered.includes(id) && state.diagrams.some(diagram => diagram.id === id)) ordered.push(id);
        };
        ((state.map && state.map.route) || []).forEach(view => add(view && view.target && view.target.diagramId));
        state.diagrams.forEach(diagram => add(diagram.id));
        return ordered;
      }

      async function mapEnterDiagram(diagramId, startNodeId) {
        mapHideNodeChip();
        // Rebuilt unconditionally: the old guard only fired when the clicked diagram was
        // missing, so a stale two-entry deck survived and the opening card announced
        // 'Diagram 2 of 2' over four tiles. Entering from the Map cannot disagree with it.
        presentDeckIds = mapPresentationDeckIds();
        if (!presentDeckIds.includes(diagramId)) presentDeckIds = [diagramId];
        const deckIndex = Math.max(0, presentDeckIds.indexOf(diagramId));""",
)

# ---------------------------------------------------------------------------
# 3. Map tile titles sized in screen space, not plane space
# ---------------------------------------------------------------------------

patch(
    "map tile label counter-scales with the camera",
    """    .map-tile-label {
      padding: 20px 34px;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: .04em;
      color: var(--muted);""",
    """    .map-tile-label {
      padding: 20px 34px;
      /* Sized in screen space, not plane space. #mapPlane is scaled by the camera, so a
         flat 34px rendered at ~5px whenever the whole map was framed and no client could
         read a single diagram name. --map-scale is written by applyMapCamera(); the outer
         clamp keeps the label strip from eating the tile when the camera pulls right out. */
      font-size: clamp(34px, calc(16px / var(--map-scale, 1)), 150px);
      line-height: 1.15;
      font-weight: 700;
      letter-spacing: .04em;
      color: var(--text);""",
)

patch(
    "applyMapCamera publishes --map-scale",
    """      function applyMapCamera() {
        if (!el.mapPlane) return;
        const view = mapViewport();
        el.mapPlane.style.transform =
          `translate(${view.w / 2}px, ${view.h / 2}px) scale(${mapCamera.scale}) translate(${-mapCamera.x}px, ${-mapCamera.y}px)`;
        mapUpdateTileDetail();
      }""",
    """      function applyMapCamera() {
        if (!el.mapPlane) return;
        const view = mapViewport();
        el.mapPlane.style.transform =
          `translate(${view.w / 2}px, ${view.h / 2}px) scale(${mapCamera.scale}) translate(${-mapCamera.x}px, ${-mapCamera.y}px)`;
        // Tile labels counter-scale off this so they stay legible at any camera height.
        // Only written when it actually moves - this runs on every tween tick.
        const labelScale = Math.round(mapCamera.scale * 1000) / 1000;
        if (labelScale !== mapLabelScale) {
          mapLabelScale = labelScale;
          el.mapPlane.style.setProperty('--map-scale', String(labelScale));
        }
        mapUpdateTileDetail();
      }""",
)

patch(
    "mapLabelScale declaration",
    """      let mapCamera = { x: 0, y: 0, scale: 0.2 };
      let mapCameraTimer = null;""",
    """      let mapCamera = { x: 0, y: 0, scale: 0.2 };
      let mapLabelScale = 0;
      let mapCameraTimer = null;""",
)

# ---------------------------------------------------------------------------
# 4. Checkpoint card: the presenter's question is the content, the block label is not
# ---------------------------------------------------------------------------

patch(
    "checkpoint card type scale",
    """    .present-checkpoint-card h2 { margin:4px 0 8px; color:var(--text); }
    .present-checkpoint-card p { margin:0 0 14px; color:var(--muted); line-height:1.55; }""",
    """    /* The block label is already on the diagram behind this card. The presenter's
       question is the only line here the audience has not read yet, so it gets the size. */
    .present-checkpoint-card h2 { margin:2px 0 10px; color:var(--muted); font-size:15px; font-weight:700; letter-spacing:.01em; }
    .present-checkpoint-card p { margin:0 0 14px; color:var(--muted); line-height:1.55; }
    .present-checkpoint-card #presentCheckpointPrompt { margin:0 0 16px; color:var(--text); font-size:clamp(20px,2.2vw,28px); font-weight:600; line-height:1.35; }""",
)

patch(
    "checkpoint card background is opaque",
    "    .present-checkpoint-card { border-color:var(--warning)!important; background:color-mix(in srgb,var(--warning-bg) 88%,var(--panel-bg))!important; }",
    """    /* --warning-bg is a ~13% wash, so mixing 88% of it left the card at 23% alpha and its
       contrast depended on whichever diagram happened to be behind it. Tint an opaque panel
       instead, so the ratio is one fixed, testable number. */
    .present-checkpoint-card { border-color:var(--warning)!important; background:color-mix(in srgb,var(--warning) 10%,var(--panel-elevated))!important; }""",
)

# ---------------------------------------------------------------------------
# 5. Copy on the two most-read strings of the walkthrough
# ---------------------------------------------------------------------------

patch(
    "presentStep no longer says 'Overview - Overview'",
    """        el.presentStep.textContent = presentIndex < 0
          ? `Overview · ${label}`
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`;""",
    """        // The overview entry's own label is already 'Overview'; prefixing it printed
        // 'Overview · Overview' on the first line the audience reads.
        el.presentStep.textContent = presentIndex < 0
          ? label
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`;""",
)

patch(
    "opening card drops the authoring statistic",
    """          el.presentSectionSubtitle.textContent = `${presentModel?.nodes?.length || extractNodeIdsFromSource(diagram?.source || '').length} blocks · ${presentModel?.edges?.length || 0} connectors`;""",
    """          // 'N blocks · M connectors' is an authoring statistic. It belongs in the Studio,
          // not on the full-screen card that introduces the workflow to a client.
          el.presentSectionSubtitle.textContent = '';
          el.presentSectionSubtitle.hidden = true;""",
)

patch(
    "chapter card restores its subtitle",
    """          el.presentSectionSubtitle.textContent = chapter ? `${chapter.members.length} blocks in this chapter` : 'Presentation section';""",
    """          el.presentSectionSubtitle.hidden = false;
          el.presentSectionSubtitle.textContent = chapter ? `${chapter.members.length} blocks in this chapter` : 'Presentation section';""",
)

# ---------------------------------------------------------------------------
# 6. Wide (LR) diagrams are cards, not slivers
# ---------------------------------------------------------------------------

patch(
    "map tile height floor",
    """      const MAP_TILE_W = 1600;
      const MAP_TILE_MIN_H = 480;""",
    """      const MAP_TILE_W = 1600;
      // 480 let a `flowchart LR` collapse to a 73px strip beside a 336px neighbour: the
      // plane was assigning visual weight by orientation rather than by importance. A wide
      // diagram is letterboxed inside a card of comparable size instead - .map-tile-body
      // already centres it.
      const MAP_TILE_MIN_H = 900;""",
)

patch(
    "map tile height ceiling and layout version",
    """      const MAP_TILE_MAX_H = 2200;
      const MAP_LAYOUT_VERSION = 2;""",
    """      const MAP_TILE_MAX_H = 1800;
      // Bumped with the tile range: layoutMap() only re-lays a saved plane when the version
      // moves, so without this an existing workspace would keep its slivers forever.
      const MAP_LAYOUT_VERSION = 3;""",
)


def main():
    if len(sys.argv) < 2:
        print("usage: fix_present_copy.py <path-to-app.html>", file=sys.stderr)
        return 2
    target = os.path.abspath(sys.argv[1])
    with open(target, "r", encoding="utf-8", newline="") as handle:
        html = handle.read()

    for label, count, old, new in PATCHES:
        found = html.count(old)
        if found != count:
            print(
                f"ABORT: anchor '{label}' matched {found} times, expected {count}. "
                "Nothing written.",
                file=sys.stderr,
            )
            return 1
        if new in html:
            print(f"ABORT: '{label}' looks already applied. Nothing written.", file=sys.stderr)
            return 1
        html = html.replace(old, new, count)
        print(f"ok: {label}")

    directory = os.path.dirname(target) or "."
    handle = tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", dir=directory, prefix=".siren-present-", suffix=".tmp", delete=False
    )
    try:
        handle.write(html)
        handle.flush()
        os.fsync(handle.fileno())
        handle.close()
        os.replace(handle.name, target)
    except BaseException:
        handle.close()
        if os.path.exists(handle.name):
            os.unlink(handle.name)
        raise

    print(f"wrote {target} ({len(html)} chars, {len(PATCHES)} patches)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
