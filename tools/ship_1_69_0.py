"""
Ship 1.69.0 — version and changelog.

Run LAST, after Codex's round 8 (AI, AJ, AK, AL, AM), tools/patch_zoom_back.py and
tools/patch_frontmatter_rows.py.

An independent verification pass drove all five round-8 jobs against the base, the patched build and
the merged ship build with real keyboard and mouse input. Three things it found are the reason this
file exists rather than a copy of the handback:

  - A row inside YAML front matter had started offering "Insert block below", which wrote a Mermaid
    node inside the YAML and counted it. Fixed here before shipping; not mentioned below, because a
    defect introduced and removed inside one release is not news to anyone outside it.
  - Three changelog sentences would have been broken promises. They are corrected in the notes:
    overflow did NOT gain a scrollbar (the old build already drew one and scrolled) - what is new is
    that the menu now ANNOUNCES it; the submenu fix covers the right-click on blank page space and
    NOT on a paragraph; and slash typing is fixed for a word typed straight after the slash, not for
    slash-then-space or slash-then-Enter.
  - Those three residuals are named out loud below rather than omitted. A person who reads "typing
    after a slash is fixed" and then loses a line to "/ " has been lied to by a release note.

Also NOT claimed: nothing about Sankey, Radar, Quadrant or C4Container, which Mermaid renders and
SIREN still calls Advanced Mermaid; and nothing about front matter that does not begin on the very
first line, which is still invisible to the scanner.

Anchor-guarded, not SHA-pinned.

Usage: python ship_1_69_0.py <path-to-siren.html>
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


patch("1. version 1.68.0 -> 1.69.0",
      "const APP_VERSION = '1.68.0';",
      "const APP_VERSION = '1.69.0';")

NOTES = [
    "Typing a word straight after a slash in a document no longer destroys it. “/2026 field work” "
    "used to leave you with a heading reading “field work” — the slash, the year and the space gone "
    "from the screen, gone from the saved file and still gone after a reload. A file path, "
    "“/mnt/data/evidence.pdf”, lost everything except the slash. Both are kept in full now. "
    "Two ways in are still not fixed and are worth knowing: a slash followed by a space, and a "
    "slash followed by Enter, both still turn what you type into a heading. Those are next.",

    "A diagram name you typed survives Undo. Naming a diagram and then changing its type meant one "
    "press of Undo replaced your name with a generated one, because a title edit never became an "
    "undo step of its own. The name is now owned by you — even if you deliberately name a diagram "
    "the same thing the app would have called it. One narrow case remains: replace the whole source "
    "at once within about half a second of typing the name, and Undo still takes the name with it.",

    "“Delete block” is drawn again on a short window. On a 620-pixel-tall screen the last entry of a "
    "document block’s menu was not painted at all and the entry above it was sliced through the "
    "middle — the action read as though it did not exist. The menu now fits, and where a menu "
    "genuinely cannot fit it says so instead of scrolling in silence.",

    "Right-clicking the page of a document opens its second menu next to the pointer. Choosing "
    "“Document type” used to put the list of types at the far left of the page, hundreds of pixels "
    "from the click, where it read as an unrelated panel. This covers a right-click on the page "
    "itself; right-clicking a paragraph still opens the second menu away from the cursor.",

    "A diagram that opens with a title block is recognised for what it is. Mermaid lets a diagram "
    "carry its own front matter, and SIREN called every one of them “Advanced Mermaid” — in the type "
    "chip, in the name it generated, and in the heading of its right-click menu — while drawing the "
    "pie chart or the timeline correctly. A Git graph written that way also lost its branch colours. "
    "The front matter has to start on the very first line to be seen; a blank line above it still "
    "hides it.",

    "Zoom is back on the toolbar. It was folded into a menu in the last release, which cost two "
    "things: a control people use constantly took an extra press, and the zoom level stopped being "
    "readable at all, because the chip that shows it was the thing that got hidden. The button "
    "beside it is now called Flow, which is what it holds. And the zoom panel closes on Escape — the "
    "key was wired to it but could never reach it.",
]

body = "\n".join("            '%s'%s" % (n.replace("'", "’"), "," if i < len(NOTES) - 1 else "")
                 for i, n in enumerate(NOTES))

patch("2. changelog entry for 1.69.0",
      "        {\n          version: '1.68.0',",
      "        {\n          version: '1.69.0',\n          notes: [\n" + body + "\n          ]\n        },\n"
      "        {\n          version: '1.68.0',")

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
