r"""Two text defects the PPTX verifier escalated to the main engineer.

A. Multi-word captions came out as one word (pre-existing, shared collector).
   Mermaid writes one <tspan class="text-outer-tspan row"> per visual LINE and one
   <tspan class="text-inner-tspan"> per WORD inside it. svgTextLines returned every leaf
   tspan as its own line, so "Accounts payable" became ["Accounts", " payable"] - the
   subgraph caption (which takes the first line) read "Accounts", and an edge label
   "Not approved yet" was stacked three words high. Leaves are now joined per row, so a
   line is a line and a genuinely two-line label still returns two. This is the shared
   collector, so the single-diagram PPTX and the Excel drawing gain the same fix.

B. A tall diagram's overview slide became an unreadable jumble: the type floor was 6pt
   while a 40-block diagram scales to ~1.7pt, so every label wrapped character by
   character and spilled over its neighbours - worse than the picture it replaced.
   PowerPoint accepts 1pt, and the shapes stay editable, so the floor is 1pt and the type
   scales with the drawing exactly as the raster did.

Applies AFTER the round-4 patches (integration order: last).
"""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else None
if not APP:
    print(__doc__); sys.exit(2)
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------------------------------------------------------- A. one line per row
rep("""        // Leaves only: Mermaid nests a wrapper tspan around each line, and counting
        // both would write every label out twice.
        const tspans = Array.from(element.querySelectorAll('tspan')).filter(node => !node.querySelector('tspan'));
        if (tspans.length) {
          const lines = tspans.map(node => String(node.textContent || '').trim()).filter(Boolean);
          if (lines.length) return lines;
        }""",
    """        // Leaves only: Mermaid nests a wrapper tspan around each line, and counting
        // both would write every label out twice. But the leaves are WORDS - Mermaid puts
        // one <tspan class="text-inner-tspan"> per word inside a "text-outer-tspan row"
        // per line - so the words of a row are joined back into their line. Otherwise a
        // subgraph called "Accounts payable" exports as "Accounts".
        const tspans = Array.from(element.querySelectorAll('tspan')).filter(node => !node.querySelector('tspan'));
        if (tspans.length) {
          const rows = [];
          const byRow = new Map();
          tspans.forEach(node => {
            const row = node.parentElement && node.parentElement.tagName.toLowerCase() === 'tspan' ? node.parentElement : node;
            if (!byRow.has(row)) { byRow.set(row, []); rows.push(row); }
            byRow.get(row).push(String(node.textContent || ''));
          });
          const lines = rows.map(row => byRow.get(row).join('').replace(/\\s+/g, ' ').trim()).filter(Boolean);
          if (lines.length) return lines;
        }""")

# ---------------------------------------------------------------- B. type follows the drawing
rep("""      function deckShapeTextBody(shape, wrap) {
        const size = Math.round(clamp(Number(shape.fontSize) || 10, 6, 40) * 100);""",
    """      function deckShapeTextBody(shape, wrap) {
        // 1pt floor, not 6: on a forty-block diagram the drawing scales to under 2pt, and
        // a 6pt label in a 2pt box wraps letter by letter over its neighbours - worse than
        // the picture this replaces. PowerPoint accepts 1pt, and the shape is still
        // editable: whoever needs to read it enlarges the block.
        const size = Math.round(clamp(Number(shape.fontSize) || 10, 1, 40) * 100);""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('pptx text fixes applied: %d -> %d chars' % (len(orig), len(s)))
