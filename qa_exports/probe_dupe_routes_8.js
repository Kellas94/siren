#!/usr/bin/env node
/* Part 8. What the words on screen actually say.
 *   Y. Every visible control whose label contains "find", and what each one does.
 *   Z. The editor tab strip: what is actually in it.
 *   AA. Count the controls on screen at once, docked vs popped out.
 * Usage: node probe_dupe_routes_8.js [--port 9819]
 */
const { openApp } = require('./r7_lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Users/tsinc/Downloads/T_Industries_SIREN_v1.html');
const PORT = Number(arg('port', '9819'));

async function killTour(page) {
  for (let i = 0; i < 24; i++) {
    const gone = await page.evaluate(`(() => {
      const c = document.querySelector('.tour-card');
      if (!c) return true;
      const b = Array.from(c.querySelectorAll('button')).find(x => /skip|done|got it|close|finish/i.test(x.textContent)) || c.querySelector('button');
      if (b) b.click();
      return false;
    })()`);
    if (gone && i > 6) return;
    await page.waitForTimeout(160);
  }
}

const VISIBLE = `(() => {
  const out = [];
  document.querySelectorAll('button, [role="button"], select').forEach(b => {
    const r = b.getBoundingClientRect();
    if (!b.offsetParent || r.width < 2 || r.height < 2) return;
    out.push({ id: b.id || '(no id)', tag: b.tagName.toLowerCase(),
      text: String(b.textContent||'').replace(/\\s+/g,' ').trim().slice(0, 30),
      title: String(b.getAttribute('title')||'').replace(/\\s+/g,' ').trim().slice(0, 60),
      x: Math.round(r.left), y: Math.round(r.top) });
  });
  return JSON.stringify(out);
})()`;

(async () => {
  const { page, errors, close } = await openApp(APP, PORT, { width: 1440, height: 900 });
  await killTour(page);
  console.log('APP: ' + APP + '\n');
  await page.evaluate(`(() => { const s = document.getElementById('source'); s.value = 'flowchart TD\\n  A[Start] --> B[Check]\\n  B --> C[End]'; s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.waitForTimeout(3000);

  const docked = JSON.parse(await page.evaluate(VISIBLE));
  console.log('--- Y. every control on screen whose label or tooltip says "find" or "search" ---');
  docked.filter(b => /find|search/i.test(b.text + ' ' + b.title)).forEach(b =>
    console.log('  #' + b.id.padEnd(22) + ' "' + b.text + '"'.padEnd(20) + '  at ' + b.x + ',' + b.y + '   title: ' + b.title));
  console.log('  (off-screen relatives with the same verb: #workspaceSearchButton, #wpFindInput, #popoutFindButton, #exportScopeSearch, #multiPreviewSearch, #presentSearch, #mapRouteSearch)');

  console.log('\n--- Z. what is actually in the editor tab strip ---');
  const strip = await page.evaluate(`(() => {
    const t = document.getElementById('codeModeButton');
    const host = t ? t.parentElement : null;
    if (!host) return '[]';
    return JSON.stringify(Array.from(host.children).map(c => ({ id: c.id || '(no id)', role: c.getAttribute('role'),
      text: String(c.textContent||'').replace(/\\s+/g,' ').trim().slice(0,24), shown: !!c.offsetParent })));
  })()`);
  console.log('  ' + strip);
  const stripHost = await page.evaluate(`(() => { const t = document.getElementById('codeModeButton'); const h = t.parentElement; return h.getAttribute('role') + ' | ' + (h.getAttribute('aria-label')||'') + ' | class=' + h.className; })()`);
  console.log('  the strip itself: ' + stripHost);
  const innerHost = await page.evaluate(`(() => { const t = document.getElementById('structureModeButton'); const h = t.parentElement; return JSON.stringify({ role: h.getAttribute('role'), label: h.getAttribute('aria-label'), id: h.id, children: Array.from(h.children).map(c => (c.id||'?') + ':' + String(c.textContent||'').replace(/\\s+/g,' ').trim().slice(0,18)) }); })()`);
  console.log('  the inner pair:  ' + innerHost);

  console.log('\n--- AA. controls on screen at once ---');
  console.log('  docked: ' + docked.length + ' visible buttons/selects');
  await page.evaluate(`(() => { const b = document.getElementById('popOutEditorButton'); if (b) b.click(); })()`);
  await page.waitForTimeout(1400);
  const popped = JSON.parse(await page.evaluate(VISIBLE));
  console.log('  popped: ' + popped.length + ' visible buttons/selects');
  const undoLike = popped.filter(b => /undo|redo|↶|↷/i.test(b.text + ' ' + b.title + ' ' + b.id));
  console.log('  controls on screen that undo or redo: ' + undoLike.length);
  undoLike.forEach(b => console.log('    #' + b.id.padEnd(20) + ' "' + b.text + '"  title: ' + b.title.slice(0, 44)));
  const findLike = popped.filter(b => /find/i.test(b.text + ' ' + b.title + ' ' + b.id));
  console.log('  controls on screen that say Find: ' + findLike.length);
  findLike.forEach(b => console.log('    #' + b.id.padEnd(20) + ' "' + b.text + '"  title: ' + b.title.slice(0, 44)));
  const renderLike = popped.filter(b => /render/i.test(b.text + ' ' + b.title + ' ' + b.id));
  console.log('  controls on screen that render: ' + renderLike.length);
  renderLike.forEach(b => console.log('    #' + b.id.padEnd(20) + ' "' + b.text + '"'));

  console.log('\nerrors: ' + (errors.length ? errors.slice(0, 4).join(' // ') : 'none'));
  await close();
})();
