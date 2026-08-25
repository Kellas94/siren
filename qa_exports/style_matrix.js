/* THE MATRIX. For each diagram type and each Style control: does using it change the rendered SVG?
 *
 * Nothing here is read from source code. Each pair is measured: signature of the live SVG before,
 * set the control the way a person would, wait for the re-render, signature after.
 *
 * Two things had to be solved before any of it meant anything:
 *  1. The <style> block inside a Mermaid SVG is a text node carrying a per-render id. Counting it
 *     made every control on every type look like it "changed the text".
 *  2. SIREN renders edge-label boxes with a hand-drawn (rough.js) stroke, whose control points are
 *     randomised per render. On the flowchart starter exactly 4 of 70 geometry entries differ
 *     between two IDENTICAL renders. So the probe calibrates first: it re-renders the untouched
 *     source four times, marks the entries that move on their own, and excludes those indices.
 *     Without that, "connector curve does nothing on a flowchart" and "connector curve works" are
 *     indistinguishable.
 *
 * usage: node style_matrix.js <port> <type,type,...>
 */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const fs = require('fs');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[2] || 9850);
const TYPES = (process.argv[3] || 'flowchart').split(',');

const SIG = `(() => {
  const svg = document.querySelector('#diagram svg');
  if (!svg) return { missing: true };
  const h = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };
  const geom = [], paint = [], typo = [], text = [];
  for (const el of svg.querySelectorAll('*')) {
    const t = el.tagName.toLowerCase();
    if (t === 'path' || t === 'line' || t === 'polyline' || t === 'polygon')
      geom.push(t + ':' + (el.getAttribute('d') || el.getAttribute('points') || '') + (el.getAttribute('x1')||'') + (el.getAttribute('y1')||'') + (el.getAttribute('x2')||'') + (el.getAttribute('y2')||''));
    else if (t === 'rect' || t === 'circle' || t === 'ellipse' || t === 'foreignobject' || t === 'image')
      geom.push(t + ':' + ['x','y','width','height','cx','cy','r','rx','ry'].map(a => el.getAttribute(a) || '').join(','));
    else if (t === 'g' && el.getAttribute('transform')) geom.push('g:' + el.getAttribute('transform'));
    if (/^(rect|circle|ellipse|path|polygon|text|tspan|line)$/.test(t)) {
      const cs = getComputedStyle(el);
      paint.push(cs.fill + '|' + cs.stroke + '|' + cs.strokeWidth + '|' + cs.opacity);
    }
    if (t === 'text' || t === 'tspan' || t === 'div' || t === 'span' || t === 'p') {
      const cs = getComputedStyle(el);
      typo.push(cs.fontFamily + '|' + cs.fontSize + '|' + cs.fontWeight + '|' + cs.fontStyle);
    }
  }
  const walk = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT, {
    acceptNode: nd => /^(style|script)$/i.test((nd.parentElement && nd.parentElement.tagName) || '')
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = walk.nextNode())) { const v = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (v) text.push(v); }
  const r = svg.getBoundingClientRect();
  return {
    geom: geom.map(h), paint: paint.map(h), typo: typo.map(h), text: text.map(h),
    textSample: text.slice(0, 6).join(' / ').slice(0, 90),
    box: svg.getAttribute('viewBox') + '|' + Math.round(r.width) + 'x' + Math.round(r.height),
    styleTag: h((svg.querySelector('style') ? svg.querySelector('style').textContent : '').replace(/[#.][A-Za-z0-9_-]*\\d{3,}/g, 'ID')),
    legendNodes: svg.querySelectorAll('[class*="legend"],[id*="legend"]').length,
    titleEl: ((document.getElementById('diagramTitlePreview') || {}).textContent || '').trim()
  };
})()`;

const LISTS = ['geom', 'paint', 'typo', 'text'];
const SCALARS = ['box', 'styleTag', 'legendNodes', 'titleEl'];

