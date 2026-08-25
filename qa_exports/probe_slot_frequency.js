#!/usr/bin/env node
/* How many of the twenty starters land the second tab in the "Guided" slot - the state where
 * pressing that tab shows the Guided rows and then reports itself unselected.
 * Picked the way a person does: the type select, then the "New starter" button, then the dialog.
 * Usage: node probe_slot_frequency.js [--port 9821]
 */
const { openApp, confirmDialog } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9821'));

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
  const types = JSON.parse(await page.evaluate(`JSON.stringify(Array.from(document.getElementById('diagramTypeSelect').options).map(o => [o.value, o.textContent.trim()]))`));
  console.log('APP: ' + APP);
  console.log(types.length + ' starters offered by #diagramTypeSelect\n');
  const tally = { build: 0, sequence: 0, guided: 0, failed: 0 };
  for (const [value, name] of types) {
    await page.evaluate(`(async () => {
      const sel = document.getElementById('diagramTypeSelect');
      sel.value = ${JSON.stringify(value)}; sel.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
      const st = document.getElementById('newDiagramTypeButton')
        || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
      if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 700)); }
    })()`);
    await confirmDialog(page, 1100);
    await page.waitForTimeout(900);
    const r = JSON.parse(await page.evaluate(`(() => {
      const b = document.getElementById('visualModeButton');
      const first = (document.getElementById('source').value || '').split(String.fromCharCode(10)).find(l => l.trim()) || '';
      return JSON.stringify({ slot: b.dataset.slot, label: b.textContent.replace(/\\s+/g,' ').trim(), first: first.slice(0, 30) });
    })()`));
    if (!r.slot) tally.failed += 1; else tally[r.slot] = (tally[r.slot] || 0) + 1;
    console.log('  ' + name.padEnd(22) + 'source: ' + JSON.stringify(r.first).padEnd(34) + ' tab: ' + String(r.label).padEnd(12) + ' slot=' + r.slot);
  }
  console.log('\n  tally: Build=' + tally.build + '  Sequence=' + tally.sequence + '  GUIDED=' + tally.guided + '  (unreadable ' + tally.failed + ')');
  console.log('  the Guided slot is the state where the tab shows the rows and then reports aria-selected="false".');
  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
