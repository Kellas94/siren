const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
(async () => {
  const { page, errors, close } = await openApp(process.argv[2], Number(process.argv[3]));
  await page.evaluate(`document.getElementById('workpapersButton').click()`);
  await page.waitForTimeout(1200);
  await page.evaluate(`(document.getElementById('wpEmptyNewButton')||document.getElementById('wpNewButton')).click()`);
  await page.waitForTimeout(2000);
  const { confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
  console.log('dlg: ' + await confirmDialog(page));
  await page.waitForTimeout(1500);
  const dump = await page.evaluate(`JSON.stringify(Array.from(document.querySelectorAll('[contenteditable]')).slice(0,20).map(n => ({ tag: n.tagName.toLowerCase(), id: n.id, cls: String(n.className).slice(0,60), ce: n.getAttribute('contenteditable'), vis: !!n.offsetParent, r: n.getBoundingClientRect().toJSON(), txt: (n.textContent||'').slice(0,30) })))`);
  console.log(dump);
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r15v_sel3.png' });
  console.log('ERRORS ' + JSON.stringify(errors.slice(0,6)));
  await close();
})();
