r"""Two of the four XS polish items left in the queue.

XS2 Moving a guided row across a blank line leapfrogged two lines: structureMoveRow skipped
    blanks and then inserted one slot too far, while the drag (structureMoveRowTo) is
    positional. One rule now: a press moves the row one visible slot, blank or not - the
    same place a drop on that slot lands.
XS3 Once Unfiled was empty there was no Unfiled group to drop on, so a diagram could not
    be dragged back out of a project. While a drag is in flight and no Unfiled section is
    on the board, a ghost Unfiled section is appended as a drop target and removed when
    the drag ends. A drop on it moves the cards the normal way; the re-render then shows
    the real Unfiled.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------- XS2: one press = one visible slot ----------------
rep("""      function structureMoveRow(index, delta) {
        if (structureRowsAreStale()) return -1;
        const lines = el.source.value.split(/\\r?\\n/);
        let target = index + delta;
        while (target >= 0 && target < lines.length && !lines[target].trim()) target += delta;
        if (target < 0 || target >= lines.length) return -1;""",
    """      function structureMoveRow(index, delta) {
        if (structureRowsAreStale()) return -1;
        const lines = el.source.value.split(/\\r?\\n/);
        // One press moves the row one visible slot, a blank line included - the same
        // place a drop on that slot lands, so the arrows and the drag agree across a blank.
        const target = index + delta;
        if (target < 0 || target >= lines.length) return -1;""")

# ---------------- XS3: ghost Unfiled drop target while dragging ----------------
rep("""        const teardown = () => {
          if (edgeScroll) { edgeScroll.stop(); edgeScroll = null; }
          setTarget(null);
          delete card.dataset.dragging;""",
    """        const teardown = () => {
          if (edgeScroll) { edgeScroll.stop(); edgeScroll = null; }
          setTarget(null);
          removeWorkspaceUnfiledGhost();
          delete card.dataset.dragging;""")

rep("""          workspaceDragGhost.textContent = diagram.name;
          document.body.appendChild(workspaceDragGhost);
          window.addEventListener('keydown', onKey, true);
          edgeScroll = createEdgeAutoScroller(el.zoomViewport, () => { if (last) track(last.x, last.y); });
        };""",
    """          workspaceDragGhost.textContent = diagram.name;
          document.body.appendChild(workspaceDragGhost);
          window.addEventListener('keydown', onKey, true);
          edgeScroll = createEdgeAutoScroller(el.zoomViewport, () => { if (last) track(last.x, last.y); });
          if (grouped) ensureWorkspaceUnfiledGhost();
        };""")

rep("""      function resolveWorkspaceDropTarget(x, y, draggedId, reorder) {""",
    """      // Unfiled renders only while it holds diagrams, so once it is empty there is nothing
      // to drop on to take a diagram back out of its project. For the length of a drag, an
      // empty Unfiled stands in as a drop target; it goes when the drag ends.
      function ensureWorkspaceUnfiledGhost() {
        if (!el.multiPreviewGrid) return;
        if (sanitizeWorkspaceBoard(state.workspaceBoard, state.workspaceFolders).folderFilter !== 'all') return;
        if (el.multiPreviewGrid.querySelector('.multi-preview-group[data-folder-id="unfiled"]')) return;
        const section = document.createElement('section');
        section.className = 'multi-preview-group';
        section.dataset.folderId = 'unfiled';
        section.dataset.dropGhost = 'true';
        section.setAttribute('aria-label', 'Unfiled - drop here to take the diagram out of its project');
        const head = document.createElement('div');
        head.className = 'multi-preview-group-head';
        const name = document.createElement('span');
        name.className = 'multi-preview-group-name';
        name.textContent = 'Unfiled';
        const note = document.createElement('span');
        note.className = 'multi-preview-group-count';
        note.textContent = 'drop here to take it out of its project';
        head.append(name, note);
        section.appendChild(head);
        el.multiPreviewGrid.appendChild(section);
      }
      function removeWorkspaceUnfiledGhost() {
        if (!el.multiPreviewGrid) return;
        el.multiPreviewGrid.querySelectorAll('.multi-preview-group[data-drop-ghost="true"]').forEach(node => node.remove());
      }

      function resolveWorkspaceDropTarget(x, y, draggedId, reorder) {""")

rep("""    /* A card on its way to another project: the target under the pointer lights up. */
    .multi-preview-group[data-drop-target="true"] {
      outline: 2px dashed var(--primary);
      outline-offset: -2px;
      background: color-mix(in srgb, var(--primary) 10%, var(--panel-alt));
    }""",
    """    /* A card on its way to another project: the target under the pointer lights up. */
    .multi-preview-group[data-drop-target="true"] {
      outline: 2px dashed var(--primary);
      outline-offset: -2px;
      background: color-mix(in srgb, var(--primary) 10%, var(--panel-alt));
    }
    /* The stand-in Unfiled that exists only while a card is being dragged. */
    .multi-preview-group[data-drop-ghost="true"] {
      min-height: 64px;
      border-style: dashed;
      background: color-mix(in srgb, var(--panel-alt) 70%, transparent);
      color: var(--muted);
    }
    .multi-preview-group[data-drop-ghost="true"] .multi-preview-group-head { justify-content: center; gap: 10px; }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_xs_polish.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('xs polish (XS2, XS3) applied: %d -> %d chars' % (len(orig), len(s)))
