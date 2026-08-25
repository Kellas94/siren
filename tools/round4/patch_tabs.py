"""SIREN patch: diagram tab right-click / keyboard menu + Safari-style hover x (Hide from bar).
Fix round: the hover/focus name fade is scoped to tabs that actually carry the x (:has).

Regions touched (all local, anchor-guarded):
  1. CSS .diagram-tab { ... }            - adds position: relative
  2. CSS after .diagram-tab-name rule    - adds .diagram-tab-close rules + hover fade on the name
  3. renderDiagramTabs                   - visibleCount, tab.dataset.diagramId, the x zone, click split
  4. buildContextMenu                    - one early-return 'if' right after the opening line
  5. new buildDiagramTabContextMenu      - inserted just before buildBoardCardContextMenu
Usage: python patch_tabs.py <path-to-app.html>
"""
import io, os, sys
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# Idempotence: if the patch is already in, do nothing.
if 'function buildDiagramTabContextMenu(' in s:
    print('already applied', len(s))
    sys.exit(0)

# 1. the tab is the positioning box for its hover x
rep("""    .diagram-tab {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 132px;
      max-width: 220px;
      min-height: 34px;
      padding: 7px 10px;
""", """    .diagram-tab {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-width: 132px;
      max-width: 220px;
      min-height: 34px;
      padding: 7px 10px;
""")

# 2. the hover x and the name fade beneath it
rep("""    .diagram-tab-name { overflow: hidden; text-overflow: ellipsis; }
""", """    .diagram-tab-name { overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; text-align: start; }
    /* Safari-style dismiss: nothing at rest, a x under the pointer (or keyboard
       focus, so the affordance is discoverable; the key route is the tab menu).
       It lays over the tail of the name instead of reserving width, so no tab
       moves when it appears; the name fades out under it so no letters or
       ellipsis show through. 24px is the app's hit floor. The background is
       currentColor-tinted, so it sits right on every theme's tab colour. */
    .diagram-tab-close {
      position: absolute;
      right: 4px;
      top: 50%;
      width: 24px;
      height: 24px;
      margin-top: -12px;
      display: grid;
      place-items: center;
      border-radius: 6px;
      font-size: 15px;
      font-weight: 600;
      font-family: inherit;
      line-height: 1;
      letter-spacing: 0;
      color: inherit;
      background: color-mix(in srgb, currentColor 12%, transparent);
      opacity: 0;
      pointer-events: none;
      transition: opacity .12s ease, background 140ms ease;
    }
    .diagram-tab:hover .diagram-tab-close,
    .diagram-tab:focus-visible .diagram-tab-close { opacity: 1; pointer-events: auto; }
    /* The fade only where there is a x to fade under: a tab without one (the
       last visible, or the active-but-hidden tab) keeps its full name on hover. */
    .diagram-tab:has(.diagram-tab-close):hover .diagram-tab-name,
    .diagram-tab:has(.diagram-tab-close):focus-visible .diagram-tab-name {
      -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent calc(100% - 14px));
      mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent calc(100% - 14px));
    }
    .diagram-tab-close:hover { background: color-mix(in srgb, currentColor 26%, transparent); }
    /* Touch has no hover; a long-press raises contextmenu, which opens the tab menu. */
    @media (hover: none) { .diagram-tab-close { display: none; } }
""")

