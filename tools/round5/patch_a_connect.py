"""style5 (a), fix pass: the preview toolbar's Connect button becomes a mode chip on a
mouse, and STAYS a normal button on a phone.

Starting connect mode already lives on a block's own right-click menu ("Connect from
here"), which is strictly better because it also picks the source block for you, on the
guided "Add a connector" card, and - since 1.63.6 - on a block's side handle dragged
onto another block. On a pointing device the toolbar button's only unique job was
telling you the mode is ON and letting you click your way out of it, so above the
mobile breakpoint that is all it does: hidden at rest, shown while connecting.

Below 900px there is no right-click, so the button keeps its old job: it is the way IN
as well as the way out. That is why the hide-at-rest rule lives in a media query, and
why the markup keeps the resting words ("Connect") - setConnectMode swaps the label,
the tooltip and now the aria-label when the mode turns on.

Rebased onto FROZEN_1_63_6.html; every anchor below matched that file unchanged.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)


# --- 1. CSS: on a mouse the chip only exists while the mode is on ------------
rep(
    """    /* Connect is a mode the user has to leave again, so make "on" unmistakable. */""",
    """    /* Connect mode is STARTED from a block: "Connect from here" on its right-click
       menu (which also picks the source), or a side handle dragged onto another block.
       So on a pointing device this chip is only the way OUT of the mode, and it is not
       in the toolbar until there is a mode to leave.
       On a phone there is no right-click, so below the mobile breakpoint the button
       keeps its old job and stays where a finger can find it. */
    @media (min-width: 901px) {
      .btn#connectModeButton { display: none; }
      body.connect-mode .btn#connectModeButton { display: inline-flex; }
    }

    /* Connect is a mode the user has to leave again, so make "on" unmistakable. */""")

# --- 2. the tooltip now says the chip is the exit ----------------------------
rep(
    """          ? 'Connect mode is on. Click a source block, then a target block. Press Esc to leave.'""",
    """          ? 'Connecting. Click a source block, then a target block. Click here or press Esc to stop.'""")

# --- 3. ...and so does the name a screen reader hears while the mode is on ---
rep(
    """        setToolbarButtonLabel(el.connectModeButton, '⇢', connectMode ? 'Connecting…' : 'Connect');""",
    """        setToolbarButtonLabel(el.connectModeButton, '⇢', connectMode ? 'Connecting…' : 'Connect');
        // While the mode is on the button is the exit, so it must say so out loud too.
        el.connectModeButton.setAttribute('aria-label', connectMode ? 'Stop connecting' : 'Connect blocks');""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('patch_a_connect applied', len(orig), '->', len(s), 'delta', len(s) - len(orig))
