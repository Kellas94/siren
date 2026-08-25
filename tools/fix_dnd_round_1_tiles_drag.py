import io, os, sys

P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)
edits = []

def rep(old, new, count=1, label=''):
    n = s.count(old)
    assert n == count, f'anchor {label!r} found {n}x, expected {count}: {old[:80]!r}'
    edits.append(label)
    return s.replace(old, new)

# ---------------------------------------------------------------- version
s = rep("      const APP_VERSION = '1.57.0';", "      const APP_VERSION = '1.58.0';", label='version')

s = rep("""        {
          version: '1.57.0',
          notes: [""", """        {
          version: '1.58.0',
          notes: [
            'Collapsed projects are tiles on a shelf at the top of the board, not rows down it — two dozen parked projects now fit above the fold, and a click anywhere on a tile opens the project.',
            'Drag a diagram onto a project — its tile, its heading or its section — to move it there; a selection travels together.',
            'Guided lines can be reordered by dragging the line number, with Alt+↑ / Alt+↓ on the focused line, or from the line’s right-click menu.'
          ]
        },
        {
          version: '1.57.0',
          notes: [""", label='changelog')

# ---------------------------------------------------------------- CSS: board tiles + drag
s = rep("""    .multi-preview-card[data-drop-target="true"] { outline: 2px dashed var(--primary); outline-offset: 2px; }
""", """    .multi-preview-card[data-drop-target="true"] { outline: 2px dashed var(--primary); outline-offset: 2px; }
    /* Collapsed projects are tiles on a shelf above the expanded sections, not rows
       down the board. The tile IS the collapsed state: the same section, restyled. */
    .multi-preview-shelf {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .multi-preview-shelf .multi-preview-group { margin: 0; }
    .multi-preview-group[data-tile="true"] {
      position: relative;
      min-height: 96px;
      background: color-mix(in srgb, var(--panel-alt) 88%, transparent);
      transition: border-color 140ms ease, background 140ms ease;
    }
    .multi-preview-group[data-tile="true"]:hover { border-color: color-mix(in srgb, var(--primary) 45%, var(--border)); }
    .multi-preview-group[data-tile="true"] .multi-preview-group-head {
      display: block;
      min-height: 96px;
      padding: 0;
      border: 0;
      background: transparent;
    }
    /* The whole tile is the toggle; the tick and the ⋯ sit on top of it in reserved
       space and appear on hover or focus, as they do on a card. */
    .multi-preview-group[data-tile="true"] .multi-preview-group-toggle {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      padding: 30px 12px 10px;
      border-radius: inherit;
      font-size: 13px;
      line-height: 1.3;
    }
    .multi-preview-group[data-tile="true"] .multi-preview-group-toggle:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -3px; }
    .multi-preview-group[data-tile="true"] .multi-preview-group-chevron { display: none; }
    .multi-preview-group[data-tile="true"] .multi-preview-group-name {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
      overflow-wrap: anywhere;
      text-overflow: ellipsis;
    }
    .multi-preview-group[data-tile="true"] .multi-preview-group-count { margin-top: auto; }
    .multi-preview-group[data-tile="true"] .multi-preview-tick-hit,
    .multi-preview-group[data-tile="true"] .multi-preview-group-actions {
      position: absolute;
      z-index: 1;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .multi-preview-group[data-tile="true"] .multi-preview-tick-hit { top: 4px; left: 6px; }
    .multi-preview-group[data-tile="true"] .multi-preview-group-actions { top: 2px; right: 2px; }
    .multi-preview-group[data-tile="true"]:hover .multi-preview-tick-hit,
    .multi-preview-group[data-tile="true"]:focus-within .multi-preview-tick-hit,
    .multi-preview-group[data-tile="true"]:hover .multi-preview-group-actions,
    .multi-preview-group[data-tile="true"]:focus-within .multi-preview-group-actions { opacity: 1; }
    .multi-preview-group[data-tile="true"][data-empty="true"] .multi-preview-tick-hit { display: none; }
    /* A card on its way to another project: the target under the pointer lights up. */
    .multi-preview-group[data-drop-target="true"] {
      outline: 2px dashed var(--primary);
      outline-offset: -2px;
      background: color-mix(in srgb, var(--primary) 10%, var(--panel-alt));
    }
    /* A finger on the title strip drags the card; a finger on the thumbnail scrolls. */
    .multi-preview-card { touch-action: pan-y; }
    .multi-preview-head { touch-action: none; }
    body.is-card-dragging, body.is-card-dragging * { cursor: grabbing !important; user-select: none; }
    .multi-preview-drag-ghost {
      position: fixed;
      z-index: 2500;
      max-width: 260px;
      padding: 5px 10px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--panel-bg);
      color: var(--text);
      box-shadow: var(--shadow-soft);
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
""", label='css-board')

