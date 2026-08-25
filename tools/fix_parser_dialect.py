r"""The structured editors understand real Mermaid.

Two lines of ordinary Mermaid switched off the two editors built for people who do
not write code:

  A --> B --> C        the visual builder reported "Blocks: Unavailable"
  B -- Yes --> C       the guided editor rendered it as an inert grey slab

Both were already solved in this file and the answer was being thrown away.

parseVisualFlowchartSource calls parseStructureChain, gets back the fully decomposed
chain - nodes and steps - checks that there is more than one step, and then discards
it and puts the whole diagram into code-only mode. It only needs to walk what it is
already holding. Arrow forms outside the four the serializer can write still fall
through to the existing refusal, so nothing can round-trip into a shape the writer
cannot express.

parseStructureRows has the same shape of miss: normaliseInlineEdgeLabel exists for
exactly the mid-text label form, its own comment says so, and it has three call sites
- none of them this one. A retry costs one line, and because writeStructureLine only
rewrites the row the user actually touched, everything untouched keeps the author's
own spelling.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8').read()
orig = s


def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)


# ---- 1. the visual builder reads chains --------------------------------------
rep("""          const visualChain = parseStructureChain(normaliseInlineEdgeLabel(line).trim());
          if (visualChain && visualChain.steps.length > 1) {
            return incompatible(statement, 'Connector chains such as A --> B --> C are edited in code or Guided mode');
          }""",
    """          const visualChain = parseStructureChain(normaliseInlineEdgeLabel(line).trim());
          if (visualChain && visualChain.steps.length > 1) {
            // The chain arrives here already decomposed into nodes and steps. Refusing it
            // threw that work away and put the whole diagram into code-only mode over the
            // commonest idiom in Mermaid - the one every generator writes. Walking it is
            // the same two loops the single-edge branch below does, once per step.
            // Arrow forms the serializer cannot write still fall through to the refusal,
            // so nothing round-trips into a shape this file has no way to write back.
            const writableArrows = ['-->', '---', '-.->', '==>'];
            if (!visualChain.steps.every(step => writableArrows.includes(step.arrow))) {
              return incompatible(statement, 'This connector syntax is edited in code or Guided mode');
            }
            visualChain.nodes.forEach(node => upsertNode(node.id, node.token));
            visualChain.steps.forEach((step, position) => {
              edges.push({
                from: visualChain.nodes[position].id,
                to: visualChain.nodes[position + 1].id,
                type: step.arrow,
                label: step.label || ''
              });
            });
            continue;
          }""")

# ---- 2. the guided editor reads mid-text labels ------------------------------
rep("""          if (/^end$/i.test(trimmed)) return { ...row, kind: 'groupEnd' };
          const chain = parseStructureChain(trimmed);""",
    """          if (/^end$/i.test(trimmed)) return { ...row, kind: 'groupEnd' };
          // "B -- Yes --> C" is Mermaid's documented mid-text label form and it arrives
          // from every generator there is. Read raw first so an untouched line keeps the
          // author's spelling, then retry through the helper written for exactly this.
          const chain = parseStructureChain(trimmed) || parseStructureChain(normaliseInlineEdgeLabel(trimmed).trim());""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_parserdialect.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('parser dialect widened: %d -> %d chars' % (len(orig), len(s)))
