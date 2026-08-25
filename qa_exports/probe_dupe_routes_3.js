#!/usr/bin/env node
/* Part 3. The routes a person actually walks, measured at the sizes they use.
 *
 *   E. Which of the colliding labels the command palette KEEPS, and which it silently drops.
 *   F. The Style verb: is the ⚙ Style button on screen at all, at four widths?
 *   G. Zoom / Fit: toolbar vs the zoom popover vs right-click vs the palette.
 *   H. Theme: the menu button vs the hidden native <select> vs the mobile <select>.
 *   I. The node inspector opened by a REAL click, against the Style panel's block fields.
 *
 * Usage: node probe_dupe_routes_3.js [--port 9814]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9814'));

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

  /* ---------- E. which colliding label the palette keeps ---------- */
  console.log('--- E. label collisions: which button the palette row actually fires ---');
  const collisions = JSON.parse(await page.evaluate(`(() => {
    // Replay the harvest in DOM order exactly as buildCommandRegistry does.
    const seen = new Map();
    document.querySelectorAll('button[id]').forEach(b => {
      if (b.dataset.palette === 'skip') return;
      const visible = String(b.textContent || '').replace(/\\s+/g, ' ').trim();
      const tooltip = String(b.getAttribute('title') || '').replace(/\\s+/g, ' ').trim();
      const label = (visible.length >= 3 && visible.length <= 40) ? visible : (tooltip.length <= 40 ? tooltip : visible);
      if (!label || label.length < 2 || label.length > 44) return;
      if (/^[×✓+−◀▶▸▾]+$/.test(label)) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(b.id);
    });
    const out = [];
    seen.forEach((ids, label) => { if (ids.length > 1) out.push({ label, wins: ids[0], dropped: ids.slice(1) }); });
    return JSON.stringify(out.sort((a,b) => b.dropped.length - a.dropped.length));
  })()`));
  console.log('  ' + collisions.length + ' labels are claimed by more than one button; the palette keeps the FIRST in DOM order');
  collisions.forEach(c => {
    console.log('    "' + c.label + '"  palette fires #' + c.wins + '   |  unreachable from the palette: ' + c.dropped.join(', '));
  });

  /* ---------- F. the Style verb, at four widths ---------- */
  console.log('\n--- F. reaching the style controls, by viewport width ---');
  for (const w of [1920, 1440, 1200, 1024, 900, 480]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(700);
    const s = JSON.parse(await page.evaluate(`(() => {
      const on = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 1); };
      return JSON.stringify({
        styleButton: on('styleShortcutButton'),
        inspectMenuButton: on('previewInspectButton'),
        viewMenuButton: on('previewViewButton'),
        zoomIn: on('zoomInButton'), zoomOut: on('zoomOutButton'),
        zoomChip: on('zoomChipButton'), zoomCaret: on('zoomMenuButton'),
        fitPage: on('fitPageButton'), fitWidth: on('fitWidthButton'), actualSize: on('actualSizeButton'),
        themeButton: on('themeMenuButton'), themeSelectMobile: on('themePresetMobile'),
        settingsCard: on('settingsSection'),
        nodeFill: on('nodeFillColor')
      });
    })()`));
    console.log('  ' + String(w).padStart(4) + 'px  Style=' + String(s.styleButton).padEnd(5)
      + ' Inspect\u25be=' + String(s.inspectMenuButton).padEnd(5)
      + ' View\u25be=' + String(s.viewMenuButton).padEnd(5)
      + ' zoom+/-=' + String(s.zoomIn).padEnd(5)
      + ' zoomChip=' + String(s.zoomChip).padEnd(5)
      + ' fitPage=' + String(s.fitPage).padEnd(5)
      + ' actualSize=' + String(s.actualSize).padEnd(5)
      + ' themeBtn=' + String(s.themeButton).padEnd(5)
      + ' themeMobile=' + String(s.themeSelectMobile).padEnd(5)
      + ' nodeFillVisible=' + s.nodeFill);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(600);

  /* how many clicks from cold to a visible fill swatch */
  const path = JSON.parse(await page.evaluate(`(async () => {
    const on = id => { const e = document.getElementById(id); return !!(e && e.offsetParent && e.getBoundingClientRect().width > 1); };
    const steps = [];
    if (on('nodeFillColor')) return JSON.stringify({ clicks: 0, steps: ['already visible'] });
    // route via the Inspect menu, which is what is on screen
    const inspect = document.getElementById('previewInspectButton');
    if (inspect && inspect.offsetParent) {
      inspect.click(); steps.push('click Inspect \u25be'); await new Promise(r => setTimeout(r, 400));
      const row = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item')).find(r => /style/i.test(r.textContent));
      if (row) { row.click(); steps.push('pick "' + row.textContent.replace(/\\s+/g,' ').trim() + '"'); await new Promise(r => setTimeout(r, 900)); }
    }
    if (on('nodeFillColor')) return JSON.stringify({ clicks: steps.length, steps });
    const folds = Array.from(document.querySelectorAll('#settingsSection .style-fold'));
    const foldNames = folds.map(f => (f.querySelector('summary')||{}).textContent ? f.querySelector('summary').textContent.replace(/\\s+/g,' ').trim().slice(0,30) : '?');
    const owner = document.getElementById('nodeFillColor') ? document.getElementById('nodeFillColor').closest('details') : null;
    if (owner && !owner.open) { owner.open = true; steps.push('open the fold "' + ((owner.querySelector('summary')||{}).textContent||'').replace(/\\s+/g,' ').trim().slice(0,34) + '"'); await new Promise(r => setTimeout(r, 400)); }
    return JSON.stringify({ clicks: steps.length, steps, foldNames, foldsOpen: folds.filter(f => f.open).length, foldCount: folds.length });
  })()`));
  console.log('  clicks from cold to a visible block-fill swatch: ' + path.clicks);
  (path.steps || []).forEach(s => console.log('      - ' + s));
  if (path.foldNames) console.log('      style folds: ' + path.foldNames.join(' | ') + '   (' + path.foldsOpen + ' of ' + path.foldCount + ' open)');

  /* ---------- G. zoom / fit: four routes, one number ---------- */
  console.log('\n--- G. "make it 100%" and "fit the page": every route ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3000);
  const zoomRoutes = [
    ['toolbar fitPageButton', `document.getElementById('fitPageButton').click()`],
    ['toolbar actualSizeButton', `document.getElementById('actualSizeButton').click()`],
    ['zoom popover, then + ', `(() => { const m = document.getElementById('zoomMenuButton'); if (m) m.click(); })()`],
    ['palette "Actual size"', 'PALETTE:Actual size'],
    ['palette "Fit page"', 'PALETTE:Fit page'],
    ['palette "Zoom in"', 'PALETTE:Zoom in']
  ];
  for (const [name, js] of zoomRoutes) {
    await page.evaluate(`(() => { const b = document.getElementById('fitWidthButton'); if (b) b.click(); })()`);
    await page.waitForTimeout(500);
    const before = await page.evaluate(`document.getElementById('zoomValue').textContent.trim()`);
    let ran = 'ok';
    if (js.startsWith('PALETTE:')) {
      ran = await page.evaluate(`(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        await new Promise(r => setTimeout(r, 220));
        const input = document.getElementById('commandPaletteInput');
        input.value = ${JSON.stringify(js.slice(8))}; input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 220));
        const row = document.querySelector('#commandPaletteList .palette-row');
        const title = row ? row.querySelector('span').textContent.trim() : '(no row)';
        if (row) row.click();
        await new Promise(r => setTimeout(r, 700));
        const p = document.getElementById('commandPalette'); if (p) p.hidden = true;
        return 'row="' + title + '"';
      })()`);
    } else {
      try { await page.evaluate(js); } catch (e) { ran = 'threw: ' + String(e.message).slice(0, 40); }
    }
    await page.waitForTimeout(700);
    const after = await page.evaluate(`(() => ({ zoom: document.getElementById('zoomValue').textContent.trim(), popover: (() => { const p = document.getElementById('zoomPopover'); return !!(p && !p.hidden); })() }))()`).then(v => v);
    console.log('  ' + name.padEnd(26) + ' ' + before.padStart(6) + '  ->  ' + String(after.zoom).padStart(6)
      + (after.popover ? '   (zoom popover open)' : '') + '   ' + ran);
    await page.evaluate(`(() => { const p = document.getElementById('zoomPopover'); if (p && !p.hidden) { const b = document.getElementById('zoomMenuButton'); if (b) b.click(); } })()`);
    await page.waitForTimeout(300);
  }

  /* ---------- H. theme: three controls, one setting ---------- */
  console.log('\n--- H. theme: the menu button, the hidden native select, the mobile select ---');
  const themeState = () => page.evaluate(`(() => JSON.stringify({
    bodyTheme: document.body.dataset.theme,
    menuLabel: (document.getElementById('themeMenuLabel')||{}).textContent,
    nativeSelect: (document.getElementById('themePreset')||{}).value,
    mobileSelect: (document.getElementById('themePresetMobile')||{}).value
  }))()`);
  console.log('  at start:            ' + await themeState());
  await page.evaluate(`(() => { const s = document.getElementById('themePreset'); s.value = 'navy'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(900);
  console.log('  after #themePreset=navy:      ' + await themeState());
  await page.evaluate(`(() => { const s = document.getElementById('themePresetMobile'); s.value = 'paper'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(900);
  console.log('  after #themePresetMobile=paper: ' + await themeState());
  const viaMenu = await page.evaluate(`(async () => {
    const b = document.getElementById('themeMenuButton');
    if (!b) return 'no theme menu button';
    b.click(); await new Promise(r => setTimeout(r, 500));
    const opts = Array.from(document.querySelectorAll('.theme-menu-option'));
    const want = opts.find(o => /slate/i.test(o.textContent));
    if (!want) return 'menu opened, ' + opts.length + ' options, no Slate row';
    want.click(); await new Promise(r => setTimeout(r, 700));
    return 'picked Slate from the menu (' + opts.length + ' options in the menu)';
  })()`);
  console.log('  ' + viaMenu);
  console.log('  after the menu:      ' + await themeState());
  const themeCounts = await page.evaluate(`JSON.stringify({
    menuOptions: document.querySelectorAll('.theme-menu-option').length,
    nativeOptions: document.getElementById('themePreset').options.length,
    mobileOptions: document.getElementById('themePresetMobile').options.length
  })`);
  console.log('  how many themes each route offers: ' + themeCounts);

  /* ---------- I. the node inspector, opened with a real mouse click ---------- */
  console.log('\n--- I. the block inspector vs the Style panel\'s block fields ---');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3200);
  const box = await page.evaluate(`(() => {
    const svg = document.querySelector('#diagram svg');
    if (!svg) return null;
    const n = Array.from(svg.querySelectorAll('g.node')).find(g => /Check/.test(g.textContent||'')) || svg.querySelector('g.node');
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return JSON.stringify({ x: r.left + r.width/2, y: r.top + r.height/2, text: (n.textContent||'').trim() });
  })()`).then(v => v ? JSON.parse(v) : null);
  if (!box) { console.log('  no node to click'); }
  else {
    console.log('  clicking block "' + box.text + '" at ' + Math.round(box.x) + ',' + Math.round(box.y));
    await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(1100);
    const insp = JSON.parse(await page.evaluate(`(() => {
      const i = document.getElementById('nodeInspector');
      const open = !!(i && !i.hidden && i.getBoundingClientRect().height > 2);
      return JSON.stringify({ open,
        inspectorFill: (document.getElementById('inspectorFillColor')||{}).value,
        stylePanelTarget: (document.getElementById('nodeStyleTarget')||{}).value,
        stylePanelFill: (document.getElementById('nodeFillColor')||{}).value,
        inspectorFields: Array.from(i ? i.querySelectorAll('input,select,button') : []).map(e => e.id).filter(Boolean).length });
    })()`));
    console.log('  inspector after the click: ' + JSON.stringify(insp));
    if (insp.open) {
      await page.evaluate(`(() => { const f = document.getElementById('inspectorFillColor'); f.value = '#00c853'; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await page.waitForTimeout(1800);
      const agree = await page.evaluate(`JSON.stringify({
        inspectorFill: document.getElementById('inspectorFillColor').value,
        stylePanelTarget: document.getElementById('nodeStyleTarget').value,
        stylePanelFill: document.getElementById('nodeFillColor').value,
        stylePanelHex: document.getElementById('nodeFillHex').value
      })`);
      console.log('  after setting the inspector fill to #00c853: ' + agree);
      console.log('    (if stylePanelTarget is empty or its fill differs, the two controls do not share the selection)');
      await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r11_dupe/inspector_open.png' });
    }
  }

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
