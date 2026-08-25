r"""Six small, independent fixes from the top of the queue. Anchors are taken FROM the file
(the JS source holds literal \\r?\\n and other escapes a retyped anchor never matches).

[15] "Local save failed" said the same thing for four causes. setSaveState gains a reason.
[01] Pop-out toolbar clipped three controls off-window: now wraps instead of clipping.
[02] Pop-out restored at a saved x that covers the Visual/Code switch: clamp to the preview pane.
[03] Search matched a diagram inside a collapsed project and then hid it: force open while searching.
[04] Filtering to one collapsed project gave an empty board: force open when filtered to one group.
[08] Wrap existed only in the pop-out: add the same toggle to the docked layout bar.
[09] Pop-out stats counted blk/lnk off the previously rendered SVG: count from the current source.
[10] Heading said "12 diagrams" while the board showed 1: heading carries shown/total.
[11] Nothing at rest said a filter was on: View button reads "View · TBS ✕" and the ✕ clears it.
"""
import io, os, shutil, sys, re

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

def grab(start_marker, end_marker, start_from=0):
    i = s.index(start_marker, start_from)
    j = s.index(end_marker, i) + len(end_marker)
    return s[i:j]

# ---------------- [15] save state with a reason ----------------
old = grab("      function setSaveState(mode) {", "        }\n      }\n", 0)
new = """      function setSaveState(mode, reason) {
        if (mode === 'saving') {
          el.saveStateChip.dataset.state = 'warn';
          el.saveStateText.textContent = 'Saving locally\u2026';
          el.saveStateChip.title = '';
        } else if (mode === 'error') {
          // Four different causes used to share one red sentence. Say which it is, and
          // for the one that is not a failure at all - another tab holds a newer copy -
          // say that the app is protecting it, not losing it.
          const text = reason === 'newer-tab' ? 'Paused: another tab is newer'
            : reason === 'storage-full' ? 'Storage full \u2014 not saving'
            : reason === 'read-only' ? 'Not saving here (read-only storage)'
            : 'Local save failed';
          const tip = reason === 'newer-tab' ? 'Another tab of SIREN saved a newer workspace. This tab will not overwrite it. Export anything you need here, then reload.'
            : reason === 'storage-full' ? 'The browser has no room left. Export your project (.siren) now, then delete unused diagrams or workpapers.'
            : reason === 'read-only' ? 'This browser context refused to store anything. Export your project (.siren) to keep your work.'
            : 'A storage write failed. Recent changes may not be saved \u2014 export your project (.siren) as a backup.';
          el.saveStateChip.dataset.state = reason === 'newer-tab' ? 'warn' : 'bad';
          el.saveStateText.textContent = text;
          el.saveStateChip.title = tip;
        } else {
          el.saveStateChip.dataset.state = 'good';
          el.saveStateText.textContent = 'Saved locally';
          el.saveStateChip.title = '';
        }
      }
"""
rep(old, new)

rep("""              setSaveState('error');
              showToast('Storage write failed \u2014 recent changes may not be saved. Export your project (.siren) now as a backup.', 'error');""",
    """              setSaveState('error', 'write-error');
              showToast('Storage write failed \u2014 recent changes may not be saved. Export your project (.siren) now as a backup.', 'error');""")
rep("""            setSaveState('error');
            showToast('Another tab saved a newer workspace. This tab will not overwrite it \u2014 export anything you need here, then reload.', 'error');""",
    """            setSaveState('error', 'newer-tab');
            showToast('Another tab saved a newer workspace. This tab will not overwrite it \u2014 export anything you need here, then reload.', 'error');""")
rep("""            setSaveState('error');
            if (!remoteWorkspaceConflictWarned) {""",
    """            setSaveState('error', 'newer-tab');
            if (!remoteWorkspaceConflictWarned) {""")
rep("""        } catch (error) {
          setSaveState('error');
          // Once per episode, loudly: a status chip alone is far too easy to miss""",
    """        } catch (error) {
          const quotaLike = error && (error.name === 'QuotaExceededError' || /quota|exceeded|full/i.test(String(error.message || error)));
          setSaveState('error', quotaLike ? 'storage-full' : 'write-error');
          // Once per episode, loudly: a status chip alone is far too easy to miss""")

