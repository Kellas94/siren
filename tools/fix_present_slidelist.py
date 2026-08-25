#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
fix_present_slidelist.py  —  usage:  python fix_present_slidelist.py <target.html>

THE OWNER'S WORDS
  "Sa ai optiunea sa vezi slides astea si pe verticala intr-o lista sa poti le vezi
   mai usor si sa ai bara de search"        ... and, explicitly:
  "se pot pastra ambele view-uri sa foloseasca fiecare cum vrea"

SO: not a replacement for the chip strip - a SECOND RENDERING of the same deck.
One deck (state.map.route), two dresses:

  * the strip   - chips along the bottom, what he presents from today
  * the rail    - a vertical, searchable list down the right side

Same container (#mapRoute), same builder (mapRenderRoute), same move
(mapReorderRoute).  There is no second list and no second model, so the two
renderings cannot drift apart, and a third view would cost nothing.

WHY NOT THE STUDIO NAVIGATOR (the brief asked the question):
  #presentSequenceList is a vertical searchable list already - of BLOCKS INSIDE ONE
  DIAGRAM (presentSequence: node / chapter / section / overview entries), and it lives
  in #presentBody, which mapSetMode() HIDES the whole time the Map is up.  The deck the
  owner means is state.map.route, which only exists on the Map.  Extending the Navigator
  would have meant teaching it a second, unrelated model and showing it on a surface it
  is not on.  The honest home for the deck's second view is the deck's own container -
  so that is where it went, and the Navigator was left alone.

THE CHOICE PERSISTS: state.map.settings.routeView ('strip' | 'list'), which rides the
existing sanitizeMapState/IndexedDB path and .siren export for free.

WIDTH: the rail does NOT cover the plane.  mapMeasureChrome() measures it into a new
mapChromeSide reserve exactly the way the bottom band is already measured into
mapChromeReserve, and mapViewport() subtracts it - so the camera, the wheel zoom and the
pointer all agree that the stage is now narrower, nothing hides underneath, and
switching back to the strip hands the width straight back.

Anchor-guarded: every edit is matched exactly once against the text it expects.
Any drift and the script ABORTS WITHOUT WRITING A SINGLE BYTE.
"""

import io
import os
import sys
import hashlib

EDITS = []


def edit(name, old, new):
    EDITS.append((name, old, new))


# ---------------------------------------------------------------- 1. markup
edit(
    "markup: #mapRoute gains a head (view switch + search) and an items box",
    """        <div class="map-route" id="mapRoute"></div>
""",
    """        <!-- One deck, two renderings.  The chips along the bottom and the searchable
             rail down the side are the same container, the same builder and the same
             move, so they can never disagree about what the deck is.  data-view says
             which dress is on; state.map.settings.routeView remembers it. -->
        <div class="map-route" id="mapRoute" data-view="strip">
          <div class="map-route-head" id="mapRouteHead">
            <button class="btn ghost compact" id="mapRouteViewButton" type="button" aria-pressed="false" title="See the slides as a searchable list down the side">☰ List</button>
            <span class="map-route-find">
              <input id="mapRouteSearch" type="text" autocomplete="off" placeholder="Search the slides…" aria-label="Search the slides by title, notes and card text" />
              <button class="btn ghost compact" id="mapRouteClear" type="button" title="Clear the search" aria-label="Clear the search" hidden>×</button>
            </span>
            <span class="map-route-count" id="mapRouteCount" aria-live="polite"></span>
          </div>
          <div class="map-route-items" id="mapRouteItems" role="list" aria-label="Presentation slides"></div>
        </div>
""",
)

# ---------------------------------------------------------------- 2. CSS
edit(
    "css: the rail, the head, and the chrome that has to centre on what is left",
    """    .map-route-drop:hover, .map-route-drop:focus-visible { opacity: 1; color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, transparent); }