# ---------------------------------------------------------------- CSS: guided rows drag
s = rep("""    .struct-line-actions .btn { min-width: 24px; padding: 0 5px; font-size: 11px; }
""", """    .struct-line-actions .btn { min-width: 24px; padding: 0 5px; font-size: 11px; }
    /* The line number is the drag handle: it is already unselectable, so a drag from
       it never fights a text selection, and the tokens keep their click. */
    .struct-code:not(.is-blank) .struct-gutter { cursor: grab; touch-action: none; }
    .struct-code[data-dragging="true"] { opacity: .45; }
    .struct-code[data-drop="before"] { box-shadow: inset 0 2px 0 0 var(--primary); }
    .struct-code[data-drop="after"] { box-shadow: inset 0 -2px 0 0 var(--primary); }
    body.is-row-dragging, body.is-row-dragging * { cursor: grabbing !important; user-select: none; }
""", label='css-guided')

# ---------------------------------------------------------------- toggle: remember what to reveal
s = rep("""      function toggleWorkspaceFolderCollapsed(folderId) {
        if (folderId) {
          const folder = workspaceFolderById(folderId);
          if (!folder) return;
          folder.collapsed = !folder.collapsed;
        } else {
          state.workspaceBoard.unfiledCollapsed = !state.workspaceBoard.unfiledCollapsed;
        }
        scheduleSave();
        renderWorkspacePreviews();
      }
""", """      function toggleWorkspaceFolderCollapsed(folderId) {
        let collapsedNow;
        if (folderId) {
          const folder = workspaceFolderById(folderId);
          if (!folder) return;
          folder.collapsed = !folder.collapsed;
          collapsedNow = folder.collapsed;
        } else {
          state.workspaceBoard.unfiledCollapsed = !state.workspaceBoard.unfiledCollapsed;
          collapsedNow = state.workspaceBoard.unfiledCollapsed;
        }
        workspaceReveal = { id: folderId || '', expanded: !collapsedNow };
        scheduleSave();
        renderWorkspacePreviews();
      }

      // A project moves between the shelf of tiles and its place among the sections
      // when it is toggled, so the thing just clicked is no longer where the pointer
      // or the focus was. After the render, focus follows it; an expanded project is
      // also brought into view, because its section can sit below the fold.
      let workspaceReveal = null;
      function revealWorkspaceGroup() {
        if (!workspaceReveal || !el.multiPreviewGrid) return;
        const { id, expanded } = workspaceReveal;
        workspaceReveal = null;
        const key = id || 'unfiled';
        const section = Array.from(el.multiPreviewGrid.querySelectorAll('.multi-preview-group'))
          .find(candidate => candidate.dataset.folderId === key);
        if (!section) return;
        const toggle = section.querySelector('.multi-preview-group-toggle');
        if (toggle) toggle.focus({ preventScroll: true });
        if (expanded) section.scrollIntoView({ block: 'nearest' });
      }
""", label='toggle-reveal')

