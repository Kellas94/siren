# SIREN canvas job, patch 2 of 2: the side handles ("a step beside B"), their keyboard
# route (Ctrl+Shift+arrow across the flow), and "New block..." / "Add a step after <name>"
# on the empty-canvas right-click menu. Apply AFTER patch_canvas_1_notes.py.
# Usage: python patch_canvas_2_sides_newblock.py <path-to-app.html>
import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# ---- 1. the ring grows two cross-axis handles ----
rep("""      const CANVAS_AXES = { TD: { back: 'top', fwd: 'bottom' }, TB: { back: 'top', fwd: 'bottom' }, BT: { back: 'bottom', fwd: 'top' }, LR: { back: 'left', fwd: 'right' }, RL: { back: 'right', fwd: 'left' } };""",
    """      // back/fwd sit on the flow axis; sideA/sideB across it ("a step beside").
      const CANVAS_AXES = {
        TD: { back: 'top', fwd: 'bottom', sideA: 'left', sideB: 'right' }, TB: { back: 'top', fwd: 'bottom', sideA: 'left', sideB: 'right' },
        BT: { back: 'bottom', fwd: 'top', sideA: 'left', sideB: 'right' },
        LR: { back: 'left', fwd: 'right', sideA: 'top', sideB: 'bottom' }, RL: { back: 'right', fwd: 'left', sideA: 'top', sideB: 'bottom' }
      };""")
rep("""      let canvasVerify = null;          // a reorder awaiting its re-render: { a, b, cross, before }""",
    """      let canvasVerify = null;          // a reorder awaiting its re-render: { a, b, cross, before }
      let canvasSideCheck = null;       // a "beside" add awaiting its re-render: { id, anchorId, cross, want, names }
      let canvasMenuPoint = null;       // where the last right-click on the preview landed: { x, y, at }""")
rep("""        const layer = canvasSvgEl('g', { class: 't-handles', 'data-ring-for': id });
        [['back', axes.back, 'Insert a step before'], ['fwd', axes.fwd, 'Add the next step']].forEach(([role, side, tip]) => {
          const point = canvasSidePoint(frame, side, k);
          const handle = canvasSvgEl('g', {""",
    """        const layer = canvasSvgEl('g', { class: 't-handles', 'data-ring-for': id });
        // The two side handles are drawn only where the disc would not sit on a neighbouring
        // block (siblings can be 33px apart at fit zoom); Ctrl+Shift+arrow reaches "beside" everywhere.
        [['back', axes.back, 'Insert a step before'], ['fwd', axes.fwd, 'Add the next step'],
         ['sideA', axes.sideA, 'Add a step beside'], ['sideB', axes.sideB, 'Add a step beside']].forEach(([role, side, tip]) => {
          const point = canvasSidePoint(frame, side, k);
          if ((role === 'sideA' || role === 'sideB') && !canvasHandleHasRoom(svg, id, frame, point, k)) return;
          const handle = canvasSvgEl('g', {""")
# canvasNodeFrame splits into a lookup and a per-group frame reader, so the room test
# can read every block's frame in one pass over the drawing instead of one lookup per block
rep("""      function canvasNodeFrame(svg, id) {
        const group = findSvgNodeGroups(svg, id)[0];
        if (!group || typeof group.getBBox !== 'function') return null;""",
    """      function canvasNodeFrame(svg, id) {
        return canvasGroupFrame(svg, findSvgNodeGroups(svg, id)[0]);
      }
      function canvasGroupFrame(svg, group) {
        if (!group || typeof group.getBBox !== 'function') return null;""")
rep("""      function canvasSidePoint(frame, side, k) {""",
    """      // Every block's frame, read once per drawing: the SVG is replaced on each render, so
      // the cache is keyed by it. Reading them block by block on every repaint (hover,
      // arrow walk, zoom) froze a 300-block chart for ~80 ms; one pass costs that once.
      let canvasFrameCache = { svg: null, frames: null };
      function canvasAllFrames(svg) {
        if (canvasFrameCache.svg !== svg || !canvasFrameCache.frames) {
          const frames = [];
          new Set(svg.querySelectorAll('g.node, [data-node-id]')).forEach(group => {
            const f = canvasGroupFrame(svg, group);
            if (f) { f.id = group.getAttribute('data-node-id') || ''; frames.push(f); }
          });
          canvasFrameCache = { svg, frames };
        }
        return canvasFrameCache.frames;
      }
      // Would a handle disc at this point cover another block?
      function canvasHandleHasRoom(svg, id, own, point, k) {
        const r = (CANVAS_HANDLE_R + 9) / k;   // the disc plus a gap: never pressed against a neighbour
        return !canvasAllFrames(svg).some(f => f.group !== own.group && f.id !== id
          && point.x + r > f.x && point.x - r < f.x + f.w && point.y + r > f.y && point.y - r < f.y + f.h);
      }
      function canvasSidePoint(frame, side, k) {""")

