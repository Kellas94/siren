"""
Ship 1.67.0 — version, changelog, and one wording fix.

Run AFTER Codex's round-5 chain and after tools/patch_dead_ui.py.

Codex could not do this: the round-5 brief forbade version, CHANGELOG and CSP edits, so twelve
fixes including the biggest export repair in the project's history would otherwise ship silently
under a version number that says nothing changed.

He also reported that "the historical unqualified CHANGELOG promise about editable PowerPoint
shapes remains an owner-owned wording defect". That was re-checked against this build and does not
hold: the only changelog entry making that claim (1.63.x) already names the exceptions - "Diagram
types the writer cannot shape (sequence, gantt and the rest) stay pictures, and the message names
them." The visible hint #diagramShapeExportHint is qualified too, and the export dialog names the
picture types on screen (measured at 632x28 px in the open dialog).

One unconditional claim WAS found, on a surface nobody had measured: the deck export button's
tooltip promises "an editable PowerPoint" with no condition, while the deck writer produces editable
shapes for flowcharts only ("EDITABLE SHAPES FIRST, flowcharts only") and lists what stayed a
picture only AFTER the export. That is fixed here.

Anchor-guarded, not SHA-pinned, so it survives being re-run on a rebuilt chain.

Usage: python ship_1_67_0.py <path-to-siren.html>
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


# ------------------------------------------------------------------ 1. the deck tooltip
# The deck writes editable shapes for flowcharts only. Said before the export, unconditionally,
# "an editable PowerPoint" is a promise the deck cannot keep for a deck of pie charts.
patch(
    "1. deck tooltip stops promising an editable PowerPoint unconditionally",
    'title="Export the deck: a PDF with real text and shapes, or an editable PowerPoint"',
    'title="Export the deck: a PDF with real text and shapes, or PowerPoint — '
    'flowchart slides become editable shapes, other diagram types travel as pictures"',
)

# ------------------------------------------------------------------ 2. the version
patch(
    "2. version 1.66.0 -> 1.67.0",
    "const APP_VERSION = '1.66.0';",
    "const APP_VERSION = '1.67.0';",
)

# ------------------------------------------------------------------ 3. the changelog entry
# Every claim below was measured on the shipped bytes, not taken from a summary. The PDF numbers
# come from qa_exports/run_export_fidelity.js; the picture-fallback sentence was measured on screen
# in the real export dialog by qa_exports/probe_disclosure.js.
NOTES = [
    "Every diagram exported to PDF now carries real text. A pie chart, a gantt, a sequence "
    "diagram, a mindmap and a flowchart all used to arrive as a photograph of themselves — "
    "nothing to search, nothing to select, nothing to copy. All five now carry embedded fonts and "
    "no picture at all. It is the difference between sending someone a document and sending them a "
    "screenshot of one.",

    "PowerPoint and Excel use native shapes where the diagram can be mapped safely, and one "
    "picture where it cannot. Flowcharts and mindmaps become shapes you can select, move and "
    "retype. Pie charts, gantt charts and sequence diagrams stay a picture — and the export "
    "dialog now says so, naming the type, before you download rather than after you have sent it.",

    "Guided no longer damages what it is editing. A chip on a kanban board used to corrupt the "
    "source, and Block and C4 diagrams were quoted back wrongly. The board keeps what you wrote.",

    "The app stopped claiming work it did not do. “Style applied to block” was said "
    "after changing nothing; the kanban status line instructed you to do something that would have "
    "broken your own diagram; the zoom control that offers to fit the whole diagram fitted only its "
    "width.",

    "A note attached to a block is no longer lost when the block is deleted, and restoring an "
    "older revision in Docs leaves the cursor somewhere you can see.",

    "The heading rail added in the last release sat over the text it was meant to help you "
    "navigate. It sits beside the document now.",

    "The window says which diagram you are in, so a second tab is no longer guesswork, and the "
    "tab carries the right mark.",

    "The chip naming the diagram type is visible for the first time. It has always been written "
    "on every render — “Full visual editing is available”, “This diagram is "
    "code-first” — and never shown to anyone. Clicking it now takes you straight to the "
    "type picker, which was the hardest thing in the app to find.",

    "Rank alignment, in the layout controls, says which renderer it applies to instead of "
    "accepting a value and quietly doing nothing with it.",
]

body = "\n".join("            '%s'%s" % (n.replace("'", "’"), "," if i < len(NOTES) - 1 else "")
                 for i, n in enumerate(NOTES))

patch(
    "3. changelog entry for 1.67.0",
    "        {\n          version: '1.66.0',",
    "        {\n          version: '1.67.0',\n          notes: [\n" + body + "\n          ]\n        },\n"
    "        {\n          version: '1.66.0',",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
