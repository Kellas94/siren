#!/usr/bin/env node
/* The diagram type has two controls: the chip (#diagramTypeChip, a status that is also a button)
 * and the picker (#diagramTypeSelect). updateDiagramTypeChip refuses to re-sync the picker while
 * the picker has focus - and the chip's own action is to FOCUS the picker. So does pressing the
 * chip leave the two disagreeing about what kind of diagram is on screen?
 * Usage: node probe_type_two_controls.js [--port 9822]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9822'));
const OUT = 'C:/Claude/SIREN/qa_exports/r11_dupe/';

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(160);
  }
}

const READ = `(() => JSON.stringify({
  chip: (document.getElementById('diagramTypeText')||{}).textContent,
  chipTitle: String((document.getElementById('diagramTypeChip')||{}).title || '').slice(0, 70),
  picker: (document.getElementById('diagramTypeSelect')||{}).value,
  pickerLabel: (() => { const s = document.getElementById('diagramTypeSelect'); return s && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : null; })(),
  hint: String((document.getElementById('diagramTypeHint')||{}).textContent || '').replace(/\\s+/g,' ').trim().slice(0, 80),
  focused: document.activeElement ? document.activeElement.id : null,
  sourceFirst: (document.getElementById('source').value||'').split(String.fromCharCode(10)).find(l => l.trim()) || ''
}))()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');

  console.log('--- control 1 (the chip) and control 2 (the picker), with nothing focused ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2600);
  console.log('  ' + await page.evaluate(READ));

  console.log('\n  now type a pie chart while nothing is focused:');
  await page.evaluate(`(() => { document.body.click(); const s = document.getElementById('source'); s.value = 'pie showData\\n  title Coverage\\n  "a" : 1\\n  "b" : 2'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2600);
  console.log('  ' + await page.evaluate(READ));

  console.log('\n--- now PRESS THE CHIP (its whole job is to reveal the picker), then change the type ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2600);
  await page.evaluate(`(() => { const c = document.getElementById('diagramTypeChip'); c.click(); })()`);
  await page.waitForTimeout(1200);
  console.log('  right after pressing the chip: ' + await page.evaluate(READ));
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'pie showData\\n  title Coverage\\n  "a" : 1\\n  "b" : 2'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2800);
  const after = JSON.parse(await page.evaluate(READ));
  console.log('  after the source becomes a pie chart: ' + JSON.stringify(after));
  const disagree = after.chip && after.pickerLabel && !new RegExp(after.pickerLabel.slice(0, 4), 'i').test(after.chip);
  console.log('  chip says "' + after.chip + '", picker says "' + after.pickerLabel + '", hint says "' + after.hint + '"');
  console.log('  the two controls disagree about the diagram type: ' + disagree);
  await page.screenshot({ path: OUT + 'type_two_controls.png', clip: { x: 0, y: 0, width: 720, height: 420 } }).catch(() => {});

  console.log('\n  and what happens if the picker is now used (it still reads Flowchart):');
  const before = await page.evaluate(`document.getElementById('source').value`);
  await page.evaluate(`(async () => {
    const st = document.getElementById('newDiagramTypeButton');
    if (st && !st.disabled) st.click();
    await new Promise(r => setTimeout(r, 800));
  })()`);
  const dlg = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); return d ? String(d.textContent||'').replace(/\\s+/g,' ').trim().slice(0, 170) : 'no dialog'; })()`);
  console.log('  pressing "New starter" while the picker reads Flowchart over a pie chart raises: ' + JSON.stringify(dlg));
  await page.evaluate(`(() => { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} }); })()`);

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
