#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_present_output.py  --  usage:  python fix_present_output.py <target.html>

Two output features for SIREN's Present mode.

  1. DECK POWERPOINT EXPORT.  The deck already leaves as a PDF of pictures.
     An audit team circulates .pptx because they have to edit it and paste
     single slides into their own pack, so this writes real OOXML on top of
     the primitives the app already owns:

         buildZip()                     the ZIP writer the Word/Excel exports use
         buildPptxTheme()               the theme the Docs PowerPoint export uses
         buildPptxSlideMaster()         "
         buildPptxSlideLayout()         "
         workpaperPptxXml()             the XML escaper
         workpaperPptxRectShape()       the rectangle shape
         workpaperPptxPictureShape()    the picture shape
         workpaperPptxImageBytes()      data-URI -> bytes
         workpaperPptxImageDimensions() PNG/JPEG header reader
         workpaperPptxValidateEntries() the package validator

     No library, no CSP change, no edit to any of the functions above.
     A diagram stop is a picture (it IS a rendered diagram).  A content card
     is REAL TEXT: title, section, text with bullets and numbering, a native
     PPTX table, a picture.  Every slide carries the stop's presenter note in
     its own notesSlide.  Only cards that are drawings rather than words
     (video link, attachment, a missing picture, a card with more than one
     grid) fall back to a rasterised slide, and the toast names them.

  2. PROGRESSIVE REVEAL WITHIN A STEP.  Opt-in per step.  A diagram step
     reveals its outgoing connectors and their targets one press at a time; a
     text/table/facts/doc card reveals its paragraphs, bullets and rows one
     press at a time.  Previous walks the reveal backwards.  Presenter view's
     NEXT panel says what the next press will actually reveal.  Both exports
     render from the model, not from the stage, so they always carry the fully
     revealed state.

Anchor-guarded: every anchor must occur exactly once.  Atomic write.  Aborts
without writing anything on any drift.
"""

import io
import os
import sys

EDITS = []


def edit(name, anchor, replacement):
    EDITS.append((name, anchor, replacement))


# ---------------------------------------------------------------------------
# 1. MODEL -- the opt-in flags
# ---------------------------------------------------------------------------

edit(
    "sanitizePresentationEntry: reveal on a node step",
    """        if (type === 'node') {
          const nodeId = String(entry.nodeId || '').trim();
          if (!/^[A-Za-z_][\\w.-]*$/.test(nodeId)) return null;
          clean.nodeId = nodeId;
        }""",
    """        if (type === 'node') {
          const nodeId = String(entry.nodeId || '').trim();
          if (!/^[A-Za-z_][\\w.-]*$/.test(nodeId)) return null;
          clean.nodeId = nodeId;
          // Progressive reveal is opt-in and per step. Absent or false means the
          // step behaves exactly as it always has: one press, one whole block.
          clean.reveal = entry.reveal === true;
        }""",
)

edit(
    "sanitizeMapCard: reveal on a card",
    """          textScale: MAP_CARD_SCALES.includes(scale) ? scale : 1,
          align: card.align === 'centre' ? 'centre' : 'left',""",
    """          textScale: MAP_CARD_SCALES.includes(scale) ? scale : 1,
          align: card.align === 'centre' ? 'centre' : 'left',
          // Opt-in: reveal this card's paragraphs, bullets and rows one press at
          // a time. A card whose author never touched it plays as one piece.
          reveal: card.reveal === true,""",
)


# ---------------------------------------------------------------------------
# 2. REVEAL -- the engine
# ---------------------------------------------------------------------------

REVEAL_ENGINE = r"""      /* =====================================================================
         PROGRESSIVE REVEAL - one press, one element.

         In PowerPoint you press once and the next bullet appears. Here a step
         showed its whole block at once. This adds the same idea without adding
         a second navigation concept: `presentRevealStep` is how many of the
         current step's parts are on the screen, Next spends a press on it
         before the step moves on, and Previous spends a press taking one back.

         It is OPT-IN per step. presentRevealTotalHere() answers 0 for every
         step whose author never turned it on, presentRevealRemaining() is then
         false, and every branch below is skipped - so a diagram nobody has
         touched behaves exactly as it did before.

         The parts of a diagram step are its outgoing connectors and their
         targets, in the order the source declares them. The parts of a card are
         the pieces of its body (a list contributes its items, not itself) and
         the body rows of its table.
         ===================================================================== */

      let presentRevealStep = 0;

      function presentationRevealEdges(entry) {
        if (!entry || entry.type !== 'node' || entry.reveal !== true) return [];
        return outgoingEdges(entry.nodeId);
      }

      function presentationRevealTotal(entry) {
        return presentationRevealEdges(entry).length;
      }

      /* The card behind a route stop, but only if that card is set to reveal. */
      function mapRevealCardFor(view) {
        const target = view && view.target ? view.target : null;
        if (!target || target.kind !== 'card') return null;
        const card = ((state.map && state.map.cards) || []).find(entry => entry.id === target.cardId);
        return card && card.reveal === true ? card : null;
      }

      function mapRevealHost(card) {
        if (!card) return null;
        return mapCardEls().find(host => host.dataset.cardId === card.id) || null;
      }

      function mapRevealParts(host) {
        if (!host) return [];
        const parts = [];
        const body = host.querySelector('.map-card-body');
        if (body) {
          Array.from(body.children).forEach(child => {
            const tag = String(child.tagName || '').toUpperCase();
            if (tag === 'UL' || tag === 'OL') Array.from(child.children).forEach(item => parts.push(item));
            else parts.push(child);
          });
        }
        host.querySelectorAll('.map-card-table table tr').forEach(row => {
          if (!row.classList.contains('is-head')) parts.push(row);
        });
        return parts;
      }

      function mapRevealTotal(view) {
        const card = mapRevealCardFor(view);
        return card ? mapRevealParts(mapRevealHost(card)).length : 0;
      }

      /* Hidden, not removed: `visibility` keeps the card's own box exactly the
         size mapFitCardHeights measured, so nothing on the plane jumps or
         reflows while the reveal runs. */
      function mapApplyReveal(view, shown) {
        mapCardEls().forEach(host => {
          host.querySelectorAll('.is-reveal-hidden').forEach(node => node.classList.remove('is-reveal-hidden'));
        });
        const card = mapRevealCardFor(view);
        if (!card) return;
        mapRevealParts(mapRevealHost(card)).forEach((part, index) => {
          if (index >= shown) part.classList.add('is-reveal-hidden');
        });
      }

      function mapCurrentRouteView() {
        const route = (state.map && state.map.route) || [];
        if (!route.length) return null;
        return route[clamp(mapRouteIndex, 0, route.length - 1)] || null;
      }

      function presentRevealTotalHere() {
        if (mapMode) return mapRevealTotal(mapCurrentRouteView());
        return presentationRevealTotal(currentPresentationEntry());
      }

      function presentRevealRemaining() {
        return presentRevealStep < presentRevealTotalHere();
      }

      /* Stepping BACK into a step lands on its finished state, the way a deck
         with builds behaves everywhere else: the next Previous then walks that
         step's reveal backwards one press at a time. */
      function presentationRevealToFull(render) {
        const total = presentationRevealTotal(currentPresentationEntry());
        presentRevealStep = total;
        if (total && render !== false) updatePresentationView(false);
      }

      /* What the NEXT press will actually put on the screen, in words. The
         presenter view promises exactly this and nothing else. */
      function presentRevealNextText() {
        const at = presentRevealStep;
        if (mapMode) {
          const view = mapCurrentRouteView();
          const parts = mapRevealParts(mapRevealHost(mapRevealCardFor(view)));
          const part = parts[at];
          if (!part) return { label: '', text: '' };
          const cells = Array.from(part.querySelectorAll('th,td'));
          const text = (cells.length
            ? cells.map(cell => String(cell.textContent || '').trim()).filter(Boolean).join(' - ')
            : String(part.textContent || '')).replace(/\s+/g, ' ').trim();
          return { label: 'Reveal ' + (at + 1) + ' of ' + parts.length, text: text };
        }
        const entry = currentPresentationEntry();
        const edges = presentationRevealEdges(entry);
        const edge = edges[at];
        if (!edge) return { label: '', text: '' };
        return {
          label: 'Reveal ' + (at + 1) + ' of ' + edges.length,
          text: presentationNodeLabel(edge.to)
        };
      }

      /* The next press on a revealing diagram step is the same picture with one
         more connector lit, so it is drawn by re-lighting a clone - the same
         trick presenterStepSvg already uses to preview the next step. */
      function presenterRevealSvg(shown) {
        if (!presentSvg) return '';
        const entry = currentPresentationEntry();
        const edges = presentationRevealEdges(entry);
        if (!edges.length) return '';
        try {
          const clone = presentSvg.cloneNode(true);
          // The preview frame is the union of the block and everything the press
          // will have revealed - a preview that crops off the thing it is
          // promising is worse than no preview.
          const boxes = [presentationPrimaryBox(entry)];
          edges.slice(0, clamp(shown, 0, edges.length)).forEach(edge => {
            boxes.push(...findSvgNodeGroups(presentSvg, edge.to).map(presentationElementBox));
            boxes.push(...presentationEdgeElements(edge.from, edge.to).map(presentationElementBox));
          });
          const box = unionPresentationBoxes(boxes) || presentFullViewBox;
          if (box && box.width && box.height) {
            const width = box.width * 1.16;
            const height = box.height * 1.16;
            clone.setAttribute('viewBox',
              (box.x - (width - box.width) / 2) + ' '
              + (box.y - (height - box.height) / 2) + ' '
              + width + ' ' + height);
          }
          edges.slice(0, clamp(shown, 0, edges.length)).forEach(edge => {
            findSvgNodeGroups(clone, edge.to).forEach(group => {
              group.classList.remove('t-present-dim');
              group.classList.add('t-present-next');
            });
            const key = edgeKey(edge);
            const from = String(key).split('|')[0];
            const to = String(key).split('|')[2];
            clone.querySelectorAll('[data-edge-key]').forEach(element => {
              const parts = String(element.getAttribute('data-edge-key') || '').split('|');
              if (parts[0] !== from || parts[2] !== to) return;
              element.classList.remove('t-present-dim');
              element.classList.add('t-present-next');
            });
          });
          return presenterDressSvg(new XMLSerializer().serializeToString(clone));
        } catch (error) { return ''; }
      }

