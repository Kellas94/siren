#!/usr/bin/env node
/* Part 9. What the tab strip tells assistive technology, per diagram type.
 * Usage: node probe_dupe_routes_9.js [--port 9820]
 */
const { openApp, confirmDialog } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9820'));

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

const SRCS = {
  flowchart: 'flowchart TD\\n  A[Start] --> B[End]',
  sequence: 'sequenceDiagram\\n  A->>B: hello',
  pie: 'pie showData\\n  title T\\n  "a" : 1\\n  "b" : 2',
  gantt: 'gantt\\n  title T\\n  section S\\n  task :a1, 2024-01-01, 3d',
  mindmap: 'mindmap\\n  root((core))\\n    one\\n    two',
  timeline: 'timeline\\n  title T\\n  2024 : one'
};

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  console.log('type        tab label     tablist aria-label            tab aria-controls   after pressing it: panel shown      tab aria-selected');
  console.log('-'.repeat(140));
  for (const [type, src] of Object.entries(SRCS)) {
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = '${src}'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await page.waitForTimeout(2600);
    await page.evaluate(`(async () => { document.getElementById('codeModeButton').click(); await new Promise(r => setTimeout(r,200)); document.getElementById('textModeButton').click(); })()`);
    await page.waitForTimeout(600);
    const before = JSON.parse(await page.evaluate(`(() => {
      const b = document.getElementById('visualModeButton');
      return JSON.stringify({ label: b.textContent.replace(/\\s+/g,' ').trim(),
        tablist: b.parentElement.getAttribute('aria-label'),
        controls: b.getAttribute('aria-controls'), role: b.getAttribute('role') });
    })()`));
    await page.locator('#visualModeButton').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(`(() => {
      const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); };
      const b = document.getElementById('visualModeButton');
      return JSON.stringify({
        shown: vis('structureEditor') ? '#structureEditor (Guided)' : vis('sequencePanel') ? '#sequencePanel' : vis('visualModePanel') ? '#visualModePanel' : vis('codeEditor') ? '#codeEditor' : 'nothing',
        selected: b.getAttribute('aria-selected'),
        controlsPanelShown: (() => { const p = document.getElementById(b.getAttribute('aria-controls')); return !!(p && !p.hidden && p.getBoundingClientRect().height > 2); })()
      });
    })()`));
    const mismatch = after.controlsPanelShown ? '' : '  <<< aria-controls points at a panel that did NOT open';
    const unlit = after.selected === 'false' ? '  <<< the tab you just pressed says it is NOT selected' : '';
    console.log(type.padEnd(12) + String(before.label).padEnd(14) + String(before.tablist).padEnd(28)
      + String(before.controls).padEnd(20) + String(after.shown).padEnd(28) + String(after.selected).padEnd(8) + mismatch + unlit);
  }
  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
