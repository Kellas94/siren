import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, SMALL

NL = 'String.fromCharCode(10)'
PORT = int(sys.argv[1])
TAG = sys.argv[2]
OUT = sys.argv[3]

BLUR = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.body.focus();
  await sleep(300);
  const ae = document.activeElement;
  return {active: ae ? (ae.className||ae.id||ae.tagName) : null,
          inRows: !!(ae && document.querySelector('#structureRows') && document.querySelector('#structureRows').contains(ae))};
})()"""

FOCUS_CHIP = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const idx = %d;
  const chip = rows[idx] ? rows[idx].querySelector('.struct-token') : null;
  if (!chip) return {err:'no chip', nrows: rows.length};
  chip.focus();
  await sleep(300);
  const ae = document.activeElement;
  return {rowIndex: idx, rowText: rows[idx].textContent.trim().slice(0,60),
          focused: ae === chip, active: ae ? (ae.className||ae.id||ae.tagName) : null,
          chipText: chip.textContent.trim()};
})()"""

RESEED = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const s = document.querySelector('#source');
  s.value = ['flowchart TD','    Z1["Reseeded one"]','    Z1 --> Z2["Reseeded two"]'].join(String.fromCharCode(10));
  s.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(3800);
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  return {sourceLines: s.value.split(String.fromCharCode(10)).length,
          rows: rows.length, firstRow: rows[0] ? rows[0].textContent.trim().slice(0,40) : null,
          rowsFollow: rows.length === 3};
})()"""

# proper drag: pointerdown on the gutter, moves and up on window
DRAG = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const src = rows[3], dst = rows[1];
  const g = src.querySelector('.struct-gutter') || src.querySelector('.struct-number');
  if (!g) return {err:'no gutter', kids: Array.from(src.children).map(c=>c.className)};
  const before = document.querySelector('#source').value.split(String.fromCharCode(10));
  const a = g.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const ev = (t, type, x, y, btn) => t.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true,
      clientX:x, clientY:y, pointerId:11, pointerType:'mouse', buttons:(btn===undefined?1:btn), isPrimary:true}));
  ev(g, 'pointerdown', a.x + a.width/2, a.y + a.height/2);
  await sleep(150);
  ev(window, 'pointermove', a.x + a.width/2, a.y + a.height/2 - 12);
  await sleep(150);
  ev(window, 'pointermove', b.x + b.width/2, b.y + b.height/2);
  await sleep(250);
  ev(window, 'pointermove', b.x + b.width/2, b.y + 2);
  await sleep(250);
  ev(window, 'pointerup', b.x + b.width/2, b.y + 2, 0);
  await sleep(1200);
  const after = document.querySelector('#source').value.split(String.fromCharCode(10));
  return {gutterClass: g.className, gutterInFloat: f.contains(g),
          before: before.slice(1), after: after.slice(1), moved: before.join('|') !== after.join('|')};
})()"""

ALT = """(async (dir) => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const row = rows[2];
  const chip = row.querySelector('.struct-token');
  chip.focus();
  await sleep(250);
  const focusedOk = document.activeElement === chip;
  const before = document.querySelector('#source').value.split(String.fromCharCode(10));
  chip.dispatchEvent(new KeyboardEvent('keydown', {key:dir, altKey:true, bubbles:true, cancelable:true}));
  await sleep(1000);
  const after = document.querySelector('#source').value.split(String.fromCharCode(10));
  const ae = document.activeElement;
  return {dir: dir, focusedOk: focusedOk, chipText: chip.textContent.trim(),
          before: before, after: after, changed: before.join('|') !== after.join('|'),
          focusInFloat: !!(f && ae && f.contains(ae)), active: ae ? (ae.className||ae.id) : null};
})(%s)"""

UNDO = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const before = document.querySelector('#source').value;
  document.querySelector('#popoutUndoButton').click();
  await sleep(1400);
  const mid = document.querySelector('#source').value;
  const midRows = document.querySelectorAll('#structureRows .struct-code').length;
  document.querySelector('#popoutRedoButton').click();
  await sleep(1400);
  const after = document.querySelector('#source').value;
  return {undoChanged: mid !== before, redoRestored: after === before,
          midRows: midRows, midLines: mid.split(String.fromCharCode(10)).length,
          rowsMatchMid: midRows === mid.split(String.fromCharCode(10)).length,
          afterRows: document.querySelectorAll('#structureRows .struct-code').length,
          afterLines: after.split(String.fromCharCode(10)).length};
})()"""

EMPTY = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  await sleep(200);
  const s = document.querySelector('#source');
  s.value = ''; s.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(3600);
  const rowsEl = document.querySelector('#structureRows');
  const btn = rowsEl.querySelector('button');
  const out = {rowsText: rowsEl.textContent.replace(/\\s+/g,' ').trim().slice(0,120),
               btnLabel: btn ? btn.textContent.trim() : null,
               btnInFloat: !!(btn && f.contains(btn)),
               codeRows: rowsEl.querySelectorAll('.struct-code').length};
  if (btn) { btn.click(); await sleep(2600);
    out.afterClick = document.querySelector('#source').value.replace(/\\n/g, '\\\\n');
    out.popoutOpen = !f.hidden;
    out.rowsAfter = document.querySelectorAll('#structureRows .struct-code').length; }
  return out;
})()"""

