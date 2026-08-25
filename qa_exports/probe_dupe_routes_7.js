#!/usr/bin/env node
/* Part 7. Three loose ends closed.
 *   V. Does opening the inspector DISCARD an unapplied Style-panel value? (explicit read)
 *   W. The docked tab strip while the editor is in the floating window.
 *   X. Where the palette row "No blocks" comes from.
 * Usage: node probe_dupe_routes_7.js [--port 9818]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9818'));
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

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);
  await page.evaluate(`(() => { const b = document.getElementById('fitPageButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(900);

  console.log('--- V. an unapplied Style-panel colour, then a click on the block ---');
  await page.evaluate(`(async () => {
    const t = document.getElementById('nodeStyleTarget');
    t.value = 'A'; t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const f = document.getElementById('nodeFillColor');
    f.value = '#ff0000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await page.waitForTimeout(1200);
  console.log('  Style panel before the click: ' + await page.evaluate(`JSON.stringify({ target: document.getElementById('nodeStyleTarget').value, fill: document.getElementById('nodeFillColor').value })`));
  const pos = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /Start/.test(g.textContent||''));
    if (!n) return null; const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, inView: r.top > 0 && r.bottom < innerHeight });
  })()`).then(v => v && JSON.parse(v));
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(1300);
  console.log('  Style panel after clicking that same block: ' + await page.evaluate(`JSON.stringify({ target: document.getElementById('nodeStyleTarget').value, fill: document.getElementById('nodeFillColor').value, inspectorFill: document.getElementById('inspectorFillColor').value, inspectorOpen: (() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden); })() })`));
  console.log('  toast, if any: ' + await page.evaluate(`(() => { const t = document.getElementById('toast'); return t && !t.hidden ? String(t.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120) : '(none)'; })()`));

  /* ---------- W. docked tab strip vs the floating editor ---------- */
  console.log('\n--- W. the docked Code / Build tabs while the editor floats ---');
  await page.evaluate(`(() => { const b = document.getElementById('inspectorDoneButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(500);
  await page.evaluate(`(() => { document.getElementById('codeModeButton').click(); document.getElementById('textModeButton').click(); })()`);
  await page.waitForTimeout(600);
  await page.evaluate(`(() => { const b = document.getElementById('popOutEditorButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1500);
  const w0 = await page.evaluate(`JSON.stringify({
    tabStripIn: document.getElementById('codeModeButton').closest('#editorPopout') ? 'pop-out' : 'docked pane',
    innerPairIn: document.getElementById('structureModeButton').closest('#editorPopout') ? 'pop-out' : 'docked pane',
    tabLabel: document.getElementById('visualModeButton').textContent.replace(/\\s+/g,' ').trim(),
    dockedNote: (() => { const e = document.getElementById('editorPoppedNote'); return e && e.offsetParent ? String(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,80) : null; })()
  })`);
  console.log('  ' + w0);
  // press the docked second tab (Build on a flowchart) while the editor floats
  await page.evaluate(`(() => { document.getElementById('visualModeButton').click(); })()`);
  await page.waitForTimeout(1300);
  const w1 = await page.evaluate(`JSON.stringify({
    visualPanelVisible: (() => { const e = document.getElementById('visualModePanel'); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); })(),
    visualPanelIn: document.getElementById('visualModePanel').closest('#editorPopout') ? 'pop-out' : 'docked pane',
    popoutStillOpen: !document.getElementById('editorPopout').hidden,
    popoutShows: (() => { const m = document.getElementById('editorPopoutMount'); return m ? String(m.textContent||'').replace(/\\s+/g,' ').trim().slice(0,70) : null; })(),
    codeVisible: (() => { const e = document.getElementById('codeEditor'); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); })()
  })`);
  console.log('  after pressing the docked second tab: ' + w1);
  await page.screenshot({ path: OUT + 'popout_tabs.png' }).catch(() => {});

  /* ---------- X. "No blocks" ---------- */
  console.log('\n--- X. the palette row "No blocks" ---');
  const x = await page.evaluate(`(() => {
    const all = Array.from(document.querySelectorAll('button')).filter(b => /no blocks/i.test(String(b.textContent||'')) || /no blocks/i.test(String(b.getAttribute('title')||'')));
    return JSON.stringify(all.map(b => ({ id: b.id || '(no id)', text: String(b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40), title: String(b.getAttribute('title')||'').slice(0,60), disabled: b.disabled })));
  })()`);
  console.log('  buttons whose text or title says "No blocks": ' + x);

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
