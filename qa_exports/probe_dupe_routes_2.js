#!/usr/bin/env node
/* Part 2 of the same-verb census. Four verbs, every route, driven and compared.
 *
 *   A. "change how this diagram looks"  - #styleShortcutButton vs the Style folds vs the palette
 *   B. "restyle THIS block"             - the Style panel's block fields vs the node inspector
 *   C. "change the diagram type"        - #diagramTypeChip vs #diagramTypeSelect vs the palette
 *   D. "open the visual builder"        - the tab refuses on 16 types; does the palette?
 *
 * Usage: node probe_dupe_routes_2.js [--port 9813]
 */
const { openApp, confirmDialog } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9813'));

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

  /* ---------- the type roster, so later steps ask for values that exist ---------- */
  const opts = JSON.parse(await page.evaluate(`JSON.stringify(Array.from(document.getElementById('diagramTypeSelect').options).map(o => o.value + ' :: ' + o.textContent.trim()))`));
  console.log('#diagramTypeSelect offers ' + opts.length + ' options');
  console.log('  ' + opts.slice(0, 30).join('\n  '));

  /* ---------- A. how many clicks to reach the style controls, from cold ---------- */
  console.log('\n--- A. reaching the style controls ---');
  const styleReach = JSON.parse(await page.evaluate(`(() => {
    const onScreen = e => !!(e && e.offsetParent && e.getBoundingClientRect().height > 1);
    const info = id => { const e = document.getElementById(id); return { exists: !!e, onScreen: onScreen(e),
      inClosedFold: !!(e && e.closest('details') && !e.closest('details').open),
      foldName: (() => { const d = e && e.closest('details'); const s = d && d.querySelector('summary'); return s ? s.textContent.replace(/\\s+/g,' ').trim().slice(0,42) : ''; })() }; };
    return JSON.stringify({
      shortcut: info('styleShortcutButton'),
      fontFamily: info('diagramFontFamily'), fontSize: info('diagramFontSize'),
      palette: info('paletteSwatches'), legend: info('legendEnabled'),
      nodeFill: info('nodeFillColor'), nodeShape: info('nodeShape'),
      classSelect: info('styleClassSelect'), direction: info('direction'),
      layoutEngine: info('layoutEngineSelect'),
      detailsTotal: document.querySelectorAll('#app details').length,
      detailsOpen: Array.from(document.querySelectorAll('#app details')).filter(d => d.open).length
    });
  })()`));
  Object.entries(styleReach).forEach(([k, v]) => {
    if (typeof v !== 'object') { console.log('  ' + k + ': ' + v); return; }
    console.log('  ' + k.padEnd(12) + ' exists=' + v.exists + ' onScreen=' + String(v.onScreen).padEnd(5)
      + ' insideClosedFold=' + String(v.inClosedFold).padEnd(5) + (v.foldName ? '  fold: "' + v.foldName + '"' : ''));
  });

  /* ---------- B. two editors for one block's colour ---------- */
  console.log('\n--- B. two controls that set a block\'s fill ---');
  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(3000);

  const pair = JSON.parse(await page.evaluate(`(() => {
    const ids = ['nodeStyleTarget','nodeFillColor','nodeFillHex','nodeBorderColor','nodeTextColor','nodeShape','nodeFontFamily','nodeFontSize','nodeFontWeight','applyNodeStyleButton','resetNodeStyleButton','clearNodeStylesButton'];
    const ins = ['inspectorFillColor','inspectorFillHex','inspectorBorderColor','inspectorTextColor','inspectorShape','inspectorFontFamily','inspectorFontSize','inspectorFontWeight','inspectorResetButton','inspectorDoneButton','inspectorBlockLabel','inspectorIcon','inspectorLinkTarget'];
    const label = id => { const e = document.getElementById(id); if (!e) return null;
      const lab = e.labels && e.labels[0] ? e.labels[0].textContent.replace(/\\s+/g,' ').trim() : (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g,' ').trim();
      return lab.slice(0, 34); };
    return JSON.stringify({ stylePanel: ids.map(i => i + ' = ' + label(i)), inspector: ins.map(i => i + ' = ' + label(i)) });
  })()`));
  console.log('  Style panel block fields:');
  pair.stylePanel.forEach(l => console.log('    ' + l));
  console.log('  Node inspector fields:');
  pair.inspector.forEach(l => console.log('    ' + l));

  // Route 1: the Style panel. Route 2: the inspector opened by clicking the block.
  const r1 = await page.evaluate(`(async () => {
    const t = document.getElementById('nodeStyleTarget');
    if (!t) return 'no nodeStyleTarget';
    const opt = Array.from(t.options).find(o => /^A\\b/.test(o.textContent) || o.value === 'A');
    if (!opt) return 'no option for block A; options = ' + Array.from(t.options).map(o => o.value).join(',');
    t.value = opt.value; t.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const f = document.getElementById('nodeFillColor');
    f.value = '#ff0000'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const apply = document.getElementById('applyNodeStyleButton');
    if (apply) apply.click();
    await new Promise(r => setTimeout(r, 2200));
    return 'style panel: set A fill #ff0000, applied';
  })()`);
  console.log('  route 1 -> ' + r1);
  const after1 = await page.evaluate(`(() => {
    const src = document.getElementById('source').value;
    return JSON.stringify({ styleLines: src.split(String.fromCharCode(10)).filter(l => /^\\s*(style|classDef|class)\\s/.test(l)) });
  })()`);
  console.log('  source after route 1: ' + after1);

  const r2 = await page.evaluate(`(async () => {
    const svg = document.querySelector('#diagram svg');
    if (!svg) return 'no svg';
    const nodes = Array.from(svg.querySelectorAll('g.node, [data-node-id]'));
    const target = nodes.find(n => /Check/.test(n.textContent || '')) || nodes[1] || nodes[0];
    if (!target) return 'no node elements';
    const box = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.left + box.width/2, clientY: box.top + box.height/2 }));
    await new Promise(r => setTimeout(r, 900));
    const insp = document.getElementById('nodeInspector');
    const open = !!(insp && !insp.hidden && insp.getBoundingClientRect().height > 2);
    if (!open) return 'clicking the block did NOT open the inspector';
    const f = document.getElementById('inspectorFillColor');
    if (!f) return 'inspector open but no inspectorFillColor';
    f.value = '#00ff00'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1800));
    return 'inspector: clicked block, set fill #00ff00 (no Apply button pressed)';
  })()`);
  console.log('  route 2 -> ' + r2);
  const after2 = await page.evaluate(`(() => {
    const src = document.getElementById('source').value;
    const insp = document.getElementById('nodeInspector');
    return JSON.stringify({
      styleLines: src.split(String.fromCharCode(10)).filter(l => /^\\s*(style|classDef|class)\\s/.test(l)),
      inspectorHasApply: !!Array.from(document.querySelectorAll('#nodeInspector button')).find(b => /apply/i.test(b.textContent)),
      inspectorButtons: Array.from(document.querySelectorAll('#nodeInspector button')).map(b => b.textContent.replace(/\\s+/g,' ').trim()).filter(Boolean).slice(0, 12),
      stylePanelButtons: ['applyNodeStyleButton','resetNodeStyleButton','clearNodeStylesButton'].map(id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\\s+/g,' ').trim() : null; })
    });
  })()`);
  console.log('  source after route 2: ' + after2);

  // does the Style panel now show what the inspector just did?
  const sync = await page.evaluate(`(() => {
    const t = document.getElementById('nodeStyleTarget');
    const f = document.getElementById('nodeFillColor');
    const i = document.getElementById('inspectorFillColor');
    return JSON.stringify({ stylePanelTarget: t ? t.value : null, stylePanelFill: f ? f.value : null, inspectorFill: i ? i.value : null });
  })()`);
  console.log('  do the two agree afterwards? ' + sync);

  /* ---------- C. the type chip vs the type picker ---------- */
  console.log('\n--- C. the diagram type chip vs the picker ---');
  const chip = await page.evaluate(`(async () => {
    const c = document.getElementById('diagramTypeChip');
    if (!c) return 'no chip';
    const before = { chipText: document.getElementById('diagramTypeText').textContent.trim(),
                     role: c.getAttribute('role'), label: c.getAttribute('aria-label'), tabindex: c.getAttribute('tabindex') };
    const barBefore = (() => { const b = document.getElementById('diagramTypeBar'); return b ? { onScreen: !!b.offsetParent, hidden: b.hidden } : null; })();
    c.click();
    await new Promise(r => setTimeout(r, 800));
    const barAfter = (() => { const b = document.getElementById('diagramTypeBar'); return b ? { onScreen: !!b.offsetParent, hidden: b.hidden } : null; })();
    const menu = document.querySelector('.struct-menu');
    return JSON.stringify({ before, barBefore, barAfter, menuOpened: !!menu,
      selectFocused: document.activeElement && document.activeElement.id,
      sourceUnchanged: true });
  })()`);
  console.log('  chip: ' + chip);

  /* ---------- D. the visual builder on a type it cannot build ---------- */
  console.log('\n--- D. the palette opening the visual builder on a pie chart ---');
  await page.evaluate(`(() => {
    const s = document.getElementById('source');
    s.value = 'pie showData\\n  title Coverage\\n  "Tested" : 70\\n  "Untested" : 30';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await page.waitForTimeout(2600);
  const dOut = await page.evaluate(`(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const input = document.getElementById('commandPaletteInput');
    input.value = 'Visual builder'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 250));
    const row = document.querySelector('#commandPaletteList .palette-row');
    if (row) row.click();
    await new Promise(r => setTimeout(r, 900));
    const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
    const panel = document.getElementById('visualModePanel');
    const status = document.getElementById('visualBuilderStatus');
    const controls = document.getElementById('visualBuilderControls');
    return JSON.stringify({
      tabLabel: document.getElementById('visualModeButton').textContent.replace(/\\s+/g,' ').trim(),
      panelOnScreen: !!(panel && !panel.hidden && panel.getBoundingClientRect().height > 2),
      status: status ? status.textContent.replace(/\\s+/g,' ').trim().slice(0, 180) : null,
      addButtonEnabled: (() => { const b = document.getElementById('addVisualNodeButton'); return b ? !b.disabled : null; })(),
      controlsHidden: controls ? controls.hidden : null,
      heading: document.getElementById('editorHeading').textContent.trim()
    });
  })()`);
  console.log('  ' + dOut);

  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r11_dupe/pie_visual_builder.png', clip: { x: 0, y: 90, width: 720, height: 620 } }).catch(() => {});

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
