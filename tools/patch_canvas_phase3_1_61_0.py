r"""Canvas phase 3 - keyboard parity (spec section 5). Touch drag is left out on purpose: the
owner's rule is that a tablet is for reading, not authoring.

- Focusing a block (Tab, or any focus) selects it: the ring follows keyboard focus.
- With a block selected, the arrow keys walk the flow: along the flow axis to the nearest
  predecessor / successor, across it to a sibling (a block sharing a predecessor, else the
  nearest block on the same rank). Focus and the ring move together; the block scrolls
  into view.
- Handles are in the tab order (tabindex, real aria-labels already); Enter or Space on a
  focused handle opens the same popover a press would.
- Focus survives repaint and re-render: a focused handle is re-focused by role after the
  ring is rebuilt; after a canvas edit the block that was made or kept takes focus again.
- The canvas keys are listed in the Quick guide (collapsed by default) - no new panel.
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

# ---------------------------------------------------------------- 1. state
rep("""      let canvasTypeSuppressed = false; // a drag that produced nothing: the next keystroke must not rename (spec 1.4)""",
    """      let canvasTypeSuppressed = false; // a drag that produced nothing: the next keystroke must not rename (spec 1.4)
      let canvasFocusPending = false;   // after a canvas edit re-renders, the selected block takes focus again""")

# ---------------------------------------------------------------- 2. handles: tabbable, and a focused one survives the repaint
rep("""        const layer = canvasSvgEl('g', { class: 't-handles', 'data-ring-for': id });
        [['back', axes.back, 'Insert a step before'], ['fwd', axes.fwd, 'Add the next step']].forEach(([role, side, tip]) => {
          const point = canvasSidePoint(frame, side, k);
          const handle = canvasSvgEl('g', {
            class: 't-handle', 'data-handle-for': id, 'data-role': role, 'data-side': side, role: 'button',
            'aria-label': `${tip}: ${name}`,""",
    """        // A handle that had keyboard focus gets it back by role once the ring is rebuilt.
        const focusedHandle = document.activeElement instanceof Element ? document.activeElement.closest('#diagram [data-handle-for]') : null;
        const refocus = focusedHandle ? { id: focusedHandle.getAttribute('data-handle-for'), role: focusedHandle.getAttribute('data-role') } : null;
        const layer = canvasSvgEl('g', { class: 't-handles', 'data-ring-for': id });
        [['back', axes.back, 'Insert a step before'], ['fwd', axes.fwd, 'Add the next step']].forEach(([role, side, tip]) => {
          const point = canvasSidePoint(frame, side, k);
          const handle = canvasSvgEl('g', {
            class: 't-handle', 'data-handle-for': id, 'data-role': role, 'data-side': side, role: 'button', tabindex: '0',
            'aria-label': `${tip}: ${name}`,""")
rep("""          if (canvasDrag && canvasDrag.role === role) { handle.classList.add('is-active'); canvasDrag.handle = handle; }
          layer.appendChild(handle);
        });
        svg.appendChild(layer);
      }""",
    """          if (canvasDrag && canvasDrag.role === role) { handle.classList.add('is-active'); canvasDrag.handle = handle; }
          layer.appendChild(handle);
        });
        svg.appendChild(layer);
        if (refocus && refocus.id === id) {
          const again = layer.querySelector(`[data-role="${refocus.role}"]`);
          if (again) { try { again.focus({ preventScroll: true }); } catch (error) { /* not focusable here */ } }
        }
      }""")

