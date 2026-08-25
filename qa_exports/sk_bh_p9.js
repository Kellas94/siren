/* JOB BH skeptic probe 9 - one step sideways: the app's OWN audit template, and a
   flowchart with a subgraph (an audit diagram's normal shape).
   node sk_bh_p9.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const SUBGRAPH = [
  'flowchart TD',
  '  subgraph FIN[Finance team]',
  '    A[Prepare reconciliation] --> B[Review reconciliation]',
  '  end',
  '  subgraph AUD[Audit team]',
  '    C[Select sample] --> D[Test items]',
  '  end',
  '  B --> C',
  '  D --> E[Conclude]'
].join('\n');

async function arrivalRun(page, target) {
  const ref = await L.makeReference(page, target);
  await L.armObservers(page);
  const before = await L.snapshot(page, target);
  await L.clickChip(page);
  await page.waitForTimeout(1500);
  const after = await L.snapshot(page, target);
  return { ref, before, after };
}

async function scenarioTemplate() {
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  try {
    // The app's own Audit / controls template, chosen through its own select.
    await page.selectOption('#templateSelect', { label: 'Audit / controls' });
    await page.waitForTimeout(700);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector('dialog[open]');
      if (!d) return null;
      const b = Array.from(d.querySelectorAll('button')).find(x => /replace|confirm|yes|continue|ok|use|apply/i.test(x.textContent) && !/cancel|keep/i.test(x.textContent));
      if (b) { const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent.trim() }; }
      return { none: Array.from(d.querySelectorAll('button')).map(x => x.textContent.trim()) };
    });
    if (dlg && dlg.x) { await page.mouse.click(dlg.x, dlg.y); await page.waitForTimeout(2500); }
    const src = await page.$eval('#source', e => e.value);
    const nodeOpts = await page.evaluate(() => Array.from(document.querySelectorAll('#nodeStyleTarget option')).map(o => o.value));
    // Pick a mid-diagram block from the template itself.
    const target = nodeOpts[Math.min(3, nodeOpts.length - 1)];
    const r = await arrivalRun(page, target);
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_tmpl_' + TAG + '.png' });
    return { dlg, sourceHead: src.split('\n').slice(0, 6).join(' | '), nodeOpts, target, ...r, errors: errors.slice() };
  } finally { await close(); }
}

async function scenarioSubgraph() {
  const { page, errors, close } = await L.openApp(APP, PORT + 1, { width: 1024, height: 700 });
  try {
    await L.setSource(page, SUBGRAPH, 3600);
    const src = await page.$eval('#source', e => e.value);
    if (!/subgraph AUD/.test(src)) throw new Error('FIXTURE MISMATCH ' + src.slice(0, 80));
    const r = await arrivalRun(page, 'D');
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_subg_' + TAG + '.png' });
    return { fixtureOk: true, ...r, errors: errors.slice() };
  } finally { await close(); }
}

(async () => {
  const out = { tag: TAG, scenarios: {} };
  for (const [n, fn] of Object.entries({ template: scenarioTemplate, subgraph: scenarioSubgraph })) {
    try { out.scenarios[n] = await fn(); } catch (e) { out.scenarios[n] = { ERROR: String(e.message) }; }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p9_' + TAG + '.json', JSON.stringify(out, null, 1));
  for (const [n, s] of Object.entries(out.scenarios)) {
    if (s.ERROR) { console.log(TAG, n, 'ERROR', s.ERROR); continue; }
    const a = s.after, b = s.before;
    console.log(TAG, n, 'target=' + s.target, 'beforeVis=' + JSON.stringify(b && b.visible), 'afterVis=' + JSON.stringify(a && a.visible),
      'scroll=' + (b && b.scrollTop) + '->' + (a && a.scrollTop), 'insp=' + (a && a.inspectorHidden), JSON.stringify(a && a.inspectorHeading),
      'ring=' + (a && a.ring), 'toasts=' + JSON.stringify(a && a.toasts.map(t => t.text)));
  }
})();
