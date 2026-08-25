# -*- coding: utf-8 -*-
"""
fix_present_dragundo.py  --  SIREN Present: drag-and-drop on the Map plane,
                             and a bounded undo/redo history for the deck.

    python fix_present_dragundo.py <target.html>

Every edit is anchor-guarded: each anchor must appear EXACTLY ONCE in the
target or the script aborts and writes nothing.  The write itself is atomic
(temp file in the same directory, then os.replace).

WHAT IT BUILDS
--------------
1. DRAG.  In Build, a press that lands on a card or a diagram tile moves that
   rectangle instead of panning the plane.  There is no second drag
   implementation: the plane's own pointer model (mapPointerState, the 9px
   slop, the pointer capture on el.mapLayer) simply learns that a press can
   land on an object.  Snapping is to the edges and centres of the other
   rectangles and to MAP_GUTTER, the spacing the layout itself uses, with the
   tolerance measured in SCREEN pixels so it feels the same at any camera
   height.  Guides are drawn in plane units and counter-scaled through the
   plane's existing --map-scale.

2. HISTORY.  A bounded history over the deck-shaped part of state.map
   (tiles + cards + route + the two flags), NOT the whole app state and NOT
   the diagram undo stack.  Same shape as the Docs history the owner already
   knows: a 500ms settle, a `baseline`, past/future arrays, buttons disabled
   from the array lengths, "Undone."/"Redone." toasts.  Ctrl+Z / Ctrl+Shift+Z
   / Ctrl+Y are bound only while Build is open, and they stopPropagation so
   they cannot reach the Mermaid-source undo underneath.

SHARED PRIMITIVES: none changed.  showToast / requestConfirmation / clamp /
scheduleSave / sanitizeMapState are called, never modified.
"""

import io
import os
import sys
import tempfile

EDITS = []


def edit(name, old, new):
    EDITS.append((name, old, new))


# ---------------------------------------------------------------- 1. CSS
edit(
    "css: grab cursors, drag dress and alignment guides",
    """    .map-layer[data-building="on"] .map-view-name { max-width: 150px; }
""",
    """    .map-layer[data-building="on"] .map-view-name { max-width: 150px; }
    /* ---- Build: the plane's rectangles are things you place ----
       A card is a slide and a tile is a diagram, but on the plane both are the
       same object - a rectangle in plane units - so in Build both say so with
       the same cursor the route chips already use. Presenting is untouched. */
    .map-layer[data-building="on"] .map-card,
    .map-layer[data-building="on"] .map-tile { cursor: grab; }
    /* A press that lands on a card's own text used to start the browser's NATIVE
       text drag, which fires pointercancel and kills the gesture stone dead -
       measured: pointerdown|dragstart|pointercancel, the card never moving. While
       Build is on, the rectangles are objects, not prose. */
    .map-layer[data-building="on"] .map-card,
    .map-layer[data-building="on"] .map-card *,
    .map-layer[data-building="on"] .map-tile,
    .map-layer[data-building="on"] .map-tile * {
      -webkit-user-select: none;
      user-select: none;
      -webkit-user-drag: none;
    }
    .map-layer[data-building="on"] .map-card.is-map-dragging,
    .map-layer[data-building="on"] .map-tile.is-map-dragging { cursor: grabbing; }
    .map-card.is-map-dragging,
    .map-tile.is-map-dragging {
      border-color: var(--primary);
      box-shadow: 0 60px 160px rgba(0, 0, 0, .42),
                  0 0 0 calc(7px / var(--map-scale, 1)) color-mix(in srgb, var(--primary) 38%, transparent);
      transition: none;
    }
    /* Alignment guides live in plane units like .map-thread does, so the camera
       carries them for free; the stroke is counter-scaled off the plane's own
       --map-scale so it is a hairline at any camera height, never a wall. */
    .map-guides { position: absolute; overflow: visible; pointer-events: none; z-index: 3; }
    .map-guides line {
      stroke: var(--warning);
      stroke-width: calc(3px / var(--map-scale, 1));
      stroke-dasharray: calc(20px / var(--map-scale, 1)) calc(16px / var(--map-scale, 1));
      opacity: .95;
    }
""",
)

# ---------------------------------------------------------------- 2. Build bar buttons
edit(
    "html: undo/redo on the Build bar",
    """            <button class="btn secondary compact" id="mapAddButton" type="button" aria-haspopup="listbox" title="Add a slide after the current one">＋ Add</button>""",
    """            <!-- Same pair, same glyphs, same wording as the Docs toolbar the author
                 already uses: undo is undo wherever they meet it. Honestly disabled -
                 the state comes from the history arrays, not from a guess. -->
            <button class="btn ghost compact" id="mapUndoButton" type="button" title="Undo the last change to the presentation (Ctrl + Z)" disabled>↶ Undo</button>
            <button class="btn ghost compact" id="mapRedoButton" type="button" title="Redo (Ctrl + Shift + Z)" disabled>↷ Redo</button>
            <button class="btn secondary compact" id="mapAddButton" type="button" aria-haspopup="listbox" title="Add a slide after the current one">＋ Add</button>""",
)

