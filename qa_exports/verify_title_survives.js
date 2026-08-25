#!/usr/bin/env node
/* The rule this project holds above every other: nothing silently overwrites what someone wrote.
 *
 * Codex claims a title a PERSON typed survives a type change. He tested one route - Style surface,
 * then switch to Pie. A claim like that fails one step away from the route it was tested on, so this
 * drives FOUR different ways of changing the diagram's type and checks all three title surfaces
 * after each.
 *
 * The positive control matters as much as the claim: an UNTOUCHED default title must still follow
 * the family (that is AG's whole point). A build that simply froze every title would pass the
 * survival test and fail the product.
 *
 * Usage: node verify_title_survives.js [--app <path>] [--port 9898]
 */
const { openApp, setSource, confirmDialog, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round7/replay.html');
const PORT = Number(arg('port', '9898'));

const TITLES = `(() => JSON.stringify({
  field: (document.getElementById('diagramTitle') || {}).value,
  preview: (document.getElementById('diagramTitlePreview') || {}).textContent,
  heading: (document.getElementById('previewHeading') || {}).textContent
}))()`;

const SET_TITLE = name => `(() => {
  const f = document.getElementById('diagramTitle');
  if (!f) return 'no title field';
  f.value = ${JSON.stringify(name)};
  f.dispatchEvent(new Event('input', { bubbles: true }));
  f.dispatchEvent(new Event('change', { bubbles: true }));
  return f.value;
})()`;

const PICK_TYPE = value => `(() => {
  const sel = document.getElementById('diagramTypeSelect');
  if (!sel) return 'no type picker';
  const has = Array.from(sel.options).some(o => o.value === ${JSON.stringify(value)});
  if (!has) return 'no such option: ' + Array.from(sel.options).map(o => o.value).join(',');
  sel.value = ${JSON.stringify(value)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return 'picked';
})()`;

const CUSTOM = 'Raport client — TB reconciliation';

(async () => {
  const { page, errors, close } = await openApp(APP, PORT);

  // ---- positive control: an untouched default title must FOLLOW the family ------------------
  await setSource(page, 'pie title Split\n  "A" : 60\n  "B" : 40', 3500);
  let t = JSON.parse(await page.evaluate(TITLES));
  check('control.defaultFollowsFamily', /pie/i.test(t.heading || ''),
    'an untouched default title names the family (Pie)',
    JSON.stringify(t));

  // ---- now a title a person typed, then four different ways of changing the type ------------
  const routes = [
    ['typedSource.mindmap', async () => {
      await setSource(page, 'mindmap\n  root((Root))\n    A\n      A1\n    B', 3500);
    }],
    ['typedSource.sequence', async () => {
      await setSource(page, 'sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n  B->>A: ok', 3500);
    }],
    ['typePicker.flowchart', async () => {
      const r = await page.evaluate(PICK_TYPE('flowchart'));
      const dlg = await confirmDialog(page, 1500);
      return `picker=${r} dialog=${dlg}`;
    }],
    ['typedSource.gantt', async () => {
      await setSource(page, 'gantt\n  title Plan\n  section One\n  Task A :a1, 2026-01-01, 30d\n  Task B :after a1, 20d', 3500);
    }],
  ];

  for (const [name, go] of routes) {
    await page.evaluate(SET_TITLE(CUSTOM));
    await page.waitForTimeout(700);
    const before = JSON.parse(await page.evaluate(TITLES));
    if (before.field !== CUSTOM) {
      check(`${name}.setup`, false, 'the custom title was accepted before the route ran', JSON.stringify(before));
      continue;
    }
    const detail = await go();
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(TITLES));
    const kept = after.field === CUSTOM && after.preview === CUSTOM && after.heading === CUSTOM;
    check(`${name}.titleSurvives`, kept,
      `all three surfaces still read "${CUSTOM}"`,
      `field=${JSON.stringify(after.field)} preview=${JSON.stringify(after.preview)} heading=${JSON.stringify(after.heading)}${detail ? ' | ' + detail : ''}`);
  }

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/title_survives.png' });
  await close();
  process.exit(report('title survival') ? 1 : 0);
})();
