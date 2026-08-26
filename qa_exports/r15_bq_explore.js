#!/usr/bin/env node
/* Can a probe actually reach the reference jump through the real UI, with no access to `state`?
 * Nothing is asserted here; it prints what each step found.
 */
const { openBuild, killTour, setSource, clickSel, clickText } = require('./r15lib');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APP = arg('app', 'C:/Claude/SIREN/pending/round15/app.html');
const PORT = Number(arg('port', '9641'));

const SRC = ['flowchart TD']
  .concat(Array.from({ length: 8 }, (_, i) => '  N' + (i + 1) + '[Step ' + (i + 1) + '] --> N' + (i + 2) + '[Step ' + (i + 2) + ']'))
  .join('\n');

(async () => {
  const build = await openBuild(APP, PORT);
  const h = await build.page({ width: 1440, height: 900 });
  const page = h.page;
  await killTour(page);
  await setSource(page, SRC);

  console.log('nodes in svg: ' + await page.evaluate("document.querySelectorAll('#diagram svg g.node').length"));

  // --- open the inspector by clicking block N1 in the drawing ---
  const n1 = await page.evaluate(`(() => {
    const g = document.querySelector('#diagram svg g.node[id*="N1"]') ||
              Array.from(document.querySelectorAll('#diagram svg g.node')).find(n => /N1\\b/.test(n.id || ''));
    if (!g) return null; const r = g.getBoundingClientRect();
    return { id: g.id, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  console.log('N1 group: ' + JSON.stringify(n1));
  if (n1) { await page.mouse.click(n1.x, n1.y); await page.waitForTimeout(600); }
  console.log('inspector hidden: ' + await page.evaluate("document.getElementById('nodeInspector').hidden"));
  console.log('metadataOwner visible: ' + await page.evaluate("(() => { const e = document.getElementById('metadataOwner'); return !!(e && e.getBoundingClientRect().width > 1); })()"));
  console.log('moreButton: ' + await page.evaluate("(() => { const e = document.getElementById('inspectorMoreButton'); return e ? (e.textContent||'').trim() + ' vis=' + (e.getBoundingClientRect().width > 1) : 'none'; })()"));

  await h.close();
  await build.close();
})().catch(e => { console.error('FATAL ' + e.stack); process.exit(1); });
