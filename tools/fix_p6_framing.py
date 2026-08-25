#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
DEFECT 6 - "click a block to frame it" cannot be performed.

Anchor-guarded, single-pass, atomic.  argv[1] = the file to patch (a COPY;
never the live app).  Every edit is a literal, unique anchor; any drift aborts
before a byte is written.

WHAT WAS MEASURED (1440x900, four diagrams, the app driven through its own UI)

  1. Build opens with every tile at detail="mid" - an <img> raster - so
     .map-tile .node matches NOTHING.  domNodes: 0.  Three "+" presses change
     nothing (the Map binds no +/-).  The hint pill nevertheless reads
     "click a block to frame it".

  2. Scroll past that wall and a block DOES pick (.is-map-picked, hint
     "Block picked. Press Space to keep this view.") - and then Space records
     "The whole map".  mapCaptureView only keeps a pick when the camera covers
     exactly ONE tile; at every zoom where a block is still big enough to aim
     at, the camera also grazes a neighbour (measured: 41.5% / 16.3% / 4.1% /
     1.6% of the screen).  The pick is silently thrown away.

  3. Zoom far enough that one tile IS alone, pick a block, keep it, present it:
     the block lands at (1502, 2236) in a 1440x900 viewport - ON SCREEN: NO -
     and the exported slide is a BLANK dark rectangle.

  THE ROOT CAUSE of 3 is not a stale rect.  It is that mapNodeRect() and
  mapViewSlideSvg() both measure a block with node.getBBox(), which answers in
  the BLOCK'S OWN user space.  Every mermaid block is a <g transform=
  "translate(x,y)"> whose box is centred on its own origin, so - measured on
  the live tile - blocks A, B and C all report the identical box
  [-136, -40, 272, 81].  Every node stop therefore frames the diagram's ORIGIN,
  i.e. the tile's top-left corner, and two different node stops crop the
  identical region - which is exactly why the reviewer's two stops exported
  byte-identical images.  getBBox() gets the SIZE right and the POSITION wrong.

WHAT THIS CHANGES  (all inside Present: the Map, the deck, the deck export)

  1. mapNodeUserRect()   NEW.  One measurement, two consumers: the blocks'
                         rectangle read off the live tile on SCREEN and
                         returned both in screen px and in the diagram's own
                         viewBox units.  No getBBox, no assumption about the
                         tile's label strip, its padding or its contain-fit.
  2. mapNodeRect()       screen -> plane through the camera scale; rejects a
                         rect that falls outside its own tile.
  3. mapRectForView()    a node stop that cannot be measured falls back to the
                         rectangle the AUTHOR kept, not to the whole tile.
  4. mapGoToView()       re-aims once the near SVG has actually mounted, and
                         only re-flies if the measurement moved.
  5. mapUpdateTileDetail() while Build is open, tiles big enough to have been
                         drawn as pictures mount as real blocks (capped at
                         MAP_MAX_NEAR_BUILD) - so there is something to click.
  6. tile click in Build a click on the tile itself steps the camera into it,
                         which is the zoom where blocks are worth aiming at.
                         No new control: the Build bar keeps its seven.
  7. mapCaptureView()    a picked block names its own diagram, so the pick
                         survives; and a diagram stop is decided by the
                         best-covered tile rather than by exclusivity.
  8. mapHighlightView()  + .map-spotlight: the plane outside the framed thing
                         is dimmed (theme-token veil, drawn INSIDE the plane so
                         the camera carries it for free).
  9. mapViewSlideSvg()   crops from the same measurement and PAINTS the focus
                         marker into the exported picture.
 10. MAP_BUILD_HINT      one idea, not four.

SHARED PRIMITIVES TOUCHED: none.  openStructureMenu, showToast,
requestConfirmation, showDialog, svgToCanvas, buildRasterPdf, buildZip and the
theme tokens are all read-only here.  mapSlidePalette() is READ (for --primary)
and not modified.
"""
import io, os, sys, tempfile

TARGET = sys.argv[1] if len(sys.argv) > 1 else ''
if not TARGET or not os.path.isfile(TARGET):
    print('usage: fix_p6_framing.py <copy-of-app.html>')
    sys.exit(2)
if os.path.abspath(TARGET).lower().startswith(os.path.abspath(
        os.path.join(os.path.expanduser('~'), 'Downloads')).lower()):
    print('REFUSING: %s is in Downloads. Patch a COPY.' % TARGET)
    sys.exit(2)

src = io.open(TARGET, encoding='utf-8').read()
edits = []   # (label, anchor, replacement)


def edit(label, anchor, replacement):
    edits.append((label, anchor, replacement))


# ---------------------------------------------------------------------------
# 1.  A build-time near cap, next to the one it mirrors.
# ---------------------------------------------------------------------------
edit('const MAP_MAX_NEAR_BUILD',
     """      const MAP_MAX_NEAR = 3;
