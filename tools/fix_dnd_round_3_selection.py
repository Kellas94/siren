import io, os
P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(P, encoding='utf-8', newline='').read()
def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:70])
    s = s.replace(old, new)
# A touch drag can leave a text selection behind (the touch's own selection gesture
# runs beside ours). It is never wanted after a drag, so the teardown clears one that
# sits inside the dragged surface.
rep("""      function workspaceDraggedIds(draggedId) {""", """      // A touch drag can leave a text selection behind it - the touch's own gesture
      // runs beside ours. Nobody wants one after a drag, so a drag's end clears any
      // selection that sits inside the surface it dragged over.
      function clearSelectionInside(host) {
        const selection = window.getSelection ? window.getSelection() : null;
        if (!selection || !selection.rangeCount || !host) return;
        const node = selection.anchorNode;
        if (node && host.contains(node)) selection.removeAllRanges();
      }

      function workspaceDraggedIds(draggedId) {""")
rep("""          if (workspaceDragGhost) { workspaceDragGhost.remove(); workspaceDragGhost = null; }
          window.removeEventListener('keydown', onKey, true);
          workspaceDragId = '';""", """          if (workspaceDragGhost) { workspaceDragGhost.remove(); workspaceDragGhost = null; }
          window.removeEventListener('keydown', onKey, true);
          clearSelectionInside(el.multiPreviewGrid);
          workspaceDragId = '';""")
rep("""          if (sourceLine) delete sourceLine.dataset.dragging;
          document.body.classList.remove('is-row-dragging');
          window.removeEventListener('keydown', onKey, true);
          dragging = false;""", """          if (sourceLine) delete sourceLine.dataset.dragging;
          document.body.classList.remove('is-row-dragging');
          window.removeEventListener('keydown', onKey, true);
          clearSelectionInside(host);
          dragging = false;""")
tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('patched 3 edits')
