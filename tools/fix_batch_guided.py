r"""Second small batch from the queue. Anchors are taken FROM the file.

[04] "+ Block" appended at the end of the file regardless of where you were; inserting a
     step between rows 33 and 34 meant fourteen up-arrow clicks. Now inserts right after
     the row that holds focus (or the last declaring row when nothing has focus).
[05] "+ Connection" joined the last two ids in the file whatever you had selected, and
     pressing it three times wrote the same edge three times. Now connects FROM the
     focused row's first id TO the next declared id, and refuses an edge that exists.
[11] A label containing > < & | " ; in a `-- label -->` file fell to "Rewrite the Mermaid
     code?" because the mid form broke the statement splitter. Retry in pipe form before
     offering the rewrite.
[12] No-op gestures toasted "updated". The noop path now returns false so callers stay quiet.
[10] The deck writer's comment claimed PDF and PPTX "cut a diagram in the same places";
     they do not, by design: PDF may use portrait pages, PPTX cannot (one sldSz), so PPTX
     splits a tall diagram into more landscape parts. The comment now says so. (Measured:
     4 parts PPTX vs 3 PDF on the same diagram, before any of the recent patches.)
"""
import io, os, shutil, sys, re

APP = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\tsinc\Downloads\T_Industries_SIREN_v1.html'
s = io.open(APP, encoding='utf-8', newline='').read()
orig = s

def rep(anchor, new, n=1):
    global s
    c = s.count(anchor)
    assert c == n, 'anchor count %d (want %d): %r' % (c, n, anchor[:90])
    s = s.replace(anchor, new)

# ---------------- [04] + [05] guided +Block / +Connection ----------------
i = s.index("      function structureAddBlock() {")
j = s.index("      function structureAddLink() {", i)
k = s.index("        showToast('Connection added.', 'success');\n      }\n", j) + len("        showToast('Connection added.', 'success');\n      }\n")
old = s[i:k]
new = """      // The row that holds focus, so a new block or connection lands where the person is
      // working rather than at the end of the file. Null when nothing in the editor has focus.
      function structureFocusedRowIndex() {
        const active = document.activeElement;
        if (!active || !el.structureRows || !el.structureRows.contains(active)) return null;
        const host = active.closest('.struct-code');
        if (!host || host.dataset.line === undefined) return null;
        const n = Number(host.dataset.line);
        return Number.isFinite(n) ? n : null;
      }
      // Last row that declares or mentions a node - where additive lines go by default.
      function structureLastDeclaringIndex(rows) {
        let last = -1;
        rows.forEach(row => { if (row.kind === 'block' || row.kind === 'link' || row.kind === 'chain') last = row.index; });
        return last;
      }
      function structureAddBlock() {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const id = structureNextId();
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = structureFocusedRowIndex();
        // Insert after the focused row; else after the last declaring row; else at the end.
        let at = focused !== null ? focused : structureLastDeclaringIndex(rows);
        if (at < 0 || at >= lines.length) at = lines.length - 1;
        lines.splice(at + 1, 0, `${indent}${id}${makeShapeToken('rect', 'New block')}`);
        writeStructureSource(lines.join('\\n'));
        showToast(focused !== null ? `Block added after line ${focused + 1}.` : 'Block added.', 'success');
      }
      function structureAddLink() {
        if (!structureIsFlowchart()) { showToast('Blocks and connections are flowchart syntax \\u2014 this diagram type is edited as code.', 'error'); return; }
        const ids = structureLineIds();
        if (ids.length < 2) { showToast('Add two blocks first, then connect them.', 'error'); return; }
        const lines = el.source.value.split(/\\r?\\n/);
        const indent = (lines.find(line => /^\\s+\\S/.test(line)) || '    ').match(/^\\s*/)[0] || '    ';
        const rows = parseStructureRows(el.source.value);
        const focused = structureFocusedRowIndex();
        // From: the first id on the focused row (else the second-to-last id in the file).
        // To: the next declared id after it (else the last id). Never the same pair twice.
        let from = null, to = null;
        if (focused !== null) {
          const row = rows.find(r => r.index === focused);
          if (row) {
            if (row.kind === 'block') from = row.id;
            else if (row.kind === 'link') from = row.toId;
            else if (row.kind === 'chain' && row.nodes.length) from = row.nodes[row.nodes.length - 1].id;
          }
        }
        if (!from) from = ids[ids.length - 2];
        const fi = ids.indexOf(from);
        to = fi >= 0 && fi + 1 < ids.length ? ids[fi + 1] : ids[ids.length - 1];
        if (to === from) to = ids.find(x => x !== from) || to;
        if (!to || to === from) { showToast('Nothing left to connect this block to.', 'error'); return; }
        // Refuse a duplicate: the same pair already joined on some line.
        const exists = rows.some(r => (r.kind === 'link' && r.fromId === from && r.toId === to)
          || (r.kind === 'chain' && r.nodes.some((n, idx) => idx + 1 < r.nodes.length && n.id === from && r.nodes[idx + 1].id === to)));
        if (exists) { showToast(`${from} and ${to} are already connected.`, 'info'); return; }
        let at = focused !== null ? focused : structureLastDeclaringIndex(rows);
        if (at < 0 || at >= lines.length) at = lines.length - 1;
        lines.splice(at + 1, 0, `${indent}${from} --> ${to}`);
        writeStructureSource(lines.join('\\n'));
        showToast(`Connected ${from} \\u2192 ${to}.`, 'success');
      }
"""
s = s[:i] + new + s[k:]

