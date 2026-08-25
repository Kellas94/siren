/* JOB BH skeptic probe 5 - the 8px padding guard at DEFAULT zoom.
   A block pinned against a scroll clamp is fully on screen yet may sit inside the 8px
   margin the guard demands. Sweep chain lengths and both ends. No zooming at all.
   node sk_bh_p5.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

function chain(n) {
  const lines = ['flowchart TD'];
  for (let i = 0; i < n; i++) lines.push('  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']');
  return lines.join('\n');
}

(async () => {
  const out = { tag: TAG, app: APP, rows: [] };
  for (let n = 5; n <= 12; n++) {
    for (const which of ['last', 'first']) {
      const port = PORT + (n * 2) + (which === 'last' ? 0 : 1);
      const { page, errors, close } = await L.openApp(APP, port, { width: 1024, height: 700 });
      try {
        const src = chain(n);
        await L.setSource(page, src, 3200);
        const got = await page.$eval('#source', e => e.value);
        if (got.trim() !== src.trim()) throw new Error('FIXTURE MISMATCH');
        const target = which === 'last' ? 'N' + n : 'N0';
        // For the 'first' case put the canvas at the bottom first, so the arrival must climb.
        if (which === 'first') {
          await page.evaluate(() => { const v = document.getElementById('zoomViewport'); v.scrollTop = v.scrollHeight; });
          await page.waitForTimeout(400);
        }
        const ref = await L.makeReference(page, target);
        await L.armObservers(page);
        await L.clickChip(page);
        await page.waitForTimeout(1400);
        const a = await L.snapshot(page, target);
        const gap = a.box && a.viewport ? {
          topGap: a.box.top - a.viewport.top,
          bottomGap: (a.viewport.top + a.viewport.h) - a.box.bottom,
          leftGap: a.box.left - a.viewport.left,
          rightGap: (a.viewport.left + a.viewport.w) - a.box.right
        } : null;
        out.rows.push({
          n, which, target, scrollTop: a.scrollTop, box: a.box, vp: a.viewport, gap,
          visibleFully: a.visible && a.visible.fully, anyVisible: a.visible && a.visible.any,
          dy: a.visible && a.visible.dy,
          inspectorHidden: a.inspectorHidden, inspectorHeading: a.inspectorHeading,
          ring: a.ring, style: a.styleTarget, build: a.buildSelect,
          toasts: a.toasts.map(t => t.text), errors: errors.slice()
        });
        console.log(TAG, n, which, 'gapTop', gap && gap.topGap, 'gapBot', gap && gap.bottomGap, 'insp', a.inspectorHidden, a.toasts.map(t => t.text).join('|'));
      } catch (e) {
        out.rows.push({ n, which, ERROR: String(e.message) });
        console.log(TAG, n, which, 'ERROR', e.message);
      } finally { await close(); }
    }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p5_' + TAG + '.json', JSON.stringify(out, null, 1));
})();