"""

edit(
    "reveal engine: inserted before updatePresentationView",
    """      function updatePresentationView(animateCamera = true) {
        if (!presentSvg) return;
        clearPresentationClasses();""",
    REVEAL_ENGINE
    + """      function updatePresentationView(animateCamera = true) {
        if (!presentSvg) return;
        clearPresentationClasses();""",
)


# ---------------------------------------------------------------------------
# 3. REVEAL -- rendering on the stage
# ---------------------------------------------------------------------------

edit(
    "updatePresentationView: reveal owns what leaves the block",
    """          if (presentCameraMode === 'context') {
            outgoingEdges(currentNode).forEach(edge => {
              findSvgNodeGroups(presentSvg, edge.to).forEach(group => group.classList.add('t-present-next'));
              presentationEdgeElements(edge.from, edge.to).forEach(element => element.classList.remove('t-present-dim'));
              markPresentationEdge(edge.from, edge.to, 't-present-next');
            });
          }""",
    """          // A step with reveal on owns what leaves it: only the connectors the
          // presenter has already pressed for are lit, whatever the camera
          // framing says. Without reveal this is the untouched Context branch.
          const revealEdges = presentationRevealEdges(entry);
          if (revealEdges.length) {
            revealEdges.slice(0, clamp(presentRevealStep, 0, revealEdges.length)).forEach(edge => {
              findSvgNodeGroups(presentSvg, edge.to).forEach(group => {
                group.classList.remove('t-present-dim');
                group.classList.add('t-present-next');
              });
              presentationEdgeElements(edge.from, edge.to).forEach(element => element.classList.remove('t-present-dim'));
              markPresentationEdge(edge.from, edge.to, 't-present-next');
            });
          } else if (presentCameraMode === 'context') {
            outgoingEdges(currentNode).forEach(edge => {
              findSvgNodeGroups(presentSvg, edge.to).forEach(group => group.classList.add('t-present-next'));
              presentationEdgeElements(edge.from, edge.to).forEach(element => element.classList.remove('t-present-dim'));
              markPresentationEdge(edge.from, edge.to, 't-present-next');
            });
          }""",
)

edit(
    "presentationEntryRawBox: the frame holds what has been revealed",
    """        } else if (presentCameraMode === 'context') {
          outgoingEdges(entry.nodeId).forEach(edge => {
            boxes.push(...findSvgNodeGroups(presentSvg, edge.to).map(presentationElementBox));
            boxes.push(...presentationEdgeElements(edge.from, edge.to).map(presentationElementBox));
          });
        }
        return unionPresentationBoxes(boxes) || presentFullViewBox;""",
    """        } else if (presentCameraMode === 'context') {
          outgoingEdges(entry.nodeId).forEach(edge => {
            boxes.push(...findSvgNodeGroups(presentSvg, edge.to).map(presentationElementBox));
            boxes.push(...presentationEdgeElements(edge.from, edge.to).map(presentationElementBox));
          });
        }
        // A reveal widens the frame as it goes: the camera has to hold whatever
        // the last press actually put in front of the room.
        const revealed = presentationRevealEdges(entry);
        revealed.slice(0, clamp(presentRevealStep, 0, revealed.length)).forEach(edge => {
          boxes.push(...findSvgNodeGroups(presentSvg, edge.to).map(presentationElementBox));
          boxes.push(...presentationEdgeElements(edge.from, edge.to).map(presentationElementBox));
        });
        return unionPresentationBoxes(boxes) || presentFullViewBox;""",
)

edit(
    "presentationFocusBox: a revealing step frames what it has revealed",
    """          const cx = raw.x + raw.width / 2;
          const cy = raw.y + raw.height / 2;
          return { x:cx - width / 2, y:cy - height / 2, width, height };
        }

        // Every node step gets a genuine close-up. Path and Context may add nearby""",
    """          const cx = raw.x + raw.width / 2;
          const cy = raw.y + raw.height / 2;
          return { x:cx - width / 2, y:cy - height / 2, width, height };
        }

        /* A step that is revealing frames exactly what it has revealed: the block
           plus the connectors and targets the presenter has already pressed for
           (presentationEntryRawBox has added them above). The coverage caps below
           exist to stop Path and Context pulling back to an overview nobody asked
           for - but here the wider frame IS what was asked for, so the union is
           honoured and the room can see what just appeared. */
        if (presentRevealStep > 0 && presentationRevealTotal(entry) > 0) {
          const revealPadding = 1.16;
          let width = Math.max(1, raw.width * revealPadding);
          let height = Math.max(1, raw.height * revealPadding);
          if (width / height < aspect) width = height * aspect;
          else height = width / aspect;
          const rx = raw.x + raw.width / 2;
          const ry = raw.y + raw.height / 2;
          return { x:rx - width / 2, y:ry - height / 2, width, height };
        }

        // Every node step gets a genuine close-up. Path and Context may add nearby""",
)


# ---------------------------------------------------------------------------
# 4. REVEAL -- navigation
# ---------------------------------------------------------------------------

edit(
    "resetPresentationNavigationForIndex: a new step starts unrevealed",
    """      function resetPresentationNavigationForIndex(index = presentIndex) {
        presentNavigationHistory = [];""",
    """      function resetPresentationNavigationForIndex(index = presentIndex) {
        presentRevealStep = 0;
        presentNavigationHistory = [];""",
)

edit(
    "movePresentationToIndex: a new step starts unrevealed",
    """        const beforeNode = presentationNodeIdAt(presentIndex) || presentVisitedNodeHistory[presentVisitedNodeHistory.length - 1] || '';
        presentIndex = nextIndex;
        presentPendingBranch = Boolean(options.pendingBranch);""",
    """        const beforeNode = presentationNodeIdAt(presentIndex) || presentVisitedNodeHistory[presentVisitedNodeHistory.length - 1] || '';
        presentIndex = nextIndex;
        presentRevealStep = 0;
        presentPendingBranch = Boolean(options.pendingBranch);""",
)

