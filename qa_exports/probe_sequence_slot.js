#!/usr/bin/env node
/* Where does the Sequence slot actually land?
 *
 * The slot table reports "Guided (6 rows)" for sequence, but that reading came from a probe that
 * only looks at #visualModePanel - and refreshSequenceBuilder exists, so the sequence editor may
 * simply render somewhere else. Reporting a working feature as broken because the probe looked in
 * one place is a failure mode this project has hit repeatedly, so this looks everywhere before
 * concluding anything.
 *
 * Usage: node probe_sequence_slot.js [--app <path>] [--port 9924]
 */
const { openApp, setSource, check, report } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/slot/app.html');
const PORT = Number(arg('port', '9924'));

const NL = String.fromCharCode(10);
const SEQ = ['sequenceDiagram', '  participant Auditor', '  participant System',
             '  Auditor->>System: Request trial balance', '  System->>Auditor: Return figures'].join(NL);

/* Everything visible in the editor pane after pressing the slot, whatever it is called. */
const WHERE = `(async () => {
  const btn = document.getElementById('visualModeButton');
  btn.click();
  await new Promise(r => setTimeout(r, 1500));
  const pane = document.querySelector('.pane-scroll') || document.body;
  const panels = Array.from(pane.querySelectorAll('[id]')).filter(el => {
    if (!/panel|builder|editor/i.test(el.id)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 60 && r.height > 40;
  }).map(el => {
    const r = el.getBoundingClientRect();
    const usable = Array.from(el.querySelectorAll('button, input, select'))
      .filter(e => { const b = e.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !e.disabled; }).length;
    return { id: el.id, box: [Math.round(r.width), Math.round(r.height)], usable };
  });
  return JSON.stringify({
    label: btn.textContent.trim(),
    slot: btn.dataset.slot || null,
    editorMode: document.body.dataset.editorMode || null,
    panels,
    guidedRows: document.querySelectorAll('#structureRows .struct-code').length
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1600, height: 1000 });
  await setSource(page, SEQ, 4200);
  const r = JSON.parse(await page.evaluate(WHERE));

  console.log(`\n  label: ${r.label}   slot: ${r.slot}   guided rows: ${r.guidedRows}`);
  console.log('  visible panels in the editor pane:');
  r.panels.forEach(p => console.log(`     ${p.id.padEnd(24)} ${p.box[0]}x${p.box[1]}   ${p.usable} usable controls`));
  console.log();

  const seqPanel = r.panels.find(p => /sequence/i.test(p.id) && p.usable > 2);
  const anyBuilder = r.panels.find(p => p.usable > 4);

  check('sequence.labelled', r.slot === 'sequence' && /Sequence/.test(r.label),
    'the slot names itself Sequence', `${r.label} (${r.slot})`);
  check('sequence.landsSomewhereUsable', !!anyBuilder,
    'pressing it opens something with usable controls',
    anyBuilder ? `${anyBuilder.id}: ${anyBuilder.usable} controls` : 'nothing usable opened');
  check('sequence.isTheSequenceBuilder', !!seqPanel,
    'and that something is the sequence builder rather than a fallback',
    seqPanel ? `${seqPanel.id}: ${seqPanel.usable} controls` : 'no sequence-named panel is visible');

  check('noErrors', errors.length === 0, 'no page errors', errors.slice(0, 2).join(' // ') || 'none');
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/slot/sequence_slot.png' });
  await close();
  report('sequence slot');
  process.exit(0);
})();
