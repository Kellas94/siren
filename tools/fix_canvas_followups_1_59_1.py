r"""Canvas phase 1 — the three verifier findings and one copy nit.

D1  Insert-before did not inherit the target's group. The `before` planner took the group
    from the hop LINE it edited, but a member's connectors usually live at depth 0 while
    membership is a bare reference line inside the block - so the text said "outside"
    while G1 (which anchors on the member's own mention) said "inside". Now the group is
    the target's own membership, and when the edited hop line sits outside that block a
    bare member line `ID` is written inside it - the same mechanism `after` uses.
D2  G3 had no keyboard route: the popover offered one text field, and typing an existing
    block's label created a second block with that label instead of connecting. The field
    now carries a <datalist> of the existing blocks, and an exact match (case-insensitive)
    on a forward gesture connects instead of creating.
D3  The one-time hint chip sat over a block at the bottom of the pane for nine seconds and
    swallowed a click on it. It now sits at the top edge of the pane and only its × takes
    pointer events.
nit "Follows Customer paid?." → no doubled punctuation.
"""
import io, os, shutil, sys

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------- D1: insert-before inherits the target's group ----------------
rep("""        const first = hops.find(hop => hop.to.token) || hops[0];
        const edits = [{ op: 'span', line: first.line, start: first.to.idStart, end: first.to.idStart, text: `${op.id}${token} --> ` }];
        let groupId = first.to.group && first.to.group.endStatement ? first.to.group.id : '';""",
    """        const first = hops.find(hop => hop.to.token) || hops[0];
        const edits = [{ op: 'span', line: first.line, start: first.to.idStart, end: first.to.idStart, text: `${op.id}${token} --> ` }];
        // The group is the TARGET's own membership, not the hop line's: a member's connectors
        // usually sit at depth 0 while membership is a bare line inside the block.
        const targetNode = idx.nodes.get(op.anchorId);
        const memberMention = targetNode ? (targetNode.mentions.filter(m => m.group && m.group.endStatement).pop() || null) : null;
        let groupId = memberMention ? memberMention.group.id : (first.to.group && first.to.group.endStatement ? first.to.group.id : '');
        if (memberMention && !(first.to.group && first.to.group.id === memberMention.group.id)) {
          // The edited hop is outside the block: add a bare member line inside it so the
          // text says what the model says.
          const g = memberMention.group;
          const inner = g.statements && g.statements.length ? g.statements[g.statements.length - 1] : null;
          const indent = g.innerIndent != null ? g.innerIndent : `${g.headerStatement.indent}    `;
          edits.push({ op: 'insertAfter', line: inner ? inner.line : g.headerStatement.line, lines: [`${indent}${op.id}`] });
        }""")

# ---------------- D2: datalist of existing blocks + exact match connects ----------------
rep("""          + '<input id="canvasPopLabel" type="text" placeholder="Name this step" autocomplete="off" maxlength="120" aria-label="New block label">'""",
    """          + '<input id="canvasPopLabel" type="text" placeholder="Name this step, or an existing block to connect" autocomplete="off" maxlength="120" aria-label="New block label or an existing block to connect" list="canvasPopBlocks">'
          + `<datalist id="canvasPopBlocks">${model.nodes.filter(n => n.id !== sourceId).map(n => `<option value="${escapeHtml(canvasLabelOf(model, n.id))}"></option>`).join('')}</datalist>`""")

rep("""        const branch = branchInput ? cleanVisualText(branchInput.value) : null;
        const shape = st.shape;
        canvasClosePopover();
        if (st.role === 'back') canvasInsertBefore(st.sourceId, label, shape);
        else canvasGrow(st.sourceId, label, shape, branch);
        canvasRefocusCanvas();""",
    """        const branch = branchInput ? cleanVisualText(branchInput.value) : null;
        const shape = st.shape;
        canvasClosePopover();
        // An existing block's name on a forward gesture means "connect to it", not "make
        // another block with that name" - the keyboard route for connect.
        const existing = (() => {
          const m = canvasModel(); if (!m) return null;
          const want = label.toLowerCase();
          return m.nodes.find(n => n.id !== st.sourceId && cleanVisualText(canvasLabelOf(m, n.id)).toLowerCase() === want) || null;
        })();
        if (existing && st.role !== 'back') canvasConnect({ id: st.sourceId, role: 'fwd' }, existing.id);
        else if (st.role === 'back') canvasInsertBefore(st.sourceId, label, shape);
        else canvasGrow(st.sourceId, label, shape, branch);
        canvasRefocusCanvas();""")

# ---------------- D3: hint chip at the top edge; only × takes the pointer ----------------
rep("""        chip.style.top = `${Math.round(clamp(view.bottom - height - 16, 8, Math.max(8, window.innerHeight - height - 8)))}px`;""",
    """        // At the top edge, not over the diagram: a chip that covered a block for nine
        // seconds swallowed the click meant for the block.
        chip.style.top = `${Math.round(clamp(view.top + 10, 8, Math.max(8, window.innerHeight - height - 8)))}px`;""")
rep("""    .canvas-hint[hidden] { display: none !important; }""",
    """    .canvas-hint[hidden] { display: none !important; }
    .canvas-hint { pointer-events: none; }
    .canvas-hint button { pointer-events: auto; }""")

# ---------------- nit: no doubled punctuation ----------------
rep("""          + `<div class="canvas-pop-hint">${role === 'back' ? `Goes <b>before</b> ${name} \\u2014 whatever fed it now feeds this.` : `Follows ${name}.`} Enter to place \\u00b7 Esc to cancel.</div>`;""",
    """          + `<div class="canvas-pop-hint">${role === 'back' ? `Goes <b>before</b> ${name} \\u2014 whatever fed it now feeds this.` : `Follows ${name}${/[.?!]$/.test(name) ? '' : '.'}`} Enter to place \\u00b7 Esc to cancel.</div>`;""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_canvas_followups.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('canvas follow-ups applied: %d -> %d chars' % (len(orig), len(s)))