""",
    """    .map-route-drop:hover, .map-route-drop:focus-visible { opacity: 1; color: var(--danger); background: color-mix(in srgb, var(--danger) 16%, transparent); }
    /* ================= the deck, second rendering =================
       Read the slides down the side, in a list you can search, WITHOUT losing the
       strip you present from.  One deck, two dresses; the dress is all that changes
       below.  The rail takes its width off the stage rather than covering it
       (mapChromeSide), so nothing on the plane ever hides underneath it and switching
       back gives the width straight back. */
    .map-layer { --map-rail-w: 0px; }
    .map-layer[data-route-view="list"] { --map-rail-w: min(300px, 30vw); }
    /* The container scrolls nothing now - the items box does, on whichever axis it is. */
    .map-route { overflow: hidden; }
    .map-route-head { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto; min-width: 0; }
    .map-route-items {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1 1 auto;
      min-width: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      padding: 2px 0;
    }
    .map-route.is-building .map-route-items { gap: 16px; }
    /* Finding a slide is what the list is for; the strip stays the presenting dress. */
    .map-route-find, .map-route-count { display: none; }
    /* The pressed dress is the Studio's own (#presentEditSequenceButton): a filled pill,
       not accent ink on the panel - accent-on-panel measures 3.46:1 in the dark theme,
       under the 4.5:1 floor. Hover darkens the fill rather than lightening it, by the
       12% that keeps the LIGHT theme's dark ink over 4.5:1 on the darkened pill (20%
       measured 4.35:1 there). Measured, both themes. */
    #mapRouteViewButton[aria-pressed="true"] {
      background: var(--pill-bg);
      color: var(--pill-text);
      border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
    }
    #mapRouteViewButton[aria-pressed="true"]:hover,
    #mapRouteViewButton[aria-pressed="true"]:focus-visible {
      background: color-mix(in srgb, var(--pill-bg) 88%, #000);
      border-color: var(--primary);
    }
    /* No dimming on either of these: both are information, and .8 / .7 alpha measured
       3.69:1 and 4.55:1 in the light theme - under the 4.5:1 floor. At full ink they
       measure exactly what the row name measures. */
    .map-route-kind { flex: 0 0 auto; font-size: 13px; }
    .map-route-empty { margin: 8px 4px; color: var(--muted); font-size: 12.5px; line-height: 1.4; }
    /* Rows are the tab stop now (roving tabindex, exactly as the Studio step list). */
    .map-route-item:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
    .map-route[data-view="list"] {
      left: auto;
      right: 0;
      top: 0;
      bottom: 0;
      width: var(--map-rail-w);
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 12px 10px;
      border-top: 0;
      border-left: 1px solid var(--border);
    }
    .map-route[data-view="list"].is-building { gap: 8px; padding-top: 12px; padding-bottom: 12px; }
    .map-route[data-view="list"] .map-route-head { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 8px; align-items: center; }
    .map-route[data-view="list"] .map-route-find { display: inline-flex; align-items: center; gap: 4px; min-width: 0; }
    .map-route[data-view="list"] .map-route-count {
      display: block;
      grid-column: 1 / -1;
      color: var(--subtle);
      font-size: 11.5px;
      font-variant-numeric: tabular-nums;
    }
    .map-route-find input { flex: 1 1 auto; min-width: 0; width: 100%; min-height: 32px; padding: 6px 8px; font-size: 12.5px; }
    .map-route[data-view="list"] .map-route-items {
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 0 2px 2px 0;
    }
    .map-route[data-view="list"].is-building .map-route-items { gap: 8px; }
    .map-route[data-view="list"] .map-route-item { max-width: none; width: 100%; border-radius: 12px; padding: 4px 6px; }
    .map-route[data-view="list"] .map-route-number { opacity: 1; }
    /* Removing a slide is the one irreversible edit here, and the rail is where the
       author READS the deck - so the × keeps the Studio step list's manners: out of the
       way until the row is under the pointer, under focus, or the deck is in Build.
       At full ink it measures what the row name measures; at .55 it measured 3.42:1. */
    .map-route[data-view="list"] .map-route-drop { opacity: 0; pointer-events: none; }
    .map-route[data-view="list"] .map-route-item:hover .map-route-drop,
    .map-route[data-view="list"] .map-route-item:focus-within .map-route-drop,
    .map-route[data-view="list"].is-building .map-route-drop { opacity: 1; pointer-events: auto; }
    .map-route[data-view="list"] .map-route-item:hover { border-color: var(--border-strong); }
    .map-route[data-view="list"] .map-route-go {
      flex: 1 1 auto;
      max-width: none;
      min-height: 44px;
      justify-content: flex-start;
      text-align: left;
      font-size: 12.5px;
    }
    /* A 300px rail can afford two lines, so the name stops being an ellipsis. */
    .map-route[data-view="list"] .map-route-label {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.3;
    }
    /* The rail is wide enough to show what each slide IS, so it always does - the
       strip keeps its compact pills until Build turns it into a slide sorter. */
    .map-route[data-view="list"] .map-route-thumb {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 68px;
      height: 42px;
      flex: 0 0 auto;
      border-radius: 7px;
      border: 1px solid var(--border);
      background: var(--panel-bg);
      overflow: hidden;
      font-size: 15px;
      color: var(--muted);
    }
    .map-route[data-view="list"] .map-route-thumb img { width: 100%; height: 100%; object-fit: contain; }
    .map-route[data-view="list"] .map-route-thumb.is-card { flex-direction: column; gap: 2px; font-size: 12px; font-weight: 800; }
    .map-route[data-view="list"] .map-route-thumb.is-card::before { content: ''; width: 66%; height: 4px; border-radius: 2px; background: var(--primary); }
    /* New slides still land after the current one; in the rail the marker moves
       inside the row, because a vertical list clips what hangs off its edge. */
    .map-route[data-view="list"].is-building .map-route-item.is-current::after {
      right: 5px;
      top: auto;
      bottom: 0;
      transform: none;
      font-size: 11px;
    }
    /* The rail stands BESIDE the stage, not over it, so the presenter chrome centres
       on what is left - the same free area mapViewport() hands the camera. */
    .map-layer[data-route-view="list"] .map-bar,
    .map-layer[data-route-view="list"] .map-hint { transform: translateX(calc(-50% - var(--map-rail-w) / 2)); }
    .map-layer[data-route-view="list"] .map-bar { max-width: calc(100vw - var(--map-rail-w) - 24px); }
    .map-layer[data-route-view="list"] .map-panel,
    .map-layer[data-route-view="list"] .map-focus-ring { right: calc(var(--map-rail-w) + 16px); }