# ---- 2. the popover knows three more roles: sideA / sideB (beside) and free (no anchor) ----
rep("""      function canvasOpenPopover(sourceId, role, clientX, clientY) {
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
          + '<input id="canvasPopLabel" type="text" placeholder="Name this step, or an existing block to connect" autocomplete="off" maxlength="120" aria-label="New block label or an existing block to connect" list="canvasPopBlocks">'
          + `<datalist id="canvasPopBlocks">${model.nodes.filter(n => n.id !== sourceId).map(n => `<option value="${escapeHtml(canvasLabelOf(model, n.id))}"></option>`).join('')}</datalist>`
          + (role === 'fwd' && isDecision ? `<div class="canvas-pop-row"><label for="canvasPopBranch">on</label><input id="canvasPopBranch" type="text" value="${escapeHtml(branch)}" maxlength="60" aria-label="Connector label"></div>` : '')
          + `<div class="canvas-pop-hint">${role === 'back' ? `Goes <b>before</b> ${name} \\u2014 whatever fed it now feeds this.` : `Follows ${name}${/[.?!]$/.test(name) ? '' : '.'}`} Enter to place \\u00b7 Esc to cancel.</div>`;
        pop.hidden = false;""",
    """      // Roles: 'fwd' (the next step), 'back' (the step before), 'sideA' / 'sideB' (a step
      // beside: fed by what feeds the block), 'free' (a block on its own, from the menu).
      function canvasOpenPopover(sourceId, role, clientX, clientY) {
        if (!canvasBuilderAvailable()) return false;
        const free = role === 'free';
        // An empty editor has no model yet; the free block will start the flowchart.
        const model = canvasModel() || (free && !String(el.source ? el.source.value : '').trim() ? { compatible: true, direction: 'TD', nodes: [], edges: [], comments: [], subgraphs: [] } : null);
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return false; }
        const source = free ? null : model.nodes.find(node => node.id === sourceId);
        if (!free && !source) return false;
        canvasCancelInplace();
        const pop = canvasEnsurePopover();
        const beside = role === 'sideA' || role === 'sideB';
        // Beside: the new block is fed like the anchor is; one diamond feeder offers its branch.
        const feederIds = beside ? canvasBesideFeeders(model, sourceId) : [];
        const feederDiamond = feederIds.length === 1 ? (model.nodes.find(n => n.id === feederIds[0] && n.shape === 'diamond') || null) : null;
        const branch = role === 'fwd' ? canvasAutoBranchLabel(model, sourceId) : (feederDiamond ? canvasAutoBranchLabel(model, feederDiamond.id) : '');
        const isDecision = Boolean(source && source.shape === 'diamond');
        const askBranch = (role === 'fwd' && isDecision) || Boolean(feederDiamond);
        canvasPopover = { el: pop, sourceId: free ? '' : sourceId, role, shape: 'rect', auto: false };
        const name = source ? escapeHtml(canvasLabelOf(model, sourceId)) : '';
        const chips = free ? CANVAS_CHIPS.filter(chip => chip.shape !== 'note') : CANVAS_CHIPS;   // a note needs a block to hang on
        const fedBy = feederIds.map(fid => escapeHtml(canvasLabelOf(model, fid))).join(', ');
        const hint = free ? 'A block on its own \\u2014 a handle connects it later.'
          : role === 'back' ? `Goes <b>before</b> ${name} \\u2014 whatever fed it now feeds this.`
          : beside ? `Beside ${name} \\u2014 ${fedBy ? `fed by ${fedBy}, like it is` : 'on its own, like it is'}.`
          : `Follows ${name}${/[.?!]$/.test(name) ? '' : '.'}`;
        pop.innerHTML = `<div class="canvas-chips" role="group" aria-label="Shape">${chips.map(chip =>
            `<button type="button" class="canvas-chip" data-shape="${chip.shape}" aria-pressed="${String(chip.shape === 'rect')}"><svg viewBox="0 0 20 14" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${chip.glyph}</svg>${chip.name}</button>`).join('')}</div>`
          + (free || beside
            ? `<input id="canvasPopLabel" type="text" placeholder="${free ? 'Name the new block' : 'Name the step beside ' + name}" autocomplete="off" maxlength="120" aria-label="New block label">`
            : '<input id="canvasPopLabel" type="text" placeholder="Name this step, or an existing block to connect" autocomplete="off" maxlength="120" aria-label="New block label or an existing block to connect" list="canvasPopBlocks">'
              + `<datalist id="canvasPopBlocks">${model.nodes.filter(n => n.id !== sourceId).map(n => `<option value="${escapeHtml(canvasLabelOf(model, n.id))}"></option>`).join('')}</datalist>`)
          + (askBranch ? `<div class="canvas-pop-row"><label for="canvasPopBranch">on</label><input id="canvasPopBranch" type="text" value="${escapeHtml(branch)}" maxlength="60" aria-label="Connector label"></div>` : '')
          + `<div class="canvas-pop-hint">${hint} Enter to place \\u00b7 Esc to cancel.</div>`;
        pop.hidden = false;""")
