/* Probe 7: re-test the two C4 outliers on their own, and take a picture of the result.
   Claim under test: on a C4 diagram, ticking "Show legend" changes nothing at all. */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const OUT = 'C:/Claude/SIREN/qa_exports/style_shot/';

const SHOT = `(() => {
  const svg = document.querySelector('#diagram svg');
  const wrap = document.getElementById('diagram');
  return { svgLen: svg ? svg.outerHTML.length : -1,
           wrapLen: wrap ? wrap.innerHTML.length : -1,
           legendish: wrap ? wrap.querySelectorAll('[class*="legend"],[id*="legend"]').length : -1,
           texts: svg ? Array.from(svg.querySelectorAll('text,div,span')).map(e => e.textContent.trim()).filter(Boolean).join('|').slice(0, 400) : '',
           weights: svg ? [...new Set(Array.from(svg.querySelectorAll('text,tspan,div,span')).map(e => getComputedStyle(e).fontWeight))].sort().join(',') : '' };
})()`;

(async () => {
  const { page, close } = await openApp(APP, 9874, { width: 1500, height: 1000 });
  for (const type of ['c4', 'flowchart']) {
    await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
    await confirmDialog(page, 1500);
    await page.waitForTimeout(2800);
    const src = await page.evaluate(`document.getElementById('source').value.split('\\n')[0].trim()`);
    await page.evaluate(`(() => { const ss = document.getElementById('settingsSection'); ss.open = true; ss.querySelectorAll('details').forEach(d => d.open = true); })()`);
    await page.waitForTimeout(400);

    const before = await page.evaluate(SHOT);
    await page.evaluate(`(() => {
      const r0 = document.querySelector('#legendItems .legend-edit-row');
      const cb = r0.querySelector('.legend-item-enabled'), lb = r0.querySelector('.legend-item-label');
      cb.checked = true; lb.value = 'ZZLEGENDZZ';
      cb.dispatchEvent(new Event('change', { bubbles: true })); lb.dispatchEvent(new Event('input', { bubbles: true }));
      const en = document.getElementById('legendEnabled'); en.checked = true;
      en.dispatchEvent(new Event('change', { bubbles: true })); en.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await page.waitForTimeout(2500);
    const after = await page.evaluate(SHOT);
    console.log(`${type} src="${src}"\n  legendEnabled ticked, item 1 = ZZLEGENDZZ`);
    console.log(`  before: svg=${before.svgLen} wrap=${before.wrapLen} legendNodes=${before.legendish} weights=${before.weights}`);
    console.log(`  after : svg=${after.svgLen} wrap=${after.wrapLen} legendNodes=${after.legendish} weights=${after.weights}`);
    console.log(`  legend word ZZLEGENDZZ anywhere in the preview: ` + await page.evaluate(`document.getElementById('diagram').innerHTML.indexOf('ZZLEGENDZZ') >= 0`));
    // font weight
    await page.evaluate(`(() => { const e = document.getElementById('diagramFontWeight'); e.value = '800'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(2200);
    const w = await page.evaluate(SHOT);
    console.log(`  weights after diagramFontWeight=800: ${w.weights}`);
    await page.screenshot({ path: OUT + 's7_' + type + '_legend.png' });
    // clean up for the next type
    await page.evaluate(`(() => { const en = document.getElementById('legendEnabled'); en.checked = false; en.dispatchEvent(new Event('change', { bubbles: true }));
      const e = document.getElementById('diagramFontWeight'); e.value = '500'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(1200);
  }
  await close();
})();
