"""
The two grouped buttons join the app's own responsive rule instead of opting out of it.

The preview toolbar shrinks its buttons to bare glyphs when the pane gets narrow, through a
container query:

    @container preview-pane (max-width: 745px) { .zoom-tools .text-label { display: none; } }

It is a CONTAINER query, not a media query - it reads the width of the preview pane, not the window.
At a 960px viewport the pane is about 316px, so Filters and Hide panel are already down to icons
there.

patch_preview_toolbar.py wrapped its labels in `.btn-label`, a class invented for the occasion and
used nowhere else in the file. The two grouped buttons therefore never collapsed, kept their full
width in a 316px pane, and pushed Hide panel onto a second line.

The consequence is worth recording, because it nearly cost a feature: the two-line toolbar was read
as evidence that Hide panel should stop being a button and become a gesture on the divider. The
owner rejected that - "clar hide panel nu ar trebui ascuns sub un alt meniu" - which sent the
question back to the real cause. A control was almost removed to work around a misspelled class.

Anchor-guarded, not SHA-pinned. Apply AFTER patch_preview_toolbar.py.

Usage: python patch_toolbar_label_class.py <path-to-siren.html>
"""
import io, os, sys, hashlib

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
print("input  SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())

before = s.count('class="btn-label"')
assert before == 2, "expected the 2 invented labels, found %d" % before

s = s.replace('<span class="btn-label">View</span>', '<span class="text-label">View</span>')
s = s.replace('<span class="btn-label">Inspect</span>', '<span class="text-label">Inspect</span>')
print("  applied: View and Inspect now use .text-label, the class the container query targets")

assert s.count('class="btn-label"') == 0, "an invented label survived"
assert s.count('<span class="text-label">View</span>') == 1
assert s.count('<span class="text-label">Inspect</span>') == 1

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
