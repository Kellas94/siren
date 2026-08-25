r"""1.61.1 - the arrow walk prefers what lies ahead on screen.

Measured on the 40-block benchmark: from "Return to requester" (whose only successor is the
back-edge to "Purchase request"), ArrowDown moved focus UP the page, and the walk looped
A1 -> A2 -> A4 -> A1. Successors that sit ahead of the block in the flow direction now come
first; a back-edge is taken only when nothing lies ahead. Same for the walk back.
"""
import io, os, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:100])
    s = s.replace(anchor, new)

rep("""        if (flowKeys.includes(key)) {
          const forward = (key === flowKeys[1]) !== reversed;
          const ids = forward
            ? model.edges.filter(e => e.from === id && e.to !== id).map(e => e.to)
            : model.edges.filter(e => e.to === id && e.from !== id).map(e => e.from);
          candidates = Array.from(new Set(ids)).filter(n => frameOf(n)).sort(byCross);
        } else {""",
    """        if (flowKeys.includes(key)) {
          const forward = (key === flowKeys[1]) !== reversed;
          const ids = forward
            ? model.edges.filter(e => e.from === id && e.to !== id).map(e => e.to)
            : model.edges.filter(e => e.to === id && e.from !== id).map(e => e.from);
          // The key moves the eye the way it points. Linked blocks ahead on the page come
          // first; when none is linked ahead (a loop back, the end of a branch), the nearest
          // block ahead on the page; at the very end, nowhere - never a jump back up.
          const ahead = n => ((frameOf(n)[along] - here[along]) * (reversed ? -1 : 1) * (forward ? 1 : -1)) > 0;
          const linked = Array.from(new Set(ids)).filter(n => frameOf(n) && ahead(n)).sort(byCross);
          if (linked.length) candidates = linked;
          else {
            const byAlong = (a, b) => (Math.abs(frameOf(a)[along] - here[along]) - Math.abs(frameOf(b)[along] - here[along])) || byCross(a, b);
            candidates = model.nodes.map(n => n.id).filter(n => n !== id && frameOf(n) && ahead(n)).sort(byAlong);
          }
        } else {""")

rep("const APP_VERSION = '1.61.0';", "const APP_VERSION = '1.61.1';")
rep("""          version: '1.61.0',
          notes: [
            'Canvas, phase 3""",
    """          version: '1.61.1',
          notes: [
            'The arrow walk moves the eye the way the key points: linked blocks ahead first, then the nearest block ahead on the page \\u2014 from a block whose only way on is a loop back, \\u2193 no longer jumps up the page.'
          ]
        },
        {
          version: '1.61.0',
          notes: [
            'Canvas, phase 3""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('arrow-ahead fix applied: %d -> %d chars' % (len(orig), len(s)))
