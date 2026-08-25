/* Probe 4: routes to Style, the tour's claim, the command palette, fold memory,
   and whether "Assign class to block" on a blockless diagram touches anything. */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';

(async () => {
  const { page, close } = await openApp(APP, 9871, { width: 1500, height: 1000 });

  // ---- 1. The ⚙ Style button the tour points at
  const shortcut = await page.evaluate(`(() => {
    const b = document.getElementById('styleShortcutButton');
    const cs = getComputedStyle(b);
    return { display: cs.display, visibility: cs.visibility, rects: b.getClientRects().length,
             offsetParent: b.offsetParent === null ? 'null' : 'set',
             bodyGrouped: document.body.getAttribute('data-preview-grouped'),
             title: b.title };
  })()`);
  console.log('1 styleShortcutButton ' + JSON.stringify(shortcut));

  // does the tour actually run a step anchored to it?
  const tour = await page.evaluate(`(() => {
    const txt = document.documentElement.innerHTML;
    return { mentionsInTour: /Title, fonts, spacing, block styling and the legend live one click away/.test(txt) };
  })()`);
  console.log('1b tour text present in DOM: ' + JSON.stringify(tour));

  // ---- 2. Command palette
  await page.keyboard.press('Control+K');
  await page.waitForTimeout(900);
  let pal = await page.evaluate(`(() => {
    const open = Array.from(document.querySelectorAll('dialog[open],[class*="palette"]')).filter(e => e.getClientRects().length);
    return open.map(e => ({ id: e.id, cls: String(e.className).slice(0,40) }));
  })()`);
  console.log('2 palette after Ctrl+K: ' + JSON.stringify(pal));
  if (pal.length) {
    await page.keyboard.type('style');
    await page.waitForTimeout(700);
    const hits = await page.evaluate(`(() => Array.from(document.querySelectorAll('[class*="palette"] li,[class*="palette"] button,[class*="palette"] [role="option"]')).filter(e => e.getClientRects().length).map(e => e.textContent.replace(/\\s+/g,' ').trim().slice(0,70)).slice(0,15))()`);
    console.log('2b palette hits for "style": ' + JSON.stringify(hits, null, 1));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // ---- 3. Press count for three ordinary jobs, clicking only what is on screen
  const pressPath = async (label, steps) => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(4000);
    await page.evaluate(`(() => { for (let i=0;i<12;i++){ const b = Array.from(document.querySelectorAll('.tour-card button')).find(x => /skip|done|got it|close/i.test(x.textContent)); if (!b) break; b.click(); } document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} }); })()`);
    await page.waitForTimeout(900);
    let n = 0;
    for (const s of steps) {
      const hit = await page.evaluate(`(() => {
        const m = ${s};
        if (!m) return null;
        const r = m.getBoundingClientRect();
        return { text: m.textContent.replace(/\\s+/g,' ').trim().slice(0,40), x: r.x + r.width/2, y: r.y + r.height/2, w: r.width };
      })()`);
      if (!hit || !hit.w) { console.log(`3 ${label}: STEP NOT ON SCREEN after ${n} presses`); return; }
      await page.mouse.click(hit.x, hit.y);
      n++;
      await page.waitForTimeout(800);
    }
    const reached = await page.evaluate(`(() => { const e = ${steps.target || 'null'}; return e ? { visible: e.getClientRects().length > 0, top: Math.round(e.getBoundingClientRect().top) } : null; })()`);
    console.log(`3 ${label}: ${n} presses` + (reached ? ' -> ' + JSON.stringify(reached) : ''));
    return n;
  };

  const INSPECT = `document.getElementById('previewInspectButton')`;
  const STYLEROW = `Array.from(document.querySelectorAll('button,[role="menuitem"]')).find(b => /Style . fonts, colours, legend/i.test(b.textContent) && b.getClientRects().length)`;
  const foldSummary = name => `(() => { const d = Array.from(document.querySelectorAll('#settingsSection details.style-fold')).find(x => x.textContent.indexOf(${JSON.stringify(name)}) === 0 || (x.querySelector('summary span span')||{}).textContent === ${JSON.stringify(name)}); return d ? d.querySelector('summary') : null; })()`;

  let p;
  p = await pressPath('turn block numbering on', [INSPECT, STYLEROW]);
  console.log('   numberingStyle on screen now: ' + await page.evaluate(`(() => { const e = document.getElementById('numberingStyle'); return e.getClientRects().length > 0 && e.getBoundingClientRect().top > 0 && e.getBoundingClientRect().bottom < innerHeight; })()`));
  p = await pressPath('change the diagram font size', [INSPECT, STYLEROW, foldSummary('Fonts')]);
  console.log('   diagramFontSize on screen now: ' + await page.evaluate(`(() => { const e = document.getElementById('diagramFontSize'); const r = e.getBoundingClientRect(); return e.getClientRects().length > 0 && r.top > 0 && r.bottom < innerHeight; })()`));
  p = await pressPath('widen the spacing', [INSPECT, STYLEROW, foldSummary('Spacing & connectors')]);
  console.log('   layoutNodeSpacing on screen now: ' + await page.evaluate(`(() => { const e = document.getElementById('layoutNodeSpacing'); const r = e.getBoundingClientRect(); return e.getClientRects().length > 0 && r.top > 0 && r.bottom < innerHeight; })()`));

  // ---- 4. Does the Style card remember what you opened?
  await page.evaluate(`(() => { const d = Array.from(document.querySelectorAll('#settingsSection details.style-fold')); d.forEach(x => x.open = false); d[3].open = true; })()`);
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4500);
  const memory = await page.evaluate(`(() => {
    const ss = document.getElementById('settingsSection');
    return { cardOpen: ss.open, folds: Array.from(ss.querySelectorAll('details.style-fold')).map(d => ((d.querySelector('summary span span')||{}).textContent||'').trim() + '=' + d.open) };
  })()`);
  console.log('4 after reload: ' + JSON.stringify(memory));

  // ---- 5. Assign class to block on a diagram with no blocks
  await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = 'sequence'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
  await confirmDialog(page, 1500);
  await page.waitForTimeout(2500);
  await page.evaluate(`document.querySelectorAll('#settingsSection, #settingsSection details').forEach(d => d.open = true)`);
  const src0 = await page.evaluate(`document.getElementById('source').value`);
  await page.evaluate(`(() => { const n = document.getElementById('styleClassName'); n.value = 'ZZ'; n.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('createStyleClassButton').click(); })()`);
  await page.waitForTimeout(900);
  await page.evaluate(`(() => document.getElementById('assignStyleClassButton').click())()`);
  await page.waitForTimeout(1400);
  const src1 = await page.evaluate(`document.getElementById('source').value`);
  console.log('5 assign-class on sequence changed the source: ' + (src0 !== src1) + ' | selected block option="' +
    await page.evaluate(`(() => { const s = document.getElementById('nodeStyleTarget'); return s.options[s.selectedIndex] ? s.options[s.selectedIndex].textContent.trim() : '(none)'; })()`) + '"');

  await close();
})();
