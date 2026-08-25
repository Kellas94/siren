"""Put the board's filter reset where it belongs.

The reset was written for one moment - arriving at the board - but it was installed
inside ensureWorkspaceState(), which has 21 call sites and runs on the first line of
applyMultiPreviewMode(). So it fired from everywhere, wiped the filter before
keepFilter could be consulted, and broke the one caller that sets a filter on
purpose: the header's folder chip, whose own comment insists it is "not a blind
re-fire of the All previews button three inches away".

The visible behaviour looked right, which is why it survived a first check. Arriving
at the board is a moment, not a state, so it is tracked as one: the first time the
mode is applied in this page's life (a restored session, an import, a recovery) and
every time the board is switched on again. Callers that set a filter deliberately
pass keepFilter.
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


# ---- 1. take it out of the shared normaliser --------------------------------
rep("""        // A workspace that arrives from storage, an import or a crash recovery opens on
        // everything it contains. Sort, grouping and columns are how you like to look at
        // the workspace and survive; the folder filter is which part of it you were
        // looking at, and a stale one reopened the board on an empty grid.
        if (state.workspaceBoard && typeof state.workspaceBoard === 'object' && state.workspaceBoard.folderFilter !== 'all') {
          state.workspaceBoard = { ...state.workspaceBoard, folderFilter: 'all' };
        }""", "")

# ---- 2. one flag for "the board has been applied once in this page's life" ---
rep("      let workspacePreviewRequestId = 0;",
    """      let workspacePreviewRequestId = 0;
      // Arriving at the board is a moment, not a state: it happens on the first apply of
      // this page's life - a restored session, an import, a recovery - and again every
      // time the board is switched back on.
      let workspaceBoardApplied = false;""")

# ---- 3. the single reset site ------------------------------------------------
rep("""        if (!keepFilter && nextMode && !state.multiPreview && state.workspaceBoard?.folderFilter && state.workspaceBoard.folderFilter !== 'all') {
          // Sort, grouping and columns say how you like to look at the workspace, so
          // they persist. A folder filter says which part of it you are looking at,
          // and that is a decision about now - carrying it across sessions meant the
          // board could open on one project with nothing on screen to say why.
          state.workspaceBoard = { ...state.workspaceBoard, folderFilter: 'all' };
        }""",
    """        const arrivingAtBoard = nextMode && (!workspaceBoardApplied || !state.multiPreview);
        workspaceBoardApplied = true;
        if (arrivingAtBoard && !keepFilter && state.workspaceBoard?.folderFilter && state.workspaceBoard.folderFilter !== 'all') {
          // Sort, grouping and columns say how you like to look at the workspace, so
          // they persist. A folder filter says which part of it you are looking at,
          // and that is a decision about now - carrying it across sessions meant the
          // board could open on one project with nothing on screen to say why.
          state.workspaceBoard = { ...state.workspaceBoard, folderFilter: 'all' };
        }""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_filterreset.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('filter reset relocated: %d -> %d chars' % (len(orig), len(s)))
