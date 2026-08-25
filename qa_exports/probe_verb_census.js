#!/usr/bin/env node
/* Census of controls by VERB, not by location.
 *
 * Two questions only:
 *   1. Which labels appear on more than one control? (same word, two routes)
 *   2. What does the command palette actually offer, and does every row of it point at
 *      something that can be pressed right now?
 *
 * The palette harvests `document.querySelectorAll('button[id]')` with no visibility or
 * disabled test, so this probe reproduces the harvest rule in-page and counts how many of
 * the rows it produces are attached to a button nobody can reach.
 *
 * Usage: node probe_verb_census.js [--app <path>] [--port 9811]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9811'));

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
    await page.waitForTimeout(160);
  }
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP);
  const version = await page.evaluate(`(document.body.innerText.match(/v?1\\.\\d+\\.\\d+/) || ['?'])[0]`);
  console.log('version string seen in UI: ' + version);

  /* ---- 1. every button with an id, with the palette's own harvest rule applied ---- */
  const census = JSON.parse(await page.evaluate(`(() => {
    const rows = [];
    document.querySelectorAll('button[id]').forEach(b => {
      const visible = String(b.textContent || '').replace(/\\s+/g, ' ').trim();
      const tooltip = String(b.getAttribute('title') || '').replace(/\\s+/g, ' ').trim();
      const label = (visible.length >= 3 && visible.length <= 40) ? visible : (tooltip.length <= 40 ? tooltip : visible);
      const box = b.getBoundingClientRect();
      rows.push({
        id: b.id,
        label,
        visLabel: visible,
        onScreen: !!(b.offsetParent) && box.width > 1 && box.height > 1,
        disabled: !!b.disabled,
        ariaDisabled: b.getAttribute('aria-disabled') === 'true',
        skip: b.dataset.palette === 'skip',
        // the palette's own filter, copied verbatim from buildCommandRegistry
        harvestable: !!(label && label.length >= 2 && label.length <= 44 && !/^[×✓+−◀▶▸▾]+$/.test(label))
      });
    });
    return JSON.stringify(rows);
  })()`));

  console.log('\\nbuttons with an id in the DOM: ' + census.length);
  console.log('  of those, on screen right now:  ' + census.filter(r => r.onScreen).length);
  const harvest = census.filter(r => r.harvestable && !r.skip);
  console.log('  of those, harvestable into the palette by its own rule: ' + harvest.length);
  const ghost = harvest.filter(r => !r.onScreen);
  console.log('  ... of WHICH ARE NOT ON SCREEN: ' + ghost.length);
  const ghostDisabled = harvest.filter(r => r.onScreen && (r.disabled || r.ariaDisabled));
  console.log('  ... on screen but disabled:      ' + ghostDisabled.length);

  /* ---- 2. labels that appear on more than one control ---- */
  const byLabel = new Map();
  census.forEach(r => {
    const k = r.label.toLowerCase().replace(/[.…]+$/, '').trim();
    if (!k || k.length < 3) return;
    if (!byLabel.has(k)) byLabel.set(k, []);
    byLabel.get(k).push(r.id);
  });
  const dupes = Array.from(byLabel.entries()).filter(([, ids]) => ids.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  console.log('\\nlabels carried by more than one button[id]: ' + dupes.length);
  dupes.slice(0, 40).forEach(([label, ids]) => {
    console.log('  "' + label + '"  ->  ' + ids.join(', '));
  });

  /* ---- 3. what the palette answers for the verbs a person types ---- */
  const queries = ['guided', 'visual', 'code', 'style', 'theme', 'colour', 'color', 'zoom',
    'fit', 'export', 'undo', 'render', 'present', 'new', 'type', 'font'];
  console.log('\\n--- command palette answers (group | title | keys | route works?) ---');
  await page.evaluate(`(() => { const b = document.getElementById('headerMoreButton'); })()`);
  for (const q of queries) {
    const out = JSON.parse(await page.evaluate(`(async () => {
      const pal = document.getElementById('commandPalette');
      if (pal.hidden) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 250));
      }
      const input = document.getElementById('commandPaletteInput');
      if (!input) return JSON.stringify({ err: 'no palette input' });
      input.value = ${JSON.stringify(q)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 220));
      const rows = Array.from(document.querySelectorAll('#commandPaletteList .palette-row')).map(r => {
        const em = r.querySelector('em'), sp = r.querySelector('span'), kb = r.querySelector('kbd');
        return { group: em ? em.textContent : '', title: sp ? sp.textContent : '', keys: kb && !kb.hidden ? kb.textContent : '' };
      });
      return JSON.stringify({ open: !pal.hidden, rows });
    })()`));
    if (out.err) { console.log('  "' + q + '": ' + out.err); continue; }
    console.log('  query "' + q + '" -> ' + out.rows.length + ' rows' + (out.open ? '' : '  (PALETTE DID NOT OPEN)'));
    out.rows.slice(0, 12).forEach(r => {
      const owner = census.find(c => c.label.toLowerCase() === r.title.toLowerCase());
      let flag = '';
      if (r.group === 'Other' && owner) {
        flag = owner.onScreen ? (owner.disabled || owner.ariaDisabled ? '   <<< button is DISABLED' : '') : '   <<< button is NOT ON SCREEN (#' + owner.id + ')';
      }
      console.log('      [' + String(r.group).padEnd(8) + '] ' + r.title + (r.keys ? '  (' + r.keys + ')' : '') + flag);
    });
  }
  await page.evaluate(`(() => { const p = document.getElementById('commandPalette'); if (p) p.hidden = true; })()`);

  console.log('\\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
