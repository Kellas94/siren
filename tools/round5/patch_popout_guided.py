import io, os, sys
# The pop-out editor gains the Text / Guided switch. The switch itself and the guided
# rows are MOVED into the floating window (never cloned), so every listener, the drag,
# the inline edit and the right-click menu keep working, and Esc puts them all back in
# the docked column exactly where they were.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- HTML: the switch
# The switch gets an id so it can be carried to the window, and a marker for its seat.
rep("""<div class="layout-switch" role="group" aria-label="Choose how to edit the diagram">""",
    """<div class="layout-switch" id="editorModeSwitch" role="group" aria-label="Choose how to edit the diagram">""")

rep("""title="The same Mermaid code, with its parts clickable: rename a block, swap a shape, change a connector">✦ Guided</button>
              </div>""",
    """title="The same Mermaid code, with its parts clickable: rename a block, swap a shape, change a connector">✦ Guided</button>
              </div>
              <span id="layoutSwitchHome" hidden></span>""")

# The window's toolbar gets an id: the switch is inserted at its head while the editor
# is out, so the mode control reads first, as it does in the column.
rep("""      <div class="editor-popout-toolbar">
        <button class="btn ghost icon" id="popoutUndoButton\"""",
    """      <div class="editor-popout-toolbar" id="editorPopoutToolbar">
        <button class="btn ghost icon" id="popoutUndoButton\"""")

# ---------------------------------------------------------------- el map
rep("""'popoutFindMount','popoutLintStatus','popoutGoToLine','popoutFooter','findReplaceHome',""",
    """'popoutFindMount','popoutLintStatus','popoutGoToLine','popoutFooter','findReplaceHome',
          'editorPopoutToolbar','editorModeSwitch','layoutSwitchHome',""")

# ---------------------------------------------------------------- CSS
rep("""    .code-editor.is-wrapped textarea { white-space: pre-wrap; overflow-wrap: anywhere; }""",
    """    .code-editor.is-wrapped textarea { white-space: pre-wrap; overflow-wrap: anywhere; }
    /* The guided rows fill the floating window the way the code does: the rows scroll
       inside it instead of keeping the docked column's fixed ceiling. */
    .editor-popout-mount .structure-editor { height: 100%; min-height: 0; grid-template-rows: auto minmax(0, 1fr); gap: 0; }
    .editor-popout-mount .structure-rows { max-height: none; height: 100%; min-height: 0; }
    /* Guided edits chips, not characters. The controls that only make sense against the
       typed source stand down while it shows, rather than acting on a hidden textarea. */
    #editorPopout.is-guided .editor-popout-toolbar .popout-option[for="popoutInsert"],
    #editorPopout.is-guided #popoutCommentButton,
    #editorPopout.is-guided #popoutFindButton,
    #editorPopout.is-guided .popout-goto { display: none; }
    /* Go-to-line normally carries the auto margin that pushes the tail of the row right. */
    #editorPopout.is-guided .editor-popout-toolbar #popoutMoreButton { margin-left: auto; }
    /* The mode switch is the head of the window's toolbar while the editor is out, and
       it takes the row's own 30px height: a taller control makes the row read crooked
       and steals height from the code. */
    .editor-popout-toolbar .layout-switch { flex: 0 0 auto; padding: 2px; border-radius: 8px; }
    .editor-popout-toolbar .layout-switch .layout-choice { min-height: 24px; padding: 3px 8px; }""")

# The toolbar carries one more control (144px + its gap), so every width at which it
# starts shedding words moves up by the same 151px. Measured: one row again at the
# window's own 760px, where it had fallen to two.
for old, new in ((704, 855), (664, 815), (544, 695), (512, 663), (470, 621), (410, 561)):
    rep("@container (max-width: %dpx)" % old, "@container (max-width: %dpx)" % new)

