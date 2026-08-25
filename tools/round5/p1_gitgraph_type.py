"""SIREN patch 1/3 - name the git graph.

A gitGraph fell into the 'advanced' catch-all, so the type chip, the starter list
and every message about the diagram called it "Advanced Mermaid". Detecting it by
name lets the rest of the app say what this diagram actually is.
"""
import io, os, sys

APP = sys.argv[1]
s = io.open(APP, encoding='utf-8', newline='').read(); orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, (c, anchor[:90])
    s = s.replace(anchor, new)

rep(r"""        if (/^gantt\b/i.test(cleaned)) return 'gantt';
        return cleaned ? 'advanced' : 'flowchart';""",
    r"""        if (/^gantt\b/i.test(cleaned)) return 'gantt';
        // A git graph is a type of its own, not the catch-all: naming it here is what
        // lets the type chip, the starter list and the drawing's own menu say so.
        if (/^gitGraph\b/i.test(cleaned)) return 'gitgraph';
        return cleaned ? 'advanced' : 'flowchart';""")

# The renderer chip's tooltip is the only place the diagram type is still readable,
# and it was built from the label the chip was showing BEFORE this call updated it -
# so it always named the previous diagram's type. Read the type we just detected.
rep("""          el.renderStateChip.title = `Renderer: ${el.rendererChipText.textContent} · Type: ${el.diagramTypeText.textContent}`;""",
    """          el.renderStateChip.title = `Renderer: ${el.rendererChipText.textContent} · Type: ${diagramTypeLabel(type)}`;""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('applied', len(orig), '->', len(s))
