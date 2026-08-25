import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, SMALL

NL = 'String.fromCharCode(10)'

# drag: every event goes to an element inside #structureRows, because that is the host
# the drag listeners are attached to.
DRAG = """(async (from_, to_) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const host = document.querySelector('#structureRows');
  const rows = Array.from(host.querySelectorAll('.struct-code'));
  const src = rows[from_], dst = rows[to_];
  const g = src.querySelector('.struct-gutter');
  const before = document.querySelector('#source').value.split(String.fromCharCode(10));
  const a = g.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const ev = (t, type, x, y, btn) => t.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true,
      clientX:x, clientY:y, pointerId:21, pointerType:'mouse', button:0,
      buttons:(btn===undefined?1:btn), isPrimary:true}));
  ev(g, 'pointerdown', a.x + a.width/2, a.y + a.height/2);
  await sleep(120);
  ev(src, 'pointermove', a.x + a.width/2, a.y + a.height/2 + 10);
  await sleep(120);
  ev(dst, 'pointermove', b.x + b.width/2, b.y + b.height/2);
  await sleep(220);
  ev(dst, 'pointermove', b.x + b.width/2, b.y + 2);
  await sleep(220);
  ev(dst, 'pointerup', b.x + b.width/2, b.y + 2, 0);
  await sleep(1200);
  const after = document.querySelector('#source').value.split(String.fromCharCode(10));
  return {gutterInFloat: f.contains(g), from: from_, to: to_,
          before: before, after: after, moved: before.join('|') !== after.join('|')};
})(%d, %d)"""

FOCUS = """(async (idx) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const chip = rows[idx].querySelector('.struct-token[tabindex]') || rows[idx].querySelector('[tabindex]');
  if (!chip) return {err:'no focusable chip', html: rows[idx].innerHTML.slice(0,300)};
  chip.focus();
  await sleep(300);
  return {idx: idx, focused: document.activeElement === chip, chipText: chip.textContent.trim(),
          rowText: rows[idx].textContent.trim().slice(0,60),
          inFloat: !!document.querySelector('#editorPopout').contains(document.activeElement)};
})(%d)"""

ALT = """(async (dir) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const ae = document.activeElement;
  const before = document.querySelector('#source').value.split(String.fromCharCode(10));
  ae.dispatchEvent(new KeyboardEvent('keydown', {key:dir, altKey:true, bubbles:true, cancelable:true}));
  await sleep(1000);
  const now = document.activeElement;
  return {dir: dir, before: before, after: document.querySelector('#source').value.split(String.fromCharCode(10)),
          focusInFloat: !!(f && now && f.contains(now)), active: now ? (now.className||now.id) : null};
})(%s)"""

DIAGSWITCH = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const sel = f.querySelector('.popout-diagram');
  if (!sel) return {err:'no picker'};
  const opts = Array.from(sel.options).map(o=>o.value);
  const cur = sel.value;
  const other = opts.find(o => o !== cur);
  if (!other) return {err:'only one diagram', opts: opts.length};
  sel.value = other; sel.dispatchEvent(new Event('change', {bubbles:true}));
  await sleep(3000);
  const lines = document.querySelector('#source').value.split(String.fromCharCode(10));
  const rows = document.querySelectorAll('#structureRows .struct-code').length;
  return {switchedTo: other, lines: lines.length, rows: rows, rowsMatch: rows === lines,
          isGuided: f.classList.contains('is-guided'),
          rowsInFloat: f.contains(document.querySelector('#structureRows')),
          popoutOpen: !f.hidden, firstLine: lines[0]};
})()"""

ADD_DIAGRAM = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = document.querySelector('#addDiagramButton');
  if (!b) return {err:'no add button'};
  b.click();
  await sleep(3000);
  document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} });
  await sleep(400);
  return {lines: document.querySelector('#source').value.split(String.fromCharCode(10)).length,
          popoutOpen: !document.querySelector('#editorPopout').hidden};
})()"""

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "P01_boot"})
S.append({"js": seed(SMALL), "name": "P02_seed"})
S.append({"js": OPEN, "name": "P03_open"})
S.append({"js": GUIDED, "name": "P04_guided"})
S.append({"js": DRAG % (3, 1), "name": "P05_drag_row4_to_row2"})
S.append({"shot": "p05_after_drag.png"})
S.append({"js": seed(SMALL), "name": "P06_seed_back"})
S.append({"js": FOCUS % 2, "name": "P07_focus_row3"})
S.append({"js": ALT % json.dumps('ArrowUp'), "name": "P08_alt_up"})
S.append({"js": ALT % json.dumps('ArrowDown'), "name": "P09_alt_down"})
S.append({"js": ADD_DIAGRAM, "name": "P10_add_diagram"})
S.append({"js": STATE, "name": "P11_state_after_add"})
S.append({"js": DIAGSWITCH, "name": "P12_switch_back"})
S.append({"shot": "p12_after_switch.png"})
S.append({"js": TB, "name": "P13_tb"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_p1.json', 'w'), indent=1)
print(len(S))