edit(
    "el: register the two new buttons",
    """'mapBuildButton','mapAddButton','mapKeepViewButton','mapDoneButton'""",
    """'mapBuildButton','mapAddButton','mapKeepViewButton','mapUndoButton','mapRedoButton','mapDoneButton'""",
)

edit(
    "bind: undo/redo clicks",
    """        if (el.mapAddButton) el.mapAddButton.addEventListener('click', () => mapOpenAddMenu(el.mapAddButton));
""",
    """        if (el.mapAddButton) el.mapAddButton.addEventListener('click', () => mapOpenAddMenu(el.mapAddButton));
        if (el.mapUndoButton) el.mapUndoButton.addEventListener('click', () => {
          mapStepHistory(-1);
          // Focus must not stay on a button that has just gone disabled, or the
          // next Space keeps a view instead of pressing nothing.
          el.mapUndoButton.blur();
          if (el.mapLayer) el.mapLayer.focus();
        });
        if (el.mapRedoButton) el.mapRedoButton.addEventListener('click', () => {
          mapStepHistory(1);
          el.mapRedoButton.blur();
          if (el.mapLayer) el.mapLayer.focus();
        });
""",
)

# ---------------------------------------------------------------- 3. Tidy up: save it, and let it be undone
edit(
    "tidy up: persist it and make it undoable",
    """        if (el.mapTidyButton) el.mapTidyButton.addEventListener('click', () => {
          layoutMap(true);
          mapTileEls.forEach(tile => tile.host.remove());
          mapTileEls = new Map();
          mapRenderCards();
          mapRenderThread();
          mapUpdateTileDetail();
          mapFlyTo(mapCameraForRect(mapBounds(), 1.06));
          showToast('Map tidied.', 'success');
        });
""",
    """        if (el.mapTidyButton) el.mapTidyButton.addEventListener('click', () => {
          layoutMap(true);
          mapTileEls.forEach(tile => tile.host.remove());
          mapTileEls = new Map();
          mapRenderCards();
          mapRenderThread();
          mapUpdateTileDetail();
          mapFlyTo(mapCameraForRect(mapBounds(), 1.06));
          // Tidy up rewrites every tile rectangle, so it is the single largest
          // edit in Build - and until now it was neither saved nor undoable.
          scheduleMapHistory();
          scheduleSave();
          showToast('Map tidied.', 'success');
        });
""",
)

# ---------------------------------------------------------------- 4. state.map.placed
edit(
    "state: makeDefaultMapState gains `placed`",
    """        return { tiles: {}, cards: [], route: [], curated: false, settings: { speed: 'smooth', arc: true, loop: false, hold: 8 } };""",
    """        return { tiles: {}, cards: [], route: [], curated: false, placed: false, settings: { speed: 'smooth', arc: true, loop: false, hold: 8 } };""",
)

edit(
    "sanitizeMapState: carry `placed`",
    """          curated: Boolean(map.curated),
          settings: {""",
    """          curated: Boolean(map.curated),
          // The twin of `curated`, for geometry instead of order: set the first time
          // the author drags something on the plane. While it is false the layout
          // behaves exactly as it always has.
          placed: Boolean(map.placed),
          settings: {""",
)

# ---------------------------------------------------------------- 5. layoutMap respects hand placement
edit(
    "layoutMap: a hand-placed plane is not swept by a new diagram",
    """        const tiles = force ? {} : { ...state.map.tiles };
        const missing = state.diagrams.filter(diagram => !tiles[diagram.id]);
        if (!missing.length && !force) return;
""",
    """        const tiles = force ? {} : { ...state.map.tiles };
        const missing = state.diagrams.filter(diagram => !tiles[diagram.id]);
        if (!missing.length && !force) return;
        // Unforced, this used to rebuild EVERY rectangle from scratch the moment one
        // diagram was added - which would throw away an arrangement the author had
        // just made by hand. Once anything has been placed, newcomers park in a fresh
        // column beside the plane and Tidy up stays the one door back to the grid.
        if (!force && state.map.placed) {
          const edge = mapBounds();
          let y = edge.y + MAP_GUTTER;
          missing.forEach(diagram => {
            const aspect = mapTileAspect(diagram);
            const h = clamp(MAP_TILE_W / Math.max(0.2, aspect), MAP_TILE_MIN_H, MAP_TILE_MAX_H);
            tiles[diagram.id] = { x: edge.x + edge.w, y, w: MAP_TILE_W, h };
            y += h + MAP_GUTTER;
          });
          state.map.tiles = tiles;
          return;
        }
""",
)

