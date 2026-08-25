# Surgical-writer patch for T_Industries_SIREN_v1.html.
# Anchor-guarded: every replacement asserts its anchor count first; writes .tmp then os.replace.
import io, os, sys, re

P = r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
HERE = os.path.dirname(os.path.abspath(__file__))
WRITER = os.path.join(HERE, 'writer.js')

s = io.open(P, encoding='utf-8', newline='').read()
orig_len = len(s)
assert '\r\n' not in s[:200000], 'unexpected CRLF'

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, 'anchor count %d != %d for: %r' % (c, n, a[:90])
    s = s.replace(a, b)

# ------------------------------------------------------------------ 0. writer block
w = io.open(WRITER, encoding='utf-8').read().split('\n')
# drop the design-file header comment (first 7 lines end with '*/')
assert w[0].startswith('/* ===================== surgical writer'), w[0]
assert w[6].strip().endswith('*/'), w[6]
body = w[7:]
while body and not body[0].strip(): body.pop(0)
while body and not body[-1].strip(): body.pop()
indented = ['      ' + l if l.strip() else '' for l in body]
head = [
'      /* ================= surgical writer =====================================',
'         The visual builder\'s write path. A gesture arrives as a short operation',
'         (add this block, relabel that one, drop hop 3) and becomes a few',
'         line-level edits against the source AS IT IS RIGHT NOW: the index reads',
'         el.source.value with character offsets, the planner names the spans,',
'         applySourceEdits writes them and every other byte is left alone - the',
'         user\'s comment stays where it was, "-- Yes -->" stays "-- Yes -->",',
'         chains stay chains, aligned spacing stays aligned. Three tiers, nothing',
'         silent: write; write and say which lines (toast); ask before moving a',
'         line the gesture did not point at. The old whole-file re-serialisation',
'         survives only as the confirmed fallback in applyVisualModel below. */',
'      /* ---- surgical writer: begin ---- */',
]
tail = ['      /* ---- surgical writer: end ---- */', '']
writer_block = '\n'.join(head + indented + tail)

# ------------------------------------------------------------------ 1. applyVisualModel
OLD_APPLY = """      function applyVisualModel(model, reason, preferredNodeId = '') {
        visualSelectedNodeId = preferredNodeId || visualSelectedNodeId;
        applySource(serializeVisualFlowchart(model), { reason, recordUndo: true, saveVersion: false });
        refreshVisualBuilder(visualSelectedNodeId);
      }
"""
NEW_APPLY = writer_block + """
      /* Every visual gesture lands here. It used to re-serialise the whole file:
         one added block moved the user's comment, split their chains one hop per
         line, quoted labels nobody had quoted and reordered the file into "all
         blocks, then all edges". Now the gesture says what it did (op) and the
         writer edits only the lines that gesture concerns; the full rewrite is
         offered, named and confirmed - never done quietly. onWrite carries the
         caller's sidecar work (styles, routes, notes) so it runs only when the
         source really changes. Returns true when the change is in the source and
         nothing more needs saying (the caller may toast its success); false when
         a note, a question or a refusal is already on screen. */
      function applyVisualModel(model, reason, preferredNodeId = '', op = null, onWrite = null) {
        visualSelectedNodeId = preferredNodeId || visualSelectedNodeId;
        const commit = (text, notes) => {
          if (typeof onWrite === 'function') onWrite();
          applySource(text, { reason, recordUndo: true, saveVersion: false });
          refreshVisualBuilder(visualSelectedNodeId);
          if (notes && notes.length) showToast(notes.join(' '));
        };
        let result;
        try { result = surgicalWrite(el.source.value, model, op); }
        catch (error) { result = { status: 'fallback', reason: error && error.message ? error.message : String(error) }; }
        if (result.status === 'noop') {
          if (typeof onWrite === 'function') onWrite();
          refreshVisualBuilder(visualSelectedNodeId);
          scheduleSave();
          return true;
        }
        if (result.status === 'written' || result.status === 'noted') {
          commit(result.text, result.notes);
          return result.status === 'written';
        }
        if (result.status === 'asked' && result.roundTrip !== false) {
          requestConfirmation({
            title: 'Move lines to do this?',
            message: result.message,
            confirmText: result.confirmText || 'Continue',
            action: () => commit(result.text, result.notes && result.notes.length ? result.notes : ['Done. Undo restores the original lines.'])
          });
          return false;
        }
        const rewritten = serializeVisualFlowchart(model);
        const count = rewritten.split('\\n').length;
        requestConfirmation({
          title: 'Rewrite the Mermaid code?',
          message: `SIREN cannot make this change by editing only the lines it concerns. It can rewrite the whole diagram in its own layout (${count} lines; comments kept; spacing, label quotes and connector spelling normalised). Undo restores the original.`,
          confirmText: 'Rewrite',
          action: () => commit(rewritten, ['The Mermaid code was rewritten in SIREN\\u2019s layout. Undo restores the original.'])
        });
        return false;
      }
"""
rep(OLD_APPLY, NEW_APPLY)

