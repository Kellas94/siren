#!/usr/bin/env node
/* Part 6. The block-style pair, measured properly, plus two loose ends.
 *
 *   R2. The Style panel needs "Apply to block". The inspector is live. They share one set of
 *       values (syncNodeInspectorFromControls / syncSidebarControlsFromInspector). So what
 *       happens to a value typed into the Style panel and NOT applied, when the inspector is
 *       then opened on the same block and something unrelated is changed there?
 *   T.  Which button the palette row "No blocks" belongs to.
 *   U.  The editor popped out: the docked pane still shows Code / Build / Text / Guided.
 *       What do those docked controls drive while the editor is in the other window?
 *
 * Usage: node probe_dupe_routes_6.js [--port 9817]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9817'));
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

const fillOf = (page, label) => page.evaluate(`(() => {
  const svg = document.querySelector('#diagram svg');
  const n = svg && Array.from(svg.querySelectorAll('g.node')).find(g => new RegExp(${JSON.stringify(label)}).test(g.textContent||''));
  const shape = n && n.querySelector('rect,polygon,circle,path');
  return shape ? getComputedStyle(shape).fill : 'no node';
})()`);

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);
  await page.evaluate(`(() => { const b = document.getElementById('fitPageButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(900);

  console.log('--- R2. an unapplied Style-panel value, and the inspector that commits it ---');
  console.log('  1. block A fill at rest:                          ' + await fillOf(page, 'Start'));

  await page.evaluate(`(async () => {
    const t = document.getElementById('nodeStyleTarget');
    t.value = 'A'; t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const f = document.getElementById('nodeFillColor');
    f.value = '#ff0000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    const h = document.getElementById('nodeFillHex');
    h.value = '#ff0000'; h.dispatchEvent(new Event('input', { bubbles: true })); h.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await page.waitForTimeout(1800);
  console.log('  2. Style panel swatch set to red, Apply NOT pressed: ' + await fillOf(page, 'Start'));
  console.log('     what the Style panel holds now: ' + await page.evaluate(`JSON.stringify({ target: document.getElementById('nodeStyleTarget').value, fill: document.getElementById('nodeFillColor').value, hex: document.getElementById('nodeFillHex').value })`));

  // now open the inspector on the SAME block by clicking it
  const pos = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /Start/.test(g.textContent||''));
    if (!n) return null; const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, inView: r.top > 0 && r.bottom < innerHeight });
  })()`).then(v => v && JSON.parse(v));
  if (!pos || !pos.inView) { console.log('  block A not clickable on screen'); }
  else {
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(1200);
    const open = JSON.parse(await page.evaluate(`(() => {
      const i = document.getElementById('nodeInspector');
      return JSON.stringify({ open: !!(i && !i.hidden && i.getBoundingClientRect().height > 2),
        heading: (document.getElementById('nodeInspectorHeading')||{}).textContent,
        inspectorFill: document.getElementById('inspectorFillColor').value,
        inspectorHex: document.getElementById('inspectorFillHex').value,
        fontSize: document.getElementById('inspectorFontSize').value });
    })()`));
    console.log('  3. clicked block A - inspector: ' + JSON.stringify(open));
    console.log('     block A fill now:                              ' + await fillOf(page, 'Start'));
    if (open.open) {
      // change something UNRELATED to colour
      await page.evaluate(`(() => { const s = document.getElementById('inspectorFontSize'); s.value = String(Math.max(9, (Number(s.value)||15) + 3)); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await page.waitForTimeout(1600);
      console.log('  4. changed only the FONT SIZE in the inspector -> A fill: ' + await fillOf(page, 'Start'));
      // and the direct one: set the inspector fill
      await page.evaluate(`(() => { const f = document.getElementById('inspectorFillColor'); f.value = '#0000ff'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await page.waitForTimeout(1600);
      console.log('  5. inspector fill set to blue, no Apply pressed  -> A fill: ' + await fillOf(page, 'Start'));
      console.log('     Style panel now reads: ' + await page.evaluate(`JSON.stringify({ target: document.getElementById('nodeStyleTarget').value, fill: document.getElementById('nodeFillColor').value })`));
      await page.screenshot({ path: OUT + 'style_pair.png' }).catch(() => {});
    }
  }

  /* ---------- T. "No blocks" ---------- */
  console.log('\n--- T. which control the palette row "No blocks" is ---');
  const t = await page.evaluate(`(() => {
    const hits = Array.from(document.querySelectorAll('button[id]')).filter(b => /no blocks/i.test(String(b.textContent||'').trim()) || /no blocks/i.test(String(b.getAttribute('title')||'')));
    return JSON.stringify(hits.map(b => ({ id: b.id, text: String(b.textContent||'').replace(/\\s+/g,' ').trim(), disabled: b.disabled, cls: b.className })));
  })()`);
  console.log('  ' + t);

  /* ---------- U. the docked editor chrome while the editor is popped out ---------- */
  console.log('\n--- U. the editor popped out: what the docked tab strip drives ---');
  await page.evaluate(`(() => { document.getElementById('codeModeButton').click(); document.getElementById('textModeButton').click(); })()`);
  await page.waitForTimeout(600);
  await page.evaluate(`(() => { const b = document.getElementById('popOutEditorButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1400);
  const u0 = JSON.parse(await page.evaluate(`(() => {
    const on = id => { const e = document.getElementById(id); const r = e ? e.getBoundingClientRect() : null; return !!(e && e.offsetParent && r.width > 1); };
    const where = id => { const e = document.getElementById(id); return e && e.closest('#editorPopout') ? 'in the pop-out' : e && e.offsetParent ? 'in the docked pane' : 'not on screen'; };
    return JSON.stringify({
      sourceLivesIn: where('source'),
      guidedRowsLiveIn: where('structureRows'),
      tabStrip: where('codeModeButton'), innerPair: where('structureModeButton'),
      undoDocked: on('undoButton'), undoPop: on('popoutUndoButton'),
      findDocked: on('findReplaceButton'), findPop: on('popoutFindButton')
    });
  })()`));
  console.log('  ' + JSON.stringify(u0));
  // press the docked inner Guided while the editor is in the other window
  await page.evaluate(`(() => { const b = document.getElementById('structureModeButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1200);
  const u1 = JSON.parse(await page.evaluate(`(() => {
    const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); };
    const where = id => { const e = document.getElementById(id); return e && e.closest('#editorPopout') ? 'in the pop-out' : e && e.offsetParent ? 'in the docked pane' : 'not on screen'; };
    return JSON.stringify({ guidedRowsVisible: vis('structureEditor'), guidedRowsLiveIn: where('structureRows'),
      codeVisible: vis('codeEditor'), sourceIn: where('source'),
      popoutStillOpen: !document.getElementById('editorPopout').hidden });
  })()`));
  console.log('  after pressing the DOCKED "✦ Guided": ' + JSON.stringify(u1));
  await page.screenshot({ path: OUT + 'popout_guided.png' }).catch(() => {});

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
