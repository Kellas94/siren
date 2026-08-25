import json, sys
sys.path.insert(0, r'C:\Claude\SIREN\pending\r5fix-popout')
from common import PORT, BOOT, STATE, TB, OPEN, GUIDED, TEXT, seed, SMALL

NL = 'String.fromCharCode(10)'

def L(n):
    return "document.querySelector('#source').value.split(%s)[%d]" % (NL, n)

# --- chip edit inside the float -------------------------------------------------
CHIP_EDIT = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const chip = Array.from(document.querySelectorAll('#structureRows .struct-token'))
                    .find(t => (t.textContent||'').trim() === 'State');
  if (!chip) return {err: 'no State chip'};
  const chipInFloat = f.contains(chip);
  chip.click();
  await sleep(500);
  const inp = document.querySelector('.struct-inline-input');
  const out = {chipInFloat: chipInFloat, inputFound: !!inp, inputInFloat: !!(inp && f.contains(inp))};
  if (!inp) return out;
  inp.value = 'Statul roman';
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
  await sleep(900);
  out.line1 = %s;
  out.popoutOpen = !f.hidden;
  out.rows = document.querySelectorAll('#structureRows .struct-code').length;
  return out;
})()""" % L(1)

# --- Escape while an inline input is open: cancels the edit, does not dock --------
ESC_IN_INPUT = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const before = document.querySelector('#source').value;
  const chip = Array.from(document.querySelectorAll('#structureRows .struct-token'))
                    .find(t => (t.textContent||'').trim() === 'Public Entity');
  if (!chip) return {err:'no chip'};
  chip.click();
  await sleep(450);
  const inp = document.querySelector('.struct-inline-input');
  if (!inp) return {err:'no input'};
  inp.value = 'THROWN AWAY';
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
  await sleep(700);
  return {popoutStillOpen: !f.hidden,
          sourceUnchanged: document.querySelector('#source').value === before,
          inputGone: !document.querySelector('.struct-inline-input')};
})()"""

# --- Alt+ArrowUp on a chip --------------------------------------------------------
ALT_UP = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const chip = rows[2].querySelector('.struct-token');
  chip.focus();
  const before = document.querySelector('#source').value.split(%s).slice(1,4);
  chip.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowUp', altKey:true, bubbles:true, cancelable:true}));
  await sleep(900);
  const ae = document.activeElement;
  return {before: before, after: document.querySelector('#source').value.split(%s).slice(1,4),
          focusInFloat: !!(ae && f.contains(ae)), active: ae ? (ae.className||ae.id||ae.tagName) : null};
})()""" % (NL, NL)

# --- drag a line by its gutter ----------------------------------------------------
DRAG = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const src = rows[3], dst = rows[1];
  const g = src.querySelector('.struct-gutter') || src.querySelector('.struct-number');
  if (!g) return {err: 'no gutter'};
  const before = document.querySelector('#source').value.split(%s);
  const a = g.getBoundingClientRect(), b = dst.getBoundingClientRect();
  const pd = (t,x,y,type) => t.dispatchEvent(new PointerEvent(type, {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:7, pointerType:'mouse', buttons:1, isPrimary:true}));
  pd(g, a.x+5, a.y+8, 'pointerdown');
  await sleep(120);
  pd(window.document, a.x+5, a.y-10, 'pointermove');
  await sleep(120);
  pd(window.document, b.x+5, b.y+4, 'pointermove');
  await sleep(200);
  pd(window.document, b.x+5, b.y+4, 'pointerup');
  await sleep(900);
  const after = document.querySelector('#source').value.split(%s);
  return {gutterInFloat: f.contains(g), before: before.slice(1), after: after.slice(1)};
})()""" % (NL, NL)

# --- right-click a line -----------------------------------------------------------
RCLICK = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const row = document.querySelectorAll('#structureRows .struct-code')[2];
  const r = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent('contextmenu', {bubbles:true, cancelable:true, clientX:r.x+60, clientY:r.y+8}));
  await sleep(700);
  const m = document.querySelector('.struct-menu');
  if (!m) return {menu:false};
  const mr = m.getBoundingClientRect();
  const fr = f.getBoundingClientRect();
  return {menu:true, items: Array.from(m.querySelectorAll('.struct-menu-item')).map(i=>i.textContent.trim()),
          z: getComputedStyle(m).zIndex, floatZ: getComputedStyle(f).zIndex,
          onScreen: mr.left>=0 && mr.top>=0 && mr.right<=innerWidth+1 && mr.bottom<=innerHeight+1,
          overFloat: mr.left < fr.right && mr.right > fr.left};
})()"""

ESC_MENU = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
  await sleep(600);
  return {menuGone: !document.querySelector('.struct-menu'), popoutOpen: !f.hidden};
})()"""