# ------------------------------------------------------------------ 2. callers
# 1 shape menu
rep("""            node.shape = shape;
            applyVisualModel(model, 'Visual block shape changed', node.id);
            showToast('Block shape updated.', 'success');
""", """            node.shape = shape;
            if (applyVisualModel(model, 'Visual block shape changed', node.id, { type: 'updateNode', id: node.id, shape })) showToast('Block shape updated.', 'success');
""")

# 2 subflow insert
rep("""        diagram.nodeStyles=sanitizeNodeStyles(diagram.nodeStyles||{});diagram.nodeMetadata=sanitizeNodeMetadata(diagram.nodeMetadata||{});diagram.comments=sanitizeComments(diagram.comments||[]);
        Object.entries(item.nodeStyles||{}).forEach(([oldId,style])=>{const id=idMap.get(oldId);if(id)diagram.nodeStyles[id]={...style};});
        Object.entries(item.nodeMetadata||{}).forEach(([oldId,meta])=>{const id=idMap.get(oldId);if(id)diagram.nodeMetadata[id]={...meta};});
        (item.comments||[]).forEach(comment=>{const id=idMap.get(comment.targetId);if(id)diagram.comments.push({...comment,id:makeCommentId(),targetId:id,createdAt:new Date().toISOString()});});
        const first=Array.from(idMap.values())[0]||'';applyVisualModel(model,'Reusable subflow inserted',first);showToast(`Subflow \u201c${el.subflowSelect.value}\u201d inserted.`,'success');
""", """        const carrySidecars=()=>{
          diagram.nodeStyles=sanitizeNodeStyles(diagram.nodeStyles||{});diagram.nodeMetadata=sanitizeNodeMetadata(diagram.nodeMetadata||{});diagram.comments=sanitizeComments(diagram.comments||[]);
          Object.entries(item.nodeStyles||{}).forEach(([oldId,style])=>{const id=idMap.get(oldId);if(id)diagram.nodeStyles[id]={...style};});
          Object.entries(item.nodeMetadata||{}).forEach(([oldId,meta])=>{const id=idMap.get(oldId);if(id)diagram.nodeMetadata[id]={...meta};});
          (item.comments||[]).forEach(comment=>{const id=idMap.get(comment.targetId);if(id)diagram.comments.push({...comment,id:makeCommentId(),targetId:id,createdAt:new Date().toISOString()});});
        };
        const added=Array.from(idMap.values()).map(id=>{const node=model.nodes.find(n=>n.id===id);return {id,label:node?.label||id,shape:node?.shape||'rect'};});
        const links=(item.edges||[]).map(edge=>({from:idMap.get(edge.from),to:idMap.get(edge.to),type:edge.type,label:edge.label||''})).filter(edge=>edge.from&&edge.to);
        const first=Array.from(idMap.values())[0]||'';
        if(applyVisualModel(model,'Reusable subflow inserted',first,{type:'addNodes',nodes:added,edges:links},carrySidecars))showToast(`Subflow \u201c${el.subflowSelect.value}\u201d inserted.`,'success');
""")

