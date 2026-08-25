/* Does pressing "Style" in the Inspect menu at 375 do anything the person can see?
 *
 * The mobile route probe said the Fonts fold was covered by the header and the target had a
 * zero-sized box. That is consistent with two very different stories: the card opened somewhere
 * off-screen, or the card opened on a tab that is not showing. This separates them, and takes a
 * picture at each step so the answer can be looked at rather than inferred.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9878);
const W = Number(process.argv[4] || 375), H = Number(process.argv[5] || 812);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

const STATE = `(() => {
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const box = e => { if (!e) return null; const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; };
  const card = document.getElementById('settingsSection');
  const ed = document.getElementById('editorPane');
  const pv = document.getElementById('previewPane');
  const cs = e => e ? getComputedStyle(e).display : 'n/a';
  return JSON.stringify({
    mobileView: document.body.getAttribute('data-mobile-view') || document.body.className.match(/mobile-[a-z]+/)?.[0] || '?',
    editorTabSelected: document.getElementById('mobileEditorTab')?.getAttribute('aria-selected'),
    previewTabSelected: document.getElementById('mobilePreviewTab')?.getAttribute('aria-selected'),
    editorPaneDisplay: cs(ed), editorPaneBox: box(ed),
    previewPaneDisplay: cs(pv),
    styleCardOpen: card ? card.open : null,
    styleCardBox: box(card),
    firstFoldOpen: card ? Array.from(card.querySelectorAll('details.style-fold')).map(f => f.open) : null,
    fontSelectBox: box(document.getElementById('diagramFontFamily')),
    toastText: clean(document.querySelector('.toast, #toast, [role=status]')?.textContent).slice(0, 80)
  });
})()`;

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card'); if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click(); return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(170);
  }
}
const clickId = async (page, id) => {
  const r = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) return 'null';
    const b = e.getBoundingClientRect(); return JSON.stringify({ x: b.left + b.width/2, y: b.top + b.height/2 }); })()`));
  if (!r) return false;
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(800);
  return true;
};

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const { page, errors, close } = await openApp(APP, PORT, { width: W, height: H });
  await killTour(page);
  await page.waitForTimeout(500);

  const log = [];
  const mark = async (tag) => {
    const s = JSON.parse(await page.evaluate(STATE));
    log.push({ tag, s });
    console.log('--- ' + tag + ' ---');
    console.log('   mobile tab: editor=' + s.editorTabSelected + ' preview=' + s.previewTabSelected +
      ' | editorPane display=' + s.editorPaneDisplay + ' box=' + JSON.stringify(s.editorPaneBox));
    console.log('   style card: open=' + s.styleCardOpen + ' box=' + JSON.stringify(s.styleCardBox) +
      ' | font select box=' + JSON.stringify(s.fontSelectBox));
    await page.screenshot({ path: DIR + '/deadend_' + W + '_' + tag + '.png' });
  };

  await mark('0_rest');
  await clickId(page, 'mobilePreviewTab');
  await mark('1_preview_tab');
  await clickId(page, 'previewInspectButton');
  await mark('2_inspect_menu');

  const row = JSON.parse(await page.evaluate(`(() => {
    const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    const items = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item'));
    const it = items.find(i => /^\\s*Style/i.test(clean(i.textContent)));
    if (!it) return JSON.stringify({ err: 'no Style row', rows: items.map(i => clean(i.textContent)) });
    const b = it.getBoundingClientRect();
    return JSON.stringify({ label: clean(it.textContent), x: b.left + b.width/2, y: b.top + b.height/2 });
  })()`));
  console.log('   Inspect menu rows -> Style row: ' + JSON.stringify(row));
  if (row && row.x != null) { await page.mouse.click(row.x, row.y); await page.waitForTimeout(1100); }
  await mark('3_after_pressing_Style');

  console.log('');
  console.log('page errors: ' + errors.length);
  fs.writeFileSync(DIR + '/deadend_' + W + '.json', JSON.stringify(log, null, 1));
  await close();
})();
