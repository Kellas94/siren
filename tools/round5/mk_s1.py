import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, setw, SMALL

LEGEND = """(() => {
  const f = document.querySelector('#editorPopout');
  const legend = document.querySelector('.editor-footer > span:first-child');
  const hint = document.querySelector('.struct-guide-hint');
  const vis = e => !!(e && e.offsetParent);
  return {legendText: legend ? legend.textContent.trim().slice(0,90) : null,
          legendVisible: vis(legend), legendInFloat: !!(legend && f.contains(legend)),
          hintText: hint ? hint.textContent.trim().slice(0,120) : null,
          hintVisible: vis(hint), hintInFloat: !!(hint && f.contains(hint)),
          floatFooter: (document.querySelector('#popoutFooter')||{}).textContent || null};
})()"""

# leading spaces + one unbreakable token: does the line's first visual row read empty?
LEAD = """(() => {
  const t = document.querySelector('#source');
  const g = document.querySelector('.line-numbers');
  const ghosts = Array.from(g.querySelectorAll('.line-ghost'));
  const nums = Array.from(g.querySelectorAll('.line-number'));
  const lines = t.value.split(String.fromCharCode(10));
  const cs = getComputedStyle(t);
  const lh = parseFloat(cs.lineHeight);
  return {whiteSpace: cs.whiteSpace, lineHeight: lh,
          rows: nums.map((n, i) => ({line: i + 1,
                 h: Math.round(n.getBoundingClientRect().height),
                 visualRows: Math.round(n.getBoundingClientRect().height / lh),
                 text: (lines[i]||'').slice(0, 28)}))};
})()"""

NARROW = """(async (px) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  f.style.width = px + 'px';
  await sleep(500);
  const tb = document.querySelector('#editorPopoutToolbar');
  const tr = tb.getBoundingClientRect();
  const kids = Array.from(tb.children).filter(k => k.offsetParent);
  const byRow = {};
  kids.forEach(k => { const y = Math.round(k.getBoundingClientRect().top / 8) * 8; (byRow[y] = byRow[y] || []).push(k.id || k.className); });
  const keys = Object.keys(byRow).sort((a,b)=>a-b);
  return {asked: px, floatW: Math.round(f.getBoundingClientRect().width),
          toolbarH: Math.round(tr.height), nRows: keys.length,
          rows: keys.map(y => y + ': ' + byRow[y].join(',')),
          clipped: kids.filter(k => { const b=k.getBoundingClientRect(); return b.right > tr.right + 1 || b.left < tr.left - 1; }).map(k=>k.id||k.className),
          rowsBox: (() => { const r = document.querySelector('#structureRows').getBoundingClientRect();
                            const fr = f.getBoundingClientRect();
                            return {inside: r.left >= fr.left - 1 && r.right <= fr.right + 1, w: Math.round(r.width)}; })()};
})(%d)"""

LEAD_SRC = ['flowchart TD',
            '    A["' + ('Q' * 190) + '"]',
            '    A --> B["Short label"]']

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "S01_boot"})
S.append({"js": seed(SMALL), "name": "S02_seed"})
S.append({"js": GUIDED, "name": "S03_guided_docked"})
S.append({"js": LEGEND, "name": "S04_legend_docked"})
S.append({"js": OPEN, "name": "S05_open"})
S.append({"js": LEGEND, "name": "S06_legend_in_float"})
S.append({"shot": "s06_float_guided.png"})
for w in (400, 360, 320, 300):
    S.append({"js": NARROW % w, "name": "S07_narrow_%d" % w})
S.append({"shot": "s07_narrow_300.png"})
S.append({"js": NARROW % 760, "name": "S08_back_760"})
S.append({"js": TEXT, "name": "S09_text"})
S.append({"js": seed(LEAD_SRC, 4200), "name": "S10_seed_lead"})
S.append({"js": LEAD, "name": "S11_leading_space_rows"})
S.append({"shot": "s11_leading_space.png"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_s1.json', 'w'), indent=1)
print(len(S))