# 3 add block
rep("""        applyVisualModel(model, 'Visual block added', id);
        showToast(`Block \u201c${label}\u201d added.`, 'success');
        el.visualNodeLabel.focus();
""", """        if (applyVisualModel(model, 'Visual block added', id, { type: 'addNode', id, label, shape: visualPendingShape })) showToast(`Block \u201c${label}\u201d added.`, 'success');
        el.visualNodeLabel.focus();
""")

# 4 update block
rep("""        node.label = label;
        node.shape = el.visualNodeEditShape.value;
        applyVisualModel(model, 'Visual block updated', node.id);
        showToast('Block updated in both visual and code modes.', 'success');
""", """        node.label = label;
        node.shape = el.visualNodeEditShape.value;
        if (applyVisualModel(model, 'Visual block updated', node.id, { type: 'updateNode', id: node.id, label, shape: node.shape })) showToast('Block updated in both visual and code modes.', 'success');
""")

# 5 delete block
rep("""        model.nodes = model.nodes.filter(node => node.id !== id);
        model.edges = model.edges.filter(edge => edge.from !== id && edge.to !== id);
        const diagram = getActiveDiagram();
        if (diagram?.nodeStyles && diagram.nodeStyles[id]) delete diagram.nodeStyles[id];
        if (diagram?.nodeMetadata && diagram.nodeMetadata[id]) delete diagram.nodeMetadata[id];
        if (diagram?.comments) diagram.comments = sanitizeComments(diagram.comments).filter(comment => !(comment.targetType==='node' && comment.targetId===id) && !(comment.targetType==='edge' && (comment.targetId.startsWith(`${id}|`) || comment.targetId.includes(`|${id}|`))));
        visualSelectedNodeId = model.nodes[0]?.id || '';
        applyVisualModel(model, 'Visual block deleted', visualSelectedNodeId);
        showToast('Block and attached connectors deleted.', 'success');
""", """        model.nodes = model.nodes.filter(node => node.id !== id);
        model.edges = model.edges.filter(edge => edge.from !== id && edge.to !== id);
        visualSelectedNodeId = model.nodes[0]?.id || '';
        // Styles, notes, classes, links, icons, connector styles and routes all hang
        // off the id; the one forgetter clears all seven, not two of them.
        if (applyVisualModel(model, 'Visual block deleted', visualSelectedNodeId, { type: 'deleteNode', id }, () => structureForgetNode(id))) showToast('Block and attached connectors deleted.', 'success');
""")

# 6 add connector
rep("""        model.edges.push({ from, to, type, label });
        el.visualEdgeLabel.value = '';
        applyVisualModel(model, 'Visual connector added', visualSelectedNodeId || from);
        showToast('Connector added and Mermaid code updated.', 'success');
""", """        model.edges.push({ from, to, type, label });
        el.visualEdgeLabel.value = '';
        if (applyVisualModel(model, 'Visual connector added', visualSelectedNodeId || from, { type: 'addEdge', from, to, edgeType: type, label })) showToast('Connector added and Mermaid code updated.', 'success');
""")