""",
)

# ---------------------------------------------------------------- 3. element cache
edit(
    "cacheElements: the five new ids",
    "'mapRoute','presentDimButton'",
    "'mapRoute','mapRouteHead','mapRouteItems','mapRouteViewButton','mapRouteSearch','mapRouteClear','mapRouteCount','presentDimButton'",
)

# ---------------------------------------------------------------- 4/5. the setting
edit(
    "sanitizeMapState: settings.routeView, so the choice survives a reload",
    """            loop: Boolean(settings.loop),
            hold: clamp(Number(settings.hold) || 8, 1, 900)
          }""",
    """            loop: Boolean(settings.loop),
            hold: clamp(Number(settings.hold) || 8, 1, 900),
            // Which rendering of the deck the author last chose. Both are kept; this
            // only says which one Present opens in.
            routeView: settings.routeView === 'list' ? 'list' : 'strip'
          }""",
)

edit(
    "makeDefaultMapState: a new workspace opens on the strip",
    "return { tiles: {}, cards: [], route: [], curated: false, settings: { speed: 'smooth', arc: true, loop: false, hold: 8 } };",
    "return { tiles: {}, cards: [], route: [], curated: false, settings: { speed: 'smooth', arc: true, loop: false, hold: 8, routeView: 'strip' } };",
)

# ---------------------------------------------------------------- 6. chrome reserve
edit(
    "mapMeasureChrome: the rail takes width the way the strip takes height",
    """      let mapChromeReserve = 0;

      function mapMeasureChrome() {
        const host = el.mapLayer;
        if (!host) { mapChromeReserve = 0; return; }
        const box = host.getBoundingClientRect();
        const chromeTop = element => {
          if (!element || !element.offsetHeight) return box.bottom;
          const rect = element.getBoundingClientRect();
          return rect.height ? rect.top : box.bottom;
        };
        mapChromeReserve = Math.max(0, box.bottom - Math.min(chromeTop(el.mapBar), chromeTop(el.mapRoute)));
      }
""",
    """      let mapChromeReserve = 0;
      /* In the list rendering the deck stands down the side instead of lying along the
         bottom, so it takes width off the stage instead of height. Measured the same
         way, spent through the same mapViewport - which is what keeps the camera, the
         wheel zoom and the pointer agreeing about where the middle of the room is. */
      let mapChromeSide = 0;

      function mapMeasureChrome() {
        const host = el.mapLayer;
        if (!host) { mapChromeReserve = 0; mapChromeSide = 0; return; }
        const box = host.getBoundingClientRect();
        const listing = mapRouteView() === 'list';
        const chromeTop = element => {
          if (!element || !element.offsetHeight) return box.bottom;
          const rect = element.getBoundingClientRect();
          return rect.height ? rect.top : box.bottom;
        };
        const railLeft = listing && el.mapRoute && el.mapRoute.offsetWidth
          ? el.mapRoute.getBoundingClientRect().left
          : box.right;
        mapChromeSide = Math.max(0, box.right - railLeft);
        // A full-height rail would otherwise read as chrome covering the whole screen.
        mapChromeReserve = Math.max(0, box.bottom - Math.min(chromeTop(el.mapBar), listing ? box.bottom : chromeTop(el.mapRoute)));
      }
