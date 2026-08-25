r"""Two follow-ups from the drag round's verification.

1. Undo/Redo swapped the source without rebuilding the guided rows, so the rows kept the
   pre-undo order and the NEXT reorder by any route - drag, Alt+arrow, the buttons, the
   menu - was swallowed by structureRowsAreStale() with "rows refreshed, nothing was
   overwritten". Pre-existing, but the new routes made it load-bearing. The undo path now
   refreshes the guided rows when that editor is on screen.
2. The drag ghost said "2 diagrams" while a reorder moved only the dragged card. A reorder
   carries one card; the toast already says how many moved to a project. The ghost names
   the card.
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

rep("""          restoreDiagramSnapshot(entry.diagram);
          applySource(entry.source, { reason, recordUndo: false, saveVersion: false });
          refreshStyleClassControls();""",
    """          restoreDiagramSnapshot(entry.diagram);
          applySource(entry.source, { reason, recordUndo: false, saveVersion: false });
          refreshStyleClassControls();
          // The guided rows render from the source; an undo swaps the source without an
          // input event, so the rows kept the old order and the next reorder was refused
          // as stale. Rebuild them when that editor is on screen.
          if (el.structureEditor && !el.structureEditor.hidden && typeof renderStructureEditor === 'function') renderStructureEditor();""")

rep("          workspaceDragGhost.textContent = ids.length > 1 ? `${ids.length} diagrams` : diagram.name;",
    "          // A reorder carries one card and a project move says how many in its toast, so\n"
    "          // the ghost names the card you picked up.\n"
    "          workspaceDragGhost.textContent = diagram.name;")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_dnd_followups.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('dnd follow-ups applied: %d -> %d chars' % (len(orig), len(s)))
