import json, sys, io

# argv: <out steps path> <page filename served> <tag>
OUT = sys.argv[1]
PAGE = sys.argv[2]
TAG = sys.argv[3]
PORT = '9992'

NL = "String.fromCharCode(10)"

BOOT = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 24; i++) {
    document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch (e) {} });
    const card = document.querySelector('.tour-card');
    if (card) { const b = card.querySelector('button'); if (b) b.click(); }
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await sleep(150);
    if (!document.querySelector('.tour-card') && !document.querySelectorAll('dialog[open]').length) break;
  }
  await sleep(400);
  return { href: location.href, tour: !!document.querySelector('.tour-card'), dialogs: document.querySelectorAll('dialog[open]').length };
})()"""

SEED = """(() => {
  const lines = ['flowchart TD', '  A[Receive invoice] --> B{Approved?}', '  B -->|Yes| C[Post to ledger]', '  B -->|No| D[Return to sender]'];
  const s = document.getElementById('source');
  s.value = lines.join(""" + NL + """);
  s.dispatchEvent(new Event('input', { bubbles: true }));
  return s.value.length;
})()"""


def theme_js(light, accent):
    return """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const sel = document.getElementById('themePreset');
  if (sel.value !== 'cupertino') { sel.value = 'cupertino'; sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(1400); }
  const bar = document.getElementById('cupertinoFinishBar');
  bar.querySelector('[data-cupertino-light="%s"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(500);
  bar.querySelector('[data-cupertino-accent="%s"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(1800);
  return { href: location.href, theme: document.body.dataset.theme, variant: document.body.dataset.cupertinoVariant };
})()""" % (light, accent)


def open_js(node_index):
    return """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'no svg';
  const nodes = Array.from(svg.querySelectorAll('g.node'));
  const node = nodes[%d];
  if (!node) return 'no node';
  const r = node.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  const ev = (t, id, x, y) => new PointerEvent(t, { bubbles: true, cancelable: true, composed: true, pointerId: id, pointerType: 'mouse', button: 0, buttons: t === 'pointerup' ? 0 : 1, clientX: x, clientY: y });
  node.dispatchEvent(ev('pointerdown', 1, cx, cy));
  window.dispatchEvent(ev('pointerup', 1, cx, cy));
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }));
  await sleep(500);
  let h = null;
  for (let i = 0; i < 24; i++) { h = document.querySelector('#diagram [data-handle-for][data-role="fwd"]'); if (h) break; await sleep(150); }
  if (!h) return 'no handle';
  const hr = h.getBoundingClientRect();
  const hx = Math.round(hr.left + hr.width / 2), hy = Math.round(hr.top + hr.height / 2);
  h.dispatchEvent(ev('pointerdown', 2, hx, hy));
  await sleep(80);
  window.dispatchEvent(ev('pointerup', 2, hx, hy));
  await sleep(600);
  const pop = document.getElementById('canvasPopover');
  const pr = pop ? pop.getBoundingClientRect() : null;
  return { node: %d, open: !!(pop && !pop.hidden), rect: pr ? { x: Math.round(pr.left), y: Math.round(pr.top), w: Math.round(pr.width), h: Math.round(pr.height) } : null };
})()""" % (node_index, node_index)


MEASURE = """(() => {
  const box = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const read = e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, borderColor: c.borderTopColor, backdrop: c.backdropFilter || c.webkitBackdropFilter || 'none', rect: box(e) }; };
  const pop = document.getElementById('canvasPopover');
  if (!pop || pop.hidden) return 'popover closed';
  const chips = Array.from(pop.querySelectorAll('.canvas-chip'));
  const sel = chips.find(c => c.getAttribute('aria-pressed') === 'true');
  const plain = chips.find(c => c.getAttribute('aria-pressed') !== 'true');
  const inp = pop.querySelector('#canvasPopLabel');
  const hint = pop.querySelector('.canvas-pop-hint');
  const cs = getComputedStyle(document.body);
  return {
    href: location.href,
    variant: document.body.dataset.cupertinoVariant,
    theme: document.body.dataset.theme,
    tokens: { floatBg: cs.getPropertyValue('--ui-float-bg').trim(), panelElevated: cs.getPropertyValue('--panel-elevated').trim(), muted: cs.getPropertyValue('--muted').trim(), text: cs.getPropertyValue('--text').trim(), primary: cs.getPropertyValue('--primary').trim() },
    popover: read(pop),
    chipSelected: sel ? read(sel) : null,
    chipPlain: plain ? read(plain) : null,
    input: inp ? read(inp) : null,
    hintText: hint ? read(hint) : null
  };
})()"""

# The see-through test the verifier used: hide the diagram viewport WITHOUT moving the
# popover, so any pixel that changes inside the popover rect was the diagram showing
# through. Run: shot, HIDE, shot, SHOW.
HIDE = """(() => {
  let st = document.getElementById('__glassHide');
  if (!st) { st = document.createElement('style'); st.id = '__glassHide'; document.head.appendChild(st); }
  st.textContent = '#zoomViewport{visibility:hidden !important;}';
  return 'hidden';
})()"""
SHOW = """(() => { const st = document.getElementById('__glassHide'); if (st) st.textContent = ''; return 'shown'; })()"""

CLOSE_POP = """(() => { const p = document.getElementById('canvasPopover'); if (p && !p.hidden) p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'closed'; })()"""

INPLACE = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = document.querySelector('#diagram svg');
  const node = svg ? svg.querySelectorAll('g.node')[0] : null;
  if (!node) return 'no node';
  const r = node.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
  await sleep(700);
  const inp = document.getElementById('canvasInplace');
  if (!inp || inp.hidden) return 'inplace not open';
  const c = getComputedStyle(inp);
  const b = inp.getBoundingClientRect();
  return { bg: c.backgroundColor, color: c.color, borderColor: c.borderTopColor, backdrop: c.backdropFilter || 'none', rect: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } };
})()"""

