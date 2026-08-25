r"""Canvas phase 4 - G6 reorder siblings, only with verification (spec sections 1.2, 4, 5).

With a block selected, `[` swaps it with the neighbouring branch on its left, `]` on its
right (for LR/RL layouts: above / below). The swap is the order of the two connectors out
of the shared predecessor - written surgically only when each connector is the whole of its
line (else a plain refusal). Then the diagram is re-drawn and the two blocks' rendered order
is read back: if it flipped, the toast says so; if not (branches that rejoin further down -
dagre decides their order), the change is undone silently and the reason stated. Never a
swap that did not happen.
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

# ---------------------------------------------------------------- 1. planner: swap two whole-line connectors
rep("""      function planSurgicalEdit(idx, op) {
        switch (op && op.type) {""",
    """      // G6 - two connectors trade places in the file. Only when each is the whole of its
      // line: then the swap is two lines exchanging their text, and nothing else moves.
      function surgPlanSwapEdges(idx, op) {
        const a = idx.hops[op.a], b = idx.hops[op.b];
        if (!a || !b) return surgNoPlan('no such connector');
        const whole = h => h.statement.onLine === 1 && h.statement.steps.length === 1 && h.statement.kind === 'chain';
        if (!whole(a) || !whole(b)) return surgNoPlan('These two connectors share a line with others; swap them in the code.');
        if (a.line === b.line) return { edits: [], notes: [], ask: null };
        const sa = a.statement, sb = b.statement;
        const textA = idx.lines[sa.line].slice(sa.start, sa.end), textB = idx.lines[sb.line].slice(sb.start, sb.end);
        return { edits: [
          { op: 'span', line: sa.line, start: sa.start, end: sa.end, text: textB },
          { op: 'span', line: sb.line, start: sb.start, end: sb.end, text: textA }
        ], notes: [], ask: null };
      }

      function planSurgicalEdit(idx, op) {
        switch (op && op.type) {""")
rep("""          case 'canvasSplice': return surgPlanCanvasSplice(idx, op);""",
    """          case 'canvasSplice': return surgPlanCanvasSplice(idx, op);
          case 'swapEdges': return surgPlanSwapEdges(idx, op);""")

# ---------------------------------------------------------------- 2. state
rep("""      let canvasFocusPending = false;   // after a canvas edit re-renders, the selected block takes focus again""",
    """      let canvasFocusPending = false;   // after a canvas edit re-renders, the selected block takes focus again
      let canvasVerify = null;          // a reorder awaiting its re-render: { a, b, cross, before }""")

# ---------------------------------------------------------------- 3. the gesture
rep("""      /* ---- phase 3: the keyboard walks the canvas ---- */""",
    """      /* ---- phase 4: reorder siblings, verified after the re-render ---- */

      // `[` / `]` on a selected block: swap it with the neighbouring branch out of the same
      // predecessor. The file change is the order of the two connectors; whether the picture
      // honours it is read back after the re-render (see canvasAfterRender).
      function canvasReorderSibling(id, dir) {
        if (canvasVerify) return;
        const model = canvasModel();
        const svg = canvasSvg();
        if (!model) { showToast(CANVAS_CODE_ONLY, 'error'); return; }
        if (!svg || !model.nodes.some(n => n.id === id)) return;
        const name = x => canvasLabelOf(model, x);
        const horizontal = /^(LR|RL)$/i.test(String(model.direction || 'TD'));
        const cross = horizontal ? 'cy' : 'cx';
        const frames = new Map();
        const frameOf = nid => { if (!frames.has(nid)) frames.set(nid, canvasNodeFrame(svg, nid)); return frames.get(nid); };
        const here = frameOf(id);
        if (!here) return;
        let pick = null;
        for (const pred of Array.from(new Set(model.edges.filter(e => e.to === id && e.from !== id).map(e => e.from)))) {
          const sibs = Array.from(new Set(model.edges.filter(e => e.from === pred && e.to !== pred).map(e => e.to))).filter(n => frameOf(n));
          sibs.sort((x, y) => frameOf(x)[cross] - frameOf(y)[cross]);
          const at = sibs.indexOf(id);
          const other = at >= 0 ? sibs[at + dir] : undefined;
          if (other) { pick = { pred, other }; break; }
        }
        if (!pick) {
          const side = horizontal ? (dir < 0 ? 'above' : 'below') : (dir < 0 ? 'to its left' : 'to its right');
          showToast(`No branch ${side} to swap with.`, 'error');
          return;
        }
        const ia = model.edges.findIndex(e => e.from === pick.pred && e.to === id);
        const ib = model.edges.findIndex(e => e.from === pick.pred && e.to === pick.other);
        if (ia < 0 || ib < 0) return;
        // Surgical precondition, checked up front so the refusal is plain rather than an
        // offer to rewrite the file.
        const idx = surgIndex(el.source.value);
        const plan = surgPlanSwapEdges(idx, { type: 'swapEdges', a: ia, b: ib });
        if (plan.refuse) { showToast(plan.refuse, 'error'); return; }
        const before = { a: here[cross], b: frameOf(pick.other)[cross] };
        const swapped = model.edges.slice();
        swapped[ia] = model.edges[ib];
        swapped[ib] = model.edges[ia];
        model.edges = swapped;
        canvasVerify = { a: id, b: pick.other, cross, before, names: [name(id), name(pick.other)] };
        const done = canvasApply(model, `${name(id)} and ${name(pick.other)} swapped sides`, id, { type: 'swapEdges', a: ia, b: ib });
        if (!done) canvasVerify = null;
      }

      // After the re-render: did the two blocks really trade places? If not, the file change
      // is undone - one step, silently - and the reason is said out loud.
      function canvasVerifyReorder() {
        const v = canvasVerify;
        if (!v) return;
        canvasVerify = null;
        const svg = canvasSvg();
        const fa = svg ? canvasNodeFrame(svg, v.a) : null;
        const fb = svg ? canvasNodeFrame(svg, v.b) : null;
        const flipped = fa && fb && Math.sign(fa[v.cross] - fb[v.cross]) !== Math.sign(v.before.a - v.before.b) && Math.abs(fa[v.cross] - fb[v.cross]) > 1;
        if (flipped) { showToast(`${v.names[0]} and ${v.names[1]} swapped sides.`, 'success'); return; }
        undoSource();
        showToast('These two branches rejoin further down, so the layout decides their left-right order. Moving them apart would mean changing what feeds them.', 'error');
      }

      /* ---- phase 3: the keyboard walks the canvas ---- */""")

rep("""      function canvasAfterRender() {
        canvasOverlayRepaint();
        if (!canvasSelectionPending) return;""",
    """      function canvasAfterRender() {
        canvasOverlayRepaint();
        canvasVerifyReorder();
        if (!canvasSelectionPending) return;""")

# ---------------------------------------------------------------- 4. keys: [ and ] before type-to-replace can take them
rep("""        // Type to replace: a printable key on a selected block starts renaming it, the key
        // as the first letter. Never after a drag that produced nothing, never the help key.""",
    """        if ((event.key === '[' || event.key === ']') && !mod && !event.altKey) {
          event.preventDefault();
          event.stopImmediatePropagation();
          canvasReorderSibling(canvasSelectedId, event.key === '[' ? -1 : 1);
          return;
        }
        // Type to replace: a printable key on a selected block starts renaming it, the key
        // as the first letter. Never after a drag that produced nothing, never the help key.""")

# ---------------------------------------------------------------- 5. the guide row
rep("""Ctrl+Shift+I moves it into a connector \u00b7 Enter on a handle does what a press does \u00b7 Esc puts the handles away.</div>""",
    """Ctrl+Shift+I moves it into a connector \u00b7 [ and ] swap it with the neighbouring branch (only when the layout can honour it) \u00b7 Enter on a handle does what a press does \u00b7 Esc puts the handles away.</div>""")

# ---------------------------------------------------------------- 6. version + changelog
rep("const APP_VERSION = '1.61.1';", "const APP_VERSION = '1.62.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.61.1',""",
    """      const CHANGELOG = [
        {
          version: '1.62.0',
          notes: [
            'Canvas, phase 4: with a block selected, [ and ] swap it with the neighbouring branch. The swap is written, the diagram re-drawn, and the result read back \\u2014 when the layout keeps its own order (branches that rejoin further down), the change is undone and the reason stated. Never a swap that did not happen.'
          ]
        },
        {
          version: '1.61.1',""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_pre_canvas_phase4.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('canvas phase 4 applied: %d -> %d chars' % (len(orig), len(s)))
