#!/usr/bin/env node
/* The owner reports: on some diagrams the Guided tab is not clickable, and if it cannot work it
 * should not be there at all.
 *
 * That tab is mine, shipped this morning in 1.70.0. My own verification covered six types and all
 * six worked. This drives all TWENTY the picker offers, through the app's OWN starter for each type
 * rather than a source string I invented - because a type reached by typing may not be the same
 * state as a type reached the way a person reaches it.
 *
 * For each: what does the tab say, is it painted usable, does a REAL click do anything, and does
 * what appears afterwards actually let you edit that diagram?
 *
 * Usage: node probe_guided_all_types.js [--app <path>] [--port 9780]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9780'));

const TYPES = ['flowchart', 'swimlane', 'state', 'sequence', 'architecture', 'c4', 'er', 'class',
  'block', 'gantt', 'timeline', 'kanban', 'journey', 'mindmap', 'ishikawa', 'requirement',
  'gitgraph', 'xy', 'pie', 'advanced'];

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
    await page.waitForTimeout(170);
  }
}

/* Pick a type the way a person does, through the picker, and take its starter. */
const PICK = t => `(async () => {
  const sel = document.getElementById('diagramTypeSelect');
  if (!sel) return JSON.stringify({ error: 'no picker' });
  sel.value = ${JSON.stringify(t)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 900));
  const starter = document.getElementById('newStarterButton')
    || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
  if (starter && !starter.disabled) { starter.click(); await new Promise(r => setTimeout(r, 900)); }
  const dlg = document.querySelector('dialog[open]');
  if (dlg) {
    const go = Array.from(dlg.querySelectorAll('button')).find(b => /continue|replace|start|yes|ok/i.test(b.textContent || ''));
    if (go) { go.click(); await new Promise(r => setTimeout(r, 1400)); }
  }
  document.getElementById('codeModeButton')?.click();
  await new Promise(r => setTimeout(r, 350));
  document.getElementById('textModeButton')?.click();
  await new Promise(r => setTimeout(r, 350));
  const src = document.getElementById('source').value || '';
  return JSON.stringify({ starterUsed: !!(starter && !starter.disabled), firstLine: src.split(String.fromCharCode(10))[0].slice(0, 40),
    lines: src.split(String.fromCharCode(10)).filter(l => l.trim()).length });
})()`;

const READ_TAB = `(() => {
  const b = document.getElementById('visualModeButton');
  const cs = getComputedStyle(b);
  const r = b.getBoundingClientRect();
  return JSON.stringify({
    label: (b.textContent || '').trim(), slot: b.dataset.slot || null,
    aria: b.getAttribute('aria-disabled'), unavail: b.classList.contains('is-unavailable'),
    opacity: cs.opacity, pointerEvents: cs.pointerEvents, cursor: cs.cursor,
    box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
  });
})()`;

const READ_AFTER = `(() => {
  const vis = e => !!(e && !e.hidden && e.getBoundingClientRect().height > 2);
  const se = document.getElementById('structureEditor');
  const rows = document.querySelectorAll('#structureRows .struct-code').length;
  // A row a person can act on, not merely a line of text echoed back.
  const actionable = document.querySelectorAll('#structureRows button, #structureRows [role="button"], #structureRows .struct-chip').length;
  return JSON.stringify({
    heading: (document.getElementById('editorHeading') || {}).textContent,
    guidedShowing: vis(se), rows, actionable,
    visualShowing: vis(document.getElementById('visualModePanel')),
    sequenceShowing: vis(document.getElementById('sequencePanel')),
    textShowing: vis(document.getElementById('codeEditor'))
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');
  console.log('  type          tab          click     lands on          rows  actionable  verdict');
  console.log('  ' + '-'.repeat(88));

  const bad = [];
  for (const t of TYPES) {
    const picked = JSON.parse(await page.evaluate(PICK(t)));
    if (picked.error) { console.log('  ' + t.padEnd(14) + picked.error); continue; }
    const before = JSON.parse(await page.evaluate(READ_TAB));

    // A REAL press at the button's own coordinates. Not .click() from inside the page: the whole
    // question is whether a person's pointer reaches it.
    let clicked = 'ok';
    try {
      await page.locator('#visualModeButton').click({ timeout: 2500 });
    } catch (e) {
      clicked = 'REFUSED';
      await page.mouse.click(before.box[0] + before.box[2] / 2, before.box[1] + before.box[3] / 2);
    }
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(READ_AFTER));

    const landed = after.guidedShowing ? 'Guided rows'
      : after.visualShowing ? 'visual builder'
      : after.sequenceShowing ? 'sequence builder'
      : after.textShowing ? 'plain text (NOTHING HAPPENED)' : 'nothing visible';
    const dead = landed.indexOf('NOTHING') >= 0 || landed === 'nothing visible'
      || (after.guidedShowing && after.actionable === 0);
    if (dead || clicked === 'REFUSED') bad.push({ type: t, label: before.label, clicked, landed, rows: after.rows, actionable: after.actionable });

    console.log('  ' + t.padEnd(14) + (before.label || '?').padEnd(13)
      + clicked.padEnd(10) + landed.padEnd(18)
      + String(after.rows).padEnd(6) + String(after.actionable).padEnd(12)
      + (dead ? 'DEAD' : clicked === 'REFUSED' ? 'REFUSED' : 'works'));
  }

  console.log('\n  types where the tab is dead or refused: ' + (bad.length ? JSON.stringify(bad, null, 1) : 'none'));
  console.log('  errors: ' + (errors.length ? errors.slice(0, 3).join(' // ') : 'none'));
  await close();
})();
