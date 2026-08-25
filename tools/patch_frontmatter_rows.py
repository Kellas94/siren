"""
A Guided row inside the YAML front matter stops offering to put a block there.

Round 8's AM taught the declaration scanner to see past leading front matter, which was the point -
a diagram written with `---\\ntitle: ...\\n---` is a real pie chart, not "Advanced Mermaid". But
`structureIsFlowchart()` is a property of the WHOLE document, and the row menu gates its block
operations on it alone. So on a flowchart with front matter the rows went live on every line,
including the front-matter lines, where the base had them correctly disabled.

Measured, base against the round 8 build, same script, same click:

    base    Insert block below [off]
    merged  Insert block below        <- live

and taking the offer writes a Mermaid node inside the YAML:

    ---
    title: Q3 approvals
      N1["New block"]
    ---
    flowchart TD

The counter then reads "4 blocks" for a drawing that contains three, because the fourth is sealed
inside front matter and will never render. The source no longer means what it says, nothing warns,
and the lint stays green. That is a silent corruption of what somebody wrote, which on this project
outranks every disclosed residual in the round.

The span was already known and thrown away: mermaidSourceLinesForScan blanks lines 0..end. This
exposes it as mermaidFrontmatterEnd and has the scanner consume it, so the two can never disagree
about where front matter stops - one function decides, the other uses the answer.

Deliberately NOT widened here: the scanner still requires the very first line to be `---`, so a
leading blank or whitespace-only line makes front matter invisible to it. That is a real residual,
it has six consumers, and changing what counts as front matter is a behaviour change that deserves
its own measurement rather than riding along with a corruption fix.

Anchor-guarded, not SHA-pinned. Apply AFTER Codex's AM.

Usage: python patch_frontmatter_rows.py <path-to-siren.html>
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
    "1. the front-matter span becomes something the app can ask about",
    "      function mermaidSourceLinesForScan(source) {\n"
    "        const lines = String(source == null ? '' : source).split(/\\r?\\n/);\n"
    "        if (!lines.length || lines[0].replace(/^\\uFEFF/, '').trim() !== '---') return lines;\n"
    "        const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\\.\\.\\.)$/.test(line.trim()));\n"
    "        if (end < 0) return lines;\n"
    "        for (let index = 0; index <= end; index += 1) lines[index] = '';\n"
    "        return lines;\n"
    "      }",

    "      /* Where the leading YAML front matter ends, as a line index, or -1 for none. The scanner\n"
    "         below already worked this out and threw it away; the row menu needs the same answer, and\n"
    "         two copies of this logic would eventually disagree about where a document starts. */\n"
    "      function mermaidFrontmatterEnd(source) {\n"
    "        const lines = String(source == null ? '' : source).split(/\\r?\\n/);\n"
    "        if (!lines.length || lines[0].replace(/^\\uFEFF/, '').trim() !== '---') return -1;\n"
    "        return lines.findIndex((line, index) => index > 0 && /^(?:---|\\.\\.\\.)$/.test(line.trim()));\n"
    "      }\n"
    "\n"
    "      function mermaidSourceLinesForScan(source) {\n"
    "        const lines = String(source == null ? '' : source).split(/\\r?\\n/);\n"
    "        const end = mermaidFrontmatterEnd(source);\n"
    "        if (end < 0) return lines;\n"
    "        for (let index = 0; index <= end; index += 1) lines[index] = '';\n"
    "        return lines;\n"
    "      }",
)

patch(
    "2. a front-matter line is not a place to put a block",
    "        const flow = structureIsFlowchart();\n"
    "        const rows = [[null, 'Line ' + (index + 1), 'heading']];\n"
    "        rows.push([() => structureAddBlock(index), 'Insert block below', flow ? '' : 'Blocks are flowchart syntax; this diagram type is edited as code.']);\n"
    "        rows.push([() => structureAddLink(index), 'Connect from here', flow ? '' : 'Connections are flowchart syntax; this diagram type is edited as code.']);",

    "        const flow = structureIsFlowchart();\n"
    "        // structureIsFlowchart() is a property of the whole document, so on a flowchart with\n"
    "        // front matter it turned these rows on for the front-matter lines too - and a block\n"
    "        // written there is sealed inside the YAML, counted, and never drawn.\n"
    "        const frontmatterEnd = mermaidFrontmatterEnd(el.source.value);\n"
    "        const inFrontmatter = frontmatterEnd >= 0 && index <= frontmatterEnd;\n"
    "        const notHere = 'This line is the front matter, not part of the drawing.';\n"
    "        const blockWhy = !flow ? 'Blocks are flowchart syntax; this diagram type is edited as code.'\n"
    "          : inFrontmatter ? notHere : '';\n"
    "        const linkWhy = !flow ? 'Connections are flowchart syntax; this diagram type is edited as code.'\n"
    "          : inFrontmatter ? notHere : '';\n"
    "        const rows = [[null, 'Line ' + (index + 1), 'heading']];\n"
    "        rows.push([() => structureAddBlock(index), 'Insert block below', blockWhy]);\n"
    "        rows.push([() => structureAddLink(index), 'Connect from here', linkWhy]);",
)

tmp = path + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(s)
os.replace(tmp, path)
print("output SHA-256 %s" % hashlib.sha256(s.encode("utf-8")).hexdigest().upper())
print("output bytes   %d" % len(s.encode("utf-8")))
