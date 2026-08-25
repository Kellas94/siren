#!/usr/bin/env node
/* Part 4. The disagreements, driven.
 *
 *   J. Why the ⚙ Style button is never on screen, and what is on screen in its place.
 *   K. The block inspector opened by a real click (after Fit page), against the Style panel.
 *   L. The palette's bare "Delete" - what does it delete, from a surface that is not the builder?
 *   M. The palette's "Reset block" - which block does it reset when the inspector is on another?
 *   N. Right-click on the drawing vs the same three verbs on the toolbar.
 *
 * Usage: node probe_dupe_routes_4.js [--port 9815]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9815'));
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

const SRC = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]';

async function setSrc(page) {
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = '${SRC}'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);
  await page.evaluate(`(() => { const b = document.getElementById('fitPageButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(900);
}

async function palette(page, query, exact) {
  return page.evaluate(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 240));
    const input = document.getElementById('commandPaletteInput');
    input.value = ${JSON.stringify(query)}; input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 240));
    const rows = Array.from(document.querySelectorAll('#commandPaletteList .palette-row'));
    const listed = rows.slice(0, 6).map(r => r.querySelector('em').textContent + ' | ' + r.querySelector('span').textContent);
    const want = ${JSON.stringify((exact || query).toLowerCase())};
    const hit = rows.find(r => r.querySelector('span').textContent.trim().toLowerCase() === want) || rows[0];
    const fired = hit ? hit.querySelector('span').textContent.trim() : null;
    if (hit) hit.click();
    await new Promise(r => setTimeout(r, 900));
    const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
    return JSON.stringify({ listed, fired });
  })()`).then(JSON.parse);
}

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  await setSrc(page);

  /* ---------- J. why ⚙ Style is not on screen ---------- */
  console.log('--- J. the ⚙ Style button, and what stands in its place ---');
  const j = JSON.parse(await page.evaluate(`(() => {
    const chain = [];
    let n = document.getElementById('styleShortcutButton');
    const self = n;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      chain.push({ tag: n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').filter(Boolean).slice(0,2).join('.') : ''),
        display: cs.display, visibility: cs.visibility, hidden: n.hidden, w: Math.round(n.getBoundingClientRect().width) });
      n = n.parentElement;
    }
    const bar = document.querySelector('.preview-actions') || (self ? self.parentElement : null);
    const siblings = bar ? Array.from(bar.children).map(c => ({ id: c.id, text: String(c.textContent||'').replace(/\\s+/g,' ').trim().slice(0,22), shown: getComputedStyle(c).display !== 'none' && !c.hidden })) : [];
    const toolbarVisible = Array.from(document.querySelectorAll('.preview-toolbar button, .preview-actions button, .preview-head button'))
      .filter(b => b.offsetParent && b.getBoundingClientRect().width > 1)
      .map(b => (b.id || '?') + ' "' + String(b.textContent||'').replace(/\\s+/g,' ').trim().slice(0,18) + '"');
    return JSON.stringify({ chain: chain.slice(0, 5), siblings, toolbarVisible });
  })()`));
  console.log('  computed chain above #styleShortcutButton:');
  j.chain.forEach(c => console.log('    ' + c.tag.padEnd(46) + ' display=' + c.display.padEnd(10) + ' hidden=' + String(c.hidden).padEnd(5) + ' width=' + c.w));
  console.log('  its row holds: ' + j.siblings.map(s => s.id + (s.shown ? '' : ' (not shown)')).join(', '));
  console.log('  buttons actually on the preview toolbar right now:');
  j.toolbarVisible.forEach(t => console.log('    ' + t));
  await page.screenshot({ path: OUT + 'preview_toolbar.png', clip: { x: 700, y: 90, width: 740, height: 140 } }).catch(() => {});

  /* ---------- K. the inspector, opened by a real click ---------- */
  console.log('\n--- K. block inspector (real click) vs the Style panel block fields ---');
  const pos = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    if (!svg) return null;
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /Check/.test(g.textContent||''));
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, inView: r.top > 0 && r.bottom < innerHeight });
  })()`).then(v => v && JSON.parse(v));
  console.log('  block "Check" at ' + (pos ? Math.round(pos.x) + ',' + Math.round(pos.y) + ' inView=' + pos.inView : 'not found'));
  if (pos && pos.inView) {
    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(1200);
    const k = JSON.parse(await page.evaluate(`(() => {
      const i = document.getElementById('nodeInspector');
      return JSON.stringify({
        inspectorOpen: !!(i && !i.hidden && i.getBoundingClientRect().height > 2),
        inspectorHeading: (document.getElementById('nodeInspectorHeading')||{}).textContent,
        inspectorFill: (document.getElementById('inspectorFillColor')||{}).value,
        stylePanelTarget: (document.getElementById('nodeStyleTarget')||{}).value,
        stylePanelFill: (document.getElementById('nodeFillColor')||{}).value
      });
    })()`));
    console.log('  ' + JSON.stringify(k));
    if (k.inspectorOpen) {
      await page.evaluate(`(() => { const f = document.getElementById('inspectorFillColor'); f.value = '#00c853'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await page.waitForTimeout(1800);
      const k2 = await page.evaluate(`JSON.stringify({
        inspectorFill: document.getElementById('inspectorFillColor').value,
        stylePanelTarget: document.getElementById('nodeStyleTarget').value,
        stylePanelFill: document.getElementById('nodeFillColor').value,
        stylePanelHex: document.getElementById('nodeFillHex').value,
        appliedInModel: (() => { try { return JSON.stringify(Object.keys((window.__t||{}))); } catch(e) { return 'n/a'; } })()
      })`);
      console.log('  after the inspector sets fill #00c853: ' + k2);
      await page.screenshot({ path: OUT + 'inspector_vs_style.png' }).catch(() => {});
    }
  }

  /* ---------- L. the palette's bare "Delete" ---------- */
  console.log('\n--- L. the palette row called just "Delete" ---');
  const beforeL = await page.evaluate(`document.getElementById('source').value`);
  const l = await palette(page, 'Delete', 'Delete');
  await page.waitForTimeout(900);
  const afterL = await page.evaluate(`document.getElementById('source').value`);
  const toastL = await page.evaluate(`(() => { const t = document.getElementById('toast'); return t ? String(t.textContent||'').replace(/\\s+/g,' ').trim().slice(0,110) : ''; })()`);
  console.log('  palette offered: ' + JSON.stringify(l.listed));
  console.log('  fired row: "' + l.fired + '"');
  console.log('  source changed by it? ' + (beforeL !== afterL));
  console.log('  before: ' + JSON.stringify(beforeL.replace(/\n/g, ' | ')));
  console.log('  after:  ' + JSON.stringify(afterL.replace(/\n/g, ' | ')));
  console.log('  toast:  ' + JSON.stringify(toastL));
  const dlgL = await page.evaluate(`(() => { const d = document.querySelector('dialog[open]'); return d ? String(d.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120) : 'none'; })()`);
  console.log('  dialog raised? ' + JSON.stringify(dlgL));
  await page.evaluate(`(() => { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} }); })()`);

  /* ---------- M. "Reset block" while the inspector is on another block ---------- */
  console.log('\n--- M. "Reset block": two buttons, one palette row ---');
  await setSrc(page);
  const m = JSON.parse(await page.evaluate(`(async () => {
    // colour block A through the Style panel
    const t = document.getElementById('nodeStyleTarget');
    const optA = Array.from(t.options).find(o => o.value === 'A' || /^A\\b/.test(o.textContent));
    if (optA) { t.value = optA.value; t.dispatchEvent(new Event('change', { bubbles: true })); }
    await new Promise(r => setTimeout(r, 400));
    const f = document.getElementById('nodeFillColor');
    f.value = '#ff0000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('applyNodeStyleButton').click();
    await new Promise(r => setTimeout(r, 1600));
    return JSON.stringify({ styleTarget: t.value, styleFill: document.getElementById('nodeFillColor').value });
  })()`));
  console.log('  Style panel now targets ' + JSON.stringify(m.styleTarget) + ' with fill ' + m.styleFill);
  // open the inspector on a DIFFERENT block
  const posB = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /End/.test(g.textContent||''));
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, inView: r.top > 0 && r.bottom < innerHeight });
  })()`).then(v => v && JSON.parse(v));
  if (posB && posB.inView) {
    await page.mouse.click(posB.x, posB.y);
    await page.waitForTimeout(1100);
  }
  const mState = await page.evaluate(`JSON.stringify({
    inspectorOpen: (() => { const i = document.getElementById('nodeInspector'); return !!(i && !i.hidden && i.getBoundingClientRect().height > 2); })(),
    inspectorHeading: (document.getElementById('nodeInspectorHeading')||{}).textContent,
    styleTarget: document.getElementById('nodeStyleTarget').value
  })`);
  console.log('  inspector opened on: ' + mState);
  const mRun = await palette(page, 'Reset block', 'Reset block');
  console.log('  palette offered: ' + JSON.stringify(mRun.listed) + '  fired "' + mRun.fired + '"');
  const mAfter = await page.evaluate(`JSON.stringify({
    styleTarget: document.getElementById('nodeStyleTarget').value,
    styleFill: document.getElementById('nodeFillColor').value,
    toast: (() => { const t = document.getElementById('toast'); return t ? String(t.textContent||'').replace(/\\s+/g,' ').trim().slice(0,110) : ''; })()
  })`);
  console.log('  after: ' + mAfter);

  /* ---------- N. right-click on the drawing vs the toolbar ---------- */
  console.log('\n--- N. right-click on the drawing ---');
  await setSrc(page);
  const vp = await page.evaluate(`(() => { const v = document.getElementById('zoomViewport'); const r = v.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width*0.85, y: r.top + r.height*0.85 }); })()`).then(JSON.parse);
  await page.mouse.click(vp.x, vp.y, { button: 'right' });
  await page.waitForTimeout(700);
  const n = JSON.parse(await page.evaluate(`(() => {
    const menu = document.querySelector('.struct-menu');
    if (!menu) return JSON.stringify({ open: false });
    return JSON.stringify({ open: true, label: menu.getAttribute('aria-label'),
      rows: Array.from(menu.querySelectorAll('.struct-menu-item, .struct-menu-heading')).map(r => String(r.textContent||'').replace(/\\s+/g,' ').trim() + (r.disabled ? ' [disabled]' : '')) });
  })()`));
  console.log('  ' + JSON.stringify(n, null, 0));
  if (n.open) {
    const before = await page.evaluate(`document.getElementById('zoomValue').textContent.trim()`);
    await page.evaluate(`(() => { const r = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item')).find(x => /actual size/i.test(x.textContent)); if (r) r.click(); })()`);
    await page.waitForTimeout(800);
    const after = await page.evaluate(`document.getElementById('zoomValue').textContent.trim()`);
    console.log('  right-click "Actual size (100%)": ' + before + ' -> ' + after);
  }

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
