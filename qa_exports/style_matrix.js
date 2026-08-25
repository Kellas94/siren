/* THE MATRIX. For each diagram type and each Style control: does using it change the rendered SVG?
 *
 * Not read from code. Each pair is measured: signature of the live SVG before, set the control,
 * wait for the re-render, signature after. A pair whose every signature component is unchanged
 * did nothing.
 *
 * usage: node style_matrix.js <port> <type,type,...>
 */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const fs = require('fs');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[2] || 9850);
const TYPES = (process.argv[3] || 'flowchart').split(',');

/* ---- the signature -------------------------------------------------------------------------
   Six independent components so a "no" can be told apart from a "yes, but only the colours".
   Mermaid re-uses element ids across renders, so the raw markup is not comparable; these are. */
const SIG = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return { missing: true };
  const h = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };
  const nodes = Array.from(svg.querySelectorAll('*'));
  const geom = [];
  const paint = [];
  const typo = [];
  const text = [];
  for (const el of nodes) {
    const t = el.tagName.toLowerCase();
    if (t === 'path' || t === 'line' || t === 'polyline' || t === 'polygon')
      geom.push(t + ':' + (el.getAttribute('d') || el.getAttribute('points') || '') + (el.getAttribute('x1')||'') + (el.getAttribute('y1')||'') + (el.getAttribute('x2')||'') + (el.getAttribute('y2')||''));
    if (t === 'rect' || t === 'circle' || t === 'ellipse' || t === 'foreignobject' || t === 'image')
      geom.push(t + ':' + ['x','y','width','height','cx','cy','r','rx','ry'].map(a => el.getAttribute(a) || '').join(','));
    if (t === 'g' && el.getAttribute('transform')) geom.push('g:' + el.getAttribute('transform'));
    if (/^(rect|circle|ellipse|path|polygon|text|tspan|line)$/.test(t)) {
      const cs = getComputedStyle(el);
      paint.push(t + '|' + cs.fill + '|' + cs.stroke + '|' + cs.strokeWidth + '|' + cs.opacity);
    }
    if (t === 'text' || t === 'tspan' || t === 'div' || t === 'span' || t === 'p') {
      const cs = getComputedStyle(el);
      typo.push(cs.fontFamily + '|' + cs.fontSize + '|' + cs.fontWeight + '|' + cs.fontStyle);
    }
  }
  // visible text, in document order
  const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  let n; while ((n = walk.nextNode())) { const v = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (v) text.push(v); }
  const box = svg.getAttribute('viewBox') + '|' + svg.getAttribute('width') + '|' + svg.getAttribute('height') +
              '|' + Math.round(svg.getBoundingClientRect().width) + 'x' + Math.round(svg.getBoundingClientRect().height);
  return {
    geom: h(geom.join(';')), geomN: geom.length,
    paint: h(paint.join(';')), paintN: paint.length,
    typo: h(typo.join(';')), typoN: typo.length,
    text: h(text.join(';')), textN: text.length, textSample: text.slice(0, 6).join(' / ').slice(0, 90),
    box: box,
    styleTag: h((svg.querySelector('style') ? svg.querySelector('style').textContent : '').replace(/#[A-Za-z0-9_-]*\\d+/g, '#ID')),
    legendNodes: svg.querySelectorAll('[class*="legend"],[id*="legend"]').length,
    titleEl: (document.getElementById('diagramTitlePreview') || {}).textContent || ''
  };
})()`;

const diff = (a, b) => {
  if (a.missing || b.missing) return ['MISSING-SVG'];
  const keys = ['geom', 'paint', 'typo', 'text', 'box', 'styleTag', 'legendNodes', 'titleEl'];
  return keys.filter(k => String(a[k]) !== String(b[k]));
};

/* ---- the controls under test --------------------------------------------------------------- */
const CONTROLS = [
  { key: 'diagramTitle',      fold: 'Title',    set: `el => { el.value = 'ZZTITLEZZ'; }` },
  { key: 'numberingStyle',    fold: 'Title',    set: `el => { el.value = 'flat'; }` },
  { key: 'layoutDensity',     fold: 'Spacing',  set: `el => { el.value = 'spacious'; }`, apply: 'applyLayoutButton' },
  { key: 'layoutAlignment',   fold: 'Spacing',  set: `el => { el.value = 'end'; }`,      apply: 'applyLayoutButton' },
  { key: 'layoutNodeSpacing', fold: 'Spacing',  set: `el => { el.value = '150'; }`,      apply: 'applyLayoutButton' },
  { key: 'layoutRankSpacing', fold: 'Spacing',  set: `el => { el.value = '220'; }`,      apply: 'applyLayoutButton' },
  { key: 'curve',             fold: 'Spacing',  set: `el => { el.value = 'stepAfter'; }` },
  { key: 'layoutRouting',     fold: 'Spacing',  set: `el => { el.value = 'orthogonal'; }`, apply: 'applyLayoutButton' },
  { key: 'diagramPaletteColour0', fold: 'Chart', set: `el => { el.value = '#ff00cc'; }`, apply: 'applyDiagramPaletteButton' },
  { key: 'diagramFontFamily', fold: 'Fonts',    set: `el => { el.value = 'Courier New'; }` },
  { key: 'diagramFontSize',   fold: 'Fonts',    set: `el => { el.value = '26'; }` },
  { key: 'diagramFontWeight', fold: 'Fonts',    set: `el => { el.value = '800'; }` },
  { key: 'legendEnabled',     fold: 'Legend',   set: `el => { el.checked = true; }`, pre: 'legendPrep' }
];

const setCtl = (page, id, setter) => page.evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return 'missing';
  const before = el.type === 'checkbox' ? el.checked : el.value;
  (${setter})(el);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return before;
})()`);

