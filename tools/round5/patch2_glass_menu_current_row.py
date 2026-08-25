import io, os, sys

# R5 FIX pass, script 2 of 2. Apply AFTER patch1_glass_canvas_surfaces.py.
#
# Defect from the verifier: the structure menu's current row (aria-selected) is
# painted var(--primary) by .struct-menu-item[aria-selected="true"]. On the now-solid
# Cupertino surface that label measures 4.92 / 5.30 / 2.86 / 2.93 unfocused and
# 3.73 / 4.00 / 2.38 / 2.42 in the state the menu actually opens in (the current row
# is auto-focused, so it wears the 20% --primary wash). The night values fail the
# brief's 4.5:1 bar outright and every focused value fails it. Same failure the chip
# rule one line above already fixes, so it gets the same fix.

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

assert '--ui-float-bg' in s, 'apply patch1_glass_canvas_surfaces.py first: ' + APP
assert '.struct-menu-item[aria-selected="true"] { color: var(--text); }' not in s, 'already applied to ' + APP

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

ANCHOR = """    [data-theme="cupertino"] .canvas-popover .canvas-chip[aria-pressed="true"] { color: var(--text); }
"""

ADDITION = """    /* The same thing again in the menu the canvas raises: the row you are already on
       was accent-coloured, and on the solid surface - especially at night, and
       especially once it takes focus and gets the accent wash under it - that colour
       is too close to its own background to read. The row stays bold and stays
       focused, which is what says "you are here"; the words take --text. */
    [data-theme="cupertino"] .struct-menu-item[aria-selected="true"] { color: var(--text); }
"""

rep(ANCHOR, ANCHOR + ADDITION)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