""",
)

edit(
    "mapViewport: spend the side reserve",
    "        return { w: Math.max(320, box.width), h: Math.max(240, box.height - mapChromeReserve - 24) };",
    "        return { w: Math.max(320, box.width - mapChromeSide), h: Math.max(240, box.height - mapChromeReserve - 24) };",
)

# ---------------------------------------------------------------- 7. the builder
edit(
    "mapRenderRoute: one builder, two dresses, plus search, roving focus and the shared move",
    """      function mapRenderRoute() {
        if (!el.mapRoute) return;
        el.mapRoute.classList.toggle('is-building', mapBuilding);
        el.mapRoute.replaceChildren();
        (state.map.route || []).forEach((view, index) => {
          const name = mapViewLabel(view);
          // A chip holds two different actions - go there, and take it out of the route - so
          // it is a group of two buttons rather than one button with a span inside it.
          const item = document.createElement('span');
          item.className = 'map-route-item' + (index === mapRouteIndex ? ' is-current' : '');
          item.draggable = true;
          item.dataset.index = String(index);
          const go = document.createElement('button');
          go.type = 'button';
          go.className = 'map-route-go';
          go.setAttribute('aria-label', `Go to stop ${index + 1}, ${name}`);
          const number = document.createElement('span');
          number.className = 'map-route-number';
          number.textContent = String(index + 1);
          const label = document.createElement('span');
          label.className = 'map-route-label';
          label.textContent = name;
          go.append(number, label);
          if (mapBuilding) go.prepend(mapChipThumb(view));
          const drop = document.createElement('button');
          drop.type = 'button';
          drop.className = 'map-route-drop';
          drop.textContent = '×';
          drop.title = `Remove ${name} from the route`;
          drop.setAttribute('aria-label', `Remove ${name} from the route`);
          drop.addEventListener('click', event => {
            event.stopPropagation();
            mapRequestDeleteView(index);
          });
          item.append(go, drop);
          item.title = view.note ? view.note.slice(0, 200) : name;
          go.addEventListener('click', () => mapGoToView(index));
          item.addEventListener('dragstart', event => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          });
          item.addEventListener('dragover', event => { event.preventDefault(); item.classList.add('is-drop'); });
          item.addEventListener('dragleave', () => item.classList.remove('is-drop'));
          item.addEventListener('drop', event => {
            event.preventDefault();
            item.classList.remove('is-drop');
            const from = Number(event.dataTransfer.getData('text/plain'));
            if (!Number.isInteger(from) || from === index) return;
            const route = state.map.route;
            const [moved] = route.splice(from, 1);
            route.splice(index, 0, moved);
            mapRouteIndex = index;
            mapMarkCurated();
            scheduleSave();
            mapRenderRoute();
            mapRenderThread();
            // The moved chip is now the current stop; the bar must say so.
            mapUpdateChrome();
          });
          el.mapRoute.appendChild(item);
        });
      }
