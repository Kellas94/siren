/* JOB BH skeptic probe 11 - pin the narrow-layout break: threshold, what the panes are
   doing, what the user sees, and whether the inspector really carries the block.
   node sk_bh_p11.js <appPath> <port> <tag> */
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
  const widths = [1024, 1000, 980, 960, 900, 800];
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i];
    const { page, errors, close } = await L.openApp(APP, PORT + i, { width: w, height: 760 });
    try {
      await L.setSource(page, WIDE, 3600);
      const layout = await page.evaluate(() => {
        const vp = document.getElementById('zoomViewport');
        const pane = document.getElementById('previewPane');
        const cs = vp ? getComputedStyle(vp) : null;
        const pcs = pane ? getComputedStyle(pane) : null;
        const tabs = Array.from(document.querySelectorAll('button')).filter(b => /preview|editor|canvas/i.test(b.textContent || '') && b.getBoundingClientRect().width > 2).map(b => ({ id: b.id, t: (b.textContent || '').trim().slice(0, 22), pressed: b.getAttribute('aria-pressed') }));
        const svg = document.querySelector('#diagram svg');
        const ctrl = svg ? Array.from(svg.querySelectorAll('g.node')).find(g => (g.id || '').includes('-CTRL-')) : null;
        return {
          vpDisplay: cs && cs.display, paneDisplay: pcs && pcs.display,
          paneClass: pane && String(pane.className), paneHidden: pane && pane.hidden,
          svgPresent: !!svg, ctrlPresent: !!ctrl,
          ctrlBox: ctrl ? [Math.round(ctrl.getBoundingClientRect().width), Math.round(ctrl.getBoundingClientRect().height)] : null,
          tabs
        };
      });
      await L.makeReference(page, 'CTRL');
      await L.armObservers(page);
      await L.clickChip(page);
      await page.waitForTimeout(1500);
      const a = await L.snapshot(page, 'CTRL');
      const post = await page.evaluate(() => {
        const insp = document.getElementById('nodeInspector');
        const field = document.querySelector('#nodeInspector input[type="text"], #nodeInspector textarea');
        return { inspHidden: insp ? !!insp.hidden : null, blockText: field ? field.value : null };
      });
      out.rows.push({ w, layout, inspectorHidden: a.inspectorHidden, heading: a.inspectorHeading, blockText: post.blockText, ring: a.ring, style: a.styleTarget, build: a.buildSelect, toasts: a.toasts.map(t => t.text), errors: errors.slice() });
      console.log(TAG, 'win=' + w, 'vpDisp=' + layout.vpDisplay, 'paneDisp=' + layout.paneDisplay, 'ctrl=' + JSON.stringify(layout.ctrlBox),
        'insp=' + a.inspectorHidden, JSON.stringify(a.inspectorHeading), 'blockText=' + JSON.stringify((post.blockText || '').slice(0, 30)), 'toasts=' + JSON.stringify(a.toasts.map(t => t.text)));
      await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_p11_' + w + '_' + TAG + '.png' });
    } catch (e) {
      out.rows.push({ w, ERROR: String(e.message) });
      console.log(TAG, 'win=' + w, 'ERROR', e.message);
    } finally { await close(); }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p11_' + TAG + '.json', JSON.stringify(out, null, 1));
})();
