/* The app's own census of its verbs.
 *
 * filterCommandPalette() slices to 60, so reading the palette once undercounts. This unions the
 * result of every single-letter query plus a few group words, which recovers the registry the app
 * actually built, with its group tags and its declared keyboard shortcut.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');

const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9864);

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
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await page.waitForTimeout(500);

  await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))`);
  await page.waitForTimeout(500);
  const opened = await page.evaluate(`(() => { const p = document.getElementById('commandPalette'); return !!(p && !p.hidden); })()`);
  console.log('palette opened by Ctrl+K: ' + opened);

  const queries = 'abcdefghijklmnopqrstuvwxyz'.split('').concat(['', 'diagram', 'style', 'export', 'view', 'edit', 'share', 'quality', 'theme', 'shape', 'file']);
  const seen = new Map();
  for (const q of queries) {
    const rows = JSON.parse(await page.evaluate(`(async () => {
      const inp = document.getElementById('commandPaletteInput');
      inp.value = ${JSON.stringify(q)};
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 90));
      const list = document.getElementById('commandPaletteList');
      return JSON.stringify(Array.from(list.children).map(c => {
        const em = c.querySelector('em'), sp = c.querySelector('span'), kb = c.querySelector('kbd');
        return { group: em ? em.textContent.trim() : '', title: sp ? sp.textContent.trim() : c.textContent.trim(),
                 keys: (kb && !kb.hidden) ? kb.textContent.trim() : '' };
      }));
    })()`));
    rows.forEach(r => { if (r.title && !seen.has(r.title)) seen.set(r.title, r); });
  }

  const all = Array.from(seen.values());
  const byGroup = {};
  all.forEach(r => { (byGroup[r.group] = byGroup[r.group] || []).push(r); });

  fs.mkdirSync('C:/Claude/SIREN/qa_exports/reach', { recursive: true });
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/reach/palette_registry.json', JSON.stringify(all, null, 1));

  console.log('distinct commands recovered: ' + all.length);
  console.log('');
  Object.keys(byGroup).sort().forEach(g => {
    console.log('== ' + g + ' (' + byGroup[g].length + ') ==');
    byGroup[g].forEach(r => console.log('   ' + r.title + (r.keys ? '   [' + r.keys + ']' : '')));
  });
  console.log('');
  console.log('page errors: ' + errors.length);
  await close();
})();