edit(
    "stepPresentation: Next spends a press on the reveal first",
    """          if (presentPendingGraphTarget) {
            const pending = { ...presentPendingGraphTarget };
            presentPendingGraphTarget = null;
            movePresentationToIndex(pending.index, { fromNode:pending.from, followGraph:true, animate:true });
            return 'moved';
          }

          const entry = currentPresentationEntry();""",
    """          if (presentPendingGraphTarget) {
            const pending = { ...presentPendingGraphTarget };
            presentPendingGraphTarget = null;
            movePresentationToIndex(pending.index, { fromNode:pending.from, followGraph:true, animate:true });
            return 'moved';
          }

          // Progressive reveal: one press, one element, before the step moves at
          // all. A step nobody turned it on for answers 0 here and falls straight
          // through to the behaviour it always had.
          if (presentRevealRemaining()) {
            presentRevealStep += 1;
            updatePresentationView(true);
            return 'reveal';
          }

          const entry = currentPresentationEntry();""",
)

edit(
    "stepPresentation: Previous walks the reveal backwards",
    """        presentPendingBranch = false;
        if (presentNavigationHistory.length) {
          restorePresentationNavigationSnapshot(presentNavigationHistory.pop(), true);
          return 'moved';
        }
        if (presentIndex >= 0) {
          const nextIndex = presentIndex - 1;
          presentIndex = nextIndex;
          resetPresentationNavigationForIndex(nextIndex);
          updatePresentationView(true);
          return 'moved';
        }""",
    """        presentPendingBranch = false;
        // Previous takes one element back off the screen before it leaves the
        // step, so the walk backwards is the walk forwards in reverse.
        if (presentRevealStep > 0) {
          presentRevealStep -= 1;
          updatePresentationView(true);
          return 'reveal';
        }
        if (presentNavigationHistory.length) {
          restorePresentationNavigationSnapshot(presentNavigationHistory.pop(), true);
          presentationRevealToFull(true);
          return 'moved';
        }
        if (presentIndex >= 0) {
          const nextIndex = presentIndex - 1;
          presentIndex = nextIndex;
          resetPresentationNavigationForIndex(nextIndex);
          // Landing on a step from the far side lands on its finished state.
          presentationRevealToFull(false);
          updatePresentationView(true);
          return 'moved';
        }""",
)

edit(
    "updatePresentationControls: Next stays live while a reveal remains",
    """        el.presentNextButton.disabled = checkpointActive || (!hasSteps && !hasNextDeck) || (presentIndex >= presentSequence.length - 1 && !hasNextDeck && !el.presentAutoplayLoop.checked && !needsBranchChoice);""",
    """        el.presentNextButton.disabled = checkpointActive || (!hasSteps && !hasNextDeck) || (presentIndex >= presentSequence.length - 1 && !hasNextDeck && !el.presentAutoplayLoop.checked && !needsBranchChoice && !presentRevealRemaining());""",
)

edit(
    "updatePresentationHeader: say where the reveal has got to",
    """        el.presentStep.textContent = presentIndex < 0 || presentSolo
          ? label
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`;""",
    """        const revealTotal = presentationRevealTotal(entry);
        const revealSuffix = revealTotal
          ? ` · reveal ${clamp(presentRevealStep, 0, revealTotal)} of ${revealTotal}`
          : '';
        el.presentStep.textContent = (presentIndex < 0 || presentSolo
          ? label
          : `Step ${presentIndex + 1} of ${presentSequence.length} · ${label}`) + revealSuffix;""",
)

edit(
    "mapGoToView: a stop arrives unrevealed",
    """        const bounded = clamp(index, 0, state.map.route.length - 1);
        mapRouteIndex = bounded;
        const view = state.map.route[bounded];""",
    """        const bounded = clamp(index, 0, state.map.route.length - 1);
        mapRouteIndex = bounded;
        const view = state.map.route[bounded];
        // A card set to reveal arrives with its heading only; each press adds a
        // piece. A card nobody set to reveal is untouched by this.
        presentRevealStep = 0;
        mapApplyReveal(view, 0);""",
)

edit(
    "mapStepRoute: the route spends presses on a card's reveal first",
    """      function mapStepRoute(delta) {
        if (!state.map || !state.map.route.length) return;
        let next = mapRouteIndex + delta;
        if (next >= state.map.route.length) {
          if (!state.map.settings.loop) return;
          next = 0;
        }
        if (next < 0) next = 0;
        mapGoToView(next);
      }""",
    """      function mapStepRoute(delta) {
        if (!state.map || !state.map.route.length) return;
        // A card stop set to reveal spends its presses on its own bullets and
        // rows before the route moves at all - and gives them back on the way
        // out. A stop nobody set to reveal never enters either branch.
        if (delta > 0 && presentRevealRemaining()) {
          presentRevealStep += 1;
          mapApplyReveal(mapCurrentRouteView(), presentRevealStep);
          mapUpdateChrome();
          broadcastPresentationState();
          return;
        }
        if (delta < 0 && presentRevealStep > 0) {
          presentRevealStep -= 1;
          mapApplyReveal(mapCurrentRouteView(), presentRevealStep);
          mapUpdateChrome();
          broadcastPresentationState();
          return;
        }
        const backwards = delta < 0;
        let next = mapRouteIndex + delta;
        if (next >= state.map.route.length) {
          if (!state.map.settings.loop) return;
          next = 0;
        }
        if (next < 0) next = 0;
        mapGoToView(next);
        if (backwards) {
          // Stepping back into a card lands on its finished state.
          const view = mapCurrentRouteView();
          presentRevealStep = mapRevealTotal(view);
          mapApplyReveal(view, presentRevealStep);
          mapUpdateChrome();
        }
      }""",
)

edit(
    "mapUpdateChrome: the bar says where the reveal has got to",
    """        if (el.mapViewName) el.mapViewName.textContent = state.map && state.map.route.length ? mapViewLabel(state.map.route[mapRouteIndex]) : '';""",
    """        if (el.mapViewName) {
          const here = state.map && state.map.route.length ? state.map.route[mapRouteIndex] : null;
          const revealTotal = here ? mapRevealTotal(here) : 0;
          el.mapViewName.textContent = here
            ? mapViewLabel(here) + (revealTotal ? ` · reveal ${clamp(presentRevealStep, 0, revealTotal)} of ${revealTotal}` : '')
            : '';
        }""",
)


# ---------------------------------------------------------------------------
# 5. REVEAL -- presenter view
# ---------------------------------------------------------------------------

edit(
    "presenterNextPlan: NEXT shows what the next press reveals",
    """      async function presenterNextPlan() {
        const route = presenterRoute();
        if (mapMode) {""",
    """      async function presenterNextPlan() {
        const route = presenterRoute();
        // A reveal IS the next press, so it is what the second screen must
        // promise - never the stop after it.
        if (presentRevealRemaining()) {
          const plan = presentRevealNextText();
          if (mapMode) {
            return {
              plate: plan.text || plan.label,
              plateNote: plan.label + ' on this card. The next press puts this line in front of the room.'
            };
          }
          return { label: plan.label + ' · ' + plan.text, svg: presenterRevealSvg(presentRevealStep + 1) };
        }
        if (mapMode) {""",
)


# ---------------------------------------------------------------------------
# 6. REVEAL -- authoring
# ---------------------------------------------------------------------------

edit(
    "Studio step panel: the reveal switch",
    """              <label class="check-row" style="margin:0;"><input id="presentCheckpointEnabled" type="checkbox" /><span>Pause here as a presentation checkpoint</span></label>""",
    """              <label class="check-row" style="margin:0;"><input id="presentStepReveal" type="checkbox" /><span>Reveal what leaves this block one press at a time</span></label>
              <label class="check-row" style="margin:0;"><input id="presentCheckpointEnabled" type="checkbox" /><span>Pause here as a presentation checkpoint</span></label>""",
)

edit(
    "element registry: presentStepReveal",
    """'presentNotes','presentNoteOwner','presentNoteSource','presentNoteDuration','presentCheckpointEnabled','presentCheckpointText',""",
    """'presentNotes','presentNoteOwner','presentNoteSource','presentNoteDuration','presentStepReveal','presentCheckpointEnabled','presentCheckpointText',""",
)

