#!/usr/bin/env node
/* Does the second editor slot now offer what the diagram type actually supports?
 *
 * Before this change, measured across all twenty types: the builder could edit 3, sequence had its
 * own editor, and 16 opened a panel that announced "Build without code" and then explained it could
 * not. The claim now is that the slot says Build, Sequence or Guided, and that pressing it goes
 * where the label says.
 *
 * The check that matters is the last one. A label is easy; a label that routes somewhere useful is
 * the thing being promised. So for every type this presses the button and asks where it landed.
 *
 * Usage: node verify_second_slot.js [--app <path>] [--port 9920]
 */
const { openApp, check, report } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/slot/app.html');
const PORT = Number(arg('port', '9920'));

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
    await new Promise(r => setTimeout(r, 1300));
  }
  await new Promise(r => setTimeout(r, 1700));
  return document.getElementById('visualModeButton').textContent.trim();
})()`;

/* Press it, then ask where we actually are. */
const PRESS = `(async () => {
  const btn = document.getElementById('visualModeButton');
  const slot = btn.dataset.slot || '(none)';
  btn.click();
  await new Promise(r => setTimeout(r, 1400));
  // The sequence builder is #sequencePanel, not #visualModePanel. Looking only at the latter
  // reported a working editor as 'Guided' - the probe in the wrong place, not the app.
  const seqPanel = document.getElementById('sequencePanel');
  const seqRect = seqPanel ? seqPanel.getBoundingClientRect() : null;
  const seqOpen = !!(seqRect && seqRect.width > 60 && seqRect.height > 40);
  const visual = document.getElementById('visualModePanel');
  const rows = document.querySelectorAll('#structureRows .struct-code').length;
  const vr = visual ? visual.getBoundingClientRect() : null;
  const usableInVisual = visual && vr && vr.width > 20 ? Array.from(visual.querySelectorAll('button, input, select'))
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.disabled; }).length : 0;
  return JSON.stringify({
    slot,
    label: btn.textContent.trim(),
    visualOpen: !!(vr && vr.width > 20 && vr.height > 20),
    guidedRows: rows,
    usableInVisual,
    seqOpen,
    seqUsable: seqOpen ? Array.from(seqPanel.querySelectorAll('button, input, select')).filter(e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !e.disabled; }).length : 0
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  const types = JSON.parse(await page.evaluate(TYPES));

  console.log(`\n  type            slot      label          lands on              usable`);
  console.log('  ' + '-'.repeat(70));
  const rows = [];
  for (const value of types) {
    await page.evaluate(MAKE(value));
    const r = JSON.parse(await page.evaluate(PRESS));
    const landed = r.seqOpen ? `the sequence builder (${r.seqUsable})` : r.visualOpen ? 'the builder panel' : (r.guidedRows > 0 ? `Guided (${r.guidedRows} rows)` : 'NOWHERE');
    rows.push({ value, ...r, landed });
    console.log(`  ${value.padEnd(14)}  ${r.slot.padEnd(8)}  ${r.label.padEnd(13)}  ${landed.padEnd(20)}  ${r.visualOpen ? r.usableInVisual : '-'}`);
  }

  const build = rows.filter(r => r.slot === 'build');
  const guided = rows.filter(r => r.slot === 'guided');
  const seq = rows.filter(r => r.slot === 'sequence');

  console.log();
  check('slot.threeKinds', build.length && guided.length && seq.length,
    'the slot takes all three forms across the types',
    `build ${build.length}, sequence ${seq.length}, guided ${guided.length}`);

  check('build.opensTheBuilder', build.every(r => r.visualOpen && r.usableInVisual > 4),
    'every Build type opens a builder with usable controls',
    build.map(r => `${r.value}:${r.visualOpen ? r.usableInVisual : 'closed'}`).join(', '));

  check('guided.landsInGuided', guided.every(r => !r.visualOpen && !r.seqOpen && r.guidedRows > 0),
    'every Guided type lands in Guided with rows, not in a builder panel',
    guided.filter(r => r.visualOpen || !r.guidedRows).map(r => r.value).join(', ') || `all ${guided.length} correct`);

  check('noType.getsADeadPanel', rows.every(r => !(r.visualOpen && r.usableInVisual <= 4)),
    'no type opens a builder panel it cannot use',
    rows.filter(r => r.visualOpen && r.usableInVisual <= 4).map(r => `${r.value}:${r.usableInVisual}`).join(', ') || 'none');

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 3).join(' // ') || 'none');

  fs.writeFileSync('C:/Claude/SIREN/pending/slot/slots.json', JSON.stringify(rows, null, 2));
  await close();
  process.exit(report('second editor slot') ? 1 : 0);
})();
