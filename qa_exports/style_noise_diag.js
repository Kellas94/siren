/* Why is flowchart geometry different between two identical renders? */
const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
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
  const { page, close } = await openApp(APP, 9853, { width: 1500, height: 1000 });
  await page.waitForTimeout(1500);
  const a = await page.evaluate(GEOM);
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = s.value; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(2200);
  const b = await page.evaluate(GEOM);
  console.log('lenA=' + a.length + ' lenB=' + b.length);
  let shown = 0;
  for (let i = 0; i < Math.max(a.length, b.length) && shown < 12; i++) {
    if (a[i] !== b[i]) { console.log('IDX ' + i + '\n  A ' + String(a[i]).slice(0, 220) + '\n  B ' + String(b[i]).slice(0, 220)); shown++; }
  }
  await close();
})();
