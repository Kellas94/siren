/* Probe 3: when a live Style control does nothing, does the app SAY anything?
   Plus: the Advanced starter, the style-class buttons on a blockless type, and the
   Chart-colours fold's own claim about which diagrams it serves. */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';

const SPEAK = `(() => {
  const t = [];
  document.querySelectorAll('.toast,.toast-stack *,[role="status"],[role="alert"],[aria-live]').forEach(e => {
    const v = (e.textContent || '').replace(/\\s+/g, ' ').trim();
    if (v && e.getClientRects().length) t.push(v.slice(0, 110));
  });
  return [...new Set(t)];
})()`;

async function makeType(page, type) {
  await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(400);
  const srcBefore = await page.evaluate(`document.getElementById('source').value`);
  await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
  const dlg = await confirmDialog(page, 1500);
  await page.waitForTimeout(2400);
  const srcAfter = await page.evaluate(`document.getElementById('source').value`);
  return { dlg, changed: srcBefore !== srcAfter, firstBefore: srcBefore.split('\n')[0].trim(), firstAfter: srcAfter.split('\n')[0].trim(),
           chip: await page.evaluate(`((document.getElementById('diagramTypeText')||{}).textContent||'').trim()`) };
}

(async () => {
  const { page, close } = await openApp(APP, 9870, { width: 1500, height: 1000 });
  await page.evaluate(`document.querySelectorAll('#settingsSection, #settingsSection details').forEach(d => d.open = true)`);

  // ---- A. The Advanced starter
  console.log('A1 flowchart first  ' + JSON.stringify(await makeType(page, 'flowchart')));
  console.log('A2 ADVANCED         ' + JSON.stringify(await makeType(page, 'advanced')));
  console.log('A3 hint for advanced: ' + await page.evaluate(`((document.getElementById('diagramTypeHint')||{}).textContent||'').replace(/\\s+/g,' ').trim().slice(0,220)`));
  console.log('A4 pie then advanced ' + JSON.stringify(await makeType(page, 'pie')));
  console.log('A5 ADVANCED again    ' + JSON.stringify(await makeType(page, 'advanced')));

  // ---- B. Silence on a dead press. Sequence: numbering, density, curve all measured dead.
  await makeType(page, 'sequence');
  await page.evaluate(`document.querySelectorAll('#settingsSection, #settingsSection details').forEach(d => d.open = true)`);
  const trials = [
    { name: 'numberingStyle=flat on sequence', js: `(() => { const e = document.getElementById('numberingStyle'); e.value = 'flat'; e.dispatchEvent(new Event('change', { bubbles: true })); })()` },
    { name: 'density=spacious + Apply layout on sequence', js: `(() => { const e = document.getElementById('layoutDensity'); e.value = 'spacious'; e.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('applyLayoutButton').click(); })()` },
    { name: 'curve=stepAfter on sequence', js: `(() => { const e = document.getElementById('curve'); e.value = 'stepAfter'; e.dispatchEvent(new Event('change', { bubbles: true })); })()` },
    { name: 'palette colour 1 + Apply colours on sequence', js: `(() => { const e = document.getElementById('diagramPaletteColour0'); e.value = '#ff00cc'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('applyDiagramPaletteButton').click(); })()` },
    { name: 'Save current colours as class on sequence', js: `(() => { const n = document.getElementById('styleClassName'); n.value = 'ZZCLASS'; n.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('createStyleClassButton').click(); })()` },
    { name: 'Assign class to block on sequence', js: `(() => { document.getElementById('assignStyleClassButton').click(); })()` },
    { name: 'Reset all block styles on sequence', js: `(() => { document.getElementById('clearNodeStylesButton').click(); })()` },
    { name: 'Build legend from classes on sequence', js: `(() => { document.getElementById('legendFromClassesButton').click(); })()` }
  ];
  for (const t of trials) {
    await page.evaluate(`document.querySelectorAll('.toast').forEach(e => e.remove())`);
    const s0 = await page.evaluate(`((document.getElementById('status')||{}).textContent||'').trim()`);
    await page.evaluate(t.js);
    await page.waitForTimeout(1400);
    const said = await page.evaluate(SPEAK);
    const s1 = await page.evaluate(`((document.getElementById('status')||{}).textContent||'').trim()`);
    const dis = await page.evaluate(`(() => { const o = {}; ['assignStyleClassButton','createStyleClassButton','styleClassSelect'].forEach(i => { const e = document.getElementById(i); o[i] = e ? e.disabled : null; }); return o; })()`);
    console.log(`B  ${t.name}\n     status: "${s0}" -> "${s1}"\n     spoke:  ${JSON.stringify(said)}\n     btns:   ${JSON.stringify(dis)}`);
  }

  // ---- C. The Chart colours fold's own claim, and where the palette actually bites
  const claim = await page.evaluate(`(() => {
    const n = document.getElementById('styleFoldNameChart');
    const who = n && n.parentElement.querySelector('.style-fold-who');
    const sub = document.querySelector('[aria-label="Chart colours"] .style-subsection-head span');
    return { foldWho: who ? who.textContent.replace(/\\s+/g,' ').trim() : '', subsection: sub ? sub.textContent.replace(/\\s+/g,' ').trim() : '' };
  })()`);
  console.log('C  ' + JSON.stringify(claim, null, 1));

  await close();
})();
