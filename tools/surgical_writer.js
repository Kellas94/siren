/* ===================== surgical writer (design under proof) =====================
   The visual builder's write path. A gesture becomes a short list of line-level
   edits against the source AS IT IS RIGHT NOW; every byte the gesture does not
   concern is left alone. Written as plain functions in the app's style so the
   same text can be dropped into the IIFE next to applyVisualModel. Depends on
   app functions: STRUCT_SHAPE_PATTERN, parseNodeShape, decodeLabel,
   structureEncodeLabel, cleanVisualText, parseVisualFlowchartSource. */

const SURG_ARROW_SRC = String.raw`(<-->|-\.->|-\.-|==>|===|--o|--x|-->|---|~~~)`;
const SURG_NODE_RE = new RegExp('^' + STRUCT_SHAPE_PATTERN);
const SURG_STEP_RE = new RegExp(String.raw`^(\s*)` + SURG_ARROW_SRC + String.raw`(\s*)(?:\|([^|]+)\|(\s*))?`);
// Mermaid's mid-text label forms, exactly the three normaliseInlineEdgeLabel reads.
const SURG_MID_FORMS = [
  { re: /^(\s)--(\s+)([^->|][^|]*?)(\s+)-->(?=\s)/, type: '-->', open: '--', close: '-->', firstChar: /^[->|]/ },
  { re: /^(\s)-\.(\s*)([^.|][^|]*?)(\s*)\.->(?=\s)/, type: '-.->', open: '-.', close: '.->', firstChar: /^[.|]/ },
  { re: /^(\s)==(\s+)([^=>|][^|]*?)(\s+)==>(?=\s)/, type: '==>', open: '==', close: '==>', firstChar: /^[=>|]/ },
];
const SURG_MID_BY_TYPE = { '-->': SURG_MID_FORMS[0], '-.->': SURG_MID_FORMS[1], '==>': SURG_MID_FORMS[2] };
const SURG_WRITABLE = ['-->', '---', '-.->', '==>'];
const SURG_BRACKETS = {
  rect: ['[', ']'], rounded: ['(', ')'], diamond: ['{', '}'], circle: ['((', '))'], doublecircle: ['(((', ')))'],
  stadium: ['([', '])'], cylinder: ['[(', ')]'], subroutine: ['[[', ']]'], hexagon: ['{{', '}}'],
  parallelogram: ['[/', '/]'], parallelogramAlt: ['[\\', '\\]'], trapezoid: ['[/', '\\]'], trapezoidAlt: ['[\\', '/]'], flag: ['>', ']']
};

/* ---------- 1. index: where every statement, mention and hop lives ---------- */

// splitVisualMermaidStatements, with character offsets kept.
function surgSplitLine(raw) {
  const segs = [];
  let quote = '', escaped = false, sq = 0, rd = 0, cu = 0, pipe = false, segStart = 0;
  const push = segEnd => {
    let s = segStart, e = segEnd;
    while (s < e && /\s/.test(raw[s])) s += 1;
    while (e > s && /\s/.test(raw[e - 1])) e -= 1;
    if (e > s) segs.push({ segStart, segEnd, start: s, end: e, text: raw.slice(s, e) });
  };
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (quote) { if (escaped) { escaped = false; continue; } if (ch === '\\') { escaped = true; continue; } if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '|' && !sq && !rd && !cu) { pipe = !pipe; continue; }
    if (ch === ';' && !sq && !rd && !cu && !pipe) { push(i); segStart = i + 1; continue; }
    if (ch === '[') sq += 1; else if (ch === ']') sq = Math.max(0, sq - 1);
    else if (ch === '(') rd += 1; else if (ch === ')') rd = Math.max(0, rd - 1);
    else if (ch === '{') cu += 1; else if (ch === '}') cu = Math.max(0, cu - 1);
  }
  push(raw.length);
  return segs;
}