edit(
    "layoutMap: a forced tidy hands the plane back to the grid",
    """          card.x += to.x - from.x;
          card.y += to.y - from.y;
        });
        state.map.tiles = next;""",
    """          card.x += to.x - from.x;
          card.y += to.y - from.y;
        });
        // Reaching here means the grid just rewrote the plane, so nothing on it is
        // hand-placed any more.
        state.map.placed = false;
        state.map.tiles = next;""",
)

# ---------------------------------------------------------------- 6. the drag itself
edit(
    "drag: the one implementation, in front of mapBindPointer",
    """      /* ---------------- pointer ---------------- */

      function mapBindPointer() {""",
    """      /* ---------------- Build: moving what is on the plane ----------------
         The owner's words: "sa poti muti cu drag in drop ferestrele de
         prezentare". A card is a slide and a tile is a diagram, but on the
         plane both are one thing - a rectangle in plane units - so both move
         through ONE gesture, and that gesture is the plane's own pointer model:
         the same mapPointerState, the same 9px slop before a click becomes a
         drag, the same pointer capture on el.mapLayer, the same mapStopCamera
         on the way down. Nothing new listens for a pointer. The existing
         handler simply learns that in Build a press can land on an object.

         Split by target, not by mode - the same split the tile body and its
         corner button already use: press the plane and the plane pans, press a
         rectangle and the rectangle moves. Outside Build there are no drag
         targets at all, because outside Build the plane is for showing. */
      const MAP_SNAP_PX = 11;
      let mapGuidesEl = null;

      /* Everything else on the plane, as plain rectangles, for snapping against. */
      function mapDragRects(skip) {
        const rects = [];
        Object.values((state.map && state.map.tiles) || {}).forEach(tile => {
          if (tile !== skip) rects.push(tile);
        });
        ((state.map && state.map.cards) || []).forEach(card => {
          if (card !== skip) rects.push(card);
        });
        return rects;
      }

      function mapDragTargetFor(event) {
        if (!mapBuilding || readOnlyMode || !state.map) return null;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return null;
        // A tile's corner button is a door into the diagram, not a handle.
        if (target.closest('button')) return null;
        const cardHost = target.closest('.map-card');
        if (cardHost) {
          const card = (state.map.cards || []).find(entry => entry.id === cardHost.dataset.cardId);
          if (card) {
            return { kind: 'card', id: card.id, rect: card, host: cardHost, x: card.x, y: card.y,
                     label: card.title || card.eyebrow || 'this slide' };
          }
        }
        const tileHost = target.closest('.map-tile');
        if (tileHost) {
          const id = tileHost.dataset.diagramId;
          const rect = mapTileRect(id);
          const diagram = state.diagrams.find(entry => entry.id === id);
          if (rect) {
            return { kind: 'tile', id, rect, host: tileHost, x: rect.x, y: rect.y,
                     label: (diagram && (diagram.name || diagram.diagramTitle)) || 'this diagram' };
          }
        }
        return null;
      }

      /* Snap to the edges and centres of everything else, and to MAP_GUTTER - the
         one spacing constant the automatic layout and mapCardAnchor already use, so
         a card dropped beside a tile lands exactly where the app would have put it.
         The tolerance is SCREEN pixels divided by the camera scale, so the snap
         feels identical whether one tile fills the room or forty are in frame. */
      function mapDragSnap(drag, wanted) {
        const tol = MAP_SNAP_PX / Math.max(0.0001, mapCamera.scale);
        const w = drag.rect.w;
        const h = drag.rect.h;
        let bestX = null;
        let bestY = null;
        drag.others.forEach(other => {
          const xs = [
            [other.x, other.x],
            [other.x + other.w - w, other.x + other.w],
            [other.x + (other.w - w) / 2, other.x + other.w / 2],
            [other.x + other.w, other.x + other.w],
            [other.x - w, other.x],
            [other.x + other.w + MAP_GUTTER, other.x + other.w + MAP_GUTTER],
            [other.x - MAP_GUTTER - w, other.x - MAP_GUTTER]
          ];
          xs.forEach(pair => {
            const away = Math.abs(wanted.x - pair[0]);
            if (away > tol) return;
            if (bestX && bestX.away <= away) return;
            bestX = { away, value: pair[0], at: pair[1], other };
          });
          const ys = [
            [other.y, other.y],
            [other.y + other.h - h, other.y + other.h],
            [other.y + (other.h - h) / 2, other.y + other.h / 2],
            [other.y + other.h, other.y + other.h],
            [other.y - h, other.y],
            [other.y + other.h + MAP_GUTTER, other.y + other.h + MAP_GUTTER],
            [other.y - MAP_GUTTER - h, other.y - MAP_GUTTER]
          ];
          ys.forEach(pair => {
            const away = Math.abs(wanted.y - pair[0]);
            if (away > tol) return;
            if (bestY && bestY.away <= away) return;
            bestY = { away, value: pair[0], at: pair[1], other };
          });
        });
        const out = { x: bestX ? bestX.value : wanted.x, y: bestY ? bestY.value : wanted.y, guides: [] };
        if (bestX) {
          out.guides.push({
            x1: bestX.at, x2: bestX.at,
            y1: Math.min(out.y, bestX.other.y) - MAP_GUTTER / 3,
            y2: Math.max(out.y + h, bestX.other.y + bestX.other.h) + MAP_GUTTER / 3
          });
        }
        if (bestY) {
          out.guides.push({
            y1: bestY.at, y2: bestY.at,
            x1: Math.min(out.x, bestY.other.x) - MAP_GUTTER / 3,
            x2: Math.max(out.x + w, bestY.other.x + bestY.other.w) + MAP_GUTTER / 3
          });
        }
        return out;
      }

      /* Created lazily, never in the HTML: mapOpen resets the plane to
         replaceChildren(el.mapThread), so a guide layer declared up front would be
         thrown away the second time Present opened. */
      function mapEnsureGuides() {
        if (mapGuidesEl && mapGuidesEl.isConnected) return mapGuidesEl;
        if (!el.mapPlane) return null;
        mapGuidesEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        mapGuidesEl.setAttribute('class', 'map-guides');
        mapGuidesEl.setAttribute('aria-hidden', 'true');
        el.mapPlane.appendChild(mapGuidesEl);
        return mapGuidesEl;
      }

      function mapDrawGuides(lines) {
        const svg = mapEnsureGuides();
        if (!svg) return;
        svg.replaceChildren();
        if (!lines || !lines.length) { svg.hidden = true; return; }
        // Same framing trick as mapRenderThread: one plane unit is one CSS pixel,
        // and the camera transform on .map-plane does the rest.
        const bounds = mapBounds();
        svg.hidden = false;
        svg.setAttribute('viewBox', `${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`);
        svg.style.left = `${bounds.x}px`;
        svg.style.top = `${bounds.y}px`;
        svg.style.width = `${bounds.w}px`;
        svg.style.height = `${bounds.h}px`;
        lines.forEach(line => {
          const node = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          node.setAttribute('x1', String(line.x1));
          node.setAttribute('y1', String(line.y1));
          node.setAttribute('x2', String(line.x2));
          node.setAttribute('y2', String(line.y2));
          svg.appendChild(node);
        });
      }

      function mapDragBegin(drag) {
        drag.started = true;
        drag.others = mapDragRects(drag.rect);
        // The hint line is the only thing on screen teaching Build, so it is
        // borrowed and handed straight back rather than overwritten.
        drag.hint = el.mapHint && !el.mapHint.hidden ? el.mapHint.textContent : '';
        drag.host.classList.add('is-map-dragging');
        mapSetHint(`Moving “${drag.label}” · release to drop it · Esc puts it back`);
      }

      function mapDragMove(drag, dx, dy) {
        if (!drag.started) mapDragBegin(drag);
        // Screen pixels into plane units: the object stays under the pointer at
        // every camera height, which is the whole reason this reads as dragging.
        const wanted = { x: drag.x + dx / mapCamera.scale, y: drag.y + dy / mapCamera.scale };
        const snapped = mapDragSnap(drag, wanted);
        drag.rect.x = Math.round(snapped.x);
        drag.rect.y = Math.round(snapped.y);
        drag.host.style.left = `${drag.rect.x}px`;
        drag.host.style.top = `${drag.rect.y}px`;
        mapDrawGuides(snapped.guides);
      }

      /* A stop captured with ● Keep this view stores absolute plane pixels, so a
         rectangle that moves has to take those pixels with it or the stop would fly
         to the patch of empty plane the object used to sit on. Same reasoning as
         layoutMap already applies to cards that follow their tile. */
      function mapDragCarryViews(drag, dx, dy) {
        ((state.map && state.map.route) || []).forEach(view => {
          if (!view.framed || !view.rect) return;
          const target = view.target || {};
          const mine = drag.kind === 'card'
            ? (target.kind === 'card' && target.cardId === drag.id)
            : ((target.kind === 'diagram' || target.kind === 'nodes') && target.diagramId === drag.id);
          if (!mine) return;
          view.rect = { x: view.rect.x + dx, y: view.rect.y + dy, w: view.rect.w, h: view.rect.h };
        });
      }

      function mapDragTeardown(drag) {
        drag.host.classList.remove('is-map-dragging');
        mapDrawGuides([]);
        mapSetHint(drag.hint || '');
      }

      function mapDragEnd(drag) {
        mapDragTeardown(drag);
        const dx = drag.rect.x - drag.x;
        const dy = drag.rect.y - drag.y;
        if (!dx && !dy) return;
        mapDragCarryViews(drag, dx, dy);
        if (state.map) state.map.placed = true;
        // Both mount/unmount with the camera, and both just changed where they are.
        mapUpdateTileDetail();
        mapRenderThread();
        scheduleMapHistory();
        scheduleSave();
      }

      function mapDragCancel(drag) {
        drag.rect.x = drag.x;
        drag.rect.y = drag.y;
        drag.host.style.left = `${drag.x}px`;
        drag.host.style.top = `${drag.y}px`;
        mapDragTeardown(drag);
        mapRenderThread();
        // mapPointerState itself stays alive with moved:true, so the click that
        // follows the release is still swallowed and no editor opens.
        if (mapPointerState) mapPointerState.drag = null;
      }

      /* Tiles are positioned once, when they mount. Undo, redo and a cancelled
         drag all move them without remounting, so their boxes are re-read here. */
      function mapPlaceObjects() {
        mapTileEls.forEach((tile, id) => {
          const rect = mapTileRect(id);
          if (!rect) return;
          tile.host.style.left = `${rect.x}px`;
          tile.host.style.top = `${rect.y}px`;
          tile.host.style.width = `${rect.w}px`;
          tile.host.style.height = `${rect.h}px`;
        });
      }

      /* ---------------- pointer ---------------- */

      function mapBindPointer() {""",
)