# ---------------------------------------------------------------- 3. after a canvas edit, the block takes focus again
rep("""      function canvasAfterRender() {
        canvasOverlayRepaint();
        if (!canvasSelectionPending) return;
        canvasSelectionPending = false;
        const id = canvasSelectedId;
        if (!id || !el.zoomViewport) return;""",
    """      function canvasAfterRender() {
        canvasOverlayRepaint();
        if (!canvasSelectionPending) return;
        canvasSelectionPending = false;
        const id = canvasSelectedId;
        if (!id || !el.zoomViewport) return;
        if (canvasFocusPending) {
          // Keyboard users keep their place: the block the gesture made or kept is focused,
          // so the next arrow or shortcut starts from it.
          canvasFocusPending = false;
          const group = findSvgNodeGroups(el.diagram, id)[0];
          if (group) { try { group.focus({ preventScroll: true }); } catch (error) { /* not focusable here */ } }
        }""")
rep("""      function canvasApply(model, reason, id, op, onWrite = null) {
        const before = el.source.value;
        const clean = applyVisualModel(model, reason, id, op, onWrite);
        if (el.source.value === before) return false;
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasSelectionPending = true;""",
    """      function canvasApply(model, reason, id, op, onWrite = null) {
        const before = el.source.value;
        const active = document.activeElement;
        const fromCanvas = !active || active === document.body || (active instanceof Element && (active.closest('#zoomViewport') || active.id === 'canvasPopLabel' || active.id === 'canvasPopBranch' || active.id === 'canvasInplace'));
        const clean = applyVisualModel(model, reason, id, op, onWrite);
        if (el.source.value === before) return false;
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasSelectionPending = true;
        canvasFocusPending = Boolean(fromCanvas && id);""")

# ---------------------------------------------------------------- 4. focus selects; arrows walk; Enter on a handle opens the popover
rep("""      /* ---- keyboard ---- */""",
    """      /* ---- phase 3: the keyboard walks the canvas ---- */

      // Focusing a block (Tab, or any focus) selects it: the ring follows keyboard focus.
      function handleCanvasFocusIn(event) {
        if (!canvasBuilderAvailable()) return;
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest('[data-handle-for]')) return;
        const id = resolveNodeIdFromElement(target);
        if (!id || id === canvasSelectedId || !canvasReadModel()) return;
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasTypeSuppressed = false;
        canvasOverlayRepaint();
      }

      function canvasFocusBlock(id) {
        canvasSelectedId = id;
        canvasHoveredId = '';
        canvasTypeSuppressed = false;
        canvasOverlayRepaint();
        const group = findSvgNodeGroups(el.diagram, id)[0];
        if (!group) return;
        try { group.focus({ preventScroll: true }); } catch (error) { /* not focusable here */ }
        group.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }

      // Along the flow axis: nearest predecessor / successor. Across it: a sibling - a block
      // sharing a predecessor on that side, else the nearest block on the same rank.
      // Positions are read from the drawing, so "left" is what the eye calls left.
      function canvasMoveFocus(key) {
        const model = canvasReadModel();
        const svg = canvasSvg();
        const id = canvasSelectedId;
        if (!model || !svg || !id) return false;
        const dir = String(model.direction || 'TD').toUpperCase();
        const horizontal = dir === 'LR' || dir === 'RL';
        const reversed = dir === 'BT' || dir === 'RL';
        const flowKeys = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
        const along = horizontal ? 'cx' : 'cy', cross = horizontal ? 'cy' : 'cx';
        const frames = new Map();
        const frameOf = nid => { if (!frames.has(nid)) frames.set(nid, canvasNodeFrame(svg, nid)); return frames.get(nid); };
        const here = frameOf(id);
        if (!here) return false;
        const byCross = (a, b) => Math.abs(frameOf(a)[cross] - here[cross]) - Math.abs(frameOf(b)[cross] - here[cross]);
        let candidates;
        if (flowKeys.includes(key)) {
          const forward = (key === flowKeys[1]) !== reversed;
          const ids = forward
            ? model.edges.filter(e => e.from === id && e.to !== id).map(e => e.to)
            : model.edges.filter(e => e.to === id && e.from !== id).map(e => e.from);
          candidates = Array.from(new Set(ids)).filter(n => frameOf(n)).sort(byCross);
        } else {
          const positive = key === 'ArrowRight' || key === 'ArrowDown';
          const onSide = n => { const f = frameOf(n); return Boolean(f) && (positive ? f[cross] > here[cross] + 1 : f[cross] < here[cross] - 1); };
          const preds = model.edges.filter(e => e.to === id).map(e => e.from);
          let sibs = Array.from(new Set(model.edges.filter(e => preds.includes(e.from) && e.to !== id).map(e => e.to))).filter(onSide);
          if (!sibs.length) {
            const reach = Math.max(24, horizontal ? here.w : here.h);
            sibs = model.nodes.map(n => n.id).filter(n => n !== id && onSide(n) && Math.abs(frameOf(n)[along] - here[along]) < reach);
          }
          candidates = sibs.sort(byCross);
        }
        if (candidates[0]) canvasFocusBlock(candidates[0]);
        return true;
      }

      // Enter or Space on a focused handle: the same popover a press on it opens.
      function handleCanvasHandleKeydown(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const handle = event.target instanceof Element ? event.target.closest('#diagram [data-handle-for]') : null;
        if (!handle || !canvasBuilderAvailable()) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = handle.getBoundingClientRect();
        canvasOpenPopover(handle.getAttribute('data-handle-for'), handle.getAttribute('data-role'), rect.left + rect.width / 2, rect.top + rect.height / 2);
      }

      /* ---- keyboard ---- */""")