// parseStructureChain, with offsets and the mid-text label read natively
// (never through normaliseInlineEdgeLabel, which rewrites what it reads).
function surgReadChain(text) {
  const readings = pos => {
    const m = SURG_NODE_RE.exec(text.slice(pos));
    if (!m) return [];
    const token = m[2] || '';
    const out = [{ id: m[1], idStart: pos, idEnd: pos + m[1].length, token,
      tokStart: token ? pos + m[0].length - token.length : -1, tokEnd: token ? pos + m[0].length : -1, next: pos + m[0].length }];
    if (!token) {
      let id = m[1];
      while (/[-.]$/.test(id)) {
        id = id.slice(0, -1);
        if (id) out.push({ id, idStart: pos, idEnd: pos + id.length, token: '', tokStart: -1, tokEnd: -1, next: pos + id.length });
      }
    }
    return out;
  };
  const readStep = pos => {
    const rest = text.slice(pos);
    for (let i = 0; i < SURG_MID_FORMS.length; i += 1) {
      const f = SURG_MID_FORMS[i];
      const m = f.re.exec(rest);
      if (!m) continue;
      const labelStart = pos + m[1].length + f.open.length + m[2].length;
      const trail = (rest.slice(m[0].length).match(/^\s*/) || [''])[0];
      return { form: 'mid', type: f.type, label: decodeLabel(m[3]), rawLabel: m[3], labelStart, labelEnd: labelStart + m[3].length,
        arrowStart: pos + m[1].length, arrowEnd: pos + m[0].length, lead: m[1], trail, ws: [m[2], m[4]], next: pos + m[0].length + trail.length };
    }
    const m = SURG_STEP_RE.exec(rest);
    if (!m) return null;
    const arrowStart = pos + m[1].length;
    const hasLabel = m[4] !== undefined;
    const arrowEnd = hasLabel ? pos + m[0].length - (m[5] || '').length : arrowStart + m[2].length;
    return { form: hasLabel ? 'pipe' : 'none', type: m[2], label: decodeLabel(m[4] || ''), rawLabel: m[4] || '',
      labelStart: hasLabel ? arrowStart + m[2].length + m[3].length + 1 : -1, labelEnd: hasLabel ? arrowEnd - 1 : -1,
      arrowStart, arrowEnd, lead: m[1], trail: hasLabel ? (m[5] || '') : m[3], next: pos + m[0].length };
  };
  const walk = (reading, nodes, steps) => {
    const next = nodes.concat([reading]);
    if (!text.slice(reading.next).trim()) return { nodes: next, steps };
    const step = readStep(reading.next);
    if (!step) return null;
    const following = steps.concat([step]);
    const tail = readings(step.next);
    for (let i = 0; i < tail.length; i += 1) {
      const found = walk(tail[i], next, following);
      if (found) return found;
    }
    return null;
  };
  const heads = readings(0);
  for (let i = 0; i < heads.length; i += 1) {
    const found = walk(heads[i], [], []);
    if (found) return found;
  }
  return null;
}

