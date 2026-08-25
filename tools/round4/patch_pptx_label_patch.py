r"""A connector's caption wore a square of the wrong colour inside a subgraph.

An arrow caption ("Yes", "No", "Quantity") is drawn on a small patch so the line passes
behind the word instead of through it - the same thing Mermaid does on screen. The patch was
always the slide's background colour, so anywhere the caption sat on something else - inside
a subgraph, whose fill is a different colour - it showed as a darker or lighter rectangle
around the word.

The patch now takes the colour of whatever is actually behind it: the smallest filled shape
whose box contains the caption's centre, and the slide background only when there is none.
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

rep("""        let nextId = Math.max(2, Math.round(Number(firstId) || 2));
        let count = 0;""",
    """        let nextId = Math.max(2, Math.round(Number(firstId) || 2));
        let count = 0;
        // What lies behind a caption: the smallest filled shape it sits inside - a subgraph,
        // usually - else the slide itself. A patch in the slide's colour over a subgraph's
        // fill reads as a square drawn around the word.
        const filledBoxes = list
          .filter(item => item.kind === 'box' && item.fill && item.w > 0 && item.h > 0)
          .map(item => ({ fill: item.fill, x: item.x, y: item.y, w: item.w, h: item.h }))
          .sort((a, b) => (a.w * a.h) - (b.w * b.h));
        const fillBehind = shape => {
          const px = shape.x + shape.w / 2;
          const py = shape.y + shape.h / 2;
          const box = filledBoxes.find(item => px >= item.x && px <= item.x + item.w && py >= item.y && py <= item.y + item.h);
          return box ? box.fill : labelFill;
        };""")

rep("""              + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${labelFill ? `<a:solidFill><a:srgbClr val="${labelFill}"/></a:solidFill>` : '<a:noFill/>'}<a:ln><a:noFill/></a:ln></p:spPr>`""",
    """              + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${(() => { const patch = fillBehind(shape); return patch ? `<a:solidFill><a:srgbClr val="${patch}"/></a:solidFill>` : '<a:noFill/>'; })()}<a:ln><a:noFill/></a:ln></p:spPr>`""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('pptx label patch applied: %d -> %d chars' % (len(orig), len(s)))