""",
    """      /* ---------------- the deck: one model, two renderings ----------------
         The strip along the bottom and the searchable rail down the side are the same
         container, the same builder and the same move. Anything that changes the deck
         changes both, because there is only one of everything. */

      function mapRouteView() {
        return state.map && state.map.settings && state.map.settings.routeView === 'list' ? 'list' : 'strip';
      }

      function mapRouteQuery() {
        if (mapRouteView() !== 'list' || !el.mapRouteSearch) return '';
        return String(el.mapRouteSearch.value || '').trim().toLocaleLowerCase();
      }

      /* What the search reads: the name the chip already shows, this stop's speaker
         notes, and - for a content slide - everything the author typed into it, table
         cells included. Finding a slide by a word inside its body is the whole point. */
      function mapRouteSearchText(view) {
        const target = (view && view.target) || {};
        const parts = [mapViewLabel(view), (view && view.note) || ''];
        if (target.kind === 'card') {
          const card = ((state.map && state.map.cards) || []).find(entry => entry.id === target.cardId);
          if (card) {
            const kind = MAP_CARD_KINDS.find(row => row[0] === card.kind);
            parts.push(card.eyebrow, card.title, card.body, card.url, kind ? kind[1] : '');
            (card.rows || []).forEach(row => parts.push((row || []).join(' ')));
          }
        } else if (target.kind === 'nodes') {
          parts.push((target.nodeIds || []).join(' '));
        }
        return parts.join(' · ').toLocaleLowerCase();
      }

      function mapRouteRows() {
        return el.mapRouteItems ? Array.from(el.mapRouteItems.querySelectorAll('.map-route-item')) : [];
      }

      /* One tab stop for the whole deck and the arrows walk it - the model the Studio's
         step list already teaches, so it is learned once and used in both lists.
         Re-queried every time: going to a slide rebuilds the list, so the row that was
         under the finger is a detached node by the time focus moves. */
      function mapFocusRouteRow(at) {
        const rows = mapRouteRows();
        if (!rows.length) return;
        const row = rows[clamp(at, 0, rows.length - 1)];
        if (!row) return;
        rows.forEach(item => { item.tabIndex = item === row ? 0 : -1; });
        row.focus();
        row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }

      function mapFocusRouteIndex(index) {
        const at = mapRouteRows().findIndex(row => Number(row.dataset.index) === index);
        if (at >= 0) mapFocusRouteRow(at);
      }

      /* One move, whoever asked for it: a chip dragged along the strip, a row dragged
         down the rail, Shift+arrows on either, or anything added later. Views come and
         go; the move lives here, so a new view costs nothing to keep in step. */
      function mapReorderRoute(from, to) {
        const route = (state.map && state.map.route) || [];
        if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
        if (from === to || from < 0 || to < 0 || from >= route.length || to >= route.length) return false;
        const [moved] = route.splice(from, 1);
        route.splice(to, 0, moved);
        mapRouteIndex = to;
        mapMarkCurated();
        scheduleSave();
        mapRenderRoute();
        mapRenderThread();
        // The moved slide is now the current stop; the bar must say so.
        mapUpdateChrome();
        return true;
      }

      /* The author's choice, not a mode: it lives in state.map.settings, so it survives
         a reload, an export and a re-import, and Present opens in the rendering they
         left. Both renderings stay; this only says which one is on. */
      function mapSetRouteView(mode, options = {}) {
        if (!state.map) return;
        const listing = mode === 'list';
        if (!state.map.settings || typeof state.map.settings !== 'object') state.map.settings = {};
        state.map.settings.routeView = listing ? 'list' : 'strip';
        if (el.mapLayer) el.mapLayer.dataset.routeView = listing ? 'list' : 'strip';
        if (el.mapRoute) el.mapRoute.dataset.view = listing ? 'list' : 'strip';
        if (el.mapRouteViewButton) {
          el.mapRouteViewButton.setAttribute('aria-pressed', String(listing));
          el.mapRouteViewButton.title = listing
            ? 'Lay the slides back along the bottom of the screen'
            : 'See the slides as a searchable list down the side';
        }
        // A filter is a way of looking, not a way of presenting: leaving the list drops it.
        if (!listing && el.mapRouteSearch) el.mapRouteSearch.value = '';
        mapRenderRoute();
        // The rail takes its width off the stage rather than covering it, so the camera
        // has to be told the room changed shape.
        mapMeasureChrome();
        if (options.save !== false) scheduleSave();
        if (options.reframe !== false && mapMode) mapGoToView(mapRouteIndex, { instant: false });
      }

      function mapRenderRoute() {
        if (!el.mapRoute || !el.mapRouteItems) return;
        const listing = mapRouteView() === 'list';
        const query = mapRouteQuery();
        const route = (state.map && state.map.route) || [];
        el.mapRoute.classList.toggle('is-building', mapBuilding);
        el.mapRouteItems.replaceChildren();
        let shown = 0;
        route.forEach((view, index) => {
          // The numbers stay the deck's real positions, so a filtered list never lies
          // about where a slide is.
          if (query && !mapRouteSearchText(view).includes(query)) return;
          shown += 1;
          const name = mapViewLabel(view);
          const target = view.target || {};
          const card = target.kind === 'card'
            ? ((state.map && state.map.cards) || []).find(entry => entry.id === target.cardId)
            : null;
          const kind = card ? MAP_CARD_KINDS.find(row => row[0] === card.kind) : null;
          const what = kind ? `${name}, ${kind[1]} slide` : name;
          // A chip holds two different actions - go there, and take it out of the route - so
          // it is a group of two buttons rather than one button with a span inside it.
          const item = document.createElement('span');
          item.className = 'map-route-item' + (index === mapRouteIndex ? ' is-current' : '');
          // Dragging a filtered list would drop a slide at a position nobody can see, so
          // while the search is narrowing the deck the rows sit still.
          item.draggable = !query;
          item.dataset.index = String(index);
          // The row is the tab stop and the arrows walk it, so a forty-slide deck costs
          // one tab stop rather than eighty.
          item.setAttribute('role', 'listitem');
          item.tabIndex = index === mapRouteIndex ? 0 : -1;
          if (index === mapRouteIndex) item.setAttribute('aria-current', 'true');
          item.setAttribute('aria-label', `Slide ${index + 1} of ${route.length}: ${what}`);
          const go = document.createElement('button');
          go.type = 'button';
          go.className = 'map-route-go';
          go.tabIndex = -1;
          go.setAttribute('aria-label', `Go to slide ${index + 1}, ${what}`);
          const number = document.createElement('span');
          number.className = 'map-route-number';
          number.textContent = String(index + 1);
          const label = document.createElement('span');
          label.className = 'map-route-label';
          label.textContent = name;
          // Built only where it is shown: a hidden data-URI thumbnail per stop is a
          // decode nobody asked for.
          if (mapBuilding || listing) go.appendChild(mapChipThumb(view));
          go.append(number, label);
          if (listing && kind) {
            const glyph = document.createElement('span');
            glyph.className = 'map-route-kind';
            glyph.textContent = kind[2];
            glyph.title = `${kind[1]} slide`;
            glyph.setAttribute('aria-hidden', 'true');
            go.appendChild(glyph);
          }
          const drop = document.createElement('button');
          drop.type = 'button';
          drop.className = 'map-route-drop';
          drop.tabIndex = -1;
          drop.textContent = '×';
          drop.title = `Remove ${name} from the route`;
          drop.setAttribute('aria-label', `Remove ${name} from the route`);
          drop.addEventListener('click', event => {
            event.stopPropagation();
            mapRequestDeleteView(index);
          });
          item.append(go, drop);
          item.title = view.note ? view.note.slice(0, 200) : name;
          go.addEventListener('click', event => {
            mapGoToView(index);
            // Enter on the button rebuilds the list under the finger; put focus back on
            // the row it belongs to. A mouse click carries detail > 0.
            if (!event.detail) requestAnimationFrame(() => mapFocusRouteIndex(index));
          });
          item.addEventListener('dragstart', event => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          });
          item.addEventListener('dragover', event => { event.preventDefault(); item.classList.add('is-drop'); });
          item.addEventListener('dragleave', () => item.classList.remove('is-drop'));
          item.addEventListener('drop', event => {
            event.preventDefault();
            item.classList.remove('is-drop');
            mapReorderRoute(Number(event.dataTransfer.getData('text/plain')), index);
          });
          el.mapRouteItems.appendChild(item);
        });
        if (query && !shown) {
          const empty = document.createElement('p');
          empty.className = 'map-route-empty';
          empty.textContent = `No slide matches “${query}”. The search reads slide names, speaker notes and the text inside content slides.`;
          el.mapRouteItems.appendChild(empty);
        }
        // With the current stop filtered out nothing would carry the tab stop and the
        // whole deck would be unreachable from the keyboard.
        if (!el.mapRouteItems.querySelector('.map-route-item[tabindex="0"]')) {
          el.mapRouteItems.querySelector('.map-route-item')?.setAttribute('tabindex', '0');
        }
        if (el.mapRouteCount) {
          el.mapRouteCount.textContent = query
            ? `${shown} of ${route.length} slides`
            : `${route.length} slide${route.length === 1 ? '' : 's'}`;
        }
        if (el.mapRouteClear) el.mapRouteClear.hidden = !(el.mapRouteSearch && el.mapRouteSearch.value);
        requestAnimationFrame(() => el.mapRouteItems.querySelector('.map-route-item.is-current')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      }

      /* The deck's keyboard model, one for both renderings and the same one the Studio's
         step list already teaches: the arrows walk the deck whichever way it is laid
         out, Enter goes to the slide, Delete asks the question the × asks, and
         Shift+arrow moves the slide. */
      function mapRouteKeydown(event) {
        if (el.mapRouteSearch && event.target === el.mapRouteSearch) {
          if (event.key === 'Escape') {
            event.preventDefault();
            if (el.mapRouteSearch.value) { el.mapRouteSearch.value = ''; mapRenderRoute(); }
            else if (el.mapLayer) el.mapLayer.focus();
          } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
            // Straight from the query into the results, the way every search box behaves.
            event.preventDefault();
            mapFocusRouteRow(0);
          }
          return;
        }
        const row = event.target.closest ? event.target.closest('.map-route-item') : null;
        if (!row) return;
        const rows = mapRouteRows();
        const at = rows.indexOf(row);
        const index = Number(row.dataset.index);
        if (at < 0 || !Number.isInteger(index)) return;
        const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft';
        const on = event.key === 'ArrowDown' || event.key === 'ArrowRight';
        if ((back || on) && event.shiftKey) {
          event.preventDefault();
          const to = index + (on ? 1 : -1);
          if (mapReorderRoute(index, to)) requestAnimationFrame(() => mapFocusRouteIndex(to));
          return;
        }
        if (back || on) { event.preventDefault(); mapFocusRouteRow(at + (on ? 1 : -1)); return; }
        if (event.key === 'Home') { event.preventDefault(); mapFocusRouteRow(0); return; }
        if (event.key === 'End') { event.preventDefault(); mapFocusRouteRow(rows.length - 1); return; }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); mapRequestDeleteView(index); return; }
        // One Escape leaves the list; the next one is the Map's own Escape again.
        if (event.key === 'Escape') { event.preventDefault(); if (el.mapLayer) el.mapLayer.focus(); return; }
        // Focus is on one of the row's own buttons: let the button answer its own key.
        if (event.target !== row) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          mapGoToView(index);
          requestAnimationFrame(() => mapFocusRouteIndex(index));
        }
      }
