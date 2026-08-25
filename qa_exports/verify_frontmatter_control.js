#!/usr/bin/env node
/* The control for the front-matter fix: on a flowchart with NO front matter, and on the BODY lines
 * of one that has it, "Insert block below" must still be live.
 *
 * Without this a patch that simply disabled the row everywhere would pass the corruption test and
 * quietly remove a working feature - which is the failure mode this project keeps catching.
 *
 * Usage: node verify_frontmatter_control.js --app <path> [--port 9812]
 */
const { openApp, setSource, openGuided, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round8/merged.html');
const PORT = Number(arg('port', '9812'));

const NL = String.fromCharCode(10);
const PLAIN = ['flowchart TD', '  A[Request] --> B[Approve]', '  B --> C[Pay]'].join(NL);
const WITH_FM = ['---', 'title: Q3 approvals', '---', 'flowchart TD',
                 '  A[Request] --> B[Approve]', '  B --> C[Pay]'].join(NL);

const ROW_MENU = needle => `(async () => {
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  const texts = rows.map(r => r.textContent.replace(/\\s+/g, ' ').trim());
  const idx = texts.findIndex(t => t.indexOf(${JSON.stringify(needle)}) >= 0);
  if (idx < 0) return JSON.stringify({ ok: false, texts });
  const box = rows[idx].getBoundingClientRect();
  return JSON.stringify({ ok: true, idx, texts,
    x: Math.round(box.left + Math.min(40, box.width / 2)), y: Math.round(box.top + box.height / 2) });
})()`;

const READ_MENU = `(() => {
  const m = document.querySelector('.struct-menu');
  if (!m) return JSON.stringify({ open: false });
  return JSON.stringify({ open: true, rows: Array.from(m.querySelectorAll('.struct-menu-item'))
    .map(b => ({ text: b.textContent.replace(/\\s+/g, ' ').trim(), disabled: b.disabled, why: b.title || '' })) });
})()`;

async function rowMenuFor(page, source, needle) {
  await setSource(page, source, 3800);
  await openGuided(page);
  await page.waitForTimeout(600);
  const spot = JSON.parse(await page.evaluate(ROW_MENU(needle)));
  if (!spot.ok) return { ok: false, texts: spot.texts };
  await page.evaluate(`document.querySelector('.struct-menu')?.remove()`);
  await page.mouse.click(spot.x, spot.y, { button: 'right' });
  await page.waitForTimeout(800);
  const menu = JSON.parse(await page.evaluate(READ_MENU));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return { ok: true, menu };
}

const insertRow = m => (m.rows || []).find(r => /Insert block below/i.test(r.text));

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });

  // 1. no front matter at all - the row must be live
  let r = await rowMenuFor(page, PLAIN, 'A[Request]');
  let row = r.ok && insertRow(r.menu);
  check('plainFlowchart.insertStaysLive', !!row && !row.disabled,
    'a flowchart with no front matter still offers Insert block below',
    r.ok ? `${row ? row.text + (row.disabled ? ' [off: ' + row.why + ']' : ' [live]') : 'row absent'}` : 'row not found: ' + JSON.stringify(r.texts));

  // 2. front matter present, but right-click a BODY line - still live
  r = await rowMenuFor(page, WITH_FM, 'A[Request]');
  row = r.ok && insertRow(r.menu);
  check('bodyLineBelowFrontmatter.insertStaysLive', !!row && !row.disabled,
    'a body line under front matter still offers Insert block below',
    r.ok ? `${row ? row.text + (row.disabled ? ' [off: ' + row.why + ']' : ' [live]') : 'row absent'}` : 'row not found: ' + JSON.stringify(r.texts));

  // 3. the front-matter line itself - off, and it must say why
  r = await rowMenuFor(page, WITH_FM, 'title: Q3');
  row = r.ok && insertRow(r.menu);
  check('frontmatterLine.insertOff', !!row && row.disabled,
    'the front-matter line does not offer it',
    r.ok ? `${row ? row.text + (row.disabled ? ' [off]' : ' [LIVE]') : 'row absent'}` : 'row not found');
  check('frontmatterLine.saysWhy', !!row && /front matter/i.test(row.why || ''),
    'and it explains why rather than going quietly grey',
    row ? JSON.stringify(row.why) : 'no row');

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await close();
  process.exit(report('front-matter control') ? 1 : 0);
})();
