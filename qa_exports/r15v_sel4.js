const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
(async () => {
  const { page, errors, close } = await openApp(process.argv[2], Number(process.argv[3]));
  await page.evaluate(`document.getElementById('workpapersButton').click()`);
  await page.waitForTimeout(1000);
  await page.evaluate(`(document.getElementById('wpEmptyNewButton')||document.getElementById('wpNewButton')).click()`);
  await page.waitForTimeout(900);
  const clicked = await page.evaluate(`(() => {
    const b = Array.from(document.querySelectorAll('button,[role=menuitem],li,a')).find(n => n.offsetParent && /^\s*Narrative\s*$/.test(n.textContent||''));
    if (!b) return 'no narrative';
    const r = b.getBoundingClientRect(); b.click(); return JSON.stringify([r.x+r.width/2, r.y+r.height/2]);
  })()`);
  console.log('picked ' + clicked);
  await page.waitForTimeout(2200);
  console.log(await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('[contenteditable]')).slice(0,25).map(n => ({ tag: n.tagName.toLowerCase(), id: n.id, cls: String(n.className).slice(0,60), ce: n.getAttribute('contenteditable'), vis: !!n.offsetParent, r: n.getBoundingClientRect().toJSON(), txt: (n.textContent||'').slice(0,30) })))`));
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r15v_sel4.png' });
  console.log('ERRORS ' + JSON.stringify(errors.slice(0,6)));
  await close();
})();