const restore = (page, id, before) => page.evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return;
  if (el.type === 'checkbox') el.checked = ${JSON.stringify(before)}; else el.value = ${JSON.stringify(before)};
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
})()`);

const state = (page, id) => page.evaluate(`(() => {
  const el = document.getElementById(${JSON.stringify(id)});
  if (!el) return { exists: false };
  const vis = !!(el.offsetParent !== null || el.getClientRects().length);
  const fold = el.closest('details.style-fold');
  return { exists: true, visible: vis, disabled: !!el.disabled, hidden: !!el.hidden,
           ariaDisabled: el.getAttribute('aria-disabled'), title: el.title || '',
           foldOpen: fold ? fold.open : null,
           hint: (() => { const w = el.closest('div'); const hh = w && w.querySelector('.field-hint'); return hh ? hh.textContent.replace(/\\s+/g,' ').trim().slice(0,120) : ''; })() };
})()`);

(async () => {
  const { page, close } = await openApp(APP, PORT, { width: 1500, height: 1000 });
  const out = {};

  for (const type of TYPES) {
    // --- make the fixture the way a person does
    await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length);
      (b || document.getElementById('newDiagramTypeButton')).click();
    })()`);
    await confirmDialog(page, 1500);
    await page.waitForTimeout(2600);

    // --- ASSERT THE FIXTURE
    const fixture = await page.evaluate(`(() => {
      const src = document.getElementById('source').value;
      const first = src.split('\\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))[0] || '';
      return { first: first.slice(0, 70), chip: (document.getElementById('diagramTypeText') || {}).textContent || '',
               selVal: document.getElementById('diagramTypeSelect').value,
               hasSvg: !!document.querySelector('#diagram svg'),
               status: (document.getElementById('status') || {}).textContent || '' };
    })()`);
    // open every fold so nothing is measured through a closed container
    await page.evaluate(`document.querySelectorAll('#settingsSection, #settingsSection details').forEach(d => d.open = true)`);
    await page.waitForTimeout(300);

    const base = await page.evaluate(SIG);
    const row = { fixture, baseText: base.textSample, controls: {} };
    console.log(`\n### ${type} | src="${fixture.first}" | chip="${fixture.chip}" | svg=${fixture.hasSvg} | ${base.geomN} geom nodes`);

    for (const c of CONTROLS) {
      const st = await state(page, c.key);
      if (!st.exists) { row.controls[c.key] = { verdict: 'NO-ELEMENT', st }; continue; }
      if (c.pre === 'legendPrep') {
        await page.evaluate(`(() => {
          const rows = document.querySelectorAll('#legendItems .legend-edit-row');
          if (rows[0]) { const cb = rows[0].querySelector('.legend-item-enabled'); const lb = rows[0].querySelector('.legend-item-label');
            cb.checked = true; lb.value = 'ZZLEGENDZZ';
            cb.dispatchEvent(new Event('change', { bubbles: true })); lb.dispatchEvent(new Event('input', { bubbles: true })); }
        })()`);
        await page.waitForTimeout(300);
      }
      const before = await page.evaluate(SIG);
      const prev = await setCtl(page, c.key, c.set);
      if (c.apply) { await page.evaluate(`(() => { const b = document.getElementById(${JSON.stringify(c.apply)}); if (b) b.click(); })()`); }
      await page.waitForTimeout(c.apply ? 1700 : 1500);
      const after = await page.evaluate(SIG);
      const changed = diff(before, after);
      row.controls[c.key] = { verdict: changed.length ? 'CHANGES' : 'DEAD', changed, st,
                              boxBefore: before.box, boxAfter: after.box };
      console.log(`  ${changed.length ? 'YES' : ' no'}  ${c.key.padEnd(24)} vis=${st.visible ? 1 : 0} dis=${st.disabled ? 1 : 0} -> [${changed.join(',')}]`);
      // put it back
      await restore(page, c.key, prev);
      if (c.apply) await page.evaluate(`(() => { const b = document.getElementById(${JSON.stringify(c.apply)}); if (b) b.click(); })()`);
      if (c.pre === 'legendPrep') await page.evaluate(`(() => { const r = document.querySelector('#legendItems .legend-edit-row .legend-item-enabled'); if (r) { r.checked = false; r.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
      await page.waitForTimeout(900);
    }

    // extra: how many blocks does the block picker offer for this type?
    row.blockPicker = await page.evaluate(`(() => {
      const s = document.getElementById('nodeStyleTarget');
      return { options: s ? s.options.length : -1, disabled: s ? s.disabled : null,
               first: s && s.options[0] ? s.options[0].textContent.trim().slice(0,40) : '',
               hint: (document.getElementById('nodeStyleHint') || {}).textContent || '' };
    })()`);
    row.chartFoldHint = await page.evaluate(`(() => (document.getElementById('styleFoldNameChart') || {}).nextElementSibling?.textContent || '')()`).catch(() => '');
    row.paletteNotes = await page.evaluate(`(() => (document.getElementById('diagramPaletteNotes') || {}).textContent.replace(/\\s+/g,' ').trim().slice(0,200))()`);
    row.gitSectionVisible = await page.evaluate(`(() => { const g = document.getElementById('gitBranchSection'); return !!(g && !g.hidden); })()`);
    console.log(`  blocks offered=${row.blockPicker.options} | paletteNotes="${row.paletteNotes}"`);
    out[type] = row;
  }

  fs.writeFileSync('C:/Claude/SIREN/qa_exports/style_shot/matrix_' + PORT + '.json', JSON.stringify(out, null, 1));
  console.log('\nWROTE matrix_' + PORT + '.json');
  await close();
})();
