# SIREN canvas job, patch 1 of 2: the NOTE.
# A note is a block hung on exactly one dotted arrowless link (`B -.- N1["..."]`).
# This script lets `-.-` through the writer/serializer/parser whitelists, derives
# the note look from structure (no sidecar), protects notes from heal / branch
# default / arrow walk / connect, and gives the canvas popover a Note chip and a
# "Note:" prefix route. Usage: python patch_canvas_1_notes.py <path-to-app.html>
import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s
def rep(anchor, new, n=1):
    global s; c = s.count(anchor); assert c == n, (c, anchor[:90]); s = s.replace(anchor, new)

# ---- 1. whitelists: `-.-` becomes a writable connector type (one token each) ----
rep("const SURG_WRITABLE = ['-->', '---', '-.->', '==>'];",
    "const SURG_WRITABLE = ['-->', '---', '-.->', '-.-', '==>'];")
rep("const EDGE_TYPES = ['-->','---','-.->','==>'];",
    "const EDGE_TYPES = ['-->','---','-.->','-.-','==>'];")
# parseVisualFlowchartSource's single-hop regex (the one WITHOUT the `;?` tail)
rep(r"""const edgeRegex = new RegExp(`^\\s*${nodePattern}\\s*(-->|---|-\\.->|==>)\\s*(?:\\|([^|]+)\\|\\s*)?${nodePattern}\\s*$`);""",
    r"""const edgeRegex = new RegExp(`^\\s*${nodePattern}\\s*(-->|---|-\\.->|-\\.-|==>)\\s*(?:\\|([^|]+)\\|\\s*)?${nodePattern}\\s*$`);""")
rep("const writableArrows = ['-->', '---', '-.->', '==>'];",
    "const writableArrows = ['-->', '---', '-.->', '-.-', '==>'];")
rep("const type = new Set(['-->','---','-.->','==>']).has(el.visualEdgeType.value) ? el.visualEdgeType.value : '-->';",
    "const type = new Set(['-->','---','-.->','-.-','==>']).has(el.visualEdgeType.value) ? el.visualEdgeType.value : '-->';")
# the offline renderer draws it dotted and without an arrowhead
rep("""const dash = edge.type === '-.->' ? ' stroke-dasharray="7 5"' : '';""",
    """const dash = (edge.type === '-.->' || edge.type === '-.-') ? ' stroke-dasharray="7 5"' : '';""")
rep("""const marker = edge.type === '---' ? '' : ` marker-end="url(#${markerId})"`;""",
    """const marker = (edge.type === '---' || edge.type === '-.-') ? '' : ` marker-end="url(#${markerId})"`;""")
# the two connector-type selects (visual panel, edge inspector) - without the option the
# inspector would silently rewrite a note's link to '-->' on Done
rep("""                      <option value="---">Line without arrow</option>
""",
    """                      <option value="---">Line without arrow</option>
                      <option value="-.-">Dotted line (note)</option>
""")
rep("""            <option value="---">Line without arrow</option>
          </select>""",
    """            <option value="---">Line without arrow</option>
            <option value="-.-">Dotted line (note)</option>
          </select>""")

# ---- 2. the look, derived from structure on every render (same lifetime as __ruleClasses) ----
rep("""      // Resolve the effective style for a block: class first, then per-block overrides.
      function resolveNodeStyle(diagram, id) {
        // A rule-assigned class stands in when the block has no class of its own.
        const className = (diagram?.nodeClasses || {})[id] || (diagram?.__ruleClasses || {})[id];
        const fromClass = className ? (diagram?.styleClasses || {})[className] : null;
        const own = (diagram?.nodeStyles || {})[id] || {};
        return { ...(fromClass || {}), ...own };
      }
""",
    """      // Resolve the effective style for a block: class first, then per-block overrides.
      function resolveNodeStyle(diagram, id) {
        // A rule-assigned class stands in when the block has no class of its own.
        const className = (diagram?.nodeClasses || {})[id] || (diagram?.__ruleClasses || {})[id];
        const fromClass = className ? (diagram?.styleClasses || {})[className] : null;
        const own = (diagram?.nodeStyles || {})[id] || {};
        // A note (a block hung on one dotted arrowless link) reads as a sticky; the look
        // comes from the structure, never from a sidecar, so paste/undo/id reuse can't lie.
        const fromNote = (diagram?.__noteIds || {})[id] ? canvasNoteStyle() : null;
        return { ...(fromNote || {}), ...(fromClass || {}), ...own };
      }
""")
rep("""          ...Object.keys(diagram?.nodeClasses || {}),
          ...Object.keys(diagram?.__ruleClasses || {})
        ]);""",
    """          ...Object.keys(diagram?.nodeClasses || {}),
          ...Object.keys(diagram?.__ruleClasses || {}),
          ...Object.keys(diagram?.__noteIds || {})
        ]);""")
