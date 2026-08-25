"""The board opens on everything.

A folder filter set in an earlier session was surviving into the next one, so the
board could open showing one project with no sign that a choice had been made
minutes or days ago. Entering the board is "show me my workspace"; narrowing is a
thing you do afterwards, on purpose. Reset the filter on the way in and leave every
other view preference (sort, grouping, columns) persistent - those describe how you
like to look at the whole, not which part of it you are looking at.
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


anchor = "        if (nextMode && !state.multiPreview) resetTransientWorkspaceInteractions({ clearVisualSelection: false });"
rep(anchor, anchor + """
        if (nextMode && !state.multiPreview && state.workspaceBoard?.folderFilter && state.workspaceBoard.folderFilter !== 'all') {
          // Sort, grouping and columns say how you like to look at the workspace, so
          // they persist. A folder filter says which part of it you are looking at,
          // and that is a decision about now - carrying it across sessions meant the
          // board could open on one project with nothing on screen to say why.
          state.workspaceBoard = { ...state.workspaceBoard, folderFilter: 'all' };
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_boardshowall.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('board show-all installed: %d -> %d chars' % (len(orig), len(s)))
