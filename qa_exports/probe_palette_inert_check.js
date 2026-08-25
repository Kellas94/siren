/* Do not report "181 palette rows are inert" without pressing some of them.
 *
 * A row whose button is not rendered may still work perfectly - button.click() fires the handler
 * whether or not the button is on screen. So this presses a sample through the palette exactly as
 * a person would and records whether the app visibly responded: a dialog opened, a toast appeared,
 * the source changed, or nothing at all happened.
 *
 * It also settles the question the last probe left open: is there really a button anywhere that
 * saves the project file, or did the text match land on a tooltip?
 */
const { openApp } = require('./r7_lib.js');
const APP = process.argv[2] || 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const PORT = Number(process.argv[3] || 9888);

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

const SNAP = `(() => {
  const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
  return JSON.stringify({
    dialogs: Array.from(document.querySelectorAll('dialog[open]')).map(d => d.id),
    status: clean(document.getElementById('status')?.textContent).slice(0, 60),
    toasts: Array.from(document.querySelectorAll('.toast, .toast-item, [data-toast]')).map(t => clean(t.textContent).slice(0, 60)),
    src: (document.getElementById('source') || {}).value || '',
    menus: document.querySelectorAll('.struct-menu').length,
    findBar: !!document.querySelector('#findReplaceBar:not([hidden])')
  });
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  await page.waitForTimeout(500);

  // Settle the "Save project" question first, against the real buttons.
  const saveBtns = JSON.parse(await page.evaluate(`(() => {
    const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
    return JSON.stringify(Array.from(document.querySelectorAll('button')).filter(b =>
      /save project|open project/i.test(clean(b.textContent)) || /save project|open project/i.test(clean(b.getAttribute('title'))))
      .map(b => ({ id: b.id, text: clean(b.textContent).slice(0,40), title: clean(b.getAttribute('title')).slice(0,60),
                   rendered: !!b.getClientRects().length })));
  })()`));
  console.log('buttons whose text or tooltip mentions save/open project:');
  saveBtns.forEach(b => console.log('   #' + b.id + '  text="' + b.text + '"  title="' + b.title + '"  rendered=' + b.rendered));
  if (!saveBtns.length) console.log('   (none)');

  // Now press a sample of palette rows whose underlying button is not rendered.
  const SAMPLE = ['Update block', '＋ Add participant', 'Replace all', 'Rename group', 'Save selection', 'Approve', 'Apply merge'];
  console.log('');
  for (const title of SAMPLE) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.evaluate(`(() => { document.querySelectorAll('dialog[open]').forEach(d => { try { d.close(); } catch(e){} }); })()`);
    await page.waitForTimeout(200);
    const before = JSON.parse(await page.evaluate(SNAP));

    await page.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, bubbles: true }))`);
    await page.waitForTimeout(450);
    const found = await page.evaluate(`(async () => {
      const clean = s => String(s || '').replace(/[\\s\\u00a0]+/g, ' ').trim();
      const inp = document.getElementById('commandPaletteInput');
      inp.value = ${JSON.stringify(title)};
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
      const rows = Array.from(document.getElementById('commandPaletteList').children);
      const row = rows.find(r => clean(r.querySelector('span')?.textContent) === ${JSON.stringify(title)});
      if (!row) return 'ROW NOT OFFERED';
      row.click();
      return 'pressed';
    })()`);
    await page.waitForTimeout(900);
    const after = JSON.parse(await page.evaluate(SNAP));

    const changed = [];
    if (JSON.stringify(before.dialogs) !== JSON.stringify(after.dialogs)) changed.push('dialog:' + after.dialogs.join(','));
    if (before.status !== after.status) changed.push('status:"' + after.status + '"');
    if (JSON.stringify(before.toasts) !== JSON.stringify(after.toasts)) changed.push('toast:"' + after.toasts.join(' / ') + '"');
    if (before.src !== after.src) changed.push('source changed');
    if (before.menus !== after.menus) changed.push('menu opened');
    if (before.findBar !== after.findBar) changed.push('find bar');
    console.log('palette "' + title + '"  -> ' + found + '  |  visible response: ' + (changed.length ? changed.join(' + ') : 'NONE'));
  }

  console.log('');
  console.log('page errors: ' + errors.length);
  errors.slice(0, 6).forEach(e => console.log('   ! ' + e));
  await close();
})();
