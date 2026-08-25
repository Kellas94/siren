"""
The View menu must not name a current flow direction when there is none.

Caught by looking at the rendered menu, not at the numbers: on a mindmap both flow rows are correctly
greyed out and correctly explain themselves - and 'Horizontal' was still painted in the accent colour
and bold, the app's way of saying "this is the current one". It is not. A mindmap sets its own
direction in code; neither answer is live.

The cause is a two-way ternary over a three-state fact. syncLayoutOrientationControl writes
aria-pressed as String(!disabled && ...), so when the switch is disabled BOTH buttons read "false" -
and `vertical ? vertical : horizontal` reports horizontal for what is really "neither".

Passing an empty current is exactly right rather than a workaround: openStructureMenu only marks a
row when `current` is truthy, so no row is marked and the menu states nothing it cannot support.

Anchor-guarded, not SHA-pinned. Apply AFTER patch_toolbar_menu_state.py.

Usage: python patch_toolbar_no_false_current.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())


def patch(name, old, new, count=1):
    global s
    found = s.count(old)
    assert found == count, "%s: expected %d occurrence(s), found %d" % (name, count, found)
    s = s.replace(old, new, count)
    print("  applied: %s" % name)


patch(
    "1. neither direction is current when neither is pressed",
    "        const vertical = document.getElementById('verticalLayoutButton');\n"
    "        const live = vertical && vertical.getAttribute('aria-pressed') === 'true'\n"
    "          ? 'verticalLayoutButton' : 'horizontalLayoutButton';",
    "        // Three states, not two: vertical, horizontal, or neither - the last being every type\n"
    "        // that sets its own direction in code, where the switch is disabled and both buttons\n"
    "        // read aria-pressed=\"false\". A two-way ternary silently reports horizontal for that,\n"
    "        // marking a row as current in a menu where nothing is.\n"
    "        const pressed = id => {\n"
    "          const b = document.getElementById(id);\n"
    "          return !!b && !b.disabled && b.getAttribute('aria-pressed') === 'true';\n"
    "        };\n"
    "        const live = pressed('verticalLayoutButton') ? 'verticalLayoutButton'\n"
    "          : pressed('horizontalLayoutButton') ? 'horizontalLayoutButton' : '';",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