edit(
    "pointer: the plane never starts a native browser drag",
    """        el.mapLayer.addEventListener('scroll', () => { el.mapLayer.scrollTop = 0; el.mapLayer.scrollLeft = 0; });
""",
    """        el.mapLayer.addEventListener('scroll', () => { el.mapLayer.scrollTop = 0; el.mapLayer.scrollLeft = 0; });
        // Measured, not guessed: a press that lands on a tile's or a card's own text
        // makes the browser start its native text drag - pointerdown, dragstart,
        // pointercancel - and the pointer stream dies mid-gesture. That killed a card
        // drag outright, and it has always been able to kill a plane PAN the same way.
        // Nothing on the plane is draggable in the HTML5 sense. The route chips are
        // NOT on the plane (they live in .map-route) so their own drag-to-reorder is
        // untouched.
        el.mapPlane.addEventListener('dragstart', event => { event.preventDefault(); });
""",
)

edit(
    "pointer: a press in Build can land on an object",
    """          mapStopCamera();
          mapPointerState = { x: event.clientX, y: event.clientY, camera: { ...mapCamera }, moved: false, pointerId: event.pointerId };
        });""",
    """          mapStopCamera();
          mapPointerState = { x: event.clientX, y: event.clientY, camera: { ...mapCamera }, moved: false, pointerId: event.pointerId, drag: mapDragTargetFor(event) };
        });""",
)

