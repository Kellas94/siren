/* Two things the reach numbers imply but do not prove.
 *
 * 1. The preview toolbar was deliberately grouped ("Twelve controls became four", says the CSS).
 *    The grouping is one body attribute. Turning it off and re-counting says exactly what the
 *    grouping cost in reach - not from the comment, from the app.
 *
 * 2. Ctrl+K is the app's answer to anything being far away. It is only an answer if its entries
 *    actually go somewhere. The registry is built by harvesting every button[id] in the document,
 *    including the ones inside dialogs that are shut - so this counts how many palette rows point
 *    at a button that is not rendered at the moment the palette offers it.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9885);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

const COUNT_CLICKABLE = `(() => {
  const VW = innerWidth, VH = innerHeight;
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const hit = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (const [x, y] of [[r.left + r.width/2, r.top + r.height/2], [r.left + 6, r.top + r.height/2]]) {
      if (x < 0 || x > VW || y < 0 || y > VH) continue;
      const t = document.elementFromPoint(x, y);
      if (t && (t === e || e.contains(t) || t.contains(e))) return true;
    }
    return false;
  };
  const out = [];
  document.querySelectorAll('.preview-toolbar button, .pane-actions button, .zoom-tools button, .preview-layout-switch button').forEach(e => {
    if (hit(e)) out.push(clean(e.textContent).slice(0, 24) || e.id);
  });
  return JSON.stringify(out);
})()`;

// Which palette rows point at a control that is not rendered right now?
const PALETTE_TARGETS = `(() => {
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const rendered = (e) => {
    if (!e) return false;
    if (!e.getClientRects || !e.getClientRects().length) return false;
    const cs = getComputedStyle(e);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  // Rebuild the same harvest the registry does, and ask of each harvested button whether it is
  // rendered while the palette is open.
  const known = new Set();
  let total = 0, inert = 0, inClosedDialog = 0, hiddenAttr = 0;
  const inertNames = [];
  document.querySelectorAll('button[id]').forEach(button => {
    if (button.closest('#commandPalette')) return;
    if (button.dataset.palette === 'skip') return;
    const visible = clean(button.textContent);
    const tooltip = clean(button.getAttribute('title'));
    const label = (visible.length >= 3 && visible.length <= 40) ? visible : (tooltip.length <= 40 ? tooltip : visible);
    if (!label || label.length < 2 || label.length > 44 || known.has(label.toLowerCase())) return;
    if (/^[\\u00d7\\u2713+\\u2212\\u25c0\\u25b6\\u25b8\\u25be]+$/.test(label)) return;
    known.add(label.toLowerCase());
    total++;
    if (!rendered(button)) {
      inert++;
      if (button.closest('dialog') && !button.closest('dialog').open) inClosedDialog++;
      if (button.hasAttribute('hidden')) hiddenAttr++;
      if (inertNames.length < 40) inertNames.push(label + '  (#' + button.id + ')');
    }
  });
  // Curated File-group commands: do they have ANY button in the document at all?
  const anyButton = (rx) => Array.from(document.querySelectorAll('button')).some(b => rx.test(clean(b.textContent)) || rx.test(clean(b.getAttribute('title'))));
  return JSON.stringify({ total, inert, inClosedDialog, hiddenAttr, inertNames,
    saveProjectButton: anyButton(/save project/i),
    openProjectButton: anyButton(/open project/i),
    saveProjectAsButton: anyButton(/save project as/i) });
})()`;

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await page.waitForTimeout(500);

  const grouped = JSON.parse(await page.evaluate(COUNT_CLICKABLE));
  const attr = await page.evaluate(`document.body.getAttribute('data-preview-grouped')`);
  console.log('body[data-preview-grouped] = ' + JSON.stringify(attr));
  console.log('preview-toolbar controls clickable at rest, GROUPED   : ' + grouped.length);
  console.log('   ' + grouped.join(' | '));

  await page.evaluate(`document.body.removeAttribute('data-preview-grouped')`);
  await page.waitForTimeout(500);
  const ungrouped = JSON.parse(await page.evaluate(COUNT_CLICKABLE));
  console.log('preview-toolbar controls clickable at rest, UNGROUPED : ' + ungrouped.length);
  console.log('   ' + ungrouped.join(' | '));
  const lost = ungrouped.filter(u => !grouped.includes(u));
  console.log('pushed behind a menu by the grouping: ' + lost.length + '  ->  ' + lost.join(' | '));
  await page.screenshot({ path: DIR + '/toolbar_ungrouped.png' });
  await page.evaluate(`document.body.setAttribute('data-preview-grouped', ${JSON.stringify(attr || 'on')})`);
  await page.waitForTimeout(400);

  // Palette: open it, then ask what its harvested rows point at.
  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))`);
  await page.waitForTimeout(600);
  const p = JSON.parse(await page.evaluate(PALETTE_TARGETS));
  console.log('');
  console.log('command palette, harvested button rows: ' + p.total);
  console.log('   pointing at a control NOT rendered while the palette is open: ' + p.inert +
    '  (' + Math.round(p.inert / p.total * 100) + '%)');
  console.log('   of those, inside a dialog that is shut: ' + p.inClosedDialog + ';  carrying hidden: ' + p.hiddenAttr);
  console.log('   examples:');
  p.inertNames.slice(0, 22).forEach(n => console.log('      ' + n));
  console.log('');
  console.log('curated File commands with a button anywhere in the document:');
  console.log('   "Save project to disk" : ' + p.saveProjectButton);
  console.log('   "Save project as…"     : ' + p.saveProjectAsButton);
  console.log('   "Open project from disk…" : ' + p.openProjectButton);
  console.log('');
  console.log('page errors: ' + errors.length);
  fs.writeFileSync(DIR + '/grouping_palette.json', JSON.stringify({ grouped, ungrouped, lost, palette: p }, null, 1));
  await close();
})();
