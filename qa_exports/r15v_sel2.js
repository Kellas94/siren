const { openApp } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');

(async () => {
  const { page, errors, close } = await openApp(process.argv[2], Number(process.argv[3]));
  await page.evaluate(`document.getElementById('workpapersButton')?.click()`);
  await page.waitForTimeout(2500);
  const dump = await page.evaluate(`(() => {
    const ws = document.getElementById('wpWorkspace');
    const out = { wsVis: ws ? !!ws.offsetParent : 'missing', wsRect: ws ? ws.getBoundingClientRect().toJSON() : null };
    out.ce = Array.from(document.querySelectorAll('[contenteditable]')).slice(0,20).map(n => ({ tag: n.tagName.toLowerCase(), id: n.id, cls: String(n.className).slice(0,50), ce: n.getAttribute('contenteditable'), vis: !!n.offsetParent, r: n.getBoundingClientRect().toJSON() }));
    out.wpIds = Array.from(document.querySelectorAll('[id^=wp]')).filter(n => n.offsetParent).slice(0,40).map(n => n.id + ':' + n.tagName.toLowerCase());
    out.visiblePanels = Array.from(document.querySelectorAll('section,aside,main')).filter(n => n.offsetParent && n.id).slice(0,30).map(n => n.id);
    return JSON.stringify(out);
  })()`);
  console.log(dump);
  await page.screenshot({ path: 'C:/Claude/SIREN/qa_exports/r15v_sel2.png' });
  console.log('ERRORS ' + JSON.stringify(errors.slice(0,6)));
  await close();
})();