edit(
    "loadCurrentPresentationNote: show the step's reveal switch",
    """        el.presentCheckpointEnabled.checked=Boolean(note.checkpointEnabled);
        el.presentCheckpointText.value=note.checkpointText||'';
      }""",
    """        el.presentCheckpointEnabled.checked=Boolean(note.checkpointEnabled);
        el.presentCheckpointText.value=note.checkpointText||'';
        if (el.presentStepReveal) {
          // Reveal lives on the STEP, not on the note: a block can stand twice in
          // one walkthrough and only one of those stops may want to build up.
          const entry = currentPresentationEntry();
          const usable = Boolean(entry && entry.type === 'node' && outgoingEdges(entry.nodeId).length);
          el.presentStepReveal.checked = Boolean(entry && entry.reveal === true);
          el.presentStepReveal.disabled = !usable;
          const row = el.presentStepReveal.closest('.check-row');
          if (row) {
            row.title = usable
              ? 'Each press lights one connector leaving this block, and the block it points at.'
              : 'Only a block step with connectors leaving it can be revealed a press at a time.';
          }
        }
      }""",
)

edit(
    "wire the reveal switch",
    """        [el.presentNotes, el.presentNoteOwner, el.presentNoteSource, el.presentNoteDuration, el.presentCheckpointEnabled, el.presentCheckpointText].forEach(control => control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', saveCurrentPresentationNote));""",
    """        [el.presentNotes, el.presentNoteOwner, el.presentNoteSource, el.presentNoteDuration, el.presentCheckpointEnabled, el.presentCheckpointText].forEach(control => control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', saveCurrentPresentationNote));
        if (el.presentStepReveal) el.presentStepReveal.addEventListener('change', toggleCurrentStepReveal);""",
)

edit(
    "toggleCurrentStepReveal",
    """      function saveCurrentPresentationNote() {
        const diagram=getPresentationDiagram();""",
    """      /* The switch writes to the sequence entry and nothing else, then persists
         through the one function that already owns the sequence. */
      function toggleCurrentStepReveal() {
        const entry = currentPresentationEntry();
        if (!entry || entry.type !== 'node') { if (el.presentStepReveal) el.presentStepReveal.checked = false; return; }
        entry.reveal = Boolean(el.presentStepReveal && el.presentStepReveal.checked);
        presentRevealStep = 0;
        persistPresentationSequence();
        updatePresentationView(false);
      }

      function saveCurrentPresentationNote() {
        const diagram=getPresentationDiagram();""",
)

edit(
    "card editor: the reveal switch",
    """        if (card.kind === 'title') {
          controls.appendChild(mapEditorSegmented('Alignment', [['left', 'Left'], ['centre', 'Centred']], () => card.align, value => { card.align = value; }));
        }
        pane.appendChild(controls);

        mapCardEditorPreview();""",
    """        if (card.kind === 'title') {
          controls.appendChild(mapEditorSegmented('Alignment', [['left', 'Left'], ['centre', 'Centred']], () => card.align, value => { card.align = value; }));
        }
        pane.appendChild(controls);

        /* One switch, on the card itself, because the card is what has the
           bullets and the rows. Off by default: a card nobody touches plays as
           one piece, and the exported slide is the finished card either way. */
        if (['title', 'text', 'table', 'facts', 'doc'].includes(card.kind)) {
          const revealRow = document.createElement('label');
          revealRow.className = 'card-check-row';
          const revealBox = document.createElement('input');
          revealBox.type = 'checkbox';
          revealBox.checked = card.reveal === true;
          revealBox.addEventListener('change', () => { card.reveal = revealBox.checked; mapTouchCard(false); });
          const revealText = document.createElement('span');
          revealText.textContent = card.kind === 'table' || card.kind === 'facts'
            ? 'Reveal one row at a time while presenting'
            : 'Reveal one line at a time while presenting';
          revealRow.append(revealBox, revealText);
          pane.appendChild(revealRow);
        }

        mapCardEditorPreview();""",
)

edit(
    "reveal CSS",
    """    .map-card .map-card-body > :last-child { margin-bottom: 0; }""",
    """    .map-card .map-card-body > :last-child { margin-bottom: 0; }
    /* Progressive reveal hides, it does not remove: the card's own box keeps the
       height mapFitCardHeights measured, so the plane never reflows mid-talk. */
    .map-card .is-reveal-hidden { visibility: hidden; }
    .card-check-row { display: flex; align-items: center; gap: 10px; margin: 4px 0 0; cursor: pointer; }
    .card-check-row input { width: 16px; height: 16px; flex: 0 0 auto; }
    .card-check-row span { font-size: 13px; color: var(--muted); }""",
)


# ---------------------------------------------------------------------------
# 7. POWERPOINT
# ---------------------------------------------------------------------------