# --- Escape on a focused chip docks -----------------------------------------------
ESC_DOCK = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const chip = document.querySelector('#structureRows .struct-token');
  chip.focus();
  chip.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
  await sleep(900);
  const col = document.querySelector('#codeEditor').parentNode;
  const bar = document.querySelector('.layout-bar');
  return {popoutHidden: f.hidden,
          columnOrder: Array.from(col.children).map(e=>e.id||e.className).join(' | '),
          switchParent: document.querySelector('#editorModeSwitch').parentNode.className,
          switchBeforeHome: document.querySelector('#editorModeSwitch').nextElementSibling
                            ? document.querySelector('#editorModeSwitch').nextElementSibling.id : null,
          rows: document.querySelectorAll('#structureRows .struct-code').length,
          barOrder: bar ? Array.from(bar.children).map(e=>e.id||e.className).join(' | ') : null};
})()"""

DOCKED_CHIP = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const chip = Array.from(document.querySelectorAll('#structureRows .struct-token'))
                    .find(t => (t.textContent||'').trim() === 'Beneficiaries');
  if (!chip) return {err:'no chip', chips: Array.from(document.querySelectorAll('#structureRows .struct-token')).map(t=>t.textContent.trim())};
  chip.click();
  await sleep(450);
  const inp = document.querySelector('.struct-inline-input');
  if (!inp) return {err:'no input'};
  const inFloat = !!document.querySelector('#editorPopout').contains(inp);
  inp.value = 'Beneficiari';
  inp.dispatchEvent(new Event('input', {bubbles:true}));
  inp.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}));
  await sleep(900);
  return {inputInFloat: inFloat, src: document.querySelector('#source').value.split(%s).filter(l=>l.indexOf('Beneficiari')>=0)};
})()""" % NL

POP_WHILE_GUIDED = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#popOutEditorButton').click();
  await sleep(1000);
  const f = document.querySelector('#editorPopout');
  const ae = document.activeElement;
  return {popoutOpen: !f.hidden, isGuided: f.classList.contains('is-guided'),
          guidedPressed: document.querySelector('#structureModeButton').getAttribute('aria-pressed'),
          rowsInFloat: f.contains(document.querySelector('#structureRows')),
          focusInFloat: !!(f && ae && f.contains(ae)), active: ae ? (ae.className||ae.id||ae.tagName) : null};
})()"""

# --- wrap + gutter ----------------------------------------------------------------
WRAP = """(() => {
  const t = document.querySelector('#source');
  const cs = getComputedStyle(t);
  const f = document.querySelector('#editorPopout');
  return {where: f && f.contains(t) ? 'float' : 'column',
          whiteSpace: cs.whiteSpace, overflowWrap: cs.overflowWrap,
          scrollWidth: t.scrollWidth, clientWidth: t.clientWidth,
          wrapCheckbox: !!document.querySelector('#dockedWrapToggle'),
          popoutWrapToggle: !!document.querySelector('#popoutWrapToggle'),
          isWrappedClass: !!document.querySelector('.code-editor.is-wrapped'),
          ghosts: document.querySelectorAll('.line-ghost').length,
          numbers: document.querySelectorAll('.line-number').length};
})()"""

GUTTER_DRIFT = """(() => {
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
  const lh = parseFloat(cs.lineHeight);
  let y = 0; let maxDrift = 0; const nums = Array.from(g.querySelectorAll('.line-number'));
  const gTop = g.getBoundingClientRect().top;
  const tTop = t.getBoundingClientRect().top + parseFloat(cs.paddingTop);
  for (let i = 0; i < lines.length; i++) {
    const d = document.createElement('div'); d.textContent = lines[i] || ' '; mirror.appendChild(d);
    const h = d.getBoundingClientRect().height;
    if (nums[i]) {
      const nTop = nums[i].getBoundingClientRect().top - gTop;
      const drift = Math.abs(nTop - y);
      if (drift > maxDrift) maxDrift = drift;
    }
    y += h;
  }
  const out = {lines: lines.length, numbers: nums.length, maxDrift: Math.round(maxDrift*100)/100,
               textareaScrollHeight: t.scrollHeight, gutterScrollHeight: g.scrollHeight,
               mirrorHeight: Math.round(y)};
  mirror.remove();
  return out;
})()"""

MORE_MENU = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#popoutMoreButton').click();
  await sleep(700);
  const menus = Array.from(document.querySelectorAll('.structure-menu, .struct-menu, [role=menu], .popover, .menu'));
  const m = menus.filter(x => x.offsetParent || x.getBoundingClientRect().height > 0).pop();
  const txt = m ? m.textContent : '';
  return {found: !!m, hasWrap: /wrap/i.test(txt), text: txt.replace(/\\s+/g,' ').trim().slice(0,240)};
})()"""

