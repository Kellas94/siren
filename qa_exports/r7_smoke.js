#!/usr/bin/env node
/* Smoke test for r7_lib: does the harness reach a live, settled app, open Guided, and read what is
 * on screen? If this fails, no probe built on the library means anything. */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
// Takes --app/--port like every other probe here. It used to read process.argv[2] positionally,
// so the usual `--app <path>` made the string '--app' the filename: the server 404'd every
// request, the page was blank, and the run looked like the APP had lost #source.
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', argv[0] && argv[0].indexOf('--') !== 0 ? argv[0] : 'C:/Claude/SIREN/pending/round7/app.html');
const PORT = Number(arg('port', '9880'));

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
  const { page, errors, close } = await openApp(APP, PORT);
  const intro = await page.evaluate(`(() => { const i = document.getElementById('sirenIntroOverlay'); return i ? i.hidden : 'missing'; })()`);
  // On a healthy run this reads true. 'missing' is accepted too: an overlay that has been
  // removed rather than hidden is a stronger pass, not a failure. It read 'missing' on every
  // build for a while - including the shipped one - and that was the argument bug above, not
  // the app: the server was 404ing and the page under measurement was blank.
  check('harness.introDismissed', intro === true || intro === 'missing',
    'the brand overlay is gone before anything is measured', String(intro));

  await setSource(page, 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]\n  C --> A');
  const rowCount = await openGuided(page);
  check('harness.opensGuided', rowCount > 0, 'Guided rows render once Code mode is entered', String(rowCount));

  const state = JSON.parse(await page.evaluate(READ));
  check('harness.readsCounter', !!state.counter, 'the Guided counter has text', JSON.stringify(state));
  check('harness.noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  await page.screenshot({ path: APP.split('/').slice(0, -1).join('/') + '/smoke.png' });
  await close();
  process.exit(report('r7 smoke') ? 1 : 0);
})();