# ---------------------------------------------------------------- card dragging: pointer events
start_anchor = "      function attachWorkspaceCardDragging(card, diagram) {\n"
end_anchor = "      /* ---------------- lazy rendering ---------------- */"
assert s.count(start_anchor) == 1 and s.count(end_anchor) == 1
i0 = s.index(start_anchor); i1 = s.index(end_anchor)
old_block = s[i0:i1]
assert "card.addEventListener('dragstart'" in old_block and "moveWorkspaceDiagram(workspaceDragId ||" in old_block
new_block = """      /* Scrolling a list while dragging inside it. The pointer near an edge of the
         scroller moves it a little every frame, and the caller re-reads what is under
         the (now stationary) pointer after each step. */
      function createEdgeAutoScroller(scroller, onScrolled) {
        const EDGE = 40;
        const MAX_STEP = 16;
        let frame = 0;
        let velocity = 0;
        const tick = () => {
          frame = 0;
          if (!velocity || !scroller) return;
          const before = scroller.scrollTop;
          scroller.scrollTop = before + velocity;
          if (scroller.scrollTop !== before && typeof onScrolled === 'function') onScrolled();
          frame = requestAnimationFrame(tick);
        };
        return {
          update(clientY) {
            if (!scroller) return;
            const box = scroller.getBoundingClientRect();
            const fromTop = clientY - box.top;
            const fromBottom = box.bottom - clientY;
            if (fromTop < EDGE) velocity = -Math.ceil((1 - Math.max(0, fromTop) / EDGE) * MAX_STEP);
            else if (fromBottom < EDGE) velocity = Math.ceil((1 - Math.max(0, fromBottom) / EDGE) * MAX_STEP);
            else velocity = 0;
            if (velocity && !frame) frame = requestAnimationFrame(tick);
          },
          stop() { velocity = 0; if (frame) cancelAnimationFrame(frame); frame = 0; }
        };
      }

      /* A card drag is pointer events, not HTML5 drag-and-drop: one road for mouse,
         pen and touch, and the pointer is captured only once it has moved 5px, so a
         plain click on the thumbnail, the tick, the menu and Open all keep their
         targets. Two things can be under a released card: another card (a reorder,
         only in the plain workspace order) or a project - its tile, its heading or
         its section - which moves the diagram there. Anywhere else does nothing and
         says nothing. */
      const WORKSPACE_DRAG_THRESHOLD = 5;
      let workspaceDragGhost = null;
      let workspaceDragSuppressClickUntil = 0;

      // The click that follows a captured drag is retargeted to the dragged card. It
      // must not open the thumbnail, tick a box or toggle a tile.
      function swallowWorkspaceDragClick(event) {
        if (!workspaceDragSuppressClickUntil || performance.now() > workspaceDragSuppressClickUntil) return;
        workspaceDragSuppressClickUntil = 0;
        event.preventDefault();
        event.stopPropagation();
      }

      // The selection rule the right-click menu already uses: a card that is IN the
      // current selection carries the whole selection with it.
      function workspaceDraggedIds(draggedId) {
        if (workspaceSelection.has(draggedId) && workspaceSelection.size >= 2) return Array.from(workspaceSelection);
        return [draggedId];
      }

      // What a released card would land on. Null means "nothing happens".
      function resolveWorkspaceDropTarget(x, y, draggedId, reorder) {
        const under = document.elementFromPoint(x, y);
        if (!(under instanceof Element)) return null;
        if (reorder) {
          const card = under.closest('.multi-preview-card');
          if (card && card.dataset.diagramId && card.dataset.diagramId !== draggedId) {
            return { kind: 'card', el: card, id: card.dataset.diagramId };
          }
        }
        const section = under.closest('.multi-preview-group');
        if (!section || state.workspaceBoard.groupBy !== 'folder') return null;
        const folderId = section.dataset.folderId === 'unfiled' ? '' : (section.dataset.folderId || '');
        const alreadyThere = workspaceDraggedIds(draggedId).every(id =>
          ((state.diagrams.find(entry => entry.id === id) || {}).folderId || '') === folderId);
        return alreadyThere ? null : { kind: 'folder', el: section, folderId };
      }

      function attachWorkspaceCardDragging(card, diagram) {
        const reorder = workspaceCardReorderingEnabled();
        const grouped = sanitizeWorkspaceBoard(state.workspaceBoard, state.workspaceFolders).groupBy === 'folder';
        card.removeAttribute('draggable');
        card.dataset.reorderDisabled = String(!reorder);
        if (!reorder && !grouped) {
          card.title = 'Switch to Workspace order, No grouping, All folders and clear the search to drag-reorder cards.';
          return;
        }
        let pointer = null;
        let dragging = false;
        let target = null;
        let edgeScroll = null;
        let last = null;

        const setTarget = next => {
          if (target && (!next || target.el !== next.el)) delete target.el.dataset.dropTarget;
          target = next;
          if (target) target.el.dataset.dropTarget = 'true';
        };
        const track = (x, y) => {
          last = { x, y };
          if (workspaceDragGhost) {
            workspaceDragGhost.style.left = (x + 14) + 'px';
            workspaceDragGhost.style.top = (y + 14) + 'px';
          }
          setTarget(resolveWorkspaceDropTarget(x, y, diagram.id, reorder));
        };
        const teardown = () => {
          if (edgeScroll) { edgeScroll.stop(); edgeScroll = null; }
          setTarget(null);
          delete card.dataset.dragging;
          document.body.classList.remove('is-card-dragging');
          if (workspaceDragGhost) { workspaceDragGhost.remove(); workspaceDragGhost = null; }
          window.removeEventListener('keydown', onKey, true);
          workspaceDragId = '';
          dragging = false;
          last = null;
        };
        // Escape drops nothing. The pointer stays captured until it is released, so
        // the release cannot land on anything either.
        const onKey = event => {
          if (event.key !== 'Escape' || !dragging) return;
          event.preventDefault();
          event.stopPropagation();
          if (pointer) pointer.cancelled = true;
          teardown();
        };
        const begin = event => {
          dragging = true;
          workspaceDragId = diagram.id;
          card.dataset.dragging = 'true';
          document.body.classList.add('is-card-dragging');
          try { card.setPointerCapture(event.pointerId); } catch (error) { /* the pointer is already gone */ }
          const ids = workspaceDraggedIds(diagram.id);
          workspaceDragGhost = document.createElement('div');
          workspaceDragGhost.className = 'multi-preview-drag-ghost';
          workspaceDragGhost.textContent = ids.length > 1 ? `${ids.length} diagrams` : diagram.name;
          document.body.appendChild(workspaceDragGhost);
          window.addEventListener('keydown', onKey, true);
          edgeScroll = createEdgeAutoScroller(el.zoomViewport, () => { if (last) track(last.x, last.y); });
        };

        card.addEventListener('pointerdown', event => {
          if (event.button !== 0 || !event.isPrimary || pointer) return;
          if (!(event.target instanceof Element)) return;
          // The card's own controls own their pointer: a press on the tick, the menu,
          // Open or a link is never the start of a drag.
          if (event.target.closest('button, input, select, label, a, .multi-preview-menu')) return;
          pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, cancelled: false };
          dragging = false;
          // Stops the text selection a mouse drag would otherwise start, and the
          // selection autoscroll that comes with it. The click still fires.
          event.preventDefault();
        });
        card.addEventListener('pointermove', event => {
          if (!pointer || event.pointerId !== pointer.id || pointer.cancelled) return;
          if (!dragging) {
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < WORKSPACE_DRAG_THRESHOLD) return;
            begin(event);
          }
          track(event.clientX, event.clientY);
          if (edgeScroll) edgeScroll.update(event.clientY);
        });
        card.addEventListener('pointerup', event => {
          if (!pointer || event.pointerId !== pointer.id) return;
          const didDrag = dragging;
          const cancelled = pointer.cancelled;
          pointer = null;
          if (!didDrag && !cancelled) return;
          const landing = didDrag && !cancelled
            ? resolveWorkspaceDropTarget(event.clientX, event.clientY, diagram.id, reorder)
            : null;
          const ids = workspaceDraggedIds(diagram.id);
          teardown();
          workspaceDragSuppressClickUntil = performance.now() + 500;
          if (!landing) return;
          if (landing.kind === 'card') moveWorkspaceDiagram(diagram.id, landing.id);
          else moveWorkspaceDiagramsToFolder(ids, landing.folderId, { clearSelection: ids.length > 1 });
        });
        card.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        card.addEventListener('lostpointercapture', () => { if (dragging) { pointer = null; teardown(); } });
      }

"""
s = s[:i0] + new_block + s[i1:]
edits.append('card-drag')

