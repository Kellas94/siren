import io, os, sys
# Round-5 fix for the pop-out's Guided toolbar.
# In Guided the window's toolbar carries only the mode switch, undo, redo, Render and
# the More button - Insert / Comment / Find / Line all stand down. The deliberate wrap
# point that Text needs between 562 and 663px therefore fired on a row that still had
# room, and pushed the lone "..." button onto a second row of its own. Guided keeps its
# one row: the break steps aside, and if a very large text size ever does make the row
# wrap on its own it wraps with the normal 6px gap rather than the flush one Text uses.
APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

assert s.count(".editor-popout-toolbar .popout-break { display: none; }") == 1, 'already applied?'

rep("""    #editorPopout.is-guided .editor-popout-toolbar #popoutMoreButton { margin-left: auto; }""",
    """    #editorPopout.is-guided .editor-popout-toolbar #popoutMoreButton { margin-left: auto; }
    /* Guided's row is short, so it never needs the planned break that Text wraps at. */
    #editorPopout.is-guided .editor-popout-toolbar .popout-break { display: none; }
    #editorPopout.is-guided .editor-popout-toolbar { row-gap: 6px; }""")

tmp = APP + '.tmp'; io.open(tmp, 'w', encoding='utf-8', newline='').write(s); os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
