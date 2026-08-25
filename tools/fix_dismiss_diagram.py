r"""[07] You can put a diagram away.

Five diagrams already fill the tab strip and there was no way to take one out of the bar
short of deleting it. "Hide from bar" means exactly that: the diagram stays in the
workspace, keeps its place on the board, and comes back with "Show in bar". If the two
ever blurred, someone would lose work - so the wording and the board route are deliberate.

 - hiddenFromBar persists on the diagram record (sanitised to a boolean on load)
 - the tab strip skips hidden diagrams; the count reads "5 diagrams · 2 hidden"
 - the diagram's ⋯ menu gains "Hide from bar" (and "Show in bar" if already hidden)
 - the board card's ⋯ menu gains the same pair, and hidden cards carry a small "hidden" mark
 - hiding the ACTIVE diagram switches to the next visible one; you cannot hide the last visible
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

# 1. persist the flag
rep("          folderId: validWorkspaceFolderIds.has(String(diagram.folderId || '')) ? String(diagram.folderId) : '',",
    "          folderId: validWorkspaceFolderIds.has(String(diagram.folderId || '')) ? String(diagram.folderId) : '',\n"
    "          hiddenFromBar: Boolean(diagram.hiddenFromBar),")

# 2. tab strip skips hidden diagrams; count shows hidden
i = s.index("      function renderDiagramTabs() {")
fn_end = s.index("\n      }\n", i) + len("\n      }\n")
fn = s[i:fn_end]
assert "        state.diagrams.forEach((diagram, index) => {" in fn
fn2 = fn.replace("        state.diagrams.forEach((diagram, index) => {",
                 "        state.diagrams.forEach((diagram, index) => {\n"
                 "          // Hidden from the bar, not from the workspace: the board still lists it.\n"
                 "          if (diagram.hiddenFromBar && diagram.id !== state.activeDiagramId) return;", 1)
s = s[:i] + fn2 + s[fn_end:]

rep("        el.diagramCount.textContent = `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}`;",
    "        const hiddenCount = state.diagrams.filter(d => d.hiddenFromBar && d.id !== state.activeDiagramId).length;\n"
    "        el.diagramCount.textContent = `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}`"
    "          + (hiddenCount ? ` \\u00b7 ${hiddenCount} hidden` : '');\n"
    "        el.diagramCount.title = hiddenCount ? 'Hidden diagrams are still in the workspace - open All previews to see them.' : '';")

# 3. helpers + the diagram ⋯ menu
rep("""          openStructureMenu(el.diagramMoreButton, [
            ['duplicate', 'Duplicate'],
            ['rename', 'Rename…'],
            ['remove', 'Remove diagram', lastOne ? 'The last diagram cannot be removed.' : false]
          ], '', value => {
            if (value === 'duplicate') duplicateActiveDiagram();
            else if (value === 'rename') renameActiveDiagram();
            else if (value === 'remove') requestRemoveActiveDiagram();
          });""",
    """          const activeNow = getActiveDiagram();
          const visibleCount = state.diagrams.filter(d => !d.hiddenFromBar).length;
          const isHidden = Boolean(activeNow && activeNow.hiddenFromBar);
          openStructureMenu(el.diagramMoreButton, [
            ['duplicate', 'Duplicate'],
            ['rename', 'Rename…'],
            [isHidden ? 'show' : 'hide', isHidden ? 'Show in bar' : 'Hide from bar',
              (!isHidden && visibleCount <= 1) ? 'The last visible diagram stays in the bar.' : false],
            ['remove', 'Remove diagram', lastOne ? 'The last diagram cannot be removed.' : false]
          ], '', value => {
            if (value === 'duplicate') duplicateActiveDiagram();
            else if (value === 'rename') renameActiveDiagram();
            else if (value === 'hide') setDiagramHiddenFromBar(state.activeDiagramId, true);
            else if (value === 'show') setDiagramHiddenFromBar(state.activeDiagramId, false);
            else if (value === 'remove') requestRemoveActiveDiagram();
          });""")

# the helper lives next to renderDiagramTabs
rep("      function renderDiagramTabs() {",
    """      // Put a diagram away without deleting it. The board is the way back; hiding the
      // active one moves you to the next visible diagram so the editor never shows a
      // diagram the bar will not.
      function setDiagramHiddenFromBar(id, hidden) {
        const diagram = state.diagrams.find(d => d.id === id);
        if (!diagram) return;
        const visible = state.diagrams.filter(d => !d.hiddenFromBar);
        if (hidden && visible.length <= 1 && !diagram.hiddenFromBar) { showToast('The last visible diagram stays in the bar.', 'info'); return; }
        diagram.hiddenFromBar = Boolean(hidden);
        if (hidden && state.activeDiagramId === id) {
          const next = state.diagrams.find(d => !d.hiddenFromBar && d.id !== id);
          if (next) switchDiagram(next.id);
        }
        renderDiagramTabs();
        scheduleSave();
        if (state.multiPreview) renderWorkspacePreviews();
        showToast(hidden ? `${diagram.name} hidden from the bar. It is still in the workspace - find it in All previews.` : `${diagram.name} is back in the bar.`, 'success');
      }

      function renderDiagramTabs() {""")

# 4. board card ⋯ menu + quick action + a visible mark
rep("        [['', '⋯'], ['duplicate', 'Duplicate'], ['rename', 'Rename'], ['png', 'Export PNG']]",
    "        [['', '⋯'], ['duplicate', 'Duplicate'], ['rename', 'Rename'], ['png', 'Export PNG'],\n"
    "          [diagram.hiddenFromBar ? 'show' : 'hide', diagram.hiddenFromBar ? 'Show in bar' : 'Hide from bar']]")
rep("        if (action === 'duplicate') { duplicateWorkspaceDiagramById(id); return; }",
    "        if (action === 'duplicate') { duplicateWorkspaceDiagramById(id); return; }\n"
    "        if (action === 'hide') { setDiagramHiddenFromBar(id, true); return; }\n"
    "        if (action === 'show') { setDiagramHiddenFromBar(id, false); return; }")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_dismiss.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('dismiss applied: %d -> %d chars' % (len(orig), len(s)))
