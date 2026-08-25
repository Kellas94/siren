#!/usr/bin/env node
/* On a diagram type that sets its own direction, the View menu's flow rows must be greyed AND must
 * say why - carrying the app's own #orientationHint sentence rather than going silent.
 *
 * The positive control matters here: on a flowchart the same two rows must be ENABLED. Without it,
 * a bug that disables everything would read as a pass.
 *
 * Usage: node verify_disabled_reason.js [--app <path>] [--port 9890]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/merged_test.html');
const PORT = Number(arg('port', '9890'));

const OPEN_VIEW = `(async () => {
  document.querySelector('.struct-menu')?.remove();
  document.getElementById('previewViewButton').click();
  await new Promise(r => setTimeout(r, 700));
  const menu = document.querySelector('.struct-menu');
  if (!menu) return JSON.stringify({ error: 'no menu' });
  const rows = Array.from(menu.querySelectorAll('.struct-menu-item')).map(b => ({
    label: b.textContent.replace(/\\s+/g, ' ').trim(),
    disabled: b.disabled,
    selected: b.getAttribute('aria-selected') === 'true',
    tooltip: b.title || ''
  }));
  const headings = Array.from(menu.querySelectorAll('.struct-menu-heading')).map(h => h.textContent.trim());
  const hint = document.getElementById('orientationHint');
  return JSON.stringify({ rows, headings, hintHidden: hint ? hint.hidden : null, hintTitle: hint ? hint.title : null });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT);

  // Positive control first: on a flowchart the flow rows must be live.
  await setSource(page, 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]');
  const flow = JSON.parse(await page.evaluate(OPEN_VIEW));
  const fRows = flow.rows.filter(r => /Vertical|Horizontal/.test(r.label));
  check('control.flowchartRowsEnabled', fRows.length === 2 && fRows.every(r => !r.disabled),
    'both flow rows enabled on a flowchart',
    fRows.map(r => `${r.label}:${r.disabled ? 'disabled' : 'enabled'}`).join(', ') || 'none found');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Now the case the change is for.
  await setSource(page, 'mindmap\n  root((Root))\n    A\n      A1\n    B', 3500);
  const mind = JSON.parse(await page.evaluate(OPEN_VIEW));
  const mRows = mind.rows.filter(r => /Vertical|Horizontal/.test(r.label));
  check('mindmap.rowsDisabled', mRows.length === 2 && mRows.every(r => r.disabled),
    'both flow rows disabled on a mindmap',
    mRows.map(r => `${r.label}:${r.disabled ? 'disabled' : 'enabled'}`).join(', ') || 'none found');

  const withReason = mRows.filter(r => r.tooltip && r.tooltip.length > 12);
  check('mindmap.rowsSayWhy', withReason.length === 2,
    'both disabled rows carry an explanation',
    mRows.map(r => `${r.label}: "${r.tooltip}"`).join('  |  ') || 'no tooltips');

  check('mindmap.reasonIsTheAppsOwn', mRows.every(r => r.tooltip === mind.hintTitle),
    'the tooltip is the app\'s own orientation hint, not a re-worded copy',
    `hint=${JSON.stringify(mind.hintTitle)}  row=${JSON.stringify(mRows[0] && mRows[0].tooltip)}`);

  const marked = mind.rows.filter(r => r.selected);
  check('mindmap.noFalseCurrent', marked.length === 0,
    'no row is marked current on a type with no direction',
    marked.length ? marked.map(r => r.label).join(', ') : 'none marked');

  const fMarked = flow.rows.filter(r => r.selected).map(r => r.label);
  check('control.flowchartHasACurrent', fMarked.length === 1,
    'exactly one flow row IS marked current on a flowchart',
    fMarked.join(', ') || 'none marked - the marking is broken, not just absent');

  // Fit and Zoom left this menu when the zoom cluster went back on the toolbar, so the menu now
  // holds exactly one two-state choice - and on a mindmap both answers are correctly unavailable.
  // What has to stay true is that the choice is still SHOWN and explained rather than hidden, and
  // that the actions which left are reachable where they went.
  check('mindmap.bothDirectionsStillOffered', mind.rows.length === 2,
    'the menu still names both directions rather than emptying itself',
    mind.rows.map(r => `${r.label}:${r.disabled ? 'off' : 'on'}`).join(', '));

  const zoomOnBar = await page.evaluate(`(() => { const c = document.getElementById('zoomChipButton');
    if (!c) return false; const r = c.getBoundingClientRect(); return r.width > 2 && r.height > 2; })()`);
  check('mindmap.zoomReachableElsewhere', zoomOnBar === true,
    'the zoom controls that left the menu are on the toolbar instead',
    `zoom chip visible: ${zoomOnBar}`);

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  const menu = page.locator('.struct-menu').first();
  if (await menu.count()) await menu.screenshot({ path: 'C:/Claude/SIREN/pending/round7/view_menu_mindmap.png' });
  await close();
  process.exit(report('disabled reason') ? 1 : 0);
})();
