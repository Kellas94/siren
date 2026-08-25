/* REACH CENSUS — how far away is everything, at rest.
 *
 * Measures, in the running app:
 *   1. the command palette's own census of verbs (buildCommandRegistry output, read from the
 *      rendered palette list, not from imagination);
 *   2. every interactive control, whether it is visible at rest, and how many gates stand
 *      between the resting app and that control (closed <details>, hidden dialog, .struct-menu
 *      popup, inactive tab panel).
 *
 * Gate counting is STRUCTURAL here and is verified empirically by probe_reach_walk.js.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const PORT = Number(process.argv[3] || 9861);
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const W = Number(process.argv[4] || 1440), H = Number(process.argv[5] || 900);
const OUT = process.argv[6] || ('C:/Claude/SIREN/qa_exports/reach/census_' + W + '.json');

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const card = document.querySelector('.tour-card');
      if (!card) return true;
      const b = Array.from(card.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent))
        || card.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(180);
  }
}

const CENSUS = `(() => {
  const VW = window.innerWidth, VH = window.innerHeight;
  const vis = (e) => {
    if (!e || !e.getClientRects || !e.getClientRects().length) return false;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.bottom < 0 || r.top > VH || r.right < 0 || r.left > VW) return false;
    return true;
  };
  const label = (e) => {
    let t = String(e.textContent || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    if (e.tagName === 'SELECT' || e.tagName === 'INPUT') t = '';
    if (!t) t = (e.getAttribute('aria-label') || '').trim();
    if (!t) {
      const lf = e.id && document.querySelector('label[for="' + CSS.escape(e.id) + '"]');
      if (lf) t = String(lf.textContent || '').trim();
    }
    if (!t) t = (e.getAttribute('title') || '').trim();
    if (!t) t = (e.getAttribute('placeholder') || '').trim();
    return t.slice(0, 70);
  };

  // ---- gates on the ancestor chain -------------------------------------------------
  const gates = (e) => {
    const g = [];
    let n = e.parentElement;
    while (n && n !== document.body) {
      if (n.tagName === 'DETAILS' && !n.open) {
        const s = n.querySelector(':scope > summary');
        g.push({ kind: 'closed-details', id: n.id || '', name: s ? String(s.textContent||'').replace(/[\\s\\u00a0]+/g,' ').trim().slice(0,60) : '' });
      }
      if (n.tagName === 'DIALOG' && !n.open) g.push({ kind: 'closed-dialog', id: n.id || '', name: '' });
      if (n.classList && n.classList.contains('struct-menu')) g.push({ kind: 'popup-menu', id: n.id || '', name: '' });
      const cs = getComputedStyle(n);
      if ((n.hasAttribute('hidden') || cs.display === 'none') && n.tagName !== 'DETAILS' && n.tagName !== 'DIALOG') {
        g.push({ kind: 'hidden-container', id: n.id || '', name: (n.className||'').toString().slice(0,50) });
      }
      n = n.parentElement;
    }
    return g;
  };

  const sel = 'button, select, summary, a[href], input:not([type=hidden]), textarea, [role=menuitem], [role=tab], [role=option], .struct-menu-item';
  const all = Array.from(document.querySelectorAll(sel));
  const rows = all.map((e, i) => {
    const r = e.getBoundingClientRect();
    const g = gates(e);
    return {
      i, tag: e.tagName.toLowerCase(), id: e.id || '', cls: String(e.className || '').slice(0, 80),
      label: label(e), visible: vis(e),
      x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
      disabled: !!(e.disabled || e.getAttribute('aria-disabled') === 'true'),
      gates: g, gateCount: g.length
    };
  });

  // ---- every <details> and its open state ------------------------------------------
  const dets = Array.from(document.querySelectorAll('details')).map(d => {
    const s = d.querySelector(':scope > summary');
    return {
      id: d.id || '', cls: String(d.className || ''), open: d.open,
      summary: s ? String(s.textContent||'').replace(/[\\s\\u00a0]+/g,' ').trim().slice(0,80) : '',
      summaryVisible: s ? vis(s) : false,
      controls: d.querySelectorAll(sel).length
    };
  });

  return JSON.stringify({ vw: VW, vh: VH, rows, dets });
})()`;

const PALETTE = `(async () => {
  // Ctrl+K route. Open, clear the query, read every rendered row.
  const ev = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true });
  document.dispatchEvent(ev);
  await new Promise(r => setTimeout(r, 500));
  const p = document.getElementById('commandPalette');
  const open = p && !p.hidden;
  const inp = document.getElementById('commandPaletteInput');
  if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); }
  await new Promise(r => setTimeout(r, 400));
  const list = document.getElementById('commandPaletteList');
  const items = list ? Array.from(list.children).map(c => String(c.textContent||'').replace(/[\\s\\u00a0]+/g,' ').trim()) : [];
  return JSON.stringify({ open: !!open, rendered: items.length, items });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: W, height: H });
  await killTour(page);
  await page.waitForTimeout(600);

  fs.mkdirSync('C:/Claude/SIREN/qa_exports/reach', { recursive: true });
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/reach/rest_' + W + '.png' });

  const census = JSON.parse(await page.evaluate(CENSUS));
  const palette = JSON.parse(await page.evaluate(PALETTE));
  // Close the palette again.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  fs.writeFileSync(OUT, JSON.stringify({ w: W, h: H, census, palette, errors }, null, 1));

  const visible = census.rows.filter(r => r.visible);
  console.log('viewport ' + census.vw + 'x' + census.vh);
  console.log('interactive controls in DOM: ' + census.rows.length);
  console.log('visible at rest:            ' + visible.length);
  console.log('details elements: ' + census.dets.length + '  (open at rest: ' + census.dets.filter(d => d.open).length + ')');
  console.log('palette open=' + palette.open + ' rendered rows=' + palette.rendered);
  console.log('');
  console.log('--- <details> at rest ---');
  census.dets.forEach(d => console.log(
    (d.open ? 'OPEN  ' : 'CLOSED') + ' sumVis=' + (d.summaryVisible ? 'Y' : 'n') +
    ' ctrls=' + String(d.controls).padStart(3) + '  #' + (d.id || '-') + ' [' + d.cls + ']  ' + d.summary));
  console.log('');
  console.log('--- visible at rest (id | label | x,y) ---');
  visible.forEach(r => console.log('  ' + r.tag + ' #' + (r.id || '-') + ' | ' + r.label + ' | ' + r.x + ',' + r.y + (r.disabled ? ' | DISABLED' : '')));
  console.log('');
  console.log('page errors: ' + errors.length);
  await close();
})();
