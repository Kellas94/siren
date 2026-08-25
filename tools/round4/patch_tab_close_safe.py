r"""Going to another diagram put it away instead of opening it.

Measured: every tab carried a 24px hide zone at its right edge that armed itself the moment
the pointer entered the tab - which is always, a fraction before the click. A tab is 132 to
220px wide, so clicking the right-hand side of one (a perfectly ordinary place to click a
wide tab, and the only place left when a long name is masked under the zone) hid that
diagram instead of opening it. Reproduced on a fresh workspace: with Diagram 2 open, one
click near the right edge of Diagram 3's tab removed Diagram 3 from the bar and left
Diagram 2 open. The strip then re-flows, so the next click lands on a different tab - which
is how five diagrams end up hidden without anyone meaning it.

The rule now: **a click on a tab you are not on always opens it.** The x exists only on the
tab you are already on, where there is nothing left to select and putting it away is the
only thing that zone could mean. Every other diagram is put away from its right-click menu,
which carries the same action and says what it does.

The x is also drawn properly now: it was tinted from the tab's own text colour at 12%, which
on a light theme is a smudge you cannot see - the owner reported not seeing it at all. It
gets a real surface, a border and full-strength glyph.
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

# ---------------------------------------------------------------- only on the tab you are on
rep("""          // Hide-from-bar on the tab itself: a x that is absent at rest and appears
          // under the pointer. It is a zone of the one tab button, not a nested
          // control (a button in a button is invalid and breaks the focus ring), so
          // the click handler tells the two zones apart. Absent when it could not
          // act: the last visible diagram stays in the bar.
          if (visibleTabCount > 1 && !diagram.hiddenFromBar) {""",
    """          // Hide-from-bar on the tab itself: a x that is absent at rest and appears
          // under the pointer. It is a zone of the one tab button, not a nested
          // control (a button in a button is invalid and breaks the focus ring), so
          // the click handler tells the two zones apart. Absent when it could not
          // act: the last visible diagram stays in the bar.
          // And absent on every tab but the one you are on: a click meant to OPEN a
          // diagram must never put it away, and the right edge of a tab is where a
          // pointer naturally lands. The others are put away from their right-click menu.
          if (visibleTabCount > 1 && !diagram.hiddenFromBar && diagram.id === state.activeDiagramId) {""")

# ---------------------------------------------------------------- and make it visible
rep("""      color: inherit;
      background: color-mix(in srgb, currentColor 12%, transparent);
      opacity: 0;
      pointer-events: none;
      transition: opacity .12s ease, background 140ms ease;
    }""",
    """      color: inherit;
      /* A tint of the tab's own colour was invisible on a light theme; give it a real
         surface so the zone is legible before it is clicked, not after. */
      background: var(--panel-bg);
      border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
      opacity: 0;
      pointer-events: none;
      transition: opacity .12s ease, background 140ms ease, border-color 140ms ease;
    }""")
rep("""    .diagram-tab-close:hover { background: color-mix(in srgb, currentColor 26%, transparent); }""",
    """    .diagram-tab-close:hover { background: color-mix(in srgb, var(--danger, #b3403a) 18%, var(--panel-bg)); border-color: color-mix(in srgb, var(--danger, #b3403a) 55%, transparent); }""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('tab close made safe: %d -> %d chars' % (len(orig), len(s)))