# register the click swallower next to the app's other document listeners
s = rep("""        document.addEventListener('click', swallowMacContextClick, true);
""", """        document.addEventListener('click', swallowMacContextClick, true);
        document.addEventListener('click', swallowWorkspaceDragClick, true);
""", label='click-swallow-register')

# ---------------------------------------------------------------- group builder: the tile
s = rep("""        section.dataset.collapsed = String(Boolean(group.collapsed));
""", """        section.dataset.collapsed = String(Boolean(group.collapsed));
        // The tile IS the collapsed state - no separate view, no setting. The same
        // section, restyled, sits on the shelf above the expanded sections.
        if (group.collapsed) {
          section.dataset.tile = 'true';
          if (!group.diagrams.length) section.dataset.empty = 'true';
        }
""", label='tile-flag')

s = rep("""        count.textContent = `${group.diagrams.length} diagram${group.diagrams.length === 1 ? '' : 's'}`;
""", """        count.textContent = group.collapsed && !group.diagrams.length
          ? 'empty'
          : `${group.diagrams.length} diagram${group.diagrams.length === 1 ? '' : 's'}`;
""", label='tile-count')

# ---------------------------------------------------------------- render: shelf first, sections after
s = rep("""            for (const group of groups) {
              const mounted = createWorkspacePreviewGroup(group, columns);
              el.multiPreviewGrid.appendChild(mounted.section);
              if (group.collapsed) continue;
              for (const diagram of group.diagrams) {
                await mountWorkspacePreviewCard(mounted.grid, diagram, requestId, renderIndex++);
              }
            }
""", """            // Collapsed projects come off the vertical axis: they are tiles on one shelf
            // at the top, and only the expanded projects take a full-width section.
            const shelf = groups.some(group => group.collapsed) ? document.createElement('div') : null;
            if (shelf) {
              shelf.className = 'multi-preview-shelf';
              shelf.setAttribute('role', 'group');
              shelf.setAttribute('aria-label', 'Collapsed projects');
              el.multiPreviewGrid.appendChild(shelf);
            }
            for (const group of groups) {
              const mounted = createWorkspacePreviewGroup(group, columns);
              if (group.collapsed) { shelf.appendChild(mounted.section); continue; }
              el.multiPreviewGrid.appendChild(mounted.section);
              for (const diagram of group.diagrams) {
                await mountWorkspacePreviewCard(mounted.grid, diagram, requestId, renderIndex++);
              }
            }
            if (requestId === workspacePreviewRequestId) revealWorkspaceGroup();
""", label='render-shelf')