rep("""        if (diagram) diagram.__ruleClasses = ruleClassesFor(diagram);
        const styles = resolvedNodeStyleMap(diagram);
        Object.entries(styles).forEach(([id, style]) => {
          findSvgNodeGroups(root, id)""",
    """        if (diagram) diagram.__ruleClasses = ruleClassesFor(diagram);
        if (diagram) diagram.__noteIds = canvasNoteIdsForSource(diagram.source || '');
        const styles = resolvedNodeStyleMap(diagram);
        Object.entries(styles).forEach(([id, style]) => {
          findSvgNodeGroups(root, id)""")

# ---- 3. the planner: a canvas 'after' step may carry its own connector type (the note's `-.-`) ----
rep("""        if (op.mode === 'after') {
          const arrow = surgArrowText(idx, '-->', op.edgeLabel || '', op.forbidMid);""",
    """        if (op.mode === 'after') {
          const arrow = surgArrowText(idx, op.edgeType || '-->', op.edgeLabel || '', op.forbidMid);""")
# the heal removes the notes that hung on the deleted block, with it
rep("""      function surgPlanCanvasHeal(idx, op) {
        if (!idx.nodes.has(op.id)) return surgNoPlan(`no block ${op.id}`);
        const shrink = surgChainShrink(idx, op.id, op.add || []);
        if (shrink) return { edits: [shrink.span], notes: [], ask: null };
        const { edits } = surgRemovePlan(idx, new Set(), new Set([op.id]));""",
    """      function surgPlanCanvasHeal(idx, op) {
        if (!idx.nodes.has(op.id)) return surgNoPlan(`no block ${op.id}`);
        const shrink = surgChainShrink(idx, op.id, op.add || []);
        if (shrink) return { edits: [shrink.span], notes: [], ask: null };
        // The notes hung on the block leave with it (op.notes: their ids).
        const { edits } = surgRemovePlan(idx, new Set(), new Set([op.id].concat((op.notes || []).filter(n => idx.nodes.has(n)))));""")
# a moved block keeps its note: the dotted link is not one of the hops the move detaches
rep("""        const incident = new Set(idx.hops.filter(h => h.from.id === op.id || h.to.id === op.id).map(h => h.index));
        const removed = incident.size ? surgRemovePlan(idx, incident, new Set()).edits : [];""",
    """        const incident = new Set(idx.hops.filter(h => (h.from.id === op.id || h.to.id === op.id) && h.type !== '-.-').map(h => h.index));
        const removed = incident.size ? surgRemovePlan(idx, incident, new Set()).edits : [];""")

# ---- 4. canvas module: the predicate, the style, the protections ----
rep("""        { shape: 'cylinder', name: 'Database', glyph: '<path d="M1.5 3.5 v7 a8.5 2 0 0 0 17 0 v-7 a8.5 2 0 0 0 -17 0 a8.5 2 0 0 0 17 0"/>' }
      ];""",
    """        { shape: 'cylinder', name: 'Database', glyph: '<path d="M1.5 3.5 v7 a8.5 2 0 0 0 17 0 v-7 a8.5 2 0 0 0 -17 0 a8.5 2 0 0 0 17 0"/>' },
        { shape: 'note', name: 'Note', glyph: '<path d="M2 1.5h11l5 5v6H2z"/><path d="M13 1.5v5h5"/>' }
      ];
      const CANVAS_NOTE_TOAST = 'A note only hangs on its block. Delete it and add a step instead.';""")
