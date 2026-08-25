#!/usr/bin/env node
/* Does the code-only chip still promise branch colours after the diagram stops being a git graph?
 *
 * The chip lives about nine seconds and its sentence was composed once, inside `if (!chip)`, behind
 * an early return. Switching family inside that window left it saying "...export and branch colours"
 * over a pie chart whose right-click menu has no colour row.
 *
 * Both directions matter and they are different bugs:
 *   git graph -> pie  is an OVER-promise: it offers something the menu does not have.
 *   pie -> git graph  is an UNDER-promise: the colours exist and the chip does not mention them.
 * A fix that only hides the chip would pass the first and fail the second, so both are asserted.
 *
 * Usage: node verify_chip_freshness.js [--port 9692]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/replay.html');
const PORT = Number(arg('port', '9692'));

const GIT = 'gitGraph\n  commit\n  branch develop\n  checkout develop\n  commit\n  checkout main\n  merge develop';
const PIE = 'pie title Split\n  "Approved" : 60\n  "Rejected" : 40';

const CHIP = `(() => {
  const chip = document.querySelector('.canvas-hint');
  if (!chip) return JSON.stringify({ present: false });
  const r = chip.getBoundingClientRect();
  return JSON.stringify({
    present: true,
    onScreen: r.width > 4 && r.height > 4,
    text: (chip.querySelector('span') || chip).textContent.replace(/\\s+/g, ' ').trim()
  });
})()`;

(async () => {
  let { page, errors, close } = await openApp(APP, PORT);
  let closeAll = close;

  // --- git graph first: the chip should name branch colours -------------------------------
  await setSource(page, GIT, 4000);
  let c = JSON.parse(await page.evaluate(CHIP));
  check('gitgraph.chipNamesColours', c.present && /branch colours/.test(c.text || ''),
    'on a git graph the chip names branch colours',
    c.present ? JSON.stringify(c.text) : 'no chip appeared');

  // --- switch to a pie INSIDE the chip's lifetime ------------------------------------------
  await setSource(page, PIE, 2600);
  c = JSON.parse(await page.evaluate(CHIP));
  const stillPromising = c.present && c.onScreen && /branch colours/.test(c.text || '');
  check('pie.noStaleColourPromise', !stillPromising,
    'after switching to a pie the chip must not still promise branch colours',
    c.present ? `${c.onScreen ? 'on screen' : 'hidden'}: ${JSON.stringify(c.text)}` : 'chip gone');

  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/chip_after_switch.png' });

  // --- and the other direction: pie first, then git graph ----------------------------------
  // A reload is NOT enough: state.codeOnlyHintSeen is persisted, so the one-time chip never
  // reappears and both remaining assertions pass on nothing. A second, clean browser context is the
  // only way to reach this direction at all.
  await close();
  const second_ = await openApp(APP, PORT + 1);
  page = second_.page; errors.length = 0;
  closeAll = second_.close;
  await setSource(page, PIE, 4000);
  const first = JSON.parse(await page.evaluate(CHIP));
  check('pie.chipOmitsColours', first.present && !/branch colours/.test(first.text || ''),
    'on a pie the chip promises only fit, size and export',
    first.present ? JSON.stringify(first.text) : 'no chip appeared');

  await setSource(page, GIT, 2600);
  const second = JSON.parse(await page.evaluate(CHIP));
  const underPromising = second.present && second.onScreen && !/branch colours/.test(second.text || '');
  check('gitgraph.noStaleUnderPromise', !underPromising,
    'after switching to a git graph the chip must not still omit branch colours',
    second.present ? `${second.onScreen ? 'on screen' : 'hidden'}: ${JSON.stringify(second.text)}` : 'chip gone');

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await closeAll();
  process.exit(report('chip freshness') ? 1 : 0);
})();
