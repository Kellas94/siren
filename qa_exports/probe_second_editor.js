#!/usr/bin/env node
/* What does the second editor slot actually offer, per diagram type?
 *
 * The complaint is that "Visual" sits at the same rank as "Code", which reads as a choice between
 * two ways of working on the same thing - while on most types the panel cannot touch the diagram at
 * all. Earlier notes on this disagree with each other (two types, four types, five types), so this
 * measures it fresh rather than trusting any of them.
 *
 * For each type the app offers: is the button enabled, does the panel render, and - the only
 * question that matters - can it actually CHANGE the source? A panel that draws six numbered steps
 * over a diagram it cannot edit is the defect, and only the third column detects it.
 *
 * Usage: node probe_second_editor.js [--app <path>] [--port 9890]
 */
const { openApp, check, report } = require('./r7_lib');
const fs = require('fs');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/wonders_build/app.html');
const PORT = Number(arg('port', '9890'));

const TYPES = `(() => {
  const sel = document.getElementById('diagramTypeSelect');
  return JSON.stringify(Array.from(sel.options).map(o => [o.value, o.textContent.trim()]));
})()`;

/* Create the type through the app's own starter, answering its confirmation, then open the second
   editor and see what it offers. */
const INSPECT = value => `(async () => {
  const sel = document.getElementById('diagramTypeSelect');
  sel.value = ${JSON.stringify(value)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  const starter = document.getElementById('newDiagramTypeButton');
  if (starter && !starter.disabled) { starter.click(); await new Promise(r => setTimeout(r, 400)); }
  const dlg = document.querySelector('dialog[open]');
  if (dlg) {
    const go = Array.from(dlg.querySelectorAll('button')).find(b => /replace|confirm|continue|create|start|yes/i.test(b.textContent) && !/cancel|keep/i.test(b.textContent));
    if (go) go.click();
    await new Promise(r => setTimeout(r, 1400));
  }
  await new Promise(r => setTimeout(r, 1800));

  const btn = document.getElementById('visualModeButton');
  const before = document.getElementById('source').value;
  btn.click();
  await new Promise(r => setTimeout(r, 1200));

  const panel = document.getElementById('visualModePanel');
  const pr = panel ? panel.getBoundingClientRect() : null;
  const controls = panel ? Array.from(panel.querySelectorAll('button, input, select'))
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).length : 0;

  /* The decisive move: try to add a block through the builder's own control and see whether the
     source changes. Nothing else distinguishes a working panel from a decorative one. */
  let edited = false, how = 'no add control';
  const label = panel && panel.querySelector('input[type="text"], input:not([type])');
  const add = panel && Array.from(panel.querySelectorAll('button')).find(b => /add .*block|add process|\\+ *add/i.test(b.textContent));
  if (add && !add.disabled) {
    how = add.textContent.replace(/\\s+/g, ' ').trim().slice(0, 24);
    if (label) { label.value = 'ProbeBlock'; label.dispatchEvent(new Event('input', { bubbles: true })); }
    add.click();
    await new Promise(r => setTimeout(r, 1500));
    edited = document.getElementById('source').value !== before;
  } else if (add) { how = 'add control disabled'; }

  return JSON.stringify({
    buttonLabel: btn.textContent.replace(/\\s+/g, ' ').trim(),
    buttonDisabled: btn.disabled,
    panelRendered: !!(pr && pr.width > 20 && pr.height > 20),
    visibleControls: controls,
    canEdit: edited,
    how,
    declaration: (document.getElementById('source').value.split(/\\r?\\n/).find(l => l.trim()) || '').slice(0, 26)
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  const types = JSON.parse(await page.evaluate(TYPES));
  console.log(`\n  ${types.length} diagram types offered\n`);
  console.log('  type            button          panel   controls  CAN EDIT');
  console.log('  ' + '-'.repeat(66));

  const rows = [];
  for (const [value, label] of types) {
    let r;
    try { r = JSON.parse(await page.evaluate(INSPECT(value))); }
    catch (e) { r = { buttonLabel: 'ERR', panelRendered: false, visibleControls: 0, canEdit: false, how: String(e.message).slice(0, 30) }; }
    rows.push({ value, label, ...r });
    console.log(`  ${value.padEnd(14)}  ${String(r.buttonLabel).padEnd(14)}  ${r.panelRendered ? 'yes' : 'NO '}     ${String(r.visibleControls).padStart(3)}      ${r.canEdit ? 'YES' : 'no '}   ${r.canEdit ? '' : '(' + r.how + ')'}`);
  }

  const editable = rows.filter(r => r.canEdit);
  const offered = rows.filter(r => !r.buttonDisabled);
  const decorative = rows.filter(r => r.panelRendered && !r.canEdit);

  console.log();
  check('builder.offeredEverywhere', offered.length === rows.length,
    'the button is offered on every type',
    `${offered.length} of ${rows.length}`);
  check('builder.actuallyEdits', editable.length > 0,
    'it can edit at least one type',
    `${editable.length} of ${rows.length}: ${editable.map(r => r.value).join(', ')}`);
  check('builder.noDecorativePanels', decorative.length === 0,
    'no type gets a panel it cannot use',
    `${decorative.length} render a panel that cannot edit: ${decorative.map(r => r.value).join(', ')}`);
  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');

  fs.writeFileSync('C:/Claude/SIREN/pending/wonders/second_editor.json', JSON.stringify(rows, null, 2));
  await close();
  report('second editor');
  process.exit(0);
})();