# 7 delete connector (list)
rep("""        const removedEdge = model.edges[index];
        const removedKey = edgeKey(removedEdge);
        const diagram = getActiveDiagram();
        if (diagram.edgeStyles) delete diagram.edgeStyles[removedKey];
        if (diagram.edgeRoutes) delete diagram.edgeRoutes[removedKey];
        if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).filter(comment => !(comment.targetType==='edge' && comment.targetId===removedKey));
        model.edges.splice(index, 1);
        applyVisualModel(model, 'Visual connector deleted', visualSelectedNodeId);
        showToast('Connector deleted. Undo is available.', 'success');
""", """        const removedEdge = model.edges[index];
        const removedKey = edgeKey(removedEdge);
        const diagram = getActiveDiagram();
        const forgetEdge = () => {
          if (diagram.edgeStyles) delete diagram.edgeStyles[removedKey];
          if (diagram.edgeRoutes) delete diagram.edgeRoutes[removedKey];
          if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).filter(comment => !(comment.targetType==='edge' && comment.targetId===removedKey));
        };
        model.edges.splice(index, 1);
        if (applyVisualModel(model, 'Visual connector deleted', visualSelectedNodeId, { type: 'deleteEdge', index }, forgetEdge)) showToast('Connector deleted. Undo is available.', 'success');
""")

# 8 direction
rep("""        model.direction = el.visualDirection.value;
        state.direction = model.direction;
        el.direction.value = model.direction;
        applyVisualModel(model, 'Visual layout changed', visualSelectedNodeId);
        showToast('Flow direction updated.', 'success');
""", """        model.direction = el.visualDirection.value;
        state.direction = model.direction;
        el.direction.value = model.direction;
        if (applyVisualModel(model, 'Visual layout changed', visualSelectedNodeId, { type: 'setDirection', direction: model.direction })) showToast('Flow direction updated.', 'success');
""")

# 9 create group
rep("""        const title = cleanVisualText(el.visualGroupName.value) || `Group ${(model.subgraphs || []).length + 1}`;
        // A block can only belong to one group, so take it out of any group it is already in.
        (model.subgraphs || []).forEach(group => {
          group.members = group.members.filter(id => !members.includes(id));
        });
        model.subgraphs = (model.subgraphs || []).filter(group => group.members.length);
        model.subgraphs.push({ id: nextVisualGroupId(model.subgraphs), title, members, depth: 0 });
        el.visualGroupName.value = '';
        applyVisualModel(model, 'Visual group created', visualSelectedNodeId);
        showToast(`Group \u201c${title}\u201d created.`, 'success');
""", """        const title = cleanVisualText(el.visualGroupName.value) || `Group ${(model.subgraphs || []).length + 1}`;
        // The id is chosen before any group is emptied, so an id still written in
        // the source is never handed out a second time.
        const groupId = nextVisualGroupId(model.subgraphs);
        // A block can only belong to one group, so take it out of any group it is already in.
        (model.subgraphs || []).forEach(group => {
          group.members = group.members.filter(id => !members.includes(id));
        });
        model.subgraphs = (model.subgraphs || []).filter(group => group.members.length);
        model.subgraphs.push({ id: groupId, title, members, depth: 0 });
        el.visualGroupName.value = '';
        if (applyVisualModel(model, 'Visual group created', visualSelectedNodeId, { type: 'addGroup', id: groupId, title, members })) showToast(`Group \u201c${title}\u201d created.`, 'success');
""")

# 10 rename group
rep("""          target.title = cleanVisualText(value) || target.id;
          applyVisualModel(next, 'Visual group renamed', visualSelectedNodeId);
          showToast('Group renamed.', 'success');
""", """          target.title = cleanVisualText(value) || target.id;
          if (applyVisualModel(next, 'Visual group renamed', visualSelectedNodeId, { type: 'renameGroup', id: group.id, title: target.title })) showToast('Group renamed.', 'success');
""")

# 11 ungroup
rep("""            next.subgraphs = (next.subgraphs || []).filter(item => item.id !== groupId);
            applyVisualModel(next, 'Visual group removed', visualSelectedNodeId);
            showToast('Group removed.', 'success');
""", """            next.subgraphs = (next.subgraphs || []).filter(item => item.id !== groupId);
            if (applyVisualModel(next, 'Visual group removed', visualSelectedNodeId, { type: 'deleteGroup', id: groupId })) showToast('Group removed.', 'success');
""")