edit(
    "pointer: past the slop, an object drag moves the object",
    """          if (!mapPointerState.moved) return;
          mapStopCamera();
          mapCamera = {
            x: mapPointerState.camera.x - dx / mapCamera.scale,
            y: mapPointerState.camera.y - dy / mapCamera.scale,
            scale: mapCamera.scale
          };
          applyMapCamera();
        });""",
    """          if (!mapPointerState.moved) return;
          mapStopCamera();
          // Split by target: a press that landed on a rectangle moves that
          // rectangle, a press on the plane still pans the plane.
          if (mapPointerState.drag) { mapDragMove(mapPointerState.drag, dx, dy); return; }
          mapCamera = {
            x: mapPointerState.camera.x - dx / mapCamera.scale,
            y: mapPointerState.camera.y - dy / mapCamera.scale,
            scale: mapCamera.scale
          };
          applyMapCamera();
        });""",
)

edit(
    "pointer: the release finishes a drag",
    """        const release = event => {
          if (!mapPointerState) return;
          if (mapPointerState.moved) {
            try { el.mapLayer.releasePointerCapture(event.pointerId); } catch (error) { /* already gone */ }
          }""",
    """        const release = event => {
          if (!mapPointerState) return;
          if (mapPointerState.drag && mapPointerState.drag.started) mapDragEnd(mapPointerState.drag);
          if (mapPointerState.moved) {
            try { el.mapLayer.releasePointerCapture(event.pointerId); } catch (error) { /* already gone */ }
          }""",
)