# ---------------------------------------------------------------- guided: move returns the landing index; drop + focus helpers
s = rep("""      function structureMoveRow(index, delta) {
        if (structureRowsAreStale()) return;
        const lines = el.source.value.split(/\\r?\\n/);
        let target = index + delta;
        while (target >= 0 && target < lines.length && !lines[target].trim()) target += delta;
        if (target < 0 || target >= lines.length) return;
        const [moved] = lines.splice(index, 1);
        lines.splice(target, 0, moved);
        writeStructureSource(lines.join('\\n'));
      }
""", """      function structureMoveRow(index, delta) {
        if (structureRowsAreStale()) return -1;
        const lines = el.source.value.split(/\\r?\\n/);
        let target = index + delta;
        while (target >= 0 && target < lines.length && !lines[target].trim()) target += delta;
        if (target < 0 || target >= lines.length) return -1;
        const [moved] = lines.splice(index, 1);
        lines.splice(target, 0, moved);
        writeStructureSource(lines.join('\\n'));
        return target;
      }

      // A drop puts the line exactly where it was released: `insertAt` is a position in
      // the lines as they stand (0 .. length, "before that line"). The same single
      // write as the arrows - the lines reordered, nothing else touched.
      function structureMoveRowTo(index, insertAt) {
        if (structureRowsAreStale()) return -1;
        const lines = el.source.value.split(/\\r?\\n/);
        if (index < 0 || index >= lines.length) return -1;
        const at = Math.max(0, Math.min(lines.length, insertAt));
        const target = at > index ? at - 1 : at;
        if (target === index) return index;
        const [moved] = lines.splice(index, 1);
        lines.splice(target, 0, moved);
        writeStructureSource(lines.join('\\n'));
        return target;
      }

      // After a move the render restores focus by the OLD line number, which is now a
      // different line. Put it back on the line that moved, on the same part of it.
      function structureFocusRow(index, ordinal = -1) {
        if (!el.structureRows) return;
        const line = Array.from(el.structureRows.querySelectorAll('.struct-code'))
          .find(row => Number(row.dataset.line) === index);
        if (!line) return;
        const tokens = Array.from(line.querySelectorAll('.struct-token[tabindex]'));
        const token = tokens[ordinal] || tokens[0];
        if (token) token.focus({ preventScroll: true });
        line.scrollIntoView({ block: 'nearest' });
      }

      function structureMoveRowAndFocus(index, delta) {
        const active = document.activeElement;
        const host = active instanceof Element ? active.closest('.struct-code') : null;
        const ordinal = host && Number(host.dataset.line) === index
          ? Array.from(host.querySelectorAll('.struct-token[tabindex]')).indexOf(active)
          : -1;
        const landed = structureMoveRow(index, delta);
        if (landed >= 0) structureFocusRow(landed, ordinal);
      }

      // The × button and the right-click menu ask the same questions before a delete.
      function structureRequestDeleteRow(row) {
        const structural = row.kind === 'header' || row.kind === 'group' || row.kind === 'groupEnd';
        const carriesWords = Boolean(row.label || row.toLabel || row.fromLabel
          || (row.nodes && row.nodes.some(node => node.token)));
        if (structural && !window.confirm('This line holds the diagram together. Delete it anyway?')) return;
        if (!structural && carriesWords && !window.confirm('Delete this line and the words on it?')) return;
        structureDeleteRow(row.index);
      }

      /* Reordering by hand. Drag is the gesture, the line number is the handle (it is
         already unselectable, so no text selection starts under it), Alt+↑ / Alt+↓ is
         the keyboard route for the focused line, and the row's ↑ ↓ buttons and its
         right-click menu are the visible ones. Every route commits through the same
         single write. Wired once; the rows underneath are rebuilt freely. */
      let structureRowsWired = false;
      function ensureStructureRowsInteractions() {
        if (structureRowsWired || !el.structureRows) return;
        structureRowsWired = true;
        const host = el.structureRows;

        host.addEventListener('keydown', event => {
          if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          const index = structureFocusedRowIndex();
          if (index === null) return;
          event.preventDefault();
          event.stopPropagation();
          structureMoveRowAndFocus(index, event.key === 'ArrowUp' ? -1 : 1);
        });

        let pointer = null;
        let dragging = false;
        let sourceLine = null;
        let dropAt = -1;
        let marked = null;
        let edgeScroll = null;
        let last = null;
        const clearMark = () => { if (marked) { delete marked.dataset.drop; marked = null; } };
        // Where the line would land: before the first row whose midpoint is below the
        // pointer, else after the last. No indicator when that is where it already is.
        const place = (x, y) => {
          last = { x, y };
          const rows = Array.from(host.querySelectorAll('.struct-code'));
          const total = el.source.value.split(/\\r?\\n/).length;
          let insertAt = total;
          let markEl = rows.length ? rows[rows.length - 1] : null;
          let side = 'after';
          for (const row of rows) {
            const box = row.getBoundingClientRect();
            if (y < box.top + box.height / 2) { insertAt = Number(row.dataset.line); markEl = row; side = 'before'; break; }
          }
          const from = Number(sourceLine.dataset.line);
          const landing = insertAt > from ? insertAt - 1 : insertAt;
          clearMark();
          if (!Number.isFinite(landing) || landing === from) { dropAt = -1; return; }
          dropAt = insertAt;
          if (markEl) { markEl.dataset.drop = side; marked = markEl; }
        };
        const teardown = () => {
          if (edgeScroll) { edgeScroll.stop(); edgeScroll = null; }
          clearMark();
          if (sourceLine) delete sourceLine.dataset.dragging;
          document.body.classList.remove('is-row-dragging');
          window.removeEventListener('keydown', onKey, true);
          dragging = false;
          sourceLine = null;
          dropAt = -1;
          last = null;
        };
        const onKey = event => {
          if (event.key !== 'Escape' || !dragging) return;
          event.preventDefault();
          event.stopPropagation();
          teardown();
        };
        host.addEventListener('pointerdown', event => {
          if (event.button !== 0 || !event.isPrimary || pointer) return;
          const handle = event.target instanceof Element ? event.target.closest('.struct-gutter') : null;
          const line = handle ? handle.closest('.struct-code:not(.is-blank)') : null;
          if (!line || !host.contains(line)) return;
          pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, line };
          dragging = false;
          event.preventDefault();
        });
        host.addEventListener('pointermove', event => {
          if (!pointer || event.pointerId !== pointer.id) return;
          if (!dragging) {
            if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 4) return;
            if (!pointer.line.isConnected) { pointer = null; return; }
            dragging = true;
            sourceLine = pointer.line;
            sourceLine.dataset.dragging = 'true';
            document.body.classList.add('is-row-dragging');
            try { host.setPointerCapture(event.pointerId); } catch (error) { /* the pointer is already gone */ }
            window.addEventListener('keydown', onKey, true);
            edgeScroll = createEdgeAutoScroller(host, () => { if (last) place(last.x, last.y); });
          }
          place(event.clientX, event.clientY);
          if (edgeScroll) edgeScroll.update(event.clientY);
        });
        host.addEventListener('pointerup', event => {
          if (!pointer || event.pointerId !== pointer.id) return;
          const didDrag = dragging;
          const line = sourceLine;
          const at = dropAt;
          pointer = null;
          if (!didDrag) return;
          teardown();
          if (!line || at < 0) return;
          structureMoveRowTo(Number(line.dataset.line), at);
        });
        host.addEventListener('pointercancel', () => { pointer = null; teardown(); });
        host.addEventListener('lostpointercapture', () => { if (dragging) { pointer = null; teardown(); } });
      }
""", label='guided-move-helpers')

