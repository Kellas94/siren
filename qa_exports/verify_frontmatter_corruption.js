#!/usr/bin/env node
/* Does the Guided row menu now write into the YAML frontmatter?
 *
 * The round 8 verification reports this as the one thing that blocks the ship: right-click the
 * "title:" line inside frontmatter, choose an insert action, and the typed word is folded into the
 * diagram's title instead of becoming a block - with the lint still green and the block counter
 * claiming a block that is not in the picture. It says the base had those rows disabled and AM
 * turned them on.
 *
 * That is a silent corruption of what someone wrote, so it gets checked here rather than taken on
 * report. Base and patched, same script, so the "AM turned them on" half is measured too.
 *
 * Usage: node verify_frontmatter_corruption.js --app <path> [--port 9790] [--tag base|merged]
 */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round8/merged.html');
const PORT = Number(arg('port', '9790'));
const TAG = arg('tag', 'merged');

// A FLOWCHART, not a pie. On a code-first type the block operations are disabled anyway, so a pie
// fixture cannot reach the reported defect - it reports "not reproduced" on a route that was never
// live. AM makes structureIsFlowchart see past the frontmatter, which is exactly what can turn
// those rows on for the frontmatter lines too.
const SRC = ['---', 'title: Q3 approvals', '---', 'flowchart TD',
             '  A[Request] --> B[Approve]', '  B --> C[Pay]'].join('\n');

/* Find the Guided row whose code is the frontmatter "title:" line, and return where to right-click. */
const FIND_ROW = `(() => {
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const texts = rows.map(r => r.textContent.replace(/\\s+/g, ' ').trim());
  // The row text carries its line number as a prefix, with no separator: "2title: Q3 approvals".
  // Matching on ^title: found nothing and looked like the frontmatter row was absent. Written
  // without character classes on purpose - this is inside a template literal, where a single
  // backslash collapses and turns the regex into something that matches nothing.
  const idx = texts.findIndex(t => t.indexOf('title: Q3') >= 0);
  if (idx < 0) return JSON.stringify({ ok: false, texts });
  const r = rows[idx].getBoundingClientRect();
  return JSON.stringify({ ok: true, idx, texts,
    x: Math.round(r.left + Math.min(40, r.width / 2)), y: Math.round(r.top + r.height / 2) });
})()`;

const STATE = `(() => JSON.stringify({
  source: document.getElementById('source').value,
  title: (document.getElementById('diagramTitle') || {}).value,
  counter: (document.getElementById('structureCount') || {}).textContent,
  rows: document.querySelectorAll('#structureRows .struct-code').length,
  lint: (document.getElementById('lintStatus') || {}).textContent
}))()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await setSource(page, SRC, 4000);
  await openGuided(page);
  await page.waitForTimeout(700);

  const row = JSON.parse(await page.evaluate(FIND_ROW));
  if (!row.ok) { check('setup.findsTitleRow', false, 'a Guided row for the frontmatter title line', JSON.stringify(row.texts)); await close(); process.exit(1); }
  const before = JSON.parse(await page.evaluate(STATE));

  await page.mouse.click(row.x, row.y, { button: 'right' });
  await page.waitForTimeout(800);

  const menu = JSON.parse(await page.evaluate(`(() => {
    const m = document.querySelector('.struct-menu');
    if (!m) return JSON.stringify({ open: false });
    return JSON.stringify({ open: true,
      rows: Array.from(m.querySelectorAll('.struct-menu-item')).map(b => ({
        text: b.textContent.replace(/\\s+/g, ' ').trim(), disabled: b.disabled })) });
  })()`));

  const inserts = (menu.rows || []).filter(r => /insert|add|block below|block above/i.test(r.text));
  const liveInserts = inserts.filter(r => !r.disabled);
  console.log(`\n  ${TAG}: menu rows -> ${(menu.rows || []).map(r => r.text + (r.disabled ? ' [off]' : '')).join(' | ')}\n`);

  check(`${TAG}.insertRowsOffInsideFrontmatter`, liveInserts.length === 0,
    'no live insert action is offered on a frontmatter line',
    liveInserts.length ? `LIVE: ${liveInserts.map(r => r.text).join(', ')}` : 'all insert rows disabled or absent');

  if (liveInserts.length) {
    // take the offer and see what it does to the document
    await page.evaluate(`(() => {
      const m = document.querySelector('.struct-menu');
      const b = Array.from(m.querySelectorAll('.struct-menu-item')).find(x =>
        !x.disabled && /insert|block below|add/i.test(x.textContent));
      if (b) b.click();
    })()`);
    await page.waitForTimeout(900);
    await page.keyboard.type('Escalate', { delay: 45 });
    await page.waitForTimeout(1500);
    const after = JSON.parse(await page.evaluate(STATE));

    console.log('  before source:', JSON.stringify(before.source));
    console.log('  after  source:', JSON.stringify(after.source));
    console.log('  title  :', JSON.stringify(before.title), '->', JSON.stringify(after.title));
    console.log('  counter:', JSON.stringify(before.counter), '->', JSON.stringify(after.counter));
    console.log();

    check(`${TAG}.titleNotSilentlyRewritten`, after.title === before.title,
      'the diagram title is not rewritten by inserting a block',
      `${JSON.stringify(before.title)} -> ${JSON.stringify(after.title)}`);

    const wordInFrontmatter = /title:.*Escalate/.test(after.source);
    check(`${TAG}.wordDidNotLandInFrontmatter`, !wordInFrontmatter,
      'the typed word did not get folded into the YAML title line',
      wordInFrontmatter ? 'FOLDED INTO FRONTMATTER: ' + JSON.stringify(after.source.split('\n').slice(0, 3).join(' / ')) : 'not in frontmatter');
  }

  check(`${TAG}.noErrors`, errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: `C:/Claude/SIREN/pending/round8/frontmatter_${TAG}.png` });
  await close();
  report(`frontmatter corruption (${TAG})`);
  process.exit(0);
})();
