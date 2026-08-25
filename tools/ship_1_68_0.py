"""
Ship 1.68.0 — version and changelog.

Run LAST, after Codex's round 7 (AE, AF, AG, AH), the five preview-toolbar patches, the two
round-7 honesty patches and the theme-menu cap.

Codex is forbidden from touching APP_VERSION, CHANGELOG and the CSP by his brief, deliberately, so
that a version number can never claim work that has not been verified. This is where that claim gets
made, and every sentence below is something measured on the built bytes.

What is NOT claimed here, and why, because leaving it out is the point:

  - Not "the type always persists". Swimlane and Ishikawa are ordinary flowchart syntax; SIREN keeps
    those identities for the starters it creates, and one structural edit makes the source honestly a
    flowchart again. The note says what survives instead of overstating.
  - Not "your title is never overwritten". Two routes still lose it: naming a diagram exactly a
    family default, and pressing Undo after a type change, because title edits never enter the undo
    stack. Both need a real "a person touched this" flag, which is round 8.
  - Not "every diagram type is named correctly". detectMermaidDiagramType has no YAML frontmatter
    branch, so `---\\ntitle: X\\n---\\npie` still reads as Advanced Mermaid. Also round 8.
  - Nothing about the counter being right for every family. It is right for the ones named.

Anchor-guarded, not SHA-pinned, so it survives a rebuilt chain.

Usage: python ship_1_68_0.py <path-to-siren.html>
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


patch("1. version 1.67.0 -> 1.68.0",
      "const APP_VERSION = '1.67.0';",
      "const APP_VERSION = '1.68.0';")

NOTES = [
    "The preview toolbar went from twelve permanent controls to four: View, Inspect, Filters and "
    "Present. Zoom and the flow direction live under View; style, comments and review under "
    "Inspect. Nothing was removed — every control kept its place in the app, its keyboard route and "
    "its entry in the command palette, and each menu row simply presses the original button. At a "
    "narrow window the bar used to wrap onto three lines; it now fits on one.",

    "Guided counts what is actually in front of you. A sequence diagram says how many participants "
    "and messages, a gantt how many tasks and dependencies, a mindmap how many nodes and links, a "
    "kanban how many columns and cards. Eleven diagram types that used to report “0 blocks · 0 "
    "connections” — a sentence that was never true for any of them — now say nothing at all, "
    "because saying nothing is better than saying something wrong.",

    "Choosing a diagram type keeps it. Starting a block, architecture, C4, XY, requirement, "
    "mindmap, timeline, kanban or Ishikawa diagram used to leave the picker reading “Advanced "
    "Mermaid” with the New starter button greyed out, so the second one was harder to make than the "
    "first. Swimlane and Ishikawa are written as ordinary flowcharts, so SIREN keeps those two "
    "identities for the starters it creates; edit the structure and the diagram is honestly a "
    "flowchart again.",

    "A diagram that names itself gets its own name. An untouched title followed the family — Pie "
    "chart Preview, Timeline Preview, ER diagram Preview — instead of calling everything a "
    "flowchart. A title you typed yourself is kept when the type changes.",

    "The hint over a code-first diagram tells the truth about that diagram. It offered “branch "
    "colours” on every type while only Git graph has them, and once shown it never revised itself, "
    "so switching diagrams left the wrong sentence on screen. Eight right-click menus that "
    "introduced themselves as “Advanced Mermaid” now give the real name: XY chart, Pie chart, C4 "
    "context, Timeline, Mindmap, Architecture, Block diagram and Kanban.",

    "The theme menu stops hiding half of itself. With thirty-seven themes it opened 800px tall and "
    "left 263px permanently below the edge of the screen at every desktop size — themes you could "
    "not reach and had no way to know were there. It now shows eight and offers the remaining "
    "twenty-nine on the list itself. Every theme is still there, and the menu opens on the one you "
    "are using.",

    "Two controls that do nothing for the diagram you are looking at now say why. The vertical and "
    "horizontal flow buttons are unavailable on diagram types that set their own direction, and "
    "they explain that instead of going quietly grey.",
]

body = "\n".join("            '%s'%s" % (n.replace("'", "’"), "," if i < len(NOTES) - 1 else "")
                 for i, n in enumerate(NOTES))

patch("2. changelog entry for 1.68.0",
      "        {\n          version: '1.67.0',",
      "        {\n          version: '1.68.0',\n          notes: [\n" + body + "\n          ]\n        },\n"
      "        {\n          version: '1.67.0',")

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
