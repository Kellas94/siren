#!/usr/bin/env node
/* The three "small things the agents disclosed rather than hid", re-measured on the shipped 1.70.0.
 *
 *   1. the Docs block menu scrolls on a short screen (1100x620)
 *   2. "Document type..." opens at the page's left edge
 *   3. the confirm button is red even when the choice loses nothing
 *
 * Two of these sit exactly where rounds 9 and 10 worked, so they are the honest test of whether
 * that work reached the surface the complaint was written about - not the fixture it was built on.
 *
 * Usage: node probe_watching_smalls.js [--app <path>] [--port 9890]
 */
const { openApp, setSource } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9890'));
const NL = String.fromCharCode(10);

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}

const OPEN_DOCS = `(async () => {
  document.getElementById('workpapersButton').click();
  await new Promise(r => setTimeout(r, 1200));
  const nw = document.getElementById('wpNewButton') || document.getElementById('wpEmptyNewButton');
  if (nw) { nw.click(); await new Promise(r => setTimeout(r, 900)); }
  const m = document.querySelector('.struct-menu');
  if (m) {
    const row = Array.from(m.querySelectorAll('.struct-menu-item')).find(b => /narrative|note|agent/i.test(b.textContent))
      || m.querySelector('.struct-menu-item');
    if (row) row.click();
    await new Promise(r => setTimeout(r, 1300));
  }
  return JSON.stringify({ docsOpen: !document.getElementById('wpWorkspace').hidden,
    blocks: document.querySelectorAll('#wpBlocks .wp-block').length });
})()`;

/* Where a menu sits, and whether any of it is out of reach. */
const MENU_GEOM = `(() => {
  const m = document.querySelector('.struct-menu');
  if (!m) return JSON.stringify({ noMenu: true });
  const r = m.getBoundingClientRect();
  return JSON.stringify({
    left: Math.round(r.left), top: Math.round(r.top),
    w: Math.round(r.width), h: Math.round(r.height),
    hiddenBelow: Math.max(0, m.scrollHeight - m.clientHeight),
    scrollable: m.dataset.scrollable || null,
    announced: !!m.getAttribute('aria-description'),
    rows: m.querySelectorAll('.struct-menu-item').length,
    heading: (m.querySelector('.struct-menu-heading') || {}).textContent || null,
    label: m.getAttribute('aria-label') || null
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1100, height: 620 });
  await killTour(page);
  await setSource(page, ['flowchart TD', '  A[Purchase request] --> B{Approved}'].join(NL), 2600);
  console.log('\nMeasured on ' + APP + ', viewport 1100x620\n');

  const opened = JSON.parse(await page.evaluate(OPEN_DOCS));
  console.log('  Docs: ' + JSON.stringify(opened));
  if (!opened.docsOpen) { console.log('  cannot measure - Docs did not open'); await close(); return; }

  // ---- 1. the block menu on a short screen ----
  const blockBox = JSON.parse(await page.evaluate(`(() => {
    const b = document.querySelector('#wpBlocks .wp-block');
    if (!b) return JSON.stringify(null);
    const r = b.getBoundingClientRect();
    // Deliberately the block's CHROME, not its text: editable text keeps the browser's own
    // context menu, so a right-click inside the paragraph opens nothing the app owns and the
    // measurement reads as "no menu" on a build where the menu works perfectly.
    return JSON.stringify({ x: r.left + 8, y: r.top + Math.min(14, r.height / 2), blockLeft: Math.round(r.left) });
  })()`));
  if (blockBox) {
    await page.mouse.click(blockBox.x, blockBox.y, { button: 'right' });
    await page.waitForTimeout(500);
    const g = JSON.parse(await page.evaluate(MENU_GEOM));
    console.log('\n  1. block menu at 1100x620: ' + JSON.stringify(g));
    console.log('     verdict: ' + (g.noMenu ? 'no menu opened'
      : g.hiddenBelow > 0 ? (g.scrollable === 'true' && g.announced ? 'scrolls, and SAYS SO' : 'scrolls IN SILENCE')
      : 'fits, nothing below the fold'));

    // ---- 2. where the "Document type" submenu opens ----
    const sub = JSON.parse(await page.evaluate(`(async () => {
      const m = document.querySelector('.struct-menu');
      if (!m) return JSON.stringify({ noParent: true });
      const row = Array.from(m.querySelectorAll('.struct-menu-item'))
        .find(b => /document type|turn into|mark as/i.test(b.textContent));
      if (!row) return JSON.stringify({ noRow: Array.from(m.querySelectorAll('.struct-menu-item')).map(b => b.textContent.trim()).slice(0, 14) });
      const rr = row.getBoundingClientRect();
      row.click();
      await new Promise(r => setTimeout(r, 700));
      const menus = Array.from(document.querySelectorAll('.struct-menu'));
      const sm = menus[menus.length - 1];
      const sr = sm ? sm.getBoundingClientRect() : null;
      return JSON.stringify({ rowText: row.textContent.trim(), rowLeft: Math.round(rr.left),
        submenuLeft: sr ? Math.round(sr.left) : null, menusOpen: menus.length,
        label: sm ? sm.getAttribute('aria-label') : null });
    })()`));
    console.log('\n  2. the second menu: ' + JSON.stringify(sub));
    if (sub.submenuLeft !== null && sub.rowLeft !== undefined) {
      const d = sub.submenuLeft - sub.rowLeft;
      console.log('     verdict: submenu sits ' + d + 'px from the row it came from'
        + (Math.abs(d) < 260 ? ' - beside its parent' : ' - AWAY at the page edge'));
    }
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // ---- 3. a confirm button that is red when nothing is lost ----
  const confirm = JSON.parse(await page.evaluate(`(async () => {
    const out = [];
    document.querySelectorAll('dialog').forEach(d => {
      Array.from(d.querySelectorAll('button')).forEach(b => {
        const cls = String(b.className || '');
        if (!/danger|destruct|warn/i.test(cls)) return;
        out.push({ dialog: d.id || '(anonymous)', text: (b.textContent || '').trim().slice(0, 30), cls: cls.slice(0, 46) });
      });
    });
    return JSON.stringify(out.slice(0, 12));
  })()`));
  console.log('\n  3. buttons wearing a destructive class, across every dialog in the file:');
  confirm.forEach(c => console.log('     ' + c.dialog.padEnd(24) + '"' + c.text + '"  .' + c.cls));
  if (!confirm.length) console.log('     none');

  console.log('\n  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