# 12 child / sibling block
rep("""        if (mode === 'child') {
          model.edges.push({ from: anchorId, to: id, type: '-->', label: '' });
        } else {
          // Sibling: hang it off whatever feeds the anchor, so it sits beside it.
          const parent = model.edges.find(edge => edge.to === anchorId);
          if (parent) model.edges.push({ from: parent.from, to: id, type: '-->', label: '' });
        }
        applyVisualModel(model, mode === 'child' ? 'Child block added' : 'Sibling block added', id);
        showToast(`${mode === 'child' ? 'Child' : 'Sibling'} block added. Type to rename it.`, 'success');
""", """        let attachFrom = '';
        if (mode === 'child') {
          attachFrom = anchorId;
          model.edges.push({ from: anchorId, to: id, type: '-->', label: '' });
        } else {
          // Sibling: hang it off whatever feeds the anchor, so it sits beside it.
          const parent = model.edges.find(edge => edge.to === anchorId);
          if (parent) { attachFrom = parent.from; model.edges.push({ from: parent.from, to: id, type: '-->', label: '' }); }
        }
        if (!applyVisualModel(model, mode === 'child' ? 'Child block added' : 'Sibling block added', id, { type: 'addNode', id, label: 'New step', shape: visualPendingShape || 'rect', attachFrom })) return;
        showToast(`${mode === 'child' ? 'Child' : 'Sibling'} block added. Type to rename it.`, 'success');
""")

# 13 rename on canvas
rep("""          target.label = cleanVisualText(value) || target.id;
          applyVisualModel(next, 'Block renamed on canvas', id);
          showToast('Block renamed.', 'success');
""", """          target.label = cleanVisualText(value) || target.id;
          if (applyVisualModel(next, 'Block renamed on canvas', id, { type: 'updateNode', id, label: target.label })) showToast('Block renamed.', 'success');
""")

# 14 connect mode
rep("""          model.edges.push({ from, to: id, type, label: '' });
          applyVisualModel(model, 'Connector drawn on canvas', id);
          showToast(`Connector ${from} \u2192 ${id} added.`, 'success');
""", """          model.edges.push({ from, to: id, type, label: '' });
          if (applyVisualModel(model, 'Connector drawn on canvas', id, { type: 'addEdge', from, to: id, edgeType: type, label: '' })) showToast(`Connector ${from} \u2192 ${id} added.`, 'success');
""")

# 15 edge inspector type/label
rep("""        const diagram = getActiveDiagram();
        const oldKey = edgeInspectorKey;
        const stored = edgeStyleFor(diagram, target);
        const storedRoute = (diagram.edgeRoutes || {})[oldKey];
        target.type = nextType;
        target.label = nextLabel;
        const nextKey = edgeKey(target);
        if (nextKey !== oldKey) {
          if (stored && Object.keys(stored).length) { diagram.edgeStyles = sanitizeEdgeStyles(diagram.edgeStyles || {}); delete diagram.edgeStyles[oldKey]; diagram.edgeStyles[nextKey] = stored; }
          if (storedRoute) { diagram.edgeRoutes = sanitizeEdgeRoutes(diagram.edgeRoutes || {}); delete diagram.edgeRoutes[oldKey]; diagram.edgeRoutes[nextKey] = storedRoute; }
          diagram.comments = sanitizeComments(diagram.comments || []).map(comment => comment.targetType==='edge' && comment.targetId===oldKey ? { ...comment, targetId:nextKey } : comment);
        }
        edgeInspectorKey = nextKey;
        applyVisualModel(model, 'Connector updated', visualSelectedNodeId);
        el.edgeInspectorRoute.textContent = nextLabel ? `Label: \u201c${nextLabel}\u201d` : 'No label';
""", """        const diagram = getActiveDiagram();
        const oldKey = edgeInspectorKey;
        const stored = edgeStyleFor(diagram, target);
        const storedRoute = (diagram.edgeRoutes || {})[oldKey];
        const index = model.edges.indexOf(target);
        target.type = nextType;
        target.label = nextLabel;
        const nextKey = edgeKey(target);
        const carryKey = () => {
          if (nextKey !== oldKey) {
            if (stored && Object.keys(stored).length) { diagram.edgeStyles = sanitizeEdgeStyles(diagram.edgeStyles || {}); delete diagram.edgeStyles[oldKey]; diagram.edgeStyles[nextKey] = stored; }
            if (storedRoute) { diagram.edgeRoutes = sanitizeEdgeRoutes(diagram.edgeRoutes || {}); delete diagram.edgeRoutes[oldKey]; diagram.edgeRoutes[nextKey] = storedRoute; }
            diagram.comments = sanitizeComments(diagram.comments || []).map(comment => comment.targetType==='edge' && comment.targetId===oldKey ? { ...comment, targetId:nextKey } : comment);
          }
          edgeInspectorKey = nextKey;
          el.edgeInspectorRoute.textContent = nextLabel ? `Label: \u201c${nextLabel}\u201d` : 'No label';
        };
        applyVisualModel(model, 'Connector updated', visualSelectedNodeId, { type: 'updateEdge', index, edgeType: nextType, label: nextLabel }, carryKey);
""")

