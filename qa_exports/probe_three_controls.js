#!/usr/bin/env node
/* The owner named his three: ELK on/off, block colour, font. Which of them actually work, per type?
 *
 * He also said the thing that matters: on other diagram types some of these will not be available,
 * and options that do nothing must not appear. So the bar cannot be three fixed controls unless all
 * three are universal. This measures whether they are.
 *
 * Font is already known from the style matrix (family and size live on all twenty). The two open
 * questions are ELK and per-block colour, and both are measured here on the running app.
 *
 * Usage: node probe_three_controls.js [--app <path>] [--port 9760]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9760'));

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

const PICK = t => `(async () => {
  const sel = document.getElementById('diagramTypeSelect');
  sel.value = ${JSON.stringify(t)};
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 850));
  const st = document.getElementById('newStarterButton')
    || Array.from(document.querySelectorAll('button')).find(b => /new starter/i.test(b.textContent || ''));
  if (st && !st.disabled) { st.click(); await new Promise(r => setTimeout(r, 850)); }
  const dlg = document.querySelector('dialog[open]');
  if (dlg) { const go = Array.from(dlg.querySelectorAll('button')).find(b => /continue|replace|start|yes|ok/i.test(b.textContent||''));
    if (go) { go.click(); await new Promise(r => setTimeout(r, 1300)); } }
  return JSON.stringify({ firstLine: (document.getElementById('source').value || '').split(String.fromCharCode(10))[0].slice(0, 22) });
})()`;

/* Three questions per type, each answered by the app rather than by me. */
const ASK = `(() => {
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect();
    return r.width > 2 && r.height > 2; };

  // 1. ELK - is the layout engine control offered and usable for this type?
  const eng = document.getElementById('layoutEngineSelect') || document.getElementById('layoutEngine');
  let elk = 'no engine control';
  if (eng) {
    const opt = Array.from(eng.options).find(o => /elk/i.test(o.textContent + o.value));
    elk = !opt ? 'no ELK option'
      : (eng.disabled ? 'control disabled'
      : (opt.disabled ? 'ELK option disabled'
      : (vis(eng) ? 'offered' : 'present but not visible')));
  }

  // 2. per-block colour - does the app say this diagram has blocks it can style?
  const tgt = document.getElementById('nodeStyleTarget');
  const fill = document.getElementById('nodeFillColor');
  const blockColour = !fill ? 'no fill control'
    : (tgt && /no styleable/i.test(tgt.textContent || '') ? 'app says: no styleable blocks'
    : (fill.disabled ? 'disabled' : 'offered'));

  // 3. font - the style matrix already says family and size are live on all twenty; confirm present
  const ff = document.getElementById('diagramFontFamily');
  const fs = document.getElementById('diagramFontSize');
  return JSON.stringify({
    elk, blockColour,
    font: (ff && fs) ? (ff.disabled || fs.disabled ? 'disabled' : 'offered') : 'absent',
    styleTargetSays: tgt ? (tgt.textContent || '').trim().slice(0, 40) : null
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');
  console.log('  type            ELK              block colour                  font');
  console.log('  ' + '-'.repeat(78));

  const tally = { elk: 0, colour: 0, font: 0 };
  for (const t of TYPES) {
    const picked = JSON.parse(await page.evaluate(PICK(t)));
    const a = JSON.parse(await page.evaluate(ASK));
    if (a.elk === 'offered') tally.elk++;
    if (a.blockColour === 'offered') tally.colour++;
    if (a.font === 'offered') tally.font++;
    console.log('  ' + t.padEnd(15) + a.elk.padEnd(17) + a.blockColour.padEnd(30) + a.font);
  }

  console.log('\n  offered on: ELK ' + tally.elk + '/20,  block colour ' + tally.colour
    + '/20,  font ' + tally.font + '/20');
  console.log('  errors: ' + (errors.length ? errors.slice(0, 2).join(' // ') : 'none'));
  await close();
})();
