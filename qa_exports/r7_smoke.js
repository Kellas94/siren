#!/usr/bin/env node
/* Smoke test for r7_lib: does the harness reach a live, settled app, open Guided, and read what is
 * on screen? If this fails, no probe built on the library means anything. */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
const APP = process.argv[2] || 'C:/Claude/SIREN/pending/round7/app.html';

const READ = `(() => {
  const counter = document.getElementById('structureCount');
  return JSON.stringify({
    counter: counter ? counter.textContent.replace(/\\s+/g, ' ').trim() : null,
    rows: document.querySelectorAll('#structureRows .struct-code').length,
    title: (document.getElementById('diagramTitle') || {}).value,
    preview: (document.getElementById('previewHeading') || {}).textContent
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, 9880);
  const intro = await page.evaluate(`(() => { const i = document.getElementById('sirenIntroOverlay'); return i ? i.hidden : 'missing'; })()`);
  check('harness.introDismissed', intro === true, 'intro overlay hidden', String(intro));

  await setSource(page, 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]\n  C --> A');
  const rowCount = await openGuided(page);
  check('harness.opensGuided', rowCount > 0, 'Guided rows render once Code mode is entered', String(rowCount));

  const state = JSON.parse(await page.evaluate(READ));
  check('harness.readsCounter', !!state.counter, 'the Guided counter has text', JSON.stringify(state));
  check('harness.noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/smoke.png' });
  await close();
  process.exit(report('r7 smoke') ? 1 : 0);
})();