# the × button shares the confirm questions with the menu; the arrows name their key
s = rep("""        [['↑', 'Move this line up', () => structureMoveRow(row.index, -1)],
         ['↓', 'Move this line down', () => structureMoveRow(row.index, 1)],
         ['×', 'Delete this line', () => {
           const structural = row.kind === 'header' || row.kind === 'group' || row.kind === 'groupEnd';
           const carriesWords = Boolean(row.label || row.toLabel || row.fromLabel
             || (row.nodes && row.nodes.some(node => node.token)));
           if (structural && !window.confirm('This line holds the diagram together. Delete it anyway?')) return;
           if (!structural && carriesWords && !window.confirm('Delete this line and the words on it?')) return;
           structureDeleteRow(row.index);
         }]].forEach(([glyph, title, run]) => {""", """        [['↑', 'Move this line up · Alt+↑', () => structureMoveRowAndFocus(row.index, -1)],
         ['↓', 'Move this line down · Alt+↓', () => structureMoveRowAndFocus(row.index, 1)],
         ['×', 'Delete this line', () => structureRequestDeleteRow(row)]].forEach(([glyph, title, run]) => {""", label='row-buttons')

# the gutter says it is a handle
s = rep("""        gutter.textContent = String(row.index + 1);
        const code = document.createElement('span');""", """        gutter.textContent = String(row.index + 1);
        gutter.title = 'Drag to move this line. Alt+↑ / Alt+↓ moves the focused line.';
        const code = document.createElement('span');""", label='gutter-title')