rep("""      function canvasLabelOf(model, id) {
        const node = model && model.nodes.find(item => item.id === id);
        return node ? (node.label || node.id) : id;
      }
""",
    """      function canvasLabelOf(model, id) {
        const node = model && model.nodes.find(item => item.id === id);
        return node ? (node.label || node.id) : id;
      }
      // A NOTE is a plain rectangle at the far end of exactly one `-.-` link and nothing
      // else - `B -.- N1[...]`, the way the canvas writes it. The block it hangs on is
      // never the note, even when that link is the block's only one (a fresh "New block"
      // plus its first note), and a dotted line typed between two steps makes no note at
      // all. Defined by structure, so the picture can never claim a note the code lacks.
      function canvasIsNote(model, id) {
        if (!model) return false;
        const links = model.edges.filter(e => e.from === id || e.to === id);
        if (links.length !== 1 || links[0].type !== '-.-' || links[0].to !== id || links[0].from === id) return false;
        const node = model.nodes.find(item => item.id === id);
        return !node || !node.shape || node.shape === 'rect';
      }
      function canvasNoteIds(model) {
        const out = new Set();
        if (model) model.nodes.forEach(n => { if (canvasIsNote(model, n.id)) out.add(n.id); });
        return out;
      }
      // For the render painter: { id: true } for every note in a source, {} when the
      // source is not canvas-compatible (then nothing is a note).
      function canvasNoteIdsForSource(source) {
        const out = {};
        try {
          const model = parseVisualFlowchartSource(String(source || ''));
          if (model && model.compatible) canvasNoteIds(model).forEach(id => { out[id] = true; });
        } catch (error) { /* an unparseable source has no notes */ }
        return out;
      }
      // One sticky-yellow for both themes (hex, as sanitizeNodeStyles accepts).
      function canvasNoteStyle() { return { fill: '#fff4bf', border: '#d9a400', text: '#3b2f00' }; }
""")
# no ring on a note (Delete / F2 / type-to-replace still work on a selected note)
rep("""        const id = canvasDrag ? canvasDrag.id : (canvasHoveredId || canvasSelectedId);
        if (!id) return;
        const frame = canvasNodeFrame(svg, id);
        if (!frame) return;
        const k = canvasScale(svg);
        const axes = canvasAxes(model);
        const name = canvasLabelOf(model, id);""",
    """        const id = canvasDrag ? canvasDrag.id : (canvasHoveredId || canvasSelectedId);
        if (!id) return;
        if (canvasIsNote(model, id)) return;   // a note does not grow: no ring
        const frame = canvasNodeFrame(svg, id);
        if (!frame) return;
        const k = canvasScale(svg);
        const axes = canvasAxes(model);
        const name = canvasLabelOf(model, id);""")
# the keyboard routes that open a popover on the selection refuse on a note
rep("""      function canvasOpenPopoverAtSelection(role) {
        const id = canvasSelectedId;
        const svg = canvasSvg();
        if (!id || !svg) return;
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        const frame = canvasNodeFrame(svg, id);""",
    """      function canvasOpenPopoverAtSelection(role) {
        const id = canvasSelectedId;
        const svg = canvasSvg();
        if (!id || !svg) return;
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        if (canvasIsNote(model, id)) { showToast(CANVAS_NOTE_TOAST, 'error'); return; }
        const frame = canvasNodeFrame(svg, id);""")
# the popover: "Note:" prefix picks the Note chip; the Note chip changes the hint
rep("""      function canvasSetPopoverShape(shape, auto) {
        if (!canvasPopover) return;
        canvasPopover.shape = shape;
        canvasPopover.auto = Boolean(auto);
        canvasPopover.el.querySelectorAll('.canvas-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.shape === shape)));
      }""",
    """      function canvasSetPopoverShape(shape, auto) {
        if (!canvasPopover) return;
        canvasPopover.shape = shape;
        canvasPopover.auto = Boolean(auto);
        canvasPopover.el.querySelectorAll('.canvas-chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.shape === shape)));
        // The hint says what Enter will do: a note hangs on the block, whatever the handle.
        const hint = canvasPopover.el.querySelector('.canvas-pop-hint');
        if (hint && canvasPopover.hint != null) {
          hint.innerHTML = shape === 'note' && canvasPopover.sourceId
            ? `A note hung on ${escapeHtml(canvasLabelOf(canvasModel(), canvasPopover.sourceId))}. Enter to place \\u00b7 Esc to cancel.`
            : canvasPopover.hint;
        }
      }""")