rep("""        const axes = canvasAxes(model);
        const point = canvasSidePoint(frame, role === 'back' ? axes.back : axes.fwd, canvasScale(svg));
        const at = canvasSvgToClient(svg, point.x, point.y);
        canvasOpenPopover(id, role, at.x, at.y);
      }""",
    """        const axes = canvasAxes(model);
        const point = canvasSidePoint(frame, axes[role] || axes.fwd, canvasScale(svg));
        const at = canvasSvgToClient(svg, point.x, point.y);
        canvasOpenPopover(id, role, at.x, at.y);
      }

      // "New block..." from the empty-canvas menu: the popover at the right-click point
      // (the viewport's upper middle when the menu came from the keyboard).
      function canvasOpenFreePopover() {
        const fresh = canvasMenuPoint && performance.now() - canvasMenuPoint.at < 5000 && (canvasMenuPoint.x > 0 || canvasMenuPoint.y > 0);
        let x, y;
        if (fresh) { x = canvasMenuPoint.x; y = canvasMenuPoint.y; }
        else if (el.zoomViewport) { const r = el.zoomViewport.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 3; }
        else { x = window.innerWidth / 2; y = window.innerHeight / 3; }
        canvasOpenPopover('', 'free', x, y);
      }

      // The builder's rows for the empty-canvas right-click menu (buildCanvasContextMenu
      // lists them): a block on its own, and the next step after the selected block.
      function canvasContextRows() {
        if (!canvasBuilderAvailable()) return [];
        const blank = !String(el.source ? el.source.value : '').trim();
        const model = blank ? null : canvasModel();
        const rows = [[() => canvasOpenFreePopover(), 'New block\\u2026', blank || model ? '' : CANVAS_CODE_ONLY]];
        if (model && canvasSelectedId && model.nodes.some(n => n.id === canvasSelectedId) && !canvasIsNote(model, canvasSelectedId)) {
          rows.push([() => canvasOpenPopoverAtSelection('fwd'), `Add a step after ${canvasLabelOf(model, canvasSelectedId)}`]);
        }
        return rows;
      }""")
rep("""        if (shape === 'note') canvasAddNote(st.sourceId, label);
        else if (existing && st.role !== 'back') canvasConnect({ id: st.sourceId, role: 'fwd' }, existing.id);""",
    """        if (shape === 'note') canvasAddNote(st.sourceId, label);
        else if (st.role === 'free') canvasAddFree(label, shape);
        else if (st.role === 'sideA' || st.role === 'sideB') canvasAddBeside(st.sourceId, label, shape, branch, st.role === 'sideA' ? -1 : 1);
        else if (existing && st.role !== 'back') canvasConnect({ id: st.sourceId, role: 'fwd' }, existing.id);""")

