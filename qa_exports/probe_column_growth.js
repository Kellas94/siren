/* The 1812px column was measured on the 7-block starter. Real audit diagrams are bigger, and the
 * Blocks and Connectors lists in the builder grow with them - so this asks how far the Style card
 * sinks when the diagram is the size of something an auditor would actually draw. */
const { openApp, setSource } = require('C:/Claude/SIREN/qa_exports/r7_lib.js');
const APP = process.argv[2], PORT = Number(process.argv[3] || 9897);

function flow(n) {
  const lines = ['flowchart TD'];
  for (let i = 1; i < n; i++) lines.push('  N' + i + '["Control step ' + i + '"] --> N' + (i + 1) + '["Control step ' + (i + 1) + '"]');
  return lines.join('\n');
}
const MEASURE = `(() => {
  const pane = document.querySelector('.pane-scroll');
  const card = document.getElementById('settingsSection');
  if (!pane || !card) return JSON.stringify(null);
  const r = card.getBoundingClientRect(), pr = pane.getBoundingClientRect();
  return JSON.stringify({ scrollHeight: Math.round(pane.scrollHeight), clientHeight: Math.round(pane.clientHeight),
    styleTop: Math.round(r.top - pr.top + pane.scrollTop) });
})()`;

(async () => {
  for (const n of [7, 25, 44]) {
    const { page, close } = await openApp(APP, PORT + n, { width: 1440, height: 900 });
    for (let i = 0; i < 20; i++) {
      const g = await page.evaluate(`(() => { const c = document.querySelector('.tour-card'); if (!c) return true;
        const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
        if (b) b.click(); return false; })()`);
      if (g && i > 6) break;
      await page.waitForTimeout(160);
    }
    if (n > 7) { await setSource(page, flow(n), 3200); }
    await page.evaluate(`document.getElementById('visualModeButton').click()`);
    await page.waitForTimeout(1400);
    const d = JSON.parse(await page.evaluate(MEASURE));
    const blocks = await page.evaluate(`document.querySelectorAll('#diagram svg .node').length`);
    console.log(n + '-block diagram (' + blocks + ' drawn): column ' + d.scrollHeight + 'px in ' + d.clientHeight +
      'px window (' + Math.round(d.scrollHeight / d.clientHeight * 100) + '%);  Style card summary at ' + d.styleTop + 'px  = ' +
      (d.styleTop / d.clientHeight).toFixed(1) + ' screens down');
    await close();
  }
})();