# ---------------- [01] pop-out bars wrap instead of clipping ----------------
rep("    .editor-float-bar { flex-wrap: nowrap; overflow: hidden; }",
    "    .editor-float-bar { flex-wrap: wrap; overflow: visible; row-gap: 6px; }")
rep("""    .editor-popout-toolbar {
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;""",
    """    .editor-popout-toolbar {
      display: flex;
      align-items: center;
      /* Three controls used to be painted past the window's right edge and hit-test to
         whatever was underneath - Go-to-line's screen position was the preview's Render
         button. A toolbar wraps; it never clips a control to nothing. */
      flex-wrap: wrap;
      row-gap: 6px;
      overflow: visible;""")

# ---------------- [02] pop-out never covers the mode switch ----------------
rep("""      function placeEditorFloat(left, top, width, height) {
        const minTop = editorFloatTopLimit();""",
    """      function placeEditorFloat(left, top, width, height) {
        const minTop = editorFloatTopLimit();
        // A saved or first-open position that overlapped the editor column covered the
        // Visual/Code switch and Undo/Redo. When the window is wide enough to hold the
        // pop-out clear of that column, its left edge starts at the preview pane.
        const pane = document.querySelector('.preview-pane');
        if (pane) {
          const paneLeft = Math.round(pane.getBoundingClientRect().left);
          if (paneLeft > 0 && window.innerWidth - paneLeft - 8 >= Math.min(width, 340)) left = Math.max(left, paneLeft);
        }""")

# ---------------- [03]/[04] collapsed groups open when search or a single-group filter shows them ----------------
old = grab("      function workspacePreviewGroups(", "        return groups;\n      }\n")
assert "collapsed: Boolean(folder.collapsed)," in old and "collapsed: Boolean(board.unfiledCollapsed)," in old
new = old.replace("collapsed: Boolean(folder.collapsed),",
                  "collapsed: (queryActive && items.length) || singleGroupFilter ? false : Boolean(folder.collapsed),")
new = new.replace("collapsed: Boolean(board.unfiledCollapsed),",
                  "collapsed: (queryActive && items.length) || singleGroupFilter ? false : Boolean(board.unfiledCollapsed),")
new = new.replace("        const queryActive = Boolean(String(el.multiPreviewSearch?.value || '').trim());",
                  "        const queryActive = Boolean(String(el.multiPreviewSearch?.value || '').trim());\n"
                  "        // A project you collapsed last month is the only thing on screen when you filter to\n"
                  "        // it, or when search found something inside it. Display-only: never written back.\n"
                  "        const singleGroupFilter = filter !== 'all';")
assert new != old
rep(old, new)

# ---------------- [08] Wrap in the docked editor ----------------
rep("""              <button class="btn ghost compact" id="popOutEditorButton" type="button" title="Open the Mermaid editor in a larger window">\u29c9 Pop out</button>""",
    """              <label class="popout-option" for="dockedWrapToggle" title="Wrap long lines instead of scrolling sideways"><input id="dockedWrapToggle" type="checkbox" /> Wrap</label>
              <button class="btn ghost compact" id="popOutEditorButton" type="button" title="Open the Mermaid editor in a larger window">\u29c9 Pop out</button>""")
rep("'codeEditor','popOutEditorButton',", "'codeEditor','dockedWrapToggle','popOutEditorButton',")
rep("""        if (el.popoutWrapToggle) el.popoutWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.popoutWrapToggle.checked);""",
    """        if (el.dockedWrapToggle) el.dockedWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.dockedWrapToggle.checked);
          if (el.popoutWrapToggle) el.popoutWrapToggle.checked = el.dockedWrapToggle.checked;
        });
        if (el.popoutWrapToggle) el.popoutWrapToggle.addEventListener('change', () => {
          el.codeEditor.classList.toggle('is-wrapped', el.popoutWrapToggle.checked);
          if (el.dockedWrapToggle) el.dockedWrapToggle.checked = el.popoutWrapToggle.checked;""")

