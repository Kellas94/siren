#!/usr/bin/env node
/* Part 5. Four more verbs where the routes disagree.
 *
 *   O. FIND: the ⌕ Find button vs Ctrl+F vs the palette's "Find and replace", from Guided.
 *   P. The popped-out editor: two full sets of editor controls, on screen at once.
 *   Q. Mobile vs desktop for Guide / Export / Render.
 *   R. Two commit models for one field: the Style panel's Apply vs the inspector's live change.
 *   S. The palette's bare "Delete" on a pie chart - a builder the tab refuses to open.
 *
 * Usage: node probe_dupe_routes_5.js [--port 9816]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9816'));
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

const EDSTATE = `(() => {
  const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.getBoundingClientRect().height > 2); };
  return JSON.stringify({
    guidedRows: vis('structureEditor'), plainCode: vis('codeEditor'),
    findPanel: vis('findReplacePanel'),
    findInputVisible: (() => { const e = document.getElementById('findInput'); return !!(e && e.getBoundingClientRect().width > 1); })(),
    sourceOnScreen: (() => { const e = document.getElementById('source'); const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; })(),
    innerGuided: (document.getElementById('structureModeButton')||{}).getAttribute ? document.getElementById('structureModeButton').getAttribute('aria-pressed') : null
  });
})()`;

async function toGuided(page) {
  await page.evaluate(`(async () => {
    document.getElementById('codeModeButton').click(); await new Promise(r => setTimeout(r, 250));
    document.getElementById('structureModeButton').click();
  })()`);
  await page.waitForTimeout(900);
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);

  /* ---------- O. three routes to Find, started from Guided ---------- */
  console.log('--- O. Find and replace, opened from the Guided line editor ---');
  const findRoutes = [
    ['the ⌕ Find button', async () => { await page.evaluate(`document.getElementById('findReplaceButton').click()`); }],
    ['Ctrl+F', async () => {
      await page.evaluate(`(() => { const s = document.getElementById('source'); })()`);
      await page.keyboard.press('Control+f');
    }],
    ['palette "Find and replace"', async () => {
      await page.evaluate(`(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 240));
        const i = document.getElementById('commandPaletteInput');
        i.value = 'Find and replace'; i.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 240));
        const row = Array.from(document.querySelectorAll('#commandPaletteList .palette-row')).find(r => /^Find and replace$/i.test(r.querySelector('span').textContent.trim()));
        if (row) row.click();
        await new Promise(r => setTimeout(r, 600));
        const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
      })()`);
    }]
  ];
  for (const [name, run] of findRoutes) {
    await page.evaluate(`(() => { const p = document.getElementById('findReplacePanel'); if (p) p.hidden = true; })()`);
    await toGuided(page);
    const before = JSON.parse(await page.evaluate(EDSTATE));
    await run();
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(EDSTATE));
    const stranded = after.findPanel && after.guidedRows && !after.sourceOnScreen;
    console.log('  ' + name.padEnd(28)
      + 'before[guided=' + before.guidedRows + ']  after[guided=' + String(after.guidedRows).padEnd(5)
      + ' code=' + String(after.plainCode).padEnd(5)
      + ' findPanel=' + String(after.findPanel).padEnd(5)
      + ' textarea on screen=' + String(after.sourceOnScreen).padEnd(5) + ']'
      + (stranded ? '   <<< FIND OPENED OVER THE GUIDED ROWS - the text it searches is not on screen' : ''));
  }
  await page.screenshot({ path: OUT + 'find_from_guided.png', clip: { x: 0, y: 90, width: 700, height: 700 } }).catch(() => {});

  /* ---------- P. the popped-out editor ---------- */
  console.log('\n--- P. pop the editor out: how many of each control end up on screen ---');
  await page.evaluate(`(() => { const p = document.getElementById('findReplacePanel'); if (p) p.hidden = true; document.getElementById('codeModeButton').click(); document.getElementById('textModeButton').click(); })()`);
  await page.waitForTimeout(600);
  const popBefore = JSON.parse(await page.evaluate(`(() => {
    const on = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 1); };
    return JSON.stringify({ undo: on('undoButton'), redo: on('redoButton'), find: on('findReplaceButton'),
      render: on('renderPreviewButton'), popUndo: on('popoutUndoButton'), popRedo: on('popoutRedoButton'),
      popFind: on('popoutFindButton'), popRender: on('popoutRenderButton'),
      codeTab: on('codeModeButton'), secondTab: on('visualModeButton'), innerGuided: on('structureModeButton'),
      popMore: on('popoutMoreButton') });
  })()`));
  console.log('  docked: ' + JSON.stringify(popBefore));
  await page.evaluate(`(() => { const b = document.getElementById('popOutEditorButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1200);
  const popAfter = JSON.parse(await page.evaluate(`(() => {
    const on = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 1); };
    return JSON.stringify({ undo: on('undoButton'), redo: on('redoButton'), find: on('findReplaceButton'),
      render: on('renderPreviewButton'), popUndo: on('popoutUndoButton'), popRedo: on('popoutRedoButton'),
      popFind: on('popoutFindButton'), popRender: on('popoutRenderButton'),
      codeTab: on('codeModeButton'), secondTab: on('visualModeButton'), innerGuided: on('structureModeButton'),
      popMore: on('popoutMoreButton'),
      editorHomeNote: (() => { const e = document.getElementById('editorPoppedNote'); return e && e.offsetParent ? String(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,90) : null; })() });
  })()`));
  console.log('  popped: ' + JSON.stringify(popAfter));
  const bothUndo = popAfter.undo && popAfter.popUndo;
  console.log('  two Undo buttons on screen at once? ' + bothUndo);
  await page.screenshot({ path: OUT + 'popout_open.png' }).catch(() => {});
  // do the two Undo buttons agree?
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = s.value + String.fromCharCode(10) + '  C --> D[Extra]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2500);
  const srcMid = await page.evaluate(`document.getElementById('source').value`);
  await page.evaluate(`(() => { const b = document.getElementById('popoutUndoButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1200);
  const srcAfterPopUndo = await page.evaluate(`document.getElementById('source').value`);
  console.log('  popout Undo changed the source? ' + (srcMid !== srcAfterPopUndo));
  await page.evaluate(`(() => { const b = document.getElementById('closeEditorPopout'); if (b) b.click(); })()`);
  await page.waitForTimeout(900);

  /* ---------- Q. mobile vs desktop ---------- */
  console.log('\n--- Q. the mobile route and the desktop route for the same three verbs ---');
  for (const w of [1440, 900, 480]) {
    await page.setViewportSize({ width: w, height: 860 });
    await page.waitForTimeout(800);
    const q = JSON.parse(await page.evaluate(`(() => {
      const on = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 1); };
      const lab = id => { const e = document.getElementById(id); return e ? String(e.textContent||'').replace(/\\s+/g,' ').trim() : ''; };
      return JSON.stringify({
        guide: on('guideButton'), mGuide: on('mobileGuideButton'),
        exportB: on('exportButton'), mExport: on('mobileExportButton'),
        render: on('renderPreviewButton'), mRender: on('mobileRenderButton'),
        more: on('headerMoreButton'), mMore: on('mobileMoreButton'),
        edTab: on('mobileEditorTab'), pvTab: on('mobilePreviewTab'),
        labels: { guide: lab('guideButton'), mGuide: lab('mobileGuideButton'), exportB: lab('exportButton'), mExport: lab('mobileExportButton') }
      });
    })()`));
    const both = k => (q[k[0]] && q[k[1]]) ? 'BOTH' : q[k[0]] ? 'desktop' : q[k[1]] ? 'mobile' : 'neither';
    console.log('  ' + String(w).padStart(4) + 'px  Guide=' + both(['guide','mGuide']).padEnd(8)
      + ' Export=' + both(['exportB','mExport']).padEnd(8)
      + ' Render=' + both(['render','mRender']).padEnd(8)
      + ' More=' + both(['more','mMore']).padEnd(8)
      + '  labels: ' + JSON.stringify(q.labels));
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(700);

  /* ---------- R. two commit models for one field ---------- */
  console.log('\n--- R. Style panel "Apply to block" vs the inspector\'s live change ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);
  await page.evaluate(`(() => { const b = document.getElementById('fitPageButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(800);
  const fillOf = () => page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    const n = svg && Array.from(svg.querySelectorAll('g.node')).find(g => /Start/.test(g.textContent||''));
    const shape = n && (n.querySelector('rect,polygon,circle,path'));
    return shape ? getComputedStyle(shape).fill : null;
  })()`);
  console.log('  block A fill at rest: ' + await fillOf());
  await page.evaluate(`(async () => {
    const t = document.getElementById('nodeStyleTarget');
    const o = Array.from(t.options).find(x => x.value === 'A');
    if (o) { t.value = 'A'; t.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 400));
    const f = document.getElementById('nodeFillColor');
    f.value = '#ff0000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await page.waitForTimeout(2200);
  console.log('  after the Style panel swatch is set to red, WITHOUT pressing Apply: ' + await fillOf());
  await page.evaluate(`document.getElementById('applyNodeStyleButton').click()`);
  await page.waitForTimeout(2200);
  console.log('  after pressing "Apply to block": ' + await fillOf());
  const posB = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /Check/.test(g.textContent||''));
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, inView: r.top > 0 && r.bottom < innerHeight });
  })()`).then(v => v && JSON.parse(v));
  if (posB && posB.inView) {
    await page.mouse.click(posB.x, posB.y);
    await page.waitForTimeout(1100);
    await page.evaluate(`(() => { const f = document.getElementById('inspectorFillColor'); f.value = '#0000ff'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(2200);
    const bFill = await page.evaluate(`(() => {
      const svg = document.querySelector('#diagram svg');
      const n = svg && Array.from(svg.querySelectorAll('g.node')).find(g => /Check/.test(g.textContent||''));
      const shape = n && n.querySelector('rect,polygon,circle,path');
      return shape ? getComputedStyle(shape).fill : null;
    })()`);
    console.log('  inspector set B to blue with NO Apply button pressed -> B fill: ' + bFill);
    const btns = await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('#nodeInspector button')).map(b => String(b.textContent||'').replace(/\\s+/g,' ').trim()).filter(Boolean))`);
    console.log('  buttons the inspector offers: ' + btns);
  }

  /* ---------- S. the palette's "Delete" on a pie chart ---------- */
  console.log('\n--- S. the palette on a diagram type whose builder the tab refuses to open ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'pie showData\\n  title Coverage\\n  "Tested" : 70\\n  "Untested" : 30'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3000);
  const s = await page.evaluate(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 240));
    const i = document.getElementById('commandPaletteInput');
    i.value = 'block'; i.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 240));
    const rows = Array.from(document.querySelectorAll('#commandPaletteList .palette-row')).map(r => r.querySelector('em').textContent + ' | ' + r.querySelector('span').textContent);
    const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
    return JSON.stringify(rows);
  })()`);
  console.log('  on a PIE chart, the palette still offers for "block": ' + s);
  const tabNow = await page.evaluate(`document.getElementById('visualModeButton').textContent.replace(/\\s+/g,' ').trim()`);
  console.log('  ...while the second editor tab reads: "' + tabNow + '"');

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