# ---------------------------------------------------------------- 7. the history
edit(
    "pointer: a cancelled pointer puts a dragged object back",
    """        el.mapLayer.addEventListener('pointerup', release);
        el.mapLayer.addEventListener('pointercancel', release);
""",
    """        el.mapLayer.addEventListener('pointerup', release);
        // A cancelled pointer is not a drop. Committing whatever partial move the
        // gesture had reached would leave the object somewhere nobody chose.
        el.mapLayer.addEventListener('pointercancel', event => {
          if (mapPointerState && mapPointerState.drag && mapPointerState.drag.started) mapDragCancel(mapPointerState.drag);
          release(event);
        });
""",
)

edit(
    "history: the deck's own undo stack, in front of the chrome section",
    """      /* ---------------- chrome ---------------- */

      function mapUpdateChrome() {""",
    """      /* ---------------- the deck's own history ----------------
         Drag without undo is a trap, and until now only removing a slide even
         asked. This is a bounded history over the DECK-shaped part of state.map -
         tiles, cards, route and the two flags that describe them - and nothing
         else: not the whole app state, and not the diagram undo stack, which has
         a different granularity and a different meaning of "a step".

         The shape is lifted from the Docs history the author already uses
         (workpaperHistory / scheduleWorkpaperHistory / applyWorkpaperSnapshot /
         stepWorkpaperHistory): one baseline, a past and a future array, a 500ms
         settle so a burst of typing in a card is one step rather than forty,
         buttons disabled from the array lengths, and the same two words when it
         lands. Undo behaves the same in both places because it IS the same. */
      const MAP_HISTORY_DEPTH = 60;
      let mapHistory = null;
      let mapHistoryTimer = null;

      function mapHistorySnapshot() {
        const map = state.map || {};
        return JSON.stringify({
          tiles: map.tiles || {},
          cards: map.cards || [],
          route: map.route || [],
          curated: Boolean(map.curated),
          placed: Boolean(map.placed)
        });
      }

      function mapHistoryFor() {
        if (!mapHistory) mapHistory = { past: [], future: [], baseline: mapHistorySnapshot() };
        return mapHistory;
      }

      /* Opening Present keeps the stacks but re-reads the baseline: the deck can
         have changed while the Map was closed (a diagram deleted in the editor,
         an imported .siren), and a stale baseline would fold those changes into
         the author's next undo. */
      function mapHistoryRebase() {
        const entry = mapHistoryFor();
        entry.baseline = mapHistorySnapshot();
        mapRenderHistoryButtons();
      }

      /* Called after every deck mutation, exactly like scheduleWorkpaperHistory:
         what is pushed is the baseline, i.e. the state BEFORE this edit. */
      function scheduleMapHistory() {
        if (!state.map) return;
        clearTimeout(mapHistoryTimer);
        mapHistoryTimer = setTimeout(() => {
          if (!state.map) return;
          const entry = mapHistoryFor();
          const now = mapHistorySnapshot();
          if (now === entry.baseline) return;
          entry.past.push(entry.baseline);
          if (entry.past.length > MAP_HISTORY_DEPTH) entry.past.shift();
          entry.future.length = 0;
          entry.baseline = now;
          mapRenderHistoryButtons();
        }, 500);
      }

      function mapRenderHistoryButtons() {
        const entry = mapHistory;
        const live = mapBuilding && !readOnlyMode;
        if (el.mapUndoButton) el.mapUndoButton.disabled = !live || !entry || !entry.past.length;
        if (el.mapRedoButton) el.mapRedoButton.disabled = !live || !entry || !entry.future.length;
      }

      function mapApplySnapshot(snapshot) {
        let parsed = null;
        try { parsed = JSON.parse(snapshot); } catch (error) { return false; }
        const clean = sanitizeMapState({ ...state.map, ...parsed });
        // This history belongs to the deck, not to the workspace. A diagram deleted
        // in the editor is gone for good: its tile and every stop that walked it are
        // dropped on the way back in, so undo can restore a route but can never
        // resurrect a diagram - or leave a stop pointing at one that is not there.
        const live = new Set(state.diagrams.map(diagram => diagram.id));
        Object.keys(clean.tiles).forEach(id => { if (!live.has(id)) delete clean.tiles[id]; });
        clean.route = clean.route.filter(view => {
          const target = view.target || {};
          if (target.kind === 'diagram' || target.kind === 'nodes') return live.has(target.diagramId);
          if (target.kind === 'card') return clean.cards.some(card => card.id === target.cardId);
          return true;
        });
        if (!clean.route.length) clean.route = [sanitizeRouteView({ target: { kind: 'map' }, note: '' })];
        state.map.tiles = clean.tiles;
        state.map.cards = clean.cards;
        state.map.route = clean.route;
        state.map.curated = clean.curated;
        state.map.placed = clean.placed;
        return true;
      }

      function mapStepHistory(direction) {
        if (!state.map || readOnlyMode) return;
        clearTimeout(mapHistoryTimer);
        const entry = mapHistoryFor();
        const from = direction < 0 ? entry.past : entry.future;
        const to = direction < 0 ? entry.future : entry.past;
        if (!from.length) { showToast(direction < 0 ? 'Nothing to undo in this presentation.' : 'Nothing to redo.'); return; }
        const current = mapHistorySnapshot();
        const target = from.pop();
        to.push(current);
        entry.baseline = target;
        if (!mapApplySnapshot(target)) return;
        mapRouteIndex = clamp(mapRouteIndex, 0, Math.max(0, state.map.route.length - 1));
        // Everything is re-read from state - and the camera deliberately does not
        // move. Undoing a nudge must not also fly the room somewhere else.
        mapRenderCards();
        mapPlaceObjects();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapUpdateTileDetail();
        mapCollectAssets();
        mapRenderHistoryButtons();
        scheduleSave();
        showToast(direction < 0 ? 'Undone.' : 'Redone.', 'success');
      }

      /* ---------------- chrome ---------------- */

      function mapUpdateChrome() {""",
)

