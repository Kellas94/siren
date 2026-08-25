import json
PORT = 9994
NL = 'String.fromCharCode(10)'

BOOT = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i=0;i<60;i++){ if (document.querySelector('#source')) break; await sleep(150); }
  document.body.click();
  await sleep(500);
  const c = document.querySelector('.tour-card');
  if (c) { const b = Array.from(c.querySelectorAll('button')); const s = b.find(x=>/skip|done|close|finish|got it|end/i.test(x.textContent||''))||b[0]; if (s) s.click(); }
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  await sleep(400);
  const cm = document.querySelector('#codeModeButton'); if (cm) cm.click();
  await sleep(500);
  return {ok:1};
})()"""

STATE = """(() => {
  const q = s => document.querySelector(s);
  const f = q('#editorPopout');
  const inFloat = sel => { const e = q(sel); return e ? (f && f.contains(e) ? 'float' : (document.contains(e)?'column':'detached')) : 'missing'; };
  const r = s => { const e=q(s); if(!e) return null; const b=e.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
  const ae = document.activeElement;
  return {
    popoutHidden: f ? f.hidden : 'no-float',
    isGuided: f ? f.classList.contains('is-guided') : null,
    switchAt: inFloat('#editorModeSwitch'), structAt: inFloat('#structureEditor'), codeAt: inFloat('#codeEditor'),
    structHidden: q('#structureEditor').hidden, codeHidden: q('#codeEditor').hidden,
    guidedPressed: q('#structureModeButton') ? q('#structureModeButton').getAttribute('aria-pressed') : null,
    rows: q('#structureRows') ? q('#structureRows').querySelectorAll('.struct-code').length : -1,
    rowsRect: r('#structureRows'), floatRect: r('#editorPopout'), switchRect: r('#editorModeSwitch'),
    wrapCheckbox: !!q('#dockedWrapToggle'),
    active: ae ? (ae.id || ae.className || ae.tagName) : null,
    activeInFloat: !!(f && ae && f.contains(ae)),
    columnOrder: Array.from(q('#codeEditor').parentNode.children).map(e=>e.id||e.className).join(' | '),
    toolbar: Array.from(document.querySelectorAll('#editorPopoutToolbar > *')).map(e => (e.id||e.className) + ':' + (e.offsetParent ? Math.round(e.getBoundingClientRect().height) : 'hidden')),
    toolbarRect: r('#editorPopoutToolbar'),
    src2: (q('#source').value.split(String.fromCharCode(10))[1] || '')
  };
})()"""

# Toolbar geometry: how many visual rows, and which control sits on each.
TB = """(() => {
  const f = document.querySelector('#editorPopout');
  const tb = document.querySelector('#editorPopoutToolbar');
  if (!f || !tb) return {missing:1};
  const fr = f.getBoundingClientRect(); const tr = tb.getBoundingClientRect();
  const kids = Array.from(tb.children).filter(k => k.offsetParent);
  const byRow = {};
  kids.forEach(k => { const t = Math.round(k.getBoundingClientRect().top / 8) * 8; (byRow[t] = byRow[t] || []).push(k.id || k.className); });
  const rows = Object.keys(byRow).sort((a,b)=>a-b).map(t => t + ': ' + byRow[t].join(','));
  const brk = tb.querySelector('.popout-break');
  return {hidden: f.hidden, floatW: Math.round(fr.width), toolbarH: Math.round(tr.height),
          nRows: rows.length, rows: rows,
          breakDisplay: brk ? getComputedStyle(brk).display : 'none-el',
          clipped: kids.filter(k => { const b=k.getBoundingClientRect(); return b.right > tr.right + 1 || b.left < tr.left - 1; }).map(k=>k.id||k.className),
          guided: f.classList.contains('is-guided'), vw: innerWidth};
})()"""

OPEN = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#popOutEditorButton').click();
  await sleep(900);
  return {hidden: document.querySelector('#editorPopout').hidden};
})()"""

GUIDED = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#structureModeButton').click();
  await sleep(800);
  return {guided: document.querySelector('#editorPopout').classList.contains('is-guided'),
          rows: document.querySelectorAll('#structureRows .struct-code').length};
})()"""

TEXT = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#textModeButton').click();
  await sleep(800);
  return {guided: document.querySelector('#editorPopout').classList.contains('is-guided')};
})()"""


def setw(px):
    return """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  f.style.width = '%dpx';
  await sleep(450);
  const tb = document.querySelector('#editorPopoutToolbar');
  const kids = Array.from(tb.children).filter(k => k.offsetParent);
  const byRow = {};
  kids.forEach(k => { const t = Math.round(k.getBoundingClientRect().top / 8) * 8; (byRow[t] = byRow[t] || []).push(k.id || k.className); });
  const rows = Object.keys(byRow).sort((a,b)=>a-b);
  return {w: %d, floatW: Math.round(f.getBoundingClientRect().width),
          toolbarH: Math.round(tb.getBoundingClientRect().height), nRows: rows.length,
          rows: rows.map(t => t + ': ' + byRow[t].join(','))};
})()""" % (px, px)


def seed(lines, wait=3600):
    src = "[" + ",".join(json.dumps(l) for l in lines) + "].join(" + NL + ")"
    return """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const s = document.querySelector('#source');
  s.value = %s;
  s.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(%d);
  return {lines: s.value.split(%s).length};
})()""" % (src, wait, NL)


SMALL = [
  "flowchart TD",
  "    A[State] --> B[Ministry of Finance]",
  "    B -->|ownership| C[Public Entity]",
  "    C --> D[Beneficiaries]",
  "    C --> E[Financial statements]",
]