rep("""        const wantsDecision = /\\?\\s*$/.test(event.target.value);
        if (wantsDecision && canvasPopover.shape === 'rect') canvasSetPopoverShape('diamond', true);
        else if (!wantsDecision && canvasPopover.shape === 'diamond' && canvasPopover.auto) canvasSetPopoverShape('rect', true);""",
    """        const wantsDecision = /\\?\\s*$/.test(event.target.value);
        // "Note: ..." (or "NB: ...") on a block's popover means a note, not a step.
        const wantsNote = Boolean(canvasPopover.sourceId) && /^(note|nb)\\b\\s*[:\\-\\u2013\\u2014]/i.test(event.target.value);
        if (wantsNote && canvasPopover.shape !== 'note') canvasSetPopoverShape('note', true);
        else if (!wantsNote && canvasPopover.shape === 'note' && canvasPopover.auto) canvasSetPopoverShape('rect', true);
        else if (wantsDecision && canvasPopover.shape === 'rect') canvasSetPopoverShape('diamond', true);
        else if (!wantsDecision && canvasPopover.shape === 'diamond' && canvasPopover.auto) canvasSetPopoverShape('rect', true);""")
# remember the default hint so the Note chip can put it back
rep("""        pop.hidden = false;
        canvasPlacePopover(pop, clientX, clientY);
        const input = pop.querySelector('#canvasPopLabel');
        if (input) input.focus();
        return true;
      }""",
    """        pop.hidden = false;
        const hintEl = pop.querySelector('.canvas-pop-hint');
        canvasPopover.hint = hintEl ? hintEl.innerHTML : '';
        canvasPlacePopover(pop, clientX, clientY);
        const input = pop.querySelector('#canvasPopLabel');
        if (input) input.focus();
        return true;
      }""")
# commit: a note never "connects" to an existing name
rep("""        if (existing && st.role !== 'back') canvasConnect({ id: st.sourceId, role: 'fwd' }, existing.id);
        else if (st.role === 'back') canvasInsertBefore(st.sourceId, label, shape);
        else canvasGrow(st.sourceId, label, shape, branch);
        canvasRefocusCanvas();""",
    """        if (shape === 'note') canvasAddNote(st.sourceId, label);
        else if (existing && st.role !== 'back') canvasConnect({ id: st.sourceId, role: 'fwd' }, existing.id);
        else if (st.role === 'back') canvasInsertBefore(st.sourceId, label, shape);
        else canvasGrow(st.sourceId, label, shape, branch);
        canvasRefocusCanvas();""")
# the branch default ignores the note link
rep("""        const labels = model.edges.filter(edge => edge.from === sourceId).map(edge => cleanVisualText(edge.label).toLowerCase());
        if (labels.length >= 2) return '';""",
    """        const labels = model.edges.filter(edge => edge.from === sourceId && edge.type !== '-.-').map(edge => cleanVisualText(edge.label).toLowerCase());
        if (labels.length >= 2) return '';""")
