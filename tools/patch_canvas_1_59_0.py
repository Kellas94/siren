# -*- coding: utf-8 -*-
"""SIREN 1.58.1 -> 1.59.0: canvas builder phase 1 (the ring of handles).
Anchor-guarded; every anchor must occur exactly once; .tmp + os.replace."""
import io, os, sys

P = r"C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html"
src = io.open(P, encoding="utf-8", newline="").read()
assert "\r\n" not in src, "file is LF-only; refusing to guess"
orig_len = len(src)

def sub(anchor, replacement, count=1):
    global src
    n = src.count(anchor)
    assert n == count, "anchor count %d != %d for %r" % (n, count, anchor[:80])
    src = src.replace(anchor, replacement)

# ---------------------------------------------------------------- 1. CSS
CSS_ANCHOR = "    .diagram-stage svg { display: block; flex: 0 0 auto; max-width: none !important; }\n"
CSS = CSS_ANCHOR + r"""
    /* ---- canvas builder (v1.59): the ring of handles, its popover, the in-place label ---- */
    #diagram > svg { overflow: visible; }
    #diagram .t-handles { touch-action: none; }
    #diagram .t-handles .t-handle { cursor: crosshair; outline: none; }
    #diagram .t-handles .t-handle circle {
      fill: var(--panel-elevated);
      stroke: var(--primary);
      stroke-width: 1.5;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .28));
    }
    #diagram .t-handles .t-handle path { fill: none; stroke: var(--primary); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
    #diagram .t-handles .t-handle:hover circle, #diagram .t-handles .t-handle.is-active circle { fill: var(--primary); }
    #diagram .t-handles .t-handle:hover path, #diagram .t-handles .t-handle.is-active path { stroke: var(--primary-text); }
    #diagram .t-handles .t-wire { fill: none; stroke: var(--primary); stroke-width: 2; stroke-dasharray: 5 4; stroke-linecap: round; pointer-events: none; }
    #diagram .t-handles .t-wire-dot { fill: var(--primary); pointer-events: none; }
    #diagram g.node.t-canvas-drop, #diagram [data-node-id].t-canvas-drop { filter: drop-shadow(0 0 7px var(--success)) drop-shadow(0 0 2px var(--success)); }
    .canvas-popover {
      position: fixed;
      z-index: 1500;
      width: 256px;
      padding: 10px;
      border: 1px solid var(--ui-dialog-border, var(--border-strong));
      border-radius: 12px;
      background: var(--ui-dialog-bg, var(--panel-elevated));
      color: var(--text);
      box-shadow: var(--shadow);
      font-size: 12px;
    }
    .canvas-popover[hidden] { display: none !important; }
    .canvas-popover .canvas-chips { display: flex; gap: 5px; margin-bottom: 8px; }
    .canvas-popover .canvas-chip {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      padding: 5px 2px;
      border: 1px solid var(--border-strong);
      border-radius: 7px;
      background: transparent;
      color: var(--muted);
      font-family: inherit;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      cursor: pointer;
    }
    .canvas-popover .canvas-chip[aria-pressed="true"] { border-color: var(--primary); color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); }
    .canvas-popover .canvas-chip:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
    .canvas-popover .canvas-chip svg { width: 20px; height: 14px; display: block; }
    .canvas-popover input {
      width: 100%;
      box-sizing: border-box;
      min-height: 34px;
      padding: 6px 9px;
      border: 1px solid var(--border-strong);
      border-radius: 8px;
      background: var(--input-bg, var(--panel-alt));
      color: var(--text);
      font: inherit;
      font-size: 13px;
    }
    .canvas-popover input:focus { outline: 2px solid var(--focus-ring); outline-offset: -1px; }
    .canvas-popover .canvas-pop-row { margin-top: 7px; display: flex; align-items: center; gap: 7px; }
    .canvas-popover .canvas-pop-row label { flex: 0 0 auto; color: var(--muted); font-size: 11px; }
    .canvas-popover .canvas-pop-row input { min-height: 30px; font-size: 12px; }
    .canvas-popover .canvas-pop-hint { margin-top: 7px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .canvas-inplace {
      position: fixed;
      z-index: 1500;
      box-sizing: border-box;
      padding: 4px 8px;
      border: 2px solid var(--primary);
      border-radius: 8px;
      background: var(--panel-elevated);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .canvas-inplace[hidden] { display: none !important; }
    .canvas-inplace:focus { outline: none; }
    .canvas-hint {
      position: fixed;
      z-index: 1450;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 6px 6px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      background: var(--panel-elevated);
      color: var(--muted);
      font-size: 12px;
      box-shadow: var(--shadow-soft);
      white-space: nowrap;
    }
    .canvas-hint[hidden] { display: none !important; }
    .canvas-hint button {
      border: 0;
      background: transparent;
      color: var(--muted);
      font-size: 15px;
      line-height: 1;
      padding: 2px 7px;
      border-radius: 999px;
      cursor: pointer;
    }
    .canvas-hint button:hover, .canvas-hint button:focus-visible { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--text); outline: none; }
"""
sub(CSS_ANCHOR, CSS)

# ---------------------------------------------------------------- 2. state default
sub("        tourDone: false,\n", "        tourDone: false,\n        canvasHintSeen: false,\n")

# ---------------------------------------------------------------- 3. rename dialog drive-by (spec 7)
sub("          if (applyVisualModel(next, 'Block renamed on canvas', id, { type: 'updateNode', id, label: target.label })) showToast('Block renamed.', 'success');\n        });\n      }",
    "          if (applyVisualModel(next, 'Block renamed on canvas', id, { type: 'updateNode', id, label: target.label })) showToast('Block renamed.', 'success');\n        }, { title: 'Rename block', label: 'Block name', hint: 'Up to 60 characters.', confirmText: 'Rename block' });\n      }")

# ---------------------------------------------------------------- 4. double-click -> in-place rename
sub("        event.stopPropagation();\n        renameNodeById(id);\n      }",
    "        event.stopPropagation();\n        // The canvas renames in place when the source lets it; the dialog stays for the rest.\n        if (canvasBeginInplaceRename(id)) return;\n        renameNodeById(id);\n      }")

# ---------------------------------------------------------------- 5. render hook
sub("          highlightSelectedNode();\n          highlightMultiSelection();\n",
    "          highlightSelectedNode();\n          highlightMultiSelection();\n          canvasAfterRender();\n")

