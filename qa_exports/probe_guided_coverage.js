#!/usr/bin/env node
/* Does Guided actually work on the types the builder cannot touch?
 *
 * The proposed change is that the second editor slot offers Build where the builder works and
 * Guided everywhere else. That is only honest if Guided genuinely works everywhere else - otherwise
 * it replaces one broken promise with a differently worded one.
 *
 * Measured per type: does Guided render real rows, does the count match the source, and can a row
 * actually be acted on. The third is the one that matters, exactly as it was for the builder.
 *
 * Usage: node probe_guided_coverage.js [--app <path>] [--port 9894]
 */
const { openApp, openGuided, check, report } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/wonders_build/app.html');
const PORT = Number(arg('port', '9894'));

const TYPES = `(() => JSON.stringify(
  Array.from(document.getElementById('diagramTypeSelect').options).map(o => o.value)))()`;

const MAKE = value => `(async () => {
  const sel = document.getElementById('diagramTypeSelect');
  sel.value = ${JSON.stringify(value)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  const starter = document.getElementById('newDiagramTypeButton');
  if (starter && !starter.disabled) { starter.click(); await new Promise(r => setTimeout(r, 400)); }
  const dlg = document.querySelector('dialog[open]');
  if (dlg) {
    const go = Array.from(dlg.querySelectorAll('button')).find(b =>
      /replace|confirm|continue|create|start|yes/i.test(b.textContent) && !/cancel|keep/i.test(b.textContent));
    if (go) go.click();
    await new Promise(r => setTimeout(r, 1400));
  }
  await new Promise(r => setTimeout(r, 1600));
  return document.getElementById('source').value;
})()`;

/* Can a Guided row be acted on? Right-click one and see whether the menu offers anything live that
   is not merely "move" - the same standard the builder was held to. */
const ACT = `(async () => {
  const rows = Array.from(document.querySelectorAll('#structureRows .struct-code'));
  if (!rows.length) return JSON.stringify({ rows: 0 });
  const target = rows[rows.length - 1];
  const box = target.getBoundingClientRect();
  target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: Math.round(box.left + 30), clientY: Math.round(box.top + box.height / 2) }));
  await new Promise(r => setTimeout(r, 700));
  const menu = document.querySelector('.struct-menu');
  const items = menu ? Array.from(menu.querySelectorAll('.struct-menu-item')).map(b => ({
    text: b.textContent.replace(/\\s+/g, ' ').trim(), off: b.disabled })) : [];
  if (menu) menu.remove();
  const live = items.filter(i => !i.off);
  return JSON.stringify({ rows: rows.length, live: live.map(i => i.text), offered: items.length });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  const types = JSON.parse(await page.evaluate(TYPES));
  console.log(`\n  type            src lines  guided rows  live row actions`);
  console.log('  ' + '-'.repeat(72));

  const rows = [];
  for (const value of types) {
    const src = await page.evaluate(MAKE(value));
    const lines = String(src).split(/\r?\n/).length;
    const count = await openGuided(page);
    await page.waitForTimeout(400);
    const act = JSON.parse(await page.evaluate(ACT));
    rows.push({ value, lines, count, live: act.live || [], offered: act.offered || 0 });
    console.log(`  ${value.padEnd(14)}  ${String(lines).padStart(6)}     ${String(count).padStart(7)}      ${(act.live || []).join(', ').slice(0, 44) || 'NONE'}`);
  }

  const empty = rows.filter(r => r.count === 0);
  const noActions = rows.filter(r => r.live.length === 0);
  const mismatched = rows.filter(r => r.count !== r.lines);

  console.log();
  check('guided.rendersEverywhere', empty.length === 0,
    'Guided renders rows on every type',
    empty.length ? 'EMPTY on: ' + empty.map(r => r.value).join(', ') : `all ${rows.length} render rows`);
  check('guided.rowsMatchSource', mismatched.length === 0,
    'the row count equals the source line count',
    mismatched.length ? mismatched.map(r => `${r.value} ${r.count}/${r.lines}`).join(', ') : 'every type matches');
  check('guided.rowsCanBeActedOn', noActions.length === 0,
    'every type offers at least one live row action',
    noActions.length ? 'NO live action on: ' + noActions.map(r => r.value).join(', ') : `all ${rows.length} offer actions`);
  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  fs.writeFileSync('C:/Claude/SIREN/pending/wonders/guided_coverage.json', JSON.stringify(rows, null, 2));
  await close();
  report('guided coverage');
  process.exit(0);
})();
