/* Same question, but on the starter the matrix actually uses, and after the same settle. */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';

const GEOM = `(() => {
  const svg = document.querySelector('#diagram svg');
  const out = [];
  for (const el of svg.querySelectorAll('*')) {
    const t = el.tagName.toLowerCase();
    if (t === 'path' || t === 'line' || t === 'polyline' || t === 'polygon')
      out.push(t + '#' + (el.getAttribute('class')||'') + ':' + (el.getAttribute('d') || el.getAttribute('points') || ''));
    if (t === 'rect' || t === 'circle' || t === 'ellipse' || t === 'foreignobject' || t === 'image')
      out.push(t + '#' + (el.getAttribute('class')||'') + ':' + ['x','y','width','height','cx','cy','r','rx','ry'].map(a => el.getAttribute(a) || '').join(','));
    if (t === 'g' && el.getAttribute('transform')) out.push('g#' + (el.getAttribute('class')||'') + ':' + el.getAttribute('transform'));
  }
  return out;
})()`;

(async () => {
  const { page, close } = await openApp(APP, 9856, { width: 1500, height: 1000 });
  await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = 'flowchart'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
  await confirmDialog(page, 1500);
  await page.waitForTimeout(2600);
  const noop = async () => { await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = s.value; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await page.waitForTimeout(1700); };
  await noop(); await noop();
  const src = await page.evaluate(`document.getElementById('source').value`);
  console.log('SOURCE:\n' + src.slice(0, 500));
  const snaps = [];
  for (let i = 0; i < 4; i++) { snaps.push(await page.evaluate(GEOM)); await noop(); }
  for (let k = 1; k < snaps.length; k++) {
    const a = snaps[k - 1], b = snaps[k];
    const d = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) d.push(i);
    console.log('pair ' + (k - 1) + '->' + k + ': lens ' + a.length + '/' + b.length + ' diffs ' + d.length + ' at ' + d.slice(0, 8).join(','));
    for (const i of d.slice(0, 4)) console.log('  IDX ' + i + '\n    A ' + String(a[i]).slice(0, 200) + '\n    B ' + String(b[i]).slice(0, 200));
  }
  await close();
})();