rep("""        if ((event.key === 'Delete' || event.key === 'Backspace') && !mod && !event.altKey && !event.shiftKey) {""",
    """        if (!mod && !event.altKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          if (canvasMoveFocus(event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
          return;
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && !mod && !event.altKey && !event.shiftKey) {""")

rep("""        el.diagram.addEventListener('click', handleCanvasClick);
        el.diagram.addEventListener('contextmenu', handleCanvasContextMenu);""",
    """        el.diagram.addEventListener('click', handleCanvasClick);
        el.diagram.addEventListener('contextmenu', handleCanvasContextMenu);
        el.diagram.addEventListener('focusin', handleCanvasFocusIn);
        el.diagram.addEventListener('keydown', handleCanvasHandleKeydown);""")

# ---------------------------------------------------------------- 5. the keys, in the Quick guide
rep("""            <div class="guide-workflow-step"><strong>Clean whitespace</strong>Strips trailing spaces and collapses extra blank lines in the Mermaid code. Example: after pasting steps from Word, one click makes the source tidy without touching the diagram.</div>""",
    """            <div class="guide-workflow-step"><strong>Clean whitespace</strong>Strips trailing spaces and collapses extra blank lines in the Mermaid code. Example: after pasting steps from Word, one click makes the source tidy without touching the diagram.</div>
            <div class="guide-workflow-step"><strong>Canvas keys</strong>Click or Tab to a block in the preview, then: \u2191 \u2193 walk along the flow and \u2190 \u2192 across it \u00b7 Ctrl+Enter adds the next step, Ctrl+Shift+Enter inserts one before \u00b7 F2 (or just typing) renames \u00b7 Delete removes the block and reconnects its neighbours \u00b7 Ctrl+Shift+I moves it into a connector \u00b7 Enter on a handle does what a press does \u00b7 Esc puts the handles away.</div>""")

# ---------------------------------------------------------------- 6. version + changelog
rep("const APP_VERSION = '1.60.0';", "const APP_VERSION = '1.61.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.60.0',""",
    """      const CHANGELOG = [
        {
          version: '1.61.0',
          notes: [
            'Canvas, phase 3 \\u2014 the keyboard: Tab to a block and it is selected; the arrow keys walk the flow (\\u2191 \\u2193 along it, \\u2190 \\u2192 across it); Enter on a handle opens the same popover a press would; after every edit the block you were on keeps focus. The keys are listed in the Quick guide.'
          ]
        },
        {
          version: '1.60.0',""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_pre_canvas_phase3.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('canvas phase 3 applied: %d -> %d chars' % (len(orig), len(s)))
