const { openApp, setSource, check, report } = require('./r7_lib');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
(async () => {
  const { page, errors, close } = await openApp(APP, 9738);
  await setSource(page, 'flowchart TD\n  A[One] --> B[Two]\n  B --> C[Three]', 3500);
  const r = JSON.parse(await page.evaluate(`(async () => {
    document.getElementById('previewViewButton').click();
    await new Promise(r => setTimeout(r, 700));
    const menu = document.querySelector('.struct-menu');
    const row = menu && Array.from(menu.querySelectorAll('.struct-menu-item')).find(b => /zoom/i.test(b.textContent));
    if (!row) return JSON.stringify({ err: 'no Zoom row' });
    row.click();
    await new Promise(r => setTimeout(r, 900));
    const pops = Array.from(document.querySelectorAll('.struct-menu')).map(m => {
      const b = m.getBoundingClientRect();
      return { label: m.getAttribute('aria-label'), box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
               rows: Array.from(m.querySelectorAll('.struct-menu-item')).map(x => x.textContent.trim()).slice(0,6) };
    });
    return JSON.stringify({ count: pops.length, pops, innerW: innerWidth, innerH: innerHeight });
  })()`));
  console.log(JSON.stringify(r, null, 2));
  check('zoom.viaMenu.opens', r.count >= 1, 'a zoom popup appears after picking Zoom…', `${r.count} menus`);
  if (r.count) {
    const p = r.pops[r.pops.length - 1];
    const onScreen = p.box[0] >= 0 && p.box[1] >= 0 && p.box[0] + p.box[2] <= r.innerW && p.box[1] + p.box[3] <= r.innerH;
    check('zoom.viaMenu.onScreen', onScreen, 'it is inside the viewport', `${p.label} at ${p.box.join(',')} in ${r.innerW}x${r.innerH}`);
  }
  await page.screenshot({ path: 'C:/Claude/SIREN/pending/round7/zoom_via_menu.png' });
  await close();
  process.exit(report('zoom via menu') ? 1 : 0);
})();