""",
)

# ---------------------------------------------------------------- 8. keyboard twin
edit(
    "mapMoveView: routed through the one shared move",
    """      /* Keyboard twin of dragging a chip: Shift+arrows move the current stop. */
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
""",
    """      /* Keyboard twin of dragging a chip: Shift+arrows move the current stop. Same
         move as the drag and as Shift+arrow inside the list - mapReorderRoute is the
         only place a slide changes position. */
      function mapMoveView(delta) {
        mapReorderRoute(mapRouteIndex, mapRouteIndex + delta);
      }
""",
)

# ---------------------------------------------------------------- 9. mapOpen
edit(
    "mapOpen: open in the rendering the author left, with a clean search",
    """        if (el.mapPlane) el.mapPlane.replaceChildren(el.mapThread);
        mapRouteIndex = 0;
        mapToggleRecording(false);""",
    """        if (el.mapPlane) el.mapPlane.replaceChildren(el.mapThread);
        mapRouteIndex = 0;
        // The rendering is the author's saved choice; the filter is not - nobody wants
        // to open Present onto a deck that is still narrowed to one word.
        if (el.mapRouteSearch) el.mapRouteSearch.value = '';
        mapSetRouteView(mapRouteView(), { save: false, reframe: false });
        mapToggleRecording(false);""",
)

# ---------------------------------------------------------------- 10. wiring
edit(
    "wiring: the view switch, the search, the clear and the list's keyboard",
    """        if (el.mapExportButton) el.mapExportButton.addEventListener('click', () => mapExportRoute('pdf'));
