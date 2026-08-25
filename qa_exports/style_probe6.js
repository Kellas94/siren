/* Probe 6: on a given diagram type, how many of the Style panel's live controls sit inside a
   fold that this probe has already measured as having no effect on that type? */
const { openApp, confirmDialog } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html';
const TYPES = ['flowchart', 'sequence', 'pie', 'gantt', 'c4'];

(async () => {
  const { page, close } = await openApp(APP, 9873, { width: 1500, height: 1000 });
  for (const type of TYPES) {
    await page.evaluate(`(() => { const s = document.getElementById('diagramTypeSelect'); s.value = ${JSON.stringify(type)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await page.waitForTimeout(400);
    await page.evaluate(`(() => { const b = Array.from(document.querySelectorAll('button')).find(x => /new starter/i.test(x.textContent) && x.getClientRects().length); (b || document.getElementById('newDiagramTypeButton')).click(); })()`);
    await confirmDialog(page, 1500);
    await page.waitForTimeout(2400);
    const first = await page.evaluate(`document.getElementById('source').value.split('\\n')[0].trim()`);
    await page.evaluate(`(() => { const ss = document.getElementById('settingsSection'); ss.open = true; ss.querySelectorAll('details').forEach(d => d.open = true); })()`);
    await page.waitForTimeout(500);
    const counts = await page.evaluate(`(() => {
      const ss = document.getElementById('settingsSection');
      const per = {};
      ss.querySelectorAll('details.style-fold').forEach(d => {
        const name = ((d.querySelector('summary span span')||{}).textContent||'').trim();
        const live = Array.from(d.querySelectorAll('input,select,textarea,button')).filter(e =>
          e.getClientRects().length && !e.disabled && !e.hidden && e.closest('summary') === null);
        per[name] = live.length;
      });
      const all = Array.from(ss.querySelectorAll('input,select,textarea,button')).filter(e =>
        e.getClientRects().length && !e.disabled && !e.hidden);
      return { perFold: per, totalLive: all.length };
    })()`);
    console.log(type.padEnd(11) + ' src="' + first + '"  ' + JSON.stringify(counts));
  }
  await close();
})();