# the note mutation, next to canvasGrow
rep("""      // G2 - the step before, from the back handle / Ctrl+Shift+Enter. Everything that
      // fed the block now feeds the new step; branch labels stay upstream.
      function canvasInsertBefore(targetId, label, shape) {""",
    """      // A note hung on the block: one `-.-` line after the block's last mention, inside
      // its group when it has one. The look follows from the structure (canvasIsNote).
      function canvasAddNote(sourceId, label) {
        const model = canvasModel();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        if (!model.nodes.some(node => node.id === sourceId)) return;
        if (canvasIsNote(model, sourceId)) { showToast(CANVAS_NOTE_TOAST, 'error'); return; }
        const id = nextVisualNodeId(model.nodes);
        const op = { type: 'canvasStep', mode: 'after', anchorId: sourceId, id, label, shape: 'rect', edgeLabel: '', edgeType: '-.-' };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: 'rect', order: model.nodes.length });
        model.edges.push({ from: sourceId, to: id, type: '-.-', label: '' });
        canvasJoinGroup(model, groupId, id);
        canvasApply(model, 'Note added from the canvas', id, op);
      }

      // G2 - the step before, from the back handle / Ctrl+Shift+Enter. Everything that
      // fed the block now feeds the new step; branch labels stay upstream.
      function canvasInsertBefore(targetId, label, shape) {""")
# connect refuses a note at either end
rep("""        const from = drag.role === 'back' ? hitId : drag.id;
        const to = drag.role === 'back' ? drag.id : hitId;
        if (!model.nodes.some(node => node.id === from) || !model.nodes.some(node => node.id === to)) return;
        if (from === to) { showToast('A block cannot lead to itself.', 'error'); return; }""",
    """        const from = drag.role === 'back' ? hitId : drag.id;
        const to = drag.role === 'back' ? drag.id : hitId;
        if (!model.nodes.some(node => node.id === from) || !model.nodes.some(node => node.id === to)) return;
        if (canvasIsNote(model, from) || canvasIsNote(model, to)) { showToast(CANVAS_NOTE_TOAST, 'error'); return; }
        if (from === to) { showToast('A block cannot lead to itself.', 'error'); return; }""")
# heal: the note link is not a path; the notes on the block are listed for the caller
rep("""        const ins = model.edges.filter(e => e.to === id && e.from !== id);
        const outs = model.edges.filter(e => e.from === id && e.to !== id);
        const drop = model.edges.filter(e => e.from === id || e.to === id);
        const add = [], casualties = [];""",
    """        const ins = model.edges.filter(e => e.to === id && e.from !== id && e.type !== '-.-');
        const outs = model.edges.filter(e => e.from === id && e.to !== id && e.type !== '-.-');
        // The dotted link to a note is not a path: it is never healed across, and a move
        // leaves it where it is (the note travels with its block).
        const drop = model.edges.filter(e => (e.from === id || e.to === id) && e.type !== '-.-');
        const notes = model.edges.filter(e => e.type === '-.-' && (e.from === id || e.to === id))
          .map(e => (e.from === id ? e.to : e.from)).filter(n => n !== id && canvasIsNote(model, n));
        const add = [], casualties = [];""")
rep("""        return { ins, outs, add, drop, casualties };
      }""",
    """        return { ins, outs, add, drop, casualties, notes };
      }""")
# delete: the notes go with the block; the toast says so
rep("""        const gone = name(id);   // read before the block leaves the model
        model.nodes = model.nodes.filter(n => n.id !== id);
        model.edges = model.edges.filter(e => e.from !== id && e.to !== id);
        heal.add.forEach(e => model.edges.push(e));
        (model.subgraphs || []).forEach(g => { g.members = (g.members || []).filter(m => m !== id); });
        const dropped = heal.drop.slice();
        const op = { type: 'canvasHeal', id, add: heal.add };""",
    """        const gone = name(id);   // read before the block leaves the model
        const leaving = new Set([id].concat(heal.notes));   // the block and the notes hung on it
        const dropped = model.edges.filter(e => leaving.has(e.from) || leaving.has(e.to));   // every connector that goes, note links included
        model.nodes = model.nodes.filter(n => !leaving.has(n.id));
        model.edges = model.edges.filter(e => !leaving.has(e.from) && !leaving.has(e.to));
        heal.add.forEach(e => model.edges.push(e));
        (model.subgraphs || []).forEach(g => { g.members = (g.members || []).filter(m => !leaving.has(m)); });
        const op = { type: 'canvasHeal', id, add: heal.add, notes: heal.notes.slice() };""")
