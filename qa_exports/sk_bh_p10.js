/* JOB BH skeptic probe 10 - the refusal at DEFAULT zoom in a narrow window.
   No zooming, no exotic fixture: one ordinary long audit label, a half-screen window.
   node sk_bh_p10.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const WIDE = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL[Reconciliation of intercompany balances between subsidiary Alpha and subsidiary Bravo for the year ended 31 December]',
  '  CTRL --> DONE[Conclusion reached]'
].join('\n');

(async () => {
  const out = { tag: TAG, rows: [] };
  const widths = [1024, 900, 820, 760, 700];
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    const { page, errors, close } = await L.openApp(APP, PORT + i, { width: w, height: 760 });
    try {
      await L.setSource(page, WIDE, 3600);
      const src = await page.$eval('#source', e => e.value);
      if (!/Reconciliation of intercompany/.test(src)) throw new Error('FIXTURE MISMATCH');
      const pct = await page.evaluate(() => { const t = Array.from(document.querySelectorAll('button,span')).map(n => (n.textContent || '').trim()).find(x => /^\d{2,4}\s*%$/.test(x)); return t || null; });
      await L.makeReference(page, 'CTRL');
      await L.armObservers(page);
      const before = await L.snapshot(page, 'CTRL');
      await L.clickChip(page);
      await page.waitForTimeout(1500);
      const a = await L.snapshot(page, 'CTRL');
      out.rows.push({
        w, pct, vp: a.viewport, box: a.box, vis: a.visible, scroll: [a.scrollTop, a.scrollLeft],
        inspectorHidden: a.inspectorHidden, heading: a.inspectorHeading, ring: a.ring,
        toasts: a.toasts.map(t => t.text), errors: errors.slice(), beforeVis: before.visible
      });
      console.log(TAG, 'win=' + w, 'zoom=' + pct, 'vp=' + JSON.stringify(a.viewport), 'box=' + JSON.stringify(a.box && [a.box.w, a.box.h]),
        'insp=' + a.inspectorHidden, 'toasts=' + JSON.stringify(a.toasts.map(t => t.text)));
      if (a.toasts.length) await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_narrow' + w + '_' + TAG + '.png' });
    } catch (e) {
      out.rows.push({ w, ERROR: String(e.message) });
      console.log(TAG, 'win=' + w, 'ERROR', e.message);
    } finally { await close(); }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p10_' + TAG + '.json', JSON.stringify(out, null, 1));
})();