# ---- 3. the two mutations ----
rep("""      // G2 - the step before, from the back handle / Ctrl+Shift+Enter. Everything that
      // fed the block now feeds the new step; branch labels stay upstream.
      function canvasInsertBefore(targetId, label, shape) {""",
    """      // What feeds a block, for "beside": the blocks upstream of it on the page (a loop
      // back from further down is not how the block is fed). Ids in source order; empty
      // when nothing feeds it from upstream - then the step beside stands on its own.
      function canvasBesideFeeders(model, anchorId) {
        const ids = Array.from(new Set(model.edges.filter(e => e.to === anchorId && e.from !== anchorId && e.type !== '-.-').map(e => e.from)));
        const svg = canvasSvg();
        const here = svg && ids.length ? canvasNodeFrame(svg, anchorId) : null;
        if (!here) return ids;
        const dir = String(model.direction || 'TD').toUpperCase();
        const along = (dir === 'LR' || dir === 'RL') ? 'cx' : 'cy';
        const sign = (dir === 'BT' || dir === 'RL') ? -1 : 1;
        return ids.filter(fid => { const f = canvasNodeFrame(svg, fid); return f && (here[along] - f[along]) * sign > 1; });
      }

      // A step beside the block: fed by the same connector(s) that feed it, grouped like
      // it; with no feeder, a block on its own beside it. Left/right is a line-order bias
      // the layout honours when it can - the truth is read back after the render
      // (canvasVerifySide) and said, never promised and never rolled back.
      function canvasAddBeside(anchorId, label, shape, branchLabel, dir) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        if (!model.nodes.some(node => node.id === anchorId)) return;
        if (canvasIsNote(model, anchorId)) { showToast(CANVAS_NOTE_TOAST, 'error'); return; }
        const id = nextVisualNodeId(model.nodes);
        const finalShape = canvasShapeFor(label, shape);
        const feederIds = canvasBesideFeeders(model, anchorId);
        const feeders = model.edges.filter(e => e.to === anchorId && feederIds.includes(e.from) && e.type !== '-.-');
        const single = feederIds.length === 1 ? model.nodes.find(n => n.id === feederIds[0]) : null;
        const edgeLabel = single && single.shape === 'diamond'
          ? (branchLabel == null ? canvasAutoBranchLabel(model, single.id) : cleanVisualText(branchLabel)) : '';
        const op = { type: 'canvasStep', mode: 'beside', anchorId, id, label, shape: finalShape, edgeLabel, dir, feeders: feederIds };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        feederIds.forEach((fid, i) => {
          const first = feeders.find(e => e.from === fid);
          model.edges.push({ from: fid, to: id, type: first.type, label: i === 0 ? edgeLabel : '' });
        });
        canvasJoinGroup(model, groupId, id);
        const horizontal = /^(LR|RL)$/i.test(String(model.direction || 'TD'));
        const anchorName = canvasLabelOf(model, anchorId);
        canvasSideCheck = { id, anchorId, cross: horizontal ? 'cy' : 'cx', want: dir < 0 ? -1 : 1, names: [label, anchorName] };
        if (!canvasApply(model, `${label} added beside ${anchorName}`, id, op)) canvasSideCheck = null;
      }

      // After the re-render: did the layout put the new block on the side that was asked?
      // The add is wanted either way, so nothing is undone - but the picture's truth is said.
      function canvasVerifySide() {
        const v = canvasSideCheck;
        if (!v) return;
        canvasSideCheck = null;
        const svg = canvasSvg();
        const fa = svg ? canvasNodeFrame(svg, v.id) : null;
        const fb = svg ? canvasNodeFrame(svg, v.anchorId) : null;
        if (!fa || !fb) return;
        const along = v.cross === 'cx' ? 'cy' : 'cx';
        const size = v.cross === 'cx' ? Math.max(fa.h, fb.h) : Math.max(fa.w, fb.w);
        if (Math.abs(fa[along] - fb[along]) > size) {
          showToast(`${v.names[0]} added for ${v.names[1]} \\u2014 the layout put it on another row, not beside it (what feeds a block decides its row).`);
          return;
        }
        if (Math.sign(fa[v.cross] - fb[v.cross]) === v.want) return;
        showToast(`${v.names[0]} added beside ${v.names[1]} \\u2014 the layout put it on the other side (what these branches lead to decides their order).`);
      }

      // "New block...": a block on its own. An empty editor gets its flowchart header too.
      function canvasAddFree(label, shape) {
        const finalShape = canvasShapeFor(label, shape);
        const source = el.source ? el.source.value : '';
        if (!source.trim()) {
          const id = 'N1';
          canvasSelectedId = id;
          canvasHoveredId = '';
          canvasSelectionPending = true;
          canvasFocusPending = true;
          applySource(`flowchart TD\\n    ${id}${surgNewToken(finalShape, label)}`, { reason: 'First block added from the canvas', recordUndo: true, saveVersion: false });
          renderDiagram({ reason: 'First block added from the canvas', saveVersion: false });
          return;
        }
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const id = nextVisualNodeId(model.nodes);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        canvasApply(model, 'Block added from the canvas', id, { type: 'addNode', id, label, shape: finalShape });
      }

      // G2 - the step before, from the back handle / Ctrl+Shift+Enter. Everything that
      // fed the block now feeds the new step; branch labels stay upstream.
      function canvasInsertBefore(targetId, label, shape) {""")
