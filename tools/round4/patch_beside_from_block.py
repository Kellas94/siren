r"""The side handle now connects the new step to the block you pressed it on.

It used to make a SIBLING: the new step was fed by whatever fed the block, so pressing the
side handle on "Resolve duplicate months" attached the step to "Period results" above it.
That is the only shape a top-down layout can truly place BESIDE a block - but it is not what
the gesture says, and it is not what the owner asked for. He asked for a block to the left or
right that is connected to the block he pressed.

So: the side handle writes `B --> N`, from the block under the handle. Left and right are
honoured as far as a computed layout can honour them - the new connector is written before or
after B's other connectors, which is what decides left and right among children - and the
check that already runs after the render tells the truth when the layout put it elsewhere.
When B has no other children the layout puts the step under B, and the message says exactly
that instead of pretending.
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

# ---------------------------------------------------------------- the gesture
rep("""        const id = nextVisualNodeId(model.nodes);
        const finalShape = canvasShapeFor(label, shape);
        const feederIds = canvasBesideFeeders(model, anchorId);
        const feeders = model.edges.filter(e => e.to === anchorId && feederIds.includes(e.from) && e.type !== '-.-');
        const single = feederIds.length === 1 ? model.nodes.find(n => n.id === feederIds[0]) : null;
        const edgeLabel = single && single.shape === 'diamond'
          ? (branchLabel == null ? canvasAutoBranchLabel(model, single.id) : cleanVisualText(branchLabel)) : '';
        const op = { type: 'canvasStep', mode: 'beside', anchorId, id, label, shape: finalShape, edgeLabel, dir, feeders: feederIds };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        feederIds.forEach((fid, i) => {
          const first = feeders.find(e => e.from === fid);
          model.edges.push({ from: fid, to: id, type: first.type, label: i === 0 ? edgeLabel : '' });
        });""",
    """        const id = nextVisualNodeId(model.nodes);
        const finalShape = canvasShapeFor(label, shape);
        // From the block under the handle, not from what feeds it: the owner presses the
        // side of B to put a step beside B, connected to B.
        const edgeLabel = branchLabel == null ? canvasAutoBranchLabel(model, anchorId) : cleanVisualText(branchLabel);
        const op = { type: 'canvasStep', mode: 'after', anchorId, id, label, shape: finalShape, edgeLabel, bias: dir };
        const groupId = canvasPredictGroup(op);
        model.nodes.push({ id, label, shape: finalShape, order: model.nodes.length });
        model.edges.push({ from: anchorId, to: id, type: '-->', label: edgeLabel });""")

# ---------------------------------------------------------------- the message
rep("""        const horizontal = /^(LR|RL)$/i.test(String(model.direction || 'TD'));
        const anchorName = canvasLabelOf(model, anchorId);
        canvasSideCheck = { id, anchorId, cross: horizontal ? 'cy' : 'cx', want: dir < 0 ? -1 : 1, names: [label, anchorName] };
        if (!canvasApply(model, `${label} added beside ${anchorName}`, id, op)) canvasSideCheck = null;""",
    """        const horizontal = /^(LR|RL)$/i.test(String(model.direction || 'TD'));
        const anchorName = canvasLabelOf(model, anchorId);
        // A side is only a side against the block's OTHER steps: they share the row, and
        // their order is what left and right mean here. With none, the new step simply
        // lands under the block.
        const siblings = model.edges.filter(edge => edge.from === anchorId && edge.to !== id).map(edge => edge.to);
        canvasSideCheck = { id, anchorId, siblings, cross: horizontal ? 'cy' : 'cx', want: dir < 0 ? -1 : 1, names: [label, anchorName] };
        if (!canvasApply(model, `${label} added from ${anchorName}`, id, op)) canvasSideCheck = null;""")

# ---------------------------------------------------------------- the truth after the render
rep("""        if (Math.abs(fa[along] - fb[along]) > size) {
          showToast(`${v.names[0]} added for ${v.names[1]} \\u2014 the layout put it on another row, not beside it (what feeds a block decides its row).`);
          return;
        }
        if (Math.sign(fa[v.cross] - fb[v.cross]) === v.want) return;
        showToast(`${v.names[0]} added beside ${v.names[1]} \\u2014 the layout put it on the other side (what these branches lead to decides their order).`);""",
    """        // A side is measured against the block's other steps, not against the block
        // itself: the new step is under it either way.
        const sibs = (v.siblings || []).map(sid => canvasNodeFrame(svg, sid)).filter(Boolean);
        if (!sibs.length) {
          showToast(`${v.names[0]} now follows ${v.names[1]}. It is the only step out of it, so the layout puts it underneath \\u2014 give ${v.names[1]} a second step and they share a row.`);
          return;
        }
        const onRow = sibs.some(frame => Math.abs(fa[along] - frame[along]) <= Math.max(fa[v.cross === 'cx' ? 'h' : 'w'], frame[v.cross === 'cx' ? 'h' : 'w']));
        if (!onRow) {
          showToast(`${v.names[0]} now follows ${v.names[1]} \\u2014 the layout put it on its own row (what leads into a block decides its row).`);
          return;
        }
        const edge = v.want < 0 ? Math.min(...sibs.map(frame => frame[v.cross])) : Math.max(...sibs.map(frame => frame[v.cross]));
        if (Math.sign(fa[v.cross] - edge) === v.want) return;
        showToast(`${v.names[0]} added \\u2014 the layout put it on the other side (what these steps lead to decides their order).`);""")

# ---------------------------------------------------------------- the popover hint and placeholder
rep("""          : beside ? `Beside ${name} \\u2014 ${fedBy ? `fed by ${fedBy}, like it is` : 'on its own, like it is'}.`""",
    """          : beside ? `Follows ${name}, kept to the ${role === 'sideA' ? (axesForHint.sideA === 'top' ? 'top' : 'left') : (axesForHint.sideB === 'bottom' ? 'bottom' : 'right')} where the layout allows it.`""")
rep("""        const fedBy = feederIds.map(fid => escapeHtml(canvasLabelOf(model, fid))).join(', ');""",
    """        const fedBy = feederIds.map(fid => escapeHtml(canvasLabelOf(model, fid))).join(', ');
        const axesForHint = canvasAxes(model);""")
rep("""placeholder="${free ? 'Name the new block' : 'Name the step beside ' + name}\"""",
    """placeholder="${free ? 'Name the new block' : 'Name the step after ' + name}\"""")

