"""The reload case.

The in-session toggle already reopens the board on everything, but a restored
session did not: state.multiPreview is set true by the restore before
applyMultiPreviewMode runs, so the transition guard never fires and the board came
back filtered - measured as "0 of 4 shown" on an empty grid after a reload. This
normalisation runs for load, import, merge and recovery alike, which is every way a
board can arrive from somewhere other than a click.
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


anchor = "        state.multiPreview = Boolean(state.multiPreview && state.diagrams.length > 1);"
rep(anchor, anchor + """
        // A workspace that arrives from storage, an import or a crash recovery opens on
        // everything it contains. Sort, grouping and columns are how you like to look at
        // the workspace and survive; the folder filter is which part of it you were
        // looking at, and a stale one reopened the board on an empty grid.
        if (state.workspaceBoard && typeof state.workspaceBoard === 'object' && state.workspaceBoard.folderFilter !== 'all') {
          state.workspaceBoard = { ...state.workspaceBoard, folderFilter: 'all' };
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_boardshowall2.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('reload reset installed: %d -> %d chars' % (len(orig), len(s)))
