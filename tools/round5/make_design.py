import json, sys, io

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
  return { href: location.href };
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
  return { theme: document.body.dataset.theme, variant: document.body.dataset.cupertinoVariant };
})()""" % (light, accent)


# The theme menu is round-4's region. Measure the mismatch the verifier reports rather
# than argue about it: open the real theme menu and read its surface.
THEMEMENU = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const btn = document.querySelector('#themeMenuButton, [data-theme-menu], .theme-menu-button') || Array.from(document.querySelectorAll('button')).find(b => /theme/i.test(b.id || ''));
  if (!btn) return 'no theme button: ' + Array.from(document.querySelectorAll('button')).map(b => b.id).filter(Boolean).slice(0, 40).join(',');
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(800);
  const m = document.querySelector('.theme-menu');
  if (!m) return 'no theme menu';
  const c = getComputedStyle(m); const r = m.getBoundingClientRect();
  return { bg: c.backgroundColor, backdrop: c.backdropFilter || 'none', border: c.borderTopColor, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
})()"""

CLOSE = """(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 'esc'; })()"""

# Park the move ghost over another block's ink and hold it there, then measure.
GHOST = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'no svg';
  const nodes = Array.from(svg.querySelectorAll('g.node'));
  const src = nodes[0], dst = nodes[1];
  if (!src || !dst) return 'no nodes';
  const sr = src.getBoundingClientRect(), dr = dst.getBoundingClientRect();
  const ev = (t, x, y, b) => new PointerEvent(t, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: b, clientX: x, clientY: y });
  const sx = Math.round(sr.left + sr.width / 2), sy = Math.round(sr.top + sr.height / 2);
  src.dispatchEvent(ev('pointerdown', sx, sy, 1));
  window.dispatchEvent(ev('pointerup', sx, sy, 0));
  src.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: sx, clientY: sy }));
  await sleep(500);
  let h = null;
  for (let i = 0; i < 24; i++) { h = document.querySelector('#diagram [data-handle-for][data-role="fwd"]'); if (h) break; await sleep(150); }
  if (!h) return 'no handle';
  const hr = h.getBoundingClientRect();
  h.dispatchEvent(ev('pointerdown', Math.round(hr.left + hr.width / 2), Math.round(hr.top + hr.height / 2), 1));
  await sleep(120);
  const tx = Math.round(dr.left + dr.width / 2), ty = Math.round(dr.top + dr.height / 2);
  for (let i = 1; i <= 6; i++) {
    window.dispatchEvent(ev('pointermove', Math.round(hr.left + (tx - hr.left) * i / 6), Math.round(hr.top + (ty - hr.top) * i / 6), 1));
    await sleep(70);
  }
  await sleep(300);
  const g = document.querySelector('.canvas-move-ghost');
  if (!g) return 'no ghost';
  const c = getComputedStyle(g); const r = g.getBoundingClientRect();
  return { bg: c.backgroundColor, color: c.color, backdrop: c.backdropFilter || 'none', border: c.borderTopColor, text: g.textContent.trim().slice(0, 40), rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
})()"""

DROPCANCEL = """(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: 5, clientY: 5 })); return 'cancelled'; })()"""

steps = [
    {"nav": "http://127.0.0.1:" + PORT + "/" + PAGE, "wait": 5000},
    {"js": BOOT, "name": "boot"},
    {"js": SEED, "name": "seed"},
    {"wait": 4000},
]
for light, accent in (('day', 'blue'), ('night', 'green')):
    v = light + '-' + accent
    steps.append({"js": theme_js(light, accent), "name": "theme " + v})
    steps.append({"wait": 2000})
    steps.append({"js": THEMEMENU, "name": "thememenu " + v})
    steps.append({"shot": TAG + "_thememenu_" + v + ".png"})
    steps.append({"js": CLOSE, "name": "close " + v})
    steps.append({"wait": 800})
    steps.append({"js": GHOST, "name": "ghost " + v})
    steps.append({"shot": TAG + "_ghost_" + v + ".png"})
    steps.append({"js": DROPCANCEL, "name": "cancel " + v})
    steps.append({"wait": 900})
steps.append({"js": "(()=>({done:true,href:location.href}))()", "name": "end"})

io.open(OUT, 'w', encoding='utf-8', newline='').write(json.dumps(steps, indent=1))
print('wrote', OUT, len(steps))