# ---------------------------------------------------------------- the branch question follows the anchor
rep("""        const branch = role === 'fwd' ? canvasAutoBranchLabel(model, sourceId) : (feederDiamond ? canvasAutoBranchLabel(model, feederDiamond.id) : '');
        const isDecision = Boolean(source && source.shape === 'diamond');
        const askBranch = (role === 'fwd' && isDecision) || Boolean(feederDiamond);""",
    """        const isDecision = Boolean(source && source.shape === 'diamond');
        // A side step comes out of the anchor now, so a decision asks for ITS branch word.
        const branch = (role === 'fwd' || beside) ? canvasAutoBranchLabel(model, sourceId) : (feederDiamond ? canvasAutoBranchLabel(model, feederDiamond.id) : '');
        const askBranch = ((role === 'fwd' || beside) && isDecision) || (!beside && Boolean(feederDiamond));""")

# ---------------------------------------------------------------- the handle tooltip
rep("""         ['sideA', axes.sideA, 'Add a step beside'], ['sideB', axes.sideB, 'Add a step beside']""",
    """         ['sideA', axes.sideA, 'Add a step, kept to one side of'], ['sideB', axes.sideB, 'Add a step, kept to one side of']""")

# ---------------------------------------------------------------- the planner: left/right bias on an "after" step
rep("""        if (op.mode === 'after') {
          const arrow = surgArrowText(idx, op.edgeType || '-->', op.edgeLabel || '', op.forbidMid);
          const placed = lineAfter(groupedMention || lastMention, `${op.anchorId} ${arrow} ${op.id}${token}`);
          return { edits: [placed.edit], notes: [], ask: null, groupId: placed.groupId };
        }""",
    """        if (op.mode === 'after') {
          const arrow = surgArrowText(idx, op.edgeType || '-->', op.edgeLabel || '', op.forbidMid);
          const text = `${op.anchorId} ${arrow} ${op.id}${token}`;
          // A side gesture asks for a left or a right. Among the children of one block that
          // is decided by the order of its connectors, so the new line goes before the
          // anchor's first outgoing line (left) or keeps its place at the end (right).
          if (op.bias < 0) {
            const out = idx.hops.filter(hop => hop.from && hop.from.id === op.anchorId && hop.to.id !== op.anchorId);
            if (out.length) {
              const firstOut = out[0];
              return { edits: [{ op: 'insertAfter', line: firstOut.line - 1, lines: [`${firstOut.statement.indent}${text}`] }], notes: [], ask: null,
                groupId: firstOut.from.group && firstOut.from.group.endStatement ? firstOut.from.group.id : '' };
            }
          }
          const placed = lineAfter(groupedMention || lastMention, text);
          return { edits: [placed.edit], notes: [], ask: null, groupId: placed.groupId };
        }""")

tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('beside-from-block applied: %d -> %d chars' % (len(orig), len(s)))
