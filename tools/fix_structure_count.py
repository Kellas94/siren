r"""The guided editor counts what is on screen.

It counted only standalone declaration rows, so a diagram whose blocks are declared
inline - the way almost everyone writes Mermaid - reported "0 blocks". Measured on a
four-block flowchart: "0 blocks / 3 connections", and on a 34-node walkthrough
"1 blocks / 27 connections".

A false number in an audit tool is worse than no number, and this one was also
ungrammatical when it was right about a single block. Count the distinct endpoints
the rows actually name, and say "block" when there is one of them.
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


rep("""        const chainSteps = rows.reduce((total, row) => total + (row.kind === 'chain' ? row.steps.length : 0), 0);
        el.structureCount.textContent = rows.filter(row => row.kind === 'block').length + ' blocks · '
          + (rows.filter(row => row.kind === 'link').length + chainSteps) + ' connections';""",
    """        const chainSteps = rows.reduce((total, row) => total + (row.kind === 'chain' ? row.steps.length : 0), 0);
        // Counting only standalone declarations reported "0 blocks" for a diagram whose
        // blocks are declared inside its connectors - which is how nearly everyone writes
        // Mermaid. Count the distinct endpoints the rows actually name.
        const namedBlocks = new Set();
        rows.forEach(row => {
          if (row.kind === 'block') namedBlocks.add(row.id);
          else if (row.kind === 'link') { namedBlocks.add(row.fromId); namedBlocks.add(row.toId); }
          else if (row.kind === 'chain') row.nodes.forEach(node => namedBlocks.add(node.id));
        });
        namedBlocks.delete(undefined);
        namedBlocks.delete('');
        const linkCount = rows.filter(row => row.kind === 'link').length + chainSteps;
        el.structureCount.textContent = namedBlocks.size + (namedBlocks.size === 1 ? ' block · ' : ' blocks · ')
          + linkCount + (linkCount === 1 ? ' connection' : ' connections');""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_structcount.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('structure count fixed: %d -> %d chars' % (len(orig), len(s)))
