import json, sys, io

OUT = sys.argv[1]
PAGE = sys.argv[2]
PORT = '9992'

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
  return { href: location.href, tour: !!document.querySelector('.tour-card') };
})()"""

# Sweep every theme option, plus every finish chip of every finish bar on screen, and
# read the eight surfaces this patch could possibly reach. Detached probes resolve the
# same tokens the real elements do; the real elements were measured separately.
SWEEP = """(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const mk = (cls, tag, id) => { const d = document.createElement(tag || 'div'); if (tag === 'input') d.type = 'text'; if (cls) d.className = cls; if (id) d.id = id; d.style.cssText = 'position:fixed;left:-9999px;top:0;'; return d; };
  const read = () => {
    const menu = mk('struct-menu'); document.body.appendChild(menu);
    const row = mk('struct-menu-item', 'button'); row.setAttribute('aria-selected', 'true'); menu.appendChild(row);
    const plainRow = mk('struct-menu-item', 'button'); menu.appendChild(plainRow);
    const specs = [
      ['canvas-popover', 'div', ''],
      ['canvas-hint', 'div', ''],
      ['canvas-move-ghost', 'div', ''],
      ['canvas-inplace', 'input', 'canvasInplace'],
      ['', 'input', 'canvasPopLabel'],
      ['', 'input', 'canvasPopBranch']
    ];
    const made = specs.map(sp => { const e = mk(sp[0], sp[1], sp[2]); document.body.appendChild(e); return [sp[0] + '#' + sp[2], e]; });
    const grab = e => { const c = getComputedStyle(e); return [c.backgroundColor, c.borderTopColor, c.color, c.backdropFilter || c.webkitBackdropFilter || 'none'].join(' | '); };
    const out = {};
    made.forEach(p => { out[p[0]] = grab(p[1]); });
    out['struct-menu'] = grab(menu);
    out['struct-menu-item[selected]'] = grab(row);
    out['struct-menu-item'] = grab(plainRow);
    made.forEach(p => p[1].remove());
    menu.remove();
    return out;
  };
  const sel = document.getElementById('themePreset');
  const opts = Array.from(sel.options).map(o => o.value);
  const res = {};
  for (const v of opts) {
    sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(300);
    const key = v + '|' + (document.body.dataset.cupertinoVariant || document.body.dataset.kpmgVariant || document.body.dataset.kintsugiVariant || '');
    res[key] = read();
    // any finish bar visible for this theme: walk every chip on it
    const bars = Array.from(document.querySelectorAll('#cupertinoFinishBar, #kpmgFinishBar, .kintsugi-finish-bar')).filter(b => b.offsetParent !== null || b.getClientRects().length);
    for (const bar of bars) {
      const chips = Array.from(bar.querySelectorAll('button[data-cupertino-light],button[data-cupertino-accent],button[data-kpmg-variant],button[data-kintsugi-variant]'));
      for (const c of chips) {
        c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(220);
        const k2 = v + '|' + (document.body.dataset.cupertinoVariant || document.body.dataset.kpmgVariant || document.body.dataset.kintsugiVariant || '');
        res[k2] = read();
      }
    }
  }
  return { href: location.href, count: Object.keys(res).length, res: res };
})()"""

steps = [
    {"nav": "http://127.0.0.1:" + PORT + "/" + PAGE, "wait": 5000},
    {"js": BOOT, "name": "boot"},
    {"js": SWEEP, "name": "sweep"},
]
io.open(OUT, 'w', encoding='utf-8', newline='').write(json.dumps(steps, indent=1))
print('wrote', OUT)
