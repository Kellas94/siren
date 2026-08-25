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
  return { variant: document.body.dataset.cupertinoVariant };
})()""" % (light, accent)

# Open the menu, then walk focus one row down so the current row loses the accent wash.
# That is the state the verifier called "unfocused".
UNFOCUS = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const b = document.getElementById('moreShapesButton');
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(700);
  const menu = document.querySelector('.struct-menu');
  if (!menu) return 'no menu';
  const rows = Array.from(menu.querySelectorAll('.struct-menu-item'));
  const sel = rows.find(r => r.getAttribute('aria-selected') === 'true');
  const next = rows[rows.indexOf(sel) + 1];
  next.focus();
  await sleep(300);
  const c = getComputedStyle(sel); const r = sel.getBoundingClientRect();
  return { variant: document.body.dataset.cupertinoVariant, color: c.color, bg: c.backgroundColor, weight: c.fontWeight, stillFocused: document.activeElement === sel, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } };
})()"""

CLOSE = """(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); return 'esc'; })()"""

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
        steps.append({"wait": 1800})
        steps.append({"js": UNFOCUS, "name": "unfocused " + v})
        steps.append({"shot": TAG + "_unfocused_" + v + ".png"})
        steps.append({"js": CLOSE, "name": "close " + v})
        steps.append({"wait": 800})
steps.append({"js": "(()=>({done:true,href:location.href}))()", "name": "end"})
io.open(OUT, 'w', encoding='utf-8', newline='').write(json.dumps(steps, indent=1))
print('wrote', OUT, len(steps))