# ---------------------------------------------------------------- 6. zoom keeps the ring at screen size
sub("        if (activeDiagram) activeDiagram.zoom = currentZoom;\n        if (shouldSave) scheduleSave();\n      }\n",
    "        if (activeDiagram) activeDiagram.zoom = currentZoom;\n        if (shouldSave) scheduleSave();\n        canvasOverlayRescale();\n      }\n")

# ---------------------------------------------------------------- 7. beginPan leaves the handles alone
sub("'button, input, select, a, #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key],",
    "'button, input, select, a, #diagram [data-handle-for], #diagram g.node, #diagram [data-node-id], #diagram [data-edge-key],")

# ---------------------------------------------------------------- 8. the live re-serialisation never carries the ring
sub("          lastGoodSvg = normalizeSvgString(new XMLSerializer().serializeToString(svg));\n",
    "          lastGoodSvg = normalizeSvgString(canvasOverlayFreeMarkup(svg));\n")

# ---------------------------------------------------------------- 9. planner (additive) + its case
PLANNER = r"""      /* ---------- 4b. canvas gestures (v1.59): add the next step / insert the step before ----------
         Additive: one planner for the two canvas gestures that make a block. It writes
         inside the anchor's group when the anchor has one, so the new block inherits the
         group the way the picture suggests; otherwise one line at depth 0 after the
         anchor's last mention. `groupId` names the group the new block landed in, so the
         model the caller hands the gate says the same thing the text does. ---------- */
      function surgPlanCanvasStep(idx, op) {
        const anchor = idx.nodes.get(op.anchorId);
        if (!anchor) return surgNoPlan(`no block ${op.anchorId}`);
        if (!op.id || idx.nodes.has(op.id)) return surgNoPlan(`id ${op.id} already exists`);
        const token = surgNewToken(op.shape, op.label);
        const groupedMention = anchor.mentions.filter(m => m.group && m.group.endStatement).pop() || null;
        const lastMention = anchor.mentions[anchor.mentions.length - 1];
        // One new line after a mention: inside its group block (before `end`) when the
        // mention is grouped, else at depth 0 after the line.
        const lineAfter = (mention, text) => {
          const g = mention.group;
          if (g && g.endStatement) {
            const inner = g.statements.length ? g.statements[g.statements.length - 1] : null;
            const indent = g.innerIndent != null ? g.innerIndent : `${g.headerStatement.indent}    `;
            return { edit: { op: 'insertAfter', line: inner ? inner.line : g.headerStatement.line, lines: [`${indent}${text}`] }, groupId: g.id };
          }
          const indent = mention.group ? idx.bodyIndent : mention.statement.indent;
          return { edit: { op: 'insertAfter', line: surgDepthZeroAfter(mention), lines: [`${indent}${text}`] }, groupId: '' };
        };
        if (op.mode === 'after') {
          const arrow = surgArrowText(idx, '-->', op.edgeLabel || '', op.forbidMid);
          const placed = lineAfter(groupedMention || lastMention, `${op.anchorId} ${arrow} ${op.id}${token}`);
          return { edits: [placed.edit], notes: [], ask: null, groupId: placed.groupId };
        }
        if (op.mode !== 'before') return surgNoPlan('unknown canvas step');
        const hops = idx.hops.filter(hop => hop.to && hop.to.id === op.anchorId);
        if (!hops.length) {
          const placed = lineAfter(groupedMention || lastMention, `${op.id}${token} --> ${op.anchorId}`);
          return { edits: [placed.edit], notes: [], ask: null, groupId: placed.groupId };
        }
        // The hop that receives the new block keeps the anchor's words where they are
        // (`X -->|No| NEW[...] --> B`), so prefer a hop whose mention carries the token.
        const first = hops.find(hop => hop.to.token) || hops[0];
        const edits = [{ op: 'span', line: first.line, start: first.to.idStart, end: first.to.idStart, text: `${op.id}${token} --> ` }];
        let groupId = first.to.group && first.to.group.endStatement ? first.to.group.id : '';
        hops.forEach(hop => {
          if (hop === first) return;
          const m = hop.to;
          const midChain = m.at < m.statement.nodes.length - 1;
          if (midChain || m.token) {
            // The mention goes on feeding what follows it, or keeps the anchor's words:
            // end this hop on the new block and let the rest stand as its own statement.
            edits.push({ op: 'span', line: m.line, start: m.idStart, end: m.idStart, text: `${op.id}; ` });
          } else {
            edits.push({ op: 'span', line: m.line, start: m.idStart, end: m.idEnd, text: op.id });
          }
          if (!groupId && m.group && m.group.endStatement) groupId = m.group.id;
        });
        const lines = Array.from(new Set(edits.map(e => e.line))).sort((a, b) => a - b);
        const notes = lines.length > 1 ? [`The connectors into ${op.anchorId} on lines ${surgHuman(lines)} now feed ${op.id}.`] : [];
        return { edits, notes, ask: null, groupId };
      }

      function planSurgicalEdit(idx, op) {
"""
sub("      function planSurgicalEdit(idx, op) {\n", PLANNER)
sub("          case 'addNodes': return surgPlanAddNodes(idx, op);\n",
    "          case 'addNodes': return surgPlanAddNodes(idx, op);\n          case 'canvasStep': return surgPlanCanvasStep(idx, op);\n")

