/* JOB BH skeptic probe 8 - type-to-replace after a reference arrival.
   node sk_bh_p8.js <appPath> <port> <tag> */
const fs = require('fs');
const L = require('./sk_bh_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3]), TAG = process.argv[4];

const SRC = ['flowchart TD'].concat(
  Array.from({ length: 12 }, (_, i) => '  N' + i + '[Step ' + i + '] --> N' + (i + 1) + '[Step ' + (i + 1) + ']')
).join('\n');

(async () => {
  const out = { tag: TAG };
  const { page, errors, close } = await L.openApp(APP, PORT, { width: 1024, height: 700 });
  try {
    await L.setSource(page, SRC, 3400);
    out.sourceBefore = await page.$eval('#source', e => e.value);
    await L.makeReference(page, 'N9');
    await L.armObservers(page);
    await L.clickChip(page);
    await page.waitForTimeout(1500);
    out.focus = await page.evaluate(() => { const a = document.activeElement; return { tag: a && a.tagName, id: a && a.id, inSvg: !!(a && a.closest && a.closest('#diagram svg')) }; });
    await page.keyboard.type('Rework');
    await page.waitForTimeout(700);
    out.duringRename = await page.evaluate(() => {
      const ed = document.querySelector('#diagram svg [contenteditable="true"], #diagram foreignObject [contenteditable="true"], .t-inplace-editor');
      return ed ? { text: (ed.textContent || '').trim(), tag: ed.tagName } : null;
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    out.sourceAfter = await page.$eval('#source', e => e.value);
    out.n9Line = (out.sourceAfter.match(/N9\[[^\]]*\]/) || [null])[0];
    out.changed = out.sourceBefore.trim() !== out.sourceAfter.trim();
    out.toasts = await page.evaluate(() => (window.__toasts || []).map(t => t.text));
    out.errors = errors.slice();
    await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/skbh_type_' + TAG + '.png' });
  } catch (e) { out.ERROR = String(e.message); }
  finally { await close(); }
  fs.writeFileSync('C:/Claude/SIREN/qa_exports/skbh_p8_' + TAG + '.json', JSON.stringify(out, null, 1));
  console.log(TAG, 'focusInSvg=' + (out.focus && out.focus.inSvg), 'changed=' + out.changed, 'n9=' + out.n9Line, 'during=' + JSON.stringify(out.duringRename), 'toasts=' + JSON.stringify(out.toasts), out.ERROR || '');
})();