GUTTER = """(() => {
  const t = document.querySelector('#source');
  const g = document.querySelector('.line-numbers');
  if (!g) return {err:'no gutter'};
  const cs = getComputedStyle(t);
  const mirror = document.createElement('div');
  mirror.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;';
  mirror.style.width = (t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
  mirror.style.font = cs.font; mirror.style.lineHeight = cs.lineHeight;
  mirror.style.whiteSpace = cs.whiteSpace; mirror.style.overflowWrap = cs.overflowWrap;
  mirror.style.tabSize = cs.tabSize;
  document.body.appendChild(mirror);
  const lines = t.value.split(String.fromCharCode(10));
  const nums = Array.from(g.querySelectorAll('.line-number'));
  let y = 0; let maxDrift = 0; let base = null; const per = [];
  for (let i = 0; i < lines.length; i++) {
    const d = document.createElement('div'); d.textContent = lines[i] || ' '; mirror.appendChild(d);
    const h = d.getBoundingClientRect().height;
    if (nums[i]) {
      const nTop = nums[i].getBoundingClientRect().top;
      if (base === null) base = nTop - y;
      const drift = Math.abs((nTop - base) - y);
      per.push(Math.round(drift*100)/100);
      if (drift > maxDrift) maxDrift = drift;
    }
    y += h;
  }
  const out = {lines: lines.length, numbers: nums.length, maxDrift: Math.round(maxDrift*100)/100,
               perLine: per, textareaScrollHeight: t.scrollHeight, gutterScrollHeight: g.scrollHeight,
               mirrorHeight: Math.round(y), whiteSpace: cs.whiteSpace,
               scrollWidth: t.scrollWidth, clientWidth: t.clientWidth};
  mirror.remove();
  return out;
})()"""

LONG = ['flowchart TD',
        '    A["' + ('Supracontrolulraportuluifinanciarconsolidat' * 4) + '"]',
        '',
        '    A --> B["Short"]',
        '    B --> C["' + ('x' * 187) + '"]']

DIAGSWITCH = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const add = document.querySelector('#addDiagramButton');
  if (add) { add.click(); await sleep(2600); }
  const sel = f.querySelector('.popout-diagram');
  const before = document.querySelector('#source').value.split(String.fromCharCode(10)).length;
  if (!sel) return {err:'no picker'};
  const opts = Array.from(sel.options).map(o=>o.value);
  sel.value = opts[0]; sel.dispatchEvent(new Event('change', {bubbles:true}));
  await sleep(2600);
  const rows = document.querySelectorAll('#structureRows .struct-code').length;
  const lines = document.querySelector('#source').value.split(String.fromCharCode(10)).length;
  return {options: opts.length, beforeLines: before, lines: lines, rows: rows,
          rowsMatch: rows === lines, rowsInFloat: f.contains(document.querySelector('#structureRows')),
          popoutOpen: !f.hidden};
})()"""

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "N01_boot"})
S.append({"js": seed(SMALL), "name": "N02_seed"})
S.append({"js": GUIDED, "name": "N03_guided_docked"})
S.append({"js": BLUR, "name": "N04_blur"})
S.append({"js": RESEED, "name": "N05_reseed_no_focus"})
S.append({"js": seed(SMALL), "name": "N06_seed_back"})
S.append({"js": FOCUS_CHIP % 2, "name": "N07_focus_chip"})
S.append({"js": RESEED, "name": "N08_reseed_with_chip_focus"})
S.append({"js": seed(SMALL), "name": "N09_seed_back"})

if TAG == 'patched':
    S.append({"js": BLUR, "name": "N10_blur"})
    S.append({"js": OPEN, "name": "N11_open"})
    S.append({"js": ALT % json.dumps('ArrowUp'), "name": "N12_alt_up"})
    S.append({"js": ALT % json.dumps('ArrowDown'), "name": "N13_alt_down"})
    S.append({"js": seed(SMALL), "name": "N14_seed_back"})
    S.append({"js": DRAG, "name": "N15_drag"})
    S.append({"js": seed(SMALL), "name": "N16_seed_back"})
    S.append({"js": FOCUS_CHIP % 1, "name": "N17_focus_chip"})
    S.append({"js": UNDO, "name": "N18_undo_redo_with_chip_focus"})
    S.append({"js": EMPTY, "name": "N19_empty_diagram"})
    S.append({"shot": "n19_empty_float.png"})
    S.append({"js": seed(LONG, 4200), "name": "N20_seed_long"})
    S.append({"js": TEXT, "name": "N21_text"})
    S.append({"js": GUTTER, "name": "N22_gutter_float_long"})
    S.append({"shot": "n22_gutter_float.png"})
    S.append({"js": DIAGSWITCH, "name": "N23_diagram_switch"})
    S.append({"js": STATE, "name": "N24_state"})

json.dump(S, open(OUT, 'w'), indent=1)
print(len(S))