# ---------------- [09] stats from the source, not the stale SVG ----------------
rep("""        const statsSvg = el.diagram && el.diagram.querySelector('svg');
        if (statsSvg) {
          const nodes = statsSvg.querySelectorAll('g.node').length;
          const edges = statsSvg.querySelectorAll('path.flowchart-link, .edgePath path').length;
          el.popoutStats.textContent += ` \u00b7 ${nodes} blk \u00b7 ${edges} lnk`;""",
    """        // Counted from the source that is on screen now, not from the SVG of the last
        // render - which left the readout one render behind for as long as you typed.
        let counted = null;
        try { const m = parseVisualFlowchartSource(text); if (m && m.compatible) counted = { nodes: m.nodes.length, edges: m.edges.length }; } catch (error) { counted = null; }
        if (!counted) { try { const f = workspaceCardFacts({ source: text }); counted = { nodes: f.blocks, edges: f.connectors }; } catch (error) { counted = null; } }
        if (counted) {
          el.popoutStats.textContent += ` \u00b7 ${counted.nodes} blocks \u00b7 ${counted.edges} connectors`;""")

# ---------------- [10]/[11] heading tells the truth; View shows the active filter ----------------
old = grab("      async function renderWorkspacePreviews() {", "        if (workspacePreviewObserver) workspacePreviewObserver.disconnect();")
assert "el.multiPreviewCount.textContent = grouped && diagrams.length" in old
new = old.replace("""        el.previewHeading.textContent = `Workspace preview \u00b7 ${state.diagrams.length} diagrams`;
        const requestId = ++workspacePreviewRequestId;""",
"""        const requestId = ++workspacePreviewRequestId;""")
new = new.replace("""        if (el.multiPreviewCount) {""",
"""        // The 16px heading used to say "12 diagrams" while the board showed one, and the
        // true number sat in 11px at the far edge. The heading carries the truth now.
        const narrowed = diagrams.length !== state.diagrams.length;
        const filterName = (() => {
          const f = board.folderFilter;
          if (!f || f === 'all') return '';
          if (f === 'unfiled') return 'Unfiled';
          const folder = (state.workspaceFolders || []).find(x => x.id === f);
          return folder ? folder.name : '';
        })();
        el.previewHeading.textContent = narrowed
          ? `Workspace preview \u00b7 ${diagrams.length} of ${state.diagrams.length} diagrams${filterName ? ' \u00b7 ' + filterName : ''}`
          : `Workspace preview \u00b7 ${state.diagrams.length} diagrams`;
        if (el.multiPreviewViewButton) {
          // Nothing at rest said a filter was on - which is why a reset had to be written.
          el.multiPreviewViewButton.textContent = filterName ? `\u25a4 View \u00b7 ${filterName} \u2715` : '\u25a4 View \u25be';
          el.multiPreviewViewButton.dataset.filtered = filterName ? 'true' : 'false';
          el.multiPreviewViewButton.title = filterName ? `Showing only ${filterName}. Click to change, or clear the filter.` : 'Sort, group, filter and lay out the board';
        }
        if (el.multiPreviewCount) {""")
assert new != old
rep(old, new)

rep("      function openWorkspaceViewMenu(anchor) {",
    """      function openWorkspaceViewMenu(anchor, event) {
        // When a filter is on, the button reads "View \u00b7 TBS \u2715"; a click on its \u2715 clears it.
        if (anchor && anchor.dataset.filtered === 'true' && event && typeof event.clientX === 'number') {
          const r = anchor.getBoundingClientRect();
          if (event.clientX > r.right - 26 && el.multiPreviewFolderFilter) {
            el.multiPreviewFolderFilter.value = 'all';
            el.multiPreviewFolderFilter.dispatchEvent(new Event('change'));
            return;
          }
        }""")
m = re.search(r"el\.multiPreviewViewButton\.addEventListener\('click', \(\) => openWorkspaceViewMenu\(el\.multiPreviewViewButton\)\);", s)
if m:
    s = s.replace(m.group(0), "el.multiPreviewViewButton.addEventListener('click', event => openWorkspaceViewMenu(el.multiPreviewViewButton, event));")
else:
    m2 = re.search(r"el\.multiPreviewViewButton\.addEventListener\('click',\s*([^\n]*)\);", s)
    print('WARN: view button binding not in the expected form:', m2.group(0)[:140] if m2 else 'NOT FOUND')

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_batch_small.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('batch applied: %d -> %d chars' % (len(orig), len(s)))