""",
     """      const MAP_MAX_NEAR = 3;
      /* Presenting, three live SVGs is the memory budget and the camera decides
         who is close. BUILDING, a tile is something to AIM AT rather than to
         look at: its blocks have to be in the DOM before one of them can be
         clicked. Eight is the whole-map view of a normal workspace; past that
         the author pans, and the same 0.08 floor still keeps a tile too small
         to click from ever mounting. */
      const MAP_MAX_NEAR_BUILD = 8;
""")

# ---------------------------------------------------------------------------
# 2.  The pick remembers which diagram it came from.
# ---------------------------------------------------------------------------
edit('let mapSelectedDiagramId',
     """      let mapSelectedNodeIds = [];
""",
     """      let mapSelectedNodeIds = [];
      // A picked block names its own diagram. Without this the capture had to
      // GUESS the diagram from what the camera covered, and threw the pick away
      // whenever the camera also grazed a neighbouring tile - which, with tiles
      // one gutter apart, is every zoom where a block is big enough to click.
      let mapSelectedDiagramId = '';
""")

# ---------------------------------------------------------------------------
# 3.  Build's step-in, and the pick recording its diagram.
# ---------------------------------------------------------------------------
edit('tile click: step in / remember the diagram',
     """          if (mapRecording || mapBuilding) {
            if (!id) return;
            mapSelectedNodeIds = [id];
            host.querySelectorAll('.node.is-map-picked').forEach(other => other.classList.remove('is-map-picked'));
            node.classList.add('is-map-picked');
            mapSetHint('Block picked. Press Space to keep this view.');
            return;
          }""",
     """          if (mapRecording || mapBuilding) {
            // A click that lands on the tile rather than on a block used to do
            // nothing at all. It is the step in: the camera goes to this tile, at
            // the height where its blocks are big enough to aim at. That is the
            // whole answer to "there is nothing to click here" - one gesture,
            // learned once, and nothing added to a bar that rests at seven.
            if (!id) {
              if (mapBuilding) mapFrameTile(diagram.id);
              return;
            }
            mapSelectedNodeIds = [id];
            mapSelectedDiagramId = diagram.id;
            host.querySelectorAll('.node.is-map-picked').forEach(other => other.classList.remove('is-map-picked'));
            node.classList.add('is-map-picked');
            mapSetHint('Block picked. Press Space to keep this view.');
            return;
          }""")

edit('mapFocusNode keep: remember the diagram',
     """        keep.addEventListener('click', () => {
          mapSelectedNodeIds = [nodeId];
          mapCaptureView();
          mapHideNodeChip();
        });""",
     """        keep.addEventListener('click', () => {
          mapSelectedNodeIds = [nodeId];
          mapSelectedDiagramId = diagram.id;
          mapCaptureView();
          mapHideNodeChip();
        });""")

# ---------------------------------------------------------------------------
# 4.  Build promotes tiles to real blocks; mapFrameTile is the step-in.
# ---------------------------------------------------------------------------
edit('mapUpdateTileDetail: near while building',
     """        nearCandidates.sort((a, b) => b.projected - a.projected);
        let nearUsed = 0;
        nearCandidates.forEach(entry => {
          const tile = mapEnsureTile(entry.diagram);
          if (!tile) return;
          let level = 'far';
          if (entry.projected >= 0.55 && nearUsed < MAP_MAX_NEAR) { level = 'near'; nearUsed += 1; }
          else if (entry.projected >= 0.08) level = 'mid';
          mapSetTileDetail(entry.diagram, tile, level);
        });""",
     """        nearCandidates.sort((a, b) => b.projected - a.projected);
        // Presenting, a tile is a picture and a raster is the honest cheap answer.
        // Building, the hint says to click a block - so anything the camera was
        // going to draw as a picture is mounted as real blocks instead, and the
        // instruction becomes possible to follow at the height Build opens at.
        const nearLimit = mapBuilding ? MAP_MAX_NEAR_BUILD : MAP_MAX_NEAR;
        const nearFloor = mapBuilding ? 0.08 : 0.55;
        let nearUsed = 0;
        nearCandidates.forEach(entry => {
          const tile = mapEnsureTile(entry.diagram);
          if (!tile) return;
          let level = 'far';
          if (entry.projected >= nearFloor && nearUsed < nearLimit) { level = 'near'; nearUsed += 1; }
          else if (entry.projected >= 0.08) level = 'mid';
          mapSetTileDetail(entry.diagram, tile, level);
        });""")

# ---------------------------------------------------------------------------
# 5.  THE MEASUREMENT.  One reading of the live tile, two consumers.
# ---------------------------------------------------------------------------
edit('mapNodeRect -> screen measurement',
     """      /* A node target is resolved from the live SVG at fly time, never from stored
         pixels: a re-render or a re-layout would otherwise aim the camera at a
         patch of empty plane and nobody would know why. */
      function mapNodeRect(diagramId, nodeIds) {
        const tile = mapTileEls.get(diagramId);
        const rect = mapTileRect(diagramId);
        if (!tile || !rect || !nodeIds.length) return null;
        const svg = tile.body.querySelector('svg');
        if (!svg) return null;
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        if (!viewBox || !viewBox.width) return null;
        const bounds = tile.body.getBoundingClientRect();
        if (!bounds.width) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let found = 0;
        nodeIds.forEach(id => {
          const node = mapFindNode(svg, id);
          if (!node) return;
          let box = null;
          try { box = node.getBBox(); } catch (error) { box = null; }
          if (!box || !box.width) return;
          found += 1;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        });
        if (!found) return null;
        // The tile contain-fits the diagram, so map units per viewBox unit is one
        // ratio shared by both axes.
        const fit = Math.min(rect.w / viewBox.width, rect.h / viewBox.height);
        const offsetX = rect.x + (rect.w - viewBox.width * fit) / 2;
        const offsetY = rect.y + (rect.h - viewBox.height * fit) / 2;
        const pad = 40;
        return {
          x: offsetX + (minX - viewBox.x) * fit - pad,
          y: offsetY + (minY - viewBox.y) * fit - pad,
          w: (maxX - minX) * fit + pad * 2,
          h: (maxY - minY) * fit + pad * 2
        };
      }""",
     """      /* ONE MEASUREMENT, TWO CONSUMERS - the camera and the deck export.

         Both used to read a block with node.getBBox(), which answers in the
         BLOCK'S OWN user space. Every mermaid block is a <g transform=
         "translate(x,y)"> whose box is centred on its own origin, so measured on
         a live tile the first three blocks of a flowchart all report the same
         box: [-136, -40, 272, 81]. getBBox gets the SIZE right and the POSITION
         wrong, which is why every node stop framed the diagram's origin - the
         tile's top-left corner - and why two different node stops cropped the
         same region and exported byte-identical pictures.

         What IS unique to a block is where it is drawn on screen. This reads
         that, and hands it back twice: as screen pixels (the camera divides by
         its own scale) and as the diagram's own viewBox units (the export crops
         and marks in those). It assumes nothing about the tile's label strip,
         the body's padding, or how the picture is fitted inside it. */
      function mapNodeUserRect(svg, nodeIds) {
        if (!svg || !nodeIds || !nodeIds.length) return null;
        const viewBox = svg.viewBox && svg.viewBox.baseVal;
        if (!viewBox || !viewBox.width || !viewBox.height) return null;
        const frame = svg.getBoundingClientRect();
        if (!frame.width || !frame.height) return null;
        // The picture is contain-fitted inside the <svg> box (xMidYMid meet), so
        // one ratio and two offsets carry a screen rectangle back to user units.
        const fit = Math.min(frame.width / viewBox.width, frame.height / viewBox.height);
        if (!(fit > 0)) return null;
        const originX = frame.left + (frame.width - viewBox.width * fit) / 2;
        const originY = frame.top + (frame.height - viewBox.height * fit) / 2;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let found = 0;
        nodeIds.forEach(id => {
          const node = mapFindNode(svg, id);
          if (!node) return;
          let box = null;
          try { box = node.getBoundingClientRect(); } catch (error) { box = null; }
          if (!box || !box.width || !box.height) return;
          found += 1;
          minX = Math.min(minX, box.left);
          minY = Math.min(minY, box.top);
          maxX = Math.max(maxX, box.right);
          maxY = Math.max(maxY, box.bottom);
        });
        if (!found) return null;
        const user = {
          x: viewBox.x + (minX - originX) / fit,
          y: viewBox.y + (minY - originY) / fit,
          w: (maxX - minX) / fit,
          h: (maxY - minY) / fit
        };
        // A block cannot be outside the picture that draws it. If the arithmetic
        // says it is, the SVG is half-mounted or the camera moved between the two
        // reads, and the caller is better served by its own fallback.
        if (user.x + user.w < viewBox.x || user.x > viewBox.x + viewBox.width
          || user.y + user.h < viewBox.y || user.y > viewBox.y + viewBox.height) return null;
        return { user, screen: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, found };
      }

      /* A node target is resolved from the live SVG at fly time, never from stored
         pixels: a re-render or a re-layout would otherwise aim the camera at a
         patch of empty plane and nobody would know why. */
      function mapNodeRect(diagramId, nodeIds) {
        const tile = mapTileEls.get(diagramId);
        const rect = mapTileRect(diagramId);
        if (!tile || !rect || !nodeIds.length) return null;
        const svg = tile.body.querySelector('svg');
        if (!svg) return null;
        const host = tile.host.getBoundingClientRect();
        const scale = mapCamera.scale;
        if (!host.width || !(scale > 0)) return null;
        const measured = mapNodeUserRect(svg, nodeIds);
        if (!measured) return null;
        // The only transform between a tile and the plane is the camera, so a
        // screen offset divided by the scale IS the offset in plane units.
        const pad = 40;
        const out = {
          x: rect.x + (measured.screen.x - host.left) / scale - pad,
          y: rect.y + (measured.screen.y - host.top) / scale - pad,
          w: measured.screen.w / scale + pad * 2,
          h: measured.screen.h / scale + pad * 2
        };
        // Reject a rect that falls outside its own tile, or that swallows it: a
        // block is part of a diagram, and anything else is a stale reading.
        if (!mapRectsIntersect(out, rect)) return null;
        if (out.w > rect.w * 1.6 || out.h > rect.h * 1.6) return null;
        return out;
      }

      /* Build's step in. Blocks are only worth clicking once a tile is big enough
         to aim at, and this is the gesture that gets there - so the Map needs no
         zoom controls and the Build bar keeps the seven it rests at. */
      function mapFrameTile(diagramId) {
        const rect = mapTileRect(diagramId);
        if (!rect) return;
        mapFlyTo(mapCameraForRect(rect, 1.02), {
          onDone: () => { if (mapBuilding) mapSetHint(MAP_BUILD_PICK_HINT); }
        });
      }""")

# ---------------------------------------------------------------------------
# 6.  mapRectForView: fall back to what the AUTHOR kept.
# ---------------------------------------------------------------------------
edit('mapRectForView node fallback',
     """        const nodeRect = mapNodeRect(target.diagramId, target.nodeIds || []);
        return nodeRect || tile;
      }""",
     """        const nodeRect = mapNodeRect(target.diagramId, target.nodeIds || []);
        if (nodeRect) return nodeRect;
        // Nothing measurable yet - the near SVG has not mounted. The rectangle the
        // author was looking at when they kept this stop is a truer answer than
        // the whole tile, which is a different slide.
        return view.framed && view.rect && view.rect.w > 0 ? view.rect : tile;
      }""")

# ---------------------------------------------------------------------------
# 7.  mapGoToView: aim again once the near SVG is really there.
# ---------------------------------------------------------------------------
edit('mapGoToView: deferred re-aim',
     """        const rect = mapRectForView(view);
        const padding = view.framed && view.target.kind !== 'nodes' ? 1
          : (view.target.kind === 'nodes' ? 1.5 : 1.1);
        mapFlyTo(mapCameraForRect(rect, padding), {
          instant: options.instant,
          onDone: () => mapHighlightView(view)
        });""",
     """        const rect = mapRectForView(view);
        const padding = view.framed && view.target.kind !== 'nodes' ? 1
          : (view.target.kind === 'nodes' ? MAP_NODE_PAD : 1.1);
        mapFlyTo(mapCameraForRect(rect, padding), {
          instant: options.instant,
          onDone: () => mapHighlightView(view)
        });
        // A cold tile mounts its near SVG in this same tick, but the picture behind
        // it can still be RENDERING - in which case the camera has just been aimed
        // at the stored rectangle. Take the measurement again once the blocks are
        // really there, and only move if it disagrees with what was aimed at.
        if (view.target.kind === 'nodes') mapAimNodeStop(bounded, rect, 0);""")

edit('mapAimNodeStop + MAP_NODE_PAD',
     """      function mapHighlightView(view) {
        mapTileEls.forEach(tile => {
          tile.host.querySelectorAll('.node.is-map-focus').forEach(node => node.classList.remove('is-map-focus'));
          tile.host.classList.remove('is-route-target');
        });
        if (view && (view.target.kind === 'diagram' || view.target.kind === 'nodes')) {
          const current = mapTileEls.get(view.target.diagramId);
          if (current) current.host.classList.add('is-route-target');
        }
        if (!view || view.target.kind !== 'nodes') return;
        const tile = mapTileEls.get(view.target.diagramId);
        const svg = tile && tile.body.querySelector('svg');
        if (!svg) return;
        (view.target.nodeIds || []).forEach(id => {
          const node = mapFindNode(svg, id);
          if (node) node.classList.add('is-map-focus');
        });
      }""",
     """      /* Enough air around a block that the audience sees what it connects to. */
      const MAP_NODE_PAD = 1.5;
      let mapNodeAimTimer = null;

      function mapAimNodeStop(index, aimedRect, attempt) {
        clearTimeout(mapNodeAimTimer);
        const view = state.map && state.map.route[index];
        if (!view || index !== mapRouteIndex) return;
        const target = view.target || {};
        if (target.kind !== 'nodes') return;
        const tile = mapTileEls.get(target.diagramId);
        const mounted = tile && tile.body.querySelector('svg');
        if (!mounted) {
          // ~1.4s of patience: a first render of a large flowchart, no more.
          if (attempt < 12) mapNodeAimTimer = setTimeout(() => mapAimNodeStop(index, aimedRect, attempt + 1), 120);
          return;
        }
        const rect = mapNodeRect(target.diagramId, target.nodeIds || []);
        if (!rect) return;
        // Agreement inside a pixel of plane is agreement. Re-flying on noise would
        // put a twitch in front of a client.
        if (aimedRect && Math.abs(rect.x - aimedRect.x) < 1 && Math.abs(rect.y - aimedRect.y) < 1
          && Math.abs(rect.w - aimedRect.w) < 1 && Math.abs(rect.h - aimedRect.h) < 1) {
          mapHighlightView(view);
          return;
        }
        mapFlyTo(mapCameraForRect(rect, MAP_NODE_PAD), {
          noArc: true,
          onDone: () => mapHighlightView(view)
        });
      }

      /* ONE STOP, ONE SUBJECT. At a diagram stop four tiles could be on screen at
         once - measured at 31%, 16%, 3% and 2% of it - while the presenter said
         the slide was about one of them; at a node stop nothing said which block
         was the point. Padding to 1.0 does not fix that (a tile and a screen have
         different shapes, so the slack simply moves to the other axis), and
         letterboxing the Map would put black bars over a plane whose whole point
         is that it is a place. So the plane around the framed thing is DIMMED.
         The veil is drawn INSIDE the plane, which means the camera carries it and
         no frame of a flight has to recompute anything. */
      let mapSpotlightEl = null;

      function mapUpdateSpotlight(rect) {
        if (!el.mapPlane) return;
        if (!mapSpotlightEl) {
          mapSpotlightEl = document.createElement('div');
          mapSpotlightEl.className = 'map-spotlight';
          mapSpotlightEl.setAttribute('aria-hidden', 'true');
        }
        // Building is authoring: the author needs to see the whole plane.
        if (!rect || !(rect.w > 0) || mapBuilding) { mapSpotlightEl.hidden = true; return; }
        if (mapSpotlightEl.parentNode !== el.mapPlane) el.mapPlane.appendChild(mapSpotlightEl);
        mapSpotlightEl.style.left = `${Math.round(rect.x)}px`;
        mapSpotlightEl.style.top = `${Math.round(rect.y)}px`;
        mapSpotlightEl.style.width = `${Math.round(rect.w)}px`;
        mapSpotlightEl.style.height = `${Math.round(rect.h)}px`;
        mapSpotlightEl.hidden = false;
      }

      function mapHighlightView(view) {
        mapTileEls.forEach(tile => {
          tile.host.querySelectorAll('.node.is-map-focus').forEach(node => node.classList.remove('is-map-focus'));
          tile.host.classList.remove('is-route-target');
        });
        const target = (view && view.target) || {};
        if (target.kind === 'diagram' || target.kind === 'nodes') {
          const current = mapTileEls.get(target.diagramId);
          if (current) current.host.classList.add('is-route-target');
        }
        if (target.kind !== 'nodes') {
          // A diagram stop singles out its tile; the whole map and a card have
          // nothing to single out.
          mapUpdateSpotlight(target.kind === 'diagram' ? mapTileRect(target.diagramId) : null);
          return;
        }
        const tile = mapTileEls.get(target.diagramId);
        const svg = tile && tile.body.querySelector('svg');
        if (!svg) { mapUpdateSpotlight(mapTileRect(target.diagramId)); return; }
        (target.nodeIds || []).forEach(id => {
          const node = mapFindNode(svg, id);
          if (node) node.classList.add('is-map-focus');
        });
        // The hole in the veil is the block itself, so a framed stop looks framed.
        mapUpdateSpotlight(mapNodeRect(target.diagramId, target.nodeIds || [])
          || mapTileRect(target.diagramId));
      }""")

# ---------------------------------------------------------------------------
# 8.  The hint: one idea.
# ---------------------------------------------------------------------------
edit('MAP_BUILD_HINT',
     """      /* Both tile gestures named, in the order a first-timer needs them. Dragging the
         chips is left to the grip the chips visibly grow in Build; what nothing on
         screen said was that a tile can still be opened while the deck is being made. */
      const MAP_BUILD_HINT = '＋ Add a slide · Open on a tile goes inside a diagram · click a block to frame it · Done';""",
     """      /* One idea, and the rest discovered. The four-clause version taught the whole
         mode at once - including an instruction that could not be carried out at the
         zoom it was displayed at - while Open, Add and Done are all visible words on
         screen already. What is NOT visible is that a tile is a place you can go
         into, so that is the line, and the next one arrives when you get there. */
      const MAP_BUILD_HINT = '＋ Add a slide · click a tile to go in';
      const MAP_BUILD_PICK_HINT = 'Click a block to frame just that block.';""")

# ---------------------------------------------------------------------------
# 9.  mapCaptureView: keep the pick; rank the tiles.
# ---------------------------------------------------------------------------
edit('mapCaptureView target',
     """        if (mapSelectedNodeIds.length && covering.length === 1) {
          target = { kind: 'nodes', diagramId: covering[0].id, nodeIds: mapSelectedNodeIds.slice(0, 40) };
        } else if (covering.length === 1) {
          const tile = mapTileRect(covering[0].id);
          const overlapW = Math.min(tile.x + tile.w, rect.x + rect.w) - Math.max(tile.x, rect.x);
          const overlapH = Math.min(tile.y + tile.h, rect.y + rect.h) - Math.max(tile.y, rect.y);
          const ratio = (overlapW * overlapH) / (tile.w * tile.h);
          target = ratio > 0.45 ? { kind: 'diagram', diagramId: covering[0].id } : { kind: 'map' };
        }""",
     """        // A picked block already names its diagram, so the camera does not have to
        // be over exactly ONE tile for the pick to mean something. It used to, and
        // that is why "click a block to frame it" could not be done: the tiles sit
        // one gutter apart, the camera is wider than one of them at any zoom where
        // a block is big enough to aim at, and a grazed neighbour silently turned a
        // deliberately framed block into "The whole map".
        const pickedHere = mapSelectedNodeIds.length && mapSelectedDiagramId
          && state.diagrams.some(diagram => diagram.id === mapSelectedDiagramId);
        if (pickedHere) {
          target = { kind: 'nodes', diagramId: mapSelectedDiagramId, nodeIds: mapSelectedNodeIds.slice(0, 40) };
        } else if (covering.length) {
          // Whichever tile the camera is looking AT, not whichever tile it is
          // looking at exclusively.
          const ranked = covering.map(diagram => {
            const tile = mapTileRect(diagram.id);
            const overlapW = Math.min(tile.x + tile.w, rect.x + rect.w) - Math.max(tile.x, rect.x);
            const overlapH = Math.min(tile.y + tile.h, rect.y + rect.h) - Math.max(tile.y, rect.y);
            return { id: diagram.id, ratio: (overlapW * overlapH) / (tile.w * tile.h) };
          }).sort((a, b) => b.ratio - a.ratio);
          target = ranked[0].ratio > 0.45 ? { kind: 'diagram', diagramId: ranked[0].id } : { kind: 'map' };
        }""")

edit('mapCaptureView reset',
     """        mapRouteIndex += 1;
        mapSelectedNodeIds = [];
        mapMarkCurated();""",
     """        mapRouteIndex += 1;
        mapSelectedNodeIds = [];
        mapSelectedDiagramId = '';
        mapMarkCurated();""")

edit('mapToggleRecording reset',
     """        if (!mapRecording) mapSelectedNodeIds = [];
      }""",
     """        if (!mapRecording) { mapSelectedNodeIds = []; mapSelectedDiagramId = ''; }
      }""")

# ---------------------------------------------------------------------------
# 10.  mapSetBuild: the promotion and the veil follow the mode.
# ---------------------------------------------------------------------------
edit('mapSetBuild: retile + veil',
     """        mapUpdateTileOpenLabels();
        mapSetHint(mapBuilding ? MAP_BUILD_HINT : MAP_RESTING_HINT);
        mapRenderRoute();""",
     """        mapUpdateTileOpenLabels();
        // Entering Build turns the tiles under the camera into real blocks and
        // leaving it hands them back to the level-of-detail budget. Both are the
        // same one call - the mode is the only thing that changed.
        mapUpdateTileDetail();
        // The veil is a presenting device: the author needs the whole plane.
        if (mapBuilding) mapUpdateSpotlight(null);
        mapSetHint(mapBuilding ? MAP_BUILD_HINT : MAP_RESTING_HINT);
        mapRenderRoute();""")

edit('mapSetBuild: clear the pick',
     """        if (!mapBuilding) {
          mapSelectedNodeIds = [];
          // Done returns to presenting standing on the current stop.
          if (mapMode) mapGoToView(mapRouteIndex);
        }""",
     """        if (!mapBuilding) {
          mapSelectedNodeIds = [];
          mapSelectedDiagramId = '';
          // Done returns to presenting standing on the current stop.
          if (mapMode) mapGoToView(mapRouteIndex);
        }""")

# ---------------------------------------------------------------------------
# 11.  The veil's CSS, beside the ring it belongs with.
# ---------------------------------------------------------------------------
edit('.map-spotlight CSS',
     """    .map-focus-ring {
      position: absolute;
      inset: 16px;""",
     """    /* The hole is the framed thing; the spread paints everything else. Sized in
       PLANE pixels because it lives on the plane, so the camera scales it with the
       tiles and the veil never has to be recomputed mid-flight. The tint is the
       app background, so a light theme washes the neighbours out rather than
       laying black over a white room. */
    .map-spotlight {
      position: absolute;
      border-radius: 26px;
      pointer-events: none;
      z-index: 1;
      box-shadow: 0 0 0 100000px color-mix(in srgb, var(--app-bg) 78%, transparent);
      transition: opacity .3s ease;
    }
    .map-spotlight[hidden] { display: none; }
    .map-focus-ring {
      position: absolute;
      inset: 16px;""")

# ---------------------------------------------------------------------------
# 12.  THE EXPORT: crop from the same measurement, and paint the marker.
# ---------------------------------------------------------------------------
edit('mapViewSlideSvg node crop + marker',
     """        const tile = mapTileEls.get(diagram.id);
        const live = tile && tile.body.querySelector('svg');
        if (live) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          let found = 0;
          (target.nodeIds || []).forEach(id => {
            const node = mapFindNode(live, id);
            if (!node) return;
            let rect = null;
            try { rect = node.getBBox(); } catch (error) { rect = null; }
            if (!rect || !rect.width) return;
            found += 1;
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          });
          if (found) {
            const pad = Math.max(60, (maxX - minX) * 0.35);
            const w = (maxX - minX) + pad * 2;
            const h = Math.max((maxY - minY) + pad * 2, w * 9 / 16);
            root.setAttribute('viewBox', `${minX - pad} ${minY - (h - (maxY - minY)) / 2} ${w} ${h}`);
            root.setAttribute('width', String(Math.round(w)));
            root.setAttribute('height', String(Math.round(h)));
            return new XMLSerializer().serializeToString(root);
          }
        }
        return svg;""",
     """        // The crop is measured off the tile's LIVE SVG, so the tile has to be
        // showing real blocks. If the camera left this diagram at raster detail,
        // mount it the way mapGoToView does - the next camera tick puts the level
        // back. Without this the crop silently fell through to the whole picture.
        let tile = mapTileEls.get(diagram.id);
        if (!tile && mapMode) tile = mapEnsureTile(diagram);
        if (tile && tile.level !== 'near') mapSetTileDetail(diagram, tile, 'near');
        const live = tile && tile.body.querySelector('svg');
        const measured = live ? mapNodeUserRect(live, target.nodeIds || []) : null;
        if (measured) {
          const user = measured.user;
          const pad = Math.max(60, user.w * 0.35);
          const w = user.w + pad * 2;
          const h = Math.max(user.h + pad * 2, w * 9 / 16);
          root.setAttribute('viewBox', `${user.x - pad} ${user.y - (h - user.h) / 2} ${w} ${h}`);
          root.setAttribute('width', String(Math.round(w)));
          root.setAttribute('height', String(Math.round(h)));
          // The room saw a marked block. The file has to show the same thing, or a
          // framed stop is only a close-up of a diagram nobody can point at.
          const marker = mapSlideFocusMarker(doc, user, w);
          if (marker) root.appendChild(marker);
          return new XMLSerializer().serializeToString(root);
        }
        return svg;""")

edit('mapSlideFocusMarker',
     """      /* Each view becomes one slide image: set a viewBox to the view's rectangle in
         the diagram's own coordinates and rasterise, so what the audience saw on the
         plane is what lands in the file. */
      async function mapViewSlideSvg(view) {""",
     """      /* The focus marker, in the diagram's own units, drawn into the exported
         picture. An exported SVG carries no stylesheet, so the colour is resolved
         through the deck's own palette reader rather than left to a CSS variable
         that will not be there - the same --primary the ring on the plane uses.
         Two rings: a wide soft one for the halo the plane draws with a filter, and
         a crisp one on the block itself. */
      function mapSlideFocusMarker(doc, user, cropWidth) {
        if (!doc || !user || !(user.w > 0)) return null;
        const accent = mapSlidePalette().accent || '#2563eb';
        const weight = Math.max(2.5, cropWidth * 0.006);
        const ring = (inset, stroke, opacity) => {
          const node = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
          node.setAttribute('x', mapSlideNum(user.x - inset));
          node.setAttribute('y', mapSlideNum(user.y - inset));
          node.setAttribute('width', mapSlideNum(user.w + inset * 2));
          node.setAttribute('height', mapSlideNum(user.h + inset * 2));
          node.setAttribute('rx', mapSlideNum(inset + Math.min(user.w, user.h) * 0.12));
          node.setAttribute('fill', 'none');
          node.setAttribute('stroke', accent);
          node.setAttribute('stroke-width', mapSlideNum(stroke));
          node.setAttribute('opacity', String(opacity));
          return node;
        };
        const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.appendChild(ring(weight * 5.2, weight * 4.2, 0.22));
        group.appendChild(ring(weight * 2.2, weight, 0.95));
        return group;
      }

      /* Each view becomes one slide image: set a viewBox to the view's rectangle in
         the diagram's own coordinates and rasterise, so what the audience saw on the
         plane is what lands in the file. */
      async function mapViewSlideSvg(view) {""")

# ---------------------------------------------------------------------------
# apply
# ---------------------------------------------------------------------------
out = src
problems = []
for label, anchor, replacement in edits:
    count = out.count(anchor)
    if count != 1:
        problems.append('%-38s anchor found %d times (need 1)' % (label, count))
        continue
    out = out.replace(anchor, replacement, 1)

if problems:
    print('DRIFT - nothing written:')
    for line in problems:
        print('  ' + line)
    sys.exit(1)

if out == src:
    print('no change produced - nothing written')
    sys.exit(1)

folder = os.path.dirname(os.path.abspath(TARGET)) or '.'
handle, temp = tempfile.mkstemp(dir=folder, suffix='.tmp')
os.close(handle)
io.open(temp, 'w', encoding='utf-8', newline='').write(out)
os.replace(temp, TARGET)
print('patched %s' % TARGET)
print('  %d edits, %d -> %d bytes (%+d)' % (len(edits), len(src.encode('utf-8')),
                                            len(out.encode('utf-8')),
                                            len(out.encode('utf-8')) - len(src.encode('utf-8'))))