rep("""      function canvasAfterRender() {
        canvasOverlayRepaint();
        canvasVerifyReorder();""",
    """      function canvasAfterRender() {
        canvasOverlayRepaint();
        canvasVerifyReorder();
        canvasVerifySide();""")

# ---- 3b. a note's dotted link is never a "move into" target (menu, drop, or the splice itself) ----
rep("""        if (target.from === id || target.to === id) { showToast('That connector already touches this block.', 'error'); return; }
        const sameAs = e => e.from === target.from && e.to === target.to && e.type === target.type && String(e.label || '') === String(target.label || '');""",
    """        if (target.from === id || target.to === id) { showToast('That connector already touches this block.', 'error'); return; }
        if (target.type === '-.-') { showToast(CANVAS_NOTE_LINK_TOAST, 'error'); return; }
        const sameAs = e => e.from === target.from && e.to === target.to && e.type === target.type && String(e.label || '') === String(target.label || '');""")
rep("""        const rows = model.edges.map((e, index) => [String(index), `between ${name(e.from)} and ${name(e.to)}${e.label ? ` (${cleanVisualText(e.label)})` : ''}`, (e.from === id || e.to === id) ? 'Already touches this block' : false]);""",
    """        const rows = model.edges.map((e, index) => [String(index), `between ${name(e.from)} and ${name(e.to)}${e.label ? ` (${cleanVisualText(e.label)})` : ''}`, (e.from === id || e.to === id) ? 'Already touches this block' : false])
          .filter((row, index) => model.edges[index].type !== '-.-');   // a note's dotted link is not a path""")
rep("""        const edge = resolveEdgeFromElement(target);
        if (!edge || edge.from === id || edge.to === id) return { el: null, edge: null };""",
    """        const edge = resolveEdgeFromElement(target);
        if (!edge || edge.from === id || edge.to === id || edge.type === '-.-') return { el: null, edge: null };   // a note's dotted link is not a path""")
rep("""      const CANVAS_NOTE_TOAST = 'A note only hangs on its block. Delete it and add a step instead.';""",
    """      const CANVAS_NOTE_TOAST = 'A note only hangs on its block. Delete it and add a step instead.';
      const CANVAS_NOTE_LINK_TOAST = 'A note\\u2019s dotted link is not a path. Move the block into a connector with an arrow.';""")

# ---- 4. the planner: 'beside' ----
rep("""        if (op.mode !== 'before') return surgNoPlan('unknown canvas step');
        const hops = idx.hops.filter(hop => hop.to && hop.to.id === op.anchorId);""",
    """        if (op.mode === 'beside') {
          // Beside: the new block is fed by the anchor's feeders (the dotted note link is
          // not one). The bias line - the first feeder's connector to the new block - goes
          // right before (dir < 0) or after the line that feeds the anchor, so the picture's
          // left/right follows the file's order whenever the layout allows it.
          const wanted = Array.isArray(op.feeders) ? op.feeders : null;   // the caller's choice of feeders (upstream ones)
          const into = idx.hops.filter(hop => hop.to && hop.to.id === op.anchorId && hop.from.id !== op.anchorId && hop.type !== '-.-' && (!wanted || wanted.includes(hop.from.id)));
          if (!into.length) {
            const placed = lineAfter(groupedMention || lastMention, `${op.id}${token}`);
            return { edits: [placed.edit], notes: [], ask: null, groupId: placed.groupId };
          }
          const seen = new Set();
          const feeders = into.filter(hop => { if (seen.has(hop.from.id)) return false; seen.add(hop.from.id); return true; });
          const first = feeders[0];
          const lines = feeders.map((hop, i) => `${first.statement.indent}${hop.from.id} ${surgArrowText(idx, hop.type, i === 0 ? (op.edgeLabel || '') : '', op.forbidMid)} ${i === 0 ? `${op.id}${token}` : op.id}`);
          const edits = [{ op: 'insertAfter', line: op.dir < 0 ? first.line - 1 : first.line, lines }];
          // Grouped like the anchor: a bare member line inside its block when the bias line sits outside it.
          const anchorNode = idx.nodes.get(op.anchorId);
          const memberMention = anchorNode ? (anchorNode.mentions.filter(m => m.group && m.group.endStatement).pop() || null) : null;
          const groupId = memberMention ? memberMention.group.id : (first.to.group && first.to.group.endStatement ? first.to.group.id : '');
          if (memberMention && !(first.to.group && first.to.group.id === memberMention.group.id)) {
            const g = memberMention.group;
            const inner = g.statements && g.statements.length ? g.statements[g.statements.length - 1] : null;
            const indent = g.innerIndent != null ? g.innerIndent : `${g.headerStatement.indent}    `;
            edits.push({ op: 'insertAfter', line: inner ? inner.line : g.headerStatement.line, lines: [`${indent}${op.id}`] });
          }
          return { edits, notes: [], ask: null, groupId };
        }
        if (op.mode !== 'before') return surgNoPlan('unknown canvas step');
        const hops = idx.hops.filter(hop => hop.to && hop.to.id === op.anchorId);""")