""",
    """        if (el.mapExportButton) el.mapExportButton.addEventListener('click', () => mapExportRoute('pdf'));
        // The deck's own view switch, on the deck: one press swaps the strip for the
        // searchable rail and back, and the choice is saved with the workspace.
        if (el.mapRouteViewButton) el.mapRouteViewButton.addEventListener('click', () => {
          mapSetRouteView(mapRouteView() === 'list' ? 'strip' : 'list');
        });
        if (el.mapRouteSearch) el.mapRouteSearch.addEventListener('input', () => mapRenderRoute());
        if (el.mapRouteClear) el.mapRouteClear.addEventListener('click', () => {
          if (!el.mapRouteSearch) return;
          el.mapRouteSearch.value = '';
          mapRenderRoute();
          el.mapRouteSearch.focus();
        });
        if (el.mapRoute) el.mapRoute.addEventListener('keydown', mapRouteKeydown);
""",
)

# ---------------------------------------------------------------- 11. key bail-out
edit(
    "handlePresentationKeydown: the deck list owns its own keys",
    """        const target=event.target;
""",
    """        const target=event.target;
        // The deck's list runs the same roving-focus model the step list runs, and its
        // search box is a text field. Neither may hand the Map's arrows, letters or
        // Home away while the author is standing inside it.
        if (target instanceof Element && target.closest('.map-route')) return;