PPTX = r"""      /* =====================================================================
         THE DECK AS POWERPOINT.

         The deck already leaves as a PDF of pictures. An audit team circulates
         .pptx because they have to EDIT it and paste single slides into their
         own pack, so this writes real OOXML - and writes it on top of what the
         app already owns rather than on a library:

             buildZip()                      the ZIP writer of the Word export
             buildPptxTheme/SlideMaster/SlideLayout()   the Docs deck's parts
             workpaperPptxXml/RectShape/PictureShape()  its shape builders
             workpaperPptxImageBytes/Dimensions()       its image readers
             workpaperPptxValidateEntries()             its package validator

         None of those are modified. What is added here is a notes master and
         one notesSlide per stop (so every slide carries the presenter's note),
         a text shape that can do real bullets and real numbering, and a table
         shape that follows the deck's own colours.

         A DIAGRAM STOP is a picture: it is a rendered diagram, and rasterising
         it through the same svgToCanvas -> JPEG path the PDF uses is the
         honest answer. A CONTENT CARD is TEXT - title, section, text with
         bullets, a native PPTX table, a picture - so the recipient can edit it.
         Cards that are drawings rather than words (a video-link poster, an
         attachment plate, a picture whose bytes are gone, a card carrying more
         than one grid) fall back to a rasterised slide, and the closing toast
         names them.
         ===================================================================== */

      // 1920 x 1080 design pixels -> EMU. WP_PPTX.width / MAP_SLIDE.w = 6350.
      function mapPptxEmu(px) {
        return Math.round(Number(px || 0) * (WP_PPTX.width / MAP_SLIDE.w));
      }

      /* Computed styles come back as rgb() on every engine and as color(srgb r g b)
         on a wide-gamut theme, and PowerPoint wants RRGGBB. Resolve through the
         browser first so a var(), a colour name and color-mix() all arrive in one
         of those two shapes. */
      function mapPptxHexFromComputed(computed, fallback) {
        const text = String(computed || '').trim();
        if (!text) return fallback;
        if (/^color\(/i.test(text)) {
          const parts = (text.match(/-?[\d.]+%?/g) || []).slice(0, 3);
          if (parts.length !== 3) return fallback;
          return parts.map(part => {
            const number = parseFloat(part);
            const value = part.indexOf('%') >= 0 ? number * 2.55 : number * 255;
            return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
          }).join('').toUpperCase();
        }
        return cssColourToHex(text) || fallback;
      }

      function mapPptxResolveColour(value, fallback) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return fallback;
        let probe = null;
        try {
          probe = document.createElement('span');
          probe.style.position = 'absolute';
          probe.style.visibility = 'hidden';
          probe.style.color = raw;
          document.body.appendChild(probe);
          const computed = getComputedStyle(probe).color;
          return mapPptxHexFromComputed(computed, fallback);
        } catch (error) {
          return fallback;
        } finally {
          if (probe && probe.parentNode) probe.parentNode.removeChild(probe);
        }
      }

      function mapPptxMixHex(top, bottom, ratio) {
        const parse = hex => [0, 2, 4].map(at => parseInt(String(hex).slice(at, at + 2), 16) || 0);
        const a = parse(top);
        const b = parse(bottom);
        const t = clamp(Number(ratio) || 0, 0, 1);
        return a.map((value, index) => clamp(Math.round(value * t + b[index] * (1 - t)), 0, 255)
          .toString(16).padStart(2, '0')).join('').toUpperCase();
      }

      /* The deck's own palette, read exactly where mapCardSlideSvg reads it, so
         the PowerPoint slide and the PDF slide are the same deck. */
      function mapPptxPalette() {
        const source = mapSlidePalette();
        const bgHex = mapPptxResolveColour(source.bg, 'FFFFFF');
        const fgHex = mapPptxResolveColour(source.fg, '111111');
        const palette = {
          bgHex: bgHex,
          fgHex: fgHex,
          mutedHex: mapPptxResolveColour(source.muted, '6B7280'),
          accentHex: mapPptxResolveColour(source.accent, '2563EB'),
          borderHex: mapPptxResolveColour(source.border, 'D5DAE1'),
          family: source.family
        };
        palette.headHex = mapPptxMixHex(palette.accentHex, palette.bgHex, 0.16);
        return palette;
      }

      /* One paragraph. Runs keep their own bold/italic/underline, so a bolded
         phrase inside a bullet survives as a bolded phrase and not as a bolded
         line. A numbered list becomes a real auto-numbered list; a nested list
         keeps its indent. */
      function mapPptxParagraphXml(item) {
        const source = item && typeof item === 'object' ? item : {};
        const runs = (Array.isArray(source.runs) ? source.runs : [{ text: source.text || '' }])
          .filter(run => String(run && run.text || '').length);
        const size = Math.round(clamp(Number(source.size) || 20, 6, 200) * 100);
        if (!runs.length) return `<a:p><a:pPr/><a:endParaRPr lang="en-US" sz="${size}"/></a:p>`;
        const colour = (String(source.colour || '1F2937').replace(/[^0-9A-Fa-f]/g, '').slice(0, 6) || '1F2937').toUpperCase();
        const align = source.align ? ` algn="${source.align}"` : '';
        const depth = clamp(Number(source.depth) || 0, 0, 4);
        let bullet = '<a:buNone/>';
        let margin = '';
        if (source.bullet === 'number') {
          bullet = '<a:buFont typeface="Arial"/><a:buAutoNum type="arabicPeriod"/>';
          margin = ` marL="${342900 + depth * 342900}" indent="-228600"`;
        } else if (source.bullet) {
          bullet = '<a:buFont typeface="Arial"/><a:buChar char="&#8226;"/>';
          margin = ` marL="${342900 + depth * 342900}" indent="-228600"`;
        } else if (depth) {
          margin = ` marL="${depth * 342900}"`;
        }
        const before = Number(source.spaceBefore) > 0
          ? `<a:spcBef><a:spcPts val="${Math.round(Number(source.spaceBefore) * 100)}"/></a:spcBef>`
          : '';
        const body = runs.map(run => {
          const text = String(run.text || '');
          const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
          const bold = (source.bold || run.bold) ? ' b="1"' : '';
          const italic = run.italic ? ' i="1"' : '';
          const underline = run.underline ? ' u="sng"' : '';
          return `<a:r><a:rPr lang="en-US" dirty="0" sz="${size}"${bold}${italic}${underline}>`
            + `<a:solidFill><a:srgbClr val="${colour}"/></a:solidFill><a:latin typeface="Arial"/></a:rPr>`
            + `<a:t${preserve}>${workpaperPptxXml(text)}</a:t></a:r>`;
        }).join('');
        return `<a:p><a:pPr${align}${margin}>${before}${bullet}</a:pPr>${body}<a:endParaRPr lang="en-US" sz="${size}"/></a:p>`;
      }

      function mapPptxTextShape(id, name, x, y, width, height, paragraphs, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const autofit = opts.autofit === false ? '' : '<a:normAutofit/>';
        return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${workpaperPptxXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
          + `<p:spPr><a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(width)}" cy="${Math.round(height)}"/></a:xfrm>`
          + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>'
          + `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${opts.anchor || 't'}">${autofit}</a:bodyPr>`
          + `<a:lstStyle/>${paragraphs.map(mapPptxParagraphXml).join('')}</p:txBody></p:sp>`;
      }

      /* A native PPTX table - a real <a:tbl>, editable cell by cell - in the
         deck's own colours rather than the Docs export's fixed light ones. */
      function mapPptxTableShape(id, name, x, y, width, height, model, palette) {
        const rows = Array.isArray(model.rows) && model.rows.length ? model.rows : [['No rows yet']];
        const columns = Math.max(1, ...rows.map(row => (Array.isArray(row) ? row.length : 1)));
        const baseWidth = Math.floor(width / columns);
        const columnWidths = Array.from({ length: columns }, (unused, index) => index === columns - 1
          ? width - baseWidth * (columns - 1) : baseWidth);
        const baseHeight = Math.floor(height / rows.length);
        const border = `<a:solidFill><a:srgbClr val="${palette.borderHex}"/></a:solidFill>`;
        const body = rows.map((row, rowIndex) => {
          const header = rowIndex === 0 && model.headerRow !== false;
          const list = Array.isArray(row) ? row : [row];
          const cells = Array.from({ length: columns }, (unused, columnIndex) => {
            const paragraph = mapPptxParagraphXml({
              text: String(list[columnIndex] == null ? '' : list[columnIndex]),
              size: 14,
              bold: header,
              colour: header ? palette.fgHex : palette.fgHex
            });
            return '<a:tc><a:txBody><a:bodyPr wrap="square" lIns="45720" tIns="27432" rIns="45720" bIns="27432" anchor="ctr"/><a:lstStyle/>'
              + paragraph + '</a:txBody>'
              + `<a:tcPr><a:lnL w="6350">${border}</a:lnL><a:lnR w="6350">${border}</a:lnR>`
              + `<a:lnT w="6350">${border}</a:lnT><a:lnB w="6350">${border}</a:lnB>`
              + `<a:solidFill><a:srgbClr val="${header ? palette.headHex : palette.bgHex}"/></a:solidFill></a:tcPr></a:tc>`;
          });
          const rowHeight = rowIndex === rows.length - 1 ? height - baseHeight * (rows.length - 1) : baseHeight;
          return `<a:tr h="${Math.max(1, Math.round(rowHeight))}">${cells.join('')}</a:tr>`;
        }).join('');
        return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${workpaperPptxXml(name)}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>`
          + `<p:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.round(width)}" cy="${Math.round(height)}"/></p:xfrm>`
          + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>'
          + '<a:tblPr firstRow="1" bandRow="1"/>'
          + `<a:tblGrid>${columnWidths.map(value => `<a:gridCol w="${Math.round(value)}"/>`).join('')}</a:tblGrid>`
          + `${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
      }

      /* Every method takes 1920x1080 DESIGN PIXELS, exactly like mapCardSlideSvg,
         and converts once on the way out - so the layout code below reads the
         same as the SVG slide's layout code. */
      function mapPptxNewSlide(palette) {
        let nextId = 2;
        const shapes = [];
        const relationships = [];
        return {
          rect(name, x, y, width, height, fill) {
            shapes.push(workpaperPptxRectShape(nextId++, name, mapPptxEmu(x), mapPptxEmu(y),
              mapPptxEmu(width), mapPptxEmu(height), fill));
          },
          text(name, x, y, width, height, paragraphs, options) {
            shapes.push(mapPptxTextShape(nextId++, name, mapPptxEmu(x), mapPptxEmu(y),
              mapPptxEmu(width), mapPptxEmu(height), paragraphs, options));
          },
          table(name, x, y, width, height, model) {
            shapes.push(mapPptxTableShape(nextId++, name, mapPptxEmu(x), mapPptxEmu(y),
              mapPptxEmu(width), mapPptxEmu(height), model, palette));
          },
          picture(name, asset, x, y, width, height) {
            const relationshipId = `rId${relationships.length + 2}`;
            relationships.push({ id: relationshipId, asset: asset });
            shapes.push(workpaperPptxPictureShape(nextId++, name, relationshipId, asset,
              mapPptxEmu(x), mapPptxEmu(y), mapPptxEmu(width), mapPptxEmu(height)));
          },
          finish() {
            const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
              + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
              + `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${palette.bgHex}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>`
              + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
              + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
              + `${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
            return { xml: xml, relationships: relationships };
          }
        };
      }

      /* mapSlideCardFlow's items, turned into paragraphs. The size numbers are
         MAP_SLIDE_TEXT's own, halved: 1080 design pixels is 540 points, so one
         design pixel is exactly half a point and the PowerPoint slide inherits
         the SVG slide's type scale. */
      function mapPptxParagraphsFromFlow(items, palette, scale, align) {
        const out = [];
        (Array.isArray(items) ? items : []).forEach((item, index) => {
          const runs = (Array.isArray(item.runs) ? item.runs : []).filter(run => String(run && run.text || '').length);
          if (!runs.length) return;
          const key = item.type === 'h' ? `h${clamp(Number(item.level) || 2, 1, 3)}` : (MAP_SLIDE_TEXT[item.type] ? item.type : 'p');
          const spec = MAP_SLIDE_TEXT[key];
          out.push({
            runs: runs.map(run => ({
              text: String(run.text || ''),
              bold: !!run.bold, italic: !!run.italic, underline: !!run.underline
            })),
            size: (spec.size * scale) / 2,
            bold: item.type === 'h',
            colour: palette.fgHex,
            align: align || '',
            depth: clamp(Number(item.depth) || 0, 0, 4),
            bullet: item.type === 'li' ? (item.ordered ? 'number' : true) : false,
            spaceBefore: index === 0 ? 0 : (item.tight ? 0 : (spec.gapBefore * scale) / 2)
          });
        });
        return out;
      }

      /* A PowerPoint table can be edited, so it carries more rows than the
         picture does - but a slide is still a slide, and past the cap it says
         how many are left rather than running off the bottom. */
      const MAP_PPTX_TABLE_ROWS = 22;

      function mapPptxTableModel(item) {
        const rows = (Array.isArray(item.rows) ? item.rows : [])
          .map(row => (Array.isArray(row) ? row : [row]).map(cell => String(cell == null ? '' : cell)));
        if (rows.length <= MAP_PPTX_TABLE_ROWS) return { rows: rows, headerRow: item.headerRow !== false };
        const kept = rows.slice(0, MAP_PPTX_TABLE_ROWS - 1);
        const cut = rows.length - kept.length;
        const width = kept.reduce((most, row) => Math.max(most, row.length), 1);
        const tail = new Array(width).fill('');
        tail[0] = `+${cut} more row${cut === 1 ? '' : 's'} - the full table is on the card`;
        kept.push(tail);
        return { rows: kept, headerRow: item.headerRow !== false };
      }

      /* One rasterised slide, through the SAME svgToCanvas -> JPEG path the deck
         PDF uses, so a diagram stop cannot look different in the two files. */
      async function mapPptxRasterSlide(svg, palette, media, name) {
        if (!svg) return null;
        const shot = await svgToCanvas(svg, 2, 'current');
        const canvas = shot && shot.canvas ? shot.canvas : shot;
        if (!canvas || !canvas.width) return null;
        const asset = {
          name: `image${media.length + 1}.jpg`,
          bytes: await canvasRegionToJpeg(canvas, 0, 0, canvas.width, canvas.height),
          width: canvas.width,
          height: canvas.height
        };
        media.push(asset);
        const slide = mapPptxNewSlide(palette);
        slide.picture(String(name || 'Slide').slice(0, 90), asset, 0, 0, MAP_SLIDE.w, MAP_SLIDE.h);
        return slide.finish();
      }

      const MAP_PPTX_TEXT_KINDS = ['title', 'text', 'table', 'facts', 'doc'];

      /* A card as real text. Returns null when the honest answer is a picture -
         the caller then rasterises it and the toast says which stop it was. */
      function mapPptxCardSlide(card, palette, media) {
        const kind = String(card.kind || 'title');
        const flow = mapSlideCardFlow(card);
        const tables = flow.filter(item => item.type === 'table');
        const textItems = flow.filter(item => item.type !== 'table');
        let picture = null;

        if (kind === 'image') {
          const asset = mapSlideAsset(card.assetId);
          const href = asset ? mapSlideAssetHref(asset) : '';
          const mime = /^data:(image\/(png|jpeg))\s*[;,]/i.exec(href);
          if (!mime) return null;
          const bytes = workpaperPptxImageBytes(href);
          if (!bytes || !bytes.length) return null;
          const size = workpaperPptxImageDimensions(bytes, mime[1].toLowerCase());
          picture = {
            name: `image${media.length + 1}.${mime[2].toLowerCase() === 'png' ? 'png' : 'jpg'}`,
            bytes: bytes,
            width: (size && size.width) || Number(asset.w) || 1600,
            height: (size && size.height) || Number(asset.h) || 900
          };
        } else if (!MAP_PPTX_TEXT_KINDS.includes(kind)) {
          return null;
        }
        // Two grids on one slide is a picture of a card, not a slide.
        if (tables.length > 1) return null;

        const slidePalette = mapSlidePalette();
        const scale = mapSlideScale(card);
        const W = MAP_SLIDE.w;
        const H = MAP_SLIDE.h;
        const boxX = MAP_SLIDE.padX;
        const boxW = W - MAP_SLIDE.padX * 2;
        const centred = kind === 'title' && card.align === 'centre';
        const align = centred ? 'ctr' : '';
        const stack = [];
        let y = MAP_SLIDE.padTop;

        const eyebrow = String(card.eyebrow || '').trim();
        const titleText = String(card.title || '').trim();
        if (eyebrow) {
          const size = 38;
          stack.push({ kind: 'text', x: boxX, y: y, w: boxW, h: size * 1.4, paragraphs: [{
            text: eyebrow.toUpperCase().slice(0, 90), size: size / 2, bold: true,
            colour: palette.accentHex, align: align
          }] });
          y += size * 1.4 + 18;
        }
        if (titleText) {
          const baseSize = clamp((kind === 'title' ? 96 : 74) * (0.72 + scale * 0.28), 44, 128);
          const fitted = mapSlideFitTitle(titleText, boxW, baseSize, kind === 'title' ? 3 : 2, slidePalette.family);
          const height = Math.max(fitted.size * 1.2, fitted.lines.length * fitted.size * 1.18 + 10);
          stack.push({ kind: 'text', x: boxX, y: y, w: boxW, h: height, paragraphs: [{
            text: titleText, size: fitted.size / 2, bold: true, colour: palette.fgHex, align: align
          }] });
          y += height + 6;
        }
        if (eyebrow || titleText) {
          stack.push({ kind: 'rect', x: centred ? W / 2 - 58 : boxX, y: y + 16, w: 116, h: 6, fill: palette.accentHex });
          y += 16 + 6 + 30;
        }

        const footerText = String((state && state.projectName) || '').trim();
        const contentBottom = H - MAP_SLIDE.padBottom - (footerText ? 44 : 0);
        const paragraphs = mapPptxParagraphsFromFlow(textItems, palette, scale, align);
        let textHeight = 0;
        if (paragraphs.length) {
          // Measured with the very same flow engine the picture uses, so the
          // heading, the rule and the body land where the PDF puts them.
          const measured = mapSlideRenderFlow(textItems,
            { x: boxX, y: y, w: boxW, h: Math.max(40, contentBottom - y) }, slidePalette, scale, centred);
          textHeight = clamp((Number(measured.endY) || y) - y + 12, 40, Math.max(40, contentBottom - y));
        }
        const payloadTop = y + (textHeight ? textHeight + MAP_SLIDE.gap : 0);
        const payloadHeight = contentBottom - payloadTop;
        if ((tables.length || picture) && payloadHeight < 150) return null;

        if (paragraphs.length) stack.push({ kind: 'text', x: boxX, y: y, w: boxW, h: textHeight, paragraphs: paragraphs });
        if (tables.length) stack.push({ kind: 'table', x: boxX, y: payloadTop, w: boxW, h: payloadHeight, model: mapPptxTableModel(tables[0]) });
        else if (picture) stack.push({ kind: 'picture', x: boxX, y: payloadTop, w: boxW, h: payloadHeight, asset: picture });

        const used = (tables.length || picture) ? contentBottom : (y + textHeight);
        if (kind === 'title') {
          // A title card is a title card: centre the whole stack, exactly as
          // mapCardSlideSvg does, rather than pinning it to the top.
          const shift = Math.round((H - (used - MAP_SLIDE.padTop)) / 2 - MAP_SLIDE.padTop);
          if (Number.isFinite(shift) && Math.abs(shift) > 4) stack.forEach(item => { item.y += shift; });
        }

        const slide = mapPptxNewSlide(palette);
        slide.rect('Accent bar', 0, 0, W, 10, palette.accentHex);
        stack.forEach((item, index) => {
          if (item.kind === 'rect') slide.rect('Rule', item.x, item.y, item.w, item.h, item.fill);
          else if (item.kind === 'text') slide.text('Text ' + (index + 1), item.x, item.y, item.w, item.h, item.paragraphs);
          else if (item.kind === 'table') slide.table('Table', item.x, item.y, item.w, item.h, item.model);
          else if (item.kind === 'picture') {
            media.push(item.asset);
            slide.picture('Picture', item.asset, item.x, item.y, item.w, item.h);
          }
        });
        if (footerText) {
          slide.text('Footer', boxX, H - 58, boxW, 34,
            [{ text: footerText.slice(0, 90), size: 13, colour: palette.mutedHex }]);
        }
        return slide.finish();
      }

      /* ---------------- the package ---------------- */

      function mapPptxNotesSlideXml(text) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const paragraphs = lines.map(line => {
          const preserve = /^\s|\s$/.test(line) ? ' xml:space="preserve"' : '';
          return '<a:p><a:r><a:rPr lang="en-US" dirty="0"/>'
            + `<a:t${preserve}>${workpaperPptxXml(line)}</a:t></a:r></a:p>`;
        }).join('');
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
          + '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
          + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
          + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
          + '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>'
          + '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm>'
          + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
          + `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs || '<a:p><a:endParaRPr lang="en-US"/></a:p>'}</p:txBody></p:sp>`
          + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>';
      }

      function mapPptxNotesMasterXml() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
          + '<p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>'
          + '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
          + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
          + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>'
          + '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>'
          + '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm>'
          + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
          + '<p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/>'
          + '<a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>'
          + '</p:spTree></p:cSld>'
          + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
          + '<p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">'
          + '<a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill>'
          + '<a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle>'
          + '</p:notesMaster>';
      }

      function mapPptxRelsXml(inner) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
          + inner + '</Relationships>';
      }

      function mapPptxEntries(slides, media, notes) {
        const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
        const slideOverrides = slides.map((unused, index) =>
          `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
        const notesOverrides = slides.map((unused, index) =>
          `<Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join('');
        const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          + '<Default Extension="xml" ContentType="application/xml"/>'
          + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>'
          + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
          + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
          + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
          + '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>'
          + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
          + '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
          + '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>'
          + '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>'
          + '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>'
          + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
          + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
          + slideOverrides + notesOverrides + '</Types>';

        const notesMasterId = slides.length + 2;
        const presentationRels = mapPptxRelsXml(
          `<Relationship Id="rId1" Type="${REL}slideMaster" Target="slideMasters/slideMaster1.xml"/>`
          + slides.map((unused, index) => `<Relationship Id="rId${index + 2}" Type="${REL}slide" Target="slides/slide${index + 1}.xml"/>`).join('')
          + `<Relationship Id="rId${notesMasterId}" Type="${REL}notesMaster" Target="notesMasters/notesMaster1.xml"/>`
          + `<Relationship Id="rId${notesMasterId + 1}" Type="${REL}presProps" Target="presProps.xml"/>`
          + `<Relationship Id="rId${notesMasterId + 2}" Type="${REL}viewProps" Target="viewProps.xml"/>`
          + `<Relationship Id="rId${notesMasterId + 3}" Type="${REL}tableStyles" Target="tableStyles.xml"/>`
          + `<Relationship Id="rId${notesMasterId + 4}" Type="${REL}theme" Target="theme/theme1.xml"/>`);

        const slideIds = slides.map((unused, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('');
        const presentation = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
          + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
          + `<p:notesMasterIdLst><p:notesMasterId r:id="rId${notesMasterId}"/></p:notesMasterIdLst>`
          + `<p:sldIdLst>${slideIds}</p:sldIdLst>`
          + `<p:sldSz cx="${WP_PPTX.width}" cy="${WP_PPTX.height}" type="screen16x9"/>`
          + '<p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>';

        const title = String((state && state.projectName) || 'SIREN presentation').slice(0, 120);
        const now = new Date().toISOString();
        const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
          + `<dc:title>${workpaperPptxXml(title)}</dc:title><dc:creator>T-Industries SIREN</dc:creator>`
          + '<cp:lastModifiedBy>T-Industries SIREN</cp:lastModifiedBy>'
          + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>`
          + `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
        const app = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
          + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
          + '<Application>T-Industries SIREN</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat>'
          + `<Slides>${slides.length}</Slides><Notes>${slides.length}</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips>`
          + `<ScaleCrop>false</ScaleCrop><Company>T-Industries</Company><AppVersion>${APP_VERSION}</AppVersion></Properties>`;

        const entries = [
          { name: '[Content_Types].xml', data: contentTypes },
          { name: '_rels/.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}officeDocument" Target="ppt/presentation.xml"/>`
            + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
            + `<Relationship Id="rId3" Type="${REL}extended-properties" Target="docProps/app.xml"/>`) },
          { name: 'docProps/core.xml', data: core },
          { name: 'docProps/app.xml', data: app },
          { name: 'ppt/presentation.xml', data: presentation },
          { name: 'ppt/_rels/presentation.xml.rels', data: presentationRels },
          { name: 'ppt/theme/theme1.xml', data: buildPptxTheme() },
          { name: 'ppt/theme/theme2.xml', data: buildPptxTheme() },
          { name: 'ppt/slideMasters/slideMaster1.xml', data: buildPptxSlideMaster() },
          { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`
            + `<Relationship Id="rId2" Type="${REL}theme" Target="../theme/theme1.xml"/>`) },
          { name: 'ppt/slideLayouts/slideLayout1.xml', data: buildPptxSlideLayout() },
          { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}slideMaster" Target="../slideMasters/slideMaster1.xml"/>`) },
          { name: 'ppt/notesMasters/notesMaster1.xml', data: mapPptxNotesMasterXml() },
          { name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}theme" Target="../theme/theme2.xml"/>`) },
          { name: 'ppt/presProps.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>' },
          { name: 'ppt/viewProps.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>' },
          { name: 'ppt/tableStyles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>' }
        ];

        slides.forEach((slide, index) => {
          const number = index + 1;
          const images = slide.relationships.map(item =>
            `<Relationship Id="${item.id}" Type="${REL}image" Target="../media/${item.asset.name}"/>`).join('');
          const notesRelId = `rId${slide.relationships.length + 2}`;
          entries.push({ name: `ppt/slides/slide${number}.xml`, data: slide.xml });
          entries.push({ name: `ppt/slides/_rels/slide${number}.xml.rels`, data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`
            + images
            + `<Relationship Id="${notesRelId}" Type="${REL}notesSlide" Target="../notesSlides/notesSlide${number}.xml"/>`) });
          entries.push({ name: `ppt/notesSlides/notesSlide${number}.xml`, data: mapPptxNotesSlideXml(notes[index] || '') });
          entries.push({ name: `ppt/notesSlides/_rels/notesSlide${number}.xml.rels`, data: mapPptxRelsXml(
            `<Relationship Id="rId1" Type="${REL}notesMaster" Target="../notesMasters/notesMaster1.xml"/>`
            + `<Relationship Id="rId2" Type="${REL}slide" Target="../slides/slide${number}.xml"/>`) });
        });
        media.forEach(asset => entries.push({ name: `ppt/media/${asset.name}`, data: asset.bytes }));
        return entries;
      }

      /* One deck stop can be more than one slide: where a diagram's walkthrough
         carries content slides of its own, the deck PDF already expands the stop
         and walks them. PowerPoint has to produce the same slides in the same
         order - and it has to keep those cards as TEXT rather than take the PDF's
         rendered picture - so it walks the same sequence itself, through the same
         speakerSequenceForDiagram. On a build whose walkthroughs hold no cards
         this answers with the one stop and nothing changes. */
      function mapPptxStopParts(view) {
        const target = (view && view.target) || { kind: 'map' };
        const base = { card: null, note: String((view && view.note) || '') };
        if (target.kind !== 'diagram' && target.kind !== 'nodes') return [base];
        const diagram = (state.diagrams || []).find(entry => entry.id === target.diagramId);
        if (!diagram) return [base];
        let sequence = [];
        try { sequence = speakerSequenceForDiagram(diagram) || []; }
        catch (error) { return [base]; }
        if (!sequence.some(entry => entry && entry.type === 'card' && entry.card)) return [base];
        const notes = (diagram.presentation && diagram.presentation.notes) || {};
        const parts = [];
        let placed = false;
        sequence.forEach(entry => {
          if (entry && entry.type === 'card' && entry.card) {
            parts.push({ card: entry.card, note: String((notes['card:' + entry.id] || {}).text || '') });
            return;
          }
          // The diagram's own picture stands where its first block step stands.
          if (!placed) { placed = true; parts.push(base); }
        });
        if (!placed) parts.push(base);
        return parts;
      }

      /* The driver. Same route, same order, same notes as the PDF - a different
         file at the end of it. */
      async function mapExportRoutePptx() {
        const route = (state.map && state.map.route) || [];
        if (!route.length) { showToast('There is nothing on the route yet.', 'error'); return; }
        showToast(`Building the PowerPoint from ${route.length} stop${route.length === 1 ? '' : 's'}…`);
        const palette = mapPptxPalette();
        const media = [];
        const slides = [];
        const notes = [];
        const pictured = [];
        const failed = [];

        for (let index = 0; index < route.length; index += 1) {
          const view = route[index];
          const parts = mapPptxStopParts(view);
          for (let at = 0; at < parts.length; at += 1) {
            const piece = parts[at];
            let built = null;
            try {
              const kind = view.target ? view.target.kind : 'map';
              // The whole-map stop is a title slide in the PDF too - mapViewSlideSvg
              // draws exactly this card for it - so it goes in as text, not a picture.
              const card = piece.card
                || (kind === 'card'
                  ? ((state.map && state.map.cards) || []).find(entry => entry.id === view.target.cardId)
                  : (kind === 'map'
                    ? { kind: 'title', eyebrow: 'Overview', title: state.projectName || 'The whole map',
                        body: `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}` }
                    : null));
              if (card) {
                built = mapPptxCardSlide(card, palette, media);
                if (!built) {
                  const svg = piece.card ? mapCardSlideSvg(card, 1920, 1080) : await mapViewSlideSvg(view);
                  built = await mapPptxRasterSlide(svg, palette, media, card.title || mapViewLabel(view));
                  // Name the stop and the kind: an auditor who wants editable text
                  // has to know which slides did not get any, and why.
                  const meta = MAP_CARD_KINDS.find(entry => entry[0] === card.kind);
                  if (built) pictured.push(`stop ${index + 1} (${String((meta && meta[1]) || card.kind).toLowerCase()})`);
                }
              } else {
                built = await mapPptxRasterSlide(await mapViewSlideSvg(view), palette, media, mapViewLabel(view));
              }
            } catch (error) {
              // One unwritable stop must not take the whole deck down silently.
              console.error('PowerPoint slide failed for stop', index + 1, error);
              built = null;
            }
            if (!built) { if (!failed.includes(index + 1)) failed.push(index + 1); continue; }
            slides.push(built);
            notes.push(piece.note);
          }
        }

        if (!slides.length) { showToast('None of the stops could be written as PowerPoint slides.', 'error'); return; }
        const entries = mapPptxEntries(slides, media, notes);
        try {
          // The Docs export's own validator: part names, no duplicates, every
          // XML part well formed, every relationship resolving to a real part,
          // every picture matched to a relationship, every media part real.
          workpaperPptxValidateEntries(entries, slides.length, media.length);
        } catch (error) {
          showToast(String((error && error.message) || error), 'error');
          return;
        }
        const blob = new Blob([buildZip(entries)], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
        const url = URL.createObjectURL(blob);
        triggerBrowserDownload(url, sanitizeFileName(state.projectName || 'presentation') + '-deck.pptx');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        if (failed.length) {
          showToast(`Stop${failed.length === 1 ? '' : 's'} ${failed.join(', ')} could not be written and ${failed.length === 1 ? 'was' : 'were'} left out.`, 'error');
        }
        showToast(`${slides.length} slide${slides.length === 1 ? '' : 's'} exported as PowerPoint.`
          + (pictured.length
            ? ` ${pictured.length === 1 ? 'One card is a drawing rather than words, so it went in as a picture' : `${pictured.length} cards are drawings rather than words, so they went in as pictures`}: ${pictured.join(', ')}.`
            : ''), 'success');
      }

      /* One door for the deck, two files behind it - so the Build bar keeps the
         five controls it rests at and the choice is made where it is needed. */
      function mapChooseDeckExport(anchor) {
        if (!(((state.map && state.map.route) || []).length)) {
          showToast('There is nothing on the route yet.', 'error');
          return;
        }
        openStructureMenu(anchor || el.mapExportButton, [
          ['pdf', '⤓ PDF · a picture of every slide'],
          ['pptx', '⤓ PowerPoint (.pptx) · text you can edit']
        ], '', choice => { mapExportRoute(choice === 'pptx' ? 'pptx' : 'pdf'); });
      }

"""

