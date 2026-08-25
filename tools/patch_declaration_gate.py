"""
A block cannot be inserted above the line that says what the diagram is.

The gate added in 1.69.0 stopped a Guided row inside YAML front matter from offering "Insert block
below", because a block written there is sealed inside the YAML and never drawn. It was written as
`index <= frontmatterEnd`, which stops AT the closing delimiter - and that was too narrow.

Round 9 taught the app to see front matter after a leading blank line, which is correct and which
re-enabled the body rows that had been wrongly disabled. The blank line BETWEEN the closing delimiter
and the declaration came back with them, and it was never covered by the gate. Measured end to end
with real right-clicks:

    base 1.69.0   Insert block below [off]
                  reason: "Blocks are flowchart syntax; this diagram type is edited as code."
    round 9       Insert block below LIVE
                  result: "---\\ntitle: Q3 approvals\\n---\\n\\n  N1[\\"New block\\"]\\nflowchart TD\\n..."
                  node at line 5, declaration at line 6
                  the app then says: "The first line must name the diagram type"

So the row was protected on the old build BY ACCIDENT - the app could not see the front matter, called
the whole document code-first, and disabled every row for the wrong reason. The gate was not undone;
its accidental cover was, and the corruption is unreachable on the old build and reachable on the new
one. That distinction is worth keeping straight: this is my incomplete gate, exposed by somebody
else's correct fix.

The repair generalises it to what is actually true. A block cannot go above the line that names the
diagram - not in front matter, not in the gap beneath it, not above a leading comment. So the gate
becomes "at or before the declaration" rather than "inside the front matter", and the reason it gives
says which case a person has hit rather than always naming front matter.

Anchor-guarded, not SHA-pinned. Apply AFTER Codex's AQ.

Usage: python patch_declaration_gate.py <path-to-siren.html>
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
    "1. the gate covers everything above the declaration, not only the front matter",
    "        const frontmatterEnd = mermaidFrontmatterEnd(el.source.value);\n"
    "        const inFrontmatter = frontmatterEnd >= 0 && index <= frontmatterEnd;\n"
    "        const notHere = 'This line is the front matter, not part of the drawing.';\n"
    "        const blockWhy = !flow ? 'Blocks are flowchart syntax; this diagram type is edited as code.'\n"
    "          : inFrontmatter ? notHere : '';\n"
    "        const linkWhy = !flow ? 'Connections are flowchart syntax; this diagram type is edited as code.'\n"
    "          : inFrontmatter ? notHere : '';",

    "        const frontmatterEnd = mermaidFrontmatterEnd(el.source.value);\n"
    "        const inFrontmatter = frontmatterEnd >= 0 && index <= frontmatterEnd;\n"
    "        // Front matter was too narrow a rule. Nothing can go above the line that names the\n"
    "        // diagram - not the YAML, not the blank line beneath it, not a comment above it - and\n"
    "        // a block written there produced a source whose first line no longer declares a type,\n"
    "        // with the app itself then refusing to draw it.\n"
    "        const declarationIndex = (() => {\n"
    "          const scanned = mermaidSourceLinesForScan(el.source.value);\n"
    "          return scanned.findIndex(line => line.trim() && !/^\\s*%%/.test(line));\n"
    "        })();\n"
    "        const aboveDeclaration = declarationIndex >= 0 && index < declarationIndex;\n"
    "        const notHere = inFrontmatter\n"
    "          ? 'This line is the front matter, not part of the drawing.'\n"
    "          : 'A block has to come after the line that names the diagram type.';\n"
    "        const blockWhy = !flow ? 'Blocks are flowchart syntax; this diagram type is edited as code.'\n"
    "          : (inFrontmatter || aboveDeclaration) ? notHere : '';\n"
    "        const linkWhy = !flow ? 'Connections are flowchart syntax; this diagram type is edited as code.'\n"
    "          : (inFrontmatter || aboveDeclaration) ? notHere : '';",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