edit(
    "chrome: the buttons tell the truth after every route change",
    """        // The Map moves its camera without broadcasting a stage, so the second
        // screen hangs off the Map's own chrome update instead.
        schedulePresenterRefresh();""",
    """        mapRenderHistoryButtons();
        // The Map moves its camera without broadcasting a stage, so the second
        // screen hangs off the Map's own chrome update instead.
        schedulePresenterRefresh();""",
)

# ---------------------------------------------------------------- 8. history calls at every deck mutation
edit(
    "history: keeping a view",
    """        mapSelectedNodeIds = [];
        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleSave();""",
    """        mapSelectedNodeIds = [];
        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleMapHistory();
        scheduleSave();""",
)

edit(
    "history: adding a card",
    """        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleSave();
        mapRenderCards();""",
    """        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleMapHistory();
        scheduleSave();
        mapRenderCards();""",
)

edit(
    "history: adding a diagram stop",
    """        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapGoToView(mapRouteIndex);""",
    """        mapMarkCurated();
        scheduleUndoSnapshot();
        scheduleMapHistory();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        mapUpdateChrome();
        mapGoToView(mapRouteIndex);""",
)

edit(
    "history: removing a stop",
    """        mapRouteIndex = clamp(mapRouteIndex, 0, state.map.route.length - 1);
        scheduleSave();
        mapGoToView(mapRouteIndex);""",
    """        mapRouteIndex = clamp(mapRouteIndex, 0, state.map.route.length - 1);
        scheduleMapHistory();
        scheduleSave();
        mapGoToView(mapRouteIndex);""",
)

edit(
    "history: deleting a card",
    """            mapCollectAssets();
            scheduleUndoSnapshot();
            scheduleSave();
            if (mapCardEditorEl && mapCardEditorEl.open) mapCardEditorEl.close();""",
    """            mapCollectAssets();
            scheduleUndoSnapshot();
            scheduleMapHistory();
            scheduleSave();
            if (mapCardEditorEl && mapCardEditorEl.open) mapCardEditorEl.close();""",
)

edit(
    "history: reordering by keyboard",
    """        mapRouteIndex = to;
        mapMarkCurated();
        scheduleSave();""",
    """        mapRouteIndex = to;
        mapMarkCurated();
        scheduleMapHistory();
        scheduleSave();""",
)

edit(
    "history: reordering by dragging a chip",
    """            mapRouteIndex = index;
            mapMarkCurated();
            scheduleSave();""",
    """            mapRouteIndex = index;
            mapMarkCurated();
            scheduleMapHistory();
            scheduleSave();""",
)

