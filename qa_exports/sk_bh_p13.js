/* JOB BH skeptic probe 13 - be fair to the narrow layout: what if the PREVIEW pane is
   the one the user is looking at? Click the bottom-nav Preview first, then the chip.
   node sk_bh_p13.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const WIDE = [
  'flowchart TD',
  '  START[Trial balance received] --> CTRL[Reconciliation of intercompany balances between subsidiary Alpha and subsidiary Bravo for the year ended 31 December]',
  '  CTRL --> DONE[Conclusion reached]'
].join('\n');

(async () => {
  const out = { tag: TAG };
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 900, height: 760 });
  try {
    await L.setSource(page, WIDE, 3600);
    // Bottom nav: click Preview, by its visible label.
    const nav = await page.evaluate(() => {
      const b = document.getElementById('mobilePreviewTab');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.height / 2 + r.width / 2 - r.width / 2, y: r.top + r.height / 2, id: b.id, t: (b.textContent || '').trim() };
    });
    out.nav = nav;
    if (nav) { await page.mouse.click(nav.x, nav.y); await page.waitForTimeout(1200); }
    out.paneState = await page.evaluate(() => {
      const p = document.getElementById('previewPane');
      const vp = document.getElementById('zoomViewport');
      const r = vp ? vp.getBoundingClientRect() : null;
      return { paneDisplay: p ? getComputedStyle(p).display : null, paneCls: p ? String(p.className) : null, vp: r ? [Math.round(r.width), Math.round(r.height)] : null };
    });
    await L.makeReference(page, 'CTRL');
    out.paneStateAfterDocs = await page.evaluate(() => {
      const p = document.getElementById('previewPane');
      return { paneDisplay: p ? getComputedStyle(p).display : null, paneCls: p ? String(p.className) : null };
    });
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const a = await L.snapshot(page, 'CTRL');
    out.after = { vp: a.viewport, box: a.box, vis: a.visible, scroll: [a.scrollTop, a.scrollLeft], inspectorHidden: a.inspectorHidden, heading: a.inspectorHeading, ring: a.ring, toasts: a.toasts.map(t => t.text) };
    out.paneStateAfterChip = await page.evaluate(() => {
      const p = document.getElementById('previewPane');
      return { paneDisplay: p ? getComputedStyle(p).display : null, paneCls: p ? String(p.className) : null };
    });
    out.errors = errors.slice();
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_p13_' + TAG + '.png' });
  } catch (e) { out.ERROR = String(e.message); }
  finally { await close(); }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p13_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(TAG, JSON.stringify(out).slice(0, 900));
})();
