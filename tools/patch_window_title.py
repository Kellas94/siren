"""
The window says the name you gave the diagram, not the one the app generated.

1.67.0 made the window title name the diagram, which fixed the real complaint - a second tab was
guesswork. But it reads

    const name = String(diagram?.name || diagram?.diagramTitle || '').trim() || 'Untitled diagram';

and `name` is the tab label the app generates ("Diagram 1"), while `diagramTitle` is what a person
typed. So the preference is backwards from the point of view of whoever named it: type "Q3 approvals
walk" into the title and the window still says "Diagram 1 - v1.69.0 - SIREN". Measured before and
after typing: identical.

The repair uses an answer the app already has rather than inventing a second one. Round 8 added
`diagramTitleTouched`, a persisted flag meaning a person typed this title rather than the app
generating it - the same flag that stops Undo from discarding a name. If it is set, that name is the
one somebody chose, and it is what the window should carry.

When nobody has typed a title the behaviour is unchanged: the tab label, then the generated title,
then "Untitled diagram".

Anchor-guarded, not SHA-pinned.

Usage: python patch_window_title.py <path-to-siren.html>
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
    "1. a name somebody typed wins over one the app generated",
    "        const name = String(diagram?.name || diagram?.diagramTitle || '').trim() || 'Untitled diagram';",

    "        // diagram.name is the tab label the app generates; diagram.diagramTitle is what a person\n"
    "        // typed. Preferring the former meant naming a diagram left the window still saying\n"
    "        // \"Diagram 1\". diagramTitleTouched already records which of the two somebody chose - it\n"
    "        // is the flag that stops Undo discarding a typed name - so this asks it rather than\n"
    "        // guessing from the strings.\n"
    "        const chosen = diagram && diagram.diagramTitleTouched\n"
    "          ? String(diagram.diagramTitle || '').trim() : '';\n"
    "        const name = chosen || String(diagram?.name || diagram?.diagramTitle || '').trim() || 'Untitled diagram';",
)

patch(
    "2. and the window re-reads itself when the title is typed",
    "      function updateTitlePreview() {",
    "      function updateTitlePreview() {\n"
    "        // Without this the window only caught up on the next render, so the name lagged a beat\n"
    "        // behind the field somebody was typing into.\n"
    "        if (typeof updateAppWindowTitle === 'function') updateAppWindowTitle();",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