rep("""        const done = canvasApply(model, `${gone} deleted`, selectId, op, () => { structureForgetNode(id); canvasForgetEdges(dropped, null); });
        if (!done) return;
        const stop = text => (/[.?!]$/.test(text) ? text : `${text}.`);
        const joins = heal.add.map(e => `${name(e.from)} now leads to ${name(e.to)}`);
        const said = joins.length > 2
          ? `${gone} removed; ${joins.length} connectors now bridge the gap. Undo restores it.`
          : joins.length
            ? `${gone} removed; ${stop(joins.join(', '))} Undo restores it.`
            : `${gone} removed${dropped.length ? ` with ${dropped.length} connector${dropped.length === 1 ? '' : 's'}` : ''}. Undo restores it.`;""",
    """        const done = canvasApply(model, `${gone} deleted`, selectId, op, () => { leaving.forEach(n => structureForgetNode(n)); canvasForgetEdges(dropped, null); });
        if (!done) return;
        const stop = text => (/[.?!]$/.test(text) ? text : `${text}.`);
        const joins = heal.add.map(e => `${name(e.from)} now leads to ${name(e.to)}`);
        const withNotes = heal.notes.length ? ` with its note${heal.notes.length === 1 ? '' : 's'}` : '';
        const said = joins.length > 2
          ? `${gone} removed${withNotes}; ${joins.length} connectors now bridge the gap. Undo restores it.`
          : joins.length
            ? `${gone} removed${withNotes}; ${stop(joins.join(', '))} Undo restores it.`
            : `${gone} removed${withNotes}${dropped.length ? ` ${withNotes ? 'and' : 'with'} ${dropped.length} connector${dropped.length === 1 ? '' : 's'}` : ''}. Undo restores it.`;""")
# move (splice): the note link stays in the model, so the note travels with its block
rep("""        model.edges = model.edges.filter(e => e.from !== id && e.to !== id);
        heal.add.forEach(e => model.edges.push(e));
        const at = model.edges.findIndex(e => e.from === old.from && e.to === old.to && e.type === old.type && String(e.label || '') === String(old.label || ''));""",
    """        model.edges = model.edges.filter(e => !(e.from === id || e.to === id) || e.type === '-.-');
        heal.add.forEach(e => model.edges.push(e));
        const at = model.edges.findIndex(e => e.from === old.from && e.to === old.to && e.type === old.type && String(e.label || '') === String(old.label || ''));""")
# the arrow walk along the flow never lands on a note (across, it may - so it is selectable)
rep("""          const ids = forward
            ? model.edges.filter(e => e.from === id && e.to !== id).map(e => e.to)
            : model.edges.filter(e => e.to === id && e.from !== id).map(e => e.from);""",
    """          const ids = forward
            ? model.edges.filter(e => e.from === id && e.to !== id && e.type !== '-.-').map(e => e.to)
            : model.edges.filter(e => e.to === id && e.from !== id && e.type !== '-.-').map(e => e.from);""")

# ---- 5. the popover is 300px wide: five chips fit without clipping ----
rep("""    .canvas-popover {
      position: fixed;
      z-index: 1500;
      width: 256px;""",
    """    .canvas-popover {
      position: fixed;
      z-index: 1500;
      width: 300px;""")
rep("""        const width = pop.offsetWidth || 256, height = pop.offsetHeight || 150;""",
    """        const width = pop.offsetWidth || 300, height = pop.offsetHeight || 150;""")

# ---- 6. copy ----
rep("""Ctrl+Enter adds the next step, Ctrl+Shift+Enter inserts one before · F2 (or just typing) renames""",
    """Ctrl+Enter adds the next step, Ctrl+Shift+Enter inserts one before · a name starting “Note:” (or the Note chip) hangs a note on the block · F2 (or just typing) renames""")
rep("""          text.textContent = 'Drag a handle to add a step \\u00b7 drag a block onto a connector to move it \\u00b7 Delete removes and reconnects';""",
    """          text.textContent = 'Drag a handle to add a step \\u00b7 type \\u201cNote: \\u2026\\u201d for a note \\u00b7 drag a block onto a connector to move it \\u00b7 Delete removes and reconnects';""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