CLOSE_INPLACE = """(() => { const i = document.getElementById('canvasInplace'); if (i && !i.hidden) { i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } return 'closed'; })()"""

# THE DEFECT REPRO. Open the structure menu for real from #moreShapesButton and read
# the current row (aria-selected) exactly as it opens - the app focuses that row, so
# it also wears the :focus-visible accent wash. Report both states.
MENU = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = document.getElementById('moreShapesButton');
  if (!b) return 'no button';
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(700);
  const menu = document.querySelector('.struct-menu');
  if (!menu) return 'no menu';
  const box = e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const read = e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, color: c.color, borderColor: c.borderTopColor, backdrop: c.backdropFilter || c.webkitBackdropFilter || 'none', weight: c.fontWeight, rect: box(e) }; };
  const rows = Array.from(menu.querySelectorAll('.struct-menu-item'));
  const sel = rows.find(r => r.getAttribute('aria-selected') === 'true');
  const plain = rows.find(r => r.getAttribute('aria-selected') !== 'true');
  const cs = getComputedStyle(document.body);
  return {
    href: location.href,
    variant: document.body.dataset.cupertinoVariant,
    tokens: { text: cs.getPropertyValue('--text').trim(), primary: cs.getPropertyValue('--primary').trim(), floatBg: cs.getPropertyValue('--ui-float-bg').trim() },
    menu: read(menu),
    rows: rows.length,
    selectedText: sel ? sel.textContent.trim().slice(0, 40) : null,
    selected: sel ? read(sel) : null,
    selectedFocused: sel ? (document.activeElement === sel) : null,
    selectedFocusVisible: sel ? sel.matches(':focus-visible') : null,
    plainText: plain ? plain.textContent.trim().slice(0, 40) : null,
    plain: plain ? read(plain) : null
  };
})()"""

CLOSE_MENU = """(() => { const m = document.querySelector('.struct-menu'); if (m) { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); m.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); } document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 'closed ' + !!document.querySelector('.struct-menu'); })()"""

# 1.63.6 added a right-click menu on a block with add-step rows. It is the same
# .struct-menu primitive, so it is checked too.
BLOCKMENU = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = document.querySelector('#diagram svg');
  const node = svg ? svg.querySelectorAll('g.node')[0] : null;
  if (!node) return 'no node';
  const r = node.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  node.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 2 }));
  await sleep(700);
  const menu = document.querySelector('.struct-menu');
  if (!menu) return 'no block menu';
  const c = getComputedStyle(menu);
  const b = menu.getBoundingClientRect();
  const rows = Array.from(menu.querySelectorAll('.struct-menu-item'));
  const sel = rows.find(x => x.getAttribute('aria-selected') === 'true');
  return { bg: c.backgroundColor, borderColor: c.borderTopColor, backdrop: c.backdropFilter || 'none', rows: rows.length, hasSelected: !!sel, selColor: sel ? getComputedStyle(sel).color : null, rect: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } };
})()"""

steps = [
    {"nav": "http://127.0.0.1:" + PORT + "/" + PAGE, "wait": 5000},
    {"js": BOOT, "name": "boot"},
    {"js": SEED, "name": "seed"},
    {"wait": 4000},
]

for light in ('day', 'night'):
    for accent in ('blue', 'green'):
        v = light + '-' + accent
        steps.append({"js": theme_js(light, accent), "name": "theme " + v})
        steps.append({"wait": 2500})
        # popover over the decision diamond: the owner's photo
        steps.append({"js": open_js(0), "name": "open " + v + " overNode"})
        steps.append({"wait": 600})
        steps.append({"js": MEASURE, "name": "measure " + v})
        steps.append({"shot": TAG + "_pop_" + v + ".png"})
        steps.append({"js": HIDE, "name": "hide viewport " + v})
        steps.append({"wait": 400})
        steps.append({"shot": TAG + "_pophidden_" + v + ".png"})
        steps.append({"js": SHOW, "name": "show viewport " + v})
        steps.append({"wait": 300})
        steps.append({"js": CLOSE_POP, "name": "close pop " + v})
        steps.append({"wait": 600})
        # rename in place
        steps.append({"js": INPLACE, "name": "inplace " + v})
        steps.append({"shot": TAG + "_inplace_" + v + ".png"})
        steps.append({"js": CLOSE_INPLACE, "name": "close inplace " + v})
        steps.append({"wait": 800})
        # THE DEFECT: the structure menu's current row
        steps.append({"js": MENU, "name": "menu " + v})
        steps.append({"wait": 300})
        steps.append({"shot": TAG + "_menu_" + v + ".png"})
        steps.append({"js": CLOSE_MENU, "name": "close menu " + v})
        steps.append({"wait": 700})
        # the 1.63.6 block right-click menu, same primitive
        steps.append({"js": BLOCKMENU, "name": "blockmenu " + v})
        steps.append({"shot": TAG + "_blockmenu_" + v + ".png"})
        steps.append({"js": CLOSE_MENU, "name": "close blockmenu " + v})
        steps.append({"wait": 700})

steps.append({"js": "(()=>({done:true,href:location.href}))()", "name": "end"})

io.open(OUT, 'w', encoding='utf-8', newline='').write(json.dumps(steps, indent=1))
print('wrote', OUT, len(steps), 'steps')
