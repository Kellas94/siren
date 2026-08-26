#!/usr/bin/env node
/* ELK is offered on all twenty types. Does it CHANGE anything on all twenty?
 *
 * "Offered" and "does something" are different claims, and this app has 112 measured pairs where
 * they came apart. ELK is a layout engine for flowchart-family graphs, so the honest expectation is
 * that it moves nothing on a pie chart or a gantt - in which case offering it there is one more
 * control that presses back and does nothing.
 *
 * Method: render the type on Standard, take a geometric signature of the SVG, switch to ELK, wait
 * for the fetch and the re-render, take the signature again. Different signature = it did something.
 *
 * Usage: node probe_elk_effect.js [--app <path>] [--port 9765]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9765'));

const TYPES = ['flowchart', 'swimlane', 'state', 'ishikawa', 'class', 'er', 'block', 'requirement',
  'sequence', 'gantt', 'timeline', 'kanban', 'journey', 'mindmap', 'gitgraph', 'xy', 'pie',
  'architecture', 'c4', 'advanced'];

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

/* Geometry only - not the whole markup, which carries render timestamps in its ids. */
const SIG = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return 'no svg';
  const nodes = Array.from(svg.querySelectorAll('g.node, g.nodes > g, .node'));
  const pts = nodes.map(n => {
    const b = n.getBBox ? n.getBBox() : null;
    return b ? Math.round(b.x) + ',' + Math.round(b.y) : '';
  }).filter(Boolean).sort().join('|');
  const vb = svg.getAttribute('viewBox') || '';
  const paths = Array.from(svg.querySelectorAll('path')).length;
  return vb + ' :: n=' + nodes.length + ' p=' + paths + ' :: ' + pts.slice(0, 220);
})()`;

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
    if (go) { go.click(); await new Promise(r => setTimeout(r, 1400)); } }
  return (document.getElementById('source').value || '').split(String.fromCharCode(10))[0].slice(0, 20);
})()`;

const ENGINE = v => `(async () => {
  const eng = document.getElementById('layoutEngineSelect') || document.getElementById('layoutEngine');
  if (!eng) return 'absent';
  const opt = Array.from(eng.options).find(o => ${v === 'elk' ? '/elk/i' : '/standard|dagre|default/i'}.test(o.textContent + o.value));
  if (!opt) return 'no option';
  eng.value = opt.value;
  eng.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3200));
  return eng.value;
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('\nMeasured on ' + APP + '\n');
  console.log('  type            standard -> ELK        verdict');
  console.log('  ' + '-'.repeat(60));

  let changed = 0, same = 0;
  const dead = [];
  for (const t of TYPES) {
    await page.evaluate(PICK(t));
    await page.evaluate(ENGINE('standard'));
    await page.waitForTimeout(600);
    const before = await page.evaluate(SIG);
    await page.evaluate(ENGINE('elk'));
    await page.waitForTimeout(900);
    const after = await page.evaluate(SIG);
    const moved = before !== after && before !== 'no svg' && after !== 'no svg';
    if (moved) changed++; else { same++; dead.push(t); }
    console.log('  ' + t.padEnd(15) + (moved ? 'the drawing moved  ' : 'IDENTICAL          ')
      + (moved ? 'ELK does something here' : 'ELK changes nothing'));
    await page.evaluate(ENGINE('standard'));
    await page.waitForTimeout(500);
  }

  console.log('\n  ELK changes the drawing on ' + changed + ' of ' + TYPES.length
    + ' types, and nothing on ' + same + '.');
  if (dead.length) console.log('  Offered but inert on: ' + dead.join(', '));
  console.log('  errors: ' + (errors.length ? errors.slice(0, 2).join(' // ') : 'none'));
  await close();
})();
