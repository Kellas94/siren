r"""Diagrams that were put away had no way back, and leaving one looked like losing it.

Two things the owner ran into. A diagram hidden from the bar still shows there while it is
the one you are on - so the moment you open another diagram it vanishes, and it reads as if
the click you just made threw it away. And the only route back was a tooltip pointing at
"All previews": the count said "7 diagrams - 5 hidden" and nothing about that was clickable.

Now: the hidden count is a button. It lists the diagrams that are put away, brings back the
one you pick (and opens it), or brings back all of them. And the tab of a diagram that is
only in the bar because you are on it says so - a dashed edge and a title that explains it
will leave the bar when you open another one.
"""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else None
if not APP:
    print(__doc__); sys.exit(2)
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- markup: a button beside the count
rep("""        <span class="diagram-count" id="diagramCount" title="Alt+1 to Alt+9 jump to the first nine diagrams; Ctrl+K searches all of them.">1 diagram</span>""",
    """        <span class="diagram-count" id="diagramCount" title="Alt+1 to Alt+9 jump to the first nine diagrams; Ctrl+K searches all of them.">1 diagram</span>
        <button class="btn ghost compact diagram-hidden-chip" id="diagramHiddenButton" type="button" hidden aria-haspopup="listbox">0 put away</button>""")

# ---------------------------------------------------------------- el registration
rep("""'multiPreviewButton','multiPreviewGrid'""",
    """'diagramHiddenButton','multiPreviewButton','multiPreviewGrid'""")

# ---------------------------------------------------------------- CSS
rep("""    .diagram-workspace-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }""",
    """    .diagram-workspace-actions { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .diagram-hidden-chip { white-space: nowrap; }
    .diagram-hidden-chip[hidden] { display: none !important; }
    /* The one you are on, but put away: it leaves the bar when you open another. */
    .diagram-tab[data-put-away="true"] { border-style: dashed; }""")

# ---------------------------------------------------------------- the count, the chip and the cue
rep("""        const hiddenCount = state.diagrams.filter(d => d.hiddenFromBar && d.id !== state.activeDiagramId).length;
        el.diagramCount.textContent = `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}`          + (hiddenCount ? ` \\u00b7 ${hiddenCount} hidden` : '');
        el.diagramCount.title = hiddenCount ? 'Hidden diagrams are still in the workspace - open All previews to see them.' : '';""",
    """        const hiddenCount = state.diagrams.filter(d => d.hiddenFromBar && d.id !== state.activeDiagramId).length;
        el.diagramCount.textContent = `${state.diagrams.length} diagram${state.diagrams.length === 1 ? '' : 's'}`;
        el.diagramCount.title = 'Alt+1 to Alt+9 jump to the first nine diagrams; Ctrl+K searches all of them.';
        // Put away is not thrown away, and it must not take a tooltip to find that out.
        if (el.diagramHiddenButton) {
          const putAway = state.diagrams.filter(d => d.hiddenFromBar);
          el.diagramHiddenButton.hidden = !putAway.length;
          el.diagramHiddenButton.textContent = `${putAway.length} put away`;
          el.diagramHiddenButton.title = putAway.length === 1
            ? 'One diagram is out of the bar. Click to bring it back.'
            : `${putAway.length} diagrams are out of the bar. Click to bring one back.`;
        }
        // The tab you are on can be one of them: say so, so leaving it is not a surprise.
        const activeTabEl = el.diagramTabs.querySelector('.diagram-tab[aria-selected="true"]');
        const activeDiagram = state.diagrams.find(d => d.id === state.activeDiagramId);
        if (activeTabEl) {
          if (activeDiagram && activeDiagram.hiddenFromBar) {
            activeTabEl.dataset.putAway = 'true';
            activeTabEl.title = 'This diagram is put away: it leaves the bar when you open another one. Bring it back from the button on the right.';
          } else {
            delete activeTabEl.dataset.putAway;
            activeTabEl.removeAttribute('title');
          }
        }""")

# ---------------------------------------------------------------- the menu
rep("""      function handleDiagramTabKeydown(event, currentIndex) {""",
    """      // Everything that is out of the bar, and the way back.
      function openHiddenDiagramsMenu() {
        const putAway = state.diagrams.filter(d => d.hiddenFromBar);
        if (!putAway.length) return;
        const rows = [[null, putAway.length === 1 ? 'Put away' : `${putAway.length} put away`, 'heading']];
        putAway.forEach(diagram => {
          rows.push([diagram.id, String(diagram.name || diagram.diagramTitle || 'Untitled diagram').slice(0, 60)]);
        });
        if (putAway.length > 1) rows.push(['__all__', 'Bring them all back']);
        openStructureMenu(el.diagramHiddenButton, rows, '', picked => {
          if (picked === '__all__') {
            putAway.forEach(diagram => { diagram.hiddenFromBar = false; });
            scheduleSave();
            renderDiagramTabs();
            showToast(`${putAway.length} diagrams are back in the bar.`, 'success');
            return;
          }
          const diagram = state.diagrams.find(item => item.id === picked);
          if (!diagram) return;
          setDiagramHiddenFromBar(diagram.id, false);
          switchDiagram(diagram.id);
        }, { keyboard: true, role: 'menu', label: 'Diagrams put away', plain: true });
      }

      function handleDiagramTabKeydown(event, currentIndex) {""")

rep("""        el.diagramTabs.appendChild(tab);""",
    """        el.diagramTabs.appendChild(tab);""")

# wiring
rep("""        el.undoButton.addEventListener('click', undoSource);""",
    """        if (el.diagramHiddenButton) el.diagramHiddenButton.addEventListener('click', openHiddenDiagramsMenu);
        el.undoButton.addEventListener('click', undoSource);""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('hidden-restore applied: %d -> %d chars' % (len(orig), len(s)))