CLOSE_MORE = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true, cancelable:true}));
  await sleep(500);
  return {popoutOpen: !document.querySelector('#editorPopout').hidden};
})()"""

READONLY = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  document.body.classList.add('read-only-mode');
  await sleep(500);
  const cs = getComputedStyle(f);
  const r = f.getBoundingClientRect();
  const pane = document.querySelector('.editor-pane');
  const pcs = pane ? getComputedStyle(pane) : null;
  const out = {floatAttrHidden: f.hidden, floatDisplay: cs.display, floatVisibility: cs.visibility,
               floatOpacity: cs.opacity, floatW: Math.round(r.width), floatH: Math.round(r.height),
               paneDisplay: pcs ? pcs.display : null,
               popOutButtonVisible: !!(document.querySelector('#popOutEditorButton') && document.querySelector('#popOutEditorButton').offsetParent)};
  document.body.classList.remove('read-only-mode');
  await sleep(300);
  return out;
})()"""

EMPTY = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const f = document.querySelector('#editorPopout');
  const s = document.querySelector('#source');
  s.value = ''; s.dispatchEvent(new Event('input', {bubbles:true}));
  await sleep(2600);
  const b = document.querySelector('#structureRows .struct-first-block, #structureRows .struct-empty button, #structureRows button');
  const out = {emptyUiInFloat: !!(b && f.contains(b)), label: b ? b.textContent.trim() : null,
               rowsHtml: (document.querySelector('#structureRows')||{}).textContent};
  if (b) { b.click(); await sleep(2200);
    out.afterClick = document.querySelector('#source').value;
    out.popoutOpen = !f.hidden;
    out.rows = document.querySelectorAll('#structureRows .struct-code').length; }
  return out;
})()"""

BENCH = []
BENCH.append('flowchart TD')
for i in range(1, 41):
    BENCH.append('    N%d["Control step %d"]' % (i, i))
for i in range(1, 40):
    BENCH.append('    N%d --> N%d' % (i, i + 1))

S = []
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 10000})
S.append({"js": BOOT, "name": "M01_boot"})
S.append({"js": seed(SMALL), "name": "M02_seed"})
S.append({"js": WRAP, "name": "M03_wrap_docked"})
S.append({"js": GUTTER_DRIFT, "name": "M04_gutter_docked"})
S.append({"js": OPEN, "name": "M05_open"})
S.append({"js": WRAP, "name": "M06_wrap_float"})
S.append({"js": GUTTER_DRIFT, "name": "M07_gutter_float"})
S.append({"js": MORE_MENU, "name": "M08_more_menu"})
S.append({"shot": "m08_more_menu.png"})
S.append({"js": CLOSE_MORE, "name": "M09_close_more"})
S.append({"js": GUIDED, "name": "M10_guided"})
S.append({"js": STATE, "name": "M11_state_float_guided"})
S.append({"shot": "m11_guided_float.png"})
S.append({"js": CHIP_EDIT, "name": "M12_chip_edit_in_float"})
S.append({"js": ALT_UP, "name": "M13_alt_up_in_float"})
S.append({"js": DRAG, "name": "M14_drag_in_float"})
S.append({"js": RCLICK, "name": "M15_rightclick_in_float"})
S.append({"shot": "m15_rowmenu.png"})
S.append({"js": ESC_MENU, "name": "M16_esc_closes_menu"})
S.append({"js": ESC_IN_INPUT, "name": "M17_esc_in_input_no_dock"})
S.append({"js": READONLY, "name": "M18_readonly_sim"})
S.append({"js": ESC_DOCK, "name": "M19_esc_docks"})
S.append({"shot": "m19_docked.png"})
S.append({"js": DOCKED_CHIP, "name": "M20_docked_chip_edit"})
S.append({"js": POP_WHILE_GUIDED, "name": "M21_pop_while_guided"})
S.append({"js": EMPTY, "name": "M22_empty_diagram"})
S.append({"js": seed(BENCH, 6000), "name": "M23_bench40"})
S.append({"js": STATE, "name": "M24_bench_state"})
S.append({"shot": "m24_bench_float.png"})
# reload on the same profile: mode must persist
S.append({"nav": "http://127.0.0.1:%d/app.html" % PORT, "wait": 11000})
S.append({"js": BOOT, "name": "M25_boot2"})
S.append({"js": STATE, "name": "M26_after_reload"})
S.append({"js": WRAP, "name": "M27_wrap_after_reload"})

json.dump(S, open(r'C:\Claude\SIREN\pending\r5fix-popout\steps_m1.json', 'w'), indent=1)
print(len(S))