# ---------------- [12] noop path returns false ----------------
rep("""        if (result.status === 'noop') {
          if (typeof onWrite === 'function') onWrite();
          refreshVisualBuilder(visualSelectedNodeId);
          scheduleSave();
          return true;
        }""",
    """        if (result.status === 'noop') {
          // Nothing changed, so nothing is announced: callers toast only on true.
          if (typeof onWrite === 'function') onWrite();
          refreshVisualBuilder(visualSelectedNodeId);
          return false;
        }""")

# ---------------- [11] retry in pipe form before the rewrite dialog ----------------
# surgArrowText honours op.forbidMid via its 4th argument; thread it through the two planners.
rep("        (op.edges || []).forEach(e => lines.push(`${anchor.indent}${e.from} ${surgArrowText(idx, e.type, e.label)} ${e.to}`));",
    "        (op.edges || []).forEach(e => lines.push(`${anchor.indent}${e.from} ${surgArrowText(idx, e.type, e.label, op.forbidMid)} ${e.to}`));")
rep("        return { edits: [{ op: 'insertAfter', line: anchor.line, lines: [`${anchor.indent}${op.from} ${surgArrowText(idx, op.edgeType, op.label)} ${op.to}`] }], notes: [], ask: null };",
    "        return { edits: [{ op: 'insertAfter', line: anchor.line, lines: [`${anchor.indent}${op.from} ${surgArrowText(idx, op.edgeType, op.label, op.forbidMid)} ${op.to}`] }], notes: [], ask: null };")
# in surgicalWrite: on round-trip mismatch, if the op carries a label and was not already pipe-forced, retry once forced.
rep("""        if (!visualModelsEquivalent(check, model)) {
          // Tier 3: the surgical text does not re-parse to what the gesture meant. Never
          // write it. Offer the full rewrite and say what that costs.
          return { status: 'fallback', reason: check.compatible ? 'round-trip mismatch' : check.error, text: null, attempted: applied.text, plan, touched: applied.touched, check };
        }""",
    """        if (!visualModelsEquivalent(check, model)) {
          // A label carrying > < & | " ; in a mid-form file breaks the statement splitter.
          // The same label in pipe form round-trips - try that once before giving up on
          // the surgical path; the file's other lines keep their own spelling.
          if (!op.forbidMid && op.label && idx.labelForm === 'mid' && /[<>&|";]/.test(String(op.label))) {
            const retry = surgicalWrite(sourceText, model, Object.assign({}, op, { forbidMid: true }));
            if (retry.status === 'written' || retry.status === 'noted') return retry;
          }
          // Tier 3: the surgical text does not re-parse to what the gesture meant. Never
          // write it. Offer the full rewrite and say what that costs.
          return { status: 'fallback', reason: check.compatible ? 'round-trip mismatch' : check.error, text: null, attempted: applied.text, plan, touched: applied.touched, check };
        }""")

# ---------------- [10] the wrong comment ----------------
rep("""         WHO DECIDES.  Not this writer.  deckPlanDiagramPages(target:'pptx') -
         the same pure function the PDF asks - which with that target can never
         return portrait.  Both files therefore cut a diagram in the same places
         and report the same point size; only the page shape differs.""",
    """         WHO DECIDES.  Not this writer.  deckPlanDiagramPages(target:'pptx') -
         the same pure function the PDF asks - which with that target can never
         return portrait.  So the two files do NOT always cut in the same places:
         a tall diagram that the PDF prints on 3 portrait pages becomes 4 landscape
         slides here, because a slide cannot be portrait. Each file's parts are
         consistent with its own page shape; the eyebrows name each file's own
         part count. (Measured 2026-08-23: 4 vs 3 on the same diagram.)""")

shutil.copyfile(APP, os.path.join(os.environ.get('TEMP', '.'), 'siren_backup_batch_guided.html'))
tmp = APP + '.tmp'
io.open(tmp, 'w', encoding='utf-8', newline='').write(s)
os.replace(tmp, APP)
print('batch guided applied: %d -> %d chars' % (len(orig), len(s)))