edit(
    "history: typing in a card",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        scheduleSave();
        if (!mapCardRenderFrame) {""",
    """        card.body = mapCardPlainFromHtml(card.html).slice(0, 8000);
        scheduleMapHistory();
        scheduleSave();
        if (!mapCardRenderFrame) {""",
)

edit(
    "history: committing the card editor",
    """        if (mapCardEditorFresh) scheduleUndoSnapshot();
        mapCardEditorFresh = false;
        scheduleSave();""",
    """        if (mapCardEditorFresh) scheduleUndoSnapshot();
        mapCardEditorFresh = false;
        scheduleMapHistory();
        scheduleSave();""",
)

# ---------------------------------------------------------------- 9. keyboard + mode + open
edit(
    "keys: Ctrl+Z in Build, and Esc puts a dragged object back",
    """      function mapHandleKey(event) {
        if (!mapMode) return false;
        mapShowBar();
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return false;
        if (mapBuilding && event.shiftKey && event.key === 'ArrowRight') { mapMoveView(1); return true; }""",
    """      function mapHandleKey(event) {
        if (!mapMode) return false;
        mapShowBar();
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return false;
        // Escape mid-drag is "put it back", which is what the hint promised. It has
        // to be answered before the Escape further down, which pulls the camera out.
        if (event.key === 'Escape' && mapPointerState && mapPointerState.drag && mapPointerState.drag.started) {
          mapDragCancel(mapPointerState.drag);
          return true;
        }
        // The deck's undo, on the keys everyone already presses, and only while
        // Build is open. stopPropagation matters: handlePresentationKeydown is a
        // CAPTURING listener, so without it the same Ctrl+Z would carry on to
        // handleGlobalKeydown and undo the Mermaid source underneath the deck.
        if (mapBuilding && (event.ctrlKey || event.metaKey) && !event.altKey) {
          const combo = String(event.key || '').toLowerCase();
          if (combo === 'z') { event.stopPropagation(); mapStepHistory(event.shiftKey ? 1 : -1); return true; }
          if (combo === 'y' && !event.shiftKey) { event.stopPropagation(); mapStepHistory(1); return true; }
        }
        if (mapBuilding && event.shiftKey && event.key === 'ArrowRight') { mapMoveView(1); return true; }""",
)

edit(
    "build: the buttons follow the mode, and a drag never survives it",
    """        if (el.mapFocusRing) el.mapFocusRing.hidden = !mapBuilding;""",
    """        if (el.mapFocusRing) el.mapFocusRing.hidden = !mapBuilding;
        // Undo is an authoring verb: it is live in Build and honestly dead outside it.
        mapRenderHistoryButtons();
        // Leaving the mode with a finger still down would leave a rectangle glued to
        // the pointer with nothing left to drop it.
        if (!mapBuilding && mapPointerState && mapPointerState.drag) {
          if (mapPointerState.drag.started) mapDragCancel(mapPointerState.drag);
          mapPointerState.drag = null;
        }""",
)

edit(
    "open: rebase the history on the deck as it stands",
    """        layoutMap(false);
        mapSeedRoute();""",
    """        layoutMap(false);
        mapSeedRoute();
        mapHistoryRebase();""",
)

# ---------------------------------------------------------------- 10. the shortcuts dialog
edit(
    "keys dialog: say the two new things",
    """<kbd>E</kbd> Build - add, reorder and remove slides (<kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> moves the current stop)""",
    """<kbd>E</kbd> Build - add, reorder and remove slides (<kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> moves the current stop; drag a slide or a diagram to move it on the plane, <kbd>Esc</kbd> puts it back, <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes and <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes)""",
)


def main():
    if len(sys.argv) != 2:
        print("usage: python fix_present_dragundo.py <target.html>")
        return 2
    path = sys.argv[1]
    with io.open(path, encoding="utf-8", newline="") as handle:
        text = handle.read()
    original = text

    problems = []
    for name, old, new in EDITS:
        hits = text.count(old)
        if hits != 1:
            problems.append("  %-58s found %d times (need 1)" % (name, hits))
            continue
        text = text.replace(old, new, 1)

    if problems:
        print("ABORT - the file has drifted from the anchors. Nothing was written.")
        for line in problems:
            print(line)
        return 1

    if text == original:
        print("ABORT - no change produced. Nothing was written.")
        return 1

    # Cheap sanity: everything the new code calls must exist exactly once as a
    # declaration, and the two buttons must exist exactly once in the markup.
    checks = [
        ("function mapDragTargetFor(", 1),
        ("function mapDragMove(", 1),
        ("function mapDragEnd(", 1),
        ("function mapDragCancel(", 1),
        ("function mapPlaceObjects(", 1),
        ("function scheduleMapHistory(", 1),
        ("function mapStepHistory(", 1),
        ("function mapApplySnapshot(", 1),
        ("function mapRenderHistoryButtons(", 1),
        ('id="mapUndoButton"', 1),
        ('id="mapRedoButton"', 1),
    ]
    bad = ["  %-40s %d (need %d)" % (needle, text.count(needle), want)
           for needle, want in checks if text.count(needle) != want]
    if bad:
        print("ABORT - sanity pass failed. Nothing was written.")
        for line in bad:
            print(line)
        return 1
    # scheduleMapHistory is called from ten places plus its own declaration.
    calls = text.count("scheduleMapHistory()")
    if calls < 11:
        print("ABORT - scheduleMapHistory is wired %d times, expected at least 11." % calls)
        return 1

    folder = os.path.dirname(os.path.abspath(path))
    handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="",
                                         dir=folder, suffix=".tmp", delete=False)
    try:
        handle.write(text)
        handle.close()
        os.replace(handle.name, path)
    except Exception:
        try:
            os.unlink(handle.name)
        except OSError:
            pass
        raise

    print("OK  %s" % path)
    print("    %d edits, %d -> %d chars" % (len(EDITS), len(original), len(text)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