""",
)

# ---------------------------------------------------------------- 12. keyboard help
edit(
    "keyboard help: the list's keys, next to the step list's",
    """          <div class="guide-callout"><strong>In the Studio step list:</strong> <kbd>↑</kbd>/<kbd>↓</kbd> move between steps · <kbd>Home</kbd>/<kbd>End</kbd> jump to either end · <kbd>Enter</kbd> presents the step you are on · <kbd>→</kbd> reaches that step’s edit buttons and <kbd>←</kbd> comes back.</div>
""",
    """          <div class="guide-callout"><strong>In the Studio step list:</strong> <kbd>↑</kbd>/<kbd>↓</kbd> move between steps · <kbd>Home</kbd>/<kbd>End</kbd> jump to either end · <kbd>Enter</kbd> presents the step you are on · <kbd>→</kbd> reaches that step’s edit buttons and <kbd>←</kbd> comes back.</div>
          <div class="guide-callout"><strong>In the slide list</strong> (☰ List, on the deck): <kbd>↑</kbd>/<kbd>↓</kbd> walk the deck · <kbd>Enter</kbd> goes to that slide · <kbd>Delete</kbd> takes it out · <kbd>Shift</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> moves it · <kbd>Esc</kbd> steps back out of the list.</div>
""",
)


# ---------------------------------------------------------------- sanity pass
def sanity(text):
    """Cheap structural checks on the patched text. Any failure aborts the write."""
    problems = []
    must_have = [
        ('id="mapRouteItems"', 1),
        ('id="mapRouteSearch"', 1),
        ('id="mapRouteViewButton"', 1),
        ("function mapSetRouteView(", 1),
        ("function mapReorderRoute(", 1),
        ("function mapRouteSearchText(", 1),
        ("function mapRouteKeydown(", 1),
        ("let mapChromeSide = 0;", 1),
    ]
    for needle, want in must_have:
        got = text.count(needle)
        if got != want:
            problems.append("expected %d x %r, found %d" % (want, needle, got))
    # The old builder must be gone, and nothing may write children straight onto the
    # container any more - that is what would silently delete the head.
    if "el.mapRoute.replaceChildren()" in text:
        problems.append("the old container-level replaceChildren() survived")
    if "el.mapRoute.appendChild(item)" in text:
        problems.append("an item is still appended to the container instead of the items box")
    # Exactly one place moves a slide.
    if text.count("route.splice(to, 0, moved)") != 1:
        problems.append("more than one reorder path survived")
    return problems


def main():
    if len(sys.argv) != 2:
        sys.stderr.write("usage: python fix_present_slidelist.py <target.html>\n")
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        sys.stderr.write("ABORT: no such file: %s\n" % target)
        return 1

    with io.open(target, "r", encoding="utf-8", newline="") as fh:
        original = fh.read()

    before = hashlib.md5(original.encode("utf-8")).hexdigest()
    text = original
    for name, old, new in EDITS:
        found = text.count(old)
        if found != 1:
            sys.stderr.write(
                "ABORT: anchor drift on edit %r - expected exactly 1 match, found %d.\n"
                "       Nothing was written; %s is byte-unchanged (md5 %s).\n"
                % (name, found, target, before)
            )
            return 1
        text = text.replace(old, new, 1)
        sys.stdout.write("  ok  %s\n" % name)

    problems = sanity(text)
    if problems:
        sys.stderr.write("ABORT: sanity pass failed, nothing written:\n")
        for line in problems:
            sys.stderr.write("       - %s\n" % line)
        return 1

    tmp = target + ".slidelist.tmp"
    with io.open(tmp, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    os.replace(tmp, target)
    sys.stdout.write(
        "\nwrote %s\n  %d -> %d chars\n  md5 %s -> %s\n"
        % (target, len(original), len(text), before, hashlib.md5(text.encode("utf-8")).hexdigest())
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
