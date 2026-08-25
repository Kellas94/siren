"""
The View menu's current flow direction, marked in the app's own language.

The first cut faked a tick out of two figure-spaces, and it showed: 'Vertical flow' and
'Horizontal flow' start six pixels apart, because a check glyph and two figure spaces are not the
same width. The app already HAS a way to say which row is the current one - accent colour and bold,
from .struct-menu-item[aria-selected="true"] - and openStructureMenu already focuses that row when
the menu opens. It was simply gated to listboxes.

Widening that gate is safe because every existing role:'menu' caller passes '' as `current`, which
is falsy, so nothing changes for any of them. Only a caller that asks for it gets the marking.

While there, the two direction rows get a heading. A View menu is a list of ACTIONS with one
two-state choice sitting inside it; without a heading, 'Vertical' reads like a third thing to do
rather than the current answer to a question the menu is already asking.

Note on the source strings below: the app writes its non-ASCII as literal \\uXXXX escapes in the
JavaScript, so the anchors here must contain a real backslash followed by 'u'. In Python source
that is written '\\u' - and this file is written with an editor rather than a shell heredoc,
because a heredoc collapses the pair and Python then matches a real ellipsis against a file that
holds six characters.

Anchor-guarded, not SHA-pinned.

Usage: python patch_toolbar_menu_state.py <path-to-siren.html>
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
    "1. let a menu mark its current row too",
    "          if (role === 'listbox') item.setAttribute('aria-selected', String(value === current));",
    "          // A menu can have a current row as well: one that contains a two-state choice - which\n"
    "          // way does the diagram flow - has a current answer, and the app already has a way to\n"
    "          // show it. Gated on `current` being set, so the five existing menu callers, which all\n"
    "          // pass '', are untouched.\n"
    "          if (role === 'listbox' || current) item.setAttribute('aria-selected', String(value === current));",
)

patch(
    "2. the View menu says which flow is live, without faking a tick",
    "      function openPreviewViewMenu(anchor) {\n"
    "        const vertical = document.getElementById('verticalLayoutButton');\n"
    "        const on = vertical && vertical.getAttribute('aria-pressed') === 'true';\n"
    "        openStructureMenu(anchor, previewGroupRows([\n"
    "          ['zoomChipButton', 'Fit the whole diagram'],\n"
    "          ['zoomMenuButton', 'Zoom\\u2026'],\n"
    "          ['verticalLayoutButton', (on ? '\\u2713 ' : '\\u2007\\u2007') + 'Vertical flow'],\n"
    "          ['horizontalLayoutButton', (on ? '\\u2007\\u2007' : '\\u2713 ') + 'Horizontal flow']\n"
    "        ]), '', forwardTo, { plain: true, keyboard: true, role: 'menu', label: 'View' });\n"
    "      }",
    "      function openPreviewViewMenu(anchor) {\n"
    "        const vertical = document.getElementById('verticalLayoutButton');\n"
    "        const live = vertical && vertical.getAttribute('aria-pressed') === 'true'\n"
    "          ? 'verticalLayoutButton' : 'horizontalLayoutButton';\n"
    "        const rows = previewGroupRows([\n"
    "          ['zoomChipButton', 'Fit the whole diagram'],\n"
    "          ['zoomMenuButton', 'Zoom\\u2026']\n"
    "        ]);\n"
    "        // The heading matters: without it 'Vertical' reads as a third thing to do rather than\n"
    "        // the current answer to a question the menu is already asking.\n"
    "        rows.push(['', 'Flow', 'heading']);\n"
    "        rows.push.apply(rows, previewGroupRows([\n"
    "          ['verticalLayoutButton', 'Vertical'],\n"
    "          ['horizontalLayoutButton', 'Horizontal']\n"
    "        ]));\n"
    "        openStructureMenu(anchor, rows, live, forwardTo,\n"
    "          { plain: true, keyboard: true, role: 'menu', label: 'View' });\n"
    "      }",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