# ---------------------------------------------------------------- moving the editors
rep("""          el.editorPopoutMount.appendChild(el.codeEditor);""",
    """          el.editorPopoutMount.appendChild(el.codeEditor);
          // The guided rows travel with the code: same nodes, same listeners, so the
          // drag, the inline edit and the row menu work in the window untouched.
          if (el.structureEditor) el.editorPopoutMount.appendChild(el.structureEditor);
          if (el.editorPopoutToolbar && el.editorModeSwitch) {
            el.editorPopoutToolbar.insertBefore(el.editorModeSwitch, el.editorPopoutToolbar.firstChild);
          }""")

rep("""          syncPopoutStats();
          syncPopoutLint();
          el.source.focus();""",
    """          syncPopoutStats();
          syncPopoutLint();
          // Focus lands in whichever editor is showing: the textarea, or the first chip.
          if (state.structureMode) {
            const chip = el.structureRows && el.structureRows.querySelector('.struct-token[tabindex]');
            if (chip) chip.focus();
          } else {
            el.source.focus();
          }""")

rep("""          el.editorHome.parentNode.insertBefore(el.codeEditor, el.editorHome);""",
    """          el.editorHome.parentNode.insertBefore(el.codeEditor, el.editorHome);
          // Back in the column in the order they left it: code, then the guided rows.
          if (el.structureEditor) el.editorHome.parentNode.insertBefore(el.structureEditor, el.editorHome);
          if (el.layoutSwitchHome && el.editorModeSwitch) {
            el.layoutSwitchHome.parentNode.insertBefore(el.editorModeSwitch, el.layoutSwitchHome);
          }""")

# ---------------------------------------------------------------- wiring
# The switch now lives in the window, so choosing Guided no longer has to dock it.
rep("""        // The guided rows live in the docked column, so switching to them brings the
        // editor home first instead of leaving an empty window behind. Capture phase:
        // it has to run before the listener that swaps the editors.
        if (el.structureModeButton) el.structureModeButton.addEventListener('click', () => {
          if (el.editorPopout && !el.editorPopout.hidden) setEditorPoppedOut(false);
        }, true);
""", "")

# Pop out no longer forces Text: the window carries the guided rows now, so the editor
# arrives in the window in the mode the person was working in.
rep("""          // grab it, so the same button recentres it instead of doing nothing.
          setStructureMode(false);
          if (el.editorPopout && !el.editorPopout.hidden) resetEditorFloatPlacement();""",
    """          // grab it, so the same button recentres it instead of doing nothing.
          if (el.editorPopout && !el.editorPopout.hidden) resetEditorFloatPlacement();""")

# Find and replace works on the typed source, so it switches to Text first - the same
# route the docked Find button takes.
rep("""        if (el.popoutFindButton) el.popoutFindButton.addEventListener('click', () => toggleFindReplace());""",
    """        if (el.popoutFindButton) el.popoutFindButton.addEventListener('click', () => { setStructureMode(false); toggleFindReplace(); });""")

# Escape inside an open chip belongs to the chip: it cancels that edit, and the window
# stays where it is. (The row drag stops its own Escape before it gets here.)
rep("""          if (event.key !== 'Escape') return;
          event.preventDefault();
          if (el.findReplacePanel && !el.findReplacePanel.hidden && el.editorPopout.contains(el.findReplacePanel)) {""",
    """          if (event.key !== 'Escape') return;
          if (event.target instanceof Element && event.target.closest('.struct-inline-input')) return;
          event.preventDefault();
          if (el.findReplacePanel && !el.findReplacePanel.hidden && el.editorPopout.contains(el.findReplacePanel)) {""")

# The window says which editor it is showing, so its text-only controls can stand down.
rep("""        if (el.structureModeButton) el.structureModeButton.setAttribute('aria-pressed', String(enabled));""",
    """        if (el.editorPopout) el.editorPopout.classList.toggle('is-guided', enabled);
        if (el.structureModeButton) el.structureModeButton.setAttribute('aria-pressed', String(enabled));""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