function diff(a, b, excl) {
  if (a.missing || b.missing) return ['MISSING-SVG'];
  const out = [];
  for (const k of LISTS) {
    const A = a[k], B = b[k], skip = (excl && excl[k]) || new Set();
    if (A.length !== B.length) { out.push(k); continue; }
    for (let i = 0; i < A.length; i++) if (!skip.has(i) && A[i] !== B[i]) { out.push(k); break; }
  }
  for (const k of SCALARS) if (String(a[k]) !== String(b[k])) out.push(k);
  return out;
}

const CONTROLS = [
  { key: 'diagramTitle',          fold: 'Title & numbering',    set: `el => { el.value = 'ZZTITLEZZ'; }` },
  { key: 'numberingStyle',        fold: 'Title & numbering',    set: `el => { el.value = 'flat'; }` },
  { key: 'layoutDensity',         fold: 'Spacing & connectors', set: `el => { el.value = 'spacious'; }`,   apply: 'applyLayoutButton' },
  { key: 'layoutAlignment',       fold: 'Spacing & connectors', set: `el => { el.value = 'end'; }`,        apply: 'applyLayoutButton' },
  { key: 'layoutNodeSpacing',     fold: 'Spacing & connectors', set: `el => { el.value = '150'; }`,        apply: 'applyLayoutButton' },
  { key: 'layoutRankSpacing',     fold: 'Spacing & connectors', set: `el => { el.value = '220'; }`,        apply: 'applyLayoutButton' },
  { key: 'curve',                 fold: 'Spacing & connectors', set: `el => { el.value = 'stepAfter'; }` },
  { key: 'layoutRouting',         fold: 'Spacing & connectors', set: `el => { el.value = 'orthogonal'; }`, apply: 'applyLayoutButton' },
  { key: 'diagramPaletteColour0', fold: 'Chart colours',        set: `el => { el.value = '#ff00cc'; }`,    apply: 'applyDiagramPaletteButton' },
  { key: 'diagramFontFamily',     fold: 'Fonts',                set: `el => { el.value = 'Courier New'; }` },
  { key: 'diagramFontSize',       fold: 'Fonts',                set: `el => { el.value = '26'; }` },
  { key: 'diagramFontWeight',     fold: 'Fonts',                set: `el => { el.value = '800'; }` },
  { key: 'legendEnabled',         fold: 'Legend',               set: `el => { el.checked = true; }`, pre: 'legendPrep' }
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
           opacity: getComputedStyle(el).opacity, pe: getComputedStyle(el).pointerEvents,
           foldOpen: fold ? fold.open : null,
           hint: (() => { const w = el.closest('div'); const hh = w && w.querySelector('.field-hint'); return hh ? hh.textContent.replace(/\\s+/g,' ').trim().slice(0,140) : ''; })() };
})()`);

(async () => {
  const { page, close } = await openApp(APP, PORT, { width: 1500, height: 1000 });
  const out = {};
  const noop = async () => {
    await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = s.value; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await page.waitForTimeout(1600);
  };

  for (const type of TYPES) {
    await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => {
      const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length);
      (b || document.getElementById('newDiagramTypeButton')).click();
    })()`);
    await confirmDialog(page, 1500);
    await page.waitForTimeout(2400);

    const fixture = await page.evaluate(`(() => {
      const src = document.getElementById('source').value;
      const first = src.split('\\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))[0] || '';
      return { first: first.slice(0, 70), chip: ((document.getElementById('diagramTypeText') || {}).textContent || '').trim(),
               selVal: document.getElementById('diagramTypeSelect').value,
               hasSvg: !!document.querySelector('#diagram svg'),
               status: ((document.getElementById('status') || {}).textContent || '').trim().slice(0, 60) };
    })()`);
    await page.evaluate(`document.querySelectorAll('#settingsSection, #settingsSection details').forEach(d => d.open = true)`);
    await page.waitForTimeout(300);

    // --- calibration: what moves on its own?
    await noop(); await noop();
    const excl = {}; LISTS.forEach(k => excl[k] = new Set());
    const scalarNoise = new Set();
    let cal = await page.evaluate(SIG);
    for (let i = 0; i < 3; i++) {
      await noop();
      const nxt = await page.evaluate(SIG);
      if (!cal.missing && !nxt.missing) {
        for (const k of LISTS) if (cal[k].length === nxt[k].length)
          for (let j = 0; j < cal[k].length; j++) if (cal[k][j] !== nxt[k][j]) excl[k].add(j);
        for (const k of SCALARS) if (String(cal[k]) !== String(nxt[k])) scalarNoise.add(k);
      }
      cal = nxt;
    }
    const calSummary = LISTS.map(k => k + ':' + excl[k].size + '/' + (cal[k] ? cal[k].length : 0)).join(' ');

    const row = { fixture, baseText: cal.textSample, unstable: calSummary, scalarNoise: [...scalarNoise], controls: {} };
    console.log(`\n### ${type} | src="${fixture.first}" | chip="${fixture.chip}" | svg=${fixture.hasSvg} | unstable ${calSummary}${scalarNoise.size ? ' scalars:' + [...scalarNoise].join(',') : ''}`);

    for (const c of CONTROLS) {
      const st = await state(page, c.key);
      if (!st.exists) { row.controls[c.key] = { verdict: 'NO-ELEMENT', st }; console.log(`  ---  ${c.key} does not exist`); continue; }
      if (c.pre === 'legendPrep') {
        await page.evaluate(`(() => {
          const r0 = document.querySelector('#legendItems .legend-edit-row');
          if (r0) { const cb = r0.querySelector('.legend-item-enabled'), lb = r0.querySelector('.legend-item-label');
            cb.checked = true; lb.value = 'ZZLEGENDZZ';
            cb.dispatchEvent(new Event('change', { bubbles: true })); lb.dispatchEvent(new Event('input', { bubbles: true })); }
        })()`);
        await page.waitForTimeout(400);
      }
      const before = await page.evaluate(SIG);
      const prev = await setCtl(page, c.key, c.set);
      if (c.apply) await page.evaluate(`(() => { const b = document.getElementById(${JSON.stringify(c.apply)}); if (b) b.click(); })()`);
      await page.waitForTimeout(c.apply ? 1800 : 1600);
      const after = await page.evaluate(SIG);
      const changed = diff(before, after, excl).filter(k => !scalarNoise.has(k));
      row.controls[c.key] = { verdict: changed.length ? 'CHANGES' : 'DEAD', changed, st,
                              boxBefore: before.box, boxAfter: after.box, prev };
      console.log(`  ${changed.length ? 'YES' : ' no'}  ${c.key.padEnd(24)} vis=${st.visible ? 1 : 0} dis=${st.disabled ? 1 : 0} -> [${changed.join(',')}]`);
      await restore(page, c.key, prev);
      if (c.apply) await page.evaluate(`(() => { const b = document.getElementById(${JSON.stringify(c.apply)}); if (b) b.click(); })()`);
      if (c.pre === 'legendPrep') await page.evaluate(`(() => { const r0 = document.querySelector('#legendItems .legend-edit-row .legend-item-enabled'); if (r0) { r0.checked = false; r0.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
      await page.waitForTimeout(900);
    }

    row.blockPicker = await page.evaluate(`(() => {
      const s = document.getElementById('nodeStyleTarget');
      return { options: s ? s.options.length : -1, disabled: s ? s.disabled : null,
               first: s && s.options[0] ? s.options[0].textContent.trim().slice(0,40) : '',
               hint: ((document.getElementById('nodeStyleHint') || {}).textContent || '').replace(/\\s+/g,' ').trim().slice(0,120) };
    })()`);
    row.paletteNotes = await page.evaluate(`(() => ((document.getElementById('diagramPaletteNotes') || {}).textContent || '').replace(/\\s+/g,' ').trim().slice(0,200))()`);
    row.gitSectionVisible = await page.evaluate(`(() => { const g = document.getElementById('gitBranchSection'); return !!(g && !g.hidden); })()`);
    console.log(`  blocks offered=${row.blockPicker.options} (${row.blockPicker.first}) gitSection=${row.gitSectionVisible}`);
    out[type] = row;
  }

  fs.writeFileSync('C:/Claude/SIREN/qa_exports/style_shot/matrix_' + PORT + '.json', JSON.stringify(out, null, 1));
  console.log('\nWROTE matrix_' + PORT + '.json');
  await close();
})();