# 16 edge inspector delete
rep("""            model.edges.splice(index, 1);
            const diagram = getActiveDiagram();
            if (diagram.edgeStyles) delete diagram.edgeStyles[edgeInspectorKey];
            if (diagram.edgeRoutes) delete diagram.edgeRoutes[edgeInspectorKey];
            if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).filter(comment => !(comment.targetType==='edge' && comment.targetId===edgeInspectorKey));
            closeEdgeInspector();
            applyVisualModel(model, 'Connector deleted', visualSelectedNodeId);
            showToast('Connector deleted.', 'success');
""", """            model.edges.splice(index, 1);
            const diagram = getActiveDiagram();
            const key = edgeInspectorKey;
            const forgetEdge = () => {
              if (diagram.edgeStyles) delete diagram.edgeStyles[key];
              if (diagram.edgeRoutes) delete diagram.edgeRoutes[key];
              if (diagram.comments) diagram.comments = sanitizeComments(diagram.comments).filter(comment => !(comment.targetType==='edge' && comment.targetId===key));
              closeEdgeInspector();
            };
            if (applyVisualModel(model, 'Connector deleted', visualSelectedNodeId, { type: 'deleteEdge', index }, forgetEdge)) showToast('Connector deleted.', 'success');
""")

# 17 node inspector label
rep("""        node.label = label;
        applyVisualModel(model, 'Block renamed in inspector', id);
        showToast('Block text updated.', 'success');
""", """        node.label = label;
        if (applyVisualModel(model, 'Block renamed in inspector', id, { type: 'updateNode', id, label })) showToast('Block text updated.', 'success');
""")

# ------------------------------------------------------------------ 3. version + changelog
rep("      const APP_VERSION = '1.51.1';", "      const APP_VERSION = '1.52.0';")
rep("""      const CHANGELOG = [
        {
          version: '1.51.0',""", """      const CHANGELOG = [
        {
          version: '1.52.0',
          notes: [
            'Building visually no longer rewrites your Mermaid code. Adding a block, renaming one, drawing or deleting a connector, grouping or changing the layout now edits only the lines it concerns \\u2014 your comments, your chains, your spacing, your "-- Yes -->" and your own line order stay exactly as you typed them. When a change cannot be made without touching other lines, SIREN says which lines and asks first.'
          ]
        },
        {
          version: '1.51.0',""")

# every caller now passes an op: no call with only three arguments may remain
bare = re.findall(r"applyVisualModel\([^;\n]*?\);", s)
bare = [b for b in bare if b.count(',') < 3]
assert not bare, 'callers still without op: %r' % bare
assert s.count('applyVisualModel(') == 18, s.count('applyVisualModel(')

tmp = P + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, P)
print('patched: %d -> %d chars (+%d)' % (orig_len, len(s), len(s) - orig_len))
