/* JOB BH skeptic probe 4 - the over-correction, and what a refusal leaves behind.
   node sk_bh_p4.js <appPath> <port> <tag> [scenario] */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4], ONLY = process.argv[5];

const WIDE = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL[Reconciliation of intercompany balances between subsidiary Alpha and subsidiary Bravo for the year ended 31 December]',
  '  CTRL --> DONE[Conclusion reached]'
].join('\n');

async function zoomIn(page, clicks) {
  const steps = [];
  for (let i = 0; i < clicks; i++) {
    await L.realClick(page, '#zoomMenuButton', 'zoom menu');
    await page.waitForTimeout(400);
    await L.realClick(page, '#zoomInButton', 'zoom in');
    await page.waitForTimeout(400);
    steps.push(await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('button,span')).map(n => (n.textContent || '').trim()).find(x => /^\d{2,4}\s*%$/.test(x));
      return t || null;
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(700);
  return steps;
}

async function zoomPresets(page) {
  await L.realClick(page, '#zoomMenuButton', 'zoom menu');
  await page.waitForTimeout(500);
  const items = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.zoom-popover-row, [role="menu"], .zoom-cluster'));
    const seen = new Set(); const out = [];
    rows.forEach(r => Array.from(r.querySelectorAll('button,option,li')).forEach(n => {
      const t = (n.textContent || '').trim();
      const rect = n.getBoundingClientRect();
      if (rect.width > 2 && t && !seen.has(t)) { seen.add(t); out.push({ t, id: n.id }); }
    }));
    const sel = Array.from(document.querySelectorAll('select')).filter(s => s.getBoundingClientRect().width > 2)
      .map(s => ({ id: s.id, opts: Array.from(s.options).map(o => o.textContent.trim()) }));
    return { buttons: out, selects: sel };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return items;
}

/* How far must an ordinary auditor zoom before the arrival refuses? Step one preset at a time. */
async function scenarioThreshold() {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  const rows = [];
  try {
    await L.setSource(page, WIDE, 3600);
    const presets = await zoomPresets(page);
    const ref = await L.makeReference(page, 'CTRL');
    for (let step = 0; step <= 4; step++) {
      if (step > 0) {
        // reopen Docs to get back to the chip
        await L.realClick(page, '#workpapersButton', 'reopen docs');
        await page.waitForTimeout(700);
      }
      const pct = step === 0 ? await page.evaluate(() => { const t = Array.from(document.querySelectorAll('button,span')).map(n => (n.textContent || '').trim()).find(x => /^\d{2,4}\s*%$/.test(x)); return t || null; }) : rows[rows.length - 1].pctAfterZoom;
      await L.armObservers(page);
      await L.clickChip(page);
      await page.waitForTimeout(1400);
      const after = await L.snapshot(page, 'CTRL');
      rows.push({
        step, pctAtClick: pct,
        box: after.box, vp: after.viewport, visible: after.visible,
        scrollTop: after.scrollTop, scrollLeft: after.scrollLeft,
        inspectorHidden: after.inspectorHidden, inspectorHeading: after.inspectorHeading,
        ring: after.ring, style: after.styleTarget, build: after.buildSelect, card: after.buildLabel,
        toasts: after.toasts, docsOpen: after.docsOpen
      });
      if (step < 4) {
        const s = await zoomIn(page, 1);
        rows[rows.length - 1].pctAfterZoom = s[s.length - 1];
      }
    }
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_thresh_' + TAG + '.png' });
    return { presets, ref: ref.chip, rows, errors: errors.slice() };
  } catch (e) { return { ERROR: String(e.message), rows, errors: errors.slice() }; }
  finally { await close(); }
}

/* Prime the inspector on START, then fire a reference at an oversized CTRL.
   What is on screen afterwards, and what would a keystroke now edit? */
async function scenarioStale() {
  const { page, errors, close } = await L.openApp(APP, PORT + 1, { width: 1024, height: 700 });
  try {
    await L.setSource(page, WIDE, 3600);
    await zoomIn(page, 2);
    const startBox = await page.evaluate(() => {
      const svg = document.querySelector('#diagram svg');
      const g = Array.from(svg.querySelectorAll('g.node,g[id]')).find(n => (n.id || '').split('-').includes('START'));
      if (!g) return null;
      const r = g.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width) };
    });
    let primed = null;
    if (startBox && startBox.w > 1) {
      await page.mouse.click(startBox.x, startBox.y);
      await page.waitForTimeout(500);
      await page.mouse.click(startBox.x, startBox.y);
      await page.waitForTimeout(900);
      primed = await L.snapshot(page, 'START');
    }
    const ref = await L.makeReference(page, 'CTRL');
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const after = await L.snapshot(page, 'CTRL');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_stale_' + TAG + '.png' });
    return { startBox, primed, ref: ref.chip, after, errors: errors.slice() };
  } finally { await close(); }
}

const RUN = { threshold: scenarioThreshold, stale: scenarioStale };
(async () => {
  const out = { tag: TAG, app: APP, scenarios: {} };
  for (const [n, fn] of Object.entries(RUN)) {
    if (ONLY && ONLY !== n) continue;
    try { out.scenarios[n] = await fn(); } catch (e) { out.scenarios[n] = { ERROR: String(e.message) }; }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p4_' + TAG + (ONLY ? '_' + ONLY : '') + '.json', JSON.stringify(out, null, 1));
  console.log('WROTE skbh_p4_' + TAG + (ONLY ? '_' + ONLY : '') + '.json');
})();
