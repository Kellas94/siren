"""Two fixes to the workspace board, both one line of intent.

1. A click on a thumbnail opens its diagram. It did not: `beginPan` is bound to
   #zoomViewport, which is also the board's scroller, and its setPointerCapture
   retargets the following mouseup and click to the viewport. Measured with real
   mouse events - pointerdown and mousedown reach the canvas, the click arrives at
   #zoomViewport, and the board stays open. canvas.click() from script DOES open the
   diagram, which is why this survived: element.click() bypasses hit testing and lies.
   At 3 and 4 columns the CSS hides the Open button on the grounds that "the whole
   thumbnail already opens the diagram", so there was no mouse route at all.
   The board scrolls, it does not pan, and applyMultiPreviewMode already disables
   every zoom control in board mode - so panning has no business running here.

2. The folder chip narrows the board to its folder again. v1.44.2 reset the filter on
   every entry to the board, which was right for a returning session and wrong for
   the one caller that sets a filter deliberately on its way in. The chip's own
   comment says it is "not a blind re-fire of the All previews button three inches
   away" - it had become exactly that. An explicit opt-out, so the reset keeps
   protecting the case it was written for.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)


# ---- 1. the board's primary action -------------------------------------------
rep("        if (event.button !== 0 || interactive) return;",
    """        // The board shares this viewport but scrolls rather than pans, and capturing
        // the pointer here retargets the click away from the thumbnail that owns it -
        // which silently removed the one thing the board exists to do.
        if (event.button !== 0 || interactive || state.multiPreview) return;""")

# ---- 2. let one caller keep the filter it just set ---------------------------
rep("      function applyMultiPreviewMode(enabled, shouldSave = true) {",
    "      function applyMultiPreviewMode(enabled, shouldSave = true, { keepFilter = false } = {}) {")

rep("""        if (nextMode && !state.multiPreview && state.workspaceBoard?.folderFilter && state.workspaceBoard.folderFilter !== 'all') {""",
    """        if (!keepFilter && nextMode && !state.multiPreview && state.workspaceBoard?.folderFilter && state.workspaceBoard.folderFilter !== 'all') {""")

rep("            applyMultiPreviewMode(true, true);",
    "            applyMultiPreviewMode(true, true, { keepFilter: true });")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_boardfixes.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('board fixes installed: %d -> %d chars' % (len(orig), len(s)))
