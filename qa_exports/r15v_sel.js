/* Find the selectors I need: Docs contenteditable, mode buttons, source. Settled page is fine here. */
const path = require('path');
const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

(async () => {
  const { page, errors, close } = await openApp(process.argv[2], Number(process.argv[3]));
  const out = {};
  out.modeButtons = JSON.parse(await page.evaluate(`JSON.stringify(['visualModeButton','codeModeButton','workpapersButton','source','visualNodeLabel','wpWorkspace'].map(id => {
    const n = document.getElementById(id);
    if (!n) return [id, 'MISSING'];
    const r = n.getBoundingClientRect();
    return [id, n.tagName.toLowerCase(), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height), !!n.offsetParent];
  }))`));
  // Open docs
  await page.evaluate(`document.getElementById('workpapersButton')?.click()`);
  await page.waitForTimeout(1500);
  out.afterDocs = JSON.parse(await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('[contenteditable="true"],[contenteditable=""]')).slice(0,25).map(n => {
    const r = n.getBoundingClientRect();
    return { tag: n.tagName.toLowerCase(), id: n.id, cls: String(n.className).slice(0,60), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: !!n.offsetParent, txt: (n.textContent||'').slice(0,40) };
  }))`));
  out.dialogs = JSON.parse(await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('dialog')).map(d => ({ id: d.id, open: d.open })).slice(0,40))`));
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS ' + JSON.stringify(errors.slice(0, 8)));
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r15v_sel.png' });
  await close();
})();
