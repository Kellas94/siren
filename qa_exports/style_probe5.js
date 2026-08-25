/* Probe 5: the scroll route, the size of the panel, and a picture of the dead controls. */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const OUT = 'C:/Claude/SIREN/qa_exports/style_shot/';

(async () => {
  const { page, close } = await openApp(APP, 9872, { width: 1500, height: 1000 });

  const layout = await page.evaluate(`(() => {
    const ss = document.getElementById('settingsSection');
    const sc = ss.closest('.pane-scroll');
    const cards = Array.from(sc.querySelectorAll(':scope > details.card, :scope > section, :scope > div'))
      .filter(e => e.getClientRects().length)
      .map(e => ({ tag: e.tagName, id: e.id, h: Math.round(e.getBoundingClientRect().height),
                   head: (e.querySelector('summary,h2,h3,strong') || e).textContent.replace(/\\s+/g,' ').trim().slice(0,44) }));
    return { mode: document.body.className,
             scrollHeight: Math.round(sc.scrollHeight), clientHeight: Math.round(sc.clientHeight),
             styleCardOffsetTop: Math.round(ss.offsetTop),
             scrollNeeded: Math.round(ss.offsetTop - sc.offsetTop),
             cardsInPane: cards };
  })()`);
  console.log('LAYOUT ' + JSON.stringify(layout, null, 1));

  // open the card and every fold, then measure how tall the Style surface actually is
  await page.evaluate(`(() => { const ss = document.getElementById('settingsSection'); ss.open = true; ss.querySelectorAll('details').forEach(d => d.open = true); })()`);
  await page.waitForTimeout(600);
  const size = await page.evaluate(`(() => {
    const ss = document.getElementById('settingsSection');
    const sc = ss.closest('.pane-scroll');
    return { styleCardHeight: Math.round(ss.getBoundingClientRect().height),
             screensOfScrolling: +(ss.getBoundingClientRect().height / sc.clientHeight).toFixed(1),
             paneClientHeight: Math.round(sc.clientHeight),
             foldHeights: Array.from(ss.querySelectorAll('details.style-fold')).map(d =>
               ((d.querySelector('summary span span')||{}).textContent||'').trim() + '=' + Math.round(d.getBoundingClientRect().height)) };
  })()`);
  console.log('SIZE ' + JSON.stringify(size, null, 1));

  // a picture of the six named doors, closed
  await page.evaluate(`(() => { const ss = document.getElementById('settingsSection'); ss.querySelectorAll('details.style-fold').forEach(d => d.open = false); ss.scrollIntoView(); })()`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + 's5_six_doors.png' });

  // now a sequence diagram with the Spacing fold open: six live controls, none of which do anything
  await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = 'sequence'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.waitForTimeout(400);
  await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
  await confirmDialog(page, 1500);
  await page.waitForTimeout(2600);
  const fx = await page.evaluate(`document.getElementById('source').value.split('\\n')[0].trim()`);
  console.log('FIXTURE for the picture: ' + fx);
  await page.evaluate(`(() => {
    const ss = document.getElementById('settingsSection'); ss.open = true;
    const folds = Array.from(ss.querySelectorAll('details.style-fold'));
    folds.forEach(d => d.open = false);
    folds[1].open = true; folds[2].open = true;
    folds[1].scrollIntoView({ block: 'start' });
  })()`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + 's5_sequence_dead_spacing.png' });
  await close();
})();
