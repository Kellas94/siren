import io, os, sys

# R5 FIX pass, script 1 of 2.
# This is the round-5 "glass" builder script (r5-glass/patch_glass_canvas_surfaces.py)
# rebased onto FROZEN_1_63_6.html. The anchor line is byte-identical in 1.63.6, so
# nothing had to move. One comment sentence was corrected: the verifier proved the
# rename box does NOT keep its --primary ring (a light-family rule pins the border
# colour with !important), and the file is read by a non-coder owner, so a comment
# that says something untrue is a bug of its own.

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

# Run twice by mistake and you get the block twice. Stop loudly instead.
assert '--ui-float-bg' not in s, 'already applied to ' + APP

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

# The floating surfaces the canvas raises get a solid finish on Cupertino Glass.
# Inserted straight after the round-4 T4 menu block so every glass-menu rule sits
# in one place; the token trio is what all of them read.
ANCHOR = """    [data-theme="cupertino"][data-cupertino-variant^="night"] .theme-menu-nav { background: rgba(30, 35, 45, .96); }
"""

ADDITION = """    /* R5: the surfaces the canvas raises - the new-block popover with its shape chips
       and name field, the rename-in-place box, the hint pill and the structure menu -
       are things you must READ and HIT. On the glass finishes they inherited the
       page's translucency with no blur of their own, so the diagram showed straight
       through the chips and the field. They take a solid surface and a real border;
       the page keeps its glass. Two surface values only, day and night: the Blue and
       Green finishes change --primary, not the surface. */
    [data-theme="cupertino"] {
      --ui-float-bg: #fcfcfe;
      --ui-float-border: rgba(52, 55, 64, .45);
      --ui-float-field-bg: #ffffff;
    }
    [data-theme="cupertino"][data-cupertino-variant^="night"] {
      --ui-float-bg: #262b36;
      --ui-float-border: rgba(190, 202, 222, .42);
      --ui-float-field-bg: #1b2029;
    }
    [data-theme="cupertino"] .canvas-popover,
    [data-theme="cupertino"] .canvas-hint,
    [data-theme="cupertino"] .struct-menu {
      background: var(--ui-float-bg, var(--panel-elevated));
      border-color: var(--ui-float-border, var(--border-strong));
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    /* The night structure-menu rule above is one attribute more specific, so night has
       to name the menu again to hand it the same solid surface. */
    [data-theme="cupertino"][data-cupertino-variant^="night"] .struct-menu {
      background: var(--ui-float-bg, var(--panel-elevated));
      border-color: var(--ui-float-border, var(--border-strong));
    }
    /* Three of these floaters are <input>s, and every light-family theme pins native
       control chrome with "background-color: var(--input-bg) !important" - right for a
       field inside a panel, wrong for the rename box, which floats over the diagram
       with nothing behind it. That rule carries five :not()s, so only an id outranks
       it. Only the fill is changed here. The rename box's border is already pinned
       grey by that same light-family rule - it has never shown its --primary ring on
       these themes, and this block does not change that either way. */
    [data-theme="cupertino"] #canvasInplace,
    [data-theme="cupertino"] #canvasPopLabel,
    [data-theme="cupertino"] #canvasPopBranch {
      background-color: var(--ui-float-field-bg, var(--input-bg)) !important;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    /* The pressed chip says which shape you are about to place. Its label was
       --primary, and --primary here is a fill colour made for white text on top of it,
       not ink: on its own 12% wash it measured 4.1:1 by day and 2.6:1 at night. The
       accent keeps the ring and the wash - that is the state - and the label takes
       --text, which is the part you have to read. */
    [data-theme="cupertino"] .canvas-popover .canvas-chip[aria-pressed="true"] { color: var(--text); }
"""

rep(ANCHOR, ANCHOR + ADDITION)

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