# wire the row interactions once, on the first render
s = rep("""        if (!el.structureRows || el.structureEditor.hidden) return;
""", """        if (!el.structureRows || el.structureEditor.hidden) return;
        ensureStructureRowsInteractions();
""", label='wire-rows')

# ---------------------------------------------------------------- context menu: a guided line
s = rep("""        if (target.closest('#zoomViewport')) return buildDiagramContextMenu(target);
        return null;
      }
""", """        const structureLine = target.closest('#structureRows .struct-code');
        if (structureLine) return buildStructureRowContextMenu(structureLine);
        if (target.closest('#zoomViewport')) return buildDiagramContextMenu(target);
        return null;
      }

      /* ---------------- a guided line ----------------
         Right-click is the accelerator. The same moves are on the row's ↑ ↓ buttons,
         on Alt+↑ / Alt+↓ for the focused line, and on a drag of the line number. A
         blank line offers nothing, so the browser keeps its menu there. */
      function buildStructureRowContextMenu(line) {
        const index = Number(line.dataset.line);
        if (!Number.isFinite(index)) return null;
        const row = parseStructureRows(el.source.value)[index];
        if (!row || (row.kind === 'blank' && !row.text)) return null;
        const lines = el.source.value.split(/\\r?\\n/);
        const hasAbove = lines.slice(0, index).some(text => text.trim());
        const hasBelow = lines.slice(index + 1).some(text => text.trim());
        const rows = [[null, 'Line ' + (index + 1), 'heading']];
        rows.push([() => structureMoveRowAndFocus(index, -1), 'Move line up', hasAbove ? '' : 'This is already the first line.']);
        rows.push([() => structureMoveRowAndFocus(index, 1), 'Move line down', hasBelow ? '' : 'This is already the last line.']);
        rows.push([() => structureRequestDeleteRow(row), 'Delete line']);
        return { rows, anchor: line, label: 'Actions for line ' + (index + 1) };
      }
""", label='row-context-menu')

assert len(s) > orig_len
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('patched', len(edits), 'edits:', ', '.join(edits))
print('bytes', orig_len, '->', len(s.encode('utf-8')))