# ---------------------------------------------------------------- 10. the module
MODULE = r"""      /* ==========================================================================
         Canvas builder (v1.59): the preview is the builder.

         A ring of two handles sits on the hovered or selected block - "before me"
         and "after me", the two places Mermaid has. Drag the forward handle into
         empty canvas and a small popover asks for the label: Enter makes the block
         and its connector. Drag the back handle out and the new step is inserted
         before the block - everything that fed it now feeds the new step, branch
         labels stay upstream. Drop either handle on another block to connect the
         two. F2 or a double-click renames in place. Ctrl+Enter / Ctrl+Shift+Enter
         reach the same popover from the keyboard.

         Every gesture is an op through applyVisualModel, so the surgical writer
         touches only the lines the gesture concerns and one Undo takes it back.
         The ring is painted as a sibling <g class="t-handles"> inside the
         diagram's own SVG after every render: it pans and zooms with the picture
         for free, resolves to no block for the click handlers, and never reaches
         an export (exports read lastGoodSvg, captured before the ring is painted;
         the one live re-serialisation strips it). Nothing is drawn at rest.
         ========================================================================== */
      const CANVAS_SVG_NS = 'http://www.w3.org/2000/svg';
      const CANVAS_HANDLE_R = 11;       // screen px
      const CANVAS_HANDLE_GAP = 14;     // screen px from the block's edge to the handle centre
      const CANVAS_HOVER_HALO = 30;     // screen px: the ring stays lit this far from its block
      const CANVAS_TOUCH_HOLD_MS = 120; // press-and-hold before a finger may drag a handle
      const CANVAS_AXES = { TD: { back: 'top', fwd: 'bottom' }, TB: { back: 'top', fwd: 'bottom' }, BT: { back: 'bottom', fwd: 'top' }, LR: { back: 'left', fwd: 'right' }, RL: { back: 'right', fwd: 'left' } };
      const CANVAS_ARROW = {
        top: 'M0 4.5 L0 -4.5 M-3.5 -1 L0 -4.5 L3.5 -1',
        bottom: 'M0 -4.5 L0 4.5 M-3.5 1 L0 4.5 L3.5 1',
        left: 'M4.5 0 L-4.5 0 M-1 -3.5 L-4.5 0 L-1 3.5',
        right: 'M-4.5 0 L4.5 0 M1 -3.5 L4.5 0 L1 3.5'
      };
      const CANVAS_CHIPS = [
        { shape: 'rect', name: 'Process', glyph: '<rect x="1.5" y="2.5" width="17" height="9" rx="1.5"/>' },
        { shape: 'diamond', name: 'Decision', glyph: '<path d="M10 1.5 L18.5 7 L10 12.5 L1.5 7 Z"/>' },
        { shape: 'stadium', name: 'Start / end', glyph: '<rect x="1.5" y="2.5" width="17" height="9" rx="4.5"/>' },
        { shape: 'cylinder', name: 'Database', glyph: '<path d="M1.5 3.5 v7 a8.5 2 0 0 0 17 0 v-7 a8.5 2 0 0 0 -17 0 a8.5 2 0 0 0 17 0"/>' }
      ];
      const CANVAS_CODE_ONLY = 'This diagram uses features the canvas can\u2019t edit safely. Use the panel or the source.';
      let canvasSelectedId = '';
      let canvasHoveredId = '';
      let canvasDrag = null;            // { id, role, side, pointerId, handle, x0, y0, moved, armed, timer, dropId }
      let canvasPopover = null;         // { el, sourceId, role, shape, auto }
      let canvasInplace = null;         // { el, id, original }
      let canvasHintEl = null;
      let canvasHintTimer = 0;
      let canvasSelectionPending = false;
      let canvasPressPoint = null;
      let canvasReadCache = { source: null, model: null };

      function canvasSvg() { return el.diagram ? el.diagram.querySelector('svg') : null; }

      function canvasBuilderAvailable() {
        if (readOnlyMode || state.multiPreview) return false;
        if (el.presentOverlay && !el.presentOverlay.hidden) return false;
        return true;
      }

      // A fresh parse for anything that mutates; the cached one for painting.
      function canvasModel() {
        const model = parseVisualFlowchartSource(el.source ? el.source.value : '');
        return model.compatible ? model : null;
      }
      function canvasReadModel() {
        const source = el.source ? el.source.value : '';
        if (canvasReadCache.source !== source) canvasReadCache = { source, model: canvasModel() };
        return canvasReadCache.model;
      }
      function canvasLabelOf(model, id) {
        const node = model && model.nodes.find(item => item.id === id);
        return node ? (node.label || node.id) : id;
      }
      function canvasAxes(model) { return CANVAS_AXES[(model && model.direction) || 'TD'] || CANVAS_AXES.TD; }
      function canvasScale(svg) {
        const m = svg.getScreenCTM();
        return m ? (Math.hypot(m.a, m.b) || 1) : 1;
      }
      function canvasClientToSvg(svg, x, y) {
        const m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        const p = svg.createSVGPoint(); p.x = x; p.y = y;
        const q = p.matrixTransform(m.inverse());
        return { x: q.x, y: q.y };
      }
      function canvasSvgToClient(svg, x, y) {
        const m = svg.getScreenCTM();
        if (!m) return { x: 0, y: 0 };
        const p = svg.createSVGPoint(); p.x = x; p.y = y;
        const q = p.matrixTransform(m);
        return { x: q.x, y: q.y };
      }
      function canvasSvgEl(tag, attrs) {
        const node = document.createElementNS(CANVAS_SVG_NS, tag);
        Object.keys(attrs || {}).forEach(key => node.setAttribute(key, String(attrs[key])));
        return node;
      }
      function canvasLayer(svg) { return svg ? svg.querySelector(':scope > g.t-handles') : null; }

      // The block's box in the SVG root's own coordinate space (the viewBox space a
      // child <g> of the root lives in), whatever transforms Mermaid put above it.
      function canvasNodeFrame(svg, id) {
        const group = findSvgNodeGroups(svg, id)[0];
        if (!group || typeof group.getBBox !== 'function') return null;
        let bb, gm, sm;
        try { bb = group.getBBox(); gm = group.getScreenCTM(); sm = svg.getScreenCTM(); } catch (error) { return null; }
        if (!bb || !gm || !sm || (!bb.width && !bb.height)) return null;
        const toRoot = sm.inverse().multiply(gm);
        const xs = [], ys = [];
        [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].forEach(([x, y]) => {
          const p = svg.createSVGPoint(); p.x = x; p.y = y;
          const q = p.matrixTransform(toRoot);
          xs.push(q.x); ys.push(q.y);
        });
        const x = Math.min(...xs), y = Math.min(...ys);
        const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
        return { group, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
      }
      function canvasSidePoint(frame, side, k) {
        const gap = CANVAS_HANDLE_GAP / k;
        if (side === 'top') return { x: frame.cx, y: frame.y - gap };
        if (side === 'bottom') return { x: frame.cx, y: frame.y + frame.h + gap };
        if (side === 'left') return { x: frame.x - gap, y: frame.cy };
        return { x: frame.x + frame.w + gap, y: frame.cy };
      }

      function canvasOverlayClear(svg) {
        const root = svg || canvasSvg();
        if (!root) return;
        root.querySelectorAll(':scope > g.t-handles').forEach(node => node.remove());
      }

      // Rebuilt after every render and on every change of what is lit. One ring at a
      // time: the hovered block, else the selected one; nothing at rest.
      function canvasOverlayRepaint() {
        const svg = canvasSvg();
        if (!svg) return;
        canvasOverlayClear(svg);
        if (!canvasBuilderAvailable() || previewWalkthroughIndex >= 0) return;
        const model = canvasReadModel();
        if (!model) { canvasSelectedId = ''; canvasHoveredId = ''; return; }
        const live = new Set(model.nodes.map(node => node.id));
        if (canvasSelectedId && !live.has(canvasSelectedId)) canvasSelectedId = '';
        if (canvasHoveredId && !live.has(canvasHoveredId)) canvasHoveredId = '';
        if (multiSelection.size >= 2) return;
        const id = canvasDrag ? canvasDrag.id : (canvasHoveredId || canvasSelectedId);
        if (!id) return;
        const frame = canvasNodeFrame(svg, id);
        if (!frame) return;
        const k = canvasScale(svg);
        const axes = canvasAxes(model);
        const name = canvasLabelOf(model, id);
        const layer = canvasSvgEl('g', { class: 't-handles', 'data-ring-for': id });
        [['back', axes.back, 'Insert a step before'], ['fwd', axes.fwd, 'Add the next step']].forEach(([role, side, tip]) => {
          const point = canvasSidePoint(frame, side, k);
          const handle = canvasSvgEl('g', {
            class: 't-handle', 'data-handle-for': id, 'data-role': role, 'data-side': side, role: 'button',
            'aria-label': `${tip}: ${name}`,
            transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)}) scale(${(1 / k).toFixed(4)})`
          });
          const title = canvasSvgEl('title');
          title.textContent = tip;
          handle.appendChild(title);
          handle.appendChild(canvasSvgEl('circle', { r: CANVAS_HANDLE_R, cx: 0, cy: 0 }));
          handle.appendChild(canvasSvgEl('path', { d: CANVAS_ARROW[side] }));
          if (canvasDrag && canvasDrag.role === role) { handle.classList.add('is-active'); canvasDrag.handle = handle; }
          layer.appendChild(handle);
        });
        svg.appendChild(layer);
      }

      // setZoom resizes the drawing; the ring keeps its screen size by repainting - when
      // a ring is showing, or a selection is waiting to show one again (after a walkthrough).
      function canvasOverlayRescale() {
        const svg = canvasSvg();
        if (svg && (canvasLayer(svg) || canvasSelectedId)) canvasOverlayRepaint();
      }

      // The one place the live SVG is re-serialised into lastGoodSvg (a live style edit):
      // the ring must never travel into exports, thumbnails or Present.
      function canvasOverlayFreeMarkup(svg) {
        const layers = Array.from(svg.querySelectorAll(':scope > g.t-handles'));
        layers.forEach(layer => layer.remove());
        try { return new XMLSerializer().serializeToString(svg); }
        finally { layers.forEach(layer => svg.appendChild(layer)); }
      }

      function canvasAfterRender() {
        canvasOverlayRepaint();
        if (!canvasSelectionPending) return;
        canvasSelectionPending = false;
        const id = canvasSelectedId;
        if (!id || !el.zoomViewport) return;
        // The gesture selected the block it made: the glow and the style target follow it.
        if (el.nodeStyleTarget && el.nodeStyleTarget.value !== id && Array.from(el.nodeStyleTarget.options).some(option => option.value === id)) {
          el.nodeStyleTarget.value = id;
          loadSelectedNodeStyleControls();
          highlightSelectedNode();
        }
        // And it stays in view, so the next gesture has handles to grab.
        requestAnimationFrame(() => {
          const group = findSvgNodeGroups(el.diagram, id)[0];
          if (!group || !group.isConnected) return;
          const box = group.getBoundingClientRect();
          const view = el.zoomViewport.getBoundingClientRect();
          const pad = 44;
          if (box.bottom > view.bottom - pad) el.zoomViewport.scrollTop += box.bottom - (view.bottom - pad);
          else if (box.top < view.top + pad) el.zoomViewport.scrollTop -= (view.top + pad) - box.top;
          if (box.right > view.right - pad) el.zoomViewport.scrollLeft += box.right - (view.right - pad);
          else if (box.left < view.left + pad) el.zoomViewport.scrollLeft -= (view.left + pad) - box.left;
        });
      }

      /* ---- hover and selection ---- */

      function handleCanvasHover(event) {
        if (canvasDrag || pointerPan || event.pointerType === 'touch') return;
        if (!canvasBuilderAvailable()) return;
        const target = event.target instanceof Element ? event.target : null;
        let want = '';
        if (target && target.closest('#diagram [data-handle-for]')) {
          want = canvasHoveredId || canvasSelectedId;
        } else {
          const id = target && target.closest('#diagram') ? resolveNodeIdFromElement(target) : '';
          if (id) want = id;
          else {
            // The handles sit outside the block, so a DOM hit-test would lose the ring in
            // the gap on the way to them; a halo keeps it lit until the pointer is there.
            const lit = canvasHoveredId || canvasSelectedId;
            if (lit) {
              const group = findSvgNodeGroups(el.diagram, lit)[0];
              if (group) {
                const rect = group.getBoundingClientRect();
                const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
                const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
                if (Math.hypot(dx, dy) <= CANVAS_HOVER_HALO) want = lit;
              }
            }
          }
        }
        if (want === canvasSelectedId) want = '';
        if (want !== canvasHoveredId) { canvasHoveredId = want; canvasOverlayRepaint(); }
      }

      function handleCanvasPointerLeave() {
        if (canvasDrag || !canvasHoveredId) return;
        canvasHoveredId = '';
        canvasOverlayRepaint();
      }

      function handleCanvasClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('[data-handle-for]')) return;
        if (!canvasBuilderAvailable() || connectMode || edgeWaypointMode) return;
        // A press that travelled (a pan, a body drag) is not a click on the canvas.
        if (canvasPressPoint && Math.hypot(event.clientX - canvasPressPoint.x, event.clientY - canvasPressPoint.y) > 6) return;
        const id = resolveNodeIdFromElement(target);
        if (id) {
          if (!canvasReadModel()) return;
          canvasSelectedId = id;
          canvasHoveredId = '';
          canvasOverlayRepaint();
          canvasMaybeShowHint();
          return;
        }
        if (target.closest('[data-edge-key], path.t-edge-hitarea, .edgePath, .edgeLabel')) return;
        if (canvasSelectedId || canvasHoveredId) { canvasSelectedId = ''; canvasHoveredId = ''; canvasOverlayRepaint(); }
      }

      function handleCanvasContextMenu(event) {
        const target = event.target instanceof Element ? event.target : null;
        // Never the browser's menu over a gesture; the block's own menu is one click away.
        if (target && target.closest('#diagram [data-handle-for]')) { event.preventDefault(); event.stopPropagation(); }
      }

      /* ---- the drag ---- */

      function handleCanvasPointerDown(event) {
        const target = event.target instanceof Element ? event.target : null;
        const handle = target && target.closest('#diagram [data-handle-for]');
        if (!handle) return;
        if (event.pointerType !== 'touch' && event.button !== 0) return;
        if (!canvasBuilderAvailable()) return;
        event.preventDefault();
        canvasClosePopover();
        canvasCancelInplace();
        if (canvasDrag) canvasDragCancel();
        const touch = event.pointerType === 'touch';
        canvasDrag = {
          id: handle.getAttribute('data-handle-for'), role: handle.getAttribute('data-role'), side: handle.getAttribute('data-side'),
          pointerId: event.pointerId, handle, x0: event.clientX, y0: event.clientY, moved: false, armed: !touch, timer: 0, dropId: ''
        };
        if (touch) {
          canvasDrag.timer = setTimeout(() => {
            if (canvasDrag && canvasDrag.pointerId === event.pointerId) { canvasDrag.armed = true; canvasDrag.handle.classList.add('is-active'); }
          }, CANVAS_TOUCH_HOLD_MS);
        } else {
          handle.classList.add('is-active');
        }
        try { handle.setPointerCapture(event.pointerId); } catch (error) { /* capture is a convenience */ }
      }

      function handleCanvasDragMove(event) {
        if (!canvasDrag || event.pointerId !== canvasDrag.pointerId) return;
        const dist = Math.hypot(event.clientX - canvasDrag.x0, event.clientY - canvasDrag.y0);
        if (!canvasDrag.armed) { if (dist > 8) canvasDragCancel(); return; }
        if (!canvasDrag.moved && dist > 5) canvasDrag.moved = true;
        if (!canvasDrag.moved) return;
        if (event.cancelable) event.preventDefault();
        const svg = canvasSvg();
        if (!svg) return;
        let layer = canvasLayer(svg);
        if (!layer) { canvasOverlayRepaint(); layer = canvasLayer(svg); if (!layer) return; }
        const frame = canvasNodeFrame(svg, canvasDrag.id);
        if (!frame) return;
        const k = canvasScale(svg);
        const from = canvasSidePoint(frame, canvasDrag.side, k);
        const to = canvasClientToSvg(svg, event.clientX, event.clientY);
        let wire = layer.querySelector('.t-wire');
        let dot = layer.querySelector('.t-wire-dot');
        if (!wire) { wire = canvasSvgEl('path', { class: 't-wire', 'vector-effect': 'non-scaling-stroke' }); layer.insertBefore(wire, layer.firstChild); }
        if (!dot) { dot = canvasSvgEl('circle', { class: 't-wire-dot' }); layer.appendChild(dot); }
        wire.setAttribute('d', `M${from.x.toFixed(2)} ${from.y.toFixed(2)} L${to.x.toFixed(2)} ${to.y.toFixed(2)}`);
        dot.setAttribute('cx', to.x.toFixed(2)); dot.setAttribute('cy', to.y.toFixed(2)); dot.setAttribute('r', (4 / k).toFixed(3));
        const hit = canvasHitTest(event.clientX, event.clientY);
        const dropId = hit.kind === 'node' && hit.id !== canvasDrag.id ? hit.id : '';
        if (dropId !== canvasDrag.dropId) { canvasSetDrop(canvasDrag.dropId, false); canvasSetDrop(dropId, true); canvasDrag.dropId = dropId; }
      }

      function handleCanvasDragEnd(event) {
        if (!canvasDrag || event.pointerId !== canvasDrag.pointerId) return;
        const drag = canvasDragFinish();
        // A press and release on the handle asks for the step right there - the same
        // popover the keyboard opens - so a tap works on touch without the hold.
        if (!drag.moved) { canvasOpenPopover(drag.id, drag.role, event.clientX, event.clientY); return; }
        if (!drag.armed) return;
        const hit = canvasHitTest(event.clientX, event.clientY);
        if (hit.kind === 'node' && hit.id !== drag.id) { canvasConnect(drag, hit.id); return; }
        canvasOpenPopover(drag.id, drag.role, event.clientX, event.clientY);
      }

      function handleCanvasDragCancel(event) {
        if (canvasDrag && event.pointerId === canvasDrag.pointerId) canvasDragCancel();
      }

      function canvasDragFinish() {
        const drag = canvasDrag;
        canvasDrag = null;
        clearTimeout(drag.timer);
        try { drag.handle.releasePointerCapture(drag.pointerId); } catch (error) { /* already released */ }
        if (drag.handle) drag.handle.classList.remove('is-active');
        canvasClearWire();
        canvasSetDrop(drag.dropId, false);
        return drag;
      }
      function canvasDragCancel() { if (canvasDrag) canvasDragFinish(); }

      function canvasSetDrop(id, on) {
        if (!id || !el.diagram) return;
        findSvgNodeGroups(el.diagram, id).forEach(group => group.classList.toggle('t-canvas-drop', on));
      }
      function canvasClearWire() {
        const svg = canvasSvg();
        if (!svg) return;
        svg.querySelectorAll(':scope > g.t-handles .t-wire, :scope > g.t-handles .t-wire-dot').forEach(node => node.remove());
      }

      // What is under the pointer once the ring is out of the way: the same path the
      // click handlers use, so a drop lands exactly where a click would.
      function canvasHitTest(x, y) {
        const layer = canvasLayer(canvasSvg());
        if (layer) layer.style.pointerEvents = 'none';
        let target = null;
        try { target = document.elementFromPoint(x, y); } finally { if (layer) layer.style.pointerEvents = ''; }
        if (!(target instanceof Element) || !target.closest('#diagram')) return { kind: 'empty' };
        const id = resolveNodeIdFromElement(target);
        return id ? { kind: 'node', id } : { kind: 'empty' };
      }

      /* ---- the popover: one label, one shape, Enter ---- */

      function canvasEnsurePopover() {
        let pop = document.getElementById('canvasPopover');
        if (pop) return pop;
        pop = document.createElement('div');
        pop.id = 'canvasPopover';
        pop.className = 'canvas-popover';
        pop.hidden = true;
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'New block');
        pop.addEventListener('keydown', handleCanvasPopoverKeydown);
        pop.addEventListener('click', handleCanvasPopoverClick);
        pop.addEventListener('input', handleCanvasPopoverInput);
        document.body.appendChild(pop);
        return pop;
      }

      function canvasOpenPopover(sourceId, role, clientX, clientY) {
        if (!canvasBuilderAvailable()) return false;
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return false; }
        const source = model.nodes.find(node => node.id === sourceId);
        if (!source) return false;
        canvasCancelInplace();
        const pop = canvasEnsurePopover();
        const branch = role === 'fwd' ? canvasAutoBranchLabel(model, sourceId) : '';
        const isDecision = source.shape === 'diamond';
        canvasPopover = { el: pop, sourceId, role, shape: 'rect', auto: false };
        const name = escapeHtml(canvasLabelOf(model, sourceId));
        pop.innerHTML = `<div class="canvas-chips" role="group" aria-label="Shape">${CANVAS_CHIPS.map(chip =>
            `<button type="button" class="canvas-chip" data-shape="${chip.shape}" aria-pressed="${String(chip.shape === 'rect')}"><svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${chip.glyph}</svg>${chip.name}</button>`).join('')}</div>`
          + '<input id="canvasPopLabel" type="text" placeholder="Name this step" autocomplete="off" maxlength="120" aria-label="New block label">'
          + (role === 'fwd' && isDecision ? `<div class="canvas-pop-row"><label for="canvasPopBranch">on</label><input id="canvasPopBranch" type="text" value="${escapeHtml(branch)}" maxlength="60" aria-label="Connector label"></div>` : '')
          + `<div class="canvas-pop-hint">${role === 'back' ? `Goes <b>before</b> ${name} \u2014 whatever fed it now feeds this.` : `Follows ${name}.`} Enter to place \u00b7 Esc to cancel.</div>`;
        pop.hidden = false;
        canvasPlacePopover(pop, clientX, clientY);
        const input = pop.querySelector('#canvasPopLabel');
        if (input) input.focus();
        return true;
      }

      function canvasPlacePopover(pop, x, y) {
        const width = pop.offsetWidth || 256, height = pop.offsetHeight || 150;
        const margin = 8;
        let left = x - width / 2;
        let top = y + 14;
        if (top + height > window.innerHeight - margin) top = y - height - 14;
        left = clamp(left, margin, Math.max(margin, window.innerWidth - width - margin));
        top = clamp(top, margin, Math.max(margin, window.innerHeight - height - margin));
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
      }

      function canvasOpenPopoverAtSelection(role) {
        const id = canvasSelectedId;
        const svg = canvasSvg();
        if (!id || !svg) return;
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const frame = canvasNodeFrame(svg, id);
        if (!frame) return;
        const axes = canvasAxes(model);
        const point = canvasSidePoint(frame, role === 'back' ? axes.back : axes.fwd, canvasScale(svg));
        const at = canvasSvgToClient(svg, point.x, point.y);
        canvasOpenPopover(id, role, at.x, at.y);
      }

      function canvasSetPopoverShape(shape, auto) {
        if (!canvasPopover) return;
        canvasPopover.shape = shape;
        canvasPopover.auto = Boolean(auto);
        canvasPopover.el.querySelectorAll('.canvas-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.shape === shape)));
      }
      function handleCanvasPopoverClick(event) {
        const chip = event.target instanceof Element ? event.target.closest('.canvas-chip') : null;
        if (!chip || !canvasPopover) return;
        event.preventDefault();
        canvasSetPopoverShape(chip.dataset.shape, false);
        const input = canvasPopover.el.querySelector('#canvasPopLabel');
        if (input) input.focus();
      }
      function handleCanvasPopoverInput(event) {
        if (!canvasPopover || !(event.target instanceof Element) || event.target.id !== 'canvasPopLabel') return;
        // An audit flowchart names its decisions with a question mark - notice it.
        const wantsDecision = /\?\s*$/.test(event.target.value);
        if (wantsDecision && canvasPopover.shape === 'rect') canvasSetPopoverShape('diamond', true);
        else if (!wantsDecision && canvasPopover.shape === 'diamond' && canvasPopover.auto) canvasSetPopoverShape('rect', true);
      }
      function handleCanvasPopoverKeydown(event) {
        event.stopPropagation();
        if (event.key === 'Enter') { event.preventDefault(); canvasCommitPopover(); }
        else if (event.key === 'Escape') { event.preventDefault(); canvasClosePopover(); canvasRefocusCanvas(); }
      }
      function canvasClosePopover() {
        if (!canvasPopover) return;
        const pop = canvasPopover.el;
        canvasPopover = null;
        pop.hidden = true;
        pop.innerHTML = '';
      }
      function canvasCommitPopover() {
        const st = canvasPopover;
        if (!st) return;
        const input = st.el.querySelector('#canvasPopLabel');
        const branchInput = st.el.querySelector('#canvasPopBranch');
        const label = cleanVisualText(input ? input.value : '');
        if (!label) { if (input) { input.placeholder = 'Type a name first'; input.focus(); } return; }
        const branch = branchInput ? cleanVisualText(branchInput.value) : null;
        const shape = st.shape;
        canvasClosePopover();
        if (st.role === 'back') canvasInsertBefore(st.sourceId, label, shape);
        else canvasGrow(st.sourceId, label, shape, branch);
        canvasRefocusCanvas();
      }
      // Keyboard routes need the canvas focused; after a popover or an in-place edit
      // closes, focus would otherwise fall to <body>.
      function canvasRefocusCanvas() {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (el.zoomViewport && (!active || active === document.body)) el.zoomViewport.focus({ preventScroll: true });
        });
      }

      /* ---- the mutations: every one an op through the seam ---- */

      function canvasAutoBranchLabel(model, sourceId) {
        const source = model.nodes.find(node => node.id === sourceId);
        if (!source || source.shape !== 'diamond') return '';
        const labels = model.edges.filter(edge => edge.from === sourceId).map(edge => cleanVisualText(edge.label).toLowerCase());
        if (labels.length >= 2) return '';
        if (!labels.includes('yes')) return 'Yes';
        if (!labels.includes('no')) return 'No';
        return '';
      }
      function canvasShapeFor(label, chosen) { return chosen || (/\?\s*$/.test(label) ? 'diamond' : 'rect'); }
      function canvasPredictGroup(op) {
        try {
          const plan = surgPlanCanvasStep(surgIndex(el.source.value), op);
          return plan && plan.groupId ? plan.groupId : '';
        } catch (error) { return ''; }
      }
      function canvasJoinGroup(model, groupId, id) {
        if (!groupId) return;
        const group = (model.subgraphs || []).find(item => item.id === groupId);
        if (group && !group.members.includes(id)) group.members.push(id);
      }

      // Returns true when the source changed. A canvas gesture shows its result now
      // rather than after the typing debounce, and the block it made is the selection.
      function canvasApply(model, reason, id, op) {
        const before = el.source.value;
        const clean = applyVisualModel(model, reason, id, op);
        if (el.source.value === before) return false;
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasSelectionPending = true;
        renderDiagram({ reason, saveVersion: false });
        return clean || true;
      }

      // G1 - the next step, from the forward handle / Ctrl+Enter.
      function canvasGrow(sourceId, label, shape, branchLabel) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        if (!model.nodes.some(node => node.id === sourceId)) return;
        const id = nextVisualNodeId(model.nodes);
        const finalShape = canvasShapeFor(label, shape);
        const edgeLabel = branchLabel == null ? canvasAutoBranchLabel(model, sourceId) : cleanVisualText(branchLabel);
        const op = { type: 'canvasStep', mode: 'after', anchorId: sourceId, id, label, shape: finalShape, edgeLabel };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        model.edges.push({ from: sourceId, to: id, type: '-->', label: edgeLabel });
        canvasJoinGroup(model, groupId, id);
        canvasApply(model, 'Block added from the canvas', id, op);
      }

      // G2 - the step before, from the back handle / Ctrl+Shift+Enter. Everything that
      // fed the block now feeds the new step; branch labels stay upstream.
      function canvasInsertBefore(targetId, label, shape) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const target = model.nodes.find(node => node.id === targetId);
        if (!target) return;
        const id = nextVisualNodeId(model.nodes);
        const finalShape = canvasShapeFor(label, shape);
        const op = { type: 'canvasStep', mode: 'before', anchorId: targetId, id, label, shape: finalShape };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        model.edges.forEach(edge => { if (edge.to === targetId) edge.to = id; });
        model.edges.push({ from: id, to: targetId, type: '-->', label: '' });
        canvasJoinGroup(model, groupId, id);
        canvasApply(model, `Step inserted before ${target.label || target.id}`, id, op);
      }

      // G3 - a handle dropped on another block: a connector, nothing else.
      function canvasConnect(drag, hitId) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const from = drag.role === 'back' ? hitId : drag.id;
        const to = drag.role === 'back' ? drag.id : hitId;
        if (!model.nodes.some(node => node.id === from) || !model.nodes.some(node => node.id === to)) return;
        if (from === to) { showToast('A block cannot lead to itself.', 'error'); return; }
        if (model.edges.some(edge => edge.from === from && edge.to === to && edge.type === '-->')) { showToast('These two are already connected.', 'error'); return; }
        const label = canvasAutoBranchLabel(model, from);
        model.edges.push({ from, to, type: '-->', label });
        canvasApply(model, 'Connector drawn on the canvas', drag.id, { type: 'addEdge', from, to, edgeType: '-->', label });
      }

      /* ---- G5: rename in place (F2, double-click) - the label only, never the id ---- */

      function canvasEnsureInplace() {
        let input = document.getElementById('canvasInplace');
        if (input) return input;
        input = document.createElement('input');
        input.id = 'canvasInplace';
        input.className = 'canvas-inplace';
        input.type = 'text';
        input.hidden = true;
        input.autocomplete = 'off';
        input.maxLength = 120;
        input.setAttribute('aria-label', 'Block label');
        input.addEventListener('keydown', event => {
          event.stopPropagation();
          if (event.key === 'Enter') { event.preventDefault(); canvasCommitInplace(); canvasRefocusCanvas(); }
          else if (event.key === 'Escape') { event.preventDefault(); canvasCancelInplace(); canvasRefocusCanvas(); }
        });
        input.addEventListener('blur', () => { if (canvasInplace) canvasCommitInplace(); });
        document.body.appendChild(input);
        return input;
      }

      function canvasBeginInplaceRename(id) {
        if (!canvasBuilderAvailable()) return false;
        const model = canvasModel();
        if (!model) return false;
        const node = model.nodes.find(item => item.id === id);
        if (!node) return false;
        const group = findSvgNodeGroups(el.diagram, id)[0];
        if (!group) return false;
        canvasClosePopover();
        closeNodeInspector(false);
        const rect = group.getBoundingClientRect();
        const input = canvasEnsureInplace();
        canvasInplace = { el: input, id, original: node.label || node.id };
        input.value = node.label || node.id;
        const width = clamp(Math.round(rect.width + 16), 140, Math.max(140, window.innerWidth - 16));
        const height = 34;
        input.style.width = `${width}px`;
        input.style.height = `${height}px`;
        input.style.left = `${Math.round(clamp(rect.left + rect.width / 2 - width / 2, 8, Math.max(8, window.innerWidth - width - 8)))}px`;
        input.style.top = `${Math.round(clamp(rect.top + rect.height / 2 - height / 2, 8, Math.max(8, window.innerHeight - height - 8)))}px`;
        input.hidden = false;
        input.focus();
        input.select();
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasOverlayRepaint();
        return true;
      }
      function canvasCommitInplace() {
        const st = canvasInplace;
        if (!st) return;
        canvasInplace = null;
        st.el.hidden = true;
        const value = cleanVisualText(st.el.value);
        if (!value || value === st.original) return;
        const model = canvasModel();
        if (!model) return;
        const node = model.nodes.find(item => item.id === st.id);
        if (!node) return;
        node.label = value;
        canvasApply(model, 'Block renamed on canvas', st.id, { type: 'updateNode', id: st.id, label: value });
      }
      function canvasCancelInplace() {
        if (!canvasInplace) return;
        const st = canvasInplace;
        canvasInplace = null;
        st.el.hidden = true;
      }

      /* ---- keyboard ---- */

      // Capturing, so Ctrl+Enter on a selected block reaches the popover before the
      // global handler reads it as "render". Text fields, dialogs and menus keep their keys.
      function handleCanvasBuilderKeydown(event) {
        if (canvasDrag && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); canvasDragCancel(); return; }
        if (canvasPopover || canvasInplace) return;
        if (!canvasBuilderAvailable() || !canvasSelectedId) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target) return;
        if (target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], dialog, .struct-menu, [role="menu"], #wpWorkspace, #editorPopout')) return;
        if (document.querySelector('dialog[open]')) return;
        if (!(target.closest('#zoomViewport') || target === document.body)) return;
        const mod = event.ctrlKey || event.metaKey;
        if (event.key === 'Enter' && mod && !event.altKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasOpenPopoverAtSelection(event.shiftKey ? 'back' : 'fwd');
          return;
        }
        if (event.key === 'F2' && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!canvasBeginInplaceRename(canvasSelectedId) && !canvasModel()) showToast(CANVAS_CODE_ONLY, 'error');
        }
      }

      // After the global Escape chain has had its turn: a bare Escape with a ring showing
      // and nothing else open puts the ring away.
      function handleCanvasEscapeRing(event) {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        if (canvasPopover || canvasInplace || canvasDrag) return;
        if (!(canvasSelectedId || canvasHoveredId)) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], dialog')) return;
        canvasSelectedId = '';
        canvasHoveredId = '';
        canvasOverlayRepaint();
      }

      /* ---- the one-time hint ---- */

      function canvasMaybeShowHint() {
        if (state.canvasHintSeen || !canvasBuilderAvailable() || !el.zoomViewport) return;
        state.canvasHintSeen = true;
        scheduleSave();
        let chip = canvasHintEl;
        if (!chip) {
          chip = document.createElement('div');
          chip.className = 'canvas-hint';
          chip.setAttribute('role', 'status');
          const text = document.createElement('span');
          text.textContent = 'Drag a handle to add a step \u00b7 F2 to rename';
          const close = document.createElement('button');
          close.type = 'button';
          close.setAttribute('aria-label', 'Dismiss');
          close.textContent = '\u00d7';
          close.addEventListener('click', canvasHideHint);
          chip.append(text, close);
          document.body.appendChild(chip);
          canvasHintEl = chip;
        }
        chip.hidden = false;
        const view = el.zoomViewport.getBoundingClientRect();
        const width = chip.offsetWidth || 280, height = chip.offsetHeight || 34;
        chip.style.left = `${Math.round(clamp(view.left + view.width / 2 - width / 2, 8, Math.max(8, window.innerWidth - width - 8)))}px`;
        chip.style.top = `${Math.round(clamp(view.bottom - height - 16, 8, Math.max(8, window.innerHeight - height - 8)))}px`;
        clearTimeout(canvasHintTimer);
        canvasHintTimer = setTimeout(canvasHideHint, 9000);
      }
      function canvasHideHint() {
        clearTimeout(canvasHintTimer);
        if (canvasHintEl) canvasHintEl.hidden = true;
      }

      function bindCanvasBuilder() {
        if (!el.diagram || !el.zoomViewport) return;
        el.diagram.addEventListener('pointerdown', handleCanvasPointerDown);
        // A finger on a handle is a gesture, not a scroll: say so at touchstart, the one
        // moment the browser still listens (touch-action on an SVG child is not honoured).
        el.diagram.addEventListener('touchstart', event => {
          const target = event.target instanceof Element ? event.target : null;
          if (target && target.closest('#diagram [data-handle-for]') && canvasBuilderAvailable() && event.cancelable) event.preventDefault();
        }, { passive: false });
        el.diagram.addEventListener('click', handleCanvasClick);
        el.diagram.addEventListener('contextmenu', handleCanvasContextMenu);
        el.zoomViewport.addEventListener('pointerdown', event => { canvasPressPoint = { x: event.clientX, y: event.clientY }; });
        el.zoomViewport.addEventListener('pointermove', handleCanvasHover, { passive: true });
        el.zoomViewport.addEventListener('pointerleave', handleCanvasPointerLeave);
        window.addEventListener('pointermove', handleCanvasDragMove);
        window.addEventListener('pointerup', handleCanvasDragEnd);
        window.addEventListener('pointercancel', handleCanvasDragCancel);
        document.addEventListener('keydown', handleCanvasBuilderKeydown, true);
        document.addEventListener('keydown', handleCanvasEscapeRing);
        document.addEventListener('pointerdown', event => {
          if (canvasPopover && !(event.target instanceof Element && canvasPopover.el.contains(event.target))) canvasClosePopover();
        }, true);
      }
      /* ---- canvas builder: end ---- */

      function bindResizer() {
"""
sub("      function bindResizer() {\n", MODULE)

# ---------------------------------------------------------------- 11. wire it up
sub("        bindEvents();\n        initializeFloatingInspectorQualityControls();\n",
    "        bindEvents();\n        bindCanvasBuilder();\n        initializeFloatingInspectorQualityControls();\n")

# ---------------------------------------------------------------- 12. version + changelog
sub("      const APP_VERSION = '1.58.1';", "      const APP_VERSION = '1.59.0';")
sub("      const CHANGELOG = [\n        {\n          version: '1.58.0',",
    "      const CHANGELOG = [\n        {\n          version: '1.59.0',\n          notes: [\n            'The preview is the builder now: pick a block and two handles appear \u2014 drag the forward one into empty space to add the next step, the back one to insert a step before it (whatever fed the block now feeds the new step), or drop either on another block to connect them; F2 or a double-click renames in place, Ctrl+Enter / Ctrl+Shift+Enter do the same from the keyboard, and each gesture changes only the lines it concerns.'\n          ]\n        },\n        {\n          version: '1.58.0',")

tmp = P + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(src)
os.replace(tmp, P)
print("patched", orig_len, "->", len(src), "bytes (+%d)" % (len(src) - orig_len))