# ---- 5. keyboard: Ctrl+Shift+arrow across the flow opens the "beside" popover ----
rep("""        if (event.key === 'Enter' && mod && !event.altKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasOpenPopoverAtSelection(event.shiftKey ? 'back' : 'fwd');
          return;
        }""",
    """        if (event.key === 'Enter' && mod && !event.altKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasOpenPopoverAtSelection(event.shiftKey ? 'back' : 'fwd');
          return;
        }
        // Ctrl+Shift+arrow across the flow: a step beside (never Ctrl+Alt - that rotates screens on Windows).
        if (mod && event.shiftKey && !event.altKey && /^Arrow(Left|Right|Up|Down)$/.test(event.key)) {
          const m = canvasReadModel();
          const horizontal = Boolean(m && /^(LR|RL)$/i.test(String(m.direction || 'TD')));
          const crossKeys = horizontal ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
          if (crossKeys.includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            canvasOpenPopoverAtSelection(event.key === crossKeys[0] ? 'sideA' : 'sideB');
            return;
          }
        }""")
rep("""        el.zoomViewport.addEventListener('pointerdown', event => { canvasPressPoint = { x: event.clientX, y: event.clientY }; });""",
    """        el.zoomViewport.addEventListener('pointerdown', event => { canvasPressPoint = { x: event.clientX, y: event.clientY }; });
        el.zoomViewport.addEventListener('contextmenu', event => { canvasMenuPoint = { x: event.clientX, y: event.clientY, at: performance.now() }; });""")

# ---- 6. the empty-canvas menu ----
rep("""      function buildCanvasContextMenu() {
        const diagram = getActiveDiagram();
        return {
          rows: [
            [null, (diagram && diagram.name) || 'Diagram', 'heading'],
            [() => fitToPage(), 'Fit to page'],""",
    """      function buildCanvasContextMenu() {
        const diagram = getActiveDiagram();
        return {
          rows: [
            [null, (diagram && diagram.name) || 'Diagram', 'heading'],
            // The builder's own rows first: "New block..." and, with a block selected,
            // "Add a step after <name>" (canvasContextRows says when they are unavailable).
            ...canvasContextRows(),
            [() => fitToPage(), 'Fit to page'],""")

# ---- 7. copy ----
rep("""Ctrl+Enter adds the next step, Ctrl+Shift+Enter inserts one before · a name starting “Note:”""",
    """Ctrl+Enter adds the next step, Ctrl+Shift+Enter inserts one before, Ctrl+Shift+← → (↑ ↓ in a left-to-right chart) add a step beside · a name starting “Note:”""")
rep("""         A ring of two handles sits on the hovered or selected block - "before me"
         and "after me", the two places Mermaid has. Drag the forward handle into""",
    """         A ring of handles sits on the hovered or selected block - "before me" and
         "after me" on the flow axis, and "beside me" across it (a step fed like this
         one is; the layout decides left/right, the app says which). A note (a plain
         block at the far end of one dotted arrowless link, drawn as a sticky) hangs off any block through
         the popover's Note chip or a label that starts "Note:". Drag the forward handle into""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
