"""SIREN patch 3/3 - make the drawing area honest on a code-only diagram.

The canvas builder is flowchart-only by design, so on a git graph (and every other
code-first type) the picture was dead: clicking it did nothing, and the right-click
menu offered one permanently greyed-out "New block...". This makes the surface say
what it IS and do what it CAN:

  - the menu names the type, drops the block rows it can never honour, and adds
    "Edit as code", "Go to <thing> in the code" and, on a git graph, "Branch colours...";
  - a left click rings the commit, branch or participant it landed on and names the
    source line that drew it;
  - the first time a code-only diagram is on screen, one quiet chip says so.

Nothing here runs on a flowchart: every path returns early when the canvas model
parses, so the builder's own gestures are untouched.

Run after p1_gitgraph_type.py and p2_git_branch_colours.py.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- 1. the menu
MENU = """      function buildCanvasContextMenu() {
        const diagram = getActiveDiagram();
        const name = (diagram && diagram.name) || 'Diagram';
        const source = String(el.source ? el.source.value : (state.source || ''));
        const type = detectMermaidDiagramType(source);
        // The canvas builder is flowchart-only by design. On every other type the
        // picture is drawn FROM the code, so the menu names the type and offers the
        // moves that exist here instead of a block that can never be placed.
        const codeOnly = Boolean(source.trim()) && !canvasReadModel();
        const rows = [[null, codeOnly ? `${name} \\u00b7 ${diagramTypeLabel(type)}` : name, 'heading']];
        if (codeOnly) {
          // Only a right-click that just happened knows where it landed; the keyboard
          // route (Shift+F10) has no point, and a stale one would ring the wrong thing.
          const fresh = canvasMenuPoint && performance.now() - canvasMenuPoint.at < 5000;
          const hit = fresh ? codeOnlyTargetAt(canvasMenuPoint) : null;
          if (hit) rows.push([() => codeOnlyGoToLine(hit), `Go to \\u201c${hit.label}\\u201d in the code`]);
          // A sequence diagram has a guided builder of its own; sending someone to raw
          // code when a form exists would be the wrong answer for that type.
          if (type === 'sequence') rows.push([() => { applyEditorMode('visual', true); if (window.innerWidth <= 900) setMobileView('editor'); }, 'Open the Sequence builder']);
          rows.push([() => codeOnlyOpenCode(), 'Edit as code']);
          if (type === 'gitgraph') rows.push([() => revealGitBranchColours(), 'Branch colours\\u2026']);
        } else {
          // The builder's own rows: "New block..." and, with a block selected,
          // "Add a step after <name>" (canvasContextRows says when they are unavailable).
          rows.push(...canvasContextRows());
        }
        rows.push([() => fitToPage(), 'Fit to page']);
        rows.push([() => setZoom(100), 'Actual size (100%)']);
        rows.push([() => exportScoped('png'), 'Export PNG']);
        return { rows, anchor: el.zoomViewport, label: 'Diagram actions' };
      }

      /* ---------------- a code-only drawing ----------------
         What a picture generated from code can honestly offer: it can tell you WHAT
         you clicked and WHERE that thing is written. It cannot let you drag it, and it
         does not pretend to. Everything below is read-only - it points at the source,
         it never rewrites it - and every entry point returns early on a flowchart. */

      // The nearest piece of text to a point, so clicking a participant's box or the
      // gap beside a commit still finds the label a person meant.
      function codeOnlyNearestLabel(svg, point) {
        let best = null;
        let bestDistance = 70;
        svg.querySelectorAll('text').forEach(node => {
          const text = String(node.textContent || '').trim();
          if (!text) return;
          const box = node.getBoundingClientRect();
          if (!box.width && !box.height) return;
          const dx = Math.max(box.left - point.x, 0, point.x - box.right);
          const dy = Math.max(box.top - point.y, 0, point.y - box.bottom);
          const distance = Math.hypot(dx, dy);
          if (distance < bestDistance) { bestDistance = distance; best = node; }
        });
        return best;
      }

      // The line that wrote this label. First an exact hit, then a case-insensitive one;
      // no match means no row, because a menu entry that jumps somewhere arbitrary is
      // worse than no entry at all.
      function codeOnlySourceLine(label) {
        const lines = String(el.source ? el.source.value : (state.source || '')).split(/\\r?\\n/);
        const wanted = label.toLowerCase();
        for (let i = 0; i < lines.length; i += 1) if (lines[i].includes(label)) return i + 1;
        for (let i = 0; i < lines.length; i += 1) if (lines[i].toLowerCase().includes(wanted)) return i + 1;
        return 0;
      }

      // What is under the pointer: the element to ring, its text, and its source line.
      function codeOnlyTargetAt(point) {
        const svg = el.diagram ? el.diagram.querySelector('svg') : null;
        if (!svg || !point || (!point.x && !point.y)) return null;
        const at = document.elementFromPoint(point.x, point.y);
        if (!(at instanceof Element) || !svg.contains(at)) return null;
        // closest('text') rather than the tspan: a ring has to hang off an element that
        // may legally hold a <rect>, and <text> is the one that owns the whole label.
        let node = at.closest('text');
        let label = node ? String(node.textContent || '').trim() : '';
        // A git commit is a bare circle whose class carries the commit id.
        if (!label) {
          const dot = at.closest('circle.commit, circle[class*="commit"]');
          if (dot) {
            const token = String(dot.getAttribute('class') || '').split(/\\s+/)
              .find(part => part && !/^commit/.test(part) && !/^(branch-label|arrow|label)\\d*$/.test(part));
            if (token) { node = dot; label = token; }
          }
        }
        if (!label) {
          node = codeOnlyNearestLabel(svg, point);
          label = node ? String(node.textContent || '').trim() : '';
        }
        label = label.replace(/\\s+/g, ' ').trim().slice(0, 60);
        if (!label || !node) return null;
        const line = codeOnlySourceLine(label);
        return line ? { label, line, node } : null;
      }

      // A ring, drawn in the element's own coordinate space so it survives the group
      // transforms Mermaid nests its renderers in. The next render replaces the SVG,
      // which is exactly when the ring should stop meaning anything.
      function codeOnlyPaintRing(node) {
        const svg = el.diagram ? el.diagram.querySelector('svg') : null;
        if (!svg) return;
        svg.querySelectorAll('.t-code-pick').forEach(old => old.remove());
        if (!node || typeof node.getBBox !== 'function' || !node.parentNode) return;
        let box = null;
        try { box = node.getBBox(); } catch (error) { return; }
        if (!box || (!box.width && !box.height)) return;
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        ring.setAttribute('class', 't-code-pick');
        ring.setAttribute('x', String(box.x - 5));
        ring.setAttribute('y', String(box.y - 4));
        ring.setAttribute('width', String(box.width + 10));
        ring.setAttribute('height', String(box.height + 8));
        ring.setAttribute('rx', '5');
        ring.setAttribute('fill', 'none');
        ring.style.stroke = 'var(--primary)';
        ring.style.strokeWidth = '2';
        ring.style.pointerEvents = 'none';
        node.parentNode.appendChild(ring);
      }

      function codeOnlyOpenCode() {
        applyEditorMode('code', true);
        if (window.innerWidth <= 900) setMobileView('editor');
        requestAnimationFrame(() => { if (el.source) el.source.focus(); });
      }

      function codeOnlyGoToLine(hit) {
        applyEditorMode('code', true);
        if (window.innerWidth <= 900) setMobileView('editor');
        requestAnimationFrame(() => goToEditorLine(hit.line));
      }

      // The owner's complaint, in full: "the diagraming area is not clickable to work in
      // it". It cannot become a canvas - the source is the model - but it can stop being
      // silent. A click rings what it hit and says where that thing is written.
      function handleCodeOnlyDiagramClick(event) {
        if (!canvasBuilderAvailable() || connectMode || edgeWaypointMode) return;
        const source = String(el.source ? el.source.value : '');
        // A flowchart keeps the builder's own selection; this is only for the rest.
        if (!source.trim() || canvasReadModel()) return;
        if (canvasPressPoint && Math.hypot(event.clientX - canvasPressPoint.x, event.clientY - canvasPressPoint.y) > 6) return;
        const hit = codeOnlyTargetAt({ x: event.clientX, y: event.clientY });
        codeOnlyPaintRing(hit ? hit.node : null);
        if (!hit) return;
        showToast(`\\u201c${hit.label}\\u201d is line ${hit.line}. This diagram is drawn from its code \\u2014 right-click for what you can do here.`);
      }

      /* One chip, once ever, the first time a code-only diagram is on screen: the
         difference between "this app is broken" and "this type works another way" is
         one sentence, and it is only worth saying once. */
      let codeOnlyHintEl = null;
      let codeOnlyHintTimer = 0;

      function codeOnlyHideHint() {
        clearTimeout(codeOnlyHintTimer);
        if (codeOnlyHintEl) codeOnlyHintEl.hidden = true;
      }

      function codeOnlyMaybeShowHint() {
        if (state.codeOnlyHintSeen || !el.zoomViewport || !canvasBuilderAvailable()) return;
        const source = String(el.source ? el.source.value : (state.source || ''));
        if (!source.trim() || detectMermaidDiagramType(source) === 'flowchart') return;
        state.codeOnlyHintSeen = true;
        scheduleSave();
        let chip = codeOnlyHintEl;
        if (!chip) {
          chip = document.createElement('div');
          chip.className = 'canvas-hint';
          chip.setAttribute('role', 'status');
          const text = document.createElement('span');
          text.textContent = 'This diagram type is drawn from its code \\u00b7 click a part of it to find its line \\u00b7 right-click for fit, size, export and colours';
          const close = document.createElement('button');
          close.type = 'button';
          close.setAttribute('aria-label', 'Dismiss');
          close.textContent = '\\u00d7';
          close.addEventListener('click', codeOnlyHideHint);
          chip.append(text, close);
          document.body.appendChild(chip);
          codeOnlyHintEl = chip;
        }
        chip.hidden = false;
        const view = el.zoomViewport.getBoundingClientRect();
        const width = chip.offsetWidth || 320;
        const height = chip.offsetHeight || 34;
        chip.style.left = `${Math.round(clamp(view.left + view.width / 2 - width / 2, 8, Math.max(8, window.innerWidth - width - 8)))}px`;
        chip.style.top = `${Math.round(clamp(view.top + 10, 8, Math.max(8, window.innerHeight - height - 8)))}px`;
        clearTimeout(codeOnlyHintTimer);
        codeOnlyHintTimer = setTimeout(codeOnlyHideHint, 9000);
      }
