r"""Right-clicking beside a block offered to add a step to it; right-clicking the block did not.

"Add a step after Resolve duplicate months" sat on the EMPTY CANVAS menu, because that is
where the canvas rows were assembled - so the offer appeared next to the block instead of on
it, and the block's own menu (Rename, Connect from here, Delete) said nothing about adding.
The owner expects the opposite, and the owner is right: a verb about a block belongs on that
block.

Now the block's menu carries "Add a step after <name>" and "Insert a step before <name>",
acting on the block you actually right-clicked (it selects it first, exactly as a click
would, so the ring follows). The empty canvas keeps "New block..." and the view actions.
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

# ---------------------------------------------------------------- the empty canvas keeps only "New block..."
rep("""        const rows = [[() => canvasOpenFreePopover(), 'New block\\u2026', blank || model ? '' : CANVAS_CODE_ONLY]];
        if (model && canvasSelectedId && model.nodes.some(n => n.id === canvasSelectedId) && !canvasIsNote(model, canvasSelectedId)) {
          rows.push([() => canvasOpenPopoverAtSelection('fwd'), `Add a step after ${canvasLabelOf(model, canvasSelectedId)}`]);
        }
        return rows;""",
    """        // Only what the empty canvas can mean. "Add a step after X" used to live here,
        // which put a verb about a block next to the block instead of on it; it is on the
        // block's own menu now (canvasBlockStepRows).
        return [[() => canvasOpenFreePopover(), 'New block\\u2026', blank || model ? '' : CANVAS_CODE_ONLY]];""")

# ---------------------------------------------------------------- the block's own rows
rep("""      function canvasContextRows() {""",
    """      // The two adding verbs, for the block that was actually right-clicked: selecting it
      // first is what a click would have done, so the ring lands where the menu came from.
      function canvasBlockStepRows(id) {
        if (!canvasBuilderAvailable()) return [];
        const model = canvasModel();
        if (!model || !model.nodes.some(node => node.id === id)) return [];
        if (canvasIsNote(model, id)) return [];
        const name = canvasLabelOf(model, id);
        const open = role => () => {
          canvasSelectedId = id;
          canvasHoveredId = '';
          canvasOverlayRepaint();
          canvasOpenPopoverAtSelection(role);
        };
        return [
          [open('fwd'), `Add a step after ${name}`],
          [open('back'), `Insert a step before ${name}`]
        ];
      }

      function canvasContextRows() {""")

# ---------------------------------------------------------------- put them on the block menu
rep("""          rows.push([() => { setConnectMode(true); handleConnectModeClick(id); }, 'Connect from here', codeOnly]);""",
    """          canvasBlockStepRows(id).forEach(row => rows.push(row));
          rows.push([() => { setConnectMode(true); handleConnectModeClick(id); }, 'Connect from here', codeOnly]);""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('block step rows moved: %d -> %d chars' % (len(orig), len(s)))
