/* DISTANCE, in pixels, at the three widths - plus pictures of the desktop Style route.
 *
 * "Reach 4" understates the Style card because two of those presses are also a hunt down a
 * column more than twice the height of its own window. This measures that column, and where in
 * it each thing sits, at 1440, 1024 and 375.
 */
const { openApp } = require('./r7_lib.js');
const fs = require('fs');
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9880);
const DIR = 'C:/Claude/SIREN/qa_exports/reach';

const MEASURE = `(() => {
  const pane = document.querySelector('.pane-scroll');
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  const off = (id) => {
    const e = document.getElementById(id);
    if (!e || !pane) return null;
    const r = e.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    return Math.round(r.top - pr.top + pane.scrollTop);
  };
  const offSel = (sel) => {
    const e = document.querySelector(sel);
    if (!e || !pane) return null;
    const r = e.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    return Math.round(r.top - pr.top + pane.scrollTop);
  };
  // Open everything, so the card's true depth is measured, not its collapsed stub.
  const card = document.getElementById('settingsSection');
  const before = {
    paneScrollHeight: pane ? Math.round(pane.scrollHeight) : null,
    paneClientHeight: pane ? Math.round(pane.clientHeight) : null,
    styleCardTop: off('settingsSection'),
    advancedCardTop: offSel('.advanced-tools-card'),
    builderTop: offSel('.visual-builder')
  };
  if (card) { card.open = true; card.querySelectorAll('details.style-fold').forEach(f => f.open = true); }
  const after = {
    paneScrollHeight: pane ? Math.round(pane.scrollHeight) : null,
    fontSelectTop: off('diagramFontFamily'),
    curveTop: off('curve'),
    legendTop: off('legendEnabled'),
    classSelectTop: off('styleClassSelect'),
    brandPresetTop: off('brandPresetSelect')
  };
  return JSON.stringify({ before, after });
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

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  for (const [w, h] of [[1440, 900], [1024, 768], [375, 812]]) {
    const { page, close } = await openApp(APP, PORT + (w % 97), { width: w, height: h });
    await killTour(page);
    await page.waitForTimeout(500);
    const d = JSON.parse(await page.evaluate(MEASURE));
    const b = d.before, a = d.after;
    console.log('== ' + w + 'x' + h + ' ==');
    console.log('   left column: ' + b.paneScrollHeight + 'px of content in a ' + b.paneClientHeight + 'px window  (' +
      Math.round(b.paneScrollHeight / b.paneClientHeight * 100) + '% - ' + Math.max(0, b.paneScrollHeight - b.paneClientHeight) + 'px below the fold at rest)');
    console.log('   Style card summary sits ' + b.styleCardTop + 'px down that column' +
      (b.styleCardTop > b.paneClientHeight ? '  -> BELOW THE FOLD at rest, cannot be seen without scrolling' : '  -> visible at rest'));
    console.log('   with every fold open the column becomes ' + a.paneScrollHeight + 'px;  font=' + a.fontSelectTop +
      'px  spacing/curve=' + a.curveTop + 'px  legend=' + a.legendTop + 'px  style class=' + a.classSelectTop + 'px  brand preset=' + a.brandPresetTop + 'px');
    await close();
  }

  // Pictures of the desktop Style route, one per press.
  const { page, close } = await openApp(APP, PORT + 1, { width: 1440, height: 900 });
  await killTour(page);
  await page.waitForTimeout(500);
  const clickId = async (id) => {
    const r = JSON.parse(await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) return 'null';
      const b = e.getBoundingClientRect(); return JSON.stringify({ x: b.left + b.width/2, y: b.top + b.height/2 }); })()`));
    if (r) { await page.mouse.click(r.x, r.y); await page.waitForTimeout(800); }
  };
  await page.screenshot({ path: DIR + '/route_1_rest.png' });
  await clickId('previewInspectButton');
  await page.screenshot({ path: DIR + '/route_2_inspect_menu.png' });
  const row = JSON.parse(await page.evaluate(`(() => {
    const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    const it = Array.from(document.querySelectorAll('.struct-menu .struct-menu-item')).find(i => /^\\s*Style/i.test(clean(i.textContent)));
    if (!it) return JSON.stringify(null);
    const b = it.getBoundingClientRect(); return JSON.stringify({ x: b.left + b.width/2, y: b.top + b.height/2 });
  })()`));
  if (row) { await page.mouse.click(row.x, row.y); await page.waitForTimeout(1200); }
  await page.screenshot({ path: DIR + '/route_3_style_card.png' });
  const fold = JSON.parse(await page.evaluate(`(() => {
    const s = document.querySelector('#styleFoldFonts > summary');
    if (!s) return JSON.stringify(null);
    const b = s.getBoundingClientRect(); return JSON.stringify({ x: b.left + b.width/2, y: b.top + b.height/2, top: Math.round(b.top) });
  })()`));
  console.log('');
  console.log('Fonts fold summary after the Style press: ' + JSON.stringify(fold));
  if (row && fold) { await page.mouse.click(fold.x, fold.y); await page.waitForTimeout(900); }
  await page.screenshot({ path: DIR + '/route_4_fonts_open.png' });
  await close();
  console.log('screenshots written to ' + DIR);
})();