# 3. renderDiagramTabs: id on the tab, the x zone, and the click split
rep("""        el.diagramTabs.replaceChildren();
        state.diagrams.forEach((diagram, index) => {
          // Hidden from the bar, not from the workspace: the board still lists it.
          if (diagram.hiddenFromBar && diagram.id !== state.activeDiagramId) return;
""", """        el.diagramTabs.replaceChildren();
        const visibleTabCount = state.diagrams.filter(d => !d.hiddenFromBar).length;
        state.diagrams.forEach((diagram, index) => {
          // Hidden from the bar, not from the workspace: the board still lists it.
          if (diagram.hiddenFromBar && diagram.id !== state.activeDiagramId) return;
""")
rep("""          tab.tabIndex = diagram.id === state.activeDiagramId ? 0 : -1;
          tab.title = diagram.folderId
""", """          tab.tabIndex = diagram.id === state.activeDiagramId ? 0 : -1;
          // The right-click / Shift+F10 menu (buildDiagramTabContextMenu) reads the id from here.
          tab.dataset.diagramId = diagram.id;
          tab.title = diagram.folderId
""")
rep("""          tab.append(badge, name);
          tab.addEventListener('click', () => switchDiagram(diagram.id));
""", """          tab.append(badge, name);
          // Hide-from-bar on the tab itself: a x that is absent at rest and appears
          // under the pointer. It is a zone of the one tab button, not a nested
          // control (a button in a button is invalid and breaks the focus ring), so
          // the click handler tells the two zones apart. Absent when it could not
          // act: the last visible diagram stays in the bar.
          if (visibleTabCount > 1 && !diagram.hiddenFromBar) {
            const close = document.createElement('span');
            close.className = 'diagram-tab-close';
            close.textContent = '\\u00d7';
            close.title = 'Hide from bar \\u2014 the diagram stays in the workspace';
            close.setAttribute('aria-hidden', 'true');
            tab.appendChild(close);
          }
          tab.addEventListener('click', event => {
            if (event.target instanceof Element && event.target.closest('.diagram-tab-close')) {
              setDiagramHiddenFromBar(diagram.id, true);
              // The strip was just rebuilt under the pointer; keep focus on a tab.
              el.diagramTabs.querySelector('.diagram-tab[aria-selected="true"]')?.focus({ preventScroll: true });
              return;
            }
            switchDiagram(diagram.id);
          });
""")

# 4. the ladder: a tab is asked first (Present covers the strip, so it cannot be the target there)
rep("""      function buildContextMenu(target) {
""", """      function buildContextMenu(target) {
        const diagramTab = target.closest('#diagramTabs .diagram-tab');
        if (diagramTab) return buildDiagramTabContextMenu(diagramTab);
""")

# 5. the builder, next to the board card's (same verbs, same helpers)
rep("""      function buildBoardCardContextMenu(card) {
""", """      /* ---------------- a diagram tab ----------------
         The strip is navigation; its menu is the board card's menu minus export, so
         one diagram has the same verbs wherever it is met. Hide from bar is the
         dismiss: the diagram stays in the workspace. Reached by right-click, the
         Menu key and Shift+F10 on a focused tab - all through the one ladder. */
      function buildDiagramTabContextMenu(tab) {
        const id = tab.dataset.diagramId;
        const diagram = (state.diagrams || []).find(entry => entry.id === id);
        if (!diagram) return null;
        const visibleCount = state.diagrams.filter(d => !d.hiddenFromBar).length;
        // The strip is rebuilt after a hide or a duplicate, so the tab the menu came
        // from may be gone; land focus on the active tab instead of losing it to body.
        const focusActiveTab = () => el.diagramTabs.querySelector('.diagram-tab[aria-selected="true"]')?.focus({ preventScroll: true });
        const rows = [[null, diagram.name, 'heading']];
        if (!readOnlyMode) {
          rows.push([() => workspaceQuickAction('rename', id), 'Rename\\u2026']);
          rows.push([() => { workspaceQuickAction('duplicate', id); focusActiveTab(); }, 'Duplicate']);
          rows.push([() => openFolderChoiceMenu(tab, 'Move ' + diagram.name + ' to',
            folderId => { workspaceQuickAction('move:' + folderId, id); focusActiveTab(); }), 'Move to a project\\u2026']);
        }
        rows.push(diagram.hiddenFromBar
          ? [() => { setDiagramHiddenFromBar(id, false); focusActiveTab(); }, 'Show in bar']
          : [() => { setDiagramHiddenFromBar(id, true); focusActiveTab(); }, 'Hide from bar',
            visibleCount <= 1 ? 'The last visible diagram stays in the bar.' : false]);
        if (!readOnlyMode) rows.push([() => workspaceQuickAction('delete', id), 'Delete']);
        return { rows, anchor: tab, label: 'Actions for ' + diagram.name };
      }

      function buildBoardCardContextMenu(card) {
""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