// parseSubgraphHeader, with the span of the title kept.
function surgGroupHeader(rawTitle, rawStart, ordinal) {
  const br = rawTitle.match(/^([A-Za-z_][\w.-]*)(\s*)([\[\("]{1,2})(.*?)([\]\)"]{1,2})$/);
  if (br) {
    const titleStart = rawStart + br[1].length + br[2].length + br[3].length;
    return { id: br[1], title: decodeLabel(br[4]) || br[1], form: 'bracket', idStart: rawStart, idEnd: rawStart + br[1].length,
      titleStart, titleEnd: titleStart + br[4].length, opener: br[3], closer: br[5] };
  }
  if (/^[A-Za-z_][\w.-]*$/.test(rawTitle)) return { id: rawTitle, title: rawTitle, form: 'bare', idStart: rawStart, idEnd: rawStart + rawTitle.length };
  const quoted = /^["'].*["']$/.test(rawTitle) && rawTitle.length >= 2;
  return { id: `sg${ordinal}`, title: decodeLabel(rawTitle.replace(/^["']|["']$/g, '')), form: 'title', quoted,
    titleStart: rawStart + (quoted ? 1 : 0), titleEnd: rawStart + rawTitle.length - (quoted ? 1 : 0) };
}

function surgIndex(text) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const idx = { lines, header: null, statements: [], nodes: new Map(), hops: [], groups: [], midLabels: 0, pipeLabels: 0, bodyIndents: {} };
  let open = null;
  lines.forEach((raw, line) => {
    const indent = (raw.match(/^[ \t]*/) || [''])[0];
    const segs = surgSplitLine(raw);
    if (!segs.length) { idx.statements.push({ line, indent, kind: 'blank', start: 0, end: raw.length, text: '', onLine: 0, position: 0, group: open }); return; }
    segs.forEach((seg, position) => {
      const st = { line, indent, kind: 'other', start: seg.start, end: seg.end, segStart: seg.segStart, segEnd: seg.segEnd, text: seg.text, onLine: segs.length, position, group: open, nodes: [], steps: [] };
      idx.statements.push(st);
      const t = seg.text;
      if (/^%%\{/.test(t)) { st.kind = 'directive'; return; }
      if (/^%%/.test(t)) { st.kind = 'comment'; return; }
      const header = t.match(/^(flowchart|graph)(\s+)(TD|TB|BT|LR|RL)\s*$/i);
      if (header) {
        st.kind = 'header';
        const dirStart = seg.start + header[1].length + header[2].length;
        idx.header = { line, statement: st, keyword: header[1], direction: header[3].toUpperCase(), dirStart, dirEnd: dirStart + header[3].length };
        return;
      }
      const sg = t.match(/^subgraph(\s+)(.+?)\s*$/i);
      if (sg) {
        st.kind = 'subgraph';
        const rawStart = seg.start + 'subgraph'.length + sg[1].length;
        const group = surgGroupHeader(sg[2], rawStart, idx.groups.length + 1);
        Object.assign(group, { headerStatement: st, endStatement: null, members: [], mentions: [], statements: [], innerIndent: null });
        idx.groups.push(group);
        open = group;
        return;
      }
      if (/^end\b/i.test(t)) { st.kind = 'end'; if (open) { open.endStatement = st; open = null; } return; }
      if (/^(classDef|class|style|linkStyle|click\b|direction\b)/i.test(t)) return;
      const chain = surgReadChain(t);
      if (!chain) return;
      st.kind = chain.steps.length ? 'chain' : 'node';
      if (open) { open.statements.push(st); if (open.innerIndent === null) open.innerIndent = indent; }
      else idx.bodyIndents[indent] = (idx.bodyIndents[indent] || 0) + 1;
      st.nodes = chain.nodes.map((n, at) => ({ id: n.id, token: n.token, at, statement: st, line, group: open,
        idStart: seg.start + n.idStart, idEnd: seg.start + n.idEnd,
        tokStart: n.token ? seg.start + n.tokStart : -1, tokEnd: n.token ? seg.start + n.tokEnd : -1,
        start: seg.start + n.idStart, end: seg.start + (n.token ? n.tokEnd : n.idEnd) }));
      st.nodes.forEach(mention => {
        let node = idx.nodes.get(mention.id);
        if (!node) { node = { id: mention.id, mentions: [], declarations: [], order: idx.nodes.size }; idx.nodes.set(mention.id, node); }
        node.mentions.push(mention);
        if (mention.token) node.declarations.push(mention);
        if (open) { open.mentions.push(mention); if (!open.members.includes(mention.id)) open.members.push(mention.id); }
      });
      st.steps = chain.steps.map((s, at) => {
        const hop = { ...s, at, statement: st, line, from: st.nodes[at], to: st.nodes[at + 1], index: idx.hops.length,
          arrowStart: seg.start + s.arrowStart, arrowEnd: seg.start + s.arrowEnd,
          labelStart: s.labelStart >= 0 ? seg.start + s.labelStart : -1, labelEnd: s.labelEnd >= 0 ? seg.start + s.labelEnd : -1 };
        idx.hops.push(hop);
        if (hop.form === 'mid') idx.midLabels += 1; else if (hop.label) idx.pipeLabels += 1;
        return hop;
      });
    });
  });
  idx.labelForm = idx.midLabels > 0 && idx.midLabels >= idx.pipeLabels ? 'mid' : 'pipe';
  let best = null;
  Object.keys(idx.bodyIndents).forEach(k => { if (best === null || idx.bodyIndents[k] > idx.bodyIndents[best]) best = k; });
  idx.bodyIndent = best !== null ? best : (idx.header ? idx.header.statement.indent + '    ' : '    ');
  return idx;
}

/* ---------- 2. writing helpers: tokens, labels, arrows ---------- */

function surgEncode(label) { return structureEncodeLabel(label); }

function surgInnerNeedsQuotes(inner, shape) {
  if (!inner) return true;
  if (/[\[\](){}]/.test(inner)) return true;
  if (/^[\s\/\\]|[\s\/\\]$/.test(inner)) return true;
  if (/^(parallelogram|parallelogramAlt|trapezoid|trapezoidAlt)$/.test(shape) && /[\/\\]/.test(inner)) return true;
  return false;
}

// inner is the raw text between the brackets (quotes included if any).
function surgToken(shape, inner) {
  const br = SURG_BRACKETS[shape] || SURG_BRACKETS.rect;
  return br[0] + inner + br[1];
}

function surgTokenInner(token) {
  const br = SURG_BRACKETS[parseNodeShape(token, '').shape] || SURG_BRACKETS.rect;
  return token.slice(br[0].length, token.length - br[1].length);
}

// New token for a declaration: keeps the user's quoting when the words did not
// change, adds quotes only when the new words need them.
function surgRewriteToken(token, nextShape, nextLabel) {
  const current = parseNodeShape(token, '');
  const innerRaw = surgTokenInner(token);
  const wasQuoted = /^"[\s\S]*"$/.test(innerRaw);
  const shape = nextShape || current.shape;
  let inner;
  if (nextLabel === undefined || nextLabel === null || nextLabel === current.label) {
    inner = innerRaw;
    if (!wasQuoted && shape !== current.shape && surgInnerNeedsQuotes(innerRaw, shape)) inner = `"${innerRaw}"`;
  } else {
    const enc = surgEncode(nextLabel);
    inner = wasQuoted || surgInnerNeedsQuotes(enc, shape) ? `"${enc}"` : enc;
  }
  return surgToken(shape, inner);
}

function surgNewToken(shape, label) {
  const enc = surgEncode(label);
  return surgToken(shape || 'rect', surgInnerNeedsQuotes(enc, shape || 'rect') ? `"${enc}"` : enc);
}

function surgMidSafe(label, type) {
  const f = SURG_MID_BY_TYPE[type];
  if (!f || !label) return false;
  const enc = surgEncode(label);
  return !f.firstChar.test(enc) && !/\s$/.test(enc) && !/-->|\.->|==>/.test(enc);
}

// Arrow text for a NEW line (spaces around are the caller's).
function surgArrowText(idx, type, label, forbidMid) {
  const t = SURG_WRITABLE.includes(type) ? type : '-->';
  if (!label) return t;
  const enc = surgEncode(label);
  if (!forbidMid && idx.labelForm === 'mid' && surgMidSafe(label, t)) {
    const f = SURG_MID_BY_TYPE[t];
    return `${f.open} ${enc} ${f.close}`;
  }
  return `${t}|${enc}|`;
}

function surgLineIds(idx) { return Array.from(idx.nodes.keys()); }

/* ---------- 3. edits: the vocabulary and its application ---------- */
/* {op:'span', line, start, end, text}    replace chars [start,end) of one line
   {op:'insertAfter', line, lines[]}       new lines after line (-1 = top of file)
   {op:'delete', line}                    remove one line
   {op:'replace', line, lines[]}          one line becomes 0..n lines, in place  */

function applySourceEdits(text, edits) {
  const lines = String(text == null ? '' : text).split(/\r?\n/);
  const recs = lines.map(t => ({ text: t, deleted: false, spans: [], before: [], after: [] }));
  const top = [];
  const modified = new Set(), removed = new Set();
  let added = 0;
  (edits || []).forEach(edit => {
    const rec = edit.line >= 0 ? recs[edit.line] : null;
    if (edit.op === 'insertAfter') { (edit.line < 0 ? top : rec.after).push(...edit.lines); added += edit.lines.length; return; }
    if (!rec) throw new Error(`edit addresses line ${edit.line} which does not exist`);
    if (edit.op === 'span') { rec.spans.push(edit); modified.add(edit.line); return; }
    if (edit.op === 'delete') { rec.deleted = true; removed.add(edit.line); return; }
    if (edit.op === 'replace') { rec.deleted = true; rec.before.push(...edit.lines); removed.add(edit.line); added += edit.lines.length; return; }
    throw new Error(`unknown edit op ${edit.op}`);
  });
  const out = top.slice();
  recs.forEach(rec => {
    out.push(...rec.before);
    if (!rec.deleted) {
      let t = rec.text;
      if (rec.spans.length) {
        const spans = rec.spans.slice().sort((a, b) => a.start - b.start || a.end - b.end);
        for (let i = 0; i < spans.length; i += 1) {
          const s = spans[i];
          if (s.start < 0 || s.end > t.length || s.end < s.start) throw new Error(`span out of range on line ${s.line}`);
          if (i && spans[i - 1].end > s.start) throw new Error(`overlapping spans on line ${s.line}`);
        }
        for (let i = spans.length - 1; i >= 0; i -= 1) t = t.slice(0, spans[i].start) + spans[i].text + t.slice(spans[i].end);
      }
      out.push(t);
    } else if (rec.spans.length) throw new Error('span on a deleted line');
    out.push(...rec.after);
  });
  return { text: out.join('\n'), touched: { modified: Array.from(modified).sort((a, b) => a - b), removed: Array.from(removed).sort((a, b) => a - b), added } };
}

/* ---------- 4. planners: one per gesture ---------- */

const surgHuman = lines => lines.map(n => n + 1).join(', ');

function surgNoPlan(reason) { return { edits: [], notes: [], ask: null, refuse: reason }; }

function surgDepthZeroAfter(mention) {
  // Where "after this mention" lands at depth 0: after the line, or after the group's end.
  if (mention.group && mention.group.endStatement) return mention.group.endStatement.line;
  return mention.line;
}

function surgDeclarationAnchor(idx) {
  let best = null;
  idx.nodes.forEach(node => { const first = node.mentions[0]; if (!best || first.line > best.line) best = first; });
  if (!best) return { line: idx.header ? idx.header.line : -1, indent: idx.bodyIndent };
  if (best.group) return { line: surgDepthZeroAfter(best), indent: idx.bodyIndent };
  return { line: best.line, indent: best.statement.indent };
}

function surgEdgeAnchor(idx, fromId, toId) {
  const from = idx.nodes.get(fromId), to = idx.nodes.get(toId);
  const sameGroup = idx.groups.find(g => g.members.includes(fromId) && g.members.includes(toId) && g.statements.some(s => s.kind === 'chain'));
  if (sameGroup) {
    const last = sameGroup.statements.filter(s => s.kind === 'chain').pop();
    return { line: last.line, indent: last.indent };
  }
  const chains = idx.statements.filter(s => s.kind === 'chain' && !s.group);
  if (chains.length) { const last = chains[chains.length - 1]; return { line: last.line, indent: last.indent }; }
  const nodes = idx.statements.filter(s => s.kind === 'node' && !s.group);
  if (nodes.length) { const last = nodes[nodes.length - 1]; return { line: last.line, indent: last.indent }; }
  const ends = idx.statements.filter(s => s.kind === 'end');
  if (ends.length) return { line: ends[ends.length - 1].line, indent: idx.bodyIndent };
  return { line: idx.header ? idx.header.line : -1, indent: idx.bodyIndent };
}

function surgPlanSetDirection(idx, op) {
  if (!idx.header) return surgNoPlan('no flowchart header');
  const dir = String(op.direction || '').toUpperCase();
  if (!/^(TD|TB|BT|LR|RL)$/.test(dir)) return surgNoPlan('unknown direction');
  // TB and TD are one direction in Mermaid: choosing the one the file already has is no change.
  const same = d => (d === 'TB' ? 'TD' : d);
  if (same(dir) === same(idx.header.direction)) return { edits: [], notes: [], ask: null };
  return { edits: [{ op: 'span', line: idx.header.line, start: idx.header.dirStart, end: idx.header.dirEnd, text: dir }], notes: [], ask: null };
}

function surgPlanUpdateNode(idx, op) {
  const node = idx.nodes.get(op.id);
  if (!node) return surgNoPlan(`no block ${op.id}`);
  const edits = [], notes = [];
  if (!node.declarations.length) {
    // Bare everywhere: its words live nowhere yet, give the first mention a token.
    const current = { label: op.id, shape: 'rect' };
    const label = op.label === undefined ? current.label : op.label;
    const shape = op.shape === undefined ? current.shape : op.shape;
    if (label === current.label && shape === current.shape) return { edits, notes, ask: null };
    const m = node.mentions[0];
    edits.push({ op: 'span', line: m.line, start: m.idEnd, end: m.idEnd, text: surgNewToken(shape, label) });
    return { edits, notes, ask: null };
  }
  node.declarations.forEach(decl => {
    const next = surgRewriteToken(decl.token, op.shape, op.label);
    if (next !== decl.token) edits.push({ op: 'span', line: decl.line, start: decl.tokStart, end: decl.tokEnd, text: next });
  });
  if (edits.length > 1) notes.push(`${op.id} is declared on lines ${surgHuman(edits.map(e => e.line))}; all of them were updated.`);
  return { edits, notes, ask: null };
}

function surgPlanAddNode(idx, op) {
  if (idx.nodes.has(op.id)) return surgNoPlan(`id ${op.id} already exists`);
  const token = surgNewToken(op.shape, op.label);
  if (op.attachFrom) {
    const from = idx.nodes.get(op.attachFrom);
    if (!from) return surgNoPlan(`no block ${op.attachFrom}`);
    const last = from.mentions[from.mentions.length - 1];
    const line = surgDepthZeroAfter(last);
    const indent = last.group ? idx.bodyIndent : last.statement.indent;
    return { edits: [{ op: 'insertAfter', line, lines: [`${indent}${op.attachFrom} --> ${op.id}${token}`] }], notes: [], ask: null };
  }
  const anchor = surgDeclarationAnchor(idx);
  return { edits: [{ op: 'insertAfter', line: anchor.line, lines: [`${anchor.indent}${op.id}${token}`] }], notes: [], ask: null };
}

function surgPlanAddNodes(idx, op) {
  const anchor = surgDeclarationAnchor(idx);
  const lines = [];
  (op.nodes || []).forEach(n => { if (!idx.nodes.has(n.id)) lines.push(`${anchor.indent}${n.id}${surgNewToken(n.shape, n.label)}`); });
  (op.edges || []).forEach(e => lines.push(`${anchor.indent}${e.from} ${surgArrowText(idx, e.type, e.label)} ${e.to}`));
  return { edits: lines.length ? [{ op: 'insertAfter', line: anchor.line, lines }] : [], notes: [], ask: null };
}

function surgPlanAddEdge(idx, op) {
  if (!idx.nodes.has(op.from) || !idx.nodes.has(op.to)) return surgNoPlan('endpoint is not a block in the source');
  const anchor = surgEdgeAnchor(idx, op.from, op.to);
  return { edits: [{ op: 'insertAfter', line: anchor.line, lines: [`${anchor.indent}${op.from} ${surgArrowText(idx, op.edgeType, op.label)} ${op.to}`] }], notes: [], ask: null };
}

function surgPlanUpdateEdge(idx, op) {
  const hop = idx.hops[op.index];
  if (!hop) return surgNoPlan('no such connector');
  const type = SURG_WRITABLE.includes(op.edgeType) ? op.edgeType : hop.type;
  const label = op.label === undefined ? hop.label : op.label;
  if (type === hop.type && label === hop.label) return { edits: [], notes: [], ask: null };
  const otherMid = hop.statement.steps.some(s => s !== hop && s.form === 'mid');
  let text;
  if (label && hop.form === 'mid' && SURG_MID_BY_TYPE[type] && surgMidSafe(label, type)) {
    const f = SURG_MID_BY_TYPE[type];
    text = `${f.open}${hop.ws[0]}${surgEncode(label)}${hop.ws[1]}${f.close}`;
  } else if (label && hop.form === 'none' && !otherMid && idx.labelForm === 'mid' && SURG_MID_BY_TYPE[type] && surgMidSafe(label, type) && hop.lead && hop.trail) {
    const f = SURG_MID_BY_TYPE[type];
    text = `${f.open} ${surgEncode(label)} ${f.close}`;
  } else {
    text = label ? `${type}|${surgEncode(label)}|` : type;
  }
  const notes = [];
  if (label && hop.form === 'mid' && !/^(--|-\.|==)\s/.test(text)) notes.push(`The label on line ${hop.line + 1} now uses the |label| form (its previous form cannot carry this connector).`);
  return { edits: [{ op: 'span', line: hop.line, start: hop.arrowStart, end: hop.arrowEnd, text }], notes, ask: null };
}

// Shared by delete-block and delete-connector: removes hops and/or every mention of
// some blocks, keeps the surviving stretches of each line byte for byte, and
// re-declares in place whatever would otherwise vanish (a block's only words, its
// only mention, its only mention inside a group).
function surgRemovePlan(idx, removedHops, removedNodes) {
  const touched = idx.statements.filter(st => (st.kind === 'chain' || st.kind === 'node')
    && (st.steps.some(s => removedHops.has(s.index)) || st.nodes.some(n => removedNodes.has(n.id))));
  const dropped = new Set();
  const plans = touched.map(st => {
    const gone = st.steps.map(s => removedHops.has(s.index) || removedNodes.has(s.from.id) || removedNodes.has(s.to.id));
    const runs = [];
    for (let i = 0; i < gone.length; i += 1) {
      if (gone[i]) continue;
      let j = i;
      while (j + 1 < gone.length && !gone[j + 1]) j += 1;
      runs.push([i, j]);
      i = j;
    }
    const covered = new Set();
    runs.forEach(([a, b]) => { for (let k = a; k <= b + 1; k += 1) covered.add(k); });
    st.nodes.forEach((n, k) => { if (!covered.has(k)) dropped.add(n); });
    return { st, runs, covered, items: runs.map(([a, b]) => ({ pos: a, text: idx.lines[st.line].slice(st.nodes[a].start, st.nodes[b + 1].end) })) };
  });
  const survives = m => !dropped.has(m);
  const emittedToken = new Set(), emittedAny = new Set(), emittedInGroup = new Set();
  const consider = withToken => plans.forEach(plan => plan.st.nodes.forEach((n, k) => {
    if (plan.covered.has(k) || removedNodes.has(n.id) || (withToken ? !n.token : !!n.token)) return;
    const node = idx.nodes.get(n.id);
    const gkey = n.group ? n.group.id : '';
    const needToken = !!n.token && !node.declarations.some(survives) && !emittedToken.has(n.id);
    const needExist = !node.mentions.some(survives) && !emittedAny.has(n.id);
    const needGroup = !!n.group && !node.mentions.some(o => survives(o) && o.group === n.group) && !emittedInGroup.has(`${gkey}|${n.id}`);
    if (!(needToken || needExist || needGroup)) return;
    plan.items.push({ pos: k, text: n.id + (needToken ? n.token : '') });
    if (needToken) emittedToken.add(n.id);
    emittedAny.add(n.id);
    if (n.group) emittedInGroup.add(`${gkey}|${n.id}`);
  }));
  consider(true);
  consider(false);
  const edits = [];
  plans.forEach(({ st, items }) => {
    items.sort((a, b) => a.pos - b.pos);
    const rendered = items.map(it => it.text);
    if (st.onLine === 1) {
      if (!rendered.length) edits.push({ op: 'delete', line: st.line });
      else if (rendered.length === 1) edits.push({ op: 'span', line: st.line, start: st.start, end: st.end, text: rendered[0] });
      else edits.push({ op: 'replace', line: st.line, lines: rendered.map(t => st.indent + t) });
      return;
    }
    if (rendered.length) { edits.push({ op: 'span', line: st.line, start: st.start, end: st.end, text: rendered.join('; ') }); return; }
    const siblings = idx.statements.filter(s => s.line === st.line && s.kind !== 'blank');
    const p = siblings.indexOf(st);
    if (p < siblings.length - 1) edits.push({ op: 'span', line: st.line, start: st.start, end: siblings[p + 1].start, text: '' });
    else edits.push({ op: 'span', line: st.line, start: siblings[p - 1].end, end: st.end, text: '' });
  });
  return { edits, touchedLines: Array.from(new Set(touched.map(s => s.line))).sort((a, b) => a - b) };
}

function surgPlanDeleteNode(idx, op) {
  if (!idx.nodes.has(op.id)) return surgNoPlan(`no block ${op.id}`);
  const { edits, touchedLines } = surgRemovePlan(idx, new Set(), new Set([op.id]));
  const notes = touchedLines.length > 1 ? [`Removing ${op.id} touches lines ${surgHuman(touchedLines)}.`] : [];
  return { edits, notes, ask: null };
}

function surgPlanDeleteEdge(idx, op) {
  const hop = idx.hops[op.index];
  if (!hop) return surgNoPlan('no such connector');
  const { edits } = surgRemovePlan(idx, new Set([op.index]), new Set());
  const notes = [];
  const redeclared = edits.filter(e => e.op === 'replace');
  if (redeclared.length) notes.push(`Line ${hop.line + 1} also declared the blocks on it; their declarations stay, each on its own line.`);
  return { edits, notes, ask: null };
}

function surgPlanRenameNode(idx, op) {
  const node = idx.nodes.get(op.id);
  if (!node) return surgNoPlan(`no block ${op.id}`);
  const clean = String(op.nextId || '').trim().replace(/[^A-Za-z0-9_.-]/g, '');
  if (!clean || clean === op.id) return { edits: [], notes: [], ask: null };
  if (/^[0-9]/.test(clean) || /^(end|graph|flowchart|subgraph|class|classDef|click|style|linkStyle|direction)$/i.test(clean)) return surgNoPlan('That id is reserved by Mermaid - pick another one.');
  if (idx.nodes.has(clean)) return surgNoPlan('Another block already uses that id - merging them would lose one.');
  const edits = node.mentions.map(m => ({ op: 'span', line: m.line, start: m.idStart, end: m.idEnd, text: clean }));
  const lines = Array.from(new Set(edits.map(e => e.line))).sort((a, b) => a - b);
  return { edits, notes: lines.length > 1 ? [`${op.id} → ${clean} on lines ${surgHuman(lines)}.`] : [], ask: null };
}

function surgGroupHeaderLine(idx, indent, id, title) {
  const enc = surgEncode(title);
  const sample = idx.groups.find(g => g.form === 'bracket');
  const quoted = (sample && /"/.test(sample.opener)) || /[\[\](){}]/.test(enc);
  return `${indent}subgraph ${id}[${quoted ? `"${enc}"` : enc}]`;
}

function surgPlanAddGroup(idx, op) {
  const members = (op.members || []).filter(id => idx.nodes.has(id));
  if (!members.length) return surgNoPlan('no members');
  if (idx.groups.some(g => g.id === op.id)) return surgNoPlan(`group ${op.id} exists`);
  const memberSet = new Set(members);
  const edits = [], notes = [], asks = [];
  const inner = [];            // lines inside the new block, in member order
  const movedDeclLines = new Set();
  members.forEach(id => {
    const node = idx.nodes.get(id);
    const foreign = node.mentions.filter(m => m.group);
    let placed = false;
    foreign.forEach(m => {
      const st = m.statement;
      if (movedDeclLines.has(st.line)) { placed = true; return; }
      if (st.kind === 'node' && st.onLine === 1) {
        // Its own declaration line inside another group: the line moves into the new block.
        edits.push({ op: 'delete', line: st.line });
        inner.push(st.text);
        movedDeclLines.add(st.line);
        notes.push(`Line ${st.line + 1} (${st.text}) moved out of group ${m.group.id} into the new group.`);
        placed = true;
        return;
      }
      if (st.onLine !== 1) { asks.push(`Line ${st.line + 1} holds several statements; split it in code first.`); return; }
      // A connection inside another group mentions the member: the line has to leave that group.
      const others = st.nodes.filter(n => !memberSet.has(n.id));
      const allMembers = others.length === 0;
      const stayBare = [];
      others.forEach(n => {
        const o = idx.nodes.get(n.id);
        const stillThere = o.mentions.some(x => x !== n && x.group === m.group && x.statement !== st);
        if (!stillThere && !stayBare.includes(n.id)) stayBare.push(n.id);
      });
      if (movedDeclLines.has(st.line)) return;
      movedDeclLines.add(st.line);
      if (allMembers) {
        edits.push({ op: 'replace', line: st.line, lines: stayBare.map(b => `${st.indent}${b}`) });
        inner.push(st.text);
        asks.push(`Line ${st.line + 1} (${st.text}) sits inside group ${m.group.id}; it will move into the new group.`);
      } else {
        edits.push({ op: 'replace', line: st.line, lines: stayBare.map(b => `${st.indent}${b}`) });
        edits.push({ op: 'insertAfter', line: m.group.endStatement.line, lines: [`${idx.bodyIndent}${st.text}`] });
        asks.push(`Line ${st.line + 1} (${st.text}) connects ${id} inside group ${m.group.id}; it will move out of that group${stayBare.length ? `, and ${stayBare.join(', ')} will stay in ${m.group.id} by name` : ''}.`);
      }
      placed = true;
    });
    if (!placed || !inner.some(t => surgReadChain(t) && surgReadChain(t).nodes.some(n => n.id === id))) inner.push(id);
  });
  // Put the block after the last mention of any member, at depth 0.
  let anchorLine = idx.header ? idx.header.line : -1;
  let anchorIndent = idx.bodyIndent;
  members.forEach(id => idx.nodes.get(id).mentions.forEach(m => { const l = surgDepthZeroAfter(m); if (l > anchorLine) { anchorLine = l; anchorIndent = m.group ? idx.bodyIndent : m.statement.indent; } }));
  const innerIndent = anchorIndent + '    ';
  const block = [surgGroupHeaderLine(idx, anchorIndent, op.id, op.title)].concat(inner.map(t => innerIndent + t)).concat([`${anchorIndent}end`]);
  edits.push({ op: 'insertAfter', line: anchorLine, lines: block });
  if (asks.length) return { edits: [], notes, ask: { message: asks.join(' '), confirmText: 'Move and group', edits } };
  return { edits, notes, ask: null };
}

function surgPlanRenameGroup(idx, op) {
  const group = idx.groups.find(g => g.id === op.id);
  if (!group) return surgNoPlan(`no group ${op.id}`);
  const title = cleanVisualText(op.title) || group.id;
  if (title === group.title) return { edits: [], notes: [], ask: null };
  const enc = surgEncode(title);
  const line = group.headerStatement.line;
  if (group.form === 'bracket') {
    const quoted = /"/.test(group.opener);
    const text = !quoted && /[\[\](){}]/.test(enc) ? `"${enc}"` : enc;
    return { edits: [{ op: 'span', line, start: group.titleStart, end: group.titleEnd, text }], notes: [], ask: null };
  }
  if (group.form === 'bare') {
    return { edits: [{ op: 'span', line, start: group.idEnd, end: group.idEnd, text: `[${/[\[\](){}]/.test(enc) ? `"${enc}"` : enc}]` }], notes: [], ask: null };
  }
  return { edits: [{ op: 'span', line, start: group.titleStart, end: group.titleEnd, text: enc }], notes: [], ask: null };
}

function surgPlanDeleteGroup(idx, op) {
  const group = idx.groups.find(g => g.id === op.id);
  if (!group || !group.endStatement) return surgNoPlan(`no group ${op.id}`);
  const edits = [];
  [group.headerStatement, group.endStatement].forEach(st => {
    if (st.onLine === 1) edits.push({ op: 'delete', line: st.line });
    else {
      const siblings = idx.statements.filter(s => s.line === st.line && s.kind !== 'blank');
      const p = siblings.indexOf(st);
      if (p < siblings.length - 1) edits.push({ op: 'span', line: st.line, start: st.start, end: siblings[p + 1].start, text: '' });
      else edits.push({ op: 'span', line: st.line, start: siblings[p - 1].end, end: st.end, text: '' });
    }
  });
  const notes = group.statements.length ? [`Lines ${surgHuman([group.headerStatement.line, group.endStatement.line])} removed; the blocks keep their indentation.`] : [];
  return { edits, notes, ask: null };
}

function planSurgicalEdit(idx, op) {
  switch (op && op.type) {
    case 'setDirection': return surgPlanSetDirection(idx, op);
    case 'updateNode': return surgPlanUpdateNode(idx, op);
    case 'addNode': return surgPlanAddNode(idx, op);
    case 'addNodes': return surgPlanAddNodes(idx, op);
    case 'deleteNode': return surgPlanDeleteNode(idx, op);
    case 'addEdge': return surgPlanAddEdge(idx, op);
    case 'updateEdge': return surgPlanUpdateEdge(idx, op);
    case 'deleteEdge': return surgPlanDeleteEdge(idx, op);
    case 'renameNode': return surgPlanRenameNode(idx, op);
    case 'addGroup': return surgPlanAddGroup(idx, op);
    case 'renameGroup': return surgPlanRenameGroup(idx, op);
    case 'deleteGroup': return surgPlanDeleteGroup(idx, op);
    default: return surgNoPlan('no operation given');
  }
}

/* ---------- 5. the gate: did the surgical text yield the intended model? ---------- */

function surgNormalModel(model) {
  const ids = new Set((model.nodes || []).map(n => n.id));
  const nodes = (model.nodes || []).map(n => `${n.id} ${n.label == null ? n.id : n.label} ${n.shape || 'rect'}`).sort();
  const edges = (model.edges || []).map(e => `${e.from} ${e.type} ${e.to} ${e.label || ''}`).sort();
  const groups = (model.subgraphs || [])
    .map(g => ({ id: g.id, title: g.title, members: (g.members || []).filter(id => ids.has(id)).slice().sort() }))
    .filter(g => g.members.length)
    .map(g => `${g.id} ${g.title} ${g.members.join(',')}`).sort();
  const comments = (model.comments || []).map(c => String(c).trim()).sort();
  const direction = String(model.direction || 'TD').toUpperCase();
  return JSON.stringify({ direction, nodes, edges, groups, comments });
}

function visualModelsEquivalent(a, b) {
  return !!a && !!b && a.compatible !== false && surgNormalModel(a) === surgNormalModel(b);
}

/* ---------- 6. the write path (what applyVisualModel becomes) ---------- */

// Mermaid still draws the frame of a group that lost its last block; the visual
// model drops it. Say so rather than leave the two views disagreeing in silence.
function surgEmptiedGroups(beforeIdx, afterText) {
  const after = surgIndex(afterText);
  return beforeIdx.groups.filter(g => g.members.length && after.groups.some(a => a.id === g.id && !a.members.length))
    .map(g => `Group ${g.title || g.id} is now empty; Mermaid still draws its frame. Ungroup it to remove the frame.`);
}

// Returns { status: 'written'|'noted'|'asked'|'fallback'|'refused'|'noop', text, plan, touched }
function surgicalWrite(sourceText, model, op) {
  const idx = surgIndex(sourceText);
  const plan = planSurgicalEdit(idx, op);
  if (plan.refuse) return { status: 'refused', reason: plan.refuse, plan };
  if (plan.ask) {
    // Honest fallback, tier 2: the edits exist and are still line-addressed, but they
    // move lines the user did not point at. Say which, ask, and only then apply.
    const applied = applySourceEdits(sourceText, plan.ask.edits);
    const check = parseVisualFlowchartSource(applied.text);
    const notes = plan.notes.concat(surgEmptiedGroups(idx, applied.text));
    return { status: 'asked', message: plan.ask.message, confirmText: plan.ask.confirmText, text: applied.text, touched: applied.touched, plan, notes, roundTrip: visualModelsEquivalent(check, model) };
  }
  if (!plan.edits.length) return { status: 'noop', text: sourceText, plan, touched: { modified: [], removed: [], added: 0 }, notes: [] };
  const applied = applySourceEdits(sourceText, plan.edits);
  const check = parseVisualFlowchartSource(applied.text);
  if (!visualModelsEquivalent(check, model)) {
    // Tier 3: the surgical text does not re-parse to what the gesture meant. Never
    // write it. Offer the full rewrite and say what that costs.
    return { status: 'fallback', reason: check.compatible ? 'round-trip mismatch' : check.error, text: null, attempted: applied.text, plan, touched: applied.touched, check };
  }
  const notes = plan.notes.concat(surgEmptiedGroups(idx, applied.text));
  return { status: notes.length ? 'noted' : 'written', text: applied.text, plan, touched: applied.touched, notes };
}
