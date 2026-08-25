/* JOB BH skeptic probe 7 - the arrival now hands the keyboard to the canvas.
   After a reference arrival, what does one ordinary keystroke do?
   node sk_bh_p7.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const SRC = ['flowchart TD'].concat(
  Array.from({ length: 12 }, (_, i) => '  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']')
).join('\n');

async function arrive(page, target) {
  const ref = await L.makeReference(page, target);
  await L.armObservers(page);
  await L.clickChip(page);
  await page.waitForTimeout(1500);
  return ref;
}

async function run(port, key, label) {
  const { page, errors, close } = await L.openApp(APP, port, { width: 1024, height: 700 });
  try {
    await L.setSource(page, SRC, 3400);
    const before = await page.$eval('#source', e => e.value);
    if (before.trim() !== SRC.trim()) throw new Error('FIXTURE MISMATCH');
    await arrive(page, 'N9');
    const focus = await page.evaluate(() => {
      const a = document.activeElement;
      return { tag: a && a.tagName, id: a && a.id, inSvg: !!(a && a.closest && a.closest('#diagram svg')) };
    });
    if (key === 'Backspace' || key === 'Delete') await page.keyboard.press(key);
    else await page.keyboard.type(key);
    await page.waitForTimeout(1600);
    const after = await page.$eval('#source', e => e.value);
    const state = await page.evaluate(() => ({
      inplace: !!document.querySelector('.t-inplace, [contenteditable="true"], .canvas-inplace'),
      inplaceText: (document.querySelector('.t-inplace, .canvas-inplace') || {}).textContent || null,
      toasts: (window.__toasts || []).map(t => t.text),
      nodeCount: document.querySelectorAll('#diagram svg g.node').length
    }));
    return {
      label, key, focus,
      sourceBefore: before, sourceAfter: after,
      sourceChanged: before.trim() !== after.trim(),
      lostN9: /N9\[/.test(before) && !/N9\[/.test(after),
      state, errors: errors.slice()
    };
  } finally { await close(); }
}

(async () => {
  const out = { tag: TAG, app: APP, cases: [] };
  for (const [i, k] of [['Backspace'], ['Delete'], ['z']].entries()) {
    try { out.cases.push(await run(PORT + i, k[0], 'after arrival press ' + k[0])); }
    catch (e) { out.cases.push({ key: k[0], ERROR: String(e.message) }); }
  }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p7_' + TAG + '.json', JSON.stringify(out, null, 1));
  out.cases.forEach(c => console.log(TAG, c.key, 'focusInSvg=' + (c.focus && c.focus.inSvg), 'sourceChanged=' + c.sourceChanged, 'lostN9=' + c.lostN9, 'inplace=' + (c.state && c.state.inplace), JSON.stringify(c.state && c.state.toasts)));
})();