edit(
    "PowerPoint export: inserted before mapExportRoute",
    """      async function mapExportRoute(format) {
        const route = (state.map && state.map.route) || [];
        if (!route.length) { showToast('There is nothing on the route yet.', 'error'); return; }
""",
    PPTX
    + """      async function mapExportRoute(format) {
        const route = (state.map && state.map.route) || [];
        if (!route.length) { showToast('There is nothing on the route yet.', 'error'); return; }
        // PowerPoint is not a variant of the picture deck: it writes real text
        // from the card model, so it takes its own path from here.
        if (format === 'pptx') return mapExportRoutePptx();
""",
)

edit(
    "Slides button opens the two-format chooser",
    """        if (el.mapExportButton) el.mapExportButton.addEventListener('click', () => mapExportRoute('pdf'));""",
    """        if (el.mapExportButton) el.mapExportButton.addEventListener('click', () => mapChooseDeckExport(el.mapExportButton));""",
)

edit(
    "Slides button title",
    """          <button class="btn ghost compact" id="mapExportButton" type="button" title="Export the route as slides">⤓ Slides</button>""",
    """          <button class="btn ghost compact" id="mapExportButton" type="button" aria-haspopup="listbox" title="Export the deck: a PDF of pictures, or an editable PowerPoint">⤓ Slides</button>""",
)