"""

rep("""      function buildCanvasContextMenu() {
        const diagram = getActiveDiagram();
        return {
          rows: [
            [null, (diagram && diagram.name) || 'Diagram', 'heading'],
            // The builder's own rows first: "New block..." and, with a block selected,
            // "Add a step after <name>" (canvasContextRows says when they are unavailable).
            ...canvasContextRows(),
            [() => fitToPage(), 'Fit to page'],
            [() => setZoom(100), 'Actual size (100%)'],
            [() => exportScoped('png'), 'Export PNG']
          ],
          anchor: el.zoomViewport,
          label: 'Diagram actions'
        };
      }
""", MENU)

# ---------------------------------------------------------------- 2. the click
rep("""        el.diagram.addEventListener('click', handleCanvasClick);""",
    """        el.diagram.addEventListener('click', handleCanvasClick);
        // Code-only types get their own click: it never fires while the canvas model parses.
        el.diagram.addEventListener('click', handleCodeOnlyDiagramClick);""")

# ---------------------------------------------------------------- 3. the hint flag
rep("""        canvasHintSeen: false,""",
    """        canvasHintSeen: false,
        codeOnlyHintSeen: false,""")

rep("""        updateDiagramTypeStarterUi();""",
    """        updateDiagramTypeStarterUi();
        codeOnlyMaybeShowHint();""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
