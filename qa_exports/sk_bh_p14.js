/* JOB BH skeptic probe 14 - at 900px, is there ANY route to a Docs reference chip that
   leaves the preview pane laid out? Try the bottom-nav More menu with Preview active.
   node sk_bh_p14.js <appPath> <port> <tag> */
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
    await L.realClick(page, '#mobilePreviewTab', 'preview tab');
    await page.waitForTimeout(1200);
    out.previewActive = await page.evaluate(() => {
      const p = document.getElementById('previewPane');
      const vp = document.getElementById('zoomViewport').getBoundingClientRect();
      return { cls: String(p.className), vp: [Math.round(vp.width), Math.round(vp.height)] };
    });
    await L.realClick(page, '#mobileMoreButton', 'more menu');
    await page.waitForTimeout(700);
    out.moreItems = await page.evaluate(() => Array.from(document.querySelectorAll('[role="menuitem"],button,li'))
      .filter(n => n.getBoundingClientRect().width > 2 && /docs|workpaper|document/i.test(n.textContent || ''))
      .map(n => ({ t: (n.textContent || '').trim().slice(0, 30), id: n.id })));
    const hit = await page.evaluate(() => {
      const n = Array.from(document.querySelectorAll('[role="menuitem"],button,li'))
        .filter(x => x.getBoundingClientRect().width > 2 && /docs/i.test(x.textContent || '')).pop();
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: (n.textContent || '').trim() };
    });
    out.docsMenuHit = hit;
    if (!hit) throw new Error('no Docs entry in the More menu');
    await page.mouse.click(hit.x, hit.y);
    await page.waitForTimeout(1200);
    out.docsOpen = await page.evaluate(() => { const w = document.getElementById('wpWorkspace'); return w ? !w.hidden : null; });

    // Build the reference from here.
    await L.realClick(page, '#wpNewButton', 'new document');
    await page.waitForTimeout(450);
    await L.clickMenuItemByLabel(page, 'Note');
    await page.waitForTimeout(900);
    await page.selectOption('#wpLinkKind', 'diagram');
    await page.waitForTimeout(300);
    const dops = await page.$$eval('#wpLinkDiagram option', os => os.map(o => o.value));
    await page.selectOption('#wpLinkDiagram', dops[0]);
    await page.waitForTimeout(300);
    await page.selectOption('#wpLinkNode', 'CTRL');
    await page.waitForTimeout(300);
    await L.realClick(page, '#wpAddLinkButton', 'add');
    await page.waitForTimeout(800);
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1600);
    const a = await L.snapshot(page, 'CTRL');
    out.after = { vp: a.viewport, box: a.box, vis: a.visible, scroll: [a.scrollTop, a.scrollLeft], inspectorHidden: a.inspectorHidden, heading: a.inspectorHeading, ring: a.ring, toasts: a.toasts.map(t => t.text) };
    out.paneAfter = await page.evaluate(() => String(document.getElementById('previewPane').className));
    out.errors = errors.slice();
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_p14_' + TAG + '.png' });
  } catch (e) { out.ERROR = String(e.message); }
  finally { await close(); }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p14_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(TAG, JSON.stringify(out).slice(0, 1100));
})();