edit(
    "overflow menu: a PowerPoint row beside the PDF row",
    """          ['slides', '⤓ Export the deck as slides (PDF)',
            ((state.map && state.map.route) || []).length ? false
              : 'The deck is the route on the Map. Present the whole workspace to build one.'],""",
    """          ['slides', '⤓ Export the deck as slides (PDF)',
            ((state.map && state.map.route) || []).length ? false
              : 'The deck is the route on the Map. Present the whole workspace to build one.'],
          // An audit team circulates PowerPoint because they have to edit it and
          // paste single slides into their own pack. Same deck, second file.
          ['slidespptx', '⤓ Export the deck as PowerPoint (.pptx)',
            ((state.map && state.map.route) || []).length ? false
              : 'The deck is the route on the Map. Present the whole workspace to build one.'],""",
)

edit(
    "overflow menu: name the format instead of clicking the chooser open",
    """          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];""",
    """          if (choice === 'presenter') { togglePresentationPresenterWindow(); return; }
          // These two name their own format, so the overflow menu never opens a
          // second menu on top of itself.
          if (choice === 'slides') { mapExportRoute('pdf'); return; }
          if (choice === 'slidespptx') { mapExportRoute('pptx'); return; }
          const select = { camera: el.presentCameraMode, motion: el.presentTransition, decision: el.presentDecisionMode }[choice.split(':')[0]];""",
)


# ---------------------------------------------------------------------------
# runner
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) != 2:
        print("usage: python fix_present_output.py <target.html>")
        return 2
    target = sys.argv[1]
    if not os.path.isfile(target):
        print("ABORT: no such file: %s" % target)
        return 2

    with io.open(target, "r", encoding="utf-8", newline="") as handle:
        text = handle.read()
    original_length = len(text)

    for name, anchor, replacement in EDITS:
        count = text.count(anchor)
        if count != 1:
            print("ABORT: anchor for '%s' occurs %d times (expected 1). Nothing written." % (name, count))
            return 1
        if replacement.count(anchor) != 1 and anchor not in replacement:
            # Replacements that do not contain their anchor are rewrites; allowed.
            pass
        text = text.replace(anchor, replacement, 1)

    if len(text) <= original_length:
        print("ABORT: patched text did not grow. Nothing written.")
        return 1

    temporary = target + ".fix_present_output.tmp"
    with io.open(temporary, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    os.replace(temporary, target)
    print("OK: %d edits applied. %d -> %d characters." % (len(EDITS), original_length, len(text)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
