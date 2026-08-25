r"""Canvas phase 2 (spec section 5): the gestures that can remove a connector, and the
machinery that makes them safe.

- heal(): when a block leaves the flow (deleted, or moved into another connector), every
  in x out pair becomes one connector carrying the upstream label (the downstream one when
  the upstream is blank). Nothing is merged into an existing connector with a different
  label; a self-loop or two different labels that would have to share one connector is a
  *casualty*, and a casualty means the gesture refuses, names what it would lose, and does
  nothing. Identical connectors are never duplicated.
- G8 Delete / Backspace on a selected block: delete and heal, one key, one Undo.
- G4 drag a block's body onto a connector: detach + heal, then splice into that connector
  (the connector's label stays upstream). Ctrl+Shift+I offers the connectors as a list.
- G5 type-to-replace: a printable key on a selected block starts renaming it, the key as
  the first letter; never after a drag that produced nothing (the trap in section 1.4).
- Surgical planners for all of it: canvasHeal (one pass), canvasMove (detach+heal, then a
  dependent second pass canvasSplice on the new text). The common shape `A --> X --> Z`
  heals by taking X and its arrow out of the line, byte for byte.
- The confirm dialog gains a one-button notice mode for the refusal.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:100])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- 1. notice mode on the confirm dialog
rep("""      function closeConfirmDialog() {
        confirmCallback = null;
        closeDialog(el.confirmDialog);
      }""",
    """      // The same dialog with one button: a gesture that must refuse says why, and offers
      // nothing to confirm.
      let confirmNoticeMode = false;
      function requestNotice({ title, message, closeText }) {
        confirmNoticeMode = true;
        confirmCallback = null;
        el.confirmDialogTitle.textContent = title;
        el.confirmDialogMessage.textContent = message;
        el.confirmDialogMessage.style.whiteSpace = 'pre-line';
        el.confirmActionButton.textContent = closeText || 'OK';
        el.confirmActionButton.classList.remove('danger');
        el.cancelConfirmButton.hidden = true;
        showDialog(el.confirmDialog);
        el.confirmActionButton.focus();
      }

      function closeConfirmDialog() {
        confirmCallback = null;
        if (confirmNoticeMode) {
          confirmNoticeMode = false;
          el.confirmActionButton.classList.add('danger');
          el.cancelConfirmButton.hidden = false;
          el.confirmDialogMessage.style.whiteSpace = '';
        }
        closeDialog(el.confirmDialog);
      }""")

# ---------------------------------------------------------------- 2. surgicalWrite: a dependent second pass
rep("""        if (!plan.edits.length) return { status: 'noop', text: sourceText, plan, touched: { modified: [], removed: [], added: 0 }, notes: [] };
        const applied = applySourceEdits(sourceText, plan.edits);
        const check = parseVisualFlowchartSource(applied.text);
        if (!visualModelsEquivalent(check, model)) {""",
    """        if (!plan.edits.length && !plan.then) return { status: 'noop', text: sourceText, plan, touched: { modified: [], removed: [], added: 0 }, notes: [] };
        let applied = applySourceEdits(sourceText, plan.edits);
        let passNotes = plan.notes;
        if (plan.then) {
          // A dependent second pass on the text the first produced: a move detaches and
          // heals, then finds the target connector again in the new text and splices.
          const idx2 = surgIndex(applied.text);
          const plan2 = planSurgicalEdit(idx2, Object.assign({}, plan.then, { forbidMid: op.forbidMid }));
          if (plan2.refuse) return { status: 'fallback', reason: plan2.refuse, text: null, attempted: applied.text, plan, touched: applied.touched, check: null };
          applied = applySourceEdits(applied.text, plan2.edits);
          passNotes = passNotes.concat(plan2.notes);
        }
        const check = parseVisualFlowchartSource(applied.text);
        if (!visualModelsEquivalent(check, model)) {""")
rep("""        const notes = plan.notes.concat(surgEmptiedGroups(idx, applied.text));
        return { status: notes.length ? 'noted' : 'written', text: applied.text, plan, touched: applied.touched, notes };""",
    """        const notes = passNotes.concat(surgEmptiedGroups(idx, applied.text));
        return { status: notes.length ? 'noted' : 'written', text: applied.text, plan, touched: applied.touched, notes };""")

# ---------------------------------------------------------------- 3. planners: heal, move, splice
rep("""      function planSurgicalEdit(idx, op) {
        switch (op && op.type) {""",
    """      // Where a healed connector goes: after the line that carried the block's incoming
      // hop (at depth 0 when that line sits inside a group, so no group gains a member),
      // else where any new connector between the two would go.
      function surgHealEdits(idx, id, add) {
        return (add || []).map(e => {
          const hop = idx.hops.find(h => h.from.id === e.from && h.to.id === id) || idx.hops.find(h => h.from.id === id && h.to.id === e.to);
          const text = `${e.from} ${surgArrowText(idx, e.type, e.label || '', false)} ${e.to}`;
          if (hop) {
            const m = hop.from;
            if (m.group && m.group.endStatement) return { op: 'insertAfter', line: surgDepthZeroAfter(m), lines: [`${idx.bodyIndent}${text}`] };
            return { op: 'insertAfter', line: hop.line, lines: [`${hop.statement.indent}${text}`] };
          }
          const a = surgEdgeAnchor(idx, e.from, e.to);
          return { op: 'insertAfter', line: a.line, lines: [`${a.indent}${text}`] };
        });
      }

      // The common shape: one way in, one way out, both on the same line (`A --> X --> Z`),
      // healed by exactly one connector A -> Z. Returns the one span that takes the block
      // and one arrow out of the line, or null when the shape is anything else.
      function surgChainShrink(idx, id, add) {
        const node = idx.nodes.get(id);
        const ins = idx.hops.filter(h => h.to.id === id), outs = idx.hops.filter(h => h.from.id === id);
        if (!node || ins.length !== 1 || outs.length !== 1 || add.length !== 1) return null;
        const i = ins[0], o = outs[0], e = add[0];
        if (i.statement !== o.statement || i.to !== o.from || node.mentions.length !== 1) return null;
        if (e.from !== i.from.id || e.to !== o.to.id || e.type !== i.type) return null;
        const same = (a, b) => (a || '') === (b || '');
        if (same(e.label, i.label)) return { span: { op: 'span', line: i.line, start: i.to.idStart, end: o.to.idStart, text: '' }, mention: i.to };
        if (same(e.label, o.label) && e.type === o.type) return { span: { op: 'span', line: i.line, start: i.arrowStart, end: o.arrowStart, text: '' }, mention: i.to };
        return null;
      }

      // G8 - the block leaves the flow for good; its neighbours are joined by op.add.
      function surgPlanCanvasHeal(idx, op) {
        if (!idx.nodes.has(op.id)) return surgNoPlan(`no block ${op.id}`);
        const shrink = surgChainShrink(idx, op.id, op.add || []);
        if (shrink) return { edits: [shrink.span], notes: [], ask: null };
        const { edits } = surgRemovePlan(idx, new Set(), new Set([op.id]));
        return { edits: edits.concat(surgHealEdits(idx, op.id, op.add)), notes: [], ask: null };
      }

      // G4, pass one - detach the block from everything it touches (it stays declared),
      // heal around it; pass two (below) splices it into the target connector.
      function surgPlanCanvasMove(idx, op) {
        const node = idx.nodes.get(op.id);
        if (!node) return surgNoPlan(`no block ${op.id}`);
        const then = { type: 'canvasSplice', id: op.id, target: op.target, joinGroup: op.joinGroup || '' };
        const shrink = surgChainShrink(idx, op.id, op.add || []);
        if (shrink) {
          // The block's only words were on that line: keep them on a line of their own,
          // at the same depth, so the group it was in still holds it.
          const token = shrink.mention.token || (node.declarations[0] ? node.declarations[0].token : '');
          const decl = { op: 'insertAfter', line: shrink.span.line, lines: [`${shrink.mention.statement.indent}${op.id}${token}`] };
          return { edits: [shrink.span, decl], notes: [], ask: null, then };
        }
        const incident = new Set(idx.hops.filter(h => h.from.id === op.id || h.to.id === op.id).map(h => h.index));
        const removed = incident.size ? surgRemovePlan(idx, incident, new Set()).edits : [];
        return { edits: removed.concat(surgHealEdits(idx, op.id, op.add)), notes: [], ask: null, then };
      }

      // G4, pass two - `A -->|lbl| B` becomes `A -->|lbl| X --> B` in place; the label stays
      // upstream. Runs on the text pass one produced.
      function surgPlanCanvasSplice(idx, op) {
        if (!idx.nodes.has(op.id)) return surgNoPlan(`block ${op.id} is no longer in the source`);
        const t = op.target || {};
        const labelEq = (a, b) => String(a || '') === String(b || '');
        let hops = idx.hops.filter(h => h.from.id === t.from && h.to.id === t.to && h.type === t.type);
        if (hops.length > 1) hops = hops.filter(h => labelEq(h.label, t.label));
        const hop = hops[0];
        if (!hop) return surgNoPlan('the target connector is not in the source');
        const arrow = surgArrowText(idx, t.type, '', op.forbidMid);
        const edits = [{ op: 'span', line: hop.line, start: hop.to.idStart, end: hop.to.idStart, text: `${op.id} ${arrow} ` }];
        if (op.joinGroup) {
          const g = idx.groups.find(x => x.id === op.joinGroup);
          if (g && g.endStatement && !g.members.includes(op.id)) {
            const inner = g.statements && g.statements.length ? g.statements[g.statements.length - 1] : null;
            const indent = g.innerIndent != null ? g.innerIndent : `${g.headerStatement.indent}    `;
            edits.push({ op: 'insertAfter', line: inner ? inner.line : g.headerStatement.line, lines: [`${indent}${op.id}`] });
          }
        }
        return { edits, notes: [], ask: null };
      }

      function planSurgicalEdit(idx, op) {
        switch (op && op.type) {""")
rep("""          case 'canvasStep': return surgPlanCanvasStep(idx, op);""",
    """          case 'canvasStep': return surgPlanCanvasStep(idx, op);
          case 'canvasHeal': return surgPlanCanvasHeal(idx, op);
          case 'canvasMove': return surgPlanCanvasMove(idx, op);
          case 'canvasSplice': return surgPlanCanvasSplice(idx, op);""")

# ---------------------------------------------------------------- 4. canvas state
rep("""      let canvasPressPoint = null;""",
    """      let canvasPressPoint = null;
      let canvasMove = null;            // a block's body being dragged: { id, pointerId, x0, y0, moved, ghost, edgeEl, edge }
      let canvasMoveSuppressClickUntil = 0;
      let canvasTypeSuppressed = false; // a drag that produced nothing: the next keystroke must not rename (spec 1.4)""")

# ---------------------------------------------------------------- 5. body press starts a move
rep("""      function handleCanvasPointerDown(event) {
        const target = event.target instanceof Element ? event.target : null;
        const handle = target && target.closest('#diagram [data-handle-for]');
        if (!handle) return;""",
    """      function handleCanvasPointerDown(event) {
        const target = event.target instanceof Element ? event.target : null;
        const handle = target && target.closest('#diagram [data-handle-for]');
        if (!handle) { canvasBeginBodyPress(event, target); return; }""")

# ---------------------------------------------------------------- 6. the click that ends a body drag is not a click
rep("""      function handlePreviewNodeClick(event) {
        const id = resolveNodeIdFromElement(event.target);""",
    """      function handlePreviewNodeClick(event) {
        // The click that ends a body drag on the canvas is the drag's release, not a click.
        if (performance.now() < canvasMoveSuppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
        const id = resolveNodeIdFromElement(event.target);""")

# ---------------------------------------------------------------- 7. canvasApply carries the sidecar work
rep("""      function canvasApply(model, reason, id, op) {
        const before = el.source.value;
        const clean = applyVisualModel(model, reason, id, op);""",
    """      function canvasApply(model, reason, id, op, onWrite = null) {
        const before = el.source.value;
        const clean = applyVisualModel(model, reason, id, op, onWrite);""")

# ---------------------------------------------------------------- 8. a deliberate click clears the type guard
rep("""          canvasSelectedId = id;
          canvasHoveredId = '';
          canvasOverlayRepaint();
          canvasMaybeShowHint();""",
    """          canvasSelectedId = id;
          canvasHoveredId = '';
          canvasTypeSuppressed = false;
          canvasOverlayRepaint();
          canvasMaybeShowHint();""")

# ---------------------------------------------------------------- 9. a popover dismissed after a drag arms the guard
rep("""        else if (event.key === 'Escape') { event.preventDefault(); canvasClosePopover(); canvasRefocusCanvas(); }""",
    """        else if (event.key === 'Escape') { event.preventDefault(); canvasClosePopover(); canvasTypeSuppressed = true; canvasRefocusCanvas(); }""")

# ---------------------------------------------------------------- 10. in-place rename may start from a typed key
rep("""      function canvasBeginInplaceRename(id) {""",
    """      function canvasBeginInplaceRename(id, opts = null) {""")
rep("""        input.focus();
        input.select();
        canvasSelectedId = id;""",
    """        input.focus();
        input.select();
        if (opts && opts.replaceWith) {
          // Type to replace: the key that started it is the first letter of the new name.
          input.value = opts.replaceWith;
          input.setSelectionRange(input.value.length, input.value.length);
        }
        canvasSelectedId = id;""")

# ---------------------------------------------------------------- 11. the gestures
rep("""      /* ---- keyboard ---- */""",
    """      /* ---- G4 / G8: heal, delete, move - and the refusal ---- */

      // What a block's neighbours need when it leaves the flow. Every in x out pair becomes
      // one connector carrying the upstream label (the downstream one when the upstream is
      // blank). A connector that already exists is not made twice. A self-loop, or two
      // different labels that would have to share one connector, is a casualty - and a
      // casualty means the gesture refuses rather than quietly losing a path.
      function canvasHealPlan(model, id) {
        const name = x => canvasLabelOf(model, x);
        const ins = model.edges.filter(e => e.to === id && e.from !== id);
        const outs = model.edges.filter(e => e.from === id && e.to !== id);
        const drop = model.edges.filter(e => e.from === id || e.to === id);
        const add = [], casualties = [];
        ins.forEach(i => outs.forEach(o => {
          if (i.from === o.to) { casualties.push(`${name(i.from)} would point back at itself (${name(i.from)} \\u2192 ${name(id)} \\u2192 ${name(o.to)}).`); return; }
          const il = cleanVisualText(i.label || ''), ol = cleanVisualText(o.label || '');
          if (il && ol && il.toLowerCase() !== ol.toLowerCase()) {
            casualties.push(`\\u201c${il}\\u201d (into ${name(id)}) and \\u201c${ol}\\u201d (out of it) cannot both ride one connector from ${name(i.from)} to ${name(o.to)}.`);
            return;
          }
          const label = il || ol;
          const same = e => e.from === i.from && e.to === o.to && e.type === i.type && cleanVisualText(e.label || '').toLowerCase() === label.toLowerCase();
          if (model.edges.some(same) || add.some(same)) return;
          add.push({ from: i.from, to: o.to, type: i.type, label });
        }));
        return { ins, outs, add, drop, casualties };
      }

      function canvasRefuse(title, casualties, hint) {
        requestNotice({
          title,
          message: casualties.map(c => `\\u2022 ${c}`).join('\\n') + (hint ? `\\n\\n${hint}` : ''),
          closeText: 'Leave it as it is'
        });
      }

      // Sidecars keyed by a connector (styles, routes, review comments) follow the
      // connector: gone with it, or carried onto the one that replaces it.
      function canvasForgetEdges(removedEdges, carry) {
        const diagram = getActiveDiagram();
        if (!diagram) return;
        const keys = (removedEdges || []).map(e => edgeKey(e));
        if (carry && carry.from && carry.to) {
          const fromKey = edgeKey(carry.from), toKey = edgeKey(carry.to);
          ['edgeStyles'].forEach(bag => {
            const store = diagram[bag];
            if (store && typeof store === 'object' && store[fromKey] !== undefined && store[toKey] === undefined) { store[toKey] = store[fromKey]; }
          });
          if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).map(c => (c.targetType === 'edge' && c.targetId === fromKey) ? Object.assign({}, c, { targetId: toKey }) : c);
          keys.push(fromKey);
        }
        ['edgeStyles', 'edgeRoutes'].forEach(bag => {
          const store = diagram[bag];
          if (!store || typeof store !== 'object') return;
          keys.forEach(key => { delete store[key]; });
        });
        if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).filter(c => !(c.targetType === 'edge' && keys.includes(c.targetId)));
      }

      // G8 - Delete on a selected block: the block goes, its neighbours are joined.
      function canvasDeleteAndHeal(id) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const node = model.nodes.find(n => n.id === id);
        if (!node) return;
        const name = x => canvasLabelOf(model, x);
        const heal = canvasHealPlan(model, id);
        if (heal.casualties.length) {
          canvasRefuse(`Can\\u2019t delete ${name(id)} without losing a path`, heal.casualties, 'Delete the connector you can spare first, then the block.');
          return;
        }
        const next = heal.add[0] ? heal.add[0].to : (heal.outs[0] ? heal.outs[0].to : (heal.ins[0] ? heal.ins[0].from : ''));
        const gone = name(id);   // read before the block leaves the model
        model.nodes = model.nodes.filter(n => n.id !== id);
        model.edges = model.edges.filter(e => e.from !== id && e.to !== id);
        heal.add.forEach(e => model.edges.push(e));
        (model.subgraphs || []).forEach(g => { g.members = (g.members || []).filter(m => m !== id); });
        const dropped = heal.drop.slice();
        const op = { type: 'canvasHeal', id, add: heal.add };
        const selectId = next && model.nodes.some(n => n.id === next) ? next : (model.nodes[0] ? model.nodes[0].id : '');
        const done = canvasApply(model, `${gone} deleted`, selectId, op, () => { structureForgetNode(id); canvasForgetEdges(dropped, null); });
        if (!done) return;
        const stop = text => (/[.?!]$/.test(text) ? text : `${text}.`);
        const joins = heal.add.map(e => `${name(e.from)} now leads to ${name(e.to)}`);
        const said = joins.length > 2
          ? `${gone} removed; ${joins.length} connectors now bridge the gap. Undo restores it.`
          : joins.length
            ? `${gone} removed; ${stop(joins.join(', '))} Undo restores it.`
            : `${gone} removed${dropped.length ? ` with ${dropped.length} connector${dropped.length === 1 ? '' : 's'}` : ''}. Undo restores it.`;
        showToast(said, 'success');
      }

      // G4 - a block dropped on a connector: it leaves where it was (healed), and sits
      // inside that connector; the connector's label stays upstream of it.
      function canvasSplice(id, target) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const name = x => canvasLabelOf(model, x);
        if (!model.nodes.some(n => n.id === id) || !target) return;
        if (target.from === id || target.to === id) { showToast('That connector already touches this block.', 'error'); return; }
        const sameAs = e => e.from === target.from && e.to === target.to && e.type === target.type && String(e.label || '') === String(target.label || '');
        let k = model.edges.findIndex(sameAs);
        if (k < 0) k = model.edges.findIndex(e => e.from === target.from && e.to === target.to && e.type === target.type);
        if (k < 0) { showToast('That connector is not in the source any more.', 'error'); return; }
        const old = Object.assign({}, model.edges[k]);
        const heal = canvasHealPlan(model, id);
        if (heal.casualties.length) {
          canvasRefuse(`Can\\u2019t move ${name(id)} there without losing a path`, heal.casualties, 'Delete the connector you can spare first, then move the block.');
          return;
        }
        model.edges = model.edges.filter(e => e.from !== id && e.to !== id);
        heal.add.forEach(e => model.edges.push(e));
        const at = model.edges.findIndex(e => e.from === old.from && e.to === old.to && e.type === old.type && String(e.label || '') === String(old.label || ''));
        const first = { from: old.from, to: id, type: old.type, label: old.label || '' };
        const second = { from: id, to: old.to, type: old.type, label: '' };
        model.edges.splice(at, 1, first, second);
        let joinGroup = '';
        const inGroup = (model.subgraphs || []).some(g => (g.members || []).includes(id));
        if (!inGroup) {
          const g = (model.subgraphs || []).find(x => (x.members || []).includes(old.from) && (x.members || []).includes(old.to));
          if (g) { g.members.push(id); joinGroup = g.id; }
        }
        const dropped = heal.drop.slice();
        const op = { type: 'canvasMove', id, target: { from: old.from, to: old.to, type: old.type, label: old.label || '' }, add: heal.add, joinGroup };
        const done = canvasApply(model, `${name(id)} moved between ${name(old.from)} and ${name(old.to)}`, id, op, () => canvasForgetEdges(dropped, { from: old, to: first }));
        if (!done) return;
        const stop = text => (/[.?!]$/.test(text) ? text : `${text}.`);
        const joins = heal.add.map(e => `${name(e.from)} now leads to ${name(e.to)}`);
        const tail = joins.length > 2 ? ` ${joins.length} connectors bridge where it was.` : (joins.length ? ` ${stop(joins.join(', '))}` : '');
        showToast(`${stop(`${name(id)} now sits between ${name(old.from)} and ${name(old.to)}`)}${tail}`, 'success');
      }

      // Keyboard route for G4: the connectors as a list, named by both ends.
      function canvasOpenSpliceMenu(id) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const name = x => canvasLabelOf(model, x);
        const rows = model.edges.map((e, index) => [String(index), `between ${name(e.from)} and ${name(e.to)}${e.label ? ` (${cleanVisualText(e.label)})` : ''}`, (e.from === id || e.to === id) ? 'Already touches this block' : false]);
        if (!rows.length) { showToast('There is no connector to move into yet.', 'error'); return; }
        const anchor = findSvgNodeGroups(el.diagram, id)[0] || el.zoomViewport;
        openStructureMenu(anchor, [[null, `Move ${name(id)} into a connector`, 'heading']].concat(rows), '', picked => {
          const edge = model.edges[Number(picked)];
          if (edge) canvasSplice(id, { from: edge.from, to: edge.to, type: edge.type, label: edge.label || '' });
        }, { keyboard: true, role: 'menu', label: 'Move into a connector', plain: true });
      }

      /* ---- the body drag that carries a block onto a connector ---- */

      function canvasBeginBodyPress(event, target) {
        if (event.pointerType === 'touch' || event.button !== 0 || !canvasBuilderAvailable()) return;
        if (connectMode || edgeWaypointMode || multiSelection.size >= 2) return;
        if (!target || !target.closest('#diagram')) return;
        if (target.closest('a, button, input, select, textarea')) return;
        const id = resolveNodeIdFromElement(target);
        if (!id || !canvasReadModel()) return;
        canvasMove = { id, pointerId: event.pointerId, x0: event.clientX, y0: event.clientY, moved: false, ghost: null, edgeEl: null, edgeVis: null, edge: null };
      }

      // The connector under the pointer, if it is one the block could move into.
      function canvasEdgeHit(x, y, id) {
        const layer = canvasLayer(canvasSvg());
        if (layer) layer.style.pointerEvents = 'none';
        let target = null;
        try { target = document.elementFromPoint(x, y); } finally { if (layer) layer.style.pointerEvents = ''; }
        if (!(target instanceof Element) || !target.closest('#diagram')) return { el: null, edge: null };
        if (resolveNodeIdFromElement(target)) return { el: null, edge: null };
        const edge = resolveEdgeFromElement(target);
        if (!edge || edge.from === id || edge.to === id) return { el: null, edge: null };
        const node = target.closest('path.t-edge-hitarea, [data-edge-key], path.flowchart-link, .edgePath') || target;
        return { el: node, edge };
      }

      // The hit-area keeps its stroke inline and !important (so clicks land on a thin line);
      // lighting it means writing the same way, and putting it back after.
      function canvasLightEdge(mv, on) {
        if (mv.edgeEl) {
          mv.edgeEl.classList.toggle('t-canvas-drop-edge', on);
          if (mv.edgeEl.classList.contains('t-edge-hitarea')) mv.edgeEl.style.setProperty('stroke', on ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'transparent', 'important');
        }
        if (mv.edgeVis) mv.edgeVis.classList.toggle('t-canvas-drop-edge', on);
      }

      function canvasMoveSetEdge(mv, hit) {
        if (mv.edgeEl === hit.el) return;
        canvasLightEdge(mv, false);
        mv.edgeEl = hit.el;
        mv.edge = hit.edge;
        // The drawn connector beneath the hit band lights too.
        mv.edgeVis = hit.el && hit.el.dataset && hit.el.dataset.hitFor ? document.getElementById(hit.el.dataset.hitFor) : null;
        canvasLightEdge(mv, true);
        if (mv.ghost) {
          const model = canvasReadModel();
          const name = x => canvasLabelOf(model, x);
          mv.ghost.dataset.ok = mv.edge ? 'true' : 'false';
          mv.ghost.textContent = mv.edge ? `${name(mv.id)} \\u2192 between ${name(mv.edge.from)} and ${name(mv.edge.to)}` : `${name(mv.id)} \\u00b7 drop on a connector`;
        }
      }

      function handleCanvasMoveMove(event) {
        if (!canvasMove || event.pointerId !== canvasMove.pointerId) return;
        const mv = canvasMove;
        if (!mv.moved) {
          if (Math.hypot(event.clientX - mv.x0, event.clientY - mv.y0) < 8) return;
          mv.moved = true;
          canvasClosePopover();
          canvasCancelInplace();
          document.body.classList.add('is-canvas-moving');
          findSvgNodeGroups(el.diagram, mv.id).forEach(group => group.classList.add('t-canvas-moving'));
          const ghost = document.createElement('div');
          ghost.className = 'canvas-move-ghost';
          ghost.setAttribute('aria-hidden', 'true');
          document.body.appendChild(ghost);
          mv.ghost = ghost;
          ghost.dataset.ok = 'false';
          ghost.textContent = `${canvasLabelOf(canvasReadModel(), mv.id)} \\u00b7 drop on a connector`;
          canvasSelectedId = mv.id;
          canvasHoveredId = '';
          canvasOverlayRepaint();
        }
        if (event.cancelable) event.preventDefault();
        mv.ghost.style.left = `${Math.round(event.clientX + 14)}px`;
        mv.ghost.style.top = `${Math.round(event.clientY + 14)}px`;
        canvasMoveSetEdge(mv, canvasEdgeHit(event.clientX, event.clientY, mv.id));
      }

      function canvasMoveCleanup(mv) {
        if (!mv) return;
        canvasLightEdge(mv, false);
        if (mv.ghost) mv.ghost.remove();
        findSvgNodeGroups(el.diagram, mv.id).forEach(group => group.classList.remove('t-canvas-moving'));
        document.body.classList.remove('is-canvas-moving');
      }

      function handleCanvasMoveEnd(event) {
        if (!canvasMove || event.pointerId !== canvasMove.pointerId) return;
        const mv = canvasMove;
        canvasMove = null;
        if (!mv.moved) return;
        canvasMoveCleanup(mv);
        canvasMoveSuppressClickUntil = performance.now() + 400;
        if (mv.edge) { canvasSplice(mv.id, mv.edge); return; }
        // A drag that produced nothing: the next keystroke must not rename the block.
        canvasTypeSuppressed = true;
      }

      function handleCanvasMoveCancel(event) {
        if (!canvasMove || event.pointerId !== canvasMove.pointerId) return;
        const mv = canvasMove;
        canvasMove = null;
        canvasMoveCleanup(mv);
        canvasTypeSuppressed = true;
      }

      /* ---- keyboard ---- */""")

# ---------------------------------------------------------------- 12. keyboard: Escape during a move; Delete; Ctrl+Shift+I; type-to-replace
rep("""        if (canvasDrag && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); canvasDragCancel(); return; }""",
    """        if (canvasDrag && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); canvasDragCancel(); return; }
        if (canvasMove && canvasMove.moved && event.key === 'Escape') {
          event.preventDefault(); event.stopImmediatePropagation();
          const mv = canvasMove; canvasMove = null; canvasMoveCleanup(mv); canvasTypeSuppressed = true;
          return;
        }""")
rep("""        if (event.key === 'F2' && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (!canvasBeginInplaceRename(canvasSelectedId) && !canvasModel()) showToast(CANVAS_CODE_ONLY, 'error');
        }
      }""",
    """        if (event.key === 'F2' && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasTypeSuppressed = false;
          if (!canvasBeginInplaceRename(canvasSelectedId) && !canvasModel()) showToast(CANVAS_CODE_ONLY, 'error');
          return;
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && !mod && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasDeleteAndHeal(canvasSelectedId);
          return;
        }
        if (mod && event.shiftKey && !event.altKey && (event.key === 'I' || event.key === 'i')) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasOpenSpliceMenu(canvasSelectedId);
          return;
        }
        // Type to replace: a printable key on a selected block starts renaming it, the key
        // as the first letter. Never after a drag that produced nothing, never the help key.
        if (event.key.length === 1 && !mod && !event.altKey && !canvasTypeSuppressed && event.key !== '?' && event.key !== '/') {
          if (canvasBeginInplaceRename(canvasSelectedId, { replaceWith: event.key })) { event.preventDefault(); event.stopImmediatePropagation(); }
        }
      }""")

# ---------------------------------------------------------------- 13. bind the move listeners
rep("""        window.addEventListener('pointermove', handleCanvasDragMove);
        window.addEventListener('pointerup', handleCanvasDragEnd);
        window.addEventListener('pointercancel', handleCanvasDragCancel);""",
    """        window.addEventListener('pointermove', handleCanvasDragMove);
        window.addEventListener('pointerup', handleCanvasDragEnd);
        window.addEventListener('pointercancel', handleCanvasDragCancel);
        window.addEventListener('pointermove', handleCanvasMoveMove);
        window.addEventListener('pointerup', handleCanvasMoveEnd);
        window.addEventListener('pointercancel', handleCanvasMoveCancel);""")

# ---------------------------------------------------------------- 14. the hint says what the canvas can do now
rep("""          text.textContent = 'Drag a handle to add a step \\u00b7 F2 to rename';""",
    """          text.textContent = 'Drag a handle to add a step \\u00b7 drag a block onto a connector to move it \\u00b7 Delete removes and reconnects';""")

# ---------------------------------------------------------------- 15. CSS
rep("""    #diagram g.node.t-canvas-drop, #diagram [data-node-id].t-canvas-drop { filter: drop-shadow(0 0 7px var(--success)) drop-shadow(0 0 2px var(--success)); }""",
    """    #diagram g.node.t-canvas-drop, #diagram [data-node-id].t-canvas-drop { filter: drop-shadow(0 0 7px var(--success)) drop-shadow(0 0 2px var(--success)); }
    /* A block's body on its way to a connector (phase 2). */
    body.is-canvas-moving, body.is-canvas-moving * { cursor: grabbing !important; user-select: none; }
    #diagram g.node.t-canvas-moving, #diagram [data-node-id].t-canvas-moving { opacity: .55; }
    #diagram path.flowchart-link.t-canvas-drop-edge, #diagram .edgePath.t-canvas-drop-edge path { stroke: var(--primary) !important; stroke-width: 4px !important; }
    .canvas-move-ghost {
      position: fixed;
      z-index: 2500;
      max-width: 300px;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel-bg);
      color: var(--text);
      box-shadow: var(--shadow-soft);
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .canvas-move-ghost[data-ok="true"] { border-color: var(--primary); color: var(--primary); }""")

# ---------------------------------------------------------------- 16. version + changelog
rep("const APP_VERSION = '1.59.3';", "const APP_VERSION = '1.60.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.59.3',""",
    """      const CHANGELOG = [
        {
          version: '1.60.0',
          notes: [
            'Canvas, phase 2: drag a block\\u2019s body onto a connector to move it there \\u2014 it leaves where it was, its neighbours are joined, and the connector\\u2019s label stays upstream. Ctrl+Shift+I lists the connectors by name instead.',
            'Delete (or Backspace) on a selected block removes it and reconnects what fed it to what it fed, in one key and one Undo. The toast says exactly what now leads where.',
            'Neither gesture will ever quietly lose a path: when two different branch labels would have to share one connector, or a block would be left pointing at itself, the canvas refuses and names what it would lose.',
            'Type on a selected block to rename it from the first letter (F2 and double-click still work). It never fires after a drag that produced nothing.'
          ]
        },
        {
          version: '1.59.3',""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_pre_canvas_phase2.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('canvas phase 2 applied: %d -> %d chars' % (len(orig), len(s)))
